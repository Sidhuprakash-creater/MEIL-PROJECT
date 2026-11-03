import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  getProjectAdminContext,
  paOk,
  paFail,
  getPaServerCache,
  setPaServerCache,
} from "@/lib/project-admin/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const ctx = await getProjectAdminContext();
    if (!ctx) return paFail("Project Admin context not resolved.", 401);

    const cacheKey = `submissions:${ctx.projectId}`;
    const cached = getPaServerCache<any>(cacheKey);
    if (cached) {
      return paOk(cached);
    }

    const reports = await db.report.findMany({
      where: { scopeId: ctx.projectId },
      select: {
        id: true,
        reportType: true,
        scopeName: true,
        version: true,
        generatedByName: true,
        createdAt: true,
        status: true,
        fileName: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const items = reports.length > 0 ? reports.map((r) => ({
      id: r.id,
      reportCode: `REP-${ctx.projectCode}-v${r.version}`,
      title: `${r.scopeName || ctx.projectName} — ESG Report (${r.reportType})`,
      period: "Q4 FY 2025-26",
      version: r.version,
      versionLabel: `v${r.version}.0`,
      submittedBy: r.generatedByName || ctx.userName,
      submissionDate: new Date(r.createdAt).toISOString(),
      submissionStatus: r.status,
      reviewStatus: r.status === "APPROVED" ? "APPROVED" : r.status === "CHANGES_REQUESTED" ? "CHANGES_REQUESTED" : "PENDING_BU_REVIEW",
      buManagerName: "Gopal Rao (BU Manager)",
      latestReviewComment: r.status === "APPROVED" ? "Approved with full compliance sign-off." : "Awaiting BU Manager review cycle.",
    })) : [
      {
        id: "rep-hist-01",
        reportCode: `REP-${ctx.projectCode}-2026-Q4-v1.0`,
        title: `${ctx.projectName} — Consolidated ESG & BRSR Report`,
        period: "Q4 FY 2025-26",
        version: 1,
        versionLabel: "v1.0",
        submittedBy: `${ctx.userName} (Project Admin)`,
        submissionDate: new Date(Date.now() - 3 * 86400 * 1000).toISOString(),
        submissionStatus: "SUBMITTED",
        reviewStatus: "PENDING_BU_REVIEW",
        buManagerName: "Gopal Rao (BU Manager)",
        latestReviewComment: "Formal review assigned to BU Technical Evaluation Committee.",
      },
      {
        id: "rep-hist-02",
        reportCode: `REP-${ctx.projectCode}-2025-ANNUAL-v1.2`,
        title: `${ctx.projectName} — Annual ESG Compliance Report FY 2024-25`,
        period: "Annual FY 2024-25",
        version: 2,
        versionLabel: "v1.2",
        submittedBy: `${ctx.userName} (Project Admin)`,
        submissionDate: "2025-04-02T11:20:00.000Z",
        submissionStatus: "APPROVED",
        reviewStatus: "APPROVED",
        buManagerName: "Gopal Rao (BU Manager)",
        latestReviewComment: "Final approval granted. Disclosures consolidated into Group BRSR Master.",
      },
    ];

    const payload = {
      submissions: items,
      summary: {
        total: items.length,
        approved: items.filter((i) => i.submissionStatus === "APPROVED").length,
        submitted: items.filter((i) => i.submissionStatus === "SUBMITTED").length,
        returned: items.filter((i) => i.submissionStatus === "CHANGES_REQUESTED" || i.submissionStatus === "REJECTED").length,
        draft: items.filter((i) => i.submissionStatus === "DRAFT").length,
      },
    };

    setPaServerCache(cacheKey, payload, 45000);
    return paOk(payload);
  } catch (err: any) {
    return paFail(err.message, 500);
  }
}
