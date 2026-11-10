import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import {
  bmHandle, requireBuManager, getBuOrThrow, resolveEffectiveDeadline, deadlineStatus,
} from "@/lib/bm/server";
import { loadBmProjectNames } from "@/lib/bm/rows";
import type { BmDashboardData } from "@/lib/bm/types";

export const dynamic = "force-dynamic";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY = 86400000;

/* GET /api/bm/dashboard?period=FY+2025-26 — BU Manager Review Studio command
   center. Every figure is scoped to the manager's assigned BU. */
export async function GET(req: NextRequest) {
  return bmHandle(async () => {
    const ctx = await requireBuManager();
    const bu = await getBuOrThrow(ctx.businessUnitId);
    const period = req.nextUrl.searchParams.get("period") ?? "FY 2025-26";
    const now = new Date();

    const [subs, projects, activities, projectNames] = await Promise.all([
      db.submission.findMany({ where: { businessUnitId: ctx.businessUnitId, period } }),
      db.project.findMany({ where: { businessUnitId: ctx.businessUnitId }, include: { businessUnit: true } }),
      db.activityEvent.findMany({ where: { orgLabel: bu.name }, orderBy: { createdAt: "desc" }, take: 8 }),
      loadBmProjectNames(ctx.businessUnitId),
    ]);

    const isOverdue = (s: { overdue: boolean; status: string }) => s.overdue && s.status !== "APPROVED" && s.status !== "BU_APPROVED";

    /* Review workload — computed on the QUEUE (SUBMITTED + UNDER_REVIEW + CHANGES_REQUESTED). */
    const queue = subs.filter((s) => ["SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED"].includes(s.status));

    /* Resolve the effective review deadline per submission by walking the
       timeline inheritance chain. */
    const timelines = await db.reportingTimeline.findMany({
      where: {
        status: "ACTIVE",
        OR: [{ subsidiaryId: ctx.subsidiaryId }, { businessUnitId: ctx.businessUnitId }, { projectId: { in: projects.map((p) => p.id) } }],
      },
    });
    const daysToReview = (s: (typeof subs)[number]) => {
      const level: "PROJECT" | "BUSINESS_UNIT" | "SUBSIDIARY" = s.projectId ? "PROJECT" : "BUSINESS_UNIT";
      const eff = resolveEffectiveDeadline(level, {
        subsidiaryId: ctx.subsidiaryId,
        businessUnitId: ctx.businessUnitId,
        projectId: s.projectId ?? undefined,
      }, timelines as never, bu.code);
      const review = eff.reviewDeadline ?? s.dueDate;
      if (!review) return null;
      return Math.ceil((new Date(review).getTime() - now.getTime()) / DAY);
    };

    const overdueReviews = queue.filter((s) => {
      const d = daysToReview(s);
      return d !== null && d < 0;
    }).length;
    /* Review turnaround: average days from submittedAt to reviewedAt. */
    const decided = subs.filter((s) => s.reviewedAt && s.submittedAt && s.reviewerId === ctx.userId);
    const turnaroundDays = decided.map((s) => Math.max(0, (s.reviewedAt!.getTime() - s.submittedAt!.getTime()) / DAY));
    const avgReviewDays = turnaroundDays.length
      ? Math.round((turnaroundDays.reduce((a, b) => a + b, 0) / turnaroundDays.length) * 10) / 10
      : 0;

    /* Decision trend — last 6 months by reviewedAt for THIS manager. */
    const decisionTrend: { label: string; approved: number; rejected: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const inMonth = subs.filter((s) => s.reviewedAt && s.reviewedAt >= d && s.reviewedAt < next && s.reviewerId === ctx.userId);
      decisionTrend.push({
        label: MONTHS[d.getMonth()],
        approved: inMonth.filter((s) => s.status === "APPROVED" || s.status === "BU_APPROVED").length,
        rejected: inMonth.filter((s) => ["REJECTED", "CHANGES_REQUESTED"].includes(s.status)).length,
      });
    }

    /* Completion by project — BU-scoped only. */
    const completionByProject = projects.map((p) => {
      const list = subs.filter((s) => s.projectId === p.id);
      const approved = list.filter((s) => s.status === "APPROVED" || s.status === "BU_APPROVED").length;
      const pending = list.filter((s) => ["SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED"].includes(s.status)).length;
      const overdue = list.filter((s) => isOverdue(s)).length;
      return {
        name: p.name,
        total: list.length,
        approved,
        pending,
        overdue,
        completionPct: list.length ? Math.round((approved / list.length) * 100) : 0,
      };
    });

    /* Upcoming deadlines — BU + project timelines. */
    const entityDeadlines: {
      id: string; name: string; level: string;
      eff: ReturnType<typeof resolveEffectiveDeadline>;
      hasSubmitted: boolean; allApproved: boolean; lastAt: Date | null;
    }[] = [];
    entityDeadlines.push({
      id: bu.id, name: bu.name, level: "BUSINESS_UNIT",
      eff: resolveEffectiveDeadline("BUSINESS_UNIT", { subsidiaryId: ctx.subsidiaryId, businessUnitId: bu.id }, timelines as never, bu.code),
      hasSubmitted: subs.some((s) => !s.projectId && s.status !== "DRAFT"),
      allApproved: subs.some((s) => !s.projectId) && subs.filter((s) => !s.projectId).every((s) => s.status === "APPROVED" || s.status === "BU_APPROVED"),
      lastAt: subs.filter((s) => !s.projectId && s.submittedAt).reduce<Date | null>((acc, s) => (s.submittedAt && (!acc || s.submittedAt > acc) ? s.submittedAt : acc), null),
    });
    for (const p of projects) {
      const list = subs.filter((s) => s.projectId === p.id && s.status !== "DRAFT");
      entityDeadlines.push({
        id: p.id, name: p.name, level: "PROJECT",
        eff: resolveEffectiveDeadline("PROJECT", { subsidiaryId: ctx.subsidiaryId, businessUnitId: ctx.businessUnitId, projectId: p.id }, timelines as never, bu.code),
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
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 5);

    /* Overdue reporting items. */
    const overdueSubs = subs.filter((s) => isOverdue(s));
    const submitterIds = [...new Set(overdueSubs.map((s) => s.submittedById).filter(Boolean))] as string[];
    const submitters = submitterIds.length
      ? await db.user.findMany({ where: { id: { in: submitterIds } }, select: { id: true, name: true } })
      : [];
    const overdueItems = overdueSubs
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 6)
      .map((s) => ({
        ref: s.ref, title: s.title, level: s.projectId ? "PROJECT" : "BU",
        org: projectNames.get(s.projectId ?? "") ?? bu.name,
        dueDate: s.dueDate.toISOString(),
        daysLate: Math.max(1, Math.floor((now.getTime() - s.dueDate.getTime()) / DAY)),
        owner: submitters.find((u) => u.id === s.submittedById)?.name ?? "Unassigned",
      }));

    /* Recent review decisions (this BU's decisions, any reviewer). */
    const decidedRows = subs
      .filter((s) => ["APPROVED", "REJECTED", "CHANGES_REQUESTED"].includes(s.status) && s.reviewedAt)
      .sort((a, b) => new Date(b.reviewedAt!).getTime() - new Date(a.reviewedAt!).getTime())
      .slice(0, 6);
    const reviewerIds = [...new Set(decidedRows.map((s) => s.reviewerId).filter(Boolean))] as string[];
    const reviewers = reviewerIds.length
      ? await db.user.findMany({ where: { id: { in: reviewerIds } }, select: { id: true, name: true } })
      : [];
    const recentDecisions = decidedRows.map((s) => ({
      id: s.id, ref: s.ref, title: s.title, status: s.status,
      reviewedAt: s.reviewedAt?.toISOString() ?? null,
      reviewerName: reviewers.find((u) => u.id === s.reviewerId)?.name ?? null,
      org: projectNames.get(s.projectId ?? "") ?? bu.name,
    }));

    const data: BmDashboardData = {
      businessUnit: {
        id: bu.id, code: bu.code, name: bu.name,
        subsidiaryId: bu.subsidiaryId, subsidiaryName: bu.subsidiary.name,
        subsidiaryCode: bu.subsidiary.code, sector: bu.subsidiary.sector,
        managerName: bu.managerName, adminName: bu.adminName,
        description: bu.description, status: bu.status,
      },
      period,
      kpis: {
        totalProjects: projects.length,
        awaitingReview: subs.filter((s) => s.status === "SUBMITTED").length,
        underReview: subs.filter((s) => s.status === "UNDER_REVIEW").length,
        returnedForCorrection: subs.filter((s) => s.status === "CHANGES_REQUESTED").length,
        approved: subs.filter((s) => s.status === "APPROVED" || s.status === "BU_APPROVED").length,
        overdueReviews,
        avgReviewDays,
      },
      decisionTrend,
      completionByProject,
      upcomingDeadlines,
      overdueItems,
      recentDecisions,
      recentActivity: activities.map((a) => ({
        id: a.id, actorName: a.actorName, actorRole: a.actorRole, action: a.action,
        targetType: a.targetType, targetLabel: a.targetLabel, orgLabel: a.orgLabel,
        severity: a.severity, createdAt: a.createdAt.toISOString(),
      })),
    };
    return ok(data);
  });
}
