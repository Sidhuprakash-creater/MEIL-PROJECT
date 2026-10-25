import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, userHasPermission } from '@/lib/session'
import {
  apiError,
  computeEmissions,
  findEmissionFactorForSource,
  normalizeEnergyToGJ,
} from '@/lib/engines'

export const runtime = 'nodejs'

const WRITER_KEYS = ['esg.energy.write', 'esg.water.write', 'esg.waste.write', 'esg.people.write', 'esg.safety.write', 'esg.travel.write']

/**
 * POST /api/calculation/run
 * Body: { recordType: 'ENERGY'|'WATER'|'WASTE'|'PEOPLE'|'SAFETY', recordId: '...' }
 *
 * Re-runs the deterministic calculation using the stored factor version
 * (deterministic: same input + same factor version => same result).
 * Upserts the CalculationResult row(s) for the target record.
 *
 * Allowed if user has any 'esg.*.write' permission.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

    const hasAny = await Promise.all(WRITER_KEYS.map(k => userHasPermission(user.id, k)))
    if (!hasAny.some(Boolean)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { recordType, recordId } = body || {}
    if (!recordType || !recordId) {
      return NextResponse.json({ error: 'recordType and recordId are required' }, { status: 400 })
    }

    // -----------------------------------------------------------------------
    // ENERGY — recompute emissions via the stored factor version
    // -----------------------------------------------------------------------
    if (recordType === 'ENERGY') {
      const record = await db.energyRecord.findUnique({ where: { id: recordId }, include: { calculationResults: true } })
      if (!record) return NextResponse.json({ error: 'Energy record not found' }, { status: 404 })

      const factor = await findEmissionFactorForSource(record.source)
      if (!factor) {
        return NextResponse.json({
          recordType,
          recordId,
          status: 'NO_FACTOR',
          note: `No emission factor matched source '${record.source}'`,
        })
      }

      // Deterministic: same quantity + same factor version => same calculatedValue
      const calc = computeEmissions(record.quantity, factor)
      const norm = await normalizeEnergyToGJ(record.quantity, record.sourceUnit, record.source)

      // Upsert: delete any prior calculation results, write the fresh deterministic one
      await db.$transaction(async (tx) => {
        if (record.calculationResults.length > 0) {
          await tx.calculationResult.deleteMany({ where: { energyRecordId: record.id } })
        }
        await tx.calculationResult.create({
          data: {
            recordType: 'ENERGY',
            recordId: record.id,
            energyRecordId: record.id,
            factorId: calc.factorId,
            factorVersion: calc.factorVersion,
            sourceValue: record.quantity,
            sourceUnit: record.sourceUnit,
            normalizedValue: norm.normalizedValue,
            normalizedUnit: norm.normalizedUnit,
            calculatedValue: calc.calculatedValue,
            resultUnit: calc.resultUnit,
            scope: calc.scope,
            methodologyNote: calc.methodologyNote,
          },
        })
        await tx.energyRecord.update({
          where: { id: record.id },
          data: {
            normalizedValue: norm.normalizedValue,
            normalizedUnit: norm.normalizedUnit,
            calculationStatus: 'COMPLETED',
          },
        })
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            actorName: user.name,
            actorRole: user.roles.map(r => r.name).join(', ') || 'User',
            action: 'CALCULATION',
            entityType: 'EnergyRecord',
            entityId: record.id,
            newState: JSON.stringify({ calculatedValue: calc.calculatedValue, resultUnit: calc.resultUnit, scope: calc.scope, factorVersion: calc.factorVersion }),
            reason: 'Deterministic re-calculation',
          },
        })
      })

      return NextResponse.json({
        recordType,
        recordId,
        status: 'COMPLETED',
        calculation: {
          calculatedValue: calc.calculatedValue,
          resultUnit: calc.resultUnit,
          scope: calc.scope,
          factorId: calc.factorId,
          factorVersion: calc.factorVersion,
          methodologyNote: calc.methodologyNote,
          normalizedValue: norm.normalizedValue,
          normalizedUnit: norm.normalizedUnit,
        },
        deterministic: true,
      })
    }

    // -----------------------------------------------------------------------
    // Non-energy record types — no emissions calculation applies
    // -----------------------------------------------------------------------
    if (recordType === 'WATER' || recordType === 'WASTE' || recordType === 'PEOPLE' || recordType === 'SAFETY') {
      return NextResponse.json({
        recordType,
        recordId,
        status: 'NOT_APPLICABLE',
        note: 'No emissions calculation applies for this record type. Module-level KPIs are derived at consolidation time.',
      })
    }

    return NextResponse.json({ error: `Unsupported recordType '${recordType}'` }, { status: 400 })
  } catch (e: any) {
    return apiError(e)
  }
}
