'use client'

/**
 * Item Detail Modal — iOS liquid-glass "Submitted Data Breakdown" view.
 *
 * Renders EVERY field the contributor captured for one source item, in the
 * same vocabulary as the input form. Blank fields show a blank value (—),
 * never a fabricated fallback. Calculation rows appear only when the item
 * actually carries a computed result.
 */
import React from 'react'
import { fieldLabel, fmtValue, itemFieldEntries, FIELD_LABELS } from './field-labels'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Layers, FileText, Calculator, Hash, XCircle } from 'lucide-react'

export interface ItemDetailData {
  id?: string
  levelKey?: string
  levelName?: string
  title?: string
  source?: string
  energySource?: string
  waterSource?: string
  emissionSource?: string
  wasteCategory?: string
  category?: string
  scope?: string
  emissionDataType?: string
  activity?: string
  energyActivity?: string
  waterActivity?: string
  sourceCategory?: string
  quantity?: string | number
  consumptionQuantity?: string | number
  waterQuantity?: string | number
  activityQuantity?: string | number
  quantityGeneratedMt?: string | number
  unit?: string
  meterEquipmentId?: string
  meterSourceId?: string
  equipmentId?: string
  reportingPeriod?: string
  openingMeterReading?: string | number
  closingMeterReading?: string | number
  meterDiff?: string | number
  energyPurchased?: string | number
  energyGenerated?: string | number
  renewableEnergyQuantity?: string | number
  dischargeDestination?: string
  treatmentLevel?: string
  waterReusedRecycled?: string | number
  waterQualityResult?: string
  testDateLab?: string
  supportingEvidence?: string
  remarks?: string
  evidenceId?: string
  evidenceIds?: string[]
  evidenceName?: string
  evidenceFileName?: string
  evidenceFiles?: string[]
  factor?: number | string
  factorUnit?: string
  factorSource?: string
  estTco2e?: number
  estGj?: number
  calculationFormula?: string
  gwpSource?: string
  quantityLeakedKg?: string | number
  refrigerantType?: string
  travelMode?: string
  transportMode?: string
  distanceKm?: string | number
  passengerCount?: string | number
  laboratory?: string
  testMethod?: string
  testResult?: string
  measuredResult?: string
  samplingLocation?: string
  testDate?: string
  complianceStatus?: string
  permitConsentType?: string
  permitNumber?: string
  issuingAuthority?: string
  issueDate?: string
  expiryDate?: string
  permitStatus?: string
  disposalMethod?: string
  wasteHandler?: string
  wasteTypeDescription?: string
  quantityGenerated?: string | number
  quantityReused?: string | number
  quantityRecycled?: string | number
  quantityRecovered?: string | number
  quantityDisposed?: string | number
  authorizationReference?: string
  transferManifestNumber?: string
  status?: string
  [key: string]: unknown
}

export function ItemDetailModal({
  isOpen,
  open,
  onClose,
  item,
  evidenceList = [],
}: {
  isOpen?: boolean
  open?: boolean
  onClose: () => void
  item: ItemDetailData | null
  evidenceList?: Array<{ id: string; fileName: string; sha256?: string; fileSize?: string }>
}) {
  const isShown = isOpen ?? open ?? false
  if (!isShown || !item) return null

  const resolvedSource =
    item.energySource || item.waterSource || item.emissionSource || item.wasteCategory ||
    item.permitConsentType || item.title || item.source || 'Emission Source Item'

  const resolvedScope = item.emissionDataType || item.scope || ''

  const entries = itemFieldEntries(item)

  const calcRows = [
    ['factor', item.factor],
    ['factorUnit', item.factorUnit],
    ['factorSource', item.factorSource],
    ['estTco2e', item.estTco2e],
    ['estGj', item.estGj],
    ['calculationFormula', item.calculationFormula],
  ].filter(([, v]) => v !== undefined && v !== null && v !== '') as Array<[string, unknown]>

  const evidenceFiles: string[] = Array.isArray(item.evidenceFiles) ? item.evidenceFiles : []
  const evidenceName = item.evidenceFileName || item.evidenceName || evidenceList.find((e) => e.id === item.evidenceId)?.fileName || ''

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-md"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          role="dialog"
          aria-modal="true"
          aria-label={`${resolvedSource} details`}
          className="glass-strong relative z-10 w-full max-w-2xl rounded-[26px] border border-white/90 p-5 shadow-2xl max-h-[88vh] overflow-y-auto scroll-elegant"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-white/70 pb-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-600 via-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 shrink-0">
                <Layers className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-black text-slate-900 tracking-tight truncate">{resolvedSource}</h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {item.levelName && (
                    <span className="text-[10px] font-bold text-slate-500">{item.levelName}</span>
                  )}
                  {resolvedScope && (
                    <span className="text-[9px] font-extrabold text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded-md">
                      {resolvedScope}
                    </span>
                  )}
                  {item.status && (
                    <span className="text-[9px] font-extrabold text-slate-600 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded-md">
                      {String(item.status).replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-slate-400 hover:bg-white/70 hover:text-slate-700 transition"
              aria-label="Close details"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Submitted Data Breakdown — every field, blank shows blank */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-600">
                <Layers className="h-3.5 w-3.5 text-blue-600" />
                Submitted Data Breakdown ({entries.length} fields)
              </span>
              <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                As entered by contributor
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {entries.map(([k, v]) => {
                const blank = v === null || v === undefined || v === ''
                return (
                  <div
                    key={k}
                    className={`flex justify-between items-center gap-2 px-3 py-2 rounded-xl border ${
                      blank ? 'bg-slate-50/60 border-slate-200/60' : 'bg-white/95 border-slate-200'
                    }`}
                  >
                    <span className="text-[10.5px] font-semibold text-slate-500 truncate">{fieldLabel(k)}:</span>
                    <span
                      className={`text-[11px] font-bold text-right ${
                        blank ? 'text-slate-300 italic font-medium' : 'text-slate-900 font-mono'
                      }`}
                    >
                      {fmtValue(v)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Calculation proof — only real computed values */}
          {calcRows.length > 0 && (
            <div className="mt-4 rounded-2xl border border-blue-200/80 bg-gradient-to-r from-blue-50/90 via-indigo-50/60 to-blue-50/90 p-3.5">
              <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-blue-800 mb-2">
                <Calculator className="h-3.5 w-3.5 text-blue-600" />
                Emission Engine &amp; Factor Proof
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {calcRows.map(([k, v]) => (
                  <div key={k} className="flex justify-between items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/90 border border-blue-200/70">
                    <span className="text-[10px] font-semibold text-blue-700/80">{fieldLabel(k)}:</span>
                    <span className="text-[11px] font-mono font-bold text-blue-950 text-right">{fmtValue(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Evidence */}
          {(evidenceName || evidenceFiles.length > 0) && (
            <div className="mt-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-3.5">
              <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-emerald-900 mb-2">
                <FileText className="h-3.5 w-3.5 text-emerald-600" />
                Attached Evidence
              </div>
              <div className="space-y-1.5">
                {evidenceName && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/95 border border-emerald-200 text-[11px] font-bold text-slate-800">
                    <FileText className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span className="font-mono truncate max-w-[300px]">{evidenceName}</span>
                  </div>
                )}
                {evidenceFiles.filter((f) => f && f !== evidenceName).map((f, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/95 border border-emerald-200 text-[11px] font-bold text-slate-800">
                    <FileText className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span className="font-mono truncate max-w-[300px]">{f}</span>
                  </div>
                ))}
                {evidenceList
                  .filter((e) => e.id === item.evidenceId && e.sha256)
                  .map((e) => (
                    <div key={e.id} className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-mono text-slate-500">
                      <Hash className="h-3 w-3 shrink-0" />
                      <span className="truncate">{e.sha256}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="btn-liquid-blue flex items-center gap-1.5 rounded-full px-5 py-2 text-[11px] font-bold text-white shadow-md transition active:scale-95"
            >
              <XCircle className="h-3.5 w-3.5" />
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
