'use client'
import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2, AlertTriangle, AlertCircle, ShieldAlert,
  Send, RefreshCw, X, ArrowRight, ShieldCheck, Sparkles, FileText
} from 'lucide-react'
import {
  contributorStore,
  type ContributorRoleKey,
  type ValidationItem
} from '@/lib/so/contributor-store'
import { useApp } from '@/components/site-ops/context'

interface CommonValidationModalProps {
  isOpen: boolean
  onClose: () => void
  roleKey: ContributorRoleKey
  levelName: string
  onSubmitSuccess?: () => void
}

/** Flatten one workspace dataset section into scalar review fields so the
 *  Project Admin review window shows the contributor's real entries. */
const flattenRecord = (label: string, obj: unknown, out: Record<string, unknown>) => {
  if (!obj || typeof obj !== 'object') return
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (v === null || v === undefined || k === 'id' || k === 'common') continue
    if (Array.isArray(v)) {
      if (v.length > 0) out[`${label} · ${k} (count)`] = v.length
      continue
    }
    if (typeof v === 'object') {
      flattenRecord(`${label} ${k}`, v, out)
      continue
    }
    out[`${label} · ${k}`] = v
  }
}

export function CommonValidationModal({
  isOpen,
  onClose,
  roleKey,
  levelName,
  onSubmitSuccess
}: CommonValidationModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submissionSuccess, setSubmissionSuccess] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const { selectedProjectId } = useApp()
  /* Most recent OPEN reporting period (mirrors the PU data-entry default). */
  const [periodId, setPeriodId] = useState('')

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    fetch('/api/so/organization/tree')
      .then((r) => (r.ok ? r.json() : null))
      .then((tr) => {
        if (cancelled || !tr) return
        const periods: any[] = tr?.periods || []
        const open = periods.filter((p) => p.status === 'OPEN')
        const pick = open[open.length - 1] || periods[periods.length - 1]
        if (pick?.id) setPeriodId(pick.id)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [isOpen])

  const validationResult = contributorStore.validateRole(roleKey)

  /* Build the submission payload from the contributor's REAL workspace data
     (previously this sent a hardcoded demo payload, so nothing the user
     entered ever reached the Project Admin). */
  const buildRolePayload = (): { module: string; level: number; data: Record<string, unknown> } => {
    const flat: Record<string, unknown> = {}
    const F = (obj: unknown, label: string) => flattenRecord(label, obj, flat)

    if (roleKey === 'HR_USER') {
      const hr = contributorStore.getHrData()
      F(hr.workforceProfile, 'Workforce profile')
      F(hr.diversity, 'Diversity')
      F(hr.turnover, 'Hiring & turnover')
      F(hr.training, 'Training & development')
      F(hr.reviews, 'Performance reviews')
      F(hr.benefits, 'Employee benefits')
      F(hr.wages, 'Wages & remuneration')
      F(hr.grievances, 'Grievances & human rights')
      F(hr.safetyCoord, 'Safety coordination')
      return {
        module: 'HR',
        level: 6,
        data: {
          trainingProgramme: 'Health, Safety & ESG Capability Development',
          participants: Number((hr.training as any)?.participantsCompleting ?? 0) || undefined,
          duration: Number((hr.training as any)?.durationHours ?? 0) || undefined,
          durationUnit: 'Hours',
          ...flat,
          remarks: 'Submitted from HR Contributor Workspace — live workspace dataset attached.',
        },
      }
    }
    if (roleKey === 'EHS_USER') {
      const ehs = contributorStore.getEhsData()
      F(ehs.energy, 'Energy consumption')
      F(ehs.water, 'Water management')
      F(ehs.ghg, 'GHG emissions')
      F(ehs.waste, 'Waste management')
      F(ehs.safety, 'Safety incidents')
      F(ehs.permits, 'Compliance permits')
      F(ehs.incidents, 'Environmental incidents')
      F(ehs.initiatives, 'Sustainability initiatives')
      return {
        module: 'SAFETY',
        level: 5,
        data: {
          incidentType: 'Workspace Safety & Environment Submission',
          severity: 'Reported',
          personHoursWorked: Number((ehs.safety as any)?.personHoursWorked ?? (ehs.safety as any)?.totalPersonHours ?? 0) || undefined,
          lostTimeInjuries: Number((ehs.safety as any)?.lostTimeInjuries ?? (ehs.safety as any)?.lti ?? 0),
          ...flat,
          remarks: 'Submitted from EHS Contributor Workspace — live workspace dataset attached.',
        },
      }
    }
    if (roleKey === 'PROCUREMENT_USER') {
      const sc = contributorStore.getScData()
      F(sc.supplierMaster, 'Supplier master')
      F(sc.spend, 'Procurement spend')
      F(sc.assessment, 'Supplier ESG assessment')
      F(sc.certifications, 'Supplier certifications')
      F(sc.codeOfConduct, 'Code of conduct')
      F(sc.audits, 'Supplier audits')
      F(sc.valueChain, 'Value chain')
      return {
        module: 'PROCUREMENT',
        level: 9,
        data: {
          activityInitiativeName: 'Sustainable Procurement & Supplier ESG Program',
          ...flat,
          remarks: 'Submitted from Procurement Contributor Workspace — live workspace dataset attached.',
        },
      }
    }
    if (roleKey === 'CSR_USER') {
      const csr = contributorStore.getCsrData()
      F(csr.projectMaster, 'CSR project master')
      F(csr.activities, 'Activities & beneficiaries')
      F(csr.expenditure, 'Expenditure references')
      F(csr.outcomes, 'Project outcomes')
      F(csr.grievances, 'Community grievances')
      F(csr.sia, 'Social impact assessment')
      F(csr.rr, 'Rehabilitation & resettlement')
      return {
        module: 'CSR',
        level: 8,
        data: {
          dateReported: new Date().toISOString().slice(0, 10),
          description: String((csr.projectMaster as any)?.projectName ?? 'CSR Community Programme Submission'),
          impactSeverity: 'Positive Impact',
          currentStatus: String((csr.projectMaster as any)?.status ?? 'Active'),
          ...flat,
          remarks: 'Submitted from CSR Contributor Workspace — live workspace dataset attached.',
        },
      }
    }
    // COMPLIANCE_USER
    const gov = contributorStore.getGovData()
    F(gov.policies, 'Policy register')
    F(gov.implementation, 'Policy implementation')
    F(gov.ethics, 'Business ethics')
    F(gov.whistleblower, 'Whistleblower & grievances')
    F(gov.compliance, 'Regulatory compliance')
    F(gov.humanRights, 'Human rights')
    F(gov.oversight, 'Governance oversight')
    return {
      module: 'COMPLIANCE',
      level: 7,
      data: {
        permitNumber: String((gov.compliance as any)?.permitNumber ?? (gov.compliance as any)?.consentNumber ?? 'GOV-COMPLIANCE-REGISTER'),
        authority: String((gov.compliance as any)?.authority ?? 'Regulatory Authority'),
        complianceStatus: String((gov.compliance as any)?.status ?? 'Fully Compliant'),
        ...flat,
        remarks: 'Submitted from Governance & Compliance Contributor Workspace — live workspace dataset attached.',
      },
    }
  }

  const handleConfirmSubmit = async () => {
    if (!validationResult.passed) return

    setIsSubmitting(true)
    setSubmitError('')
    try {
      const cfg = buildRolePayload()
      const res = await fetch('/api/so/data-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: cfg.level,
          levelKey: `level${cfg.level}`,
          levelName,
          module: cfg.module,
          projectId: selectedProjectId || undefined,
          reportingPeriodId: periodId || undefined,
          data: cfg.data,
          submitForReview: true,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || `Submission failed (${res.status})`)
      }

      // Add activity event
      contributorStore.addActivity({
        id: 'act-' + Date.now(),
        roleKey,
        timestamp: 'Just now',
        user: 'Enterprise Contributor',
        action: 'Submitted',
        target: levelName,
        details: `Submitted for Level-1 Reviewer Sign-off. 0 blocking errors, ${validationResult.warningCount} warnings noted.`,
        badgeTone: 'green'
      })

      // Update primary assignment status
      const assignments = contributorStore.getAssignments(roleKey)
      if (assignments.length > 0) {
        contributorStore.updateAssignmentStatus(assignments[0].id, 'Submitted', 100)
      }

      setIsSubmitting(false)
      setSubmissionSuccess(true)
      onSubmitSuccess?.()
    } catch (e) {
      setIsSubmitting(false)
      setSubmitError(e instanceof Error ? e.message : 'Submission failed. Please try again.')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-xl overflow-hidden so-glass-ios-liquid rounded-[28px] p-6"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${
              validationResult.passed ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
            }`}>
              {validationResult.passed ? (
                <ShieldCheck className="h-5 w-5" />
              ) : (
                <ShieldAlert className="h-5 w-5" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Pre-Submission Validation Engine
              </h3>
              <p className="text-xs text-slate-500">
                {levelName} · Automated BRSR Core Rule Verification
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-white/80 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {submissionSuccess ? (
          <div className="py-8 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-md">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h4 className="text-lg font-bold text-slate-900">
                Submitted Successfully for Review!
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Your data records, calculated intensities, and linked evidence documents have been packaged
                and submitted to the BU ESG Reviewer for verification.
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 max-w-md mx-auto">
              <span className="font-semibold text-slate-800">Next Step: </span>
              The reviewer will verify compliance against BRSR Core principles. You can monitor progress on your Submissions tab.
            </div>
            <button
              type="button"
              onClick={onClose}
              className="ios-btn-ghost !border-emerald-300 !text-emerald-800 hover:!text-emerald-900"
            >
              Return to Workspace
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-4 text-xs">
            {/* Submission error (real API failure) */}
            {submitError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3 text-xs font-semibold text-rose-800">
                {submitError}
              </div>
            )}

            {/* Summary Banner */}
            <div className={`rounded-xl p-3.5 border ${
              validationResult.passed
                ? 'border-emerald-200 bg-emerald-50/60 text-emerald-900'
                : 'border-rose-200 bg-rose-50/60 text-rose-900'
            }`}>
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm">
                  {validationResult.passed
                    ? 'All Critical Validation Rules Passed'
                    : `${validationResult.blockingCount} Blocking Error(s) Detected`}
                </span>
                <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-bold">
                  {validationResult.warningCount} Warning(s)
                </span>
              </div>
              <p className="text-xs mt-1 text-slate-600">
                {validationResult.passed
                  ? 'Data integrity, period consistency, and arithmetic reconciliation are verified. Ready for reviewer sign-off.'
                  : 'Please resolve the blocking errors below before submitting to the review queue.'}
              </p>
            </div>

            {/* Validation Checklist Items */}
            <div className="max-h-[260px] overflow-y-auto space-y-2 pr-1">
              {validationResult.items.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-xl border p-3 flex items-start justify-between gap-3 ${
                    item.passed
                      ? 'border-emerald-100 bg-emerald-50/20'
                      : item.type === 'blocking'
                      ? 'border-rose-200 bg-rose-50/30'
                      : 'border-amber-200 bg-amber-50/30'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5">
                      {item.passed ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : item.type === 'blocking' ? (
                        <AlertCircle className="h-4 w-4 text-rose-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-800">{item.category}:</span>
                        <span className="text-slate-700">{item.description}</span>
                      </div>
                      {!item.passed && item.fixAction && (
                        <div className="text-[11px] font-semibold text-rose-700 mt-1">
                          Fix required: {item.fixAction}
                        </div>
                      )}
                    </div>
                  </div>

                  <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                    item.passed
                      ? 'bg-emerald-100 text-emerald-800'
                      : item.type === 'blocking'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {item.passed ? 'PASS' : item.type}
                  </span>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="ios-btn-ghost"
              >
                Close & Return
              </button>

              <button
                type="button"
                disabled={!validationResult.passed || isSubmitting}
                onClick={handleConfirmSubmit}
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-lg transition-all ${
                  validationResult.passed
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/25 cursor-pointer'
                    : 'bg-slate-300 cursor-not-allowed shadow-none'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Submitting to Review Queue...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>Submit for Review</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
