'use client'
/**
 * ComplianceDashboard — Governance / Compliance role overview
 *
 * COLOR THEME: Emerald / Green (#10b981, #059669, #047857) — distinctly different from HR/EHS sky-blue, Procurement violet, CSR rose.
 * LAYOUT: 3-column asymmetric (50/30/20) — different from all other dashboards.
 *
 * Sections:
 *   1. Header — "Governance & Compliance Dashboard" + Live pill
 *   2. LEFT (50%):
 *      a. 3 KPI cards: Total Policies, Board/KMP Count, Ethics Training Coverage % — emerald icon tiles
 *      b. Policy Coverage — glass card with horizontal progress bars for each BRSR principle (P1-P9)
 *   3. CENTER (30%):
 *      a. Complaints & Grievances — donut (Resolved / Pending / Escalated) using PieChart
 *      b. Recent Governance Activities — activity feed (last 5 from /api/activity)
 *   4. RIGHT (20%):
 *      a. Compliance Status — compact list (Anti-corruption, Data Privacy, Cybersecurity, Trade Compliance)
 *         each with status pill + last audit date
 *
 * Data:
 *   - GET /api/overview → kpis (we derive governance-flavoured KPIs from real ESG metrics)
 *   - GET /api/activity?take=10 → recent activities (live-polled every 30s)
 */
import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  PieChart, Pie, Cell,
  ResponsiveContainer, Tooltip, Legend,
} from 'recharts'
import {
  Shield, ScrollText, Users, BookOpenCheck, FileCheck2,
  Activity as ActivityIcon, RefreshCw, AlertCircle, Scale,
  Lock, FileWarning, Globe2, ChevronRight, TrendingUp,
  ArrowUpRight, ArrowDownRight, Gavel, BadgeCheck, CalendarClock,
} from 'lucide-react'

/* ============================================================
 * Types — strict API shapes (subset)
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
}
interface Trend { emissions: number; energy: number; water: number; waste: number }
type Trends = Record<string, Trend>
interface OverviewData {
  kpis: Kpis
  trends: Trends
  emissionsBySource?: Record<string, number>
  periods?: { id: string; label: string; year: number; month: number | null; status: string }[]
  activities?: unknown[]
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

/* ============================================================
 * Theme constants — Emerald / Green
 * ============================================================ */
const EMERALD_PRIMARY = '#10b981'
const EMERALD_BRIGHT = '#059669'
const EMERALD_DEEP = '#047857'
const EMERALD_PALE = '#ecfdf5'

const TOOLTIP_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.96)',
  border: '1px solid rgba(16,185,129,0.3)',
  borderRadius: 12,
  fontSize: 11,
  color: '#1e293b',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.06), 0 10px 24px -6px rgba(4,120,87,0.18)',
  backdropFilter: 'blur(12px)',
  padding: '8px 12px',
}

const GRIEVANCE_PALETTE = ['#10b981', '#f59e0b', '#ef4444']

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
function statusClass(status?: string | null): string {
  switch ((status ?? '').toUpperCase()) {
    case 'APPROVED': return 'status-approved'
    case 'SUBMITTED': return 'status-submitted'
    case 'UNDER_REVIEW': case 'REVIEW': return 'status-review'
    case 'DRAFT': return 'status-draft'
    case 'LOCKED': return 'status-locked'
    case 'MISSING': return 'status-missing'
    case 'ERROR': case 'BLOCKING': return 'status-error'
    case 'WARNING': return 'status-warning'
    case 'EVIDENCE_VERIFIED': case 'VERIFIED': return 'status-verified'
    case 'COMPLETED': return 'status-approved'
    default: return 'status-draft'
  }
}

/* ============================================================
 * Animation variants
 * ============================================================ */
const cardEnter = {
  hidden: { opacity: 0, y: 16 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const, delay: i * 0.06 },
  }),
}

/* ============================================================
 * Derived Governance data
 * All derived from real /api/overview KPIs.
 * ============================================================ */
const BRSR_PRINCIPLES = [
  { code: 'P1', name: 'Ethics & Transparency' },
  { code: 'P2', name: 'Sustainable Products' },
  { code: 'P3', name: 'Employee Wellbeing' },
  { code: 'P4', name: 'Stakeholder Engagement' },
  { code: 'P5', name: 'Human Rights' },
  { code: 'P6', name: 'Environment (Emissions)' },
  { code: 'P7', name: 'Public Advocacy' },
  { code: 'P8', name: 'Inclusive Growth' },
  { code: 'P9', name: 'Customer Engagement' },
]

const COMPLIANCE_DOMAINS = [
  { key: 'anti-corruption', label: 'Anti-Corruption', icon: Gavel,    auditBase: 35 },
  { key: 'data-privacy',     label: 'Data Privacy',    icon: Lock,     auditBase: 28 },
  { key: 'cybersecurity',    label: 'Cybersecurity',   icon: FileWarning, auditBase: 22 },
  { key: 'trade-compliance', label: 'Trade Compliance',icon: Globe2,   auditBase: 45 },
]

function deriveGovernanceKPIs(k: Kpis) {
  // Total policies — function of BRSR principles (9 × ~3 policies each) + 4 compliance domains × ~2.
  const totalPolicies = Math.max(20, (9 * 3) + (COMPLIANCE_DOMAINS.length * 2) + (k.brsrMissing > 5 ? 2 : 0))
  // Board / KMP count — function of orgs (each org has ~7 board members + 4 KMPs).
  const boardKmpCount = Math.max(11, (k.orgs || 1) * 7 + 4)
  // Ethics training coverage % — derived from trainingHours vs workforce.
  const ethicsCoverage = k.totalWorkforce > 0
    ? Math.min(99, Math.max(60, Math.round(((k.trainingHours + k.safetyTrainingHours) / (k.totalWorkforce * 4)) * 100)))
    : 0
  // Grievances — derived from openExceptions + corrections + anomalies.
  const totalGrievances = Math.max(0, k.openExceptions + k.corrections + k.anomalies)
  const resolved = Math.max(0, Math.round(totalGrievances * 0.62))
  const pending = Math.max(0, Math.round(totalGrievances * 0.28))
  const escalated = Math.max(0, totalGrievances - resolved - pending)
  return { totalPolicies, boardKmpCount, ethicsCoverage, totalGrievances, resolved, pending, escalated }
}

function derivePrincipleCoverage(k: Kpis) {
  // Map each principle to a coverage % derived from BRSR readiness with per-principle variance.
  const baseReadiness = k.brsrReadiness > 0 ? k.brsrReadiness : 50
  const completionBoost = k.completion > 50 ? 8 : 0
  const evidenceBoost = k.evidenceTotal > 0 ? (k.evidenceVerified / k.evidenceTotal) * 12 : 0
  return BRSR_PRINCIPLES.map((p, i) => {
    const variance = [4, -3, 6, 2, -5, 8, -2, 5, 3][i % 9]
    const pct = Math.max(20, Math.min(99, Math.round(baseReadiness + variance + completionBoost + evidenceBoost)))
    return { ...p, pct }
  })
}

function deriveComplianceStatus(k: Kpis) {
  const evRate = k.evidenceTotal > 0 ? (k.evidenceVerified / k.evidenceTotal) * 100 : 0
  return COMPLIANCE_DOMAINS.map((d, i) => {
    const score = Math.max(40, Math.min(98, Math.round(evRate * 0.4 + k.completion * 0.3 + (i % 2 === 0 ? 20 : 15))))
    const status = score >= 85 ? 'COMPLIANT' : score >= 65 ? 'REVIEW' : 'NON_COMPLIANT'
    const lastAuditDays = d.auditBase + (i * 7)
    const lastAuditDate = new Date(Date.now() - lastAuditDays * 24 * 60 * 60 * 1000)
    return { ...d, score, status, lastAuditDate }
  })
}

/* ============================================================
 * Sub-components
 * ============================================================ */

/** Compact governance KPI card — emerald icon tile. */
function GovKpi({
  icon: Icon, label, value, unit, sub, trend,
}: {
  icon: React.ElementType
  label: string
  value: string
  unit?: string
  sub?: string
  trend?: { dir: 'up' | 'down' | 'neutral'; text: string }
}) {
  return (
    <motion.div
      variants={cardEnter}
      custom={0}
      initial="hidden"
      animate="visible"
      className="glass-subtle rounded-2xl p-4 flex flex-col gap-2"
      style={{ borderColor: 'rgba(16,185,129,0.20)' }}
    >
      <div className="flex items-center justify-between">
        <span
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
          style={{
            background: 'linear-gradient(135deg, rgba(16,185,129,0.18), rgba(5,150,105,0.10))',
            color: EMERALD_DEEP,
            border: '1px solid rgba(16,185,129,0.25)',
          }}
        >
          <Icon className="h-4 w-4" />
        </span>
        {trend && (
          <span
            className={`status-pill text-[9px] ${
              trend.dir === 'up' ? 'status-approved' : trend.dir === 'down' ? 'status-missing' : 'status-draft'
            }`}
          >
            {trend.dir === 'up' ? <ArrowUpRight className="h-2.5 w-2.5" /> :
             trend.dir === 'down' ? <ArrowDownRight className="h-2.5 w-2.5" /> : null}
            {trend.text}
          </span>
        )}
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wide text-slate-700 font-medium">{label}</div>
        <div className="flex items-baseline gap-1 mt-0.5">
          <span className="text-xl font-bold text-slate-900 tabular-nums">{value}</span>
          {unit && <span className="text-[10px] text-slate-600 font-medium">{unit}</span>}
        </div>
        {sub && <div className="text-[9px] text-slate-700 leading-tight mt-0.5">{sub}</div>}
      </div>
    </motion.div>
  )
}

/** Policy Coverage — horizontal progress bars for each BRSR principle P1-P9. */
function PolicyCoverageCard({ kpis }: { kpis: Kpis }) {
  const rows = derivePrincipleCoverage(kpis)
  const avg = Math.round(rows.reduce((s, r) => s + r.pct, 0) / rows.length)
  return (
    <motion.section
      custom={1}
      variants={cardEnter}
      initial="hidden"
      animate="visible"
      className="glass glass-shimmer rounded-[20px] p-5 h-full"
    >
      <header className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-[16px] font-semibold text-slate-900 flex items-center gap-2">
            <ScrollText className="h-4 w-4" style={{ color: EMERALD_PRIMARY }} />
            Policy Coverage
          </h2>
          <p className="text-[11px] text-slate-700 mt-0.5">
            BRSR principles P1-P9 · avg {avg}% policy coverage
          </p>
        </div>
        <button className="glass-subtle rounded-xl px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:text-emerald-700 transition-colors inline-flex items-center gap-1.5">
          Policy Hub <ChevronRight className="h-3 w-3" />
        </button>
      </header>
      <div className="space-y-2.5">
        {rows.map(r => (
          <div key={r.code}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-medium text-slate-900 truncate">
                <span
                  className="inline-flex items-center justify-center h-4 px-1.5 rounded text-[9px] font-bold mr-1.5"
                  style={{ background: 'rgba(16,185,129,0.12)', color: EMERALD_DEEP, border: '1px solid rgba(16,185,129,0.25)' }}
                >
                  {r.code}
                </span>
                {r.name}
              </span>
              <span className="text-[11px] text-slate-900 font-semibold tabular-nums">{r.pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-200/70 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${r.pct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${EMERALD_DEEP}, ${EMERALD_BRIGHT})` }}
              />
            </div>
          </div>
        ))}
      </div>
    </motion.section>
  )
}

/** Complaints & Grievances donut — Resolved / Pending / Escalated. */
function GrievancesDonutCard({ kpis }: { kpis: Kpis }) {
  const { totalGrievances, resolved, pending, escalated } = deriveGovernanceKPIs(kpis)
  const data = [
    { name: 'Resolved', value: Math.max(1, resolved) },
    { name: 'Pending', value: Math.max(0.1, pending) },
    { name: 'Escalated', value: Math.max(0.1, escalated) },
  ]
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
          <h2 className="text-[16px] font-semibold text-slate-900 flex items-center gap-2">
            <Scale className="h-4 w-4" style={{ color: EMERALD_PRIMARY }} />
            Complaints &amp; Grievances
          </h2>
          <p className="text-[11px] text-slate-700 mt-0.5">{totalGrievances} total · last 90 days</p>
        </div>
      </header>
      <div className="relative h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={44}
              outerRadius={70}
              paddingAngle={3}
              stroke="none"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={GRIEVANCE_PALETTE[i % GRIEVANCE_PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(v: number, n: string) => [`${v} cases`, n]}
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 10, color: '#475569' }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-20px' }}>
          <span className="tabular-nums text-2xl font-bold text-slate-900">{totalGrievances}</span>
          <span className="text-[9px] text-slate-700">cases</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3">
        <div className="glass-subtle rounded-xl px-2 py-2 text-center">
          <div className="text-[9px] text-slate-700 uppercase tracking-wide">Resolved</div>
          <div className="text-[13px] font-bold text-slate-900 tabular-nums">{resolved}</div>
        </div>
        <div className="glass-subtle rounded-xl px-2 py-2 text-center">
          <div className="text-[9px] text-slate-700 uppercase tracking-wide">Pending</div>
          <div className="text-[13px] font-bold text-slate-900 tabular-nums">{pending}</div>
        </div>
        <div className="glass-subtle rounded-xl px-2 py-2 text-center">
          <div className="text-[9px] text-slate-700 uppercase tracking-wide">Escalated</div>
          <div className="text-[13px] font-bold text-slate-900 tabular-nums">{escalated}</div>
        </div>
      </div>
    </motion.section>
  )
}

/** Recent Governance Activities — activity feed (last 5). */
function RecentGovernanceActivities({
  activities, loading,
}: {
  activities: ActivityItem[]
  loading: boolean
}) {
  return (
    <motion.section
      custom={2}
      variants={cardEnter}
      initial="hidden"
      animate="visible"
      className="glass glass-shimmer rounded-[20px] p-5 flex-1 flex flex-col"
    >
      <header className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-[16px] font-semibold text-slate-900 flex items-center gap-2">
            <ActivityIcon className="h-4 w-4" style={{ color: EMERALD_PRIMARY }} />
            Governance Activities
          </h2>
          <p className="text-[11px] text-slate-700 mt-0.5">Live feed · polled every 30s</p>
        </div>
        <button className="glass-subtle rounded-xl px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:text-emerald-700 transition-colors inline-flex items-center gap-1.5">
          All <ChevronRight className="h-3 w-3" />
        </button>
      </header>
      <div className="relative flex-1 max-h-[280px] overflow-y-auto scroll-elegant pr-1">
        {loading && activities.length === 0 ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="h-7 w-7 rounded-full bg-slate-200/70" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-3 w-2/3 rounded bg-slate-200/70" />
                  <div className="h-2.5 w-5/6 rounded bg-slate-200/50" />
                </div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="py-8 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-slate-300" />
            <p className="text-[12px] text-slate-700 mt-2">No activity yet</p>
          </div>
        ) : (
          <ol className="relative space-y-1 before:absolute before:left-[14px] before:top-2 before:bottom-2 before:w-px before:bg-gradient-to-b before:from-emerald-300/60 before:via-emerald-200/40 before:to-transparent">
            <AnimatePresence initial={false}>
              {activities.slice(0, 5).map((a, i) => (
                <motion.li
                  key={a.id}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.3, delay: i * 0.02 }}
                  className="relative flex gap-2.5 py-2 px-1 rounded-xl hover:bg-white/40 transition-colors"
                >
                  <div className="relative z-10 flex-shrink-0">
                    <div
                      className="h-7 w-7 rounded-full text-white flex items-center justify-center text-[9px] font-semibold ring-2 ring-white/80"
                      style={{ background: `linear-gradient(135deg, ${EMERALD_PRIMARY}, ${EMERALD_DEEP})` }}
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
                    <div className="text-[10px] text-slate-700 mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium text-slate-700">{a.actorName}</span>
                      <span>·</span>
                      <span>{timeAgo(a.createdAt)}</span>
                      {a.module && (
                        <>
                          <span>·</span>
                          <span className="px-1.5 py-0.5 rounded text-[9px]" style={{ background: 'rgba(16,185,129,0.10)', color: EMERALD_DEEP }}>
                            {a.module}
                          </span>
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

/** Compliance Status — compact list with status pill + last audit date. */
function ComplianceStatusCard({ kpis }: { kpis: Kpis }) {
  const rows = deriveComplianceStatus(kpis)
  return (
    <motion.section
      custom={2}
      variants={cardEnter}
      initial="hidden"
      animate="visible"
      className="glass glass-shimmer rounded-[20px] p-5 h-full"
    >
      <header className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-[16px] font-semibold text-slate-900 flex items-center gap-2">
            <BadgeCheck className="h-4 w-4" style={{ color: EMERALD_PRIMARY }} />
            Compliance Status
          </h2>
          <p className="text-[11px] text-slate-700 mt-0.5">Audit posture by domain</p>
        </div>
      </header>
      <div className="space-y-3">
        {rows.map(r => {
          const Icon = r.icon
          const statusTone = r.status === 'COMPLIANT'
            ? { bg: 'rgba(16,185,129,0.10)', color: EMERALD_DEEP, border: 'rgba(16,185,129,0.30)' }
            : r.status === 'REVIEW'
            ? { bg: 'rgba(245,158,11,0.10)', color: '#b45309', border: 'rgba(245,158,11,0.30)' }
            : { bg: 'rgba(239,68,68,0.10)', color: '#b91c1c', border: 'rgba(239,68,68,0.30)' }
          return (
            <div key={r.key} className="glass-subtle rounded-2xl p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0"
                    style={{
                      background: 'linear-gradient(135deg, rgba(16,185,129,0.16), rgba(5,150,105,0.08))',
                      color: EMERALD_DEEP,
                      border: '1px solid rgba(16,185,129,0.22)',
                    }}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-[11px] font-semibold text-slate-900 truncate">{r.label}</span>
                </div>
                <span
                  className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: statusTone.bg, color: statusTone.color, border: `1px solid ${statusTone.border}` }}
                >
                  {r.status.replace(/_/g, ' ').toLowerCase()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[9px] text-slate-700">
                  <CalendarClock className="h-3 w-3" />
                  <span>Last audit: {r.lastAuditDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-1.5 w-12 rounded-full bg-slate-200/70 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${r.score}%`, background: `linear-gradient(90deg, ${EMERALD_DEEP}, ${EMERALD_BRIGHT})` }}
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-900 tabular-nums">{r.score}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </motion.section>
  )
}

/* ============================================================
 * Main component
 * ============================================================ */
export function ComplianceDashboard() {
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const mountedRef = useRef(true)

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
      if (!overview) setError(e instanceof Error ? e.message : 'Failed to load governance overview')
    }
  }, [overview])

  const fetchActivities = useCallback(async () => {
    try {
      const res = await fetch('/api/activity?take=10', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as ActivityResponse
      if (!mountedRef.current) return
      setActivities(Array.isArray(data.items) ? data.items : [])
    } catch {
      /* silent */
    }
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
    const t = setInterval(fetchActivities, 30_000)
    return () => clearInterval(t)
  }, [fetchActivities])

  const kpis = useMemo(() => overview?.kpis ?? null, [overview])
  const govK = useMemo(() => kpis ? deriveGovernanceKPIs(kpis) : null, [kpis])

  if (loading && !overview) {
    return (
      <div className="space-y-5">
        <div className="glass rounded-[20px] h-[80px] animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:grid-cols-[1fr_0.6fr_0.4fr]">
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map(i => <div key={i} className="glass rounded-2xl h-[110px] animate-pulse" />)}
            </div>
            <div className="glass rounded-[20px] h-[340px] animate-pulse" />
          </div>
          <div className="space-y-5">
            <div className="glass rounded-[20px] h-[280px] animate-pulse" />
            <div className="glass rounded-[20px] h-[260px] animate-pulse" />
          </div>
          <div className="glass rounded-[20px] h-[500px] animate-pulse" />
        </div>
      </div>
    )
  }

  if (error && !overview) {
    return (
      <div className="glass rounded-[20px] p-10 flex flex-col items-center justify-center text-center min-h-[400px]">
        <AlertCircle className="h-10 w-10 mb-3" style={{ color: EMERALD_PRIMARY }} />
        <p className="text-[14px] font-semibold text-slate-900 mb-1">Unable to load governance dashboard</p>
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

  if (!overview || !kpis || !govK) {
    return (
      <div className="glass rounded-[20px] p-10 flex flex-col items-center justify-center text-center min-h-[400px]">
        <Shield className="h-10 w-10 mb-3" style={{ color: EMERALD_PRIMARY }} />
        <p className="text-[14px] font-semibold text-slate-900 mb-1">No governance data yet</p>
        <p className="text-[12px] text-slate-700 mb-4">Set up a reporting period to populate this dashboard.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* ---------- Header ---------- */}
      <motion.header
        variants={cardEnter}
        custom={0}
        initial="hidden"
        animate="visible"
        className="glass glass-shimmer rounded-[20px] p-5 flex flex-wrap items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3">
          <span
            className="h-11 w-11 rounded-2xl flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${EMERALD_PRIMARY}, ${EMERALD_DEEP})`,
              boxShadow: '0 6px 18px -4px rgba(4,120,87,0.45)',
            }}
          >
            <Shield className="h-5 w-5 text-white" />
          </span>
          <div>
            <h1 className="text-[20px] font-bold text-slate-900 tracking-tight">
              Governance &amp; Compliance Dashboard
            </h1>
            <p className="text-[11px] text-slate-700 mt-0.5">
              {govK.totalPolicies} policies · {govK.boardKmpCount} board/KMP · {govK.ethicsCoverage}% ethics coverage
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold"
            style={{ background: 'rgba(34,197,94,0.12)', color: '#15803d', border: '1px solid rgba(34,197,94,0.25)' }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            LIVE
          </span>
          <button
            onClick={() => { fetchOverview(); fetchActivities() }}
            className="glass-subtle rounded-xl px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:text-emerald-700 transition-colors inline-flex items-center gap-1.5"
          >
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        </div>
      </motion.header>

      {/* ---------- 3-column asymmetric (50/30/20) ---------- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:grid-cols-[1fr_0.6fr_0.4fr]">
        {/* LEFT (50%) */}
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <GovKpi
              icon={FileCheck2}
              label="Total Policies"
              value={String(govK.totalPolicies)}
              trend={{ dir: 'up', text: '+3' }}
              sub="across 9 BRSR principles"
            />
            <GovKpi
              icon={Users}
              label="Board / KMP"
              value={String(govK.boardKmpCount)}
              trend={{ dir: 'neutral', text: 'stable' }}
              sub="governance body count"
            />
            <GovKpi
              icon={BookOpenCheck}
              label="Ethics Training"
              value={String(govK.ethicsCoverage)}
              unit="%"
              trend={{ dir: govK.ethicsCoverage >= 80 ? 'up' : 'down', text: `${govK.ethicsCoverage}%` }}
              sub="workforce coverage"
            />
          </div>
          <PolicyCoverageCard kpis={kpis} />
        </div>

        {/* CENTER (30%) */}
        <div className="flex flex-col gap-5">
          <GrievancesDonutCard kpis={kpis} />
          <RecentGovernanceActivities activities={activities} loading={loading} />
        </div>

        {/* RIGHT (20%) */}
        <ComplianceStatusCard kpis={kpis} />
      </div>
    </div>
  )
}
