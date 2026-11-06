'use client'

/**
 * SubmissionReviewWindow — full-window, phase-by-phase submission review.
 *
 * ONE component, TWO portals:
 *   • Project Admin console (mode "admin")  — Data Collection Status → View.
 *     Everything the contributor submitted, laid out in numbered phases:
 *       Phase 1  Submitted-by contributor card
 *       Phase 2  Project & reporting-period card
 *       Phase 3  Captured summary (when present)
 *       Phase 4+ One card per emission/data level → fully-detailed sources →
 *                evidence tagged to its exact source.
 *     Read-only (nothing editable). Admin CLICKS any source/level/data card to
 *     mark it for rejection (MULTI-SELECT — every click adds to the list),
 *     adds an optional per-mark clarification, then submits one rejection.
 *   • PU portal (mode "mirror") — the contributor opens the same window on a
 *     returned submission and sees exactly what was marked: red cards with the
 *     reviewer's clarifications inline.
 *
 * Evidence: no secondary screen. Clicking an evidence chip shrinks the data
 * column and slides the document preview in on the right (inline preview +
 * download) so data and evidence are visible side by side.
 *
 * Design: iOS Liquid Glass — layered frosted surfaces, specular top sheen,
 * soft depth shadows and glass checkboxes/tray for the multi-select flow.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  X, ChevronLeft, User, Building2, Clock, AlertTriangle, Flag,
  FileText, Paperclip, Download, Check, CircleCheck, Copy, Layers, RefreshCcw,
  Inbox, ExternalLink, AlertOctagon, ListFilter,
} from 'lucide-react'
import { fieldLabel, fmtValue, itemFieldEntries, itemTitle } from '@/components/shared/field-labels'

/* ============================= Model types ============================= */

export interface ReviewEvidence {
  id: string
  fileName: string
  documentType?: string | null
  mimeType?: string | null
  fileSize?: number | null
  status?: string | null
}

export interface ReviewField {
  k: string
  v: unknown
}

export interface ReviewItem {
  key: string
  recordId: string
  levelName: string
  itemIndex: number
  title: string
  fields: ReviewField[]
  evidence: ReviewEvidence[]
  evidenceFileNames: string[]
}

export interface ReviewRecordCard {
  recordId: string
  level: number
  levelName: string
  recordStatus: string
  validationStatus: string
  calculation: {
    calculatedValue?: number
    resultUnit?: string
    scope?: string | null
    methodologyNote?: string | null
    factorVersion?: number | null
  } | null
  fields: ReviewField[]
  evidence: ReviewEvidence[]
  evidenceFileNames: string[]
  items: ReviewItem[]
}

export interface ReviewMark {
  target: string
  label: string
  severity: 'ERROR' | 'WARNING'
  note: string
  recordId: string
  by?: string
  at?: string
}

export interface ReviewModel {
  mode: 'admin' | 'mirror'
  title: string
  refCode?: string
  status: string
  statusLabel?: string
  categoryLabel?: string
  periodLabel?: string
  submittedAt?: string | null
  dueDate?: string | null
  overdue?: boolean
  completionPct?: number | null
  contributor: { name: string; email?: string | null; roleLabel: string }
  project: {
    name: string
    code?: string | null
    location?: string | null
    ptype?: string | null
    capacityMw?: number | null
    businessUnitName?: string | null
  }
  summary: Array<{ label: string; value: string | number; unit?: string }>
  records: ReviewRecordCard[]
  /* Mirror mode: marks resolved from the reviewer's corrections. */
  preMarks?: ReviewMark[]
  generalComment?: string | null
  reviewedByName?: string | null
  reviewedAt?: string | null
}

export interface RejectPayloadItem {
  field: string
  issue: string
  severity: 'ERROR' | 'WARNING'
  comment: string
  recordId: string
  target: string
}

/* ======================= Label + status helpers ======================== */

export const reviewLabelItem = (levelName: string, title: string, idx: number) =>
  `${levelName} · ${title} (item #${idx + 1})`

export const reviewLabelLevel = (levelName: string) => `${levelName} — entire emission level`

export const fmtDateTime = (iso?: string | null) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft', SUBMITTED: 'Submitted', PENDING: 'Pending', RESUBMITTED: 'Resubmitted',
  UNDER_REVIEW: 'Under Review', APPROVED: 'Approved', ACTIVE: 'Active', LOCKED: 'Locked',
  CORRECTION_REQUESTED: 'Correction Requested', CHANGES_REQUESTED: 'Returned for Changes', REJECTED: 'Rejected',
  NOT_STARTED: 'Not Started', RETURNED: 'Returned for Changes',
}

const statusTone = (status: string): { chip: string; dot: string } => {
  const s = (status || '').toUpperCase()
  if (['APPROVED', 'ACTIVE', 'SUBMITTED'].includes(s)) return { chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' }
  if (['DRAFT'].includes(s)) return { chip: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' }
  if (['RETURNED', 'CHANGES_REQUESTED', 'CORRECTION_REQUESTED', 'REJECTED'].includes(s)) return { chip: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' }
  if (['UNDER_REVIEW', 'PENDING', 'RESUBMITTED'].includes(s)) return { chip: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' }
  return { chip: 'bg-slate-50 text-slate-600 border-slate-200', dot: 'bg-slate-400' }
}

const recStatusTone = (s?: string) => {
  const v = (s || '').toUpperCase()
  if (v === 'CORRECTION_REQUESTED') return 'bg-rose-50 text-rose-700 border-rose-200'
  if (v === 'APPROVED' || v === 'ACTIVE') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  return 'bg-slate-50 text-slate-600 border-slate-200'
}

const initials = (name: string) =>
  (name || '?').split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('') || '?'

const fmtBytes = (b?: number | null) => {
  const n = Number(b)
  if (!Number.isFinite(n) || n <= 0) return ''
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${n} B`
}

const calcText = (c: ReviewRecordCard['calculation']) => {
  if (!c || c.calculatedValue === undefined || c.calculatedValue === null) return ''
  return `${c.calculatedValue} ${c.resultUnit || ''}${c.scope ? ` · ${c.scope}` : ''}`
}

/* User-friendly file-url builders per portal session. */
const evInlineUrl = (mode: 'admin' | 'mirror', id: string) =>
  mode === 'admin' ? `/api/project-admin/evidence/${id}/download?inline=1` : `/api/pu/evidence/${id}/file`
const evDownloadUrl = (mode: 'admin' | 'mirror', id: string) =>
  mode === 'admin' ? `/api/project-admin/evidence/${id}/download?download=true` : `/api/pu/evidence/${id}/file?download=true`

/* ============================================================================
 * ADAPTERS — build the ReviewModel from each portal's API payload.
 * ========================================================================== */

/** PA collection-status item (enriched GET) → ReviewModel. */
export function buildReviewModelFromPa(item: any): ReviewModel {
  const records: ReviewRecordCard[] = [...(item.sourceRecords || [])]
    .sort((a, b) => (a.level || 0) - (b.level || 0))
    .map((rec: any) => {
      const items: ReviewItem[] = (rec.items || []).map((it: any, idx: number) => ({
        key: `rec:${rec.recordId}:it:${it.id || idx}`,
        recordId: rec.recordId,
        levelName: rec.levelName,
        itemIndex: idx,
        title: itemTitle(it) || `Source item ${idx + 1}`,
        fields: itemFieldEntries(it).map(([k, v]) => ({ k, v })),
        evidence: (Array.isArray(it.evidence) ? it.evidence : []) as ReviewEvidence[],
        evidenceFileNames: Array.isArray(it.evidenceFileNames) ? it.evidenceFileNames : [],
      }))
      return {
        recordId: rec.recordId,
        level: rec.level,
        levelName: rec.levelName,
        recordStatus: rec.recordStatus,
        validationStatus: rec.validationStatus,
        calculation: rec.calculation || null,
        fields: (rec.fields || []).map(({ k, v }: any) => ({ k, v })),
        evidence: (rec.evidence || []) as ReviewEvidence[],
        evidenceFileNames: [],
        items,
      }
    })

  return {
    mode: 'admin',
    title: item.sectionName || 'Submission Review',
    refCode: item.sectionCode,
    status: item.submissionStatus,
    categoryLabel: item.categoryLabel,
    periodLabel: item.period,
    submittedAt: item.submissionDate,
    dueDate: item.dueDate,
    overdue: item.overdue,
    completionPct: item.completionPct ?? null,
    contributor: {
      name: item.assignedUserName || 'Site Contributor',
      email: item.assignedUserEmail || '',
      roleLabel: item.categoryLabel || item.assignedUserDbRole || 'Contributor',
    },
    project: item.project || { name: '—' },
    summary: Array.isArray(item.parsedValues)
      ? item.parsedValues.slice(0, 8).map((pv: any) => ({ label: pv.label, value: pv.value, unit: pv.unit }))
      : [],
    records,
    preMarks: [],
  }
}

/** PU submissions detail response → ReviewModel (mirror mode). */
export function buildReviewModelFromPuDetail(detail: any, s: any): ReviewModel {
  const evidenceRows: any[] = Array.isArray(detail?.evidence) ? detail.evidence : []
  const evById = new Map<string, any>(
    evidenceRows.filter((e) => e && e.id).map((e) => [String(e.id), e] as [string, any]),
  )
  const corrections: any[] = Array.isArray(detail?.submission?.corrections) ? detail.submission.corrections : []

  const records: ReviewRecordCard[] = (Array.isArray(detail?.sourceRecords) ? detail.sourceRecords : [])
    .map((lr: any) => ({
      lr,
      level: (lr?.level as number) || 0,
    }))
    .sort((a, b) => a.level - b.level)
    .map(({ lr }) => {
      const rawItems: any[] = Array.isArray(lr?.data?.items) ? lr.data.items : []
      const evOf = (idsRaw: unknown, extra?: string): ReviewEvidence[] => {
        const ids = [
          ...((Array.isArray(idsRaw) ? idsRaw : []) as string[]),
          ...(extra ? [extra] : []),
        ].filter(Boolean)
        return [...new Set(ids)]
          .map((id) => {
            const e = evById.get(id)
            return e
              ? { id: String(id), fileName: e.fileName || String(id), documentType: e.documentType ?? null, mimeType: e.mimeType ?? null, fileSize: e.fileSize ?? null, status: e.status ?? null }
              : null
          })
          .filter(Boolean) as ReviewEvidence[]
      }

      const items: ReviewItem[] = rawItems.map((it, idx) => ({
        key: `rec:${lr.id}:it:${it?.id || idx}`,
        recordId: lr.id,
        levelName: lr.levelName || '',
        itemIndex: idx,
        title: itemTitle(it) || `Source item ${idx + 1}`,
        fields: itemFieldEntries(it).map(([k, v]) => ({ k, v })),
        evidence: evOf(it?.evidenceIds, it?.evidenceId),
        evidenceFileNames: Array.isArray(it?.evidenceFiles) ? it.evidenceFiles : [],
      }))

      const recEvidenceIds = [...((Array.isArray(lr?.evidenceIds) ? lr.evidenceIds : []) as string[]), ...(lr?.evidenceId ? [lr?.evidenceId] : [])]
      return {
        recordId: lr.id,
        level: lr.level,
        levelName: lr.levelName || '',
        recordStatus: lr.status || '',
        validationStatus: lr.validationStatus || '',
        calculation: (lr?.calculation as ReviewRecordCard['calculation']) || null,
        fields: rawItems.length === 0
          ? itemFieldEntries(lr?.data || {}).map(([k, v]) => ({ k, v }))
          : [],
        evidence: evOf(recEvidenceIds),
        evidenceFileNames: [],
        items,
      }
    })

  /* Resolve reviewer marks onto items/records: explicit `target` keys first,
     label matching second (back-compat with older correction rows). */
  const preMarks: ReviewMark[] = []
  for (const c of corrections) {
    const mark: ReviewMark = {
      target: c.target || '',
      label: c.field || '',
      severity: c.severity === 'ERROR' ? 'ERROR' : 'WARNING',
      note: c.comment || c.issue || '',
      recordId: c.recordId || '',
      by: c.requesterName || 'Project Admin',
      at: c.createdAt || '',
    }
    if (mark.target) {
      preMarks.push(mark)
      continue
    }
    const f = String(c.field || '')
    for (const rec of records) {
      if (f.startsWith(`${rec.levelName} — entire`)) {
        preMarks.push({ ...mark, target: `rec:${rec.recordId}` })
        break
      }
      let hit = false
      for (const it of rec.items) {
        const lb = `${rec.levelName} · ${it.title}`
        if (f.startsWith(lb) || lb.startsWith(f)) {
          preMarks.push({ ...mark, target: it.key })
          hit = true
          break
        }
      }
      if (hit) break
    }
  }

  return {
    mode: 'mirror',
    title: s?.title || 'Submission Review',
    refCode: s?.project?.projectCode,
    status: s?.status || '',
    categoryLabel: s?.module || '',
    periodLabel: s?.reportingPeriod?.periodLabel || '',
    submittedAt: s?.submittedAt || null,
    dueDate: null,
    contributor: { name: s?.submittedBy || 'You', email: '', roleLabel: 'Site Contributor' },
    project: {
      name: s?.project?.projectName || '',
      code: s?.project?.projectCode || null,
      location: s?.project?.location || null,
      ptype: null,
      capacityMw: null,
      businessUnitName: s?.project?.businessUnit?.name || null,
    },
    summary: (s?.parsedValues || []).slice(0, 8).map((pv: any) => ({ label: pv.label, value: pv.value, unit: pv.unit })),
    records,
    preMarks,
    generalComment: detail?.submission?.reviewComment || null,
    reviewedByName: detail?.submission?.currentReviewer?.name || null,
    reviewedAt: detail?.submission?.reviewedAt || null,
  }
}

/* ============================================================================
 * Component — iOS Liquid Glass
 * ========================================================================== */

export function SubmissionReviewWindow({
  open,
  onClose,
  model,
  loading = false,
  pending = false,
  rejectDefaultNote = 'Marked for correction by Project Admin review.',
  onApprove,
  onReject,
  onDone,
  onOpenDataEntry,
}: {
  open: boolean
  onClose: () => void
  model: ReviewModel | null
  loading?: boolean
  /** submit/approve in flight — keeps the footer busy */
  pending?: boolean
  rejectDefaultNote?: string
  onApprove?: () => void | Promise<void>
  /** called with all marks resolved into payload rows */
  onReject?: (items: RejectPayloadItem[], generalNote: string) => void | Promise<void>
  /** mirror mode acknowledgment button */
  onDone?: () => void | Promise<void>
  /** Navigate to the portal's Data Entry module in-app. When provided, the
      "Open Data Entry to Fix" action renders as a button calling this instead
      of a legacy /pu?tab=data-entry href (which 404s in the single-route app). */
  onOpenDataEntry?: () => void | Promise<void>
}) {
  const [marks, setMarks] = useState<Record<string, ReviewMark>>({})
  const [generalNote, setGeneralNote] = useState('')
  const [preview, setPreview] = useState<ReviewEvidence | null>(null)
  const [copiedEmail, setCopiedEmail] = useState(false)

  /* Reset transient state whenever a different submission is opened. */
  useEffect(() => {
    if (open) {
      setMarks({})
      setGeneralNote('')
      setPreview(null)
    }
  }, [open, (model as any)?.title])

  /* Esc to close + body scroll lock while the window is open. */
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  const isAdmin = model?.mode === 'admin'
  const resolvedMarks = useMemo(() => {
    const base: Record<string, ReviewMark> = {}
    for (const m of model?.preMarks || []) base[m.target] = m
    if (isAdmin) Object.assign(base, marks)
    return base
  }, [model?.preMarks, marks, isAdmin])

  if (!open || !model) return null

  const toggleItem = (item: ReviewItem) => {
    if (!isAdmin) return
    setMarks((prev) => {
      const next = { ...prev }
      if (next[item.key]) delete next[item.key]
      else
        next[item.key] = {
          target: item.key,
          label: reviewLabelItem(item.levelName, item.title, item.itemIndex),
          severity: 'ERROR',
          note: '',
          recordId: item.recordId,
        }
      return next
    })
  }
  const toggleLevel = (rec: ReviewRecordCard) => {
    if (!isAdmin) return
    const t = `rec:${rec.recordId}`
    setMarks((prev) => {
      const next = { ...prev }
      if (next[t]) delete next[t]
      else
        next[t] = {
          target: t,
          label: reviewLabelLevel(rec.levelName),
          severity: 'ERROR',
          note: '',
          recordId: rec.recordId,
        }
      return next
    })
  }
  /* Bulk multi-select: add (or remove) every source item of a level in one click. */
  const toggleAllItems = (rec: ReviewRecordCard) => {
    if (!isAdmin) return
    setMarks((prev) => {
      const next = { ...prev }
      const allMarked = rec.items.every((it) => next[it.key])
      for (const it of rec.items) {
        if (allMarked) delete next[it.key]
        else if (!next[it.key])
          next[it.key] = {
            target: it.key,
            label: reviewLabelItem(it.levelName, it.title, it.itemIndex),
            severity: 'ERROR',
            note: '',
            recordId: rec.recordId,
          }
      }
      return next
    })
  }

  /* Tray chip → scroll the marked card into view with a highlight flash. */
  const [flashTarget, setFlashTarget] = useState<string | null>(null)
  const scrollToMark = (target: string) => {
    const el = document.getElementById(`mark-${target}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setFlashTarget(target)
    setTimeout(() => setFlashTarget((f) => (f === target ? null : f)), 1800)
  }
  const updateMark = (t: string, patch: Partial<ReviewMark>) =>
    setMarks((prev) => (prev[t] ? { ...prev, [t]: { ...prev[t], ...patch } } : prev))

  const submitReject = () => {
    if (!onReject) return
    const items = Object.values(resolvedMarks).map((m) => ({
      field: m.label,
      issue: (m.note || '').trim() || rejectDefaultNote,
      severity: m.severity,
      comment: (m.note || '').trim(),
      recordId: m.recordId,
      target: m.target,
    }))
    onReject(items, (generalNote || '').trim())
  }

  const markedList = Object.values(resolvedMarks)
  const markedCount = markedList.length
  const st = statusTone(model.status)

  /* evidence kind */
  const previewKind = (d: ReviewEvidence): 'image' | 'pdf' | 'html' => {
    const mime = (d.mimeType || '').toLowerCase()
    const name = (d.fileName || '').toLowerCase()
    if (mime.startsWith('image/')) return 'image'
    if (mime.includes('pdf') || name.endsWith('.pdf')) return 'pdf'
    return 'html'
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[90] flex flex-col bg-slate-950/45 backdrop-blur-xl"
    >
      {/* ============ LIQUID GLASS WINDOW ============ */}
      <div className="relative mx-auto mt-[4vh] flex h-[94vh] w-full max-w-[1240px] flex-col overflow-hidden rounded-t-[32px] bg-white/70 shadow-[0_32px_90px_-16px_rgba(15,23,42,0.45)] ring-1 ring-white/70 backdrop-blur-2xl">
        {/* Specular top sheen + caustic edge */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-white/85 via-white/30 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-white to-transparent" />

        {/* ---------- HEADER ---------- */}
        <div className="relative z-20 flex items-center justify-between gap-3 border-b border-white/70 bg-white/45 px-5 py-3.5 backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              title="Back to the status table (Esc)"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-slate-500 shadow-sm ring-1 ring-white/90 backdrop-blur transition hover:bg-white hover:text-slate-900 active:scale-95"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-[15px] font-extrabold tracking-tight text-slate-900">{model.title}</h2>
                <span className={`inline-flex items-center gap-1 rounded-full border bg-white/70 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider backdrop-blur ${st.chip}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                  {model.statusLabel || STATUS_LABEL[model.status] || model.status}
                </span>
                {model.overdue && (
                  <span className="rounded-full bg-rose-100/90 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-rose-700 ring-1 ring-rose-200">
                    Overdue
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] font-semibold text-slate-400">
                {model.refCode ? <span className="font-mono">{model.refCode}</span> : null}
                {model.categoryLabel ? <span>{model.categoryLabel}</span> : null}
                {model.periodLabel ? <span>Period: {model.periodLabel}</span> : null}
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-2.5 w-2.5" /> {fmtDateTime(model.submittedAt)}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close (Esc)"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-slate-400 shadow-sm ring-1 ring-white/90 backdrop-blur transition hover:bg-rose-50 hover:text-rose-600 active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ---------- BODY: data column + optional evidence preview ---------- */}
        <div className="flex min-h-0 flex-1">
          {loading ? (
            <div className="flex w-full items-center justify-center text-slate-400">Loading submission…</div>
          ) : (
            <>
              {/* ===== DATA COLUMN ===== */}
              <div className="min-w-0 flex-1 overflow-y-auto bg-gradient-to-b from-transparent via-white/20 to-transparent">
                <div className="mx-auto flex max-w-3xl flex-col gap-4 px-5 py-5">
                  {model.mode === 'mirror' && (
                    <div className="flex items-start gap-2.5 rounded-3xl border border-rose-300/70 bg-rose-50/80 px-4 py-3 text-rose-900 shadow-[0_8px_28px_-8px_rgba(244,63,94,0.25)] backdrop-blur-xl">
                      <AlertOctagon className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                      <div className="text-xs leading-relaxed">
                        <span className="font-black">Returned by {model.reviewedByName || 'the Project Admin'}</span>
                        {model.reviewedAt ? ` · ${fmtDateTime(model.reviewedAt)}` : ''} — the red-marked
                        sources / levels below were rejected. Fix each marked item in Data Entry and resubmit.
                        {model.generalComment ? (
                          <div className="mt-1.5 rounded-2xl bg-white/85 px-2.5 py-1.5 font-semibold ring-1 ring-rose-200/70">{model.generalComment}</div>
                        ) : null}
                      </div>
                    </div>
                  )}

                  {/* PHASE 1 — Contributor card */}
                  <PhaseCard n={1} label="Submitted by" icon={User}>
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-sky-500 text-[15px] font-black text-white shadow-md shadow-blue-500/25 ring-2 ring-white/70">
                        {initials(model.contributor.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-extrabold text-slate-900">{model.contributor.name}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10.5px] font-semibold text-slate-500">
                          <span className="rounded-full bg-sky-500/10 px-2 py-0.5 font-bold text-sky-700 ring-1 ring-sky-300/60 backdrop-blur">{model.contributor.roleLabel}</span>
                          {model.contributor.email ? (
                            <button
                              type="button"
                              title="Copy email"
                              onClick={() => {
                                navigator.clipboard?.writeText(model.contributor.email || '').catch(() => {})
                                setCopiedEmail(true)
                                setTimeout(() => setCopiedEmail(false), 1600)
                              }}
                              className="inline-flex items-center gap-1 text-slate-500 transition hover:text-blue-700"
                            >
                              {model.contributor.email}
                              {copiedEmail ? <CircleCheck className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                            </button>
                          ) : null}
                        </div>
                      </div>
                      <div className="hidden shrink-0 text-right sm:block">
                        <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Submitted</div>
                        <div className="text-[11px] font-bold text-slate-700">{fmtDateTime(model.submittedAt)}</div>
                      </div>
                    </div>
                  </PhaseCard>

                  {/* PHASE 2 — Project card */}
                  <PhaseCard n={2} label="Project information" icon={Building2}>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                      <ReviewKv label="Project" value={model.project.name} bold />
                      {model.project.code ? <ReviewKv label="Project Code" value={model.project.code} mono /> : null}
                      {model.project.location ? <ReviewKv label="Location" value={model.project.location} /> : null}
                      {model.project.ptype ? <ReviewKv label="Type" value={model.project.ptype} /> : null}
                      {model.project.capacityMw ? <ReviewKv label="Capacity" value={`${model.project.capacityMw} MW`} /> : null}
                      {model.project.businessUnitName ? <ReviewKv label="Business Unit" value={model.project.businessUnitName} /> : null}
                      {model.periodLabel ? <ReviewKv label="Reporting Period" value={model.periodLabel} /> : null}
                      {model.dueDate && model.mode === 'admin' ? <ReviewKv label="Due Date" value={fmtDateTime(model.dueDate).split(',')[0]} /> : null}
                    </div>
                  </PhaseCard>

                  {/* PHASE 3 — Captured summary */}
                  {model.summary.length > 0 && (
                    <PhaseCard n={3} label="Captured summary" icon={Layers}>
                      <div className="flex flex-wrap gap-1.5">
                        {model.summary.map((sv, i) => (
                          <span key={i} className="inline-flex items-center rounded-2xl border border-sky-300/50 bg-sky-500/10 px-2.5 py-1 text-[10.5px] font-bold text-sky-800 backdrop-blur">
                            {sv.label}: {typeof sv.value === 'number' ? fmtValue(sv.value) : String(sv.value)} {sv.unit || ''}
                          </span>
                        ))}
                      </div>
                    </PhaseCard>
                  )}

                  {/* PHASE 4+ — one card per emission / data level */}
                  {(() => {
                    let phase = model.summary.length > 0 ? 4 : 3
                    if (model.records.length === 0) {
                      return (
                        <PhaseCard n={phase} label="Submission data" icon={Inbox}>
                          <div className="flex flex-col items-center justify-center gap-1.5 py-6 text-slate-400">
                            <Inbox className="h-5 w-5" />
                            <span className="text-xs font-bold">No per-source records captured yet for this section.</span>
                          </div>
                        </PhaseCard>
                      )
                    }
                    return model.records.map((rec) => {
                      const recKey = `rec:${rec.recordId}`
                      const recMark = resolvedMarks[recKey]
                      const phaseNo = phase++
                      return (
                        <PhaseCard
                          key={recKey}
                          id={`mark-${recKey}`}
                          flash={flashTarget === recKey}
                          n={phaseNo}
                          label={rec.levelName}
                          icon={CircleCheck}
                          tone={recMark ? 'rose' : rec.recordStatus === 'CORRECTION_REQUESTED' ? 'rose-soft' : 'default'}
                        >
                          {/* record header row */}
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="flex h-6 w-6 items-center justify-center rounded-xl bg-gradient-to-br from-sky-600 to-blue-600 text-[10px] font-black text-white shadow-sm ring-2 ring-white/60">
                                {rec.level}
                              </span>
                              <span className={`rounded-full border bg-white/70 px-1.5 py-0.5 text-[9px] font-black uppercase backdrop-blur ${recStatusTone(rec.recordStatus)}`}>
                                {String(rec.recordStatus || '—').replace(/_/g, ' ')}
                              </span>
                              {rec.validationStatus ? (
                                <span className="text-[9.5px] font-bold text-slate-400">validation {String(rec.validationStatus).toLowerCase()}</span>
                              ) : null}
                              {calcText(rec.calculation) ? (
                                <span className="rounded-xl bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-black text-blue-700 ring-1 ring-blue-300/50 backdrop-blur">
                                  {calcText(rec.calculation)}
                                </span>
                              ) : null}
                            </div>
                            {isAdmin && rec.items.length > 0 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleAllItems(rec)
                                }}
                                className={`flex shrink-0 items-center gap-1 rounded-xl border px-2 py-1 text-[9.5px] font-black uppercase backdrop-blur transition active:scale-95 ${
                                  rec.items.every((it) => resolvedMarks[it.key])
                                    ? 'border-rose-400/70 bg-gradient-to-br from-rose-500 to-red-500 text-white shadow-md shadow-rose-500/25'
                                    : 'border-rose-300/70 bg-white/70 text-rose-600 hover:bg-rose-500/10'
                                }`}
                              >
                                <ListFilter className="h-3 w-3" />
                                {rec.items.every((it) => resolvedMarks[it.key])
                                  ? 'Unmark sources'
                                  : `Mark all ${rec.items.length} source${rec.items.length === 1 ? '' : 's'}`}
                              </button>
                            )}
                            {isAdmin && (
                              <FlagToggle
                                flagged={Boolean(recMark)}
                                label="Reject whole level"
                                onClick={() => toggleLevel(rec)}
                              />
                            )}
                            {!isAdmin && recMark ? (
                              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[9.5px] font-black uppercase text-rose-700 ring-1 ring-rose-200">Rejected level</span>
                            ) : null}
                          </div>

                          {recMark && (
                            <ClarificationBlock
                              mark={recMark}
                              highlight
                              isMirror={!isAdmin}
                              editable={isAdmin}
                              onChangeNote={(note) => updateMark(recKey, { note })}
                              onChangeSeverity={(sev) => updateMark(recKey, { severity: sev })}
                            />
                          )}

                          {/* record-level flat fields (non-item records) */}
                          {rec.items.length === 0 && rec.fields.length > 0 && (
                            <div
                              role={isAdmin ? 'button' : undefined}
                              onClick={isAdmin ? (e) => { e.stopPropagation(); toggleLevel(rec) } : undefined}
                              className={`mt-3 rounded-3xl border p-3 backdrop-blur transition-all ${
                                recMark
                                  ? 'border-rose-300 bg-rose-50/80 shadow-[0_0_0_4px_rgba(244,63,94,0.09)]'
                                  : isAdmin
                                    ? 'cursor-pointer border-slate-200/90 bg-white/70 hover:border-rose-300/70 hover:bg-rose-50/30'
                                    : 'border-slate-200/90 bg-white/70'
                              }`}
                            >
                              <ReviewFieldGrid fields={rec.fields} />
                            </div>
                          )}

                          {/* per-source items ("the emission → sources → evidence" loop) */}
                          {rec.items.map((it) => {
                            const mark = resolvedMarks[it.key]
                            return (
                              <div key={it.key} id={`mark-${it.key}`}>
                                <div
                                  role={isAdmin ? 'button' : undefined}
                                  title={isAdmin ? (mark ? 'Click to remove from rejection list' : 'Click to add to rejection list') : undefined}
                                  onClick={isAdmin ? (e) => { e.stopPropagation(); toggleItem(it) } : undefined}
                                  className={`group relative rounded-3xl border p-3 backdrop-blur transition-all ${
                                    mark
                                      ? 'border-rose-300 bg-rose-50/80 shadow-[0_0_0_4px_rgba(244,63,94,0.09)]'
                                      : isAdmin
                                        ? 'cursor-pointer border-slate-200/90 bg-white/70 hover:border-rose-300/70 hover:bg-rose-50/25 hover:shadow-[0_8px_24px_-10px_rgba(244,63,94,0.25)]'
                                        : 'border-slate-200/90 bg-white/70'
                                  } ${flashTarget === it.key ? 'ring-4 ring-amber-400/70' : ''}`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex min-w-0 items-center gap-1.5">
                                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-[9px] font-bold text-white">
                                        {it.itemIndex + 1}
                                      </span>
                                      <span className="truncate text-[11.5px] font-extrabold text-slate-900">{it.title}</span>
                                    </div>
                                    {/* Glass checkbox — explicit multi-select affordance */}
                                    {isAdmin && (
                                      <GlassCheck checked={Boolean(mark)} />
                                    )}
                                    {!isAdmin && mark ? (
                                      <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-[9.5px] font-black uppercase text-rose-700 ring-1 ring-rose-200">Rejected</span>
                                    ) : null}
                                  </div>
                                  <ReviewFieldGrid fields={it.fields} />
                                  <EvidenceChips
                                    files={it.evidence}
                                    extraNames={it.evidenceFileNames}
                                    onToggle={(d) => setPreview((pv) => (pv?.id === d.id ? null : d))}
                                    previewing={preview}
                                  />
                                </div>
                                  {mark && (
                                    <ClarificationBlock
                                      mark={mark}
                                      highlight
                                      isMirror={!isAdmin}
                                      editable={isAdmin}
                                      onChangeNote={(note) => updateMark(it.key, { note })}
                                      onChangeSeverity={(sev) => updateMark(it.key, { severity: sev })}
                                    />
                                  )}
                              </div>
                            )
                          })}

                          {/* record-level evidence (attaches to the whole level) */}
                          {rec.evidence.length > 0 && (
                            <div className="mt-3">
                              <div className="mb-1 text-[9px] font-black uppercase tracking-wider text-slate-400">Level evidence</div>
                              <EvidenceChips files={rec.evidence} extraNames={rec.evidenceFileNames} onToggle={(d) => setPreview((pv) => (pv?.id === d.id ? null : d))} previewing={preview} />
                            </div>
                          )}
                        </PhaseCard>
                      )
                    })
                  })()}

                  <div className="pb-2 pt-1 text-center text-[9.5px] font-semibold text-slate-300">
                    Read-only view — data is clickable for review and rejection marking, it cannot be edited here.
                  </div>
                </div>
              </div>

              {/* ===== EVIDENCE SPLIT PANEL (liquid glass) ===== */}
              <AnimatePresence>
                {preview && (
                  <motion.div
                    key={preview.id}
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: '42%', opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 30 }}
                    className="relative flex min-h-0 shrink-0 flex-col overflow-hidden border-l border-white/70 bg-white/75 backdrop-blur-2xl"
                  >
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-white/80 to-transparent" />
                    <div className="relative flex items-center justify-between gap-2 border-b border-white/70 bg-white/50 px-3.5 py-2">
                      <div className="min-w-0">
                        <div className="truncate text-[11px] font-extrabold text-slate-800">{preview.fileName}</div>
                        <div className="text-[9.5px] font-semibold text-slate-400">
                          {[preview.documentType, fmtBytes(preview.fileSize), preview.status].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <a
                          href={evDownloadUrl(model.mode, preview.id)}
                          className="flex items-center gap-1 rounded-xl bg-gradient-to-br from-blue-600 to-sky-500 px-2.5 py-1 text-[10px] font-bold text-white shadow-md shadow-blue-500/25 ring-1 ring-white/40 transition hover:brightness-110 active:scale-95"
                        >
                          <Download className="h-3 w-3" /> Download
                        </a>
                        <button
                          type="button"
                          onClick={() => setPreview(null)}
                          title="Close preview"
                          className="flex h-6 w-6 items-center justify-center rounded-xl bg-white/85 text-slate-400 ring-1 ring-white/90 transition hover:text-slate-700 active:scale-95"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="min-h-0 flex-1 bg-slate-100/60">
                      {previewKind(preview) === 'image' ? (
                        <img src={evInlineUrl(model.mode, preview.id)} alt={preview.fileName} className="h-full w-full object-contain" />
                      ) : (
                        <iframe src={evInlineUrl(model.mode, preview.id)} title={preview.fileName} className="h-full w-full border-0 bg-white" />
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>

        {/* ---------- STICKY GLASS FOOTER + MARKED TRAY ---------- */}
        <div className="relative border-t border-white/70 bg-white/60 px-5 py-3 shadow-[0_-8px_32px_rgba(15,23,42,0.07)] backdrop-blur-2xl">
          {isAdmin ? (
            <>
              {/* Marked-items tray — makes the multi-select list visible & removable */}
              <AnimatePresence>
                {markedCount > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    className="mb-2.5 flex flex-wrap items-center gap-1.5"
                  >
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-rose-700 ring-1 ring-rose-300/60">
                      <ListFilter className="h-2.5 w-2.5" /> Rejection list
                    </span>
                    {markedList.map((m) => (
                      <span
                        key={m.target}
                        role="button"
                        tabIndex={0}
                        title={m.note ? `Clarification: ${m.note} — click to locate` : 'No clarification yet — click to locate'}
                        onClick={() => scrollToMark(m.target)}
                        onKeyDown={(e) => { if (e.key === 'Enter') scrollToMark(m.target) }}
                        className={`inline-flex max-w-[300px] cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-bold ring-1 backdrop-blur transition hover:brightness-105 active:scale-95 ${
                          m.severity === 'ERROR'
                            ? 'bg-rose-500/10 text-rose-800 ring-rose-300/70'
                            : 'bg-amber-500/10 text-amber-800 ring-amber-300/70'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${m.note ? 'bg-emerald-500' : 'bg-slate-300'}`} title={m.note ? 'Clarification added' : 'No clarification yet'} />
                        <span className="truncate">{m.label}</span>
                        <button
                          type="button"
                          onClick={() => setMarks((prev) => {
                            const next = { ...prev }
                            delete next[m.target]
                            return next
                          })}
                          title="Remove from rejection list"
                          className="ml-0.5 rounded-full p-0.5 text-rose-500 transition hover:bg-rose-500/20"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[10.5px] font-bold text-slate-500">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ring-1 backdrop-blur ${markedCount ? 'bg-rose-500/10 text-rose-700 ring-rose-300/70' : 'bg-slate-500/10 text-slate-500 ring-slate-300/60'}`}>
                    {markedCount} selected
                  </span>
                  <span className="hidden sm:inline">Tap any source, level or data card — each click adds it to the list. Select as many as you need.</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    value={generalNote}
                    onChange={(e) => setGeneralNote(e.target.value)}
                    placeholder="General note for the contributor (optional)…"
                    className="hidden h-9 w-64 rounded-2xl border border-white/90 bg-white/70 px-3 text-[11px] font-medium text-slate-800 shadow-inner outline-none backdrop-blur transition placeholder:text-slate-400 focus:border-blue-400/60 md:block"
                  />
                  {markedCount > 0 && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setMarks({})}
                      className="rounded-2xl bg-white/70 px-3 py-1.5 text-[11px] font-bold text-slate-500 ring-1 ring-white/90 backdrop-blur transition hover:bg-white hover:text-slate-700 disabled:opacity-50 active:scale-95"
                    >
                      Clear all
                    </button>
                  )}
                  {onApprove && (
                    <button
                      type="button"
                      disabled={pending || markedCount > 0}
                      title={markedCount > 0 ? 'Clear the rejection list before approving' : 'Approve this submission'}
                      onClick={() => onApprove?.()}
                      className="inline-flex items-center gap-1.5 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 px-4 py-1.5 text-[11px] font-bold text-white shadow-md shadow-emerald-500/25 ring-1 ring-white/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
                    >
                      <CircleCheck className="h-3.5 w-3.5" /> Approve
                    </button>
                  )}
                  {onReject && (
                    <button
                      type="button"
                      disabled={pending || markedCount === 0}
                      onClick={submitReject}
                      className="inline-flex items-center gap-1.5 rounded-2xl bg-gradient-to-br from-rose-500 to-red-500 px-4 py-1.5 text-[11px] font-bold text-white shadow-md shadow-rose-500/25 ring-1 ring-white/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
                    >
                      <X className="h-3.5 w-3.5" /> Submit Rejection ({markedCount})
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[10.5px] font-bold text-slate-500">
                <RefreshCcw className="h-3 w-3" /> Fix every marked source in Data Entry, then resubmit.
              </div>
              <div className="flex items-center gap-2">
                {onDone && (
                  <button
                    type="button"
                    onClick={() => onDone?.()}
                    className="rounded-2xl bg-white/70 px-3.5 py-1.5 text-[11px] font-bold text-slate-600 ring-1 ring-white/90 backdrop-blur transition hover:bg-white active:scale-95"
                  >
                    Close Review
                  </button>
                )}
                {onOpenDataEntry ? (
                  <button
                    type="button"
                    onClick={() => void onOpenDataEntry?.()}
                    className="inline-flex items-center gap-1.5 rounded-2xl bg-gradient-to-br from-blue-600 to-sky-500 px-3.5 py-1.5 text-[11px] font-bold text-white shadow-md shadow-blue-500/25 ring-1 ring-white/40 transition hover:brightness-110 active:scale-95"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Open Data Entry to Fix
                  </button>
                ) : (
                  <a
                    href="/pu?tab=data-entry"
                    className="inline-flex items-center gap-1.5 rounded-2xl bg-gradient-to-br from-blue-600 to-sky-500 px-3.5 py-1.5 text-[11px] font-bold text-white shadow-md shadow-blue-500/25 ring-1 ring-white/40 transition hover:brightness-110 active:scale-95"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Open Data Entry to Fix
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

/* ============================ Sub pieces ============================ */

function PhaseCard({
  n, label, icon: Icon, tone = 'default', id, flash, children,
}: {
  n: number
  label: string
  icon: React.ComponentType<{ className?: string }>
  tone?: 'default' | 'rose' | 'rose-soft'
  id?: string
  flash?: boolean
  children: React.ReactNode
}) {
  const ring = tone === 'rose'
    ? 'border-rose-300/80 shadow-[0_0_0_4px_rgba(244,63,94,0.07),0_12px_36px_-12px_rgba(244,63,94,0.25)]'
    : tone === 'rose-soft' ? 'border-rose-200/80' : 'border-white/80'
  const head = tone === 'rose' ? 'text-rose-700' : tone === 'rose-soft' ? 'text-rose-600' : 'text-slate-500'
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className={`relative overflow-hidden rounded-[26px] border bg-white/65 p-4 shadow-[0_10px_36px_-14px_rgba(15,23,42,0.14)] backdrop-blur-xl ${ring} ${flash ? 'ring-4 ring-amber-400/70' : ''}`}
    >
      {/* inner specular sheen */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-white/80 to-transparent" />
      <div className="relative mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-950 text-[10px] font-black text-white shadow-sm ring-2 ring-white/50">
          {n}
        </span>
        <span className={`text-[10px] font-black uppercase tracking-wider ${head}`}>{label}</span>
        <span className="h-px flex-1 bg-gradient-to-r from-slate-200/80 to-transparent" />
        <Icon className={`h-3.5 w-3.5 ${tone === 'rose' ? 'text-rose-400' : 'text-slate-300'}`} />
      </div>
      <div className="relative">{children}</div>
    </motion.section>
  )
}

function ReviewKv({ label, value, bold, mono }: { label: string; value?: string | number | null; bold?: boolean; mono?: boolean }) {
  const blank = value === null || value === undefined || value === ''
  return (
    <div className="rounded-2xl bg-white/70 px-2.5 py-1.5 ring-1 ring-slate-200/60 backdrop-blur">
      <div className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`truncate text-[11.5px] text-slate-900 ${bold ? 'font-extrabold' : 'font-semibold'} ${mono ? 'font-mono' : ''} ${blank ? 'italic text-slate-300' : ''}`}>
        {blank ? '—' : String(value)}
      </div>
    </div>
  )
}

function ReviewFieldGrid({ fields }: { fields: ReviewField[] }) {
  if (!fields.length) return null
  return (
    <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
      {fields.map(({ k, v }, i) => {
        const blank = v === null || v === undefined || v === ''
        return (
          <div key={`${String(k)}-${i}`} className="flex items-center justify-between gap-1.5 rounded-xl border border-slate-200/70 bg-white/80 px-2 py-1 backdrop-blur">
            <span className="truncate text-[9.5px] font-semibold text-slate-500">{fieldLabel(String(k))}</span>
            <span className={`text-right text-[10.5px] ${blank ? 'font-medium italic text-slate-300' : 'font-bold text-slate-900'}`}>
              {blank ? '—' : fmtValue(v)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function EvidenceChips({
  files, extraNames, onToggle, previewing,
}: {
  files: ReviewEvidence[]
  extraNames?: string[]
  onToggle: (d: ReviewEvidence) => void
  previewing?: ReviewEvidence | null
}) {
  const extras = (extraNames || []).filter((n) => !files.some((f) => f.fileName === n))
  if (!files.length && !extras.length) return null
  return (
    <div className="mt-2">
      <div className="mb-1 flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-slate-400">
        <Paperclip className="h-2.5 w-2.5" /> Evidence for this source
      </div>
      <div className="flex flex-wrap gap-1">
        {files.map((d) => (
          <button
            key={d.id}
            type="button"
            title="View alongside data (split preview)"
            onClick={(e) => {
              e.stopPropagation()
              onToggle(d)
            }}
            className={`inline-flex max-w-full items-center gap-1 rounded-xl border px-1.5 py-0.5 text-[9.5px] font-bold backdrop-blur transition ${
              previewing?.id === d.id
                ? 'border-blue-400 bg-blue-600 text-white ring-2 ring-blue-300/60'
                : 'border-emerald-300/60 bg-emerald-500/10 text-emerald-800 hover:bg-blue-500/10 hover:text-blue-700 hover:ring-blue-300/60'
            }`}
          >
            <FileText className={`h-2.5 w-2.5 shrink-0 ${previewing?.id === d.id ? 'text-white' : 'text-emerald-600'}`} />
            <span className="truncate">{d.fileName}</span>
          </button>
        ))}
        {extras.map((n, i) => (
          <span key={i} title="Referenced by name (not linked in the vault)" className="inline-flex items-center gap-1 rounded-xl bg-slate-500/5 px-1.5 py-0.5 text-[9.5px] font-semibold text-slate-500 ring-1 ring-slate-200/70">
            <FileText className="h-2.5 w-2.5 text-slate-400" /> {n}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Animated glass checkbox — the explicit multi-select affordance. */
function GlassCheck({ checked }: { checked: boolean }) {
  return (
    <motion.span
      animate={checked ? { scale: [0.85, 1.12, 1] } : { scale: 1 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-lg shadow-sm ring-1 transition-colors ${
        checked
          ? 'bg-gradient-to-br from-rose-500 to-red-500 text-white ring-rose-400/60'
          : 'bg-white/80 ring-slate-300/80 group-hover:ring-rose-400/60'
      }`}
    >
      {checked ? <Check className="h-3 w-3 stroke-[3]" /> : null}
    </motion.span>
  )
}

function FlagToggle({ flagged, label, onClick }: { flagged: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={`flex shrink-0 items-center gap-1 rounded-xl border px-2 py-1 text-[9.5px] font-black uppercase backdrop-blur transition active:scale-95 ${
        flagged
          ? 'border-rose-400/70 bg-gradient-to-br from-rose-500 to-red-500 text-white shadow-md shadow-rose-500/25'
          : 'border-rose-300/70 bg-white/70 text-rose-600 hover:bg-rose-500/10'
      }`}
    >
      {flagged ? <Check className="h-3 w-3" /> : <Flag className="h-3 w-3" />}
      {flagged ? 'Level marked' : label}
    </button>
  )
}

function ClarificationBlock({
  mark, highlight, isMirror, editable, onChangeNote, onChangeSeverity,
}: {
  mark: ReviewMark
  highlight?: boolean
  isMirror?: boolean
  editable?: boolean
  onChangeNote?: (note: string) => void
  onChangeSeverity?: (sev: 'ERROR' | 'WARNING') => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      transition={{ duration: 0.22 }}
      className={`mx-1 mt-2 overflow-hidden rounded-2xl border backdrop-blur-xl ${highlight ? 'border-rose-300/70 bg-rose-50/80' : 'border-slate-200/80 bg-slate-50/80'}`}
    >
      <div
        className="px-3 py-2"
        onClick={(e) => e.stopPropagation()}
        role="presentation"
      >
        {isMirror ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-bold text-rose-800">
            <AlertTriangle className="h-3 w-3" />
            Reviewer: <span className="text-rose-950">{mark.by || 'Project Admin'}</span>
            {mark.at ? <span className="font-semibold text-rose-500">{fmtDateTime(mark.at)}</span> : null}
            <span className="rounded-lg bg-rose-600 px-1.5 py-0.5 text-[8.5px] font-black text-white shadow-sm">{mark.severity}</span>
          </div>
        ) : editable ? (
          <div className="flex items-center gap-2">
            <span className="text-[9.5px] font-black uppercase tracking-wider text-rose-700">Rejection clarification</span>
            {(['ERROR', 'WARNING'] as const).map((sev) => (
              <button
                key={sev}
                type="button"
                title={`Severity: ${sev}`}
                onClick={() => onChangeSeverity?.(sev)}
                className={`rounded-lg px-1.5 py-0.5 text-[9px] font-black transition active:scale-95 ${
                  mark.severity === sev
                    ? sev === 'ERROR'
                      ? 'bg-gradient-to-br from-rose-500 to-red-500 text-white shadow-sm'
                      : 'bg-gradient-to-br from-amber-400 to-orange-400 text-white shadow-sm'
                    : 'bg-white/80 text-slate-500 ring-1 ring-slate-200/80 hover:bg-white'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        ) : null}

        {isMirror ? (
          mark.note ? (
            <p className="mt-1 text-[11px] font-semibold leading-relaxed text-rose-900">“{mark.note}”</p>
          ) : (
            <p className="mt-1 text-[10.5px] font-semibold italic text-rose-700/80">
              No written clarification — marked for correction by the reviewer.
            </p>
          )
        ) : null}

        {editable ? (
          <textarea
            value={mark.note}
            onChange={(e) => onChangeNote?.(e.target.value)}
            placeholder="Explain what must be fixed (optional — a default note is added when left empty)…"
            rows={2}
            className="mt-1.5 min-h-[44px] w-full resize-y rounded-2xl border border-rose-200/80 bg-white/85 px-2.5 py-1.5 text-[11px] font-medium text-slate-800 outline-none backdrop-blur transition placeholder:text-slate-400 focus:border-rose-400 focus:ring-2 focus:ring-rose-200/60"
          />
        ) : null}
      </div>
    </motion.div>
  )
}
