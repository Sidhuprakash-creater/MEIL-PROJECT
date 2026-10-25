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

// POST /api/submissions/[id]/lock
// HQ_REVIEW → LOCKED. Sets lockedAt + lockedBy. Records become immutable.
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  let user
  try {
    user = await requirePermission('submission.lock')
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
        { error: 'Submission is already locked' },
        { status: 409 },
      )
    }

    const fromStatus = submission.status
    const toStatus = 'LOCKED'
    if (!canTransition(fromStatus, toStatus)) {
      return NextResponse.json(
        {
          error: 'Invalid state transition',
          from: fromStatus,
          to: toStatus,
          detail: 'Only HQ_REVIEW submissions can be locked',
        },
        { status: 409 },
      )
    }

    const now = new Date()
    const updated = await db.submission.update({
      where: { id },
      data: {
        status: toStatus,
        lockedAt: now,
        lockedBy: user.id,
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
      action: 'LOCK',
      comment: comment || null,
      newValues: { lockedAt: now, lockedBy: user.id },
    })

    await appendAudit({
      actorId: user.id,
      actorName: user.name,
      actorRole: primaryRoleLabel(user),
      action: 'LOCK',
      entityType: 'Submission',
      entityId: id,
      oldState: { status: fromStatus },
      newState: { status: toStatus, lockedAt: now, lockedBy: user.id },
      reason: comment || 'Submission locked — record now immutable',
    })

    await appendActivity({
      projectId: submission.projectId,
      actorId: user.id,
      actorName: user.name,
      actorRole: primaryRoleLabel(user),
      action: 'APPROVE',
      title: `Locked: ${submission.title}`,
      description: `${fromStatus} → LOCKED (immutable)`,
      module: submission.module,
      status: toStatus,
    })

    return NextResponse.json({
      submission: updated,
      locked: true,
      lockedAt: now,
      lockedBy: user.id,
    })
  } catch (e) {
    console.error('POST /api/submissions/[id]/lock error', e)
    return NextResponse.json(
      { error: 'Failed to lock submission' },
      { status: 500 },
    )
  }
}
