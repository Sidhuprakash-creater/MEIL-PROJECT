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

/* ── Serverless persistence (Vercel read-only filesystem) ─────────────────────
   Shares the same file — and therefore the same DB blob — as the PU module:
   one store, two entry points. */
const BLOB_SKEY = 'level_records_blob'
let blobRecords: LevelRecord[] | null = null
let lastSelfWriteAt = 0

async function persistLevelRecordsToDb(records: LevelRecord[]): Promise<void> {
  try {
    const { db } = await import('@/lib/db')
    const svalue = Buffer.from(JSON.stringify(records), 'utf-8').toString('base64')
    await db.appSetting.upsert({
      where: { skey: BLOB_SKEY },
      create: { skey: BLOB_SKEY, label: 'Level records store', category: 'LEVEL_RECORDS', svalue, vtype: 'text' },
      update: { svalue },
    })
  } catch (err) {
    console.error('Failed to persist level records to DB:', (err as any)?.message || err)
  }
}

/** Re-reads the DB blob per request unless this lambda wrote it moments ago —
   hydrate-once made warm lambdas miss records submitted after warm-up. */
export async function ensureSoLevelRecordsLoaded(): Promise<void> {
  if (Date.now() - lastSelfWriteAt < 5000) return
  try {
    const { db } = await import('@/lib/db')
    const row = await db.appSetting.findUnique({ where: { skey: BLOB_SKEY }, select: { svalue: true } })
    if (row?.svalue) {
      const parsed = JSON.parse(Buffer.from(row.svalue, 'base64').toString('utf-8'))
      if (Array.isArray(parsed)) blobRecords = parsed
    }
  } catch (err) {
    console.error('Failed to hydrate level records from DB:', (err as any)?.message || err)
  }
}

// Initial seed records for realistic enterprise presentation
// Empty by design — the ZIP demo seed carried stale ZIP-era project ids that
// would leak into the PARENT platform. The store self-heals (creates the file)
// on first read; all real records live in PARENT Prisma or are entered fresh.
const DEFAULT_RECORDS: LevelRecord[] = []

function readStore(): LevelRecord[] {
  /* Once hydrated from the DB blob, that copy is authoritative. */
  if (blobRecords) return blobRecords
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
  /* DB blob is the durable copy — always written, even when the file write
     fails on a read-only filesystem. */
  blobRecords = records
  lastSelfWriteAt = Date.now()
  void persistLevelRecordsToDb(records)
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

