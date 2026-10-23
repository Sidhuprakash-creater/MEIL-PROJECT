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
} as const;

export type RoleCode = keyof typeof ROLES;

export const PORTAL_ROLES = {
  group: ["GROUP_ADMIN", "ORG_MANAGER"],
  subsidiary: ["SUBSIDIARY_ADMIN", "SUBSIDIARY_MANAGER"],
  business_unit: ["BU_ADMIN", "BU_MANAGER"],
} as const satisfies Record<string, readonly RoleCode[]>;

export type PortalId = keyof typeof PORTAL_ROLES;

export const PORTAL_ROLE_LABELS: Record<PortalId, { admin: string; manager: string }> = {
  group: { admin: "Group Admin", manager: "Organization Manager" },
  subsidiary: { admin: "Subsidiary Admin", manager: "Subsidiary Manager" },
  business_unit: { admin: "Business Unit Admin", manager: "Business Unit Manager" },
};

export const PORTAL_TITLES: Record<PortalId, string> = {
  group: "Group Portal",
  subsidiary: "Subsidiary Portal",
  business_unit: "Business Unit Portal",
};

export function roleLabel(role: string): string {
  return (ROLES as Record<string, string>)[role] ?? role;
}

export function scopeTypeForRole(role: string): DashboardScope {
  if (role === "GROUP_ADMIN" || role === "ORG_MANAGER") return "group";
  if (role === "SUBSIDIARY_ADMIN" || role === "SUBSIDIARY_MANAGER") return "subsidiary";
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
}

export interface VerifiedUser {
  id: string;
  employeeId: string;
  name: string;
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
