'use client'

import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { inputClass, FormGrid, FormField, FormSaveActions, useDraftBucket, type LevelFormProps } from '../primitives'
import { type Project, useApiBase } from '../core'

/* ============================================================
   LEVEL 8: ENVIRONMENTAL INCIDENTS & COMMUNITY GRIEVANCES FORM
   ============================================================ */

export function Level8IncidentsForm({
  projectId,
  periodId,
  readOnly,
  formStateRef,
  onSaved,
}: LevelFormProps) {
  const apiBase = useApiBase()

  const key = `l8-${projectId}-${periodId}`
  const initial = useDraftBucket(formStateRef, key)

  const [recordType, setRecordType] = useState(initial.recordType ?? 'Community grievance')
  const [incidentGrievanceId, setIncidentGrievanceId] = useState(initial.incidentGrievanceId ?? 'GRV-2026-002')
  const [dateReported, setDateReported] = useState(initial.dateReported ?? '')
  const [category, setCategory] = useState(initial.category ?? 'Dust')
  const [siteAffectedArea, setSiteAffectedArea] = useState(initial.siteAffectedArea ?? 'Village perimeter near Project Canal Reach KM 14+500')
  const [description, setDescription] = useState(initial.description ?? 'Local community query regarding drainage diversion during monsoon excavation.')
  const [impactSeverity, setImpactSeverity] = useState(initial.impactSeverity ?? 'Low')
  const [actionTaken, setActionTaken] = useState(initial.actionTaken ?? 'Engineered culvert drainage channel constructed and dust water-bowsers deployed.')
  const [rootCause, setRootCause] = useState(initial.rootCause ?? 'Seasonal heavy downpour water accumulation near peripheral access road.')
  const [responsibleOwner, setResponsibleOwner] = useState(initial.responsibleOwner ?? 'P. Ramesh (Site Project Director)')
  const [dueDate, setDueDate] = useState(initial.dueDate ?? '')
  const [currentStatus, setCurrentStatus] = useState(initial.currentStatus ?? 'Resolved')
  const [resolutionDate, setResolutionDate] = useState(initial.resolutionDate ?? '')
  const [supportingEvidence, setSupportingEvidence] = useState(initial.supportingEvidence ?? 'VILLAGE-PANCHAYAT-NOC-CLOSURE.pdf')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    formStateRef.current[key] = {
      recordType, incidentGrievanceId, dateReported, category, siteAffectedArea,
      description, impactSeverity, actionTaken, rootCause, responsibleOwner,
      dueDate, currentStatus, resolutionDate, supportingEvidence,
    }
  }, [
    key, recordType, incidentGrievanceId, dateReported, category, siteAffectedArea,
    description, impactSeverity, actionTaken, rootCause, responsibleOwner,
    dueDate, currentStatus, resolutionDate, supportingEvidence, formStateRef,
  ])

  const save = async (submitForReview = false) => {
    setError('')
    if (!dateReported) {
      setError('Date reported is required')
      return
    }
    if (!description) {
      setError('Factual description is required')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`${apiBase}/data-entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 8,
          levelKey: 'level8',
          levelName: 'Level 8 — Environmental Incidents & Community Grievances',
          module: 'INCIDENTS',
          projectId,
          reportingPeriodId: periodId,
          data: formStateRef.current[key],
          submitForReview,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Failed to save Incident record')
      onSaved(d.record, submitForReview)
    } catch (e: any) {
      setError(e?.message || 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <FormGrid>
      <FormField label="Record Type" hint="Incident or grievance.">
        <select
          value={recordType}
          disabled={readOnly}
          onChange={(e) => setRecordType(e.target.value)}
          className={inputClass}
        >
          <option value="Environmental incident">Environmental incident</option>
          <option value="Community grievance">Community grievance</option>
        </select>
      </FormField>

      <FormField label="Incident or Grievance ID" hint="Unique system reference.">
        <input
          value={incidentGrievanceId}
          disabled={readOnly}
          onChange={(e) => setIncidentGrievanceId(e.target.value)}
          className={inputClass}
        />
      </FormField>

      <FormField label="Date Reported" hint="Date received or recorded.">
        <input
          type="date"
          value={dateReported}
          disabled={readOnly}
          onChange={(e) => setDateReported(e.target.value)}
          className={inputClass}
        />
      </FormField>

      <FormField label="Category" hint="Spill, dust, noise, pollution, complaint.">
        <select
          value={category}
          disabled={readOnly}
          onChange={(e) => setCategory(e.target.value)}
          className={inputClass}
        >
          {['Spill', 'Dust', 'Noise', 'Pollution', 'Complaint', 'Other'].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Site / Affected Area" hint="Relevant location or village.">
        <input
          value={siteAffectedArea}
          disabled={readOnly}
          onChange={(e) => setSiteAffectedArea(e.target.value)}
          placeholder="e.g. Chainage KM 42+200 adjacent to Gollapudi"
          className={inputClass}
        />
      </FormField>

      <FormField label="Impact / Severity" hint="Classification rating.">
        <select
          value={impactSeverity}
          disabled={readOnly}
          onChange={(e) => setImpactSeverity(e.target.value)}
          className={inputClass}
        >
          {['Low', 'Medium', 'High', 'Critical'].map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Description" hint="Factual details (omit personal PII)." full>
        <textarea
          value={description}
          disabled={readOnly}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Minor hydraulic oil drip contained with absorbent pads; no runoff to water bodies."
          className={inputClass + ' min-h-[50px] resize-y'}
        />
      </FormField>

      <FormField label="Action Taken" hint="Immediate response response taken.">
        <input
          value={actionTaken}
          disabled={readOnly}
          onChange={(e) => setActionTaken(e.target.value)}
          placeholder="e.g. Absorbent booms deployed immediately"
          className={inputClass}
        />
      </FormField>

      <FormField label="Root Cause" hint="If established.">
        <input
          value={rootCause}
          disabled={readOnly}
          onChange={(e) => setRootCause(e.target.value)}
          placeholder="e.g. Loose hydraulic hose fitting"
          className={inputClass}
        />
      </FormField>

      <FormField label="Responsible Owner" hint="Assigned role.">
        <input
          value={responsibleOwner}
          disabled={readOnly}
          onChange={(e) => setResponsibleOwner(e.target.value)}
          placeholder="e.g. Site EHS Officer"
          className={inputClass}
        />
      </FormField>

      <FormField label="Current Status" hint="Open / In progress / Resolved.">
        <select
          value={currentStatus}
          disabled={readOnly}
          onChange={(e) => setCurrentStatus(e.target.value)}
          className={inputClass}
        >
          {['Open', 'In progress', 'Resolved', 'Closed'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Due Date" hint="Target resolution date.">
        <input
          type="date"
          value={dueDate}
          disabled={readOnly}
          onChange={(e) => setDueDate(e.target.value)}
          className={inputClass}
        />
      </FormField>

      <FormField label="Resolution Date" hint="When resolved.">
        <input
          type="date"
          value={resolutionDate}
          disabled={readOnly}
          onChange={(e) => setResolutionDate(e.target.value)}
          className={inputClass}
        />
      </FormField>

      <FormField label="Supporting Evidence" hint="Incident report or grievance record." full>
        <input
          value={supportingEvidence}
          disabled={readOnly}
          onChange={(e) => setSupportingEvidence(e.target.value)}
          placeholder="e.g. Grievance Register Entry & Action Memo"
          className={inputClass}
        />
      </FormField>

      <FormSaveActions error={error} submitting={submitting} readOnly={readOnly} onSave={() => save(false)} onSubmitForReview={() => save(true)} nextLabel="Submit Record →" />
    </FormGrid>
  )
}