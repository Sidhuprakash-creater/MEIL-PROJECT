import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/pu/db'
import { getCurrentUser } from '@/lib/pu/session'
import { authErrorToStatus, parseJsonArray, parseRecordIds } from '@/lib/pu/workflow'

export const runtime = 'nodejs'

// GET /api/submissions/[id] — full submission detail.
// Returns: submission meta + source records + evidence + validation +
// calculations + history + corrections + BRSR mappings.
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  let user
  try {
    const u = await getCurrentUser()
    if (!u) throw new Error('UNAUTHENTICATED')
    user = u
  } catch (e) {
    const code = authErrorToStatus(e)
    return NextResponse.json(
      { error: 'Unauthenticated' },
      { status: code ?? 500 },
    )
  }

  const { id } = await ctx.params

  try {
    const submission = await db.submission.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            code: true,
            name: true,
            location: true,
            status: true,
            businessUnit: {
              select: { id: true, name: true, subsidiary: { select: { id: true, name: true } } },
            },
          },
        },
        reportingPeriod: {
          select: {
            id: true,
            periodLabel: true,
            year: true,
            month: true,
            status: true,
            reportingYear: { select: { id: true, label: true, year: true } },
          },
        },
        reviewer: { select: { id: true, name: true, email: true } },
      },
    })

    if (!submission) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 },
      )
    }

    const recordIds = parseRecordIds(submission.recordIds)

    // --- SOURCE RECORDS (full rows by module) ---
    let sourceRecords: Record<string, unknown>[] = []
    if (recordIds.length > 0) {
      switch (submission.module) {
        case 'ENERGY':
          sourceRecords = await db.energyRecord.findMany({
            where: { id: { in: recordIds } },
            include: { calculationResults: true, validationResults: true },
          })
          break
        case 'WATER':
          sourceRecords = await db.waterRecord.findMany({
            where: { id: { in: recordIds } },
            include: { calculationResults: true, validationResults: true },
          })
          break
        case 'WASTE':
          sourceRecords = await db.wasteRecord.findMany({
            where: { id: { in: recordIds } },
            include: { calculationResults: true, validationResults: true },
          })
          break
        case 'PEOPLE':
          sourceRecords = await db.workforceRecord.findMany({
            where: { id: { in: recordIds } },
            include: { validationResults: true },
          })
          break
        case 'SAFETY':
          sourceRecords = await db.safetyRecord.findMany({
            where: { id: { in: recordIds } },
            include: { validationResults: true },
          })
          break
        case 'TRAVEL':
          sourceRecords = await db.travelRecord.findMany({
            where: { id: { in: recordIds } },
            include: { calculationResults: true, validationResults: true },
          })
          break
        default:
          break
      }
      if (sourceRecords.length === 0) {
        const { getLevelRecordById } = await import('@/lib/pu/level-records')
        sourceRecords = recordIds
          .map((id) => getLevelRecordById(id))
          .filter(Boolean) as unknown as Record<string, unknown>[]
      }
    }

    // --- EVIDENCE ---
    const evidenceIds = sourceRecords
      .map((r) => (r as { evidenceId?: string | null }).evidenceId)
      .filter((x): x is string => Boolean(x))
    const evidence = evidenceIds.length
      ? await db.evidence.findMany({
          where: { id: { in: evidenceIds } },
          include: { uploader: { select: { id: true, name: true, email: true } } },
        })
      : []

    // --- VALIDATION RESULTS (all of them for the records) ---
    const validationResults = recordIds.length
      ? await db.validationResult.findMany({
          where: { recordId: { in: recordIds } },
          orderBy: { detectedAt: 'desc' },
        })
      : []

    // --- CALCULATION RESULTS ---
    let calculationResults: Record<string, unknown>[] = []
    if (recordIds.length > 0) {
      switch (submission.module ?? '') {
        case 'ENERGY':
          calculationResults = await db.calculationResult.findMany({
            where: { energyRecordId: { in: recordIds } },
            orderBy: { calculatedAt: 'desc' },
          })
          break
        case 'WATER':
          calculationResults = await db.calculationResult.findMany({
            where: { waterRecordId: { in: recordIds } },
            orderBy: { calculatedAt: 'desc' },
          })
          break
        case 'WASTE':
          calculationResults = await db.calculationResult.findMany({
            where: { wasteRecordId: { in: recordIds } },
            orderBy: { calculatedAt: 'desc' },
          })
          break
        case 'TRAVEL':
          calculationResults = await db.calculationResult.findMany({
            where: { travelRecordId: { in: recordIds } },
            orderBy: { calculatedAt: 'desc' },
          })
          break
      }
    }

    // --- BRSR MAPPINGS (answers pointing to these source records) ---
    const brsrMappings = recordIds.length
      ? await db.brsrAnswer.findMany({
          where: { sourceRecordId: { in: recordIds } },
          include: { question: { select: { questionCode: true, questionText: true } } },
        })
      : []

    // --- AUDIT TRAIL for this submission ---
    const auditTrail = await db.soAuditLog.findMany({
      where: { entityType: 'Submission', entityId: submission.id },
      orderBy: { createdAt: 'asc' },
      take: 100,
    })

    return NextResponse.json({
      user: { id: user.id, name: user.name },
      submission: {
        ...submission,
        recordIds,
        history: parseJsonArray(submission.history),
        corrections: parseJsonArray(submission.corrections),
      },
      sourceRecords,
      evidence,
      validationResults,
      calculationResults,
      brsrMappings,
      auditTrail,
    })
  } catch (e) {
    console.error('GET /api/submissions/[id] error', e)
    return NextResponse.json(
      { error: 'Failed to fetch submission' },
      { status: 500 },
    )
  }
}
