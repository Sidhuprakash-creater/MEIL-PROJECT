import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import {
  baHandle, requireBuAdmin, getBuOrThrow,
  resolveEffectiveDeadline, deadlineStatus,
} from "@/lib/ba/server";
import { parseJson } from "@/lib/ba/server";
import type { BaDashboardData } from "@/lib/ba/types";
import { SUBMISSION_STATUS_LABELS } from "@/lib/ba/types";
import type { ActivityRow, SaNotification } from "@/lib/ba/types";

export const dynamic = "force-dynamic";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export async function GET(req: NextRequest) {
  return baHandle(async () => {
    const ctx = await requireBuAdmin();
    const bu = await getBuOrThrow(ctx.businessUnitId);
    const period = req.nextUrl.searchParams.get("period") ?? "FY 2025-26";
    const now = new Date();

    const [subs, projects, users, timelines, activities, latestNotifs] = await Promise.all([
      db.submission.findMany({ where: { businessUnitId: ctx.businessUnitId, period } }),
      db.project.findMany({ where: { businessUnitId: ctx.businessUnitId }, include: { users: { select: { name: true } } } }),
      db.user.findMany({ where: { businessUnitId: ctx.businessUnitId, role: { notIn: ["GROUP_ADMIN", "ORG_MANAGER", "SUBSIDIARY_ADMIN", "SUBSIDIARY_MANAGER"] } } }),
      db.reportingTimeline.findMany({ where: { subsidiaryId: ctx.subsidiaryId, status: "ACTIVE" } }),
      db.activityEvent.findMany({ where: { orgLabel: bu.name }, orderBy: { createdAt: "desc" }, take: 8 }),
      db.notification.findMany({ orderBy: { createdAt: "desc" }, take: 6 }),
    ]);

    const isOverdue = (s: { overdue: boolean; status: string }) => s.overdue && s.status !== "APPROVED";
    const submittedReports = subs.filter((s) => s.status === "SUBMITTED").length;
    const pendingReports = subs.filter((s) => s.status === "UNDER_REVIEW").length;
    const overdueReports = subs.filter((s) => isOverdue(s)).length;
    const pendingReview = subs.filter((s) => ["SUBMITTED", "UNDER_REVIEW"].includes(s.status)).length;
    const totalNonDraft = subs.filter((s) => s.status !== "DRAFT").length;
    const approvedTotal = subs.filter((s) => s.status === "APPROVED").length;
    const reportingCompletionPct = totalNonDraft ? Math.round((approvedTotal / totalNonDraft) * 100) : 0;

    const statusDist = Object.keys(SUBMISSION_STATUS_LABELS)
      .map((status) => ({ status, count: subs.filter((s) => s.status === status).length }))
      .filter((x) => x.count > 0);

    /* project-wise progress */
    const completionByProject = projects.map((p) => {
      const list = subs.filter((s) => s.projectId === p.id);
      const approved = list.filter((s) => s.status === "APPROVED").length;
      const pending = list.filter((s) => ["SUBMITTED", "UNDER_REVIEW"].includes(s.status)).length;
      const overdue = list.filter((s) => isOverdue(s)).length;
      return {
        name: p.name, total: list.length, approved, pending, overdue,
        completionPct: list.length ? Math.round((approved / list.length) * 100) : 0,
      };
    });

    /* submission trend — 6 months by submittedAt */
    const submissionTrend: { label: string; submitted: number; approved: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const inMonth = subs.filter((s) => s.submittedAt && s.submittedAt >= d && s.submittedAt < next);
      submissionTrend.push({
        label: MONTHS[d.getMonth()],
        submitted: inMonth.length,
        approved: inMonth.filter((s) => s.status === "APPROVED").length,
      });
    }

    /* upcoming deadlines (BU + projects within scope) */
    const buEff = resolveEffectiveDeadline("BUSINESS_UNIT", { subsidiaryId: ctx.subsidiaryId, businessUnitId: ctx.businessUnitId }, timelines, bu.code);
    const upcomingDeadlines: BaDashboardData["upcomingDeadlines"] = [];
    if (buEff.dueDate) {
      const list = subs.filter((s) => s.status !== "DRAFT");
      const hasSubmitted = list.length > 0;
      const allApproved = list.length > 0 && list.every((s) => s.status === "APPROVED");
      const lastAt = list.reduce<Date | null>((acc, s) => (s.submittedAt && (!acc || s.submittedAt > acc) ? s.submittedAt : acc), null);
      const status = deadlineStatus({ effective: buEff, hasSubmitted, lastSubmittedAt: lastAt, allApproved });
      const due = new Date(buEff.dueDate).getTime();
      if (due > now.getTime() - 86400000) {
        upcomingDeadlines.push({
          id: bu.id, name: `${bu.name} (BU window)`, level: "BUSINESS_UNIT",
          dueDate: new Date(buEff.dueDate).toISOString(),
          daysLeft: Math.max(0, Math.ceil((due - now.getTime()) / 86400000)),
          status,
        });
      }
    }
    for (const p of projects) {
      const eff = resolveEffectiveDeadline("PROJECT", { subsidiaryId: ctx.subsidiaryId, businessUnitId: ctx.businessUnitId, projectId: p.id }, timelines, bu.code);
      if (!eff.dueDate) continue;
      const list = subs.filter((s) => s.projectId === p.id && s.status !== "DRAFT");
      const hasSubmitted = list.length > 0;
      const allApproved = list.length > 0 && list.every((s) => s.status === "APPROVED");
      const lastAt = list.reduce<Date | null>((acc, s) => (s.submittedAt && (!acc || s.submittedAt > acc) ? s.submittedAt : acc), null);
      const status = deadlineStatus({ effective: eff, hasSubmitted, lastSubmittedAt: lastAt, allApproved });
      const due = new Date(eff.dueDate).getTime();
      if (due <= now.getTime() - 86400000) continue;
      upcomingDeadlines.push({
        id: p.id, name: p.name, level: "PROJECT",
        dueDate: new Date(eff.dueDate).toISOString(),
        daysLeft: Math.max(0, Math.ceil((due - now.getTime()) / 86400000)),
        status,
      });
    }
    upcomingDeadlines.sort((a, b) => a.daysLeft - b.daysLeft);

    /* overdue items */
    const overdueSubs = subs.filter((s) => isOverdue(s)).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).slice(0, 6);
    const submitterIds = [...new Set(overdueSubs.map((s) => s.submittedById).filter(Boolean))] as string[];
    const submitters = submitterIds.length ? await db.user.findMany({ where: { id: { in: submitterIds } }, select: { id: true, name: true } }) : [];
    const overdueItems = overdueSubs.map((s) => {
      const prj = projects.find((x) => x.id === s.projectId);
      return {
        ref: s.ref, title: s.title, level: s.projectId ? "PROJECT" : "BU",
        org: prj?.name ?? bu.name,
        dueDate: s.dueDate.toISOString(),
        daysLate: Math.max(1, Math.floor((now.getTime() - s.dueDate.getTime()) / 86400000)),
        owner: submitters.find((u) => u.id === s.submittedById)?.name ?? "Unassigned",
      };
    });

    /* pending submission list (not yet submitted) */
    const pendingSubmissionList = subs
      .filter((s) => ["DRAFT", "ASSIGNED"].includes(s.status))
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 6)
      .map((s) => {
        const prj = projects.find((x) => x.id === s.projectId);
        const submitter = users.find((u) => u.id === s.submittedById);
        const due = new Date(s.dueDate).getTime();
        return {
          id: s.id, ref: s.ref, title: s.title,
          project: prj?.name ?? bu.name,
          owner: submitter?.name ?? "Unassigned",
          dueDate: s.dueDate.toISOString(),
          daysLeft: Math.ceil((due - now.getTime()) / 86400000),
          overdue: isOverdue(s),
        };
      });

    const recentActivity: ActivityRow[] = activities.map((a) => ({
      id: a.id, actorName: a.actorName, actorRole: a.actorRole, action: a.action,
      targetType: a.targetType, targetLabel: a.targetLabel, orgLabel: a.orgLabel,
      severity: a.severity, createdAt: a.createdAt.toISOString(),
    }));

    const latestNotifications: SaNotification[] = latestNotifs.map((n) => ({
      id: n.id, ntype: n.ntype, title: n.title, body: n.body, severity: n.severity,
      read: n.read, linkView: n.linkView, refId: n.refId,
      createdAt: n.createdAt.toISOString(),
      origin: n.subsidiaryId === null ? "group" : "subsidiary",
    }));

    const data: BaDashboardData = {
      businessUnit: {
        id: bu.id, code: bu.code, name: bu.name,
        subsidiaryId: bu.subsidiaryId,
        subsidiaryName: bu.subsidiary.name,
        subsidiaryCode: bu.subsidiary.code,
        sector: bu.subsidiary.sector,
        managerName: bu.managerName || "—",
        adminName: bu.adminName || "—",
        description: bu.description,
        status: bu.status,
      },
      period,
      kpis: {
        totalProjects: projects.length,
        submittedReports,
        pendingReports,
        overdueReports,
        pendingReview,
        reportingCompletionPct,
      },
      statusDist,
      completionByProject,
      submissionTrend,
      upcomingDeadlines,
      overdueItems,
      pendingSubmissionList,
      recentActivity,
      latestNotifications,
    };
    return ok(data);
  });
}
