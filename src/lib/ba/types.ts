/* ═══════════════════════════════════════════════════════════════════════════
   MEIL ESG — BU ADMIN WORKSPACE · shared TypeScript contract.
   Mirrors the /api/ba/* response shapes. Kept in lock-step with
   src/lib/ba/server.ts and the route handlers.

   Role boundary (enforced server-side, not in the UI):
     · BU_ADMIN: read/monitor + operational coordination (manage BU users,
       assign project deadlines within policy, monitor submissions + evidence,
       send reminders, prepare the BU reporting package).
     · Approval / rejection transitions are NEVER exposed on /api/ba/*.
       Decisions belong to the BU Manager (/api/bm/submissions/[id]/decision).
     · NO creation of business units / projects / BRSR consolidation.
   ═══════════════════════════════════════════════════════════════════════════ */

import type {
  ActivityRow, AuditRow, EvidenceRow, EvidenceSummary, MessageRow, PackageRow,
  ProjectRow, SaNotification, SubmissionDetail, SubmissionRow, SubsidiaryInfo,
  TimelineRow, UnitRow, UserRow, ValidationRow,
} from "@/lib/sa/types";

export type BaViewId =
  | "dashboard"
  | "notifications"
  | "users"
  | "roles"
  | "projects"
  | "timelines"
  | "submissions"
  | "monitoring"
  | "evidence"
  | "tasks"
  | "comms"
  | "validation"
  | "esg"
  | "analytics"
  | "activity"
  | "settings";

/* Entity shapes are shared 1:1 with the Subsidiary Admin contract — a BU
   Admin sees the same row shapes, just filtered to its assigned BU. */
export type {
  ActivityRow, AuditRow, EvidenceRow, EvidenceSummary, MessageRow, PackageRow,
  ProjectRow, SaNotification, SubmissionDetail, SubmissionRow, SubsidiaryInfo,
  TimelineRow, UnitRow, UserRow, ValidationRow,
};

export const SA_CATEGORIES = [
  "ENVIRONMENT", "ENERGY", "EMISSIONS", "WATER", "WASTE",
  "SAFETY", "WORKFORCE", "PROCUREMENT", "CSR", "COMPLIANCE",
] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  ENVIRONMENT: "Environment",
  ENERGY: "Energy",
  EMISSIONS: "Emissions",
  WATER: "Water",
  WASTE: "Waste",
  SAFETY: "EHS / Safety",
  WORKFORCE: "Workforce",
  PROCUREMENT: "Procurement",
  CSR: "CSR / Community",
  COMPLIANCE: "Compliance",
};

export const SUBMISSION_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  ASSIGNED: "Assigned",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Pending Review",
  CHANGES_REQUESTED: "Changes Requested",
  REJECTED: "Rejected",
  APPROVED: "Approved",
};

export const ROLE_LABELS: Record<string, string> = {
  GROUP_ADMIN: "Group Admin",
  ORG_MANAGER: "Organization Manager",
  SUBSIDIARY_ADMIN: "Subsidiary Admin",
  SUBSIDIARY_MANAGER: "Subsidiary Manager",
  BU_MANAGER: "BU Manager",
  BU_ADMIN: "BU Admin",
  ENV_DATA_USER: "Environment Data User",
  FIN_RESOURCE_USER: "Finance & Resource Contributor",
  HR_USER: "HR User",
  EHS_USER: "EHS / Safety User",
  PROCUREMENT_USER: "Procurement User",
  CSR_USER: "CSR / Community User",
  COMPLIANCE_USER: "Compliance User",
};

export const DEADLINE_STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "Not started",
  UPCOMING: "Upcoming",
  IN_PROGRESS: "In progress",
  DUE_SOON: "Due soon",
  SUBMITTED_ON_TIME: "Submitted on time",
  SUBMITTED_LATE: "Submitted late",
  OVERDUE: "Overdue",
  CLOSED: "Closed",
};

export const PACKAGE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted to Subsidiary",
  UNDER_REVIEW: "Under Subsidiary review",
  APPROVED: "Approved",
  CHANGES_REQUESTED: "Changes requested",
};

export const VALIDATION_RULE_LABELS: Record<string, string> = {
  MISSING_FIELD: "Missing required field",
  MISSING_EVIDENCE: "Missing supporting evidence",
  DUPLICATE: "Duplicate submission",
  UNIT_MISMATCH: "Unit mismatch",
  PERIOD_MISMATCH: "Reporting-period mismatch",
  UNAPPROVED_SOURCE: "Unapproved source record",
  MISSING_SUBMISSION: "Missing project submission",
  CALCULATION_EXCEPTION: "Calculation exception",
};

/* ── BU identity (with parent subsidiary context) ── */

export interface BusinessUnitInfo {
  id: string;
  code: string;
  name: string;
  subsidiaryId: string;
  subsidiaryName: string;
  subsidiaryCode: string;
  sector: string;
  managerName: string;
  adminName: string;
  description: string;
  status: string;
}

/* ── dashboard composite ── */

export interface BaDashboardData {
  businessUnit: BusinessUnitInfo;
  period: string;
  kpis: {
    totalProjects: number;
    submittedReports: number;
    pendingReports: number;
    overdueReports: number;
    pendingReview: number;
    reportingCompletionPct: number;
  };
  statusDist: { status: string; count: number }[];
  completionByProject: { name: string; total: number; approved: number; pending: number; overdue: number; completionPct: number }[];
  submissionTrend: { label: string; submitted: number; approved: number }[];
  upcomingDeadlines: { id: string; name: string; level: string; dueDate: string; daysLeft: number; status: string }[];
  overdueItems: { ref: string; title: string; level: string; org: string; dueDate: string; daysLate: number; owner: string }[];
  pendingSubmissionList: { id: string; ref: string; title: string; project: string; owner: string; dueDate: string; daysLeft: number | null; overdue: boolean }[];
  recentActivity: ActivityRow[];
  latestNotifications: SaNotification[];
}

/* ── tasks & deadlines ── */

export interface BaTasksData {
  myTasks: { id: string; ref: string; title: string; category: string; assigneeLabel: string; dueDate: string; startDate: string; priority: string; status: string; requiresEvidence: boolean; completed: number; recipients: number }[];
  projectTasks: { id: string; ref: string; title: string; category: string; assigneeLabel: string; dueDate: string; startDate: string; priority: string; status: string; requiresEvidence: boolean; completed: number; recipients: number }[];
  buckets: { upcoming: number; dueSoon: number; overdue: number; completed: number };
  upcoming: { name: string; level: string; dueDate: string; daysLeft: number; status: string }[];
}

/* ── comms ── */

export interface BaCommsData {
  messages: MessageRow[];
  announcements: MessageRow[];
  reminders: MessageRow[];
  recipients: { id: string; name: string; role: string; roleLabel: string; projectName: string | null }[];
}

/* ── ESG reporting package (BU → Subsidiary) ── */

export interface BaEsgData {
  period: string;
  readiness: {
    pct: number;
    eligibleApproved: number;
    pendingReview: number;
    missingData: number;
    validationExceptions: number;
    evidenceGaps: number;
  };
  categories: { category: string; label: string; total: number; approved: number; pending: number; missing: boolean; completionPct: number }[];
  projectCoverage: { projectId: string; projectName: string; total: number; approved: number; pending: number; missing: number; completionPct: number }[];
  metrics: { name: string; unit: string; approvedTotal: number; pendingTotal: number; sourceCount: number }[];
  packages: PackageRow[];
}

/* ── analytics ── */

export interface BaAnalyticsData {
  period: string;
  completionByProject: { name: string; completionPct: number; approved: number; total: number }[];
  submissionTrend: { label: string; submitted: number; approved: number }[];
  statusMix: { status: string; label: string; count: number }[];
  overdueByProject: { name: string; overdue: number }[];
  metricTrends: { month: string; energy: number; emissions: number; water: number; waste: number; safety: number }[];
  qualityDist: { severity: string; count: number }[];
  pendingVsApproved: { month: string; pending: number; approved: number }[];
  evidenceGaps: { total: number; missing: number; expired: number; byType: { type: string; count: number }[] };
  categoryPulse: { category: string; label: string; value: number; unit: string; change: number }[];
}

/* ── settings ── */

export interface BaPrefs {
  submissionAlerts: boolean;
  deadlineReminders: boolean;
  weeklyDigest: boolean;
  validationAlerts: boolean;
  reviewStatusUpdates: boolean;
}

export interface BaSettingsData {
  user: {
    id: string; name: string; email: string; employeeId: string | null;
    role: string; roleLabel: string; title: string; phone: string;
    status: string; joinedAt: string; lastLoginAt: string | null;
  };
  businessUnit: BusinessUnitInfo;
  preferences: BaPrefs;
  workspacePrefs: { tableDensity: "compact" | "comfortable"; defaultPeriod: string };
  sessions: { id: string; device: string; ip: string; createdAt: string; expiresAt: string; mostRecent: boolean }[];
  recentAuth: { id: string; eventType: string; result: string; createdAt: string; reason: string | null }[];
}

/* ── roles & assignments ── */

export interface BaRolesData {
  roles: { role: string; label: string; description: string; assignable: boolean; userCount: number; permissions: string[] }[];
  matrix: { capability: string; label: string; grants: Record<string, "full" | "own" | "none"> }[];
  assignmentGaps: { userId: string; name: string; role: string; missing: string }[];
  changeHistory: AuditRow[];
}
