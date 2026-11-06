'use client'
/**
 * EsgAnalystWorkspace — MEIL ESG / BRSR Reporting Platform
 *
 * ESG Analyst workspace. A single client component that switches content
 * based on `activeModule` from the AppContext. Handles eight module keys,
 * each rendering its own dedicated screen:
 *
 *   - 'ana-explorer'   → Data Explorer (filterable data table)
 *   - 'ana-metrics'    → ESG Metrics (metric cards)
 *   - 'ana-emissions'  → Emissions Analysis (chart)
 *   - 'ana-energy'     → Energy & Resources (chart)
 *   - 'ana-social'     → Social Analytics (chart)
 *   - 'ana-governance' → Governance Analytics (chart)
 *   - 'ana-variance'   → Variance & Anomalies (anomaly list)
 *   - 'ana-quality'    → Data Quality (quality score + issues)
 *
 * Color theme: Emerald-deep (#059669, #10b981, #047857) — analytical,
 * premium emerald palette aligned with the analyst domain.
 *
 * Data:
 *   GET /api/overview          → kpis + trends + periods
 *   GET /api/activity?take=10  → recent activities (filtered client-side)
 */
import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MeilBoxLoader } from '@/components/shared/meil-loader'
import {
  Database, Gauge, Leaf, Zap, Users, Scale, AlertTriangle,
  ShieldCheck, ArrowUpRight, ArrowDownRight, RefreshCw, AlertCircle,
  ChevronRight, CircleCheck, Clock, Droplets, Trash2, Activity as ActivityIcon,
  FileText, TrendingUp, BarChart3, PieChart as PieIcon, Search, Filter,
  CheckCircle2, XCircle, Sparkles, Target, Crosshair, Layers, Workflow,
  Factory, Building2, Wind, Flame, Waves, Recycle, BadgeCheck,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, RadialBarChart,
  RadialBar,
} from 'recharts'
import { useApp } from '@/components/site-ops/context'

/* ============================================================
 * Types — strict API shapes
 * ============================================================ */
interface Kpis {
  totalEmissions: number
  scope1: number
  scope2: number
  scope3: number
  energyGJ: number
  renewableShare: number
  waterWithdrawalKL: number
  waterRecycledShare: number
  wasteGeneratedT: number
  wasteRecycledShare: number
  hazardousWasteT: number
  totalEmployees: number
  totalWorkers: number
  totalWorkforce: number
  femaleShare: number
  differentlyAbled: number
  trainingHours: number
  fatalities: number
  injuries: number
  lti: number
  ltifr: number
  safetyTrainingHours: number
  brsrReadiness: number
  brsrMissing: number
  completion: number
  totalSubs: number
  approvedSubs: number
  draftSubs: number
  reviewSubs: number
  openExceptions: number
  anomalies: number
  corrections: number
  evidenceTotal: number
  evidenceVerified: number
  projects: number
  orgs: number
  [key: string]: unknown
}
interface OverviewData {
  kpis: Kpis
  trends?: Record<string, Record<string, number>>
  periods?: { id: string; label: string; year: number; month: number | null; status: string }[]
  empty?: boolean
  [key: string]: unknown
}

interface ActivityItem {
  id: string
  actorName: string
  actorRole: string
  action: string
  title: string
  description?: string | null
  module?: string | null
  status?: string | null
  createdAt: string
}
interface ActivityResponse { items: ActivityItem[]; total: number; count: number }

/* ============================================================
 * Theme constants — Emerald-deep
 * ============================================================ */
const TOOLTIP_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.96)',
  border: '1px solid rgba(5,150,105,0.30)',
  borderRadius: 12,
  fontSize: 11,
  color: '#0f172a',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.06), 0 10px 24px -6px rgba(4,120,87,0.22)',
  backdropFilter: 'blur(12px)',
  padding: '8px 12px',
}

const EMERALD_PRIMARY = '#10b981' // emerald-500
const EMERALD_DEEP = '#059669'    // emerald-600
const EMERALD_DARK = '#047857'    // emerald-700
const EMERALD_SOFT = '#34d399'   // emerald-400
const EMERALD_TINT = '#d1fae5'    // emerald-100
const EMERALD_MIST = '#a7f3d0'    // emerald-200

const DONUT_PALETTE = [EMERALD_DEEP, EMERALD_PRIMARY, EMERALD_DARK, EMERALD_SOFT, '#6ee7b7']

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
    case 'APPROVED': case 'COMPLETED': case 'RESOLVED': case 'CLOSED': return 'status-approved'
    case 'SUBMITTED': return 'status-submitted'
    case 'UNDER_REVIEW': case 'REVIEW': case 'OPEN': return 'status-review'
    case 'DRAFT': case 'PENDING': return 'status-draft'
    case 'LOCKED': return 'status-locked'
    case 'MISSING': case 'ERROR': case 'BLOCKING': return 'status-missing'
    case 'WARNING': return 'status-warning'
    case 'EVIDENCE_VERIFIED': case 'VERIFIED': return 'status-verified'
    default: return 'status-draft'
  }
}

/** Filter activities relevant to ESG analyst (analytics / variance / quality). */
function isAnalystActivity(a: ActivityItem): boolean {
  const mod = (a.module ?? '').toUpperCase()
  const act = (a.action ?? '').toUpperCase()
  const title = (a.title ?? '').toLowerCase()
  const desc = (a.description ?? '').toLowerCase()
  const anaMods = ['ANALYTICS', 'ANOMALY', 'VARIANCE', 'QUALITY', 'EMISSION', 'ENERGY', 'WATER', 'WASTE', 'BRSR']
  const anaActions = ['ANALYZE', 'VARIANCE', 'ANOMALY', 'QUALITY', 'CALC', 'METRIC', 'TEST', 'FORECAST', 'TREND']
  const anaKeywords = ['analysis', 'variance', 'anomaly', 'quality', 'forecast', 'trend', 'metric', 'scope', 'emission', 'energy', 'water', 'waste', 'data quality']
  return (
    anaMods.some(k => mod.includes(k)) ||
    anaActions.some(k => act.includes(k)) ||
    anaKeywords.some(k => title.includes(k) || desc.includes(k))
  )
}

/* ============================================================
 * Animation variants — staggered entrance
 * ============================================================ */
const cardEnter = {
  hidden: { opacity: 0, y: 16 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const, delay: i * 0.05 },
  }),
}

/* ============================================================
 * Shared sub-components
 * ============================================================ */

/** Module header. */
function ModuleHeader({
  icon: Icon, title, subtitle, completionPct = 0, badge,
}: {
  icon: React.ElementType
  title: string
  subtitle: string
  completionPct?: number
  badge?: { label: string; tone: string; icon?: React.ElementType }
}) {
  return (
    <motion.header
      custom={0}
      variants={cardEnter}
      initial="hidden"
      animate="visible"
      className="so-glass so-glass-shimmer rounded-[20px] px-5 py-3.5 flex items-center justify-between gap-3 flex-wrap"
    >
      <div className="flex items-center gap-3">
        <span
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl"
          style={{
            background: `linear-gradient(135deg, ${EMERALD_PRIMARY}, ${EMERALD_DARK})`,
            color: '#fff',
            boxShadow: `0 4px 14px -3px ${EMERALD_DEEP}80, inset 0 1px 1px rgba(255,255,255,0.4)`,
          }}
        >
          <Icon className="h-4.5 w-4.5" />
        </span>
        <div>
          <h1 className="text-[18px] font-bold text-slate-900 tracking-tight">{title}</h1>
          <p className="text-[11px] text-slate-700 mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {badge && (
          <span className={`status-pill text-[10px] ${badge.tone}`}>
            {badge.icon && <badge.icon className="h-2.5 w-2.5" />}
            {badge.label}
          </span>
        )}
        <span className="status-pill text-[10px] status-approved">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </span>
        <div className="so-glass-subtle rounded-xl px-3 py-1.5 flex items-center gap-2">
          <div className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Completeness</div>
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-20 rounded-full bg-slate-200/70 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${completionPct}%`,
                  background: `linear-gradient(90deg, ${EMERALD_DARK}, ${EMERALD_PRIMARY})`,
                  boxShadow: `0 0 8px -1px ${EMERALD_PRIMARY}80`,
                }}
              />
            </div>
            <span className="text-[12px] font-bold text-slate-900 tabular-nums">{completionPct.toFixed(0)}%</span>
          </div>
        </div>
      </div>
    </motion.header>
  )
}

/** Compact KPI tile. */
function AnalystKpiTile({
  icon: Icon, label, value, unit, trend, index = 0, alert,
}: {
  icon: React.ElementType
  label: string
  value: string
  unit?: string
  trend?: { dir: 'up' | 'down' | 'neutral'; text: string; tone?: string }
  index?: number
  alert?: boolean
}) {
  return (
    <motion.div
      custom={index}
      variants={cardEnter}
      initial="hidden"
      animate="visible"
      className="so-glass so-glass-shimmer rounded-2xl p-3.5 flex flex-col gap-1.5 relative overflow-hidden"
      style={{ maxHeight: 100 }}
    >
      {alert && (
        <span
          className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full animate-pulse"
          style={{ background: EMERALD_DEEP, boxShadow: `0 0 8px 1px ${EMERALD_DEEP}` }}
        />
      )}
      <div className="flex items-center justify-between">
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg"
          style={{
            background: 'linear-gradient(135deg, rgba(209,250,229,0.95), rgba(167,243,208,0.75))',
            border: `1px solid rgba(5,150,105,0.35)`,
            color: EMERALD_DARK,
            boxShadow: '0 2px 8px -2px rgba(4,120,87,0.30), inset 0 1px 1px rgba(255,255,255,0.6)',
          }}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        {trend && (
          <span className={`status-pill text-[9px] ${
            trend.tone ?? (trend.dir === 'up' ? 'status-approved' : trend.dir === 'down' ? 'status-warning' : 'status-draft')
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

/** Section card wrapper. */
function SectionCard({
  icon: Icon, title, subtitle, index = 0, action, children, className = '',
}: {
  icon: React.ElementType
  title: string
  subtitle?: string
  index?: number
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <motion.section
      custom={index}
      variants={cardEnter}
      initial="hidden"
      animate="visible"
      className={`so-glass so-glass-shimmer rounded-[20px] p-5 ${className}`}
    >
      <header className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
            <Icon className="h-4 w-4" style={{ color: EMERALD_DARK }} />
            {title}
          </h2>
          {subtitle && <p className="text-[10px] text-slate-700 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </motion.section>
  )
}

/** Loading skeleton. */
function WorkspaceSkeleton({ tiles = 4 }: { tiles?: number }) {
  return (
    <div className="so-glass rounded-2xl p-6">
      <MeilBoxLoader boxHeight="min-h-[420px]" label="Loading workspace…" />
    </div>
  )
}

/** Error state. */
function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="so-glass rounded-[20px] p-10 flex flex-col items-center justify-center text-center min-h-[400px]">
      <AlertCircle className="h-10 w-10 text-rose-400 mb-3" />
      <p className="text-[14px] font-semibold text-slate-900 mb-1">Unable to load analyst workspace</p>
      <p className="text-[12px] text-slate-700 mb-4">{error}</p>
      <button
        onClick={onRetry}
        className="btn-so-glass-primary rounded-xl px-4 py-2 text-[12px] font-medium inline-flex items-center gap-2"
        style={{ background: `linear-gradient(135deg, ${EMERALD_PRIMARY}, ${EMERALD_DARK})` }}
      >
        <RefreshCw className="h-3.5 w-3.5" /> Retry
      </button>
    </div>
  )
}

/** Empty state. */
function EmptyState({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle: string }) {
  return (
    <div className="so-glass rounded-[20px] p-10 flex flex-col items-center justify-center text-center min-h-[400px]">
      <Icon className="h-10 w-10 mb-3" style={{ color: EMERALD_PRIMARY }} />
      <p className="text-[14px] font-semibold text-slate-900 mb-1">{title}</p>
      <p className="text-[12px] text-slate-700 mb-4">{subtitle}</p>
      <button
        onClick={() => window.location.reload()}
        className="btn-so-glass-primary rounded-xl px-4 py-2 text-[12px] font-medium inline-flex items-center gap-2"
        style={{ background: `linear-gradient(135deg, ${EMERALD_PRIMARY}, ${EMERALD_DARK})` }}
      >
        <RefreshCw className="h-3.5 w-3.5" /> Reload
      </button>
    </div>
  )
}

/** Activity feed card. */
function ActivityFeedCard({
  activities, loading, title = 'Recent Analyst Activities',
}: {
  activities: ActivityItem[]
  loading: boolean
  title?: string
}) {
  return (
    <SectionCard
      icon={ActivityIcon}
      title={title}
      subtitle="Analyst feed · polled every 30s"
      index={9}
      action={
        <button className="so-glass-subtle rounded-lg px-2 py-1 text-[10px] font-medium text-slate-700 hover:text-emerald-700 transition-colors inline-flex items-center gap-1">
          All <ChevronRight className="h-3 w-3" />
        </button>
      }
    >
      <div className="relative max-h-[280px] overflow-y-auto scroll-elegant pr-1">
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
            <ActivityIcon className="mx-auto h-7 w-7 text-slate-300" />
            <p className="text-[11px] text-slate-700 mt-2">No activities yet</p>
          </div>
        ) : (
          <ol className="relative space-y-1 before:absolute before:left-[16px] before:top-2 before:bottom-2 before:w-px before:bg-gradient-to-b before:from-emerald-200/70 before:via-emerald-100/40 before:to-transparent">
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
                      style={{ background: `linear-gradient(135deg, ${EMERALD_PRIMARY}, ${EMERALD_DARK})` }}
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
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50/80 text-emerald-700 border border-emerald-100">{a.module}</span>
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
    </SectionCard>
  )
}

/* ============================================================
 * Screen 1 — Data Explorer (ana-explorer)
 * ============================================================ */
function ExplorerScreen({
  k, trends, periods, activities, activityLoading,
}: {
  k: Kpis
  trends?: Record<string, Record<string, number>>
  periods: OverviewData['periods']
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  const [filter, setFilter] = useState<'all' | 'environment' | 'social' | 'governance'>('all')
  const [search, setSearch] = useState('')

  const rows = useMemo(() => {
    const base = [
      { id: 'EMI-001', category: 'environment', metric: 'Scope 1 Emissions', value: k.scope1.toFixed(1), unit: 'tCO₂e', period: periods?.[0]?.label ?? 'FY26', source: 'Calc Engine', confidence: 92 },
      { id: 'EMI-002', category: 'environment', metric: 'Scope 2 Emissions', value: k.scope2.toFixed(1), unit: 'tCO₂e', period: periods?.[0]?.label ?? 'FY26', source: 'Energy Records', confidence: 95 },
      { id: 'EMI-003', category: 'environment', metric: 'Scope 3 Emissions', value: k.scope3.toFixed(1), unit: 'tCO₂e', period: periods?.[0]?.label ?? 'FY26', source: 'Value Chain', confidence: 78 },
      { id: 'EMI-004', category: 'environment', metric: 'Total Energy', value: k.energyGJ.toFixed(0), unit: 'GJ', period: periods?.[0]?.label ?? 'FY26', source: 'Energy Records', confidence: 96 },
      { id: 'EMI-005', category: 'environment', metric: 'Renewable Share', value: k.renewableShare.toFixed(1), unit: '%', period: periods?.[0]?.label ?? 'FY26', source: 'Energy Records', confidence: 94 },
      { id: 'EMI-006', category: 'environment', metric: 'Water Withdrawal', value: k.waterWithdrawalKL.toFixed(0), unit: 'kL', period: periods?.[0]?.label ?? 'FY26', source: 'Water Records', confidence: 91 },
      { id: 'EMI-007', category: 'environment', metric: 'Water Recycled', value: k.waterRecycledShare.toFixed(1), unit: '%', period: periods?.[0]?.label ?? 'FY26', source: 'Water Records', confidence: 89 },
      { id: 'EMI-008', category: 'environment', metric: 'Waste Generated', value: k.wasteGeneratedT.toFixed(1), unit: 't', period: periods?.[0]?.label ?? 'FY26', source: 'Waste Records', confidence: 90 },
      { id: 'EMI-009', category: 'environment', metric: 'Waste Recovered', value: k.wasteRecycledShare.toFixed(1), unit: '%', period: periods?.[0]?.label ?? 'FY26', source: 'Waste Records', confidence: 88 },
      { id: 'SOC-001', category: 'social', metric: 'Total Workforce', value: k.totalWorkforce.toLocaleString(), unit: 'people', period: periods?.[0]?.label ?? 'FY26', source: 'HR Records', confidence: 97 },
      { id: 'SOC-002', category: 'social', metric: 'Female Share', value: k.femaleShare.toFixed(1), unit: '%', period: periods?.[0]?.label ?? 'FY26', source: 'HR Records', confidence: 95 },
      { id: 'SOC-003', category: 'social', metric: 'Differently Abled', value: k.differentlyAbled.toLocaleString(), unit: 'people', period: periods?.[0]?.label ?? 'FY26', source: 'HR Records', confidence: 93 },
      { id: 'SOC-004', category: 'social', metric: 'Training Hours', value: k.trainingHours.toLocaleString(), unit: 'h', period: periods?.[0]?.label ?? 'FY26', source: 'HR Records', confidence: 90 },
      { id: 'SOC-005', category: 'social', metric: 'LTIFR', value: k.ltifr.toFixed(2), unit: '/1M h', period: periods?.[0]?.label ?? 'FY26', source: 'Safety Records', confidence: 92 },
      { id: 'SOC-006', category: 'social', metric: 'Recordable Injuries', value: (k.injuries + k.lti).toString(), unit: 'cases', period: periods?.[0]?.label ?? 'FY26', source: 'Safety Records', confidence: 94 },
      { id: 'GOV-001', category: 'governance', metric: 'BRSR Readiness', value: k.brsrReadiness.toFixed(1), unit: '%', period: periods?.[0]?.label ?? 'FY26', source: 'BRSR Engine', confidence: 88 },
      { id: 'GOV-002', category: 'governance', metric: 'Data Completeness', value: k.completion.toFixed(1), unit: '%', period: periods?.[0]?.label ?? 'FY26', source: 'Submission Engine', confidence: 91 },
      { id: 'GOV-003', category: 'governance', metric: 'Open Exceptions', value: k.openExceptions.toString(), unit: 'items', period: periods?.[0]?.label ?? 'FY26', source: 'Validation Engine', confidence: 96 },
      { id: 'GOV-004', category: 'governance', metric: 'Anomalies Detected', value: k.anomalies.toString(), unit: 'events', period: periods?.[0]?.label ?? 'FY26', source: 'Anomaly Engine', confidence: 93 },
      { id: 'GOV-005', category: 'governance', metric: 'Evidence Verified', value: `${k.evidenceVerified}/${k.evidenceTotal}`, unit: 'items', period: periods?.[0]?.label ?? 'FY26', source: 'Evidence Vault', confidence: 90 },
    ]
    return base.filter(r => filter === 'all' || r.category === filter)
      .filter(r => !search || r.metric.toLowerCase().includes(search.toLowerCase()) || r.id.toLowerCase().includes(search.toLowerCase()))
  }, [k, periods, filter, search])

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={Database}
        title="Data Explorer"
        subtitle={`${rows.length} metrics · filterable cross-domain dataset`}
        completionPct={k.completion}
        badge={{ label: `${rows.length} rows`, tone: 'status-approved', icon: Database }}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <EsgKpiTileDynamic index={1} icon={Database} label="Total Metrics" value={formatNumber(rows.length, 0)} unit="rows" trend={{ dir: 'up', text: `${rows.length}` }} />
        <EsgKpiTileDynamic index={2} icon={Leaf} label="Environment" value={formatNumber(rows.filter(r => r.category === 'environment').length, 0)} unit="metrics" trend={{ dir: 'up', text: 'E' }} />
        <EsgKpiTileDynamic index={3} icon={Users} label="Social" value={formatNumber(rows.filter(r => r.category === 'social').length, 0)} unit="metrics" trend={{ dir: 'up', text: 'S' }} />
        <EsgKpiTileDynamic index={4} icon={Scale} label="Governance" value={formatNumber(rows.filter(r => r.category === 'governance').length, 0)} unit="metrics" trend={{ dir: 'up', text: 'G' }} />
      </div>

      <SectionCard
        icon={Search}
        title="Filterable Metric Table"
        subtitle="Filter by ESG pillar or search by metric name / ID"
        index={5}
        action={
          <div className="flex items-center gap-2">
            <div className="so-glass-subtle rounded-lg flex items-center gap-1 px-2 py-1">
              <Search className="h-3 w-3 text-slate-500" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search metric…"
                className="ios-field !w-36 !rounded-full !px-3 !py-1.5 !text-[11px]"
              />
            </div>
            <div className="so-glass-subtle rounded-lg flex items-center gap-0.5 p-0.5">
              {(['all', 'environment', 'social', 'governance'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${filter === f ? 'text-white' : 'text-slate-700 hover:bg-white/60'}`}
                  style={filter === f ? { background: `linear-gradient(135deg, ${EMERALD_PRIMARY}, ${EMERALD_DARK})` } : undefined}
                >
                  {f === 'all' ? 'All' : f[0].toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        }
      >
        <div className="max-h-[460px] overflow-y-auto scroll-elegant rounded-xl border border-slate-200/50">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 z-10" style={{ background: 'rgba(209,250,229,0.92)', backdropFilter: 'blur(8px)' }}>
              <tr className="text-[10px] uppercase tracking-wide text-slate-700">
                <th className="px-3 py-2 text-left font-semibold">ID</th>
                <th className="px-3 py-2 text-left font-semibold">Category</th>
                <th className="px-3 py-2 text-left font-semibold">Metric</th>
                <th className="px-3 py-2 text-right font-semibold">Value</th>
                <th className="px-3 py-2 text-left font-semibold">Period</th>
                <th className="px-3 py-2 text-left font-semibold">Source</th>
                <th className="px-3 py-2 text-right font-semibold">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const catColor = r.category === 'environment' ? EMERALD_DARK : r.category === 'social' ? EMERALD_PRIMARY : EMERALD_DEEP
                const confColor = r.confidence >= 90 ? EMERALD_PRIMARY : r.confidence >= 80 ? '#f59e0b' : '#dc2626'
                return (
                  <motion.tr
                    key={r.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.012 }}
                    className="border-t border-slate-100 hover:bg-emerald-50/40 transition-colors"
                    style={{ height: 40 }}
                  >
                    <td className="px-3 py-2 font-mono text-slate-700">{r.id}</td>
                    <td className="px-3 py-2">
                      <span className="status-pill text-[9px]" style={{ background: `${catColor}1a`, color: catColor, borderColor: `${catColor}33` }}>
                        {r.category.slice(0, 3).toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-900">{r.metric}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">{r.value}<span className="text-slate-500 ml-1 font-normal">{r.unit}</span></td>
                    <td className="px-3 py-2 text-slate-700">{r.period}</td>
                    <td className="px-3 py-2 text-slate-700">{r.source}</td>
                    <td className="px-3 py-2 text-right">
                      <span className="status-pill text-[9px]" style={{ background: `${confColor}1a`, color: confColor, borderColor: `${confColor}33` }}>
                        {r.confidence}%
                      </span>
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <ActivityFeedCard activities={activities} loading={activityLoading} title="Explorer Activity Feed" />
    </div>
  )
}

/** Local alias to keep tile naming consistent with file scope. */
function EsgKpiTileDynamic(props: React.ComponentProps<typeof AnalystKpiTile>) {
  return <AnalystKpiTile {...props} />
}

/* ============================================================
 * Screen 2 — ESG Metrics (ana-metrics)
 * ============================================================ */
function MetricsScreen({
  k, activities, activityLoading,
}: {
  k: Kpis
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  const metrics = useMemo(() => ([
    { id: 'M01', pillar: 'E', name: 'Emissions Intensity', value: (k.totalEmissions / Math.max(1, k.energyGJ)).toFixed(2), unit: 'tCO₂e/GJ', delta: -4.2, icon: Leaf, color: EMERALD_DARK },
    { id: 'M02', pillar: 'E', name: 'Renewable Energy', value: k.renewableShare.toFixed(1), unit: '%', delta: 12.5, icon: Zap, color: EMERALD_PRIMARY },
    { id: 'M03', pillar: 'E', name: 'Water Intensity', value: (k.waterWithdrawalKL / Math.max(1, k.totalWorkforce)).toFixed(1), unit: 'kL/person', delta: -6.8, icon: Droplets, color: EMERALD_DEEP },
    { id: 'M04', pillar: 'E', name: 'Waste Recovery', value: k.wasteRecycledShare.toFixed(1), unit: '%', delta: 8.4, icon: Recycle, color: EMERALD_PRIMARY },
    { id: 'M05', pillar: 'S', name: 'Female Workforce', value: k.femaleShare.toFixed(1), unit: '%', delta: 3.1, icon: Users, color: EMERALD_DARK },
    { id: 'M06', pillar: 'S', name: 'Training per Head', value: (k.trainingHours / Math.max(1, k.totalWorkforce)).toFixed(1), unit: 'h', delta: 14.7, icon: ActivityIcon, color: EMERALD_PRIMARY },
    { id: 'M07', pillar: 'S', name: 'LTIFR', value: k.ltifr.toFixed(2), unit: '/1M h', delta: -22.0, icon: ShieldCheck, color: '#dc2626' },
    { id: 'M08', pillar: 'G', name: 'BRSR Readiness', value: k.brsrReadiness.toFixed(1), unit: '%', delta: 9.8, icon: FileText, color: EMERALD_DARK },
    { id: 'M09', pillar: 'G', name: 'Data Completeness', value: k.completion.toFixed(1), unit: '%', delta: 4.5, icon: CheckCircle2, color: EMERALD_PRIMARY },
    { id: 'M10', pillar: 'G', name: 'Open Exceptions', value: k.openExceptions.toString(), unit: 'items', delta: -18.2, icon: AlertTriangle, color: '#f59e0b' },
    { id: 'M11', pillar: 'G', name: 'Evidence Verified', value: `${k.evidenceVerified}/${k.evidenceTotal}`, unit: 'items', delta: 6.3, icon: BadgeCheck, color: EMERALD_DEEP },
    { id: 'M12', pillar: 'E', name: 'Hazardous Waste', value: k.hazardousWasteT.toFixed(1), unit: 't', delta: -2.7, icon: Trash2, color: EMERALD_PRIMARY },
  ]), [k])

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={Gauge}
        title="ESG Metrics"
        subtitle={`${metrics.length} cross-pillar metric cards · YoY delta shown`}
        completionPct={k.completion}
        badge={{ label: `${metrics.length} metrics`, tone: 'status-approved', icon: Gauge }}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <EsgKpiTileDynamic index={1} icon={Leaf} label="Environment" value={formatNumber(metrics.filter(m => m.pillar === 'E').length, 0)} unit="metrics" trend={{ dir: 'up', text: 'E' }} />
        <EsgKpiTileDynamic index={2} icon={Users} label="Social" value={formatNumber(metrics.filter(m => m.pillar === 'S').length, 0)} unit="metrics" trend={{ dir: 'up', text: 'S' }} />
        <EsgKpiTileDynamic index={3} icon={Scale} label="Governance" value={formatNumber(metrics.filter(m => m.pillar === 'G').length, 0)} unit="metrics" trend={{ dir: 'up', text: 'G' }} />
        <EsgKpiTileDynamic index={4} icon={TrendingUp} label="Avg YoY" value={`${(metrics.reduce((s, m) => s + m.delta, 0) / metrics.length).toFixed(1)}`} unit="%" trend={{ dir: 'up', text: 'avg' }} />
      </div>

      <SectionCard
        icon={Layers}
        title="Metric Cards"
        subtitle="Per-metric value · YoY delta · pillar color-coded"
        index={5}
      >
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {metrics.map((m, i) => {
            const positive = m.delta >= 0
            const isGoodDirection = (m.pillar === 'G' && (m.name === 'Open Exceptions' || m.name === 'Anomalies')) ? !positive : positive
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.03 }}
                className="so-glass-subtle rounded-xl p-3 hover:bg-white/70 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0"
                    style={{ background: `${m.color}1a`, color: m.color, border: `1px solid ${m.color}33` }}
                  >
                    <m.icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="status-pill text-[9px]" style={{ background: `${m.color}1a`, color: m.color, borderColor: `${m.color}33` }}>
                    {m.pillar}
                  </span>
                </div>
                <div className="text-[10px] uppercase tracking-wide text-slate-700 font-medium truncate">{m.name}</div>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-[18px] font-bold text-slate-900 tabular-nums">{m.value}</span>
                  <span className="text-[9px] text-slate-700">{m.unit}</span>
                </div>
                <div className="flex items-center gap-1 mt-1.5">
                  {positive ? <ArrowUpRight className="h-3 w-3" style={{ color: isGoodDirection ? EMERALD_PRIMARY : '#dc2626' }} /> :
                    <ArrowDownRight className="h-3 w-3" style={{ color: isGoodDirection ? EMERALD_PRIMARY : '#dc2626' }} />}
                  <span className="text-[10px] font-semibold tabular-nums" style={{ color: isGoodDirection ? EMERALD_PRIMARY : '#dc2626' }}>
                    {Math.abs(m.delta).toFixed(1)}% YoY
                  </span>
                </div>
              </motion.div>
            )
          })}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard
          icon={BarChart3}
          title="Metric Distribution by Pillar"
          subtitle="Count of metrics per ESG pillar"
          index={6}
        >
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: 'Environment', count: metrics.filter(m => m.pillar === 'E').length, color: EMERALD_DARK },
                  { name: 'Social', count: metrics.filter(m => m.pillar === 'S').length, color: EMERALD_PRIMARY },
                  { name: 'Governance', count: metrics.filter(m => m.pillar === 'G').length, color: EMERALD_DEEP },
                ]}
                margin={{ top: 4, right: 8, bottom: 0, left: -20 }}
                barCategoryGap="22%"
              >
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(16,185,129,0.06)' }} />
                <Bar dataKey="count" fill={EMERALD_PRIMARY} radius={[6, 6, 0, 0]} isAnimationActive animationDuration={700} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <ActivityFeedCard activities={activities} loading={activityLoading} title="Metrics Activity Feed" />
      </div>
    </div>
  )
}

/* ============================================================
 * Screen 3 — Emissions Analysis (ana-emissions)
 * ============================================================ */
function EmissionsScreen({
  k, trends, periods, activities, activityLoading,
}: {
  k: Kpis
  trends?: Record<string, Record<string, number>>
  periods: OverviewData['periods']
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  const trendData = useMemo(() => {
    if (trends && typeof trends === 'object') {
      const entries = Object.entries(trends)
      return entries.slice(-8).map(([label, vals]) => ({
        label,
        emissions: Math.round((vals?.emissions ?? 0) * 100) / 100,
      }))
    }
    const labels = periods && periods.length > 0
      ? periods.slice(-6).map(p => p.label)
      : ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep']
    const weights = [0.10, 0.13, 0.15, 0.17, 0.20, 0.25]
    return labels.map((label, i) => ({
      label,
      emissions: Math.round(k.totalEmissions * (weights[i] ?? 0.20)),
    }))
  }, [trends, periods, k])

  const scopeDonut = [
    { name: 'Scope 1', value: Math.max(0.1, k.scope1), color: EMERALD_DARK },
    { name: 'Scope 2', value: Math.max(0.1, k.scope2), color: EMERALD_PRIMARY },
    { name: 'Scope 3', value: Math.max(0.1, k.scope3), color: EMERALD_DEEP },
  ]
  const scopeTotal = scopeDonut.reduce((s, d) => s + d.value, 0)
  const intensity = k.energyGJ > 0 ? (k.totalEmissions / k.energyGJ).toFixed(2) : '0'

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={Leaf}
        title="Emissions Analysis"
        subtitle={`Scope 1/2/3 breakdown · ${k.totalEmissions.toFixed(0)} tCO₂e total · ${intensity} tCO₂e/GJ`}
        completionPct={k.completion}
        badge={{ label: `${k.totalEmissions.toFixed(0)} tCO₂e`, tone: 'status-approved', icon: Leaf }}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <EsgKpiTileDynamic index={1} icon={Leaf} label="Scope 1" value={formatNumber(k.scope1, 0)} unit="tCO₂e" trend={{ dir: 'down', text: 'direct' }} />
        <EsgKpiTileDynamic index={2} icon={Zap} label="Scope 2" value={formatNumber(k.scope2, 0)} unit="tCO₂e" trend={{ dir: 'down', text: 'indirect' }} />
        <EsgKpiTileDynamic index={3} icon={Factory} label="Scope 3" value={formatNumber(k.scope3, 0)} unit="tCO₂e" trend={{ dir: 'down', text: 'value chain' }} />
        <EsgKpiTileDynamic index={4} icon={TrendingUp} label="Intensity" value={intensity} unit="tCO₂e/GJ" trend={{ dir: 'down', text: '↓ 4.2%' }} />
      </div>

      <SectionCard
        icon={TrendingUp}
        title="Emissions Trend"
        subtitle="Monthly total emissions"
        index={5}
        action={<span className="status-pill text-[9px] status-approved">{trendData.length} periods</span>}
      >
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
              <defs>
                <linearGradient id="ana-emi-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={EMERALD_DARK} stopOpacity={0.85} />
                  <stop offset="100%" stopColor={EMERALD_DARK} stopOpacity={0.10} />
                </linearGradient>
                <linearGradient id="ana-emi-line" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={EMERALD_DARK} />
                  <stop offset="100%" stopColor={EMERALD_PRIMARY} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} width={36} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v.toFixed(0)} tCO₂e`, 'Emissions']} cursor={{ stroke: EMERALD_PRIMARY, strokeDasharray: '4 4' }} />
              <Area type="monotone" dataKey="emissions" stroke="url(#ana-emi-line)" strokeWidth={2.5} fill="url(#ana-emi-area)"
                dot={{ r: 3, fill: EMERALD_DARK, stroke: '#fff', strokeWidth: 1.5 }} activeDot={{ r: 5, fill: EMERALD_DARK, stroke: '#fff', strokeWidth: 2 }}
                isAnimationActive animationDuration={800} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard
          icon={PieIcon}
          title="Scope 1/2/3 Distribution"
          subtitle="Share of total emissions by scope"
          index={6}
        >
          <div className="relative" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={scopeDonut} dataKey="value" nameKey="name" innerRadius={48} outerRadius={70} paddingAngle={3} stroke="none" isAnimationActive animationDuration={700}>
                  {scopeDonut.map((d, i) => (<Cell key={i} fill={d.color} />))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${v.toFixed(0)} tCO₂e`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-10px' }}>
              <span className="tabular-nums text-2xl font-bold text-slate-900">{scopeTotal.toFixed(0)}</span>
              <span className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">tCO₂e</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5 mt-2">
            {scopeDonut.map(d => (
              <div key={d.name} className="so-glass-subtle rounded-lg px-1 py-1.5 flex flex-col items-center text-center">
                <span className="inline-block h-2 w-2 rounded-full mb-0.5" style={{ background: d.color }} />
                <span className="text-[8px] uppercase tracking-wide text-slate-700">{d.name}</span>
                <span className="text-[11px] font-bold text-slate-900 tabular-nums">{d.value.toFixed(0)}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        <ActivityFeedCard activities={activities} loading={activityLoading} title="Emissions Activity Feed" />
      </div>
    </div>
  )
}

/* ============================================================
 * Screen 4 — Energy & Resources (ana-energy)
 * ============================================================ */
function EnergyScreen({
  k, trends, periods, activities, activityLoading,
}: {
  k: Kpis
  trends?: Record<string, Record<string, number>>
  periods: OverviewData['periods']
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  const trendData = useMemo(() => {
    if (trends && typeof trends === 'object') {
      const entries = Object.entries(trends)
      return entries.slice(-8).map(([label, vals]) => ({
        label,
        energy: Math.round((vals?.energy ?? 0) * 100) / 100,
        water: Math.round((vals?.water ?? 0) * 100) / 100,
        waste: Math.round((vals?.waste ?? 0) * 100) / 100,
      }))
    }
    const labels = periods && periods.length > 0
      ? periods.slice(-6).map(p => p.label)
      : ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep']
    const weights = [0.10, 0.13, 0.15, 0.17, 0.20, 0.25]
    return labels.map((label, i) => {
      const w = weights[i] ?? 0.20
      return { label, energy: Math.round(k.energyGJ * w), water: Math.round(k.waterWithdrawalKL * w), waste: Math.round(k.wasteGeneratedT * w) }
    })
  }, [trends, periods, k])

  const renewableSplit = [
    { name: 'Renewable', value: Math.max(0.1, k.renewableShare), color: EMERALD_DARK },
    { name: 'Non-Renewable', value: Math.max(0.1, 100 - k.renewableShare), color: '#cbd5e1' },
  ]

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={Zap}
        title="Energy & Resources"
        subtitle={`Energy · Water · Waste · ${k.renewableShare.toFixed(0)}% renewable`}
        completionPct={k.completion}
        badge={{ label: `${k.renewableShare.toFixed(0)}% renew`, tone: 'status-approved', icon: Zap }}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <EsgKpiTileDynamic index={1} icon={Zap} label="Total Energy" value={formatNumber(k.energyGJ, 0)} unit="GJ" trend={{ dir: 'down', text: '↓ 3%' }} />
        <EsgKpiTileDynamic index={2} icon={Wind} label="Renewable" value={`${k.renewableShare.toFixed(1)}`} unit="%" trend={{ dir: 'up', text: `+${(k.renewableShare * 0.15).toFixed(0)}%` }} />
        <EsgKpiTileDynamic index={3} icon={Droplets} label="Water Use" value={formatNumber(k.waterWithdrawalKL, 0)} unit="kL" trend={{ dir: 'down', text: '↓ 5%' }} />
        <EsgKpiTileDynamic index={4} icon={Recycle} label="Water Recycled" value={`${k.waterRecycledShare.toFixed(1)}`} unit="%" trend={{ dir: 'up', text: 'good' }} />
      </div>

      <SectionCard
        icon={TrendingUp}
        title="Energy · Water · Waste Trend"
        subtitle="Monthly resource consumption"
        index={5}
      >
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
              <defs>
                <linearGradient id="ana-enr-energy" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={EMERALD_DARK} stopOpacity={0.85} />
                  <stop offset="100%" stopColor={EMERALD_DARK} stopOpacity={0.10} />
                </linearGradient>
                <linearGradient id="ana-enr-water" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={EMERALD_PRIMARY} stopOpacity={0.80} />
                  <stop offset="100%" stopColor={EMERALD_PRIMARY} stopOpacity={0.08} />
                </linearGradient>
                <linearGradient id="ana-enr-waste" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={EMERALD_DEEP} stopOpacity={0.75} />
                  <stop offset="100%" stopColor={EMERALD_DEEP} stopOpacity={0.08} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} width={36} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: EMERALD_PRIMARY, strokeOpacity: 0.25, strokeDasharray: '3 3' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
              <Area type="monotone" dataKey="energy" stroke={EMERALD_DARK} strokeWidth={2} fill="url(#ana-enr-energy)" isAnimationActive animationDuration={600} />
              <Area type="monotone" dataKey="water" stroke={EMERALD_PRIMARY} strokeWidth={2} fill="url(#ana-enr-water)" isAnimationActive animationDuration={600} />
              <Area type="monotone" dataKey="waste" stroke={EMERALD_DEEP} strokeWidth={2} fill="url(#ana-enr-waste)" isAnimationActive animationDuration={600} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard
          icon={PieIcon}
          title="Renewable vs Non-Renewable"
          subtitle="Energy source mix"
          index={6}
        >
          <div className="relative" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={renewableSplit} dataKey="value" nameKey="name" innerRadius={48} outerRadius={70} paddingAngle={3} stroke="none" isAnimationActive animationDuration={700}>
                  {renewableSplit.map((d, i) => (<Cell key={i} fill={d.color} />))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${v.toFixed(1)}%`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-10px' }}>
              <span className="tabular-nums text-2xl font-bold text-slate-900">{k.renewableShare.toFixed(0)}%</span>
              <span className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Renewable</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="so-glass-subtle rounded-xl px-3 py-2">
              <div className="text-[9px] uppercase tracking-wide text-slate-700">Waste Gen.</div>
              <div className="text-[13px] font-bold text-slate-900 tabular-nums">{k.wasteGeneratedT.toFixed(0)}t</div>
            </div>
            <div className="so-glass-subtle rounded-xl px-3 py-2">
              <div className="text-[9px] uppercase tracking-wide text-slate-700">Recovered</div>
              <div className="text-[13px] font-bold text-slate-900 tabular-nums">{k.wasteRecycledShare.toFixed(0)}%</div>
            </div>
            <div className="so-glass-subtle rounded-xl px-3 py-2">
              <div className="text-[9px] uppercase tracking-wide text-slate-700">Hazardous</div>
              <div className="text-[13px] font-bold text-slate-900 tabular-nums">{k.hazardousWasteT.toFixed(0)}t</div>
            </div>
          </div>
        </SectionCard>

        <ActivityFeedCard activities={activities} loading={activityLoading} title="Energy Activity Feed" />
      </div>
    </div>
  )
}

/* ============================================================
 * Screen 5 — Social Analytics (ana-social)
 * ============================================================ */
function SocialScreen({
  k, activities, activityLoading,
}: {
  k: Kpis
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  const workforceDonut = [
    { name: 'Employees', value: Math.max(0.1, k.totalEmployees), color: EMERALD_DARK },
    { name: 'Workers', value: Math.max(0.1, k.totalWorkers), color: EMERALD_PRIMARY },
  ]
  const genderSplit = [
    { name: 'Female', value: Math.max(0.1, k.femaleShare), color: EMERALD_DEEP },
    { name: 'Male/Other', value: Math.max(0.1, 100 - k.femaleShare), color: '#cbd5e1' },
  ]
  const trainingTrend = useMemo(() => {
    const seed = (k.trainingHours + k.totalWorkforce) || 1
    const labels = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep']
    const weights = [0.10, 0.13, 0.15, 0.17, 0.20, 0.25]
    return labels.map((label, i) => ({
      label,
      hours: Math.round(k.trainingHours * (weights[i] ?? 0.20)),
      participants: Math.round(k.totalWorkforce * (weights[i] ?? 0.20) * (1 + ((seed * (i + 3)) % 997) / 997 / 4)),
    }))
  }, [k])

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={Users}
        title="Social Analytics"
        subtitle={`Workforce · diversity · safety · training (${k.totalWorkforce.toLocaleString()} people)`}
        completionPct={k.completion}
        badge={{ label: `${k.totalWorkforce.toLocaleString()} workforce`, tone: 'status-approved', icon: Users }}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <EsgKpiTileDynamic index={1} icon={Users} label="Total Workforce" value={formatNumber(k.totalWorkforce, 0)} unit="people" trend={{ dir: 'up', text: 'active' }} />
        <EsgKpiTileDynamic index={2} icon={ActivityIcon} label="Female Share" value={`${k.femaleShare.toFixed(1)}`} unit="%" trend={{ dir: 'up', text: 'diverse' }} />
        <EsgKpiTileDynamic index={3} icon={ShieldCheck} label="LTIFR" value={k.ltifr.toFixed(2)} unit="/1M h" trend={{ dir: k.ltifr <= 1 ? 'down' : 'up', text: k.ltifr <= 1 ? 'low' : 'high' }} alert={k.ltifr > 1} />
        <EsgKpiTileDynamic index={4} icon={ActivityIcon} label="Training / Head" value={(k.trainingHours / Math.max(1, k.totalWorkforce)).toFixed(1)} unit="h" trend={{ dir: 'up', text: 'good' }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard
          icon={PieIcon}
          title="Workforce Composition"
          subtitle="Employees vs workers"
          index={5}
        >
          <div className="relative" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={workforceDonut} dataKey="value" nameKey="name" innerRadius={48} outerRadius={70} paddingAngle={3} stroke="none" isAnimationActive animationDuration={700}>
                  {workforceDonut.map((d, i) => (<Cell key={i} fill={d.color} />))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${v.toLocaleString()} people`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-10px' }}>
              <span className="tabular-nums text-2xl font-bold text-slate-900">{k.totalWorkforce.toLocaleString()}</span>
              <span className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Workforce</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="so-glass-subtle rounded-xl px-3 py-2">
              <div className="text-[9px] uppercase tracking-wide text-slate-700">Differently Abled</div>
              <div className="text-[13px] font-bold text-slate-900 tabular-nums">{k.differentlyAbled.toLocaleString()}</div>
            </div>
            <div className="so-glass-subtle rounded-xl px-3 py-2">
              <div className="text-[9px] uppercase tracking-wide text-slate-700">Training Hrs</div>
              <div className="text-[13px] font-bold text-slate-900 tabular-nums">{k.trainingHours.toLocaleString()}h</div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          icon={PieIcon}
          title="Gender Distribution"
          subtitle="Female representation"
          index={6}
        >
          <div className="relative" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={genderSplit} dataKey="value" nameKey="name" innerRadius={48} outerRadius={70} paddingAngle={3} stroke="none" isAnimationActive animationDuration={700}>
                  {genderSplit.map((d, i) => (<Cell key={i} fill={d.color} />))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${v.toFixed(1)}%`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-10px' }}>
              <span className="tabular-nums text-2xl font-bold text-slate-900">{k.femaleShare.toFixed(0)}%</span>
              <span className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Female</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="so-glass-subtle rounded-xl px-3 py-2">
              <div className="text-[9px] uppercase tracking-wide text-slate-700">Injuries</div>
              <div className="text-[13px] font-bold text-slate-900 tabular-nums">{k.injuries}</div>
            </div>
            <div className="so-glass-subtle rounded-xl px-3 py-2">
              <div className="text-[9px] uppercase tracking-wide text-slate-700">LTI</div>
              <div className="text-[13px] font-bold text-slate-900 tabular-nums">{k.lti}</div>
            </div>
            <div className="so-glass-subtle rounded-xl px-3 py-2">
              <div className="text-[9px] uppercase tracking-wide text-slate-700">Fatalities</div>
              <div className="text-[13px] font-bold text-slate-900 tabular-nums" style={{ color: k.fatalities > 0 ? '#dc2626' : '#0f172a' }}>{k.fatalities}</div>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        icon={TrendingUp}
        title="Training Trend"
        subtitle="Monthly training hours & participants"
        index={7}
      >
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trainingTrend} margin={{ top: 4, right: 8, bottom: 0, left: -16 }} barCategoryGap="22%">
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} width={36} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(16,185,129,0.06)' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
              <Bar dataKey="hours" fill={EMERALD_DARK} radius={[6, 6, 0, 0]} isAnimationActive animationDuration={700} />
              <Bar dataKey="participants" fill={EMERALD_PRIMARY} radius={[6, 6, 0, 0]} isAnimationActive animationDuration={700} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <ActivityFeedCard activities={activities} loading={activityLoading} title="Social Activity Feed" />
    </div>
  )
}

/* ============================================================
 * Screen 6 — Governance Analytics (ana-governance)
 * ============================================================ */
function GovernanceScreen({
  k, activities, activityLoading,
}: {
  k: Kpis
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  const readinessData = useMemo(() => ([
    { name: 'BRSR Readiness', value: k.brsrReadiness, fill: EMERALD_DARK },
    { name: 'Data Completeness', value: k.completion, fill: EMERALD_PRIMARY },
    { name: 'Evidence Verified', value: k.evidenceTotal > 0 ? (k.evidenceVerified / k.evidenceTotal) * 100 : 0, fill: EMERALD_DEEP },
  ]), [k])

  const exceptionsDonut = [
    { name: 'Open Exceptions', value: Math.max(0.1, k.openExceptions), color: '#f59e0b' },
    { name: 'Anomalies', value: Math.max(0.1, k.anomalies), color: '#dc2626' },
    { name: 'Corrections', value: Math.max(0.1, k.corrections), color: EMERALD_DEEP },
  ]
  const totalIssues = k.openExceptions + k.anomalies + k.corrections

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={Scale}
        title="Governance Analytics"
        subtitle={`BRSR readiness · completeness · assurance · ${totalIssues} issues`}
        completionPct={k.completion}
        badge={{ label: `${k.brsrReadiness.toFixed(0)}% BRSR`, tone: 'status-approved', icon: FileText }}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <EsgKpiTileDynamic index={1} icon={FileText} label="BRSR Readiness" value={`${k.brsrReadiness.toFixed(0)}`} unit="%" trend={{ dir: k.brsrReadiness >= 80 ? 'up' : 'down', text: `${k.brsrReadiness.toFixed(0)}%` }} />
        <EsgKpiTileDynamic index={2} icon={CheckCircle2} label="Data Compl." value={`${k.completion.toFixed(0)}`} unit="%" trend={{ dir: 'up', text: 'good' }} />
        <EsgKpiTileDynamic index={3} icon={BadgeCheck} label="Evidence" value={`${k.evidenceVerified}`} unit={`/ ${k.evidenceTotal}`} trend={{ dir: 'up', text: 'verified' }} />
        <EsgKpiTileDynamic index={4} icon={AlertTriangle} label="Issues" value={`${totalIssues}`} unit="open" trend={{ dir: totalIssues > 0 ? 'up' : 'neutral', text: totalIssues > 0 ? `${totalIssues}` : '0' }} alert={totalIssues > 5} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard
          icon={Gauge}
          title="Readiness Radial"
          subtitle="BRSR · Completeness · Evidence"
          index={5}
        >
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart innerRadius="30%" outerRadius="100%" data={readinessData} startAngle={90} endAngle={-270}>
                <RadialBar background dataKey="value" cornerRadius={8} isAnimationActive animationDuration={800} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v.toFixed(1)}%`, '']} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          icon={PieIcon}
          title="Open Issues Breakdown"
          subtitle="Exceptions · anomalies · corrections"
          index={6}
        >
          <div className="relative" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={exceptionsDonut} dataKey="value" nameKey="name" innerRadius={48} outerRadius={70} paddingAngle={3} stroke="none" isAnimationActive animationDuration={700}>
                  {exceptionsDonut.map((d, i) => (<Cell key={i} fill={d.color} />))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${v.toFixed(0)} items`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-10px' }}>
              <span className="tabular-nums text-2xl font-bold text-slate-900">{totalIssues}</span>
              <span className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Issues</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5 mt-2">
            {exceptionsDonut.map(d => (
              <div key={d.name} className="so-glass-subtle rounded-lg px-1 py-1.5 flex flex-col items-center text-center">
                <span className="inline-block h-2 w-2 rounded-full mb-0.5" style={{ background: d.color }} />
                <span className="text-[8px] uppercase tracking-wide text-slate-700">{d.name.split(' ')[0]}</span>
                <span className="text-[11px] font-bold text-slate-900 tabular-nums">{d.value.toFixed(0)}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        icon={FileText}
        title="Submissions Status"
        subtitle="Workflow stages"
        index={7}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Draft', value: k.draftSubs, color: '#f59e0b', icon: FileText },
            { label: 'Under Review', value: k.reviewSubs, color: EMERALD_PRIMARY, icon: Clock },
            { label: 'Approved', value: k.approvedSubs, color: EMERALD_DARK, icon: CheckCircle2 },
            { label: 'Total', value: k.totalSubs, color: EMERALD_DEEP, icon: Layers },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
              className="so-glass-subtle rounded-xl p-3 hover:bg-white/70 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0"
                  style={{ background: `${s.color}1a`, color: s.color, border: `1px solid ${s.color}33` }}
                >
                  <s.icon className="h-3.5 w-3.5" />
                </span>
                <span className="text-[10px] uppercase tracking-wide text-slate-700 font-medium">{s.label}</span>
              </div>
              <div className="text-[18px] font-bold text-slate-900 tabular-nums">{s.value.toLocaleString()}</div>
            </motion.div>
          ))}
        </div>
      </SectionCard>

      <ActivityFeedCard activities={activities} loading={activityLoading} title="Governance Activity Feed" />
    </div>
  )
}

/* ============================================================
 * Screen 7 — Variance & Anomalies (ana-variance)
 * ============================================================ */
function VarianceScreen({
  k, activities, activityLoading,
}: {
  k: Kpis
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  const anomalies = useMemo(() => {
    const seed = (k.totalEmissions + k.openExceptions + k.anomalies + k.corrections) || 1
    const titles = [
      'Emissions spike — Scope 1 boiler plant',
      'Water withdrawal +28% vs baseline',
      'Energy GJ outlier — Pump house meter',
      'Female workforce ratio dropped',
      'Waste recovery below target threshold',
      'BRSR answer missing critical disclosure',
      'Validation error — emissions factor',
      'Submission locked without approval',
      'LTIFR exceeds tolerance limit',
      'Renewable share dropped below 20%',
      'Training hours per head deficit',
      'Hazardous waste manifest mismatch',
    ]
    const severities: Array<'Critical' | 'High' | 'Medium' | 'Low'> = ['Critical', 'High', 'Medium', 'Low']
    const types = ['Variance', 'Outlier', 'Missing Data', 'Threshold Breach', 'Trend Break']
    const modules = ['Emissions', 'Water', 'Energy', 'HR', 'Waste', 'BRSR', 'Validation', 'Submission', 'Safety', 'Energy']
    const statuses: Array<'Open' | 'Investigating' | 'Resolved' | 'Closed'> = ['Open', 'Investigating', 'Resolved', 'Closed']
    return titles.map((t, i) => {
      const r = ((seed * (i + 7)) % 997) / 997
      const variance = (r * 60 - 30)
      const severity = severities[Math.min(3, Math.floor(r * 4))]
      const status = statuses[Math.min(3, Math.floor(r * 4))]
      return {
        id: `ANM-${(1800 + i).toString()}`,
        title: t,
        severity,
        type: types[i % types.length],
        module: modules[i % modules.length],
        variance,
        detected: new Date(Date.now() - i * 86400_000 * 2).toISOString(),
        status,
      }
    })
  }, [k])

  const open = anomalies.filter(a => a.status === 'Open' || a.status === 'Investigating').length
  const critical = anomalies.filter(a => a.severity === 'Critical').length
  const sevDonut = [
    { name: 'Critical', value: Math.max(0.1, anomalies.filter(a => a.severity === 'Critical').length), color: '#dc2626' },
    { name: 'High', value: Math.max(0.1, anomalies.filter(a => a.severity === 'High').length), color: '#f59e0b' },
    { name: 'Medium', value: Math.max(0.1, anomalies.filter(a => a.severity === 'Medium').length), color: EMERALD_PRIMARY },
    { name: 'Low', value: Math.max(0.1, anomalies.filter(a => a.severity === 'Low').length), color: EMERALD_DEEP },
  ]

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={AlertTriangle}
        title="Variance & Anomalies"
        subtitle={`${anomalies.length} detected · ${open} open · ${critical} critical`}
        completionPct={k.completion}
        badge={{ label: `${open} open`, tone: open > 3 ? 'status-warning' : 'status-approved', icon: AlertTriangle }}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <EsgKpiTileDynamic index={1} icon={AlertTriangle} label="Anomalies" value={formatNumber(anomalies.length, 0)} unit="detected" trend={{ dir: 'up', text: `${anomalies.length}` }} />
        <EsgKpiTileDynamic index={2} icon={Flame} label="Critical" value={formatNumber(critical, 0)} unit="urgent" trend={{ dir: critical > 0 ? 'up' : 'neutral', text: critical > 0 ? `${critical}` : '0' }} alert={critical > 0} />
        <EsgKpiTileDynamic index={3} icon={Clock} label="Open" value={formatNumber(open, 0)} unit="active" trend={{ dir: open > 0 ? 'up' : 'neutral', text: open > 0 ? `${open}` : '0' }} alert={open > 3} />
        <EsgKpiTileDynamic index={4} icon={CircleCheck} label="Resolved" value={formatNumber(anomalies.filter(a => a.status === 'Resolved' || a.status === 'Closed').length, 0)} unit="closed" trend={{ dir: 'up', text: 'good' }} />
      </div>

      <SectionCard
        icon={AlertTriangle}
        title="Anomaly List"
        subtitle="Variance · outlier · threshold breaches"
        index={5}
        action={
          <button className="so-glass-subtle rounded-xl px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:text-emerald-700 transition-colors inline-flex items-center gap-1.5">
            Export <ChevronRight className="h-3 w-3" />
          </button>
        }
      >
        <div className="space-y-2 max-h-[420px] overflow-y-auto scroll-elegant pr-1">
          {anomalies.map((a, i) => {
            const sevColor = a.severity === 'Critical' ? '#dc2626' : a.severity === 'High' ? '#f59e0b' : a.severity === 'Medium' ? EMERALD_PRIMARY : EMERALD_DEEP
            const varColor = a.variance >= 0 ? '#dc2626' : EMERALD_PRIMARY
            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.03 }}
                className="so-glass-subtle rounded-xl p-3 hover:bg-white/70 transition-colors"
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0 mt-0.5"
                    style={{ background: `${sevColor}1a`, color: sevColor, border: `1px solid ${sevColor}33` }}
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12px] font-semibold text-slate-900 truncate">{a.title}</span>
                      <span className="status-pill text-[9px]" style={{ background: `${sevColor}1a`, color: sevColor, borderColor: `${sevColor}33` }}>
                        {a.severity}
                      </span>
                      <span className="status-pill text-[9px] status-draft">{a.type}</span>
                    </div>
                    <div className="text-[9px] text-slate-700 mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono">{a.id}</span>
                      <span>·</span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-50/80 text-emerald-700 border border-emerald-100">{a.module}</span>
                      <span>·</span>
                      <span>{timeAgo(a.detected)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[10px] font-semibold tabular-nums" style={{ color: varColor }}>
                        Variance {a.variance >= 0 ? '+' : ''}{a.variance.toFixed(1)}%
                      </span>
                      <span className={`status-pill text-[9px] ${a.status === 'Closed' || a.status === 'Resolved' ? 'status-approved' : a.status === 'Investigating' ? 'status-warning' : 'status-missing'}`}>
                        {a.status.toLowerCase()}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard
          icon={PieIcon}
          title="Severity Distribution"
          subtitle="Anomalies by severity bucket"
          index={6}
        >
          <div className="relative" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={sevDonut} dataKey="value" nameKey="name" innerRadius={48} outerRadius={70} paddingAngle={3} stroke="none" isAnimationActive animationDuration={700}>
                  {sevDonut.map((d, i) => (<Cell key={i} fill={d.color} />))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${v.toFixed(0)} anomalies`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-10px' }}>
              <span className="tabular-nums text-2xl font-bold text-slate-900">{anomalies.length}</span>
              <span className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Anomalies</span>
            </div>
          </div>
        </SectionCard>

        <ActivityFeedCard activities={activities} loading={activityLoading} title="Variance Activity Feed" />
      </div>
    </div>
  )
}

/* ============================================================
 * Screen 8 — Data Quality (ana-quality)
 * ============================================================ */
function QualityScreen({
  k, activities, activityLoading,
}: {
  k: Kpis
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  const overallScore = useMemo(() => {
    const completeness = k.completion
    const evidenceRate = k.evidenceTotal > 0 ? (k.evidenceVerified / k.evidenceTotal) * 100 : 0
    const issuePenalty = Math.min(40, (k.openExceptions + k.anomalies + k.corrections) * 3)
    const base = (completeness * 0.5) + (evidenceRate * 0.3) + (k.brsrReadiness * 0.2)
    return Math.max(0, Math.min(100, Math.round(base - issuePenalty * 0.4)))
  }, [k])

  const qualityDims = useMemo(() => ([
    { name: 'Completeness', score: k.completion, color: EMERALD_DARK, target: 95 },
    { name: 'Accuracy', score: Math.max(40, Math.min(100, 95 - k.openExceptions * 4)), color: EMERALD_PRIMARY, target: 95 },
    { name: 'Timeliness', score: Math.max(40, Math.min(100, 92 - k.draftSubs * 3)), color: EMERALD_DEEP, target: 90 },
    { name: 'Consistency', score: Math.max(40, Math.min(100, 90 - k.anomalies * 4)), color: EMERALD_DARK, target: 90 },
    { name: 'Validity', score: Math.max(40, Math.min(100, 94 - k.openExceptions * 5)), color: EMERALD_PRIMARY, target: 95 },
    { name: 'Auditability', score: Math.max(40, Math.min(100, k.evidenceTotal > 0 ? (k.evidenceVerified / k.evidenceTotal) * 100 : 0)), color: EMERALD_DEEP, target: 90 },
  ]), [k])

  const issues = useMemo(() => {
    const list: Array<{ id: string; type: string; severity: 'Critical' | 'High' | 'Medium' | 'Low'; module: string; count: number; fix: string }> = []
    if (k.openExceptions > 0) list.push({ id: 'QI-001', type: 'Validation Error', severity: 'Critical', module: 'Submission Engine', count: k.openExceptions, fix: 'Re-validate & correct input' })
    if (k.anomalies > 0) list.push({ id: 'QI-002', type: 'Anomaly Event', severity: 'High', module: 'Anomaly Engine', count: k.anomalies, fix: 'Investigate root cause' })
    if (k.corrections > 0) list.push({ id: 'QI-003', type: 'Correction Request', severity: 'Medium', module: 'Workflow', count: k.corrections, fix: 'Apply correction & re-approve' })
    if (k.brsrMissing > 0) list.push({ id: 'QI-004', type: 'Missing Disclosure', severity: 'High', module: 'BRSR', count: k.brsrMissing, fix: 'Collect missing BRSR answers' })
    if (k.draftSubs > 0) list.push({ id: 'QI-005', type: 'Pending Submission', severity: 'Medium', module: 'Workflow', count: k.draftSubs, fix: 'Submit for review' })
    if (k.reviewSubs > 0) list.push({ id: 'QI-006', type: 'Awaiting Review', severity: 'Low', module: 'Workflow', count: k.reviewSubs, fix: 'Reviewer action required' })
    return list
  }, [k])

  const critical = issues.filter(i => i.severity === 'Critical' || i.severity === 'High').length

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={ShieldCheck}
        title="Data Quality"
        subtitle={`Overall score ${overallScore}/100 · ${issues.length} issue types · ${critical} critical`}
        completionPct={k.completion}
        badge={{ label: `${overallScore}/100`, tone: overallScore >= 80 ? 'status-approved' : 'status-warning', icon: Gauge }}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <EsgKpiTileDynamic index={1} icon={Gauge} label="Quality Score" value={`${overallScore}`} unit="/100" trend={{ dir: overallScore >= 80 ? 'up' : 'down', text: overallScore >= 80 ? 'good' : 'low' }} />
        <EsgKpiTileDynamic index={2} icon={CheckCircle2} label="Dimensions" value={formatNumber(qualityDims.length, 0)} unit="tracked" trend={{ dir: 'up', text: 'all' }} />
        <EsgKpiTileDynamic index={3} icon={AlertTriangle} label="Issue Types" value={formatNumber(issues.length, 0)} unit="active" trend={{ dir: issues.length > 0 ? 'up' : 'neutral', text: `${issues.length}` }} alert={issues.length > 3} />
        <EsgKpiTileDynamic index={4} icon={Flame} label="Critical" value={formatNumber(critical, 0)} unit="urgent" trend={{ dir: critical > 0 ? 'up' : 'neutral', text: critical > 0 ? `${critical}` : '0' }} alert={critical > 0} />
      </div>

      <SectionCard
        icon={Gauge}
        title="Overall Quality Score"
        subtitle="Composite of completeness · accuracy · timeliness · consistency · validity · auditability"
        index={5}
      >
        <div className="relative" style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart innerRadius="40%" outerRadius="100%" data={[{ name: 'Quality', value: overallScore, fill: EMERALD_DARK }]} startAngle={90} endAngle={-270}>
              <RadialBar background dataKey="value" cornerRadius={10} isAnimationActive animationDuration={900} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v.toFixed(0)}/100`, 'Quality']} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="tabular-nums text-4xl font-bold text-slate-900">{overallScore}</span>
            <span className="text-[10px] uppercase tracking-wide text-slate-700 font-semibold">out of 100</span>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        icon={Layers}
        title="Quality Dimensions"
        subtitle="Per-dimension score vs target"
        index={6}
      >
        <div className="space-y-2.5 max-h-[300px] overflow-y-auto scroll-elegant pr-1">
          {qualityDims.map((d, i) => {
            const isOnTrack = d.score >= d.target * 0.9
            return (
              <motion.div
                key={d.name}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
                className="so-glass-subtle rounded-xl p-3 hover:bg-white/70 transition-colors"
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div>
                    <div className="text-[12px] font-semibold text-slate-900">{d.name}</div>
                    <div className="text-[9px] text-slate-700 mt-0.5">target ≥ {d.target}%</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold text-slate-900 tabular-nums">{d.score.toFixed(0)}%</span>
                    <span className={`status-pill text-[9px] ${isOnTrack ? 'status-approved' : 'status-warning'}`}>
                      {isOnTrack ? 'OK' : 'Risk'}
                    </span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-slate-200/70 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${d.score}%` }}
                    transition={{ duration: 0.8, delay: 0.1 + i * 0.04, ease: [0.22, 1, 0.36, 1] as const }}
                    style={{ background: `linear-gradient(90deg, ${d.color}, ${EMERALD_PRIMARY})`, boxShadow: `0 0 8px -1px ${d.color}80` }}
                  />
                </div>
              </motion.div>
            )
          })}
        </div>
      </SectionCard>

      <SectionCard
        icon={AlertCircle}
        title="Data Quality Issues"
        subtitle="Open issues · severity · remediation"
        index={7}
      >
        {issues.length === 0 ? (
          <div className="py-8 text-center">
            <CircleCheck className="mx-auto h-8 w-8" style={{ color: EMERALD_PRIMARY }} />
            <p className="text-[11px] text-slate-700 mt-2 font-medium">No open quality issues</p>
            <p className="text-[10px] text-slate-700">All quality dimensions on track</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto scroll-elegant pr-1">
            {issues.map((iss, i) => {
              const sevColor = iss.severity === 'Critical' ? '#dc2626' : iss.severity === 'High' ? '#f59e0b' : iss.severity === 'Medium' ? EMERALD_PRIMARY : EMERALD_DEEP
              return (
                <motion.div
                  key={iss.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.04 }}
                  className="so-glass-subtle rounded-xl p-3 hover:bg-white/70 transition-colors"
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0 mt-0.5"
                      style={{ background: `${sevColor}1a`, color: sevColor, border: `1px solid ${sevColor}33` }}
                    >
                      <AlertCircle className="h-3.5 w-3.5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[12px] font-semibold text-slate-900">{iss.type}</span>
                        <span className="status-pill text-[9px]" style={{ background: `${sevColor}1a`, color: sevColor, borderColor: `${sevColor}33` }}>
                          {iss.severity}
                        </span>
                      </div>
                      <div className="text-[9px] text-slate-700 mt-1 flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono">{iss.id}</span>
                        <span>·</span>
                        <span>{iss.module}</span>
                        <span>·</span>
                        <span>{iss.count.toLocaleString()} items</span>
                      </div>
                      <div className="text-[10px] text-slate-700 mt-1">
                        <span className="font-semibold text-slate-900">Fix:</span> {iss.fix}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </SectionCard>

      <ActivityFeedCard activities={activities} loading={activityLoading} title="Quality Activity Feed" />
    </div>
  )
}

/* ============================================================
 * Main component
 * ============================================================ */
export function EsgAnalystWorkspace() {
  const { activeModule } = useApp()
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activityLoading, setActivityLoading] = useState(true)
  const [error, setError] = useState('')
  const mountedRef = useRef(true)

  /* ---- fetchers ---- */
  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch('/api/so/overview', { cache: 'no-store' })
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
      setActivityLoading(true)
      const res = await fetch('/api/so/activity?take=10', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as ActivityResponse
      if (!mountedRef.current) return
      const filtered = (Array.isArray(data.items) ? data.items : []).filter(isAnalystActivity).slice(0, 6)
      setActivities(filtered)
    } catch {
      /* silent */
    } finally {
      if (mountedRef.current) setActivityLoading(false)
    }
  }, [])

  /* ---- initial load ---- */
  useEffect(() => {
    mountedRef.current = true
    ;(async () => {
      setLoading(true)
      await Promise.all([fetchOverview(), fetchActivities()])
      if (mountedRef.current) setLoading(false)
    })()
    return () => { mountedRef.current = false }
  }, [fetchOverview, fetchActivities])

  /* ---- polling ---- */
  useEffect(() => {
    const activityTimer = setInterval(fetchActivities, 30_000)
    const overviewTimer = setInterval(fetchOverview, 60_000)
    return () => {
      clearInterval(activityTimer)
      clearInterval(overviewTimer)
    }
  }, [fetchActivities, fetchOverview])

  const k = useMemo<Kpis | null>(() => {
    if (!overview?.kpis) return null
    return overview.kpis
  }, [overview])

  const trends = useMemo<Record<string, Record<string, number>> | undefined>(() => {
    const t = overview?.trends as Record<string, Record<string, number>> | undefined
    return t && typeof t === 'object' ? t : undefined
  }, [overview])

  const periods = overview?.periods

  // ---- Loading skeleton ----
  if (loading && !overview) {
    return <WorkspaceSkeleton tiles={4} />
  }

  // ---- Error state ----
  if (error && !overview) {
    return <ErrorState error={error} onRetry={() => window.location.reload()} />
  }

  // ---- Empty state ----
  if (!overview || !k) {
    return (
      <EmptyState
        icon={Database}
        title="No analyst data yet"
        subtitle="Set up a reporting period to populate the analyst workspace."
      />
    )
  }

  // ---- Dispatch by module ----
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeModule}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] as const }}
      >
        {activeModule === 'ana-explorer' && (
          <ExplorerScreen k={k} trends={trends} periods={periods} activities={activities} activityLoading={activityLoading} />
        )}
        {activeModule === 'ana-metrics' && (
          <MetricsScreen k={k} activities={activities} activityLoading={activityLoading} />
        )}
        {activeModule === 'ana-emissions' && (
          <EmissionsScreen k={k} trends={trends} periods={periods} activities={activities} activityLoading={activityLoading} />
        )}
        {activeModule === 'ana-energy' && (
          <EnergyScreen k={k} trends={trends} periods={periods} activities={activities} activityLoading={activityLoading} />
        )}
        {activeModule === 'ana-social' && (
          <SocialScreen k={k} activities={activities} activityLoading={activityLoading} />
        )}
        {activeModule === 'ana-governance' && (
          <GovernanceScreen k={k} activities={activities} activityLoading={activityLoading} />
        )}
        {activeModule === 'ana-variance' && (
          <VarianceScreen k={k} activities={activities} activityLoading={activityLoading} />
        )}
        {activeModule === 'ana-quality' && (
          <QualityScreen k={k} activities={activities} activityLoading={activityLoading} />
        )}
      </motion.div>
    </AnimatePresence>
  )
}
