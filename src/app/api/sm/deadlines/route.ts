import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import {
  smHandle, requireSubsidiaryManager, getSubsidiaryOrThrow,
  resolveEffectiveDeadline, deadlineStatus, parseJson,
} from "@/lib/sm/server";
import type { DeadlinesData, TimelineRow } from "@/lib/sm/types";

export const dynamic = "force-dynamic";

const DAY = 86400000;

/* GET /api/sm/deadlines — Tasks & Deadlines screen.
   The manager has READ-ONLY deadline visibility: timelines are managed by the
   Subsidiary Admin (inheritance: SUBSIDIARY → BU → PROJECT) and are surfaced
   here with their effective review deadlines and status. */
export async function GET() {
  return smHandle(async () => {
    const ctx = await requireSubsidiaryManager();
    const sub = await getSubsidiaryOrThrow(ctx.subsidiaryId);
    const now = new Date();

    const [timelines, tasks, subs, units, projects, missingEvidence] = await Promise.all([
      db.reportingTimeline.findMany({ where: { subsidiaryId: ctx.subsidiaryId }, orderBy: { updatedAt: "desc" } }),
      db.task.findMany({ where: { subsidiaryId: ctx.subsidiaryId }, orderBy: { dueDate: "asc" } }),
      db.submission.findMany({ where: { subsidiaryId: ctx.subsidiaryId } }),
      db.businessUnit.findMany({ where: { subsidiaryId: ctx.subsidiaryId }, select: { id: true, name: true } }),
      db.project.findMany({ where: { businessUnit: { subsidiaryId: ctx.subsidiaryId } }, include: { businessUnit: true } }),
      db.evidenceDoc.findMany({ where: { subsidiaryId: ctx.subsidiaryId, status: "MISSING" }, select: { submissionRef: true } }),
    ]);

    const buNames = new Map(units.map((u) => [u.id, u.name]));
    const projectNames = new Map(projects.map((p) => [p.id, p.name]));

    const timelineRows: TimelineRow[] = timelines.map((t) => {
      const eff = resolveEffectiveDeadline(
        t.level as "SUBSIDIARY" | "BUSINESS_UNIT" | "PROJECT",
        { subsidiaryId: t.subsidiaryId, businessUnitId: t.businessUnitId, projectId: t.projectId },
        timelines,
        sub.code
      );
      const orgName =
        t.level === "SUBSIDIARY" ? sub.name
          : t.level === "BUSINESS_UNIT" ? buNames.get(t.businessUnitId ?? "") ?? "—"
            : projectNames.get(t.projectId ?? "") ?? "—";
      const isOverdueFlag = !!eff.dueDate && new Date(eff.dueDate).getTime() < now.getTime() && t.status === "ACTIVE";
      return {
        id: t.id, ref: t.ref, name: t.name, period: t.period,
        level: t.level as TimelineRow["level"],
        orgId: t.businessUnitId ?? t.projectId ?? null,
        orgName,
        startDate: t.startDate.toISOString(),
        dueDate: eff.dueDate ? eff.dueDate.toISOString() : null,
        reviewDeadline: eff.reviewDeadline ? eff.reviewDeadline.toISOString() : null,
        categories: parseJson<string[]>(t.categories, []),
        inheritanceMode: t.inheritanceMode as TimelineRow["inheritanceMode"],
        overrideReason: t.overrideReason,
        sourceLabel: eff.sourceLabel,
        effectiveDueDate: eff.dueDate ? eff.dueDate.toISOString() : null,
        deadlineStatus: isOverdueFlag ? "OVERDUE" : t.status === "CLOSED" ? "CLOSED" : "IN_PROGRESS",
        status: t.status,
        notify: t.notify,
        createdByName: t.createdByName,
        updatedAt: t.updatedAt.toISOString(),
      };
    });

    /* Review workload buckets (queue = SUBMITTED + UNDER_REVIEW). */
    const queue = subs.filter((s) => ["SUBMITTED", "UNDER_REVIEW"].includes(s.status));
    const daysTo = (d: Date | null) => (d ? Math.ceil((new Date(d).getTime() - now.getTime()) / DAY) : null);
    const reviewDueDays = queue.map((s) => daysTo(s.dueDate) ?? 0);
    const reviewBuckets = {
      dueToday: reviewDueDays.filter((d) => d === 0).length,
      dueSoon: reviewDueDays.filter((d) => d > 0 && d <= 7).length,
      overdue: reviewDueDays.filter((d) => d < 0).length,
    };

    /* Corrections tracking. */
    const rejected = subs.filter((s) => ["REJECTED", "CHANGES_REQUESTED"].includes(s.status));
    const correctionBuckets = {
      awaitingCorrection: rejected.length,
      overdueCorrections: rejected.filter((s) => s.dueDate.getTime() < now.getTime()).length,
    };

    /* Reports blocked by missing evidence: queue items with zero attached docs
       plus repository placeholders that reference a live submission. */
    const zeroEvidenceRefs = queue
      .filter((s) => (JSON.parse(s.evidence || "[]") as unknown[]).length === 0)
      .map((s) => s.ref);
    const missingRefs = missingEvidence.map((m) => m.submissionRef).filter(Boolean);
    const blockedRefs = [...new Set([...zeroEvidenceRefs, ...missingRefs])];

    const taskRows = tasks.map((t) => ({
      id: t.id, ref: t.ref, title: t.title, category: t.category,
      assigneeLabel: t.assigneeLabel,
      org: t.businessUnitId ? buNames.get(t.businessUnitId) ?? "—" : sub.name,
      dueDate: t.dueDate.toISOString(),
      startDate: t.startDate.toISOString(),
      priority: t.priority,
      status: t.status,
      requiresEvidence: t.requiresEvidence,
      completed: t.completed,
      recipients: t.recipients,
    }));

    const upcoming = timelineRows
      .filter((t) => t.effectiveDueDate && new Date(t.effectiveDueDate).getTime() > now.getTime() - DAY && t.status === "ACTIVE")
      .map((t) => ({
        name: `${t.orgName} — ${t.name}`,
        level: t.level,
        dueDate: t.effectiveDueDate!,
        daysLeft: Math.max(0, Math.ceil((new Date(t.effectiveDueDate!).getTime() - now.getTime()) / DAY)),
        status: t.deadlineStatus,
      }))
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 8);

    const data: DeadlinesData = {
      timelines: timelineRows,
      tasks: taskRows,
      reviewBuckets,
      correctionBuckets,
      blockedByEvidence: { count: blockedRefs.length, refs: blockedRefs.slice(0, 10) },
      upcoming,
    };
    void deadlineStatus;
    return ok(data);
  });
}
