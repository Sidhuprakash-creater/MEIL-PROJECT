import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { bmHandle, requireBuManager, getBuOrThrow } from "@/lib/bm/server";
import type { AuditRow } from "@/lib/bm/types";

export const dynamic = "force-dynamic";

/* GET /api/bm/audit?q=&outcome=&days=90 — authoritative audit trail for the
   BU (orgScope == BU code), newest first, top 100. The audit trail is
   append-only: every review decision, evidence download and validation
   annotation is recorded here permanently. */
export async function GET(req: NextRequest) {
  return bmHandle(async () => {
    const ctx = await requireBuManager();
    const bu = await getBuOrThrow(ctx.businessUnitId);
    const sp = req.nextUrl.searchParams;
    const q = (sp.get("q") ?? "").trim().toLowerCase();
    const outcome = (sp.get("outcome") ?? "").trim();
    const daysRaw = Number(sp.get("days") ?? 90);
    const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.min(daysRaw, 365) : 90;
    const since = new Date(Date.now() - days * 86400000);

    let events = await db.auditEvent.findMany({
      where: { orgScope: bu.code, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    if (q) {
      events = events.filter((e) =>
        `${e.actorName} ${e.action} ${e.targetType} ${e.targetLabel} ${e.reason} ${e.correlation}`.toLowerCase().includes(q)
      );
    }
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
  });
}
