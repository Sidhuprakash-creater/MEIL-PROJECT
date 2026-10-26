import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { BmError, bmHandle, requireBuManager } from "@/lib/bm/server";
import { toValidationRow } from "@/lib/sa/helpers";
import type { ValidationRow } from "@/lib/sa/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/* GET /api/bm/validation/[id] — single validation issue detail.
   Read-only for the BU Manager: they cannot resolve / assign issues (those
   actions live with the Subsidiary Admin). They CAN reference the issue in
   a return/reject decision via the submission decision endpoint, which
   surfaces the issue ref in the comment trail. */
export async function GET(_req: NextRequest, { params }: Params) {
  return bmHandle(async () => {
    const ctx = await requireBuManager();
    const { id } = await params;

    const issue = await db.validationIssue.findUnique({ where: { id } });
    if (!issue) throw new BmError("Validation issue not found.", 404);
    if (issue.businessUnitId !== ctx.businessUnitId) {
      throw new BmError("This validation issue is outside your assigned business unit.", 403);
    }

    const [units, projects] = await Promise.all([
      db.businessUnit.findMany({ where: { subsidiaryId: ctx.subsidiaryId }, select: { id: true, name: true } }),
      db.project.findMany({ where: { businessUnitId: ctx.businessUnitId }, select: { id: true, name: true } }),
    ]);
    const buNames = new Map(units.map((u) => [u.id, u.name]));
    const prjNames = new Map(projects.map((p) => [p.id, p.name]));

    const row: ValidationRow = toValidationRow(issue, buNames, prjNames);
    return ok({ issue: row });
  });
}
