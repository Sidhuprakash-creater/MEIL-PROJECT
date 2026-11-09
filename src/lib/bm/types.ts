/* ═══════════════════════════════════════════════════════════════════════════
   MEIL ESG — BU MANAGER WORKSPACE · shared TypeScript contract.
   Mirrors the /api/bm/* response shapes. Kept in lock-step with
   src/lib/bm/server.ts and the route handlers.

   Review-status model (workflow state ≠ deadline state):
     · workflow: DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED / REJECTED
       (a corrected report re-enters as a resubmission → SUBMITTED again)
     · deadline flags (overdue / dueSoon) are CALCULATED, never a workflow
       status — a report can be UNDER_REVIEW and overdue at the same time.

   Role boundary (enforced server-side, not in the UI):
     · BU_MANAGER: review + approve/reject of in-scope BU and project reports.
     · NO organizational creation (project/user/timeline mutations) — those
       live on /api/sa/* (Subsidiary Admin) and are never exposed here.
     · NO consolidated Group BRSR creation — /api/esg/* (Group Admin only).
   ═══════════════════════════════════════════════════════════════════════════ */

import type {
  ActivityRow, AuditRow, EvidenceRow, EvidenceSummary, SaNotification,
  SubmissionDetail, SubmissionRow, TimelineRow,
} from "@/lib/sa/types";

export type BmViewId =
  | "dashboard"
  | "notifications"
  | "queue"
  | "submissions"
  | "reports"
  | "evidence"
  | "corrections"
  | "tasks"
  | "validation"
  | "analytics"
  | "activity";

/* Entity shapes are shared 1:1 with the Subsidiary Admin contract — a BU
   Manager sees the same row shapes, just filtered to its assigned BU. */
export type {
  ActivityRow, AuditRow, EvidenceRow, EvidenceSummary, SaNotification,
  SubmissionDetail, SubmissionRow, TimelineRow,
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

/* ── submissions list (queue / directories) ──────────────────────────────────
   Extends the shared SubmissionRow with review context:
     · reviewDeadline — effective review deadline inherited from timelines
     · isResubmission — history contains a resubmission after rejection       */

export interface BmSubmissionRow extends SubmissionRow {
  reviewDeadline: string | null;
  reviewDeadlineLabel: string;
  isResubmission: boolean;
  daysRemaining: number | null; // relative to reviewDeadline (or dueDate)
  /** Project Admin forwarded this approved report to the BU for sign-off.
   *  An APPROVED row with this true is awaiting BU review, not already done. */
  forwardedToBu: boolean;
  forwardedToBuAt: string | null;
  forwardedByName?: string | null;
}

export interface SubmissionsResponse {
  submissions: BmSubmissionRow[];
  total: number;
  counts: {
    all: number;
    queue: number;
    draft: number;
    submitted: number;
    pending: number;
    approved: number;
    rejected: number;
    overdue: number;
    resubmitted: number;
  };
}

/** Full report detail as served by /api/bm/submissions/[id] — the shared
 *  SubmissionDetail plus the manager review context fields. */
export type BmSubmissionDetail = SubmissionDetail & Pick<BmSubmissionRow, "reviewDeadline" | "reviewDeadlineLabel" | "isResubmission" | "daysRemaining" | "forwardedToBu" | "forwardedToBuAt" | "forwardedByName"> & { inConsolidatedReport?: boolean };

/* ── review decision ───────────────────────────────────────────────────────── */

export interface DecisionResponse {
  submission: BmSubmissionRow;
  decision: { action: "approve" | "reject" | "return"; at: string; version: number };
  message: string;
}

/* ── dashboard ─────────────────────────────────────────────────────────────── */

export interface BmDashboardData {
  businessUnit: BusinessUnitInfo;
  period: string;
  kpis: {
    totalProjects: number;
    awaitingReview: number;
    underReview: number;
    returnedForCorrection: number;
    approved: number;
    overdueReviews: number;
    avgReviewDays: number;
  };
  decisionTrend: { label: string; approved: number; rejected: number }[];
  completionByProject: { name: string; total: number; approved: number; pending: number; overdue: number; completionPct: number }[];
  upcomingDeadlines: { id: string; name: string; level: string; dueDate: string; daysLeft: number; status: string }[];
  overdueItems: { ref: string; title: string; level: string; org: string; dueDate: string; daysLate: number; owner: string }[];
  recentDecisions: { id: string; ref: string; title: string; status: string; reviewedAt: string | null; reviewerName: string | null; org: string }[];
  recentActivity: ActivityRow[];
}

/* ── corrections & rejections ──────────────────────────────────────────────── */

export interface CorrectionRow {
  id: string;
  ref: string;
  title: string;
  level: "BU" | "PROJECT";
  projectName: string | null;
  status: string;
  rejectedAt: string | null;
  reviewerName: string | null;
  reason: string;
  instructions: string;
  responsibleName: string | null;
  resubmittedAt: string | null;
  isResubmission: boolean;
  correctionDueDate: string | null;
  lastUpdated: string;
}

export interface CorrectionsResponse {
  corrections: CorrectionRow[];
  resubmissions: CorrectionRow[];
  counts: { rejected: number; awaitingCorrection: number; resubmitted: number };
}

/* ── tasks & deadlines ─────────────────────────────────────────────────────── */

/** A task assigned by the BU Admin (or the subsidiary) to this BU / its users —
 *  read-only for the BU Manager (tasks are created on /api/ba/tasks). */
export interface BmAssignedTaskRow {
  id: string;
  ref: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  assigneeLabel: string;
  startDate: string;
  dueDate: string;
  requiresEvidence: boolean;
  completed: number;
  recipients: number;
  overdue: boolean;
}

export interface BmTasksData {
  reviewBuckets: { dueToday: number; dueSoon: number; overdue: number; completed: number };
  correctionBuckets: { awaitingCorrection: number; overdueCorrections: number };
  pendingReviews: { id: string; ref: string; title: string; project: string; submittedAt: string; reviewDeadline: string | null; daysLeft: number | null; overdue: boolean }[];
  upcomingDeadlines: { name: string; level: string; dueDate: string; daysLeft: number; status: string }[];
  blockedByEvidence: { count: number; refs: string[] };
  assignedTasks: BmAssignedTaskRow[];
}

/* ── analytics ─────────────────────────────────────────────────────────────── */

export interface BmAnalyticsData {
  period: string;
  decisionTrend: { label: string; approved: number; rejected: number }[];
  statusMix: { status: string; label: string; count: number }[];
  completionByProject: { name: string; completionPct: number; approved: number; total: number }[];
  overdueByProject: { name: string; overdue: number }[];
  reviewTurnaround: { avgDays: number; decidedCount: number; byMonth: { label: string; avgDays: number; decided: number }[] };
  pendingVsApproved: { label: string; pending: number; approved: number }[];
  resubmissionRate: { resubmitted: number; rejected: number; pct: number };
  evidenceGaps: { total: number; missing: number; expired: number; byType: { type: string; count: number }[] };
  categoryPulse: { category: string; label: string; value: number; unit: string; change: number }[];
}
