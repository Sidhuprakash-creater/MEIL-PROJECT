import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { BmError, bmHandle, requireBuManager } from "@/lib/bm/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/* GET /api/bm/notifications/[id]?all=1 — when ?all=1, mark every visible
   notification as read (used by the "Mark all as read" button on the
   notifications view). Without ?all=1 it returns the single notification
   metadata (the manager has read-only view of the broadcast feed — marking
   read is done through the PATCH on the parent route). */
export async function GET(req: NextRequest, { params }: Params) {
  return bmHandle(async () => {
    const ctx = await requireBuManager();
    const { id } = await params;
    const sp = req.nextUrl.searchParams;
    if (sp.get("all") === "1") {
      const res = await db.notification.updateMany({
        where: {
          AND: [
            { read: false },
            { OR: [{ subsidiaryId: null }, { subsidiaryId: ctx.subsidiaryId }] },
          ],
        },
        data: { read: true },
      });
      return ok({ updated: res.count });
    }
    const n = await db.notification.findUnique({ where: { id } });
    if (!n) throw new BmError("Notification not found.", 404);
    const visible = n.subsidiaryId === null || n.subsidiaryId === ctx.subsidiaryId;
    if (!visible) throw new BmError("Notification not visible to your scope.", 403);
    return ok({
      notification: {
        id: n.id, ntype: n.ntype, title: n.title, body: n.body, severity: n.severity,
        read: n.read, linkView: n.linkView, refId: n.refId,
        createdAt: n.createdAt.toISOString(),
        origin: n.subsidiaryId === null ? "group" : "subsidiary",
      },
    });
  });
}

/* PATCH — flip a single notification's read state. */
export async function PATCH(req: NextRequest, { params }: Params) {
  return bmHandle(async () => {
    const ctx = await requireBuManager();
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { read?: boolean };
    const read = body.read ?? true;

    const n = await db.notification.findUnique({ where: { id } });
    if (!n) throw new BmError("Notification not found.", 404);
    const visible = n.subsidiaryId === null || n.subsidiaryId === ctx.subsidiaryId;
    if (!visible) throw new BmError("Notification not visible to your scope.", 403);

    await db.notification.update({ where: { id }, data: { read } });
    return ok({ updated: 1 });
  });
}

/* DELETE — mark-all-as-read shorthand: DELETE /api/bm/notifications/[id]?all=1
   marks every visible notification as read (used when the bell's "mark all"
   action needs a DELETE method). */
export async function DELETE(req: NextRequest, { params }: Params) {
  return bmHandle(async () => {
    const ctx = await requireBuManager();
    const { id } = await params;
    const sp = req.nextUrl.searchParams;
    if (sp.get("all") === "1") {
      const res = await db.notification.updateMany({
        where: {
          AND: [
            { read: false },
            { OR: [{ subsidiaryId: null }, { subsidiaryId: ctx.subsidiaryId }] },
          ],
        },
        data: { read: true },
      });
      return ok({ updated: res.count });
    }
    void id;
    return ok({ updated: 0 });
  });
}
