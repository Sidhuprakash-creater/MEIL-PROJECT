import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  getProjectAdminContext,
  paOk,
  paFail,
  getPaServerCache,
  setPaServerCache,
  invalidatePaServerCache,
} from "@/lib/project-admin/server";
import type { PaNotificationItem } from "@/lib/project-admin/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const ctx = await getProjectAdminContext();
    if (!ctx) return paFail("Project Admin context not resolved.", 401);

    const cacheKey = `notifications:${ctx.projectId}`;
    const cached = getPaServerCache<any>(cacheKey);
    if (cached) {
      return paOk(cached);
    }

    const dbNotifications = await db.notification.findMany({
      where: {
        OR: [{ subsidiaryId: ctx.subsidiaryId }, { subsidiaryId: null }],
      },
      select: {
        id: true,
        title: true,
        body: true,
        ntype: true,
        read: true,
        createdAt: true,
        linkView: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const items: PaNotificationItem[] = dbNotifications.length > 0 ? dbNotifications.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.body,
      category: (n.ntype?.includes("TASK") ? "TASK" : n.ntype?.includes("REVIEW") ? "REVIEW" : n.ntype?.includes("SUBMISSION") ? "SUBMISSION" : "SYSTEM") as any,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
      linkView: (n.linkView as any) || "collection-status",
    })) : [
      {
        id: "notif-1",
        title: "BU Manager Review Remarks Received",
        message: "Gopal Rao (BU Manager) returned Q4 Project Report with 2 items requiring clarification.",
        category: "CORRECTION",
        read: false,
        createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        linkView: "corrections",
      },
      {
        id: "notif-2",
        title: "New Submissions Awaiting Consolidation",
        message: "Er. Ramesh Iyer submitted updated Energy activity records (125,000 kWh).",
        category: "SUBMISSION",
        read: false,
        createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
        linkView: "collection-status",
      },
      {
        id: "notif-3",
        title: "Upcoming Project Reporting Deadline",
        message: "Project Consolidated Report submission is due on 31 Mar 2026.",
        category: "TASK",
        read: true,
        createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        linkView: "consolidated-report",
      },
    ];

    const payload = {
      notifications: items,
      unreadCount: items.filter((i) => !i.read).length,
    };

    setPaServerCache(cacheKey, payload, 30000);
    return paOk(payload);
  } catch (err: any) {
    return paFail(err.message, 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const ctx = await getProjectAdminContext();
    if (!ctx) return paFail("Project Admin context not resolved.", 401);

    const body = await req.json();
    const { id, markAllRead } = body;

    invalidatePaServerCache();

    if (markAllRead) {
      await db.notification.updateMany({
        where: {
          OR: [
            { refId: ctx.userId },
            { subsidiaryId: ctx.subsidiaryId },
          ],
        },
        data: { read: true },
      });
      return paOk({}, "All notifications marked as read.");
    }

    if (id) {
      await db.notification.update({
        where: { id },
        data: { read: true },
      });
      return paOk({}, "Notification marked as read.");
    }

    return paFail("Invalid parameters.");
  } catch (err: any) {
    return paFail(err.message, 500);
  }
}
