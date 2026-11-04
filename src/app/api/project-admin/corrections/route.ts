import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  getProjectAdminContext,
  paOk,
  paFail,
  logProjectActivity,
  getPaServerCache,
  setPaServerCache,
  invalidatePaServerCache,
} from "@/lib/project-admin/server";
import type { PaCorrectionItem } from "@/lib/project-admin/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const ctx = await getProjectAdminContext();
    if (!ctx) return paFail("Project Admin context not resolved.", 401);

    const cacheKey = `corrections:${ctx.projectId}`;
    const cached = getPaServerCache<any>(cacheKey);
    if (cached) {
      return paOk(cached);
    }

    const corrections: PaCorrectionItem[] = [
      {
        id: "corr-01",
        reportId: "rep-prj-cons-01",
        reportCode: `REP-${ctx.projectCode}-2026-Q4`,
        reportVersion: 1,
        reviewDate: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        buManagerName: "Gopal Rao (BU Manager)",
        correctionReason: "Incomplete ETP water discharge test certificate and mismatch in recycled water balance.",
        affectedCategory: "ENV_DATA_USER",
        affectedCategoryLabel: "Environment",
        affectedSection: "ENV-02 Water Consumption & Sourcing",
        responsibleUserId: "usr-env-01",
        responsibleUserName: "Er. Ramesh Iyer",
        responsibleUserEmail: "ramesh.iyer@meil.in",
        requiredAction: "Upload accredited lab testing certificate for Q4 treated effluent and reconcile discharge flow meter readings.",
        evidenceRequirement: "Third-party NABL water test report PDF (mandatory)",
        status: "AWAITING_CORRECTION",
        updatedAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
      },
      {
        id: "corr-02",
        reportId: "rep-prj-cons-01",
        reportCode: `REP-${ctx.projectCode}-2026-Q4`,
        reportVersion: 1,
        reviewDate: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
        buManagerName: "Gopal Rao (BU Manager)",
        correctionReason: "Vendor local sourcing percentage lacks tier-1 billing invoices breakdown.",
        affectedCategory: "PROCUREMENT_USER",
        affectedCategoryLabel: "Procurement",
        affectedSection: "PRO-01 Supply Chain & Sourcing Practices",
        responsibleUserId: "usr-pro-01",
        responsibleUserName: "Ravi Teja",
        responsibleUserEmail: "ravi.teja@meil.in",
        requiredAction: "Attach summary Annexure of local MSME vendor purchase orders.",
        evidenceRequirement: "Signed procurement register CSV/PDF",
        status: "IN_PROGRESS",
        updatedAt: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
      },
    ];

    const payload = {
      corrections,
      summary: {
        total: corrections.length,
        awaitingCorrection: corrections.filter((c) => c.status === "AWAITING_CORRECTION").length,
        inProgress: corrections.filter((c) => c.status === "IN_PROGRESS").length,
        resubmissionReady: corrections.filter((c) => c.status === "RESUBMISSION_READY").length,
        resolved: corrections.filter((c) => c.status === "RESOLVED").length,
      },
    };

    setPaServerCache(cacheKey, payload, 45000);
    return paOk(payload);
  } catch (err: any) {
    return paFail(err.message, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getProjectAdminContext();
    if (!ctx) return paFail("Project Admin context not resolved.", 401);

    const body = await req.json();
    const { correctionId, action, instructions, contributorId } = body;

    if (!correctionId) return paFail("Correction ID is required.");

    invalidatePaServerCache();

    if (action === "assign_task") {
      // Create task for the contributor
      const task = await db.task.create({
        data: {
          ref: `TSK-CORR-${Date.now().toString().slice(-4)}`,
          title: `BU Review Correction: ${instructions?.slice(0, 50) || "Data rectification"}`,
          description: instructions || "Please rectify submitted reporting disclosure per BU Manager review comments.",
          category: "CORRECTION",
          assigneeType: "USER",
          assigneeFilter: contributorId || ctx.userId,
          assigneeLabel: "Responsible Contributor",
          priority: "HIGH",
          status: "IN_PROGRESS",
          startDate: new Date(),
          dueDate: new Date(Date.now() + 5 * 86400 * 1000),
          businessUnitId: ctx.businessUnitId,
          subsidiaryId: ctx.subsidiaryId,
        },
      });

      await logProjectActivity({
        actorName: ctx.userName,
        actorRole: "Project Admin",
        action: "CORRECTION_ASSIGNED",
        targetType: "Correction",
        targetLabel: correctionId,
        category: "Review & Corrections",
        severity: "WARNING",
      });

      return paOk({ task }, "Correction task assigned to contributor successfully.");
    }

    if (action === "resubmit") {
      await logProjectActivity({
        actorName: ctx.userName,
        actorRole: "Project Admin",
        action: "REPORT_RESUBMITTED",
        targetType: "Report",
        targetLabel: `${ctx.projectCode} Consolidated Report (v1.1)`,
        category: "Review & Corrections",
        severity: "SUCCESS",
      });

      return paOk({}, "Updated Consolidated Report resubmitted to Business Unit Manager.");
    }

    return paFail("Unknown action.");
  } catch (err: any) {
    return paFail(err.message, 500);
  }
}
