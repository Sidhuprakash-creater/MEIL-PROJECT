import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAuthAudit as logAudit } from "@/lib/auth-audit";
import { roleLabel } from "@/lib/platform-config";
import { clientIp } from "@/lib/session";
import { findUserByIdentifier } from "@/lib/auth/user-lookup";
import {
  createResetTokenPair,
  findGoverningAdminsForUser,
} from "@/lib/auth/password-reset";
import {
  getAppOrigin,
  isEmailConfigured,
  sendPasswordResetAdminAlertEmail,
  sendPasswordResetLinkEmail,
} from "@/lib/notify/email";

export const dynamic = "force-dynamic";

const GENERIC_RESPONSE =
  "If an active account matches that ID or email, a recovery request has been queued for administrator approval and reset instructions have been dispatched to your registered email.";

export async function POST(request: Request) {
  let identifier = "";
  let portal = "gateway";
  let reason = "";
  try {
    const body = await request.json();
    identifier = String(body.employeeId ?? body.identifier ?? "").trim();
    portal = String(body.portal ?? "gateway").trim() || "gateway";
    reason = String(body.reason ?? "").trim().slice(0, 280);
  } catch {
    /* treated as empty below */
  }

  if (!identifier) {
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION",
        message: "Enter your Employee ID / User ID or email first.",
      },
      { status: 400 }
    );
  }

  const ip = clientIp(request.headers);
  const userAgent = request.headers.get("user-agent") ?? undefined;
  const origin = getAppOrigin(new URL(request.url).origin);

  const user = await findUserByIdentifier(identifier);

  if (!user || user.status === "SUSPENDED" || user.status === "INACTIVE") {
    await logAudit({
      eventType: "PASSWORD_RESET_REQUESTED",
      result: user ? "FAILURE" : "INFO",
      employeeId: identifier,
      userId: user?.id,
      portal,
      reason: user ? `status=${user.status}` : "UNKNOWN_IDENTIFIER",
      ip,
      userAgent,
    });
    return NextResponse.json({ ok: true, message: GENERIC_RESPONSE });
  }

  // Throttle repeated pending requests for the same user within 3 minutes
  const recentPending = await db.passwordResetRequest.findFirst({
    where: {
      userId: user.id,
      status: { in: ["PENDING_ADMIN", "EMAIL_TOKEN_SENT"] },
      createdAt: { gt: new Date(Date.now() - 3 * 60 * 1000) },
    },
    select: { id: true },
  });

  if (recentPending) {
    return NextResponse.json({ ok: true, message: GENERIC_RESPONSE });
  }

  // Expire older uncompleted requests for clean state
  await db.passwordResetRequest.updateMany({
    where: {
      userId: user.id,
      status: { in: ["PENDING_ADMIN", "EMAIL_TOKEN_SENT"] },
    },
    data: { status: "EXPIRED" },
  });

  let status = "PENDING_ADMIN";
  let tokenHash: string | null = null;
  let expiresAt: Date | null = null;

  if (isEmailConfigured() && user.email) {
    const pair = createResetTokenPair(15);
    tokenHash = pair.tokenHash;
    expiresAt = pair.expiresAt;
    const resetUrl = `${origin}/?resetToken=${encodeURIComponent(pair.rawToken)}`;
    const linkEmail = await sendPasswordResetLinkEmail({
      to: user.email,
      name: user.name,
      resetUrl,
    });
    if (linkEmail.sent) {
      status = "EMAIL_TOKEN_SENT";
    }
  }

  const resetRecord = await db.passwordResetRequest.create({
    data: {
      userId: user.id,
      requestedIdentifier: identifier,
      portal,
      reason,
      status,
      tokenHash,
      expiresAt,
      ip,
      userAgent,
    },
  });

  // Notify governing administrators in-app + via Resend
  const admins = await findGoverningAdminsForUser({
    id: user.id,
    role: user.role,
    subsidiaryId: user.subsidiaryId,
    businessUnitId: user.businessUnitId,
    projectId: user.projectId,
  });

  await db.notification.create({
    data: {
      ntype: "APPROVAL",
      title: `Password reset requested: ${user.name}`,
      body: `${user.name} (${roleLabel(user.role)}, ${user.employeeId ?? user.email}) submitted a password reset request from ${portal}. Review in User Management.`,
      severity: "WARNING",
      linkView: "users",
      refId: resetRecord.id,
      subsidiaryId: user.subsidiaryId,
    },
  });

  if (admins.length > 0) {
    await sendPasswordResetAdminAlertEmail({
      adminEmails: admins.map((a) => a.email),
      requesterName: user.name,
      requesterEmail: user.email,
      requesterRoleLabel: roleLabel(user.role),
      employeeId: user.employeeId,
      portal,
      reason,
      origin,
    });
  }

  await logAudit({
    eventType: "PASSWORD_RESET_REQUESTED",
    result: "INFO",
    employeeId: user.employeeId ?? user.email,
    userId: user.id,
    portal,
    role: user.role,
    detail: `requestId=${resetRecord.id} status=${status}`,
    ip,
    userAgent,
  });

  return NextResponse.json({ ok: true, message: GENERIC_RESPONSE });
}
