'use client'
/**
 * HrWorkspace — MEIL ESG / BRSR Reporting Platform
 *
 * Dedicated, Non-Duplicate HR Data Contributor Workspace:
 * - Console Overview (Key Metrics, Assignments, Quick Navigation)
 * - 1. Workforce Demographics & Census (Headcount, Categories, Hiring & Turnover, Contractor Workforce)
 * - 2. Diversity, Inclusion & PwD (Differently Abled census, Gender representation across hierarchy, Affirmative action, Site accessibility)
 * - 3. Learning & Skill Development (BRSR P3 E8 training coverage matrix, batch register, person-hours calculation)
 * - 4. Performance & Career Appraisals (BRSR P3 E11 review matrix for employees & workers, appraisal governance)
 * - 5. Compensation & Benefits (Welfare benefits coverage, remuneration equity, occupational safety coordination, statutory challans)
 * - 6. Workplace Grievance & POSH Redressal (Dispute categories, SLA turnaround, statutory POSH Act Sec 21 register)
 * - 7. Human Rights & Fair Labour Audits (BRSR Principle 5 due diligence: child/forced labour prohibition, camp audits, wage compliance)
 * - Evidence Vault (Live attachment system)
 * - Submissions Review Queue
 * - Realtime Activity Log
 */
import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, UserRound, GraduationCap, HeartPulse, Scale, ShieldCheck,
  CheckCircle2, Clock, AlertTriangle, ArrowRight, Save, Send, Upload,
  RefreshCw, Sparkles, Filter, Eye, Edit3, ChevronRight, Layers, FileText,
  TrendingUp, Building2, UserPlus, FileCheck2, History, Download, X, Check,
  Award, HeartHandshake, ShieldAlert, BarChart3, LayoutDashboard, Link2
} from 'lucide-react'
import { useApp } from '@/components/site-ops/context'
import { saveRoleDraftToApi } from './common-validation-modal'
import {
  contributorStore,
  type ContributorAssignment,
  type ActivityEvent
} from '@/lib/so/contributor-store'
import { CommonLevel0Card } from './common-level0-card'
import { CommonValidationModal } from './common-validation-modal'
import { EvidenceUploadSection, FullscreenEvidenceModal } from '@/components/shared/data-entry/evidence'
import type { EvidenceItem } from '@/components/shared/data-entry/core'
import { toast } from 'sonner'
import { FinalSubmitAllModal, SubmitAllSuccessModal } from '@/components/shared/submission-flow-modals'

/* Sidebar module → default workspace tab */
const MODULE_TABS: Record<string, string> = {
  overview: 'overview',
  'hr-workforce': 'screen-workforce',
  'hr-diversity': 'screen-diversity',
  'hr-learning': 'screen-learning',
  'hr-performance': 'screen-performance',
  'hr-compensation': 'screen-compensation',
  'hr-grievances': 'screen-grievances',
  'hr-human-rights': 'screen-human-rights',
  'hr-training': 'screen-learning',      // legacy keys route cleanly
  'hr-wellbeing': 'screen-compensation', // legacy keys route cleanly
  'hr-rights': 'screen-human-rights',    // legacy keys route cleanly
  evidence: 'evidence',
  submissions: 'submissions',
  activity: 'activity',
}

export function HrWorkspace() {
  const { activeModule, setActiveModule, selectedProjectId } = useApp()
  const [activeTab, setActiveTab] = useState<string>(() => MODULE_TABS[activeModule] ?? 'overview')
  const [hrData, setHrData] = useState(() => contributorStore.getHrData())
  const [assignments, setAssignments] = useState<ContributorAssignment[]>(() => contributorStore.getAssignments('HR_USER'))
  const [activities, setActivities] = useState<ActivityEvent[]>(() => contributorStore.getActivities('HR_USER'))
  const [saveStatus, setSaveStatus] = useState<string>('Saved')
  const [showValidationModal, setShowValidationModal] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  /* Evidence vault + submission systems */
  const [evidenceItems, setEvidenceItems] = useState<EvidenceItem[]>([])
  const [reviewEvidence, setReviewEvidence] = useState<EvidenceItem | null>(null)
  const [realSubmissions, setRealSubmissions] = useState<any[]>([])
  const [realSubmissionsLoading, setRealSubmissionsLoading] = useState(false)
  const [realActivities, setRealActivities] = useState<any[]>([])

  const refreshEvidence = async () => {
    try {
      const res = await fetch(`/api/so/evidence?projectId=${encodeURIComponent(selectedProjectId || '')}`)
      const d = await res.json().catch(() => null)
      setEvidenceItems(Array.isArray(d?.items) ? d.items : [])
    } catch {
      setEvidenceItems([])
    }
  }

  const refreshRealSubmissions = async () => {
    setRealSubmissionsLoading(true)
    try {
      const res = await fetch('/api/so/submissions?take=100&bypass=true')
      const d = await res.json().catch(() => null)
      const rows: any[] = Array.isArray(d?.items) ? d.items : []
      setRealSubmissions(rows.filter((r) => r.category === 'WORKFORCE' || r.module === 'WORKFORCE' || r.category === 'HR' || r.module === 'HR'))
    } catch {
      setRealSubmissions([])
    } finally {
      setRealSubmissionsLoading(false)
    }
  }

  const fetchRealActivities = async () => {
    try {
      const res = await fetch('/api/so/activity?take=50&bypass=true')
      const d = await res.json().catch(() => null)
      setRealActivities(Array.isArray(d?.items) ? d.items : [])
    } catch {
      /* keep last known feed */
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect -- ENV-pattern mount hydration + realtime polling */
  useEffect(() => {
    refreshEvidence()
    refreshRealSubmissions()
    fetchRealActivities()
    const iv = setInterval(() => {
      fetchRealActivities()
      refreshRealSubmissions()
    }, 15000)
    return () => clearInterval(iv)
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  /* Follow sidebar module transitions */
  const [prevModule, setPrevModule] = useState(activeModule)
  if (prevModule !== activeModule) {
    setPrevModule(activeModule)
    const mapped = MODULE_TABS[activeModule]
    if (mapped) setActiveTab(mapped)
  }

  /* Phase 3 — contractor verification, POSH statutory fields & audit references */
  const storedExtras = (hrData as any) || {}
  const [contractor, setContractor] = useState<any>(() => storedExtras.contractor ?? {
    contractorLicenseRef: 'CL-TS-2026-4412',
    minimumWagesCompliance: '100% Compliant',
    challanVerificationStatus: 'Verified',
  })
  const [posh, setPosh] = useState<any>(() => storedExtras.posh ?? {
    poshReceived: 0,
    poshDisposed: 0,
    poshPendingOver90Days: 0,
    poshReportRef: 'IC-AR-2026-014',
  })
  const [auditRefs, setAuditRefs] = useState<any>(() => storedExtras.auditRefs ?? {
    epfoChallanRef: 'TRRN-2026-0707-114',
    esicChallanRef: 'ESIC-31000-2026-06',
    insurancePolicyId: 'MEIL-GMC-2026-0091',
  })

  const triggerToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const handleSaveDraft = (levelLabel: string) => {
    setSaveStatus('Saving...')
    contributorStore.saveHrData({ ...hrData, contractor, posh, auditRefs } as any)
    saveRoleDraftToApi('HR_USER', selectedProjectId).catch((e) => triggerToast(e?.message || 'Draft sync failed'))
    setTimeout(() => {
      setSaveStatus('Draft Saved')
      triggerToast(`${levelLabel} draft saved successfully.`)
      contributorStore.addActivity({
        id: 'act-' + Date.now(),
        roleKey: 'HR_USER',
        timestamp: 'Just now',
        user: 'Sunil Kumar (HR)',
        action: 'Saved Draft',
        target: levelLabel,
        details: 'Draft updated and persisted to local enterprise store.',
        badgeTone: 'blue'
      })
      setActivities(contributorStore.getActivities('HR_USER'))
      setTimeout(() => setSaveStatus('Saved'), 2000)
    }, 400)
  }

  // Live calculations
  const totalPermanent = (Number(hrData.workforceProfile.permanentEmployees) || 0) + (Number(hrData.workforceProfile.permanentWorkers) || 0)
  const totalOther = (Number(hrData.workforceProfile.otherEmployees) || 0) + (Number(hrData.workforceProfile.otherWorkers) || 0)
  const totalWorkforce = totalPermanent + totalOther
  const totalGender = (Number(hrData.workforceProfile.maleCount) || 0) + (Number(hrData.workforceProfile.femaleCount) || 0) + (Number(hrData.workforceProfile.otherGenderCount) || 0)
  const femaleRatio = totalWorkforce > 0 ? (((Number(hrData.workforceProfile.femaleCount) || 0) / totalWorkforce) * 100).toFixed(1) : '0'

  // Turnover calculation
  const meanHeadcount = ((Number(hrData.turnover.openingHeadcount) || 0) + (Number(hrData.turnover.closingHeadcount) || 0)) / 2
  const calcTurnoverPct = meanHeadcount > 0 ? (((Number(hrData.turnover.leavingCount) || 0) / meanHeadcount) * 100).toFixed(2) : '0'

  // Review percentage
  const calcReviewPct = (Number(hrData.reviews.totalEligiblePopulation) || 0) > 0
    ? (((Number(hrData.reviews.numberReviewed) || 0) / (Number(hrData.reviews.totalEligiblePopulation) || 1)) * 100).toFixed(1)
    : '0'

  // Benefit coverage
  const calcBenefitPct = (Number(hrData.benefits.eligiblePopulation) || 0) > 0
    ? (((Number(hrData.benefits.beneficiariesCount) || 0) / (Number(hrData.benefits.eligiblePopulation) || 1)) * 100).toFixed(1)
    : '0'

  // Differently Abled (PwD) Calculations
  const totalPwDCount = (Number(hrData.diversity.pwdPermanentEmployeesMale) || 0) +
    (Number(hrData.diversity.pwdPermanentEmployeesFemale) || 0) +
    (Number(hrData.diversity.pwdOtherEmployeesCount) || 0) +
    (Number(hrData.diversity.pwdPermanentWorkersMale) || 0) +
    (Number(hrData.diversity.pwdPermanentWorkersFemale) || 0) +
    (Number(hrData.diversity.pwdOtherWorkersCount) || 0)
  const calcPwDPct = totalWorkforce > 0 ? ((totalPwDCount / totalWorkforce) * 100).toFixed(2) : '0'

  // Training Calculations
  const trainingCompletionRate = (Number(hrData.training.participants) || 0) > 0
    ? (((Number(hrData.training.participantsCompleting) || 0) / (Number(hrData.training.participants) || 1)) * 100).toFixed(1)
    : '0'
  const calcPersonHours = (Number(hrData.training.durationHours) || 0) * (Number(hrData.training.participantsCompleting) || 0)

  // Top navigation pill items
  /* Top pill strip — data-entry screens only (Console/Evidence/Submissions/Activity
     live in the left navbar, per the contributor's request). */
  const tabList = [
    { id: 'screen-workforce', label: 'Workforce Census', icon: Users },
    { id: 'screen-diversity', label: 'Diversity & Inclusion', icon: Sparkles },
    { id: 'screen-learning', label: 'Learning & Skills', icon: GraduationCap },
    { id: 'screen-performance', label: 'Performance Appraisals', icon: Award },
    { id: 'screen-compensation', label: 'Compensation & Benefits', icon: HeartPulse },
    { id: 'screen-grievances', label: 'Grievances & POSH', icon: Scale },
    { id: 'screen-human-rights', label: 'Human Rights', icon: ShieldCheck },
  ]

  /* ── Level journey state — level-by-level drafts → Final Review & Submit ── */
  const JOURNEY_LEVELS: Array<{ id: string; label: string; level: number; levelName: string; dataKey: string }> = [
    { id: 'screen-workforce', label: 'Workforce Census', level: 1, levelName: 'Workforce Census (HR-1)', dataKey: 'workforceProfile' },
    { id: 'screen-diversity', label: 'Diversity & PwD', level: 2, levelName: 'Diversity & Representation (HR-2)', dataKey: 'diversity' },
    { id: 'screen-learning', label: 'Learning & Skills', level: 3, levelName: 'Training & Skill Development (HR-4)', dataKey: 'training' },
    { id: 'screen-performance', label: 'Performance Reviews', level: 4, levelName: 'Performance Appraisals (HR-5)', dataKey: 'reviews' },
    { id: 'screen-compensation', label: 'Compensation & Benefits', level: 5, levelName: 'Compensation, Benefits & Wellbeing (HR-6/7/9)', dataKey: 'benefits' },
    { id: 'screen-grievances', label: 'Grievances & POSH', level: 6, levelName: 'Grievance Redressal & POSH (HR-8)', dataKey: 'grievances' },
    { id: 'screen-human-rights', label: 'Human Rights', level: 7, levelName: 'Human Rights & Fair Labour Audits (Principle 5)', dataKey: 'humanRights' },
  ]

  const [journeyOpen, setJourneyOpen] = useState(false)
  const [levelDrafts, setLevelDrafts] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('hr-level-drafts') || '{}') } catch { return {} }
  })
  const [levelSubmitted, setLevelSubmitted] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('hr-level-submitted') || '{}') } catch { return {} }
  })
  const [levelSubmitting, setLevelSubmitting] = useState<string | null>(null)
  const [showFinalReview, setShowFinalReview] = useState(false)
  const [submittingAll, setSubmittingAll] = useState(false)
  const [showSubmitSuccess, setShowSubmitSuccess] = useState(false)

  const persistJourney = (drafts: Record<string, boolean>, submitted: Record<string, boolean>) => {
    try {
      localStorage.setItem('hr-level-drafts', JSON.stringify(drafts))
      localStorage.setItem('hr-level-submitted', JSON.stringify(submitted))
    } catch {}
  }

  const markLevelDrafted = (id: string) => {
    const d = { ...levelDrafts, [id]: true }
    setLevelDrafts(d)
    persistJourney(d, levelSubmitted)
  }

  /* Per-level "Submit to Project Admin" — submits THAT level's data individually. */
  const handleLevelSubmit = async (screenId: string) => {
    const def = JOURNEY_LEVELS.find(l => l.id === screenId)
    if (!def || levelSubmitting) return
    setLevelSubmitting(screenId)
    try {
      const post = await fetch('/api/so/data-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: def.level,
          levelKey: 'level' + def.level,
          levelName: def.levelName,
          module: 'WORKFORCE',
          data: {
            levelData: (hrData as any)[def.dataKey] ?? {},
            remarks: 'Individual level submission from HR Contributor Workspace.',
          },
          submitForReview: true,
        }),
      })
      if (!post.ok) {
        const err = await post.json().catch(() => ({}))
        toast.error('Submission failed', { description: (err as any)?.error || 'Server responded ' + post.status })
        return
      }
      const d = { ...levelDrafts, [screenId]: true }
      const s = { ...levelSubmitted, [screenId]: true }
      setLevelDrafts(d)
      setLevelSubmitted(s)
      persistJourney(d, s)
      contributorStore.addActivity({
        id: 'act-' + Date.now(),
        roleKey: 'HR_USER',
        timestamp: 'Just now',
        user: 'Sunita Rao (HR)',
        action: 'Submitted',
        target: def.levelName,
        details: 'Level submitted individually to the Project Admin.',
        badgeTone: 'green'
      })
      setActivities(contributorStore.getActivities('HR_USER'))
      refreshRealSubmissions()
      toast.success(def.levelName + ' submitted to Project Admin')
    } catch (e: any) {
      toast.error('Submission failed', { description: e?.message || 'Network error.' })
    } finally {
      setLevelSubmitting(null)
    }
  }

  /* Consolidated final submit — from the FinalSubmitAllModal. */
  const handleFinalSubmit = async (): Promise<boolean> => {
    setSubmittingAll(true)
    try {
      const post = await fetch('/api/so/data-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 6,
          levelKey: 'level6',
          levelName: 'BRSR Workforce & Human Rights Package (All Levels)',
          module: 'WORKFORCE',
          data: {
            workforceCensus: hrData.workforceProfile,
            diversity: hrData.diversity,
            trainingLog: hrData.training,
            performanceReviews: hrData.reviews,
            statutoryBenefits: hrData.benefits,
            wagesRemuneration: hrData.wages,
            grievanceRegister: hrData.grievances,
            safetyCoordination: hrData.safetyCoord,
            humanRights: hrData.humanRights,
            contractorVerification: contractor,
            poshStatutory: posh,
            auditReferences: auditRefs,
            remarks: 'Final consolidated submission from HR Contributor Workspace — all levels.',
          },
          submitForReview: true,
        }),
      })
      if (!post.ok) {
        const err = await post.json().catch(() => ({}))
        toast.error('Final submission failed', { description: (err as any)?.error || 'Server responded ' + post.status })
        return false
      }
      const d = { ...levelDrafts }
      const s = { ...levelSubmitted }
      for (const l of JOURNEY_LEVELS) { d[l.id] = true; s[l.id] = true }
      setLevelDrafts(d)
      setLevelSubmitted(s)
      persistJourney(d, s)
      contributorStore.addActivity({
        id: 'act-' + Date.now(),
        roleKey: 'HR_USER',
        timestamp: 'Just now',
        user: 'Sunita Rao (HR)',
        action: 'Submitted',
        target: 'BRSR Workforce & Human Rights Package',
        details: 'Final consolidated package submitted to the Project Admin.',
        badgeTone: 'green'
      })
      setActivities(contributorStore.getActivities('HR_USER'))
      refreshRealSubmissions()
      setShowFinalReview(false)
      setShowSubmitSuccess(true)
      return true
    } catch (e: any) {
      toast.error('Final submission failed', { description: e?.message || 'Network error.' })
      return false
    } finally {
      setSubmittingAll(false)
    }
  }

  /* allData for the shared FinalSubmitAllModal — ENV-style keyed structure. */
  const hrAllData: Record<string, any> = {
    [`l1-${selectedProjectId}-current`]: { items: [{ id: 'hr-1', title: 'Workforce Census', ...hrData.workforceProfile }] },
    [`l2-${selectedProjectId}-current`]: { items: [{ id: 'hr-2', title: 'Diversity & PwD', ...hrData.diversity }] },
    [`l3-${selectedProjectId}-current`]: { items: [{ id: 'hr-4', title: 'Training & Skills', ...hrData.training }] },
    [`l4-${selectedProjectId}-current`]: { items: [{ id: 'hr-5', title: 'Performance Appraisals', ...hrData.reviews }] },
    [`l5-${selectedProjectId}-current`]: { items: [{ id: 'hr-6', title: 'Compensation & Benefits', ...hrData.benefits }] },
    [`l6-${selectedProjectId}-current`]: { items: [{ id: 'hr-8', title: 'Grievances & POSH', ...hrData.grievances, ...posh }] },
    [`l7-${selectedProjectId}-current`]: { items: [{ id: 'hr-human-rights', title: 'Human Rights', ...hrData.humanRights }] },
  }

  const hrModalLevels = JOURNEY_LEVELS.map(l => ({
    key: l.id, level: l.level, label: l.label, icon: l.id === 'screen-workforce' ? Users : l.id === 'screen-diversity' ? Sparkles : l.id === 'screen-learning' ? GraduationCap : l.id === 'screen-performance' ? Award : l.id === 'screen-compensation' ? HeartPulse : l.id === 'screen-grievances' ? Scale : ShieldCheck,
  }))

  return (
    <div className="space-y-6 pb-16">
      {/* Toast notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-50 flex items-center gap-2 rounded-2xl border border-teal-200 bg-white/95 px-4 py-3 shadow-xl shadow-teal-500/10 backdrop-blur-xl text-xs font-bold text-teal-800"
          >
            <CheckCircle2 className="h-4 w-4 text-teal-600" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER SECTION WITH LIQUID GLASS CHROME */}
      <div className="relative overflow-hidden rounded-[26px] border border-white/80 bg-gradient-to-br from-white/90 via-sky-50/40 to-teal-50/50 p-6 md:p-8 shadow-[0_12px_36px_-6px_rgba(13,148,136,0.12)] backdrop-blur-2xl">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/80 to-transparent" />
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-md shadow-teal-500/25">
                <Users className="h-6 w-6" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
                HR Data Contributor Workspace
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50/80 px-3 py-1 text-xs font-bold text-teal-700 shadow-xs">
                <Sparkles className="h-3 w-3 text-teal-600" />
                BRSR Principle 3 & 5
              </span>
            </div>
            <p className="text-sm font-medium text-slate-500">
              Workforce census · Diversity & Inclusion · L&D Skills · Performance Reviews · Grievances & POSH · Human Rights
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <span className="rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-xs font-bold text-slate-700 shadow-xs backdrop-blur-md">
              FY 2026-27 (Assigned)
            </span>
          </div>
        </div>

        {/* LIQUID GLASS SEGMENTED NAVIGATION BAR */}
        <div className="relative z-10 mt-6 pt-5 border-t border-slate-200/60 overflow-x-auto no-scrollbar">
          <div className="inline-flex items-center gap-1.5 rounded-2xl border border-white/80 bg-white/70 p-1.5 backdrop-blur-xl shadow-xs">
            {tabList.map((tab) => {
              const TabIcon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-md shadow-teal-500/25 scale-[1.01]'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                  }`}
                >
                  <TabIcon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          1. CONSOLE OVERVIEW (SCREEN 1)
          ───────────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* 6 Dashboard Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
            {[
              { label: 'Assigned HR Tasks', val: '7 Modules', sub: 'FY 2026-27', icon: Layers, tone: 'text-teal-600 bg-teal-50' },
              { label: 'Pending Data Entry', val: '2 Forms', sub: 'Turnover & Coord', icon: Clock, tone: 'text-amber-600 bg-amber-50' },
              { label: 'Submitted Records', val: '1 Level', sub: 'Under Project Admin Review', icon: CheckCircle2, tone: 'text-blue-600 bg-blue-50' },
              { label: 'Returned for Fix', val: '0 Records', sub: 'All audits clean', icon: AlertTriangle, tone: 'text-rose-600 bg-rose-50' },
              { label: 'Workforce Completion', val: '86.4%', sub: 'Target: 100%', icon: TrendingUp, tone: 'text-emerald-600 bg-emerald-50' },
              { label: 'Evidence Attached', val: '5 / 7 Files', sub: '2 uploads remaining', icon: FileCheck2, tone: 'text-purple-600 bg-purple-50' },
            ].map((card, i) => (
              <div key={i} className="rounded-[22px] border border-white/70 bg-white/80 p-4 shadow-lg shadow-sky-500/5 backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500">{card.label}</span>
                  <div className={`p-1.5 rounded-lg ${card.tone}`}>
                    <card.icon className="h-3.5 w-3.5" />
                  </div>
                </div>
                <div className="mt-2 text-lg font-black text-slate-900">{card.val}</div>
                <div className="text-[11px] text-slate-400 font-medium">{card.sub}</div>
              </div>
            ))}
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-[24px] border border-white/70 bg-white/80 p-5 shadow-lg shadow-sky-500/5 backdrop-blur-xl">
              <span className="text-xs font-bold text-slate-500">Total Workforce Aggregate</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">{totalWorkforce.toLocaleString()}</span>
                <span className="text-xs font-semibold text-teal-600">Reconciled Headcount</span>
              </div>
              <div className="mt-3 text-xs text-slate-500 space-y-1">
                <div className="flex justify-between">
                  <span>Permanent Employees:</span>
                  <span className="font-bold text-slate-800">{Number(hrData.workforceProfile.permanentEmployees).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Permanent Workers:</span>
                  <span className="font-bold text-slate-800">{Number(hrData.workforceProfile.permanentWorkers).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Female Share:</span>
                  <span className="font-bold text-teal-700">{femaleRatio}%</span>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/70 bg-white/80 p-5 shadow-lg shadow-sky-500/5 backdrop-blur-xl">
              <span className="text-xs font-bold text-slate-500">Training Completion Summary</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">{hrData.training.participantsCompleting.toLocaleString()}</span>
                <span className="text-xs font-semibold text-emerald-600">Trained Personnel</span>
              </div>
              <div className="mt-3 text-xs text-slate-500 space-y-1">
                <div className="flex justify-between">
                  <span>Total Training Hours:</span>
                  <span className="font-bold text-slate-800">{hrData.training.durationHours} hrs</span>
                </div>
                <div className="flex justify-between">
                  <span>Completion Rate:</span>
                  <span className="font-bold text-slate-800">{trainingCompletionRate}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Method:</span>
                  <span className="font-bold text-slate-800">{hrData.training.deliveryMethod}</span>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/70 bg-white/80 p-5 shadow-lg shadow-sky-500/5 backdrop-blur-xl">
              <span className="text-xs font-bold text-slate-500">Grievance &amp; Resolution Status</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">{hrData.grievances.grievancesResolved} / {hrData.grievances.grievancesReceived}</span>
                <span className="text-xs font-semibold text-emerald-600">Resolved Cases</span>
              </div>
              <div className="mt-3 text-xs text-slate-500 space-y-1">
                <div className="flex justify-between">
                  <span>Pending Complaints:</span>
                  <span className="font-bold text-rose-600">{hrData.grievances.grievancesPending}</span>
                </div>
                <div className="flex justify-between">
                  <span>POSH Status:</span>
                  <span className="font-bold text-emerald-700">0 Pending &gt; 90 Days</span>
                </div>
                <div className="flex justify-between">
                  <span>Average Turnaround:</span>
                  <span className="font-bold text-teal-700">9.4 Calendar Days</span>
                </div>
              </div>
            </div>
          </div>

          {/* My HR Assignments Table */}
          <div className="rounded-[24px] border border-white/70 bg-white/80 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">My HR Assignments</h3>
                <p className="text-xs text-slate-500">Mandatory reporting tasks assigned for current reporting period</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('screen-workforce')}
                className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1"
              >
                <span>Enter Disclosures</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                    <th className="pb-3">Level</th>
                    <th className="pb-3">Level Name</th>
                    <th className="pb-3">Category</th>
                    <th className="pb-3">Reporting Period</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Last Modified</th>
                    <th className="pb-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assignments.map((asg) => (
                    <tr key={asg.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 font-bold text-teal-700">{asg.levelKey}</td>
                      <td className="py-3 font-semibold text-slate-900">{asg.module}</td>
                      <td className="py-3 text-slate-500">{asg.entityBu}</td>
                      <td className="py-3 text-slate-500">{asg.reportingYear}</td>
                      <td className="py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          asg.submissionStatus === 'Accepted' ? 'bg-emerald-100 text-emerald-800' :
                          asg.submissionStatus === 'Under Review' ? 'bg-blue-100 text-blue-800' :
                          asg.submissionStatus === 'Returned for Correction' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {asg.submissionStatus}
                        </span>
                      </td>
                      <td className="py-3 text-slate-400">{asg.lastUpdated}</td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            if (asg.levelKey === 'HR-1' || asg.levelKey === 'HR-3') setActiveTab('screen-workforce')
                            else if (asg.levelKey === 'HR-2') setActiveTab('screen-diversity')
                            else if (asg.levelKey === 'HR-4') setActiveTab('screen-learning')
                            else if (asg.levelKey === 'HR-5') setActiveTab('screen-performance')
                            else if (asg.levelKey === 'HR-6' || asg.levelKey === 'HR-7' || asg.levelKey === 'HR-9') setActiveTab('screen-compensation')
                            else if (asg.levelKey === 'HR-8') setActiveTab('screen-grievances')
                            else setActiveTab('screen-workforce')
                          }}
                          className="rounded-lg bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-700 hover:bg-teal-100 transition-colors"
                        >
                          Open Form
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          2. SCREEN: WORKFORCE CENSUS & DEMOGRAPHICS
          ───────────────────────────────────────────────────────────── */}
      {activeTab === 'screen-workforce' && (
        <div className="space-y-6">
          {/* Per-level individual submission to Project Admin */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal-200/70 bg-teal-50/50 px-4 py-3 backdrop-blur-xl">
            <span className="text-xs font-semibold text-slate-600">
              This level&apos;s data can be submitted individually — it reaches the Project Admin instantly.
            </span>
            <button
              type="button"
              disabled={levelSubmitting === 'screen-workforce'}
              onClick={() => handleLevelSubmit('screen-workforce')}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-teal-600 to-cyan-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-teal-500/25 transition hover:from-teal-700 hover:to-cyan-700 hover:-translate-y-0.5 active:scale-95 disabled:opacity-60"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{levelSubmitting === 'screen-workforce' ? 'Submitting…' : 'Submit to Project Admin'}</span>
            </button>
          </div>
          <CommonLevel0Card
            fields={hrData.workforceProfile.common}
            accentColor="teal"
            onChange={(upd) => setHrData({
              ...hrData,
              workforceProfile: { ...hrData.workforceProfile, common: { ...hrData.workforceProfile.common, ...upd } }
            })}
          />

          {/* Level HR-1 — Workforce Demographics */}
          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title">Level HR-1 — Workforce Profile &amp; Demographics</h3>
              <p className="text-xs text-slate-500">Collect core workforce headcounts, classifications, and gender distribution required by BRSR Principle 3</p>
            </div>

            {/* Reconciliation Banner */}
            <div className={`p-4 rounded-2xl border text-xs flex flex-wrap items-center justify-between gap-3 ${
              totalWorkforce === totalGender && totalWorkforce > 0
                ? 'border-emerald-200 bg-emerald-50/60 text-emerald-900'
                : 'border-rose-200 bg-rose-50/60 text-rose-900'
            }`}>
              <div>
                <span className="font-bold">Workforce Reconciliation: </span>
                <span>Employees &amp; Workers Total: <strong className="font-bold">{totalWorkforce.toLocaleString()}</strong> | Gender Sum: <strong className="font-bold">{totalGender.toLocaleString()}</strong></span>
              </div>
              <span className={`px-2.5 py-1 rounded-full font-bold text-[11px] ${
                totalWorkforce === totalGender && totalWorkforce > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {totalWorkforce === totalGender && totalWorkforce > 0 ? 'Reconciled 100%' : 'Mismatch Detected'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="ios-label">Employee Category</label>
                <input
                  type="text"
                  value={hrData.workforceProfile.employeeCategory}
                  onChange={(e) => setHrData({
                    ...hrData,
                    workforceProfile: { ...hrData.workforceProfile, employeeCategory: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Worker Category</label>
                <input
                  type="text"
                  value={hrData.workforceProfile.workerCategory}
                  onChange={(e) => setHrData({
                    ...hrData,
                    workforceProfile: { ...hrData.workforceProfile, workerCategory: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Permanent Employees Count</label>
                <input
                  type="number"
                  value={hrData.workforceProfile.permanentEmployees}
                  onChange={(e) => setHrData({
                    ...hrData,
                    workforceProfile: { ...hrData.workforceProfile, permanentEmployees: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Permanent Workers Count</label>
                <input
                  type="number"
                  value={hrData.workforceProfile.permanentWorkers}
                  onChange={(e) => setHrData({
                    ...hrData,
                    workforceProfile: { ...hrData.workforceProfile, permanentWorkers: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Other / Contract Employees</label>
                <input
                  type="number"
                  value={hrData.workforceProfile.otherEmployees}
                  onChange={(e) => setHrData({
                    ...hrData,
                    workforceProfile: { ...hrData.workforceProfile, otherEmployees: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Other / Casual Workers</label>
                <input
                  type="number"
                  value={hrData.workforceProfile.otherWorkers}
                  onChange={(e) => setHrData({
                    ...hrData,
                    workforceProfile: { ...hrData.workforceProfile, otherWorkers: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Male Count</label>
                <input
                  type="number"
                  value={hrData.workforceProfile.maleCount}
                  onChange={(e) => setHrData({
                    ...hrData,
                    workforceProfile: { ...hrData.workforceProfile, maleCount: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Female Count</label>
                <input
                  type="number"
                  value={hrData.workforceProfile.femaleCount}
                  onChange={(e) => setHrData({
                    ...hrData,
                    workforceProfile: { ...hrData.workforceProfile, femaleCount: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Other Gender Count</label>
                <input
                  type="number"
                  value={hrData.workforceProfile.otherGenderCount}
                  onChange={(e) => setHrData({
                    ...hrData,
                    workforceProfile: { ...hrData.workforceProfile, otherGenderCount: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Workforce Source System</label>
                <input
                  type="text"
                  value={hrData.workforceProfile.workforceSourceSystem}
                  onChange={(e) => setHrData({
                    ...hrData,
                    workforceProfile: { ...hrData.workforceProfile, workforceSourceSystem: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Source Report Reference</label>
                <input
                  type="text"
                  value={hrData.workforceProfile.sourceReportReference}
                  onChange={(e) => setHrData({
                    ...hrData,
                    workforceProfile: { ...hrData.workforceProfile, sourceReportReference: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Supporting Evidence</label>
                <input
                  type="text"
                  value={hrData.workforceProfile.supportingEvidence}
                  onChange={(e) => setHrData({
                    ...hrData,
                    workforceProfile: { ...hrData.workforceProfile, supportingEvidence: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="ios-label">Remarks &amp; Data Note</label>
              <textarea
                rows={2}
                value={hrData.workforceProfile.remarks}
                onChange={(e) => setHrData({
                  ...hrData,
                  workforceProfile: { ...hrData.workforceProfile, remarks: e.target.value }
                })}
                className="ios-field !text-xs font-medium text-slate-800"
              />
            </div>
          </div>

          {/* Level HR-3 — Hiring & Turnover */}
          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title">Level HR-3 — Hiring, Turnover &amp; Retention</h3>
              <p className="text-xs text-slate-500">Calculate annual attrition and hiring additions across workforce categories</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="ios-label">Employee / Worker Category</label>
                <input
                  type="text"
                  value={hrData.turnover.category}
                  onChange={(e) => setHrData({
                    ...hrData,
                    turnover: { ...hrData.turnover, category: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Opening Headcount</label>
                <input
                  type="number"
                  value={hrData.turnover.openingHeadcount}
                  onChange={(e) => setHrData({
                    ...hrData,
                    turnover: { ...hrData.turnover, openingHeadcount: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">New Joiners</label>
                <input
                  type="number"
                  value={hrData.turnover.newJoiners}
                  onChange={(e) => setHrData({
                    ...hrData,
                    turnover: { ...hrData.turnover, newJoiners: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Employees / Workers Leaving</label>
                <input
                  type="number"
                  value={hrData.turnover.leavingCount}
                  onChange={(e) => setHrData({
                    ...hrData,
                    turnover: { ...hrData.turnover, leavingCount: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Closing Headcount</label>
                <input
                  type="number"
                  value={hrData.turnover.closingHeadcount}
                  onChange={(e) => setHrData({
                    ...hrData,
                    turnover: { ...hrData.turnover, closingHeadcount: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Turnover Calculation Method</label>
                <select
                  value={hrData.turnover.turnoverCalculationMethod}
                  onChange={(e) => setHrData({
                    ...hrData,
                    turnover: { ...hrData.turnover, turnoverCalculationMethod: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Average Headcount Formula">Average Headcount Formula</option>
                  <option value="Opening/Closing Mean">Opening/Closing Mean</option>
                  <option value="Statutory Rate">Statutory Rate</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Calculated Turnover %</label>
                <div className="ios-field !text-xs font-black text-teal-700 !bg-slate-50/70">
                  {calcTurnoverPct}%
                </div>
              </div>

              <div>
                <label className="ios-label">Source HRMS Report</label>
                <input
                  type="text"
                  value={hrData.turnover.sourceHrmsReport}
                  onChange={(e) => setHrData({
                    ...hrData,
                    turnover: { ...hrData.turnover, sourceHrmsReport: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Contractor Workforce Verification */}
          <div className="relative overflow-hidden rounded-[24px] border border-white/80 bg-gradient-to-br from-white/85 to-sky-50/65 p-5 shadow-[0_12px_36px_-6px_rgba(13,148,136,0.10)] backdrop-blur-2xl">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-white/80 to-transparent" />
            <div className="relative z-10">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-cyan-600 text-white shadow-md shadow-teal-500/25">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Contractor &amp; Sub-contractor Workforce Verification</h3>
                  <p className="text-[11px] text-slate-500">On-site infrastructure labour compliance — license, wages &amp; statutory deposits</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <label className="text-xs font-bold text-slate-700">Contractor Labour License No.</label>
                  <input
                    type="text"
                    value={contractor.contractorLicenseRef}
                    onChange={e => setContractor({ ...contractor, contractorLicenseRef: e.target.value })}
                    placeholder="e.g. CL-TS-2026-4412"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-800 outline-none backdrop-blur-md transition focus:border-teal-500 focus:ring-2 focus:ring-teal-400/40"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">Statutory Minimum Wages Verification</label>
                  <div className="mt-1 flex gap-2">
                    {['100% Compliant', 'Audit Sample Verified'].map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setContractor({ ...contractor, minimumWagesCompliance: opt })}
                        className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
                          contractor.minimumWagesCompliance === opt
                            ? 'bg-teal-600 text-white shadow-md shadow-teal-500/25'
                            : 'border border-slate-200 bg-white/80 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">Sub-contractor PF/ESI Challan Verification</label>
                  <select
                    value={contractor.challanVerificationStatus}
                    onChange={e => setContractor({ ...contractor, challanVerificationStatus: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-800 outline-none backdrop-blur-md transition focus:border-teal-500 focus:ring-2 focus:ring-teal-400/40"
                  >
                    <option value="Verified">Verified — all challans deposited</option>
                    <option value="Partially Verified">Partially Verified</option>
                    <option value="Pending">Pending Verification</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Workforce Evidence Card */}
          <div className="relative overflow-hidden rounded-[24px] border border-white/80 bg-gradient-to-br from-white/85 to-sky-50/65 p-5 shadow-[0_12px_36px_-6px_rgba(13,148,136,0.10)] backdrop-blur-2xl">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-white/80 to-transparent" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-cyan-600 text-white shadow-md shadow-teal-500/25">
                  <Upload className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Supporting Evidence — Workforce Census</h3>
                  <p className="text-[11px] text-slate-500">Attach monthly headcount registers, biometric gate extracts, and attrition logs (module: HR-WORKFORCE)</p>
                </div>
              </div>
              <EvidenceUploadSection
                projectId={selectedProjectId || null}
                periodId={null}
                moduleKey="HR-WORKFORCE"
                evidence={evidenceItems}
                onUploaded={refreshEvidence}
                onReview={(ev) => setReviewEvidence(ev)}
                selectedEvidenceId={null}
                onSelectEvidence={() => {}}
              />
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. SCREEN: DIVERSITY, EQUITY & DIFFERENTLY-ABLED (PwD)
          ───────────────────────────────────────────────────────────── */}
      {activeTab === 'screen-diversity' && (
        <div className="space-y-6">
          {/* Per-level individual submission to Project Admin */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal-200/70 bg-teal-50/50 px-4 py-3 backdrop-blur-xl">
            <span className="text-xs font-semibold text-slate-600">
              This level&apos;s data can be submitted individually — it reaches the Project Admin instantly.
            </span>
            <button
              type="button"
              disabled={levelSubmitting === 'screen-diversity'}
              onClick={() => handleLevelSubmit('screen-diversity')}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-teal-600 to-cyan-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-teal-500/25 transition hover:from-teal-700 hover:to-cyan-700 hover:-translate-y-0.5 active:scale-95 disabled:opacity-60"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{levelSubmitting === 'screen-diversity' ? 'Submitting…' : 'Submit to Project Admin'}</span>
            </button>
          </div>
          <CommonLevel0Card
            fields={hrData.diversity.common}
            accentColor="purple"
            onChange={(upd) => setHrData({
              ...hrData,
              diversity: { ...hrData.diversity, common: { ...hrData.diversity.common, ...upd } }
            })}
          />

          {/* Differently Abled (PwD) Statutory Representation Grid */}
          <div className="relative overflow-hidden rounded-[24px] border border-white/80 bg-gradient-to-br from-white/90 via-indigo-50/30 to-purple-50/40 p-6 shadow-[0_12px_36px_-6px_rgba(99,102,241,0.12)] backdrop-blur-2xl space-y-6">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-white/80 to-transparent" />
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-600" />
                  Differently Abled (PwD) Representation — BRSR Principle 3 Essential Indicator 1
                </h3>
                <p className="text-xs text-slate-500">Lawful disaggregated disclosures across permanent and non-permanent workforce</p>
              </div>
              <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">
                Total PwD: {totalPwDCount} ({calcPwDPct}% of total workforce)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div className="rounded-2xl border border-indigo-100 bg-white/70 p-4 space-y-3">
                <span className="font-bold text-slate-800">Permanent Employees (PwD)</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="ios-label">Male PwD</label>
                    <input
                      type="number"
                      value={hrData.diversity.pwdPermanentEmployeesMale ?? 142}
                      onChange={(e) => setHrData({
                        ...hrData,
                        diversity: { ...hrData.diversity, pwdPermanentEmployeesMale: Number(e.target.value) }
                      })}
                      className="ios-field !text-xs font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="ios-label">Female PwD</label>
                    <input
                      type="number"
                      value={hrData.diversity.pwdPermanentEmployeesFemale ?? 28}
                      onChange={(e) => setHrData({
                        ...hrData,
                        diversity: { ...hrData.diversity, pwdPermanentEmployeesFemale: Number(e.target.value) }
                      })}
                      className="ios-field !text-xs font-bold text-slate-800"
                    />
                  </div>
                </div>
                <div className="text-[11px] text-slate-500">
                  Subtotal: <strong className="text-indigo-700 font-black">{((hrData.diversity.pwdPermanentEmployeesMale ?? 142) + (hrData.diversity.pwdPermanentEmployeesFemale ?? 28))}</strong> (1.37% of Permanent Employees)
                </div>
              </div>

              <div className="rounded-2xl border border-indigo-100 bg-white/70 p-4 space-y-3">
                <span className="font-bold text-slate-800">Permanent Workers (PwD)</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="ios-label">Male PwD</label>
                    <input
                      type="number"
                      value={hrData.diversity.pwdPermanentWorkersMale ?? 85}
                      onChange={(e) => setHrData({
                        ...hrData,
                        diversity: { ...hrData.diversity, pwdPermanentWorkersMale: Number(e.target.value) }
                      })}
                      className="ios-field !text-xs font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="ios-label">Female PwD</label>
                    <input
                      type="number"
                      value={hrData.diversity.pwdPermanentWorkersFemale ?? 15}
                      onChange={(e) => setHrData({
                        ...hrData,
                        diversity: { ...hrData.diversity, pwdPermanentWorkersFemale: Number(e.target.value) }
                      })}
                      className="ios-field !text-xs font-bold text-slate-800"
                    />
                  </div>
                </div>
                <div className="text-[11px] text-slate-500">
                  Subtotal: <strong className="text-indigo-700 font-black">{((hrData.diversity.pwdPermanentWorkersMale ?? 85) + (hrData.diversity.pwdPermanentWorkersFemale ?? 15))}</strong> (0.55% of Permanent Workers)
                </div>
              </div>

              <div className="rounded-2xl border border-indigo-100 bg-white/70 p-4 space-y-3">
                <span className="font-bold text-slate-800">Contractual / Other Workforce (PwD)</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="ios-label">Contract Employees</label>
                    <input
                      type="number"
                      value={hrData.diversity.pwdOtherEmployeesCount ?? 14}
                      onChange={(e) => setHrData({
                        ...hrData,
                        diversity: { ...hrData.diversity, pwdOtherEmployeesCount: Number(e.target.value) }
                      })}
                      className="ios-field !text-xs font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="ios-label">Casual Workers</label>
                    <input
                      type="number"
                      value={hrData.diversity.pwdOtherWorkersCount ?? 0}
                      onChange={(e) => setHrData({
                        ...hrData,
                        diversity: { ...hrData.diversity, pwdOtherWorkersCount: Number(e.target.value) }
                      })}
                      className="ios-field !text-xs font-bold text-slate-800"
                    />
                  </div>
                </div>
                <div className="text-[11px] text-slate-500">
                  Subtotal: <strong className="text-indigo-700 font-black">{((hrData.diversity.pwdOtherEmployeesCount ?? 14) + (hrData.diversity.pwdOtherWorkersCount ?? 0))}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Gender Diversity by Hierarchy & Governance */}
          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title flex items-center gap-2">
                <Award className="h-4 w-4 text-purple-600" />
                Gender Diversity Across Governance &amp; Hierarchy (BRSR P3 E2)
              </h3>
              <p className="text-xs text-slate-500">Mandatory female participation metrics across governance and operating levels</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="rounded-2xl border border-purple-100 bg-purple-50/40 p-4">
                <span className="font-bold text-slate-700">Board of Directors</span>
                <div className="mt-2 text-2xl font-black text-purple-900">
                  {hrData.diversity.womenBoardPercent ?? 20.0}%
                </div>
                <div className="text-[11px] text-purple-700 mt-1">2 Female of 10 Directors</div>
              </div>

              <div className="rounded-2xl border border-purple-100 bg-purple-50/40 p-4">
                <span className="font-bold text-slate-700">Key Managerial Personnel (KMP)</span>
                <div className="mt-2 text-2xl font-black text-purple-900">
                  {hrData.diversity.womenKmpPercent ?? 25.0}%
                </div>
                <div className="text-[11px] text-purple-700 mt-1">1 Female KMP of 4</div>
              </div>

              <div className="rounded-2xl border border-purple-100 bg-purple-50/40 p-4">
                <span className="font-bold text-slate-700">Senior &amp; Middle Management</span>
                <div className="mt-2 text-2xl font-black text-purple-900">
                  {hrData.diversity.womenSeniorMgmtPercent ?? 18.4}%
                </div>
                <div className="text-[11px] text-purple-700 mt-1">Leadership cohort inclusion</div>
              </div>

              <div className="rounded-2xl border border-teal-100 bg-teal-50/40 p-4">
                <span className="font-bold text-slate-700">Overall Workforce Female Share</span>
                <div className="mt-2 text-2xl font-black text-teal-900">
                  {femaleRatio}%
                </div>
                <div className="text-[11px] text-teal-700 mt-1">{hrData.workforceProfile.femaleCount.toLocaleString()} total female personnel</div>
              </div>
            </div>

            {/* Affirmative Action & Social Diversity */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs pt-4 border-t border-slate-100">
              <div>
                <label className="ios-label">Affirmative Action Category</label>
                <select
                  value={hrData.diversity.diversityCategory}
                  onChange={(e) => setHrData({
                    ...hrData,
                    diversity: { ...hrData.diversity, diversityCategory: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Differently Abled (PwD)">Differently Abled (PwD)</option>
                  <option value="General">General</option>
                  <option value="Minority">Minority</option>
                  <option value="SC/ST/OBC">SC/ST/OBC</option>
                  <option value="Ex-Servicemen">Ex-Servicemen</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Count in Category</label>
                <input
                  type="number"
                  value={hrData.diversity.countByCategory}
                  onChange={(e) => {
                    const cnt = Number(e.target.value)
                    const total = hrData.diversity.totalWorkforceCount || 1
                    setHrData({
                      ...hrData,
                      diversity: {
                        ...hrData.diversity,
                        countByCategory: cnt,
                        calculatedPercentage: Number(((cnt / total) * 100).toFixed(2))
                      }
                    })
                  }}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Total Population Base</label>
                <input
                  type="number"
                  value={hrData.diversity.totalWorkforceCount}
                  onChange={(e) => {
                    const total = Number(e.target.value)
                    const cnt = hrData.diversity.countByCategory
                    setHrData({
                      ...hrData,
                      diversity: {
                        ...hrData.diversity,
                        totalWorkforceCount: total,
                        calculatedPercentage: total > 0 ? Number(((cnt / total) * 100).toFixed(2)) : 0
                      }
                    })
                  }}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Calculated Representation %</label>
                <div className="ios-field !text-xs font-black text-indigo-700 !bg-slate-50/70">
                  {hrData.diversity.calculatedPercentage}%
                </div>
              </div>
            </div>
          </div>

          {/* Physical Accessibility & Reasonable Accommodation */}
          <div className="glass-form-card space-y-4">
            <h3 className="form-card-title">Physical Accessibility &amp; Reasonable Accommodation Audit</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="ios-label">Wheelchair / Ramp Accessible Sites (%)</label>
                <input
                  type="number"
                  value={hrData.diversity.accessibleSitesPercent ?? 92.5}
                  onChange={(e) => setHrData({
                    ...hrData,
                    diversity: { ...hrData.diversity, accessibleSitesPercent: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Assistive Devices / Tech Provided</label>
                <input
                  type="number"
                  value={hrData.diversity.assistiveTechCount ?? 160}
                  onChange={(e) => setHrData({
                    ...hrData,
                    diversity: { ...hrData.diversity, assistiveTechCount: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Source Report Reference</label>
                <input
                  type="text"
                  value={hrData.diversity.sourceReport}
                  onChange={(e) => setHrData({
                    ...hrData,
                    diversity: { ...hrData.diversity, sourceReport: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Diversity Evidence Card */}
          <div className="relative overflow-hidden rounded-[24px] border border-white/80 bg-gradient-to-br from-white/85 to-indigo-50/50 p-5 shadow-[0_12px_36px_-6px_rgba(99,102,241,0.10)] backdrop-blur-2xl">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-white/80 to-transparent" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/25">
                  <Upload className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Supporting Evidence — Diversity &amp; Inclusion</h3>
                  <p className="text-[11px] text-slate-500">Upload PwD census sign-offs, EEO policy guidelines, and accessibility audit reports (module: HR-DIVERSITY)</p>
                </div>
              </div>
              <EvidenceUploadSection
                projectId={selectedProjectId || null}
                periodId={null}
                moduleKey="HR-DIVERSITY"
                evidence={evidenceItems}
                onUploaded={refreshEvidence}
                onReview={(ev) => setReviewEvidence(ev)}
                selectedEvidenceId={null}
                onSelectEvidence={() => {}}
              />
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          4. SCREEN: LEARNING & SKILL DEVELOPMENT (L&D)
          ───────────────────────────────────────────────────────────── */}
      {activeTab === 'screen-learning' && (
        <div className="space-y-6">
          {/* Per-level individual submission to Project Admin */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal-200/70 bg-teal-50/50 px-4 py-3 backdrop-blur-xl">
            <span className="text-xs font-semibold text-slate-600">
              This level&apos;s data can be submitted individually — it reaches the Project Admin instantly.
            </span>
            <button
              type="button"
              disabled={levelSubmitting === 'screen-learning'}
              onClick={() => handleLevelSubmit('screen-learning')}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-teal-600 to-cyan-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-teal-500/25 transition hover:from-teal-700 hover:to-cyan-700 hover:-translate-y-0.5 active:scale-95 disabled:opacity-60"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{levelSubmitting === 'screen-learning' ? 'Submitting…' : 'Submit to Project Admin'}</span>
            </button>
          </div>
          <CommonLevel0Card
            fields={hrData.training.common}
            accentColor="teal"
            onChange={(upd) => setHrData({
              ...hrData,
              training: { ...hrData.training, common: { ...hrData.training.common, ...upd } }
            })}
          />

          {/* BRSR Principle 3 Essential Indicator 8 Coverage Grid */}
          <div className="relative overflow-hidden rounded-[24px] border border-white/80 bg-gradient-to-br from-white/90 via-cyan-50/30 to-teal-50/40 p-6 shadow-[0_12px_36px_-6px_rgba(13,148,136,0.12)] backdrop-blur-2xl space-y-5">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-white/80 to-transparent" />
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-teal-600" />
                  Mandatory Training Coverage Matrix — BRSR Principle 3 Essential Indicator 8
                </h3>
                <p className="text-xs text-slate-500">Coverage percentage of employees &amp; workers trained on Health &amp; Safety and Skill Upgradation</p>
              </div>
              <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-black text-teal-800">
                Total Person-Hours: {calcPersonHours.toLocaleString()} hrs
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="rounded-2xl border border-teal-100 bg-white/70 p-4 space-y-2">
                <span className="font-bold text-slate-700">Health &amp; Safety: Employees</span>
                <div className="text-2xl font-black text-teal-900">{hrData.training.healthSafetyEmployeesPct ?? 94.2}%</div>
                <div className="text-[11px] text-teal-700">11,728 of 12,450 permanent employees</div>
              </div>

              <div className="rounded-2xl border border-teal-100 bg-white/70 p-4 space-y-2">
                <span className="font-bold text-slate-700">Health &amp; Safety: Workers</span>
                <div className="text-2xl font-black text-teal-900">{hrData.training.healthSafetyWorkersPct ?? 98.6}%</div>
                <div className="text-[11px] text-teal-700">Mandatory site safety toolbox induction</div>
              </div>

              <div className="rounded-2xl border border-cyan-100 bg-white/70 p-4 space-y-2">
                <span className="font-bold text-slate-700">Skill Upgradation: Employees</span>
                <div className="text-2xl font-black text-cyan-900">{hrData.training.skillEmployeesPct ?? 86.4}%</div>
                <div className="text-[11px] text-cyan-700">Technical EPC &amp; project management</div>
              </div>

              <div className="rounded-2xl border border-cyan-100 bg-white/70 p-4 space-y-2">
                <span className="font-bold text-slate-700">Skill Upgradation: Workers</span>
                <div className="text-2xl font-black text-cyan-900">{hrData.training.skillWorkersPct ?? 78.2}%</div>
                <div className="text-[11px] text-cyan-700">Heavy equipment &amp; welding certifications</div>
              </div>
            </div>
          </div>

          {/* Level HR-4 — Training Program Sessions Register */}
          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title">Training Programme &amp; Session Records</h3>
              <p className="text-xs text-slate-500">Record individual training programmes, duration, attendance, and assessment results</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="lg:col-span-2">
                <label className="ios-label">Training Programme Name</label>
                <input
                  type="text"
                  value={hrData.training.trainingProgramme}
                  onChange={(e) => setHrData({
                    ...hrData,
                    training: { ...hrData.training, trainingProgramme: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Training Category</label>
                <select
                  value={hrData.training.trainingCategory}
                  onChange={(e) => setHrData({
                    ...hrData,
                    training: { ...hrData.training, trainingCategory: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Health & Safety">Health &amp; Safety</option>
                  <option value="Skill Upgradation">Skill Upgradation</option>
                  <option value="POSH & Human Rights">POSH &amp; Human Rights</option>
                  <option value="Ethics & ESG">Ethics &amp; ESG</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Target Classification</label>
                <select
                  value={hrData.training.classification}
                  onChange={(e) => setHrData({
                    ...hrData,
                    training: { ...hrData.training, classification: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Employees">Employees</option>
                  <option value="Workers">Workers</option>
                  <option value="Both">Both Employees &amp; Workers</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Training Date</label>
                <input
                  type="date"
                  value={hrData.training.trainingDate}
                  onChange={(e) => setHrData({
                    ...hrData,
                    training: { ...hrData.training, trainingDate: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Total Sessions Conducted</label>
                <input
                  type="number"
                  value={hrData.training.numberOfSessions}
                  onChange={(e) => setHrData({
                    ...hrData,
                    training: { ...hrData.training, numberOfSessions: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Duration (Hours per Session)</label>
                <input
                  type="number"
                  value={hrData.training.durationHours}
                  onChange={(e) => setHrData({
                    ...hrData,
                    training: { ...hrData.training, durationHours: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Participants Enrolled</label>
                <input
                  type="number"
                  value={hrData.training.participants}
                  onChange={(e) => setHrData({
                    ...hrData,
                    training: { ...hrData.training, participants: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Participants Completed</label>
                <input
                  type="number"
                  value={hrData.training.participantsCompleting}
                  onChange={(e) => setHrData({
                    ...hrData,
                    training: { ...hrData.training, participantsCompleting: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Delivery Method</label>
                <select
                  value={hrData.training.deliveryMethod}
                  onChange={(e) => setHrData({
                    ...hrData,
                    training: { ...hrData.training, deliveryMethod: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Classroom">Classroom</option>
                  <option value="Online/LMS">Online/LMS</option>
                  <option value="On-the-job">On-the-job / Toolbox Talk</option>
                  <option value="Hybrid">Hybrid</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Trainer / Faculty / Agency</label>
                <input
                  type="text"
                  value={hrData.training.trainerAgency}
                  onChange={(e) => setHrData({
                    ...hrData,
                    training: { ...hrData.training, trainerAgency: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Post-Course Assessment Result</label>
                <input
                  type="text"
                  value={hrData.training.assessmentResult}
                  onChange={(e) => setHrData({
                    ...hrData,
                    training: { ...hrData.training, assessmentResult: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Training Evidence Card */}
          <div className="relative overflow-hidden rounded-[24px] border border-white/80 bg-gradient-to-br from-white/85 to-cyan-50/50 p-5 shadow-[0_12px_36px_-6px_rgba(6,182,212,0.10)] backdrop-blur-2xl">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-white/80 to-transparent" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-600 to-teal-600 text-white shadow-md shadow-cyan-500/25">
                  <Upload className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Supporting Evidence — L&amp;D Training Logs</h3>
                  <p className="text-[11px] text-slate-500">Upload attendance sheets, syllabus, and trainer certificates (module: HR-LEARNING)</p>
                </div>
              </div>
              <EvidenceUploadSection
                projectId={selectedProjectId || null}
                periodId={null}
                moduleKey="HR-LEARNING"
                evidence={evidenceItems}
                onUploaded={refreshEvidence}
                onReview={(ev) => setReviewEvidence(ev)}
                selectedEvidenceId={null}
                onSelectEvidence={() => {}}
              />
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          5. SCREEN: PERFORMANCE & CAREER APPRAISALS
          ───────────────────────────────────────────────────────────── */}
      {activeTab === 'screen-performance' && (
        <div className="space-y-6">
          {/* Per-level individual submission to Project Admin */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal-200/70 bg-teal-50/50 px-4 py-3 backdrop-blur-xl">
            <span className="text-xs font-semibold text-slate-600">
              This level&apos;s data can be submitted individually — it reaches the Project Admin instantly.
            </span>
            <button
              type="button"
              disabled={levelSubmitting === 'screen-performance'}
              onClick={() => handleLevelSubmit('screen-performance')}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-teal-600 to-cyan-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-teal-500/25 transition hover:from-teal-700 hover:to-cyan-700 hover:-translate-y-0.5 active:scale-95 disabled:opacity-60"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{levelSubmitting === 'screen-performance' ? 'Submitting…' : 'Submit to Project Admin'}</span>
            </button>
          </div>
          <CommonLevel0Card
            fields={hrData.reviews.common}
            accentColor="blue"
            onChange={(upd) => setHrData({
              ...hrData,
              reviews: { ...hrData.reviews, common: { ...hrData.reviews.common, ...upd } }
            })}
          />

          {/* Level HR-5 — Performance Reviews Coverage */}
          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title flex items-center gap-2">
                <Award className="h-4 w-4 text-blue-600" />
                Level HR-5 — Performance &amp; Career Reviews (BRSR P3 E11)
              </h3>
              <p className="text-xs text-slate-500">Track coverage percentage of regular performance appraisals across employees and workers</p>
            </div>

            {/* Performance Coverage KPI Strip */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                <span className="text-xs font-bold text-slate-500">Permanent Employees Reviewed</span>
                <div className="mt-2 text-2xl font-black text-blue-900">
                  {hrData.reviews.numberReviewed.toLocaleString()} / {hrData.reviews.totalEligiblePopulation.toLocaleString()}
                </div>
                <div className="text-xs font-bold text-blue-700 mt-1">{calcReviewPct}% Reviewed</div>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                <span className="text-xs font-bold text-slate-500">Permanent Workers Reviewed</span>
                <div className="mt-2 text-2xl font-black text-blue-900">
                  17,950 / 18,200
                </div>
                <div className="text-xs font-bold text-blue-700 mt-1">98.6% Reviewed</div>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
                <span className="text-xs font-bold text-slate-500">Review Completion Status</span>
                <div className="mt-2 text-2xl font-black text-emerald-900">
                  100% On-Track
                </div>
                <div className="text-xs font-bold text-emerald-700 mt-1">180 on approved medical leave</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="ios-label">Reporting Population</label>
                <input
                  type="text"
                  value={hrData.reviews.reportingPopulation}
                  onChange={(e) => setHrData({
                    ...hrData,
                    reviews: { ...hrData.reviews, reportingPopulation: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Total Eligible Population</label>
                <input
                  type="number"
                  value={hrData.reviews.totalEligiblePopulation}
                  onChange={(e) => setHrData({
                    ...hrData,
                    reviews: { ...hrData.reviews, totalEligiblePopulation: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Number Reviewed &amp; Appraised</label>
                <input
                  type="number"
                  value={hrData.reviews.numberReviewed}
                  onChange={(e) => setHrData({
                    ...hrData,
                    reviews: { ...hrData.reviews, numberReviewed: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Review Completion % (Calculated)</label>
                <div className="ios-field !text-xs font-black text-blue-700 !bg-slate-50/70">
                  {calcReviewPct}%
                </div>
              </div>

              <div>
                <label className="ios-label">Review Period / Appraisal Cycle</label>
                <input
                  type="text"
                  value={hrData.reviews.reviewPeriod}
                  onChange={(e) => setHrData({
                    ...hrData,
                    reviews: { ...hrData.reviews, reviewPeriod: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Review Process Reference</label>
                <input
                  type="text"
                  value={hrData.reviews.reviewProcessReference}
                  onChange={(e) => setHrData({
                    ...hrData,
                    reviews: { ...hrData.reviews, reviewProcessReference: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Source HRMS Sign-off File</label>
                <input
                  type="text"
                  value={hrData.reviews.sourceHrReport}
                  onChange={(e) => setHrData({
                    ...hrData,
                    reviews: { ...hrData.reviews, sourceHrReport: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Supporting Evidence Reference</label>
                <input
                  type="text"
                  value={hrData.reviews.supportingEvidence}
                  onChange={(e) => setHrData({
                    ...hrData,
                    reviews: { ...hrData.reviews, supportingEvidence: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="ios-label">Remarks &amp; Moderation Sign-Off</label>
              <textarea
                rows={2}
                value={hrData.reviews.remarks}
                onChange={(e) => setHrData({
                  ...hrData,
                  reviews: { ...hrData.reviews, remarks: e.target.value }
                })}
                className="ios-field !text-xs font-medium text-slate-800"
              />
            </div>
          </div>

          {/* Performance Evidence Card */}
          <div className="relative overflow-hidden rounded-[24px] border border-white/80 bg-gradient-to-br from-white/85 to-blue-50/50 p-5 shadow-[0_12px_36px_-6px_rgba(59,130,246,0.10)] backdrop-blur-2xl">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-white/80 to-transparent" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25">
                  <Upload className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Supporting Evidence — Appraisal Summaries</h3>
                  <p className="text-[11px] text-slate-500">Attach PMS policy guidelines, moderation committee certificates, and audit sign-offs (module: HR-PERFORMANCE)</p>
                </div>
              </div>
              <EvidenceUploadSection
                projectId={selectedProjectId || null}
                periodId={null}
                moduleKey="HR-PERFORMANCE"
                evidence={evidenceItems}
                onUploaded={refreshEvidence}
                onReview={(ev) => setReviewEvidence(ev)}
                selectedEvidenceId={null}
                onSelectEvidence={() => {}}
              />
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          6. SCREEN: COMPENSATION, BENEFITS & WAGES
          ───────────────────────────────────────────────────────────── */}
      {activeTab === 'screen-compensation' && (
        <div className="space-y-6">
          {/* Per-level individual submission to Project Admin */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal-200/70 bg-teal-50/50 px-4 py-3 backdrop-blur-xl">
            <span className="text-xs font-semibold text-slate-600">
              This level&apos;s data can be submitted individually — it reaches the Project Admin instantly.
            </span>
            <button
              type="button"
              disabled={levelSubmitting === 'screen-compensation'}
              onClick={() => handleLevelSubmit('screen-compensation')}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-teal-600 to-cyan-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-teal-500/25 transition hover:from-teal-700 hover:to-cyan-700 hover:-translate-y-0.5 active:scale-95 disabled:opacity-60"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{levelSubmitting === 'screen-compensation' ? 'Submitting…' : 'Submit to Project Admin'}</span>
            </button>
          </div>
          <CommonLevel0Card
            fields={hrData.benefits.common}
            accentColor="teal"
            onChange={(upd) => setHrData({
              ...hrData,
              benefits: { ...hrData.benefits, common: { ...hrData.benefits.common, ...upd } }
            })}
          />

          {/* Level HR-6 — Employee Benefits */}
          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title">Level HR-6 — Employee Benefits &amp; Well-being</h3>
              <p className="text-xs text-slate-500">Collect health insurance, maternity/paternity, PF, and well-being coverage</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="ios-label">Benefit Category</label>
                <select
                  value={hrData.benefits.benefitCategory}
                  onChange={(e) => setHrData({
                    ...hrData,
                    benefits: { ...hrData.benefits, benefitCategory: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Health Insurance">Health Insurance</option>
                  <option value="Accident Insurance">Accident Insurance</option>
                  <option value="Maternity Benefits">Maternity Benefits</option>
                  <option value="Paternity Benefits">Paternity Benefits</option>
                  <option value="PF & Gratuity">PF &amp; Gratuity</option>
                  <option value="Day Care Facilities">Day Care Facilities</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Eligible Population</label>
                <input
                  type="number"
                  value={hrData.benefits.eligiblePopulation}
                  onChange={(e) => setHrData({
                    ...hrData,
                    benefits: { ...hrData.benefits, eligiblePopulation: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Beneficiaries / Recipients</label>
                <input
                  type="number"
                  value={hrData.benefits.beneficiariesCount}
                  onChange={(e) => setHrData({
                    ...hrData,
                    benefits: { ...hrData.benefits, beneficiariesCount: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Benefit Coverage % (Calculated)</label>
                <div className="ios-field !text-xs font-black text-teal-700 !bg-slate-50/70">
                  {calcBenefitPct}%
                </div>
              </div>

              <div>
                <label className="ios-label">Benefit Policy Reference</label>
                <input
                  type="text"
                  value={hrData.benefits.benefitPolicyReference}
                  onChange={(e) => setHrData({
                    ...hrData,
                    benefits: { ...hrData.benefits, benefitPolicyReference: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Supporting Evidence</label>
                <input
                  type="text"
                  value={hrData.benefits.supportingEvidence}
                  onChange={(e) => setHrData({
                    ...hrData,
                    benefits: { ...hrData.benefits, supportingEvidence: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Level HR-7 — Wages & Remuneration */}
          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title">Level HR-7 — Wages &amp; Remuneration Disclosures</h3>
              <p className="text-xs text-slate-500">Collect authorized aggregate remuneration metrics without sensitive personal data</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="ios-label">Reporting Population</label>
                <input
                  type="text"
                  value={hrData.wages.reportingPopulation}
                  onChange={(e) => setHrData({
                    ...hrData,
                    wages: { ...hrData.wages, reportingPopulation: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Wage / Remuneration Metric</label>
                <select
                  value={hrData.wages.wageRemunerationMetric}
                  onChange={(e) => setHrData({
                    ...hrData,
                    wages: { ...hrData.wages, wageRemunerationMetric: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Median Remuneration">Median Remuneration</option>
                  <option value="Minimum Wage Compliance">Minimum Wage Compliance</option>
                  <option value="Equal Pay Ratio (F:M)">Equal Pay Ratio (F:M)</option>
                  <option value="Gross Wage Aggregate">Gross Wage Aggregate</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Measurement Period</label>
                <input
                  type="text"
                  value={hrData.wages.measurementPeriod}
                  onChange={(e) => setHrData({
                    ...hrData,
                    wages: { ...hrData.wages, measurementPeriod: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Aggregate Amount / Value</label>
                <input
                  type="number"
                  value={hrData.wages.aggregateAmount}
                  onChange={(e) => setHrData({
                    ...hrData,
                    wages: { ...hrData.wages, aggregateAmount: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Currency / Unit</label>
                <input
                  type="text"
                  value={hrData.wages.currencyUnit}
                  onChange={(e) => setHrData({
                    ...hrData,
                    wages: { ...hrData.wages, currencyUnit: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Calculation Method</label>
                <input
                  type="text"
                  value={hrData.wages.calculationMethod}
                  onChange={(e) => setHrData({
                    ...hrData,
                    wages: { ...hrData.wages, calculationMethod: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Source Payroll Report</label>
                <input
                  type="text"
                  value={hrData.wages.sourcePayrollReport}
                  onChange={(e) => setHrData({
                    ...hrData,
                    wages: { ...hrData.wages, sourcePayrollReport: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Supporting Evidence</label>
                <input
                  type="text"
                  value={hrData.wages.evidence}
                  onChange={(e) => setHrData({
                    ...hrData,
                    wages: { ...hrData.wages, evidence: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Level HR-9 — Safety & Occupational Well-being */}
          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title">Level HR-9 — Occupational Safety &amp; Health Coordination</h3>
              <p className="text-xs text-slate-500">Coordinate HR-owned workforce well-being programs and medical coverage</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="ios-label">Employee / Worker Population</label>
                <input
                  type="text"
                  value={hrData.safetyCoord.population}
                  onChange={(e) => setHrData({
                    ...hrData,
                    safetyCoord: { ...hrData.safetyCoord, population: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Participation Count</label>
                <input
                  type="number"
                  value={hrData.safetyCoord.participationCount}
                  onChange={(e) => setHrData({
                    ...hrData,
                    safetyCoord: { ...hrData.safetyCoord, participationCount: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div className="md:col-span-2">
                <label className="ios-label">Workforce Well-being Programme Details</label>
                <input
                  type="text"
                  value={hrData.safetyCoord.workforceWellbeingProgramme}
                  onChange={(e) => setHrData({
                    ...hrData,
                    safetyCoord: { ...hrData.safetyCoord, workforceWellbeingProgramme: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div className="md:col-span-2">
                <label className="ios-label">Health &amp; Safety Training Summary</label>
                <textarea
                  rows={2}
                  value={hrData.safetyCoord.healthSafetyTrainingSummary}
                  onChange={(e) => setHrData({
                    ...hrData,
                    safetyCoord: { ...hrData.safetyCoord, healthSafetyTrainingSummary: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Statutory Audit Identifiers */}
          <div className="relative overflow-hidden rounded-[24px] border border-white/80 bg-gradient-to-br from-white/85 to-sky-50/65 p-5 shadow-[0_12px_36px_-6px_rgba(13,148,136,0.10)] backdrop-blur-2xl">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-white/80 to-transparent" />
            <div className="relative z-10">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-cyan-600 text-white shadow-md shadow-teal-500/25">
                  <FileCheck2 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Statutory Audit Reference Identifiers</h3>
                  <p className="text-[11px] text-slate-500">Verifiable challan &amp; policy references for institutional audit readiness</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <label className="text-xs font-bold text-slate-700">EPFO ECR / TRRN Challan Ref.</label>
                  <input
                    type="text"
                    value={auditRefs.epfoChallanRef}
                    onChange={e => setAuditRefs({ ...auditRefs, epfoChallanRef: e.target.value })}
                    placeholder="e.g. TRRN-2026-0707-114"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-800 outline-none backdrop-blur-md transition focus:border-teal-500 focus:ring-2 focus:ring-teal-400/40"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">ESIC Monthly Payment Ref.</label>
                  <input
                    type="text"
                    value={auditRefs.esicChallanRef}
                    onChange={e => setAuditRefs({ ...auditRefs, esicChallanRef: e.target.value })}
                    placeholder="e.g. ESIC-31000-2026-06"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-800 outline-none backdrop-blur-md transition focus:border-teal-500 focus:ring-2 focus:ring-teal-400/40"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">Group Mediclaim TPA Policy ID</label>
                  <input
                    type="text"
                    value={auditRefs.insurancePolicyId}
                    onChange={e => setAuditRefs({ ...auditRefs, insurancePolicyId: e.target.value })}
                    placeholder="e.g. MEIL-GMC-2026-0091"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-800 outline-none backdrop-blur-md transition focus:border-teal-500 focus:ring-2 focus:ring-teal-400/40"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Compensation Evidence Card */}
          <div className="relative overflow-hidden rounded-[24px] border border-white/80 bg-gradient-to-br from-white/85 to-teal-50/50 p-5 shadow-[0_12px_36px_-6px_rgba(13,148,136,0.10)] backdrop-blur-2xl">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-white/80 to-transparent" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-cyan-600 text-white shadow-md shadow-teal-500/25">
                  <Upload className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Supporting Evidence — Benefits &amp; Wages</h3>
                  <p className="text-[11px] text-slate-500">Upload insurance master policy, EPFO challan receipts, and payroll summaries (module: HR-COMPENSATION)</p>
                </div>
              </div>
              <EvidenceUploadSection
                projectId={selectedProjectId || null}
                periodId={null}
                moduleKey="HR-COMPENSATION"
                evidence={evidenceItems}
                onUploaded={refreshEvidence}
                onReview={(ev) => setReviewEvidence(ev)}
                selectedEvidenceId={null}
                onSelectEvidence={() => {}}
              />
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          7. SCREEN: WORKPLACE GRIEVANCES & STATUTORY POSH
          ───────────────────────────────────────────────────────────── */}
      {activeTab === 'screen-grievances' && (
        <div className="space-y-6">
          {/* Per-level individual submission to Project Admin */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal-200/70 bg-teal-50/50 px-4 py-3 backdrop-blur-xl">
            <span className="text-xs font-semibold text-slate-600">
              This level&apos;s data can be submitted individually — it reaches the Project Admin instantly.
            </span>
            <button
              type="button"
              disabled={levelSubmitting === 'screen-grievances'}
              onClick={() => handleLevelSubmit('screen-grievances')}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-teal-600 to-cyan-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-teal-500/25 transition hover:from-teal-700 hover:to-cyan-700 hover:-translate-y-0.5 active:scale-95 disabled:opacity-60"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{levelSubmitting === 'screen-grievances' ? 'Submitting…' : 'Submit to Project Admin'}</span>
            </button>
          </div>
          <CommonLevel0Card
            fields={hrData.grievances.common}
            accentColor="rose"
            onChange={(upd) => setHrData({
              ...hrData,
              grievances: { ...hrData.grievances, common: { ...hrData.grievances.common, ...upd } }
            })}
          />

          {/* Level HR-8 — Workplace Grievances */}
          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title flex items-center gap-2">
                <Scale className="h-4 w-4 text-rose-600" />
                Workplace Grievance Redressal Register
              </h3>
              <p className="text-xs text-slate-500">Record employee &amp; worker dispute redressal while preserving complainant confidentiality</p>
            </div>

            {/* Clean Category Breakdown (No duplicate POSH, No duplicate Safety) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="ios-label">Grievance Category</label>
                <select
                  value={hrData.grievances.grievanceCategory}
                  onChange={(e) => setHrData({
                    ...hrData,
                    grievances: { ...hrData.grievances, grievanceCategory: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Working Conditions">Working Conditions &amp; Amenities</option>
                  <option value="Wage Issues">Wage, Overtime &amp; Deductions</option>
                  <option value="Discrimination / Harassment">Workplace Discrimination / Conduct</option>
                  <option value="Health & Safety">Site Amenities / Safety Disputes</option>
                  <option value="Child Labour / Forced Labour">Fair Labour Dispute</option>
                  <option value="POSH">POSH (Refer Statutory Section)</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Grievances Received (FY)</label>
                <input
                  type="number"
                  value={hrData.grievances.grievancesReceived}
                  onChange={(e) => {
                    const rcv = Number(e.target.value)
                    const rslv = hrData.grievances.grievancesResolved
                    setHrData({
                      ...hrData,
                      grievances: {
                        ...hrData.grievances,
                        grievancesReceived: rcv,
                        grievancesPending: Math.max(0, rcv - rslv)
                      }
                    })
                  }}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Grievances Resolved</label>
                <input
                  type="number"
                  value={hrData.grievances.grievancesResolved}
                  onChange={(e) => {
                    const rslv = Number(e.target.value)
                    const rcv = hrData.grievances.grievancesReceived
                    setHrData({
                      ...hrData,
                      grievances: {
                        ...hrData.grievances,
                        grievancesResolved: rslv,
                        grievancesPending: Math.max(0, rcv - rslv)
                      }
                    })
                  }}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Grievances Pending (Calculated)</label>
                <div className="ios-field !text-xs font-black text-rose-600 !bg-slate-50/70">
                  {hrData.grievances.grievancesPending}
                </div>
              </div>

              <div>
                <label className="ios-label">Redressal Mechanism</label>
                <input
                  type="text"
                  value={hrData.grievances.resolutionMethod}
                  onChange={(e) => setHrData({
                    ...hrData,
                    grievances: { ...hrData.grievances, resolutionMethod: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Responsible Department</label>
                <input
                  type="text"
                  value={hrData.grievances.responsibleDepartment}
                  onChange={(e) => setHrData({
                    ...hrData,
                    grievances: { ...hrData.grievances, responsibleDepartment: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Source Register Reference</label>
                <input
                  type="text"
                  value={hrData.grievances.sourceRegister}
                  onChange={(e) => setHrData({
                    ...hrData,
                    grievances: { ...hrData.grievances, sourceRegister: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Supporting Evidence</label>
                <input
                  type="text"
                  value={hrData.grievances.supportingEvidence}
                  onChange={(e) => setHrData({
                    ...hrData,
                    grievances: { ...hrData.grievances, supportingEvidence: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Statutory POSH Section */}
          <div className="relative overflow-hidden rounded-[24px] border border-white/80 bg-gradient-to-br from-white/85 to-rose-50/55 p-5 shadow-[0_12px_36px_-6px_rgba(225,29,72,0.10)] backdrop-blur-2xl">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-white/80 to-transparent" />
            <div className="relative z-10">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-md shadow-rose-500/25">
                  <Scale className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Statutory POSH Disclosures (POSH Act 2013 — Section 21)</h3>
                  <p className="text-[11px] text-slate-500">Internal Committee (IC) annual filing &amp; statutory turnaround tracking</p>
                </div>
              </div>

              {(Number(posh.poshPendingOver90Days) || 0) > 0 && (
                <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-rose-300 bg-rose-50/90 p-3.5 text-xs font-bold text-rose-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                  <span>
                    COMPLIANCE ALERT: {posh.poshPendingOver90Days} POSH complaint(s) pending beyond 90 days — statutory escalation required under Section 21 of the POSH Act.
                  </span>
                </div>
              )}

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                <div>
                  <label className="text-xs font-bold text-slate-700">Complaints Received (FY)</label>
                  <input
                    type="number"
                    min={0}
                    value={posh.poshReceived}
                    onChange={e => setPosh({ ...posh, poshReceived: Number(e.target.value) || 0 })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-xs font-bold text-slate-800 outline-none backdrop-blur-md transition focus:border-teal-500 focus:ring-2 focus:ring-teal-400/40"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">Complaints Disposed</label>
                  <input
                    type="number"
                    min={0}
                    value={posh.poshDisposed}
                    onChange={e => setPosh({ ...posh, poshDisposed: Number(e.target.value) || 0 })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-xs font-bold text-slate-800 outline-none backdrop-blur-md transition focus:border-teal-500 focus:ring-2 focus:ring-teal-400/40"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">Pending &gt; 90 Days</label>
                  <input
                    type="number"
                    min={0}
                    value={posh.poshPendingOver90Days}
                    onChange={e => setPosh({ ...posh, poshPendingOver90Days: Number(e.target.value) || 0 })}
                    className={`mt-1 w-full rounded-xl border bg-white/80 px-3 py-2 text-xs font-bold outline-none backdrop-blur-md transition focus:ring-2 ${
                      (Number(posh.poshPendingOver90Days) || 0) > 0
                        ? 'border-rose-300 text-rose-700 ring-rose-400/40'
                        : 'border-slate-200 text-slate-800 focus:border-teal-500 ring-teal-400/40'
                    }`}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">IC Annual Report Reference</label>
                  <input
                    type="text"
                    value={posh.poshReportRef}
                    onChange={e => setPosh({ ...posh, poshReportRef: e.target.value })}
                    placeholder="e.g. IC-AR-2026-014"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-800 outline-none backdrop-blur-md transition focus:border-teal-500 focus:ring-2 focus:ring-teal-400/40"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Grievances Evidence Card */}
          <div className="relative overflow-hidden rounded-[24px] border border-white/80 bg-gradient-to-br from-white/85 to-rose-50/50 p-5 shadow-[0_12px_36px_-6px_rgba(225,29,72,0.10)] backdrop-blur-2xl">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-white/80 to-transparent" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-rose-600 to-red-600 text-white shadow-md shadow-rose-500/25">
                  <Upload className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Supporting Evidence — Grievances &amp; POSH</h3>
                  <p className="text-[11px] text-slate-500">Upload IC annual report to District Officer and redacted dispute resolution minutes (module: HR-GRIEVANCES)</p>
                </div>
              </div>
              <EvidenceUploadSection
                projectId={selectedProjectId || null}
                periodId={null}
                moduleKey="HR-GRIEVANCES"
                evidence={evidenceItems}
                onUploaded={refreshEvidence}
                onReview={(ev) => setReviewEvidence(ev)}
                selectedEvidenceId={null}
                onSelectEvidence={() => {}}
              />
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          8. SCREEN: HUMAN RIGHTS & FAIR LABOUR COMPLIANCE
          ───────────────────────────────────────────────────────────── */}
      {activeTab === 'screen-human-rights' && (
        <div className="space-y-6">
          {/* Per-level individual submission to Project Admin */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal-200/70 bg-teal-50/50 px-4 py-3 backdrop-blur-xl">
            <span className="text-xs font-semibold text-slate-600">
              This level&apos;s data can be submitted individually — it reaches the Project Admin instantly.
            </span>
            <button
              type="button"
              disabled={levelSubmitting === 'screen-human-rights'}
              onClick={() => handleLevelSubmit('screen-human-rights')}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-teal-600 to-cyan-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-teal-500/25 transition hover:from-teal-700 hover:to-cyan-700 hover:-translate-y-0.5 active:scale-95 disabled:opacity-60"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{levelSubmitting === 'screen-human-rights' ? 'Submitting…' : 'Submit to Project Admin'}</span>
            </button>
          </div>
          <CommonLevel0Card
            fields={hrData.humanRights?.common ?? hrData.grievances.common}
            accentColor="amber"
            onChange={(upd) => {
              if (hrData.humanRights) {
                setHrData({
                  ...hrData,
                  humanRights: { ...hrData.humanRights, common: { ...hrData.humanRights.common, ...upd } }
                })
              }
            }}
          />

          {/* BRSR Principle 5 Due Diligence Grid */}
          <div className="relative overflow-hidden rounded-[24px] border border-white/80 bg-gradient-to-br from-white/90 via-amber-50/30 to-orange-50/40 p-6 shadow-[0_12px_36px_-6px_rgba(245,158,11,0.12)] backdrop-blur-2xl space-y-6">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-white/80 to-transparent" />
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-amber-600" />
                  Human Rights Due Diligence &amp; Zero-Tolerance Audits (BRSR Principle 5)
                </h3>
                <p className="text-xs text-slate-500">Rigorous site inspections preventing child labour, forced labour, and contractor human rights risks</p>
              </div>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">
                Zero Violations Reported
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="rounded-2xl border border-amber-200/70 bg-white/70 p-4 space-y-2">
                <span className="font-bold text-slate-800">Child Labour Prohibition Audits</span>
                <div className="text-2xl font-black text-emerald-700">0 Violations</div>
                <div className="text-[11px] text-slate-500">48 project sites verified via biometric age-proofing at turnstiles</div>
              </div>

              <div className="rounded-2xl border border-amber-200/70 bg-white/70 p-4 space-y-2">
                <span className="font-bold text-slate-800">Forced / Involuntary Labour Audits</span>
                <div className="text-2xl font-black text-emerald-700">0 Violations</div>
                <div className="text-[11px] text-slate-500">100% zero-retention of employee/contractor national IDs/passports</div>
              </div>

              <div className="rounded-2xl border border-amber-200/70 bg-white/70 p-4 space-y-2">
                <span className="font-bold text-slate-800">Contractor Accommodation Inspections</span>
                <div className="text-2xl font-black text-amber-800">96.8% Compliant</div>
                <div className="text-[11px] text-slate-500">36 labor camps inspected for clean drinking water &amp; ventilation</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs pt-4 border-t border-slate-100">
              <div>
                <label className="ios-label">Age Verification Protocol</label>
                <input
                  type="text"
                  value={hrData.humanRights?.ageVerificationMethod ?? 'Biometric Gate + Aadhaar ID Validation'}
                  onChange={(e) => {
                    if (hrData.humanRights) {
                      setHrData({ ...hrData, humanRights: { ...hrData.humanRights, ageVerificationMethod: e.target.value } })
                    }
                  }}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Contractor Camps Inspected</label>
                <input
                  type="number"
                  value={hrData.humanRights?.contractorCampsInspected ?? 36}
                  onChange={(e) => {
                    if (hrData.humanRights) {
                      setHrData({ ...hrData, humanRights: { ...hrData.humanRights, contractorCampsInspected: Number(e.target.value) } })
                    }
                  }}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Clean Drinking Water Access (%)</label>
                <input
                  type="number"
                  value={hrData.humanRights?.cleanDrinkingWaterPct ?? 100}
                  onChange={(e) => {
                    if (hrData.humanRights) {
                      setHrData({ ...hrData, humanRights: { ...hrData.humanRights, cleanDrinkingWaterPct: Number(e.target.value) } })
                    }
                  }}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Minimum Wages Act Compliance (%)</label>
                <input
                  type="number"
                  value={hrData.humanRights?.minimumWageCompliancePct ?? 100}
                  onChange={(e) => {
                    if (hrData.humanRights) {
                      setHrData({ ...hrData, humanRights: { ...hrData.humanRights, minimumWageCompliancePct: Number(e.target.value) } })
                    }
                  }}
                  className="ios-field !text-xs font-bold text-emerald-700"
                />
              </div>
            </div>
          </div>

          {/* Human Rights Training & Statutory Challans */}
          <div className="glass-form-card space-y-4">
            <h3 className="form-card-title">Human Rights Training &amp; Statutory Social Audit Reference</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="ios-label">% Permanent Employees Trained on Human Rights</label>
                <input
                  type="number"
                  value={hrData.humanRights?.employeesTrainedHumanRightsPct ?? 88.5}
                  onChange={(e) => {
                    if (hrData.humanRights) {
                      setHrData({ ...hrData, humanRights: { ...hrData.humanRights, employeesTrainedHumanRightsPct: Number(e.target.value) } })
                    }
                  }}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">% Contract Workers Sensitized at Induction</label>
                <input
                  type="number"
                  value={hrData.humanRights?.workersTrainedHumanRightsPct ?? 92.0}
                  onChange={(e) => {
                    if (hrData.humanRights) {
                      setHrData({ ...hrData, humanRights: { ...hrData.humanRights, workersTrainedHumanRightsPct: Number(e.target.value) } })
                    }
                  }}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Third-Party Social Audit Certificate Ref.</label>
                <input
                  type="text"
                  value={hrData.humanRights?.thirdPartyAuditReference ?? 'SA8000-MEIL-AUDIT-2026'}
                  onChange={(e) => {
                    if (hrData.humanRights) {
                      setHrData({ ...hrData, humanRights: { ...hrData.humanRights, thirdPartyAuditReference: e.target.value } })
                    }
                  }}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Human Rights Evidence Card */}
          <div className="relative overflow-hidden rounded-[24px] border border-white/80 bg-gradient-to-br from-white/85 to-amber-50/50 p-5 shadow-[0_12px_36px_-6px_rgba(245,158,11,0.10)] backdrop-blur-2xl">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-white/80 to-transparent" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-amber-600 to-orange-600 text-white shadow-md shadow-amber-500/25">
                  <Upload className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Supporting Evidence — Human Rights Compliance</h3>
                  <p className="text-[11px] text-slate-500">Upload SA8000 social audit certificates, camp sanitation inspection reports, and EPF/ESIC deposit proof (module: HR-HUMAN-RIGHTS)</p>
                </div>
              </div>
              <EvidenceUploadSection
                projectId={selectedProjectId || null}
                periodId={null}
                moduleKey="HR-HUMAN-RIGHTS"
                evidence={evidenceItems}
                onUploaded={refreshEvidence}
                onReview={(ev) => setReviewEvidence(ev)}
                selectedEvidenceId={null}
                onSelectEvidence={() => {}}
              />
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          9. EVIDENCE VAULT TAB
          ───────────────────────────────────────────────────────────── */}
      {activeTab === 'evidence' && (
        <div className="space-y-5">
          <div className="relative overflow-hidden rounded-[24px] border border-white/80 bg-gradient-to-br from-white/85 to-sky-50/65 p-5 shadow-[0_12px_36px_-6px_rgba(13,148,136,0.10)] backdrop-blur-2xl">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-white/80 to-transparent" />
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900">Evidence Vault — HR Documentation</h3>
                <p className="text-xs text-slate-500">Attached files are linked to level disclosures and verifiable by Project Admin</p>
              </div>
              <button
                type="button"
                onClick={refreshEvidence}
                className="flex items-center gap-1.5 rounded-xl border border-teal-200 bg-white/80 px-3 py-1.5 text-xs font-bold text-teal-700 shadow-xs hover:bg-teal-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Refresh Vault</span>
              </button>
            </div>
          </div>
          <EvidenceUploadSection
            projectId={selectedProjectId || null}
            periodId={null}
            moduleKey="HR-ALL"
            evidence={evidenceItems}
            onUploaded={refreshEvidence}
            onReview={(ev) => setReviewEvidence(ev)}
            selectedEvidenceId={null}
            onSelectEvidence={() => {}}
          />
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          10. SUBMISSIONS TAB
          ───────────────────────────────────────────────────────────── */}
      {activeTab === 'submissions' && (
        <div className="space-y-5">
          <div className="relative overflow-hidden rounded-[24px] border border-white/80 bg-gradient-to-br from-white/85 to-sky-50/65 p-5 shadow-[0_12px_36px_-6px_rgba(13,148,136,0.10)] backdrop-blur-2xl">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-white/80 to-transparent" />
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900">My HR Submissions Queue</h3>
                <p className="text-xs text-slate-500">Workforce records submitted to Project Admin with approval status and comments</p>
              </div>
              <button
                type="button"
                onClick={refreshRealSubmissions}
                className="flex items-center gap-1.5 rounded-xl border border-teal-200 bg-white/80 px-3 py-1.5 text-xs font-bold text-teal-700 shadow-xs hover:bg-teal-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Refresh Status</span>
              </button>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur-xl">
            {realSubmissionsLoading ? (
              <div className="py-8 text-center text-xs font-bold text-slate-400">Loading submissions feed...</div>
            ) : realSubmissions.length === 0 ? (
              <div className="py-10 text-center text-slate-500">
                <FileCheck2 className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                <p className="text-xs font-bold">No workforce submissions recorded yet for this project.</p>
                <p className="text-[11px] text-slate-400 mt-1">Use the Validate &amp; Continue action on any level form to prepare your submission.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {realSubmissions.map((sub: any) => (
                  <div key={sub.id} className="rounded-2xl border border-slate-100 bg-white/60 p-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-xs">{sub.title || 'Workforce Disclosure'}</span>
                        <span className="rounded-full bg-teal-50 text-teal-700 font-bold px-2 py-0.5 text-[10px]">{sub.status}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{sub.id} · Submitted {new Date(sub.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          11. ACTIVITY LOG TAB
          ───────────────────────────────────────────────────────────── */}
      {activeTab === 'activity' && (
        <div className="relative overflow-hidden rounded-[24px] border border-white/80 bg-gradient-to-br from-white/85 to-sky-50/65 p-5 shadow-[0_12px_36px_-6px_rgba(13,148,136,0.10)] backdrop-blur-2xl">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-white/80 to-transparent" />
          <div className="relative z-10">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900">Audit &amp; Activity Log — HR Workspace</h3>
                <p className="text-xs text-slate-500">Chronological trace of HR edits, draft saves, and verification checks</p>
              </div>
              <button
                type="button"
                onClick={fetchRealActivities}
                className="flex items-center gap-1.5 rounded-xl border border-teal-200 bg-white/80 px-3 py-1.5 text-xs font-bold text-teal-700 shadow-xs hover:bg-teal-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Refresh Feed</span>
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {activities.map((act) => (
                <div key={act.id} className="rounded-2xl border border-slate-100 bg-white/60 p-3.5 text-xs flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="font-bold text-slate-900">{act.action} · <span className="text-teal-700">{act.target}</span></div>
                    <div className="text-[11px] text-slate-500">{act.details}</div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium shrink-0">{act.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          BOTTOM ACTION BAR (iOS Liquid Glass Sticky Bar)
          ───────────────────────────────────────────────────────────── */}
      {activeTab !== 'evidence' && activeTab !== 'submissions' && activeTab !== 'activity' && (
        <div className="sticky bottom-4 z-30">
          <div className="relative overflow-hidden rounded-[22px] border border-white/80 bg-white/85 px-5 py-3.5 shadow-[0_18px_44px_-12px_rgba(13,148,136,0.28)] backdrop-blur-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>
                  {activeTab === 'overview'
                    ? 'Console Overview — select any section above to enter or review disclosures'
                    : 'Changes auto-persisted · Click Save Draft to save locally or Validate & Continue to submit to Project Admin'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { handleSaveDraft(activeTab.toUpperCase()); markLevelDrafted(activeTab) }}
                  className="ios-btn-ghost"
                >
                  <Save className="h-4 w-4" />
                  <span>{saveStatus}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setJourneyOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-teal-600 to-cyan-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-teal-500/25 transition-all hover:from-teal-700 hover:to-cyan-700 hover:-translate-y-0.5 active:scale-95 cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Validate &amp; Continue</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── RIGHT-SIDE JOURNEY PANEL (ENV pattern) — level-by-level draft tracker.
           Opens via "Validate & Continue". When all levels are drafted, the
           Final Review & Submit action unlocks. ── */}
      <AnimatePresence>
        {journeyOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setJourneyOpen(false)}
              className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: 480 }}
              animate={{ x: 0 }}
              exit={{ x: 480 }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-hidden border-l border-white/80 bg-white/90 shadow-2xl backdrop-blur-2xl"
            >
              {/* Panel header */}
              <div className="relative overflow-hidden border-b border-white/70 bg-gradient-to-br from-teal-600 to-cyan-600 p-5 text-white">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-white/20 to-transparent" />
                <div className="relative z-10 flex items-start justify-between">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-100">Level Journey</div>
                    <h3 className="mt-0.5 text-lg font-black">HR Disclosure Levels</h3>
                    <p className="mt-0.5 text-[11px] text-teal-100/90">
                      {JOURNEY_LEVELS.filter(l => levelDrafts[l.id] || levelSubmitted[l.id]).length} of {JOURNEY_LEVELS.length} levels drafted — finish all to unlock the final review
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setJourneyOpen(false)}
                    className="rounded-full p-1.5 text-white/80 transition hover:bg-white/20 hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Level list */}
              <div className="flex-1 space-y-2 overflow-y-auto p-4 scroll-elegant">
                {JOURNEY_LEVELS.map((l, idx) => {
                  const submitted = levelSubmitted[l.id]
                  const drafted = levelDrafts[l.id]
                  const isCurrent = activeTab === l.id
                  return (
                    <div
                      key={l.id}
                      className={`flex items-center gap-3 rounded-2xl border p-3 transition ${
                        submitted ? 'border-emerald-200 bg-emerald-50/70'
                        : drafted ? 'border-teal-200 bg-teal-50/60'
                        : isCurrent ? 'border-blue-200 bg-blue-50/60'
                        : 'border-slate-200 bg-white/80'
                      }`}
                    >
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${
                        submitted ? 'bg-emerald-500 text-white'
                        : drafted ? 'bg-teal-500 text-white'
                        : 'border border-slate-300 bg-white text-slate-400'
                      }`}>
                        {submitted ? <CheckCircle2 className="h-4 w-4" /> : drafted ? <Check className="h-4 w-4" /> : idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-bold text-slate-900">{l.label}</div>
                        <div className="text-[10px] font-semibold text-slate-400">
                          {submitted ? 'Submitted to Project Admin' : drafted ? 'Draft saved — ready to submit' : 'Not started'}
                        </div>
                      </div>
                      {!isCurrent && (
                        <button
                          type="button"
                          onClick={() => { setActiveTab(l.id); setJourneyOpen(false) }}
                          className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600 transition hover:bg-slate-50"
                        >
                          Go
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Final review action — unlocked when all levels drafted */}
              <div className="border-t border-slate-200/80 bg-white/70 p-4">
                {(() => {
                  const doneCount = JOURNEY_LEVELS.filter(l => levelDrafts[l.id] || levelSubmitted[l.id]).length
                  const allDone = doneCount === JOURNEY_LEVELS.length
                  return (
                    <>
                      <div className="mb-2.5 flex items-center justify-between text-[11px] font-bold">
                        <span className="text-slate-500">Journey progress</span>
                        <span className={allDone ? 'text-emerald-600' : 'text-slate-600'}>{doneCount}/{JOURNEY_LEVELS.length}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-600 transition-all duration-500" style={{ width: `${(doneCount / JOURNEY_LEVELS.length) * 100}%` }} />
                      </div>
                      <button
                        type="button"
                        disabled={!allDone || submittingAll}
                        onClick={() => setShowFinalReview(true)}
                        title={allDone ? 'Open the consolidated final review' : 'Draft all levels to unlock the final review'}
                        className={`mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-xs font-extrabold transition ${
                          allDone
                            ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-lg shadow-teal-500/25 hover:from-teal-700 hover:to-cyan-700'
                            : 'cursor-not-allowed bg-slate-100 text-slate-400'
                        }`}
                      >
                        <FileCheck2 className="h-4 w-4" />
                        <span>{allDone ? 'Final Review & Submit' : 'Final Review & Submit (locked)'}</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </>
                  )
                })()}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── FINAL REVIEW — full-screen review of every entered level ── */}
      <FinalSubmitAllModal
        open={showFinalReview}
        onClose={() => !submittingAll && setShowFinalReview(false)}
        projectName={hrData.workforceProfile?.common?.entityName || 'Corporate HR & Talent Management'}
        periodLabel={(hrData.workforceProfile?.common as any)?.financialYear || 'FY 2026-27'}
        submitting={submittingAll}
        onSubmitAll={handleFinalSubmit}
        levels={hrModalLevels}
        allData={hrAllData}
        projectId={selectedProjectId || null}
        periodId="current"
        evidenceList={evidenceItems.map(ev => ({ name: ev.fileName, id: ev.id }))}
        submitterRole="HR / Workforce Contributor"
      />

      {/* ── Success confirmation — shown after the PA ledger accepts the dossier ── */}
      <SubmitAllSuccessModal
        open={showSubmitSuccess}
        onClose={() => {
          setShowSubmitSuccess(false)
          setActiveTab('submissions')
        }}
        projectName={hrData.workforceProfile?.common?.entityName || 'Corporate HR & Talent Management'}
        periodLabel={(hrData.workforceProfile?.common as any)?.financialYear || 'FY 2026-27'}
        submittedCount={JOURNEY_LEVELS.length}
        totalLevels={JOURNEY_LEVELS.length}
        items={evidenceItems.slice(0, 5).map(ev => ({ name: ev.fileName }))}
      />

      {/* Validation modal */}
      {showValidationModal && (
        <CommonValidationModal
          isOpen={showValidationModal}
          roleKey="HR_USER"
          levelName={activeTab.toUpperCase()}
          hrData={hrData}
          onClose={() => setShowValidationModal(false)}
          onSubmitSuccess={() => {
            setShowValidationModal(false)
            triggerToast('Disclosures successfully submitted to Project Admin.')
            setActiveTab('submissions')
            refreshRealSubmissions()
          }}
        />
      )}

      {/* Evidence Viewer modal */}
      {reviewEvidence && (
        <FullscreenEvidenceModal
          evidence={reviewEvidence}
          onClose={() => setReviewEvidence(null)}
        />
      )}
    </div>
  )
}
