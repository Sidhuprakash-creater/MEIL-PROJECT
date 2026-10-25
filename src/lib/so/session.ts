/* ═══════════════════════════════════════════════════════════════════════════
   SITE OPERATIONS PORTAL — session adapter
   ─────────────────────────────────────────────────────────────────────────
   The platform gateway owns authentication (Session table + httpOnly cookie
   set by src/lib/session.ts). This adapter exposes the same call surface the
   site-operations API routes expect (getCurrentUser / requireUser /
   requirePermission) while deriving identity, role key and permissions from
   the single platform User row. There are no separate RBAC tables: the
   role→permission matrix below is the single source of truth.
   ═══════════════════════════════════════════════════════════════════════════ */

import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/platform-config";

export interface SoSessionUser {
  id: string;
  email: string;
  name: string;
  employeeCode: string | null;
  groupId: string | null;
  title: string;
  status: string;
  demo: boolean;
  /** Zip-portal role keys: PROJECT_USER | FINANCE_USER | HR_USER | EHS_USER |
      PROCUREMENT_USER | CSR_USER | COMPLIANCE_USER | ESG_ANALYST */
  roles: { id: string; key: string; name: string; phase: number }[];
  scopes: { id: string; scopeType: string; scopeId: string }[];
}

/** Platform role → portal role key. */
export function portalRoleKeyFor(role: string): string {
  switch (role) {
    case "ENV_DATA_USER":
      return "PROJECT_USER";
    case "FIN_RESOURCE_USER":
      return "FINANCE_USER";
    case "ESG_ANALYST":
      return "ESG_ANALYST";
    case "HR_USER":
    case "EHS_USER":
    case "PROCUREMENT_USER":
    case "CSR_USER":
    case "COMPLIANCE_USER":
      return role;
    default:
      return "PROJECT_USER";
  }
}

const PORTAL_ROLE_NAMES: Record<string, { name: string; phase: number }> = {
  PROJECT_USER: { name: "Environment Data User", phase: 1 },
  FINANCE_USER: { name: "Finance & Resource Data Contributor", phase: 1 },
  HR_USER: { name: "HR User", phase: 1 },
  EHS_USER: { name: "EHS / Safety User", phase: 1 },
  PROCUREMENT_USER: { name: "Procurement / Supply Chain User", phase: 1 },
  CSR_USER: { name: "CSR / Community User", phase: 1 },
  COMPLIANCE_USER: { name: "Compliance / Governance User", phase: 1 },
  ESG_ANALYST: { name: "ESG Analyst", phase: 3 },
};

/* Role→permission matrix (mirrors the site-operations RBAC seed). Keyed by
   PLATFORM role codes so no join tables are required. */
const ROLE_PERMISSIONS: Record<string, string[]> = {
  ENV_DATA_USER: [
    "organization.read", "project.read",
    "esg.energy.write", "esg.water.write", "esg.waste.write",
    "esg.people.write", "esg.safety.write", "esg.travel.write",
    "evidence.upload", "evidence.read", "submission.submit",
    "brsr.read", "report.read", "audit.read",
  ],
  FIN_RESOURCE_USER: [
    "organization.read", "project.read", "esg.travel.write",
    "evidence.upload", "evidence.read", "submission.submit",
    "brsr.read", "report.read", "audit.read",
  ],
  HR_USER: [
    "organization.read", "project.read", "esg.people.write",
    "evidence.upload", "evidence.read", "submission.submit",
    "brsr.read", "report.read", "audit.read",
  ],
  EHS_USER: [
    "organization.read", "project.read",
    "esg.safety.write", "esg.energy.write", "esg.water.write", "esg.waste.write",
    "evidence.upload", "evidence.read", "submission.submit",
    "brsr.read", "report.read", "audit.read",
  ],
  PROCUREMENT_USER: [
    "organization.read", "project.read", "esg.travel.write",
    "evidence.upload", "evidence.read", "submission.submit",
    "brsr.read", "report.read", "audit.read",
  ],
  CSR_USER: [
    "organization.read", "project.read",
    "evidence.upload", "evidence.read", "submission.submit",
    "brsr.read", "report.read", "audit.read",
  ],
  COMPLIANCE_USER: [
    "organization.read", "project.read",
    "evidence.read", "submission.submit", "brsr.read", "report.read", "audit.read",
  ],
  ESG_ANALYST: [
    "organization.read", "project.read", "brsr.read", "report.read",
  ],
};

/* Review/governance actions stay reserved for the platform consoles —
   no site-operations role holds submission.review/approve/reject/lock or
   evidence.verify by design (review happens in the BU / Subsidiary tier). */

export function permissionsForPlatformRole(role: string): string[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/** Read + verify the platform session cookie and shape the portal user. */
export async function getCurrentUser(): Promise<SoSessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const { createHash } = await import("crypto");
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const session = await db.session.findUnique({
    where: { tokenHash },
    include: {
      user: {
        include: { subsidiary: true, businessUnit: true, project: true },
      },
    },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  const u = session.user;
  if (u.status !== "ACTIVE") return null;

  const key = portalRoleKeyFor(u.role);
  const meta = PORTAL_ROLE_NAMES[key] ?? { name: u.role, phase: 1 };

  const scopes: SoSessionUser["scopes"] = [];
  if (u.project) {
    scopes.push({ id: `proj-${u.id}`, scopeType: "PROJECT", scopeId: u.project.id });
  }
  if (u.subsidiaryId) {
    scopes.push({ id: `sub-${u.id}`, scopeType: "SUBSIDIARY", scopeId: u.subsidiaryId });
  }
  if (u.businessUnitId) {
    scopes.push({ id: `bu-${u.id}`, scopeType: "BUSINESS_UNIT", scopeId: u.businessUnitId });
  }
  scopes.push({ id: `grp-${u.id}`, scopeType: "GROUP", scopeId: "MEIL-GROUP" });

  return {
    id: u.id,
    email: u.email,
    name: u.name,
    employeeCode: u.employeeId,
    groupId: "MEIL-GROUP",
    title: u.title,
    status: u.status,
    demo: false,
    roles: [{ id: key, key, name: meta.name, phase: meta.phase }],
    scopes,
  };
}

export async function requireUser(): Promise<SoSessionUser> {
  const u = await getCurrentUser();
  if (!u) throw new Error("UNAUTHENTICATED");
  return u;
}

export async function requirePermission(permissionKey: string): Promise<SoSessionUser> {
  const u = await requireUser();
  const roleKey = u.roles[0]?.key ?? "";
  const platformRole =
    roleKey === "PROJECT_USER" ? "ENV_DATA_USER"
    : roleKey === "FINANCE_USER" ? "FIN_RESOURCE_USER"
    : roleKey;
  const has = permissionsForPlatformRole(platformRole).includes(permissionKey);
  if (!has) throw new Error("FORBIDDEN");
  return u;
}

export async function userHasPermission(_userId: string, permissionKey: string): Promise<boolean> {
  const u = await getCurrentUser();
  if (!u) return false;
  const roleKey = u.roles[0]?.key ?? "";
  const platformRole =
    roleKey === "PROJECT_USER" ? "ENV_DATA_USER"
    : roleKey === "FINANCE_USER" ? "FIN_RESOURCE_USER"
    : roleKey;
  return permissionsForPlatformRole(platformRole).includes(permissionKey);
}

/** Password verification is owned by the platform login (scrypt in
    src/lib/password.ts) — kept for import compatibility only. */
export async function verifyPassword(): Promise<boolean> {
  throw new Error("Password verification is handled by the platform gateway login");
}
