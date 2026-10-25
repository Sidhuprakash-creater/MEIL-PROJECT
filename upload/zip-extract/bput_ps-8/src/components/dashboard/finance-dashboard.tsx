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
  Calendar, Layers, Sparkles, Filter, ChevronRight, Eye, Edit3, ArrowUpRight
} from 'lucide-react'
import { useApp } from '@/lib/auth-context'
import {
  financeStore,
  type FinanceAssignment,
  type ActivityEvent,
  type ResourceExpenditureItem
} from '@/lib/finance-store'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'

export function FinanceDashboard() {
  const { setActiveModule } = useApp()
  const [assignments, setAssignments] = useState<FinanceAssignment[]>([])
  const [activities, setActivities] = useState<ActivityEvent[]>([])
  const [chartData, setChartData] = useState<any[]>([])
  const [currentTime, setCurrentTime] = useState<string>('02:15 PM')
  const [kpiCounts, setKpiCounts] = useState({
    assigned: 24,
    pending: 8,
    submitted: 12,
    returned: 4
  })

  useEffect(() => {
    // Load persisted data
    const allAssignments = financeStore.getAssignments()
    const allActivities = financeStore.getActivities()
    const monthlyData = financeStore.getMonthlyExpenditureChartData()

    setAssignments(allAssignments)
    setActivities(allActivities.slice(0, 4))
    setChartData(monthlyData)

    // Calculate real KPI counts
    const pending = allAssignments.filter(a => a.status === 'Draft' || a.status === 'In Progress').length
    const submitted = allAssignments.filter(a => a.status === 'Submitted' || a.status === 'Accepted').length
    const returned = allAssignments.filter(a => a.status === 'Returned for Correction').length

    setKpiCounts({
      assigned: allAssignments.length,
      pending: pending || 8,
      submitted: submitted || 12,
      returned: returned || 4
    })

    // Update time
    const updateTime = () => {
      const now = new Date()
      setCurrentTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }))
    }
    updateTime()
    const interval = setInterval(updateTime, 60000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="space-y-6 pb-12">
      {/* A. PAGE HEADER — Matching Reference Panel 1 */}
      <div className="relative overflow-hidden rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl md:p-8">
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25">
                <BarChart2 className="h-6 w-6" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
                Finance Data Console
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50/80 px-3 py-1 text-xs font-bold text-blue-700 shadow-xs">
                <Sparkles className="h-3 w-3 text-blue-600" />
                Contributor
              </span>
            </div>
            <p className="text-sm font-medium text-slate-500">
              Financial reporting · Resource expenditure · BRSR data collection
            </p>
          </div>

          {/* Quick status pills on header */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 rounded-full border border-sky-200/80 bg-sky-50/90 px-3.5 py-1.5 text-xs font-bold text-sky-800 shadow-xs">
              <span className="h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
              <span>{kpiCounts.pending} pending entry</span>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-indigo-200/80 bg-indigo-50/90 px-3.5 py-1.5 text-xs font-bold text-indigo-800 shadow-xs">
              <span>62% completion</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-600 shadow-xs">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <span>{currentTime}</span>
            </div>
            <button
              onClick={() => setActiveModule('fin-assignments')}
              className="group flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/25 transition hover:shadow-lg hover:from-blue-700 hover:to-indigo-700 active:scale-95"
            >
              <span>View My Assignments</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </div>

      {/* B. KPI CARDS (4 Interactive Cards) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: Total Assigned Entities */}
        <motion.div
          whileHover={{ y: -3, transition: { duration: 0.2 } }}
          onClick={() => setActiveModule('fin-assignments')}
          className="cursor-pointer rounded-[24px] border border-white/60 bg-white/70 p-5 shadow-lg shadow-sky-500/5 backdrop-blur-xl transition hover:border-purple-200 hover:shadow-purple-500/10"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-md shadow-purple-500/20">
              <Layers className="h-6 w-6" />
            </div>
            <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-[11px] font-bold text-purple-700">
              All Units
            </span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black tracking-tight text-slate-900">
              {kpiCounts.assigned}
            </div>
            <div className="mt-1 text-xs font-bold text-slate-700">Total Assigned Entities</div>
            <div className="text-[11px] text-slate-400">Projects / Business Units</div>
          </div>
        </motion.div>

        {/* KPI 2: Pending Entry */}
        <motion.div
          whileHover={{ y: -3, transition: { duration: 0.2 } }}
          onClick={() => setActiveModule('fin-assignments')}
          className="cursor-pointer rounded-[24px] border border-white/60 bg-white/70 p-5 shadow-lg shadow-sky-500/5 backdrop-blur-xl transition hover:border-amber-200 hover:shadow-amber-500/10"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md shadow-amber-500/20">
              <Clock className="h-6 w-6" />
            </div>
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
              Action Req.
            </span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black tracking-tight text-slate-900">
              {kpiCounts.pending}
            </div>
            <div className="mt-1 text-xs font-bold text-slate-700">Pending Entry</div>
            <div className="text-[11px] text-amber-600 font-medium">Need your action</div>
          </div>
        </motion.div>

        {/* KPI 3: Submitted */}
        <motion.div
          whileHover={{ y: -3, transition: { duration: 0.2 } }}
          onClick={() => setActiveModule('fin-submissions')}
          className="cursor-pointer rounded-[24px] border border-white/60 bg-white/70 p-5 shadow-lg shadow-sky-500/5 backdrop-blur-xl transition hover:border-emerald-200 hover:shadow-emerald-500/10"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
              In Review
            </span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black tracking-tight text-slate-900">
              {kpiCounts.submitted}
            </div>
            <div className="mt-1 text-xs font-bold text-slate-700">Submitted</div>
            <div className="text-[11px] text-slate-400">Awaiting review</div>
          </div>
        </motion.div>

        {/* KPI 4: Returned for Correction */}
        <motion.div
          whileHover={{ y: -3, transition: { duration: 0.2 } }}
          onClick={() => setActiveModule('fin-submissions')}
          className="cursor-pointer rounded-[24px] border border-white/60 bg-white/70 p-5 shadow-lg shadow-sky-500/5 backdrop-blur-xl transition hover:border-rose-200 hover:shadow-rose-500/10"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-md shadow-rose-500/20">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700">
              Feedback
            </span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black tracking-tight text-slate-900">
              {kpiCounts.returned}
            </div>
            <div className="mt-1 text-xs font-bold text-slate-700">Returned for Correction</div>
            <div className="text-[11px] text-rose-600 font-medium">Requires update</div>
          </div>
        </motion.div>
      </div>

      {/* C & D & E. SECOND ROW: 3 PANELS */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* C. Financial Reporting Progress (Circular Gauge + List) — 4 Cols */}
        <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl lg:col-span-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Financial Progress (FY 2026-27)
              </h3>
              <span className="text-xs font-semibold text-slate-400">Live</span>
            </div>

            {/* Circular Gauge */}
            <div className="my-6 flex items-center justify-center">
              <div className="relative flex h-36 w-36 items-center justify-center">
                {/* SVG Radial Meter */}
                <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    className="stroke-slate-100"
                    strokeWidth="10"
                    fill="transparent"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    className="stroke-blue-600"
                    strokeWidth="10"
                    strokeDasharray={2 * Math.PI * 42}
                    strokeDashoffset={(2 * Math.PI * 42) * (1 - 0.62)}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-3xl font-black text-slate-900">62%</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Overall</span>
                </div>
              </div>
            </div>

            {/* Module Breakdown Progress Bars */}
            <div className="space-y-3.5">
              <div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-600" />
                    <span className="font-semibold text-slate-700">Financial Summary</span>
                  </div>
                  <span className="font-bold text-slate-800">70%</span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-blue-600 transition-all duration-500" style={{ width: '70%' }} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-purple-600" />
                    <span className="font-semibold text-slate-700">Resource Expenditure</span>
                  </div>
                  <span className="font-bold text-slate-800">55%</span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-purple-600 transition-all duration-500" style={{ width: '55%' }} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="font-semibold text-slate-700">Evidence Upload</span>
                  </div>
                  <span className="font-bold text-slate-800">65%</span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: '65%' }} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-sky-500" />
                    <span className="font-semibold text-slate-700">BRSR Calculations</span>
                  </div>
                  <span className="font-bold text-slate-800">60%</span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-sky-500 transition-all duration-500" style={{ width: '60%' }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* D. Expenditure Overview (CapEx vs OpEx Recharts Bar Chart) — 5 Cols */}
        <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl lg:col-span-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Expenditure Overview</h3>
                <p className="text-xs text-slate-500">Resource initiatives expenditure by month</p>
              </div>
              <button
                onClick={() => setActiveModule('fin-expenditure')}
                className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700"
              >
                <span>View Details</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Chart Area */}
            <div className="mt-4 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      borderRadius: '16px',
                      border: '1px solid rgba(255,255,255,0.7)',
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
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
                  <Bar dataKey="capEx" name="CapEx" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={10} />
                  <Bar dataKey="opEx" name="OpEx" fill="#a855f7" radius={[4, 4, 0, 0]} barSize={10} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-2 text-right text-[11px] font-semibold text-slate-400">
            Amounts in ₹ Crore
          </div>
        </div>

        {/* E. Recent Activity — 3 Cols */}
        <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl lg:col-span-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Recent Activity</h3>
              <button
                onClick={() => setActiveModule('fin-activity')}
                className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700"
              >
                <span>View All</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {activities.map((act) => {
                let badgeColor = 'bg-blue-100 text-blue-700'
                if (act.type === 'SUBMITTED') badgeColor = 'bg-emerald-100 text-emerald-700'
                if (act.type === 'RETURNED') badgeColor = 'bg-rose-100 text-rose-700'
                if (act.type === 'DOC_UPLOADED') badgeColor = 'bg-indigo-100 text-indigo-700'

                return (
                  <div key={act.id} className="group relative flex items-start gap-3">
                    <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${badgeColor}`}>
                      {act.type === 'SUBMITTED' && <CheckCircle2 className="h-4 w-4" />}
                      {act.type === 'RETURNED' && <AlertTriangle className="h-4 w-4" />}
                      {act.type === 'DOC_UPLOADED' && <Upload className="h-4 w-4" />}
                      {act.type === 'DRAFT_SAVED' && <FileText className="h-4 w-4" />}
                      {act.type === 'EXPORT_GENERATED' && <TrendingUp className="h-4 w-4" />}
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

      {/* F. MY ASSIGNMENTS PREVIEW TABLE — Matching Screenshot Panel 1 */}
      <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">My Assignments</h3>
            <p className="text-xs text-slate-500">
              Projects / Entities assigned to you for financial data entry
            </p>
          </div>
          <button
            onClick={() => setActiveModule('fin-assignments')}
            className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 self-start sm:self-auto"
          >
            <span>View All</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Assignments Table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="pb-3 pl-2">Project / Entity</th>
                <th className="pb-3">Business Unit</th>
                <th className="pb-3">Reporting Period</th>
                <th className="pb-3">Module</th>
                <th className="pb-3">Completion</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 pr-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs">
              {assignments.slice(0, 3).map((item) => {
                const isSubmitted = item.status === 'Submitted'
                const isDraft = item.status === 'Draft'
                const isInProgress = item.status === 'In Progress'

                return (
                  <tr key={item.id} className="group hover:bg-blue-50/40 transition">
                    <td className="py-4 pl-2 font-bold text-slate-800">
                      <div>{item.entityName}</div>
                      <div className="text-[10px] font-semibold text-slate-400">{item.entityId}</div>
                    </td>
                    <td className="py-4 text-slate-600 font-medium">{item.businessUnit}</td>
                    <td className="py-4 text-slate-500">{item.reportingPeriod}</td>
                    <td className="py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        item.module === 'Financial Summary'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                      }`}>
                        {item.module}
                      </span>
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${
                              item.completion === 100 ? 'bg-blue-600' : item.completion > 50 ? 'bg-indigo-600' : 'bg-amber-500'
                            }`}
                            style={{ width: `${item.completion}%` }}
                          />
                        </div>
                        <span className="font-bold text-slate-700">{item.completion}%</span>
                      </div>
                    </td>
                    <td className="py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        isInProgress
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : isDraft
                          ? 'bg-slate-100 text-slate-700 border border-slate-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="py-4 pr-2 text-right">
                      {isSubmitted ? (
                        <button
                          onClick={() => setActiveModule('fin-submissions')}
                          className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50/80 px-3 py-1 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
                        >
                          <span>View</span>
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            if (item.module === 'Resource Expenditure') {
                              setActiveModule('fin-expenditure')
                            } else {
                              setActiveModule('fin-data')
                            }
                          }}
                          className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-3.5 py-1 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700 active:scale-95"
                        >
                          <span>Enter Data</span>
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
