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
import { db } from '@/lib/db'

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
  return db.auditLog.create({
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

export async function appendHistory(ctx: HistoryContext) {
  return db.submissionStatusHistory.create({
    data: {
      submissionId: ctx.submissionId,
      fromStatus: ctx.fromStatus,
      toStatus: ctx.toStatus,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      actorRole: ctx.actorRole,
      action: ctx.action,
      comment: ctx.comment ?? null,
      reason: ctx.reason ?? null,
      oldValues: ctx.oldValues != null ? JSON.stringify(ctx.oldValues) : null,
      newValues: ctx.newValues != null ? JSON.stringify(ctx.newValues) : null,
    },
  })
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
  return db.notification.create({
    data: {
      userId: ctx.userId,
      type: ctx.type,
      title: ctx.title,
      message: ctx.message,
      severity: ctx.severity ?? 'INFO',
      linkEntity: ctx.linkEntity ?? null,
      linkId: ctx.linkId ?? null,
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
    const { getLevelRecordById } = await import('@/lib/level-records')
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
