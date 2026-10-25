import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { resolveIndicator } from '@/lib/brsr-resolver'

export const runtime = 'nodejs'

// GET /api/brsr/indicators?frameworkId=&scopeType=&scopeId=&reportingPeriodId=
// For each question with a mappingSource, resolve the real current value from
// approved source records (e.g. WORKFORCE.total → sum of workforce records,
// ENERGY.scope1 → sum of SCOPE_1 calculation results, etc.).
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  try {
    const sp = req.nextUrl.searchParams
    const frameworkId = sp.get('frameworkId')
    if (!frameworkId) {
      return NextResponse.json({ error: 'frameworkId query param required' }, { status: 400 })
    }
    const scopeType = sp.get('scopeType') // 'PROJECT' | 'GROUP' | ...
    const scopeId = sp.get('scopeId')
    const reportingPeriodId = sp.get('reportingPeriodId') || undefined

    const framework = await db.brsrFramework.findUnique({
      where: { id: frameworkId },
      include: { questions: { orderBy: { sortOrder: 'asc' }, include: { section: true, principle: true } } },
    })
    if (!framework) {
      return NextResponse.json({ error: 'Framework not found' }, { status: 404 })
    }

    type IndicatorEntry = {
      question: {
        id: string
        questionCode: string
        questionText: string
        answerType: string
        unit: string | null
        evidenceRequired: boolean
      }
      section: { code: string; name: string } | null
      principle: { code: string; name: string } | null
      mappingSource: string | null
      resolvedValue: number | string | null
      resolvedUnit: string | null
      sourceRecordIds: string[]
      sourceRecordType: string | null
      status: string
      derivation: string | null
    }
    const indicators: IndicatorEntry[] = []
    for (const q of framework.questions) {
      const resolved = await resolveIndicator(q.mappingSource, q.unit, {
        scopeType: scopeType ?? null,
        scopeId: scopeId ?? null,
        reportingPeriodId,
      })
      indicators.push({
        question: {
          id: q.id,
          questionCode: q.questionCode,
          questionText: q.questionText,
          answerType: q.answerType,
          unit: q.unit,
          evidenceRequired: q.evidenceRequired,
        },
        section: q.section ? { code: q.section.code, name: q.section.name } : null,
        principle: q.principle ? { code: q.principle.code, name: q.principle.name } : null,
        mappingSource: q.mappingSource,
        resolvedValue: resolved.resolvedValue,
        resolvedUnit: resolved.resolvedUnit,
        sourceRecordIds: resolved.sourceRecordIds,
        sourceRecordType: resolved.sourceRecordType,
        status: resolved.status,
        derivation: resolved.derivation,
      })
    }

    return NextResponse.json({ framework: { id: framework.id, name: framework.name, version: framework.version, reportingYear: framework.reportingYear }, indicators })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to resolve indicators', detail: String(e?.message ?? e) }, { status: 500 })
  }
}
