import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { smHandle, requireSubsidiaryManager, getSubsidiaryOrThrow } from "@/lib/sm/server";
import type { ActivityRow, AuditRow } from "@/lib/sm/types";

export const dynamic = "force-dynamic";

/* GET /api/sm/activity?q=&action=&days=30        — operational activity feed
   GET /api/sm/activity?trail=audit&q=&outcome=&days=90 — authoritative audit trail
   Activity: events touching this subsidiary (orgLabel == subsidiary name).
   Audit:    append-only decision trail (orgScope == subsidiary code). */

export async function GET(req: NextRequest) {
  return smHandle(async () => {
    const ctx = await requireSubsidiaryManager();
    const sub = await getSubsidiaryOrThrow(ctx.subsidiaryId);
    const sp = req.nextUrl.searchParams;
    const trail = sp.get("trail") === "audit" ? "audit" : "activity";
    const q = (sp.get("q") ?? "").trim().toLowerCase();
    const action = (sp.get("action") ?? "").trim();
    const user = (sp.get("user") ?? "").trim();
    const outcome = (sp.get("outcome") ?? "").trim();
    const daysRaw = Number(sp.get("days") ?? (trail === "audit" ? 90 : 30));
    const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.min(daysRaw, 365) : trail === "audit" ? 90 : 30;
    const since = new Date(Date.now() - days * 86400000);

    if (trail === "audit") {
      let events = await db.auditEvent.findMany({
        where: { orgScope: sub.code, createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      if (q) events = events.filter((e) => `${e.actorName} ${e.action} ${e.targetType} ${e.targetLabel} ${e.reason} ${e.correlation}`.toLowerCase().includes(q));
      if (outcome && outcome !== "ALL") events = events.filter((e) => e.outcome === outcome);
      const rows: AuditRow[] = events.slice(0, 100).map((e) => ({
        id: e.id,
        actorName: e.actorName,
        actorRole: e.actorRole,
        action: e.action,
        targetType: e.targetType,
        targetLabel: e.targetLabel,
        orgScope: e.orgScope,
        reason: e.reason,
        outcome: e.outcome,
        correlation: e.correlation,
        createdAt: e.createdAt.toISOString(),
      }));
      return ok({ rows });
    }

    let events = await db.activityEvent.findMany({
      where: { orgLabel: sub.name, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    if (q) events = events.filter((e) => `${e.actorName} ${e.action} ${e.targetType} ${e.targetLabel}`.toLowerCase().includes(q));
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
    return ok({ rows });
  });
}
