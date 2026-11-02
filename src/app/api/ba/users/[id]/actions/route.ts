import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import {
  BaError, baHandle, requireBuAdmin, getBuOrThrow, assertUserInBuScope,
  baLogActivity, baLogAudit, baNotify,
} from "@/lib/ba/server";
import { ROLE_LABELS } from "@/lib/ba/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  return baHandle(async () => {
    const ctx = await requireBuAdmin();
    const { id } = await params;
    const bu = await getBuOrThrow(ctx.businessUnitId);
    const user = await assertUserInBuScope(id, ctx.businessUnitId);
    const body = (await req.json().catch(() => ({}))) as { action?: string };
    const action = body.action ?? "";

    if (action === "resend_invite") {
      if (user.status !== "INVITED") throw new BaError("Only invited accounts can be re-sent an invitation.", 400);
      await baNotify({
        ntype: "SYSTEM", title: "Invitation reminder sent",
        body: `A reminder invitation was sent to ${user.name} (${ROLE_LABELS[user.role]}).`,
        severity: "INFO", linkView: "users", refId: id,
      });
      await baLogActivity(ctx, bu.name, { action: "INVITE_RESEND", targetType: "User", targetLabel: user.name });
      await baLogAudit(ctx, bu.code, { action: "INVITE_RESEND", targetType: "User", targetId: id, targetLabel: user.name });
      return ok({ ok: true, status: user.status });
    }

    const statusMap: Record<string, string> = { deactivate: "INACTIVE", reactivate: "ACTIVE" };
    if (!statusMap[action]) throw new BaError("Unknown action. Use resend_invite | deactivate | reactivate.", 400);
    if (id === ctx.userId) throw new BaError("You cannot change your own account status.", 403);

    const updated = await db.user.update({ where: { id }, data: { status: statusMap[action] } });
    if (action === "deactivate") {
      await db.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    await baLogActivity(ctx, bu.name, { action: "ACCOUNT_UPDATE", targetType: "User", targetLabel: `${updated.name} → ${updated.status}`, severity: action === "reactivate" ? "INFO" : "WARNING" });
    await baLogAudit(ctx, bu.code, { action: "ACCOUNT_STATUS", targetType: "User", targetId: id, targetLabel: updated.name, before: { status: user.status }, after: { status: updated.status } });
    if (action === "deactivate") {
      await baNotify({ ntype: "SYSTEM", title: "Account deactivated", body: `${updated.name}'s account was deactivated by ${ctx.name}.`, severity: "WARNING", linkView: "users", refId: id });
    }
    return ok({ ok: true, status: updated.status });
  });
}
