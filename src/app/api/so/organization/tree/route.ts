import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/so/session'
import { getSoTreeCache, setSoTreeCache, invalidateSoTreeCache } from '@/lib/portal-cache'

export const runtime = 'nodejs'

/**
 * GET /api/so/organization/tree — full org hierarchy + reporting calendar.
 *
 * Shape contract (the ported site-operations clients read these keys verbatim):
 *   groups[].code / .name
 *   groups[].subsidiaries[].code
 *   groups[].subsidiaries[].businessUnits[].name
 *   groups[].subsidiaries[].businessUnits[].projects[].{ id, projectCode, projectName, location, status }
 * Plus the reporting calendar:
 *   reportingYear — the currently open (or most recent) ReportingYear row
 *   years         — every ReportingYear
 *   periods       — ReportingPeriod rows for the active year (label/year/month
 *                   aliased from periodLabel so PeriodOption keeps working)
 *
 * Built from PARENT Subsidiary → BusinessUnit → Project. The Group node is
 * synthetic (no Group table on the platform). Tolerates zero ReportingYear /
 * ReportingPeriod rows (returns empty periods array instead of crashing).
 */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  /* Remote-DB latency guard: the hierarchy + calendar change rarely — serve
     from a 120s cache like the pu twin. */
  const cached = getSoTreeCache()
  if (cached) {
    return NextResponse.json(cached)
  }

  const subsidiaries = await db.subsidiary.findMany({
    orderBy: { name: 'asc' },
    include: {
      units: {
        orderBy: { name: 'asc' },
        include: {
          projects: {
            orderBy: { name: 'asc' },
            select: { id: true, code: true, name: true, location: true, status: true, ptype: true, capacityMw: true },
          },
        },
      },
    },
  })

  const groups = [
    {
      id: 'MEIL-GROUP',
      code: 'MEIL',
      name: 'MEIL Group',
      subsidiaries: subsidiaries.map((sub) => ({
        id: sub.id,
        code: sub.code,
        name: sub.name,
        status: sub.status,
        businessUnits: sub.units.map((bu) => ({
          id: bu.id,
          code: bu.code,
          name: bu.name,
          status: bu.status,
          projects: bu.projects.map((p) => ({
            id: p.id,
            code: p.code,
            name: p.name,
            // legacy aliases so ZIP-era clients (p.projectCode) keep working
            projectCode: p.code,
            projectName: p.name,
            location: p.location,
            ptype: p.ptype,
            capacityMw: p.capacityMw,
            status: p.status,
          })),
        })),
      })),
    },
  ]

  // ---- Reporting calendar (tolerates zero seeded rows) ----
  const years = await db.reportingYear.findMany({ orderBy: { year: 'desc' } })
  const reportingYear =
    years.find((y) => y.status === 'OPEN') ?? years[0] ?? null
  const periods = reportingYear
    ? await db.reportingPeriod.findMany({
        where: { reportingYearId: reportingYear.id },
        orderBy: { startDate: 'asc' },
      })
    : []

  const payload = {
    groups,
    reportingYear: reportingYear
      ? { id: reportingYear.id, year: reportingYear.year, label: reportingYear.label, status: reportingYear.status }
      : null,
    years: years.map((y) => ({ id: y.id, year: y.year, label: y.label, status: y.status })),
    periods: periods.map((p) => ({
      id: p.id,
      label: p.periodLabel,
      periodLabel: p.periodLabel,
      periodType: p.periodType,
      year: p.year,
      month: p.month,
      quarter: p.quarter,
      startDate: p.startDate,
      endDate: p.endDate,
      status: p.status,
    })),
  }
  setSoTreeCache(payload)
  return NextResponse.json(payload)
}
