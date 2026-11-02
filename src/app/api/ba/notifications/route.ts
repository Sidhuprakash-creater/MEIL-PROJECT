import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { baHandle, requireBuAdmin } from "@/lib/ba/server";
import type { SaNotification } from "@/lib/ba/types";

export const dynamic = "force-dynamic";

/* All notifications are broadcast (subsidiaryId = null) — the BU Admin bell
   mirrors the Group/Subsidiary/BU Manager bells (cross-console sync). */
const SCOPE = () => ({});

export async function GET(req: NextRequest) {
  return baHandle(async () => {
    const ctx = await requireBuAdmin();
    void ctx;
    const sp = req.nextUrl.searchParams;
    const filter = sp.get("filter") ?? "all";
    const category = sp.get("category");
    const days = Number(sp.get("days") ?? 0);
    const limit = Math.min(Number(sp.get("limit") ?? 50), 100);

    const where: Record<string, unknown> = {};
    if (filter === "unread") where.read = false;
    if (category) where.ntype = category;
    if (days > 0) where.createdAt = { gte: new Date(Date.now() - days * 86400000) };

    const [rows, unread] = await Promise.all([
      db.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: limit }),
      db.notification.count({ where: { read: false } }),
    ]);

    const notifications: SaNotification[] = rows.map((n) => ({
      id: n.id, ntype: n.ntype, title: n.title, body: n.body, severity: n.severity,
      read: n.read, linkView: n.linkView, refId: n.refId,
      createdAt: n.createdAt.toISOString(),
      origin: n.subsidiaryId === null ? "group" : "subsidiary",
    }));
    return ok({ notifications, unread });
  });
}

export async function PATCH(req: NextRequest) {
  return baHandle(async () => {
    const ctx = await requireBuAdmin();
    void ctx;
    const body = (await req.json().catch(() => ({}))) as { ids?: string; id?: string; read?: boolean };
    const read = body.read ?? true;
    const targetId = body.id ?? body.ids;
    if (targetId) {
      const res = await db.notification.updateMany({ where: { id: targetId }, data: { read } });
      return ok({ updated: res.count });
    }
    return ok({ updated: 0 });
  });
}
