'use client'
/**
 * ComplianceWorkspace — MEIL ESG / BRSR Reporting Platform
 *
 * Governance & Compliance Contributor Workspace:
 * - Level 0: Universal Common Reporting Fields (all 24 fields)
 * - Level GOV-1: Policy Register (All 9 BRSR Principles, Board approvals, Public URLs)
 * - Level GOV-2: Policy Implementation & Review (Rollout, Coverage %, Secretarial audit)
 * - Level GOV-3: Business Ethics & Anti-Corruption (Anti-bribery training, Complaints count)
 * - Level GOV-4: Whistleblower & Stakeholder Grievances (Vigil mechanism, Ombudsman cases)
 * - Level GOV-5: Regulatory Compliance & Notices (Show-cause notices, Penalties, Disposals)
 * - Level GOV-6: Human Rights & Responsible Business (Due diligence, Zero child labour)
 * - Level GOV-7: Governance Oversight & Responsibilities (Board ESG committee oversight)
 * - Screen 1: Governance & Compliance Console (7 Dashboard Cards + My Governance Assignments Table)
 * - Evidence & Documents Repository
 * - Shared Validation & Multi-state Submission Workflow
 */
import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileCheck2, ShieldCheck, Scale, AlertCircle, Calendar, Gavel,
  CheckCircle2, Clock, AlertTriangle, ArrowRight, Save, Send, Upload,
  RefreshCw, Sparkles, Filter, Eye, Edit3, ChevronRight, Layers, FileText,
  TrendingUp, Building2, History, Award, CheckSquare, Globe
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
  'comp-policies': 'gov-1',
  'comp-obligations': 'gov-2',
  'comp-ethics': 'gov-3',
  'comp-cases': 'gov-4',
  'comp-controls': 'gov-5',
  'comp-calendar': 'gov-7',
  evidence: 'evidence',
  submissions: 'submissions',
}

export function ComplianceWorkspace() {
  const { activeModule } = useApp()
  const [activeTab, setActiveTab] = useState<string>('overview')
  const [govData, setGovData] = useState(() => contributorStore.getGovData())
  const [assignments, setAssignments] = useState<ContributorAssignment[]>(() => contributorStore.getAssignments('COMPLIANCE_USER'))
  const [activities, setActivities] = useState<ActivityEvent[]>(() => contributorStore.getActivities('COMPLIANCE_USER'))
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
    contributorStore.saveGovData(govData)
    setTimeout(() => {
      setSaveStatus('Draft Saved')
      triggerToast(`${levelLabel} draft saved successfully.`)
      contributorStore.addActivity({
        id: 'act-' + Date.now(),
        roleKey: 'COMPLIANCE_USER',
        timestamp: 'Just now',
        user: 'Anand Sharma (Compliance)',
        action: 'Saved Draft',
        target: levelLabel,
        details: 'Governance & regulatory compliance disclosures updated in local store.',
        badgeTone: 'purple'
      })
      setActivities(contributorStore.getActivities('COMPLIANCE_USER'))
      setTimeout(() => setSaveStatus('Saved'), 2000)
    }, 400)
  }

  const tabList = [
    { id: 'overview', label: 'Governance Console' },
    { id: 'gov-1', label: 'GOV-1: Policy Register' },
    { id: 'gov-2', label: 'GOV-2: Implementation' },
    { id: 'gov-3', label: 'GOV-3: Business Ethics' },
    { id: 'gov-4', label: 'GOV-4: Whistleblower' },
    { id: 'gov-5', label: 'GOV-5: Regulatory Notices' },
    { id: 'gov-6', label: 'GOV-6: Human Rights' },
    { id: 'gov-7', label: 'GOV-7: Board Oversight' },
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
            className="fixed top-6 right-6 z-50 flex items-center gap-2 rounded-2xl border border-purple-200 bg-white/95 px-4 py-3 shadow-xl shadow-purple-500/10 backdrop-blur-xl text-xs font-bold text-purple-800"
          >
            <CheckCircle2 className="h-4 w-4 text-purple-600" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER SECTION */}
      <div className="relative overflow-hidden glass-form-card md:!p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/25">
                <Scale className="h-6 w-6" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
                Governance & Compliance Contributor Workspace
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50/80 px-3 py-1 text-xs font-bold text-purple-700 shadow-xs">
                <Sparkles className="h-3 w-3 text-purple-600" />
                BRSR Principle 1 & 9
              </span>
            </div>
            <p className="text-sm font-medium text-slate-500">
              Corporate policy register · Anti-corruption & ethics · Whistleblower cases · Statutory notices & Board committee oversight
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
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-500/20 hover:from-purple-700 hover:to-indigo-700 hover:-translate-y-px transition-all cursor-pointer active:scale-95"
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
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-500/25'
                  : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 1. GOVERNANCE CONSOLE OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* 7 Dashboard Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3.5">
            {[
              { label: 'Assigned Compliance', val: '3 Records', sub: 'FY 2026-27', icon: Layers, tone: 'text-purple-600 bg-purple-50' },
              { label: 'Pending Policy Data', val: '0 Pending', sub: 'All 9 Uploaded', icon: CheckCircle2, tone: 'text-emerald-600 bg-emerald-50' },
              { label: 'Policy Review Due', val: '1 Policy', sub: 'May 2027 Schedule', icon: Clock, tone: 'text-amber-600 bg-amber-50' },
              { label: 'Open Issues', val: '0 Open', sub: 'SCN Disposed Off', icon: ShieldCheck, tone: 'text-emerald-600 bg-emerald-50' },
              { label: 'Pending Grievances', val: '1 Case', sub: 'IC Under Review', icon: AlertCircle, tone: 'text-rose-600 bg-rose-50' },
              { label: 'Missing Evidence', val: '0 Files', sub: '100% Certified', icon: FileCheck2, tone: 'text-emerald-600 bg-emerald-50' },
              { label: 'Returned Records', val: '0 Items', sub: 'Queue Approved', icon: ShieldCheck, tone: 'text-purple-600 bg-purple-50' },
            ].map((card, i) => (
              <div key={i} className="rounded-[22px] border border-white/60 bg-white/75 p-3.5 shadow-lg shadow-sky-500/5 backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 leading-tight">{card.label}</span>
                  <div className={`p-1 rounded-md ${card.tone}`}>
                    <card.icon className="h-3 w-3" />
                  </div>
                </div>
                <div className="mt-2 text-base font-black text-slate-900">{card.val}</div>
                <div className="text-[10px] text-slate-400 font-medium truncate">{card.sub}</div>
              </div>
            ))}
          </div>

          {/* Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-[24px] border border-white/60 bg-white/75 p-5 shadow-lg shadow-sky-500/5 backdrop-blur-xl">
              <span className="text-xs font-bold text-slate-500">Corporate Policy Status</span>
              <div className="mt-2 text-lg font-black text-slate-900 truncate">
                {govData.policies.policyName}
              </div>
              <div className="mt-3 text-xs text-slate-500 space-y-1">
                <div className="flex justify-between">
                  <span>Policy ID:</span>
                  <span className="font-bold text-purple-700">{govData.policies.policyId}</span>
                </div>
                <div className="flex justify-between">
                  <span>Approval Authority:</span>
                  <span className="font-bold text-slate-800">{govData.policies.approvalAuthority}</span>
                </div>
                <div className="flex justify-between">
                  <span>Public URL:</span>
                  <span className="font-bold text-emerald-700">Publicly Hosted</span>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/60 bg-white/75 p-5 shadow-lg shadow-sky-500/5 backdrop-blur-xl">
              <span className="text-xs font-bold text-slate-500">Ethics & Vigil Mechanism</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">Zero Inquiries</span>
                <span className="text-xs font-semibold text-emerald-600">Anti-Bribery Clean</span>
              </div>
              <div className="mt-3 text-xs text-slate-500 space-y-1">
                <div className="flex justify-between">
                  <span>Training Coverage:</span>
                  <span className="font-bold text-slate-800">{govData.ethics.participationCount} Directors & KMPs</span>
                </div>
                <div className="flex justify-between">
                  <span>Whistleblower Resolved:</span>
                  <span className="font-bold text-slate-800">{govData.whistleblower.countResolved} of {govData.whistleblower.countReceived}</span>
                </div>
                <div className="flex justify-between">
                  <span>Ombudsman Log:</span>
                  <span className="font-bold text-purple-700">Confidential Register</span>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/60 bg-white/75 p-5 shadow-lg shadow-sky-500/5 backdrop-blur-xl">
              <span className="text-xs font-bold text-slate-500">Regulatory Notices & Penalties</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">Nil Penalties</span>
                <span className="text-xs font-semibold text-emerald-600">100% Resolved</span>
              </div>
              <div className="mt-3 text-xs text-slate-500 space-y-1">
                <div className="flex justify-between">
                  <span>Latest Notice:</span>
                  <span className="font-bold text-slate-800">{govData.compliance.complianceNoticeId}</span>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className="font-bold text-emerald-700">{govData.compliance.currentStatus}</span>
                </div>
                <div className="flex justify-between">
                  <span>Board Oversight:</span>
                  <span className="font-bold text-slate-800 truncate max-w-[140px]">{govData.oversight.responsibleAuthority}</span>
                </div>
              </div>
            </div>
          </div>

          {/* My Governance Assignments Table */}
          <div className="rounded-[24px] border border-white/60 bg-white/75 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">My Governance Assignments</h3>
                <p className="text-xs text-slate-500">Corporate policy & secretarial disclosure tasks</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('gov-1')}
                className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1"
              >
                <span>Enter Policy Data</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="pb-3">Secretarial Scope</th>
                    <th className="pb-3">Year</th>
                    <th className="pb-3">Governance Module</th>
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
                      <td className="py-3 font-bold text-purple-700">{asg.module}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full bg-purple-500 rounded-full" style={{ width: `${asg.completionPercentage}%` }} />
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
                            if (asg.levelKey === 'GOV-1') setActiveTab('gov-1')
                            else if (asg.levelKey === 'GOV-5') setActiveTab('gov-5')
                            else if (asg.levelKey === 'GOV-4') setActiveTab('gov-4')
                            else setActiveTab('gov-1')
                          }}
                          className="rounded-lg bg-purple-50 px-2.5 py-1 text-xs font-bold text-purple-700 hover:bg-purple-100 transition-colors"
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

      {/* 2. LEVEL GOV-1 — POLICY REGISTER */}
      {activeTab === 'gov-1' && (
        <div className="space-y-6">
          <CommonLevel0Card
            fields={govData.policies.common}
            accentColor="purple"
            onChange={(upd) => setGovData({
              ...govData,
              policies: { ...govData.policies, common: { ...govData.policies.common, ...upd } }
            })}
          />

          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title">Level GOV-1 — Corporate Policy Register</h3>
              <p className="text-xs text-slate-500">Register approved board policies across BRSR Principles 1 through 9</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="ios-label">Policy ID</label>
                <input
                  type="text"
                  value={govData.policies.policyId}
                  onChange={(e) => setGovData({
                    ...govData,
                    policies: { ...govData.policies, policyId: e.target.value }
                  })}
                  className="ios-field !text-xs font-mono font-bold text-slate-800"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="ios-label">Policy Name</label>
                <input
                  type="text"
                  value={govData.policies.policyName}
                  onChange={(e) => setGovData({
                    ...govData,
                    policies: { ...govData.policies, policyName: e.target.value }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Policy Category</label>
                <select
                  value={govData.policies.policyCategory}
                  onChange={(e) => setGovData({
                    ...govData,
                    policies: { ...govData.policies, policyCategory: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Business Conduct & Ethics">Business Conduct & Ethics</option>
                  <option value="Anti-Bribery & Corruption">Anti-Bribery & Corruption</option>
                  <option value="Whistleblower Policy">Whistleblower Policy</option>
                  <option value="Human Rights Policy">Human Rights Policy</option>
                  <option value="EHS Policy">EHS Policy</option>
                  <option value="CSR & Sustainability Policy">CSR & Sustainability Policy</option>
                  <option value="Data Privacy & Cyber">Data Privacy & Cyber</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Policy Version</label>
                <input
                  type="text"
                  value={govData.policies.policyVersion}
                  onChange={(e) => setGovData({
                    ...govData,
                    policies: { ...govData.policies, policyVersion: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Policy Owner</label>
                <input
                  type="text"
                  value={govData.policies.policyOwner}
                  onChange={(e) => setGovData({
                    ...govData,
                    policies: { ...govData.policies, policyOwner: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Approval Authority</label>
                <select
                  value={govData.policies.approvalAuthority}
                  onChange={(e) => setGovData({
                    ...govData,
                    policies: { ...govData.policies, approvalAuthority: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Board of Directors">Board of Directors</option>
                  <option value="Audit Committee">Audit Committee</option>
                  <option value="MD & CEO">MD & CEO</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Approval Date</label>
                <input
                  type="date"
                  value={govData.policies.approvalDate}
                  onChange={(e) => setGovData({
                    ...govData,
                    policies: { ...govData.policies, approvalDate: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Effective Date</label>
                <input
                  type="date"
                  value={govData.policies.effectiveDate}
                  onChange={(e) => setGovData({
                    ...govData,
                    policies: { ...govData.policies, effectiveDate: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Last Review Date</label>
                <input
                  type="date"
                  value={govData.policies.lastReviewDate}
                  onChange={(e) => setGovData({
                    ...govData,
                    policies: { ...govData.policies, lastReviewDate: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Next Review Date</label>
                <input
                  type="date"
                  value={govData.policies.nextReviewDate}
                  onChange={(e) => setGovData({
                    ...govData,
                    policies: { ...govData.policies, nextReviewDate: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Publicly Available?</label>
                <select
                  value={govData.policies.isPubliclyAvailable}
                  onChange={(e) => setGovData({
                    ...govData,
                    policies: { ...govData.policies, isPubliclyAvailable: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="ios-label">Public Web URL</label>
                <input
                  type="text"
                  value={govData.policies.publicUrl}
                  onChange={(e) => setGovData({
                    ...govData,
                    policies: { ...govData.policies, publicUrl: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. LEVEL GOV-2 — POLICY IMPLEMENTATION */}
      {activeTab === 'gov-2' && (
        <div className="space-y-6">
          <CommonLevel0Card
            fields={govData.implementation.common}
            accentColor="purple"
            onChange={(upd) => setGovData({
              ...govData,
              implementation: { ...govData.implementation, common: { ...govData.implementation.common, ...upd } }
            })}
          />

          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title">Level GOV-2 — Policy Implementation & Review</h3>
              <p className="text-xs text-slate-500">Record evidence of actual operational rollout, employee coverage, and secretarial audits</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="ios-label">Policy ID</label>
                <input
                  type="text"
                  value={govData.implementation.policyId}
                  onChange={(e) => setGovData({
                    ...govData,
                    implementation: { ...govData.implementation, policyId: e.target.value }
                  })}
                  className="ios-field !text-xs font-mono font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Implementation Status</label>
                <select
                  value={govData.implementation.implementationStatus}
                  onChange={(e) => setGovData({
                    ...govData,
                    implementation: { ...govData.implementation, implementationStatus: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Fully Implemented">Fully Implemented</option>
                  <option value="Under Rollout">Under Rollout</option>
                  <option value="Annual Refresh in Progress">Annual Refresh in Progress</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Employee Coverage %</label>
                <input
                  type="number"
                  value={govData.implementation.coveragePercentage}
                  onChange={(e) => setGovData({
                    ...govData,
                    implementation: { ...govData.implementation, coveragePercentage: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-purple-700"
                />
              </div>

              <div>
                <label className="ios-label">Review Method</label>
                <select
                  value={govData.implementation.reviewMethod}
                  onChange={(e) => setGovData({
                    ...govData,
                    implementation: { ...govData.implementation, reviewMethod: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Internal Compliance Audit">Internal Compliance Audit</option>
                  <option value="Secretarial Audit">Secretarial Audit</option>
                  <option value="Third-Party Legal Review">Third-Party Legal Review</option>
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="ios-label">Applicable Entities / BUs</label>
                <input
                  type="text"
                  value={govData.implementation.applicableEntities}
                  onChange={(e) => setGovData({
                    ...govData,
                    implementation: { ...govData.implementation, applicableEntities: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="ios-label">Review Findings</label>
                <input
                  type="text"
                  value={govData.implementation.reviewFindings}
                  onChange={(e) => setGovData({
                    ...govData,
                    implementation: { ...govData.implementation, reviewFindings: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. LEVEL GOV-3 — BUSINESS ETHICS */}
      {activeTab === 'gov-3' && (
        <div className="space-y-6">
          <CommonLevel0Card
            fields={govData.ethics.common}
            accentColor="purple"
            onChange={(upd) => setGovData({
              ...govData,
              ethics: { ...govData.ethics, common: { ...govData.ethics.common, ...upd } }
            })}
          />

          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title">Level GOV-3 — Business Ethics & Anti-Corruption</h3>
              <p className="text-xs text-slate-500">Track anti-corruption programs, conflict of interest declarations, and disciplinary complaints</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="ios-label">Disclosure Category</label>
                <select
                  value={govData.ethics.disclosureCategory}
                  onChange={(e) => setGovData({
                    ...govData,
                    ethics: { ...govData.ethics, disclosureCategory: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Anti-Corruption Training">Anti-Corruption Training</option>
                  <option value="Conflict of Interest Disclosures">Conflict of Interest Disclosures</option>
                  <option value="Gifts & Hospitality Register">Gifts & Hospitality Register</option>
                  <option value="Anti-Competitive Conduct">Anti-Competitive Conduct</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Applicable Population</label>
                <select
                  value={govData.ethics.applicablePopulation}
                  onChange={(e) => setGovData({
                    ...govData,
                    ethics: { ...govData.ethics, applicablePopulation: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Directors & KMPs">Directors & KMPs</option>
                  <option value="Senior Leadership">Senior Leadership</option>
                  <option value="All Employees">All Employees</option>
                  <option value="Supply Chain Partners">Supply Chain Partners</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Participation Count</label>
                <input
                  type="number"
                  value={govData.ethics.participationCount}
                  onChange={(e) => setGovData({
                    ...govData,
                    ethics: { ...govData.ethics, participationCount: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Complaints Received</label>
                <input
                  type="number"
                  value={govData.ethics.countReceived}
                  onChange={(e) => setGovData({
                    ...govData,
                    ethics: { ...govData.ethics, countReceived: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="ios-label">Training / Awareness Activity</label>
                <input
                  type="text"
                  value={govData.ethics.trainingActivity}
                  onChange={(e) => setGovData({
                    ...govData,
                    ethics: { ...govData.ethics, trainingActivity: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="ios-label">Source Register</label>
                <input
                  type="text"
                  value={govData.ethics.sourceRegister}
                  onChange={(e) => setGovData({
                    ...govData,
                    ethics: { ...govData.ethics, sourceRegister: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. LEVEL GOV-4 — WHISTLEBLOWER & GRIEVANCES */}
      {activeTab === 'gov-4' && (
        <div className="space-y-6">
          <CommonLevel0Card
            fields={govData.whistleblower.common}
            accentColor="purple"
            onChange={(upd) => setGovData({
              ...govData,
              whistleblower: { ...govData.whistleblower, common: { ...govData.whistleblower.common, ...upd } }
            })}
          />

          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title">Level GOV-4 — Whistleblower & Stakeholder Grievances</h3>
              <p className="text-xs text-slate-500">Track vigil mechanism complaints while maintaining complainant anonymity</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="ios-label">Grievance Reference</label>
                <input
                  type="text"
                  value={govData.whistleblower.grievanceReference}
                  onChange={(e) => setGovData({
                    ...govData,
                    whistleblower: { ...govData.whistleblower, grievanceReference: e.target.value }
                  })}
                  className="ios-field !text-xs font-mono font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Grievance Category</label>
                <select
                  value={govData.whistleblower.grievanceCategory}
                  onChange={(e) => setGovData({
                    ...govData,
                    whistleblower: { ...govData.whistleblower, grievanceCategory: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Financial Impropriety">Financial Impropriety</option>
                  <option value="Bribery / Kickback">Bribery / Kickback</option>
                  <option value="Harassment / Discrimination">Harassment / Discrimination</option>
                  <option value="Environmental Violation">Environmental Violation</option>
                  <option value="Safety Compromise">Safety Compromise</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Count Received</label>
                <input
                  type="number"
                  value={govData.whistleblower.countReceived}
                  onChange={(e) => {
                    const rcv = Number(e.target.value)
                    const rslv = govData.whistleblower.countResolved
                    setGovData({
                      ...govData,
                      whistleblower: {
                        ...govData.whistleblower,
                        countReceived: rcv,
                        countPending: Math.max(0, rcv - rslv)
                      }
                    })
                  }}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Count Resolved</label>
                <input
                  type="number"
                  value={govData.whistleblower.countResolved}
                  onChange={(e) => {
                    const rslv = Number(e.target.value)
                    const rcv = govData.whistleblower.countReceived
                    setGovData({
                      ...govData,
                      whistleblower: {
                        ...govData.whistleblower,
                        countResolved: rslv,
                        countPending: Math.max(0, rcv - rslv)
                      }
                    })
                  }}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Count Pending (Calculated)</label>
                <div className="ios-field !text-xs font-black text-rose-600 !bg-slate-50/70">
                  {govData.whistleblower.countPending}
                </div>
              </div>

              <div>
                <label className="ios-label">Resolution Status</label>
                <select
                  value={govData.whistleblower.resolutionStatus}
                  onChange={(e) => setGovData({
                    ...govData,
                    whistleblower: { ...govData.whistleblower, resolutionStatus: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Resolved & Closed">Resolved & Closed</option>
                  <option value="Investigation Active">Investigation Active</option>
                  <option value="Escalated to Audit Committee">Escalated to Audit Committee</option>
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="ios-label">Confidential Source Register</label>
                <input
                  type="text"
                  value={govData.whistleblower.sourceRegister}
                  onChange={(e) => setGovData({
                    ...govData,
                    whistleblower: { ...govData.whistleblower, sourceRegister: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. LEVEL GOV-5 — REGULATORY COMPLIANCE & NOTICES */}
      {activeTab === 'gov-5' && (
        <div className="space-y-6">
          <CommonLevel0Card
            fields={govData.compliance.common}
            accentColor="purple"
            onChange={(upd) => setGovData({
              ...govData,
              compliance: { ...govData.compliance, common: { ...govData.compliance.common, ...upd } }
            })}
          />

          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title">Level GOV-5 — Regulatory Compliance & Notices</h3>
              <p className="text-xs text-slate-500">Record show-cause notices, legal examination stages, and financial penalty disclosures</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="ios-label">Notice / SCN ID</label>
                <input
                  type="text"
                  value={govData.compliance.complianceNoticeId}
                  onChange={(e) => setGovData({
                    ...govData,
                    compliance: { ...govData.compliance, complianceNoticeId: e.target.value }
                  })}
                  className="ios-field !text-xs font-mono font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Issuing Authority</label>
                <select
                  value={govData.compliance.issuingAuthority}
                  onChange={(e) => setGovData({
                    ...govData,
                    compliance: { ...govData.compliance, issuingAuthority: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Pollution Control Board">Pollution Control Board</option>
                  <option value="SEBI">SEBI</option>
                  <option value="Ministry of Corporate Affairs (MCA)">Ministry of Corporate Affairs (MCA)</option>
                  <option value="Labour Department">Labour Department</option>
                  <option value="Tax Authorities">Tax Authorities</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Current Legal Status</label>
                <select
                  value={govData.compliance.currentStatus}
                  onChange={(e) => setGovData({
                    ...govData,
                    compliance: { ...govData.compliance, currentStatus: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Case Disposed Off">Case Disposed Off</option>
                  <option value="Alleged / SCN Received">Alleged / SCN Received</option>
                  <option value="Under Legal Examination">Under Legal Examination</option>
                  <option value="Reply Submitted">Reply Submitted</option>
                  <option value="Adjudicated & Penalty Paid">Adjudicated & Penalty Paid</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Financial Penalty?</label>
                <select
                  value={govData.compliance.hasFinancialPenalty}
                  onChange={(e) => setGovData({
                    ...govData,
                    compliance: { ...govData.compliance, hasFinancialPenalty: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="ios-label">Regulation / Statutory Requirement</label>
                <input
                  type="text"
                  value={govData.compliance.regulationRequirement}
                  onChange={(e) => setGovData({
                    ...govData,
                    compliance: { ...govData.compliance, regulationRequirement: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="ios-label">Alleged Non-Compliance</label>
                <input
                  type="text"
                  value={govData.compliance.allegedNonCompliance}
                  onChange={(e) => setGovData({
                    ...govData,
                    compliance: { ...govData.compliance, allegedNonCompliance: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div className="lg:col-span-4">
                <label className="ios-label">Corrective Action Taken & Disposal Note</label>
                <input
                  type="text"
                  value={govData.compliance.correctiveAction}
                  onChange={(e) => setGovData({
                    ...govData,
                    compliance: { ...govData.compliance, correctiveAction: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. LEVEL GOV-6 — HUMAN RIGHTS */}
      {activeTab === 'gov-6' && (
        <div className="space-y-6">
          <CommonLevel0Card
            fields={govData.humanRights.common}
            accentColor="purple"
            onChange={(upd) => setGovData({
              ...govData,
              humanRights: { ...govData.humanRights, common: { ...govData.humanRights.common, ...upd } }
            })}
          />

          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title">Level GOV-6 — Human Rights Due Diligence</h3>
              <p className="text-xs text-slate-500">Record due diligence audits across supply chains, construction sites and labour accommodations</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="ios-label">Policy / Disclosure Category</label>
                <select
                  value={govData.humanRights.policyDisclosureCategory}
                  onChange={(e) => setGovData({
                    ...govData,
                    humanRights: { ...govData.humanRights, policyDisclosureCategory: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Child Labour Due Diligence">Child Labour Due Diligence</option>
                  <option value="Forced / Involuntary Labour">Forced / Involuntary Labour</option>
                  <option value="Wages & Fair Working Hours">Wages & Fair Working Hours</option>
                  <option value="Freedom of Association">Freedom of Association</option>
                  <option value="Workplace Discrimination">Workplace Discrimination</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Resolution Status</label>
                <select
                  value={govData.humanRights.resolutionStatus}
                  onChange={(e) => setGovData({
                    ...govData,
                    humanRights: { ...govData.humanRights, resolutionStatus: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="No Violations Identified">No Violations Identified</option>
                  <option value="Corrective Action Completed">Corrective Action Completed</option>
                  <option value="Under Remediation">Under Remediation</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Complaints Received</label>
                <input
                  type="number"
                  value={govData.humanRights.complaintsReceived}
                  onChange={(e) => setGovData({
                    ...govData,
                    humanRights: { ...govData.humanRights, complaintsReceived: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Source Register</label>
                <input
                  type="text"
                  value={govData.humanRights.sourceRegister}
                  onChange={(e) => setGovData({
                    ...govData,
                    humanRights: { ...govData.humanRights, sourceRegister: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="ios-label">Due Diligence Activity</label>
                <input
                  type="text"
                  value={govData.humanRights.dueDiligenceActivity}
                  onChange={(e) => setGovData({
                    ...govData,
                    humanRights: { ...govData.humanRights, dueDiligenceActivity: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="ios-label">Issues Identified</label>
                <input
                  type="text"
                  value={govData.humanRights.issuesIdentified}
                  onChange={(e) => setGovData({
                    ...govData,
                    humanRights: { ...govData.humanRights, issuesIdentified: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. LEVEL GOV-7 — BOARD OVERSIGHT */}
      {activeTab === 'gov-7' && (
        <div className="space-y-6">
          <CommonLevel0Card
            fields={govData.oversight.common}
            accentColor="purple"
            onChange={(upd) => setGovData({
              ...govData,
              oversight: { ...govData.oversight, common: { ...govData.oversight.common, ...upd } }
            })}
          />

          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title">Level GOV-7 — Governance Oversight & Responsibilities</h3>
              <p className="text-xs text-slate-500">Record evidence of Board committee supervision, materiality reviews, and assurance mandate</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="ios-label">Governance Topic</label>
                <select
                  value={govData.oversight.governanceTopic}
                  onChange={(e) => setGovData({
                    ...govData,
                    oversight: { ...govData.oversight, governanceTopic: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="BRSR Reporting Oversight">BRSR Reporting Oversight</option>
                  <option value="ESG Risk Assessment">ESG Risk Assessment</option>
                  <option value="Materiality Validation">Materiality Validation</option>
                  <option value="Stakeholder Feedback Review">Stakeholder Feedback Review</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Responsible Authority</label>
                <select
                  value={govData.oversight.responsibleAuthority}
                  onChange={(e) => setGovData({
                    ...govData,
                    oversight: { ...govData.oversight, responsibleAuthority: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="ESG & Sustainability Committee of Board">ESG & Sustainability Committee of Board</option>
                  <option value="Audit Committee">Audit Committee</option>
                  <option value="Risk Management Committee">Risk Management Committee</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Assigned Reporting Owner</label>
                <input
                  type="text"
                  value={govData.oversight.assignedReportingOwner}
                  onChange={(e) => setGovData({
                    ...govData,
                    oversight: { ...govData.oversight, assignedReportingOwner: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Review Frequency</label>
                <select
                  value={govData.oversight.reviewFrequency}
                  onChange={(e) => setGovData({
                    ...govData,
                    oversight: { ...govData.oversight, reviewFrequency: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Quarterly">Quarterly</option>
                  <option value="Bi-annual">Bi-annual</option>
                  <option value="Annual">Annual</option>
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="ios-label">Board Meeting Resolution Reference</label>
                <input
                  type="text"
                  value={govData.oversight.meetingResolutionRef}
                  onChange={(e) => setGovData({
                    ...govData,
                    oversight: { ...govData.oversight, meetingResolutionRef: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="ios-label">Evidence Document</label>
                <input
                  type="text"
                  value={govData.oversight.evidenceDocument}
                  onChange={(e) => setGovData({
                    ...govData,
                    oversight: { ...govData.oversight, evidenceDocument: e.target.value }
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
        <CommonEvidenceManager roleKey="COMPLIANCE_USER" accentColor="purple" />
      )}

      {/* 10. SUBMISSIONS TAB */}
      {activeTab === 'submissions' && (
        <div className="space-y-6">
          <div className="glass-form-card">
            <h3 className="text-lg font-black text-slate-900 mb-1">My Governance Submissions History</h3>
            <p className="text-xs text-slate-500 mb-4">Complete audit trail of corporate secretarial and legal policy packages</p>
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
            <History className="h-5 w-5 text-purple-600" />
            <h3 className="text-base font-bold text-slate-900">Governance Contributor Activity Log</h3>
          </div>
          <div className="space-y-3">
            {activities.map((act) => (
              <div key={act.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 flex items-start justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">{act.user}</span>
                    <span className="rounded-md bg-purple-100 text-purple-800 px-1.5 py-0.5 text-[10px] font-bold">{act.action}</span>
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
        roleKey="COMPLIANCE_USER"
        levelName={activeTab.toUpperCase()}
        onSubmitSuccess={() => {
          setAssignments(contributorStore.getAssignments('COMPLIANCE_USER'))
          setActivities(contributorStore.getActivities('COMPLIANCE_USER'))
        }}
      />
    </div>
  )
}
