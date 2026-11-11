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
  paOwnsSubmission,
} from "@/lib/project-admin/server";

import { ensureLevelRecordsLoaded, getLevelRecords, updateLevelRecordStatus, type LevelRecord } from "@/lib/pu/level-records";
import { invalidatePuSubmissionsCache, invalidatePuOverviewCache, invalidatePuNotificationsCache, invalidateSubmittedReportsCache, invalidatePaConsolidatedReportCache } from '@/lib/portal-cache'

export const dynamic = "force-dynamic";

/* Row shapes matching each query's select clause (schema-verified) — used to
   type the empty-query ternary branches below so the Promise.all
   destructuring stays precise instead of collapsing to `any`. */
type ScopedUserRow = { id: string; name: string; email: string; role: string };
type EvidenceRowShape = {
  id: string;
  fileName: string;
  documentType: string;
  filePath: string;
  hash: string | null;
  status: string;
  fileSize: number;
};

function parseJsonArray(raw: unknown): any[] {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  /* Hydrate the level-records store from the DB blob before first read (Vercel read-only FS). */
  await ensureLevelRecordsLoaded().catch(() => {});
  try {
    const ctx = await getProjectAdminContext();
    if (!ctx) return paFail("Project Admin context not resolved.", 401);

    const bypassCache = req.nextUrl.searchParams.get("bypass") === "true" || req.headers.get("x-bypass-cache") === "true";
    const cacheKey = `submissions:${ctx.projectId}`;
    const cached = !bypassCache ? getPaServerCache<any>(cacheKey) : null;
    if (cached) {
      return paOk(cached);
    }

    // Parallel fetch: Project Contributor Submissions, Site Ops Submissions, Reports, and Users
    const [submissions, soSubmissions, reports, users] = await Promise.all([
      db.submission.findMany({
        where: paSubmissionScope(ctx),
        select: {
          id: true,
          ref: true,
          title: true,
          category: true,
          module: true,
          status: true,
          metricName: true,
          metricValue: true,
          metricUnit: true,
          completionPct: true,
          evidenceCount: true,
          evidence: true,
          values: true,
          recordIds: true,
          submittedById: true,
          submittedAt: true,
          reviewerId: true,
          reviewComment: true,
          reviewedAt: true,
          history: true,
          forwardedToBu: true,
          forwardedToBuAt: true,
          dueDate: true,
          overdue: true,
          updatedAt: true,
          createdAt: true,
          reportingPeriodId: true,
          project: {
            select: { id: true, name: true, code: true },
          },
          reportingPeriod: {
            select: { id: true, periodLabel: true, year: true },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 200,
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
        },
        orderBy: { updatedAt: "desc" },
      }),
      db.report.findMany({
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
      }),
      db.user.findMany({
        where: {
          OR: [
            { projectId: ctx.projectId },
            { businessUnitId: ctx.businessUnitId },
            { subsidiaryId: ctx.subsidiaryId },
          ],
        },
        select: { id: true, name: true, email: true, role: true },
      }),
    ]);

    const userMap = new Map(users.map((u) => [u.id, u]));

    /* Group-wide review surfaces submissions whose submitter sits outside the
       admin's project/BU/subsidiary scope — their user rows are fetched below
       so names/roles don't fall back to "Site Contributor". */
    const missingSubmitterIds = [
      ...new Set(
        submissions
          .map((s) => s.submittedById)
          .filter((id): id is string => Boolean(id) && !userMap.has(String(id))),
      ),
    ];

    /* Enrichment: load the underlying level records (per-source items the user
       actually entered) and the real Evidence rows so the admin sees exactly
       what was captured — not just aggregates. Records live under the
       SUBMISSION's project, which can differ from the admin's scoped project
       when a submission surfaces via the BU/subsidiary scope arms, so load
       records for every project present in the list. */
    const recordProjectIds = new Set<string>([
      ctx.projectId,
      ...submissions.map((s) => s.project?.id).filter(Boolean),
    ] as string[]);
    const allLevelRecords: LevelRecord[] = getLevelRecords().filter((r) =>
      recordProjectIds.has(r.projectId),
    );
    const recordById = new Map(allLevelRecords.map((r) => [r.id, r]));

    const referencedEvidenceIds = new Set<string>();
    for (const s of submissions) {
      for (const rid of parseJsonArray(s.recordIds)) {
        const rec = recordById.get(rid);
        if (!rec) continue;
        if (rec.evidenceId) referencedEvidenceIds.add(rec.evidenceId);
        for (const it of Array.isArray(rec.data?.items) ? rec.data.items : []) {
          if (it?.evidenceId) referencedEvidenceIds.add(it.evidenceId);
          for (const eid of Array.isArray(it?.evidenceIds) ? it.evidenceIds : []) {
            if (eid) referencedEvidenceIds.add(eid);
          }
        }
      }
    }

    /* Both follow-up queries are mutually independent — out-of-scope
       contributor names and evidence rows — so they run as ONE parallel DB
       round (1 round-trip instead of two sequential ~1s round-trips). */
    const [extraUsers, evidenceRows] = await Promise.all([
      missingSubmitterIds.length
        ? db.user.findMany({
            where: { id: { in: missingSubmitterIds } },
            select: { id: true, name: true, email: true, role: true },
          })
        : Promise.resolve([] as ScopedUserRow[]),
      referencedEvidenceIds.size
        ? db.evidence.findMany({
            where: { id: { in: [...referencedEvidenceIds] } },
            select: { id: true, fileName: true, documentType: true, filePath: true, hash: true, status: true, fileSize: true },
          })
        : Promise.resolve([] as EvidenceRowShape[]),
    ]);
    for (const u of extraUsers) userMap.set(u.id, u);
    const evidenceById = new Map<string, EvidenceRowShape>(evidenceRows.map((e) => [e.id, e]));

    // Map site submissions into unified rich display items
    const siteItems = submissions.map((s, idx) => {
      const u = s.submittedById ? userMap.get(s.submittedById) : null;
      const subDate = s.submittedAt || s.createdAt || s.updatedAt;
      const submitterName = u?.name || "Site Contributor";
      const submitterEmail = u?.email || "";
      const submitterRole = u?.role === "ENV_DATA_USER" ? "Site Data Entry" : (u?.role || "Site Contributor");
      const period = s.reportingPeriod?.periodLabel || s.reportingPeriodId || "Q4 FY 2025-26";
      const refCode = s.ref || `SUB-${ctx.projectCode}-${(s.category || "ENV").slice(0, 4)}-${(idx + 1).toString().padStart(3, "0")}`;

      // Accurate human-readable Date & Time (e.g. 04 Nov 2026 • 10:28:40 PM)
      const d = new Date(subDate);
      const datePart = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      const timePart = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
      const formattedDateTime = `${datePart} • ${timePart}`;

      // Safely parse rich recorded values
      let parsedValues: Array<{ label: string; value: string | number; unit?: string }> = [];
      try {
        if ((s as any).values) {
          const parsed = JSON.parse((s as any).values);
          if (Array.isArray(parsed)) parsedValues = parsed;
        }
      } catch {}

      if (parsedValues.length === 0 && s.metricValue != null && s.metricValue > 0) {
        parsedValues.push({
          label: s.metricName || "Recorded Value",
          value: s.metricValue,
          unit: s.metricUnit || "",
        });
      }

      // Safely parse attached evidence — real file names only, no fabricated fallbacks
      let evidenceList: string[] = [];
      try {
        if ((s as any).evidence) {
          const parsed = JSON.parse((s as any).evidence);
          if (Array.isArray(parsed)) evidenceList = parsed.filter(Boolean);
        }
      } catch {}

      /* Per-source items straight from the submitted level records, plus the
         real Evidence rows they reference. */
      const sourceRecords: Array<{
        recordId: string;
        level: number;
        levelName: string;
        recordStatus: string;
        validationStatus: string;
        items: any[];
      }> = [];
      const evidenceFiles: Array<{
        id: string;
        fileName: string;
        documentType: string;
        filePath: string;
        hash: string | null;
        status: string;
      }> = [];
      const seenEvidence = new Set<string>();
      for (const rid of parseJsonArray(s.recordIds)) {
        const rec = recordById.get(rid);
        if (!rec) continue;
        sourceRecords.push({
          recordId: rec.id,
          level: rec.level,
          levelName: rec.levelName,
          recordStatus: rec.status,
          validationStatus: rec.validationStatus,
          items: Array.isArray(rec.data?.items) ? rec.data.items : [],
        });
        const recEvidenceIds = new Set<string>();
        if (rec.evidenceId) recEvidenceIds.add(rec.evidenceId);
        for (const it of sourceRecords[sourceRecords.length - 1].items) {
          if (it?.evidenceId) recEvidenceIds.add(it.evidenceId);
          for (const eid of Array.isArray(it?.evidenceIds) ? it.evidenceIds : []) {
            if (eid) recEvidenceIds.add(eid);
          }
        }
        for (const eid of recEvidenceIds) {
          const ev = evidenceById.get(eid);
          if (ev && !seenEvidence.has(ev.id)) {
            seenEvidence.add(ev.id);
            evidenceFiles.push(ev);
          }
        }
      }

      // Corrections previously raised on this submission (per-field review notes)
      const corrections = parseJsonArray((s as any).corrections);

      /* Only count as approved what the Project Manager (Subsidiary Manager)
         actually approved — surfaced so the PA "Approved" surfaces mirror the
         PM's decisions instead of the PA's own sign-off stage. Detected via
         the PM's decision history entry or the reviewer's role. */
      const pmApproved = (() => {
        const hist = parseJsonArray((s as any).history);
        const pmApprovalInHistory = hist.some(
          (h: any) => typeof h?.action === "string" && h.action.startsWith("Approved") && h.action.includes("Subsidiary Manager")
        );
        const reviewerRole = s.reviewerId ? userMap.get(String(s.reviewerId))?.role : null;
        return pmApprovalInHistory || reviewerRole === "SUBSIDIARY_MANAGER";
      })();

      let reviewStatus = "PENDING_ADMIN_REVIEW";
      if (s.status === "APPROVED" || s.status === "BU_APPROVED") reviewStatus = "APPROVED";
      else if (s.status === "LOCKED") reviewStatus = "LOCKED";
      else if (s.status === "CHANGES_REQUESTED" || s.status === "REJECTED" || s.status === "CORRECTION_REQUESTED") reviewStatus = "CHANGES_REQUESTED";
      else if (s.status === "DRAFT") reviewStatus = "DRAFT";
      else if (s.status === "SUBMITTED" || s.status === "UNDER_REVIEW") reviewStatus = "PENDING_ADMIN_REVIEW";

      return {
        id: s.id,
        reportCode: refCode,
        title: s.title,
        category: s.category || "ENVIRONMENT",
        module: s.module || s.category || "General",
        period,
        version: 1,
        versionLabel: "v1.0",
        submittedBy: `${submitterName} (${submitterRole})`,
        submitterName,
        submitterEmail,
        submitterRole,
        submitterId: s.submittedById || "",
        submissionDate: new Date(subDate).toISOString(),
        formattedDateTime,
        datePart,
        timePart,
        parsedValues,
        submissionStatus: s.status,
        reviewStatus,
        pmApproved,
        forwardedToBu: (s as any).forwardedToBu ?? false,
        forwardedToBuAt: (s as any).forwardedToBuAt ? new Date((s as any).forwardedToBuAt).toISOString() : null,
        metricName: s.metricName || "",
        metricUnit: s.metricUnit || "",
        metricValue: s.metricValue != null && s.metricValue > 0 ? `${s.metricValue} ${s.metricUnit || ""}`.trim() : (parsedValues[0]?.value ? `${parsedValues[0].value} ${parsedValues[0].unit || ""}`.trim() : null),
        evidenceList,
        evidenceFiles,
        sourceRecords,
        corrections,
        evidenceCount: evidenceList.length || evidenceFiles.length,
        buManagerName: "Er. K. Venkataramana (Project Admin)",
        projectName: s.project?.name || ctx.projectName,
        projectCode: s.project?.code || ctx.projectCode,
        latestReviewComment:
          s.reviewComment ||
          (s.status === "APPROVED"
            ? "Approved by Project Admin with complete data verification."
            : s.status === "CHANGES_REQUESTED" || s.status === "CORRECTION_REQUESTED"
              ? "Correction requested by Project Admin."
              : "Submitted by Site Contributor. Ready for Project Admin review & sign-off."),
        isSiteSubmission: true,
      };
    });

    // Map consolidated dossier reports
    const reportItems = reports.map((r) => {
      const d = new Date(r.createdAt);
      const datePart = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      const timePart = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
      const formattedDateTime = `${datePart} • ${timePart}`;

      return {
        id: r.id,
        reportCode: `REP-${ctx.projectCode}-v${r.version}`,
        title: `${r.scopeName || ctx.projectName} — Consolidated ESG Report (${r.reportType})`,
        category: "CONSOLIDATED",
        module: "REPORT",
        period: "Q4 FY 2025-26",
        version: r.version,
        versionLabel: `v${r.version}.0`,
        submittedBy: `${r.generatedByName || ctx.userName} (Project Admin)`,
        submitterName: r.generatedByName || ctx.userName,
        submitterEmail: "admin@site.meil.in",
        submitterId: ctx.userId,
        submissionDate: new Date(r.createdAt).toISOString(),
        formattedDateTime,
        datePart,
        timePart,
        submissionStatus: r.status,
        reviewStatus:
          r.status === "APPROVED" || r.status === "BU_APPROVED"
            ? "APPROVED"
            : r.status === "CHANGES_REQUESTED"
              ? "CHANGES_REQUESTED"
              : "PENDING_BU_REVIEW",
        metricValue: "Consolidated Pack",
        evidenceCount: 1,
        buManagerName: "Gopal Rao (BU Manager)",
        latestReviewComment:
          r.status === "APPROVED" || r.status === "BU_APPROVED"
            ? "Final approval granted by BU Manager."
            : "Submitted to Business Unit Manager for formal quarterly review.",
        isSiteSubmission: false,
      };
    });

    const allItems = [...siteItems, ...reportItems];

    const payload = {
      submissions: allItems,
      summary: {
        total: allItems.length,
        approved: allItems.filter(
          (i) =>
            (i.submissionStatus === "APPROVED" ||
              i.submissionStatus === "BU_APPROVED" ||
              i.submissionStatus === "LOCKED" ||
              i.reviewStatus === "APPROVED" ||
              i.reviewStatus === "BU_APPROVED") &&
            /* Site submissions only count once the Project Manager approved them */
            (i.isSiteSubmission ? (i as any).pmApproved : true)
        ).length,
        submitted: allItems.filter(
          (i) =>
            i.submissionStatus === "SUBMITTED" ||
            i.submissionStatus === "UNDER_REVIEW" ||
            i.reviewStatus === "PENDING_ADMIN_REVIEW" ||
            i.reviewStatus === "PENDING_BU_REVIEW"
        ).length,
        returned: allItems.filter(
          (i) =>
            i.submissionStatus === "CHANGES_REQUESTED" ||
            i.submissionStatus === "REJECTED" ||
            i.submissionStatus === "CORRECTION_REQUESTED" ||
            i.reviewStatus === "CHANGES_REQUESTED"
        ).length,
        draft: allItems.filter(
          (i) => i.submissionStatus === "DRAFT" || i.reviewStatus === "DRAFT"
        ).length,
      },
    };

    setPaServerCache(cacheKey, payload, 30000); // 30s cache with instant invalidation
    return paOk(payload);
  } catch (err: any) {
    return paFail(err.message, 500);
  }
}

// POST: Project Admin Review Decision & Reminders Workflow
export async function POST(req: NextRequest) {
  /* Hydrate the level-records store from the DB blob before first read (Vercel read-only FS). */
  await ensureLevelRecordsLoaded().catch(() => {});
  try {
    const ctx = await getProjectAdminContext();
    if (!ctx) return paFail("Project Admin context not resolved.", 401);

    const body = await req.json();
    const { action, submissionId, comments, priority, dueDate } = body;

    /* 0. FORWARD-TO-BU — DISABLED. The Business Unit now reviews ONE
       consolidated dossier per submission cycle. Individual approved
       disclosures are never sent to the BU one by one; the Project Admin
       must compile them via the Consolidated Report flow instead. */
    if (action === "forward-to-bu") {
      return paFail(
        "Individual forwarding is disabled — compile the approved disclosures into the Consolidated Report and submit that single dossier to the Business Unit.",
        400,
      );
    }

    if (!submissionId) return paFail("submissionId is required.", 400);

    /* SCOPE: a Project Admin may only act on reports of THEIR project. */
    if (!(await paOwnsSubmission(ctx, submissionId))) {
      return paFail("This report belongs to another project — you can only review your own project's disclosures.", 403);
    }

    // Invalidate caches immediately so all views reflect updates instantly
    invalidatePaServerCache();
    invalidatePuSubmissionsCache();
    invalidatePuOverviewCache();
    invalidatePuNotificationsCache();

    // 1. APPROVE WORKFLOW
    if (action === "approve") {
      const now = new Date();
      const approvalNote = comments?.trim() || "Approved by Project Admin with complete data verification.";

      // Fetch submission to get submitter & record details. We also read the
      // forward flags: a re-approval must NOT resurrect an item the PA already
      // sent to the Business Unit (it would reappear in the Approved Dataset).
      const sub = await db.submission.findUnique({
        where: { id: submissionId },
        select: {
          id: true,
          title: true,
          category: true,
          module: true,
          submittedById: true,
          recordIds: true,
          status: true,
          forwardedToBu: true,
        },
      });
      const alreadyForwarded = !!sub?.forwardedToBu;

      // Update db.submission — status flips to APPROVED and, for a fresh
      // (never-forwarded) item, it is staged in the Approved Dataset +
      // Consolidated Report. It is NOT auto-forwarded to the Business Unit:
      // the PA decides when to send the whole batch from the Approved Dataset
      // view (action "forward-to-bu"). Items already delivered to the BU keep
      // their forward state and stay hidden from the staging view.
      await db.submission.updateMany({
        where: { id: submissionId },
        data: {
          status: "APPROVED",
          reviewerId: ctx.userId,
          reviewComment: approvalNote,
          reviewedAt: now,
          updatedAt: now,
          inConsolidatedReport: true,
          forwardedToBu: false,
          forwardedToBuAt: null,
        },
      });

      // Append to submission history: APPROVED (staged for the BU handoff)
      const subForHist = await db.submission.findUnique({ where: { id: submissionId }, select: { history: true } });
      if (subForHist) {
        let hist: any[] = [];
        try { hist = JSON.parse(subForHist.history || "[]"); if (!Array.isArray(hist)) hist = []; } catch {}
        hist.push({
          id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          action: "APPROVED",
          fromStatus: "SUBMITTED",
          toStatus: "APPROVED",
          actor: ctx.userName,
          actorName: ctx.userName,
          actorRole: "Project Admin",
          at: now.toISOString(),
          createdAt: now.toISOString(),
          note: `${approvalNote} — staged in the Approved Dataset, pending consolidated Business Unit handoff.`,
          comment: approvalNote,
        });
        await db.submission.update({ where: { id: submissionId }, data: { history: JSON.stringify(hist) } });
      }

      // Update soSubmission if exists
      await db.soSubmission.updateMany({
        where: { id: submissionId },
        data: {
          status: "APPROVED",
          updatedAt: now,
        },
      });

      // Sync underlying records (EnergyRecord, WaterRecord, WasteRecord, etc.) to ACTIVE/APPROVED
      if (sub?.recordIds) {
        try {
          const rids = typeof sub.recordIds === "string" ? JSON.parse(sub.recordIds) : sub.recordIds;
          if (Array.isArray(rids)) {
            /* Flip the JSON-store LevelRecords too — the Data Entry screen
               reads its record statuses from there, not from the mirrors. */
            for (const rid of rids) updateLevelRecordStatus(rid, "ACTIVE");
            await Promise.allSettled([
              db.energyRecord.updateMany({ where: { id: { in: rids } }, data: { status: "ACTIVE" } }),
              db.waterRecord.updateMany({ where: { id: { in: rids } }, data: { status: "ACTIVE" } }),
              db.wasteRecord.updateMany({ where: { id: { in: rids } }, data: { status: "ACTIVE" } }),
              db.safetyRecord.updateMany({ where: { id: { in: rids } }, data: { status: "ACTIVE" } }),
              db.workforceRecord.updateMany({ where: { id: { in: rids } }, data: { status: "ACTIVE" } }),
            ]);
          }
        } catch {}
      }

      // Notify the submitter / environment user directly
      const targetUserId = sub?.submittedById;
      await db.notification.create({
        data: {
          ntype: "APPROVAL",
          title: `Submission Approved: ${sub?.title || "Site ESG Record"}`,
          body: `Project Admin ${ctx.userName} approved your submission for ${ctx.projectName}. Note: "${approvalNote}"`,
          severity: "SUCCESS",
          linkView: "submissions",
          refId: targetUserId || submissionId,
          subsidiaryId: ctx.subsidiaryId,
        },
      });

      await logProjectActivity({
        actorName: ctx.userName,
        actorRole: "Project Admin",
        action: "SUBMISSION_APPROVED",
        targetType: "Submission",
        targetLabel: sub?.title || submissionId,
        category: sub?.category || "Environment",
        severity: "SUCCESS",
      });

      // Bust server, consolidated-report, and PU caches so views refresh immediately
      invalidatePaServerCache();
      invalidatePaConsolidatedReportCache();
      invalidateSubmittedReportsCache();
      invalidatePuSubmissionsCache();
      invalidatePuOverviewCache();
      invalidatePuNotificationsCache();

      return paOk(
        { submissionId, status: "APPROVED", approvalNote },
        "Submission approved — added to the Approved Dataset & Consolidated Report, pending Business Unit handoff."
      );
    }

    // 2. REJECT / REQUEST CORRECTION WORKFLOW
    if (action === "reject" || action === "request_correction") {
      const now = new Date();
      const rejectionReason = comments?.trim() || "Project Admin requested clarification and evidence re-submission.";
      const taskDue = dueDate ? new Date(dueDate) : new Date(Date.now() + 3 * 86400 * 1000);

      const sub = await db.submission.findUnique({
        where: { id: submissionId },
        select: {
          id: true,
          title: true,
          category: true,
          module: true,
          submittedById: true,
          recordIds: true,
          corrections: true,
        },
      });

      // Update db.submission to CHANGES_REQUESTED + persist per-field corrections
      /* Per-source items flagged in the inspect modal become correction objects
         with the SAME shape the pu workflow's addCorrections() uses, so the
         environmental user sees them in the Submissions Corrections tab and
         (below) directly inside Data Entry. */
      const fieldIssues = Array.isArray(body.items) ? body.items : [];
      /* Merge with any previously raised corrections so history is preserved. */
      let priorCorrections: any[] = [];
      try {
        const parsedPrior = typeof sub?.corrections === "string" ? JSON.parse(sub.corrections) : sub?.corrections;
        if (Array.isArray(parsedPrior)) priorCorrections = parsedPrior;
      } catch {}
      const corrections = fieldIssues.slice(0, 50).map((f: any, i: number) => ({
        id: `cr-pa-${Date.now().toString(36)}-${i}`,
        submissionId,
        requesterId: ctx.userId,
        requesterName: ctx.userName,
        field: String(f.field || "General Data Review"),
        issue: String(f.issue || f.comment || rejectionReason),
        severity: f.severity === "ERROR" ? "ERROR" : "WARNING",
        comment: String(f.comment || f.issue || ""),
        recordId: f.recordId ? String(f.recordId) : null,
        /* Structured target key (rec:<id> | rec:<id>:it:<n>) so the
           contributor-side review screen can re-mark the exact item red. */
        target: f.target ? String(f.target) : null,
        status: "OPEN",
        createdAt: now.toISOString(),
      }));
      await db.submission.updateMany({
        where: { id: submissionId },
        data: {
          status: "CHANGES_REQUESTED",
          reviewerId: ctx.userId,
          reviewComment: rejectionReason,
          reviewedAt: now,
          updatedAt: now,
          ...(corrections.length ? { corrections: JSON.stringify([...priorCorrections, ...corrections]) } : {}),
        },
      });

      // Update soSubmission if exists
      await db.soSubmission.updateMany({
        where: { id: submissionId },
        data: {
          status: "CHANGES_REQUESTED",
          updatedAt: now,
        },
      });

      // Update underlying records to CORRECTION_REQUESTED (JSON store + mirrors)
      if (sub?.recordIds) {
        try {
          const rids = typeof sub.recordIds === "string" ? JSON.parse(sub.recordIds) : sub.recordIds;
          if (Array.isArray(rids)) {
            /* Only records touched by a flagged item, or all when the rejection
               is submission-wide. */
            const flaggedRecordIds = new Set(corrections.map((c: any) => c.recordId).filter(Boolean));
            const targetRids = flaggedRecordIds.size
              ? rids.filter((rid: string) => flaggedRecordIds.has(rid))
              : rids;
            for (const rid of targetRids) updateLevelRecordStatus(rid, "CORRECTION_REQUESTED");
            await Promise.allSettled([
              db.energyRecord.updateMany({ where: { id: { in: targetRids } }, data: { status: "CORRECTION_REQUESTED" } }),
              db.waterRecord.updateMany({ where: { id: { in: targetRids } }, data: { status: "CORRECTION_REQUESTED" } }),
              db.wasteRecord.updateMany({ where: { id: { in: targetRids } }, data: { status: "CORRECTION_REQUESTED" } }),
            ]);
          }
        } catch {}
      }

      // Automatically create a corrective Task assigned to the contributor
      const taskRef = `CORR-${ctx.projectCode}-${Date.now().toString().slice(-4)}`;
      const targetUserId = sub?.submittedById;
      await db.task.create({
        data: {
          ref: taskRef,
          title: `Action Required: Correction for ${sub?.title || "Site Data"}`,
          description: rejectionReason,
          category: "CORRECTION",
          priority: priority || "HIGH",
          status: "ASSIGNED",
          assigneeType: "USER",
          assigneeFilter: targetUserId || ctx.userId,
          assigneeLabel: "Responsible Site Contributor",
          startDate: now,
          dueDate: taskDue,
          requiresEvidence: true,
          businessUnitId: ctx.businessUnitId,
          subsidiaryId: ctx.subsidiaryId,
        },
      });

      // Notify the submitter / environment user directly with high-priority alert
      await db.notification.create({
        data: {
          ntype: "DEADLINE",
          title: `Correction Requested: ${sub?.title || "Site Data"}`,
          body: `Project Admin ${ctx.userName} requested revisions: "${rejectionReason}"`,
          severity: "WARNING",
          linkView: "corrections",
          refId: targetUserId || submissionId,
          subsidiaryId: ctx.subsidiaryId,
        },
      });

      await logProjectActivity({
        actorName: ctx.userName,
        actorRole: "Project Admin",
        action: "CORRECTION_REQUESTED",
        targetType: "Submission",
        targetLabel: sub?.title || submissionId,
        category: sub?.category || "Quality Assurance",
        severity: "WARNING",
      });

      return paOk(
        { submissionId, status: "CHANGES_REQUESTED", taskRef, rejectionReason },
        "Correction request dispatched and task created for contributor."
      );
    }

    // 3. SEND REMINDER WORKFLOW
    if (action === "remind") {
      const sub = await db.submission.findUnique({
        where: { id: submissionId },
        select: { id: true, title: true, submittedById: true },
      });

      const targetUserId = sub?.submittedById;
      await db.notification.create({
        data: {
          ntype: "TASK_REMINDER",
          title: `Reporting Reminder: ${sub?.title || "Assigned ESG Metric"}`,
          body: `Project Admin ${ctx.userName} sent a reminder regarding pending submission/review for ${ctx.projectName}.`,
          severity: "WARNING",
          linkView: "submissions",
          refId: targetUserId || submissionId,
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
