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
import { updateLevelRecordStatus } from '@/lib/level-records'

export const runtime = 'nodejs'

interface CorrectionInput {
  field?: unknown
  issue?: unknown
  severity?: unknown
  comment?: unknown
}

// POST /api/submissions/[id]/reject
// Transition UNDER_REVIEW → CORRECTION_REQUESTED.
// Body: { fields: [{field, issue, severity, comment}], comment? }
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  let user
  try {
    user = await requirePermission('submission.reject')
  } catch (e) {
    const code = authErrorToStatus(e)
    return NextResponse.json(
      { error: code === 403 ? 'Forbidden' : 'Unauthenticated' },
      { status: code ?? 500 },
    )
  }

  const { id } = await ctx.params

  let fields: CorrectionInput[] = []
  let generalComment: string | undefined
  try {
    const body = await req.json().catch(() => ({}))
    if (body && Array.isArray(body.fields)) {
      fields = body.fields as CorrectionInput[]
    }
    if (body && typeof body.comment === 'string') generalComment = body.comment
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
        { error: 'Submission is locked and cannot be rejected' },
        { status: 409 },
      )
    }

    const fromStatus = submission.status
    const toStatus = 'CORRECTION_REQUESTED'

    if (!canTransition(fromStatus, toStatus)) {
      return NextResponse.json(
        {
          error: 'Invalid state transition',
          from: fromStatus,
          to: toStatus,
          detail: 'Only UNDER_REVIEW submissions can be sent back for correction',
        },
        { status: 409 },
      )
    }

    if (fields.length === 0) {
      const fallbackComment = generalComment || 'Reviewer requested correction on submitted data'
      fields = [
        {
          field: 'General Data Review',
          issue: fallbackComment,
          severity: 'WARNING',
          comment: fallbackComment,
        },
      ]
    }

    // Create correction requests for each field issue
    type CorrectionRow = Awaited<
      ReturnType<typeof db.correctionRequest.create>
    >
    const createdCorrections: CorrectionRow[] = []
    for (const f of fields) {
      const field = f.field != null ? String(f.field) : ''
      const issue = f.issue != null ? String(f.issue) : ''
      const severity = f.severity != null ? String(f.severity) : 'WARNING'
      const comment = f.comment != null ? String(f.comment) : (generalComment || null)
      if (!field || !issue) continue
      const cr = await db.correctionRequest.create({
        data: {
          submissionId: id,
          requesterId: user.id,
          requesterName: user.name,
          field,
          issue,
          severity: ['INFO', 'WARNING', 'ERROR', 'BLOCKING'].includes(severity)
            ? severity
            : 'WARNING',
          comment,
          status: 'OPEN',
        },
      })
      createdCorrections.push(cr)
    }

    const updated = await db.submission.update({
      where: { id },
      data: {
        status: toStatus,
        currentReviewerId: user.id,
        reviewComment: generalComment || null,
      },
      include: {
        project: { select: { id: true, projectName: true } },
        reportingPeriod: { select: { id: true, periodLabel: true } },
        corrections: { orderBy: { createdAt: 'asc' } },
      },
    })

    // Sync underlying data entry records to 'CORRECTION_REQUESTED'
    try {
      let rids: string[] = []
      if (typeof submission.recordIds === 'string') {
        try {
          const parsed = JSON.parse(submission.recordIds)
          if (Array.isArray(parsed)) rids = parsed
        } catch {}
      }
      for (const rid of rids) {
        updateLevelRecordStatus(rid, 'CORRECTION_REQUESTED')
        await Promise.allSettled([
          db.energyRecord.updateMany({ where: { id: rid }, data: { status: 'CORRECTION_REQUESTED' } }),
          db.waterRecord.updateMany({ where: { id: rid }, data: { status: 'CORRECTION_REQUESTED' } }),
          db.wasteRecord.updateMany({ where: { id: rid }, data: { status: 'CORRECTION_REQUESTED' } }),
          db.safetyRecord.updateMany({ where: { id: rid }, data: { status: 'CORRECTION_REQUESTED' } }),
          db.workforceRecord.updateMany({ where: { id: rid }, data: { status: 'CORRECTION_REQUESTED' } }),
        ])
      }
    } catch (syncErr) {
      console.warn('Reject underlying record sync warning:', syncErr)
    }

    await appendHistory({
      submissionId: id,
      fromStatus,
      toStatus,
      actorId: user.id,
      actorName: user.name,
      actorRole: primaryRoleLabel(user),
      action: 'CORRECTION_REQUEST',
      comment: generalComment || null,
      newValues: {
        correctionCount: createdCorrections.length,
        fields: createdCorrections.map((c) => ({
          field: c.field,
          issue: c.issue,
          severity: c.severity,
        })),
      },
    })

    await appendAudit({
      actorId: user.id,
      actorName: user.name,
      actorRole: primaryRoleLabel(user),
      action: 'CORRECTION_REQUEST',
      entityType: 'Submission',
      entityId: id,
      oldState: { status: fromStatus },
      newState: {
        status: toStatus,
        corrections: createdCorrections.length,
      },
      reason: generalComment || `${createdCorrections.length} correction(s) requested`,
    })

    await appendActivity({
      projectId: submission.projectId,
      actorId: user.id,
      actorName: user.name,
      actorRole: primaryRoleLabel(user),
      action: 'CORRECTION',
      title: `Corrections requested: ${submission.title}`,
      description: `${createdCorrections.length} correction(s) — ${fromStatus} → ${toStatus}`,
      module: submission.module,
      status: toStatus,
    })

    return NextResponse.json({
      submission: updated,
      corrections: createdCorrections,
    })
  } catch (e) {
    console.error('POST /api/submissions/[id]/reject error', e)
    return NextResponse.json(
      { error: 'Failed to request corrections' },
      { status: 500 },
    )
  }
}
