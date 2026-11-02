import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import {
  BaError, baHandle, requireBuAdmin, getBuOrThrow, assertUserInBuScope,
  BA_ASSIGNABLE_ROLES, ROLE_LABELS, baLogActivity, baLogAudit, baNotify,
} from "@/lib/ba/server";
import { loadBuProjectNames } from "@/lib/ba/rows";
import { toUserRow } from "@/lib/ba/rows";

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
        where: { businessUnitId: ctx.businessUnitId, role: { notIn: ["GROUP_ADMIN", "ORG_MANAGER", "SUBSIDIARY_ADMIN", "SUBSIDIARY_MANAGER"] } },
        orderBy: { joinedAt: "asc" },
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
    if (q) rows = rows.filter((r) => `${r.name} ${r.email} ${r.employeeId ?? ""} ${r.title}`.toLowerCase().includes(q));
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
      name?: string; email?: string; role?: string; title?: string; phone?: string; projectId?: string;
    };

    const name = (body.name ?? "").trim();
    const email = (body.email ?? "").trim().toLowerCase();
    if (name.length < 2) throw new BaError("User name is required.", 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BaError("A valid email address is required.", 400);
    if (!body.role || !(BA_ASSIGNABLE_ROLES as readonly string[]).includes(body.role)) {
      throw new BaError("This role cannot be granted from a BU workspace. Choose a contributor role.", 403);
    }
    const clash = await db.user.findUnique({ where: { email } });
    if (clash) throw new BaError(`A user with email ${email} already exists.`, 409);

    if (body.projectId) {
      const prj = await db.project.findUnique({ where: { id: body.projectId } });
      if (!prj || prj.businessUnitId !== ctx.businessUnitId) throw new BaError("Project is outside your assigned business unit.", 403);
    }

    const seq = (await db.user.count()) + 1;
    const employeeId = `EMP-${String(seq).padStart(4, "0")}`;
    const user = await db.user.create({
      data: {
        name, email, role: body.role, status: "INVITED",
        employeeId, title: (body.title ?? "").trim(), phone: (body.phone ?? "").trim(),
        subsidiaryId: ctx.subsidiaryId,
        businessUnitId: ctx.businessUnitId,
        projectId: body.projectId ?? null,
      },
    });

    await baLogActivity(ctx, bu.name, { action: "USER_CREATE", targetType: "User", targetLabel: `${name} (${ROLE_LABELS[body.role]})` });
    await baLogAudit(ctx, bu.code, { action: "USER_CREATE", targetType: "User", targetId: user.id, targetLabel: name, before: {}, after: { email, role: body.role, status: "INVITED" } });
    await baNotify({ ntype: "SYSTEM", title: "BU user invited", body: `${name} was invited as ${ROLE_LABELS[body.role]} under ${bu.name}.`, severity: "INFO", linkView: "users", refId: user.id });

    return ok({ user: { id: user.id, name, email, employeeId, role: body.role, status: "INVITED" } }, { status: 201 });
  });
}
