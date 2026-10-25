'use client'
/**
 * meilESG — Finance & Resource Data Contributor Workspace
 * Comprehensive enterprise ESG/BRSR workspace implementing:
 * - Level 0: Common Metadata & Entity Context (all 23 fields with pre-fills & conditional rules)
 * - Level 1: Financial Summary (Turnover, CapEx, OpEx, Reporting Basis, Reconciliation)
 * - Level 2: Environmental & Resource Expenditure (all 13 fields, 8 categories, CapEx/OpEx split)
 * - Level 3: Financial Calculations & Intensity Metrics (Ratios, YoY, physical denominators)
 * - Level 4: CSR & Other Assigned Financial Disclosures (budget, spend, unspent, agency)
 * - Level 5: Financial Evidence & Documents (14 fields, upload vs acceptance status)
 * - Level 6: Validation & Reconciliation Checklist (10 checks, blocking errors vs warnings)
 * - Level 7: Multi-state Submission & Review Workflow (versioning, review comments, audit trail)
 * - Screen 2: My Assignments
 * - Screen 7: Reports & Exports (Filterable reports, working CSV/JSON export)
 * - Screen 8: Activity Log (Filterable audit trail)
 */
import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Link2, Send, FileBarChart, History, CheckCircle2,
  AlertTriangle, Upload, Plus, Trash2, Edit3, Eye, Download,
  ArrowRight, ArrowLeft, Save, ShieldCheck, Check, AlertCircle,
  HelpCircle, RefreshCw, X, FileSpreadsheet, FileCheck2, Filter,
  Layers, Clock, Sparkles, Building2, ChevronRight, Lock, Calculator,
  HeartHandshake, Info, ShieldAlert, CheckCircle, ExternalLink, Hash
} from 'lucide-react'
import { useApp } from '@/components/site-ops/context'
import {
  financeStore,
  type FinanceAssignment,
  type FinancialSummaryData,
  type ResourceExpenditureItem,
  type EvidenceDocumentItem,
  type SubmissionRecord,
  type ActivityEvent,
  type ValidationChecklistResult,
  type IntensityMetricsData,
  type CsrDisclosureData,
  type CommonMetadata
} from '@/lib/so/finance-store'

/* -------------------------------------------------------------------------- */
/* STEPPER COMPONENT FOR ENTRY SCREENS (hoisted out of the render body —       */
/* react-hooks/static-components)                                             */
/* -------------------------------------------------------------------------- */
function FinStepper({
  currentStep,
  onNavigate,
}: {
  currentStep: number
  onNavigate: (moduleKey: 'fin-data' | 'fin-expenditure' | 'fin-evidence' | 'fin-submissions', levelKey: string) => void
}) {
  const steps = [
    { num: 1, label: 'L0 Common & Entity', levelKey: 'l0', moduleKey: 'fin-data' as const },
    { num: 2, label: 'L1 Financial Summary', levelKey: 'l1', moduleKey: 'fin-data' as const },
    { num: 3, label: 'L2 Resource Spend', levelKey: 'l2', moduleKey: 'fin-expenditure' as const },
    { num: 4, label: 'L3 Intensity Metrics', levelKey: 'l3', moduleKey: 'fin-data' as const },
    { num: 5, label: 'L4 CSR Disclosures', levelKey: 'l4', moduleKey: 'fin-data' as const },
    { num: 6, label: 'L5 Evidence Vault', levelKey: 'l5', moduleKey: 'fin-evidence' as const },
    { num: 7, label: 'L6 Validation Check', levelKey: 'l6', moduleKey: 'fin-data' as const },
    { num: 8, label: 'L7 Review & Submit', levelKey: 'l7', moduleKey: 'fin-submissions' as const },
  ]

  return (
    <div className="relative mb-6 rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {steps.map((st, idx) => {
          const isCurrent = currentStep === st.num
          const isDone = currentStep > st.num

          return (
            <React.Fragment key={st.num}>
              <button
                type="button"
                onClick={() => onNavigate(st.moduleKey, st.levelKey)}
                className="flex items-center gap-2 text-left transition hover:opacity-90"
              >
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all shadow-xs ${
                  isCurrent
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white ring-4 ring-blue-100'
                    : isDone
                    ? 'bg-blue-600 text-white'
                    : 'border border-slate-200 bg-white text-slate-400'
                }`}>
                  {isDone ? <Check className="h-3.5 w-3.5" /> : st.num}
                </div>
                <div>
                  <div className={`text-[11px] font-bold ${isCurrent ? 'text-blue-900' : isDone ? 'text-slate-800' : 'text-slate-400'}`}>
                    {st.label}
                  </div>
                </div>
              </button>
              {idx < steps.length - 1 && (
                <div className="hidden h-0.5 w-6 bg-slate-200 xl:block" />
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}

export function FinanceWorkspace() {
  const { activeModule, setActiveModule } = useApp()

  // State management
  const [assignments, setAssignments] = useState<FinanceAssignment[]>([])
  const [financialData, setFinancialData] = useState<FinancialSummaryData>(financeStore.getFinancialSummary())
  const [expenditures, setExpenditures] = useState<ResourceExpenditureItem[]>([])
  const [intensityMetrics, setIntensityMetrics] = useState<IntensityMetricsData>(financeStore.getIntensityMetrics())
  const [csrData, setCsrData] = useState<CsrDisclosureData>(financeStore.getCsrDisclosures())
  const [documents, setDocuments] = useState<EvidenceDocumentItem[]>([])
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([])
  const [activities, setActivities] = useState<ActivityEvent[]>([])
  const [validationResult, setValidationResult] = useState<ValidationChecklistResult>(financeStore.validateRecord())

  // Internal tab state for Financial Data Entry (fin-data)
  const [activeFinanceLevel, setActiveFinanceLevel] = useState<'l0' | 'l1' | 'l3' | 'l4' | 'l6' | 'l7'>('l1')

  // UI state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [showAddExpenditureModal, setShowAddExpenditureModal] = useState(false)
  const [showUploadDocModal, setShowUploadDocModal] = useState(false)
  const [selectedDocForHistory, setSelectedDocForHistory] = useState<EvidenceDocumentItem | null>(null)
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionRecord | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [buFilter, setBuFilter] = useState<string>('all')

  // Level 2 Add Expenditure Form State (all 13 fields)
  const [newExpCategory, setNewExpCategory] = useState<ResourceExpenditureItem['category']>('Pollution Control')
  const [newExpProjectName, setNewExpProjectName] = useState('')
  const [newExpDesc, setNewExpDesc] = useState('')
  const [newExpAmount, setNewExpAmount] = useState<number>(0)
  const [newExpCurrency, setNewExpCurrency] = useState('INR (₹)')
  const [newExpSource, setNewExpSource] = useState<'CapEx' | 'OpEx'>('CapEx')
  const [newExpPeriod, setNewExpPeriod] = useState('FY 2026-27')
  const [newExpCostCentre, setNewExpCostCentre] = useState('CC-SOL-GJT-01')
  const [newExpVendor, setNewExpVendor] = useState('')
  const [newExpInvoiceRef, setNewExpInvoiceRef] = useState('')
  const [newExpDataSource, setNewExpDataSource] = useState<ResourceExpenditureItem['dataSource']>('Invoice')
  const [newExpEvidenceLink, setNewExpEvidenceLink] = useState('CapEx_Projects.xlsx')
  const [newExpRemarks, setNewExpRemarks] = useState('')

  // Level 5 Upload Document Form State (all 14 fields)
  const [newDocName, setNewDocName] = useState('')
  const [newDocCategory, setNewDocCategory] = useState<EvidenceDocumentItem['category']>('Financial Statement')
  const [newDocLinkedTo, setNewDocLinkedTo] = useState<EvidenceDocumentItem['linkedTo']>('Financial Summary')
  const [newDocReportingPeriod, setNewDocReportingPeriod] = useState('FY 2026-27')
  const [newDocDate, setNewDocDate] = useState('10 Jun 2026')
  const [newDocIssuingOrg, setNewDocIssuingOrg] = useState('Statutory Audit / MEIL Accounts')
  const [newDocSourceRef, setNewDocSourceRef] = useState('')
  const [newDocVersionNote, setNewDocVersionNote] = useState('Initial verified document copy')
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)

  // Drag and drop ref
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load store data
  const refreshData = () => {
    setAssignments(financeStore.getAssignments())
    setFinancialData(financeStore.getFinancialSummary())
    setExpenditures(financeStore.getExpenditures())
    setIntensityMetrics(financeStore.getIntensityMetrics())
    setCsrData(financeStore.getCsrDisclosures())
    setDocuments(financeStore.getEvidenceDocuments())
    setSubmissions(financeStore.getSubmissions())
    setActivities(financeStore.getActivities())
    setValidationResult(financeStore.validateRecord())
  }

  /* eslint-disable react-hooks/set-state-in-effect -- ported ZIP pattern: hydrate workspace state from the local finance store on mount (refreshData also runs after every mutation) */
  useEffect(() => {
    refreshData()
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  /* Stable navigate handler for the hoisted FinStepper. */
  const handleStepperNavigate = (moduleKey: 'fin-data' | 'fin-expenditure' | 'fin-evidence' | 'fin-submissions', levelKey: string) => {
    setActiveModule(moduleKey)
    if (moduleKey === 'fin-data' && (levelKey === 'l0' || levelKey === 'l1' || levelKey === 'l3' || levelKey === 'l4' || levelKey === 'l6' || levelKey === 'l7')) {
      setActiveFinanceLevel(levelKey as any)
    }
  }

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  // Handle financial summary edits
  const handleFinancialFieldChange = (field: keyof FinancialSummaryData, val: any) => {
    const updated = { ...financialData, [field]: val }
    setFinancialData(updated)
    financeStore.saveFinancialSummary(updated)
    setValidationResult(financeStore.validateRecord())
  }

  // Handle common metadata edits
  const handleCommonFieldChange = (field: keyof CommonMetadata, val: any) => {
    const updatedCommon = { ...financialData.common, [field]: val }
    const updated = { ...financialData, common: updatedCommon }
    setFinancialData(updated)
    financeStore.saveFinancialSummary(updated)
    setValidationResult(financeStore.validateRecord())
  }

  // Handle intensity metrics edits
  const handleIntensityChange = (field: keyof IntensityMetricsData, val: any) => {
    const updated = { ...intensityMetrics, [field]: val }
    // Recalculate intensities automatically
    if (field === 'physicalOutputDenominator' && Number(val) > 0) {
      updated.physicalOutputIntensity = Number((updated.relevantExpenditureTotal / Number(val)).toFixed(4))
    }
    setIntensityMetrics(updated)
    financeStore.saveIntensityMetrics(updated)
  }

  // Handle CSR edits
  const handleCsrChange = (field: keyof CsrDisclosureData, val: any) => {
    const updated = { ...csrData, [field]: val }
    if (field === 'approvedCsrBudget' || field === 'actualCsrExpenditure') {
      const budget = field === 'approvedCsrBudget' ? Number(val) : updated.approvedCsrBudget
      const actual = field === 'actualCsrExpenditure' ? Number(val) : updated.actualCsrExpenditure
      updated.unspentAmount = Math.max(0, Number((budget - actual).toFixed(2)))
    }
    setCsrData(updated)
    financeStore.saveCsrDisclosures(updated)
  }

  // Save draft action
  const handleSaveDraft = () => {
    setSaveStatus('saving')
    setTimeout(() => {
      financeStore.saveFinancialSummary(financialData)
      financeStore.saveIntensityMetrics(intensityMetrics)
      financeStore.saveCsrDisclosures(csrData)
      financeStore.logActivity(
        'Draft saved',
        'Financial & Resource records saved to local secure store with all BRSR metadata',
        'saved',
        financialData.common?.entityId || 'MEIL-SOL-GJT'
      )
      refreshData()
      setSaveStatus('saved')
      showToast('Draft successfully saved to local secure store')
      setTimeout(() => setSaveStatus('idle'), 2000)
    }, 350)
  }

  // Manual validation trigger
  const handleValidateData = () => {
    const res = financeStore.validateRecord(financialData, expenditures, documents)
    setValidationResult(res)
    if (res.readyForSubmission) {
      showToast('All 10 validation checks passed! Record is ready for review submission.')
    } else {
      showToast(`Validation: ${res.blockingErrors.length} blocking error(s), ${res.warnings.length} warning(s).`)
    }
  }

  // Add expenditure item with all 13 fields
  const handleAddExpenditure = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newExpDesc || newExpAmount <= 0) {
      showToast('Please enter a valid description and positive expenditure amount.')
      return
    }
    const item: Omit<ResourceExpenditureItem, 'id' | 'dateAdded'> = {
      category: newExpCategory,
      projectName: newExpProjectName || `${newExpCategory} Enhancement`,
      description: newExpDesc,
      amount: Number(newExpAmount),
      currency: newExpCurrency,
      source: newExpSource,
      accountingPeriod: newExpPeriod,
      costCentre: newExpCostCentre,
      vendorRef: newExpVendor || 'Approved Contractor',
      invoiceRef: newExpInvoiceRef || `INV-${Date.now().toString().slice(-5)}`,
      dataSource: newExpDataSource,
      supportingDocument: newExpEvidenceLink || 'CapEx_Projects.xlsx',
      remarks: newExpRemarks || 'Standard ledger recorded expense',
      status: 'Draft',
    }
    financeStore.addExpenditure(item)
    setShowAddExpenditureModal(false)
    setNewExpProjectName('')
    setNewExpDesc('')
    setNewExpAmount(0)
    setNewExpVendor('')
    setNewExpInvoiceRef('')
    setNewExpRemarks('')
    refreshData()
    showToast(`Added ₹ ${item.amount.toFixed(2)} Cr under ${item.category}`)
  }

  // Delete expenditure item
  const handleDeleteExpenditure = (id: string) => {
    if (confirm('Are you sure you want to delete this expenditure line item?')) {
      financeStore.deleteExpenditure(id)
      refreshData()
      showToast('Expenditure line item removed')
    }
  }

  // Add uploaded document simulation with all 14 fields
  const handleUploadDocument = (filename?: string) => {
    const docName = filename || newDocName || 'Financial_Schedule_Annexure.pdf'
    setUploadProgress(15)
    const timer = setInterval(() => {
      setUploadProgress(p => {
        if (!p || p >= 90) {
          clearInterval(timer)
          const doc: Omit<EvidenceDocumentItem, 'id' | 'uploadDate' | 'uploadedBy' | 'versionHistory'> = {
            documentName: docName,
            category: newDocCategory,
            linkedEntity: financialData.common?.entityName || 'Gayatri Solar Plant (MEIL-SOL-GJT)',
            linkedTo: newDocLinkedTo,
            reportingPeriod: newDocReportingPeriod,
            documentDate: newDocDate,
            issuingOrganization: newDocIssuingOrg,
            sourceReference: newDocSourceRef || `REF-${Date.now().toString().slice(-6)}`,
            size: '2.4 MB',
            status: 'Under Review',
            remarks: newDocVersionNote,
          }
          financeStore.addEvidenceDoc(doc)
          setShowUploadDocModal(false)
          setNewDocName('')
          setNewDocSourceRef('')
          setUploadProgress(null)
          refreshData()
          showToast(`Uploaded ${doc.documentName} with audit metadata`)
          return null
        }
        return p + 25
      })
    }, 150)
  }

  // Delete evidence document
  const handleDeleteDocument = (id: string) => {
    if (confirm('Delete this supporting evidence document?')) {
      financeStore.deleteEvidenceDocument(id)
      refreshData()
      showToast('Evidence document deleted')
    }
  }

  // Submit record for review
  const handleSubmitForReview = async () => {
    const res = financeStore.validateRecord(financialData, expenditures, documents)
    if (!res.readyForSubmission) {
      showToast(`Cannot submit: ${res.blockingErrors.join('; ')}`)
      return
    }
    financeStore.submitRecordForReview(financialData.common?.entityId || 'MEIL-SOL-GJT')

    // Also post to backend /api/data-entry so it shows in SubmissionsModule and Reviewer queue
    try {
      await fetch('/api/so/data-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 9,
          levelKey: 'level9',
          levelName: 'BRSR Finance & Resource Expenditures',
          module: 'FINANCE',
          projectId: 'cmv0skx6l0071e9cgt6sn5w7i',
          reportingPeriodId: 'cmv0skxfn009he9cgg61xsb4c',
          data: {
            activityInitiativeName: 'Resource Efficiency & Environmental Capital Expenditure',
            baselineValue: financialData.turnover || 1450,
            reportingPeriodValue: financialData.environmentalSpend || 120,
            outputUnit: 'INR Crores',
            remarks: 'Submitted from Finance Contributor Workspace',
          },
          submitForReview: true,
        }),
      }).catch((e) => console.warn('Finance data-entry post warning:', e))
    } catch {}

    refreshData()
    showToast('Record version v1.3 submitted for BU review approval!')
    setActiveModule('fin-submissions')
  }

  // Resubmit record returned for correction
  const handleResubmit = async (subId: string) => {
    financeStore.resubmitRecord(subId)
    try {
      await fetch('/api/so/data-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 9,
          levelKey: 'level9',
          levelName: 'BRSR Finance & Resource Expenditures (Resubmitted)',
          module: 'FINANCE',
          projectId: 'cmv0skx6l0071e9cgt6sn5w7i',
          reportingPeriodId: 'cmv0skxfn009he9cgg61xsb4c',
          data: {
            activityInitiativeName: 'Resource Efficiency & Environmental Capital Expenditure',
            baselineValue: financialData.turnover || 1450,
            reportingPeriodValue: financialData.environmentalSpend || 120,
            outputUnit: 'INR Crores',
            remarks: 'Resubmitted after addressing reviewer remarks',
          },
          submitForReview: true,
        }),
      }).catch(() => {})
    } catch {}
    refreshData()
    setSelectedSubmission(null)
    showToast('Corrected record resubmitted for review approval!')
  }

  // Computations for display
  const totalResourceExpenditure = financeStore.getTotalResourceExpenditure(expenditures)
  const distribution = financeStore.getCategoryDistribution(expenditures)
  const yoyTurnover = financeStore.calculateYoY(financialData.turnover, financialData.previousTurnover)
  const capexTotal = expenditures.filter(e => e.source === 'CapEx').reduce((s, e) => s + e.amount, 0)
  const opexTotal = expenditures.filter(e => e.source === 'OpEx').reduce((s, e) => s + e.amount, 0)

  return (
    <div className="space-y-6 pb-12">
      {/* Toast feedback */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-6 z-50 flex items-center gap-2 rounded-2xl border border-blue-200 bg-white/95 px-5 py-3 shadow-2xl backdrop-blur-md text-xs font-bold text-slate-800"
          >
            <CheckCircle2 className="h-4 w-4 text-blue-600" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------------------------------------------------------------------- */}
      {/* SCREEN 2 — MY ASSIGNMENTS                                              */}
      {/* ---------------------------------------------------------------------- */}
      {activeModule === 'fin-assignments' && (
        <div className="space-y-6">
          <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl font-black text-slate-900">My Assignments</h1>
                <p className="text-xs font-medium text-slate-500">
                  Every entity, project, reporting period, and data module assigned to your scope
                </p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2.5">
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="ios-field !w-auto !rounded-full !py-1.5 !text-xs font-semibold text-slate-700"
                >
                  <option value="all">All Statuses</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Draft">Draft</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Returned for Correction">Returned for Correction</option>
                </select>

                <select
                  value={buFilter}
                  onChange={e => setBuFilter(e.target.value)}
                  className="ios-field !w-auto !rounded-full !py-1.5 !text-xs font-semibold text-slate-700"
                >
                  <option value="all">All Business Units</option>
                  <option value="Solar BU">Solar BU</option>
                  <option value="Infra BU">Infra BU</option>
                  <option value="Ports BU">Ports BU</option>
                  <option value="Water BU">Water BU</option>
                </select>

                <button
                  onClick={() => { setStatusFilter('all'); setBuFilter('all'); }}
                  className="flex items-center gap-1 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            {/* Assignments Table */}
            <div className="mt-6 overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="pb-3 pl-2">Entity & Location</th>
                    <th className="pb-3">Business Unit</th>
                    <th className="pb-3">Reporting Period</th>
                    <th className="pb-3">Module</th>
                    <th className="pb-3">Progress</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 pr-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-xs">
                  {assignments
                    .filter(a => statusFilter === 'all' || a.status === statusFilter)
                    .filter(a => buFilter === 'all' || a.businessUnit === buFilter)
                    .map(item => (
                      <tr key={item.id} className="group hover:bg-blue-50/40 transition">
                        <td className="py-4 pl-2">
                          <div className="font-bold text-slate-900">{item.entityName}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{item.entityId} · {item.location}</div>
                        </td>
                        <td className="py-4 font-medium text-slate-700">{item.businessUnit}</td>
                        <td className="py-4 text-slate-600">{item.financialYear}</td>
                        <td className="py-4 font-semibold text-slate-800">{item.module}</td>
                        <td className="py-4">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full bg-blue-600" style={{ width: `${item.completion}%` }} />
                            </div>
                            <span className="font-bold text-slate-700 text-[11px]">{item.completion}%</span>
                          </div>
                        </td>
                        <td className="py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            item.status === 'Submitted'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : item.status === 'Returned for Correction'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : item.status === 'In Progress'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="py-4 pr-2 text-right">
                          <button
                            onClick={() => {
                              if (item.module === 'Resource Expenditure') {
                                setActiveModule('fin-expenditure')
                              } else {
                                setActiveModule('fin-data')
                                setActiveFinanceLevel('l1')
                              }
                            }}
                            className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-3.5 py-1 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
                          >
                            <span>{item.completion > 0 ? 'Continue Draft' : 'Enter Data'}</span>
                            <ArrowRight className="h-3 w-3" />
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

      {/* ---------------------------------------------------------------------- */}
      {/* SCREEN 3 — FINANCIAL DATA ENTRY (Levels 0, 1, 3, 4, 6, 7)              */}
      {/* ---------------------------------------------------------------------- */}
      {activeModule === 'fin-data' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/25">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-slate-900">Financial Data Entry</h1>
                  <p className="text-xs font-medium text-slate-500">
                    Verified figures, common entity metadata, intensity metrics, CSR disclosures & validation
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="rounded-full border border-blue-200 bg-blue-50/90 px-3.5 py-1.5 text-xs font-bold text-blue-800">
                  {financialData.common?.entityName || 'Gayatri Solar Plant'} ({financialData.common?.entityId || 'MEIL-SOL-GJT'}) · {financialData.common?.financialYear || 'FY 2026-27'}
                </div>
                <button
                  onClick={() => setActiveModule('fin-assignments')}
                  className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Assignments</span>
                </button>
              </div>
            </div>
          </div>

          {/* Stepper */}
          <FinStepper currentStep={activeFinanceLevel === 'l0' ? 1 : activeFinanceLevel === 'l1' ? 2 : activeFinanceLevel === 'l3' ? 4 : activeFinanceLevel === 'l4' ? 5 : activeFinanceLevel === 'l6' ? 7 : 8} onNavigate={handleStepperNavigate} />

          {/* Level Selector Tabs inside Data Entry */}
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/60 bg-white/70 p-2 shadow-sm backdrop-blur-md">
            {[
              { id: 'l0', label: 'Level 0 — Common Fields', desc: 'Metadata & Assignment Context' },
              { id: 'l1', label: 'Level 1 — Financial Summary', desc: 'Turnover, CapEx & Basis' },
              { id: 'l3', label: 'Level 3 — Intensity Metrics', desc: 'Ratios & Physical Output' },
              { id: 'l4', label: 'Level 4 — CSR Disclosures', desc: 'Assigned CSR Spending' },
              { id: 'l6', label: 'Level 6 — Validation Checklist', desc: '10 Pre-submission Checks' },
              { id: 'l7', label: 'Level 7 — Review & Sign-off', desc: 'Submission Workflow' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveFinanceLevel(tab.id as any)}
                className={`flex flex-col rounded-xl px-3.5 py-2 text-left transition-all ${
                  activeFinanceLevel === tab.id
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-100'
                    : 'bg-white/60 text-slate-600 hover:bg-white hover:text-slate-900 border border-slate-100'
                }`}
              >
                <span className="text-xs font-black">{tab.label}</span>
                <span className={`text-[10px] font-medium ${activeFinanceLevel === tab.id ? 'text-blue-100' : 'text-slate-400'}`}>
                  {tab.desc}
                </span>
              </button>
            ))}
          </div>

          {/* LEVEL 0: COMMON FIELDS FOR EVERY DATA ENTRY */}
          {activeFinanceLevel === 'l0' && (
            <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-xs font-black text-white shadow-xs">
                    0
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Level 0 — Common Fields for Every Data Entry</h2>
                    <p className="text-xs text-slate-500">
                      Standardized reporting entity, audit trails, and conditional metadata applied across all modules
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-[11px] font-bold text-indigo-700">
                  Prefilled & Configured
                </span>
              </div>

              {/* System Note on Conditional Fields */}
              <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50/60 p-4 text-xs text-sky-900">
                <Info className="h-4 w-4 shrink-0 text-sky-600 mt-0.5" />
                <p>
                  <strong>System Logic:</strong> Entity and project details are pre-filled from Admin assignments. Currency and display units apply to monetary amounts; physical quantities use project-configured metric units.
                </p>
              </div>

              {/* 23 Level 0 Fields Form Grid */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {/* 1. Entity / Company Name */}
                <div>
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>1. Entity / Company Name</span>
                    <span className="text-[10px] font-semibold text-slate-400">Prefilled (Read-only)</span>
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={financialData.common?.entityName || 'Gayatri Solar Plant'}
                    className="mt-1 ios-field !text-xs font-bold text-slate-800"
                  />
                </div>

                {/* 2. Entity ID */}
                <div>
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>2. Entity ID</span>
                    <span className="text-[10px] font-semibold text-slate-400">Read-only</span>
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={financialData.common?.entityId || 'MEIL-SOL-GJT'}
                    className="mt-1 ios-field !text-xs font-mono font-bold text-blue-700"
                  />
                </div>

                {/* 3. Subsidiary / Business Unit */}
                <div>
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>3. Subsidiary / Business Unit</span>
                    <span className="text-[10px] font-semibold text-slate-400">Read-only</span>
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={financialData.common?.subsidiaryOrBu || 'Solar BU'}
                    className="mt-1 ios-field !text-xs font-bold text-slate-800"
                  />
                </div>

                {/* 4. Project ID / Site ID */}
                <div>
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>4. Project ID / Site ID</span>
                    <span className="text-[10px] font-semibold text-slate-400">Prefilled</span>
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={financialData.common?.projectId || 'PRJ-GJT-2026'}
                    className="mt-1 ios-field !text-xs font-mono font-bold text-slate-800"
                  />
                </div>

                {/* 5. Financial Year */}
                <div>
                  <label className="text-xs font-bold text-slate-700">5. Financial Year</label>
                  <select
                    value={financialData.common?.financialYear || 'FY 2026-27'}
                    onChange={e => handleCommonFieldChange('financialYear', e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-xs outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="FY 2026-27">FY 2026-27 (Current reporting period)</option>
                    <option value="FY 2025-26">FY 2025-26 (Comparative period)</option>
                  </select>
                </div>

                {/* 6. Reporting Period */}
                <div>
                  <label className="text-xs font-bold text-slate-700">6. Reporting Period</label>
                  <select
                    value={financialData.common?.reportingPeriod || 'Annual'}
                    onChange={e => handleCommonFieldChange('reportingPeriod', e.target.value as any)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-xs outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="Annual">Annual (1 Apr 2026 - 31 Mar 2027)</option>
                    <option value="Quarter">Quarterly</option>
                    <option value="Month">Monthly</option>
                  </select>
                </div>

                {/* 7. Data Module */}
                <div>
                  <label className="text-xs font-bold text-slate-700">7. Data Module</label>
                  <input
                    type="text"
                    value={financialData.common?.dataModule || 'Financial Summary'}
                    onChange={e => handleCommonFieldChange('dataModule', e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-xs outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                {/* 8. Data Category */}
                <div>
                  <label className="text-xs font-bold text-slate-700">8. Data Category</label>
                  <select
                    value={financialData.common?.dataCategory || 'Turnover & Capital Expenditure'}
                    onChange={e => handleCommonFieldChange('dataCategory', e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-xs outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="Turnover & Capital Expenditure">Turnover & Capital Expenditure</option>
                    <option value="Resource & Green Initiatives">Resource & Green Initiatives</option>
                    <option value="BRSR Statutory Ratios">BRSR Statutory Ratios</option>
                    <option value="CSR Mandate Disclosures">CSR Mandate Disclosures</option>
                  </select>
                </div>

                {/* 9. Record Description */}
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-slate-700">9. Record Description</label>
                  <input
                    type="text"
                    value={financialData.common?.recordDescription || ''}
                    onChange={e => handleCommonFieldChange('recordDescription', e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-xs outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                {/* 10. Amount / Data Value */}
                <div>
                  <label className="text-xs font-bold text-slate-700">10. Amount / Data Value</label>
                  <input
                    type="number"
                    step="0.01"
                    value={financialData.common?.amountOrValue || 0}
                    onChange={e => handleCommonFieldChange('amountOrValue', parseFloat(e.target.value) || 0)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 shadow-xs outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                {/* 11. Currency */}
                <div>
                  <label className="text-xs font-bold text-slate-700">11. Currency</label>
                  <select
                    value={financialData.common?.currency || 'INR (₹)'}
                    onChange={e => handleCommonFieldChange('currency', e.target.value as any)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-xs outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="INR (₹)">INR (₹)</option>
                    <option value="USD ($)">USD ($)</option>
                    <option value="EUR (€)">EUR (€)</option>
                  </select>
                </div>

                {/* 12. Display Unit */}
                <div>
                  <label className="text-xs font-bold text-slate-700">12. Display Unit</label>
                  <select
                    value={financialData.common?.displayUnit || 'Crore'}
                    onChange={e => handleCommonFieldChange('displayUnit', e.target.value as any)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-xs outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="Crore">Crore (10,000,000)</option>
                    <option value="Lakh">Lakh (100,000)</option>
                    <option value="Thousand">Thousand (1,000)</option>
                    <option value="INR">INR (Exact Amount)</option>
                  </select>
                </div>

                {/* 13. Data Availability */}
                <div>
                  <label className="text-xs font-bold text-slate-700">13. Data Availability</label>
                  <select
                    value={financialData.common?.dataAvailability || 'Reported'}
                    onChange={e => handleCommonFieldChange('dataAvailability', e.target.value as any)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-xs outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="Reported">Reported (Audited)</option>
                    <option value="Zero">Zero</option>
                    <option value="Estimated">Estimated</option>
                    <option value="Not Available">Not Available</option>
                    <option value="Not Applicable">Not Applicable</option>
                  </select>
                </div>

                {/* 14. Data Source */}
                <div>
                  <label className="text-xs font-bold text-slate-700">14. Data Source</label>
                  <select
                    value={financialData.common?.dataSource || 'Audited statement'}
                    onChange={e => handleCommonFieldChange('dataSource', e.target.value as any)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-xs outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="Audited statement">Audited statement</option>
                    <option value="Ledger">Ledger</option>
                    <option value="Approved report">Approved report</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* 15. Source Reference */}
                <div>
                  <label className="text-xs font-bold text-slate-700">15. Source Reference</label>
                  <input
                    type="text"
                    value={financialData.common?.sourceReference || ''}
                    onChange={e => handleCommonFieldChange('sourceReference', e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-xs outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                {/* 16. Calculation Method */}
                <div>
                  <label className="text-xs font-bold text-slate-700">16. Calculation Method</label>
                  <select
                    value={financialData.common?.calculationMethod || 'Direct value'}
                    onChange={e => handleCommonFieldChange('calculationMethod', e.target.value as any)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-xs outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="Direct value">Direct value</option>
                    <option value="Calculated">Calculated</option>
                    <option value="Estimated">Estimated</option>
                  </select>
                </div>

                {/* 17. Supporting Document */}
                <div>
                  <label className="text-xs font-bold text-slate-700">17. Supporting Document</label>
                  <input
                    type="text"
                    value={financialData.common?.supportingDocument || ''}
                    onChange={e => handleCommonFieldChange('supportingDocument', e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-xs outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                {/* 18. Remarks */}
                <div>
                  <label className="text-xs font-bold text-slate-700">18. Remarks</label>
                  <input
                    type="text"
                    value={financialData.common?.remarks || ''}
                    onChange={e => handleCommonFieldChange('remarks', e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-xs outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                {/* 19. Prepared By */}
                <div>
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>19. Prepared By</span>
                    <span className="text-[10px] text-slate-400">Auto-filled</span>
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={financialData.common?.preparedBy || 'Rahul Verma'}
                    className="mt-1 ios-field !text-xs font-semibold text-slate-800"
                  />
                </div>

                {/* 20. Entry Date */}
                <div>
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>20. Entry Date</span>
                    <span className="text-[10px] text-slate-400">System-generated</span>
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={financialData.common?.entryDate || '01 Apr 2026'}
                    className="mt-1 ios-field !text-xs font-semibold text-slate-800"
                  />
                </div>

                {/* 21. Last Updated */}
                <div>
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>21. Last Updated</span>
                    <span className="text-[10px] text-slate-400">System-generated</span>
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={financialData.common?.lastUpdated || 'Today at 02:15 PM'}
                    className="mt-1 ios-field !text-xs font-semibold text-slate-800"
                  />
                </div>

                {/* 22. Submission Status */}
                <div>
                  <label className="text-xs font-bold text-slate-700">22. Submission Status</label>
                  <div className="mt-1 flex items-center">
                    <span className={`inline-flex rounded-xl px-3 py-2 text-xs font-bold ${
                      financialData.common?.submissionStatus === 'Submitted'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : financialData.common?.submissionStatus === 'Accepted'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {financialData.common?.submissionStatus || 'Draft'}
                    </span>
                  </div>
                </div>

                {/* 23. Reviewer Comments */}
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-slate-700">23. Reviewer Comments</label>
                  <input
                    type="text"
                    readOnly
                    value={financialData.common?.reviewerComments || 'No reviewer corrections currently pending.'}
                    className="mt-1 ios-field !text-xs font-medium text-slate-600"
                  />
                </div>
              </div>

              {/* Action row */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <span className="text-xs text-slate-400">All common metadata stored and synchronized</span>
                <button
                  type="button"
                  onClick={() => setActiveFinanceLevel('l1')}
                  className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
                >
                  <span>Continue to Level 1 — Financial Summary</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* LEVEL 1: FINANCIAL SUMMARY */}
          {activeFinanceLevel === 'l1' && (
            <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-xs font-black text-white shadow-xs">
                    1
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Level 1 — Financial Summary</h2>
                    <p className="text-xs text-slate-500">
                      Verified corporate financial figures required for applicable BRSR disclosures and intensity ratios
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-blue-600">YoY Growth:</span>
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 border border-blue-200">
                    {yoyTurnover.text}
                  </span>
                </div>
              </div>

              {/* System Logic Banner */}
              <div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50/60 p-4 text-xs text-blue-900">
                <Info className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
                <p>
                  <strong>System Logic:</strong> Use the company's approved financial records as the single source of truth. The underlying monetary amount and currency are stored separately from the display unit (Crore / Lakh / Thousand).
                </p>
              </div>

              {/* 12 Level 1 Input Fields */}
              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                {/* 1. Total Turnover / Revenue */}
                <div>
                  <label className="text-xs font-bold text-slate-700">
                    1. Total Turnover / Revenue <span className="text-rose-500">*</span>
                  </label>
                  <div className="mt-1.5 flex rounded-xl border border-slate-200 bg-white shadow-xs focus-within:ring-2 focus-within:ring-blue-200">
                    <span className="flex items-center pl-3 text-xs font-bold text-slate-500">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      value={financialData.turnover}
                      onChange={e => handleFinancialFieldChange('turnover', parseFloat(e.target.value) || 0)}
                      className="w-full bg-transparent px-2.5 py-2 text-xs font-bold text-slate-900 outline-none"
                    />
                    <select
                      value={financialData.turnoverUnit}
                      onChange={e => handleFinancialFieldChange('turnoverUnit', e.target.value)}
                      className="rounded-r-xl border-l border-slate-100 bg-slate-50 px-3 text-xs font-bold text-slate-600 outline-none"
                    >
                      <option value="Crore">Crore</option>
                      <option value="Lakh">Lakh</option>
                      <option value="Thousand">Thousand</option>
                    </select>
                  </div>
                </div>

                {/* 2. Previous Year Turnover / Revenue */}
                <div>
                  <label className="text-xs font-bold text-slate-700">
                    2. Previous Year Turnover / Revenue
                  </label>
                  <div className="mt-1.5 flex rounded-xl border border-slate-200 bg-white shadow-xs focus-within:ring-2 focus-within:ring-blue-200">
                    <span className="flex items-center pl-3 text-xs font-bold text-slate-500">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      value={financialData.previousTurnover}
                      onChange={e => handleFinancialFieldChange('previousTurnover', parseFloat(e.target.value) || 0)}
                      className="w-full bg-transparent px-2.5 py-2 text-xs font-bold text-slate-900 outline-none"
                    />
                    <span className="flex items-center rounded-r-xl border-l border-slate-100 bg-slate-50 px-3 text-xs font-bold text-slate-600">
                      Crore
                    </span>
                  </div>
                </div>

                {/* 3. Total Expenditure */}
                <div>
                  <label className="text-xs font-bold text-slate-700">
                    3. Total Expenditure <span className="text-rose-500">*</span>
                  </label>
                  <div className="mt-1.5 flex rounded-xl border border-slate-200 bg-white shadow-xs focus-within:ring-2 focus-within:ring-blue-200">
                    <span className="flex items-center pl-3 text-xs font-bold text-slate-500">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      value={financialData.totalExpenditure}
                      onChange={e => handleFinancialFieldChange('totalExpenditure', parseFloat(e.target.value) || 0)}
                      className="w-full bg-transparent px-2.5 py-2 text-xs font-bold text-slate-900 outline-none"
                    />
                    <span className="flex items-center rounded-r-xl border-l border-slate-100 bg-slate-50 px-3 text-xs font-bold text-slate-600">
                      Crore
                    </span>
                  </div>
                </div>

                {/* 4. Capital Expenditure (CapEx) */}
                <div>
                  <label className="text-xs font-bold text-slate-700">
                    4. Capital Expenditure (CapEx)
                  </label>
                  <div className="mt-1.5 flex rounded-xl border border-slate-200 bg-white shadow-xs focus-within:ring-2 focus-within:ring-blue-200">
                    <span className="flex items-center pl-3 text-xs font-bold text-slate-500">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      value={financialData.capEx}
                      onChange={e => handleFinancialFieldChange('capEx', parseFloat(e.target.value) || 0)}
                      className="w-full bg-transparent px-2.5 py-2 text-xs font-bold text-slate-900 outline-none"
                    />
                    <span className="flex items-center rounded-r-xl border-l border-slate-100 bg-slate-50 px-3 text-xs font-bold text-slate-600">
                      Crore
                    </span>
                  </div>
                </div>

                {/* 5. Operating Expenditure (OpEx) */}
                <div>
                  <label className="text-xs font-bold text-slate-700">
                    5. Operating Expenditure (OpEx)
                  </label>
                  <div className="mt-1.5 flex rounded-xl border border-slate-200 bg-white shadow-xs focus-within:ring-2 focus-within:ring-blue-200">
                    <span className="flex items-center pl-3 text-xs font-bold text-slate-500">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      value={financialData.opEx}
                      onChange={e => handleFinancialFieldChange('opEx', parseFloat(e.target.value) || 0)}
                      className="w-full bg-transparent px-2.5 py-2 text-xs font-bold text-slate-900 outline-none"
                    />
                    <span className="flex items-center rounded-r-xl border-l border-slate-100 bg-slate-50 px-3 text-xs font-bold text-slate-600">
                      Crore
                    </span>
                  </div>
                </div>

                {/* 6. Financial Reporting Basis */}
                <div>
                  <label className="text-xs font-bold text-slate-700">
                    6. Financial Reporting Basis <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={financialData.financialReportingBasis || 'Standalone (Ind AS)'}
                    onChange={e => handleFinancialFieldChange('financialReportingBasis', e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-xs outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="Standalone (Ind AS)">Standalone (Ind AS)</option>
                    <option value="Consolidated (Ind AS)">Consolidated (Ind AS)</option>
                    <option value="IFRS">IFRS</option>
                    <option value="Statutory Tax Audit Basis">Statutory Tax Audit Basis</option>
                  </select>
                </div>

                {/* 7. Financial Statement Reference */}
                <div>
                  <label className="text-xs font-bold text-slate-700">
                    7. Financial Statement Reference <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={financialData.financialStatementReference || ''}
                    onChange={e => handleFinancialFieldChange('financialStatementReference', e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-xs outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                {/* 8. Ledger / Cost Centre Reference */}
                <div>
                  <label className="text-xs font-bold text-slate-700">
                    8. Ledger / Cost Centre Reference
                  </label>
                  <input
                    type="text"
                    value={financialData.ledgerCostCentreRef || ''}
                    onChange={e => handleFinancialFieldChange('ledgerCostCentreRef', e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-xs outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                {/* 9. Financial Data Source */}
                <div>
                  <label className="text-xs font-bold text-slate-700">
                    9. Financial Data Source <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={financialData.financialDataSource || 'Audited statement'}
                    onChange={e => handleFinancialFieldChange('financialDataSource', e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-xs outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="Audited statement">Audited statement</option>
                    <option value="Ledger">General Ledger Extract</option>
                    <option value="Approved report">Approved management report</option>
                    <option value="Other">Other documented source</option>
                  </select>
                </div>

                {/* 10. Reconciliation Status */}
                <div>
                  <label className="text-xs font-bold text-slate-700">
                    10. Reconciliation Status
                  </label>
                  <select
                    value={financialData.reconciliationStatus || 'Reconciled'}
                    onChange={e => handleFinancialFieldChange('reconciliationStatus', e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-xs outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="Reconciled">Reconciled (Matched with SAP/Accounts)</option>
                    <option value="Pending">Pending (Draft Reconciliation)</option>
                    <option value="Exception">Exception (Variances identified)</option>
                  </select>
                </div>

                {/* 11. Reconciliation Remarks */}
                <div>
                  <label className="text-xs font-bold text-slate-700">
                    11. Reconciliation Remarks
                  </label>
                  <input
                    type="text"
                    placeholder="Explanation of discrepancies..."
                    value={financialData.reconciliationRemarks || ''}
                    onChange={e => handleFinancialFieldChange('reconciliationRemarks', e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-xs outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                {/* 12. Supporting Documents */}
                <div>
                  <label className="text-xs font-bold text-slate-700">
                    12. Supporting Documents
                  </label>
                  <input
                    type="text"
                    value={financialData.supportingDocuments?.join(', ') || 'MEIL_FS_2026-27.pdf'}
                    onChange={e => handleFinancialFieldChange('supportingDocuments', e.target.value.split(',').map(s => s.trim()))}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-xs outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              </div>

              {/* Live Financial Summary Cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 pt-2">
                <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
                  <div className="text-[11px] font-bold text-blue-700 uppercase">CapEx Share of Spend</div>
                  <div className="mt-1 text-2xl font-black text-blue-900">
                    {((financialData.capEx / (financialData.totalExpenditure || 1)) * 100).toFixed(1)}%
                  </div>
                  <div className="text-[11px] text-blue-600">₹ {financialData.capEx.toFixed(2)} Cr of total expenditure</div>
                </div>

                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
                  <div className="text-[11px] font-bold text-indigo-700 uppercase">OpEx Share of Spend</div>
                  <div className="mt-1 text-2xl font-black text-indigo-900">
                    {((financialData.opEx / (financialData.totalExpenditure || 1)) * 100).toFixed(1)}%
                  </div>
                  <div className="text-[11px] text-indigo-600">₹ {financialData.opEx.toFixed(2)} Cr of operating expenses</div>
                </div>

                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                  <div className="text-[11px] font-bold text-emerald-700 uppercase">Operating Margin Ratio</div>
                  <div className="mt-1 text-2xl font-black text-emerald-900">
                    {(((financialData.turnover - financialData.totalExpenditure) / (financialData.turnover || 1)) * 100).toFixed(1)}%
                  </div>
                  <div className="text-[11px] text-emerald-600">Operating surplus ratio for sustainability</div>
                </div>
              </div>
            </div>
          )}

          {/* LEVEL 3: FINANCIAL CALCULATIONS & INTENSITY METRICS */}
          {activeFinanceLevel === 'l3' && (
            <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-600 text-xs font-black text-white shadow-xs">
                    3
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Level 3 — Financial Calculations & Intensity Metrics</h2>
                    <p className="text-xs text-slate-500">
                      Ratios and intensity reporting metrics derived from verified financial figures & operational throughput
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-purple-50 border border-purple-200 px-3 py-1 text-[11px] font-bold text-purple-700">
                  Automated Calculation Engine
                </span>
              </div>

              {/* System Formula Explainer */}
              <div className="flex items-start gap-3 rounded-2xl border border-purple-200 bg-purple-50/60 p-4 text-xs text-purple-900">
                <Calculator className="h-4 w-4 shrink-0 text-purple-600 mt-0.5" />
                <div>
                  <strong>BRSR Intensity Formula:</strong>
                  <div className="mt-1 font-mono text-[11px] bg-white/80 p-2 rounded-lg border border-purple-200 inline-block">
                    Revenue-based intensity = (Applicable Metric / Revenue) · 100%
                  </div>
                  <div className="mt-1 text-[11px] text-purple-800">
                    Calculated fields are read-only. Missing values or zero denominators are handled explicitly to eliminate misleading ratios.
                  </div>
                </div>
              </div>

              {/* 12 Level 3 Fields */}
              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                {/* 1. Current-Year Revenue */}
                <div>
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>1. Current-Year Revenue</span>
                    <span className="text-[10px] text-blue-600 font-semibold">Linked L1</span>
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={`₹ ${financialData.turnover.toFixed(2)} Crore`}
                    className="mt-1.5 ios-field !text-xs font-bold text-slate-800"
                  />
                </div>

                {/* 2. Previous-Year Revenue */}
                <div>
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>2. Previous-Year Revenue</span>
                    <span className="text-[10px] text-blue-600 font-semibold">Linked L1</span>
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={`₹ ${financialData.previousTurnover.toFixed(2)} Crore`}
                    className="mt-1.5 ios-field !text-xs font-bold text-slate-800"
                  />
                </div>

                {/* 3. Relevant Expenditure Total */}
                <div>
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>3. Relevant Expenditure Total</span>
                    <span className="text-[10px] text-indigo-600 font-semibold">Linked L2 Spend</span>
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={`₹ ${totalResourceExpenditure.toFixed(2)} Crore`}
                    className="mt-1.5 ios-field !text-xs font-bold text-slate-800"
                  />
                </div>

                {/* 4. Physical Output Denominator */}
                <div>
                  <label className="text-xs font-bold text-slate-700">
                    4. Physical Output Denominator
                  </label>
                  <div className="mt-1.5 flex rounded-xl border border-slate-200 bg-white shadow-xs focus-within:ring-2 focus-within:ring-purple-200">
                    <input
                      type="number"
                      step="1"
                      value={intensityMetrics.physicalOutputDenominator}
                      onChange={e => handleIntensityChange('physicalOutputDenominator', parseFloat(e.target.value) || 0)}
                      className="w-full bg-transparent px-3 py-2 text-xs font-bold text-slate-900 outline-none"
                    />
                    <select
                      value={intensityMetrics.physicalOutputUnit}
                      onChange={e => handleIntensityChange('physicalOutputUnit', e.target.value as any)}
                      className="rounded-r-xl border-l border-slate-100 bg-slate-50 px-3 text-xs font-semibold text-slate-600 outline-none"
                    >
                      <option value="MW generated">MW generated</option>
                      <option value="MT product">MT product</option>
                      <option value="km highway">km highway</option>
                      <option value="Million Passengers">Million Passengers</option>
                      <option value="kL water treated">kL water treated</option>
                    </select>
                  </div>
                </div>

                {/* 5. Revenue-Based Intensity */}
                <div>
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>5. Revenue-Based Intensity</span>
                    <span className="text-[10px] text-purple-600 font-semibold">Read-only Formula</span>
                  </label>
                  <div className="mt-1.5 rounded-xl border border-purple-200 bg-purple-50/70 px-3 py-2 text-xs font-black text-purple-900">
                    {((totalResourceExpenditure / (financialData.turnover || 1)) * 100).toFixed(2)} % of Turnover
                  </div>
                </div>

                {/* 6. Physical-Output Intensity */}
                <div>
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>6. Physical-Output Intensity</span>
                    <span className="text-[10px] text-purple-600 font-semibold">Read-only Formula</span>
                  </label>
                  <div className="mt-1.5 rounded-xl border border-purple-200 bg-purple-50/70 px-3 py-2 text-xs font-black text-purple-900">
                    ₹ {(totalResourceExpenditure / (intensityMetrics.physicalOutputDenominator || 1)).toFixed(4)} Cr / {intensityMetrics.physicalOutputUnit}
                  </div>
                </div>

                {/* 7. Year-on-Year Change */}
                <div>
                  <label className="text-xs font-bold text-slate-700">7. Year-on-Year Change</label>
                  <input
                    type="text"
                    readOnly
                    value={yoyTurnover.text}
                    className="mt-1.5 ios-field !text-xs font-bold text-slate-800"
                  />
                </div>

                {/* 8. Calculation Methodology */}
                <div>
                  <label className="text-xs font-bold text-slate-700">8. Calculation Methodology</label>
                  <select
                    value={intensityMetrics.calculationMethodology}
                    onChange={e => handleIntensityChange('calculationMethodology', e.target.value as any)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-xs outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="SEBI BRSR Core Guidance">SEBI BRSR Core Guidance</option>
                    <option value="GRI 302-3 / 305-4 Standard">GRI 302-3 / 305-4 Standard</option>
                    <option value="GHG Protocol Intensity Standard">GHG Protocol Intensity Standard</option>
                  </select>
                </div>

                {/* 9. Source Data References */}
                <div>
                  <label className="text-xs font-bold text-slate-700">9. Source Data References</label>
                  <input
                    type="text"
                    value={intensityMetrics.sourceDataReferences?.join(', ') || 'MEIL-FS-2026-27.pdf'}
                    onChange={e => handleIntensityChange('sourceDataReferences', e.target.value.split(',').map(s => s.trim()))}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-xs outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                {/* 10. Calculation Validation */}
                <div>
                  <label className="text-xs font-bold text-slate-700">10. Calculation Validation</label>
                  <div className="mt-1.5 flex items-center">
                    <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>{intensityMetrics.calculationValidation || 'Passed'} (Denominator &gt; 0)</span>
                    </span>
                  </div>
                </div>

                {/* 11. Explanation of Variance */}
                <div>
                  <label className="text-xs font-bold text-slate-700">11. Explanation of Variance</label>
                  <input
                    type="text"
                    value={intensityMetrics.explanationOfVariance}
                    onChange={e => handleIntensityChange('explanationOfVariance', e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-xs outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                {/* 12. Reviewer Notes */}
                <div>
                  <label className="text-xs font-bold text-slate-700">12. Reviewer Notes</label>
                  <input
                    type="text"
                    value={intensityMetrics.reviewerNotes}
                    onChange={e => handleIntensityChange('reviewerNotes', e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-xs outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              </div>
            </div>
          )}

          {/* LEVEL 4: CSR & OTHER ASSIGNED FINANCIAL DISCLOSURES */}
          {activeFinanceLevel === 'l4' && (
            <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl space-y-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-600 text-xs font-black text-white shadow-xs">
                    4
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Level 4 — CSR & Other Assigned Financial Disclosures</h2>
                    <p className="text-xs text-slate-500">
                      Corporate Social Responsibility finance entries assigned to Finance Contributor
                    </p>
                  </div>
                </div>

                {/* Module Enable Toggle */}
                <label className="flex items-center gap-2 cursor-pointer self-start sm:self-auto">
                  <input
                    type="checkbox"
                    checked={csrData.isEnabled}
                    onChange={e => handleCsrChange('isEnabled', e.target.checked)}
                    className="h-4 w-4 rounded text-blue-600"
                  />
                  <span className="text-xs font-bold text-slate-700">Module Assigned to Finance Contributor</span>
                </label>
              </div>

              {!csrData.isEnabled ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center text-xs text-slate-500">
                  <HeartHandshake className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                  <div className="font-bold text-slate-700">CSR Module Not Assigned</div>
                  <p className="mt-1 max-w-md mx-auto">
                    The CSR Contributor remains the primary owner of CSR programme records. Enable this section only if delegated financial reporting authority by Admin.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-xs text-amber-900">
                    <Info className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                    <p>
                      <strong>System Logic:</strong> Do not finalize CSR compliance solely from this form. Reconcile with CSR programme records and the company's approved financial disclosures under Section 135 Companies Act.
                    </p>
                  </div>

                  {/* 11 Level 4 Fields */}
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                    {/* 1. CSR Project Reference */}
                    <div>
                      <label className="text-xs font-bold text-slate-700">1. CSR Project Reference</label>
                      <input
                        type="text"
                        value={csrData.csrProjectReference}
                        onChange={e => handleCsrChange('csrProjectReference', e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-semibold text-slate-800 shadow-xs outline-none focus:ring-2 focus:ring-blue-200"
                      />
                    </div>

                    {/* 2. Financial Year */}
                    <div>
                      <label className="text-xs font-bold text-slate-700">2. Financial Year</label>
                      <input
                        type="text"
                        value={csrData.financialYear}
                        onChange={e => handleCsrChange('financialYear', e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-xs outline-none focus:ring-2 focus:ring-blue-200"
                      />
                    </div>

                    {/* 3. Approved CSR Budget */}
                    <div>
                      <label className="text-xs font-bold text-slate-700">3. Approved CSR Budget (₹ Crore)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={csrData.approvedCsrBudget}
                        onChange={e => handleCsrChange('approvedCsrBudget', parseFloat(e.target.value) || 0)}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 shadow-xs outline-none focus:ring-2 focus:ring-blue-200"
                      />
                    </div>

                    {/* 4. Actual CSR Expenditure */}
                    <div>
                      <label className="text-xs font-bold text-slate-700">4. Actual CSR Expenditure (₹ Crore)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={csrData.actualCsrExpenditure}
                        onChange={e => handleCsrChange('actualCsrExpenditure', parseFloat(e.target.value) || 0)}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 shadow-xs outline-none focus:ring-2 focus:ring-blue-200"
                      />
                    </div>

                    {/* 5. Expenditure Type */}
                    <div>
                      <label className="text-xs font-bold text-slate-700">5. Expenditure Type</label>
                      <select
                        value={csrData.expenditureType}
                        onChange={e => handleCsrChange('expenditureType', e.target.value as any)}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-xs outline-none focus:ring-2 focus:ring-blue-200"
                      >
                        <option value="Project Execution">Project Execution</option>
                        <option value="Administrative Overheads">Administrative Overheads (Max 5%)</option>
                        <option value="Capacity Building">Capacity Building</option>
                        <option value="Ongoing Project">Ongoing Project (Multi-year)</option>
                        <option value="Capital Asset Creation">Capital Asset Creation</option>
                      </select>
                    </div>

                    {/* 6. Implementing Agency Reference */}
                    <div>
                      <label className="text-xs font-bold text-slate-700">6. Implementing Agency Reference</label>
                      <input
                        type="text"
                        value={csrData.implementingAgencyRef}
                        onChange={e => handleCsrChange('implementingAgencyRef', e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-xs outline-none focus:ring-2 focus:ring-blue-200"
                      />
                    </div>

                    {/* 7. Ledger / Payment Reference */}
                    <div>
                      <label className="text-xs font-bold text-slate-700">7. Ledger / Payment Reference</label>
                      <input
                        type="text"
                        value={csrData.ledgerPaymentRef}
                        onChange={e => handleCsrChange('ledgerPaymentRef', e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-xs outline-none focus:ring-2 focus:ring-blue-200"
                      />
                    </div>

                    {/* 8. Unspent Amount (Auto-calculated) */}
                    <div>
                      <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                        <span>8. Unspent Amount</span>
                        <span className="text-[10px] text-amber-600 font-semibold">Budget - Actual</span>
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={`₹ ${csrData.unspentAmount.toFixed(2)} Crore`}
                        className="mt-1.5 ios-field !text-xs font-bold text-amber-800"
                      />
                    </div>

                    {/* 9. Reconciliation Status */}
                    <div>
                      <label className="text-xs font-bold text-slate-700">9. Reconciliation Status</label>
                      <select
                        value={csrData.reconciliationStatus}
                        onChange={e => handleCsrChange('reconciliationStatus', e.target.value as any)}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-xs outline-none focus:ring-2 focus:ring-blue-200"
                      >
                        <option value="Reconciled">Reconciled with CSR Register</option>
                        <option value="Pending">Pending Audit Verification</option>
                        <option value="Exception">Exception (Discrepancy)</option>
                      </select>
                    </div>

                    {/* 10. Supporting Document */}
                    <div>
                      <label className="text-xs font-bold text-slate-700">10. Supporting Document</label>
                      <input
                        type="text"
                        value={csrData.supportingDocument}
                        onChange={e => handleCsrChange('supportingDocument', e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-xs outline-none focus:ring-2 focus:ring-blue-200"
                      />
                    </div>

                    {/* 11. Remarks */}
                    <div className="md:col-span-2">
                      <label className="text-xs font-bold text-slate-700">11. Remarks</label>
                      <input
                        type="text"
                        value={csrData.remarks}
                        onChange={e => handleCsrChange('remarks', e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-xs outline-none focus:ring-2 focus:ring-blue-200"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* LEVEL 6: VALIDATION & RECONCILIATION */}
          {activeFinanceLevel === 'l6' && (
            <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-600 text-xs font-black text-white shadow-xs">
                    6
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Level 6 — Validation & Reconciliation</h2>
                    <p className="text-xs text-slate-500">
                      Pre-submission diagnostic: 10 automated reconciliation checks across financial fields, units, and evidence
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleValidateData}
                  className="flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Re-run Validation</span>
                </button>
              </div>

              {/* 10 Level 6 Checklist Items */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {[
                  { id: 1, label: 'Required financial fields are complete (Turnover, CapEx, Basis)', passed: validationResult.financialSummaryCompleted },
                  { id: 2, label: 'Currency and display units are valid (INR, Crore)', passed: validationResult.currencyAndUnitsValid },
                  { id: 3, label: 'Reporting periods match assigned financial year (FY 2026-27)', passed: validationResult.reportingPeriodsMatch },
                  { id: 4, label: 'Duplicate expenditure entries are identified and checked', passed: validationResult.duplicateExpendituresChecked },
                  { id: 5, label: 'Required evidence is linked to correct records (FS & Env spend)', passed: validationResult.requiredDocumentsUploaded },
                  { id: 6, label: 'Financial figures reconcile to approved source records (SAP)', passed: validationResult.financialFiguresReconciled },
                  { id: 7, label: 'Calculated metrics use valid inputs and approved methodology', passed: validationResult.calculatedMetricsValid },
                  { id: 8, label: 'Previous-year comparisons use correct comparative period', passed: validationResult.previousYearComparisonAvailable },
                  { id: 9, label: 'Exceptions and estimates have appropriate explanations', passed: validationResult.exceptionsExplained },
                  { id: 10, label: 'No unresolved blocking validation errors remain', passed: validationResult.noBlockingErrors },
                ].map(item => (
                  <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-white/80 p-3 shadow-xs">
                    <div className="flex items-center gap-2.5">
                      <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white ${
                        item.passed ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}>
                        {item.passed ? <Check className="h-3 w-3 stroke-[3]" /> : <X className="h-3 w-3 stroke-[3]" />}
                      </div>
                      <span className="text-xs font-semibold text-slate-800">{item.label}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      item.passed ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                    }`}>
                      {item.passed ? 'Passed' : 'Attention'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Blocking Errors vs Warnings separation as explicitly instructed */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 pt-2">
                {/* Blocking Errors */}
                <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-rose-800 mb-2">
                    <ShieldAlert className="h-4 w-4 text-rose-600" />
                    <span>Blocking Errors ({validationResult.blockingErrors.length}) — Submission Blocked</span>
                  </div>
                  {validationResult.blockingErrors.length === 0 ? (
                    <p className="text-xs text-rose-700/80">No blocking errors found. Data is ready for submission.</p>
                  ) : (
                    <ul className="space-y-1 text-xs text-rose-900 list-disc list-inside">
                      {validationResult.blockingErrors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Warnings */}
                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-800 mb-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span>Warnings ({validationResult.warnings.length}) — Review Recommended</span>
                  </div>
                  {validationResult.warnings.length === 0 ? (
                    <p className="text-xs text-amber-700/80">No warnings flagged.</p>
                  ) : (
                    <ul className="space-y-1 text-xs text-amber-900 list-disc list-inside">
                      {validationResult.warnings.map((warn, i) => (
                        <li key={i}>{warn}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* LEVEL 7: SUBMISSION & REVIEW WORKFLOW */}
          {activeFinanceLevel === 'l7' && (
            <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-xs font-black text-white shadow-xs">
                    7
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Level 7 — Submission & Review Workflow</h2>
                    <p className="text-xs text-slate-500">
                      Standard 5-step lifecycle: Save as Draft → Validate Data → Submit for Review → Correction → Accepted / Locked
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-[11px] font-bold text-emerald-700">
                  Version v1.3 Package
                </span>
              </div>

              {/* 5-Step Workflow Cards */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
                {[
                  { step: '1. Save as Draft', status: 'Saved', sub: 'Entries preserved locally', active: true },
                  { step: '2. Validate Data', status: validationResult.readyForSubmission ? 'Passed' : 'Pending', sub: '10 rules evaluated', active: true },
                  { step: '3. Submit for Review', status: financialData.common?.submissionStatus === 'Submitted' ? 'Submitted' : 'Ready', sub: 'Authorized reviewer', active: validationResult.readyForSubmission },
                  { step: '4. Review / Correction', status: 'In Review', sub: 'Reviewer comments allowed', active: false },
                  { step: '5. Accepted / Locked', status: 'Pending', sub: 'Locked for BRSR audit', active: false },
                ].map((s, idx) => (
                  <div key={idx} className={`rounded-2xl border p-4 text-center transition ${
                    s.active ? 'border-blue-200 bg-blue-50/60' : 'border-slate-100 bg-white/70'
                  }`}>
                    <div className="text-xs font-bold text-slate-800">{s.step}</div>
                    <div className="mt-2 text-sm font-black text-blue-900">{s.status}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* Reviewer Comments & Resubmission Box */}
              <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-xs">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Review Feedback & Sign-off Notes</h3>
                <div className="mt-3 flex items-start gap-3 rounded-xl bg-slate-50 p-4 border border-slate-100">
                  <Clock className="h-4 w-4 text-blue-600 mt-0.5" />
                  <div className="text-xs">
                    <span className="font-bold text-slate-800">Finance Reviewer:</span>
                    <p className="mt-1 text-slate-600">
                      "Draft saved with ₹ 1,250.00 Cr turnover. Verified with STAT-AUD-FY26-SCH4. Please ensure CapEx ledger references are attached prior to final sign-off."
                    </p>
                  </div>
                </div>
              </div>

              {/* Big Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
                <div className="text-xs font-medium text-slate-500">
                  Ready to submit version <strong className="text-slate-800">v1.3</strong> for Gayatri Solar Plant (MEIL-SOL-GJT)
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    className="flex items-center gap-1.5 rounded-full border border-blue-200 bg-white px-5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>Save as Draft</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSubmitForReview}
                    disabled={!validationResult.readyForSubmission}
                    className={`flex items-center gap-2 rounded-full px-6 py-2.5 text-xs font-bold text-white shadow-md transition ${
                      validationResult.readyForSubmission
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/25'
                        : 'bg-slate-300 cursor-not-allowed'
                    }`}
                  >
                    <Send className="h-4 w-4" />
                    <span>Submit for Review (v1.3)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Action Bar for fin-data */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/60 bg-white/70 p-4 shadow-lg backdrop-blur-md">
            <button
              onClick={() => setActiveModule('fin-assignments')}
              className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Assignments</span>
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveDraft}
                disabled={saveStatus === 'saving'}
                className="flex items-center gap-1.5 rounded-full border border-blue-200 bg-white px-4 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved!' : 'Save as Draft'}</span>
              </button>

              <button
                onClick={handleValidateData}
                className="flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Validate Data</span>
              </button>

              <button
                onClick={() => setActiveModule('fin-expenditure')}
                className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/25 hover:from-blue-700 hover:to-indigo-700"
              >
                <span>Next: Level 2 — Resource Expenditure</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* SCREEN 4 — RESOURCE EXPENDITURE (Level 2)                              */}
      {/* ---------------------------------------------------------------------- */}
      {activeModule === 'fin-expenditure' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-500/25">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-slate-900">Level 2 — Environmental & Resource Expenditure</h1>
                  <p className="text-xs font-medium text-slate-500">
                    Record financial expenditure for relevant environmental and resource-efficiency activities across 8 categories
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="rounded-full border border-blue-200 bg-blue-50/90 px-3.5 py-1.5 text-xs font-bold text-blue-800">
                  Gayatri Solar Plant (MEIL-SOL-GJT) · FY 2026-27
                </div>
                <button
                  onClick={() => setActiveModule('fin-assignments')}
                  className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Assignments</span>
                </button>
              </div>
            </div>
          </div>

          {/* Stepper (Step 3 active) */}
          <FinStepper currentStep={3} onNavigate={handleStepperNavigate} />

          {/* System Logic Banner */}
          <div className="rounded-[24px] border border-indigo-200 bg-indigo-50/60 p-4 text-xs text-indigo-900 flex items-start gap-3">
            <Info className="h-4 w-4 shrink-0 text-indigo-600 mt-0.5" />
            <p>
              <strong>System Logic:</strong> Allows multiple expenditure records. Calculates totals by category, period, entity, CapEx and OpEx. Prevents double counting of amounts reported across multiple categories.
            </p>
          </div>

          {/* Resource-Related Expenditure Table */}
          <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Environmental & Resource-Related Expenditure Records</h2>
                <p className="text-xs text-slate-500">Category-wise breakdown across 8 approved BRSR environmental buckets</p>
              </div>

              <button
                onClick={() => setShowAddExpenditureModal(true)}
                className="flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 self-start sm:self-auto"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>+ Add Expenditure Record</span>
              </button>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="pb-3 pl-2">Category & Project</th>
                    <th className="pb-3">Description</th>
                    <th className="pb-3">Amount (₹ Cr)</th>
                    <th className="pb-3">Expense Type</th>
                    <th className="pb-3">Cost Centre / Vendor</th>
                    <th className="pb-3">Invoice / Source</th>
                    <th className="pb-3 pr-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-xs">
                  {expenditures.map(item => (
                    <tr key={item.id} className="group hover:bg-blue-50/40 transition">
                      <td className="py-4 pl-2 font-bold text-slate-800">
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                            item.category === 'Pollution Control' ? 'bg-rose-500' :
                            item.category === 'Energy Efficiency' ? 'bg-amber-500' :
                            item.category === 'Renewable Energy' ? 'bg-emerald-500' :
                            item.category === 'Water Conservation' ? 'bg-cyan-500' :
                            item.category === 'Waste Management' ? 'bg-indigo-500' :
                            item.category === 'Emission Reduction' ? 'bg-orange-500' :
                            item.category === 'Environmental Protection' ? 'bg-teal-500' : 'bg-purple-500'
                          }`} />
                          <div>
                            <div className="text-slate-900">{item.projectName || item.category}</div>
                            <div className="text-[11px] font-medium text-slate-400">{item.category}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 text-slate-600 font-medium max-w-xs">{item.description}</td>
                      <td className="py-4 font-black text-slate-900">
                        ₹ {item.amount.toFixed(2)}
                      </td>
                      <td className="py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          item.source === 'CapEx'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-purple-50 text-purple-700 border border-purple-200'
                        }`}>
                          {item.source}
                        </span>
                      </td>
                      <td className="py-4 text-slate-600">
                        <div className="font-semibold text-slate-800">{item.costCentre}</div>
                        <div className="text-[10px] text-slate-400">{item.vendorRef}</div>
                      </td>
                      <td className="py-4 text-slate-500">
                        <div className="font-mono text-blue-700 font-semibold">{item.invoiceRef}</div>
                        <div className="text-[10px] text-slate-400">{item.dataSource}</div>
                      </td>
                      <td className="py-4 pr-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              const newAmt = prompt(`Update expenditure amount for ${item.description} (in ₹ Cr):`, String(item.amount))
                              if (newAmt && !isNaN(Number(newAmt))) {
                                financeStore.updateExpenditure(item.id, { amount: Number(newAmt) })
                                refreshData()
                                showToast('Expenditure amount updated')
                              }
                            }}
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
                            title="Edit Record"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteExpenditure(item.id)}
                            className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            title="Delete Record"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Summary Cards (Total + CapEx / OpEx Split + Distribution) */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Total Resource Expenditure Card */}
            <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl lg:col-span-5 space-y-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Total Environmental Spend
                </div>
                <div className="mt-1 text-4xl font-black tracking-tight text-slate-900">
                  ₹ {totalResourceExpenditure.toFixed(2)} <span className="text-xl font-bold text-slate-600">Cr</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div className="rounded-xl bg-blue-50/70 p-3 border border-blue-100">
                  <div className="text-[10px] font-bold text-blue-700 uppercase">CapEx Green Spend</div>
                  <div className="text-lg font-black text-blue-900">₹ {capexTotal.toFixed(2)} Cr</div>
                  <div className="text-[10px] text-blue-600">{((capexTotal / (totalResourceExpenditure || 1)) * 100).toFixed(0)}% of total</div>
                </div>
                <div className="rounded-xl bg-purple-50/70 p-3 border border-purple-100">
                  <div className="text-[10px] font-bold text-purple-700 uppercase">OpEx Green Spend</div>
                  <div className="text-lg font-black text-purple-900">₹ {opexTotal.toFixed(2)} Cr</div>
                  <div className="text-[10px] text-purple-600">{((opexTotal / (totalResourceExpenditure || 1)) * 100).toFixed(0)}% of total</div>
                </div>
              </div>
            </div>

            {/* Category Distribution Bar */}
            <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl lg:col-span-7 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">BRSR Category Allocation</h3>
                  <span className="text-[11px] font-semibold text-slate-400">Amount in ₹ Crore</span>
                </div>

                {/* Multi-segment progress bar */}
                <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
                  {distribution.map(d => (
                    <div
                      key={d.category}
                      style={{ width: `${d.percentage}%`, backgroundColor: d.color }}
                      title={`${d.category}: ₹ ${d.amount.toFixed(2)} Cr (${d.percentage.toFixed(0)}%)`}
                    />
                  ))}
                </div>

                {/* Legend */}
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-medium text-slate-600 sm:grid-cols-3">
                  {distribution.map(d => (
                    <div key={d.category} className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="truncate">{d.category}</span>
                      <span className="font-bold text-slate-900 ml-auto">
                        ₹{d.amount.toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/60 bg-white/70 p-4 shadow-lg backdrop-blur-md">
            <button
              onClick={() => {
                setActiveModule('fin-data')
                setActiveFinanceLevel('l1')
              }}
              className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back: Level 1 — Financial Summary</span>
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveDraft}
                className="flex items-center gap-1.5 rounded-full border border-blue-200 bg-white px-4 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50"
              >
                <Save className="h-3.5 w-3.5" />
                <span>Save as Draft</span>
              </button>

              <button
                onClick={handleValidateData}
                className="flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Validate Data</span>
              </button>

              <button
                onClick={() => setActiveModule('fin-evidence')}
                className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/25 hover:from-blue-700 hover:to-indigo-700"
              >
                <span>Next: Level 5 — Evidence Vault</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* SCREEN 5 — EVIDENCE & DOCUMENTS (Level 5)                              */}
      {/* ---------------------------------------------------------------------- */}
      {activeModule === 'fin-evidence' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-500/25">
                  <Link2 className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-slate-900">Level 5 — Financial Evidence & Documents</h1>
                  <p className="text-xs font-medium text-slate-500">
                    Attach verified audit evidence, invoices, and ledger schedules across all 14 disclosure fields
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="rounded-full border border-blue-200 bg-blue-50/90 px-3.5 py-1.5 text-xs font-bold text-blue-800">
                  Gayatri Solar Plant (MEIL-SOL-GJT) · FY 2026-27
                </div>
                <button
                  onClick={() => setActiveModule('fin-assignments')}
                  className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Assignments</span>
                </button>
              </div>
            </div>
          </div>

          {/* Stepper (Step 6 active) */}
          <FinStepper currentStep={6} onNavigate={handleStepperNavigate} />

          {/* System Logic Banner */}
          <div className="rounded-[24px] border border-blue-200 bg-blue-50/60 p-4 text-xs text-blue-900 flex items-start gap-3">
            <Info className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
            <p>
              <strong>System Logic:</strong> An uploaded file is not automatically verified. Document upload status is kept separate from evidence acceptance status (Pending / Accepted / Returned).
            </p>
          </div>

          {/* TWO COLUMNS: Left Upload + Right Validation Checklist Summary */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left: Document Upload Drag-and-drop Area */}
            <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl lg:col-span-6 flex flex-col justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Document Upload & Linking</h2>
                <p className="text-xs text-slate-500">Upload financial statements, GL extracts, and vendor invoices</p>

                {/* Dropzone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50/40 p-8 text-center transition hover:border-blue-500 hover:bg-blue-50/80"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".pdf,.xlsx,.xls,.csv"
                    onChange={e => {
                      if (e.target.files?.[0]) {
                        handleUploadDocument(e.target.files[0].name)
                      }
                    }}
                  />
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 shadow-xs">
                    <Upload className="h-6 w-6" />
                  </div>
                  <div className="mt-3 text-sm font-bold text-slate-800">
                    Drag & drop files here or <span className="text-blue-600 underline">click to upload</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    Supported formats: PDF, XLSX, CSV (Max 25 MB)
                  </div>

                  {uploadProgress !== null && (
                    <div className="mt-4 w-full max-w-xs">
                      <div className="flex justify-between text-[11px] font-bold text-slate-600">
                        <span>Uploading & signing hash…</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-blue-100">
                        <div className="h-full bg-blue-600 transition-all" style={{ width: `${uploadProgress}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                <span>Stored in secure encrypted cloud repository</span>
                <button
                  type="button"
                  onClick={() => setShowUploadDocModal(true)}
                  className="font-bold text-blue-600 hover:underline"
                >
                  Upload with complete Level 5 metadata →
                </button>
              </div>
            </div>

            {/* Right: Evidence Readiness Diagnostic */}
            <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl lg:col-span-6 flex flex-col justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Evidence Audit Readiness</h2>
                <p className="text-xs text-slate-500">Status of mandatory verification attachments</p>

                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white/80">
                    <span className="text-xs font-semibold text-slate-800">1. Statutory Financial Statement (FS)</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Attached & Accepted
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white/80">
                    <span className="text-xs font-semibold text-slate-800">2. Environmental CapEx Ledger Extract</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                      Under Review
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white/80">
                    <span className="text-xs font-semibold text-slate-800">3. Bank Statement & Payment Slips</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                      Returned for Seal
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white/80">
                    <span className="text-xs font-semibold text-slate-800">4. CSR Compliance Certification</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Accepted
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Pill */}
              <div className="mt-6">
                <div className={`flex items-center justify-center gap-2 rounded-2xl py-3 text-xs font-bold shadow-xs ${
                  validationResult.requiredDocumentsUploaded
                    ? 'border border-emerald-300 bg-emerald-50 text-emerald-800'
                    : 'border border-amber-300 bg-amber-50 text-amber-800'
                }`}>
                  <span className={`h-2.5 w-2.5 rounded-full ${validationResult.requiredDocumentsUploaded ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                  <span>{validationResult.requiredDocumentsUploaded ? 'Required evidence criteria satisfied' : 'Pending mandatory evidence files'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Uploaded Documents Table — Full 14 Fields */}
          <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Uploaded Financial Documents</h2>
                <p className="text-xs text-slate-500">Every linked file with version history and acceptance status</p>
              </div>

              <button
                onClick={() => setShowUploadDocModal(true)}
                className="flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 self-start sm:self-auto"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>+ Upload New Evidence</span>
              </button>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="pb-3 pl-2">Document Name</th>
                    <th className="pb-3">Category</th>
                    <th className="pb-3">Linked Record</th>
                    <th className="pb-3">Source Ref / Org</th>
                    <th className="pb-3">Upload Date</th>
                    <th className="pb-3">Acceptance Status</th>
                    <th className="pb-3 pr-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-xs">
                  {documents.map(doc => (
                    <tr key={doc.id} className="group hover:bg-blue-50/40 transition">
                      <td className="py-4 pl-2 font-bold text-slate-800">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-blue-600" />
                          <span>{doc.documentName}</span>
                        </div>
                      </td>
                      <td className="py-4 text-slate-600 font-medium">{doc.category}</td>
                      <td className="py-4 text-slate-500 font-semibold">{doc.linkedTo}</td>
                      <td className="py-4 text-slate-600">
                        <div className="font-mono text-slate-700">{doc.sourceReference || 'N/A'}</div>
                        <div className="text-[10px] text-slate-400">{doc.issuingOrganization || 'MEIL'}</div>
                      </td>
                      <td className="py-4 text-slate-500">{doc.uploadDate}</td>
                      <td className="py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          doc.status === 'Accepted'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : doc.status === 'Under Review'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {doc.status}
                        </span>
                      </td>
                      <td className="py-4 pr-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedDocForHistory(doc)}
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
                            title="Version History & Remarks"
                          >
                            <History className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => showToast(`Downloading verified attachment: ${doc.documentName}`)}
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
                            title="Download Document"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            title="Delete Document"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/60 bg-white/70 p-4 shadow-lg backdrop-blur-md">
            <button
              onClick={() => setActiveModule('fin-expenditure')}
              className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back: Resource Expenditure</span>
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveDraft}
                className="flex items-center gap-1.5 rounded-full border border-blue-200 bg-white px-4 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50"
              >
                <Save className="h-3.5 w-3.5" />
                <span>Save as Draft</span>
              </button>

              <button
                onClick={handleValidateData}
                className="flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Validate Data</span>
              </button>

              <button
                onClick={() => {
                  setActiveModule('fin-data')
                  setActiveFinanceLevel('l7')
                }}
                className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/25 hover:from-blue-700 hover:to-indigo-700"
              >
                <span>Next: Level 7 — Review & Sign-off</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* SCREEN 6 — MY SUBMISSIONS                                              */}
      {/* ---------------------------------------------------------------------- */}
      {activeModule === 'fin-submissions' && (
        <div className="space-y-6">
          <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl font-black text-slate-900">My Submissions</h1>
                <p className="text-xs font-medium text-slate-500">
                  Track records you submitted, check review feedback, and correct returned entries
                </p>
              </div>

              <button
                onClick={() => {
                  setActiveModule('fin-data')
                  setActiveFinanceLevel('l1')
                }}
                className="flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 self-start md:self-auto"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Financial Entry</span>
              </button>
            </div>

            {/* Summary Counters */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div className="rounded-2xl border border-slate-100 bg-white/80 p-3.5 text-center shadow-xs">
                <div className="text-xs font-bold text-slate-500">Drafts</div>
                <div className="mt-1 text-2xl font-black text-slate-800">
                  {submissions.filter(s => s.status === 'Draft' || s.status === 'In Progress').length}
                </div>
              </div>
              <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-3.5 text-center shadow-xs">
                <div className="text-xs font-bold text-blue-700">Submitted</div>
                <div className="mt-1 text-2xl font-black text-blue-900">
                  {submissions.filter(s => s.status === 'Submitted').length}
                </div>
              </div>
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-3.5 text-center shadow-xs">
                <div className="text-xs font-bold text-indigo-700">Under Review</div>
                <div className="mt-1 text-2xl font-black text-indigo-900">
                  {submissions.filter(s => s.status === 'Under Review').length}
                </div>
              </div>
              <div className="rounded-2xl border border-rose-100 bg-rose-50/70 p-3.5 text-center shadow-xs">
                <div className="text-xs font-bold text-rose-700">Returned</div>
                <div className="mt-1 text-2xl font-black text-rose-900">
                  {submissions.filter(s => s.status === 'Returned for Correction').length}
                </div>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3.5 text-center shadow-xs">
                <div className="text-xs font-bold text-emerald-700">Accepted</div>
                <div className="mt-1 text-2xl font-black text-emerald-900">
                  {submissions.filter(s => s.status === 'Accepted').length}
                </div>
              </div>
            </div>

            {/* Submissions Table */}
            <div className="mt-6 overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="pb-3 pl-2">Submission ID</th>
                    <th className="pb-3">Version</th>
                    <th className="pb-3">Entity</th>
                    <th className="pb-3">FY</th>
                    <th className="pb-3">Module</th>
                    <th className="pb-3">Reviewer</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 pr-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-xs">
                  {submissions.map(sub => (
                    <tr key={sub.id} className="group hover:bg-blue-50/40 transition">
                      <td className="py-4 pl-2 font-mono font-bold text-blue-700">
                        {sub.id}
                      </td>
                      <td className="py-4 font-mono font-semibold text-slate-600">{sub.version || 'v1.0'}</td>
                      <td className="py-4 font-bold text-slate-800">{sub.entityName}</td>
                      <td className="py-4 text-slate-600">{sub.financialYear}</td>
                      <td className="py-4 text-slate-600 font-medium">{sub.module}</td>
                      <td className="py-4 text-slate-600">{sub.reviewer}</td>
                      <td className="py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          sub.status === 'Accepted'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : sub.status === 'Returned for Correction'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : sub.status === 'Under Review'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {sub.status}
                        </span>
                      </td>
                      <td className="py-4 pr-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedSubmission(sub)}
                            className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50/80 px-3 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100"
                          >
                            <span>Details</span>
                            <ChevronRight className="h-3 w-3" />
                          </button>
                          {sub.status === 'Returned for Correction' && (
                            <button
                              onClick={() => {
                                setActiveModule('fin-data')
                                setActiveFinanceLevel('l1')
                                showToast('Reviewer comments loaded for correction.')
                              }}
                              className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-3 py-1 text-xs font-bold text-white hover:bg-rose-700 shadow-xs"
                            >
                              <span>Correct</span>
                              <Edit3 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Submission Details Modal */}
          <AnimatePresence>
            {selectedSubmission && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/80 bg-white p-6 shadow-2xl"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <div className="text-xs font-mono font-bold text-blue-600">
                        {selectedSubmission.id} · {selectedSubmission.version || 'v1.0'}
                      </div>
                      <h3 className="form-card-title">
                        {selectedSubmission.entityName}
                      </h3>
                    </div>
                    <button
                      onClick={() => setSelectedSubmission(null)}
                      className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Comments from reviewer */}
                  {selectedSubmission.latestComment && (
                    <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50/80 p-4">
                      <div className="flex items-center gap-2 text-xs font-bold text-rose-800">
                        <AlertTriangle className="h-4 w-4" />
                        <span>Reviewer Feedback ({selectedSubmission.reviewer})</span>
                      </div>
                      <p className="mt-1.5 text-xs font-medium text-slate-700">
                        "{selectedSubmission.latestComment}"
                      </p>
                    </div>
                  )}

                  {/* Submission Timeline */}
                  <div className="mt-6">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Audit Timeline & History
                    </h4>
                    <div className="mt-3 space-y-3">
                      {selectedSubmission.timeline.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-3 text-xs">
                          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                            <Clock className="h-3 w-3" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-800">{item.step}</span>
                            <span className="text-slate-400"> by {item.actor}</span>
                            <div className="text-[11px] text-slate-400">{item.timestamp}</div>
                            {item.note && <div className="mt-0.5 text-slate-600 italic">"{item.note}"</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions inside modal */}
                  <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                    {selectedSubmission.status === 'Returned for Correction' && (
                      <button
                        onClick={() => handleResubmit(selectedSubmission.id)}
                        className="rounded-full bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
                      >
                        Resubmit for Review
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedSubmission(null)}
                      className="rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                    >
                      Close
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* SCREEN 7 — REPORTS & EXPORTS                                           */}
      {/* ---------------------------------------------------------------------- */}
      {activeModule === 'fin-reports' && (
        <div className="space-y-6">
          <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl">
            <h1 className="text-2xl font-black text-slate-900">Reports & Exports</h1>
            <p className="text-xs font-medium text-slate-500">
              Authorized compliance extractions for SEBI BRSR Principle 6, ESG consolidation, and statutory audits
            </p>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* Report 1: Financial Summary */}
              <div className="rounded-2xl border border-slate-100 bg-white/80 p-5 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <FileText className="h-5 w-5" />
                </div>
                <h3 className="mt-3 text-sm font-bold text-slate-900">Financial Summary Report</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Turnover, YoY growth, CapEx/OpEx, and statutory reporting basis for FY 2026-27.
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={() => {
                      financeStore.exportFinancialSummaryCSV()
                      showToast('Exported Financial Summary CSV')
                    }}
                    className="flex items-center gap-1.5 rounded-full bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
                  >
                    <Download className="h-3 w-3" />
                    <span>Download CSV</span>
                  </button>
                </div>
              </div>

              {/* Report 2: Resource Expenditure */}
              <div className="rounded-2xl border border-slate-100 bg-white/80 p-5 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                  <Layers className="h-5 w-5" />
                </div>
                <h3 className="mt-3 text-sm font-bold text-slate-900">Resource Expenditure Report</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Category-wise environmental initiatives, clean energy CapEx, and water conservation spend across all 8 categories.
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={() => {
                      financeStore.exportResourceExpendituresCSV()
                      showToast('Exported Resource Expenditures CSV')
                    }}
                    className="flex items-center gap-1.5 rounded-full bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-indigo-700"
                  >
                    <Download className="h-3 w-3" />
                    <span>Download CSV</span>
                  </button>
                </div>
              </div>

              {/* Report 3: BRSR Financial Schedules */}
              <div className="rounded-2xl border border-slate-100 bg-white/80 p-5 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                  <FileCheck2 className="h-5 w-5" />
                </div>
                <h3 className="mt-3 text-sm font-bold text-slate-900">BRSR Financial Schedules</h3>
                <p className="mt-1 text-xs text-slate-500">
                  SEBI Principle 6 Environmental Protection expenditure mappings and intensity denominators in JSON structure.
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={() => {
                      const exportObj = {
                        financialSummary: financeStore.getFinancialSummary(),
                        intensityMetrics: financeStore.getIntensityMetrics(),
                        csrDisclosures: financeStore.getCsrDisclosures(),
                        expenditures: financeStore.getExpenditures(),
                      }
                      const json = JSON.stringify(exportObj, null, 2)
                      const blob = new Blob([json], { type: 'application/json' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `meilESG_BRSR_Comprehensive_Financial_Schedule.json`
                      a.click()
                      showToast('Exported BRSR JSON schedule')
                    }}
                    className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                  >
                    <Download className="h-3 w-3" />
                    <span>Download JSON</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* SCREEN 8 — ACTIVITY LOG                                                */}
      {/* ---------------------------------------------------------------------- */}
      {activeModule === 'fin-activity' && (
        <div className="space-y-6">
          <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl">
            <h1 className="text-2xl font-black text-slate-900">Activity Log</h1>
            <p className="text-xs font-medium text-slate-500">
              Complete audit trail of recorded actions, draft revisions, document uploads, and validation events
            </p>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="pb-3 pl-2">Date & Time</th>
                    <th className="pb-3">Activity Type</th>
                    <th className="pb-3">Record / Reference</th>
                    <th className="pb-3">Description</th>
                    <th className="pb-3">Actor</th>
                    <th className="pb-3 pr-2 text-right">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-xs">
                  {activities.map(act => (
                    <tr key={act.id} className="group hover:bg-blue-50/40 transition">
                      <td className="py-4 pl-2 font-mono text-slate-500">{act.timestamp}</td>
                      <td className="py-4 font-bold text-slate-800">{act.title}</td>
                      <td className="py-4 font-mono text-blue-700">{act.entity || 'MEIL-SOL-GJT'}</td>
                      <td className="py-4 text-slate-600 max-w-md">{act.description}</td>
                      <td className="py-4 text-slate-700 font-semibold">{act.actor}</td>
                      <td className="py-4 pr-2 text-right">
                        <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                          Success
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL: ADD RESOURCE EXPENDITURE RECORD (All 13 Fields)                  */}
      {/* ---------------------------------------------------------------------- */}
      <AnimatePresence>
        {showAddExpenditureModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/80 bg-white p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add Resource Expenditure Record</h3>
                  <p className="text-xs text-slate-500">Record Level 2 financial expenditure for environmental initiatives</p>
                </div>
                <button onClick={() => setShowAddExpenditureModal(false)} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleAddExpenditure} className="mt-4 space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {/* 1. Expenditure Category (8 categories) */}
                  <div>
                    <label className="text-xs font-bold text-slate-700">1. Expenditure Category <span className="text-rose-500">*</span></label>
                    <select
                      value={newExpCategory}
                      onChange={e => setNewExpCategory(e.target.value as any)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="Pollution Control">Pollution Control</option>
                      <option value="Energy Efficiency">Energy Efficiency</option>
                      <option value="Renewable Energy">Renewable Energy</option>
                      <option value="Water Conservation">Water Conservation</option>
                      <option value="Waste Management">Waste Management</option>
                      <option value="Emission Reduction">Emission Reduction</option>
                      <option value="Environmental Protection">Environmental Protection</option>
                      <option value="Other Resource-Efficiency Initiatives">Other Resource-Efficiency Initiatives</option>
                    </select>
                  </div>

                  {/* 2. Project / Initiative Name */}
                  <div>
                    <label className="text-xs font-bold text-slate-700">2. Project / Initiative Name <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Inverter efficiency upgrades"
                      value={newExpProjectName}
                      onChange={e => setNewExpProjectName(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                </div>

                {/* 3. Description */}
                <div>
                  <label className="text-xs font-bold text-slate-700">3. Description (Purpose of Expenditure) <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Modernization of solar inverter transformers and heat sinks"
                    value={newExpDesc}
                    onChange={e => setNewExpDesc(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {/* 4. Amount */}
                  <div>
                    <label className="text-xs font-bold text-slate-700">4. Amount (in ₹ Crore) <span className="text-rose-500">*</span></label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={newExpAmount || ''}
                      onChange={e => setNewExpAmount(parseFloat(e.target.value) || 0)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>

                  {/* 5. Currency */}
                  <div>
                    <label className="text-xs font-bold text-slate-700">5. Currency</label>
                    <select
                      value={newExpCurrency}
                      onChange={e => setNewExpCurrency(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="INR (₹)">INR (₹)</option>
                      <option value="USD ($)">USD ($)</option>
                      <option value="EUR (€)">EUR (€)</option>
                    </select>
                  </div>

                  {/* 6. Expense Type */}
                  <div>
                    <label className="text-xs font-bold text-slate-700">6. Expense Type</label>
                    <select
                      value={newExpSource}
                      onChange={e => setNewExpSource(e.target.value as any)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="CapEx">CapEx (Capital Expenditure)</option>
                      <option value="OpEx">OpEx (Operating Expenditure)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {/* 7. Accounting Period */}
                  <div>
                    <label className="text-xs font-bold text-slate-700">7. Accounting Period</label>
                    <input
                      type="text"
                      value={newExpPeriod}
                      onChange={e => setNewExpPeriod(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>

                  {/* 8. Cost Centre */}
                  <div>
                    <label className="text-xs font-bold text-slate-700">8. Cost Centre</label>
                    <input
                      type="text"
                      value={newExpCostCentre}
                      onChange={e => setNewExpCostCentre(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>

                  {/* 9. Vendor / Supplier Reference */}
                  <div>
                    <label className="text-xs font-bold text-slate-700">9. Vendor / Supplier</label>
                    <input
                      type="text"
                      placeholder="e.g. ABB India Ltd."
                      value={newExpVendor}
                      onChange={e => setNewExpVendor(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {/* 10. Invoice / Ledger Reference */}
                  <div>
                    <label className="text-xs font-bold text-slate-700">10. Invoice / Ledger Ref</label>
                    <input
                      type="text"
                      placeholder="e.g. INV-2026-991"
                      value={newExpInvoiceRef}
                      onChange={e => setNewExpInvoiceRef(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>

                  {/* 11. Data Source */}
                  <div>
                    <label className="text-xs font-bold text-slate-700">11. Data Source</label>
                    <select
                      value={newExpDataSource}
                      onChange={e => setNewExpDataSource(e.target.value as any)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="Invoice">Invoice</option>
                      <option value="Ledger">General Ledger</option>
                      <option value="Approved report">Approved report</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {/* 12. Supporting Document Link */}
                  <div>
                    <label className="text-xs font-bold text-slate-700">12. Supporting Document Link</label>
                    <input
                      type="text"
                      value={newExpEvidenceLink}
                      onChange={e => setNewExpEvidenceLink(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                </div>

                {/* 13. Remarks */}
                <div>
                  <label className="text-xs font-bold text-slate-700">13. Remarks (Additional Explanation)</label>
                  <input
                    type="text"
                    placeholder="Additional context, reconciliation notes, or assumptions..."
                    value={newExpRemarks}
                    onChange={e => setNewExpRemarks(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddExpenditureModal(false)}
                    className="rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-full bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-xs"
                  >
                    Save Level 2 Record
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL: UPLOAD EVIDENCE DOCUMENT (All 14 Fields)                         */}
      {/* ---------------------------------------------------------------------- */}
      <AnimatePresence>
        {showUploadDocModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/80 bg-white p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Upload Financial Evidence Document</h3>
                  <p className="text-xs text-slate-500">Record Level 5 evidence fields, document date & issuing authority</p>
                </div>
                <button onClick={() => setShowUploadDocModal(false)} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {/* 1. Document Name */}
                  <div>
                    <label className="text-xs font-bold text-slate-700">1. Document Name / Filename <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. MEIL_Annual_FS_2026.pdf"
                      value={newDocName}
                      onChange={e => setNewDocName(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>

                  {/* 2. Document Category */}
                  <div>
                    <label className="text-xs font-bold text-slate-700">2. Document Category <span className="text-rose-500">*</span></label>
                    <select
                      value={newDocCategory}
                      onChange={e => setNewDocCategory(e.target.value as any)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="Financial Statement">Financial Statement</option>
                      <option value="General Ledger Extract">General Ledger Extract</option>
                      <option value="Invoice">Invoice</option>
                      <option value="Capital Expenditure">Capital Expenditure</option>
                      <option value="Operating Expenditure">Operating Expenditure</option>
                      <option value="Environmental Expenditure">Environmental Expenditure</option>
                      <option value="CSR Statement">CSR Statement</option>
                      <option value="Supporting Document">Supporting Document</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {/* 3. Linked Entity */}
                  <div>
                    <label className="text-xs font-bold text-slate-700">3. Linked Entity (Prefilled)</label>
                    <input
                      type="text"
                      readOnly
                      value={financialData.common?.entityName || 'Gayatri Solar Plant (MEIL-SOL-GJT)'}
                      className="mt-1 ios-field !text-xs font-semibold text-slate-800"
                    />
                  </div>

                  {/* 4. Linked Financial Record */}
                  <div>
                    <label className="text-xs font-bold text-slate-700">4. Linked Financial Record</label>
                    <select
                      value={newDocLinkedTo}
                      onChange={e => setNewDocLinkedTo(e.target.value as any)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="Financial Summary">Financial Summary</option>
                      <option value="Resource Expenditure">Resource Expenditure</option>
                      <option value="Intensity Metrics">Intensity Metrics</option>
                      <option value="CSR Disclosures">CSR Disclosures</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {/* 5. Reporting Period */}
                  <div>
                    <label className="text-xs font-bold text-slate-700">5. Reporting Period</label>
                    <input
                      type="text"
                      value={newDocReportingPeriod}
                      onChange={e => setNewDocReportingPeriod(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>

                  {/* 6. Document Date */}
                  <div>
                    <label className="text-xs font-bold text-slate-700">6. Document Date</label>
                    <input
                      type="text"
                      value={newDocDate}
                      onChange={e => setNewDocDate(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>

                  {/* 7. Issuing Organization */}
                  <div>
                    <label className="text-xs font-bold text-slate-700">7. Issuing Organization</label>
                    <input
                      type="text"
                      value={newDocIssuingOrg}
                      onChange={e => setNewDocIssuingOrg(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                </div>

                {/* 8. Source Reference */}
                <div>
                  <label className="text-xs font-bold text-slate-700">8. Source Reference (Document or Invoice Number)</label>
                  <input
                    type="text"
                    placeholder="e.g. STAT-AUD-FY26-SCH4"
                    value={newDocSourceRef}
                    onChange={e => setNewDocSourceRef(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-mono font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                {/* 14. Version History Note */}
                <div>
                  <label className="text-xs font-bold text-slate-700">Version History / Note</label>
                  <input
                    type="text"
                    placeholder="e.g. Initial statutory audit sign-off copy"
                    value={newDocVersionNote}
                    onChange={e => setNewDocVersionNote(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowUploadDocModal(false)}
                    className="rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUploadDocument()}
                    className="rounded-full bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-xs"
                  >
                    Upload Document & Attach
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL: DOCUMENT VERSION HISTORY                                         */}
      {/* ---------------------------------------------------------------------- */}
      <AnimatePresence>
        {selectedDocForHistory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-3xl border border-white/80 bg-white p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Document Version History</h3>
                  <p className="text-xs text-blue-600 font-mono font-bold">{selectedDocForHistory.documentName}</p>
                </div>
                <button onClick={() => setSelectedDocForHistory(null)} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <div className="text-xs text-slate-500">
                  Source Reference: <strong className="text-slate-800">{selectedDocForHistory.sourceReference || 'N/A'}</strong>
                </div>

                {selectedDocForHistory.reviewerComments && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                    <strong>Reviewer Comments:</strong> {selectedDocForHistory.reviewerComments}
                  </div>
                )}

                <div className="space-y-2 mt-3">
                  {(selectedDocForHistory.versionHistory || [
                    { version: 'v1.0', date: selectedDocForHistory.uploadDate, user: selectedDocForHistory.uploadedBy, note: 'Initial upload' }
                  ]).map((v, i) => (
                    <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                      <span className="font-mono font-bold text-blue-700">{v.version}</span>
                      <div>
                        <div className="font-semibold text-slate-800">{v.user} · {v.date}</div>
                        <div className="text-slate-500 italic mt-0.5">{v.note}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedDocForHistory(null)}
                  className="rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default FinanceWorkspace
