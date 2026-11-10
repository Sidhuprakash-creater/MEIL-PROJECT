import { NextResponse } from 'next/server'
import { db } from '@/lib/pu/db'
import { getCurrentUser } from '@/lib/pu/session'
import { getPuTreeCache, setPuTreeCache, invalidatePuTreeCache } from '@/lib/portal-cache'

export const runtime = 'nodejs'

// GET /api/pu/organization/tree — full org hierarchy from the unified ledger.
// Single tenant: one group (MEIL Group) → subsidiaries → business units → projects.
export async function GET() {
  try {
    /* The organisation tree is REFERENCE data (ids, codes, names) — it is
       read before a user signs in, exactly like the /api/master/* endpoints
       the gateway uses. Only structure is exposed, never any reporting data. */
    const cached = getPuTreeCache()
    if (cached) {
      return NextResponse.json(cached)
    }

    const [subsidiaries, periods] = await Promise.all([
      db.subsidiary.findMany({
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
      }),
      /* Reporting periods ride along so clients don't need the heavy /overview
         payload just to render the period picker. */
      db.reportingPeriod.findMany({
        orderBy: { startDate: 'asc' },
        select: { id: true, periodLabel: true, year: true, month: true, status: true },
      }),
    ])

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
            /* Alias to the shape every portal client reads (same contract as /api/so). */
            projects: u.projects.map((p) => ({
              id: p.id,
              projectCode: p.code,
              projectName: p.name,
              location: p.location,
              status: p.status,
            })),
          })),
        })),
      },
    ]

    const payload = {
      groups,
      periods: periods.map((p) => ({ id: p.id, label: p.periodLabel, year: p.year, month: p.month, status: p.status })),
    }
    setPuTreeCache(payload)
    return NextResponse.json(payload)
  } catch (e) {
    console.error('GET /api/organization/tree error', e)
    return NextResponse.json({ error: 'Failed to load organization tree' }, { status: 500 })
  }
}
