/* ═══════════════════════════════════════════════════════════════════════════
   MEIL ESG — SUBSIDIARY ADMIN WORKSPACE · shared TypeScript contract.
   Mirrors the /api/sa/* response shapes. Kept in lock-step with
   src/lib/sa/server.ts and the route handlers.
   ═══════════════════════════════════════════════════════════════════════════ */

export type SaViewId =
  | "dashboard"
  | "notifications"
  | "units"
  | "projects"
  | "users"
  | "roles"
  | "timelines"
  | "submissions"
  | "monitoring"
  | "evidence"
  | "comms"
  | "esg"
  | "validation"
  | "analytics"
  | "activity"
  | "settings";

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
  SUBMITTED: "Submitted to Group",
  UNDER_GROUP_REVIEW: "Under Group review",
  APPROVED: "Approved by Group",
  CHANGES_REQUESTED: "Changes requested",
};

export const VALIDATION_RULE_LABELS: Record<string, string> = {
  MISSING_FIELD: "Missing required field",
  MISSING_EVIDENCE: "Missing supporting evidence",
  DUPLICATE: "Duplicate submission",
  UNIT_MISMATCH: "Unit mismatch",
  PERIOD_MISMATCH: "Reporting-period mismatch",
  UNAPPROVED_SOURCE: "Unapproved source record",
  MISSING_SUBMISSION: "Missing BU/project submission",
  CALCULATION_EXCEPTION: "Calculation exception",
};

/* ── entities ── */

export interface SubsidiaryInfo {
  id: string;
  code: string;
  name: string;
  sector: string;
  region: string;
  city: string;
  status: string;
  managerName: string;
  adminName: string;
  description: string;
}

export interface SubmissionRow {
  id: string;
  ref: string;
  title: string;
  category: string;
  metricName: string;
  metricValue: number;
  metricUnit: string;
  status: string;
  overdue: boolean;
  period: string;
  fiscalQuarter: string;
  dueDate: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  level: "BU" | "PROJECT";
  buId: string | null;
  buName: string | null;
  projectId: string | null;
  projectName: string | null;
  submittedByName: string | null;
  reviewerName: string | null;
  evidenceCount: number;
  lastUpdated: string;
}

export interface SubmissionDetail extends SubmissionRow {
  values: { label: string; value: number; unit: string }[];
  evidence: string[];
  comments: { author: string; role: string; text: string; at: string }[];
  history: { action: string; actor: string; at: string; note?: string }[];
  validationIssues: { ref: string; severity: string; description: string; status: string }[];
  /* Contributor action availability computed from the workflow state. */
  canSubmit?: boolean;
  canResubmit?: boolean;
}

export interface UnitRow {
  id: string;
  code: string;
  name: string;
  subsidiaryName: string;
  managerName: string;
  adminName: string;
  description: string;
  totalProjects: number;
  totalUsers: number;
  approved: number;
  submitted: number;
  pending: number;
  overdue: number;
  completionPct: number;
  status: string;
  createdAt: string;
}

export interface ProjectRow {
  id: string;
  code: string;
  name: string;
  buId: string;
  buName: string;
  location: string;
  ptype: string;
  capacityMw: number;
  frequency: string;
  responsibleName: string;
  teamCount: number;
  approved: number;
  pending: number;
  overdue: number;
  dueDate: string | null;
  validationState: string;
  status: string;
  createdAt: string;
}

export interface UserRow {
  id: string;
  name: string;
  email: string;
  employeeId: string | null;
  role: string;
  roleLabel: string;
  status: string;
  buId: string | null;
  buName: string | null;
  projectId: string | null;
  projectName: string | null;
  title: string;
  phone: string;
  lastActiveAt: string | null;
  lastLoginAt: string | null;
  taskCount: number;
  submissionCount: number;
  presence: "online" | "today" | "away" | "offline";
}

export interface TimelineRow {
  id: string;
  ref: string;
  name: string;
  period: string;
  level: "SUBSIDIARY" | "BUSINESS_UNIT" | "PROJECT";
  orgId: string | null;
  orgName: string;
  startDate: string;
  dueDate: string | null;
  reviewDeadline: string | null;
  categories: string[];
  inheritanceMode: "INHERIT" | "OVERRIDE";
  overrideReason: string;
  sourceLabel: string;
  effectiveDueDate: string | null;
  deadlineStatus: string;
  status: string;
  notify: boolean;
  createdByName: string;
  updatedAt: string;
}

export interface EvidenceRow {
  id: string;
  name: string;
  fileType: string;
  sizeKb: number;
  version: number;
  buName: string | null;
  projectName: string | null;
  submissionId: string | null;
  submissionRef: string;
  disclosureRef: string;
  uploadedBy: string;
  status: string;
  uploadedAt: string;
  /* Legacy file-storage link (EvidenceDoc is metadata-only in the unified schema). */
  fileId?: string | null;
  hasFile?: boolean;
  mimeType?: string;
}

export interface MessageRow {
  id: string;
  kind: string;
  channel: string;
  subject: string;
  body: string;
  audienceLabel: string;
  recipients: number;
  delivered: number;
  failed: number;
  readCount: number;
  status: string;
  scheduledFor: string | null;
  sentBy: string;
  createdAt: string;
  origin: "subsidiary" | "group";
}

export interface PackageRow {
  id: string;
  ref: string;
  title: string;
  period: string;
  status: string;
  readinessPct: number;
  summary: { approved: number; pending: number; missing: number; metrics: { name: string; value: number; unit: string }[] };
  sourceRefs: string[];
  submittedAt: string | null;
  submittedBy: string;
  groupFeedback: string;
  updatedAt: string;
}

export interface ValidationRow {
  id: string;
  ref: string;
  severity: string;
  rule: string;
  description: string;
  buName: string | null;
  projectName: string | null;
  submissionRef: string;
  responsibleName: string;
  status: string;
  ownerName: string;
  resolveNote: string;
  detectedAt: string;
  resolvedAt: string | null;
}

export interface ActivityRow {
  id: string;
  actorName: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetLabel: string;
  orgLabel: string;
  severity: string;
  createdAt: string;
}

export interface AuditRow {
  id: string;
  actorName: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetLabel: string;
  orgScope: string;
  reason: string;
  outcome: string;
  correlation: string;
  createdAt: string;
}

export interface SaNotification {
  id: string;
  ntype: string;
  title: string;
  body: string;
  severity: string;
  read: boolean;
  linkView: string;
  refId: string;
  createdAt: string;
  origin: "subsidiary" | "group";
}

/* ── composites ── */

export interface DashboardData {
  subsidiary: SubsidiaryInfo;
  period: string;
  kpis: {
    totalBUs: number; activeBUs: number;
    totalProjects: number; activeProjects: number;
    buSubmitted: number; buPending: number; buOverdue: number; buApproved: number; buRejected: number;
    prjSubmitted: number; prjPending: number; prjOverdue: number; prjApproved: number; prjRejected: number;
    awaitingReview: number; rejectedCorrection: number;
    totalUsers: number; activeUsers: number;
    openValidationIssues: number;
    completionPct: number;
    pendingPackages: number;
  };
  buStatusDist: { status: string; count: number }[];
  prjStatusDist: { status: string; count: number }[];
  completionByBU: { name: string; total: number; approved: number; pending: number; overdue: number; completionPct: number }[];
  submissionTrend: { label: string; submitted: number; approved: number }[];
  upcomingDeadlines: { id: string; name: string; level: string; dueDate: string; daysLeft: number; status: string }[];
  overdueItems: { ref: string; title: string; level: string; org: string; dueDate: string; daysLate: number; owner: string }[];
  recentActivity: ActivityRow[];
}

export interface EsgReportingData {
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
  consolidation: {
    metricName: string;
    unit: string;
    approvedTotal: number;
    pendingTotal: number;
    sourceCount: number;
    sources: { ref: string; label: string; org: string; value: number; unit: string; status: string }[];
    hasIssues: boolean;
  }[];
  buCompletion: { name: string; completionPct: number; approved: number; total: number }[];
  packages: PackageRow[];
  activeFeedback: { ref: string; feedback: string; at: string } | null;
}

export interface AnalyticsData {
  period: string;
  completionByBU: { name: string; completionPct: number; approved: number; total: number }[];
  submissionTrend: { label: string; submitted: number; approved: number }[];
  statusMix: { status: string; label: string; count: number }[];
  overdueByBU: { name: string; overdue: number }[];
  metricTrends: { month: string; energy: number; emissions: number; water: number; waste: number; safety: number }[];
  qualityDist: { severity: string; count: number }[];
  pendingVsApproved: { month: string; pending: number; approved: number }[];
  categoryPulse: { category: string; label: string; value: number; unit: string; change: number }[];
}

export interface RolesData {
  roles: { role: string; label: string; description: string; assignable: boolean; userCount: number; permissions: string[] }[];
  matrix: { capability: string; label: string; grants: Record<string, "full" | "own" | "none"> }[];
  assignmentGaps: { userId: string; name: string; role: string; missing: string }[];
  changeHistory: AuditRow[];
}

export interface TimelineSummary {
  subsidiaryDeadline: string | null;
  buComplete: number; buPending: number; buOverdue: number;
  prjComplete: number; prjPending: number; prjOverdue: number;
  upcoming: { name: string; level: string; dueDate: string; daysLeft: number }[];
  overrides: number;
}

export interface EvidenceSummary {
  total: number;
  missing: number;
  expired: number;
  byType: { type: string; count: number }[];
}
