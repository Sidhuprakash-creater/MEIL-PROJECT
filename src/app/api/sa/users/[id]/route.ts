import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import {
  SaError, ROLE_LABELS, saHandle, requireSubsidiaryAdmin, getSubsidiaryOrThrow,
  assertUserInScope, assertUnitInScope, assertProjectInScope, saLogActivity, saLogAudit, saNotify,
} from "@/lib/sa/server";
import { toSubmissionRow, toUserRow } from "@/lib/sa/rows";
import { invalidateAllAuthCaches, revokeUserSessions } from "@/lib/auth/session-utils";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  return saHandle(async () => {
    const ctx = await requireSubsidiaryAdmin();
    const { id } = await params;
    const user = await assertUserInScope(id, ctx.subsidiaryId);

    const [buNames, projectNames, subs, tasks, activities, sessions, lastLogins] = await Promise.all([
      db.businessUnit.findMany({ where: { subsidiaryId: ctx.subsidiaryId }, select: { id: true, name: true } }),
      db.project.findMany({ where: { businessUnit: { subsidiaryId: ctx.subsidiaryId } }, select: { id: true, name: true } }),
      db.submission.findMany({ where: { submittedById: id }, orderBy: { updatedAt: "desc" }, take: 10 }),
      db.task.findMany({ where: { subsidiaryId: ctx.subsidiaryId }, orderBy: { dueDate: "asc" }, take: 40 }),
      db.activityEvent.findMany({ where: { actorName: user.name }, orderBy: { createdAt: "desc" }, take: 10 }),
      db.session.findMany({ where: { userId: id, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" }, take: 5 }),
      db.auditLog.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 8 }),
    ]);
    const buMap = new Map(buNames.map((b) => [b.id, b.name]));
    const prjMap = new Map(projectNames.map((p) => [p.id, p.name]));
    const taskCount = tasks.filter((t) => {
      try {
        const f = JSON.parse(t.assigneeFilter || "{}") as { userIds?: string[] };
        return (t.assigneeType === "USER" && t.assigneeLabel === user.name) || (f.userIds ?? []).includes(id);
      } catch { return false; }
    }).length;

    return ok({
      user: toUserRow(user, buMap, prjMap, ROLE_LABELS, taskCount, subs.length),
      tasks: tasks.filter((t) => {
        try {
          const f = JSON.parse(t.assigneeFilter || "{}") as { userIds?: string[] };
          return (t.assigneeType === "USER" && t.assigneeLabel === user.name) || (f.userIds ?? []).includes(id);
        } catch { return false; }
      }).slice(0, 8).map((t) => ({ id: t.id, ref: t.ref, title: t.title, category: t.category, priority: t.priority, status: t.status, dueDate: t.dueDate.toISOString() })),
      submissions: subs.map((s) => toSubmissionRow(s, new Map([[user.id, user.name]]), buMap, prjMap)),
      activity: activities.map((a) => ({ id: a.id, actorName: a.actorName, actorRole: a.actorRole, action: a.action, targetType: a.targetType, targetLabel: a.targetLabel, orgLabel: a.orgLabel, severity: a.severity, createdAt: a.createdAt.toISOString() })),
      sessions: sessions.map((s) => ({ id: s.id, userAgent: s.userAgent ?? "", ip: s.ip ?? "", createdAt: s.createdAt.toISOString(), expiresAt: s.expiresAt.toISOString() })),
      lastLogins: lastLogins.map((l) => ({ eventType: l.eventType, result: l.result, createdAt: l.createdAt.toISOString(), ip: l.ip ?? "" })),
    });
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  return saHandle(async () => {
    const ctx = await requireSubsidiaryAdmin();
    const { id } = await params;
    const sub = await getSubsidiaryOrThrow(ctx.subsidiaryId);
    const user = await assertUserInScope(id, ctx.subsidiaryId);
    const body = (await req.json().catch(() => ({}))) as {
      title?: string; phone?: string; role?: string; buId?: string | null; projectId?: string | null; status?: string; googleEmail?: string | null;
    };

    const before = { role: user.role, status: user.status, businessUnitId: user.businessUnitId, projectId: user.projectId, title: user.title, phone: user.phone, googleEmail: user.googleEmail };
    const data: Record<string, string | null> = {};
    if (body.title !== undefined) data.title = body.title.trim();
    if (body.phone !== undefined) data.phone = body.phone.trim();
    if (body.googleEmail !== undefined) {
      const nextGoogle = body.googleEmail?.trim().toLowerCase() || null;
      if (nextGoogle && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextGoogle)) {
        throw new SaError("Linked Google email address is invalid.", 400);
      }
      if (nextGoogle && nextGoogle !== user.googleEmail) {
        const conflict = await db.user.findFirst({
          where: { id: { not: id }, OR: [{ googleEmail: nextGoogle }, { email: nextGoogle }] },
          select: { id: true },
        });
        if (conflict) throw new SaError("This Google email is already linked to another user.", 409);
      }
      data.googleEmail = nextGoogle;
      data.authProvider = user.passwordHash && nextGoogle ? "BOTH" : nextGoogle ? "GOOGLE" : "CREDENTIALS";
    }

    if (body.role !== undefined && body.role !== user.role) {
      if (id === ctx.userId) throw new SaError("You cannot change your own role.", 403);
      const { ASSIGNABLE_ROLES } = await import("@/lib/sa/server");
      if (!(ASSIGNABLE_ROLES as readonly string[]).includes(body.role)) {
        throw new SaError("This role cannot be granted from a subsidiary workspace.", 403);
      }
      data.role = body.role;
    }
    if (body.status !== undefined && body.status !== user.status) {
      if (id === ctx.userId) throw new SaError("You cannot change your own account status.", 403);
      if (!["ACTIVE", "SUSPENDED", "INACTIVE"].includes(body.status)) throw new SaError("Invalid account status.", 400);
      data.status = body.status;
    }
    if (body.buId !== undefined) {
      if (body.buId === null) data.businessUnitId = null;
      else { await assertUnitInScope(body.buId, ctx.subsidiaryId); data.businessUnitId = body.buId; }
    }
    if (body.projectId !== undefined) {
      if (body.projectId === null) data.projectId = null;
      else { await assertProjectInScope(body.projectId, ctx.subsidiaryId); data.projectId = body.projectId; }
    }

    const updated = await db.user.update({ where: { id }, data: data as never });

    await saLogActivity(ctx, sub.name, { action: data.role ? "ROLE_CHANGE" : "ACCOUNT_UPDATE", targetType: "User", targetLabel: updated.name, severity: data.status === "SUSPENDED" ? "WARNING" : "INFO" });
    await saLogAudit(ctx, sub.code, { action: data.role ? "ROLE_CHANGE" : "ACCOUNT_UPDATE", targetType: "User", targetId: id, targetLabel: updated.name, before, after: data });
    if (data.status === "SUSPENDED" || data.status === "INACTIVE") {
      await saNotify({ ntype: "SYSTEM", title: `Account ${data.status.toLowerCase()}`, body: `${updated.name}'s account was marked ${data.status} by ${ctx.name}.`, severity: "WARNING", subsidiaryId: ctx.subsidiaryId, linkView: "users" });
      await revokeUserSessions(id);
    } else {
      invalidateAllAuthCaches(id);
    }

    return ok({ ok: true, role: updated.role, status: updated.status });
  });
}
