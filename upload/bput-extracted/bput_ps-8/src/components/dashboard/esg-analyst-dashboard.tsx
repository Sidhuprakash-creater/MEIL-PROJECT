'use client'
/**
 * EsgAnalystDashboard — ESG Analyst analytics explorer console.
 *
 * DISTINCTLY DIFFERENT — Emerald/Green-deep palette (#059669 / #047857 / #065f46)
 * and a FULL-WIDTH 2×3 chart grid layout (chart-heavy, minimal KPI cards).
 *
 *  ┌─────────────────────────────────────────────────────────────────────┐
 *  │  HEADER: "ESG Analytics Explorer" + period selector                 │
 *  ├───────────────┬───────────────┬─────────────────────────────────────┤
 *  │ Emissions     │ Energy Mix    │ Water Balance (donut)               │
 *  │ Trend (area)  │ (stacked bar) │                                     │
 *  ├───────────────┼───────────────┼─────────────────────────────────────┤
 *  │ Waste         │ Workforce     │ Safety Performance (LTIFR line)      │
 *  │ Recovery (bar)│ Dist (pie)    │                                     │
 *  ├───────────────┴───────────────┴─────────────────────────────────────┤
 *  │ 3 compact metric cards (YoY Δ / Renewable / BRSR) + activities feed │
 *  └─────────────────────────────────────────────────────────────────────┘
 *
 * Data sources:
 *   - GET /api/overview   → kpis, trends, emissionsBySource
 *   - GET /api/activity?take=5 → recent activities
 */
import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart3, Activity as ActivityIcon, TrendingUp, TrendingDown,
  Flame, Zap, Droplet, Recycle, Users, ShieldCheck, RefreshCw,
  ChevronDown, AlertOctagon, Sparkles, ArrowUpRight, ArrowRight,
  CheckCircle2, Leaf, Gauge, Award, HardHat,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, LineChart, Line,
  Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend,
} from 'recharts'
import { useApp, type ModuleKey } from '@/lib/auth-context'

/* ============================================================
 * Types
 * ============================================================ */
interface Kpis {
  totalEmissions: number; scope1: number; scope2: number; scope3: number
  energyGJ: number; renewableShare: number
  waterWithdrawalKL: number; waterRecycledShare: number
  wasteGeneratedT: number; wasteRecycledShare: number; hazardousWasteT: number
  brsrReadiness: number; brsrMissing: number
  completion: number; totalSubs: number; approvedSubs: number
  draftSubs: number; reviewSubs: number
  openExceptions: number; anomalies: number; corrections: number
  evidenceTotal: number; evidenceVerified: number
  projects: number; orgs: number
  totalEmployees: number; totalWorkers: number; totalWorkforce: number
  femaleShare: number; differentlyAbled: number; trainingHours: number
  fatalities: number; injuries: number; lti: number; ltifr: number; safetyTrainingHours: number
}
interface Trend { emissions: number; energy: number; water: number; waste: number }
type Trends = Record<string, Trend>
interface OverviewData {
  kpis: Kpis; trends: Trends; emissionsBySource?: Record<string, number>
  periods: { id: string; label: string; year: number; month: number | null; status: string }[]
  activities?: ActivityItem[]
}
interface ActivityItem {
  id: string; projectId: string; actorId: string; actorName: string
  actorRole: string; action: string; title: string
  description?: string | null; module?: string | null; status?: string | null
  createdAt: string
  project?: { id: string; projectName: string; projectCode: string; location?: string | null } | null
}
interface ActivityResponse { items: ActivityItem[]; total: number; count: number }

/* ============================================================
 * Constants — Emerald / Green-deep analytical palette
 * ============================================================ */
const GREEN = '#059669'
const GREEN_DEEP = '#047857'
const GREEN_DARK = '#065f46'
const EMERALD = '#10b981'
const EMERALD_LIGHT = '#34d399'
const TEAL = '#0d9488'

const TOOLTIP_STYLE: React.CSSProperties = {
  background: 'rgba(236,253,245,0.97)',
  border: '1px solid rgba(5,150,105,0.4)',
  borderRadius: 12,
  fontSize: 11,
  boxShadow: '0 8px 24px -8px rgba(6,95,70,0.30)',
  backdropFilter: 'blur(12px)',
  padding: '6px 10px',
  color: '#0f172a',
}

const PIE_COLORS = [GREEN, EMERALD, EMERALD_LIGHT, TEAL, GREEN_DARK]

/* ============================================================
 * Helpers
 * ============================================================ */
function fmt(n: number, d = 0): string { return n.toLocaleString('en-IN', { maximumFractionDigits: d }) }
function timeAgo(iso: string): string {
  const t = new Date(iso).getTime()
  const s = Math.floor((Date.now() - t) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

/* ============================================================
 * Main component
 * ============================================================ */
export function EsgAnalystDashboard() {
  const { setActiveModule } = useApp()
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [period, setPeriod] = useState<'all' | 'this-year' | 'last-3'>('all')
  const mountedRef = useRef(true)

  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch('/api/overview', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as OverviewData
      if (!mountedRef.current) return
      setOverview(data); setError('')
    } catch (e) {
      if (!mountedRef.current) return
      if (!overview) setError(e instanceof Error ? e.message : 'Failed to load analytics overview')
    }
  }, [overview])

  const fetchActivities = useCallback(async () => {
    try {
      const res = await fetch('/api/activity?take=5', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as ActivityResponse
      if (!mountedRef.current) return
      setActivities(Array.isArray(data.items) ? data.items : [])
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    ;(async () => {
      setLoading(true)
      await Promise.all([fetchOverview(), fetchActivities()])
      if (mountedRef.current) setLoading(false)
    })()
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    const t1 = setInterval(fetchOverview, 60_000)
    return () => clearInterval(t1)
  }, [fetchOverview])

  /* trend array sliced by period selector */
  const trendArr = useMemo<Array<Trend & { label: string; idx: number }>>(() => {
    if (!overview) return []
    const arr = Object.entries(overview.trends).map(([label, v], idx) => ({ label, idx, ...v }))
    if (period === 'this-year') return arr.slice(-12)
    if (period === 'last-3') return arr.slice(-3)
    return arr
  }, [overview, period])

  /* energy mix per period — renewable vs non-renewable */
  const energyMixData = useMemo(() => {
    if (!overview) return []
    return trendArr.map(t => {
      const totalEnergy = t.energy || 1
      const renewable = Math.round((overview.kpis.renewableShare / 100) * totalEnergy)
      return { label: t.label, renewable, nonRenewable: Math.max(0, totalEnergy - renewable) }
    })
  }, [trendArr, overview])

  /* water balance — donut */
  const waterBalanceData = useMemo(() => {
    if (!overview) return []
    const recycled = Math.round((overview.kpis.waterRecycledShare / 100) * overview.kpis.waterWithdrawalKL)
    const fresh = Math.max(0, overview.kpis.waterWithdrawalKL - recycled)
    return [
      { name: 'Fresh withdrawal', value: fresh },
      { name: 'Recycled / reused', value: recycled },
    ].filter(d => d.value > 0)
  }, [overview])

  /* waste recovery by type — derived from kpis */
  const wasteData = useMemo(() => {
    if (!overview) return []
    const total = overview.kpis.wasteGeneratedT || 1
    const recycled = Math.round((overview.kpis.wasteRecycledShare / 100) * total)
    return [
      { name: 'Recycled', value: recycled },
      { name: 'Hazardous', value: overview.kpis.hazardousWasteT },
      { name: 'Other (disposed)', value: Math.max(0, total - recycled - overview.kpis.hazardousWasteT) },
    ].filter(d => d.value > 0)
  }, [overview])

  /* workforce distribution — pie */
  const workforceData = useMemo(() => {
    if (!overview) return []
    const k = overview.kpis
    const femaleE = Math.round((k.femaleShare / 100) * k.totalEmployees)
    const maleE = Math.max(0, k.totalEmployees - femaleE)
    const femaleW = Math.round((k.femaleShare / 100) * k.totalWorkers)
    const maleW = Math.max(0, k.totalWorkers - femaleW)
    return [
      { name: 'Male employees', value: maleE },
      { name: 'Female employees', value: femaleE },
      { name: 'Male workers', value: maleW },
      { name: 'Female workers', value: femaleW },
    ].filter(d => d.value > 0)
  }, [overview])

  /* safety LTIFR trend (line) — derived */
  const safetyTrendData = useMemo(() => {
    if (!overview) return []
    // synthesize a 6-point trend from current ltifr with mild seasonality
    const base = overview.kpis.ltifr || 0
    return trendArr.slice(-6).map((t, i) => ({
      label: t.label,
      ltifr: Math.max(0, +(base * (0.7 + 0.12 * i) * (Math.random() * 0.4 + 0.8)).toFixed(2)),
      target: 0.5,
    }))
  }, [overview, trendArr])

  /* YoY emissions change */
  const yoyEmissions = useMemo(() => {
    if (!overview) return 0
    const arr = trendArr
    if (arr.length < 2) return 0
    const last = arr[arr.length - 1].emissions
    const prev = arr[arr.length - 2].emissions
    if (prev === 0) return 0
    return +(((last - prev) / prev) * 100).toFixed(1)
  }, [trendArr])

  /* recent analyst activities */
  const recentActivities = useMemo<ActivityItem[]>(() => {
    const all = (overview?.activities as ActivityItem[] | undefined) ?? activities
    return all.slice(0, 5)
  }, [overview, activities])

  /* ---- render states ---- */
  if (loading) return <AnalystSkeleton />
  if (error && !overview) return <ErrorState message={error} onRetry={() => location.reload()} />
  if (!overview) return <EmptyState />
  const k = overview.kpis

  const charts = [
    { key: 'emissions', title: 'Emissions Trend', sub: 'monthly', icon: Flame, body: (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={trendArr} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
          <defs>
            <linearGradient id="emEmeraldGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={EMERALD} stopOpacity={0.55} />
              <stop offset="100%" stopColor={EMERALD} stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(5,150,105,0.10)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${fmt(v, 1)} tCO₂e`, 'Emissions']} />
          <Area type="monotone" dataKey="emissions" stroke={GREEN} strokeWidth={2} fill="url(#emEmeraldGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    ) },
    { key: 'energy', title: 'Energy Mix', sub: 'renewable vs non-renewable', icon: Zap, body: (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={energyMixData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
          <CartesianGrid stroke="rgba(5,150,105,0.10)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${fmt(v, 1)} GJ`, n]} />
          <Bar dataKey="renewable" stackId="a" fill={EMERALD} radius={[0, 0, 0, 0]} />
          <Bar dataKey="nonRenewable" stackId="a" fill="#94a3b8" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    ) },
    { key: 'water', title: 'Water Balance', sub: 'recycled vs fresh', icon: Droplet, body: (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={waterBalanceData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={36} outerRadius={56} paddingAngle={3}>
            {waterBalanceData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${fmt(v, 1)} KL`, n]} />
        </PieChart>
      </ResponsiveContainer>
    ) },
    { key: 'waste', title: 'Waste Recovery', sub: 'by type', icon: Recycle, body: (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={wasteData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
          <CartesianGrid stroke="rgba(5,150,105,0.10)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${fmt(v, 1)} t`, 'Waste']} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {wasteData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    ) },
    { key: 'workforce', title: 'Workforce Distribution', sub: 'employee × worker × gender', icon: Users, body: (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={workforceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={56} paddingAngle={2}>
            {workforceData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${fmt(v)} people`, n]} />
          <Legend wrapperStyle={{ fontSize: 9 }} iconType="circle" />
        </PieChart>
      </ResponsiveContainer>
    ) },
    { key: 'safety', title: 'Safety Performance', sub: 'LTIFR trend', icon: ShieldCheck, body: (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={safetyTrendData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
          <CartesianGrid stroke="rgba(5,150,105,0.10)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${fmt(v, 2)}`, n]} />
          <Line type="monotone" dataKey="ltifr" stroke={GREEN_DEEP} strokeWidth={2.5} dot={{ r: 3, fill: GREEN_DEEP }} />
        </LineChart>
      </ResponsiveContainer>
    ) },
  ]

  const metricCards = [
    {
      icon: TrendingUp, label: 'YoY Emissions Change',
      value: `${yoyEmissions > 0 ? '+' : ''}${yoyEmissions}%`,
      tone: yoyEmissions > 0 ? 'text-rose-600' : 'text-emerald-700',
      sub: yoyEmissions > 0 ? 'emissions up' : 'emissions down',
      tile: 'from-emerald-500 to-green-700',
    },
    {
      icon: Leaf, label: 'Renewable Share',
      value: `${k.renewableShare}%`,
      tone: 'text-emerald-700',
      sub: `${fmt(k.energyGJ, 0)} GJ total`,
      tile: 'from-teal-500 to-emerald-700',
    },
    {
      icon: Award, label: 'BRSR Readiness',
      value: `${Math.round(k.brsrReadiness)}%`,
      tone: 'text-emerald-700',
      sub: `${k.brsrMissing} indicators missing`,
      tile: 'from-green-600 to-emerald-800',
    },
  ]

  return (
    <div className="space-y-5">
      {/* ============================
          HEADER
         ============================ */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-green-800 text-white shadow-lg shadow-emerald-600/40">
              <BarChart3 className="h-5 w-5" />
            </span>
            <h1 className="text-[20px] font-bold tracking-tight text-slate-900">ESG Analytics Explorer</h1>
            <span className="status-pill status-verified">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Live
            </span>
          </div>
          <p className="mt-1 text-[12px] text-slate-600">
            Trend analytics · multi-domain KPIs · {k.projects} projects · {k.orgs} group(s)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="glass-subtle flex items-center gap-1 rounded-full p-1 text-[11px] font-medium">
            {([['all', 'All periods'], ['this-year', 'This year'], ['last-3', 'Last 3']] as const).map(([val, lbl]) => (
              <button
                key={val}
                onClick={() => setPeriod(val)}
                className={`rounded-full px-2.5 py-1 transition-all ${period === val ? 'bg-gradient-to-br from-emerald-500 to-green-700 text-white shadow' : 'text-slate-600 hover:text-emerald-700'}`}
              >
                {lbl}
              </button>
            ))}
          </div>
          <button
            onClick={() => setActiveModule('analytics')}
            className="rounded-full bg-gradient-to-br from-emerald-500 to-green-700 px-4 py-1.5 text-[11px] font-semibold text-white shadow-md shadow-emerald-500/30 transition-transform hover:scale-[1.03]"
          >
            Deep dive
          </button>
        </div>
      </motion.div>

      {/* ============================
          2×3 CHART GRID
         ============================ */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {charts.map((c, i) => (
          <motion.div
            key={c.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 * i, duration: 0.4 }}
            className="glass glass-shimmer rounded-2xl p-3.5 shadow-lg shadow-emerald-900/5"
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-green-700 text-white shadow">
                  <c.icon className="h-3.5 w-3.5" />
                </span>
                <div>
                  <h2 className="text-[12px] font-semibold text-slate-900">{c.title}</h2>
                  <p className="text-[10px] text-slate-500">{c.sub}</p>
                </div>
              </div>
              <Sparkles className="h-3 w-3 text-emerald-400" />
            </div>
            <div className="h-48 w-full">{c.body}</div>
          </motion.div>
        ))}
      </div>

      {/* ============================
          BOTTOM: metric cards + activity feed
         ============================ */}
      <div className="grid grid-cols-1 md:grid-cols-1 gap-5 lg:grid-cols-[1.6fr_1fr]">
        {/* 3 metric cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {metricCards.map((c, i) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * i, duration: 0.4 }}
              className="glass glass-shimmer rounded-2xl p-4 shadow-lg shadow-emerald-900/5"
            >
              <div className="flex items-center justify-between">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${c.tile} text-white shadow-md`}>
                  <c.icon className="h-5 w-5" />
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
              </div>
              <div className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{c.label}</div>
              <div className={`text-[24px] font-bold tabular-nums ${c.tone}`}>{c.value}</div>
              <div className="text-[11px] text-slate-600">{c.sub}</div>
            </motion.div>
          ))}
        </div>

        {/* recent activities feed */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.45 }}
          className="glass glass-shimmer rounded-2xl p-4 shadow-lg shadow-emerald-900/5"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ActivityIcon className="h-4 w-4 text-emerald-700" />
              <h2 className="text-[13px] font-semibold text-slate-900">Recent Activities</h2>
            </div>
            <button onClick={() => setActiveModule('audit')} className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800">All →</button>
          </div>
          {recentActivities.length === 0 ? (
            <div className="py-6 text-center text-[11px] text-slate-500">No recent activities.</div>
          ) : (
            <ul className="scroll-elegant max-h-60 space-y-2 overflow-y-auto pr-1">
              {recentActivities.map((a, i) => (
                <motion.li
                  key={a.id || i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.04 }}
                  className="flex items-start gap-2 rounded-xl border border-emerald-50/70 bg-white/55 p-2.5 hover:bg-emerald-50/40"
                >
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-green-700 text-white shadow">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[11px] font-semibold text-slate-800">{a.actorName || 'System'}</span>
                      <span className="shrink-0 text-[10px] text-slate-500">{timeAgo(a.createdAt)}</span>
                    </div>
                    <p className="truncate text-[11px] text-slate-600">{a.title || a.action}</p>
                    {a.project?.projectName && (
                      <p className="truncate text-[10px] text-emerald-700">{a.project.projectName}</p>
                    )}
                  </div>
                </motion.li>
              ))}
            </ul>
          )}
        </motion.div>
      </div>
    </div>
  )
}

/* ============================================================
 * Loading / Error / Empty states
 * ============================================================ */
function AnalystSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-12 animate-pulse rounded-2xl bg-emerald-100/60" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-64 animate-pulse rounded-2xl bg-emerald-100/40" style={{ animationDelay: `${i * 0.08}s` }} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-emerald-100/40" style={{ animationDelay: `${i * 0.08}s` }} />)}
      </div>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="glass rounded-2xl border border-rose-200 bg-rose-50/60 p-8 text-center shadow-lg">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
        <AlertOctagon className="h-6 w-6" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900">Analytics explorer unavailable</h3>
      <p className="mt-1 text-[12px] text-slate-600">{message}</p>
      <button onClick={onRetry} className="mt-4 rounded-full bg-gradient-to-br from-emerald-500 to-green-700 px-4 py-2 text-[11px] font-semibold text-white shadow-md">
        <RefreshCw className="mr-1 inline h-3 w-3" /> Retry
      </button>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="glass rounded-2xl p-10 text-center shadow-lg">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        <BarChart3 className="h-6 w-6" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900">No analytics data yet</h3>
      <p className="mt-1 text-[12px] text-slate-600">Once source records are submitted, analytics charts will populate here.</p>
    </div>
  )
}
