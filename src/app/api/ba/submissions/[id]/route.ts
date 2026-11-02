import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import {
  BaError, baHandle, requireBuAdmin, parseJson,
  baLogActivity, baLogAudit, baNotify, getBuOrThrow,
} from "@/lib/ba/server";
import { toSubmissionRow, loadBuUserNames, loadBuProjectNames } from "@/lib/ba/rows";
import type { SubmissionDetail } from "@/lib/ba/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/* ═══════════════════════════════════════════════════════════════════════════
   /api/ba/submissions/[id]

   GET  — detail payload for the BU Admin Submission Center (read + flags).
   POST — THE SENDER SIDE of the BU → Reviewer flow:
          { action: "submit" | "resubmit" | "save_draft",
            values?: {label, value, unit}[], comment?, expectedUpdatedAt? }

   Workflow contract (mirrors the BU Manager decision route):
     · submit:    DRAFT | ASSIGNED        → SUBMITTED (≥ 1 valid value row)
     · resubmit:  CHANGES_REQUESTED | REJECTED → SUBMITTED (≥ 1 valid value row)
     · save_draft: DRAFT | ASSIGNED       → unchanged status, values persisted
     · every other transition (APPROVED / UNDER_REVIEW / SUBMITTED) → 409 —
       decisions and in-flight reviews are NEVER touchable from the BA family
     · version guard: expectedUpdatedAt mismatch → 409
     · null-scope notification = broadcast → visible on ALL FIVE consoles
   ═══════════════════════════════════════════════════════════════════════════ */

const SUBMITTABLE_FROM = ["DRAFT", "ASSIGNED"];
const RESUBMITTABLE_FROM = ["CHANGES_REQUESTED", "REJECTED"];

/** Sanitize a submitted values payload: keep rows that carry a label and a
 *  finite numeric value; drop fully-empty rows the UI adds for convenience. */
function sanitizeValues(raw: unknown): { rows: { label: string; value: number; unit: string }[]; provided: number } {
  if (!Array.isArray(raw)) return { rows: [], provided: 0 };
  const rows: { label: string; value: number; unit: string }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as { label?: unknown; value?: unknown; unit?: unknown };
    const label = String(rec.label ?? "").trim();
    const unit = String(rec.unit ?? "").trim().slice(0, 24);
    if (!label) continue; // convenience rows never filled in
    const value = typeof rec.value === "string" ? Number(rec.value) : rec.value;
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    rows.push({ label: label.slice(0, 120), value, unit });
  }
  return { rows, provided: raw.length };
}

/** Load + scope-check a submission for the BU Admin session. */
async function loadScopedSubmission(id: string, businessUnitId: string) {
  const s = await db.submission.findUnique({ where: { id } });
  if (!s) throw new BaError("Submission not found.", 404);
  /* Scope: BU admin only reads/mutates records inside their assigned BU. */
  if (s.businessUnitId !== businessUnitId) {
    throw new BaError("This submission is outside your assigned business unit.", 403);
  }
  return s;
}

/** Build the full detail payload (shared by GET and the POST responses). */
async function buildDetail(id: string, businessUnitId: string, subsidiaryId: string): Promise<SubmissionDetail> {
  const s = await loadScopedSubmission(id, businessUnitId);
  const [issues, bu, prj, userRows] = await Promise.all([
    db.validationIssue.findMany({
      where: { submissionId: id },
      select: { ref: true, severity: true, description: true, status: true },
    }),
    s.businessUnitId
      ? db.businessUnit.findUnique({ where: { id: s.businessUnitId }, select: { id: true, name: true } })
      : Promise.resolve(null),
    s.projectId
      ? db.project.findUnique({ where: { id: s.projectId }, select: { id: true, name: true } })
      : Promise.resolve(null),
    (async () => {
      const ids = [s.submittedById, s.reviewerId].filter((x): x is string => !!x);
      const names = await loadBuUserNames(businessUnitId, subsidiaryId);
      const missing = ids.filter((i) => !names.has(i));
      if (missing.length) {
        const extras = await db.user.findMany({ where: { id: { in: missing } }, select: { id: true, name: true } });
        for (const u of extras) names.set(u.id, u.name);
      }
      return names;
    })(),
  ]);
  const buNames = new Map<string, string>(bu ? [[bu.id, bu.name]] : []);
  const projectNames = await loadBuProjectNames(businessUnitId);
  if (prj) projectNames.set(prj.id, prj.name);

  const row = toSubmissionRow(s, userRows, buNames, projectNames);
  return {
    ...row,
    values: parseJson<{ label: string; value: number; unit: string }[]>(s.values, []),
    evidence: parseJson<string[]>(s.evidence, []),
    comments: parseJson<{ author: string; role: string; text: string; at: string }[]>(s.comments, []),
    history: parseJson<{ action: string; actor: string; at: string; note?: string }[]>(s.history, []),
    validationIssues: issues,
    canSubmit: SUBMITTABLE_FROM.includes(s.status),
    canResubmit: RESUBMITTABLE_FROM.includes(s.status),
  };
}

export async function GET(_req: NextRequest, { params }: Params) {
  return baHandle(async () => {
    const ctx = await requireBuAdmin();
    const { id } = await params;
    const submission = await buildDetail(id, ctx.businessUnitId, ctx.subsidiaryId);
    return ok({ submission });
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  return baHandle(async () => {
    const ctx = await requireBuAdmin();
    const bu = await getBuOrThrow(ctx.businessUnitId);
    const { id } = await params;

    const b = (await req.json().catch(() => ({}))) as {
      action?: string;
      values?: unknown;
      comment?: string;
      expectedUpdatedAt?: string;
    };
    const action = String(b.action ?? "");
    if (!["submit", "resubmit", "save_draft"].includes(action)) {
      throw new BaError("Unknown action. Use submit, resubmit or save_draft.", 400);
    }

    const s = await loadScopedSubmission(id, ctx.businessUnitId);

    /* Version guard: refuse mutations on a stale version, mirroring the
       BU Manager decision route ("changed after you opened it"). */
    if (b.expectedUpdatedAt && new Date(b.expectedUpdatedAt).getTime() !== s.updatedAt.getTime()) {
      throw new BaError("This report changed after you opened it. Refresh and review the latest version before submitting.", 409);
    }

    /* Transition guards — 409 with a clear message on any illegal move. */
    if (action === "submit" && !SUBMITTABLE_FROM.includes(s.status)) {
      throw new BaError(
        `This report cannot be submitted from its current workflow state (${s.status.replace(/_/g, " ")}). Refresh the Submission Center to see the latest state.`,
        409
      );
    }
    if (action === "resubmit" && !RESUBMITTABLE_FROM.includes(s.status)) {
      throw new BaError(
        `This report is not awaiting corrections — its current workflow state is ${s.status.replace(/_/g, " ")}. Only returned or rejected reports can be resubmitted.`,
        409
      );
    }
    if (action === "save_draft" && !SUBMITTABLE_FROM.includes(s.status)) {
      throw new BaError(
        `Only draft or assigned reports can be saved as draft — this report is ${s.status.replace(/_/g, " ")}.`,
        409
      );
    }

    const { rows: values, provided } = sanitizeValues(b.values);
    const comment = (b.comment ?? "").toString().trim();
    const now = new Date();

    /* ≥ 1 valid value row for submit / resubmit (save_draft may stay empty). */
    if (action !== "save_draft" && values.length === 0) {
      throw new BaError(
        provided > 0
          ? "At least one value row needs both a label and a numeric value before this report can be submitted."
          : "At least one value row (label + numeric value) is required to submit this report.",
        400
      );
    }

    const history = parseJson<{ action: string; actor: string; at: string; note?: string }[]>(s.history, []);
    const comments = parseJson<{ author: string; role: string; text: string; at: string }[]>(s.comments, []);

    const isSubmit = action === "submit";
    const isResubmit = action === "resubmit";

    await db.submission.update({
      where: { id },
      data: {
        values: JSON.stringify(values),
        ...(isSubmit || isResubmit
          ? {
              status: "SUBMITTED",
              submittedAt: now,
              submittedById: ctx.userId,
              history: JSON.stringify([
                ...history,
                {
                  action: isSubmit
                    ? `Submitted by ${ctx.name} (BU Admin)`
                    : `Resubmitted after corrections by ${ctx.name} (BU Admin)`,
                  actor: ctx.name,
                  at: now.toISOString(),
                  ...(comment ? { note: comment } : {}),
                },
              ]),
              ...(comment
                ? { comments: JSON.stringify([...comments, { author: ctx.name, role: "BU_ADMIN", text: comment, at: now.toISOString() }]) }
                : {}),
            }
          : {}),
      },
    });

    if (isSubmit || isResubmit) {
      /* ONE null-scope notification = broadcast → visible on all 5 consoles
         (Group Admin + SA + SM + BU Admin + BU Manager bells). This is the
         cross-console sync contract for every BU Admin submission. */
      await baNotify({
        ntype: "SUBMISSION",
        title: isSubmit ? `Data submitted: ${s.ref}` : `Resubmitted: ${s.ref}`,
        body: isSubmit
          ? `${s.title} — submitted by ${ctx.name} (BU Admin, ${bu.name}) for ${s.period} with ${values.length} value row${values.length === 1 ? "" : "s"}. Awaiting BU Manager review.`
          : `${s.title} — resubmitted after corrections by ${ctx.name} (BU Admin, ${bu.name}) for ${s.period}. Awaiting BU Manager review.`,
        severity: "SUCCESS",
        linkView: "queue",
        refId: s.id,
      });
      await Promise.all([
        baLogActivity(ctx, bu.name, {
          action: isSubmit ? "SUBMIT" : "RESUBMIT",
          targetType: "Submission",
          targetLabel: `${s.ref} — ${s.title}`,
          severity: "INFO",
        }),
        baLogAudit(ctx, bu.code, {
          action: isSubmit ? "SUBMISSION_SUBMIT" : "SUBMISSION_RESUBMIT",
          targetType: "Submission",
          targetId: s.id,
          targetLabel: `${s.ref} — ${s.title}`,
          before: { status: s.status },
          after: { status: "SUBMITTED", submittedBy: ctx.name, valueRows: values.length },
          reason: comment || undefined,
          outcome: "SUCCESS",
        }),
      ]);
    }

    const submission = await buildDetail(id, ctx.businessUnitId, ctx.subsidiaryId);
    return ok({ submission });
  });
}
