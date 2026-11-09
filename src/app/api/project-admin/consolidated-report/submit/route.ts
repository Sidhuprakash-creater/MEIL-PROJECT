import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getProjectAdminContext, paOk, paFail, logProjectActivity, invalidatePaServerCache, paSubmissionScope } from "@/lib/project-admin/server";
import { invalidatePaConsolidatedReportCache, invalidatePuSubmissionsCache, invalidatePuOverviewCache } from "@/lib/portal-cache";

export const dynamic = "force-dynamic";

function parseJsonArray(raw: unknown): any[] {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getProjectAdminContext();
    if (!ctx) return paFail("Project Admin context not resolved.", 401);

    invalidatePaServerCache();

    const body = await req.json();
    const { reportCode, notes, selectedSubmissionIds } = body;

    // Check if BU Manager exists for this business unit
    const buManager = await db.user.findFirst({
      where: {
        businessUnitId: ctx.businessUnitId,
        role: "BU_MANAGER",
      },
    });

    const now = new Date();

    /* Use the same review scope the submissions view uses — GROUP_WIDE_REVIEW
       surfaces every project's rows, strict mode scopes to project/BU/sub. */
    const scope = paSubmissionScope(ctx);

    // If specific submissions selected, use those; otherwise use all eligible submissions in this project
    let submissionsToInclude;
    const eligibleStatuses = ["APPROVED", "BU_APPROVED", "SUBMITTED", "UNDER_REVIEW", "PENDING", "CHANGES_REQUESTED"];
    if (selectedSubmissionIds && Array.isArray(selectedSubmissionIds) && selectedSubmissionIds.length > 0) {
      submissionsToInclude = await db.submission.findMany({
        where: {
          id: { in: selectedSubmissionIds },
          projectId: ctx.projectId,
          category: { not: "CONSOLIDATED" },
          status: { in: eligibleStatuses },
        },
        select: {
          id: true,
          title: true,
          history: true,
          status: true,
          values: true,
          evidence: true,
          category: true,
          module: true,
          metricName: true,
          metricValue: true,
          metricUnit: true,
          recordIds: true,
        },
      });
    } else {
      submissionsToInclude = await db.submission.findMany({
        where: {
          projectId: ctx.projectId,
          category: { not: "CONSOLIDATED" },
          status: { in: eligibleStatuses },
        },
        select: {
          id: true,
          title: true,
          history: true,
          status: true,
          values: true,
          evidence: true,
          category: true,
          module: true,
          metricName: true,
          metricValue: true,
          metricUnit: true,
          recordIds: true,
        },
      });
    }

    const newReport = await db.report.create({
      data: {
        reportType: "ESG_SUMMARY",
        scopeType: "PROJECT",
        scopeId: ctx.projectId,
        scopeName: ctx.projectName,
        generatedBy: ctx.userId,
        generatedByName: ctx.userName,
        status: "SUBMITTED",
        fileName: `${ctx.projectCode}_Consolidated_Report_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}.pdf`,
        fileType: "PDF",
        version: 1,
        content: JSON.stringify({
          notes,
          submittedAt: now.toISOString(),
          submissionCount: submissionsToInclude.length,
          submissionIds: submissionsToInclude.map(s => s.id),
          auditHistory: [
            {
              version: 1,
              action: "CONSOLIDATED_REPORT_SUBMITTED",
              by: `${ctx.userName} (Project Admin)`,
              timestamp: now.toISOString(),
              note: `Consolidated report submitted with ${submissionsToInclude.length} approved submission(s).`,
            },
          ],
        }),
      },
    });

    const subNote = notes?.trim() || `Consolidated Project Report submitted to Business Unit Manager by ${ctx.userName}.`;

    // Aggregate real values and evidence from included submissions for the primary dossier
    const consolidatedValues: Array<{ label: string; value: any; unit: string }> = [];
    const allEvidenceIds: string[] = [];
    const allRecordIds: string[] = [];
    for (const sub of submissionsToInclude) {
      const subVals = parseJsonArray(sub.values);
      for (const v of subVals) {
        consolidatedValues.push({
          label: `[${sub.category || "General"}] ${v.label}`,
          value: v.value,
          unit: v.unit || "",
        });
      }
      const subEv = parseJsonArray(sub.evidence);
      for (const ev of subEv) {
        if (ev && !allEvidenceIds.includes(ev)) allEvidenceIds.push(ev);
      }
      const subRec = parseJsonArray(sub.recordIds);
      for (const r of subRec) {
        if (r && !allRecordIds.includes(r)) allRecordIds.push(r);
      }
    }

    const dossierRef = `DOS-${ctx.projectCode}-${Date.now().toString(36).toUpperCase()}`;
    const dossierTitle = `${ctx.projectName} — Consolidated ESG Project Report (${now.toLocaleString('default', { month: 'short' })} ${now.getFullYear()})`;

    // Upsert primary Consolidated Dossier submission so BU Manager review workspace shows the compiled dossier with realtime data
    await db.submission.upsert({
      where: { id: newReport.id },
      create: {
        id: newReport.id,
        ref: dossierRef,
        title: dossierTitle,
        category: "CONSOLIDATED",
        module: "CONSOLIDATED",
        metricName: "Consolidated Site Disclosures",
        metricValue: submissionsToInclude.length,
        metricUnit: "Disclosures",
        status: "SUBMITTED",
        period: "FY 2025-26",
        fiscalQuarter: "Q1",
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        submittedAt: now,
        projectId: ctx.projectId,
        businessUnitId: ctx.businessUnitId,
        subsidiaryId: ctx.subsidiaryId,
        submittedById: ctx.userId,
        forwardedToBu: true,
        forwardedToBuAt: now,
        inConsolidatedReport: true,
        consolidatedReportId: newReport.id,
        values: JSON.stringify(consolidatedValues),
        evidence: JSON.stringify(allEvidenceIds),
        evidenceCount: allEvidenceIds.length,
        recordIds: JSON.stringify(allRecordIds),
        completionPct: 100,
        validationPassed: 1,
        validationErrors: 0,
        history: JSON.stringify([
          {
            version: 1,
            action: "CONSOLIDATED_REPORT_SUBMITTED",
            actor: `${ctx.userName} (Project Admin)`,
            at: now.toISOString(),
            note: subNote,
          },
        ]),
      },
      update: {
        title: dossierTitle,
        status: "SUBMITTED",
        submittedAt: now,
        forwardedToBu: true,
        forwardedToBuAt: now,
        values: JSON.stringify(consolidatedValues),
        evidence: JSON.stringify(allEvidenceIds),
        evidenceCount: allEvidenceIds.length,
        recordIds: JSON.stringify(allRecordIds),
        updatedAt: now,
      },
    });

    // Mark submissions as approved, included in consolidated report, forwarded to BU and append rich history
    for (const sub of submissionsToInclude) {
      let hist: any[] = [];
      try { hist = JSON.parse(sub.history || "[]"); if (!Array.isArray(hist)) hist = []; } catch {}
      hist.push({
        id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        action: "FORWARDED_TO_BU_MANAGER",
        fromStatus: sub.status || "APPROVED",
        toStatus: "APPROVED",
        actor: ctx.userName,
        actorName: ctx.userName,
        actorRole: "Project Admin",
        at: now.toISOString(),
        createdAt: now.toISOString(),
        note: subNote,
        comment: subNote,
      });

      await db.submission.update({
        where: { id: sub.id },
        data: {
          status: "APPROVED",
          reviewerId: ctx.userId,
          reviewComment: subNote,
          reviewedAt: now,
          inConsolidatedReport: true,
          consolidatedReportId: newReport.id,
          forwardedToBu: true,
          forwardedToBuAt: now,
          history: JSON.stringify(hist),
          updatedAt: now,
        },
      });

      await db.soSubmission.updateMany({
        where: { id: sub.id },
        data: {
          status: "APPROVED",
          updatedAt: now,
        },
      });
    }

    // Notify the BU Manager(s) across this BU, subsidiary and demo hierarchy
    const buManagers = await db.user.findMany({
      where: {
        role: { in: ["BU_MANAGER", "BU_ADMIN"] },
        OR: [
          { businessUnitId: ctx.businessUnitId },
          { subsidiaryId: ctx.subsidiaryId },
          { role: "BU_MANAGER" },
        ],
      },
      select: { id: true },
    });

    for (const bm of buManagers) {
      await db.notification.create({
        data: {
          ntype: "APPROVAL_PENDING",
          title: `New Project Report Submitted: ${ctx.projectName}`,
          body: `Project Admin ${ctx.userName} has submitted the Consolidated ESG Project Report for ${ctx.projectName} (${ctx.projectCode}) with ${submissionsToInclude.length} submission(s) for your review and approval.`,
          severity: "INFO",
          linkView: "queue",
          refId: newReport.id,
          subsidiaryId: ctx.subsidiaryId,
        },
      });
    }

    await logProjectActivity({
      actorName: ctx.userName,
      actorRole: "Project Admin",
      action: "CONSOLIDATED_REPORT_SUBMITTED",
      targetType: "Report",
      targetLabel: newReport.id,
      category: "Consolidation",
      severity: "SUCCESS",
    });

    // Bust all relevant caches immediately so BU and PU views update on the spot
    invalidatePaConsolidatedReportCache();
    invalidatePaServerCache();
    invalidatePuSubmissionsCache();
    invalidatePuOverviewCache();

    return paOk(
      { report: newReport },
      `Consolidated Project Report successfully submitted to Business Unit Manager (${buManager?.name || "BU Manager"}) with ${submissionsToInclude.length} approved submission(s).`
    );
  } catch (err: any) {
    console.error("Submit consolidated report error:", err);
    return paFail(err.message, 500);
  }
}
