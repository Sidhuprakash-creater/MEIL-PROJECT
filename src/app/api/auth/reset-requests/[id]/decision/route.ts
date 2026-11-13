import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateTempPassword, hashPassword } from "@/lib/password";
import { clientIp, getSessionPayload } from "@/lib/session";
import { logAuthAudit as logAudit } from "@/lib/auth-audit";
import { revokeUserSessions } from "@/lib/auth/session-utils";
import {
  canAdminReviewResetRequest,
  createResetTokenPair,
} from "@/lib/auth/password-reset";
import {
  getAppOrigin,
  sendPasswordResetLinkEmail,
  sendPasswordResetRejectedEmail,
} from "@/lib/notify/email";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = new Set([
  "GROUP_ADMIN",
  "SUBSIDIARY_ADMIN",
  "BU_ADMIN",
  "PROJECT_ADMIN",
]);

/** POST /api/auth/reset-requests/[id]/decision — Governing admin approves (issues temp password + email link) or rejects. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const session = await getSessionPayload();
  if (!session?.authenticated || !session.user) {
    return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
  }
  if (!ADMIN_ROLES.has(session.user.role)) {
    return NextResponse.json({ ok: false, error: "Admin role required." }, { status: 403 });
  }

  let body: { decision?: "APPROVE" | "REJECT"; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Malformed request body." }, { status: 400 });
  }

  const decision = body.decision;
  if (decision !== "APPROVE" && decision !== "REJECT") {
    return NextResponse.json({ ok: false, error: "Decision must be APPROVE or REJECT." }, { status: 400 });
  }

  const resetReq = await db.passwordResetRequest.findUnique({
    where: { id },
    include: {
      user: {
        include: {
          businessUnit: { select: { id: true, subsidiaryId: true } },
          project: {
            select: {
              id: true,
              businessUnitId: true,
              businessUnit: { select: { id: true, subsidiaryId: true } },
            },
          },
        },
      },
    },
  });
  if (!resetReq) {
    return NextResponse.json({ ok: false, error: "Reset request not found." }, { status: 404 });
  }

  const actor = {
    id: session.user.id,
    role: session.user.role,
    subsidiaryId: session.user.scope.subsidiary?.id ?? null,
    businessUnitId: session.user.scope.businessUnit?.id ?? null,
    projectId: session.user.scope.project?.id ?? null,
  };

  const target = {
    id: resetReq.user.id,
    role: resetReq.user.role,
    subsidiaryId:
      resetReq.user.subsidiaryId ||
      resetReq.user.businessUnit?.subsidiaryId ||
      resetReq.user.project?.businessUnit?.subsidiaryId ||
      null,
    businessUnitId:
      resetReq.user.businessUnitId || resetReq.user.project?.businessUnitId || null,
    projectId: resetReq.user.projectId || null,
  };

  if (!canAdminReviewResetRequest(actor, target)) {
    return NextResponse.json(
      { ok: false, error: "You are not authorized to review this user's password reset request (self-approval is also prohibited)." },
      { status: 403 }
    );
  }

  if (resetReq.status === "COMPLETED" || resetReq.status === "REJECTED") {
    return NextResponse.json(
      { ok: false, error: `This request was already marked ${resetReq.status}.` },
      { status: 400 }
    );
  }

  const ip = clientIp(request.headers);
  const userAgent = request.headers.get("user-agent") ?? undefined;
  const origin = getAppOrigin(new URL(request.url).origin);

  if (decision === "REJECT") {
    const reason = String(body.reason ?? "").trim();
    if (reason.length < 10) {
      return NextResponse.json(
        { ok: false, error: "A rejection reason of at least 10 characters is required." },
        { status: 400 }
      );
    }

    await db.passwordResetRequest.update({
      where: { id: resetReq.id },
      data: {
        status: "REJECTED",
        approverId: session.user.id,
        approverRole: session.user.role,
        rejectionReason: reason,
        reviewedAt: new Date(),
      },
    });

    await sendPasswordResetRejectedEmail({
      to: resetReq.user.email,
      name: resetReq.user.name,
      reason,
    });

    await db.notification.create({
      data: {
        ntype: "SECURITY",
        title: `Password reset rejected: ${resetReq.user.name}`,
        body: `Rejected by ${session.user.name} (${session.user.role}). Reason: ${reason}`,
        severity: "INFO",
        linkView: "users",
        refId: resetReq.user.id,
        subsidiaryId: resetReq.user.subsidiaryId,
      },
    });

    await logAudit({
      eventType: "PASSWORD_RESET_REJECTED",
      result: "SUCCESS",
      employeeId: resetReq.user.employeeId ?? resetReq.user.email,
      userId: resetReq.userId,
      role: resetReq.user.role,
      detail: `rejectedBy=${session.user.employeeId} reason=${reason}`,
      ip,
      userAgent,
    });

    return NextResponse.json({
      ok: true,
      status: "REJECTED",
      message: `Password reset request for ${resetReq.user.name} rejected.`,
    });
  }

  // APPROVE: generate 1-time temp password + 15-min direct reset token + revoke active sessions
  const tempPassword = generateTempPassword(12);
  const passwordHash = await hashPassword(tempPassword);
  const { rawToken, tokenHash, expiresAt } = createResetTokenPair(15);
  const resetUrl = `${origin}/?resetToken=${encodeURIComponent(rawToken)}`;
  const nextProvider =
    resetReq.user.googleSub || resetReq.user.googleEmail ? "BOTH" : "CREDENTIALS";

  await db.$transaction([
    db.user.update({
      where: { id: resetReq.userId },
      data: {
        passwordHash,
        mustChangePassword: true,
        authProvider: nextProvider,
        ...(resetReq.user.status === "INVITED" ? { status: "ACTIVE" } : {}),
      },
    }),
    db.passwordResetRequest.update({
      where: { id: resetReq.id },
      data: {
        status: "APPROVED_TEMP",
        approverId: session.user.id,
        approverRole: session.user.role,
        tokenHash,
        expiresAt,
        reviewedAt: new Date(),
      },
    }),
  ]);

  await revokeUserSessions(resetReq.userId);

  const emailResult = await sendPasswordResetLinkEmail({
    to: resetReq.user.email,
    name: resetReq.user.name,
    resetUrl,
    tempPassword,
    approvedByName: session.user.name,
  });

  await db.notification.create({
    data: {
      ntype: "SECURITY",
      title: `Password reset approved: ${resetReq.user.name}`,
      body: `Temporary credentials and recovery link issued by ${session.user.name}. Active sessions revoked.`,
      severity: "SUCCESS",
      linkView: "users",
      refId: resetReq.user.id,
      subsidiaryId: resetReq.user.subsidiaryId,
    },
  });

  await logAudit({
    eventType: "PASSWORD_RESET_APPROVED",
    result: "SUCCESS",
    employeeId: resetReq.user.employeeId ?? resetReq.user.email,
    userId: resetReq.userId,
    role: resetReq.user.role,
    detail: `approvedBy=${session.user.employeeId} emailSent=${emailResult.sent}`,
    ip,
    userAgent,
  });

  return NextResponse.json({
    ok: true,
    status: "APPROVED_TEMP",
    tempPassword,
    resetUrl,
    emailSent: emailResult.sent,
    emailNote: emailResult.reason,
    userName: resetReq.user.name,
    employeeId: resetReq.user.employeeId ?? resetReq.user.email,
  });
}

