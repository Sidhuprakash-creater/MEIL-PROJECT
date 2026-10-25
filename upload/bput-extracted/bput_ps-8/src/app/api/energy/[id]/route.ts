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
// GET /api/energy/[id] — single record with full relations
// ---------------------------------------------------------------------------
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

    const { id } = await ctx.params
    const record = await db.energyRecord.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, projectCode: true, projectName: true } },
        reportingPeriod: { select: { id: true, periodLabel: true, status: true } },
        calculationResults: true,
        validationResults: true,
      },
    })
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ record })
  } catch (e: any) {
    return apiError(e)
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/energy/[id] — update fields, recompute normalization & emissions,
// bump revisionNumber, write UPDATE audit log.
// ---------------------------------------------------------------------------
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('esg.energy.write')
    const { id } = await ctx.params
    const body = await req.json()

    const existing = await db.energyRecord.findUnique({ where: { id }, include: { calculationResults: true } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Determine effective field values (override only what's provided)
    const source = body.source ?? existing.source
    const sourceCategory = body.sourceCategory ?? existing.sourceCategory
    const quantity = body.quantity !== undefined ? Number(body.quantity) : existing.quantity
    const sourceUnit = body.sourceUnit ?? existing.sourceUnit

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw { message: 'VALIDATION_ERROR', payload: { error: `Quantity must be > 0` } }
    }

    // Re-run validation checks
    const issues: ValidationIssue[] = []
    const knownUnits = ['KWH', 'MWH', 'GJ', 'L', 'KL', 'M3', 'KG', 'TON', 'T']
    if (!knownUnits.includes(String(sourceUnit).toUpperCase())) {
      issues.push({
        ruleCode: 'ENG-UNIT-UNKNOWN',
        severity: 'WARNING',
        message: `Unit '${sourceUnit}' is not in the standard UnitMaster catalogue`,
        field: 'sourceUnit',
      })
    }

    // Re-normalize & re-compute
    const norm = await normalizeEnergyToGJ(quantity, sourceUnit, source)
    const factor = await findEmissionFactorForSource(source)
    let calcPayload: any = null
    if (factor) {
      const c = computeEmissions(quantity, factor)
      calcPayload = { ...c, sourceValue: quantity, sourceUnit, normalizedValue: norm.normalizedValue, normalizedUnit: norm.normalizedUnit }
    } else {
      issues.push({
        ruleCode: 'ENG-FACTOR-MISSING',
        severity: 'WARNING',
        message: `No emission factor matched source '${source}'; emissions calculation skipped`,
        field: 'source',
      })
    }

    const { validationStatus, calculationStatus } = rollupValidationStatus(issues)

    const updated = await db.$transaction(async (tx) => {
      const record = await tx.energyRecord.update({
        where: { id },
        data: {
          source,
          sourceCategory,
          quantity,
          sourceUnit,
          normalizedValue: norm.normalizedValue,
          normalizedUnit: norm.normalizedUnit,
          vendor: body.vendor !== undefined ? body.vendor : existing.vendor,
          meterRef: body.meterRef !== undefined ? body.meterRef : existing.meterRef,
          evidenceId: body.evidenceId !== undefined ? body.evidenceId : existing.evidenceId,
          updatedBy: user.id,
          validationStatus,
          calculationStatus: calcPayload ? calculationStatus : 'PENDING',
          revisionNumber: existing.revisionNumber + 1,
        },
      })

      // Upsert calculation result — delete old, create new (deterministic)
      if (existing.calculationResults.length > 0) {
        await tx.calculationResult.deleteMany({ where: { energyRecordId: id } })
      }
      if (calcPayload) {
        await tx.calculationResult.create({
          data: {
            recordType: RECORD_TYPE,
            recordId: id,
            energyRecordId: id,
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

      // Reset OPEN validations on this record, then re-persist fresh issues
      await tx.validationResult.deleteMany({ where: { recordId: id, recordType: RECORD_TYPE, status: 'OPEN' } })
      if (issues.length > 0) {
        await Promise.all(
          issues.map(i =>
            tx.validationResult.create({
              data: {
                ruleCode: i.ruleCode,
                recordId: id,
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
          action: 'UPDATE',
          entityType: 'EnergyRecord',
          entityId: id,
          oldState: JSON.stringify({ quantity: existing.quantity, source: existing.source, validationStatus: existing.validationStatus, revisionNumber: existing.revisionNumber }),
          newState: JSON.stringify({ quantity, source, validationStatus, calculationStatus, revisionNumber: existing.revisionNumber + 1 }),
          reason: 'Energy record updated; calculation re-run',
        },
      })

      return record
    })

    const full = await db.energyRecord.findUnique({
      where: { id: updated.id },
      include: {
        project: { select: { id: true, projectCode: true, projectName: true } },
        reportingPeriod: { select: { id: true, periodLabel: true, status: true } },
        calculationResults: true,
        validationResults: true,
      },
    })

    return NextResponse.json({ record: full, issues, calculation: calcPayload })
  } catch (e: any) {
    return apiError(e)
  }
}


