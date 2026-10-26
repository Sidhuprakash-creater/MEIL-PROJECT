import fs from 'fs'
import path from 'path'

export interface ValidationIssue {
  ruleCode: string
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'BLOCKING'
  message: string
  field?: string | null
  suggestedAction?: string | null
}

export interface CalculationPayload {
  calculatedValue: number
  resultUnit: string
  scope?: string | null
  factorId?: string | null
  factorVersion?: number | null
  methodologyNote?: string | null
  formula?: string | null
  calculatedAt?: string | null
  sourceRecordId?: string | null
  lineage?: Record<string, any> | null
  normalizedValue?: number | null
  normalizedUnit?: string | null
  sourceValue?: number
  sourceUnit?: string
  derivedLtifr?: number | null
}

export interface LevelRecord {
  id: string
  level: number // 1-9
  levelKey: string // 'level1' ... 'level9'
  levelName: string
  module: string // 'ENERGY' | 'WATER' | 'EMISSIONS' | 'WASTE' | 'SAFETY' | 'TRAINING' | 'COMPLIANCE' | 'INCIDENTS' | 'INITIATIVES'
  projectId: string
  reportingPeriodId: string
  data: Record<string, any>
  evidenceId?: string | null
  validationStatus: 'PASSED' | 'WARNING' | 'FAILED' | 'PENDING'
  calculationStatus: 'COMPUTED' | 'NOT_APPLICABLE' | 'PENDING'
  calculation: CalculationPayload | null
  issues: ValidationIssue[]
  status:
    | 'DRAFT'
    | 'SUBMITTED'
    | 'PENDING'
    | 'UNDER_REVIEW'
    | 'APPROVED'
    | 'ACTIVE'
    | 'CORRECTION_REQUESTED'
    | 'RETURNED_FOR_CORRECTION'
    | 'RECALCULATION_REQUIRED'
    | 'LOCKED'
  revisionNumber: number
  enteredBy: string
  enteredAt: string
  updatedAt: string
}

const STORE_PATH = path.join(process.cwd(), 'prisma', 'level-records-store.json')

// Initial seed records for realistic enterprise presentation
const DEFAULT_RECORDS: LevelRecord[] = [
  {
    id: 'rec-l1-001',
    level: 1,
    levelKey: 'level1',
    levelName: 'Level 1 — Energy Consumption',
    module: 'ENERGY',
    projectId: 'p1', // MEIL-SOL-GJT
    reportingPeriodId: 'per-2026-06',
    data: {
      energySource: 'Grid electricity',
      energyActivity: 'Lighting & Office Camp',
      consumptionQuantity: 42800,
      unit: 'kWh',
      meterEquipmentId: 'MTR-GJT-GRID-01',
      openingMeterReading: 124500,
      closingMeterReading: 167300,
      energyPurchased: 42800,
      energyGenerated: 0,
      renewableEnergyQuantity: 0,
      reportingPeriod: 'June 2026',
      sourceDocument: 'Electricity bill',
      remarks: 'Reconciled with TSSPDCL utility bill ref 891204',
    },
    evidenceId: null,
    validationStatus: 'PASSED',
    calculationStatus: 'COMPUTED',
    calculation: {
      calculatedValue: 30.64,
      resultUnit: 'tCO2e',
      scope: 'SCOPE_2',
      factorId: 'CEA-GRID-V19',
      factorVersion: 19,
      methodologyNote: 'CEA CO2 Baseline Database v19 (0.716 kgCO2e/kWh)',
      normalizedValue: 154.08,
      normalizedUnit: 'GJ',
      sourceValue: 42800,
      sourceUnit: 'kWh',
    },
    issues: [],
    status: 'APPROVED',
    revisionNumber: 1,
    enteredBy: 'Rohit Kumar (Environment Data User)',
    enteredAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: 'rec-l2-001',
    level: 2,
    levelKey: 'level2',
    levelName: 'Level 2 — Water Management',
    module: 'WATER',
    projectId: 'p1',
    reportingPeriodId: 'per-2026-06',
    data: {
      waterActivity: 'Withdrawal',
      waterSource: 'Groundwater',
      waterQuantity: 2450,
      unit: 'kL',
      meterSourceId: 'BW-GJT-02-INTAKE',
      openingReading: 88100,
      closingReading: 90550,
      waterReusedRecycled: 850,
      dischargeDestination: 'ETP/STP reuse in landscaping',
      treatmentLevel: 'STP / ETP Advanced',
      waterQualityResult: 'BOD: 14 mg/L, COD: 42 mg/L, TSS: 12 mg/L, pH: 7.4',
      testDateLab: '2026-06-10 / SGS NABL Accredited Lab',
      supportingEvidence: 'Borewell meter log',
      remarks: 'Borewell extraction within CGWA permitted quota',
    },
    evidenceId: null,
    validationStatus: 'PASSED',
    calculationStatus: 'COMPUTED',
    calculation: {
      calculatedValue: 1600,
      resultUnit: 'kL Net Consumption',
      scope: 'WATER_BALANCE',
      methodologyNote: 'Net Consumption = Withdrawal (2450 kL) - Recycled Reused (850 kL)',
      sourceValue: 2450,
      sourceUnit: 'kL',
    },
    issues: [],
    status: 'APPROVED',
    revisionNumber: 1,
    enteredBy: 'Rohit Kumar (Environment Data User)',
    enteredAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
  {
    id: 'rec-l4-001',
    level: 4,
    levelKey: 'level4',
    levelName: 'Level 4 — Waste Management',
    module: 'WASTE',
    projectId: 'p1',
    reportingPeriodId: 'per-2026-06',
    data: {
      wasteCategory: 'Construction & demolition (C&D)',
      wasteTypeDescription: 'Concrete rubble and rebar scrap',
      quantityGenerated: 14.5,
      unit: 'metric tonnes (MT)',
      quantityReused: 8.2,
      quantityRecycled: 5.8,
      quantityRecovered: 0,
      quantityDisposed: 0.5,
      disposalMethod: 'Secured landfill (TSDF)',
      wasteHandler: 'M/s EcoRecycle India Pvt Ltd',
      authorizationReference: 'SPCB/CD/AUTH/2025/1102',
      transferManifestNumber: 'MANIFEST-GJT-2026-06-08',
      supportingEvidence: 'Waste register',
      remarks: '96.5% diversion rate achieved through sub-base crushing reuse',
    },
    evidenceId: null,
    validationStatus: 'PASSED',
    calculationStatus: 'COMPUTED',
    calculation: {
      calculatedValue: 96.55,
      resultUnit: '% Diversion Rate',
      scope: 'WASTE_DIVERSION',
      methodologyNote: 'Diversion Rate = (Reused 8.2 + Recycled 5.8) / Generated 14.5 * 100',
      sourceValue: 14.5,
      sourceUnit: 'MT',
    },
    issues: [],
    status: 'APPROVED',
    revisionNumber: 1,
    enteredBy: 'Rohit Kumar (Environment Data User)',
    enteredAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
]

function readStore(): LevelRecord[] {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const data = fs.readFileSync(STORE_PATH, 'utf-8')
      const parsed = JSON.parse(data)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch (e) {
    console.error('Failed to read level records store:', e)
  }
  writeStore(DEFAULT_RECORDS)
  return DEFAULT_RECORDS
}

function writeStore(records: LevelRecord[]): void {
  try {
    const dir = path.dirname(STORE_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(STORE_PATH, JSON.stringify(records, null, 2), 'utf-8')
  } catch (e) {
    console.error('Failed to write level records store:', e)
  }
}

export function getLevelRecords(projectId?: string, periodId?: string, level?: number): LevelRecord[] {
  const all = readStore()
  return all.filter((r) => {
    if (projectId && r.projectId !== projectId) return false
    if (periodId && r.reportingPeriodId !== periodId) return false
    if (level) {
      if (level === 5) return r.level === 5 || r.level === 7
      if (level === 6) return r.level === 6 || r.level === 9
      if (level === 7) return r.level === 5 || r.level === 7
      if (level === 9) return r.level === 6 || r.level === 9
      return r.level === level
    }
    return true
  })
}

export function getLevelRecordById(id: string): LevelRecord | null {
  const all = readStore()
  return all.find((r) => r.id === id) || null
}

export function saveLevelRecord(record: LevelRecord): LevelRecord {
  const all = readStore()
  const idx = all.findIndex((r) => r.id === record.id)
  if (idx >= 0) {
    all[idx] = { ...record, updatedAt: new Date().toISOString() }
  } else {
    all.unshift(record)
  }
  writeStore(all)
  return record
}

export function deleteLevelRecord(id: string): boolean {
  const all = readStore()
  const next = all.filter((r) => r.id !== id)
  if (next.length !== all.length) {
    writeStore(next)
    return true
  }
  return false
}

export function updateLevelRecordStatus(id: string, status: 'DRAFT' | 'SUBMITTED' | 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'ACTIVE' | 'CORRECTION_REQUESTED' | 'LOCKED'): boolean {
  const all = readStore()
  const rec = all.find((r) => r.id === id)
  if (rec) {
    rec.status = status
    rec.updatedAt = new Date().toISOString()
    writeStore(all)
    return true
  }
  return false
}

