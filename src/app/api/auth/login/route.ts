import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAuthAudit as logAudit } from "@/lib/auth-audit";
import { equalizeTiming, verifyPassword } from "@/lib/password";
import {
  attemptKey,
  isLocked,
  recordFailure,
  recordSuccess,
} from "@/lib/rate-limit";
import { createSession, clientIp, toVerifiedUser } from "@/lib/session";
import { PORTAL_ROLES, type PortalId } from "@/lib/platform-config";

export const dynamic = "force-dynamic";

/* ────────────────────────────────────────────────────────────────────────────
   POST /api/auth/login
   Body: { portal, role, employeeId (employee ID *or* email), password,
           subsidiaryId?, businessUnitId?, rememberMe? }

   The client's portal/role selection records INTENT only. The server is the
   single source of truth: it re-verifies the account's actual role, its
   organizational scope (subsidiary / business unit) and active status before
   a session is ever issued.
   ──────────────────────────────────────────────────────────────────────────── */

function fail(
  status: number,
  code: string,
  message: string,
  extra?: Record<string, unknown>
) {
  return NextResponse.json({ ok: false, code, message, ...extra }, { status });
}

/** Resolve the typed identifier to an account: email first, then employee ID. */
async function findUserByIdentifier(identifier: string) {
  const raw = identifier.trim();
  if (!raw) return null;

  if (raw.includes("@")) {
    const byEmail = await db.user.findUnique({
      where: { email: raw.toLowerCase() },
      include: { subsidiary: true, businessUnit: true },
    });
    if (byEmail) return byEmail;
  }

  return db.user.findUnique({
    where: { employeeId: raw.toUpperCase() },
    include: { subsidiary: true, businessUnit: true },
  });
}

export async function POST(request: Request) {
  const ip = clientIp(request.headers);
  const userAgent = request.headers.get("user-agent") ?? undefined;

  /* ── parse + validate shape ── */
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return fail(400, "VALIDATION", "Malformed request body.");
  }

  const portal = String(body.portal ?? "");
  const role = String(body.role ?? "");
  const identifier = String(body.employeeId ?? "").trim();
  const password = String(body.password ?? "");
  const subsidiaryId = body.subsidiaryId ? String(body.subsidiaryId) : null;
  const businessUnitId = body.businessUnitId ? String(body.businessUnitId) : null;
  const rememberMe = Boolean(body.rememberMe);

  const fieldErrors: Record<string, string> = {};
  if (!(portal in PORTAL_ROLES)) {
    return fail(400, "VALIDATION", "Unknown access portal selected.", {
      field: "portal",
    });
  }
  if (!role) fieldErrors.role = "Please select your role.";
  if (!identifier)
    fieldErrors.employeeId = "Employee ID or email is required.";
  if (!password) fieldErrors.password = "Password is required.";

  const portalRoles = PORTAL_ROLES[portal as PortalId];
  if (role && !(portalRoles as readonly string[]).includes(role)) {
    return fail(400, "VALIDATION", "The selected role is not valid for this portal.", {
      field: "role",
    });
  }

  if (portal === "subsidiary" && !subsidiaryId) {
    fieldErrors.subsidiaryId = "Please select your subsidiary.";
  }
  if (portal === "business_unit") {
    if (!subsidiaryId) fieldErrors.subsidiaryId = "Please select your subsidiary.";
    if (!businessUnitId) fieldErrors.businessUnitId = "Please select your business unit.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    await logAudit({
      eventType: "LOGIN_FAILED",
      result: "FAILURE",
      employeeId: identifier || undefined,
      portal,
      role,
      reason: "VALIDATION",
      detail: Object.keys(fieldErrors).join(","),
      ip,
      userAgent,
    });
    return fail(400, "VALIDATION", "Please complete the highlighted fields.", {
      fields: fieldErrors,
    });
  }

  /* ── brute-force throttle ── */
  const key = attemptKey(ip, identifier);
  const lock = isLocked(key);
  if (lock.locked) {
    await logAudit({
      eventType: "RATE_LIMITED",
      result: "FAILURE",
      employeeId: identifier,
      portal,
      role,
      ip,
      userAgent,
    });
    return fail(
      429,
      "RATE_LIMITED",
      `Too many failed attempts. For security, try again in ${lock.retryAfterMin} minute${(lock.retryAfterMin ?? 1) > 1 ? "s" : ""}.`
    );
  }

  /* ── identity (email or employee ID) ── */
  const user = await findUserByIdentifier(identifier);

  if (!user) {
    await equalizeTiming(password); // no user-enumeration via timing
    recordFailure(key);
    await logAudit({
      eventType: "LOGIN_FAILED",
      result: "FAILURE",
      employeeId: identifier,
      portal,
      role,
      reason: "INVALID_CREDENTIALS",
      ip,
      userAgent,
    });
    return fail(
      401,
      "INVALID_CREDENTIALS",
      "Invalid Employee ID / email or password."
    );
  }

  const passwordOk = user.passwordHash
    ? await verifyPassword(password, user.passwordHash)
    : false;
  if (!passwordOk) {
    recordFailure(key);
    await logAudit({
      eventType: "LOGIN_FAILED",
      result: "FAILURE",
      employeeId: identifier,
      userId: user.id,
      portal,
      role,
      reason: "INVALID_CREDENTIALS",
      ip,
      userAgent,
    });
    return fail(
      401,
      "INVALID_CREDENTIALS",
      user.passwordHash
        ? "Invalid Employee ID / email or password."
        : "No password credential is configured for this account. Contact your group ESG administrator."
    );
  }

  /* ── account state ── */
  if (user.status !== "ACTIVE") {
    await logAudit({
      eventType: "LOGIN_FAILED",
      result: "FAILURE",
      employeeId: identifier,
      userId: user.id,
      portal,
      role,
      reason: "INACTIVE",
      detail: `status=${user.status}`,
      ip,
      userAgent,
    });
    return fail(
      403,
      "INACTIVE",
      user.status === "SUSPENDED"
        ? "This account has been suspended. Please contact your group ESG administrator."
        : "This account is not active. Please contact your group ESG administrator."
    );
  }

  /* ── role verification (selection is intent; server decides) ── */
  if (user.role !== role) {
    await logAudit({
      eventType: "LOGIN_FAILED",
      result: "FAILURE",
      employeeId: identifier,
      userId: user.id,
      portal,
      role,
      reason: "ROLE_MISMATCH",
      detail: `assigned=${user.role}`,
      ip,
      userAgent,
    });
    return fail(
      403,
      "ROLE_MISMATCH",
      `This account is not authorized for the selected role. Your assigned role is "${user.role}".`
    );
  }

  /* ── organizational scope verification ── */
  if (portal === "subsidiary" || portal === "business_unit") {
    const requestedSubsidiary = subsidiaryId
      ? await db.subsidiary.findUnique({ where: { id: subsidiaryId } })
      : null;
    if (
      !requestedSubsidiary ||
      requestedSubsidiary.status !== "ACTIVE" ||
      user.subsidiaryId !== requestedSubsidiary.id
    ) {
      await logAudit({
        eventType: "LOGIN_FAILED",
        result: "FAILURE",
        employeeId: identifier,
        userId: user.id,
        portal,
        role,
        scopeRef: requestedSubsidiary?.code,
        reason: "SCOPE_MISMATCH",
        detail: "subsidiary",
        ip,
        userAgent,
      });
      return fail(
        403,
        "SCOPE_MISMATCH",
        requestedSubsidiary
          ? `This account is not registered under ${requestedSubsidiary.name}. Select your assigned subsidiary to continue.`
          : "This account is not authorized for the selected subsidiary."
      );
    }
  }

  if (portal === "business_unit") {
    const requestedBU = businessUnitId
      ? await db.businessUnit.findUnique({ where: { id: businessUnitId } })
      : null;
    if (
      !requestedBU ||
      requestedBU.status !== "ACTIVE" ||
      user.businessUnitId !== requestedBU.id ||
      requestedBU.subsidiaryId !== user.subsidiaryId
    ) {
      await logAudit({
        eventType: "LOGIN_FAILED",
        result: "FAILURE",
        employeeId: identifier,
        userId: user.id,
        portal,
        role,
        scopeRef: requestedBU?.code,
        reason: "SCOPE_MISMATCH",
        detail: "business_unit",
        ip,
        userAgent,
      });
      return fail(
        403,
        "SCOPE_MISMATCH",
        requestedBU
          ? `This account is not authorized for ${requestedBU.name}. Select your assigned business unit to continue.`
          : "This account is not authorized for the selected business unit."
      );
    }
  }

  /* ── issue session ── */
  recordSuccess(key);
  const { expiresAt } = await createSession({
    userId: user.id,
    rememberMe,
    userAgent,
    ip,
  });

  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await logAudit({
    eventType: "LOGIN_SUCCESS",
    result: "SUCCESS",
    employeeId: user.employeeId ?? user.email,
    userId: user.id,
    portal,
    role,
    scopeRef: user.businessUnit?.code ?? user.subsidiary?.code ?? "GROUP",
    ip,
    userAgent,
  });

  return NextResponse.json({
    ok: true,
    user: toVerifiedUser(user),
    expiresAt: expiresAt.toISOString(),
  });
}
