import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import {
  SaError, saHandle, requireSubsidiaryAdmin, getSubsidiaryOrThrow, assertUserInScope,
  saLogActivity, saLogAudit,
} from "@/lib/sa/server";
import { generateTempPassword, hashPassword } from "@/lib/password";
import { invalidateAllAuthCaches, revokeUserSessions } from "@/lib/auth/session-utils";
import { createResetTokenPair } from "@/lib/auth/password-reset";
import { getAppOrigin, sendPasswordResetLinkEmail } from "@/lib/notify/email";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

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
      const pwd = generateTempPassword(12);
      const passwordHash = await hashPassword(pwd);
      const { rawToken, tokenHash, expiresAt } = createResetTokenPair(15);
      const origin = getAppOrigin(new URL(req.url).origin);
      const resetUrl = `${origin}/?resetToken=${encodeURIComponent(rawToken)}`;
      const nextProvider = user.googleSub || user.googleEmail ? "BOTH" : "CREDENTIALS";

      await db.$transaction([
        db.user.update({
          where: { id },
          data: {
            passwordHash,
            mustChangePassword: true,
            authProvider: nextProvider,
            status: user.status === "INVITED" ? "ACTIVE" : user.status,
          },
        }),
        db.passwordResetRequest.create({
          data: {
            userId: id,
            requestedIdentifier: user.employeeId ?? user.email,
            portal: "subsidiary",
            reason: "Subsidiary Admin credential reset",
            status: "APPROVED_TEMP",
            approverId: ctx.userId,
            approverRole: ctx.role,
            tokenHash,
            expiresAt,
            reviewedAt: new Date(),
          },
        }),
      ]);

      await revokeUserSessions(id);
      const emailResult = await sendPasswordResetLinkEmail({
        to: user.email,
        name: user.name,
        resetUrl,
        tempPassword: pwd,
        approvedByName: ctx.name,
      });

      await saLogActivity(ctx, sub.name, { action: "CREDENTIAL_RESET", targetType: "User", targetLabel: user.name, severity: "WARNING" });
      await saLogAudit(ctx, sub.code, { action: "PASSWORD_RESET", targetType: "User", targetId: id, targetLabel: user.name, reason: "Admin-initiated secure credential recovery" });
      return ok(
        {
          tempPassword: pwd,
          resetUrl,
          emailSent: emailResult.sent,
          emailNote: emailResult.reason,
          note: "Share this one-time password through your secure channel. The user must change it after signing in.",
        },
        { status: 201 }
      );
    }

    const statusMap: Record<string, string> = { suspend: "SUSPENDED", activate: "ACTIVE", deactivate: "INACTIVE" };
    if (!statusMap[action]) throw new SaError("Unknown action. Use suspend | activate | deactivate | reset-credential.", 400);
    if (id === ctx.userId) throw new SaError("You cannot change your own account status.", 403);

    const updated = await db.user.update({ where: { id }, data: { status: statusMap[action] } });
    if (action !== "activate") {
      await revokeUserSessions(id);
    } else {
      invalidateAllAuthCaches(id);
    }
    await saLogActivity(ctx, sub.name, { action: "ACCOUNT_UPDATE", targetType: "User", targetLabel: `${updated.name} → ${updated.status}`, severity: action === "activate" ? "INFO" : "WARNING" });
    await saLogAudit(ctx, sub.code, { action: "ACCOUNT_STATUS", targetType: "User", targetId: id, targetLabel: updated.name, before: { status: user.status }, after: { status: updated.status } });
    return ok({ ok: true, status: updated.status });
  });
}
