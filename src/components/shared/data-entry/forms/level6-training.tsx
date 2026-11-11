'use client'

import { useEffect, useState } from 'react'
import { Users, Save } from 'lucide-react'
import { inputClass, FormGrid, FormField, FormSaveActions, useDraftBucket, type LevelFormProps } from '../primitives'
import { useApiBase } from '../core'

/* ============================================================
   LEVEL 6: TRAINING & WORKFORCE WELL-BEING FORM
   ============================================================ */

export function Level6TrainingForm({
  projectId,
  periodId,
  readOnly,
  formStateRef,
  onSaved,
}: LevelFormProps) {
  const apiBase = useApiBase()

  const key = `l6-${projectId}-${periodId}`
  const initial = useDraftBucket(formStateRef, key)

  const [trainingProgramme, setTrainingProgramme] = useState(initial.trainingProgramme ?? 'SEBI BRSR Human Rights, Code of Conduct & POSH Awareness')
  const [trainingCategory, setTrainingCategory] = useState(initial.trainingCategory ?? 'Human Rights')
  const [trainingDate, setTrainingDate] = useState(initial.trainingDate ?? '')
  const [duration, setDuration] = useState(initial.duration ?? '4')
  const [durationUnit, setDurationUnit] = useState(initial.durationUnit ?? 'Hours')
  const [numberOfSessions, setNumberOfSessions] = useState(initial.numberOfSessions ?? '6')
  const [participants, setParticipants] = useState(initial.participants ?? '120')
  const [participantCategory, setParticipantCategory] = useState(initial.participantCategory ?? 'Employee')
  const [trainerAgency, setTrainerAgency] = useState(initial.trainerAgency ?? 'Corporate Compliance & HR Institute (NICMAR / In-house EHS)')
  const [attendanceStatus, setAttendanceStatus] = useState(initial.attendanceStatus ?? 'Completed')
  const [assessmentResult, setAssessmentResult] = useState(initial.assessmentResult ?? '100% Passed (Avg Score: 94%)')
  const [supportingEvidence, setSupportingEvidence] = useState(initial.supportingEvidence ?? 'Signed LMS Attendance Sheet & Pre/Post Assessment Log')
  const [remarks, setRemarks] = useState(initial.remarks ?? '94.2% permanent employees (4,568 persons) and 88.6% workers (18,668 persons) covered across entity.')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    formStateRef.current[key] = {
      trainingProgramme, trainingCategory, trainingDate, duration, durationUnit,
      numberOfSessions, participants, participantCategory, trainerAgency,
      attendanceStatus, assessmentResult, supportingEvidence, remarks,
    }
  }, [
    key, trainingProgramme, trainingCategory, trainingDate, duration, durationUnit,
    numberOfSessions, participants, participantCategory, trainerAgency,
    attendanceStatus, assessmentResult, supportingEvidence, remarks, formStateRef,
  ])

  const pCount = Number(participants) || 0
  const dur = Number(duration) || 0
  const durHrs = durationUnit === 'Minutes' ? dur / 60 : dur
  const totalPersonHrs = (pCount * durHrs).toFixed(1)

  const save = async (submitForReview = false) => {
    setError('')
    if (!trainingProgramme) {
      setError('Training programme name is required')
      return
    }
    if (!participants || Number(participants) <= 0) {
      setError('Participants count must be > 0')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`${apiBase}/data-entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 6,
          levelKey: 'level6',
          levelName: 'Level 6 — Training & Workforce Well-being',
          module: 'TRAINING',
          projectId,
          reportingPeriodId: periodId,
          data: formStateRef.current[key],
          submitForReview,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Failed to save Training record')
      onSaved({ ...d.record, duplicateRecord: d.duplicateRecord ?? null }, submitForReview)
    } catch (e: any) {
      setError(e?.message || 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <FormGrid>
      <FormField label="Training Programme" hint="Course or workshop name.">
        <input
          value={trainingProgramme}
          disabled={readOnly}
          onChange={(e) => setTrainingProgramme(e.target.value)}
          placeholder="e.g. Scaffolding & Working at Heights Safety"
          className={inputClass}
        />
      </FormField>

      <FormField label="Training Category" hint="Safety, technical skills, emergency.">
        <select
          value={trainingCategory}
          disabled={readOnly}
          onChange={(e) => setTrainingCategory(e.target.value)}
          className={inputClass}
        >
          {['Safety', 'Technical skills', 'Emergency preparedness', 'Human Rights', 'Well-being', 'Other'].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Training Date" hint="Date conducted.">
        <input
          type="date"
          value={trainingDate}
          disabled={readOnly}
          onChange={(e) => setTrainingDate(e.target.value)}
          className={inputClass}
        />
      </FormField>

      <FormField label="Duration" hint="Length of session.">
        <div className="flex gap-2">
          <input
            type="number"
            min="0"
            step="any"
            value={duration}
            disabled={readOnly}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="4"
            className={inputClass}
          />
          <select
            value={durationUnit}
            disabled={readOnly}
            onChange={(e) => setDurationUnit(e.target.value)}
            className={inputClass + ' w-28'}
          >
            <option value="Hours">Hours</option>
            <option value="Minutes">Minutes</option>
          </select>
        </div>
      </FormField>

      <FormField label="Number of Sessions" hint="Actual batch/session count.">
        <input
          type="number"
          min="1"
          value={numberOfSessions}
          disabled={readOnly}
          onChange={(e) => setNumberOfSessions(e.target.value)}
          placeholder="1"
          className={inputClass}
        />
      </FormField>

      <FormField label="Participants Count" hint="Total attendance headcount.">
        <input
          type="number"
          min="1"
          value={participants}
          disabled={readOnly}
          onChange={(e) => setParticipants(e.target.value)}
          placeholder="e.g. 45"
          className={inputClass}
        />
      </FormField>

      <FormField label="Participant Category" hint="Employee / contract worker / other.">
        <select
          value={participantCategory}
          disabled={readOnly}
          onChange={(e) => setParticipantCategory(e.target.value)}
          className={inputClass}
        >
          {['Employee', 'Contract worker', 'Apprentice', 'Other'].map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Trainer / Agency" hint="In-house or external trainer name.">
        <input
          value={trainerAgency}
          disabled={readOnly}
          onChange={(e) => setTrainerAgency(e.target.value)}
          placeholder="e.g. National Safety Council Lead / EHS Officer"
          className={inputClass}
        />
      </FormField>

      <FormField label="Attendance Status" hint="Completed / partial / absent.">
        <select
          value={attendanceStatus}
          disabled={readOnly}
          onChange={(e) => setAttendanceStatus(e.target.value)}
          className={inputClass}
        >
          {['Completed', 'Partial', 'Absent', 'Rescheduled'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Assessment Result" hint="Where applicable (Passed, Certified).">
        <input
          value={assessmentResult}
          disabled={readOnly}
          onChange={(e) => setAssessmentResult(e.target.value)}
          placeholder="e.g. 100% Passed (Avg Score: 92%)"
          className={inputClass}
        />
      </FormField>

      <FormField label="Supporting Evidence" hint="Attendance sheet, training report.">
        <input
          value={supportingEvidence}
          disabled={readOnly}
          onChange={(e) => setSupportingEvidence(e.target.value)}
          placeholder="e.g. Signed Attendance Sheet & Photo Log"
          className={inputClass}
        />
      </FormField>

      <FormField label="Remarks" hint="Additional context or feedback.">
        <input
          value={remarks}
          disabled={readOnly}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="e.g. Conducted in Telugu and Hindi for worker clarity."
          className={inputClass}
        />
      </FormField>

      {/* Live Preview Card */}
      <div className="sm:col-span-2 rounded-xl border border-indigo-200/80 bg-indigo-50/60 p-3 text-xs text-indigo-900">
        <div className="flex items-center justify-between font-bold">
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-indigo-600" /> Training Volume Metrics
          </span>
          <span className="text-[10px] text-indigo-700">Category: {trainingCategory}</span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-white/80 p-1.5">
            <div className="text-[9px] uppercase text-slate-500 font-bold">Person-Hours</div>
            <div className="text-sm font-bold text-slate-900">{totalPersonHrs} hrs</div>
          </div>
          <div className="rounded-lg bg-white/80 p-1.5">
            <div className="text-[9px] uppercase text-slate-500 font-bold">Trained</div>
            <div className="text-sm font-bold text-slate-900">{pCount} participants</div>
          </div>
          <div className="rounded-lg bg-white/80 p-1.5">
            <div className="text-[9px] uppercase text-slate-500 font-bold">Duration</div>
            <div className="text-sm font-bold text-slate-900">{durHrs} hours</div>
          </div>
        </div>
      </div>

      <FormSaveActions error={error} submitting={submitting} readOnly={readOnly} onSave={() => save(false)} onSubmitForReview={() => save(true)} nextLabel="Submit Record →" />
    </FormGrid>
  )
}