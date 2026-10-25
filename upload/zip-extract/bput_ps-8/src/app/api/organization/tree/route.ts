import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export const runtime = 'nodejs'

// GET /api/organization/tree — full org hierarchy
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const groups = await db.group.findMany({
    include: {
      subsidiaries: {
        include: {
          businessUnits: {
            include: { projects: { select: { id: true, projectCode: true, projectName: true, location: true, status: true } } },
          },
        },
      },
    },
  })
  return NextResponse.json({ groups })
}
