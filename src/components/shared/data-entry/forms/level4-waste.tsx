'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Zap, Recycle, ShieldCheck, CheckCircle2, AlertTriangle, Save, Building2, Layers, Eye, Plus, Trash2, Edit3, ArrowRight, ArrowLeft, Box, Package, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { EmissionFactorInfoIcon } from '../../emission-factor-info'
import { FormEvidenceAttachSection } from '../evidence-attach'
import { availableEvidenceIds, ownerOfEvidence } from '../evidence-usage'
import { inputClass, FormGrid, FormField, FormSaveActions, useDraftBucket, type LevelFormProps } from '../primitives'
import { useApiBase } from '../core'

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
  evidenceIds?: string[]
  evidenceFiles?: string[]
  evidenceFileName?: string
  circularRecoveryPct: number
}

export const L4_CATEGORIES = [
  'Construction & demolition',
  'Scrap metal & Structural steel',
  'Plastic waste',
  'Hazardous & chemical waste',
  'E-waste & Batteries',
  'Biomedical waste',
  'Municipal solid waste',
  'Other',
]

export const L4_METHODS = [
  'Landfill (TSDF)',
  'Incineration / Co-processing',
  'Authorised recycling facility',
  'Composting',
  'Other',
]

export const WASTE_CATEGORY_PRESETS: Record<
  string,
  {
    desc: string
    unit: string
    method: string
    doc: string
    icon: LucideIcon
  }
> = {
  'Construction & demolition': {
    desc: 'Concrete rubble, brickbats, excavated soil & tile scrap',
    unit: 'metric tonnes',
    method: 'Authorised recycling facility',
    doc: 'Weighbridge Slips & C&D Processing Plant Receipt',
    icon: Building2,
  },
  'Scrap metal & Structural steel': {
    desc: 'TMT rebar cut pieces, structural beams, MS offcuts & turnings',
    unit: 'metric tonnes',
    method: 'Authorised recycling facility',
    doc: 'Scrap Sale Delivery Challan & Invoices',
    icon: Box,
  },
  'Plastic waste': {
    desc: 'Packaging HDPE/LDPE sheets, cement bags, PVC conduit offcuts',
    unit: 'metric tonnes',
    method: 'Incineration / Co-processing',
    doc: 'EPR Plastic Certificate & Cement Kiln Receipt',
    icon: Package,
  },
  'Hazardous & chemical waste': {
    desc: 'Used DG lubricating oil, contaminated cotton rags, empty paint drums',
    unit: 'metric tonnes',
    method: 'Landfill (TSDF)',
    doc: 'Form 10 Hazardous Waste Manifest & Weighbridge Slips',
    icon: AlertTriangle,
  },
  'E-waste & Batteries': {
    desc: 'Used lead-acid batteries, obsolete sensors, UPS circuits & cabling',
    unit: 'metric tonnes',
    method: 'Authorised recycling facility',
    doc: 'E-Waste Passbook & Green Recycling Certificate',
    icon: Zap,
  },
  'Biomedical waste': {
    desc: 'First-aid post medical dressings, used sharps, diagnostic strips',
    unit: 'metric tonnes',
    method: 'Incineration / Co-processing',
    doc: 'Biomedical Waste Barcoded Manifest & Treatment Log',
    icon: ShieldCheck,
  },
  'Municipal solid waste': {
    desc: 'Canteen food organic waste, office paper, dry sweepings',
    unit: 'metric tonnes',
    method: 'Composting',
    doc: 'Compost Logbook & Municipal Waste Receipts',
    icon: Trash2,
  },
  'Other': {
    desc: 'Rubber conveyor trimmings, insulation wool scrap',
    unit: 'metric tonnes',
    method: 'Other',
    doc: 'Vendor Disposal Memo',
    icon: Recycle,
  },
}

export function calculateWasteCircularity(genStr: string, reusedStr: string, recycledStr: string, recoveredStr: string): number {
  const gen = Number(genStr) || 0
  const reused = Number(reusedStr) || 0
  const recycled = Number(recycledStr) || 0
  const recovered = Number(recoveredStr) || 0
  const diverted = reused + recycled + recovered
  return gen > 0 ? Number(Math.min(100, (diverted / gen) * 100).toFixed(1)) : 0
}

export function Level4WasteForm({
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

  const key = `l4-${projectId}-${periodId}`
  const initial = useDraftBucket(formStateRef, key)

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
          wasteTypeDescription: initial.wasteTypeDescription || '',
          quantityGenerated: String(initial.quantityGenerated),
          unit: initial.unit || 'metric tonnes',
          quantityReused: initial.quantityReused || '',
          quantityRecycled: initial.quantityRecycled || '',
          quantityRecovered: initial.quantityRecovered || '',
          quantityDisposed: initial.quantityDisposed || '',
          disposalMethod: initial.disposalMethod || 'Authorised recycling facility',
          wasteHandler: initial.wasteHandler || '',
          authorizationReference: initial.authorizationReference || '',
          transferManifestNumber: initial.transferManifestNumber || '',
          supportingEvidence: initial.supportingEvidence || '',
          remarks: initial.remarks || '',
          evidenceId: initial.evidenceId || '',
          circularRecoveryPct: circ,
        },
      ]
    }
    // Blank until the user stages an item
    return []
  })
  // View step: 'ENTRY' (Item Drafting) vs 'ORGANIZED' (Consolidated Summary)
  const [viewStep, setViewStep] = useState<'ENTRY' | 'ORGANIZED'>(
    initial.viewStep === 'ORGANIZED' ? 'ORGANIZED' : 'ENTRY'
  )

  const [editingItemId, setEditingItemId] = useState<string | null>(null)

  // Active form inputs for selected Waste Category item
  const [wasteCategory, setWasteCategory] = useState('Construction & demolition')
  const [wasteTypeDescription, setWasteTypeDescription] = useState('')
  const [quantityGenerated, setQuantityGenerated] = useState('')
  const [unit, setUnit] = useState('metric tonnes')
  const [quantityReused, setQuantityReused] = useState('')
  const [quantityRecycled, setQuantityRecycled] = useState('')
  const [quantityRecovered, setQuantityRecovered] = useState('')
  const [quantityDisposed, setQuantityDisposed] = useState('')
  const [disposalMethod, setDisposalMethod] = useState('Authorised recycling facility')
  const [wasteHandler, setWasteHandler] = useState('')
  const [authorizationReference, setAuthorizationReference] = useState('')
  const [transferManifestNumber, setTransferManifestNumber] = useState('')
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
        if (id && !map[id]) map[id] = item.wasteCategory
      }
    }
    return map
  }, [stagedItems, editingItemId])

  // Automatically open and load source item when clicked/dropped from Emission Sequence Journey
  useEffect(() => {
    if (selectedSourceToEdit?.levelKey === 'level4' && selectedSourceToEdit.sourceName) {
      setViewStep('ENTRY')
      handleSelectCategory(selectedSourceToEdit.sourceName)
    }
  }, [selectedSourceToEdit])

  // Handle category chip click
  function handleSelectCategory(cat: string) {
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
      setSelectedEvidenceIds(existing.evidenceIds?.length ? existing.evidenceIds : existing.evidenceId ? [existing.evidenceId] : [])
    } else {
      setEditingItemId(null)
      const preset = WASTE_CATEGORY_PRESETS[cat] || WASTE_CATEGORY_PRESETS['Construction & demolition']
      // Type defaults only — quantities, handlers, references and remarks
      // are never fabricated; the user enters actual measured values.
      setWasteTypeDescription('')
      setQuantityGenerated('')
      setUnit(preset.unit)
      setQuantityReused('')
      setQuantityRecycled('')
      setQuantityRecovered('')
      setQuantityDisposed('')
      setDisposalMethod(preset.method)
      setWasteHandler('')
      setAuthorizationReference('')
      setTransferManifestNumber('')
      setSupportingEvidence('')
      setRemarks('')
      setSelectedEvidenceIds([])
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
    /* ONE evidence document may support only ONE source item of this record. */
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
      evidenceId: usableEvidenceIds[0] || '',
      evidenceIds: usableEvidenceIds,
      evidenceFiles: usableEvidenceIds
        .map((id) => evidence.find((ev) => ev.id === id)?.fileName)
        .filter(Boolean) as string[],
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

    /* The evidence selection belongs to the item that was just staged — clear
       it so the next source does not silently inherit the same document. */
    setSelectedEvidenceIds([])

    // Float the captured item card over to the right-panel journey list
    onItemStaged?.(
      {
        levelKey: 'level4',
        id: itemPayload.id,
        name: wasteCategory,
        quantity: genNum,
        unit,
      },
      addBtnRef.current
    )
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
    setSelectedEvidenceIds(item.evidenceIds?.length ? item.evidenceIds : item.evidenceId ? [item.evidenceId] : [])
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
      evidenceId: itemsToSave.find((i) => i.evidenceId)?.evidenceId || selectedEvidenceIds[0] || '',
      evidenceIds: Array.from(new Set(itemsToSave.flatMap((i) => (i.evidenceIds?.length ? i.evidenceIds : i.evidenceId ? [i.evidenceId] : [])))),
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
    selectedEvidenceIds,
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
          evidenceId: selectedEvidenceIds[0] || '',
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

      const res = await fetch(`${apiBase}/data-entry`, {
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
        submitForReview ? 'Waste submission sent for BU review!' : 'Waste draft saved successfully!'
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 text-center">
              {/* Card 1: Generated (Amber / Warm) */}
              <div className="rounded-xl bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-amber-500/5 p-3 shadow-xs border border-amber-200/80">
                <div className="text-[10px] uppercase tracking-wider text-amber-800 font-bold">
                  Generated
                </div>
                <div className="text-base font-extrabold text-amber-950 mt-0.5">
                  {curGen.toFixed(2)} {unit}
                </div>
                <div className="text-[9px] text-amber-700 font-medium mt-0.5">Total generation</div>
              </div>

              {/* Card 2: Circular Diverted (Emerald / Green) */}
              <div className="rounded-xl bg-gradient-to-br from-emerald-500/10 via-teal-500/10 to-emerald-500/5 p-3 shadow-xs border border-emerald-200/80">
                <div className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold">
                  Circular Diverted
                </div>
                <div className="text-base font-extrabold text-emerald-950 mt-0.5">
                  {curDiverted.toFixed(2)} {unit}
                </div>
                <div className="text-[9px] text-emerald-600 font-medium mt-0.5">Reused &amp; recycled</div>
              </div>

              {/* Card 3: Diversion Recovery (Indigo / Violet) */}
              <div className="rounded-xl bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-indigo-500/5 p-3 shadow-xs border border-indigo-200/80">
                <div className="text-[10px] uppercase tracking-wider text-indigo-700 font-bold">
                  Diversion Recovery
                </div>
                <div className="text-base font-extrabold text-indigo-950 mt-0.5">{curDivPct}%</div>
                <div className="text-[9px] text-indigo-600 font-medium mt-0.5">Landfill avoidance</div>
              </div>

              {/* Card 4: Benchmark & Regulatory Factor (Rose / Pink) */}
              <div className="rounded-xl bg-gradient-to-br from-rose-500/10 via-pink-500/10 to-rose-500/5 p-3 shadow-xs border border-rose-200/80 flex flex-col justify-between">
                <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-rose-800 font-bold">
                  <span>Waste Factor</span>
                  <EmissionFactorInfoIcon materialName={wasteCategory} />
                </div>
                <div className="text-base font-extrabold text-rose-950 mt-0.5">
                  CPCB PWM
                </div>
                <div className="text-[9px] text-rose-700 font-mono font-medium mt-0.5">
                  EPR Certified
                </div>
              </div>
            </div>
          </div>

          {/* INTERACTIVE CATEGORY ITEMS SELECTOR PILLS */}
          <div className="sm:col-span-2 glass-subtle rounded-2xl p-4">
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
              placeholder="Quantity generated this period"
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
              placeholder="Authorized handler / processor name"
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
              selectedEvidenceIds={selectedEvidenceIds}
              onSelectEvidenceIds={setSelectedEvidenceIds}
              evidenceUsedElsewhere={evidenceUsedElsewhere}
              onReview={onReviewEvidence}
              onOcrApply={(f) => {
                const src = (f.sourceName || f.notes || '').toLowerCase()
                if (src.includes('scrap') || src.includes('metal') || src.includes('rebar') || src.includes('steel')) {
                  setWasteCategory('Scrap metal & Structural steel')
                  setUnit('metric tonnes')
                } else if (src.includes('hazard') || src.includes('oil') || src.includes('chemical') || src.includes('sludge')) {
                  setWasteCategory('Hazardous & chemical waste')
                  setUnit('kg')
                } else if (src.includes('battery') || src.includes('e-waste') || src.includes('electronic')) {
                  setWasteCategory('E-waste & Batteries')
                  setUnit('kg')
                } else if (src.includes('plastic') || src.includes('packaging')) {
                  setWasteCategory('Plastic waste')
                  setUnit('metric tonnes')
                } else if (src.includes('biomedical') || src.includes('medical') || src.includes('clinic')) {
                  setWasteCategory('Biomedical waste')
                  setUnit('kg')
                } else if (src.includes('municipal') || src.includes('food') || src.includes('domestic')) {
                  setWasteCategory('Municipal solid waste')
                  setUnit('metric tonnes')
                } else if (src.includes('c&d') || src.includes('demolition') || src.includes('concrete')) {
                  setWasteCategory('Construction & demolition')
                  setUnit('metric tonnes')
                }

                if (f.sourceName) setWasteTypeDescription(f.sourceName)
                if (f.quantity) setQuantityGenerated(f.quantity)

                const manifest = f.invoiceNo || f.meterId
                if (manifest) setTransferManifestNumber(manifest)

                const handler = f.supplierOrVendor || f.labName
                if (handler) setWasteHandler(handler)

                if (f.unit) {
                  const u = f.unit.toLowerCase()
                  if (u.includes('tonne') || u.includes('ton') || u === 'mt') setUnit('metric tonnes')
                  else if (u.includes('kg')) setUnit('kg')
                  else if (u.includes('litre') || u.includes('liter') || u === 'l' || u === 'ltr') setUnit('litres')
                  else if (u.includes('drum')) setUnit('drums')
                  else if (u.includes('no')) setUnit('numbers')
                }

                if (f.destinationOrMethod) {
                  const dest = f.destinationOrMethod.toLowerCase()
                  if (dest.includes('tsdf') || dest.includes('landfill')) setDisposalMethod('Landfill (TSDF)')
                  else if (dest.includes('incinerat') || dest.includes('co-process')) setDisposalMethod('Incineration / Co-processing')
                  else if (dest.includes('recyc')) setDisposalMethod('Authorised recycling facility')
                  else if (dest.includes('compost')) setDisposalMethod('Composting')
                }

                const bits = [
                  f.invoiceNo && `Manifest/Invoice #${f.invoiceNo}`,
                  f.date && `Date: ${f.date}`,
                  f.supplierOrVendor && `Handler: ${f.supplierOrVendor}`,
                  f.monetaryAmount && `Amount: ₹${Number(f.monetaryAmount).toLocaleString('en-IN')}`,
                  f.notes,
                ].filter(Boolean)
                if (bits.length) setRemarks(bits.join(' · '))
                toast.success('AI extracted evidence details & filled matching fields!')
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
              className="w-full flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 py-3.5 px-6 text-sm font-bold text-white shadow-lg shadow-amber-500/25 ring-1 ring-white/30 backdrop-blur-md transition-all hover:shadow-xl hover:shadow-amber-500/35 hover:scale-[1.008] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer group"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 transition-transform group-hover:scale-110">
                <Plus className="h-4 w-4 stroke-[2.5]" />
              </div>
              <span className="tracking-wide">
                {editingItemId ? `Update ${wasteCategory} Draft Item` : `+ Add ${wasteCategory} (Draft)`}
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
                                onClick={() => onViewItem?.({
                                  ...item,
                                  title: item.wasteCategory,
                                  levelKey: 'level4',
                                  levelName: 'Level 4 — Waste Management',
                                  quantity: item.quantityGenerated,
                                  unit: item.unit,
                                  factorSource: 'CPCB Guidelines & PWM / HWM Rules 2016',
                                  factorUnit: item.unit,
                                  remarks: item.remarks,
                                  evidenceId: item.evidenceId,
                                  sourceDocument: item.supportingEvidence,
                                  wasteTypeDescription: item.wasteTypeDescription,
                                  quantityReused: item.quantityReused,
                                  quantityRecycled: item.quantityRecycled,
                                  quantityRecovered: item.quantityRecovered,
                                  quantityDisposed: item.quantityDisposed,
                                  disposalMethod: item.disposalMethod,
                                  wasteHandler: item.wasteHandler,
                                  authorizationReference: item.authorizationReference,
                                  transferManifestNumber: item.transferManifestNumber,
                                  circularRecoveryPct: item.circularRecoveryPct,
                                })}
                                className="flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700 hover:bg-amber-100 transition shadow-2xs cursor-pointer mr-1"
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

          <FormSaveActions
            error={error}
            submitting={submitting}
            readOnly={readOnly}
            onSave={() => save(false)}
            onSubmitForReview={handleNextOrganize}
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
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => onViewItem?.({
                                ...item,
                                title: item.wasteCategory,
                                levelKey: 'level4',
                                levelName: 'Level 4 — Waste Management',
                                quantity: item.quantityGenerated,
                                unit: item.unit,
                                factorSource: 'CPCB Guidelines & PWM / HWM Rules 2016',
                                factorUnit: item.unit,
                                remarks: item.remarks,
                                evidenceId: item.evidenceId,
                                sourceDocument: item.supportingEvidence,
                                wasteTypeDescription: item.wasteTypeDescription,
                                quantityReused: item.quantityReused,
                                quantityRecycled: item.quantityRecycled,
                                quantityRecovered: item.quantityRecovered,
                                quantityDisposed: item.quantityDisposed,
                                disposalMethod: item.disposalMethod,
                                wasteHandler: item.wasteHandler,
                                authorizationReference: item.authorizationReference,
                                transferManifestNumber: item.transferManifestNumber,
                                circularRecoveryPct: item.circularRecoveryPct,
                              })}
                              className="flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700 hover:bg-amber-100 transition shadow-2xs cursor-pointer mr-1"
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
            onSubmitForReview={() => save(true)}
            nextLabel="Submit Waste Record →"
          />
        </div>
      )}
    </div>
  )
}