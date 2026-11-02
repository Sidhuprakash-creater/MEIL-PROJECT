import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { baHandle, requireBuAdmin } from "@/lib/ba/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/* PATCH /api/ba/notifications/[id]    — mark a single notification as read.
   DELETE /api/ba/notifications/[id]?all=1 — mark ALL notifications as read. */

export async function PATCH(_req: NextRequest, { params }: Params) {
  return baHandle(async () => {
    const ctx = await requireBuAdmin();
    void ctx;
    const { id } = await params;
    const res = await db.notification.updateMany({ where: { id }, data: { read: true } });
    return ok({ updated: res.count });
  });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  return baHandle(async () => {
    const ctx = await requireBuAdmin();
    void ctx;
    void params;
    const all = req.nextUrl.searchParams.get("all") === "1";
    if (!all) {
      return ok({ updated: 0 });
    }
    const res = await db.notification.updateMany({ where: { read: false }, data: { read: true } });
    return ok({ updated: res.count });
  });
}
