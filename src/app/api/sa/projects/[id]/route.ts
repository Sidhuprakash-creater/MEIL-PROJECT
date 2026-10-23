import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import {
  SaError, saHandle, requireSubsidiaryAdmin, getSubsidiaryOrThrow, assertProjectInScope, assertUnitInScope,
  saLogActivity, saLogAudit, saNotify, resolveEffectiveDeadline,
} from "@/lib/sa/server";
import { toProjectRow, unitStats } from "@/lib/sa/rows";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  return saHandle(async () => {
    const ctx = await requireSubsidiaryAdmin();
    const { id } = await params;
    const project = await assertProjectInScope(id, ctx.subsidiaryId);
    const period = "FY 2025-26";

    const [fresh, team, subs, evidence, timelines, tasks, activities, stats, sub0] = await Promise.all([
      db.project.findUnique({ where: { id }, include: { businessUnit: true, users: { select: { name: true } } } }),
      db.user.findMany({ where: { projectId: id } }),
      db.submission.findMany({ where: { projectId: id, subsidiaryId: ctx.subsidiaryId }, orderBy: { updatedAt: "desc" }, take: 10 }),
      db.evidenceDoc.findMany({ where: { projectId: id }, orderBy: { uploadedAt: "desc" }, take: 10 }),
      db.reportingTimeline.findMany({ where: { projectId: id, status: "ACTIVE" } }),
      db.task.findMany({ where: { subsidiaryId: ctx.subsidiaryId }, orderBy: { dueDate: "asc" }, take: 20 }),
      db.activityEvent.findMany({ orderBy: { createdAt: "desc" }, take: 60 }),
      unitStats(ctx.subsidiaryId, period),
      getSubsidiaryOrThrow(ctx.subsidiaryId),
    ]);
    if (!fresh) throw new SaError("Project not found.", 404);

    const [buNames, projectNames, userNames] = await Promise.all([
      db.businessUnit.findMany({ where: { subsidiaryId: ctx.subsidiaryId }, select: { id: true, name: true } }),
      db.project.findMany({ where: { businessUnit: { subsidiaryId: ctx.subsidiaryId } }, select: { id: true, name: true } }),
      db.user.findMany({ where: { subsidiaryId: ctx.subsidiaryId }, select: { id: true, name: true } }),
    ]);
    const buMap = new Map(buNames.map((b) => [b.id, b.name]));
    const prjMap = new Map(projectNames.map((p) => [p.id, p.name]));
    const uMap = new Map(userNames.map((u) => [u.id, u.name]));

    const eff = resolveEffectiveDeadline("PROJECT", { subsidiaryId: ctx.subsidiaryId, businessUnitId: fresh.businessUnitId, projectId: id }, timelines, sub0.code);

    return ok({
      project: toProjectRow(fresh, stats.prjMap.get(id) ?? { approved: 0, pending: 0, overdue: 0, total: 0, lastAt: null }, eff.dueDate, "OK"),
      team: team.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, status: u.status, title: u.title })),
      submissions: subs.map((s) => ({
        id: s.id, ref: s.ref, title: s.title, category: s.category, status: s.status,
        overdue: s.overdue, submittedAt: s.submittedAt?.toISOString() ?? null, dueDate: s.dueDate.toISOString(),
      })),
      evidence: evidence.map((e) => ({ id: e.id, name: e.name, fileType: e.fileType, status: e.status, uploadedAt: e.uploadedAt.toISOString(), uploadedBy: e.uploadedBy, version: e.version })),
      timelines: timelines.map((t) => ({
        id: t.id, ref: t.ref, name: t.name, period: t.period, level: t.level, orgId: t.projectId, orgName: fresh.name,
        startDate: t.startDate.toISOString(), dueDate: t.dueDate?.toISOString() ?? null, reviewDeadline: t.reviewDeadline?.toISOString() ?? null,
        categories: (() => { try { return JSON.parse(t.categories) as string[]; } catch { return []; } })(),
        inheritanceMode: t.inheritanceMode, overrideReason: t.overrideReason,
        effectiveDueDate: t.dueDate?.toISOString() ?? null, deadlineStatus: t.inheritanceMode === "OVERRIDE" ? "OVERRIDE" : "INHERIT",
        status: t.status, notify: t.notify, createdByName: t.createdByName, updatedAt: t.updatedAt.toISOString(),
      })),
      tasks: tasks.filter((t) => t.subsidiaryId === ctx.subsidiaryId).slice(0, 8).map((t) => ({
        id: t.id, ref: t.ref, title: t.title, category: t.category, priority: t.priority, status: t.status, dueDate: t.dueDate.toISOString(),
      })),
      activity: activities.filter((a) => a.targetLabel.includes(fresh.name) || a.targetLabel.includes(fresh.code)).slice(0, 8)
        .map((a) => ({ id: a.id, actorName: a.actorName, actorRole: a.actorRole, action: a.action, targetType: a.targetType, targetLabel: a.targetLabel, orgLabel: a.orgLabel, severity: a.severity, createdAt: a.createdAt.toISOString() })),
    });
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  return saHandle(async () => {
    const ctx = await requireSubsidiaryAdmin();
    const { id } = await params;
    const sub = await getSubsidiaryOrThrow(ctx.subsidiaryId);
    const project = await assertProjectInScope(id, ctx.subsidiaryId);
    const body = (await req.json().catch(() => ({}))) as {
      name?: string; location?: string; ptype?: string; capacityMw?: number; frequency?: string;
      responsibleUserId?: string; status?: string; buId?: string;
    };

    const before = { name: project.name, location: project.location, status: project.status, frequency: project.frequency, capacityMw: project.capacityMw };
    const data: Record<string, string | number> = {};
    if (body.name !== undefined) {
      const n = body.name.trim();
      if (n.length < 2 || n.length > 80) throw new SaError("Project name must be 2–80 characters.", 400);
      data.name = n;
    }
    if (body.location !== undefined) data.location = body.location.trim();
    if (body.ptype !== undefined && ["SITE", "PLANT", "OFFICE", "WIND_FARM", "SOLAR_PARK", "HYDRO", "PIPELINE"].includes(body.ptype)) data.ptype = body.ptype;
    if (body.capacityMw !== undefined) data.capacityMw = Number(body.capacityMw) || 0;
    if (body.frequency !== undefined && ["MONTHLY", "QUARTERLY"].includes(body.frequency)) data.frequency = body.frequency;
    if (body.status !== undefined) {
      if (!["ACTIVE", "INACTIVE"].includes(body.status)) throw new SaError("Status must be ACTIVE or INACTIVE.", 400);
      data.status = body.status;
    }
    if (body.buId !== undefined && body.buId !== project.businessUnitId) {
      await assertUnitInScope(body.buId, ctx.subsidiaryId); // 403 if outside subsidiary
      data.businessUnitId = body.buId;
    }

    const updated = await db.project.update({ where: { id }, data: data as never, include: { businessUnit: { select: { name: true } } } });

    if (body.responsibleUserId !== undefined) {
      if (body.responsibleUserId === "") {
        await db.user.updateMany({ where: { projectId: id }, data: { projectId: null } });
      } else {
        const user = await db.user.findUnique({ where: { id: body.responsibleUserId } });
        if (!user || user.subsidiaryId !== ctx.subsidiaryId) throw new SaError("Responsible user must belong to your subsidiary.", 403);
        await db.user.updateMany({ where: { projectId: id, id: { not: user.id } }, data: { projectId: null } });
        await db.user.update({ where: { id: user.id }, data: { projectId: id, businessUnitId: updated.businessUnitId } });
      }
    }

    await saLogActivity(ctx, sub.name, { action: "PROJECT_UPDATE", targetType: "Project", targetLabel: `${updated.code} — ${updated.name}` });
    await saLogAudit(ctx, sub.code, { action: "PROJECT_UPDATE", targetType: "Project", targetId: id, targetLabel: updated.name, before, after: data });

    return ok({
      project: toProjectRow({ ...updated, users: [] }, { approved: 0, pending: 0, overdue: 0, lastAt: null }, null, "OK"),
    });
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return saHandle(async () => {
    const ctx = await requireSubsidiaryAdmin();
    const { id } = await params;
    const sub = await getSubsidiaryOrThrow(ctx.subsidiaryId);
    const project = await assertProjectInScope(id, ctx.subsidiaryId);

    const submissionCount = await db.submission.count({ where: { projectId: id } });
    if (submissionCount > 0) {
      throw new SaError(`This project has ${submissionCount} reporting record(s). Deactivate it instead to preserve reporting history.`, 409);
    }
    await db.user.updateMany({ where: { projectId: id }, data: { projectId: null } });
    await db.project.delete({ where: { id } });

    await saLogActivity(ctx, sub.name, { action: "PROJECT_DELETE", targetType: "Project", targetLabel: `${project.code} — ${project.name}`, severity: "WARNING" });
    await saLogAudit(ctx, sub.code, { action: "PROJECT_DELETE", targetType: "Project", targetId: id, targetLabel: project.name, before: { code: project.code, name: project.name } });
    return ok({ ok: true });
  });
}
