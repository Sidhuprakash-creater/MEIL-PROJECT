import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { authErrorToStatus, parseRecordIds } from '@/lib/workflow'

export const runtime = 'nodejs'

// GET /api/audit/trace/[id]?type=BrsbAnswer|Submission|EnergyRecord|...
// Returns a vertical traceability tree:
//   SOURCE → EVIDENCE → VALIDATION → CALCULATION → SUBMISSION → APPROVAL_HISTORY → BRSR_MAPPING
// Auto-detects entity type when ?type= is not provided.

type EntityType =
  | 'BrsbAnswer'
  | 'Submission'
  | 'EnergyRecord'
  | 'WaterRecord'
  | 'WasteRecord'
  | 'WorkforceRecord'
  | 'SafetyRecord'
  | 'TravelRecord'
  | 'UNKNOWN'

interface TraceNode {
  id: string
  type: string
  label: string
  data?: unknown
  children?: TraceNode[]
}

interface TraceResponse {
  user: { id: string; name: string }
  entity: { id: string; type: EntityType; label: string }
  tree: TraceNode[]
  summary: Record<string, number>
}

export async function GET(
  req: NextRequest,
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
  const { searchParams } = new URL(req.url)
  const requestedType = searchParams.get('type') || undefined

  try {
    // 1. Resolve the entity (auto-detect if no ?type= supplied)
    const detection = await detectEntity(id, requestedType as EntityType | undefined)
    if (detection.type === 'UNKNOWN' || !detection.record) {
      return NextResponse.json(
        { error: 'Entity not found in any source / submission / BRSR table' },
        { status: 404 },
      )
    }

    // 2. Derive a list of source record IDs as the canonical root of the trace.
    let sourceRecordIds: string[] = []
    let sourceModule: string | null = null
    let submissionId: string | null = null
    let brsbAnswerId: string | null = null
    let entityLabel = detection.label

    if (detection.type === 'Submission') {
      const sub = detection.record as {
        id: string
        recordIds: string
        module: string
        title: string
      }
      sourceRecordIds = parseRecordIds(sub.recordIds)
      sourceModule = sub.module
      submissionId = sub.id
      entityLabel = sub.title
    } else if (detection.type === 'BrsbAnswer') {
      const ans = detection.record as {
        id: string
        sourceRecordId: string | null
        sourceRecordType: string | null
        question?: { questionCode?: string; questionText?: string }
      }
      brsbAnswerId = ans.id
      if (ans.sourceRecordId) sourceRecordIds = [ans.sourceRecordId]
      sourceModule = ans.sourceRecordType || null
      entityLabel =
        ans.question?.questionCode || ans.question?.questionText || `BRSR Answer ${ans.id}`
    } else {
      // A source record id
      sourceRecordIds = [id]
      const rec = detection.record as { module?: string }
      sourceModule = rec.module || detection.type.toUpperCase().replace('RECORD', '')
    }

    // 3. SOURCE RECORDS — fetch the underlying source rows by module
    let sourceRecords: Record<string, unknown>[] = []
    if (sourceRecordIds.length > 0) {
      switch (sourceModule) {
        case 'ENERGY':
          sourceRecords = await db.energyRecord.findMany({
            where: { id: { in: sourceRecordIds } },
            include: { project: { select: { id: true, projectName: true, projectCode: true } } },
          })
          break
        case 'WATER':
          sourceRecords = await db.waterRecord.findMany({
            where: { id: { in: sourceRecordIds } },
            include: { project: { select: { id: true, projectName: true, projectCode: true } } },
          })
          break
        case 'WASTE':
          sourceRecords = await db.wasteRecord.findMany({
            where: { id: { in: sourceRecordIds } },
            include: { project: { select: { id: true, projectName: true, projectCode: true } } },
          })
          break
        case 'PEOPLE':
          sourceRecords = await db.workforceRecord.findMany({
            where: { id: { in: sourceRecordIds } },
            include: { project: { select: { id: true, projectName: true, projectCode: true } } },
          })
          break
        case 'SAFETY':
          sourceRecords = await db.safetyRecord.findMany({
            where: { id: { in: sourceRecordIds } },
            include: { project: { select: { id: true, projectName: true, projectCode: true } } },
          })
          break
        case 'TRAVEL':
          sourceRecords = await db.travelRecord.findMany({
            where: { id: { in: sourceRecordIds } },
            include: { project: { select: { id: true, projectName: true, projectCode: true } } },
          })
          break
        default:
          // Fall back to scanning all source tables
          sourceRecords = await scanAllSourceTables(sourceRecordIds)
      }
    }

    // 4. EVIDENCE — gather evidence either directly attached to source records
    //    (via evidenceId) or matched on the same project+period+module.
    const directEvidenceIds = sourceRecords
      .map((r) => (r as { evidenceId?: string | null }).evidenceId)
      .filter((x): x is string => Boolean(x))
    let evidence: Record<string, unknown>[] = []
    if (directEvidenceIds.length > 0) {
      evidence = await db.evidence.findMany({
        where: { id: { in: directEvidenceIds } },
        include: { uploader: { select: { id: true, name: true, email: true } } },
      })
    }
    // Also scan for evidence linked to the source records by sourceRecordId column
    const extraEvidence = sourceRecordIds.length
      ? await db.evidence.findMany({
          where: { sourceRecordId: { in: sourceRecordIds } },
          include: { uploader: { select: { id: true, name: true, email: true } } },
        })
      : []
    const evidenceMap = new Map<string, Record<string, unknown>>()
    for (const e of [...evidence, ...extraEvidence]) evidenceMap.set((e as { id: string }).id, e as Record<string, unknown>)
    evidence = Array.from(evidenceMap.values())

    // 5. VALIDATION — validation results for the source records
    const validationResults = sourceRecordIds.length
      ? await db.validationResult.findMany({
          where: { recordId: { in: sourceRecordIds } },
          orderBy: { detectedAt: 'asc' },
        })
      : []

    // 6. CALCULATION — calculation results for the source records (per-module column)
    let calculationResults: Record<string, unknown>[] = []
    if (sourceRecordIds.length > 0) {
      switch (sourceModule) {
        case 'ENERGY':
          calculationResults = await db.calculationResult.findMany({
            where: { energyRecordId: { in: sourceRecordIds } },
          })
          break
        case 'WATER':
          calculationResults = await db.calculationResult.findMany({
            where: { waterRecordId: { in: sourceRecordIds } },
          })
          break
        case 'WASTE':
          calculationResults = await db.calculationResult.findMany({
            where: { wasteRecordId: { in: sourceRecordIds } },
          })
          break
        case 'TRAVEL':
          calculationResults = await db.calculationResult.findMany({
            where: { travelRecordId: { in: sourceRecordIds } },
          })
          break
      }
    }

    // 7. SUBMISSION — find submission(s) whose recordIds contain any of our
    //    source record IDs. (Parsed client-side; demo-scale data.)
    let submission: Record<string, unknown> | null = null
    let approvalHistory: Record<string, unknown>[] = []
    let corrections: Record<string, unknown>[] = []
    if (submissionId) {
      const sub = await db.submission.findUnique({
        where: { id: submissionId },
        include: {
          project: { select: { id: true, projectName: true, projectCode: true } },
          reportingPeriod: { select: { id: true, periodLabel: true } },
          currentReviewer: { select: { id: true, name: true, email: true } },
        },
      })
      if (sub) {
        submission = sub as Record<string, unknown>
        approvalHistory = await db.submissionStatusHistory.findMany({
          where: { submissionId: sub.id },
          orderBy: { createdAt: 'asc' },
        })
        corrections = await db.correctionRequest.findMany({
          where: { submissionId: sub.id },
          orderBy: { createdAt: 'asc' },
        })
      }
    } else if (sourceRecordIds.length > 0) {
      const candidates = await db.submission.findMany({
        include: {
          project: { select: { id: true, projectName: true, projectCode: true } },
          reportingPeriod: { select: { id: true, periodLabel: true } },
          currentReviewer: { select: { id: true, name: true, email: true } },
        },
      })
      const matched = candidates.find((c) => {
        const ids = parseRecordIds(c.recordIds)
        return ids.some((rid) => sourceRecordIds.includes(rid))
      })
      if (matched) {
        submission = matched as Record<string, unknown>
        submissionId = (matched as { id: string }).id
        approvalHistory = await db.submissionStatusHistory.findMany({
          where: { submissionId: matched.id },
          orderBy: { createdAt: 'asc' },
        })
        corrections = await db.correctionRequest.findMany({
          where: { submissionId: matched.id },
          orderBy: { createdAt: 'asc' },
        })
      }
    }

    // 8. BRSR MAPPING — answers pointing to these source records
    const brsrMappings = sourceRecordIds.length
      ? await db.brsrAnswer.findMany({
          where: { sourceRecordId: { in: sourceRecordIds } },
          include: {
            question: {
              select: {
                questionCode: true,
                questionText: true,
                principle: { select: { code: true, name: true } },
                section: { select: { code: true, name: true } },
              },
            },
          },
        })
      : []

    // 9. Build the tree
    const tree: TraceNode[] = []
    const summary: Record<string, number> = {}

    const sourceNode: TraceNode = {
      id: `source-${id}`,
      type: 'STAGE',
      label: 'SOURCE RECORDS',
      children: sourceRecords.map((r) => ({
        id: (r as { id: string }).id,
        type: 'SourceRecord',
        label: `${sourceModule || 'RECORD'} — ${((r as { project?: { projectCode?: string } }).project?.projectCode) || ''} ${String((r as { revisionNumber?: number }).revisionNumber ? `r${(r as { revisionNumber: number }).revisionNumber}` : '')}`.trim(),
        data: r,
      })),
    }
    summary.sourceRecords = sourceRecords.length
    tree.push(sourceNode)

    const evidenceNode: TraceNode = {
      id: `evidence-${id}`,
      type: 'STAGE',
      label: 'EVIDENCE',
      children: evidence.map((e) => ({
        id: (e as { id: string }).id,
        type: 'Evidence',
        label: (e as { fileName: string }).fileName,
        data: {
          id: (e as { id: string }).id,
          fileName: (e as { fileName: string }).fileName,
          status: (e as { status: string }).status,
          documentType: (e as { documentType?: string }).documentType,
          verifiedBy: (e as { verifiedBy?: string | null }).verifiedBy,
          verifiedAt: (e as { verifiedAt?: Date | null }).verifiedAt,
        },
      })),
    }
    summary.evidence = evidence.length
    tree.push(evidenceNode)

    const validationNode: TraceNode = {
      id: `validation-${id}`,
      type: 'STAGE',
      label: 'VALIDATION',
      children: validationResults.map((v) => ({
        id: (v as { id: string }).id,
        type: 'ValidationResult',
        label: `${(v as { ruleCode: string }).ruleCode} — ${(v as { severity: string }).severity}`,
        data: v,
      })),
    }
    summary.validationResults = validationResults.length
    tree.push(validationNode)

    const calcNode: TraceNode = {
      id: `calc-${id}`,
      type: 'STAGE',
      label: 'CALCULATION',
      children: calculationResults.map((c) => ({
        id: (c as { id: string }).id,
        type: 'CalculationResult',
        label: `${(c as { calculatedValue: number }).calculatedValue} ${(c as { resultUnit: string }).resultUnit}${(c as { scope?: string | null }).scope ? ` [${(c as { scope: string }).scope}]` : ''}`,
        data: c,
      })),
    }
    summary.calculationResults = calculationResults.length
    tree.push(calcNode)

    const submissionNode: TraceNode = {
      id: `submission-${id}`,
      type: 'STAGE',
      label: 'SUBMISSION',
      children: submission
        ? [
            {
              id: (submission as { id: string }).id,
              type: 'Submission',
              label: `${(submission as { title: string }).title} — ${(submission as { status: string }).status}`,
              data: submission,
            },
          ]
        : [],
    }
    summary.submission = submission ? 1 : 0
    tree.push(submissionNode)

    const historyNode: TraceNode = {
      id: `history-${id}`,
      type: 'STAGE',
      label: 'APPROVAL HISTORY',
      children: approvalHistory.map((h) => ({
        id: (h as { id: string }).id,
        type: 'StatusHistory',
        label: `${(h as { action: string }).action}: ${(h as { fromStatus: string }).fromStatus} → ${(h as { toStatus: string }).toStatus}`,
        data: h,
      })),
    }
    summary.history = approvalHistory.length
    tree.push(historyNode)

    const correctionsNode: TraceNode = {
      id: `corrections-${id}`,
      type: 'STAGE',
      label: 'CORRECTIONS',
      children: corrections.map((c) => ({
        id: (c as { id: string }).id,
        type: 'CorrectionRequest',
        label: `${(c as { field: string }).field} — ${(c as { severity: string }).severity}`,
        data: c,
      })),
    }
    summary.corrections = corrections.length
    tree.push(correctionsNode)

    const brsrNode: TraceNode = {
      id: `brsr-${id}`,
      type: 'STAGE',
      label: 'BRSR MAPPING',
      children: brsrMappings.map((a) => ({
        id: (a as { id: string }).id,
        type: 'BrsrAnswer',
        label:
          (a as { question?: { questionCode?: string } }).question?.questionCode ||
          (a as { question?: { questionText?: string } }).question?.questionText ||
          (a as { id: string }).id,
        data: a,
      })),
    }
    summary.brsrMappings = brsrMappings.length
    tree.push(brsrNode)

    const response: TraceResponse = {
      user: { id: user.id, name: user.name },
      entity: { id, type: detection.type, label: entityLabel },
      tree,
      summary,
    }
    return NextResponse.json(response)
  } catch (e) {
    console.error('GET /api/audit/trace/[id] error', e)
    return NextResponse.json(
      { error: 'Failed to build traceability tree' },
      { status: 500 },
    )
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function detectEntity(
  id: string,
  requestedType: EntityType | undefined,
): Promise<{
  type: EntityType
  record: Record<string, unknown> | null
  label: string
}> {
  if (requestedType && requestedType !== 'UNKNOWN') {
    const r = await fetchEntity(id, requestedType)
    return { type: requestedType, record: r, label: requestedType }
  }
  // Auto-detect
  const a = await db.brsrAnswer.findUnique({
    where: { id },
    include: { question: { select: { questionCode: true, questionText: true } } },
  })
  if (a) return { type: 'BrsbAnswer', record: a as unknown as Record<string, unknown>, label: 'BrsbAnswer' }
  const s = await db.submission.findUnique({ where: { id } })
  if (s) return { type: 'Submission', record: s as unknown as Record<string, unknown>, label: 'Submission' }
  const ordered: EntityType[] = [
    'EnergyRecord',
    'WaterRecord',
    'WasteRecord',
    'WorkforceRecord',
    'SafetyRecord',
    'TravelRecord',
  ]
  for (const t of ordered) {
    const r = await fetchEntity(id, t)
    if (r) return { type: t, record: r, label: t }
  }
  return { type: 'UNKNOWN', record: null, label: 'UNKNOWN' }
}

async function fetchEntity(
  id: string,
  type: EntityType,
): Promise<Record<string, unknown> | null> {
  switch (type) {
    case 'BrsbAnswer':
      return (await db.brsrAnswer.findUnique({
        where: { id },
        include: { question: { select: { questionCode: true, questionText: true } } },
      })) as unknown as Record<string, unknown> | null
    case 'Submission':
      return (await db.submission.findUnique({ where: { id } })) as unknown as Record<string, unknown> | null
    case 'EnergyRecord':
      return (await db.energyRecord.findUnique({ where: { id } })) as unknown as Record<string, unknown> | null
    case 'WaterRecord':
      return (await db.waterRecord.findUnique({ where: { id } })) as unknown as Record<string, unknown> | null
    case 'WasteRecord':
      return (await db.wasteRecord.findUnique({ where: { id } })) as unknown as Record<string, unknown> | null
    case 'WorkforceRecord':
      return (await db.workforceRecord.findUnique({ where: { id } })) as unknown as Record<string, unknown> | null
    case 'SafetyRecord':
      return (await db.safetyRecord.findUnique({ where: { id } })) as unknown as Record<string, unknown> | null
    case 'TravelRecord':
      return (await db.travelRecord.findUnique({ where: { id } })) as unknown as Record<string, unknown> | null
    default:
      return null
  }
}

async function scanAllSourceTables(
  ids: string[],
): Promise<Record<string, unknown>[]> {
  const [e, w, wa, pe, s, t] = await Promise.all([
    db.energyRecord.findMany({ where: { id: { in: ids } }, include: { project: { select: { id: true, projectName: true, projectCode: true } } } }),
    db.waterRecord.findMany({ where: { id: { in: ids } }, include: { project: { select: { id: true, projectName: true, projectCode: true } } } }),
    db.wasteRecord.findMany({ where: { id: { in: ids } }, include: { project: { select: { id: true, projectName: true, projectCode: true } } } }),
    db.workforceRecord.findMany({ where: { id: { in: ids } }, include: { project: { select: { id: true, projectName: true, projectCode: true } } } }),
    db.safetyRecord.findMany({ where: { id: { in: ids } }, include: { project: { select: { id: true, projectName: true, projectCode: true } } } }),
    db.travelRecord.findMany({ where: { id: { in: ids } }, include: { project: { select: { id: true, projectName: true, projectCode: true } } } }),
  ])
  return [...e, ...w, ...wa, ...pe, ...s, ...t] as unknown as Record<string, unknown>[]
}
