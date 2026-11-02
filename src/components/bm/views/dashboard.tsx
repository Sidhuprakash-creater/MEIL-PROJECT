"use client";

// ── BU MANAGER · SCREEN 01 — "Review Spectrum Prism" dashboard ──
import { useState } from "react";
import { ArrowRight, CalendarClock, CheckCheck, Clock, FileWarning } from "lucide-react";
import {
  AlarmAlertIcon, CheckSealIcon, FilesIcon, HourglassIcon, ProjectsIcon,
  PulseIcon, ShieldIcon, TrendIcon, WorkflowIcon,
} from "@/components/workspace/premium-icons";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useBmWorkspace } from "@/lib/bm/store";
import { fmtDate, fmtNumber, timeAgo, useBmApi } from "@/lib/bm/client";
import type { BmDashboardData, SubmissionsResponse } from "@/lib/bm/types";
import {
  Chip, CountUp, EmptyState, ErrorState, GlassProgress, LoadingBlock, StatusBadge,
} from "@/components/workspace/ui";
import { StatusChip, UrgencyChip, EvidenceChip, STATUS_HUE } from "@/components/bm/shared";
import { ReportReviewWorkspace } from "@/components/bm/review-detail";
import {
  BeamRing, Glare, ProgressArc, Specks, Sweep, useConsoleTilt, vfxStagger,
} from "@/components/workspace/console-vfx";

/* css-var helpers feeding the rs-* prismatic primitives */
const spineVars = (hue: string) =>
  ({ ["--spine" as string]: hue, ["--spine-glow" as string]: `${hue}55` }) as React.CSSProperties;
const barVars = (a: string, b: string, glow: string) =>
  ({ ["--bar-a" as string]: a, ["--bar-b" as string]: b, ["--bar-glow" as string]: glow }) as React.CSSProperties;

/* prismatic crystal KPI tile */
function KpiTile({
  icon: Icon, hue, label, hint, value, onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  hue: string; label: string; hint: string; value: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      data-tilt
      aria-label={`${label}: ${value}`}
      className="rs-crystal vfx-tilt group relative flex w-full flex-col gap-2.5 rounded-[22px] p-4 text-left"
    >
      <span
        className="flex h-10 w-10 items-center justify-center rounded-2xl text-white shadow-md"
        style={{ background: `linear-gradient(135deg, ${hue}, color-mix(in srgb, ${hue} 62%, #17263d))`, boxShadow: `0 6px 16px color-mix(in srgb, ${hue} 38%, transparent), inset 0 1px 0 rgba(255,255,255,0.4)` }}
      >
        <Icon className="h-[18px] w-[18px] text-white" />
      </span>
      <span className="text-[26px] font-bold tabular leading-none text-[color:var(--ink)]">
        <CountUp value={value} />
      </span>
      <div className="min-w-0">
        <div className="truncate text-[13px] font-semibold" style={{ color: hue }}>{label}</div>
        <div className="truncate text-[11px] text-[color:var(--ink-faint)]">{hint}</div>
      </div>
      <Glare />
    </button>
  );
}

/* glass panel header — icon + uppercase title (+ optional description / action) */
function PanelHead({
  icon: Icon, title, description, action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-[color:var(--bum-purple-deep)]" />
          <h2 className="truncate text-[13px] font-bold uppercase tracking-widest text-[color:var(--ink-soft)]">{title}</h2>
        </div>
        {description && <p className="mt-1 pl-6 text-[11.5px] text-[color:var(--ink-faint)]">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export default function DashboardView() {
  const { navigate, reportingYear } = useBmWorkspace();
  const tiltRef = useConsoleTilt<HTMLDivElement>();
  const { data, loading, error, refetch } = useBmApi<BmDashboardData>(
    `/api/bm/dashboard?period=${encodeURIComponent(reportingYear)}`,
    { deps: [reportingYear] }
  );
  const { data: queue } = useBmApi<SubmissionsResponse>(
    `/api/bm/submissions?tab=queue&period=${encodeURIComponent(reportingYear)}`,
    { deps: [reportingYear] }
  );
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  if (loading && !data) return <LoadingBlock rows={6} label="Loading your ESG Review Studio…" />;
  if (error && !data) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  const k = data.kpis;
  const bu = data.businessUnit;
  const trendMax = Math.max(...data.decisionTrend.map((d) => d.approved + d.rejected), 1);
  const queueRows = (queue?.submissions ?? []).slice(0, 6);

  const spectrum = [
    { label: "Awaiting", hue: "#348BE8", count: k.awaitingReview },
    { label: "Under review", hue: "#8B5CF6", count: k.underReview },
    { label: "Returned", hue: "#c57926", count: k.returnedForCorrection },
    { label: "Approved", hue: "#16A67A", count: k.approved },
    { label: "Overdue", hue: "#E35D6A", count: k.overdueReviews },
  ];

  const openReview = (id: string) => {
    setReviewId(id);
    setReviewOpen(true);
  };

  return (
    <div ref={tiltRef} className="view-in space-y-4 pb-6">
      {/* ── prismatic hero: BU identity + approved arc pod ── */}
      <section className="rs-hero vfx-in rounded-[28px] p-5 sm:p-7" style={vfxStagger(0)}>
        <Sweep />
        <Specks count={10} tint="rgba(139,92,246,0.5)" />
        <div className="relative z-[2] flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-center gap-4 sm:gap-5">
            <div className="relative grid h-20 w-20 shrink-0 place-items-center">
              <BeamRing size={80} className="absolute inset-0" />
              <span className="glass-strong glass-sheen flex h-14 w-14 items-center justify-center rounded-3xl shadow-md">
                <span className="bg-gradient-to-br from-[#7045D6] to-[#8B5CF6] bg-clip-text text-[15px] font-extrabold tracking-tight text-transparent">BU</span>
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-[19px] font-bold tracking-tight text-[color:var(--ink)]">{bu.name}</h1>
                <StatusBadge status="ACTIVE" />
                <Chip tone="purple">{bu.code}</Chip>
              </div>
              <p className="mt-0.5 line-clamp-1 text-[12.5px] text-[color:var(--ink-faint)]">
                {bu.sector} · Subsidiary {bu.subsidiaryName} ({bu.subsidiaryCode}) · Manager {bu.managerName || "—"} · BU Admin {bu.adminName || "—"}
              </p>
              <p className="mt-0.5 line-clamp-2 text-[11.5px] text-[color:var(--ink-faint)]">
                {data.period} · Review command center for your business unit's reporting. Every figure is live from the shared platform database.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2.5">
                <button onClick={() => navigate("reports")} className="flex items-center gap-2 rounded-2xl px-2 py-1 transition-colors hover:bg-white/70">
                  <ProjectsIcon className="h-5 w-5" hue="#8B5CF6" />
                  <span className="text-[13.5px] font-bold text-[color:var(--ink)]">{k.totalProjects} <span className="font-medium text-[color:var(--ink-faint)]">Projects in scope</span></span>
                </button>
                <button onClick={() => navigate("queue")} className="flex items-center gap-2 rounded-2xl px-2 py-1 transition-colors hover:bg-white/70">
                  <span className="relative flex h-2 w-2"><span className="absolute h-full w-full animate-ping rounded-full bg-[#8B5CF6] opacity-60" /><span className="relative h-2 w-2 rounded-full bg-[#8B5CF6]" /></span>
                  <span className="text-[13.5px] font-bold text-[color:var(--bum-purple-deep)]">{k.awaitingReview + k.underReview} <span className="font-medium text-[color:var(--ink-faint)]">in your queue</span></span>
                </button>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-3 lg:items-end">
            <Button className="btn-bum-action rounded-2xl" onClick={() => navigate("queue")}>
              <CheckSealIcon className="mr-1.5 h-4 w-4" />
              Open Review Queue
            </Button>
            <div className="rs-panel w-full rounded-3xl p-5 lg:w-auto">
              <div className="flex items-center gap-4">
                <ProgressArc
                  pct={(k.approved / Math.max(1, k.approved + k.awaitingReview + k.underReview + k.returnedForCorrection)) * 100}
                  size={124} stroke={10} from="#7045D6" to="#a78bfa" track="rgba(139,92,246,0.14)"
                >
                  <span className="text-[20px] font-bold tabular leading-none text-[color:var(--ink)]">{k.approved}</span>
                </ProgressArc>
                <div>
                  <div className="text-[12px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">Approved reports</div>
                  <div className="mt-1 text-[13px] font-semibold text-[color:var(--ink-soft)]">in this period</div>
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[color:var(--ink-faint)]">
                    <PulseIcon className="h-3.5 w-3.5 text-[#8B5CF6]" />
                    Live · synced {timeAgo(useBmWorkspace.getState().lastSyncedAt)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── review workload: decision spectrum + 7 crystal tiles ── */}
      <section className="rs-panel vfx-in rounded-[26px] p-5" style={vfxStagger(1)}>
        <PanelHead
          icon={CheckSealIcon}
          title="Review workload"
          action={<Chip tone="purple">Decisions stay with you</Chip>}
        />
        <div className="mt-4 rs-spectrum">
          {spectrum.map((seg) => (
            <span
              key={seg.label}
              className="rs-spectrum-seg"
              style={{ flexGrow: Math.max(seg.count, 0.6), background: seg.hue }}
              title={`${seg.count} ${seg.label}`}
            />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          {spectrum.map((seg) => (
            <span key={seg.label} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: seg.hue }} />
              <span className="text-[13px] font-bold tabular text-[color:var(--ink)]"><CountUp value={seg.count} /></span>
              <span className="text-[11px] text-[color:var(--ink-faint)]">{seg.label}</span>
            </span>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          <KpiTile icon={ProjectsIcon} hue={STATUS_HUE.SUBMITTED} label="Total Projects" hint="In your BU scope" value={k.totalProjects} onClick={() => navigate("reports")} />
          <KpiTile icon={CheckSealIcon} hue={STATUS_HUE.SUBMITTED} label="Awaiting Review" hint="Submitted, awaiting your first look" value={k.awaitingReview} onClick={() => navigate("queue", { statusFilter: "submitted" })} />
          <KpiTile icon={HourglassIcon} hue={STATUS_HUE.UNDER_REVIEW} label="Under Review" hint="Currently in your review" value={k.underReview} onClick={() => navigate("queue", { statusFilter: "pending" })} />
          <KpiTile icon={WorkflowIcon} hue={STATUS_HUE.CHANGES_REQUESTED} label="Returned for Correction" hint="Awaiting user corrections" value={k.returnedForCorrection} onClick={() => navigate("corrections")} />
          <KpiTile icon={CheckCheck} hue={STATUS_HUE.APPROVED} label="Approved" hint="Cleared for consolidation" value={k.approved} onClick={() => navigate("reports", { statusFilter: "approved" })} />
          <KpiTile icon={AlarmAlertIcon} hue={STATUS_HUE.REJECTED} label="Overdue Reviews" hint="Past effective review deadline" value={k.overdueReviews} onClick={() => navigate("queue", { statusFilter: "overdue" })} />
          <KpiTile icon={Clock} hue="#348BE8" label="Avg Review Days" hint="submittedAt → decision" value={k.avgReviewDays} onClick={() => navigate("analytics")} />
        </div>
      </section>

      {/* ── dossier queue: priority rows with severity spines ── */}
      <section className="rs-panel vfx-in rounded-[26px] p-5" style={vfxStagger(2)}>
        <PanelHead
          icon={CheckSealIcon}
          title="Review queue — priority order"
          description="Overdue reviews first, then validation-flagged, then closest deadline. Click any row to open the Report Review Workspace."
          action={<Button variant="ghost" size="sm" className="h-7 rounded-xl text-xs" onClick={() => navigate("queue")}>Full queue <ArrowRight className="ml-1 h-3 w-3" /></Button>}
        />
        {queueRows.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="The review queue is clear" message="No reports are awaiting your decision right now." icon={CheckSealIcon} />
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {queueRows.map((r, i) => {
              const spine = r.daysRemaining !== null && r.daysRemaining <= 3 ? "#E35D6A" : "#8B5CF6";
              return (
                <button
                  key={r.id}
                  data-tilt
                  onClick={() => openReview(r.id)}
                  className="rs-dossier vfx-tilt vfx-in w-full p-3 text-left"
                  style={{ ...spineVars(spine), ...vfxStagger(i) }}
                >
                  <span className="rs-dossier-tab shrink-0">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-[color:var(--ink)]">{r.ref} — {r.title}</div>
                    <div className="truncate text-[11px] text-[color:var(--ink-faint)]">
                      {r.level === "PROJECT" ? r.projectName ?? "Project" : "BU level"} · {r.period} · submitted by {r.submittedByName ?? "—"}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <EvidenceChip count={r.evidenceCount} />
                    <UrgencyChip days={r.daysRemaining} />
                    <StatusChip status={r.status} />
                  </div>
                  <Glare />
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ── analytics: prism trend bars + workload by project ── */}
      <div className="grid gap-3 xl:grid-cols-2">
        <section className="rs-panel vfx-in rounded-[26px] p-5" style={vfxStagger(3)}>
          <PanelHead icon={TrendIcon} title="Decision trend — approvals vs rejections (6 months)" />
          <div className="mt-4 flex h-44 items-end gap-3 px-1">
            {data.decisionTrend.map((m) => (
              <div key={m.label} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex h-36 w-full items-end justify-center gap-1">
                  <motion.div
                    className="rs-prism-bar"
                    style={{ ...barVars("#0e6b50", "#3fd99b", "rgba(22,166,122,0.35)"), width: "33%" }}
                    initial={{ height: 0 }} animate={{ height: `${(m.approved / trendMax) * 100}%` }} transition={{ duration: 0.5 }}
                    title={`${m.approved} approved`}
                  />
                  <motion.div
                    className="rs-prism-bar"
                    style={{ ...barVars("#a02a36", "#f08a90", "rgba(227,93,106,0.35)"), width: "33%" }}
                    initial={{ height: 0 }} animate={{ height: `${(m.rejected / trendMax) * 100}%` }} transition={{ duration: 0.5, delay: 0.1 }}
                    title={`${m.rejected} rejected/returned`}
                  />
                </div>
                <span className="text-[10.5px] font-medium text-[color:var(--ink-faint)]">{m.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-[color:var(--ink-faint)]">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#16A67A]" /> Approved</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#E35D6A]" /> Rejected/Returned</span>
          </div>
        </section>

        <section className="rs-panel vfx-in rounded-[26px] p-5" style={vfxStagger(4)}>
          <PanelHead
            icon={ProjectsIcon}
            title="Review workload by project"
            description="Approved vs pending per project in your BU."
            action={<Button variant="ghost" size="sm" className="h-7 rounded-xl text-xs" onClick={() => navigate("reports")}>Reports <ArrowRight className="ml-1 h-3 w-3" /></Button>}
          />
          <div className="mt-4 space-y-3">
            {data.completionByProject.length === 0 && <EmptyState title="No projects yet" message="Your BU has no registered projects." />}
            {data.completionByProject.map((p, i) => (
              <motion.div key={p.name} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                <div className="mb-1 flex items-center justify-between text-[12px]">
                  <button className="font-semibold text-[color:var(--ink)] hover:text-[color:var(--bum-purple-deep)] hover:underline" onClick={() => navigate("reports", { q: p.name })}>{p.name}</button>
                  <span className="tabular text-[color:var(--ink-faint)]">{p.approved}/{p.total} approved · {p.completionPct}%</span>
                </div>
                <GlassProgress value={p.completionPct} tone={p.completionPct >= 80 ? "green" : p.completionPct >= 40 ? "purple" : "amber"} />
              </motion.div>
            ))}
          </div>
        </section>
      </div>

      {/* ── monitor: overdue dossiers + deadline dossiers ── */}
      <div className="grid gap-3 xl:grid-cols-2">
        <section className="rs-panel vfx-in rounded-[26px] p-5" style={vfxStagger(5)}>
          <PanelHead
            icon={AlarmAlertIcon}
            title="Overdue reporting"
            action={<Button variant="ghost" size="sm" className="h-7 rounded-xl text-xs" onClick={() => navigate("queue", { statusFilter: "overdue" })}>Overdue queue <ArrowRight className="ml-1 h-3 w-3" /></Button>}
          />
          <div className="mt-4 space-y-2">
            {data.overdueItems.length === 0 && <EmptyState title="Nothing overdue" message="Every record is inside its deadline." />}
            {data.overdueItems.map((o) => (
              <button
                key={o.ref}
                data-tilt
                onClick={() => navigate("queue", { q: o.ref })}
                className="rs-dossier vfx-tilt w-full px-3 py-2.5 text-left"
                style={spineVars("#E35D6A")}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-semibold text-[color:var(--ink)]">{o.title}</span>
                  <span className="block truncate text-[10.5px] text-[color:var(--ink-faint)]">{o.level} · {o.org} · owner {o.owner}</span>
                </span>
                <Chip tone="red">{o.daysLate}d late</Chip>
                <Glare />
              </button>
            ))}
          </div>
        </section>

        <section className="rs-panel vfx-in rounded-[26px] p-5" style={vfxStagger(6)}>
          <PanelHead
            icon={CalendarClock}
            title="Upcoming review deadlines"
            action={<Button variant="ghost" size="sm" className="h-7 rounded-xl text-xs" onClick={() => navigate("tasks")}>All deadlines <ArrowRight className="ml-1 h-3 w-3" /></Button>}
          />
          <div className="mt-4 space-y-2">
            {data.upcomingDeadlines.length === 0 && <EmptyState title="No upcoming deadlines" message="Reporting timelines set by the Subsidiary Admin appear here." />}
            {data.upcomingDeadlines.map((d) => (
              <button
                key={`${d.level}-${d.id}`}
                data-tilt
                onClick={() => navigate("tasks")}
                className="rs-dossier vfx-tilt w-full px-3 py-2.5 text-left"
                style={spineVars("#8B5CF6")}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-semibold text-[color:var(--ink)]">{d.name}</span>
                  <span className="block truncate text-[10.5px] text-[color:var(--ink-faint)]">{d.level} · due {fmtDate(d.dueDate)}</span>
                </span>
                <Chip tone={d.daysLeft <= 7 ? "red" : d.daysLeft <= 14 ? "amber" : "purple"}>{d.daysLeft}d</Chip>
                <Glare />
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* ── decisions + activity ── */}
      <div className="grid gap-3 xl:grid-cols-2">
        <section className="rs-panel vfx-in rounded-[26px] p-5" style={vfxStagger(7)}>
          <PanelHead
            icon={CheckSealIcon}
            title="Recent review decisions"
            action={<Button variant="ghost" size="sm" className="h-7 rounded-xl text-xs" onClick={() => navigate("activity")}>History <ArrowRight className="ml-1 h-3 w-3" /></Button>}
          />
          <div className="mt-4 space-y-2">
            {data.recentDecisions.length === 0 && <EmptyState title="No decisions yet" message="Approved and rejected reports will appear here." />}
            {data.recentDecisions.map((d) => (
              <button
                key={d.id}
                data-tilt
                onClick={() => openReview(d.id)}
                className="rs-dossier vfx-tilt w-full px-3 py-2.5 text-left"
                style={spineVars(STATUS_HUE[d.status] ?? "#8B5CF6")}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-semibold text-[color:var(--ink)]">{d.ref} — {d.title}</span>
                  <span className="block truncate text-[10.5px] text-[color:var(--ink-faint)]">{d.org} · by {d.reviewerName ?? "—"} · {timeAgo(d.reviewedAt)}</span>
                </span>
                <StatusChip status={d.status} />
                <Glare />
              </button>
            ))}
          </div>
        </section>

        <section className="rs-panel vfx-in rounded-[26px] p-5" style={vfxStagger(8)}>
          <PanelHead
            icon={PulseIcon}
            title="Recent reporting activity"
            action={<Button variant="ghost" size="sm" className="h-7 rounded-xl text-xs" onClick={() => navigate("activity")}>Full feed <ArrowRight className="ml-1 h-3 w-3" /></Button>}
          />
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {data.recentActivity.length === 0 && <EmptyState title="No activity yet" message="Reporting activity across your BU will appear here." />}
            {data.recentActivity.map((a) => (
              <div key={a.id} className="rs-panel rounded-2xl p-3">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: a.severity === "WARNING" ? "#c57926" : a.severity === "CRITICAL" ? "#c34a4a" : "#8B5CF6" }} />
                  <span className="truncate text-[12px] font-semibold text-[color:var(--ink)]">{a.actorName}</span>
                  <span className="ml-auto shrink-0 text-[10px] text-[color:var(--ink-faint)]">{timeAgo(a.createdAt)}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-[11.5px] text-[color:var(--ink-soft)]">
                  {a.action.replace(/_/g, " ").toLowerCase()}{a.targetLabel ? ` — ${a.targetLabel}` : ""}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ── footer strip ── */}
      <footer className="rs-panel vfx-in flex flex-wrap items-center justify-between gap-3 rounded-[26px] p-4" style={vfxStagger(9)}>
        <div className="flex flex-wrap items-center gap-5">
          <span className="flex items-center gap-2 text-[12px] font-medium text-[color:var(--ink-soft)]"><CheckCheck className="h-4 w-4 text-[#16A67A]" /> {fmtNumber(k.approved)} reports approved this period</span>
          <span className="flex items-center gap-2 text-[12px] font-medium text-[color:var(--ink-soft)]"><ProjectsIcon className="h-4 w-4 text-[#8B5CF6]" /> {fmtNumber(k.totalProjects)} projects in BU scope</span>
          <span className="flex items-center gap-2 text-[12px] font-medium text-[color:var(--ink-soft)]"><FilesIcon className="h-4 w-4 text-[#348BE8]" /> Evidence gaps visible in Evidence Review</span>
          <span className="flex items-center gap-2 text-[12px] font-medium text-[color:var(--ink-soft)]"><ShieldIcon className="h-4 w-4 text-[color:var(--bum-purple-deep)]" /> Review authority enforced server-side ({bu.code})</span>
          <span className="flex items-center gap-2 text-[12px] font-medium text-[color:var(--ink-soft)]"><FileWarning className="h-4 w-4 text-[#c57926]" /> Decisions broadcast to all 5 consoles</span>
        </div>
        <button onClick={() => navigate("analytics")} className="text-[12px] font-semibold text-[color:var(--bum-purple-deep)] hover:underline">
          Review analytics →
        </button>
      </footer>

      <ReportReviewWorkspace
        submissionId={reviewId}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        onDecided={() => void refetch()}
      />
    </div>
  );
}
