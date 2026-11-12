'use client'

import { useEffect, useState, useMemo } from 'react'
import { Droplet, Flame, CheckCircle2, AlertTriangle, Save, Sparkles, TrendingUp, Layers, Eye, Plus, Trash2, Edit3, ArrowRight, Sun, Fuel, ListOrdered, CloudRain, Truck, Package, RefreshCw, Trees, Cpu, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { FormEvidenceAttachSection } from '../evidence-attach'
import { availableEvidenceIds, ownerOfEvidence } from '../evidence-usage'
import { inputClass, FormGrid, FormField, FormSaveActions, useDraftBucket, type LevelFormProps } from '../primitives'
import { type Period, type EvidenceItem, useApiBase } from '../core'

/* ============================================================
   LEVEL 9: SITE OPERATIONS & RESOURCE-EFFICIENCY INITIATIVES FORM
   (MULTI-ITEM DRAFT & ORGANIZE WORKFLOW)
   ============================================================ */

export const L9_CATEGORIES = [
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

export const L9_PRESETS: Record<
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
  /* File NAMES only — never the whole evidence row (a persisted object
     crashes every screen that renders the item: React error #31). */
  evidenceFiles: string[]
  savings: number
  pctSaved: number
}

export function Level9InitiativesForm({
  projectId,
  periodId,
  evidence,
  readOnly,
  formStateRef,
  onSaved,
  onEvidenceUploaded,
  onReviewEvidence,
}: LevelFormProps) {
  const apiBase = useApiBase()

  const key = `l9-${projectId}-${periodId}`
  const initial = useDraftBucket(formStateRef, key)

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
  const [physicalOutputQuantity, setPhysicalOutputQuantity] = useState(initial.physicalOutputQuantity ?? '')
  const [outputUnit, setOutputUnit] = useState(initial.outputUnit ?? 'kWh / Month')
  const [startDate, setStartDate] = useState(initial.startDate ?? '')
  const [completionDate, setCompletionDate] = useState(initial.completionDate ?? '')
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
    /* ONE evidence document may support only ONE source item of this record. */
    const { allowed: usableEvidenceIds, blocked: blockedEvidenceIds } = availableEvidenceIds(
      selectedEvidenceIds,
      stagedItems,
      editingId
    )
    if (blockedEvidenceIds.length > 0) {
      const owners = blockedEvidenceIds.map((id) => ownerOfEvidence(stagedItems, id)).filter(Boolean)
      toast.warning('Evidence already used by another source', {
        description: `The same document cannot support two sources in one record${
          owners.length ? ` (already attached to ${[...new Set(owners)].join(', ')})` : ''
        }. It was left on that source only.`,
      })
    }
    const attFiles = evidence.filter((e) => usableEvidenceIds.includes(e.id))
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
      evidenceIds: usableEvidenceIds,
      evidenceFiles: attFiles.map((f) => f.fileName),
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

      const res = await fetch(`${apiBase}/data-entry`, {
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
      onSaved({ ...d.record, duplicateRecord: d.duplicateRecord ?? null }, submitForReview)
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
                placeholder="Measured output quantity"
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
                evidenceUsedElsewhere={useMemo(() => {
                  const map: Record<string, string> = {}
                  for (const item of stagedItems) {
                    if (editingId && item.id === editingId) continue
                    for (const id of item.evidenceIds?.length ? item.evidenceIds : []) {
                      if (id && !map[id]) map[id] = item.activityInitiativeName
                    }
                  }
                  return map
                }, [stagedItems, editingId])}
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
                              {item.evidenceFiles.map((ev: any, evIdx: number) => {
                                const evName = typeof ev === 'string' ? ev : ev?.fileName || 'Evidence'
                                const evKey = typeof ev === 'string' ? `${ev}-${evIdx}` : ev?.id || evIdx
                                return (
                                  <button
                                    key={evKey}
                                    type="button"
                                    onClick={() => onReviewEvidence && onReviewEvidence(typeof ev === 'string' ? ({ id: ev, fileName: ev } as any) : ev)}
                                    className="flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 hover:bg-blue-100 transition"
                                    title="Review evidence (flips card 180°)"
                                  >
                                    <Eye className="h-2.5 w-2.5" />
                                    <span className="max-w-[80px] truncate">{evName}</span>
                                  </button>
                                )
                              })}
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
                            {item.evidenceFiles.map((ev: any, evIdx: number) => {
                              const evName = typeof ev === 'string' ? ev : ev?.fileName || 'Evidence'
                              const evKey = typeof ev === 'string' ? `${ev}-${evIdx}` : ev?.id || evIdx
                              return (
                              <button
                                key={evKey}
                                type="button"
                                onClick={() => onReviewEvidence && onReviewEvidence(typeof ev === 'string' ? ({ id: ev, fileName: ev } as any) : ev)}
                                className="flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 hover:bg-blue-100 transition"
                                title="Review document (flips Engine Preview card)"
                              >
                                <Eye className="h-2.5 w-2.5" />
                                <span className="max-w-[90px] truncate">{evName}</span>
                              </button>
                              )
                            })}
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
            nextLabel="Submit Initiative Portfolio →"
          />
        </div>
      )}
    </div>
  )
}