import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { baHandle, requireBuAdmin } from "@/lib/ba/server";

export const dynamic = "force-dynamic";

/** Lightweight liveness probe — drives the Live badge + unread count.
 *  Polls every 5s from the shell. Mirrors /api/sa/pulse shape but scoped to
 *  the BU (submission + notification + timeline + evidence latest). */
export async function GET() {
  return baHandle(async () => {
    const ctx = await requireBuAdmin();
    const [subMax, notifMax, tlMax, evMax, taskMax, unread] = await Promise.all([
      db.submission.findFirst({ where: { businessUnitId: ctx.businessUnitId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      db.notification.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      db.reportingTimeline.findFirst({ where: { businessUnitId: ctx.businessUnitId }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
      db.evidenceDoc.findFirst({ where: { businessUnitId: ctx.businessUnitId }, orderBy: { uploadedAt: "desc" }, select: { uploadedAt: true } }),
      db.task.findFirst({ where: { businessUnitId: ctx.businessUnitId }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
      db.notification.count({ where: { read: false } }),
    ]);
    const t = (d: Date | null) => (d ? d.getTime() : 0);
    return ok({
      version: `${t(subMax?.createdAt ?? null)}-${t(notifMax?.createdAt ?? null)}-${t(tlMax?.updatedAt ?? null)}-${t(evMax?.uploadedAt ?? null)}-${t(taskMax?.updatedAt ?? null)}`,
      at: new Date().toISOString(),
      unread,
      queueCount: 0,
    });
  });
}
