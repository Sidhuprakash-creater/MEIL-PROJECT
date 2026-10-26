import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { baHandle, requireBuAdmin, getBuOrThrow } from "@/lib/ba/server";
import { toProjectRow, unitStats, PTYPE_LABELS } from "@/lib/ba/rows";
import { resolveEffectiveDeadline } from "@/lib/ba/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return baHandle(async () => {
    const ctx = await requireBuAdmin();
    const bu = await getBuOrThrow(ctx.businessUnitId);
    const sp = req.nextUrl.searchParams;
    const q = (sp.get("q") ?? "").trim().toLowerCase();
    const status = sp.get("status");
    const ptype = sp.get("ptype");
    const page = Math.max(1, Number(sp.get("page") ?? 1));
    const pageSize = Math.min(Math.max(1, Number(sp.get("pageSize") ?? 8)), 50);
    const period = sp.get("period") ?? "FY 2025-26";

    const [projects, stats, timelines, validation, sub0] = await Promise.all([
      db.project.findMany({ where: { businessUnitId: ctx.businessUnitId }, include: { businessUnit: true, users: { select: { name: true } } }, orderBy: { createdAt: "asc" } }),
      unitStats(ctx.subsidiaryId, period),
      db.reportingTimeline.findMany({ where: { subsidiaryId: ctx.subsidiaryId, status: "ACTIVE" } }),
      db.validationIssue.findMany({ where: { subsidiaryId: ctx.subsidiaryId, status: { in: ["OPEN", "ASSIGNED"] } }, select: { projectId: true, severity: true } }),
      getBuOrThrow(ctx.businessUnitId),
    ]);
    void bu;

    const sevRank: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    const valByProject = new Map<string, string>();
    for (const v of validation) {
      if (!v.projectId) continue;
      const cur = valByProject.get(v.projectId);
      if (!cur || sevRank[v.severity] > (sevRank[cur] ?? 0)) valByProject.set(v.projectId, v.severity);
    }

    let rows = projects.map((p) => {
      const st = stats.prjMap.get(p.id) ?? { approved: 0, pending: 0, overdue: 0, total: 0, lastAt: null };
      const eff = resolveEffectiveDeadline("PROJECT", { subsidiaryId: ctx.subsidiaryId, businessUnitId: ctx.businessUnitId, projectId: p.id }, timelines, sub0.code);
      return toProjectRow(p, st, eff.dueDate, valByProject.get(p.id) ?? "OK");
    });

    if (q) rows = rows.filter((r) => `${r.name} ${r.code} ${r.location} ${r.buName}`.toLowerCase().includes(q));
    if (status && status !== "ALL") rows = rows.filter((r) => r.status === status);
    if (ptype && ptype !== "ALL") rows = rows.filter((r) => r.ptype === (PTYPE_LABELS[ptype] ?? ptype));

    const total = rows.length;
    return ok({
      projects: rows.slice((page - 1) * pageSize, page * pageSize),
      total, page, pageSize,
      ptypeFacets: Object.entries(PTYPE_LABELS).map(([k, v]) => ({ id: k, name: v })),
    });
  });
}
