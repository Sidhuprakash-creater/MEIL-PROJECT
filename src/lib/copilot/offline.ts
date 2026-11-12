// MEIL Intelligence — offline grounded engine.
//
// When no AI provider key is configured on the deployment, the assistant must
// still be useful (and honest). This module provides a deterministic intent
// router that maps the user's question to the SAME real tool registry the LLM
// would have called, executes those tools for real against the database, and
// composes a narrative strictly from the tool results.
//
// It never invents facts: every number in the answer comes from a tool
// summary or tool payload that was actually read from the database.

import { db } from "@/lib/db";
import { TOOL_HANDLERS } from "./tools";
import type { CopilotRequestContext } from "./types";
import type { ContentBlock, SourceReference } from "./types";

export interface OfflineCall {
  name: string;
  args: Record<string, unknown>;
}

export interface OfflineOutcome {
  calls: OfflineCall[];
  /** Entity the question was about, if one could be resolved. */
  entity: { type: string; name: string; id: string } | null;
}

/* ── keyword intent map ─────────────────────────────────────────────────────
   Ordered by specificity — the first matching intent wins. Each entry maps
   to one or more real tool calls with their real argument names. */

interface Intent {
  id: string;
  test: RegExp;
  calls: (reportingYear: string) => OfflineCall[];
}

const INTENTS: Intent[] = [
  {
    id: "brsr_completeness",
    test: /\bbrsr\b|business responsibility|sustainability report/i,
    calls: (period) => [{ name: "get_brsr_completeness", args: { period } }],
  },
  {
    id: "compare_subsidiaries",
    test: /compare|comparison|versus|\bvs\b|which subsidiary|best performing|worst performing|all subsidiaries/i,
    calls: (period) => [
      { name: "compare_entities", args: { metric: "submissions" } },
      { name: "get_group_performance", args: { period } },
    ],
  },
  {
    id: "deadlines",
    test: /deadline|overdue|due soon|due date|timeline|late/i,
    calls: (period) => [{ name: "get_deadline_summary", args: { period } }],
  },
  {
    id: "pending_approvals",
    test: /pending|awaiting|waiting|in review|approval|approve|review queue|backlog/i,
    calls: (period) => [
      { name: "get_submissions", args: { status: "SUBMITTED", period, limit: 25 } },
      { name: "get_submissions", args: { status: "UNDER_REVIEW", period, limit: 25 } },
    ],
  },
  {
    id: "missing_evidence",
    test: /evidence|missing data|data gap|incomplete|completeness|gap/i,
    calls: (period) => [{ name: "get_missing_evidence", args: { period, limit: 25 } }],
  },
  {
    id: "compliance",
    test: /complian|violation|validation issue|anomal|non-?conform/i,
    calls: (period) => [{ name: "get_compliance_summary", args: { period } }],
  },
  {
    id: "completion",
    test: /readiness|package readiness|reporting completion|how ready/i,
    calls: (period) => [{ name: "get_reporting_completion", args: { period } }],
  },
  {
    id: "activity",
    test: /activity|who did|recent action|audit trail|log of|what happened/i,
    calls: () => [{ name: "get_recent_activity", args: { limit: 20 } }],
  },
  {
    id: "users",
    test: /\busers?\b|employees|headcount|head count|people|who reports/i,
    calls: () => [{ name: "list_users", args: { limit: 50 } }],
  },
  {
    id: "projects",
    test: /projects?|sites?|portfolio/i,
    calls: () => [{ name: "list_projects", args: { limit: 50 } }],
  },
  {
    id: "subsidiaries",
    test: /subsidiar|group entities|organization|organisation/i,
    calls: () => [{ name: "list_subsidiaries", args: { limit: 50 } }],
  },
  {
    id: "submissions",
    test: /submission|disclosure|ledger|records|data entries/i,
    calls: (period) => [{ name: "get_submissions", args: { period, limit: 30 } }],
  },
  {
    id: "performance",
    test: /performance|group |overall|summary of the group|analy[sz]e|status of/i,
    calls: (period) => [{ name: "get_group_performance", args: { period } }],
  },
];

/* ── entity detection (real DB lookup, no guessing) ────────────────────────── */

interface EntityHit {
  type: "subsidiary" | "business_unit" | "project" | "user";
  name: string;
  id: string;
  length: number;
}

/* Words too common to identify an entity on their own. */
const STOP_WORDS = new Set([
  "meil", "group", "core", "ltd", "limited", "india", "project", "projects",
  "subsidiary", "the", "and", "for", "with", "all", "any", "how", "what", "who",
  "many", "much", "show", "list", "tell", "give", "please", "report", "reports",
  "submission", "submissions", "status", "data", "review", "current",
]);

/** Distinctive tokens of a name — e.g. "Kaleshwaram Lift Irrigation Package-06 & 08" → kaleshwaram, irrigation. */
function distinctiveTokens(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 5 && !STOP_WORDS.has(t) && !/^\d+$/.test(t));
}

async function detectEntity(userText: string): Promise<EntityHit | null> {
  const text = userText.toLowerCase();
  if (text.length < 4) return null;

  const [subsidiaries, units, projects, users] = await Promise.all([
    db.subsidiary.findMany({ select: { id: true, name: true } }),
    db.businessUnit.findMany({ select: { id: true, name: true } }),
    db.project.findMany({ select: { id: true, name: true } }),
    db.user.findMany({ select: { id: true, name: true } }),
  ]);

  const hits: EntityHit[] = [];
  const push = (type: EntityHit["type"], id: string, name: string) => {
    const n = name.trim();
    if (n.length < 4) return;
    const lower = n.toLowerCase();
    let score = 0;
    /* Full name mentioned → strongest signal. */
    if (text.includes(lower)) {
      score = lower.length + 100;
    } else {
      /* Otherwise a distinctive token of the name ("kaleshwaram") matches. */
      const tokens = distinctiveTokens(n);
      const matched = tokens.filter((t) => text.includes(t));
      if (matched.length === 0) return;
      /* Require the most distinctive token of the name to be present. */
      const best = matched.sort((a, b) => b.length - a.length)[0];
      score = best.length + matched.length;
    }
    hits.push({ type, id, name: n, length: score });
  };
  for (const s of subsidiaries) push("subsidiary", s.id, s.name);
  for (const u of units) push("business_unit", u.id, u.name);
  for (const p of projects) push("project", p.id, p.name);
  for (const u of users) push("user", u.id, u.name);

  /* Highest score wins — a project name contains its business unit's words. */
  hits.sort((a, b) => b.length - a.length);
  return hits[0] ?? null;
}

function profileCall(entity: EntityHit): OfflineCall {
  switch (entity.type) {
    case "subsidiary":
      return { name: "get_subsidiary_profile", args: { subsidiaryId: entity.id } };
    case "business_unit":
      return { name: "get_business_unit_profile", args: { businessUnitId: entity.id } };
    case "project":
      return { name: "get_project_profile", args: { projectId: entity.id } };
    default:
      return { name: "get_user_profile", args: { userId: entity.id } };
  }
}

/* ── plan ─────────────────────────────────────────────────────────────────── */

export async function planOffline(userText: string, reportingYear: string): Promise<OfflineOutcome> {
  const entity = await detectEntity(userText);

  /* An entity-specific question is answered from that entity's own profile. */
  if (entity) {
    const calls: OfflineCall[] = [profileCall(entity)];
    /* A "submissions of X" question also needs the ledger for that scope. */
    if (entity.type === "subsidiary") {
      calls.push({ name: "get_submissions", args: { subsidiaryId: entity.id, period: reportingYear, limit: 25 } });
    } else if (entity.type === "project") {
      calls.push({ name: "get_submissions", args: { projectId: entity.id, period: reportingYear, limit: 25 } });
    }
    return { calls, entity: { type: entity.type, name: entity.name, id: entity.id } };
  }

  for (const intent of INTENTS) {
    if (intent.test.test(userText)) {
      return { calls: intent.calls(reportingYear), entity: null };
    }
  }

  /* No intent matched — give the broadest honest view of the group. */
  return {
    calls: [
      { name: "get_group_performance", args: { period: reportingYear } },
      { name: "get_reporting_completion", args: { period: reportingYear } },
    ],
    entity: null,
  };
}

/* ── execute + compose ────────────────────────────────────────────────────── */

export interface OfflineExecution {
  text: string;
  blocks: ContentBlock[];
  sources: SourceReference[];
  /** Per-tool outcome for the activity panel. */
  runs: { name: string; summary: string; error?: string }[];
}

const FRIENDLY_TOOL: Record<string, string> = {
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
};

export async function executeOffline(
  plan: OfflineOutcome,
  ctx: CopilotRequestContext,
  onActivity?: (run: { name: string; label: string; status: "RUNNING" | "COMPLETED" | "FAILED"; summary?: string; error?: string }) => void
): Promise<OfflineExecution> {
  const blocks: ContentBlock[] = [];
  const sources: SourceReference[] = [];
  const runs: { name: string; summary: string; error?: string }[] = [];

  for (const call of plan.calls) {
    const handler = TOOL_HANDLERS[call.name];
    const label = FRIENDLY_TOOL[call.name] ?? call.name;
    if (!handler) {
      runs.push({ name: call.name, summary: "Tool not available.", error: "unknown_tool" });
      onActivity?.({ name: call.name, label, status: "FAILED", error: "Unknown tool" });
      continue;
    }
    onActivity?.({ name: call.name, label, status: "RUNNING" });
    try {
      const result = await handler(call.args, ctx);
      runs.push({ name: call.name, summary: result.summary, error: result.error });
      for (const b of result.blocks ?? []) {
        if (!blocks.some((x) => JSON.stringify(x) === JSON.stringify(b))) blocks.push(b);
      }
      for (const s of result.sources ?? []) {
        if (!sources.some((x) => x.id === s.id && x.kind === s.kind)) sources.push(s);
      }
      onActivity?.({
        name: call.name,
        label,
        status: result.error ? "FAILED" : "COMPLETED",
        summary: result.summary,
        error: result.error,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Tool failed";
      runs.push({ name: call.name, summary: msg, error: msg });
      onActivity?.({ name: call.name, label, status: "FAILED", error: msg });
    }
  }

  return { text: composeNarrative(plan, runs, blocks), blocks, sources, runs };
}

/** The narrative is built ONLY from tool summaries — no generated claims. */
function composeNarrative(
  plan: OfflineOutcome,
  runs: { name: string; summary: string; error?: string }[],
  blocks: ContentBlock[]
): string {
  const ok = runs.filter((r) => !r.error && r.summary);
  const failed = runs.filter((r) => r.error);

  if (ok.length === 0) {
    return [
      "### No matching records found",
      "",
      "The platform tools ran but returned nothing for this question, so there is no grounded answer to give.",
      failed.length ? "" : null,
      failed.length ? `**Tool notes:** ${failed.map((f) => f.summary).join("; ")}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }

  const lines: string[] = [];

  if (plan.entity) {
    lines.push(`### ${plan.entity.name}`);
    lines.push("");
    lines.push(`Retrieved the live ${plan.entity.type.replace("_", " ")} record from the platform.`);
  } else {
    lines.push("### What the platform records show");
    lines.push("");
  }

  lines.push("");
  for (const r of ok) {
    lines.push(`- ${r.summary}`);
  }

  /* Surface the strongest structured signal from the blocks. */
  const kpi = blocks.find((b) => b.type === "kpi") as Extract<ContentBlock, { type: "kpi" }> | undefined;
  if (kpi?.items?.length) {
    lines.push("");
    lines.push("**Key figures**");
    for (const item of kpi.items.slice(0, 8)) {
      lines.push(`- **${item.label}**: ${item.value}${item.hint ? ` — ${item.hint}` : ""}`);
    }
  }

  const comparison = blocks.find((b) => b.type === "comparison") as
    | Extract<ContentBlock, { type: "comparison" }>
    | undefined;
  if (comparison?.entityLabels?.length) {
    lines.push("");
    lines.push(`**${comparison.title ?? "Comparison"}**`);
    for (const metric of comparison.metrics ?? []) {
      const pairs = comparison.entityLabels.map((label, i) => `${label}: ${metric.values[i]}`);
      lines.push(`- ${metric.label} — ${pairs.join(" · ")}`);
    }
  }

  if (failed.length) {
    lines.push("");
    lines.push(`**Notes:** ${failed.map((f) => f.summary).join("; ")}`);
  }

  lines.push("");
  lines.push(
    "_Read from the live platform records via the grounded tool registry — no AI provider is configured on this deployment, so this answer is composed directly from the retrieved data._"
  );

  return lines.join("\n");
}
