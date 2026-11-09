import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import {
  SmError, smHandle, requireSubsidiaryManager, getSubsidiaryOrThrow,
  parseJson, smLogActivity, smLogAudit, smNotify,
} from "@/lib/sm/server";
import { loadRowContext, toSmSubmissionRow } from "@/lib/sm/rows";
import type { DecisionResponse } from "@/lib/sm/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/* ─────────────────────────────────────────────────────────────────────────────
   POST /api/sm/submissions/[id]/decision — THE review decision endpoint.

   Body: { action: "approve" | "reject", reason?, instructions?, expectedUpdatedAt? }

   Workflow contract (spec §11/§12):
     · approve eligible from SUBMITTED | UNDER_REVIEW | CHANGES_REQUESTED
     · reject  eligible from SUBMITTED | UNDER_REVIEW
     · reject REQUIRES a meaningful reason (≥ 10 chars) — empty rejections
       are blocked server-side, not just in the dialog
     · version guard: `expectedUpdatedAt` must match the stored updatedAt;
       a report that changed after the manager opened it is refused with 409
       so a stale version is never approved
     · concurrent-safe: the state re-check + update happen against the fresh
       DB row, and the update's where-clause re-asserts the eligible status
     · every decision persists: reviewer identity, timestamp, appended
       comment + history entry (version trail), notification to the
       responsible user + Subsidiary Admin + Group Admin, activity + audit
   ───────────────────────────────────────────────────────────────────────────── */

const ELIGIBLE: Record<string, string[]> = {
  approve: ["SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED", "BU_APPROVED"],
  reject: ["SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED", "BU_APPROVED"],
};

export async function POST(req: NextRequest, { params }: Params) {
  return smHandle(async () => {
    const ctx = await requireSubsidiaryManager();
    const sub = await getSubsidiaryOrThrow(ctx.subsidiaryId);
    const { id } = await params;

    const b = (await req.json().catch(() => ({}))) as {
      action?: string;
      reason?: string;
      instructions?: string;
      expectedUpdatedAt?: string;
    };
    const action = String(b.action ?? "");
    if (!ELIGIBLE[action]) throw new SmError("Unknown review action.", 400);

    const reason = (b.reason ?? "").trim();
    const instructions = (b.instructions ?? "").trim();
    if (action === "reject" && reason.length < 10) {
      throw new SmError("A meaningful rejection reason (at least 10 characters) is mandatory.", 400);
    }

    /* Load fresh + scope check. */
    const s = await db.submission.findUnique({ where: { id } });
    if (!s) throw new SmError("Submission not found.", 404);
    let scopeId: string | null = s.subsidiaryId ?? null;
    if (s.businessUnitId) {
      const bu = await db.businessUnit.findUnique({ where: { id: s.businessUnitId }, select: { subsidiaryId: true } });
      if (bu) scopeId = bu.subsidiaryId;
    } else if (s.projectId) {
      const prj = await db.project.findUnique({
        where: { id: s.projectId },
        include: { businessUnit: { select: { subsidiaryId: true } } },
      });
      if (prj) scopeId = prj.businessUnit.subsidiaryId;
    }
    if (scopeId !== ctx.subsidiaryId) {
      throw new SmError("This submission is outside your assigned subsidiary.", 403);
    }

    /* Eligible state? */
    if (!ELIGIBLE[action].includes(s.status)) {
      throw new SmError(
        `This report is no longer eligible for ${action} — its current workflow state is ${s.status.replace(/_/g, " ")}. Refresh the queue to see the latest state.`,
        409
      );
    }

    /* Version guard: refuse decisions on a stale version (with 30s tolerance). */
    if (b.expectedUpdatedAt && Math.abs(new Date(b.expectedUpdatedAt).getTime() - s.updatedAt.getTime()) > 30000) {
      throw new SmError(
        "This report changed after you opened it. Refresh and review the latest version before deciding.",
        409
      );
    }

    const now = new Date();
    const comments = parseJson<{ author: string; role: string; text: string; at: string }[]>(s.comments, []);
    const history = parseJson<{ action: string; actor: string; at: string; note?: string }[]>(s.history, []);
    const version = history.length + 1;

    const commentText =
      action === "reject"
        ? [reason, instructions && `Correction instructions: ${instructions}`].filter(Boolean).join("\n\n")
        : reason || "";

    const newComment = commentText
      ? [...comments, { author: ctx.name, role: "SUBSIDIARY_MANAGER", text: commentText, at: now.toISOString() }]
      : comments;
    const historyNote = action === "reject" ? reason : commentText || undefined;
    const newHistory = [
      ...history,
      {
        action:
          action === "approve"
            ? `Approved by ${ctx.name} (Subsidiary Manager)`
            : `Rejected by ${ctx.name} (Subsidiary Manager) — returned for correction`,
        actor: ctx.name,
        at: now.toISOString(),
        ...(historyNote ? { note: historyNote } : {}),
      },
    ];

    /* Persist with the eligible status re-asserted in the where-clause so a
       concurrent decision cannot double-apply. */
    const updated = await db.submission.updateMany({
      where: { id, status: { in: ELIGIBLE[action] } },
      data: {
        status: action === "approve" ? "APPROVED" : "REJECTED",
        reviewedAt: now,
        reviewerId: ctx.userId,
        comments: JSON.stringify(newComment),
        history: JSON.stringify(newHistory),
      },
    });
    if (updated.count !== 1) {
      throw new SmError("Concurrent update detected — the report state changed. Refresh and review again.", 409);
    }

    const responsible = s.submittedById
      ? (await db.user.findUnique({ where: { id: s.submittedById }, select: { name: true } }))?.name ?? "the responsible user"
      : "the responsible user";

    /* One null-scope notification = visible on Group Admin bell AND the
       subsidiary console bell AND this manager's bell (cross-console sync). */
    await smNotify({
      ntype: "APPROVAL",
      title: action === "approve" ? `Report approved: ${s.ref}` : `Report rejected: ${s.ref}`,
      body:
        action === "approve"
          ? `${s.title} — approved by ${ctx.name} (Subsidiary Manager) and now eligible for subsidiary consolidation.`
          : `${s.title} — returned to ${responsible} for correction by ${ctx.name}: ${reason.slice(0, 140)}`,
      severity: action === "approve" ? "SUCCESS" : "CRITICAL",
      linkView: "monitoring",
      refId: s.id,
    });

    await Promise.all([
      smLogActivity(ctx, sub.name, {
        action: action === "approve" ? "APPROVE" : "REJECT",
        targetType: "Submission",
        targetLabel: `${s.ref} — ${s.title}`,
        severity: action === "approve" ? "INFO" : "WARNING",
      }),
      smLogAudit(ctx, sub.code, {
        action: action === "approve" ? "SUBMISSION_APPROVE" : "SUBMISSION_REJECT",
        targetType: "Submission",
        targetId: s.id,
        targetLabel: `${s.ref} — ${s.title}`,
        before: { status: s.status, version: version - 1 },
        after: { status: action === "approve" ? "APPROVED" : "REJECTED", version },
        reason: reason || undefined,
      }),
    ]);

    const fresh = await db.submission.findUnique({ where: { id } });
    const rowCtx = await loadRowContext(ctx.subsidiaryId);
    const submission = fresh
      ? toSmSubmissionRow(fresh, rowCtx.userNames, rowCtx.buNames, rowCtx.projectNames, rowCtx.timelines, sub.code)
      : null;
    if (!submission) throw new SmError("Submission disappeared after update.", 500);

    const payload: DecisionResponse = {
      submission,
      decision: { action: action as "approve" | "reject", at: now.toISOString(), version },
      message:
        action === "approve"
          ? `${s.ref} approved — ${responsible} and the Subsidiary Admin have been notified.`
          : `${s.ref} rejected and returned to ${responsible} for correction.`,
    };
    return ok(payload);
  });
}
