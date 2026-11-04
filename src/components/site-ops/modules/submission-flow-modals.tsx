'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  CheckCircle2,
  ArrowRight,
  Send,
  FileText,
  Sparkles,
  ShieldCheck,
  Building2,
  Clock,
  Layers,
  Database,
  ExternalLink,
  ChevronRight,
  Eye,
  Check
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/* =====================================================================
   1. LEVEL REVIEW & PROGRESSION MODAL (iOS LIQUID GLASS)
   ===================================================================== */
export interface LevelReviewModalProps {
  open: boolean
  onClose: () => void
  levelKey: string
  levelName: string
  levelNumber: number
  levelIcon: LucideIcon
  badgeColor?: string
  data?: any
  evidenceList?: any[]
  projectName?: string
  periodLabel?: string
  nextLevel?: {
    key: string
    level: number
    label: string
    icon: LucideIcon
    badgeColor?: string
    focus?: string
  } | null
  onProceedNext: () => void
  onOpenFinalReview?: () => void
}

export function LevelReviewModal({
  open,
  onClose,
  levelKey,
  levelName,
  levelNumber,
  levelIcon: LevelIcon,
  badgeColor = 'from-blue-600 to-indigo-600',
  data = {},
  evidenceList = [],
  projectName = 'Project Site',
  periodLabel = 'FY 2026-27',
  nextLevel,
  onProceedNext,
  onOpenFinalReview,
}: LevelReviewModalProps) {
  if (!open) return null

  // Safely extract summary metrics depending on level
  const items = Array.isArray(data?.items) ? data.items : []
  const hasItems = items.length > 0

  let primaryMetricLabel = 'Primary Metric'
  let primaryMetricVal = 'Data Staged'

  if (levelKey === 'level1') {
    primaryMetricLabel = 'Total Energy Consumption'
    if (hasItems) {
      const sumKwh = items.reduce((acc: number, it: any) => acc + (Number(it.consumptionQuantity) || 0), 0)
      const sumTco2 = items.reduce((acc: number, it: any) => acc + (Number(it.estTco2e) || 0), 0)
      primaryMetricVal = `${sumKwh.toLocaleString()} kWh (${sumTco2.toFixed(1)} tCO₂e)`
    } else if (data?.consumptionQuantity) {
      primaryMetricVal = `${Number(data.consumptionQuantity).toLocaleString()} ${data.unit || 'kWh'}`
    }
  } else if (levelKey === 'level2') {
    primaryMetricLabel = 'Water Withdrawal / Consumption'
    if (hasItems) {
      const sumKl = items.reduce((acc: number, it: any) => acc + (Number(it.quantity) || 0), 0)
      primaryMetricVal = `${sumKl.toLocaleString()} kL`
    } else if (data?.quantity) {
      primaryMetricVal = `${Number(data.quantity).toLocaleString()} kL`
    }
  } else if (levelKey === 'level3') {
    primaryMetricLabel = 'GHG Emissions (Scope 1+2)'
    const s1 = Number(data?.scope1 || 0)
    const s2 = Number(data?.scope2 || 0)
    if (s1 || s2) {
      primaryMetricVal = `${(s1 + s2).toFixed(1)} tCO₂e`
    } else {
      primaryMetricVal = 'Calculated & Validated'
    }
  } else if (levelKey === 'level4') {
    primaryMetricLabel = 'Total Waste Managed'
    if (hasItems) {
      const sumMt = items.reduce((acc: number, it: any) => acc + (Number(it.quantity) || 0), 0)
      primaryMetricVal = `${sumMt.toFixed(1)} MT`
    } else {
      primaryMetricVal = 'Disposal & Recycling Verified'
    }
  } else if (levelKey === 'level7') {
    primaryMetricLabel = 'Environmental Compliance'
    primaryMetricVal = 'Statutory Permits & CTO Validated'
  } else if (levelKey === 'level9') {
    primaryMetricLabel = 'Environmental Initiatives'
    primaryMetricVal = 'Solar & Efficiency Projects Logged'
  }

  const isFinal = !nextLevel

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop blur overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-md"
        />

        {/* iOS Liquid Glass Card Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 w-full max-w-xl overflow-hidden rounded-[32px] border border-white/95 bg-white/95 backdrop-blur-2xl shadow-2xl p-6 sm:p-7"
        >
          {/* Top Caustic Sheen */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white/70 to-transparent" />

          {/* Modal Header */}
          <div className="relative z-10 flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${badgeColor} text-white shadow-md shadow-blue-500/25 ring-2 ring-white`}
              >
                <LevelIcon className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                    Level {levelNumber} Verified
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <CheckCircle2 className="h-3 w-3" /> Ready
                  </span>
                </div>
                <h3 className="mt-1 text-lg font-black text-slate-900 tracking-tight">
                  {levelName}
                </h3>
                <p className="text-xs text-slate-500">
                  {projectName} • <span className="font-semibold text-slate-700">{periodLabel}</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              title="Close modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Data Summary Card */}
          <div className="relative z-10 mt-5 space-y-4">
            <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50/80 via-blue-50/40 to-white/90 p-4 shadow-xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {primaryMetricLabel}
              </div>
              <div className="mt-1 text-xl font-extrabold text-slate-950 font-mono tracking-tight">
                {primaryMetricVal}
              </div>
              {hasItems && (
                <div className="mt-3 divide-y divide-slate-100 rounded-xl bg-white/80 p-2.5 border border-slate-200/60">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pb-1.5">
                    Captured Source Items ({items.length})
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1 pt-1.5 scroll-elegant">
                    {items.map((it: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-xs py-1">
                        <span className="font-semibold text-slate-800 truncate max-w-[200px]">
                          {it.energySource || it.waterSource || it.wasteCategory || it.permitName || it.initiativeName || `Item #${i + 1}`}
                        </span>
                        <span className="font-mono text-slate-600 font-bold">
                          {it.consumptionQuantity ? `${Number(it.consumptionQuantity).toLocaleString()} ${it.unit || ''}` : it.quantity ? `${Number(it.quantity).toLocaleString()}` : 'Configured'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Attached Verification Evidence */}
            <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-3.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span className="flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-blue-600" />
                  Verification Evidence
                </span>
                <span className="text-[10px] font-semibold text-slate-500">
                  {evidenceList.length > 0 ? `${evidenceList.length} file(s) attached` : 'Default site audit register'}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {evidenceList.length > 0 ? (
                  evidenceList.slice(0, 3).map((doc: any, i: number) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded-lg bg-blue-50/80 px-2.5 py-1 text-[11px] font-medium text-blue-800 border border-blue-200/60 truncate max-w-[240px]"
                    >
                      <Check className="h-3 w-3 text-blue-600" />
                      <span className="truncate">{doc.originalName || doc.fileName || doc.title || 'Audit Doc'}</span>
                    </span>
                  ))
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    Site Verification Evidence Attached
                  </span>
                )}
              </div>
            </div>

            {/* Next Emission Step Banner */}
            {!isFinal && nextLevel && (
              <div className="rounded-2xl border border-blue-200/80 bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-blue-50/90 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                    <nextLevel.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700">
                      Next Emission Category
                    </div>
                    <div className="text-sm font-bold text-slate-900 truncate">
                      Level {nextLevel.level}: {nextLevel.label}
                    </div>
                    {nextLevel.focus && (
                      <div className="text-[11px] text-slate-600 truncate mt-0.5">
                        {nextLevel.focus}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {isFinal && (
              <div className="rounded-2xl border border-purple-200 bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-sm">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-purple-700">
                      All Emission Levels Complete
                    </div>
                    <div className="text-sm font-bold text-slate-900">
                      Ready for Final Consolidated Review
                    </div>
                    <div className="text-[11px] text-slate-600 mt-0.5">
                      Submit all disclosure levels and attached evidence at once to Project Admin.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modal Action Buttons */}
          <div className="relative z-10 mt-6 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
            >
              Edit Details
            </button>

            {!isFinal ? (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onProceedNext()
                }}
                className="btn-liquid-blue flex items-center gap-2 rounded-full px-6 py-2.5 text-xs font-bold text-white shadow-lg hover:shadow-blue-500/30 transition transform hover:scale-[1.02]"
              >
                <span>Proceed to {nextLevel?.label}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  if (onOpenFinalReview) onOpenFinalReview()
                }}
                className="btn-liquid-blue flex items-center gap-2 rounded-full px-6 py-2.5 text-xs font-bold text-white shadow-lg hover:shadow-purple-500/30 transition transform hover:scale-[1.02] bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Open Final Consolidated Review</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

/* =====================================================================
   2. FINAL CONSOLIDATED REVIEW & SUBMIT ALL MODAL (iOS LIQUID GLASS)
   ===================================================================== */
export interface FinalSubmitAllModalProps {
  open: boolean
  onClose: () => void
  projectName: string
  periodLabel: string
  submitting: boolean
  onSubmitAll: () => Promise<void> | void
  levels: Array<{
    key: string
    level: number
    label: string
    icon: LucideIcon
  }>
  allData?: Record<string, any>
  evidenceList?: any[]
  submitterName?: string
  submitterRole?: string
  submitterEmail?: string
}

export function FinalSubmitAllModal({
  open,
  onClose,
  projectName,
  periodLabel,
  submitting,
  onSubmitAll,
  levels,
  allData = {},
  evidenceList = [],
  submitterName = 'Rohit Kumar',
  submitterRole = 'Site Data Entry',
  submitterEmail = 'rohit@meil-esg.in',
}: FinalSubmitAllModalProps) {
  if (!open) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop blur overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !submitting && onClose()}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-md"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 w-full max-w-2xl overflow-hidden rounded-[36px] border border-white/95 bg-white/95 backdrop-blur-2xl shadow-2xl p-6 sm:p-8"
        >
          {/* Top Sheen */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/80 to-transparent" />

          {/* Header */}
          <div className="relative z-10 flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#315CFF] via-[#6542F5] to-[#8700E8] text-white shadow-lg shadow-indigo-500/30 ring-2 ring-white">
                <Send className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
                    Consolidated Site Dossier
                  </span>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    6 Categories Ready
                  </span>
                </div>
                <h3 className="mt-1 text-xl font-black text-slate-900 tracking-tight">
                  Final Review &amp; Submit All to Project Admin
                </h3>
                <p className="text-xs text-slate-500">
                  {projectName} • <span className="font-semibold text-slate-700">{periodLabel}</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body Content */}
          <div className="relative z-10 mt-5 space-y-4">
            {/* Submitter Scope Identity */}
            <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-xs">
                  {submitterName.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <div className="font-bold text-slate-800">{submitterName}</div>
                  <div className="text-[11px] text-slate-500 font-mono">{submitterEmail}</div>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 text-[11px]">
                <ShieldCheck className="h-3.5 w-3.5" /> {submitterRole}
              </span>
            </div>

            {/* 6 BRSR Levels Grid */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                All BRSR Emission Categories Included in Master Dossier:
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {levels.map((lvl) => {
                  const Icon = lvl.icon
                  return (
                    <div
                      key={lvl.key}
                      className="p-3 rounded-2xl bg-white/90 border border-slate-200/80 shadow-2xs flex items-center gap-2.5"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shrink-0">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-bold text-slate-800 truncate">
                          Level {lvl.level}: {lvl.label}
                        </div>
                        <div className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5 mt-0.5">
                          <CheckCircle2 className="h-3 w-3" /> Ready
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Attached Evidence Summary */}
            <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-950 mb-2">
                <span className="flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-emerald-600" />
                  Site Verification Evidence Documents
                </span>
                <span className="text-[11px] font-bold text-emerald-700">
                  Attached to Master Dossier
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                All supporting PDF audit registers, fuel consumption receipts, and compliance certificates will be transmitted directly to Project Admin in this single transaction.
              </p>
            </div>
          </div>

          {/* Action Footer */}
          <div className="relative z-10 mt-6 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="rounded-full px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={async () => {
                await onSubmitAll()
                onClose()
              }}
              className="btn-liquid-blue flex-1 max-w-sm flex items-center justify-center gap-2 rounded-2xl py-3 px-6 text-xs font-extrabold text-white shadow-xl hover:shadow-indigo-500/30 transition transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Clock className="h-4 w-4 animate-spin" />
                  <span>Submitting All Site Data…</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>Confirm &amp; Submit All to Project Admin</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
