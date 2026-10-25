import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export const runtime = 'nodejs'

// GET /api/brsr/sections?frameworkId= — list sections for a framework with question counts.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  try {
    const frameworkId = req.nextUrl.searchParams.get('frameworkId')
    if (!frameworkId) {
      return NextResponse.json({ error: 'frameworkId query param required' }, { status: 400 })
    }
    const sections = await db.brsrSection.findMany({
      where: { frameworkId },
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { questions: true } } },
    })
    return NextResponse.json({
      sections: sections.map(s => ({
        id: s.id,
        code: s.code,
        name: s.name,
        description: s.description,
        sortOrder: s.sortOrder,
        questionCount: s._count.questions,
      })),
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to load sections', detail: String(e?.message ?? e) }, { status: 500 })
  }
}
