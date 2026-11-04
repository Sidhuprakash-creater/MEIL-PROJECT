import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/pu/db'
import { requirePermission } from '@/lib/pu/session'
import {
  appendActivity,
  appendAudit,
  appendHistory,
  authErrorToStatus,
  computeSubmissionRollup,
  fetchSourceRecords,
  isLocked,
  parseRecordIds,
  primaryRoleLabel,
  SAFE_PROJECT,
  withProjectCompat,
} from '@/lib/pu/workflow'

import { invalidatePuOverviewCache } from '@/app/api/pu/overview/route'
import { invalidatePuSubmissionsCache } from '@/app/api/pu/submissions/route'
import { invalidatePuNotificationsCache } from '@/app/api/pu/notifications/route'
import { invalidatePaServerCache } from '@/lib/project-admin/server'

export const runtime = 'nodejs'

// POST /api/submissions/[id]/submit
// Transition DRAFT → SUBMITTED.
// All referenced source records must have validationStatus === 'PASSED'.
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  let user
  try {
    user = await requirePermission('submission.submit')
  } catch (e) {
    const code = authErrorToStatus(e)
    return NextResponse.json(
      { error: code === 403 ? 'Forbidden' : 'Unauthenticated' },
      { status: code ?? 500 },
    )
  }

  const { id } = await ctx.params
  let comment: string | undefined
  try {
    const body = await req.json().catch(() => ({}))
    if (body && typeof body.comment === 'string') comment = body.comment
  } catch {
    /* ignore body parse errors */
  }

  try {
    const submission = await db.submission.findUnique({ where: { id } })
    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }
    if (isLocked(submission.status)) {
      return NextResponse.json(
        { error: 'Submission is locked and cannot be modified' },
        { status: 409 },
      )
    }
    if (submission.status !== 'DRAFT') {
      return NextResponse.json(
        {
          error: 'Invalid state transition',
          from: submission.status,
          to: 'SUBMITTED',
          detail: 'Only DRAFT submissions can be submitted',
        },
        { status: 409 },
      )
    }

    // --- Validation gate: blocking errors prevent submission ---
    const recordIds = parseRecordIds(submission.recordIds)
    const records = await fetchSourceRecords(recordIds, submission.module ?? '')
    const blocking = records.filter(
      (r) =>
        r.validationStatus === 'FAILED' ||
        r.validationStatus === 'ERROR' ||
        r.validationStatus === 'BLOCKING',
    )
    if (blocking.length > 0) {
      return NextResponse.json(
        {
          error: 'Validation failed — cannot submit with blocking errors',
          blockingErrors: blocking.map((r) => ({
            recordId: r.id,
            module: r.module,
            validationStatus: r.validationStatus,
            reason: `Record ${r.id} has validation status ${r.validationStatus} (resolve errors before submitting)`,
          })),
        },
        { status: 400 },
      )
    }

    // Refresh rollup at submission time
    const rollup = computeSubmissionRollup(records)

    const updated = await db.submission.update({
      where: { id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        submittedById: submission.submittedById || user.id,
        completionPct: rollup.completionPct,
        evidenceCount: rollup.evidenceCount,
        validationPassed: rollup.validationPassed,
        validationErrors: rollup.validationErrors,
      },
      include: {
        project: { select: { id: true, name: true, code: true } },
        reportingPeriod: { select: { id: true, periodLabel: true } },
      },
    })

    invalidatePuOverviewCache()
    invalidatePuSubmissionsCache()
    invalidatePuNotificationsCache()
    invalidatePaServerCache()

    // Fast-path non-blocking background telemetry, audit & platform bridge mirroring
    const actorId = user.id
    const actorName = user.name
    const actorRole = primaryRoleLabel(user)
    const subTitle = submission.title
    const subModule = submission.module ?? ''
    const subProjId = submission.projectId!

    ;(async () => {
      try {
        const { mirrorPuSubmission } = await import('@/lib/bridge/pu-link')
        await Promise.allSettled([
          appendHistory({
            submissionId: id,
            fromStatus: 'DRAFT',
            toStatus: 'SUBMITTED',
            actorId,
            actorName,
            actorRole,
            action: 'SUBMIT',
            comment: comment || null,
            newValues: { rollup },
          }),
          appendAudit({
            actorId,
            actorName,
            actorRole,
            action: 'SUBMIT',
            entityType: 'Submission',
            entityId: id,
            oldState: { status: 'DRAFT', rollup: null },
            newState: { status: 'SUBMITTED', rollup },
            reason: comment || 'Submission moved to SUBMITTED state',
          }),
          appendActivity({
            projectId: subProjId,
            actorId,
            actorName,
            actorRole,
            action: 'SUBMIT',
            title: `Submitted: ${subTitle}`,
            description: `Submission for ${subModule} moved DRAFT → SUBMITTED`,
            module: subModule,
            status: 'SUBMITTED',
          }),
          mirrorPuSubmission(id, {
            phase: 'SUBMITTED',
            actorId,
            actorName,
            actorRole,
          }),
        ])
      } catch (bgErr) {
        console.warn('[pu-link] submit bridge notice:', bgErr)
      }
    })()

    return NextResponse.json({ submission: { ...updated, project: updated?.project ? withProjectCompat(updated.project) : { ...SAFE_PROJECT } }, rollup })
  } catch (e) {
    console.error('POST /api/submissions/[id]/submit error', e)
    return NextResponse.json(
      { error: 'Failed to submit submission' },
      { status: 500 },
    )
  }
}
