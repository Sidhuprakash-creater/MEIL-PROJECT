import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/session'
import {
  appendActivity,
  appendAudit,
  appendHistory,
  authErrorToStatus,
  canTransition,
  isLocked,
  nextApproveStatus,
  primaryRoleLabel,
} from '@/lib/workflow'
import { updateLevelRecordStatus } from '@/lib/level-records'

export const runtime = 'nodejs'

// POST /api/submissions/[id]/approve
// Advance the state machine one level:
//   UNDER_REVIEW → BU_APPROVED → SUBSIDIARY_APPROVED → HQ_REVIEW → LOCKED
// Optional { comment, level } where level is a free-form hint.
// On reaching LOCKED, set lockedAt + lockedBy.
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  let user
  try {
    user = await requirePermission('submission.approve')
  } catch (e) {
    const code = authErrorToStatus(e)
    return NextResponse.json(
      { error: code === 403 ? 'Forbidden' : 'Unauthenticated' },
      { status: code ?? 500 },
    )
  }

  const { id } = await ctx.params
  let comment: string | undefined
  let level: string | undefined
  try {
    const body = await req.json().catch(() => ({}))
    if (body && typeof body.comment === 'string') comment = body.comment
    if (body && typeof body.level === 'string') level = body.level
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
        { error: 'Submission is already locked' },
        { status: 409 },
      )
    }

    const fromStatus = submission.status
    const toStatus = nextApproveStatus(fromStatus)
    if (!toStatus) {
      return NextResponse.json(
        {
          error: 'Invalid state transition',
          from: fromStatus,
          detail: 'No further approval level available from this status',
        },
        { status: 409 },
      )
    }
    if (!canTransition(fromStatus, toStatus)) {
      return NextResponse.json(
        {
          error: 'Invalid state transition',
          from: fromStatus,
          to: toStatus,
        },
        { status: 409 },
      )
    }

    // Optional level hint validation — warn (not fail) if mismatched
    if (level && level.toUpperCase() !== toStatus) {
      // Non-blocking advisory
      console.warn(
        `approve: hint level '${level}' differs from derived '${toStatus}'`,
      )
    }

    const now = new Date()
    const patch: Record<string, unknown> = {
      status: toStatus,
      currentReviewerId: user.id,
      reviewComment: comment || null,
    }
    if (toStatus === 'LOCKED') {
      patch.lockedAt = now
      patch.lockedBy = user.id
    }

    const updated = await db.submission.update({
      where: { id },
      data: patch,
      include: {
        project: { select: { id: true, projectName: true } },
        reportingPeriod: { select: { id: true, periodLabel: true } },
        currentReviewer: { select: { id: true, name: true, email: true } },
      },
    })

    // Sync underlying data entry records to 'ACTIVE'
    try {
      let rids: string[] = []
      if (typeof submission.recordIds === 'string') {
        try {
          const parsed = JSON.parse(submission.recordIds)
          if (Array.isArray(parsed)) rids = parsed
        } catch {}
      }
      for (const rid of rids) {
        updateLevelRecordStatus(rid, 'ACTIVE')
        await Promise.allSettled([
          db.energyRecord.updateMany({ where: { id: rid }, data: { status: 'ACTIVE' } }),
          db.waterRecord.updateMany({ where: { id: rid }, data: { status: 'ACTIVE' } }),
          db.wasteRecord.updateMany({ where: { id: rid }, data: { status: 'ACTIVE' } }),
          db.safetyRecord.updateMany({ where: { id: rid }, data: { status: 'ACTIVE' } }),
          db.workforceRecord.updateMany({ where: { id: rid }, data: { status: 'ACTIVE' } }),
        ])
      }
    } catch (syncErr) {
      console.warn('Approve underlying record sync warning:', syncErr)
    }

    await appendHistory({
      submissionId: id,
      fromStatus,
      toStatus,
      actorId: user.id,
      actorName: user.name,
      actorRole: primaryRoleLabel(user),
      action: 'APPROVE',
      comment: comment || null,
      newValues: { locked: toStatus === 'LOCKED', level: level || null },
    })

    await appendAudit({
      actorId: user.id,
      actorName: user.name,
      actorRole: primaryRoleLabel(user),
      action: 'APPROVE',
      entityType: 'Submission',
      entityId: id,
      oldState: { status: fromStatus },
      newState: { status: toStatus, lockedAt: toStatus === 'LOCKED' ? now : null },
      reason: comment || `Approved: ${fromStatus} → ${toStatus}`,
    })

    await appendActivity({
      projectId: submission.projectId,
      actorId: user.id,
      actorName: user.name,
      actorRole: primaryRoleLabel(user),
      action: 'APPROVE',
      title: `Approved: ${submission.title}`,
      description: `${fromStatus} → ${toStatus}`,
      module: submission.module,
      status: toStatus,
    })

    return NextResponse.json({
      submission: updated,
      fromStatus,
      toStatus,
      locked: toStatus === 'LOCKED',
    })
  } catch (e) {
    console.error('POST /api/submissions/[id]/approve error', e)
    return NextResponse.json(
      { error: 'Failed to approve submission' },
      { status: 500 },
    )
  }
}
