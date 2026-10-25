import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export const runtime = 'nodejs'

// GET /api/reports/[id] — single report detail with parsed content.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  try {
    const { id } = await params
    const report = await db.report.findUnique({ where: { id } })
    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    // Best-effort parse the content as JSON; fall back to raw string.
    let content: unknown = report.content
    if (report.content) {
      try {
        content = JSON.parse(report.content)
      } catch {
        content = report.content
      }
    }

    return NextResponse.json({
      report: {
        ...report,
        content,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to load report', detail: String(e?.message ?? e) }, { status: 500 })
  }
}
