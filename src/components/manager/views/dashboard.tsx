"use client";

// ── SUBSIDIARY MANAGER · SCREEN 01 — Review Dashboard ──
import { useEffect, useState } from "react";
import { ArrowRight, CalendarClock, CheckCheck, Clock, FileCheck2, Landmark, Undo2 } from "lucide-react";
import {
  AlarmAlertIcon, CheckSealIcon, FilesIcon, HourglassIcon, ProjectsIcon,
  PulseIcon, ShieldIcon, UnitsIcon, WorkflowIcon,
} from "@/components/workspace/premium-icons";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useSmWorkspace } from "@/lib/sm/store";
import { fmtDate, fmtNumber, timeAgo, useSmApi } from "@/lib/sm/client";
import type { ManagerDashboardData } from "@/lib/sm/types";
import { DEADLINE_STATUS_LABELS } from "@/lib/sm/types";
import {
  Chip, CountUp, EmptyState, ErrorState, GlassCard, GlassProgress, LoadingBlock,
  PageHeader, SectionCard, StatusBadge,
} from "@/components/workspace/ui";
import { STATUS_HUE, StatusChip } from "@/components/manager/shared";

function StatusCard({
  icon: Icon, hue, label, hint, value, onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
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

export default function DashboardView() {
  const { navigate, reportingYear } = useSmWorkspace();
  const { data, loading, error, refetch } = useSmApi<ManagerDashboardData>(
    `/api/sm/dashboard?period=${encodeURIComponent(reportingYear)}`,
    { deps: [reportingYear] }
  );

  const [syncPulse, setSyncPulse] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setSyncPulse((n) => n + 1), 30000);
    return () => window.clearInterval(t);
  }, []);

  if (loading && !data) return <LoadingBlock rows={6} label="Loading your review command center…" />;
  if (error && !data) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  const k = data.kpis;
  const sub = data.subsidiary;
  const trendMax = Math.max(...data.decisionTrend.map((d) => d.approved + d.rejected), 1);

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title={`${sub.name} — Review Dashboard`}
        description={`${data.period} · Report verification command center. Every figure is scoped to your subsidiary and syncs from the shared platform database.`}
        icon={Landmark}
      />

      {/* ── hero: identity + review load + completion ── */}
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
                {sub.sector} · {sub.region} · Manager {sub.managerName || "—"} · Admin {sub.adminName || "—"}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2.5">
                <button onClick={() => navigate("reports-bu")} className="flex items-center gap-2 rounded-2xl px-2 py-1 transition-colors hover:bg-white/70">
                  <UnitsIcon className="h-5 w-5" hue="#3a7bff" />
                  <span className="text-[13.5px] font-bold text-[color:var(--ink)]">{k.totalBUs} <span className="font-medium text-[color:var(--ink-faint)]">Business Units</span></span>
                </button>
                <button onClick={() => navigate("reports-project")} className="flex items-center gap-2 rounded-2xl px-2 py-1 transition-colors hover:bg-white/70">
                  <ProjectsIcon className="h-5 w-5" hue="#7c5cff" />
                  <span className="text-[13.5px] font-bold text-[color:var(--ink)]">{k.totalProjects} <span className="font-medium text-[color:var(--ink-faint)]">Projects</span></span>
                </button>
                <button onClick={() => navigate("queue")} className="flex items-center gap-2 rounded-2xl px-2 py-1 transition-colors hover:bg-white/70">
                  <span className="relative flex h-2 w-2"><span className="absolute h-full w-full animate-ping rounded-full bg-[#238653] opacity-60" /><span className="relative h-2 w-2 rounded-full bg-[#238653]" /></span>
                  <span className="text-[13.5px] font-bold text-[#1d6b44]">{k.awaitingReview} <span className="font-medium text-[color:var(--ink-faint)]">awaiting your review</span></span>
                </button>
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
              <div className="text-[12px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">Approved share</div>
              <div className="mt-1 text-[13px] font-semibold text-[color:var(--ink-soft)]">of all non-draft records</div>
              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[color:var(--ink-faint)]">
                <PulseIcon className="h-3.5 w-3.5 text-[#238653]" />
                Live · synced {syncPulse >= 0 ? timeAgo(useSmWorkspace.getState().lastSyncedAt) : "—"}
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* ── review workload ── */}
      <div>
        <div className="mb-2.5 flex items-center gap-2">
          <CheckSealIcon className="h-4 w-4 text-[color:var(--esg-blue)]" />
          <h2 className="text-[13px] font-bold uppercase tracking-widest text-[color:var(--ink-soft)]">My review workload</h2>
          <Chip tone="blue">Decisions stay with you</Chip>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatusCard icon={CheckSealIcon} hue={STATUS_HUE.UNDER_REVIEW} label="Awaiting my review" hint="Submitted + in review" value={k.awaitingReview} onClick={() => navigate("queue")} />
          <StatusCard icon={Clock} hue="#c57926" label="Approaching deadline" hint="Review due within 7 days" value={k.dueSoonReview} onClick={() => navigate("deadlines")} />
          <StatusCard icon={AlarmAlertIcon} hue={STATUS_HUE.REJECTED} label="Overdue review actions" hint="Past review deadline" value={k.overdueReview} onClick={() => navigate("queue", { statusFilter: "overdue" })} />
          <StatusCard icon={WorkflowIcon} hue="#c57926" label="Rejected — correcting" hint="Awaiting user corrections" value={k.rejectedCorrection} onClick={() => navigate("corrections")} />
          <StatusCard icon={Undo2} hue="#7c5cff" label="Resubmissions" hint="Corrected, back in queue" value={k.resubmissions} onClick={() => navigate("corrections", { tab: "resubmitted" })} />
          <StatusCard icon={CheckCheck} hue={STATUS_HUE.APPROVED} label="Completed reviews" hint="Decisions recorded by you" value={k.completedReviews} onClick={() => navigate("activity")} />
        </div>
      </div>

      {/* ── BU reporting status ── */}
      <div>
        <div className="mb-2.5 flex items-center gap-2">
          <UnitsIcon className="h-4 w-4 text-[color:var(--esg-blue)]" />
          <h2 className="text-[13px] font-bold uppercase tracking-widest text-[color:var(--ink-soft)]">BU Reports — {data.period}</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <StatusCard icon={CheckSealIcon} hue={STATUS_HUE.SUBMITTED} label="BU Submitted" hint="Awaiting first look" value={k.buSubmitted} onClick={() => navigate("reports-bu", { statusFilter: "submitted" })} />
          <StatusCard icon={HourglassIcon} hue={STATUS_HUE.UNDER_REVIEW} label="BU In Review" hint="Your review in progress" value={k.buPending} onClick={() => navigate("reports-bu", { statusFilter: "pending" })} />
          <StatusCard icon={AlarmAlertIcon} hue={STATUS_HUE.REJECTED} label="BU Overdue" hint="Past deadline, not approved" value={k.buOverdue} onClick={() => navigate("reports-bu", { statusFilter: "overdue" })} />
          <StatusCard icon={CheckSealIcon} hue={STATUS_HUE.APPROVED} label="BU Approved" hint="Cleared for consolidation" value={k.buApproved} onClick={() => navigate("reports-bu", { statusFilter: "approved" })} />
          <StatusCard icon={WorkflowIcon} hue={STATUS_HUE.REJECTED} label="BU Rejected" hint="Awaiting correction" value={k.buRejected} onClick={() => navigate("corrections")} />
        </div>
      </div>

      {/* ── Project reporting status ── */}
      <div>
        <div className="mb-2.5 flex items-center gap-2">
          <ProjectsIcon className="h-4 w-4 text-[color:var(--esg-purple)]" />
          <h2 className="text-[13px] font-bold uppercase tracking-widest text-[color:var(--ink-soft)]">Subsidiary Reports — {data.period}</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <StatusCard icon={CheckSealIcon} hue={STATUS_HUE.SUBMITTED} label="Project Submitted" hint="Awaiting first look" value={k.prjSubmitted} onClick={() => navigate("reports-project", { statusFilter: "submitted" })} />
          <StatusCard icon={HourglassIcon} hue={STATUS_HUE.UNDER_REVIEW} label="Project In Review" hint="Your review in progress" value={k.prjPending} onClick={() => navigate("reports-project", { statusFilter: "pending" })} />
          <StatusCard icon={AlarmAlertIcon} hue={STATUS_HUE.REJECTED} label="Project Overdue" hint="Past deadline, not approved" value={k.prjOverdue} onClick={() => navigate("reports-project", { statusFilter: "overdue" })} />
          <StatusCard icon={CheckSealIcon} hue={STATUS_HUE.APPROVED} label="Project Approved" hint="Cleared for consolidation" value={k.prjApproved} onClick={() => navigate("reports-project", { statusFilter: "approved" })} />
          <StatusCard icon={WorkflowIcon} hue={STATUS_HUE.REJECTED} label="Project Rejected" hint="Awaiting correction" value={k.prjRejected} onClick={() => navigate("corrections")} />
        </div>
      </div>

      {/* ── trend + completion ── */}
      <div className="grid gap-3 xl:grid-cols-2">
        <SectionCard title="Your approval / rejection trend — 6 months" icon={FileCheck2}>
          <div className="flex h-44 items-end gap-3 px-1">
            {data.decisionTrend.map((m) => (
              <div key={m.label} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex h-36 w-full items-end justify-center gap-1">
                  <motion.div
                    className="w-1/3 rounded-t-lg bg-gradient-to-t from-[#20a779] to-[#5fd3a8]"
                    initial={{ height: 0 }} animate={{ height: `${(m.approved / trendMax) * 100}%` }} transition={{ duration: 0.5 }}
                    title={`${m.approved} approved`}
                  />
                  <motion.div
                    className="w-1/3 rounded-t-lg bg-gradient-to-t from-[#c34a4a] to-[#e08a90]"
                    initial={{ height: 0 }} animate={{ height: `${(m.rejected / trendMax) * 100}%` }} transition={{ duration: 0.5, delay: 0.1 }}
                    title={`${m.rejected} rejected`}
                  />
                </div>
                <span className="text-[10.5px] font-medium text-[color:var(--ink-faint)]">{m.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-[color:var(--ink-faint)]">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#20a779]" /> Approved</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#c34a4a]" /> Rejected</span>
          </div>
        </SectionCard>

        <SectionCard title="Reporting completion by BU" icon={UnitsIcon} actions={<Button variant="ghost" size="sm" className="h-7 rounded-xl text-xs" onClick={() => navigate("reports-bu")}>BU reports <ArrowRight className="ml-1 h-3 w-3" /></Button>}>
          <div className="space-y-3">
            {data.completionByBU.length === 0 && <EmptyState title="No business units yet" message="The Subsidiary Admin has not registered BUs." />}
            {data.completionByBU.map((b, i) => (
              <motion.div key={b.name} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                <div className="mb-1 flex items-center justify-between text-[12px]">
                  <button className="font-semibold text-[color:var(--ink)] hover:text-[color:var(--esg-blue)] hover:underline" onClick={() => navigate("reports-bu", { q: b.name })}>{b.name}</button>
                  <span className="tabular text-[color:var(--ink-faint)]">{b.approved}/{b.total} approved · {b.completionPct}%</span>
                </div>
                <GlassProgress value={b.completionPct} tone={b.completionPct >= 80 ? "green" : b.completionPct >= 40 ? "blue" : "amber"} />
              </motion.div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* ── decisions / deadlines / overdue ── */}
      <div className="grid gap-3 xl:grid-cols-3">
        <SectionCard title="Recent review decisions" icon={CheckSealIcon} actions={<Button variant="ghost" size="sm" className="h-7 rounded-xl text-xs" onClick={() => navigate("activity")}>History <ArrowRight className="ml-1 h-3 w-3" /></Button>}>
          <div className="space-y-2">
            {data.recentDecisions.length === 0 && <EmptyState title="No decisions yet" message="Approved and rejected reports will appear here." />}
            {data.recentDecisions.map((d) => (
              <button key={d.id} onClick={() => navigate("corrections", { ref: d.ref })} className="flex w-full items-center justify-between gap-2 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-white/70">
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-semibold text-[color:var(--ink)]">{d.ref} — {d.title}</span>
                  <span className="block truncate text-[10.5px] text-[color:var(--ink-faint)]">{d.org} · by {d.reviewerName ?? "—"} · {timeAgo(d.reviewedAt)}</span>
                </span>
                <StatusChip status={d.status} />
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Upcoming deadlines" icon={CalendarClock} actions={<Button variant="ghost" size="sm" className="h-7 rounded-xl text-xs" onClick={() => navigate("deadlines")}>All deadlines <ArrowRight className="ml-1 h-3 w-3" /></Button>}>
          <div className="space-y-2">
            {data.upcomingDeadlines.length === 0 && <EmptyState title="No upcoming deadlines" message="Reporting timelines set by the Subsidiary Admin appear here." />}
            {data.upcomingDeadlines.map((d) => (
              <button key={`${d.level}-${d.id}`} onClick={() => navigate("deadlines")} className="flex w-full items-center justify-between gap-2 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-white/70">
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-semibold text-[color:var(--ink)]">{d.name}</span>
                  <span className="block truncate text-[10.5px] text-[color:var(--ink-faint)]">{DEADLINE_STATUS_LABELS[d.status] ?? d.status} · due {fmtDate(d.dueDate)}</span>
                </span>
                <Chip tone={d.daysLeft <= 7 ? "red" : d.daysLeft <= 14 ? "amber" : "blue"}>{d.daysLeft}d</Chip>
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Overdue reporting" icon={AlarmAlertIcon} actions={<Button variant="ghost" size="sm" className="h-7 rounded-xl text-xs" onClick={() => navigate("queue", { statusFilter: "overdue" })}>Overdue queue <ArrowRight className="ml-1 h-3 w-3" /></Button>}>
          <div className="space-y-2">
            {data.overdueItems.length === 0 && <EmptyState title="Nothing overdue" message="Every record is inside its deadline." />}
            {data.overdueItems.map((o) => (
              <button key={o.ref} onClick={() => navigate("queue", { q: o.ref })} className="flex w-full items-center justify-between gap-2 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-white/70">
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-semibold text-[color:var(--ink)]">{o.title}</span>
                  <span className="block truncate text-[10.5px] text-[color:var(--ink-faint)]">{o.level} · {o.org} · owner {o.owner}</span>
                </span>
                <Chip tone="red">{o.daysLate}d late</Chip>
              </button>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* ── recent activity ── */}
      <SectionCard title="Recent reporting activity" icon={PulseIcon} actions={<Button variant="ghost" size="sm" className="h-7 rounded-xl text-xs" onClick={() => navigate("activity")}>Full feed <ArrowRight className="ml-1 h-3 w-3" /></Button>}>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {data.recentActivity.length === 0 && <EmptyState title="No activity yet" message="Reporting activity across your subsidiary will appear here." />}
          {data.recentActivity.map((a) => (
            <div key={a.id} className="glass-subtle rounded-2xl p-3">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: a.severity === "WARNING" ? "#c57926" : a.severity === "CRITICAL" ? "#c34a4a" : "#3a7bff" }} />
                <span className="truncate text-[12px] font-semibold text-[color:var(--ink)]">{a.actorName}</span>
                <span className="ml-auto shrink-0 text-[10px] text-[color:var(--ink-faint)]">{timeAgo(a.createdAt)}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-[11.5px] text-[color:var(--ink-soft)]">
                {a.action.replace(/_/g, " ").toLowerCase()}{a.targetLabel ? ` — ${a.targetLabel}` : ""}
              </p>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* footer strip */}
      <GlassCard className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex flex-wrap items-center gap-5">
          <span className="flex items-center gap-2 text-[12px] font-medium text-[color:var(--ink-soft)]"><CheckCheck className="h-4 w-4 text-[#20a779]" /> {fmtNumber(k.completedReviews)} reviews completed by you</span>
          <span className="flex items-center gap-2 text-[12px] font-medium text-[color:var(--ink-soft)]"><UnitsIcon className="h-4 w-4 text-[color:var(--esg-blue)]" /> {fmtNumber(k.totalBUs)} BUs · {fmtNumber(k.totalProjects)} projects in scope</span>
          <span className="flex items-center gap-2 text-[12px] font-medium text-[color:var(--ink-soft)]"><FilesIcon className="h-4 w-4 text-[#0ea5b7]" /> Evidence gaps visible in Evidence Review</span>
          <span className="flex items-center gap-2 text-[12px] font-medium text-[color:var(--ink-soft)]"><ShieldIcon className="h-4 w-4 text-[color:var(--esg-purple)]" /> Review authority enforced server-side ({sub.code})</span>
        </div>
      </GlassCard>
    </div>
  );
}
