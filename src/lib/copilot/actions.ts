// MEIL Intelligence — prepared-action execution (Phase 17).
//
// Actions flow: tool (prepare_*) → CopilotConfirmation row (PENDING, short
// TTL) → user clicks Confirm → executeConfirmedAction() runs EXACTLY ONCE
// against the bound arguments → real platform records are written through
// existing tables → audit trail. A model-generated confirmation is never
// sufficient authority: only a PENDING row matching the bound token and user
// can be executed, it expires, and it is single-use (status transition).

import { db } from "@/lib/db";
import { CopilotError } from "./server";
import { parseJson, logActivity, logAudit } from "@/lib/esg/server";
import type { PreparedActionSpec } from "./tools";

const CONFIRMATION_TTL_MS = 10 * 60 * 1000; // 10 minutes, single-use

export function confirmationExpiry(): Date {
  return new Date(Date.now() + CONFIRMATION_TTL_MS);
}

export async function createConfirmation(input: {
  userId: string;
  userName: string;
  conversationId: string;
  spec: PreparedActionSpec;
}): Promise<{ id: string; token: string; expiresAt: Date }> {
  const row = await db.copilotConfirmation.create({
    data: {
      userId: input.userId,
      conversationId: input.conversationId,
      actionName: input.spec.actionName,
      riskLevel: input.spec.riskLevel,
      args: JSON.stringify(input.spec.params),
      summary: input.spec.summary,
      expiresAt: confirmationExpiry(),
    },
  });
  return { id: row.id, token: row.token, expiresAt: row.expiresAt };
}

export interface ExecuteContext {
  userId: string;
  userName: string;
  userRole: string;
}

/**
 * Execute a PENDING confirmation exactly once. Verifies:
 * ownership, non-expiry, single use (atomic status transition), and re-binds
 * execution to the exact stored arguments (never arguments from the request).
 */
export async function executeConfirmedAction(
  confirmationId: string,
  ctx: ExecuteContext
): Promise<{ resultSummary: string }> {
  const row = await db.copilotConfirmation.findUnique({ where: { id: confirmationId } });
  if (!row) throw new CopilotError("Confirmation not found.", 404, "CONFIRMATION_NOT_FOUND");
  if (row.userId !== ctx.userId) throw new CopilotError("This confirmation belongs to a different user.", 403, "FORBIDDEN");
  if (row.status === "CONFIRMED") throw new CopilotError("This confirmation was already executed — confirmations are single-use.", 409, "ALREADY_USED");
  if (row.status === "CANCELLED") throw new CopilotError("This confirmation was cancelled.", 409, "CANCELLED");
  if (row.status === "EXPIRED" || row.expiresAt.getTime() < Date.now()) {
    await db.copilotConfirmation.update({ where: { id: row.id }, data: { status: "EXPIRED" } }).catch(() => undefined);
    throw new CopilotError("This confirmation has expired. Ask MEIL Intelligence to prepare the action again.", 410, "EXPIRED");
  }

  // Atomic single-use transition: updateMany with status guard acts as a lock.
  const claimed = await db.copilotConfirmation.updateMany({
    where: { id: row.id, status: "PENDING" },
    data: { status: "CONFIRMED" },
  });
  if (claimed.count !== 1) {
    throw new CopilotError("This confirmation can no longer be executed.", 409, "NOT_PENDING");
  }

  const args = parseJson<Record<string, unknown>>(row.args, {});
  try {
    const resultSummary = await dispatchAction(row.actionName, args, ctx, row.conversationId);
    await db.copilotConfirmation.update({
      where: { id: row.id },
      data: { executedResult: JSON.stringify({ resultSummary, executedAt: new Date().toISOString() }) },
    });
    return { resultSummary };
  } catch (e) {
    // Record the failure on the row so the UI can show an honest error state.
    await db.copilotConfirmation
      .update({ where: { id: row.id }, data: { executedResult: JSON.stringify({ error: e instanceof Error ? e.message : "Execution failed" }) } })
      .catch(() => undefined);
    throw e;
  }
}

export async function cancelConfirmation(confirmationId: string, ctx: ExecuteContext): Promise<void> {
  const row = await db.copilotConfirmation.findUnique({ where: { id: confirmationId } });
  if (!row) throw new CopilotError("Confirmation not found.", 404, "CONFIRMATION_NOT_FOUND");
  if (row.userId !== ctx.userId) throw new CopilotError("This confirmation belongs to a different user.", 403, "FORBIDDEN");
  if (row.status !== "PENDING") throw new CopilotError(`This confirmation is already ${row.status.toLowerCase()}.`, 409, "NOT_PENDING");
  await db.copilotConfirmation.update({ where: { id: row.id }, data: { status: "CANCELLED", resolvedAt: new Date() } });
}

/* ── real executions — written through the EXISTING platform tables ─────────── */

async function dispatchAction(
  actionName: string,
  args: Record<string, unknown>,
  ctx: ExecuteContext,
  conversationId: string
): Promise<string> {
  switch (actionName) {
    case "prepare_reminder": {
      const subject = String(args.subject ?? "");
      const message = String(args.message ?? "");
      const channel = String(args.channel ?? "GROUP_WIDE");
      const audienceId = typeof args.audienceId === "string" ? args.audienceId : null;
      const audienceLabel = String(args.audience ?? "group");
      const period = String(args.period ?? "");
      const recipients = await countRecipients(channel, audienceId);
      const msg = await db.message.create({
        data: {
          kind: "REMINDER",
          channel,
          subject,
          body: message || subject,
          audienceLabel: audienceLabel === "group" ? "All group users" : audienceLabel,
          audienceFilter: JSON.stringify(audienceId ? { subsidiaryId: audienceId } : {}),
          recipients,
          delivered: recipients,
          status: "SENT",
          sentBy: ctx.userName,
        },
      });
      await db.notification.createMany({
        data: (await resolveRecipientUsers(channel, audienceId)).map((u) => ({
          ntype: "DEADLINE",
          title: `Reminder: ${subject}`,
          body: message || `A reminder was issued by ${ctx.userName}.`,
          severity: "WARNING",
          linkView: "notifications",
          refId: msg.id,
          subsidiaryId: channel === "SUBSIDIARY" ? audienceId : null,
        })),
      });
      await Promise.all([
        logActivity({ actorName: ctx.userName, actorRole: ctx.userRole, action: "DATA_EDIT", targetType: "Message", targetLabel: `Reminder: ${subject}`, severity: "WARNING" }),
        logAudit({ actorName: ctx.userName, actorRole: ctx.userRole, action: "COPILOT_REMINDER_SENT", targetType: "Message", targetId: msg.id, targetLabel: subject, after: { channel, recipients }, reason: "Sent via MEIL Intelligence after explicit confirmation" }),
        appendExecutionNote(conversationId, `Reminder "${subject}" sent to ${recipients} recipients.`),
      ]);
      return `Reminder "${subject}" recorded and delivered to ${recipients} recipient${recipients === 1 ? "" : "s"}${period ? ` (period ${period})` : ""}.`;
    }

    case "prepare_deadline_change": {
      const submissionId = String(args.submissionId ?? "");
      const newDueDate = String(args.newDueDate ?? "");
      const reason = String(args.reason ?? "");
      const d = new Date(newDueDate);
      const s = await db.submission.findUnique({ where: { id: submissionId } });
      if (!s) throw new CopilotError("Submission no longer exists.", 404, "NOT_FOUND");
      const oldDue = s.dueDate.toISOString().slice(0, 10);
      const history = parseJson<{ action: string; actor: string; at: string; note?: string }[]>(s.history, []);
      await db.submission.update({
        where: { id: s.id },
        data: {
          dueDate: d,
          overdue: d.getTime() < Date.now() && !["APPROVED", "REJECTED"].includes(s.status),
          history: JSON.stringify([...history, { action: `Deadline changed by ${ctx.userName}: ${oldDue} → ${newDueDate}`, actor: ctx.userName, at: new Date().toISOString(), note: reason }]),
        },
      });
      await db.notification.create({
        data: {
          ntype: "DEADLINE",
          title: `Deadline changed: ${s.ref}`,
          body: `New due date ${newDueDate}. Reason: ${reason}`.slice(0, 240),
          severity: "WARNING",
          linkView: "submissions",
          refId: s.id,
          subsidiaryId: s.subsidiaryId,
        },
      });
      await Promise.all([
        logActivity({ actorName: ctx.userName, actorRole: ctx.userRole, action: "DATA_EDIT", targetType: "Submission", targetLabel: `${s.ref} deadline → ${newDueDate}`, severity: "WARNING" }),
        logAudit({ actorName: ctx.userName, actorRole: ctx.userRole, action: "COPILOT_DEADLINE_CHANGE", targetType: "Submission", targetId: s.id, targetLabel: s.ref, before: { dueDate: oldDue }, after: { dueDate: newDueDate }, reason }),
        appendExecutionNote(conversationId, `Deadline of ${s.ref} changed ${oldDue} → ${newDueDate}.`),
      ]);
      return `Deadline of ${s.ref} changed from ${oldDue} to ${newDueDate}. Workflow status remains ${s.status}.`;
    }

    case "create_follow_up_task": {
      const title = String(args.title ?? "");
      const description = String(args.description ?? "");
      const assigneeLabel = String(args.assigneeLabel ?? "");
      const dueDate = typeof args.dueDate === "string" && args.dueDate ? new Date(args.dueDate) : new Date(Date.now() + 14 * 86400000);
      const priority = String(args.priority ?? "MEDIUM");
      const period = String(args.period ?? "");
      const count = await db.task.count();
      const ref = `TSK-CP-${String(count + 1).padStart(4, "0")}`;
      const task = await db.task.create({
        data: {
          ref,
          title,
          description,
          assigneeType: assigneeLabel ? "SUBSIDIARY" : "ALL",
          assigneeLabel,
          assigneeFilter: JSON.stringify(assigneeLabel ? { subsidiaryLabel: assigneeLabel } : {}),
          period: period || undefined,
          startDate: new Date(),
          dueDate,
          priority,
          status: dueDate.getTime() < Date.now() ? "OVERDUE" : "ACTIVE",
        },
      });
      await Promise.all([
        logActivity({ actorName: ctx.userName, actorRole: ctx.userRole, action: "TASK_ASSIGN", targetType: "Task", targetLabel: `${ref} — ${title}` }),
        logAudit({ actorName: ctx.userName, actorRole: ctx.userRole, action: "COPILOT_TASK_CREATED", targetType: "Task", targetId: task.id, targetLabel: ref, after: { title, assigneeLabel, dueDate: dueDate.toISOString() }, reason: "Created via MEIL Intelligence after explicit confirmation" }),
        appendExecutionNote(conversationId, `Follow-up task ${ref} created.`),
      ]);
      return `Follow-up task ${ref} ("${title}") created${assigneeLabel ? ` for ${assigneeLabel}` : ""}, due ${dueDate.toISOString().slice(0, 10)}.`;
    }

    default:
      throw new CopilotError(`Unknown prepared action: ${actionName}`, 400, "UNKNOWN_ACTION");
  }
}

async function countRecipients(channel: string, subsidiaryId: string | null): Promise<number> {
  if (channel === "SUBSIDIARY" && subsidiaryId) {
    return db.user.count({ where: { subsidiaryId, status: "ACTIVE" } });
  }
  return db.user.count({ where: { status: "ACTIVE" } });
}

async function resolveRecipientUsers(channel: string, subsidiaryId: string | null): Promise<{ id: string }[]> {
  if (channel === "SUBSIDIARY" && subsidiaryId) {
    return db.user.findMany({ where: { subsidiaryId, status: "ACTIVE" }, select: { id: true } });
  }
  return db.user.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
}

/** Append a system-side note of what actually executed to the conversation. */
async function appendExecutionNote(conversationId: string, text: string) {
  await db.copilotMessage
    .create({
      data: {
        conversationId,
        role: "system",
        content: text,
        blocks: "[]",
        sources: "[]",
        meta: JSON.stringify({ kind: "execution_note", at: new Date().toISOString() }),
      },
    })
    .catch(() => undefined);
}
