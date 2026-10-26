import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import {
  baHandle, requireBuAdmin, getBuOrThrow, assertProjectInBuScope,
} from "@/lib/ba/server";
import { resolveEffectiveDeadline, parseJson } from "@/lib/ba/server";
import { toProjectRow, unitStats, loadBuUserNames, loadBuProjectNames } from "@/lib/ba/rows";
import { toSubmissionRow } from "@/lib/ba/rows";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  return baHandle(async () => {
    const ctx = await requireBuAdmin();
    const { id } = await params;
    const project = await assertProjectInBuScope(id, ctx.businessUnitId);
    const period = "FY 2025-26";

    const [fresh, team, subs, evidence, timelines, tasks, activities, stats, sub0, userNames] = await Promise.all([
      db.project.findUnique({ where: { id }, include: { businessUnit: true, users: { select: { name: true } } } }),
      db.user.findMany({ where: { projectId: id } }),
      db.submission.findMany({ where: { projectId: id, subsidiaryId: ctx.subsidiaryId }, orderBy: { updatedAt: "desc" }, take: 10 }),
      db.evidenceDoc.findMany({ where: { projectId: id }, orderBy: { uploadedAt: "desc" }, take: 10 }),
      db.reportingTimeline.findMany({ where: { projectId: id, status: "ACTIVE" } }),
      db.task.findMany({ where: { businessUnitId: ctx.businessUnitId }, orderBy: { dueDate: "asc" }, take: 20 }),
      db.activityEvent.findMany({ orderBy: { createdAt: "desc" }, take: 80 }),
      unitStats(ctx.subsidiaryId, period),
      getBuOrThrow(ctx.businessUnitId),
      loadBuUserNames(ctx.businessUnitId, ctx.subsidiaryId),
    ]);
    if (!fresh) throw new Error("Project not found.");
    const buMap = new Map<string, string>([[ctx.businessUnitId, ""]]);
    const prjMap = await loadBuProjectNames(ctx.businessUnitId);
    void userNames;

    const eff = resolveEffectiveDeadline("PROJECT", { subsidiaryId: ctx.subsidiaryId, businessUnitId: ctx.businessUnitId, projectId: id }, timelines, sub0.code);

    return ok({
      project: toProjectRow(fresh, stats.prjMap.get(id) ?? { approved: 0, pending: 0, overdue: 0, total: 0, lastAt: null }, eff.dueDate, "OK"),
      team: team.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, status: u.status, title: u.title })),
      submissions: subs.map((s) => toSubmissionRow(s, userNames, buMap, prjMap)),
      evidence: evidence.map((e) => ({ id: e.id, name: e.name, fileType: e.fileType, status: e.status, uploadedAt: e.uploadedAt.toISOString(), uploadedBy: e.uploadedBy, version: e.version })),
      timelines: timelines.map((t) => ({
        id: t.id, ref: t.ref, name: t.name, period: t.period, level: t.level, orgId: t.projectId, orgName: fresh.name,
        startDate: t.startDate.toISOString(), dueDate: t.dueDate?.toISOString() ?? null, reviewDeadline: t.reviewDeadline?.toISOString() ?? null,
        categories: parseJson<string[]>(t.categories, []),
        inheritanceMode: t.inheritanceMode, overrideReason: t.overrideReason,
        effectiveDueDate: t.dueDate?.toISOString() ?? null, deadlineStatus: t.inheritanceMode === "OVERRIDE" ? "OVERRIDE" : "INHERIT",
        status: t.status, notify: t.notify, createdByName: t.createdByName, updatedAt: t.updatedAt.toISOString(),
      })),
      tasks: tasks.slice(0, 8).map((t) => ({ id: t.id, ref: t.ref, title: t.title, category: t.category, priority: t.priority, status: t.status, dueDate: t.dueDate.toISOString() })),
      activity: activities.filter((a) => a.targetLabel.includes(fresh.name) || a.targetLabel.includes(fresh.code)).slice(0, 8)
        .map((a) => ({ id: a.id, actorName: a.actorName, actorRole: a.actorRole, action: a.action, targetType: a.targetType, targetLabel: a.targetLabel, orgLabel: a.orgLabel, severity: a.severity, createdAt: a.createdAt.toISOString() })),
    });
  });
}
