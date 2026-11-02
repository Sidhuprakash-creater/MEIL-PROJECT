"use client";

// ── SUBSIDIARY MANAGER · SCREEN 09 — ESG Analytics ──
import { useState } from "react";
import { TrendingUp } from "lucide-react";
import { TrendIcon } from "@/components/workspace/premium-icons";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useSmWorkspace } from "@/lib/sm/store";
import { fmtNumber, useSmApi } from "@/lib/sm/client";
import type { ManagerAnalyticsData } from "@/lib/sm/types";
import { SUBMISSION_STATUS_LABELS } from "@/lib/sm/types";
import {
  Chip, EmptyState, ErrorState, ExportButton, GlassCard, LoadingBlock, PageHeader, SectionCard,
} from "@/components/workspace/ui";

const STATUS_HUES: Record<string, string> = {
  APPROVED: "#20a779", SUBMITTED: "#3a7bff", UNDER_REVIEW: "#7c5cff",
  DRAFT: "#8a99ad", ASSIGNED: "#c57926", CHANGES_REQUESTED: "#c57926", REJECTED: "#c34a4a",
};

function ChartTip({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string; value?: number | string; color?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-strong rounded-2xl border-white/70 px-3.5 py-2.5 shadow-lg">
      {label !== undefined && <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[color:var(--ink-faint)]">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-[12.5px]">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-[color:var(--ink-soft)]">{p.name}</span>
          <span className="ml-auto font-semibold tabular text-[color:var(--ink)]">{typeof p.value === "number" ? fmtNumber(p.value, 1) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

const inkFaint = "var(--ink-faint)";

export default function AnalyticsView() {
  const { reportingYear, navigate } = useSmWorkspace();
  const { data, loading, error, refetch } = useSmApi<ManagerAnalyticsData>(
    `/api/sm/analytics?period=${encodeURIComponent(reportingYear)}`,
    { deps: [reportingYear] }
  );

  if (loading && !data) return <LoadingBlock rows={6} label="Loading analytics…" />;
  if (error && !data) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  const exportRows = [
    ...data.decisionTrend.map((d) => ({ series: "decision_trend", label: d.label, approved: d.approved, rejected: d.rejected })),
    ...data.completionByBU.map((d) => ({ series: "completion_by_bu", label: d.name, approved: d.approved, total: d.total, completionPct: d.completionPct })),
    ...data.reviewTurnaround.byMonth.map((d) => ({ series: "review_turnaround", label: d.label, avgDays: d.avgDays, decided: d.decided })),
    ...data.statusMix.map((d) => ({ series: "status_mix", label: d.label, count: d.count })),
    ...data.categoryPulse.map((d) => ({ series: "category_pulse", label: d.label, value: d.value, unit: d.unit, changePct: d.change })),
  ];

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="ESG Analytics"
        description={`Subsidiary-scoped reporting and review analytics for ${data.period}. Computed live from real submission records — never fabricated.`}
        icon={TrendingUp}
        actions={<ExportButton filename={`manager-analytics-${reportingYear.replace(/\s/g, "-")}`} rows={exportRows} />}
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Avg review turnaround", value: `${data.reviewTurnaround.avgDays}d`, hint: `${data.reviewTurnaround.decidedCount} decided reports` },
          { label: "Resubmission rate", value: `${data.resubmissionRate.pct}%`, hint: `${data.resubmissionRate.resubmitted} of ${data.resubmissionRate.rejected} rejected returned` },
          { label: "Evidence gaps", value: `${data.evidenceGaps.missing + data.evidenceGaps.expired}`, hint: `${data.evidenceGaps.missing} missing · ${data.evidenceGaps.expired} expired` },
          { label: "Awaiting review now", value: `${data.statusMix.filter((s) => ["SUBMITTED", "UNDER_REVIEW"].includes(s.status)).reduce((a, s) => a + s.count, 0)}`, hint: "Queue load" },
        ].map((c) => (
          <GlassCard key={c.label} className="p-4">
            <div className="text-[22px] font-bold tabular text-[color:var(--ink)]">{c.value}</div>
            <div className="mt-0.5 text-[11.5px] font-semibold text-[color:var(--esg-blue)]">{c.label}</div>
            <div className="text-[10.5px] text-[color:var(--ink-faint)]">{c.hint}</div>
          </GlassCard>
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        {/* Decision trend */}
        <SectionCard title="Decision trend — approvals vs rejections (6 months)" icon={TrendIcon}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.decisionTrend} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
              <CartesianGrid strokeDasharray="4 6" stroke="rgba(125,177,216,0.3)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: inkFaint }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: inkFaint }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(58,123,255,0.06)" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="approved" name="Approved" fill="#20a779" radius={[6, 6, 0, 0]} maxBarSize={26} />
              <Bar dataKey="rejected" name="Rejected" fill="#c34a4a" radius={[6, 6, 0, 0]} maxBarSize={26} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        {/* Review turnaround */}
        <SectionCard title="Review turnaround time (days from submission to decision)" icon={TrendIcon}>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.reviewTurnaround.byMonth} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
              <CartesianGrid strokeDasharray="4 6" stroke="rgba(125,177,216,0.3)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: inkFaint }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: inkFaint }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip />} />
              <Line type="monotone" dataKey="avgDays" name="Avg days" stroke="#3a7bff" strokeWidth={2.4} dot={{ r: 3.5, fill: "#3a7bff" }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </SectionCard>

        {/* Status mix */}
        <SectionCard title="Current workflow status mix" icon={TrendIcon}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.statusMix.filter((s) => s.count > 0)} layout="vertical" margin={{ top: 6, right: 16, left: 30, bottom: 0 }}>
              <CartesianGrid strokeDasharray="4 6" stroke="rgba(125,177,216,0.3)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: inkFaint }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="label" width={104} tick={{ fontSize: 11, fill: inkFaint }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(58,123,255,0.06)" }} />
              <Bar dataKey="count" name="Reports" radius={[0, 6, 6, 0]} maxBarSize={18} onClick={(d: { status?: string }) => d?.status && navigate("reports-bu", { statusFilter: d.status.toLowerCase() === "pending review" ? "pending" : d.status.toLowerCase() === "changes requested" ? "rejected" : d.status.toLowerCase() })}>
                {data.statusMix.filter((s) => s.count > 0).map((s) => (
                  <Cell key={s.status} fill={STATUS_HUES[s.status] ?? "#8a99ad"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        {/* Pending vs approved */}
        <SectionCard title="Pending vs approved by submission month" icon={TrendIcon}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.pendingVsApproved} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
              <CartesianGrid strokeDasharray="4 6" stroke="rgba(125,177,216,0.3)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: inkFaint }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: inkFaint }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(58,123,255,0.06)" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="pending" name="Pending review" stackId="a" fill="#c57926" radius={[0, 0, 0, 0]} maxBarSize={26} />
              <Bar dataKey="approved" name="Approved" stackId="a" fill="#20a779" radius={[6, 6, 0, 0]} maxBarSize={26} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        {/* Completion by BU */}
        <SectionCard title="Reporting completeness by BU" description="Click a bar to inspect that BU's reports." icon={TrendIcon}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.completionByBU} layout="vertical" margin={{ top: 6, right: 16, left: 30, bottom: 0 }}>
              <CartesianGrid strokeDasharray="4 6" stroke="rgba(125,177,216,0.3)" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: inkFaint }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={104} tick={{ fontSize: 11, fill: inkFaint }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(58,123,255,0.06)" }} />
              <Bar dataKey="completionPct" name="Completion %" fill="#3a7bff" radius={[0, 6, 6, 0]} maxBarSize={18} onClick={(d: { name?: string }) => d?.name && navigate("reports-bu", { q: d.name })} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        {/* Overdue by BU + evidence gaps */}
        <SectionCard title="Overdue & evidence gaps" icon={TrendIcon}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">Overdue by BU</div>
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={data.overdueByBU} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 6" stroke="rgba(125,177,216,0.3)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: inkFaint }} axisLine={false} tickLine={false} interval={0} angle={-14} dy={6} />
                  <YAxis tick={{ fontSize: 10, fill: inkFaint }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(195,74,74,0.06)" }} />
                  <Bar dataKey="overdue" name="Overdue" fill="#c34a4a" radius={[6, 6, 0, 0]} maxBarSize={22} onClick={() => navigate("queue", { statusFilter: "overdue" })} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">Evidence repository by type</div>
              <div className="space-y-1.5">
                {data.evidenceGaps.byType.length === 0 && <EmptyState title="No evidence yet" />}
                {data.evidenceGaps.byType.map((t) => (
                  <button key={t.type} onClick={() => navigate("evidence")} className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white/70">
                    <span className="text-[12.5px] font-medium text-[color:var(--ink-soft)]">{t.type}</span>
                    <Chip tone="blue">{t.count}</Chip>
                  </button>
                ))}
                {(data.evidenceGaps.missing > 0 || data.evidenceGaps.expired > 0) && (
                  <div className="mt-1.5 flex gap-1.5">
                    {data.evidenceGaps.missing > 0 && <Chip tone="amber">{data.evidenceGaps.missing} missing</Chip>}
                    {data.evidenceGaps.expired > 0 && <Chip tone="red">{data.evidenceGaps.expired} expired</Chip>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Category pulse */}
      <SectionCard title="Latest approved ESG metrics by category" description="Most recent approved value per category with change vs previous approved report." icon={TrendIcon}>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {data.categoryPulse.length === 0 && <EmptyState title="No approved metrics yet" message="Approve reports to build the category pulse." />}
          {data.categoryPulse.map((c) => (
            <button key={c.category} onClick={() => navigate("reports-bu", { statusFilter: "approved" })} className="glass-subtle flex items-center justify-between rounded-2xl p-3.5 text-left transition-all hover:-translate-y-0.5 hover:bg-white/80">
              <div className="min-w-0">
                <div className="text-[12.5px] font-semibold text-[color:var(--ink)]">{c.label}</div>
                <div className="text-[11px] text-[color:var(--ink-faint)]">{SUBMISSION_STATUS_LABELS.APPROVED} · {c.unit || "units"}</div>
              </div>
              <div className="text-right">
                <div className="text-[16px] font-bold tabular text-[color:var(--ink)]">{fmtNumber(c.value, 1)}</div>
                {c.change !== 0 && (
                  <div className={`text-[11px] font-semibold ${c.change > 0 ? "text-[#1d6b44]" : "text-[#a53b3b]"}`}>
                    {c.change > 0 ? "▲" : "▼"} {Math.abs(c.change)}%
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
