/**
 * Workflow state machine + immutable audit/activity/history/notify helpers.
 *
 * Lifecycle (master spec):
 *   DRAFT → SUBMITTED → UNDER_REVIEW → CORRECTION_REQUESTED → RESUBMITTED
 *         → BU_APPROVED → SUBSIDIARY_APPROVED → HQ_REVIEW → LOCKED
 *
 * Locked records cannot be edited through normal endpoints.
 * Corrections always create new revisions/history rows — never overwrite.
 */
import { db } from '@/lib/pu/db'

export const SUBMISSION_STATES = [
  'DRAFT',
  'SUBMITTED',
  'PENDING',
  'UNDER_REVIEW',
  'CORRECTION_REQUESTED',
  'RESUBMITTED',
  'BU_APPROVED',
  'SUBSIDIARY_APPROVED',
  'HQ_REVIEW',
  'APPROVED',
  'ACTIVE',
  'LOCKED',
] as const
export type SubmissionState = (typeof SUBMISSION_STATES)[number]

// Explicit allowed transitions.
const ALLOWED: Record<string, string[]> = {
  DRAFT: ['SUBMITTED', 'PENDING'],
  SUBMITTED: ['UNDER_REVIEW', 'BU_APPROVED', 'CORRECTION_REQUESTED', 'APPROVED', 'ACTIVE'],
  PENDING: ['UNDER_REVIEW', 'BU_APPROVED', 'CORRECTION_REQUESTED', 'APPROVED', 'ACTIVE'],
  UNDER_REVIEW: ['CORRECTION_REQUESTED', 'BU_APPROVED', 'APPROVED', 'ACTIVE'],
  CORRECTION_REQUESTED: ['RESUBMITTED', 'DRAFT', 'SUBMITTED', 'PENDING'],
  RESUBMITTED: ['UNDER_REVIEW', 'BU_APPROVED', 'CORRECTION_REQUESTED', 'APPROVED', 'ACTIVE'],
  BU_APPROVED: ['SUBSIDIARY_APPROVED', 'APPROVED', 'ACTIVE'],
  SUBSIDIARY_APPROVED: ['HQ_REVIEW', 'APPROVED', 'ACTIVE'],
  HQ_REVIEW: ['LOCKED', 'APPROVED', 'ACTIVE'],
  APPROVED: ['LOCKED', 'ACTIVE'],
  ACTIVE: ['LOCKED'],
  LOCKED: [],
}

export function canTransition(from: string, to: string): boolean {
  if (from === to) return true
  return (ALLOWED[from] || []).includes(to)
}

// Approve step sequence (used by /approve endpoint — derive next from current).
const APPROVE_SEQUENCE: SubmissionState[] = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'BU_APPROVED',
  'SUBSIDIARY_APPROVED',
  'HQ_REVIEW',
  'LOCKED',
]

export function nextApproveStatus(current: string): string | null {
  if (current === 'SUBMITTED' || current === 'PENDING' || current === 'RESUBMITTED') {
    return 'BU_APPROVED'
  }
  if (current === 'UNDER_REVIEW') {
    return 'BU_APPROVED'
  }
  const idx = APPROVE_SEQUENCE.indexOf(current as SubmissionState)
  if (idx < 0 || idx + 1 >= APPROVE_SEQUENCE.length) return null
  return APPROVE_SEQUENCE[idx + 1]
}

export function isLocked(status: string): boolean {
  return status === 'LOCKED'
}

// ---------------------------------------------------------------------------
// Audit / Activity / History / Notification appenders
// ---------------------------------------------------------------------------

export interface AuditContext {
  actorId: string
  actorName: string
  actorRole: string
  action: string
  entityType: string
  entityId: string
  reason?: string | null
  oldState?: unknown
  newState?: unknown
  metadata?: unknown
  ipAddress?: string | null
}

export async function appendAudit(ctx: AuditContext) {
  return db.soAuditLog.create({
    data: {
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: ctx.action,
      entityType: ctx.entityType,
      entityId: ctx.entityId,
      oldState: ctx.oldState != null ? JSON.stringify(ctx.oldState) : null,
      newState: ctx.newState != null ? JSON.stringify(ctx.newState) : null,
      reason: ctx.reason ?? null,
      metadata: ctx.metadata != null ? JSON.stringify(ctx.metadata) : null,
      ipAddress: ctx.ipAddress ?? null,
    },
  })
}

export interface ActivityContext {
  projectId: string
  actorId: string
  actorName: string
  actorRole: string
  action: string
  title: string
  description?: string | null
  module?: string | null
  status?: string | null
}

export async function appendActivity(ctx: ActivityContext) {
  return db.activity.create({
    data: {
      projectId: ctx.projectId,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: ctx.action,
      title: ctx.title,
      description: ctx.description ?? null,
      module: ctx.module ?? null,
      status: ctx.status ?? null,
    },
  })
}

export interface HistoryContext {
  submissionId: string
  fromStatus: string
  toStatus: string
  actorId: string
  actorName: string
  actorRole: string
  action: string
  comment?: string | null
  reason?: string | null
  oldValues?: unknown
  newValues?: unknown
}

/** Parse a JSON-array column defensively (history / corrections / recordIds). */
export function parseJsonArray(raw: string | null | undefined): Record<string, unknown>[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

/** Append a status-history entry to the shared Submission ledger (JSON column).
 *  Same entry shape the consoles render: fromStatus/toStatus/action/actor/comment… */
export async function appendHistory(ctx: HistoryContext) {
  const row = await db.submission.findUnique({
    where: { id: ctx.submissionId },
    select: { history: true },
  })
  const entries = parseJsonArray(row?.history)
  entries.push({
    id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fromStatus: ctx.fromStatus,
    toStatus: ctx.toStatus,
    actorId: ctx.actorId,
    actorName: ctx.actorName,
    actorRole: ctx.actorRole,
    action: ctx.action,
    comment: ctx.comment ?? null,
    reason: ctx.reason ?? null,
    oldValues: ctx.oldValues ?? null,
    newValues: ctx.newValues ?? null,
    createdAt: new Date().toISOString(),
  })
  return db.submission.update({
    where: { id: ctx.submissionId },
    data: { history: JSON.stringify(entries) },
  })
}

export interface CorrectionInput {
  field: string
  issue: string
  severity?: string
  comment?: string | null
}

/** Create correction requests on the shared Submission ledger (JSON column). */
export async function addCorrections(
  submissionId: string,
  requesterId: string,
  requesterName: string,
  corrections: CorrectionInput[],
) {
  const row = await db.submission.findUnique({
    where: { id: submissionId },
    select: { corrections: true },
  })
  const entries = parseJsonArray(row?.corrections)
  const created = corrections.map((c, i) => ({
    id: `cr-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
    submissionId,
    requesterId,
    requesterName,
    field: c.field,
    issue: c.issue,
    severity: c.severity ?? 'WARNING',
    comment: c.comment ?? null,
    status: 'OPEN',
    createdAt: new Date().toISOString(),
  }))
  await db.submission.update({
    where: { id: submissionId },
    data: { corrections: JSON.stringify([...entries, ...created]) },
  })
  return created
}

/** List corrections for a submission (optionally only OPEN ones). */
export async function listCorrections(submissionId: string, onlyOpen = false) {
  const row = await db.submission.findUnique({
    where: { id: submissionId },
    select: { corrections: true },
  })
  const all = parseJsonArray(row?.corrections)
  return onlyOpen ? all.filter((c) => c.status === 'OPEN') : all
}

/** Mark a submission's corrections ADDRESSED (history preserved in entries). */
export async function addressCorrections(submissionId: string) {
  const row = await db.submission.findUnique({
    where: { id: submissionId },
    select: { corrections: true },
  })
  const entries = parseJsonArray(row?.corrections)
  const now = new Date().toISOString()
  const updated = entries.map((c) =>
    c.status === 'OPEN' ? { ...c, status: 'ADDRESSED', resolvedAt: now } : c,
  )
  await db.submission.update({
    where: { id: submissionId },
    data: { corrections: JSON.stringify(updated) },
  })
  return updated.filter((c) => c.status === 'ADDRESSED')
}


/** Project object compatibility projection — the portal UI reads
 *  project.projectName / project.projectCode (legacy contract); the unified
 *  Project model exposes name / code. Always non-null for list rows. */
export const SAFE_PROJECT = {
  id: '', name: 'Unassigned', code: '—', projectName: 'Unassigned', projectCode: '—',
  location: null as string | null, status: 'ACTIVE',
}

export function withProjectCompat<P extends { id?: string; name?: string | null; code?: string | null } | null | undefined>(
  project: P,
): P & { projectName: string; projectCode: string } {
  const base = (project ?? {}) as P & { name?: string | null; code?: string | null }
  return {
    ...(base as object),
    projectName: base.name ?? 'Unassigned',
    projectCode: base.code ?? '—',
  } as P & { projectName: string; projectCode: string }
}

export function submissionCompat<S extends { project?: { id?: string; name?: string | null; code?: string | null } | null; reportingPeriod?: unknown; period?: string | null }>(
  row: S,
): S & { project: { projectName: string; projectCode: string }; reportingPeriod: { id: string; periodLabel: string; year: number; month: number | null; status: string } } {
  const rp = (row as { reportingPeriod?: { id: string; periodLabel: string; year?: number; month?: number | null; status?: string } | null }).reportingPeriod
  const periodLabel = (row as { period?: string | null }).period ?? ''
  const r = row as S & {
    completionPct?: number | null; evidenceCount?: number | null
    validationPassed?: number | null; validationErrors?: number | null
    history?: string | null; corrections?: string | null
  }
  return {
    ...(r as object),
    project: withProjectCompat(row.project),
    reportingPeriod: rp ?? {
      id: '',
      periodLabel,
      year: Number(periodLabel.slice(-7, -3)) || new Date().getFullYear(),
      month: null,
      status: 'OPEN',
    },
    completionPct: r.completionPct ?? 0,
    evidenceCount: r.evidenceCount ?? 0,
    validationPassed: r.validationPassed ?? 0,
    validationErrors: r.validationErrors ?? 0,
  } as unknown as S & { project: { projectName: string; projectCode: string }; reportingPeriod: { id: string; periodLabel: string; year: number; month: number | null; status: string } }
}

export interface NotifyContext {
  userId: string
  type: string
  title: string
  message: string
  severity?: string
  linkEntity?: string | null
  linkId?: string | null
}

export async function notifyUser(ctx: NotifyContext) {
  // Unified broadcast ledger — visible to the portal AND the other consoles.
  const severity = ['INFO', 'SUCCESS', 'WARNING', 'CRITICAL'].includes(String(ctx.severity ?? 'INFO'))
    ? String(ctx.severity ?? 'INFO')
    : 'INFO'
  return db.notification.create({
    data: {
      ntype: ctx.type,
      title: ctx.title,
      body: ctx.message,
      severity,
      read: false,
      linkView: 'dashboard',
      refId: ctx.linkId ?? '',
    },
  })
}

// ---------------------------------------------------------------------------
// Source record helpers
// ---------------------------------------------------------------------------

// Common projection shared by all ESG source record models.
const SOURCE_COMMON_SELECT = {
  id: true,
  projectId: true,
  reportingPeriodId: true,
  module: true,
  evidenceId: true,
  validationStatus: true,
  calculationStatus: true,
  revisionNumber: true,
  status: true,
  enteredBy: true,
  enteredAt: true,
  updatedAt: true,
} as const

export interface SourceRecordSummary {
  id: string
  projectId: string
  reportingPeriodId: string
  module: string
  evidenceId: string | null
  validationStatus: string
  calculationStatus: string | null
  revisionNumber: number
  status: string
  enteredBy: string
  enteredAt: Date
  updatedAt: Date | null
}

/**
 * Fetch source records by module. Returns a normalized summary projection
 * (the underlying model fields vary slightly per module but all share the
 * canonical source-record shape: validationStatus, evidenceId, revisionNumber…).
 */
export async function fetchSourceRecords(
  recordIds: string[],
  module: string,
): Promise<SourceRecordSummary[]> {
  if (recordIds.length === 0) return []
  const out: SourceRecordSummary[] = []
  const remainingIds = new Set(recordIds)

  // 1. Try Prisma models where applicable
  try {
    switch (module) {
      case 'ENVIRONMENT': {
        const [eRows, wRows, wstRows, tRows] = await Promise.all([
          db.energyRecord.findMany({ where: { id: { in: Array.from(remainingIds) } } }),
          db.waterRecord.findMany({ where: { id: { in: Array.from(remainingIds) } } }),
          db.wasteRecord.findMany({ where: { id: { in: Array.from(remainingIds) } } }),
          db.travelRecord.findMany({ where: { id: { in: Array.from(remainingIds) } } }),
        ])
        for (const r of [...eRows, ...wRows, ...wstRows, ...tRows]) {
          out.push(r as unknown as SourceRecordSummary)
          remainingIds.delete(r.id)
        }
        break
      }
      case 'ENERGY': {
        const rows = await db.energyRecord.findMany({
          where: { id: { in: Array.from(remainingIds) } },
          select: {
            id: true,
            projectId: true,
            reportingPeriodId: true,
            module: true,
            evidenceId: true,
            validationStatus: true,
            calculationStatus: true,
            revisionNumber: true,
            status: true,
            enteredBy: true,
            enteredAt: true,
            updatedAt: true,
          },
        })
        for (const r of rows) {
          out.push(r as unknown as SourceRecordSummary)
          remainingIds.delete(r.id)
        }
        break
      }
      case 'WATER': {
        const rows = await db.waterRecord.findMany({
          where: { id: { in: Array.from(remainingIds) } },
          select: {
            id: true,
            projectId: true,
            reportingPeriodId: true,
            module: true,
            evidenceId: true,
            validationStatus: true,
            calculationStatus: true,
            revisionNumber: true,
            status: true,
            enteredBy: true,
            enteredAt: true,
            updatedAt: true,
          },
        })
        for (const r of rows) {
          out.push(r as unknown as SourceRecordSummary)
          remainingIds.delete(r.id)
        }
        break
      }
      case 'WASTE': {
        const rows = await db.wasteRecord.findMany({
          where: { id: { in: Array.from(remainingIds) } },
          select: {
            id: true,
            projectId: true,
            reportingPeriodId: true,
            module: true,
            evidenceId: true,
            validationStatus: true,
            calculationStatus: true,
            revisionNumber: true,
            status: true,
            enteredBy: true,
            enteredAt: true,
            updatedAt: true,
          },
        })
        for (const r of rows) {
          out.push(r as unknown as SourceRecordSummary)
          remainingIds.delete(r.id)
        }
        break
      }
      case 'PEOPLE':
      case 'TRAINING': {
        const rows = await db.workforceRecord.findMany({
          where: { id: { in: Array.from(remainingIds) } },
          select: {
            id: true,
            projectId: true,
            reportingPeriodId: true,
            module: true,
            evidenceId: true,
            validationStatus: true,
            revisionNumber: true,
            status: true,
            enteredBy: true,
            enteredAt: true,
            updatedAt: true,
          },
        })
        for (const r of rows) {
          out.push({
            ...r,
            calculationStatus: 'NOT_APPLICABLE',
          } as unknown as SourceRecordSummary)
          remainingIds.delete(r.id)
        }
        break
      }
      case 'SAFETY': {
        const rows = await db.safetyRecord.findMany({
          where: { id: { in: Array.from(remainingIds) } },
          select: {
            id: true,
            projectId: true,
            reportingPeriodId: true,
            module: true,
            evidenceId: true,
            validationStatus: true,
            revisionNumber: true,
            status: true,
            enteredBy: true,
            enteredAt: true,
            updatedAt: true,
          },
        })
        for (const r of rows) {
          out.push({
            ...r,
            calculationStatus: 'COMPUTED',
          } as unknown as SourceRecordSummary)
          remainingIds.delete(r.id)
        }
        break
      }
      case 'TRAVEL': {
        const rows = await db.travelRecord.findMany({
          where: { id: { in: Array.from(remainingIds) } },
          select: {
            id: true,
            projectId: true,
            reportingPeriodId: true,
            module: true,
            evidenceId: true,
            validationStatus: true,
            calculationStatus: true,
            revisionNumber: true,
            status: true,
            enteredBy: true,
            enteredAt: true,
            updatedAt: true,
          },
        })
        for (const r of rows) {
          out.push(r as unknown as SourceRecordSummary)
          remainingIds.delete(r.id)
        }
        break
      }
    }
  } catch (err) {
    console.warn('Prisma fetchSourceRecords lookup notice:', err)
  }

  // 2. For any record not found in Prisma (or for extended modules like EMISSIONS, COMPLIANCE, INCIDENTS, INITIATIVES), check level-records store
  if (remainingIds.size > 0) {
    const { getLevelRecordById } = await import('@/lib/pu/level-records')
    for (const id of Array.from(remainingIds)) {
      const lr = getLevelRecordById(id)
      if (lr) {
        out.push({
          id: lr.id,
          projectId: lr.projectId,
          reportingPeriodId: lr.reportingPeriodId,
          module: lr.module,
          evidenceId: lr.evidenceId ?? null,
          validationStatus: lr.validationStatus,
          calculationStatus: lr.calculationStatus,
          revisionNumber: lr.revisionNumber,
          status: lr.status,
          enteredBy: lr.enteredBy,
          enteredAt: new Date(lr.enteredAt),
          updatedAt: lr.updatedAt ? new Date(lr.updatedAt) : null,
        })
        remainingIds.delete(id)
      }
    }
  }

  return out
}

/**
 * Compute workflow rollup from underlying source records:
 *   completionPct, evidenceCount, validationPassed, validationErrors
 * Validation status convention: PASSED | FAILED | ERROR | BLOCKING | WARNING | PENDING
 */
export function computeSubmissionRollup(records: SourceRecordSummary[]) {
  const total = records.length
  const validationPassed = records.filter(
    (r) => r.validationStatus === 'PASSED',
  ).length
  const validationErrors = records.filter((r) =>
    ['FAILED', 'ERROR', 'BLOCKING'].includes(r.validationStatus),
  ).length
  const evidenceIds = new Set<string>()
  for (const r of records) if (r.evidenceId) evidenceIds.add(r.evidenceId)
  const evidenceCount = evidenceIds.size
  const completionPct =
    total === 0 ? 0 : Math.round((validationPassed / total) * 1000) / 10
  return {
    total,
    validationPassed,
    validationErrors,
    evidenceCount,
    completionPct,
  }
}

/**
 * Map an auth/permission error to an HTTP status code, or null if not an auth error.
 */
export function authErrorToStatus(e: unknown): number | null {
  if (e instanceof Error) {
    if (e.message === 'UNAUTHENTICATED') return 401
    if (e.message === 'FORBIDDEN') return 403
  }
  return null
}

/**
 * Attempt to read the caller's primary role label for audit attribution.
 */
export function primaryRoleLabel(user: {
  roles: { key: string; name: string }[]
}): string {
  if (!user.roles || user.roles.length === 0) return 'ANONYMOUS'
  return user.roles[0].key
}

/**
 * Parse the JSON-encoded `recordIds` column on a Submission safely.
 */
export function parseRecordIds(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.map((x) => String(x))
    return []
  } catch {
    return []
  }
}
