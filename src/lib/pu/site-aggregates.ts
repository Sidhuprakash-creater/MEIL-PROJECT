/* ═══════════════════════════════════════════════════════════════════════════
   MEIL ESG · Project User Portal — SITE-SCOPED ESG AGGREGATION
   ═══════════════════════════════════════════════════════════════════════════

   WHY THIS EXISTS
   The contributor dashboard must show the contributor's OWN data — the records
   they captured for THEIR project, once the Project Admin has approved them.

   The legacy overview read group-wide Prisma mirror tables (energyRecord,
   calculationResult, …). The level-record capture flow never populated those
   mirrors, so the dashboard could not reflect a real submission — it showed
   group-wide (or empty) numbers. This module reads the level-record store —
   the single source of truth for captured data, including each item's
   emission factor and the computed `est. tCO2e` / `est. GJ` — and rolls it
   up for ONE project.

   WHAT IT GETS RIGHT
   · SCOPE: everything is filtered to the project the user is assigned to.
   · SCOPE 2 INCLUDES GRID ELECTRICITY: Level 1 energy items already carry a
     computed tCO2e (grid electricity via the CEA v20 factor 0.716 tCO2/MWh).
     That tCO2e is added into the Scope 2 line, so the headline emissions
     figure = direct (Scope 1) + indirect (Scope 2) + value chain (Scope 3).
   · APPROVED vs PENDING: reported KPIs carry only APPROVED data; anything
     still with the Project Admin is reported separately as "pending".
   ═══════════════════════════════════════════════════════════════════════════ */

import { db } from '@/lib/pu/db'
import {
  ensureLevelRecordsLoaded,
  getLevelRecords,
  type LevelRecord,
} from '@/lib/pu/level-records'

export type SiteScope = 'SCOPE_1' | 'SCOPE_2' | 'SCOPE_3'

/** Submission statuses that mean "the reviewer chain has signed this off". */
export const APPROVED_SUBMISSION_STATUSES = new Set([
  'APPROVED',
  'BU_APPROVED',
  'SUBSIDIARY_APPROVED',
  'HQ_REVIEW',
  'LOCKED',
])

export interface SiteTotals {
  scope1: number
  scope2: number
  scope3: number
  /** Scope 1 + Scope 2 + Scope 3 (the headline GHG footprint). */
  totalEmissions: number
  energyGJ: number
  renewableGJ: number
  renewableShare: number
  /** Grid electricity specifically — the "Grid Electricity" KPI tile. */
  gridElectricityGJ: number
  gridElectricityTco2e: number
  waterWithdrawalKL: number
  waterRecycledKL: number
  waterRecycledShare: number
  wasteGeneratedT: number
  wasteRecoveredT: number
  wasteRecycledShare: number
  hazardousWasteT: number
  /** How many captured source items fed these numbers. */
  itemCount: number
}

export interface SiteLine {
  source: string
  scope: SiteScope | null
  tco2e: number
  gj: number
  quantity: number
  unit: string
  module: string
  level: number
  recordId: string
  /** APPROVED (reported) or PENDING (awaiting the Project Admin). */
  state: 'APPROVED' | 'PENDING'
  energy: boolean
  renewable: boolean
  grid: boolean
}

export interface SiteAggregation {
  projectId: string
  totals: SiteTotals
  pending: SiteTotals
  lines: SiteLine[]
  emissionsBySource: Record<string, number>
  /** Per reporting period — the dashboard's monthly trend lines. */
  byPeriod: Record<string, {
    emissions: number
    energy: number
    water: number
    waste: number
    scope1: number
    scope2: number
    scope3: number
  }>
  records: number
  approvedRecords: number
  pendingRecords: number
}

const EMPTY_TOTALS: SiteTotals = {
  scope1: 0,
  scope2: 0,
  scope3: 0,
  totalEmissions: 0,
  energyGJ: 0,
  renewableGJ: 0,
  renewableShare: 0,
  gridElectricityGJ: 0,
  gridElectricityTco2e: 0,
  waterWithdrawalKL: 0,
  waterRecycledKL: 0,
  waterRecycledShare: 0,
  wasteGeneratedT: 0,
  wasteRecoveredT: 0,
  wasteRecycledShare: 0,
  hazardousWasteT: 0,
  itemCount: 0,
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/** 'Scope 1 activity' → SCOPE_1 · 'Air pollutant' → null (not a GHG scope). */
export function scopeFromType(value: unknown): SiteScope | null {
  const s = String(value ?? '')
  if (!s) return null
  if (s.includes('3')) return 'SCOPE_3'
  if (s.includes('2')) return 'SCOPE_2'
  if (s.includes('1')) return 'SCOPE_1'
  return null
}

const SCOPE1_SOURCES = ['diesel', 'gas', 'lpg', 'coal', 'hfo', 'furnace oil', 'petrol', 'naptha']

function isRenewableSource(source: unknown): boolean {
  const s = String(source ?? '').toLowerCase()
  return ['solar', 'renewable', 'hydro', 'wind', 'biomass', 'green', 'rooftop'].some((k) => s.includes(k))
}

function isGridSource(source: unknown): boolean {
  const s = String(source ?? '').toLowerCase()
  return ['grid', 'utility', 'purchased electricity', 'electricity grid'].some((k) => s.includes(k))
}

/** Scope of a Level 1 energy item — direct fuel burn is Scope 1, the rest Scope 2. */
function energyScope(item: Record<string, any>): SiteScope {
  const explicit = scopeFromType(item.emissionDataType)
  if (explicit) return explicit
  const src = String(item.energySource ?? '').toLowerCase()
  if (SCOPE1_SOURCES.some((k) => src.includes(k))) return 'SCOPE_1'
  return 'SCOPE_2'
}

/* ── per-module line extraction ──────────────────────────────────────────── */

type RawLine = Omit<SiteLine, 'state' | 'recordId' | 'level' | 'module'>

function energyLines(rec: LevelRecord): RawLine[] {
  const items = Array.isArray(rec.data?.items) ? rec.data.items : []
  if (items.length) {
    return items.map((it: any) => ({
      source: String(it.energySource || 'Energy source'),
      scope: energyScope(it),
      tco2e: num(it.estTco2e),
      gj: num(it.estGj),
      quantity: num(it.consumptionQuantity),
      unit: String(it.unit || 'kWh'),
      energy: true,
      renewable: isRenewableSource(it.energySource),
      grid: isGridSource(it.energySource),
    }))
  }

  /* Legacy single-field capture (Level 1 scalar form). */
  const d = (rec.data || {}) as Record<string, any>
  const grid = num(d.electricityGridKwh)
  const diesel = num(d.dieselDgLiters)
  const solar = num(d.solarRooftopKwh)
  const lines: RawLine[] = []
  if (grid > 0) {
    lines.push({
      source: 'Grid electricity', scope: 'SCOPE_2', tco2e: (grid * 0.716) / 1000,
      gj: grid * 0.0036, quantity: grid, unit: 'kWh', energy: true, renewable: false, grid: true,
    })
  }
  if (diesel > 0) {
    lines.push({
      source: 'Diesel', scope: 'SCOPE_1', tco2e: (diesel * 2.68) / 1000,
      gj: diesel * 0.038, quantity: diesel, unit: 'Litres', energy: true, renewable: false, grid: false,
    })
  }
  if (solar > 0) {
    lines.push({
      source: 'Rooftop solar', scope: 'SCOPE_2', tco2e: 0,
      gj: solar * 0.0036, quantity: solar, unit: 'kWh', energy: true, renewable: true, grid: false,
    })
  }
  return lines
}

function emissionLines(rec: LevelRecord): RawLine[] {
  const items = Array.isArray(rec.data?.items) ? rec.data.items : []
  if (items.length) {
    return items.map((it: any) => {
      const scope =
        scopeFromType(it.emissionDataType) ??
        (it.sourceCategory === 'electricity_grid' ? 'SCOPE_2' : null)
      return {
        source: String(it.emissionSource || 'GHG source'),
        scope,
        tco2e: num(it.estTco2e),
        gj: 0,
        quantity: num(it.activityQuantity),
        unit: String(it.unit || ''),
        energy: false,
        renewable: false,
        grid: it.sourceCategory === 'electricity_grid' || isGridSource(it.emissionSource),
        /* kWh lets us detect a Level 3 grid entry that repeats the Level 1 one. */
        ...({ gridKwh: num(it.electricityKwh) } as any),
      }
    })
  }

  const d = (rec.data || {}) as Record<string, any>
  const lines: RawLine[] = []
  const pairs: Array<[string, SiteScope]> = [
    ['scope1', 'SCOPE_1'],
    ['scope2', 'SCOPE_2'],
    ['scope3', 'SCOPE_3'],
  ]
  for (const [key, scope] of pairs) {
    const v = num(d[key])
    if (v > 0) {
      lines.push({
        source: `Direct emissions (${scope.replace('_', ' ')})`, scope, tco2e: v, gj: 0,
        quantity: v, unit: 'tCO2e', energy: false, renewable: false, grid: false,
      })
    }
  }
  return lines
}

function waterLines(rec: LevelRecord): RawLine[] {
  const items = Array.isArray(rec.data?.items) ? rec.data.items : []
  if (items.length) {
    return items.map((it: any) => ({
      source: String(it.waterSource || 'Water source'),
      scope: null,
      tco2e: 0,
      gj: 0,
      quantity: num(it.waterQuantity),
      unit: String(it.unit || 'kL'),
      energy: false, renewable: false, grid: false,
      ...({ recycled: num(it.waterReusedRecycled) } as any),
    }))
  }
  const d = (rec.data || {}) as Record<string, any>
  const parts: Array<[string, number]> = [
    ['Groundwater', num(d.groundwaterKl)],
    ['Surface water', num(d.surfaceWaterKl)],
    ['Municipal supply', num(d.municipalKl)],
    ['Tankers', num(d.tankerKl)],
  ]
  return parts
    .filter(([, v]) => v > 0)
    .map(([name, v]) => ({
      source: name, scope: null, tco2e: 0, gj: 0, quantity: v, unit: 'kL',
      energy: false, renewable: false, grid: false,
    }))
}

function wasteLines(rec: LevelRecord): RawLine[] {
  const items = Array.isArray(rec.data?.items) ? rec.data.items : []
  if (items.length) {
    return items.map((it: any) => ({
      source: String(it.wasteCategory || 'Waste category'),
      scope: null,
      tco2e: 0,
      gj: 0,
      quantity: num(it.quantityGenerated),
      unit: String(it.unit || 'MT'),
      energy: false, renewable: false, grid: false,
      ...({
        recovered: num(it.quantityRecycled) + num(it.quantityRecovered) + num(it.quantityReused),
        hazardous: /hazard/i.test(String(it.wasteCategory || '')) ? num(it.quantityGenerated) : 0,
      } as any),
    }))
  }
  const d = (rec.data || {}) as Record<string, any>
  const haz = num(d.hazardousMt)
  const nonHaz = num(d.nonHazardousMt)
  const lines: RawLine[] = []
  if (haz > 0) {
    lines.push({
      source: 'Hazardous waste', scope: null, tco2e: 0, gj: 0, quantity: haz, unit: 'MT',
      energy: false, renewable: false, grid: false, ...({ recovered: 0, hazardous: haz } as any),
    })
  }
  if (nonHaz > 0) {
    lines.push({
      source: 'Non-hazardous waste', scope: null, tco2e: 0, gj: 0, quantity: nonHaz, unit: 'MT',
      energy: false, renewable: false, grid: false, ...({ recovered: 0, hazardous: 0 } as any),
    })
  }
  return lines
}

function linesForRecord(rec: LevelRecord): RawLine[] {
  const module = String(rec.module || '').toUpperCase()
  if (module === 'ENERGY') return energyLines(rec)
  if (module === 'EMISSIONS') return emissionLines(rec)
  if (module === 'WATER') return waterLines(rec)
  if (module === 'WASTE') return wasteLines(rec)
  return []
}

/* ── roll-up ─────────────────────────────────────────────────────────────── */

function addLine(t: SiteTotals, line: SiteLine) {
  if (line.scope === 'SCOPE_1') t.scope1 += line.tco2e
  else if (line.scope === 'SCOPE_2') t.scope2 += line.tco2e
  else if (line.scope === 'SCOPE_3') t.scope3 += line.tco2e

  if (line.energy) {
    t.energyGJ += line.gj
    if (line.renewable) t.renewableGJ += line.gj
    if (line.grid) {
      t.gridElectricityGJ += line.gj
      t.gridElectricityTco2e += line.tco2e
    }
  }
  t.itemCount += 1
}

function finalise(t: SiteTotals): SiteTotals {
  t.totalEmissions = t.scope1 + t.scope2 + t.scope3
  t.renewableShare = t.energyGJ > 0 ? (t.renewableGJ / t.energyGJ) * 100 : 0
  t.waterRecycledShare = t.waterWithdrawalKL > 0 ? (t.waterRecycledKL / t.waterWithdrawalKL) * 100 : 0
  t.wasteRecycledShare = t.wasteGeneratedT > 0 ? (t.wasteRecoveredT / t.wasteGeneratedT) * 100 : 0
  return t
}

/**
 * Aggregate ONE project's own captured data.
 *
 * `onlyApproved` (default true) restricts the returned `totals` to data the
 * Project Admin has approved — the `pending` block always carries whatever is
 * still in flight so the dashboard can say "awaiting approval".
 */
export async function aggregateProjectSiteData(
  projectId: string,
  opts: { onlyApproved?: boolean; periodId?: string } = {},
): Promise<SiteAggregation> {
  const onlyApproved = opts.onlyApproved !== false
  await ensureLevelRecordsLoaded().catch(() => {})

  /* Every captured record counts — DRAFT records simply land in the PENDING
     bucket (they have not been submitted to the Project Admin yet). */
  const records = getLevelRecords(projectId, opts.periodId)

  /* Which level records have been signed off by the review chain? */
  const approvedIds = new Set<string>()
  let submissions: Array<{ id: string; module: string | null; status: string; recordIds: string | null }> = []
  try {
    submissions = await db.submission.findMany({
      where: { projectId },
      select: { id: true, module: true, status: true, recordIds: true },
    })
  } catch {
    submissions = []
  }
  for (const s of submissions) {
    if (!APPROVED_SUBMISSION_STATUSES.has(s.status)) continue
    let ids: string[] = []
    try {
      const parsed = typeof s.recordIds === 'string' ? JSON.parse(s.recordIds || '[]') : s.recordIds
      if (Array.isArray(parsed)) ids = parsed.map(String)
    } catch {}
    for (const id of ids) approvedIds.add(id)
  }

  /* ── first pass: the raw lines per record ──────────────────────────────── */
  interface RecLines { rec: LevelRecord; lines: RawLine[] }
  const recLines: RecLines[] = records.map((rec) => ({ rec, lines: linesForRecord(rec) }))

  /* ── de-duplicate grid electricity captured in BOTH Level 1 and Level 3 ──
     The same purchased electricity is sometimes entered as an energy item
     (Level 1, GJ + computed tCO2e) and again as a Scope 2 GHG activity
     (Level 3). It must be counted ONCE. We treat the two as the same
     quantity only when the energy footprint matches. */
  const level1GridGj = recLines
    .filter((r) => String(r.rec.module).toUpperCase() === 'ENERGY')
    .flatMap((r) => r.lines)
    .filter((l) => l.grid)
    .reduce((s, l) => s + l.gj, 0)

  const lines: SiteLine[] = []
  for (const { rec, lines: raw } of recLines) {
    const state: 'APPROVED' | 'PENDING' = approvedIds.has(rec.id) ? 'APPROVED' : 'PENDING'
    for (const l of raw) {
      /* Skip a Level 3 grid entry that repeats the Level 1 grid quantity. */
      if (!l.energy && l.grid && level1GridGj > 0) {
        const gridKwh = num((l as any).gridKwh)
        const lineGj = gridKwh > 0 ? gridKwh * 0.0036 : NaN
        if (Number.isFinite(lineGj) && Math.abs(lineGj - level1GridGj) <= Math.max(1, level1GridGj * 0.02)) {
          continue
        }
      }
      lines.push({
        ...l,
        recordId: rec.id,
        level: rec.level,
        module: String(rec.module || '').toUpperCase(),
        state,
      })
    }
  }

  /* ── roll-up ───────────────────────────────────────────────────────────── */
  const totals: SiteTotals = { ...EMPTY_TOTALS }
  const pending: SiteTotals = { ...EMPTY_TOTALS }
  const byPeriod: SiteAggregation['byPeriod'] = {}

  for (const line of lines) {
    const target = line.state === 'APPROVED' ? totals : pending
    addLine(target, line)

    /* Water & waste quantities live on the line itself. */
    if (line.module === 'WATER') {
      target.waterWithdrawalKL += line.quantity
      target.waterRecycledKL += num((line as any).recycled)
    }
    if (line.module === 'WASTE') {
      target.wasteGeneratedT += line.quantity
      target.wasteRecoveredT += num((line as any).recovered)
      target.hazardousWasteT += num((line as any).hazardous)
    }
  }

  const emissionsBySource: Record<string, number> = {}
  for (const line of lines) {
    if (line.state !== 'APPROVED') continue
    if (line.tco2e <= 0) continue
    emissionsBySource[line.source] = round2((emissionsBySource[line.source] ?? 0) + line.tco2e)
  }

  /* Per-period trend lines (approved data only). */
  const periodByRecord = new Map<string, string>()
  for (const rec of records) periodByRecord.set(rec.id, rec.reportingPeriodId)
  const periodLabelById = new Map<string, string>()
  try {
    const periods = await db.reportingPeriod.findMany({ select: { id: true, periodLabel: true } })
    for (const p of periods) periodLabelById.set(p.id, p.periodLabel)
  } catch {}

  for (const line of lines) {
    if (line.state !== 'APPROVED') continue
    const periodId = periodByRecord.get(line.recordId)
    if (!periodId) continue
    const label = periodLabelById.get(periodId) ?? periodId
    const bucket = (byPeriod[label] ??= { emissions: 0, energy: 0, water: 0, waste: 0, scope1: 0, scope2: 0, scope3: 0 })
    if (line.scope === 'SCOPE_1') bucket.scope1 += line.tco2e
    else if (line.scope === 'SCOPE_2') bucket.scope2 += line.tco2e
    else if (line.scope === 'SCOPE_3') bucket.scope3 += line.tco2e
    if (line.scope) bucket.emissions += line.tco2e
    if (line.energy) bucket.energy += line.gj
    if (line.module === 'WATER') bucket.water += line.quantity
    if (line.module === 'WASTE') bucket.waste += line.quantity
  }
  for (const key of Object.keys(byPeriod)) {
    const b = byPeriod[key]
    b.emissions = round2(b.emissions)
    b.energy = round2(b.energy)
    b.water = round2(b.water)
    b.waste = round2(b.waste)
    b.scope1 = round2(b.scope1)
    b.scope2 = round2(b.scope2)
    b.scope3 = round2(b.scope3)
  }

  const approvedRecords = records.filter((r) => approvedIds.has(r.id)).length

  return {
    projectId,
    totals: finalise(totals),
    pending: finalise(pending),
    lines,
    emissionsBySource,
    byPeriod,
    records: records.length,
    approvedRecords,
    pendingRecords: records.length - approvedRecords,
  }
}

/** Convenience: the reported (approved) totals for a project. */
export async function getProjectSiteTotals(projectId: string, opts?: { periodId?: string }) {
  const agg = await aggregateProjectSiteData(projectId, opts)
  return { totals: agg.totals, pending: agg.pending, agg }
}
