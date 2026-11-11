import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { smHandle, requireSubsidiaryManager } from "@/lib/sm/server";
import { buildBuRollup } from "@/lib/bm/rollup";
import type { BuRollup } from "@/lib/bm/rollup-types";

export const dynamic = "force-dynamic";

/* GET /api/sm/rollup?period= — subsidiary-wide consolidated rollup for the
   Subsidiary Manager. Mirrors the BU manager's review-queue rollup but adds a
   level: EVERY business unit of the subsidiary → its category sections →
   per-project rows with downloadable evidence.

   Eligibility is identical to the BU rollup (PA forwarded / consolidated,
   status BU_APPROVED | APPROVED | BU_REVIEW_PENDING), so what the SM sees is
   exactly the sum of what the BUs approved and sent up. Evidence download
   links point at the SM's own subsidiary-scoped endpoint. */
export async function GET(req: NextRequest) {
  return smHandle(async () => {
    const ctx = await requireSubsidiaryManager();
    const period = (req.nextUrl.searchParams.get("period") ?? "").trim();

    const units = await db.businessUnit.findMany({
      where: { subsidiaryId: ctx.subsidiaryId },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    });
    const unitIds = units.map((u) => u.id);
    const allProjects = unitIds.length
      ? await db.project.findMany({
          where: { businessUnitId: { in: unitIds } },
          select: { id: true, businessUnitId: true },
        })
      : [];
    const projectsByBu = new Map<string, string[]>();
    for (const p of allProjects) {
      const list = projectsByBu.get(p.businessUnitId) ?? [];
      list.push(p.id);
      projectsByBu.set(p.businessUnitId, list);
    }

    const subsidiaryName =
      (await db.subsidiary.findUnique({ where: { id: ctx.subsidiaryId }, select: { name: true } }))?.name ?? "";

    const buRollups = await Promise.all(
      units.map(async (bu) =>
        buildBuRollup({
          businessUnitId: bu.id,
          subsidiaryId: ctx.subsidiaryId,
          period: period || null,
          buName: bu.name,
          subsidiaryName,
          buProjectIds: projectsByBu.get(bu.id) ?? [],
          evidenceDownloadBase: "/api/sm/evidence",
        })
      )
    );

    /* Only BUs that actually have forwarded / consolidated data appear. */
    const businessUnits = buRollups.filter((r) => r.sections.length > 0);

    const totals = businessUnits.reduce(
      (acc, r) => ({
        reports: acc.reports + r.totals.reports,
        confirmedReports: acc.confirmedReports + r.totals.confirmedReports,
        pendingReports: acc.pendingReports + r.totals.pendingReports,
        projects: acc.projects + r.totals.projects,
        confirmedValue: acc.confirmedValue + r.totals.confirmedValue,
      }),
      { reports: 0, confirmedReports: 0, pendingReports: 0, projects: 0, confirmedValue: 0 }
    );

    const rollup: {
      subsidiaryId: string;
      subsidiaryName: string;
      period: string;
      businessUnits: BuRollup[];
      totals: typeof totals;
    } = {
      subsidiaryId: ctx.subsidiaryId,
      subsidiaryName,
      period: period || "ALL",
      businessUnits,
      totals,
    };

    return ok({ rollup });
  });
}
