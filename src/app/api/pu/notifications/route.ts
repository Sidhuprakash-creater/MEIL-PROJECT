import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/pu/db'
import { getCurrentUser } from '@/lib/pu/session'
import { authErrorToStatus } from '@/lib/pu/workflow'
import { puNotificationsCache, invalidatePuNotificationsCache } from '@/lib/portal-cache'

export const runtime = 'nodejs'


// GET /api/notifications — current user's notifications.
// Optional ?unreadOnly=true, ?type=, ?take= (default 50, max 200).
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
  const unreadOnly = searchParams.get('unreadOnly') === 'true'
  const type = searchParams.get('type') || undefined
  const take = Math.min(Number(searchParams.get('take') || 50), 200)

  const cacheKey = `${user.id}:${unreadOnly}:${type || 'all'}:${take}`
  const cached = puNotificationsCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data)
  }

  // Unified ledger: notifications are broadcast rows scoped by subsidiary
  // (null = group-wide). Portal users see group-wide + their subsidiary's.
  const subsidiaryId = user.scopes.find((s) => s.scopeType === 'SUBSIDIARY')?.scopeId ?? null
  const orConditions: any[] = [{ subsidiaryId: null }, { refId: user.id }]
  if (subsidiaryId) {
    orConditions.push({ subsidiaryId })
  }
  const scopeWhere = { OR: orConditions }
  const where: Record<string, unknown> = { ...scopeWhere }
  if (unreadOnly) where.read = false
  if (type) where.ntype = type

  try {
    const [notifications, total, unreadCount] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
      }),
      db.notification.count({ where }),
      db.notification.count({ where: { ...where, read: false } }),
    ])

    const payload = {
      user: { id: user.id, name: user.name },
      total,
      unread: unreadCount,
      count: notifications.length,
      items: notifications.map((n) => ({
        ...n,
        type: n.ntype,
        message: n.body,
        linkId: n.refId || null,
      })),
    }

    puNotificationsCache.set(cacheKey, { data: payload, expiresAt: Date.now() + 15000 })
    return NextResponse.json(payload)
  } catch (e) {
    console.error('GET /api/notifications error', e)
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 },
    )
  }
}
