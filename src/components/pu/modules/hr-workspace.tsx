'use client'
/**
 * HrWorkspace — MEIL ESG / BRSR Reporting Platform
 *
 * HR Data Contributor Workspace:
 * - Level 0: Universal Common Reporting Fields (all 24 fields)
 * - Level HR-1: Workforce Profile (Employees & Workers, Gender counts, Source System)
 * - Level HR-2: Workforce Diversity & Representation (PwD, Diversity, Percentages)
 * - Level HR-3: Hiring & Turnover (Opening, Joiners, Leavers, Closing, Turnover %)
 * - Level HR-4: Training & Skill Development (Programmes, Duration, Completion %)
 * - Level HR-5: Performance & Career Development Reviews (Eligible, Reviewed %)
 * - Level HR-6: Employee Benefits & Well-being (Parental, Insurance, Coverage %)
 * - Level HR-7: Wages & Remuneration-Related Disclosures (Median Wage, Aggregates)
 * - Level HR-8: Grievances & Human Rights (Received, Resolved, Pending, Redressal)
 * - Level HR-9: Health, Safety & Occupational Well-being Coordination
 * - Screen 1: HR Data Console (6 Dashboard Cards + My HR Assignments Table)
 * - Evidence & Documents Repository
 * - Shared Validation & Multi-state Submission Workflow
 */
import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, UserRound, GraduationCap, HeartPulse, Scale, ShieldCheck,
  CheckCircle2, Clock, AlertTriangle, ArrowRight, Save, Send, Upload,
  RefreshCw, Sparkles, Filter, Eye, Edit3, ChevronRight, Layers, FileText,
  TrendingUp, Building2, UserPlus, FileCheck2, History
} from 'lucide-react'
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
  'hr-workforce': 'hr-1',
  'hr-training': 'hr-4',
  'hr-wellbeing': 'hr-6',
  'hr-rights': 'hr-8',
  evidence: 'evidence',
  submissions: 'submissions',
}

export function HrWorkspace() {
  const { activeModule, setActiveModule } = useApp()
  const [activeTab, setActiveTab] = useState<string>('overview')
  const [hrData, setHrData] = useState(() => contributorStore.getHrData())
  const [assignments, setAssignments] = useState<ContributorAssignment[]>(() => contributorStore.getAssignments('HR_USER'))
  const [activities, setActivities] = useState<ActivityEvent[]>(() => contributorStore.getActivities('HR_USER'))
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
    contributorStore.saveHrData(hrData)
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

  const tabList = [
    { id: 'overview', label: 'Console Overview' },
    { id: 'hr-1', label: 'HR-1: Workforce Profile' },
    { id: 'hr-2', label: 'HR-2: Diversity' },
    { id: 'hr-3', label: 'HR-3: Turnover' },
    { id: 'hr-4', label: 'HR-4: Training' },
    { id: 'hr-5', label: 'HR-5: Performance' },
    { id: 'hr-6', label: 'HR-6: Benefits' },
    { id: 'hr-7', label: 'HR-7: Remuneration' },
    { id: 'hr-8', label: 'HR-8: Grievances' },
    { id: 'hr-9', label: 'HR-9: Well-being' },
    { id: 'evidence', label: 'Evidence & Documents' },
    { id: 'submissions', label: 'My Submissions' },
    { id: 'activity', label: 'Activity Log' }
  ]

  return (
    <div className="space-y-6 pb-12">
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

      {/* HEADER SECTION */}
      <div className="relative overflow-hidden glass-form-card md:!p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
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
              Workforce census · Training & skills · Diversity & Inclusion · Benefits & Grievance mechanisms
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <span className="rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-xs font-bold text-slate-700 shadow-xs">
              FY 2026-27 (Assigned)
            </span>
            <button
              type="button"
              onClick={() => handleSaveDraft(activeTab.toUpperCase())}
              className="ios-btn-ghost"
            >
              <Save className="h-3.5 w-3.5 text-slate-500" />
              <span>{saveStatus}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowValidationModal(true)}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-teal-600 to-cyan-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-teal-500/20 hover:from-teal-700 hover:to-cyan-700 hover:-translate-y-px transition-all cursor-pointer active:scale-95"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Validate & Submit</span>
            </button>
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
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-500/25'
                  : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB CONTENT */}

      {/* 1. CONSOLE OVERVIEW (SCREEN 1) */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* 6 Dashboard Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
            {[
              { label: 'Assigned HR Tasks', val: '4 Modules', sub: 'FY 2026-27', icon: Layers, tone: 'text-teal-600 bg-teal-50' },
              { label: 'Pending Data Entry', val: '2 Forms', sub: 'Turnover & Coord', icon: Clock, tone: 'text-amber-600 bg-amber-50' },
              { label: 'Submitted Records', val: '1 Level', sub: 'Under BU Review', icon: CheckCircle2, tone: 'text-blue-600 bg-blue-50' },
              { label: 'Returned for Fix', val: '1 Record', sub: 'Contractor split required', icon: AlertTriangle, tone: 'text-rose-600 bg-rose-50' },
              { label: 'Workforce Completion', val: '78.5%', sub: 'Target: 100%', icon: TrendingUp, tone: 'text-emerald-600 bg-emerald-50' },
              { label: 'Evidence Attached', val: '3 / 4 Files', sub: '1 file missing', icon: FileCheck2, tone: 'text-purple-600 bg-purple-50' },
            ].map((card, i) => (
              <div key={i} className="rounded-[22px] border border-white/60 bg-white/75 p-4 shadow-lg shadow-sky-500/5 backdrop-blur-xl">
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
            <div className="rounded-[24px] border border-white/60 bg-white/75 p-5 shadow-lg shadow-sky-500/5 backdrop-blur-xl">
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

            <div className="rounded-[24px] border border-white/60 bg-white/75 p-5 shadow-lg shadow-sky-500/5 backdrop-blur-xl">
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
                  <span className="font-bold text-slate-800">
                    {(((hrData.training.participantsCompleting / hrData.training.participants) || 0) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Method:</span>
                  <span className="font-bold text-slate-800">{hrData.training.deliveryMethod}</span>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/60 bg-white/75 p-5 shadow-lg shadow-sky-500/5 backdrop-blur-xl">
              <span className="text-xs font-bold text-slate-500">Grievance & Resolution Status</span>
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
                  <span>Redressal Mechanism:</span>
                  <span className="font-bold text-slate-800 truncate max-w-[140px]">{hrData.grievances.resolutionMethod}</span>
                </div>
                <div className="flex justify-between">
                  <span>Audit Evidence:</span>
                  <span className="font-bold text-teal-700">{hrData.grievances.supportingEvidence}</span>
                </div>
              </div>
            </div>
          </div>

          {/* My HR Assignments Table */}
          <div className="rounded-[24px] border border-white/60 bg-white/75 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">My HR Assignments</h3>
                <p className="text-xs text-slate-500">Mandatory reporting tasks assigned for current reporting period</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('hr-1')}
                className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1"
              >
                <span>Enter All Disclosures</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="pb-3">Entity / Business Unit</th>
                    <th className="pb-3">Year</th>
                    <th className="pb-3">HR Module</th>
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
                      <td className="py-3 font-bold text-teal-700">{asg.module}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full bg-teal-500 rounded-full" style={{ width: `${asg.completionPercentage}%` }} />
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
                          asg.submissionStatus === 'Submitted' ? 'bg-blue-50 text-blue-700' :
                          asg.submissionStatus === 'Returned for Correction' ? 'bg-rose-50 text-rose-700' :
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
                            if (asg.levelKey === 'HR-1') setActiveTab('hr-1')
                            else if (asg.levelKey === 'HR-2') setActiveTab('hr-2')
                            else if (asg.levelKey === 'HR-4') setActiveTab('hr-4')
                            else if (asg.levelKey === 'HR-8') setActiveTab('hr-8')
                            else setActiveTab('hr-1')
                          }}
                          className="rounded-lg bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-700 hover:bg-teal-100 transition-colors"
                        >
                          {asg.submissionStatus === 'Returned for Correction' ? 'Fix Corrections' : 'Enter Data'}
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

      {/* 2. LEVEL HR-1 — WORKFORCE PROFILE */}
      {activeTab === 'hr-1' && (
        <div className="space-y-6">
          <CommonLevel0Card
            fields={hrData.workforceProfile.common}
            accentColor="teal"
            onChange={(upd) => setHrData({
              ...hrData,
              workforceProfile: { ...hrData.workforceProfile, common: { ...hrData.workforceProfile.common, ...upd } }
            })}
          />

          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title">Level HR-1 — Workforce Profile</h3>
              <p className="text-xs text-slate-500">Collect workforce counts and classifications required by BRSR Principle 3</p>
            </div>

            {/* Reconciliation Banner */}
            <div className={`p-4 rounded-2xl border text-xs flex flex-wrap items-center justify-between gap-3 ${
              totalWorkforce === totalGender && totalWorkforce > 0
                ? 'border-emerald-200 bg-emerald-50/60 text-emerald-900'
                : 'border-rose-200 bg-rose-50/60 text-rose-900'
            }`}>
              <div>
                <span className="font-bold">Workforce Reconciliation: </span>
                <span>Employees & Workers Total: <strong className="font-bold">{totalWorkforce.toLocaleString()}</strong> | Gender Sum: <strong className="font-bold">{totalGender.toLocaleString()}</strong></span>
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
                  className="ios-field !text-xs font-medium text-slate-800 focus:ring-2 focus:ring-teal-500/20"
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
                  className="ios-field !text-xs font-medium text-slate-800 focus:ring-2 focus:ring-teal-500/20"
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
                  className="ios-field !text-xs font-bold text-slate-800 focus:ring-2 focus:ring-teal-500/20"
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
                  className="ios-field !text-xs font-bold text-slate-800 focus:ring-2 focus:ring-teal-500/20"
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
                  className="ios-field !text-xs font-bold text-slate-800 focus:ring-2 focus:ring-teal-500/20"
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
                  className="ios-field !text-xs font-bold text-slate-800 focus:ring-2 focus:ring-teal-500/20"
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
                  className="ios-field !text-xs font-bold text-slate-800 focus:ring-2 focus:ring-teal-500/20"
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
                  className="ios-field !text-xs font-bold text-slate-800 focus:ring-2 focus:ring-teal-500/20"
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
                  className="ios-field !text-xs font-bold text-slate-800 focus:ring-2 focus:ring-teal-500/20"
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
                  className="ios-field !text-xs font-medium text-slate-800 focus:ring-2 focus:ring-teal-500/20"
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
                  className="ios-field !text-xs font-medium text-slate-800 focus:ring-2 focus:ring-teal-500/20"
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
                  className="ios-field !text-xs font-medium text-slate-800 focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
            </div>

            <div>
              <label className="ios-label">Remarks & Data Note</label>
              <textarea
                rows={2}
                value={hrData.workforceProfile.remarks}
                onChange={(e) => setHrData({
                  ...hrData,
                  workforceProfile: { ...hrData.workforceProfile, remarks: e.target.value }
                })}
                className="ios-field !text-xs font-medium text-slate-800 focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
          </div>
        </div>
      )}

      {/* 3. LEVEL HR-2 — DIVERSITY & REPRESENTATION */}
      {activeTab === 'hr-2' && (
        <div className="space-y-6">
          <CommonLevel0Card
            fields={hrData.diversity.common}
            accentColor="teal"
            onChange={(upd) => setHrData({
              ...hrData,
              diversity: { ...hrData.diversity, common: { ...hrData.diversity.common, ...upd } }
            })}
          />

          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title">Level HR-2 — Workforce Diversity & Representation</h3>
              <p className="text-xs text-slate-500">Track differently abled and under-represented demographics lawfully collected</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="ios-label">Reporting Population</label>
                <input
                  type="text"
                  value={hrData.diversity.reportingPopulation}
                  onChange={(e) => setHrData({
                    ...hrData,
                    diversity: { ...hrData.diversity, reportingPopulation: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Workforce Category</label>
                <input
                  type="text"
                  value={hrData.diversity.workforceCategory}
                  onChange={(e) => setHrData({
                    ...hrData,
                    diversity: { ...hrData.diversity, workforceCategory: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Diversity Category</label>
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
                <label className="ios-label">Count by Category</label>
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
                <label className="ios-label">Total Population Count</label>
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
                <label className="ios-label">Percentage (Calculated)</label>
                <div className="ios-field !text-xs font-black text-teal-700 !bg-slate-50/70">
                  {hrData.diversity.calculatedPercentage}%
                </div>
              </div>

              <div>
                <label className="ios-label">Source Report</label>
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

              <div>
                <label className="ios-label">Evidence Reference</label>
                <input
                  type="text"
                  value={hrData.diversity.evidence}
                  onChange={(e) => setHrData({
                    ...hrData,
                    diversity: { ...hrData.diversity, evidence: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. LEVEL HR-3 — HIRING & TURNOVER */}
      {activeTab === 'hr-3' && (
        <div className="space-y-6">
          <CommonLevel0Card
            fields={hrData.turnover.common}
            accentColor="teal"
            onChange={(upd) => setHrData({
              ...hrData,
              turnover: { ...hrData.turnover, common: { ...hrData.turnover.common, ...upd } }
            })}
          />

          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title">Level HR-3 — Hiring & Turnover</h3>
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
        </div>
      )}

      {/* 5. LEVEL HR-4 — TRAINING & DEVELOPMENT */}
      {activeTab === 'hr-4' && (
        <div className="space-y-6">
          <CommonLevel0Card
            fields={hrData.training.common}
            accentColor="teal"
            onChange={(upd) => setHrData({
              ...hrData,
              training: { ...hrData.training, common: { ...hrData.training.common, ...upd } }
            })}
          />

          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title">Level HR-4 — Training & Skill Development</h3>
              <p className="text-xs text-slate-500">Record health & safety, skill upgradation, human rights, and ESG training hours</p>
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
                  <option value="Health & Safety">Health & Safety</option>
                  <option value="Skill Upgradation">Skill Upgradation</option>
                  <option value="POSH & Human Rights">POSH & Human Rights</option>
                  <option value="Ethics & ESG">Ethics & ESG</option>
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
                  <option value="Both">Both Employees & Workers</option>
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
                <label className="ios-label">Total Sessions</label>
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
                <label className="ios-label">Duration (Hours)</label>
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
                  <option value="On-the-job">On-the-job</option>
                  <option value="Hybrid">Hybrid</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Trainer / Agency</label>
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
                <label className="ios-label">Assessment Result</label>
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
        </div>
      )}

      {/* 6. LEVEL HR-5 — PERFORMANCE REVIEWS */}
      {activeTab === 'hr-5' && (
        <div className="space-y-6">
          <CommonLevel0Card
            fields={hrData.reviews.common}
            accentColor="teal"
            onChange={(upd) => setHrData({
              ...hrData,
              reviews: { ...hrData.reviews, common: { ...hrData.reviews.common, ...upd } }
            })}
          />

          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title">Level HR-5 — Performance & Career Reviews</h3>
              <p className="text-xs text-slate-500">Track coverage percentage of regular performance appraisals</p>
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
                <label className="ios-label">Number Reviewed</label>
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
                <div className="ios-field !text-xs font-black text-teal-700 !bg-slate-50/70">
                  {calcReviewPct}%
                </div>
              </div>

              <div>
                <label className="ios-label">Review Period</label>
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
                <label className="ios-label">Source HR Report</label>
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
                <label className="ios-label">Supporting Evidence</label>
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
          </div>
        </div>
      )}

      {/* 7. LEVEL HR-6 — EMPLOYEE BENEFITS */}
      {activeTab === 'hr-6' && (
        <div className="space-y-6">
          <CommonLevel0Card
            fields={hrData.benefits.common}
            accentColor="teal"
            onChange={(upd) => setHrData({
              ...hrData,
              benefits: { ...hrData.benefits, common: { ...hrData.benefits.common, ...upd } }
            })}
          />

          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title">Level HR-6 — Employee Benefits & Well-being</h3>
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
                  <option value="PF & Gratuity">PF & Gratuity</option>
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
        </div>
      )}

      {/* 8. LEVEL HR-7 — WAGES & REMUNERATION */}
      {activeTab === 'hr-7' && (
        <div className="space-y-6">
          <CommonLevel0Card
            fields={hrData.wages.common}
            accentColor="teal"
            onChange={(upd) => setHrData({
              ...hrData,
              wages: { ...hrData.wages, common: { ...hrData.wages.common, ...upd } }
            })}
          />

          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title">Level HR-7 — Wages & Remuneration Disclosures</h3>
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
        </div>
      )}

      {/* 9. LEVEL HR-8 — GRIEVANCES & HUMAN RIGHTS */}
      {activeTab === 'hr-8' && (
        <div className="space-y-6">
          <CommonLevel0Card
            fields={hrData.grievances.common}
            accentColor="teal"
            onChange={(upd) => setHrData({
              ...hrData,
              grievances: { ...hrData.grievances, common: { ...hrData.grievances.common, ...upd } }
            })}
          />

          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title">Level HR-8 — Grievances & Human Rights</h3>
              <p className="text-xs text-slate-500">Record complaint redressal counts while preserving individual complainant confidentiality</p>
            </div>

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
                  <option value="Working Conditions">Working Conditions</option>
                  <option value="Health & Safety">Health & Safety</option>
                  <option value="Child Labour / Forced Labour">Child Labour / Forced Labour</option>
                  <option value="Discrimination / Harassment">Discrimination / Harassment</option>
                  <option value="Wage Issues">Wage Issues</option>
                  <option value="POSH">POSH (Prevention of Sexual Harassment)</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Grievances Received</label>
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
                <label className="ios-label">Resolution Method</label>
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
                <label className="ios-label">Source Register</label>
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
        </div>
      )}

      {/* 10. LEVEL HR-9 — SAFETY & OCCUPATIONAL WELL-BEING */}
      {activeTab === 'hr-9' && (
        <div className="space-y-6">
          <CommonLevel0Card
            fields={hrData.safetyCoord.common}
            accentColor="teal"
            onChange={(upd) => setHrData({
              ...hrData,
              safetyCoord: { ...hrData.safetyCoord, common: { ...hrData.safetyCoord.common, ...upd } }
            })}
          />

          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title">Level HR-9 — Occupational Safety Coordination</h3>
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
                <label className="ios-label">Health & Safety Training Summary</label>
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
        </div>
      )}

      {/* 11. EVIDENCE TAB */}
      {activeTab === 'evidence' && (
        <CommonEvidenceManager roleKey="HR_USER" accentColor="teal" />
      )}

      {/* 12. SUBMISSIONS TAB */}
      {activeTab === 'submissions' && (
        <div className="space-y-6">
          <div className="glass-form-card">
            <h3 className="text-lg font-black text-slate-900 mb-1">My HR Submissions History</h3>
            <p className="text-xs text-slate-500 mb-4">Complete audit trail of submitted packages and reviewer signoffs</p>
            <div className="divide-y divide-slate-100 text-xs">
              {assignments.map((asg) => (
                <div key={asg.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 text-sm">{asg.module}</span>
                      <span className="text-[11px] font-semibold text-slate-500">({asg.reportingYear})</span>
                    </div>
                    <p className="text-slate-500 text-xs mt-0.5">{asg.description}</p>
                    {asg.criticalWarning && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md inline-block">
                        <AlertTriangle className="h-3 w-3" />
                        <span>{asg.criticalWarning}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 rounded-full font-bold text-[11px] ${
                      asg.submissionStatus === 'Submitted' ? 'bg-blue-100 text-blue-800' :
                      asg.submissionStatus === 'Returned for Correction' ? 'bg-rose-100 text-rose-800' :
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

      {/* 13. ACTIVITY LOG TAB */}
      {activeTab === 'activity' && (
        <div className="glass-form-card">
          <div className="flex items-center gap-2 mb-4">
            <History className="h-5 w-5 text-teal-600" />
            <h3 className="text-base font-bold text-slate-900">HR Contributor Activity Log</h3>
          </div>
          <div className="space-y-3">
            {activities.map((act) => (
              <div key={act.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 flex items-start justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">{act.user}</span>
                    <span className="rounded-md bg-teal-100 text-teal-800 px-1.5 py-0.5 text-[10px] font-bold">{act.action}</span>
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
        roleKey="HR_USER"
        levelName={activeTab.toUpperCase()}
        onSubmitSuccess={() => {
          setAssignments(contributorStore.getAssignments('HR_USER'))
          setActivities(contributorStore.getActivities('HR_USER'))
        }}
      />
    </div>
  )
}
