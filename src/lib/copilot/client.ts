"use client";

// MEIL Intelligence — client API (fetch + SSE reader), shared by the
// full-screen workspace and the floating assistant so both surfaces always
// operate on the same conversation state.

import type { ChatStreamEvent, ConversationSummary, StoredMessage } from "./types";

export interface CopilotExecutionRecord {
  id: string;
  tool: string;
  status: string;
  summary: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  error: string | null;
}

export class CopilotApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { cache: "no-store", ...init });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok) {
    const err = (data ?? {}) as { error?: string; code?: string };
    throw new CopilotApiError(err.error ?? `Request failed (${res.status})`, res.status, err.code);
  }
  return data as T;
}

export interface ExplorerOption {
  value: string;
  label: string;
  status?: string;
  subsidiaryId?: string;
  businessUnitId?: string;
  ptype?: string;
}

export interface ExplorerResults {
  columns: { key: string; label: string; align?: "left" | "right" | "center" }[];
  rows: { id: string; cells: Record<string, string | number>; nav?: { view: string; detailId?: string }; meta?: Record<string, unknown> }[];
  total: number;
  offset: number;
  comparison?: { entityLabels: string[]; metrics: { label: string; values: number[] }[] };
  meta?: Record<string, unknown>;
}

export interface Suggestion {
  label: string;
  prompt: string;
}

export const copilotApi = {
  async listConversations(): Promise<ConversationSummary[]> {
    const d = await request<{ conversations: ConversationSummary[] }>("/api/copilot/conversations");
    return d.conversations;
  },
  async createConversation(context?: Record<string, unknown>): Promise<ConversationSummary> {
    const d = await request<{ conversation: ConversationSummary }>("/api/copilot/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context }),
    });
    return d.conversation;
  },
  async getConversation(id: string): Promise<{ conversation: ConversationSummary; messages: StoredMessage[]; executions: CopilotExecutionRecord[] }> {
    return request(`/api/copilot/conversations/${id}`);
  },
  async renameConversation(id: string, title: string): Promise<void> {
    await request(`/api/copilot/conversations/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
  },
  async pinConversation(id: string, pinned: boolean): Promise<void> {
    await request(`/api/copilot/conversations/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pinned }) });
  },
  async archiveConversation(id: string): Promise<void> {
    await request(`/api/copilot/conversations/${id}`, { method: "DELETE" });
  },
  async suggestions(period: string): Promise<{ suggestions: Suggestion[]; context: { configured: boolean; provider: string; model?: string; activeSubsidiaries: number } }> {
    return request(`/api/copilot/suggestions?period=${encodeURIComponent(period)}`);
  },
  async cascade(category: string, scope: { subsidiaryId?: string; businessUnitId?: string }): Promise<{ options: ExplorerOption[] }> {
    const params = new URLSearchParams({ mode: "cascade", category });
    if (scope.subsidiaryId) params.set("subsidiaryId", scope.subsidiaryId);
    if (scope.businessUnitId) params.set("businessUnitId", scope.businessUnitId);
    return request(`/api/copilot/explorer?${params.toString()}`);
  },
  async explorerResults(category: string, filters: Record<string, string | number | undefined>): Promise<ExplorerResults> {
    const params = new URLSearchParams({ mode: "results", category });
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== "") params.set(k, String(v));
    }
    return request(`/api/copilot/explorer?${params.toString()}`);
  },
  async confirmAction(confirmationId: string, decision: "confirm" | "cancel"): Promise<{ status: string; resultSummary?: string }> {
    return request("/api/copilot/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmationId, decision }),
    });
  },
  async listSaved(): Promise<{ id: string; kind: string; title: string; body: string; pinned: boolean; createdAt: string }[]> {
    const d = await request<{ items: { id: string; kind: string; title: string; body: string; pinned: boolean; createdAt: string }[] }>("/api/copilot/saved");
    return d.items;
  },
  async saveItem(input: { kind: string; title: string; body?: string; conversationId?: string; payload?: unknown }): Promise<void> {
    await request("/api/copilot/saved", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  },
  async deleteSaved(id: string): Promise<void> {
    await request(`/api/copilot/saved?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  /**
   * Stream one copilot turn via SSE. Returns a cancel function; onEvent is
   * called for every parsed envelope. Network failures surface as error events.
   */
  streamChat(
    input: { conversationId: string; message: string; reportingYear: string; viewId?: string },
    onEvent: (e: ChatStreamEvent) => void
  ): { cancel: () => void } {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/copilot/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          let msg = `Copilot request failed (${res.status})`;
          let code: string | undefined;
          let retryAfter: number | undefined;
          try {
            const j = await res.json();
            msg = j.error ?? msg;
            code = j.code;
            retryAfter = typeof j.retryAfter === "number" ? j.retryAfter : undefined;
          } catch { /* keep default */ }
          onEvent({ kind: "error", message: msg, code, retryAfter });
          onEvent({ kind: "done" });
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          // Tolerant separator: servers may use "\n\n" or "\r\n\r\n".
          const frames = buffer.split(/\r?\n\r?\n/);
          buffer = frames.pop() ?? "";
          for (const frame of frames) {
            for (const line of frame.split(/\r?\n/)) {
              if (!line.startsWith("data:")) continue;
              const payload = line.slice(5).trim();
              if (!payload) continue;
              try {
                onEvent(JSON.parse(payload) as ChatStreamEvent);
              } catch {
                /* skip malformed frame */
              }
            }
          }
        }
        onEvent({ kind: "done" });
      } catch (e) {
        if ((e as Error)?.name !== "AbortError") {
          onEvent({ kind: "error", message: e instanceof Error ? e.message : "Network error while streaming the answer." });
          onEvent({ kind: "done" });
        }
      }
    })();
    return { cancel: () => controller.abort() };
  },
};
