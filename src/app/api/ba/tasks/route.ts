import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import {
  BaError, baHandle, requireBuAdmin, getBuOrThrow, assertProjectInBuScope, assertUserInBuScope,
  ROLE_LABELS, baLogActivity, baLogAudit, baNotify, parseJson,
} from "@/lib/ba/server";
import { loadBuUserNames, loadBuProjectNames } from "@/lib/ba/rows";
import type { BaTasksData } from "@/lib/ba/types";

export const dynamic = "force-dynamic";

interface TaskRow {
  id: string; ref: string; title: string; category: string;
  assigneeLabel: string; dueDate: string; startDate: string;
  priority: string; status: string; requiresEvidence: boolean;
  completed: number; recipients: number;
}

function decorateTask(t: {
  id: string; ref: string; title: string; category: string;
  assigneeType: string; assigneeLabel: string; assigneeFilter: string;
  startDate: Date; dueDate: Date; priority: string; status: string;
  requiresEvidence: boolean; completed: number; recipients: number;
  acknowledged: number; remindersSent: number; reminderLog: string;
}, userMap: Map<string, string>): TaskRow {
  void userMap;
  return {
    id: t.id, ref: t.ref, title: t.title, category: t.category,
    assigneeLabel: t.assigneeLabel || "All eligible users",
    dueDate: t.dueDate.toISOString(),
    startDate: t.startDate.toISOString(),
    priority: t.priority, status: t.status,
    requiresEvidence: t.requiresEvidence,
    completed: t.completed, recipients: t.recipients,
  };
}

export async function GET() {
  return baHandle(async () => {
    const ctx = await requireBuAdmin();
    const bu = await getBuOrThrow(ctx.businessUnitId);
    void bu;

    const [tasks, users, projectNames, timelines] = await Promise.all([
      db.task.findMany({ where: { businessUnitId: ctx.businessUnitId }, orderBy: { dueDate: "asc" } }),
      db.user.findMany({ where: { businessUnitId: ctx.businessUnitId }, select: { id: true, name: true } }),
      loadBuProjectNames(ctx.businessUnitId),
      db.reportingTimeline.findMany({ where: { subsidiaryId: ctx.subsidiaryId, status: "ACTIVE" } }),
    ]);
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    const now = Date.now();
    const decorated: TaskRow[] = [];
    let upcoming = 0, dueSoon = 0, overdue = 0, completed = 0;
    for (const t of tasks) {
      let status = t.status;
      if (status !== "COMPLETED") {
        if (t.dueDate.getTime() < now) status = "OVERDUE";
        else if (t.startDate.getTime() > now) status = "UPCOMING";
        else status = "ACTIVE";
        if (status !== t.status) await db.task.update({ where: { id: t.id }, data: { status } });
      }
      decorated.push(decorateTask({ ...t, status }, userMap));
      if (status === "COMPLETED") completed++;
      else if (status === "OVERDUE") overdue++;
      else if (status === "UPCOMING") upcoming++;
      else {
        const days = (t.dueDate.getTime() - now) / 86400000;
        if (days <= 3) dueSoon++;
      }
    }

    const myTasks = decorated.filter((t) => {
      const orig = tasks.find((x) => x.id === t.id);
      if (!orig) return false;
      if (orig.assigneeType === "USER" && orig.assigneeLabel === ctx.name) return true;
      try {
        const f = JSON.parse(orig.assigneeFilter || "{}") as { userIds?: string[] };
        return (f.userIds ?? []).includes(ctx.userId);
      } catch { return false; }
    });

    const projectTasks = decorated; /* all BU tasks ARE project-bounded */

    /* upcoming deadlines feed */
    const upcomingList: { name: string; level: string; dueDate: string; daysLeft: number; status: string }[] = [];
    for (const t of tasks) {
      if (t.status === "COMPLETED") continue;
      const days = Math.ceil((t.dueDate.getTime() - now) / 86400000);
      if (days > 30) continue;
      upcomingList.push({
        name: t.title, level: "PROJECT",
        dueDate: t.dueDate.toISOString(),
        daysLeft: Math.max(0, days),
        status: t.status,
      });
    }
    /* add BU + project effective deadlines so the "upcoming" view is honest */
    for (const p of [...projectNames.entries()]) {
      const eff = timelines.filter((t) => t.projectId === p[0] && t.inheritanceMode === "OVERRIDE" && t.dueDate);
      for (const tl of eff) {
        if (!tl.dueDate) continue;
        const days = Math.ceil((tl.dueDate.getTime() - now) / 86400000);
        if (days < 0 || days > 30) continue;
        upcomingList.push({
          name: p[1], level: "PROJECT",
          dueDate: tl.dueDate.toISOString(),
          daysLeft: Math.max(0, days),
          status: tl.status,
        });
      }
    }
    upcomingList.sort((a, b) => a.daysLeft - b.daysLeft);

    const data: BaTasksData = {
      myTasks,
      projectTasks,
      buckets: { upcoming, dueSoon, overdue, completed },
      upcoming: upcomingList.slice(0, 8),
    };
    return ok(data);
  });
}

export async function POST(req: NextRequest) {
  return baHandle(async () => {
    const ctx = await requireBuAdmin();
    const bu = await getBuOrThrow(ctx.businessUnitId);
    const body = (await req.json().catch(() => ({}))) as {
      title?: string; description?: string; category?: string;
      assigneeType?: string; assigneeLabel?: string; userIds?: string[];
      projectId?: string; period?: string; startDate?: string; dueDate?: string;
      priority?: string; requiresEvidence?: boolean;
    };

    const title = (body.title ?? "").trim();
    if (title.length < 2) throw new BaError("Task title is required (min 2 characters).", 400);
    if (!body.dueDate) throw new BaError("A due date is required.", 400);
    const due = new Date(body.dueDate);
    if (isNaN(due.getTime())) throw new BaError("Due date is not a valid date.", 400);
    const start = body.startDate ? new Date(body.startDate) : new Date();

    let assigneeLabel = "All eligible BU users";
    const assigneeFilter: Record<string, unknown> = { businessUnitId: ctx.businessUnitId };
    const assigneeType = body.assigneeType ?? "USER";

    if (assigneeType === "USER") {
      const ids = [...new Set((Array.isArray(body.userIds) ? body.userIds : []).map(String).filter(Boolean))];
      if (!ids.length) throw new BaError("Select at least one assignee.", 400);
      for (const uid of ids) await assertUserInBuScope(uid, ctx.businessUnitId);
      const users = await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
      assigneeFilter.userIds = ids;
      assigneeLabel = `User · ${users.map((u) => u.name).join(", ")}`.slice(0, 120);
    } else if (assigneeType === "PROJECT") {
      if (!body.projectId) throw new BaError("Select a project for this task.", 400);
      const prj = await assertProjectInBuScope(body.projectId, ctx.businessUnitId);
      assigneeFilter.projectId = prj.id;
      assigneeLabel = `Project · ${prj.name}`;
    } else {
      /* BU-wide */
      assigneeFilter.businessUnitId = ctx.businessUnitId;
    }

    if (body.projectId) {
      await assertProjectInBuScope(body.projectId, ctx.businessUnitId);
      assigneeFilter.projectId = body.projectId;
    }

    const seq = (await db.task.count()) + 1;
    const ref = `TSK-BU-${String(seq).padStart(3, "0")}`;
    const task = await db.task.create({
      data: {
        ref, title, description: (body.description ?? "").trim(),
        category: body.category ?? "ENVIRONMENT",
        assigneeType, assigneeLabel, assigneeFilter: JSON.stringify(assigneeFilter),
        subsidiaryId: ctx.subsidiaryId, businessUnitId: ctx.businessUnitId,
        period: body.period ?? "FY 2025-26",
        startDate: start, dueDate: due,
        priority: body.priority ?? "MEDIUM",
        status: due.getTime() < Date.now() ? "OVERDUE" : start.getTime() > Date.now() ? "UPCOMING" : "ACTIVE",
        requiresEvidence: body.requiresEvidence ?? false,
        recipients: assigneeType === "USER" ? (body.userIds ?? []).length : 1,
      },
    });

    await baNotify({
      ntype: "DEADLINE", title: `New BU task: ${task.ref}`,
      body: `"${task.title}" assigned to ${task.assigneeLabel}. Due ${due.toLocaleDateString("en-IN")}.`,
      severity: task.priority === "CRITICAL" ? "CRITICAL" : "INFO",
      linkView: "tasks", refId: task.id,
    });
    await baLogActivity(ctx, bu.name, { action: "TASK_ASSIGN", targetType: "Task", targetLabel: `${task.ref} — ${task.title}` });
    await baLogAudit(ctx, bu.code, { action: "TASK_CREATE", targetType: "Task", targetId: task.id, targetLabel: task.ref, after: { title: task.title, assignee: task.assigneeLabel, dueDate: due.toISOString(), priority: task.priority } });

    void parseJson;
    return ok({ task: decorateTask(task, new Map()) }, { status: 201 });
  });
}

void ROLE_LABELS;
