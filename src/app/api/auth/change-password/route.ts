import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { clientIp, createSession, getSessionPayload } from "@/lib/session";
import { logAuthAudit as logAudit } from "@/lib/auth-audit";
import { revokeUserSessions } from "@/lib/auth/session-utils";

export const dynamic = "force-dynamic";

/** POST /api/auth/change-password — Authenticated user updates their password (clears mustChangePassword). */
export async function POST(request: Request) {
  const session = await getSessionPayload();
  if (!session?.authenticated || !session.user) {
    return NextResponse.json(
      { ok: false, message: "Authentication required." },
      { status: 401 }
    );
  }

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Malformed request body." },
      { status: 400 }
    );
  }

  const currentPassword = String(body.currentPassword ?? "");
  const newPassword = String(body.newPassword ?? "");

  if (newPassword.length < 8) {
    return NextResponse.json(
      { ok: false, message: "New password must be at least 8 characters long." },
      { status: 400 }
    );
  }

  const dbUser = await db.user.findUnique({
    where: { id: session.user.id },
  });
  if (!dbUser) {
    return NextResponse.json(
      { ok: false, message: "User record not found." },
      { status: 404 }
    );
  }

  // If not forced from temp password / Google link, require current password check
  if (!dbUser.mustChangePassword && dbUser.passwordHash) {
    const validCurrent = await verifyPassword(currentPassword, dbUser.passwordHash);
    if (!validCurrent) {
      return NextResponse.json(
        { ok: false, message: "Current password is incorrect." },
        { status: 400 }
      );
    }
  }

  const nextHash = await hashPassword(newPassword);
  const nextProvider = dbUser.googleSub || dbUser.googleEmail ? "BOTH" : "CREDENTIALS";

  await db.user.update({
    where: { id: dbUser.id },
    data: {
      passwordHash: nextHash,
      mustChangePassword: false,
      authProvider: nextProvider,
    },
  });

  // Rotate sessions cleanly so stale sessions are invalidated while caller stays signed in
  await revokeUserSessions(dbUser.id);
  const ip = clientIp(request.headers);
  const userAgent = request.headers.get("user-agent") ?? undefined;
  await createSession({
    userId: dbUser.id,
    userAgent,
    ip,
  });

  await logAudit({
    eventType: "PASSWORD_CHANGED",
    result: "SUCCESS",
    employeeId: dbUser.employeeId ?? dbUser.email,
    userId: dbUser.id,
    role: dbUser.role,
    ip,
    userAgent,
  });

  return NextResponse.json({
    ok: true,
    message: "Password updated successfully.",
  });
}

