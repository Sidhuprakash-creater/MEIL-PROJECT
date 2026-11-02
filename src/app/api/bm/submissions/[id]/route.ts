import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { BmError, bmHandle, requireBuManager, parseJson } from "@/lib/bm/server";
import {
  toBmSubmissionRow, resolveReviewDeadline,
  loadBmUserNames, loadBmProjectNames,
} from "@/lib/bm/rows";
import { toSubmissionRow } from "@/lib/sa/rows";
import type { SubmissionDetail } from "@/lib/sa/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/* GET /api/bm/submissions/[id] — full report detail for the review workspace.
   Returns { submission, updatedAt, version } (wrapped — the list endpoint
   returns the flat array). `updatedAt` powers the stale-version guard: the
   review workspace sends it back with the decision so the server can refuse
   decisions made against a report that changed after it was opened. */
export async function GET(_req: NextRequest, { params }: Params) {
  return bmHandle(async () => {
    const ctx = await requireBuManager();
    const { id } = await params;

    const s = await db.submission.findUnique({ where: { id } });
    if (!s) throw new BmError("Submission not found.", 404);
    if (s.businessUnitId !== ctx.businessUnitId) {
      throw new BmError("This submission is outside your assigned business unit.", 403);
    }

    const [issues, userNames, projectNames, reviewCtx] = await Promise.all([
      db.validationIssue.findMany({
        where: { submissionId: id },
        select: { ref: true, severity: true, description: true, status: true, rule: true },
      }),
      loadBmUserNames(ctx.businessUnitId, ctx.subsidiaryId),
      loadBmProjectNames(ctx.businessUnitId),
      resolveReviewDeadline(s, ctx.businessUnitId, ctx.subsidiaryId),
    ]);
    const bu = await db.businessUnit.findUnique({ where: { id: ctx.businessUnitId }, select: { id: true, name: true } });
    if (!bu) throw new BmError("Your assigned business unit was not found.", 403);

    const buNames = new Map([[bu.id, bu.name]]);
    const base = toSubmissionRow(s, userNames, buNames, projectNames);
    const submission: SubmissionDetail & Pick<
      ReturnType<typeof toBmSubmissionRow>,
      "reviewDeadline" | "reviewDeadlineLabel" | "isResubmission" | "daysRemaining"
    > = {
      ...toBmSubmissionRow(
        base,
        reviewCtx.reviewDeadline,
        reviewCtx.sourceLabel,
        s.dueDate.toISOString(),
        s.history,
      ),
      values: parseJson<{ label: string; value: number; unit: string }[]>(s.values, []),
      evidence: parseJson<string[]>(s.evidence, []),
      comments: parseJson<{ author: string; role: string; text: string; at: string }[]>(s.comments, []),
      history: parseJson<{ action: string; actor: string; at: string; note?: string; priorValues?: unknown }[]>(s.history, []),
      validationIssues: issues,
    };
    return ok({
      submission,
      updatedAt: s.updatedAt.toISOString(),
      version: parseJson<unknown[]>(s.history, []).length + 1,
    });
  });
}
