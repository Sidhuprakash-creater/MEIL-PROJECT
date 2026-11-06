import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  getProjectAdminContext,
  paOk,
  paFail,
  logProjectActivity,
  getPaServerCache,
  setPaServerCache,
  invalidatePaServerCache,
} from "@/lib/project-admin/server";
import { CONTRIBUTOR_CATEGORIES } from "@/lib/project-admin/store";
import type { ContributorRole } from "@/lib/project-admin/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const ctx = await getProjectAdminContext();
    if (!ctx) return paFail("Project Admin context not resolved.", 401);

    const cacheKey = `tasks:${ctx.projectId}`;
    const cached = getPaServerCache<any>(cacheKey);
    if (cached) {
      return paOk(cached);
    }

    const [tasks, users] = await Promise.all([
      db.task.findMany({
        where: { OR: [{ businessUnitId: ctx.businessUnitId }, { subsidiaryId: ctx.subsidiaryId }] },
        select: {
          id: true,
          ref: true,
          title: true,
          description: true,
          category: true,
          assigneeLabel: true,
          priority: true,
          status: true,
          dueDate: true,
          updatedAt: true,
        },
        orderBy: { dueDate: "asc" },
      }),
      db.user.findMany({
        where: { projectId: ctx.projectId },
        select: { id: true, name: true, role: true },
      }),
    ]);

    const taskItems = tasks.map((t, idx) => {
      /* Assignee may be stored as a user id (older correction flow) or a name —
         resolve both before falling back to a round-robin user. */
      const u =
        users.find((usr) => usr.name === t.assigneeLabel) ||
        users.find((usr) => usr.id === t.assigneeLabel) ||
        users[idx % (users.length || 1)];
      const catKey = (Object.keys(CONTRIBUTOR_CATEGORIES).find(
        (k) => t.category?.toUpperCase().includes(k.replace("_USER", ""))
      ) || "ENV_DATA_USER") as ContributorRole;

      const due = t.dueDate ? new Date(t.dueDate) : new Date(Date.now() + 14 * 86400 * 1000);
      const now = new Date();
      const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      return {
        id: t.id,
        ref: t.ref || `TSK-PRJ-${String(idx + 1).padStart(3, "0")}`,
        title: t.title,
        description: t.description || "",
        category: catKey,
        categoryLabel: (CONTRIBUTOR_CATEGORIES as any)[catKey]?.label || t.category || "General",
        sectionCode: `${catKey.slice(0, 3)}-01`,
        sectionName: t.title,
        assignedUserId: u?.id || "",
        assignedUserName: t.assigneeLabel || u?.name || "Assigned Contributor",
        assignedUserRole: u?.role || catKey,
        period: "Q4 FY 2025-26",
        dueDate: due.toISOString(),
        inheritedDeadline: "2026-03-31T00:00:00.000Z",
        status: (diffDays < 0 && t.status !== "COMPLETED" ? "OVERDUE" : t.status) as any,
        daysRemaining: diffDays,
        requiresEvidence: true,
        priority: (t.priority || "MEDIUM") as any,
        updatedAt: t.updatedAt ? new Date(t.updatedAt).toISOString() : new Date().toISOString(),
      };
    });

    const payload = {
      tasks: taskItems,
      summary: {
        total: taskItems.length,
        pending: taskItems.filter((t) => t.status === "PENDING" || t.status === "IN_PROGRESS").length,
        completed: taskItems.filter((t) => t.status === "COMPLETED").length,
        overdue: taskItems.filter((t) => t.status === "OVERDUE").length,
      },
    };

    setPaServerCache(cacheKey, payload, 45000);
    return paOk(payload);
  } catch (err: any) {
    return paFail(err.message, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getProjectAdminContext();
    if (!ctx) return paFail("Project Admin context not resolved.", 401);

    const body = await req.json();
    const { title, description, category, assignedUserId, dueDate, priority } = body;

    if (!title || !category || !assignedUserId || !dueDate) {
      return paFail("Title, category, assigned contributor, and deadline are required.");
    }

    const inheritedDeadline = new Date("2026-03-31T23:59:59.000Z");
    const chosenDue = new Date(dueDate);
    if (chosenDue > inheritedDeadline) {
      return paFail("Task deadline cannot exceed the inherited Business Unit reporting deadline (31 Mar 2026).");
    }

    invalidatePaServerCache();

    const assignedUser = await db.user.findUnique({
      where: { id: assignedUserId },
      select: { id: true, name: true },
    });
    if (!assignedUser) return paFail("Selected contributor user not found.", 404);

    const taskCount = await db.task.count();
    const newTask = await db.task.create({
      data: {
        ref: `TSK-${ctx.projectCode}-${String(taskCount + 1).padStart(3, "0")}`,
        title: title.trim(),
        description: description?.trim() || "",
        category,
        assigneeType: "USER",
        assigneeLabel: assignedUser.name,
        /* Precise scope handle so contributor surfaces (/api/pu/action-items)
           can list this task for the right person, not just by name. */
        assigneeFilter: assignedUserId,
        priority: priority || "MEDIUM",
        status: "PENDING",
        startDate: new Date(),
        dueDate: chosenDue,
        businessUnitId: ctx.businessUnitId,
        subsidiaryId: ctx.subsidiaryId,
      },
    });

    // Notify the contributor
    await db.notification.create({
      data: {
        ntype: "TASK_ASSIGNED",
        title: "New ESG Task Assigned",
        body: `You have been assigned task '${newTask.title}' by Project Admin ${ctx.userName}. Deadline: ${chosenDue.toLocaleDateString("en-IN")}.`,
        refId: assignedUser.id,
        subsidiaryId: ctx.subsidiaryId,
        severity: "INFO",
        linkView: "tasks",
      },
    });

    await logProjectActivity({
      actorName: ctx.userName,
      actorRole: "Project Admin",
      action: "TASK_CREATE",
      targetType: "Task",
      targetLabel: newTask.title,
      category,
      severity: "INFO",
    });

    return paOk({ task: newTask }, "Reporting task assigned successfully.");
  } catch (err: any) {
    return paFail(err.message, 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const ctx = await getProjectAdminContext();
    if (!ctx) return paFail("Project Admin context not resolved.", 401);

    const body = await req.json();
    const { id, status, dueDate, action } = body;

    if (!id) return paFail("Task ID is required.");

    invalidatePaServerCache();

    const existing = await db.task.findUnique({ where: { id } });
    if (!existing) return paFail("Task not found.", 404);

    if (action === "remind") {
      if (existing.assigneeFilter) {
        await db.notification.create({
          data: {
            ntype: "TASK_REMINDER",
            title: "Task Reminder",
            body: `Reminder: Task '${existing.title}' is due on ${existing.dueDate ? new Date(existing.dueDate).toLocaleDateString("en-IN") : "soon"}. Please submit promptly.`,
            refId: existing.assigneeFilter,
            subsidiaryId: ctx.subsidiaryId,
            severity: "WARNING",
            linkView: "tasks",
          },
        });
      }

      await logProjectActivity({
        actorName: ctx.userName,
        actorRole: "Project Admin",
        action: "TASK_REMIND",
        targetType: "Task",
        targetLabel: existing.title,
        category: "Tasks",
        severity: "INFO",
      });

      return paOk({}, `Reminder sent to ${existing.assigneeLabel || "assignee"}.`);
    }

    if (dueDate) {
      const inheritedDeadline = new Date("2026-03-31T23:59:59.000Z");
      const newDate = new Date(dueDate);
      if (newDate > inheritedDeadline) {
        return paFail("Task deadline cannot exceed the inherited Business Unit deadline (31 Mar 2026).");
      }
    }

    const updated = await db.task.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(dueDate && { dueDate: new Date(dueDate) }),
      },
    });

    await logProjectActivity({
      actorName: ctx.userName,
      actorRole: "Project Admin",
      action: "TASK_UPDATE",
      targetType: "Task",
      targetLabel: updated.title,
      category: "Tasks",
      severity: "INFO",
    });

    return paOk({ task: updated }, "Task updated successfully.");
  } catch (err: any) {
    return paFail(err.message, 500);
  }
}
