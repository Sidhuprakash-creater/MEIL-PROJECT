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
import { CONTRIBUTOR_CATEGORIES } from "@/lib/project-admin/store";
import { getLevelRecords } from "@/lib/pu/level-records";
import type { ContributorRole } from "@/lib/project-admin/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const ctx = await getProjectAdminContext();
    if (!ctx) return paFail("Project Admin context not resolved.", 401);

    const cacheKey = `collection-status:${ctx.projectId}`;
    const cached = getPaServerCache<any>(cacheKey);
    if (cached) {
      return paOk(cached);
    }

    // Parallel fetch of submissions, SO submissions, users, and evidence docs with lean selects
    const [submissions, soSubmissions, users, evidenceDocs] = await Promise.all([
      db.submission.findMany({
        where: {
          OR: [
            { projectId: ctx.projectId },
            { businessUnitId: ctx.businessUnitId },
          ],
        },
        select: {
          id: true,
          category: true,
          title: true,
          status: true,
          submittedById: true,
          dueDate: true,
          overdue: true,
          submittedAt: true,
          updatedAt: true,
          metricValue: true,
          metricUnit: true,
          reportingPeriodId: true,
          recordIds: true,
        },
        orderBy: { updatedAt: "desc" },
      }),
      db.soSubmission.findMany({
        where: { projectId: ctx.projectId },
        select: {
          id: true,
          module: true,
          title: true,
          status: true,
          submittedBy: true,
          submittedAt: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
      }),
      db.user.findMany({
        where: {
          OR: [
            { projectId: ctx.projectId },
            { businessUnitId: ctx.businessUnitId },
          ],
        },
        select: { id: true, name: true, role: true, email: true },
      }),
      db.evidenceDoc.findMany({
        where: { projectId: ctx.projectId },
        select: { id: true, submissionId: true, name: true },
      }),
    ]);

    const userMap = new Map(users.map((u) => [u.id, u]));

    /* Sequenced level records + real evidence names for the review dialog. */
    const allRecords = getLevelRecords(ctx.projectId);
    const recordById = new Map(allRecords.map((r) => [r.id, r]));
    const periods = await db.reportingPeriod.findMany({ select: { id: true, periodLabel: true } });
    const periodLabelById = new Map(periods.map((p) => [p.id, p.periodLabel]));
    const evidenceIdSet = new Set<string>();
    for (const s of submissions) {
      let rids: string[] = [];
      try { rids = typeof s.recordIds === "string" ? JSON.parse(s.recordIds) : s.recordIds || []; } catch {}
      for (const rid of rids) {
        const rec = recordById.get(rid);
        if (!rec) continue;
        if (rec.evidenceId) evidenceIdSet.add(rec.evidenceId);
        for (const it of Array.isArray(rec.data?.items) ? rec.data.items : []) {
          if (it?.evidenceId) evidenceIdSet.add(it.evidenceId);
          for (const eid of Array.isArray(it?.evidenceIds) ? it.evidenceIds : []) if (eid) evidenceIdSet.add(eid);
        }
      }
    }
    const evidenceRows = evidenceIdSet.size
      ? await db.evidence.findMany({ where: { id: { in: [...evidenceIdSet] } }, select: { id: true, fileName: true, documentType: true, filePath: true } })
      : [];
    const evidenceById = new Map(evidenceRows.map((e) => [e.id, e]));
    const recordsFor = (rawRecordIds: unknown) => {
      let rids: string[] = [];
      try { rids = typeof rawRecordIds === "string" ? JSON.parse(rawRecordIds) : rawRecordIds || []; } catch {}
      return rids
        .map((rid) => recordById.get(rid))
        .filter(Boolean)
        .map((rec) => ({
          recordId: rec!.id,
          level: rec!.level,
          levelName: rec!.levelName,
          recordStatus: rec!.status,
          validationStatus: rec!.validationStatus,
          items: (Array.isArray(rec!.data?.items) ? rec!.data.items : []).map((it: any) => ({
            ...it,
            evidenceFileNames: [
              ...(Array.isArray(it?.evidenceFiles) ? it.evidenceFiles : []),
              ...((Array.isArray(it?.evidenceIds) ? it.evidenceIds : it?.evidenceId ? [it.evidenceId] : []) as string[])
                .map((eid) => evidenceById.get(eid)?.fileName)
                .filter(Boolean),
            ],
          })),
        }));
    };
    const userByRoleMap = new Map(users.map((u) => [u.role, u]));
    const evidenceBySubMap = new Set(evidenceDocs.map((e) => e.submissionId).filter(Boolean));

    // Combine standard and SO submissions
    const allList = [
      ...submissions.map((s, idx) => ({
        id: s.id,
        category: s.category || "ENVIRONMENT",
        title: s.title,
        status: s.status,
        submittedById: s.submittedById,
        responsibleName: s.submittedById || "Site Operations Team",
        dueDate: s.dueDate,
        overdue: s.overdue,
        submittedAt: s.submittedAt,
        updatedAt: s.updatedAt,
        metricValue: s.metricValue,
        metricUnit: s.metricUnit,
        period: periodLabelById.get(s.reportingPeriodId || "") || s.reportingPeriodId || "Q4 FY 2025-26",
        sourceRecords: recordsFor(s.recordIds),
        hasEvidence: evidenceBySubMap.has(s.id) || (s.recordIds ? JSON.parse(String(s.recordIds)).length > 0 : false),
      })),
      ...soSubmissions.map((s, idx) => ({
        id: s.id,
        category: s.module,
        title: s.title || `${s.module} Data Package (Site Operations)`,
        status: s.status,
        submittedById: s.submittedBy,
        responsibleName: s.submittedBy || "Site Operations Team",
        dueDate: null,
        overdue: false,
        submittedAt: s.submittedAt,
        updatedAt: s.updatedAt,
        metricValue: null,
        metricUnit: null,
        period: "Q4 FY 2025-26",
        hasEvidence: true,
      })),
    ];

    const categoryKeys = Object.keys(CONTRIBUTOR_CATEGORIES) as ContributorRole[];

    const items = allList.map((s, idx) => {
      const catKey = (categoryKeys.find(
        (k) => s.category?.toUpperCase().includes(k.replace("_USER", ""))
      ) || categoryKeys[idx % categoryKeys.length]) as ContributorRole;

      const def = (CONTRIBUTOR_CATEGORIES as any)[catKey];
      const u = s.submittedById ? userMap.get(s.submittedById) : userByRoleMap.get(catKey);

      const due = s.dueDate ? new Date(s.dueDate) : new Date("2026-03-31T00:00:00.000Z");
      const isOverdue = Boolean(s.overdue || (s.status !== "APPROVED" && s.status !== "SUBMITTED" && due.getTime() < Date.now()));

      let subStatus: string = "NOT_STARTED";
      if (s.status === "APPROVED" || s.status === "BU_APPROVED") subStatus = "APPROVED";
      else if (s.status === "SUBMITTED") subStatus = "SUBMITTED";
      else if (s.status === "UNDER_REVIEW" || s.status === "ASSIGNED") subStatus = "UNDER_REVIEW";
      else if (s.status === "CHANGES_REQUESTED" || s.status === "REJECTED") subStatus = "RETURNED";
      else if (s.status === "DRAFT") subStatus = "DRAFT";

      return {
        id: s.id,
        category: catKey,
        categoryLabel: def?.label || s.category,
        assignedUserId: u?.id || s.submittedById || "",
        assignedUserName: u?.name || s.responsibleName || def?.defaultAssignee || "Site Contributor",
        sectionCode: `${catKey.slice(0, 3)}-0${(idx % 4) + 1}`,
        sectionName: s.title || `${def?.label || 'General'} Metric Disclosure`,
        period: s.period,
        submissionStatus: subStatus,
        evidenceStatus: s.hasEvidence ? "COMPLETE" : "MISSING",
        submissionDate: s.submittedAt ? new Date(s.submittedAt).toISOString() : null,
        dueDate: due.toISOString(),
        overdue: isOverdue,
        metricValue: s.metricValue,
        metricUnit: s.metricUnit,
        sourceRecords: (s as any).sourceRecords || [],
        updatedAt: s.updatedAt ? new Date(s.updatedAt).toISOString() : new Date().toISOString(),
      };
    });

    const payload = {
      items,
      summary: {
        total: items.length,
        submitted: items.filter((i) => i.submissionStatus === "SUBMITTED" || i.submissionStatus === "APPROVED").length,
        pending: items.filter((i) => i.submissionStatus === "UNDER_REVIEW" || i.submissionStatus === "NOT_STARTED").length,
        draft: items.filter((i) => i.submissionStatus === "DRAFT").length,
        returned: items.filter((i) => i.submissionStatus === "RETURNED").length,
        overdue: items.filter((i) => i.overdue).length,
      },
    };

    setPaServerCache(cacheKey, payload, 45000);
    return paOk(payload);
  } catch (err: any) {
    return paFail(err.message, 500);
  }
}

// POST: Project Admin Approvals & Corrections Workflow
export async function POST(req: NextRequest) {
  try {
    const ctx = await getProjectAdminContext();
    if (!ctx) return paFail("Project Admin context not resolved.", 401);

    const body = await req.json();
    const { action, submissionId, comments, category, assignedUserId } = body;

    if (!submissionId) return paFail("submissionId is required.", 400);

    invalidatePaServerCache(); // Invalidate server cache on mutation

    if (action === "approve") {
      const sub = await db.submission.findUnique({
        where: { id: submissionId },
        select: { id: true, title: true, submittedById: true, recordIds: true },
      });

      // 1. Try updating Submission
      await db.submission.updateMany({
        where: { id: submissionId },
        data: {
          status: "APPROVED",
          reviewerId: ctx.userId,
          reviewComment: comments || "Approved by Project Admin.",
          reviewedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // 2. Try updating SoSubmission if it exists
      await db.soSubmission.updateMany({
        where: { id: submissionId },
        data: {
          status: "APPROVED",
          updatedAt: new Date(),
        },
      });

      // Sync underlying records to ACTIVE
      if (sub?.recordIds) {
        try {
          const rids = typeof sub.recordIds === "string" ? JSON.parse(sub.recordIds) : sub.recordIds;
          if (Array.isArray(rids)) {
            await Promise.allSettled([
              db.energyRecord.updateMany({ where: { id: { in: rids } }, data: { status: "ACTIVE" } }),
              db.waterRecord.updateMany({ where: { id: { in: rids } }, data: { status: "ACTIVE" } }),
              db.wasteRecord.updateMany({ where: { id: { in: rids } }, data: { status: "ACTIVE" } }),
            ]);
          }
        } catch {}
      }

      // 3. Notify the assigned contributor
      await db.notification.create({
        data: {
          ntype: "APPROVAL",
          title: `Submission Approved: ${sub?.title || "Site ESG Record"}`,
          body: `Project Admin ${ctx.userName} approved your data submission for ${ctx.projectName}.`,
          severity: "SUCCESS",
          linkView: "submissions",
          refId: sub?.submittedById || submissionId,
          subsidiaryId: ctx.subsidiaryId,
        },
      });

      await logProjectActivity({
        actorName: ctx.userName,
        actorRole: "Project Admin",
        action: "SUBMISSION_APPROVED",
        targetType: "Submission",
        targetLabel: submissionId,
        category: category || "Compliance",
        severity: "SUCCESS",
      });

      return paOk({ submissionId, status: "APPROVED" }, "Submission approved successfully.");
    }

    if (action === "request_correction" || action === "reject") {
      // 1. Update Submission status
      await db.submission.updateMany({
        where: { id: submissionId },
        data: {
          status: "CHANGES_REQUESTED",
          updatedAt: new Date(),
        },
      });

      await db.soSubmission.updateMany({
        where: { id: submissionId },
        data: {
          status: "CHANGES_REQUESTED",
          updatedAt: new Date(),
        },
      });

      // 2. Automatically create a corrective task for the contributor
      const taskRef = `CORR-${ctx.projectCode}-${Date.now().toString().slice(-4)}`;
      await db.task.create({
        data: {
          ref: taskRef,
          title: `Action Required: Data Correction for ${category || "Metric"}`,
          description: comments || "Project Admin requested clarification and evidence re-submission.",
          category: category || "ENVIRONMENT",
          assigneeType: "USER",
          assigneeLabel: assignedUserId || "Contributor",
          businessUnitId: ctx.businessUnitId,
          subsidiaryId: ctx.subsidiaryId,
          priority: "HIGH",
          status: "ASSIGNED",
          startDate: new Date(),
          dueDate: new Date(Date.now() + 3 * 86400 * 1000), // 3 days
          requiresEvidence: true,
        },
      });

      // 3. Send notification to contributor
      await db.notification.create({
        data: {
          ntype: "DEADLINE",
          title: "Correction Requested by Project Admin",
          body: `Notes: "${comments || "Please check submitted metrics and attach supporting evidence."}"`,
          severity: "WARNING",
          linkView: "corrections",
          refId: submissionId,
          subsidiaryId: ctx.subsidiaryId,
        },
      });

      await logProjectActivity({
        actorName: ctx.userName,
        actorRole: "Project Admin",
        action: "CORRECTION_REQUESTED",
        targetType: "Submission",
        targetLabel: submissionId,
        category: category || "Quality Control",
        severity: "WARNING",
      });

      return paOk(
        { submissionId, status: "CHANGES_REQUESTED", taskRef },
        "Correction request dispatched to contributor lead."
      );
    }

    return paFail("Unknown action requested.", 400);
  } catch (err: any) {
    return paFail(err.message, 500);
  }
}
