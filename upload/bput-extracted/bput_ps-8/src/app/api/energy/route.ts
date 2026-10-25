import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, requirePermission } from '@/lib/session'
import {
  apiError,
  computeEmissions,
  findEmissionFactorForSource,
  normalizeEnergyToGJ,
  rollupValidationStatus,
  type ValidationIssue,
} from '@/lib/engines'

export const runtime = 'nodejs'

const RECORD_TYPE = 'ENERGY'

// ---------------------------------------------------------------------------
// GET /api/energy?projectId=&periodId=
// List energy records with relations + filters.
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId') || undefined
    const periodId = searchParams.get('periodId') || undefined

    const records = await db.energyRecord.findMany({
      where: {
        ...(projectId ? { projectId } : {}),
        ...(periodId ? { reportingPeriodId: periodId } : {}),
      },
      orderBy: { enteredAt: 'desc' },
      include: {
        project: { select: { id: true, projectCode: true, projectName: true } },
        reportingPeriod: { select: { id: true, periodLabel: true, status: true } },
        calculationResults: true,
        validationResults: { where: { status: 'OPEN' } },
      },
    })
    return NextResponse.json({ records, count: records.length })
  } catch (e: any) {
    return apiError(e)
  }
}

// ---------------------------------------------------------------------------
// POST /api/energy
// Create an energy record, run validation, run deterministic calculation,
// persist all results + audit log atomically.
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission('esg.energy.write')
    const body = await req.json()
    const {
      projectId,
      reportingPeriodId,
      source,
      sourceCategory,
      quantity,
      sourceUnit,
      vendor,
      meterRef,
      evidenceId,
    } = body || {}

    // ---- 1. Required-field validation ----
    const issues: ValidationIssue[] = []
    const missing: string[] = []
    if (!projectId) missing.push('projectId')
    if (!reportingPeriodId) missing.push('reportingPeriodId')
    if (!source) missing.push('source')
    if (!sourceCategory) missing.push('sourceCategory')
    if (quantity === undefined || quantity === null) missing.push('quantity')
    if (!sourceUnit) missing.push('sourceUnit')
    if (missing.length > 0) {
      throw { message: 'VALIDATION_ERROR', payload: { error: `Missing required fields: ${missing.join(', ')}` } }
    }

    const qty = Number(quantity)
    if (!Number.isFinite(qty) || qty <= 0) {
      issues.push({
        ruleCode: 'ENG-QTY-POSITIVE',
        severity: 'ERROR',
        message: `Quantity must be > 0 (received ${quantity})`,
        field: 'quantity',
        suggestedAction: 'Enter the metered consumption value for the reporting period.',
      })
    }

    // ---- 2. Referential integrity checks ----
    const project = await db.project.findUnique({ where: { id: projectId } })
    if (!project) {
      throw { message: 'VALIDATION_ERROR', payload: { error: `Project not found: ${projectId}` } }
    }
    const period = await db.reportingPeriod.findUnique({ where: { id: reportingPeriodId } })
    if (!period) {
      throw { message: 'VALIDATION_ERROR', payload: { error: `Reporting period not found: ${reportingPeriodId}` } }
    }

    // ---- 3. Duplicate meterRef check (scoped to project+period) ----
    if (meterRef) {
      const dup = await db.energyRecord.findFirst({
        where: { projectId, meterRef, NOT: { id: 'none' } },
        select: { id: true },
      })
      if (dup) {
        issues.push({
          ruleCode: 'ENG-METER-DUP',
          severity: 'ERROR',
          message: `Duplicate meterRef '${meterRef}' already exists for this project`,
          field: 'meterRef',
          suggestedAction: 'Either update the existing record or assign a unique meter reference.',
        })
      }
    }

    // ---- 4. Valid unit check ----
    const knownUnits = ['KWH', 'MWH', 'GJ', 'L', 'KL', 'M3', 'KG', 'TON', 'T']
    if (!knownUnits.includes(String(sourceUnit).toUpperCase())) {
      issues.push({
        ruleCode: 'ENG-UNIT-UNKNOWN',
        severity: 'WARNING',
        message: `Unit '${sourceUnit}' is not in the standard UnitMaster catalogue`,
        field: 'sourceUnit',
        suggestedAction: 'Use a standard unit (KWH, MWH, GJ, L, KL, M3, KG, TON).',
      })
    }

    // ---- 5. Normalize to GJ ----
    const norm = await normalizeEnergyToGJ(qty, sourceUnit, source)

    // ---- 6. Find emission factor + compute ----
    const factor = await findEmissionFactorForSource(source)
    let calcPayload: any = null
    if (factor) {
      const c = computeEmissions(qty, factor)
      calcPayload = { ...c, sourceValue: qty, sourceUnit, normalizedValue: norm.normalizedValue, normalizedUnit: norm.normalizedUnit }
    } else {
      issues.push({
        ruleCode: 'ENG-FACTOR-MISSING',
        severity: 'WARNING',
        message: `No emission factor matched source '${source}'; emissions calculation skipped`,
        field: 'source',
        suggestedAction: 'Map this source to a known EmissionFactor row or add a new factor.',
      })
    }

    // ---- 7. Roll up status ----
    const { validationStatus, calculationStatus } = rollupValidationStatus(issues)

    // ---- 8. Persist (record + calc + validations + audit) atomically ----
    const created = await db.$transaction(async (tx) => {
      const record = await tx.energyRecord.create({
        data: {
          projectId,
          reportingPeriodId,
          module: RECORD_TYPE,
          source,
          sourceCategory,
          quantity: qty,
          sourceUnit,
          normalizedValue: norm.normalizedValue,
          normalizedUnit: norm.normalizedUnit,
          vendor: vendor ?? null,
          meterRef: meterRef ?? null,
          evidenceId: evidenceId ?? null,
          validationStatus,
          calculationStatus: calcPayload ? calculationStatus : 'PENDING',
          status: 'DRAFT',
          enteredBy: user.id,
        },
      })

      if (calcPayload) {
        await tx.calculationResult.create({
          data: {
            recordType: RECORD_TYPE,
            recordId: record.id,
            energyRecordId: record.id,
            factorId: calcPayload.factorId,
            factorVersion: calcPayload.factorVersion,
            sourceValue: calcPayload.sourceValue,
            sourceUnit: calcPayload.sourceUnit,
            normalizedValue: calcPayload.normalizedValue,
            normalizedUnit: calcPayload.normalizedUnit,
            calculatedValue: calcPayload.calculatedValue,
            resultUnit: calcPayload.resultUnit,
            scope: calcPayload.scope,
            methodologyNote: calcPayload.methodologyNote,
          },
        })
      }

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
          entityType: 'EnergyRecord',
          entityId: record.id,
          newState: JSON.stringify({ source, quantity: qty, sourceUnit, meterRef, validationStatus, calculationStatus }),
          reason: 'Energy record created via API',
        },
      })

      return record
    })

    // ---- 9. Re-fetch with relations ----
    const full = await db.energyRecord.findUnique({
      where: { id: created.id },
      include: {
        project: { select: { id: true, projectCode: true, projectName: true } },
        reportingPeriod: { select: { id: true, periodLabel: true, status: true } },
        calculationResults: true,
        validationResults: true,
      },
    })

    return NextResponse.json({ record: full, issues, calculation: calcPayload }, { status: 201 })
  } catch (e: any) {
    return apiError(e)
  }
}
