/**
 * Submission Report — model builder + text renderers.
 *
 * Compiles the full workflow story of one Submission (project details,
 * reporting period, captured data, source records incl. per-item emission
 * sources, evidence vault, validation, calculations, review history and
 * corrections) into a transportable model that the report route can render
 * as PDF / Excel (CSV) / Word / Print-HTML without touching the DB again.
 *
 * Kept dependency-light: no React, no jsPDF here (see submission-report-pdf.ts).
 */
import { db } from '@/lib/pu/db'
import { parseJsonArray, parseRecordIds } from '@/lib/pu/workflow'
import { getLevelRecordById } from '@/lib/pu/level-records'
import { fieldLabel, fmtValue, itemFieldEntries, itemTitle } from '@/components/shared/field-labels'

export type ReportSection =
  | { kind: 'kv'; title: string; note?: string; rows: Array<{ k: string; v: string }> }
  | { kind: 'table'; title: string; note?: string; columns: string[]; rows: string[][] }

export interface SubmissionReportModel {
  meta: {
    title: string
    submissionId: string
    module: string
    moduleLabel: string
    status: string
    projectLabel: string
    periodLabel: string
    generatedAt: string
    generatedBy: { name: string; email: string; role: string }
    fileNameBase: string
  }
  sections: ReportSection[]
  /** Attachment extras the HTML renderer uses for clickable links. */
  attach: { evidence: Array<{ id: string; fileName: string }> }
}

const MODULE_LABEL: Record<string, string> = {
  ENERGY: 'Energy (L1)',
  WATER: 'Water (L2)',
  EMISSIONS: 'GHG Emissions (L3)',
  WASTE: 'Waste (L4)',
  SAFETY: 'Safety (L5)',
  PEOPLE: 'Workforce (L6)',
  TRAINING: 'Training (L6)',
  COMPLIANCE: 'Compliance (L7)',
  INCIDENTS: 'Incidents & Grievances (L8)',
  INITIATIVES: 'Initiatives (L9)',
  TRAVEL: 'Business Travel',
}

const PIPELINE = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'BU_APPROVED', 'SUBSIDIARY_APPROVED', 'HQ_REVIEW', 'LOCKED']
const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft', SUBMITTED: 'Pending', PENDING: 'Pending', RESUBMITTED: 'Pending (Resubmitted)',
  UNDER_REVIEW: 'Under Review', BU_APPROVED: 'Approved (Project Admin)',
  SUBSIDIARY_APPROVED: 'Active (Subsidiary)', HQ_REVIEW: 'HQ Review',
  APPROVED: 'Active', ACTIVE: 'Active', LOCKED: 'Locked',
  CORRECTION_REQUESTED: 'Correction Required', CHANGES_REQUESTED: 'Correction Required', REJECTED: 'Rejected',
}
const ACTION_LABEL: Record<string, string> = {
  SUBMIT: 'Submit', RESUBMIT: 'Resubmit', REVIEW: 'Start Review',
  APPROVE: 'Approve', BU_APPROVE: 'Approve (Project Admin)', SUBSIDIARY_APPROVE: 'Approve (Subsidiary)',
  REJECT: 'Request Correction', LOCK: 'Lock', DISCARD: 'Discard Draft',
}

/* ---------------- formatting helpers ---------------- */

function fmtDateTime(iso: unknown): string {
  if (!iso) return '—'
  const d = new Date(String(iso))
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`
}

function fmtDate(iso: unknown): string {
  if (!iso) return '—'
  const d = new Date(String(iso))
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function humanBytes(n: unknown): string {
  const b = Number(n)
  if (!Number.isFinite(b) || b <= 0) return '—'
  if (b >= 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`
  if (b >= 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${b} B`
}

const num = (v: unknown): string => (v === null || v === undefined || v === '' ? '—' : String(v))

function statusPath(status: string): string {
  const target = status === 'PENDING' ? 'SUBMITTED' : status === 'ACTIVE' ? 'SUBSIDIARY_APPROVED' : status
  const idx = PIPELINE.indexOf(target)
  if (idx < 0) return STATUS_LABEL[status] || status
  return PIPELINE.map((s, i) => `${i < idx ? '✓' : i === idx ? "▶" : '○'} ${STATUS_LABEL[s]}`).join('  →  ')
}

/* ---------------- model builder ---------------- */

export async function buildSubmissionReportModel(
  submissionId: string,
  actor: { id: string; name: string; email: string; role: string },
): Promise<SubmissionReportModel | null> {
  const submission = await db.submission.findUnique({
    where: { id: submissionId },
    include: {
      project: {
        select: {
          id: true, code: true, name: true, location: true, status: true,
          ptype: true, capacityMw: true, frequency: true,
          businessUnit: { select: { id: true, name: true, subsidiary: { select: { id: true, name: true } } } },
        },
      },
      reportingPeriod: {
        select: {
          id: true, periodLabel: true, year: true, month: true, periodType: true,
          startDate: true, endDate: true, submissionDeadline: true, reviewDeadline: true, approvalDeadline: true, status: true,
          reportingYear: { select: { id: true, label: true, year: true } },
        },
      },
      reviewer: { select: { id: true, name: true, email: true } },
    },
  })
  if (!submission) return null

  const recordIds = parseRecordIds(submission.recordIds)

  /* --- Source records: JSON level records first (they carry the staged
         items[] incl. emission sources), Prisma mirrors as fallback. --- */
  let sourceRecords: any[] = []
  if (recordIds.length > 0) {
    for (const rid of recordIds) {
      const lr = getLevelRecordById(rid)
      if (lr) sourceRecords.push(lr)
    }
    const missing = recordIds.filter((rid) => !sourceRecords.some((r) => r?.id === rid))
    if (missing.length > 0) {
      const common = { calculationResults: true, validationResults: true }
      switch (submission.module) {
        case 'ENVIRONMENT':
          sourceRecords.push(
            ...(await db.energyRecord.findMany({ where: { id: { in: missing } }, include: common })),
            ...(await db.waterRecord.findMany({ where: { id: { in: missing } }, include: common })),
            ...(await db.wasteRecord.findMany({ where: { id: { in: missing } }, include: common })),
            ...(await db.travelRecord.findMany({ where: { id: { in: missing } }, include: common })),
          )
          break
        case 'ENERGY': sourceRecords.push(...(await db.energyRecord.findMany({ where: { id: { in: missing } }, include: common }))); break
        case 'WATER': sourceRecords.push(...(await db.waterRecord.findMany({ where: { id: { in: missing } }, include: common }))); break
        case 'WASTE': sourceRecords.push(...(await db.wasteRecord.findMany({ where: { id: { in: missing } }, include: common }))); break
        case 'TRAVEL': sourceRecords.push(...(await db.travelRecord.findMany({ where: { id: { in: missing } }, include: common }))); break
        case 'PEOPLE': sourceRecords.push(...(await db.workforceRecord.findMany({ where: { id: { in: missing } }, include: { validationResults: true } }))); break
        case 'SAFETY': sourceRecords.push(...(await db.safetyRecord.findMany({ where: { id: { in: missing } }, include: { validationResults: true } }))); break
        default: break
      }
    }
  }

  /* --- Evidence identifiers: record level + nested per staged item. --- */
  const evidenceIdsSet = new Set<string>()
  for (const r of sourceRecords) {
    if (r?.evidenceId) evidenceIdsSet.add(String(r.evidenceId))
    if (Array.isArray(r?.evidenceIds)) r.evidenceIds.filter(Boolean).forEach((x: any) => evidenceIdsSet.add(String(x)))
    const items = Array.isArray(r?.data?.items) ? r.data.items : []
    for (const it of items) {
      if (Array.isArray(it?.evidenceIds)) it.evidenceIds.filter(Boolean).forEach((x: string) => evidenceIdsSet.add(String(x)))
      else if (it?.evidenceId) evidenceIdsSet.add(String(it.evidenceId))
    }
  }
  const evidenceIds = Array.from(evidenceIdsSet)

  /* --- Parallel tail batch (validation / calculations / evidence / audit). --- */
  const calcFilter = (() => {
    switch (submission.module ?? '') {
      case 'ENERGY': return { energyRecordId: { in: recordIds } }
      case 'WATER': return { waterRecordId: { in: recordIds } }
      case 'WASTE': return { wasteRecordId: { in: recordIds } }
      case 'TRAVEL': return { travelRecordId: { in: recordIds } }
      default: return null
    }
  })()
  const [evidence, validationRows, calcRows, auditRows] = await Promise.all([
    evidenceIds.length
      ? db.evidence.findMany({ where: { id: { in: evidenceIds } }, include: { uploader: { select: { id: true, name: true, email: true } } } })
      : Promise.resolve([]),
    recordIds.length
      ? db.validationResult.findMany({ where: { recordId: { in: recordIds } }, orderBy: { detectedAt: 'desc' }, take: 200 })
      : Promise.resolve([]),
    calcFilter && recordIds.length
      ? db.calculationResult.findMany({ where: calcFilter as any, orderBy: { calculatedAt: 'desc' }, take: 200 })
      : Promise.resolve([]),
    db.soAuditLog.findMany({ where: { entityType: 'Submission', entityId: submission.id }, orderBy: { createdAt: 'asc' }, take: 100 }),
  ]) as [any[], any[], any[], any[]]

  /* --- Parsed submission values + evidence name list. --- */
  let parsedValues: Array<{ label: string; value: string | number; unit?: string }> = []
  try {
    const pv = JSON.parse((submission as any).values || '[]')
    if (Array.isArray(pv)) parsedValues = pv
  } catch {}
  let evidenceList: string[] = []
  try {
    const pe = JSON.parse((submission as any).evidence || '[]')
    if (Array.isArray(pe)) evidenceList = pe.filter(Boolean)
  } catch {}
  const corrections = parseJsonArray((submission as any).corrections as unknown as string)
  const history = parseJsonArray((submission as any).history as unknown as string)

  /* --- Evidence lookup maps (id → row; fileName → row). --- */
  const evidenceById = new Map<string, any>()
  for (const e of evidence) evidenceById.set(e.id, e)
  const evidenceNamesFor = (ids: string[]): string[] => {
    const out: string[] = []
    for (const id of Array.from(new Set(ids))) {
      const e = evidenceById.get(id)
      if (e) out.push(e.fileName)
      else out.push(id)
    }
    return out
  }

  /* ============ SECTIONS ============ */
  const sections: ReportSection[] = []
  const moduleLabel = MODULE_LABEL[submission.module || ''] || submission.module || 'General'
  const p = submission.project as any | null
  const rp = submission.reportingPeriod as any | null

  sections.push({
    kind: 'kv',
    title: 'Report Overview',
    note: 'Identity and provenance of this report document.',
    rows: [
      { k: 'Report ID', v: `SR-${submission.id.slice(-8).toUpperCase()}` },
      { k: 'Submission', v: submission.title || `Submission ${submission.id.slice(-6)}` },
      { k: 'Module', v: moduleLabel },
      { k: 'Workflow Status', v: STATUS_LABEL[submission.status] || submission.status },
      { k: 'Generated At', v: fmtDateTime(new Date()) },
      { k: 'Generated By', v: `${actor.name}${actor.email ? ` (${actor.email})` : ''}` },
      { k: 'Role', v: actor.role || '—' },
    ],
  })

  sections.push({
    kind: 'kv',
    title: 'Project Details',
    note: 'The site / facility this submission reports for.',
    rows: [
      { k: 'Project Name', v: p?.name || '—' },
      { k: 'Project Code', v: p?.code || '—' },
      { k: 'Project Type', v: p?.ptype || '—' },
      { k: 'Installed Capacity', v: p?.capacityMw ? `${num(p.capacityMw)} MW` : '—' },
      { k: 'Location', v: p?.location || '—' },
      { k: 'Reporting Frequency', v: p?.frequency || '—' },
      { k: 'Project Status', v: p?.status || '—' },
      { k: 'Business Unit', v: p?.businessUnit?.name ? `${p.businessUnit.name}${p.businessUnit.subsidiary?.name ? ` · ${p.businessUnit.subsidiary.name}` : ''}` : '—' },
    ],
  })

  if (rp) {
    sections.push({
      kind: 'kv',
      title: 'Reporting Period',
      note: 'When the reported activity takes place.',
      rows: [
        { k: 'Period Label', v: `${rp.periodLabel || '—'}${rp.reportingYear ? ` (FY ${rp.reportingYear.year})` : ''}` },
        { k: 'Period Type', v: rp.periodType || '—' },
        { k: 'Covers', v: `${fmtDate(rp.startDate)} → ${fmtDate(rp.endDate)}` },
        { k: 'Period Status', v: rp.status || '—' },
        { k: 'Submission Deadline', v: rp.submissionDeadline ? fmtDateTime(rp.submissionDeadline) : '—' },
        { k: 'Review Deadline', v: rp.reviewDeadline ? fmtDateTime(rp.reviewDeadline) : '—' },
        { k: 'Approval Deadline', v: rp.approvalDeadline ? fmtDateTime(rp.approvalDeadline) : '—' },
      ],
    })
  }

  sections.push({
    kind: 'kv',
    title: 'Submission Summary',
    note: 'Workflow position, attribution and completion of this submission.',
    rows: [
      { k: 'Workflow Path', v: statusPath(submission.status) },
      { k: 'Submitted By', v: (submission as any).submittedBy || '—' },
      { k: 'Submitted At', v: submission.submittedAt ? fmtDateTime(submission.submittedAt) : `Draft created ${fmtDateTime(submission.createdAt)}` },
      { k: 'Current Reviewer', v: submission.reviewer?.name ? `${submission.reviewer.name}${submission.reviewer.email ? ` (${submission.reviewer.email})` : ''}` : '—' },
      { k: 'Reviewed At', v: (submission as any).reviewedAt ? fmtDateTime((submission as any).reviewedAt) : '—' },
      { k: 'Locked At', v: submission.lockedAt ? fmtDateTime(submission.lockedAt) : '—' },
      { k: 'Completion', v: `${num((submission as any).completionPct ?? 0)}%` },
      { k: 'Captured Records', v: String(recordIds.length) },
      { k: 'Evidence Documents', v: String(evidenceList.length || (submission as any).evidenceCount || evidence.length) },
      { k: 'Validation', v: `${num((submission as any).validationPassed ?? 0)} passed · ${num((submission as any).validationErrors ?? 0)} errors` },
      { k: 'Record Revision', v: `v${num((submission as any).revisionNumber ?? 1)}` },
    ],
  })

  if (parsedValues.length > 0) {
    sections.push({
      kind: 'table',
      title: 'Captured Data Fields',
      note: 'Top-level metric values recorded by the contributor.',
      columns: ['Field', 'Value', 'Unit'],
      rows: parsedValues.map(v => [String(v.label), fmtValue(v.value), v.unit || '']),
    })
  }

  if (sourceRecords.length > 0) {
    const rows: string[][] = []
    const num2 = (n: unknown) => (typeof n === 'number' ? String(Math.round(n * 100) / 100) : '—')
    sourceRecords.forEach((lr, idx) => {
      const calc = lr?.calculation ?? null
      const calcShort = calc && calc.calculatedValue !== undefined && calc.calculatedValue !== null
        ? `${num2(calc.calculatedValue)} ${calc.resultUnit || ''}${calc.scope ? ` · ${calc.scope}` : ''}`
        : (lr as any).calculation ? String((lr as any).calculation.calculatedValue ?? '—') : '—'
      const recEvidence = evidenceNamesFor([
        ...((Array.isArray(lr?.evidenceIds) ? lr.evidenceIds : []) as string[]),
        ...(lr?.evidenceId ? [lr.evidenceId] : []),
        ...((Array.isArray(lr?.data?.items) ? lr.data.items : []).flatMap((it: any) => (Array.isArray(it?.evidenceIds) ? it.evidenceIds : []))),
      ].filter(Boolean))
      rows.push([
        `${idx + 1}. ${lr?.levelName || lr?.recordType || 'Record'}`,
        'Record Status',
        `${STATUS_LABEL[lr?.status] || lr?.status || '—'} · validation ${lr?.validationStatus || '—'} · calc ${calcShort}`,
        recEvidence.length > 0 ? recEvidence.join(',') : '—',
      ])
      const data = lr?.data ?? {}
      const items: any[] = Array.isArray(data?.items) ? data.items : []
      if (items.length > 0) {
        items.forEach((it, ii) => {
          rows.push(['', `Source item ${ii + 1}`, itemTitle(it as any) || 'Source item', ''])
          for (const [k, v] of itemFieldEntries(it as any)) {
            rows.push(['', `· ${fieldLabel(String(k))}`, fmtValue(v), ''])
          }
        })
      } else {
        for (const [k, v] of itemFieldEntries(data)) {
          rows.push(['', fieldLabel(String(k)), fmtValue(v), ''])
        }
      }
    })
    sections.push({
      kind: 'table',
      title: `Source Records · ${moduleLabel}`,
      note: `${sourceRecords.length} captured record(s) incl. individual sources and their evidence.`,
      columns: ['Source Record', 'Field', 'Value', 'Evidence'],
      rows,
    })
  }

  if (evidence.length > 0) {
    sections.push({
      kind: 'table',
      title: 'Evidence Vault',
      note: 'Supporting documents attached to this submission (SHA-256 sealed).',
      columns: ['Document', 'Type', 'Status', 'Size', 'Uploaded By', 'Uploaded At'],
      rows: evidence.map((e: any) => [
        e.fileName || '—',
        e.documentType || '—',
        e.status || '—',
        humanBytes(e.fileSize),
        e.uploader?.name || '—',
        fmtDateTime(e.createdAt),
      ]),
    })
  }

  if (validationRows.length > 0) {
    sections.push({
      kind: 'table',
      title: 'Validation Results',
      note: 'Rule engine outcomes recorded against the captured records.',
      columns: ['Rule', 'Severity', 'Field', 'Message', 'Status', 'Detected At'],
      rows: validationRows.map((v: any) => [
        v.ruleCode || '—',
        v.severity || '—',
        v.field || '—',
        v.message || '—',
        v.status || '—',
        fmtDateTime(v.detectedAt),
      ]),
    })
  }

  if (calcRows.length > 0) {
    sections.push({
      kind: 'table',
      title: 'Calculation Results',
      note: 'Engine-computed values with factors and lineage.',
      columns: ['Result', 'Unit', 'Scope', 'Factor v', 'Calculated At'],
      rows: calcRows.map((c: any) => [
        typeof c.calculatedValue === 'number' ? String(Math.round(c.calculatedValue * 100) / 100) : num(c.calculatedValue),
        c.resultUnit || '—',
        c.scope || '—',
        c.factorVersion ? `v${c.factorVersion}` : '—',
        fmtDateTime(c.calculatedAt),
      ]),
    })
  }

  if (history.length > 0) {
    sections.push({
      kind: 'table',
      title: 'Workflow History',
      note: 'Every action taken on this submission, oldest first.',
      columns: ['When', 'Action', 'Transition', 'Actor', 'Comment'],
      rows: history.map((h: any) => [
        fmtDateTime(h.createdAt),
        ACTION_LABEL[h.action] || h.action || '—',
        `${STATUS_LABEL[h.fromStatus] || h.fromStatus || '—'} → ${STATUS_LABEL[h.toStatus] || h.toStatus || '—'}`,
        `${h.actorName || '—'}${h.actorRole ? ` (${h.actorRole})` : ''}`,
        h.comment || '',
      ]),
    })
  }

  if (auditRows.length > 0) {
    sections.push({
      kind: 'table',
      title: 'Audit Trail',
      note: 'System audit log entries for this submission.',
      columns: ['When', 'Action', 'Actor', 'Reason'],
      rows: auditRows.map((l: any) => [fmtDateTime(l.createdAt), l.action || '—', l.actorName || '—', l.reason || '']),
    })
  }

  if (corrections.length > 0) {
    sections.push({
      kind: 'table',
      title: 'Reviewer Corrections / Feedback',
      note: 'Raised by the reviewer — resolve these before sign-off.',
      columns: ['Field', 'Severity', 'Issue', 'Comment', 'Raised By', 'Status'],
      rows: corrections.map((c: any) => [
        c.field || '—',
        c.severity || '—',
        c.issue || c.comment || '—',
        c.comment || '',
        c.requesterName || '—',
        c.resolvedAt ? `Resolved ${fmtDate(c.resolvedAt)}` : (c.status || 'OPEN'),
      ]),
    })
  }

  if (evidenceList.length > 0 && evidence.length === 0) {
    sections.push({
      kind: 'table',
      title: 'Referenced Evidence Files',
      note: 'File names recorded on the submission card.',
      columns: ['Document File'],
      rows: evidenceList.map(n => [n]),
    })
  }

  const fileNameBase = [
    'MEIL-Submission-Report',
    p?.code || 'project',
    submission.module || 'module',
    (rp?.periodLabel || 'period').replace(/\s+/g, '-'),
    submission.id.slice(-6),
  ]
    .map(s => String(s).replace(/[^A-Za-z0-9._-]+/g, '-'))
    .join('-')

  return {
    meta: {
      title: 'Submission Report',
      submissionId: submission.id,
      module: submission.module || '',
      moduleLabel,
      status: STATUS_LABEL[submission.status] || submission.status,
      projectLabel: `${p?.name || ''} (${p?.code || ''})`.trim(),
      periodLabel: rp?.periodLabel || '—',
      generatedAt: new Date().toISOString(),
      generatedBy: { name: actor.name, email: actor.email, role: actor.role },
      fileNameBase,
    },
    sections,
    attach: { evidence: evidence.map((e: any) => ({ id: e.id, fileName: e.fileName })) },
  }
}

/* ---------------- CSV (Excel) renderer ---------------- */

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function renderReportCsv(m: SubmissionReportModel): string {
  const rows: string[][] = []
  rows.push(['MEIL ESG Platform', '', ''])
  rows.push(['Submission Report', '', ''])
  rows.push(['Module', m.meta.moduleLabel, ''])
  rows.push(['Project', m.meta.projectLabel, ''])
  rows.push(['Period', m.meta.periodLabel, ''])
  rows.push(['Generated At', fmtDateTime(m.meta.generatedAt), ''])
  rows.push(['Generated By', m.meta.generatedBy.name, ''])
  rows.push(['', '', ''])
  for (const s of m.sections) {
    if (s.kind === 'kv') {
      rows.push([`# ${s.title}`, '', ''])
      for (const kv of s.rows) rows.push([kv.k, kv.v, ''])
    } else {
      rows.push([`# ${s.title}`, '', ''])
      if (s.note) rows.push([s.note, '', ''])
      rows.push(s.columns)
      for (const r of s.rows) {
        rows.push(s.columns.map((_, i) => r[i] ?? ''))
      }
    }
    rows.push(['', '', ''])
  }
  return rows.map(r => r.map(csvCell).join(',')).join('\r\n')
}

/* ---------------- HTML (Print / Word) renderer ---------------- */

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function htmlTable(s: Extract<ReportSection, { kind: 'table' }>, evidenceByIdName: Map<string, any>): string {
  const head = s.columns.map(c => `<th>${esc(c)}</th>`).join('')
  const body = s.rows
    .map(r =>
      s.columns
        .map((colName, i) => {
          let cell = esc(r[i] ?? '')
          if (i === 0 && colName.toLowerCase() === 'document') {
            const ev = evidenceByIdName.get(String(r[0] ?? ''))
            if (ev) cell = `<a href="/api/pu/evidence/${esc(ev.id)}/file" target="_blank" rel="noopener">${esc(r[0])}</a>`
          }
          return `<td>${cell}</td>`
        })
        .join(''),
    )
    .map(r => `<tr>${r}</tr>`)
    .join('')
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
}

export function renderReportHtml(m: SubmissionReportModel, opts: { forWord?: boolean } = {}): string {
  const evidenceByName = new Map<string, any>()
  for (const e of m.attach.evidence) evidenceByName.set(e.fileName, e)

  const body = m.sections
    .map(s => {
      if (s.kind === 'kv') {
        return `<section><div class="sec-head"><h2>${esc(s.title)}</h2>${s.note ? `<p class="note">${esc(s.note)}</p>` : ''}</div>
<table class="kv"><tbody>${s.rows.map(r => `<tr><th>${esc(r.k)}</th><td>${esc(r.v)}</td></tr>`).join('')}</tbody></table></section>`
      }
      return `<section><div class="sec-head"><h2>${esc(s.title)}</h2>${s.note ? `<p class="note">${esc(s.note)}</p>` : ''}</div>${htmlTable(s, evidenceByName)}</section>`
    })
    .join('')

  const printBtn = opts.forWord
    ? ''
    : `<div class="actions"><button onclick="window.print()">Print / Save as PDF</button></div>`

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(m.meta.title)} · ${esc(m.meta.projectLabel)} · ${esc(m.meta.periodLabel)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', -apple-system, Helvetica, Arial, sans-serif; color: #1e293b; margin: 0; background: #f1f5f9; }
  .page { max-width: 210mm; margin: 24px auto; background: #fff; padding: 32px 36px; box-shadow: 0 1px 12px rgba(15,23,42,.12); border-radius: 6px; }
  .brand { display:flex; align-items:center; gap:10px; font-size:11px; font-weight:800; letter-spacing:.18em; text-transform:uppercase; color:#2563eb; }
  .brand .dot { width:9px; height:9px; border-radius:50%; background:#2563eb; }
  h1 { font-size:22px; color:#0f172a; margin:10px 0 2px; }
  .sub { color:#64748b; font-size:12px; margin:0 0 14px; }
  .meta-band { background:#0f172a; color:#e2e8f0; border-radius:8px; padding:12px 16px; font-size:11.5px; display:flex; flex-wrap:wrap; gap:4px 22px; margin-bottom:6px; }
  .meta-band b { color:#93c5fd; font-weight:700; margin-right:4px; }
  section { margin-top:22px; page-break-inside: avoid; }
  h2 { font-size:13.5px; color:#0f172a; border-left:4px solid #2563eb; padding-left:8px; margin:0; letter-spacing:.02em; }
  .note { color:#64748b; font-size:10.5px; margin:3px 0 8px; padding-left:12px; }
  table { width:100%; border-collapse:collapse; font-size:10.5px; }
  th, td { border:1px solid #e2e8f0; padding:5px 8px; text-align:left; vertical-align:top; word-break:break-word; }
  thead th { background:#f1f5f9; color:#334155; font-size:9.5px; text-transform:uppercase; letter-spacing:.06em; }
  table.kv th { width:190px; background:#f8fafc; font-weight:600; color:#334155; }
  tbody tr:nth-child(even) { background:#fcfdfe; }
  a { color:#2563eb; text-decoration:none; }
  .actions { margin:18px 0 4px; display:none; }
  .actions button { background:#2563eb; color:#fff; border:0; border-radius:999px; padding:8px 18px; font-size:12px; font-weight:700; cursor:pointer; }
  @media print { .page { box-shadow:none; margin:0; border-radius:0; max-width:none; } body { background:#fff; } .actions { display:none !important; } }
  @media screen { .actions { display:flex; justify-content:flex-end; } }
  footer { margin-top:26px; border-top:1px solid #e2e8f0; padding-top:10px; color:#94a3b8; font-size:9.5px; display:flex; justify-content:space-between; }
</style>
</head>
<body>
<div class="page">
  <div class="brand"><span class="dot"></span> MEIL Group · ESG / BRSR Reporting</div>
  <h1>${esc(m.meta.title)}</h1>
  <p class="sub">${esc(m.meta.moduleLabel)} · Workflow status: ${esc(m.meta.status)} · Report ID SR-${esc(m.meta.submissionId.slice(-8).toUpperCase())}</p>
  <div class="meta-band">
    <span><b>Project</b> ${esc(m.meta.projectLabel)}</span>
    <span><b>Period</b> ${esc(m.meta.periodLabel)}</span>
    <span><b>Generated</b> ${esc(fmtDateTime(m.meta.generatedAt))}</span>
    <span><b>By</b> ${esc(m.meta.generatedBy.name)}</span>
  </div>
  ${body}
  ${printBtn}
  <footer><span>MEIL ESG / BRSR Reporting Platform — confidential internal document</span><span>Generated ${esc(fmtDateTime(m.meta.generatedAt))}</span></footer>
</div>
</body>
</html>`
}
