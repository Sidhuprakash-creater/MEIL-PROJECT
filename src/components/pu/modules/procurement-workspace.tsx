'use client'
/**
 * ProcurementWorkspace — MEIL ESG / BRSR Reporting Platform
 *
 * Supply Chain Data Contributor Workspace:
 * - Level 0: Universal Common Reporting Fields (all 24 fields)
 * - Level SC-1: Supplier Master Data (Tier 1/2, MSME, Domestic/Intl, ERP ref)
 * - Level SC-2: Procurement & Supplier Spend References (Spend, PO, Contract ref)
 * - Level SC-3: Supplier ESG Assessment (Environmental, Social, Governance scores, Risk class)
 * - Level SC-4: Supplier Certifications & Standards (ISO 14001/45001, Expiry tracking)
 * - Level SC-5: Supplier Code of Conduct (Formal sign-offs, Policy version)
 * - Level SC-6: Supplier Audits & Corrective Actions (Findings, CAPA, Closure status)
 * - Level SC-7: Value-Chain Data (Scope 3, Product carbon footprint, Primary data)
 * - Screen 1: Supply Chain Console (6 Dashboard Cards + My Supply Chain Assignments Table)
 * - Evidence & Documents Repository
 * - Shared Validation & Multi-state Submission Workflow
 */
import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package, ShoppingCart, GitBranch, ClipboardCheck, Leaf, ShieldCheck,
  CheckCircle2, Clock, AlertTriangle, ArrowRight, Save, Send, Upload,
  RefreshCw, Sparkles, Filter, Eye, Edit3, ChevronRight, Layers, FileText,
  TrendingUp, Building2, FileCheck2, History, Award, CheckSquare, X, Check} from 'lucide-react'
import { toast } from 'sonner'
import { FinalSubmitAllModal, SubmitAllSuccessModal } from '@/components/shared/submission-flow-modals'
import { useApp } from '@/lib/pu/auth-context'
import {
  contributorStore,
  type ContributorAssignment,
  type ActivityEvent
} from '@/lib/pu/contributor-store'
import { CommonLevel0Card } from './common-level0-card'
import { CommonEvidenceManager } from './common-evidence-manager'
import { CommonValidationModal } from './common-validation-modal'

/* Sidebar module → default workspace tab */
const MODULE_TABS: Record<string, string> = {
  'proc-suppliers': 'sc-1',
  'proc-assessments': 'sc-3',
  'proc-sourcing': 'sc-4',
  'proc-transactions': 'sc-2',
  'proc-valuechain': 'sc-7',
  evidence: 'evidence',
  submissions: 'submissions',
}

export function ProcurementWorkspace() {
  const { activeModule, selectedProjectId } = useApp()
  const [activeTab, setActiveTab] = useState<string>('overview')
  const [scData, setScData] = useState(() => contributorStore.getScData())
  const [assignments, setAssignments] = useState<ContributorAssignment[]>(() => contributorStore.getAssignments('PROCUREMENT_USER'))
  const [activities, setActivities] = useState<ActivityEvent[]>(() => contributorStore.getActivities('PROCUREMENT_USER'))
  const [saveStatus, setSaveStatus] = useState<string>('Saved')
  const [showValidationModal, setShowValidationModal] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  /* Re-map the active tab when the sidebar module changes — render-time
     adjustment (the sanctioned alternative to setState-in-effect). */
  const [prevModule, setPrevModule] = useState(activeModule)
  if (prevModule !== activeModule) {
    setPrevModule(activeModule)
    const mapped = MODULE_TABS[activeModule]
    if (mapped) setActiveTab(mapped)
  }

  const triggerToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const handleSaveDraft = (levelLabel: string) => {
    setSaveStatus('Saving...')
    contributorStore.saveScData(scData)
    setTimeout(() => {
      setSaveStatus('Draft Saved')
      triggerToast(`${levelLabel} draft saved successfully.`)
      contributorStore.addActivity({
        id: 'act-' + Date.now(),
        roleKey: 'PROCUREMENT_USER',
        timestamp: 'Just now',
        user: 'Ramesh Varma (SCM)',
        action: 'Saved Draft',
        target: levelLabel,
        details: 'Supplier ESG records updated in persistent enterprise store.',
        badgeTone: 'blue'
      })
      setActivities(contributorStore.getActivities('PROCUREMENT_USER'))
      setTimeout(() => setSaveStatus('Saved'), 2000)
    }, 400)
  }

  // Composite ESG Assessment score
  const avgEsgScore = (
    (Number(scData.assessment.environmentalCriteriaScore) || 0) +
    (Number(scData.assessment.labourSocialCriteriaScore) || 0) +
    (Number(scData.assessment.healthSafetyCriteriaScore) || 0) +
    (Number(scData.assessment.humanRightsCriteriaScore) || 0) +
    (Number(scData.assessment.governanceEthicsCriteriaScore) || 0)
  ) / 5

  const tabList = [
    { id: 'overview', label: 'Supply Chain Console' },
    { id: 'sc-1', label: 'SC-1: Supplier Master' },
    { id: 'sc-2', label: 'SC-2: Spend References' },
    { id: 'sc-3', label: 'SC-3: ESG Assessments' },
    { id: 'sc-4', label: 'SC-4: Certifications' },
    { id: 'sc-5', label: 'SC-5: Code of Conduct' },
    { id: 'sc-6', label: 'SC-6: Audits & CAPA' },
    { id: 'sc-7', label: 'SC-7: Value Chain' },
    { id: 'evidence', label: 'Evidence & Documents' },
    { id: 'submissions', label: 'My Submissions' },
    { id: 'activity', label: 'Activity Log' }
  ]

  /* ── Level journey — drafts tracked level-by-level ── */
  const JOURNEY_LEVELS: Array<{ id: string; label: string; level: number; levelName: string; dataKey: string }> = [
    { id: 'sc-1', label: 'Supplier Master', level: 1, levelName: 'Supplier Master (SC-1)', dataKey: 'supplierMaster' },
    { id: 'sc-2', label: 'Procurement Spend', level: 2, levelName: 'Procurement Spend (SC-2)', dataKey: 'spend' },
    { id: 'sc-3', label: 'Supplier ESG Assessments', level: 3, levelName: 'Supplier ESG Assessments (SC-3)', dataKey: 'assessment' },
    { id: 'sc-4', label: 'Supplier Certifications', level: 4, levelName: 'Supplier Certifications (SC-4)', dataKey: 'certifications' },
    { id: 'sc-5', label: 'Code of Conduct', level: 5, levelName: 'Code of Conduct (SC-5)', dataKey: 'codeOfConduct' },
    { id: 'sc-6', label: 'Audits & CAPA', level: 6, levelName: 'Audits & CAPA (SC-6)', dataKey: 'audits' },
    { id: 'sc-7', label: 'Value Chain Data', level: 7, levelName: 'Value Chain Data (SC-7)', dataKey: 'valueChain' },
  ]

  const [journeyOpen, setJourneyOpen] = useState(false)
  const [levelDrafts, setLevelDrafts] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('procurement_user-level-drafts') || '{}') } catch { return {} }
  })
  const [levelSubmitted, setLevelSubmitted] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('procurement_user-level-submitted') || '{}') } catch { return {} }
  })
  const [levelSubmitting, setLevelSubmitting] = useState<string | null>(null)
  const [showFinalReview, setShowFinalReview] = useState(false)
  const [submittingAll, setSubmittingAll] = useState(false)
  const [showSubmitSuccess, setShowSubmitSuccess] = useState(false)

  const persistJourney = (drafts: Record<string, boolean>, submitted: Record<string, boolean>) => {
    try {
      localStorage.setItem('procurement_user-level-drafts', JSON.stringify(drafts))
      localStorage.setItem('procurement_user-level-submitted', JSON.stringify(submitted))
    } catch {}
  }

  const markLevelDrafted = (id: string) => {
    const d = { ...levelDrafts, [id]: true }
    setLevelDrafts(d)
    persistJourney(d, levelSubmitted)
  }

  const handleLevelSubmit = async (screenId: string) => {
    const def = JOURNEY_LEVELS.find(l => l.id === screenId)
    if (!def || levelSubmitting) return
    setLevelSubmitting(screenId)
    try {
      const post = await fetch('/api/pu/data-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: def.level,
          levelKey: 'level' + def.level,
          levelName: def.levelName,
          module: 'PROCUREMENT',
          data: {
            levelData: (scData as any)[def.dataKey] ?? {},
            remarks: 'Individual level submission from contributor workspace.',
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
        roleKey: 'PROCUREMENT_USER',
        timestamp: 'Just now',
        user: 'Priya Nair (Procurement)',
        action: 'Submitted',
        target: def.levelName,
        details: 'Level submitted individually to the Project Admin.',
        badgeTone: 'green'
      })
      toast.success(def.levelName + ' submitted to Project Admin')
    } catch (e: any) {
      toast.error('Submission failed', { description: e?.message || 'Network error.' })
    } finally {
      setLevelSubmitting(null)
    }
  }

  const handleFinalSubmit = async (): Promise<boolean> => {
    setSubmittingAll(true)
    try {
      const post = await fetch('/api/pu/data-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 9,
          levelKey: 'level9',
          levelName: 'Consolidated Contributor Package (All Levels)',
          module: 'PROCUREMENT',
          data: { ...scData, remarks: 'Final consolidated submission — all levels.' },
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

  const allData: Record<string, any> = {}
  for (const l of JOURNEY_LEVELS) {
    allData['l' + l.level + '-' + (selectedProjectId || 'cur') + '-current'] = { items: [{ id: l.id, title: l.label, ...( (scData as any)[l.dataKey] ?? {} ) }] }
  }

  const modalLevels = JOURNEY_LEVELS.map(l => ({ key: l.id, level: l.level, label: l.label, icon: Layers }))

  return (
    <div className="space-y-6 pb-12">
      {/* Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-50 flex items-center gap-2 rounded-2xl border border-blue-200 bg-white/95 px-4 py-3 shadow-xl shadow-blue-500/10 backdrop-blur-xl text-xs font-bold text-blue-800"
          >
            <CheckCircle2 className="h-4 w-4 text-blue-600" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER SECTION */}
      <div className="relative overflow-hidden glass-form-card md:!p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25">
                <Package className="h-6 w-6" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
                Supply Chain Data Contributor Workspace
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50/80 px-3 py-1 text-xs font-bold text-blue-700 shadow-xs">
                <Sparkles className="h-3 w-3 text-blue-600" />
                BRSR Core Value Chain
              </span>
            </div>
            <p className="text-sm font-medium text-slate-500">
              Supplier master register · Procurement references · ESG due diligence · ISO certifications & Scope 3 footprints
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <span className="rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-xs font-bold text-slate-700 shadow-xs">
              FY 2026-27 (Assigned)
            </span>
          </div>
        </div>

        {/* Tab Sub-Navigation */}
        <div className="mt-6 flex flex-wrap items-center gap-1.5 pt-4 border-t border-slate-100">
          {tabList.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                  : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 1. SUPPLY CHAIN CONSOLE OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* 6 Dashboard Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
            {[
              { label: 'Assigned Supplier Records', val: '50 Vendors', sub: 'Top Spend Scope', icon: Layers, tone: 'text-blue-600 bg-blue-50' },
              { label: 'Pending Supplier Data', val: '8 Vendors', sub: 'Questionnaire Due', icon: Clock, tone: 'text-amber-600 bg-amber-50' },
              { label: 'Assessments Due', val: '12 Audits', sub: 'Q3 Schedule', icon: ClipboardCheck, tone: 'text-indigo-600 bg-indigo-50' },
              { label: 'Evidence Missing', val: '2 Files', sub: 'Cert Renewal Pending', icon: AlertTriangle, tone: 'text-rose-600 bg-rose-50' },
              { label: 'Assessments Done', val: '38 Completed', sub: 'Avg Score: 92/100', icon: CheckCircle2, tone: 'text-emerald-600 bg-emerald-50' },
              { label: 'Returned Records', val: '0 Items', sub: 'Clean Queue', icon: ShieldCheck, tone: 'text-purple-600 bg-purple-50' },
            ].map((card, i) => (
              <div key={i} className="rounded-[22px] border border-white/60 bg-white/75 p-4 shadow-lg shadow-sky-500/5 backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500">{card.label}</span>
                  <div className={`p-1.5 rounded-lg ${card.tone}`}>
                    <card.icon className="h-3.5 w-3.5" />
                  </div>
                </div>
                <div className="mt-2 text-lg font-black text-slate-900">{card.val}</div>
                <div className="text-[11px] text-slate-400 font-medium truncate">{card.sub}</div>
              </div>
            ))}
          </div>

          {/* SCM Highlight Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-[24px] border border-white/60 bg-white/75 p-5 shadow-lg shadow-sky-500/5 backdrop-blur-xl">
              <span className="text-xs font-bold text-slate-500">Tier-1 Critical Vendor Master</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">{scData.supplierMaster.supplierName}</span>
              </div>
              <div className="mt-3 text-xs text-slate-500 space-y-1">
                <div className="flex justify-between">
                  <span>Vendor ID:</span>
                  <span className="font-bold text-blue-700">{scData.supplierMaster.supplierId}</span>
                </div>
                <div className="flex justify-between">
                  <span>Classification:</span>
                  <span className="font-bold text-slate-800">{scData.supplierMaster.supplierCategory}</span>
                </div>
                <div className="flex justify-between">
                  <span>Origin:</span>
                  <span className="font-bold text-slate-800">{scData.supplierMaster.countryState}</span>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/60 bg-white/75 p-5 shadow-lg shadow-sky-500/5 backdrop-blur-xl">
              <span className="text-xs font-bold text-slate-500">ESG Assessment Composite</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">{avgEsgScore.toFixed(0)} / 100</span>
                <span className="text-xs font-semibold text-emerald-600">{scData.assessment.assessmentResult}</span>
              </div>
              <div className="mt-3 text-xs text-slate-500 space-y-1">
                <div className="flex justify-between">
                  <span>Environmental:</span>
                  <span className="font-bold text-slate-800">{scData.assessment.environmentalCriteriaScore}/100</span>
                </div>
                <div className="flex justify-between">
                  <span>Social & Labour:</span>
                  <span className="font-bold text-slate-800">{scData.assessment.labourSocialCriteriaScore}/100</span>
                </div>
                <div className="flex justify-between">
                  <span>Governance:</span>
                  <span className="font-bold text-slate-800">{scData.assessment.governanceEthicsCriteriaScore}/100</span>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/60 bg-white/75 p-5 shadow-lg shadow-sky-500/5 backdrop-blur-xl">
              <span className="text-xs font-bold text-slate-500">Standards & Scope 3 Footprint</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">{scData.valueChain.activityQuantityOrValue}</span>
                <span className="text-xs font-semibold text-teal-600">{scData.valueChain.unit}</span>
              </div>
              <div className="mt-3 text-xs text-slate-500 space-y-1">
                <div className="flex justify-between">
                  <span>Certified Standard:</span>
                  <span className="font-bold text-slate-800">{scData.certifications.certificationName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Validity:</span>
                  <span className="font-bold text-emerald-700">{scData.certifications.verificationStatus}</span>
                </div>
                <div className="flex justify-between">
                  <span>Code of Conduct:</span>
                  <span className="font-bold text-blue-700">{scData.codeOfConduct.acceptanceStatus}</span>
                </div>
              </div>
            </div>
          </div>

          {/* My Supply Chain Assignments Table */}
          <div className="rounded-[24px] border border-white/60 bg-white/75 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">My Supply Chain Assignments</h3>
                <p className="text-xs text-slate-500">Value chain disclosure tasks assigned to procurement</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('sc-1')}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <span>Enter Supplier Disclosures</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="pb-3">Division</th>
                    <th className="pb-3">Year</th>
                    <th className="pb-3">Module</th>
                    <th className="pb-3">Completion</th>
                    <th className="pb-3">Evidence</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Last Updated</th>
                    <th className="pb-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assignments.map((asg) => (
                    <tr key={asg.id} className="hover:bg-slate-50/50">
                      <td className="py-3 font-semibold text-slate-800">{asg.entityBu}</td>
                      <td className="py-3 text-slate-600">{asg.reportingYear}</td>
                      <td className="py-3 font-bold text-blue-700">{asg.module}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${asg.completionPercentage}%` }} />
                          </div>
                          <span className="font-bold text-slate-700">{asg.completionPercentage}%</span>
                        </div>
                      </td>
                      <td className="py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          asg.evidenceStatus === 'Attached' || asg.evidenceStatus === 'Verified'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}>
                          {asg.evidenceStatus}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          asg.submissionStatus === 'Accepted' ? 'bg-emerald-50 text-emerald-700' :
                          asg.submissionStatus === 'Submitted' ? 'bg-blue-50 text-blue-700' :
                          asg.submissionStatus === 'Under Review' ? 'bg-purple-50 text-purple-700' :
                          'bg-amber-50 text-amber-700'
                        }`}>
                          {asg.submissionStatus}
                        </span>
                      </td>
                      <td className="py-3 text-slate-400">{asg.lastUpdated}</td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            if (asg.levelKey === 'SC-1') setActiveTab('sc-1')
                            else if (asg.levelKey === 'SC-3') setActiveTab('sc-3')
                            else if (asg.levelKey === 'SC-5') setActiveTab('sc-5')
                            else setActiveTab('sc-1')
                          }}
                          className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors"
                        >
                          Enter Data
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

      {/* 2. LEVEL SC-1 — SUPPLIER MASTER */}
      {activeTab === 'sc-1' && (
        <div className="space-y-6">
          {/* Per-level individual submission to Project Admin */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/70 px-4 py-3 shadow-sm backdrop-blur-xl">
            <span className="text-xs font-semibold text-slate-600">
              This level&apos;s data can be submitted individually — it reaches the Project Admin instantly.
            </span>
            <button
              type="button"
              disabled={levelSubmitting === 'sc-1'}
              onClick={() => handleLevelSubmit('sc-1')}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-indigo-500/25 transition hover:-translate-y-0.5 active:scale-95 disabled:opacity-60"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{levelSubmitting === 'sc-1' ? 'Submitting…' : 'Submit to Project Admin'}</span>
            </button>
          </div>
          <CommonLevel0Card
            fields={scData.supplierMaster.common}
            accentColor="blue"
            onChange={(upd) => setScData({
              ...scData,
              supplierMaster: { ...scData.supplierMaster, common: { ...scData.supplierMaster.common, ...upd } }
            })}
          />

          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title">Level SC-1 — Supplier Master Data</h3>
              <p className="text-xs text-slate-500">Maintain standardized supplier identities, categories, and ERP master linkage</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="ios-label">Supplier ID</label>
                <input
                  type="text"
                  value={scData.supplierMaster.supplierId}
                  onChange={(e) => setScData({
                    ...scData,
                    supplierMaster: { ...scData.supplierMaster, supplierId: e.target.value }
                  })}
                  className="ios-field !text-xs font-mono font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Supplier Name</label>
                <input
                  type="text"
                  value={scData.supplierMaster.supplierName}
                  onChange={(e) => setScData({
                    ...scData,
                    supplierMaster: { ...scData.supplierMaster, supplierName: e.target.value }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Supplier Type</label>
                <select
                  value={scData.supplierMaster.supplierType}
                  onChange={(e) => setScData({
                    ...scData,
                    supplierMaster: { ...scData.supplierMaster, supplierType: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Tier 1">Tier 1</option>
                  <option value="Tier 2">Tier 2</option>
                  <option value="Material Supplier">Material Supplier</option>
                  <option value="Service Provider">Service Provider</option>
                  <option value="Equipment Vendor">Equipment Vendor</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Supplier Category</label>
                <select
                  value={scData.supplierMaster.supplierCategory}
                  onChange={(e) => setScData({
                    ...scData,
                    supplierMaster: { ...scData.supplierMaster, supplierCategory: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="MSME">MSME</option>
                  <option value="Large Enterprise">Large Enterprise</option>
                  <option value="Startup">Startup</option>
                  <option value="Local Community Vendor">Local Community Vendor</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Domestic / International</label>
                <select
                  value={scData.supplierMaster.domesticInternational}
                  onChange={(e) => setScData({
                    ...scData,
                    supplierMaster: { ...scData.supplierMaster, domesticInternational: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Domestic (India)">Domestic (India)</option>
                  <option value="International">International</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Country / State</label>
                <input
                  type="text"
                  value={scData.supplierMaster.countryState}
                  onChange={(e) => setScData({
                    ...scData,
                    supplierMaster: { ...scData.supplierMaster, countryState: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Operating Business Unit</label>
                <input
                  type="text"
                  value={scData.supplierMaster.businessUnit}
                  onChange={(e) => setScData({
                    ...scData,
                    supplierMaster: { ...scData.supplierMaster, businessUnit: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Active Status</label>
                <select
                  value={scData.supplierMaster.activeStatus}
                  onChange={(e) => setScData({
                    ...scData,
                    supplierMaster: { ...scData.supplierMaster, activeStatus: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Under Audit">Under Audit</option>
                  <option value="Blacklisted">Blacklisted</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. LEVEL SC-2 — PROCUREMENT SPEND REFERENCES */}
      {activeTab === 'sc-2' && (
        <div className="space-y-6">
          {/* Per-level individual submission to Project Admin */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/70 px-4 py-3 shadow-sm backdrop-blur-xl">
            <span className="text-xs font-semibold text-slate-600">
              This level&apos;s data can be submitted individually — it reaches the Project Admin instantly.
            </span>
            <button
              type="button"
              disabled={levelSubmitting === 'sc-2'}
              onClick={() => handleLevelSubmit('sc-2')}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-indigo-500/25 transition hover:-translate-y-0.5 active:scale-95 disabled:opacity-60"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{levelSubmitting === 'sc-2' ? 'Submitting…' : 'Submit to Project Admin'}</span>
            </button>
          </div>
          <CommonLevel0Card
            fields={scData.spend.common}
            accentColor="blue"
            onChange={(upd) => setScData({
              ...scData,
              spend: { ...scData.spend, common: { ...scData.spend.common, ...upd } }
            })}
          />

          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title">Level SC-2 — Procurement & Spend References</h3>
              <p className="text-xs text-slate-500">Link verified supplier procurement amounts to ERP purchase orders and finance ledgers</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="ios-label">Supplier ID</label>
                <input
                  type="text"
                  value={scData.spend.supplierId}
                  onChange={(e) => setScData({
                    ...scData,
                    spend: { ...scData.spend, supplierId: e.target.value }
                  })}
                  className="ios-field !text-xs font-mono font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Procurement Category</label>
                <select
                  value={scData.spend.procurementCategory}
                  onChange={(e) => setScData({
                    ...scData,
                    spend: { ...scData.spend, procurementCategory: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Raw Materials (Steel/Cement)">Raw Materials (Steel/Cement)</option>
                  <option value="Heavy Equipment">Heavy Equipment</option>
                  <option value="Subcontracting Work">Subcontracting Work</option>
                  <option value="Logistics & Transport">Logistics & Transport</option>
                  <option value="Consulting & Services">Consulting & Services</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Procurement Amount (₹ Cr)</label>
                <input
                  type="number"
                  value={scData.spend.procurementAmount}
                  onChange={(e) => setScData({
                    ...scData,
                    spend: { ...scData.spend, procurementAmount: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Currency</label>
                <select
                  value={scData.spend.currency}
                  onChange={(e) => setScData({
                    ...scData,
                    spend: { ...scData.spend, currency: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="INR (₹)">INR (₹)</option>
                  <option value="USD ($)">USD ($)</option>
                  <option value="EUR (€)">EUR (€)</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Purchase / Contract Reference</label>
                <input
                  type="text"
                  value={scData.spend.purchaseContractRef}
                  onChange={(e) => setScData({
                    ...scData,
                    spend: { ...scData.spend, purchaseContractRef: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="ios-label">Source Ledger / ERP Reference</label>
                <input
                  type="text"
                  value={scData.spend.sourceLedgerErpRef}
                  onChange={(e) => setScData({
                    ...scData,
                    spend: { ...scData.spend, sourceLedgerErpRef: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. LEVEL SC-3 — SUPPLIER ESG ASSESSMENT */}
      {activeTab === 'sc-3' && (
        <div className="space-y-6">
          {/* Per-level individual submission to Project Admin */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/70 px-4 py-3 shadow-sm backdrop-blur-xl">
            <span className="text-xs font-semibold text-slate-600">
              This level&apos;s data can be submitted individually — it reaches the Project Admin instantly.
            </span>
            <button
              type="button"
              disabled={levelSubmitting === 'sc-3'}
              onClick={() => handleLevelSubmit('sc-3')}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-indigo-500/25 transition hover:-translate-y-0.5 active:scale-95 disabled:opacity-60"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{levelSubmitting === 'sc-3' ? 'Submitting…' : 'Submit to Project Admin'}</span>
            </button>
          </div>
          <CommonLevel0Card
            fields={scData.assessment.common}
            accentColor="blue"
            onChange={(upd) => setScData({
              ...scData,
              assessment: { ...scData.assessment, common: { ...scData.assessment.common, ...upd } }
            })}
          />

          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title">Level SC-3 — Supplier ESG Assessment</h3>
              <p className="text-xs text-slate-500">Record 5-pillar sustainability ratings, risk tiering and CAPA follow-up</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
              <div>
                <label className="ios-label">Environmental Score</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={scData.assessment.environmentalCriteriaScore}
                  onChange={(e) => setScData({
                    ...scData,
                    assessment: { ...scData.assessment, environmentalCriteriaScore: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Labour & Social Score</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={scData.assessment.labourSocialCriteriaScore}
                  onChange={(e) => setScData({
                    ...scData,
                    assessment: { ...scData.assessment, labourSocialCriteriaScore: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Health & Safety Score</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={scData.assessment.healthSafetyCriteriaScore}
                  onChange={(e) => setScData({
                    ...scData,
                    assessment: { ...scData.assessment, healthSafetyCriteriaScore: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Human Rights Score</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={scData.assessment.humanRightsCriteriaScore}
                  onChange={(e) => setScData({
                    ...scData,
                    assessment: { ...scData.assessment, humanRightsCriteriaScore: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Ethics & Governance</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={scData.assessment.governanceEthicsCriteriaScore}
                  onChange={(e) => setScData({
                    ...scData,
                    assessment: { ...scData.assessment, governanceEthicsCriteriaScore: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs pt-2">
              <div>
                <label className="ios-label">Assessment Result</label>
                <select
                  value={scData.assessment.assessmentResult}
                  onChange={(e) => setScData({
                    ...scData,
                    assessment: { ...scData.assessment, assessmentResult: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="High ESG Compliance">High ESG Compliance</option>
                  <option value="Moderate Risk">Moderate Risk</option>
                  <option value="Needs Corrective Action">Needs Corrective Action</option>
                  <option value="Disqualified">Disqualified</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Risk Classification</label>
                <select
                  value={scData.assessment.riskClassification}
                  onChange={(e) => setScData({
                    ...scData,
                    assessment: { ...scData.assessment, riskClassification: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Low Risk">Low Risk</option>
                  <option value="Medium Risk">Medium Risk</option>
                  <option value="High Risk">High Risk</option>
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="ios-label">Key Findings</label>
                <input
                  type="text"
                  value={scData.assessment.findings}
                  onChange={(e) => setScData({
                    ...scData,
                    assessment: { ...scData.assessment, findings: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. LEVEL SC-4 — CERTIFICATIONS */}
      {activeTab === 'sc-4' && (
        <div className="space-y-6">
          {/* Per-level individual submission to Project Admin */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/70 px-4 py-3 shadow-sm backdrop-blur-xl">
            <span className="text-xs font-semibold text-slate-600">
              This level&apos;s data can be submitted individually — it reaches the Project Admin instantly.
            </span>
            <button
              type="button"
              disabled={levelSubmitting === 'sc-4'}
              onClick={() => handleLevelSubmit('sc-4')}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-indigo-500/25 transition hover:-translate-y-0.5 active:scale-95 disabled:opacity-60"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{levelSubmitting === 'sc-4' ? 'Submitting…' : 'Submit to Project Admin'}</span>
            </button>
          </div>
          <CommonLevel0Card
            fields={scData.certifications.common}
            accentColor="blue"
            onChange={(upd) => setScData({
              ...scData,
              certifications: { ...scData.certifications, common: { ...scData.certifications.common, ...upd } }
            })}
          />

          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title">Level SC-4 — Supplier Certifications</h3>
              <p className="text-xs text-slate-500">Record verified ISO 14001, ISO 45001, SA8000 and GreenPro certificates</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="ios-label">Certification Name</label>
                <select
                  value={scData.certifications.certificationName}
                  onChange={(e) => setScData({
                    ...scData,
                    certifications: { ...scData.certifications, certificationName: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="ISO 14001 (Environment)">ISO 14001 (Environment)</option>
                  <option value="ISO 45001 (Safety)">ISO 45001 (Safety)</option>
                  <option value="ISO 9001 (Quality)">ISO 9001 (Quality)</option>
                  <option value="SA8000 (Social Accountability)">SA8000 (Social Accountability)</option>
                  <option value="BIS Standard">BIS Standard</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Certificate Number</label>
                <input
                  type="text"
                  value={scData.certifications.certificationNumber}
                  onChange={(e) => setScData({
                    ...scData,
                    certifications: { ...scData.certifications, certificationNumber: e.target.value }
                  })}
                  className="ios-field !text-xs font-mono font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Issuing Organization</label>
                <input
                  type="text"
                  value={scData.certifications.issuingOrganization}
                  onChange={(e) => setScData({
                    ...scData,
                    certifications: { ...scData.certifications, issuingOrganization: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Verification Status</label>
                <select
                  value={scData.certifications.verificationStatus}
                  onChange={(e) => setScData({
                    ...scData,
                    certifications: { ...scData.certifications, verificationStatus: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Verified Valid">Verified Valid</option>
                  <option value="Pending Verification">Pending Verification</option>
                  <option value="Expired">Expired</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Issue Date</label>
                <input
                  type="date"
                  value={scData.certifications.issueDate}
                  onChange={(e) => setScData({
                    ...scData,
                    certifications: { ...scData.certifications, issueDate: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Expiry Date</label>
                <input
                  type="date"
                  value={scData.certifications.expiryDate}
                  onChange={(e) => setScData({
                    ...scData,
                    certifications: { ...scData.certifications, expiryDate: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="ios-label">Certification Scope</label>
                <input
                  type="text"
                  value={scData.certifications.certificationScope}
                  onChange={(e) => setScData({
                    ...scData,
                    certifications: { ...scData.certifications, certificationScope: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. LEVEL SC-5 — CODE OF CONDUCT */}
      {activeTab === 'sc-5' && (
        <div className="space-y-6">
          {/* Per-level individual submission to Project Admin */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/70 px-4 py-3 shadow-sm backdrop-blur-xl">
            <span className="text-xs font-semibold text-slate-600">
              This level&apos;s data can be submitted individually — it reaches the Project Admin instantly.
            </span>
            <button
              type="button"
              disabled={levelSubmitting === 'sc-5'}
              onClick={() => handleLevelSubmit('sc-5')}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-indigo-500/25 transition hover:-translate-y-0.5 active:scale-95 disabled:opacity-60"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{levelSubmitting === 'sc-5' ? 'Submitting…' : 'Submit to Project Admin'}</span>
            </button>
          </div>
          <CommonLevel0Card
            fields={scData.codeOfConduct.common}
            accentColor="blue"
            onChange={(upd) => setScData({
              ...scData,
              codeOfConduct: { ...scData.codeOfConduct, common: { ...scData.codeOfConduct.common, ...upd } }
            })}
          />

          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title">Level SC-5 — Supplier Code of Conduct</h3>
              <p className="text-xs text-slate-500">Track formal supplier sign-offs on anti-corruption, forced labour, and safety</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="ios-label">Applicable Policy Code</label>
                <input
                  type="text"
                  value={scData.codeOfConduct.applicableCodePolicy}
                  onChange={(e) => setScData({
                    ...scData,
                    codeOfConduct: { ...scData.codeOfConduct, applicableCodePolicy: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Policy Version</label>
                <input
                  type="text"
                  value={scData.codeOfConduct.codeVersion}
                  onChange={(e) => setScData({
                    ...scData,
                    codeOfConduct: { ...scData.codeOfConduct, codeVersion: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Acceptance Status</label>
                <select
                  value={scData.codeOfConduct.acceptanceStatus}
                  onChange={(e) => setScData({
                    ...scData,
                    codeOfConduct: { ...scData.codeOfConduct, acceptanceStatus: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Formally Accepted & Signed">Formally Accepted & Signed</option>
                  <option value="Pending Acknowledgement">Pending Acknowledgement</option>
                  <option value="Exceptions Raised">Exceptions Raised</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Acceptance Date</label>
                <input
                  type="date"
                  value={scData.codeOfConduct.acceptanceDate}
                  onChange={(e) => setScData({
                    ...scData,
                    codeOfConduct: { ...scData.codeOfConduct, acceptanceDate: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. LEVEL SC-6 — AUDITS & CAPA */}
      {activeTab === 'sc-6' && (
        <div className="space-y-6">
          {/* Per-level individual submission to Project Admin */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/70 px-4 py-3 shadow-sm backdrop-blur-xl">
            <span className="text-xs font-semibold text-slate-600">
              This level&apos;s data can be submitted individually — it reaches the Project Admin instantly.
            </span>
            <button
              type="button"
              disabled={levelSubmitting === 'sc-6'}
              onClick={() => handleLevelSubmit('sc-6')}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-indigo-500/25 transition hover:-translate-y-0.5 active:scale-95 disabled:opacity-60"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{levelSubmitting === 'sc-6' ? 'Submitting…' : 'Submit to Project Admin'}</span>
            </button>
          </div>
          <CommonLevel0Card
            fields={scData.audits.common}
            accentColor="blue"
            onChange={(upd) => setScData({
              ...scData,
              audits: { ...scData.audits, common: { ...scData.audits.common, ...upd } }
            })}
          />

          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title">Level SC-6 — Supplier Audits & Corrective Actions</h3>
              <p className="text-xs text-slate-500">Track on-site sustainability inspection findings and overdue CAPA closures</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="ios-label">Audit Type</label>
                <select
                  value={scData.audits.auditType}
                  onChange={(e) => setScData({
                    ...scData,
                    audits: { ...scData.audits, auditType: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Periodic Sustainability Audit">Periodic Sustainability Audit</option>
                  <option value="Pre-qualification Audit">Pre-qualification Audit</option>
                  <option value="Incident-triggered Audit">Incident-triggered Audit</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Risk Level</label>
                <select
                  value={scData.audits.riskLevel}
                  onChange={(e) => setScData({
                    ...scData,
                    audits: { ...scData.audits, riskLevel: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Closure Status</label>
                <select
                  value={scData.audits.closureStatus}
                  onChange={(e) => setScData({
                    ...scData,
                    audits: { ...scData.audits, closureStatus: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Closed">Closed</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Overdue">Overdue</option>
                  <option value="Open">Open</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Due Date</label>
                <input
                  type="date"
                  value={scData.audits.dueDate}
                  onChange={(e) => setScData({
                    ...scData,
                    audits: { ...scData.audits, dueDate: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="ios-label">Audit Findings</label>
                <input
                  type="text"
                  value={scData.audits.findings}
                  onChange={(e) => setScData({
                    ...scData,
                    audits: { ...scData.audits, findings: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="ios-label">Corrective Action (CAPA)</label>
                <input
                  type="text"
                  value={scData.audits.correctiveAction}
                  onChange={(e) => setScData({
                    ...scData,
                    audits: { ...scData.audits, correctiveAction: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. LEVEL SC-7 — VALUE CHAIN DATA */}
      {activeTab === 'sc-7' && (
        <div className="space-y-6">
          {/* Per-level individual submission to Project Admin */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/70 px-4 py-3 shadow-sm backdrop-blur-xl">
            <span className="text-xs font-semibold text-slate-600">
              This level&apos;s data can be submitted individually — it reaches the Project Admin instantly.
            </span>
            <button
              type="button"
              disabled={levelSubmitting === 'sc-7'}
              onClick={() => handleLevelSubmit('sc-7')}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-indigo-500/25 transition hover:-translate-y-0.5 active:scale-95 disabled:opacity-60"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{levelSubmitting === 'sc-7' ? 'Submitting…' : 'Submit to Project Admin'}</span>
            </button>
          </div>
          <CommonLevel0Card
            fields={scData.valueChain.common}
            accentColor="blue"
            onChange={(upd) => setScData({
              ...scData,
              valueChain: { ...scData.valueChain, common: { ...scData.valueChain.common, ...upd } }
            })}
          />

          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title">Level SC-7 — Value-Chain Primary Data</h3>
              <p className="text-xs text-slate-500">Collect product carbon footprints, material intensities and supplier emissions</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="ios-label">Partner Type</label>
                <select
                  value={scData.valueChain.partnerType}
                  onChange={(e) => setScData({
                    ...scData,
                    valueChain: { ...scData.valueChain, partnerType: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Upstream Supplier">Upstream Supplier</option>
                  <option value="Downstream Logistics">Downstream Logistics</option>
                  <option value="Waste Recycler">Waste Recycler</option>
                  <option value="Subcontractor">Subcontractor</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Reporting Boundary</label>
                <select
                  value={scData.valueChain.reportingBoundary}
                  onChange={(e) => setScData({
                    ...scData,
                    valueChain: { ...scData.valueChain, reportingBoundary: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="BRSR Core Scope">BRSR Core Scope</option>
                  <option value="Extended Scope 3">Extended Scope 3</option>
                  <option value="Operational Control">Operational Control</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Activity Quantity / Value</label>
                <input
                  type="number"
                  step="0.01"
                  value={scData.valueChain.activityQuantityOrValue}
                  onChange={(e) => setScData({
                    ...scData,
                    valueChain: { ...scData.valueChain, activityQuantityOrValue: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Unit</label>
                <input
                  type="text"
                  value={scData.valueChain.unit}
                  onChange={(e) => setScData({
                    ...scData,
                    valueChain: { ...scData.valueChain, unit: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="ios-label">ESG Metric</label>
                <input
                  type="text"
                  value={scData.valueChain.esgMetric}
                  onChange={(e) => setScData({
                    ...scData,
                    valueChain: { ...scData.valueChain, esgMetric: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Data Quality Status</label>
                <select
                  value={scData.valueChain.dataQualityStatus}
                  onChange={(e) => setScData({
                    ...scData,
                    valueChain: { ...scData.valueChain, dataQualityStatus: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Primary Audited">Primary Audited</option>
                  <option value="Supplier Verified">Supplier Verified</option>
                  <option value="Industry Proxy">Industry Proxy</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Source Method</label>
                <select
                  value={scData.valueChain.sourceMethod}
                  onChange={(e) => setScData({
                    ...scData,
                    valueChain: { ...scData.valueChain, sourceMethod: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Supplier Reported Activity">Supplier Reported Activity</option>
                  <option value="Spend-based Estimation">Spend-based Estimation</option>
                  <option value="LCA Model">LCA Model</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 9. EVIDENCE TAB */}
      {/* ── BOTTOM ACTION BAR (iOS Liquid Glass Sticky Bar) ── */}
      {activeTab !== 'evidence' && activeTab !== 'submissions' && activeTab !== 'activity' && (
        <div className="sticky bottom-4 z-30">
          <div className="relative overflow-hidden rounded-[22px] border border-white/80 bg-white/85 px-5 py-3.5 shadow-xl backdrop-blur-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                <span className="inline-block h-2 w-2 rounded-full bg-teal-500 animate-pulse" />
                <span>Changes auto-persisted · Save each level, then Validate &amp; Continue for the journey review</span>
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
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:-translate-y-0.5 active:scale-95 cursor-pointer"
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

      {/* ── RIGHT-SIDE JOURNEY PANEL ── */}
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
              <div className="relative overflow-hidden border-b border-white/70 bg-gradient-to-br from-indigo-500 to-blue-600 p-5 text-white">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-white/20 to-transparent" />
                <div className="relative z-10 flex items-start justify-between">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Level Journey</div>
                    <h3 className="mt-0.5 text-lg font-black">Contributor Disclosure Levels</h3>
                    <p className="mt-0.5 text-[11px] opacity-90">
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
                            ? 'bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-lg shadow-indigo-500/25 hover:-translate-y-0.5'
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
        projectName="Contributor Workspace"
        periodLabel="FY 2026-27"
        submitting={submittingAll}
        onSubmitAll={handleFinalSubmit}
        levels={modalLevels}
        allData={allData}
        projectId={selectedProjectId || null}
        periodId="current"
        submitterRole="Contributor"
      />

      {/* ── Success confirmation ── */}
      <SubmitAllSuccessModal
        open={showSubmitSuccess}
        onClose={() => {
          setShowSubmitSuccess(false)
          setActiveTab('submissions')
        }}
        projectName="Contributor Workspace"
        periodLabel="FY 2026-27"
        submittedCount={JOURNEY_LEVELS.length}
        totalLevels={JOURNEY_LEVELS.length}
      />

      {activeTab === 'evidence' && (
        <CommonEvidenceManager roleKey="PROCUREMENT_USER" accentColor="blue" />
      )}

      {/* 10. SUBMISSIONS TAB */}
      {activeTab === 'submissions' && (
        <div className="space-y-6">
          <div className="glass-form-card">
            <h3 className="text-lg font-black text-slate-900 mb-1">My Supply Chain Submissions History</h3>
            <p className="text-xs text-slate-500 mb-4">Complete audit trail of supplier due diligence packages</p>
            <div className="divide-y divide-slate-100 text-xs">
              {assignments.map((asg) => (
                <div key={asg.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 text-sm">{asg.module}</span>
                      <span className="text-[11px] font-semibold text-slate-500">({asg.reportingYear})</span>
                    </div>
                    <p className="text-slate-500 text-xs mt-0.5">{asg.description}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 rounded-full font-bold text-[11px] ${
                      asg.submissionStatus === 'Accepted' ? 'bg-emerald-100 text-emerald-800' :
                      asg.submissionStatus === 'Submitted' ? 'bg-blue-100 text-blue-800' :
                      asg.submissionStatus === 'Under Review' ? 'bg-purple-100 text-purple-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {asg.submissionStatus}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowValidationModal(true)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Audit Trail
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 11. ACTIVITY LOG TAB */}
      {activeTab === 'activity' && (
        <div className="glass-form-card">
          <div className="flex items-center gap-2 mb-4">
            <History className="h-5 w-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900">Supply Chain Activity Log</h3>
          </div>
          <div className="space-y-3">
            {activities.map((act) => (
              <div key={act.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 flex items-start justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">{act.user}</span>
                    <span className="rounded-md bg-blue-100 text-blue-800 px-1.5 py-0.5 text-[10px] font-bold">{act.action}</span>
                    <span className="font-semibold text-slate-600">• {act.target}</span>
                  </div>
                  <p className="text-slate-500 mt-1">{act.details}</p>
                </div>
                <span className="text-[11px] text-slate-400 whitespace-nowrap">{act.timestamp}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Validation & Submit Modal */}
      <CommonValidationModal
        isOpen={showValidationModal}
        onClose={() => setShowValidationModal(false)}
        roleKey="PROCUREMENT_USER"
        levelName={activeTab.toUpperCase()}
        onSubmitSuccess={() => {
          setAssignments(contributorStore.getAssignments('PROCUREMENT_USER'))
          setActivities(contributorStore.getActivities('PROCUREMENT_USER'))
        }}
      />
    </div>
  )
}
