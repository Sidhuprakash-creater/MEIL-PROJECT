// MEIL Intelligence — conversational composer (offline grounded mode).
//
// The tools return facts; this module turns them into an answer that reads
// like a colleague answering a question, not a data dump:
//
//   · a natural opening line that addresses the QUESTION, not the tool
//   · plain sentences with the real numbers woven in
//   · a clear "what this means" read-out
//   · a forward-looking next step
//   · 2–3 follow-up questions the user can click
//
// Every fact still comes from a tool payload — nothing here invents data.

import type { ContentBlock } from "./types";

export interface ToolOutcome {
  name: string;
  summary: string;
  error?: string;
  data?: unknown;
}

/* ── question shape ───────────────────────────────────────────────────────── */

export type QuestionShape =
  | "yes_no"          // "is anything pending?"  → answer yes/no first
  | "list"            // "which submissions…?"   → answer with the items
  | "count"           // "how many…?"            → answer with the number
  | "compare"         // "compare A and B"       → answer with the comparison
  | "explain";        // "tell me about X"       → answer with the profile

const YES_WORDS = /\b(is|are|any|anything|does|do|has|have|pending|waiting|exist|exists)\b/i;
const LIST_WORDS = /\b(which|what|list|show|find|name|names|where|who)\b/i;
const COUNT_WORDS = /\bhow many|how much|count|number of|total\b/i;
const COMPARE_WORDS = /\bcompare|comparison|versus|\bvs\b|better|worse|best|worst|which one\b/i;

export function classifyQuestion(text: string): QuestionShape {
  if (COMPARE_WORDS.test(text)) return "compare";
  if (COUNT_WORDS.test(text)) return "count";
  if (YES_WORDS.test(text) && !LIST_WORDS.test(text)) return "yes_no";
  if (LIST_WORDS.test(text)) return "list";
  return "explain";
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function listOf(items: string[], max = 4): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  const head = items.slice(0, max - 1).join(", ");
  return `${head}, and ${items[items.length - 1]}`;
}

/* ── per-tool conversational answers ─────────────────────────────────────── */

interface Composer {
  /** The opening line — answers the question directly. */
  opening: (o: ToolOutcome[], q: string, shape: QuestionShape) => string;
  /** The "so what" line. */
  read?: (o: ToolOutcome[]) => string;
  /** The forward-looking line. */
  next?: (o: ToolOutcome[]) => string;
}

const COMPOSERS: Record<string, Composer> = {
  get_group_performance: {
    opening: (o, q, shape) => {
      const d = o[0]?.data as Record<string, unknown> | undefined;
      if (!d) return "Here's where the group stands right now.";
      const counts = (d.statusCounts ?? {}) as Record<string, number>;
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      const approved = counts["APPROVED"] ?? 0;
      const pending = (counts["SUBMITTED"] ?? 0) + (counts["UNDER_REVIEW"] ?? 0) + (counts["CHANGES_REQUESTED"] ?? 0);
      const overdue = num(d.overdueCount) ?? 0;
      const issues = num(d.openValidationIssues) ?? 0;
      const period = String(d.period ?? "the current period");

      if (shape === "yes_no") {
        if (pending === 0 && overdue === 0) {
          return `Good news — nothing is stuck. All ${total} submission${total === 1 ? "" : "s"} for ${period} are approved, and nothing is overdue.`;
        }
        return `Yes — ${pending} submission${pending === 1 ? " is" : "s are"} still moving through review, and ${overdue} ${overdue === 1 ? "is" : "are"} overdue.`;
      }
      if (shape === "count") {
        return `For ${period} there are ${total} submission${total === 1 ? "" : "s"} on record — ${approved} approved, ${pending} still in review.`;
      }
      return `Across ${period} the group has ${total} submission${total === 1 ? "" : "s"}: **${approved} approved** and ${pending} still working through the approval chain.`;
    },
    read: (o) => {
      const d = o[0]?.data as Record<string, unknown> | undefined;
      if (!d) return "";
      const issues = num(d.openValidationIssues) ?? 0;
      const anomalies = num(d.openAnomalies) ?? 0;
      const pkgs = asArray(d.packages);
      const below = pkgs.filter((p) => num((p as Record<string, unknown>).readinessPct) !== 100).length;
      const parts: string[] = [];
      if (issues) parts.push(`${issues} open validation issue${issues === 1 ? "" : "s"}`);
      if (anomalies) parts.push(`${anomalies} calculation anomal${anomalies === 1 ? "y" : "ies"}`);
      if (below) parts.push(`${below} reporting package${below === 1 ? "" : "s"} below 100% readiness`);
      if (!parts.length) return "The data-quality queue is clean — no open validation issues or anomalies.";
      return `The data-quality side is where the attention is needed: ${listOf(parts)}.`;
    },
    next: (o) => {
      const d = o[0]?.data as Record<string, unknown> | undefined;
      const pkgs = asArray(d?.packages);
      const below = pkgs.filter((p) => num((p as Record<string, unknown>).readinessPct) !== 100);
      if (below.length) {
        const p = below[0] as Record<string, unknown>;
        return `If you want to move the needle, start with **${p.subsidiary ?? "the least-ready subsidiary"}** (${p.ref ?? "package"}) — I can pull its readiness detail next.`;
      }
      return "Want me to break this down subsidiary by subsidiary, or pull the BRSR completeness view?";
    },
  },

  compare_entities: {
    opening: (o, q) => {
      const rows = o.find((x) => x.name === "compare_entities")?.data;
      if (!Array.isArray(rows) || rows.length === 0) return "I couldn't line the subsidiaries up for comparison.";
      const sorted = [...rows].sort(
        (a, b) => (num((b as Record<string, unknown>).approved) ?? 0) - (num((a as Record<string, unknown>).approved) ?? 0)
      );
      const top = sorted[0] as Record<string, unknown>;
      const topApproved = num(top.approved) ?? 0;
      const topOverdue = num(top.overdue) ?? 0;
      if (topApproved === 0) {
        return "Comparing all seven subsidiaries on the submission ledger, they're level at zero approved records each — the reporting cycle hasn't produced approvals yet.";
      }
      return `**${top.name}** is leading the group with **${topApproved} approved submission${topApproved === 1 ? "" : "s"}**${topOverdue ? ` and ${topOverdue} overdue` : ""}.`;
    },
    read: (o) => {
      const rows = o.find((x) => x.name === "compare_entities")?.data;
      if (!Array.isArray(rows) || rows.length === 0) return "";
      const withApproved = rows
        .map((r) => ({ name: String((r as Record<string, unknown>).name ?? "—"), approved: num((r as Record<string, unknown>).approved) ?? 0 }))
        .filter((r) => r.approved > 0)
        .sort((a, b) => b.approved - a.approved);
      if (!withApproved.length) return "";
      return `The rest are trailing: ${withApproved.slice(1).map((r) => `${r.name} (${r.approved})`).join(", ") || "none have approvals yet"}.`;
    },
    next: () => "Want the readiness percentages instead of the raw submission counts?",
  },

  get_deadline_summary: {
    opening: (o, q, shape) => {
      const d = o[0]?.data as Record<string, unknown> | undefined;
      if (!d) return "Here's the deadline picture.";
      const overdue = asArray(d.overdue);
      const dueSoon = asArray(d.dueSoon);
      if (shape === "yes_no") {
        if (!overdue.length && !dueSoon.length) return "Nothing is overdue and nothing is due in the next week — the deadlines are comfortably clear.";
        return overdue.length
          ? `Yes — ${overdue.length} submission${overdue.length === 1 ? " is" : "s are"} already past due.`
          : `Nothing overdue, but ${dueSoon.length} ${dueSoon.length === 1 ? "is" : "are"} due within the next seven days.`;
      }
      const total = overdue.length + dueSoon.length;
      return total === 0
        ? "The deadline situation is clean — nothing overdue and nothing due this week."
        : `${overdue.length} submission${overdue.length === 1 ? " is" : "s are"} overdue and ${dueSoon.length} more ${dueSoon.length === 1 ? "is" : "are"} due within seven days.`;
    },
    read: (o) => {
      const d = o[0]?.data as Record<string, unknown> | undefined;
      const overdue = asArray(d?.overdue) as Record<string, unknown>[];
      if (!overdue.length) return "";
      const refs = overdue.slice(0, 3).map((s) => String(s.ref ?? ""));
      return `The overdue ones to chase first are ${listOf(refs)}.`;
    },
    next: () => "I can list the full deadline board, or check which projects have no owner on the pending reports — whichever helps.",
  },

  get_submissions: {
    opening: (o, q, shape) => {
      const items = asArray(o[0]?.data) as Record<string, unknown>[];
      const statusFilter = String((o[0]?.data as any)?.status ?? "");
      if (items.length === 0) {
        return statusFilter
          ? `There isn't anything in **${statusFilter.replace(/_/g, " ").toLowerCase()}** right now — that queue is completely clear.`
          : "There are no submissions matching that in the current period.";
      }
      if (shape === "count") return `There are **${items.length}** submission${items.length === 1 ? "" : "s"} in that queue.`;
      const first = items[0];
      return `I've found **${items.length}** submission${items.length === 1 ? "" : "s"} — the first is **${first.ref}** (${String(first.title ?? "").slice(0, 60)})${first.entity ? ` from ${first.entity}` : ""}.`;
    },
    read: (o) => {
      const items = asArray(o[0]?.data) as Record<string, unknown>[];
      if (items.length <= 1) return "";
      const rest = items.slice(1, 4).map((s) => String(s.ref ?? ""));
      return `Also in the queue: ${listOf(rest)}.`;
    },
    next: () => "Want me to open the approval workspace for any of these, or check their evidence coverage?",
  },

  get_brsr_completeness: {
    opening: (o) => {
      const d = o[0]?.data as Record<string, unknown> | undefined;
      if (!d) return "Here's where the BRSR report stands.";
      const incomplete = asArray(d.incomplete);
      const signoffs = num(d.pendingSignoffs) ?? 0;
      const finalized = d.finalized ?? false;
      if (finalized) return "The BRSR report is finalized — it's locked and ready for the Board pack.";
      if (incomplete.length === 0 && signoffs === 0) {
        return "The BRSR report is fully mapped — every disclosure is filled in and all sign-offs are recorded.";
      }
      return `The BRSR report is **${incomplete.length} disclosure${incomplete.length === 1 ? "" : "s"}** away from complete${signoffs ? `, with ${signoffs} sign-off${signoffs === 1 ? "" : "s"} still pending` : ""}.`;
    },
    read: (o) => {
      const d = o[0]?.data as Record<string, unknown> | undefined;
      const incomplete = asArray(d?.incomplete) as Record<string, unknown>[];
      if (!incomplete.length) return "";
      return `The gaps are ${listOf(incomplete.slice(0, 4).map((x) => String(x.title ?? x.code ?? "an item")))}.`;
    },
    next: () => "I can pull the per-subsidiary BRSR data checklist, or re-run the consolidation so the mapped values refresh.",
  },

  get_missing_evidence: {
    opening: (o) => {
      const d = o[0]?.data as Record<string, unknown> | undefined;
      if (!d) return "Here's the data-completeness picture.";
      const missing = asArray(d.missing);
      const docs = num(d.missingDocs) ?? 0;
      if (!missing.length && !docs) return "Everything is backed up — there are no missing evidence documents or submissions outstanding.";
      return `There **${missing.length}** data-completeness finding${missing.length === 1 ? "" : "s"} open, plus ${docs} document${docs === 1 ? "" : "s"} flagged as missing.`;
    },
    read: (o) => {
      const d = o[0]?.data as Record<string, unknown> | undefined;
      const missing = asArray(d?.missing) as Record<string, unknown>[];
      if (!missing.length) return "";
      const rules = [...new Set(missing.map((m) => String(m.rule ?? "").replace(/_/g, " ").toLowerCase()).filter(Boolean))];
      return rules.length ? `The gaps are mostly ${listOf(rules)}.` : "";
    },
    next: () => "Want me to see which projects are responsible, or prepare a reminder for the missing evidence?",
  },

  get_review_pipeline: {
    opening: (o, q, shape) => {
      const d = o[0]?.data as Record<string, unknown> | undefined;
      if (!d) return "Here's the live review picture.";
      const verification = num(d.awaitingVerification) ?? 0;
      const chain = num(d.inChain) ?? 0;
      const approved = num(d.approved) ?? 0;
      const period = String(d.period ?? "the current period");

      if (shape === "yes_no") {
        if (verification === 0 && chain === 0) {
          return `Nothing is waiting — every submission for ${period} has cleared the review chain, and there are no packages sitting with the Subsidiary Admin for verification.`;
        }
        if (verification > 0) {
          return `Yes — **${verification} consolidated package${verification === 1 ? " is" : "s are"}** sitting with the Subsidiary Admin for second-step verification${chain ? `, and ${chain} more still working through the review chain` : ""}.`;
        }
        return `Yes — ${chain} submission${chain === 1 ? " is" : "s are"} still moving through the review chain. Nothing is with the Subsidiary Admin right now.`;
      }
      if (shape === "count") {
        return `For ${period}: ${verification} awaiting verification, ${chain} still in the review chain, ${approved} approved and locked in.`;
      }
      return `The pipeline for ${period} is: **${verification}** awaiting Subsidiary Admin verification, **${chain}** still in the review chain, and **${approved}** approved and locked in.`;
    },
    read: (o) => {
      const d = o[0]?.data as Record<string, unknown> | undefined;
      if (!d) return "";
      const verificationItems = asArray(d.verificationItems) as Record<string, unknown>[];
      const chainItems = asArray(d.chainItems) as Record<string, unknown>[];
      const parts: string[] = [];
      if (verificationItems.length) {
        parts.push(
          `Waiting on the Subsidiary Admin: ${listOf(verificationItems.slice(0, 3).map((v) => `${v.ref} (${v.entity})`))}.`
        );
      }
      if (chainItems.length) {
        const overdue = chainItems.filter((c) => c.overdue).length;
        parts.push(
          `Still in the chain: ${listOf(chainItems.slice(0, 3).map((c) => String(c.ref ?? "")))}${overdue ? ` — ${overdue} of them ${overdue === 1 ? "is" : "are"} overdue` : ""}.`
        );
      }
      return parts.join(" ");
    },
    next: () => "Want me to pull the evidence coverage on the ones that are waiting, or check the deadlines behind them?",
  },

  get_compliance_summary: {
    opening: (o) => {
      const d = o[0]?.data as Record<string, unknown> | undefined;
      if (!d) return "Here's the compliance picture.";
      const issues = asArray(d.issues);
      const anomalies = num(d.openAnomalies) ?? 0;
      if (!issues.length && !anomalies) return "No open compliance findings — the validation and anomaly queues are both clear.";
      return `There **${issues.length}** open compliance finding${issues.length === 1 ? "" : "s"} and ${anomalies} calculation anomal${anomalies === 1 ? "y" : "ies"} to work through.`;
    },
    next: () => "I can list the individual findings, or rank them by severity — which is more useful?",
  },

  get_reporting_completion: {
    opening: (o) => {
      const d = o[0]?.data as Record<string, unknown> | undefined;
      if (!d) return "Here's the reporting-completion picture.";
      const rows = asArray(d.rows) as Record<string, unknown>[];
      const complete = rows.filter((r) => (num(r.readinessPct) ?? 0) >= 100).length;
      const avg = num(d.averageReadinessPct);
      return `${complete} of ${rows.length} subsidiary packages ${complete === 1 ? "is" : "are"} at 100% readiness${avg !== null ? `, and the group average sits at ${avg}%` : ""}.`;
    },
    next: () => "Want the least-ready subsidiaries broken out, or the package readiness for one of them?",
  },

  get_project_profile: {
    opening: (o) => {
      const d = o[0]?.data as Record<string, unknown> | undefined;
      if (!d) return "Here's what I have on that project.";
      const counts = (d.statusCounts ?? {}) as Record<string, number>;
      const approved = counts["APPROVED"] ?? 0;
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      const bu = String(d.businessUnit ?? "its business unit");
      const sub = String(d.subsidiary ?? "the group");
      return `**${d.name}** (${d.code}) sits under ${bu} in ${sub} — ${total} submission${total === 1 ? "" : "s"} on record, ${approved} approved.`;
    },
    read: (o) => {
      const d = o[0]?.data as Record<string, unknown> | undefined;
      if (!d) return "";
      const users = asArray(d.users) as Record<string, unknown>[];
      if (!users.length) return "";
      const names = users.slice(0, 3).map((u) => String(u.name ?? ""));
      return `The people on it are ${listOf(names)}${users.length > 3 ? ` and ${users.length - 3} more` : ""}.`;
    },
    next: () => "Want the evidence attached to this project, or its recent submissions?",
  },

  get_subsidiary_profile: {
    opening: (o) => {
      const d = o[0]?.data as Record<string, unknown> | undefined;
      if (!d) return "Here's the subsidiary profile.";
      const counts = (d.statusCounts ?? {}) as Record<string, number>;
      const approved = counts["APPROVED"] ?? 0;
      const pending = (counts["SUBMITTED"] ?? 0) + (counts["UNDER_REVIEW"] ?? 0);
      return `**${d.name}** (${d.code}) runs ${num(d.businessUnitCount) ?? 0} business unit${(num(d.businessUnitCount) ?? 0) === 1 ? "" : "s"} — ${approved} approved submissions${pending ? `, ${pending} still in review` : ""}.`;
    },
    read: (o) => {
      const d = o[0]?.data as Record<string, unknown> | undefined;
      if (!d) return "";
      const issues = num(d.openIssues);
      if (!issues) return "";
      return `There ${issues === 1 ? "is" : "are"} ${issues} open validation issue${issues === 1 ? "" : "s"} against it right now.`;
    },
    next: () => "Want its subsidiaries compared, or its pending approvals listed?",
  },

  get_business_unit_profile: {
    opening: (o) => {
      const d = o[0]?.data as Record<string, unknown> | undefined;
      if (!d) return "Here's the business unit profile.";
      const counts = (d.statusCounts ?? {}) as Record<string, number>;
      return `**${d.name}** (${d.code}) under ${d.subsidiaryName ?? "its subsidiary"} covers ${num(d.projectCount) ?? 0} project${(num(d.projectCount) ?? 0) === 1 ? "" : "s"} — ${counts["APPROVED"] ?? 0} approved submissions.`;
    },
    next: () => "Want the project list, or its pending approvals?",
  },

  get_user_profile: {
    opening: (o) => {
      const d = o[0]?.data as Record<string, unknown> | undefined;
      if (!d) return "Here's the user record.";
      return `**${d.name}** is a ${String(d.role ?? "user").replace(/_/g, " ").toLowerCase()}${d.status ? `, currently ${String(d.status).toLowerCase()}` : ""}.`;
    },
    read: (o) => {
      const d = o[0]?.data as Record<string, unknown> | undefined;
      if (!d) return "";
      const subs = num(d.recentSubmissions);
      if (subs === null) return "";
      return `They have ${subs} recent submission${subs === 1 ? "" : "s"} on record.`;
    },
    next: () => "Want their recent submissions, or what they're currently responsible for?",
  },

  search_evidence: {
    opening: (o) => {
      const docs = asArray(o.find((x) => x.name === "search_evidence")?.data);
      if (!docs.length) return "I couldn't find any evidence documents for that — the repository has nothing filed under it yet.";
      const first = docs[0] as Record<string, unknown>;
      return `I found **${docs.length}** evidence document${docs.length === 1 ? "" : "s"} — starting with **${first.name ?? first.fileName ?? "an untitled file"}**.`;
    },
    next: () => "Want me to check which of these are still flagged as missing or under review?",
  },

  get_recent_activity: {
    opening: (o) => {
      const events = asArray(o[0]?.data) as Record<string, unknown>[];
      if (!events.length) return "There's no activity logged yet.";
      const e = events[0];
      return `The most recent activity was **${String(e.action ?? "").replace(/_/g, " ").toLowerCase()}** by ${e.actor}${e.target ? ` on ${e.target}` : ""}.`;
    },
    read: (o) => {
      const events = asArray(o[0]?.data) as Record<string, unknown>[];
      if (events.length <= 1) return "";
      const actors = [...new Set(events.slice(1, 4).map((e) => String(e.actor ?? "")))].filter(Boolean);
      return `Since then, ${listOf(actors)} ${actors.length === 1 ? "has" : "have"} been active too.`;
    },
    next: () => "Want me to filter the feed to one person or one report type?",
  },

  list_subsidiaries: {
    opening: (o) => {
      const subs = asArray(o[0]?.data) as Record<string, unknown>[];
      if (!subs.length) return "There are no subsidiaries on record.";
      return `There are **${subs.length}** subsidiaries in the group.`;
    },
    read: (o) => {
      const subs = asArray(o[0]?.data) as Record<string, unknown>[];
      const names = subs.slice(0, 5).map((s) => String(s.name ?? ""));
      return names.length ? `They are ${listOf(names)}${subs.length > 5 ? `, and ${subs.length - 5} more` : ""}.` : "";
    },
    next: () => "Want to compare their submission ledgers side by side?",
  },

  list_projects: {
    opening: (o) => {
      const p = asArray(o[0]?.data) as Record<string, unknown>[];
      if (!p.length) return "There are no projects matching that.";
      return `That comes to **${p.length}** project${p.length === 1 ? "" : "s"}.`;
    },
    next: () => "Want any of them broken down with their reporting status?",
  },
};

/* ── follow-up suggestions ───────────────────────────────────────────────── */

function followUpsFor(o: ToolOutcome[], question: string): string[] {
  const names = new Set(o.map((x) => x.name));
  const q = question.toLowerCase();
  const out: string[] = [];

  if (names.has("get_project_profile") || names.has("get_subsidiary_profile") || names.has("get_business_unit_profile")) {
    out.push("Show me the pending submissions for it");
    out.push("What evidence is attached?");
  }
  if (names.has("get_group_performance") || names.has("compare_entities")) {
    out.push("Compare all subsidiaries on their submission ledger");
    out.push("What are the current BRSR gaps?");
    out.push("Which deadlines are at risk?");
  }
  if (names.has("get_brsr_completeness")) {
    out.push("Re-run the consolidation to refresh the values");
    out.push("Show the BRSR data checklist per subsidiary");
  }
  if (names.has("get_deadline_summary")) {
    out.push("Which of those overdue reports has no evidence?");
    out.push("Prepare a reminder for the overdue submissions");
  }
  if (names.has("get_missing_evidence") || names.has("get_compliance_summary")) {
    out.push("Which projects are responsible for the gaps?");
  }
  if (names.has("get_submissions")) {
    out.push("Open the approval workspace for the oldest one");
  }
  if (out.length === 0) {
    out.push("Show me the group performance", "What are the current BRSR gaps?", "Which deadlines are at risk?");
  }
  /* Never repeat the question the user just asked. */
  return out.filter((s) => !q.includes(s.toLowerCase().split(" ")[0])).slice(0, 3);
}

/* ── the composer ────────────────────────────────────────────────────────── */

export function composeConversation(
  outcomes: ToolOutcome[],
  question: string,
  blocks: ContentBlock[]
): { text: string; followUps: string[] } {
  const ok = outcomes.filter((o) => !o.error && o.summary);
  const failed = outcomes.filter((o) => o.error);

  if (ok.length === 0) {
    return {
      text: [
        "I couldn't answer that one — the platform tools didn't return anything for it.",
        "",
        failed.length
          ? `What I hit: ${failed.map((f) => f.summary).join("; ")}.`
          : "It's possible nothing in the platform matches that yet.",
        "",
        "Try naming a subsidiary, business unit or project directly, or ask about a queue (pending reviews, deadlines, evidence gaps, BRSR completeness).",
      ].join("\n"),
      followUps: ["Show me the group performance", "What are the current BRSR gaps?"],
    };
  }

  const shape = classifyQuestion(question);
  const primary = ok.find((o) => COMPOSERS[o.name]) ?? ok[0];
  const composer = COMPOSERS[primary.name];

  const parts: string[] = [];
  parts.push(composer.opening(ok, question, shape));

  const read = composer.read?.(ok);
  if (read) {
    parts.push("");
    parts.push(read);
  }

  /* Surface the strongest structured signal from the blocks, in prose — but
     only when the opening line did not already carry those numbers. */
  const kpi = blocks.find((b) => b.type === "kpi") as Extract<ContentBlock, { type: "kpi" }> | undefined;
  const openingHasNumbers = /\d/.test(composer.opening(ok, question, shape));
  if (kpi?.items?.length && !read && !openingHasNumbers) {
    const lines = kpi.items.slice(0, 6).map((i) => `- **${i.label}**: ${i.value}${i.hint ? ` — ${i.hint}` : ""}`);
    if (lines.length) {
      parts.push("");
      parts.push(lines.join("\n"));
    }
  }

  const comparison = blocks.find((b) => b.type === "comparison") as
    | Extract<ContentBlock, { type: "comparison" }>
    | undefined;
  if (comparison?.entityLabels?.length && !ok.some((o) => o.name === "compare_entities")) {
    parts.push("");
    parts.push(`**${comparison.title ?? "Breakdown"}**`);
    for (const metric of (comparison.metrics ?? []).slice(0, 3)) {
      const pairs = comparison.entityLabels.map((label, i) => `${label}: ${metric.values[i]}`);
      parts.push(`- ${metric.label} — ${pairs.join(" · ")}`);
    }
  }

  const next = composer.next?.(ok);
  if (next) {
    parts.push("");
    parts.push(next);
  }

  if (failed.length) {
    parts.push("");
    parts.push(`_One tool didn't return cleanly: ${failed.map((f) => f.summary).join("; ")}._`);
  }

  return { text: parts.join("\n"), followUps: followUpsFor(ok, question) };
}
