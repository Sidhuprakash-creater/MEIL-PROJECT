/**
 * BRSR Source Resolver — resolves mappingSource codes to REAL values from the DB.
 *
 * mappingSource codes (config-driven, see prisma/seed.ts):
 *   SUBSIDIARY.cin / SUBSIDIARY.name         → string identity fields
 *   WORKFORCE.total / .workers / .permanent / .nonPermanent / .trainingHours
 *   SAFETY.fatalities / .ltifr
 *   ENERGY.scope1 / .scope2 / .totalGJ / .renewableShare
 *   WATER.withdrawal / .recycledShare
 *   WASTE.hazardous / .recycledShare
 *   FINANCIAL.turnover / CSR.spend / GOVERNANCE.*  → MANUAL (no DB resolution)
 *
 * Returns the resolved numeric/string value, the list of source record IDs that
 * contributed to it, and a status flag indicating whether real approved source
 * data was found. Used by: indicators, generate, preview, reports/generate.
 */
import { db } from '@/lib/db'

export interface ResolvedIndicator {
  mappingSource: string | null
  resolvedValue: number | string | null
  resolvedUnit: string | null
  sourceRecordIds: string[]
  sourceRecordType: string | null
  status: 'RESOLVED' | 'MISSING_SOURCE' | 'MANUAL' | 'NO_MAPPING'
  derivation: string | null
}

export async function resolveIndicator(
  mappingSource: string | null,
  questionUnit: string | null,
  scope?: { scopeType?: string | null; scopeId?: string | null; reportingPeriodId?: string | null }
): Promise<ResolvedIndicator> {
  if (!mappingSource) {
    return {
      mappingSource: null,
      resolvedValue: null,
      resolvedUnit: questionUnit ?? null,
      sourceRecordIds: [],
      sourceRecordType: null,
      status: 'NO_MAPPING',
      derivation: null,
    }
  }

  // ----- scope filters (projectId for project-scoped requests) -----
  const projectFilter = scope?.scopeType === 'PROJECT' && scope?.scopeId
    ? { projectId: scope.scopeId }
    : {}
  const periodFilter = scope?.reportingPeriodId
    ? { reportingPeriodId: scope.reportingPeriodId }
    : {}

  // ----- WORKFORCE -----
  if (mappingSource.startsWith('WORKFORCE.')) {
    const records = await db.workforceRecord.findMany({
      where: { ...projectFilter, ...periodFilter, status: { in: ['APPROVED', 'LOCKED'] } },
    })
    if (records.length === 0) {
      return empty(mappingSource, questionUnit, 'WorkforceRecord', 'No approved workforce records found')
    }
    const ids = records.map(r => r.id)
    switch (mappingSource) {
      case 'WORKFORCE.total': {
        const v = records.filter(r => r.category === 'EMPLOYEE').reduce((s, r) => s + r.permanent + r.nonPermanent, 0)
        return ok(mappingSource, v, 'count', ids, 'WorkforceRecord', 'Σ(permanent + non-permanent) where category = EMPLOYEE')
      }
      case 'WORKFORCE.workers': {
        const v = records.filter(r => r.category === 'WORKER').reduce((s, r) => s + r.permanent + r.nonPermanent, 0)
        return ok(mappingSource, v, 'count', ids, 'WorkforceRecord', 'Σ(permanent + non-permanent) where category = WORKER')
      }
      case 'WORKFORCE.permanent': {
        const v = records.reduce((s, r) => s + r.permanent, 0)
        return ok(mappingSource, v, 'count', ids, 'WorkforceRecord', 'Σ(permanent)')
      }
      case 'WORKFORCE.nonPermanent': {
        const v = records.reduce((s, r) => s + r.nonPermanent, 0)
        return ok(mappingSource, v, 'count', ids, 'WorkforceRecord', 'Σ(nonPermanent)')
      }
      case 'WORKFORCE.trainingHours': {
        const v = records.reduce((s, r) => s + (r.trainingHours || 0), 0)
        return ok(mappingSource, Math.round(v), 'hours', ids, 'WorkforceRecord', 'Σ(trainingHours)')
      }
    }
  }

  // ----- SAFETY -----
  if (mappingSource.startsWith('SAFETY.')) {
    const records = await db.safetyRecord.findMany({
      where: { ...projectFilter, ...periodFilter, status: { in: ['APPROVED', 'LOCKED'] } },
    })
    if (records.length === 0) {
      return empty(mappingSource, questionUnit, 'SafetyRecord', 'No approved safety records found')
    }
    const ids = records.map(r => r.id)
    switch (mappingSource) {
      case 'SAFETY.fatalities': {
        const v = records.reduce((s, r) => s + r.fatalities, 0)
        return ok(mappingSource, v, 'count', ids, 'SafetyRecord', 'Σ(fatalities)')
      }
      case 'SAFETY.ltifr': {
        const lti = records.reduce((s, r) => s + r.lostTimeIncidents, 0)
        const manHours = records.reduce((s, r) => s + (r.manHoursWorked || 0), 0)
        if (manHours === 0) {
          return empty(mappingSource, questionUnit, 'SafetyRecord', 'LTIFR undefined — zero man-hours worked')
        }
        const v = (lti * 1000000) / manHours
        return ok(mappingSource, Math.round(v * 1000) / 1000, 'per million hours', ids, 'SafetyRecord', '(lostTimeIncidents × 1,000,000) / manHoursWorked')
      }
    }
  }

  // ----- ENERGY (incl. emissions from calculation results) -----
  if (mappingSource.startsWith('ENERGY.')) {
    const energyRecords = await db.energyRecord.findMany({
      where: { ...projectFilter, ...periodFilter, status: { in: ['APPROVED', 'LOCKED'] } },
      include: { calculationResults: true },
    })
    if (energyRecords.length === 0) {
      return empty(mappingSource, questionUnit, 'EnergyRecord', 'No approved energy records found')
    }
    const ids = energyRecords.map(r => r.id)
    const calcResults = energyRecords.flatMap(e => e.calculationResults)

    switch (mappingSource) {
      case 'ENERGY.scope1': {
        const v = calcResults.filter(c => c.scope === 'SCOPE_1').reduce((s, c) => s + (c.calculatedValue || 0), 0)
        return ok(mappingSource, Math.round(v * 100) / 100, 'tCO2e', ids, 'EnergyRecord', 'Σ(CalculationResult where scope=SCOPE_1)')
      }
      case 'ENERGY.scope2': {
        const v = calcResults.filter(c => c.scope === 'SCOPE_2').reduce((s, c) => s + (c.calculatedValue || 0), 0)
        return ok(mappingSource, Math.round(v * 100) / 100, 'tCO2e', ids, 'EnergyRecord', 'Σ(CalculationResult where scope=SCOPE_2)')
      }
      case 'ENERGY.totalGJ': {
        const v = energyRecords.reduce((s, e) => s + (e.normalizedValue || 0), 0)
        return ok(mappingSource, Math.round(v * 100) / 100, 'GJ', ids, 'EnergyRecord', 'Σ(normalizedValue in GJ)')
      }
      case 'ENERGY.renewableShare': {
        const total = energyRecords.reduce((s, e) => s + (e.normalizedValue || 0), 0)
        const renew = energyRecords.filter(e => e.sourceCategory === 'RENEWABLE').reduce((s, e) => s + (e.normalizedValue || 0), 0)
        const v = total > 0 ? (renew / total) * 100 : 0
        return ok(mappingSource, Math.round(v * 1000) / 1000, '%', ids, 'EnergyRecord', '(renewable GJ ÷ total GJ) × 100')
      }
    }
  }

  // ----- WATER -----
  if (mappingSource.startsWith('WATER.')) {
    const records = await db.waterRecord.findMany({
      where: { ...projectFilter, ...periodFilter, status: { in: ['APPROVED', 'LOCKED'] } },
    })
    if (records.length === 0) {
      return empty(mappingSource, questionUnit, 'WaterRecord', 'No approved water records found')
    }
    const ids = records.map(r => r.id)
    switch (mappingSource) {
      case 'WATER.withdrawal': {
        const v = records.reduce((s, r) => s + r.withdrawal, 0)
        return ok(mappingSource, Math.round(v * 100) / 100, 'KL', ids, 'WaterRecord', 'Σ(withdrawal)')
      }
      case 'WATER.recycledShare': {
        const withdrawal = records.reduce((s, r) => s + r.withdrawal, 0)
        const recycled = records.reduce((s, r) => s + (r.recycledReused || 0), 0)
        const v = withdrawal > 0 ? (recycled / withdrawal) * 100 : 0
        return ok(mappingSource, Math.round(v * 1000) / 1000, '%', ids, 'WaterRecord', '(recycledReused ÷ withdrawal) × 100')
      }
    }
  }

  // ----- WASTE -----
  if (mappingSource.startsWith('WASTE.')) {
    const records = await db.wasteRecord.findMany({
      where: { ...projectFilter, ...periodFilter, status: { in: ['APPROVED', 'LOCKED'] } },
    })
    if (records.length === 0) {
      return empty(mappingSource, questionUnit, 'WasteRecord', 'No approved waste records found')
    }
    const ids = records.map(r => r.id)
    switch (mappingSource) {
      case 'WASTE.hazardous': {
        const v = records.filter(r => r.hazardous).reduce((s, r) => s + (r.generatedQty || 0), 0)
        return ok(mappingSource, Math.round(v * 100) / 100, 'T', ids, 'WasteRecord', 'Σ(generatedQty) where hazardous = true')
      }
      case 'WASTE.recycledShare': {
        const generated = records.reduce((s, r) => s + (r.generatedQty || 0), 0)
        const recovered = records.reduce((s, r) => s + (r.recoveredQty || r.recycledQty || 0), 0)
        const v = generated > 0 ? (recovered / generated) * 100 : 0
        return ok(mappingSource, Math.round(v * 1000) / 1000, '%', ids, 'WasteRecord', '(recoveredQty ÷ generatedQty) × 100')
      }
    }
  }

  // ----- SUBSIDIARY identity -----
  if (mappingSource.startsWith('SUBSIDIARY.')) {
    const subs = await db.subsidiary.findMany({ where: { status: 'ACTIVE' } })
    if (subs.length === 0) {
      return empty(mappingSource, questionUnit, 'Subsidiary', 'No active subsidiary records found')
    }
    // Take first active subsidiary as the reporting entity
    const sub = subs[0]
    if (mappingSource === 'SUBSIDIARY.cin') {
      return ok(mappingSource, sub.cin ?? null, null, [sub.id], 'Subsidiary', 'Subsidiary.cin')
    }
    if (mappingSource === 'SUBSIDIARY.name') {
      return ok(mappingSource, sub.name, null, [sub.id], 'Subsidiary', 'Subsidiary.name')
    }
  }

  // ----- MANUAL mappings (FINANCIAL.*, CSR.*, GOVERNANCE.*) -----
  if (
    mappingSource.startsWith('FINANCIAL.') ||
    mappingSource.startsWith('CSR.') ||
    mappingSource.startsWith('GOVERNANCE.')
  ) {
    return {
      mappingSource,
      resolvedValue: null,
      resolvedUnit: questionUnit ?? null,
      sourceRecordIds: [],
      sourceRecordType: null,
      status: 'MANUAL',
      derivation: 'Manual disclosure — to be entered by BRSR preparer',
    }
  }

  // ----- Unknown mapping -----
  return {
    mappingSource,
    resolvedValue: null,
    resolvedUnit: questionUnit ?? null,
    sourceRecordIds: [],
    sourceRecordType: null,
    status: 'NO_MAPPING',
    derivation: `Unrecognised mappingSource '${mappingSource}'`,
  }
}

function ok(
  mappingSource: string,
  value: number | string | null,
  unit: string | null,
  ids: string[],
  recordType: string,
  derivation: string
): ResolvedIndicator {
  return {
    mappingSource,
    resolvedValue: value,
    resolvedUnit: unit,
    sourceRecordIds: ids,
    sourceRecordType: recordType,
    status: 'RESOLVED',
    derivation,
  }
}

function empty(
  mappingSource: string,
  questionUnit: string | null,
  recordType: string,
  reason: string
): ResolvedIndicator {
  return {
    mappingSource,
    resolvedValue: null,
    resolvedUnit: questionUnit ?? null,
    sourceRecordIds: [],
    sourceRecordType: recordType,
    status: 'MISSING_SOURCE',
    derivation: reason,
  }
}

// Statuses that count as "ready" (approved, locked, or evidence-verified).
export const READY_STATUSES = ['APPROVED', 'LOCKED', 'EVIDENCE_VERIFIED']
export const PENDING_EVIDENCE_STATUSES = ['DRAFT', 'SUBMITTED']
export const PENDING_APPROVAL_STATUSES = ['SUBMITTED']
