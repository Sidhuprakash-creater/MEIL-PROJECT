"use client";

// ── SCREEN 01 — Group Command Center ──
import { useMemo } from "react";
import {
  Activity as ActivityIcon,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  CalendarClock,
  ClipboardList,
  Clock,
  Database,
  FileCheck2,
  FileText,
  Landmark,
  Layers,
  LayoutDashboard,
  ListChecks,
  ListTodo,
  Megaphone,
  ShieldAlert,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useWorkspace } from "@/lib/esg/store";
import { useApi, fmtDate, fmtNumber, timeAgo } from "@/lib/esg/client";
import { ROLE_LABELS, type DashboardData, type Subsidiary } from "@/lib/esg/types";
import {
  Avatar,
  Chip,
  CountUp,
  EmptyState,
  ErrorState,
  GlassProgress,
  KpiCard,
  LoadingBlock,
  PageHeader,
  SectionCard,
  StatusBadge,
} from "@/components/workspace/ui";

/* ────────────────────────────── Glass chart tooltip ────────────────────────────── */

interface TipItem {
  name?: string | number;
  value?: string | number;
  color?: string;
  stroke?: string;
  fill?: string;
}

function GlassChartTip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TipItem[];
  label?: string | number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="glass-strong rounded-2xl border-white/70 px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-semibold text-[color:var(--ink)]">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-[color:var(--ink-soft)]">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.stroke ?? p.color ?? p.fill ?? "#3a7bff" }} />
          <span>{p.name}:</span>
          <span className="tabular font-medium text-[color:var(--ink)]">
            {typeof p.value === "number" ? fmtNumber(p.value, 1) : (p.value ?? "—")}
          </span>
        </div>
      ))}
    </div>
  );
}

function ChartLegend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5 text-xs text-[color:var(--ink-soft)]">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: it.dashed ? "transparent" : it.color, border: it.dashed ? `2px solid ${it.color}` : undefined }}
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}

/* ────────────────────────────── View ────────────────────────────── */

export default function DashboardView() {
  const { reportingYear, navigate, openDetail } = useWorkspace();
  const { data, loading, error, refetch } = useApi<DashboardData>("/api/esg/dashboard");
  const { data: subsData } = useApi<{ subsidiaries: Subsidiary[] }>("/api/esg/org?type=subsidiaries");

  const subIdByName = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of subsData?.subsidiaries ?? []) m.set(s.name, s.id);
    return m;
  }, [subsData]);

  if (error && !data) {
    return (
      <div className="view-in space-y-5">
        <PageHeader title="Group Command Center" icon={LayoutDashboard} breadcrumbs={["Group", "Overview", "Dashboard"]} />
        <SectionCard><ErrorState message={error} onRetry={refetch} /></SectionCard>
      </div>
    );
  }
  if (loading && !data) {
    return (
      <div className="view-in space-y-5">
        <PageHeader title="Group Command Center" icon={LayoutDashboard} breadcrumbs={["Group", "Overview", "Dashboard"]} />
        <LoadingBlock rows={6} label="Loading group KPIs…" />
      </div>
    );
  }
  if (!data) return null;

  const k = data.kpis;

  const quickActions: { label: string; icon: typeof UserPlus; hint: string; run: () => void }[] = [
    { label: "Invite user", icon: UserPlus, hint: "Add a new team member", run: () => navigate("users", { create: Date.now() }) },
    { label: "Assign task", icon: ListTodo, hint: "Create a reporting task", run: () => navigate("tasks", { create: Date.now() }) },
    { label: "New BRSR report", icon: FileText, hint: "Start the BRSR wizard", run: () => navigate("brsr", { wizard: Date.now() }) },
    { label: "Send announcement", icon: Megaphone, hint: "Broadcast to the group", run: () => navigate("comms", { create: Date.now() }) },
    { label: "Review queue", icon: FileCheck2, hint: "Submissions awaiting review", run: () => navigate("approvals") },
    { label: "Consolidation", icon: Database, hint: "Validate & consolidate data", run: () => navigate("consolidation") },
  ];

  return (
    <div className="view-in space-y-5">
      <PageHeader
        title="Group Command Center"
        icon={LayoutDashboard}
        breadcrumbs={["Group", "Overview", "Dashboard"]}
        actions={
          <>
            <span className="glass-subtle inline-flex items-center gap-1.5 rounded-2xl px-3 py-2 text-[13px] font-medium text-[color:var(--ink-soft)]">
              <CalendarClock className="h-4 w-4 text-[color:var(--esg-blue)]" aria-hidden="true" />
              {reportingYear}
            </span>
            <button
              onClick={() => navigate("approvals")}
              className="glass inline-flex h-10 items-center gap-1.5 rounded-2xl border-white/60 px-4 text-[13px] font-medium text-[color:var(--ink)] transition-colors hover:bg-white/70"
            >
              <FileCheck2 className="h-4 w-4 text-[color:var(--esg-blue)]" aria-hidden="true" />
              Review queue
              {k.pendingReview > 0 && (
                <span className="rounded-full bg-[rgba(58,123,255,0.15)] px-1.5 py-px text-[11px] font-semibold text-[#1d5fd6]">{k.pendingReview}</span>
              )}
            </button>
          </>
        }
      />

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
        <KpiCard label="Total Subsidiaries" icon={Landmark} tone="blue" onClick={() => navigate("subsidiaries")}
          value={<CountUp value={k.subsidiaries} format={(n) => fmtNumber(Math.round(n))} />} />
        <KpiCard label="Business Units" icon={Layers} tone="purple" onClick={() => navigate("units")}
          value={<CountUp value={k.businessUnits} format={(n) => fmtNumber(Math.round(n))} />} />
        <KpiCard label="Projects & Sites" icon={Building2} tone="teal" onClick={() => navigate("projects")}
          value={<CountUp value={k.projects} format={(n) => fmtNumber(Math.round(n))} />} />
        <KpiCard label="Total Users" icon={Users} tone="blue" hint={`${k.activeUsers} active · ${k.inactiveUsers} inactive`} onClick={() => navigate("users")}
          value={<CountUp value={k.users} format={(n) => fmtNumber(Math.round(n))} />} />
        <KpiCard label="Submitted Reports" icon={ClipboardList} tone="purple" onClick={() => navigate("submissions")}
          value={<CountUp value={k.submissions} format={(n) => fmtNumber(Math.round(n))} />} />
        <KpiCard label="Pending Review" icon={FileCheck2} tone="amber" onClick={() => navigate("approvals")}
          value={<CountUp value={k.pendingReview} format={(n) => fmtNumber(Math.round(n))} />} />
        <KpiCard label="Approved" icon={BadgeCheck} tone="green" onClick={() => navigate("submissions", { statusFilter: "APPROVED" })}
          value={<CountUp value={k.approved} format={(n) => fmtNumber(Math.round(n))} />} />
        <KpiCard label="Rejected / Returned" icon={AlertTriangle} tone="red" onClick={() => navigate("submissions", { statusFilter: "REJECTED" })}
          value={<CountUp value={k.rejectedReturned} format={(n) => fmtNumber(Math.round(n))} />} />
        <KpiCard label="Overdue" icon={Clock} tone="red" onClick={() => navigate("submissions", { statusFilter: "OVERDUE" })}
          trend={k.overdue > 0 ? { dir: "up", text: `${k.overdue} flagged`, good: false } : { dir: "down", text: "All clear", good: true }}
          value={<CountUp value={k.overdue} format={(n) => fmtNumber(Math.round(n))} />} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectionCard title="ESG performance trend" description="Scope 1 & 2 emissions (tCO2e) with renewable share on the right axis" icon={TrendingUp}>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.esgTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(102,119,141,0.16)" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "#8595ab", fontSize: 11 }} />
              <YAxis yAxisId="left" width={48} tickLine={false} axisLine={false} tick={{ fill: "#8595ab", fontSize: 11 }} tickFormatter={(v: number) => fmtNumber(v)} />
              <YAxis yAxisId="right" orientation="right" width={40} tickLine={false} axisLine={false} tick={{ fill: "#8595ab", fontSize: 11 }} tickFormatter={(v: number) => `${v}%`} />
              <Tooltip content={<GlassChartTip />} cursor={{ stroke: "rgba(58,123,255,0.3)", strokeWidth: 1 }} />
              <Line yAxisId="left" type="monotone" dataKey="scope1" name="Scope 1" stroke="#3a7bff" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
              <Line yAxisId="left" type="monotone" dataKey="scope2" name="Scope 2" stroke="#6a5bff" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
              <Line yAxisId="right" type="monotone" dataKey="renewable" name="Renewable %" stroke="#16a3a3" strokeWidth={2.5} strokeDasharray="5 4" dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
          <ChartLegend
            items={[
              { label: "Scope 1 (tCO2e)", color: "#3a7bff" },
              { label: "Scope 2 (tCO2e)", color: "#6a5bff" },
              { label: "Renewable share (%)", color: "#16a3a3", dashed: true },
            ]}
          />
        </SectionCard>

        <SectionCard title="Submission completion" description="Reports received vs completed (approved) by month" icon={BarChart3}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.completionByMonth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(102,119,141,0.16)" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "#8595ab", fontSize: 11 }} />
              <YAxis allowDecimals={false} width={36} tickLine={false} axisLine={false} tick={{ fill: "#8595ab", fontSize: 11 }} />
              <Tooltip content={<GlassChartTip />} cursor={{ fill: "rgba(58,123,255,0.06)" }} />
              <Bar dataKey="received" name="Received" fill="rgba(58,123,255,0.45)" radius={[6, 6, 0, 0]} maxBarSize={28} />
              <Bar dataKey="completed" name="Completed" fill="#238653" radius={[6, 6, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
          <ChartLegend
            items={[
              { label: "Received", color: "rgba(58,123,255,0.45)" },
              { label: "Completed (approved)", color: "#238653" },
            ]}
          />
        </SectionCard>
      </div>

      {/* Org progress + role performance */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectionCard
          title="Subsidiary reporting progress"
          description="Approved submissions out of total, per subsidiary"
          icon={Landmark}
          actions={<Chip tone="gray">{data.orgProgress.length} subsidiaries</Chip>}
        >
          {data.orgProgress.length === 0 ? (
            <EmptyState title="No subsidiaries yet" message="Create your first subsidiary to see reporting progress here." />
          ) : (
            <div className="flex flex-col gap-1">
              {data.orgProgress.map((op) => {
                const pct = op.total > 0 ? (op.approved / op.total) * 100 : 0;
                const id = subIdByName.get(op.name);
                return (
                  <button
                    key={op.name}
                    onClick={() => (id ? openDetail("subsidiaries", id, "overview") : navigate("subsidiaries"))}
                    className="group w-full rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-white/60"
                    aria-label={`Open ${op.name} details`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-[13px] font-semibold text-[color:var(--ink)] group-hover:text-[color:var(--esg-blue)]">
                        {op.name}
                        <span className="ml-2 font-normal text-[color:var(--ink-faint)]">{op.level}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {op.overdue > 0 && <Chip tone="red">{op.overdue} overdue</Chip>}
                        <span className="tabular text-xs font-medium text-[color:var(--ink-soft)]">
                          {op.approved}/{op.total}
                        </span>
                      </span>
                    </div>
                    <GlassProgress className="mt-2" value={pct} tone={op.overdue > 0 ? "amber" : "green"} />
                  </button>
                );
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Role-wise performance" description="Approval rate of submissions by contributor role" icon={Users}>
          {data.rolePerformance.length === 0 ? (
            <EmptyState title="No role data yet" message="Role performance appears once users start submitting reports." />
          ) : (
            <div className="flex flex-col gap-3.5">
              {data.rolePerformance.map((rp) => {
                const pct = rp.total > 0 ? (rp.approved / rp.total) * 100 : 0;
                return (
                  <div key={rp.role}>
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-medium text-[color:var(--ink-soft)]">{ROLE_LABELS[rp.role] ?? rp.role.replaceAll("_", " ")}</span>
                      <span className="tabular text-[color:var(--ink-faint)]">
                        {rp.approved}/{rp.total} approved · {rp.onTime} on time
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[rgba(102,119,141,0.14)]">
                      <div className="h-full rounded-full bg-[#3a7bff]" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Approvals / deadlines / data quality */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <SectionCard
          title="Pending approvals"
          description="Submissions waiting for your review"
          icon={FileCheck2}
          actions={<Chip tone={data.pendingApprovals.length > 0 ? "amber" : "green"}>{data.pendingApprovals.length}</Chip>}
        >
          {data.pendingApprovals.length === 0 ? (
            <EmptyState title="Queue is clear" message="No submissions are awaiting review right now." icon={BadgeCheck} />
          ) : (
            <div className="flex flex-col gap-1">
              {data.pendingApprovals.map((pa) => (
                <button
                  key={pa.id}
                  onClick={() => openDetail("approvals", pa.id)}
                  className="group rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-white/60"
                  aria-label={`Review ${pa.title}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="line-clamp-1 text-[13px] font-semibold text-[color:var(--ink)] group-hover:text-[color:var(--esg-blue)]">{pa.title}</span>
                    <StatusBadge status={pa.status} />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-[color:var(--ink-faint)]">
                    <span className="font-medium">{pa.ref}</span>
                    <span>·</span>
                    <span>{pa.subsidiaryName ?? "—"}</span>
                    <span>·</span>
                    <span>by {pa.submittedByName ?? "—"}</span>
                    <span>·</span>
                    <span>due {fmtDate(pa.dueDate)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Upcoming & overdue deadlines"
          description="Reporting tasks ordered by due date"
          icon={Clock}
          actions={<Chip tone="gray">{data.deadlines.length}</Chip>}
        >
          {data.deadlines.length === 0 ? (
            <EmptyState title="No open deadlines" message="All reporting tasks are completed." icon={ListChecks} />
          ) : (
            <div className="flex flex-col gap-1">
              {data.deadlines.map((d) => (
                <button
                  key={d.id}
                  onClick={() => openDetail("tasks", d.id)}
                  className="group rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-white/60"
                  aria-label={`Open task ${d.title}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="line-clamp-1 text-[13px] font-semibold text-[color:var(--ink)] group-hover:text-[color:var(--esg-blue)]">{d.title}</span>
                    <StatusBadge status={d.priority} />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-[color:var(--ink-faint)]">
                    <span className="font-medium">{d.ref}</span>
                    <span>·</span>
                    <span>{d.assigneeLabel}</span>
                    <span>·</span>
                    <span>due {fmtDate(d.dueDate)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Data quality issues"
          description="Flagged by reviewers & validation engine"
          icon={ShieldAlert}
          actions={<Chip tone={data.dataQuality.length > 0 ? "red" : "green"}>{data.dataQuality.length}</Chip>}
        >
          {data.dataQuality.length === 0 ? (
            <EmptyState title="No quality issues" message="All submissions passed validation." icon={BadgeCheck} />
          ) : (
            <div className="flex flex-col gap-1">
              {data.dataQuality.map((dq) => {
                const critical = dq.severity === "CRITICAL";
                const Icon = critical ? AlertOctagon : AlertTriangle;
                return (
                  <button
                    key={dq.id}
                    onClick={() => navigate("consolidation")}
                    className="group flex items-start gap-2.5 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-white/60"
                    aria-label={`Investigate ${dq.title}`}
                  >
                    <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${critical ? "bg-[rgba(195,74,74,0.12)] text-[#c34a4a]" : "bg-[rgba(197,121,38,0.13)] text-[#c57926]"}`}>
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="line-clamp-1 text-[13px] font-semibold text-[color:var(--ink)] group-hover:text-[color:var(--esg-blue)]">{dq.title}</span>
                      <span className="mt-0.5 line-clamp-2 block text-xs text-[color:var(--ink-faint)]">{dq.issue}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Activity feed */}
      <SectionCard
        title="Recent activity"
        description="Latest actions across the organization"
        icon={ActivityIcon}
        actions={
          <button onClick={() => navigate("activity")} className="inline-flex items-center gap-1 text-xs font-medium text-[color:var(--esg-blue)] hover:underline">
            Open activity feed <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </button>
        }
      >
        {data.activityFeed.length === 0 ? (
          <EmptyState title="No recent activity" message="User actions will appear here as they happen." />
        ) : (
          <div className="flex flex-col divide-y divide-[rgba(125,177,216,0.18)]">
            {data.activityFeed.map((a) => (
              <button
                key={a.id}
                onClick={() => navigate("activity")}
                className="flex items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition-colors first:pt-0 last:pb-0 hover:bg-white/50"
                aria-label={`Activity by ${a.actorName}`}
              >
                <Avatar name={a.actorName || "System"} size={34} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-[color:var(--ink-soft)]">
                    <span className="font-semibold text-[color:var(--ink)]">{a.actorName}</span>
                    <span className="mx-1.5 rounded-md bg-[rgba(58,123,255,0.1)] px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-[#1d5fd6]">
                      {a.action.replaceAll("_", " ")}
                    </span>
                    {a.targetLabel}
                  </span>
                  <span className="mt-0.5 block text-xs text-[color:var(--ink-faint)]">
                    {ROLE_LABELS[a.actorRole] ?? a.actorRole.replaceAll("_", " ")} · {a.orgLabel} · {timeAgo(a.createdAt)}
                  </span>
                </span>
                {a.severity === "WARNING" && <Chip tone="amber">Warning</Chip>}
              </button>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Quick actions */}
      <SectionCard title="Quick actions" description="Jump straight into the most common group-admin workflows" icon={ListChecks}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {quickActions.map((qa) => (
            <button
              key={qa.label}
              onClick={qa.run}
              className="glass-subtle flex flex-col items-start gap-2 rounded-2xl border-white/50 p-3.5 text-left transition-all hover:-translate-y-0.5 hover:bg-white/70"
              aria-label={qa.label}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[rgba(58,123,255,0.12)]">
                <qa.icon className="h-4 w-4 text-[#3a7bff]" aria-hidden="true" />
              </span>
              <span className="text-[13px] font-semibold text-[color:var(--ink)]">{qa.label}</span>
              <span className="text-xs leading-snug text-[color:var(--ink-faint)]">{qa.hint}</span>
            </button>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
