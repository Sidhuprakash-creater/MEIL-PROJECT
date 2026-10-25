import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, requirePermission } from '@/lib/session'
import { apiError, rollupValidationStatus, type ValidationIssue } from '@/lib/engines'

export const runtime = 'nodejs'

const RECORD_TYPE = 'SAFETY'

// LTIFR (Lost Time Injury Frequency Rate) = (lost time incidents × 1,000,000) / man-hours worked.
// This is the standard ISO 45001 / OSHA-derived formula — never aggregated; always recomputed.
const LTIFR_COEFFICIENT = 1_000_000

function computeLtifr(lti: number, manHours: number | null): number | null {
  if (!manHours || manHours <= 0) return null
  return Math.round(((lti * LTIFR_COEFFICIENT) / manHours) * 1000) / 1000
}

// ---------------------------------------------------------------------------
// GET /api/safety?projectId=&periodId=
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId') || undefined
    const periodId = searchParams.get('periodId') || undefined

    const records = await db.safetyRecord.findMany({
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

    // Re-derive LTIFR per record (deterministic; not stored on the model)
    const withDerived = records.map(r => ({
      ...r,
      derivedLtifr: computeLtifr(r.lostTimeIncidents, r.manHoursWorked ?? null),
    }))

    return NextResponse.json({ records: withDerived, count: withDerived.length })
  } catch (e: any) {
    return apiError(e)
  }
}

// ---------------------------------------------------------------------------
// POST /api/safety
// Validation: non-negative counts; recordType valid; if fatalities>0 then LTI>=0.
// Compute LTIFR if manHoursWorked present.
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission('esg.safety.write')
    const body = await req.json()
    const {
      projectId,
      reportingPeriodId,
      recordType,
      fatalities,
      injuries,
      lostTimeIncidents,
      recordableInjuries,
      highConsequenceIncidents,
      trainingHours,
      safetyHours,
      manHoursWorked,
      correctiveActions,
      evidenceId,
    } = body || {}

    const missing: string[] = []
    if (!projectId) missing.push('projectId')
    if (!reportingPeriodId) missing.push('reportingPeriodId')
    if (!recordType) missing.push('recordType')
    if (missing.length > 0) {
      throw { message: 'VALIDATION_ERROR', payload: { error: `Missing required fields: ${missing.join(', ')}` } }
    }

    const validTypes = ['INCIDENT', 'INJURY', 'FATALITY', 'LTI', 'RECORDABLE', 'TRAINING', 'ASSESSMENT']
    const fat = Number(fatalities ?? 0)
    const inj = Number(injuries ?? 0)
    const lti = Number(lostTimeIncidents ?? 0)
    const recInj = Number(recordableInjuries ?? 0)
    const hci = Number(highConsequenceIncidents ?? 0)
    const th = trainingHours !== undefined && trainingHours !== null ? Number(trainingHours) : null
    const sh = safetyHours !== undefined && safetyHours !== null ? Number(safetyHours) : null
    const mhw = manHoursWorked !== undefined && manHoursWorked !== null ? Number(manHoursWorked) : null

    const issues: ValidationIssue[] = []
    if (!validTypes.includes(String(recordType))) {
      issues.push({
        ruleCode: 'SFT-RECORDTYPE-VALID',
        severity: 'ERROR',
        message: `recordType must be one of ${validTypes.join(', ')} (received ${recordType})`,
        field: 'recordType',
      })
    }
    if ([fat, inj, lti, recInj, hci].some(n => n < 0)) {
      issues.push({
        ruleCode: 'SFT-NONNEG',
        severity: 'ERROR',
        message: 'All incident/injury counts must be >= 0',
        field: 'fatalities',
      })
    }
    if (fat > 0 && lti === 0) {
      issues.push({
        ruleCode: 'SFT-FATALITY-IMPLIES-LTI',
        severity: 'WARNING',
        message: 'A fatality was recorded but lostTimeIncidents = 0',
        field: 'lostTimeIncidents',
        suggestedAction: 'Confirm whether the fatality resulted in lost time.',
      })
    }
    if (mhw !== null && mhw <= 0) {
      issues.push({
        ruleCode: 'SFT-MANHOURS-POSITIVE',
        severity: 'WARNING',
        message: `manHoursWorked should be > 0 to compute LTIFR (received ${mhw})`,
        field: 'manHoursWorked',
      })
    }

    const project = await db.project.findUnique({ where: { id: projectId } })
    if (!project) throw { message: 'VALIDATION_ERROR', payload: { error: `Project not found: ${projectId}` } }
    const period = await db.reportingPeriod.findUnique({ where: { id: reportingPeriodId } })
    if (!period) throw { message: 'VALIDATION_ERROR', payload: { error: `Reporting period not found: ${reportingPeriodId}` } }

    const { validationStatus } = rollupValidationStatus(issues)
    const derivedLtifr = computeLtifr(lti, mhw)

    const created = await db.$transaction(async (tx) => {
      const record = await tx.safetyRecord.create({
        data: {
          projectId,
          reportingPeriodId,
          module: RECORD_TYPE,
          recordType,
          fatalities: fat,
          injuries: inj,
          lostTimeIncidents: lti,
          recordableInjuries: recInj,
          highConsequenceIncidents: hci,
          trainingHours: th,
          safetyHours: sh,
          manHoursWorked: mhw,
          correctiveActions: correctiveActions ?? null,
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
          entityType: 'SafetyRecord',
          entityId: record.id,
          newState: JSON.stringify({ recordType, fatalities: fat, injuries: inj, lostTimeIncidents: lti, manHoursWorked: mhw, derivedLtifr, validationStatus }),
          reason: 'Safety record created via API',
        },
      })

      return record
    })

    const full = await db.safetyRecord.findUnique({
      where: { id: created.id },
      include: {
        project: { select: { id: true, projectCode: true, projectName: true } },
        reportingPeriod: { select: { id: true, periodLabel: true, status: true } },
        validationResults: true,
      },
    })

    return NextResponse.json({ record: full, issues, derivedLtifr }, { status: 201 })
  } catch (e: any) {
    return apiError(e)
  }
}
