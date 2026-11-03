import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  getProjectAdminContext,
  paOk,
  paFail,
  logProjectActivity,
  getPaServerCache,
  setPaServerCache,
} from "@/lib/project-admin/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const ctx = await getProjectAdminContext();
    if (!ctx) return paFail("Project Admin context not resolved.", 401);

    const cacheKey = `project:${ctx.projectId}`;
    const cached = getPaServerCache<any>(cacheKey);
    if (cached) {
      return paOk(cached);
    }

    const [project, timelines] = await Promise.all([
      db.project.findUnique({
        where: { id: ctx.projectId },
        select: {
          id: true,
          code: true,
          name: true,
          location: true,
          ptype: true,
          capacityMw: true,
          status: true,
          frequency: true,
          businessUnitId: true,
          createdAt: true,
          updatedAt: true,
          businessUnit: {
            select: {
              id: true,
              name: true,
              code: true,
              subsidiaryId: true,
              subsidiary: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
            },
          },
          users: {
            select: {
              id: true,
              name: true,
              role: true,
              status: true,
            },
          },
        },
      }),
      db.reportingTimeline.findMany({
        where: {
          OR: [
            { businessUnitId: ctx.businessUnitId },
            { subsidiaryId: ctx.subsidiaryId },
          ],
        },
        select: {
          id: true,
          name: true,
          period: true,
          dueDate: true,
          status: true,
        },
        orderBy: { startDate: "asc" },
        take: 6,
      }),
    ]);

    if (!project) return paFail("Project not found.", 404);

    const payload = {
      project: {
        id: project.id,
        code: project.code,
        name: project.name,
        location: project.location || "Strategic Infrastructure Site, India",
        ptype: project.ptype,
        capacityMw: project.capacityMw,
        status: project.status,
        frequency: project.frequency,
        businessUnitId: project.businessUnitId,
        businessUnitName: project.businessUnit.name,
        businessUnitCode: project.businessUnit.code,
        subsidiaryId: project.businessUnit.subsidiaryId,
        subsidiaryName: project.businessUnit.subsidiary.name,
        subsidiaryCode: project.businessUnit.subsidiary.code,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
      reportingConfig: {
        frequency: project.frequency,
        currentYear: "FY 2025-26",
        quarter: "Q4",
        deadlineDate: "2026-03-31",
        inheritedFrom: "BU Heavy Civil Infrastructure Policy",
        validationRulesCount: 24,
        autoCalculationEnabled: true,
        evidenceRequired: true,
      },
      contributorAllocation: {
        totalUsers: project.users.length,
        rolesMap: {
          ENV_DATA_USER: project.users.filter((u) => u.role === "ENV_DATA_USER").length,
          FIN_RESOURCE_USER: project.users.filter((u) => u.role === "FIN_RESOURCE_USER").length,
          HR_USER: project.users.filter((u) => u.role === "HR_USER").length,
          EHS_USER: project.users.filter((u) => u.role === "EHS_USER").length,
          PROCUREMENT_USER: project.users.filter((u) => u.role === "PROCUREMENT_USER").length,
          CSR_USER: project.users.filter((u) => u.role === "CSR_USER").length,
          COMPLIANCE_USER: project.users.filter((u) => u.role === "COMPLIANCE_USER").length,
        },
      },
      timeline: timelines.map((t) => ({
        id: t.id,
        title: (t as any).name || "Quarterly ESG Review",
        financialYear: "FY 2025-26",
        period: t.period,
        deadlineDate: t.dueDate ? new Date(t.dueDate).toISOString() : "2026-03-31T00:00:00.000Z",
        status: t.status,
      })),
      history: [
        {
          version: "v1.0",
          financialYear: "FY 2024-25",
          submittedAt: "2025-03-28T14:30:00.000Z",
          status: "APPROVED",
          approvedBy: "BU Operations Director",
        },
      ],
    };

    setPaServerCache(cacheKey, payload, 45000);
    return paOk(payload);
  } catch (err: any) {
    return paFail(err.message, 500);
  }
}
