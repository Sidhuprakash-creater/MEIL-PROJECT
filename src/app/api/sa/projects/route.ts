import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import {
  SaError, saHandle, requireSubsidiaryAdmin, getSubsidiaryOrThrow, assertUnitInScope,
  saLogActivity, saLogAudit, saNotify, resolveEffectiveDeadline,
} from "@/lib/sa/server";
import { toProjectRow, unitStats } from "@/lib/sa/rows";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return saHandle(async () => {
    const ctx = await requireSubsidiaryAdmin();
    const sp = req.nextUrl.searchParams;
    const q = (sp.get("q") ?? "").trim().toLowerCase();
    const buId = sp.get("buId");
    const status = sp.get("status");
    const page = Math.max(1, Number(sp.get("page") ?? 1));
    const pageSize = Math.min(Math.max(1, Number(sp.get("pageSize") ?? 8)), 50);
    const period = sp.get("period") ?? "FY 2025-26";

    const [projects, units, stats, timelines, validation, sub0] = await Promise.all([
      db.project.findMany({ where: { businessUnit: { subsidiaryId: ctx.subsidiaryId } }, include: { businessUnit: true, users: { select: { name: true } } }, orderBy: { createdAt: "asc" } }),
      db.businessUnit.findMany({ where: { subsidiaryId: ctx.subsidiaryId }, select: { id: true, name: true } }),
      unitStats(ctx.subsidiaryId, period),
      db.reportingTimeline.findMany({ where: { subsidiaryId: ctx.subsidiaryId, status: "ACTIVE" } }),
      db.validationIssue.findMany({ where: { subsidiaryId: ctx.subsidiaryId, status: { in: ["OPEN", "ASSIGNED"] } }, select: { projectId: true, severity: true } }),
      getSubsidiaryOrThrow(ctx.subsidiaryId),
    ]);

    const sevRank: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    const valByProject = new Map<string, string>();
    for (const v of validation) {
      if (!v.projectId) continue;
      const cur = valByProject.get(v.projectId);
      if (!cur || sevRank[v.severity] > (sevRank[cur] ?? 0)) valByProject.set(v.projectId, v.severity);
    }

    let rows = projects.map((p) => {
      const st = stats.prjMap.get(p.id) ?? { approved: 0, pending: 0, overdue: 0, total: 0, lastAt: null };
      const eff = resolveEffectiveDeadline("PROJECT", { subsidiaryId: ctx.subsidiaryId, businessUnitId: p.businessUnitId, projectId: p.id }, timelines, sub0.code);
      return toProjectRow(p, st, eff.dueDate, valByProject.get(p.id) ?? "OK");
    });

    if (q) rows = rows.filter((r) => `${r.name} ${r.code} ${r.location} ${r.buName}`.toLowerCase().includes(q));
    if (buId && buId !== "ALL") rows = rows.filter((r) => r.buId === buId);
    if (status && status !== "ALL") rows = rows.filter((r) => r.status === status);

    const total = rows.length;
    return ok({
      projects: rows.slice((page - 1) * pageSize, page * pageSize),
      total, page, pageSize,
      buFacets: units,
    });
  });
}

export async function POST(req: NextRequest) {
  return saHandle(async () => {
    const ctx = await requireSubsidiaryAdmin();
    const sub = await getSubsidiaryOrThrow(ctx.subsidiaryId);
    const body = (await req.json().catch(() => ({}))) as {
      name?: string; code?: string; buId?: string; location?: string;
      ptype?: string; capacityMw?: number; frequency?: string; responsibleUserId?: string; status?: string;
    };

    const name = (body.name ?? "").trim();
    if (name.length < 2 || name.length > 80) throw new SaError("Project name must be 2–80 characters.", 400);
    if (!body.buId) throw new SaError("A parent business unit is required.", 400);
    await assertUnitInScope(body.buId, ctx.subsidiaryId);

    let code = (body.code ?? "").trim().toUpperCase();
    if (!code) {
      const n = (await db.project.count()) + 1;
      code = `PRJ-${sub.code.replace(/^SUB-/, "").slice(0, 3)}-${String(n).padStart(3, "0")}`;
    }
    const clash = await db.project.findUnique({ where: { code } });
    if (clash) throw new SaError(`Project code "${code}" already exists.`, 409);

    const PTYPE = ["SITE", "PLANT", "OFFICE", "WIND_FARM", "SOLAR_PARK", "HYDRO", "PIPELINE"];
    const ptype = PTYPE.includes(body.ptype ?? "") ? body.ptype! : "SITE";
    const frequency = body.frequency === "QUARTERLY" ? "QUARTERLY" : "MONTHLY";
    const status = body.status === "INACTIVE" ? "INACTIVE" : "ACTIVE";

    const project = await db.project.create({
      data: {
        code, name, businessUnitId: body.buId,
        location: (body.location ?? "").trim(), ptype, capacityMw: Number(body.capacityMw ?? 0) || 0,
        frequency, status,
      },
      include: { businessUnit: { select: { name: true } } },
    });

    if (body.responsibleUserId) {
      const user = await db.user.findUnique({ where: { id: body.responsibleUserId } });
      if (user && user.subsidiaryId === ctx.subsidiaryId) {
        await db.user.update({ where: { id: user.id }, data: { projectId: project.id, businessUnitId: body.buId } });
      }
    }

    await saLogActivity(ctx, sub.name, { action: "PROJECT_CREATE", targetType: "Project", targetLabel: `${project.code} — ${project.name}` });
    await saLogAudit(ctx, sub.code, { action: "PROJECT_CREATE", targetType: "Project", targetId: project.id, targetLabel: project.name, before: {}, after: { code, name, buId: body.buId, status } });
    await saNotify({ ntype: "SYSTEM", title: "Project registered", body: `${project.name} (${project.code}) was registered under ${project.businessUnit.name}.`, subsidiaryId: ctx.subsidiaryId, linkView: "projects" });

    return ok({
      project: toProjectRow(
        { ...project, businessUnit: { name: project.businessUnit.name }, users: [] },
        { approved: 0, pending: 0, overdue: 0, lastAt: null }, null, "OK"
      ),
    }, { status: 201 });
  });
}
