import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { smHandle, requireSubsidiaryManager } from "@/lib/sm/server";

export const dynamic = "force-dynamic";

/** Lightweight liveness probe — the shell polls this to drive the Live badge,
 *  the unread bell count and the sidebar Review-Queue counter. */
export async function GET() {
  return smHandle(async () => {
    const ctx = await requireSubsidiaryManager();
    const [subMax, notifMax, submissionMax, unread, queue, buFinalReports, projectReports] = await Promise.all([
      db.submission.findFirst({ where: { subsidiaryId: ctx.subsidiaryId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      db.notification.findFirst({ where: { OR: [{ subsidiaryId: ctx.subsidiaryId }, { subsidiaryId: null }] }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      db.submission.findFirst({ where: { subsidiaryId: ctx.subsidiaryId }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
      db.notification.count({ where: { AND: [{ read: false }, { OR: [{ subsidiaryId: ctx.subsidiaryId }, { subsidiaryId: null }] }] } }),
      db.submission.count({ where: { subsidiaryId: ctx.subsidiaryId, status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }),
      /* Final consolidated reports the business units of this subsidiary have
         sent up (BU Manager → Subsidiary Manager) and that still await the
         manager's decision. Drives the sidebar badge on the BU / Business
         Unit report views. */
      db.report.count({
        where: {
          scopeType: "SUBSIDIARY",
          scopeId: ctx.subsidiaryId,
          status: { in: ["SUBMITTED", "UNDER_REVIEW"] },
        },
      }),
      /* Project-level reports the BU Manager signed off (BU_APPROVED) and
         that now await this manager's approval. */
      db.submission.count({
        where: {
          subsidiaryId: ctx.subsidiaryId,
          projectId: { not: null },
          status: "BU_APPROVED",
        },
      }),
    ]);
    const t = (d: Date | null) => (d ? d.getTime() : 0);
    return ok({
      version: `${t(subMax?.createdAt ?? null)}-${t(notifMax?.createdAt ?? null)}-${t(submissionMax?.updatedAt ?? null)}`,
      at: new Date().toISOString(),
      unread,
      queueCount: queue,
      buFinalReportsCount: buFinalReports,
      projectReportsCount: projectReports,
    });
  });
}
