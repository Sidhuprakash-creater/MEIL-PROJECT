"use client";

// ── SUBSIDIARY ADMIN · SCREEN 01 — Command Center ──
import { useEffect, useState } from "react";
import {
  ArrowRight, Building2, CalendarClock, FileCheck2, Files, FlaskConical,
  Landmark, Layers, Package, ShieldAlert, Users,
} from "lucide-react";
import {
  AlarmAlertIcon, CheckSealIcon, FilesIcon, HourglassIcon, ProjectsIcon,
  PulseIcon, ReportChartIcon, ShieldIcon, UnitsIcon, UserPlusIcon, PeopleIcon,
} from "@/components/workspace/premium-icons";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useSaWorkspace } from "@/lib/sa/store";
import { fmtDate, fmtNumber, timeAgo, useSaApi } from "@/lib/sa/client";
import type { DashboardData } from "@/lib/sa/types";
import { DEADLINE_STATUS_LABELS } from "@/lib/sa/types";
import {
  Chip, CountUp, EmptyState, ErrorState, GlassCard, GlassProgress, LoadingBlock,
  PageHeader, SectionCard, StatusBadge,
} from "@/components/workspace/ui";

/* status hue map — sky blue primary, amber pending, red overdue, green approved */
const STATUS_HUE: Record<string, string> = {
  APPROVED: "#20a779", SUBMITTED: "#3a7bff", UNDER_REVIEW: "#7c5cff",
  DRAFT: "#8a99ad", ASSIGNED: "#c57926", CHANGES_REQUESTED: "#c57926", REJECTED: "#c34a4a",
};

function StatusCard({
  icon: Icon, hue, label, hint, value, onClick,
}: {
  icon: React.ComponentType<{ className?: string; hue?: string }>;
  hue: string; label: string; hint: string; value: number; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={`${label}: ${value}`}
      className="glass glass-sheen group relative flex flex-col gap-3 overflow-hidden rounded-[24px] p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/85 hover:shadow-[0_14px_34px_rgba(56,113,153,0.14)]"
    >
      <span className="absolute inset-x-0 top-0 h-[3px] opacity-80" style={{ background: `linear-gradient(90deg, ${hue}, ${hue}22)` }} />
      <div className="flex items-center justify-between">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-2xl text-white shadow-md"
          style={{ background: `linear-gradient(135deg, ${hue}, color-mix(in srgb, ${hue} 62%, #17263d))`, boxShadow: `0 6px 16px color-mix(in srgb, ${hue} 38%, transparent), inset 0 1px 0 rgba(255,255,255,0.4)` }}
        >
          <Icon className="h-[18px] w-[18px] text-white" />
        </span>
        <span className="text-[26px] font-bold tabular leading-none text-[color:var(--ink)]">
          <CountUp value={value} />
        </span>
      </div>
      <div className="min-w-0">
        <div className="truncate text-[13px] font-semibold" style={{ color: hue }}>{label}</div>
        <div className="truncate text-[11px] text-[color:var(--ink-faint)]">{hint}</div>
      </div>
    </button>
  );
}

function HeroTile({ icon: Icon, hue, label, note }: { icon: React.ComponentType<{ className?: string; hue?: string }>; hue: string; label: string; note?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="glass-strong flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-sm">
        <Icon className="h-5 w-5" hue={hue} />
      </span>
      <div className="min-w-0">
        <div className="text-[15px] font-bold leading-tight text-[color:var(--ink)]">{label}</div>
        {note && (
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#1d6b44]">
            <span className="relative flex h-1.5 w-1.5"><span className="absolute h-full w-full animate-ping rounded-full bg-[#238653] opacity-60" /><span className="relative h-1.5 w-1.5 rounded-full bg-[#238653]" /></span>
            {note}
          </div>
        )}
      </div>
    </div>
  );
}

const QUICK_ACTIONS = [
  { id: "units-create", icon: UnitsIcon, tint: "#3a7bff", label: "Add Business Unit", hint: "Register a new BU" },
  { id: "projects-create", icon: ProjectsIcon, tint: "#7c5cff", label: "Add Project", hint: "Under one of your BUs" },
  { id: "timelines-create", icon: HourglassIcon, tint: "#c57926", label: "Set Reporting Timeline", hint: "Deadlines & inheritance" },
  { id: "monitoring-submitted", icon: CheckSealIcon, tint: "#20a779", label: "View Submitted Reports", hint: "BU & project reports" },
  { id: "submissions-overdue", icon: AlarmAlertIcon, tint: "#c34a4a", label: "View Overdue Reports", hint: "Requires escalation" },
  { id: "evidence-open", icon: FilesIcon, tint: "#0ea5b7", label: "Open Evidence & Documents", hint: "Repository & gaps" },
  { id: "esg-prepare", icon: ReportChartIcon, tint: "#5b8c5a", label: "Prepare ESG Package", hint: "Submit to Group Admin" },
] as const;

export default function DashboardView() {
  const { navigate, reportingYear } = useSaWorkspace();
  const { data, loading, error, refetch } = useSaApi<DashboardData>(
    `/api/sa/dashboard?period=${encodeURIComponent(reportingYear)}`,
    { deps: [reportingYear] }
  );

  const [syncPulse, setSyncPulse] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setSyncPulse((n) => n + 1), 30000);
    return () => window.clearInterval(t);
  }, []);

  if (loading && !data) return <LoadingBlock rows={6} label="Loading your subsidiary command center…" />;
  if (error && !data) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  const k = data.kpis;
  const sub = data.subsidiary;

  const quickNav = (id: string) => {
    switch (id) {
      case "units-create": return navigate("units", { create: Date.now() });
      case "projects-create": return navigate("projects", { create: Date.now() });
      case "timelines-create": return navigate("timelines", { create: Date.now() });
      case "monitoring-submitted": return navigate("monitoring", { level: "ALL", statusFilter: "submitted" });
      case "submissions-overdue": return navigate("submissions", { tab: "overdue" });
      case "evidence-open": return navigate("evidence");
      case "esg-prepare": return navigate("esg", { prepare: Date.now() });
    }
  };

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title={`${sub.name} — Command Center`}
        description={`${data.period} · Live subsidiary reporting operations. Every figure below syncs from the shared platform database.`}
        icon={Landmark}
      />

      {/* ── hero: subsidiary identity + completion + sync ── */}
      <GlassCard className="relative overflow-hidden p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(32,167,121,0.14),transparent_65%)]" />
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex min-w-0 items-center gap-4">
            <span className="glass-strong glass-sheen flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl shadow-md">
              <span className="text-[18px] font-extrabold tracking-tight text-[color:var(--esg-blue)]">{sub.code.replace(/^SUB-/, "").slice(0, 3)}</span>
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-[19px] font-bold tracking-tight text-[color:var(--ink)]">{sub.name}</h1>
                <StatusBadge status="ACTIVE" />
              </div>
              <p className="mt-0.5 line-clamp-1 text-[12.5px] text-[color:var(--ink-faint)]">
                {sub.sector} · {sub.region} · Managed by {sub.managerName || "—"} · Admin {sub.adminName || "—"}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2.5">
                <HeroTile icon={UnitsIcon} hue="#3a7bff" label={`${k.totalBUs} Business Units`} note={`${k.activeBUs} active`} />
                <HeroTile icon={ProjectsIcon} hue="#7c5cff" label={`${k.totalProjects} Projects`} note={`${k.activeProjects} active`} />
                <HeroTile icon={PeopleIcon} hue="#20a779" label={`${k.totalUsers} Users`} note={`${k.activeUsers} active now`} />
              </div>
            </div>
          </div>
          <div className="glass-subtle flex items-center gap-4 rounded-3xl p-4">
            <div className="relative h-20 w-20">
              <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
                <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(58,123,255,0.12)" strokeWidth="9" />
                <circle
                  cx="40" cy="40" r="34" fill="none" stroke="#20a779" strokeWidth="9" strokeLinecap="round"
                  strokeDasharray={`${(k.completionPct / 100) * 213.6} 213.6`}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[16px] font-bold tabular text-[color:var(--ink)]">{k.completionPct}%</span>
            </div>
            <div>
              <div className="text-[12px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">Overall completion</div>
              <div className="mt-1 text-[13px] font-semibold text-[color:var(--ink-soft)]">Approved / total records</div>
              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[color:var(--ink-faint)]">
                <PulseIcon className="h-3.5 w-3.5 text-[#238653]" />
                Live · synced {syncPulse >= 0 ? timeAgo(useSaWorkspace.getState().lastSyncedAt) : "—"}
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* ── BU reporting section ── */}
      <div>
        <div className="mb-2.5 flex items-center gap-2">
          <UnitsIcon className="h-4 w-4 text-[color:var(--esg-blue)]" />
          <h2 className="text-[13px] font-bold uppercase tracking-widest text-[color:var(--ink-soft)]">BU Reports — {data.period}</h2>
          <Chip tone="blue">Business-unit level</Chip>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <StatusCard icon={CheckSealIcon} hue={STATUS_HUE.SUBMITTED} label="BU Submitted" hint="Sent by BU & project teams" value={k.buSubmitted} onClick={() => navigate("monitoring", { level: "BU", statusFilter: "submitted" })} />
          <StatusCard icon={HourglassIcon} hue={STATUS_HUE.UNDER_REVIEW} label="BU In Review" hint="With the Subsidiary Manager" value={k.buPending} onClick={() => navigate("monitoring", { level: "BU", statusFilter: "pending" })} />
          <StatusCard icon={AlarmAlertIcon} hue={STATUS_HUE.REJECTED} label="BU Overdue" hint="Past deadline, not approved" value={k.buOverdue} onClick={() => navigate("monitoring", { level: "BU", statusFilter: "overdue" })} />
          <StatusCard icon={CheckSealIcon} hue={STATUS_HUE.APPROVED} label="BU Approved" hint="Cleared for consolidation" value={k.buApproved} onClick={() => navigate("monitoring", { level: "BU", statusFilter: "approved" })} />
          <StatusCard icon={ShieldAlert} hue={STATUS_HUE.REJECTED} label="BU Rejected" hint="Awaiting correction" value={k.buRejected} onClick={() => navigate("monitoring", { level: "BU", statusFilter: "rejected" })} />
        </div>
      </div>

      {/* ── Project reporting section ── */}
      <div>
        <div className="mb-2.5 flex items-center gap-2">
          <ProjectsIcon className="h-4 w-4 text-[color:var(--esg-purple)]" />
          <h2 className="text-[13px] font-bold uppercase tracking-widest text-[color:var(--ink-soft)]">Project Reports — {data.period}</h2>
          <Chip tone="purple">Project / site level</Chip>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <StatusCard icon={CheckSealIcon} hue={STATUS_HUE.SUBMITTED} label="Project Submitted" hint="Sent by BU & project teams" value={k.prjSubmitted} onClick={() => navigate("monitoring", { level: "PROJECT", statusFilter: "submitted" })} />
          <StatusCard icon={HourglassIcon} hue={STATUS_HUE.UNDER_REVIEW} label="Project In Review" hint="With the Subsidiary Manager" value={k.prjPending} onClick={() => navigate("monitoring", { level: "PROJECT", statusFilter: "pending" })} />
          <StatusCard icon={AlarmAlertIcon} hue={STATUS_HUE.REJECTED} label="Project Overdue" hint="Past deadline, not approved" value={k.prjOverdue} onClick={() => navigate("monitoring", { level: "PROJECT", statusFilter: "overdue" })} />
          <StatusCard icon={CheckSealIcon} hue={STATUS_HUE.APPROVED} label="Project Approved" hint="Cleared for consolidation" value={k.prjApproved} onClick={() => navigate("monitoring", { level: "PROJECT", statusFilter: "approved" })} />
          <StatusCard icon={ShieldAlert} hue={STATUS_HUE.REJECTED} label="Project Rejected" hint="Awaiting correction" value={k.prjRejected} onClick={() => navigate("monitoring", { level: "PROJECT", statusFilter: "rejected" })} />
        </div>
      </div>

      {/* ── secondary indicators + quick actions ── */}
      <div className="grid gap-3 lg:grid-cols-3">
        <GlassCard className="p-4">
          <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">
            <FlaskConical className="h-4 w-4 text-[#c57926]" /> Attention queue
          </div>
          <div className="mt-3 space-y-2.5">
            <button onClick={() => navigate("monitoring", { level: "ALL", statusFilter: "pending" })} className="flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-white/70">
              <span className="text-[13px] font-medium text-[color:var(--ink-soft)]">Awaiting Subsidiary Manager review</span>
              <span className="text-[15px] font-bold tabular text-[color:var(--ink)]">{k.awaitingReview}</span>
            </button>
            <button onClick={() => navigate("monitoring", { level: "ALL", statusFilter: "rejected" })} className="flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-white/70">
              <span className="text-[13px] font-medium text-[color:var(--ink-soft)]">Rejected — correction needed</span>
              <span className="text-[15px] font-bold tabular text-[color:var(--ink)]">{k.rejectedCorrection}</span>
            </button>
            <button onClick={() => navigate("validation")} className="flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-white/70">
              <span className="text-[13px] font-medium text-[color:var(--ink-soft)]">Open validation issues</span>
              <span className="text-[15px] font-bold tabular text-[color:var(--ink)]">{k.openValidationIssues}</span>
            </button>
            <button onClick={() => navigate("esg")} className="flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-white/70">
              <span className="text-[13px] font-medium text-[color:var(--ink-soft)]">Packages with Group</span>
              <span className="text-[15px] font-bold tabular text-[color:var(--ink)]">{k.pendingPackages}</span>
            </button>
          </div>
        </GlassCard>

        <GlassCard className="p-4 lg:col-span-2">
          <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">
            <FileCheck2 className="h-4 w-4 text-[#20a779]" /> Quick actions
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
            {QUICK_ACTIONS.map((qa) => (
              <button
                key={qa.id}
                onClick={() => quickNav(qa.id)}
                className="glass-subtle group flex items-center gap-2.5 rounded-2xl p-2.5 text-left transition-all hover:-translate-y-0.5 hover:bg-white/80"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: `linear-gradient(135deg, ${qa.tint}, color-mix(in srgb, ${qa.tint} 60%, #17263d))` }}>
                  <qa.icon className="h-4 w-4 text-white" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[12px] font-semibold text-[color:var(--ink)]">{qa.label}</span>
                  <span className="block truncate text-[10.5px] text-[color:var(--ink-faint)]">{qa.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* ── charts row ── */}
      <div className="grid gap-3 xl:grid-cols-2">
        <SectionCard title="Reporting completion by BU" icon={Layers} actions={<Button variant="ghost" size="sm" className="h-7 rounded-xl text-xs" onClick={() => navigate("units")}>Open BU management <ArrowRight className="ml-1 h-3 w-3" /></Button>}>
          <div className="space-y-3">
            {data.completionByBU.length === 0 && <EmptyState title="No business units yet" message="Add your first business unit to start reporting." />}
            {data.completionByBU.map((b, i) => (
              <motion.div key={b.name} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                <div className="mb-1 flex items-center justify-between text-[12px]">
                  <button className="font-semibold text-[color:var(--ink)] hover:text-[color:var(--esg-blue)] hover:underline" onClick={() => navigate("units", { detailId: data.completionByBU[i] && undefined, q: b.name })}>{b.name}</button>
                  <span className="tabular text-[color:var(--ink-faint)]">{b.approved}/{b.total} approved · {b.completionPct}%</span>
                </div>
                <GlassProgress value={b.completionPct} tone={b.completionPct >= 80 ? "green" : b.completionPct >= 40 ? "blue" : "amber"} />
              </motion.div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Submission trend — 6 months" icon={ReportChartIcon}>
          <div className="flex h-44 items-end gap-3 px-1">
            {data.submissionTrend.map((m) => {
              const max = Math.max(...data.submissionTrend.map((x) => x.submitted), 1);
              return (
                <div key={m.label} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="flex h-36 w-full items-end justify-center gap-1">
                    <motion.div
                      className="w-1/3 rounded-t-lg bg-gradient-to-t from-[#3a7bff] to-[#7db2ff]"
                      initial={{ height: 0 }} animate={{ height: `${(m.submitted / max) * 100}%` }} transition={{ duration: 0.5 }}
                      title={`${m.submitted} submitted`}
                    />
                    <motion.div
                      className="w-1/3 rounded-t-lg bg-gradient-to-t from-[#20a779] to-[#5fd3a8]"
                      initial={{ height: 0 }} animate={{ height: `${(m.approved / max) * 100}%` }} transition={{ duration: 0.5, delay: 0.1 }}
                      title={`${m.approved} approved`}
                    />
                  </div>
                  <span className="text-[10.5px] font-medium text-[color:var(--ink-faint)]">{m.label}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-[color:var(--ink-faint)]">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#3a7bff]" /> Submitted</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#20a779]" /> Approved</span>
          </div>
        </SectionCard>
      </div>

      {/* ── deadlines / overdue / activity ── */}
      <div className="grid gap-3 xl:grid-cols-3">
        <SectionCard title="Upcoming deadlines" icon={CalendarClock} actions={<Button variant="ghost" size="sm" className="h-7 rounded-xl text-xs" onClick={() => navigate("timelines")}>Timelines <ArrowRight className="ml-1 h-3 w-3" /></Button>}>
          <div className="space-y-2">
            {data.upcomingDeadlines.length === 0 && <EmptyState title="No upcoming deadlines" message="Set reporting timelines to see them here." />}
            {data.upcomingDeadlines.map((d) => (
              <button key={`${d.level}-${d.id}`} onClick={() => navigate("timelines")} className="flex w-full items-center justify-between gap-2 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-white/70">
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-semibold text-[color:var(--ink)]">{d.name}</span>
                  <span className="block truncate text-[10.5px] text-[color:var(--ink-faint)]">{DEADLINE_STATUS_LABELS[d.status] ?? d.status} · due {fmtDate(d.dueDate)}</span>
                </span>
                <Chip tone={d.daysLeft <= 7 ? "red" : d.daysLeft <= 14 ? "amber" : "blue"}>{d.daysLeft}d</Chip>
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Overdue items" icon={AlarmAlertIcon} actions={<Button variant="ghost" size="sm" className="h-7 rounded-xl text-xs" onClick={() => navigate("submissions", { tab: "overdue" })}>All overdue <ArrowRight className="ml-1 h-3 w-3" /></Button>}>
          <div className="space-y-2">
            {data.overdueItems.length === 0 && <EmptyState title="Nothing overdue" message="Every record is inside its deadline. Keep it up!" />}
            {data.overdueItems.map((o) => (
              <button key={o.ref} onClick={() => navigate("submissions", { tab: "overdue", ref: o.ref })} className="flex w-full items-center justify-between gap-2 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-white/70">
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-semibold text-[color:var(--ink)]">{o.title}</span>
                  <span className="block truncate text-[10.5px] text-[color:var(--ink-faint)]">{o.level} · {o.org} · owner {o.owner}</span>
                </span>
                <Chip tone="red">{o.daysLate}d late</Chip>
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Recent activity" icon={PulseIcon} actions={<Button variant="ghost" size="sm" className="h-7 rounded-xl text-xs" onClick={() => navigate("activity")}>Feed <ArrowRight className="ml-1 h-3 w-3" /></Button>}>
          <div className="space-y-2">
            {data.recentActivity.length === 0 && <EmptyState title="No activity yet" message="Subsidiary actions will appear here." />}
            {data.recentActivity.map((a) => (
              <div key={a.id} className="flex items-start gap-2.5 rounded-2xl px-2 py-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: a.severity === "WARNING" ? "#c57926" : a.severity === "CRITICAL" ? "#c34a4a" : "#3a7bff" }} />
                <div className="min-w-0">
                  <div className="truncate text-[12px] text-[color:var(--ink)]"><strong className="font-semibold">{a.actorName}</strong> · {a.action.replace(/_/g, " ").toLowerCase()} {a.targetLabel && <span className="text-[color:var(--ink-soft)]">— {a.targetLabel}</span>}</div>
                  <div className="text-[10.5px] text-[color:var(--ink-faint)]">{timeAgo(a.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* footer stat strip */}
      <GlassCard className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex flex-wrap items-center gap-5">
          <span className="flex items-center gap-2 text-[12px] font-medium text-[color:var(--ink-soft)]"><Users className="h-4 w-4 text-[color:var(--esg-blue)]" /> {fmtNumber(k.totalUsers)} users in scope</span>
          <span className="flex items-center gap-2 text-[12px] font-medium text-[color:var(--ink-soft)]"><Building2 className="h-4 w-4 text-[color:var(--esg-blue)]" /> {fmtNumber(k.totalBUs)} BUs · {fmtNumber(k.totalProjects)} projects</span>
          <span className="flex items-center gap-2 text-[12px] font-medium text-[color:var(--ink-soft)]"><Package className="h-4 w-4 text-[#20a779]" /> {fmtNumber(k.pendingPackages)} package(s) with Group</span>
          <span className="flex items-center gap-2 text-[12px] font-medium text-[color:var(--ink-soft)]"><ShieldIcon className="h-4 w-4 text-[color:var(--esg-purple)]" /> Scope enforced server-side ({sub.code})</span>
        </div>
      </GlassCard>
    </div>
  );
}
