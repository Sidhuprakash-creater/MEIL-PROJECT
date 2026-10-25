import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, requirePermission } from '@/lib/session'
import {
  appendAudit,
  authErrorToStatus,
  computeSubmissionRollup,
  fetchSourceRecords,
  parseRecordIds,
  primaryRoleLabel,
} from '@/lib/workflow'

export const runtime = 'nodejs'

// GET /api/submissions?projectId=&periodId=&module=&status=
// Paginated list (take 50). Includes project, reportingPeriod, history.
export async function GET(req: NextRequest) {
  let user
  try {
    user = await requireUserOrThrow()
  } catch (e) {
    const code = authErrorToStatus(e)
    return NextResponse.json(
      { error: code === 403 ? 'Forbidden' : 'Unauthenticated' },
      { status: code ?? 500 },
    )
  }

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId') || undefined
  const periodId = searchParams.get('periodId') || undefined
  const moduleFilter = searchParams.get('module') || undefined
  const status = searchParams.get('status') || undefined
  const take = Math.min(
    Number(searchParams.get('take') || 50),
    200,
  )

  const where: Record<string, unknown> = {}
  if (projectId) where.projectId = projectId
  if (periodId) where.reportingPeriodId = periodId
  if (moduleFilter) where.module = moduleFilter
  if (status) {
    if (status === 'SUBMITTED') {
      where.status = { in: ['SUBMITTED', 'RESUBMITTED'] }
    } else if (status === 'APPROVED') {
      where.status = { in: ['APPROVED', 'BU_APPROVED', 'SUBSIDIARY_APPROVED', 'HQ_REVIEW'] }
    } else {
      where.status = status
    }
  }

  try {
    const [submissions, total] = await Promise.all([
      db.submission.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take,
        include: {
          project: {
            select: {
              id: true,
              projectCode: true,
              projectName: true,
              location: true,
              status: true,
            },
          },
          reportingPeriod: {
            select: {
              id: true,
              periodLabel: true,
              year: true,
              month: true,
              status: true,
            },
          },
          currentReviewer: {
            select: { id: true, name: true, email: true },
          },
          history: {
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: {
              id: true,
              fromStatus: true,
              toStatus: true,
              action: true,
              actorId: true,
              actorName: true,
              actorRole: true,
              comment: true,
              createdAt: true,
            },
          },
          _count: { select: { corrections: true } },
        },
      }),
      db.submission.count({ where }),
    ])

    return NextResponse.json({
      user: { id: user.id, name: user.name, roles: user.roles },
      total,
      count: submissions.length,
      items: submissions,
    })
  } catch (e) {
    console.error('GET /api/submissions error', e)
    return NextResponse.json(
      { error: 'Failed to fetch submissions' },
      { status: 500 },
    )
  }
}

// POST /api/submissions — create a new DRAFT submission from a set of recordIds.
// Body: { projectId, reportingPeriodId, module, title?, recordIds: string[] }
export async function POST(req: NextRequest) {
  let user
  try {
    user = await requirePermission('submission.submit')
  } catch (e) {
    const code = authErrorToStatus(e)
    return NextResponse.json(
      { error: code === 403 ? 'Forbidden' : 'Unauthenticated' },
      { status: code ?? 500 },
    )
  }

  try {
    const body = await req.json()
    const projectId = String(body?.projectId || '').trim()
    const reportingPeriodId = String(body?.reportingPeriodId || '').trim()
    const moduleKey = String(body?.module || '').trim().toUpperCase()
    const titleRaw = body?.title ? String(body.title).trim() : ''
    const recordIdsIn: string[] = Array.isArray(body?.recordIds)
      ? body.recordIds.map((x: unknown) => String(x)).filter(Boolean)
      : []

    if (!projectId || !reportingPeriodId || !moduleKey) {
      return NextResponse.json(
        { error: 'projectId, reportingPeriodId and module are required' },
        { status: 400 },
      )
    }
    if (recordIdsIn.length === 0) {
      return NextResponse.json(
        { error: 'At least one recordId is required' },
        { status: 400 },
      )
    }
    const allowedModules = [
      'ENERGY',
      'WATER',
      'WASTE',
      'PEOPLE',
      'SAFETY',
      'TRAVEL',
      'EMISSIONS',
      'TRAINING',
      'COMPLIANCE',
      'INCIDENTS',
      'INITIATIVES',
      'LEVEL_1_ENERGY',
      'LEVEL_2_WATER',
      'LEVEL_3_GHG',
      'LEVEL_4_WASTE',
      'LEVEL_5_SAFETY',
      'LEVEL_6_TRAINING',
      'LEVEL_7_PERMITS',
      'LEVEL_5_PERMITS',
      'LEVEL_8_INCIDENTS',
      'LEVEL_9_INITIATIVES',
      'LEVEL_6_INITIATIVES',
    ]
    if (!allowedModules.includes(moduleKey)) {
      return NextResponse.json(
        { error: `Invalid module: ${moduleKey}` },
        { status: 400 },
      )
    }

    // Validate project & period exist
    const [project, period] = await Promise.all([
      db.project.findUnique({ where: { id: projectId }, select: { id: true, projectName: true, projectCode: true } }),
      db.reportingPeriod.findUnique({ where: { id: reportingPeriodId }, select: { id: true, periodLabel: true, year: true, month: true } }),
    ])
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    if (!period) {
      return NextResponse.json({ error: 'Reporting period not found' }, { status: 404 })
    }

    // Fetch source records to compute rollup
    const records = await fetchSourceRecords(recordIdsIn, moduleKey)
    if (records.length === 0) {
      return NextResponse.json(
        { error: 'No matching source records found for the given module' },
        { status: 400 },
      )
    }
    // Records must belong to the same project+period
    const foreignRecords = records.filter(
      (r) =>
        r.projectId !== projectId ||
        r.reportingPeriodId !== reportingPeriodId,
    )
    if (foreignRecords.length > 0) {
      return NextResponse.json(
        {
          error: 'All recordIds must belong to the same project + reporting period',
          invalid: foreignRecords.map((r) => r.id),
        },
        { status: 400 },
      )
    }

    const rollup = computeSubmissionRollup(records)
    const title =
      titleRaw ||
      `${project.projectName} — ${moduleKey} ${period.periodLabel}`

    // Check if an existing DRAFT submission exists for the same project + period + module
    const existingDraft = await db.submission.findFirst({
      where: {
        projectId,
        reportingPeriodId,
        module: moduleKey,
        status: 'DRAFT',
      },
      orderBy: { updatedAt: 'desc' },
    })

    let created
    if (existingDraft) {
      const mergedRecordIds = Array.from(new Set([...parseRecordIds(existingDraft.recordIds), ...records.map((r) => r.id)]))
      created = await db.submission.update({
        where: { id: existingDraft.id },
        data: {
          title,
          recordIds: JSON.stringify(mergedRecordIds),
          completionPct: rollup.completionPct,
          evidenceCount: rollup.evidenceCount,
          validationPassed: rollup.validationPassed,
          validationErrors: rollup.validationErrors,
          submittedBy: user.id,
        },
        include: {
          project: { select: { id: true, projectCode: true, projectName: true } },
          reportingPeriod: { select: { id: true, periodLabel: true, year: true } },
        },
      })
    } else {
      created = await db.submission.create({
        data: {
          projectId,
          reportingPeriodId,
          module: moduleKey,
          title,
          status: 'DRAFT',
          recordIds: JSON.stringify(records.map((r) => r.id)),
          completionPct: rollup.completionPct,
          evidenceCount: rollup.evidenceCount,
          validationPassed: rollup.validationPassed,
          validationErrors: rollup.validationErrors,
          submittedBy: user.id,
        },
        include: {
          project: { select: { id: true, projectCode: true, projectName: true } },
          reportingPeriod: { select: { id: true, periodLabel: true, year: true } },
        },
      })
    }

    await appendAudit({
      actorId: user.id,
      actorName: user.name,
      actorRole: primaryRoleLabel(user),
      action: 'CREATE',
      entityType: 'Submission',
      entityId: created.id,
      newState: {
        projectId,
        reportingPeriodId,
        module: moduleKey,
        title,
        recordIds: records.map((r) => r.id),
        rollup,
      },
      reason: 'Submission created in DRAFT state',
    })

    return NextResponse.json({ submission: created, rollup }, { status: 201 })
  } catch (e) {
    console.error('POST /api/submissions error', e)
    return NextResponse.json(
      { error: 'Failed to create submission' },
      { status: 500 },
    )
  }
}

// Local helper — wraps getCurrentUser and throws Error('UNAUTHENTICATED').
async function requireUserOrThrow() {
  const u = await getCurrentUser()
  if (!u) throw new Error('UNAUTHENTICATED')
  return u
}
