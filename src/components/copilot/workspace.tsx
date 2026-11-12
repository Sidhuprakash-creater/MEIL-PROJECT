"use client";

// MEIL Intelligence — copilot workspace (Phases 6–8, 10–12).
// One component renders both surfaces: the full-screen "Intelligence" view in
// the Group Admin workspace and the floating assistant panel. Both share the
// same zustand store, theme, conversation, activity, and avatar state.

import * as React from "react";
import {
  Plus, PanelRightOpen, Maximize2, Minimize2, X, Compass, MessagesSquare,
  Square, Pin, PinOff, Archive, Pencil, Check, Activity, Sparkles, ShieldCheck,
  Sun, Moon, ArrowUpIcon,
} from "lucide-react";
import { useCopilot } from "@/lib/copilot/store";
import { BlockRenderer, MessageActions } from "@/components/copilot/blocks";
import { MEILAvatar } from "@/components/copilot/avatar/meil-avatar";
import { CopilotExplorer } from "@/components/copilot/explorer";
import {
  Chat,
  ChatViewport,
  ChatMessages,
  ChatMessageRow,
  ChatMessageBubble,
  ChatMessageAddon,
  ChatMessageTime,
  ChatInputArea,
  ChatInputField,
  ChatInputSubmit,
  type ChatSubmitEvent,
} from "@/components/ui/chat";
import { BorderBeam } from "@/components/ui/border-beam";
import type { AvatarState } from "@/lib/copilot/types";

export type CopilotVariant = "fullscreen" | "panel";

const STATUS_DOT_CLASS: Partial<Record<AvatarState, string>> = { error: "error" };

function toSafeDate(value?: string): Date {
  if (!value) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

/* ───────────────────────────── Header ───────────────────────────── */

function CopilotHeader({
  variant, tab, setTab, sideOpen, toggleSide,
}: {
  variant: CopilotVariant;
  tab: "chat" | "explorer";
  setTab: (t: "chat" | "explorer") => void;
  sideOpen: boolean;
  toggleSide: () => void;
}) {
  const {
    avatarState, statusLabel, streaming, fullscreen, setFullscreen, setOpen,
    theme, toggleTheme,
  } = useCopilot();
  const dot = streaming ? "busy" : STATUS_DOT_CLASS[avatarState] ?? "";
  const fullStatus = streaming ? (statusLabel || "Working") : "Ready";
  const compactStatus = streaming ? "Thinking…" : "Ready";

  return (
    <div className="mc-header">
      <MEILAvatar
        state={avatarState === "idle" ? "excited" : avatarState}
        size={variant === "panel" ? 34 : 42}
        label="MEIL Intelligence avatar"
      />
      <div className="mc-identity">
        <span className="mc-identity-name">MEIL Intelligence</span>
        <span className="mc-identity-sub">
          {variant === "panel" ? "ESG & BRSR Copilot" : "Enterprise AI copilot · Group Admin"}
        </span>
      </div>
      <div className="mc-header-actions">
        <span className="mc-status-chip" title={fullStatus}>
          <span className={`mc-status-dot ${dot}`} />
          <span className="mc-status-text">{variant === "panel" ? compactStatus : fullStatus}</span>
        </span>
        <button
          className="mc-icon-btn"
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          onClick={toggleTheme}
        >
          {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </button>
        <button
          className={`mc-icon-btn mc-side-toggle ${sideOpen ? "active" : ""}`}
          aria-label="Conversations & activity"
          title="Conversations & activity"
          onClick={toggleSide}
        >
          <PanelRightOpen size={14} />
        </button>
        <button
          className={`mc-icon-btn ${tab === "explorer" ? "active" : ""}`}
          aria-label={tab === "explorer" ? "Back to chat" : "Open Smart Explorer"}
          title={tab === "explorer" ? "Back to chat" : "Smart Explorer — browse real platform data"}
          onClick={() => setTab(tab === "explorer" ? "chat" : "explorer")}
        >
          {tab === "explorer" ? <MessagesSquare size={14} /> : <Compass size={14} />}
        </button>
        <button
          className="mc-icon-btn"
          aria-label="New conversation"
          title="New conversation"
          onClick={() => void handleNewConversation()}
        >
          <Plus size={14} />
        </button>
        {variant === "fullscreen" ? (
          <button
            className="mc-icon-btn"
            aria-label={fullscreen ? "Exit full screen" : "Full screen"}
            title={fullscreen ? "Exit full screen" : "Full screen"}
            onClick={() => setFullscreen(!fullscreen)}
          >
            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        ) : (
          <>
            <button
              className={`mc-icon-btn ${fullscreen ? "active" : ""}`}
              aria-label={fullscreen ? "Back to panel" : "Expand to full view"}
              title={fullscreen ? "Back to panel" : "Expand to full view"}
              onClick={() => setFullscreen(true)}
            >
              <Maximize2 size={14} />
            </button>
            <button className="mc-icon-btn" aria-label="Close assistant" title="Close" onClick={() => setOpen(false)}>
              <X size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

async function handleNewConversation() {
  const s = useCopilot.getState();
  if (s.streaming) s.stopStreaming();
  await s.newConversation(s.reportingYear);
  useCopilot.getState().setView("landing");
}

/* ───────────────────────────── Sidebar ───────────────────────────── */

function ConversationList({ onSelect }: { onSelect?: () => void }) {
  const {
    conversations, conversationId, openConversation, renameConversation, togglePin,
    archiveConversation, streaming,
  } = useCopilot();
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");

  const commitRename = async (id: string) => {
    const title = draft.trim();
    setEditingId(null);
    if (!title) return;
    try {
      await renameConversation(id, title);
    } catch {
      /* failures surface through the store error banner */
    }
  };

  return (
    <>
      <div className="mc-side-section-title">Conversations</div>
      <div className="mc-side-scroll">
        {conversations.length === 0 ? (
          <div style={{ fontSize: 11.5, color: "var(--mc-muted)", padding: "4px 8px 10px" }}>
            No conversations yet — ask your first question.
          </div>
        ) : null}
        {conversations.map((c) => (
          <div key={c.id} className={`mc-conv-item ${c.id === conversationId ? "active" : ""}`}>
            {editingId === c.id ? (
              <>
                <input
                  autoFocus
                  className="mc-conv-title"
                  style={{ background: "transparent", border: "none", outline: "none", font: "inherit", color: "inherit" }}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void commitRename(c.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  onBlur={() => void commitRename(c.id)}
                />
                <span className="mc-conv-actions" style={{ opacity: 1 }}>
                  <button
                    className="mc-icon-btn" style={{ width: 26, height: 26, borderRadius: 8 }}
                    aria-label="Save title"
                    onMouseDown={(e) => { e.preventDefault(); void commitRename(c.id); }}
                  >
                    <Check size={13} />
                  </button>
                </span>
              </>
            ) : (
              <>
                <button
                  className="mc-conv-title"
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "inherit", font: "inherit", textAlign: "left" }}
                  onClick={() => {
                    if (!streaming) {
                      void openConversation(c.id);
                      onSelect?.();
                    }
                  }}
                  title={c.title}
                >
                  {c.pinned ? "📌 " : ""}{c.title}
                </button>
                <span className="mc-conv-actions">
                  <button
                    className="mc-icon-btn" style={{ width: 26, height: 26, borderRadius: 8 }}
                    aria-label={c.pinned ? "Unpin conversation" : "Pin conversation"}
                    onClick={() => void togglePin(c.id, !c.pinned).catch(() => undefined)}
                  >
                    {c.pinned ? <PinOff size={12} /> : <Pin size={12} />}
                  </button>
                  <button
                    className="mc-icon-btn" style={{ width: 26, height: 26, borderRadius: 8 }}
                    aria-label="Rename conversation"
                    onClick={() => { setEditingId(c.id); setDraft(c.title); }}
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    className="mc-icon-btn" style={{ width: 26, height: 26, borderRadius: 8 }}
                    aria-label="Archive conversation"
                    onClick={() => void archiveConversation(c.id).catch(() => undefined)}
                  >
                    <Archive size={12} />
                  </button>
                </span>
              </>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function ActivityPanel() {
  const { activity, executions } = useCopilot();
  const [open, setOpen] = React.useState(false);

  const items = activity.length ? activity : executions.slice(-12).map((e) => ({
    id: e.id,
    tool: e.tool,
    label: e.summary || e.tool,
    status: (e.status === "FAILED" ? "FAILED" : "COMPLETED") as "FAILED" | "COMPLETED",
    detail: e.summary,
    startedAt: e.startedAt,
    finishedAt: e.finishedAt ?? undefined,
    error: e.error ?? undefined,
  }));

  return (
    <div style={{ marginTop: "auto" }}>
      <button className="mc-activity-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Activity size={13} />
        Activity &amp; Execution
        <span style={{ marginLeft: "auto", fontSize: 10, opacity: 0.8 }}>{items.length}</span>
      </button>
      {open ? (
        <div className="mc-activity-panel">
          {items.length === 0 ? (
            <div style={{ fontSize: 11, color: "var(--mc-muted)", padding: "6px 8px" }}>
              Tool executions from the current conversation appear here.
            </div>
          ) : (
            items.map((a) => (
              <div className="mc-exec-item" key={a.id}>
                <span className={`mc-exec-status ${a.status}`} />
                <div style={{ minWidth: 0 }}>
                  <div className="mc-exec-label">{a.label}</div>
                  {a.detail ? <div className="mc-exec-detail">{a.detail}</div> : null}
                  {a.error ? <div className="mc-exec-detail" style={{ color: "var(--mc-danger)" }}>{a.error}</div> : null}
                </div>
                {a.finishedAt ? <span className="mc-exec-time">{new Date(a.finishedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span> : null}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function CopilotSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {open && <div className="mc-side-backdrop" onClick={onClose} aria-hidden="true" />}
      <aside className={`mc-side ${open ? "open" : ""}`} aria-label="Assistant history and activity">
        <ConversationList onSelect={onClose} />
        <ActivityPanel />
      </aside>
    </>
  );
}

/* ───────────────────────────── Landing ───────────────────────────── */

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function Landing({ variant, onAsk }: { variant: CopilotVariant; onAsk: (prompt: string) => void }) {
  const { suggestions, loadingHistory } = useCopilot();

  return (
    <div className="mc-landing">
      <div className="mc-landing-hero">
        <MEILAvatar state="excited" size={variant === "panel" ? 84 : 112} label="MEIL Intelligence" />
        <h1 className="mc-landing-title">Hello, I&apos;m MEIL Intelligence.</h1>
        <div className="mc-landing-sub">{greeting()} — I answer from your live platform records, never from memory alone.</div>
        <div className="mc-landing-hello">
          <Sparkles size={12} style={{ verticalAlign: "-1px" }} /> Grounded in real ESG, BRSR &amp; workflow data
        </div>
      </div>
      <div className="mc-suggestions">
        {loadingHistory && suggestions.length === 0
          ? null
          : suggestions.map((s, i) => (
            <button key={i} className={`mc-suggestion-card ${i % 3 === 1 ? "purple" : ""}`} onClick={() => onAsk(s.prompt)}>
              <Sparkles size={15} />
              <span>
                <strong style={{ display: "block", fontSize: 12.5, marginBottom: 2 }}>{s.label}</strong>
                <span style={{ color: "var(--mc-muted)", fontSize: 11.5 }}>{s.prompt}</span>
              </span>
            </button>
          ))}
      </div>
    </div>
  );
}

/* ───────────────────────────── Conversation stream ───────────────────────────── */

function SourcePills({ sources }: { sources: { id: string; label: string; kind?: string }[] }) {
  if (!sources?.length) return null;
  return (
    <div className="mc-sources">
      {sources.slice(0, 6).map((s, i) => (
        <span className="mc-source-pill" key={s.id ?? i} title={s.label}>
          <ShieldCheck size={10} /> {s.label}
        </span>
      ))}
    </div>
  );
}

function MessageList() {
  const { messages, streaming } = useCopilot();

  if (!streaming && messages.length === 0) {
    return (
      <div className="text-muted-foreground py-12 text-center text-xs">
        Ask a question to begin.
      </div>
    );
  }

  return (
    <ChatMessages className="w-full py-2">
      {messages.map((m) => {
        const ts = toSafeDate(m.createdAt);

        if (m.role === "user") {
          return (
            <ChatMessageRow key={m.id} variant="self" className="my-3.5">
              <ChatMessageBubble className="mc-bubble-self rounded-xl px-4 py-2 text-[13.5px] leading-relaxed">
                {m.content}
              </ChatMessageBubble>
              <ChatMessageTime dateTime={ts} className="mc-msg-time mt-1.5 text-[11px]" />
            </ChatMessageRow>
          );
        }

        const hasBubbleContent = Boolean(m.content) || Boolean(m.streaming);
        const hasExtras =
          m.blocks.length > 0 ||
          (!m.streaming && !m.error && Boolean(m.content)) ||
          (m.sources?.length ?? 0) > 0 ||
          Boolean(m.error);

        return (
          <ChatMessageRow key={m.id} variant="peer" className="mc-peer-row my-4 items-start">
            <div className="mc-msg-avatar mr-2.5 self-start pt-0.5 [grid-area:avatar]">
              <MEILAvatar state={m.streaming ? "thinking" : "idle"} size={32} />
            </div>

            {hasBubbleContent ? (
              <ChatMessageBubble
                className={`mc-bubble-peer rounded-xl px-4 py-2.5 text-[13.5px] leading-relaxed ${
                  !m.content && m.streaming ? "text-muted-foreground" : ""
                }`}
              >
                {m.content || "Thinking"}
                {m.streaming ? <span className="mc-streaming-caret" /> : null}
              </ChatMessageBubble>
            ) : m.blocks.length > 0 ? (
              <div className="min-w-0 w-full [grid-area:message]">
                {m.blocks.map((b, i) => (
                  <BlockRenderer block={b} key={i} />
                ))}
              </div>
            ) : null}

            {hasExtras || hasBubbleContent ? (
              <ChatMessageAddon
                align="block"
                className="mt-1.5 flex w-full min-w-0 flex-col items-start gap-2"
              >
                {hasBubbleContent && m.blocks.length > 0 ? (
                  <div className="w-full min-w-0">
                    {m.blocks.map((b, i) => (
                      <BlockRenderer block={b} key={i} />
                    ))}
                  </div>
                ) : null}
                {!m.streaming && !m.error && m.content ? (
                  <MessageActions content={m.content} />
                ) : null}
                <SourcePills sources={m.sources} />
                {m.error ? (
                  <div className="mc-msg-error-note">
                    This reply failed. Check your connection or the provider configuration, then try again.
                  </div>
                ) : null}
                <ChatMessageTime dateTime={ts} className="mc-msg-time text-[11px]" />
              </ChatMessageAddon>
            ) : (
              <ChatMessageTime dateTime={ts} className="mc-msg-time mt-1.5 text-[11px]" />
            )}
          </ChatMessageRow>
        );
      })}
    </ChatMessages>
  );
}

/* ───────────────────────────── Composer ───────────────────────────── */

/* The provider cooldown was removed: the assistant stays fully usable for
   back-to-back questions. The RateLimitBanner component is kept for the
   (rare) case where the provider itself reports a hard throttle, but it is
   driven by a real server signal rather than a local timer. */
function useRateLimitSeconds(): number {
  const rateLimitUntil = useCopilot((s) => s.rateLimitUntil);
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!rateLimitUntil || rateLimitUntil <= Date.now()) return;
    const t = window.setInterval(() => {
      setNow(Date.now());
      if (rateLimitUntil <= Date.now()) window.clearInterval(t);
    }, 1000);
    return () => window.clearInterval(t);
  }, [rateLimitUntil]);
  if (!rateLimitUntil) return 0;
  return Math.max(0, Math.ceil((rateLimitUntil - now) / 1000));
}

/** Premium countdown banner — warns the user while the Groq one-per-minute
 *  window cools down. Auto-disappears when the countdown reaches zero. */
function RateLimitBanner({ seconds }: { seconds: number }) {
  if (seconds <= 0) return null;
  const pct = Math.min(Math.max((60 - seconds) / 60, 0.02), 1);
  return (
    <div
      className="mc-rate-banner"
      role="status"
      aria-live="polite"
      style={{
        marginBottom: 8,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        borderRadius: 14,
        border: "1px solid rgba(217, 119, 6, 0.28)",
        background: "linear-gradient(90deg, rgba(217,119,6,0.10), rgba(217,119,6,0.04))",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* draining cooldown bar */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          height: 3,
          width: `${pct * 100}%`,
          background: "linear-gradient(90deg, #d97706, #f59e0b)",
          transition: "width 1s linear",
          borderRadius: 3,
        }}
      />
      <span
        aria-hidden="true"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 30,
          height: 30,
          flexShrink: 0,
          borderRadius: 10,
          background: "linear-gradient(150deg, #d97706 20%, #92400e 100%)",
          boxShadow: "0 4px 10px rgba(217,119,6,0.35), inset 0 1px 0 rgba(255,255,255,0.35)",
          color: "#fff",
          fontSize: 11,
          fontWeight: 800,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {seconds}s
      </span>
      <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.45 }}>
        The AI provider is momentarily busy.
        <span style={{ opacity: 0.75, fontWeight: 500 }}>
          {" "}Your question was not lost — press send again, or I will answer from the live platform records in the meantime.
        </span>
      </span>
    </div>
  );
}

function Composer({
  text,
  setText,
  variant = "fullscreen",
}: {
  text: string;
  setText: (value: string) => void;
  variant?: CopilotVariant;
}) {
  const { streaming, stopStreaming, error, resetError, provider, providerConfigured, theme } = useCopilot();
  const rateSeconds = useRateLimitSeconds();
  /* The composer is never locked — a provider throttle shows as a hint, not a
     wall. Back-to-back questions are allowed. */
  const rateLimited = false;

  return (
    <div className="mc-composer-zone">
      {error ? (
        <div className="mc-msg-error-note" style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", gap: 10 }}>
          <span>{error}</span>
          <button type="button" className="mc-chip-btn" onClick={resetError} aria-label="Dismiss error">Dismiss</button>
        </div>
      ) : null}

      <RateLimitBanner seconds={rateSeconds} />

      <ChatInputArea className="mc-input-pill relative bg-card border-border">
        <BorderBeam
          size={68}
          duration={7}
          borderWidth={1.5}
          colorFrom={theme === "dark" ? "#93c5fd" : "#347deb"}
          colorTo={theme === "dark" ? "#a855f7" : "#8b5cf6"}
        />
        <ChatInputField
          multiline
          rows={1}
          value={text}
          disabled={false}
          placeholder={
            providerConfigured
              ? variant === "panel"
                ? "Ask about subsidiaries, reports, deadlines…"
                : "Ask about subsidiaries, submissions, deadlines, analytics…"
              : "Ask about subsidiaries, reports, deadlines… (grounded mode — no AI key configured)"
          }
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)}
          aria-label="Message MEIL Intelligence"
        />
        <ChatInputSubmit
          type={streaming ? "button" : "submit"}
          aria-label={streaming ? "Stop generating" : "Send message"}
          title={streaming ? "Stop generating" : "Send"}
          disabled={!streaming && !text.trim()}
          className={streaming ? "mc-submit-stop" : undefined}
          onClick={(e) => {
            if (streaming) {
              e.preventDefault();
              stopStreaming();
            }
          }}
        >
          {streaming ? (
            <Square className="size-[1em] fill-current" />
          ) : (
            <ArrowUpIcon className="size-[1.2em]" />
          )}
          <span className="sr-only">
            {streaming ? "Stop generating" : "Send"}
          </span>
        </ChatInputSubmit>
      </ChatInputArea>

      <div className="mc-composer-foot">
        <span className="mc-composer-hint">
          {variant === "panel" ? "Enter to send · Shift+Enter newline" : "Enter to send · Shift+Enter for a new line"}
        </span>
        <span className="mc-provider-tag">
          {providerConfigured
            ? `${provider === "gemini" ? "Gemini" : provider === "groq" ? "Groq · 1 req/min" : provider} · grounded via tools`
            : "Grounded engine · live platform records"}
        </span>
      </div>
    </div>
  );
}

/* ───────────────────────────── Root ───────────────────────────── */

export function CopilotWorkspace({ variant = "fullscreen" }: { variant?: CopilotVariant }) {
  const { view, bootstrap, reportingYear, fullscreen, theme, hydrateTheme, streaming } = useCopilot();
  const [tab, setTab] = React.useState<"chat" | "explorer">("chat");
  const [sideOpen, setSideOpen] = React.useState(false);
  const [draft, setDraft] = React.useState("");

  React.useEffect(() => {
    hydrateTheme();
  }, [hydrateTheme]);

  // Bootstrap once per reporting year; suggestions reload when the year changes.
  const bootRef = React.useRef("");
  React.useEffect(() => {
    if (bootRef.current !== reportingYear) {
      bootRef.current = reportingYear;
      void bootstrap(reportingYear);
    }
  }, [reportingYear, bootstrap]);

  const dispatchPrompt = React.useCallback((prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    void (async () => {
      const s = useCopilot.getState();
      if (!s.conversationId) await s.newConversation(s.reportingYear);
      const st = useCopilot.getState();
      st.sendMessage(trimmed, st.reportingYear);
    })();
  }, []);

  const handleChatSubmit = (e: ChatSubmitEvent) => {
    e.preventDefault();
    if (streaming) return;
    const st = useCopilot.getState();
    if (st.rateLimitUntil && st.rateLimitUntil > Date.now()) return; // cooldown active
    const msg = e.message.trim();
    if (!msg) return;
    setDraft("");
    dispatchPrompt(msg);
  };

  return (
    <div
      className={`mc-root ${theme === "dark" ? "mc-dark dark" : ""} ${variant === "panel" ? "mc-panel" : ""} ${variant === "fullscreen" && fullscreen ? "mc-full" : ""}`}
    >
      <CopilotHeader
        variant={variant}
        tab={tab}
        setTab={setTab}
        sideOpen={sideOpen}
        toggleSide={() => setSideOpen((v) => !v)}
      />
      <div className="mc-body">
        <div className="mc-main">
          {tab === "explorer" ? (
            <CopilotExplorer onBack={() => setTab("chat")} />
          ) : (
            <Chat onSubmit={handleChatSubmit}>
              <div className="mc-chat-shell">
                {view === "landing" ? (
                  <div className="mc-viewport flex-1 min-h-0 overflow-y-auto rounded-2xl border border-border bg-card px-4">
                    <Landing variant={variant} onAsk={dispatchPrompt} />
                  </div>
                ) : (
                  <ChatViewport className="mc-viewport flex-1 min-h-0 rounded-2xl bg-card border-border">
                    <MessageList />
                  </ChatViewport>
                )}
                <Composer text={draft} setText={setDraft} variant={variant} />
              </div>
            </Chat>
          )}
        </div>
        <CopilotSidebar open={sideOpen} onClose={() => setSideOpen(false)} />
      </div>
    </div>
  );
}
