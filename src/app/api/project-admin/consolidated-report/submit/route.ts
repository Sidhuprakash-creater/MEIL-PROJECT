import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getProjectAdminContext, paOk, paFail, logProjectActivity, invalidatePaServerCache } from "@/lib/project-admin/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const ctx = await getProjectAdminContext();
    if (!ctx) return paFail("Project Admin context not resolved.", 401);

    invalidatePaServerCache();

    const body = await req.json();
    const { reportCode, notes } = body;

    // Check if BU Manager exists for this business unit
    const buManager = await db.user.findFirst({
      where: {
        businessUnitId: ctx.businessUnitId,
        role: "BU_MANAGER",
      },
    });

    const newReport = await db.report.create({
      data: {
        reportType: "ESG_SUMMARY",
        scopeType: "PROJECT",
        scopeId: ctx.projectId,
        scopeName: ctx.projectName,
        generatedBy: ctx.userId,
        generatedByName: ctx.userName,
        status: "SUBMITTED",
        fileName: `${ctx.projectCode}_Consolidated_Report_FY24-25.pdf`,
        fileType: "PDF",
        version: 1,
        content: JSON.stringify({ notes, submittedAt: new Date().toISOString() }),
      },
    });

    // Notify the BU Manager
    if (buManager) {
      await db.notification.create({
        data: {
          ntype: "SUBMISSION",
          title: `New Project Report Submitted: ${ctx.projectName}`,
          body: `Project Admin ${ctx.userName} has submitted the Consolidated ESG Project Report for ${ctx.projectName} (${ctx.projectCode}) for your review and approval.`,
          severity: "INFO",
          linkView: "submissions",
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

    return paOk(
      { report: newReport },
      `Consolidated Project Report successfully submitted to Business Unit Manager (${buManager?.name || "BU Manager"}).`
    );
  } catch (err: any) {
    return paFail(err.message, 500);
  }
}
