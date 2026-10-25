import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { authErrorToStatus } from '@/lib/workflow'

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

  const where: Record<string, unknown> = { userId: user.id }
  if (unreadOnly) where.read = false
  if (type) where.type = type

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

    return NextResponse.json({
      user: { id: user.id, name: user.name },
      total,
      unread: unreadCount,
      count: notifications.length,
      items: notifications,
    })
  } catch (e) {
    console.error('GET /api/notifications error', e)
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 },
    )
  }
}
