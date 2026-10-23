/* ═══════════════════════════════════════════════════════════════════════════
   MEIL ESG — SUBSIDIARY MANAGER WORKSPACE · shared TypeScript contract.
   Mirrors the /api/sm/* response shapes. Kept in lock-step with
   src/lib/sm/server.ts and the route handlers.

   Review-status model (workflow state ≠ deadline state):
     · workflow: DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED / REJECTED
       (a corrected report re-enters as a resubmission → SUBMITTED again)
     · deadline flags (overdue / dueSoon) are CALCULATED, never a workflow
       status — a report can be UNDER_REVIEW and overdue at the same time.
   ═══════════════════════════════════════════════════════════════════════════ */

import type {
  ActivityRow, AuditRow, EvidenceRow, EvidenceSummary, SaNotification,
  SubmissionDetail, SubmissionRow, SubsidiaryInfo, TimelineRow,
} from "@/lib/sa/types";

export type SmViewId =
  | "dashboard"
  | "notifications"
  | "queue"
  | "reports-bu"
  | "reports-project"
  | "evidence"
  | "corrections"
  | "deadlines"
  | "analytics"
  | "activity"
  | "profile";

/* Entity shapes are shared 1:1 with the Subsidiary Admin contract. */
export type { ActivityRow, AuditRow, EvidenceRow, EvidenceSummary, SaNotification, SubmissionDetail, SubmissionRow, SubsidiaryInfo, TimelineRow };

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

/* ── submissions list (queue / directories) ──────────────────────────────────
   Extends the shared SubmissionRow with review context:
     · reviewDeadline — effective review deadline inherited from timelines
     · isResubmission — history contains a resubmission after rejection       */

export interface SmSubmissionRow extends SubmissionRow {
  reviewDeadline: string | null;
  reviewDeadlineLabel: string;
  isResubmission: boolean;
  daysRemaining: number | null; // relative to reviewDeadline (or dueDate)
}

export interface SubmissionsResponse {
  submissions: SmSubmissionRow[];
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

/** Full report detail as served by /api/sm/submissions/[id] — the shared
 *  SubmissionDetail plus the manager review context fields. */
export type SmSubmissionDetail = SubmissionDetail & Pick<SmSubmissionRow, "reviewDeadline" | "reviewDeadlineLabel" | "isResubmission" | "daysRemaining">;

/* ── review decision ───────────────────────────────────────────────────────── */

export interface DecisionResponse {
  submission: SmSubmissionRow;
  decision: { action: "approve" | "reject"; at: string; version: number };
  message: string;
}

/* ── dashboard ─────────────────────────────────────────────────────────────── */

export interface ManagerDashboardData {
  subsidiary: SubsidiaryInfo;
  period: string;
  kpis: {
    totalBUs: number;
    totalProjects: number;
    /* Review workload */
    awaitingReview: number;
    dueSoonReview: number;
    overdueReview: number;
    rejectedCorrection: number;
    resubmissions: number;
    completedReviews: number; // decisions already recorded by this manager
    /* BU reporting */
    buSubmitted: number; buPending: number; buOverdue: number; buApproved: number; buRejected: number;
    /* Project reporting */
    prjSubmitted: number; prjPending: number; prjOverdue: number; prjApproved: number; prjRejected: number;
    completionPct: number;
    openValidationIssues: number;
  };
  decisionTrend: { label: string; approved: number; rejected: number }[];
  completionByBU: { name: string; total: number; approved: number; pending: number; overdue: number; completionPct: number }[];
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
  buName: string | null;
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

export interface DeadlinesData {
  timelines: TimelineRow[];
  tasks: {
    id: string; ref: string; title: string; category: string; assigneeLabel: string;
    org: string; dueDate: string; startDate: string; priority: string; status: string;
    requiresEvidence: boolean; completed: number; recipients: number;
  }[];
  reviewBuckets: { dueToday: number; dueSoon: number; overdue: number };
  correctionBuckets: { awaitingCorrection: number; overdueCorrections: number };
  blockedByEvidence: { count: number; refs: string[] };
  upcoming: { name: string; level: string; dueDate: string; daysLeft: number; status: string }[];
}

/* ── analytics ─────────────────────────────────────────────────────────────── */

export interface ManagerAnalyticsData {
  period: string;
  decisionTrend: { label: string; approved: number; rejected: number }[];
  statusMix: { status: string; label: string; count: number }[];
  completionByBU: { name: string; completionPct: number; approved: number; total: number }[];
  overdueByBU: { name: string; overdue: number }[];
  reviewTurnaround: { avgDays: number; decidedCount: number; byMonth: { label: string; avgDays: number; decided: number }[] };
  pendingVsApproved: { label: string; pending: number; approved: number }[];
  resubmissionRate: { resubmitted: number; rejected: number; pct: number };
  evidenceGaps: { total: number; missing: number; expired: number; byType: { type: string; count: number }[] };
  categoryPulse: { category: string; label: string; value: number; unit: string; change: number }[];
}

/* ── profile & preferences ─────────────────────────────────────────────────── */

export interface ManagerPrefs {
  submissionAlerts: boolean;
  deadlineReminders: boolean;
  decisionCopies: boolean;
  validationAlerts: boolean;
  weeklyDigest: boolean;
}

export interface ProfileData {
  user: {
    id: string; name: string; email: string; employeeId: string | null;
    role: string; roleLabel: string; title: string; phone: string;
    status: string; joinedAt: string; lastLoginAt: string | null;
  };
  subsidiary: SubsidiaryInfo;
  preferences: ManagerPrefs;
  sessions: { id: string; device: string; ip: string; createdAt: string; expiresAt: string; mostRecent: boolean }[];
  recentAuth: { id: string; eventType: string; result: string; createdAt: string; reason: string | null }[];
}
