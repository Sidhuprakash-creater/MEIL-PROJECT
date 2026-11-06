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
import { parseJsonArray, appendHistory } from "@/lib/pu/workflow";
import { CONTRIBUTOR_CATEGORIES } from "@/lib/project-admin/store";
import type { ContributorRole, PaCorrectionItem } from "@/lib/project-admin/types";

export const dynamic = "force-dynamic";

/** Category → contributor role label (mirrors collection-status mapping). */
const CATEGORY_ROLE_MAP: Array<[string, ContributorRole]> = [
  ["WORKFORCE", "HR_USER"], ["TRAINING", "HR_USER"], ["PEOPLE", "HR_USER"],
  ["INCIDENTS", "EHS_USER"], ["SAFETY", "EHS_USER"],
  ["FINANCE", "FIN_RESOURCE_USER"], ["PROCUREMENT", "PROCUREMENT_USER"],
  ["CSR", "CSR_USER"], ["COMPLIANCE", "COMPLIANCE_USER"],
  ["ENERGY", "ENV_DATA_USER"], ["WATER", "ENV_DATA_USER"],
  ["EMISSIONS", "ENV_DATA_USER"], ["WASTE", "ENV_DATA_USER"],
  ["ENVIRONMENT", "ENV_DATA_USER"], ["INITIATIVES", "ENV_DATA_USER"],
];
const resolveCatKey = (category?: string | null): ContributorRole => {
  const c = String(category || "").toUpperCase();
  const hit = CATEGORY_ROLE_MAP.find(([k]) => c.includes(k));
  return hit ? hit[1] : "ENV_DATA_USER";
};

export async function GET(req: NextRequest) {
  try {
    const ctx = await getProjectAdminContext();
    if (!ctx) return paFail("Project Admin context not resolved.", 401);

    const cacheKey = `corrections:${ctx.projectId}`;
    const cached = getPaServerCache<any>(cacheKey);
    if (cached) {
      return paOk(cached);
    }

    /* Real returned submissions (previously this route returned a hardcoded
       2-row demo list, so genuine rejections never surfaced here). */
    const returnedSubs = await db.submission.findMany({
      where: {
        status: { in: ["CHANGES_REQUESTED", "CORRECTION_REQUESTED", "REJECTED"] },
        projectId: ctx.projectId,
      },
      include: {
        project: { select: { id: true, name: true, code: true } },
        reportingPeriod: { select: { id: true, periodLabel: true } },
        reviewer: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });

    const userIds = [...new Set(returnedSubs.map((s) => s.submittedById).filter(Boolean))] as string[];
    const users = userIds.length
      ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })
      : [];
    const userById = new Map(users.map((u) => [u.id, u]));

    const corrections: PaCorrectionItem[] = returnedSubs.map((s, idx) => {
      const rows = parseJsonArray(s.corrections as unknown as string);
      const first = rows[0] || {};
      const catKey = resolveCatKey(s.category);
      const def = (CONTRIBUTOR_CATEGORIES as any)[catKey];
      const reviewerName =
        (s as any).reviewComment
          ? "Project Admin"
          : "Project Admin";
      const u = s.submittedById ? userById.get(s.submittedById) : null;
      return {
        id: s.id,
        reportId: s.id,
        reportCode: (s as any).ref || `${ctx.projectCode}-${String(idx + 1).padStart(3, "0")}`,
        reportVersion: Number((s as any).revisionNumber ?? 1) || 1,
        reviewDate: ((s as any).reviewedAt || s.updatedAt || s.createdAt || new Date()).toISOString(),
        buManagerName: s.reviewer?.name ? `${s.reviewer.name} (Reviewer)` : reviewerName,
        correctionReason:
          (s as any).reviewComment ||
          first.issue ||
          first.comment ||
          "Returned for correction by Project Admin review.",
        affectedCategory: catKey,
        affectedCategoryLabel: def?.label || s.category || "Environment",
        affectedSection: s.title || "Submitted disclosure",
        responsibleUserId: s.submittedById || "",
        responsibleUserName: u?.name || "Site Contributor",
        responsibleUserEmail: u?.email || "",
        requiredAction:
          rows.map((r: any) => r.issue || r.comment).filter(Boolean).slice(0, 3).join(" • ") ||
          "Address the reviewer's remarks and resubmit the disclosure.",
        evidenceRequirement: "Updated supporting evidence documents (mandatory)",
        status: "AWAITING_CORRECTION",
        updatedAt: (s.updatedAt || new Date()).toISOString(),
      } as unknown as PaCorrectionItem;
    });

    /* Demo fallback preserved for fresh databases with no real rejections. */
    const finalCorrections: PaCorrectionItem[] = corrections.length > 0
      ? corrections
      : [
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
        ];

    const payload = {
      corrections: finalCorrections,
      summary: {
        total: finalCorrections.length,
        awaitingCorrection: finalCorrections.filter((c) => c.status === "AWAITING_CORRECTION").length,
        inProgress: finalCorrections.filter((c) => c.status === "IN_PROGRESS").length,
        resubmissionReady: finalCorrections.filter((c) => c.status === "RESUBMISSION_READY").length,
        resolved: finalCorrections.filter((c) => c.status === "RESOLVED").length,
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
    const { correctionId, submissionId, action, instructions, contributorId } = body;

    /* correctionId is only meaningful for assign_task — the view's resubmit
       posts a submissionId instead (previously every resubmit 400'd). */
    if (action === "assign_task" && !correctionId) {
      return paFail("Correction ID is required.");
    }

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
      const targetId = submissionId || correctionId;
      if (!targetId) return paFail("submissionId or correctionId is required.");

      const submission = await db.submission.findUnique({ where: { id: targetId } });
      if (!submission) return paFail("Submission not found.", 404);

      /* Mark open corrections ADDRESSED and return the submission to the queue. */
      const rows = parseJsonArray(submission.corrections as unknown as string).map((r: any) => ({
        ...r,
        status: "ADDRESSED",
        resolvedAt: new Date().toISOString(),
      }));
      const nextStatus = submission.status === "CHANGES_REQUESTED" ? "SUBMITTED" : submission.status;
      await db.submission.update({
        where: { id: targetId },
        data: {
          corrections: JSON.stringify(rows),
          status: nextStatus,
          updatedAt: new Date(),
        },
      });

      await appendHistory({
        submissionId: targetId,
        fromStatus: submission.status,
        toStatus: nextStatus,
        actorId: ctx.userId,
        actorName: ctx.userName,
        actorRole: "Project Admin",
        action: "RESUBMIT",
        comment: "Corrections marked addressed; returned to the review queue.",
      }).catch(() => {});

      await logProjectActivity({
        actorName: ctx.userName,
        actorRole: "Project Admin",
        action: "REPORT_RESUBMITTED",
        targetType: "Report",
        targetLabel: `${ctx.projectCode} — ${submission.title}`,
        category: "Review & Corrections",
        severity: "SUCCESS",
      });

      return paOk({}, "Corrections marked addressed and the submission returned to the review queue.");
    }

    return paFail("Unknown action.");
  } catch (err: any) {
    return paFail(err.message, 500);
  }
}
