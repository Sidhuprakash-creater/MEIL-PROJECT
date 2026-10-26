import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { bmHandle, requireBuManager } from "@/lib/bm/server";

export const dynamic = "force-dynamic";

/** Lightweight liveness probe — the shell polls this every 5s to drive the
 *  Live badge, the unread bell count and the sidebar Review-Queue counter.
 *  All counts are scoped to the manager's assigned BU. */
export async function GET() {
  return bmHandle(async () => {
    const ctx = await requireBuManager();
    const [subMax, notifMax, submissionMax, unread, queue] = await Promise.all([
      db.submission.findFirst({
        where: { businessUnitId: ctx.businessUnitId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      db.notification.findFirst({
        where: { OR: [{ subsidiaryId: null }, { subsidiaryId: ctx.subsidiaryId }] },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      db.submission.findFirst({
        where: { businessUnitId: ctx.businessUnitId },
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      }),
      db.notification.count({
        where: {
          AND: [
            { read: false },
            { OR: [{ subsidiaryId: null }, { subsidiaryId: ctx.subsidiaryId }] },
          ],
        },
      }),
      db.submission.count({
        where: {
          businessUnitId: ctx.businessUnitId,
          status: { in: ["SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED"] },
        },
      }),
    ]);
    const t = (d: Date | null) => (d ? d.getTime() : 0);
    return ok({
      version: `${t(subMax?.createdAt ?? null)}-${t(notifMax?.createdAt ?? null)}-${t(submissionMax?.updatedAt ?? null)}`,
      at: new Date().toISOString(),
      unread,
      queueCount: queue,
    });
  });
}
