import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { authErrorToStatus } from '@/lib/workflow'

export const runtime = 'nodejs'

// GET /api/activity — recent activities (take 20, ordered desc).
// Optional ?take= (max 100), ?projectId=, ?module=, ?action= filters.
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
  const take = Math.min(Number(searchParams.get('take') || 20), 100)
  const projectId = searchParams.get('projectId') || undefined
  const moduleFilter = searchParams.get('module') || undefined
  const action = searchParams.get('action') || undefined

  const where: Record<string, unknown> = {}
  if (projectId) where.projectId = projectId
  if (moduleFilter) where.module = moduleFilter
  if (action) where.action = action

  try {
    const [activities, total] = await Promise.all([
      db.activity.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        include: {
          project: {
            select: { id: true, projectName: true, projectCode: true, location: true },
          },
        },
      }),
      db.activity.count({ where }),
    ])

    return NextResponse.json({
      user: { id: user.id, name: user.name },
      total,
      count: activities.length,
      items: activities,
    })
  } catch (e) {
    console.error('GET /api/activity error', e)
    return NextResponse.json(
      { error: 'Failed to fetch activity feed' },
      { status: 500 },
    )
  }
}
