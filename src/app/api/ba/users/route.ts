import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import {
  BaError, baHandle, requireBuAdmin, getBuOrThrow, assertUserInBuScope,
  BA_ASSIGNABLE_ROLES, ROLE_LABELS, baLogActivity, baLogAudit, baNotify,
} from "@/lib/ba/server";
import { loadBuProjectNames } from "@/lib/ba/rows";
import { toUserRow } from "@/lib/ba/rows";
import { ProvisionError, provisionUser } from "@/lib/auth/provision-user";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return baHandle(async () => {
    const ctx = await requireBuAdmin();
    const sp = req.nextUrl.searchParams;
    const q = (sp.get("q") ?? "").trim().toLowerCase();
    const role = sp.get("role");
    const status = sp.get("status");
    const projectId = sp.get("projectId");
    const page = Math.max(1, Number(sp.get("page") ?? 1));
    const pageSize = Math.min(Math.max(1, Number(sp.get("pageSize") ?? 10)), 50);

    /* BU scope: only users registered to this BU (excluding group/subsidiary/BU
       managers so the directory stays focused on operational contributors).
       The BU Manager is included for visibility (but cannot be edited here). */
    const [usersAll, projectNames, tasks, subs] = await Promise.all([
      db.user.findMany({
        where: {
          OR: [
            { businessUnitId: ctx.businessUnitId },
            { project: { businessUnitId: ctx.businessUnitId } },
          ],
          role: { notIn: ["GROUP_ADMIN", "ORG_MANAGER", "SUBSIDIARY_ADMIN", "SUBSIDIARY_MANAGER"] },
        },
        orderBy: { joinedAt: "desc" },
      }),
      loadBuProjectNames(ctx.businessUnitId),
      db.task.findMany({ where: { businessUnitId: ctx.businessUnitId }, select: { assigneeFilter: true, assigneeType: true, assigneeLabel: true } }),
      db.submission.findMany({ where: { businessUnitId: ctx.businessUnitId }, select: { submittedById: true } }),
    ]);
    const prjMap = projectNames;
    const subCount = new Map<string, number>();
    for (const s of subs) if (s.submittedById) subCount.set(s.submittedById, (subCount.get(s.submittedById) ?? 0) + 1);
    const taskCount = new Map<string, number>();
    for (const t of tasks) {
      try {
        const f = JSON.parse(t.assigneeFilter || "{}") as { userIds?: string[] };
        if (t.assigneeType === "USER") {
          const u = usersAll.find((x) => x.name === t.assigneeLabel);
          if (u) taskCount.set(u.id, (taskCount.get(u.id) ?? 0) + 1);
        }
        for (const uid of f.userIds ?? []) taskCount.set(uid, (taskCount.get(uid) ?? 0) + 1);
      } catch { /* ignore */ }
    }
    const buMap = new Map<string, string>([[ctx.businessUnitId, ""]]);

    let rows = usersAll.map((u) => toUserRow(u, buMap, prjMap, ROLE_LABELS, taskCount.get(u.id) ?? 0, subCount.get(u.id) ?? 0));
    rows = rows.map((r) => ({ ...r, buName: r.buName ?? null }));
    if (q) rows = rows.filter((r) => `${r.name} ${r.email} ${r.googleEmail ?? ""} ${r.employeeId ?? ""} ${r.title}`.toLowerCase().includes(q));
    if (role && role !== "ALL") rows = rows.filter((r) => r.role === role);
    if (status && status !== "ALL") rows = rows.filter((r) => r.status === status);
    if (projectId && projectId !== "ALL") rows = rows.filter((r) => r.projectId === projectId);

    const total = rows.length;
    return ok({
      users: rows.slice((page - 1) * pageSize, page * pageSize),
      total, page, pageSize,
      roles: Object.keys(ROLE_LABELS),
      assignableRoles: BA_ASSIGNABLE_ROLES,
      buProjects: [...prjMap.entries()].map(([id, name]) => ({ id, name })),
    });
  });
}

export async function POST(req: NextRequest) {
  return baHandle(async () => {
    const ctx = await requireBuAdmin();
    const bu = await getBuOrThrow(ctx.businessUnitId);
    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      email?: string;
      googleEmail?: string;
      employeeId?: string;
      role?: string;
      title?: string;
      phone?: string;
      projectId?: string;
      issueTempPassword?: boolean;
    };

    if (!body.projectId) {
      throw new BaError("Project selection is required when creating a BU user.", 400);
    }

    try {
      const origin = new URL(req.url).origin;
      const provisioned = await provisionUser({
        name: body.name ?? "",
        email: body.email ?? "",
        googleEmail: body.googleEmail,
        employeeId: body.employeeId,
        role: body.role ?? "",
        subsidiaryId: ctx.subsidiaryId,
        businessUnitId: ctx.businessUnitId,
        projectId: body.projectId || null,
        title: body.title,
        phone: body.phone,
        issueTempPassword: body.issueTempPassword,
        actor: { id: ctx.userId, name: ctx.name, role: ctx.role },
        allowedRoles: BA_ASSIGNABLE_ROLES,
        origin,
      });

      const user = provisioned.user;
      await baLogActivity(ctx, bu.name, {
        action: "USER_CREATE",
        targetType: "User",
        targetLabel: `${user.name} (${ROLE_LABELS[user.role] ?? user.role})`,
      });
      await baLogAudit(ctx, bu.code, {
        action: "USER_CREATE",
        targetType: "User",
        targetId: user.id,
        targetLabel: user.name,
        before: {},
        after: { email: user.email, googleEmail: user.googleEmail, role: user.role, status: user.status },
      });
      await baNotify({
        ntype: "SYSTEM",
        title: "BU user provisioned",
        body: `${user.name} was provisioned as ${ROLE_LABELS[user.role] ?? user.role} under ${bu.name}.`,
        severity: "INFO",
        linkView: "users",
        refId: user.id,
      });

      return ok(
        {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            googleEmail: user.googleEmail,
            employeeId: user.employeeId,
            role: user.role,
            status: user.status,
          },
          tempPassword: provisioned.tempPassword,
          emailSent: provisioned.emailResult.sent,
          emailNote: provisioned.emailResult.reason,
        },
        { status: 201 }
      );
    } catch (err) {
      if (err instanceof ProvisionError) {
        throw new BaError(err.message, err.status);
      }
      throw err;
    }
  });
}
