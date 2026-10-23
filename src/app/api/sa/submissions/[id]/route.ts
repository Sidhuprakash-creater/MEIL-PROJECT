import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { SaError, saHandle, requireSubsidiaryAdmin, parseJson } from "@/lib/sa/server";
import { toSubmissionRow } from "@/lib/sa/rows";
import type { SubmissionDetail } from "@/lib/sa/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  return saHandle(async () => {
    const ctx = await requireSubsidiaryAdmin();
    const { id } = await params;

    const s = await db.submission.findUnique({ where: { id } });
    if (!s) throw new SaError("Submission not found.", 404);

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
      throw new SaError("This submission is outside your assigned subsidiary.", 403);
    }

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
      (() => {
        const ids = [s.submittedById, s.reviewerId].filter((x): x is string => !!x);
        return ids.length
          ? db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
          : Promise.resolve([] as { id: string; name: string }[]);
      })(),
    ]);

    const buNames = new Map<string, string>(bu ? [[bu.id, bu.name]] : []);
    const projectNames = new Map<string, string>(prj ? [[prj.id, prj.name]] : []);
    const userNames = new Map(userRows.map((u) => [u.id, u.name]));

    const row = toSubmissionRow(s, userNames, buNames, projectNames);
    const submission: SubmissionDetail = {
      ...row,
      values: parseJson<{ label: string; value: number; unit: string }[]>(s.values, []),
      evidence: parseJson<string[]>(s.evidence, []),
      comments: parseJson<{ author: string; role: string; text: string; at: string }[]>(s.comments, []),
      history: parseJson<{ action: string; actor: string; at: string; note?: string }[]>(s.history, []),
      validationIssues: issues,
    };
    return ok({ submission });
  });
}
