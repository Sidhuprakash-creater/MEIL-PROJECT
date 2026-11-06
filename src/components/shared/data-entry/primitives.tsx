'use client'

import { motion } from 'framer-motion'
import { FileText, CheckCircle2, AlertTriangle, AlertOctagon, Clock, Link2, Send, Save, Compass, Calculator, Sparkles, Layers, ArrowRight, type LucideIcon } from 'lucide-react'
import { STEPS, type LevelConfig, type EvidenceItem, type SavedRecord } from './core'
import { describeLevelRecord } from './states'

/* ============================================================
   STEPPER WIDGET
   ============================================================ */

export function Stepper({
  step,
  onStepClick,
}: {
  step: 1 | 2 | 3 | 4 | 5
  onStepClick?: (step: 1 | 2 | 3 | 4 | 5) => void
}) {
  const icons: Record<number, LucideIcon> = {
    1: FileText,
    2: Link2,
    3: Compass,
    4: Layers,
    5: Send,
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05 }}
      className="glass rounded-2xl p-4 shadow-sm"
    >
      <div className="relative flex items-center justify-between">
        <div className="absolute left-0 right-0 top-5 mx-6 h-0.5 rounded-full bg-slate-200/80" />
        <motion.div
          className="absolute left-0 top-5 h-0.5 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500"
          initial={{ width: '0%' }}
          animate={{ width: `${((step - 1) / 4) * 100}%` }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          style={{ margin: '0 1.5rem' }}
        />
        {STEPS.map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3 | 4 | 5
          const active = step === n
          const done = step > n
          const Icon = icons[n]
          return (
            <button type="button" key={label} onClick={() => onStepClick?.(n)} className="relative z-10 flex flex-1 flex-col items-center gap-1 group cursor-pointer focus:outline-none">
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
            </button>
          )
        })}
      </div>
    </motion.div>
  )
}

/* ============================================================
   RIGHT PANEL: CALCULATION PREVIEW
   Shows the engine output for the current draft when present and always
   falls back to the level's saved records, so verified calculations and
   factor lineage display instantly — no "save first" dead end.
   ============================================================ */

export function CalculationPreview({
  saved,
  activeSub,
  levelRecords = [],
}: {
  saved: SavedRecord | null
  activeSub: LevelConfig
  /** All saved records of the ACTIVE level — rendered as the calculation ledger. */
  levelRecords?: SavedRecord[]
}) {
  if (!saved || !saved.calculation) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white/40 p-4 text-center text-xs text-slate-500">
        {levelRecords.length > 0
          ? 'No live engine run for the current draft yet — the saved records below carry the verified calculations.'
          : <>Enter data and click <strong>Save Draft</strong> to preview the verified calculations and factor lineage for {activeSub.brsrTitle}.</>}
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
            value={`${Number(c.normalizedValue).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${c.normalizedUnit || ''}`}
          />
        )}
      </div>

      {c.methodologyNote && (
        <div className="mt-2 rounded-lg bg-white/80 p-2 text-[10px] text-slate-700 ring-1 ring-emerald-200">
          <span className="font-bold text-emerald-900">Methodology:</span>{' '}
          {c.methodologyNote}
        </div>
      )}

      {/* Calculation ledger — every saved record of this level with its engine result */}
      {levelRecords.length > 0 && (
        <div className="mt-2.5 rounded-lg border border-emerald-100 bg-white/85 overflow-hidden">
          <div className="flex items-center justify-between border-b border-emerald-100 bg-emerald-50/60 px-2 py-1 text-[9px] font-extrabold uppercase tracking-wider text-emerald-900">
            <span>Record Calculation Ledger</span>
            <span>{levelRecords.length} record(s)</span>
          </div>
          <div className="max-h-40 overflow-y-auto scroll-elegant divide-y divide-slate-100">
            {levelRecords.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 px-2 py-1.5">
                <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-slate-700" title={describeLevelRecord(r)}>
                  {describeLevelRecord(r)}
                </span>
                <span className="shrink-0 font-mono text-[10px] font-bold text-emerald-900 tabular-nums">
                  {r.calculation
                    ? `${Number(r.calculation.calculatedValue).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${r.calculation.resultUnit || ''}`
                    : '—'}
                </span>
                <span
                  className={`shrink-0 rounded px-1 py-0.5 text-[8.5px] font-extrabold uppercase ${
                    r.validationStatus === 'PASSED'
                      ? 'bg-emerald-100 text-emerald-700'
                      : r.validationStatus === 'FAILED'
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {r.validationStatus || 'PENDING'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}

export function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
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

export function ValidationResults({
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
   FORM BUILDING BLOCKS
   ============================================================ */

export interface LevelFormProps {
  projectId: string
  periodId: string
  evidence: EvidenceItem[]
  readOnly: boolean
  formStateRef: React.MutableRefObject<Record<string, Record<string, any>>>
  onSaved: (r: SavedRecord, submitted?: boolean) => void
  onEvidenceUploaded?: () => Promise<void>
  onReviewEvidence?: (ev: EvidenceItem) => void
  onViewItem?: (item: any) => void
  selectedSourceToEdit?: { levelKey: string; sourceName: string } | null
  /** Fired right after an item is added/updated via "+ Add (Draft)" — powers the
   *  float-to-right-panel flight animation. sourceEl is the Add button element. */
  onItemStaged?: (
    payload: { levelKey: string; id: string; name: string; quantity: number; unit: string; estTco2e?: number },
    sourceEl: HTMLElement | null
  ) => void
}

export const inputClass = 'ios-field'

export function FormGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
}

export function FormField({
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

export function FormSaveActions({
  error,
  submitting,
  readOnly,
  onSave,
  onSubmitForReview,
  nextLabel,
  isFinalLevel,
  showSaveDraft = false,
}: {
  error: string
  submitting: boolean
  readOnly: boolean
  onSave?: () => void
  onSubmitForReview?: () => void
  nextLabel?: string
  isFinalLevel?: boolean
  showSaveDraft?: boolean
}) {
  return (
    <div className="sm:col-span-2 pt-3">
      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-2xl border border-rose-200/80 bg-rose-50/80 p-3 text-xs font-semibold text-rose-800 shadow-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" /> {error}
        </div>
      )}
      <div className="glass-subtle flex flex-wrap items-center justify-end gap-3 rounded-2xl px-3.5 py-2.5">
        {showSaveDraft && onSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={readOnly || submitting}
            className="ios-btn-ghost flex items-center gap-1.5 mr-auto"
            title="Save current progress as draft"
          >
            {submitting ? (
              <Clock className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            <span>Save Draft</span>
          </button>
        )}
        {onSubmitForReview && (
          <button
            type="button"
            onClick={onSubmitForReview}
            disabled={readOnly || submitting}
            className="btn-liquid-blue flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold text-white shadow-md hover:shadow-blue-500/30 transition transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          >
            {submitting ? (
              <Clock className="h-3.5 w-3.5 animate-spin" />
            ) : isFinalLevel ? (
              <Sparkles className="h-3.5 w-3.5" />
            ) : (
              <ArrowRight className="h-3.5 w-3.5" />
            )}
            <span>{nextLabel || (isFinalLevel ? 'Final Review & Submit All →' : 'Review & Organize →')}</span>
          </button>
        )}
      </div>
    </div>
  )
}