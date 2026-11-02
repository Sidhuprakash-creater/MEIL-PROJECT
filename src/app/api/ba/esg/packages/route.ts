import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { baHandle, requireBuAdmin, parseJson } from "@/lib/ba/server";
import { toPackageRow } from "@/lib/sa/helpers";

export const dynamic = "force-dynamic";

/* GET /api/ba/esg/packages?period= — BU reporting packages (the subset of the
   subsidiary packages that include BU submission refs in their sourceRefs). */

export async function GET(req: NextRequest) {
  return baHandle(async () => {
    const ctx = await requireBuAdmin();
    const period = req.nextUrl.searchParams.get("period");
    const subs = await db.submission.findMany({ where: { businessUnitId: ctx.businessUnitId }, select: { ref: true } });
    const buSubRefs = new Set(subs.map((s) => s.ref));
    const packages = await db.reportingPackage.findMany({
      where: { subsidiaryId: ctx.subsidiaryId, ...(period ? { period } : {}) },
      orderBy: { createdAt: "desc" },
    });
    const rows = packages
      .filter((p) => {
        const refs = parseJson<string[]>(p.sourceRefs, []);
        return refs.length === 0 || refs.some((r) => buSubRefs.has(r));
      })
      .map(toPackageRow);
    return ok({ packages: rows });
  });
}
