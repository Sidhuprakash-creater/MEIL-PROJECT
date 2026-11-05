import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/pu/db'
import { getCurrentUser, requirePermission } from '@/lib/pu/session'
import {
  appendAudit,
  authErrorToStatus,
  computeSubmissionRollup,
  fetchSourceRecords,
  parseJsonArray,
  parseRecordIds,
  submissionCompat,
  primaryRoleLabel,
} from '@/lib/pu/workflow'
import { moduleToCategory } from '@/lib/bridge/pu-link'
import { puSubmissionsCache, invalidatePuSubmissionsCache } from '@/lib/portal-cache'

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

  const bypass = searchParams.get('bypass') === 'true' || req.headers.get('x-bypass-cache') === 'true'
  const cacheKey = `${projectId || 'all'}:${periodId || 'all'}:${moduleFilter || 'all'}:${status || 'all'}`
  const cached = !bypass ? puSubmissionsCache.get(cacheKey) : null
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data)
  }

  const where: Record<string, unknown> = {}
  if (projectId) where.projectId = projectId
  if (periodId) where.reportingPeriodId = periodId
  if (moduleFilter) where.module = moduleFilter
  if (status) {
    if (status === 'SUBMITTED' || status === 'PENDING') {
      where.status = { in: ['SUBMITTED', 'RESUBMITTED', 'PENDING', 'UNDER_REVIEW'] }
    } else if (status === 'APPROVED' || status === 'ACTIVE') {
      where.status = { in: ['APPROVED', 'ACTIVE', 'BU_APPROVED', 'SUBSIDIARY_APPROVED', 'HQ_REVIEW'] }
    } else if (status === 'CORRECTION_REQUESTED' || status === 'CHANGES_REQUESTED' || status === 'REJECTED' || status === 'CORRECTION_REQUIRED') {
      where.status = { in: ['CORRECTION_REQUESTED', 'CHANGES_REQUESTED', 'REJECTED'] }
    } else {
      where.status = status
    }
  }

  try {
    const [rows, total] = await Promise.all([
      db.submission.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take,
        include: {
          project: {
            select: {
              id: true,
              code: true,
              name: true,
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
          reviewer: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      db.submission.count({ where }),
    ])

    // history + corrections live on JSON columns of the shared ledger —
    // parse and project them into the shape the consoles render.
    const submissions = rows.map((s) => {
      const history = parseJsonArray(s.history)
      const corrections = parseJsonArray(s.corrections)

      let parsedValues: Array<{ label: string; value: string | number; unit?: string }> = []
      try {
        if ((s as any).values) {
          const pv = JSON.parse((s as any).values)
          if (Array.isArray(pv)) parsedValues = pv
        }
      } catch {}

      let evidenceList: string[] = []
      try {
        if ((s as any).evidence) {
          const pe = JSON.parse((s as any).evidence)
          if (Array.isArray(pe)) evidenceList = pe.filter(Boolean)
        }
      } catch {}

      const subDate = s.submittedAt || s.createdAt
      const d = new Date(subDate)
      const datePart = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      const timePart = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })

      return {
        ...submissionCompat(s),
        history: history.slice(-5).reverse(),
        corrections,
        parsedValues,
        evidenceList,
        evidenceCount: evidenceList.length || s.evidenceCount || 0,
        formattedDateTime: `${datePart} • ${timePart}`,
        reviewComment: s.reviewComment || null,
        reviewedAt: s.reviewedAt || null,
        _count: { corrections: corrections.length },
      }
    })

    const resultPayload = {
      user: { id: user.id, name: user.name, roles: user.roles },
      total,
      count: submissions.length,
      items: submissions,
    }
    puSubmissionsCache.set(cacheKey, { data: resultPayload, expiresAt: Date.now() + 25000 })
    return NextResponse.json(resultPayload)
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
      db.project.findUnique({ where: { id: projectId }, select: { id: true, name: true, code: true } }),
      db.reportingPeriod.findUnique({ where: { id: reportingPeriodId }, select: { id: true, periodLabel: true, year: true, month: true, submissionDeadline: true } }),
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
      `${project.name} — ${moduleKey} ${period.periodLabel}`

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

    /* Optional single-round-trip submit: `submitNow: true` creates/updates the
       submission directly in SUBMITTED state (saves a second /submit call). */
    const submitNow = (body as any)?.submitNow === true
    const finalStatus = submitNow ? 'SUBMITTED' : 'DRAFT'

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
          submittedById: user.id,
          ...(submitNow
            ? {
                status: finalStatus,
                submittedAt: new Date(),
                reviewStatus: 'PENDING_REVIEW',
              }
            : {}),
        },
        include: {
          project: { select: { id: true, code: true, name: true } },
          reportingPeriod: { select: { id: true, periodLabel: true, year: true } },
        },
      })
    } else {
      created = await db.submission.create({
        data: {
          projectId,
          reportingPeriodId,
          module: moduleKey,
          category: moduleToCategory(moduleKey),
          title,
          status: finalStatus,
          ...(submitNow ? { submittedAt: new Date(), reviewStatus: 'PENDING_REVIEW' as const } : {}),
          recordIds: JSON.stringify(records.map((r) => r.id)),
          ref: `PU-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
          dueDate: period.submissionDeadline ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          completionPct: rollup.completionPct,
          evidenceCount: rollup.evidenceCount,
          validationPassed: rollup.validationPassed,
          validationErrors: rollup.validationErrors,
          submittedById: user.id,
        },
        include: {
          project: { select: { id: true, code: true, name: true } },
          reportingPeriod: { select: { id: true, periodLabel: true, year: true } },
        },
      })
    }

    await appendAudit({
      actorId: user.id,
      actorName: user.name,
      actorRole: primaryRoleLabel(user),
      action: submitNow ? 'SUBMIT' : 'CREATE',
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
      reason: submitNow ? 'Submitted for review from Data Entry (single round-trip)' : 'Submission created in DRAFT state',
    })

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

    invalidatePuSubmissionsCache()
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
