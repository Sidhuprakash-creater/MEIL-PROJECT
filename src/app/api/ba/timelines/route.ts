import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import {
  BaError, baHandle, requireBuAdmin, getBuOrThrow, assertProjectInBuScope,
  resolveEffectiveDeadline, deadlineStatus, parseJson,
  baLogActivity, baLogAudit, baNotify,
} from "@/lib/ba/server";
import {
  entitySubStats, toTimelineRow, parseTimelineBody, timelineAffected,
} from "@/lib/sa/helpers";
import type { TimelineDbRow, TimelineLevel } from "@/lib/sa/helpers";
import type { TimelineRow } from "@/lib/ba/types";

export const dynamic = "force-dynamic";

const LEVEL_ORDER: Record<string, number> = { SUBSIDIARY: 0, BUSINESS_UNIT: 1, PROJECT: 2 };

export async function GET(req: NextRequest) {
  return baHandle(async () => {
    const ctx = await requireBuAdmin();
    const bu = await getBuOrThrow(ctx.businessUnitId);
    const periodParam = (req.nextUrl.searchParams.get("period") ?? "").trim();
    const effPeriod = periodParam || "FY 2025-26";

    /* Timelines under the BU (BU-level + project-level) AND the parent subsidiary
       timeline (so the inheritance source is visible in the FE). */
    const [rows, projects, subs] = await Promise.all([
      db.reportingTimeline.findMany({
        where: {
          subsidiaryId: ctx.subsidiaryId, status: "ACTIVE",
          AND: [
            {
              OR: [
                { businessUnitId: ctx.businessUnitId },
                { level: "SUBSIDIARY" },
                { level: "BUSINESS_UNIT", businessUnitId: ctx.businessUnitId },
                { projectId: { in: (await db.project.findMany({ where: { businessUnitId: ctx.businessUnitId }, select: { id: true } })).map((p) => p.id) } },
              ],
            },
            ...(periodParam ? [{ period: periodParam }] : []),
          ],
        },
        orderBy: { createdAt: "desc" },
      }),
      db.project.findMany({ where: { businessUnitId: ctx.businessUnitId }, orderBy: { createdAt: "asc" } }),
      db.submission.findMany({
        where: { businessUnitId: ctx.businessUnitId },
        select: { period: true, status: true, submittedAt: true, businessUnitId: true, projectId: true },
      }),
    ]);

    /* Group ACTIVE rows per period so inheritance walks never cross periods. */
    const byPeriod = new Map<string, TimelineDbRow[]>();
    for (const t of rows) {
      const arr = byPeriod.get(t.period) ?? [];
      arr.push(t);
      byPeriod.set(t.period, arr);
    }
    const projectNames = new Map(projects.map((p) => [p.id, p.name]));

    const timelines: TimelineRow[] = rows
      .map((t) => {
        let orgId: string | null = null;
        let orgName = "—";
        if (t.level === "SUBSIDIARY") { orgId = bu.subsidiaryId; orgName = bu.subsidiary.name; }
        else if (t.level === "BUSINESS_UNIT") { orgId = bu.id; orgName = bu.name; }
        else { orgId = t.projectId; orgName = projectNames.get(t.projectId ?? "") ?? "—"; }
        const stats = entitySubStats(subs, t.period, {
          level: t.level as TimelineLevel,
          businessUnitId: t.businessUnitId,
          projectId: t.projectId,
        });
        return toTimelineRow(t, orgId, orgName, byPeriod.get(t.period) ?? [], bu.subsidiary.code, stats);
      })
      .sort((a, b) =>
        (LEVEL_ORDER[a.level] ?? 9) - (LEVEL_ORDER[b.level] ?? 9) ||
        (a.effectiveDueDate ?? "9999").localeCompare(b.effectiveDueDate ?? "9999") ||
        a.name.localeCompare(b.name)
      );

    return ok({ timelines });
  });
}


export async function POST(req: NextRequest) {
  return baHandle(async () => {
    const ctx = await requireBuAdmin();
    const bu = await getBuOrThrow(ctx.businessUnitId);
    const body = (await req.json().catch(() => ({}))) as {
      level?: string; orgId?: string; name?: string; period?: string; startDate?: string;
      dueDate?: string | null; reviewDeadline?: string | null; categories?: string[];
      inheritanceMode?: string; overrideReason?: string; notify?: boolean; status?: string;
    };
    const input = parseTimelineBody(body);
    if (input.level !== "PROJECT") {
      throw new BaError("BU Admin can only set PROJECT-level deadlines. Subsidiary and BU windows are managed by the Subsidiary Admin.", 403);
    }
    const target = (body.orgId ?? "").trim();
    if (!target) throw new BaError("Select the project this timeline applies to.", 400);
    const project = await assertProjectInBuScope(target, ctx.businessUnitId);

    const parentSub = await db.reportingTimeline.findFirst({
      where: { subsidiaryId: ctx.subsidiaryId, period: input.period, level: "SUBSIDIARY", status: "ACTIVE" },
    });
    if (parentSub && input.inheritanceMode === "OVERRIDE" && parentSub.dueDate && input.dueDate) {
      if (new Date(input.dueDate).getTime() > new Date(parentSub.dueDate).getTime()) {
        throw new BaError("Project deadline cannot extend past the subsidiary mandatory window. Pick an earlier due date or inherit.", 409);
      }
    }

    /* One ACTIVE PROJECT timeline per org+period at each level. */
    const existingRow = await db.reportingTimeline.findFirst({
      where: { subsidiaryId: ctx.subsidiaryId, period: input.period, level: "PROJECT", status: "ACTIVE", projectId: project.id },
    });

    const data = {
      name: input.name, period: input.period, level: "PROJECT",
      subsidiaryId: ctx.subsidiaryId, businessUnitId: ctx.businessUnitId, projectId: project.id,
      startDate: input.startDate, dueDate: input.dueDate, reviewDeadline: input.reviewDeadline,
      categories: JSON.stringify(input.categories),
      inheritanceMode: input.inheritanceMode, overrideReason: input.overrideReason,
      notify: input.notify, status: input.status,
    };

    let timeline: Awaited<ReturnType<typeof db.reportingTimeline.create | typeof db.reportingTimeline.update>>;
    let auditAction = "TIMELINE_CREATE";
    let before: Record<string, unknown> = {};
    if (existingRow) {
      auditAction = "TIMELINE_UPDATE";
      before = {
        name: existingRow.name, period: existingRow.period, level: existingRow.level,
        startDate: existingRow.startDate.toISOString(),
        dueDate: existingRow.dueDate?.toISOString() ?? null,
        reviewDeadline: existingRow.reviewDeadline?.toISOString() ?? null,
        inheritanceMode: existingRow.inheritanceMode, overrideReason: existingRow.overrideReason,
        notify: existingRow.notify, status: existingRow.status,
      };
      timeline = await db.reportingTimeline.update({ where: { id: existingRow.id }, data });
    } else {
      const ref = `TL-PRJ-${Date.now().toString(36).toUpperCase()}`;
      timeline = await db.reportingTimeline.create({ data: { ...data, ref, createdByName: ctx.name } });
    }

    const affected = await timelineAffected(timeline);
    const dueLabel = input.dueDate ? input.dueDate.toISOString().slice(0, 10) : "inherited";
    await baLogActivity(ctx, bu.name, {
      action: auditAction, targetType: "ReportingTimeline",
      targetLabel: `${timeline.ref} — ${timeline.name}`,
    });
    await baLogAudit(ctx, bu.code, {
      action: auditAction, targetType: "ReportingTimeline", targetId: timeline.id,
      targetLabel: timeline.name, before, after: {
        name: timeline.name, period: timeline.period, level: timeline.level,
        startDate: timeline.startDate.toISOString(),
        dueDate: timeline.dueDate?.toISOString() ?? null,
        inheritanceMode: timeline.inheritanceMode, overrideReason: timeline.overrideReason,
      }, reason: input.overrideReason,
    });
    await baNotify({
      ntype: "SYSTEM", title: "Project deadline assigned",
      body: `${project.name} — ${input.name} (${input.period}), effective due ${dueLabel}.`,
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
      level: "PROJECT", projectId: project.id,
    });
    const row = toTimelineRow(timeline, project.id, project.name, freshRows, bu.subsidiary.code, stats);
    return ok({ timeline: row, affected }, { status: 201 });
  });
}
