import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import {
  SaError, saHandle, requireSubsidiaryAdmin, getSubsidiaryOrThrow, assertUnitInScope,
  saLogActivity, saLogAudit, saNotify,
} from "@/lib/sa/server";
import { toSubmissionRow, toUnitRow, unitStats } from "@/lib/sa/rows";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  return saHandle(async () => {
    const ctx = await requireSubsidiaryAdmin();
    const { id } = await params;
    const unit = await assertUnitInScope(id, ctx.subsidiaryId);
    const period = "FY 2025-26";

    const [fresh, projects, users, subs, timelines, activities, stats, buUsers] = await Promise.all([
      db.businessUnit.findUnique({ where: { id }, include: { subsidiary: { select: { name: true } } } }),
      db.project.findMany({ where: { businessUnitId: id }, orderBy: { createdAt: "asc" } }),
      db.user.findMany({ where: { businessUnitId: id } }),
      db.submission.findMany({ where: { businessUnitId: id, subsidiaryId: ctx.subsidiaryId }, orderBy: { updatedAt: "desc" }, take: 10 }),
      db.reportingTimeline.findMany({ where: { businessUnitId: id, status: "ACTIVE" } }),
      db.activityEvent.findMany({ where: { orgLabel: { contains: "" } }, orderBy: { createdAt: "desc" }, take: 60 }),
      unitStats(ctx.subsidiaryId, period),
      db.user.count({ where: { businessUnitId: id } }),
    ]);
    if (!fresh) throw new SaError("Business unit not found.", 404);

    const [buNames, projectNames, userNames] = await Promise.all([
      db.businessUnit.findMany({ where: { subsidiaryId: ctx.subsidiaryId }, select: { id: true, name: true } }),
      db.project.findMany({ where: { businessUnit: { subsidiaryId: ctx.subsidiaryId } }, select: { id: true, name: true } }),
      db.user.findMany({ where: { subsidiaryId: ctx.subsidiaryId }, select: { id: true, name: true } }),
    ]);
    const buMap = new Map(buNames.map((b) => [b.id, b.name]));
    const prjMap = new Map(projectNames.map((p) => [p.id, p.name]));
    const uMap = new Map(userNames.map((u) => [u.id, u.name]));

    return ok({
      unit: toUnitRow(fresh, stats.buMap.get(id) ?? { approved: 0, submitted: 0, pending: 0, overdue: 0, total: 0 }, projects.length, buUsers),
      projects: projects.map((p) => ({ id: p.id, code: p.code, name: p.name, location: p.location, status: p.status, ptype: p.ptype })),
      users: users.slice(0, 10).map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, status: u.status, title: u.title })),
      submissions: subs.map((s) => toSubmissionRow(s, uMap, buMap, prjMap)),
      timelines: timelines.map((t) => ({
        id: t.id, ref: t.ref, name: t.name, period: t.period, level: t.level,
        orgId: t.businessUnitId, orgName: fresh.name,
        startDate: t.startDate.toISOString(), dueDate: t.dueDate?.toISOString() ?? null,
        reviewDeadline: t.reviewDeadline?.toISOString() ?? null,
        categories: (() => { try { return JSON.parse(t.categories) as string[]; } catch { return []; } })(),
        inheritanceMode: t.inheritanceMode, overrideReason: t.overrideReason,
        effectiveDueDate: t.dueDate?.toISOString() ?? null,
        deadlineStatus: t.inheritanceMode === "OVERRIDE" ? "OVERRIDE" : "INHERIT",
        status: t.status, notify: t.notify, createdByName: t.createdByName, updatedAt: t.updatedAt.toISOString(),
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
    const unit = await assertUnitInScope(id, ctx.subsidiaryId);
    const body = (await req.json().catch(() => ({}))) as {
      name?: string; description?: string; managerName?: string; adminName?: string; status?: string;
    };

    const before = { name: unit.name, description: unit.description, managerName: unit.managerName, adminName: unit.adminName, status: unit.status };
    const data: Record<string, string> = {};
    if (body.name !== undefined) {
      const n = body.name.trim();
      if (n.length < 2 || n.length > 80) throw new SaError("Business unit name must be 2–80 characters.", 400);
      data.name = n;
    }
    if (body.description !== undefined) data.description = body.description.slice(0, 500);
    if (body.managerName !== undefined) data.managerName = body.managerName.trim();
    if (body.adminName !== undefined) data.adminName = body.adminName.trim();
    if (body.status !== undefined) {
      if (!["ACTIVE", "INACTIVE"].includes(body.status)) throw new SaError("Status must be ACTIVE or INACTIVE.", 400);
      data.status = body.status;
    }

    const updated = await db.businessUnit.update({ where: { id }, data, include: { subsidiary: { select: { name: true } } } });
    await saLogActivity(ctx, sub.name, { action: data.status && data.status !== before.status ? "BU_STATUS" : "BU_UPDATE", targetType: "BusinessUnit", targetLabel: `${updated.code} — ${updated.name}`, severity: data.status === "INACTIVE" ? "WARNING" : "INFO" });
    await saLogAudit(ctx, sub.code, { action: "BU_UPDATE", targetType: "BusinessUnit", targetId: id, targetLabel: updated.name, before, after: data });

    const { unitStats: us, toUnitRow: tr } = await import("@/lib/sa/rows");
    const stats = await us(ctx.subsidiaryId, "FY 2025-26");
    const projectCount = await db.project.count({ where: { businessUnitId: id } });
    const userCount = await db.user.count({ where: { businessUnitId: id } });

    if (data.status === "INACTIVE") {
      await saNotify({ ntype: "SYSTEM", title: "Business unit deactivated", body: `${updated.name} was deactivated. Historical reports are preserved.`, severity: "WARNING", subsidiaryId: ctx.subsidiaryId, linkView: "units" });
    }

    return ok({ unit: tr(updated, stats.buMap.get(id) ?? { approved: 0, submitted: 0, pending: 0, overdue: 0, total: 0 }, projectCount, userCount) });
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return saHandle(async () => {
    const ctx = await requireSubsidiaryAdmin();
    const { id } = await params;
    const sub = await getSubsidiaryOrThrow(ctx.subsidiaryId);
    const unit = await assertUnitInScope(id, ctx.subsidiaryId);

    const [projectCount, userCount] = await Promise.all([
      db.project.count({ where: { businessUnitId: id } }),
      db.user.count({ where: { businessUnitId: id } }),
    ]);
    if (projectCount > 0 || userCount > 0) {
      throw new SaError(`This business unit has ${projectCount} project(s) and ${userCount} user(s). Deactivate it instead to preserve reporting history.`, 409);
    }

    await db.businessUnit.delete({ where: { id } });
    await saLogActivity(ctx, sub.name, { action: "BU_DELETE", targetType: "BusinessUnit", targetLabel: `${unit.code} — ${unit.name}`, severity: "WARNING" });
    await saLogAudit(ctx, sub.code, { action: "BU_DELETE", targetType: "BusinessUnit", targetId: id, targetLabel: unit.name, before: { code: unit.code, name: unit.name }, outcome: "SUCCESS" });
    return ok({ ok: true });
  });
}
