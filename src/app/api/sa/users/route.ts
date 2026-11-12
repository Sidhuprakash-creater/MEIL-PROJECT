import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import {
  SaError, ASSIGNABLE_ROLES, ROLE_LABELS, saHandle, requireSubsidiaryAdmin,
  getSubsidiaryOrThrow, saLogActivity, saLogAudit, saNotify,
} from "@/lib/sa/server";
import { toUserRow } from "@/lib/sa/rows";
import { ProvisionError, provisionUser } from "@/lib/auth/provision-user";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return saHandle(async () => {
    const ctx = await requireSubsidiaryAdmin();
    const sp = req.nextUrl.searchParams;
    const q = (sp.get("q") ?? "").trim().toLowerCase();
    const role = sp.get("role");
    const status = sp.get("status");
    const buId = sp.get("buId");
    const page = Math.max(1, Number(sp.get("page") ?? 1));
    const pageSize = Math.min(Math.max(1, Number(sp.get("pageSize") ?? 10)), 50);

    const [usersAll, buNames, projectNames, tasks, subs] = await Promise.all([
      db.user.findMany({
        where: { subsidiaryId: ctx.subsidiaryId, role: { notIn: ["GROUP_ADMIN", "ORG_MANAGER"] } },
        orderBy: { joinedAt: "asc" },
      }),
      db.businessUnit.findMany({ where: { subsidiaryId: ctx.subsidiaryId }, select: { id: true, name: true } }),
      db.project.findMany({ where: { businessUnit: { subsidiaryId: ctx.subsidiaryId } }, select: { id: true, name: true } }),
      db.task.findMany({ where: { subsidiaryId: ctx.subsidiaryId }, select: { assigneeFilter: true, assigneeType: true, assigneeLabel: true } }),
      db.submission.findMany({ where: { subsidiaryId: ctx.subsidiaryId }, select: { submittedById: true } }),
    ]);
    const buMap = new Map(buNames.map((b) => [b.id, b.name]));
    const prjMap = new Map(projectNames.map((p) => [p.id, p.name]));
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

    let rows = usersAll.map((u) => toUserRow(u, buMap, prjMap, ROLE_LABELS, taskCount.get(u.id) ?? 0, subCount.get(u.id) ?? 0));
    if (q) rows = rows.filter((r) => `${r.name} ${r.email} ${r.googleEmail ?? ""} ${r.employeeId ?? ""} ${r.title}`.toLowerCase().includes(q));
    if (role && role !== "ALL") rows = rows.filter((r) => r.role === role);
    if (status && status !== "ALL") rows = rows.filter((r) => r.status === status);
    if (buId && buId !== "ALL") rows = rows.filter((r) => r.buId === buId);

    const total = rows.length;
    return ok({
      users: rows.slice((page - 1) * pageSize, page * pageSize),
      total, page, pageSize,
      roles: Object.keys(ROLE_LABELS),
      assignableRoles: ASSIGNABLE_ROLES,
    });
  });
}

export async function POST(req: NextRequest) {
  return saHandle(async () => {
    const ctx = await requireSubsidiaryAdmin();
    const sub = await getSubsidiaryOrThrow(ctx.subsidiaryId);
    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      email?: string;
      googleEmail?: string;
      employeeId?: string;
      role?: string;
      title?: string;
      phone?: string;
      buId?: string;
      projectId?: string;
      issueTempPassword?: boolean;
    };

    try {
      const origin = new URL(req.url).origin;
      const provisioned = await provisionUser({
        name: body.name ?? "",
        email: body.email ?? "",
        googleEmail: body.googleEmail,
        employeeId: body.employeeId,
        role: body.role ?? "",
        subsidiaryId: ctx.subsidiaryId,
        businessUnitId: body.buId || null,
        projectId: body.projectId || null,
        title: body.title,
        phone: body.phone,
        issueTempPassword: body.issueTempPassword,
        actor: { id: ctx.userId, name: ctx.name, role: ctx.role },
        allowedRoles: ASSIGNABLE_ROLES,
        origin,
      });

      const user = provisioned.user;
      await saLogActivity(ctx, sub.name, {
        action: "USER_CREATE",
        targetType: "User",
        targetLabel: `${user.name} (${ROLE_LABELS[user.role] ?? user.role})`,
      });
      await saLogAudit(ctx, sub.code, {
        action: "USER_CREATE",
        targetType: "User",
        targetId: user.id,
        targetLabel: user.name,
        before: {},
        after: { email: user.email, googleEmail: user.googleEmail, role: user.role, status: user.status },
      });
      await saNotify({
        ntype: "SYSTEM",
        title: "User provisioned",
        body: `${user.name} was provisioned as ${ROLE_LABELS[user.role] ?? user.role}.`,
        subsidiaryId: ctx.subsidiaryId,
        linkView: "users",
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
        throw new SaError(err.message, err.status);
      }
      throw err;
    }
  });
}
