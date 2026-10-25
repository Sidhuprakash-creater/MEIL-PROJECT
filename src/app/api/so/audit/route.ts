import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, portalRoleKeyFor } from '@/lib/so/session'
import { authErrorToStatus } from '@/lib/so/workflow'

export const runtime = 'nodejs'

// GET /api/audit?action=&entityType=&entityId=
// Paginated (take 100) audit log including actor.
export async function GET(req: NextRequest) {
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

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action') || undefined
  const entityType = searchParams.get('entityType') || undefined
  const entityId = searchParams.get('entityId') || undefined
  const take = Math.min(Number(searchParams.get('take') || 100), 500)

  const where: Record<string, unknown> = {}
  if (action) where.action = action
  if (entityType) where.entityType = entityType
  if (entityId) where.entityId = entityId

  try {
    const [auditLogs, total] = await Promise.all([
      db.soAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              email: true,
              employeeId: true,
              role: true,
            },
          },
        },
      }),
      db.soAuditLog.count({ where }),
    ])

    return NextResponse.json({
      user: { id: user.id, name: user.name },
      total,
      count: auditLogs.length,
      items: auditLogs.map((l) => ({
        id: l.id,
        actorId: l.actorId,
        actorName: l.actorName,
        actorRole: l.actorRole,
        actorEmail: l.actor?.email || null,
        actorEmployeeCode: l.actor?.employeeId || null,
        actorRoles: l.actor ? [{ key: portalRoleKeyFor(l.actor.role), name: l.actor.role }] : [],
        action: l.action,
        entityType: l.entityType,
        entityId: l.entityId,
        oldState: l.oldState,
        newState: l.newState,
        reason: l.reason,
        metadata: l.metadata,
        ipAddress: l.ipAddress,
        createdAt: l.createdAt,
      })),
    })
  } catch (e) {
    console.error('GET /api/audit error', e)
    return NextResponse.json(
      { error: 'Failed to fetch audit log' },
      { status: 500 },
    )
  }
}
