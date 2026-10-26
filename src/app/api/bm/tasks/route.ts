import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import {
  bmHandle, requireBuManager, getBuOrThrow,
  resolveEffectiveDeadline, deadlineStatus, parseJson,
} from "@/lib/bm/server";
import { loadBmProjectNames, isResubmission } from "@/lib/bm/rows";
import type { BmAssignedTaskRow, BmTasksData } from "@/lib/bm/types";

export const dynamic = "force-dynamic";

const DAY = 86400000;

/* GET /api/bm/tasks — review workload + correction follow-ups for the Tasks
   & Deadlines view. Distinguishes review due dates (effective review window
   inherited from timelines) from project submission deadlines. */
export async function GET() {
  return bmHandle(async () => {
    const ctx = await requireBuManager();
    const bu = await getBuOrThrow(ctx.businessUnitId);
    const now = new Date();

    const [subs, projects, projectNames, missingEvidence, timelines] = await Promise.all([
      db.submission.findMany({ where: { businessUnitId: ctx.businessUnitId } }),
      db.project.findMany({ where: { businessUnitId: ctx.businessUnitId } }),
      loadBmProjectNames(ctx.businessUnitId),
      db.evidenceDoc.findMany({ where: { businessUnitId: ctx.businessUnitId, status: "MISSING" }, select: { submissionRef: true } }),
      db.reportingTimeline.findMany({
        where: {
          status: "ACTIVE",
          OR: [{ subsidiaryId: ctx.subsidiaryId }, { businessUnitId: ctx.businessUnitId }, { projectId: { in: (await db.project.findMany({ where: { businessUnitId: ctx.businessUnitId }, select: { id: true } })).map((p) => p.id) } }],
        },
      }),
    ]);

    const queue = subs.filter((s) => ["SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED"].includes(s.status));

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

    const reviewBuckets = {
      dueToday: queue.filter((s) => daysToReview(s) === 0).length,
      dueSoon: queue.filter((s) => { const d = daysToReview(s); return d !== null && d > 0 && d <= 7; }).length,
      overdue: queue.filter((s) => { const d = daysToReview(s); return d !== null && d < 0; }).length,
      completed: subs.filter((s) => ["APPROVED", "REJECTED"].includes(s.status) && s.reviewerId === ctx.userId).length,
    };

    const rejected = subs.filter((s) => ["REJECTED", "CHANGES_REQUESTED"].includes(s.status));
    const correctionBuckets = {
      awaitingCorrection: rejected.length,
      overdueCorrections: rejected.filter((s) => s.dueDate.getTime() < now.getTime()).length,
    };

    /* Pending reviews — queue items sorted by review deadline urgency. */
    const pendingReviews = queue
      .map((s) => ({
        id: s.id, ref: s.ref, title: s.title,
        project: s.projectId ? projectNames.get(s.projectId) ?? "BU report" : "BU report",
        submittedAt: s.submittedAt?.toISOString() ?? s.createdAt.toISOString(),
        reviewDeadline: (() => {
          const level: "PROJECT" | "BUSINESS_UNIT" | "SUBSIDIARY" = s.projectId ? "PROJECT" : "BUSINESS_UNIT";
          const eff = resolveEffectiveDeadline(level, { subsidiaryId: ctx.subsidiaryId, businessUnitId: ctx.businessUnitId, projectId: s.projectId ?? undefined }, timelines as never, bu.code);
          return eff.reviewDeadline?.toISOString() ?? null;
        })(),
        daysLeft: daysToReview(s),
        overdue: (daysToReview(s) ?? 0) < 0,
      }))
      .sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999))
      .slice(0, 12);

    /* Upcoming review deadlines (BU + project timelines). */
    const upcomingDeadlines: { name: string; level: string; dueDate: string; daysLeft: number; status: string }[] = [];
    const buEff = resolveEffectiveDeadline("BUSINESS_UNIT", { subsidiaryId: ctx.subsidiaryId, businessUnitId: bu.id }, timelines as never, bu.code);
    const buSubs = subs.filter((s) => !s.projectId && s.status !== "DRAFT");
    if (buEff.dueDate) {
      const due = new Date(buEff.dueDate);
      upcomingDeadlines.push({
        name: bu.name,
        level: "BU",
        dueDate: due.toISOString(),
        daysLeft: Math.max(0, Math.ceil((due.getTime() - now.getTime()) / DAY)),
        status: deadlineStatus({ effective: buEff, hasSubmitted: buSubs.length > 0, lastSubmittedAt: buSubs.reduce<Date | null>((acc, s) => (s.submittedAt && (!acc || s.submittedAt > acc) ? s.submittedAt : acc), null), allApproved: buSubs.length > 0 && buSubs.every((s) => s.status === "APPROVED") }),
      });
    }
    for (const p of projects) {
      const eff = resolveEffectiveDeadline("PROJECT", { subsidiaryId: ctx.subsidiaryId, businessUnitId: ctx.businessUnitId, projectId: p.id }, timelines as never, bu.code);
      if (!eff.dueDate) continue;
      const list = subs.filter((s) => s.projectId === p.id && s.status !== "DRAFT");
      const due = new Date(eff.dueDate);
      upcomingDeadlines.push({
        name: p.name,
        level: "PROJECT",
        dueDate: due.toISOString(),
        daysLeft: Math.max(0, Math.ceil((due.getTime() - now.getTime()) / DAY)),
        status: deadlineStatus({ effective: eff, hasSubmitted: list.length > 0, lastSubmittedAt: list.reduce<Date | null>((acc, s) => (s.submittedAt && (!acc || s.submittedAt > acc) ? s.submittedAt : acc), null), allApproved: list.length > 0 && list.every((s) => s.status === "APPROVED") }),
      });
    }
    upcomingDeadlines.sort((a, b) => a.daysLeft - b.daysLeft);

    /* Reports blocked by missing evidence. */
    const zeroEvidenceRefs = queue
      .filter((s) => parseJson<string[]>(s.evidence, []).length === 0)
      .map((s) => s.ref);
    const missingRefs = missingEvidence.map((m) => m.submissionRef).filter(Boolean);
    const blockedRefs = [...new Set([...zeroEvidenceRefs, ...missingRefs])];

    /* Tasks assigned to this BU (by the BU Admin) plus tasks whose assignee
       filter lists the manager directly — read-only visibility of the sender's
       asks; creation/mutation stays on /api/ba/tasks. */
    const taskCandidates = await db.task.findMany({
      where: {
        OR: [
          { businessUnitId: ctx.businessUnitId },
          { assigneeFilter: { contains: ctx.userId } },
        ],
      },
      orderBy: { dueDate: "asc" },
    });
    const assignedTasks: BmAssignedTaskRow[] = taskCandidates
      .filter((t) => {
        if (t.businessUnitId === ctx.businessUnitId) return true;
        if (t.businessUnitId) return false;
        /* assigneeFilter contains is a substring pre-filter — verify the id is
           really listed in the JSON userIds array before including. */
        const f = parseJson<{ userIds?: string[] }>(t.assigneeFilter, {});
        return (f.userIds ?? []).includes(ctx.userId);
      })
      .slice(0, 25)
      .map((t) => ({
        id: t.id,
        ref: t.ref,
        title: t.title,
        category: t.category,
        priority: t.priority,
        status: t.status,
        assigneeLabel: t.assigneeLabel || "All eligible users",
        startDate: t.startDate.toISOString(),
        dueDate: t.dueDate.toISOString(),
        requiresEvidence: t.requiresEvidence,
        completed: t.completed,
        recipients: t.recipients,
        overdue: t.dueDate.getTime() < now.getTime() && t.status !== "COMPLETED",
      }));

    const data: BmTasksData = {
      reviewBuckets,
      correctionBuckets,
      pendingReviews,
      upcomingDeadlines,
      blockedByEvidence: { count: blockedRefs.length, refs: blockedRefs.slice(0, 10) },
      assignedTasks,
    };
    void isResubmission;
    return ok(data);
  });
}
