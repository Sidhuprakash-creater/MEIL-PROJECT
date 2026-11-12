import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import {
  BaError, baHandle, requireBuAdmin, getBuOrThrow, assertUserInBuScope,
  baLogActivity, baLogAudit, baNotify, ROLE_LABELS,
} from "@/lib/ba/server";
import { generateTempPassword, hashPassword } from "@/lib/password";
import { invalidateAllAuthCaches, revokeUserSessions } from "@/lib/auth/session-utils";
import { createResetTokenPair } from "@/lib/auth/password-reset";
import { getAppOrigin, sendPasswordResetLinkEmail } from "@/lib/notify/email";

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

    if (action === "reset-credential") {
      if (id === ctx.userId) {
        throw new BaError("Use your own profile settings to rotate your password.", 403);
      }
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
            portal: "business_unit",
            reason: "BU Admin credential reset",
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

      await baLogActivity(ctx, bu.name, { action: "CREDENTIAL_RESET", targetType: "User", targetLabel: user.name, severity: "WARNING" });
      await baLogAudit(ctx, bu.code, { action: "PASSWORD_RESET", targetType: "User", targetId: id, targetLabel: user.name, reason: "BU Admin credential recovery" });
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

    const statusMap: Record<string, string> = { deactivate: "INACTIVE", suspend: "SUSPENDED", reactivate: "ACTIVE" };
    if (!statusMap[action]) throw new BaError("Unknown action. Use resend_invite | deactivate | suspend | reactivate | reset-credential.", 400);
    if (id === ctx.userId) throw new BaError("You cannot change your own account status.", 403);

    const updated = await db.user.update({ where: { id }, data: { status: statusMap[action] } });
    if (action !== "reactivate") {
      await revokeUserSessions(id);
    } else {
      invalidateAllAuthCaches(id);
    }
    await baLogActivity(ctx, bu.name, { action: "ACCOUNT_UPDATE", targetType: "User", targetLabel: `${updated.name} → ${updated.status}`, severity: action === "reactivate" ? "INFO" : "WARNING" });
    await baLogAudit(ctx, bu.code, { action: "ACCOUNT_STATUS", targetType: "User", targetId: id, targetLabel: updated.name, before: { status: user.status }, after: { status: updated.status } });
    if (action !== "reactivate") {
      await baNotify({ ntype: "SYSTEM", title: "Account updated", body: `${updated.name}'s account was set to ${updated.status} by ${ctx.name}.`, severity: "WARNING", linkView: "users", refId: id });
    }
    return ok({ ok: true, status: updated.status });
  });
}
