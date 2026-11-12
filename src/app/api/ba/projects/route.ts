import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { BaError, baHandle, requireBuAdmin, getBuOrThrow } from "@/lib/ba/server";
import { toProjectRow, unitStats, PTYPE_LABELS } from "@/lib/ba/rows";
import { resolveEffectiveDeadline, baLogActivity, baLogAudit, baNotify } from "@/lib/ba/server";
import { invalidatePuTreeCache, invalidateSoTreeCache, invalidatePuOverviewCache } from "@/lib/portal-cache";

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
      const st = stats.prjMap.get(p.id) ?? { approved: 0, pending: 0, overdue: 0, lastAt: null };
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

/* POST /api/ba/projects — register a new project under the BU Admin's own
   business unit. The BU Admin owns project creation inside its unit (the
   Subsidiary Admin creates business units); scope is server-enforced so the
   client never picks the target BU. */
export async function POST(req: NextRequest) {
  return baHandle(async () => {
    const ctx = await requireBuAdmin();
    const bu = await getBuOrThrow(ctx.businessUnitId);

    const body = await req.json().catch(() => ({}));
    const name = String((body as any).name ?? "").trim();
    if (!name) throw new BaError("Project name is required.", 400);
    if (name.length > 160) throw new BaError("Project name is too long (max 160 characters).", 400);

    let code = String((body as any).code ?? "").trim().toUpperCase();
    if (!code) {
      const n = (await db.project.count()) + 1;
      code = `PRJ-${bu.code.replace(/^BU-/, "").slice(0, 4)}-${String(n).padStart(3, "0")}`;
    }
    const clash = await db.project.findUnique({ where: { code } });
    if (clash) throw new BaError(`Project code "${code}" already exists.`, 409);

    const PTYPE = ["SITE", "PLANT", "OFFICE", "WIND_FARM", "SOLAR_PARK", "HYDRO", "PIPELINE"];
    const ptype = PTYPE.includes(String((body as any).ptype ?? "")) ? String((body as any).ptype) : "SITE";
    const frequency = (body as any).frequency === "QUARTERLY" ? "QUARTERLY" : "MONTHLY";
    const status = (body as any).status === "INACTIVE" ? "INACTIVE" : "ACTIVE";
    const location = String((body as any).location ?? "").trim();
    const capacityMw = Number((body as any).capacityMw ?? 0) || 0;

    const project = await db.project.create({
      data: {
        code,
        name,
        businessUnitId: ctx.businessUnitId,
        location,
        ptype,
        capacityMw,
        frequency,
        status,
      },
      include: { businessUnit: { select: { name: true } } },
    });

    /* Optionally bind a responsible contributor (must belong to this BU). */
    const responsibleUserId = String((body as any).responsibleUserId ?? "").trim();
    if (responsibleUserId) {
      const user = await db.user.findUnique({ where: { id: responsibleUserId } });
      if (user && user.businessUnitId === ctx.businessUnitId) {
        await db.user.update({ where: { id: user.id }, data: { projectId: project.id, businessUnitId: ctx.businessUnitId } });
      }
    }

    await baLogActivity(ctx, bu.name, { action: "PROJECT_CREATE", targetType: "Project", targetLabel: `${project.code} — ${project.name}` });
    await baLogAudit(ctx, bu.code, { action: "PROJECT_CREATE", targetType: "Project", targetId: project.id, targetLabel: project.name, before: {}, after: { code, name, businessUnitId: ctx.businessUnitId, status } });
    await baNotify({ ntype: "SYSTEM", title: "Project registered", body: `${project.name} (${project.code}) was registered under ${bu.name} by ${ctx.name}.`, linkView: "projects" });

    invalidatePuTreeCache();
    invalidateSoTreeCache();
    invalidatePuOverviewCache();

    return ok({
      project: toProjectRow(
        { ...project, businessUnit: { name: bu.name }, users: [] } as any,
        { approved: 0, pending: 0, overdue: 0, lastAt: null },
        null,
        "OK",
      ),
    }, { status: 201 });
  });
}
