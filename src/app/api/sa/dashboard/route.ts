import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import {
  saHandle, requireSubsidiaryAdmin, resolveEffectiveDeadline, deadlineStatus,
  parseJson, getSubsidiaryOrThrow,
} from "@/lib/sa/server";
import type { DashboardData } from "@/lib/sa/types";
import { SUBMISSION_STATUS_LABELS } from "@/lib/sa/types";

export const dynamic = "force-dynamic";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export async function GET(req: NextRequest) {
  return saHandle(async () => {
    const ctx = await requireSubsidiaryAdmin();
    const sub = await getSubsidiaryOrThrow(ctx.subsidiaryId);
    const period = req.nextUrl.searchParams.get("period") ?? "FY 2025-26";
    const now = new Date();

    const [subs, units, projects, users, timelines, activities] = await Promise.all([
      db.submission.findMany({ where: { subsidiaryId: ctx.subsidiaryId, period } }),
      db.businessUnit.findMany({ where: { subsidiaryId: ctx.subsidiaryId } }),
      db.project.findMany({ where: { businessUnit: { subsidiaryId: ctx.subsidiaryId } }, include: { businessUnit: true } }),
      db.user.findMany({ where: { subsidiaryId: ctx.subsidiaryId, role: { notIn: ["GROUP_ADMIN", "ORG_MANAGER"] } } }),
      db.reportingTimeline.findMany({ where: { subsidiaryId: ctx.subsidiaryId, status: "ACTIVE" } }),
      db.activityEvent.findMany({ where: { orgLabel: sub.name }, orderBy: { createdAt: "desc" }, take: 8 }),
    ]);

    const isOverdue = (s: { overdue: boolean; status: string }) => s.overdue && s.status !== "APPROVED" && s.status !== "BU_APPROVED";
    /* Definitions aligned with /api/sa/submissions TAB_FILTERS so every dashboard card
       value equals the destination tab count the user lands on. */
    const bucket = (list: typeof subs) => {
      const submitted = list.filter((s) => s.status === "SUBMITTED").length;
      const pending = list.filter((s) => s.status === "UNDER_REVIEW").length;
      const overdue = list.filter((s) => isOverdue(s)).length;
      const approved = list.filter((s) => s.status === "APPROVED" || s.status === "BU_APPROVED").length;
      const rejected = list.filter((s) => ["REJECTED", "CHANGES_REQUESTED"].includes(s.status)).length;
      return { submitted, pending, overdue, approved, rejected };
    };
    const buSubs = subs.filter((s) => !s.projectId);
    const prjSubs = subs.filter((s) => !!s.projectId);
    const b = bucket(buSubs);
    const p = bucket(prjSubs);

    const statusCount = (list: typeof subs) =>
      Object.keys(SUBMISSION_STATUS_LABELS)
        .map((status) => ({ status, count: list.filter((s) => s.status === status).length }))
        .filter((x) => x.count > 0);

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

    /* submission trend — last 6 months by submittedAt */
    const trend: { label: string; submitted: number; approved: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const inMonth = subs.filter((s) => s.submittedAt && s.submittedAt >= d && s.submittedAt < next);
      trend.push({
        label: MONTHS[d.getMonth()],
        submitted: inMonth.length,
        approved: inMonth.filter((s) => s.status === "APPROVED" || s.status === "BU_APPROVED").length,
      });
    }

    /* effective deadlines for upcoming */
    const entityDeadlines: {
      id: string; name: string; level: string;
      eff: ReturnType<typeof resolveEffectiveDeadline>;
      hasSubmitted: boolean; allApproved: boolean; lastAt: Date | null;
    }[] = [];
    entityDeadlines.push({
      id: sub.id, name: `${sub.name} (subsidiary window)`, level: "SUBSIDIARY",
      eff: resolveEffectiveDeadline("SUBSIDIARY", { subsidiaryId: sub.id }, timelines, sub.code),
      hasSubmitted: true, allApproved: false, lastAt: null,
    });
    for (const u of units) {
      const list = buSubs.filter((s) => s.businessUnitId === u.id && s.status !== "DRAFT");
      entityDeadlines.push({
        id: u.id, name: u.name, level: "BUSINESS_UNIT",
        eff: resolveEffectiveDeadline("BUSINESS_UNIT", { subsidiaryId: sub.id, businessUnitId: u.id }, timelines, sub.code),
        hasSubmitted: list.length > 0,
        allApproved: list.length > 0 && list.every((s) => s.status === "APPROVED" || s.status === "BU_APPROVED"),
        lastAt: list.reduce<Date | null>((acc, s) => (s.submittedAt && (!acc || s.submittedAt > acc) ? s.submittedAt : acc), null),
      });
    }
    for (const pr of projects) {
      const list = prjSubs.filter((s) => s.projectId === pr.id && s.status !== "DRAFT");
      entityDeadlines.push({
        id: pr.id, name: pr.name, level: "PROJECT",
        eff: resolveEffectiveDeadline("PROJECT", { subsidiaryId: sub.id, businessUnitId: pr.businessUnitId, projectId: pr.id }, timelines, sub.code),
        hasSubmitted: list.length > 0,
        allApproved: list.length > 0 && list.every((s) => s.status === "APPROVED" || s.status === "BU_APPROVED"),
        lastAt: list.reduce<Date | null>((acc, s) => (s.submittedAt && (!acc || s.submittedAt > acc) ? s.submittedAt : acc), null),
      });
    }
    const upcomingDeadlines = entityDeadlines
      .filter((e) => e.eff.dueDate && new Date(e.eff.dueDate).getTime() > now.getTime() - 86400000)
      .map((e) => ({
        id: e.id, name: e.name, level: e.level,
        dueDate: e.eff.dueDate!.toISOString(),
        daysLeft: Math.max(0, Math.ceil((new Date(e.eff.dueDate!).getTime() - now.getTime()) / 86400000)),
        status: deadlineStatus({ effective: e.eff, hasSubmitted: e.hasSubmitted, lastSubmittedAt: e.lastAt, allApproved: e.allApproved }),
      }))
      .sort((a, x) => a.daysLeft - x.daysLeft)
      .slice(0, 5);

    const overdueSubs = subs.filter((s) => isOverdue(s));
    const submitterIds = [...new Set(overdueSubs.map((s) => s.submittedById).filter(Boolean))] as string[];
    const submitters = submitterIds.length
      ? await db.user.findMany({ where: { id: { in: submitterIds } }, select: { id: true, name: true } })
      : [];
    const overdueItems = overdueSubs
      .sort((a, x) => new Date(a.dueDate).getTime() - new Date(x.dueDate).getTime())
      .slice(0, 6)
      .map((s) => {
        const bu = units.find((u) => u.id === s.businessUnitId);
        const prj = projects.find((x) => x.id === s.projectId);
        return {
          ref: s.ref, title: s.title, level: s.projectId ? "PROJECT" : "BU",
          org: prj?.name ?? bu?.name ?? "—",
          dueDate: s.dueDate.toISOString(),
          daysLate: Math.max(1, Math.floor((now.getTime() - s.dueDate.getTime()) / 86400000)),
          owner: submitters.find((u) => u.id === s.submittedById)?.name ?? "Unassigned",
        };
      });

    const openValidation = await db.validationIssue.count({ where: { subsidiaryId: ctx.subsidiaryId, status: { in: ["OPEN", "ASSIGNED"] } } });
    const activeUsers = users.filter((u) => u.status === "ACTIVE" && u.lastActiveAt && now.getTime() - u.lastActiveAt.getTime() < 30 * 60000).length;
    const packages = await db.reportingPackage.findMany({ where: { subsidiaryId: ctx.subsidiaryId, period } });
    const totalNonDraft = subs.filter((s) => s.status !== "DRAFT").length;
    const approvedTotal = subs.filter((s) => s.status === "APPROVED" || s.status === "BU_APPROVED").length;

    const data: DashboardData = {
      subsidiary: {
        id: sub.id, code: sub.code, name: sub.name, sector: sub.sector, region: sub.region,
        city: sub.city, status: sub.status, managerName: sub.managerName, adminName: sub.adminName,
        description: sub.description,
      },
      period,
      kpis: {
        totalBUs: units.length, activeBUs: units.filter((u) => u.status === "ACTIVE").length,
        totalProjects: projects.length, activeProjects: projects.filter((x) => x.status === "ACTIVE").length,
        buSubmitted: b.submitted, buPending: b.pending, buOverdue: b.overdue, buApproved: b.approved, buRejected: b.rejected,
        prjSubmitted: p.submitted, prjPending: p.pending, prjOverdue: p.overdue, prjApproved: p.approved, prjRejected: p.rejected,
        awaitingReview: subs.filter((s) => s.status === "UNDER_REVIEW").length,
        rejectedCorrection: subs.filter((s) => ["REJECTED", "CHANGES_REQUESTED"].includes(s.status)).length,
        totalUsers: users.length, activeUsers,
        openValidationIssues: openValidation,
        completionPct: totalNonDraft ? Math.round((approvedTotal / totalNonDraft) * 100) : 0,
        pendingPackages: packages.filter((x) => ["SUBMITTED", "UNDER_GROUP_REVIEW"].includes(x.status)).length,
      },
      buStatusDist: statusCount(buSubs),
      prjStatusDist: statusCount(prjSubs),
      completionByBU,
      submissionTrend: trend,
      upcomingDeadlines,
      overdueItems,
      recentActivity: activities.map((a) => ({
        id: a.id, actorName: a.actorName, actorRole: a.actorRole, action: a.action,
        targetType: a.targetType, targetLabel: a.targetLabel, orgLabel: a.orgLabel,
        severity: a.severity, createdAt: a.createdAt.toISOString(),
      })),
    };

    return ok(data);
  });
}
