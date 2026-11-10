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
   The JSON file store works locally, but on Vercel lambdas the filesystem is
   read-only and writes silently fail — contributor level records vanished and
   review windows showed "No per-source records captured". Every write now also
   lands in an AppSetting blob (DB-backed, shared across lambdas), and once
   hydrated from that blob it is the authoritative store. */
const BLOB_SKEY = 'level_records_blob'
let blobRecords: LevelRecord[] | null = null
let blobHydrationStarted = false

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

/** Call ONCE per request in server handlers before reading/writing the store.
   Hydrates the in-memory store from the DB blob so every lambda sees the same
   records; the file store remains the local-dev fallback. */
export async function ensureLevelRecordsLoaded(): Promise<void> {
  if (blobHydrationStarted) return
  blobHydrationStarted = true
  try {
    const { db } = await import('@/lib/db')
    const row = await db.appSetting.findUnique({ where: { skey: BLOB_SKEY }, select: { svalue: true } })
    if (row?.svalue) {
      const parsed = JSON.parse(Buffer.from(row.svalue, 'base64').toString('utf-8'))
      if (Array.isArray(parsed)) blobRecords = parsed.map((r: any) => sanitizeRecord(r))
    }
  } catch (err) {
    console.error('Failed to hydrate level records from DB:', (err as any)?.message || err)
  }
}

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

/* Parse cache — the store file is ~75KB; re-reading + re-parsing it on every
   request is the hottest path in the data-entry module. Cached by mtime so
   external edits are still picked up. */
let storeCache: { mtimeMs: number; size: number; records: LevelRecord[] } | null = null

/**
 * Make a persisted record safe to render.
 *
 * Older data-entry versions stored the WHOLE evidence row (with the uploader
 * relation) inside `items[].evidenceFiles`. Any screen that renders an item
 * then hit React's "objects are not valid as a React child" (minified #31).
 * We normalise on read: an evidence object becomes its file name, and any
 * other stray object becomes a short readable string.
 */
function sanitizeRecord<T extends { data?: any }>(record: T): T {
  const data = record?.data
  if (!data || typeof data !== 'object') return record
  const items = Array.isArray(data.items) ? data.items : null
  if (!items) return record

  const nameOf = (v: any): string | null => {
    if (typeof v === 'string') return v
    if (v && typeof v === 'object') {
      const name = v.fileName ?? v.name ?? v.documentName ?? v.originalFilename
      return typeof name === 'string' && name.trim() ? name : null
    }
    return null
  }

  let changed = false
  const safeItems = items.map((item: any) => {
    if (!item || typeof item !== 'object') return item
    const next: any = { ...item }
    for (const key of Object.keys(next)) {
      const value = next[key]
      if (Array.isArray(value)) {
        const names = value.map(nameOf).filter((n): n is string => !!n)
        if (names.length !== value.length || value.some((v: any) => typeof v !== 'string')) {
          next[key] = names
          changed = true
        }
      } else if (value && typeof value === 'object') {
        const name = nameOf(value)
        next[key] = name ?? (Array.isArray(value) ? [] : '')
        changed = true
      }
    }
    return next
  })

  if (!changed) return record
  return { ...record, data: { ...data, items: safeItems } } as T
}

function readStore(): LevelRecord[] {
  /* Once hydrated from the DB blob, that copy is authoritative — the bundled
     file may be empty or stale on serverless deployments. */
  if (blobRecords) return blobRecords
  try {
    const stat = fs.statSync(STORE_PATH)
    if (storeCache && storeCache.mtimeMs === stat.mtimeMs && storeCache.size === stat.size) {
      return storeCache.records
    }
    const data = fs.readFileSync(STORE_PATH, 'utf-8')
    const parsed = JSON.parse(data)
    if (Array.isArray(parsed)) {
      /* An intentionally EMPTY store stays empty — the demo defaults are only
         seeded when the file is missing or unreadable. Otherwise a wiped
         workspace would immediately repopulate with the sample records. */
      const records = parsed.map((r: any) => sanitizeRecord(r))
      storeCache = { mtimeMs: stat.mtimeMs, size: stat.size, records }
      return records
    }
  } catch (e) {
    console.error('Failed to read level records store:', e)
  }
  writeStore(DEFAULT_RECORDS)
  return DEFAULT_RECORDS
}

function writeStore(records: LevelRecord[]): void {
  /* DB blob is the durable copy — always written, even when the file write
     below fails on a read-only filesystem. */
  blobRecords = records
  void persistLevelRecordsToDb(records)
  try {
    const dir = path.dirname(STORE_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const json = JSON.stringify(records, null, 2)
    fs.writeFileSync(STORE_PATH, json, 'utf-8')
    const stat = fs.statSync(STORE_PATH)
    storeCache = { mtimeMs: stat.mtimeMs, size: stat.size, records }
  } catch (e) {
    console.error('Failed to write level records store:', e)
  }
}

function mergeRecord(all: LevelRecord[], fullRecord: LevelRecord): void {
  const idx = all.findIndex((r) => r.id === fullRecord.id)
  if (idx >= 0) {
    all[idx] = { ...fullRecord, updatedAt: new Date().toISOString() }
  } else {
    all.unshift(fullRecord)
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

export function saveLevelRecord(
  record: Partial<LevelRecord> & {
    level: number
    levelKey: string
    levelName: string
    module: string
    projectId: string
    reportingPeriodId: string
    data: Record<string, any>
  }
): LevelRecord {
  /* Guard the id: callers may pass `id: undefined` explicitly, and the final
     ...record spread would otherwise clobber the generated id — producing an
     id-less store record that breaks React keys and record lookups. */
  const fallbackId = `rec-${record.levelKey}-${record.projectId}-${Date.now()}`
  const { id: maybeId, ...rest } = record
  const fullRecord: LevelRecord = {
    calculationStatus: record.calculationStatus || 'COMPUTED',
    calculation: record.calculation || null,
    issues: record.issues || [],
    status: record.status || 'SUBMITTED',
    validationStatus: record.validationStatus || 'PASSED',
    revisionNumber: record.revisionNumber || 1,
    enteredBy: record.enteredBy || 'Environmental Data User',
    enteredAt: record.enteredAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...rest,
    id: maybeId || fallbackId,
  }
  const all = readStore()
  mergeRecord(all, fullRecord)
  writeStore(all)
  return fullRecord
}

/** Persist many level records with ONE read + ONE write of the store file
 *  (submit-all previously did 9 full read+write cycles). */
export function saveManyLevelRecords(
  records: Array<Partial<LevelRecord> & {
    level: number
    levelKey: string
    levelName: string
    module: string
    projectId: string
    reportingPeriodId: string
    data: Record<string, any>
  }>
): LevelRecord[] {
  const all = readStore()
  const saved: LevelRecord[] = []
  for (const record of records) {
    /* Same id guard as saveLevelRecord — never let an explicit undefined id
       wipe the generated one. */
    const fallbackId = `rec-${record.levelKey}-${record.projectId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const { id: maybeId, ...rest } = record
    const fullRecord: LevelRecord = {
      calculationStatus: record.calculationStatus || 'COMPUTED',
      calculation: record.calculation || null,
      issues: record.issues || [],
      status: record.status || 'SUBMITTED',
      validationStatus: record.validationStatus || 'PASSED',
      revisionNumber: record.revisionNumber || 1,
      enteredBy: record.enteredBy || 'Environmental Data User',
      enteredAt: record.enteredAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...rest,
      id: maybeId || fallbackId,
    }
    mergeRecord(all, fullRecord)
    saved.push(fullRecord)
  }
  writeStore(all)
  return saved
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

