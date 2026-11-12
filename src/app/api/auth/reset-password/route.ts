import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { clientIp } from "@/lib/session";
import { logAuthAudit as logAudit } from "@/lib/auth-audit";
import { revokeUserSessions } from "@/lib/auth/session-utils";
import { hashResetToken } from "@/lib/auth/password-reset";

export const dynamic = "force-dynamic";

/** POST /api/auth/reset-password — Consumes a 15-minute single-use email token to set a new password. */
export async function POST(request: Request) {
  const ip = clientIp(request.headers);
  const userAgent = request.headers.get("user-agent") ?? undefined;

  let body: { token?: string; newPassword?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Malformed request body." },
      { status: 400 }
    );
  }

  const rawToken = String(body.token ?? "").trim();
  const newPassword = String(body.newPassword ?? "");

  if (!rawToken || newPassword.length < 8) {
    return NextResponse.json(
      {
        ok: false,
        message: "A valid reset token and a new password (min 8 characters) are required.",
      },
      { status: 400 }
    );
  }

  const tokenHash = hashResetToken(rawToken);
  const resetReq = await db.passwordResetRequest.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (
    !resetReq ||
    !resetReq.expiresAt ||
    resetReq.expiresAt < new Date() ||
    resetReq.status === "COMPLETED" ||
    resetReq.status === "REJECTED" ||
    resetReq.status === "EXPIRED"
  ) {
    return NextResponse.json(
      {
        ok: false,
        message: "This reset link is invalid, already used, or expired. Submit a new forgot-password request.",
      },
      { status: 400 }
    );
  }

  if (resetReq.user.status === "SUSPENDED" || resetReq.user.status === "INACTIVE") {
    return NextResponse.json(
      {
        ok: false,
        message: "This account is suspended or inactive. Contact your Group ESG Administrator.",
      },
      { status: 403 }
    );
  }

  const nextHash = await hashPassword(newPassword);
  const nextProvider = resetReq.user.googleSub || resetReq.user.googleEmail ? "BOTH" : "CREDENTIALS";

  await db.$transaction([
    db.user.update({
      where: { id: resetReq.userId },
      data: {
        passwordHash: nextHash,
        mustChangePassword: false,
        authProvider: nextProvider,
        status: "ACTIVE",
        emailVerifiedAt: resetReq.user.emailVerifiedAt ?? new Date(),
      },
    }),
    db.passwordResetRequest.update({
      where: { id: resetReq.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    }),
  ]);

  await revokeUserSessions(resetReq.userId);

  await logAudit({
    eventType: "PASSWORD_RESET_COMPLETED",
    result: "SUCCESS",
    employeeId: resetReq.user.employeeId ?? resetReq.user.email,
    userId: resetReq.userId,
    role: resetReq.user.role,
    ip,
    userAgent,
  });

  return NextResponse.json({
    ok: true,
    message: "Your password has been updated. You can now sign in with your new password.",
  });
}

