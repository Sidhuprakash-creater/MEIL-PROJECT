import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, requirePermission } from '@/lib/session'
import { apiError, rollupValidationStatus, type ValidationIssue } from '@/lib/engines'

export const runtime = 'nodejs'

const RECORD_TYPE = 'PEOPLE'

// ---------------------------------------------------------------------------
// GET /api/workforce?projectId=&periodId=
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId') || undefined
    const periodId = searchParams.get('periodId') || undefined

    const records = await db.workforceRecord.findMany({
      where: {
        ...(projectId ? { projectId } : {}),
        ...(periodId ? { reportingPeriodId: periodId } : {}),
      },
      orderBy: { enteredAt: 'desc' },
      include: {
        project: { select: { id: true, projectCode: true, projectName: true } },
        reportingPeriod: { select: { id: true, periodLabel: true, status: true } },
        validationResults: { where: { status: 'OPEN' } },
      },
    })
    return NextResponse.json({ records, count: records.length })
  } catch (e: any) {
    return apiError(e)
  }
}

// ---------------------------------------------------------------------------
// POST /api/workforce
// Validation: gender total = permanent + nonPermanent; newHires >= exits*0 (info); totals non-negative
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission('esg.people.write')
    const body = await req.json()
    const {
      projectId,
      reportingPeriodId,
      category,
      permanent,
      nonPermanent,
      male,
      female,
      other,
      differentlyAbled,
      newHires,
      exits,
      trainingHours,
      evidenceId,
    } = body || {}

    const missing: string[] = []
    if (!projectId) missing.push('projectId')
    if (!reportingPeriodId) missing.push('reportingPeriodId')
    if (!category) missing.push('category')
    if (permanent === undefined || permanent === null) missing.push('permanent')
    if (nonPermanent === undefined || nonPermanent === null) missing.push('nonPermanent')
    if (male === undefined || male === null) missing.push('male')
    if (female === undefined || female === null) missing.push('female')
    if (missing.length > 0) {
      throw { message: 'VALIDATION_ERROR', payload: { error: `Missing required fields: ${missing.join(', ')}` } }
    }

    const perm = Number(permanent)
    const nonPerm = Number(nonPermanent)
    const m = Number(male)
    const f = Number(female)
    const o = other !== undefined && other !== null ? Number(other) : 0
    const total = perm + nonPerm
    const genderTotal = m + f + o

    const issues: ValidationIssue[] = []
    if (!['EMPLOYEE', 'WORKER'].includes(String(category))) {
      issues.push({
        ruleCode: 'PPL-CATEGORY-VALID',
        severity: 'ERROR',
        message: `Category must be EMPLOYEE or WORKER (received ${category})`,
        field: 'category',
      })
    }
    if (perm < 0 || nonPerm < 0 || m < 0 || f < 0 || o < 0) {
      issues.push({
        ruleCode: 'PPL-NONNEG',
        severity: 'ERROR',
        message: 'All workforce counts must be >= 0',
        field: 'permanent',
      })
    }
    if (genderTotal !== total) {
      issues.push({
        ruleCode: 'PPL-GENDER-TOTAL',
        severity: 'ERROR',
        message: `Gender total (${genderTotal} = ${m}M+${f}F+${o}O) does not match workforce total (${total} = ${perm}P+${nonPerm}NP)`,
        field: 'female',
        suggestedAction: 'Reconcile headcount register with HRIS gender split.',
      })
    }
    const nh = newHires !== undefined && newHires !== null ? Number(newHires) : 0
    const ex = exits !== undefined && exits !== null ? Number(exits) : 0
    if (nh > total) {
      issues.push({
        ruleCode: 'PPL-HIRES-LE-TOTAL',
        severity: 'WARNING',
        message: `New hires (${nh}) exceed total workforce (${total})`,
        field: 'newHires',
      })
    }
    if (ex > total) {
      issues.push({
        ruleCode: 'PPL-EXITS-LE-TOTAL',
        severity: 'WARNING',
        message: `Exits (${ex}) exceed total workforce (${total})`,
        field: 'exits',
      })
    }

    const project = await db.project.findUnique({ where: { id: projectId } })
    if (!project) throw { message: 'VALIDATION_ERROR', payload: { error: `Project not found: ${projectId}` } }
    const period = await db.reportingPeriod.findUnique({ where: { id: reportingPeriodId } })
    if (!period) throw { message: 'VALIDATION_ERROR', payload: { error: `Reporting period not found: ${reportingPeriodId}` } }

    const { validationStatus } = rollupValidationStatus(issues)

    const created = await db.$transaction(async (tx) => {
      const record = await tx.workforceRecord.create({
        data: {
          projectId,
          reportingPeriodId,
          module: RECORD_TYPE,
          category,
          permanent: perm,
          nonPermanent: nonPerm,
          male: m,
          female: f,
          other: o,
          differentlyAbled: differentlyAbled ?? null,
          newHires: nh,
          exits: ex,
          trainingHours: trainingHours !== undefined && trainingHours !== null ? Number(trainingHours) : null,
          evidenceId: evidenceId ?? null,
          validationStatus,
          status: 'DRAFT',
          enteredBy: user.id,
        },
      })

      if (issues.length > 0) {
        await Promise.all(
          issues.map(i =>
            tx.validationResult.create({
              data: {
                ruleCode: i.ruleCode,
                recordId: record.id,
                recordType: RECORD_TYPE,
                severity: i.severity,
                message: i.message,
                field: i.field ?? null,
                suggestedAction: i.suggestedAction ?? null,
                status: 'OPEN',
              },
            }),
          ),
        )
      }

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          actorName: user.name,
          actorRole: user.roles.map(r => r.name).join(', ') || 'User',
          action: 'CREATE',
          entityType: 'WorkforceRecord',
          entityId: record.id,
          newState: JSON.stringify({ category, permanent: perm, nonPermanent: nonPerm, male: m, female: f, validationStatus }),
          reason: 'Workforce record created via API',
        },
      })

      return record
    })

    const full = await db.workforceRecord.findUnique({
      where: { id: created.id },
      include: {
        project: { select: { id: true, projectCode: true, projectName: true } },
        reportingPeriod: { select: { id: true, periodLabel: true, status: true } },
        validationResults: true,
      },
    })

    return NextResponse.json({ record: full, issues }, { status: 201 })
  } catch (e: any) {
    return apiError(e)
  }
}
