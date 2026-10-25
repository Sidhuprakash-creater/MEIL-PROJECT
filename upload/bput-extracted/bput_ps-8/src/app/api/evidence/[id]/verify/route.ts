import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/session'
import {
  appendActivity,
  appendAudit,
  authErrorToStatus,
  primaryRoleLabel,
} from '@/lib/workflow'

export const runtime = 'nodejs'

// POST /api/evidence/[id]/verify
// UPLOADED | UNDER_REVIEW → VERIFIED. Sets verifiedBy, verifiedAt, verificationComment.
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  let user
  try {
    user = await requirePermission('evidence.verify')
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
    const evidence = await db.evidence.findUnique({ where: { id } })
    if (!evidence) {
      return NextResponse.json({ error: 'Evidence not found' }, { status: 404 })
    }
    if (evidence.status === 'VERIFIED') {
      return NextResponse.json(
        { error: 'Evidence is already verified' },
        { status: 409 },
      )
    }
    if (!['UPLOADED', 'UNDER_REVIEW'].includes(evidence.status)) {
      return NextResponse.json(
        {
          error: 'Invalid state transition',
          from: evidence.status,
          to: 'VERIFIED',
          detail: 'Only UPLOADED or UNDER_REVIEW evidence can be verified',
        },
        { status: 409 },
      )
    }

    const fromStatus = evidence.status
    const now = new Date()
    const updated = await db.evidence.update({
      where: { id },
      data: {
        status: 'VERIFIED',
        verifiedBy: user.id,
        verifiedAt: now,
        verificationComment: comment || null,
      },
      include: {
        uploader: { select: { id: true, name: true, email: true } },
      },
    })

    await appendAudit({
      actorId: user.id,
      actorName: user.name,
      actorRole: primaryRoleLabel(user),
      action: 'EVIDENCE_VERIFY',
      entityType: 'Evidence',
      entityId: id,
      oldState: { status: fromStatus },
      newState: { status: 'VERIFIED', verifiedBy: user.id, verifiedAt: now },
      reason: comment || 'Evidence verified',
    })

    if (evidence.projectId) {
      await appendActivity({
        projectId: evidence.projectId,
        actorId: user.id,
        actorName: user.name,
        actorRole: primaryRoleLabel(user),
        action: 'EVIDENCE_UPLOAD',
        title: `Evidence verified: ${evidence.fileName}`,
        description: `${fromStatus} → VERIFIED`,
        module: evidence.module || undefined,
        status: 'VERIFIED',
      })
    }

    return NextResponse.json({ evidence: updated })
  } catch (e) {
    console.error('POST /api/evidence/[id]/verify error', e)
    return NextResponse.json(
      { error: 'Failed to verify evidence' },
      { status: 500 },
    )
  }
}
