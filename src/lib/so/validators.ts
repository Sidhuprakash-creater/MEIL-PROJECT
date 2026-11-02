/**
 * Per-record validation rule packs. Each function takes a typed source record
 * (already fetched from the DB) and returns the set of ValidationIssues
 * produced by re-running all module rules. Pure & deterministic — same input
 * => same issues (no time/randomness).
 */
import { db } from '@/lib/db'
import type {
  EnergyRecord,
  WaterRecord,
  WasteRecord,
  WorkforceRecord,
  SafetyRecord,
} from '@prisma/client'
import { findEmissionFactorForSource, type ValidationIssue } from './engines'

const KNOWN_ENERGY_UNITS = ['KWH', 'MWH', 'GJ', 'L', 'KL', 'M3', 'KG', 'TON', 'T']
const VALID_WORKFORCE_CATEGORIES = ['EMPLOYEE', 'WORKER']
const VALID_SAFETY_RECORD_TYPES = ['INCIDENT', 'INJURY', 'FATALITY', 'LTI', 'RECORDABLE', 'TRAINING', 'ASSESSMENT']

const num = (v: unknown): number => Number(v ?? 0)

export async function validateEnergyRecord(r: EnergyRecord): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = []
  if (!Number.isFinite(r.quantity) || r.quantity <= 0) {
    issues.push({
      ruleCode: 'ENG-QTY-POSITIVE',
      severity: 'ERROR',
      message: `Quantity must be > 0 (received ${r.quantity})`,
      field: 'quantity',
      suggestedAction: 'Enter the metered consumption value for the reporting period.',
    })
  }
  if (!KNOWN_ENERGY_UNITS.includes(String(r.sourceUnit).toUpperCase())) {
    issues.push({
      ruleCode: 'ENG-UNIT-UNKNOWN',
      severity: 'WARNING',
      message: `Unit '${r.sourceUnit}' is not in the standard UnitMaster catalogue`,
      field: 'sourceUnit',
      suggestedAction: 'Use a standard unit (KWH, MWH, GJ, L, KL, M3, KG, TON).',
    })
  }
  if (r.meterRef) {
    const dup = await db.energyRecord.findFirst({
      where: { projectId: r.projectId, meterRef: r.meterRef, NOT: { id: r.id } },
      select: { id: true },
    })
    if (dup) {
      issues.push({
        ruleCode: 'ENG-METER-DUP',
        severity: 'ERROR',
        message: `Duplicate meterRef '${r.meterRef}' already exists for this project`,
        field: 'meterRef',
        suggestedAction: 'Either update the existing record or assign a unique meter reference.',
      })
    }
  }
  const factor = await findEmissionFactorForSource(r.source)
  if (!factor) {
    issues.push({
      ruleCode: 'ENG-FACTOR-MISSING',
      severity: 'WARNING',
      message: `No emission factor matched source '${r.source}'; emissions calculation skipped`,
      field: 'source',
      suggestedAction: 'Map this source to a known EmissionFactor row or add a new factor.',
    })
  }
  return issues
}

export async function validateWaterRecord(r: WaterRecord): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = []
  const w = num(r.withdrawal)
  const c = num(r.consumption)
  const d = num(r.discharge)
  const rec = num(r.recycledReused)
  if (!Number.isFinite(w) || w <= 0) {
    issues.push({ ruleCode: 'WTR-WITHDRAWAL-POSITIVE', severity: 'ERROR', message: `Withdrawal must be > 0 (received ${w})`, field: 'withdrawal' })
  }
  if (rec > w) {
    issues.push({ ruleCode: 'WTR-RECYCLE-LE-WITHDRAWAL', severity: 'ERROR', message: `Recycled/reused (${rec}) cannot exceed withdrawal (${w})`, field: 'recycledReused' })
  }
  if (c > w) {
    issues.push({ ruleCode: 'WTR-CONSUMPTION-LE-WITHDRAWAL', severity: 'ERROR', message: `Consumption (${c}) cannot exceed withdrawal (${w})`, field: 'consumption' })
  }
  if (d > w) {
    issues.push({ ruleCode: 'WTR-DISCHARGE-LE-WITHDRAWAL', severity: 'ERROR', message: `Discharge (${d}) cannot exceed withdrawal (${w})`, field: 'discharge' })
  }
  if (r.waterStress && rec === 0) {
    issues.push({ ruleCode: 'WTR-STRESS-RECYCLE', severity: 'WARNING', message: 'Site flagged as water-stressed but no recycling reported', field: 'waterStress' })
  }
  return issues
}

export async function validateWasteRecord(r: WasteRecord): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = []
  const g = num(r.generatedQty)
  const out = num(r.recoveredQty) + num(r.recycledQty) + num(r.reusedQty) + num(r.disposedQty)
  if (!Number.isFinite(g) || g < 0) {
    issues.push({ ruleCode: 'WST-GEN-NONNEG', severity: 'ERROR', message: `Generated quantity must be >= 0 (received ${g})`, field: 'generatedQty' })
  }
  if (out > g) {
    issues.push({
      ruleCode: 'WST-OUTFLOW-LE-GEN',
      severity: 'ERROR',
      message: `Outflow (recovered+recycled+reused+disposed = ${out}) exceeds generated (${g})`,
      field: 'generatedQty',
      suggestedAction: 'Reconcile manifest weights with gate register.',
    })
  }
  if (r.hazardous && !r.manifestRef) {
    issues.push({ ruleCode: 'WST-HAZ-MANIFEST', severity: 'ERROR', message: 'Hazardous waste requires a manifest reference', field: 'manifestRef' })
  }
  if (r.hazardous && !r.vendor) {
    issues.push({ ruleCode: 'WST-HAZ-VENDOR', severity: 'WARNING', message: 'Hazardous waste should name an authorised vendor', field: 'vendor' })
  }
  return issues
}

export async function validateWorkforceRecord(r: WorkforceRecord): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = []
  const perm = num(r.permanent)
  const nonPerm = num(r.nonPermanent)
  const m = num(r.male)
  const f = num(r.female)
  const o = num(r.other)
  const total = perm + nonPerm
  const genderTotal = m + f + o
  if (!VALID_WORKFORCE_CATEGORIES.includes(String(r.category))) {
    issues.push({ ruleCode: 'PPL-CATEGORY-VALID', severity: 'ERROR', message: `Category must be EMPLOYEE or WORKER (received ${r.category})`, field: 'category' })
  }
  if ([perm, nonPerm, m, f, o].some(n => n < 0)) {
    issues.push({ ruleCode: 'PPL-NONNEG', severity: 'ERROR', message: 'All workforce counts must be >= 0', field: 'permanent' })
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
  const nh = num(r.newHires)
  const ex = num(r.exits)
  if (nh > total) {
    issues.push({ ruleCode: 'PPL-HIRES-LE-TOTAL', severity: 'WARNING', message: `New hires (${nh}) exceed total workforce (${total})`, field: 'newHires' })
  }
  if (ex > total) {
    issues.push({ ruleCode: 'PPL-EXITS-LE-TOTAL', severity: 'WARNING', message: `Exits (${ex}) exceed total workforce (${total})`, field: 'exits' })
  }
  return issues
}

export async function validateSafetyRecord(r: SafetyRecord): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = []
  if (!VALID_SAFETY_RECORD_TYPES.includes(String(r.recordType))) {
    issues.push({ ruleCode: 'SFT-RECORDTYPE-VALID', severity: 'ERROR', message: `recordType must be one of ${VALID_SAFETY_RECORD_TYPES.join(', ')} (received ${r.recordType})`, field: 'recordType' })
  }
  const fat = num(r.fatalities)
  const inj = num(r.injuries)
  const lti = num(r.lostTimeIncidents)
  const recInj = num(r.recordableInjuries)
  const hci = num(r.highConsequenceIncidents)
  if ([fat, inj, lti, recInj, hci].some(n => n < 0)) {
    issues.push({ ruleCode: 'SFT-NONNEG', severity: 'ERROR', message: 'All incident/injury counts must be >= 0', field: 'fatalities' })
  }
  if (fat > 0 && lti === 0) {
    issues.push({ ruleCode: 'SFT-FATALITY-IMPLIES-LTI', severity: 'WARNING', message: 'A fatality was recorded but lostTimeIncidents = 0', field: 'lostTimeIncidents' })
  }
  if (r.manHoursWorked !== null && r.manHoursWorked <= 0) {
    issues.push({ ruleCode: 'SFT-MANHOURS-POSITIVE', severity: 'WARNING', message: `manHoursWorked should be > 0 to compute LTIFR (received ${r.manHoursWorked})`, field: 'manHoursWorked' })
  }
  return issues
}

// ---------------------------------------------------------------------------
// Dispatcher — routes a single record to its validator by record type.
// ---------------------------------------------------------------------------
export async function runValidationFor(recordType: string, record: any): Promise<ValidationIssue[]> {
  switch (recordType) {
    case 'ENERGY': return validateEnergyRecord(record as EnergyRecord)
    case 'WATER': return validateWaterRecord(record as WaterRecord)
    case 'WASTE': return validateWasteRecord(record as WasteRecord)
    case 'PEOPLE': return validateWorkforceRecord(record as WorkforceRecord)
    case 'SAFETY': return validateSafetyRecord(record as SafetyRecord)
    default: return [{ ruleCode: 'UNKNOWN-RECORD-TYPE', severity: 'ERROR', message: `Unknown recordType '${recordType}'` }]
  }
}
