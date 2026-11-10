import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { smHandle, requireSubsidiaryManager } from "@/lib/sm/server";

export const dynamic = "force-dynamic";

/* GET /api/sm/final-reports
   Final consolidated reports the business units of this subsidiary have
   submitted (Business Unit Manager → Subsidiary Manager). Each entry carries
   the section totals, the per-project breakdown and the evidence index, so
   the subsidiary can review what actually travelled up. */
export async function GET(req: NextRequest) {
  return smHandle(async () => {
    const ctx = await requireSubsidiaryManager();

    const reports = await db.report.findMany({
      where: { scopeType: "SUBSIDIARY", scopeId: ctx.subsidiaryId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        reportType: true,
        scopeName: true,
        generatedBy: true,
        generatedByName: true,
        status: true,
        fileName: true,
        fileType: true,
        version: true,
        periodLabel: true,
        content: true,
        createdAt: true,
      },
    });

    const items = reports.map((r) => {
      let content: any = {};
      try {
        content = r.content ? JSON.parse(r.content) : {};
      } catch {
        content = {};
      }
      const sections = Array.isArray(content.sections) ? content.sections : [];
      return {
        id: r.id,
        fileName: r.fileName,
        fileType: r.fileType,
        status: r.status,
        version: r.version,
        period: r.periodLabel || content.period || "",
        generatedByName: r.generatedByName || "",
        businessUnit: content.businessUnit?.name || "",
        businessUnitCode: content.businessUnit?.code || "",
        subsidiaryName: content.subsidiary?.name || r.scopeName || "",
        notes: content.notes || "",
        createdAt: r.createdAt.toISOString(),
        totals: content.totals || {
          sections: sections.length,
          projects: 0,
          reports: 0,
          confirmedReports: 0,
          pendingReports: 0,
          confirmedValue: 0,
        },
        sections: sections.map((s: any) => ({
          category: s.category,
          label: s.label,
          confirmedValue: s.confirmedValue,
          unit: s.unit,
          projectCount: s.projectCount,
          reportCount: s.reportCount,
          projects: (s.projects || []).map((p: any) => ({
            projectName: p.projectName,
            confirmedValue: p.confirmedValue,
            unit: p.unit,
            evidenceCount: p.evidenceCount ?? 0,
            softCopy: p.softCopy ?? null,
          })),
        })),
      };
    });

    return Response.json({ reports: items });
  });
}
