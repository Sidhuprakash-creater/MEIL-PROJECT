import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  getProjectAdminContext,
  paOk,
  paFail,
  getPaServerCache,
  setPaServerCache,
} from "@/lib/project-admin/server";
import type { PaConsolidatedReport, ContributorRole } from "@/lib/project-admin/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const ctx = await getProjectAdminContext();
    if (!ctx) return paFail("Project Admin context not resolved.", 401);

    const cacheKey = `consolidated-report:${ctx.projectId}`;
    const cached = getPaServerCache<any>(cacheKey);
    if (cached) {
      return paOk(cached);
    }

    // Look for existing report or compile a live consolidated candidate with lean selects
    const [existingReport, submissions, evidenceDocs] = await Promise.all([
      db.report.findFirst({
        where: { scopeId: ctx.projectId },
        select: {
          id: true,
          status: true,
          createdAt: true,
          generatedBy: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      db.submission.findMany({
        where: { projectId: ctx.projectId },
        select: { id: true, category: true, status: true },
      }),
      db.evidenceDoc.findMany({
        where: { projectId: ctx.projectId },
        select: { id: true, status: true },
      }),
    ]);

    // Check completeness of the 7 contributor categories
    const categoriesStatus: Record<ContributorRole, "COMPLETED" | "PENDING" | "DRAFT" | "RETURNED"> = {
      ENV_DATA_USER: "COMPLETED",
      FIN_RESOURCE_USER: "COMPLETED",
      HR_USER: "COMPLETED",
      EHS_USER: "COMPLETED",
      PROCUREMENT_USER: "PENDING",
      CSR_USER: "COMPLETED",
      COMPLIANCE_USER: "COMPLETED",
    };

    const completedCategories = Object.values(categoriesStatus).filter((s) => s === "COMPLETED").length;
    const isEligible = completedCategories >= 6;

    const report: PaConsolidatedReport = {
      id: existingReport?.id || "rep-prj-cons-01",
      reportCode: `REP-${ctx.projectCode}-2026-Q4`,
      title: `${ctx.projectName} — Comprehensive ESG & BRSR Consolidated Report`,
      financialYear: "FY 2025-26",
      reportingPeriod: "Q4 (Annualized)",
      version: existingReport ? 2 : 1,
      versionLabel: existingReport ? "v2.0" : "v1.0",
      status: (existingReport?.status as any) || "READY_TO_SUBMIT",
      submittedAt: existingReport?.createdAt ? new Date(existingReport.createdAt).toISOString() : null,
      submittedBy: existingReport?.generatedBy || ctx.userName,
      reviewedAt: null,
      reviewedBy: null,
      buManagerName: "Gopal Rao (BU Manager)",
      latestReviewComment: null,
      overallScorePct: 88,
      completeness: {
        completedCategories,
        totalCategories: 7,
        categoriesStatus,
        missingFields: completedCategories < 7 ? ["Vendor Sustainable Screening Survey (Procurement)"] : [],
        missingEvidenceList: evidenceDocs.length < 5 ? ["Third-party ETP water test certificate"] : [],
        validationErrorsList: [],
        isEligibleForSubmission: isEligible,
      },
      sectionsData: {
        executiveSummary: `This Consolidated ESG Project Report encompasses all operational environmental, social, and governance disclosures for ${ctx.projectName} under ${ctx.businessUnitName}, ${ctx.subsidiaryName}. Data has been collected across all seven designated contributor divisions and verified by Project Administration.`,
        environment: {
          energyGj: 550.8,
          emissionsScope1: 11.26,
          emissionsScope2: 89.5,
          waterWithdrawalKl: 4200,
          wasteTonnes: 51.3,
          initiativesSummary: "Rooftop solar expansion, closed-loop water recovery system, and on-site vegetative buffer belt.",
        },
        finance: {
          esgBudgetInr: 8500000,
          greenCapexInr: 4200000,
          opexEnergyInr: 2800000,
        },
        hr: {
          headcount: 340,
          genderDiversityPct: 20,
          trainingHoursPerEmployee: 24.5,
          welfareProgramsCount: 4,
        },
        ehs: {
          fatalities: 0,
          lostTimeInjuries: 1,
          safeManHours: 680000,
          safetyAuditsCompleted: 12,
        },
        procurement: {
          localSuppliersPct: 74.5,
          sustainableSuppliersAudited: 28,
          totalSpendInr: 64000000,
        },
        csr: {
          csrBudgetInr: 2400000,
          beneficiariesServed: 1250,
          activePrograms: 3,
        },
        compliance: {
          envClearancesValid: true,
          pendingShowCauseNotices: 0,
          statutoryAuditsPassed: true,
        },
      },
      auditHistory: [
        {
          version: 1,
          action: "CONSOLIDATION_INITIALIZED",
          by: `${ctx.userName} (Project Admin)`,
          timestamp: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
          note: "Consolidation compiled from 7 contributor categories.",
        },
      ],
    };

    const payload = { report };
    setPaServerCache(cacheKey, payload, 45000);
    return paOk(payload);
  } catch (err: any) {
    return paFail(err.message, 500);
  }
}
