/* ═══════════════════════════════════════════════════════════════════════════
   MEIL ESG PLATFORM — SINGLE-SOURCE CONFIGURATION
   ─────────────────────────────────────────────────────────────────────────
   Everything an administrator needs to change lives in this one file.
   No secrets belong here — this module is safe for client-side import.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── 1. PROJECT USER PORTAL (external website) ─────────────────────────────
   The Project User Portal card is an external-link entry point. Paste the
   URL of the separate Project User website here once it is ready, e.g.:
   "https://project.esg.meil.in"  */
export const PROJECT_USER_PORTAL_URL = "";

/* Shown when the Project User Portal URL is not configured yet. */
export const PROJECT_USER_PORTAL_NOTICE =
  "The Project User Portal is being configured. Please use your designated project reporting portal.";

/* ── 2. DASHBOARD DESTINATIONS (per verified scope) ────────────────────────
   Logical dashboard routes per organizational level. The dashboard modules
   connect here; the server always decides which one a user may reach. */
export const DASHBOARD_PATHS = {
  group: "/dashboard/group",
  subsidiary: "/dashboard/subsidiary",
  business_unit: "/dashboard/business-unit",
  project: "/dashboard/project",
} as const;

export type DashboardScope = keyof typeof DASHBOARD_PATHS;

/* ── 3. ROLE CATALOGUE ──────────────────────────────────────────────────────
   The login selector only records intent — the server re-verifies the
   account's actual role on every authentication attempt. */

export const ROLES = {
  GROUP_ADMIN: "Group Admin",
  ORG_MANAGER: "Organization Manager",
  SUBSIDIARY_ADMIN: "Subsidiary Admin",
  SUBSIDIARY_MANAGER: "Subsidiary Manager",
  BU_ADMIN: "Business Unit Admin",
  BU_MANAGER: "Business Unit Manager",
  ENV_DATA_USER: "Site Data Entry",
  FIN_RESOURCE_USER: "Finance & Resource Contributor",
  EHS_USER: "EHS Officer",
  HR_USER: "HR / Workforce Analyst",
  PROCUREMENT_USER: "Procurement Lead",
  CSR_USER: "CSR / Community User",
  COMPLIANCE_USER: "Compliance / Governance",
  ESG_ANALYST: "ESG Analyst",
  PROJECT_ADMIN: "Project Admin",
} as const;

export type RoleCode = keyof typeof ROLES;

export const PORTAL_ROLES = {
  group: ["GROUP_ADMIN", "ORG_MANAGER"],
  subsidiary: ["SUBSIDIARY_ADMIN", "SUBSIDIARY_MANAGER"],
  business_unit: ["BU_ADMIN", "BU_MANAGER"],
  project: [
    "PROJECT_ADMIN",
    "ENV_DATA_USER",
    "FIN_RESOURCE_USER",
    "EHS_USER",
    "HR_USER",
    "PROCUREMENT_USER",
    "CSR_USER",
    "COMPLIANCE_USER",
    "ESG_ANALYST",
  ],
} as const satisfies Record<string, readonly RoleCode[]>;

export type PortalId = keyof typeof PORTAL_ROLES;

export const PORTAL_ROLE_LABELS: Record<PortalId, { admin: string; manager: string }> = {
  group: { admin: "Group Admin", manager: "Organization Manager" },
  subsidiary: { admin: "Subsidiary Admin", manager: "Subsidiary Manager" },
  business_unit: { admin: "Business Unit Admin", manager: "Business Unit Manager" },
  project: { admin: "Site Data Entry", manager: "ESG Analyst" },
};

export const PORTAL_TITLES: Record<PortalId, string> = {
  group: "Group Portal",
  subsidiary: "Subsidiary Portal",
  business_unit: "Business Unit Portal",
  project: "Project User Portal",
};

export function roleLabel(role: string): string {
  return (ROLES as Record<string, string>)[role] ?? role;
}

export function scopeTypeForRole(role: string): DashboardScope {
  if (role === "GROUP_ADMIN" || role === "ORG_MANAGER") return "group";
  if (role === "SUBSIDIARY_ADMIN" || role === "SUBSIDIARY_MANAGER") return "subsidiary";
  if (role === "BU_ADMIN" || role === "BU_MANAGER") return "business_unit";
  if (
    (PORTAL_ROLES.project as readonly string[]).includes(role)
  )
    return "project";
  return "business_unit";
}

/* ── 4. SESSION ───────────────────────────────────────────────────────────── */
export const SESSION_COOKIE = "meil_esg_session";
export const SESSION_TTL_HOURS = 8;
export const SESSION_TTL_REMEMBER_DAYS = 30;

/* ── 5. VERIFIED-USER PAYLOAD (shared by /login and /session) ─────────────── */

export interface VerifiedScope {
  type: DashboardScope;
  subsidiary?: { id: string; code: string; name: string };
  businessUnit?: { id: string; code: string; name: string; subsidiaryId: string };
  project?: { id: string; code: string; name: string };
}

export interface VerifiedUser {
  id: string;
  employeeId: string;
  name: string;
  email?: string;
  googleEmail?: string | null;
  authProvider?: string;
  mustChangePassword?: boolean;
  role: string;
  roleLabel: string;
  scope: VerifiedScope;
  dashboardPath: string;
  permissions: string[];
}

export interface SessionPayload {
  authenticated: boolean;
  user?: VerifiedUser;
  expiresAt?: string;
  recentActivity?: Array<{
    eventType: string;
    result: string;
    createdAt: string;
    ip?: string;
  }>;
}
