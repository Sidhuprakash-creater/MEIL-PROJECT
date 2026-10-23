import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import {
  SaError, saHandle, requireSubsidiaryAdmin, getSubsidiaryOrThrow, assertUnitInScope, assertProjectInScope,
  saLogActivity, saLogAudit, saNotify,
} from "@/lib/sa/server";
import { entitySubStats, toTimelineRow, parseTimelineBody, timelineAffected } from "@/lib/sa/helpers";
import type { TimelineBodyInput, TimelineDbRow, TimelineLevel } from "@/lib/sa/helpers";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const snap = (t: TimelineDbRow) => ({
  name: t.name, period: t.period, level: t.level,
  startDate: t.startDate.toISOString(), dueDate: t.dueDate?.toISOString() ?? null,
  reviewDeadline: t.reviewDeadline?.toISOString() ?? null,
  inheritanceMode: t.inheritanceMode, overrideReason: t.overrideReason,
  notify: t.notify, status: t.status,
});

/** Load a timeline row and assert it belongs to the admin's subsidiary. */
async function scopedTimeline(id: string, subsidiaryId: string) {
  const t = await db.reportingTimeline.findUnique({ where: { id } });
  if (!t) throw new SaError("Timeline not found.", 404);
  if (t.subsidiaryId !== subsidiaryId) {
    throw new SaError("This timeline is outside your assigned subsidiary.", 403);
  }
  return t;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  return saHandle(async () => {
    const ctx = await requireSubsidiaryAdmin();
    const { id } = await params;
    const sub = await getSubsidiaryOrThrow(ctx.subsidiaryId);
    const existing = await scopedTimeline(id, ctx.subsidiaryId);
    const body = (await req.json().catch(() => ({}))) as TimelineBodyInput;
    const input = parseTimelineBody(body, existing);

    /* ── resolve the target org (level moves re-run the scope assertions) ── */
    let businessUnitId: string | null = null;
    let projectId: string | null = null;
    let orgId: string | null = sub.id;
    let orgName = sub.name;
    if (input.level === "SUBSIDIARY") {
      orgId = sub.id;
      orgName = sub.name;
    } else if (input.level === "BUSINESS_UNIT") {
      const target = (body.orgId ?? "").trim() || (body.level === undefined ? existing.businessUnitId : null);
      if (!target) throw new SaError("Select the business unit this timeline applies to.", 400);
      const unit = await assertUnitInScope(target, ctx.subsidiaryId);
      businessUnitId = unit.id;
      orgId = unit.id;
      orgName = unit.name;
    } else {
      const target = (body.orgId ?? "").trim() || (body.level === undefined ? existing.projectId : null);
      if (!target) throw new SaError("Select the project this timeline applies to.", 400);
      const project = await assertProjectInScope(target, ctx.subsidiaryId);
      projectId = project.id;
      orgId = project.id;
      orgName = project.name;
    }

    // Only one ACTIVE subsidiary root per period.
    if (input.level === "SUBSIDIARY" && input.status === "ACTIVE") {
      const dup = await db.reportingTimeline.findFirst({
        where: { subsidiaryId: ctx.subsidiaryId, period: input.period, level: "SUBSIDIARY", status: "ACTIVE", id: { not: id } },
      });
      if (dup) throw new SaError("An active subsidiary-level timeline already exists for this period.", 409);
    }

    const timeline = await db.reportingTimeline.update({
      where: { id },
      data: {
        name: input.name, period: input.period, level: input.level,
        businessUnitId, projectId,
        startDate: input.startDate, dueDate: input.dueDate, reviewDeadline: input.reviewDeadline,
        categories: JSON.stringify(input.categories),
        inheritanceMode: input.inheritanceMode, overrideReason: input.overrideReason,
        notify: input.notify, status: input.status,
      },
    });

    const affected = await timelineAffected(timeline);
    await saLogActivity(ctx, sub.name, {
      action: "TIMELINE_UPDATE", targetType: "ReportingTimeline",
      targetLabel: `${timeline.ref} — ${timeline.name}`,
    });
    await saLogAudit(ctx, sub.code, {
      action: "TIMELINE_UPDATE", targetType: "ReportingTimeline", targetId: id,
      targetLabel: timeline.name, before: snap(existing), after: snap(timeline),
      reason: input.overrideReason,
    });
    await saNotify({
      ntype: "SYSTEM", title: "Reporting timeline updated",
      body: `${orgName} — ${input.name} (${input.period}) was updated. ${affected.buCount} BU(s) and ${affected.projectCount} project(s) inherit this deadline.`,
      subsidiaryId: ctx.subsidiaryId, linkView: "timelines", refId: timeline.id,
    });

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
    return ok({ timeline: row, affected });
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return saHandle(async () => {
    const ctx = await requireSubsidiaryAdmin();
    const { id } = await params;
    const sub = await getSubsidiaryOrThrow(ctx.subsidiaryId);
    const existing = await scopedTimeline(id, ctx.subsidiaryId);

    await db.reportingTimeline.delete({ where: { id } });
    // Children automatically fall back to the parent level (inheritance walk-up).

    await saLogActivity(ctx, sub.name, {
      action: "TIMELINE_DELETE", targetType: "ReportingTimeline",
      targetLabel: `${existing.ref} — ${existing.name}`, severity: "WARNING",
    });
    await saLogAudit(ctx, sub.code, {
      action: "TIMELINE_DELETE", targetType: "ReportingTimeline", targetId: id,
      targetLabel: existing.name, before: snap(existing), outcome: "SUCCESS",
    });
    return ok({ ok: true });
  });
}
