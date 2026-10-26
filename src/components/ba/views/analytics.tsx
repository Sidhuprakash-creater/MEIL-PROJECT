"use client";

// ── BU ADMIN · SCREEN 14 — ESG Analytics ──
// Project completion comparison, submission timeliness, missing-data
// distribution, evidence completeness, environmental metric summaries,
// reporting trends across supported periods, validation issue distribution.

import { useMemo, useState } from "react";
import {
  BarChart3, Download, FileBarChart, LineChart as LineIcon, PieChart, ShieldAlert,
} from "lucide-react";
import { TrendIcon } from "@/components/workspace/premium-icons";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBaApi, downloadFile, toCsv } from "@/lib/ba/client";
import { useBaWorkspace } from "@/lib/ba/store";
import type { BaAnalyticsData } from "@/lib/ba/types";
import {
  Chip, EmptyState, ErrorState, GlassCard, LoadingBlock, PageHeader, SectionCard,
} from "@/components/workspace/ui";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { fmtMetric } from "@/components/ba/shared";

const STATUS_HUE: Record<string, string> = {
  APPROVED: "#16A67A", SUBMITTED: "#348BE8", UNDER_REVIEW: "#8B5CF6",
  DRAFT: "#8a99ad", ASSIGNED: "#c57926", CHANGES_REQUESTED: "#c57926", REJECTED: "#E35D6A",
};

const ChartTip = ({ active, payload, label }: { active?: boolean; payload?: { name?: string; value?: number; color?: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-strong rounded-2xl border-white/80 p-2.5 text-[11px] shadow-lg">
      {label && <div className="mb-1 font-semibold text-[color:var(--ink)]">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-[color:var(--ink-soft)]">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span>{p.name}</span>
          <span className="tabular font-semibold text-[color:var(--ink)]">{fmtMetric(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default function AnalyticsView() {
  const { reportingYear } = useBaWorkspace();
  const { data, loading, error, refetch } = useBaApi<BaAnalyticsData>(`/api/ba/analytics?period=${encodeURIComponent(reportingYear)}`, { deps: [reportingYear] });

  if (loading && !data) return <LoadingBlock rows={6} label="Loading analytics…" />;
  if (error && !data) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  const exportAll = () => {
    const rows = [
      ...data.completionByProject.map((c) => ({ series: "Completion by project", label: c.name, value: c.completionPct, extra: `${c.approved}/${c.total}` })),
      ...data.submissionTrend.map((s) => ({ series: "Submission trend", label: s.label, value: s.submitted, extra: `${s.approved} approved` })),
      ...data.statusMix.map((s) => ({ series: "Status mix", label: s.label, value: s.count, extra: s.status })),
      ...data.overdueByProject.map((o) => ({ series: "Overdue by project", label: o.name, value: o.overdue, extra: "" })),
      ...data.metricTrends.map((m) => ({ series: "Metric trends", label: m.month, value: m.energy, extra: `emissions ${m.emissions} · water ${m.water}` })),
      ...data.qualityDist.map((q) => ({ series: "Quality distribution", label: q.severity, value: q.count, extra: "" })),
      ...data.pendingVsApproved.map((p) => ({ series: "Pending vs approved", label: p.month, value: p.pending, extra: `${p.approved} approved` })),
      ...data.categoryPulse.map((c) => ({ series: "Category pulse", label: c.label, value: c.value, extra: `${c.unit} · ${c.change >= 0 ? "+" : ""}${c.change}%` })),
    ];
    downloadFile(`ba-analytics-${reportingYear}.csv`, toCsv(rows), "text/csv");
  };

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="ESG Analytics"
        description={`${reportingYear} · Interactive E, S and G analytics for your BU. Every figure is computed live from your BU's approved submission records.`}
        icon={TrendIcon}
        actions={
          <Button variant="outline" className="glass-subtle rounded-2xl" onClick={exportAll}><Download className="mr-1.5 h-4 w-4" /> Export all series</Button>
        }
      />

      <div className="grid gap-3 xl:grid-cols-2">
        {/* Completion by project */}
        <SectionCard title="Project completion comparison" icon={BarChart3}>
          {data.completionByProject.length === 0 ? <EmptyState title="No projects yet" /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.completionByProject} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(125,177,216,0.3)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--ink-faint)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--ink-faint)" }} />
                <Tooltip content={<ChartTip />} />
                <Bar dataKey="completionPct" name="Completion %" fill="#348BE8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        {/* Submission trend */}
        <SectionCard title="Submission timeliness — 6 months" icon={LineIcon}>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data.submissionTrend} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
              <defs>
                <linearGradient id="g-sub" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#348BE8" stopOpacity={0.4} /><stop offset="95%" stopColor="#348BE8" stopOpacity={0.05} /></linearGradient>
                <linearGradient id="g-app" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#16A67A" stopOpacity={0.4} /><stop offset="95%" stopColor="#16A67A" stopOpacity={0.05} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(125,177,216,0.3)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--ink-faint)" }} />
              <YAxis tick={{ fontSize: 10, fill: "var(--ink-faint)" }} />
              <Tooltip content={<ChartTip />} />
              <Area type="monotone" dataKey="submitted" name="Submitted" stroke="#348BE8" fill="url(#g-sub)" strokeWidth={2} />
              <Area type="monotone" dataKey="approved" name="Approved" stroke="#16A67A" fill="url(#g-app)" strokeWidth={2} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </AreaChart>
          </ResponsiveContainer>
        </SectionCard>

        {/* Status mix */}
        <SectionCard title="Status mix" icon={PieChart}>
          {data.statusMix.every((s) => s.count === 0) ? <EmptyState title="No submissions yet" /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.statusMix.filter((s) => s.count > 0)} layout="vertical" margin={{ top: 8, right: 8, bottom: 8, left: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(125,177,216,0.3)" />
                <XAxis type="number" tick={{ fontSize: 10, fill: "var(--ink-faint)" }} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: "var(--ink-faint)" }} width={110} />
                <Tooltip content={<ChartTip />} />
                <Bar dataKey="count" name="Records" radius={[0, 6, 6, 0]}>
                  {data.statusMix.filter((s) => s.count > 0).map((s) => <Cell key={s.status} fill={STATUS_HUE[s.status] ?? "#348BE8"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        {/* Overdue by project */}
        <SectionCard title="Overdue by project" icon={ShieldAlert}>
          {data.overdueByProject.every((p) => p.overdue === 0) ? <EmptyState title="Nothing overdue" message="Every project is inside its deadline." /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.overdueByProject} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(125,177,216,0.3)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--ink-faint)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--ink-faint)" }} />
                <Tooltip content={<ChartTip />} />
                <Bar dataKey="overdue" name="Overdue" fill="#E35D6A" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        {/* Metric trends */}
        <SectionCard title="Environmental metric trends — 12 months" icon={LineIcon}>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.metricTrends} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(125,177,216,0.3)" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--ink-faint)" }} />
              <YAxis tick={{ fontSize: 10, fill: "var(--ink-faint)" }} />
              <Tooltip content={<ChartTip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="energy" name="Energy" stroke="#348BE8" strokeWidth={2} />
              <Line type="monotone" dataKey="emissions" name="Emissions" stroke="#8B5CF6" strokeWidth={2} />
              <Line type="monotone" dataKey="water" name="Water" stroke="#16A3A3" strokeWidth={2} />
              <Line type="monotone" dataKey="waste" name="Waste" stroke="#c57926" strokeWidth={2} />
              <Line type="monotone" dataKey="safety" name="Safety incidents" stroke="#E35D6A" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </SectionCard>

        {/* Pending vs approved */}
        <SectionCard title="Pending vs approved — 6 months" icon={FileBarChart}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.pendingVsApproved} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(125,177,216,0.3)" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--ink-faint)" }} />
              <YAxis tick={{ fontSize: 10, fill: "var(--ink-faint)" }} />
              <Tooltip content={<ChartTip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="pending" name="Pending" stackId="a" fill="#c57926" radius={[6, 6, 0, 0]} />
              <Bar dataKey="approved" name="Approved" stackId="a" fill="#16A67A" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        {/* Quality distribution */}
        <SectionCard title="Validation issue distribution" icon={ShieldAlert}>
          {data.qualityDist.every((q) => q.count === 0) ? <EmptyState title="No open validation issues" /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.qualityDist} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(125,177,216,0.3)" />
                <XAxis dataKey="severity" tick={{ fontSize: 10, fill: "var(--ink-faint)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--ink-faint)" }} />
                <Tooltip content={<ChartTip />} />
                <Bar dataKey="count" name="Open issues" fill="#8B5CF6" radius={[6, 6, 0, 0]}>
                  {data.qualityDist.map((q) => <Cell key={q.severity} fill={q.severity === "CRITICAL" ? "#E35D6A" : q.severity === "HIGH" ? "#c57926" : q.severity === "MEDIUM" ? "#8B5CF6" : "#348BE8"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        {/* Category pulse */}
        <SectionCard title="Category pulse" icon={FileBarChart} description="Latest approved value per category vs the previous period">
          {data.categoryPulse.length === 0 ? <EmptyState title="No approved metrics yet" /> : (
            <div className="nice-scroll max-h-[260px] space-y-1.5 overflow-y-auto">
              {data.categoryPulse.map((c) => (
                <div key={c.category} className="flex items-center justify-between rounded-xl bg-white/50 px-2.5 py-1.5 text-[12px]">
                  <div className="min-w-0"><div className="truncate font-semibold text-[color:var(--ink)]">{c.label}</div><div className="text-[10.5px] text-[color:var(--ink-faint)]">{c.unit}</div></div>
                  <div className="flex items-center gap-2">
                    <span className="tabular font-semibold text-[color:var(--ink)]">{fmtMetric(c.value)}</span>
                    <Chip tone={c.change > 0 ? "green" : c.change < 0 ? "red" : "gray"}>{c.change > 0 ? "▲" : c.change < 0 ? "▼" : "•"} {Math.abs(c.change)}%</Chip>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Evidence gaps */}
        <SectionCard title="Evidence completeness" icon={FileBarChart}>
          <div className="grid grid-cols-3 gap-2">
            <GlassCard className="glass-ba p-3"><div className="text-[20px] font-bold tabular text-[color:var(--ink)]">{data.evidenceGaps.total}</div><div className="text-[11px] text-[color:var(--ink-faint)]">Total</div></GlassCard>
            <GlassCard className="glass-ba p-3"><div className="text-[20px] font-bold tabular text-[#E35D6A]">{data.evidenceGaps.missing}</div><div className="text-[11px] text-[color:var(--ink-faint)]">Missing</div></GlassCard>
            <GlassCard className="glass-ba p-3"><div className="text-[20px] font-bold tabular text-[#c57926]">{data.evidenceGaps.expired}</div><div className="text-[11px] text-[color:var(--ink-faint)]">Expired</div></GlassCard>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {data.evidenceGaps.byType.map((t) => <Chip key={t.type} tone="blue">{t.type} · {t.count}</Chip>)}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
