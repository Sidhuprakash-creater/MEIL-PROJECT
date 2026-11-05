'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, FlaskConical, Compass, ChevronRight, FileCheck2, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { EvidenceUploadSection, EvidenceReviewBackface, FullscreenEvidenceModal, EvidencePicker } from './evidence'
import { LiquidGlassEmissionJourneyWidget } from '../liquid-glass-journey'
import { CalculationPreview, ValidationResults } from './primitives'
import { SUB_MODULES, type LevelConfig, type Project, type EvidenceItem, type SavedRecord } from './core'

/* ============================================================
   RIGHT PANEL: FLIPPABLE ENGINE & EVIDENCE REVIEW PANEL (180° FLIP)
   ============================================================ */

export interface FlippablePanelProps {
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
  levels?: LevelConfig[]
  allFormData?: Record<string, Record<string, any>>
  stagedLevels?: Record<string, any>
  existingRecords?: any[]
  onSelectLevel?: (levelKey: string) => void
  onOpenFinalReview?: () => void
  onViewItem?: (item: any) => void
  panelCollapsed?: boolean
  onToggleCollapse?: () => void
  onSelectSourceItem?: (levelKey: string, sourceName: string) => void
}

export function FlippableEngineEvidencePanel({
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
  levels = SUB_MODULES,
  allFormData = {},
  stagedLevels = {},
  existingRecords = [],
  onSelectLevel = () => {},
  onOpenFinalReview,
  onViewItem,
  panelCollapsed = false,
  onToggleCollapse,
  onSelectSourceItem,
}: FlippablePanelProps) {
  const [fullscreenOpen, setFullscreenOpen] = useState(false)
  const [panelTab, setPanelTab] = useState<'journey' | 'calculations' | 'vault'>('journey')

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
            className={`glass  min-h-[720px] rounded-[22px] p-5 shadow-sm border border-white/60 transition-opacity duration-300 flex flex-col justify-between ${
              isFlipped ? 'pointer-events-none invisible opacity-0' : 'relative opacity-100'
            }`}
          >
            <div>
              {/* Header */}
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-start gap-2.5">
                  <div className="kpi-tile bg-violet-50 text-violet-600 shadow-sm">
                    <FlaskConical className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Engine &amp; Emission Journey</h3>
                    <p className="text-[11px] text-slate-500">
                      Deterministic checks &amp; sequenced emission sources
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {reviewEvidence && (
                    <button
                      type="button"
                      onClick={() => setIsFlipped(true)}
                      className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold text-blue-800 bg-blue-50/95 hover:bg-blue-100 hover:text-blue-950 border border-blue-200/90 shadow-2xs transition active:scale-95 cursor-pointer"
                      title="View document review flip side"
                    >
                      <Eye className="h-3.5 w-3.5 text-blue-600" />
                      <span>Review Card</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onToggleCollapse?.()}
                    className="flex items-center justify-center w-10 h-7 rounded-full bg-sky-100/95 hover:bg-sky-200 text-sky-800 border border-sky-300 shadow-xs transition-all active:scale-95 cursor-pointer"
                    title="Collapse calculation & journey panel"
                  >
                    <ChevronRight className="h-4 w-4 stroke-[2.5]" />
                  </button>
                </div>
              </div>

              {/* iOS Liquid Glass Segmented View Bar (WidgetKit design) */}
              <div className="mb-3 flex items-center gap-1 rounded-2xl border border-sky-100/80 bg-slate-100/70 p-1 backdrop-blur-md shadow-2xs">
                <button
                  type="button"
                  onClick={() => setPanelTab('journey')}
                  className={`flex flex-1 items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] font-semibold transition-all ${
                    panelTab === 'journey'
                      ? 'bg-white text-sky-900 shadow-xs ring-1 ring-sky-200/60'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Compass className="h-3.5 w-3.5 text-sky-600" />
                  <span>Sequence Journey</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPanelTab('calculations')}
                  className={`flex flex-1 items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] font-semibold transition-all ${
                    panelTab === 'calculations'
                      ? 'bg-white text-sky-900 shadow-xs ring-1 ring-sky-200/60'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FlaskConical className="h-3.5 w-3.5 text-violet-600" />
                  <span>Calculations</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPanelTab('vault')}
                  className={`flex flex-1 items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] font-semibold transition-all ${
                    panelTab === 'vault'
                      ? 'bg-white text-sky-900 shadow-xs ring-1 ring-sky-200/60'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileCheck2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Vault ({evidence.length})</span>
                </button>
              </div>

              {/* TAB 1: EMISSION SEQUENCE JOURNEY (WidgetKit Liquid Glass Cards) */}
              {panelTab === 'journey' && (
                <LiquidGlassEmissionJourneyWidget
                  levels={levels}
                  activeLevelKey={activeSub.key}
                  allFormData={allFormData}
                  projectId={projectId}
                  periodId={periodId}
                  stagedLevels={stagedLevels}
                  existingRecords={existingRecords}
                  evidenceList={evidence}
                  onSelectLevel={onSelectLevel}
                  onReviewEvidence={(fileName) => {
                    const matched = evidence.find((e) => e.fileName === fileName)
                    if (matched) handleStartReview(matched)
                  }}
                  onOpenFinalReview={onOpenFinalReview}
                  onViewItem={onViewItem}
                  onToggleCollapse={onToggleCollapse}
                  isCollapsed={panelCollapsed}
                  onSelectSourceItem={onSelectSourceItem}
                />
              )}

              {/* TAB 2: LIVE ENGINE CALCULATIONS & VALIDATION FEEDBACK */}
              {panelTab === 'calculations' && (
                <>
                  <CalculationPreview saved={saved} activeSub={activeSub} />
                  <ValidationResults saved={saved} validationRun={validationRun} />
                </>
              )}

              {/* TAB 3: EVIDENCE UPLOAD & VAULT */}
              {panelTab === 'vault' && (
                <>
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
                  <EvidencePicker
                    evidence={evidence}
                    step={step}
                    saved={saved}
                    onPick={onAttachEvidence}
                  />
                </>
              )}
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
              // Inline (not classes): .'s `position: relative` in
              // globals.css would otherwise override Tailwind's `absolute`,
              // pushing the flipped face below the front face in document flow.
              position: 'absolute',
              inset: 0,
              overflowY: 'auto',
            }}
            className={`z-10 glass  min-h-[720px] rounded-[22px] p-5 shadow-xl border border-blue-200/70 bg-gradient-to-b from-white/95 to-blue-50/70 transition-opacity duration-300 scroll-elegant flex flex-col ${
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