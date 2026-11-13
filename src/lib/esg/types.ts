// ── MEIL ESG workspace shared types (contract between API and views) ──

export type ViewId =
  | "dashboard"
  | "notifications"
  | "hierarchy"
  | "subsidiaries"
  | "units"
  | "projects"
  | "users"
  | "roles"
  | "submissions"
  | "approvals"
  | "tasks"
  | "comms"
  | "brsr"
  | "brsrChecklist"
  | "brsrAnnexure1"
  | "consolidation"
  | "analytics"
  | "intelligence"
  | "activity"
  | "audit"
  | "settings";

export const ROLE_LABELS: Record<string, string> = {
  // Administrators
  GROUP_ADMIN: "Group Admin",
  SUBSIDIARY_ADMIN: "Subsidiary Admin",
  BU_ADMIN: "BU Admin",
  PROJECT_ADMIN: "Project Admin",

  // Managers
  ORG_MANAGER: "Organization Manager",
  SUBSIDIARY_MANAGER: "Subsidiary Manager",
  BU_MANAGER: "BU Manager",
  PROJECT_MANAGER: "Project Manager",

  // Project & Site Contributor Roles
  PROJECT_USER: "Project User",
  ENV_DATA_USER: "Environment Data User",
  FIN_RESOURCE_USER: "Finance & Resource Contributor",
  HR_USER: "HR User",
  EHS_USER: "EHS / Safety User",
  PROCUREMENT_USER: "Procurement User",
  CSR_USER: "CSR / Community User",
  COMPLIANCE_USER: "Compliance User",
  ESG_ANALYST: "ESG Analyst",
};

export const ADMIN_ROLE_KEYS = [
  "GROUP_ADMIN",
  "SUBSIDIARY_ADMIN",
  "BU_ADMIN",
  "PROJECT_ADMIN",
] as const;

export const MANAGER_ROLE_KEYS = [
  "ORG_MANAGER",
  "SUBSIDIARY_MANAGER",
  "BU_MANAGER",
  "PROJECT_MANAGER",
] as const;

export const CONTRIBUTOR_ROLE_KEYS = [
  "PROJECT_USER",
  "ENV_DATA_USER",
  "FIN_RESOURCE_USER",
  "HR_USER",
  "EHS_USER",
  "PROCUREMENT_USER",
  "CSR_USER",
  "COMPLIANCE_USER",
  "ESG_ANALYST",
] as const;

export const DATA_ENTRY_ROLES = [
  "PROJECT_USER",
  "ENV_DATA_USER",
  "FIN_RESOURCE_USER",
  "HR_USER",
  "EHS_USER",
  "PROCUREMENT_USER",
  "CSR_USER",
  "COMPLIANCE_USER",
  "ESG_ANALYST",
];

export const CATEGORIES = [
  "ENVIRONMENT",
  "ENERGY",
  "EMISSIONS",
  "WATER",
  "WASTE",
  "SAFETY",
  "WORKFORCE",
  "PROCUREMENT",
  "CSR",
  "COMPLIANCE",
] as const;

export const SUBMISSION_STATUSES = [
  "DRAFT",
  "ASSIGNED",
  "SUBMITTED",
  "UNDER_REVIEW",
  "CHANGES_REQUESTED",
  "REJECTED",
  "APPROVED",
] as const;

export const USER_STATUSES = ["ACTIVE", "SUSPENDED", "INACTIVE", "INVITED"] as const;

export interface Subsidiary {
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
  unitCount?: number;
  projectCount?: number;
  userCount?: number;
  submissionStats?: { total: number; approved: number; pending: number; overdue: number };
}

export interface BusinessUnit {
  id: string;
  code: string;
  name: string;
  subsidiaryId: string;
  subsidiaryName?: string;
  status: string;
  managerName: string;
  adminName: string;
  projectCount?: number;
  userCount?: number;
  submissionStats?: { total: number; approved: number; pending: number; overdue: number };
}

export interface Project {
  id: string;
  code: string;
  name: string;
  businessUnitId: string;
  businessUnitName?: string;
  subsidiaryId?: string;
  subsidiaryName?: string;
  location: string;
  ptype: string;
  capacityMw: number;
  status: string;
  frequency: string;
  managerName?: string;
  managerTitle?: string;
  managerEmail?: string;
  managerPhone?: string;
  userCount?: number;
  submissionStats?: { total: number; approved: number; pending: number; overdue: number };
}

export interface User {
  id: string;
  name: string;
  email: string;
  employeeId?: string | null;
  googleEmail?: string | null;
  authProvider?: string;
  mustChangePassword?: boolean;
  role: string;
  status: string;
  subsidiaryId: string | null;
  subsidiaryName?: string | null;
  businessUnitId: string | null;
  businessUnitName?: string | null;
  projectId: string | null;
  projectName?: string | null;
  phone: string;
  title: string;
  joinedAt: string;
  lastActiveAt: string | null;
  lastLoginAt?: string | null;
  openTasks?: number;
  submissionStats?: { total: number; approved: number; pending: number; overdue: number };
}

export interface SubmissionValue {
  label: string;
  value: number;
  unit: string;
}

export interface SubmissionComment {
  author: string;
  role: string;
  text: string;
  at: string;
}

export interface SubmissionHistoryEntry {
  action: string;
  actor: string;
  at: string;
}

export interface Submission {
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
  subsidiaryId: string | null;
  subsidiaryName?: string | null;
  businessUnitId: string | null;
  businessUnitName?: string | null;
  projectId: string | null;
  projectName?: string | null;
  submittedById: string | null;
  submittedByName?: string | null;
  submittedByRole?: string | null;
  reviewerId: string | null;
  reviewerName?: string | null;
  values: SubmissionValue[];
  evidence: string[];
  comments: SubmissionComment[];
  history: SubmissionHistoryEntry[];
}

export interface Task {
  id: string;
  ref: string;
  title: string;
  description: string;
  category: string;
  assigneeType: string;
  assigneeLabel: string;
  assigneeFilter: string;
  subsidiaryId: string | null;
  subsidiaryName?: string | null;
  businessUnitId: string | null;
  businessUnitName?: string | null;
  period: string;
  startDate: string;
  dueDate: string;
  priority: string;
  status: string;
  requiresEvidence: boolean;
  recipients: number;
  acknowledged: number;
  completed: number;
  remindersSent: number;
  reminderLog: { at: string; channel: string }[];
}

export interface Notification {
  id: string;
  ntype: string;
  title: string;
  body: string;
  severity: string;
  read: boolean;
  linkView: string;
  refId: string;
  createdAt: string;
}

export interface Message {
  id: string;
  kind: string;
  channel: string;
  subject: string;
  body: string;
  audienceLabel: string;
  audienceFilter: string;
  recipients: number;
  delivered: number;
  failed: number;
  readCount: number;
  status: string;
  scheduledFor: string | null;
  sentBy: string;
  createdAt: string;
}

export interface BrsrDisclosure {
  code: string;
  title: string;
  mapped: boolean;
  status: string;
  value: number | null;
  unit: string;
  note: string;
}

export interface BrsrSectionImage {
  id: string;
  url: string;
  caption?: string;
  alt?: string;
  widthPct?: number; // 25, 50, 75, 100
  alignment?: "left" | "center" | "right" | "full";
  aspectRatio?: string;
}

export interface BrsrSection {
  id: string;
  title: string;
  content: string;
  contentType?: "markdown" | "html";
  sourceRefs: string[];
  images?: BrsrSectionImage[];
  pageBreakBefore?: boolean;
}

export interface BrsrSignoff {
  role: string;
  name: string;
  decision: string;
  at: string;
  comment: string;
}

export interface BrsrExport {
  format: string;
  at: string;
  by: string;
}

export interface BrsrVersion {
  version: number;
  at: string;
  by: string;
  note: string;
}

export interface BrsrReport {
  id: string;
  ref: string;
  title: string;
  financialYear: string;
  framework: string;
  periodStart: string | null;
  periodEnd: string | null;
  description: string;
  ownerName: string;
  status: string;
  wizardStep: number;
  scope: { subsidiaryIds: string[]; businessUnitIds: string[]; projectIds: string[] };
  sections: BrsrSection[];
  disclosures: BrsrDisclosure[];
  signoffs: BrsrSignoff[];
  exports: BrsrExport[];
  version: number;
  versions: BrsrVersion[];
  finalizedAt: string | null;
  completionPct?: number;
  sourceSubmissionCount?: number;
  approvedSubmissionCount?: number;
}

export interface DisclosureCatalog {
  id: string;
  code: string;
  section: string;
  title: string;
  required: boolean;
  unit: string;
  description: string;
}

export interface ActivityEvent {
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

export interface AuditEvent {
  id: string;
  actorName: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  targetLabel: string;
  orgScope: string;
  before: string;
  after: string;
  reason: string;
  outcome: string;
  correlation: string;
  createdAt: string;
}

export interface AppSetting {
  id: string;
  skey: string;
  label: string;
  category: string;
  svalue: string;
  vtype: string;
  options: string;
  updatedAt: string;
}

export interface DashboardData {
  kpis: {
    subsidiaries: number;
    businessUnits: number;
    projects: number;
    users: number;
    activeUsers: number;
    inactiveUsers: number;
    submissions: number;
    pendingReview: number;
    approved: number;
    rejectedReturned: number;
    overdue: number;
  };
  completionByMonth: { month: string; completed: number; received: number }[];
  orgProgress: { name: string; level: string; total: number; approved: number; overdue: number }[];
  rolePerformance: { role: string; total: number; approved: number; onTime: number }[];
  pendingApprovals: { id: string; ref: string; title: string; submittedByName: string | null; subsidiaryName: string | null; dueDate: string; status: string; category: string }[];
  deadlines: { id: string; ref: string; title: string; dueDate: string; priority: string; status: string; assigneeLabel: string }[];
  activityFeed: ActivityEvent[];
  dataQuality: { id: string; title: string; issue: string; severity: string; ref: string }[];
  esgTrend: { month: string; scope1: number; scope2: number; renewable: number }[];
  categoryMix: { category: string; count: number; approved: number }[];
  /** Live environmental footprint totals — powers the clickable Emissions / Electricity / Water cards. */
  esgFootprint: EsgFootprint;
}

export interface EsgFootprint {
  emissionsTco2e: number;
  scope1Tco2e: number;
  scope2Tco2e: number;
  scope3Tco2e: number;
  emissionsByScope: { label: string; value: number }[];
  /** Grid electricity consumed, in GJ (normalized). */
  electricityGj: number;
  /** All energy sources combined, in GJ. */
  totalEnergyGj: number;
  renewableGj: number;
  energyBySource: { source: string; gj: number }[];
  /** Water withdrawal, in KL. */
  waterKl: number;
  waterConsumptionKl: number;
  waterDischargeKl: number;
  waterRecycledKl: number;
  waterBySource: { source: string; kl: number }[];
}

export interface AnalyticsData {
  environmental: { label: string; energy: number; renewable: number; intensity: number }[];
  emissions: { label: string; scope1: number; scope2: number; scope3: number }[];
  water: { label: string; withdrawal: number; discharge: number; recycled: number }[];
  waste: { label: string; hazardous: number; nonHazardous: number; recycled: number }[];
  safety: { label: string; ltifr: number; incidents: number; nearMiss: number; trainings: number }[];
  workforce: { label: string; headcount: number; diversity: number; turnover: number; training: number }[];
  procurement: { label: string; localSourcing: number; greenSpend: number }[];
  csr: { label: string; beneficiaries: number; spend: number; programs: number }[];
  compliance: { label: string; nonCompliance: number; openFindings: number; closedFindings: number }[];
  completion: { label: string; submitted: number; approved: number; overdue: number }[];
  subsidiaries: { id: string; name: string }[];
  periods: string[];
}

export interface ConsolidationData {
  summary: {
    totalRecords: number;
    approved: number;
    pending: number;
    missing: number;
    duplicates: number;
    anomalies: number;
    exceptions: number;
  };
  missing: { projectCode: string; projectName: string; category: string; metric: string; frequency: string; lastSubmitted: string | null }[];
  duplicates: { ids: string[]; title: string; org: string; metric: string; values: number[] }[];
  anomalies: { ref: string; title: string; metricName: string; metricValue: number; metricUnit: string; expected: string; deviationPct: number; severity: string }[];
  lineage: { ref: string; title: string; status: string; org: string; period: string; evidenceCount: number; usedInReports: string[] }[];
  aggregation: { label: string; scope1: number; scope2: number; energy: number; water: number; waste: number; raw: number; validated: number; approved: number; consolidated: number }[];
  /* Reporting packages submitted by Subsidiary Admins — the Group reviews them here. */
  packages: {
    id: string;
    ref: string;
    title: string;
    subsidiaryName: string;
    period: string;
    status: string;
    readinessPct: number;
    approved: number;
    pending: number;
    missing: number;
    sourceCount: number;
    submittedBy: string;
    submittedAt: string | null;
    groupFeedback: string;
    updatedAt: string;
  }[];
}

export interface RolesData {
  roles: { id: string; label: string; group: string; userCount: number; description: string }[];
  permissions: string[];
  matrix: Record<string, Record<string, boolean>>;
}

export interface HierarchyNode {
  id: string;
  type: "subsidiary" | "unit" | "project";
  code: string;
  name: string;
  status: string;
  meta: string;
  manager: string;
  /** Project nodes only — the site kind (SOLAR_PARK, WIND_FARM, …) used for its favicon icon. */
  kind?: string;
  children?: HierarchyNode[];
  stats?: { users: number; projects: number; submissions: number };
}

/** Group-level rollup returned alongside the hierarchy tree. */
export interface HierarchySummary {
  subsidiaries: number;
  units: number;
  projects: number;
  users: number;
  submissions: number;
  approved: number;
  pendingReview: number;
  overdue: number;
  approvalRate: number;
}

/** Rich per-node payload returned by GET /api/esg/hierarchy?nodeId=… */
export interface HierarchyNodeDetail {
  id: string;
  type: "subsidiary" | "unit" | "project";
  code: string;
  name: string;
  status: string;
  meta: string;
  manager: string;
  profile: { label: string; value: string }[];
  stats: { users: number; projects: number; submissions: number; approved: number; pendingReview: number; overdue: number };
  statusBreakdown: { status: string; count: number }[];
  recentSubmissions: {
    id: string;
    ref: string;
    title: string;
    category: string;
    status: string;
    overdue: boolean;
    metricName: string;
    metricValue: number;
    metricUnit: string;
    submittedByName: string | null;
    dueDate: string;
  }[];
  team: {
    id: string;
    name: string;
    email?: string;
    role: string;
    status: string;
    title: string;
    lastActiveAt?: string | null;
    presence?: "now" | "today" | "away" | "offline" | "invited" | "suspended";
  }[];
  recentActivity?: {
    id: string;
    actorName: string;
    actorRole: string;
    action: string;
    targetType: string;
    targetLabel: string;
    orgLabel: string;
    severity: string;
    createdAt: string;
  }[];
  children: { id: string; type: "unit" | "project"; code: string; name: string; status: string; submissions: number; meta: string }[];
  breadcrumb: { id: string; type: "subsidiary" | "unit" | "project"; name: string }[];
}

export interface BrsrStats {
  reports: BrsrReport[];
  byYear: { year: string; total: number; finalized: number; draft: number }[];
  missingSubmissions: { ref: string; title: string; org: string; status: string }[];
  validationExceptions: number;
  pendingSignoffs: number;
}
