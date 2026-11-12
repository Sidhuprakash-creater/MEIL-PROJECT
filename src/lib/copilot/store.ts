"use client";

// MEIL Intelligence — client state (zustand). One store shared by the
// full-screen workspace and the floating panel: same conversation, same
// messages, same streaming state. Switching surfaces never forks state.

import { create } from "zustand";
import type { ChatStreamEvent, ContentBlock, ConversationSummary, SourceReference, AvatarState } from "./types";
import { copilotApi, type CopilotExecutionRecord } from "./client";

export interface UiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  blocks: ContentBlock[];
  sources: SourceReference[];
  createdAt: string;
  streaming?: boolean;
  error?: boolean;
}

export interface ActivityItem {
  id: string;
  tool: string;
  label: string;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  detail?: string;
  startedAt: string;
  finishedAt?: string;
  error?: string;
}

export type CopilotTheme = "light" | "dark";

const COPILOT_THEME_KEY = "meil-copilot-theme";

interface CopilotState {
  open: boolean; // floating panel visible
  fullscreen: boolean;
  theme: CopilotTheme;
  view: "landing" | "conversation";
  conversationId: string | null;
  conversations: ConversationSummary[];
  messages: UiMessage[];
  activity: ActivityItem[];
  executions: CopilotExecutionRecord[];
  avatarState: AvatarState;
  statusLabel: string;
  streaming: boolean;
  suggestions: { label: string; prompt: string }[];
  providerConfigured: boolean;
  provider: string;
  reportingYear: string; // mirrored from the workspace store during bootstrap; blocks read it without importing the esg store
  loadingHistory: boolean;
  error: string | null;
  /** Epoch-ms until which the provider cooldown blocks new questions (null = free). */
  rateLimitUntil: number | null;

  setOpen: (open: boolean) => void;
  setFullscreen: (f: boolean) => void;
  setTheme: (theme: CopilotTheme) => void;
  toggleTheme: () => void;
  hydrateTheme: () => void;
  resetError: () => void;

  bootstrap: (reportingYear: string) => Promise<void>;
  loadSuggestions: (reportingYear: string) => Promise<void>;
  openConversation: (id: string) => Promise<void>;
  newConversation: (reportingYear: string) => Promise<string | null>;
  renameConversation: (id: string, title: string) => Promise<void>;
  togglePin: (id: string, pinned: boolean) => Promise<void>;
  archiveConversation: (id: string) => Promise<void>;

  sendMessage: (text: string, reportingYear: string, viewId?: string) => void;
  stopStreaming: () => void;
  resolveConfirmation: (confirmationId: string, decision: "confirm" | "cancel") => Promise<{ status: string; resultSummary?: string }>;
  setView: (view: "landing" | "conversation") => void;
}

let activeStream: { cancel: () => void } | null = null;

export const useCopilot = create<CopilotState>((set, get) => ({
  open: false,
  fullscreen: false,
  theme: "light",
  view: "landing",
  conversationId: null,
  conversations: [],
  messages: [],
  activity: [],
  executions: [],
  avatarState: "idle",
  statusLabel: "",
  streaming: false,
  suggestions: [],
  providerConfigured: true,
  provider: "gemini",
  reportingYear: "FY 2025-26",
  loadingHistory: false,
  error: null,
  rateLimitUntil: null,

  setOpen: (open) => set({ open }),
  setFullscreen: (fullscreen) => set({ fullscreen, open: fullscreen ? true : get().open }),
  setTheme: (theme) => {
    set({ theme });
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(COPILOT_THEME_KEY, theme);
      } catch {
        /* ignore storage failures */
      }
    }
  },
  toggleTheme: () => {
    get().setTheme(get().theme === "dark" ? "light" : "dark");
  },
  hydrateTheme: () => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem(COPILOT_THEME_KEY);
      if (saved === "light" || saved === "dark") {
        set({ theme: saved });
      } else if (document.documentElement.classList.contains("dark")) {
        set({ theme: "dark" });
      }
    } catch {
      /* ignore storage failures */
    }
  },
  resetError: () => set({ error: null }),
  setView: (view) => set({ view }),

  async bootstrap(reportingYear) {
    try {
      const [conversations, sugg] = await Promise.all([
        copilotApi.listConversations(),
        copilotApi.suggestions(reportingYear),
      ]);
      set({
        conversations,
        suggestions: sugg.suggestions,
        providerConfigured: sugg.context.configured,
        provider: sugg.context.provider,
        reportingYear,
      });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Failed to load MEIL Intelligence." });
    }
  },

  async loadSuggestions(reportingYear) {
    try {
      const sugg = await copilotApi.suggestions(reportingYear);
      set({ suggestions: sugg.suggestions, providerConfigured: sugg.context.configured, provider: sugg.context.provider, reportingYear });
    } catch {
      /* suggestions are best-effort */
    }
  },

  async openConversation(id) {
    set({ loadingHistory: true, error: null });
    try {
      const d = await copilotApi.getConversation(id);
      const messages: UiMessage[] = d.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        blocks: m.blocks,
        sources: m.sources,
        createdAt: m.createdAt,
        error: (m.meta as { error?: boolean } | undefined)?.error === true,
      }));
      set({
        conversationId: id,
        messages,
        executions: d.executions,
        activity: d.executions.slice(-12).map((e) => ({
          id: e.id,
          tool: e.tool,
          label: e.summary || e.tool,
          status: e.status === "FAILED" ? "FAILED" : "COMPLETED",
          detail: e.summary,
          startedAt: e.startedAt,
          finishedAt: e.finishedAt ?? undefined,
          error: e.error ?? undefined,
        })),
        view: messages.length ? "conversation" : "landing",
        error: null,
      });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Failed to open conversation." });
    } finally {
      set({ loadingHistory: false });
    }
  },

  async newConversation(reportingYear) {
    try {
      const conv = await copilotApi.createConversation({ reportingYear, viewId: "intelligence" });
      set((s) => ({
        conversations: [conv, ...s.conversations],
        conversationId: conv.id,
        messages: [],
        activity: [],
        executions: [],
        view: "landing",
        error: null,
      }));
      return conv.id;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Failed to start a conversation." });
      return null;
    }
  },

  async renameConversation(id, title) {
    await copilotApi.renameConversation(id, title);
    set((s) => ({ conversations: s.conversations.map((c) => (c.id === id ? { ...c, title } : c)) }));
  },

  async togglePin(id, pinned) {
    await copilotApi.pinConversation(id, pinned);
    set((s) => ({
      conversations: s.conversations
        .map((c) => (c.id === id ? { ...c, pinned } : c))
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.lastAt.localeCompare(a.lastAt)),
    }));
  },

  async archiveConversation(id) {
    await copilotApi.archiveConversation(id);
    set((s) => ({
      conversations: s.conversations.filter((c) => c.id !== id),
      conversationId: s.conversationId === id ? null : s.conversationId,
      messages: s.conversationId === id ? [] : s.messages,
      view: s.conversationId === id ? "landing" : s.view,
    }));
  },

  sendMessage(text, reportingYear, viewId) {
    const trimmed = text.trim();
    if (!trimmed || get().streaming) return;
    const convId = get().conversationId;
    if (!convId) {
      set({ error: "Start a conversation first." });
      return;
    }
    // No client-side cooldown — the provider is never artificially locked out.
    const until = get().rateLimitUntil;
    if (until && until > Date.now()) {
      set({ error: `Rate limit active — next request available in ${Math.ceil((until - Date.now()) / 1000)}s.` });
      return;
    }
    const userMsg: UiMessage = {
      id: `local-u-${Date.now()}`,
      role: "user",
      content: trimmed,
      blocks: [],
      sources: [],
      createdAt: new Date().toISOString(),
    };
    const assistantMsg: UiMessage = {
      id: `local-a-${Date.now()}`,
      role: "assistant",
      content: "",
      blocks: [],
      sources: [],
      createdAt: new Date().toISOString(),
      streaming: true,
    };
    set((s) => ({
      messages: [...s.messages, userMsg, assistantMsg],
      streaming: true,
      view: "conversation",
      avatarState: "listening",
      statusLabel: "Listening",
      activity: [],
      /* No proactive cooldown — the assistant stays usable for back-to-back
         questions. A real provider 429 still surfaces as an error below. */
      rateLimitUntil: null,
      error: null,
    }));

    const patchAssistant = (patch: (m: UiMessage) => UiMessage) =>
      set((s) => {
        const msgs = [...s.messages];
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i].id === assistantMsg.id) {
            msgs[i] = patch(msgs[i]);
            break;
          }
        }
        return { messages: msgs };
      });

    const sse = copilotApi.streamChat(
      { conversationId: convId, message: trimmed, reportingYear, viewId },
      (e: ChatStreamEvent) => {
        switch (e.kind) {
          case "status":
            set({ avatarState: e.state, statusLabel: e.label });
            break;
          case "activity": {
            const item: ActivityItem = {
              id: e.id,
              tool: e.tool,
              label: e.label,
              status: e.status,
              detail: e.detail,
              startedAt: e.startedAt,
              finishedAt: e.finishedAt,
              error: e.error,
            };
            set((s) => ({
              activity: [...s.activity.filter((a) => a.id !== e.id), item],
            }));
            break;
          }
          case "delta":
            patchAssistant((m) => ({ ...m, content: m.content + e.text }));
            break;
          case "block":
            patchAssistant((m) => ({ ...m, blocks: [...m.blocks, e.block] }));
            break;
          case "sources":
            patchAssistant((m) => ({ ...m, sources: e.sources }));
            break;
          case "message_done":
            patchAssistant((m) => ({ ...m, id: e.messageId, streaming: false }));
            set({ avatarState: e.avatarState, statusLabel: "", streaming: false });
            void get().loadSuggestions(reportingYear);
            break;
          case "error":
            patchAssistant((m) => ({ ...m, content: m.content || e.message, streaming: false, error: true }));
            if (e.code === "RATE_LIMITED" && typeof e.retryAfter === "number" && e.retryAfter > 0) {
              /* The provider genuinely throttled this request — show what to
                 do, but never lock the composer: the user can retry. */
              set((s) => ({
                messages: s.messages.filter((m) => m.id !== assistantMsg.id),
                streaming: false,
                avatarState: "idle",
                statusLabel: "",
                error: `The AI provider is busy right now — it asked us to retry in ${e.retryAfter}s. Your question was not lost; press send again in a moment.`,
                rateLimitUntil: null,
              }));
            } else {
              set({ avatarState: "error", statusLabel: "", streaming: false, error: e.message });
            }
            break;
          case "done":
            set((s) => ({ streaming: false }));
            patchAssistant((m) => ({ ...m, streaming: false }));
            if (get().avatarState === "listening" || get().avatarState === "thinking") {
              set({ avatarState: "idle", statusLabel: "" });
            }
            activeStream = null;
            break;
        }
      }
    );
    activeStream = sse;
  },

  stopStreaming() {
    activeStream?.cancel();
    activeStream = null;
    set((s) => ({
      streaming: false,
      avatarState: "cancelled",
      statusLabel: "",
      messages: s.messages.map((m) => (m.streaming ? { ...m, streaming: false } : m)),
    }));
  },

  async resolveConfirmation(confirmationId, decision) {
    try {
      const res = await copilotApi.confirmAction(confirmationId, decision);
      set({ avatarState: decision === "confirm" ? "success" : "cancelled" });
      return res;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Confirmation failed.";
      set({ avatarState: "error", error: message });
      return { status: "FAILED", resultSummary: message };
    }
  },
}));
