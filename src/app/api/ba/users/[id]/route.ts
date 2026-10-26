import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import {
  BaError, baHandle, requireBuAdmin, getBuOrThrow,
  assertProjectInBuScope, assertUserInBuScope,
  BA_ASSIGNABLE_ROLES, ROLE_LABELS, baLogActivity, baLogAudit, baNotify, parseJson,
} from "@/lib/ba/server";
import { loadBuProjectNames } from "@/lib/ba/rows";
import { toUserRow, toSubmissionRow } from "@/lib/ba/rows";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  return baHandle(async () => {
    const ctx = await requireBuAdmin();
    const { id } = await params;
    const user = await assertUserInBuScope(id, ctx.businessUnitId);

    const [projectNames, subs, tasks, activities, sessions, lastLogins] = await Promise.all([
      loadBuProjectNames(ctx.businessUnitId),
      db.submission.findMany({ where: { submittedById: id }, orderBy: { updatedAt: "desc" }, take: 10 }),
      db.task.findMany({ where: { businessUnitId: ctx.businessUnitId }, orderBy: { dueDate: "asc" }, take: 40 }),
      db.activityEvent.findMany({ where: { actorName: user.name }, orderBy: { createdAt: "desc" }, take: 10 }),
      db.session.findMany({ where: { userId: id, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" }, take: 5 }),
      db.auditLog.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 8 }),
    ]);
    const buMap = new Map<string, string>([[ctx.businessUnitId, ""]]);

    const userTasks = tasks.filter((t) => {
      try {
        const f = JSON.parse(t.assigneeFilter || "{}") as { userIds?: string[] };
        return (t.assigneeType === "USER" && t.assigneeLabel === user.name) || (f.userIds ?? []).includes(id);
      } catch { return false; }
    });

    return ok({
      user: toUserRow(user, buMap, projectNames, ROLE_LABELS, userTasks.length, subs.length),
      tasks: userTasks.slice(0, 8).map((t) => ({ id: t.id, ref: t.ref, title: t.title, category: t.category, priority: t.priority, status: t.status, dueDate: t.dueDate.toISOString() })),
      submissions: subs.map((s) => toSubmissionRow(s, new Map([[user.id, user.name]]), buMap, projectNames)),
      activity: activities.map((a) => ({ id: a.id, actorName: a.actorName, actorRole: a.actorRole, action: a.action, targetType: a.targetType, targetLabel: a.targetLabel, orgLabel: a.orgLabel, severity: a.severity, createdAt: a.createdAt.toISOString() })),
      sessions: sessions.map((s) => ({ id: s.id, userAgent: s.userAgent ?? "", ip: s.ip ?? "", createdAt: s.createdAt.toISOString(), expiresAt: s.expiresAt.toISOString() })),
      lastLogins: lastLogins.map((l) => ({ eventType: l.eventType, result: l.result, createdAt: l.createdAt.toISOString(), ip: l.ip ?? "" })),
    });
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  return baHandle(async () => {
    const ctx = await requireBuAdmin();
    const { id } = await params;
    const bu = await getBuOrThrow(ctx.businessUnitId);
    const user = await assertUserInBuScope(id, ctx.businessUnitId);
    const body = (await req.json().catch(() => ({}))) as {
      title?: string; phone?: string; role?: string; projectId?: string | null;
    };

    const before = { role: user.role, projectId: user.projectId, title: user.title, phone: user.phone };
    const data: Record<string, string | null> = {};
    if (body.title !== undefined) data.title = body.title.trim();
    if (body.phone !== undefined) data.phone = body.phone.trim();

    if (body.role !== undefined && body.role !== user.role) {
      if (id === ctx.userId) throw new BaError("You cannot change your own role.", 403);
      if (!(BA_ASSIGNABLE_ROLES as readonly string[]).includes(body.role)) {
        throw new BaError("This role cannot be granted from a BU workspace.", 403);
      }
      data.role = body.role;
    }
    if (body.projectId !== undefined) {
      if (body.projectId === null || body.projectId === "") {
        data.projectId = null;
      } else {
        await assertProjectInBuScope(body.projectId, ctx.businessUnitId);
        data.projectId = body.projectId;
      }
    }

    const updated = await db.user.update({ where: { id }, data: data as never });

    await baLogActivity(ctx, bu.name, { action: data.role ? "ROLE_CHANGE" : "ACCOUNT_UPDATE", targetType: "User", targetLabel: updated.name });
    await baLogAudit(ctx, bu.code, { action: data.role ? "ROLE_CHANGE" : "ACCOUNT_UPDATE", targetType: "User", targetId: id, targetLabel: updated.name, before, after: data });
    if (data.role) {
      await baNotify({ ntype: "SYSTEM", title: "Role updated", body: `${updated.name}'s role was changed to ${ROLE_LABELS[updated.role]}.`, severity: "INFO", linkView: "users", refId: id });
    }

    return ok({ ok: true, role: updated.role });
  });
}
