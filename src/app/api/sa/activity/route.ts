import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { saHandle, requireSubsidiaryAdmin, getSubsidiaryOrThrow } from "@/lib/sa/server";
import type { ActivityRow } from "@/lib/sa/types";

export const dynamic = "force-dynamic";

/* GET /api/sa/activity?q=&action=&user=&days=30 — operational activity feed
   for the subsidiary (orgLabel == subsidiary name), newest first, top 100. */

export async function GET(req: NextRequest) {
  return saHandle(async () => {
    const ctx = await requireSubsidiaryAdmin();
    const sub = await getSubsidiaryOrThrow(ctx.subsidiaryId);
    const sp = req.nextUrl.searchParams;
    const q = (sp.get("q") ?? "").trim().toLowerCase();
    const action = (sp.get("action") ?? "").trim();
    const user = (sp.get("user") ?? "").trim();
    const daysRaw = Number(sp.get("days") ?? 30);
    const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.min(daysRaw, 365) : 30;
    const since = new Date(Date.now() - days * 86400000);

    let events = await db.activityEvent.findMany({
      where: { orgLabel: sub.name, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    if (q) {
      events = events.filter((e) =>
        `${e.actorName} ${e.action} ${e.targetType} ${e.targetLabel}`.toLowerCase().includes(q)
      );
    }
    if (action && action !== "ALL") events = events.filter((e) => e.action.toLowerCase() === action.toLowerCase());
    if (user && user !== "ALL") events = events.filter((e) => e.actorName.toLowerCase() === user.toLowerCase());

    const rows: ActivityRow[] = events.slice(0, 100).map((e) => ({
      id: e.id,
      actorName: e.actorName,
      actorRole: e.actorRole,
      action: e.action,
      targetType: e.targetType,
      targetLabel: e.targetLabel,
      orgLabel: e.orgLabel,
      severity: e.severity,
      createdAt: e.createdAt.toISOString(),
    }));
    return ok({ events: rows });
  });
}
