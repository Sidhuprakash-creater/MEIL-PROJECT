import { NextResponse } from 'next/server'
import { db } from '@/lib/pu/db'
import { getCurrentUser } from '@/lib/pu/session'

export const runtime = 'nodejs'

let treeCache: { data: any; expiresAt: number } | null = null

export function invalidatePuTreeCache() {
  treeCache = null
}

// GET /api/pu/organization/tree — full org hierarchy from the unified ledger.
// Single tenant: one group (MEIL Group) → subsidiaries → business units → projects.
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  if (treeCache && treeCache.expiresAt > Date.now()) {
    return NextResponse.json(treeCache.data)
  }

  const subsidiaries = await db.subsidiary.findMany({
    orderBy: { code: 'asc' },
    include: {
      units: {
        orderBy: { code: 'asc' },
        include: {
          projects: {
            orderBy: { code: 'asc' },
            select: { id: true, code: true, name: true, location: true, status: true },
          },
        },
      },
    },
  })

  const groups = [
    {
      id: 'meil-group',
      name: 'MEIL Group',
      subsidiaries: subsidiaries.map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        sector: s.sector,
        region: s.region,
        status: s.status,
        businessUnits: s.units.map((u) => ({
          id: u.id,
          code: u.code,
          name: u.name,
          status: u.status,
          projects: u.projects,
        })),
      })),
    },
  ]

  const payload = { groups }
  treeCache = { data: payload, expiresAt: Date.now() + 120000 }
  return NextResponse.json(payload)
}
