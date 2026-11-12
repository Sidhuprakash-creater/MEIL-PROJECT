'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Droplet, CheckCircle2, AlertTriangle, Save, Building2, Layers, Check, Eye, Plus, Trash2, Edit3, ArrowLeft, Waves, CloudRain, RefreshCw, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { EmissionFactorInfoIcon } from '../../emission-factor-info'
import { FormEvidenceAttachSection } from '../evidence-attach'
import { availableEvidenceIds, ownerOfEvidence } from '../evidence-usage'
import { inputClass, FormGrid, FormField, FormSaveActions, useDraftBucket, type LevelFormProps } from '../primitives'
import { type Project, useApiBase } from '../core'

/* ============================================================
   LEVEL 2: WATER MANAGEMENT FORM
   ============================================================ */

export const L2_ACTIVITIES = ['Withdrawal', 'Consumption', 'Reuse', 'Discharge']

export const L2_SOURCES = [
  'Groundwater',
  'Surface water',
  'Third-party supply',
  'Rainwater',
  'Recycled / Reused water',
  'Municipal supply',
  'Other',
]

export const L2_TREATMENTS = ['Primary', 'Secondary', 'Tertiary', 'STP / ETP Advanced', 'RO / ZLD', 'Untreated']

export const L2_DESTINATIONS = ['Surface water', 'Third party', 'Groundwater recharge', 'Landscaping', 'Zero Liquid Discharge (ZLD)']

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
  evidenceIds?: string[]
  evidenceFiles?: string[]
  evidenceFileName?: string
  circularityPct: number
}

export const WATER_SOURCE_PRESETS: Record<
  string,
  {
    activity: string
    unit: string
    destination: string
    treatment: string
    evidenceDoc: string
    icon: LucideIcon
  }
> = {
  'Groundwater': {
    activity: 'Withdrawal',
    unit: 'kL',
    destination: 'Zero Liquid Discharge (ZLD)',
    treatment: 'RO / ZLD',
    evidenceDoc: 'CGWA Extraction Logbook & Meter Photo',
    icon: Droplet,
  },
  'Surface water': {
    activity: 'Withdrawal',
    unit: 'kL',
    destination: 'Landscaping',
    treatment: 'Primary',
    evidenceDoc: 'Irrigation Dept. Raw Water Invoice',
    icon: Waves,
  },
  'Third-party supply': {
    activity: 'Withdrawal',
    unit: 'kL',
    destination: 'Surface water',
    treatment: 'Untreated',
    evidenceDoc: 'Water Tanker Invoices & Delivery Slips',
    icon: Building2,
  },
  'Rainwater': {
    activity: 'Reuse',
    unit: 'kL',
    destination: 'Groundwater recharge',
    treatment: 'Tertiary',
    evidenceDoc: 'RWH Recharge Pit Daily Log',
    icon: CloudRain,
  },
  'Recycled / Reused water': {
    activity: 'Reuse',
    unit: 'kL',
    destination: 'Zero Liquid Discharge (ZLD)',
    treatment: 'STP / ETP Advanced',
    evidenceDoc: 'STP Daily Treatment & Flow Log',
    icon: RefreshCw,
  },
  'Municipal supply': {
    activity: 'Withdrawal',
    unit: 'kL',
    destination: 'Third party',
    treatment: 'Primary',
    evidenceDoc: 'Municipal Water Board Utility Bill',
    icon: Building2,
  },
  'Other': {
    activity: 'Withdrawal',
    unit: 'kL',
    destination: 'Landscaping',
    treatment: 'Primary',
    evidenceDoc: 'Auxiliary Water Register',
    icon: Droplet,
  },
}

export function Level2WaterForm({
  projectId,
  periodId,
  evidence,
  readOnly,
  formStateRef,
  onSaved,
  onEvidenceUploaded,
  onReviewEvidence,
  onViewItem,
  selectedSourceToEdit,
  onItemStaged,
}: LevelFormProps) {
  const apiBase = useApiBase()
  const addBtnRef = useRef<HTMLButtonElement>(null)

  const key = `l2-${projectId}-${periodId}`
  const initial = useDraftBucket(formStateRef, key)

  // Multi-item staged state — blank unless a saved draft exists
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
          meterSourceId: initial.meterSourceId || '',
          openingReading: initial.openingReading || '',
          closingReading: initial.closingReading || '',
          waterReusedRecycled: initial.waterReusedRecycled || '',
          dischargeDestination: initial.dischargeDestination || 'Zero Liquid Discharge (ZLD)',
          treatmentLevel: initial.treatmentLevel || 'RO / ZLD',
          waterQualityResult: initial.waterQualityResult || '',
          testDateLab: initial.testDateLab || '',
          supportingEvidence: initial.supportingEvidence || '',
          remarks: initial.remarks || '',
          evidenceId: initial.evidenceId || '',
          circularityPct: circ,
        },
      ]
    }
    return []
  })

  // View step: 'ENTRY' (Item Drafting) vs 'ORGANIZED' (Consolidated Summary)
  const [viewStep, setViewStep] = useState<'ENTRY' | 'ORGANIZED'>(
    initial.viewStep === 'ORGANIZED' ? 'ORGANIZED' : 'ENTRY'
  )

  const [editingItemId, setEditingItemId] = useState<string | null>(null)

  // Active form inputs for selected Water Source item — blank until the user types
  const [waterSource, setWaterSource] = useState('Groundwater')
  const [waterActivity, setWaterActivity] = useState('Withdrawal')
  const [waterQuantity, setWaterQuantity] = useState('')
  const [unit, setUnit] = useState('kL')
  const [meterSourceId, setMeterSourceId] = useState('')
  const [openingReading, setOpeningReading] = useState('')
  const [closingReading, setClosingReading] = useState('')
  const [waterReusedRecycled, setWaterReusedRecycled] = useState('')
  const [dischargeDestination, setDischargeDestination] = useState('Zero Liquid Discharge (ZLD)')
  const [treatmentLevel, setTreatmentLevel] = useState('RO / ZLD')
  const [waterQualityResult, setWaterQualityResult] = useState('')
  const [testDateLab, setTestDateLab] = useState('')
  const [supportingEvidence, setSupportingEvidence] = useState('')
  const [remarks, setRemarks] = useState('')
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  /* Evidence already attached to ANOTHER source item of this record.
     MUST live at the top level of the component — the JSX that consumes it
     sits inside a conditional branch, and a hook called inside a
     conditional breaks React's hook order (render error). */
  const evidenceUsedElsewhere = useMemo(() => {
    const map: Record<string, string> = {}
    for (const item of stagedItems) {
      if (editingItemId && item.id === editingItemId) continue
      for (const id of item.evidenceIds?.length ? item.evidenceIds : item.evidenceId ? [item.evidenceId] : []) {
        if (id && !map[id]) map[id] = item.waterSource
      }
    }
    return map
  }, [stagedItems, editingItemId])

  // Automatically open and load source item when clicked/dropped from Emission Sequence Journey
  useEffect(() => {
    if (selectedSourceToEdit?.levelKey === 'level2' && selectedSourceToEdit.sourceName) {
      setViewStep('ENTRY')
      handleSelectSource(selectedSourceToEdit.sourceName)
    }
  }, [selectedSourceToEdit])

  // Handle source chip click
  function handleSelectSource(src: string) {
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
      setSelectedEvidenceIds(existing.evidenceIds?.length ? existing.evidenceIds : existing.evidenceId ? [existing.evidenceId] : [])
    } else {
      setEditingItemId(null)
      const preset = WATER_SOURCE_PRESETS[src] || WATER_SOURCE_PRESETS['Groundwater']
      setWaterActivity(preset.activity)
      setUnit(preset.unit)
      setDischargeDestination(preset.destination)
      setTreatmentLevel(preset.treatment)
      setSupportingEvidence(preset.evidenceDoc)
      setRemarks('')
      setSelectedEvidenceIds([])
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

    /* ONE evidence document may support only ONE source item of this record —
       the same invoice must not be counted as the proof for two sources. */
    const { allowed: usableEvidenceIds, blocked: blockedEvidenceIds } = availableEvidenceIds(
      selectedEvidenceIds,
      stagedItems,
      editingItemId
    )
    if (blockedEvidenceIds.length > 0) {
      const owners = blockedEvidenceIds.map((id) => ownerOfEvidence(stagedItems, id)).filter(Boolean)
      toast.warning('Evidence already used by another source', {
        description: `The same document cannot support two sources in one record${
          owners.length ? ` (already attached to ${[...new Set(owners)].join(', ')})` : ''
        }. It was left on that source only.`,
      })
    }

    const attachedEv = evidence.find((ev) => usableEvidenceIds.includes(ev.id))
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
      evidenceId: usableEvidenceIds[0] || '',
      evidenceIds: usableEvidenceIds,
      evidenceFiles: usableEvidenceIds
        .map((id) => evidence.find((ev) => ev.id === id)?.fileName)
        .filter(Boolean) as string[],
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

    /* The evidence selection belongs to the item that was just staged — clear
       it so the next source does not silently inherit the same document. */
    setSelectedEvidenceIds([])

    // Float the captured item card over to the right-panel journey list
    onItemStaged?.(
      {
        levelKey: 'level2',
        id: itemPayload.id,
        name: waterSource,
        quantity: qNum,
        unit,
      },
      addBtnRef.current
    )
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
    setSelectedEvidenceIds(item.evidenceIds?.length ? item.evidenceIds : item.evidenceId ? [item.evidenceId] : [])
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
      evidenceId: itemsToSave.find((i) => i.evidenceId)?.evidenceId || selectedEvidenceIds[0] || '',
      evidenceIds: Array.from(new Set(itemsToSave.flatMap((i) => (i.evidenceIds?.length ? i.evidenceIds : i.evidenceId ? [i.evidenceId] : [])))),
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
    selectedEvidenceIds,
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
          evidenceId: selectedEvidenceIds[0] || '',
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

      const res = await fetch(`${apiBase}/data-entry`, {
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
      onSaved({ ...d.record, duplicateRecord: d.duplicateRecord ?? null }, submitForReview)
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

        {viewStep === 'ORGANIZED' && (
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
          {/* Active Water Item Live Analytics Banner with 4 distinctive color-themed cards */}
          <div className="sm:col-span-2 rounded-2xl border border-cyan-200/90 bg-gradient-to-r from-cyan-50/90 via-blue-50/60 to-cyan-50/90 p-4 text-xs text-cyan-950 shadow-sm">
            <div className="flex items-center justify-between font-bold mb-3">
              <span className="flex items-center gap-2 text-cyan-900">
                <Droplet className="h-4 w-4 text-cyan-600" /> Active Item Status ·{' '}
                <span className="underline decoration-cyan-300 font-extrabold">{waterSource}</span>
              </span>
              <span className="rounded-full bg-cyan-100/90 px-2.5 py-0.5 text-[10px] text-cyan-800 font-mono font-bold border border-cyan-200">
                Activity: {waterActivity} · {treatmentLevel.split(' ')[0]}
              </span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 text-center">
              {/* Card 1: Gross Quantity (Cyan / Marine) */}
              <div className="rounded-xl bg-gradient-to-br from-cyan-500/10 via-blue-500/10 to-cyan-500/5 p-3 shadow-xs border border-cyan-200/80">
                <div className="text-[10px] uppercase tracking-wider text-cyan-800 font-bold">
                  Gross Quantity
                </div>
                <div className="text-base font-extrabold text-cyan-950 mt-0.5">
                  {curQty.toLocaleString()} {unit}
                </div>
                <div className="text-[9px] text-cyan-700 font-medium mt-0.5">Withdrawal volume</div>
              </div>

              {/* Card 2: Reused / Recycled (Emerald / Green) */}
              <div className="rounded-xl bg-gradient-to-br from-emerald-500/10 via-teal-500/10 to-emerald-500/5 p-3 shadow-xs border border-emerald-200/80">
                <div className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold">
                  Reused / Recycled
                </div>
                <div className="text-base font-extrabold text-emerald-950 mt-0.5">
                  {curReused.toLocaleString()} {unit}
                </div>
                <div className="text-[9px] text-emerald-600 font-medium mt-0.5">Zero discharge</div>
              </div>

              {/* Card 3: Circularity Recovery (Indigo / Purple) */}
              <div className="rounded-xl bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-indigo-500/5 p-3 shadow-xs border border-indigo-200/80">
                <div className="text-[10px] uppercase tracking-wider text-indigo-700 font-bold">
                  Circularity Recovery
                </div>
                <div className="text-base font-extrabold text-indigo-950 mt-0.5">{curCircPct}%</div>
                <div className="text-[9px] text-indigo-600 font-medium mt-0.5">Water efficiency</div>
              </div>

              {/* Card 4: Water Stress Benchmark (Amber / Orange) */}
              <div className="rounded-xl bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-amber-500/5 p-3 shadow-xs border border-amber-200/80 flex flex-col justify-between">
                <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-amber-800 font-bold">
                  <span>Water Factor</span>
                  <EmissionFactorInfoIcon materialName={waterSource} />
                </div>
                <div className="text-base font-extrabold text-amber-950 mt-0.5">
                  CGWB
                </div>
                <div className="text-[9px] text-amber-700 font-mono font-medium mt-0.5">
                  Safe / Semi-Critical
                </div>
              </div>
            </div>
          </div>

          {/* INTERACTIVE SOURCE ITEMS SELECTOR PILLS */}
          <div className="sm:col-span-2 glass-subtle rounded-2xl p-4">
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
              placeholder="Withdrawal quantity for the period"
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
              placeholder="Meter / pump ID"
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
              placeholder="Reused / recycled quantity"
              className={inputClass}
            />
          </FormField>

          <FormField label="Opening Meter Reading" hint="If metered.">
            <input
              type="number"
              value={openingReading}
              disabled={readOnly}
              onChange={(e) => setOpeningReading(e.target.value)}
              placeholder="Meter opening reading"
              className={inputClass}
            />
          </FormField>

          <FormField label="Closing Meter Reading" hint="If metered.">
            <input
              type="number"
              value={closingReading}
              disabled={readOnly}
              onChange={(e) => setClosingReading(e.target.value)}
              placeholder="Meter closing reading"
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
              placeholder="e.g. pH 7.2, TDS 420 mg/L — from lab report"
              className={inputClass}
            />
          </FormField>

          <FormField label="Test Date / Laboratory" hint="NABL accredited testing facility.">
            <input
              value={testDateLab}
              disabled={readOnly}
              onChange={(e) => setTestDateLab(e.target.value)}
              placeholder="YYYY-MM-DD · Laboratory name"
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
              selectedEvidenceIds={selectedEvidenceIds}
              onSelectEvidenceIds={setSelectedEvidenceIds}
              evidenceUsedElsewhere={evidenceUsedElsewhere}
              onReview={onReviewEvidence}
onOcrApply={(f) => {
                if (f.quantity) setWaterQuantity(f.quantity)
                if (f.meterOpening) setOpeningReading(f.meterOpening)
                if (f.meterClosing) setClosingReading(f.meterClosing)
                if (f.meterId) setMeterSourceId(f.meterId)
                const quality = [f.labName, f.testResult].filter(Boolean).join(' — ')
                if (quality) setWaterQualityResult(quality)
                if (f.date) setTestDateLab(f.date)
                const bits = [f.invoiceNo && `Ref ${f.invoiceNo}`, f.notes].filter(Boolean)
                if (bits.length) setRemarks(bits.join(' · '))
                toast.success('AI-extracted fields applied — review before adding the draft')
              }}
              readOnly={readOnly}
            />
          </div>

          {/* Enhanced Add Item (Draft) Action (Clean prominent CTA) */}
          <div className="sm:col-span-2 pt-1">
            <button
              type="button"
              ref={addBtnRef}
              onClick={handleAddOrUpdateItem}
              disabled={readOnly}
              className="w-full flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-cyan-600 via-blue-600 to-cyan-700 py-3.5 px-6 text-sm font-bold text-white shadow-lg shadow-cyan-500/25 ring-1 ring-white/30 backdrop-blur-md transition-all hover:shadow-xl hover:shadow-cyan-500/35 hover:scale-[1.008] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer group"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 transition-transform group-hover:scale-110">
                <Plus className="h-4 w-4 stroke-[2.5]" />
              </div>
              <span className="tracking-wide">
                {editingItemId ? `Update ${waterSource} Draft Item` : `+ Add ${waterSource} (Draft)`}
              </span>
            </button>

            {error && (
              <div className="mt-2.5 rounded-xl border border-rose-200 bg-rose-50/90 p-2.5 text-xs font-medium text-rose-800">
                <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5 text-rose-600" /> {error}
              </div>
            )}
          </div>

          {/* STAGED DRAFT ITEMS TABLE / LIST */}
          {stagedItems.length > 0 && (
            <div className="sm:col-span-2 glass-subtle rounded-2xl p-4">
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
                                onClick={() => onViewItem?.({
                                  ...item,
                                  title: item.waterSource,
                                  levelKey: 'level2',
                                  levelName: 'Level 2 — Water Management',
                                  quantity: item.waterQuantity,
                                  unit: item.unit,
                                  factorSource: 'CGWB & CEA Guidelines',
                                  factorUnit: item.unit,
                                  remarks: item.remarks,
                                  evidenceId: item.evidenceId,
                                  sourceDocument: item.supportingEvidence,
                                  waterActivity: item.waterActivity,
                                  meterSourceId: item.meterSourceId,
                                  openingReading: item.openingReading,
                                  closingReading: item.closingReading,
                                  waterReusedRecycled: item.waterReusedRecycled,
                                  dischargeDestination: item.dischargeDestination,
                                  treatmentLevel: item.treatmentLevel,
                                  waterQualityResult: item.waterQualityResult,
                                  testDateLab: item.testDateLab,
                                  circularityPct: item.circularityPct,
                                })}
                                className="flex items-center gap-1 rounded-lg border border-cyan-200 bg-cyan-50 px-2 py-1 text-[11px] font-bold text-cyan-700 hover:bg-cyan-100 transition shadow-2xs cursor-pointer mr-1"
                                title="View full item details"
                              >
                                <Eye className="h-3 w-3" />
                                <span>View</span>
                              </button>
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

          {/* Review & Organize Transition */}
          <FormSaveActions
            error={error}
            submitting={submitting}
            readOnly={readOnly}
            onSubmitForReview={handleNextOrganize}
            nextLabel="Review & Organize →"
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
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => onViewItem?.({
                                ...item,
                                title: item.waterSource,
                                levelKey: 'level2',
                                levelName: 'Level 2 — Water Management',
                                quantity: item.waterQuantity,
                                unit: item.unit,
                                factorSource: 'CGWB & CEA Guidelines',
                                factorUnit: item.unit,
                                remarks: item.remarks,
                                evidenceId: item.evidenceId,
                                sourceDocument: item.supportingEvidence,
                                waterActivity: item.waterActivity,
                                meterSourceId: item.meterSourceId,
                                openingReading: item.openingReading,
                                closingReading: item.closingReading,
                                waterReusedRecycled: item.waterReusedRecycled,
                                dischargeDestination: item.dischargeDestination,
                                treatmentLevel: item.treatmentLevel,
                                waterQualityResult: item.waterQualityResult,
                                testDateLab: item.testDateLab,
                                circularityPct: item.circularityPct,
                              })}
                              className="flex items-center gap-1 rounded-lg border border-cyan-200 bg-cyan-50 px-2 py-1 text-[11px] font-bold text-cyan-700 hover:bg-cyan-100 transition shadow-2xs cursor-pointer mr-1"
                              title="View full item details"
                            >
                              <Eye className="h-3 w-3" />
                              <span>View</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditStagedItem(item)}
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition"
                            >
                              Edit
                            </button>
                          </div>
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