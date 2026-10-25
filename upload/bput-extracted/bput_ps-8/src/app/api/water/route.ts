import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, requirePermission } from '@/lib/session'
import { apiError, rollupValidationStatus, type ValidationIssue } from '@/lib/engines'

export const runtime = 'nodejs'

const RECORD_TYPE = 'WATER'

// ---------------------------------------------------------------------------
// GET /api/water?projectId=&periodId=
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId') || undefined
    const periodId = searchParams.get('periodId') || undefined

    const records = await db.waterRecord.findMany({
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
// POST /api/water
// Validation rules: withdrawal > 0; recycled <= withdrawal; consumption <= withdrawal.
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission('esg.water.write')
    const body = await req.json()
    const {
      projectId,
      reportingPeriodId,
      source,
      withdrawal,
      consumption,
      discharge,
      recycledReused,
      treatment,
      destination,
      sourceUnit,
      waterStress,
      zldActive,
      evidenceId,
    } = body || {}

    // Required-field checks
    const missing: string[] = []
    if (!projectId) missing.push('projectId')
    if (!reportingPeriodId) missing.push('reportingPeriodId')
    if (!source) missing.push('source')
    if (withdrawal === undefined || withdrawal === null) missing.push('withdrawal')
    if (!sourceUnit) missing.push('sourceUnit')
    if (missing.length > 0) {
      throw { message: 'VALIDATION_ERROR', payload: { error: `Missing required fields: ${missing.join(', ')}` } }
    }

    const w = Number(withdrawal)
    const c = consumption !== undefined && consumption !== null ? Number(consumption) : null
    const d = discharge !== undefined && discharge !== null ? Number(discharge) : null
    const r = recycledReused !== undefined && recycledReused !== null ? Number(recycledReused) : 0

    const issues: ValidationIssue[] = []
    if (!Number.isFinite(w) || w <= 0) {
      issues.push({
        ruleCode: 'WTR-WITHDRAWAL-POSITIVE',
        severity: 'ERROR',
        message: `Withdrawal must be > 0 (received ${withdrawal})`,
        field: 'withdrawal',
      })
    }
    if (r > w) {
      issues.push({
        ruleCode: 'WTR-RECYCLE-LE-WITHDRAWAL',
        severity: 'ERROR',
        message: `Recycled/reused (${r}) cannot exceed withdrawal (${w})`,
        field: 'recycledReused',
        suggestedAction: 'Verify STP throughput vs intake meter reading.',
      })
    }
    if (c !== null && c > w) {
      issues.push({
        ruleCode: 'WTR-CONSUMPTION-LE-WITHDRAWAL',
        severity: 'ERROR',
        message: `Consumption (${c}) cannot exceed withdrawal (${w})`,
        field: 'consumption',
      })
    }
    if (d !== null && d > w) {
      issues.push({
        ruleCode: 'WTR-DISCHARGE-LE-WITHDRAWAL',
        severity: 'ERROR',
        message: `Discharge (${d}) cannot exceed withdrawal (${w})`,
        field: 'discharge',
      })
    }
    if (waterStress === true && r === 0) {
      issues.push({
        ruleCode: 'WTR-STRESS-RECYCLE',
        severity: 'WARNING',
        message: 'Site flagged as water-stressed but no recycling reported',
        field: 'waterStress',
        suggestedAction: 'Consider STP / rainwater harvesting to lower intake.',
      })
    }

    // Referential integrity
    const project = await db.project.findUnique({ where: { id: projectId } })
    if (!project) throw { message: 'VALIDATION_ERROR', payload: { error: `Project not found: ${projectId}` } }
    const period = await db.reportingPeriod.findUnique({ where: { id: reportingPeriodId } })
    if (!period) throw { message: 'VALIDATION_ERROR', payload: { error: `Reporting period not found: ${reportingPeriodId}` } }

    const { validationStatus } = rollupValidationStatus(issues)

    const created = await db.$transaction(async (tx) => {
      const record = await tx.waterRecord.create({
        data: {
          projectId,
          reportingPeriodId,
          module: RECORD_TYPE,
          source,
          withdrawal: w,
          consumption: c,
          discharge: d,
          recycledReused: r,
          treatment: treatment ?? null,
          destination: destination ?? null,
          sourceUnit,
          waterStress: Boolean(waterStress),
          zldActive: Boolean(zldActive),
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
          entityType: 'WaterRecord',
          entityId: record.id,
          newState: JSON.stringify({ source, withdrawal: w, recycledReused: r, validationStatus }),
          reason: 'Water record created via API',
        },
      })

      return record
    })

    const full = await db.waterRecord.findUnique({
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
