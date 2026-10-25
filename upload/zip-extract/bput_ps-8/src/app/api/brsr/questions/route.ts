import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export const runtime = 'nodejs'

// GET /api/brsr/questions?frameworkId=&section=&principle= — list questions for
// a framework with optional filters (section code or principle code), and
// the current BrsrAnswer records attached to each question.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  try {
    const sp = req.nextUrl.searchParams
    const frameworkId = sp.get('frameworkId')
    if (!frameworkId) {
      return NextResponse.json({ error: 'frameworkId query param required' }, { status: 400 })
    }
    const sectionCode = sp.get('section') // A | B | C
    const principleCode = sp.get('principle') // P1..P9

    const where: { frameworkId: string; section?: { code: string }; principle?: { code: string } } = { frameworkId }
    if (sectionCode) where.section = { code: sectionCode }
    if (principleCode) where.principle = { code: principleCode }

    const questions = await db.brsrQuestion.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      include: {
        section: true,
        principle: true,
        answers: {
          orderBy: { updatedAt: 'desc' },
          take: 1, // most recent answer per question
        },
      },
    })

    return NextResponse.json({
      questions: questions.map(q => ({
        id: q.id,
        questionCode: q.questionCode,
        questionText: q.questionText,
        answerType: q.answerType,
        unit: q.unit,
        evidenceRequired: q.evidenceRequired,
        applicabilityRule: q.applicabilityRule,
        mappingSource: q.mappingSource,
        calculationMethod: q.calculationMethod,
        sortOrder: q.sortOrder,
        section: q.section ? { id: q.section.id, code: q.section.code, name: q.section.name } : null,
        principle: q.principle ? { id: q.principle.id, code: q.principle.code, name: q.principle.name } : null,
        currentAnswer: q.answers[0]
          ? {
              id: q.answers[0].id,
              answerValue: q.answers[0].answerValue,
              numericValue: q.answers[0].numericValue,
              sourceType: q.answers[0].sourceType,
              sourceRecordId: q.answers[0].sourceRecordId,
              sourceRecordType: q.answers[0].sourceRecordType,
              calculationResultId: q.answers[0].calculationResultId,
              evidenceId: q.answers[0].evidenceId,
              status: q.answers[0].status,
              readinessWeight: q.answers[0].readinessWeight,
              updatedAt: q.answers[0].updatedAt,
            }
          : null,
      })),
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to load questions', detail: String(e?.message ?? e) }, { status: 500 })
  }
}
