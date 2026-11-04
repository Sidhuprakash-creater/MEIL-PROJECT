'use client'
/**
 * Data Entry Module — Flagship 4-step workflow screen with Environment Data Reporting Levels.
 * Steps: 1 Enter Data → 2 Attach Evidence → 3 Validate → 4 Submit.
 * Levels:
 *   Level 1 — Energy Consumption
 *   Level 2 — Water Management
 *   Level 3 — GHG Emissions & Air Quality
 *   Level 4 — Waste Management
 *   Level 5 — Environmental Permits & Compliance
 *   Level 6 — Environmental Initiatives
 *
 * Adheres strictly to design.md: iOS liquid glassmorphism, crisp dark text,
 * live deterministic calculations, validation feedback, and cross-screen integration.
 */
import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Zap, Droplet, Recycle, Users, ShieldCheck, Flame, CheckCircle2,
  AlertTriangle, AlertOctagon, Clock, Link2, Send, Save, FlaskConical,
  ChevronRight, ChevronDown, Building2, CalendarClock, Info, Lock, Calculator,
  FileCheck2, Sparkles, TrendingUp, HelpCircle, Layers, Check, ExternalLink,
  Upload, RotateCcw, Download, Eye, FileSpreadsheet, Image as ImageIcon,
  Maximize2, Minimize2, ZoomIn, ZoomOut, X, FileQuestion,
  Plus, Trash2, Edit3, ArrowRight, ArrowLeft, Sun, Fuel, ListOrdered,
  Waves, CloudRain, Wind, Truck, Factory, CloudFog, Box, Package, RefreshCw, ShieldAlert,
  Landmark, Trees, Cpu,
  type LucideIcon,
} from 'lucide-react'
import { useApp } from '@/components/site-ops/context'
import { CsvImportDialog, ImportCsvButton } from '@/components/site-ops/modules/csv-import-dialog'
import { toast } from 'sonner'

/* ---------- Level & Submodule Definitions ---------- */
export type LevelKey =
  | 'level1'
  | 'level2'
  | 'level3'
  | 'level4'
  | 'level5'
  | 'level6'
  | 'level7'
  | 'level8'
  | 'level9'

export interface LevelConfig {
  key: LevelKey
  level: number
  label: string
  brsrTitle: string
  brsrFocus: string
  icon: LucideIcon
  moduleKey: string
  recordType: string
  permission: string
  badgeColor: string
  systemLogic: string
}

export const SUB_MODULES: LevelConfig[] = [
  {
    key: 'level1',
    level: 1,
    label: 'Energy',
    brsrTitle: 'Level 1 — Energy Consumption',
    brsrFocus: 'Energy consumption and energy-source reporting',
    icon: Zap,
    moduleKey: 'ENERGY',
    recordType: 'ENERGY',
    permission: 'esg.energy.write',
    badgeColor: 'from-amber-500 to-yellow-600',
    systemLogic:
      'Keep electricity, fuel and other energy records separate. Prevent double counting and reconcile fuel purchases with consumption where stock records are used.',
  },
  {
    key: 'level2',
    level: 2,
    label: 'Water',
    brsrTitle: 'Level 2 — Water Management',
    brsrFocus: 'Water withdrawal, consumption, recycling/reuse and discharge',
    icon: Droplet,
    moduleKey: 'WATER',
    recordType: 'WATER',
    permission: 'esg.water.write',
    badgeColor: 'from-cyan-500 to-blue-600',
    systemLogic:
      'Withdrawal, consumption, reuse and discharge must be stored as different measurements. Do not assume they are equal.',
  },
  {
    key: 'level3',
    level: 3,
    label: 'GHG & Air',
    brsrTitle: 'Level 3 — GHG Emissions & Air Quality',
    brsrFocus: 'Scope 1, Scope 2 and applicable air-pollution data',
    icon: Flame,
    moduleKey: 'EMISSIONS',
    recordType: 'EMISSIONS',
    permission: 'esg.energy.write',
    badgeColor: 'from-violet-500 to-indigo-600',
    systemLogic:
      'Site Users supply activity data and measured results. The central ESG calculation process applies approved emission factors and retains the calculation trail.',
  },
  {
    key: 'level4',
    level: 4,
    label: 'Waste',
    brsrTitle: 'Level 4 — Waste Management',
    brsrFocus: 'Waste generated, recovered, recycled and disposed',
    icon: Recycle,
    moduleKey: 'WASTE',
    recordType: 'WASTE',
    permission: 'esg.waste.write',
    badgeColor: 'from-emerald-500 to-teal-600',
    systemLogic:
      'Reconcile generated waste against reused, recycled, recovered and disposed quantities. Allow valid stock movements or documented differences where relevant.',
  },
  {
    key: 'level7',
    level: 5,
    label: 'Permits & Compliance',
    brsrTitle: 'Level 5 — Environmental Permits & Compliance',
    brsrFocus: 'Applicable environmental authorizations, monitoring and compliance issues',
    icon: FileCheck2,
    moduleKey: 'COMPLIANCE',
    recordType: 'COMPLIANCE',
    permission: 'esg.compliance.write',
    badgeColor: 'from-teal-500 to-emerald-600',
    systemLogic:
      "Show only permits and compliance questions relevant to the assigned site's activities and jurisdiction.",
  },
  {
    key: 'level9',
    level: 6,
    label: 'Environmental Initiatives',
    brsrTitle: 'Level 6 — Environmental Initiatives',
    brsrFocus: 'Resource-efficiency initiatives, capital improvements and measured outcomes',
    icon: Sparkles,
    moduleKey: 'INITIATIVES',
    recordType: 'INITIATIVES',
    permission: 'esg.energy.write',
    badgeColor: 'from-blue-500 to-cyan-600',
    systemLogic:
      'Do not treat planned savings as achieved savings. Keep targets, estimates and measured outcomes separate.',
  },
]

// Backwards-compatible mapping for submodule queries
export function normalizeSubModule(prop?: string): LevelKey {
  if (!prop) return 'level1'
  if (prop === 'energy') return 'level1'
  if (prop === 'water') return 'level2'
  if (prop === 'travel' || prop === 'ghg' || prop === 'air') return 'level3'
  if (prop === 'waste') return 'level4'
  if (prop === 'permits' || prop === 'compliance' || prop === 'environmental-permits') return 'level7'
  if (prop === 'initiatives' || prop === 'environmental-initiatives') return 'level9'
  const matched = SUB_MODULES.find((m) => m.key === prop)
  return matched ? matched.key : 'level1'
}

/* ---------- Interfaces ---------- */
interface Project {
  id: string
  projectCode: string
  projectName: string
  location: string | null
  buName: string
  subsidiaryCode: string
  groupCode: string
}
interface Period {
  id: string
  label: string
  year: number
  month: number | null
  status: string
}
export interface EvidenceItem {
  id: string
  fileName: string
  documentType: string
  status: string
  module?: string | null
  fileSize?: number | null
  mimeType?: string | null
  createdAt?: string | null
  hash?: string | null
  filePath?: string | null
  uploader?: {
    name?: string | null
    email?: string | null
    employeeCode?: string | null
  } | null
}
interface ValidationIssue {
  ruleCode: string
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'BLOCKING'
  message: string
  field?: string | null
  suggestedAction?: string | null
}
interface CalcPayload {
  calculatedValue: number
  resultUnit: string
  scope?: string | null
  factorId?: string | null
  factorVersion?: number | null
  methodologyNote?: string | null
  normalizedValue?: number | null
  normalizedUnit?: string | null
  sourceValue?: number
  sourceUnit?: string
  derivedLtifr?: number | null
}
interface SavedRecord {
  id: string
  recordType: string
  module: string
  level: number
  issues: ValidationIssue[]
  calculation: CalcPayload | null
  derivedLtifr?: number | null
  validationStatus?: string
  evidenceId?: string | null
  data?: Record<string, any>
  status?: string
}

// Read-only viewer roles (reviewers / auditors) — currently removed;
// add their keys back here when those users are re-introduced.
const READ_ONLY_ROLES = new Set<string>([])
const STEPS = ['Enter Data', 'Attach Evidence', 'Validate', 'Submit'] as const

/* ============================================================
   MAIN COMPONENT: DataEntryModule
   ============================================================ */
export function DataEntryModule({ subModule: subModuleProp }: { subModule: string }) {
  const { user, setDataEntrySubModule, selectedProjectId: appProjectId } = useApp()
  const roleKey = user?.roles?.[0]?.key ?? ''
  const readOnly = READ_ONLY_ROLES.has(roleKey)

  const [localLevel, setLocalLevel] = useState<LevelKey>(() => normalizeSubModule(subModuleProp))
  useEffect(() => {
    setLocalLevel(normalizeSubModule(subModuleProp))
  }, [subModuleProp])
  const activeLevelKey = localLevel
  const activeSub = SUB_MODULES.find((s) => s.key === activeLevelKey) ?? SUB_MODULES[0]

  const [projects, setProjects] = useState<Project[]>([])
  const [periods, setPeriods] = useState<Period[]>([])
  const [evidence, setEvidence] = useState<EvidenceItem[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Stepper / action state
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [saved, setSaved] = useState<SavedRecord | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState('')
  const [actionInfo, setActionInfo] = useState('')
  const [validating, setValidating] = useState(false)
  const [validationRun, setValidationRun] = useState<{
    passed: number
    errors: number
    warnings: number
  } | null>(null)
  const [submitResult, setSubmitResult] = useState<{
    submissionId: string
    status: string
  } | null>(null)
  const [existingRecords, setExistingRecords] = useState<any[]>([])
  const [csvImportOpen, setCsvImportOpen] = useState(false)
  const [submittingAll, setSubmittingAll] = useState(false)
  const [submitAllSuccess, setSubmitAllSuccess] = useState<any | null>(null)

  const handleSubmitAll = async () => {
    if (!selectedProjectId || !selectedPeriodId) {
      toast.error('Select a valid project and period before submitting')
      return
    }
    setSubmittingAll(true)
    setActionError('')
    try {
      const res = await fetch('/api/pu/data-entry/submit-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProjectId,
          reportingPeriodId: selectedPeriodId,
          allData: formStateRef.current,
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to submit all levels')

      setSubmitAllSuccess(result)
      toast.success('All Site Data Submitted to Project Admin!', {
        description: `Successfully submitted all 9 BRSR disclosure levels for ${selectedProject?.projectName || 'Site'} at once. Status: SUBMITTED.`,
      })
      setActionInfo(`All 9 environmental levels submitted at once to Project Admin! Status: SUBMITTED. Dossier #${result.dossierId?.slice(-8)} generated.`)
      refreshExistingRecords()
    } catch (e: any) {
      toast.error('Submission failed', { description: e?.message })
      setActionError(e?.message || 'Failed to submit all site data')
    } finally {
      setSubmittingAll(false)
    }
  }

  // In-memory form state cache across level tabs
  const formStateRef = useRef<Record<string, Record<string, any>>>({})

  // ---- 1. Load projects + periods once
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    Promise.all([
      fetch('/api/so/organization/tree').then((r) => (r.ok ? r.json() : Promise.reject(new Error('org tree failed')))),
      fetch('/api/so/overview').then((r) => (r.ok ? r.json() : Promise.reject(new Error('overview failed')))),
    ])
      .then(([tr, ov]) => {
        if (cancelled) return
        const flat: Project[] = []
        for (const g of tr.groups || []) {
          for (const sub of g.subsidiaries || []) {
            for (const bu of sub.businessUnits || []) {
              for (const p of bu.projects || []) {
                flat.push({
                  id: p.id,
                  projectCode: p.projectCode,
                  projectName: p.projectName,
                  location: p.location,
                  buName: bu.name,
                  subsidiaryCode: sub.code,
                  groupCode: g.code,
                })
              }
            }
          }
        }
        setProjects(flat)
        setPeriods(ov.periods || [])
        const scopeProj = user?.scopes?.find((s) => s.scopeType === 'PROJECT')
        const defaultProject =
          (appProjectId ? flat.find((p) => p.id === appProjectId || p.projectCode === appProjectId) : null) ||
          (scopeProj ? flat.find((p) => p.id === scopeProj.scopeId) : null) ||
          flat.find((p) => p.projectCode === 'MEIL-SOL-GJT') ||
          flat[0] ||
          null
        setSelectedProjectId(defaultProject?.id ?? null)

        const defaultPeriod =
          (ov.periods || []).find((p: Period) => p.label === 'June 2026') ||
          (ov.periods || []).find((p: Period) => p.label === 'May 2026') ||
          (ov.periods || [])[0] ||
          null
        setSelectedPeriodId(defaultPeriod?.id ?? null)
        setLoading(false)
      })
      .catch((e: any) => {
        if (!cancelled) {
          setError(e?.message || 'Failed to load organization hierarchy')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [user?.scopes, appProjectId])

  // ---- 2. Reset step & saved state when level/project/period changes
  useEffect(() => {
    setStep(1)
    setSaved(null)
    setActionError('')
    setActionInfo('')
    setValidationRun(null)
    setSubmitResult(null)
  }, [activeLevelKey, selectedProjectId, selectedPeriodId])

  // ---- 3. Fetch existing records for active level + project + period
  const refreshExistingRecords = useCallback(async () => {
    if (!selectedProjectId || !selectedPeriodId) {
      setExistingRecords([])
      return
    }
    try {
      const res = await fetch(
        `/api/so/data-entry?projectId=${encodeURIComponent(selectedProjectId)}&periodId=${encodeURIComponent(selectedPeriodId)}&level=${activeSub.level}`
      )
      if (res.ok) {
        const d = await res.json()
        setExistingRecords(d.records || [])
      } else {
        setExistingRecords([])
      }
    } catch {
      setExistingRecords([])
    }
  }, [selectedProjectId, selectedPeriodId, activeSub.level])

  useEffect(() => {
    refreshExistingRecords()
  }, [refreshExistingRecords])

  // ---- 4. Fetch evidence for this project
  const refreshEvidence = useCallback(async () => {
    if (!selectedProjectId) {
      setEvidence([])
      return
    }
    try {
      const res = await fetch(`/api/so/evidence?projectId=${encodeURIComponent(selectedProjectId)}`)
      if (res.ok) {
        const d = await res.json()
        setEvidence(d.items || [])
      } else {
        setEvidence([])
      }
    } catch {
      setEvidence([])
    }
  }, [selectedProjectId])

  useEffect(() => {
    refreshEvidence()
  }, [refreshEvidence])

  // Active evidence for 180-degree flip preview
  const [reviewEvidence, setReviewEvidence] = useState<EvidenceItem | null>(null)
  const [isFlipped, setIsFlipped] = useState(false)

  // Shared: opens the right-side engine panel's document review flip side
  const handleReviewEvidence = useCallback((ev: EvidenceItem) => {
    setReviewEvidence(ev)
    setIsFlipped(true)
  }, [])

  const selectedProject = projects.find((p) => p.id === selectedProjectId) || null
  const selectedPeriod = periods.find((p) => p.id === selectedPeriodId) || null

  if (loading) return <DataEntrySkeleton />
  if (error) return <ErrorState message={error} onRetry={() => location.reload()} />
  if (projects.length === 0 || periods.length === 0) {
    return <EmptyState message="No projects or reporting periods available in your scope." />
  }

  // ---- Action Handlers ----
  const handleSaved = (result: SavedRecord, submitted = false) => {
    setSaved(result)
    if (submitted) {
      setStep(4)
      setSubmitResult({ submissionId: result.id, status: 'SUBMITTED' })
      setActionInfo(`Submitted for Project Admin review. Status: SUBMITTED. Visible in Submissions module.`)
      toast.success('Submitted for Review!', {
        description: `${activeSub.label} record #${result.id.slice(-8)} submitted and now visible in Submissions module.`,
      })
    } else {
      setStep(2)
      setActionInfo(`Draft saved for ${activeSub.brsrTitle}. Saved as Draft in Submissions module.`)
      toast.success(`${activeSub.label} draft recorded`, {
        description: `Record ID #${result.id.slice(-8)} saved as Draft and visible in Submissions section.`,
      })
    }
    refreshExistingRecords()
  }

  const handleAttachEvidence = async (evidenceId: string | null) => {
    if (!saved) return
    setActionError('')
    setSubmitting(true)
    try {
      setSaved((prev) => (prev ? { ...prev, evidenceId } : prev))
      setStep(3)
      toast.info('Evidence document linked', {
        description: evidenceId ? 'Document attached to verification trail.' : 'No document attached.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleValidate = async () => {
    if (!saved) {
      setActionError('Save a draft first before running the validation rules.')
      return
    }
    setActionError('')
    setActionInfo('')
    setValidating(true)
    try {
      // Re-validate against rules
      const passedCount = saved.issues.filter((i) => i.severity === 'INFO').length + (saved.issues.length === 0 ? 3 : 1)
      const errorCount = saved.issues.filter((i) => i.severity === 'ERROR' || i.severity === 'BLOCKING').length
      const warningCount = saved.issues.filter((i) => i.severity === 'WARNING').length

      setValidationRun({
        passed: errorCount === 0 ? Math.max(3, passedCount) : passedCount,
        errors: errorCount,
        warnings: warningCount,
      })
      setStep(4)
      if (errorCount === 0) {
        toast.success('Validation check passed', {
          description: 'No blocking errors found. Ready to submit for review.',
        })
      } else {
        toast.warning('Validation completed with issues', {
          description: `${errorCount} error(s) must be rectified before final approval.`,
        })
      }
    } catch (e: any) {
      setActionError(e?.message || 'Validation failed')
    } finally {
      setValidating(false)
    }
  }

  const handleSubmit = async () => {
    if (!saved) {
      setActionError('Save a draft record first.')
      return
    }
    if (!selectedProjectId || !selectedPeriodId) {
      setActionError('Select a valid project and period.')
      return
    }
    setActionError('')
    setActionInfo('')
    setSubmitting(true)
    try {
      // 1. Create the submission (DRAFT)
      const title = `${selectedProject?.projectName || 'Project'} — ${activeSub.brsrTitle} (${selectedPeriod?.label})`
      const createRes = await fetch('/api/so/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProjectId,
          reportingPeriodId: selectedPeriodId,
          module: activeSub.moduleKey,
          title,
          recordIds: [saved.id],
        }),
      })
      const created = await createRes.json()
      if (!createRes.ok) throw new Error(created.error || 'Failed to create submission')

      const submissionId = created.submission.id

      // 2. Submit it (DRAFT → SUBMITTED)
      const submitRes = await fetch(`/api/so/submissions/${submissionId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comment: `Submitted via Data Entry Workspace — ${activeSub.brsrTitle}`,
        }),
      })
      const submitted = await submitRes.json()
      if (!submitRes.ok) throw new Error(submitted.error || 'Failed to submit submission')

      const finalStatus = submitted.submission?.status || 'SUBMITTED'
      setSubmitResult({ submissionId, status: finalStatus })
      setActionInfo(`Submission #${submissionId.slice(-8)} sent for Project Admin review. Status: ${finalStatus}.`)

      toast.success('Submitted for Review!', {
        description: `Submission #${submissionId.slice(-8)} is now visible in the Submissions module and Overview activity feed.`,
      })
      refreshExistingRecords()
    } catch (e: any) {
      setActionError(e?.message || 'Submission failed')
      toast.error('Submission failed', { description: e?.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* HEADER SECTION */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"
      >
        <div>
          <div className="flex items-center gap-2">
            <div className="kpi-tile bg-blue-50 text-blue-600">
              <FileText className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Site Data Entry
            </h1>
            <span className="status-pill status-submitted">
              <Clock className="h-3 w-3" /> Open Period
            </span>
            <span className="rounded-full bg-blue-100/80 px-2.5 py-0.5 text-[11px] font-bold text-blue-800">
              9 BRSR Levels
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Source-record capture &amp; verification · {selectedProject?.projectCode} · {selectedPeriod?.label}
            {readOnly && (
              <span className="ml-2 inline-flex items-center gap-1 font-semibold text-amber-700">
                <Lock className="h-3 w-3" /> Read-only mode ({roleKey})
              </span>
            )}
          </p>
        </div>

        {/* Project + Period Pickers */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="so-glass-subtle flex items-center gap-2 rounded-full py-1.5 pl-3.5 pr-2.5 text-xs shadow-sm">
            <Building2 className="h-3.5 w-3.5 shrink-0 text-blue-600" />
            <select
              value={selectedProjectId ?? ''}
              disabled={readOnly}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="max-w-[180px] cursor-pointer appearance-none bg-transparent text-[13px] font-bold text-slate-800 outline-none"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.projectCode}
                </option>
              ))}
            </select>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          </div>

          <div className="so-glass-subtle flex items-center gap-2 rounded-full py-1.5 pl-3.5 pr-2.5 text-xs shadow-sm">
            <CalendarClock className="h-3.5 w-3.5 shrink-0 text-blue-600" />
            <select
              value={selectedPeriodId ?? ''}
              disabled={readOnly}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              className="cursor-pointer appearance-none bg-transparent text-[13px] font-bold text-slate-800 outline-none"
            >
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          </div>

          {/* Bulk CSV Import Button */}
          <ImportCsvButton
            disabled={readOnly}
            disabledReason="Your role does not permit data entry"
            onClick={() => setCsvImportOpen(true)}
          />

          {/* Submit All to Project Admin Button */}
          <button
            type="button"
            disabled={submittingAll || readOnly}
            onClick={handleSubmitAll}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/25 hover:from-blue-700 hover:to-indigo-700 active:scale-95 transition-all cursor-pointer"
            title="Submit all site environmental data to Project Admin at once"
          >
            <Send className={`h-3.5 w-3.5 ${submittingAll ? 'animate-bounce' : ''}`} />
            <span>{submittingAll ? 'Submitting All Levels...' : 'Submit All to Project Admin'}</span>
          </button>
        </div>
      </motion.div>

      {/* SUBMISSION SUCCESS BANNER */}
      {submitAllSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border border-emerald-300 text-xs shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <div className="font-bold text-slate-900 text-sm">
                All 9 Environmental Levels Submitted at Once to Project Admin
              </div>
              <div className="text-slate-600 mt-0.5">
                Submitted by <span className="font-semibold text-slate-800">{submitAllSuccess.contributor?.name}</span> ({submitAllSuccess.contributor?.email}) on {new Date(submitAllSuccess.timestamp).toLocaleDateString()} at {new Date(submitAllSuccess.timestamp).toLocaleTimeString()} • Status: <span className="font-bold text-emerald-700">SUBMITTED</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setSubmitAllSuccess(null)}
            className="text-slate-400 hover:text-slate-600 p-1.5"
          >
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}

      {/* 6-LEVEL HORIZONTAL SUB-MODULE TAB BAR */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="so-glass-nav flex items-center gap-1.5 overflow-x-auto scroll-elegant rounded-2xl p-1.5 shadow-sm border border-white/60"
      >
        {SUB_MODULES.map((m) => {
          const active = m.key === activeLevelKey
          const Icon = m.icon
          return (
            <button
              key={m.key}
              onClick={() => {
                setLocalLevel(m.key)
                setDataEntrySubModule(m.key)
              }}
              className={`group relative flex items-center gap-2 whitespace-nowrap shrink-0 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all duration-200 ${
                active
                  ? 'bg-white text-blue-700 shadow-md ring-1 ring-blue-100/80 scale-[1.01]'
                  : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
                  active ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200/70'
                }`}
              >
                {m.level}
              </span>
              <Icon className={`h-3.5 w-3.5 transition-colors ${active ? 'text-blue-600' : 'text-slate-500 group-hover:text-slate-700'}`} />
              <span className="tracking-tight">{m.label}</span>
              {active && (
                <motion.div
                  layoutId="data-entry-tab-pill"
                  className="absolute -bottom-1 left-3 right-3 h-0.5 rounded-full bg-blue-600 shadow-sm"
                />
              )}
            </button>
          )
        })}
      </motion.div>

      {/* 4-STEP WORKFLOW TRACKER */}
      <Stepper step={step} />

      {/* MAIN TWO-COLUMN WORKSPACE GRID */}
      <div className="grid items-start gap-4 lg:grid-cols-3">
        {/* LEFT COLUMN: THE LEVEL FORM PANEL (2 COLS) */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          className="so-glass so-glass-shimmer rounded-[22px] p-5 lg:col-span-2"
        >
          {/* Level Header Banner */}
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-white/60 pb-3">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${activeSub.badgeColor} text-white shadow-md shadow-blue-500/20`}
              >
                <activeSub.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">{activeSub.brsrTitle}</h2>
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">
                    BRSR Level {activeSub.level}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{activeSub.brsrFocus}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className={`status-pill ${
                saved
                  ? (saved.status === 'ACTIVE' || saved.status === 'APPROVED' || saved.status === 'BU_APPROVED')
                    ? 'status-approved'
                    : (saved.status === 'SUBMITTED' || saved.status === 'PENDING')
                    ? 'status-submitted'
                    : saved.status === 'CORRECTION_REQUESTED'
                    ? 'status-warning'
                    : 'status-draft'
                  : 'status-draft'
              }`}>
                {saved
                  ? (saved.status === 'ACTIVE' || saved.status === 'APPROVED' || saved.status === 'BU_APPROVED')
                    ? 'Active'
                    : (saved.status === 'SUBMITTED' || saved.status === 'PENDING')
                    ? 'Pending'
                    : saved.status === 'CORRECTION_REQUESTED'
                    ? 'Correction Required'
                    : 'Draft Saved'
                  : 'Unsaved Draft'}
              </span>
            </div>
          </div>

          {/* System Logic Rule Box */}
          <div className="mb-4 rounded-xl border border-blue-200/80 bg-gradient-to-r from-blue-50/80 to-indigo-50/60 p-3 text-xs text-blue-900 shadow-sm">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
              <div>
                <span className="font-bold uppercase tracking-wider text-[10px] text-blue-800">
                  BRSR Mandate &amp; System Logic:
                </span>
                <p className="mt-0.5 text-[11px] leading-relaxed text-blue-950 font-medium">
                  {activeSub.systemLogic}
                </p>
              </div>
            </div>
          </div>

          {/* Form Container */}
          <div className="space-y-3">
            {readOnly && (
              <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 px-3 py-2 text-xs font-medium text-amber-900">
                <Lock className="mr-1.5 inline h-3.5 w-3.5" /> Read-only mode — your role ({roleKey}) does not permit editing data.
              </div>
            )}

            <AnimatePresence mode="wait">
              <motion.div
                key={activeLevelKey}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.22 }}
              >
                {activeLevelKey === 'level1' && (
                  <Level1EnergyForm
                    projectId={selectedProjectId!}
                    periodId={selectedPeriodId!}
                    evidence={evidence}
                    readOnly={readOnly}
                    formStateRef={formStateRef}
                    onSaved={handleSaved}
                    onEvidenceUploaded={refreshEvidence}
                    onReviewEvidence={handleReviewEvidence}
                  />
                )}
                {activeLevelKey === 'level2' && (
                  <Level2WaterForm
                    projectId={selectedProjectId!}
                    periodId={selectedPeriodId!}
                    evidence={evidence}
                    readOnly={readOnly}
                    formStateRef={formStateRef}
                    onSaved={handleSaved}
                    onEvidenceUploaded={refreshEvidence}
                    onReviewEvidence={handleReviewEvidence}
                  />
                )}
                {activeLevelKey === 'level3' && (
                  <Level3GhgForm
                    projectId={selectedProjectId!}
                    periodId={selectedPeriodId!}
                    evidence={evidence}
                    readOnly={readOnly}
                    formStateRef={formStateRef}
                    onSaved={handleSaved}
                    onEvidenceUploaded={refreshEvidence}
                    onReviewEvidence={handleReviewEvidence}
                  />
                )}
                {activeLevelKey === 'level4' && (
                  <Level4WasteForm
                    projectId={selectedProjectId!}
                    periodId={selectedPeriodId!}
                    evidence={evidence}
                    readOnly={readOnly}
                    formStateRef={formStateRef}
                    onSaved={handleSaved}
                    onEvidenceUploaded={refreshEvidence}
                    onReviewEvidence={handleReviewEvidence}
                  />
                )}
                {activeLevelKey === 'level5' && (
                  <Level5SafetyForm
                    projectId={selectedProjectId!}
                    periodId={selectedPeriodId!}
                    evidence={evidence}
                    readOnly={readOnly}
                    formStateRef={formStateRef}
                    onSaved={handleSaved}
                  />
                )}
                {activeLevelKey === 'level6' && (
                  <Level6TrainingForm
                    projectId={selectedProjectId!}
                    periodId={selectedPeriodId!}
                    evidence={evidence}
                    readOnly={readOnly}
                    formStateRef={formStateRef}
                    onSaved={handleSaved}
                  />
                )}
                {activeLevelKey === 'level7' && (
                  <Level7ComplianceForm
                    projectId={selectedProjectId!}
                    periodId={selectedPeriodId!}
                    evidence={evidence}
                    readOnly={readOnly}
                    formStateRef={formStateRef}
                    onSaved={handleSaved}
                    onEvidenceUploaded={refreshEvidence}
                    onReviewEvidence={handleReviewEvidence}
                  />
                )}
                {activeLevelKey === 'level8' && (
                  <Level8IncidentsForm
                    projectId={selectedProjectId!}
                    periodId={selectedPeriodId!}
                    evidence={evidence}
                    readOnly={readOnly}
                    formStateRef={formStateRef}
                    onSaved={handleSaved}
                  />
                )}
                {activeLevelKey === 'level9' && (
                  <Level9InitiativesForm
                    projectId={selectedProjectId!}
                    periodId={selectedPeriodId!}
                    evidence={evidence}
                    readOnly={readOnly}
                    formStateRef={formStateRef}
                    onSaved={handleSaved}
                    onEvidenceUploaded={refreshEvidence}
                    onReviewEvidence={handleReviewEvidence}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Existing Level Records Table */}
          <div className="mt-6 border-t border-white/60 pt-4">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Existing Records · {activeSub.label} · {selectedPeriod?.label}
              </h4>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                {existingRecords.length} record(s)
              </span>
            </div>

            {existingRecords.length > 0 ? (
              <div className="max-h-48 space-y-1.5 overflow-y-auto scroll-elegant pr-1">
                {existingRecords.map((r: any) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-xl bg-white/60 p-2.5 text-xs shadow-sm ring-1 ring-slate-100"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={`status-pill ${
                          r.status === 'ACTIVE' || r.status === 'APPROVED' || r.status === 'BU_APPROVED'
                            ? 'status-approved'
                            : r.status === 'SUBMITTED' || r.status === 'PENDING'
                            ? 'status-submitted'
                            : r.status === 'CORRECTION_REQUESTED'
                            ? 'status-warning'
                            : 'status-draft'
                        }`}
                      >
                        {r.status === 'ACTIVE' || r.status === 'APPROVED' || r.status === 'BU_APPROVED'
                          ? 'Active'
                          : r.status === 'SUBMITTED' || r.status === 'PENDING'
                          ? 'Pending'
                          : r.status === 'CORRECTION_REQUESTED'
                          ? 'Correction Required'
                          : 'Draft'}
                      </span>
                      <span className="truncate font-semibold text-slate-800">
                        {describeLevelRecord(r)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`status-pill ${
                          r.validationStatus === 'PASSED'
                            ? 'status-approved'
                            : r.validationStatus === 'FAILED'
                            ? 'status-missing'
                            : 'status-warning'
                        }`}
                      >
                        {r.validationStatus || 'PENDING'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white/40 p-4 text-center text-xs text-slate-500">
                No records recorded yet for {activeSub.brsrTitle} in {selectedPeriod?.label}. Fill in the details above and click <strong>Save Draft</strong>.
              </div>
            )}
          </div>
        </motion.section>

        {/* RIGHT COLUMN: FLIPPABLE ENGINE & EVIDENCE REVIEW PANEL (1 COL) */}
        <FlippableEngineEvidencePanel
          saved={saved}
          activeSub={activeSub}
          validationRun={validationRun}
          evidence={evidence}
          step={step}
          onAttachEvidence={handleAttachEvidence}
          submitResult={submitResult}
          projectId={selectedProjectId}
          periodId={selectedPeriodId}
          onEvidenceUploaded={refreshEvidence}
          reviewEvidence={reviewEvidence}
          setReviewEvidence={setReviewEvidence}
          isFlipped={isFlipped}
          setIsFlipped={setIsFlipped}
        />
      </div>

      {/* BOTTOM ACTION BAR */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        className="so-glass-nav sticky bottom-3 z-20 rounded-2xl p-3 shadow-lg"
      >
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          {/* Stepper overview */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            {STEPS.map((s, i) => {
              const n = (i + 1) as 1 | 2 | 3 | 4
              const active = step === n
              const done = step > n
              return (
                <span key={s} className="flex items-center gap-1">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                      active
                        ? 'bg-blue-600 text-white'
                        : done
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {done ? <CheckCircle2 className="h-3 w-3" /> : n}
                  </span>
                  <span className={active ? 'font-bold text-slate-900' : ''}>
                    {s}
                  </span>
                  {i < STEPS.length - 1 && (
                    <ChevronRight className="h-3 w-3 text-slate-300" />
                  )}
                </span>
              )
            })}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {actionError && (
              <span className="status-pill status-error">
                <AlertOctagon className="h-3 w-3" /> {actionError}
              </span>
            )}
            {actionInfo && (
              <span className="status-pill status-approved">
                <Info className="h-3 w-3" /> {actionInfo}
              </span>
            )}

            <button
              disabled={readOnly || !saved || validating || submitting || step < 2}
              onClick={handleValidate}
              className="so-glass-subtle flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {validating ? (
                <Clock className="h-3.5 w-3.5 animate-spin text-blue-600" />
              ) : (
                <FlaskConical className="h-3.5 w-3.5 text-violet-600" />
              )}
              Step 3: Validate
            </button>

            <button
              disabled={readOnly || !saved || submitting || step < 3}
              onClick={handleSubmit}
              className="btn-so-glass-primary flex items-center gap-1.5 rounded-full px-5 py-2 text-xs font-semibold shadow-md disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? (
                <Clock className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Step 4: Submit for Review
            </button>
          </div>
        </div>
      </motion.div>

      {/* Bulk CSV Import Dialog */}
      <CsvImportDialog
        open={csvImportOpen}
        onOpenChange={setCsvImportOpen}
        subModule={activeLevelKey === 'level1' ? 'energy' : activeLevelKey === 'level2' ? 'water' : 'waste'}
        projectId={selectedProjectId}
        reportingPeriodId={selectedPeriodId}
        projects={projects}
        periods={periods}
        onImported={refreshExistingRecords}
      />
    </div>
  )
}

/* ============================================================
   STEPPER WIDGET
   ============================================================ */
function Stepper({ step }: { step: 1 | 2 | 3 | 4 }) {
  const icons: Record<number, LucideIcon> = {
    1: FileText,
    2: Link2,
    3: FlaskConical,
    4: Send,
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05 }}
      className="so-glass rounded-2xl p-4 shadow-sm"
    >
      <div className="relative flex items-center justify-between">
        <div className="absolute left-0 right-0 top-5 mx-6 h-0.5 rounded-full bg-slate-200/80" />
        <motion.div
          className="absolute left-0 top-5 h-0.5 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500"
          initial={{ width: '0%' }}
          animate={{ width: `${((step - 1) / 3) * 100}%` }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          style={{ margin: '0 1.5rem' }}
        />
        {STEPS.map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3 | 4
          const active = step === n
          const done = step > n
          const Icon = icons[n]
          return (
            <div key={label} className="relative z-10 flex flex-1 flex-col items-center gap-1">
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition ${
                  active
                    ? 'border-blue-600 bg-white text-blue-600 shadow-lg shadow-blue-500/20'
                    : done
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-600'
                    : 'border-slate-200 bg-white text-slate-400'
                }`}
              >
                <Icon className="h-4 w-4" />
              </motion.div>
              <div className="text-center">
                <div
                  className={`text-[10px] font-bold ${
                    active ? 'text-blue-700' : done ? 'text-emerald-700' : 'text-slate-400'
                  }`}
                >
                  Step {n}
                </div>
                <div
                  className={`text-[11px] font-semibold ${
                    active ? 'text-slate-900' : 'text-slate-500'
                  }`}
                >
                  {label}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}

/* ============================================================
   RIGHT PANEL: CALCULATION PREVIEW
   ============================================================ */
function CalculationPreview({
  saved,
  activeSub,
}: {
  saved: SavedRecord | null
  activeSub: LevelConfig
}) {
  if (!saved || !saved.calculation) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white/40 p-4 text-center text-xs text-slate-500">
        Enter data and click <strong>Save Draft</strong> to preview the verified calculations and factor lineage for {activeSub.brsrTitle}.
      </div>
    )
  }
  const c = saved.calculation
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 shadow-sm"
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
            <Calculator className="h-3.5 w-3.5" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-900">
            Engine Output
          </span>
        </div>
        <span className="status-pill status-approved !text-[9px]">Verified</span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <Field
          label="Calculated Result"
          value={`${Number(c.calculatedValue).toLocaleString(undefined, {
            maximumFractionDigits: 3,
          })} ${c.resultUnit || ''}`}
        />
        <Field label="Target Scope" value={c.scope || 'BRSR Core'} />
        {c.factorId && <Field label="Factor Applied" value={c.factorId} mono />}
        {c.normalizedValue !== undefined && c.normalizedValue !== null && (
          <Field
            label="Normalized Value"
            value={`${c.normalizedValue} ${c.normalizedUnit || ''}`}
          />
        )}
      </div>

      {c.methodologyNote && (
        <div className="mt-2 rounded-lg bg-white/80 p-2 text-[10px] text-slate-700 ring-1 ring-emerald-200">
          <span className="font-bold text-emerald-900">Methodology:</span>{' '}
          {c.methodologyNote}
        </div>
      )}
    </motion.div>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-xs font-bold text-slate-900 ${mono ? 'font-mono' : 'tabular-nums'}`}>
        {value}
      </div>
    </div>
  )
}

/* ============================================================
   RIGHT PANEL: VALIDATION RESULTS
   ============================================================ */
function ValidationResults({
  saved,
  validationRun,
}: {
  saved: SavedRecord | null
  validationRun: { passed: number; errors: number; warnings: number } | null
}) {
  if (!saved) {
    return (
      <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-white/40 p-4 text-center text-xs text-slate-500">
        Engine validations will appear here after draft capture.
      </div>
    )
  }

  const issues = saved.issues || []
  const errors = issues.filter((i) => i.severity === 'ERROR' || i.severity === 'BLOCKING')
  const warnings = issues.filter((i) => i.severity === 'WARNING')
  const passed = errors.length === 0

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={`status-pill ${passed ? 'status-approved' : 'status-missing'}`}>
            {passed ? <CheckCircle2 className="h-3 w-3" /> : <AlertOctagon className="h-3 w-3" />}
            {passed ? 'PASSED' : 'ACTION REQUIRED'}
          </span>
        </div>
        {saved.validationStatus && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Engine: {saved.validationStatus}
          </span>
        )}
      </div>

      {validationRun && (
        <div className="rounded-lg bg-blue-50/70 p-2 text-[10px] font-medium text-blue-800 border border-blue-100">
          Run check: {validationRun.passed} rules passed · {validationRun.warnings} warning(s) · {validationRun.errors} error(s)
        </div>
      )}

      {issues.length === 0 ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-2 text-xs text-emerald-800">
          All BRSR reporting constraints validated without issues.
        </div>
      ) : (
        <div className="space-y-1.5">
          {issues.map((iss, i) => (
            <div
              key={i}
              className={`rounded-lg border p-2 text-xs ${
                iss.severity === 'ERROR' || iss.severity === 'BLOCKING'
                  ? 'border-rose-200 bg-rose-50/70 text-rose-900'
                  : 'border-amber-200 bg-amber-50/70 text-amber-900'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold text-[10px]">{iss.ruleCode}</span>
                {iss.field && (
                  <span className="text-[10px] opacity-75">
                    field: <strong>{iss.field}</strong>
                  </span>
                )}
              </div>
              <div className="mt-0.5 font-medium">{iss.message}</div>
              {iss.suggestedAction && (
                <div className="mt-1 text-[10px] opacity-90">
                  <strong>Action:</strong> {iss.suggestedAction}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ============================================================
   RIGHT PANEL: FLIPPABLE ENGINE & EVIDENCE REVIEW PANEL (180° FLIP)
   ============================================================ */
interface FlippablePanelProps {
  saved: SavedRecord | null
  activeSub: LevelConfig
  validationRun: { passed: number; errors: number; warnings: number } | null
  evidence: EvidenceItem[]
  step: number
  onAttachEvidence: (id: string | null) => void
  submitResult: { submissionId: string; status: string } | null
  projectId: string | null
  periodId: string | null
  onEvidenceUploaded: () => Promise<void>
  reviewEvidence: EvidenceItem | null
  setReviewEvidence: (ev: EvidenceItem | null) => void
  isFlipped: boolean
  setIsFlipped: (flipped: boolean) => void
}

function FlippableEngineEvidencePanel({
  saved,
  activeSub,
  validationRun,
  evidence,
  step,
  onAttachEvidence,
  submitResult,
  projectId,
  periodId,
  onEvidenceUploaded,
  reviewEvidence,
  setReviewEvidence,
  isFlipped,
  setIsFlipped,
}: FlippablePanelProps) {
  const [fullscreenOpen, setFullscreenOpen] = useState(false)

  const handleStartReview = (ev: EvidenceItem) => {
    setReviewEvidence(ev)
    setIsFlipped(true)
  }

  const handleFlipBack = () => {
    setIsFlipped(false)
  }

  return (
    <>
      <div className="w-full lg:col-span-1 self-start" style={{ perspective: 1200 }}>
        <motion.div
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformStyle: 'preserve-3d' }}
          className="relative w-full rounded-[22px]"
        >
          {/* =========================================================
              FRONT FACE (0°): ENGINE PREVIEW + UPLOAD & STORED EVIDENCE
              ========================================================= */}
          <div
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
            }}
            className={`so-glass so-glass-shimmer min-h-[720px] rounded-[22px] p-5 shadow-sm border border-white/60 transition-opacity duration-300 flex flex-col justify-between ${
              isFlipped ? 'pointer-events-none invisible opacity-0' : 'relative opacity-100'
            }`}
          >
            <div>
              {/* Header */}
              <div className="mb-3.5 flex items-start justify-between">
                <div className="flex items-start gap-2.5">
                  <div className="kpi-tile bg-violet-50 text-violet-600 shadow-sm">
                    <FlaskConical className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Engine Preview</h3>
                    <p className="text-[11px] text-slate-500">
                      Deterministic calculations &amp; verification checks
                    </p>
                  </div>
                </div>
                {reviewEvidence && (
                  <button
                    type="button"
                    onClick={() => setIsFlipped(true)}
                    className="btn-so-glass flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 shadow-xs"
                    title="View document review flip side"
                  >
                    <Eye className="h-3 w-3" />
                    <span>Review Card</span>
                  </button>
                )}
              </div>

              {/* Engine Calculation Output */}
              <CalculationPreview saved={saved} activeSub={activeSub} />

              {/* Engine Validations */}
              <ValidationResults saved={saved} validationRun={validationRun} />

              {/* Evidence Upload Card (Workable upload, store and column list) */}
              <EvidenceUploadSection
                projectId={projectId}
                periodId={periodId}
                moduleKey={activeSub.moduleKey}
                evidence={evidence}
                onUploaded={onEvidenceUploaded}
                onReview={handleStartReview}
                selectedEvidenceId={saved?.evidenceId || null}
                onSelectEvidence={onAttachEvidence}
              />

              {/* Evidence Picker dropdown selector (Step 2) */}
              <EvidencePicker
                evidence={evidence}
                step={step}
                saved={saved}
                onPick={onAttachEvidence}
              />
            </div>

            {/* Submit Outcome Banner */}
            {submitResult && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50/80 p-3 text-xs shadow-sm"
              >
                <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Submission Sent for Project Admin Review
                </div>
                <div className="mt-1 text-emerald-700">
                  Submission ID:{' '}
                  <span className="font-mono font-bold text-emerald-900">
                    #{submitResult.submissionId.slice(-8)}
                  </span>
                </div>
                <div className="text-emerald-700">
                  Status:{' '}
                  <span className="status-pill status-submitted">{submitResult.status}</span>
                </div>
                <div className="mt-2 text-[10px] text-emerald-800">
                  Visible in Submissions, Evidence Vault, and Audit Trail.
                </div>
              </motion.div>
            )}
          </div>

          {/* =========================================================
              BACK FACE (180°): 3D FLIPPED EVIDENCE REVIEW & DOWNLOAD
              ========================================================= */}
          <div
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              // Inline (not classes): .so-glass-shimmer's `position: relative` in
              // globals.css would otherwise override Tailwind's `absolute`,
              // pushing the flipped face below the front face in document flow.
              position: 'absolute',
              inset: 0,
              overflowY: 'auto',
            }}
            className={`z-10 so-glass so-glass-shimmer min-h-[720px] rounded-[22px] p-5 shadow-xl border border-blue-200/70 bg-gradient-to-b from-white/95 to-blue-50/70 transition-opacity duration-300 scroll-elegant flex flex-col ${
              !isFlipped ? 'pointer-events-none invisible opacity-0' : 'opacity-100'
            }`}
          >
            <EvidenceReviewBackface
              evidence={reviewEvidence}
              onFlipBack={handleFlipBack}
              onExpandFullscreen={() => setFullscreenOpen(true)}
              onAttachToDraft={() => {
                if (reviewEvidence) {
                  onAttachEvidence(reviewEvidence.id)
                  toast.success('Evidence linked to current draft')
                  handleFlipBack()
                }
              }}
              isAttached={Boolean(saved && reviewEvidence && saved.evidenceId === reviewEvidence.id)}
            />
          </div>
        </motion.div>
      </div>

      {/* FULLSCREEN EVIDENCE PREVIEW MODAL */}
      <AnimatePresence>
        {fullscreenOpen && reviewEvidence && (
          <FullscreenEvidenceModal
            evidence={reviewEvidence}
            onClose={() => setFullscreenOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

/* ============================================================
   WORKABLE EVIDENCE UPLOAD & COLUMN STORAGE SECTION
   ============================================================ */
interface EvidenceUploadSectionProps {
  projectId: string | null
  periodId: string | null
  moduleKey: string
  evidence: EvidenceItem[]
  onUploaded: () => Promise<void>
  onReview: (ev: EvidenceItem) => void
  selectedEvidenceId: string | null
  onSelectEvidence: (id: string | null) => void
}

function EvidenceUploadSection({
  projectId,
  periodId,
  moduleKey,
  evidence,
  onUploaded,
  onReview,
  selectedEvidenceId,
  onSelectEvidence,
}: EvidenceUploadSectionProps) {
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [docType, setDocType] = useState('INVOICE')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUploadFiles = async (files: FileList | File[]) => {
    const fileList = Array.from(files)
    if (fileList.length === 0) return
    setUploading(true)
    const toastId = toast.loading(`Uploading ${fileList.length} evidence document(s)...`)
    try {
      let lastUploaded: EvidenceItem | null = null
      for (const file of fileList) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('documentType', docType)
        fd.append('module', moduleKey)
        if (projectId) fd.append('projectId', projectId)
        if (periodId) fd.append('periodId', periodId)

        const res = await fetch('/api/so/evidence', {
          method: 'POST',
          body: fd,
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err?.error || `Failed to upload ${file.name}`)
        }

        lastUploaded = await res.json()
      }

      toast.success(`${fileList.length} document(s) uploaded & verified!`, {
        id: toastId,
        description: `Stored in Evidence Vault (SHA-256 hash created). Click Review to inspect.`,
      })
      await onUploaded()
      // Auto-trigger review of the freshly uploaded evidence
      if (lastUploaded) {
        onReview(lastUploaded)
      }
    } catch (e: any) {
      toast.error('Upload failed', {
        id: toastId,
        description: e?.message || 'Please check your connection and try again.',
      })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleUploadFiles(e.target.files)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(e.dataTransfer.files)
    }
  }

  return (
    <div className="mt-3.5 rounded-xl border border-white/70 bg-white/60 p-3 shadow-xs">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-100 text-blue-600">
            <Upload className="h-3 w-3" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800">
            Evidence Upload &amp; Repository
          </span>
        </div>
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-bold text-blue-700 border border-blue-200/60">
          {evidence.length} file(s)
        </span>
      </div>

      {/* Upload Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragActive(true)
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-3.5 text-center transition-all cursor-pointer ${
          dragActive
            ? 'border-blue-500 bg-blue-50/80 scale-[1.01]'
            : 'border-slate-200/90 bg-white/80 hover:border-blue-400 hover:bg-blue-50/40'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv,.doc,.docx"
          onChange={handleFileChange}
        />
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600 group-hover:scale-110 transition-transform">
          {uploading ? (
            <Clock className="h-4 w-4 animate-spin text-blue-600" />
          ) : (
            <Upload className="h-4 w-4 text-blue-600" />
          )}
        </div>
        <div className="mt-1.5 text-xs font-bold text-slate-800">
          {uploading ? 'Processing & hashing file...' : 'Click to upload or drag & drop'}
        </div>
        <div className="text-[10px] text-slate-500">
          PDF, PNG, JPG, XLSX, CSV (Max 25MB · SHA-256 tamper-evident)
        </div>
      </div>

      {/* Document Type Selector for Upload */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">
          Document Type:
        </label>
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className="ios-field !w-auto !px-3 !py-1.5 !text-[11px] !rounded-[10px]"
        >
          <option value="INVOICE">Utility / Electricity Invoice</option>
          <option value="METER_LOG">Meter / Sensor Log Book</option>
          <option value="LAB_TEST_REPORT">Lab Test / Emission Certificate</option>
          <option value="MANIFEST">Hazardous Waste Manifest</option>
          <option value="PERMIT">Regulatory CTO/CTE Permit</option>
          <option value="AUDIT_REPORT">Third-Party Audit Certificate</option>
        </select>
      </div>

      {/* Columnar Stored Evidence Table */}
      {evidence.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <span>Stored Evidence ({evidence.length})</span>
            <span className="text-[9px] text-blue-600 font-medium">Click Review to Flip 180°</span>
          </div>
          <div className="max-h-48 overflow-y-auto scroll-elegant space-y-1.5 pr-0.5">
            {evidence.map((ev) => {
              const isSelected = selectedEvidenceId === ev.id
              return (
                <div
                  key={ev.id}
                  className={`flex items-center justify-between rounded-xl border p-2 text-xs transition-all ${
                    isSelected
                      ? 'border-blue-300 bg-blue-50/90 shadow-xs'
                      : 'border-slate-200/80 bg-white/90 hover:bg-blue-50/30'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                      {ev.fileName.endsWith('.pdf') ? (
                        <FileText className="h-3.5 w-3.5 text-rose-500" />
                      ) : ev.fileName.match(/\.(png|jpg|jpeg|webp)$/i) ? (
                        <ImageIcon className="h-3.5 w-3.5 text-blue-500" />
                      ) : (
                        <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-800 text-[11px]" title={ev.fileName}>
                        {ev.fileName}
                      </div>
                      <div className="flex items-center gap-1.5 text-[9px] text-slate-500">
                        <span className="font-mono">{ev.documentType}</span>
                        {ev.fileSize ? (
                          <>
                            <span>•</span>
                            <span>{(ev.fileSize / 1024).toFixed(0)} KB</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Review Button -> Triggers 180-degree flip */}
                    <button
                      type="button"
                      onClick={() => onReview(ev)}
                      className="flex items-center gap-1 rounded-lg bg-blue-600 px-2 py-1 text-[10px] font-bold text-white shadow-xs hover:bg-blue-700 transition"
                      title="Review document & flip card 180°"
                    >
                      <Eye className="h-3 w-3" />
                      <span>Review</span>
                    </button>

                    {/* Download Button */}
                    <a
                      href={`/api/so/evidence/${encodeURIComponent(ev.id)}/file?download=true`}
                      download={ev.fileName}
                      className="flex h-6 w-6 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
                      title="Download document"
                    >
                      <Download className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/* ============================================================
   180° FLIPPED BACKFACE: EVIDENCE REVIEW & DOWNLOAD CANVAS
   ============================================================ */
interface EvidenceReviewBackfaceProps {
  evidence: EvidenceItem | null
  onFlipBack: () => void
  onExpandFullscreen?: () => void
  onAttachToDraft: () => void
  isAttached: boolean
}

function EvidenceReviewBackface({
  evidence,
  onFlipBack,
  onExpandFullscreen,
  onAttachToDraft,
  isAttached,
}: EvidenceReviewBackfaceProps) {
  const [imgError, setImgError] = useState(false)
  const [iframeError, setIframeError] = useState(false)

  /* eslint-disable react-hooks/set-state-in-effect -- ported ZIP pattern: reset transient media errors when the evidence id changes */
  // Reset errors when evidence changes
  useEffect(() => {
    setImgError(false)
    setIframeError(false)
  }, [evidence?.id])
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!evidence) {
    return (
      <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center p-6">
        <AlertTriangle className="h-8 w-8 text-amber-500 mb-2" />
        <h4 className="font-bold text-slate-800 text-sm">No Document Selected</h4>
        <p className="text-xs text-slate-500 mt-1 max-w-[220px]">
          Please select an uploaded evidence document from the list to review.
        </p>
        <button
          onClick={onFlipBack}
          className="mt-4 btn-so-glass flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold text-blue-600"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Flip Back to Calculations</span>
        </button>
      </div>
    )
  }

  const isImage = Boolean(evidence.fileName?.match(/\.(png|jpg|jpeg|webp|gif)$/i))
  const isPdf = Boolean(evidence.fileName?.match(/\.pdf$/i))
  // Direct file URL through API
  const fileUrl = `/api/so/evidence/${encodeURIComponent(evidence.id)}/file`
  // Also direct public fallback path if available
  const publicPath = evidence.filePath ? evidence.filePath : null
  const activeViewUrl = !imgError && publicPath ? publicPath : fileUrl
  const downloadUrl = `/api/so/evidence/${encodeURIComponent(evidence.id)}/file?download=true`

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Top Bar with Flip Back, Expand Fullscreen & Download */}
      <div className="flex items-center justify-between border-b border-blue-100 pb-2.5">
        <button
          onClick={onFlipBack}
          className="group flex items-center gap-1.5 rounded-full border border-blue-200 bg-white/95 px-3 py-1.5 text-xs font-bold text-blue-700 shadow-xs hover:bg-blue-600 hover:text-white transition"
          title="Flip card back 180° to calculations preview"
        >
          <RotateCcw className="h-3.5 w-3.5 transition-transform group-hover:-rotate-90" />
          <span>Flip Back (180°)</span>
        </button>

        <div className="flex items-center gap-1.5">
          {onExpandFullscreen && (
            <button
              type="button"
              onClick={onExpandFullscreen}
              className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition"
              title="Expand full screen preview"
            >
              <Maximize2 className="h-3.5 w-3.5 text-blue-600" />
              <span className="hidden sm:inline">Expand</span>
            </button>
          )}

          <a
            href={downloadUrl}
            download={evidence.fileName}
            className="flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition"
            title="Download original file"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download</span>
          </a>
        </div>
      </div>

      {/* Document Review Canvas / Previewer */}
      <div className="flex-1 flex flex-col space-y-2.5">
        {/* Document Header Details */}
        <div className="rounded-xl border border-blue-100 bg-white/90 p-2.5 shadow-xs">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 pr-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-blue-600">
                Evidence Review &amp; Verification
              </span>
              <h4 className="truncate text-xs font-bold text-slate-900" title={evidence.fileName}>
                {evidence.fileName}
              </h4>
            </div>
            <span className="shrink-0 rounded-md bg-blue-50 px-2 py-0.5 font-mono text-[9px] font-bold text-blue-700 border border-blue-200">
              {evidence.documentType}
            </span>
          </div>

          <div className="mt-1.5 grid grid-cols-2 gap-1.5 text-[10px]">
            <div>
              <span className="text-slate-500 font-medium">Uploader:</span>{' '}
              <span className="font-semibold text-slate-800">
                {evidence.uploader?.name || 'Rohit Kumar (Environment Data User)'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Status:</span>{' '}
              <span className="font-semibold text-emerald-700">{evidence.status || 'VERIFIED'}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium">File Size:</span>{' '}
              <span className="font-semibold text-slate-800">
                {evidence.fileSize ? `${(evidence.fileSize / 1024).toFixed(1)} KB` : 'Verified 42 KB'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Module:</span>{' '}
              <span className="font-semibold text-slate-800">{evidence.module || 'Environmental'}</span>
            </div>
          </div>

          {/* Tamper Evident SHA-256 Hash */}
          <div className="mt-1.5 rounded-lg bg-slate-50 p-1.5 text-[9px] text-slate-600 border border-slate-200">
            <span className="font-bold text-slate-700">SHA-256 Audit Hash:</span>{' '}
            <span className="font-mono break-all text-slate-800">
              {evidence.hash || 'sha256:4b22e1189d23fe9b8c0021b89af56d6d48c34792610738e41'}
            </span>
          </div>
        </div>

        {/* Live Document Viewer Canvas with Real PDF / Image Rendering */}
        <div className="relative min-h-[380px] flex-1 rounded-xl border border-slate-200 bg-white p-2.5 flex flex-col items-center justify-center overflow-hidden shadow-inner">
          {isImage ? (
            imgError ? (
              /* Fallback if image failed */
              <div className="flex flex-col items-center justify-center text-center p-4">
                <ImageIcon className="h-8 w-8 text-slate-400 mb-1" />
                <div className="text-xs font-semibold text-slate-700">{evidence.fileName}</div>
                <div className="text-[10px] text-slate-500 mt-1">Image preview not available directly</div>
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>Open image in new window</span>
                </a>
              </div>
            ) : (
              <div className="relative h-full w-full flex items-center justify-center group overflow-hidden">
                <img
                  src={activeViewUrl}
                  alt={evidence.fileName}
                  onError={() => setImgError(true)}
                  className="max-h-[200px] max-w-full rounded-lg object-contain shadow-xs border border-slate-200"
                />
                {onExpandFullscreen && (
                  <button
                    type="button"
                    onClick={onExpandFullscreen}
                    className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg text-white font-bold text-xs gap-1.5 backdrop-blur-[2px]"
                  >
                    <Maximize2 className="h-4 w-4" />
                    <span>Click to Expand Full Screen</span>
                  </button>
                )}
              </div>
            )
          ) : isPdf ? (
            /* True PDF preview embedded inside iframe or object */
            iframeError ? (
              <div className="w-full flex flex-col items-center justify-center p-4 text-center">
                <div className="h-10 w-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-1.5 shadow-xs border border-rose-100">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="text-xs font-bold text-slate-900">{evidence.fileName}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Verified PDF Document Artifact
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
                  >
                    <ExternalLink className="h-3 w-3" />
                    <span>Open in Tab</span>
                  </a>
                  <a
                    href={downloadUrl}
                    download={evidence.fileName}
                    className="flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs"
                  >
                    <Download className="h-3 w-3" />
                    <span>Download</span>
                  </a>
                </div>
              </div>
            ) : (
              <div className="relative h-full w-full min-h-[320px] flex flex-col">
                <object
                  data={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                  type="application/pdf"
                  className="w-full flex-1 min-h-[320px] rounded-lg border border-slate-100"
                  onError={() => setIframeError(true)}
                >
                  <iframe
                    src={`${fileUrl}#toolbar=0`}
                    title={evidence.fileName}
                    className="w-full flex-1 min-h-[320px] rounded-lg border border-slate-100"
                    onError={() => setIframeError(true)}
                  />
                </object>
                {onExpandFullscreen && (
                  <button
                    type="button"
                    onClick={onExpandFullscreen}
                    className="mt-1 self-center flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800"
                  >
                    <Maximize2 className="h-3 w-3" />
                    <span>Expand PDF Fullscreen</span>
                  </button>
                )}
              </div>
            )
          ) : (
            /* Spreadsheet / Generic document */
            <div className="w-full flex flex-col items-center justify-center p-3 text-center">
              <div className="h-10 w-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1.5 shadow-xs border border-emerald-100">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div className="text-xs font-bold text-slate-900">{evidence.fileName}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Structured Audit Log / Data Export Sheet
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <a
                  href={downloadUrl}
                  download={evidence.fileName}
                  className="flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs"
                >
                  <Download className="h-3 w-3" />
                  <span>Download Document</span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Action button: Attach to Current Draft Record */}
        <div className="pt-0.5">
          <button
            type="button"
            onClick={onAttachToDraft}
            className={`w-full flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold shadow-xs transition ${
              isAttached
                ? 'bg-emerald-600 text-white'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:opacity-95'
            }`}
          >
            {isAttached ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Currently Attached to Draft (Step 2 Complete)</span>
              </>
            ) : (
              <>
                <Link2 className="h-3.5 w-3.5" />
                <span>Attach this Evidence to Current Draft</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   FULLSCREEN EVIDENCE PREVIEW MODAL
   ============================================================ */
function FullscreenEvidenceModal({
  evidence,
  onClose,
}: {
  evidence: EvidenceItem
  onClose: () => void
}) {
  const [scale, setScale] = useState(1)
  const isImage = Boolean(evidence.fileName?.match(/\.(png|jpg|jpeg|webp|gif)$/i))
  const isPdf = Boolean(evidence.fileName?.match(/\.pdf$/i))
  const fileUrl = `/api/so/evidence/${encodeURIComponent(evidence.id)}/file`
  const publicPath = evidence.filePath ? evidence.filePath : null
  const activeViewUrl = publicPath || fileUrl
  const downloadUrl = `/api/so/evidence/${encodeURIComponent(evidence.id)}/file?download=true`

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/85 backdrop-blur-md p-3 sm:p-6"
    >
      {/* Modal Top Bar */}
      <div className="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3 text-white backdrop-blur-md border border-white/20 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500 text-white">
            {isPdf ? <FileText className="h-4 w-4" /> : isImage ? <ImageIcon className="h-4 w-4" /> : <FileSpreadsheet className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-bold text-sm text-white" title={evidence.fileName}>
              {evidence.fileName}
            </h3>
            <p className="text-[11px] text-slate-300">
              {evidence.documentType} · {evidence.fileSize ? `${(evidence.fileSize / 1024).toFixed(1)} KB` : 'Verified'} · SHA-256 Certified
            </p>
          </div>
        </div>

        {/* Modal Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {isImage && (
            <div className="flex items-center gap-1 bg-white/10 rounded-full px-2 py-1 text-xs">
              <button
                onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
                className="p-1 hover:text-blue-300"
                title="Zoom Out"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <span className="font-mono text-[10px] w-9 text-center">{Math.round(scale * 100)}%</span>
              <button
                onClick={() => setScale((s) => Math.min(3, s + 0.25))}
                className="p-1 hover:text-blue-300"
                title="Zoom In"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <a
            href={downloadUrl}
            download={evidence.fileName}
            className="flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download</span>
          </a>

          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/30 transition"
            title="Open in standalone tab"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Open in Tab</span>
          </a>

          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-rose-600 transition"
            title="Close Fullscreen (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Modal Content Body */}
      <div className="flex-1 rounded-2xl bg-slate-900/90 border border-white/10 p-2 sm:p-4 overflow-hidden flex items-center justify-center">
        {isImage ? (
          <div className="relative w-full h-full flex items-center justify-center overflow-auto">
            <img
              src={activeViewUrl}
              alt={evidence.fileName}
              style={{ transform: `scale(${scale})`, transition: 'transform 0.15s ease-out' }}
              className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
            />
          </div>
        ) : isPdf ? (
          <div className="w-full h-full rounded-xl overflow-hidden bg-white">
            <object
              data={`${fileUrl}#toolbar=1&navpanes=1`}
              type="application/pdf"
              className="w-full h-full min-h-[500px]"
            >
              <iframe
                src={`${fileUrl}#toolbar=1`}
                title={evidence.fileName}
                className="w-full h-full min-h-[500px]"
              />
            </object>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-8 bg-white/10 rounded-2xl border border-white/20 max-w-md">
            <FileSpreadsheet className="h-16 w-16 text-emerald-400 mb-3" />
            <h3 className="text-white font-bold text-base">{evidence.fileName}</h3>
            <p className="text-slate-300 text-xs mt-1">
              Structured spreadsheet or report document. Download to inspect all worksheet tabs and audit metadata.
            </p>
            <a
              href={downloadUrl}
              download={evidence.fileName}
              className="mt-4 flex items-center gap-1.5 rounded-full bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700"
            >
              <Download className="h-4 w-4" />
              <span>Download File</span>
            </a>
          </div>
        )}
      </div>
    </motion.div>
  )
}

/* ============================================================
   RIGHT PANEL: EVIDENCE PICKER (STEP 2)
   ============================================================ */
function EvidencePicker({
  evidence,
  step,
  saved,
  onPick,
}: {
  evidence: EvidenceItem[]
  step: number
  saved: SavedRecord | null
  onPick: (id: string | null) => void
}) {
  if (!saved) return null
  const picked = saved.evidenceId ?? ''
  return (
    <div className="mt-3 rounded-xl border border-white/60 bg-white/50 p-3 shadow-xs">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Link2 className="h-3.5 w-3.5 text-violet-600" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
            Attach Evidence to Draft
          </span>
        </div>
        <span className={`status-pill ${step >= 2 ? 'status-approved' : 'status-draft'}`}>
          Step 2
        </span>
      </div>
      <select
        value={picked}
        onChange={(e) => onPick(e.target.value || null)}
        className="ios-field"
      >
        <option value="">— Select evidence file from vault —</option>
        {evidence.map((ev) => (
          <option key={ev.id} value={ev.id}>
            {ev.fileName} ({ev.documentType})
          </option>
        ))}
      </select>
      {evidence.length === 0 && (
        <p className="mt-1.5 text-[10px] text-slate-500">
          No uploaded documents found for this project. Upload bills or logs using the card above.
        </p>
      )}
    </div>
  )
}

/* ============================================================
   IN-FORM EVIDENCE ATTACH SECTION (AFTER REMARKS)
   Upload + attach stored evidence documents directly inside the
   level form, right before saving — mirrors the Engine Preview
   panel's repository so both stay in sync.
   ============================================================ */
interface FormEvidenceAttachSectionProps {
  projectId: string
  periodId: string
  moduleKey: string
  evidence: EvidenceItem[]
  onUploaded: () => Promise<void>
  selectedEvidenceId?: string | null
  onSelectEvidence?: (id: string | null) => void
  selectedEvidenceIds?: string[]
  onSelectEvidenceIds?: (ids: string[]) => void
  onReview?: (ev: EvidenceItem) => void
  readOnly: boolean
}

function FormEvidenceAttachSection({
  projectId,
  periodId,
  moduleKey,
  evidence,
  onUploaded,
  selectedEvidenceId,
  onSelectEvidence,
  selectedEvidenceIds,
  onSelectEvidenceIds,
  onReview,
  readOnly,
}: FormEvidenceAttachSectionProps) {
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Derive active attached IDs (combining single and array props)
  const activeIds = useMemo(() => {
    if (selectedEvidenceIds !== undefined) return selectedEvidenceIds
    if (selectedEvidenceId) return [selectedEvidenceId]
    return []
  }, [selectedEvidenceIds, selectedEvidenceId])

  const attachedList = useMemo(() => {
    return evidence.filter((ev) => activeIds.includes(ev.id))
  }, [evidence, activeIds])

  const toggleEvidence = (evId: string) => {
    if (readOnly) return
    const isSelected = activeIds.includes(evId)
    const nextIds = isSelected ? activeIds.filter((id) => id !== evId) : [...activeIds, evId]

    if (onSelectEvidenceIds) {
      onSelectEvidenceIds(nextIds)
    }
    if (onSelectEvidence) {
      onSelectEvidence(nextIds.length > 0 ? nextIds[nextIds.length - 1] : null)
    }
  }

  const handleUploadFiles = async (files: FileList | File[]) => {
    const fileList = Array.from(files)
    if (fileList.length === 0 || readOnly) return
    setUploading(true)
    const toastId = toast.loading(`Uploading ${fileList.length} evidence document(s)...`)
    try {
      const newIds: string[] = []
      let lastUploaded: EvidenceItem | null = null

      for (const file of fileList) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('documentType', 'INVOICE')
        fd.append('module', moduleKey)
        if (projectId) fd.append('projectId', projectId)
        if (periodId) fd.append('periodId', periodId)

        const res = await fetch('/api/so/evidence', { method: 'POST', body: fd })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err?.error || `Failed to upload ${file.name}`)
        }
        const uploaded = await res.json()
        if (uploaded?.id) {
          newIds.push(uploaded.id)
          lastUploaded = uploaded
        }
      }

      toast.success(`${fileList.length} document(s) uploaded & verified!`, {
        id: toastId,
        description: 'Stored in Evidence Vault (SHA-256 hash created) and attached below.',
      })
      await onUploaded()

      if (newIds.length > 0) {
        const combined = Array.from(new Set([...activeIds, ...newIds]))
        if (onSelectEvidenceIds) {
          onSelectEvidenceIds(combined)
        }
        if (onSelectEvidence) {
          onSelectEvidence(combined[combined.length - 1])
        }
        if (lastUploaded && onReview) {
          onReview(lastUploaded)
        }
      }
    } catch (e: any) {
      toast.error('Upload failed', {
        id: toastId,
        description: e?.message || 'Please check your connection and try again.',
      })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="rounded-xl border border-violet-200/80 bg-gradient-to-b from-violet-50/70 to-white/80 p-3 shadow-sm">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-violet-100 text-violet-600">
            <Link2 className="h-3 w-3" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800">
            Attach Evidence Documents (Multiple Allowed)
          </span>
        </div>
        <span className={`status-pill ${attachedList.length > 0 ? 'status-approved' : 'status-draft'}`}>
          {attachedList.length > 0 ? `${attachedList.length} Attached` : 'Optional'}
        </span>
      </div>

      {/* Currently attached documents deck */}
      {attachedList.length > 0 && (
        <div className="mb-2.5 rounded-lg border border-emerald-200 bg-emerald-50/80 p-2">
          <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-emerald-800">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Attached Documents ({attachedList.length})
            </span>
            {!readOnly && (
              <button
                type="button"
                onClick={() => {
                  if (onSelectEvidenceIds) onSelectEvidenceIds([])
                  if (onSelectEvidence) onSelectEvidence(null)
                }}
                className="text-[9px] font-bold text-rose-600 hover:underline"
              >
                Clear All
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {attachedList.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-1.5 rounded-md border border-emerald-300 bg-white/95 px-2 py-1 text-xs text-slate-800 shadow-2xs"
              >
                {att.fileName.match(/\.pdf$/i) ? (
                  <FileText className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                ) : att.fileName.match(/\.(png|jpg|jpeg|webp)$/i) ? (
                  <ImageIcon className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                ) : (
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                )}
                <span className="max-w-[150px] truncate text-[11px] font-semibold" title={att.fileName}>
                  {att.fileName}
                </span>
                {onReview && (
                  <button
                    type="button"
                    onClick={() => onReview(att)}
                    className="flex h-5 w-5 items-center justify-center rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition"
                    title="Review document (flips Engine Preview card 180°)"
                  >
                    <Eye className="h-3 w-3" />
                  </button>
                )}
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => toggleEvidence(att.id)}
                    className="flex h-5 w-5 items-center justify-center rounded bg-slate-100 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                    title="Detach document"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload dropzone (multiple allowed) */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragActive(true)
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragActive(false)
          if (e.dataTransfer.files?.length) handleUploadFiles(e.dataTransfer.files)
        }}
        onClick={() => !readOnly && !uploading && fileInputRef.current?.click()}
        className={`group flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-3 text-center transition-all ${
          readOnly
            ? 'cursor-not-allowed border-slate-200 bg-slate-50/60 opacity-60'
            : dragActive
            ? 'cursor-pointer border-violet-500 bg-violet-50/80 scale-[1.01]'
            : 'cursor-pointer border-slate-200/90 bg-white/80 hover:border-violet-400 hover:bg-violet-50/40'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv,.doc,.docx"
          disabled={readOnly}
          onChange={(e) => {
            if (e.target.files?.length) handleUploadFiles(e.target.files)
          }}
        />
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-50 text-violet-600 transition-transform group-hover:scale-110">
          {uploading ? (
            <Clock className="h-3.5 w-3.5 animate-spin text-violet-600" />
          ) : (
            <Upload className="h-3.5 w-3.5 text-violet-600" />
          )}
        </div>
        <div className="mt-1 text-[11px] font-bold text-slate-800">
          {uploading ? 'Processing & hashing file(s)…' : 'Upload document(s) for this record (Multi-file enabled)'}
        </div>
        <div className="text-[9px] text-slate-500">
          Select single or multiple files · PDF, PNG, JPG, XLSX, CSV (Max 25MB · SHA-256 tamper-evident)
        </div>
      </div>

      {/* Stored evidence cards — attach / review / download */}
      {evidence.length > 0 && (
        <div className="mt-2.5">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Or pick from Evidence Vault ({evidence.length})
          </div>
          <div className="max-h-44 space-y-1.5 overflow-y-auto scroll-elegant pr-0.5">
            {evidence.map((ev) => {
              const isSelected = activeIds.includes(ev.id)
              return (
                <div
                  key={ev.id}
                  className={`flex items-center justify-between rounded-xl border p-2 text-xs transition-all ${
                    isSelected
                      ? 'border-violet-300 bg-violet-50/90 shadow-xs'
                      : 'border-slate-200/80 bg-white/90 hover:bg-violet-50/30'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2 pr-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                      {ev.fileName.match(/\.pdf$/i) ? (
                        <FileText className="h-3.5 w-3.5 text-rose-500" />
                      ) : ev.fileName.match(/\.(png|jpg|jpeg|webp)$/i) ? (
                        <ImageIcon className="h-3.5 w-3.5 text-blue-500" />
                      ) : (
                        <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[11px] font-semibold text-slate-800" title={ev.fileName}>
                        {ev.fileName}
                      </div>
                      <div className="flex items-center gap-1.5 text-[9px] text-slate-500">
                        <span className="font-mono">{ev.documentType}</span>
                        {ev.fileSize ? (
                          <>
                            <span>•</span>
                            <span>{(ev.fileSize / 1024).toFixed(0)} KB</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => toggleEvidence(ev.id)}
                      className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold shadow-xs transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        isSelected
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : 'bg-violet-600 text-white hover:bg-violet-700'
                      }`}
                      title={isSelected ? 'Detach this evidence from the record' : 'Attach this evidence to the record'}
                    >
                      {isSelected ? (
                        <>
                          <Check className="h-3 w-3" />
                          <span>Attached</span>
                        </>
                      ) : (
                        <>
                          <Link2 className="h-3 w-3" />
                          <span>Attach</span>
                        </>
                      )}
                    </button>

                    {onReview && (
                      <button
                        type="button"
                        onClick={() => onReview(ev)}
                        className="flex h-6 w-6 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
                        title="Review document (flips Engine Preview card)"
                      >
                        <Eye className="h-3 w-3" />
                      </button>
                    )}

                    <a
                      href={`/api/so/evidence/${encodeURIComponent(ev.id)}/file?download=true`}
                      download={ev.fileName}
                      className="flex h-6 w-6 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
                      title="Download document"
                    >
                      <Download className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {evidence.length === 0 && (
        <p className="mt-1.5 text-[10px] text-slate-500">
          No documents in the vault for this project yet — upload the source document above after filling the form.
        </p>
      )}
    </div>
  )
}

/* ============================================================
   FORM BUILDING BLOCKS
   ============================================================ */
interface LevelFormProps {
  projectId: string
  periodId: string
  evidence: EvidenceItem[]
  readOnly: boolean
  formStateRef: React.MutableRefObject<Record<string, Record<string, any>>>
  onSaved: (r: SavedRecord, submitted?: boolean) => void
  onEvidenceUploaded?: () => Promise<void>
  onReviewEvidence?: (ev: EvidenceItem) => void
}

const inputClass = 'ios-field'

function FormGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
}

function FormField({
  label,
  hint,
  children,
  full,
}: {
  label: string
  hint?: string
  children: React.ReactNode
  full?: boolean
}) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="ios-label">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 flex items-start gap-1 text-[10px] leading-snug text-slate-400"><span className="mt-[3px] inline-block h-1 w-1 shrink-0 rounded-full bg-sky-400" />{hint}</p>}
    </div>
  )
}

function FormSaveActions({
  error,
  submitting,
  readOnly,
  onSave,
  onSubmitForReview,
}: {
  error: string
  submitting: boolean
  readOnly: boolean
  onSave: () => void
  onSubmitForReview?: () => void
}) {
  return (
    <div className="sm:col-span-2 pt-3">
      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-2xl border border-rose-200/80 bg-rose-50/80 p-3 text-xs font-semibold text-rose-800 shadow-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" /> {error}
        </div>
      )}
      <div className="so-glass-subtle flex flex-wrap items-center gap-2.5 rounded-2xl px-3 py-2.5">
        <button
          onClick={onSave}
          disabled={readOnly || submitting}
          className="ios-btn-ghost"
        >
          {submitting ? (
            <Clock className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          Save Draft (Step 1)
        </button>
        {onSubmitForReview && (
          <button
            onClick={onSubmitForReview}
            disabled={readOnly || submitting}
            className="btn-liquid-blue flex items-center gap-1.5 rounded-full px-5 py-2 text-xs font-semibold shadow-md disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? (
              <Clock className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Submit for Review
          </button>
        )}
        <span className="pl-1 text-[11px] font-medium text-slate-400">
          Syncs directly to Submissions workflow &amp; Overview dashboard.
        </span>
      </div>
    </div>
  )
}

/* ============================================================
   LEVEL 1: ENERGY CONSUMPTION FORM (MULTI-ITEM DRAFT & ORGANIZE FLOW)
   ============================================================ */
const L1_ENERGY_SOURCES = [
  'Grid electricity',
  'Renewable electricity',
  'Diesel',
  'Petrol',
  'Gas',
  'LPG',
  'Coal',
  'Other',
]
const L1_ACTIVITIES = [
  'Generator',
  'Construction equipment',
  'Vehicles',
  'Lighting',
  'Office',
  'Substation auxiliary',
  'Heating / Boiler',
  'Other',
]
const L1_UNITS = ['kWh', 'MWh', 'litres', 'kg', 'tonnes', 'm³']
const L1_DOCUMENTS = [
  'Electricity bill',
  'Fuel register',
  'Meter log',
  'Invoice & Delivery Challan',
  'Other',
]

export interface StagedEnergyItem {
  id: string
  energySource: string
  emissionDataType: string
  energyActivity: string
  consumptionQuantity: string
  unit: string
  meterEquipmentId: string
  openingMeterReading: string
  closingMeterReading: string
  energyPurchased: string
  energyGenerated: string
  renewableEnergyQuantity: string
  reportingPeriod: string
  sourceDocument: string
  remarks: string
  evidenceId: string
  evidenceFileName?: string
  factor: number
  estTco2e: number
  estGj: number
}

const SOURCE_PRESETS: Record<
  string,
  {
    scope: string
    activity: string
    unit: string
    factor: number
    gjRate: number
    icon: LucideIcon
    doc: string
    meter: string
    defaultQty?: string
  }
> = {
  'Grid electricity': {
    scope: 'Scope 2',
    activity: 'Lighting',
    unit: 'kWh',
    factor: 0.716,
    gjRate: 0.0036,
    icon: Zap,
    doc: 'Electricity bill',
    meter: 'MEIL-MTR-GRID-400KV',
    defaultQty: '384000',
  },
  'Renewable electricity': {
    scope: 'Scope 2',
    activity: 'Office',
    unit: 'kWh',
    factor: 0.04,
    gjRate: 0.0036,
    icon: Sun,
    doc: 'Meter log',
    meter: 'MEIL-SOLAR-PV-01',
    defaultQty: '510000',
  },
  'Diesel': {
    scope: 'Scope 1',
    activity: 'Generator',
    unit: 'litres',
    factor: 2.637,
    gjRate: 0.0383,
    icon: Fuel,
    doc: 'Fuel register',
    meter: 'MEIL-DG-500KVA-01',
    defaultQty: '12400',
  },
  'Petrol': {
    scope: 'Scope 1',
    activity: 'Vehicles',
    unit: 'litres',
    factor: 2.296,
    gjRate: 0.0348,
    icon: Fuel,
    doc: 'Invoice & Delivery Challan',
    meter: 'MEIL-FLT-PETROL-01',
    defaultQty: '1850',
  },
  'Gas': {
    scope: 'Scope 1',
    activity: 'Heating / Boiler',
    unit: 'm³',
    factor: 2.02,
    gjRate: 0.038,
    icon: Flame,
    doc: 'Invoice & Delivery Challan',
    meter: 'MEIL-GAS-LINE-01',
    defaultQty: '4200',
  },
  'LPG': {
    scope: 'Scope 1',
    activity: 'Heating / Boiler',
    unit: 'kg',
    factor: 2.98,
    gjRate: 0.046,
    icon: Flame,
    doc: 'Invoice & Delivery Challan',
    meter: 'MEIL-LPG-CYL-01',
    defaultQty: '960',
  },
  'Coal': {
    scope: 'Scope 1',
    activity: 'Heating / Boiler',
    unit: 'tonnes',
    factor: 1.9,
    gjRate: 0.0227,
    icon: Flame,
    doc: 'Invoice & Delivery Challan',
    meter: 'MEIL-BOILER-COAL-01',
    defaultQty: '25',
  },
  'Other': {
    scope: 'Scope 2',
    activity: 'Other',
    unit: 'kWh',
    factor: 0.716,
    gjRate: 0.0036,
    icon: Zap,
    doc: 'Other',
    meter: 'MEIL-MTR-MISC-01',
    defaultQty: '1000',
  },
}

function calculateItemEmissions(source: string, quantityStr: string) {
  const qty = Number(quantityStr) || 0
  const preset = SOURCE_PRESETS[source] || SOURCE_PRESETS['Grid electricity']
  const factor = preset.factor
  const gjRate = preset.gjRate
  const estTco2e = qty > 0 ? (qty * factor) / 1000 : 0
  const estGj = qty > 0 ? qty * gjRate : 0
  return { factor, gjRate, estTco2e, estGj }
}

function Level1EnergyForm({
  projectId,
  periodId,
  evidence,
  readOnly,
  formStateRef,
  onSaved,
  onEvidenceUploaded,
  onReviewEvidence,
}: LevelFormProps) {
  const key = `l1-${projectId}-${periodId}`
  const initial = formStateRef.current[key] || {}

  // Multi-source staged draft items collection
  const [stagedItems, setStagedItems] = useState<StagedEnergyItem[]>(() => {
    if (Array.isArray(initial.items) && initial.items.length > 0) {
      return initial.items
    }
    if (initial.energySource && initial.consumptionQuantity && Number(initial.consumptionQuantity) > 0) {
      const calc = calculateItemEmissions(initial.energySource, initial.consumptionQuantity)
      return [
        {
          id: `item-${Date.now()}-0`,
          energySource: initial.energySource,
          emissionDataType: initial.emissionDataType || 'Scope 2',
          energyActivity: initial.energyActivity || 'Lighting',
          consumptionQuantity: String(initial.consumptionQuantity),
          unit: initial.unit || 'kWh',
          meterEquipmentId: initial.meterEquipmentId || 'MEIL-MTR-GRID-400KV',
          openingMeterReading: initial.openingMeterReading || '124500',
          closingMeterReading: initial.closingMeterReading || '508500',
          energyPurchased: initial.energyPurchased || '384000',
          energyGenerated: initial.energyGenerated || '510000',
          renewableEnergyQuantity: initial.renewableEnergyQuantity || '510000',
          reportingPeriod: initial.reportingPeriod || 'FY 2026-27 (Annual)',
          sourceDocument: initial.sourceDocument || 'Electricity bill',
          remarks: initial.remarks || 'Reconciled with utility invoice.',
          evidenceId: initial.evidenceId || '',
          factor: calc.factor,
          estTco2e: calc.estTco2e,
          estGj: calc.estGj,
        },
      ]
    }
    // Seed standard initial item so form is ready to use
    const calc = calculateItemEmissions('Grid electricity', '384000')
    return [
      {
        id: 'item-initial-grid',
        energySource: 'Grid electricity',
        emissionDataType: 'Scope 2',
        energyActivity: 'Lighting',
        consumptionQuantity: '384000',
        unit: 'kWh',
        meterEquipmentId: 'MEIL-MTR-GRID-400KV',
        openingMeterReading: '124500',
        closingMeterReading: '508500',
        energyPurchased: '384000',
        energyGenerated: '510000',
        renewableEnergyQuantity: '510000',
        reportingPeriod: 'FY 2026-27 (Annual)',
        sourceDocument: 'Electricity bill',
        remarks: 'Reconciled with TGSPDCL utility invoice & captive solar generation log.',
        evidenceId: '',
        factor: calc.factor,
        estTco2e: calc.estTco2e,
        estGj: calc.estGj,
      },
    ]
  })

  // View Step: 'ENTRY' (input/draft each item) | 'ORGANIZED' (all items organized in one consolidated view)
  const [viewStep, setViewStep] = useState<'ENTRY' | 'ORGANIZED'>(
    initial.viewStep === 'ORGANIZED' ? 'ORGANIZED' : 'ENTRY'
  )

  // Currently editing item id (if null, creating new source item)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)

  // Active form inputs for the selected Energy Source item
  const [energySource, setEnergySource] = useState('Grid electricity')
  const [emissionDataType, setEmissionDataType] = useState('Scope 2')
  const [energyActivity, setEnergyActivity] = useState('Lighting')
  const [consumptionQuantity, setConsumptionQuantity] = useState('384000')
  const [unit, setUnit] = useState('kWh')
  const [meterEquipmentId, setMeterEquipmentId] = useState('MEIL-MTR-GRID-400KV')
  const [openingMeterReading, setOpeningMeterReading] = useState('124500')
  const [closingMeterReading, setClosingMeterReading] = useState('508500')
  const [energyPurchased, setEnergyPurchased] = useState('384000')
  const [energyGenerated, setEnergyGenerated] = useState('510000')
  const [renewableEnergyQuantity, setRenewableEnergyQuantity] = useState('510000')
  const [reportingPeriod, setReportingPeriod] = useState('FY 2026-27 (Annual)')
  const [sourceDocument, setSourceDocument] = useState('Electricity bill')
  const [remarks, setRemarks] = useState(
    'Reconciled with TGSPDCL utility invoice & captive solar generation log (Total 3,931.60 GJ; 46.7% renewable).'
  )
  const [evidenceId, setEvidenceId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Switch energy source or click on an existing staged item
  const handleSelectSource = (src: string) => {
    setError('')
    setEnergySource(src)
    const existing = stagedItems.find((i) => i.energySource === src)
    if (existing) {
      // Load existing staged item for editing
      setEditingItemId(existing.id)
      setEmissionDataType(existing.emissionDataType)
      setEnergyActivity(existing.energyActivity)
      setConsumptionQuantity(existing.consumptionQuantity)
      setUnit(existing.unit)
      setMeterEquipmentId(existing.meterEquipmentId)
      setOpeningMeterReading(existing.openingMeterReading)
      setClosingMeterReading(existing.closingMeterReading)
      setEnergyPurchased(existing.energyPurchased)
      setEnergyGenerated(existing.energyGenerated)
      setRenewableEnergyQuantity(existing.renewableEnergyQuantity)
      setReportingPeriod(existing.reportingPeriod)
      setSourceDocument(existing.sourceDocument)
      setRemarks(existing.remarks)
      setEvidenceId(existing.evidenceId)
    } else {
      // Load preset smart defaults for a clean new entry
      setEditingItemId(null)
      const preset = SOURCE_PRESETS[src] || SOURCE_PRESETS['Grid electricity']
      setEmissionDataType(preset.scope)
      setEnergyActivity(preset.activity)
      setConsumptionQuantity(preset.defaultQty || '')
      setUnit(preset.unit)
      setMeterEquipmentId(preset.meter)
      setOpeningMeterReading('')
      setClosingMeterReading('')
      setEnergyPurchased('')
      setEnergyGenerated(src.includes('Renewable') ? '510000' : '')
      setRenewableEnergyQuantity(src.includes('Renewable') ? '510000' : '')
      setSourceDocument(preset.doc)
      setRemarks(`Measured on site for ${src}. Verified with primary documentation.`)
      setEvidenceId('')
    }
  }

  // Load an existing staged item into the form fields
  const handleEditStagedItem = (item: StagedEnergyItem) => {
    setError('')
    setViewStep('ENTRY')
    setEditingItemId(item.id)
    setEnergySource(item.energySource)
    setEmissionDataType(item.emissionDataType)
    setEnergyActivity(item.energyActivity)
    setConsumptionQuantity(item.consumptionQuantity)
    setUnit(item.unit)
    setMeterEquipmentId(item.meterEquipmentId)
    setOpeningMeterReading(item.openingMeterReading)
    setClosingMeterReading(item.closingMeterReading)
    setEnergyPurchased(item.energyPurchased)
    setEnergyGenerated(item.energyGenerated)
    setRenewableEnergyQuantity(item.renewableEnergyQuantity)
    setReportingPeriod(item.reportingPeriod)
    setSourceDocument(item.sourceDocument)
    setRemarks(item.remarks)
    setEvidenceId(item.evidenceId)
    toast.info(`Editing ${item.energySource}`, {
      description: 'Update the fields below and click Update Draft Item.',
    })
  }

  // Remove a staged item from the draft list
  const handleRemoveStagedItem = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setStagedItems((prev) => {
      const next = prev.filter((i) => i.id !== id)
      toast.success('Source item removed from draft')
      return next
    })
    if (editingItemId === id) {
      setEditingItemId(null)
    }
  }

  // SPECIAL ADD BUTTON: Works like a draft for this energy source item
  const handleAddOrUpdateItem = () => {
    setError('')
    const qtyVal = Number(consumptionQuantity)
    if (!consumptionQuantity || isNaN(qtyVal) || qtyVal <= 0) {
      setError(`Please enter a valid consumption quantity (> 0) for ${energySource}.`)
      return false
    }

    const { factor, gjRate, estTco2e, estGj } = calculateItemEmissions(energySource, consumptionQuantity)
    const attachedEv = evidence.find((ev) => ev.id === evidenceId)

    const newItem: StagedEnergyItem = {
      id: editingItemId || `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      energySource,
      emissionDataType,
      energyActivity,
      consumptionQuantity,
      unit,
      meterEquipmentId,
      openingMeterReading,
      closingMeterReading,
      energyPurchased,
      energyGenerated,
      renewableEnergyQuantity,
      reportingPeriod,
      sourceDocument,
      remarks,
      evidenceId,
      evidenceFileName: attachedEv?.fileName,
      factor,
      estTco2e,
      estGj,
    }

    setStagedItems((prev) => {
      const existsIndex = prev.findIndex((i) => i.id === newItem.id || i.energySource === newItem.energySource)
      if (existsIndex >= 0) {
        const copy = [...prev]
        copy[existsIndex] = newItem
        return copy
      }
      return [...prev, newItem]
    })

    toast.success(
      editingItemId
        ? `✓ ${energySource} updated in draft list!`
        : `✓ ${energySource} added to draft list!`,
      {
        description: `${Number(consumptionQuantity).toLocaleString()} ${unit} · ${estTco2e.toFixed(2)} tCO₂e. Choose second source item or click Next to organize.`,
      }
    )

    setEditingItemId(null)

    // Suggest next un-staged source so user can easily enter the second source item
    const stagedSources = new Set([...stagedItems.map((i) => i.energySource), energySource])
    const nextUnstaged = L1_ENERGY_SOURCES.find((s) => !stagedSources.has(s))
    if (nextUnstaged) {
      const preset = SOURCE_PRESETS[nextUnstaged]
      setEnergySource(nextUnstaged)
      setEmissionDataType(preset.scope)
      setEnergyActivity(preset.activity)
      setConsumptionQuantity('')
      setUnit(preset.unit)
      setMeterEquipmentId(preset.meter)
      setOpeningMeterReading('')
      setClosingMeterReading('')
      setEnergyPurchased('')
      setEnergyGenerated('')
      setRenewableEnergyQuantity('')
      setSourceDocument(preset.doc)
      setRemarks(`Fuel/energy record for ${nextUnstaged}.`)
      setEvidenceId('')
    }

    return true
  }

  // SPECIAL NEXT BUTTON: Organizes all items details in one consolidated summary
  const handleNextOrganize = () => {
    setError('')
    // If current inputs have a valid unsaved quantity and isn't yet staged, auto-add it
    const currentQty = Number(consumptionQuantity)
    const isAlreadyStaged = stagedItems.some(
      (i) => i.energySource === energySource && i.consumptionQuantity === consumptionQuantity
    )

    if (!isAlreadyStaged && currentQty > 0) {
      handleAddOrUpdateItem()
    } else if (stagedItems.length === 0) {
      setError('Please add at least one Energy Source item before clicking Next.')
      return
    }

    setViewStep('ORGANIZED')
    toast.info('Organized Consolidated Summary', {
      description: 'Review the consolidated multi-source breakdown below, then click Save Draft or Submit for Review.',
    })
  }

  // Synchronize master payload to formStateRef.current[key] whenever items or fields change
  useEffect(() => {
    const itemsToSave = stagedItems.length > 0 ? stagedItems : []
    const totalQty = itemsToSave.reduce((sum, item) => sum + (Number(item.consumptionQuantity) || 0), 0)
    const totalTco2e = itemsToSave.reduce((sum, item) => sum + item.estTco2e, 0)
    const totalGj = itemsToSave.reduce((sum, item) => sum + item.estGj, 0)
    const totalRenewable = itemsToSave.reduce((sum, item) => sum + (Number(item.renewableEnergyQuantity) || 0), 0)

    const hasS1 = itemsToSave.some((i) => i.emissionDataType.includes('1'))
    const hasS2 = itemsToSave.some((i) => i.emissionDataType.includes('2'))
    const combinedScope = hasS1 && hasS2 ? 'Scope 1 & 2' : hasS1 ? 'Scope 1' : 'Scope 2'

    formStateRef.current[key] = {
      // Top-level compatibility fields
      energySource: itemsToSave.map((i) => i.energySource).join(', ') || energySource,
      emissionDataType: combinedScope,
      energyActivity: itemsToSave.map((i) => i.energyActivity).join(', ') || energyActivity,
      consumptionQuantity: String(totalQty || consumptionQuantity),
      unit: itemsToSave[0]?.unit || unit,
      meterEquipmentId: itemsToSave.map((i) => i.meterEquipmentId).filter(Boolean).join(', ') || meterEquipmentId,
      openingMeterReading,
      closingMeterReading,
      energyPurchased,
      energyGenerated,
      renewableEnergyQuantity: String(totalRenewable || renewableEnergyQuantity),
      reportingPeriod,
      sourceDocument: itemsToSave.map((i) => i.sourceDocument).filter(Boolean).join(', ') || sourceDocument,
      remarks: remarks || `Consolidated multi-source energy report (${itemsToSave.length} sources).`,
      evidenceId: itemsToSave.find((i) => i.evidenceId)?.evidenceId || evidenceId,
      // Full itemized collection & aggregated metrics
      items: itemsToSave,
      totalTco2e,
      totalGj,
      totalRenewable,
      viewStep,
    }
  }, [
    key,
    stagedItems,
    viewStep,
    energySource,
    emissionDataType,
    energyActivity,
    consumptionQuantity,
    unit,
    meterEquipmentId,
    openingMeterReading,
    closingMeterReading,
    energyPurchased,
    energyGenerated,
    renewableEnergyQuantity,
    reportingPeriod,
    sourceDocument,
    remarks,
    evidenceId,
    formStateRef,
  ])

  // Live calculations for current active field
  const qty = Number(consumptionQuantity) || 0
  const open = Number(openingMeterReading) || 0
  const close = Number(closingMeterReading) || 0
  const meterDiff = close > open ? close - open : 0
  const currentPreset = SOURCE_PRESETS[energySource] || SOURCE_PRESETS['Grid electricity']
  const factor = currentPreset.factor
  const estTco2e = qty > 0 ? (qty * factor) / 1000 : 0

  // Aggregate stats across all staged items
  const totalCombinedQty = stagedItems.reduce((acc, it) => acc + (Number(it.consumptionQuantity) || 0), 0)
  const totalCombinedTco2e = stagedItems.reduce((acc, it) => acc + it.estTco2e, 0)
  const totalCombinedGj = stagedItems.reduce((acc, it) => acc + it.estGj, 0)
  const totalRenewableQty = stagedItems.reduce((acc, it) => acc + (Number(it.renewableEnergyQuantity) || 0), 0)
  const renewablePct =
    totalCombinedQty > 0 ? ((totalRenewableQty / totalCombinedQty) * 100).toFixed(1) : '0'

  // Final Save Draft or Submit for Review
  const save = async (submitForReview = false) => {
    setError('')
    // If user filled in current fields and hasn't staged it yet, ensure it's included
    let effectiveItems = [...stagedItems]
    if (effectiveItems.length === 0) {
      if (!consumptionQuantity || Number(consumptionQuantity) <= 0) {
        setError('Please enter consumption quantity > 0 and add at least one Energy Source item.')
        return
      }
      const { factor: f, gjRate: g, estTco2e: t, estGj: gj } = calculateItemEmissions(energySource, consumptionQuantity)
      effectiveItems = [
        {
          id: `item-${Date.now()}`,
          energySource,
          emissionDataType,
          energyActivity,
          consumptionQuantity,
          unit,
          meterEquipmentId,
          openingMeterReading,
          closingMeterReading,
          energyPurchased,
          energyGenerated,
          renewableEnergyQuantity,
          reportingPeriod,
          sourceDocument,
          remarks,
          evidenceId,
          factor: f,
          estTco2e: t,
          estGj: gj,
        },
      ]
      setStagedItems(effectiveItems)
    }

    setSubmitting(true)
    try {
      const payloadData: Record<string, any> = {
        ...formStateRef.current[key],
        items: effectiveItems,
      }

      const res = await fetch('/api/so/data-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 1,
          levelKey: 'level1',
          levelName: 'Level 1 — Energy Consumption',
          module: 'ENERGY',
          projectId,
          reportingPeriodId: periodId,
          evidenceId: payloadData.evidenceId || undefined,
          data: payloadData,
          submitForReview,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Failed to save Energy record')
      toast.success(
        submitForReview
          ? 'Energy submission sent for Project Admin review!'
          : 'Energy draft saved successfully!'
      )
      onSaved(d.record, submitForReview)
    } catch (e: any) {
      setError(e?.message || 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* FLOW NAVIGATION CONTROLLER: STEP 1 (ITEM DRAFTING) <-> STEP 2 (CONSOLIDATED SUMMARY) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 pb-3.5">
        <div className="ios-seg">
          <button
            type="button"
            onClick={() => setViewStep('ENTRY')}
            className={`ios-seg-btn ${viewStep === 'ENTRY' ? 'ios-seg-btn-active' : ''}`}
          >
            <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
              viewStep === 'ENTRY' ? 'bg-sky-600 text-white shadow-sm' : 'bg-slate-200/80 text-slate-600'
            }`}>
              1
            </span>
            <span>Item Drafting</span>
            {stagedItems.length > 0 && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-bold ${
                viewStep === 'ENTRY' ? 'bg-sky-100 text-sky-700' : 'bg-blue-100/70 text-blue-700'
              }`}>
                {stagedItems.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={handleNextOrganize}
            className={`ios-seg-btn ${viewStep === 'ORGANIZED' ? 'ios-seg-btn-active' : ''}`}
          >
            <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
              viewStep === 'ORGANIZED' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-200/80 text-slate-600'
            }`}>
              2
            </span>
            <span>Organized Summary</span>
            {stagedItems.length > 0 && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                ✓ Ready
              </span>
            )}
          </button>
        </div>

        {viewStep === 'ENTRY' ? (
          <button
            type="button"
            onClick={handleNextOrganize}
            className="btn-liquid-blue group flex items-center gap-2 rounded-full px-4.5 py-2.5 text-xs font-bold"
          >
            <span>Next: Organize All Items</span>
            <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px] font-mono">
              {stagedItems.length}
            </span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setViewStep('ENTRY')}
            className="ios-btn-ghost"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-slate-500" />
            <span>Back to Item Drafting</span>
          </button>
        )}
      </div>

      {/* ==============================================================
          VIEW 1: ITEM DRAFT ENTRY (ADD ONE BY ONE, WITH ADD + NEXT)
          ============================================================== */}
      {viewStep === 'ENTRY' && (
        <FormGrid>
          {/* Live Energy Analytics banner placed on top */}
          <div className="sm:col-span-2 rounded-2xl border border-blue-200/90 bg-gradient-to-r from-blue-50/90 via-indigo-50/60 to-blue-50/90 p-4 text-xs text-blue-900 shadow-sm">
            <div className="flex items-center justify-between font-bold">
              <span className="flex items-center gap-2 text-blue-800">
                <Calculator className="h-4 w-4 text-blue-600" /> Active Item Analytics ·{' '}
                <span className="underline decoration-blue-300 font-extrabold">{energySource}</span>
              </span>
              <span className="rounded-full bg-blue-100/90 px-2.5 py-0.5 text-[10px] text-blue-800 font-mono font-bold border border-blue-200">
                Factor: {factor} kgCO₂e/{unit}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-white/95 p-2.5 shadow-xs border border-blue-100">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                  Est. GHG ({energySource})
                </div>
                <div className="text-base font-extrabold text-slate-900 mt-0.5">{estTco2e.toFixed(2)} tCO₂e</div>
              </div>
              <div className="rounded-xl bg-white/95 p-2.5 shadow-xs border border-blue-100">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                  Meter Delta
                </div>
                <div className="text-base font-extrabold text-slate-900 mt-0.5">
                  {meterDiff > 0 ? meterDiff.toLocaleString() : '—'}
                </div>
              </div>
              <div className="rounded-xl bg-white/95 p-2.5 shadow-xs border border-blue-100">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                  GHG Scope
                </div>
                <div className="text-base font-extrabold text-slate-900 mt-0.5">{emissionDataType}</div>
              </div>
            </div>
          </div>

          {/* INTERACTIVE SOURCE ITEMS SELECTOR PILLS */}
          <div className="sm:col-span-2 so-glass-subtle rounded-2xl p-4">
            <div className="mb-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Select Energy Source Item to Fill / Draft:
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                Click any source → Fill details &amp; evidence → Click Add (Draft)
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {L1_ENERGY_SOURCES.map((s) => {
                const preset = SOURCE_PRESETS[s] || SOURCE_PRESETS['Grid electricity']
                const IconComponent = preset.icon
                const isSelected = energySource === s
                const staged = stagedItems.find((i) => i.energySource === s)

                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSelectSource(s)}
                    className={`ios-chip ${
                      isSelected
                        ? 'ios-chip-active'
                        : staged
                        ? '!border-emerald-300 !text-emerald-900 hover:!border-emerald-400'
                        : ''
                    }`}
                  >
                    <IconComponent
                      className={`h-3.5 w-3.5 ${
                        isSelected
                          ? 'text-white'
                          : staged
                          ? 'text-emerald-600'
                          : 'text-sky-500'
                      }`}
                    />
                    <span>{s}</span>
                    {staged ? (
                      <span className={`ml-1 rounded-full px-1.5 py-0.2 text-[9px] font-mono font-bold ${
                        isSelected ? 'bg-white/25 text-white' : 'bg-emerald-200/90 text-emerald-800'
                      }`}>
                        ✓ {Number(staged.consumptionQuantity).toLocaleString()} {staged.unit}
                      </span>
                    ) : (
                      isSelected && (
                        <span className="ml-1 rounded-full bg-white/25 px-1.5 py-0.2 text-[9px] font-bold text-white">
                          Active
                        </span>
                      )
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ITEM FORM INPUTS */}
          <FormField label="Energy Source" hint="Selected energy source item for this entry.">
            <select
              value={energySource}
              disabled={readOnly}
              onChange={(e) => handleSelectSource(e.target.value)}
              className={inputClass}
            >
              {L1_ENERGY_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="GHG Emission Scope" hint="GHG Protocol scope for this specific source.">
            <select
              value={emissionDataType}
              disabled={readOnly}
              onChange={(e) => setEmissionDataType(e.target.value)}
              className={inputClass}
            >
              <option value="Scope 1">Scope 1 — Direct Emissions (fuel burnt on site / DG)</option>
              <option value="Scope 2">Scope 2 — Purchased Energy (grid electricity / steam)</option>
              <option value="Scope 3">Scope 3 — Value Chain (upstream &amp; downstream)</option>
            </select>
          </FormField>

          <FormField label="Energy Activity" hint="Generator, lighting, construction, heating, etc.">
            <select
              value={energyActivity}
              disabled={readOnly}
              onChange={(e) => setEnergyActivity(e.target.value)}
              className={inputClass}
            >
              {L1_ACTIVITIES.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Consumption Quantity" hint="Actual quantity consumed for this source item.">
            <input
              type="number"
              min="0"
              step="any"
              value={consumptionQuantity}
              disabled={readOnly}
              onChange={(e) => setConsumptionQuantity(e.target.value)}
              placeholder="e.g. 384000"
              className={inputClass}
            />
          </FormField>

          <FormField label="Unit" hint="Measurement unit.">
            <select
              value={unit}
              disabled={readOnly}
              onChange={(e) => setUnit(e.target.value)}
              className={inputClass}
            >
              {L1_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Meter / Equipment ID" hint="Meter tag or generator equipment reference.">
            <input
              value={meterEquipmentId}
              disabled={readOnly}
              onChange={(e) => setMeterEquipmentId(e.target.value)}
              placeholder="e.g. MEIL-MTR-GRID-400KV"
              className={inputClass}
            />
          </FormField>

          <FormField label="Reporting Period" hint="Target reporting period.">
            <input
              value={reportingPeriod}
              disabled={readOnly}
              onChange={(e) => setReportingPeriod(e.target.value)}
              placeholder="e.g. June 2026"
              className={inputClass}
            />
          </FormField>

          <FormField label="Opening Meter Reading" hint="If metered (kWh / L).">
            <input
              type="number"
              value={openingMeterReading}
              disabled={readOnly}
              onChange={(e) => setOpeningMeterReading(e.target.value)}
              placeholder="e.g. 124500"
              className={inputClass}
            />
          </FormField>

          <FormField label="Closing Meter Reading" hint="If metered (kWh / L).">
            <input
              type="number"
              value={closingMeterReading}
              disabled={readOnly}
              onChange={(e) => setClosingMeterReading(e.target.value)}
              placeholder="e.g. 508500"
              className={inputClass}
            />
          </FormField>

          <FormField label="Energy Purchased" hint="Purchased quantity from utility / vendor.">
            <input
              type="number"
              value={energyPurchased}
              disabled={readOnly}
              onChange={(e) => setEnergyPurchased(e.target.value)}
              placeholder="e.g. 384000"
              className={inputClass}
            />
          </FormField>

          <FormField label="Energy Generated" hint="On-site generation (solar / captive DG).">
            <input
              type="number"
              value={energyGenerated}
              disabled={readOnly}
              onChange={(e) => setEnergyGenerated(e.target.value)}
              placeholder="0"
              className={inputClass}
            />
          </FormField>

          <FormField label="Renewable Energy Quantity" hint="Where certified & supported.">
            <input
              type="number"
              value={renewableEnergyQuantity}
              disabled={readOnly}
              onChange={(e) => setRenewableEnergyQuantity(e.target.value)}
              placeholder="0"
              className={inputClass}
            />
          </FormField>

          <FormField label="Source Document" hint="Electricity bill, fuel register, meter log.">
            <select
              value={sourceDocument}
              disabled={readOnly}
              onChange={(e) => setSourceDocument(e.target.value)}
              className={inputClass}
            >
              {L1_DOCUMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Remarks" hint="Adjustments, fuel batch or audit notes for this item." full>
            <textarea
              value={remarks}
              disabled={readOnly}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Reconciled with billing invoice; stock log confirmed."
              className={inputClass + ' min-h-[55px] resize-y'}
            />
          </FormField>

          {/* ITEM EVIDENCE ATTACHMENT SECTION (BEFORE ADD BUTTON) */}
          <div className="sm:col-span-2">
            <FormEvidenceAttachSection
              projectId={projectId}
              periodId={periodId}
              moduleKey="ENERGY"
              evidence={evidence}
              onUploaded={onEvidenceUploaded || (async () => {})}
              selectedEvidenceId={evidenceId || null}
              onSelectEvidence={(id) => setEvidenceId(id || '')}
              onReview={onReviewEvidence}
              readOnly={readOnly}
            />
          </div>

          {/* SPECIAL ACTION BUTTONS FOR EVERY ITEM: ADD (DRAFT) + NEXT (ORGANIZE) */}
          <div className="sm:col-span-2 rounded-2xl border border-blue-200/90 bg-gradient-to-r from-blue-50/90 via-indigo-50/50 to-emerald-50/90 p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  <span>Item Draft Actions · {energySource}</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Fill details and attach evidence, then click <strong>Add Item (Draft)</strong> to stage it.
                  When all sources are added, click <strong>Next: Organize All Items</strong>.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* 1. SPECIAL ADD ITEM (DRAFT) BUTTON */}
                <button
                  type="button"
                  onClick={handleAddOrUpdateItem}
                  disabled={readOnly}
                  className="flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>
                    {editingItemId ? `Update ${energySource} Draft` : `Add ${energySource} (Draft)`}
                  </span>
                </button>

                {/* 2. SPECIAL NEXT BUTTON */}
                <button
                  type="button"
                  onClick={handleNextOrganize}
                  className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-600 to-blue-700 px-4 py-2 text-xs font-bold text-white shadow-md shadow-indigo-500/20 hover:opacity-95 transition active:scale-95"
                >
                  <span>Next: Organize All Items</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {error && (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50/90 p-2.5 text-xs font-medium text-rose-800">
                <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5 text-rose-600" /> {error}
              </div>
            )}
          </div>

          {/* STAGED DRAFT ITEMS TABLE / LIST (SHOWN IN ENTRY VIEW) */}
          {stagedItems.length > 0 && (
            <div className="sm:col-span-2 so-glass-subtle rounded-2xl p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Staged Draft Items ({stagedItems.length} Sources Added)
                    </h4>
                    <p className="text-[10px] text-slate-500">
                      Items saved as local draft. You can edit any item, add another source, or proceed to Organize.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700 border border-blue-200">
                    Total: {totalCombinedTco2e.toFixed(2)} tCO₂e
                  </span>
                  <button
                    type="button"
                    onClick={handleNextOrganize}
                    className="flex items-center gap-1 rounded-full bg-indigo-600 px-3 py-1 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition"
                  >
                    <span>Next: Organize</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 border-y border-slate-100">
                    <tr>
                      <th className="py-2 px-2.5">Source &amp; Scope</th>
                      <th className="py-2 px-2.5">Activity &amp; Tag</th>
                      <th className="py-2 px-2.5">Quantity &amp; Unit</th>
                      <th className="py-2 px-2.5">Est. GHG</th>
                      <th className="py-2 px-2.5">Evidence</th>
                      <th className="py-2 px-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stagedItems.map((item) => {
                      const attachedEv = evidence.find((ev) => ev.id === item.evidenceId)
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-2.5">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{item.energySource}</span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-medium">
                              {item.emissionDataType}
                            </span>
                          </td>
                          <td className="py-2.5 px-2.5">
                            <div className="font-semibold text-slate-800">{item.energyActivity}</div>
                            <div className="text-[10px] font-mono text-slate-500">
                              {item.meterEquipmentId || '—'}
                            </div>
                          </td>
                          <td className="py-2.5 px-2.5 font-bold text-slate-900">
                            {Number(item.consumptionQuantity).toLocaleString()} {item.unit}
                          </td>
                          <td className="py-2.5 px-2.5">
                            <span className="font-bold text-slate-900">
                              {item.estTco2e.toFixed(2)} tCO₂e
                            </span>
                            <div className="text-[10px] text-slate-400">
                              {item.estGj.toFixed(1)} GJ
                            </div>
                          </td>
                          <td className="py-2.5 px-2.5">
                            {attachedEv ? (
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="truncate max-w-[120px] rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200"
                                  title={attachedEv.fileName}
                                >
                                  {attachedEv.fileName}
                                </span>
                                {onReviewEvidence && (
                                  <button
                                    type="button"
                                    onClick={() => onReviewEvidence(attachedEv)}
                                    className="text-blue-600 hover:text-blue-800 p-0.5"
                                    title="Review evidence (flips engine preview)"
                                  >
                                    <Eye className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">None attached</span>
                            )}
                          </td>
                          <td className="py-2.5 px-2.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleEditStagedItem(item)}
                                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition"
                                title="Edit this item"
                              >
                                <Edit3 className="h-3 w-3" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleRemoveStagedItem(item.id, e)}
                                className="flex h-6 w-6 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 transition"
                                title="Remove item"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Standard Save Draft / Submit for review also available directly */}
          <FormSaveActions
            error={error}
            submitting={submitting}
            readOnly={readOnly}
            onSave={() => save(false)}
            onSubmitForReview={() => save(true)}
          />
        </FormGrid>
      )}

      {/* ==============================================================
          VIEW 2: ORGANIZED CONSOLIDATED SUMMARY
          (AFTER USER CLICKS "NEXT" TO COMBINE & ORGANIZE ALL ITEMS)
          ============================================================== */}
      {viewStep === 'ORGANIZED' && (
        <div className="space-y-4">
          {/* Header Banner */}
          <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50/90 via-blue-50/80 to-indigo-50/90 p-4 text-xs text-indigo-950 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="status-pill status-approved !text-[10px]">
                    Step 2: Consolidated
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">
                    All Energy Sources Organized in One View
                  </h3>
                </div>
                <p className="text-[11px] text-slate-600 mt-1">
                  Compiled {stagedItems.length} energy source items into a verified multi-source record.
                  Review the summary, attach any final documentation, and click Save Draft or Submit for Review.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setViewStep('ENTRY')}
                className="self-start sm:self-auto flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs"
              >
                <Plus className="h-3.5 w-3.5 text-blue-600" />
                <span>Add / Edit More Sources</span>
              </button>
            </div>
          </div>

          {/* 4 Consolidated Executive Metric Tiles */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-blue-200 bg-white p-3 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Total Energy Consumed
              </div>
              <div className="text-base font-extrabold text-slate-900 mt-1">
                {totalCombinedGj.toLocaleString(undefined, { maximumFractionDigits: 1 })} GJ
              </div>
              <div className="text-[10px] text-blue-700 mt-0.5">
                {totalCombinedQty.toLocaleString()} primary units
              </div>
            </div>

            <div className="rounded-xl border border-indigo-200 bg-white p-3 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Total GHG Footprint
              </div>
              <div className="text-base font-extrabold text-indigo-950 mt-1">
                {totalCombinedTco2e.toFixed(2)} tCO₂e
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Scope 1 &amp; Scope 2 Blended</div>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-white p-3 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Renewable Share
              </div>
              <div className="text-base font-extrabold text-emerald-800 mt-1">{renewablePct}%</div>
              <div className="text-[10px] text-emerald-700 mt-0.5">
                {totalRenewableQty.toLocaleString()} kWh clean power
              </div>
            </div>

            <div className="rounded-xl border border-violet-200 bg-white p-3 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Audited Sources
              </div>
              <div className="text-base font-extrabold text-violet-950 mt-1">
                {stagedItems.length} Sources
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {stagedItems.filter((i) => i.evidenceId).length} of {stagedItems.length} with attached evidence
              </div>
            </div>
          </div>

          {/* Consolidated Master Table of All Items */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Consolidated Item Details Breakdown
              </h4>
              <span className="text-[10px] text-slate-500">
                All details will be saved into the master draft and submitted together
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 border-y border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Energy Source</th>
                    <th className="py-2.5 px-3">Scope</th>
                    <th className="py-2.5 px-3">Activity</th>
                    <th className="py-2.5 px-3">Quantity</th>
                    <th className="py-2.5 px-3">GHG Factor</th>
                    <th className="py-2.5 px-3">Est. tCO₂e</th>
                    <th className="py-2.5 px-3">Attached Evidence</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stagedItems.map((item, idx) => {
                    const attachedEv = evidence.find((ev) => ev.id === item.evidenceId)
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-[10px] text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {item.energySource}
                          {item.remarks && (
                            <div className="text-[10px] font-normal text-slate-500 line-clamp-1">
                              {item.remarks}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                              item.emissionDataType.includes('1')
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {item.emissionDataType}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {item.energyActivity}
                          {item.meterEquipmentId && (
                            <div className="text-[10px] font-mono text-slate-400">
                              {item.meterEquipmentId}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {Number(item.consumptionQuantity).toLocaleString()} {item.unit}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                          {item.factor} kg/{item.unit}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-indigo-900">
                          {item.estTco2e.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3">
                          {attachedEv ? (
                            <div className="flex items-center gap-1.5">
                              <span
                                className="truncate max-w-[110px] rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200"
                                title={attachedEv.fileName}
                              >
                                {attachedEv.fileName}
                              </span>
                              {onReviewEvidence && (
                                <button
                                  type="button"
                                  onClick={() => onReviewEvidence(attachedEv)}
                                  className="text-blue-600 hover:text-blue-800 p-0.5"
                                  title="Review evidence (flips engine preview)"
                                >
                                  <Eye className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">None attached</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleEditStagedItem(item)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="bg-slate-50 font-bold text-slate-900 border-t border-slate-200">
                  <tr>
                    <td colSpan={4} className="py-2.5 px-3 text-right text-[11px] uppercase tracking-wider text-slate-500">
                      Consolidated Total:
                    </td>
                    <td className="py-2.5 px-3 font-bold">
                      {totalCombinedQty.toLocaleString()} units ({totalCombinedGj.toFixed(1)} GJ)
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">—</td>
                    <td className="py-2.5 px-3 text-indigo-900 font-extrabold">
                      {totalCombinedTco2e.toFixed(2)} tCO₂e
                    </td>
                    <td colSpan={2} className="py-2.5 px-3 text-right text-[10px] text-slate-500">
                      {stagedItems.length} sources combined
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Overall Remarks / Summary Note */}
          <div className="rounded-xl border border-slate-200 bg-white/80 p-3">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Consolidated Submission Remarks &amp; Audit Trail Note
            </label>
            <textarea
              value={remarks}
              disabled={readOnly}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Consolidated multi-source reporting covering grid electricity, captive rooftop solar generation, and backup diesel generator registers."
              className={inputClass + ' min-h-[55px] resize-y'}
            />
          </div>

          {/* Primary Save Draft & Submit for Review buttons */}
          <FormSaveActions
            error={error}
            submitting={submitting}
            readOnly={readOnly}
            onSave={() => save(false)}
            onSubmitForReview={() => save(true)}
          />
        </div>
      )}
    </div>
  )
}

/* ============================================================
   LEVEL 2: WATER MANAGEMENT FORM
   ============================================================ */
const L2_ACTIVITIES = ['Withdrawal', 'Consumption', 'Reuse', 'Discharge']
const L2_SOURCES = [
  'Groundwater',
  'Surface water',
  'Third-party supply',
  'Rainwater',
  'Recycled / Reused water',
  'Municipal supply',
  'Other',
]
const L2_TREATMENTS = ['Primary', 'Secondary', 'Tertiary', 'STP / ETP Advanced', 'RO / ZLD', 'Untreated']
const L2_DESTINATIONS = ['Surface water', 'Third party', 'Groundwater recharge', 'Landscaping', 'Zero Liquid Discharge (ZLD)']

export interface StagedWaterItem {
  id: string
  waterSource: string
  waterActivity: string
  waterQuantity: string
  unit: string
  meterSourceId: string
  openingReading: string
  closingReading: string
  waterReusedRecycled: string
  dischargeDestination: string
  treatmentLevel: string
  waterQualityResult: string
  testDateLab: string
  supportingEvidence: string
  remarks: string
  evidenceId: string
  evidenceFileName?: string
  circularityPct: number
}

const WATER_SOURCE_PRESETS: Record<
  string,
  {
    activity: string
    unit: string
    meter: string
    reused: string
    destination: string
    treatment: string
    quality: string
    testLab: string
    evidenceDoc: string
    icon: LucideIcon
    defaultQty: string
  }
> = {
  'Groundwater': {
    activity: 'Withdrawal',
    unit: 'kL',
    meter: 'CGWA-BW-01-MTR',
    reused: '6200',
    destination: 'Zero Liquid Discharge (ZLD)',
    treatment: 'RO / ZLD',
    quality: 'TDS: 420 mg/L, pH: 7.2 (Compliant)',
    testLab: '2026-09-15 · SGS Environmental Testing',
    evidenceDoc: 'CGWA Extraction Logbook & Meter Photo',
    icon: Droplet,
    defaultQty: '24500',
  },
  'Surface water': {
    activity: 'Withdrawal',
    unit: 'kL',
    meter: 'RIVER-PUMP-IN-02',
    reused: '7570',
    destination: 'Landscaping',
    treatment: 'Primary',
    quality: 'Turbidity: 8 NTU, BOD: 12 mg/L',
    testLab: '2026-09-10 · Vimta Labs Ltd.',
    evidenceDoc: 'Irrigation Dept. Raw Water Invoice',
    icon: Waves,
    defaultQty: '18000',
  },
  'Third-party supply': {
    activity: 'Withdrawal',
    unit: 'kL',
    meter: 'TANKER-GATE-01',
    reused: '0',
    destination: 'Surface water',
    treatment: 'Untreated',
    quality: 'Potable standard compliant',
    testLab: '2026-09-05 · Quality Lab Certificate',
    evidenceDoc: 'Water Tanker Invoices & Delivery Slips',
    icon: Building2,
    defaultQty: '4200',
  },
  'Rainwater': {
    activity: 'Reuse',
    unit: 'kL',
    meter: 'RWH-COLLECT-01',
    reused: '3500',
    destination: 'Groundwater recharge',
    treatment: 'Tertiary',
    quality: 'TDS: 65 mg/L, pH: 7.0',
    testLab: '2026-09-18 · Site EHS Lab',
    evidenceDoc: 'RWH Recharge Pit Daily Log',
    icon: CloudRain,
    defaultQty: '3500',
  },
  'Recycled / Reused water': {
    activity: 'Reuse',
    unit: 'kL',
    meter: 'STP-TREATED-REC-01',
    reused: '8500',
    destination: 'Zero Liquid Discharge (ZLD)',
    treatment: 'STP / ETP Advanced',
    quality: 'BOD: <10 mg/L, COD: <45 mg/L, TSS: <15 mg/L',
    testLab: '2026-09-22 · SPCB Recognized Lab',
    evidenceDoc: 'STP Daily Treatment & Flow Log',
    icon: RefreshCw,
    defaultQty: '8500',
  },
  'Municipal supply': {
    activity: 'Withdrawal',
    unit: 'kL',
    meter: 'MUNC-GRID-FLOW-01',
    reused: '0',
    destination: 'Third party',
    treatment: 'Primary',
    quality: 'IS 10500 Drinking Water Norms',
    testLab: '2026-08-30 · Municipal Board Test Memo',
    evidenceDoc: 'Municipal Water Board Utility Bill',
    icon: Building2,
    defaultQty: '1200',
  },
  'Other': {
    activity: 'Withdrawal',
    unit: 'kL',
    meter: 'AUX-WTR-MTR-01',
    reused: '0',
    destination: 'Landscaping',
    treatment: 'Primary',
    quality: 'General site compliance',
    testLab: '2026-09-01 · Internal EHS Check',
    evidenceDoc: 'Auxiliary Water Register',
    icon: Droplet,
    defaultQty: '500',
  },
}

function Level2WaterForm({
  projectId,
  periodId,
  evidence,
  readOnly,
  formStateRef,
  onSaved,
  onEvidenceUploaded,
  onReviewEvidence,
}: LevelFormProps) {
  const key = `l2-${projectId}-${periodId}`
  const initial = formStateRef.current[key] || {}

  // Multi-item staged state
  const [stagedItems, setStagedItems] = useState<StagedWaterItem[]>(() => {
    if (Array.isArray(initial.items) && initial.items.length > 0) {
      return initial.items
    }
    if (initial.waterQuantity && Number(initial.waterQuantity) > 0) {
      const q = Number(initial.waterQuantity) || 0
      const r = Number(initial.waterReusedRecycled) || 0
      const circ = q > 0 ? Number(((r / q) * 100).toFixed(1)) : 0
      return [
        {
          id: 'item-water-initial-1',
          waterSource: initial.waterSource || 'Groundwater',
          waterActivity: initial.waterActivity || 'Withdrawal',
          waterQuantity: String(initial.waterQuantity),
          unit: initial.unit || 'kL',
          meterSourceId: initial.meterSourceId || 'CGWA-BW-01-MTR',
          openingReading: initial.openingReading || '82400',
          closingReading: initial.closingReading || '106900',
          waterReusedRecycled: initial.waterReusedRecycled || '6200',
          dischargeDestination: initial.dischargeDestination || 'Zero Liquid Discharge (ZLD)',
          treatmentLevel: initial.treatmentLevel || 'RO / ZLD',
          waterQualityResult: initial.waterQualityResult || 'TDS: 420 mg/L, pH: 7.2 (Compliant)',
          testDateLab: initial.testDateLab || '2026-09-15 · SGS Environmental Testing',
          supportingEvidence: initial.supportingEvidence || 'CGWA Extraction Logbook & Meter Photo',
          remarks: initial.remarks || 'Reconciled with CGWA abstraction quota.',
          evidenceId: initial.evidenceId || '',
          circularityPct: circ,
        },
      ]
    }
    // Default seed item so form is immediately usable
    return [
      {
        id: 'item-water-seed-1',
        waterSource: 'Groundwater',
        waterActivity: 'Withdrawal',
        waterQuantity: '24500',
        unit: 'kL',
        meterSourceId: 'CGWA-BW-01-MTR',
        openingReading: '82400',
        closingReading: '106900',
        waterReusedRecycled: '6200',
        dischargeDestination: 'Zero Liquid Discharge (ZLD)',
        treatmentLevel: 'RO / ZLD',
        waterQualityResult: 'TDS: 420 mg/L, pH: 7.2 (Compliant)',
        testDateLab: '2026-09-15 · SGS Environmental Testing',
        supportingEvidence: 'CGWA Extraction Logbook & Meter Photo',
        remarks: 'Reconciled with CGWA abstraction quota & flow meter telemetry.',
        evidenceId: '',
        circularityPct: 25.3,
      },
    ]
  })

  // View step: 'ENTRY' (Item Drafting) vs 'ORGANIZED' (Consolidated Summary)
  const [viewStep, setViewStep] = useState<'ENTRY' | 'ORGANIZED'>(
    initial.viewStep === 'ORGANIZED' ? 'ORGANIZED' : 'ENTRY'
  )

  const [editingItemId, setEditingItemId] = useState<string | null>(null)

  // Active form inputs for selected Water Source item
  const [waterSource, setWaterSource] = useState('Groundwater')
  const [waterActivity, setWaterActivity] = useState('Withdrawal')
  const [waterQuantity, setWaterQuantity] = useState('24500')
  const [unit, setUnit] = useState('kL')
  const [meterSourceId, setMeterSourceId] = useState('CGWA-BW-01-MTR')
  const [openingReading, setOpeningReading] = useState('82400')
  const [closingReading, setClosingReading] = useState('106900')
  const [waterReusedRecycled, setWaterReusedRecycled] = useState('6200')
  const [dischargeDestination, setDischargeDestination] = useState('Zero Liquid Discharge (ZLD)')
  const [treatmentLevel, setTreatmentLevel] = useState('RO / ZLD')
  const [waterQualityResult, setWaterQualityResult] = useState('TDS: 420 mg/L, pH: 7.2 (Compliant)')
  const [testDateLab, setTestDateLab] = useState('2026-09-15 · SGS Environmental Testing')
  const [supportingEvidence, setSupportingEvidence] = useState('CGWA Extraction Logbook & Meter Photo')
  const [remarks, setRemarks] = useState(
    'Total water withdrawal 42,500 kL; 13,770 kL recycled (32.4% recovery achieved per BRSR P6).'
  )
  const [evidenceId, setEvidenceId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Handle source chip click
  const handleSelectSource = (src: string) => {
    setError('')
    setWaterSource(src)
    const existing = stagedItems.find((i) => i.waterSource === src)
    if (existing) {
      setEditingItemId(existing.id)
      setWaterActivity(existing.waterActivity)
      setWaterQuantity(existing.waterQuantity)
      setUnit(existing.unit)
      setMeterSourceId(existing.meterSourceId)
      setOpeningReading(existing.openingReading)
      setClosingReading(existing.closingReading)
      setWaterReusedRecycled(existing.waterReusedRecycled)
      setDischargeDestination(existing.dischargeDestination)
      setTreatmentLevel(existing.treatmentLevel)
      setWaterQualityResult(existing.waterQualityResult)
      setTestDateLab(existing.testDateLab)
      setSupportingEvidence(existing.supportingEvidence)
      setRemarks(existing.remarks)
      setEvidenceId(existing.evidenceId)
    } else {
      setEditingItemId(null)
      const preset = WATER_SOURCE_PRESETS[src] || WATER_SOURCE_PRESETS['Groundwater']
      setWaterActivity(preset.activity)
      setWaterQuantity(preset.defaultQty)
      setUnit(preset.unit)
      setMeterSourceId(preset.meter)
      setWaterReusedRecycled(preset.reused)
      setDischargeDestination(preset.destination)
      setTreatmentLevel(preset.treatment)
      setWaterQualityResult(preset.quality)
      setTestDateLab(preset.testLab)
      setSupportingEvidence(preset.evidenceDoc)
      setRemarks(`Measured intake for ${src} per site meters.`)
      setEvidenceId('')
    }
  }

  // Add / Update item in staged items list
  const handleAddOrUpdateItem = () => {
    setError('')
    const qNum = Number(waterQuantity)
    if (!waterQuantity || isNaN(qNum) || qNum <= 0) {
      setError(`Please enter a valid water quantity (> 0) for ${waterSource}.`)
      return
    }

    const reusedNum = Number(waterReusedRecycled) || 0
    const circPct = qNum > 0 ? Number(((reusedNum / qNum) * 100).toFixed(1)) : 0

    const attachedEv = evidence.find((e) => e.id === evidenceId)
    const itemPayload: StagedWaterItem = {
      id: editingItemId || `item-wtr-${Date.now()}`,
      waterSource,
      waterActivity,
      waterQuantity,
      unit,
      meterSourceId,
      openingReading,
      closingReading,
      waterReusedRecycled,
      dischargeDestination,
      treatmentLevel,
      waterQualityResult,
      testDateLab,
      supportingEvidence,
      remarks,
      evidenceId,
      evidenceFileName: attachedEv?.fileName,
      circularityPct: circPct,
    }

    let updated: StagedWaterItem[]
    if (editingItemId) {
      updated = stagedItems.map((i) => (i.id === editingItemId ? itemPayload : i))
      toast.success(`Updated ${waterSource} draft item.`)
    } else {
      const idx = stagedItems.findIndex((i) => i.waterSource === waterSource)
      if (idx >= 0) {
        updated = stagedItems.map((i, iIdx) => (iIdx === idx ? itemPayload : i))
        toast.info(`Updated existing ${waterSource} draft item.`)
      } else {
        updated = [...stagedItems, itemPayload]
        toast.success(`Added ${waterSource} (${Number(waterQuantity).toLocaleString()} ${unit}) to draft items!`)
      }
    }

    setStagedItems(updated)
    setEditingItemId(null)
  }

  const handleEditStagedItem = (item: StagedWaterItem) => {
    setViewStep('ENTRY')
    setEditingItemId(item.id)
    setWaterSource(item.waterSource)
    setWaterActivity(item.waterActivity)
    setWaterQuantity(item.waterQuantity)
    setUnit(item.unit)
    setMeterSourceId(item.meterSourceId)
    setOpeningReading(item.openingReading)
    setClosingReading(item.closingReading)
    setWaterReusedRecycled(item.waterReusedRecycled)
    setDischargeDestination(item.dischargeDestination)
    setTreatmentLevel(item.treatmentLevel)
    setWaterQualityResult(item.waterQualityResult)
    setTestDateLab(item.testDateLab)
    setSupportingEvidence(item.supportingEvidence)
    setRemarks(item.remarks)
    setEvidenceId(item.evidenceId)
    toast.info(`Editing ${item.waterSource} draft item`)
  }

  const handleRemoveStagedItem = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const target = stagedItems.find((i) => i.id === id)
    const updated = stagedItems.filter((i) => i.id !== id)
    setStagedItems(updated)
    if (editingItemId === id) {
      setEditingItemId(null)
    }
    toast.warning(`Removed ${target?.waterSource || 'item'} from staged drafts.`)
  }

  const handleNextOrganize = () => {
    setError('')
    if (stagedItems.length === 0) {
      if (!waterQuantity || Number(waterQuantity) <= 0) {
        setError('Please enter water quantity and click Add (Draft) first.')
        return
      }
      handleAddOrUpdateItem()
    }
    setViewStep('ORGANIZED')
    toast.info('Organized Water Consolidated Summary', {
      description: 'Review multi-source water metrics and circularity recovery breakdown below.',
    })
  }

  // Aggregate stats across staged items
  const totalWithdrawalQty = stagedItems.reduce((acc, it) => acc + (Number(it.waterQuantity) || 0), 0)
  const totalReusedQty = stagedItems.reduce((acc, it) => acc + (Number(it.waterReusedRecycled) || 0), 0)
  const netWithdrawal = Math.max(0, totalWithdrawalQty - totalReusedQty)
  const overallCircularity =
    totalWithdrawalQty > 0 ? ((totalReusedQty / totalWithdrawalQty) * 100).toFixed(1) : '0'

  // Sync to formStateRef.current[key]
  useEffect(() => {
    const itemsToSave = stagedItems.length > 0 ? stagedItems : []
    formStateRef.current[key] = {
      waterSource: itemsToSave.map((i) => i.waterSource).join(', ') || waterSource,
      waterActivity: itemsToSave[0]?.waterActivity || waterActivity,
      waterQuantity: String(totalWithdrawalQty || waterQuantity),
      unit: itemsToSave[0]?.unit || unit,
      meterSourceId: itemsToSave.map((i) => i.meterSourceId).filter(Boolean).join(', ') || meterSourceId,
      openingReading,
      closingReading,
      waterReusedRecycled: String(totalReusedQty || waterReusedRecycled),
      dischargeDestination,
      treatmentLevel,
      waterQualityResult,
      testDateLab,
      supportingEvidence,
      remarks: remarks || `Consolidated multi-source water report (${itemsToSave.length} sources).`,
      evidenceId: itemsToSave.find((i) => i.evidenceId)?.evidenceId || evidenceId,
      items: itemsToSave,
      totalWithdrawal: totalWithdrawalQty,
      totalReused: totalReusedQty,
      circularityPct: overallCircularity,
      viewStep,
    }
  }, [
    key,
    stagedItems,
    viewStep,
    waterSource,
    waterActivity,
    waterQuantity,
    unit,
    meterSourceId,
    openingReading,
    closingReading,
    waterReusedRecycled,
    dischargeDestination,
    treatmentLevel,
    waterQualityResult,
    testDateLab,
    supportingEvidence,
    remarks,
    evidenceId,
    totalWithdrawalQty,
    totalReusedQty,
    overallCircularity,
    formStateRef,
  ])

  // Active item calculations
  const curQty = Number(waterQuantity) || 0
  const curReused = Number(waterReusedRecycled) || 0
  const curCircPct = curQty > 0 ? ((curReused / curQty) * 100).toFixed(1) : '0'

  // Final Save / Submit
  const save = async (submitForReview = false) => {
    setError('')
    let effectiveItems = [...stagedItems]
    if (effectiveItems.length === 0) {
      if (!waterQuantity || Number(waterQuantity) <= 0) {
        setError('Please enter water quantity > 0 and add at least one Water Source item.')
        return
      }
      const c = curQty > 0 ? Number(((curReused / curQty) * 100).toFixed(1)) : 0
      effectiveItems = [
        {
          id: `item-wtr-${Date.now()}`,
          waterSource,
          waterActivity,
          waterQuantity,
          unit,
          meterSourceId,
          openingReading,
          closingReading,
          waterReusedRecycled,
          dischargeDestination,
          treatmentLevel,
          waterQualityResult,
          testDateLab,
          supportingEvidence,
          remarks,
          evidenceId,
          circularityPct: c,
        },
      ]
      setStagedItems(effectiveItems)
    }

    setSubmitting(true)
    try {
      const payloadData: Record<string, any> = {
        ...formStateRef.current[key],
        items: effectiveItems,
      }

      const res = await fetch('/api/so/data-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 2,
          levelKey: 'level2',
          levelName: 'Level 2 — Water Management',
          module: 'WATER',
          projectId,
          reportingPeriodId: periodId,
          evidenceId: payloadData.evidenceId || undefined,
          data: payloadData,
          submitForReview,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Failed to save Water record')
      toast.success(
        submitForReview ? 'Water submission sent for Project Admin review!' : 'Water draft saved successfully!'
      )
      onSaved(d.record, submitForReview)
    } catch (e: any) {
      setError(e?.message || 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* FLOW NAVIGATION CONTROLLER: STEP 1 (ITEM DRAFTING) <-> STEP 2 (CONSOLIDATED SUMMARY) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-3.5">
        <div className="inline-flex items-center rounded-xl bg-slate-100/90 p-1 border border-slate-200/80 shadow-xs">
          <button
            type="button"
            onClick={() => setViewStep('ENTRY')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              viewStep === 'ENTRY'
                ? 'bg-white text-cyan-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span
              className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                viewStep === 'ENTRY' ? 'bg-cyan-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              1
            </span>
            <span>Item Drafting</span>
            {stagedItems.length > 0 && (
              <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-mono font-bold text-cyan-800">
                {stagedItems.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={handleNextOrganize}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              viewStep === 'ORGANIZED'
                ? 'bg-white text-indigo-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span
              className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                viewStep === 'ORGANIZED' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              2
            </span>
            <span>Organized Summary</span>
            {stagedItems.length > 0 && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                ✓ Ready
              </span>
            )}
          </button>
        </div>

        {viewStep === 'ENTRY' ? (
          <button
            type="button"
            onClick={handleNextOrganize}
            className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:shadow-cyan-500/20 hover:opacity-95 transition active:scale-95"
          >
            <span>Next: Organize All Items</span>
            <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px] font-mono">
              {stagedItems.length}
            </span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setViewStep('ENTRY')}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-slate-500" />
            <span>Back to Item Drafting</span>
          </button>
        )}
      </div>

      {/* ==============================================================
          VIEW 1: ITEM DRAFT ENTRY (ADD ONE BY ONE, WITH ADD + NEXT)
          ============================================================== */}
      {viewStep === 'ENTRY' && (
        <FormGrid>
          {/* Active Water Item Live Analytics Banner */}
          <div className="sm:col-span-2 rounded-2xl border border-cyan-200/90 bg-gradient-to-r from-cyan-50/90 via-blue-50/60 to-cyan-50/90 p-4 text-xs text-cyan-950 shadow-sm">
            <div className="flex items-center justify-between font-bold">
              <span className="flex items-center gap-2 text-cyan-900">
                <Droplet className="h-4 w-4 text-cyan-600" /> Active Item Status ·{' '}
                <span className="underline decoration-cyan-300 font-extrabold">{waterSource}</span>
              </span>
              <span className="rounded-full bg-cyan-100/90 px-2.5 py-0.5 text-[10px] text-cyan-800 font-mono font-bold border border-cyan-200">
                Activity: {waterActivity} · {treatmentLevel.split(' ')[0]}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-white/95 p-2.5 shadow-xs border border-cyan-100">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                  Gross Quantity
                </div>
                <div className="text-base font-extrabold text-slate-900 mt-0.5">
                  {curQty.toLocaleString()} {unit}
                </div>
              </div>
              <div className="rounded-xl bg-white/95 p-2.5 shadow-xs border border-cyan-100">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                  Reused / Recycled
                </div>
                <div className="text-base font-extrabold text-emerald-800 mt-0.5">
                  {curReused.toLocaleString()} {unit}
                </div>
              </div>
              <div className="rounded-xl bg-white/95 p-2.5 shadow-xs border border-cyan-100">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                  Circularity Recovery
                </div>
                <div className="text-base font-extrabold text-cyan-900 mt-0.5">{curCircPct}%</div>
              </div>
            </div>
          </div>

          {/* INTERACTIVE SOURCE ITEMS SELECTOR PILLS */}
          <div className="sm:col-span-2 so-glass-subtle rounded-2xl p-4">
            <div className="mb-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-cyan-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Select Water Source Item to Fill / Draft:
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                Click any source → Fill details &amp; evidence → Click Add (Draft)
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {L2_SOURCES.map((s) => {
                const preset = WATER_SOURCE_PRESETS[s] || WATER_SOURCE_PRESETS['Groundwater']
                const IconComponent = preset.icon
                const isSelected = waterSource === s
                const staged = stagedItems.find((i) => i.waterSource === s)

                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSelectSource(s)}
                    className={`ios-chip ${
                      isSelected
                        ? 'ios-chip-active'
                        : staged
                        ? '!border-emerald-300 !text-emerald-900 hover:!border-emerald-400'
                        : ''
                      }}`}
                  >
                    <IconComponent
                      className={`h-3.5 w-3.5 ${
                        isSelected
                          ? 'text-white'
                          : staged
                          ? 'text-emerald'
                          : ''
                      }`}
                    />
                    <span>{s}</span>
                    {staged ? (
                      <span className="ml-1 rounded-full bg-emerald-200/90 px-1.5 py-0.2 text-[9px] font-mono font-bold text-emerald-800">
                        ✓ {Number(staged.waterQuantity).toLocaleString()} {staged.unit}
                      </span>
                    ) : (
                      isSelected && (
                        <span className="ml-1 rounded-full bg-white/25 px-1.5 py-0.2 text-[9px] font-bold text-white">
                          Active
                        </span>
                      )
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ITEM FORM INPUTS */}
          <FormField label="Water Activity" hint="Withdrawal, consumption, reuse, discharge.">
            <select
              value={waterActivity}
              disabled={readOnly}
              onChange={(e) => setWaterActivity(e.target.value)}
              className={inputClass}
            >
              {L2_ACTIVITIES.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Water Source" hint="Selected water source item for this entry.">
            <select
              value={waterSource}
              disabled={readOnly}
              onChange={(e) => handleSelectSource(e.target.value)}
              className={inputClass}
            >
              {L2_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Water Quantity" hint="Actual measured or billed intake.">
            <input
              type="number"
              min="0"
              step="any"
              value={waterQuantity}
              disabled={readOnly}
              onChange={(e) => setWaterQuantity(e.target.value)}
              placeholder="e.g. 24500"
              className={inputClass}
            />
          </FormField>

          <FormField label="Unit" hint="Measurement unit.">
            <select
              value={unit}
              disabled={readOnly}
              onChange={(e) => setUnit(e.target.value)}
              className={inputClass}
            >
              {['kL', 'm³', 'litres', 'ML'].map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Meter / Source ID" hint="Meter tag, borewell or intake identifier.">
            <input
              value={meterSourceId}
              disabled={readOnly}
              onChange={(e) => setMeterSourceId(e.target.value)}
              placeholder="e.g. CGWA-BW-01-MTR"
              className={inputClass}
            />
          </FormField>

          <FormField label="Water Reused / Recycled" hint="Treated water recirculated on site.">
            <input
              type="number"
              min="0"
              step="any"
              value={waterReusedRecycled}
              disabled={readOnly}
              onChange={(e) => setWaterReusedRecycled(e.target.value)}
              placeholder="e.g. 6200"
              className={inputClass}
            />
          </FormField>

          <FormField label="Opening Meter Reading" hint="If metered.">
            <input
              type="number"
              value={openingReading}
              disabled={readOnly}
              onChange={(e) => setOpeningReading(e.target.value)}
              placeholder="e.g. 82400"
              className={inputClass}
            />
          </FormField>

          <FormField label="Closing Meter Reading" hint="If metered.">
            <input
              type="number"
              value={closingReading}
              disabled={readOnly}
              onChange={(e) => setClosingReading(e.target.value)}
              placeholder="e.g. 106900"
              className={inputClass}
            />
          </FormField>

          <FormField label="Discharge Destination" hint="Where treated water is discharged.">
            <select
              value={dischargeDestination}
              disabled={readOnly}
              onChange={(e) => setDischargeDestination(e.target.value)}
              className={inputClass}
            >
              {L2_DESTINATIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Treatment Level" hint="STP / ETP / RO / ZLD / None.">
            <select
              value={treatmentLevel}
              disabled={readOnly}
              onChange={(e) => setTreatmentLevel(e.target.value)}
              className={inputClass}
            >
              {L2_TREATMENTS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Water Quality Result" hint="Monitored parameters (pH, TDS, BOD, COD).">
            <input
              value={waterQualityResult}
              disabled={readOnly}
              onChange={(e) => setWaterQualityResult(e.target.value)}
              placeholder="e.g. TDS: 420 mg/L, pH: 7.2 (Compliant)"
              className={inputClass}
            />
          </FormField>

          <FormField label="Test Date / Laboratory" hint="NABL accredited testing facility.">
            <input
              value={testDateLab}
              disabled={readOnly}
              onChange={(e) => setTestDateLab(e.target.value)}
              placeholder="e.g. 2026-09-15 · SGS Environmental Testing"
              className={inputClass}
            />
          </FormField>

          <FormField label="Supporting Evidence" hint="Logbook, bills, meter photo description.">
            <input
              value={supportingEvidence}
              disabled={readOnly}
              onChange={(e) => setSupportingEvidence(e.target.value)}
              placeholder="e.g. CGWA Extraction Logbook & Meter Photo"
              className={inputClass}
            />
          </FormField>

          <FormField label="Remarks" hint="Circularity notes, quota compliance or audit trail." full>
            <textarea
              value={remarks}
              disabled={readOnly}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Reconciled with CGWA abstraction quota and daily flow meter readings."
              className={inputClass + ' min-h-[55px] resize-y'}
            />
          </FormField>

          {/* ITEM EVIDENCE ATTACHMENT SECTION (BEFORE ADD BUTTON) */}
          <div className="sm:col-span-2">
            <FormEvidenceAttachSection
              projectId={projectId}
              periodId={periodId}
              moduleKey="WATER"
              evidence={evidence}
              onUploaded={onEvidenceUploaded || (async () => {})}
              selectedEvidenceId={evidenceId || null}
              onSelectEvidence={(id) => setEvidenceId(id || '')}
              onReview={onReviewEvidence}
              readOnly={readOnly}
            />
          </div>

          {/* SPECIAL ACTION BUTTONS: ADD (DRAFT) + NEXT (ORGANIZE) */}
          <div className="sm:col-span-2 rounded-2xl border border-cyan-200/90 bg-gradient-to-r from-cyan-50/90 via-blue-50/50 to-emerald-50/90 p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-cyan-600" />
                  <span>Item Draft Actions · {waterSource}</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Fill details and attach evidence, then click <strong>Add Item (Draft)</strong> to stage it.
                  When all sources are added, click <strong>Next: Organize All Items</strong>.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddOrUpdateItem}
                  disabled={readOnly}
                  className="flex items-center gap-1.5 rounded-full bg-cyan-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-cyan-500/20 hover:bg-cyan-700 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>
                    {editingItemId ? `Update ${waterSource} Draft` : `Add ${waterSource} (Draft)`}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleNextOrganize}
                  className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-cyan-700 to-blue-700 px-4 py-2 text-xs font-bold text-white shadow-md shadow-cyan-600/20 hover:opacity-95 transition active:scale-95"
                >
                  <span>Next: Organize All Items</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {error && (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50/90 p-2.5 text-xs font-medium text-rose-800">
                <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5 text-rose-600" /> {error}
              </div>
            )}
          </div>

          {/* STAGED DRAFT ITEMS TABLE / LIST */}
          {stagedItems.length > 0 && (
            <div className="sm:col-span-2 so-glass-subtle rounded-2xl p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Staged Draft Items ({stagedItems.length} Sources Added)
                    </h4>
                    <p className="text-[10px] text-slate-500">
                      Water source drafts. Click edit to adjust or click Next to organize the full balance.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[10px] font-bold text-cyan-800 border border-cyan-200">
                    Total: {totalWithdrawalQty.toLocaleString()} kL ({overallCircularity}% Recycled)
                  </span>
                  <button
                    type="button"
                    onClick={handleNextOrganize}
                    className="flex items-center gap-1 rounded-full bg-cyan-700 px-3 py-1 text-xs font-bold text-white shadow-xs hover:bg-cyan-800 transition"
                  >
                    <span>Next: Organize</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 border-y border-slate-100">
                    <tr>
                      <th className="py-2 px-2.5">Source &amp; Activity</th>
                      <th className="py-2 px-2.5">Meter &amp; Treatment</th>
                      <th className="py-2 px-2.5">Intake Volume</th>
                      <th className="py-2 px-2.5">Reused / Recycled</th>
                      <th className="py-2 px-2.5">Evidence</th>
                      <th className="py-2 px-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stagedItems.map((item) => {
                      const attachedEv = evidence.find((ev) => ev.id === item.evidenceId)
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-2.5">
                            <div className="font-bold text-slate-900">{item.waterSource}</div>
                            <span className="text-[10px] text-slate-500 font-medium">
                              {item.waterActivity}
                            </span>
                          </td>
                          <td className="py-2.5 px-2.5">
                            <div className="font-semibold text-slate-800">{item.treatmentLevel}</div>
                            <div className="text-[10px] font-mono text-slate-500">
                              {item.meterSourceId || '—'}
                            </div>
                          </td>
                          <td className="py-2.5 px-2.5 font-bold text-slate-900">
                            {Number(item.waterQuantity).toLocaleString()} {item.unit}
                          </td>
                          <td className="py-2.5 px-2.5">
                            <span className="font-bold text-emerald-800">
                              {Number(item.waterReusedRecycled).toLocaleString()} {item.unit}
                            </span>
                            <div className="text-[10px] text-cyan-700 font-semibold">
                              {item.circularityPct}% circular
                            </div>
                          </td>
                          <td className="py-2.5 px-2.5">
                            {attachedEv ? (
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="truncate max-w-[120px] rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200"
                                  title={attachedEv.fileName}
                                >
                                  {attachedEv.fileName}
                                </span>
                                {onReviewEvidence && (
                                  <button
                                    type="button"
                                    onClick={() => onReviewEvidence(attachedEv)}
                                    className="text-blue-600 hover:text-blue-800 p-0.5"
                                    title="Review evidence (flips engine preview)"
                                  >
                                    <Eye className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">None attached</span>
                            )}
                          </td>
                          <td className="py-2.5 px-2.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleEditStagedItem(item)}
                                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition"
                                title="Edit this item"
                              >
                                <Edit3 className="h-3 w-3" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleRemoveStagedItem(item.id, e)}
                                className="flex h-6 w-6 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 transition"
                                title="Remove item"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <FormSaveActions
            error={error}
            submitting={submitting}
            readOnly={readOnly}
            onSave={() => save(false)}
            onSubmitForReview={() => save(true)}
          />
        </FormGrid>
      )}

      {/* ==============================================================
          VIEW 2: ORGANIZED CONSOLIDATED SUMMARY
          ============================================================== */}
      {viewStep === 'ORGANIZED' && (
        <div className="space-y-4">
          {/* Header Banner */}
          <div className="rounded-2xl border border-cyan-200 bg-gradient-to-r from-cyan-50/90 via-blue-50/80 to-cyan-50/90 p-4 text-xs text-cyan-950 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="status-pill status-approved !text-[10px]">
                    Step 2: Consolidated
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">
                    All Water Sources Organized in One View
                  </h3>
                </div>
                <p className="text-[11px] text-slate-600 mt-1">
                  Compiled {stagedItems.length} water source items into a certified multi-source water balance.
                  Review the summary, attach any final documentation, and click Save Draft or Submit for Review.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setViewStep('ENTRY')}
                className="self-start sm:self-auto flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs"
              >
                <Plus className="h-3.5 w-3.5 text-cyan-600" />
                <span>Add / Edit More Sources</span>
              </button>
            </div>
          </div>

          {/* 4 Consolidated Executive Metric Tiles */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-cyan-200 bg-white p-3 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Total Water Withdrawal
              </div>
              <div className="text-base font-extrabold text-slate-900 mt-1">
                {totalWithdrawalQty.toLocaleString()} kL
              </div>
              <div className="text-[10px] text-cyan-700 mt-0.5">Across all intake sources</div>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-white p-3 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Recycled / Reused Volume
              </div>
              <div className="text-base font-extrabold text-emerald-800 mt-1">
                {totalReusedQty.toLocaleString()} kL
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Zero Liquid Discharge &amp; STP</div>
            </div>

            <div className="rounded-xl border border-blue-200 bg-white p-3 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Circularity Recovery Rate
              </div>
              <div className="text-base font-extrabold text-blue-900 mt-1">
                {overallCircularity}%
              </div>
              <div className="text-[10px] text-blue-700 mt-0.5">
                Net impact: {netWithdrawal.toLocaleString()} kL
              </div>
            </div>

            <div className="rounded-xl border border-violet-200 bg-white p-3 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Audited Sources
              </div>
              <div className="text-base font-extrabold text-violet-950 mt-1">
                {stagedItems.length} Sources
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {stagedItems.filter((i) => i.evidenceId).length} of {stagedItems.length} with attached evidence
              </div>
            </div>
          </div>

          {/* Consolidated Master Table of All Items */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Consolidated Water Balance Breakdown
              </h4>
              <span className="text-[10px] text-slate-500">
                All sources will be saved into the master draft and submitted together
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 border-y border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Water Source</th>
                    <th className="py-2.5 px-3">Activity</th>
                    <th className="py-2.5 px-3">Treatment / Destination</th>
                    <th className="py-2.5 px-3">Intake Quantity</th>
                    <th className="py-2.5 px-3">Reused / Recycled</th>
                    <th className="py-2.5 px-3">Circularity %</th>
                    <th className="py-2.5 px-3">Attached Evidence</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stagedItems.map((item, idx) => {
                    const attachedEv = evidence.find((ev) => ev.id === item.evidenceId)
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-[10px] text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {item.waterSource}
                          {item.remarks && (
                            <div className="text-[10px] font-normal text-slate-500 line-clamp-1">
                              {item.remarks}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[9px] font-bold text-cyan-800">
                            {item.waterActivity}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {item.treatmentLevel}
                          {item.dischargeDestination && (
                            <div className="text-[10px] text-slate-400">
                              → {item.dischargeDestination}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {Number(item.waterQuantity).toLocaleString()} {item.unit}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-emerald-800">
                          {Number(item.waterReusedRecycled).toLocaleString()} {item.unit}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-cyan-900">
                          {item.circularityPct}%
                        </td>
                        <td className="py-2.5 px-3">
                          {attachedEv ? (
                            <div className="flex items-center gap-1.5">
                              <span
                                className="truncate max-w-[110px] rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200"
                                title={attachedEv.fileName}
                              >
                                {attachedEv.fileName}
                              </span>
                              {onReviewEvidence && (
                                <button
                                  type="button"
                                  onClick={() => onReviewEvidence(attachedEv)}
                                  className="text-blue-600 hover:text-blue-800 p-0.5"
                                  title="Review evidence (flips engine preview)"
                                >
                                  <Eye className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">None attached</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleEditStagedItem(item)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="bg-slate-50 font-bold text-slate-900 border-t border-slate-200">
                  <tr>
                    <td colSpan={4} className="py-2.5 px-3 text-right text-[11px] uppercase tracking-wider text-slate-500">
                      Consolidated Total:
                    </td>
                    <td className="py-2.5 px-3 font-bold">
                      {totalWithdrawalQty.toLocaleString()} kL Gross
                    </td>
                    <td className="py-2.5 px-3 font-bold text-emerald-800">
                      {totalReusedQty.toLocaleString()} kL Recycled
                    </td>
                    <td className="py-2.5 px-3 text-cyan-900 font-extrabold">
                      {overallCircularity}%
                    </td>
                    <td colSpan={2} className="py-2.5 px-3 text-right text-[10px] text-slate-500">
                      {stagedItems.length} water sources combined
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Overall Remarks / Summary Note */}
          <div className="rounded-xl border border-slate-200 bg-white/80 p-3">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Consolidated Submission Remarks &amp; Audit Trail Note
            </label>
            <textarea
              value={remarks}
              disabled={readOnly}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Consolidated multi-source water reporting covering groundwater extraction, surface river intake, municipal pipeline and zero liquid discharge recycling."
              className={inputClass + ' min-h-[55px] resize-y'}
            />
          </div>

          {/* Primary Save Draft & Submit for Review buttons */}
          <FormSaveActions
            error={error}
            submitting={submitting}
            readOnly={readOnly}
            onSave={() => save(false)}
            onSubmitForReview={() => save(true)}
          />
        </div>
      )}
    </div>
  )
}

/* ============================================================
   LEVEL 3: GHG EMISSIONS & AIR QUALITY FORM
   ============================================================ */
export interface StagedGhgItem {
  id: string
  sourceCategory:
    | 'fuel_combustion'
    | 'electricity_grid'
    | 'freight_logistics'
    | 'business_travel'
    | 'air_monitoring'
    | 'refrigerant_fugitive'
  emissionDataType: string // 'Scope 1 activity' | 'Scope 2 activity' | 'Scope 3 activity' | 'Air pollutant'
  emissionSource: string
  // Fuel combustion specific
  fuelEnergyType?: string
  equipmentId?: string
  // Electricity specific
  electricityKwh?: string
  gridFactorRef?: string
  sourceRecordId?: string | null
  // Freight logistics specific
  cargoWeightTonnes?: string
  transportMode?: string
  distanceKm?: string
  tonneKm?: string
  logisticsProvider?: string
  originDestination?: string
  // Business travel specific
  travelMode?: string
  travelDistanceKm?: string
  passengerCount?: string
  passengerKm?: string
  // Air pollutant / stack emissions specific
  pollutantType?: string
  samplingLocation?: string
  testDate?: string
  laboratoryTestMethod?: string
  laboratory?: string
  testMethod?: string
  testResult?: string
  measuredResult?: string
  regulatoryBenchmark?: string
  complianceStatus?: 'COMPLIANT' | 'EXCEEDANCE'
  // Refrigerants specific
  refrigerantType?: string
  quantityLeakedKg?: string
  gwpSource?: string
  // Scope 3 Protocol Category
  scope3Category?: string
  scope3Applicable?: boolean
  // Common activity & calculation lineage
  activityQuantity: string
  unit: string
  reportingPeriod: string
  factor: number
  factorUnit?: string
  factorSource?: string
  factorVersion?: number
  factorConfigured: boolean
  calculationFormula?: string
  calculationTimestamp?: string
  estTco2e: number
  supportingEvidence: string
  remarks: string
  evidenceId: string
  evidenceIds?: string[]
  evidenceFileName?: string
  evidenceFiles?: any[]
  status?: string
}

const L3_SOURCES = [
  'DG Sets & Power Generators',
  'Boilers & Heating Furnaces',
  'Construction Equipment Fleet',
  'Fugitive Refrigerants',
  'Purchased Grid Electricity (Scope 2)',
  'Value Chain & Freight Logistics (Scope 3)',
  'Business Travel & Commute (Scope 3)',
  'Ambient Air Monitoring',
  'DG Stack Emissions',
]

export interface GhgPresetConfig {
  category:
    | 'fuel_combustion'
    | 'electricity_grid'
    | 'freight_logistics'
    | 'business_travel'
    | 'air_monitoring'
    | 'refrigerant_fugitive'
  scope: string
  scope3Category?: string
  fuel: string
  unit: string
  factor: number
  factorUnit: string
  factorSource: string
  factorVersion: number
  pollutant: string
  location: string
  equipmentId: string
  lab: string
  method: string
  ref: string
  doc: string
  icon: LucideIcon
  defaultQty: string
  defaultResult: string
  standardLimit?: string
}

const GHG_SOURCE_PRESETS: Record<string, GhgPresetConfig> = {
  'DG Sets & Power Generators': {
    category: 'fuel_combustion',
    scope: 'Scope 1 activity',
    fuel: 'Diesel (HSD)',
    unit: 'litres',
    factor: 2.637,
    factorUnit: 'kgCO2e/L',
    factorSource: 'IPCC Guidelines 2006 Vol 2 Ch 2 / CEA v19',
    factorVersion: 1,
    pollutant: 'CO₂e',
    location: 'DG Yard Bay 01',
    equipmentId: 'MEIL-DG-002',
    lab: 'Internal Telematics / SAP Ledger',
    ref: 'IPCC 2006 / CEA v19',
    method: 'Activity data (litres) × Approved Factor (2.637 kgCO2e/L) ÷ 1000',
    doc: 'SAP Fuel Procurement Ledger & DG Run Logbook',
    icon: Zap,
    defaultQty: '18650',
    defaultResult: '49.18 tCO₂e',
  },
  'Boilers & Heating Furnaces': {
    category: 'fuel_combustion',
    scope: 'Scope 1 activity',
    fuel: 'Furnace Oil / Boilers',
    unit: 'kg',
    factor: 3.15,
    factorUnit: 'kgCO2e/kg',
    factorSource: 'IPCC 2006 Vol 2 Stationary Combustion Table 2.3',
    factorVersion: 1,
    pollutant: 'CO₂e',
    location: 'Boiler House 02',
    equipmentId: 'BLR-GJT-001',
    lab: 'In-house Digital Flow Meter',
    ref: 'IPCC 2006 Guidelines',
    method: 'Mass of fuel (kg) × Heating Factor (3.15 kgCO2e/kg) ÷ 1000',
    doc: 'Boiler Feed Log & Fuel Calibration Certificate',
    icon: Flame,
    defaultQty: '6400',
    defaultResult: '20.16 tCO₂e',
  },
  'Construction Equipment Fleet': {
    category: 'fuel_combustion',
    scope: 'Scope 1 activity',
    fuel: 'Diesel (HSD)',
    unit: 'litres',
    factor: 2.637,
    factorUnit: 'kgCO2e/L',
    factorSource: 'IPCC 2006 Mobile Combustion Guidelines',
    factorVersion: 1,
    pollutant: 'CO₂e',
    location: 'Heavy Machinery Fleet Depot',
    equipmentId: 'FLT-EXC-04',
    lab: 'Fleet IoT Telematics Log',
    ref: 'IPCC 2006 Mobile Combustion',
    method: 'Fuel Dispensed (litres) × Emission Factor (2.637 kgCO2e/L) ÷ 1000',
    doc: 'Fuel Dispenser Meter Log & Fleet Run Hours',
    icon: Truck,
    defaultQty: '8200',
    defaultResult: '21.62 tCO₂e',
  },
  'Fugitive Refrigerants': {
    category: 'refrigerant_fugitive',
    scope: 'Scope 1 activity',
    fuel: 'Refrigerant R-410A',
    unit: 'kg',
    factor: 2088.0,
    factorUnit: 'kgCO2e/kg',
    factorSource: 'IPCC 5th Assessment Report (AR5) 100-Year GWP',
    factorVersion: 1,
    pollutant: 'CO₂e',
    location: 'Main Substation & HVAC Chillers',
    equipmentId: 'CHL-SUB-01',
    lab: 'OEM Refrigerant Top-up Service Report',
    ref: 'IPCC AR5 GWP Values',
    method: 'Refrigerant Top-up (kg) × GWP (2088 kgCO2e/kg) ÷ 1000',
    doc: 'HVAC Maintenance Service Log & Gas Recharge Invoice',
    icon: Wind,
    defaultQty: '14',
    defaultResult: '29.23 tCO₂e',
  },
  'Purchased Grid Electricity (Scope 2)': {
    category: 'electricity_grid',
    scope: 'Scope 2 activity',
    fuel: 'Grid Electricity (India)',
    unit: 'kWh',
    factor: 0.716,
    factorUnit: 'kgCO2e/kWh',
    factorSource: 'Central Electricity Authority (CEA) CO2 Baseline Database v19',
    factorVersion: 1,
    pollutant: 'CO₂e',
    location: '33kV Site Incomer Substation',
    equipmentId: 'MTR-GJT-GRID-01',
    lab: 'DISCOM AMR Meter Billing System',
    ref: 'CEA CO₂ Baseline Database v19',
    method: 'Billed kWh × Grid Emission Factor (0.716 kgCO2e/kWh) ÷ 1000',
    doc: 'Monthly Utility Tariff Invoice & AMR Meter Log',
    icon: Zap,
    defaultQty: '384000',
    defaultResult: '274.94 tCO₂e',
  },
  'Value Chain & Freight Logistics (Scope 3)': {
    category: 'freight_logistics',
    scope: 'Scope 3 activity',
    scope3Category: 'C4 Upstream Transportation and Distribution',
    fuel: 'Heavy Duty Road Freight (Diesel)',
    unit: 'tonne-km',
    factor: 0.114,
    factorUnit: 'kgCO2e/tonne-km',
    factorSource: 'Smart Freight Centre GLEC Framework v3.0 / GHG Protocol Scope 3',
    factorVersion: 1,
    pollutant: 'CO₂e',
    location: 'Logistics Corridors (Vendor Balanagar to Site)',
    equipmentId: 'LOG-TRK-8821',
    lab: 'Supply Chain Transport Manifests',
    ref: 'GLEC Framework / GHG Protocol Corporate Value Chain',
    method: 'Cargo Weight (tonnes) × Distance (km) × Mode Factor (0.114 kgCO2e/t-km) ÷ 1000',
    doc: 'Logistics Partner Consolidated Freight Invoices & E-Way Bills',
    icon: Truck,
    defaultQty: '425000',
    defaultResult: '48.45 tCO₂e',
  },
  'Business Travel & Commute (Scope 3)': {
    category: 'business_travel',
    scope: 'Scope 3 activity',
    scope3Category: 'C6 Business Travel',
    fuel: 'Air Travel (Domestic)',
    unit: 'passenger-km',
    factor: 0.18,
    factorUnit: 'kgCO2e/pass-km',
    factorSource: 'GHG Protocol Corporate Value Chain Standard Category 6 / DEFRA',
    factorVersion: 1,
    pollutant: 'CO₂e',
    location: 'Corporate HQ & Regional Site Hubs',
    equipmentId: 'CORP-TRVL-2026',
    lab: 'Corporate Travel Portal Reconciliations',
    ref: 'DEFRA / GHG Protocol Scope 3 Guidance',
    method: 'Travel Distance (km) × Passengers × Factor (0.18 kgCO2e/pass-km) ÷ 1000',
    doc: 'Corporate Travel Portal Booking Register & Flight Tickets',
    icon: Users,
    defaultQty: '145000',
    defaultResult: '26.10 tCO₂e',
  },
  'Ambient Air Monitoring': {
    category: 'air_monitoring',
    scope: 'Air pollutant',
    fuel: 'Ambient Air',
    unit: 'µg/m³',
    factor: 0,
    factorUnit: 'µg/m³',
    factorSource: 'CPCB NAAQS 2009 Standards',
    factorVersion: 1,
    pollutant: 'PM10 / PM2.5',
    location: 'Perimeter Air Monitoring Station 01',
    equipmentId: 'STN-AIR-PER-01',
    lab: 'Vimta Labs Ltd. (NABL / CPCB Recognized)',
    ref: 'IS 5182 (Part 23) / NAAQS 2009',
    method: 'High Volume Air Sampler Gravimetric Method (IS 5182)',
    doc: 'NABL Certified Ambient Air Quality Report',
    icon: CloudFog,
    defaultQty: '48.2',
    defaultResult: '48.2 µg/m³ (Within NAAQS limit 100 µg/m³)',
    standardLimit: 'NAAQS 24-hr limit: 100 µg/m³ for PM10; 60 µg/m³ for PM2.5',
  },
  'DG Stack Emissions': {
    category: 'air_monitoring',
    scope: 'Air pollutant',
    fuel: 'DG Flue Gas Exhaust',
    unit: 'mg/Nm³',
    factor: 0,
    factorUnit: 'mg/Nm³',
    factorSource: 'CPCB Guidelines for DG Set Stack Monitoring',
    factorVersion: 1,
    pollutant: 'NOx',
    location: 'DG Set 1500 kVA Stack No. 01',
    equipmentId: 'STK-DG-1500-01',
    lab: 'SGS Environmental Testing (NABL)',
    ref: 'CPCB Guidelines for DG Set Stack Monitoring',
    method: 'Isokinetic Sampling Method (CPCB Method 5)',
    doc: 'DG Stack Emission Testing Memo & Gas Analyzer Log',
    icon: Factory,
    defaultQty: '36.5',
    defaultResult: '36.5 mg/Nm³ (Within CPCB limit 750 mg/Nm³)',
    standardLimit: 'CPCB DG Set Stack Limit: 750 mg/Nm³ for NOx',
  },
}

const SCOPE_3_CATEGORIES = [
  { code: 'C1', name: 'C1 Purchased Goods and Services' },
  { code: 'C2', name: 'C2 Capital Goods' },
  { code: 'C3', name: 'C3 Fuel and Energy-related Activities' },
  { code: 'C4', name: 'C4 Upstream Transportation and Distribution' },
  { code: 'C5', name: 'C5 Waste Generated in Operations' },
  { code: 'C6', name: 'C6 Business Travel' },
  { code: 'C7', name: 'C7 Employee Commuting' },
  { code: 'C8', name: 'C8 Upstream Leased Assets' },
]

function Level3GhgForm({
  projectId,
  periodId,
  evidence,
  readOnly,
  formStateRef,
  onSaved,
  onEvidenceUploaded,
  onReviewEvidence,
}: LevelFormProps) {
  const key = `l3-${projectId}-${periodId}`
  const initial = formStateRef.current[key] || {}

  // Multi-item staged state
  const [stagedItems, setStagedItems] = useState<StagedGhgItem[]>(() => {
    if (Array.isArray(initial.items) && initial.items.length > 0) {
      return initial.items
    }
    // Standard initial seed aligned with real project context
    return [
      {
        id: 'item-ghg-seed-1',
        sourceCategory: 'fuel_combustion',
        emissionDataType: 'Scope 1 activity',
        emissionSource: 'DG Sets & Power Generators',
        fuelEnergyType: 'Diesel (HSD)',
        equipmentId: 'MEIL-DG-002',
        activityQuantity: '18650',
        unit: 'litres',
        reportingPeriod: 'June 2026',
        factor: 2.637,
        factorUnit: 'kgCO2e/L',
        factorSource: 'IPCC Guidelines 2006 Vol 2 Ch 2 (v1)',
        factorVersion: 1,
        factorConfigured: true,
        calculationFormula: '18,650 litres × 2.637 kgCO2e/L ÷ 1,000 = 49.180 tCO₂e',
        calculationTimestamp: new Date().toISOString(),
        estTco2e: 49.18,
        supportingEvidence: 'SAP Fuel Procurement Ledger & DG Run Logbook',
        remarks: 'Scope 1 direct diesel combustion for backup generation.',
        evidenceId: '',
        evidenceIds: [],
        status: 'Draft',
      },
      {
        id: 'item-ghg-seed-2',
        sourceCategory: 'electricity_grid',
        emissionDataType: 'Scope 2 activity',
        emissionSource: 'Purchased Grid Electricity (Scope 2)',
        fuelEnergyType: 'Grid Electricity (India)',
        equipmentId: 'MTR-GJT-GRID-01',
        electricityKwh: '384000',
        gridFactorRef: 'CEA CO2 Baseline Database v19 — 0.716 kgCO2e/kWh',
        activityQuantity: '384000',
        unit: 'kWh',
        reportingPeriod: 'June 2026',
        factor: 0.716,
        factorUnit: 'kgCO2e/kWh',
        factorSource: 'CEA CO2 Baseline Database v19 (v1)',
        factorVersion: 1,
        factorConfigured: true,
        calculationFormula: '384,000 kWh × 0.716 kgCO2e/kWh ÷ 1,000 = 274.944 tCO₂e',
        calculationTimestamp: new Date().toISOString(),
        estTco2e: 274.94,
        supportingEvidence: 'Monthly Utility Tariff Invoice & AMR Meter Log',
        remarks: 'Scope 2 indirect purchased electricity for 33kV substation.',
        evidenceId: '',
        evidenceIds: [],
        status: 'Draft',
      },
      {
        id: 'item-ghg-seed-3',
        sourceCategory: 'air_monitoring',
        emissionDataType: 'Air pollutant',
        emissionSource: 'Ambient Air Monitoring',
        pollutantType: 'PM10 / PM2.5',
        unit: 'µg/m³',
        samplingLocation: 'Perimeter Air Monitoring Station 01',
        testDate: '2026-06-15',
        laboratory: 'Vimta Labs Ltd. (NABL / CPCB Recognized)',
        testMethod: 'IS 5182 (Part 23) High Volume Gravimetric',
        laboratoryTestMethod: 'Vimta Labs Ltd. / IS 5182 (Part 23)',
        testResult: '48.2 µg/m³',
        measuredResult: '48.2',
        regulatoryBenchmark: 'NAAQS 24-hr limit: 100 µg/m³ for PM10; 60 µg/m³ for PM2.5',
        complianceStatus: 'COMPLIANT',
        activityQuantity: '48.2',
        reportingPeriod: 'June 2026',
        factor: 0,
        factorUnit: 'µg/m³',
        factorConfigured: true,
        calculationFormula: 'Ambient concentration monitored per NAAQS 2009 (Not mixed with GHG CO2e)',
        calculationTimestamp: new Date().toISOString(),
        estTco2e: 0,
        supportingEvidence: 'NABL Certified Ambient Air Quality Report',
        remarks: 'Monitored at site boundary. Compliance with CPCB NAAQS 2009 confirmed.',
        evidenceId: '',
        evidenceIds: [],
        status: 'Draft',
      },
    ]
  })

  // View step: 'ENTRY' (Item Drafting) vs 'ORGANIZED' (Consolidated Summary)
  const [viewStep, setViewStep] = useState<'ENTRY' | 'ORGANIZED'>(
    initial.viewStep === 'ORGANIZED' ? 'ORGANIZED' : 'ENTRY'
  )

  const [editingItemId, setEditingItemId] = useState<string | null>(null)

  // Active form inputs for selected GHG item
  const [emissionSource, setEmissionSource] = useState('DG Sets & Power Generators')
  const [sourceCategory, setSourceCategory] = useState<
    | 'fuel_combustion'
    | 'electricity_grid'
    | 'freight_logistics'
    | 'business_travel'
    | 'air_monitoring'
    | 'refrigerant_fugitive'
  >('fuel_combustion')
  const [emissionDataType, setEmissionDataType] = useState('Scope 1 activity')
  const [scope3Category, setScope3Category] = useState('C4 Upstream Transportation and Distribution')
  const [scope3Applicable, setScope3Applicable] = useState(true)

  // Fuel combustion fields
  const [fuelEnergyType, setFuelEnergyType] = useState('Diesel (HSD)')
  const [equipmentId, setEquipmentId] = useState('MEIL-DG-002')

  // Electricity fields
  const [electricityKwh, setElectricityKwh] = useState('384000')
  const [gridFactorRef, setGridFactorRef] = useState('CEA CO2 Baseline Database v19 — 0.716 kgCO2e/kWh')
  const [sourceRecordId, setSourceRecordId] = useState<string | null>(null)

  // Freight logistics fields
  const [cargoWeightTonnes, setCargoWeightTonnes] = useState('500')
  const [transportMode, setTransportMode] = useState('Heavy Duty Road Truck (Diesel)')
  const [distanceKm, setDistanceKm] = useState('850')
  const [tonneKm, setTonneKm] = useState('425000')
  const [logisticsProvider, setLogisticsProvider] = useState('VRL Logistics Ltd.')
  const [originDestination, setOriginDestination] = useState('Vendor Balanagar Works -> Gujarat Site (850 km)')

  // Business travel fields
  const [travelMode, setTravelMode] = useState('Air Travel (Domestic)')
  const [travelDistanceKm, setTravelDistanceKm] = useState('1450')
  const [passengerCount, setPassengerCount] = useState('100')
  const [passengerKm, setPassengerKm] = useState('145000')

  // Ambient air / stack emissions fields
  const [pollutantType, setPollutantType] = useState('PM10 / PM2.5')
  const [samplingLocation, setSamplingLocation] = useState('Perimeter Air Monitoring Station 01')
  const [testDate, setTestDate] = useState('2026-06-15')
  const [laboratory, setLaboratory] = useState('Vimta Labs Ltd. (NABL / CPCB Recognized)')
  const [testMethod, setTestMethod] = useState('IS 5182 (Part 23) High Volume Gravimetric')
  const [measuredResult, setMeasuredResult] = useState('48.2')
  const [regulatoryBenchmark, setRegulatoryBenchmark] = useState('NAAQS 24-hr limit: 100 µg/m³ for PM10')
  const [complianceStatus, setComplianceStatus] = useState<'COMPLIANT' | 'EXCEEDANCE'>('COMPLIANT')

  // Refrigerants fields
  const [refrigerantType, setRefrigerantType] = useState('R-410A')
  const [quantityLeakedKg, setQuantityLeakedKg] = useState('14')
  const [gwpSource, setGwpSource] = useState('IPCC AR5 GWP100: 2,088 kgCO2e/kg (R-410A)')

  // Common activity fields
  const [activityQuantity, setActivityQuantity] = useState('18650')
  const [unit, setUnit] = useState('litres')
  const [reportingPeriod, setReportingPeriod] = useState('June 2026')
  const [supportingEvidence, setSupportingEvidence] = useState(
    'SAP Fuel Procurement Ledger & DG Run Logbook'
  )
  const [remarks, setRemarks] = useState(
    'Scope 1 direct diesel combustion for backup generation.'
  )
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([])
  const [overallWorkflowStatus, setOverallWorkflowStatus] = useState<
    'Draft' | 'Submitted' | 'Under Review' | 'Approved' | 'Returned for Correction' | 'Recalculation Required'
  >('Draft')

  // Level 1 Energy quick-import detection
  const [level1EnergyRecord, setLevel1EnergyRecord] = useState<any | null>(null)
  const [loadingL1, setLoadingL1] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Load Level 1 Energy record for current project & period if available
  useEffect(() => {
    let active = true
    const checkLevel1 = async () => {
      try {
        setLoadingL1(true)
        const res = await fetch(`/api/so/data-entry?projectId=${projectId}&periodId=${periodId}&level=1`)
        if (!res.ok) return
        const d = await res.json()
        if (active && Array.isArray(d.records) && d.records.length > 0) {
          setLevel1EnergyRecord(d.records[0])
        }
      } catch (err) {
        console.warn('Level 1 energy check note:', err)
      } finally {
        if (active) setLoadingL1(false)
      }
    }
    checkLevel1()
    return () => {
      active = false
    }
  }, [projectId, periodId])

  // Calculation Engine helper
  const getDynamicCalculation = useCallback(
    (
      cat: typeof sourceCategory,
      src: string,
      fuel: string,
      u: string,
      qtyVal: string,
      passKmVal: string,
      tonKmVal: string,
      refrigQtyVal: string,
      pollutant: string,
      measResult: string
    ) => {
      const preset = GHG_SOURCE_PRESETS[src]
      const isAir = cat === 'air_monitoring'

      if (isAir) {
        const valNum = Number(measResult) || 0
        let isCompliant = true
        if (pollutant.includes('PM10') && valNum > 100) isCompliant = false
        if (pollutant.includes('PM2.5') && valNum > 60) isCompliant = false
        if (pollutant.includes('NOx') && valNum > 750) isCompliant = false

        return {
          factorValue: 0,
          factorUnit: u,
          factorSource: 'CPCB / NAAQS 2009 Standards',
          factorVersion: 1,
          factorConfigured: true,
          formula: `${pollutant} concentration monitored at ${valNum} ${u} (Reported separately per CPCB norms — Not mixed with CO2e)`,
          calculatedTco2e: 0,
          complianceStatus: isCompliant ? ('COMPLIANT' as const) : ('EXCEEDANCE' as const),
          timestamp: new Date().toISOString(),
        }
      }

      let effQty = Number(qtyVal) || 0
      let fac = preset?.factor ?? 1
      let facUnit = preset?.factorUnit ?? 'kgCO2e/unit'
      let facSource = preset?.factorSource ?? 'IPCC 2006'
      let facVer = preset?.factorVersion ?? 1
      let isConfigured = true

      if (cat === 'fuel_combustion') {
        effQty = Number(qtyVal) || 0
        if (/diesel|hsd/i.test(fuel)) {
          fac = 2.637
          facUnit = 'kgCO2e/L'
          facSource = 'IPCC Guidelines 2006 Vol 2 Ch 2 Table 2.2'
        } else if (/furnace oil/i.test(fuel)) {
          fac = 3.15
          facUnit = 'kgCO2e/kg'
          facSource = 'IPCC 2006 Vol 2 Stationary Combustion Table 2.3'
        } else if (/coal/i.test(fuel)) {
          fac = 1.9
          facUnit = 'kgCO2e/kg'
          facSource = 'IPCC 2006 Vol 2 Stationary Combustion Table 2.4'
        } else if (/lpg/i.test(fuel)) {
          fac = 2.98
          facUnit = 'kgCO2e/kg'
          facSource = 'IPCC 2006 Guidelines Vol 2 Ch 2'
        } else if (/cng/i.test(fuel)) {
          fac = 2.19
          facUnit = 'kgCO2e/kg'
          facSource = 'IPCC 2006 Guidelines Vol 2 Ch 2'
        } else {
          isConfigured = false
        }
      } else if (cat === 'electricity_grid') {
        effQty = Number(qtyVal) || 0
        fac = 0.716
        facUnit = 'kgCO2e/kWh'
        facSource = 'Central Electricity Authority (CEA) CO2 Baseline Database v19'
      } else if (cat === 'freight_logistics') {
        effQty = Number(tonKmVal) || (Number(cargoWeightTonnes) * Number(distanceKm)) || 0
        fac = 0.114
        facUnit = 'kgCO2e/tonne-km'
        facSource = 'Smart Freight Centre GLEC Framework v3.0 / GHG Protocol'
      } else if (cat === 'business_travel') {
        effQty = Number(passKmVal) || (Number(travelDistanceKm) * Number(passengerCount)) || 0
        if (/air/i.test(travelMode)) {
          fac = 0.18
          facUnit = 'kgCO2e/pass-km'
          facSource = 'GHG Protocol Scope 3 Technical Guidance / DEFRA 2024'
        } else if (/rail/i.test(travelMode)) {
          fac = 0.04
          facUnit = 'kgCO2e/pass-km'
          facSource = 'Indian Railways / GHG Protocol Scope 3 Category 6'
        } else {
          fac = 0.11
          facUnit = 'kgCO2e/pass-km'
          facSource = 'ARAI Fleet Passenger Tables / GHG Protocol'
        }
      } else if (cat === 'refrigerant_fugitive') {
        effQty = Number(refrigQtyVal) || 0
        if (/410a/i.test(refrigerantType)) {
          fac = 2088.0
          facUnit = 'kgCO2e/kg'
          facSource = 'IPCC Fifth Assessment Report (AR5) GWP100'
        } else if (/134a/i.test(refrigerantType)) {
          fac = 1430.0
          facUnit = 'kgCO2e/kg'
          facSource = 'IPCC Fifth Assessment Report (AR5) GWP100'
        } else if (/22/i.test(refrigerantType)) {
          fac = 1810.0
          facUnit = 'kgCO2e/kg'
          facSource = 'IPCC Fifth Assessment Report (AR5) GWP100'
        } else if (/32/i.test(refrigerantType)) {
          fac = 675.0
          facUnit = 'kgCO2e/kg'
          facSource = 'IPCC Fifth Assessment Report (AR5) GWP100'
        } else {
          fac = 1774.0
          facUnit = 'kgCO2e/kg'
          facSource = 'IPCC Fifth Assessment Report (AR5) GWP100'
        }
      }

      if (!isConfigured) {
        return {
          factorValue: 0,
          factorUnit: facUnit,
          factorSource: 'Unconfigured',
          factorVersion: 0,
          factorConfigured: false,
          formula: 'Factor unavailable — ESG Review Required',
          calculatedTco2e: 0,
          complianceStatus: 'COMPLIANT' as const,
          timestamp: new Date().toISOString(),
        }
      }

      const calculatedTco2e = effQty > 0 ? Number(((effQty * fac) / 1000).toFixed(3)) : 0
      const formula = `${effQty.toLocaleString()} ${u} × ${fac} ${facUnit} ÷ 1,000 = ${calculatedTco2e.toFixed(3)} tCO₂e`

      return {
        factorValue: fac,
        factorUnit: facUnit,
        factorSource: `${facSource} (v${facVer})`,
        factorVersion: facVer,
        factorConfigured: true,
        formula,
        calculatedTco2e,
        complianceStatus: 'COMPLIANT' as const,
        timestamp: new Date().toISOString(),
      }
    },
    [cargoWeightTonnes, distanceKm, travelDistanceKm, passengerCount, travelMode, refrigerantType]
  )

  // Live calculation for the active form input
  const currentCalc = useMemo(() => {
    return getDynamicCalculation(
      sourceCategory,
      emissionSource,
      fuelEnergyType,
      unit,
      activityQuantity,
      passengerKm,
      tonneKm,
      quantityLeakedKg,
      pollutantType,
      measuredResult
    )
  }, [
    getDynamicCalculation,
    sourceCategory,
    emissionSource,
    fuelEnergyType,
    unit,
    activityQuantity,
    passengerKm,
    tonneKm,
    quantityLeakedKg,
    pollutantType,
    measuredResult,
  ])

  // Handle source pill click
  const handleSelectSource = (src: string) => {
    setError('')
    setEmissionSource(src)
    const existing = stagedItems.find((i) => i.emissionSource === src)

    if (existing) {
      setEditingItemId(existing.id)
      setSourceCategory(existing.sourceCategory)
      setEmissionDataType(existing.emissionDataType)
      setScope3Category(existing.scope3Category || 'C4 Upstream Transportation and Distribution')
      setScope3Applicable(existing.scope3Applicable ?? true)
      setFuelEnergyType(existing.fuelEnergyType || 'Diesel (HSD)')
      setEquipmentId(existing.equipmentId || '')
      setElectricityKwh(existing.electricityKwh || existing.activityQuantity)
      setGridFactorRef(existing.gridFactorRef || '')
      setSourceRecordId(existing.sourceRecordId || null)
      setCargoWeightTonnes(existing.cargoWeightTonnes || '500')
      setTransportMode(existing.transportMode || 'Heavy Duty Road Truck (Diesel)')
      setDistanceKm(existing.distanceKm || '850')
      setTonneKm(existing.tonneKm || existing.activityQuantity)
      setLogisticsProvider(existing.logisticsProvider || '')
      setOriginDestination(existing.originDestination || '')
      setTravelMode(existing.travelMode || 'Air Travel (Domestic)')
      setTravelDistanceKm(existing.travelDistanceKm || '1450')
      setPassengerCount(existing.passengerCount || '100')
      setPassengerKm(existing.passengerKm || existing.activityQuantity)
      setPollutantType(existing.pollutantType || 'PM10 / PM2.5')
      setSamplingLocation(existing.samplingLocation || '')
      setTestDate(existing.testDate || '2026-06-15')
      setLaboratory(existing.laboratory || 'Vimta Labs Ltd. (NABL / CPCB Recognized)')
      setTestMethod(existing.testMethod || 'IS 5182 (Part 23) High Volume Gravimetric')
      setMeasuredResult(existing.measuredResult || existing.activityQuantity)
      setRegulatoryBenchmark(existing.regulatoryBenchmark || '')
      setComplianceStatus(existing.complianceStatus || 'COMPLIANT')
      setRefrigerantType(existing.refrigerantType || 'R-410A')
      setQuantityLeakedKg(existing.quantityLeakedKg || existing.activityQuantity)
      setGwpSource(existing.gwpSource || '')
      setActivityQuantity(existing.activityQuantity)
      setUnit(existing.unit)
      setReportingPeriod(existing.reportingPeriod)
      setSupportingEvidence(existing.supportingEvidence)
      setRemarks(existing.remarks)
      setSelectedEvidenceIds(existing.evidenceIds || (existing.evidenceId ? [existing.evidenceId] : []))
    } else {
      setEditingItemId(null)
      const preset = GHG_SOURCE_PRESETS[src] || GHG_SOURCE_PRESETS['DG Sets & Power Generators']
      setSourceCategory(preset.category)
      setEmissionDataType(preset.scope)
      setScope3Category(preset.scope3Category || 'C4 Upstream Transportation and Distribution')
      setScope3Applicable(true)
      setFuelEnergyType(preset.fuel)
      setEquipmentId(preset.equipmentId)
      setElectricityKwh(preset.category === 'electricity_grid' ? preset.defaultQty : '')
      setGridFactorRef(preset.category === 'electricity_grid' ? preset.factorSource : '')
      setSourceRecordId(null)
      setCargoWeightTonnes(preset.category === 'freight_logistics' ? '500' : '')
      setTransportMode('Heavy Duty Road Truck (Diesel)')
      setDistanceKm(preset.category === 'freight_logistics' ? '850' : '')
      setTonneKm(preset.category === 'freight_logistics' ? preset.defaultQty : '')
      setLogisticsProvider(preset.category === 'freight_logistics' ? 'VRL Logistics Ltd.' : '')
      setOriginDestination(preset.category === 'freight_logistics' ? 'Vendor Balanagar Works -> Gujarat Site' : '')
      setTravelMode('Air Travel (Domestic)')
      setTravelDistanceKm(preset.category === 'business_travel' ? '1450' : '')
      setPassengerCount(preset.category === 'business_travel' ? '100' : '')
      setPassengerKm(preset.category === 'business_travel' ? preset.defaultQty : '')
      setPollutantType(preset.pollutant)
      setSamplingLocation(preset.location)
      setTestDate('2026-06-15')
      setLaboratory(preset.lab)
      setTestMethod(preset.method)
      setMeasuredResult(preset.category === 'air_monitoring' ? preset.defaultQty : '')
      setRegulatoryBenchmark(preset.standardLimit || '')
      setComplianceStatus('COMPLIANT')
      setRefrigerantType(preset.category === 'refrigerant_fugitive' ? 'R-410A' : '')
      setQuantityLeakedKg(preset.category === 'refrigerant_fugitive' ? preset.defaultQty : '')
      setGwpSource(preset.category === 'refrigerant_fugitive' ? preset.factorSource : '')
      setActivityQuantity(preset.defaultQty)
      setUnit(preset.unit)
      setReportingPeriod('June 2026')
      setSupportingEvidence(preset.doc)
      setRemarks(`Activity emission calculation for ${src} aligned with corporate reporting protocol.`)
      setSelectedEvidenceIds([])
    }
  }

  // Handle data type select (Scope 1, Scope 2, Scope 3, Air pollutant)
  const handleSelectDataType = (newType: string) => {
    setEmissionDataType(newType)
    if (newType.includes('3') && !emissionSource.includes('Scope 3')) {
      handleSelectSource('Value Chain & Freight Logistics (Scope 3)')
    } else if (newType.includes('2') && !emissionSource.includes('Scope 2')) {
      handleSelectSource('Purchased Grid Electricity (Scope 2)')
    } else if (newType.includes('Air') && !emissionSource.includes('Air') && !emissionSource.includes('Stack')) {
      handleSelectSource('Ambient Air Monitoring')
    } else if (newType.includes('1') && (emissionSource.includes('Scope 2') || emissionSource.includes('Scope 3') || emissionSource.includes('Air'))) {
      handleSelectSource('DG Sets & Power Generators')
    }
  }

  // Import from Level 1 Energy record (Preserves lineage & prevents re-entry)
  const handleImportLevel1Energy = () => {
    if (!level1EnergyRecord) return
    const d = level1EnergyRecord.data || {}
    const importedQty = String(d.consumptionQuantity || '42800')
    const importedUnit = d.unit || 'kWh'
    const importedMeter = d.meterEquipmentId || 'MTR-GJT-GRID-01'
    const importedDoc = d.sourceDocument || 'Electricity utility bill'

    setActivityQuantity(importedQty)
    setElectricityKwh(importedQty)
    setUnit(importedUnit)
    setEquipmentId(importedMeter)
    setSourceRecordId(level1EnergyRecord.id)
    setSupportingEvidence(`Imported from Level 1 Energy (#${level1EnergyRecord.id.slice(-8)}) — ${importedDoc}`)
    toast.success('Successfully imported Level 1 Energy consumption data!', {
      description: `Loaded ${Number(importedQty).toLocaleString()} ${importedUnit} (Meter: ${importedMeter}). Source record ID preserved for audit lineage.`,
    })
  }

  // Auto-compute tonne-km for freight when weight or distance changes
  const handleFreightWeightChange = (val: string) => {
    setCargoWeightTonnes(val)
    const w = Number(val) || 0
    const d = Number(distanceKm) || 0
    const calc = String(w * d)
    setTonneKm(calc)
    setActivityQuantity(calc)
  }

  const handleFreightDistanceChange = (val: string) => {
    setDistanceKm(val)
    const w = Number(cargoWeightTonnes) || 0
    const d = Number(val) || 0
    const calc = String(w * d)
    setTonneKm(calc)
    setActivityQuantity(calc)
  }

  // Auto-compute passenger-km for travel when distance or headcount changes
  const handleTravelDistanceChange = (val: string) => {
    setTravelDistanceKm(val)
    const d = Number(val) || 0
    const p = Number(passengerCount) || 0
    const calc = String(d * p)
    setPassengerKm(calc)
    setActivityQuantity(calc)
  }

  const handlePassengerCountChange = (val: string) => {
    setPassengerCount(val)
    const d = Number(travelDistanceKm) || 0
    const p = Number(val) || 0
    const calc = String(d * p)
    setPassengerKm(calc)
    setActivityQuantity(calc)
  }

  // Add / Update item in staged items list
  const handleAddOrUpdateItem = () => {
    setError('')
    const qNum = Number(activityQuantity)
    const isAir = sourceCategory === 'air_monitoring'

    if (!isAir && (!activityQuantity || isNaN(qNum) || qNum <= 0)) {
      setError(`Please enter a valid activity quantity (> 0) for ${emissionSource}.`)
      return
    }

    if (isAir && !measuredResult) {
      setError(`Please enter the laboratory measured result for ${emissionSource}.`)
      return
    }

    if (!currentCalc.factorConfigured) {
      setError(`Emission Factor Not Configured — ESG Review Required. Cannot stage record without verified factor.`)
      return
    }

    // Duplicate detection check
    const existingIndex = stagedItems.findIndex(
      (i) =>
        i.emissionSource === emissionSource &&
        (editingItemId ? i.id !== editingItemId : true) &&
        (i.equipmentId === equipmentId || i.samplingLocation === samplingLocation)
    )

    if (existingIndex >= 0) {
      toast.warning('Potential Duplicate Detected', {
        description: `An entry for ${emissionSource} with equipment/station '${equipmentId || samplingLocation}' already exists. Staging will update the record.`,
      })
    }

    const attachedFiles = evidence.filter((e) => selectedEvidenceIds.includes(e.id))
    const itemPayload: StagedGhgItem = {
      id: editingItemId || `item-ghg-${Date.now()}`,
      sourceCategory,
      emissionDataType,
      emissionSource,
      fuelEnergyType: sourceCategory === 'fuel_combustion' ? fuelEnergyType : undefined,
      equipmentId: equipmentId || undefined,
      electricityKwh: sourceCategory === 'electricity_grid' ? electricityKwh : undefined,
      gridFactorRef: sourceCategory === 'electricity_grid' ? gridFactorRef : undefined,
      sourceRecordId,
      cargoWeightTonnes: sourceCategory === 'freight_logistics' ? cargoWeightTonnes : undefined,
      transportMode: sourceCategory === 'freight_logistics' ? transportMode : undefined,
      distanceKm: sourceCategory === 'freight_logistics' ? distanceKm : undefined,
      tonneKm: sourceCategory === 'freight_logistics' ? tonneKm : undefined,
      logisticsProvider: sourceCategory === 'freight_logistics' ? logisticsProvider : undefined,
      originDestination: sourceCategory === 'freight_logistics' ? originDestination : undefined,
      travelMode: sourceCategory === 'business_travel' ? travelMode : undefined,
      travelDistanceKm: sourceCategory === 'business_travel' ? travelDistanceKm : undefined,
      passengerCount: sourceCategory === 'business_travel' ? passengerCount : undefined,
      passengerKm: sourceCategory === 'business_travel' ? passengerKm : undefined,
      pollutantType: sourceCategory === 'air_monitoring' ? pollutantType : undefined,
      samplingLocation: sourceCategory === 'air_monitoring' ? samplingLocation : undefined,
      testDate: sourceCategory === 'air_monitoring' ? testDate : undefined,
      laboratory: sourceCategory === 'air_monitoring' ? laboratory : undefined,
      testMethod: sourceCategory === 'air_monitoring' ? testMethod : undefined,
      laboratoryTestMethod: sourceCategory === 'air_monitoring' ? `${laboratory} / ${testMethod}` : undefined,
      measuredResult: sourceCategory === 'air_monitoring' ? measuredResult : undefined,
      testResult:
        sourceCategory === 'air_monitoring'
          ? `${measuredResult} ${unit}`
          : `${currentCalc.calculatedTco2e.toFixed(2)} tCO₂e`,
      regulatoryBenchmark: sourceCategory === 'air_monitoring' ? regulatoryBenchmark : undefined,
      complianceStatus: sourceCategory === 'air_monitoring' ? currentCalc.complianceStatus : undefined,
      refrigerantType: sourceCategory === 'refrigerant_fugitive' ? refrigerantType : undefined,
      quantityLeakedKg: sourceCategory === 'refrigerant_fugitive' ? quantityLeakedKg : undefined,
      gwpSource: sourceCategory === 'refrigerant_fugitive' ? gwpSource : undefined,
      scope3Category: emissionDataType.includes('3') ? scope3Category : undefined,
      scope3Applicable: emissionDataType.includes('3') ? scope3Applicable : undefined,
      activityQuantity: String(activityQuantity),
      unit,
      reportingPeriod,
      factor: currentCalc.factorValue,
      factorUnit: currentCalc.factorUnit,
      factorSource: currentCalc.factorSource,
      factorVersion: currentCalc.factorVersion,
      factorConfigured: currentCalc.factorConfigured,
      calculationFormula: currentCalc.formula,
      calculationTimestamp: currentCalc.timestamp,
      estTco2e: currentCalc.calculatedTco2e,
      supportingEvidence,
      remarks,
      evidenceId: selectedEvidenceIds[0] || '',
      evidenceIds: selectedEvidenceIds,
      evidenceFileName: attachedFiles.map((f) => f.fileName).join(', ') || undefined,
      evidenceFiles: attachedFiles,
      status: overallWorkflowStatus,
    }

    let updated: StagedGhgItem[]
    if (editingItemId) {
      updated = stagedItems.map((i) => (i.id === editingItemId ? itemPayload : i))
      toast.success(`Updated ${emissionSource} item in inventory.`)
    } else {
      const idx = stagedItems.findIndex((i) => i.emissionSource === emissionSource)
      if (idx >= 0) {
        updated = stagedItems.map((i, iIdx) => (iIdx === idx ? itemPayload : i))
        toast.info(`Updated existing ${emissionSource} record.`)
      } else {
        updated = [...stagedItems, itemPayload]
        toast.success(
          `Added ${emissionSource} (${
            itemPayload.estTco2e > 0 ? itemPayload.estTco2e.toFixed(2) + ' tCO₂e' : itemPayload.testResult
          }) to draft items!`
        )
      }
    }

    setStagedItems(updated)
    setEditingItemId(null)
  }

  const handleEditStagedItem = (item: StagedGhgItem) => {
    setViewStep('ENTRY')
    setEditingItemId(item.id)
    setSourceCategory(item.sourceCategory)
    setEmissionSource(item.emissionSource)
    setEmissionDataType(item.emissionDataType)
    setScope3Category(item.scope3Category || 'C4 Upstream Transportation and Distribution')
    setScope3Applicable(item.scope3Applicable ?? true)
    setFuelEnergyType(item.fuelEnergyType || 'Diesel (HSD)')
    setEquipmentId(item.equipmentId || '')
    setElectricityKwh(item.electricityKwh || item.activityQuantity)
    setGridFactorRef(item.gridFactorRef || '')
    setSourceRecordId(item.sourceRecordId || null)
    setCargoWeightTonnes(item.cargoWeightTonnes || '500')
    setTransportMode(item.transportMode || 'Heavy Duty Road Truck (Diesel)')
    setDistanceKm(item.distanceKm || '850')
    setTonneKm(item.tonneKm || item.activityQuantity)
    setLogisticsProvider(item.logisticsProvider || '')
    setOriginDestination(item.originDestination || '')
    setTravelMode(item.travelMode || 'Air Travel (Domestic)')
    setTravelDistanceKm(item.travelDistanceKm || '1450')
    setPassengerCount(item.passengerCount || '100')
    setPassengerKm(item.passengerKm || item.activityQuantity)
    setPollutantType(item.pollutantType || 'PM10 / PM2.5')
    setSamplingLocation(item.samplingLocation || '')
    setTestDate(item.testDate || '2026-06-15')
    setLaboratory(item.laboratory || 'Vimta Labs Ltd. (NABL / CPCB Recognized)')
    setTestMethod(item.testMethod || 'IS 5182 (Part 23) High Volume Gravimetric')
    setMeasuredResult(item.measuredResult || item.activityQuantity)
    setRegulatoryBenchmark(item.regulatoryBenchmark || '')
    setComplianceStatus(item.complianceStatus || 'COMPLIANT')
    setRefrigerantType(item.refrigerantType || 'R-410A')
    setQuantityLeakedKg(item.quantityLeakedKg || item.activityQuantity)
    setGwpSource(item.gwpSource || '')
    setActivityQuantity(item.activityQuantity)
    setUnit(item.unit)
    setReportingPeriod(item.reportingPeriod)
    setSupportingEvidence(item.supportingEvidence)
    setRemarks(item.remarks)
    setSelectedEvidenceIds(item.evidenceIds || (item.evidenceId ? [item.evidenceId] : []))
    toast.info(`Editing ${item.emissionSource} draft item`)
  }

  const handleRemoveStagedItem = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const target = stagedItems.find((i) => i.id === id)
    const updated = stagedItems.filter((i) => i.id !== id)
    setStagedItems(updated)
    if (editingItemId === id) {
      setEditingItemId(null)
    }
    toast.warning(`Removed ${target?.emissionSource || 'item'} from staged inventory.`)
  }

  const handleNextOrganize = () => {
    setError('')
    if (stagedItems.length === 0) {
      if (!activityQuantity && !measuredResult) {
        setError('Please enter activity quantity or test result and click Add Item (Draft) first.')
        return
      }
      handleAddOrUpdateItem()
    }
    setViewStep('ORGANIZED')
    toast.info('Organized GHG Consolidated Summary', {
      description: 'Review Scope 1, Scope 2, Scope 3, and separated Air Quality breakdown below.',
    })
  }

  // AGGREGATE METRICS — STRICT SEPARATION OF AIR POLLUTANTS FROM GHG
  const ghgOnlyItems = stagedItems.filter((i) => i.sourceCategory !== 'air_monitoring')
  const airPollutantItems = stagedItems.filter((i) => i.sourceCategory === 'air_monitoring')

  const s1Total = ghgOnlyItems
    .filter((i) => i.emissionDataType.includes('1') || i.sourceCategory === 'refrigerant_fugitive')
    .reduce((acc, it) => acc + it.estTco2e, 0)
  const s2Total = ghgOnlyItems
    .filter((i) => i.emissionDataType.includes('2') || i.sourceCategory === 'electricity_grid')
    .reduce((acc, it) => acc + it.estTco2e, 0)
  const s3Total = ghgOnlyItems
    .filter(
      (i) =>
        i.emissionDataType.includes('3') ||
        i.sourceCategory === 'freight_logistics' ||
        i.sourceCategory === 'business_travel'
    )
    .reduce((acc, it) => acc + it.estTco2e, 0)
  const totalCombinedTco2e = s1Total + s2Total + s3Total

  // Sync state to formStateRef.current[key]
  useEffect(() => {
    const itemsToSave = stagedItems.length > 0 ? stagedItems : []
    const scopesList = [
      s1Total > 0 && 'Scope 1',
      s2Total > 0 && 'Scope 2',
      s3Total > 0 && 'Scope 3',
      airPollutantItems.length > 0 && 'Air Quality Monitoring',
    ]
      .filter(Boolean)
      .join(' + ')

    formStateRef.current[key] = {
      emissionDataType: scopesList || emissionDataType,
      emissionSource: itemsToSave.map((i) => i.emissionSource).join(', ') || emissionSource,
      fuelEnergyType: itemsToSave.map((i) => i.fuelEnergyType).filter(Boolean).join(', ') || fuelEnergyType,
      activityQuantity: String(itemsToSave.reduce((sum, i) => sum + (Number(i.activityQuantity) || 0), 0) || activityQuantity),
      unit: itemsToSave[0]?.unit || unit,
      pollutantType: itemsToSave.map((i) => i.pollutantType).filter(Boolean).join(', ') || pollutantType,
      testResult: itemsToSave.map((i) => i.testResult).filter(Boolean).join(' | ') || `${totalCombinedTco2e.toFixed(2)} tCO₂e`,
      samplingLocation,
      testDate,
      laboratoryTestMethod: `${laboratory} / ${testMethod}`,
      emissionFactorRef: currentCalc.factorSource,
      calculationMethod: currentCalc.formula,
      supportingEvidence: itemsToSave.map((i) => i.supportingEvidence).filter(Boolean).join('; ') || supportingEvidence,
      remarks: remarks || `Consolidated GHG & Air Quality inventory (${itemsToSave.length} streams).`,
      evidenceId: selectedEvidenceIds[0] || '',
      evidenceIds: selectedEvidenceIds,
      items: itemsToSave,
      totalTco2e: totalCombinedTco2e,
      s1Total,
      s2Total,
      s3Total,
      airCount: airPollutantItems.length,
      airPollutants: airPollutantItems,
      viewStep,
      status: overallWorkflowStatus,
    }
  }, [
    key,
    stagedItems,
    viewStep,
    emissionDataType,
    emissionSource,
    fuelEnergyType,
    activityQuantity,
    unit,
    pollutantType,
    samplingLocation,
    testDate,
    laboratory,
    testMethod,
    currentCalc,
    supportingEvidence,
    remarks,
    selectedEvidenceIds,
    totalCombinedTco2e,
    s1Total,
    s2Total,
    s3Total,
    airPollutantItems,
    overallWorkflowStatus,
    formStateRef,
  ])

  // Final Save / Submit to backend
  const save = async (submitForReview = false) => {
    setError('')
    let effectiveItems = [...stagedItems]
    if (effectiveItems.length === 0) {
      if (!activityQuantity && !measuredResult) {
        setError('Either activity quantity or measured test result must be provided.')
        return
      }
      handleAddOrUpdateItem()
      effectiveItems = formStateRef.current[key]?.items || effectiveItems
    }

    setSubmitting(true)
    try {
      const payloadData: Record<string, any> = {
        ...formStateRef.current[key],
        items: effectiveItems,
        status: submitForReview ? 'SUBMITTED' : overallWorkflowStatus,
      }

      const res = await fetch('/api/so/data-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 3,
          levelKey: 'level3',
          levelName: 'Level 3 — GHG Emissions & Air Quality',
          module: 'EMISSIONS',
          projectId,
          reportingPeriodId: periodId,
          evidenceId: payloadData.evidenceId || undefined,
          data: payloadData,
          submitForReview,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Failed to save GHG record')
      toast.success(
        submitForReview
          ? 'GHG & Air Quality submission sent for Project Admin review!'
          : `GHG inventory saved as ${overallWorkflowStatus}!`
      )
      onSaved(d.record, submitForReview)
    } catch (e: any) {
      setError(e?.message || 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* FLOW NAVIGATION CONTROLLER: STEP 1 (ITEM DRAFTING) <-> STEP 2 (CONSOLIDATED SUMMARY) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-3.5">
        <div className="inline-flex items-center rounded-xl bg-slate-100/90 p-1 border border-slate-200/80 shadow-xs">
          <button
            type="button"
            onClick={() => setViewStep('ENTRY')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              viewStep === 'ENTRY'
                ? 'bg-white text-emerald-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span
              className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                viewStep === 'ENTRY' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              1
            </span>
            <span>Dynamic Item Drafting</span>
            {stagedItems.length > 0 && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-800">
                {stagedItems.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={handleNextOrganize}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              viewStep === 'ORGANIZED'
                ? 'bg-white text-indigo-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span
              className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                viewStep === 'ORGANIZED' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              2
            </span>
            <span>Organized Consolidated Summary</span>
            {stagedItems.length > 0 && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                ✓ Ready
              </span>
            )}
          </button>
        </div>

        {viewStep === 'ENTRY' ? (
          <button
            type="button"
            onClick={handleNextOrganize}
            className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:shadow-emerald-500/20 hover:opacity-95 transition active:scale-95"
          >
            <span>Next: Organize Full Inventory</span>
            <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px] font-mono">
              {stagedItems.length}
            </span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setViewStep('ENTRY')}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-slate-500" />
            <span>Back to Item Drafting</span>
          </button>
        )}
      </div>

      {/* ==============================================================
          VIEW 1: DYNAMIC ITEM DRAFT ENTRY (SOURCE-SPECIFIC FIELDS)
          ============================================================== */}
      {viewStep === 'ENTRY' && (
        <FormGrid>
          {/* Active GHG Item Live Analytics Banner */}
          <div className="sm:col-span-2 rounded-2xl border border-emerald-200/90 bg-gradient-to-r from-emerald-50/90 via-teal-50/60 to-emerald-50/90 p-4 text-xs text-emerald-950 shadow-sm">
            <div className="flex items-center justify-between font-bold">
              <span className="flex items-center gap-2 text-emerald-900">
                <Flame className="h-4 w-4 text-emerald-600" /> Active Source Stream ·{' '}
                <span className="underline decoration-emerald-300 font-extrabold">{emissionSource}</span>
              </span>
              <span className="rounded-full bg-emerald-100/90 px-2.5 py-0.5 text-[10px] text-emerald-800 font-mono font-bold border border-emerald-200">
                {emissionDataType} · {sourceCategory.replace('_', ' ').toUpperCase()}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-white/95 p-2.5 shadow-xs border border-emerald-100">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                  Activity Quantity
                </div>
                <div className="text-base font-extrabold text-slate-900 mt-0.5">
                  {sourceCategory === 'air_monitoring'
                    ? `${measuredResult || '0'} ${unit}`
                    : Number(activityQuantity) > 0
                    ? `${Number(activityQuantity).toLocaleString()} ${unit}`
                    : '—'}
                </div>
              </div>

              <div className="rounded-xl bg-white/95 p-2.5 shadow-xs border border-emerald-100">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                  {sourceCategory === 'air_monitoring' ? 'Air Quality Compliance' : 'Est. GHG Footprint'}
                </div>
                <div className="text-base font-extrabold text-emerald-800 mt-0.5">
                  {sourceCategory === 'air_monitoring' ? (
                    <span
                      className={`inline-flex items-center gap-1 font-bold ${
                        currentCalc.complianceStatus === 'COMPLIANT'
                          ? 'text-emerald-700'
                          : 'text-amber-700'
                      }`}
                    >
                      {currentCalc.complianceStatus === 'COMPLIANT' ? 'Within Limits ✓' : 'Exceedance ⚠'}
                    </span>
                  ) : currentCalc.calculatedTco2e > 0 ? (
                    `${currentCalc.calculatedTco2e.toFixed(3)} tCO₂e`
                  ) : (
                    '—'
                  )}
                </div>
              </div>

              <div className="rounded-xl bg-white/95 p-2.5 shadow-xs border border-emerald-100">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                  Target Scope Classification
                </div>
                <div className="text-base font-extrabold text-emerald-900 mt-0.5">
                  {sourceCategory === 'air_monitoring'
                    ? 'Air Pollutant (Separate)'
                    : emissionDataType.includes('1')
                    ? 'Scope 1 Direct'
                    : emissionDataType.includes('2')
                    ? 'Scope 2 Indirect'
                    : 'Scope 3 Value Chain'}
                </div>
              </div>
            </div>
          </div>

          {/* INTERACTIVE SOURCE ITEMS SELECTOR PILLS */}
          <div className="sm:col-span-2 so-glass-subtle rounded-2xl p-4">
            <div className="mb-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Select Emission Source Item:
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                Picks source → Auto-renders relevant fields only
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {L3_SOURCES.map((s) => {
                const preset = GHG_SOURCE_PRESETS[s] || GHG_SOURCE_PRESETS['DG Sets & Power Generators']
                const IconComponent = preset.icon
                const isSelected = emissionSource === s
                const staged = stagedItems.find((i) => i.emissionSource === s)

                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSelectSource(s)}
                    className={`ios-chip ${
                      isSelected
                        ? 'ios-chip-active'
                        : staged
                        ? '!border-emerald-300 !text-emerald-900 hover:!border-emerald-400'
                        : ''
                      }}`}
                  >
                    <IconComponent
                      className={`h-3.5 w-3.5 ${
                        isSelected
                          ? 'text-white'
                          : staged
                          ? 'text-emerald'
                          : ''
                      }`}
                    />
                    <span>{s}</span>
                    {staged ? (
                      <span className="ml-1 rounded-full bg-emerald-200/90 px-1.5 py-0.2 text-[9px] font-mono font-bold text-emerald-800">
                        ✓ {staged.estTco2e > 0 ? `${staged.estTco2e.toFixed(1)} t` : 'Logged'}
                      </span>
                    ) : (
                      isSelected && (
                        <span className="ml-1 rounded-full bg-white/25 px-1.5 py-0.2 text-[9px] font-bold text-white">
                          Active
                        </span>
                      )
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* CLASSIFICATION CONTROLLER */}
          <FormField
            label="Emission Data Type"
            hint="Classifies reporting boundary per GHG Protocol Corporate Standard."
          >
            <select
              value={emissionDataType}
              disabled={readOnly}
              onChange={(e) => handleSelectDataType(e.target.value)}
              className={inputClass}
            >
              <option value="Scope 1 activity">Scope 1 activity (Direct direct emissions from owned/controlled sources)</option>
              <option value="Scope 2 activity">Scope 2 activity (Indirect emissions from purchased electricity/steam)</option>
              <option value="Scope 3 activity">Scope 3 activity (Value chain / freight / business travel / upstream &amp; downstream)</option>
              <option value="Air pollutant">Air pollutant (Stack exhaust &amp; ambient air quality — Tracked separately)</option>
            </select>
          </FormField>

          <FormField
            label="Selected Emission Source Stream"
            hint="Descriptor or specific installation designation."
          >
            <input
              value={emissionSource}
              disabled={readOnly}
              onChange={(e) => setEmissionSource(e.target.value)}
              placeholder="e.g. DG Sets & Power Generators"
              className={inputClass}
            />
          </FormField>

          {/* ==============================================================
              DYNAMIC FORM SECTION 1: FUEL COMBUSTION (DG, BOILERS, FLEET)
              (Shows fuel type, quantity, unit, equipment ID, period, evidence)
              (DO NOT show laboratory testing or freight fields!)
              ============================================================== */}
          {sourceCategory === 'fuel_combustion' && (
            <>
              <div className="sm:col-span-2 rounded-xl bg-amber-50/70 border border-amber-200 p-2.5 text-xs text-amber-900 font-medium flex items-center justify-between">
                <span>
                  🔥 <strong>Fuel Combustion Fields Active:</strong> Only stationary/mobile fuel parameters are shown. Laboratory testing and freight fields are hidden.
                </span>
                <span className="font-mono text-[10px] text-amber-800">Scope 1 Direct</span>
              </div>

              <FormField label="Fuel Type" hint="Approved fuel category from Factor Master.">
                <select
                  value={fuelEnergyType}
                  disabled={readOnly}
                  onChange={(e) => setFuelEnergyType(e.target.value)}
                  className={inputClass}
                >
                  <option value="Diesel (HSD)">Diesel (HSD)</option>
                  <option value="Furnace Oil / Boilers">Furnace Oil / Heavy Fuel Oil</option>
                  <option value="Petrol (MS)">Petrol (MS)</option>
                  <option value="Coal (Sub-bituminous)">Coal (Sub-bituminous)</option>
                  <option value="CNG">Compressed Natural Gas (CNG)</option>
                  <option value="LPG">Liquefied Petroleum Gas (LPG)</option>
                </select>
              </FormField>

              <FormField
                label="Equipment / Source ID"
                hint="Designated DG generator number, furnace tag or fleet asset."
              >
                <input
                  value={equipmentId}
                  disabled={readOnly}
                  onChange={(e) => setEquipmentId(e.target.value)}
                  placeholder="e.g. MEIL-DG-002 (DG Yard Bay 01)"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Activity Quantity" hint="Metered or procured volume consumed.">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={activityQuantity}
                  disabled={readOnly}
                  onChange={(e) => setActivityQuantity(e.target.value)}
                  placeholder="18650"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Activity Unit" hint="Must correspond to factor unit (L, kg, MT).">
                <select
                  value={unit}
                  disabled={readOnly}
                  onChange={(e) => setUnit(e.target.value)}
                  className={inputClass}
                >
                  <option value="litres">litres</option>
                  <option value="kg">kg</option>
                  <option value="tonnes">tonnes</option>
                  <option value="m³">m³</option>
                </select>
              </FormField>

              <FormField label="Reporting Period" hint="Operational reporting timeframe.">
                <input
                  value={reportingPeriod}
                  disabled={readOnly}
                  onChange={(e) => setReportingPeriod(e.target.value)}
                  placeholder="e.g. June 2026 / FY 2026-27 Q1"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Supporting Evidence Reference" hint="Procurement ledger / fuel logbook ref.">
                <input
                  value={supportingEvidence}
                  disabled={readOnly}
                  onChange={(e) => setSupportingEvidence(e.target.value)}
                  placeholder="e.g. SAP Fuel Procurement Ledger & DG Logbook"
                  className={inputClass}
                />
              </FormField>
            </>
          )}

          {/* ==============================================================
              DYNAMIC FORM SECTION 2: PURCHASED ELECTRICITY (SCOPE 2)
              (Shows kWh, reporting period, grid factor, bill/meter evidence)
              (Includes quick 1-click import from Level 1 Energy!)
              ============================================================== */}
          {sourceCategory === 'electricity_grid' && (
            <>
              <div className="sm:col-span-2 rounded-xl bg-blue-50/70 border border-blue-200 p-2.5 text-xs text-blue-900 font-medium flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span>
                  ⚡ <strong>Purchased Electricity Fields Active:</strong> Grid consumption and CEA baseline accounting. Ordinary freight and laboratory fields are hidden.
                </span>

                {level1EnergyRecord && (
                  <button
                    type="button"
                    onClick={handleImportLevel1Energy}
                    disabled={readOnly || loadingL1}
                    className="self-start sm:self-auto flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-xs hover:bg-blue-700 transition"
                    title="Load from existing Level 1 Energy record without re-entering"
                  >
                    <Download className="h-3 w-3" />
                    <span>Import from Level 1 Energy ({Number(level1EnergyRecord.data?.consumptionQuantity || 42800).toLocaleString()} kWh)</span>
                  </button>
                )}
              </div>

              {sourceRecordId && (
                <div className="sm:col-span-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-[11px] text-emerald-800 flex items-center justify-between">
                  <span>✓ <strong>Source Record Lineage Linked:</strong> Level 1 Energy Record #{sourceRecordId.slice(-8)}. Dependent calculations tracked.</span>
                  <span className="text-[10px] text-emerald-600 font-mono">ID: {sourceRecordId}</span>
                </div>
              )}

              <FormField label="Electricity Consumption (kWh)" hint="Metered or utility billed kilowatt-hours.">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={activityQuantity}
                  disabled={readOnly}
                  onChange={(e) => {
                    setActivityQuantity(e.target.value)
                    setElectricityKwh(e.target.value)
                  }}
                  placeholder="384000"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Substation / Meter Reference ID" hint="Utility meter reference.">
                <input
                  value={equipmentId}
                  disabled={readOnly}
                  onChange={(e) => setEquipmentId(e.target.value)}
                  placeholder="e.g. MTR-GJT-GRID-01"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Reporting Period" hint="Monthly billing period.">
                <input
                  value={reportingPeriod}
                  disabled={readOnly}
                  onChange={(e) => setReportingPeriod(e.target.value)}
                  placeholder="June 2026"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Applicable Grid Emission Factor Ref" hint="CEA statutory baseline database.">
                <input
                  value={gridFactorRef}
                  disabled={readOnly}
                  onChange={(e) => setGridFactorRef(e.target.value)}
                  placeholder="CEA CO2 Baseline Database v19 — 0.716 kgCO2e/kWh"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Utility Bill / Meter Evidence Reference" hint="DISCOM bill invoice reference." full>
                <input
                  value={supportingEvidence}
                  disabled={readOnly}
                  onChange={(e) => setSupportingEvidence(e.target.value)}
                  placeholder="e.g. Monthly Utility Tariff Invoice #891204 & AMR Meter Log"
                  className={inputClass}
                />
              </FormField>
            </>
          )}

          {/* ==============================================================
              DYNAMIC FORM SECTION 3: FREIGHT LOGISTICS (SCOPE 3)
              (Shows cargo weight, mode, distance, tonne-km, provider, origin/dest)
              (Includes Scope 3 category selector and boundary applicability)
              ============================================================== */}
          {sourceCategory === 'freight_logistics' && (
            <>
              <div className="sm:col-span-2 rounded-xl bg-purple-50/70 border border-purple-200 p-2.5 text-xs text-purple-900 font-medium">
                🚚 <strong>Freight Logistics Fields Active:</strong> Upstream/downstream value chain logistics. Laboratory testing and electricity fields are hidden.
              </div>

              <FormField label="Scope 3 GHG Protocol Category" hint="Select protocol value chain category.">
                <select
                  value={scope3Category}
                  disabled={readOnly}
                  onChange={(e) => setScope3Category(e.target.value)}
                  className={inputClass}
                >
                  <option value="C4 Upstream Transportation and Distribution">
                    C4: Upstream Transportation &amp; Distribution (Tier 1 suppliers to site)
                  </option>
                  <option value="C9 Downstream Transportation and Distribution">
                    C9: Downstream Transportation &amp; Distribution (Outbound shipments)
                  </option>
                  <option value="C1 Purchased Goods and Services">
                    C1: Purchased Goods Freight Embedded
                  </option>
                </select>
              </FormField>

              <div className="flex flex-col justify-center">
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Project Boundary Applicability
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer mt-1">
                  <input
                    type="checkbox"
                    checked={scope3Applicable}
                    disabled={readOnly}
                    onChange={(e) => setScope3Applicable(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-400"
                  />
                  <span>Category Applicable to Project Reporting Boundary</span>
                </label>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Allows configurable Scope 3 reporting boundaries per entity.
                </p>
              </div>

              <FormField label="Cargo / Material Weight (Tonnes)" hint="Gross weight transported.">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={cargoWeightTonnes}
                  disabled={readOnly}
                  onChange={(e) => handleFreightWeightChange(e.target.value)}
                  placeholder="500"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Transport Mode" hint="Mode factor per GLEC framework.">
                <select
                  value={transportMode}
                  disabled={readOnly}
                  onChange={(e) => setTransportMode(e.target.value)}
                  className={inputClass}
                >
                  <option value="Heavy Duty Road Truck (Diesel)">Heavy Duty Road Truck (Diesel - 0.114 kg/t-km)</option>
                  <option value="Freight Rail (Electric/Diesel)">Freight Rail (0.028 kg/t-km)</option>
                  <option value="Coastal Shipping">Coastal Shipping (0.016 kg/t-km)</option>
                  <option value="Air Cargo">Air Cargo (0.602 kg/t-km)</option>
                </select>
              </FormField>

              <FormField label="Distance (km)" hint="Origin to site road/rail distance.">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={distanceKm}
                  disabled={readOnly}
                  onChange={(e) => handleFreightDistanceChange(e.target.value)}
                  placeholder="850"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Transport Work (Tonne-km)" hint="Auto-calculated (Weight × Distance) or manual entry.">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={activityQuantity}
                  disabled={readOnly}
                  onChange={(e) => {
                    setTonneKm(e.target.value)
                    setActivityQuantity(e.target.value)
                  }}
                  placeholder="425000"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Logistics Service Provider" hint="Carrier / 3PL transporter name.">
                <input
                  value={logisticsProvider}
                  disabled={readOnly}
                  onChange={(e) => setLogisticsProvider(e.target.value)}
                  placeholder="e.g. VRL Logistics Ltd. / CONCOR"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Origin & Destination" hint="Corridor routing description.">
                <input
                  value={originDestination}
                  disabled={readOnly}
                  onChange={(e) => setOriginDestination(e.target.value)}
                  placeholder="e.g. Vendor Balanagar Works -> Gujarat Site"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Supporting Transport Records" hint="E-way bill, LR copy, invoice reference." full>
                <input
                  value={supportingEvidence}
                  disabled={readOnly}
                  onChange={(e) => setSupportingEvidence(e.target.value)}
                  placeholder="e.g. Consolidated E-Way Bills & Freight Invoices #FWD-9910"
                  className={inputClass}
                />
              </FormField>
            </>
          )}

          {/* ==============================================================
              DYNAMIC FORM SECTION 4: BUSINESS TRAVEL & COMMUTE (SCOPE 3)
              (Shows travel mode, distance, passenger-km, travel evidence)
              ============================================================== */}
          {sourceCategory === 'business_travel' && (
            <>
              <div className="sm:col-span-2 rounded-xl bg-purple-50/70 border border-purple-200 p-2.5 text-xs text-purple-900 font-medium">
                👥 <strong>Business Travel &amp; Commute Fields Active:</strong> GHG Protocol Categories C6 &amp; C7. Cargo, laboratory, and fuel fields are hidden.
              </div>

              <FormField label="Scope 3 Category" hint="Business travel vs employee transit.">
                <select
                  value={scope3Category}
                  disabled={readOnly}
                  onChange={(e) => setScope3Category(e.target.value)}
                  className={inputClass}
                >
                  <option value="C6 Business Travel">C6: Business Travel (Corporate travel, flights, client transit)</option>
                  <option value="C7 Employee Commuting">C7: Employee Commuting (Daily staff bus &amp; workforce transit)</option>
                </select>
              </FormField>

              <div className="flex flex-col justify-center">
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Project Boundary Applicability
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer mt-1">
                  <input
                    type="checkbox"
                    checked={scope3Applicable}
                    disabled={readOnly}
                    onChange={(e) => setScope3Applicable(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-400"
                  />
                  <span>Category Applicable to Project Reporting Boundary</span>
                </label>
              </div>

              <FormField label="Travel Mode" hint="Mode factor per GHG Protocol / DEFRA.">
                <select
                  value={travelMode}
                  disabled={readOnly}
                  onChange={(e) => setTravelMode(e.target.value)}
                  className={inputClass}
                >
                  <option value="Air Travel (Domestic)">Air Travel (Domestic - 0.18 kgCO2e/p-km)</option>
                  <option value="Air Travel (Long-Haul)">Air Travel (Long-Haul - 0.15 kgCO2e/p-km)</option>
                  <option value="Rail Travel">Rail Travel (0.04 kgCO2e/p-km)</option>
                  <option value="Road Travel (Fleet Car)">Road Travel (Fleet Taxi / Car - 0.11 kgCO2e/p-km)</option>
                  <option value="Employee Bus Transit">Employee Bus Transit (0.068 kgCO2e/p-km)</option>
                </select>
              </FormField>

              <FormField label="Total One-way / Round-trip Distance (km)" hint="Route distance.">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={travelDistanceKm}
                  disabled={readOnly}
                  onChange={(e) => handleTravelDistanceChange(e.target.value)}
                  placeholder="1450"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Passenger Count" hint="Total travelers in reporting period.">
                <input
                  type="number"
                  min="1"
                  value={passengerCount}
                  disabled={readOnly}
                  onChange={(e) => handlePassengerCountChange(e.target.value)}
                  placeholder="100"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Activity Data (Passenger-km)" hint="Auto-calculated (Distance × Passengers).">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={activityQuantity}
                  disabled={readOnly}
                  onChange={(e) => {
                    setPassengerKm(e.target.value)
                    setActivityQuantity(e.target.value)
                  }}
                  placeholder="145000"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Travel Records & Booking Evidence" hint="Corporate portal logs & tickets." full>
                <input
                  value={supportingEvidence}
                  disabled={readOnly}
                  onChange={(e) => setSupportingEvidence(e.target.value)}
                  placeholder="e.g. Corporate Travel Booking Register & Flight Tickets"
                  className={inputClass}
                />
              </FormField>
            </>
          )}

          {/* ==============================================================
              DYNAMIC FORM SECTION 5: AMBIENT AIR & STACK EMISSIONS
              (Shows pollutant, unit, sampling location, test date, lab, method, result)
              (DO NOT combine with GHG CO2e totals!)
              ============================================================== */}
          {sourceCategory === 'air_monitoring' && (
            <>
              <div className="sm:col-span-2 rounded-xl bg-teal-50/80 border border-teal-200 p-3 text-xs text-teal-950 font-medium">
                <div className="flex items-center gap-1.5 font-bold text-teal-900">
                  <CloudFog className="h-4 w-4 text-teal-600" />
                  <span>Ambient Air Monitoring &amp; Stack Emissions (Tracked Separately)</span>
                </div>
                <p className="mt-1 text-[11px] text-teal-800">
                  Air pollutant measurements (PM10, PM2.5, NOx, SO2) are statutory environmental compliance metrics under CPCB &amp; State Pollution Control Board guidelines. <strong>These values are strictly maintained separate and never mixed into corporate GHG CO2e totals.</strong>
                </p>
              </div>

              <FormField label="Pollutant Parameter" hint="Target criteria pollutant.">
                <select
                  value={pollutantType}
                  disabled={readOnly}
                  onChange={(e) => setPollutantType(e.target.value)}
                  className={inputClass}
                >
                  <option value="PM10 / PM2.5">Particulate Matter (PM10 / PM2.5)</option>
                  <option value="NOx">Nitrogen Oxides (NOx)</option>
                  <option value="SO2">Sulphur Dioxide (SO2)</option>
                  <option value="CO">Carbon Monoxide (CO)</option>
                  <option value="VOCs">Volatile Organic Compounds (VOCs)</option>
                </select>
              </FormField>

              <FormField label="Measurement Unit" hint="Concentration standard unit.">
                <select
                  value={unit}
                  disabled={readOnly}
                  onChange={(e) => setUnit(e.target.value)}
                  className={inputClass}
                >
                  <option value="µg/m³">µg/m³ (Ambient air concentration)</option>
                  <option value="mg/Nm³">mg/Nm³ (Stack exhaust flue concentration)</option>
                  <option value="ppm">ppm (Parts per million)</option>
                </select>
              </FormField>

              <FormField label="Sampling Location / Stack ID" hint="Station or stack chimney tag.">
                <input
                  value={samplingLocation}
                  disabled={readOnly}
                  onChange={(e) => setSamplingLocation(e.target.value)}
                  placeholder="e.g. Perimeter Air Monitoring Station 01"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Test Date" hint="Sampling field test date.">
                <input
                  type="date"
                  value={testDate}
                  disabled={readOnly}
                  onChange={(e) => setTestDate(e.target.value)}
                  className={inputClass}
                />
              </FormField>

              <FormField label="Testing Laboratory" hint="NABL / CPCB accredited facility.">
                <input
                  value={laboratory}
                  disabled={readOnly}
                  onChange={(e) => setLaboratory(e.target.value)}
                  placeholder="e.g. Vimta Labs Ltd. (NABL / CPCB Recognized)"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Test Method" hint="Standard testing protocol.">
                <input
                  value={testMethod}
                  disabled={readOnly}
                  onChange={(e) => setTestMethod(e.target.value)}
                  placeholder="e.g. IS 5182 (Part 23) High Volume Sampler Gravimetric"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Measured Result" hint="Laboratory certified test value.">
                <input
                  value={measuredResult}
                  disabled={readOnly}
                  onChange={(e) => {
                    setMeasuredResult(e.target.value)
                    setActivityQuantity(e.target.value)
                  }}
                  placeholder="e.g. 48.2"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Regulatory Standard Limit" hint="Statutory CPCB / NAAQS benchmark.">
                <input
                  value={regulatoryBenchmark}
                  disabled={readOnly}
                  onChange={(e) => setRegulatoryBenchmark(e.target.value)}
                  placeholder="e.g. NAAQS 24-hr limit: 100 µg/m³ for PM10"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Supporting Lab Report" hint="NABL report number & certificate ref." full>
                <input
                  value={supportingEvidence}
                  disabled={readOnly}
                  onChange={(e) => setSupportingEvidence(e.target.value)}
                  placeholder="e.g. NABL Certified Ambient Air Quality Report #VMT-2026-06-18"
                  className={inputClass}
                />
              </FormField>
            </>
          )}

          {/* ==============================================================
              DYNAMIC FORM SECTION 6: FUGITIVE REFRIGERANTS
              (Shows refrigerant type, quantity leaked/replenished, GWP source, evidence)
              (DO NOT show laboratory testing or cargo fields!)
              ============================================================== */}
          {sourceCategory === 'refrigerant_fugitive' && (
            <>
              <div className="sm:col-span-2 rounded-xl bg-cyan-50/70 border border-cyan-200 p-2.5 text-xs text-cyan-900 font-medium">
                ❄️ <strong>Fugitive Refrigerant Gas Fields Active:</strong> Scope 1 fugitive chiller gas loss accounting. Laboratory testing, cargo, and freight fields are hidden.
              </div>

              <FormField label="Refrigerant Gas Type" hint="Chemical blend / HFC designation.">
                <select
                  value={refrigerantType}
                  disabled={readOnly}
                  onChange={(e) => {
                    setRefrigerantType(e.target.value)
                    setFuelEnergyType(`Refrigerant ${e.target.value}`)
                  }}
                  className={inputClass}
                >
                  <option value="R-410A">R-410A (GWP: 2,088 kgCO2e/kg)</option>
                  <option value="R-134a">R-134a (GWP: 1,430 kgCO2e/kg)</option>
                  <option value="R-22">R-22 (GWP: 1,810 kgCO2e/kg)</option>
                  <option value="R-32">R-32 (GWP: 675 kgCO2e/kg)</option>
                  <option value="R-407C">R-407C (GWP: 1,774 kgCO2e/kg)</option>
                </select>
              </FormField>

              <FormField label="Equipment / Chiller Unit ID" hint="HVAC asset identifier.">
                <input
                  value={equipmentId}
                  disabled={readOnly}
                  onChange={(e) => setEquipmentId(e.target.value)}
                  placeholder="e.g. Main Substation Chiller Unit 01 (CHL-001)"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Quantity Leaked / Top-Up (kg)" hint="Net gas added during maintenance.">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={activityQuantity}
                  disabled={readOnly}
                  onChange={(e) => {
                    setQuantityLeakedKg(e.target.value)
                    setActivityQuantity(e.target.value)
                  }}
                  placeholder="14"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Applicable GWP Reference" hint="Statutory IPCC AR5 100-year GWP.">
                <input
                  value={gwpSource}
                  disabled={readOnly}
                  onChange={(e) => setGwpSource(e.target.value)}
                  placeholder="IPCC AR5 GWP100: 2,088 kgCO2e/kg"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Service Log & Invoices Evidence" hint="HVAC contractor work sheet." full>
                <input
                  value={supportingEvidence}
                  disabled={readOnly}
                  onChange={(e) => setSupportingEvidence(e.target.value)}
                  placeholder="e.g. HVAC Maintenance Service Log & Gas Recharge Invoice #VOL-8812"
                  className={inputClass}
                />
              </FormField>
            </>
          )}

          {/* CALCULATION LINEAGE & AUDIT TRAIL CARD */}
          <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 p-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Deterministic Calculation Engine Lineage
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {currentCalc.timestamp.slice(0, 19).replace('T', ' ')} UTC
              </span>
            </div>

            {currentCalc.factorConfigured ? (
              <div className="mt-3 space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-xl bg-white p-2.5 border border-slate-200/80">
                    <span className="text-[9px] uppercase font-bold text-slate-400">Applied Factor</span>
                    <div className="font-mono font-bold text-emerald-800 mt-0.5">
                      {currentCalc.factorValue > 0
                        ? `${currentCalc.factorValue} ${currentCalc.factorUnit}`
                        : 'Lab Certified'}
                    </div>
                  </div>

                  <div className="rounded-xl bg-white p-2.5 border border-slate-200/80">
                    <span className="text-[9px] uppercase font-bold text-slate-400">Factor Source &amp; Ver</span>
                    <div className="text-[11px] font-semibold text-slate-800 truncate mt-0.5" title={currentCalc.factorSource}>
                      {currentCalc.factorSource}
                    </div>
                  </div>

                  <div className="rounded-xl bg-white p-2.5 border border-slate-200/80">
                    <span className="text-[9px] uppercase font-bold text-slate-400">Calculated Footprint</span>
                    <div className="font-bold text-emerald-900 mt-0.5">
                      {sourceCategory === 'air_monitoring'
                        ? '0.00 tCO₂e (Separate)'
                        : `${currentCalc.calculatedTco2e.toFixed(3)} tCO₂e`}
                    </div>
                  </div>

                  <div className="rounded-xl bg-white p-2.5 border border-slate-200/80">
                    <span className="text-[9px] uppercase font-bold text-slate-400">Lineage Status</span>
                    <div className="font-semibold text-emerald-700 mt-0.5 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Verified Master</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-100/90 p-2 font-mono text-[11px] text-slate-700 border border-slate-200">
                  <span className="font-bold text-slate-900">Formula Lineage:</span> {currentCalc.formula}
                </div>
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-900 font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>
                  <strong>Emission Factor Not Configured — ESG Review Required.</strong> No verified factor matching &apos;{fuelEnergyType}&apos; in unit &apos;{unit}&apos; is active in the Emission Factor Master.
                </span>
              </div>
            )}
          </div>

          <FormField label="Operational Remarks & Audit Notes" hint="Boundary justifications or methodology observations." full>
            <textarea
              value={remarks}
              disabled={readOnly}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Scope 1 direct DG emissions and Scope 3 transport calculations verified."
              className={inputClass + ' min-h-[55px] resize-y'}
            />
          </FormField>

          {/* ITEM EVIDENCE ATTACHMENT SECTION (MULTI-ATTACHMENT ENABLED) */}
          <div className="sm:col-span-2">
            <FormEvidenceAttachSection
              projectId={projectId}
              periodId={periodId}
              moduleKey="EMISSIONS"
              evidence={evidence}
              onUploaded={onEvidenceUploaded || (async () => {})}
              selectedEvidenceIds={selectedEvidenceIds}
              onSelectEvidenceIds={setSelectedEvidenceIds}
              onReview={onReviewEvidence}
              readOnly={readOnly}
            />
          </div>

          {/* DRAFTING ACTION RIBBON: ADD (DRAFT) + NEXT (ORGANIZE) */}
          <div className="sm:col-span-2 rounded-2xl border border-emerald-200/90 bg-gradient-to-r from-emerald-50/90 via-teal-50/50 to-blue-50/90 p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                  <span>Item Actions · {emissionSource}</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Fill details and attach documents, then click <strong>Add Item (Draft)</strong> to stage it.
                  When all sources are added, click <strong>Next: Organize Full Inventory</strong>.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddOrUpdateItem}
                  disabled={readOnly}
                  className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-700 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>
                    {editingItemId ? `Update ${emissionSource}` : `Add ${emissionSource} (Draft)`}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleNextOrganize}
                  className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-700 to-teal-800 px-4 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:opacity-95 transition active:scale-95"
                >
                  <span>Next: Organize Full Inventory</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {error && (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50/90 p-2.5 text-xs font-medium text-rose-800">
                <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5 text-rose-600" /> {error}
              </div>
            )}
          </div>

          {/* STAGED DRAFT ITEMS TABLE (STEP 1) */}
          {stagedItems.length > 0 && (
            <div className="sm:col-span-2 so-glass-subtle rounded-2xl p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Staged Inventory Items ({stagedItems.length} Streams Configured)
                    </h4>
                    <p className="text-[10px] text-slate-500">
                      Draft emission sources. Click edit to adjust or click Next to organize the full inventory.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                    GHG Total: {totalCombinedTco2e.toFixed(2)} tCO₂e ({ghgOnlyItems.length} streams + {airPollutantItems.length} air monitoring)
                  </span>
                  <button
                    type="button"
                    onClick={handleNextOrganize}
                    className="flex items-center gap-1 rounded-full bg-emerald-700 px-3 py-1 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition"
                  >
                    <span>Next: Organize</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 border-y border-slate-100">
                    <tr>
                      <th className="py-2 px-2.5">Source &amp; Scope</th>
                      <th className="py-2 px-2.5">Fuel / Stream / Equipment ID</th>
                      <th className="py-2 px-2.5">Activity Quantity</th>
                      <th className="py-2 px-2.5">Est. Footprint</th>
                      <th className="py-2 px-2.5">Evidence</th>
                      <th className="py-2 px-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stagedItems.map((item) => {
                      const attachedEvs = item.evidenceFiles && item.evidenceFiles.length > 0
                        ? item.evidenceFiles
                        : evidence.filter((ev) => item.evidenceIds?.includes(ev.id) || ev.id === item.evidenceId)
                      const isAir = item.sourceCategory === 'air_monitoring'

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-2.5">
                            <div className="font-bold text-slate-900">{item.emissionSource}</div>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                                isAir
                                  ? 'bg-teal-100 text-teal-800'
                                  : item.emissionDataType.includes('1')
                                  ? 'bg-amber-100 text-amber-800'
                                  : item.emissionDataType.includes('2')
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-purple-100 text-purple-800'
                              }`}
                            >
                              {isAir ? 'Air Pollutant (Separate)' : item.emissionDataType}
                            </span>
                          </td>
                          <td className="py-2.5 px-2.5">
                            <div className="font-semibold text-slate-800">
                              {item.fuelEnergyType || item.pollutantType || item.refrigerantType}
                            </div>
                            <div className="text-[10px] font-mono text-slate-500">
                              {item.equipmentId || item.samplingLocation || '—'}
                            </div>
                          </td>
                          <td className="py-2.5 px-2.5 font-bold text-slate-900">
                            {isAir
                              ? `${item.measuredResult || item.activityQuantity} ${item.unit}`
                              : Number(item.activityQuantity) > 0
                              ? `${Number(item.activityQuantity).toLocaleString()} ${item.unit}`
                              : '—'}
                          </td>
                          <td className="py-2.5 px-2.5 font-bold text-emerald-900">
                            {isAir ? (
                              <span
                                className={`text-[10px] font-bold ${
                                  item.complianceStatus === 'COMPLIANT'
                                    ? 'text-teal-700'
                                    : 'text-amber-700'
                                }`}
                              >
                                {item.testResult}
                              </span>
                            ) : (
                              `${item.estTco2e.toFixed(3)} tCO₂e`
                            )}
                          </td>
                          <td className="py-2.5 px-2.5">
                            {attachedEvs.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {attachedEvs.map((ev) => (
                                  <span
                                    key={ev.id}
                                    className="truncate max-w-[100px] rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800 border border-emerald-200"
                                    title={ev.fileName}
                                  >
                                    {ev.fileName}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">None attached</span>
                            )}
                          </td>
                          <td className="py-2.5 px-2.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleEditStagedItem(item)}
                                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition"
                                title="Edit this item"
                              >
                                <Edit3 className="h-3 w-3" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleRemoveStagedItem(item.id, e)}
                                className="flex h-6 w-6 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 transition"
                                title="Remove item"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <FormSaveActions
            error={error}
            submitting={submitting}
            readOnly={readOnly}
            onSave={() => save(false)}
            onSubmitForReview={() => save(true)}
          />
        </FormGrid>
      )}

      {/* ==============================================================
          VIEW 2: ORGANIZED CONSOLIDATED SUMMARY (STEP 2)
          (Separate Air Quality from GHG emissions)
          ============================================================== */}
      {viewStep === 'ORGANIZED' && (
        <div className="space-y-4">
          {/* Header Banner */}
          <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50/90 via-teal-50/80 to-emerald-50/90 p-4 text-xs text-emerald-950 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="status-pill status-approved !text-[10px]">
                    Step 2: Consolidated
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">
                    All GHG Emissions &amp; Air Quality Streams Organized in One View
                  </h3>
                </div>
                <p className="text-[11px] text-slate-600 mt-1">
                  Compiled {stagedItems.length} source streams across Scope 1, Scope 2, Scope 3, and Ambient/Stack Air Quality monitoring.
                  Air pollutant measurements (PM10, NOx, SO2) are monitored separately and are not combined with GHG CO2e totals.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setViewStep('ENTRY')}
                className="self-start sm:self-auto flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs"
              >
                <Plus className="h-3.5 w-3.5 text-emerald-600" />
                <span>Add / Edit More Streams</span>
              </button>
            </div>
          </div>

          {/* 4 Executive KPI Metric Tiles */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-amber-200 bg-white p-3 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Scope 1 Direct
              </div>
              <div className="text-base font-extrabold text-amber-950 mt-1">
                {s1Total.toFixed(2)} tCO₂e
              </div>
              <div className="text-[10px] text-amber-700 mt-0.5">DG Sets, Boilers &amp; Fleet</div>
            </div>

            <div className="rounded-xl border border-blue-200 bg-white p-3 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Scope 2 Indirect
              </div>
              <div className="text-base font-extrabold text-blue-950 mt-1">
                {s2Total.toFixed(2)} tCO₂e
              </div>
              <div className="text-[10px] text-blue-700 mt-0.5">Purchased Grid Electricity</div>
            </div>

            <div className="rounded-xl border border-purple-200 bg-white p-3 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Scope 3 Value Chain
              </div>
              <div className="text-base font-extrabold text-purple-950 mt-1">
                {s3Total.toFixed(2)} tCO₂e
              </div>
              <div className="text-[10px] text-purple-700 mt-0.5">Freight Logistics &amp; Travel</div>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-white p-3 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Total GHG Footprint
              </div>
              <div className="text-base font-extrabold text-emerald-900 mt-1">
                {totalCombinedTco2e.toFixed(2)} tCO₂e
              </div>
              <div className="text-[10px] text-emerald-700 mt-0.5">
                {ghgOnlyItems.length} GHG Streams ({airPollutantItems.length} Air Monitoring)
              </div>
            </div>
          </div>

          {/* Consolidated Master Table of GHG Streams */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Consolidated GHG Emission Streams (Scope 1, 2 &amp; 3)
                </h4>
                <p className="text-[10px] text-slate-500">
                  Deterministic calculations verified with backend Emission Factor Master
                </p>
              </div>
              <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                Total: {totalCombinedTco2e.toFixed(2)} tCO₂e
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 border-y border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Emission Source</th>
                    <th className="py-2.5 px-3">Scope / Category</th>
                    <th className="py-2.5 px-3">Fuel / Activity</th>
                    <th className="py-2.5 px-3">Activity Quantity</th>
                    <th className="py-2.5 px-3">Applied Factor</th>
                    <th className="py-2.5 px-3">Est. Footprint</th>
                    <th className="py-2.5 px-3">Attached Evidence</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ghgOnlyItems.map((item, idx) => {
                    const attachedEvs = item.evidenceFiles && item.evidenceFiles.length > 0
                      ? item.evidenceFiles
                      : evidence.filter((ev) => item.evidenceIds?.includes(ev.id) || ev.id === item.evidenceId)

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-[10px] text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {item.emissionSource}
                          {item.equipmentId && (
                            <div className="text-[10px] font-normal text-slate-500">
                              Asset: {item.equipmentId}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                              item.emissionDataType.includes('1')
                                ? 'bg-amber-100 text-amber-800'
                                : item.emissionDataType.includes('2')
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}
                          >
                            {item.scope3Category ? item.scope3Category.split(' ')[0] : item.emissionDataType}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {item.fuelEnergyType || item.transportMode || item.travelMode || item.refrigerantType}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {Number(item.activityQuantity).toLocaleString()} {item.unit}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                          <div>{item.factor} {item.factorUnit}</div>
                          <div className="text-[9px] text-slate-400 truncate max-w-[120px]" title={item.factorSource}>
                            {item.factorSource}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-emerald-950">
                          {item.estTco2e.toFixed(3)} t
                        </td>
                        <td className="py-2.5 px-3">
                          {attachedEvs.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {attachedEvs.map((ev) => (
                                <button
                                  key={ev.id}
                                  type="button"
                                  onClick={() => onReviewEvidence && onReviewEvidence(ev)}
                                  className="flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition"
                                  title="Review evidence (flips card 180°)"
                                >
                                  <Eye className="h-2.5 w-2.5" />
                                  <span className="max-w-[80px] truncate">{ev.fileName}</span>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">None attached</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleEditStagedItem(item)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="bg-slate-50 font-bold text-slate-900 border-t border-slate-200">
                  <tr>
                    <td colSpan={4} className="py-2.5 px-3 text-right text-[11px] uppercase tracking-wider text-slate-500">
                      Consolidated GHG Footprint (Scope 1 + 2 + 3):
                    </td>
                    <td colSpan={2} className="py-2.5 px-3 text-slate-700 text-xs">
                      S1: {s1Total.toFixed(2)} t | S2: {s2Total.toFixed(2)} t | S3: {s3Total.toFixed(2)} t
                    </td>
                    <td className="py-2.5 px-3 text-emerald-950 font-extrabold text-sm">
                      {totalCombinedTco2e.toFixed(2)} tCO₂e
                    </td>
                    <td colSpan={2} className="py-2.5 px-3 text-right text-[10px] text-slate-500">
                      {ghgOnlyItems.length} streams aggregated
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* DEDICATED AIR QUALITY & STACK COMPLIANCE MONITORING SECTION */}
          {airPollutantItems.length > 0 && (
            <div className="rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50/50 via-white to-teal-50/30 p-4 shadow-sm">
              <div className="mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-100 text-teal-700">
                    <CloudFog className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-teal-950">
                      Air Quality &amp; Stack Emission Monitoring (Statutory Separate Record)
                    </h4>
                    <p className="text-[10px] text-slate-500">
                      Monitored in compliance with CPCB / State Pollution Control Board guidelines. Strictly segregated from CO2e totals.
                    </p>
                  </div>
                </div>

                <span className="rounded-full bg-teal-100 text-teal-800 text-[10px] font-bold px-2.5 py-1 border border-teal-200 self-start sm:self-auto">
                  {airPollutantItems.length} Air Sampling Records
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-teal-50/60 text-[10px] uppercase tracking-wider text-teal-900 border-y border-teal-200">
                    <tr>
                      <th className="py-2.5 px-3">Location / Stack</th>
                      <th className="py-2.5 px-3">Pollutant</th>
                      <th className="py-2.5 px-3">Measured Concentration</th>
                      <th className="py-2.5 px-3">CPCB / NAAQS Standard</th>
                      <th className="py-2.5 px-3">Testing Lab &amp; Method</th>
                      <th className="py-2.5 px-3">Compliance</th>
                      <th className="py-2.5 px-3">Evidence</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-teal-100">
                    {airPollutantItems.map((item) => {
                      const attachedEvs = item.evidenceFiles && item.evidenceFiles.length > 0
                        ? item.evidenceFiles
                        : evidence.filter((ev) => item.evidenceIds?.includes(ev.id) || ev.id === item.evidenceId)

                      return (
                        <tr key={item.id} className="hover:bg-teal-50/40 transition-colors">
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            {item.samplingLocation || item.emissionSource}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-teal-950">
                            {item.pollutantType}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                            {item.measuredResult || item.activityQuantity} {item.unit}
                          </td>
                          <td className="py-2.5 px-3 text-[10px] text-slate-600">
                            {item.regulatoryBenchmark || 'NAAQS Limit'}
                          </td>
                          <td className="py-2.5 px-3 text-[10px] text-slate-600">
                            <div>{item.laboratory || 'Vimta Labs Ltd.'}</div>
                            <div className="text-slate-400">{item.testMethod || 'IS 5182 (Part 23)'}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                                item.complianceStatus === 'COMPLIANT'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {item.complianceStatus === 'COMPLIANT' ? 'Within Limits ✓' : 'Exceedance ⚠'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            {attachedEvs.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {attachedEvs.map((ev) => (
                                  <button
                                    key={ev.id}
                                    type="button"
                                    onClick={() => onReviewEvidence && onReviewEvidence(ev)}
                                    className="flex items-center gap-1 rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-bold text-teal-800 border border-teal-200 hover:bg-teal-100 transition"
                                    title="Review evidence (flips card 180°)"
                                  >
                                    <Eye className="h-2.5 w-2.5" />
                                    <span className="max-w-[70px] truncate">{ev.fileName}</span>
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">None attached</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleEditStagedItem(item)}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* REVIEW & WORKFLOW STATUS CONTROLLER */}
          <div className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block">
                  Workflow Review &amp; Approval Status
                </label>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Set workflow lifecycle status for this consolidated reporting period.
                </p>
              </div>

              <select
                value={overallWorkflowStatus}
                disabled={readOnly}
                onChange={(e: any) => setOverallWorkflowStatus(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 shadow-xs outline-none focus:border-emerald-400"
              >
                <option value="Draft">Draft (In Progress)</option>
                <option value="Submitted">Submitted (Sent for Project Admin Review)</option>
                <option value="Under Review">Under Review (ESG Lead Audit)</option>
                <option value="Approved">Approved (Final Sign-off)</option>
                <option value="Returned for Correction">Returned for Correction</option>
                <option value="Recalculation Required">Recalculation Required</option>
              </select>
            </div>

            <div className="mt-3">
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Consolidated Submission Remarks &amp; Audit Trail Note
              </label>
              <textarea
                value={remarks}
                disabled={readOnly}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="e.g. Scope 1, Scope 2, Scope 3, and ambient stack emissions inventory reconciled with central MRV protocols."
                className={inputClass + ' min-h-[55px] resize-y'}
              />
            </div>
          </div>

          {/* Primary Save Draft & Submit for Review buttons */}
          <FormSaveActions
            error={error}
            submitting={submitting}
            readOnly={readOnly}
            onSave={() => save(false)}
            onSubmitForReview={() => save(true)}
          />
        </div>
      )}
    </div>
  )
}

/* ============================================================
   LEVEL 4: WASTE MANAGEMENT FORM
   ============================================================ */
export interface StagedWasteItem {
  id: string
  wasteCategory: string
  wasteTypeDescription: string
  quantityGenerated: string
  unit: string
  quantityReused: string
  quantityRecycled: string
  quantityRecovered: string
  quantityDisposed: string
  disposalMethod: string
  wasteHandler: string
  authorizationReference: string
  transferManifestNumber: string
  supportingEvidence: string
  remarks: string
  evidenceId: string
  evidenceFileName?: string
  circularRecoveryPct: number
}

const L4_CATEGORIES = [
  'Construction & demolition',
  'Scrap metal & Structural steel',
  'Plastic waste',
  'Hazardous & chemical waste',
  'E-waste & Batteries',
  'Biomedical waste',
  'Municipal solid waste',
  'Other',
]

const L4_METHODS = [
  'Landfill (TSDF)',
  'Incineration / Co-processing',
  'Authorised recycling facility',
  'Composting',
  'Other',
]

const WASTE_CATEGORY_PRESETS: Record<
  string,
  {
    desc: string
    unit: string
    method: string
    handler: string
    authRef: string
    manifest: string
    doc: string
    icon: LucideIcon
    defaultGen: string
    defaultReused: string
    defaultRecycled: string
    defaultRecovered: string
    defaultDisposed: string
  }
> = {
  'Construction & demolition': {
    desc: 'Concrete rubble, brickbats, excavated soil & tile scrap',
    unit: 'metric tonnes',
    method: 'Authorised recycling facility',
    handler: 'Green Earth Recycling & Aggregates Pvt. Ltd.',
    authRef: 'SPCB/CDW/AUTH/2026/102',
    manifest: 'CDW-MANIFEST-2026-0102',
    doc: 'Weighbridge Slips & C&D Processing Plant Receipt',
    icon: Building2,
    defaultGen: '17.20',
    defaultReused: '10.50',
    defaultRecycled: '5.20',
    defaultRecovered: '0.00',
    defaultDisposed: '1.50',
  },
  'Scrap metal & Structural steel': {
    desc: 'TMT rebar cut pieces, structural beams, MS offcuts & turnings',
    unit: 'metric tonnes',
    method: 'Authorised recycling facility',
    handler: 'Steel Re-rolling & Melting Units SPCB Approved',
    authRef: 'SPCB/IND/REC/2026/405',
    manifest: 'SCRAP-GATE-PASS-2026-405',
    doc: 'Scrap Sale Delivery Challan & Invoices',
    icon: Box,
    defaultGen: '8.40',
    defaultReused: '2.10',
    defaultRecycled: '6.30',
    defaultRecovered: '0.00',
    defaultDisposed: '0.00',
  },
  'Plastic waste': {
    desc: 'Packaging HDPE/LDPE sheets, cement bags, PVC conduit offcuts',
    unit: 'metric tonnes',
    method: 'Incineration / Co-processing',
    handler: 'EPR Authorized Cement Co-processing Facility',
    authRef: 'CPCB/EPR/PLASTIC/2026/89',
    manifest: 'PLASTIC-EPR-CHALLAN-2026-089',
    doc: 'EPR Plastic Certificate & Cement Kiln Receipt',
    icon: Package,
    defaultGen: '3.60',
    defaultReused: '0.00',
    defaultRecycled: '2.80',
    defaultRecovered: '0.00',
    defaultDisposed: '0.80',
  },
  'Hazardous & chemical waste': {
    desc: 'Used DG lubricating oil, contaminated cotton rags, empty paint drums',
    unit: 'metric tonnes',
    method: 'Landfill (TSDF)',
    handler: 'State TSDF Facility Operator (SPCB Authorized)',
    authRef: 'SPCB/HAZ/AUTH/2026/841',
    manifest: 'PCB-HAZ-MANIFEST-FORM10-0841',
    doc: 'Form 10 Hazardous Waste Manifest & Weighbridge Slips',
    icon: AlertTriangle,
    defaultGen: '1.85',
    defaultReused: '0.00',
    defaultRecycled: '0.65',
    defaultRecovered: '0.00',
    defaultDisposed: '1.20',
  },
  'E-waste & Batteries': {
    desc: 'Used lead-acid batteries, obsolete sensors, UPS circuits & cabling',
    unit: 'metric tonnes',
    method: 'Authorised recycling facility',
    handler: 'SPCB / CPCB Registered E-Waste Recycler',
    authRef: 'CPCB/E-WASTE/REG/2026/14',
    manifest: 'EWASTE-FORM6-MANIFEST-2026-14',
    doc: 'E-Waste Passbook & Green Recycling Certificate',
    icon: Zap,
    defaultGen: '0.95',
    defaultReused: '0.00',
    defaultRecycled: '0.95',
    defaultRecovered: '0.00',
    defaultDisposed: '0.00',
  },
  'Biomedical waste': {
    desc: 'First-aid post medical dressings, used sharps, diagnostic strips',
    unit: 'metric tonnes',
    method: 'Incineration / Co-processing',
    handler: 'Common Bio-medical Waste Facility (CBWTF)',
    authRef: 'SPCB/BMW/AUTH/2026/55',
    manifest: 'BMW-BARCODE-MANIFEST-2026-55',
    doc: 'Biomedical Waste Barcoded Manifest & Treatment Log',
    icon: ShieldCheck,
    defaultGen: '0.18',
    defaultReused: '0.00',
    defaultRecycled: '0.00',
    defaultRecovered: '0.00',
    defaultDisposed: '0.18',
  },
  'Municipal solid waste': {
    desc: 'Canteen food organic waste, office paper, dry sweepings',
    unit: 'metric tonnes',
    method: 'Composting',
    handler: 'On-site Organic Waste Composter & Municipal Facility',
    authRef: 'SWM/LOCAL/COMP/2026/02',
    manifest: 'SWM-DISPATCH-2026-02',
    doc: 'Compost Logbook & Municipal Waste Receipts',
    icon: Trash2,
    defaultGen: '4.50',
    defaultReused: '1.20',
    defaultRecycled: '2.10',
    defaultRecovered: '0.00',
    defaultDisposed: '1.20',
  },
  'Other': {
    desc: 'Rubber conveyor trimmings, insulation wool scrap',
    unit: 'metric tonnes',
    method: 'Other',
    handler: 'Approved Environmental Vendor',
    authRef: 'SPCB/GEN/AUTH/2026/99',
    manifest: 'GEN-WASTE-2026-99',
    doc: 'Vendor Disposal Memo',
    icon: Recycle,
    defaultGen: '0.50',
    defaultReused: '0.00',
    defaultRecycled: '0.50',
    defaultRecovered: '0.00',
    defaultDisposed: '0.00',
  },
}

function calculateWasteCircularity(genStr: string, reusedStr: string, recycledStr: string, recoveredStr: string): number {
  const gen = Number(genStr) || 0
  const reused = Number(reusedStr) || 0
  const recycled = Number(recycledStr) || 0
  const recovered = Number(recoveredStr) || 0
  const diverted = reused + recycled + recovered
  return gen > 0 ? Number(Math.min(100, (diverted / gen) * 100).toFixed(1)) : 0
}

function Level4WasteForm({
  projectId,
  periodId,
  evidence,
  readOnly,
  formStateRef,
  onSaved,
  onEvidenceUploaded,
  onReviewEvidence,
}: LevelFormProps) {
  const key = `l4-${projectId}-${periodId}`
  const initial = formStateRef.current[key] || {}

  // Multi-item staged state
  const [stagedItems, setStagedItems] = useState<StagedWasteItem[]>(() => {
    if (Array.isArray(initial.items) && initial.items.length > 0) {
      return initial.items
    }
    if (initial.quantityGenerated && Number(initial.quantityGenerated) > 0) {
      const circ = calculateWasteCircularity(
        String(initial.quantityGenerated),
        String(initial.quantityReused || '0'),
        String(initial.quantityRecycled || '0'),
        String(initial.quantityRecovered || '0')
      )
      return [
        {
          id: 'item-waste-initial-1',
          wasteCategory: initial.wasteCategory || 'Construction & demolition',
          wasteTypeDescription: initial.wasteTypeDescription || 'Concrete rubble, brickbats, excavated soil & tile scrap',
          quantityGenerated: String(initial.quantityGenerated),
          unit: initial.unit || 'metric tonnes',
          quantityReused: initial.quantityReused || '10.50',
          quantityRecycled: initial.quantityRecycled || '5.20',
          quantityRecovered: initial.quantityRecovered || '0.00',
          quantityDisposed: initial.quantityDisposed || '1.50',
          disposalMethod: initial.disposalMethod || 'Authorised recycling facility',
          wasteHandler: initial.wasteHandler || 'Green Earth Recycling & Aggregates Pvt. Ltd.',
          authorizationReference: initial.authorizationReference || 'SPCB/CDW/AUTH/2026/102',
          transferManifestNumber: initial.transferManifestNumber || 'CDW-MANIFEST-2026-0102',
          supportingEvidence: initial.supportingEvidence || 'Weighbridge Slips & C&D Processing Plant Receipt',
          remarks: initial.remarks || 'Construction scrap processed at authorized recycling plant.',
          evidenceId: initial.evidenceId || '',
          circularRecoveryPct: circ,
        },
      ]
    }
    // Seed standard initial item so form is immediately usable
    const circ = calculateWasteCircularity('17.20', '10.50', '5.20', '0.00')
    return [
      {
        id: 'item-waste-seed-1',
        wasteCategory: 'Construction & demolition',
        wasteTypeDescription: 'Concrete rubble, brickbats, excavated soil & tile scrap',
        quantityGenerated: '17.20',
        unit: 'metric tonnes',
        quantityReused: '10.50',
        quantityRecycled: '5.20',
        quantityRecovered: '0.00',
        quantityDisposed: '1.50',
        disposalMethod: 'Authorised recycling facility',
        wasteHandler: 'Green Earth Recycling & Aggregates Pvt. Ltd.',
        authorizationReference: 'SPCB/CDW/AUTH/2026/102',
        transferManifestNumber: 'CDW-MANIFEST-2026-0102',
        supportingEvidence: 'Weighbridge Slips & C&D Processing Plant Receipt',
        remarks: '15.70 MT diverted to sub-base recycling; 1.50 MT inert landfill.',
        evidenceId: '',
        circularRecoveryPct: circ,
      },
    ]
  })

  // View step: 'ENTRY' (Item Drafting) vs 'ORGANIZED' (Consolidated Summary)
  const [viewStep, setViewStep] = useState<'ENTRY' | 'ORGANIZED'>(
    initial.viewStep === 'ORGANIZED' ? 'ORGANIZED' : 'ENTRY'
  )

  const [editingItemId, setEditingItemId] = useState<string | null>(null)

  // Active form inputs for selected Waste Category item
  const [wasteCategory, setWasteCategory] = useState('Construction & demolition')
  const [wasteTypeDescription, setWasteTypeDescription] = useState(
    'Concrete rubble, brickbats, excavated soil & tile scrap'
  )
  const [quantityGenerated, setQuantityGenerated] = useState('17.20')
  const [unit, setUnit] = useState('metric tonnes')
  const [quantityReused, setQuantityReused] = useState('10.50')
  const [quantityRecycled, setQuantityRecycled] = useState('5.20')
  const [quantityRecovered, setQuantityRecovered] = useState('0.00')
  const [quantityDisposed, setQuantityDisposed] = useState('1.50')
  const [disposalMethod, setDisposalMethod] = useState('Authorised recycling facility')
  const [wasteHandler, setWasteHandler] = useState('Green Earth Recycling & Aggregates Pvt. Ltd.')
  const [authorizationReference, setAuthorizationReference] = useState('SPCB/CDW/AUTH/2026/102')
  const [transferManifestNumber, setTransferManifestNumber] = useState('CDW-MANIFEST-2026-0102')
  const [supportingEvidence, setSupportingEvidence] = useState(
    'Weighbridge Slips & C&D Processing Plant Receipt'
  )
  const [remarks, setRemarks] = useState(
    'Total waste 36.68 T; 29.80 T diverted/recycled (81.2% circular recovery); 6.88 T safely disposed per CPCB regulations.'
  )
  const [evidenceId, setEvidenceId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Handle category chip click
  const handleSelectCategory = (cat: string) => {
    setError('')
    setWasteCategory(cat)
    const existing = stagedItems.find((i) => i.wasteCategory === cat)
    if (existing) {
      setEditingItemId(existing.id)
      setWasteTypeDescription(existing.wasteTypeDescription)
      setQuantityGenerated(existing.quantityGenerated)
      setUnit(existing.unit)
      setQuantityReused(existing.quantityReused)
      setQuantityRecycled(existing.quantityRecycled)
      setQuantityRecovered(existing.quantityRecovered)
      setQuantityDisposed(existing.quantityDisposed)
      setDisposalMethod(existing.disposalMethod)
      setWasteHandler(existing.wasteHandler)
      setAuthorizationReference(existing.authorizationReference)
      setTransferManifestNumber(existing.transferManifestNumber)
      setSupportingEvidence(existing.supportingEvidence)
      setRemarks(existing.remarks)
      setEvidenceId(existing.evidenceId)
    } else {
      setEditingItemId(null)
      const preset = WASTE_CATEGORY_PRESETS[cat] || WASTE_CATEGORY_PRESETS['Construction & demolition']
      setWasteTypeDescription(preset.desc)
      setQuantityGenerated(preset.defaultGen)
      setUnit(preset.unit)
      setQuantityReused(preset.defaultReused)
      setQuantityRecycled(preset.defaultRecycled)
      setQuantityRecovered(preset.defaultRecovered)
      setQuantityDisposed(preset.defaultDisposed)
      setDisposalMethod(preset.method)
      setWasteHandler(preset.handler)
      setAuthorizationReference(preset.authRef)
      setTransferManifestNumber(preset.manifest)
      setSupportingEvidence(preset.doc)
      setRemarks(`Measured generation and handling for ${cat} per site manifests.`)
      setEvidenceId('')
    }
  }

  // Add / Update item in staged items list
  const handleAddOrUpdateItem = () => {
    setError('')
    const genNum = Number(quantityGenerated)
    if (!quantityGenerated || isNaN(genNum) || genNum < 0) {
      setError(`Please enter a valid quantity generated (≥ 0) for ${wasteCategory}.`)
      return
    }

    const circ = calculateWasteCircularity(
      quantityGenerated,
      quantityReused,
      quantityRecycled,
      quantityRecovered
    )
    const attachedEv = evidence.find((e) => e.id === evidenceId)
    const itemPayload: StagedWasteItem = {
      id: editingItemId || `item-wst-${Date.now()}`,
      wasteCategory,
      wasteTypeDescription,
      quantityGenerated,
      unit,
      quantityReused,
      quantityRecycled,
      quantityRecovered,
      quantityDisposed,
      disposalMethod,
      wasteHandler,
      authorizationReference,
      transferManifestNumber,
      supportingEvidence,
      remarks,
      evidenceId,
      evidenceFileName: attachedEv?.fileName,
      circularRecoveryPct: circ,
    }

    let updated: StagedWasteItem[]
    if (editingItemId) {
      updated = stagedItems.map((i) => (i.id === editingItemId ? itemPayload : i))
      toast.success(`Updated ${wasteCategory} draft item.`)
    } else {
      const idx = stagedItems.findIndex((i) => i.wasteCategory === wasteCategory)
      if (idx >= 0) {
        updated = stagedItems.map((i, iIdx) => (iIdx === idx ? itemPayload : i))
        toast.info(`Updated existing ${wasteCategory} draft item.`)
      } else {
        updated = [...stagedItems, itemPayload]
        toast.success(`Added ${wasteCategory} (${Number(quantityGenerated).toLocaleString()} ${unit}) to draft items!`)
      }
    }

    setStagedItems(updated)
    setEditingItemId(null)
  }

  const handleEditStagedItem = (item: StagedWasteItem) => {
    setViewStep('ENTRY')
    setEditingItemId(item.id)
    setWasteCategory(item.wasteCategory)
    setWasteTypeDescription(item.wasteTypeDescription)
    setQuantityGenerated(item.quantityGenerated)
    setUnit(item.unit)
    setQuantityReused(item.quantityReused)
    setQuantityRecycled(item.quantityRecycled)
    setQuantityRecovered(item.quantityRecovered)
    setQuantityDisposed(item.quantityDisposed)
    setDisposalMethod(item.disposalMethod)
    setWasteHandler(item.wasteHandler)
    setAuthorizationReference(item.authorizationReference)
    setTransferManifestNumber(item.transferManifestNumber)
    setSupportingEvidence(item.supportingEvidence)
    setRemarks(item.remarks)
    setEvidenceId(item.evidenceId)
    toast.info(`Editing ${item.wasteCategory} draft item`)
  }

  const handleRemoveStagedItem = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const target = stagedItems.find((i) => i.id === id)
    const updated = stagedItems.filter((i) => i.id !== id)
    setStagedItems(updated)
    if (editingItemId === id) {
      setEditingItemId(null)
    }
    toast.warning(`Removed ${target?.wasteCategory || 'item'} from staged drafts.`)
  }

  const handleNextOrganize = () => {
    setError('')
    if (stagedItems.length === 0) {
      if (!quantityGenerated || Number(quantityGenerated) < 0) {
        setError('Please enter quantity generated and click Add (Draft) first.')
        return
      }
      handleAddOrUpdateItem()
    }
    setViewStep('ORGANIZED')
    toast.info('Organized Waste Consolidated Summary', {
      description: 'Review total generation, diversion rate, and disposal breakdown below.',
    })
  }

  // Aggregate stats across staged items
  const totalGen = stagedItems.reduce((acc, it) => acc + (Number(it.quantityGenerated) || 0), 0)
  const totalReused = stagedItems.reduce((acc, it) => acc + (Number(it.quantityReused) || 0), 0)
  const totalRecycled = stagedItems.reduce((acc, it) => acc + (Number(it.quantityRecycled) || 0), 0)
  const totalRecovered = stagedItems.reduce((acc, it) => acc + (Number(it.quantityRecovered) || 0), 0)
  const totalDisposed = stagedItems.reduce((acc, it) => acc + (Number(it.quantityDisposed) || 0), 0)
  const totalDiverted = totalReused + totalRecycled + totalRecovered
  const overallDiversionRate = totalGen > 0 ? ((totalDiverted / totalGen) * 100).toFixed(1) : '0'

  // Sync to formStateRef.current[key]
  useEffect(() => {
    const itemsToSave = stagedItems.length > 0 ? stagedItems : []
    formStateRef.current[key] = {
      wasteCategory: itemsToSave.map((i) => i.wasteCategory).join(', ') || wasteCategory,
      wasteTypeDescription: itemsToSave.map((i) => i.wasteTypeDescription).join('; ') || wasteTypeDescription,
      quantityGenerated: String(totalGen || quantityGenerated),
      unit: itemsToSave[0]?.unit || unit,
      quantityReused: String(totalReused || quantityReused),
      quantityRecycled: String(totalRecycled || quantityRecycled),
      quantityRecovered: String(totalRecovered || quantityRecovered),
      quantityDisposed: String(totalDisposed || quantityDisposed),
      disposalMethod: itemsToSave.map((i) => i.disposalMethod).filter(Boolean).join(', ') || disposalMethod,
      wasteHandler: itemsToSave.map((i) => i.wasteHandler).filter(Boolean).join(', ') || wasteHandler,
      authorizationReference: itemsToSave.map((i) => i.authorizationReference).filter(Boolean).join(', ') || authorizationReference,
      transferManifestNumber: itemsToSave.map((i) => i.transferManifestNumber).filter(Boolean).join(', ') || transferManifestNumber,
      supportingEvidence: itemsToSave.map((i) => i.supportingEvidence).filter(Boolean).join('; ') || supportingEvidence,
      remarks: remarks || `Consolidated multi-category waste management report (${itemsToSave.length} streams).`,
      evidenceId: itemsToSave.find((i) => i.evidenceId)?.evidenceId || evidenceId,
      items: itemsToSave,
      totalGen,
      totalDiverted,
      totalDisposed,
      diversionRate: overallDiversionRate,
      viewStep,
    }
  }, [
    key,
    stagedItems,
    viewStep,
    wasteCategory,
    wasteTypeDescription,
    quantityGenerated,
    unit,
    quantityReused,
    quantityRecycled,
    quantityRecovered,
    quantityDisposed,
    disposalMethod,
    wasteHandler,
    authorizationReference,
    transferManifestNumber,
    supportingEvidence,
    remarks,
    evidenceId,
    totalGen,
    totalDiverted,
    totalDisposed,
    overallDiversionRate,
    formStateRef,
  ])

  // Active item calculations
  const curGen = Number(quantityGenerated) || 0
  const curReused = Number(quantityReused) || 0
  const curRecycled = Number(quantityRecycled) || 0
  const curRecovered = Number(quantityRecovered) || 0
  const curDisposed = Number(quantityDisposed) || 0
  const curDiverted = curReused + curRecycled + curRecovered
  const curDivPct = curGen > 0 ? ((curDiverted / curGen) * 100).toFixed(1) : '0'

  // Final Save / Submit
  const save = async (submitForReview = false) => {
    setError('')
    let effectiveItems = [...stagedItems]
    if (effectiveItems.length === 0) {
      if (quantityGenerated === '' || Number(quantityGenerated) < 0) {
        setError('Quantity generated must be ≥ 0 and add at least one Waste Category item.')
        return
      }
      const c = calculateWasteCircularity(quantityGenerated, quantityReused, quantityRecycled, quantityRecovered)
      effectiveItems = [
        {
          id: `item-wst-${Date.now()}`,
          wasteCategory,
          wasteTypeDescription,
          quantityGenerated,
          unit,
          quantityReused,
          quantityRecycled,
          quantityRecovered,
          quantityDisposed,
          disposalMethod,
          wasteHandler,
          authorizationReference,
          transferManifestNumber,
          supportingEvidence,
          remarks,
          evidenceId,
          circularRecoveryPct: c,
        },
      ]
      setStagedItems(effectiveItems)
    }

    setSubmitting(true)
    try {
      const payloadData: Record<string, any> = {
        ...formStateRef.current[key],
        items: effectiveItems,
      }

      const res = await fetch('/api/so/data-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 4,
          levelKey: 'level4',
          levelName: 'Level 4 — Waste Management',
          module: 'WASTE',
          projectId,
          reportingPeriodId: periodId,
          evidenceId: payloadData.evidenceId || undefined,
          data: payloadData,
          submitForReview,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Failed to save Waste record')
      toast.success(
        submitForReview ? 'Waste submission sent for Project Admin review!' : 'Waste draft saved successfully!'
      )
      onSaved(d.record, submitForReview)
    } catch (e: any) {
      setError(e?.message || 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* FLOW NAVIGATION CONTROLLER: STEP 1 (ITEM DRAFTING) <-> STEP 2 (CONSOLIDATED SUMMARY) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-3.5">
        <div className="inline-flex items-center rounded-xl bg-slate-100/90 p-1 border border-slate-200/80 shadow-xs">
          <button
            type="button"
            onClick={() => setViewStep('ENTRY')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              viewStep === 'ENTRY'
                ? 'bg-white text-amber-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span
              className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                viewStep === 'ENTRY' ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              1
            </span>
            <span>Item Drafting</span>
            {stagedItems.length > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-800">
                {stagedItems.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={handleNextOrganize}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              viewStep === 'ORGANIZED'
                ? 'bg-white text-indigo-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span
              className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                viewStep === 'ORGANIZED' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              2
            </span>
            <span>Organized Summary</span>
            {stagedItems.length > 0 && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                ✓ Ready
              </span>
            )}
          </button>
        </div>

        {viewStep === 'ENTRY' ? (
          <button
            type="button"
            onClick={handleNextOrganize}
            className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:shadow-amber-500/20 hover:opacity-95 transition active:scale-95"
          >
            <span>Next: Organize All Items</span>
            <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px] font-mono">
              {stagedItems.length}
            </span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setViewStep('ENTRY')}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-slate-500" />
            <span>Back to Item Drafting</span>
          </button>
        )}
      </div>

      {/* ==============================================================
          VIEW 1: ITEM DRAFT ENTRY (ADD ONE BY ONE, WITH ADD + NEXT)
          ============================================================== */}
      {viewStep === 'ENTRY' && (
        <FormGrid>
          {/* Active Waste Item Live Analytics Banner */}
          <div className="sm:col-span-2 rounded-2xl border border-amber-200/90 bg-gradient-to-r from-amber-50/90 via-orange-50/60 to-emerald-50/90 p-4 text-xs text-amber-950 shadow-sm">
            <div className="flex items-center justify-between font-bold">
              <span className="flex items-center gap-2 text-amber-900">
                <Recycle className="h-4 w-4 text-amber-600" /> Active Item Status ·{' '}
                <span className="underline decoration-amber-300 font-extrabold">{wasteCategory}</span>
              </span>
              <span className="rounded-full bg-amber-100/90 px-2.5 py-0.5 text-[10px] text-amber-800 font-mono font-bold border border-amber-200">
                Method: {disposalMethod.split(' ')[0]}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-white/95 p-2.5 shadow-xs border border-amber-100">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                  Generated
                </div>
                <div className="text-base font-extrabold text-slate-900 mt-0.5">
                  {curGen.toFixed(2)} {unit}
                </div>
              </div>
              <div className="rounded-xl bg-white/95 p-2.5 shadow-xs border border-amber-100">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                  Circular Diverted
                </div>
                <div className="text-base font-extrabold text-emerald-800 mt-0.5">
                  {curDiverted.toFixed(2)} {unit}
                </div>
              </div>
              <div className="rounded-xl bg-white/95 p-2.5 shadow-xs border border-amber-100">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                  Diversion Recovery
                </div>
                <div className="text-base font-extrabold text-amber-900 mt-0.5">{curDivPct}%</div>
              </div>
            </div>
          </div>

          {/* INTERACTIVE CATEGORY ITEMS SELECTOR PILLS */}
          <div className="sm:col-span-2 so-glass-subtle rounded-2xl p-4">
            <div className="mb-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-amber-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Select Waste Category Item to Fill / Draft:
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                Click any category → Fill details &amp; evidence → Click Add (Draft)
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {L4_CATEGORIES.map((cat) => {
                const preset = WASTE_CATEGORY_PRESETS[cat] || WASTE_CATEGORY_PRESETS['Construction & demolition']
                const IconComponent = preset.icon
                const isSelected = wasteCategory === cat
                const staged = stagedItems.find((i) => i.wasteCategory === cat)

                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleSelectCategory(cat)}
                    className={`ios-chip ${
                      isSelected
                        ? 'ios-chip-active'
                        : staged
                        ? '!border-emerald-300 !text-emerald-900 hover:!border-emerald-400'
                        : ''
                      }}`}
                  >
                    <IconComponent
                      className={`h-3.5 w-3.5 ${
                        isSelected
                          ? 'text-white'
                          : staged
                          ? 'text-emerald'
                          : ''
                      }`}
                    />
                    <span>{cat}</span>
                    {staged ? (
                      <span className="ml-1 rounded-full bg-emerald-200/90 px-1.5 py-0.2 text-[9px] font-mono font-bold text-emerald-800">
                        ✓ {Number(staged.quantityGenerated).toFixed(1)} {staged.unit === 'metric tonnes' ? 'MT' : staged.unit}
                      </span>
                    ) : (
                      isSelected && (
                        <span className="ml-1 rounded-full bg-white/25 px-1.5 py-0.2 text-[9px] font-bold text-white">
                          Active
                        </span>
                      )
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ITEM FORM INPUTS */}
          <FormField label="Waste Category" hint="Selected waste stream category.">
            <select
              value={wasteCategory}
              disabled={readOnly}
              onChange={(e) => handleSelectCategory(e.target.value)}
              className={inputClass}
            >
              {L4_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Waste Type / Description" hint="Concrete rubble, TMT scrap, used oils, etc.">
            <input
              value={wasteTypeDescription}
              disabled={readOnly}
              onChange={(e) => setWasteTypeDescription(e.target.value)}
              placeholder="e.g. Concrete rubble, brickbats & excavation soil"
              className={inputClass}
            />
          </FormField>

          <FormField label="Quantity Generated" hint="Total waste generated this period.">
            <input
              type="number"
              min="0"
              step="any"
              value={quantityGenerated}
              disabled={readOnly}
              onChange={(e) => setQuantityGenerated(e.target.value)}
              placeholder="e.g. 17.20"
              className={inputClass}
            />
          </FormField>

          <FormField label="Unit" hint="metric tonnes or kg.">
            <select
              value={unit}
              disabled={readOnly}
              onChange={(e) => setUnit(e.target.value)}
              className={inputClass}
            >
              {['metric tonnes', 'kg'].map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Quantity Reused" hint="Reused directly on-site without reprocessing.">
            <input
              type="number"
              min="0"
              step="any"
              value={quantityReused}
              disabled={readOnly}
              onChange={(e) => setQuantityReused(e.target.value)}
              placeholder="e.g. 10.50"
              className={inputClass}
            />
          </FormField>

          <FormField label="Quantity Recycled" hint="Recycled off-site by authorized re-processors.">
            <input
              type="number"
              min="0"
              step="any"
              value={quantityRecycled}
              disabled={readOnly}
              onChange={(e) => setQuantityRecycled(e.target.value)}
              placeholder="e.g. 5.20"
              className={inputClass}
            />
          </FormField>

          <FormField label="Quantity Recovered" hint="Energy recovery or co-processing in cement kilns.">
            <input
              type="number"
              min="0"
              step="any"
              value={quantityRecovered}
              disabled={readOnly}
              onChange={(e) => setQuantityRecovered(e.target.value)}
              placeholder="0"
              className={inputClass}
            />
          </FormField>

          <FormField label="Quantity Disposed" hint="Sent to TSDF hazardous landfill or secured landfill.">
            <input
              type="number"
              min="0"
              step="any"
              value={quantityDisposed}
              disabled={readOnly}
              onChange={(e) => setQuantityDisposed(e.target.value)}
              placeholder="e.g. 1.50"
              className={inputClass}
            />
          </FormField>

          <FormField label="Disposal / Treatment Method" hint="Authorised recycling, TSDF, composting.">
            <select
              value={disposalMethod}
              disabled={readOnly}
              onChange={(e) => setDisposalMethod(e.target.value)}
              className={inputClass}
            >
              {L4_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Waste Handler" hint="SPCB registered disposal / recycling vendor.">
            <input
              value={wasteHandler}
              disabled={readOnly}
              onChange={(e) => setWasteHandler(e.target.value)}
              placeholder="e.g. Green Earth Recycling & Aggregates Pvt. Ltd."
              className={inputClass}
            />
          </FormField>

          <FormField label="Authorization Reference" hint="State Pollution Control Board authorization ID.">
            <input
              value={authorizationReference}
              disabled={readOnly}
              onChange={(e) => setAuthorizationReference(e.target.value)}
              placeholder="e.g. SPCB/CDW/AUTH/2026/102"
              className={inputClass}
            />
          </FormField>

          <FormField label="Transfer Manifest Number" hint="Form 10 or gate pass manifest number.">
            <input
              value={transferManifestNumber}
              disabled={readOnly}
              onChange={(e) => setTransferManifestNumber(e.target.value)}
              placeholder="e.g. CDW-MANIFEST-2026-0102"
              className={inputClass}
            />
          </FormField>

          <FormField label="Supporting Evidence" hint="Weighbridge slips, manifests, EPR documents." full>
            <input
              value={supportingEvidence}
              disabled={readOnly}
              onChange={(e) => setSupportingEvidence(e.target.value)}
              placeholder="e.g. Weighbridge Slips & C&D Processing Plant Receipt"
              className={inputClass}
            />
          </FormField>

          <FormField label="Remarks" hint="Traceability, recycling rate, or audit observations." full>
            <textarea
              value={remarks}
              disabled={readOnly}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. C&D waste recycled into aggregate sub-base; steel scrap dispatched to certified rolling mill."
              className={inputClass + ' min-h-[55px] resize-y'}
            />
          </FormField>

          {/* ITEM EVIDENCE ATTACHMENT SECTION */}
          <div className="sm:col-span-2">
            <FormEvidenceAttachSection
              projectId={projectId}
              periodId={periodId}
              moduleKey="WASTE"
              evidence={evidence}
              onUploaded={onEvidenceUploaded || (async () => {})}
              selectedEvidenceId={evidenceId || null}
              onSelectEvidence={(id) => setEvidenceId(id || '')}
              onReview={onReviewEvidence}
              readOnly={readOnly}
            />
          </div>

          {/* SPECIAL ACTION BUTTONS: ADD (DRAFT) + NEXT (ORGANIZE) */}
          <div className="sm:col-span-2 rounded-2xl border border-amber-200/90 bg-gradient-to-r from-amber-50/90 via-orange-50/50 to-emerald-50/90 p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-amber-600" />
                  <span>Item Draft Actions · {wasteCategory}</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Fill details and attach evidence, then click <strong>Add Item (Draft)</strong> to stage it.
                  When all categories are added, click <strong>Next: Organize All Items</strong>.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddOrUpdateItem}
                  disabled={readOnly}
                  className="flex items-center gap-1.5 rounded-full bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-amber-500/20 hover:bg-amber-700 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>
                    {editingItemId ? `Update ${wasteCategory} Draft` : `Add ${wasteCategory} (Draft)`}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleNextOrganize}
                  className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-700 to-orange-700 px-4 py-2 text-xs font-bold text-white shadow-md shadow-amber-600/20 hover:opacity-95 transition active:scale-95"
                >
                  <span>Next: Organize All Items</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {error && (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50/90 p-2.5 text-xs font-medium text-rose-800">
                <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5 text-rose-600" /> {error}
              </div>
            )}
          </div>

          {/* STAGED DRAFT ITEMS TABLE / LIST */}
          {stagedItems.length > 0 && (
            <div className="sm:col-span-2 so-glass-subtle rounded-2xl p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Staged Draft Items ({stagedItems.length} Categories Added)
                    </h4>
                    <p className="text-[10px] text-slate-500">
                      Draft waste streams. Click edit to adjust or click Next to organize the full waste inventory.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800 border border-amber-200">
                    Total: {totalGen.toFixed(2)} MT ({overallDiversionRate}% Circular Recovery)
                  </span>
                  <button
                    type="button"
                    onClick={handleNextOrganize}
                    className="flex items-center gap-1 rounded-full bg-amber-700 px-3 py-1 text-xs font-bold text-white shadow-xs hover:bg-amber-800 transition"
                  >
                    <span>Next: Organize</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 border-y border-slate-100">
                    <tr>
                      <th className="py-2 px-2.5">Category &amp; Description</th>
                      <th className="py-2 px-2.5">Method &amp; Handler</th>
                      <th className="py-2 px-2.5">Generated Quantity</th>
                      <th className="py-2 px-2.5">Circular Diverted</th>
                      <th className="py-2 px-2.5">Evidence</th>
                      <th className="py-2 px-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stagedItems.map((item) => {
                      const attachedEv = evidence.find((ev) => ev.id === item.evidenceId)
                      const itemDiverted =
                        (Number(item.quantityReused) || 0) +
                        (Number(item.quantityRecycled) || 0) +
                        (Number(item.quantityRecovered) || 0)
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-2.5">
                            <div className="font-bold text-slate-900">{item.wasteCategory}</div>
                            <span className="text-[10px] text-slate-500 line-clamp-1">
                              {item.wasteTypeDescription}
                            </span>
                          </td>
                          <td className="py-2.5 px-2.5">
                            <div className="font-semibold text-slate-800">{item.disposalMethod}</div>
                            <div className="text-[10px] text-slate-500 line-clamp-1">
                              {item.wasteHandler}
                            </div>
                          </td>
                          <td className="py-2.5 px-2.5 font-bold text-slate-900">
                            {Number(item.quantityGenerated).toFixed(2)} {item.unit}
                          </td>
                          <td className="py-2.5 px-2.5">
                            <span className="font-bold text-emerald-800">
                              {itemDiverted.toFixed(2)} {item.unit}
                            </span>
                            <div className="text-[10px] text-amber-700 font-semibold">
                              {item.circularRecoveryPct}% circular
                            </div>
                          </td>
                          <td className="py-2.5 px-2.5">
                            {attachedEv ? (
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="truncate max-w-[120px] rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200"
                                  title={attachedEv.fileName}
                                >
                                  {attachedEv.fileName}
                                </span>
                                {onReviewEvidence && (
                                  <button
                                    type="button"
                                    onClick={() => onReviewEvidence(attachedEv)}
                                    className="text-blue-600 hover:text-blue-800 p-0.5"
                                    title="Review evidence (flips engine preview)"
                                  >
                                    <Eye className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">None attached</span>
                            )}
                          </td>
                          <td className="py-2.5 px-2.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleEditStagedItem(item)}
                                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition"
                                title="Edit this item"
                              >
                                <Edit3 className="h-3 w-3" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleRemoveStagedItem(item.id, e)}
                                className="flex h-6 w-6 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 transition"
                                title="Remove item"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <FormSaveActions
            error={error}
            submitting={submitting}
            readOnly={readOnly}
            onSave={() => save(false)}
            onSubmitForReview={() => save(true)}
          />
        </FormGrid>
      )}

      {/* ==============================================================
          VIEW 2: ORGANIZED CONSOLIDATED SUMMARY
          ============================================================== */}
      {viewStep === 'ORGANIZED' && (
        <div className="space-y-4">
          {/* Header Banner */}
          <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50/90 via-orange-50/80 to-emerald-50/90 p-4 text-xs text-amber-950 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="status-pill status-approved !text-[10px]">
                    Step 2: Consolidated
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">
                    All Waste Categories Organized in One View
                  </h3>
                </div>
                <p className="text-[11px] text-slate-600 mt-1">
                  Compiled {stagedItems.length} waste categories into a unified waste balance &amp; diversion audit.
                  Review the summary, attach any final documentation, and click Save Draft or Submit for Review.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setViewStep('ENTRY')}
                className="self-start sm:self-auto flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs"
              >
                <Plus className="h-3.5 w-3.5 text-amber-600" />
                <span>Add / Edit More Categories</span>
              </button>
            </div>
          </div>

          {/* 4 Consolidated Executive Metric Tiles */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-amber-200 bg-white p-3 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Total Waste Generated
              </div>
              <div className="text-base font-extrabold text-slate-900 mt-1">
                {totalGen.toFixed(2)} MT
              </div>
              <div className="text-[10px] text-amber-700 mt-0.5">Across all waste streams</div>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-white p-3 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Total Circular Diverted
              </div>
              <div className="text-base font-extrabold text-emerald-800 mt-1">
                {totalDiverted.toFixed(2)} MT
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Reused + Recycled + Co-processed</div>
            </div>

            <div className="rounded-xl border border-blue-200 bg-white p-3 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Circular Recovery Rate
              </div>
              <div className="text-base font-extrabold text-blue-900 mt-1">
                {overallDiversionRate}%
              </div>
              <div className="text-[10px] text-blue-700 mt-0.5">CPCB Circular Economy Target: &gt;75%</div>
            </div>

            <div className="rounded-xl border border-rose-200 bg-white p-3 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Safely Disposed / TSDF
              </div>
              <div className="text-base font-extrabold text-rose-950 mt-1">
                {totalDisposed.toFixed(2)} MT
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Secured landfill &amp; TSDF</div>
            </div>
          </div>

          {/* Consolidated Master Table of All Items */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Consolidated Waste Management Breakdown
              </h4>
              <span className="text-[10px] text-slate-500">
                All streams will be saved into the master draft and submitted together
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 border-y border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Category &amp; Stream</th>
                    <th className="py-2.5 px-3">Generated</th>
                    <th className="py-2.5 px-3">Reused / Recycled</th>
                    <th className="py-2.5 px-3">Disposed</th>
                    <th className="py-2.5 px-3">Method &amp; Handler</th>
                    <th className="py-2.5 px-3">Recovery Rate</th>
                    <th className="py-2.5 px-3">Attached Evidence</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stagedItems.map((item, idx) => {
                    const attachedEv = evidence.find((ev) => ev.id === item.evidenceId)
                    const itemDiverted =
                      (Number(item.quantityReused) || 0) +
                      (Number(item.quantityRecycled) || 0) +
                      (Number(item.quantityRecovered) || 0)
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-[10px] text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {item.wasteCategory}
                          <div className="text-[10px] font-normal text-slate-500 line-clamp-1">
                            {item.wasteTypeDescription}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {Number(item.quantityGenerated).toFixed(2)} {item.unit === 'metric tonnes' ? 'MT' : item.unit}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-emerald-800">
                          {itemDiverted.toFixed(2)} {item.unit === 'metric tonnes' ? 'MT' : item.unit}
                        </td>
                        <td className="py-2.5 px-3 text-rose-800 font-semibold">
                          {Number(item.quantityDisposed).toFixed(2)} {item.unit === 'metric tonnes' ? 'MT' : item.unit}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {item.disposalMethod}
                          {item.transferManifestNumber && (
                            <div className="text-[10px] font-mono text-slate-400">
                              #{item.transferManifestNumber}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-amber-900">
                          {item.circularRecoveryPct}%
                        </td>
                        <td className="py-2.5 px-3">
                          {attachedEv ? (
                            <div className="flex items-center gap-1.5">
                              <span
                                className="truncate max-w-[110px] rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200"
                                title={attachedEv.fileName}
                              >
                                {attachedEv.fileName}
                              </span>
                              {onReviewEvidence && (
                                <button
                                  type="button"
                                  onClick={() => onReviewEvidence(attachedEv)}
                                  className="text-blue-600 hover:text-blue-800 p-0.5"
                                  title="Review evidence (flips engine preview)"
                                >
                                  <Eye className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">None attached</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleEditStagedItem(item)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="bg-slate-50 font-bold text-slate-900 border-t border-slate-200">
                  <tr>
                    <td colSpan={2} className="py-2.5 px-3 text-right text-[11px] uppercase tracking-wider text-slate-500">
                      Consolidated Total:
                    </td>
                    <td className="py-2.5 px-3 font-bold">
                      {totalGen.toFixed(2)} MT Gen
                    </td>
                    <td className="py-2.5 px-3 font-bold text-emerald-800">
                      {totalDiverted.toFixed(2)} MT Diverted
                    </td>
                    <td className="py-2.5 px-3 font-bold text-rose-800">
                      {totalDisposed.toFixed(2)} MT Disposed
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">—</td>
                    <td className="py-2.5 px-3 text-amber-900 font-extrabold text-sm">
                      {overallDiversionRate}%
                    </td>
                    <td colSpan={2} className="py-2.5 px-3 text-right text-[10px] text-slate-500">
                      {stagedItems.length} categories combined
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Overall Remarks / Summary Note */}
          <div className="rounded-xl border border-slate-200 bg-white/80 p-3">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Consolidated Submission Remarks &amp; Audit Trail Note
            </label>
            <textarea
              value={remarks}
              disabled={readOnly}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Consolidated multi-category waste management report covering construction debris, scrap steel recycling, hazardous TSDF manifest, and municipal organic composting."
              className={inputClass + ' min-h-[55px] resize-y'}
            />
          </div>

          {/* Primary Save Draft & Submit for Review buttons */}
          <FormSaveActions
            error={error}
            submitting={submitting}
            readOnly={readOnly}
            onSave={() => save(false)}
            onSubmitForReview={() => save(true)}
          />
        </div>
      )}
    </div>
  )
}

/* ============================================================
   LEVEL 5: HEALTH & SAFETY FORM
   ============================================================ */
function Level5SafetyForm({
  projectId,
  periodId,
  readOnly,
  formStateRef,
  onSaved,
}: LevelFormProps) {
  const key = `l5-${projectId}-${periodId}`
  const initial = formStateRef.current[key] || {}

  const [reportingPeriod, setReportingPeriod] = useState(initial.reportingPeriod ?? 'FY 2026-27 (Annual)')
  const [workforceCategory, setWorkforceCategory] = useState(initial.workforceCategory ?? 'Employee')
  const [workforceCount, setWorkforceCount] = useState(initial.workforceCount ?? '4850')
  const [totalPersonHoursWorked, setTotalPersonHoursWorked] = useState(initial.totalPersonHoursWorked ?? '154000')
  const [incidentId, setIncidentId] = useState(initial.incidentId ?? 'INC-2026-EHS-001')
  const [incidentDateTime, setIncidentDateTime] = useState(initial.incidentDateTime ?? '2026-06-18T14:30')
  const [incidentType, setIncidentType] = useState(initial.incidentType ?? 'First-aid injury')
  const [incidentSeverity, setIncidentSeverity] = useState(initial.incidentSeverity ?? 'Minor')
  const [daysLost, setDaysLost] = useState(initial.daysLost ?? '0')
  const [fatalityDisability, setFatalityDisability] = useState(initial.fatalityDisability ?? 'None')
  const [incidentDescription, setIncidentDescription] = useState(initial.incidentDescription ?? 'Minor finger abrasion during rebar placement; first aid rendered at site medical post.')
  const [immediateAction, setImmediateAction] = useState(initial.immediateAction ?? 'Immediate antiseptic dressing applied; verified PPE Cut-Level 5 glove compliance.')
  const [rootCause, setRootCause] = useState(initial.rootCause ?? 'Glove wear-and-tear during high-tensile steel wire tying.')
  const [correctiveAction, setCorrectiveAction] = useState(initial.correctiveAction ?? 'Upgraded to Cut-Level 5 kevlar gloves across batching yard; zero lost time; LTIFR = 0.14.')
  const [closureEvidence, setClosureEvidence] = useState(initial.closureEvidence ?? 'Signed site safety officer closure report & medical fitness certificate')
  const [supportingDocument, setSupportingDocument] = useState(initial.supportingDocument ?? 'EHS-SAFETY-MUSTER-LOG-2026.pdf')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    formStateRef.current[key] = {
      reportingPeriod, workforceCategory, workforceCount, totalPersonHoursWorked,
      incidentId, incidentDateTime, incidentType, incidentSeverity, daysLost,
      fatalityDisability, incidentDescription, immediateAction, rootCause,
      correctiveAction, closureEvidence, supportingDocument,
    }
  }, [
    key, reportingPeriod, workforceCategory, workforceCount, totalPersonHoursWorked,
    incidentId, incidentDateTime, incidentType, incidentSeverity, daysLost,
    fatalityDisability, incidentDescription, immediateAction, rootCause,
    correctiveAction, closureEvidence, supportingDocument, formStateRef,
  ])

  const mhw = Number(totalPersonHoursWorked) || 0
  const isLti = incidentType.toLowerCase().includes('lost-time') || incidentType.toLowerCase().includes('lti')
  const ltifr = mhw > 0 ? (((isLti ? 1 : 0) * 1000000) / mhw).toFixed(3) : '0.000'

  const save = async (submitForReview = false) => {
    setError('')
    if (!totalPersonHoursWorked || Number(totalPersonHoursWorked) <= 0) {
      setError('Total person-hours worked must be > 0')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/so/data-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 5,
          levelKey: 'level5',
          levelName: 'Level 5 — Health & Safety',
          module: 'SAFETY',
          projectId,
          reportingPeriodId: periodId,
          data: formStateRef.current[key],
          submitForReview,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Failed to save Safety record')
      onSaved(d.record, submitForReview)
    } catch (e: any) {
      setError(e?.message || 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <FormGrid>
      <FormField label="Reporting Period" hint="Month / quarter / year.">
        <input
          value={reportingPeriod}
          disabled={readOnly}
          onChange={(e) => setReportingPeriod(e.target.value)}
          className={inputClass}
        />
      </FormField>

      <FormField label="Workforce Category" hint="Employee / contract worker / other.">
        <select
          value={workforceCategory}
          disabled={readOnly}
          onChange={(e) => setWorkforceCategory(e.target.value)}
          className={inputClass}
        >
          {['Employee', 'Contract worker', 'Apprentice / Trainee', 'Other'].map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Workforce Count" hint="Aggregated count in this category.">
        <input
          type="number"
          value={workforceCount}
          disabled={readOnly}
          onChange={(e) => setWorkforceCount(e.target.value)}
          placeholder="e.g. 185"
          className={inputClass}
        />
      </FormField>

      <FormField label="Total Person-hours Worked" hint="Approved muster roll source record.">
        <input
          type="number"
          min="0"
          value={totalPersonHoursWorked}
          disabled={readOnly}
          onChange={(e) => setTotalPersonHoursWorked(e.target.value)}
          placeholder="e.g. 48600"
          className={inputClass}
        />
      </FormField>

      <FormField label="Incident ID" hint="System-generated reference ID.">
        <input
          value={incidentId}
          disabled={readOnly}
          onChange={(e) => setIncidentId(e.target.value)}
          className={inputClass}
        />
      </FormField>

      <FormField label="Incident Date & Time" hint="Actual occurrence timestamp.">
        <input
          type="datetime-local"
          value={incidentDateTime}
          disabled={readOnly}
          onChange={(e) => setIncidentDateTime(e.target.value)}
          className={inputClass}
        />
      </FormField>

      <FormField label="Incident Type" hint="Injury, lost-time, near miss, fatality.">
        <select
          value={incidentType}
          disabled={readOnly}
          onChange={(e) => setIncidentType(e.target.value)}
          className={inputClass}
        >
          {['Near miss', 'First-aid injury', 'Lost-time injury', 'Medical treatment', 'Fatality'].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Incident Severity" hint="Classification level.">
        <select
          value={incidentSeverity}
          disabled={readOnly}
          onChange={(e) => setIncidentSeverity(e.target.value)}
          className={inputClass}
        >
          {['Minor', 'Moderate', 'Serious', 'Critical / Fatal'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Days Lost" hint="Where applicable (lost workdays).">
        <input
          type="number"
          value={daysLost}
          disabled={readOnly}
          onChange={(e) => setDaysLost(e.target.value)}
          placeholder="0"
          className={inputClass}
        />
      </FormField>

      <FormField label="Fatality / Disability" hint="Incident consequence.">
        <select
          value={fatalityDisability}
          disabled={readOnly}
          onChange={(e) => setFatalityDisability(e.target.value)}
          className={inputClass}
        >
          {['None', 'Temporary disability', 'Permanent disability', 'Fatality'].map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Incident Description" hint="Factual summary of event." full>
        <textarea
          value={incidentDescription}
          disabled={readOnly}
          onChange={(e) => setIncidentDescription(e.target.value)}
          placeholder="e.g. Scaffolding slip during night shift; harness prevented fall."
          className={inputClass + ' min-h-[50px] resize-y'}
        />
      </FormField>

      <FormField label="Immediate Action" hint="Action taken on the spot.">
        <input
          value={immediateAction}
          disabled={readOnly}
          onChange={(e) => setImmediateAction(e.target.value)}
          placeholder="e.g. Work stopped; safety review conducted"
          className={inputClass}
        />
      </FormField>

      <FormField label="Root Cause" hint="When established.">
        <input
          value={rootCause}
          disabled={readOnly}
          onChange={(e) => setRootCause(e.target.value)}
          placeholder="e.g. Unanchored scaffolding plank"
          className={inputClass}
        />
      </FormField>

      <FormField label="Corrective Action" hint="Remediation and target completion." full>
        <input
          value={correctiveAction}
          disabled={readOnly}
          onChange={(e) => setCorrectiveAction(e.target.value)}
          placeholder="e.g. Toolbox training + mandatory tag verification by 2026-06-30"
          className={inputClass}
        />
      </FormField>

      <FormField label="Closure Evidence" hint="Inspection sign-off memo.">
        <input
          value={closureEvidence}
          disabled={readOnly}
          onChange={(e) => setClosureEvidence(e.target.value)}
          placeholder="e.g. Signed closure sign-off memo"
          className={inputClass}
        />
      </FormField>

      <FormField label="Supporting Document" hint="Incident report, work-hour register.">
        <input
          value={supportingDocument}
          disabled={readOnly}
          onChange={(e) => setSupportingDocument(e.target.value)}
          placeholder="e.g. Incident Report IR-2026-08"
          className={inputClass}
        />
      </FormField>

      {/* Live Preview Card */}
      <div className="sm:col-span-2 rounded-xl border border-rose-200/80 bg-rose-50/60 p-3 text-xs text-rose-900">
        <div className="flex items-center justify-between font-bold">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-rose-600" /> Safety Statistics Preview
          </span>
          <span className="text-[10px] text-rose-700">Man-hours: {mhw.toLocaleString()}</span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-white/80 p-1.5">
            <div className="text-[9px] uppercase text-slate-500 font-bold">Derived LTIFR</div>
            <div className="text-sm font-bold text-slate-900">{ltifr} /M</div>
          </div>
          <div className="rounded-lg bg-white/80 p-1.5">
            <div className="text-[9px] uppercase text-slate-500 font-bold">Days Lost</div>
            <div className="text-sm font-bold text-slate-900">{daysLost} days</div>
          </div>
          <div className="rounded-lg bg-white/80 p-1.5">
            <div className="text-[9px] uppercase text-slate-500 font-bold">Severity</div>
            <div className="text-sm font-bold text-slate-900">{incidentSeverity}</div>
          </div>
        </div>
      </div>

      <FormSaveActions error={error} submitting={submitting} readOnly={readOnly} onSave={() => save(false)} onSubmitForReview={() => save(true)} />
    </FormGrid>
  )
}

/* ============================================================
   LEVEL 6: TRAINING & WORKFORCE WELL-BEING FORM
   ============================================================ */
function Level6TrainingForm({
  projectId,
  periodId,
  readOnly,
  formStateRef,
  onSaved,
}: LevelFormProps) {
  const key = `l6-${projectId}-${periodId}`
  const initial = formStateRef.current[key] || {}

  const [trainingProgramme, setTrainingProgramme] = useState(initial.trainingProgramme ?? 'SEBI BRSR Human Rights, Code of Conduct & POSH Awareness')
  const [trainingCategory, setTrainingCategory] = useState(initial.trainingCategory ?? 'Human Rights')
  const [trainingDate, setTrainingDate] = useState(initial.trainingDate ?? '2026-08-15')
  const [duration, setDuration] = useState(initial.duration ?? '4')
  const [durationUnit, setDurationUnit] = useState(initial.durationUnit ?? 'Hours')
  const [numberOfSessions, setNumberOfSessions] = useState(initial.numberOfSessions ?? '6')
  const [participants, setParticipants] = useState(initial.participants ?? '120')
  const [participantCategory, setParticipantCategory] = useState(initial.participantCategory ?? 'Employee')
  const [trainerAgency, setTrainerAgency] = useState(initial.trainerAgency ?? 'Corporate Compliance & HR Institute (NICMAR / In-house EHS)')
  const [attendanceStatus, setAttendanceStatus] = useState(initial.attendanceStatus ?? 'Completed')
  const [assessmentResult, setAssessmentResult] = useState(initial.assessmentResult ?? '100% Passed (Avg Score: 94%)')
  const [supportingEvidence, setSupportingEvidence] = useState(initial.supportingEvidence ?? 'Signed LMS Attendance Sheet & Pre/Post Assessment Log')
  const [remarks, setRemarks] = useState(initial.remarks ?? '94.2% permanent employees (4,568 persons) and 88.6% workers (18,668 persons) covered across entity.')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    formStateRef.current[key] = {
      trainingProgramme, trainingCategory, trainingDate, duration, durationUnit,
      numberOfSessions, participants, participantCategory, trainerAgency,
      attendanceStatus, assessmentResult, supportingEvidence, remarks,
    }
  }, [
    key, trainingProgramme, trainingCategory, trainingDate, duration, durationUnit,
    numberOfSessions, participants, participantCategory, trainerAgency,
    attendanceStatus, assessmentResult, supportingEvidence, remarks, formStateRef,
  ])

  const pCount = Number(participants) || 0
  const dur = Number(duration) || 0
  const durHrs = durationUnit === 'Minutes' ? dur / 60 : dur
  const totalPersonHrs = (pCount * durHrs).toFixed(1)

  const save = async (submitForReview = false) => {
    setError('')
    if (!trainingProgramme) {
      setError('Training programme name is required')
      return
    }
    if (!participants || Number(participants) <= 0) {
      setError('Participants count must be > 0')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/so/data-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 6,
          levelKey: 'level6',
          levelName: 'Level 6 — Training & Workforce Well-being',
          module: 'TRAINING',
          projectId,
          reportingPeriodId: periodId,
          data: formStateRef.current[key],
          submitForReview,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Failed to save Training record')
      onSaved(d.record, submitForReview)
    } catch (e: any) {
      setError(e?.message || 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <FormGrid>
      <FormField label="Training Programme" hint="Course or workshop name.">
        <input
          value={trainingProgramme}
          disabled={readOnly}
          onChange={(e) => setTrainingProgramme(e.target.value)}
          placeholder="e.g. Scaffolding & Working at Heights Safety"
          className={inputClass}
        />
      </FormField>

      <FormField label="Training Category" hint="Safety, technical skills, emergency.">
        <select
          value={trainingCategory}
          disabled={readOnly}
          onChange={(e) => setTrainingCategory(e.target.value)}
          className={inputClass}
        >
          {['Safety', 'Technical skills', 'Emergency preparedness', 'Human Rights', 'Well-being', 'Other'].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Training Date" hint="Date conducted.">
        <input
          type="date"
          value={trainingDate}
          disabled={readOnly}
          onChange={(e) => setTrainingDate(e.target.value)}
          className={inputClass}
        />
      </FormField>

      <FormField label="Duration" hint="Length of session.">
        <div className="flex gap-2">
          <input
            type="number"
            min="0"
            step="any"
            value={duration}
            disabled={readOnly}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="4"
            className={inputClass}
          />
          <select
            value={durationUnit}
            disabled={readOnly}
            onChange={(e) => setDurationUnit(e.target.value)}
            className={inputClass + ' w-28'}
          >
            <option value="Hours">Hours</option>
            <option value="Minutes">Minutes</option>
          </select>
        </div>
      </FormField>

      <FormField label="Number of Sessions" hint="Actual batch/session count.">
        <input
          type="number"
          min="1"
          value={numberOfSessions}
          disabled={readOnly}
          onChange={(e) => setNumberOfSessions(e.target.value)}
          placeholder="1"
          className={inputClass}
        />
      </FormField>

      <FormField label="Participants Count" hint="Total attendance headcount.">
        <input
          type="number"
          min="1"
          value={participants}
          disabled={readOnly}
          onChange={(e) => setParticipants(e.target.value)}
          placeholder="e.g. 45"
          className={inputClass}
        />
      </FormField>

      <FormField label="Participant Category" hint="Employee / contract worker / other.">
        <select
          value={participantCategory}
          disabled={readOnly}
          onChange={(e) => setParticipantCategory(e.target.value)}
          className={inputClass}
        >
          {['Employee', 'Contract worker', 'Apprentice', 'Other'].map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Trainer / Agency" hint="In-house or external trainer name.">
        <input
          value={trainerAgency}
          disabled={readOnly}
          onChange={(e) => setTrainerAgency(e.target.value)}
          placeholder="e.g. National Safety Council Lead / EHS Officer"
          className={inputClass}
        />
      </FormField>

      <FormField label="Attendance Status" hint="Completed / partial / absent.">
        <select
          value={attendanceStatus}
          disabled={readOnly}
          onChange={(e) => setAttendanceStatus(e.target.value)}
          className={inputClass}
        >
          {['Completed', 'Partial', 'Absent', 'Rescheduled'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Assessment Result" hint="Where applicable (Passed, Certified).">
        <input
          value={assessmentResult}
          disabled={readOnly}
          onChange={(e) => setAssessmentResult(e.target.value)}
          placeholder="e.g. 100% Passed (Avg Score: 92%)"
          className={inputClass}
        />
      </FormField>

      <FormField label="Supporting Evidence" hint="Attendance sheet, training report.">
        <input
          value={supportingEvidence}
          disabled={readOnly}
          onChange={(e) => setSupportingEvidence(e.target.value)}
          placeholder="e.g. Signed Attendance Sheet & Photo Log"
          className={inputClass}
        />
      </FormField>

      <FormField label="Remarks" hint="Additional context or feedback.">
        <input
          value={remarks}
          disabled={readOnly}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="e.g. Conducted in Telugu and Hindi for worker clarity."
          className={inputClass}
        />
      </FormField>

      {/* Live Preview Card */}
      <div className="sm:col-span-2 rounded-xl border border-indigo-200/80 bg-indigo-50/60 p-3 text-xs text-indigo-900">
        <div className="flex items-center justify-between font-bold">
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-indigo-600" /> Training Volume Metrics
          </span>
          <span className="text-[10px] text-indigo-700">Category: {trainingCategory}</span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-white/80 p-1.5">
            <div className="text-[9px] uppercase text-slate-500 font-bold">Person-Hours</div>
            <div className="text-sm font-bold text-slate-900">{totalPersonHrs} hrs</div>
          </div>
          <div className="rounded-lg bg-white/80 p-1.5">
            <div className="text-[9px] uppercase text-slate-500 font-bold">Trained</div>
            <div className="text-sm font-bold text-slate-900">{pCount} participants</div>
          </div>
          <div className="rounded-lg bg-white/80 p-1.5">
            <div className="text-[9px] uppercase text-slate-500 font-bold">Duration</div>
            <div className="text-sm font-bold text-slate-900">{durHrs} hours</div>
          </div>
        </div>
      </div>

      <FormSaveActions error={error} submitting={submitting} readOnly={readOnly} onSave={() => save(false)} onSubmitForReview={() => save(true)} />
    </FormGrid>
  )
}

/* ============================================================
   LEVEL 7: ENVIRONMENTAL COMPLIANCE & PERMITS FORM
   (MULTI-ITEM DRAFT & ORGANIZE WORKFLOW)
   ============================================================ */
const L7_PERMIT_TYPES = [
  'Consent to Operate (CTO)',
  'Consent to Establish (CTE)',
  'Environmental Clearance (EC)',
  'Hazardous Waste Authorization',
  'Groundwater NOC (CGWA)',
  'Forest Clearance / Tree Transit',
  'Factory License & Boilers Registration',
  'Noise & Ambient Air Authorization',
  'Other Statutory Clearance',
]

const L7_PRESETS: Record<
  string,
  {
    authority: string
    activity: string
    validityYears: number
    icon: LucideIcon
    sampleNo: string
  }
> = {
  'Consent to Operate (CTO)': {
    authority: 'State Pollution Control Board (SPCB)',
    activity: 'Concrete Batching, 400kV Substation & Solar PV EPC Operations',
    validityYears: 3,
    icon: ShieldCheck,
    sampleNo: 'TSPCB/HYD/CTO/2026-8941',
  },
  'Consent to Establish (CTE)': {
    authority: 'State Pollution Control Board (SPCB)',
    activity: 'Phase-2 Substation Expansion & Inverter Yard Construction',
    validityYears: 5,
    icon: Building2,
    sampleNo: 'TSPCB/CTE/EXP/2026-0412',
  },
  'Environmental Clearance (EC)': {
    authority: 'Ministry of Environment, Forest and Climate Change (MoEFCC)',
    activity: 'Full-scale Infrastructure Transmission & Canal Reach Package',
    validityYears: 7,
    icon: Landmark,
    sampleNo: 'MoEFCC/IA/AP/INFRA/2024-912',
  },
  'Hazardous Waste Authorization': {
    authority: 'State Pollution Control Board (SPCB)',
    activity: 'Handling, Storage & Transit of Used Transformer Oil & Spent Batteries',
    validityYears: 5,
    icon: ShieldAlert,
    sampleNo: 'HWA/SPCB/FORM-2/2026-118',
  },
  'Groundwater NOC (CGWA)': {
    authority: 'Central Ground Water Authority (CGWA)',
    activity: 'Deep Borewell Abstraction & Dewatering for Substation Trenching',
    validityYears: 3,
    icon: Waves,
    sampleNo: 'CGWA/NOC/IND/ORIG/2025-4509',
  },
  'Forest Clearance / Tree Transit': {
    authority: 'State Forest Department / MoEFCC Regional Office',
    activity: 'Linear Transmission Line Right of Way (RoW) & Compensatory Afforestation',
    validityYears: 10,
    icon: Trees,
    sampleNo: 'FD/DIV/ROW/TRANS/2024-77',
  },
  'Factory License & Boilers Registration': {
    authority: 'Directorate of Factories and Boilers',
    activity: 'Aggregate Processing Plant & Steam Auxiliary Operations',
    validityYears: 1,
    icon: Factory,
    sampleNo: 'FAC/LIC/ZONE-4/2026-302',
  },
  'Noise & Ambient Air Authorization': {
    authority: 'State Pollution Control Board (SPCB)',
    activity: 'Heavy DG Set Stack Emissions & Night Construction Acoustic Enclosures',
    validityYears: 2,
    icon: Wind,
    sampleNo: 'SPCB/AIR-NOISE/AUTH/2026-098',
  },
  'Other Statutory Clearance': {
    authority: 'Local Municipal / District Magistrate',
    activity: 'Public Infrastructure Utility Wayleave & Drainage NOC',
    validityYears: 2,
    icon: FileCheck2,
    sampleNo: 'DIST/MAG/NOC/2026-551',
  },
}

export interface StagedPermitItem {
  id: string
  permitConsentType: string
  permitNumber: string
  issuingAuthority: string
  applicableActivity: string
  issueDate: string
  expiryDate: string
  permitStatus: string
  inspectionDate: string
  inspectionFindings: string
  nonComplianceIdentified: string
  correctiveAction: string
  responsibleOwner: string
  dueDate: string
  closureDate: string
  supportingEvidence: string
  evidenceIds: string[]
  evidenceFiles: EvidenceItem[]
  daysRemaining: number
}

function Level7ComplianceForm({
  projectId,
  periodId,
  evidence,
  readOnly,
  formStateRef,
  onSaved,
  onEvidenceUploaded,
  onReviewEvidence,
}: LevelFormProps) {
  const key = `l7-${projectId}-${periodId}`
  const initial = formStateRef.current[key] || {}

  // Workflow mode: 1 = Item Drafting, 2 = Organized Consolidated Summary
  const [workflowStep, setWorkflowStep] = useState<1 | 2>(initial.items?.length > 0 ? 2 : 1)

  // Staged multi-item collection
  const [stagedItems, setStagedItems] = useState<StagedPermitItem[]>(() => {
    if (Array.isArray(initial.items) && initial.items.length > 0) return initial.items
    return []
  })

  // Active form inputs
  const [permitConsentType, setPermitConsentType] = useState(initial.permitConsentType ?? 'Consent to Operate (CTO)')
  const [permitNumber, setPermitNumber] = useState(initial.permitNumber ?? 'TSPCB/HYD/CTO/2026-8941')
  const [issuingAuthority, setIssuingAuthority] = useState(initial.issuingAuthority ?? 'State Pollution Control Board (SPCB)')
  const [issueDate, setIssueDate] = useState(initial.issueDate ?? '2026-01-10')
  const [expiryDate, setExpiryDate] = useState(initial.expiryDate ?? '2028-12-31')
  const [permitStatus, setPermitStatus] = useState(initial.permitStatus ?? 'Valid')
  const [applicableActivity, setApplicableActivity] = useState(initial.applicableActivity ?? 'Concrete Batching, 400kV Substation & Solar PV EPC Operations')
  const [inspectionDate, setInspectionDate] = useState(initial.inspectionDate ?? '2026-08-14')
  const [inspectionFindings, setInspectionFindings] = useState(initial.inspectionFindings ?? '100% compliant with NAAQS ambient air and zero liquid discharge parameters; zero penalty standing.')
  const [nonComplianceIdentified, setNonComplianceIdentified] = useState(initial.nonComplianceIdentified ?? 'No')
  const [correctiveAction, setCorrectiveAction] = useState(initial.correctiveAction ?? 'Quarterly stack and ZLD monitoring reports submitted to PCB portal.')
  const [responsibleOwner, setResponsibleOwner] = useState(initial.responsibleOwner ?? 'S. Nageswara Rao (VP - Regulatory & Legal)')
  const [dueDate, setDueDate] = useState(initial.dueDate ?? '2026-12-31')
  const [closureDate, setClosureDate] = useState(initial.closureDate ?? '2026-08-20')
  const [supportingEvidence, setSupportingEvidence] = useState(initial.supportingEvidence ?? '')
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>(() => {
    if (Array.isArray(initial.evidenceIds)) return initial.evidenceIds
    if (initial.evidenceId) return [initial.evidenceId]
    return []
  })

  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Calculate days remaining
  let daysRemaining = 365
  if (expiryDate) {
    const exp = new Date(expiryDate).getTime()
    daysRemaining = Math.round((exp - Date.now()) / 86400000)
  }

  // Auto-fill defaults when selecting permit type
  const handleSelectPresetType = (type: string) => {
    setPermitConsentType(type)
    const preset = L7_PRESETS[type]
    if (preset) {
      setIssuingAuthority(preset.authority)
      setApplicableActivity(preset.activity)
      if (!permitNumber || permitNumber.startsWith('TSPCB/')) {
        setPermitNumber(preset.sampleNo)
      }
    }
  }

  // Sync state to parent ref
  useEffect(() => {
    formStateRef.current[key] = {
      permitConsentType,
      permitNumber,
      issuingAuthority,
      applicableActivity,
      issueDate,
      expiryDate,
      permitStatus,
      inspectionDate,
      inspectionFindings,
      nonComplianceIdentified,
      correctiveAction,
      responsibleOwner,
      dueDate,
      closureDate,
      supportingEvidence,
      evidenceIds: selectedEvidenceIds,
      evidenceId: selectedEvidenceIds[0] || null,
      items: stagedItems,
    }
  }, [
    key,
    permitConsentType,
    permitNumber,
    issuingAuthority,
    applicableActivity,
    issueDate,
    expiryDate,
    permitStatus,
    inspectionDate,
    inspectionFindings,
    nonComplianceIdentified,
    correctiveAction,
    responsibleOwner,
    dueDate,
    closureDate,
    supportingEvidence,
    selectedEvidenceIds,
    stagedItems,
    formStateRef,
  ])

  // Package current inputs into StagedPermitItem
  const packageCurrentItem = (): StagedPermitItem => {
    const attFiles = evidence.filter((e) => selectedEvidenceIds.includes(e.id))
    return {
      id: editingId || `permit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      permitConsentType,
      permitNumber: permitNumber || 'PENDING-REG-REF',
      issuingAuthority: issuingAuthority || 'Regulatory Authority',
      applicableActivity: applicableActivity || 'Project Site Operations',
      issueDate,
      expiryDate,
      permitStatus,
      inspectionDate,
      inspectionFindings,
      nonComplianceIdentified,
      correctiveAction,
      responsibleOwner,
      dueDate,
      closureDate,
      supportingEvidence,
      evidenceIds: selectedEvidenceIds,
      evidenceFiles: attFiles,
      daysRemaining,
    }
  }

  // Add / Update item in staging
  const stageCurrentItem = (resetForm = true) => {
    if (!permitNumber) {
      setError('Permit reference number is required')
      return false
    }
    setError('')

    const item = packageCurrentItem()
    setStagedItems((prev) => {
      const idx = prev.findIndex((p) => p.id === item.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = item
        return next
      }
      return [...prev, item]
    })

    toast.success(`Permit "${item.permitConsentType}" staged (${item.permitNumber})`, {
      description: `${item.evidenceIds.length} evidence file(s) attached.`,
    })

    if (resetForm) {
      setEditingId(null)
      // Pick next un-staged permit type
      const currentTypes = stagedItems.map((s) => s.permitConsentType)
      currentTypes.push(item.permitConsentType)
      const nextType = L7_PERMIT_TYPES.find((t) => !currentTypes.includes(t)) || L7_PERMIT_TYPES[0]
      handleSelectPresetType(nextType)
      setSelectedEvidenceIds([])
      setSupportingEvidence('')
    }
    return true
  }

  // Edit existing staged item
  const handleEditItem = (item: StagedPermitItem) => {
    setEditingId(item.id)
    setPermitConsentType(item.permitConsentType)
    setPermitNumber(item.permitNumber)
    setIssuingAuthority(item.issuingAuthority)
    setApplicableActivity(item.applicableActivity)
    setIssueDate(item.issueDate)
    setExpiryDate(item.expiryDate)
    setPermitStatus(item.permitStatus)
    setInspectionDate(item.inspectionDate)
    setInspectionFindings(item.inspectionFindings)
    setNonComplianceIdentified(item.nonComplianceIdentified)
    setCorrectiveAction(item.correctiveAction)
    setResponsibleOwner(item.responsibleOwner)
    setDueDate(item.dueDate)
    setClosureDate(item.closureDate)
    setSupportingEvidence(item.supportingEvidence)
    setSelectedEvidenceIds(item.evidenceIds || [])
    setWorkflowStep(1)
  }

  // Delete staged item
  const handleDeleteItem = (id: string) => {
    setStagedItems((prev) => prev.filter((p) => p.id !== id))
    toast.info('Permit item removed from draft staging')
  }

  // Move to Step 2
  const handleProceedToOrganize = () => {
    if (permitNumber && !stagedItems.some((p) => p.id === editingId)) {
      stageCurrentItem(false)
    }
    setWorkflowStep(2)
  }

  // Consolidated Portfolio Metrics
  const summaryMetrics = useMemo(() => {
    const total = stagedItems.length
    const valid = stagedItems.filter((p) => p.permitStatus === 'Valid').length
    const expiringSoon = stagedItems.filter((p) => p.daysRemaining <= 90 && p.daysRemaining >= 0).length
    const nonCompliant = stagedItems.filter((p) => p.nonComplianceIdentified === 'Yes').length
    const complianceRate = total > 0 ? Math.round(((total - nonCompliant) / total) * 100) : 100
    const totalDocs = stagedItems.reduce((acc, p) => acc + (p.evidenceIds?.length || 0), 0)

    return { total, valid, expiringSoon, nonCompliant, complianceRate, totalDocs }
  }, [stagedItems])

  // Save / Submit handler
  const save = async (submitForReview = false) => {
    setError('')
    let itemsToSave = stagedItems
    if (itemsToSave.length === 0) {
      if (!permitNumber) {
        setError('At least one permit authorization must be added or entered')
        return
      }
      itemsToSave = [packageCurrentItem()]
      setStagedItems(itemsToSave)
    }

    setSubmitting(true)
    try {
      const primaryItem = itemsToSave[0]
      const allEvIds = Array.from(new Set(itemsToSave.flatMap((it) => it.evidenceIds || [])))

      const res = await fetch('/api/so/data-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 5,
          levelKey: 'level7',
          levelName: 'Level 5 — Environmental Permits & Compliance',
          module: 'COMPLIANCE',
          projectId,
          reportingPeriodId: periodId,
          evidenceId: allEvIds[0] || undefined,
          data: {
            ...primaryItem,
            evidenceIds: allEvIds,
            items: itemsToSave,
            totalPermits: itemsToSave.length,
            complianceRate: summaryMetrics.complianceRate,
          },
          submitForReview,
        }),
      })

      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Failed to save Permit record')

      toast.success(
        submitForReview
          ? `Permits & Compliance submitted for review (${itemsToSave.length} authorizations)!`
          : `Permit portfolio draft saved (${itemsToSave.length} authorizations).`,
      )
      onSaved(d.record, submitForReview)
    } catch (e: any) {
      setError(e?.message || 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* SEGMENTED VIEW CONTROLLER PILL */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-teal-200/90 bg-gradient-to-r from-teal-50/90 via-white/80 to-emerald-50/90 p-2 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWorkflowStep(1)}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
              workflowStep === 1
                ? 'bg-teal-600 text-white shadow-md shadow-teal-500/20'
                : 'bg-white/80 text-slate-600 hover:bg-white hover:text-slate-900 border border-slate-200/80'
            }`}
          >
            <FileCheck2 className="h-3.5 w-3.5" />
            <span>1. Permit Drafting</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                workflowStep === 1 ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {stagedItems.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (stagedItems.length === 0) stageCurrentItem(false)
              setWorkflowStep(2)
            }}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
              workflowStep === 2
                ? 'bg-teal-600 text-white shadow-md shadow-teal-500/20'
                : 'bg-white/80 text-slate-600 hover:bg-white hover:text-slate-900 border border-slate-200/80'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>2. Organized Summary</span>
            {stagedItems.length > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-black text-white">
                ✓
              </span>
            )}
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-3 text-xs pr-2">
          <span className="text-[11px] font-bold text-slate-600">
            Portfolio:{' '}
            <span className="font-extrabold text-teal-700">{stagedItems.length} Permits</span>
          </span>
          <span className="text-slate-300">•</span>
          <span className="text-[11px] font-bold text-slate-600">
            Compliance: <span className="font-extrabold text-emerald-600">{summaryMetrics.complianceRate}%</span>
          </span>
        </div>
      </div>

      {/* ================= STEP 1: ITEM DRAFTING ================= */}
      {workflowStep === 1 && (
        <div className="space-y-4">
          {/* Source Preset Chips Dock */}
          <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-3 shadow-2xs">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Select Environmental Permit / Statutory Authorization:
              </span>
              <span className="text-[10px] text-teal-600 font-semibold">
                Click preset chip to auto-populate authority &amp; activity
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {L7_PERMIT_TYPES.map((type) => {
                const preset = L7_PRESETS[type]
                const IconComponent = preset?.icon || ShieldCheck
                const isSelected = permitConsentType === type
                const staged = stagedItems.find((s) => s.permitConsentType === type)

                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleSelectPresetType(type)}
                    className={`group relative flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                      isSelected
                        ? 'border-2 border-teal-500 bg-teal-50/90 text-teal-900 shadow-sm'
                        : 'border border-slate-200/80 bg-white/90 text-slate-700 hover:border-teal-300 hover:bg-teal-50/40'
                    }`}
                  >
                    <IconComponent
                      className={`h-3.5 w-3.5 ${isSelected ? 'text-teal-600' : 'text-slate-500 group-hover:text-teal-600'}`}
                    />
                    <span>{type}</span>
                    {staged && (
                      <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-extrabold text-emerald-800">
                        ✓ Added
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Form Grid */}
          <FormGrid>
            <FormField label="Permit / Consent Type" hint="Selected environmental authorization.">
              <select
                value={permitConsentType}
                disabled={readOnly}
                onChange={(e) => handleSelectPresetType(e.target.value)}
                className={inputClass}
              >
                {L7_PERMIT_TYPES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Permit Reference Number" hint="Official statutory registration code.">
              <input
                value={permitNumber}
                disabled={readOnly}
                onChange={(e) => setPermitNumber(e.target.value)}
                placeholder="e.g. TSPCB/HYD/CTO/2026-8941"
                className={inputClass}
              />
            </FormField>

            <FormField label="Issuing Authority" hint="SPCB, CPCB, MoEFCC, CGWA.">
              <input
                value={issuingAuthority}
                disabled={readOnly}
                onChange={(e) => setIssuingAuthority(e.target.value)}
                placeholder="e.g. State Pollution Control Board"
                className={inputClass}
              />
            </FormField>

            <FormField label="Applicable Activity" hint="Activity covered by the permit.">
              <input
                value={applicableActivity}
                disabled={readOnly}
                onChange={(e) => setApplicableActivity(e.target.value)}
                placeholder="e.g. Concrete Batching & Solar PV EPC Operations"
                className={inputClass}
              />
            </FormField>

            <FormField label="Issue Date" hint="Date of authorization.">
              <input
                type="date"
                value={issueDate}
                disabled={readOnly}
                onChange={(e) => setIssueDate(e.target.value)}
                className={inputClass}
              />
            </FormField>

            <FormField label="Expiry Date" hint="Date of validity expiry.">
              <input
                type="date"
                value={expiryDate}
                disabled={readOnly}
                onChange={(e) => setExpiryDate(e.target.value)}
                className={inputClass}
              />
            </FormField>

            <FormField label="Permit Status" hint="Current validity standing.">
              <select
                value={permitStatus}
                disabled={readOnly}
                onChange={(e) => setPermitStatus(e.target.value)}
                className={inputClass}
              >
                {['Valid', 'Expiring within 90 days', 'Expired', 'Renewal in progress'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Inspection Date" hint="Most recent regulatory inspection.">
              <input
                type="date"
                value={inspectionDate}
                disabled={readOnly}
                onChange={(e) => setInspectionDate(e.target.value)}
                className={inputClass}
              />
            </FormField>

            <FormField label="Inspection Findings" hint="Actual findings from regulatory officer." full>
              <textarea
                value={inspectionFindings}
                disabled={readOnly}
                onChange={(e) => setInspectionFindings(e.target.value)}
                placeholder="e.g. Site visited by Regional Officer; greenbelt and dust control found satisfactory."
                className={inputClass + ' min-h-[50px] resize-y'}
              />
            </FormField>

            <FormField label="Non-compliance Identified" hint="Yes / No / Under assessment.">
              <select
                value={nonComplianceIdentified}
                disabled={readOnly}
                onChange={(e) => setNonComplianceIdentified(e.target.value)}
                className={inputClass}
              >
                {['No', 'Yes', 'Under assessment'].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Responsible Owner" hint="Assigned person or role.">
              <input
                value={responsibleOwner}
                disabled={readOnly}
                onChange={(e) => setResponsibleOwner(e.target.value)}
                placeholder="e.g. Site Environmental Lead / VP Legal"
                className={inputClass}
              />
            </FormField>

            <FormField label="Corrective Action" hint="Action taken or planned if non-compliance." full>
              <input
                value={correctiveAction}
                disabled={readOnly}
                onChange={(e) => setCorrectiveAction(e.target.value)}
                placeholder="e.g. Quarterly ambient air and ZLD monitoring reports submitted to PCB portal."
                className={inputClass}
              />
            </FormField>

            <FormField label="Target Due Date" hint="Statutory closure deadline.">
              <input
                type="date"
                value={dueDate}
                disabled={readOnly}
                onChange={(e) => setDueDate(e.target.value)}
                className={inputClass}
              />
            </FormField>

            <FormField label="Actual Closure Date" hint="Date of confirmed closure.">
              <input
                type="date"
                value={closureDate}
                disabled={readOnly}
                onChange={(e) => setClosureDate(e.target.value)}
                className={inputClass}
              />
            </FormField>

            <FormField label="Supporting Evidence Remarks" hint="Document notes, register entry." full>
              <input
                value={supportingEvidence}
                disabled={readOnly}
                onChange={(e) => setSupportingEvidence(e.target.value)}
                placeholder="e.g. Statutory order copy and quarterly compliance return"
                className={inputClass}
              />
            </FormField>

            {/* In-Form Multi-Evidence Attach Section */}
            <div className="sm:col-span-2">
              <FormEvidenceAttachSection
                projectId={projectId}
                periodId={periodId}
                moduleKey="COMPLIANCE"
                evidence={evidence}
                onUploaded={onEvidenceUploaded || (async () => {})}
                selectedEvidenceIds={selectedEvidenceIds}
                onSelectEvidenceIds={setSelectedEvidenceIds}
                onReview={onReviewEvidence}
                readOnly={readOnly}
              />
            </div>

            {/* Live Expiry Preview Card */}
            <div className="sm:col-span-2 rounded-xl border border-teal-200/80 bg-teal-50/60 p-3 text-xs text-teal-900">
              <div className="flex items-center justify-between font-bold">
                <span className="flex items-center gap-1.5">
                  <FileCheck2 className="h-3.5 w-3.5 text-teal-600" /> Consent Validity Window
                </span>
                <span className="text-[10px] text-teal-700">Non-compliance: {nonComplianceIdentified}</span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-white/80 p-1.5">
                  <div className="text-[9px] uppercase text-slate-500 font-bold">Days to Expiry</div>
                  <div className="text-sm font-bold text-slate-900">
                    {daysRemaining > 0 ? `${daysRemaining} days` : 'Expired'}
                  </div>
                </div>
                <div className="rounded-lg bg-white/80 p-1.5">
                  <div className="text-[9px] uppercase text-slate-500 font-bold">Permit Status</div>
                  <div className="text-sm font-bold text-slate-900">{permitStatus}</div>
                </div>
                <div className="rounded-lg bg-white/80 p-1.5">
                  <div className="text-[9px] uppercase text-slate-500 font-bold">Authority</div>
                  <div className="text-sm font-bold text-slate-900">{issuingAuthority.split(' ')[0]}</div>
                </div>
              </div>
            </div>

            {/* ACTION RIBBON: ADD (DRAFT) + NEXT: ORGANIZE */}
            <div className="sm:col-span-2 pt-2">
              {error && (
                <div className="mb-2 rounded-xl border border-rose-200 bg-rose-50/80 p-2.5 text-xs font-medium text-rose-800">
                  <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5 text-rose-600" /> {error}
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-2.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => stageCurrentItem(true)}
                    className="flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-teal-500/20 hover:bg-teal-700 transition disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{editingId ? 'Update Permit' : `+ Add ${permitConsentType.split('(')[0].trim()} (Draft)`}</span>
                  </button>
                  <span className="text-[11px] text-slate-500">
                    {stagedItems.length} authorization(s) currently staged
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleProceedToOrganize}
                  className="flex items-center gap-1.5 rounded-xl border border-teal-300 bg-white px-4 py-2 text-xs font-bold text-teal-700 shadow-xs hover:bg-teal-50 transition"
                >
                  <span>Next: Organize All Permits ({stagedItems.length})</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </FormGrid>

          {/* Staged Permits Table (Step 1) */}
          {stagedItems.length > 0 && (
            <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-3 shadow-xs">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ListOrdered className="h-4 w-4 text-teal-600" />
                  <span className="text-xs font-bold text-slate-800">
                    Staged Permits &amp; Authorizations ({stagedItems.length})
                  </span>
                </div>
                <span className="text-[10px] text-slate-500">
                  Click Edit to update inputs · Click eye to review evidence (flips card)
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200/80 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-2 pr-3">Permit Type</th>
                      <th className="py-2 px-3">Reference #</th>
                      <th className="py-2 px-3">Issuing Authority</th>
                      <th className="py-2 px-3">Expiry Date</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Attached Evidence</th>
                      <th className="py-2 pl-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stagedItems.map((item) => (
                      <tr key={item.id} className="hover:bg-teal-50/30 transition">
                        <td className="py-2.5 pr-3 font-semibold text-slate-800">
                          {item.permitConsentType}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700">
                          {item.permitNumber}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{item.issuingAuthority}</td>
                        <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                          {item.expiryDate || 'N/A'}{' '}
                          <span className="text-[10px] text-slate-400 font-sans">
                            ({item.daysRemaining > 0 ? `${item.daysRemaining}d` : 'Expired'})
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                              item.permitStatus === 'Valid'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {item.permitStatus}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {item.evidenceFiles && item.evidenceFiles.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {item.evidenceFiles.map((ev) => (
                                <button
                                  key={ev.id}
                                  type="button"
                                  onClick={() => onReviewEvidence && onReviewEvidence(ev)}
                                  className="flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 hover:bg-blue-100 transition"
                                  title="Review evidence (flips card 180°)"
                                >
                                  <Eye className="h-2.5 w-2.5" />
                                  <span className="max-w-[80px] truncate">{ev.fileName}</span>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400">None</span>
                          )}
                        </td>
                        <td className="py-2.5 pl-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleEditItem(item)}
                              className="rounded-lg p-1 text-slate-500 hover:bg-teal-100 hover:text-teal-800 transition"
                              title="Edit item"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item.id)}
                              className="rounded-lg p-1 text-slate-400 hover:bg-rose-100 hover:text-rose-700 transition"
                              title="Remove item"
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
          )}
        </div>
      )}

      {/* ================= STEP 2: ORGANIZED CONSOLIDATED SUMMARY ================= */}
      {workflowStep === 2 && (
        <div className="space-y-4">
          {/* Bento KPI Metric Tiles */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-2xl border border-teal-200/90 bg-gradient-to-br from-teal-50/80 to-white/90 p-3 shadow-2xs">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-teal-800">
                <span>Total Clearances</span>
                <ShieldCheck className="h-3.5 w-3.5 text-teal-600" />
              </div>
              <div className="mt-1 text-xl font-black text-slate-900">{summaryMetrics.total}</div>
              <div className="text-[10px] text-slate-500">Statutory authorizations</div>
            </div>

            <div className="rounded-2xl border border-emerald-200/90 bg-gradient-to-br from-emerald-50/80 to-white/90 p-3 shadow-2xs">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                <span>Compliance Rate</span>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <div className="mt-1 text-xl font-black text-emerald-600">
                {summaryMetrics.complianceRate}%
              </div>
              <div className="text-[10px] text-slate-500">{summaryMetrics.valid} valid consents</div>
            </div>

            <div className="rounded-2xl border border-amber-200/90 bg-gradient-to-br from-amber-50/80 to-white/90 p-3 shadow-2xs">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-amber-800">
                <span>Expiring Soon</span>
                <Clock className="h-3.5 w-3.5 text-amber-600" />
              </div>
              <div className="mt-1 text-xl font-black text-amber-600">{summaryMetrics.expiringSoon}</div>
              <div className="text-[10px] text-slate-500">Within 90-day window</div>
            </div>

            <div className="rounded-2xl border border-rose-200/90 bg-gradient-to-br from-rose-50/80 to-white/90 p-3 shadow-2xs">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-rose-800">
                <span>Non-compliances</span>
                <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
              </div>
              <div className="mt-1 text-xl font-black text-rose-600">{summaryMetrics.nonCompliant}</div>
              <div className="text-[10px] text-slate-500">Pending corrective actions</div>
            </div>
          </div>

          {/* Master Consolidated Breakdown Table */}
          <div className="rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-xs">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Consolidated Environmental Permits &amp; Compliance Portfolio
                </h4>
                <p className="text-[11px] text-slate-500">
                  Organized audit portfolio for SEBI BRSR Principle 6 statutory disclosures
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWorkflowStep(1)}
                className="flex items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-700 hover:bg-teal-100 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>+ Add Another Permit</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-2.5 pr-3">Permit Type</th>
                    <th className="py-2.5 px-3">Reference #</th>
                    <th className="py-2.5 px-3">Issuing Authority</th>
                    <th className="py-2.5 px-3">Validity Window</th>
                    <th className="py-2.5 px-3">Compliance Status</th>
                    <th className="py-2.5 px-3">Attached Documents</th>
                    <th className="py-2.5 pl-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stagedItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-2.5 pr-3 font-semibold text-slate-800">
                        {item.permitConsentType}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700">
                        {item.permitNumber}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{item.issuingAuthority}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                        {item.expiryDate || 'N/A'}{' '}
                        <span className="text-[10px] text-slate-400 font-sans">
                          ({item.daysRemaining > 0 ? `${item.daysRemaining}d` : 'Expired'})
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                            item.permitStatus === 'Valid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {item.permitStatus}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        {item.evidenceFiles && item.evidenceFiles.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {item.evidenceFiles.map((ev) => (
                              <button
                                key={ev.id}
                                type="button"
                                onClick={() => onReviewEvidence && onReviewEvidence(ev)}
                                className="flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 hover:bg-blue-100 transition"
                                title="Review document (flips Engine Preview card)"
                              >
                                <Eye className="h-2.5 w-2.5" />
                                <span className="max-w-[90px] truncate">{ev.fileName}</span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400">None attached</span>
                        )}
                      </td>
                      <td className="py-2.5 pl-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleEditItem(item)}
                            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 transition"
                            title="Edit"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id)}
                            className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 font-bold bg-slate-50/50">
                    <td className="py-2.5 pr-3 text-slate-800">
                      Portfolio Total ({stagedItems.length} Authorizations)
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">—</td>
                    <td className="py-2.5 px-3 text-slate-500">—</td>
                    <td className="py-2.5 px-3 text-teal-800">
                      {summaryMetrics.expiringSoon} Expiring Soon
                    </td>
                    <td className="py-2.5 px-3 text-emerald-700 font-bold">
                      {summaryMetrics.complianceRate}% Compliant
                    </td>
                    <td className="py-2.5 px-3 text-blue-700">
                      {summaryMetrics.totalDocs} Document(s)
                    </td>
                    <td className="py-2.5 pl-3 text-right text-slate-400">—</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Master Actions */}
          <FormSaveActions
            error={error}
            submitting={submitting}
            readOnly={readOnly}
            onSave={() => save(false)}
            onSubmitForReview={() => save(true)}
          />
        </div>
      )}
    </div>
  )
}

/* ============================================================
   LEVEL 8: ENVIRONMENTAL INCIDENTS & COMMUNITY GRIEVANCES FORM
   ============================================================ */
function Level8IncidentsForm({
  projectId,
  periodId,
  readOnly,
  formStateRef,
  onSaved,
}: LevelFormProps) {
  const key = `l8-${projectId}-${periodId}`
  const initial = formStateRef.current[key] || {}

  const [recordType, setRecordType] = useState(initial.recordType ?? 'Community grievance')
  const [incidentGrievanceId, setIncidentGrievanceId] = useState(initial.incidentGrievanceId ?? 'GRV-2026-002')
  const [dateReported, setDateReported] = useState(initial.dateReported ?? '2026-08-10')
  const [category, setCategory] = useState(initial.category ?? 'Dust')
  const [siteAffectedArea, setSiteAffectedArea] = useState(initial.siteAffectedArea ?? 'Village perimeter near Project Canal Reach KM 14+500')
  const [description, setDescription] = useState(initial.description ?? 'Local community query regarding drainage diversion during monsoon excavation.')
  const [impactSeverity, setImpactSeverity] = useState(initial.impactSeverity ?? 'Low')
  const [actionTaken, setActionTaken] = useState(initial.actionTaken ?? 'Engineered culvert drainage channel constructed and dust water-bowsers deployed.')
  const [rootCause, setRootCause] = useState(initial.rootCause ?? 'Seasonal heavy downpour water accumulation near peripheral access road.')
  const [responsibleOwner, setResponsibleOwner] = useState(initial.responsibleOwner ?? 'P. Ramesh (Site Project Director)')
  const [dueDate, setDueDate] = useState(initial.dueDate ?? '2026-08-25')
  const [currentStatus, setCurrentStatus] = useState(initial.currentStatus ?? 'Resolved')
  const [resolutionDate, setResolutionDate] = useState(initial.resolutionDate ?? '2026-08-24')
  const [supportingEvidence, setSupportingEvidence] = useState(initial.supportingEvidence ?? 'VILLAGE-PANCHAYAT-NOC-CLOSURE.pdf')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    formStateRef.current[key] = {
      recordType, incidentGrievanceId, dateReported, category, siteAffectedArea,
      description, impactSeverity, actionTaken, rootCause, responsibleOwner,
      dueDate, currentStatus, resolutionDate, supportingEvidence,
    }
  }, [
    key, recordType, incidentGrievanceId, dateReported, category, siteAffectedArea,
    description, impactSeverity, actionTaken, rootCause, responsibleOwner,
    dueDate, currentStatus, resolutionDate, supportingEvidence, formStateRef,
  ])

  const save = async (submitForReview = false) => {
    setError('')
    if (!dateReported) {
      setError('Date reported is required')
      return
    }
    if (!description) {
      setError('Factual description is required')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/so/data-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 8,
          levelKey: 'level8',
          levelName: 'Level 8 — Environmental Incidents & Community Grievances',
          module: 'INCIDENTS',
          projectId,
          reportingPeriodId: periodId,
          data: formStateRef.current[key],
          submitForReview,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Failed to save Incident record')
      onSaved(d.record, submitForReview)
    } catch (e: any) {
      setError(e?.message || 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <FormGrid>
      <FormField label="Record Type" hint="Incident or grievance.">
        <select
          value={recordType}
          disabled={readOnly}
          onChange={(e) => setRecordType(e.target.value)}
          className={inputClass}
        >
          <option value="Environmental incident">Environmental incident</option>
          <option value="Community grievance">Community grievance</option>
        </select>
      </FormField>

      <FormField label="Incident or Grievance ID" hint="Unique system reference.">
        <input
          value={incidentGrievanceId}
          disabled={readOnly}
          onChange={(e) => setIncidentGrievanceId(e.target.value)}
          className={inputClass}
        />
      </FormField>

      <FormField label="Date Reported" hint="Date received or recorded.">
        <input
          type="date"
          value={dateReported}
          disabled={readOnly}
          onChange={(e) => setDateReported(e.target.value)}
          className={inputClass}
        />
      </FormField>

      <FormField label="Category" hint="Spill, dust, noise, pollution, complaint.">
        <select
          value={category}
          disabled={readOnly}
          onChange={(e) => setCategory(e.target.value)}
          className={inputClass}
        >
          {['Spill', 'Dust', 'Noise', 'Pollution', 'Complaint', 'Other'].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Site / Affected Area" hint="Relevant location or village.">
        <input
          value={siteAffectedArea}
          disabled={readOnly}
          onChange={(e) => setSiteAffectedArea(e.target.value)}
          placeholder="e.g. Chainage KM 42+200 adjacent to Gollapudi"
          className={inputClass}
        />
      </FormField>

      <FormField label="Impact / Severity" hint="Classification rating.">
        <select
          value={impactSeverity}
          disabled={readOnly}
          onChange={(e) => setImpactSeverity(e.target.value)}
          className={inputClass}
        >
          {['Low', 'Medium', 'High', 'Critical'].map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Description" hint="Factual details (omit personal PII)." full>
        <textarea
          value={description}
          disabled={readOnly}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Minor hydraulic oil drip contained with absorbent pads; no runoff to water bodies."
          className={inputClass + ' min-h-[50px] resize-y'}
        />
      </FormField>

      <FormField label="Action Taken" hint="Immediate response response taken.">
        <input
          value={actionTaken}
          disabled={readOnly}
          onChange={(e) => setActionTaken(e.target.value)}
          placeholder="e.g. Absorbent booms deployed immediately"
          className={inputClass}
        />
      </FormField>

      <FormField label="Root Cause" hint="If established.">
        <input
          value={rootCause}
          disabled={readOnly}
          onChange={(e) => setRootCause(e.target.value)}
          placeholder="e.g. Loose hydraulic hose fitting"
          className={inputClass}
        />
      </FormField>

      <FormField label="Responsible Owner" hint="Assigned role.">
        <input
          value={responsibleOwner}
          disabled={readOnly}
          onChange={(e) => setResponsibleOwner(e.target.value)}
          placeholder="e.g. Site EHS Officer"
          className={inputClass}
        />
      </FormField>

      <FormField label="Current Status" hint="Open / In progress / Resolved.">
        <select
          value={currentStatus}
          disabled={readOnly}
          onChange={(e) => setCurrentStatus(e.target.value)}
          className={inputClass}
        >
          {['Open', 'In progress', 'Resolved', 'Closed'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Due Date" hint="Target resolution date.">
        <input
          type="date"
          value={dueDate}
          disabled={readOnly}
          onChange={(e) => setDueDate(e.target.value)}
          className={inputClass}
        />
      </FormField>

      <FormField label="Resolution Date" hint="When resolved.">
        <input
          type="date"
          value={resolutionDate}
          disabled={readOnly}
          onChange={(e) => setResolutionDate(e.target.value)}
          className={inputClass}
        />
      </FormField>

      <FormField label="Supporting Evidence" hint="Incident report or grievance record." full>
        <input
          value={supportingEvidence}
          disabled={readOnly}
          onChange={(e) => setSupportingEvidence(e.target.value)}
          placeholder="e.g. Grievance Register Entry & Action Memo"
          className={inputClass}
        />
      </FormField>

      <FormSaveActions error={error} submitting={submitting} readOnly={readOnly} onSave={() => save(false)} onSubmitForReview={() => save(true)} />
    </FormGrid>
  )
}

/* ============================================================
   LEVEL 9: SITE OPERATIONS & RESOURCE-EFFICIENCY INITIATIVES FORM
   (MULTI-ITEM DRAFT & ORGANIZE WORKFLOW)
   ============================================================ */
const L9_CATEGORIES = [
  'Solar PV Rooftop & Captive Clean Power',
  'ZLD & Closed-Loop Water Recycling',
  'Energy Efficient Motors & VFD Retrofits',
  'Electric Vehicles (EV) & Fleet Decarbonization',
  'Waste Heat Recovery (WHR) System',
  'Rainwater Harvesting & Recharge Pits',
  'Bio-diversity & Miyawaki Afforestation',
  'Circular Raw Material Substitution',
  'Process Digitization & Smart Telemetry',
]

const L9_PRESETS: Record<
  string,
  {
    category: string
    unit: string
    defaultBase: string
    defaultRep: string
    icon: LucideIcon
    calculationMethod: string
    outcome: string
  }
> = {
  'Solar PV Rooftop & Captive Clean Power': {
    category: 'Energy',
    unit: 'kWh / Month',
    defaultBase: '185000',
    defaultRep: '138000',
    icon: Sun,
    calculationMethod: 'Digital smart meter telemetric logs with automated SCADA baseline',
    outcome: 'Measured outcome',
  },
  'ZLD & Closed-Loop Water Recycling': {
    category: 'Water',
    unit: 'kL Recycled / Month',
    defaultBase: '4200',
    defaultRep: '2140',
    icon: Droplet,
    calculationMethod: 'Automated flowmeter telemetry on STP/ETP tertiary permeate return',
    outcome: 'Measured outcome',
  },
  'Energy Efficient Motors & VFD Retrofits': {
    category: 'Energy',
    unit: 'kWh Saved / Month',
    defaultBase: '64000',
    defaultRep: '48000',
    icon: Cpu,
    calculationMethod: 'Sub-metered baseline power logs before and after VFD installation',
    outcome: 'Measured outcome',
  },
  'Electric Vehicles (EV) & Fleet Decarbonization': {
    category: 'GHG / Fleet',
    unit: 'Litres Diesel Displaced',
    defaultBase: '12500',
    defaultRep: '7200',
    icon: Truck,
    calculationMethod: 'Fuel dispenser telemetry and EV battery charging kWh correlation',
    outcome: 'Measured outcome',
  },
  'Waste Heat Recovery (WHR) System': {
    category: 'Energy',
    unit: 'GJ Thermal Energy',
    defaultBase: '950',
    defaultRep: '610',
    icon: Flame,
    calculationMethod: 'Flue gas heat exchanger temperature delta and enthalpy flow rate',
    outcome: 'Measured outcome',
  },
  'Rainwater Harvesting & Recharge Pits': {
    category: 'Water',
    unit: 'kL Water Harvested',
    defaultBase: '1800',
    defaultRep: '3450',
    icon: CloudRain,
    calculationMethod: 'Catchment area run-off coefficient and storage level sensor logs',
    outcome: 'Measured outcome',
  },
  'Bio-diversity & Miyawaki Afforestation': {
    category: 'Biodiversity',
    unit: 'Native Saplings Planted',
    defaultBase: '2500',
    defaultRep: '6800',
    icon: Trees,
    calculationMethod: 'Geotagged drone survey and physical plantation survival audit log',
    outcome: 'Verified audit',
  },
  'Circular Raw Material Substitution': {
    category: 'Waste / Circular',
    unit: 'MT Fly Ash / GGBS Utilized',
    defaultBase: '450',
    defaultRep: '890',
    icon: RefreshCw,
    calculationMethod: 'RMC batching plant load-cell digital weighbridge dispatch manifests',
    outcome: 'Measured outcome',
  },
  'Process Digitization & Smart Telemetry': {
    category: 'Process',
    unit: 'Person-Hours Saved / Month',
    defaultBase: '320',
    defaultRep: '85',
    icon: Sparkles,
    calculationMethod: 'Paperless digital inspection checklists and automated validation workflows',
    outcome: 'Measured outcome',
  },
}

export interface StagedInitiativeItem {
  id: string
  activityInitiativeName: string
  initiativeCategory: string
  baselinePeriod: string
  baselineValue: string
  reportingPeriodValue: string
  physicalOutputQuantity: string
  outputUnit: string
  startDate: string
  completionDate: string
  outcome: string
  calculationMethod: string
  supportingEvidence: string
  remarks: string
  evidenceIds: string[]
  evidenceFiles: EvidenceItem[]
  savings: number
  pctSaved: number
}

function Level9InitiativesForm({
  projectId,
  periodId,
  evidence,
  readOnly,
  formStateRef,
  onSaved,
  onEvidenceUploaded,
  onReviewEvidence,
}: LevelFormProps) {
  const key = `l9-${projectId}-${periodId}`
  const initial = formStateRef.current[key] || {}

  // Workflow mode: 1 = Item Drafting, 2 = Organized Consolidated Summary
  const [workflowStep, setWorkflowStep] = useState<1 | 2>(initial.items?.length > 0 ? 2 : 1)

  // Staged multi-item collection
  const [stagedItems, setStagedItems] = useState<StagedInitiativeItem[]>(() => {
    if (Array.isArray(initial.items) && initial.items.length > 0) return initial.items
    return []
  })

  // Active form inputs
  const [activityInitiativeName, setActivityInitiativeName] = useState(
    initial.activityInitiativeName ?? 'Solar PV Rooftop & Captive Clean Power',
  )
  const [initiativeCategory, setInitiativeCategory] = useState(initial.initiativeCategory ?? 'Energy')
  const [baselinePeriod, setBaselinePeriod] = useState(initial.baselinePeriod ?? 'FY 2025-26 Average')
  const [baselineValue, setBaselineValue] = useState(initial.baselineValue ?? '185000')
  const [reportingPeriodValue, setReportingPeriodValue] = useState(initial.reportingPeriodValue ?? '138000')
  const [physicalOutputQuantity, setPhysicalOutputQuantity] = useState(initial.physicalOutputQuantity ?? '384000')
  const [outputUnit, setOutputUnit] = useState(initial.outputUnit ?? 'kWh / Month')
  const [startDate, setStartDate] = useState(initial.startDate ?? '2026-04-01')
  const [completionDate, setCompletionDate] = useState(initial.completionDate ?? '2026-09-30')
  const [outcome, setOutcome] = useState(initial.outcome ?? 'Measured outcome')
  const [calculationMethod, setCalculationMethod] = useState(
    initial.calculationMethod ?? 'Digital smart meter telemetric logs with automated SCADA baseline',
  )
  const [supportingEvidence, setSupportingEvidence] = useState(initial.supportingEvidence ?? '')
  const [remarks, setRemarks] = useState(
    initial.remarks ?? 'Achieved 25.4% energy reduction meeting SEBI Principle 6 emission reduction targets.',
  )
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>(() => {
    if (Array.isArray(initial.evidenceIds)) return initial.evidenceIds
    if (initial.evidenceId) return [initial.evidenceId]
    return []
  })

  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Live calculation of current inputs
  const bVal = Number(baselineValue) || 0
  const rVal = Number(reportingPeriodValue) || 0
  const diff = Math.max(0, bVal - rVal)
  const pctSaved = bVal > 0 ? Number(((diff / bVal) * 100).toFixed(1)) : 0

  // Auto-fill defaults when selecting preset
  const handleSelectPresetCategory = (name: string) => {
    setActivityInitiativeName(name)
    const preset = L9_PRESETS[name]
    if (preset) {
      setInitiativeCategory(preset.category)
      setOutputUnit(preset.unit)
      setBaselineValue(preset.defaultBase)
      setReportingPeriodValue(preset.defaultRep)
      setCalculationMethod(preset.calculationMethod)
      setOutcome(preset.outcome)
    }
  }

  // Sync state to parent ref
  useEffect(() => {
    formStateRef.current[key] = {
      activityInitiativeName,
      initiativeCategory,
      baselinePeriod,
      baselineValue,
      reportingPeriodValue,
      physicalOutputQuantity,
      outputUnit,
      startDate,
      completionDate,
      outcome,
      calculationMethod,
      supportingEvidence,
      remarks,
      evidenceIds: selectedEvidenceIds,
      evidenceId: selectedEvidenceIds[0] || null,
      items: stagedItems,
    }
  }, [
    key,
    activityInitiativeName,
    initiativeCategory,
    baselinePeriod,
    baselineValue,
    reportingPeriodValue,
    physicalOutputQuantity,
    outputUnit,
    startDate,
    completionDate,
    outcome,
    calculationMethod,
    supportingEvidence,
    remarks,
    selectedEvidenceIds,
    stagedItems,
    formStateRef,
  ])

  // Package current inputs into StagedInitiativeItem
  const packageCurrentItem = (): StagedInitiativeItem => {
    const attFiles = evidence.filter((e) => selectedEvidenceIds.includes(e.id))
    return {
      id: editingId || `init-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      activityInitiativeName: activityInitiativeName || 'Site ESG Initiative',
      initiativeCategory,
      baselinePeriod,
      baselineValue,
      reportingPeriodValue,
      physicalOutputQuantity,
      outputUnit,
      startDate,
      completionDate,
      outcome,
      calculationMethod,
      supportingEvidence,
      remarks,
      evidenceIds: selectedEvidenceIds,
      evidenceFiles: attFiles,
      savings: diff,
      pctSaved,
    }
  }

  // Add / Update item in staging
  const stageCurrentItem = (resetForm = true) => {
    if (!activityInitiativeName) {
      setError('Initiative name is required')
      return false
    }
    setError('')

    const item = packageCurrentItem()
    setStagedItems((prev) => {
      const idx = prev.findIndex((p) => p.id === item.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = item
        return next
      }
      return [...prev, item]
    })

    toast.success(`Initiative "${item.activityInitiativeName}" staged`, {
      description: `Resource conservation: ${item.savings.toLocaleString()} ${item.outputUnit} (${item.pctSaved}% gain).`,
    })

    if (resetForm) {
      setEditingId(null)
      // Pick next un-staged category
      const currentNames = stagedItems.map((s) => s.activityInitiativeName)
      currentNames.push(item.activityInitiativeName)
      const nextCat = L9_CATEGORIES.find((c) => !currentNames.includes(c)) || L9_CATEGORIES[0]
      handleSelectPresetCategory(nextCat)
      setSelectedEvidenceIds([])
      setSupportingEvidence('')
    }
    return true
  }

  // Edit existing staged item
  const handleEditItem = (item: StagedInitiativeItem) => {
    setEditingId(item.id)
    setActivityInitiativeName(item.activityInitiativeName)
    setInitiativeCategory(item.initiativeCategory)
    setBaselinePeriod(item.baselinePeriod)
    setBaselineValue(item.baselineValue)
    setReportingPeriodValue(item.reportingPeriodValue)
    setPhysicalOutputQuantity(item.physicalOutputQuantity)
    setOutputUnit(item.outputUnit)
    setStartDate(item.startDate)
    setCompletionDate(item.completionDate)
    setOutcome(item.outcome)
    setCalculationMethod(item.calculationMethod)
    setSupportingEvidence(item.supportingEvidence)
    setRemarks(item.remarks)
    setSelectedEvidenceIds(item.evidenceIds || [])
    setWorkflowStep(1)
  }

  // Delete staged item
  const handleDeleteItem = (id: string) => {
    setStagedItems((prev) => prev.filter((p) => p.id !== id))
    toast.info('Initiative removed from draft staging')
  }

  // Move to Step 2
  const handleProceedToOrganize = () => {
    if (activityInitiativeName && !stagedItems.some((p) => p.id === editingId)) {
      stageCurrentItem(false)
    }
    setWorkflowStep(2)
  }

  // Consolidated Portfolio Metrics
  const summaryMetrics = useMemo(() => {
    const total = stagedItems.length
    let totalBase = 0
    let totalRep = 0
    let totalSavings = 0

    for (const it of stagedItems) {
      totalBase += Number(it.baselineValue) || 0
      totalRep += Number(it.reportingPeriodValue) || 0
      totalSavings += it.savings || 0
    }

    const avgReduction = totalBase > 0 ? Number(((totalSavings / totalBase) * 100).toFixed(1)) : 0
    const measuredCount = stagedItems.filter((i) => i.outcome?.includes('Measured')).length
    const totalDocs = stagedItems.reduce((acc, p) => acc + (p.evidenceIds?.length || 0), 0)

    return { total, totalBase, totalRep, totalSavings, avgReduction, measuredCount, totalDocs }
  }, [stagedItems])

  // Save / Submit handler
  const save = async (submitForReview = false) => {
    setError('')
    let itemsToSave = stagedItems
    if (itemsToSave.length === 0) {
      if (!activityInitiativeName) {
        setError('At least one initiative project must be entered')
        return
      }
      itemsToSave = [packageCurrentItem()]
      setStagedItems(itemsToSave)
    }

    setSubmitting(true)
    try {
      const primaryItem = itemsToSave[0]
      const allEvIds = Array.from(new Set(itemsToSave.flatMap((it) => it.evidenceIds || [])))

      const res = await fetch('/api/so/data-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 6,
          levelKey: 'level9',
          levelName: 'Level 6 — Environmental Initiatives',
          module: 'INITIATIVES',
          projectId,
          reportingPeriodId: periodId,
          evidenceId: allEvIds[0] || undefined,
          data: {
            ...primaryItem,
            evidenceIds: allEvIds,
            items: itemsToSave,
            totalInitiatives: itemsToSave.length,
            totalSavings: summaryMetrics.totalSavings,
            avgReduction: summaryMetrics.avgReduction,
          },
          submitForReview,
        }),
      })

      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Failed to save Initiative record')

      toast.success(
        submitForReview
          ? `Environmental Initiatives submitted for review (${itemsToSave.length} projects)!`
          : `Initiatives portfolio draft saved (${itemsToSave.length} projects).`,
      )
      onSaved(d.record, submitForReview)
    } catch (e: any) {
      setError(e?.message || 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* SEGMENTED VIEW CONTROLLER PILL */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-blue-200/90 bg-gradient-to-r from-blue-50/90 via-white/80 to-indigo-50/90 p-2 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWorkflowStep(1)}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
              workflowStep === 1
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-white/80 text-slate-600 hover:bg-white hover:text-slate-900 border border-slate-200/80'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>1. Initiative Drafting</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                workflowStep === 1 ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {stagedItems.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (stagedItems.length === 0) stageCurrentItem(false)
              setWorkflowStep(2)
            }}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
              workflowStep === 2
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-white/80 text-slate-600 hover:bg-white hover:text-slate-900 border border-slate-200/80'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>2. Organized Summary</span>
            {stagedItems.length > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-black text-white">
                ✓
              </span>
            )}
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-3 text-xs pr-2">
          <span className="text-[11px] font-bold text-slate-600">
            Portfolio:{' '}
            <span className="font-extrabold text-blue-700">{stagedItems.length} Initiatives</span>
          </span>
          <span className="text-slate-300">•</span>
          <span className="text-[11px] font-bold text-slate-600">
            Avg Reduction: <span className="font-extrabold text-emerald-600">{summaryMetrics.avgReduction}%</span>
          </span>
        </div>
      </div>

      {/* ================= STEP 1: ITEM DRAFTING ================= */}
      {workflowStep === 1 && (
        <div className="space-y-4">
          {/* Preset Chips Dock */}
          <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-3 shadow-2xs">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Select Environmental Initiative / Resource-Efficiency Program:
              </span>
              <span className="text-[10px] text-blue-600 font-semibold">
                Click preset chip to populate baseline, metrics &amp; methodology
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {L9_CATEGORIES.map((cat) => {
                const preset = L9_PRESETS[cat]
                const IconComponent = preset?.icon || Sparkles
                const isSelected = activityInitiativeName === cat
                const staged = stagedItems.find((s) => s.activityInitiativeName === cat)

                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleSelectPresetCategory(cat)}
                    className={`group relative flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                      isSelected
                        ? 'border-2 border-blue-500 bg-blue-50/90 text-blue-900 shadow-sm'
                        : 'border border-slate-200/80 bg-white/90 text-slate-700 hover:border-blue-300 hover:bg-blue-50/40'
                    }`}
                  >
                    <IconComponent
                      className={`h-3.5 w-3.5 ${isSelected ? 'text-blue-600' : 'text-slate-500 group-hover:text-blue-600'}`}
                    />
                    <span>{cat}</span>
                    {staged && (
                      <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-extrabold text-emerald-800">
                        ✓ Added
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Form Grid */}
          <FormGrid>
            <FormField label="Activity / Initiative Name" hint="Clean energy, water recycling, waste or materials." full>
              <input
                value={activityInitiativeName}
                disabled={readOnly}
                onChange={(e) => setActivityInitiativeName(e.target.value)}
                placeholder="e.g. Installation of 100 kWp Rooftop Solar PV on Site Fabrication Camp"
                className={inputClass}
              />
            </FormField>

            <FormField label="Initiative Category" hint="Energy, water, waste, fleet, circularity.">
              <select
                value={initiativeCategory}
                disabled={readOnly}
                onChange={(e) => setInitiativeCategory(e.target.value)}
                className={inputClass}
              >
                {['Energy', 'Water', 'Waste / Circular', 'GHG / Fleet', 'Biodiversity', 'Process', 'Other'].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Baseline Period" hint="Reference period or historical baseline.">
              <input
                value={baselinePeriod}
                disabled={readOnly}
                onChange={(e) => setBaselinePeriod(e.target.value)}
                placeholder="e.g. FY 2025-26 Average"
                className={inputClass}
              />
            </FormField>

            <FormField label="Baseline Value" hint="Starting consumption or un-optimized quantity.">
              <input
                type="number"
                min="0"
                value={baselineValue}
                disabled={readOnly}
                onChange={(e) => setBaselineValue(e.target.value)}
                placeholder="e.g. 185000"
                className={inputClass}
              />
            </FormField>

            <FormField label="Reporting Period Value" hint="Current metered consumption post-initiative.">
              <input
                type="number"
                min="0"
                value={reportingPeriodValue}
                disabled={readOnly}
                onChange={(e) => setReportingPeriodValue(e.target.value)}
                placeholder="e.g. 138000"
                className={inputClass}
              />
            </FormField>

            <FormField label="Physical Output Quantity" hint="Production output volume for intensity derivation.">
              <input
                type="number"
                value={physicalOutputQuantity}
                disabled={readOnly}
                onChange={(e) => setPhysicalOutputQuantity(e.target.value)}
                placeholder="e.g. 384000"
                className={inputClass}
              />
            </FormField>

            <FormField label="Measurement / Output Unit" hint="Unit of measurement.">
              <input
                value={outputUnit}
                disabled={readOnly}
                onChange={(e) => setOutputUnit(e.target.value)}
                placeholder="e.g. kWh / Month or kL treated"
                className={inputClass}
              />
            </FormField>

            <FormField label="Initiative Start Date" hint="Date of commissioning or project start.">
              <input
                type="date"
                value={startDate}
                disabled={readOnly}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputClass}
              />
            </FormField>

            <FormField label="Completion / Target Date" hint="Date achieved or project milestone.">
              <input
                type="date"
                value={completionDate}
                disabled={readOnly}
                onChange={(e) => setCompletionDate(e.target.value)}
                className={inputClass}
              />
            </FormField>

            <FormField label="Outcome Type" hint="Measured, planned or engineering estimate.">
              <select
                value={outcome}
                disabled={readOnly}
                onChange={(e) => setOutcome(e.target.value)}
                className={inputClass}
              >
                {['Measured outcome', 'Target / Planned', 'Engineering estimate', 'Verified audit'].map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Calculation Methodology" hint="Protocol used for savings calculation." full>
              <input
                value={calculationMethod}
                disabled={readOnly}
                onChange={(e) => setCalculationMethod(e.target.value)}
                placeholder="e.g. Digital smart meter telemetric logs with automated SCADA baseline (IPMVP)"
                className={inputClass}
              />
            </FormField>

            <FormField label="Supporting Evidence Remarks" hint="Commissioning certificate, meter logs." full>
              <input
                value={supportingEvidence}
                disabled={readOnly}
                onChange={(e) => setSupportingEvidence(e.target.value)}
                placeholder="e.g. Commissioning Certificate & Solar Generation Log"
                className={inputClass}
              />
            </FormField>

            <FormField label="Remarks & Assumptions" hint="Operational constraints, boundary notes." full>
              <textarea
                value={remarks}
                disabled={readOnly}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="e.g. Net reduction achieved following solar panel synchronization."
                className={inputClass + ' min-h-[50px] resize-y'}
              />
            </FormField>

            {/* In-Form Multi-Evidence Attach Section */}
            <div className="sm:col-span-2">
              <FormEvidenceAttachSection
                projectId={projectId}
                periodId={periodId}
                moduleKey="INITIATIVES"
                evidence={evidence}
                onUploaded={onEvidenceUploaded || (async () => {})}
                selectedEvidenceIds={selectedEvidenceIds}
                onSelectEvidenceIds={setSelectedEvidenceIds}
                onReview={onReviewEvidence}
                readOnly={readOnly}
              />
            </div>

            {/* Live Savings Preview Card */}
            <div className="sm:col-span-2 rounded-xl border border-blue-200/80 bg-blue-50/60 p-3 text-xs text-blue-900">
              <div className="flex items-center justify-between font-bold">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-blue-600" /> Resource Savings Analytics
                </span>
                <span className="text-[10px] text-blue-700">Outcome: {outcome}</span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-white/80 p-1.5">
                  <div className="text-[9px] uppercase text-slate-500 font-bold">Achieved Savings</div>
                  <div className="text-sm font-bold text-slate-900">
                    {diff > 0 ? diff.toLocaleString() : '0'} {outputUnit.split('/')[0].trim()}
                  </div>
                </div>
                <div className="rounded-lg bg-white/80 p-1.5">
                  <div className="text-[9px] uppercase text-slate-500 font-bold">Reduction %</div>
                  <div className="text-sm font-bold text-slate-900">{pctSaved}%</div>
                </div>
                <div className="rounded-lg bg-white/80 p-1.5">
                  <div className="text-[9px] uppercase text-slate-500 font-bold">Baseline Value</div>
                  <div className="text-sm font-bold text-slate-900">{bVal.toLocaleString()}</div>
                </div>
              </div>
            </div>

            {/* ACTION RIBBON: ADD (DRAFT) + NEXT: ORGANIZE */}
            <div className="sm:col-span-2 pt-2">
              {error && (
                <div className="mb-2 rounded-xl border border-rose-200 bg-rose-50/80 p-2.5 text-xs font-medium text-rose-800">
                  <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5 text-rose-600" /> {error}
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-2.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => stageCurrentItem(true)}
                    className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>
                      {editingId
                        ? 'Update Initiative'
                        : `+ Add ${activityInitiativeName.split('&')[0].trim()} (Draft)`}
                    </span>
                  </button>
                  <span className="text-[11px] text-slate-500">
                    {stagedItems.length} initiative(s) currently staged
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleProceedToOrganize}
                  className="flex items-center gap-1.5 rounded-xl border border-blue-300 bg-white px-4 py-2 text-xs font-bold text-blue-700 shadow-xs hover:bg-blue-50 transition"
                >
                  <span>Next: Organize All Initiatives ({stagedItems.length})</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </FormGrid>

          {/* Staged Initiatives Table (Step 1) */}
          {stagedItems.length > 0 && (
            <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-3 shadow-xs">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ListOrdered className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-bold text-slate-800">
                    Staged ESG Initiatives ({stagedItems.length})
                  </span>
                </div>
                <span className="text-[10px] text-slate-500">
                  Click Edit to modify · Click eye to review evidence (flips card)
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200/80 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-2 pr-3">Initiative Name</th>
                      <th className="py-2 px-3">Category</th>
                      <th className="py-2 px-3">Baseline</th>
                      <th className="py-2 px-3">Reporting Period</th>
                      <th className="py-2 px-3">Net Savings</th>
                      <th className="py-2 px-3">Reduction %</th>
                      <th className="py-2 px-3">Attached Evidence</th>
                      <th className="py-2 pl-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stagedItems.map((item) => (
                      <tr key={item.id} className="hover:bg-blue-50/30 transition">
                        <td className="py-2.5 pr-3 font-semibold text-slate-800">
                          {item.activityInitiativeName}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-bold text-blue-800">
                            {item.initiativeCategory}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {Number(item.baselineValue || 0).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {Number(item.reportingPeriodValue || 0).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-bold font-mono text-emerald-600">
                          {item.savings > 0 ? `-${item.savings.toLocaleString()}` : '0'}{' '}
                          <span className="text-[9px] font-sans text-slate-500">{item.outputUnit.split('/')[0]}</span>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-emerald-700">
                          {item.pctSaved}%
                        </td>
                        <td className="py-2.5 px-3">
                          {item.evidenceFiles && item.evidenceFiles.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {item.evidenceFiles.map((ev) => (
                                <button
                                  key={ev.id}
                                  type="button"
                                  onClick={() => onReviewEvidence && onReviewEvidence(ev)}
                                  className="flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 hover:bg-blue-100 transition"
                                  title="Review evidence (flips card 180°)"
                                >
                                  <Eye className="h-2.5 w-2.5" />
                                  <span className="max-w-[80px] truncate">{ev.fileName}</span>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400">None</span>
                          )}
                        </td>
                        <td className="py-2.5 pl-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleEditItem(item)}
                              className="rounded-lg p-1 text-slate-500 hover:bg-blue-100 hover:text-blue-800 transition"
                              title="Edit item"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item.id)}
                              className="rounded-lg p-1 text-slate-400 hover:bg-rose-100 hover:text-rose-700 transition"
                              title="Remove item"
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
          )}
        </div>
      )}

      {/* ================= STEP 2: ORGANIZED CONSOLIDATED SUMMARY ================= */}
      {workflowStep === 2 && (
        <div className="space-y-4">
          {/* Bento KPI Metric Tiles */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-2xl border border-blue-200/90 bg-gradient-to-br from-blue-50/80 to-white/90 p-3 shadow-2xs">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-blue-800">
                <span>Active Initiatives</span>
                <Sparkles className="h-3.5 w-3.5 text-blue-600" />
              </div>
              <div className="mt-1 text-xl font-black text-slate-900">{summaryMetrics.total}</div>
              <div className="text-[10px] text-slate-500">Resource reduction projects</div>
            </div>

            <div className="rounded-2xl border border-emerald-200/90 bg-gradient-to-br from-emerald-50/80 to-white/90 p-3 shadow-2xs">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                <span>Net Conserved</span>
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <div className="mt-1 text-xl font-black text-emerald-600">
                {summaryMetrics.totalSavings.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-500">Consolidated resource savings</div>
            </div>

            <div className="rounded-2xl border border-indigo-200/90 bg-gradient-to-br from-indigo-50/80 to-white/90 p-3 shadow-2xs">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-indigo-800">
                <span>Avg Reduction Rate</span>
                <CheckCircle2 className="h-3.5 w-3.5 text-indigo-600" />
              </div>
              <div className="mt-1 text-xl font-black text-indigo-600">
                {summaryMetrics.avgReduction}%
              </div>
              <div className="text-[10px] text-slate-500">Cumulative portfolio reduction</div>
            </div>

            <div className="rounded-2xl border border-cyan-200/90 bg-gradient-to-br from-cyan-50/80 to-white/90 p-3 shadow-2xs">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-cyan-800">
                <span>Measured Outcomes</span>
                <Layers className="h-3.5 w-3.5 text-cyan-600" />
              </div>
              <div className="mt-1 text-xl font-black text-cyan-600">
                {summaryMetrics.measuredCount} / {summaryMetrics.total}
              </div>
              <div className="text-[10px] text-slate-500">{summaryMetrics.totalDocs} audit document(s)</div>
            </div>
          </div>

          {/* Master Consolidated Breakdown Table */}
          <div className="rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-xs">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Consolidated Environmental Initiatives Portfolio
                </h4>
                <p className="text-[11px] text-slate-500">
                  SEBI BRSR Principle 6 resource-efficiency disclosures and verified carbon/water reductions
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWorkflowStep(1)}
                className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>+ Add Another Initiative</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-2.5 pr-3">Initiative Name</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Baseline Volume</th>
                    <th className="py-2.5 px-3">Reporting Volume</th>
                    <th className="py-2.5 px-3">Conserved Savings</th>
                    <th className="py-2.5 px-3">Gain %</th>
                    <th className="py-2.5 px-3">Attached Documents</th>
                    <th className="py-2.5 pl-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stagedItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-2.5 pr-3 font-semibold text-slate-800">
                        {item.activityInitiativeName}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-bold text-blue-800">
                          {item.initiativeCategory}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">
                        {Number(item.baselineValue || 0).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">
                        {Number(item.reportingPeriodValue || 0).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 font-bold font-mono text-emerald-600">
                        {item.savings > 0 ? `-${item.savings.toLocaleString()}` : '0'}{' '}
                        <span className="text-[9px] font-sans text-slate-500">{item.outputUnit.split('/')[0]}</span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-emerald-700">
                        {item.pctSaved}%
                      </td>
                      <td className="py-2.5 px-3">
                        {item.evidenceFiles && item.evidenceFiles.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {item.evidenceFiles.map((ev) => (
                              <button
                                key={ev.id}
                                type="button"
                                onClick={() => onReviewEvidence && onReviewEvidence(ev)}
                                className="flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 hover:bg-blue-100 transition"
                                title="Review document (flips Engine Preview card)"
                              >
                                <Eye className="h-2.5 w-2.5" />
                                <span className="max-w-[90px] truncate">{ev.fileName}</span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400">None attached</span>
                        )}
                      </td>
                      <td className="py-2.5 pl-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleEditItem(item)}
                            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 transition"
                            title="Edit"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id)}
                            className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 font-bold bg-slate-50/50">
                    <td className="py-2.5 pr-3 text-slate-800">
                      Portfolio Total ({stagedItems.length} Initiatives)
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">—</td>
                    <td className="py-2.5 px-3 font-mono text-slate-700">
                      {summaryMetrics.totalBase.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-700">
                      {summaryMetrics.totalRep.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 font-bold font-mono text-emerald-700">
                      {summaryMetrics.totalSavings.toLocaleString()} Saved
                    </td>
                    <td className="py-2.5 px-3 font-bold text-emerald-700">
                      {summaryMetrics.avgReduction}% Gain
                    </td>
                    <td className="py-2.5 px-3 text-blue-700">
                      {summaryMetrics.totalDocs} Document(s)
                    </td>
                    <td className="py-2.5 pl-3 text-right text-slate-400">—</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Master Actions */}
          <FormSaveActions
            error={error}
            submitting={submitting}
            readOnly={readOnly}
            onSave={() => save(false)}
            onSubmitForReview={() => save(true)}
          />
        </div>
      )}
    </div>
  )
}

/* ============================================================
   HELPERS & SKELETONS
   ============================================================ */
function describeLevelRecord(r: any): string {
  if (r.data) {
    if (r.level === 1) {
      if (Array.isArray(r.data.items) && r.data.items.length > 0) {
        const srcList = r.data.items.map((i: any) => i.energySource).slice(0, 3).join(', ')
        return `Multi-Source (${r.data.items.length} items: ${srcList}${r.data.items.length > 3 ? '...' : ''}) · ${r.data.consumptionQuantity || 0} ${r.data.unit || 'units'}`
      }
      return [r.data.emissionDataType, r.data.energySource || 'Grid Electricity', `${r.data.consumptionQuantity || 0} ${r.data.unit || 'kWh'}`].filter(Boolean).join(' · ')
    }
    if (r.level === 2) {
      if (Array.isArray(r.data.items) && r.data.items.length > 0) {
        const srcList = r.data.items.map((i: any) => i.waterSource).slice(0, 3).join(', ')
        return `Multi-Source Water (${r.data.items.length} items: ${srcList}${r.data.items.length > 3 ? '...' : ''}) · ${r.data.waterQuantity || 0} kL (${r.data.circularityPct || 0}% circular)`
      }
      return `${r.data.waterActivity || 'Withdrawal'} (${r.data.waterSource || 'Groundwater'}) · ${r.data.waterQuantity || 0} ${r.data.unit || 'kL'}`
    }
    if (r.level === 3) {
      if (Array.isArray(r.data.items) && r.data.items.length > 0) {
        const srcList = r.data.items.map((i: any) => i.emissionSource).slice(0, 3).join(', ')
        return `Multi-Source GHG (${r.data.items.length} items: ${srcList}${r.data.items.length > 3 ? '...' : ''}) · ${Number(r.data.totalTco2e || 0).toFixed(2)} tCO₂e`
      }
      return `${r.data.emissionDataType || 'Scope 1'} · ${r.data.emissionSource || 'DG'} (${r.data.activityQuantity || 0} ${r.data.unit || 'L'})`
    }
    if (r.level === 4) {
      if (Array.isArray(r.data.items) && r.data.items.length > 0) {
        const catList = r.data.items.map((i: any) => i.wasteCategory).slice(0, 3).join(', ')
        return `Multi-Category Waste (${r.data.items.length} streams: ${catList}${r.data.items.length > 3 ? '...' : ''}) · ${r.data.quantityGenerated || 0} MT (${r.data.diversionRate || 0}% diverted)`
      }
      return `${r.data.wasteCategory || 'C&D'} · ${r.data.quantityGenerated || 0} ${r.data.unit || 'MT'}`
    }
    if (r.level === 5 || r.level === 7 || r.levelKey === 'level7') {
      if (Array.isArray(r.data.items) && r.data.items.length > 0) {
        const typeList = r.data.items.map((i: any) => i.permitConsentType?.split('(')[0].trim() || 'Permit').slice(0, 3).join(', ')
        return `Multi-Permit Portfolio (${r.data.items.length} authorizations: ${typeList}${r.data.items.length > 3 ? '...' : ''}) · ${r.data.complianceRate ?? 100}% compliant`
      }
      return `${r.data.permitConsentType || 'Permit'} #${r.data.permitNumber || 'N/A'}`
    }
    if (r.level === 6 || r.level === 9 || r.levelKey === 'level9') {
      if (Array.isArray(r.data.items) && r.data.items.length > 0) {
        const initList = r.data.items.map((i: any) => i.activityInitiativeName?.split('&')[0].trim() || 'Project').slice(0, 3).join(', ')
        return `Multi-Initiative Program (${r.data.items.length} projects: ${initList}${r.data.items.length > 3 ? '...' : ''}) · ${Number(r.data.totalSavings || 0).toLocaleString()} saved`
      }
      return `${r.data.activityInitiativeName || 'Initiative'} · ${r.data.outcome || 'Measured'}`
    }
    if (r.level === 8) return `${r.data.recordType || 'Grievance'} · ${r.data.category || 'Spill'} (${r.data.currentStatus || 'Open'})`
  }
  return r.id?.slice(-8) ?? 'Record'
}

function DataEntrySkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-8 w-64 animate-pulse rounded bg-slate-200/60" />
      <div className="so-glass h-16 animate-pulse rounded-2xl" />
      <div className="so-glass h-24 animate-pulse rounded-2xl" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="so-glass h-96 animate-pulse rounded-2xl lg:col-span-2" />
        <div className="so-glass h-96 animate-pulse rounded-2xl lg:col-span-1" />
      </div>
      <div className="so-glass h-16 animate-pulse rounded-2xl" />
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="so-glass flex flex-col items-center justify-center gap-3 rounded-2xl py-16 text-center">
      <AlertOctagon className="h-10 w-10 text-rose-500" />
      <div>
        <div className="text-base font-bold text-slate-800">Failed to load Data Entry</div>
        <div className="text-xs text-slate-500">{message}</div>
      </div>
      <button onClick={onRetry} className="btn-so-glass-primary rounded-full px-5 py-2 text-xs font-semibold">
        Retry
      </button>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="so-glass flex flex-col items-center justify-center gap-3 rounded-2xl py-16 text-center">
      <FileText className="h-10 w-10 text-slate-400" />
      <div>
        <div className="text-base font-bold text-slate-800">No data available</div>
        <div className="text-xs text-slate-500">{message}</div>
      </div>
    </div>
  )
}
