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
  paSubmissionScope,
  paSoSubmissionScope,
} from "@/lib/project-admin/server";
import { CONTRIBUTOR_CATEGORIES } from "@/lib/project-admin/store";
import { getLevelRecords, updateLevelRecordStatus } from "@/lib/pu/level-records";
import { parseJsonArray } from "@/lib/pu/workflow";
import { invalidatePuOverviewCache, invalidatePuSubmissionsCache, invalidatePuNotificationsCache } from "@/lib/portal-cache";
import type { ContributorRole } from "@/lib/project-admin/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const ctx = await getProjectAdminContext();
    if (!ctx) return paFail("Project Admin context not resolved.", 401);

    /* Same bypass contract as the submissions route: ?bypass=true or the
       x-bypass-cache header skips the 45s server cache (client sets bypass=true
       when it needs guaranteed-fresh data after a mutation). */
    const bypassCache = req.nextUrl.searchParams.get("bypass") === "true" || req.headers.get("x-bypass-cache") === "true";
    const cacheKey = `collection-status:${ctx.projectId}`;
    const cached = !bypassCache ? getPaServerCache<any>(cacheKey) : null;
    if (cached) {
      return paOk(cached);
    }

    // Parallel fetch of submissions, SO submissions, users, and evidence docs with lean selects
    const [submissions, soSubmissions, users, evidenceDocs] = await Promise.all([
      db.submission.findMany({
        where: paSubmissionScope(ctx),
        select: {
          id: true,
          projectId: true,
          category: true,
          module: true,
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
          values: true,
          corrections: true,
          reviewComment: true,
          completionPct: true,
        },
        orderBy: { updatedAt: "desc" },
      }),
      db.soSubmission.findMany({
        where: paSoSubmissionScope(ctx),
        select: {
          id: true,
          module: true,
          title: true,
          status: true,
          submittedBy: true,
          submittedAt: true,
          updatedAt: true,
          recordIds: true,
          reportingPeriodId: true,
        },
        orderBy: { updatedAt: "desc" },
      }),
      db.user.findMany({
        where: {
          OR: [
            { projectId: ctx.projectId },
            { businessUnitId: ctx.businessUnitId },
            { subsidiaryId: ctx.subsidiaryId },
          ],
        },
        select: { id: true, name: true, role: true, email: true },
      }),
      db.evidenceDoc.findMany({
        where: { projectId: ctx.projectId },
        select: { id: true, submissionId: true, name: true },
      }),
    ]);

    /* Project cards for the full-window review (id → project info). */
    const projectIds = [...new Set(submissions.map((s) => (s as any).projectId).filter(Boolean))];
    const projects = projectIds.length
      ? await db.project.findMany({
          where: { id: { in: projectIds } },
          select: {
            id: true, code: true, name: true, location: true, ptype: true,
            capacityMw: true, status: true,
            businessUnit: { select: { name: true } },
          },
        })
      : [];
    const projectById = new Map(projects.map((p) => [p.id, p]));

    const userMap = new Map(users.map((u) => [u.id, u]));
    /* Contributors whose user record sits outside this admin's scope (they
       submitted into a project covered via a different scope arm) would show
       blank names/roles — fetch them directly. */
    const missingSubmitterIds = [
      ...new Set(
        [
          ...submissions.map((s) => s.submittedById),
          ...soSubmissions.map((s) => s.submittedBy),
        ].filter((id): id is string => Boolean(id) && !userMap.has(String(id))),
      ),
    ];
    if (missingSubmitterIds.length > 0) {
      const extras = await db.user.findMany({
        where: { id: { in: missingSubmitterIds } },
        select: { id: true, name: true, email: true, role: true },
      });
      for (const u of extras) userMap.set(u.id, u);
    }

    /* Sequenced level records + real evidence names for the review dialog.
       Level records live under the SUBMISSION's project — which can differ
       from the admin's scoped project when a submission surfaces via the
       business-unit/subsidiary scope arms — so load records for every project
       present in the list, not just ctx.projectId. */
    const recordProjectIds = new Set<string>([
      ctx.projectId,
      ...submissions.map((s) => (s as any).projectId).filter(Boolean),
    ]);
    const allRecords = getLevelRecords().filter((r) => recordProjectIds.has(r.projectId));
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
    const toEvidenceRef = (eid: string) => {
      const e = evidenceById.get(eid);
      return {
        id: eid,
        fileName: e?.fileName || eid,
        documentType: e?.documentType || null,
      };
    };
    const recordsFor = (rawRecordIds: unknown) => {
      let rids: string[] = [];
      try { rids = typeof rawRecordIds === "string" ? JSON.parse(rawRecordIds) : rawRecordIds || []; } catch {}
      return rids
        .map((rid) => recordById.get(rid))
        .filter(Boolean)
        .map((rec) => {
          const recItems = Array.isArray(rec!.data?.items) ? rec!.data.items : [];
          const recEvidenceIds = [
            ...(rec!.evidenceId ? [rec!.evidenceId] : []),
            ...((Array.isArray(rec!.evidenceIds) ? rec!.evidenceIds : []) as string[]),
          ].filter(Boolean) as string[];
          return {
            recordId: rec!.id,
            level: rec!.level,
            levelName: rec!.levelName,
            recordStatus: rec!.status,
            validationStatus: rec!.validationStatus,
            calculation: rec!.calculation || null,
            createdAt: rec!.enteredAt ?? null,
            updatedAt: rec!.updatedAt,
            /* Flat form fields for records without staged items (forms, declarations). */
            fields:
              recItems.length === 0
                ? Object.entries(rec!.data || {})
                    .filter(([k]) => k !== "items")
                    .map(([k, v]) => ({ k, v: v as any }))
                : [],
            /* Record-level evidence vault refs (same shape as item evidence). */
            evidence: [...new Set(recEvidenceIds)].map(toEvidenceRef),
            items: recItems.map((it: any) => ({
              ...it,
              evidenceFileNames: [
                ...(Array.isArray(it?.evidenceFiles) ? it.evidenceFiles : []),
                ...((Array.isArray(it?.evidenceIds) ? it.evidenceIds : it?.evidenceId ? [it.evidenceId] : []) as string[])
                  .map((eid) => evidenceById.get(eid)?.fileName)
                  .filter(Boolean),
              ],
              /* Clickable evidence resolution (id → file preview/download). */
              evidence: (
                [...new Set([
                  ...((Array.isArray(it?.evidenceIds) ? it.evidenceIds : []) as string[]),
                  ...(it?.evidenceId ? [it.evidenceId] : []),
                ])] as string[]
              )
                .filter(Boolean)
                .map(toEvidenceRef),
            })),
          };
        });
    };
    const userByRoleMap = new Map(users.map((u) => [u.role, u]));
    const evidenceBySubMap = new Set(evidenceDocs.map((e) => e.submissionId).filter(Boolean));
    /* Workspace (site-ops) submissions are ALSO mirrored into db.submission
       with the same recordIds — dedupe by recordIds overlap, not by row id
       (the mirror gets its own cuid, so id comparison never matches). */
    const mirroredRecordIds = new Set<string>();
    for (const m of submissions) for (const rid of parseJsonArray(m.recordIds)) mirroredRecordIds.add(String(rid));

    // Combine standard and SO submissions
    const allList = [
      ...submissions.map((s, idx) => ({
        id: s.id,
        /* Carried through so the review window can resolve the project card. */
        projectId: (s as any).projectId || null,
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
        hasEvidence: evidenceBySubMap.has(s.id) || (s.recordIds ? parseJsonArray(s.recordIds).length > 0 : false),
      })),
      /* Site-ops submissions — enriched with their LevelRecords (via recordIds)
         and the real reporting period, so the review window shows full
         per-source details for HR / EHS / Finance / Procurement / CSR /
         Compliance submissions exactly like the environment user's. */
      ...soSubmissions
        .filter((s) => !parseJsonArray(s.recordIds).some((rid) => mirroredRecordIds.has(String(rid))))
        .map((s) => {
          const soSourceRecords = recordsFor(s.recordIds);
          /* Real evidence check — never fabricate a COMPLETE badge. */
          const hasRealEvidence =
            soSourceRecords.some(
              (r: any) =>
                (r.evidence?.length || 0) > 0 ||
                (r.items || []).some((it: any) => (it.evidence?.length || 0) > 0 || (it.evidenceFileNames?.length || 0) > 0),
            ) || parseJsonArray(s.recordIds).length > 0;
          return {
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
            period: periodLabelById.get(s.reportingPeriodId || "") || "—",
            sourceRecords: soSourceRecords,
            hasEvidence: hasRealEvidence,
          };
        }),
    ];

    /* Explicit category/module → contributor-role mapping. The previous
       substring + row-index fallback mis-assigned whole categories (e.g. an
       ENERGY submission labeled "Finance") because 'ENVIRONMENT' never
       contains 'ENV_DATA' and unmatched rows fell through to idx % length. */
    const CATEGORY_ROLE_MAP: Array<[string, ContributorRole]> = [
      ["WORKFORCE", "HR_USER"], ["TRAINING", "HR_USER"], ["PEOPLE", "HR_USER"], ["HR", "HR_USER"],
      ["INCIDENTS", "EHS_USER"], ["SAFETY", "EHS_USER"], ["EHS", "EHS_USER"],
      ["FINANCE", "FIN_RESOURCE_USER"],
      ["PROCUREMENT", "PROCUREMENT_USER"],
      ["CSR", "CSR_USER"],
      ["COMPLIANCE", "COMPLIANCE_USER"],
      ["ENERGY", "ENV_DATA_USER"], ["WATER", "ENV_DATA_USER"],
      ["EMISSIONS", "ENV_DATA_USER"], ["WASTE", "ENV_DATA_USER"],
      ["ENVIRONMENT", "ENV_DATA_USER"], ["INITIATIVES", "ENV_DATA_USER"],
    ];
    const resolveCatKey = (category?: string | null): ContributorRole => {
      const c = String(category || "").toUpperCase();
      const hit = CATEGORY_ROLE_MAP.find(([k]) => c.includes(k));
      return hit ? hit[1] : "ENV_DATA_USER";
    };

    const items = allList.map((s) => {
      const catKey = resolveCatKey(s.category);

      const def = (CONTRIBUTOR_CATEGORIES as any)[catKey];
      const u = s.submittedById ? userMap.get(s.submittedById) : userByRoleMap.get(catKey);

      const due = s.dueDate ? new Date(s.dueDate) : new Date("2026-03-31T00:00:00.000Z");
      /* Terminal / in-review states can never be "overdue" — only unworked
         (NOT_STARTED / DRAFT) or returned rows age past their due date. */
      const OVERDUE_EXEMPT = new Set([
        "APPROVED", "SUBMITTED", "BU_APPROVED", "SUBSIDIARY_APPROVED", "HQ_REVIEW", "LOCKED",
      ]);
      const isOverdue = Boolean(s.overdue || (!OVERDUE_EXEMPT.has(s.status) && due.getTime() < Date.now()));

      let subStatus: string = "NOT_STARTED";
      if (s.status === "APPROVED" || s.status === "BU_APPROVED" || s.status === "LOCKED") subStatus = "APPROVED";
      else if (s.status === "SUBMITTED") subStatus = "SUBMITTED";
      else if (s.status === "UNDER_REVIEW" || s.status === "ASSIGNED" || s.status === "RESUBMITTED") subStatus = "UNDER_REVIEW";
      else if (s.status === "CHANGES_REQUESTED" || s.status === "CORRECTION_REQUESTED" || s.status === "REJECTED") subStatus = "RETURNED";
      else if (s.status === "DRAFT") subStatus = "DRAFT";

      /* Review-window extras: parsed values, existing reviewer corrections and
         the general review comment — so the full-window view shows the exact
         rejection marks the contributor sees. */
      let correctionsArr: any[] = [];
      let parsedValues: any[] = [];
      try {
        const c = typeof (s as any).corrections === "string" ? JSON.parse((s as any).corrections || "[]") : (s as any).corrections;
        if (Array.isArray(c)) correctionsArr = c;
      } catch {}
      try {
        const pv = typeof (s as any).values === "string" ? JSON.parse((s as any).values || "[]") : (s as any).values;
        if (Array.isArray(pv)) parsedValues = pv;
      } catch {}

      const proj = projectById.get((s as any).projectId) || null;

      return {
        id: s.id,
        category: catKey,
        categoryLabel: def?.label || s.category,
        assignedUserId: u?.id || s.submittedById || "",
        assignedUserName: u?.name || s.responsibleName || def?.defaultAssignee || "Site Contributor",
        assignedUserEmail: u?.email || "",
        assignedUserDbRole: u?.role || "",
        sectionCode: `${catKey.slice(0, 3)}-01`,
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
        parsedValues,
        corrections: correctionsArr,
        reviewComment: (s as any).reviewComment || null,
        reviewStatus: (s as any).status || "",
        completionPct: (s as any).completionPct ?? null,
        revisionNumber: (s as any).revisionNumber ?? null,
        project: proj
          ? {
              name: proj.name,
              code: proj.code,
              location: proj.location || "",
              ptype: proj.ptype || "",
              capacityMw: proj.capacityMw ?? null,
              status: proj.status || "",
              businessUnitName: (proj as any).businessUnit?.name || "",
            }
          : null,
        updatedAt: s.updatedAt ? new Date(s.updatedAt).toISOString() : new Date().toISOString(),
      };
    });

    const payload = {
      items,
      summary: {
        total: items.length,
        submitted: items.filter((i) => i.submissionStatus === "SUBMITTED" || i.submissionStatus === "APPROVED").length,
        /* Pending Review = awaiting an admin decision — includes freshly SUBMITTED rows. */
        pending: items.filter((i) => i.submissionStatus === "SUBMITTED" || i.submissionStatus === "UNDER_REVIEW" || i.submissionStatus === "NOT_STARTED").length,
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
    /* Bust the PU portal caches too so contributors see approve/reject
       decisions without waiting for the client/server TTLs. */
    invalidatePuOverviewCache();
    invalidatePuSubmissionsCache();
    invalidatePuNotificationsCache();

    if (action === "approve") {
      const sub = await db.submission.findUnique({
        where: { id: submissionId },
        select: { id: true, title: true, submittedById: true, recordIds: true, subsidiaryId: true },
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

      // 2. Sync the site-ops twin — both the row with THIS id and any
      //    soSubmission whose recordIds overlap (workspace submissions are
      //    mirrored into db.submission with a different cuid, so the SO
      //    user's Submissions tab must follow the PA decision too).
      const approvedRids: string[] = parseJsonArray(sub?.recordIds).map((x) => String(x));
      /* Unscoped fetch — under group-wide review the twin row can live in a
         different project than ctx; the recordIds overlap bounds the match. */
      const soRowsForSync = await db.soSubmission.findMany({
        select: { id: true, recordIds: true },
      });
      const soApprovedIds = soRowsForSync
        .filter(
          (r) => r.id === submissionId || parseJsonArray(r.recordIds).some((rid) => approvedRids.includes(String(rid))),
        )
        .map((r) => r.id);
      await db.soSubmission.updateMany({
        where: { id: { in: soApprovedIds.length ? soApprovedIds : [submissionId] } },
        data: {
          status: "APPROVED",
          reviewComment: comments || "Approved by Project Admin.",
          updatedAt: new Date(),
        },
      });

      // Sync underlying records to ACTIVE — both the Prisma mirrors (env
      // levels) AND the JSON LevelRecords every module stores (so HR / EHS /
      // Finance / Procurement / CSR / Compliance records activate too).
      /* recordIds may live on the db.submission mirror OR on the soSubmission
         row itself (pure site-ops submissions have no mirror). */
      let recordIdList: string[] = parseJsonArray(sub?.recordIds).map((x) => String(x));
      if (recordIdList.length === 0) {
        const soRow = await db.soSubmission.findUnique({
          where: { id: submissionId },
          select: { recordIds: true },
        });
        recordIdList = parseJsonArray(soRow?.recordIds).map((x) => String(x));
      }
      if (recordIdList.length > 0) {
        try {
          const rids = recordIdList;
          await Promise.allSettled([
            db.energyRecord.updateMany({ where: { id: { in: rids } }, data: { status: "ACTIVE" } }),
            db.waterRecord.updateMany({ where: { id: { in: rids } }, data: { status: "ACTIVE" } }),
            db.wasteRecord.updateMany({ where: { id: { in: rids } }, data: { status: "ACTIVE" } }),
          ]);
          for (const rid of rids) {
            try { updateLevelRecordStatus(String(rid), "ACTIVE"); } catch {}
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
          /* Notify under the SUBMISSION's subsidiary — with group-wide review
             the contributor may sit outside the admin's own subsidiary. */
          subsidiaryId: sub?.subsidiaryId || ctx.subsidiaryId,
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
      const rejectionReason =
        comments?.trim() || "Project Admin requested clarification and evidence re-submission.";

      // 1. Update Submission status (+ reviewer note so the contributor sees WHY)
      await db.submission.updateMany({
        where: { id: submissionId },
        data: {
          status: "CHANGES_REQUESTED",
          reviewerId: ctx.userId,
          reviewComment: rejectionReason,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      /* Sync the site-ops twin row(s) — same id OR overlapping recordIds (the
         workspace mirror gets a different cuid). SO workflow natively uses
         CORRECTION_REQUESTED (CHANGES_REQUESTED is a dead status there: no
         Resubmit button, no allowed transition), so write that + the reason. */
      const subRow = await db.submission.findUnique({
        where: { id: submissionId },
        select: { recordIds: true, subsidiaryId: true },
      });
      const returnedRids: string[] = parseJsonArray(subRow?.recordIds).map((x) => String(x));
      /* Unscoped fetch — see the approve branch note (group-wide review). */
      const soRowsForSync = await db.soSubmission.findMany({
        select: { id: true, recordIds: true },
      });
      const soReturnedIds = soRowsForSync
        .filter(
          (r) => r.id === submissionId || parseJsonArray(r.recordIds).some((rid) => returnedRids.includes(String(rid))),
        )
        .map((r) => r.id);
      await db.soSubmission.updateMany({
        where: { id: { in: soReturnedIds.length ? soReturnedIds : [submissionId] } },
        data: {
          status: "CORRECTION_REQUESTED",
          reviewComment: rejectionReason,
          currentReviewerId: ctx.userId,
          updatedAt: new Date(),
        },
      });

      // 2. Automatically create a corrective task for the contributor
      const taskRef = `CORR-${ctx.projectCode}-${Date.now().toString().slice(-4)}`;
      /* Resolve the contributor's name so the Task Assignments table shows a
         human label (assigneeLabel is matched by name on the tasks screen). */
      const assignee = assignedUserId
        ? await db.user.findUnique({ where: { id: assignedUserId }, select: { name: true } })
        : null;
      await db.task.create({
        data: {
          ref: taskRef,
          title: `Action Required: Data Correction for ${category || "Metric"}`,
          description: comments || "Project Admin requested clarification and evidence re-submission.",
          category: category || "ENVIRONMENT",
          assigneeType: "USER",
          assigneeLabel: assignee?.name || assignedUserId || "Contributor",
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
          /* Notify under the SUBMISSION's subsidiary (group-wide review). */
          subsidiaryId: subRow?.subsidiaryId || ctx.subsidiaryId,
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

    if (action === "remind") {
      const sub = await db.submission.findUnique({
        where: { id: submissionId },
        select: { id: true, title: true, submittedById: true },
      });

      // Notify the contributor (mirror of the approve-branch notification shape)
      await db.notification.create({
        data: {
          ntype: "DEADLINE",
          title: `Reminder: ${sub?.title || "Site ESG Record"}`,
          body: `Project Admin ${ctx.userName} reminded you to complete and submit the pending data for ${ctx.projectName}.`,
          severity: "WARNING",
          linkView: "submissions",
          refId: sub?.submittedById || submissionId,
          subsidiaryId: ctx.subsidiaryId,
        },
      });

      await logProjectActivity({
        actorName: ctx.userName,
        actorRole: "Project Admin",
        action: "REMINDER_SENT",
        targetType: "Submission",
        targetLabel: sub?.title || submissionId,
        category: "Compliance",
        severity: "INFO",
      });

      return paOk({ submissionId }, "Reminder sent to contributor successfully.");
    }

    return paFail("Unknown action requested.", 400);
  } catch (err: any) {
    return paFail(err.message, 500);
  }
}
