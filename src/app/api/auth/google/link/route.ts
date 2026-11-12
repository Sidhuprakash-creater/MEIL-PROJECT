import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAuthAudit as logAudit } from "@/lib/auth-audit";
import {
  GOOGLE_LINK_COOKIE,
  verifyGoogleLinkCookie,
} from "@/lib/auth/google-link";
import { invalidateAllAuthCaches } from "@/lib/auth/session-utils";
import { findExactUserByCredentialIdentifier } from "@/lib/auth/user-lookup";
import {
  equalizeTiming,
  isDemoPassword,
  verifyPassword,
} from "@/lib/password";
import { scopeTypeForRole } from "@/lib/platform-config";
import {
  attemptKey,
  isLocked,
  recordFailure,
  recordSuccess,
} from "@/lib/rate-limit";
import {
  clientIp,
  createSession,
  toVerifiedUser,
} from "@/lib/session";

export const runtime = "nodejs";

function fail(status: number, code: string, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, code, ...extra }, { status });
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const pending = verifyGoogleLinkCookie(cookieStore.get(GOOGLE_LINK_COOKIE)?.value);

  if (!pending) {
    return fail(
      401,
      "PENDING_EXPIRED",
      "Your Google verification session expired. Please click Continue with Google again."
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return fail(400, "INVALID_BODY", "Request body must be valid JSON.");
  }

  const identifier =
    typeof body.identifier === "string"
      ? body.identifier.trim()
      : typeof body.employeeId === "string"
        ? body.employeeId.trim()
        : "";
  const password = typeof body.password === "string" ? body.password : "";
  const remember =
    typeof body.remember === "boolean" ? body.remember : pending.remember;
  const reassignIfLinked = body.reassignIfLinked === true;

  if (!identifier || !password) {
    return fail(
      400,
      "VALIDATION",
      "Please enter both your current email / Employee ID and password."
    );
  }

  const ip = clientIp(req.headers);
  const userAgent = req.headers.get("user-agent") ?? "";
  const key = attemptKey(ip, `glink:${identifier.toLowerCase()}`);
  const lock = isLocked(key);
  if (lock.locked) {
    return fail(
      429,
      "RATE_LIMITED",
      `Too many failed attempts. Try again in ${lock.retryAfterMin ?? 1} minute(s).`
    );
  }

  const user = await findExactUserByCredentialIdentifier(identifier);
  if (!user) {
    await equalizeTiming(password);
    recordFailure(key);
    await logAudit({
      eventType: "LOGIN_FAILED",
      result: "FAILURE",
      employeeId: identifier,
      portal: pending.portal,
      reason: "GOOGLE_LINK_INVALID_USER",
      detail: `google=${pending.googleEmail}`,
      ip,
      userAgent,
    });
    return fail(401, "INVALID_CREDENTIALS", "Invalid Email / Employee ID or password.");
  }

  const passwordOk =
    isDemoPassword(password) ||
    (user.passwordHash ? await verifyPassword(password, user.passwordHash) : false);

  if (!passwordOk) {
    recordFailure(key);
    await logAudit({
      eventType: "LOGIN_FAILED",
      result: "FAILURE",
      employeeId: user.employeeId ?? user.email,
      userId: user.id,
      portal: pending.portal,
      reason: "GOOGLE_LINK_BAD_PASSWORD",
      detail: `google=${pending.googleEmail}`,
      ip,
      userAgent,
    });
    return fail(
      401,
      "INVALID_CREDENTIALS",
      user.passwordHash
        ? "Invalid Email / Employee ID or password."
        : "No password credential is configured for this account. Ask your Group Admin to link your Google email directly."
    );
  }

  if (user.status !== "ACTIVE" && user.status !== "INVITED") {
    return fail(
      403,
      "INACTIVE",
      user.status === "SUSPENDED"
        ? "This account has been suspended. Contact your Group ESG Administrator."
        : "This account is not active. Contact your Group ESG Administrator."
    );
  }

  // Prevent linking if this Google account is already attached to another user
  const conflict = await db.user.findFirst({
    where: {
      NOT: { id: user.id },
      OR: [
        { googleSub: pending.googleSub },
        { googleEmail: pending.googleEmail },
      ],
    },
    select: { id: true, email: true, name: true, authProvider: true, passwordHash: true },
  });

  const allowDemoSwitch =
    process.env.ALLOW_DEMO_PASSWORDS?.trim().toLowerCase() === "true";

  if (conflict && !(allowDemoSwitch && reassignIfLinked)) {
    return fail(
      409,
      "GOOGLE_ALREADY_LINKED",
      `This Google account (${pending.googleEmail}) is currently linked to ${conflict.name} (${conflict.email}).`,
      {
        canReassign: allowDemoSwitch,
        linkedToEmail: conflict.email,
        linkedToName: conflict.name,
      }
    );
  }

  const nextProvider = user.passwordHash ? "BOTH" : "GOOGLE";
  const now = new Date();

  const updatedUser = await db.$transaction(async (tx) => {
    if (conflict) {
      await tx.user.update({
        where: { id: conflict.id },
        data: {
          googleSub: null,
          googleEmail: null,
          authProvider: conflict.passwordHash ? "CREDENTIALS" : "CREDENTIALS",
        },
      });
    }

    return tx.user.update({
      where: { id: user.id },
      data: {
        googleSub: pending.googleSub,
        googleEmail: pending.googleEmail,
        authProvider: nextProvider,
        lastLoginAt: now,
        lastActiveAt: now,
        ...(user.status === "INVITED" ? { status: "ACTIVE" } : {}),
      },
      include: { subsidiary: true, businessUnit: true, project: true },
    });
  });

  if (conflict) {
    invalidateAllAuthCaches(conflict.id);
  }
  invalidateAllAuthCaches(updatedUser.id);
  recordSuccess(key);

  const { expiresAt } = await createSession({
    userId: updatedUser.id,
    rememberMe: remember,
    userAgent,
    ip,
  });

  await logAudit({
    eventType: "GOOGLE_OAUTH_SUCCESS",
    result: "SUCCESS",
    employeeId: updatedUser.employeeId ?? updatedUser.email,
    userId: updatedUser.id,
    portal: scopeTypeForRole(updatedUser.role),
    role: updatedUser.role,
    detail: `linked=${pending.googleEmail}`,
    ip,
    userAgent,
  });

  const targetPortal = scopeTypeForRole(updatedUser.role);
  const res = NextResponse.json({
    ok: true,
    user: toVerifiedUser(updatedUser),
    expiresAt: expiresAt.toISOString(),
    redirectUrl: `/?dashboard=1&portal=${encodeURIComponent(targetPortal)}`,
  });

  res.cookies.set(GOOGLE_LINK_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return res;
}

