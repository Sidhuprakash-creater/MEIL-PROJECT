import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/pu/db'
import { requirePermission } from '@/lib/pu/session'
import {
  appendActivity,
  appendAudit,
  appendHistory,
  authErrorToStatus,
  addCorrections,
  canTransition,
  isLocked,
  primaryRoleLabel,
  SAFE_PROJECT,
  withProjectCompat,
} from '@/lib/pu/workflow'
import { updateLevelRecordStatus } from '@/lib/pu/level-records'
import { invalidatePuOverviewCache, invalidatePuSubmissionsCache, invalidatePuNotificationsCache } from '@/lib/portal-cache'
import { invalidatePaServerCache } from '@/lib/project-admin/server'

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

    // Create correction requests on the shared ledger (JSON column)
    type CorrectionRow = {
      id: string; submissionId: string; requesterId: string; requesterName: string
      field: string; issue: string; severity: string; comment: string | null
      status: string; createdAt: string
    }
    const correctionInputs = fields
      .map((f) => ({
        field: f.field != null ? String(f.field) : '',
        issue: f.issue != null ? String(f.issue) : '',
        severity: ['INFO', 'WARNING', 'ERROR', 'BLOCKING'].includes(String(f.severity))
          ? String(f.severity)
          : 'WARNING',
        comment: f.comment != null ? String(f.comment) : (generalComment || null),
      }))
      .filter((c) => c.field && c.issue)
    const createdCorrections = (await addCorrections(
      id, user.id, user.name, correctionInputs,
    )) as unknown as CorrectionRow[]

    const updated = await db.submission.update({
      where: { id },
      data: {
        status: toStatus,
        reviewerId: user.id,
        reviewComment: generalComment || null,
      },
      include: {
        project: { select: { id: true, name: true } },
        reportingPeriod: { select: { id: true, periodLabel: true } },
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
      if (rids.length > 0) {
        for (const rid of rids) {
          updateLevelRecordStatus(rid, 'CORRECTION_REQUESTED')
        }
        /* One batched write per table instead of 5 awaits per record. */
        await Promise.allSettled([
          db.energyRecord.updateMany({ where: { id: { in: rids } }, data: { status: 'CORRECTION_REQUESTED' } }),
          db.waterRecord.updateMany({ where: { id: { in: rids } }, data: { status: 'CORRECTION_REQUESTED' } }),
          db.wasteRecord.updateMany({ where: { id: { in: rids } }, data: { status: 'CORRECTION_REQUESTED' } }),
          db.safetyRecord.updateMany({ where: { id: { in: rids } }, data: { status: 'CORRECTION_REQUESTED' } }),
          db.workforceRecord.updateMany({ where: { id: { in: rids } }, data: { status: 'CORRECTION_REQUESTED' } }),
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
      projectId: submission.projectId!,
      actorId: user.id,
      actorName: user.name,
      actorRole: primaryRoleLabel(user),
      action: 'CORRECTION',
      title: `Corrections requested: ${submission.title}`,
      description: `${createdCorrections.length} correction(s) — ${fromStatus} → ${toStatus}`,
      module: submission.module,
      status: toStatus,
    })

    /* Keep portal dashboards realtime — bust the overview/submissions caches
       so Overview, Analytics and Submissions reflect this rejection immediately. */
    invalidatePuOverviewCache()
    invalidatePuSubmissionsCache()
    invalidatePuNotificationsCache()
    invalidatePaServerCache()

    return NextResponse.json({
      submission: { ...updated, project: updated?.project ? withProjectCompat(updated.project) : { ...SAFE_PROJECT } },
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
