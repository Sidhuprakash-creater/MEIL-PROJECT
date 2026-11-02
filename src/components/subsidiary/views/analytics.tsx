"use client";

// ── SUBSIDIARY ADMIN · SCREEN — ESG Analytics ──
// All series come live from /api/sa/analytics (computed from the subsidiary's
// real submission records). Recharts idioms mirror the Group analytics screen.
import * as React from "react";
import {
  AlarmClock, BarChart3, Layers, LineChart as LineChartIcon, ListChecks,
  ShieldAlert, TrendingUp,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line,
  LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendIcon } from "@/components/workspace/premium-icons";
import { useSaWorkspace } from "@/lib/sa/store";
import { fmtNumber, useSaApi } from "@/lib/sa/client";
import type { AnalyticsData } from "@/lib/sa/types";
import {
  Chip, EmptyState, ErrorState, ExportButton, GlassCard, LoadingBlock,
  PageHeader, SectionCard,
} from "@/components/workspace/ui";

/* status hues — aligned with the Command Center status cards */
const STATUS_HUE: Record<string, string> = {
  APPROVED: "#20a779", SUBMITTED: "#3a7bff", UNDER_REVIEW: "#7c5cff",
  DRAFT: "#8a99ad", ASSIGNED: "#c57926", CHANGES_REQUESTED: "#c57926", REJECTED: "#c34a4a",
};

const METRIC_SERIES = [
  { key: "energy", name: "Energy (GJ '000)", hue: "#3a7bff" },
  { key: "emissions", name: "Emissions (tCO₂e '00)", hue: "#7c5cff" },
  { key: "water", name: "Water (m³ '00)", hue: "#0ea5b7" },
  { key: "waste", name: "Waste (t)", hue: "#5b8c5a" },
  { key: "safety", name: "Safety incidents", hue: "#c57926" },
] as const;

const SEVERITY_HUE: Record<string, string> = {
  CRITICAL: "#c34a4a", HIGH: "#c57926", MEDIUM: "#3a7bff", LOW: "#8a99ad",
};

const legendStyle = { fontSize: 11, color: "var(--ink-soft)", paddingTop: 6 } as const;
const axisTick = { fontSize: 11, fill: "var(--ink-faint)" } as const;
const gridStroke = "rgba(125,177,216,0.3)";

/* glass tooltip — shared across every chart on this screen */
function ChartTip({
  active, payload, label,
}: {
  active?: boolean;
  payload?: { name?: string | number; value?: number | string; color?: string; dataKey?: string | number }[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-strong rounded-2xl border-white/70 px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-semibold text-[color:var(--ink)]">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-[color:var(--ink-soft)]">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.color }} />
          <span>{p.name}:</span>
          <span className="tabular font-medium">{typeof p.value === "number" ? fmtNumber(p.value, 1) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsView() {
  const { navigate, reportingYear } = useSaWorkspace();
  const { data, loading, error, refetch } = useSaApi<AnalyticsData>(
    `/api/sa/analytics?period=${encodeURIComponent(reportingYear)}`,
    { deps: [reportingYear] }
  );
  const [bu, setBu] = React.useState("ALL");

  const completionByBU = React.useMemo(
    () => (bu === "ALL" ? (data?.completionByBU ?? []) : (data?.completionByBU ?? []).filter((b) => b.name === bu)),
    [data, bu]
  );
  const overdueByBU = React.useMemo(
    () => (bu === "ALL" ? (data?.overdueByBU ?? []) : (data?.overdueByBU ?? []).filter((b) => b.name === bu)),
    [data, bu]
  );

  /* chart source rows for the export (every series currently rendered) */
  const exportRows = React.useMemo(() => {
    if (!data) return [];
    const rows: Record<string, unknown>[] = [];
    const push = (series: string, arr: Record<string, unknown>[]) => {
      for (const row of arr) rows.push({ series, ...row });
    };
    push("completionByBU", data.completionByBU);
    push("submissionTrend", data.submissionTrend);
    push("statusMix", data.statusMix);
    push("overdueByBU", data.overdueByBU);
    push("metricTrends", data.metricTrends);
    push("pendingVsApproved", data.pendingVsApproved);
    push("qualityDist", data.qualityDist);
    push("categoryPulse", data.categoryPulse);
    return rows;
  }, [data]);

  const qualityTotal = (data?.qualityDist ?? []).reduce((n, q) => n + q.count, 0);

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="ESG Analytics"
        description={`${reportingYear} · Interactive environmental, social and governance performance for your subsidiary — computed from live submission records.`}
        icon={TrendIcon}
        breadcrumbs={["Subsidiary", "Reporting & Insights", "ESG Analytics"]}
      />

      {/* ── filter row: BU scope + export ── */}
      <GlassCard className="flex flex-wrap items-center gap-3 p-4">
        <div className="w-64">
          <Select value={bu} onValueChange={setBu}>
            <SelectTrigger className="glass-subtle rounded-2xl border-white/60" aria-label="Business unit scope">
              <span className="mr-1 hidden text-xs text-[color:var(--ink-faint)] md:inline">Scope:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="glass-strong rounded-2xl border-white/70">
              <SelectItem value="ALL">All business units</SelectItem>
              {(data?.completionByBU ?? []).map((b) => (
                <SelectItem key={b.name} value={b.name}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Chip tone="blue">{bu === "ALL" ? "Whole subsidiary" : bu}</Chip>
        <Chip tone="gray">Period: {reportingYear}</Chip>
        <div className="ml-auto">
          <ExportButton filename={`subsidiary-analytics-${reportingYear.replace(/\s+/g, "-").toLowerCase()}`} rows={exportRows} />
        </div>
      </GlassCard>

      {error && !data ? (
        <GlassCard><ErrorState message={error} onRetry={refetch} /></GlassCard>
      ) : loading && !data ? (
        <GlassCard><LoadingBlock rows={6} label="Crunching your subsidiary's ESG series…" /></GlassCard>
      ) : !data ? null : (
        <>
          <div className="grid gap-3 xl:grid-cols-2">
            {/* 1 · submission trend */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <SectionCard
                title="Submission trend"
                description="Reports submitted vs approved over the last 6 months."
                icon={LineChartIcon}
              >
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.submissionTrend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="saTrendSub" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3a7bff" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#3a7bff" stopOpacity={0.04} />
                        </linearGradient>
                        <linearGradient id="saTrendApp" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#20a779" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#20a779" stopOpacity={0.04} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                      <XAxis dataKey="label" tick={axisTick} stroke={gridStroke} />
                      <YAxis tick={axisTick} stroke={gridStroke} width={36} allowDecimals={false} />
                      <Tooltip content={<ChartTip />} cursor={{ stroke: gridStroke }} />
                      <Legend wrapperStyle={legendStyle} />
                      <Area type="monotone" dataKey="submitted" name="Submitted" stroke="#3a7bff" strokeWidth={2.5} fill="url(#saTrendSub)" dot={{ r: 3, fill: "#3a7bff" }} />
                      <Area type="monotone" dataKey="approved" name="Approved" stroke="#20a779" strokeWidth={2.5} fill="url(#saTrendApp)" dot={{ r: 3, fill: "#20a779" }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>
            </motion.div>

            {/* 2 · status mix */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
              <SectionCard
                title="Status mix"
                description="Every reporting record in scope, by workflow status."
                icon={BarChart3}
              >
                {data.statusMix.every((s) => s.count === 0) ? (
                  <EmptyState title="No records yet" message="Status mix appears once submissions exist." />
                ) : (
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.statusMix} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
                        <XAxis type="number" tick={axisTick} stroke={gridStroke} allowDecimals={false} />
                        <YAxis type="category" dataKey="label" tick={axisTick} stroke={gridStroke} width={122} />
                        <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(58,123,255,0.06)" }} />
                        <Bar dataKey="count" name="Records" radius={[0, 6, 6, 0]} maxBarSize={18}>
                          {data.statusMix.map((s) => (
                            <Cell key={s.status} fill={STATUS_HUE[s.status] ?? "#8a99ad"} cursor="pointer" />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </SectionCard>
            </motion.div>

            {/* 3 · completion by BU (click → units) */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
              <SectionCard
                title="Completion by BU"
                description="Approved share of reports per business unit — click a bar to open it."
                icon={Layers}
              >
                {completionByBU.length === 0 ? (
                  <EmptyState title="No business units in this scope" message="Add business units to see completion analytics." />
                ) : (
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={completionByBU} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
                        <XAxis type="number" domain={[0, 100]} tick={axisTick} stroke={gridStroke} unit="%" />
                        <YAxis type="category" dataKey="name" tick={axisTick} stroke={gridStroke} width={140} />
                        <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(58,123,255,0.06)" }} />
                        <Bar
                          dataKey="completionPct"
                          name="Completion %"
                          fill="#3a7bff"
                          radius={[0, 6, 6, 0]}
                          maxBarSize={22}
                          cursor="pointer"
                          onClick={(entry: { payload?: { name?: string } }) => {
                            const name = entry?.payload?.name;
                            if (name) navigate("units", { q: name });
                          }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </SectionCard>
            </motion.div>

            {/* 4 · overdue by BU (click → overdue register) */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
              <SectionCard
                title="Overdue by BU"
                description="Past-deadline records per business unit — click through to the overdue register."
                icon={AlarmClock}
              >
                {overdueByBU.every((b) => b.overdue === 0) ? (
                  <EmptyState title="Nothing overdue" message="Every business unit is inside its reporting deadlines." />
                ) : (
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={overdueByBU} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                        <XAxis dataKey="name" tick={axisTick} stroke={gridStroke} interval={0} angle={-14} textAnchor="end" height={54} />
                        <YAxis tick={axisTick} stroke={gridStroke} width={32} allowDecimals={false} />
                        <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(195,74,74,0.06)" }} />
                        <Bar
                          dataKey="overdue"
                          name="Overdue records"
                          fill="#c34a4a"
                          radius={[6, 6, 0, 0]}
                          maxBarSize={40}
                          cursor="pointer"
                          onClick={() => navigate("submissions", { tab: "overdue" })}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </SectionCard>
            </motion.div>

            {/* 5 · ESG metric trends (12 months) */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
              <SectionCard
                title="ESG metric trends — 12 months"
                description="Monthly environmental & safety metrics consolidated from approved submissions."
                icon={TrendingUp}
              >
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.metricTrends} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                      <XAxis dataKey="month" tick={axisTick} stroke={gridStroke} />
                      <YAxis tick={axisTick} stroke={gridStroke} width={44} />
                      <Tooltip content={<ChartTip />} />
                      <Legend wrapperStyle={legendStyle} />
                      {METRIC_SERIES.map((m) => (
                        <Line
                          key={m.key}
                          type="monotone"
                          dataKey={m.key}
                          name={m.name}
                          stroke={m.hue}
                          strokeWidth={2}
                          dot={{ r: 2.5, fill: m.hue }}
                          activeDot={{ r: 4 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>
            </motion.div>

            {/* 6 · pending vs approved (stacked) */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <SectionCard
                title="Pending vs approved"
                description="Monthly review throughput — records cleared vs still awaiting review."
                icon={BarChart3}
              >
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.pendingVsApproved} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                      <XAxis dataKey="month" tick={axisTick} stroke={gridStroke} />
                      <YAxis tick={axisTick} stroke={gridStroke} width={36} allowDecimals={false} />
                      <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(58,123,255,0.06)" }} />
                      <Legend wrapperStyle={legendStyle} />
                      <Bar dataKey="pending" name="Pending review" stackId="pva" fill="#c57926" maxBarSize={36} />
                      <Bar dataKey="approved" name="Approved" stackId="pva" fill="#20a779" radius={[6, 6, 0, 0]} maxBarSize={36} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>
            </motion.div>

            {/* 7 · data quality */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}>
              <SectionCard
                title="Data quality"
                description="Open validation issues in the subsidiary, by severity."
                icon={ShieldAlert}
                actions={qualityTotal > 0 ? (
                  <Chip tone="amber">{qualityTotal} open issue{qualityTotal === 1 ? "" : "s"}</Chip>
                ) : undefined}
              >
                {data.qualityDist.length === 0 || qualityTotal === 0 ? (
                  <EmptyState title="No open validation issues" message="All submitted data currently passes the platform's automated checks." />
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {data.qualityDist.map((q) => (
                        <Chip key={q.severity} tone={q.severity === "CRITICAL" ? "red" : q.severity === "HIGH" ? "amber" : q.severity === "MEDIUM" ? "blue" : "gray"}>
                          {q.severity.charAt(0) + q.severity.slice(1).toLowerCase()} · {q.count}
                        </Chip>
                      ))}
                    </div>
                    <div className="flex h-3 w-full overflow-hidden rounded-full bg-[rgba(138,153,173,0.18)]" role="img" aria-label="Open validation issues by severity">
                      {data.qualityDist.map((q) => (
                        <span
                          key={q.severity}
                          className="h-full transition-all duration-500"
                          style={{ width: `${(q.count / Math.max(qualityTotal, 1)) * 100}%`, background: SEVERITY_HUE[q.severity] ?? "#8a99ad" }}
                          title={`${q.severity}: ${q.count}`}
                        />
                      ))}
                    </div>
                    <div className="flex flex-wrap justify-between gap-2 text-[11px] text-[color:var(--ink-faint)]">
                      {data.qualityDist.map((q) => (
                        <span key={q.severity} className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ background: SEVERITY_HUE[q.severity] ?? "#8a99ad" }} />
                          {q.severity} — {q.count}
                        </span>
                      ))}
                    </div>
                    <p className="text-[11.5px] leading-relaxed text-[color:var(--ink-soft)]">
                      Resolve issues from the Data Validation screen — missing evidence and missing submissions are re-verified by the platform before a fix is accepted.
                    </p>
                  </div>
                )}
              </SectionCard>
            </motion.div>

            {/* 8 · category pulse */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
              <SectionCard
                title="Category pulse"
                description="Latest approved metric per category with change vs the prior value — click to open its records."
                icon={ListChecks}
              >
                {data.categoryPulse.length === 0 ? (
                  <EmptyState title="No approved metrics yet" message="Category pulse appears once approved submissions exist." />
                ) : (
                  <div className="nice-scroll max-h-[260px] space-y-2 overflow-y-auto pr-1">
                    {data.categoryPulse.map((c, i) => (
                      <motion.button
                        key={c.category}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        onClick={() => navigate("submissions", { category: c.category })}
                        className="glass-subtle flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all hover:-translate-y-0.5 hover:bg-white/80"
                        aria-label={`${c.label}: latest ${c.value} ${c.unit}, change ${c.change >= 0 ? "+" : ""}${c.change}%`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-[color:var(--ink)]">{c.label}</span>
                          <span className="block text-[11px] text-[color:var(--ink-faint)]">Latest approved value · click to view records</span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-[14px] font-bold tabular text-[color:var(--ink)]">
                            {fmtNumber(c.value, 1)} <span className="text-[10.5px] font-medium text-[color:var(--ink-faint)]">{c.unit}</span>
                          </span>
                          <Chip tone={c.change > 0 ? "green" : c.change < 0 ? "red" : "gray"} className="mt-0.5">
                            {c.change > 0 ? "▲" : c.change < 0 ? "▼" : "—"} {Math.abs(c.change)}%
                          </Chip>
                        </span>
                      </motion.button>
                    ))}
                  </div>
                )}
              </SectionCard>
            </motion.div>
          </div>

          {/* honest-data note */}
          <GlassCard subtle className="flex flex-wrap items-center gap-2 p-4 text-xs text-[color:var(--ink-faint)]">
            <LineChartIcon className="h-4 w-4 text-[color:var(--esg-blue)]" />
            All series are computed live from your subsidiary&apos;s real submission records — nothing on this screen is sampled or mocked.
          </GlassCard>
        </>
      )}
    </div>
  );
}
