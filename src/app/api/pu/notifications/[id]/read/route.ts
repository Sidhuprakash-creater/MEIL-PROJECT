import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/pu/db'
import { getCurrentUser } from '@/lib/pu/session'
import {
  appendAudit,
  authErrorToStatus,
  primaryRoleLabel,
} from '@/lib/pu/workflow'

export const runtime = 'nodejs'

// POST /api/notifications/[id]/read — mark a single notification as read.
// The notification must belong to the calling user.
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  let user
  try {
    const u = await getCurrentUser()
    if (!u) throw new Error('UNAUTHENTICATED')
    user = u
  } catch (e) {
    const code = authErrorToStatus(e)
    return NextResponse.json(
      { error: 'Unauthenticated' },
      { status: code ?? 500 },
    )
  }

  const { id } = await ctx.params

  try {
    const notification = await db.notification.findUnique({ where: { id } })
    if (!notification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 },
      )
    }
    // Unified ledger: notifications are group-wide (subsidiaryId null) or
    // subsidiary-scoped — visible to any user of that scope.
    const subsidiaryId = user.scopes.find((s) => s.scopeType === 'SUBSIDIARY')?.scopeId ?? null
    if (notification.subsidiaryId && subsidiaryId && notification.subsidiaryId !== subsidiaryId) {
      return NextResponse.json(
        { error: 'Forbidden — notification outside your scope' },
        { status: 403 },
      )
    }
    if (notification.read) {
      return NextResponse.json({
        notification,
        message: 'Notification already read',
      })
    }
    const updated = await db.notification.update({
      where: { id },
      data: { read: true },
    })

    await appendAudit({
      actorId: user.id,
      actorName: user.name,
      actorRole: primaryRoleLabel(user),
      action: 'UPDATE',
      entityType: 'Notification',
      entityId: id,
      oldState: { read: false },
      newState: { read: true },
      reason: 'Notification marked as read',
    })

    return NextResponse.json({ notification: updated })
  } catch (e) {
    console.error('POST /api/notifications/[id]/read error', e)
    return NextResponse.json(
      { error: 'Failed to mark notification read' },
      { status: 500 },
    )
  }
}
