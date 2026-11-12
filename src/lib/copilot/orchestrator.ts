// MEIL Intelligence — conversation orchestrator (Phase 16).
//
// Flow per user prompt:
//   persist user message → build provider messages (with bounded history) →
//   provider turn (streamed) ⇄ tool registry (real reads, real timings) →
//   structured blocks accumulate → prepared actions become confirmations →
//   final narrative + follow-ups → persist assistant message → done.
//
// The SSE stream contains only: avatar status, real activity events (tool
// executions with actual timings), text deltas, validated blocks, sources,
// and completion. No chain-of-thought, no fabricated progress.

import { db } from "@/lib/db";
import { randomUUID } from "crypto";
import {
  TOOL_DEFINITIONS,
  TOOL_HANDLERS,
  getToolDefinition,
} from "./tools";
import type { PreparedActionSpec } from "./tools";
import { streamProviderTurn, extractFollowUps, getProviderConfig, ProviderError } from "./gateway";
import type { ProviderMessage } from "./gateway";
import { planOffline, executeOffline } from "./offline";
import { createConfirmation } from "./actions";
import { CopilotError } from "./server";
import { logCopilotAudit } from "./server";
import type {
  ChatStreamEvent,
  ContentBlock,
  ConversationContext,
  CopilotRequestContext,
  SourceReference,
} from "./types";

const MAX_TOOL_ROUNDS = 6;
const HISTORY_TURNS = 12; // provider-side conversation memory (live data is always re-fetched by tools)

interface ToolRunRecord {
  id: string;
  tool: string;
  label: string;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  detail?: string;
  startedAt: string;
  finishedAt?: string;
  error?: string;
}

export interface OrchestratorInput {
  conversationId: string;
  userText: string;
  ctx: CopilotRequestContext;
  reportingYear: string;
}

export function orchestratorSse(input: OrchestratorInput): Response {
  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (evt: ChatStreamEvent) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`));
      };
      heartbeat = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(": ping\n\n"));
      }, 15000);

      const toolRuns: ToolRunRecord[] = [];
      const blocks: ContentBlock[] = [];
      const sources: SourceReference[] = [];
      let text = "";
      try {
        await runConversation(input, send, blocks, sources, toolRuns, (t) => (text = t));
      } catch (e) {
        const isProvider = e instanceof ProviderError;
        send({
          kind: "error",
          message: e instanceof Error ? e.message : "The assistant could not complete this request.",
          code: isProvider ? (e as ProviderError).code : "ORCHESTRATION_FAILED",
        });
        // Persist an honest assistant error message — never a fake success.
        await persistMessage(input.conversationId, {
          role: "assistant",
          content: e instanceof Error ? e.message : "The assistant could not complete this request.",
          blocks: [],
          sources: [],
          meta: { state: "error", error: true },
        }).catch(() => undefined);
        await db.copilotConversation
          .update({ where: { id: input.conversationId }, data: { lastAt: new Date() } })
          .catch(() => undefined);
        send({ kind: "done" });
      } finally {
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        try { controller.close(); } catch { /* already closed */ }
      }
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

/* ── core loop ──────────────────────────────────────────────────────────────── */

async function runConversation(
  input: OrchestratorInput,
  send: (e: ChatStreamEvent) => void,
  blocks: ContentBlock[],
  sources: SourceReference[],
  toolRuns: ToolRunRecord[],
  setText: (t: string) => void
) {
  const { conversationId, userText, ctx, reportingYear } = input;
  const provider = getProviderConfig();

  // 1. Persist the user message.
  await db.copilotMessage.create({
    data: { conversationId, role: "user", content: userText, blocks: "[]", sources: "[]", meta: "{}" },
  });

  // 2. Status: listening → thinking.
  send({ kind: "status", state: "thinking", label: "Understanding your request" });

  // 3. Build provider messages with bounded history.
  const historyRows = await db.copilotMessage.findMany({
    where: { conversationId, role: { in: ["user", "assistant"] } },
    orderBy: { createdAt: "desc" },
    take: HISTORY_TURNS + 1,
  });
  const ordered = historyRows.reverse();
  // The just-persisted user message is the last row — drop it here; it is
  // appended below together with the platform context.
  const prior = ordered.slice(0, -1).slice(-HISTORY_TURNS);
  const contextBlock = conversationContext(await db.copilotConversation.findUnique({ where: { id: conversationId }, select: { context: true } }), reportingYear);
  const messages: ProviderMessage[] = [
    ...prior.map((m) => ({ role: m.role === "user" ? ("user" as const) : ("assistant" as const), text: m.content.slice(0, 4000) })),
    { role: "user", text: `${contextBlock}User request: ${userText}` },
  ];

  // 4. Provider ⇄ tool loop.
  let round = 0;
  let finalText = "";
  let narrative = ""; // every text the user actually saw this turn
  const usedTools = new Set<string>();

  /* ── OFFLINE GROUNDED MODE ────────────────────────────────────────────────
     No AI provider key is configured on this deployment. Rather than failing
     with "provider not configured", the assistant still answers: the intent
     router picks the same real tools, executes them against the database, and
     composes the answer strictly from what those tools returned. */
  if (!provider.configured) {
    const plan = await planOffline(userText, reportingYear);
    const offline = await executeOffline(plan, ctx, (run) => {
      if (run.status === "RUNNING") {
        send({ kind: "activity", id: `offline-${run.name}`, tool: run.name, label: run.label, status: "RUNNING", startedAt: new Date().toISOString() });
        send({ kind: "status", state: "retrieving", label: run.label });
      } else {
        send({
          kind: "activity",
          id: `offline-${run.name}`,
          tool: run.name,
          label: run.label,
          status: run.status,
          detail: run.summary,
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          error: run.error,
        });
        usedTools.add(run.name);
      }
    });

    for (const b of offline.blocks) {
      blocks.push(b);
      send({ kind: "block", block: b });
    }
    for (const s of offline.sources) {
      if (!sources.some((x) => x.id === s.id && x.kind === s.kind)) sources.push(s);
    }
    send({ kind: "sources", sources });

    send({ kind: "status", state: "generating", label: "Composing the answer" });
    send({ kind: "delta", text: offline.text });

    const saved = await persistMessage(conversationId, {
      role: "assistant",
      content: offline.text,
      blocks,
      sources,
      meta: { state: "success", provider: "offline-grounded", model: "grounded-tools", tools: Array.from(usedTools) },
    });
    await db.copilotConversation.update({
      where: { id: conversationId },
      data: { lastAt: new Date(), provider: "offline-grounded", model: "grounded-tools" },
    });
    await logCopilotAudit({
      actorName: ctx.userName,
      actorRole: ctx.userRole,
      action: "CHAT_COMPLETED",
      targetType: "CopilotConversation",
      targetId: conversationId,
      targetLabel: userText.slice(0, 80),
      after: { tools: Array.from(usedTools), blocks: blocks.length, mode: "offline-grounded" },
    });
    send({ kind: "message_done", messageId: saved.id, avatarState: blocks.length ? avatarStateForBlocks(blocks) : "success" });
    send({ kind: "done" });
    return;
  }

  while (round < MAX_TOOL_ROUNDS) {
    round++;
    const pendingCalls: { id: string; name: string; args: Record<string, unknown>; thoughtSignature?: string }[] = [];
    let turnText = "";

    const gen = streamProviderTurn({ messages, tools: TOOL_DEFINITIONS });
    while (true) {
      let chunk;
      try {
        chunk = await gen.next();
      } catch (e) {
        if (e instanceof ProviderError) throw e;
        throw e;
      }
      if (chunk.done) break;
      const c = chunk.value;
      if (c.kind === "text") {
        turnText += c.text;
        narrative += c.text;
        send({ kind: "delta", text: c.text });
      } else if (c.kind === "tool_call") {
        pendingCalls.push({ id: c.call.id, name: c.call.name, args: c.call.args ?? {}, thoughtSignature: c.call.thoughtSignature });
      }
    }

    if (!pendingCalls.length) {
      finalText = turnText;
      break;
    }

    // Echo the assistant turn back with its functionCall parts intact — the
    // provider must see the calls it made (and their thought signatures) or
    // it repeats them. No placeholder text: the model would mimic it.
    messages.push({
      role: "assistant",
      text: turnText || undefined,
      toolCalls: pendingCalls.map((c) => ({
        id: c.id,
        name: c.name,
        args: c.args,
        thoughtSignature: c.thoughtSignature,
      })),
    });
    if (turnText.trim()) setText(narrative);

    // Execute each tool for real, streaming genuine activity events.
    for (const call of pendingCalls) {
      const def = getToolDefinition(call.name);
      const handler = TOOL_HANDLERS[call.name];
      if (!def || !handler) {
        send({ kind: "activity", id: call.id, tool: call.name, label: call.name, status: "FAILED", detail: "Unknown tool", startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), error: "Unknown tool requested by the model" });
        messages.push({ role: "tool", toolName: call.name, toolCallId: call.id, toolResult: JSON.stringify({ error: `Tool ${call.name} is not registered.` }) });
        continue;
      }
      usedTools.add(call.name);
      const runId = randomUUID();
      const startedAt = new Date();
      const startedIso = startedAt.toISOString();
      const startedLabel = TOOL_LABELS[call.name] ?? def.name;
      const toolRun: ToolRunRecord = { id: runId, tool: call.name, label: startedLabel, status: "RUNNING", startedAt: startedIso };
      toolRuns.push(toolRun);
      send({ kind: "activity", id: runId, tool: call.name, label: startedLabel, status: "RUNNING", startedAt: startedIso });
      send({ kind: "status", state: STATUS_FOR_TOOL[call.name] ?? "retrieving", label: startedLabel });

      let result;
      try {
        result = await handler(call.args, ctx);
      } catch (e) {
        const finishedAt = new Date();
        toolRun.status = "FAILED";
        toolRun.error = e instanceof Error ? e.message : "Tool failed";
        toolRun.finishedAt = finishedAt.toISOString();
        await db.copilotToolExecution.create({
          data: {
            conversationId,
            userId: ctx.userId,
            toolName: call.name,
            args: JSON.stringify(sanitizeArgs(call.args)),
            status: "FAILED",
            error: toolRun.error,
            startedAt,
            finishedAt,
            durationMs: finishedAt.getTime() - startedAt.getTime(),
          },
        });
        send({ kind: "activity", id: runId, tool: call.name, label: startedLabel, status: "FAILED", startedAt: startedIso, finishedAt: toolRun.finishedAt, error: toolRun.error });
        messages.push({ role: "tool", toolName: call.name, toolCallId: call.id, toolResult: JSON.stringify({ error: toolRun.error }) });
        continue;
      }

      const finishedAt = new Date();
      toolRun.status = result.error ? "FAILED" : "COMPLETED";
      toolRun.detail = result.summary;
      toolRun.finishedAt = finishedAt.toISOString();
      await db.copilotToolExecution.create({
        data: {
          conversationId,
          userId: ctx.userId,
          toolName: call.name,
          args: JSON.stringify(sanitizeArgs(call.args)),
          status: result.error ? "FAILED" : "COMPLETED",
          resultSummary: result.summary.slice(0, 2000),
          error: result.error ?? "",
          startedAt,
          finishedAt,
          durationMs: finishedAt.getTime() - startedAt.getTime(),
        },
      });
      send({
        kind: "activity",
        id: runId,
        tool: call.name,
        label: startedLabel,
        status: toolRun.status,
        detail: result.summary,
        startedAt: startedIso,
        finishedAt: toolRun.finishedAt,
        error: result.error,
      });

      // Structured blocks & sources stream to the UI as they are produced.
      for (const b of result.blocks ?? []) {
        blocks.push(b);
        send({ kind: "block", block: b });
      }
      for (const s of result.sources ?? []) {
        if (!sources.some((x) => x.id === s.id && x.kind === s.kind)) sources.push(s);
      }

      // Prepared actions → real single-use confirmation rows.
      if (def.riskLevel === "L2" || def.riskLevel === "L3") {
        if (result.error) {
          messages.push({ role: "tool", toolName: call.name, toolCallId: call.id, toolResult: JSON.stringify({ error: result.error }) });
          continue;
        }
        const spec = result.data as PreparedActionSpec | undefined;
        if (!spec || spec.actionName !== call.name) {
          messages.push({ role: "tool", toolName: call.name, toolCallId: call.id, toolResult: JSON.stringify({ error: "Prepared action payload was malformed." }) });
          continue;
        }
        const confirmation = await createConfirmation({
          userId: ctx.userId,
          userName: ctx.userName,
          conversationId,
          spec,
        });
        const confBlock: ContentBlock = {
          type: "confirmation",
          confirmationId: confirmation.id,
          title: spec.title,
          explanation: spec.explanation,
          riskLevel: spec.riskLevel,
          affected: spec.affected,
          recipients: spec.recipients,
          impact: spec.impact,
          params: redactParams(spec.params),
          expiresAt: confirmation.expiresAt.toISOString(),
        };
        blocks.push(confBlock);
        send({ kind: "block", block: confBlock });
        send({ kind: "status", state: "confirmation", label: "Awaiting your confirmation" });
        messages.push({ role: "tool", toolName: call.name, toolCallId: call.id, toolResult: JSON.stringify({ prepared: true, confirmationId: confirmation.id, expiresAt: confirmation.expiresAt.toISOString(), note: "The action will execute only after the user confirms in the UI. Tell the user to confirm or cancel; never claim it has been executed." }) });
        continue;
      }

      // Regular tool: hand the compact JSON payload back to the model.
      messages.push({
        role: "tool",
        toolName: call.name,
        toolCallId: call.id,
        toolResult: JSON.stringify({ summary: result.summary, data: result.data ?? null, error: result.error ?? null }),
      });
    }
  }

  // 5. Final narrative pass (model already streamed most text; finalize).
  send({ kind: "status", state: "generating", label: "Composing the answer" });
  const answerText = narrative.trim() || finalText.trim();
  if (round >= MAX_TOOL_ROUNDS && !answerText) {
    finalText = "I gathered the available records but reached the tool-step limit before completing the analysis. Here is what was retrieved so far.";
    send({ kind: "delta", text: finalText });
  }
  const { clean, questions } = extractFollowUps(answerText || finalText);
  if (questions.length) {
    const fuBlock: ContentBlock = { type: "follow_ups", questions: questions.slice(0, 3) };
    blocks.push(fuBlock);
    send({ kind: "block", block: fuBlock });
  }

  // 6. Sources + persistence.
  send({ kind: "sources", sources });
  const saved = await persistMessage(conversationId, {
    role: "assistant",
    content: clean || answerText || finalText,
    blocks,
    sources,
    meta: {
      state: "success",
      model: provider.model,
      provider: provider.id,
      tools: Array.from(usedTools),
    },
  });
  await db.copilotConversation.update({ where: { id: conversationId }, data: { lastAt: new Date(), provider: provider.id, model: provider.model } });

  await logCopilotAudit({
    actorName: ctx.userName,
    actorRole: ctx.userRole,
    action: "CHAT_COMPLETED",
    targetType: "CopilotConversation",
    targetId: conversationId,
    targetLabel: userText.slice(0, 80),
    after: { tools: Array.from(usedTools), blocks: blocks.length },
  });

  send({ kind: "message_done", messageId: saved.id, avatarState: blocks.length ? avatarStateForBlocks(blocks) : "success" });
  send({ kind: "done" });
}

/* ── helpers ────────────────────────────────────────────────────────────────── */

function conversationContext(conv: { context: string } | null, reportingYear: string): string {
  const parsed = parseContext(conv?.context);
  return `[Platform context — active period: ${parsed.reportingYear ?? reportingYear}; view: ${parsed.viewId ?? "group workspace"}; scope: ${parsed.orgScope ?? "GROUP"}. Today: ${new Date().toISOString().slice(0, 10)}.]\n\n`;
}

function parseContext(raw: string | undefined | null): ConversationContext {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as ConversationContext;
  } catch {
    return {};
  }
}

async function persistMessage(
  conversationId: string,
  m: { role: "user" | "assistant"; content: string; blocks: ContentBlock[]; sources: SourceReference[]; meta?: Record<string, unknown> }
) {
  return db.copilotMessage.create({
    data: {
      conversationId,
      role: m.role,
      content: m.content,
      blocks: JSON.stringify(m.blocks),
      sources: JSON.stringify(m.sources),
      meta: JSON.stringify(m.meta ?? {}),
    },
  });
}

function sanitizeArgs(args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean" || v === null) out[k] = v;
    else if (Array.isArray(v)) out[k] = v.map((x) => (typeof x === "string" || typeof x === "number" ? x : String(x)));
    else out[k] = "[object]";
  }
  return out;
}

/** Params shown in the confirmation dialog — nothing sensitive is in these. */
function redactParams(params: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (/secret|password|token|key/i.test(k)) out[k] = "[redacted]";
    else out[k] = v;
  }
  return out;
}

function avatarStateForBlocks(blocks: ContentBlock[]): "success" | "excited" | "warning" | "confirmation" {
  if (blocks.some((b) => b.type === "confirmation")) return "confirmation";
  if (blocks.some((b) => b.type === "recommendation")) return "excited";
  return "success";
}

const TOOL_LABELS: Record<string, string> = {
  resolve_entity: "Resolving entity",
  get_subsidiary_profile: "Retrieving subsidiary profile",
  get_business_unit_profile: "Retrieving business unit profile",
  get_project_profile: "Retrieving project profile",
  get_user_profile: "Retrieving user profile",
  get_submissions: "Retrieving submissions",
  get_submission_details: "Retrieving submission details",
  get_approval_history: "Retrieving approval history",
  search_evidence: "Searching evidence",
  get_missing_evidence: "Checking missing evidence",
  get_group_performance: "Calculating group performance",
  compare_entities: "Comparing entities",
  get_reporting_completion: "Calculating reporting completion",
  get_deadline_summary: "Summarizing deadlines",
  get_brsr_completeness: "Checking BRSR completeness",
  get_compliance_summary: "Summarizing compliance findings",
  get_recent_activity: "Retrieving activity log",
  prepare_reminder: "Preparing reminder",
  prepare_deadline_change: "Preparing deadline change",
  create_follow_up_task: "Preparing follow-up task",
};

const STATUS_FOR_TOOL: Record<string, "searching" | "retrieving" | "analyzing" | "confirmation"> = {
  search_evidence: "searching",
  get_group_performance: "analyzing",
  compare_entities: "analyzing",
  get_reporting_completion: "analyzing",
  get_brsr_completeness: "analyzing",
  get_compliance_summary: "analyzing",
  prepare_reminder: "confirmation",
  prepare_deadline_change: "confirmation",
  create_follow_up_task: "confirmation",
};
