"use client";

// ── SCREEN 15 — ESG Analytics (E · S · G chart grid) ──
import * as React from "react";
import {
  Activity,
  BarChart3,
  Droplets,
  Flame,
  Leaf,
  LineChart as LineChartIcon,
  HeartPulse,
  Recycle,
  ShieldAlert,
  ShoppingCart,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWorkspace } from "@/lib/esg/store";
import { fmtNumber, useApi } from "@/lib/esg/client";
import type { AnalyticsData } from "@/lib/esg/types";
import { Chip, EmptyState, ErrorState, ExportButton, GlassCard, KpiCard, LoadingBlock, PageHeader, SectionCard } from "../ui";

const C = { blue: "#3a7bff", purple: "#6a5bff", teal: "#16a3a3", green: "#238653", amber: "#c57926", red: "#c34a4a" };

const legendStyle = { fontSize: 11, color: "var(--ink-soft)", paddingTop: 6 };
const axisTick = { fontSize: 11, fill: "var(--ink-faint)" };
const gridStroke = "rgba(125,177,216,0.3)";

function ChartTip({ active, payload, label }: { active?: boolean; payload?: { name?: string | number; value?: number | string; color?: string }[]; label?: string | number }) {
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

function DrillLink() {
  const { navigate } = useWorkspace();
  return (
    <button
      type="button"
      onClick={() => navigate("submissions")}
      className="inline-flex items-center gap-1 text-xs font-medium text-[#1d5fd6] underline-offset-2 hover:underline"
    >
      View underlying submissions
      <span aria-hidden="true">→</span>
    </button>
  );
}

export default function AnalyticsView() {
  const [scope, setScope] = React.useState("GROUP");
  const [period, setPeriod] = React.useState("FY 2025-26");
  const { data, loading, error, refetch } = useApi<AnalyticsData>(`/api/esg/analytics?scope=${encodeURIComponent(scope)}`);

  const kpis = React.useMemo(() => {
    if (!data) return null;
    const last = <T,>(arr: T[]): T | undefined => arr[arr.length - 1];
    const em = last(data.emissions);
    const env = last(data.environmental);
    const saf = last(data.safety);
    const wf = last(data.workforce);
    return {
      ghg: (em?.scope1 ?? 0) + (em?.scope2 ?? 0),
      renewable: env?.renewable ?? 0,
      ltifr: saf?.ltifr ?? 0,
      training: wf?.training ?? 0,
    };
  }, [data]);

  const exportRows = React.useMemo(() => {
    if (!data) return [];
    const rows: Record<string, unknown>[] = [];
    const push = (series: string, arr: Record<string, unknown>[]) => {
      for (const row of arr) rows.push({ series, ...row });
    };
    push("environmental", data.environmental);
    push("emissions", data.emissions);
    push("water", data.water);
    push("waste", data.waste);
    push("safety", data.safety);
    push("workforce", data.workforce);
    push("procurement", data.procurement);
    push("csr", data.csr);
    push("compliance", data.compliance);
    push("completion", data.completion);
    return rows;
  }, [data]);

  return (
    <div className="view-in space-y-5">
      <PageHeader
        title="ESG Analytics"
        description="Interactive environmental, social, and governance performance for the selected scope — derived from approved data."
        icon={TrendingUp}
        breadcrumbs={["Group", "Insights & Governance", "ESG Analytics"]}
        actions={<ExportButton filename={`esg-analytics-${scope.toLowerCase()}`} rows={exportRows} />}
      />

      {/* Controls */}
      <GlassCard className="flex flex-wrap items-center gap-3 p-4">
        <div className="w-56">
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger className="glass-subtle rounded-2xl border-white/60" aria-label="Subsidiary scope">
              <span className="mr-1 hidden text-xs text-[color:var(--ink-faint)] md:inline">Scope:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="glass-strong rounded-2xl border-white/70">
              <SelectItem value="GROUP">GROUP — all subsidiaries</SelectItem>
              {(data?.subsidiaries ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-48">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="glass-subtle rounded-2xl border-white/60" aria-label="Reporting period">
              <span className="mr-1 hidden text-xs text-[color:var(--ink-faint)] md:inline">Period:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="glass-strong rounded-2xl border-white/70">
              {(data?.periods ?? ["FY 2025-26"]).map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Chip tone="amber" className="ml-auto">
          Period filter is cosmetic in this demo — series cover the trailing four quarters
        </Chip>
      </GlassCard>

      {error ? (
        <GlassCard>
          <ErrorState message={error} onRetry={() => refetch()} />
        </GlassCard>
      ) : loading || !data || !kpis ? (
        <GlassCard>
          <LoadingBlock rows={6} label="Crunching ESG series…" />
        </GlassCard>
      ) : (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <KpiCard label="Scope 1 + 2 GHG (latest quarter)" value={`${fmtNumber(kpis.ghg)} t`} icon={Flame} tone="purple" hint="Direct + purchased energy emissions" />
            <KpiCard label="Renewable energy share" value={`${kpis.renewable}%`} icon={Leaf} tone="green" trend={{ dir: "up", text: "improving" }} hint="Of total consumption" />
            <KpiCard label="LTIFR" value={kpis.ltifr} icon={HeartPulse} tone={kpis.ltifr > 0.4 ? "amber" : "green"} hint="Lost time injury frequency rate" />
            <KpiCard label="Training hours (quarter)" value={fmtNumber(kpis.training)} icon={Users} tone="blue" hint="Workforce development investment" />
          </div>

          {/* Chart grid */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <SectionCard title="Energy & renewables" description="Quarterly energy consumption with renewable share." icon={Leaf} actions={<DrillLink />}>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data.environmental} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis dataKey="label" tick={axisTick} stroke={gridStroke} />
                    <YAxis yAxisId="l" tick={axisTick} stroke={gridStroke} width={62} />
                    <YAxis yAxisId="r" orientation="right" tick={axisTick} stroke={gridStroke} width={40} />
                    <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(58,123,255,0.06)" }} />
                    <Legend wrapperStyle={legendStyle} />
                    <Bar yAxisId="l" dataKey="energy" name="Energy (GWh)" fill={C.blue} radius={[6, 6, 0, 0]} maxBarSize={44} />
                    <Line yAxisId="r" dataKey="renewable" name="Renewable (%)" stroke={C.green} strokeWidth={2.5} dot={{ r: 3, fill: C.green }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            <SectionCard title="GHG emissions by scope" description="Stacked Scope 1, 2, and 3 over the year." icon={Flame} actions={<DrillLink />}>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.emissions} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis dataKey="label" tick={axisTick} stroke={gridStroke} />
                    <YAxis tick={axisTick} stroke={gridStroke} width={62} />
                    <Tooltip content={<ChartTip />} />
                    <Legend wrapperStyle={legendStyle} />
                    <Area dataKey="scope1" name="Scope 1" stackId="ghg" stroke={C.red} fill={C.red} fillOpacity={0.35} />
                    <Area dataKey="scope2" name="Scope 2" stackId="ghg" stroke={C.amber} fill={C.amber} fillOpacity={0.35} />
                    <Area dataKey="scope3" name="Scope 3" stackId="ghg" stroke={C.purple} fill={C.purple} fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            <SectionCard title="Water balance" description="Withdrawal, discharge, and recycled volumes (m³)." icon={Droplets} actions={<DrillLink />}>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.water} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis dataKey="label" tick={axisTick} stroke={gridStroke} />
                    <YAxis tick={axisTick} stroke={gridStroke} width={64} />
                    <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(58,123,255,0.06)" }} />
                    <Legend wrapperStyle={legendStyle} />
                    <Bar dataKey="withdrawal" name="Withdrawal" fill={C.blue} radius={[5, 5, 0, 0]} maxBarSize={26} />
                    <Bar dataKey="discharge" name="Discharge" fill={C.teal} radius={[5, 5, 0, 0]} maxBarSize={26} />
                    <Bar dataKey="recycled" name="Recycled" fill={C.green} radius={[5, 5, 0, 0]} maxBarSize={26} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            <SectionCard title="Waste generation" description="Hazardous / non-hazardous waste with recycled trend (t)." icon={Recycle} actions={<DrillLink />}>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data.waste} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis dataKey="label" tick={axisTick} stroke={gridStroke} />
                    <YAxis tick={axisTick} stroke={gridStroke} width={56} />
                    <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(58,123,255,0.06)" }} />
                    <Legend wrapperStyle={legendStyle} />
                    <Bar dataKey="hazardous" name="Hazardous" stackId="w" fill={C.red} radius={[0, 0, 0, 0]} maxBarSize={44} />
                    <Bar dataKey="nonHazardous" name="Non-hazardous" stackId="w" fill={C.amber} radius={[6, 6, 0, 0]} maxBarSize={44} />
                    <Line dataKey="recycled" name="Recycled" stroke={C.green} strokeWidth={2.5} dot={{ r: 3, fill: C.green }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            <SectionCard title="Safety performance" description="Recorded incidents with LTIFR trend." icon={HeartPulse} actions={<DrillLink />}>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data.safety} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis dataKey="label" tick={axisTick} stroke={gridStroke} />
                    <YAxis yAxisId="l" tick={axisTick} stroke={gridStroke} width={40} />
                    <YAxis yAxisId="r" orientation="right" tick={axisTick} stroke={gridStroke} width={40} />
                    <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(58,123,255,0.06)" }} />
                    <Legend wrapperStyle={legendStyle} />
                    <Bar yAxisId="l" dataKey="incidents" name="Incidents" fill={C.red} radius={[6, 6, 0, 0]} maxBarSize={44} />
                    <Line yAxisId="r" dataKey="ltifr" name="LTIFR" stroke={C.blue} strokeWidth={2.5} dot={{ r: 3, fill: C.blue }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            <SectionCard title="Workforce" description="Headcount growth with gender diversity (%)." icon={Users} actions={<DrillLink />}>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data.workforce} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="wfGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C.blue} stopOpacity={0.45} />
                        <stop offset="100%" stopColor={C.blue} stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis dataKey="label" tick={axisTick} stroke={gridStroke} />
                    <YAxis yAxisId="l" tick={axisTick} stroke={gridStroke} width={58} />
                    <YAxis yAxisId="r" orientation="right" tick={axisTick} stroke={gridStroke} width={36} />
                    <Tooltip content={<ChartTip />} />
                    <Legend wrapperStyle={legendStyle} />
                    <Area yAxisId="l" dataKey="headcount" name="Headcount" stroke={C.blue} fill="url(#wfGrad)" strokeWidth={2} />
                    <Line yAxisId="r" dataKey="diversity" name="Diversity (%)" stroke={C.purple} strokeWidth={2.5} dot={{ r: 3, fill: C.purple }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            <SectionCard title="Procurement" description="Local sourcing (%) and green procurement spend (₹ Cr)." icon={ShoppingCart} actions={<DrillLink />}>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.procurement} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis dataKey="label" tick={axisTick} stroke={gridStroke} />
                    <YAxis yAxisId="l" tick={axisTick} stroke={gridStroke} width={40} />
                    <YAxis yAxisId="r" orientation="right" tick={axisTick} stroke={gridStroke} width={40} />
                    <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(58,123,255,0.06)" }} />
                    <Legend wrapperStyle={legendStyle} />
                    <Bar yAxisId="l" dataKey="localSourcing" name="Local sourcing (%)" fill={C.teal} radius={[6, 6, 0, 0]} maxBarSize={40} />
                    <Bar yAxisId="r" dataKey="greenSpend" name="Green spend (₹ Cr)" fill={C.green} radius={[6, 6, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            <SectionCard title="CSR & community" description="Beneficiaries reached and CSR spend (₹ Cr)." icon={Activity} actions={<DrillLink />}>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data.csr} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis dataKey="label" tick={axisTick} stroke={gridStroke} />
                    <YAxis yAxisId="l" tick={axisTick} stroke={gridStroke} width={58} />
                    <YAxis yAxisId="r" orientation="right" tick={axisTick} stroke={gridStroke} width={40} />
                    <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(58,123,255,0.06)" }} />
                    <Legend wrapperStyle={legendStyle} />
                    <Bar yAxisId="l" dataKey="beneficiaries" name="Beneficiaries" fill={C.purple} radius={[6, 6, 0, 0]} maxBarSize={44} />
                    <Line yAxisId="r" dataKey="spend" name="Spend (₹ Cr)" stroke={C.green} strokeWidth={2.5} dot={{ r: 3, fill: C.green }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            <SectionCard title="Compliance posture" description="Non-compliance events and finding closures." icon={ShieldAlert} actions={<DrillLink />}>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.compliance} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis dataKey="label" tick={axisTick} stroke={gridStroke} />
                    <YAxis tick={axisTick} stroke={gridStroke} width={36} />
                    <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(58,123,255,0.06)" }} />
                    <Legend wrapperStyle={legendStyle} />
                    <Bar dataKey="nonCompliance" name="Non-compliance" fill={C.red} radius={[5, 5, 0, 0]} maxBarSize={26} />
                    <Bar dataKey="openFindings" name="Open findings" fill={C.amber} radius={[5, 5, 0, 0]} maxBarSize={26} />
                    <Bar dataKey="closedFindings" name="Closed findings" fill={C.green} radius={[5, 5, 0, 0]} maxBarSize={26} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            <SectionCard title="Submission completion by subsidiary" description="Submitted · approved · overdue counts per entity." icon={BarChart3} actions={<DrillLink />}>
              {data.completion.length === 0 ? (
                <EmptyState title="No subsidiary data in this scope" />
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.completion} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                      <XAxis type="number" tick={axisTick} stroke={gridStroke} />
                      <YAxis type="category" dataKey="label" tick={axisTick} stroke={gridStroke} width={110} />
                      <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(58,123,255,0.06)" }} />
                      <Legend wrapperStyle={legendStyle} />
                      <Bar dataKey="submitted" name="Submitted" stackId="c" fill={C.blue} radius={[0, 0, 0, 0]} maxBarSize={22} />
                      <Bar dataKey="approved" name="Approved" stackId="c" fill={C.green} maxBarSize={22} />
                      <Bar dataKey="overdue" name="Overdue" stackId="c" fill={C.red} radius={[0, 4, 4, 0]} maxBarSize={22} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </SectionCard>
          </div>

          <GlassCard subtle className="flex flex-wrap items-center gap-2 p-4 text-xs text-[color:var(--ink-faint)]">
            <LineChartIcon className="h-4 w-4 text-[color:var(--esg-blue)]" />
            Series are deterministic demo projections seeded from approved submission totals for the selected scope; they are stable across reloads and intended for dashboard demonstration, not statutory reporting.
          </GlassCard>
        </>
      )}
    </div>
  );
}
