import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  getProjectAdminContext,
  paOk,
  paFail,
  paSubmissionScope,
} from "@/lib/project-admin/server";
import { getPaConsolidatedReportCache, setPaConsolidatedReportCache, invalidatePaConsolidatedReportCache } from "@/lib/portal-cache";
import type { PaConsolidatedReport, ContributorRole } from "@/lib/project-admin/types";

export const dynamic = "force-dynamic";

function parseJsonArray(raw: unknown): any[] {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  try {
    const ctx = await getProjectAdminContext();
    if (!ctx) return paFail("Project Admin context not resolved.", 401);

    const bypassCache = req.nextUrl.searchParams.get("bypass") === "true";
    const cached = !bypassCache ? getPaConsolidatedReportCache() : null;
    if (cached) {
      return paOk(cached);
    }

    // Round 1: existing report + submissions are mutually independent — one
    // DB round-trip instead of two sequential ones (each sequential await
    // costs a full ~1s round-trip to the remote Postgres).
    const [existingReport, approvedSubmissions] = await Promise.all([
      // Fetch existing report (for metadata like version, status, auditHistory)
      db.report.findFirst({
        where: { scopeId: ctx.projectId },
        select: {
          id: true,
          status: true,
          createdAt: true,
          generatedBy: true,
          generatedByName: true,
          fileName: true,
          version: true,
          content: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      // Fetch submissions belonging to this project/scope for the consolidated report
      db.submission.findMany({
        where: {
          ...paSubmissionScope(ctx),
          category: { not: "CONSOLIDATED" },
          status: { in: ["APPROVED", "BU_APPROVED", "SUBMITTED", "UNDER_REVIEW"] },
        },
        select: {
          id: true,
          ref: true,
          title: true,
          category: true,
          module: true,
          period: true,
          projectId: true,
          submittedById: true,
          values: true,
          evidence: true,
          recordIds: true,
          submittedAt: true,
          reviewedAt: true,
          reviewComment: true,
          status: true,
          forwardedToBu: true,
          forwardedToBuAt: true,
          evidenceCount: true,
          inConsolidatedReport: true,
          consolidatedReportId: true,
          history: true,
          metricValue: true,
          metricName: true,
          metricUnit: true,
        },
        orderBy: { reviewedAt: "desc" },
      }),
    ]);

    // Round 2: everything that derives from the submission list — evidence
    // docs, submitter details, and the Evidence rows for View/Download — is
    // mutually independent, so it runs as ONE parallel round.
    const submissionIds = approvedSubmissions.map(s => s.id);
    const submitterIds = [...new Set(approvedSubmissions.map(s => s.submittedById).filter((id): id is string => Boolean(id)))];
    // Proof/evidence can come from any project present in the approved list.
    const evidenceProjectIds = [
      ...new Set([
        ctx.projectId,
        ...approvedSubmissions.map((s) => s.projectId).filter((id): id is string => Boolean(id)),
      ]),
    ];
    const [evidenceDocs, submitters, evidenceRows] = await Promise.all([
      submissionIds.length > 0
        ? db.evidenceDoc.findMany({
            where: { submissionId: { in: submissionIds } },
            select: { id: true, name: true, fileType: true, sizeKb: true, version: true, status: true, uploadedAt: true, submissionId: true },
          })
        : Promise.resolve([]),
      db.user.findMany({
        where: { id: { in: submitterIds } },
        select: { id: true, name: true, email: true, role: true },
      }),
      db.evidence.findMany({
        where: { projectId: { in: evidenceProjectIds } },
        select: { id: true, fileName: true, documentType: true, filePath: true, hash: true, status: true, fileSize: true, module: true, projectId: true },
      }),
    ]);
    const submitterMap = new Map<string, { id: string; name: string; email: string; role: string }>(submitters.map(u => [u.id, u]));
    // Group evidence by module for easy lookup
    const evidenceByModule = new Map<string, typeof evidenceRows>();
    for (const ev of evidenceRows) {
      const mod = ev.module || "UNKNOWN";
      if (!evidenceByModule.has(mod)) evidenceByModule.set(mod, []);
      evidenceByModule.get(mod)!.push(ev);
    }

    /* ── Staging vs. already-delivered split ──────────────────────────────
       A disclosure that has ALREADY been forwarded to the Business Unit must
       not sit in the consolidation staging list again — it has been handed
       over once, so it is tracked from the Submissions screen (with its BU
       decision) instead. Everything still waiting for its first handover
       stays here and forms the next consolidated package. */
    const stagingSubmissions = approvedSubmissions.filter((s) => !s.forwardedToBu);
    const sentToBuSubmissions = approvedSubmissions.filter((s) => s.forwardedToBu);

    /* BU decision snapshot for the delivered items — the Submissions screen
       shows the same wording so the two views never disagree. */
    const buDecisionLabel = (status: string): PaConsolidatedReport["sentToBuItems"][number]["buDecision"] => {
      switch (status) {
        case "BU_APPROVED": return "BU_APPROVED";
        case "REJECTED": return "BU_REJECTED";
        case "CHANGES_REQUESTED":
        case "CORRECTION_REQUESTED": return "RETURNED_BY_BU";
        case "APPROVED": return "AWAITING_BU_REVIEW";
        default: return "AWAITING_BU_REVIEW";
      }
    };
    const sentToBuItems = sentToBuSubmissions.map((s) => ({
      id: s.id,
      ref: s.ref,
      title: s.title,
      category: s.category,
      module: s.module,
      status: s.status,
      buDecision: buDecisionLabel(s.status),
      forwardedToBuAt: s.forwardedToBuAt ? new Date(s.forwardedToBuAt).toISOString() : null,
      reviewedAt: s.reviewedAt ? new Date(s.reviewedAt).toISOString() : null,
      evidenceCount: s.evidenceCount ?? 0,
      consolidatedReportId: s.consolidatedReportId,
    }));

    // Group submissions by contributor
    const contributorGroups = new Map<string, {
      contributor: { id: string; name: string; email: string; role: string };
      submissions: any[];
    }>();

    for (const sub of stagingSubmissions) {
      const submitter = sub.submittedById ? submitterMap.get(sub.submittedById) : null;
      const contributorKey = submitter?.id || "unknown";

      // Parse values
      let parsedValues: Array<{ label: string; value: string | number; unit?: string }> = [];
      try {
        if (sub.values) {
          const parsed = JSON.parse(sub.values);
          if (Array.isArray(parsed)) parsedValues = parsed;
        }
      } catch {}

      if (parsedValues.length === 0 && sub.metricValue != null && sub.metricValue > 0) {
        parsedValues.push({
          label: sub.metricName || "Recorded Value",
          value: sub.metricValue,
          unit: sub.metricUnit || "",
        });
      }

      // Parse evidence file names
      let evidenceList: string[] = [];
      try {
        if (sub.evidence) {
          const parsed = JSON.parse(sub.evidence);
          if (Array.isArray(parsed)) evidenceList = parsed.filter(Boolean);
        }
      } catch {}

      // Get evidence files with full details (for View/Download)
      const evidenceFiles: Array<{
        id: string;
        fileName: string;
        documentType: string;
        filePath: string;
        sizeKb: number;
        hash: string | null;
      }> = [];

      // From evidenceDoc table
      const docEvidences = evidenceDocs.filter(e => e.submissionId === sub.id);
      for (const doc of docEvidences) {
        evidenceFiles.push({
          id: doc.id,
          fileName: doc.name,
          documentType: doc.fileType,
          filePath: `/api/evidence/${doc.id}`, // will be resolved client-side
          sizeKb: doc.sizeKb,
          hash: null,
        });
      }

      // From Evidence table — match by module AND the same project as the
      // submission so evidence never leaks across projects.
      const moduleEvidences = evidenceByModule.get(sub.module || "") || [];
      for (const ev of moduleEvidences) {
        if (ev.projectId && sub.projectId && ev.projectId !== sub.projectId) continue;
        // Check if this evidence file name matches any in the submission's evidence list
        const matchesEvidenceList = evidenceList.some(name =>
          ev.fileName.includes(name.replace(/\.[^/.]+$/, "")) ||
          name.includes(ev.fileName.replace(/\.[^/.]+$/, ""))
        );

        // Also include if no evidence list exists (fallback)
        if (matchesEvidenceList || evidenceList.length === 0) {
          evidenceFiles.push({
            id: ev.id,
            fileName: ev.fileName,
            documentType: ev.documentType,
            filePath: ev.filePath,
            sizeKb: ev.fileSize,
            hash: ev.hash,
          });
        }
      }

      const subData = {
        id: sub.id,
        ref: sub.ref,
        title: sub.title,
        category: sub.category,
        module: sub.module,
        period: sub.period,
        parsedValues,
        evidenceList,
        evidenceFiles,
        submittedAt: sub.submittedAt,
        reviewedAt: sub.reviewedAt,
        reviewComment: sub.reviewComment,
        status: sub.status,
        forwardedToBu: sub.forwardedToBu,
        inConsolidatedReport: sub.inConsolidatedReport,
        consolidatedReportId: sub.consolidatedReportId,
        history: parseJsonArray(sub.history),
      };

      if (!contributorGroups.has(contributorKey)) {
        const u = submitter || { id: "unknown", name: "Unknown Contributor", email: "", role: "CONTRIBUTOR" };
        contributorGroups.set(contributorKey, {
          contributor: { id: u.id, name: u.name, email: u.email, role: u.role },
          submissions: [],
        });
      }
      contributorGroups.get(contributorKey)!.submissions.push(subData);
    }

    // Sort submissions within each contributor by reviewedAt desc
    contributorGroups.forEach(group => {
      group.submissions.sort((a, b) => new Date(b.reviewedAt || b.submittedAt).getTime() - new Date(a.reviewedAt || a.submittedAt).getTime());
    });

    // Convert to array for response
    const contributorSubmissions = Array.from(contributorGroups.entries()).map(([_, group]) => ({
      contributor: group.contributor,
      submissions: group.submissions,
      totalItems: group.submissions.length,
      totalEvidence: group.submissions.reduce((sum, s) => sum + s.evidenceFiles.length, 0),
    }));

    // Determine completeness status per category
    const categoriesStatus: Record<ContributorRole, "COMPLETED" | "PENDING" | "DRAFT" | "RETURNED"> = {
      ENV_DATA_USER: "PENDING",
      FIN_RESOURCE_USER: "PENDING",
      HR_USER: "PENDING",
      EHS_USER: "PENDING",
      PROCUREMENT_USER: "PENDING",
      CSR_USER: "PENDING",
      COMPLIANCE_USER: "PENDING",
    };

    // Check which categories have approved submissions
    for (const group of contributorSubmissions) {
      for (const sub of group.submissions) {
        const role = group.contributor.role as ContributorRole;
        if (categoriesStatus[role]) {
          categoriesStatus[role] = "COMPLETED";
        }
      }
    }

    /* Delivered (already forwarded) items must NOT fall back to PENDING once
       they leave the staging list — Energy, Water etc. stay COMPLETED while
       the BU reviews them and after the BU approves them. */
    for (const s of sentToBuSubmissions) {
      const role = (s.submittedById ? submitterMap.get(s.submittedById)?.role : undefined) as ContributorRole | undefined;
      if (role && categoriesStatus[role]) {
        categoriesStatus[role] = "COMPLETED";
      }
    }

    const completedCategories = Object.values(categoriesStatus).filter(s => s === "COMPLETED").length;

    /* FINAL SUBMISSION ELIGIBILITY — the project report becomes eligible to
       move on to the Subsidiary ONLY after the Business Unit approves the
       consolidated dossier (the decision route syncs the Report row to
       APPROVED). Staged-but-unsubmitted data alone is not enough. */
    const consolidatedApprovedByBu =
      existingReport?.status === "APPROVED" || existingReport?.status === "BU_APPROVED";
    const isEligible = consolidatedApprovedByBu;

    // Build report response
    const report: PaConsolidatedReport = {
      id: existingReport?.id || "rep-prj-cons-01",
      reportCode: `REP-${ctx.projectCode}-${new Date().getFullYear()}-Q4`,
      title: `${ctx.projectName} — Comprehensive ESG & BRSR Consolidated Report`,
      financialYear: "FY 2025-26",
      reportingPeriod: "Q4 (Annualized)",
      version: existingReport ? (existingReport.version || 1) + 1 : 1,
      versionLabel: existingReport ? `v${(existingReport.version || 1) + 1}.0` : "v1.0",
      status: (existingReport?.status as any) || "READY_TO_SUBMIT",
      submittedAt: existingReport?.createdAt ? new Date(existingReport.createdAt).toISOString() : null,
      submittedBy: existingReport?.generatedBy || ctx.userName,
      reviewedAt: null,
      reviewedBy: null,
      buManagerName: "Gopal Rao (BU Manager)",
      latestReviewComment: null,
      overallScorePct: completedCategories > 0 ? Math.min(50 + completedCategories * 7, 95) : 0,
      completeness: {
        completedCategories,
        totalCategories: 7,
        categoriesStatus,
        missingFields: completedCategories < 7 ? ["Some categories pending approval"] : [],
        missingEvidenceList: evidenceDocs.length < 5 ? ["Third-party ETP water test certificate"] : [],
        validationErrorsList: [],
        isEligibleForSubmission: isEligible,
      },
      sectionsData: {
        executiveSummary: `This Consolidated ESG Project Report encompasses all operational environmental, social, and governance disclosures for ${ctx.projectName} under ${ctx.businessUnitName}, ${ctx.subsidiaryName}. Data has been collected across all seven designated contributor divisions and verified by Project Administration.`,
        environment: {
          energyGj: 0,
          emissionsScope1: 0,
          emissionsScope2: 0,
          waterWithdrawalKl: 0,
          wasteTonnes: 0,
          initiativesSummary: "",
        },
        finance: {
          esgBudgetInr: 0,
          greenCapexInr: 0,
          opexEnergyInr: 0,
        },
        hr: {
          headcount: 0,
          genderDiversityPct: 0,
          trainingHoursPerEmployee: 0,
          welfareProgramsCount: 0,
        },
        ehs: {
          fatalities: 0,
          lostTimeInjuries: 0,
          safeManHours: 0,
          safetyAuditsCompleted: 0,
        },
        procurement: {
          localSuppliersPct: 0,
          sustainableSuppliersAudited: 0,
          totalSpendInr: 0,
        },
        csr: {
          csrBudgetInr: 0,
          beneficiariesServed: 0,
          activePrograms: 0,
        },
        compliance: {
          envClearancesValid: true,
          pendingShowCauseNotices: 0,
          statutoryAuditsPassed: true,
        },
      },
      auditHistory: existingReport && existingReport.content
        ? (() => {
            try {
              const content = JSON.parse(existingReport.content);
              return content.auditHistory || [];
            } catch { return []; }
          })()
        : [
            {
              version: 1,
              action: "CONSOLIDATION_INITIALIZED",
              by: `${ctx.userName} (Project Admin)`,
              timestamp: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
              note: "Consolidation compiled from approved contributor submissions.",
            },
          ],
      // New fields for frontend
      contributorSubmissions,
      /* Disclosures already handed over to the Business Unit — they are out
         of the staging list and are tracked from the Submissions screen. */
      sentToBuCount: sentToBuItems.length,
      sentToBuItems,
    };

    const payload = { report };
    setPaConsolidatedReportCache(payload, 45000);
    return paOk(payload);
  } catch (err: any) {
    console.error("Consolidated report error:", err);
    return paFail(err.message, 500);
  }
}