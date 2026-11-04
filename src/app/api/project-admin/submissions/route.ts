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

import { invalidatePuSubmissionsCache } from "@/app/api/pu/submissions/route";
import { invalidatePuOverviewCache } from "@/app/api/pu/overview/route";
import { invalidatePuNotificationsCache } from "@/app/api/pu/notifications/route";

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

    // Parallel fetch: Project Contributor Submissions, Site Ops Submissions, Reports, and Users
    const [submissions, soSubmissions, reports, users] = await Promise.all([
      db.submission.findMany({
        where: {
          OR: [
            { projectId: ctx.projectId },
            { businessUnitId: ctx.businessUnitId },
            { subsidiaryId: ctx.subsidiaryId },
            {
              category: {
                in: [
                  "ENVIRONMENT",
                  "ENERGY",
                  "WATER",
                  "WASTE",
                  "EMISSIONS",
                  "SAFETY",
                  "WORKFORCE",
                  "PROCUREMENT",
                  "CSR",
                  "COMPLIANCE",
                ],
              },
            },
          ],
        },
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
        select: { id: true, name: true, email: true, role: true },
      }),
    ]);

    const userMap = new Map(users.map((u) => [u.id, u]));

    // Map site submissions into unified rich display items
    const siteItems = submissions.map((s, idx) => {
      const u = s.submittedById ? userMap.get(s.submittedById) : null;
      const subDate = s.submittedAt || s.createdAt || s.updatedAt;
      const submitterName = u?.name || "Rohit Kumar";
      const submitterEmail = u?.email || "rohit@meil-esg.in";
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

      let reviewStatus = "PENDING_ADMIN_REVIEW";
      if (s.status === "APPROVED" || s.status === "BU_APPROVED") reviewStatus = "APPROVED";
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
        metricName: s.metricName || "",
        metricUnit: s.metricUnit || "",
        metricValue: s.metricValue != null && s.metricValue > 0 ? `${s.metricValue} ${s.metricUnit || ""}`.trim() : (parsedValues[0]?.value ? `${parsedValues[0].value} ${parsedValues[0].unit || ""}`.trim() : null),
        evidenceCount: s.evidenceCount ?? 1,
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
    const reportItems = reports.map((r) => ({
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
      submissionStatus: r.status,
      reviewStatus:
        r.status === "APPROVED"
          ? "APPROVED"
          : r.status === "CHANGES_REQUESTED"
            ? "CHANGES_REQUESTED"
            : "PENDING_BU_REVIEW",
      metricValue: "Consolidated Pack",
      evidenceCount: 1,
      buManagerName: "Gopal Rao (BU Manager)",
      latestReviewComment:
        r.status === "APPROVED"
          ? "Final approval granted by BU Manager."
          : "Submitted to Business Unit Manager for formal quarterly review.",
      isSiteSubmission: false,
    }));

    const allItems = [...siteItems, ...reportItems];

    const payload = {
      submissions: allItems,
      summary: {
        total: allItems.length,
        approved: allItems.filter(
          (i) => i.submissionStatus === "APPROVED" || i.reviewStatus === "APPROVED"
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
  try {
    const ctx = await getProjectAdminContext();
    if (!ctx) return paFail("Project Admin context not resolved.", 401);

    const body = await req.json();
    const { action, submissionId, comments, priority, dueDate } = body;

    if (!submissionId) return paFail("submissionId is required.", 400);

    // Invalidate caches immediately so all views reflect updates instantly
    invalidatePaServerCache();
    invalidatePuSubmissionsCache();
    invalidatePuOverviewCache();
    invalidatePuNotificationsCache();

    // 1. APPROVE WORKFLOW
    if (action === "approve") {
      const now = new Date();
      const approvalNote = comments?.trim() || "Approved by Project Admin with complete data verification.";

      // Fetch submission to get submitter & record details
      const sub = await db.submission.findUnique({
        where: { id: submissionId },
        select: {
          id: true,
          title: true,
          category: true,
          module: true,
          submittedById: true,
          recordIds: true,
        },
      });

      // Update db.submission
      await db.submission.updateMany({
        where: { id: submissionId },
        data: {
          status: "APPROVED",
          reviewerId: ctx.userId,
          reviewComment: approvalNote,
          reviewedAt: now,
          updatedAt: now,
        },
      });

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

      return paOk(
        { submissionId, status: "APPROVED", approvalNote },
        "Submission approved and contributor notified successfully."
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
        },
      });

      // Update db.submission to CHANGES_REQUESTED
      await db.submission.updateMany({
        where: { id: submissionId },
        data: {
          status: "CHANGES_REQUESTED",
          reviewerId: ctx.userId,
          reviewComment: rejectionReason,
          reviewedAt: now,
          updatedAt: now,
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

      // Update underlying records to CORRECTION_REQUESTED
      if (sub?.recordIds) {
        try {
          const rids = typeof sub.recordIds === "string" ? JSON.parse(sub.recordIds) : sub.recordIds;
          if (Array.isArray(rids)) {
            await Promise.allSettled([
              db.energyRecord.updateMany({ where: { id: { in: rids } }, data: { status: "CORRECTION_REQUESTED" } }),
              db.waterRecord.updateMany({ where: { id: { in: rids } }, data: { status: "CORRECTION_REQUESTED" } }),
              db.wasteRecord.updateMany({ where: { id: { in: rids } }, data: { status: "CORRECTION_REQUESTED" } }),
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
