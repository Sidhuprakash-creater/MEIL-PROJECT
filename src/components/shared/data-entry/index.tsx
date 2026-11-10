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
import { motion } from 'framer-motion'
import { FileText, CheckCircle2, Clock, Send, Save, ChevronRight, ChevronLeft, ChevronDown, Building2, CalendarClock, Lock, X, AlertOctagon, Plus, MoveLeft } from 'lucide-react'
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
import { LevelReviewModal, FinalSubmitAllModal, SubmitAllSuccessModal } from '../submission-flow-modals'
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

  /* ---- Captured-item flight animation (left "+ Add (Draft)" → right journey panel)
          and drag-and-drop opening of captured cards in the left panel ---- */
  const [flight, setFlight] = useState<null | {
    id: number
    name: string
    quantity: number
    unit: string
    estTco2e?: number
    from: DOMRect
    to: DOMRect
  }>(null)
  const [flashItem, setFlashItem] = useState<{ levelKey: string; name: string; ts: number } | null>(null)
  const [dragOverForm, setDragOverForm] = useState(false)
  const flightTimerRef = useRef<number | null>(null)

  // Fired by level forms right after an item is captured via "+ Add (Draft)"
  const handleItemStaged = (
    payload: { levelKey: string; id: string; name: string; quantity: number; unit: string; estTco2e?: number },
    sourceEl: HTMLElement | null
  ) => {
    const ts = Date.now()
    setFlashItem({ levelKey: payload.levelKey, name: payload.name, ts })
    window.setTimeout(() => setFlashItem((f) => (f && f.ts === ts ? null : f)), 2600)

    // Small delay so the journey panel tab (auto-switched by flashItem) renders first
    window.setTimeout(() => {
      const targetEl =
        (document.querySelector(
          '[data-journey-captured-list="true"][data-level-key="' + payload.levelKey + '"]'
        ) as HTMLElement | null) || (document.querySelector('[data-journey-panel]') as HTMLElement | null)
      if (!sourceEl || !targetEl) return
      const from = sourceEl.getBoundingClientRect()
      const to = targetEl.getBoundingClientRect()
      if (!from.width || !to.width) return
      const { levelKey: _lk, id: _id, ...flightInfo } = payload
      setFlight({ id: Date.now(), ...flightInfo, from, to })
      if (flightTimerRef.current) window.clearTimeout(flightTimerRef.current)
      flightTimerRef.current = window.setTimeout(() => setFlight(null), 1050)
    }, 90)
  }

  // Accept captured cards dragged from the journey panel — opens them for editing
  const handleFormDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOverForm(false)
    try {
      const raw = e.dataTransfer.getData('application/x-brsr-source')
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (parsed?.levelKey && parsed?.sourceName) {
        handleSelectSourceItem(parsed.levelKey, parsed.sourceName)
      }
    } catch {
      // ignore malformed drop payloads
    }
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

  /* Forms stage data under scoped keys `l{n}-{projectId}-{periodId}` (e.g.
     'level7' → 'l7-…'); resolve the staged entry for a levelKey with an
     unscoped fallback so reviews/submit-all never read an empty bucket. */
  const stagedForLevel = (levelKey: string): Record<string, any> => {
    const n = String(levelKey).replace('level', '')
    const scoped = selectedProjectId && selectedPeriodId
      ? formStateRef.current[`l${n}-${selectedProjectId}-${selectedPeriodId}`]
      : undefined
    return scoped || formStateRef.current[levelKey] || {}
  }

  const handleRequestNextReview = (levelKey: LevelKey, data?: any) => {
    const currentData = data && Object.keys(data).length ? data : stagedForLevel(levelKey)
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

      /* Verify BEFORE confirming: re-read the submissions ledger (cache
         bypassed) — the same db.submission table the Project Admin console
         reads — and require the consolidated dossier row plus every level the
         server reported as submitted. Only when this check passes does the
         confirmation popup appear. */
      const submittedItems: Array<{ level?: number; name?: string }> = Array.isArray(result.items) ? result.items : []
      let verified = false
      try {
        const vres = await fetch(
          `${apiBase}/submissions?projectId=${selectedProjectId}&periodId=${selectedPeriodId}&status=SUBMITTED&take=50&bypass=true`,
        )
        const vdata = await vres.json()
        const rows: Array<{ module?: string; status?: string }> = vdata?.items || []
        const submittedRows = rows.filter((r) => r.status === 'SUBMITTED')
        const hasDossier = submittedRows.some((r) => r.module === 'ALL_LEVELS')
        verified = hasDossier && submittedRows.length >= submittedItems.length
      } catch {}
      if (!verified) {
        throw new Error('Submission saved, but verification against the submissions ledger failed — please open the Submissions screen and check before submitting again.')
      }

      setSubmitAllSuccess(result)
      const submittedCount = Number(result.submittedCount) || SUB_MODULES.length
      toast.success('Site Data Submitted to Project Admin!', {
        description: `Successfully submitted ${submittedCount} of ${SUB_MODULES.length} BRSR disclosure levels for ${selectedProject?.projectName || 'Site'}. Status: SUBMITTED.`,
      })
      setActionInfo(`${submittedCount} of ${SUB_MODULES.length} environmental levels submitted at once to Project Admin! Status: SUBMITTED. Dossier #${result.dossierId?.slice(-8)} generated.`)
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
  /* Records fetch is scoped to project + period only. The endpoint returns
     every level's records and the list is filtered client-side, so switching
     level tabs never re-hits the network — the journey panel and the record
     table render instantly from the already-loaded snapshot. */
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
  }, [apiBase, selectedProjectId, selectedPeriodId])

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
  /* Closed-period guard — every write path (form save/submit, CSV import,
     Submit All) is disabled while the selected period is not OPEN. */
  const periodOpen = (selectedPeriod?.status ?? 'OPEN') === 'OPEN'

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
      handleRequestNextReview(activeLevelKey, stagedForLevel(activeLevelKey))
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
      setSaved((prev) => (prev ? { ...prev, evidenceId, evidenceIds: evidenceId ? [evidenceId] : [] } : prev))
      setStep(3)
      toast.info('Evidence document linked', {
        description: evidenceId ? 'Document attached to verification trail.' : 'No document attached.',
      })

      /* Persist the attachment — the local state above only mirrors the UI.
         Re-POST the same record with the evidence fields; the route resolves
         the body `id` back to the existing record (saveLevelRecord merges by
         id), so no duplicate record is created. Payload mirrors what the level
         form POSTed on save (saved.data is the previously persisted payload). */
      if (saved.id) {
        try {
          const res = await fetch(`${apiBase}/data-entry`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: saved.id,
              level: saved.level,
              levelKey: activeSub.key,
              levelName: activeSub.brsrTitle || activeSub.label,
              module: saved.module || activeSub.moduleKey,
              projectId: selectedProjectId,
              reportingPeriodId: selectedPeriodId,
              data: {
                ...(saved.data || stagedForLevel(activeLevelKey)),
                evidenceId,
                evidenceIds: evidenceId ? [evidenceId] : [],
              },
              evidenceId: evidenceId ?? undefined,
              evidenceIds: evidenceId ? [evidenceId] : [],
              submitForReview: false,
            }),
          })
          if (!res.ok) {
            const d = await res.json().catch(() => ({}))
            throw new Error(d.error || 'Failed to persist evidence attachment')
          }
          refreshExistingRecords()
        } catch (e: any) {
          toast.error('Evidence link not saved', {
            description: e?.message || 'The attachment could not be persisted to the record.',
          })
        }
      }
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
            <span
              className={`status-pill ${periodOpen ? 'status-approved' : 'status-missing'}`}
              title={periodOpen ? undefined : 'Reporting period is closed'}
            >
              <Clock className="h-3 w-3" /> {periodOpen ? 'Open Period' : 'Closed Period'}
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
          {/* Static Project Badge — Fixed to chosen project, no dropdown */}
          <div
            className="glass-subtle flex items-center gap-2 rounded-full py-1.5 px-3.5 text-xs shadow-sm"
            title={selectedProject?.projectName || selectedProject?.projectCode || 'Selected Project Site'}
          >
            <Building2 className="h-3.5 w-3.5 shrink-0 text-blue-600" />
            <span className="text-[13px] font-bold text-slate-800">
              {selectedProject?.projectCode || 'PRJ-KKD-RIG'}
            </span>
          </div>

          {/* Month Selector Dropdown */}
          <div className="glass-subtle flex items-center gap-2 rounded-full py-1.5 pl-3.5 pr-2.5 text-xs shadow-sm">
            <CalendarClock className="h-3.5 w-3.5 shrink-0 text-blue-600" />
            <select
              value={selectedPeriodId ?? ''}
              disabled={readOnly}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              className="cursor-pointer appearance-none bg-transparent text-[13px] font-bold text-slate-800 outline-none pr-1"
              aria-label="Select Reporting Month"
            >
              {periods.map((p) => (
                <option key={p.id} value={p.id} className="text-slate-900 bg-white py-1">
                  {p.label}
                </option>
              ))}
            </select>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400 pointer-events-none" />
          </div>

          {/* Bulk CSV Import Button */}
          <ImportCsvButton
            disabled={readOnly || !periodOpen || !(activeLevelKey === 'level1' || activeLevelKey === 'level2' || activeLevelKey === 'level4')}
            disabledReason={
              readOnly
                ? 'Your role does not permit data entry'
                : !periodOpen
                ? 'Reporting period is closed'
                : 'CSV import supports Energy, Water and Waste levels'
            }
            onClick={() => setCsvImportOpen(true)}
          />

          {/* Submit All to Project Admin Button */}
          <button
            type="button"
            disabled={submittingAll || readOnly || !periodOpen}
            onClick={() => setFinalSubmitModalOpen(true)}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/25 hover:opacity-95 active:scale-95 transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
            title={periodOpen ? 'Review and submit all site environmental data to Project Admin at once' : 'Reporting period is closed'}
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
        transition={{ duration: 0.18, delay: 0.02 }}
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
          /* When the journey panel is collapsed it stays collapsed — the
             step tracker must never auto-reopen the sequence journey item
             panel. It only comes back via the "Expand Journey" restore tab. */
          if (s === 5) setFinalSubmitModalOpen(true)
        }}
      />

      {/* MAIN TWO-COLUMN WORKSPACE GRID */}
      <div className="grid items-start gap-4 lg:grid-cols-3">
        {/* LEFT COLUMN: THE LEVEL FORM PANEL (2 COLS) — drop target for captured journey cards */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1], delay: 0.04 }}
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'copy'
            if (!dragOverForm) setDragOverForm(true)
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverForm(false)
          }}
          onDrop={handleFormDrop}
          className={`glass relative rounded-[22px] p-5 transition-all duration-300 ${
            panelCollapsed ? 'lg:col-span-3 w-full' : 'lg:col-span-2'
          } ${dragOverForm ? 'ring-4 ring-sky-400/60 ring-offset-2 ring-offset-white' : ''}`}
        >
          {/* Drop hint while dragging a captured item card over the form panel */}
          {dragOverForm && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="pointer-events-none absolute inset-x-4 top-3 z-30 flex items-center justify-center gap-2 rounded-2xl border border-dashed border-sky-400 bg-sky-50/95 px-4 py-2.5 text-xs font-bold text-sky-800 shadow-lg backdrop-blur-md"
            >
              <MoveLeft className="h-4 w-4" />
              Drop the captured item card here to open it for editing
            </motion.div>
          )}

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

            <motion.div
              /* Remount per project+period+level: staged items live in per-form
                 state keyed by scope, so switching project or period can never
                 carry unsaved items into another scope's save payload. */
              key={`${selectedProjectId ?? ''}:${selectedPeriodId ?? ''}:${activeLevelKey}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.12 }}
            >
                {activeLevelKey === 'level1' && (
                  <Level1EnergyForm
                    projectId={selectedProjectId!}
                    periodId={selectedPeriodId!}
                    evidence={evidence}
                    readOnly={readOnly || !periodOpen}
                    formStateRef={formStateRef}
                    onSaved={handleSaved}
                    onEvidenceUploaded={refreshEvidence}
                    onReviewEvidence={handleReviewEvidence}
                    onViewItem={setSelectedDetailItem}
                    selectedSourceToEdit={selectedSourceToEdit}
                    onItemStaged={handleItemStaged}
                  />
                )}
                {activeLevelKey === 'level2' && (
                  <Level2WaterForm
                    projectId={selectedProjectId!}
                    periodId={selectedPeriodId!}
                    evidence={evidence}
                    readOnly={readOnly || !periodOpen}
                    formStateRef={formStateRef}
                    onSaved={handleSaved}
                    onEvidenceUploaded={refreshEvidence}
                    onReviewEvidence={handleReviewEvidence}
                    onViewItem={setSelectedDetailItem}
                    selectedSourceToEdit={selectedSourceToEdit}
                    onItemStaged={handleItemStaged}
                  />
                )}
                {activeLevelKey === 'level3' && (
                  <Level3GhgForm
                    projectId={selectedProjectId!}
                    periodId={selectedPeriodId!}
                    evidence={evidence}
                    readOnly={readOnly || !periodOpen}
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
                    readOnly={readOnly || !periodOpen}
                    formStateRef={formStateRef}
                    onSaved={handleSaved}
                    onEvidenceUploaded={refreshEvidence}
                    onReviewEvidence={handleReviewEvidence}
                    onViewItem={setSelectedDetailItem}
                    selectedSourceToEdit={selectedSourceToEdit}
                    onItemStaged={handleItemStaged}
                  />
                )}
                {activeLevelKey === 'level5' && (
                  <Level5SafetyForm
                    projectId={selectedProjectId!}
                    periodId={selectedPeriodId!}
                    evidence={evidence}
                    readOnly={readOnly || !periodOpen}
                    formStateRef={formStateRef}
                    onSaved={handleSaved}
                  />
                )}
                {activeLevelKey === 'level6' && (
                  <Level6TrainingForm
                    projectId={selectedProjectId!}
                    periodId={selectedPeriodId!}
                    evidence={evidence}
                    readOnly={readOnly || !periodOpen}
                    formStateRef={formStateRef}
                    onSaved={handleSaved}
                  />
                )}
                {activeLevelKey === 'level7' && (
                  <Level7ComplianceForm
                    projectId={selectedProjectId!}
                    periodId={selectedPeriodId!}
                    evidence={evidence}
                    readOnly={readOnly || !periodOpen}
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
                    readOnly={readOnly || !periodOpen}
                    formStateRef={formStateRef}
                    onSaved={handleSaved}
                  />
                )}
                {activeLevelKey === 'level9' && (
                  <Level9InitiativesForm
                    projectId={selectedProjectId!}
                    periodId={selectedPeriodId!}
                    evidence={evidence}
                    readOnly={readOnly || !periodOpen}
                    formStateRef={formStateRef}
                    onSaved={handleSaved}
                    onEvidenceUploaded={refreshEvidence}
                    onReviewEvidence={handleReviewEvidence}
                  />
                )}
              </motion.div>
          </div>

          {/* Existing Level Records Table */}
          <div className="mt-6 border-t border-white/60 pt-4">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Existing Records · {activeSub.label} · {selectedPeriod?.label}
              </h4>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                {activeLevelRecords.length} record(s)
              </span>
            </div>

            {activeLevelRecords.length > 0 ? (
              <div className="max-h-64 space-y-1.5 overflow-y-auto scroll-elegant pr-1">
                {activeLevelRecords.map((r: any, rIdx: number) => {
                  const corrections = recordCorrections[r.id] || []
                  const isCorrection = r.status === 'CORRECTION_REQUESTED' || corrections.length > 0
                  return (
                    <div key={r.id || `rec-${rIdx}`} className="space-y-1">
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

        {/* RIGHT COLUMN: FLIPPABLE ENGINE & EVIDENCE REVIEW PANEL (1 COL)
            Rendered only when expanded — collapsing must remove the whole
            panel (and its sequence journey list) from the layout, not just
            shrink it. The floating "Expand Journey" tab below brings it back. */}
        {!panelCollapsed && (
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
          flashItem={flashItem}
        />
        )}
      </div>

      {/* FLOATING CAPTURED-ITEM CARD: flies from the "+ Add (Draft)" button to the
          right-panel Captured Emission Sources list */}
      {flight && (
        <motion.div
          key={flight.id}
          initial={{ x: flight.from.left, y: flight.from.top, opacity: 0, scale: 0.8 }}
          animate={{
            x: flight.to.left + flight.to.width / 2 - 110,
            y: flight.to.top + flight.to.height / 2 - 24,
            opacity: [0, 1, 1, 0.1],
            scale: [0.8, 1, 1, 0.45],
          }}
          transition={{ duration: 0.95, times: [0, 0.12, 0.72, 1], ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-none fixed left-0 top-0 z-[80]"
        >
          <div className="flex w-[220px] items-center gap-2.5 rounded-2xl border border-blue-300/80 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 px-3.5 py-2.5 shadow-2xl shadow-blue-500/40 ring-2 ring-white/60">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white/20">
              <Plus className="h-4 w-4 stroke-[2.5] text-white" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-extrabold text-white">{flight.name}</div>
              <div className="font-mono text-[10px] font-bold text-blue-100">
                {flight.quantity.toLocaleString()} {flight.unit}
                {flight.estTco2e ? ` · ${flight.estTco2e.toFixed(2)} tCO₂e` : ''}
              </div>
            </div>
          </div>
        </motion.div>
      )}

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
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1], delay: 0.06 }}
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
                    /* Collapsed stays collapsed — no auto-reopen of the
                       sequence journey item panel from the stepper. */
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
              disabled={readOnly || submittingAll || !periodOpen}
              onClick={() => setFinalSubmitModalOpen(true)}
              className="btn-liquid-blue flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold text-white shadow-md hover:shadow-blue-500/25 transition active:scale-95 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
              title={periodOpen ? undefined : 'Reporting period is closed'}
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
                  ...(reviewModalState.data || stagedForLevel(reviewModalState.levelKey)),
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

      {/* Verified Submission Success Confirmation (iOS Liquid Glass) */}
      <SubmitAllSuccessModal
        open={!!submitAllSuccess}
        onClose={() => setSubmitAllSuccess(null)}
        projectName={selectedProject?.projectName || 'Site Project'}
        periodLabel={selectedPeriod?.label || 'FY 2026-27'}
        submittedCount={Number(submitAllSuccess?.submittedCount) || 0}
        totalLevels={SUB_MODULES.length}
        items={submitAllSuccess?.items || []}
        contributorName={submitAllSuccess?.contributor?.name}
        contributorEmail={submitAllSuccess?.contributor?.email}
      />
      </div>
    </ApiBaseContext.Provider>
  )
}
/* Backwards-compatible exports for console module-routers */
export { SUB_MODULES, normalizeSubModule } from './core'
export type { LevelKey, LevelConfig, EvidenceItem, SavedRecord } from './core'
