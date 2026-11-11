// GET /api/copilot/suggestions — dynamic suggested prompts + landing context.
// Derived from real counts so the landing screen never shows fake numbers.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCopilotUser, copilotResponseError } from "@/lib/copilot/server";
import { getProviderConfig } from "@/lib/copilot/gateway";

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireCopilotUser(req.headers);
    const providerCfg = getProviderConfig();
    const period = req.nextUrl.searchParams.get("period") || "FY 2025-26";
    const now = Date.now();

    const [overdueCount, pendingCount, missingEvidenceCount, incompletePackages, brsrCount, subCount, anomalies] = await Promise.all([
      db.submission.count({ where: { overdue: true, status: { notIn: ["APPROVED", "REJECTED"] }, period } }),
      db.submission.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] }, period } }),
      db.validationIssue.count({ where: { status: { in: ["OPEN", "ASSIGNED"] }, rule: { in: ["MISSING_EVIDENCE", "MISSING_SUBMISSION", "MISSING_FIELD"] }, period } }),
      db.reportingPackage.count({ where: { period, readinessPct: { lt: 100 } } }),
      db.brsrReport.count({ where: { financialYear: period, status: { notIn: ["FINALIZED"] } } }),
      db.subsidiary.count({ where: { status: "ACTIVE" } }),
      db.anomalyEvent.count({ where: { status: "OPEN" } }),
    ]);

    const suggestions: { label: string; prompt: string; priority: number }[] = [];
    if (overdueCount > 0) {
      suggestions.push({ label: `Find overdue subsidiary reports (${overdueCount})`, prompt: "Find overdue subsidiary reports and summarize what needs action first.", priority: 100 });
    }
    if (pendingCount > 0) {
      suggestions.push({ label: `Investigate pending approvals (${pendingCount})`, prompt: "Investigate the submissions currently pending approval and tell me which have been waiting longest.", priority: 90 });
    }
    if (incompletePackages > 0) {
      suggestions.push({ label: `Review reporting package readiness (${incompletePackages} incomplete)`, prompt: "Review the reporting package readiness for all subsidiaries and identify the least ready ones.", priority: 85 });
    }
    if (brsrCount > 0) {
      suggestions.push({ label: "Review BRSR completeness", prompt: `Review the BRSR completeness for ${period} and list the disclosures that are still incomplete.`, priority: 80 });
    }
    if (missingEvidenceCount > 0) {
      suggestions.push({ label: `Identify missing evidence (${missingEvidenceCount})`, prompt: "Identify missing evidence and data-completeness issues across the group.", priority: 75 });
    }
    if (anomalies > 0) {
      suggestions.push({ label: `Analyze detected anomalies (${anomalies})`, prompt: "Analyze the open calculation anomalies and explain which ones matter most.", priority: 70 });
    }
    suggestions.push({ label: `Compare all ${subCount} subsidiaries`, prompt: "Compare all subsidiaries on their submission ledger performance.", priority: 60 });
    suggestions.push({ label: `Analyze Group ESG performance for ${period}`, prompt: `Analyze the Group ESG performance for ${period}.`, priority: 55 });
    suggestions.push({ label: "Summarize deadlines", prompt: `Summarize the submission deadlines for ${period} — overdue, due soon, and on track.`, priority: 50 });

    suggestions.sort((a, b) => b.priority - a.priority);

    return NextResponse.json({
      suggestions: suggestions.slice(0, 8),
      context: {
        period,
        activeSubsidiaries: subCount,
        provider: providerCfg.id,
        model: providerCfg.model,
        configured: providerCfg.configured,
      },
      user: { name: user.name, role: user.role },
    });
  } catch (e) {
    return copilotResponseError(e);
  }
}
