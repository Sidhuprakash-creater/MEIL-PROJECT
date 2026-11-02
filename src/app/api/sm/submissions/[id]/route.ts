import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { SmError, smHandle, requireSubsidiaryManager, parseJson } from "@/lib/sm/server";
import { loadRowContext, toSmSubmissionRow } from "@/lib/sm/rows";
import type { SubmissionDetail } from "@/lib/sm/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/* GET /api/sm/submissions/[id] — full report detail for the review experience.
   Returns { submission, updatedAt, version } (wrapped — the list endpoint
   returns the flat array). `updatedAt` powers the stale-version guard: the
   review dialog sends it back with the decision so the server can refuse
   decisions made against a report that changed after it was opened. */
export async function GET(_req: NextRequest, { params }: Params) {
  return smHandle(async () => {
    const ctx = await requireSubsidiaryManager();
    const { id } = await params;

    const [s, sub] = await Promise.all([
      db.submission.findUnique({ where: { id } }),
      db.subsidiary.findUnique({ where: { id: ctx.subsidiaryId }, select: { code: true } }),
    ]);
    if (!s) throw new SmError("Submission not found.", 404);
    if (!sub) throw new SmError("Your assigned subsidiary was not found.", 403);

    /* Scope: via its BU (or project → BU → subsidiary). Submission has no
       Prisma relations, so the parents are resolved with explicit lookups. */
    let scopeId: string | null = s.subsidiaryId ?? null;
    if (s.businessUnitId) {
      const bu = await db.businessUnit.findUnique({
        where: { id: s.businessUnitId },
        select: { subsidiaryId: true },
      });
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

    const [issues, rowCtx] = await Promise.all([
      db.validationIssue.findMany({
        where: { submissionId: id },
        select: { ref: true, severity: true, description: true, status: true },
      }),
      loadRowContext(ctx.subsidiaryId),
    ]);

    const row = toSmSubmissionRow(s, rowCtx.userNames, rowCtx.buNames, rowCtx.projectNames, rowCtx.timelines, sub.code);
    const submission: SubmissionDetail = {
      ...row,
      values: parseJson<{ label: string; value: number; unit: string }[]>(s.values, []),
      evidence: parseJson<string[]>(s.evidence, []),
      comments: parseJson<{ author: string; role: string; text: string; at: string }[]>(s.comments, []),
      history: parseJson<{ action: string; actor: string; at: string; note?: string }[]>(s.history, []),
      validationIssues: issues,
    };
    return ok({
      submission,
      updatedAt: s.updatedAt.toISOString(),
      version: parseJson<unknown[]>(s.history, []).length + 1,
    });
  });
}
