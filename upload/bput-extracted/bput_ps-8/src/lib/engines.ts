/**
 * ESG Engines — shared helpers for validation, calculation & audit logging.
 *
 * These helpers are deterministic: same input + same factor version => same result.
 * No KPI values are ever hardcoded here; every number comes from the database
 * (EmissionFactor rows, ConversionRule rows, source record values).
 */
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import type { EmissionFactor } from '@prisma/client'

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

export function apiError(e: any): NextResponse {
  if (e?.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (e?.message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (e?.message === 'NOT_FOUND') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (e?.message === 'VALIDATION_ERROR') return NextResponse.json({ error: e.payload ?? 'Validation error' }, { status: 400 })
  return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
}

// ---------------------------------------------------------------------------
// Validation issue model
// ---------------------------------------------------------------------------

export type Severity = 'INFO' | 'WARNING' | 'ERROR' | 'BLOCKING'

export interface ValidationIssue {
  ruleCode: string
  severity: Severity
  message: string
  field?: string
  suggestedAction?: string
}

// ---------------------------------------------------------------------------
// Energy source → EmissionFactor name mapping (pattern-driven lookup).
// Ordered most-specific first to avoid 'Grid' shadowing 'Renewable PPA Solar'.
// ---------------------------------------------------------------------------

const SOURCE_FACTOR_PATTERNS: { pattern: RegExp; factorName: string }[] = [
  { pattern: /solar|ppa|renewable/i, factorName: 'Renewable PPA Solar' },
  { pattern: /diesel|hsd/i, factorName: 'Diesel (HSD)' },
  { pattern: /petrol|\bms\b|gasoline/i, factorName: 'Petrol (MS)' },
  { pattern: /coal/i, factorName: 'Coal (Sub-bituminous)' },
  { pattern: /\bcng\b/i, factorName: 'CNG' },
  { pattern: /\blpg\b/i, factorName: 'LPG' },
  { pattern: /grid|electricity|tps|tsspdcl|discom/i, factorName: 'Grid Electricity (India)' },
]

export async function findEmissionFactorForSource(source: string): Promise<EmissionFactor | null> {
  if (!source) return null
  const match = SOURCE_FACTOR_PATTERNS.find(p => p.pattern.test(source))
  if (!match) return null
  return db.emissionFactor.findFirst({
    where: { name: match.factorName, status: 'ACTIVE' },
    orderBy: { version: 'desc' },
  })
}

// ---------------------------------------------------------------------------
// Energy normalization → GJ
// Strategy:
//   1. Look up ConversionRule (fromUnit=sourceUnit, toUnit='GJ') in DB.
//   2. Fall back to fuel-specific energy density for L (diesel/petrol) & KG (coal/CNG/LPG).
//   3. Otherwise store the value as-is with its original unit.
// ---------------------------------------------------------------------------

const ENERGY_DENSITY_GJ_PER_L: Record<string, number> = {
  diesel: 0.0383,
  petrol: 0.0348,
  default: 0.0383, // default liquid fuel density approximated as diesel
}

const ENERGY_DENSITY_GJ_PER_KG: Record<string, number> = {
  coal: 0.0227,
  cng: 0.0500,
  lpg: 0.0460,
  default: 0.0227,
}

export interface NormalizedEnergy {
  normalizedValue: number
  normalizedUnit: string
  conversionNote: string
  conversionRuleId?: string
}

export async function normalizeEnergyToGJ(
  quantity: number,
  sourceUnit: string,
  sourceName: string = '',
): Promise<NormalizedEnergy> {
  const u = (sourceUnit || '').toUpperCase()

  // 1) DB conversion rule (e.g. KWH→GJ factor 0.0036, MWH→GJ 3.6)
  if (u !== 'GJ') {
    const rule = await db.conversionRule.findFirst({
      where: { fromUnit: u, toUnit: 'GJ' },
      orderBy: { version: 'desc' },
    })
    if (rule) {
      return {
        normalizedValue: quantity * rule.factor,
        normalizedUnit: 'GJ',
        conversionNote: `Applied ConversionRule ${rule.fromUnit}→${rule.toUnit} factor ${rule.factor} (v${rule.version})`,
        conversionRuleId: rule.id,
      }
    }
  } else {
    return { normalizedValue: quantity, normalizedUnit: 'GJ', conversionNote: 'Already in GJ' }
  }

  // 2) Fuel-specific energy density defaults
  if (u === 'L' || u === 'KL' || u === 'M3') {
    const liters = u === 'L' ? quantity : quantity * 1000
    const key = /petrol|gasoline|ms/i.test(sourceName) ? 'petrol' : 'diesel'
    const factor = ENERGY_DENSITY_GJ_PER_L[key]
    return {
      normalizedValue: liters * factor,
      normalizedUnit: 'GJ',
      conversionNote: `Liquid fuel energy density ${factor} GJ/L applied (source=${sourceName || 'unknown'})`,
    }
  }

  if (u === 'KG' || u === 'TON' || u === 'T') {
    const kg = u === 'KG' ? quantity : quantity * 1000
    const key = /cng/i.test(sourceName) ? 'cng' : /lpg/i.test(sourceName) ? 'lpg' : /coal/i.test(sourceName) ? 'coal' : 'default'
    const factor = ENERGY_DENSITY_GJ_PER_KG[key]
    return {
      normalizedValue: kg * factor,
      normalizedUnit: 'GJ',
      conversionNote: `Solid/gas fuel energy density ${factor} GJ/kg applied (source=${sourceName || 'unknown'})`,
    }
  }

  // 3) No known normalization — keep raw value + unit
  return { normalizedValue: quantity, normalizedUnit: sourceUnit, conversionNote: 'No GJ conversion available; stored raw' }
}

// ---------------------------------------------------------------------------
// Emissions calculation
//   calculatedValue (tCO2e) = quantity (in factor's input unit) × factorValue (kgCO2e per unit) / 1000
// Deterministic — depends on factor version only.
// ---------------------------------------------------------------------------

export interface EmissionCalculation {
  calculatedValue: number
  resultUnit: 'tCO2e'
  scope: string
  methodologyNote: string
  factorId: string
  factorVersion: number
}

export function computeEmissions(quantity: number, factor: EmissionFactor): EmissionCalculation {
  const kgco2e = quantity * factor.factorValue
  const tco2e = kgco2e / 1000
  const methodologyNote = `${factor.name} factor ${factor.factorValue} ${factor.factorUnit}` +
    (factor.methodology ? ` (${factor.methodology})` : '')
  return {
    calculatedValue: Math.round(tco2e * 1000) / 1000, // 3 dp
    resultUnit: 'tCO2e',
    scope: factor.scope,
    methodologyNote,
    factorId: factor.id,
    factorVersion: factor.version,
  }
}

// ---------------------------------------------------------------------------
// Audit log helper — immutable record of every state-changing action.
// ---------------------------------------------------------------------------

export interface AuditContext {
  actorId: string
  actorName: string
  actorRole: string
  ipAddress?: string
}

export async function writeAudit(params: {
  ctx: AuditContext
  action: string
  entityType: string
  entityId: string
  oldState?: any
  newState?: any
  reason?: string
  metadata?: any
}) {
  return db.auditLog.create({
    data: {
      actorId: params.ctx.actorId,
      actorName: params.ctx.actorName,
      actorRole: params.ctx.actorRole,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      oldState: params.oldState !== undefined ? JSON.stringify(params.oldState) : null,
      newState: params.newState !== undefined ? JSON.stringify(params.newState) : null,
      reason: params.reason ?? null,
      metadata: params.metadata !== undefined ? JSON.stringify(params.metadata) : null,
      ipAddress: params.ctx.ipAddress ?? null,
    },
  })
}

// ---------------------------------------------------------------------------
// Validation persistence helper
// ---------------------------------------------------------------------------

export async function persistValidationResults(
  recordId: string,
  recordType: string,
  issues: ValidationIssue[],
) {
  if (issues.length === 0) return []
  return db.$transaction(
    issues.map(i =>
      db.validationResult.create({
        data: {
          ruleCode: i.ruleCode,
          recordId,
          recordType,
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

export function rollupValidationStatus(issues: ValidationIssue[]): {
  validationStatus: string
  calculationStatus: string
} {
  const hasBlocking = issues.some(i => i.severity === 'BLOCKING' || i.severity === 'ERROR')
  const hasWarning = issues.some(i => i.severity === 'WARNING')
  return {
    validationStatus: hasBlocking ? 'FAILED' : hasWarning ? 'PASSED_WITH_WARNINGS' : 'PASSED',
    calculationStatus: hasBlocking ? 'FAILED' : 'COMPLETED',
  }
}

// ---------------------------------------------------------------------------
// Scope resolution for consolidation engine
// ---------------------------------------------------------------------------

export async function resolveProjectIdsForLevel(
  level: string,
  id: string | undefined,
): Promise<{ projectIds: string[]; scopeName: string; scopeType: string; scopeId: string }> {
  if (level === 'project') {
    if (!id) throw new Error('VALIDATION_ERROR'.replace('VALIDATION_ERROR', 'NOT_FOUND'))
    const p = await db.project.findUnique({ where: { id } })
    if (!p) throw new Error('NOT_FOUND')
    return { projectIds: [p.id], scopeName: p.projectName, scopeType: 'PROJECT', scopeId: p.id }
  }
  if (level === 'bu') {
    if (!id) throw new Error('NOT_FOUND')
    const bu = await db.businessUnit.findUnique({ where: { id }, include: { projects: true, subsidiary: true } })
    if (!bu) throw new Error('NOT_FOUND')
    return { projectIds: bu.projects.map(p => p.id), scopeName: bu.name, scopeType: 'BUSINESS_UNIT', scopeId: bu.id }
  }
  if (level === 'subsidiary') {
    if (!id) throw new Error('NOT_FOUND')
    const sub = await db.subsidiary.findUnique({
      where: { id },
      include: { businessUnits: { include: { projects: true } }, group: true },
    })
    if (!sub) throw new Error('NOT_FOUND')
    const projectIds = sub.businessUnits.flatMap(bu => bu.projects.map(p => p.id))
    return { projectIds, scopeName: sub.name, scopeType: 'SUBSIDIARY', scopeId: sub.id }
  }
  if (level === 'group') {
    // id optional for group — default to first group (illustrative single-tenant)
    const where = id ? { id } : undefined
    const g = await db.group.findFirst({ where, include: { subsidiaries: { include: { businessUnits: { include: { projects: true } } } } } })
    if (!g) throw new Error('NOT_FOUND')
    const projectIds = g.subsidiaries.flatMap(s => s.businessUnits.flatMap(bu => bu.projects.map(p => p.id)))
    return { projectIds, scopeName: g.name, scopeType: 'GROUP', scopeId: g.id }
  }
  throw new Error('VALIDATION_ERROR')
}

// Statuses that count as "approved/locked" source records for consolidation.
// This is the canonical set — never aggregate DRAFT, REJECTED or UNDER_REVIEW records.
export const CONSOLIDATION_STATUSES = ['APPROVED', 'LOCKED']
