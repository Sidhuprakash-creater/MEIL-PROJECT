import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import {
  BaError, baHandle, requireBuAdmin, getBuOrThrow, assertProjectInBuScope,
  baLogActivity, baLogAudit, baNotify,
} from "@/lib/ba/server";
import {
  entitySubStats, toTimelineRow, parseTimelineBody, timelineAffected,
} from "@/lib/sa/helpers";
import type { TimelineDbRow, TimelineLevel } from "@/lib/sa/helpers";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const snap = (t: TimelineDbRow) => ({
  name: t.name, period: t.period, level: t.level,
  startDate: t.startDate.toISOString(), dueDate: t.dueDate?.toISOString() ?? null,
  reviewDeadline: t.reviewDeadline?.toISOString() ?? null,
  inheritanceMode: t.inheritanceMode, overrideReason: t.overrideReason,
  notify: t.notify, status: t.status,
});

export async function PATCH(req: NextRequest, { params }: Params) {
  return baHandle(async () => {
    const ctx = await requireBuAdmin();
    const bu = await getBuOrThrow(ctx.businessUnitId);
    const { id } = await params;
    const existing = await db.reportingTimeline.findUnique({ where: { id } });
    if (!existing) throw new BaError("Timeline not found.", 404);
    if (existing.subsidiaryId !== ctx.subsidiaryId) {
      throw new BaError("This timeline is outside your assigned subsidiary.", 403);
    }

    const body = (await req.json().catch(() => ({}))) as {
      level?: string; orgId?: string; name?: string; period?: string; startDate?: string;
      dueDate?: string | null; reviewDeadline?: string | null; categories?: string[];
      inheritanceMode?: string; overrideReason?: string; notify?: boolean; status?: string;
    };
    const input = parseTimelineBody(body, existing);

    /* POLICY: BU Admin may set PROJECT-level deadlines ONLY. */
    if (input.level === "SUBSIDIARY") {
      throw new BaError("Subsidiary-level deadlines are owned by your Subsidiary Admin. They cannot be modified from the BU workspace.", 403);
    }
    if (input.level === "BUSINESS_UNIT") {
      throw new BaError("BU-level deadlines are owned by your Subsidiary Admin. Only project-level deadlines can be assigned here.", 403);
    }

    const target = (body.orgId ?? "").trim() || existing.projectId || "";
    if (!target) throw new BaError("Select the project this deadline applies to.", 400);
    const project = await assertProjectInBuScope(target, ctx.businessUnitId);
    const projectId = project.id;

    /* Subsidiary mandatory deadlines cannot be overridden. */
    const parentSub = await db.reportingTimeline.findFirst({
      where: { subsidiaryId: ctx.subsidiaryId, period: input.period, level: "SUBSIDIARY", status: "ACTIVE" },
    });
    if (parentSub && input.inheritanceMode === "OVERRIDE" && parentSub.dueDate && input.dueDate) {
      if (new Date(input.dueDate).getTime() > new Date(parentSub.dueDate).getTime()) {
        throw new BaError("Project deadline cannot extend past the subsidiary mandatory window. Pick an earlier due date or inherit.", 409);
      }
    }

    const timeline = await db.reportingTimeline.update({
      where: { id },
      data: {
        name: input.name, period: input.period, level: "PROJECT",
        subsidiaryId: ctx.subsidiaryId, businessUnitId: ctx.businessUnitId, projectId,
        startDate: input.startDate, dueDate: input.dueDate, reviewDeadline: input.reviewDeadline,
        categories: JSON.stringify(input.categories),
        inheritanceMode: input.inheritanceMode, overrideReason: input.overrideReason,
        notify: input.notify, status: input.status,
      },
    });

    const affected = await timelineAffected(timeline);
    const dueLabel = input.dueDate ? input.dueDate.toISOString().slice(0, 10) : "inherited";
    await baLogActivity(ctx, bu.name, {
      action: "TIMELINE_UPDATE", targetType: "ReportingTimeline",
      targetLabel: `${timeline.ref} — ${timeline.name}`,
    });
    await baLogAudit(ctx, bu.code, {
      action: "TIMELINE_UPDATE", targetType: "ReportingTimeline", targetId: id,
      targetLabel: timeline.name, before: snap(existing), after: snap(timeline), reason: input.overrideReason,
    });
    await baNotify({
      ntype: "SYSTEM", title: "Project deadline updated",
      body: `${project.name} — ${input.name} (${input.period}), effective due ${dueLabel}. ${affected.projectCount} project(s) inherit this deadline.`,
      linkView: "timelines", refId: timeline.id,
    });

    const [freshRows, freshSubs] = await Promise.all([
      db.reportingTimeline.findMany({ where: { subsidiaryId: ctx.subsidiaryId, period: input.period, status: "ACTIVE" } }),
      db.submission.findMany({
        where: { businessUnitId: ctx.businessUnitId },
        select: { period: true, status: true, submittedAt: true, businessUnitId: true, projectId: true },
      }),
    ]);
    const stats = entitySubStats(freshSubs, timeline.period, {
      level: "PROJECT" as TimelineLevel, projectId,
    });
    const row = toTimelineRow(timeline, projectId, project.name, freshRows, bu.subsidiary.code, stats);
    return ok({ timeline: row, affected });
  });
}
