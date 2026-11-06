'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Zap, Flame, CheckCircle2, AlertTriangle, Save, Info, Calculator, Sparkles, Layers, Eye, Plus, Trash2, Edit3, ArrowLeft, Sun, Fuel, Wind, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { EmissionFactorInfoIcon } from '../../emission-factor-info'
import { FormEvidenceAttachSection } from '../evidence-attach'
import { inputClass, FormGrid, FormField, FormSaveActions, type LevelFormProps } from '../primitives'
import { type Project, type Period, useApiBase } from '../core'

/* ============================================================
   LEVEL 1: ENERGY CONSUMPTION FORM (MULTI-ITEM DRAFT & ORGANIZE FLOW)
   ============================================================ */

export const L1_ENERGY_SOURCES = [
  'Grid electricity',
  'Renewable electricity',
  'Diesel',
  'Petrol',
  'Gas',
  'LPG',
  'Coal',
  'Other',
]

export const L1_ACTIVITIES = [
  'Generator',
  'Construction equipment',
  'Vehicles',
  'Lighting',
  'Office',
  'Substation auxiliary',
  'Heating / Boiler',
  'Other',
]

export const L1_UNITS = ['kWh', 'MWh', 'litres', 'kg', 'tonnes', 'm³']

export const L1_DOCUMENTS = [
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
  evidenceIds?: string[]
  evidenceFiles?: string[]
  evidenceFileName?: string
  factor: number
  estTco2e: number
  estGj: number
}

export const SOURCE_PRESETS: Record<
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

  },
}

export function calculateItemEmissions(source: string, quantityStr: string) {
  const qty = Number(quantityStr) || 0
  const preset = SOURCE_PRESETS[source] || SOURCE_PRESETS['Grid electricity']
  const factor = preset.factor
  const gjRate = preset.gjRate
  const estTco2e = qty > 0 ? (qty * factor) / 1000 : 0
  const estGj = qty > 0 ? qty * gjRate : 0
  return { factor, gjRate, estTco2e, estGj }
}

export function Level1EnergyForm({
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

  const key = `l1-${projectId}-${periodId}`
  const initial = formStateRef.current[key] || {}

  // Multi-source staged draft items collection — blank unless a saved draft exists
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
          meterEquipmentId: initial.meterEquipmentId || '',
          openingMeterReading: initial.openingMeterReading || '',
          closingMeterReading: initial.closingMeterReading || '',
          energyPurchased: initial.energyPurchased || '',
          energyGenerated: initial.energyGenerated || '',
          renewableEnergyQuantity: initial.renewableEnergyQuantity || '',
          reportingPeriod: initial.reportingPeriod || '',
          sourceDocument: initial.sourceDocument || 'Electricity bill',
          remarks: initial.remarks || '',
          evidenceId: initial.evidenceId || '',
          factor: calc.factor,
          estTco2e: calc.estTco2e,
          estGj: calc.estGj,
        },
      ]
    }
    return []
  })


  // Automatically open and load source item when clicked from Emission Sequence Journey
  useEffect(() => {
    if (selectedSourceToEdit?.levelKey === 'level1' && selectedSourceToEdit.sourceName) {
      handleSelectSource(selectedSourceToEdit.sourceName)
    }
  }, [selectedSourceToEdit])

  // View Step: 'ENTRY' (input/draft each item) | 'ORGANIZED' (all items organized in one consolidated view)
  const [viewStep, setViewStep] = useState<'ENTRY' | 'ORGANIZED'>(
    initial.viewStep === 'ORGANIZED' ? 'ORGANIZED' : 'ENTRY'
  )

  // Currently editing item id (if null, creating new source item)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)

  // Active form inputs for the selected Energy Source item — blank until the user types
  const [energySource, setEnergySource] = useState('Grid electricity')
  const [customEnergySource, setCustomEnergySource] = useState('')
  const [emissionDataType, setEmissionDataType] = useState('Scope 2')
  const [energyActivity, setEnergyActivity] = useState('Lighting')
  const [consumptionQuantity, setConsumptionQuantity] = useState('')
  const [unit, setUnit] = useState('kWh')
  const [meterEquipmentId, setMeterEquipmentId] = useState('')
  const [openingMeterReading, setOpeningMeterReading] = useState('')
  const [closingMeterReading, setClosingMeterReading] = useState('')
  const [energyPurchased, setEnergyPurchased] = useState('')
  const [energyGenerated, setEnergyGenerated] = useState('')
  const [renewableEnergyQuantity, setRenewableEnergyQuantity] = useState('')
  const [reportingPeriod, setReportingPeriod] = useState('')
  const [sourceDocument, setSourceDocument] = useState('Electricity bill')
  const [remarks, setRemarks] = useState('')
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Switch energy source or click on an existing staged item
  const handleSelectSource = (src: string) => {
    setError('')
    setEnergySource(src)
    if (src !== 'Other') {
      setCustomEnergySource('')
    }
    const existing = stagedItems.find((i) => i.energySource === src || (src === 'Other' && !L1_ENERGY_SOURCES.includes(i.energySource)))
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
      setSelectedEvidenceIds(existing.evidenceIds?.length ? existing.evidenceIds : existing.evidenceId ? [existing.evidenceId] : [])
    } else {
      // Load preset smart defaults for a clean new entry
      setEditingItemId(null)
      const preset = SOURCE_PRESETS[src] || SOURCE_PRESETS['Grid electricity']
      // Type defaults only (scope / activity / unit / document) — never fabricate
      // readings: quantities, meter IDs and remarks are left for the user.
      setEmissionDataType(preset.scope)
      setEnergyActivity(preset.activity)
      setConsumptionQuantity('')
      setUnit(preset.unit)
      setMeterEquipmentId('')
      setOpeningMeterReading('')
      setClosingMeterReading('')
      setEnergyPurchased('')
      setEnergyGenerated('')
      setRenewableEnergyQuantity('')
      setSourceDocument(preset.doc)
      setRemarks('')
      setSelectedEvidenceIds([])
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
    setSelectedEvidenceIds(item.evidenceIds?.length ? item.evidenceIds : item.evidenceId ? [item.evidenceId] : [])
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
    if (energySource === 'Other' && !customEnergySource.trim()) {
      setError('Please enter the custom name for your Other energy source (e.g. Biomass, Heavy Fuel Oil, etc.).')
      return false
    }
    const effectiveSource = energySource === 'Other' ? customEnergySource.trim() : energySource

    const qtyVal = Number(consumptionQuantity)
    if (!consumptionQuantity || isNaN(qtyVal) || qtyVal <= 0) {
      setError(`Please enter a valid consumption quantity (> 0) for ${effectiveSource}.`)
      return false
    }

    const { factor, gjRate, estTco2e, estGj } = calculateItemEmissions(effectiveSource, consumptionQuantity)
    const attachedEv = evidence.find((ev) => selectedEvidenceIds.includes(ev.id))

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
      evidenceId: selectedEvidenceIds[0] || '',
      evidenceIds: selectedEvidenceIds,
      evidenceFiles: selectedEvidenceIds.map((id) => evidence.find((ev) => ev.id === id)?.fileName).filter(Boolean) as string[],
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

    // Float the captured item card over to the right-panel journey list
    onItemStaged?.(
      {
        levelKey: 'level1',
        id: newItem.id,
        name: effectiveSource,
        quantity: Number(consumptionQuantity),
        unit,
        estTco2e,
      },
      addBtnRef.current
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
      setSelectedEvidenceIds([])
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
      evidenceId: itemsToSave.find((i) => i.evidenceId)?.evidenceId || selectedEvidenceIds[0] || '',
      evidenceIds: Array.from(new Set(itemsToSave.flatMap((i) => i.evidenceIds?.length ? i.evidenceIds : i.evidenceId ? [i.evidenceId] : []))),
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
    selectedEvidenceIds,
    formStateRef,
  ])

  // Live calculations for current active field
  const qty = Number(consumptionQuantity) || 0
  const open = Number(openingMeterReading) || 0
  const close = Number(closingMeterReading) || 0
  const meterDiff = close > open ? close - open : 0
  const currentPreset = SOURCE_PRESETS[energySource] || SOURCE_PRESETS['Grid electricity']
  const currentCalc = calculateItemEmissions(energySource, consumptionQuantity)
  const factor = currentCalc.factor
  const estTco2e = currentCalc.estTco2e
  const estGj = currentCalc.estGj

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
          evidenceId: selectedEvidenceIds[0] || '',
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

      const res = await fetch(`${apiBase}/data-entry`, {
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

        {viewStep === 'ORGANIZED' && (
          <button
            type="button"
            onClick={() => setViewStep('ENTRY')}
            className="ios-btn-ghost cursor-pointer"
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
          {/* Live Energy Analytics banner with 4 distinctive color-themed cards */}
          <div className="sm:col-span-2 rounded-2xl border border-blue-200/90 bg-gradient-to-r from-blue-50/90 via-indigo-50/60 to-blue-50/90 p-4 text-xs text-blue-900 shadow-sm">
            <div className="flex items-center justify-between font-bold mb-3">
              <span className="flex items-center gap-2 text-blue-800">
                <Calculator className="h-4 w-4 text-blue-600" /> Active Item Analytics ·{' '}
                <span className="underline decoration-blue-300 font-extrabold">{energySource}</span>
              </span>
              <span className="rounded-full bg-blue-100/90 px-2.5 py-0.5 text-[10px] text-blue-800 font-mono font-bold border border-blue-200">
                Unit: {unit}
              </span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 text-center">
              {/* Card 1: Est. GHG (Electric Blue / Indigo) */}
              <div className="rounded-xl bg-gradient-to-br from-blue-500/10 via-indigo-500/10 to-blue-500/5 p-3 shadow-xs border border-blue-200/80">
                <div className="text-[10px] uppercase tracking-wider text-blue-700 font-bold">
                  Est. GHG ({energySource})
                </div>
                <div className="text-base font-extrabold text-blue-950 mt-0.5">{estTco2e.toFixed(2)} tCO₂e</div>
                <div className="text-[9px] text-blue-600 font-medium mt-0.5">{estGj.toFixed(1)} GJ energy</div>
              </div>

              {/* Card 2: Meter Delta (Emerald / Teal) */}
              <div className="rounded-xl bg-gradient-to-br from-emerald-500/10 via-teal-500/10 to-emerald-500/5 p-3 shadow-xs border border-emerald-200/80">
                <div className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold">
                  Meter Delta
                </div>
                <div className="text-base font-extrabold text-emerald-950 mt-0.5">
                  {meterDiff > 0 ? meterDiff.toLocaleString() : '—'}
                </div>
                <div className="text-[9px] text-emerald-600 font-medium mt-0.5">{unit} metered</div>
              </div>

              {/* Card 3: GHG Scope (Purple / Violet) */}
              <div className="rounded-xl bg-gradient-to-br from-purple-500/10 via-violet-500/10 to-purple-500/5 p-3 shadow-xs border border-purple-200/80">
                <div className="text-[10px] uppercase tracking-wider text-purple-700 font-bold">
                  GHG Scope
                </div>
                <div className="text-base font-extrabold text-purple-950 mt-0.5">{emissionDataType}</div>
                <div className="text-[9px] text-purple-600 font-medium mt-0.5">BRSR Protocol</div>
              </div>

              {/* Card 4: Emission Factor with ! Info Icon (Amber / Orange) */}
              <div className="rounded-xl bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-amber-500/5 p-3 shadow-xs border border-amber-200/80 flex flex-col justify-between">
                <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-amber-800 font-bold">
                  <span>Emission Factor</span>
                  <EmissionFactorInfoIcon materialName={energySource} />
                </div>
                <div className="text-base font-extrabold text-amber-950 mt-0.5">
                  {factor}
                </div>
                <div className="text-[9px] text-amber-700 font-mono font-medium mt-0.5">
                  kgCO₂e/{unit}
                </div>
              </div>
            </div>
          </div>

          {/* INTERACTIVE SOURCE ITEMS SELECTOR PILLS */}
          <div className="sm:col-span-2 glass-subtle rounded-2xl p-4">
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

          {energySource === 'Other' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="sm:col-span-2 rounded-2xl border border-blue-200/90 bg-gradient-to-r from-blue-50/90 via-sky-50/60 to-indigo-50/40 p-3.5 shadow-xs backdrop-blur-sm"
            >
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-blue-950">
                <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                <span>Custom Energy Source Name</span>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-bold text-blue-700">Required</span>
              </label>
              <input
                type="text"
                value={customEnergySource}
                disabled={readOnly}
                onChange={(e) => setCustomEnergySource(e.target.value)}
                placeholder="Specify other energy source name (e.g. Biomass Briquettes, Captive Wind, Heavy Fuel Oil, Syngas...)"
                className={inputClass + ' bg-white/95 font-semibold text-slate-900 border-blue-300 focus:border-blue-500'}
                required
              />
              <p className="mt-1.5 text-[10px] text-blue-700">
                This custom name will be saved in your staged draft, verified in calculations, and reported on the BRSR submission record.
              </p>
            </motion.div>
          )}

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
              placeholder="Metered consumption for the period"
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
              placeholder="Meter opening reading"
              className={inputClass}
            />
          </FormField>

          <FormField label="Closing Meter Reading" hint="If metered (kWh / L).">
            <input
              type="number"
              value={closingMeterReading}
              disabled={readOnly}
              onChange={(e) => setClosingMeterReading(e.target.value)}
              placeholder="Meter closing reading"
              className={inputClass}
            />
          </FormField>

          <FormField label="Energy Purchased" hint="Purchased quantity from utility / vendor.">
            <input
              type="number"
              value={energyPurchased}
              disabled={readOnly}
              onChange={(e) => setEnergyPurchased(e.target.value)}
              placeholder="Metered consumption for the period"
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
              selectedEvidenceIds={selectedEvidenceIds}
              onSelectEvidenceIds={setSelectedEvidenceIds}
              onReview={onReviewEvidence}
onOcrApply={(f) => {
                if (f.quantity) setConsumptionQuantity(f.quantity)
                if (f.meterOpening) setOpeningMeterReading(f.meterOpening)
                if (f.meterClosing) setClosingMeterReading(f.meterClosing)
                if (f.meterId) setMeterEquipmentId(f.meterId)
                if (f.unit && L1_UNITS.includes(f.unit)) setUnit(f.unit)
                const bits = [f.invoiceNo && `Ref ${f.invoiceNo}`, f.date, f.notes].filter(Boolean)
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
              className="w-full flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 py-3.5 px-6 text-sm font-bold text-white shadow-lg shadow-blue-500/25 ring-1 ring-white/30 backdrop-blur-md transition-all hover:shadow-xl hover:shadow-blue-500/35 hover:scale-[1.008] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer group"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 transition-transform group-hover:scale-110">
                <Plus className="h-4 w-4 stroke-[2.5]" />
              </div>
              <span className="tracking-wide">
                {editingItemId ? `Update ${energySource} Draft Item` : `+ Add ${energySource} (Draft)`}
              </span>
            </button>

            {error && (
              <div className="mt-2.5 rounded-xl border border-rose-200 bg-rose-50/90 p-2.5 text-xs font-medium text-rose-800">
                <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5 text-rose-600" /> {error}
              </div>
            )}
          </div>

          {/* STAGED DRAFT ITEMS TABLE / LIST (SHOWN IN ENTRY VIEW) */}
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
                      Items saved as local draft. You can edit any item, add another source, or proceed to Organize.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700 border border-blue-200">
                    Total: {totalCombinedTco2e.toFixed(2)} tCO₂e
                  </span>
                  
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
                            <div className="flex items-center gap-1.5">
                              {item.energySource.toLowerCase().includes('grid') ? (
                                <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200/90 bg-gradient-to-r from-blue-500/15 to-indigo-500/10 px-2.5 py-1 text-xs font-extrabold text-blue-950 shadow-2xs">
                                  <Zap className="h-3 w-3 text-blue-600" />
                                  <span>{item.energySource}</span>
                                </span>
                              ) : item.energySource.toLowerCase().includes('diesel') || item.energySource.toLowerCase().includes('petrol') || item.energySource.toLowerCase().includes('fuel') ? (
                                <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200/90 bg-gradient-to-r from-amber-500/15 to-orange-500/10 px-2.5 py-1 text-xs font-extrabold text-amber-950 shadow-2xs">
                                  <Fuel className="h-3 w-3 text-amber-600" />
                                  <span>{item.energySource}</span>
                                </span>
                              ) : item.energySource.toLowerCase().includes('renewable') || item.energySource.toLowerCase().includes('solar') ? (
                                <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200/90 bg-gradient-to-r from-emerald-500/15 to-teal-500/10 px-2.5 py-1 text-xs font-extrabold text-emerald-950 shadow-2xs">
                                  <Sun className="h-3 w-3 text-emerald-600" />
                                  <span>{item.energySource}</span>
                                </span>
                              ) : item.energySource.toLowerCase().includes('gas') || item.energySource.toLowerCase().includes('lpg') ? (
                                <span className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200/90 bg-gradient-to-r from-orange-500/15 to-amber-500/10 px-2.5 py-1 text-xs font-extrabold text-orange-950 shadow-2xs">
                                  <Flame className="h-3 w-3 text-orange-600" />
                                  <span>{item.energySource}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200/90 bg-gradient-to-r from-violet-500/15 to-purple-500/10 px-2.5 py-1 text-xs font-extrabold text-violet-950 shadow-2xs">
                                  <Sparkles className="h-3 w-3 text-violet-600" />
                                  <span>{item.energySource}</span>
                                </span>
                              )}
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
                                onClick={() => onViewItem?.({
                                  ...item,
                                  title: item.energySource,
                                  levelKey: 'level1',
                                  levelName: 'Level 1 — Energy Consumption',
                                  factor: item.factor,
                                  factorUnit: `kgCO2e/${item.unit}`,
                                  factorSource: 'CEA 2024 Baseline Database / IPCC 2006',
                                })}
                                className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100 transition shadow-2xs cursor-pointer mr-1"
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
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => onViewItem?.({
                                ...item,
                                title: item.energySource,
                                levelKey: 'level1',
                                levelName: 'Level 1 — Energy Consumption',
                                factor: item.factor,
                                factorUnit: `kgCO2e/${item.unit}`,
                                factorSource: 'CEA 2024 Baseline Database / IPCC 2006',
                              })}
                              className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100 transition shadow-2xs cursor-pointer mr-1"
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

          {/* Submit Energy Record */}
          <FormSaveActions
            error={error}
            submitting={submitting}
            readOnly={readOnly}
            onSubmitForReview={() => save(true)}
            nextLabel="Submit Energy Record →"
          />
        </div>
      )}
    </div>
  )
}