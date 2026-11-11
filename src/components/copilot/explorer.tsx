"use client";

// MEIL Intelligence — Smart Explorer (Phase 9).
// Guided, database-driven discovery across 12 categories: pick a category,
// narrow the scope through the real Subsidiary → BU → Project cascade, then
// browse a server-filtered, paginated result table. "Analyze with AI" hands
// the exact current scope to the copilot as a chat prompt — no fabricated data.

import * as React from "react";
import {
  Building2, Landmark, Boxes, Users, FileStack, CheckCircle2, FileCheck2, History,
  Clock, BarChart3, ScrollText, ShieldCheck, ChevronRight, ChevronLeft, Search,
  ArrowLeft, Sparkles, Inbox,
} from "lucide-react";
import { copilotApi, type ExplorerOption, type ExplorerResults } from "@/lib/copilot/client";
import { useCopilot } from "@/lib/copilot/store";

type Category =
  | "subsidiaries" | "business_units" | "projects" | "users" | "submissions" | "approvals"
  | "evidence" | "activities" | "deadlines" | "analytics" | "brsr" | "compliance";

const CATEGORIES: { id: Category; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: "subsidiaries", label: "Subsidiaries", icon: Building2 },
  { id: "business_units", label: "Business Units", icon: Landmark },
  { id: "projects", label: "Projects & Sites", icon: Boxes },
  { id: "users", label: "Users", icon: Users },
  { id: "submissions", label: "Submissions", icon: FileStack },
  { id: "approvals", label: "Approvals", icon: CheckCircle2 },
  { id: "evidence", label: "Evidence", icon: FileCheck2 },
  { id: "activities", label: "Activity", icon: History },
  { id: "deadlines", label: "Deadlines", icon: Clock },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "brsr", label: "BRSR Reports", icon: ScrollText },
  { id: "compliance", label: "Compliance", icon: ShieldCheck },
];

const SCOPED: Category[] = ["submissions", "approvals", "deadlines", "users", "compliance", "analytics", "evidence"];
const BU_SCOPED: Category[] = ["submissions", "approvals", "deadlines", "users", "compliance"];
const PROJECT_SCOPED: Category[] = ["submissions", "deadlines", "users"];
const PERIOD_SCOPED: Category[] = ["submissions", "deadlines", "compliance", "analytics", "brsr", "approvals"];

const STATUS_OPTIONS: Partial<Record<Category, string[]>> = {
  submissions: ["DRAFT", "ASSIGNED", "SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED", "REJECTED", "APPROVED"],
  approvals: ["SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED", "APPROVED", "REJECTED"],
  users: ["ACTIVE", "SUSPENDED", "INACTIVE", "INVITED"],
  evidence: ["PENDING", "VERIFIED", "REJECTED"],
  compliance: ["HIGH", "MEDIUM", "LOW"], // severity filter for open validation issues
};

const PAGE_SIZE = 25;

function labelForCategory(c: Category): string {
  return CATEGORIES.find((x) => x.id === c)?.label ?? c;
}

export function CopilotExplorer({ onBack }: { onBack?: () => void }) {
  const reportingYear = useCopilot((s) => s.reportingYear);

  const [category, setCategory] = React.useState<Category>("subsidiaries");
  const [subsidiaryId, setSubsidiaryId] = React.useState<string | undefined>();
  const [subsidiaryLabel, setSubsidiaryLabel] = React.useState<string | undefined>();
  const [businessUnitId, setBusinessUnitId] = React.useState<string | undefined>();
  const [businessUnitLabel, setBusinessUnitLabel] = React.useState<string | undefined>();
  const [projectId, setProjectId] = React.useState<string | undefined>();
  const [projectLabel, setProjectLabel] = React.useState<string | undefined>();
  const [period, setPeriod] = React.useState<string | undefined>(undefined);
  const [status, setStatus] = React.useState<string | undefined>();
  const [query, setQuery] = React.useState("");

  const [subsOptions, setSubsOptions] = React.useState<ExplorerOption[]>([]);
  const [buOptions, setBuOptions] = React.useState<ExplorerOption[]>([]);
  const [projOptions, setProjOptions] = React.useState<ExplorerOption[]>([]);
  const [periodOptions, setPeriodOptions] = React.useState<ExplorerOption[]>([]);

  const [results, setResults] = React.useState<ExplorerResults | null>(null);
  const [offset, setOffset] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [cascadeLoading, setCascadeLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  /* reset scope whenever the category changes */
  const switchCategory = (c: Category) => {
    setCategory(c);
    setSubsidiaryId(undefined); setSubsidiaryLabel(undefined);
    setBusinessUnitId(undefined); setBusinessUnitLabel(undefined);
    setProjectId(undefined); setProjectLabel(undefined);
    setStatus(undefined); setQuery("");
    setOffset(0); setResults(null); setErr(null);
  };

  /* cascade options — loaded lazily, always real entities */
  React.useEffect(() => {
    let alive = true;
    setCascadeLoading(true);
    (async () => {
      try {
        const [subs, bus, projs, periods] = await Promise.all([
          copilotApi.cascade("subsidiaries", {}),
          subsidiaryId ? copilotApi.cascade("business_units", { subsidiaryId }) : Promise.resolve({ options: [] }),
          businessUnitId ? copilotApi.cascade("projects", { subsidiaryId, businessUnitId }) : Promise.resolve({ options: [] }),
          PERIOD_SCOPED.includes(category) ? copilotApi.cascade("periods", {}) : Promise.resolve({ options: [] }),
        ]);
        if (!alive) return;
        setSubsOptions(subs.options);
        setBuOptions(bus.options);
        setProjOptions(projs.options);
        setPeriodOptions(periods.options);
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : "Failed to load explorer scope.");
      } finally {
        if (alive) setCascadeLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [category, subsidiaryId, businessUnitId]);

  /* results — server-filtered and paginated */
  const loadResults = React.useCallback(async (currentOffset: number) => {
    setLoading(true);
    setErr(null);
    try {
      const r = await copilotApi.explorerResults(category, {
        subsidiaryId, businessUnitId, projectId, period, status, q: query.trim() || undefined,
        limit: PAGE_SIZE, offset: currentOffset,
      });
      setResults(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load results.");
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, [category, subsidiaryId, businessUnitId, projectId, period, status, query]);

  React.useEffect(() => {
    void loadResults(offset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, subsidiaryId, businessUnitId, projectId, period, status, offset]);

  const navigate = (view: string, detailId?: string) => {
    import("@/lib/esg/store").then(({ useWorkspace }) => {
      useWorkspace.getState().navigate(view as never, detailId ? { detailId } : {});
    }).catch(() => undefined);
  };

  const analyze = () => {
    const parts: string[] = [`Analyze the ${labelForCategory(category).toLowerCase()} data`];
    if (subsidiaryLabel) parts.push(`for subsidiary ${subsidiaryLabel}`);
    if (businessUnitLabel) parts.push(`business unit ${businessUnitLabel}`);
    if (projectLabel) parts.push(`project ${projectLabel}`);
    if (period) parts.push(`period ${period}`);
    if (status) parts.push(`status/severity ${status}`);
    if (query.trim()) parts.push(`matching "${query.trim()}"`);
    if (results) parts.push(`(${results.total} total records found)`);
    parts.push("— summarize key findings, risks and recommended next actions.");
    const prompt = parts.join(" ");
    void (async () => {
      const s = useCopilot.getState();
      if (!s.conversationId) await s.newConversation(reportingYear);
      const st = useCopilot.getState();
      st.sendMessage(prompt, st.reportingYear, "intelligence");
    })();
    onBack?.();
  };

  const total = results?.total ?? 0;
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <div className="mc-explorer">
      {onBack ? (
        <button className="mc-chip-btn" style={{ marginBottom: 10 }} onClick={onBack}>
          <ArrowLeft size={12} /> Back to chat
        </button>
      ) : null}

      {/* category chips */}
      <div className="mc-explorer-cats">
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          return (
            <button key={c.id} className={`mc-cat-chip ${category === c.id ? "active" : ""}`} onClick={() => switchCategory(c.id)}>
              <Icon size={13} /> {c.label}
            </button>
          );
        })}
      </div>

      {/* breadcrumb */}
      <div className="mc-breadcrumb">
        <button onClick={() => switchCategory(category)}>{labelForCategory(category)}</button>
        {subsidiaryLabel ? (<><ChevronRight size={12} /><button onClick={() => { setBusinessUnitId(undefined); setBusinessUnitLabel(undefined); setProjectId(undefined); setProjectLabel(undefined); setOffset(0); }}>{subsidiaryLabel}</button></>) : null}
        {businessUnitLabel ? (<><ChevronRight size={12} /><button onClick={() => { setProjectId(undefined); setProjectLabel(undefined); setOffset(0); }}>{businessUnitLabel}</button></>) : null}
        {projectLabel ? (<><ChevronRight size={12} /><span>{projectLabel}</span></>) : null}
      </div>

      {/* cascade selectors */}
      {SCOPED.includes(category) ? (
        <div className="mc-select-grid">
          <div>
            <div className="mc-select-label">Subsidiary</div>
            <div style={{ maxHeight: 148, overflowY: "auto", display: "grid", gap: 6, paddingRight: 4 }}>
              <button className={`mc-select-card ${!subsidiaryId ? "selected" : ""}`} onClick={() => { setSubsidiaryId(undefined); setSubsidiaryLabel(undefined); setBusinessUnitId(undefined); setBusinessUnitLabel(undefined); setProjectId(undefined); setProjectLabel(undefined); setOffset(0); }}>
                All subsidiaries
              </button>
              {subsOptions.map((o) => (
                <button key={o.value} className={`mc-select-card ${subsidiaryId === o.value ? "selected" : ""}`} onClick={() => { setSubsidiaryId(o.value); setSubsidiaryLabel(o.label); setBusinessUnitId(undefined); setBusinessUnitLabel(undefined); setProjectId(undefined); setProjectLabel(undefined); setOffset(0); }}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          {subsidiaryId && BU_SCOPED.includes(category) ? (
            <div>
              <div className="mc-select-label">Business unit</div>
              <div style={{ maxHeight: 148, overflowY: "auto", display: "grid", gap: 6, paddingRight: 4 }}>
                <button className={`mc-select-card ${!businessUnitId ? "selected" : ""}`} onClick={() => { setBusinessUnitId(undefined); setBusinessUnitLabel(undefined); setProjectId(undefined); setProjectLabel(undefined); setOffset(0); }}>
                  All units
                </button>
                {buOptions.map((o) => (
                  <button key={o.value} className={`mc-select-card ${businessUnitId === o.value ? "selected" : ""}`} onClick={() => { setBusinessUnitId(o.value); setBusinessUnitLabel(o.label); setProjectId(undefined); setProjectLabel(undefined); setOffset(0); }}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {businessUnitId && PROJECT_SCOPED.includes(category) ? (
            <div>
              <div className="mc-select-label">Project / Site</div>
              <div style={{ maxHeight: 148, overflowY: "auto", display: "grid", gap: 6, paddingRight: 4 }}>
                <button className={`mc-select-card ${!projectId ? "selected" : ""}`} onClick={() => { setProjectId(undefined); setProjectLabel(undefined); setOffset(0); }}>
                  All projects
                </button>
                {projOptions.map((o) => (
                  <button key={o.value} className={`mc-select-card ${projectId === o.value ? "selected" : ""}`} onClick={() => { setProjectId(o.value); setProjectLabel(o.label); setOffset(0); }}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {periodOptions.length ? (
            <div>
              <div className="mc-select-label">Period</div>
              <div style={{ display: "grid", gap: 6 }}>
                <button className={`mc-select-card ${!period ? "selected" : ""}`} onClick={() => { setPeriod(undefined); setOffset(0); }}>
                  All periods
                </button>
                {periodOptions.map((o) => (
                  <button key={o.value} className={`mc-select-card ${period === o.value ? "selected" : ""}`} onClick={() => { setPeriod(o.value); setOffset(0); }}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {STATUS_OPTIONS[category] ? (
            <div>
              <div className="mc-select-label">{category === "compliance" ? "Severity" : "Status"}</div>
              <div style={{ display: "grid", gap: 6 }}>
                <button className={`mc-select-card ${!status ? "selected" : ""}`} onClick={() => { setStatus(undefined); setOffset(0); }}>
                  Any
                </button>
                {STATUS_OPTIONS[category]!.map((s) => (
                  <button key={s} className={`mc-select-card ${status === s ? "selected" : ""}`} onClick={() => { setStatus(s); setOffset(0); }}>
                    {s.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* search + analyze */}
      <div style={{ display: "flex", gap: 9, marginBottom: 14, flexWrap: "wrap" }}>
        <div className="mc-composer" style={{ flex: "1 1 240px", padding: "7px 8px 7px 14px", alignItems: "center" }}>
          <Search size={14} style={{ color: "var(--mc-muted)", flexShrink: 0 }} />
          <input
            className="mc-composer-input"
            style={{ fontSize: 12.5 }}
            placeholder="Search this category…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { setOffset(0); void loadResults(0); } }}
            aria-label={`Search ${labelForCategory(category)}`}
          />
          <button className="mc-chip-btn" onClick={() => { setOffset(0); void loadResults(0); }} disabled={loading || cascadeLoading}>
            Search
          </button>
        </div>
        <button className="mc-rec-action-btn" style={{ borderRadius: 22 }} onClick={analyze} disabled={loading}>
          <Sparkles size={13} /> Analyze with AI
        </button>
      </div>

      {/* results */}
      {err ? (
        <div className="mc-msg-error-note">{err}</div>
      ) : loading ? (
        <div style={{ fontSize: 12.5, color: "var(--mc-muted)", padding: "30px 0", textAlign: "center" }}>Loading results…</div>
      ) : !results || results.rows.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "var(--mc-muted)", padding: "30px 0", textAlign: "center" }}>
          <Inbox size={18} style={{ verticalAlign: "-4px", marginRight: 6 }} />
          No records match this scope.
        </div>
      ) : (
        <>
          <div className="mc-table-wrap">
            <table className="mc-table">
              <thead>
                <tr>
                  {results.columns.map((c) => (
                    <th key={c.key} className={c.align === "right" ? "mc-th-right" : undefined}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.rows.map((r) => (
                  <tr
                    key={r.id}
                    style={r.nav ? { cursor: "pointer" } : undefined}
                    onClick={() => r.nav && navigate(r.nav.view, r.nav.detailId)}
                    title={r.nav ? "Open record in the workspace" : undefined}
                  >
                    {results!.columns.map((c) => (
                      <td key={c.key} className={c.align === "right" ? "mc-td-right" : undefined}>{r.cells[c.key] ?? "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: "var(--mc-muted)" }}>
              {total} record{total === 1 ? "" : "s"} · page {page} of {pages}
            </span>
            <div style={{ display: "flex", gap: 7 }}>
              <button className="mc-chip-btn" disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(offset - PAGE_SIZE, 0))}>
                <ChevronLeft size={12} /> Previous
              </button>
              <button className="mc-chip-btn" disabled={offset + PAGE_SIZE >= total || loading} onClick={() => setOffset(offset + PAGE_SIZE)}>
                Next <ChevronRight size={12} />
              </button>
            </div>
          </div>
          {results.comparison ? (
            <div className="mc-block-note" style={{ marginTop: 8 }}>
              Tip: click “Analyze with AI” for a comparative narrative across these entities.
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
