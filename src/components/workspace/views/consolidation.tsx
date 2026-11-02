"use client";

// ── SCREEN 14 — Data Consolidation & Validation ──
import * as React from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  CopyX,
  FileSearch,
  Filter,
  GitBranch,
  ListChecks,
  PackageX,
  Send,
  Table2,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/esg/store";
import { fmtDate, fmtNumber, useApi } from "@/lib/esg/client";
import type { ConsolidationData } from "@/lib/esg/types";
import {
  Chip,
  EmptyState,
  ErrorState,
  GlassCard,
  KpiCard,
  LoadingBlock,
  PageHeader,
  SectionCard,
  StatusBadge,
  GlassTabBar,
  DataTable,
  type Column,
} from "../ui";

const C = { blue: "#3a7bff", purple: "#6a5bff", teal: "#16a3a3", green: "#238653", amber: "#c57926", red: "#c34a4a" };

function ChartTip({ active, payload, label }: { active?: boolean; payload?: { name?: string | number; value?: number | string; color?: string }[]; label?: string | number }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-strong rounded-2xl border-white/70 px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-semibold text-[color:var(--ink)]">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-[color:var(--ink-soft)]">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span>{p.name}:</span>
          <span className="tabular font-medium">{typeof p.value === "number" ? fmtNumber(p.value, 1) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

type MissingRow = ConsolidationData["missing"][number] & { id: string };
type AnomalyRow = ConsolidationData["anomalies"][number] & { id: string };
type LineageRow = ConsolidationData["lineage"][number] & { id: string };
type AggRow = ConsolidationData["aggregation"][number] & { id: string };

const STATUS_DOTS: { label: string; color: string; text: string }[] = [
  { label: "Draft — being prepared by data users", color: "#8595ab", text: "Not eligible. Stays with the contributor until submitted." },
  { label: "Submitted — awaiting reviewer pickup", color: C.blue, text: "Eligible for validation, not yet for consolidation." },
  { label: "Under review — reviewer is checking evidence", color: C.purple, text: "Eligible for validation, not yet for consolidation." },
  { label: "Approved — cleared by the reviewer", color: C.green, text: "Eligible. This is the only status that enters consolidated values." },
  { label: "Consolidated — aggregated into BRSR disclosures", color: C.teal, text: "Approved values after boundary-aware aggregation." },
];

export default function ConsolidationView() {
  const { navigate } = useWorkspace();
  const { data, loading, error, refetch } = useApi<ConsolidationData>("/api/esg/consolidation");
  const [tab, setTab] = React.useState("overview");

  const missing: MissingRow[] = React.useMemo(() => (data?.missing ?? []).map((m, i) => ({ ...m, id: `miss-${i}` })), [data]);
  const anomalies: AnomalyRow[] = React.useMemo(() => (data?.anomalies ?? []).map((a, i) => ({ ...a, id: `anom-${i}` })), [data]);
  const lineage: LineageRow[] = React.useMemo(() => (data?.lineage ?? []).map((l, i) => ({ ...l, id: `lin-${i}` })), [data]);
  const aggregation: AggRow[] = React.useMemo(() => (data?.aggregation ?? []).map((a, i) => ({ ...a, id: `agg-${i}` })), [data]);

  const ladder = React.useMemo(() => {
    const s1 = data?.aggregation.find((a) => a.label.startsWith("Scope 1"));
    const s2 = data?.aggregation.find((a) => a.label.startsWith("Scope 2"));
    if (!s1 || !s2) return [];
    return [
      { stage: "Raw", value: +(s1.raw + s2.raw).toFixed(1) },
      { stage: "Validated", value: +(s1.validated + s2.validated).toFixed(1) },
      { stage: "Approved", value: +(s1.approved + s2.approved).toFixed(1) },
      { stage: "Consolidated", value: +(s1.consolidated + s2.consolidated).toFixed(1) },
    ];
  }, [data]);

  const jump = (t: string) => {
    setTab(t);
    document.getElementById("consolidation-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const missingCols: Column<MissingRow>[] = [
    { key: "project", header: "Project", render: (r) => (
      <div>
        <div className="font-medium text-[color:var(--ink)]">{r.projectName}</div>
        <div className="font-mono text-[11px] text-[color:var(--ink-faint)]">{r.projectCode}</div>
      </div>
    ) },
    { key: "category", header: "Category", render: (r) => <Chip tone="blue">{r.category}</Chip> },
    { key: "metric", header: "Missing metric", render: (r) => <span className="text-[color:var(--ink-soft)]">{r.metric}</span> },
    { key: "frequency", header: "Frequency", render: (r) => <Chip tone="gray">{r.frequency}</Chip> },
    { key: "last", header: "Last approved", render: (r) => <span className="text-xs text-[color:var(--ink-faint)]">{r.lastSubmitted ? fmtDate(r.lastSubmitted) : "never"}</span> },
  ];

  const anomalyCols: Column<AnomalyRow>[] = [
    { key: "ref", header: "Ref", sortable: true, sortValue: (r) => r.ref, render: (r) => <span className="font-mono text-xs text-[color:var(--ink-soft)]">{r.ref}</span> },
    { key: "title", header: "Submission", render: (r) => <span className="block max-w-[220px] truncate font-medium text-[color:var(--ink)]">{r.title}</span> },
    { key: "metric", header: "Metric", render: (r) => <span className="text-[color:var(--ink-soft)]">{r.metricName}</span> },
    { key: "value", header: "Value", render: (r) => <span className="tabular font-medium text-[color:var(--ink)]">{fmtNumber(r.metricValue, 2)} {r.metricUnit}</span> },
    { key: "expected", header: "Expected", render: (r) => <span className="text-xs text-[color:var(--ink-faint)]">{r.expected}</span> },
    {
      key: "dev",
      header: "Deviation",
      sortable: true,
      sortValue: (r) => r.deviationPct,
      render: (r) => (
        <div className="flex items-center gap-2">
          <StatusBadge status={r.severity} />
          <span className="tabular text-xs font-medium text-[color:var(--ink-soft)]">{r.deviationPct}%</span>
        </div>
      ),
    },
  ];

  const lineageCols: Column<LineageRow>[] = [
    { key: "ref", header: "Ref", sortable: true, sortValue: (r) => r.ref, render: (r) => <span className="font-mono text-xs text-[color:var(--ink-soft)]">{r.ref}</span> },
    { key: "title", header: "Submission", render: (r) => <span className="block max-w-[220px] truncate font-medium text-[color:var(--ink)]">{r.title}</span> },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "org", header: "Organization", render: (r) => <span className="text-[color:var(--ink-soft)]">{r.org || "—"}</span> },
    { key: "period", header: "Period", render: (r) => <Chip tone="gray">{r.period}</Chip> },
    { key: "evidence", header: "Evidence", sortable: true, sortValue: (r) => r.evidenceCount, render: (r) => <span className="tabular text-[color:var(--ink-soft)]">{r.evidenceCount} file{r.evidenceCount === 1 ? "" : "s"}</span> },
    {
      key: "used",
      header: "Used in reports",
      render: (r) =>
        r.usedInReports.length ? (
          <div className="flex flex-wrap gap-1">
            {r.usedInReports.map((u) => (
              <Chip key={u} tone="green">
                {u}
              </Chip>
            ))}
          </div>
        ) : (
          <span className="text-xs text-[color:var(--ink-faint)]">not yet used</span>
        ),
    },
  ];

  const aggCols: Column<AggRow>[] = [
    { key: "label", header: "Metric", render: (r) => <span className="font-medium text-[color:var(--ink)]">{r.label}</span> },
    { key: "raw", header: "Raw", sortable: true, sortValue: (r) => r.raw, render: (r) => <span className="tabular text-[color:var(--ink-soft)]">{fmtNumber(r.raw, 1)}</span> },
    { key: "validated", header: "Validated", sortable: true, sortValue: (r) => r.validated, render: (r) => <span className="tabular text-[#5546d6]">{fmtNumber(r.validated, 1)}</span> },
    { key: "approved", header: "Approved", sortable: true, sortValue: (r) => r.approved, render: (r) => <span className="tabular font-medium text-[#1d6b40]">{fmtNumber(r.approved, 1)}</span> },
    { key: "consolidated", header: "Consolidated", sortable: true, sortValue: (r) => r.consolidated, render: (r) => <span className="tabular font-semibold text-[color:var(--ink)]">{fmtNumber(r.consolidated, 1)}</span> },
  ];

  return (
    <div className="view-in space-y-5">
      <PageHeader
        title="Data Consolidation & Validation"
        description="Boundary-aware aggregation health: missing data, duplicates, anomalies, lineage, and the eligibility ladder."
        icon={Filter}
        breadcrumbs={["Group", "BRSR Reporting", "Consolidation & Validation"]}
      />

      {error ? (
        <GlassCard>
          <ErrorState message={error} onRetry={() => refetch()} />
        </GlassCard>
      ) : loading ? (
        <GlassCard>
          <LoadingBlock rows={6} label="Analyzing consolidation pipeline…" />
        </GlassCard>
      ) : !data ? null : (
        <>
          {/* KPI strip — clickable anchors */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
            <KpiCard label="Total records" value={data.summary.totalRecords} icon={ClipboardList} tone="blue" hint="All submissions in the register" onClick={() => jump("overview")} />
            <KpiCard label="Approved" value={data.summary.approved} icon={CheckCircle2} tone="green" hint="Eligible for consolidation" onClick={() => jump("overview")} />
            <KpiCard label="Pending" value={data.summary.pending} icon={FileSearch} tone="purple" hint="Submitted / under review" onClick={() => jump("overview")} />
            <KpiCard label="Missing" value={data.summary.missing} icon={PackageX} tone={data.summary.missing ? "red" : "green"} hint="Expected but not submitted" onClick={() => jump("missing")} />
            <KpiCard label="Duplicates" value={data.summary.duplicates} icon={CopyX} tone={data.summary.duplicates ? "amber" : "green"} hint="Same metric · org · period" onClick={() => jump("duplicates")} />
            <KpiCard label="Anomalies" value={data.summary.anomalies} icon={AlertTriangle} tone={data.summary.anomalies ? "amber" : "green"} hint="Deviation vs median > 25%" onClick={() => jump("anomalies")} />
            <KpiCard label="Exceptions" value={data.summary.exceptions} icon={ListChecks} tone={data.summary.exceptions ? "red" : "green"} hint="Rejected / changes requested" onClick={() => jump("anomalies")} />
          </div>

          <GlassTabBar
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "overview", label: "Overview", icon: BarChart3 },
              { value: "missing", label: "Missing data", icon: PackageX, count: data.summary.missing },
              { value: "duplicates", label: "Duplicates", icon: CopyX, count: data.summary.duplicates },
              { value: "anomalies", label: "Anomalies", icon: AlertTriangle, count: data.summary.anomalies },
              { value: "lineage", label: "Lineage", icon: GitBranch, count: data.lineage.length },
              { value: "aggregation", label: "Aggregation", icon: Table2 },
            ]}
          />

          <div id="consolidation-panel" className="scroll-mt-24">
            {tab === "overview" && (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
                <SectionCard title="Eligibility ladder — Scope 1 + Scope 2 GHG" description="How the same underlying data looks at each pipeline stage (tCO2e)." icon={BarChart3} className="xl:col-span-3">
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ladder} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(125,177,216,0.3)" />
                        <XAxis dataKey="stage" tick={{ fontSize: 12, fill: "var(--ink-soft)" }} stroke="rgba(125,177,216,0.5)" />
                        <YAxis tick={{ fontSize: 11, fill: "var(--ink-faint)" }} stroke="rgba(125,177,216,0.5)" width={64} />
                        <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(58,123,255,0.06)" }} />
                        <Bar dataKey="value" name="tCO2e" fill={C.blue} radius={[8, 8, 0, 0]} maxBarSize={72} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="mt-2 text-xs text-[color:var(--ink-faint)]">
                    Stages never silently equal: raw includes unreviewed values, validation applies factor checks, consolidation uses explicit reporting boundaries — only approved data enters consolidated values.
                  </p>
                </SectionCard>
                <SectionCard title="Record eligibility explained" description="What each submission status means for consolidation." icon={ListChecks} className="xl:col-span-2">
                  <div className="flex flex-col gap-3">
                    {STATUS_DOTS.map((s) => (
                      <div key={s.label} className="flex items-start gap-2.5">
                        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                        <div>
                          <div className="text-[13px] font-medium text-[color:var(--ink)]">{s.label}</div>
                          <div className="text-xs text-[color:var(--ink-faint)]">{s.text}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              </div>
            )}

            {tab === "missing" && (
              <SectionCard title={`Missing data (${missing.length})`} description="Active projects missing an expected metric submission for the current period." icon={PackageX}>
                <DataTable
                  columns={missingCols}
                  rows={missing}
                  emptyTitle="No missing data"
                  emptyMessage="Every active project has its expected metrics in flight or approved."
                  rowActions={(r) => (
                    <Button variant="outline" size="sm" className="glass-subtle rounded-xl border-white/60" onClick={() => navigate("tasks", { create: Date.now() })}>
                      <Send className="mr-1.5 h-3.5 w-3.5" /> Assign follow-up task
                    </Button>
                  )}
                />
                <p className="mt-3 text-xs text-[color:var(--ink-faint)]">
                  Follow-up opens the task creator in the Tasks &amp; Deadlines center; prefill from this row is not wired in this demo — assignee and metric need to be set manually.
                </p>
              </SectionCard>
            )}

            {tab === "duplicates" && (
              <SectionCard title={`Duplicate groups (${data.duplicates.length})`} description="Same metric, organization, and period submitted more than once (non-draft)." icon={CopyX}>
                {data.duplicates.length === 0 ? (
                  <EmptyState icon={CheckCircle2} title="No duplicates detected" message="Every metric has a single non-draft record per org and period." />
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {data.duplicates.map((d, i) => (
                      <GlassCard key={i} subtle className="flex flex-col gap-3 p-4">
                        <div>
                          <div className="text-[13px] font-semibold text-[color:var(--ink)]">{d.title}</div>
                          <div className="mt-0.5 text-xs text-[color:var(--ink-faint)]">
                            {d.org || "Group level"} · {d.metric}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {d.values.map((v, j) => (
                            <Chip key={j} tone="amber">
                              {fmtNumber(v, 2)}
                            </Chip>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-1 font-mono text-[10px] text-[color:var(--ink-faint)]">
                          {d.ids.map((id) => (
                            <span key={id} className="rounded bg-black/5 px-1.5 py-0.5">
                              {id.slice(0, 10)}…
                            </span>
                          ))}
                        </div>
                        <Button variant="outline" size="sm" className="glass-subtle mt-auto rounded-xl border-white/60" onClick={() => navigate("submissions")}>
                          <FileSearch className="mr-1.5 h-3.5 w-3.5" /> Review in Submission Center
                        </Button>
                      </GlassCard>
                    ))}
                  </div>
                )}
              </SectionCard>
            )}

            {tab === "anomalies" && (
              <SectionCard title={`Statistical anomalies (${anomalies.length})`} description="Approved values deviating more than 25% from the metric median." icon={AlertTriangle}>
                <DataTable
                  columns={anomalyCols}
                  rows={anomalies}
                  emptyTitle="No anomalies detected"
                  emptyMessage="All approved values are within the expected deviation band."
                  rowActions={() => (
                    <Button variant="outline" size="sm" className="glass-subtle rounded-xl border-white/60" onClick={() => navigate("submissions")}>
                      <FileSearch className="mr-1.5 h-3.5 w-3.5" /> Open submissions
                    </Button>
                  )}
                />
              </SectionCard>
            )}

            {tab === "lineage" && (
              <SectionCard title={`Data lineage (${lineage.length})`} description="Which source records feed (or are queued to feed) BRSR reports." icon={GitBranch}>
                <DataTable
                  columns={lineageCols}
                  rows={lineage}
                  onRowClick={() => navigate("submissions")}
                  emptyTitle="No lineage records"
                  emptyMessage="Approved and under-review submissions will appear here."
                />
              </SectionCard>
            )}

            {tab === "aggregation" && (
              <SectionCard title="Aggregation ladder" description="Raw → validated → approved → consolidated for the five headline metrics." icon={Table2}>
                <DataTable columns={aggCols} rows={aggregation} emptyTitle="No aggregation data" pageSize={8} />
                <p className="mt-3 text-xs text-[color:var(--ink-faint)]">
                  Aggregation uses explicit consolidation boundaries; only approved data enters consolidated values. Raw and validated figures are shown for transparency and reconciliation, never for reporting.
                </p>
              </SectionCard>
            )}
          </div>
        </>
      )}
    </div>
  );
}
