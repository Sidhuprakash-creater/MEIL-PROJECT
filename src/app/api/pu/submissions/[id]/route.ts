import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/pu/db'
import { getCurrentUser } from '@/lib/pu/session'
import { authErrorToStatus, parseJsonArray, parseRecordIds, submissionCompat } from '@/lib/pu/workflow'

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
        case 'ENVIRONMENT':
          sourceRecords = [
            ...(await db.energyRecord.findMany({ where: { id: { in: recordIds } }, include: { calculationResults: true, validationResults: true } })),
            ...(await db.waterRecord.findMany({ where: { id: { in: recordIds } }, include: { calculationResults: true, validationResults: true } })),
            ...(await db.wasteRecord.findMany({ where: { id: { in: recordIds } }, include: { calculationResults: true, validationResults: true } })),
            ...(await db.travelRecord.findMany({ where: { id: { in: recordIds } }, include: { calculationResults: true, validationResults: true } })),
          ]
          break
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
      const { getLevelRecordById } = await import('@/lib/pu/level-records')
      for (const rid of recordIds) {
        if (!sourceRecords.some((r) => (r as any).id === rid)) {
          const lr = getLevelRecordById(rid)
          if (lr) sourceRecords.push(lr as unknown as Record<string, unknown>)
        }
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

    let parsedValues: Array<{ label: string; value: string | number; unit?: string }> = []
    try {
      if ((submission as any).values) {
        const pv = JSON.parse((submission as any).values)
        if (Array.isArray(pv)) parsedValues = pv
      }
    } catch {}

    let evidenceList: string[] = []
    try {
      if ((submission as any).evidence) {
        const pe = JSON.parse((submission as any).evidence)
        if (Array.isArray(pe)) evidenceList = pe.filter(Boolean)
      }
    } catch {}

    const subDate = submission.submittedAt || submission.createdAt
    const d = new Date(subDate)
    const datePart = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    const timePart = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })

    return NextResponse.json({
      user: { id: user.id, name: user.name },
      submission: {
        ...submissionCompat(submission),
        recordIds,
        parsedValues,
        evidenceList,
        evidenceCount: evidenceList.length || submission.evidenceCount || 0,
        formattedDateTime: `${datePart} • ${timePart}`,
        reviewComment: submission.reviewComment || null,
        reviewedAt: submission.reviewedAt || null,
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
