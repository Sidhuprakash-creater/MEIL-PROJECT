import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import {
  SaError, saHandle, requireSubsidiaryAdmin, getSubsidiaryOrThrow, assertUserInScope,
  saLogActivity, saLogAudit,
} from "@/lib/sa/server";
import { hashPassword } from "@/lib/password";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function tempPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(12);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("") + "!7";
}

export async function POST(req: NextRequest, { params }: Params) {
  return saHandle(async () => {
    const ctx = await requireSubsidiaryAdmin();
    const { id } = await params;
    const sub = await getSubsidiaryOrThrow(ctx.subsidiaryId);
    const user = await assertUserInScope(id, ctx.subsidiaryId);
    const body = (await req.json().catch(() => ({}))) as { action?: string };
    const action = body.action ?? "";

    if (action === "reset-credential") {
      if (id === ctx.userId) throw new SaError("Use your own profile security page to reset your password.", 403);
      const pwd = tempPassword();
      const passwordHash = await hashPassword(pwd);
      await db.user.update({ where: { id }, data: { passwordHash, status: user.status === "INVITED" ? "ACTIVE" : user.status } });
      await db.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      await saLogActivity(ctx, sub.name, { action: "CREDENTIAL_RESET", targetType: "User", targetLabel: user.name, severity: "WARNING" });
      await saLogAudit(ctx, sub.code, { action: "PASSWORD_RESET", targetType: "User", targetId: id, targetLabel: user.name, reason: "Admin-initiated secure credential recovery" });
      return ok({ tempPassword: pwd, note: "Share this one-time password through your secure channel. The user must change it after signing in." }, { status: 201 });
    }

    const statusMap: Record<string, string> = { suspend: "SUSPENDED", activate: "ACTIVE", deactivate: "INACTIVE" };
    if (!statusMap[action]) throw new SaError("Unknown action. Use suspend | activate | deactivate | reset-credential.", 400);
    if (id === ctx.userId) throw new SaError("You cannot change your own account status.", 403);

    const updated = await db.user.update({ where: { id }, data: { status: statusMap[action] } });
    if (action !== "activate") {
      await db.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    await saLogActivity(ctx, sub.name, { action: "ACCOUNT_UPDATE", targetType: "User", targetLabel: `${updated.name} → ${updated.status}`, severity: action === "activate" ? "INFO" : "WARNING" });
    await saLogAudit(ctx, sub.code, { action: "ACCOUNT_STATUS", targetType: "User", targetId: id, targetLabel: updated.name, before: { status: user.status }, after: { status: updated.status } });
    return ok({ ok: true, status: updated.status });
  });
}
