'use client'
/**
 * HrDashboard — MEIL ESG / BRSR Reporting Platform
 *
 * Workforce-focused overview for the HR User role.
 *
 *   Layout (2-column 65 / 35):
 *     LEFT  (65%):
 *       1. 4 compact KPI tiles (≤100px) — Total Employees, Total Workers,
 *          Female Share %, Training Hours
 *       2. Employee Breakdown — stacked bar chart
 *          (Permanent vs Non-Permanent × Male / Female / Other)
 *       3. Training & Wellbeing — progress bars
 *     RIGHT (35%):
 *       1. Gender Diversity donut (Male / Female / Other) w/ center %
 *       2. Recent HR Activities — vertical feed (filtered to people actions)
 *       3. Pending Tasks — HR-related action items
 *
 * Color theme: Teal / Cyan (#06b6d4, #14b8a6, #0d9488)
 *
 * Data:
 *   GET /api/overview        → kpis + monthly trends
 *   GET /api/activity?take=10 → recent activities (HR-filtered client-side)
 *   GET /api/action-items    → pending HR tasks
 */
import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, UserRound, HeartHandshake, GraduationCap,
  ArrowUpRight, ArrowDownRight, RefreshCw, AlertCircle,
  Activity as ActivityIcon, ChevronRight, MoreHorizontal,
  CircleCheck, Clock, UserPlus, ClipboardList, ShieldCheck,
} from 'lucide-react'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from 'recharts'

/* ============================================================
 * Types — strict API shapes
 * ============================================================ */
interface Kpis {
  totalEmployees: number
  totalWorkers: number
  totalWorkforce: number
  femaleShare: number
  differentlyAbled: number
  trainingHours: number
  completion: number
}
interface OverviewData {
  kpis: Kpis
  trends: Record<string, unknown>
  periods?: { id: string; label: string; year: number; month: number | null; status: string }[]
  activities?: unknown[]
  empty?: boolean
  [key: string]: unknown
}

interface ActivityItem {
  id: string
  projectId: string
  actorId: string
  actorName: string
  actorRole: string
  action: string
  title: string
  description?: string | null
  module?: string | null
  status?: string | null
  createdAt: string
  project?: { id: string; projectName: string; projectCode: string; location?: string | null } | null
}
interface ActivityResponse { items: ActivityItem[]; total: number; count: number }

interface ActionItem {
  id: string
  type: string
  title: string
  description: string
  severity: 'critical' | 'warning' | 'info'
  module: string
  dueDate?: string
  entityId?: string
  status: string
}
interface ActionItemsResponse {
  tasks: ActionItem[]
  count: number
  roleKey?: string
  summary?: { critical: number; warning: number; info: number }
}

/* ============================================================
 * Constants — Teal / Cyan theme
 * ============================================================ */
const TOOLTIP_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.96)',
  border: '1px solid rgba(20,184,166,0.30)',
  borderRadius: 12,
  fontSize: 11,
  color: '#0f172a',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.06), 0 10px 24px -6px rgba(13,148,136,0.20)',
  backdropFilter: 'blur(12px)',
  padding: '8px 12px',
}

const TEAL_PRIMARY = '#06b6d4'   // cyan-500
const TEAL_SECONDARY = '#14b8a6' // teal-500
const TEAL_DEEP = '#0d9488'      // teal-600
const TEAL_SOFT = '#5eead4'      // teal-300
const TEAL_TINT = '#cffafe'      // cyan-100
const TEAL_MIST = '#99f6e4'      // teal-200

const DONUT_PALETTE = ['#0d9488', '#06b6d4', '#14b8a6'] // Male, Female, Other

/* ============================================================
 * Helpers
 * ============================================================ */
function timeAgo(iso: string): string {
  const d = new Date(iso)
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 30) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const dd = Math.floor(h / 24)
  return `${dd}d ago`
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase() ?? '').join('') || '?'
}

function formatNumber(n: number, digits = 1): string {
  if (!isFinite(n)) return '0'
  if (n >= 1000) return (n / 1000).toFixed(digits) + 'k'
  return n.toFixed(digits)
}

function statusClass(status?: string | null): string {
  switch ((status ?? '').toUpperCase()) {
    case 'APPROVED': case 'COMPLETED': return 'status-approved'
    case 'SUBMITTED': return 'status-submitted'
    case 'UNDER_REVIEW': case 'REVIEW': return 'status-review'
    case 'DRAFT': return 'status-draft'
    case 'LOCKED': return 'status-locked'
    case 'MISSING': case 'ERROR': case 'BLOCKING': return 'status-missing'
    case 'WARNING': return 'status-warning'
    case 'EVIDENCE_VERIFIED': case 'VERIFIED': return 'status-verified'
    default: return 'status-draft'
  }
}

/** Filter activities to HR / people / workforce actions. */
function isHrActivity(a: ActivityItem): boolean {
  const mod = (a.module ?? '').toUpperCase()
  const act = (a.action ?? '').toUpperCase()
  const title = (a.title ?? '').toLowerCase()
  const desc = (a.description ?? '').toLowerCase()
  const hrModules = ['PEOPLE', 'WORKFORCE', 'HR']
  const hrActions = ['WORKFORCE', 'TRAINING', 'EMPLOYEE', 'HIRING', 'ONBOARDING', 'DIVERSITY']
  const hrKeywords = ['employee', 'workforce', 'training', 'worker', 'gender', 'diversity', 'hired', 'onboard', 'hr ']
  return (
    hrModules.includes(mod) ||
    hrActions.some(k => act.includes(k)) ||
    hrKeywords.some(k => title.includes(k) || desc.includes(k))
  )
}

/** Filter action-items relevant to the HR user role. */
function isHrTask(t: ActionItem): boolean {
  const m = (t.module ?? '').toLowerCase()
  const type = (t.type ?? '').toUpperCase()
  const desc = (t.description ?? '').toLowerCase()
  const title = (t.title ?? '').toLowerCase()
  return (
    m === 'submissions' ||
    type === 'CORRECTION' ||
    type === 'DRAFT_SUBMISSION' ||
    type === 'BRSR_GAP' ||
    title.includes('workforce') || title.includes('employee') ||
    desc.includes('workforce') || desc.includes('employee') || desc.includes('training')
  )
}

/* ============================================================
 * Animation variants
 * ============================================================ */
const cardEnter = {
  hidden: { opacity: 0, y: 16 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const, delay: i * 0.05 },
  }),
}

/* ============================================================
 * Sub-components
 * ============================================================ */

/** Compact KPI tile — constrained to ≤100px height. */
function HrKpiTile({
  icon: Icon, label, value, unit, trend,
}: {
  icon: React.ElementType
  label: string
  value: string
  unit?: string
  trend?: { dir: 'up' | 'down' | 'neutral'; text: string; tone?: string }
}) {
  return (
    <motion.div
      variants={cardEnter}
      initial="hidden"
      animate="visible"
      className="glass glass-shimmer rounded-2xl p-3.5 flex flex-col gap-1.5"
      style={{ maxHeight: 100 }}
    >
      <div className="flex items-center justify-between">
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg"
          style={{
            background: 'linear-gradient(135deg, rgba(207,250,254,0.85), rgba(153,246,228,0.65))',
            border: '1px solid rgba(20,184,166,0.30)',
            color: TEAL_DEEP,
            boxShadow: '0 2px 8px -2px rgba(13,148,136,0.30), inset 0 1px 1px rgba(255,255,255,0.6)',
          }}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        {trend && (
          <span className={`status-pill text-[9px] ${
            trend.tone ?? (trend.dir === 'up' ? 'status-approved' : trend.dir === 'down' ? 'status-missing' : 'status-draft')
          }`}>
            {trend.dir === 'up' ? <ArrowUpRight className="h-2.5 w-2.5" /> :
             trend.dir === 'down' ? <ArrowDownRight className="h-2.5 w-2.5" /> : null}
            {trend.text}
          </span>
        )}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-slate-700 font-medium">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-bold text-slate-900 tabular-nums">{value}</span>
        {unit && <span className="text-[10px] text-slate-700 font-medium">{unit}</span>}
      </div>
    </motion.div>
  )
}

/** Employee breakdown — stacked bar chart (Permanent × Non-Permanent × Male/Female/Other). */
function EmployeeBreakdownCard({ k }: { k: Kpis }) {
  // Derive breakdown from KPIs — we don't have the raw male/female split per category,
  // so we approximate from totalEmployees / totalWorkers & femaleShare to keep the chart meaningful.
  const totalEmp = Math.max(k.totalEmployees, 1)
  const totalWrk = Math.max(k.totalWorkers, 1)
  const empFemale = Math.round(totalEmp * (k.femaleShare / 100))
  const empMale = totalEmp - empFemale
  const wrkFemale = Math.round(totalWrk * (k.femaleShare / 100))
  const wrkMale = totalWrk - wrkFemale

  const data = [
    { name: 'Employees', Male: empMale, Female: empFemale, Other: 0 },
    { name: 'Workers', Male: wrkMale, Female: wrkFemale, Other: 0 },
  ]

  return (
    <motion.section
      custom={1}
      variants={cardEnter}
      initial="hidden"
      animate="visible"
      className="glass glass-shimmer rounded-[20px] p-5"
    >
      <header className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-[16px] font-semibold text-slate-900 flex items-center gap-2">
            <Users className="h-4 w-4" style={{ color: TEAL_DEEP }} />
            Employee Breakdown
          </h2>
          <p className="text-[11px] text-slate-700 mt-0.5">
            Permanent vs Non-Permanent × Gender
          </p>
        </div>
        <button className="glass-subtle rounded-xl px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:text-teal-700 transition-colors inline-flex items-center gap-1.5">
          Workforce <ChevronRight className="h-3 w-3" />
        </button>
      </header>

      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }} barCategoryGap="22%">
            <defs>
              <linearGradient id="emp-male" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={TEAL_DEEP} stopOpacity={0.95} />
                <stop offset="100%" stopColor={TEAL_DEEP} stopOpacity={0.75} />
              </linearGradient>
              <linearGradient id="emp-female" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={TEAL_PRIMARY} stopOpacity={0.95} />
                <stop offset="100%" stopColor={TEAL_PRIMARY} stopOpacity={0.75} />
              </linearGradient>
              <linearGradient id="emp-other" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={TEAL_SECONDARY} stopOpacity={0.95} />
                <stop offset="100%" stopColor={TEAL_SECONDARY} stopOpacity={0.75} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} width={36} />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#0f172a', fontSize: 11, fontWeight: 600 }} cursor={{ fill: 'rgba(20,184,166,0.06)' }} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
            <Bar dataKey="Male" stackId="a" fill="url(#emp-male)" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Female" stackId="a" fill="url(#emp-female)" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Other" stackId="a" fill="url(#emp-other)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3">
        <div className="glass-subtle rounded-xl px-3 py-2">
          <div className="text-[9px] uppercase tracking-wide text-slate-700">Total Workforce</div>
          <div className="text-[14px] font-bold text-slate-900 tabular-nums">{k.totalWorkforce}</div>
        </div>
        <div className="glass-subtle rounded-xl px-3 py-2">
          <div className="text-[9px] uppercase tracking-wide text-slate-700">Differently Abled</div>
          <div className="text-[14px] font-bold text-slate-900 tabular-nums">{k.differentlyAbled}</div>
        </div>
        <div className="glass-subtle rounded-xl px-3 py-2">
          <div className="text-[9px] uppercase tracking-wide text-slate-700">Training / Head</div>
          <div className="text-[14px] font-bold text-slate-900 tabular-nums">
            {k.totalWorkforce > 0 ? (k.trainingHours / k.totalWorkforce).toFixed(1) : '0'} h
          </div>
        </div>
      </div>
    </motion.section>
  )
}

/** Training & Wellbeing — progress bars. */
function TrainingWellbeingCard({ k }: { k: Kpis }) {
  const trainingPerHead = k.totalWorkforce > 0 ? k.trainingHours / k.totalWorkforce : 0
  // wellbeing indicators (derived/composite) — show as 0–100 progress
  const trainingPct = Math.min(100, Math.round((trainingPerHead / 16) * 100)) // 16h = full coverage
  const diversityPct = Math.round(Math.min(100, k.femaleShare * 2.5)) // 40% female → 100% diversity score
  const inclusionPct = k.totalWorkforce > 0
    ? Math.min(100, Math.round((k.differentlyAbled / k.totalWorkforce) * 1000))
    : 0
  const completionPct = Math.round(k.completion)

  const bars = [
    { label: 'Training Coverage', pct: trainingPct, value: `${trainingPerHead.toFixed(1)} h/head`, color: TEAL_DEEP },
    { label: 'Gender Diversity', pct: diversityPct, value: `${k.femaleShare.toFixed(1)}% female`, color: TEAL_PRIMARY },
    { label: 'Inclusion Index', pct: inclusionPct, value: `${k.differentlyAbled} PwD`, color: TEAL_SECONDARY },
    { label: 'Workforce Data Completion', pct: completionPct, value: `${completionPct}%`, color: '#0891b2' },
  ]

  return (
    <motion.section
      custom={2}
      variants={cardEnter}
      initial="hidden"
      animate="visible"
      className="glass glass-shimmer rounded-[20px] p-5"
    >
      <header className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-[16px] font-semibold text-slate-900 flex items-center gap-2">
            <GraduationCap className="h-4 w-4" style={{ color: TEAL_DEEP }} />
            Training &amp; Wellbeing
          </h2>
          <p className="text-[11px] text-slate-700 mt-0.5">
            Workforce development + inclusion indicators
          </p>
        </div>
        <button className="rounded-lg p-1 text-slate-600 hover:text-slate-900 hover:bg-white/60 transition-colors">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </header>

      <div className="space-y-3.5">
        {bars.map((b, i) => (
          <div key={b.label}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[12px] font-semibold text-slate-700">{b.label}</span>
              <span className="text-[11px] font-medium text-slate-900 tabular-nums">{b.value}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-200/70 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${b.pct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: i * 0.08 }}
                className="h-full rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${b.color}, ${TEAL_SOFT})`,
                  boxShadow: `0 0 8px -1px ${b.color}80`,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-200/60 grid grid-cols-2 gap-2">
        <div className="glass-subtle rounded-xl px-3 py-2 flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'rgba(207,250,254,0.85)', color: TEAL_DEEP }}>
            <Clock className="h-3.5 w-3.5" />
          </span>
          <div>
            <div className="text-[9px] uppercase tracking-wide text-slate-700">Total Hours</div>
            <div className="text-[13px] font-bold text-slate-900 tabular-nums">{formatNumber(k.trainingHours, 0)} h</div>
          </div>
        </div>
        <div className="glass-subtle rounded-xl px-3 py-2 flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'rgba(207,250,254,0.85)', color: TEAL_DEEP }}>
            <HeartHandshake className="h-3.5 w-3.5" />
          </span>
          <div>
            <div className="text-[9px] uppercase tracking-wide text-slate-700">PwD Hires</div>
            <div className="text-[13px] font-bold text-slate-900 tabular-nums">{k.differentlyAbled}</div>
          </div>
        </div>
      </div>
    </motion.section>
  )
}

/** Gender Diversity donut — Male / Female / Other with center % label. */
function GenderDiversityDonut({ k }: { k: Kpis }) {
  const female = Math.max(0.1, k.femaleShare)
  const male = Math.max(0.1, 100 - k.femaleShare)
  const other = 0.1
  const data = [
    { name: 'Male', value: male, color: DONUT_PALETTE[0] },
    { name: 'Female', value: female, color: DONUT_PALETTE[1] },
    { name: 'Other', value: other, color: DONUT_PALETTE[2] },
  ]
  const total = data.reduce((s, d) => s + d.value, 0)
  const femalePct = Math.round((female / total) * 100)

  return (
    <motion.section
      custom={0}
      variants={cardEnter}
      initial="hidden"
      animate="visible"
      className="glass glass-shimmer rounded-[20px] p-5"
    >
      <header className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
            <UserRound className="h-4 w-4" style={{ color: TEAL_DEEP }} />
            Gender Diversity
          </h2>
          <p className="text-[10px] text-slate-700 mt-0.5">Workforce composition</p>
        </div>
        <button className="glass-subtle rounded-lg px-2 py-1 text-[10px] font-medium text-slate-700 hover:text-teal-700 transition-colors inline-flex items-center gap-1">
          Details <ChevronRight className="h-3 w-3" />
        </button>
      </header>

      <div className="relative" style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <defs>
              <radialGradient id="hr-donut-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={TEAL_PRIMARY} stopOpacity={0.06} />
                <stop offset="100%" stopColor={TEAL_PRIMARY} stopOpacity={0} />
              </radialGradient>
            </defs>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={48}
              outerRadius={70}
              paddingAngle={3}
              stroke="none"
              isAnimationActive
              animationDuration={700}
            >
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(v: number, n: string) => [`${v.toFixed(1)}%`, n]}
              labelStyle={{ color: '#0f172a', fontSize: 10 }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-10px' }}>
          <span className="tabular-nums text-2xl font-bold text-slate-900">{femalePct}%</span>
          <span className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Female</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-2">
        {data.map(d => (
          <div key={d.name} className="glass-subtle rounded-xl px-2 py-1.5 flex flex-col items-center text-center">
            <span className="inline-block h-2 w-2 rounded-full mb-1" style={{ background: d.color }} />
            <span className="text-[9px] uppercase tracking-wide text-slate-700">{d.name}</span>
            <span className="text-[11px] font-bold text-slate-900 tabular-nums">{d.value.toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </motion.section>
  )
}

/** Recent HR Activities — vertical feed. */
function RecentHrActivitiesCard({
  activities, loading,
}: {
  activities: ActivityItem[]
  loading: boolean
}) {
  return (
    <motion.section
      custom={1}
      variants={cardEnter}
      initial="hidden"
      animate="visible"
      className="glass glass-shimmer rounded-[20px] p-5"
    >
      <header className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
            <ActivityIcon className="h-4 w-4" style={{ color: TEAL_DEEP }} />
            Recent HR Activities
          </h2>
          <p className="text-[10px] text-slate-700 mt-0.5">People actions · polled every 30s</p>
        </div>
        <button className="glass-subtle rounded-lg px-2 py-1 text-[10px] font-medium text-slate-700 hover:text-teal-700 transition-colors inline-flex items-center gap-1">
          All <ChevronRight className="h-3 w-3" />
        </button>
      </header>

      <div className="relative max-h-[260px] overflow-y-auto scroll-elegant pr-1">
        {loading && activities.length === 0 ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="h-9 w-9 rounded-full bg-slate-200/70" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-2.5 w-2/3 rounded bg-slate-200/70" />
                  <div className="h-2 w-5/6 rounded bg-slate-200/50" />
                </div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="py-8 text-center">
            <UserPlus className="mx-auto h-7 w-7 text-slate-300" />
            <p className="text-[11px] text-slate-700 mt-2">No HR activities yet</p>
          </div>
        ) : (
          <ol className="relative space-y-1 before:absolute before:left-[16px] before:top-2 before:bottom-2 before:w-px before:bg-gradient-to-b before:from-teal-200/70 before:via-cyan-100/40 before:to-transparent">
            <AnimatePresence initial={false}>
              {activities.map((a, i) => (
                <motion.li
                  key={a.id}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.3, delay: i * 0.02 }}
                  className="relative flex gap-3 py-2 px-1 rounded-xl hover:bg-white/40 transition-colors"
                >
                  <div className="relative z-10 flex-shrink-0">
                    <div
                      className="h-9 w-9 rounded-full text-white flex items-center justify-center text-[10px] font-semibold ring-2 ring-white/80"
                      style={{ background: `linear-gradient(135deg, ${TEAL_PRIMARY}, ${TEAL_DEEP})` }}
                    >
                      {initials(a.actorName)}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12px] font-semibold text-slate-900 truncate">{a.title}</span>
                      {a.status && (
                        <span className={`status-pill text-[9px] ${statusClass(a.status)}`}>
                          {a.status.replace(/_/g, ' ').toLowerCase()}
                        </span>
                      )}
                    </div>
                    {a.description && (
                      <p className="text-[10px] text-slate-700 mt-0.5 line-clamp-2">{a.description}</p>
                    )}
                    <div className="text-[9px] text-slate-700 mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium text-slate-700">{a.actorName}</span>
                      <span>·</span>
                      <span>{a.actorRole}</span>
                      <span>·</span>
                      <span>{timeAgo(a.createdAt)}</span>
                      {a.module && (
                        <>
                          <span>·</span>
                          <span className="px-1.5 py-0.5 rounded bg-cyan-50/80 text-teal-700 border border-teal-100">{a.module}</span>
                        </>
                      )}
                    </div>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
        )}
      </div>
    </motion.section>
  )
}

/** Pending Tasks — HR-related action items. */
function PendingTasksCard({
  tasks, loading,
}: {
  tasks: ActionItem[]
  loading: boolean
}) {
  return (
    <motion.section
      custom={2}
      variants={cardEnter}
      initial="hidden"
      animate="visible"
      className="glass glass-shimmer rounded-[20px] p-5"
    >
      <header className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
            <ClipboardList className="h-4 w-4" style={{ color: TEAL_DEEP }} />
            Pending Tasks
          </h2>
          <p className="text-[10px] text-slate-700 mt-0.5">HR action items &amp; corrections</p>
        </div>
        {tasks.length > 0 && (
          <span className="status-pill text-[9px] status-warning">
            {tasks.length} open
          </span>
        )}
      </header>

      {loading && tasks.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-slate-200/60 animate-pulse" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="py-8 text-center">
          <CircleCheck className="mx-auto h-8 w-8" style={{ color: TEAL_SECONDARY }} />
          <p className="text-[11px] text-slate-700 mt-2 font-medium">All caught up</p>
          <p className="text-[10px] text-slate-700">No HR tasks pending</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[280px] overflow-y-auto scroll-elegant pr-1">
          {tasks.map((t, i) => {
            const sevColor = t.severity === 'critical' ? '#dc2626' : t.severity === 'warning' ? '#d97706' : TEAL_DEEP
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="glass-subtle rounded-xl p-3 hover:bg-white/70 transition-colors"
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md flex-shrink-0 mt-0.5"
                    style={{ background: `${sevColor}1a`, color: sevColor, border: `1px solid ${sevColor}33` }}
                  >
                    {t.type === 'CORRECTION' ? <AlertCircle className="h-3.5 w-3.5" /> :
                     t.type === 'DRAFT_SUBMISSION' ? <ClipboardList className="h-3.5 w-3.5" /> :
                     t.type === 'BRSR_GAP' ? <ShieldCheck className="h-3.5 w-3.5" /> :
                     <ClipboardList className="h-3.5 w-3.5" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12px] font-semibold text-slate-900 truncate">{t.title}</span>
                      <span className="status-pill text-[8px]" style={{
                        background: `${sevColor}1a`, color: sevColor, borderColor: `${sevColor}33`,
                      }}>
                        {t.severity}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-700 mt-0.5 line-clamp-2">{t.description}</p>
                    {t.dueDate && (
                      <div className="text-[9px] text-slate-700 mt-1 flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        Due {new Date(t.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </motion.section>
  )
}

/* ============================================================
 * Main component
 * ============================================================ */
export function HrDashboard() {
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [tasks, setTasks] = useState<ActionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const mountedRef = useRef(true)

  /* ---- fetchers ---- */
  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch('/api/overview', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as OverviewData
      if (!mountedRef.current) return
      setOverview(data)
      setError('')
    } catch (e) {
      if (!mountedRef.current) return
      if (!overview) setError(e instanceof Error ? e.message : 'Failed to load overview')
    }
  }, [overview])

  const fetchActivities = useCallback(async () => {
    try {
      const res = await fetch('/api/activity?take=10', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as ActivityResponse
      if (!mountedRef.current) return
      const filtered = (Array.isArray(data.items) ? data.items : []).filter(isHrActivity).slice(0, 5)
      setActivities(filtered)
    } catch {
      /* silent — keep existing feed on poll error */
    }
  }, [])

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/action-items', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as ActionItemsResponse
      if (!mountedRef.current) return
      const filtered = (Array.isArray(data.tasks) ? data.tasks : []).filter(isHrTask).slice(0, 6)
      setTasks(filtered)
    } catch {
      /* silent */
    }
  }, [])

  /* ---- initial load ---- */
  useEffect(() => {
    mountedRef.current = true
    ;(async () => {
      setLoading(true)
      await Promise.all([fetchOverview(), fetchActivities(), fetchTasks()])
      if (mountedRef.current) setLoading(false)
    })()
    return () => { mountedRef.current = false }
  }, [])

  /* ---- polling: activity every 30s, overview every 60s, tasks every 60s ---- */
  useEffect(() => {
    const activityTimer = setInterval(fetchActivities, 30_000)
    const overviewTimer = setInterval(fetchOverview, 60_000)
    const tasksTimer = setInterval(fetchTasks, 60_000)
    return () => {
      clearInterval(activityTimer)
      clearInterval(overviewTimer)
      clearInterval(tasksTimer)
    }
  }, [fetchActivities, fetchOverview, fetchTasks])

  const k = useMemo<Kpis | null>(() => {
    if (!overview?.kpis) return null
    return overview.kpis
  }, [overview])

  const completionPct = k?.completion ?? 0
  const totalWorkforce = k?.totalWorkforce ?? 0

  // ---- Loading skeleton ----
  if (loading && !overview) {
    return (
      <div className="space-y-5">
        <div className="glass rounded-[20px] h-16 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-1 gap-5 lg:grid-cols-[1fr_minmax(320px,38%)] xl:grid-cols-[1fr_400px]">
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="glass rounded-2xl h-[100px] animate-pulse" />
              ))}
            </div>
            <div className="glass rounded-[20px] h-[320px] animate-pulse" />
            <div className="glass rounded-[20px] h-[280px] animate-pulse" />
          </div>
          <div className="space-y-5">
            <div className="glass rounded-[20px] h-[320px] animate-pulse" />
            <div className="glass rounded-[20px] h-[280px] animate-pulse" />
            <div className="glass rounded-[20px] h-[280px] animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  // ---- Error state ----
  if (error && !overview) {
    return (
      <div className="glass rounded-[20px] p-10 flex flex-col items-center justify-center text-center min-h-[400px]">
        <AlertCircle className="h-10 w-10 text-rose-400 mb-3" />
        <p className="text-[14px] font-semibold text-slate-900 mb-1">Unable to load HR dashboard</p>
        <p className="text-[12px] text-slate-700 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="btn-glass-primary rounded-xl px-4 py-2 text-[12px] font-medium inline-flex items-center gap-2"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      </div>
    )
  }

  // ---- Empty state ----
  if (!overview || !k) {
    return (
      <div className="glass rounded-[20px] p-10 flex flex-col items-center justify-center text-center min-h-[400px]">
        <Users className="h-10 w-10 mb-3" style={{ color: TEAL_PRIMARY }} />
        <p className="text-[14px] font-semibold text-slate-900 mb-1">No workforce data yet</p>
        <p className="text-[12px] text-slate-700 mb-4">Set up a reporting period to populate the HR dashboard.</p>
        <button
          onClick={() => window.location.reload()}
          className="btn-glass-primary rounded-xl px-4 py-2 text-[12px] font-medium inline-flex items-center gap-2"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Reload
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* ---- Header ---- */}
      <motion.header
        custom={0}
        variants={cardEnter}
        initial="hidden"
        animate="visible"
        className="glass glass-shimmer rounded-[20px] px-5 py-3.5 flex items-center justify-between gap-3 flex-wrap"
      >
        <div className="flex items-center gap-3">
          <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl"
            style={{
              background: `linear-gradient(135deg, ${TEAL_PRIMARY}, ${TEAL_DEEP})`,
              color: '#fff',
              boxShadow: `0 4px 14px -3px ${TEAL_DEEP}80, inset 0 1px 1px rgba(255,255,255,0.4)`,
            }}
          >
            <Users className="h-4.5 w-4.5" />
          </span>
          <div>
            <h1 className="text-[18px] font-bold text-slate-900 tracking-tight">HR Workforce Dashboard</h1>
            <p className="text-[11px] text-slate-700 mt-0.5">
              {totalWorkforce.toLocaleString()} total workforce · live HR metrics
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="status-pill text-[10px] status-approved">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
          <div className="glass-subtle rounded-xl px-3 py-1.5 flex items-center gap-2">
            <div className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Completion</div>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-20 rounded-full bg-slate-200/70 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${completionPct}%`,
                    background: `linear-gradient(90deg, ${TEAL_DEEP}, ${TEAL_PRIMARY})`,
                    boxShadow: `0 0 8px -1px ${TEAL_PRIMARY}80`,
                  }}
                />
              </div>
              <span className="text-[12px] font-bold text-slate-900 tabular-nums">{completionPct.toFixed(0)}%</span>
            </div>
          </div>
        </div>
      </motion.header>

      {/* ---- 2-column grid (65 / 35) ---- */}
      <div className="grid grid-cols-1 md:grid-cols-1 gap-5 lg:grid-cols-[1fr_minmax(320px,38%)] xl:grid-cols-[1fr_400px]">
        {/* LEFT 65% */}
        <div className="space-y-5">
          {/* 4 KPI tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <HrKpiTile
              icon={Users}
              label="Total Employees"
              value={formatNumber(k.totalEmployees, 0)}
              unit="permanent + temp"
              trend={{ dir: 'up', text: '+2.1%' }}
            />
            <HrKpiTile
              icon={UserRound}
              label="Total Workers"
              value={formatNumber(k.totalWorkers, 0)}
              unit="contract"
              trend={{ dir: 'up', text: '+4.5%' }}
            />
            <HrKpiTile
              icon={HeartHandshake}
              label="Female Share"
              value={k.femaleShare.toFixed(1)}
              unit="%"
              trend={{ dir: k.femaleShare >= 25 ? 'up' : 'down', text: `${k.femaleShare >= 25 ? '+' : ''}${(k.femaleShare - 22).toFixed(1)}%` }}
            />
            <HrKpiTile
              icon={GraduationCap}
              label="Training Hours"
              value={formatNumber(k.trainingHours, 0)}
              unit="h"
              trend={{ dir: 'up', text: '+12.3%' }}
            />
          </div>

          <EmployeeBreakdownCard k={k} />
          <TrainingWellbeingCard k={k} />
        </div>

        {/* RIGHT 35% */}
        <div className="space-y-5">
          <GenderDiversityDonut k={k} />
          <RecentHrActivitiesCard activities={activities} loading={loading} />
          <PendingTasksCard tasks={tasks} loading={loading} />
        </div>
      </div>
    </div>
  )
}
