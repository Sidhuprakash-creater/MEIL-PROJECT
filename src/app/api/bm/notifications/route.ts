import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { bmHandle, requireBuManager } from "@/lib/bm/server";
import type { SaNotification } from "@/lib/bm/types";

export const dynamic = "force-dynamic";

/* BU Manager notifications include:
   · null-scope (broadcast) rows — written by bmNotify, fired on every
     BU Manager decision → visible on all 5 consoles
   · subsidiary-scoped rows when this BU's subsidiaryId matches the row
   (there are no BU-scoped notifications today; the manager inherits the
   broadcast feed + parent-subsidiary feed)
*/
const SCOPE = (subsidiaryId: string) => ({
  OR: [{ subsidiaryId: null }, { subsidiaryId }],
});

/* GET /api/bm/notifications?filter=all|unread&category=&days=&limit= */
export async function GET(req: NextRequest) {
  return bmHandle(async () => {
    const ctx = await requireBuManager();
    const sp = req.nextUrl.searchParams;
    const filter = sp.get("filter") ?? "all";
    const category = sp.get("category");
    const days = Number(sp.get("days") ?? 0);
    const limit = Math.min(Number(sp.get("limit") ?? 50), 100);

    const where: Record<string, unknown> = { AND: [SCOPE(ctx.subsidiaryId)] };
    if (filter === "unread") (where.AND as Record<string, unknown>[]).push({ read: false });
    if (category) (where.AND as Record<string, unknown>[]).push({ ntype: category });
    if (days > 0) (where.AND as Record<string, unknown>[]).push({ createdAt: { gte: new Date(Date.now() - days * 86400000) } });

    const [rows, unread] = await Promise.all([
      db.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: limit }),
      db.notification.count({ where: { AND: [SCOPE(ctx.subsidiaryId), { read: false }] } }),
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

/* PATCH — mark read/unread: { ids?: string[], all?: boolean, read?: boolean } */
export async function PATCH(req: NextRequest) {
  return bmHandle(async () => {
    const ctx = await requireBuManager();
    const body = (await req.json().catch(() => ({}))) as { ids?: string[]; all?: boolean; read?: boolean };
    const read = body.read ?? true;

    if (body.all) {
      const res = await db.notification.updateMany({
        where: { AND: [SCOPE(ctx.subsidiaryId), { read: !read }] },
        data: { read },
      });
      return ok({ updated: res.count });
    }
    if (Array.isArray(body.ids) && body.ids.length) {
      const owned = await db.notification.findMany({
        where: { AND: [SCOPE(ctx.subsidiaryId), { id: { in: body.ids } }] },
        select: { id: true },
      });
      const res = await db.notification.updateMany({
        where: { id: { in: owned.map((o) => o.id) } },
        data: { read },
      });
      return ok({ updated: res.count });
    }
    return ok({ updated: 0 });
  });
}
