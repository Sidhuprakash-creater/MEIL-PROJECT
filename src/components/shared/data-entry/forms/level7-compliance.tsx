'use client'

import { useEffect, useState, useMemo } from 'react'
import { ShieldCheck, CheckCircle2, AlertTriangle, Clock, Save, Building2, FileCheck2, Layers, Eye, Plus, Trash2, Edit3, ArrowRight, ListOrdered, Waves, Wind, Factory, Package, ShieldAlert, Landmark, Trees, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { FormEvidenceAttachSection } from '../evidence-attach'
import { inputClass, FormGrid, FormField, FormSaveActions, useDraftBucket, type LevelFormProps } from '../primitives'
import { type Project, type EvidenceItem, useApiBase } from '../core'

/* ============================================================
   LEVEL 7: ENVIRONMENTAL COMPLIANCE & PERMITS FORM
   (MULTI-ITEM DRAFT & ORGANIZE WORKFLOW)
   ============================================================ */

export const L7_PERMIT_TYPES = [
  'Consent to Operate (CTO)',
  'Consent to Establish (CTE)',
  'Environmental Clearance (EC)',
  'Hazardous Waste Authorization',
  'Groundwater NOC (CGWA)',
  'Forest Clearance / Tree Transit',
  'Factory License & Boilers Registration',
  'Noise & Ambient Air Authorization',
  'Other Statutory Clearance',
]

export const L7_PRESETS: Record<
  string,
  {
    authority: string
    activity: string
    validityYears: number
    icon: LucideIcon
  }
> = {
  'Consent to Operate (CTO)': {
    authority: 'State Pollution Control Board (SPCB)',
    activity: 'Concrete Batching, 400kV Substation & Solar PV EPC Operations',
    validityYears: 3,
    icon: ShieldCheck,
  },
  'Consent to Establish (CTE)': {
    authority: 'State Pollution Control Board (SPCB)',
    activity: 'Phase-2 Substation Expansion & Inverter Yard Construction',
    validityYears: 5,
    icon: Building2,
  },
  'Environmental Clearance (EC)': {
    authority: 'Ministry of Environment, Forest and Climate Change (MoEFCC)',
    activity: 'Full-scale Infrastructure Transmission & Canal Reach Package',
    validityYears: 7,
    icon: Landmark,
  },
  'Hazardous Waste Authorization': {
    authority: 'State Pollution Control Board (SPCB)',
    activity: 'Handling, Storage & Transit of Used Transformer Oil & Spent Batteries',
    validityYears: 5,
    icon: ShieldAlert,
  },
  'Groundwater NOC (CGWA)': {
    authority: 'Central Ground Water Authority (CGWA)',
    activity: 'Deep Borewell Abstraction & Dewatering for Substation Trenching',
    validityYears: 3,
    icon: Waves,
  },
  'Forest Clearance / Tree Transit': {
    authority: 'State Forest Department / MoEFCC Regional Office',
    activity: 'Linear Transmission Line Right of Way (RoW) & Compensatory Afforestation',
    validityYears: 10,
    icon: Trees,
  },
  'Factory License & Boilers Registration': {
    authority: 'Directorate of Factories and Boilers',
    activity: 'Aggregate Processing Plant & Steam Auxiliary Operations',
    validityYears: 1,
    icon: Factory,
  },
  'Noise & Ambient Air Authorization': {
    authority: 'State Pollution Control Board (SPCB)',
    activity: 'Heavy DG Set Stack Emissions & Night Construction Acoustic Enclosures',
    validityYears: 2,
    icon: Wind,
  },
  'Other Statutory Clearance': {
    authority: 'Local Municipal / District Magistrate',
    activity: 'Public Infrastructure Utility Wayleave & Drainage NOC',
    validityYears: 2,
    icon: FileCheck2,
  },
}

export interface StagedPermitItem {
  id: string
  permitConsentType: string
  permitNumber: string
  issuingAuthority: string
  applicableActivity: string
  issueDate: string
  expiryDate: string
  permitStatus: string
  inspectionDate: string
  inspectionFindings: string
  nonComplianceIdentified: string
  correctiveAction: string
  responsibleOwner: string
  dueDate: string
  closureDate: string
  supportingEvidence: string
  evidenceIds: string[]
  /* File NAMES only — never the whole evidence row (a persisted object
     crashes every screen that renders the item: React error #31). */
  evidenceFiles: string[]
  daysRemaining: number
}

export function Level7ComplianceForm({
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

  const key = `l7-${projectId}-${periodId}`
  const initial = useDraftBucket(formStateRef, key)

  // Workflow mode: 1 = Item Drafting, 2 = Organized Consolidated Summary
  const [workflowStep, setWorkflowStep] = useState<1 | 2>(initial.items?.length > 0 ? 2 : 1)

  // Staged multi-item collection
  const [stagedItems, setStagedItems] = useState<StagedPermitItem[]>(() => {
    if (Array.isArray(initial.items) && initial.items.length > 0) return initial.items
    return []
  })

  // Active form inputs — blank until the user enters the actual permit data
  const [permitConsentType, setPermitConsentType] = useState(initial.permitConsentType ?? 'Consent to Operate (CTO)')
  const [permitNumber, setPermitNumber] = useState(initial.permitNumber ?? '')
  const [issuingAuthority, setIssuingAuthority] = useState(initial.issuingAuthority ?? '')
  const [issueDate, setIssueDate] = useState(initial.issueDate ?? '')
  const [expiryDate, setExpiryDate] = useState(initial.expiryDate ?? '')
  const [permitStatus, setPermitStatus] = useState(initial.permitStatus ?? 'Valid')
  const [applicableActivity, setApplicableActivity] = useState(initial.applicableActivity ?? '')
  const [inspectionDate, setInspectionDate] = useState(initial.inspectionDate ?? '')
  const [inspectionFindings, setInspectionFindings] = useState(initial.inspectionFindings ?? '')
  const [nonComplianceIdentified, setNonComplianceIdentified] = useState(initial.nonComplianceIdentified ?? 'No')
  const [correctiveAction, setCorrectiveAction] = useState(initial.correctiveAction ?? '')
  const [responsibleOwner, setResponsibleOwner] = useState(initial.responsibleOwner ?? '')
  const [dueDate, setDueDate] = useState(initial.dueDate ?? '')
  const [closureDate, setClosureDate] = useState(initial.closureDate ?? '')
  const [supportingEvidence, setSupportingEvidence] = useState(initial.supportingEvidence ?? '')
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>(() => {
    if (Array.isArray(initial.evidenceIds)) return initial.evidenceIds
    if (initial.evidenceId) return [initial.evidenceId]
    return []
  })

  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Calculate days remaining
  let daysRemaining = 365
  if (expiryDate) {
    const exp = new Date(expiryDate).getTime()
    daysRemaining = Math.round((exp - Date.now()) / 86400000)
  }

  // Auto-fill defaults when selecting permit type
  const handleSelectPresetType = (type: string) => {
    setPermitConsentType(type)
    const preset = L7_PRESETS[type]
    if (preset) {
      setIssuingAuthority(preset.authority)
      setApplicableActivity(preset.activity)
    }
  }

  // Sync state to parent ref
  useEffect(() => {
    formStateRef.current[key] = {
      permitConsentType,
      permitNumber,
      issuingAuthority,
      applicableActivity,
      issueDate,
      expiryDate,
      permitStatus,
      inspectionDate,
      inspectionFindings,
      nonComplianceIdentified,
      correctiveAction,
      responsibleOwner,
      dueDate,
      closureDate,
      supportingEvidence,
      evidenceIds: selectedEvidenceIds,
      evidenceId: selectedEvidenceIds[0] || null,
      items: stagedItems,
    }
  }, [
    key,
    permitConsentType,
    permitNumber,
    issuingAuthority,
    applicableActivity,
    issueDate,
    expiryDate,
    permitStatus,
    inspectionDate,
    inspectionFindings,
    nonComplianceIdentified,
    correctiveAction,
    responsibleOwner,
    dueDate,
    closureDate,
    supportingEvidence,
    selectedEvidenceIds,
    stagedItems,
    formStateRef,
  ])

  // Package current inputs into StagedPermitItem
  const packageCurrentItem = (): StagedPermitItem => {
    const attFiles = evidence.filter((e) => selectedEvidenceIds.includes(e.id))
    return {
      id: editingId || `permit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      permitConsentType,
      permitNumber: permitNumber || 'PENDING-REG-REF',
      issuingAuthority: issuingAuthority || 'Regulatory Authority',
      applicableActivity: applicableActivity || 'Project Site Operations',
      issueDate,
      expiryDate,
      permitStatus,
      inspectionDate,
      inspectionFindings,
      nonComplianceIdentified,
      correctiveAction,
      responsibleOwner,
      dueDate,
      closureDate,
      supportingEvidence,
      evidenceIds: selectedEvidenceIds,
      evidenceFiles: attFiles.map((f) => f.fileName),
      daysRemaining,
    }
  }

  // Add / Update item in staging
  const stageCurrentItem = (resetForm = true) => {
    if (!permitNumber) {
      setError('Permit reference number is required')
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

    toast.success(`Permit "${item.permitConsentType}" staged (${item.permitNumber})`, {
      description: `${item.evidenceIds.length} evidence file(s) attached.`,
    })

    if (resetForm) {
      setEditingId(null)
      // Pick next un-staged permit type
      const currentTypes = stagedItems.map((s) => s.permitConsentType)
      currentTypes.push(item.permitConsentType)
      const nextType = L7_PERMIT_TYPES.find((t) => !currentTypes.includes(t)) || L7_PERMIT_TYPES[0]
      handleSelectPresetType(nextType)
      setSelectedEvidenceIds([])
      setSupportingEvidence('')
    }
    return true
  }

  // Edit existing staged item
  const handleEditItem = (item: StagedPermitItem) => {
    setEditingId(item.id)
    setPermitConsentType(item.permitConsentType)
    setPermitNumber(item.permitNumber)
    setIssuingAuthority(item.issuingAuthority)
    setApplicableActivity(item.applicableActivity)
    setIssueDate(item.issueDate)
    setExpiryDate(item.expiryDate)
    setPermitStatus(item.permitStatus)
    setInspectionDate(item.inspectionDate)
    setInspectionFindings(item.inspectionFindings)
    setNonComplianceIdentified(item.nonComplianceIdentified)
    setCorrectiveAction(item.correctiveAction)
    setResponsibleOwner(item.responsibleOwner)
    setDueDate(item.dueDate)
    setClosureDate(item.closureDate)
    setSupportingEvidence(item.supportingEvidence)
    setSelectedEvidenceIds(item.evidenceIds || [])
    setWorkflowStep(1)
  }

  // Delete staged item
  const handleDeleteItem = (id: string) => {
    setStagedItems((prev) => prev.filter((p) => p.id !== id))
    toast.info('Permit item removed from draft staging')
  }

  // Move to Step 2
  const handleProceedToOrganize = () => {
    if (permitNumber && !stagedItems.some((p) => p.id === editingId)) {
      stageCurrentItem(false)
    }
    setWorkflowStep(2)
  }

  // Consolidated Portfolio Metrics
  const summaryMetrics = useMemo(() => {
    const total = stagedItems.length
    const valid = stagedItems.filter((p) => p.permitStatus === 'Valid').length
    const expiringSoon = stagedItems.filter((p) => p.daysRemaining <= 90 && p.daysRemaining >= 0).length
    const nonCompliant = stagedItems.filter((p) => p.nonComplianceIdentified === 'Yes').length
    const complianceRate = total > 0 ? Math.round(((total - nonCompliant) / total) * 100) : 100
    const totalDocs = stagedItems.reduce((acc, p) => acc + (p.evidenceIds?.length || 0), 0)

    return { total, valid, expiringSoon, nonCompliant, complianceRate, totalDocs }
  }, [stagedItems])

  // Save / Submit handler
  const save = async (submitForReview = false) => {
    setError('')
    let itemsToSave = stagedItems
    if (itemsToSave.length === 0) {
      if (!permitNumber) {
        setError('At least one permit authorization must be added or entered')
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
          level: 5,
          levelKey: 'level7',
          levelName: 'Level 5 — Environmental Permits & Compliance',
          module: 'COMPLIANCE',
          projectId,
          reportingPeriodId: periodId,
          evidenceId: allEvIds[0] || undefined,
          data: {
            ...primaryItem,
            evidenceIds: allEvIds,
            items: itemsToSave,
            totalPermits: itemsToSave.length,
            complianceRate: summaryMetrics.complianceRate,
          },
          submitForReview,
        }),
      })

      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Failed to save Permit record')

      toast.success(
        submitForReview
          ? `Permits & Compliance submitted for review (${itemsToSave.length} authorizations)!`
          : `Permit portfolio draft saved (${itemsToSave.length} authorizations).`,
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
      {/* SEGMENTED VIEW CONTROLLER PILL */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-teal-200/90 bg-gradient-to-r from-teal-50/90 via-white/80 to-emerald-50/90 p-2 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWorkflowStep(1)}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
              workflowStep === 1
                ? 'bg-teal-600 text-white shadow-md shadow-teal-500/20'
                : 'bg-white/80 text-slate-600 hover:bg-white hover:text-slate-900 border border-slate-200/80'
            }`}
          >
            <FileCheck2 className="h-3.5 w-3.5" />
            <span>1. Permit Drafting</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                workflowStep === 1 ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-700'
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
                ? 'bg-teal-600 text-white shadow-md shadow-teal-500/20'
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
            <span className="font-extrabold text-teal-700">{stagedItems.length} Permits</span>
          </span>
          <span className="text-slate-300">•</span>
          <span className="text-[11px] font-bold text-slate-600">
            Compliance: <span className="font-extrabold text-emerald-600">{summaryMetrics.complianceRate}%</span>
          </span>
        </div>
      </div>

      {/* ================= STEP 1: ITEM DRAFTING ================= */}
      {workflowStep === 1 && (
        <div className="space-y-4">
          {/* Source Preset Chips Dock */}
          <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-3 shadow-2xs">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Select Environmental Permit / Statutory Authorization:
              </span>
              <span className="text-[10px] text-teal-600 font-semibold">
                Click preset chip to auto-populate authority &amp; activity
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {L7_PERMIT_TYPES.map((type) => {
                const preset = L7_PRESETS[type]
                const IconComponent = preset?.icon || ShieldCheck
                const isSelected = permitConsentType === type
                const staged = stagedItems.find((s) => s.permitConsentType === type)

                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleSelectPresetType(type)}
                    className={`group relative flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                      isSelected
                        ? 'border-2 border-teal-500 bg-teal-50/90 text-teal-900 shadow-sm'
                        : 'border border-slate-200/80 bg-white/90 text-slate-700 hover:border-teal-300 hover:bg-teal-50/40'
                    }`}
                  >
                    <IconComponent
                      className={`h-3.5 w-3.5 ${isSelected ? 'text-teal-600' : 'text-slate-500 group-hover:text-teal-600'}`}
                    />
                    <span>{type}</span>
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
            <FormField label="Permit / Consent Type" hint="Selected environmental authorization.">
              <select
                value={permitConsentType}
                disabled={readOnly}
                onChange={(e) => handleSelectPresetType(e.target.value)}
                className={inputClass}
              >
                {L7_PERMIT_TYPES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Permit Reference Number" hint="Official statutory registration code.">
              <input
                value={permitNumber}
                disabled={readOnly}
                onChange={(e) => setPermitNumber(e.target.value)}
                placeholder="e.g. SPCB/CTO/2026-#### (from consent letter)"
                className={inputClass}
              />
            </FormField>

            <FormField label="Issuing Authority" hint="SPCB, CPCB, MoEFCC, CGWA.">
              <input
                value={issuingAuthority}
                disabled={readOnly}
                onChange={(e) => setIssuingAuthority(e.target.value)}
                placeholder="e.g. State Pollution Control Board"
                className={inputClass}
              />
            </FormField>

            <FormField label="Applicable Activity" hint="Activity covered by the permit.">
              <input
                value={applicableActivity}
                disabled={readOnly}
                onChange={(e) => setApplicableActivity(e.target.value)}
                placeholder="e.g. Concrete Batching & Solar PV EPC Operations"
                className={inputClass}
              />
            </FormField>

            <FormField label="Issue Date" hint="Date of authorization.">
              <input
                type="date"
                value={issueDate}
                disabled={readOnly}
                onChange={(e) => setIssueDate(e.target.value)}
                className={inputClass}
              />
            </FormField>

            <FormField label="Expiry Date" hint="Date of validity expiry.">
              <input
                type="date"
                value={expiryDate}
                disabled={readOnly}
                onChange={(e) => setExpiryDate(e.target.value)}
                className={inputClass}
              />
            </FormField>

            <FormField label="Permit Status" hint="Current validity standing.">
              <select
                value={permitStatus}
                disabled={readOnly}
                onChange={(e) => setPermitStatus(e.target.value)}
                className={inputClass}
              >
                {['Valid', 'Expiring within 90 days', 'Expired', 'Renewal in progress'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Inspection Date" hint="Most recent regulatory inspection.">
              <input
                type="date"
                value={inspectionDate}
                disabled={readOnly}
                onChange={(e) => setInspectionDate(e.target.value)}
                className={inputClass}
              />
            </FormField>

            <FormField label="Inspection Findings" hint="Actual findings from regulatory officer." full>
              <textarea
                value={inspectionFindings}
                disabled={readOnly}
                onChange={(e) => setInspectionFindings(e.target.value)}
                placeholder="e.g. Site visited by Regional Officer; greenbelt and dust control found satisfactory."
                className={inputClass + ' min-h-[50px] resize-y'}
              />
            </FormField>

            <FormField label="Non-compliance Identified" hint="Yes / No / Under assessment.">
              <select
                value={nonComplianceIdentified}
                disabled={readOnly}
                onChange={(e) => setNonComplianceIdentified(e.target.value)}
                className={inputClass}
              >
                {['No', 'Yes', 'Under assessment'].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Responsible Owner" hint="Assigned person or role.">
              <input
                value={responsibleOwner}
                disabled={readOnly}
                onChange={(e) => setResponsibleOwner(e.target.value)}
                placeholder="e.g. Site Environmental Lead / VP Legal"
                className={inputClass}
              />
            </FormField>

            <FormField label="Corrective Action" hint="Action taken or planned if non-compliance." full>
              <input
                value={correctiveAction}
                disabled={readOnly}
                onChange={(e) => setCorrectiveAction(e.target.value)}
                placeholder="e.g. Quarterly ambient air and ZLD monitoring reports submitted to PCB portal."
                className={inputClass}
              />
            </FormField>

            <FormField label="Target Due Date" hint="Statutory closure deadline.">
              <input
                type="date"
                value={dueDate}
                disabled={readOnly}
                onChange={(e) => setDueDate(e.target.value)}
                className={inputClass}
              />
            </FormField>

            <FormField label="Actual Closure Date" hint="Date of confirmed closure.">
              <input
                type="date"
                value={closureDate}
                disabled={readOnly}
                onChange={(e) => setClosureDate(e.target.value)}
                className={inputClass}
              />
            </FormField>

            <FormField label="Supporting Evidence Remarks" hint="Document notes, register entry." full>
              <input
                value={supportingEvidence}
                disabled={readOnly}
                onChange={(e) => setSupportingEvidence(e.target.value)}
                placeholder="e.g. Statutory order copy and quarterly compliance return"
                className={inputClass}
              />
            </FormField>

            {/* In-Form Multi-Evidence Attach Section */}
            <div className="sm:col-span-2">
              <FormEvidenceAttachSection
                projectId={projectId}
                periodId={periodId}
                moduleKey="COMPLIANCE"
                evidence={evidence}
                onUploaded={onEvidenceUploaded || (async () => {})}
                selectedEvidenceIds={selectedEvidenceIds}
                onSelectEvidenceIds={setSelectedEvidenceIds}
                onReview={onReviewEvidence}
                readOnly={readOnly}
              />
            </div>

            {/* Live Expiry Preview Card */}
            <div className="sm:col-span-2 rounded-xl border border-teal-200/80 bg-teal-50/60 p-3 text-xs text-teal-900">
              <div className="flex items-center justify-between font-bold">
                <span className="flex items-center gap-1.5">
                  <FileCheck2 className="h-3.5 w-3.5 text-teal-600" /> Consent Validity Window
                </span>
                <span className="text-[10px] text-teal-700">Non-compliance: {nonComplianceIdentified}</span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-white/80 p-1.5">
                  <div className="text-[9px] uppercase text-slate-500 font-bold">Days to Expiry</div>
                  <div className="text-sm font-bold text-slate-900">
                    {daysRemaining > 0 ? `${daysRemaining} days` : 'Expired'}
                  </div>
                </div>
                <div className="rounded-lg bg-white/80 p-1.5">
                  <div className="text-[9px] uppercase text-slate-500 font-bold">Permit Status</div>
                  <div className="text-sm font-bold text-slate-900">{permitStatus}</div>
                </div>
                <div className="rounded-lg bg-white/80 p-1.5">
                  <div className="text-[9px] uppercase text-slate-500 font-bold">Authority</div>
                  <div className="text-sm font-bold text-slate-900">{issuingAuthority.split(' ')[0]}</div>
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
                    className="flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-teal-500/20 hover:bg-teal-700 transition disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{editingId ? 'Update Permit' : `+ Add ${permitConsentType.split('(')[0].trim()} (Draft)`}</span>
                  </button>
                  <span className="text-[11px] text-slate-500">
                    {stagedItems.length} authorization(s) currently staged
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleProceedToOrganize}
                  className="flex items-center gap-1.5 rounded-xl border border-teal-300 bg-white px-4 py-2 text-xs font-bold text-teal-700 shadow-xs hover:bg-teal-50 transition"
                >
                  <span>Next: Organize All Permits ({stagedItems.length})</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </FormGrid>

          {/* Staged Permits Table (Step 1) */}
          {stagedItems.length > 0 && (
            <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-3 shadow-xs">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ListOrdered className="h-4 w-4 text-teal-600" />
                  <span className="text-xs font-bold text-slate-800">
                    Staged Permits &amp; Authorizations ({stagedItems.length})
                  </span>
                </div>
                <span className="text-[10px] text-slate-500">
                  Click Edit to update inputs · Click eye to review evidence (flips card)
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200/80 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-2 pr-3">Permit Type</th>
                      <th className="py-2 px-3">Reference #</th>
                      <th className="py-2 px-3">Issuing Authority</th>
                      <th className="py-2 px-3">Expiry Date</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Attached Evidence</th>
                      <th className="py-2 pl-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stagedItems.map((item) => (
                      <tr key={item.id} className="hover:bg-teal-50/30 transition">
                        <td className="py-2.5 pr-3 font-semibold text-slate-800">
                          {item.permitConsentType}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700">
                          {item.permitNumber}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{item.issuingAuthority}</td>
                        <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                          {item.expiryDate || 'N/A'}{' '}
                          <span className="text-[10px] text-slate-400 font-sans">
                            ({item.daysRemaining > 0 ? `${item.daysRemaining}d` : 'Expired'})
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                              item.permitStatus === 'Valid'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {item.permitStatus}
                          </span>
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
                              className="rounded-lg p-1 text-slate-500 hover:bg-teal-100 hover:text-teal-800 transition"
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
            <div className="rounded-2xl border border-teal-200/90 bg-gradient-to-br from-teal-50/80 to-white/90 p-3 shadow-2xs">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-teal-800">
                <span>Total Clearances</span>
                <ShieldCheck className="h-3.5 w-3.5 text-teal-600" />
              </div>
              <div className="mt-1 text-xl font-black text-slate-900">{summaryMetrics.total}</div>
              <div className="text-[10px] text-slate-500">Statutory authorizations</div>
            </div>

            <div className="rounded-2xl border border-emerald-200/90 bg-gradient-to-br from-emerald-50/80 to-white/90 p-3 shadow-2xs">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                <span>Compliance Rate</span>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <div className="mt-1 text-xl font-black text-emerald-600">
                {summaryMetrics.complianceRate}%
              </div>
              <div className="text-[10px] text-slate-500">{summaryMetrics.valid} valid consents</div>
            </div>

            <div className="rounded-2xl border border-amber-200/90 bg-gradient-to-br from-amber-50/80 to-white/90 p-3 shadow-2xs">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-amber-800">
                <span>Expiring Soon</span>
                <Clock className="h-3.5 w-3.5 text-amber-600" />
              </div>
              <div className="mt-1 text-xl font-black text-amber-600">{summaryMetrics.expiringSoon}</div>
              <div className="text-[10px] text-slate-500">Within 90-day window</div>
            </div>

            <div className="rounded-2xl border border-rose-200/90 bg-gradient-to-br from-rose-50/80 to-white/90 p-3 shadow-2xs">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-rose-800">
                <span>Non-compliances</span>
                <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
              </div>
              <div className="mt-1 text-xl font-black text-rose-600">{summaryMetrics.nonCompliant}</div>
              <div className="text-[10px] text-slate-500">Pending corrective actions</div>
            </div>
          </div>

          {/* Master Consolidated Breakdown Table */}
          <div className="rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-xs">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Consolidated Environmental Permits &amp; Compliance Portfolio
                </h4>
                <p className="text-[11px] text-slate-500">
                  Organized audit portfolio for SEBI BRSR Principle 6 statutory disclosures
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWorkflowStep(1)}
                className="flex items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-700 hover:bg-teal-100 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>+ Add Another Permit</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-2.5 pr-3">Permit Type</th>
                    <th className="py-2.5 px-3">Reference #</th>
                    <th className="py-2.5 px-3">Issuing Authority</th>
                    <th className="py-2.5 px-3">Validity Window</th>
                    <th className="py-2.5 px-3">Compliance Status</th>
                    <th className="py-2.5 px-3">Attached Documents</th>
                    <th className="py-2.5 pl-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stagedItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-2.5 pr-3 font-semibold text-slate-800">
                        {item.permitConsentType}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700">
                        {item.permitNumber}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{item.issuingAuthority}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                        {item.expiryDate || 'N/A'}{' '}
                        <span className="text-[10px] text-slate-400 font-sans">
                          ({item.daysRemaining > 0 ? `${item.daysRemaining}d` : 'Expired'})
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                            item.permitStatus === 'Valid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {item.permitStatus}
                        </span>
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
                      Portfolio Total ({stagedItems.length} Authorizations)
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">—</td>
                    <td className="py-2.5 px-3 text-slate-500">—</td>
                    <td className="py-2.5 px-3 text-teal-800">
                      {summaryMetrics.expiringSoon} Expiring Soon
                    </td>
                    <td className="py-2.5 px-3 text-emerald-700 font-bold">
                      {summaryMetrics.complianceRate}% Compliant
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
            nextLabel="Submit Permit Portfolio →"
          />
        </div>
      )}
    </div>
  )
}