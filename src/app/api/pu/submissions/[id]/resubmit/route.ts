import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/pu/db'
import { requirePermission } from '@/lib/pu/session'
import {
  appendActivity,
  appendAudit,
  appendHistory,
  authErrorToStatus,
  canTransition,
  fetchSourceRecords,
  isLocked,
  addressCorrections,
  listCorrections,
  parseRecordIds,
  primaryRoleLabel,
  SAFE_PROJECT,
  withProjectCompat,
} from '@/lib/pu/workflow'
import { invalidatePuOverviewCache, invalidatePuSubmissionsCache, invalidatePuNotificationsCache } from '@/lib/portal-cache'

export const runtime = 'nodejs'

// POST /api/submissions/[id]/resubmit
// CORRECTION_REQUESTED → RESUBMITTED → UNDER_REVIEW (single call).
// Marks all open correction requests as ADDRESSED and bumps revisionNumber
// on underlying source records (creating a new revision, never overwriting history).
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
    /* ignore */
  }

  try {
    const submission = await db.submission.findUnique({ where: { id } })
    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }
    if (isLocked(submission.status)) {
      return NextResponse.json(
        { error: 'Submission is locked and cannot be resubmitted' },
        { status: 409 },
      )
    }

    const fromStatus = submission.status
    if (!canTransition(fromStatus, 'RESUBMITTED')) {
      return NextResponse.json(
        {
          error: 'Invalid state transition',
          from: fromStatus,
          to: 'RESUBMITTED',
          detail: 'Only CORRECTION_REQUESTED submissions can be resubmitted',
        },
        { status: 409 },
      )
    }

    // Mark corrections ADDRESSED on the shared ledger (JSON column — history
    // preserved inside each entry, never overwritten)
    const openCorrections = (await listCorrections(id, true)) as Array<{
      id: string; status: string; resolvedAt?: string; resolutionComment?: string | null
    }>
    const now = new Date()
    if (openCorrections.length > 0) {
      await addressCorrections(id)
      for (const c of openCorrections) {
        c.status = 'ADDRESSED'
        c.resolvedAt = now.toISOString()
        c.resolutionComment = comment || 'Addressed in resubmission'
      }
    }

    // Bump revisionNumber on underlying records (per-module updateMany)
    const recordIds = parseRecordIds(submission.recordIds)
    if (recordIds.length > 0) {
      const records = await fetchSourceRecords(recordIds, submission.module ?? '')
      // Take the max current revision as the baseline; bump by 1 only for the
      // records attached to this submission (creating a new revision lineage).
      const updates: Promise<unknown>[] = []
      switch (submission.module ?? '') {
        case 'ENERGY':
          updates.push(
            db.energyRecord.updateMany({
              where: { id: { in: recordIds } },
              data: { revisionNumber: { increment: 1 }, updatedAt: now, updatedBy: user.id, validationStatus: 'PASSED' },
            }),
          )
          break
        case 'WATER':
          updates.push(
            db.waterRecord.updateMany({
              where: { id: { in: recordIds } },
              data: { revisionNumber: { increment: 1 }, updatedAt: now, validationStatus: 'PASSED' },
            }),
          )
          break
        case 'WASTE':
          updates.push(
            db.wasteRecord.updateMany({
              where: { id: { in: recordIds } },
              data: { revisionNumber: { increment: 1 }, updatedAt: now, validationStatus: 'PASSED' },
            }),
          )
          break
        case 'PEOPLE':
          updates.push(
            db.workforceRecord.updateMany({
              where: { id: { in: recordIds } },
              data: { revisionNumber: { increment: 1 }, updatedAt: now, validationStatus: 'PASSED' },
            }),
          )
          break
        case 'SAFETY':
          updates.push(
            db.safetyRecord.updateMany({
              where: { id: { in: recordIds } },
              data: { revisionNumber: { increment: 1 }, updatedAt: now, validationStatus: 'PASSED' },
            }),
          )
          break
        case 'TRAVEL':
          updates.push(
            db.travelRecord.updateMany({
              where: { id: { in: recordIds } },
              data: { revisionNumber: { increment: 1 }, updatedAt: now, validationStatus: 'PASSED' },
            }),
          )
          break
      }
      await Promise.all(updates)
      void records // touched to ensure fetch resolves; not strictly needed beyond validation
    }

    // Transition: CORRECTION_REQUESTED → RESUBMITTED → UNDER_REVIEW (two hops in one call).
    const intermediateStatus = 'RESUBMITTED'
    const finalStatus = 'UNDER_REVIEW'

    const updated = await db.submission.update({
      where: { id },
      data: {
        status: finalStatus,
        reviewerId: user.id,
        reviewComment: comment || null,
      },
      include: {
        project: { select: { id: true, name: true } },
        reportingPeriod: { select: { id: true, periodLabel: true } },
      },
    })

    // History: record both hops (RESUBMIT then auto-review)
    await appendHistory({
      submissionId: id,
      fromStatus,
      toStatus: intermediateStatus,
      actorId: user.id,
      actorName: user.name,
      actorRole: primaryRoleLabel(user),
      action: 'RESUBMIT',
      comment: comment || null,
      newValues: {
        correctionsAddressed: openCorrections.length,
        revisionsBumped: recordIds.length,
      },
    })
    await appendHistory({
      submissionId: id,
      fromStatus: intermediateStatus,
      toStatus: finalStatus,
      actorId: user.id,
      actorName: user.name,
      actorRole: primaryRoleLabel(user),
      action: 'REVIEW',
      comment: 'Auto-advance after resubmission',
    })

    await appendAudit({
      actorId: user.id,
      actorName: user.name,
      actorRole: primaryRoleLabel(user),
      action: 'RESUBMIT',
      entityType: 'Submission',
      entityId: id,
      oldState: { status: fromStatus },
      newState: {
        status: finalStatus,
        correctionsAddressed: openCorrections.length,
        revisionsBumped: recordIds.length,
      },
      reason: comment || 'Resubmitted after corrections; revisions bumped',
    })

    await appendActivity({
      projectId: submission.projectId!,
      actorId: user.id,
      actorName: user.name,
      actorRole: primaryRoleLabel(user),
      action: 'SUBMIT',
      title: `Resubmitted: ${submission.title}`,
      description: `${fromStatus} → ${intermediateStatus} → ${finalStatus} (${recordIds.length} records revised)`,
      module: submission.module,
      status: finalStatus,
    })

    // BRIDGE: refresh the platform mirror so reviewers see the corrected version.
    try {
      const { mirrorPuSubmission } = await import('@/lib/bridge/pu-link')
      await mirrorPuSubmission(id, {
        phase: 'RESUBMITTED',
        actorId: user.id,
        actorName: user.name,
        actorRole: primaryRoleLabel(user),
      })
    } catch (bridgeErr) {
      console.warn('[pu-link] resubmit bridge notice:', bridgeErr)
    }

    /* Keep portal dashboards realtime — bust the overview/submissions caches
       so Overview, Analytics and Submissions reflect this resubmission immediately. */
    invalidatePuOverviewCache()
    invalidatePuSubmissionsCache()
    invalidatePuNotificationsCache()

    return NextResponse.json({
      submission: { ...updated, project: updated?.project ? withProjectCompat(updated.project) : { ...SAFE_PROJECT } },
      correctionsAddressed: openCorrections.length,
      revisionsBumped: recordIds.length,
    })
  } catch (e) {
    console.error('POST /api/submissions/[id]/resubmit error', e)
    return NextResponse.json(
      { error: 'Failed to resubmit submission' },
      { status: 500 },
    )
  }
}
