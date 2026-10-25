import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export const runtime = 'nodejs'

// GET /api/brsr/frameworks — list all BRSR frameworks with section/principle/question counts.
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  try {
    const frameworks = await db.brsrFramework.findMany({
      orderBy: { reportingYear: 'desc' },
      include: {
        _count: {
          select: {
            sections: true,
            principles: true,
            questions: true,
            answers: true,
          },
        },
      },
    })

    const result = frameworks.map(f => ({
      id: f.id,
      name: f.name,
      version: f.version,
      reportingYear: f.reportingYear,
      tier: f.tier,
      status: f.status,
      createdAt: f.createdAt,
      counts: {
        sections: f._count.sections,
        principles: f._count.principles,
        questions: f._count.questions,
        answers: f._count.answers,
      },
    }))

    return NextResponse.json({ frameworks: result })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to load frameworks', detail: String(e?.message ?? e) }, { status: 500 })
  }
}
