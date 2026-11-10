import { NextRequest } from "next/server";
import { ok } from "@/lib/esg/server";
import { bmHandle, requireBuManager, getBuOrThrow, buSubmissionScope } from "@/lib/bm/server";
import { buildBuRollup } from "@/lib/bm/rollup";

export const dynamic = "force-dynamic";

/* GET /api/bm/rollup?period=FY 2025-26
   Section-wise consolidated rollup for the BU Manager: one row per section
   (Energy / Water / Safety …) with the summed value across every project
   that reported into this business unit, the per-project breakdown and the
   evidence + soft copy of each project's own report. */
export async function GET(req: NextRequest) {
  return bmHandle(async () => {
    const ctx = await requireBuManager();
    const bu = await getBuOrThrow(ctx.businessUnitId);
    const period = req.nextUrl.searchParams.get("period") ?? "";

    const rollup = await buildBuRollup({
      businessUnitId: ctx.businessUnitId,
      subsidiaryId: ctx.subsidiaryId,
      period: period && period !== "ALL" ? period : "",
      buName: bu.name,
      subsidiaryName: bu.subsidiary?.name ?? "",
      buProjectIds: (await buSubmissionScope(ctx.businessUnitId)).projectIds,
    });

    return ok({ rollup });
  });
}
