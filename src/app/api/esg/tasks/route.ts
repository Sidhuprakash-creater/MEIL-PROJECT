import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handle, ok, fail, body, parseJson, logActivity, logAudit, ACTOR } from "@/lib/esg/server";
import type { Task } from "@/lib/esg/types";

function decorate(t: Awaited<ReturnType<typeof db.task.findMany>>[number], subMap: Map<string, string>, unitMap: Map<string, string>): Task {
  return {
    ...t,
    subsidiaryName: t.subsidiaryId ? subMap.get(t.subsidiaryId) ?? null : null,
    businessUnitName: t.businessUnitId ? unitMap.get(t.businessUnitId) ?? null : null,
    startDate: t.startDate.toISOString(),
    dueDate: t.dueDate.toISOString(),
    reminderLog: parseJson(t.reminderLog, []),
  };
}

export async function GET() {
  return handle(async () => {
    const [tasks, subs, units] = await Promise.all([
      db.task.findMany({ orderBy: { dueDate: "asc" } }),
      db.subsidiary.findMany({ select: { id: true, name: true } }),
      db.businessUnit.findMany({ select: { id: true, name: true } }),
    ]);
    const subMap = new Map(subs.map((s) => [s.id, s.name]));
    const unitMap = new Map(units.map((u) => [u.id, u.name]));
    // Recompute statuses based on dates
    const now = Date.now();
    const decorated: Task[] = [];
    for (const t of tasks) {
      let status = t.status;
      if (status !== "COMPLETED") {
        if (t.dueDate.getTime() < now) status = "OVERDUE";
        else if (t.startDate.getTime() > now) status = "UPCOMING";
        else status = "ACTIVE";
        if (status !== t.status) await db.task.update({ where: { id: t.id }, data: { status } });
      }
      decorated.push(decorate({ ...t, status }, subMap, unitMap));
    }
    return ok({ tasks: decorated });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const b = await body<Record<string, string>>(req);

    if (b.action === "remind") {
      if (!b.id) return fail("Task id is required.");
      const t = await db.task.findUnique({ where: { id: b.id } });
      if (!t) return fail("Task not found.", 404);
      const log = parseJson<{ at: string; channel: string }[]>(t.reminderLog, []);
      log.push({ at: new Date().toISOString(), channel: "In-app" });
      await db.task.update({ where: { id: t.id }, data: { remindersSent: t.remindersSent + 1, reminderLog: JSON.stringify(log) } });
      await db.notification.create({
        data: {
          ntype: "DEADLINE",
          title: `Reminder sent: ${t.ref}`,
          body: `Reminder for "${t.title}" dispatched to ${t.recipients} recipient(s).`,
          severity: "INFO",
          linkView: "tasks",
          refId: t.id,
        },
      });
      await logAudit({ actorName: ACTOR.name, action: "REMINDER_DISPATCH", targetType: "Task", targetId: t.id, targetLabel: t.ref, after: { remindersSent: t.remindersSent + 1 } });
      return ok({ message: `Reminder dispatched to ${t.recipients} recipient(s). Delivery recorded in-app.` });
    }

    if (b.action === "escalate") {
      if (!b.id) return fail("Task id is required.");
      const t = await db.task.findUnique({ where: { id: b.id } });
      if (!t) return fail("Task not found.", 404);
      await db.notification.create({
        data: {
          ntype: "OVERDUE",
          title: `Escalated: ${t.ref}`,
          body: `"${t.title}" was escalated to the responsible manager chain (BU Manager → Subsidiary Admin).`,
          severity: "CRITICAL",
          linkView: "tasks",
          refId: t.id,
        },
      });
      await logAudit({ actorName: ACTOR.name, action: "TASK_ESCALATE", targetType: "Task", targetId: t.id, targetLabel: t.ref });
      return ok({ message: "Task escalated to the responsible manager chain." });
    }

    /* Create task */
    if (!b.title?.trim()) return fail("Task title is required.");
    if (!b.dueDate) return fail("Due date is required.");
    if (b.assigneeType === "USER" && !b.assigneeLabel) return fail("Select a responsible user.");
    if (b.assigneeType === "ROLE" && !b.assigneeFilter) return fail("Select a role group.");
    if (b.assigneeType === "BU" && !b.businessUnitId) return fail("Select a business unit.");
    if (b.assigneeType === "SUBSIDIARY" && !b.subsidiaryId) return fail("Select a subsidiary.");
    const due = new Date(b.dueDate);
    const start = b.startDate ? new Date(b.startDate) : new Date();
    const count = await db.task.count();
    const recipients = parseInt(b.recipients || "1", 10) || 1;
    const t = await db.task.create({
      data: {
        ref: `TSK-2526-${String(count + 1).padStart(3, "0")}`,
        title: b.title.trim(),
        description: b.description || "",
        category: b.category || "ENVIRONMENT",
        assigneeType: b.assigneeType || "USER",
        assigneeLabel: b.assigneeLabel || b.assigneeFilter || "All eligible users",
        assigneeFilter: b.assigneeFilter || "{}",
        subsidiaryId: b.subsidiaryId || null,
        businessUnitId: b.businessUnitId || null,
        period: b.period || "FY 2025-26",
        startDate: start,
        dueDate: due,
        priority: b.priority || "MEDIUM",
        status: due.getTime() < Date.now() ? "OVERDUE" : start.getTime() > Date.now() ? "UPCOMING" : "ACTIVE",
        requiresEvidence: b.requiresEvidence !== "false",
        recipients,
      },
    });
    await db.notification.create({
      data: {
        ntype: "DEADLINE",
        title: `New reporting task: ${t.ref}`,
        body: `"${t.title}" assigned to ${t.assigneeLabel}. Due ${due.toLocaleDateString("en-IN")}.`,
        severity: t.priority === "CRITICAL" ? "CRITICAL" : "INFO",
        linkView: "tasks",
        refId: t.id,
      },
    });
    // Push the task + deadline into the Project User Portal so site-operations
    // users see the assignment on the receiver side too (best-effort).
    try {
      const { pushTaskToPortalUsers } = await import("@/lib/bridge/pu-link");
      const pushed = await pushTaskToPortalUsers({
        id: t.id,
        ref: t.ref,
        title: t.title,
        description: t.description,
        category: t.category,
        dueDate: t.dueDate,
        priority: t.priority,
        subsidiaryId: t.subsidiaryId,
        businessUnitId: t.businessUnitId,
      });
      if (pushed.notified > 0) {
        console.log("[tasks] portal push:", t.ref, "→", pushed.notified, "site user(s)");
      }
    } catch (portalErr) {
      console.warn("[tasks] portal push notice:", portalErr);
    }
    await Promise.all([
      logActivity({ actorName: ACTOR.name, action: "TASK_ASSIGN", targetType: "Task", targetLabel: `${t.ref} — ${t.title}` }),
      logAudit({ actorName: ACTOR.name, action: "TASK_CREATE", targetType: "Task", targetId: t.id, targetLabel: t.ref, after: { title: t.title, assignee: t.assigneeLabel, dueDate: due.toISOString(), priority: t.priority } }),
    ]);
    return ok({ task: t }, { status: 201 });
  });
}

export async function PATCH(req: NextRequest) {
  return handle(async () => {
    const b = await body<Record<string, string>>(req);
    if (!b.id) return fail("Task id is required.");
    const before = await db.task.findUnique({ where: { id: b.id } });
    if (!before) return fail("Task not found.", 404);
    const t = await db.task.update({
      where: { id: b.id },
      data: {
        title: b.title?.trim() || before.title,
        description: b.description ?? before.description,
        priority: b.priority ?? before.priority,
        dueDate: b.dueDate ? new Date(b.dueDate) : before.dueDate,
        status: b.status ?? before.status,
      },
    });
    await logAudit({ actorName: ACTOR.name, action: "TASK_UPDATE", targetType: "Task", targetId: t.id, targetLabel: t.ref, before: { status: before.status, dueDate: before.dueDate.toISOString() }, after: { status: t.status, dueDate: t.dueDate.toISOString() }, reason: b.reason });
    return ok({ task: t });
  });
}

export async function DELETE(req: NextRequest) {
  return handle(async () => {
    const b = await body<Record<string, string>>(req);
    if (!b.id) return fail("Task id is required.");
    const before = await db.task.findUnique({ where: { id: b.id } });
    if (!before) return fail("Task not found.", 404);
    if (before.status === "COMPLETED") return fail("Completed tasks are part of reporting history and cannot be cancelled.");
    await db.task.update({ where: { id: b.id }, data: { status: "COMPLETED", completed: before.recipients } });
    await logAudit({ actorName: ACTOR.name, action: "TASK_CANCEL", targetType: "Task", targetId: before.id, targetLabel: before.ref, before: { status: before.status }, after: { status: "COMPLETED" }, reason: b.reason ?? "Cancelled by Group Admin" });
    return ok({ success: true });
  });
}
