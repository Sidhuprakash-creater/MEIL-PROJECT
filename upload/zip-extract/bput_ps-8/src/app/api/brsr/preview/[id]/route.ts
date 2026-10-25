import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { resolveIndicator } from '@/lib/brsr-resolver'

export const runtime = 'nodejs'

// GET /api/brsr/preview/[id]?scopeType=&scopeId=&reportingPeriodId=
// Renders a BRSR report preview for the given framework id — section / question
// / resolved value / source-status / evidence-status, ready to display.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  try {
    const { id } = await params
    const sp = req.nextUrl.searchParams
    const scopeType = sp.get('scopeType')
    const scopeId = sp.get('scopeId')
    const reportingPeriodId = sp.get('reportingPeriodId') || undefined

    const framework = await db.brsrFramework.findUnique({
      where: { id },
      include: {
        sections: { orderBy: { sortOrder: 'asc' } },
        principles: { orderBy: { sortOrder: 'asc' } },
        questions: {
          orderBy: { sortOrder: 'asc' },
          include: { section: true, principle: true, answers: true },
        },
      },
    })
    if (!framework) {
      return NextResponse.json({ error: 'Framework not found' }, { status: 404 })
    }

    // Build sectioned preview
    const sectionsOut: any[] = []
    for (const s of framework.sections) {
      const qs = framework.questions.filter(q => q.sectionId === s.id)
      type PreviewItem = {
        question: {
          id: string
          questionCode: string
          questionText: string
          answerType: string
          unit: string | null
          evidenceRequired: boolean
          principle: { code: string; name: string } | null
        }
        value: number | string | null
        unit: string | null
        mappingSource: string | null
        sourceStatus: string
        derivation: string | null
        sourceRecordIds: string[]
        sourceRecordType: string | null
        answer: {
          id: string
          sourceType: string
          status: string
          answerValue: string | null
          numericValue: number | null
          updatedAt: Date
        } | null
        evidence: { id: string; fileName: string; status: string; verifiedAt: Date | null; verifiedBy: string | null } | null
      }
      const items: PreviewItem[] = []
      for (const q of qs) {
        const resolved = await resolveIndicator(q.mappingSource, q.unit, {
          scopeType: scopeType ?? null,
          scopeId: scopeId ?? null,
          reportingPeriodId,
        })
        // Look up the latest stored BrsrAnswer (manual or already-mapped)
        const answer = q.answers.length > 0
          ? [...q.answers].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0]
          : null
        // Look up linked evidence (if any)
        let evidence: { id: string; fileName: string; status: string; verifiedAt: Date | null; verifiedBy: string | null } | null = null
        if (answer?.evidenceId) {
          evidence = await db.evidence.findUnique({
            where: { id: answer.evidenceId },
            select: { id: true, fileName: true, status: true, verifiedAt: true, verifiedBy: true },
          })
        }
        items.push({
          question: {
            id: q.id,
            questionCode: q.questionCode,
            questionText: q.questionText,
            answerType: q.answerType,
            unit: q.unit,
            evidenceRequired: q.evidenceRequired,
            principle: q.principle ? { code: q.principle.code, name: q.principle.name } : null,
          },
          value: resolved.resolvedValue,
          unit: resolved.resolvedUnit,
          mappingSource: q.mappingSource,
          sourceStatus: resolved.status,
          derivation: resolved.derivation,
          sourceRecordIds: resolved.sourceRecordIds,
          sourceRecordType: resolved.sourceRecordType,
          answer: answer
            ? {
                id: answer.id,
                sourceType: answer.sourceType,
                status: answer.status,
                answerValue: answer.answerValue,
                numericValue: answer.numericValue,
                updatedAt: answer.updatedAt,
              }
            : null,
          evidence,
        })
      }
      sectionsOut.push({
        section: { code: s.code, name: s.name, description: s.description },
        items,
      })
    }

    return NextResponse.json({
      framework: { id: framework.id, name: framework.name, version: framework.version, reportingYear: framework.reportingYear, tier: framework.tier },
      scope: { scopeType, scopeId, reportingPeriodId: reportingPeriodId ?? null },
      sections: sectionsOut,
      principles: framework.principles.map(p => ({ code: p.code, name: p.name, title: p.title })),
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to render preview', detail: String(e?.message ?? e) }, { status: 500 })
  }
}
