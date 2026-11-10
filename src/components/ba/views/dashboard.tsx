"use client";

// ── BU ADMIN · SCREEN 01 — Operations Command Deck ──
// Sky-horizon instrument deck: radar-ping emblem, semicircle horizon dial,
// clip-corner instrument tiles with LED bars, runway progress bars,
// flight-strip rows and a blueprint grid texture. Data contract unchanged —
// same endpoints, fields, quick actions and 30s sync pulse.

import { useEffect, useId, useState } from "react";
import {
  ArrowRight, Building2, CalendarClock, FileCheck2, FlaskConical, Radar, ShieldAlert, Sparkles,
} from "lucide-react";
import {
  AlarmAlertIcon, BellIcon, CheckSealIcon, HourglassIcon, MegaphoneIcon,
  PeopleIcon, ProjectsIcon, PulseIcon, ReportChartIcon, TaskCheckIcon,
} from "@/components/workspace/premium-icons";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useBaWorkspace } from "@/lib/ba/store";
import { fmtDate, fmtNumber, timeAgo, useBaApi } from "@/lib/ba/client";
import type { BaDashboardData } from "@/lib/ba/types";
import { DEADLINE_STATUS_LABELS } from "@/lib/ba/types";
import {
  Chip, CountUp, EmptyState, ErrorState, LoadingBlock, StatusBadge,
} from "@/components/workspace/ui";
import { Eyebrow, MetaLine } from "@/components/ba/shared";
import {
  Glare, RadarRings, Specks, Sweep, useConsoleTilt, vfxStagger,
} from "@/components/workspace/console-vfx";

/* status hue map — sky-blue submitted, purple pending review, amber pending, red overdue, green approved */
const STATUS_HUE: Record<string, string> = {
  APPROVED: "#16A67A", SUBMITTED: "#348BE8", UNDER_REVIEW: "#8B5CF6",
  DRAFT: "#8a99ad", ASSIGNED: "#c57926", CHANGES_REQUESTED: "#c57926", REJECTED: "#E35D6A",
};

/* runway tier hue — green ≥80, sky-blue ≥40, amber below (mirrors the old progress tones) */
const runwayHue = (pct: number) => (pct >= 80 ? "#16A67A" : pct >= 40 ? "#348BE8" : "#c57926");
/* flight-strip hue aligned with the deadline chip tone */
const deadlineHue = (days: number) => (days <= 3 ? "#E35D6A" : days <= 7 ? "#c57926" : "#348BE8");

/* CSS custom properties helper for --led / --strip / --runway vars */
const cssVars = (vars: Record<string, string>) => vars as React.CSSProperties;

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
      data-tilt
      className="cd-tile vfx-tilt group relative flex flex-col gap-3 rounded-2xl p-4 text-left"
      style={cssVars({ "--led": hue })}
    >
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
      <Glare />
    </button>
  );
}

/* semicircle horizon gauge — arc draws in on mount (half circumference ≈ 157) */
function HorizonDial({ pct }: { pct: number }) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setDrawn(true), 80);
    return () => window.clearTimeout(t);
  }, []);
  const gid = useId();
  const len = 157;
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <svg viewBox="0 0 120 66" className="h-[66px] w-[120px]" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#1f6cc4" />
          <stop offset="100%" stopColor="#62B8FF" />
        </linearGradient>
      </defs>
      <path d="M 10 60 A 50 50 0 0 1 110 60" fill="none" stroke="rgba(31,108,196,0.14)" strokeWidth="10" strokeLinecap="round" />
      <path
        d="M 10 60 A 50 50 0 0 1 110 60" fill="none"
        stroke={`url(#${gid})`} strokeWidth="10" strokeLinecap="round"
        strokeDasharray={len}
        strokeDashoffset={drawn ? (1 - clamped / 100) * len : len}
        style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(0.22, 1, 0.36, 1)" }}
      />
    </svg>
  );
}

const QUICK_ACTIONS = [
  { id: "monitoring-submitted", icon: CheckSealIcon, tint: "#348BE8", label: "View Submitted Reports", hint: "Sent by BU teams" },
  { id: "monitoring-pending", icon: HourglassIcon, tint: "#8B5CF6", label: "Pending Review Queue", hint: "With BU Manager" },
  { id: "submissions-overdue", icon: AlarmAlertIcon, tint: "#E35D6A", label: "Overdue Reports", hint: "Past deadline, unapproved" },
  { id: "timelines-assign", icon: HourglassIcon, tint: "#c57926", label: "Assign Project Deadline", hint: "Within policy" },
  { id: "tasks-new", icon: TaskCheckIcon, tint: "#16A67A", label: "Assign Operational Task", hint: "Set due date + reminder" },
  { id: "comms-send", icon: MegaphoneIcon, tint: "#348BE8", label: "Send a Reminder", hint: "To BU contributors" },
  { id: "esg-prepare", icon: ReportChartIcon, tint: "#8B5CF6", label: "Prepare BU Package", hint: "Submit to Subsidiary" },
] as const;

export default function DashboardView() {
  const { navigate, reportingYear } = useBaWorkspace();
  const { data, loading, error, refetch } = useBaApi<BaDashboardData>(
    `/api/ba/dashboard?period=${encodeURIComponent(reportingYear)}`,
    { deps: [reportingYear] }
  );
  const tiltRef = useConsoleTilt<HTMLDivElement>();

  const [syncPulse, setSyncPulse] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setSyncPulse((n) => n + 1), 30000);
    return () => window.clearInterval(t);
  }, []);

  if (loading && !data) return <LoadingBlock rows={6} label="Loading your BU command center…" />;
  if (error && !data) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  const k = data.kpis;
  const bu = data.businessUnit;

  const quickNav = (id: string) => {
    switch (id) {
      case "monitoring-submitted": return navigate("monitoring", { statusFilter: "submitted" });
      case "monitoring-pending": return navigate("monitoring", { statusFilter: "pending" });
      case "submissions-overdue": return navigate("submissions", { tab: "overdue" });
      case "timelines-assign": return navigate("timelines", { create: Date.now() });
      case "tasks-new": return navigate("tasks", { create: Date.now() });
      case "comms-send": return navigate("comms", { compose: Date.now() });
      case "esg-prepare": return navigate("esg", { prepare: Date.now() });
    }
  };

  return (
    <div ref={tiltRef} className="view-in space-y-4 pb-6">
      {/* ── HERO: radar emblem + identity + horizon dial pod ── */}
      <div className="vfx-in" style={vfxStagger(0)}>
        <div className="cd-hero rounded-[28px] p-5 sm:p-7">
          <Sweep />
          <Specks count={10} tint="rgba(52,139,232,0.5)" />
          <div className="relative z-[2] flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <span className="relative grid h-20 w-20 shrink-0 place-items-center">
                <span aria-hidden className="absolute inset-0">
                  <RadarRings tint="rgba(52,139,232,0.5)" className="h-full w-full" />
                </span>
                <span className="glass-strong glass-sheen relative z-[1] flex h-12 w-12 items-center justify-center rounded-2xl shadow-md">
                  <span className="text-[15px] font-extrabold tracking-tight text-[color:var(--ba-sky-deep)]">{bu.code.replace(/^BU-/, "").slice(0, 3)}</span>
                </span>
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-[19px] font-bold tracking-tight text-[color:var(--ink)]">{bu.name}</h1>
                  <StatusBadge status={bu.status} />
                </div>
                <p className="mt-0.5 line-clamp-1 text-[12.5px] text-[color:var(--ink-faint)]">
                  Under {bu.subsidiaryName} · {bu.sector} · BU Manager {bu.managerName} · Admin {bu.adminName}
                </p>
                <p className="mt-0.5 line-clamp-2 text-[11.5px] text-[color:var(--ink-faint)]">
                  {data.period} · Live operational overview of {bu.name}. Every figure below syncs from the shared platform database — approvals belong to the BU Manager.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2.5">
                  <HeroTile icon={ProjectsIcon} hue="#348BE8" label={`${k.totalProjects} Projects`} note="Within BU scope" />
                  <HeroTile icon={PeopleIcon} hue="#8B5CF6" label="BU Operational Team" note="Contributors + Manager" />
                  <HeroTile icon={PulseIcon} hue="#16A67A" label="Cross-console sync" note="Live to Group + Subsidiary" />
                </div>
              </div>
            </div>
            <div className="cd-tile w-full shrink-0 rounded-[26px] p-5 lg:w-[320px]" style={cssVars({ "--led": "#348BE8" })}>
              <div className="flex flex-col items-center text-center">
                <div className="relative">
                  <HorizonDial pct={k.reportingCompletionPct} />
                  <span className="absolute inset-0 flex items-center justify-center pt-4">
                    <span className="text-[26px] font-bold tabular leading-none text-[color:var(--ink)]">{k.reportingCompletionPct}%</span>
                  </span>
                </div>
                <div className="mt-1.5 text-[12px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">Reporting completion</div>
                <div className="mt-0.5 text-[13px] font-semibold text-[color:var(--ink-soft)]">Approved / total records</div>
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[color:var(--ink-faint)]">
                  <PulseIcon className="h-3.5 w-3.5 text-[#348BE8]" />
                  Live · synced {syncPulse >= 0 ? timeAgo(useBaWorkspace.getState().lastSyncedAt) : "—"}
                </div>
                <span className="cd-horizon mt-3 w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── INSTRUMENT STRIP: 6 KPI tiles ── */}
      <div className="vfx-in grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" style={vfxStagger(1)}>
        <StatusCard icon={ProjectsIcon} hue="#348BE8" label="Total Projects" hint="Within BU" value={k.totalProjects} onClick={() => navigate("projects")} />
        <StatusCard icon={CheckSealIcon} hue={STATUS_HUE.SUBMITTED} label="Submitted" hint="Sent for review" value={k.submittedReports} onClick={() => navigate("monitoring", { statusFilter: "submitted" })} />
        <StatusCard icon={HourglassIcon} hue={STATUS_HUE.UNDER_REVIEW} label="Pending Reports" hint="With BU Manager" value={k.pendingReports} onClick={() => navigate("monitoring", { statusFilter: "pending" })} />
        <StatusCard icon={AlarmAlertIcon} hue={STATUS_HUE.REJECTED} label="Overdue" hint="Past deadline" value={k.overdueReports} onClick={() => navigate("submissions", { tab: "overdue" })} />
        <StatusCard icon={FlaskConical} hue="#8B5CF6" label="Pending Review" hint="Submitted + under review" value={k.pendingReview} onClick={() => navigate("monitoring", { statusFilter: "pending" })} />
        <StatusCard icon={ReportChartIcon} hue={STATUS_HUE.APPROVED} label="Completion %" hint="Approved / total" value={k.reportingCompletionPct} onClick={() => navigate("analytics")} />
      </div>

      {/* ── INSTRUMENTS ROW: status mix donut + project distribution + deadline overview ── */}
      <div className="vfx-in grid gap-3 xl:grid-cols-3" style={vfxStagger(2)}>
        {/* Status mix — beam donut */}
        <div className="cd-tile vfx-tilt rounded-[26px] p-5" data-tilt style={cssVars({ "--led": "#348BE8" })}>
          <Eyebrow icon={ReportChartIcon} label="Status mix" hint={data.period} />
          <div className="mt-4 flex items-center gap-4">
            <div className="cd-beam-donut h-24 w-24 shrink-0">
              <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90">
                <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(125,177,216,0.18)" strokeWidth="9" />
                {(() => {
                  const total = data.statusDist.reduce((s, x) => s + x.count, 0) || 1;
                  const circ = 213.6;
                  return data.statusDist.map((s, i, arr) => {
                    const frac = s.count / total;
                    const dash = frac * circ;
                    const offset = arr.slice(0, i).reduce((t, x) => t + (x.count / total) * circ, 0);
                    return (
                      <circle
                        key={s.status}
                        cx="40" cy="40" r="34" fill="none"
                        stroke={STATUS_HUE[s.status] ?? "#348BE8"}
                        strokeWidth="9" strokeLinecap="round"
                        strokeDasharray={`${dash} ${circ - dash}`}
                        strokeDashoffset={-offset}
                      />
                    );
                  });
                })()}
              </svg>
              <span className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[18px] font-bold tabular text-[color:var(--ink)]">{data.statusDist.reduce((s, x) => s + x.count, 0)}</span>
                <span className="text-[10px] font-medium uppercase tracking-wider text-[color:var(--ink-faint)]">records</span>
              </span>
            </div>
            <div className="flex-1 space-y-1.5">
              {data.statusDist.length === 0 && <EmptyState title="No submissions" message="No records yet for this period." />}
              {data.statusDist.map((s) => (
                <div key={s.status} className="flex items-center gap-2 text-[12px]">
                  <span className="h-2 w-2 rounded-full" style={{ background: STATUS_HUE[s.status] ?? "#348BE8" }} />
                  <span className="flex-1 text-[color:var(--ink-soft)]">{s.status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</span>
                  <span className="tabular font-semibold text-[color:var(--ink)]">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
          <Glare />
        </div>

        {/* Project distribution — tri-segment bars */}
        <div className="cd-tile vfx-tilt rounded-[26px] p-5" data-tilt style={cssVars({ "--led": "#348BE8" })}>
          <Eyebrow icon={ProjectsIcon} label="Project distribution" hint="Submissions by project" />
          <div className="mt-3 space-y-2.5">
            {data.completionByProject.length === 0 && <EmptyState title="No projects yet" message="Projects are created by your Subsidiary Admin." />}
            {data.completionByProject.map((p, i) => {
              const max = Math.max(...data.completionByProject.map((x) => x.total), 1);
              return (
                <motion.div key={p.name} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <div className="mb-1 flex items-center justify-between text-[11.5px]">
                    <button onClick={() => navigate("projects", { detailId: undefined, q: p.name })} className="truncate font-semibold text-[color:var(--ink)] hover:text-[color:var(--ba-sky-deep)] hover:underline">{p.name}</button>
                    <span className="tabular text-[color:var(--ink-faint)]">{p.total} · {p.completionPct}%</span>
                  </div>
                  <div className="flex h-2 items-center gap-0.5 overflow-hidden rounded-full bg-[rgba(102,119,141,0.14)]">
                    <motion.div className="h-full rounded-l-full bg-[#348BE8]" initial={{ width: 0 }} animate={{ width: `${(p.approved / max) * 100}%` }} transition={{ duration: 0.5 }} />
                    <motion.div className="h-full bg-[#8B5CF6]" initial={{ width: 0 }} animate={{ width: `${(p.pending / max) * 100}%` }} transition={{ duration: 0.5, delay: 0.05 }} />
                    <motion.div className="h-full rounded-r-full bg-[#E35D6A]" initial={{ width: 0 }} animate={{ width: `${(p.overdue / max) * 100}%` }} transition={{ duration: 0.5, delay: 0.1 }} />
                  </div>
                </motion.div>
              );
            })}
          </div>
          <Glare />
        </div>

        {/* Deadline overview — flight strips */}
        <div className="cd-tile vfx-tilt rounded-[26px] p-5" data-tilt style={cssVars({ "--led": "#c57926" })}>
          <Eyebrow icon={CalendarClock} label="Deadline overview" hint="Upcoming + overdue" />
          <div className="mt-3 space-y-2">
            {data.upcomingDeadlines.length === 0 && <EmptyState title="No upcoming deadlines" message="Project deadlines you set will appear here." />}
            {data.upcomingDeadlines.slice(0, 5).map((d) => (
              <button
                key={`${d.level}-${d.id}`}
                onClick={() => navigate("timelines")}
                className="cd-strip w-full px-3 py-2 text-left"
                style={cssVars({ "--strip": deadlineHue(d.daysLeft), "--strip-glow": `${deadlineHue(d.daysLeft)}44` })}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-semibold text-[color:var(--ink)]">{d.name}</span>
                  <MetaLine>{DEADLINE_STATUS_LABELS[d.status] ?? d.status} · due {fmtDate(d.dueDate)}</MetaLine>
                </span>
                <Chip tone={d.daysLeft <= 3 ? "red" : d.daysLeft <= 7 ? "amber" : "blue"}>{d.daysLeft}d</Chip>
              </button>
            ))}
          </div>
          <Glare />
        </div>
      </div>

      {/* ── PROGRESS ROW: runways + overdue + pending submissions ── */}
      <div className="vfx-in grid gap-3 xl:grid-cols-3" style={vfxStagger(3)}>
        {/* Project-wise reporting progress — runway bars */}
        <div className="cd-tile vfx-tilt rounded-[26px] p-5" data-tilt style={cssVars({ "--led": "#16A67A" })}>
          <div className="flex items-center justify-between gap-2">
            <Eyebrow icon={ProjectsIcon} label="Project-wise reporting progress" />
            <Button variant="ghost" size="sm" className="h-7 shrink-0 rounded-xl text-xs" onClick={() => navigate("projects")}>Open projects <ArrowRight className="ml-1 h-3 w-3" /></Button>
          </div>
          <div className="mt-3 space-y-3">
            {data.completionByProject.length === 0 && <EmptyState title="No projects yet" message="Projects are created by your Subsidiary Admin." />}
            {data.completionByProject.map((p, i) => (
              <motion.div key={p.name} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                <div className="mb-1 flex items-center justify-between gap-2 text-[12px]">
                  <button className="truncate font-semibold text-[color:var(--ink)] hover:text-[color:var(--ba-sky-deep)] hover:underline" onClick={() => navigate("projects", { q: p.name })}>{p.name}</button>
                  <span className="shrink-0 tabular text-[color:var(--ink-faint)]">{p.approved}/{p.total} approved · {p.overdue} overdue</span>
                </div>
                <div className="cd-runway" style={cssVars({ "--runway": runwayHue(p.completionPct), "--runway-glow": `${runwayHue(p.completionPct)}55` })}>
                  <div className="cd-runway-fill" style={{ width: `${p.completionPct}%` }} />
                  <div className="cd-runway-marker" style={{ left: `calc(${p.completionPct}% - 3px)` }} />
                </div>
              </motion.div>
            ))}
          </div>
          <Glare />
        </div>

        {/* Overdue items — flight strips */}
        <div className="cd-tile vfx-tilt rounded-[26px] p-5" data-tilt style={cssVars({ "--led": "#E35D6A" })}>
          <div className="flex items-center justify-between gap-2">
            <Eyebrow icon={AlarmAlertIcon} label="Overdue items" />
            <Button variant="ghost" size="sm" className="h-7 shrink-0 rounded-xl text-xs" onClick={() => navigate("submissions", { tab: "overdue" })}>All overdue <ArrowRight className="ml-1 h-3 w-3" /></Button>
          </div>
          <div className="mt-3 space-y-2">
            {data.overdueItems.length === 0 && <EmptyState title="Nothing overdue" message="Every record is inside its deadline. Keep it up!" />}
            {data.overdueItems.map((o) => (
              <button
                key={o.ref}
                onClick={() => navigate("submissions", { tab: "overdue", ref: o.ref })}
                className="cd-strip w-full px-3 py-2.5 text-left"
                style={cssVars({ "--strip": "#E35D6A", "--strip-glow": "#E35D6A44" })}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-semibold text-[color:var(--ink)]">{o.title}</span>
                  <MetaLine>{o.level} · {o.org} · owner {o.owner}</MetaLine>
                </span>
                <Chip tone="red">{o.daysLate}d late</Chip>
              </button>
            ))}
          </div>
          <Glare />
        </div>

        {/* Pending submissions — flight strips */}
        <div className="cd-tile vfx-tilt rounded-[26px] p-5" data-tilt style={cssVars({ "--led": "#348BE8" })}>
          <div className="flex items-center justify-between gap-2">
            <Eyebrow icon={HourglassIcon} label="Pending submissions" />
            <Button variant="ghost" size="sm" className="h-7 shrink-0 rounded-xl text-xs" onClick={() => navigate("submissions", { tab: "draft" })}>All drafts <ArrowRight className="ml-1 h-3 w-3" /></Button>
          </div>
          <div className="mt-3 space-y-2">
            {data.pendingSubmissionList.length === 0 && <EmptyState title="No pending drafts" message="Every report has been submitted." />}
            {data.pendingSubmissionList.map((p) => (
              <button
                key={p.id}
                onClick={() => navigate("submissions", { tab: "draft", ref: p.ref })}
                className="cd-strip w-full px-3 py-2.5 text-left"
                style={cssVars({ "--strip": "#348BE8", "--strip-glow": "#348BE844" })}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-semibold text-[color:var(--ink)]">{p.title}</span>
                  <MetaLine>{p.ref} · {p.project} · owner {p.owner}</MetaLine>
                </span>
                <Chip tone={p.overdue ? "red" : p.daysLeft !== null && p.daysLeft <= 3 ? "amber" : "blue"}>{p.daysLeft === null ? "—" : p.overdue ? `${Math.abs(p.daysLeft)}d late` : `${p.daysLeft}d`}</Chip>
              </button>
            ))}
          </div>
          <Glare />
        </div>
      </div>

      {/* ── MONITOR ROW: activity + deadlines + notifications + pending review monitor ── */}
      <div className="vfx-in grid gap-3 xl:grid-cols-4" style={vfxStagger(4)}>
        {/* Recent activity */}
        <div className="cd-tile vfx-tilt rounded-[26px] p-5" data-tilt style={cssVars({ "--led": "#348BE8" })}>
          <div className="flex items-center justify-between gap-2">
            <Eyebrow icon={PulseIcon} label="Recent activity" />
            <Button variant="ghost" size="sm" className="h-7 shrink-0 rounded-xl text-xs" onClick={() => navigate("activity")}>Feed <ArrowRight className="ml-1 h-3 w-3" /></Button>
          </div>
          <div className="mt-3 space-y-2">
            {data.recentActivity.length === 0 && <EmptyState title="No activity yet" message="BU actions will appear here." />}
            {data.recentActivity.slice(0, 6).map((a) => (
              <div key={a.id} className="flex items-start gap-2.5 rounded-2xl px-2 py-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: a.severity === "WARNING" ? "#c57926" : a.severity === "CRITICAL" ? "#c34a4a" : "#348BE8" }} />
                <div className="min-w-0">
                  <div className="truncate text-[12px] text-[color:var(--ink)]"><strong className="font-semibold">{a.actorName}</strong> · {a.action.replace(/_/g, " ").toLowerCase()} {a.targetLabel && <span className="text-[color:var(--ink-soft)]">— {a.targetLabel}</span>}</div>
                  <div className="text-[10.5px] text-[color:var(--ink-faint)]">{timeAgo(a.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
          <Glare />
        </div>

        {/* Upcoming deadlines — flight strips */}
        <div className="cd-tile vfx-tilt rounded-[26px] p-5" data-tilt style={cssVars({ "--led": "#c57926" })}>
          <Eyebrow icon={CalendarClock} label="Upcoming deadlines" />
          <div className="mt-3 space-y-2">
            {data.upcomingDeadlines.length === 0 && <EmptyState title="No upcoming deadlines" message="Set project timelines to see them here." />}
            {data.upcomingDeadlines.slice(0, 6).map((d) => (
              <button
                key={`${d.level}-${d.id}-2`}
                onClick={() => navigate("timelines")}
                className="cd-strip w-full px-3 py-2 text-left"
                style={cssVars({ "--strip": deadlineHue(d.daysLeft), "--strip-glow": `${deadlineHue(d.daysLeft)}44` })}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-semibold text-[color:var(--ink)]">{d.name}</span>
                  <MetaLine>due {fmtDate(d.dueDate)}</MetaLine>
                </span>
                <Chip tone={d.daysLeft <= 3 ? "red" : d.daysLeft <= 7 ? "amber" : "blue"}>{d.daysLeft}d</Chip>
              </button>
            ))}
          </div>
          <Glare />
        </div>

        {/* Latest notifications */}
        <div className="cd-tile vfx-tilt rounded-[26px] p-5" data-tilt style={cssVars({ "--led": "#8B5CF6" })}>
          <div className="flex items-center justify-between gap-2">
            <Eyebrow icon={BellIcon} label="Latest notifications" />
            <Button variant="ghost" size="sm" className="h-7 shrink-0 rounded-xl text-xs" onClick={() => navigate("notifications")}>All <ArrowRight className="ml-1 h-3 w-3" /></Button>
          </div>
          <div className="mt-3 space-y-2">
            {data.latestNotifications.length === 0 && <EmptyState title="No notifications" message="Broadcasts from the platform will appear here." />}
            {data.latestNotifications.slice(0, 6).map((n) => (
              <button key={n.id} onClick={() => navigate("notifications", { openId: n.id })} className="flex w-full items-start gap-2.5 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-white/70">
                <span className={cnSeverity(n.severity)} />
                <span className="min-w-0">
                  <span className={cn("block truncate text-[12px]", n.read ? "text-[color:var(--ink-soft)]" : "font-semibold text-[color:var(--ink)]")}>{n.title}</span>
                  <MetaLine>{timeAgo(n.createdAt)}{n.origin === "group" && " · broadcast"}</MetaLine>
                </span>
              </button>
            ))}
          </div>
          <Glare />
        </div>

        {/* Pending review monitor — tinted counters */}
        <div className="cd-tile vfx-tilt rounded-[26px] p-5" data-tilt style={cssVars({ "--led": "#8B5CF6" })}>
          <div className="flex items-center justify-between gap-2">
            <Eyebrow icon={Radar} label="Pending review monitor" />
            <Button variant="ghost" size="sm" className="h-7 shrink-0 rounded-xl text-xs" onClick={() => navigate("monitoring", { statusFilter: "pending" })}>Open <ArrowRight className="ml-1 h-3 w-3" /></Button>
          </div>
          <div className="mt-3 space-y-2.5">
            <div className="flex items-center justify-between rounded-2xl bg-[rgba(139,92,246,0.06)] px-3 py-2.5">
              <div>
                <div className="text-[12px] font-semibold text-[color:var(--ink)]">With the BU Manager</div>
                <MetaLine>Pending review</MetaLine>
              </div>
              <span className="text-[20px] font-bold tabular text-[#8B5CF6]"><CountUp value={k.pendingReports} /></span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-[rgba(52,139,232,0.06)] px-3 py-2.5">
              <div>
                <div className="text-[12px] font-semibold text-[color:var(--ink)]">Submitted + in review</div>
                <MetaLine>Cross-console visible</MetaLine>
              </div>
              <span className="text-[20px] font-bold tabular text-[#348BE8]"><CountUp value={k.pendingReview} /></span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-[rgba(227,93,106,0.06)] px-3 py-2.5">
              <div>
                <div className="text-[12px] font-semibold text-[color:var(--ink)]">Overdue</div>
                <MetaLine>Past deadline</MetaLine>
              </div>
              <span className="text-[20px] font-bold tabular text-[#E35D6A]"><CountUp value={k.overdueReports} /></span>
            </div>
          </div>
          <Glare />
        </div>
      </div>

      {/* ── QUICK ACTIONS: compact instrument mini-cards ── */}
      <div className="vfx-in" style={vfxStagger(5)}>
        <div className="cd-tile rounded-[26px] p-5" style={cssVars({ "--led": "#348BE8" })}>
          <Eyebrow icon={FileCheck2} label="Quick actions" hint="Operational shortcuts" />
          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-7">
            {QUICK_ACTIONS.map((qa) => (
              <button
                key={qa.id}
                onClick={() => quickNav(qa.id)}
                data-tilt
                className="cd-tile vfx-tilt group flex items-center gap-2.5 rounded-xl p-2.5 text-left"
                style={cssVars({ "--led": qa.tint })}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: `linear-gradient(135deg, ${qa.tint}, color-mix(in srgb, ${qa.tint} 60%, #17263d))` }}>
                  <qa.icon className="h-4 w-4 text-white" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[12px] font-semibold text-[color:var(--ink)]">{qa.label}</span>
                  <span className="block truncate text-[10.5px] text-[color:var(--ink-faint)]">{qa.hint}</span>
                </span>
                <Glare />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── FOOTER: stat strip ── */}
      <div className="vfx-in" style={vfxStagger(6)}>
        <div className="cd-tile flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4" style={cssVars({ "--led": "#348BE8" })}>
          <div className="flex flex-wrap items-center gap-5">
            <span className="flex items-center gap-2 text-[12px] font-medium text-[color:var(--ink-soft)]"><Building2 className="h-4 w-4 text-[color:var(--ba-sky-deep)]" /> {bu.name} · {bu.code}</span>
            <span className="flex items-center gap-2 text-[12px] font-medium text-[color:var(--ink-soft)]"><ProjectsIcon className="h-4 w-4 text-[color:var(--ba-sky-deep)]" /> {fmtNumber(k.totalProjects)} projects in scope</span>
            <span className="flex items-center gap-2 text-[12px] font-medium text-[color:var(--ink-soft)]"><ShieldAlert className="h-4 w-4 text-[#c57926]" aria-hidden="true" /> Approval authority: BU Manager</span>
            <span className="flex items-center gap-2 text-[12px] font-medium text-[color:var(--ink-soft)]"><Sparkles className="h-4 w-4 text-[color:var(--ba-purple)]" /> Scope enforced server-side</span>
          </div>
        </div>
      </div>
    </div>
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
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#1f6cc4]">
            <span className="relative flex h-1.5 w-1.5"><span className="absolute h-full w-full animate-ping rounded-full bg-[#348BE8] opacity-60" /><span className="relative h-1.5 w-1.5 rounded-full bg-[#348BE8]" /></span>
            {note}
          </div>
        )}
      </div>
    </div>
  );
}

function cnSeverity(sev: string) {
  const cls = sev === "CRITICAL" ? "bg-[#c34a4a]" : sev === "WARNING" ? "bg-[#c57926]" : sev === "SUCCESS" ? "bg-[#238653]" : "bg-[#348BE8]";
  return "mt-1.5 h-2 w-2 shrink-0 rounded-full " + cls;
}
