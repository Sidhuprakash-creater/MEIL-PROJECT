import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handle, ok, fail, body, logAudit, ACTOR } from "@/lib/esg/server";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "100", 10);
    const [notifications, unread] = await Promise.all([
      db.notification.findMany({ orderBy: { createdAt: "desc" }, take: limit }),
      db.notification.count({ where: { read: false } }),
    ]);
    return ok({
      notifications: notifications.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })),
      unread,
    });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const b = await body<{ action: string; id?: string }>(req);
    if (b.action === "read" && b.id) {
      await db.notification.update({ where: { id: b.id }, data: { read: true } });
      return ok({ success: true });
    }
    if (b.action === "unread" && b.id) {
      await db.notification.update({ where: { id: b.id }, data: { read: false } });
      return ok({ success: true });
    }
    if (b.action === "read-all") {
      await db.notification.updateMany({ where: { read: false }, data: { read: true } });
      await logAudit({ actorName: ACTOR.name, action: "NOTIFICATIONS_READ_ALL", targetType: "Notification", targetLabel: "All notifications marked read" });
      return ok({ success: true });
    }
    if (b.action === "dismiss" && b.id) {
      await db.notification.delete({ where: { id: b.id } });
      return ok({ success: true });
    }
    return fail("Unknown notification action.");
  });
}
