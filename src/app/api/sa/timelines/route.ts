import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import {
  SaError, saHandle, requireSubsidiaryAdmin, getSubsidiaryOrThrow, assertUnitInScope, assertProjectInScope,
  resolveEffectiveDeadline, deadlineStatus, saLogActivity, saLogAudit, saNotify,
} from "@/lib/sa/server";
import {
  makeRef, entitySubStats, toTimelineRow, parseTimelineBody, timelineAffected,
} from "@/lib/sa/helpers";
import type { TimelineBodyInput, TimelineDbRow, TimelineLevel } from "@/lib/sa/helpers";
import type { TimelineSummary } from "@/lib/sa/types";

export const dynamic = "force-dynamic";

const LEVEL_ORDER: Record<string, number> = { SUBSIDIARY: 0, BUSINESS_UNIT: 1, PROJECT: 2 };
const COMPLETE_STATUSES = ["SUBMITTED_ON_TIME", "CLOSED"];
const PENDING_STATUSES = ["IN_PROGRESS", "DUE_SOON", "UPCOMING", "NOT_STARTED"];
const OVERDUE_STATUSES = ["OVERDUE", "SUBMITTED_LATE"];

const snap = (t: TimelineDbRow) => ({
  name: t.name, period: t.period, level: t.level,
  startDate: t.startDate.toISOString(), dueDate: t.dueDate?.toISOString() ?? null,
  reviewDeadline: t.reviewDeadline?.toISOString() ?? null,
  inheritanceMode: t.inheritanceMode, overrideReason: t.overrideReason,
  notify: t.notify, status: t.status,
});

export async function GET(req: NextRequest) {
  return saHandle(async () => {
    const ctx = await requireSubsidiaryAdmin();
    const sub = await getSubsidiaryOrThrow(ctx.subsidiaryId);
    const periodParam = (req.nextUrl.searchParams.get("period") ?? "").trim();
    const effPeriod = periodParam || "FY 2025-26";

    const [rows, units, projects, subs] = await Promise.all([
      db.reportingTimeline.findMany({
        where: { subsidiaryId: ctx.subsidiaryId, status: "ACTIVE", ...(periodParam ? { period: periodParam } : {}) },
        orderBy: { createdAt: "desc" },
      }),
      db.businessUnit.findMany({ where: { subsidiaryId: ctx.subsidiaryId }, orderBy: { createdAt: "asc" } }),
      db.project.findMany({ where: { businessUnit: { subsidiaryId: ctx.subsidiaryId } }, orderBy: { createdAt: "asc" } }),
      db.submission.findMany({
        where: { subsidiaryId: ctx.subsidiaryId },
        select: { period: true, status: true, submittedAt: true, businessUnitId: true, projectId: true },
      }),
    ]);

    // Group ACTIVE rows per period so inheritance walks never cross periods.
    const byPeriod = new Map<string, TimelineDbRow[]>();
    for (const t of rows) {
      const arr = byPeriod.get(t.period) ?? [];
      arr.push(t);
      byPeriod.set(t.period, arr);
    }
    const unitNames = new Map(units.map((u) => [u.id, u.name]));
    const projectNames = new Map(projects.map((p) => [p.id, p.name]));

    const timelines = rows
      .map((t) => {
        let orgId: string | null;
        let orgName: string;
        if (t.level === "SUBSIDIARY") {
          orgId = sub.id;
          orgName = sub.name;
        } else if (t.level === "BUSINESS_UNIT") {
          orgId = t.businessUnitId;
          orgName = unitNames.get(t.businessUnitId ?? "") ?? "—";
        } else {
          orgId = t.projectId;
          orgName = projectNames.get(t.projectId ?? "") ?? "—";
        }
        const stats = entitySubStats(subs, t.period, {
          level: t.level as TimelineLevel,
          businessUnitId: t.businessUnitId,
          projectId: t.projectId,
        });
        return toTimelineRow(t, orgId, orgName, byPeriod.get(t.period) ?? [], sub.code, stats);
      })
      .sort((a, b) =>
        (LEVEL_ORDER[a.level] ?? 9) - (LEVEL_ORDER[b.level] ?? 9) ||
        (a.effectiveDueDate ?? "9999").localeCompare(b.effectiveDueDate ?? "9999") ||
        a.name.localeCompare(b.name)
      );

    /* ── summary: entity-level roll-up for the effective period ───────────── */
    const set = byPeriod.get(effPeriod) ?? [];
    const now = Date.now();
    const upcoming: { name: string; level: string; dueDate: string; daysLeft: number }[] = [];
    let buComplete = 0, buPending = 0, buOverdue = 0, prjComplete = 0, prjPending = 0, prjOverdue = 0;

    const rollup = (
      level: TimelineLevel,
      name: string,
      ids: { subsidiaryId: string; businessUnitId?: string | null; projectId?: string | null },
      stats: { hasSubmitted: boolean; allApproved: boolean; lastSubmittedAt: Date | null },
      isBu: boolean
    ) => {
      const eff = resolveEffectiveDeadline(level, ids, set, sub.code);
      if (eff.dueDate) {
        const due = new Date(eff.dueDate).getTime();
        if (due > now - 86400000) {
          upcoming.push({
            name, level,
            dueDate: new Date(eff.dueDate).toISOString(),
            daysLeft: Math.max(0, Math.ceil((due - now) / 86400000)),
          });
        }
      }
      const st = deadlineStatus({
        effective: eff, hasSubmitted: stats.hasSubmitted,
        lastSubmittedAt: stats.lastSubmittedAt, allApproved: stats.allApproved,
      });
      if (COMPLETE_STATUSES.includes(st)) { if (isBu) buComplete++; else prjComplete++; }
      else if (PENDING_STATUSES.includes(st)) { if (isBu) buPending++; else prjPending++; }
      else if (OVERDUE_STATUSES.includes(st)) { if (isBu) buOverdue++; else prjOverdue++; }
    };

    // Subsidiary entity (root window) — contributes to upcoming only.
    const rootEff = resolveEffectiveDeadline("SUBSIDIARY", { subsidiaryId: sub.id }, set, sub.code);
    if (rootEff.dueDate) {
      const due = new Date(rootEff.dueDate).getTime();
      if (due > now - 86400000) {
        upcoming.push({
          name: `${sub.name} (subsidiary window)`, level: "SUBSIDIARY",
          dueDate: new Date(rootEff.dueDate).toISOString(),
          daysLeft: Math.max(0, Math.ceil((due - now) / 86400000)),
        });
      }
    }
    for (const u of units) {
      rollup("BUSINESS_UNIT", u.name, { subsidiaryId: sub.id, businessUnitId: u.id }, entitySubStats(subs, effPeriod, { level: "BUSINESS_UNIT", businessUnitId: u.id }), true);
    }
    for (const p of projects) {
      rollup("PROJECT", p.name, { subsidiaryId: sub.id, businessUnitId: p.businessUnitId, projectId: p.id }, entitySubStats(subs, effPeriod, { level: "PROJECT", projectId: p.id }), false);
    }

    const summary: TimelineSummary = {
      subsidiaryDeadline: rootEff.dueDate ? new Date(rootEff.dueDate).toISOString() : null,
      buComplete, buPending, buOverdue, prjComplete, prjPending, prjOverdue,
      upcoming: upcoming.sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 5),
      overrides: rows.filter((t) => t.period === effPeriod && t.inheritanceMode === "OVERRIDE").length,
    };

    return ok({ timelines, summary });
  });
}

export async function POST(req: NextRequest) {
  return saHandle(async () => {
    const ctx = await requireSubsidiaryAdmin();
    const sub = await getSubsidiaryOrThrow(ctx.subsidiaryId);
    const body = (await req.json().catch(() => ({}))) as TimelineBodyInput;
    const input = parseTimelineBody(body);

    /* ── resolve the target org (scope-checked) ───────────────────────────── */
    let businessUnitId: string | null = null;
    let projectId: string | null = null;
    let orgId: string | null = sub.id;
    let orgName = sub.name;
    if (input.level === "BUSINESS_UNIT") {
      const target = (body.orgId ?? "").trim();
      if (!target) throw new SaError("Select the business unit this timeline applies to.", 400);
      const unit = await assertUnitInScope(target, ctx.subsidiaryId);
      businessUnitId = unit.id;
      orgId = unit.id;
      orgName = unit.name;
    } else if (input.level === "PROJECT") {
      const target = (body.orgId ?? "").trim();
      if (!target) throw new SaError("Select the project this timeline applies to.", 400);
      const project = await assertProjectInScope(target, ctx.subsidiaryId);
      projectId = project.id;
      orgId = project.id;
      orgName = project.name;
    }

    const data = {
      name: input.name, period: input.period, level: input.level,
      subsidiaryId: ctx.subsidiaryId, businessUnitId, projectId,
      startDate: input.startDate, dueDate: input.dueDate, reviewDeadline: input.reviewDeadline,
      categories: JSON.stringify(input.categories),
      inheritanceMode: input.inheritanceMode, overrideReason: input.overrideReason,
      notify: input.notify, status: input.status,
    };

    // One ACTIVE timeline per org + period at each level: posting over an
    // existing row replaces it (audited as TIMELINE_UPDATE) instead of leaving
    // two competing rows — resolveEffectiveDeadline picks the first match, so
    // duplicates would make the effective deadline ambiguous.
    const existingRow = await db.reportingTimeline.findFirst({
      where: {
        subsidiaryId: ctx.subsidiaryId, period: input.period, level: input.level, status: "ACTIVE",
        ...(input.level === "BUSINESS_UNIT" ? { businessUnitId } : {}),
        ...(input.level === "PROJECT" ? { projectId } : {}),
      },
    });

    let timeline: Awaited<ReturnType<typeof db.reportingTimeline.create>> | null = null;
    let auditAction = "TIMELINE_CREATE";
    let before: Record<string, unknown> = {};

    if (existingRow) {
      auditAction = "TIMELINE_UPDATE";
      before = snap(existingRow);
      timeline = await db.reportingTimeline.update({ where: { id: existingRow.id }, data });
    }
    if (!timeline) {
      // Create with a unique ref; retry once on the unlikely collision.
      let created: Awaited<ReturnType<typeof db.reportingTimeline.create>> | null = null;
      for (let attempt = 0; attempt < 2 && !created; attempt++) {
        try {
          created = await db.reportingTimeline.create({ data: { ...data, ref: makeRef("RTL"), createdByName: ctx.name } });
        } catch (e) {
          if (attempt === 1 || (e as { code?: string }).code !== "P2002") throw e;
        }
      }
      if (!created) throw new SaError("Could not create the timeline. Please retry.", 500);
      timeline = created;
    }

    const affected = await timelineAffected(timeline);
    const dueLabel = input.dueDate ? input.dueDate.toISOString().slice(0, 10) : "inherited";
    await saLogActivity(ctx, sub.name, {
      action: auditAction, targetType: "ReportingTimeline",
      targetLabel: `${timeline.ref} — ${timeline.name}`,
    });
    await saLogAudit(ctx, sub.code, {
      action: auditAction, targetType: "ReportingTimeline", targetId: timeline.id,
      targetLabel: timeline.name, before, after: snap(timeline), reason: input.overrideReason,
    });
    await saNotify({
      ntype: "SYSTEM", title: "Reporting timeline updated",
      body: `${orgName} — ${input.name} (${input.period}), effective due ${dueLabel}. ${affected.buCount} BU(s) and ${affected.projectCount} project(s) inherit this deadline.`,
      subsidiaryId: ctx.subsidiaryId, linkView: "timelines", refId: timeline.id,
    });

    /* fresh state for the response row (resolution + entity stats) */
    const [freshRows, subs] = await Promise.all([
      db.reportingTimeline.findMany({ where: { subsidiaryId: ctx.subsidiaryId, period: input.period, status: "ACTIVE" } }),
      db.submission.findMany({
        where: { subsidiaryId: ctx.subsidiaryId },
        select: { period: true, status: true, submittedAt: true, businessUnitId: true, projectId: true },
      }),
    ]);
    const row = toTimelineRow(
      timeline, orgId, orgName, freshRows, sub.code,
      entitySubStats(subs, timeline.period, {
        level: timeline.level as TimelineLevel,
        businessUnitId: timeline.businessUnitId,
        projectId: timeline.projectId,
      })
    );
    return ok({ timeline: row, affected }, { status: 201 });
  });
}
