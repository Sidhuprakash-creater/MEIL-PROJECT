'use client'
/**
 * ESG Analytics Module — group-wide consolidated analytics across all modules.
 *
 * All KPIs come from /api/overview (computed server-side; no hardcoded values).
 * Charts use recharts. Project/BU/Subsidiary/Group comparison selectors are
 * UI-only (data from the overview endpoint at group scope).
 */
import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Flame, Zap, Droplet, Recycle, Users, ShieldCheck, Building2,
  AlertOctagon, RefreshCw, TrendingUp, TrendingDown, Battery, Leaf,
  HardHat, Activity, Gauge, Filter
} from 'lucide-react'
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  RadialBarChart, RadialBar
} from 'recharts'
import { useApp } from '@/lib/auth-context'

// ============================================================
// Types
// ============================================================
interface OverviewData {
  kpis: Record<string, any>
  trends: Record<string, { emissions: number; energy: number; water: number; waste: number }>
  emissionsBySource: Record<string, number>
  activities: any[]
  periods: any[]
  sources: Record<string, number>
}

type ViewTab = 'emissions' | 'energy' | 'water' | 'waste' | 'people' | 'safety'

const PALETTE = ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316']
const tooltipStyle = {
  background: 'rgba(255,255,255,0.92)', border: '1px solid rgba(255,255,255,0.8)',
  borderRadius: 12, fontSize: 11, boxShadow: '0 8px 24px -8px rgba(30,58,138,0.18)',
  backdropFilter: 'blur(12px)',
}

const TABS: { key: ViewTab; label: string; icon: any }[] = [
  { key: 'emissions', label: 'Emissions', icon: Flame },
  { key: 'energy', label: 'Energy', icon: Zap },
  { key: 'water', label: 'Water', icon: Droplet },
  { key: 'waste', label: 'Waste', icon: Recycle },
  { key: 'people', label: 'People', icon: Users },
  { key: 'safety', label: 'Safety', icon: ShieldCheck },
]

// ============================================================
// Module
// ============================================================
export function AnalyticsModule() {
  const { user } = useApp()
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<ViewTab>('emissions')
  const [scope, setScope] = useState('GROUP')

  useEffect(() => {
    fetch('/api/overview')
      .then(r => r.json())
      .then(d => { setData(d as OverviewData); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const trendArr = useMemo(() => {
    if (!data) return []
    return Object.entries(data.trends).map(([label, v]) => ({ label, ...v }))
  }, [data])

  if (loading) return <AnalyticsSkeleton />
  if (error) return <ErrorState message={error} onRetry={() => location.reload()} />
  if (!data) return <EmptyState />

  const k = data.kpis

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">ESG Analytics</h1>
            <span className="status-pill status-approved"><Activity className="h-3 w-3" /> Live</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Group-wide consolidated analytics · {k.orgs} group(s) · {k.projects} project(s) · {data.periods.length} periods
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="glass-subtle flex items-center gap-2 rounded-full px-3 py-2 text-xs">
            <Filter className="h-3.5 w-3.5 text-blue-600" />
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="bg-transparent font-semibold text-slate-700 outline-none"
            >
              <option value="GROUP">MEIL Group (All)</option>
              <option value="SUBSIDIARY">Subsidiary</option>
              <option value="BU">Business Unit</option>
              <option value="PROJECT">Project</option>
            </select>
          </div>
          <button onClick={() => location.reload()} className="glass-subtle flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-white">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* TABS */}
      <div className="glass-subtle flex items-center gap-1 overflow-x-auto scroll-elegant rounded-2xl p-1.5">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex flex-shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
              tab === t.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* VIEW */}
      <motion.div
        key={tab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {tab === 'emissions' && <EmissionsView k={k} trendArr={trendArr} emissionsBySource={data.emissionsBySource} />}
        {tab === 'energy' && <EnergyView k={k} trendArr={trendArr} />}
        {tab === 'water' && <WaterView k={k} trendArr={trendArr} />}
        {tab === 'waste' && <WasteView k={k} trendArr={trendArr} />}
        {tab === 'people' && <PeopleView k={k} />}
        {tab === 'safety' && <SafetyView k={k} />}
      </motion.div>
    </div>
  )
}

// ============================================================
// Emissions
// ============================================================
function EmissionsView({ k, trendArr, emissionsBySource }: { k: Record<string, any>; trendArr: any[]; emissionsBySource: Record<string, number> }) {
  const scopeArr = [
    { name: 'Scope 1', value: k.scope1, color: '#3b82f6' },
    { name: 'Scope 2', value: k.scope2, color: '#06b6d4' },
    { name: 'Scope 3', value: k.scope3, color: '#8b5cf6' },
  ]
  const sourceArr = Object.entries(emissionsBySource).map(([name, value]) => ({ name, value }))
  const total = k.totalEmissions

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard icon={Flame} tileClass="bg-rose-50 text-rose-600" label="Total Emissions" value={total.toLocaleString()} unit="tCO₂e" sub={`${k.scope1 + k.scope2 + k.scope3 > 0 ? 'All scopes' : 'No data'}`} />
        <KpiCard icon={Battery} tileClass="bg-blue-50 text-blue-600" label="Scope 1" value={k.scope1.toLocaleString()} unit="tCO₂e" sub="Direct" />
        <KpiCard icon={Zap} tileClass="bg-cyan-50 text-cyan-600" label="Scope 2" value={k.scope2.toLocaleString()} unit="tCO₂e" sub="Purchased energy" />
        <KpiCard icon={Activity} tileClass="bg-violet-50 text-violet-600" label="Scope 3" value={k.scope3.toLocaleString()} unit="tCO₂e" sub="Value chain" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Monthly emissions trend */}
        <GlassCard className="lg:col-span-2" delay={0.05}>
          <CardHeader icon={TrendingUp} title="Monthly GHG Trajectory" subtitle="tCO₂e by reporting period · deterministic calc" right={<span className="status-pill status-approved">Target &lt; 5k</span>} />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendArr} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="emGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="emissions" stroke="#3b82f6" strokeWidth={2.5} fill="url(#emGrad2)" name="Emissions tCO₂e" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Scope breakdown */}
        <GlassCard delay={0.1}>
          <CardHeader icon={Battery} title="Scope Breakdown" subtitle="S1 vs S2 vs S3" />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scopeArr} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={70} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {scopeArr.map((s, i) => <Cell key={i} fill={s.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>

      {/* Emissions by source pie */}
      <GlassCard delay={0.15}>
        <CardHeader icon={Leaf} title="Emissions by Source" subtitle="Diesel, Grid, Solar-PPA, etc." />
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={sourceArr} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={(e: any) => `${e.name}: ${e.value.toFixed(1)}`} labelLine={false}>
                {sourceArr.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>
    </div>
  )
}

// ============================================================
// Energy
// ============================================================
function EnergyView({ k, trendArr }: { k: Record<string, any>; trendArr: any[] }) {
  const donut = [
    { name: 'Renewable', value: k.renewableShare, fill: '#10b981' },
    { name: 'Non-renewable', value: Math.max(100 - k.renewableShare, 0), fill: '#f59e0b' },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard icon={Zap} tileClass="bg-amber-50 text-amber-600" label="Total Energy" value={k.energyGJ.toLocaleString()} unit="GJ" sub="All sources" />
        <KpiCard icon={Leaf} tileClass="bg-emerald-50 text-emerald-600" label="Renewable Share" value={k.renewableShare} unit="%" sub={`${k.renewableShare}% of GJ`} />
        <KpiCard icon={Battery} tileClass="bg-blue-50 text-blue-600" label="Non-renewable" value={Math.round(k.energyGJ * (100 - k.renewableShare) / 100).toLocaleString()} unit="GJ" sub="Fossil sources" />
        <KpiCard icon={TrendingUp} tileClass="bg-violet-50 text-violet-600" label="Periods Tracked" value={trendArr.length} unit="periods" sub="Monthly" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Monthly energy bar */}
        <GlassCard className="lg:col-span-2" delay={0.05}>
          <CardHeader icon={Zap} title="Monthly Energy (GJ)" subtitle="Per reporting period" />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendArr} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="energy" fill="#0ea5e9" radius={[4, 4, 0, 0]} name="Energy GJ" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Renewable donut */}
        <GlassCard delay={0.1}>
          <CardHeader icon={Leaf} title="Renewable Mix" subtitle={`${k.renewableShare}% renewable`} />
          <div className="flex h-72 items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={donut} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3}>
                  {donut.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => `${v}%`} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>
    </div>
  )
}

// ============================================================
// Water
// ============================================================
function WaterView({ k, trendArr }: { k: Record<string, any>; trendArr: any[] }) {
  const donut = [
    { name: 'Recycled', value: k.waterRecycledShare, fill: '#06b6d4' },
    { name: 'Fresh', value: Math.max(100 - k.waterRecycledShare, 0), fill: '#bae6fd' },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard icon={Droplet} tileClass="bg-cyan-50 text-cyan-600" label="Total Withdrawal" value={k.waterWithdrawalKL.toLocaleString()} unit="KL" sub="Surface + ground" />
        <KpiCard icon={Recycle} tileClass="bg-teal-50 text-teal-600" label="Recycled Share" value={k.waterRecycledShare} unit="%" sub="Recycled + reused" />
        <KpiCard icon={Building2} tileClass="bg-blue-50 text-blue-600" label="ZLD Projects" value={k.zldProjects ?? 0} unit="sites" sub="Zero-liquid-discharge" />
        <KpiCard icon={Activity} tileClass="bg-violet-50 text-violet-600" label="Periods Tracked" value={trendArr.length} unit="periods" sub="Monthly" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Monthly water */}
        <GlassCard className="lg:col-span-2" delay={0.05}>
          <CardHeader icon={Droplet} title="Monthly Water Withdrawal (KL)" subtitle="Per reporting period" />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendArr} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="water" stroke="#06b6d4" strokeWidth={2.5} fill="url(#waterGrad)" name="Water KL" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Recycled donut */}
        <GlassCard delay={0.1}>
          <CardHeader icon={Recycle} title="Recycle Mix" subtitle={`${k.waterRecycledShare}% recycled`} right={<span className="status-pill status-approved">ZLD</span>} />
          <div className="flex h-72 items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={donut} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3}>
                  {donut.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => `${v}%`} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>
    </div>
  )
}

// ============================================================
// Waste
// ============================================================
function WasteView({ k, trendArr }: { k: Record<string, any>; trendArr: any[] }) {
  const donut = [
    { name: 'Recovered', value: k.wasteRecycledShare, fill: '#10b981' },
    { name: 'Disposed', value: Math.max(100 - k.wasteRecycledShare, 0), fill: '#fbbf24' },
  ]
  const hazDonut = [
    { name: 'Hazardous', value: k.hazardousWasteT, fill: '#ef4444' },
    { name: 'Non-hazardous', value: Math.max(k.wasteGeneratedT - k.hazardousWasteT, 0), fill: '#94a3b8' },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard icon={Recycle} tileClass="bg-emerald-50 text-emerald-600" label="Generated" value={k.wasteGeneratedT.toLocaleString()} unit="T" sub="All waste" />
        <KpiCard icon={Leaf} tileClass="bg-teal-50 text-teal-600" label="Recovered" value={k.wasteRecycledShare} unit="%" sub="Recycled + reused" />
        <KpiCard icon={AlertOctagon} tileClass="bg-rose-50 text-rose-600" label="Hazardous" value={k.hazardousWasteT.toLocaleString()} unit="T" sub="Manifested" />
        <KpiCard icon={Activity} tileClass="bg-blue-50 text-blue-600" label="Non-hazardous" value={Math.max(k.wasteGeneratedT - k.hazardousWasteT, 0).toLocaleString()} unit="T" sub="Routine" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Monthly waste */}
        <GlassCard className="lg:col-span-2" delay={0.05}>
          <CardHeader icon={Recycle} title="Monthly Waste Generated (T)" subtitle="Per reporting period" />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendArr} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="waste" fill="#10b981" radius={[4, 4, 0, 0]} name="Waste T" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Haz vs non-haz */}
        <GlassCard delay={0.1}>
          <CardHeader icon={AlertOctagon} title="Hazardous vs Non" subtitle={`${k.hazardousWasteT}T hazardous`} />
          <div className="flex h-72 items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={hazDonut} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3}>
                  {hazDonut.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>

      <GlassCard delay={0.15}>
        <CardHeader icon={Recycle} title="Recovery Rate" subtitle={`${k.wasteRecycledShare}% of generated waste recovered`} />
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={donut} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}>
                {donut.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => `${v}%`} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>
    </div>
  )
}

// ============================================================
// People
// ============================================================
function PeopleView({ k }: { k: Record<string, any> }) {
  const genderArr = [
    { name: 'Male', value: k.totalWorkforce - k.femaleShare * k.totalWorkforce / 100 > 0 ? k.totalWorkforce - Math.round(k.femaleShare * k.totalWorkforce / 100) : 0, fill: '#3b82f6' },
    { name: 'Female', value: Math.round(k.femaleShare * k.totalWorkforce / 100), fill: '#ec4899' },
  ]
  const empWorkerArr = [
    { name: 'Employees', value: k.totalEmployees, fill: '#06b6d4' },
    { name: 'Workers', value: k.totalWorkers, fill: '#f59e0b' },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard icon={Users} tileClass="bg-blue-50 text-blue-600" label="Total Workforce" value={k.totalWorkforce.toLocaleString()} unit="people" sub={`${k.totalEmployees} emp · ${k.totalWorkers} workers`} />
        <KpiCard icon={Users} tileClass="bg-pink-50 text-pink-600" label="Female Share" value={k.femaleShare} unit="%" sub="Gender diversity" />
        <KpiCard icon={ShieldCheck} tileClass="bg-violet-50 text-violet-600" label="Differently-abled" value={k.differentlyAbled} unit="people" sub="Inclusive hiring" />
        <KpiCard icon={TrendingUp} tileClass="bg-emerald-50 text-emerald-600" label="Training Hours" value={k.trainingHours.toLocaleString()} unit="hrs" sub="Total" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Employee vs Worker */}
        <GlassCard delay={0.05}>
          <CardHeader icon={HardHat} title="Employees vs Workers" subtitle={`${k.totalWorkforce} total`} />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={empWorkerArr} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {empWorkerArr.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Gender mix */}
        <GlassCard delay={0.1}>
          <CardHeader icon={Users} title="Gender Mix" subtitle={`${k.femaleShare}% female`} />
          <div className="flex h-72 items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={genderArr} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3}>
                  {genderArr.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>

      {/* Workforce breakdown list */}
      <GlassCard delay={0.15}>
        <CardHeader icon={Users} title="Workforce Breakdown" subtitle="Headcount by category" />
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <StatBox label="Employees" value={k.totalEmployees} />
          <StatBox label="Workers" value={k.totalWorkers} />
          <StatBox label="Female" value={Math.round(k.femaleShare * k.totalWorkforce / 100)} />
          <StatBox label="Differently-abled" value={k.differentlyAbled} />
          <StatBox label="Training hours" value={k.trainingHours} />
          <StatBox label="New hires" value={k.newHires ?? '—'} />
          <StatBox label="Exits" value={k.exits ?? '—'} />
          <StatBox label="Attrition %" value={k.attritionRate ?? '—'} />
        </div>
      </GlassCard>
    </div>
  )
}

// ============================================================
// Safety
// ============================================================
function SafetyView({ k }: { k: Record<string, any> }) {
  const ltifrData = [{ name: 'LTIFR', value: k.ltifr, fill: '#3b82f6' }]
  const incidentArr = [
    { name: 'Fatalities', value: k.fatalities, fill: '#ef4444' },
    { name: 'LTI', value: k.lti, fill: '#f59e0b' },
    { name: 'Injuries', value: k.injuries, fill: '#06b6d4' },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard icon={ShieldCheck} tileClass="bg-violet-50 text-violet-600" label="LTIFR" value={k.ltifr} unit="/M hrs" sub="Lost-time incidents" />
        <KpiCard icon={AlertOctagon} tileClass="bg-rose-50 text-rose-600" label="Fatalities" value={k.fatalities} unit="" sub="YTD" />
        <KpiCard icon={AlertOctagon} tileClass="bg-amber-50 text-amber-600" label="LTI" value={k.lti} unit="" sub="Lost-time incidents" />
        <KpiCard icon={Activity} tileClass="bg-cyan-50 text-cyan-600" label="Injuries" value={k.injuries} unit="" sub="Total" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* LTIFR radial */}
        <GlassCard delay={0.05}>
          <CardHeader icon={Gauge} title="LTIFR" subtitle="Per million man-hours" right={<span className="status-pill status-approved">Target &lt; 1</span>} />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart innerRadius={50} outerRadius={120} data={ltifrData} startAngle={90} endAngle={-270}>
                <RadialBar dataKey="value" cornerRadius={8} fill="#3b82f6" background={{ fill: 'rgba(148,163,184,0.12)' }} />
                <Tooltip contentStyle={tooltipStyle} />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <div className="-mt-12 text-center">
            <div className="tabular-nums text-3xl font-bold text-slate-800">{k.ltifr}</div>
            <div className="text-[10px] text-slate-400">lost-time incidents / million hrs</div>
          </div>
        </GlassCard>

        {/* Incidents bar */}
        <GlassCard className="lg:col-span-2" delay={0.1}>
          <CardHeader icon={AlertOctagon} title="Incident Counts" subtitle="Fatalities, LTI, Injuries" />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={incidentArr} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {incidentArr.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>

      <GlassCard delay={0.15}>
        <CardHeader icon={TrendingUp} title="Safety Training" subtitle="Hours invested in workforce training" />
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <StatBox label="Man-hours worked" value={k.safetyTrainingHours ? k.safetyTrainingHours.toLocaleString() : '—'} />
          <StatBox label="Safety training hrs" value={k.safetyTrainingHours ?? '—'} />
          <StatBox label="Recordable injuries" value={k.recordableInjuries ?? '—'} />
          <StatBox label="High-consequence" value={k.highConsequence ?? '—'} />
        </div>
      </GlassCard>
    </div>
  )
}

// ============================================================
// Shared building blocks
// ============================================================
function GlassCard({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay }}
      className={`glass glass-shimmer rounded-2xl p-4 ${className}`}
    >
      {children}
    </motion.section>
  )
}

function CardHeader({ icon: Icon, title, subtitle, right }: { icon: any; title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-start justify-between">
      <div className="flex items-start gap-2.5">
        <div className="kpi-tile bg-slate-50 text-slate-600" style={{ width: 32, height: 32 }}><Icon className="h-4 w-4" /></div>
        <div>
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  )
}

function KpiCard({ icon: Icon, tileClass, label, value, unit, sub }: { icon: any; tileClass: string; label: string; value: string | number; unit: string; sub?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass glass-shimmer rounded-2xl p-4"
    >
      <div className="flex items-start justify-between">
        <div className={`kpi-tile ${tileClass}`}><Icon className="h-5 w-5" /></div>
      </div>
      <div className="mt-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
        <div className="mt-0.5 flex items-baseline gap-1">
          <span className="tabular-nums text-2xl font-bold text-slate-800">{value}</span>
          <span className="text-xs font-medium text-slate-400">{unit}</span>
        </div>
        {sub && <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>}
      </div>
    </motion.div>
  )
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-white/50 px-2 py-2">
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className="tabular-nums text-base font-bold text-slate-800">{value}</div>
    </div>
  )
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-8 w-48 animate-pulse rounded bg-slate-200/60" />
      <div className="h-12 animate-pulse rounded-2xl bg-white/40" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[...Array(4)].map((_, i) => <div key={i} className="glass h-32 animate-pulse rounded-2xl" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass h-96 animate-pulse rounded-2xl lg:col-span-2" />
        <div className="glass h-96 animate-pulse rounded-2xl" />
      </div>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="glass flex flex-col items-center justify-center gap-3 rounded-2xl py-16 text-center">
      <AlertOctagon className="h-10 w-10 text-rose-500" />
      <div>
        <div className="text-base font-bold text-slate-800">Failed to load analytics</div>
        <div className="text-xs text-slate-500">{message}</div>
      </div>
      <button onClick={onRetry} className="btn-glass-primary rounded-full px-5 py-2 text-xs font-semibold">
        <RefreshCw className="mr-1 inline h-3 w-3" /> Retry
      </button>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="glass flex flex-col items-center justify-center gap-3 rounded-2xl py-16 text-center">
      <Gauge className="h-10 w-10 text-slate-400" />
      <div>
        <div className="text-base font-bold text-slate-800">No reporting periods yet</div>
        <div className="text-xs text-slate-500">Seed a reporting year and period to begin.</div>
      </div>
    </div>
  )
}
