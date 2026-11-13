"use client";

// ── SCREEN 01 — Group Command Center (mission-control bento) ──
import { useMemo, type ComponentType } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarClock,
  ChevronRight,
  Droplets,
  FileCheck2,
  Flame,
  FolderTree,
  LayoutDashboard,
  ListChecks,
  Zap,
} from "lucide-react";
import {
  AlarmAlertIcon,
  ApprovalRosetteIcon,
  CheckSealIcon,
  DatabaseIcon,
  FileCheckIcon,
  FilesIcon,
  HourglassIcon,
  MegaphoneIcon,
  OrgIcon,
  OverdueSirenIcon,
  PeopleIcon,
  ProjectsIcon,
  PulseIcon,
  ReportChartIcon,
  ReviewPendingIcon,
  SubmissionFlowIcon,
  TaskCheckIcon,
  TrendIcon,
  UnitsIcon,
  UserPlusIcon,
  WorkflowIcon,
} from "@/components/workspace/premium-icons";
import type { PremiumIconProps } from "@/components/workspace/premium-icons";
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
import { generateFootprintPdf, type FootprintKind } from "@/lib/esg/dashboard-pdf";
import { useToast } from "@/hooks/use-toast";
import {
  Avatar,
  Chip,
  CountUp,
  EmptyState,
  ErrorState,
  GlassCard,
  KpiCard,
  LoadingBlock,
  PageHeader,
  SectionCard,
  StatusBadge,
} from "@/components/workspace/ui";

/* ────────────────────────────── Shared bits ────────────────────────────── */

const INK_SOFT = "text-[color:var(--ink-soft)]";
const INK_FAINT = "text-[color:var(--ink-faint)]";

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
        <div key={i} className={`flex items-center gap-2 ${INK_SOFT}`}>
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
        <span key={it.label} className={`flex items-center gap-1.5 text-xs ${INK_SOFT}`}>
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

/* ────────────────────────────── SVG rings ────────────────────────────── */

/** Gradient health ring with % in the middle. */
function HealthRing({ value, gid, size = 112, stroke = 11 }: { value: number; gid: string; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id={`${gid}-grad`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3a7bff" />
            <stop offset="55%" stopColor="#16a3a3" />
            <stop offset="100%" stopColor="#238653" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(125,177,216,0.28)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gid}-grad)`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(clamped / 100) * c} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dasharray 0.8s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular text-xl font-semibold leading-5 text-[color:var(--ink)]">{Math.round(clamped)}%</span>
      </div>
    </div>
  );
}

/** Compact progress ring for scorecards. */
function MiniRing({ value, tone, size = 58, stroke = 7 }: { value: number; tone: string; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(102,119,141,0.16)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(clamped / 100) * c} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dasharray 0.8s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="tabular text-[11px] font-semibold text-[color:var(--ink)]">{Math.round(clamped)}</span>
      </div>
    </div>
  );
}

/** Clickable submission-status card for the Command Center strip — executive
 *  glass treatment: dual-layer icon tile, hover sheen, refined hierarchy. */
function StatusCard({
  icon: Icon,
  hue,
  label,
  hint,
  value,
  total,
  footerNote,
  onClick,
}: {
  icon: ComponentType<{ className?: string; hue?: string }>;
  hue: string;
  label: string;
  hint: string;
  value: number;
  total: number;
  footerNote?: string;
  onClick: () => void;
}) {
  const sharePct = total > 0 ? (value / total) * 100 : 0;
  return (
    <button
      onClick={onClick}
      aria-label={`${label}: ${value}`}
      className="status-card group relative overflow-hidden rounded-[24px] border border-white/60 bg-white/55 p-[18px] text-left shadow-[0_2px_10px_rgba(23,38,61,0.05)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-white/90 hover:bg-white/85 hover:shadow-[0_16px_38px_rgba(23,38,61,0.14)]"
    >
      {/* top hairline + hover sheen */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ background: `linear-gradient(90deg, ${hue}, ${hue}22)` }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: `radial-gradient(120% 90% at 85% -10%, ${hue}1f, transparent 55%)` }}
      />

      <div className="relative flex items-start justify-between gap-3">
        {/* dual-layer icon tile — outer gradient ring + inner accent core */}
        <span className="relative flex h-[46px] w-[46px] items-center justify-center">
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-[16px] transition-transform duration-300 group-hover:scale-105"
            style={{
              background: `linear-gradient(150deg, ${hue} 18%, color-mix(in srgb, ${hue} 62%, #17263D) 100%)`,
              boxShadow: `0 6px 16px ${hue}3d, inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 0 rgba(9,9,11,0.12)`,
            }}
          />
          <span
            aria-hidden="true"
            className="absolute inset-[3px] rounded-[13px] border border-white/25"
          />
          <Icon className="relative h-[22px] w-[22px] text-white" hue="#ffffff" />
        </span>
        <MiniRing value={sharePct} tone={hue} size={54} stroke={6} />
      </div>

      <CountUp value={value} className="tabular relative mt-3.5 block text-[30px] font-semibold leading-9 tracking-tight text-[color:var(--ink)]" />
      <div className="relative mt-1 flex items-center gap-1.5">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: hue, boxShadow: `0 0 6px ${hue}88` }} />
        <span className="text-[13px] font-bold uppercase tracking-[0.04em]" style={{ color: hue }}>
          {label}
        </span>
      </div>
      <p className={`relative mt-1 text-[11.5px] leading-snug ${INK_FAINT}`}>{hint}</p>

      <div className="relative mt-3.5 flex items-center justify-between border-t border-[rgba(125,177,216,0.22)] pt-2.5">
        <span className={`text-[11px] font-medium ${INK_FAINT}`}>{footerNote ?? `${Math.round(sharePct)}% of group total`}</span>
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold text-[color:var(--esg-blue)] transition-colors group-hover:bg-[rgba(58,123,255,0.08)]">
          View
          <ArrowUpRight
            className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            aria-hidden="true"
          />
        </span>
      </div>
    </button>
  );
}

interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

/** Multi-segment donut with a glass center label. */
function Donut({ segments, size = 138, stroke = 17, centerTop, centerSub }: { segments: DonutSegment[]; size?: number; stroke?: number; centerTop: string; centerSub: string }) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(125,177,216,0.22)" strokeWidth={stroke} />
        {total > 0 &&
          segments.map((s) => {
            const frac = s.value / total;
            const len = Math.max(frac * c - 2.5, 0.01);
            const el = (
              <circle
                key={s.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-acc * c}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            );
            acc += frac;
            return el;
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular text-2xl font-semibold leading-6 text-[color:var(--ink)]">{centerTop}</span>
        <span className={`text-[10px] font-medium uppercase tracking-wide ${INK_FAINT}`}>{centerSub}</span>
      </div>
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

  const k = data?.kpis;
  const approvalRate = useMemo(() => {
    if (!k) return 0;
    const base = k.approved + k.pendingReview + k.rejectedReturned;
    return base > 0 ? (k.approved / base) * 100 : 0;
  }, [k]);

  const categoryMix = useMemo(
    () => [...(data?.categoryMix ?? [])].sort((a, b) => b.count - a.count).slice(0, 6),
    [data]
  );

  const latest = data?.esgTrend?.[data.esgTrend.length - 1];

  const fp = data?.esgFootprint;
  const { toast } = useToast();

  const FOOTPRINT_LABELS: Record<FootprintKind, string> = {
    emissions: "GHG Emissions",
    energy: "Electricity & Energy",
    water: "Water Use",
  };

  /** Click a footprint card → auto-generate & download its pie-chart PDF. */
  const handleFootprintPdf = (kind: FootprintKind) => {
    if (!fp) return;
    const ry = Number(reportingYear.split('-')[0].replace('FY ', '')) || new Date().getFullYear();
    try {
      generateFootprintPdf({ kind, footprint: fp, reportingYear: ry, esgTrend: data?.esgTrend });
      toast({
        title: `${FOOTPRINT_LABELS[kind]} PDF generated`,
        description: "Pie-chart report downloaded — check your downloads folder.",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "PDF generation failed",
        description: e instanceof Error ? e.message : "Unexpected error.",
      });
    }
  };

  const quickActions: { label: string; icon: ComponentType<PremiumIconProps>; hint: string; tint: string; run: () => void }[] = [
    { label: "Invite user", icon: UserPlusIcon, hint: "Add a team member", tint: "#3a7bff", run: () => navigate("users", { create: Date.now() }) },
    { label: "Assign task", icon: TaskCheckIcon, hint: "Create a reporting task", tint: "#6a5bff", run: () => navigate("tasks", { create: Date.now() }) },
    { label: "New BRSR report", icon: ReportChartIcon, hint: "Start the wizard", tint: "#16a3a3", run: () => navigate("brsr", { wizard: Date.now() }) },
    { label: "Announcement", icon: MegaphoneIcon, hint: "Broadcast to group", tint: "#c57926", run: () => navigate("comms", { create: Date.now() }) },
    { label: "Review queue", icon: FileCheckIcon, hint: "Approve submissions", tint: "#238653", run: () => navigate("approvals") },
    { label: "Consolidation", icon: DatabaseIcon, hint: "Validate & merge", tint: "#c34a4a", run: () => navigate("consolidation") },
  ];

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
  if (!data || !k) return null;

  const awaitingReview = k.pendingReview;

  const heroStats: { label: string; value: number; icon: ComponentType<PremiumIconProps>; color: string; note?: string; go: () => void }[] = [
    { label: "Subsidiaries", value: k.subsidiaries, icon: OrgIcon, color: "#6a5bff", go: () => navigate("subsidiaries") },
    { label: "Business Units", value: k.businessUnits, icon: UnitsIcon, color: "#3a7bff", go: () => navigate("units") },
    { label: "Projects", value: k.projects, icon: ProjectsIcon, color: "#16a3a3", go: () => navigate("projects") },
    { label: "Users", value: k.users, icon: PeopleIcon, color: "#238653", note: `${k.activeUsers} active now`, go: () => navigate("users") },
    { label: "Submissions", value: k.submissions, icon: FilesIcon, color: "#c57926", go: () => navigate("submissions") },
  ];

  const pipeline = [
    { label: "Approved", value: k.approved, color: "#238653", go: () => navigate("submissions", { statusFilter: "APPROVED" }) },
    { label: "Awaiting review", value: awaitingReview, color: "#c57926", go: () => navigate("approvals") },
    { label: "Rejected / Returned", value: k.rejectedReturned, color: "#c34a4a", go: () => navigate("submissions", { statusFilter: "REJECTED" }) },
  ];

  const donutSegments: DonutSegment[] = [
    { label: "Approved", value: k.approved, color: "#238653" },
    { label: "Awaiting review", value: awaitingReview, color: "#c57926" },
    { label: "Rejected / Returned", value: k.rejectedReturned, color: "#c34a4a" },
  ];

  return (
    <div className="view-in space-y-5">
      <PageHeader
        title="Group Command Center"
        icon={LayoutDashboard}
        breadcrumbs={["Group", "Overview", "Dashboard"]}
        actions={
          <>
            <span className={`glass-subtle inline-flex items-center gap-1.5 rounded-2xl px-3 py-2 text-[13px] font-medium ${INK_SOFT}`}>
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

      {/* ── 1. Group container — live group view ── */}
      <GlassCard strong className="relative overflow-hidden rounded-[30px] p-0">
        {/* decorative layer */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-[linear-gradient(90deg,#3a7bff,#6a5bff,#16a3a3,#238653,#c57926)] opacity-80" />
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(58,123,255,0.26),transparent_65%)] blur-2xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-36 -left-28 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(22,163,163,0.20),transparent_65%)] blur-2xl" />

        <div className="relative p-5 sm:p-7">
          {/* row 1 — identity + health */}
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div
              role="button"
              tabIndex={0}
              aria-label="Open organization hierarchy"
              onClick={() => navigate("hierarchy")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate("hierarchy");
                }
              }}
              className="group/id flex min-w-0 cursor-pointer items-center gap-4 rounded-3xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(58,123,255,0.45)]"
            >
              <span className="relative shrink-0">
                <span
                  className="flex h-[60px] w-[60px] items-center justify-center rounded-[22px] bg-gradient-to-br from-[#3a7bff] via-[#5a6cff] to-[#6a5bff]"
                  style={{ boxShadow: "0 12px 28px rgba(58,123,255,0.4), inset 0 1px 0 rgba(255,255,255,0.45)" }}
                >
                  <OrgIcon className="h-7 w-7" hue="#e8f1ff" />
                </span>
                <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center">
                  <span aria-hidden className="absolute h-3 w-3 animate-ping rounded-full bg-[#238653] opacity-70" />
                  <span className="relative h-3 w-3 rounded-full border-2 border-white bg-[#238653]" />
                </span>
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#1d5fd6]">GROUP HEADQUARTERS</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(35,134,83,0.35)] bg-[rgba(35,134,83,0.10)] px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-[#1d6b44]">
                    <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#238653]" />
                    Live group view
                  </span>
                </div>
                <h2 className="mt-1 text-[22px] font-semibold tracking-tight text-[color:var(--ink)] transition-colors group-hover/id:text-[#1d5fd6]">MEIL Group</h2>
                <p className={`mt-0.5 text-[12.5px] ${INK_FAINT}`}>Group ESG command · {reportingYear}</p>
              </div>
            </div>

            {/* health */}
            <div className="flex items-center gap-4">
              <HealthRing value={approvalRate} gid="cc-health" size={116} stroke={12} />
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-[color:var(--ink)]">Approval health</div>
                <p className={`mt-0.5 text-xs leading-snug ${INK_FAINT}`}>
                  {k.approved} of {k.approved + k.pendingReview + k.rejectedReturned} reviewed submissions approved
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {k.overdue > 0 ? <Chip tone="red">{k.overdue} overdue</Chip> : <Chip tone="green">On track</Chip>}
                  <button
                    onClick={() => navigate("hierarchy")}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/60 bg-white/60 px-3.5 text-[12.5px] font-semibold text-[#1d5fd6] backdrop-blur transition hover:bg-white/85"
                  >
                    <FolderTree className="h-3.5 w-3.5" aria-hidden="true" />
                    Open hierarchy
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* row 2 — entity stat tiles */}
          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            {heroStats.map((s) => (
              <button
                key={s.label}
                onClick={s.go}
                aria-label={`${s.label}: ${s.value} — open module`}
                className="glass-subtle group relative flex flex-col items-start gap-2 rounded-2xl border border-white/55 p-3.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/75 hover:shadow-[0_10px_26px_rgba(23,38,61,0.10)]"
              >
                <ArrowUpRight
                  className="absolute right-3 top-3 h-3.5 w-3.5 text-[color:var(--ink-faint)] opacity-0 transition-opacity group-hover:opacity-100"
                  aria-hidden="true"
                />
                <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `${s.color}1c` }}>
                  <s.icon className="h-[18px] w-[18px]" hue={s.color} />
                </span>
                <span className="tabular text-[22px] font-semibold leading-6 tracking-tight text-[color:var(--ink)]">
                  <CountUp value={s.value} format={(n) => fmtNumber(Math.round(n))} />
                </span>
                <span className={`text-[10.5px] font-semibold uppercase tracking-wider ${INK_FAINT}`}>{s.label}</span>
                {s.note && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-[#1d6b44]">
                    <span aria-hidden="true" className="relative flex h-1.5 w-1.5">
                      <span className="absolute h-full w-full animate-ping rounded-full bg-[#238653] opacity-70" />
                      <span className="relative h-1.5 w-1.5 rounded-full bg-[#238653]" />
                    </span>
                    {s.note}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* row 3 — pipeline micro-strip */}
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-white/50 bg-white/40 px-4 py-2.5 backdrop-blur-sm">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${INK_FAINT}`}>Pipeline</span>
            {pipeline.map((p) => (
              <button
                key={p.label}
                onClick={p.go}
                aria-label={`${p.label}: ${p.value} — open filtered view`}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/55 px-2.5 py-1 text-[11.5px] font-semibold backdrop-blur transition hover:bg-white/85"
              >
                <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                <span className={INK_SOFT}>{p.label}</span>
                <span className="tabular font-bold text-[color:var(--ink)]">{p.value}</span>
              </button>
            ))}
            <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-medium text-[color:var(--ink-faint)]">
              <span aria-hidden className="relative flex h-2 w-2">
                <span className="absolute h-2 w-2 animate-ping rounded-full bg-[#238653] opacity-70" />
                <span className="relative h-2 w-2 rounded-full bg-[#238653]" />
              </span>
              Live · synced just now
            </span>
          </div>
        </div>
      </GlassCard>

      {/* ── 1b. Environmental footprint — clickable cards ── */}
      {fp && (
        <section aria-labelledby="cc-footprint-overview" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 id="cc-footprint-overview" className="text-[15px] font-semibold text-[color:var(--ink)]">
                Environmental footprint
              </h3>
              <p className={`text-xs ${INK_FAINT}`}>Click a card to download a pie-chart PDF report</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <button
              onClick={() => handleFootprintPdf("emissions")}
              aria-label={`View emissions report — ${fmtNumber(fp.emissionsTco2e)} tCO2e`}
              className="glass-subtle group relative flex flex-col items-start gap-2 rounded-2xl border border-white/55 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/75 hover:shadow-[0_10px_26px_rgba(23,38,61,0.10)]"
            >
              <div className="flex items-center justify-between w-full">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "rgba(195,74,74,0.12)" }}>
                  <Flame className="h-[18px] w-[18px]" style={{ color: "#c34a4a" }} />
                </span>
                <span className="rounded-full bg-[rgba(195,74,74,0.15)] px-2 py-0.5 text-[10px] font-semibold text-[#a53b3b]">
                  {fp.emissionsByScope.length} scopes
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <CountUp
                  value={fp.emissionsTco2e}
                  className="tabular text-[26px] font-semibold leading-8 tracking-tight text-[color:var(--ink)]"
                  format={(n) => fmtNumber(n, 2)}
                />
                <span className={`text-[10.5px] font-semibold uppercase tracking-wider ${INK_FAINT}`}>GHG Emissions</span>
                <span className="flex items-center gap-1 text-[10px] font-semibold text-[#a53b3b]">
                  Scope 1: {fmtNumber(fp.scope1Tco2e, 2)} · Scope 2: {fmtNumber(fp.scope2Tco2e, 2)} · Scope 3: {fmtNumber(fp.scope3Tco2e, 2)}
                </span>
              </div>
              <div className="relative mt-3 flex items-center justify-between border-t border-[rgba(125,177,216,0.22)] pt-2.5">
                <span className={`text-[11px] ${INK_FAINT}`}>Click to download pie-chart PDF</span>
                <ArrowUpRight className="h-3.5 w-3.5 text-[color:var(--ink-faint)] opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
              </div>
            </button>

            <button
              onClick={() => handleFootprintPdf("energy")}
              aria-label={`View electricity & energy report — ${fmtNumber(fp.electricityGj)} GJ`}
              className="glass-subtle group relative flex flex-col items-start gap-2 rounded-2xl border border-white/55 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/75 hover:shadow-[0_10px_26px_rgba(23,38,61,0.10)]"
            >
              <div className="flex items-center justify-between w-full">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "rgba(58,123,255,0.12)" }}>
                  <Zap className="h-[18px] w-[18px]" style={{ color: "#3a7bff" }} />
                </span>
                <span className="rounded-full bg-[rgba(58,123,255,0.15)] px-2 py-0.5 text-[10px] font-semibold text-[#1d5fd6]">
                  {fp.energyBySource.length} sources
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <CountUp
                  value={fp.electricityGj}
                  className="tabular text-[26px] font-semibold leading-8 tracking-tight text-[color:var(--ink)]"
                  format={(n) => fmtNumber(n, 1)}
                />
                <span className={`text-[10.5px] font-semibold uppercase tracking-wider ${INK_FAINT}`}>Grid Electricity</span>
                <span className="flex items-center gap-1 text-[10px] font-semibold text-[#1d5fd6]">
                  Total: {fmtNumber(fp.totalEnergyGj, 1)} GJ · Renewable: {fmtNumber(fp.renewableGj, 1)} GJ
                </span>
              </div>
              <div className="relative mt-3 flex items-center justify-between border-t border-[rgba(125,177,216,0.22)] pt-2.5">
                <span className={`text-[11px] ${INK_FAINT}`}>Click to download pie-chart PDF</span>
                <ArrowUpRight className="h-3.5 w-3.5 text-[color:var(--ink-faint)] opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
              </div>
            </button>

            <button
              onClick={() => handleFootprintPdf("water")}
              aria-label={`View water use report — ${fmtNumber(fp.waterKl)} KL`}
              className="glass-subtle group relative flex flex-col items-start gap-2 rounded-2xl border border-white/55 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/75 hover:shadow-[0_10px_26px_rgba(23,38,61,0.10)]"
            >
              <div className="flex items-center justify-between w-full">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "rgba(22,163,163,0.12)" }}>
                  <Droplets className="h-[18px] w-[18px]" style={{ color: "#16a3a3" }} />
                </span>
                <span className="rounded-full bg-[rgba(22,163,163,0.15)] px-2 py-0.5 text-[10px] font-semibold text-[#108a8a]">
                  {fp.waterBySource.length} sources
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <CountUp
                  value={fp.waterKl}
                  className="tabular text-[26px] font-semibold leading-8 tracking-tight text-[color:var(--ink)]"
                  format={(n) => fmtNumber(n, 1)}
                />
                <span className={`text-[10.5px] font-semibold uppercase tracking-wider ${INK_FAINT}`}>Water Withdrawal</span>
                <span className="flex items-center gap-1 text-[10px] font-semibold text-[#108a8a]">
                  Discharge: {fmtNumber(fp.waterDischargeKl, 1)} · Recycled: {fmtNumber(fp.waterRecycledKl, 1)} KL
                </span>
              </div>
              <div className="relative mt-3 flex items-center justify-between border-t border-[rgba(125,177,216,0.22)] pt-2.5">
                <span className={`text-[11px] ${INK_FAINT}`}>Click to download pie-chart PDF</span>
                <ArrowUpRight className="h-3.5 w-3.5 text-[color:var(--ink-faint)] opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
              </div>
            </button>
          </div>
        </section>
      )}

      {/* ── 1c. Submission status strip ── */}
      <section aria-labelledby="cc-status-overview">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 id="cc-status-overview" className="text-[15px] font-semibold text-[color:var(--ink)]">
              Submission status
            </h3>
            <p className={`text-xs ${INK_FAINT}`}>Group-wide totals — click a card to drill in</p>
          </div>
          <button
            onClick={() => navigate("submissions")}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--esg-blue)] hover:underline"
          >
            Open submissions register
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatusCard
            icon={SubmissionFlowIcon}
            hue="#3a7bff"
            label="Submissions"
            hint="All ESG filings across the group"
            value={k.submissions}
            total={k.submissions}
            footerNote="All reporting entities"
            onClick={() => navigate("submissions")}
          />
          <StatusCard
            icon={ApprovalRosetteIcon}
            hue="#238653"
            label="Approved"
            hint="Approved & eligible for consolidation"
            value={k.approved}
            total={k.submissions}
            onClick={() => navigate("submissions", { statusFilter: "APPROVED" })}
          />
          <StatusCard
            icon={ReviewPendingIcon}
            hue="#c57926"
            label="Pending review"
            hint="Awaiting an admin review decision"
            value={k.pendingReview}
            total={k.submissions}
            onClick={() => navigate("approvals")}
          />
          <StatusCard
            icon={OverdueSirenIcon}
            hue="#c34a4a"
            label="Overdue"
            hint="Past due date — escalate now"
            value={k.overdue}
            total={k.submissions}
            onClick={() => navigate("submissions", { statusFilter: "OVERDUE" })}
          />
        </div>
      </section>

      {/* ── 2. Pipeline + ESG trend ── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <SectionCard
          title="Submission pipeline"
          description="Where every report stands in the review flow"
          icon={WorkflowIcon}
          className="xl:col-span-4"
          actions={<Chip tone="gray">{k.submissions} total</Chip>}
        >
          <div className="flex flex-col gap-2">
            {pipeline.map((p) => {
              const pct = k.submissions > 0 ? (p.value / k.submissions) * 100 : 0;
              return (
                <button
                  key={p.label}
                  onClick={p.go}
                  className="group rounded-2xl border border-transparent px-3 py-2.5 text-left transition-all hover:border-white/60 hover:bg-white/60"
                  aria-label={`${p.label}: ${p.value} submissions`}
                >
                  <div className="flex items-center justify-between gap-2 text-[13px]">
                    <span className={`flex items-center gap-2 font-medium ${INK_SOFT}`}>
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} aria-hidden="true" />
                      {p.label}
                    </span>
                    <span className="tabular">
                      <span className="font-semibold text-[color:var(--ink)]">{p.value}</span>
                      <span className={`ml-1.5 text-xs ${INK_FAINT}`}>{Math.round(pct)}%</span>
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[rgba(102,119,141,0.12)]">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${p.color}99, ${p.color})`, transition: "width 0.8s cubic-bezier(0.22,1,0.36,1)" }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-[rgba(195,74,74,0.16)] bg-[rgba(195,74,74,0.06)] px-3.5 py-2.5">
            <span className={`text-xs ${INK_SOFT}`}>
              <span className="font-semibold text-[#a53b3b]">{k.overdue}</span> overdue submission{k.overdue === 1 ? "" : "s"} need escalation
            </span>
            <button
              onClick={() => navigate("submissions", { statusFilter: "OVERDUE" })}
              className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[#a53b3b] hover:underline"
            >
              Open <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
        </SectionCard>

        <SectionCard
          title="ESG performance trend"
          description="Scope 1 & 2 emissions (tCO2e) with renewable share on the right axis"
          icon={TrendIcon}
          className="xl:col-span-8"
          actions={
            latest && (
              <div className="flex flex-wrap items-center gap-1.5">
                <Chip tone="blue">Scope 1 {fmtNumber(latest.scope1)}</Chip>
                <Chip tone="purple">Scope 2 {fmtNumber(latest.scope2)}</Chip>
                <Chip tone="teal">Renewable {Math.round(latest.renewable)}%</Chip>
              </div>
            )
          }
        >
          <ResponsiveContainer width="100%" height={252}>
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
      </div>

      {/* ── 3. Completion + approval mix + category pulse ── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <SectionCard title="Submission completion" description="Reports received vs completed (approved) by month" icon={ReportChartIcon} className="xl:col-span-5">
          <ResponsiveContainer width="100%" height={248}>
            <BarChart data={data.completionByMonth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(102,119,141,0.16)" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "#8595ab", fontSize: 11 }} />
              <YAxis allowDecimals={false} width={36} tickLine={false} axisLine={false} tick={{ fill: "#8595ab", fontSize: 11 }} />
              <Tooltip content={<GlassChartTip />} cursor={{ fill: "rgba(58,123,255,0.06)" }} />
              <Bar dataKey="received" name="Received" fill="rgba(58,123,255,0.45)" radius={[6, 6, 0, 0]} maxBarSize={26} />
              <Bar dataKey="completed" name="Completed" fill="#238653" radius={[6, 6, 0, 0]} maxBarSize={26} />
            </BarChart>
          </ResponsiveContainer>
          <ChartLegend
            items={[
              { label: "Received", color: "rgba(58,123,255,0.45)" },
              { label: "Completed (approved)", color: "#238653" },
            ]}
          />
        </SectionCard>

        <SectionCard title="Approval mix" description="Reviewed submission outcomes" icon={CheckSealIcon} className="xl:col-span-3">
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <Donut segments={donutSegments} centerTop={String(k.approved + awaitingReview + k.rejectedReturned)} centerSub="reviewed" />
            <div className="flex w-full flex-col gap-1.5">
              {donutSegments.map((s) => (
                <div key={s.label} className="flex items-center justify-between gap-2 text-xs">
                  <span className={`flex items-center gap-1.5 ${INK_SOFT}`}>
                    <span className="h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                    {s.label}
                  </span>
                  <span className="tabular font-semibold text-[color:var(--ink)]">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Category pulse" description="Top reporting categories by volume" icon={PulseIcon} className="xl:col-span-4">
          {categoryMix.length === 0 ? (
            <EmptyState title="No categories yet" message="Category mix appears once submissions arrive." />
          ) : (
            <div className="flex flex-col gap-3">
              {categoryMix.map((cm) => {
                const max = categoryMix[0]?.count || 1;
                const w = (cm.count / max) * 100;
                const aw = cm.count > 0 ? (cm.approved / cm.count) * 100 : 0;
                return (
                  <button
                    key={cm.category}
                    onClick={() => navigate("submissions", { statusFilter: cm.category })}
                    className="group rounded-xl px-1 py-0.5 text-left"
                    aria-label={`Open ${cm.category} submissions`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className={`font-medium capitalize group-hover:text-[color:var(--esg-blue)] ${INK_SOFT}`}>
                        {cm.category.toLowerCase()}
                      </span>
                      <span className={`tabular ${INK_FAINT}`}>{cm.approved}/{cm.count} approved</span>
                    </div>
                    <div className="relative mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[rgba(102,119,141,0.12)]">
                      <div className="absolute inset-y-0 left-0 rounded-full bg-[rgba(58,123,255,0.28)]" style={{ width: `${w}%` }} />
                      <div className="absolute inset-y-0 left-0 rounded-full bg-[#238653]" style={{ width: `${(aw / 100) * w}%` }} />
                    </div>
                  </button>
                );
              })}
              <p className={`text-[11px] ${INK_FAINT}`}>
                <span className="mr-1 inline-block h-2 w-2 rounded-full bg-[rgba(58,123,255,0.28)] align-middle" />
                volume
                <span className="mx-1 inline-block h-2 w-2 rounded-full bg-[#238653] align-middle" />
                approved share
              </p>
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── 4. Subsidiary scorecards ── */}
      <section aria-labelledby="cc-scorecards">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 id="cc-scorecards" className="text-[15px] font-semibold text-[color:var(--ink)]">Subsidiary scorecards</h3>
          <button onClick={() => navigate("subsidiaries")} className="inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--esg-blue)] hover:underline">
            Manage subsidiaries <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>
        {data.orgProgress.length === 0 ? (
          <SectionCard>
            <EmptyState title="No subsidiaries yet" message="Create your first subsidiary to see reporting progress here." />
          </SectionCard>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {data.orgProgress.map((op) => {
              const pct = op.total > 0 ? (op.approved / op.total) * 100 : 0;
              const id = subIdByName.get(op.name);
              return (
                <GlassCard
                  key={op.name}
                  interactive
                  onClick={() => (id ? openDetail("subsidiaries", id, "overview") : navigate("subsidiaries"))}
                  className="p-4"
                  role="button"
                  aria-label={`Open ${op.name} details — ${Math.round(pct)}% approved`}
                >
                  <div className="flex items-center gap-3">
                    <MiniRing value={pct} tone={op.overdue > 0 ? "#c57926" : "#238653"} />
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-semibold text-[color:var(--ink)]">{op.name}</div>
                      <div className={`truncate text-xs ${INK_FAINT}`}>{op.level}</div>
                    </div>
                  </div>
                  <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-[rgba(125,177,216,0.22)] pt-3 text-xs">
                    <span className={`tabular ${INK_SOFT}`}>
                      <span className="font-semibold text-[color:var(--ink)]">{op.approved}</span>/{op.total} approved
                    </span>
                    {op.overdue > 0 ? <Chip tone="red">{op.overdue} overdue</Chip> : <Chip tone="green">On track</Chip>}
                  </div>
                </GlassCard>
              );
            })}
          </div>
        )}
      </section>

      {/* ── 5. Role performance + quick actions ── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <SectionCard title="Role-wise performance" description="Approval rate of submissions by contributor role" icon={PeopleIcon} className="xl:col-span-2">
          {data.rolePerformance.length === 0 ? (
            <EmptyState title="No role data yet" message="Role performance appears once users start submitting reports." />
          ) : (
            <div className="flex flex-col gap-3">
              {data.rolePerformance.map((rp, i) => {
                const pct = rp.total > 0 ? (rp.approved / rp.total) * 100 : 0;
                const tones = ["#3a7bff", "#6a5bff", "#16a3a3", "#238653", "#c57926", "#c34a4a"];
                const tone = tones[i % tones.length];
                return (
                  <div key={rp.role}>
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className={`flex min-w-0 items-center gap-1.5 font-medium ${INK_SOFT}`}>
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: tone }} aria-hidden="true" />
                        <span className="truncate">{ROLE_LABELS[rp.role] ?? rp.role.replaceAll("_", " ")}</span>
                      </span>
                      <span className={`tabular shrink-0 ${INK_FAINT}`}>
                        {rp.approved}/{rp.total} · {rp.onTime} on time
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[rgba(102,119,141,0.14)]">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${tone}99, ${tone})` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Quick actions" description="Jump into the most common group-admin workflows" icon={TaskCheckIcon} className="xl:col-span-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {quickActions.map((qa) => (
              <button
                key={qa.label}
                onClick={qa.run}
                className="glass-subtle group flex flex-col items-start gap-2 rounded-2xl border-white/50 p-3.5 text-left transition-all hover:-translate-y-0.5 hover:bg-white/70"
                aria-label={qa.label}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl transition-transform group-hover:scale-105" style={{ background: `${qa.tint}1f` }}>
                  <qa.icon className="h-[18px] w-[18px]" hue={qa.tint} />
                </span>
                <span className="text-[13px] font-semibold leading-4 text-[color:var(--ink)]">{qa.label}</span>
                <span className={`text-[11px] leading-snug ${INK_FAINT}`}>{qa.hint}</span>
              </button>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* ── 6. Operations strip: approvals / deadlines / quality ── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <SectionCard
          title="Pending approvals"
          description="Submissions waiting for your review"
          icon={FileCheckIcon}
          actions={<Chip tone={data.pendingApprovals.length > 0 ? "amber" : "green"}>{data.pendingApprovals.length}</Chip>}
        >
          {data.pendingApprovals.length === 0 ? (
            <EmptyState title="Queue is clear" message="No submissions are awaiting review right now." icon={BadgeCheck} />
          ) : (
            <div className="nice-scroll flex max-h-[290px] flex-col gap-2 overflow-y-auto pr-1">
              {data.pendingApprovals.map((pa) => (
                <button
                  key={pa.id}
                  onClick={() => openDetail("approvals", pa.id)}
                  className="group relative w-full overflow-hidden rounded-2xl border border-white/50 bg-white/40 px-3.5 py-2.5 text-left transition-all hover:-translate-y-px hover:bg-white/70 hover:shadow-sm"
                  aria-label={`Review ${pa.title}`}
                >
                  <span className="absolute inset-y-0 left-0 w-[3px] rounded-full bg-[#c57926] opacity-70 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                  <span className="flex items-start justify-between gap-2 pl-1.5">
                    <span className="line-clamp-1 text-[13px] font-semibold text-[color:var(--ink)] group-hover:text-[color:var(--esg-blue)]">{pa.title}</span>
                    <StatusBadge status={pa.status} />
                  </span>
                  <span className={`mt-1 flex flex-wrap items-center gap-x-2 pl-1.5 text-xs ${INK_FAINT}`}>
                    <span className="font-medium">{pa.ref}</span>
                    <span>·</span>
                    <span>{pa.subsidiaryName ?? "—"}</span>
                    <span>·</span>
                    <span>by {pa.submittedByName ?? "—"}</span>
                    <span>·</span>
                    <span>due {fmtDate(pa.dueDate)}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Upcoming & overdue deadlines"
          description="Reporting tasks ordered by due date"
          icon={AlarmAlertIcon}
          actions={<Chip tone="gray">{data.deadlines.length}</Chip>}
        >
          {data.deadlines.length === 0 ? (
            <EmptyState title="No open deadlines" message="All reporting tasks are completed." icon={ListChecks} />
          ) : (
            <div className="nice-scroll flex max-h-[290px] flex-col gap-2 overflow-y-auto pr-1">
              {data.deadlines.map((d) => (
                <button
                  key={d.id}
                  onClick={() => openDetail("tasks", d.id)}
                  className="group relative w-full overflow-hidden rounded-2xl border border-white/50 bg-white/40 px-3.5 py-2.5 text-left transition-all hover:-translate-y-px hover:bg-white/70 hover:shadow-sm"
                  aria-label={`Open task ${d.title}`}
                >
                  <span className="absolute inset-y-0 left-0 w-[3px] rounded-full bg-[#3a7bff] opacity-70 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                  <span className="flex items-start justify-between gap-2 pl-1.5">
                    <span className="line-clamp-1 text-[13px] font-semibold text-[color:var(--ink)] group-hover:text-[color:var(--esg-blue)]">{d.title}</span>
                    <StatusBadge status={d.priority} />
                  </span>
                  <span className={`mt-1 flex flex-wrap items-center gap-x-2 pl-1.5 text-xs ${INK_FAINT}`}>
                    <span className="font-medium">{d.ref}</span>
                    <span>·</span>
                    <span>{d.assigneeLabel}</span>
                    <span>·</span>
                    <span>due {fmtDate(d.dueDate)}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Data quality issues"
          description="Flagged by reviewers & validation engine"
          icon={FilesIcon}
          actions={<Chip tone={data.dataQuality.length > 0 ? "red" : "green"}>{data.dataQuality.length}</Chip>}
        >
          {data.dataQuality.length === 0 ? (
            <EmptyState title="No quality issues" message="All submissions passed validation." icon={BadgeCheck} />
          ) : (
            <div className="nice-scroll flex max-h-[290px] flex-col gap-2 overflow-y-auto pr-1">
              {data.dataQuality.map((dq) => {
                const critical = dq.severity === "CRITICAL";
                const Icon = critical ? AlertOctagon : AlertTriangle;
                return (
                  <button
                    key={dq.id}
                    onClick={() => navigate("consolidation")}
                    className="group relative w-full overflow-hidden rounded-2xl border border-white/50 bg-white/40 px-3.5 py-2.5 text-left transition-all hover:-translate-y-px hover:bg-white/70 hover:shadow-sm"
                    aria-label={`Investigate ${dq.title}`}
                  >
                    <span className={`absolute inset-y-0 left-0 w-[3px] rounded-full ${critical ? "bg-[#c34a4a]" : "bg-[#c57926]"}`} aria-hidden="true" />
                    <span className="flex items-start gap-2.5 pl-1.5">
                      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${critical ? "bg-[rgba(195,74,74,0.12)] text-[#c34a4a]" : "bg-[rgba(197,121,38,0.13)] text-[#c57926]"}`}>
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="line-clamp-1 text-[13px] font-semibold text-[color:var(--ink)] group-hover:text-[color:var(--esg-blue)]">{dq.title}</span>
                        <span className={`mt-0.5 line-clamp-2 block text-xs ${INK_FAINT}`}>{dq.issue}</span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── 7. Activity timeline ── */}
      <SectionCard
        title="Recent activity"
        description="Latest actions across the organization"
        icon={PulseIcon}
        actions={
          <button onClick={() => navigate("activity")} className="inline-flex items-center gap-1 text-xs font-medium text-[color:var(--esg-blue)] hover:underline">
            Open activity feed <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </button>
        }
      >
        {data.activityFeed.length === 0 ? (
          <EmptyState title="No recent activity" message="User actions will appear here as they happen." />
        ) : (
          <div className="relative">
            <span aria-hidden className="absolute bottom-3 left-[17px] top-3 w-px bg-[rgba(125,177,216,0.4)]" />
            <div className="flex flex-col gap-1">
              {data.activityFeed.map((a) => (
                <button
                  key={a.id}
                  onClick={() => navigate("activity")}
                  className="group relative flex items-start gap-3 rounded-2xl px-1.5 py-2 text-left transition-colors hover:bg-white/55"
                  aria-label={`Activity by ${a.actorName}`}
                >
                  <span className="relative z-10 mt-0.5 shrink-0 rounded-full border border-white/70 bg-white shadow-sm">
                    <Avatar name={a.actorName || "System"} size={36} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-[13px] text-[color:var(--ink-soft)]">
                      <span className="truncate font-semibold text-[color:var(--ink)]">{a.actorName}</span>
                      <span className="shrink-0 rounded-md bg-[rgba(58,123,255,0.1)] px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-[#1d5fd6]">
                        {a.action.replaceAll("_", " ")}
                      </span>
                      <span className="truncate">{a.targetLabel}</span>
                    </span>
                    <span className={`mt-0.5 block text-xs ${INK_FAINT}`}>
                      {ROLE_LABELS[a.actorRole] ?? a.actorRole.replaceAll("_", " ")} · {a.orgLabel} · {timeAgo(a.createdAt)}
                    </span>
                  </span>
                  {a.severity === "WARNING" ? <Chip tone="amber">Warning</Chip> : <ChevronRight className={`mt-1 h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-60 ${INK_FAINT}`} aria-hidden="true" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
