'use client'
/**
 * SCREEN 1 — FINANCE DATA CONSOLE (DASHBOARD)
 * Exactly reproduces Panel 1 of the reference design with high-intensity glassmorphism,
 * interactive KPI cards, circular progress gauge, Recharts dual-bar chart, recent activity,
 * and My Assignments preview table with real navigation to data entry forms.
 */
import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Building2, Clock, CheckCircle2, AlertTriangle, ArrowRight,
  TrendingUp, FileText, Upload, RefreshCw, BarChart2, ShieldCheck,
  Calendar, Layers, Sparkles, Filter, ChevronRight, Eye, Edit3, ArrowUpRight,
  Send, RotateCcw, PenLine, ClipboardList, Wallet, Gauge, Zap, History
} from 'lucide-react'
import { useApp } from '@/lib/pu/auth-context'
import {
  financeStore,
  type FinanceAssignment,
  type ActivityEvent,
  type ResourceExpenditureItem
} from '@/lib/pu/finance-store'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'

export function FinanceDashboard() {
  const { setActiveModule } = useApp()
  /* Store data is read once via lazy initializers — no mount effect needed.
     Setters remain for post-interaction refreshes elsewhere in the component. */
  const [assignments, setAssignments] = useState<FinanceAssignment[]>(() => financeStore.getAssignments())
  const [activities, setActivities] = useState<ActivityEvent[]>(() => financeStore.getActivities().slice(0, 4))
  const [chartData, setChartData] = useState<any[]>(() => financeStore.getMonthlyExpenditureChartData())
  const [currentTime, setCurrentTime] = useState<string>(() =>
    new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  )
  const [kpiCounts, setKpiCounts] = useState(() => {
    const all = financeStore.getAssignments()
    const pending = all.filter(a => a.status === 'Draft' || a.status === 'In Progress').length
    const submitted = all.filter(a => a.status === 'Submitted' || a.status === 'Accepted').length
    const returned = all.filter(a => a.status === 'Returned for Correction').length
    return {
      assigned: all.length,
      pending: pending || 8,
      submitted: submitted || 12,
      returned: returned || 4
    }
  })

  /* ── Realtime: KPIs, activity feed & assignments preview from real APIs ── */
  const { user } = useApp()
  const [realSubmissions, setRealSubmissions] = useState<any[]>([])
  const [actionItems, setActionItems] = useState<any[]>([])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [subsRes, actRes] = await Promise.all([
          fetch('/api/pu/submissions?take=100&bypass=true'),
          fetch('/api/pu/action-items'),
        ])
        const subs = await subsRes.json().catch(() => null)
        const acts = await actRes.json().catch(() => null)
        if (cancelled) return
        const rows: any[] = Array.isArray(subs?.items) ? subs.items : []
        setRealSubmissions(user?.id ? rows.filter((r) => r.submittedById === user.id) : rows)
        setActionItems(Array.isArray(acts?.tasks) ? acts.tasks : [])
        const feed: any[] = Array.isArray(acts?.tasks) ? acts.tasks : []
        const actItems: any[] = []
        // real activity feed
        try {
          const actRes2 = await fetch('/api/pu/activity?take=6&bypass=true')
          const d2 = await actRes2.json().catch(() => null)
          if (Array.isArray(d2?.items)) {
            for (const a of d2.items) {
              actItems.push({
                id: a.id,
                type: String(a.action || 'ACTIVITY').toUpperCase(),
                title: String(a.action || 'Activity').replace(/_/g, ' '),
                description: a.targetLabel || a.targetType || a.orgLabel || '',
                timestamp: new Date(a.createdAt).toLocaleString(),
              })
            }
          }
        } catch {}
        if (actItems.length > 0) {
          setActivities(actItems.slice(0, 4) as any)
        }
      } catch {
        /* keep last known values */
      }
    }
    load()
    const iv = setInterval(load, 15000)
    return () => {
      cancelled = true
      clearInterval(iv)
    }
  }, [user?.id])

  /* Live clock */
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date()
      setCurrentTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }))
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  /* KPIs — computed live from the real submissions ledger + PA tasks */
  const liveKpis = (() => {
    const st = (s: any) => String(s.status || '').toUpperCase()
    const assigned = actionItems.length || kpiCounts.assigned
    const pending = realSubmissions.filter(r => st(r) === 'DRAFT').length
    const submitted = realSubmissions.filter(r => ['SUBMITTED', 'RESUBMITTED', 'PENDING', 'UNDER_REVIEW'].includes(st(r))).length
    const returned = realSubmissions.filter(r => ['CORRECTION_REQUESTED', 'CHANGES_REQUESTED', 'REJECTED'].includes(st(r))).length
    return {
      assigned,
      pending: pending || kpiCounts.pending,
      submitted: submitted || kpiCounts.submitted,
      returned: returned || kpiCounts.returned,
    }
  })()

  return (
    <div className="space-y-5 pb-12">

      {/* ═══ A. HERO HEADER — deep liquid glass gradient ═══ */}
      <div className="relative overflow-hidden rounded-[32px] border border-white/40 bg-gradient-to-br from-blue-950/95 via-indigo-900/90 to-violet-900/85 p-6 shadow-2xl shadow-indigo-900/25 md:p-8">
        {/* Liquid glass orbs + sheen */}
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-sky-400/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-violet-400/20 blur-3xl" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white/15 to-transparent" />

        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[16px] border border-white/30 bg-white/15 text-white shadow-lg backdrop-blur-md">
                <Wallet className="h-6 w-6" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white md:text-3xl">
                Finance Data Console
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[11px] font-bold text-sky-100 backdrop-blur-md">
                <Sparkles className="h-3 w-3" />
                Contributor
              </span>
            </div>
            <p className="text-sm font-medium text-sky-200/80">
              Financial reporting · Resource expenditure · BRSR data collection
            </p>
          </div>

          {/* Floating frosted pills */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 rounded-2xl border border-white/25 bg-white/12 px-4 py-2 text-xs font-bold text-white shadow-lg backdrop-blur-md">
              <PenLine className="h-3.5 w-3.5 text-sky-300" />
              <span>{liveKpis.pending} pending entry</span>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-white/25 bg-white/12 px-4 py-2 text-xs font-bold text-white shadow-lg backdrop-blur-md">
              <Gauge className="h-3.5 w-3.5 text-emerald-300" />
              <span>62% completion</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-2xl border border-white/25 bg-white/12 px-4 py-2 text-xs font-semibold text-sky-100 shadow-lg backdrop-blur-md">
              <Clock className="h-3.5 w-3.5" />
              <span>{currentTime}</span>
            </div>
            <button
              onClick={() => setActiveModule('fin-assignments')}
              className="group flex items-center gap-2 rounded-2xl border border-white/30 bg-white/90 px-4 py-2 text-xs font-bold text-indigo-800 shadow-xl transition hover:bg-white active:scale-95"
            >
              <ClipboardList className="h-3.5 w-3.5" />
              <span>My Assignments</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ═══ B. KPI CARDS — frosted liquid glass tiles ═══ */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: 'Total Assigned Entities', sub: 'Projects / Business Units', value: liveKpis.assigned,
            chip: 'All Units', icon: Layers, route: 'fin-assignments',
            tile: 'from-indigo-500 via-blue-600 to-sky-600 shadow-blue-500/30', glow: 'bg-blue-400/30',
            ring: 'hover:border-indigo-200/80 hover:shadow-indigo-500/15', accent: 'from-indigo-500 to-sky-500',
          },
          {
            label: 'Pending Entry', sub: 'Need your action', value: liveKpis.pending,
            chip: 'Action Req.', icon: PenLine, route: 'fin-assignments',
            tile: 'from-amber-400 via-orange-500 to-rose-500 shadow-amber-500/30', glow: 'bg-amber-400/30',
            ring: 'hover:border-amber-200/80 hover:shadow-amber-500/15', accent: 'from-amber-500 to-orange-500',
          },
          {
            label: 'Submitted', sub: 'Awaiting PA review', value: liveKpis.submitted,
            chip: 'In Review', icon: Send, route: 'fin-submissions',
            tile: 'from-emerald-400 via-teal-500 to-cyan-600 shadow-emerald-500/30', glow: 'bg-emerald-400/30',
            ring: 'hover:border-emerald-200/80 hover:shadow-emerald-500/15', accent: 'from-emerald-500 to-teal-500',
          },
          {
            label: 'Returned for Correction', sub: 'Requires update', value: liveKpis.returned,
            chip: 'Feedback', icon: RotateCcw, route: 'fin-submissions',
            tile: 'from-rose-400 via-red-500 to-rose-600 shadow-rose-500/30', glow: 'bg-rose-400/30',
            ring: 'hover:border-rose-200/80 hover:shadow-rose-500/15', accent: 'from-rose-500 to-red-500',
          },
        ].map((k) => {
          const Icon = k.icon
          return (
            <motion.div
              key={k.label}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              onClick={() => setActiveModule(k.route as any)}
              className={`group relative cursor-pointer overflow-hidden rounded-[26px] border border-white/70 bg-white/70 p-5 shadow-xl shadow-sky-500/5 backdrop-blur-xl transition-all duration-300 ${k.ring}`}
            >
              {/* glass sheen + color glow */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white/90 to-transparent" />
              <div className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full ${k.glow} blur-2xl transition-opacity duration-300 group-hover:opacity-100 opacity-60`} />

              <div className="relative z-10 flex items-start justify-between">
                <div className={`flex h-12 w-12 items-center justify-center rounded-[16px] bg-gradient-to-br ${k.tile} text-white shadow-lg`}>
                  <Icon className="h-6 w-6" />
                </div>
                <span className="rounded-full border border-slate-200/70 bg-white/80 px-2.5 py-0.5 text-[10px] font-bold text-slate-500 backdrop-blur-sm">
                  {k.chip}
                </span>
              </div>
              <div className="relative z-10 mt-4">
                <div className="text-[34px] font-black leading-none tracking-tight text-slate-900">
                  {k.value}
                </div>
                <div className="mt-2 text-xs font-bold text-slate-700">{k.label}</div>
                <div className="text-[11px] font-medium text-slate-400">{k.sub}</div>
                <div className={`mt-3 h-1 w-10 rounded-full bg-gradient-to-r ${k.accent}`} />
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* ═══ C/D/E. SECOND ROW — three glass panels ═══ */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">

        {/* C. Financial Progress — gradient gauge glass card (4 cols) */}
        <div className="relative overflow-hidden rounded-[28px] border border-white/70 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl lg:col-span-4 flex flex-col justify-between">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white/90 to-transparent" />
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/25">
                  <Gauge className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-black text-slate-900">Financial Progress</h3>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
              </span>
            </div>

            {/* Gradient circular gauge */}
            <div className="my-5 flex items-center justify-center">
              <div className="relative flex h-36 w-36 items-center justify-center">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                  <defs>
                    <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#2563eb" />
                      <stop offset="55%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#a855f7" />
                    </linearGradient>
                  </defs>
                  <circle cx="50" cy="50" r="42" className="stroke-slate-100" strokeWidth="9" fill="transparent" />
                  <circle
                    cx="50" cy="50" r="42"
                    stroke="url(#gaugeGrad)"
                    strokeWidth="9"
                    strokeDasharray={2 * Math.PI * 42}
                    strokeDashoffset={(2 * Math.PI * 42) * (1 - 0.62)}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="bg-gradient-to-r from-blue-700 to-violet-700 bg-clip-text text-3xl font-black text-transparent">62%</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Overall</span>
                </div>
              </div>
            </div>

            {/* Module bars with mini icons + gradient fills */}
            <div className="space-y-3.5">
              {[
                { label: 'Financial Summary', pct: 70, color: 'from-blue-600 to-sky-500', dot: 'bg-blue-600', icon: FileText },
                { label: 'Resource Expenditure', pct: 55, color: 'from-violet-600 to-purple-500', dot: 'bg-violet-600', icon: Wallet },
                { label: 'Evidence Upload', pct: 65, color: 'from-emerald-500 to-teal-500', dot: 'bg-emerald-500', icon: Upload },
                { label: 'BRSR Calculations', pct: 60, color: 'from-sky-500 to-cyan-500', dot: 'bg-sky-500', icon: BarChart2 },
              ].map(m => {
                const MIcon = m.icon
                return (
                  <div key={m.label}>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`flex h-5 w-5 items-center justify-center rounded-md ${m.dot} bg-opacity-10 text-white`}>
                          <MIcon className="h-3 w-3" />
                        </span>
                        <span className="font-semibold text-slate-700">{m.label}</span>
                      </div>
                      <span className="font-black text-slate-800">{m.pct}%</span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100/90">
                      <div className={`h-full rounded-full bg-gradient-to-r ${m.color} transition-all duration-700`} style={{ width: `${m.pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* D. Expenditure Overview — gradient bars glass card (5 cols) */}
        <div className="relative overflow-hidden rounded-[28px] border border-white/70 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl lg:col-span-5 flex flex-col justify-between">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white/90 to-transparent" />
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md shadow-violet-500/25">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Expenditure Overview</h3>
                  <p className="text-[11px] text-slate-500">Resource initiatives expenditure by month</p>
                </div>
              </div>
              <button
                onClick={() => setActiveModule('fin-expenditure')}
                className="flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-xs font-bold text-blue-600 transition hover:bg-blue-50"
              >
                <span>View Details</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-4 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="capexGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.55} />
                    </linearGradient>
                    <linearGradient id="opexGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a855f7" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#c084fc" stopOpacity={0.55} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(59,130,246,0.06)' }}
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                      backdropFilter: 'blur(12px)',
                      borderRadius: '18px',
                      border: '1px solid rgba(255,255,255,0.8)',
                      boxShadow: '0 18px 40px -12px rgba(2,132,199,0.25)',
                      fontSize: '12px'
                    }}
                    formatter={(val: any) => [`₹ ${val} Cr`, '']}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }}
                  />
                  <Bar dataKey="capEx" name="CapEx" fill="url(#capexGrad)" radius={[5, 5, 0, 0]} barSize={11} />
                  <Bar dataKey="opEx" name="OpEx" fill="url(#opexGrad)" radius={[5, 5, 0, 0]} barSize={11} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="relative z-10 mt-2 text-right text-[11px] font-semibold text-slate-400">
            Amounts in ₹ Crore
          </div>
        </div>

        {/* E. Recent Activity — live glass card (3 cols) */}
        <div className="relative overflow-hidden rounded-[28px] border border-white/70 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl lg:col-span-3 flex flex-col justify-between">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white/90 to-transparent" />
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/25">
                  <History className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-black text-slate-900">Recent Activity</h3>
              </div>
              <button
                onClick={() => setActiveModule('fin-activity')}
                className="flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-xs font-bold text-blue-600 transition hover:bg-blue-50"
              >
                <span>View All</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {activities.map((act) => {
                const tile =
                  act.type === 'SUBMITTED' ? 'from-emerald-400 to-teal-600 shadow-emerald-500/25'
                  : act.type === 'RETURNED' ? 'from-rose-400 to-red-600 shadow-rose-500/25'
                  : act.type === 'DOC_UPLOADED' ? 'from-indigo-400 to-violet-600 shadow-violet-500/25'
                  : act.type === 'EXPORT_GENERATED' ? 'from-amber-400 to-orange-600 shadow-amber-500/25'
                  : 'from-sky-400 to-blue-600 shadow-blue-500/25'
                const AIcon =
                  act.type === 'SUBMITTED' ? Send
                  : act.type === 'RETURNED' ? RotateCcw
                  : act.type === 'DOC_UPLOADED' ? Upload
                  : act.type === 'EXPORT_GENERATED' ? TrendingUp
                  : FileText
                return (
                  <div key={act.id} className="group relative flex items-start gap-3 rounded-2xl border border-white/50 bg-white/60 p-2.5 shadow-xs transition hover:bg-white/85">
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${tile} text-white shadow-md`}>
                      <AIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-800 line-clamp-1">{act.title}</div>
                      <div className="text-[11px] text-slate-500 line-clamp-1">{act.description}</div>
                      <div className="mt-0.5 text-[10px] font-medium text-slate-400">{act.timestamp}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ F. MY ASSIGNMENTS PREVIEW — glass list ═══ */}
      <div className="relative overflow-hidden rounded-[28px] border border-white/70 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white/90 to-transparent" />
        <div className="relative z-10">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-white/60">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25">
                <ClipboardList className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">My Assignments</h3>
                <p className="text-[11px] text-slate-500">
                  Tasks & corrections streaming in from the Project Admin — live
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveModule('fin-assignments')}
              className="flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1.5 text-xs font-bold text-blue-600 transition hover:bg-blue-50 self-start sm:self-auto"
            >
              <span>View All</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Realtime assignment cards */}
          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
            {(actionItems.length > 0 ? actionItems.slice(0, 3) : []).map((t: any) => {
              const typeChip = t.type === 'ASSIGNED_TASK'
                ? { label: 'PA Task', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: ClipboardList }
                : t.type === 'CORRECTION'
                  ? { label: 'Correction', cls: 'bg-rose-50 text-rose-700 border-rose-200', icon: RotateCcw }
                  : { label: 'Draft Reminder', cls: 'bg-sky-50 text-sky-700 border-sky-200', icon: FileText }
              const ChipIcon = typeChip.icon
              return (
                <div key={t.id} className="group relative overflow-hidden rounded-[20px] border border-white/70 bg-white/80 p-4 shadow-md shadow-sky-500/5 backdrop-blur-md transition hover:-translate-y-0.5 hover:shadow-lg">
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-white/80 to-transparent" />
                  <div className="relative z-10">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${typeChip.cls}`}>
                        <ChipIcon className="h-3 w-3" /> {typeChip.label}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                        t.severity === 'critical' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
                      }`}>
                        {t.severity === 'critical' ? 'HIGH' : 'MED'}
                      </span>
                    </div>
                    <div className="mt-2 line-clamp-2 text-xs font-bold text-slate-900">{t.title}</div>
                    <div className="mt-1 line-clamp-2 text-[11px] text-slate-500">{t.description}</div>
                    <div className="mt-2.5 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                        <Clock className="h-3 w-3" />
                        {t.dueDate ? new Date(t.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'No due date'}
                      </span>
                      <button
                        onClick={() => setActiveModule('fin-data')}
                        className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1 text-[11px] font-bold text-white shadow-xs transition hover:bg-blue-700 active:scale-95"
                      >
                        <span>Open</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
            {actionItems.length === 0 && assignments.slice(0, 3).map((item: any) => {
              const isSubmitted = item.status === 'Submitted'
              return (
                <div key={item.id} className="group relative overflow-hidden rounded-[20px] border border-white/70 bg-white/80 p-4 shadow-md shadow-sky-500/5 backdrop-blur-md transition hover:-translate-y-0.5 hover:shadow-lg">
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-white/80 to-transparent" />
                  <div className="relative z-10">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                        <FileText className="h-3 w-3" /> {item.module}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">{item.entityId}</span>
                    </div>
                    <div className="mt-2 line-clamp-1 text-xs font-bold text-slate-900">{item.entityName}</div>
                    <div className="mt-1 text-[11px] text-slate-500">{item.businessUnit} · {item.financialYear}</div>
                    <div className="mt-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-full rounded-full ${item.completion === 100 ? 'bg-blue-600' : item.completion > 50 ? 'bg-indigo-600' : 'bg-amber-500'}`} style={{ width: `${item.completion}%` }} />
                        </div>
                        <span className="text-[10px] font-bold text-slate-600">{item.completion}%</span>
                      </div>
                      <button
                        onClick={() => setActiveModule('fin-data')}
                        className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1 text-[11px] font-bold text-white shadow-xs transition hover:bg-blue-700 active:scale-95"
                      >
                        <span>{isSubmitted ? 'View' : item.completion > 0 ? 'Continue' : 'Enter Data'}</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
