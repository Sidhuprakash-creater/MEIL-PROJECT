/* ═══════════════════════════════════════════════════════════════════════════
   MEIL PROJECT COMMAND CENTER — TYPE CONTRACTS
   Defines the data structures for all 13 Project Admin screens
   ═══════════════════════════════════════════════════════════════════════════ */

export type PaViewId =
  | "dashboard"
  | "project-overview"
  | "users"
  | "categories"
  | "tasks"
  | "collection-status"
  | "approved-dataset"
  | "evidence"
  | "esg-summary"
  | "consolidated-report"
  | "submissions"
  | "corrections"
  | "notifications"
  | "settings";

export type ContributorRole =
  | "ENV_DATA_USER"
  | "FIN_RESOURCE_USER"
  | "HR_USER"
  | "EHS_USER"
  | "PROCUREMENT_USER"
  | "CSR_USER"
  | "COMPLIANCE_USER";

export interface ContributorCategoryDef {
  key: ContributorRole;
  name: string;
  shortLabel: string;
  iconName: string;
  accentColor: string;
  sections: string[];
  description: string;
}

export interface PaProjectInfo {
  id: string;
  code: string;
  name: string;
  location: string;
  ptype: string;
  capacityMw: number;
  status: string;
  frequency: string;
  businessUnitId: string;
  businessUnitName: string;
  reportingFrequency?: string;
  businessUnitCode: string;
  subsidiaryId: string;
  subsidiaryName: string;
  subsidiaryCode: string;
  adminName: string;
  adminEmployeeId: string;
  adminEmail: string;
  financialYear: string;
  reportingDeadline: string;
  reportingStatus: "ON_TRACK" | "DUE_SOON" | "OVERDUE" | "SUBMITTED" | "APPROVED" | "ACTION_REQUIRED";
}

export interface PaKpis {
  totalCategories: number; // 7
  totalAssignedUsers: number;
  completedSubmissions: number;
  pendingSubmissions: number;
  draftSubmissions: number;
  returnedForCorrection: number;
  evidenceUploaded: number;
  missingEvidence: number;
  overallCompletionPct: number;
  overallProgress?: number;
}

export interface PaCategoryProgress {
  key: ContributorRole;
  name: string;
  shortLabel: string;
  accentColor: string;
  iconName: string;
  assignedUsersCount: number;
  completedCount: number;
  pendingCount: number;
  draftCount: number;
  returnedCount: number;
  evidenceCompletenessPct: number;
  lastUpdated: string;
  progressPct: number;
  sections: { code: string; name: string; status: string }[];
  /* Fields produced by the dashboard aggregation route. */
  roleName?: string;
  label?: string;
  status?: string;
  completionPercent?: number;
  assignedUserName?: string;
  assignedUserEmail?: string;
  totalMetrics?: number;
  completedMetrics?: number;
  pendingMetrics?: number;
  lastActivity?: string;
  evidenceCount?: number;
  defaultAssignee?: string;
  metricsCount?: number;
}

export interface PaDashboardAnalytics {
  historicalTrend?: { period: string; score: number; emissions: number; waterRecycled: number }[];
  completionDistribution: {
    name: string;
    value: number;
    color: string;
  }[];
  categoryPerformance: {
    category: string;
    completed: number;
    pending: number;
    draft: number;
    returned: number;
  }[];
  submissionTrend: {
    period: string;
    submissions: number;
    approved: number;
  }[];
  evidenceRatio: {
    category: string;
    uploaded: number;
    required: number;
  }[];
  contributorActivity: {
    day: string;
    actions: number;
  }[];
}

export interface PaActivityItem {
  id: string;
  actorName: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetLabel: string;
  category?: string;
  timestamp: string;
  severity: "INFO" | "SUCCESS" | "WARNING" | "CRITICAL";
}

export interface PaUserItem {
  id: string;
  name: string;
  email: string;
  employeeId: string;
  role: string;
  roleLabel: string;
  status: "ACTIVE" | "INACTIVE" | "INVITED" | "SUSPENDED";
  assignedSections: string[];
  submissionStatus: "COMPLETED" | "PENDING" | "DRAFT" | "OVERDUE" | "NONE";
  lastActiveAt: string | null;
  joinedAt: string;
  openTasksCount: number;
}

export interface PaTaskItem {
  id: string;
  ref: string;
  title: string;
  description: string;
  category: ContributorRole;
  categoryLabel: string;
  sectionCode: string;
  sectionName: string;
  assignedUserId: string;
  assignedUserName: string;
  assignedUserRole: string;
  period: string;
  dueDate: string;
  inheritedDeadline: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "OVERDUE" | "CANCELLED";
  daysRemaining: number;
  requiresEvidence: boolean;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  updatedAt: string;
}

export interface PaCollectionStatusItem {
  id: string;
  category: ContributorRole;
  categoryLabel: string;
  assignedUserId: string;
  assignedUserName: string;
  assignedUserEmail?: string;
  assignedUserDbRole?: string;
  sectionCode: string;
  sectionName: string;
  period: string;
  submissionStatus: "NOT_STARTED" | "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "RETURNED" | "APPROVED";
  evidenceStatus: "COMPLETE" | "PARTIAL" | "MISSING" | "NOT_REQUIRED";
  submissionDate: string | null;
  dueDate: string;
  overdue: boolean;
  metricValue?: number;
  metricUnit?: string;
  updatedAt: string;
  /* Full-window review screen: project card + reviewer context. */
  project?: {
    name: string;
    code: string;
    location: string;
    ptype: string;
    capacityMw: number | null;
    status: string;
    businessUnitName: string;
  } | null;
  parsedValues?: Array<{ label: string; value: string | number; unit?: string }>;
  corrections?: any[];
  reviewComment?: string | null;
  reviewStatus?: string;
  completionPct?: number | null;
  revisionNumber?: number | null;
  /* Sequenced level records for the review window (emission → sources → evidence). */
  sourceRecords?: Array<{
    recordId: string;
    level: number;
    levelName: string;
    recordStatus: string;
    validationStatus: string;
    calculation?: {
      calculatedValue?: number;
      resultUnit?: string;
      scope?: string | null;
      methodologyNote?: string | null;
      factorVersion?: number | null;
    } | null;
    fields?: Array<{ k: string; v: unknown }>;
    evidence?: Array<{ id: string; fileName: string; documentType: string | null }>;
    items: any[];
  }>;
}

export interface PaEvidenceItem {
  id: string;
  name: string;
  fileType: string;
  fileSizeKb: number;
  category: ContributorRole;
  categoryLabel: string;
  sectionCode: string;
  sectionName: string;
  period: string;
  uploadedById: string;
  uploadedByName: string;
  uploadedByRole: string;
  uploadedAt: string;
  status: "VERIFIED" | "PENDING_REVIEW" | "REJECTED" | "DEPRECATED";
  submissionRef?: string;
  version: number;
  previewUrl?: string;
  downloadUrl: string;
}

export interface PaEsgSummaryData {
  energy: {
    totalKwh: number;
    totalGj: number;
    renewablePct: number;
    gridKwh: number;
    solarKwh: number;
    dieselLiters: number;
    recordsCount: number;
    records: {
      id: string;
      source: string;
      quantity: number;
      sourceUnit: string;
      normalizedGj: number;
      period: string;
      calcStatus: string;
    }[];
  };
  ghg: {
    scope1Tonnes: number;
    scope2Tonnes: number;
    totalEmissions: number;
    factors: {
      source: string;
      factor: number;
      unit: string;
      sourceAgency: string;
      version: string;
      formula: string;
    }[];
  };
  water: {
    withdrawalKl: number;
    recycledKl: number;
    dischargeKl: number;
    waterStressArea: boolean;
  };
  waste: {
    hazardousTonnes: number;
    nonHazardousTonnes: number;
    recycledPct: number;
  };
  social: {
    workforceTotal: number;
    femaleCount: number;
    ltifr: number;
    nearMisses: number;
    trainingHoursTotal: number;
  };
  compliance: {
    noticesCount: number;
    finesPaidInr: number;
    validLicensesCount: number;
  };
}

export interface PaConsolidatedReport {
  id: string;
  reportCode: string;
  title: string;
  financialYear: string;
  reportingPeriod: string;
  version: number;
  versionLabel: string;
  status: "DRAFT" | "READY_TO_SUBMIT" | "SUBMITTED" | "UNDER_REVIEW" | "RETURNED" | "APPROVED";
  submittedAt: string | null;
  submittedBy: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  buManagerName: string;
  latestReviewComment: string | null;
  overallScorePct: number;
  completeness: {
    completedCategories: number;
    totalCategories: number; // 7
    categoriesStatus: Record<ContributorRole, "COMPLETED" | "PENDING" | "DRAFT" | "RETURNED">;
    missingFields: string[];
    missingEvidenceList: string[];
    validationErrorsList: string[];
    isEligibleForSubmission: boolean;
  };
  sectionsData: {
    executiveSummary: string;
    environment: {
      energyGj: number;
      emissionsScope1: number;
      emissionsScope2: number;
      waterWithdrawalKl: number;
      wasteTonnes: number;
      initiativesSummary: string;
    };
    finance: {
      esgBudgetInr: number;
      greenCapexInr: number;
      opexEnergyInr: number;
    };
    hr: {
      headcount: number;
      genderDiversityPct: number;
      trainingHoursPerEmployee: number;
      welfareProgramsCount: number;
    };
    ehs: {
      fatalities: number;
      lostTimeInjuries: number;
      safeManHours: number;
      safetyAuditsCompleted: number;
    };
    procurement: {
      localSuppliersPct: number;
      sustainableSuppliersAudited: number;
      totalSpendInr: number;
    };
    csr: {
      csrBudgetInr: number;
      beneficiariesServed: number;
      activePrograms: number;
    };
    compliance: {
      envClearancesValid: boolean;
      pendingShowCauseNotices: number;
      statutoryAuditsPassed: boolean;
    };
  };
  auditHistory: {
    version: number;
    action: string;
    by: string;
    timestamp: string;
    note: string;
  }[];
  contributorSubmissions: {
    contributor: { id: string; name: string; email: string; role: string };
    submissions: {
      id: string;
      ref: string;
      title: string;
      category: string;
      module: string;
      period: string;
      parsedValues: Array<{ label: string; value: string | number; unit?: string }>;
      evidenceList: string[];
      evidenceFiles: Array<{ id: string; fileName: string; documentType: string; filePath: string; sizeKb: number; hash: string | null }>;
      submittedAt: string | null;
      reviewedAt: string | null;
      reviewComment: string | null;
      status: string;
      forwardedToBu: boolean;
      inConsolidatedReport: boolean;
      consolidatedReportId: string | null;
      history: any[];
    }[];
    totalItems: number;
    totalEvidence: number;
  }[];
  /** Disclosures already handed over to the Business Unit — they are out of
   *  the staging list above and are tracked from the Submissions screen. */
  sentToBuCount: number;
  sentToBuItems: Array<{
    id: string;
    ref: string;
    title: string;
    category: string;
    module: string | null;
    status: string;
    buDecision: "BU_APPROVED" | "BU_REJECTED" | "RETURNED_BY_BU" | "AWAITING_BU_REVIEW";
    forwardedToBuAt: string | null;
    reviewedAt: string | null;
    evidenceCount: number;
    consolidatedReportId: string | null;
  }>;
}

export interface PaCorrectionItem {
  id: string;
  reportId: string;
  reportCode: string;
  reportVersion: number;
  reviewDate: string;
  buManagerName: string;
  correctionReason: string;
  affectedCategory: ContributorRole;
  affectedCategoryLabel: string;
  affectedSection: string;
  responsibleUserId: string;
  responsibleUserName: string;
  responsibleUserEmail: string;
  requiredAction: string;
  evidenceRequirement: string;
  status: "AWAITING_CORRECTION" | "ASSIGNED" | "IN_PROGRESS" | "RESUBMISSION_READY" | "RESUBMITTED" | "RESOLVED";
  assignedTaskId?: string;
  updatedAt: string;
}

export interface PaNotificationItem {
  id: string;
  title: string;
  message: string;
  category: "SUBMISSION" | "TASK" | "EVIDENCE" | "CORRECTION" | "REVIEW" | "ASSIGNMENT" | "SYSTEM";
  read: boolean;
  createdAt: string;
  actionUrl?: string;
  linkView?: PaViewId;
  relatedEntityId?: string;
  /* Aliases used by the notifications view. */
  isRead?: boolean;
  type?: string;
}

