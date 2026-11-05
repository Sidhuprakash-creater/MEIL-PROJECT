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

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, CheckCircle2, Clock, Send, Save, ChevronRight, ChevronLeft, ChevronDown, Building2, CalendarClock, Lock, X, AlertOctagon } from 'lucide-react'
import { toast } from 'sonner'
import { CsvImportDialog, ImportCsvButton } from '../csv-import-dialog'
import { FlippableEngineEvidencePanel } from './engine-evidence-panel'
import { Level1EnergyForm } from './forms/level1-energy'
import { Level2WaterForm } from './forms/level2-water'
import { Level3GhgForm } from './forms/level3-ghg'
import { Level4WasteForm } from './forms/level4-waste'
import { Level5SafetyForm } from './forms/level5-safety'
import { Level6TrainingForm } from './forms/level6-training'
import { Level7ComplianceForm } from './forms/level7-compliance'
import { Level8IncidentsForm } from './forms/level8-incidents'
import { Level9InitiativesForm } from './forms/level9-initiatives'
import { ItemDetailModal } from '../item-detail-modal'
import { Stepper } from './primitives'
import { describeLevelRecord, DataEntrySkeleton, ErrorState, EmptyState } from './states'
import { LevelReviewModal, FinalSubmitAllModal } from '../submission-flow-modals'
import { SUB_MODULES, normalizeSubModule, READ_ONLY_ROLES, STEPS, ApiBaseContext, type LevelKey, type Project, type Period, type EvidenceItem, type SavedRecord } from './core'

/* ============================================================
   MAIN COMPONENT: DataEntryModule
   ============================================================ */

export interface DataEntryModuleProps {
  subModule?: string
  /** Console API surface — '/api/pu' (Project User portal) or '/api/so' (site-ops console). */
  apiBase?: string
  roleKey?: string
  userScopes?: { scopeType: string; scopeId: string }[]
  appProjectId?: string | null
  /** Signed-in user identity — shown on submit confirmations (no hardcoded fallback). */
  submitter?: { name: string; email: string; roleLabel: string }
  onSubModuleChange?: (key: LevelKey) => void
}

export function DataEntryModule({
  subModule: subModuleProp,
  apiBase = '/api/pu',
  roleKey: roleKeyProp,
  userScopes,
  appProjectId,
  submitter,
  onSubModuleChange,
}: DataEntryModuleProps) {
  const roleKey = roleKeyProp ?? ''
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
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const [cardDensity, setCardDensity] = useState<'compact' | 'normal' | 'expanded'>('normal')
  const [selectedDetailItem, setSelectedDetailItem] = useState<any | null>(null)
  const [selectedSourceToEdit, setSelectedSourceToEdit] = useState<{ levelKey: string; sourceName: string } | null>(null)

  const handleSelectSourceItem = (levelKey: string, sourceName: string) => {
    setLocalLevel(levelKey as LevelKey)
    onSubModuleChange?.(levelKey as LevelKey)
    setSelectedSourceToEdit({ levelKey, sourceName })
    toast.info(`Loaded ${sourceName} details in left panel`)
    const el = document.getElementById('level-form-container')
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
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
  /* Records of the ACTIVE level only — the list under the form. The journey
     receives the full set so prior levels keep their cards when switching. */
  const activeLevelRecords = existingRecords.filter((r: any) => {
    if (activeLevelKey === 'level5') return r.level === 5 || r.level === 7
    if (activeLevelKey === 'level6') return r.level === 6 || r.level === 9
    if (activeLevelKey === 'level7') return r.level === 5 || r.level === 7
    if (activeLevelKey === 'level9') return r.level === 6 || r.level === 9
    return r.level === Number(String(activeLevelKey).replace('level', '')) || r.levelKey === activeLevelKey
  })
  /* Reviewer corrections keyed by record id — rendered inline under rejected rows */
  const [recordCorrections, setRecordCorrections] = useState<Record<string, any[]>>({})
  const [csvImportOpen, setCsvImportOpen] = useState(false)
  const [submittingAll, setSubmittingAll] = useState(false)
  const [submitAllSuccess, setSubmitAllSuccess] = useState<any | null>(null)
  const [reviewModalState, setReviewModalState] = useState<{
    open: boolean
    levelKey: LevelKey
    data: any
    nextLevel: any
  } | null>(null)
  const [finalSubmitModalOpen, setFinalSubmitModalOpen] = useState(false)
  const [stagedLevels, setStagedLevels] = useState<Record<string, any>>({})

  const handleRequestNextReview = (levelKey: LevelKey, data?: any) => {
    const currentData = data || formStateRef.current[levelKey] || {}
    setStagedLevels((prev) => ({
      ...prev,
      [levelKey]: { ...currentData, stagedAt: new Date().toISOString() },
    }))
    const idx = SUB_MODULES.findIndex((m) => m.key === levelKey)
    const nextMod = SUB_MODULES[idx + 1] || null
    setReviewModalState({
      open: true,
      levelKey,
      data: currentData,
      nextLevel: nextMod,
    })
  }

  const handleSubmitAll = async (): Promise<boolean> => {
    if (!selectedProjectId || !selectedPeriodId) {
      toast.error('Select a valid project and period before submitting')
      return false
    }
    setSubmittingAll(true)
    setActionError('')
    try {
      const res = await fetch(`${apiBase}/data-entry/submit-all`, {
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
        description: `Successfully submitted all ${SUB_MODULES.length} BRSR disclosure levels for ${selectedProject?.projectName || 'Site'} at once. Status: SUBMITTED.`,
      })
      setActionInfo(`All ${SUB_MODULES.length} environmental levels submitted at once to Project Admin! Status: SUBMITTED. Dossier #${result.dossierId?.slice(-8)} generated.`)
      refreshExistingRecords()
      return true
    } catch (e: any) {
      toast.error('Submission failed', { description: e?.message })
      setActionError(e?.message || 'Failed to submit all site data')
      return false
    } finally {
      setSubmittingAll(false)
    }
  }

  // In-memory form state cache across level tabs
  const formStateRef = useRef<Record<string, Record<string, any>>>({})

  // ---- 1. Load projects + periods in ONE round-trip (org tree carries both)
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetch(`${apiBase}/organization/tree`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('org tree failed'))))
      .then((tr) => {
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
        const periodList: Period[] = tr.periods || []
        setPeriods(periodList)
        const scopeProj = userScopes?.find((s) => s.scopeType === 'PROJECT')
        const defaultProject =
          (appProjectId ? flat.find((p) => p.id === appProjectId || p.projectCode === appProjectId) : null) ||
          (scopeProj ? flat.find((p) => p.id === scopeProj.scopeId) : null) ||
          flat[0] ||
          null
        setSelectedProjectId(defaultProject?.id ?? null)

        /* Most recent open period, else the latest period — no magic labels. */
        const openPeriods = periodList.filter((p: any) => p.status === 'OPEN')
        const defaultPeriod =
          openPeriods[openPeriods.length - 1] || periodList[periodList.length - 1] || null
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
  }, [apiBase, userScopes, appProjectId])

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
      setRecordCorrections({})
      return
    }
    try {
      const res = await fetch(
        `${apiBase}/data-entry?projectId=${encodeURIComponent(selectedProjectId)}&periodId=${encodeURIComponent(selectedPeriodId)}`
      )
      if (res.ok) {
        const d = await res.json()
        setExistingRecords(d.records || [])
        setRecordCorrections(d.correctionsByRecord || {})
      } else {
        setExistingRecords([])
        setRecordCorrections({})
      }
    } catch {
      setExistingRecords([])
      setRecordCorrections({})
    }
  }, [apiBase, selectedProjectId, selectedPeriodId, activeSub.level])

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
      const res = await fetch(`/api/pu/evidence?projectId=${encodeURIComponent(selectedProjectId)}`)
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
      setActionInfo(`${activeSub.label} data captured. Opening Review summary...`)
      handleRequestNextReview(activeLevelKey, formStateRef.current[activeLevelKey])
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
      // Run the real server-side rule engine over every saved source record
      // in the selected project + period scope (never fabricate pass counts).
      const res = await fetch(`${apiBase}/validation/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: selectedProjectId, periodId: selectedPeriodId }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Validation run failed')
      const targets = Number(result.targets) || 0
      const errorCount = Number(result.errors) || 0
      const warningCount = Number(result.warnings) || 0
      const passedCount = Number(result.passed) || 0
      setValidationRun({ passed: passedCount, errors: errorCount, warnings: warningCount })
      setStep(4)
      if (targets === 0) {
        toast.info('Nothing to validate yet', {
          description: 'No saved records found for this project and period — save a draft first.',
        })
      } else if (errorCount === 0) {
        toast.success(`Validation passed for ${targets} record(s)`, {
          description: `No blocking errors found${warningCount > 0 ? ` · ${warningCount} warning(s)` : ''}. Ready to submit for review.`,
        })
      } else {
        toast.warning('Validation completed with issues', {
          description: `${errorCount} error(s) must be rectified before final approval.`,
        })
      }
    } catch (e: any) {
      setActionError(e?.message || 'Validation failed')
      toast.error('Validation failed', { description: e?.message })
    } finally {
      setValidating(false)
    }
  }
  return (
    <ApiBaseContext.Provider value={apiBase}>
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
              {SUB_MODULES.length} BRSR Levels
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
          <div className="glass-subtle flex items-center gap-2 rounded-full py-1.5 pl-3.5 pr-2.5 text-xs shadow-sm">
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

          <div className="glass-subtle flex items-center gap-2 rounded-full py-1.5 pl-3.5 pr-2.5 text-xs shadow-sm">
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
            onClick={() => setFinalSubmitModalOpen(true)}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/25 hover:opacity-95 active:scale-95 transition-all cursor-pointer"
            title="Review and submit all site environmental data to Project Admin at once"
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
                All {SUB_MODULES.length} Environmental Levels Submitted at Once to Project Admin
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
        className="glass-nav flex items-center gap-1.5 overflow-x-auto scroll-elegant rounded-2xl p-1.5 shadow-sm border border-white/60"
      >
        {SUB_MODULES.map((m) => {
          const active = m.key === activeLevelKey
          const Icon = m.icon
          return (
            <button
              key={m.key}
              onClick={() => {
                setLocalLevel(m.key)
                onSubModuleChange?.(m.key)
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
      <Stepper
        step={step}
        onStepClick={(s) => {
          setStep(s)
          if (s === 2 && panelCollapsed) setPanelCollapsed(false)
          if (s === 5) setFinalSubmitModalOpen(true)
        }}
      />

      {/* MAIN TWO-COLUMN WORKSPACE GRID */}
      <div className="grid items-start gap-4 lg:grid-cols-3">
        {/* LEFT COLUMN: THE LEVEL FORM PANEL (2 COLS) */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          className={`glass  rounded-[22px] p-5 transition-all duration-300 ${panelCollapsed ? "lg:col-span-3 w-full" : "lg:col-span-2"}`}
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

          {/* Form Container */}
          <div className="space-y-3">
            {readOnly && (
              <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 px-3 py-2 text-xs font-medium text-amber-900">
                <Lock className="mr-1.5 inline h-3.5 w-3.5" /> Read-only mode — your role ({roleKey}) does not permit editing data.
              </div>
            )}

            <AnimatePresence mode="wait">
              <motion.div
                /* Remount per project+period+level: staged items live in per-form
                   state keyed by scope, so switching project or period can never
                   carry unsaved items into another scope's save payload. */
                key={`${selectedProjectId ?? ''}:${selectedPeriodId ?? ''}:${activeLevelKey}`}
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
                    onViewItem={setSelectedDetailItem}
                    selectedSourceToEdit={selectedSourceToEdit}
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
                    onViewItem={setSelectedDetailItem}
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
                    onViewItem={setSelectedDetailItem}
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
                    onViewItem={setSelectedDetailItem}
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

            {activeLevelRecords.length > 0 ? (
              <div className="max-h-64 space-y-1.5 overflow-y-auto scroll-elegant pr-1">
                {activeLevelRecords.map((r: any) => {
                  const corrections = recordCorrections[r.id] || []
                  const isCorrection = r.status === 'CORRECTION_REQUESTED' || corrections.length > 0
                  return (
                    <div key={r.id} className="space-y-1">
                      <div
                        className={`flex items-center justify-between rounded-xl p-2.5 text-xs shadow-sm ring-1 ${
                          isCorrection ? 'bg-rose-50/70 ring-rose-200' : 'bg-white/60 ring-slate-100'
                        }`}
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
                      {/* Inline reviewer feedback — which part failed and why */}
                      {corrections.length > 0 && (
                        <div className="rounded-xl border border-rose-200 bg-white/95 p-2.5 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-rose-700">
                            <AlertOctagon className="h-3.5 w-3.5" />
                            Rejected by Project Admin — fix and resubmit
                          </div>
                          {corrections.map((c: any, ci: number) => (
                            <div key={c.id || ci} className="rounded-lg bg-rose-50/80 border border-rose-200/80 px-2.5 py-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-bold text-slate-800">{c.field || 'Item'}</span>
                                <span
                                  className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                                    c.severity === 'ERROR' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                                  }`}
                                >
                                  {c.severity || 'WARNING'}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-700 mt-0.5">{c.issue || c.comment}</div>
                              {c.reviewer && (
                                <div className="text-[9.5px] text-slate-400 mt-0.5">
                                  — {c.reviewer}
                                  {c.createdAt ? `, ${new Date(c.createdAt).toLocaleDateString()}` : ''}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
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
          levels={SUB_MODULES}
          allFormData={formStateRef.current}
          stagedLevels={stagedLevels}
          existingRecords={existingRecords}
          onSelectLevel={(k) => {
            setLocalLevel(k as LevelKey)
            onSubModuleChange?.(k as LevelKey)
            setStep(1)
          }}
          onOpenFinalReview={() => setFinalSubmitModalOpen(true)}
          panelCollapsed={panelCollapsed}
          onToggleCollapse={() => setPanelCollapsed(true)}
          onViewItem={setSelectedDetailItem}
          onSelectSourceItem={handleSelectSourceItem}
        />
      </div>

      {/* Floating Restore Tab when Journey Panel is Collapsed */}
      {panelCollapsed && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className="fixed right-3 top-1/2 -translate-y-1/2 z-40"
        >
          <button
            type="button"
            onClick={() => setPanelCollapsed(false)}
            className="group flex flex-col items-center gap-1.5 rounded-2xl bg-white/95 p-2.5 shadow-xl border border-sky-200/90 backdrop-blur-md hover:bg-sky-50 transition active:scale-95 cursor-pointer"
            title="Expand Emission Journey & Calculation Panel"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-sky-700 group-hover:bg-sky-600 group-hover:text-white transition">
              <ChevronLeft className="h-4 w-4 stroke-[2.5]" />
            </div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-800 [writing-mode:vertical-rl] py-1">
              Expand Journey
            </span>
          </button>
        </motion.div>
      )}

      {/* STICKY BOTTOM 5-STEP WORKFLOW FOOTER */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        className="glass-nav sticky bottom-3 z-20 rounded-2xl p-3 shadow-lg"
      >
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          {/* 5-Step Interactive Workflow Stepper */}
          <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto scroll-none py-1">
            {STEPS.map((s, i) => {
              const n = (i + 1) as 1 | 2 | 3 | 4 | 5
              const active = step === n
              const done = step > n
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setStep(n)
                    if (n === 2 && panelCollapsed) setPanelCollapsed(false)
                    if (n === 5) setFinalSubmitModalOpen(true)
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition cursor-pointer active:scale-95 ${
                    active
                      ? 'bg-blue-600/10 text-blue-700 font-bold border border-blue-200 shadow-2xs'
                      : done
                      ? 'text-emerald-700 hover:bg-emerald-50'
                      : 'text-slate-500 hover:bg-white/80'
                  }`}
                  title={`Step ${n}: ${s}`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                      active
                        ? 'bg-blue-600 text-white shadow-xs'
                        : done
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {done ? <CheckCircle2 className="h-3 w-3" /> : n}
                  </span>
                  <span className="hidden sm:inline text-[11px] font-semibold whitespace-nowrap">{s}</span>
                  {i < STEPS.length - 1 && (
                    <ChevronRight className="h-3 w-3 text-slate-300 ml-1 shrink-0" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Action on right */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={readOnly || submittingAll}
              onClick={() => setFinalSubmitModalOpen(true)}
              className="btn-liquid-blue flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold text-white shadow-md hover:shadow-blue-500/25 transition active:scale-95 cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Submit to Project Admin</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* Detailed iOS Liquid Glass Item View Modal */}
      <ItemDetailModal
        open={!!selectedDetailItem}
        item={selectedDetailItem}
        onClose={() => setSelectedDetailItem(null)}
      />

      {/* Bulk CSV Import Dialog */}
      <CsvImportDialog
          apiBase={apiBase}
        open={csvImportOpen}
        onOpenChange={setCsvImportOpen}
        subModule={activeLevelKey === 'level1' ? 'energy' : activeLevelKey === 'level2' ? 'water' : 'waste'}
        projectId={selectedProjectId}
        reportingPeriodId={selectedPeriodId}
        projects={projects}
        periods={periods}
        onImported={refreshExistingRecords}
      />

      {/* Level Review & Progression Modal */}
      {reviewModalState && (
        <LevelReviewModal
          open={reviewModalState.open}
          onClose={() => setReviewModalState(null)}
          levelKey={reviewModalState.levelKey}
          levelName={activeSub.brsrTitle}
          levelNumber={activeSub.level}
          levelIcon={activeSub.icon}
          badgeColor={activeSub.badgeColor}
          data={reviewModalState.data}
          evidenceList={evidence}
          projectName={selectedProject?.projectName || 'Site Project'}
          periodLabel={selectedPeriod?.label || 'FY 2026-27'}
          nextLevel={reviewModalState.nextLevel}
          onProceedNext={() => {
            if (reviewModalState.nextLevel) {
              setStagedLevels((prev) => ({
                ...prev,
                [reviewModalState.levelKey]: {
                  ...(reviewModalState.data || formStateRef.current[reviewModalState.levelKey] || {}),
                  stagedAt: new Date().toISOString(),
                },
              }))
              setLocalLevel(reviewModalState.nextLevel.key as LevelKey)
              onSubModuleChange?.(reviewModalState.nextLevel.key as LevelKey)
              setStep(1)
              setSaved(null)
              toast.info(`Switched to Level ${reviewModalState.nextLevel.level}: ${reviewModalState.nextLevel.label}`)
            }
          }}
          onOpenFinalReview={() => setFinalSubmitModalOpen(true)}
        />
      )}

      {/* Final Consolidated Review & Submit All Modal */}
      <FinalSubmitAllModal
        open={finalSubmitModalOpen}
        onClose={() => setFinalSubmitModalOpen(false)}
        projectName={selectedProject?.projectName || 'Site Project'}
        periodLabel={selectedPeriod?.label || 'FY 2026-27'}
        submitting={submittingAll}
        onSubmitAll={handleSubmitAll}
        levels={SUB_MODULES}
        allData={formStateRef.current}
        projectId={selectedProjectId}
        periodId={selectedPeriodId}
        evidenceList={evidence}
        submitterName={submitter?.name}
        submitterRole={submitter?.roleLabel}
        submitterEmail={submitter?.email}
      />
      </div>
    </ApiBaseContext.Provider>
  )
}
/* Backwards-compatible exports for console module-routers */
export { SUB_MODULES, normalizeSubModule } from './core'
export type { LevelKey, LevelConfig, EvidenceItem, SavedRecord } from './core'
