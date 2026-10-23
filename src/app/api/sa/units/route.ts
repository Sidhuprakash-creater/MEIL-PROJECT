import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import {
  SaError, saHandle, requireSubsidiaryAdmin, getSubsidiaryOrThrow, saLogActivity, saLogAudit, saNotify,
} from "@/lib/sa/server";
import { unitStats, toUnitRow } from "@/lib/sa/rows";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return saHandle(async () => {
    const ctx = await requireSubsidiaryAdmin();
    const sp = req.nextUrl.searchParams;
    const q = (sp.get("q") ?? "").trim().toLowerCase();
    const status = sp.get("status");
    const page = Math.max(1, Number(sp.get("page") ?? 1));
    const pageSize = Math.min(Math.max(1, Number(sp.get("pageSize") ?? 8)), 50);
    const period = sp.get("period") ?? "FY 2025-26";

    const [unitsAll, stats, projects, users] = await Promise.all([
      db.businessUnit.findMany({ where: { subsidiaryId: ctx.subsidiaryId }, orderBy: { createdAt: "asc" }, include: { subsidiary: { select: { name: true } } } }),
      unitStats(ctx.subsidiaryId, period),
      db.project.findMany({ where: { businessUnit: { subsidiaryId: ctx.subsidiaryId } }, select: { businessUnitId: true } }),
      db.user.findMany({ where: { subsidiaryId: ctx.subsidiaryId, businessUnitId: { not: null } }, select: { businessUnitId: true } }),
    ]);
    const projCount = new Map<string, number>();
    for (const p of projects) projCount.set(p.businessUnitId, (projCount.get(p.businessUnitId) ?? 0) + 1);
    const userCount = new Map<string, number>();
    for (const u of users) if (u.businessUnitId) userCount.set(u.businessUnitId, (userCount.get(u.businessUnitId) ?? 0) + 1);

    let rows = unitsAll.map((u) => toUnitRow(u, stats.buMap.get(u.id) ?? { approved: 0, submitted: 0, pending: 0, overdue: 0, total: 0 }, projCount.get(u.id) ?? 0, userCount.get(u.id) ?? 0));
    if (q) rows = rows.filter((r) => `${r.name} ${r.code} ${r.managerName} ${r.adminName}`.toLowerCase().includes(q));
    if (status && status !== "ALL") rows = rows.filter((r) => r.status === status);

    const total = rows.length;
    const units = rows.slice((page - 1) * pageSize, page * pageSize);
    return ok({ units, total, page, pageSize });
  });
}

export async function POST(req: NextRequest) {
  return saHandle(async () => {
    const ctx = await requireSubsidiaryAdmin();
    const sub = await getSubsidiaryOrThrow(ctx.subsidiaryId);
    const body = (await req.json().catch(() => ({}))) as {
      name?: string; code?: string; description?: string; managerName?: string; adminName?: string; status?: string;
    };

    const name = (body.name ?? "").trim();
    if (name.length < 2 || name.length > 80) throw new SaError("Business unit name must be 2–80 characters.", 400);
    const status = body.status === "INACTIVE" ? "INACTIVE" : "ACTIVE";

    let code = (body.code ?? "").trim().toUpperCase();
    if (!code) {
      const prefix = sub.code.replace(/^SUB-/, "").slice(0, 3) || "BU";
      const n = (await db.businessUnit.count({ where: { subsidiaryId: ctx.subsidiaryId } })) + 1;
      code = `BU-${prefix}-${String(n).padStart(3, "0")}`;
    }
    const clash = await db.businessUnit.findUnique({ where: { code } });
    if (clash) throw new SaError(`BU code "${code}" already exists. Choose a different code.`, 409);

    const unit = await db.businessUnit.create({
      data: {
        code, name, subsidiaryId: ctx.subsidiaryId,
        description: (body.description ?? "").slice(0, 500),
        managerName: (body.managerName ?? "").trim(), adminName: (body.adminName ?? "").trim(),
        status,
      },
      include: { subsidiary: { select: { name: true } } },
    });

    await saLogActivity(ctx, sub.name, { action: "BU_CREATE", targetType: "BusinessUnit", targetLabel: `${unit.code} — ${unit.name}` });
    await saLogAudit(ctx, sub.code, { action: "BU_CREATE", targetType: "BusinessUnit", targetId: unit.id, targetLabel: unit.name, before: {}, after: { code, name, status } });
    await saNotify({ ntype: "SYSTEM", title: "Business unit created", body: `${unit.name} (${unit.code}) is now part of ${sub.name}.`, subsidiaryId: ctx.subsidiaryId, linkView: "units" });

    const row = toUnitRow(unit, { approved: 0, submitted: 0, pending: 0, overdue: 0, total: 0 }, 0, 0);
    return ok({ unit: row }, { status: 201 });
  });
}
