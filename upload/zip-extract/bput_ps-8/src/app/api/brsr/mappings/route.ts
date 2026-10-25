import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { resolveIndicator } from '@/lib/brsr-resolver'

export const runtime = 'nodejs'

// GET /api/brsr/mappings?frameworkId=&questionId=
// Returns which BRSR questions map to which source modules/records.
// - If questionId is provided, returns the detailed mapping for that single question.
// - Otherwise, returns a roll-up of every question's mappingSource + resolved
//   source-record IDs grouped by source module.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  try {
    const sp = req.nextUrl.searchParams
    const frameworkId = sp.get('frameworkId')
    if (!frameworkId) {
      return NextResponse.json({ error: 'frameworkId query param required' }, { status: 400 })
    }
    const questionId = sp.get('questionId')
    const scopeType = sp.get('scopeType')
    const scopeId = sp.get('scopeId')
    const reportingPeriodId = sp.get('reportingPeriodId') || undefined

    if (questionId) {
      const q = await db.brsrQuestion.findUnique({
        where: { id: questionId },
        include: { section: true, principle: true },
      })
      if (!q || q.frameworkId !== frameworkId) {
        return NextResponse.json({ error: 'Question not found in this framework' }, { status: 404 })
      }
      const resolved = await resolveIndicator(q.mappingSource, q.unit, {
        scopeType: scopeType ?? null,
        scopeId: scopeId ?? null,
        reportingPeriodId,
      })
      // Pull source records so the client can show them
      const sourceRecords = await fetchSourceRecords(resolved.sourceRecordType, resolved.sourceRecordIds)
      return NextResponse.json({
        mapping: {
          question: {
            id: q.id,
            questionCode: q.questionCode,
            questionText: q.questionText,
            answerType: q.answerType,
            unit: q.unit,
            evidenceRequired: q.evidenceRequired,
            section: q.section ? { code: q.section.code, name: q.section.name } : null,
            principle: q.principle ? { code: q.principle.code, name: q.principle.name } : null,
          },
          mappingSource: q.mappingSource,
          calculationMethod: q.calculationMethod,
          sourceType: resolved.sourceRecordType,
          resolvedValue: resolved.resolvedValue,
          status: resolved.status,
          derivation: resolved.derivation,
          sourceRecordIds: resolved.sourceRecordIds,
          sourceRecords,
        },
      })
    }

    // No questionId — return roll-up by source module (the prefix of mappingSource).
    const questions = await db.brsrQuestion.findMany({
      where: { frameworkId },
      orderBy: { sortOrder: 'asc' },
      include: { section: true, principle: true },
    })

    type MappingEntry = {
      question: { id: string; questionCode: string; questionText: string; unit: string | null }
      mappingSource: string | null
      sourceRecordIds: string[]
      status: string
    }
    const byModule: Record<string, MappingEntry[]> = {}
    const flat: Array<MappingEntry & { sourceRecordType: string | null; resolvedValue: number | string | null }> = []
    for (const q of questions) {
      const resolved = await resolveIndicator(q.mappingSource, q.unit, {
        scopeType: scopeType ?? null,
        scopeId: scopeId ?? null,
        reportingPeriodId,
      })
      const moduleKey = q.mappingSource ? q.mappingSource.split('.')[0] : 'UNMAPPED'
      if (!byModule[moduleKey]) byModule[moduleKey] = []
      const entry = {
        question: {
          id: q.id,
          questionCode: q.questionCode,
          questionText: q.questionText,
          unit: q.unit,
        },
        mappingSource: q.mappingSource,
        sourceRecordIds: resolved.sourceRecordIds,
        status: resolved.status,
      }
      byModule[moduleKey].push(entry)
      flat.push({ ...entry, sourceRecordType: resolved.sourceRecordType, resolvedValue: resolved.resolvedValue })
    }

    return NextResponse.json({ byModule, flat })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to load mappings', detail: String(e?.message ?? e) }, { status: 500 })
  }
}

// Helper to pull source records by type/id for the response payload.
async function fetchSourceRecords(
  recordType: string | null,
  ids: string[]
): Promise<unknown[]> {
  if (!recordType || ids.length === 0) return []
  try {
    switch (recordType) {
      case 'EnergyRecord':
        return await db.energyRecord.findMany({ where: { id: { in: ids } }, select: { id: true, source: true, quantity: true, sourceUnit: true, normalizedValue: true, status: true, reportingPeriodId: true } })
      case 'WaterRecord':
        return await db.waterRecord.findMany({ where: { id: { in: ids } }, select: { id: true, source: true, withdrawal: true, sourceUnit: true, status: true, reportingPeriodId: true } })
      case 'WasteRecord':
        return await db.wasteRecord.findMany({ where: { id: { in: ids } }, select: { id: true, wasteType: true, hazardous: true, generatedQty: true, sourceUnit: true, status: true, reportingPeriodId: true } })
      case 'WorkforceRecord':
        return await db.workforceRecord.findMany({ where: { id: { in: ids } }, select: { id: true, category: true, permanent: true, nonPermanent: true, female: true, trainingHours: true, status: true, reportingPeriodId: true } })
      case 'SafetyRecord':
        return await db.safetyRecord.findMany({ where: { id: { in: ids } }, select: { id: true, recordType: true, fatalities: true, injuries: true, lostTimeIncidents: true, manHoursWorked: true, status: true, reportingPeriodId: true } })
      case 'Subsidiary':
        return await db.subsidiary.findMany({ where: { id: { in: ids } }, select: { id: true, code: true, name: true, cin: true } })
      default:
        return []
    }
  } catch {
    return []
  }
}
