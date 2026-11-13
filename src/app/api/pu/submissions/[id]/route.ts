import { ensureLevelRecordsLoaded } from '@/lib/pu/level-records';
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/pu/db'
import { getCurrentUser } from '@/lib/pu/session'
import { authErrorToStatus, parseJsonArray, parseRecordIds, submissionCompat } from '@/lib/pu/workflow'

export const runtime = 'nodejs'

/* The reviewer conversations live in comments[] as
   { author, role, text, at }. The last entry is the most recent review note. */
function latestReviewerComment(submission: Record<string, any>): string | null {
  try {
    const parsed = typeof submission.comments === 'string' ? JSON.parse(submission.comments) : submission.comments
    if (Array.isArray(parsed) && parsed.length) {
      const last = parsed[parsed.length - 1]
      const text = String(last?.text || last?.comment || last?.note || '').trim()
      if (text) return text
    }
  } catch {}
  return null
}

// GET /api/submissions/[id] — full submission detail.
// Returns: submission meta + source records + evidence + validation +
// calculations + history + corrections + BRSR mappings.
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  /* Hydrate the level-records store from the DB blob before first read (Vercel read-only FS). */
  await ensureLevelRecordsLoaded().catch(() => {});
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

    // --- SOURCE RECORDS ---
    /* Prefer the JSON LevelRecords (they carry the per-source items[] the
       contributor staged), falling back to the Prisma mirrors. */
    let sourceRecords: Record<string, unknown>[] = []
    if (recordIds.length > 0) {
      const { getLevelRecordById, getLevelRecords } = await import('@/lib/pu/level-records')
      for (const rid of recordIds) {
        const lr = getLevelRecordById(rid)
        if (lr) sourceRecords.push(lr as unknown as Record<string, unknown>)
      }
      const missing = recordIds.filter((rid) => !sourceRecords.some((r) => (r as { id?: string }).id === rid))
      if (missing.length > 0) {
        switch (submission.module) {
          case 'ENVIRONMENT':
            sourceRecords.push(
              ...(await db.energyRecord.findMany({ where: { id: { in: missing } }, include: { calculationResults: true, validationResults: true } })),
              ...(await db.waterRecord.findMany({ where: { id: { in: missing } }, include: { calculationResults: true, validationResults: true } })),
              ...(await db.wasteRecord.findMany({ where: { id: { in: missing } }, include: { calculationResults: true, validationResults: true } })),
              ...(await db.travelRecord.findMany({ where: { id: { in: missing } }, include: { calculationResults: true, validationResults: true } })),
            )
            break
          case 'ENERGY':
            sourceRecords.push(...(await db.energyRecord.findMany({ where: { id: { in: missing } }, include: { calculationResults: true, validationResults: true } })))
            break
          case 'WATER':
            sourceRecords.push(...(await db.waterRecord.findMany({ where: { id: { in: missing } }, include: { calculationResults: true, validationResults: true } })))
            break
          case 'WASTE':
            sourceRecords.push(...(await db.wasteRecord.findMany({ where: { id: { in: missing } }, include: { calculationResults: true, validationResults: true } })))
            break
          case 'PEOPLE':
            sourceRecords.push(...(await db.workforceRecord.findMany({ where: { id: { in: missing } }, include: { validationResults: true } })))
            break
          case 'SAFETY':
            sourceRecords.push(...(await db.safetyRecord.findMany({ where: { id: { in: missing } }, include: { validationResults: true } })))
            break
          case 'TRAVEL':
            sourceRecords.push(...(await db.travelRecord.findMany({ where: { id: { in: missing } }, include: { calculationResults: true, validationResults: true } })))
            break
          case 'ALL_LEVELS':
            /* Consolidated dossier — its recordIds span every BRSR level, so
               recover whatever the JSON store could not resolve from the store
               itself (all records for the submission's project). */
            sourceRecords.push(
              ...getLevelRecords(submission.projectId || undefined)
                .filter((r) => missing.includes(r.id))
                .map((r) => r as unknown as Record<string, unknown>),
            )
            break
          default:
            break
        }
      }
    }
    // --- EVIDENCE ---
    /* Collect evidence both at record level AND per staged item — the itemized
       levels (1/2/4) attach documents to each source item, so the vault view
       must gather every evidenceIds[] nested inside data.items[]. */
    const evidenceIdsSet = new Set<string>()
    for (const r of sourceRecords) {
      const rec = r as { evidenceId?: string | null; evidenceIds?: string[] | null; data?: { items?: any[] } }
      if (rec.evidenceId) evidenceIdsSet.add(rec.evidenceId)
      if (Array.isArray(rec.evidenceIds)) rec.evidenceIds.filter(Boolean).forEach((x) => evidenceIdsSet.add(x))
      const items = Array.isArray(rec.data?.items) ? rec.data.items : []
      for (const it of items) {
        if (Array.isArray(it?.evidenceIds)) it.evidenceIds.filter(Boolean).forEach((x: string) => evidenceIdsSet.add(x))
        else if (it?.evidenceId) evidenceIdsSet.add(String(it.evidenceId))
      }
    }
    const evidenceIds = Array.from(evidenceIdsSet)

    // --- VALIDATION RESULTS (all of them for the records) ---
    const validationResultsP: Promise<Record<string, unknown>[]> = recordIds.length
      ? db.validationResult.findMany({
          where: { recordId: { in: recordIds } },
          orderBy: { detectedAt: 'desc' },
        })
      : Promise.resolve([])

    // --- CALCULATION RESULTS ---
    const calcFilter = (() => {
      switch (submission.module ?? '') {
        case 'ENERGY': return { energyRecordId: { in: recordIds } }
        case 'WATER': return { waterRecordId: { in: recordIds } }
        case 'WASTE': return { wasteRecordId: { in: recordIds } }
        case 'TRAVEL': return { travelRecordId: { in: recordIds } }
        default: return null
      }
    })()
    const calculationResultsP: Promise<Record<string, unknown>[]> = calcFilter && recordIds.length
      ? db.calculationResult.findMany({
          where: calcFilter as Record<string, unknown>,
          orderBy: { calculatedAt: 'desc' },
        })
      : Promise.resolve([])

    // --- BRSR MAPPINGS (answers pointing to these source records) ---
    const brsrMappingsP: Promise<Record<string, unknown>[]> = recordIds.length
      ? db.brsrAnswer.findMany({
          where: { sourceRecordId: { in: recordIds } },
          include: { question: { select: { questionCode: true, questionText: true } } },
        })
      : Promise.resolve([])

    // --- AUDIT TRAIL for this submission ---
    const auditTrailP = db.soAuditLog.findMany({
      where: { entityType: 'Submission', entityId: submission.id },
      orderBy: { createdAt: 'asc' },
      take: 100,
    })

    // Evidence query runs alongside the rest — one parallel batch instead of
    // five sequential round-trips (this detail endpoint previously dominated
    // the sheet-open latency).
    const evidenceP: Promise<Record<string, unknown>[]> = evidenceIds.length
      ? db.evidence.findMany({
          where: { id: { in: evidenceIds } },
          include: { uploader: { select: { id: true, name: true, email: true } } },
        })
      : Promise.resolve([])

    const [evidence, validationResults, calculationResults, brsrMappings, auditTrail] = await Promise.all([
      evidenceP,
      validationResultsP,
      calculationResultsP,
      brsrMappingsP,
      auditTrailP,
    ]) as [Record<string, unknown>[], Record<string, unknown>[], Record<string, unknown>[], Record<string, unknown>[], Record<string, unknown>[]]

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
        /* WHO sent it back / reviewed it — the review-window banner uses this.
           The reviewer relation covers BOTH the Project Admin and the Business
           Unit (bm decision writes reviewerId), so the contributor always sees
           the real reviewer instead of a hardcoded "Project Admin". */
        currentReviewer: (submission as any).reviewer
          ? { id: (submission as any).reviewer.id, name: (submission as any).reviewer.name, email: (submission as any).reviewer.email }
          : null,
        /* The BU's return flow persists its reason + correction instructions
           in comments[] (and, going forward, also in reviewComment). Older
           returned reports have the message ONLY in comments[] — fall back to
           the latest reviewer comment so the contributor still sees it. */
        reviewComment: submission.reviewComment || latestReviewerComment(submission) || null,
        reviewedAt: submission.reviewedAt || null,
        history: parseJsonArray(submission.history).map((h: any, idx: number) => ({
          id: h.id || `hist-${submission.id}-${idx}`,
          action: h.action || "STATUS_CHANGE",
          fromStatus: h.fromStatus || "SUBMITTED",
          toStatus: h.toStatus || submission.status,
          actorName: h.actorName || h.actor || "Reviewer",
          actorRole: h.actorRole || "Project Admin",
          comment: h.comment || h.note || "",
          note: h.note || h.comment || "",
          createdAt: h.createdAt || h.at || submission.updatedAt || submission.createdAt,
          at: h.at || h.createdAt || submission.updatedAt || submission.createdAt,
        })),
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
