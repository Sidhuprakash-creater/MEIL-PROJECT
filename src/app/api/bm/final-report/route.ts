import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/esg/server";
import { bmHandle, requireBuManager, getBuOrThrow, bmNotify, bmLogActivity, bmLogAudit, buSubmissionScope } from "@/lib/bm/server";
import { buildBuRollup } from "@/lib/bm/rollup";

export const dynamic = "force-dynamic";

/* POST /api/bm/final-report
   The Business Unit Manager signs off the consolidated rollup and hands the
   FINAL report to the Subsidiary (Subsidiary Manager console). The payload
   carries the section sums, the per-project breakdown, the evidence index
   and the soft copy of every project's own consolidated report. */
export async function POST(req: NextRequest) {
  return bmHandle(async () => {
    const ctx = await requireBuManager();
    const bu = await getBuOrThrow(ctx.businessUnitId);

    let body: { notes?: string; period?: string } = {};
    try {
      body = await req.json();
    } catch {
      /* body optional */
    }

    const scope = await buSubmissionScope(ctx.businessUnitId);
    const rollup = await buildBuRollup({
      businessUnitId: ctx.businessUnitId,
      subsidiaryId: ctx.subsidiaryId,
      period: body.period && body.period !== "ALL" ? body.period : "",
      buName: bu.name,
      subsidiaryName: bu.subsidiary?.name ?? "",
      buProjectIds: scope.projectIds,
    });

    if (rollup.totals.confirmedReports === 0) {
      return fail(
        "Nothing to submit yet — approve at least one project report before sending the final report to the subsidiary.",
        400,
      );
    }

    const now = new Date();
    const fileName = `${bu.code}_Final_ESG_Report_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}.pdf`;

    const report = await db.report.create({
      data: {
        reportType: "ESG_SUMMARY",
        scopeType: "SUBSIDIARY",
        scopeId: ctx.subsidiaryId,
        scopeName: bu.subsidiary?.name ?? "",
        generatedBy: ctx.userId,
        generatedByName: ctx.name,
        status: "SUBMITTED",
        fileName,
        fileType: "PDF",
        version: 1,
        reportingYear: new Date().getFullYear(),
        periodLabel: rollup.period,
        content: JSON.stringify({
          notes: body.notes?.trim() || "",
          generatedAt: now.toISOString(),
          generatedBy: ctx.name,
          businessUnit: { id: bu.id, code: bu.code, name: bu.name },
          subsidiary: { id: ctx.subsidiaryId, name: bu.subsidiary?.name ?? "" },
          period: rollup.period,
          totals: rollup.totals,
          sections: rollup.sections.map((s) => ({
            category: s.category,
            label: s.label,
            confirmedValue: s.confirmedValue,
            pendingValue: s.pendingValue,
            unit: s.unit,
            reportCount: s.reportCount,
            projectCount: s.projectCount,
            projects: s.projects.map((p) => ({
              projectId: p.projectId,
              projectName: p.projectName,
              confirmedValue: p.confirmedValue,
              unit: p.unit,
              reportRefs: p.reportRefs,
              evidenceCount: p.evidenceFiles.length + p.generalEvidence.length,
              evidenceFiles: [...p.evidenceFiles, ...p.generalEvidence].map((f) => ({
                id: f.id, name: f.name, fileType: f.fileType, sizeKb: f.sizeKb,
                filePath: f.filePath ?? null, hasFile: f.hasFile,
              })),
              softCopy: p.dossier
                ? { id: p.dossier.id, ref: p.dossier.ref, fileName: p.dossier.fileName }
                : null,
            })),
          })),
          confirmedSubmissionIds: rollup.confirmedSubmissionIds,
          auditHistory: [
            {
              version: 1,
              action: "FINAL_REPORT_SUBMITTED_TO_SUBSIDIARY",
              by: `${ctx.name} (BU Manager, ${bu.name})`,
              timestamp: now.toISOString(),
              note: `Final consolidated report submitted to ${bu.subsidiary?.name ?? "the subsidiary"} — ${rollup.totals.confirmedReports} approved report(s) across ${rollup.totals.projects} project(s).`,
            },
          ],
        }),
      },
    });

    /* Stamp the trail on every report that travelled with this final report
       so the PA can see the full chain: project → BU → subsidiary. */
    if (rollup.confirmedSubmissionIds.length > 0) {
      const subs = await db.submission.findMany({
        where: { id: { in: rollup.confirmedSubmissionIds } },
        select: { id: true, history: true },
      });
      await Promise.all(
        subs.map((s) => {
          let hist: any[] = [];
          try {
            hist = JSON.parse(s.history || "[]");
            if (!Array.isArray(hist)) hist = [];
          } catch {}
          hist.push({
            id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            action: "FINAL_REPORT_SUBMITTED_TO_SUBSIDIARY",
            actor: ctx.name,
            actorName: ctx.name,
            actorRole: "BU Manager",
            at: now.toISOString(),
            createdAt: now.toISOString(),
            note: `Included in the final consolidated report of ${bu.name}, submitted to ${bu.subsidiary?.name ?? "the subsidiary"}.`,
            comment: body.notes?.trim() || "",
          });
          return db.submission.update({ where: { id: s.id }, data: { history: JSON.stringify(hist) } });
        }),
      );
    }

    /* One null-scope notification = broadcast → the Subsidiary Manager
       console bell rings on every console (same contract as BU decisions). */
    await bmNotify({
      ntype: "REPORT",
      title: `Final ESG report submitted: ${bu.name}`,
      body: `${ctx.name} (BU Manager, ${bu.name}) submitted the consolidated ESG report to ${bu.subsidiary?.name ?? "the subsidiary"} — ${rollup.totals.confirmedReports} approved report(s) across ${rollup.totals.projects} project(s), ${rollup.totals.sections} section(s).`,
      severity: "SUCCESS",
      linkView: "reports-bu",
      refId: report.id,
    });

    await bmLogActivity(ctx, bu.name, {
      action: "FINAL_REPORT_SUBMITTED",
      targetType: "Business Unit",
      targetLabel: bu.name,
      severity: "SUCCESS",
    });

    await bmLogAudit(ctx, bu.code, {
      action: "FINAL_REPORT_SUBMITTED",
      targetType: "Report",
      targetId: report.id,
      targetLabel: fileName,
      after: {
        businessUnitId: bu.id,
        subsidiaryId: ctx.subsidiaryId,
        period: rollup.period,
        sections: rollup.totals.sections,
        projects: rollup.totals.projects,
        reports: rollup.totals.confirmedReports,
      },
      reason: body.notes?.trim() || "Final consolidated report signed off by the Business Unit Manager.",
    });

    return ok(
      {
        report: {
          id: report.id,
          fileName: report.fileName,
          status: report.status,
          scopeType: "SUBSIDIARY",
          scopeName: bu.subsidiary?.name ?? "",
          createdAt: report.createdAt.toISOString(),
        },
        totals: rollup.totals,
      },
      { status: 201 },
    );
  });
}
