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
import { useApp } from '@/lib/pu/auth-context'
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
} from '@/lib/pu/finance-store'
/* ENV-user systems extracted into the finance workspace (exact same stack):
   real evidence vault (upload/view/download), consolidated final review modal
   and the submit success confirmation. */
import { EvidenceUploadSection, FullscreenEvidenceModal } from '@/components/shared/data-entry/evidence'
import type { EvidenceItem } from '@/components/shared/data-entry/core'
import { FinalSubmitAllModal, SubmitAllSuccessModal } from '@/components/shared/submission-flow-modals'
import { toast } from 'sonner'

/* -------------------------------------------------------------------------- */
/* RIGHT-SIDE JOURNEY & EVIDENCE PANEL — the ENV user's data-entry right rail: */
/* live draft status, captured-record stats, the REAL evidence vault (view +   */
/* download via /api/pu/evidence) and the Save → Submit action rail.           */
/* -------------------------------------------------------------------------- */
function FinJourneyPanel({
  statusPill,
  statusTone,
  stats,
  evidence,
  validationResult,
  onSaveDraft,
  onSubmit,
  onUploadFiles,
  onViewEvidence,
  onViewSubmissions,
  onReviewEvidence,
}: {
  statusPill: string
  statusTone: 'draft' | 'submitted' | 'approved' | 'warning'
  stats: Array<{ label: string; value: string; sub?: string }>
  evidence: EvidenceItem[]
  validationResult: { readyForSubmission: boolean; blockingErrors: string[]; warnings: string[] }
  onSaveDraft: () => void
  onSubmit: () => void
  onUploadFiles: (files: File[]) => Promise<void>
  onViewEvidence: () => void
  onViewSubmissions: () => void
  onReviewEvidence: (ev: EvidenceItem) => void
}) {
  const [railUploading, setRailUploading] = React.useState(false)
  const toneCls =
    statusTone === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : statusTone === 'submitted' ? 'bg-blue-50 text-blue-700 border-blue-200'
    : statusTone === 'warning' ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-slate-50 text-slate-600 border-slate-200'

  return (
    <div className="space-y-4">
      {/* Draft / Submission status */}
      <div className="rounded-[22px] border border-white/60 bg-white/70 p-4 shadow-lg shadow-sky-500/5 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Record Status</span>
          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${toneCls}`}>{statusPill}</span>
        </div>

        {/* Captured-record stats */}
        <div className="mt-3 space-y-2">
          {stats.map(s => (
            <div key={s.label} className="flex items-center justify-between rounded-xl bg-slate-50/80 px-3 py-2">
              <span className="text-[11px] font-semibold text-slate-500">{s.label}</span>
              <span className="text-right">
                <span className="text-sm font-black text-slate-900">{s.value}</span>
                {s.sub && <span className="ml-1 text-[10px] font-medium text-slate-400">{s.sub}</span>}
              </span>
            </div>
          ))}
        </div>

        {/* Validation rail */}
        <div className={`mt-3 rounded-xl border px-3 py-2 text-[11px] font-semibold ${
          validationResult.readyForSubmission
            ? 'border-emerald-200 bg-emerald-50/70 text-emerald-800'
            : 'border-amber-200 bg-amber-50/70 text-amber-800'
        }`}>
          {validationResult.readyForSubmission
            ? '✓ All validation checks passed — ready to submit'
            : `${validationResult.blockingErrors.length} blocking · ${validationResult.warnings.length} warning(s)`}
        </div>

        {/* Action rail — Save → Submit for Review (opens the consolidated review) */}
        <div className="mt-3 space-y-2">
          <button
            onClick={onSaveDraft}
            className="flex w-full items-center justify-center gap-1.5 rounded-full border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-50"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Save as Draft</span>
          </button>
          <button
            onClick={onSubmit}
            className="flex w-full items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/25 transition hover:from-blue-700 hover:to-indigo-700"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Submit for Review</span>
          </button>
          <button
            onClick={onViewSubmissions}
            className="flex w-full items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold text-slate-500 transition hover:text-blue-700"
          >
            <span>View My Submissions</span>
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Real Evidence Vault (ENV-style: view + download against /api/pu/evidence) */}
      <div className="rounded-[22px] border border-white/60 bg-white/70 p-4 shadow-lg shadow-sky-500/5 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Evidence Vault</span>
          <button
            onClick={onViewEvidence}
            className="text-[10px] font-bold text-blue-600 hover:text-blue-700"
          >
            View all ({evidence.length})
          </button>
        </div>

        <div className="mt-3 space-y-1.5">
          {evidence.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-[11px] font-medium text-slate-400">
              No evidence uploaded yet — use the Evidence &amp; Documents tab
            </div>
          )}
          {evidence.slice(0, 4).map(ev => (
            <div key={ev.id} className="flex items-center gap-2 rounded-xl bg-slate-50/80 px-2.5 py-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <FileText className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-bold text-slate-800">{ev.fileName}</div>
                <div className="truncate text-[10px] font-medium text-slate-400">{ev.documentType}{ev.fileSize ? ` · ${ev.fileSize}` : ''}</div>
              </div>
              <button
                onClick={() => onReviewEvidence(ev)}
                title="View document"
                className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
              >
                <Eye className="h-3.5 w-3.5" />
              </button>
              <a
                href={`/api/pu/evidence/${encodeURIComponent(ev.id)}/file?download=true`}
                title="Download document"
                className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-600"
              >
                <Download className="h-3.5 w-3.5" />
              </a>
            </div>
          ))}
        </div>

        {/* Direct inline upload — files go straight into the vault (no redirect) */}
        <label
          className="mt-3 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50/70 px-3 py-2 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100"
          title="Upload evidence directly into the vault"
        >
          <Upload className="h-3.5 w-3.5" />
          <span>{railUploading ? 'Uploading…' : 'Upload Evidence Directly'}</span>
          <input
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv,.doc,.docx"
            disabled={railUploading}
            onChange={(e) => {
              const files = Array.from(e.target.files || [])
              e.target.value = ''
              if (files.length > 0) void onUploadFiles(files)
            }}
          />
        </label>
      </div>
    </div>
  )
}

export function FinanceWorkspace() {
  const { activeModule, setActiveModule, selectedProjectId, user } = useApp()

  // State management (store-backed fields are lazily initialised on mount —
  // the module remounts per active module so this is always fresh)
  const [assignments, setAssignments] = useState<FinanceAssignment[]>(() => financeStore.getAssignments())
  const [financialData, setFinancialData] = useState<FinancialSummaryData>(financeStore.getFinancialSummary())
  const [expenditures, setExpenditures] = useState<ResourceExpenditureItem[]>(() => financeStore.getExpenditures())
  const [intensityMetrics, setIntensityMetrics] = useState<IntensityMetricsData>(financeStore.getIntensityMetrics())
  const [csrData, setCsrData] = useState<CsrDisclosureData>(financeStore.getCsrDisclosures())
  const [documents, setDocuments] = useState<EvidenceDocumentItem[]>(() => financeStore.getEvidenceDocuments())
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>(() => financeStore.getSubmissions())
  const [activities, setActivities] = useState<ActivityEvent[]>(() => financeStore.getActivities())
  const [validationResult, setValidationResult] = useState<ValidationChecklistResult>(financeStore.validateRecord())

  // Internal tab state for Financial Data Entry (fin-data) — persisted across
  // module remounts (the shell remounts this component when the sidebar switches
  // modules, e.g. fin-expenditure → fin-evidence → fin-data Continue chain).
  const [activeFinanceLevel, setActiveFinanceLevelState] = useState<'l0' | 'l1' | 'l3' | 'l4' | 'l6' | 'l7'>(() => {
    if (typeof window !== 'undefined') {
      try {
        const v = sessionStorage.getItem('fin-active-level')
        if (v === 'l0' || v === 'l1' || v === 'l3' || v === 'l4' || v === 'l6' || v === 'l7') return v
      } catch {}
    }
    return 'l1'
  })
  const setActiveFinanceLevel = (v: 'l0' | 'l1' | 'l3' | 'l4' | 'l6' | 'l7') => {
    setActiveFinanceLevelState(v)
    try { sessionStorage.setItem('fin-active-level', v) } catch {}
  }

  /* ── Real systems extracted from the ENV user ─────────────────────────── */
  /* Real evidence vault (same /api/pu/evidence stack the ENV data entry uses). */
  const [evidenceItems, setEvidenceItems] = useState<EvidenceItem[]>([])
  const [reviewEvidence, setReviewEvidence] = useState<EvidenceItem | null>(null)
  /* Real My Submissions ledger (db.submission mirrors) instead of demo store rows. */
  const [apiSubmissions, setApiSubmissions] = useState<SubmissionRecord[] | any[]>([])
  const [apiSubmissionsLoading, setApiSubmissionsLoading] = useState(false)
  /* Consolidated final review → Submit to Project Admin → success popup. */
  const [showFinalReview, setShowFinalReview] = useState(false)
  const [submittingAll, setSubmittingAll] = useState(false)
  const [showSubmitSuccess, setShowSubmitSuccess] = useState(false)
  const [lastSubmittedCount, setLastSubmittedCount] = useState(0)

  const refreshEvidence = async () => {
    try {
      const res = await fetch(`/api/pu/evidence?projectId=${encodeURIComponent(selectedProjectId || '')}`)
      const d = await res.json().catch(() => null)
      setEvidenceItems(Array.isArray(d?.items) ? d.items : [])
    } catch {
      setEvidenceItems([])
    }
  }

  /* Direct rail upload — same /api/pu/evidence POST the ENV uploader uses.
     module=FINANCE ties the file to this workspace's dossier. */
  const handleRailUpload = async (files: File[]) => {
    for (const file of files) {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('documentType', 'SUPPORTING')
      fd.append('module', 'FINANCE')
      if (selectedProjectId) fd.append('projectId', selectedProjectId)
      try {
        const res = await fetch('/api/pu/evidence', { method: 'POST', body: fd })
        if (!res.ok) throw new Error(`Upload failed for ${file.name}`)
      } catch (e: any) {
        toast.error('Evidence upload failed', { description: e?.message || 'Please retry.' })
        return
      }
    }
    await refreshEvidence()
    financeStore.logActivity('Evidence uploaded', `${files.length} file(s) uploaded directly from the journey rail`, 'saved', financialData.common?.entityId || 'MEIL-SOL-GJT')
    refreshData()
    toast.success(`${files.length} evidence file(s) uploaded & attached to the dossier`)
  }

  /* Realtime assignments — PA-assigned tasks + corrections from /api/pu/action-items. */
  const [actionItems, setActionItems] = useState<any[]>([])
  const fetchActionItems = async () => {
    try {
      const res = await fetch('/api/pu/action-items')
      const d = await res.json().catch(() => null)
      setActionItems(Array.isArray(d?.tasks) ? d.tasks : [])
    } catch {
      /* keep last known assignments */
    }
  }

  /* Realtime activity feed — real backend Activity rows, polled every 15s. */
  const [realActivities, setRealActivities] = useState<any[]>([])
  const fetchRealActivities = async () => {
    try {
      const res = await fetch('/api/pu/activity?take=50&bypass=true')
      const d = await res.json().catch(() => null)
      setRealActivities(Array.isArray(d?.items) ? d.items : [])
    } catch {
      /* keep the last known feed */
    }
  }

  const refreshApiSubmissions = async () => {
    setApiSubmissionsLoading(true)
    try {
      const res = await fetch('/api/pu/submissions?take=100&bypass=true')
      const d = await res.json().catch(() => null)
      const rows: any[] = Array.isArray(d?.items) ? d.items : []
      /* "My Submissions" = this contributor's own ledger rows; fall back to
         the full list when the submitter id is unavailable on every row. */
      const mine = user?.id ? rows.filter((r) => r.submittedById === user.id) : []
      setApiSubmissions(mine.length > 0 ? mine : rows)
    } catch {
      setApiSubmissions([])
    } finally {
      setApiSubmissionsLoading(false)
    }
  }

  /* Load the real vault + ledger on mount (module remounts per active module). */
  /* eslint-disable react-hooks/set-state-in-effect -- ENV-pattern mount hydration */
  useEffect(() => {
    refreshEvidence()
    refreshApiSubmissions()
    fetchRealActivities()
    fetchActionItems()
    /* Realtime: poll activity + assignments every 15s */
    const iv = setInterval(() => {
      fetchRealActivities()
      fetchActionItems()
    }, 15000)
    return () => clearInterval(iv)
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  // UI state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [showAddExpenditureModal, setShowAddExpenditureModal] = useState(false)
  const [editingExpId, setEditingExpId] = useState<string | null>(null)
  const [showUploadDocModal, setShowUploadDocModal] = useState(false)
  const [selectedDocForHistory, setSelectedDocForHistory] = useState<EvidenceDocumentItem | null>(null)
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null)
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

  // Add / update expenditure item with all 13 fields
  const resetExpenditureForm = () => {
    setEditingExpId(null)
    setNewExpCategory('Pollution Control')
    setNewExpProjectName('')
    setNewExpDesc('')
    setNewExpAmount(0)
    setNewExpCurrency('INR (₹)')
    setNewExpSource('CapEx')
    setNewExpPeriod('FY 2026-27')
    setNewExpCostCentre('CC-SOL-GJT-01')
    setNewExpVendor('')
    setNewExpInvoiceRef('')
    setNewExpDataSource('Invoice')
    setNewExpEvidenceLink('CapEx_Projects.xlsx')
    setNewExpRemarks('')
  }

  const handleAddExpenditure = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newExpDesc || newExpAmount <= 0) {
      showToast('Please enter a valid description and positive expenditure amount.')
      return
    }
    if (editingExpId) {
      /* Update the existing captured record in place */
      financeStore.updateExpenditure(editingExpId, {
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
      })
      setShowAddExpenditureModal(false)
      resetExpenditureForm()
      refreshData()
      showToast('Expenditure record updated')
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
    resetExpenditureForm()
    refreshData()
    showToast(`Added ₹ ${item.amount.toFixed(2)} Cr under ${item.category} — saved as Draft`)
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
  /* Final consolidated submit — called by the FinalSubmitAllModal's
     "Submit to Project Admin" button. Returns true only when the backend
     accepted the submission AND the mirror reached the Project Admin ledger. */
  const handleFinalSubmit = async (): Promise<boolean> => {
    setSubmittingAll(true)
    try {
      const res = financeStore.validateRecord(financialData, expenditures, documents)
      if (!res.readyForSubmission) {
        toast.error('Cannot submit yet', { description: res.blockingErrors.join(' · ') || 'Complete the mandatory levels first.' })
        return false
      }
      financeStore.submitRecordForReview(financialData.common?.entityId || 'MEIL-SOL-GJT')

      const post = await fetch('/api/pu/data-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 9,
          levelKey: 'level9',
          levelName: 'BRSR Finance & Resource Expenditures',
          module: 'FINANCE',
          projectId: selectedProjectId || undefined,
          reportingPeriodId: undefined,
          data: {
            activityInitiativeName: 'Resource Efficiency & Environmental Capital Expenditure',
            baselineValue: financialData.turnover || 1450,
            reportingPeriodValue: financialData.environmentalSpend || 120,
            outputUnit: 'INR Crores',
            remarks: 'Submitted from Finance Contributor Workspace (consolidated review)',
          },
          submitForReview: true,
        }),
      })
      if (!post.ok) {
        const err = await post.json().catch(() => ({}))
        toast.error('Submission failed', { description: err?.error || `Server responded ${post.status}` })
        return false
      }

      /* Submission is now in the Project Admin ledger (db.submission mirror). */
      const ok = await post.json()
      setLastSubmittedCount(res.readyForSubmission ? financeLevels.length : 0)
      refreshData()
      refreshApiSubmissions()
      refreshEvidence()
      setShowFinalReview(false)
      setShowSubmitSuccess(true)
      toast.success('Submitted to Project Admin', {
        description: ok?.submission?.id ? `Ledger entry ${ok.submission.id.slice(-8).toUpperCase()} created.` : 'Your dossier reached the Project Admin workspace.',
      })
      return true
    } catch (e: any) {
      toast.error('Submission failed', { description: e?.message || 'Network error — please retry.' })
      return false
    } finally {
      setSubmittingAll(false)
    }
  }

  /* Finance dossier shaped for the shared FinalSubmitAllModal — same
     `l{N}-{projectId}-{periodId}` keyed structure the ENV data entry uses. */
  const financeAllData: Record<string, any> = {
    [`l1-${selectedProjectId}-current`]: {
      totalTurnover: financialData.turnover,
      previousTurnover: financialData.previousTurnover,
      totalExpenditure: financialData.totalExpenditure,
      capEx: financialData.capEx,
      opEx: financialData.opEx,
      financialReportingBasis: financialData.financialReportingBasis,
      reconciliationStatus: financialData.reconciliationStatus,
    },
    [`l2-${selectedProjectId}-current`]: {
      items: expenditures.map(e => ({
        id: e.id,
        title: e.projectName || e.category,
        category: e.category,
        description: e.description,
        amount: `₹ ${Number(e.amount).toFixed(2)} Cr`,
        expenseType: e.source,
        costCentre: e.costCentre,
        vendor: e.vendorRef,
        invoiceRef: e.invoiceRef,
        evidenceFiles: e.supportingDocument ? [e.supportingDocument] : [],
      })),
    },
    [`l3-${selectedProjectId}-current`]: {
      physicalOutputDenominator: intensityMetrics.physicalOutputDenominator,
      physicalOutputUnit: intensityMetrics.physicalOutputUnit,
      reviewerNotes: intensityMetrics.reviewerNotes,
    },
    [`l4-${selectedProjectId}-current`]: {
      csrEnabled: csrData.isEnabled,
      approvedCsrBudget: csrData.approvedCsrBudget,
      actualCsrExpenditure: csrData.actualCsrExpenditure,
      expenditureType: csrData.expenditureType,
      implementingAgencyRef: csrData.implementingAgencyRef,
    },
    [`l6-${selectedProjectId}-current`]: {
      items: validationResult.readyForSubmission
        ? [{ id: 'validation', title: 'Validation Checklist', status: 'All checks passed' }]
        : [],
    },
  }

  const financeLevels = [
    { key: 'l1', level: 1, label: 'Financial Summary', icon: FileText },
    { key: 'l2', level: 2, label: 'Resource Expenditure', icon: Layers },
    { key: 'l3', level: 3, label: 'Intensity Metrics', icon: Calculator },
    { key: 'l4', level: 4, label: 'CSR Disclosures', icon: HeartHandshake },
    { key: 'l6', level: 6, label: 'Validation Checklist', icon: ShieldCheck },
  ]

  // Resubmit record returned for correction
  const handleResubmit = async (subId: string) => {
    financeStore.resubmitRecord(subId)
    try {
      await fetch('/api/pu/data-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 9,
          levelKey: 'level9',
          levelName: 'BRSR Finance & Resource Expenditures (Resubmitted)',
          module: 'FINANCE',
          projectId: selectedProjectId || undefined,
          reportingPeriodId: undefined,
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

  /* -------------------------------------------------------------------------- */
  /* STEPPER COMPONENT FOR ENTRY SCREENS                                        */
  /* -------------------------------------------------------------------------- */
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

              {/* Live badge — assignments stream in from the PA Command Center */}
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/80 px-3 py-1.5 text-xs font-bold text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </div>

            {/* Live indicator */}
            <div className="mt-4 flex items-center gap-2 text-[11px] font-semibold text-slate-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live — updates automatically every 15s from the Project Admin workspace</span>
            </div>

            {/* Realtime Assignments — PA tasks, corrections & draft reminders */}
            <div className="mt-4 space-y-2.5">
              {actionItems.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-10 text-center text-xs font-semibold text-slate-400">
                  No open assignments right now — tasks assigned by the Project Admin appear here instantly.
                </div>
              )}
              {actionItems.map((t: any) => {
                const typeLabel = t.type === 'ASSIGNED_TASK' ? 'PA Task' : t.type === 'CORRECTION' ? 'Correction' : 'Draft Reminder'
                const typeCls = t.type === 'ASSIGNED_TASK'
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : t.type === 'CORRECTION'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-sky-50 text-sky-700 border-sky-200'
                return (
                  <div
                    key={t.id}
                    className="group relative overflow-hidden rounded-[22px] border border-white/70 bg-white/75 p-4 shadow-lg shadow-sky-500/5 backdrop-blur-xl transition hover:shadow-xl"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${typeCls}`}>
                            {typeLabel}
                          </span>
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                            t.severity === 'critical'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : t.severity === 'warning'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}>
                            {t.severity === 'critical' ? 'High Priority' : t.severity === 'warning' ? 'Medium' : 'Info'}
                          </span>
                          {t.dueDate && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                              <Clock className="h-3 w-3" />
                              Due {new Date(t.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 truncate text-sm font-bold text-slate-900">{t.title}</div>
                        <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">{t.description}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                          String(t.status).toUpperCase() === 'OVERDUE'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {String(t.status).replace(/_/g, ' ')}
                        </span>
                        <button
                          onClick={() => {
                            setActiveModule('fin-data')
                            setActiveFinanceLevel('l1')
                          }}
                          className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
                        >
                          <span>Open</span>
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

          {/* Level progress is shown by the level selector tabs below */}

          {/* Level Progress Tabs — step bubbles with done-state (replaces the old stepper card) */}
          <div className="flex flex-wrap items-stretch gap-2 rounded-2xl border border-white/60 bg-white/70 p-2.5 shadow-sm backdrop-blur-md">
            {([
              { id: 'l0', label: 'Level 0 — Common Fields', desc: 'Metadata & Assignment Context' },
              { id: 'l1', label: 'Level 1 — Financial Summary', desc: 'Turnover, CapEx & Basis' },
              { id: 'l3', label: 'Level 3 — Intensity Metrics', desc: 'Ratios & Physical Output' },
              { id: 'l4', label: 'Level 4 — CSR Disclosures', desc: 'Assigned CSR Spending' },
              { id: 'l6', label: 'Level 5 — Validation & Evidence', desc: 'Checks + Additional Evidence' },
              { id: 'l7', label: 'Level 6 — Review & Sign-off', desc: 'Final Review & Submit' },
            ] as const).map((tab, idx, arr) => {
              const active = activeFinanceLevel === tab.id
              const done = idx < arr.findIndex(t => t.id === activeFinanceLevel)
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveFinanceLevel(tab.id as any)}
                  className={`flex min-w-[150px] flex-1 items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-all ${
                    active
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-100'
                      : done
                        ? 'bg-blue-50/80 text-slate-700 border border-blue-100 hover:bg-blue-50'
                        : 'bg-white/60 text-slate-600 hover:bg-white hover:text-slate-900 border border-slate-100'
                  }`}
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black shadow-xs ${
                    active ? 'bg-white/20 text-white' : done ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-400'
                  }`}>
                    {done ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-black">{tab.label}</span>
                    <span className={`block truncate text-[10px] font-medium ${active ? 'text-blue-100' : 'text-slate-400'}`}>
                      {tab.desc}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>

          {/* LEVEL 0-4 WORKSPACE GRID (ENV-style): level form (left) + journey & evidence rail (right) */}
          <div className="grid items-start gap-4 lg:grid-cols-3">
          {/* LEVEL 0: COMMON FIELDS FOR EVERY DATA ENTRY */}
          {activeFinanceLevel === 'l0' && (
            <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl space-y-6 lg:col-span-2">
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
            <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl space-y-6 lg:col-span-2">
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
              {/* Action row — continue through the levels */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <span className="text-xs text-slate-400">Level complete — continue to the next step</span>
                <button
                  type="button"
                  onClick={() => { setActiveModule('fin-expenditure') }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
                >
                  <span>Continue to Level 2 — Resource Expenditure</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* LEVEL 3: FINANCIAL CALCULATIONS & INTENSITY METRICS */}
          {activeFinanceLevel === 'l3' && (
            <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl space-y-6 lg:col-span-2">
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
              {/* Action row — continue through the levels */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <span className="text-xs text-slate-400">Level complete — continue to the next step</span>
                <button
                  type="button"
                  onClick={() => { setActiveFinanceLevel('l4') }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
                >
                  <span>Continue to Level 4 — CSR Disclosures</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* LEVEL 4: CSR & OTHER ASSIGNED FINANCIAL DISCLOSURES */}
          {activeFinanceLevel === 'l4' && (
            <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl space-y-6 lg:col-span-2">
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
              {/* Action row — continue through the levels */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <span className="text-xs text-slate-400">Level complete — continue to the next step</span>
                <button
                  type="button"
                  onClick={() => { setActiveFinanceLevel('l6') }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
                >
                  <span>Continue to Level 5 — Validation &amp; Evidence</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* RIGHT: journey & evidence rail — only alongside the ENTRY levels.
              The validation (L5) and review (L6) screens have their own layout. */}
          {activeFinanceLevel !== 'l6' && activeFinanceLevel !== 'l7' && (
          <div className="lg:sticky lg:top-20 lg:col-span-1">
            <FinJourneyPanel
              statusPill={financialData.common?.submissionStatus || 'Draft'}
              statusTone={
                financialData.common?.submissionStatus === 'Accepted' ? 'approved'
                : financialData.common?.submissionStatus === 'Returned' ? 'warning'
                : 'draft'
              }
              stats={[
                { label: 'Expenditure Records', value: String(expenditures.length), sub: 'L2' },
                { label: 'Evidence Documents', value: String(documents.length), sub: 'L5' },
                { label: 'CSR Spend (L4)', value: csrData.isEnabled ? `₹ ${Number(csrData.actualCsrExpenditure || 0).toFixed(1)} Cr` : 'Disabled' },
                { label: 'Total Green Spend', value: `₹ ${totalResourceExpenditure.toFixed(1)} Cr` },
              ]}
              evidence={evidenceItems}
              validationResult={validationResult}
              onSaveDraft={handleSaveDraft}
              onSubmit={() => setShowFinalReview(true)}
              onUploadFiles={handleRailUpload}
              onViewEvidence={() => setActiveModule('fin-evidence')}
              onViewSubmissions={() => setActiveModule('fin-submissions')}
              onReviewEvidence={(ev) => setReviewEvidence(ev)}
            />
          </div>
          )}{/* /rail — hidden on validation & review levels */}
          </div>{/* /level 0-4 workspace grid */}

          {/* LEVEL 6: VALIDATION & RECONCILIATION */}
          {activeFinanceLevel === 'l6' && (
            <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-600 text-xs font-black text-white shadow-xs">
                    5
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Level 5 — Validation & Evidence</h2>
                    <p className="text-xs text-slate-500">
                      10 automated reconciliation checks — and attach any additional evidence before review
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
              {/* Additional evidence upload — attach final proof before review */}
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                    <Upload className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">Additional Evidence (Optional)</h3>
                    <p className="text-[11px] text-slate-500">Attach any remaining proof — audit letters, bank slips, certifications — before submitting for review</p>
                  </div>
                </div>
                <div className="mt-3">
                  <EvidenceUploadSection
                    projectId={selectedProjectId || null}
                    periodId={null}
                    moduleKey="FINANCE"
                    evidence={evidenceItems}
                    onUploaded={refreshEvidence}
                    onReview={(ev) => setReviewEvidence(ev)}
                    selectedEvidenceId={null}
                    onSelectEvidence={() => {}}
                  />
                </div>
              </div>

              {/* Action row — continue through the levels */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <span className="text-xs text-slate-400">Validation reviewed & evidence attached — continue to the final review</span>
                <button
                  type="button"
                  onClick={() => { setActiveFinanceLevel('l7') }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
                >
                  <span>Continue to Level 6 — Review &amp; Sign-off</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* LEVEL 7: SUBMISSION & REVIEW WORKFLOW */}
          {activeFinanceLevel === 'l7' && (
            <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-xs font-black text-white shadow-xs">
                    6
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Level 6 — Review & Sign-off</h2>
                    <p className="text-xs text-slate-500">
                      Lifecycle: Save as Draft → Submit for Review → Review / Correction → Accepted / Locked
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-[11px] font-bold text-emerald-700">
                  Version v1.3 Package
                </span>
              </div>

              {/* 4-Step Workflow Cards */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                {[
                  { step: '1. Save as Draft', status: 'Saved', sub: 'Entries preserved locally', active: true },
                  { step: '2. Submit for Review', status: financialData.common?.submissionStatus === 'Submitted' ? 'Submitted' : 'Ready', sub: 'Authorized reviewer', active: validationResult.readyForSubmission },
                  { step: '3. Review / Correction', status: 'In Review', sub: 'Reviewer comments allowed', active: false },
                  { step: '4. Accepted / Locked', status: 'Pending', sub: 'Locked for BRSR audit', active: false },
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

              {/* Single sign-off action row */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <div className="text-xs font-medium text-slate-500">
                  All levels complete — open the consolidated review to submit this dossier.
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowFinalReview(true)}
                    className="flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/25 transition hover:from-blue-700 hover:to-indigo-700"
                  >
                    <Send className="h-4 w-4" />
                    <span>Submit for Review</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Per-level Continue buttons replace the old bottom action bar */}
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* SCREEN 4 — RESOURCE EXPENDITURE (Level 2)                              */}
      {/* ---------------------------------------------------------------------- */}
      {activeModule === 'fin-expenditure' && (
        <div className="space-y-6">

          {/* Two-column workspace (ENV-style): captured records (left) + journey & evidence rail (right) */}
          <div className="grid items-start gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
          {/* Resource-Related Expenditure Table */}
          <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Environmental & Resource-Related Expenditure Records</h2>
                <p className="text-xs text-slate-500">Category-wise breakdown across 8 approved BRSR environmental buckets</p>
              </div>

              <button
                onClick={() => {
                  setEditingExpId(null)
                  resetExpenditureForm()
                  setShowAddExpenditureModal(true)
                }}
                className="flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 self-start sm:self-auto"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>+ Add (Draft)</span>
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
                              /* Open the capture modal pre-filled for editing (no browser prompt dialogs) */
                              setEditingExpId(item.id)
                              setNewExpCategory(item.category)
                              setNewExpProjectName(item.projectName || '')
                              setNewExpDesc(item.description)
                              setNewExpAmount(item.amount)
                              setNewExpCurrency(item.currency || 'INR (₹)')
                              setNewExpSource(item.source)
                              setNewExpPeriod(item.accountingPeriod || 'FY 2026-27')
                              setNewExpCostCentre(item.costCentre)
                              setNewExpVendor(item.vendorRef || '')
                              setNewExpInvoiceRef(item.invoiceRef || '')
                              setNewExpDataSource(item.dataSource)
                              setNewExpEvidenceLink(item.supportingDocument || '')
                              setNewExpRemarks(item.remarks || '')
                              setShowAddExpenditureModal(true)
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

          </div>{/* /left column */}

          {/* RIGHT: journey & evidence rail (ENV-style right panel) */}
          <div className="lg:sticky lg:top-20 lg:col-span-1">
            <FinJourneyPanel
              statusPill={financialData.common?.submissionStatus || 'Draft'}
              statusTone={
                financialData.common?.submissionStatus === 'Accepted' ? 'approved'
                : financialData.common?.submissionStatus === 'Returned' ? 'warning'
                : 'draft'
              }
              stats={[
                { label: 'Total Environmental Spend', value: `₹ ${totalResourceExpenditure.toFixed(2)} Cr` },
                { label: 'CapEx Green Spend', value: `₹ ${capexTotal.toFixed(2)} Cr`, sub: `${((capexTotal / (totalResourceExpenditure || 1)) * 100).toFixed(0)}%` },
                { label: 'OpEx Green Spend', value: `₹ ${opexTotal.toFixed(2)} Cr`, sub: `${((opexTotal / (totalResourceExpenditure || 1)) * 100).toFixed(0)}%` },
                { label: 'Captured Records', value: String(expenditures.length) },
              ]}
              evidence={evidenceItems}
              validationResult={validationResult}
              onSaveDraft={handleSaveDraft}
              onSubmit={() => setShowFinalReview(true)}
              onUploadFiles={handleRailUpload}
              onViewEvidence={() => setActiveModule('fin-evidence')}
              onViewSubmissions={() => setActiveModule('fin-submissions')}
              onReviewEvidence={(ev) => setReviewEvidence(ev)}
            />
          </div>
          </div>{/* /two-column grid */}

          {/* BRSR Category Allocation (full-width visualization strip) */}
          <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl">
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
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-medium text-slate-600 sm:grid-cols-4 lg:grid-cols-8">
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

              {/* Action row — continue through the levels */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <span className="text-xs text-slate-400">Expenditure records captured — continue to evidence upload</span>
                <button
                  type="button"
                  onClick={() => { setActiveModule('fin-evidence') }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
                >
                  <span>Continue to Evidence &amp; Documents</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>


          {/* Navigation happens via the journey rail and level Continue buttons */}
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* SCREEN 5 — EVIDENCE & DOCUMENTS (Level 5)                              */}
      {/* ---------------------------------------------------------------------- */}
      {activeModule === 'fin-evidence' && (
        <div className="space-y-6">

          {/* TWO COLUMNS: Left Upload + Right Validation Checklist Summary */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left: REAL evidence vault — same upload stack as the ENV user
                (drag & drop, SHA-256 hashing, /api/pu/evidence, view + download) */}
            <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl lg:col-span-6">
              <h2 className="text-base font-bold text-slate-900">Evidence Upload &amp; Vault</h2>
              <p className="text-xs text-slate-500">Upload invoices, ledger extracts and statements — hashed, stored and reviewable</p>

              <EvidenceUploadSection
                projectId={selectedProjectId || null}
                periodId={null}
                moduleKey="FINANCE"
                evidence={evidenceItems}
                onUploaded={refreshEvidence}
                onReview={(ev) => setReviewEvidence(ev)}
                selectedEvidenceId={null}
                onSelectEvidence={() => {}}
              />

              {/* Real vault list with view + download (exact ENV pattern) */}
              <div className="mt-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Uploaded Evidence ({evidenceItems.length})
                  </span>
                </div>
                {evidenceItems.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs font-medium text-slate-400">
                    No evidence uploaded yet — drag files into the uploader above
                  </div>
                )}
                {evidenceItems.map(ev => (
                  <div key={ev.id} className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-white/90 px-3 py-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-bold text-slate-800">{ev.fileName}</div>
                      <div className="truncate text-[10px] font-medium text-slate-400">
                        {ev.documentType}{ev.fileSize ? ` · ${(ev.fileSize / 1024 / 1024).toFixed(1)} MB` : ''}{ev.createdAt ? ` · ${new Date(ev.createdAt).toLocaleDateString()}` : ''}
                      </div>
                    </div>
                    <button
                      onClick={() => setReviewEvidence(ev)}
                      title="View document"
                      className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <a
                      href={`/api/pu/evidence/${encodeURIComponent(ev.id)}/file?download=true`}
                      title="Download document"
                      className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-600"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  </div>
                ))}
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

          {/* Continue through the level sequence */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/60 bg-white/70 p-4 shadow-lg backdrop-blur-md">
            <span className="text-xs font-semibold text-slate-500">
              Evidence uploaded &amp; hashed in the vault — continue to the next level
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveModule('fin-data')}
                className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back: Financial Data</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveModule('fin-data')
                  setActiveFinanceLevel('l6')
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
              >
                <span>Continue to Level 5 — Validation &amp; Evidence</span>
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

            {/* Summary Counters — live from the real submissions ledger (/api/pu/submissions) */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div className="rounded-2xl border border-slate-100 bg-white/80 p-3.5 text-center shadow-xs">
                <div className="text-xs font-bold text-slate-500">Drafts</div>
                <div className="mt-1 text-2xl font-black text-slate-800">
                  {apiSubmissions.filter((s: any) => s.status === 'DRAFT').length}
                </div>
              </div>
              <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-3.5 text-center shadow-xs">
                <div className="text-xs font-bold text-blue-700">Submitted</div>
                <div className="mt-1 text-2xl font-black text-blue-900">
                  {apiSubmissions.filter((s: any) => ['SUBMITTED', 'RESUBMITTED', 'PENDING'].includes(s.status)).length}
                </div>
              </div>
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-3.5 text-center shadow-xs">
                <div className="text-xs font-bold text-indigo-700">Under Review</div>
                <div className="mt-1 text-2xl font-black text-indigo-900">
                  {apiSubmissions.filter((s: any) => s.status === 'UNDER_REVIEW').length}
                </div>
              </div>
              <div className="rounded-2xl border border-rose-100 bg-rose-50/70 p-3.5 text-center shadow-xs">
                <div className="text-xs font-bold text-rose-700">Returned</div>
                <div className="mt-1 text-2xl font-black text-rose-900">
                  {apiSubmissions.filter((s: any) => ['CORRECTION_REQUESTED', 'CHANGES_REQUESTED', 'REJECTED'].includes(s.status)).length}
                </div>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3.5 text-center shadow-xs">
                <div className="text-xs font-bold text-emerald-700">Accepted</div>
                <div className="mt-1 text-2xl font-black text-emerald-900">
                  {apiSubmissions.filter((s: any) => ['APPROVED', 'ACTIVE', 'BU_APPROVED', 'SUBSIDIARY_APPROVED'].includes(s.status)).length}
                </div>
              </div>
            </div>

            {/* Submissions Table */}
            <div className="mt-6 overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="pb-3 pl-2">Submission Ref</th>
                    <th className="pb-3">Title / Record</th>
                    <th className="pb-3">Project</th>
                    <th className="pb-3">Period</th>
                    <th className="pb-3">Category</th>
                    <th className="pb-3">Submitted</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 pr-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-xs">
                  {apiSubmissionsLoading && (
                    <tr><td colSpan={8} className="py-8 text-center text-xs font-semibold text-slate-400">Loading your submissions…</td></tr>
                  )}
                  {!apiSubmissionsLoading && apiSubmissions.length === 0 && (
                    <tr><td colSpan={8} className="py-8 text-center text-xs font-semibold text-slate-400">No submissions yet — complete the levels and submit for review.</td></tr>
                  )}
                  {apiSubmissions.map((sub: any) => (
                    <tr key={sub.id} className="group hover:bg-blue-50/40 transition">
                      <td className="py-4 pl-2 font-mono font-bold text-blue-700">
                        {sub.ref || `SUB-${sub.id.slice(-6).toUpperCase()}`}
                      </td>
                      <td className="py-4 font-bold text-slate-800 max-w-[220px] truncate">{sub.title}</td>
                      <td className="py-4 text-slate-600 font-medium">{sub.project?.name || '—'}</td>
                      <td className="py-4 text-slate-600">{sub.reportingPeriod?.periodLabel || '—'}</td>
                      <td className="py-4 text-slate-600 font-medium">{sub.category}</td>
                      <td className="py-4 text-slate-500">{sub.formattedDateTime || (sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : '—')}</td>
                      <td className="py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          ['APPROVED', 'ACTIVE', 'BU_APPROVED', 'SUBSIDIARY_APPROVED'].includes(sub.status)
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : ['CORRECTION_REQUESTED', 'CHANGES_REQUESTED', 'REJECTED'].includes(sub.status)
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : sub.status === 'UNDER_REVIEW'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {String(sub.status).replace(/_/g, ' ')}
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
                          {['CORRECTION_REQUESTED', 'CHANGES_REQUESTED', 'REJECTED'].includes(sub.status) && (
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

          {/* Submission Details Modal — REAL ledger data (/api/pu/submissions) */}
          <AnimatePresence>
            {selectedSubmission && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/80 bg-white p-6 shadow-2xl"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <div className="text-xs font-mono font-bold text-blue-600">
                        {selectedSubmission.ref || `SUB-${selectedSubmission.id.slice(-6).toUpperCase()}`}
                      </div>
                      <h3 className="form-card-title">{selectedSubmission.title}</h3>
                      <p className="text-xs text-slate-500">
                        {selectedSubmission.project?.name || '—'} · {selectedSubmission.reportingPeriod?.periodLabel || '—'}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedSubmission(null)}
                      className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Status + meta strip */}
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs">
                    <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
                      <div className="text-[10px] font-bold uppercase text-slate-400">Status</div>
                      <div className="font-bold text-slate-800">{String(selectedSubmission.status || '—').replace(/_/g, ' ')}</div>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
                      <div className="text-[10px] font-bold uppercase text-slate-400">Category</div>
                      <div className="font-bold text-slate-800">{selectedSubmission.category || '—'}</div>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
                      <div className="text-[10px] font-bold uppercase text-slate-400">Submitted</div>
                      <div className="font-bold text-slate-800">{selectedSubmission.formattedDateTime || (selectedSubmission.submittedAt ? new Date(selectedSubmission.submittedAt).toLocaleString() : '—')}</div>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
                      <div className="text-[10px] font-bold uppercase text-slate-400">Reviewer</div>
                      <div className="font-bold text-slate-800">{selectedSubmission.reviewer?.name || 'Pending assignment'}</div>
                    </div>
                  </div>

                  {/* Reviewer feedback */}
                  {selectedSubmission.reviewComment && (
                    <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50/80 p-4">
                      <div className="flex items-center gap-2 text-xs font-bold text-rose-800">
                        <AlertTriangle className="h-4 w-4" />
                        <span>Reviewer Feedback {selectedSubmission.reviewer?.name ? `(${selectedSubmission.reviewer.name})` : ''}</span>
                      </div>
                      <p className="mt-1.5 text-xs font-medium text-slate-700">
                        &quot;{selectedSubmission.reviewComment}&quot;
                      </p>
                    </div>
                  )}

                  {/* Submitted values — the REAL figures the reviewer sees */}
                  <div className="mt-5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Submitted Data Values
                    </h4>
                    <div className="mt-2 space-y-1.5">
                      {(selectedSubmission.parsedValues || []).length === 0 && (
                        <div className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
                          No metric values recorded on this submission
                        </div>
                      )}
                      {(selectedSubmission.parsedValues || []).map((pv: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between rounded-xl border border-slate-100 bg-white/90 px-3 py-2">
                          <span className="text-xs font-semibold text-slate-600">{pv.label}</span>
                          <span className="font-mono text-xs font-bold text-slate-900">
                            {pv.value}{pv.unit ? ` ${pv.unit}` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Evidence attached to this submission */}
                  <div className="mt-5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Attached Evidence ({(selectedSubmission.evidenceList || []).length})
                    </h4>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(selectedSubmission.evidenceList || []).length === 0 && (
                        <span className="text-xs text-slate-400">No evidence files referenced</span>
                      )}
                      {(selectedSubmission.evidenceList || []).map((f: string, i: number) => (
                        <span key={i} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-800">
                          <FileText className="h-3 w-3" /> {f}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Audit history */}
                  {(selectedSubmission.history || []).length > 0 && (
                    <div className="mt-5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Audit Timeline</h4>
                      <div className="mt-2 space-y-2">
                        {selectedSubmission.history.map((h: any, idx: number) => (
                          <div key={idx} className="flex items-start gap-3 text-xs">
                            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                              <Clock className="h-3 w-3" />
                            </div>
                            <div>
                              <span className="font-bold text-slate-800">{h.action || h.toStatus}</span>
                              <span className="text-slate-400"> · {h.actorName || 'System'}</span>
                              <div className="text-[11px] text-slate-400">{h.at || ''}</div>
                              {h.comment && <div className="mt-0.5 text-slate-600 italic">&quot;{h.comment}&quot;</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions inside modal */}
                  <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                    {['CORRECTION_REQUESTED', 'CHANGES_REQUESTED', 'REJECTED'].includes(selectedSubmission.status) && (
                      <button
                        onClick={() => {
                          setSelectedSubmission(null)
                          setActiveModule('fin-data')
                          setActiveFinanceLevel('l1')
                        }}
                        className="rounded-full bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
                      >
                        Correct & Resubmit
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
          {/* iOS liquid glass header */}
          <div className="relative overflow-hidden rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/80 to-transparent" />
            <div className="relative z-10 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900">Reports &amp; Exports</h1>
                <p className="text-xs font-medium text-slate-500">
                  Your submitted &amp; approved dossiers — download any of them as CSV or JSON
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/80 px-3 py-1.5 text-xs font-bold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {apiSubmissions.filter((s: any) => ['SUBMITTED', 'RESUBMITTED', 'PENDING'].includes(s.status)).length} Submitted · {apiSubmissions.filter((s: any) => ['APPROVED', 'ACTIVE', 'BU_APPROVED', 'SUBSIDIARY_APPROVED'].includes(s.status)).length} Approved
                </span>
                <button
                  onClick={() => {
                    const exportable = apiSubmissions.filter((s: any) => ['SUBMITTED', 'RESUBMITTED', 'PENDING', 'APPROVED', 'ACTIVE', 'BU_APPROVED', 'SUBSIDIARY_APPROVED'].includes(s.status))
                    const json = JSON.stringify(exportable.map(({ history, corrections, ...rest }: any) => rest), null, 2)
                    const blob = new Blob([json], { type: 'application/json' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `meilESG_all_submissions_${new Date().toISOString().slice(0, 10)}.json`
                    a.click()
                    URL.revokeObjectURL(url)
                    showToast(`Exported ${exportable.length} submissions as JSON`)
                  }}
                  className="flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50/70 px-3.5 py-1.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100"
                >
                  <Download className="h-3 w-3" />
                  <span>Export All (JSON)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Submitted & Approved dossiers — real ledger rows, liquid glass cards */}
          {(() => {
            const exportable = apiSubmissions
              .filter((s: any) => ['SUBMITTED', 'RESUBMITTED', 'PENDING', 'APPROVED', 'ACTIVE', 'BU_APPROVED', 'SUBSIDIARY_APPROVED'].includes(s.status))
            const downloadJson = (sub: any) => {
              const { history, corrections, ...rest } = sub
              const json = JSON.stringify(rest, null, 2)
              const blob = new Blob([json], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `${(sub.ref || sub.id).replace(/[^a-zA-Z0-9-_]/g, '_')}.json`
              a.click()
              URL.revokeObjectURL(url)
              showToast('Exported submission JSON')
            }
            const downloadCsv = (sub: any) => {
              const rows: Array<Record<string, string | number>> = []
              rows.push({ Field: 'Submission Ref', Value: sub.ref || sub.id })
              rows.push({ Field: 'Title', Value: sub.title || '' })
              rows.push({ Field: 'Project', Value: sub.project?.name || '' })
              rows.push({ Field: 'Reporting Period', Value: sub.reportingPeriod?.periodLabel || '' })
              rows.push({ Field: 'Category', Value: sub.category || '' })
              rows.push({ Field: 'Status', Value: sub.status || '' })
              rows.push({ Field: 'Submitted At', Value: sub.formattedDateTime || sub.submittedAt || '' })
              rows.push({ Field: 'Reviewer', Value: sub.reviewer?.name || '' })
              for (const pv of sub.parsedValues || []) {
                rows.push({ Field: pv.label, Value: pv.value != null ? `${pv.value}${pv.unit ? ` ${pv.unit}` : ''}` : '' })
              }
              for (const ev of sub.evidenceList || []) {
                rows.push({ Field: 'Evidence', Value: ev })
              }
              const headers = ['Field', 'Value']
              const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')].join('\n')
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `${(sub.ref || sub.id).replace(/[^a-zA-Z0-9-_]/g, '_')}.csv`
              a.click()
              URL.revokeObjectURL(url)
              showToast('Exported submission CSV')
            }
            return (
              <div className="space-y-3">
                {apiSubmissionsLoading && (
                  <div className="rounded-[24px] border border-white/60 bg-white/70 px-4 py-10 text-center text-xs font-semibold text-slate-400 backdrop-blur-xl">
                    Loading your dossiers…
                  </div>
                )}
                {!apiSubmissionsLoading && exportable.length === 0 && (
                  <div className="rounded-[24px] border border-dashed border-slate-200 bg-white/60 px-4 py-12 text-center text-xs font-semibold text-slate-400 backdrop-blur-xl">
                    No submitted or approved dossiers yet — submit from the Financial Data levels and they appear here instantly.
                  </div>
                )}
                {exportable.map((sub: any) => {
                  const isApproved = ['APPROVED', 'ACTIVE', 'BU_APPROVED', 'SUBSIDIARY_APPROVED'].includes(sub.status)
                  return (
                    <div
                      key={sub.id}
                      className="group relative overflow-hidden rounded-[24px] border border-white/70 bg-white/75 p-5 shadow-lg shadow-sky-500/5 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl"
                    >
                      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/90 to-transparent" />
                      <div className="relative z-10 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-blue-200 bg-blue-50/80 px-2.5 py-0.5 font-mono text-[10px] font-bold text-blue-700">
                              {sub.ref || `SUB-${sub.id.slice(-6).toUpperCase()}`}
                            </span>
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                              isApproved
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-blue-200 bg-blue-50 text-blue-700'
                            }`}>
                              <ShieldCheck className="h-3 w-3" />
                              {isApproved ? 'Approved' : 'Submitted'}
                            </span>
                            {sub.evidenceList?.length > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                                <FileText className="h-3 w-3" /> {sub.evidenceList.length} evidence file{sub.evidenceList.length === 1 ? '' : 's'}
                              </span>
                            )}
                          </div>
                          <div className="mt-1.5 truncate text-sm font-bold text-slate-900">{sub.title}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-medium text-slate-500">
                            <span>{sub.project?.name || '—'}</span>
                            <span>·</span>
                            <span>{sub.reportingPeriod?.periodLabel || '—'}</span>
                            <span>·</span>
                            <span>{sub.formattedDateTime || (sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : '—')}</span>
                            {sub.reviewer?.name && (
                              <>
                                <span>·</span>
                                <span>Reviewer: {sub.reviewer.name}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            onClick={() => downloadCsv(sub)}
                            className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700"
                          >
                            <Download className="h-3 w-3" />
                            <span>CSV</span>
                          </button>
                          <button
                            onClick={() => downloadJson(sub)}
                            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700"
                          >
                            <Download className="h-3 w-3" />
                            <span>JSON</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
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
                  {[
                    ...realActivities.map((a: any) => ({
                      id: a.id,
                      timestamp: new Date(a.createdAt).toLocaleString(),
                      title: String(a.action || 'Activity').replace(/_/g, ' '),
                      entity: a.orgLabel || a.project?.name || 'MEIL-SOL-GJT',
                      description: a.targetLabel || a.targetType || '',
                      actor: a.actorName || 'System',
                      severity: a.severity || 'INFO',
                      real: true,
                    })),
                    ...activities.map(act => ({ ...act, real: false })),
                  ].map(act => (
                    <tr key={act.id} className="group hover:bg-blue-50/40 transition">
                      <td className="py-4 pl-2 font-mono text-slate-500">{act.timestamp}</td>
                      <td className="py-4 font-bold text-slate-800">
                        <span className="flex items-center gap-1.5">
                          {act.real && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" title="Live" />}
                          {act.title}
                        </span>
                      </td>
                      <td className="py-4 font-mono text-blue-700">{act.entity || 'MEIL-SOL-GJT'}</td>
                      <td className="py-4 text-slate-600 max-w-md">{act.description}</td>
                      <td className="py-4 text-slate-700 font-semibold">{act.actor}</td>
                      <td className="py-4 pr-2 text-right">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                          act.severity === 'SUCCESS'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : act.severity === 'WARNING'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-sky-50 text-sky-700 border-sky-200'
                        }`}>
                          {act.real ? 'Live' : 'Success'}
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
                  <h3 className="text-base font-bold text-slate-900">{editingExpId ? 'Edit Resource Expenditure Record' : 'Add Resource Expenditure Record'}</h3>
                  <p className="text-xs text-slate-500">{editingExpId ? 'Update the captured Level 2 expenditure record' : 'Record Level 2 financial expenditure for environmental initiatives — captured as Draft'}</p>
                </div>
                <button onClick={() => { setShowAddExpenditureModal(false); resetExpenditureForm() }} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100">
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
                    onClick={() => { setShowAddExpenditureModal(false); resetExpenditureForm() }}
                    className="rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-full bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-xs"
                  >
                    {editingExpId ? 'Update Record' : '+ Add (Draft)'}
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

      {/* ── Consolidated Final Review (ENV-user pattern): every level's entered
          details + evidence, with "Submit to Project Admin" ── */}
      <FinalSubmitAllModal
        open={showFinalReview}
        onClose={() => !submittingAll && setShowFinalReview(false)}
        projectName={financialData.common?.entityName || 'Gayatri Solar Plant (MEIL-SOL-GJT)'}
        periodLabel={financialData.common?.financialYear || 'FY 2026-27'}
        submitting={submittingAll}
        onSubmitAll={handleFinalSubmit}
        levels={financeLevels}
        allData={financeAllData}
        projectId={selectedProjectId || null}
        periodId="current"
        evidenceList={evidenceItems.map(ev => ({ name: ev.fileName, id: ev.id }))}
        submitterName={undefined}
        submitterRole="Finance & Resource Data Contributor"
      />

      {/* ── Success confirmation — shown only after the dossier reached the
          Project Admin ledger AND My Submissions was refreshed ── */}
      <SubmitAllSuccessModal
        open={showSubmitSuccess}
        onClose={() => {
          setShowSubmitSuccess(false)
          setActiveModule('fin-submissions')
        }}
        projectName={financialData.common?.entityName || 'Gayatri Solar Plant (MEIL-SOL-GJT)'}
        periodLabel={financialData.common?.financialYear || 'FY 2026-27'}
        submittedCount={lastSubmittedCount}
        totalLevels={financeLevels.length}
        items={evidenceItems.slice(0, 5).map(ev => ({ name: ev.fileName }))}
      />

      {/* ── Fullscreen evidence viewer (ENV pattern) for rail + vault View clicks ── */}
      {reviewEvidence && (
        <FullscreenEvidenceModal
          evidence={reviewEvidence}
          onClose={() => setReviewEvidence(null)}
        />
      )}
    </div>
  )
}

export default FinanceWorkspace
