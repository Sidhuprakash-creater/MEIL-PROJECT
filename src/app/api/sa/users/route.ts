import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import {
  SaError, ASSIGNABLE_ROLES, ROLE_LABELS, saHandle, requireSubsidiaryAdmin,
  getSubsidiaryOrThrow, saLogActivity, saLogAudit, saNotify,
} from "@/lib/sa/server";
import { toUserRow } from "@/lib/sa/rows";

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
    if (q) rows = rows.filter((r) => `${r.name} ${r.email} ${r.employeeId ?? ""} ${r.title}`.toLowerCase().includes(q));
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
      name?: string; email?: string; role?: string; title?: string; phone?: string; buId?: string; projectId?: string;
    };

    const name = (body.name ?? "").trim();
    const email = (body.email ?? "").trim().toLowerCase();
    if (name.length < 2) throw new SaError("User name is required.", 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new SaError("A valid email address is required.", 400);
    if (!body.role || !(ASSIGNABLE_ROLES as readonly string[]).includes(body.role)) {
      throw new SaError("This role cannot be granted from a subsidiary workspace.", 403);
    }
    const clash = await db.user.findUnique({ where: { email } });
    if (clash) throw new SaError(`A user with email ${email} already exists.`, 409);

    if (body.buId) {
      const bu = await db.businessUnit.findUnique({ where: { id: body.buId } });
      if (!bu || bu.subsidiaryId !== ctx.subsidiaryId) throw new SaError("Business unit is outside your subsidiary.", 403);
    }
    if (body.projectId) {
      const prj = await db.project.findUnique({ where: { id: body.projectId }, include: { businessUnit: true } });
      if (!prj || prj.businessUnit.subsidiaryId !== ctx.subsidiaryId) throw new SaError("Project is outside your subsidiary.", 403);
    }

    const seq = (await db.user.count()) + 1;
    const employeeId = `EMP-${String(seq).padStart(4, "0")}`;
    const user = await db.user.create({
      data: {
        name, email, role: body.role, status: "INVITED",
        employeeId, title: (body.title ?? "").trim(), phone: (body.phone ?? "").trim(),
        subsidiaryId: ctx.subsidiaryId,
        businessUnitId: body.buId ?? null,
        projectId: body.projectId ?? null,
      },
    });

    await saLogActivity(ctx, sub.name, { action: "USER_CREATE", targetType: "User", targetLabel: `${name} (${ROLE_LABELS[body.role]})` });
    await saLogAudit(ctx, sub.code, { action: "USER_CREATE", targetType: "User", targetId: user.id, targetLabel: name, before: {}, after: { email, role: body.role, status: "INVITED" } });
    await saNotify({ ntype: "SYSTEM", title: "User invited", body: `${name} was invited as ${ROLE_LABELS[body.role]}. Activation pending.`, subsidiaryId: ctx.subsidiaryId, linkView: "users" });

    return ok({ user: { id: user.id, name, email, employeeId, role: body.role, status: "INVITED" } }, { status: 201 });
  });
}
