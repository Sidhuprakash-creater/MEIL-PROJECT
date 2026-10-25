import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { READY_STATUSES } from '@/lib/brsr-resolver'

export const runtime = 'nodejs'

// GET /api/brsr/principles?frameworkId= — principles P1..P9 with their questions
// and a roll-up of answer-status readiness for each principle.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  try {
    const frameworkId = req.nextUrl.searchParams.get('frameworkId')
    if (!frameworkId) {
      return NextResponse.json({ error: 'frameworkId query param required' }, { status: 400 })
    }

    const principles = await db.brsrPrinciple.findMany({
      where: { frameworkId },
      orderBy: { sortOrder: 'asc' },
      include: {
        questions: {
          orderBy: { sortOrder: 'asc' },
          include: { answers: { select: { id: true, status: true } } },
        },
      },
    })

    const result = principles.map(p => {
      const answers = p.questions.flatMap(q => q.answers)
      const total = answers.length
      const ready = answers.filter(a => READY_STATUSES.includes(a.status)).length
      const missing = answers.filter(a => a.status === 'MISSING').length
      const draft = answers.filter(a => a.status === 'DRAFT').length
      return {
        id: p.id,
        code: p.code,
        name: p.name,
        title: p.title,
        description: p.description,
        sortOrder: p.sortOrder,
        questionCount: p.questions.length,
        answerRollup: {
          total,
          ready,
          missing,
          draft,
          readiness: total > 0 ? Math.round((ready / total) * 1000) / 10 : 0,
        },
        questions: p.questions.map(q => ({
          id: q.id,
          questionCode: q.questionCode,
          questionText: q.questionText,
          answerType: q.answerType,
          unit: q.unit,
          mappingSource: q.mappingSource,
          evidenceRequired: q.evidenceRequired,
          sortOrder: q.sortOrder,
        })),
      }
    })

    return NextResponse.json({ principles: result })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to load principles', detail: String(e?.message ?? e) }, { status: 500 })
  }
}
