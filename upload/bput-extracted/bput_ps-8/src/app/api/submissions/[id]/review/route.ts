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
  primaryRoleLabel,
} from '@/lib/workflow'

export const runtime = 'nodejs'

// POST /api/submissions/[id]/review
// Transition SUBMITTED | RESUBMITTED → UNDER_REVIEW. Idempotent if already UNDER_REVIEW.
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  let user
  try {
    user = await requirePermission('submission.review')
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
        { error: 'Submission is locked and cannot be reviewed' },
        { status: 409 },
      )
    }

    const fromStatus = submission.status
    const toStatus = 'UNDER_REVIEW'

    // Idempotent: already under review
    if (fromStatus === toStatus) {
      await appendHistory({
        submissionId: id,
        fromStatus,
        toStatus,
        actorId: user.id,
        actorName: user.name,
        actorRole: primaryRoleLabel(user),
        action: 'REVIEW',
        comment: comment || null,
        reason: 'Reviewer noted submission (no state change)',
      })
      await appendAudit({
        actorId: user.id,
        actorName: user.name,
        actorRole: primaryRoleLabel(user),
        action: 'REVIEW',
        entityType: 'Submission',
        entityId: id,
        reason: comment || 'Reviewer re-visited submission (no state change)',
      })
      return NextResponse.json({
        submission,
        message: 'Submission already under review',
      })
    }

    if (!canTransition(fromStatus, toStatus)) {
      return NextResponse.json(
        {
          error: 'Invalid state transition',
          from: fromStatus,
          to: toStatus,
          detail: 'Only SUBMITTED or RESUBMITTED submissions can be moved to UNDER_REVIEW',
        },
        { status: 409 },
      )
    }

    const updated = await db.submission.update({
      where: { id },
      data: {
        status: toStatus,
        currentReviewerId: user.id,
        reviewComment: comment || null,
      },
      include: {
        project: { select: { id: true, projectName: true } },
        reportingPeriod: { select: { id: true, periodLabel: true } },
      },
    })

    await appendHistory({
      submissionId: id,
      fromStatus,
      toStatus,
      actorId: user.id,
      actorName: user.name,
      actorRole: primaryRoleLabel(user),
      action: 'REVIEW',
      comment: comment || null,
    })

    await appendAudit({
      actorId: user.id,
      actorName: user.name,
      actorRole: primaryRoleLabel(user),
      action: 'REVIEW',
      entityType: 'Submission',
      entityId: id,
      oldState: { status: fromStatus },
      newState: { status: toStatus, reviewerId: user.id },
      reason: comment || 'Submission moved to UNDER_REVIEW',
    })

    await appendActivity({
      projectId: submission.projectId,
      actorId: user.id,
      actorName: user.name,
      actorRole: primaryRoleLabel(user),
      action: 'REVIEW',
      title: `Under review: ${submission.title}`,
      description: `Submission ${fromStatus} → UNDER_REVIEW`,
      module: submission.module,
      status: toStatus,
    })

    return NextResponse.json({ submission: updated })
  } catch (e) {
    console.error('POST /api/submissions/[id]/review error', e)
    return NextResponse.json(
      { error: 'Failed to advance review' },
      { status: 500 },
    )
  }
}
