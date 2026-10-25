import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import {
  DASHBOARD_PATHS,
  SESSION_COOKIE,
  SESSION_TTL_HOURS,
  SESSION_TTL_REMEMBER_DAYS,
  roleLabel,
  scopeTypeForRole,
  type PortalId,
  type SessionPayload,
  type VerifiedUser,
} from "@/lib/platform-config";

/* ── token helpers ─────────────────────────────────────────────────────────── */

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "local";
}

/* ── session lifecycle ─────────────────────────────────────────────────────── */

interface SessionCreateOptions {
  userId: string;
  rememberMe?: boolean;
  userAgent?: string | null;
  ip?: string;
}

/** Create a server-side session row + set the httpOnly cookie. */
export async function createSession(
  opts: SessionCreateOptions
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("hex");
  const ttlMs = opts.rememberMe
    ? SESSION_TTL_REMEMBER_DAYS * 24 * 60 * 60 * 1000
    : SESSION_TTL_HOURS * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + ttlMs);

  await db.session.create({
    data: {
      tokenHash: hashToken(token),
      userId: opts.userId,
      userAgent: opts.userAgent ?? undefined,
      ip: opts.ip,
      expiresAt,
    },
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return { token, expiresAt };
}

/** Revoke the current session (delete row + clear cookie). */
export async function destroySession(): Promise<string | undefined> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session
      .deleteMany({ where: { tokenHash: hashToken(token) } })
      .catch(() => undefined);
  }
  jar.delete(SESSION_COOKIE);
  return token;
}

function permissionsFor(role: string): string[] {
  switch (role) {
    case "GROUP_ADMIN":
      return [
        "Group consolidated ESG reporting",
        "Subsidiary submission approval",
        "Organization-wide dashboards",
        "Governance & policy management",
        "Audit trail oversight",
      ];
    case "ORG_MANAGER":
      return [
        "Group consolidated ESG reporting",
        "Organization-wide dashboards",
        "Cross-subsidiary performance analytics",
        "BRSR disclosure preparation",
      ];
    case "SUBSIDIARY_ADMIN":
      return [
        "Subsidiary ESG reporting",
        "Business unit consolidation",
        "Subsidiary approvals & workflow",
        "Evidence repository management",
      ];
    case "SUBSIDIARY_MANAGER":
      return [
        "Subsidiary ESG reporting",
        "Business unit data review",
        "Subsidiary performance dashboards",
      ];
    case "BU_ADMIN":
      return [
        "Business unit ESG data entry",
        "Project data consolidation",
        "Evidence upload & attestation",
      ];
    case "BU_MANAGER":
      return [
        "Business unit ESG reporting",
        "Project performance tracking",
        "Data quality review",
      ];
    case "ENV_DATA_USER":
      return [
        "Site ESG data entry (energy, water, waste, people, safety, travel)",
        "Evidence upload",
        "Submission for review",
      ];
    case "FIN_RESOURCE_USER":
      return [
        "Financial & resource data entry",
        "Evidence upload",
        "Submission for review",
      ];
    case "EHS_USER":
      return [
        "Safety & environmental data entry",
        "Evidence upload",
        "Submission for review",
      ];
    case "HR_USER":
      return [
        "Workforce & social data entry",
        "Evidence upload",
        "Submission for review",
      ];
    case "PROCUREMENT_USER":
      return [
        "Supply-chain & procurement data entry",
        "Evidence upload",
        "Submission for review",
      ];
    case "CSR_USER":
      return [
        "CSR & community data entry",
        "Evidence upload",
        "Submission for review",
      ];
    case "COMPLIANCE_USER":
      return [
        "Regulatory & governance data entry",
        "Evidence upload",
        "Submission for review",
      ];
    case "ESG_ANALYST":
      return [
        "Group-wide ESG analytics",
        "Read-only data exploration",
      ];
    default:
      return [];
  }
}

/** Shape a user row (with scope relations) into the verified payload. */
export function toVerifiedUser(user: {
  id: string;
  employeeId: string | null;
  name: string;
  email: string;
  role: string;
  subsidiary?: { id: string; code: string; name: string } | null;
  businessUnit?: {
    id: string;
    code: string;
    name: string;
    subsidiaryId: string;
  } | null;
  project?: { id: string; code: string; name: string } | null;
}): VerifiedUser {
  const scopeType = scopeTypeForRole(user.role);
  return {
    id: user.id,
    employeeId: user.employeeId ?? user.email,
    name: user.name,
    role: user.role,
    roleLabel: roleLabel(user.role),
    scope: {
      type: scopeType,
      subsidiary: user.subsidiary
        ? {
            id: user.subsidiary.id,
            code: user.subsidiary.code,
            name: user.subsidiary.name,
          }
        : undefined,
      businessUnit: user.businessUnit
        ? {
            id: user.businessUnit.id,
            code: user.businessUnit.code,
            name: user.businessUnit.name,
            subsidiaryId: user.businessUnit.subsidiaryId,
          }
        : undefined,
      project: user.project
        ? {
            id: user.project.id,
            code: user.project.code,
            name: user.project.name,
          }
        : undefined,
    },
    dashboardPath: DASHBOARD_PATHS[scopeType],
    permissions: permissionsFor(user.role),
  };
}

/** Read + validate the session cookie. Returns the verified payload or null. */
export async function getSessionPayload(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        include: { subsidiary: true, businessUnit: true, project: true },
      },
    },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    if (session) {
      await db.session
        .delete({ where: { id: session.id } })
        .catch(() => undefined);
    }
    return null;
  }

  if (session.user.status !== "ACTIVE") return null;

  const recent = await db.auditLog.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { eventType: true, result: true, createdAt: true, ip: true },
  });

  return {
    authenticated: true,
    user: toVerifiedUser(session.user),
    expiresAt: session.expiresAt.toISOString(),
    recentActivity: recent.map((a) => ({
      eventType: a.eventType,
      result: a.result,
      createdAt: a.createdAt.toISOString(),
      ip: a.ip ?? undefined,
    })),
  };
}

/* Convenience for audit rows */
export function portalOfScopeType(scope: PortalId | string): string {
  return scope;
}
