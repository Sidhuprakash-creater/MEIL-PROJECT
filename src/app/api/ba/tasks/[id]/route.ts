import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { BaError, baHandle, requireBuAdmin, getBuOrThrow, baLogActivity, baLogAudit, baNotify, parseJson } from "@/lib/ba/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  return baHandle(async () => {
    const ctx = await requireBuAdmin();
    const bu = await getBuOrThrow(ctx.businessUnitId);
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as {
      action?: string; status?: string; title?: string; description?: string;
      priority?: string; dueDate?: string; reason?: string;
    };

    const before = await db.task.findUnique({ where: { id } });
    if (!before) throw new BaError("Task not found.", 404);
    if (before.businessUnitId !== ctx.businessUnitId) {
      throw new BaError("This task is outside your assigned business unit.", 403);
    }

    /* Reminder action — creates a real cross-console notification. */
    if (body.action === "remind") {
      const log = parseJson<{ at: string; channel: string }[]>(before.reminderLog, []);
      log.push({ at: new Date().toISOString(), channel: "In-app" });
      const updated = await db.task.update({
        where: { id },
        data: { remindersSent: before.remindersSent + 1, reminderLog: JSON.stringify(log) },
      });
      await baNotify({
        ntype: "DEADLINE", title: `Reminder sent: ${before.ref}`,
        body: `Reminder for "${before.title}" dispatched to ${before.recipients} recipient(s).`,
        severity: before.priority === "CRITICAL" ? "CRITICAL" : "INFO",
        linkView: "tasks", refId: before.id,
      });
      await baLogActivity(ctx, bu.name, { action: "REMINDER_DISPATCH", targetType: "Task", targetLabel: before.ref });
      await baLogAudit(ctx, bu.code, { action: "REMINDER_DISPATCH", targetType: "Task", targetId: id, targetLabel: before.ref, before: { remindersSent: before.remindersSent }, after: { remindersSent: updated.remindersSent } });
      return ok({ ok: true, remindersSent: updated.remindersSent, message: `Reminder dispatched to ${before.recipients} recipient(s).` });
    }

    if (body.action === "escalate") {
      await baNotify({
        ntype: "OVERDUE", title: `Escalated: ${before.ref}`,
        body: `"${before.title}" was escalated to the BU Manager and Subsidiary Admin.`,
        severity: "CRITICAL", linkView: "tasks", refId: before.id,
      });
      await baLogActivity(ctx, bu.name, { action: "TASK_ESCALATE", targetType: "Task", targetLabel: before.ref, severity: "WARNING" });
      await baLogAudit(ctx, bu.code, { action: "TASK_ESCALATE", targetType: "Task", targetId: id, targetLabel: before.ref });
      return ok({ ok: true, message: "Task escalated to the BU Manager and Subsidiary Admin." });
    }

    /* Status update — also re-derives dates for staging. */
    const t = await db.task.update({
      where: { id },
      data: {
        title: body.title?.trim() || before.title,
        description: body.description ?? before.description,
        priority: body.priority ?? before.priority,
        dueDate: body.dueDate ? new Date(body.dueDate) : before.dueDate,
        status: body.status ?? before.status,
      },
    });
    await baLogAudit(ctx, bu.code, { action: "TASK_UPDATE", targetType: "Task", targetId: t.id, targetLabel: t.ref, before: { status: before.status, dueDate: before.dueDate.toISOString() }, after: { status: t.status, dueDate: t.dueDate.toISOString() }, reason: body.reason });
    return ok({ ok: true, status: t.status });
  });
}
