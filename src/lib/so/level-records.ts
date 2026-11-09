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
  evidenceIds?: string[]
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
// Empty by design — the ZIP demo seed carried stale ZIP-era project ids that
// would leak into the PARENT platform. The store self-heals (creates the file)
// on first read; all real records live in PARENT Prisma or are entered fresh.
const DEFAULT_RECORDS: LevelRecord[] = []

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
  /* Never store an id-less record — an undefined id breaks React keys and
     every record lookup downstream. */
  if (!record.id) {
    record = { ...record, id: `rec-l${record.level}-${record.projectId}-${Date.now()}` }
  }
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

