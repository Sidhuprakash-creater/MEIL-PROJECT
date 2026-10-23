import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { saHandle, requireSubsidiaryAdmin } from "@/lib/sa/server";

export const dynamic = "force-dynamic";

/** Lightweight liveness probe — the shell polls this to drive the Live badge. */
export async function GET() {
  return saHandle(async () => {
    const ctx = await requireSubsidiaryAdmin();
    const [subMax, notifMax, unitMax, unread] = await Promise.all([
      db.submission.findFirst({ where: { subsidiaryId: ctx.subsidiaryId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      db.notification.findFirst({ where: { OR: [{ subsidiaryId: ctx.subsidiaryId }, { subsidiaryId: null }] }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      db.businessUnit.findFirst({ where: { subsidiaryId: ctx.subsidiaryId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      db.notification.count({ where: { AND: [{ read: false }, { OR: [{ subsidiaryId: ctx.subsidiaryId }, { subsidiaryId: null }] }] } }),
    ]);
    const t = (d: Date | null) => (d ? d.getTime() : 0);
    return ok({
      version: `${t(subMax?.createdAt ?? null)}-${t(notifMax?.createdAt ?? null)}-${t(unitMax?.createdAt ?? null)}`,
      at: new Date().toISOString(),
      unread,
    });
  });
}
