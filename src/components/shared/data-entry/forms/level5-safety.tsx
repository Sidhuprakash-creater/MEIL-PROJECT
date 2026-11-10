'use client'

import { useEffect, useState } from 'react'
import { ShieldCheck, Save } from 'lucide-react'
import { inputClass, FormGrid, FormField, FormSaveActions, useDraftBucket, type LevelFormProps } from '../primitives'
import { type Period, useApiBase } from '../core'

/* ============================================================
   LEVEL 5: HEALTH & SAFETY FORM
   ============================================================ */

export function Level5SafetyForm({
  projectId,
  periodId,
  readOnly,
  formStateRef,
  onSaved,
}: LevelFormProps) {
  const apiBase = useApiBase()

  const key = `l5-${projectId}-${periodId}`
  const initial = useDraftBucket(formStateRef, key)

  const [reportingPeriod, setReportingPeriod] = useState(initial.reportingPeriod ?? 'FY 2026-27 (Annual)')
  const [workforceCategory, setWorkforceCategory] = useState(initial.workforceCategory ?? 'Employee')
  const [workforceCount, setWorkforceCount] = useState(initial.workforceCount ?? '4850')
  const [totalPersonHoursWorked, setTotalPersonHoursWorked] = useState(initial.totalPersonHoursWorked ?? '154000')
  const [incidentId, setIncidentId] = useState(initial.incidentId ?? 'INC-2026-EHS-001')
  const [incidentDateTime, setIncidentDateTime] = useState(initial.incidentDateTime ?? '2026-06-18T14:30')
  const [incidentType, setIncidentType] = useState(initial.incidentType ?? 'First-aid injury')
  const [incidentSeverity, setIncidentSeverity] = useState(initial.incidentSeverity ?? 'Minor')
  const [daysLost, setDaysLost] = useState(initial.daysLost ?? '0')
  const [fatalityDisability, setFatalityDisability] = useState(initial.fatalityDisability ?? 'None')
  const [incidentDescription, setIncidentDescription] = useState(initial.incidentDescription ?? 'Minor finger abrasion during rebar placement; first aid rendered at site medical post.')
  const [immediateAction, setImmediateAction] = useState(initial.immediateAction ?? 'Immediate antiseptic dressing applied; verified PPE Cut-Level 5 glove compliance.')
  const [rootCause, setRootCause] = useState(initial.rootCause ?? 'Glove wear-and-tear during high-tensile steel wire tying.')
  const [correctiveAction, setCorrectiveAction] = useState(initial.correctiveAction ?? 'Upgraded to Cut-Level 5 kevlar gloves across batching yard; zero lost time; LTIFR = 0.14.')
  const [closureEvidence, setClosureEvidence] = useState(initial.closureEvidence ?? 'Signed site safety officer closure report & medical fitness certificate')
  const [supportingDocument, setSupportingDocument] = useState(initial.supportingDocument ?? 'EHS-SAFETY-MUSTER-LOG-2026.pdf')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    formStateRef.current[key] = {
      reportingPeriod, workforceCategory, workforceCount, totalPersonHoursWorked,
      incidentId, incidentDateTime, incidentType, incidentSeverity, daysLost,
      fatalityDisability, incidentDescription, immediateAction, rootCause,
      correctiveAction, closureEvidence, supportingDocument,
    }
  }, [
    key, reportingPeriod, workforceCategory, workforceCount, totalPersonHoursWorked,
    incidentId, incidentDateTime, incidentType, incidentSeverity, daysLost,
    fatalityDisability, incidentDescription, immediateAction, rootCause,
    correctiveAction, closureEvidence, supportingDocument, formStateRef,
  ])

  const mhw = Number(totalPersonHoursWorked) || 0
  const isLti = incidentType.toLowerCase().includes('lost-time') || incidentType.toLowerCase().includes('lti')
  const ltifr = mhw > 0 ? (((isLti ? 1 : 0) * 1000000) / mhw).toFixed(3) : '0.000'

  const save = async (submitForReview = false) => {
    setError('')
    if (!totalPersonHoursWorked || Number(totalPersonHoursWorked) <= 0) {
      setError('Total person-hours worked must be > 0')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`${apiBase}/data-entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 5,
          levelKey: 'level5',
          levelName: 'Level 5 — Health & Safety',
          module: 'SAFETY',
          projectId,
          reportingPeriodId: periodId,
          data: formStateRef.current[key],
          submitForReview,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Failed to save Safety record')
      onSaved(d.record, submitForReview)
    } catch (e: any) {
      setError(e?.message || 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <FormGrid>
      <FormField label="Reporting Period" hint="Month / quarter / year.">
        <input
          value={reportingPeriod}
          disabled={readOnly}
          onChange={(e) => setReportingPeriod(e.target.value)}
          className={inputClass}
        />
      </FormField>

      <FormField label="Workforce Category" hint="Employee / contract worker / other.">
        <select
          value={workforceCategory}
          disabled={readOnly}
          onChange={(e) => setWorkforceCategory(e.target.value)}
          className={inputClass}
        >
          {['Employee', 'Contract worker', 'Apprentice / Trainee', 'Other'].map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Workforce Count" hint="Aggregated count in this category.">
        <input
          type="number"
          value={workforceCount}
          disabled={readOnly}
          onChange={(e) => setWorkforceCount(e.target.value)}
          placeholder="e.g. 185"
          className={inputClass}
        />
      </FormField>

      <FormField label="Total Person-hours Worked" hint="Approved muster roll source record.">
        <input
          type="number"
          min="0"
          value={totalPersonHoursWorked}
          disabled={readOnly}
          onChange={(e) => setTotalPersonHoursWorked(e.target.value)}
          placeholder="e.g. 48600"
          className={inputClass}
        />
      </FormField>

      <FormField label="Incident ID" hint="System-generated reference ID.">
        <input
          value={incidentId}
          disabled={readOnly}
          onChange={(e) => setIncidentId(e.target.value)}
          className={inputClass}
        />
      </FormField>

      <FormField label="Incident Date & Time" hint="Actual occurrence timestamp.">
        <input
          type="datetime-local"
          value={incidentDateTime}
          disabled={readOnly}
          onChange={(e) => setIncidentDateTime(e.target.value)}
          className={inputClass}
        />
      </FormField>

      <FormField label="Incident Type" hint="Injury, lost-time, near miss, fatality.">
        <select
          value={incidentType}
          disabled={readOnly}
          onChange={(e) => setIncidentType(e.target.value)}
          className={inputClass}
        >
          {['Near miss', 'First-aid injury', 'Lost-time injury', 'Medical treatment', 'Fatality'].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Incident Severity" hint="Classification level.">
        <select
          value={incidentSeverity}
          disabled={readOnly}
          onChange={(e) => setIncidentSeverity(e.target.value)}
          className={inputClass}
        >
          {['Minor', 'Moderate', 'Serious', 'Critical / Fatal'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Days Lost" hint="Where applicable (lost workdays).">
        <input
          type="number"
          value={daysLost}
          disabled={readOnly}
          onChange={(e) => setDaysLost(e.target.value)}
          placeholder="0"
          className={inputClass}
        />
      </FormField>

      <FormField label="Fatality / Disability" hint="Incident consequence.">
        <select
          value={fatalityDisability}
          disabled={readOnly}
          onChange={(e) => setFatalityDisability(e.target.value)}
          className={inputClass}
        >
          {['None', 'Temporary disability', 'Permanent disability', 'Fatality'].map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Incident Description" hint="Factual summary of event." full>
        <textarea
          value={incidentDescription}
          disabled={readOnly}
          onChange={(e) => setIncidentDescription(e.target.value)}
          placeholder="e.g. Scaffolding slip during night shift; harness prevented fall."
          className={inputClass + ' min-h-[50px] resize-y'}
        />
      </FormField>

      <FormField label="Immediate Action" hint="Action taken on the spot.">
        <input
          value={immediateAction}
          disabled={readOnly}
          onChange={(e) => setImmediateAction(e.target.value)}
          placeholder="e.g. Work stopped; safety review conducted"
          className={inputClass}
        />
      </FormField>

      <FormField label="Root Cause" hint="When established.">
        <input
          value={rootCause}
          disabled={readOnly}
          onChange={(e) => setRootCause(e.target.value)}
          placeholder="e.g. Unanchored scaffolding plank"
          className={inputClass}
        />
      </FormField>

      <FormField label="Corrective Action" hint="Remediation and target completion." full>
        <input
          value={correctiveAction}
          disabled={readOnly}
          onChange={(e) => setCorrectiveAction(e.target.value)}
          placeholder="e.g. Toolbox training + mandatory tag verification by 2026-06-30"
          className={inputClass}
        />
      </FormField>

      <FormField label="Closure Evidence" hint="Inspection sign-off memo.">
        <input
          value={closureEvidence}
          disabled={readOnly}
          onChange={(e) => setClosureEvidence(e.target.value)}
          placeholder="e.g. Signed closure sign-off memo"
          className={inputClass}
        />
      </FormField>

      <FormField label="Supporting Document" hint="Incident report, work-hour register.">
        <input
          value={supportingDocument}
          disabled={readOnly}
          onChange={(e) => setSupportingDocument(e.target.value)}
          placeholder="e.g. Incident Report IR-2026-08"
          className={inputClass}
        />
      </FormField>

      {/* Live Preview Card */}
      <div className="sm:col-span-2 rounded-xl border border-rose-200/80 bg-rose-50/60 p-3 text-xs text-rose-900">
        <div className="flex items-center justify-between font-bold">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-rose-600" /> Safety Statistics Preview
          </span>
          <span className="text-[10px] text-rose-700">Man-hours: {mhw.toLocaleString()}</span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-white/80 p-1.5">
            <div className="text-[9px] uppercase text-slate-500 font-bold">Derived LTIFR</div>
            <div className="text-sm font-bold text-slate-900">{ltifr} /M</div>
          </div>
          <div className="rounded-lg bg-white/80 p-1.5">
            <div className="text-[9px] uppercase text-slate-500 font-bold">Days Lost</div>
            <div className="text-sm font-bold text-slate-900">{daysLost} days</div>
          </div>
          <div className="rounded-lg bg-white/80 p-1.5">
            <div className="text-[9px] uppercase text-slate-500 font-bold">Severity</div>
            <div className="text-sm font-bold text-slate-900">{incidentSeverity}</div>
          </div>
        </div>
      </div>

      <FormSaveActions error={error} submitting={submitting} readOnly={readOnly} onSave={() => save(false)} onSubmitForReview={() => save(true)} nextLabel="Submit Record →" />
    </FormGrid>
  )
}