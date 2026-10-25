import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export const runtime = 'nodejs'

// GET /api/reports?type=BRSR&year=2026 — list all reports with the generator's name.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  try {
    const sp = req.nextUrl.searchParams
    const type = sp.get('type')
    const year = sp.get('year')
    const where: { reportType?: string; reportingYear?: number } = {}
    if (type) where.reportType = type
    if (year) where.reportingYear = Number(year)

    const reports = await db.report.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        reportType: true,
        frameworkId: true,
        reportingYear: true,
        periodLabel: true,
        scopeType: true,
        scopeId: true,
        scopeName: true,
        generatedBy: true,
        generatedByName: true,
        status: true,
        fileName: true,
        fileType: true,
        version: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      reports: reports.map(r => ({
        ...r,
        generatedBy: r.generatedByName ?? r.generatedBy,
      })),
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to load reports', detail: String(e?.message ?? e) }, { status: 500 })
  }
}
