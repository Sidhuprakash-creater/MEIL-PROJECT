/* ═══════════════════════════════════════════════════════════════════════════
   MEIL ESG — BU Manager · Consolidated rollup contract (types only).

   Kept in a separate module so the client bundle can import the shapes
   without pulling in the server-side database builder.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface BuRollupEvidenceFile {
  id: string;
  name: string;
  fileType: string;
  sizeKb: number;
  uploadedAt: string;
  submissionRef: string;
  /** Direct download path when the file exists in the evidence repository. */
  filePath?: string | null;
  /** false when the report only references a file name (no stored copy). */
  hasFile: boolean;
}

export interface BuRollupDossier {
  id: string;
  ref: string;
  fileName: string;
  status: string;
  createdAt: string;
}

export interface BuRollupProject {
  projectId: string;
  projectName: string;
  confirmedValue: number;
  pendingValue: number;
  unit: string | null;
  reportCount: number;
  reportRefs: string[];
  evidenceFiles: BuRollupEvidenceFile[];
  generalEvidence: BuRollupEvidenceFile[];
  dossier: BuRollupDossier | null;
}

export interface BuRollupReport {
  id: string;
  ref: string;
  title: string;
  category: string;
  projectId: string | null;
  projectName: string | null;
  metricName: string;
  metricValue: number;
  metricUnit: string;
  status: string;
  confirmed: boolean;
  evidenceCount: number;
  forwardedToBuAt: string | null;
}

export interface BuRollupSection {
  category: string;
  label: string;
  confirmedValue: number;
  pendingValue: number;
  unit: string | null;
  reportCount: number;
  projectCount: number;
  reports: BuRollupReport[];
  projects: BuRollupProject[];
}

export interface BuRollup {
  buId: string;
  buName: string;
  subsidiaryId: string;
  subsidiaryName: string;
  period: string;
  sections: BuRollupSection[];
  totals: {
    sections: number;
    projects: number;
    reports: number;
    confirmedReports: number;
    pendingReports: number;
    confirmedValue: number;
  };
  confirmedSubmissionIds: string[];
  /** Submissions already carried by a previously submitted final report.
   *  Populated when the caller asked to exclude them — the BU review queue
   *  uses this to show "already sent to the subsidiary" instead of an
   *  empty rollup. */
  reportedTotals?: { reports: number; confirmedReports: number };
}

export interface BuRollupResponse {
  rollup: BuRollup;
}
