import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import {
  smHandle, requireSubsidiaryManager, getSubsidiaryOrThrow,
  resolveEffectiveDeadline, deadlineStatus,
} from "@/lib/sm/server";
import { loadRowContext } from "@/lib/sm/rows";
import type { ManagerDashboardData } from "@/lib/sm/types";
import { SUBMISSION_STATUS_LABELS } from "@/lib/sm/types";

export const dynamic = "force-dynamic";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* GET /api/sm/dashboard?period=FY+2025-26 — manager command center.
   Count definitions (aligned with /api/sm/submissions TAB_FILTERS):
     queue      = SUBMITTED + UNDER_REVIEW                      (awaiting my decision)
     pending    = UNDER_REVIEW                                   (in review)
     submitted  = SUBMITTED                                      (freshly submitted)
     rejected   = REJECTED + CHANGES_REQUESTED                   (awaiting correction)
     overdue    = overdue flag && status != APPROVED             (deadline state)   */
export async function GET(req: NextRequest) {
  return smHandle(async () => {
    const ctx = await requireSubsidiaryManager();
    const sub = await getSubsidiaryOrThrow(ctx.subsidiaryId);
    const period = req.nextUrl.searchParams.get("period") ?? "FY 2025-26";
    const now = new Date();
    const DAY = 86400000;

    const [subs, units, projects, activities, rowCtx] = await Promise.all([
      db.submission.findMany({ where: { subsidiaryId: ctx.subsidiaryId, period } }),
      db.businessUnit.findMany({ where: { subsidiaryId: ctx.subsidiaryId } }),
      db.project.findMany({ where: { businessUnit: { subsidiaryId: ctx.subsidiaryId } }, include: { businessUnit: true } }),
      db.activityEvent.findMany({ where: { orgLabel: sub.name }, orderBy: { createdAt: "desc" }, take: 8 }),
      loadRowContext(ctx.subsidiaryId),
    ]);

    const isOverdue = (s: { overdue: boolean; status: string }) =>
      s.overdue && s.status !== "APPROVED" && s.status !== "BU_APPROVED";
    const bucket = (list: typeof subs) => ({
      submitted: list.filter((s) => s.status === "SUBMITTED").length,
      pending: list.filter((s) => s.status === "UNDER_REVIEW").length,
      overdue: list.filter((s) => isOverdue(s)).length,
      /* BU_APPROVED = signed off by the Business Unit → cleared for the
         subsidiary consolidation, so it counts as approved here. */
      approved: list.filter((s) => s.status === "APPROVED" || s.status === "BU_APPROVED").length,
      rejected: list.filter((s) => ["REJECTED", "CHANGES_REQUESTED"].includes(s.status)).length,
    });
    const buSubs = subs.filter((s) => !s.projectId);
    const prjSubs = subs.filter((s) => !!s.projectId);
    const b = bucket(buSubs);
    const p = bucket(prjSubs);

    /* Review workload — computed on the QUEUE (SUBMITTED + UNDER_REVIEW). */
    const queue = subs.filter((s) => ["SUBMITTED", "UNDER_REVIEW"].includes(s.status));
    const daysToReview = (s: (typeof subs)[number]) => {
      const base = rowCtx.timelines.length
        ? resolveEffectiveDeadline(
            s.projectId ? "PROJECT" : "BUSINESS_UNIT",
            { subsidiaryId: "", businessUnitId: s.businessUnitId, projectId: s.projectId },
            rowCtx.timelines,
            sub.code
          )
        : null;
      const review = base?.reviewDeadline ?? s.dueDate;
      return Math.ceil((new Date(review).getTime() - now.getTime()) / DAY);
    };
    const dueSoonReview = queue.filter((s) => {
      const d = daysToReview(s);
      return d >= 0 && d <= 7;
    }).length;
    const overdueReview = queue.filter((s) => daysToReview(s) < 0).length;

    const resubmissions = queue.filter((s) => {
      try {
        const h = JSON.parse(s.history || "[]") as { action?: string; note?: string }[];
        return h.some((e) => `${e.action ?? ""} ${e.note ?? ""}`.toLowerCase().includes("resubmit"));
      } catch {
        return false;
      }
    }).length;

    /* Decisions already recorded by THIS manager. */
    const completedReviews = await db.submission.count({
      where: { subsidiaryId: ctx.subsidiaryId, reviewerId: ctx.userId, status: { in: ["APPROVED", "REJECTED"] } },
    });

    /* Decision trend — last 6 months by reviewedAt. */
    const decisionTrend: { label: string; approved: number; rejected: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const inMonth = subs.filter((s) => s.reviewedAt && s.reviewedAt >= d && s.reviewedAt < next && s.reviewerId === ctx.userId);
      decisionTrend.push({
        label: MONTHS[d.getMonth()],
        approved: inMonth.filter((s) => s.status === "APPROVED" || s.status === "BU_APPROVED").length,
        rejected: inMonth.filter((s) => s.status === "REJECTED").length,
      });
    }

    /* Completion by BU. */
    const completionByBU = units.map((u) => {
      const list = buSubs.filter((s) => s.businessUnitId === u.id);
      const st = bucket(list);
      return {
        name: u.name,
        total: list.length,
        approved: st.approved,
        pending: st.pending + st.submitted,
        overdue: st.overdue,
        completionPct: list.length ? Math.round((st.approved / list.length) * 100) : 0,
      };
    });

    /* Effective deadlines for upcoming windows (BU + project levels). */
    const entityDeadlines: {
      id: string; name: string; level: string;
      eff: ReturnType<typeof resolveEffectiveDeadline>;
      hasSubmitted: boolean; allApproved: boolean; lastAt: Date | null;
    }[] = [];
    for (const u of units) {
      const list = buSubs.filter((s) => s.businessUnitId === u.id && s.status !== "DRAFT");
      entityDeadlines.push({
        id: u.id, name: u.name, level: "BUSINESS_UNIT",
        eff: resolveEffectiveDeadline("BUSINESS_UNIT", { subsidiaryId: sub.id, businessUnitId: u.id }, rowCtx.timelines, sub.code),
        hasSubmitted: list.length > 0,
        allApproved: list.length > 0 && list.every((s) => s.status === "APPROVED" || s.status === "BU_APPROVED"),
        lastAt: list.reduce<Date | null>((acc, s) => (s.submittedAt && (!acc || s.submittedAt > acc) ? s.submittedAt : acc), null),
      });
    }
    for (const pr of projects) {
      const list = prjSubs.filter((s) => s.projectId === pr.id && s.status !== "DRAFT");
      entityDeadlines.push({
        id: pr.id, name: pr.name, level: "PROJECT",
        eff: resolveEffectiveDeadline("PROJECT", { subsidiaryId: sub.id, businessUnitId: pr.businessUnitId, projectId: pr.id }, rowCtx.timelines, sub.code),
        hasSubmitted: list.length > 0,
        allApproved: list.length > 0 && list.every((s) => s.status === "APPROVED" || s.status === "BU_APPROVED"),
        lastAt: list.reduce<Date | null>((acc, s) => (s.submittedAt && (!acc || s.submittedAt > acc) ? s.submittedAt : acc), null),
      });
    }
    const upcomingDeadlines = entityDeadlines
      .filter((e) => e.eff.dueDate && new Date(e.eff.dueDate).getTime() > now.getTime() - DAY)
      .map((e) => ({
        id: e.id, name: e.name, level: e.level,
        dueDate: e.eff.dueDate!.toISOString(),
        daysLeft: Math.max(0, Math.ceil((new Date(e.eff.dueDate!).getTime() - now.getTime()) / DAY)),
        status: deadlineStatus({ effective: e.eff, hasSubmitted: e.hasSubmitted, lastSubmittedAt: e.lastAt, allApproved: e.allApproved }),
      }))
      .sort((a, x) => a.daysLeft - x.daysLeft)
      .slice(0, 5);

    /* Overdue reporting items. */
    const overdueSubs = subs.filter((s) => isOverdue(s));
    const submitterIds = [...new Set(overdueSubs.map((s) => s.submittedById).filter(Boolean))] as string[];
    const submitters = submitterIds.length
      ? await db.user.findMany({ where: { id: { in: submitterIds } }, select: { id: true, name: true } })
      : [];
    const overdueItems = overdueSubs
      .sort((a, x) => new Date(a.dueDate).getTime() - new Date(x.dueDate).getTime())
      .slice(0, 6)
      .map((s) => ({
        ref: s.ref, title: s.title, level: s.projectId ? "PROJECT" : "BU",
        org: rowCtx.projectNames.get(s.projectId ?? "") ?? rowCtx.buNames.get(s.businessUnitId ?? "") ?? "—",
        dueDate: s.dueDate.toISOString(),
        daysLate: Math.max(1, Math.floor((now.getTime() - s.dueDate.getTime()) / DAY)),
        owner: submitters.find((u) => u.id === s.submittedById)?.name ?? "Unassigned",
      }));

    /* Recent review decisions (any reviewer — manager + group parity view).
       BU sign-offs are included: the subsidiary must see what its business
       units already cleared. */
    const decided = subs
      .filter((s) => ["APPROVED", "BU_APPROVED", "REJECTED"].includes(s.status) && s.reviewedAt)
      .sort((a, x) => new Date(x.reviewedAt!).getTime() - new Date(a.reviewedAt!).getTime())
      .slice(0, 6);
    const reviewerIds = [...new Set(decided.map((s) => s.reviewerId).filter(Boolean))] as string[];
    const reviewers = reviewerIds.length
      ? await db.user.findMany({ where: { id: { in: reviewerIds } }, select: { id: true, name: true } })
      : [];

    const totalNonDraft = subs.filter((s) => s.status !== "DRAFT").length;
    const approvedTotal = subs.filter((s) => s.status === "APPROVED" || s.status === "BU_APPROVED").length;
    const openValidation = await db.validationIssue.count({ where: { subsidiaryId: ctx.subsidiaryId, status: { in: ["OPEN", "ASSIGNED"] } } });

    const data: ManagerDashboardData = {
      subsidiary: {
        id: sub.id, code: sub.code, name: sub.name, sector: sub.sector, region: sub.region,
        city: sub.city, status: sub.status, managerName: sub.managerName, adminName: sub.adminName,
        description: sub.description,
      },
      period,
      kpis: {
        totalBUs: units.length,
        totalProjects: projects.length,
        awaitingReview: queue.length,
        dueSoonReview,
        overdueReview,
        rejectedCorrection: subs.filter((s) => ["REJECTED", "CHANGES_REQUESTED"].includes(s.status)).length,
        resubmissions,
        completedReviews,
        buSubmitted: b.submitted, buPending: b.pending, buOverdue: b.overdue, buApproved: b.approved, buRejected: b.rejected,
        prjSubmitted: p.submitted, prjPending: p.pending, prjOverdue: p.overdue, prjApproved: p.approved, prjRejected: p.rejected,
        completionPct: totalNonDraft ? Math.round((approvedTotal / totalNonDraft) * 100) : 0,
        openValidationIssues: openValidation,
      },
      decisionTrend,
      completionByBU,
      upcomingDeadlines,
      overdueItems,
      recentDecisions: decided.map((s) => ({
        id: s.id, ref: s.ref, title: s.title, status: s.status,
        reviewedAt: s.reviewedAt?.toISOString() ?? null,
        reviewerName: reviewers.find((u) => u.id === s.reviewerId)?.name ?? null,
        org: rowCtx.projectNames.get(s.projectId ?? "") ?? rowCtx.buNames.get(s.businessUnitId ?? "") ?? "—",
      })),
      recentActivity: activities.map((a) => ({
        id: a.id, actorName: a.actorName, actorRole: a.actorRole, action: a.action,
        targetType: a.targetType, targetLabel: a.targetLabel, orgLabel: a.orgLabel,
        severity: a.severity, createdAt: a.createdAt.toISOString(),
      })),
    };
    void SUBMISSION_STATUS_LABELS;
    return ok(data);
  });
}
