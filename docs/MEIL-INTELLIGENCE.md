# MEIL Intelligence — Enterprise AI Copilot

Deliverables overview for the AI Copilot added to the MEIL ESG & BRSR Reporting
Platform (Group Admin / Super Admin). The module is **fully additive**: no
existing view, workflow, calculation, or hierarchy was modified.

---

## 1. Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  Surfaces (one shared zustand store: src/lib/copilot/store.ts)       │
│  • Full-screen view  src/components/workspace/views/intelligence.tsx │
│  • Floating panel    src/components/copilot/floating.tsx             │
├──────────────────────────────────────────────────────────────────────┤
│  UI layer                                                            │
│  • workspace.tsx   header · landing · stream · composer · sidebar    │
│  • explorer.tsx    Smart Explorer (12 categories, cascade, results)  │
│  • blocks.tsx      15 adaptive block types (cards/charts/timelines)  │
│  • avatar/         capsule avatar (bloub-derived engine + renderer)  │
│  • copilot.css     Liquid Glass stylesheet (mc-* classes)            │
├──────────────────────────────────────────────────────────────────────┤
│  Client data   src/lib/copilot/client.ts (fetch + SSE reader)        │
├──────────────────────────────────────────────────────────────────────┤
│  API routes  src/app/api/copilot/*  (session-guarded, roles:         │
│              GROUP_ADMIN / ORG_MANAGER only)                         │
│    conversations · conversations/[id] · chat (SSE) · confirm ·       │
│    explorer · suggestions · saved                                    │
├──────────────────────────────────────────────────────────────────────┤
│  Server core   src/lib/copilot/                                      │
│    orchestrator.ts  SSE conversation loop, tool executions           │
│    gateway.ts       provider gateway — Groq (OpenAI-compatible) and  │
│                     Google Gemini adapters, streaming + function      │
│                     calling, per-provider error mapping              │
│    tools.ts         20-tool registry → real Prisma queries + UI      │
│                     blocks; never exposes the DB to the model        │
│    actions.ts       single-use, expiring confirmations (atomic)      │
│    server.ts        requireCopilotUser session/role guard + audit    │
├──────────────────────────────────────────────────────────────────────┤
│  Persistence (Prisma, additive models)                               │
│    CopilotConversation · CopilotMessage · CopilotToolExecution ·     │
│    CopilotConfirmation · CopilotSavedItem                            │
└──────────────────────────────────────────────────────────────────────┘
```

### Data flow of one turn

1. User message → `POST /api/copilot/chat` (SSE).
2. `orchestratorSse` runs a **tool-calling loop** against Gemini
   (`streamProviderTurn`): model requests tools → handlers run real,
   scope-limited Prisma queries → results (model JSON + validated UI blocks)
   go back to the model → final narrative streams out.
3. SSE events (`data: {JSON}\n\n`, 15s heartbeats):
   `status` (avatar state) · `activity` (tool runs) · `delta` (text) ·
   `block` (adaptive card) · `sources` · `message_done` · `error` · `done`.
4. Everything persists: messages, tool executions (with duration/status),
   and confirmations.

### Grounding & safety model

- **LLM never touches the DB.** All facts flow through the 20-tool registry;
  entity names are resolved with `resolve_entity`; ambiguous names are
  clarified, never guessed.
- **System prompt hard rules**: grounding, tools-first, workflow-status vs
  deadline-status separation, provenance labeling, prepared-actions only,
  prompt-injection defense for tool payloads, no secrets in profiles.
- **Actions (L2/L3)**: `prepare_reminder`, `prepare_deadline_change`,
  `create_follow_up_task` create a `CopilotConfirmation` row (10-minute TTL,
  single-use). Execution is atomic (claim-by-status-transition) in
  `executeConfirmedAction`; a model message is never sufficient authority.
- **Session guard**: `requireCopilotUser` verifies the real session cookie and
  restricts to GROUP_ADMIN / ORG_MANAGER with ACTIVE status. All `/api/copilot/*`
  routes are guarded; every sensitive step writes audit entries.

### Avatar (capsule, bloub-derived)

`src/components/copilot/avatar/engine.ts` is a **pure deterministic** engine
(`sampleAvatar(input) → frame`): 64-sample radial profile of a true **capsule**
(`capsuleRadius(θ, a, R)`, tip = a + R), eyes fitted via `radiusAtAngle` so they
stay inside the silhouette through every morph, exponential ease-out morphs from
a frozen composite pose (continuity rule), drift-after-mix gaze, and a
pre-computed deterministic blink schedule. Default expression is **EXCITED**.
16 states (idle, excited, listening, thinking, searching, retrieving,
analyzing, generating, success, warning, error, waiting, confirmation,
cancelled, offline …). The renderer (`meil-avatar.tsx`) drives one RAF loop,
pauses when hidden (IntersectionObserver/visibility), honors
`prefers-reduced-motion` with a fixed calm frame, and namespaces SVG gradient
IDs per instance.

---

## 2. API reference

All routes require the platform session cookie (`meil_esg_session`) and a
GROUP_ADMIN or ORG_MANAGER role; errors return `{ error, code? }`.

| Route | Method | Purpose |
|---|---|---|
| `/api/copilot/conversations` | GET | List conversations (pinned first). |
| | POST | Create conversation (`{ context: { reportingYear, viewId } }`). |
| `/api/copilot/conversations/[id]` | GET | Full thread: messages, blocks, sources, executions. |
| | PATCH | Rename (`{ title }`) or pin (`{ pinned }`). |
| | DELETE | Archive (soft hide from the list). |
| `/api/copilot/chat` | POST | Stream one turn (SSE). Body: `{ conversationId, message, reportingYear, viewId? }`. |
| `/api/copilot/confirm` | POST | Resolve a confirmation: `{ confirmationId, decision: "confirm" \| "cancel" }`. Single-use. |
| `/api/copilot/explorer` | GET | `mode=cascade` (selector options: subsidiaries / business_units / projects / periods) or `mode=results` (12 categories, filters `subsidiaryId businessUnitId projectId period status q limit offset`). |
| `/api/copilot/suggestions` | GET | Landing suggestions + provider status for a reporting period. |
| `/api/copilot/saved` | GET/POST/DELETE | Saved analyses (`kind ANALYSIS`), pin + delete by id. |

### Tool registry (23 tools)

Read/analysis (L0/L1, auto-run): subsidiaries, business units, projects, users,
submissions (scoped + by-ref), approvals, evidence, deadlines, activity,
analytics (ESG aggregates), compliance findings, BRSR reports,
resolve_entity, group overview, reminder drafts, follow-up questions, etc.
Directory listings added after a live test showed the model correctly refusing
a question the registry could not answer (`list_subsidiaries`, `list_users`,
`list_projects` — the last one also returns head-count per subsidiary).
Prepared actions (L2/L3, confirmation-gated): `prepare_reminder`,
`prepare_deadline_change`, `create_follow_up_task`.

Each tool returns `{ summary, data, blocks?, sources? }` — `data` feeds the
model, `blocks` are validated UI cards rendered by `blocks.tsx` (15 types:
kpi, data_table, chart, comparison, executive_summary, entity_profile,
submission, approval_timeline, evidence, activity_timeline, recommendation,
action_preview, confirmation, follow_ups, text).

---

## 3. Environment variables (copilot-specific)

| Variable | Default | Meaning |
|---|---|---|
| `AI_PROVIDER` | `groq` when `GROQ_API_KEY` is set | Active provider: `groq` or `gemini`. Forced value wins; otherwise the first configured credential wins. |
| `GROQ_API_KEY` | — | Groq credential (OpenAI-compatible). Sent as `Authorization: Bearer …` to `https://api.groq.com/openai/v1/chat/completions`. |
| `GROQ_MODEL` | `openai/gpt-oss-120b` | Groq model id. The key currently has access to `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `qwen/qwen3.8-27b`, `allam-2-7b`, `whisper-large-v3` (+ guard/orpheus models). Only `gpt-oss-*` was verified for tool calling. |
| `GROQ_BASE_URL` | `https://api.groq.com/openai/v1` | Override for OpenAI-compatible gateways. |
| `GROQ_REASONING_EFFORT` | `low` | Only sent for `openai/gpt-oss-*` models. **Required in practice**: at the default effort gpt-oss spends the entire output budget on reasoning and the turn ends with no text, no tool call and no `finish_reason`. |
| `GEMINI_API_KEY` | — | Google Gemini credential (alternate provider). Both classic (`AIza…`) and new-format (`AQ.…`) keys are API keys sent via `x-goog-api-key` (an `AQ.` key sent as a Bearer token returns 401 `CREDENTIALS_MISSING`). |
| `GEMINI_MODEL` | `gemini-3.5-flash` | Gemini model id. `gemini-2.0-flash` is retired; free-tier keys have a **per-model** quota (`gemini-3.8-flash` was exhausted while `3.5-flash` still had capacity on the same key). |
| `COPILOT_TEMPERATURE` | `0.4` | Generation temperature. |
| `COPILOT_MAX_OUTPUT_TOKENS` | `4096` | Per-turn output cap (includes reasoning tokens on gpt-oss models). |
| `COPILOT_TIMEOUT_MS` | `90000` | Provider request timeout. |

Existing platform env (`DATABASE_URL` pooled + `DIRECT_URL` for push) is
unchanged. The five copilot tables were pushed with `prisma db push`.

---

## 4. Verification

- `npx tsc --noEmit` — clean (strict mode) across the whole project.
- `npx next build` — compiles successfully; all 7 `/api/copilot/*` routes registered.
- `bun test tests/copilot` — 55 tests: capsule geometry, engine purity,
  morph continuity, blink determinism, reduced-motion frame, tool-registry
  integrity (naming, risk classification), follow-up extraction, provider
  config, confirmation TTL, provider SSE frame parsing (CRLF/LF, split frames,
  trailing frame, thought parts), the Gemini function-calling protocol
  (functionCall echo, thought-signature placement), provider error mapping,
  and the Groq adapter (request shape, tool_call_id linking, split tool-call
  arguments, reasoning suppression, provider selection).
- `bun scripts/copilot-smoke.mjs` — end-to-end smoke: mints a real
  GROUP_ADMIN session, creates a conversation, streams one chat turn and
  prints every SSE event. Requires the dev server on `:3000` and a valid
  `GEMINI_API_KEY`. The session row is cleaned up automatically.
- `scripts/verify-copilot-db.mjs` — verifies the five copilot tables exist.

## 5. Known limitations

1. **Provider key handling** — both `AIza…` and `AQ.…` Google keys are API keys
   authenticated with `x-goog-api-key`. Earlier versions sent `AQ.` keys as
   Bearer tokens, which Google rejects with 401 `CREDENTIALS_MISSING`.
2. **SSE frame separators** — the live Gemini endpoint terminates frames with
   CRLF (`\r\n\r\n`). Splitting on a literal `"\n\n"` discarded every frame and
   surfaced as "the provider returned an empty response" despite HTTP 200. The
   shared parser (`createSseFrameParser`) accepts both separators, tolerates
   frames split across chunk boundaries, parses a trailing frame without a
   separator, and skips internal "thought" parts. Regression-tested in
   `tests/copilot/gateway-sse.test.ts`.
3. **Model availability & quota** — `gemini-2.0-flash` is retired; the Gemini
   path defaults to `gemini-3.5-flash`. Free-tier keys have a **per-model**
   quota, and Groq's `gpt-oss` models need `reasoning_effort: "low"` — at the
   default effort the turn ends with no text, no tool call and no
   `finish_reason` (the whole budget went to reasoning).
4. **Network flakiness to the Supabase pooler (6543)** was observed during
   testing (transient `P1001` / `P2024`); retries succeeded. Unrelated to the
   copilot.
5. **Explorer write-path** — Smart Explorer is read-only by design; all
   mutations go through the existing platform views or confirmation-gated
   prepared actions.
6. **Single-provider** — the gateway abstracts Gemini; adding a second
   provider only requires another branch in `providerAuthUrlAndHeaders` and a
   stream parser.
7. **Browser acceptance not performed here** — the Tabbit browser was
   unavailable in this environment (launcher exit 69). Verification is
   therefore: `npx tsc --noEmit` clean, `npx next build` compiles successfully
   with all 7 copilot routes registered, 32 bun tests passing, and the SSE
   smoke script exercising a real Gemini turn with real tool calls. A manual
   pass over the Intelligence view and floating panel is still recommended as
   final acceptance.
