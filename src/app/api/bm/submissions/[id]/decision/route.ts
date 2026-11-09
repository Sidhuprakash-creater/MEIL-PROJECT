import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import {
  BmError, bmHandle, requireBuManager, getBuOrThrow, parseJson,
  bmLogActivity, bmLogAudit, bmNotify,
} from "@/lib/bm/server";
import { toBmSubmissionRow, resolveReviewDeadline, loadBmUserNames, loadBmProjectNames } from "@/lib/bm/rows";
import { invalidatePaServerCache } from "@/lib/project-admin/server";
import { invalidatePaConsolidatedReportCache, invalidatePuSubmissionsCache, invalidatePuOverviewCache } from "@/lib/portal-cache";
import type { DecisionResponse } from "@/lib/bm/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/* ═══════════════════════════════════════════════════════════════════════════
   POST /api/bm/submissions/[id]/decision — THE BU Manager review decision.

   Body: {
     action: "approve" | "reject" | "return",
     reason?: string,                  // mandatory for reject AND return (≥10 chars)
     instructions?: string,           // mandatory for return (≥10 chars), optional for reject
     affectedFields?: string[],       // optional — field-level comments for return
     expectedUpdatedAt?: string       // version guard
   }

   Workflow contract:
     · approve eligible from SUBMITTED | UNDER_REVIEW | CHANGES_REQUESTED
     · reject  eligible from SUBMITTED | UNDER_REVIEW
     · return  eligible from SUBMITTED | UNDER_REVIEW | CHANGES_REQUESTED
       (the BU Manager may return a corrected resubmission for further fixes
        without fully rejecting it — the third action exclusive to BU Manager)
     · reject & return REQUIRE a meaningful reason (≥ 10 chars), blocked server-side
     · return REQUIRES actionable correction instructions (≥ 10 chars)
     · version guard: expectedUpdatedAt must match the stored updatedAt; a
       report that changed after the manager opened it is refused with 409 so
       a stale version is never decided
     · concurrent-safe: updateMany re-asserts the eligible status so two
       reviewers cannot double-decide the same report → 409
     · every decision persists: reviewer identity, timestamp, appended
       comment + history version entry, null-scope notification visible on
       ALL FIVE consoles (Group Admin + SA + SM + BU Admin + BU Manager),
       activity + append-only audit
   ═══════════════════════════════════════════════════════════════════════════ */

const ELIGIBLE: Record<string, string[]> = {
  /* approve also accepts APPROVED and BU_APPROVED — Project-Admin-forwarded
     items (forwardedToBu) move to or remain BU_APPROVED. */
  approve: ["SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED", "APPROVED", "BU_REVIEW_PENDING", "BU_APPROVED"],
  reject: ["SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED", "APPROVED", "BU_REVIEW_PENDING", "BU_APPROVED"],
  return: ["SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED", "APPROVED", "BU_REVIEW_PENDING", "BU_APPROVED"],
};

const NEW_STATUS: Record<string, string> = {
  approve: "APPROVED",
  reject: "REJECTED",
  return: "CHANGES_REQUESTED",
};

export async function POST(req: NextRequest, { params }: Params) {
  return bmHandle(async () => {
    const ctx = await requireBuManager();
    const bu = await getBuOrThrow(ctx.businessUnitId);
    const { id } = await params;

    const b = (await req.json().catch(() => ({}))) as {
      action?: string;
      reason?: string;
      instructions?: string;
      affectedFields?: string[];
      expectedUpdatedAt?: string;
    };
    const action = String(b.action ?? "");
    if (!ELIGIBLE[action]) {
      throw new BmError("Unknown review action. Use approve, reject or return.", 400);
    }

    const reason = (b.reason ?? "").trim();
    const instructions = (b.instructions ?? "").trim();
    const affectedFields = Array.isArray(b.affectedFields)
      ? b.affectedFields.map((f) => String(f).slice(0, 80)).filter(Boolean)
      : [];

    /* Server-side validation — empty reasons/instructions are blocked here,
       not just in the dialog. */
    if ((action === "reject" || action === "return") && reason.length < 10) {
      throw new BmError(
        action === "return"
          ? "A meaningful return reason (at least 10 characters) is mandatory."
          : "A meaningful rejection reason (at least 10 characters) is mandatory.",
        400
      );
    }
    if (action === "return" && instructions.length < 10) {
      throw new BmError("Actionable correction instructions (at least 10 characters) are mandatory when returning a report.", 400);
    }

    /* Load fresh row + scope check (must belong to this BU). */
    const s = await db.submission.findUnique({ where: { id } });
    if (!s) throw new BmError("Submission not found.", 404);
    const isForwarded = s.forwardedToBu || (s as any).inConsolidatedReport;
    if (s.businessUnitId !== ctx.businessUnitId && !isForwarded) {
      throw new BmError("This submission is outside your assigned business unit.", 403);
    }

    /* Eligible state? */
    if (!ELIGIBLE[action].includes(s.status)) {
      throw new BmError(
        `This report is no longer eligible for ${action} — its current workflow state is ${s.status.replace(/_/g, " ")}. Refresh the queue to see the latest state.`,
        409
      );
    }

    /* An APPROVED or BU_APPROVED report forwarded by PA is decidable by BU */
    const forwardedPaApproval = (s.status === "APPROVED" || s.status === "BU_REVIEW_PENDING" || s.status === "BU_APPROVED") && isForwarded;

    /* Version guard: refuse decisions on a stale version (with 30s tolerance for clock drift). */
    if (b.expectedUpdatedAt && Math.abs(new Date(b.expectedUpdatedAt).getTime() - s.updatedAt.getTime()) > 30000) {
      throw new BmError(
        "This report changed after you opened it. Refresh and review the latest version before deciding.",
        409
      );
    }

    const now = new Date();
    const comments = parseJson<{ author: string; role: string; text: string; at: string }[]>(s.comments, []);
    const history = parseJson<{ action: string; actor: string; at: string; note?: string; priorValues?: unknown }[]>(s.history, []);
    const version = history.length + 1;

    /* Build the reviewer comment that gets persisted on the submission. For
       return/reject the reason + instructions + affected fields are joined so
       the responsible user sees one complete correction note. */
    const commentParts: string[] = [];
    if (reason) commentParts.push(reason);
    if ((action === "return" || action === "reject") && instructions) {
      commentParts.push(`Correction instructions: ${instructions}`);
    }
    if (affectedFields.length > 0) {
      commentParts.push(`Affected fields/evidence: ${affectedFields.join(", ")}`);
    }
    const commentText = commentParts.join("\n\n");

    const newComment = commentText
      ? [...comments, { author: ctx.name, role: "BU_MANAGER", text: commentText, at: now.toISOString() }]
      : comments;

    const historyNote = action === "approve"
      ? (reason || undefined)
      : commentText || undefined;

    const newHistory = [
      ...history,
      {
        action:
          action === "approve"
            ? `Approved by ${ctx.name} (BU Manager)`
            : action === "reject"
              ? `Rejected by ${ctx.name} (BU Manager) — returned for correction`
              : `Returned for correction by ${ctx.name} (BU Manager)`,
        actor: ctx.name,
        at: now.toISOString(),
        ...(historyNote ? { note: historyNote } : {}),
      },
    ];

    /* Concurrent-safe update: the where-clause re-asserts the eligible status
       so a decision made between our load and write cannot be overwritten.
       Approving a PA-forwarded report records the distinct BU_APPROVED state. */
    const finalStatus = (forwardedPaApproval || s.status === "BU_APPROVED" || isForwarded) && action === "approve"
      ? "BU_APPROVED"
      : NEW_STATUS[action];
    const updated = await db.submission.updateMany({
      where: { id, status: { in: ELIGIBLE[action] } },
      data: {
        status: finalStatus,
        reviewedAt: now,
        reviewerId: ctx.userId,
        comments: JSON.stringify(newComment),
        history: JSON.stringify(newHistory),
      },
    });
    if (updated.count !== 1) {
      throw new BmError("Concurrent update detected — the report state changed. Refresh and review again.", 409);
    }

    await db.soSubmission.updateMany({
      where: { id },
      data: {
        status: finalStatus,
        updatedAt: now,
      },
    });

    /* If this submission was part of a consolidated project report, sync the report status */
    if (s.consolidatedReportId) {
      try {
        const siblingSubs = await db.submission.findMany({
          where: { consolidatedReportId: s.consolidatedReportId },
          select: { id: true, status: true },
        });
        const allApproved = siblingSubs.every(sub => (sub.id === id ? finalStatus === "BU_APPROVED" : sub.status === "BU_APPROVED"));
        if (allApproved && action === "approve") {
          await db.report.update({
            where: { id: s.consolidatedReportId },
            data: { status: "APPROVED" },
          });
        } else if (action === "reject") {
          await db.report.update({
            where: { id: s.consolidatedReportId },
            data: { status: "REJECTED" },
          });
        }
      } catch (e) {
        console.warn("Could not sync consolidated report status:", e);
      }
    }

    /* Resolve the responsible user's name so the notification is personal. */
    const responsible = s.submittedById
      ? (await db.user.findUnique({ where: { id: s.submittedById }, select: { name: true } }))?.name ?? "the responsible user"
      : "the responsible user";

    /* ONE null-scope notification = broadcast → visible on all 5 consoles
       (Group Admin bell + SA + SM + BU Admin + BU Manager bells). This is
       the cross-console sync contract for every BU Manager decision. */
    const titleByAction: Record<string, string> = {
      approve: `Report approved: ${s.ref}`,
      reject: `Report rejected: ${s.ref}`,
      return: `Report returned for correction: ${s.ref}`,
    };
    const bodyByAction: Record<string, string> = {
      approve: `${s.title} — approved by ${ctx.name} (BU Manager, ${bu.name}) and now eligible for subsidiary consolidation.`,
      reject: `${s.title} — rejected by ${ctx.name} and returned to ${responsible}. Reason: ${reason.slice(0, 160)}`,
      return: `${s.title} — returned to ${responsible} for correction by ${ctx.name} (BU Manager, ${bu.name}). ${instructions.slice(0, 160)}`,
    };
    await bmNotify({
      ntype: action === "approve" ? "APPROVAL" : "VALIDATION",
      title: titleByAction[action],
      body: bodyByAction[action],
      severity: action === "approve" ? "SUCCESS" : action === "reject" ? "CRITICAL" : "WARNING",
      linkView: "queue",
      refId: s.id,
    });

    /* Append-only audit + activity feed. */
    await Promise.all([
      bmLogActivity(ctx, bu.name, {
        action: action === "approve" ? "APPROVE" : action === "reject" ? "REJECT" : "RETURN",
        targetType: "Submission",
        targetLabel: `${s.ref} — ${s.title}`,
        severity: action === "approve" ? "INFO" : "WARNING",
      }),
      bmLogAudit(ctx, bu.code, {
        action:
          action === "approve"
            ? "SUBMISSION_APPROVE"
            : action === "reject"
              ? "SUBMISSION_REJECT"
              : "SUBMISSION_RETURN",
        targetType: "Submission",
        targetId: s.id,
        targetLabel: `${s.ref} — ${s.title}`,
        before: { status: s.status, version: version - 1 },
        after: { status: NEW_STATUS[action], version, reviewer: ctx.name },
        reason: reason || instructions || undefined,
        outcome: "SUCCESS",
      }),
    ]);

    /* Build the response row mirroring the SM pattern: decorate the fresh
       submission row with the review deadline + resubmission flag. */
    const fresh = await db.submission.findUnique({ where: { id } });
    if (!fresh) throw new BmError("Submission disappeared after update.", 500);

    invalidatePaServerCache();
    invalidatePaConsolidatedReportCache();
    invalidatePuSubmissionsCache();
    invalidatePuOverviewCache();

    const [userNames, projectNames, reviewCtx] = await Promise.all([
      loadBmUserNames(ctx.businessUnitId, ctx.subsidiaryId),
      loadBmProjectNames(ctx.businessUnitId),
      resolveReviewDeadline(fresh, ctx.businessUnitId, ctx.subsidiaryId),
    ]);

    /* Reuse the shared toSubmissionRow to build the base row, then decorate. */
    const { toSubmissionRow } = await import("@/lib/sa/rows");
    const base = toSubmissionRow(fresh, userNames, new Map([[bu.id, bu.name]]), projectNames);
    const submission = toBmSubmissionRow(
      base,
      reviewCtx.reviewDeadline,
      reviewCtx.sourceLabel,
      fresh.dueDate.toISOString(),
      fresh.history,
      { forwardedToBu: fresh.forwardedToBu, forwardedToBuAt: fresh.forwardedToBuAt },
    );

    const messageByAction: Record<string, string> = {
      approve: `${s.ref} approved — ${responsible} and the Subsidiary Manager have been notified.`,
      reject: `${s.ref} rejected and returned to ${responsible} for correction.`,
      return: `${s.ref} returned to ${responsible} for correction with your instructions.`,
    };

    const payload: DecisionResponse = {
      submission,
      decision: { action: action as "approve" | "reject" | "return", at: now.toISOString(), version },
      message: messageByAction[action],
    };
    return ok(payload);
  });
}
