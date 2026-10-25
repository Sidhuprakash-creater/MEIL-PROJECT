import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { apiError, CONSOLIDATION_STATUSES, resolveProjectIdsForLevel } from '@/lib/engines'

export const runtime = 'nodejs'

const LTIFR_COEFFICIENT = 1_000_000

function round(n: number, dp = 2): number {
  const f = Math.pow(10, dp)
  return Math.round(n * f) / f
}

/**
 * GET /api/consolidation/[level]?id=
 *
 * Consolidation engine — sums APPROVED/LOCKED source records' raw values
 * (and their deterministic CalculationResults) for the requested scope.
 * Never double-counts: only raw per-record numbers are summed, never any
 * pre-aggregated KPI row.
 *
 * Levels:
 *   project    — single project (id required)
 *   bu         — all projects in a BusinessUnit (id required)
 *   subsidiary — all projects across all BUs of a Subsidiary (id required)
 *   group      — all projects across the entire Group (id optional, defaults to first group)
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ level: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

    const { level } = await ctx.params
    if (!['project', 'bu', 'subsidiary', 'group'].includes(level)) {
      return NextResponse.json({ error: `Invalid level '${level}'. Use project | bu | subsidiary | group` }, { status: 400 })
    }
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id') || undefined
    if (level !== 'group' && !id) {
      return NextResponse.json({ error: `?id= is required for level '${level}'` }, { status: 400 })
    }

    let scope
    try {
      scope = await resolveProjectIdsForLevel(level, id)
    } catch (e: any) {
      if (e.message === 'NOT_FOUND') return NextResponse.json({ error: `Scope '${level}' not found for id=${id}` }, { status: 404 })
      throw e
    }

    const { projectIds, scopeName, scopeType, scopeId } = scope
    if (projectIds.length === 0) {
      return NextResponse.json({ level, scope: { id: scopeId, name: scopeName, type: scopeType }, kpis: {}, lineage: { projectIds: [] }, note: 'No projects in scope' })
    }

    // ---- Fetch raw source records (APPROVED or LOCKED only) ----
    const where = { projectId: { in: projectIds }, status: { in: CONSOLIDATION_STATUSES } }

    const [energyRecords, waterRecords, wasteRecords, workforceRecords, safetyRecords] = await Promise.all([
      db.energyRecord.findMany({ where, include: { calculationResults: true } }),
      db.waterRecord.findMany({ where }),
      db.wasteRecord.findMany({ where }),
      db.workforceRecord.findMany({ where }),
      db.safetyRecord.findMany({ where }),
    ])

    // ---- EMISSIONS (sum of per-record CalculationResult.calculatedValue, by scope) ----
    const allCalcs = energyRecords.flatMap(e => e.calculationResults)
    const sumBy = (scope: string) => allCalcs.filter(c => c.scope === scope).reduce((s, c) => s + (c.calculatedValue || 0), 0)
    const scope1 = round(sumBy('SCOPE_1'))
    const scope2 = round(sumBy('SCOPE_2'))
    const scope3 = round(sumBy('SCOPE_3'))
    const totalEmissions = round(scope1 + scope2 + scope3)

    // ---- ENERGY (GJ) ----
    const totalEnergyGJ = round(energyRecords.reduce((s, e) => s + (e.normalizedValue || 0), 0))
    const renewableGJ = round(energyRecords.filter(e => e.sourceCategory === 'RENEWABLE').reduce((s, e) => s + (e.normalizedValue || 0), 0))
    const nonRenewableGJ = round(energyRecords.filter(e => e.sourceCategory === 'NON_RENEWABLE').reduce((s, e) => s + (e.normalizedValue || 0), 0))
    const renewableShare = totalEnergyGJ > 0 ? round((renewableGJ / totalEnergyGJ) * 100, 2) : 0

    // ---- WATER ----
    const waterWithdrawal = round(waterRecords.reduce((s, w) => s + (w.withdrawal || 0), 0))
    const waterRecycled = round(waterRecords.reduce((s, w) => s + (w.recycledReused || 0), 0))
    const waterConsumption = round(waterRecords.reduce((s, w) => s + (w.consumption || 0), 0))
    const waterDischarge = round(waterRecords.reduce((s, w) => s + (w.discharge || 0), 0))
    const waterRecycledShare = waterWithdrawal > 0 ? round((waterRecycled / waterWithdrawal) * 100, 2) : 0
    const waterStressSites = new Set(waterRecords.filter(w => w.waterStress).map(w => w.projectId)).size
    const zldSites = new Set(waterRecords.filter(w => w.zldActive).map(w => w.projectId)).size

    // ---- WASTE ----
    const wasteGenerated = round(wasteRecords.reduce((s, w) => s + (w.generatedQty || 0), 0))
    const wasteRecovered = round(wasteRecords.reduce((s, w) => s + (w.recoveredQty || 0), 0))
    const wasteRecycled = round(wasteRecords.reduce((s, w) => s + (w.recycledQty || 0), 0))
    const wasteReused = round(wasteRecords.reduce((s, w) => s + (w.reusedQty || 0), 0))
    const wasteDisposed = round(wasteRecords.reduce((s, w) => s + (w.disposedQty || 0), 0))
    const wasteRecoveredTotal = round(wasteRecovered + wasteRecycled + wasteReused)
    const wasteRecycledShare = wasteGenerated > 0 ? round((wasteRecoveredTotal / wasteGenerated) * 100, 2) : 0
    const hazardousWaste = round(wasteRecords.filter(w => w.hazardous).reduce((s, w) => s + (w.generatedQty || 0), 0))

    // ---- WORKFORCE ----
    const employees = workforceRecords.filter(w => w.category === 'EMPLOYEE').reduce((s, w) => s + w.permanent + w.nonPermanent, 0)
    const workers = workforceRecords.filter(w => w.category === 'WORKER').reduce((s, w) => s + w.permanent + w.nonPermanent, 0)
    const totalWorkforce = employees + workers
    const femaleCount = workforceRecords.reduce((s, w) => s + w.female, 0)
    const maleCount = workforceRecords.reduce((s, w) => s + w.male, 0)
    const otherCount = workforceRecords.reduce((s, w) => s + (w.other || 0), 0)
    const differentlyAbled = workforceRecords.reduce((s, w) => s + (w.differentlyAbled || 0), 0)
    const newHires = workforceRecords.reduce((s, w) => s + (w.newHires || 0), 0)
    const exits = workforceRecords.reduce((s, w) => s + (w.exits || 0), 0)
    const trainingHours = round(workforceRecords.reduce((s, w) => s + (w.trainingHours || 0), 0))
    const femaleShare = totalWorkforce > 0 ? round((femaleCount / totalWorkforce) * 100, 2) : 0
    const attritionRate = (totalWorkforce > 0 && exits > 0) ? round((exits / totalWorkforce) * 100, 2) : 0

    // ---- SAFETY ----
    const fatalities = safetyRecords.reduce((s, r) => s + r.fatalities, 0)
    const injuries = safetyRecords.reduce((s, r) => s + r.injuries, 0)
    const lostTimeIncidents = safetyRecords.reduce((s, r) => s + r.lostTimeIncidents, 0)
    const recordableInjuries = safetyRecords.reduce((s, r) => s + r.recordableInjuries, 0)
    const highConsequence = safetyRecords.reduce((s, r) => s + r.highConsequenceIncidents, 0)
    const manHours = safetyRecords.reduce((s, r) => s + (r.manHoursWorked || 0), 0)
    const safetyTrainingHours = round(safetyRecords.reduce((s, r) => s + (r.trainingHours || 0), 0))
    // LTIFR is always re-derived from raw lost-time incidents + total man-hours — never summed from per-record ratios
    const ltifr = manHours > 0 ? round(((lostTimeIncidents * LTIFR_COEFFICIENT) / manHours), 3) : 0

    // ---- LINEAGE (source record IDs that contributed) ----
    const lineage = {
      projectIds,
      energy: energyRecords.map(r => r.id),
      water: waterRecords.map(r => r.id),
      waste: wasteRecords.map(r => r.id),
      workforce: workforceRecords.map(r => r.id),
      safety: safetyRecords.map(r => r.id),
      calculationResults: allCalcs.map(c => c.id),
    }

    await db.auditLog.create({
      data: {
        actorId: user.id,
        actorName: user.name,
        actorRole: user.roles.map(r => r.name).join(', ') || 'User',
        action: 'CALCULATION',
        entityType: 'Consolidation',
        entityId: scopeId,
        newState: JSON.stringify({ level, scopeName, totalEmissions, totalEnergyGJ, waterWithdrawal, wasteGenerated, totalWorkforce }),
        reason: `Consolidation roll-up at ${level} level`,
      },
    })

    return NextResponse.json({
      level,
      scope: { id: scopeId, name: scopeName, type: scopeType, projectCount: projectIds.length },
      kpis: {
        emissions: { scope1, scope2, scope3, total: totalEmissions },
        energy: { totalGJ: totalEnergyGJ, renewableGJ, nonRenewableGJ, renewableShare },
        water: { withdrawalKL: waterWithdrawal, recycledKL: waterRecycled, consumptionKL: waterConsumption, dischargeKL: waterDischarge, recycledShare: waterRecycledShare, waterStressSites, zldSites },
        waste: { generatedT: wasteGenerated, recoveredT: wasteRecovered, recycledT: wasteRecycled, reusedT: wasteReused, disposedT: wasteDisposed, recoveredShare: wasteRecycledShare, hazardousT: hazardousWaste },
        workforce: { employees, workers, total: totalWorkforce, male: maleCount, female: femaleCount, other: otherCount, differentlyAbled, newHires, exits, femaleShare, attritionRate, trainingHours },
        safety: { fatalities, injuries, lostTimeIncidents, recordableInjuries, highConsequence, manHours, ltifr, safetyTrainingHours },
      },
      lineage,
      trace: {
        statusFilter: CONSOLIDATION_STATUSES,
        note: 'Sum of raw per-record values + per-record CalculationResult rows only. LTIFR re-derived from raw LTI count and total man-hours. No pre-aggregated numbers used.',
      },
    })
  } catch (e: any) {
    return apiError(e)
  }
}
