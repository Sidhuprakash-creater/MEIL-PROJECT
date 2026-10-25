'use client'
/**
 * CsrWorkspace — MEIL ESG / BRSR Reporting Platform
 *
 * CSR & Social Impact Contributor Workspace:
 * - Level 0: Universal Common Reporting Fields (all 24 fields)
 * - Level CSR-1: CSR Project Master (Schedule VII, Locations, Approvals)
 * - Level CSR-2: Programme Activities & Beneficiaries (Planned vs Actual, rolls)
 * - Level CSR-3: CSR Expenditure References (Finance reconciliation, vouchers)
 * - Level CSR-4: Project Outcomes & Social Impact (Baseline vs Target vs Actual)
 * - Level CSR-5: Community Engagement & Grievances (Locality redressal)
 * - Level CSR-6: Social Impact Assessment (Third-party agency, SROI, web disclosure)
 * - Level CSR-7: Rehabilitation & Resettlement (PAFs, Compensation disbursements)
 * - Screen 1: CSR & Social Impact Console (6 Dashboard Cards + My CSR Assignments Table)
 * - Evidence & Documents Repository
 * - Shared Validation & Multi-state Submission Workflow
 */
import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  HeartHandshake, Users, Wallet, BarChart3, MessageCircle, MapPin,
  ShieldCheck, CheckCircle2, Clock, AlertTriangle, ArrowRight, Save, Send,
  Upload, RefreshCw, Sparkles, Filter, Eye, Edit3, ChevronRight, Layers,
  FileText, TrendingUp, Building2, FileCheck2, History, Award
} from 'lucide-react'
import { useApp } from '@/lib/auth-context'
import {
  contributorStore,
  type ContributorAssignment,
  type ActivityEvent
} from '@/lib/contributor-store'
import { CommonLevel0Card } from './common-level0-card'
import { CommonEvidenceManager } from './common-evidence-manager'
import { CommonValidationModal } from './common-validation-modal'

export function CsrWorkspace() {
  const { activeModule } = useApp()
  const [activeTab, setActiveTab] = useState<string>('overview')
  const [csrData, setCsrData] = useState(() => contributorStore.getCsrData())
  const [assignments, setAssignments] = useState<ContributorAssignment[]>([])
  const [activities, setActivities] = useState<ActivityEvent[]>([])
  const [saveStatus, setSaveStatus] = useState<string>('Saved')
  const [showValidationModal, setShowValidationModal] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  useEffect(() => {
    if (activeModule === 'csr-projects') setActiveTab('csr-1')
    else if (activeModule === 'csr-beneficiaries') setActiveTab('csr-2')
    else if (activeModule === 'csr-budgets') setActiveTab('csr-3')
    else if (activeModule === 'csr-impact') setActiveTab('csr-4')
    else if (activeModule === 'csr-community') setActiveTab('csr-5')
    else if (activeModule === 'evidence') setActiveTab('evidence')
    else if (activeModule === 'submissions') setActiveTab('submissions')
  }, [activeModule])

  useEffect(() => {
    setAssignments(contributorStore.getAssignments('CSR_USER'))
    setActivities(contributorStore.getActivities('CSR_USER'))
  }, [])

  const triggerToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const handleSaveDraft = (levelLabel: string) => {
    setSaveStatus('Saving...')
    contributorStore.saveCsrData(csrData)
    setTimeout(() => {
      setSaveStatus('Draft Saved')
      triggerToast(`${levelLabel} draft saved successfully.`)
      contributorStore.addActivity({
        id: 'act-' + Date.now(),
        roleKey: 'CSR_USER',
        timestamp: 'Just now',
        user: 'Deepika Rao (CSR)',
        action: 'Saved Draft',
        target: levelLabel,
        details: 'Community beneficiary records and CSR expenditures saved.',
        badgeTone: 'rose'
      })
      setActivities(contributorStore.getActivities('CSR_USER'))
      setTimeout(() => setSaveStatus('Saved'), 2000)
    }, 400)
  }

  // Beneficiary achievement percentage
  const beneficiaryPct = (Number(csrData.activities.plannedBeneficiaries) || 0) > 0
    ? (((Number(csrData.activities.actualBeneficiaries) || 0) / (Number(csrData.activities.plannedBeneficiaries) || 1)) * 100).toFixed(1)
    : '0'

  const tabList = [
    { id: 'overview', label: 'CSR Console' },
    { id: 'csr-1', label: 'CSR-1: Project Master' },
    { id: 'csr-2', label: 'CSR-2: Beneficiaries' },
    { id: 'csr-3', label: 'CSR-3: Spend References' },
    { id: 'csr-4', label: 'CSR-4: Project Outcomes' },
    { id: 'csr-5', label: 'CSR-5: Grievances' },
    { id: 'csr-6', label: 'CSR-6: Social Impact SIA' },
    { id: 'csr-7', label: 'CSR-7: R&R' },
    { id: 'evidence', label: 'Evidence & Documents' },
    { id: 'submissions', label: 'My Submissions' },
    { id: 'activity', label: 'Activity Log' }
  ]

  return (
    <div className="space-y-6 pb-12">
      {/* Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-50 flex items-center gap-2 rounded-2xl border border-rose-200 bg-white/95 px-4 py-3 shadow-xl shadow-rose-500/10 backdrop-blur-xl text-xs font-bold text-rose-800"
          >
            <CheckCircle2 className="h-4 w-4 text-rose-600" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER SECTION */}
      <div className="relative overflow-hidden glass-form-card md:!p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-md shadow-rose-500/25">
                <HeartHandshake className="h-6 w-6" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
                CSR & Social Impact Contributor Workspace
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50/80 px-3 py-1 text-xs font-bold text-rose-700 shadow-xs">
                <Sparkles className="h-3 w-3 text-rose-600" />
                BRSR Principle 8
              </span>
            </div>
            <p className="text-sm font-medium text-slate-500">
              Schedule VII programmes · Clean water & health clinics · Verified beneficiaries · Social return on investment (SIA)
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
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-rose-500 to-pink-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-rose-500/20 hover:from-rose-600 hover:to-pink-700 hover:-translate-y-px transition-all cursor-pointer active:scale-95"
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
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-500/25'
                  : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 1. CSR CONSOLE OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* 6 Dashboard Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
            {[
              { label: 'Assigned CSR Projects', val: '3 Projects', sub: 'Schedule VII Scope', icon: Layers, tone: 'text-rose-600 bg-rose-50' },
              { label: 'Projects in Progress', val: '2 Active', sub: 'Phase 2 RO Plants', icon: Clock, tone: 'text-amber-600 bg-amber-50' },
              { label: 'Pending Data Entry', val: '1 Form', sub: 'Q2 Signoffs', icon: Edit3, tone: 'text-blue-600 bg-blue-50' },
              { label: 'Evidence Missing', val: '0 Files', sub: 'All Rolls Attached', icon: ShieldCheck, tone: 'text-emerald-600 bg-emerald-50' },
              { label: 'Beneficiary Complete', val: '94.7%', sub: '118,400 People', icon: Users, tone: 'text-purple-600 bg-purple-50' },
              { label: 'Returned Records', val: '0 Items', sub: 'Clean Audit Trail', icon: FileCheck2, tone: 'text-emerald-600 bg-emerald-50' },
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

          {/* Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-[24px] border border-white/60 bg-white/75 p-5 shadow-lg shadow-sky-500/5 backdrop-blur-xl">
              <span className="text-xs font-bold text-slate-500">Flagship CSR Programme</span>
              <div className="mt-2 text-lg font-black text-slate-900 truncate">
                {csrData.projectMaster.projectName}
              </div>
              <div className="mt-3 text-xs text-slate-500 space-y-1">
                <div className="flex justify-between">
                  <span>Category:</span>
                  <span className="font-bold text-rose-700">{csrData.projectMaster.programmeCategory}</span>
                </div>
                <div className="flex justify-between">
                  <span>Implementing Agency:</span>
                  <span className="font-bold text-slate-800 truncate max-w-[150px]">{csrData.projectMaster.implementingAgency}</span>
                </div>
                <div className="flex justify-between">
                  <span>Target Beneficiaries:</span>
                  <span className="font-bold text-slate-800">{csrData.projectMaster.targetBeneficiaries.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/60 bg-white/75 p-5 shadow-lg shadow-sky-500/5 backdrop-blur-xl">
              <span className="text-xs font-bold text-slate-500">Beneficiaries Reached</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">{Number(csrData.activities.actualBeneficiaries).toLocaleString()}</span>
                <span className="text-xs font-semibold text-emerald-600">{beneficiaryPct}% of target</span>
              </div>
              <div className="mt-3 text-xs text-slate-500 space-y-1">
                <div className="flex justify-between">
                  <span>Classification:</span>
                  <span className="font-bold text-slate-800">{csrData.activities.beneficiaryClassification}</span>
                </div>
                <div className="flex justify-between">
                  <span>Sessions Held:</span>
                  <span className="font-bold text-slate-800">{csrData.activities.numberOfSessions} sessions</span>
                </div>
                <div className="flex justify-between">
                  <span>Finance Spend Ref:</span>
                  <span className="font-bold text-blue-700">₹ {csrData.expenditure.expenditureAmountCr} Cr</span>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/60 bg-white/75 p-5 shadow-lg shadow-sky-500/5 backdrop-blur-xl">
              <span className="text-xs font-bold text-slate-500">Social Impact Assessment (SIA)</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">4.2x SROI</span>
                <span className="text-xs font-semibold text-emerald-600">TISS Evaluated</span>
              </div>
              <div className="mt-3 text-xs text-slate-500 space-y-1">
                <div className="flex justify-between">
                  <span>Public Disclosure:</span>
                  <span className="font-bold text-emerald-700">{csrData.sia.publicDisclosureStatus}</span>
                </div>
                <div className="flex justify-between">
                  <span>Community Grievances:</span>
                  <span className="font-bold text-slate-800">100% Resolved</span>
                </div>
                <div className="flex justify-between">
                  <span>R&R Compliance:</span>
                  <span className="font-bold text-teal-700">{csrData.rr.status}</span>
                </div>
              </div>
            </div>
          </div>

          {/* My CSR Assignments Table */}
          <div className="rounded-[24px] border border-white/60 bg-white/75 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">My CSR Assignments</h3>
                <p className="text-xs text-slate-500">Community development tasks assigned for reporting</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('csr-1')}
                className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1"
              >
                <span>Enter CSR Data</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="pb-3">Implementing Trust</th>
                    <th className="pb-3">Year</th>
                    <th className="pb-3">CSR Module</th>
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
                      <td className="py-3 font-bold text-rose-700">{asg.module}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full bg-rose-500 rounded-full" style={{ width: `${asg.completionPercentage}%` }} />
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
                            if (asg.levelKey === 'CSR-1') setActiveTab('csr-1')
                            else if (asg.levelKey === 'CSR-2') setActiveTab('csr-2')
                            else if (asg.levelKey === 'CSR-6') setActiveTab('csr-6')
                            else setActiveTab('csr-1')
                          }}
                          className="rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors"
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

      {/* 2. LEVEL CSR-1 — CSR PROJECT MASTER */}
      {activeTab === 'csr-1' && (
        <div className="space-y-6">
          <CommonLevel0Card
            fields={csrData.projectMaster.common}
            accentColor="rose"
            onChange={(upd) => setCsrData({
              ...csrData,
              projectMaster: { ...csrData.projectMaster, common: { ...csrData.projectMaster.common, ...upd } }
            })}
          />

          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title">Level CSR-1 — CSR Project Master</h3>
              <p className="text-xs text-slate-500">Maintain corporate CSR project portfolio sanctioned under Companies Act Schedule VII</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="ios-label">CSR Project ID</label>
                <input
                  type="text"
                  value={csrData.projectMaster.csrProjectId}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    projectMaster: { ...csrData.projectMaster, csrProjectId: e.target.value }
                  })}
                  className="ios-field !text-xs font-mono font-bold text-slate-800"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="ios-label">Project Name</label>
                <input
                  type="text"
                  value={csrData.projectMaster.projectName}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    projectMaster: { ...csrData.projectMaster, projectName: e.target.value }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Programme Category</label>
                <select
                  value={csrData.projectMaster.programmeCategory}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    projectMaster: { ...csrData.projectMaster, programmeCategory: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Safe Drinking Water">Safe Drinking Water</option>
                  <option value="Education & Skill Development">Education & Skill Development</option>
                  <option value="Healthcare & Sanitation">Healthcare & Sanitation</option>
                  <option value="Rural Infrastructure">Rural Infrastructure</option>
                  <option value="Environmental Sustainability">Environmental Sustainability</option>
                  <option value="Women Empowerment">Women Empowerment</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Implementing Agency</label>
                <input
                  type="text"
                  value={csrData.projectMaster.implementingAgency}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    projectMaster: { ...csrData.projectMaster, implementingAgency: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Project Location</label>
                <input
                  type="text"
                  value={csrData.projectMaster.projectLocation}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    projectMaster: { ...csrData.projectMaster, projectLocation: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">State / District</label>
                <input
                  type="text"
                  value={csrData.projectMaster.stateDistrict}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    projectMaster: { ...csrData.projectMaster, stateDistrict: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Target Beneficiaries</label>
                <input
                  type="number"
                  value={csrData.projectMaster.targetBeneficiaries}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    projectMaster: { ...csrData.projectMaster, targetBeneficiaries: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Start Date</label>
                <input
                  type="date"
                  value={csrData.projectMaster.startDate}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    projectMaster: { ...csrData.projectMaster, startDate: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Planned Completion Date</label>
                <input
                  type="date"
                  value={csrData.projectMaster.plannedCompletionDate}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    projectMaster: { ...csrData.projectMaster, plannedCompletionDate: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Project Status</label>
                <select
                  value={csrData.projectMaster.projectStatus}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    projectMaster: { ...csrData.projectMaster, projectStatus: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Active Implementation">Active Implementation</option>
                  <option value="Planning">Planning</option>
                  <option value="Completed">Completed</option>
                  <option value="Multi-Year Ongoing">Multi-Year Ongoing</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Board Approval Reference</label>
                <input
                  type="text"
                  value={csrData.projectMaster.approvalReference}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    projectMaster: { ...csrData.projectMaster, approvalReference: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. LEVEL CSR-2 — BENEFICIARIES & ACTIVITIES */}
      {activeTab === 'csr-2' && (
        <div className="space-y-6">
          <CommonLevel0Card
            fields={csrData.activities.common}
            accentColor="rose"
            onChange={(upd) => setCsrData({
              ...csrData,
              activities: { ...csrData.activities, common: { ...csrData.activities.common, ...upd } }
            })}
          />

          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title">Level CSR-2 — Programme Activities & Beneficiaries</h3>
              <p className="text-xs text-slate-500">Track community engagement sessions, actual beneficiaries, and attendance rolls</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="ios-label">CSR Project ID</label>
                <input
                  type="text"
                  value={csrData.activities.csrProjectId}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    activities: { ...csrData.activities, csrProjectId: e.target.value }
                  })}
                  className="ios-field !text-xs font-mono font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Activity Name</label>
                <input
                  type="text"
                  value={csrData.activities.activityName}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    activities: { ...csrData.activities, activityName: e.target.value }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Planned Beneficiaries</label>
                <input
                  type="number"
                  value={csrData.activities.plannedBeneficiaries}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    activities: { ...csrData.activities, plannedBeneficiaries: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Actual Beneficiaries</label>
                <input
                  type="number"
                  value={csrData.activities.actualBeneficiaries}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    activities: { ...csrData.activities, actualBeneficiaries: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Beneficiary Classification</label>
                <select
                  value={csrData.activities.beneficiaryClassification}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    activities: { ...csrData.activities, beneficiaryClassification: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Local Villagers / Farmers">Local Villagers / Farmers</option>
                  <option value="Women">Women</option>
                  <option value="Children & Students">Children & Students</option>
                  <option value="Elderly / Marginalized">Elderly / Marginalized</option>
                  <option value="General Community">General Community</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Achievement % (Calculated)</label>
                <div className="ios-field !text-xs font-black text-rose-700 !bg-slate-50/70">
                  {beneficiaryPct}%
                </div>
              </div>

              <div>
                <label className="ios-label">Number of Sessions / Events</label>
                <input
                  type="number"
                  value={csrData.activities.numberOfSessions}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    activities: { ...csrData.activities, numberOfSessions: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Attendance / Roll Evidence</label>
                <input
                  type="text"
                  value={csrData.activities.attendanceEvidence}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    activities: { ...csrData.activities, attendanceEvidence: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. LEVEL CSR-3 — EXPENDITURE REFERENCES */}
      {activeTab === 'csr-3' && (
        <div className="space-y-6">
          <CommonLevel0Card
            fields={csrData.expenditure.common}
            accentColor="rose"
            onChange={(upd) => setCsrData({
              ...csrData,
              expenditure: { ...csrData.expenditure, common: { ...csrData.expenditure.common, ...upd } }
            })}
          />

          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title">Level CSR-3 — CSR Expenditure References</h3>
              <p className="text-xs text-slate-500">Link verified disbursement records with Finance-approved accounting ledgers</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="ios-label">Approved Budget Reference</label>
                <input
                  type="text"
                  value={csrData.expenditure.approvedBudgetReference}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    expenditure: { ...csrData.expenditure, approvedBudgetReference: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Actual Expenditure Reference</label>
                <input
                  type="text"
                  value={csrData.expenditure.actualExpenditureReference}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    expenditure: { ...csrData.expenditure, actualExpenditureReference: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Disbursed Spend (₹ Crore)</label>
                <input
                  type="number"
                  value={csrData.expenditure.expenditureAmountCr}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    expenditure: { ...csrData.expenditure, expenditureAmountCr: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Financial Reconciliation Status</label>
                <select
                  value={csrData.expenditure.financialReconciliationStatus}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    expenditure: { ...csrData.expenditure, financialReconciliationStatus: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Reconciled with Finance">Reconciled with Finance</option>
                  <option value="Pending Verification">Pending Verification</option>
                  <option value="Variance Detected">Variance Detected</option>
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="ios-label">Ledger / Payment GL Reference</label>
                <input
                  type="text"
                  value={csrData.expenditure.ledgerPaymentRef}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    expenditure: { ...csrData.expenditure, ledgerPaymentRef: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="ios-label">Supporting Payment Evidence</label>
                <input
                  type="text"
                  value={csrData.expenditure.supportingEvidence}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    expenditure: { ...csrData.expenditure, supportingEvidence: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. LEVEL CSR-4 — PROJECT OUTCOMES & SOCIAL IMPACT */}
      {activeTab === 'csr-4' && (
        <div className="space-y-6">
          <CommonLevel0Card
            fields={csrData.outcomes.common}
            accentColor="rose"
            onChange={(upd) => setCsrData({
              ...csrData,
              outcomes: { ...csrData.outcomes, common: { ...csrData.outcomes.common, ...upd } }
            })}
          />

          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title">Level CSR-4 — Project Outcomes & Social Impact</h3>
              <p className="text-xs text-slate-500">Distinguish outputs (sessions held) from measurable community health and livelihood outcomes</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="lg:col-span-2">
                <label className="ios-label">Outcome / Impact Indicator</label>
                <input
                  type="text"
                  value={csrData.outcomes.outcomeImpactIndicator}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    outcomes: { ...csrData.outcomes, outcomeImpactIndicator: e.target.value }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Measurement Unit</label>
                <input
                  type="text"
                  value={csrData.outcomes.measurementUnit}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    outcomes: { ...csrData.outcomes, measurementUnit: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Result Status</label>
                <select
                  value={csrData.outcomes.resultStatus}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    outcomes: { ...csrData.outcomes, resultStatus: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Target Exceeded">Target Exceeded</option>
                  <option value="Target Achieved">Target Achieved</option>
                  <option value="On Track">On Track</option>
                  <option value="Partially Met">Partially Met</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Baseline Value</label>
                <input
                  type="number"
                  step="0.1"
                  value={csrData.outcomes.baselineValue}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    outcomes: { ...csrData.outcomes, baselineValue: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Target Value</label>
                <input
                  type="number"
                  step="0.1"
                  value={csrData.outcomes.targetValue}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    outcomes: { ...csrData.outcomes, targetValue: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Actual Value Achieved</label>
                <input
                  type="number"
                  step="0.1"
                  value={csrData.outcomes.actualValue}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    outcomes: { ...csrData.outcomes, actualValue: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-emerald-700"
                />
              </div>

              <div>
                <label className="ios-label">Data Collection Method</label>
                <select
                  value={csrData.outcomes.dataCollectionMethod}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    outcomes: { ...csrData.outcomes, dataCollectionMethod: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Government Health Center Records">Government Health Center Records</option>
                  <option value="Baseline-Endline Household Survey">Baseline-Endline Household Survey</option>
                  <option value="School Enrollment Registers">School Enrollment Registers</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. LEVEL CSR-5 — COMMUNITY ENGAGEMENT & GRIEVANCES */}
      {activeTab === 'csr-5' && (
        <div className="space-y-6">
          <CommonLevel0Card
            fields={csrData.grievances.common}
            accentColor="rose"
            onChange={(upd) => setCsrData({
              ...csrData,
              grievances: { ...csrData.grievances, common: { ...csrData.grievances.common, ...upd } }
            })}
          />

          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title">Level CSR-5 — Community Engagement & Grievances</h3>
              <p className="text-xs text-slate-500">Record community feedback, village complaints, and resolution timelines</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="ios-label">Grievance / Feedback ID</label>
                <input
                  type="text"
                  value={csrData.grievances.grievanceId}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    grievances: { ...csrData.grievances, grievanceId: e.target.value }
                  })}
                  className="ios-field !text-xs font-mono font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Category</label>
                <select
                  value={csrData.grievances.category}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    grievances: { ...csrData.grievances, category: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Water Supply Interruption">Water Supply Interruption</option>
                  <option value="Infrastructure Inconvenience">Infrastructure Inconvenience</option>
                  <option value="Dust / Noise Impact">Dust / Noise Impact</option>
                  <option value="Local Employment Concern">Local Employment Concern</option>
                  <option value="General Query">General Query</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Affected Community / Village</label>
                <input
                  type="text"
                  value={csrData.grievances.affectedCommunityLocation}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    grievances: { ...csrData.grievances, affectedCommunityLocation: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Resolution Status</label>
                <select
                  value={csrData.grievances.resolutionStatus}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    grievances: { ...csrData.grievances, resolutionStatus: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Resolved">Resolved</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Escalated to CSR Head">Escalated to CSR Head</option>
                  <option value="Closed with Agreement">Closed with Agreement</option>
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="ios-label">Description</label>
                <input
                  type="text"
                  value={csrData.grievances.description}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    grievances: { ...csrData.grievances, description: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="ios-label">Action Taken</label>
                <input
                  type="text"
                  value={csrData.grievances.actionTaken}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    grievances: { ...csrData.grievances, actionTaken: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. LEVEL CSR-6 — SOCIAL IMPACT ASSESSMENT (SIA) */}
      {activeTab === 'csr-6' && (
        <div className="space-y-6">
          <CommonLevel0Card
            fields={csrData.sia.common}
            accentColor="rose"
            onChange={(upd) => setCsrData({
              ...csrData,
              sia: { ...csrData.sia, common: { ...csrData.sia.common, ...upd } }
            })}
          />

          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title">Level CSR-6 — Social Impact Assessment (SIA)</h3>
              <p className="text-xs text-slate-500">Statutory independent evaluations under Section 135 for projects &gt;= ₹1 Crore</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="ios-label">SIA Applicability</label>
                <select
                  value={csrData.sia.siaApplicability}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    sia: { ...csrData.sia, siaApplicability: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Mandatory (Project >= ₹1 Cr + Completed 1 Yr)">Mandatory (&gt;= ₹1 Cr)</option>
                  <option value="Voluntary Good Practice">Voluntary Good Practice</option>
                  <option value="Exempted">Exempted</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Assessment Agency</label>
                <input
                  type="text"
                  value={csrData.sia.assessmentAgency}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    sia: { ...csrData.sia, assessmentAgency: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Assessment Date</label>
                <input
                  type="date"
                  value={csrData.sia.assessmentDate}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    sia: { ...csrData.sia, assessmentDate: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Public Disclosure Status</label>
                <select
                  value={csrData.sia.publicDisclosureStatus}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    sia: { ...csrData.sia, publicDisclosureStatus: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Published on Company Website">Published on Company Website</option>
                  <option value="Draft Under Board Review">Draft Under Board Review</option>
                  <option value="Exempted">Exempted</option>
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="ios-label">Key Findings</label>
                <input
                  type="text"
                  value={csrData.sia.assessmentFindings}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    sia: { ...csrData.sia, assessmentFindings: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="ios-label">Public Report URL</label>
                <input
                  type="text"
                  value={csrData.sia.publicReportUrl}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    sia: { ...csrData.sia, publicReportUrl: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. LEVEL CSR-7 — R&R */}
      {activeTab === 'csr-7' && (
        <div className="space-y-6">
          <CommonLevel0Card
            fields={csrData.rr.common}
            accentColor="rose"
            onChange={(upd) => setCsrData({
              ...csrData,
              rr: { ...csrData.rr, common: { ...csrData.rr.common, ...upd } }
            })}
          />

          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title">Level CSR-7 — Rehabilitation & Resettlement (R&R)</h3>
              <p className="text-xs text-slate-500">Enable only where applicable for project-affected families (PAFs)</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="ios-label">Project Reference</label>
                <input
                  type="text"
                  value={csrData.rr.projectReference}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    rr: { ...csrData.rr, projectReference: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">PAFs Identified</label>
                <input
                  type="number"
                  value={csrData.rr.pafsIdentified}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    rr: { ...csrData.rr, pafsIdentified: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">PAFs Covered by R&R</label>
                <input
                  type="number"
                  value={csrData.rr.pafsCoveredByRandR}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    rr: { ...csrData.rr, pafsCoveredByRandR: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Disbursement Status</label>
                <select
                  value={csrData.rr.status}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    rr: { ...csrData.rr, status: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="All Compensation Disbursed">All Compensation Disbursed</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Disputed / In Court">Disputed / In Court</option>
                  <option value="Not Applicable">Not Applicable</option>
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="ios-label">Compensation Order Reference</label>
                <input
                  type="text"
                  value={csrData.rr.compensationSupportReference}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    rr: { ...csrData.rr, compensationSupportReference: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="ios-label">Treasury Payment Ref</label>
                <input
                  type="text"
                  value={csrData.rr.paymentEvidenceReference}
                  onChange={(e) => setCsrData({
                    ...csrData,
                    rr: { ...csrData.rr, paymentEvidenceReference: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 9. EVIDENCE TAB */}
      {activeTab === 'evidence' && (
        <CommonEvidenceManager roleKey="CSR_USER" accentColor="rose" />
      )}

      {/* 10. SUBMISSIONS TAB */}
      {activeTab === 'submissions' && (
        <div className="space-y-6">
          <div className="glass-form-card">
            <h3 className="text-lg font-black text-slate-900 mb-1">My CSR Submissions History</h3>
            <p className="text-xs text-slate-500 mb-4">Complete audit trail of verified CSR programmes and beneficiary records</p>
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
            <History className="h-5 w-5 text-rose-600" />
            <h3 className="text-base font-bold text-slate-900">CSR Contributor Activity Log</h3>
          </div>
          <div className="space-y-3">
            {activities.map((act) => (
              <div key={act.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 flex items-start justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">{act.user}</span>
                    <span className="rounded-md bg-rose-100 text-rose-800 px-1.5 py-0.5 text-[10px] font-bold">{act.action}</span>
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
        roleKey="CSR_USER"
        levelName={activeTab.toUpperCase()}
        onSubmitSuccess={() => {
          setAssignments(contributorStore.getAssignments('CSR_USER'))
          setActivities(contributorStore.getActivities('CSR_USER'))
        }}
      />
    </div>
  )
}
