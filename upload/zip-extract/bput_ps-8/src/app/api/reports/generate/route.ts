import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, userHasPermission } from '@/lib/session'

export const runtime = 'nodejs'

const ALLOWED_TYPES = ['ESG_SUMMARY', 'EMISSIONS', 'ENERGY', 'WATER', 'WASTE', 'WORKFORCE', 'SAFETY', 'AUDIT_PACKAGE', 'BRSR_ANNEXURE_I']

// POST /api/reports/generate — generate a real report from DB data.
// Body: { reportType, frameworkId, reportingYear, periodLabel, scopeType, scopeId, scopeName }
// Permission: report.generate (also audit.read for AUDIT_PACKAGE).
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  try {
    const canGenerate = await userHasPermission(user.id, 'report.generate')
    if (!canGenerate) {
      return NextResponse.json({ error: 'Forbidden — report.generate required' }, { status: 403 })
    }

    const body = await req.json()
    const reportType = String(body.reportType ?? '').toUpperCase()
    if (!ALLOWED_TYPES.includes(reportType)) {
      return NextResponse.json({ error: `Invalid reportType. Allowed: ${ALLOWED_TYPES.join(', ')}` }, { status: 400 })
    }
    if (reportType === 'AUDIT_PACKAGE') {
      const canAudit = await userHasPermission(user.id, 'audit.read')
      if (!canAudit) {
        return NextResponse.json({ error: 'Forbidden — audit.read required for AUDIT_PACKAGE' }, { status: 403 })
      }
    }

    const frameworkId = body.frameworkId ? String(body.frameworkId) : null
    const reportingYear = body.reportingYear ? Number(body.reportingYear) : null
    const periodLabel = body.periodLabel ? String(body.periodLabel) : null
    const scopeType = body.scopeType ? String(body.scopeType) : null
    const scopeId = body.scopeId ? String(body.scopeId) : null
    const scopeName = body.scopeName ? String(body.scopeName) : null

    // Build source-record filters
    const projectFilter = scopeType === 'PROJECT' && scopeId ? { projectId: scopeId } : {}
    // period filter: limit to ReportingPeriod rows for the requested reportingYear
    let periodIds: string[] = []
    if (reportingYear) {
      const periods = await db.reportingPeriod.findMany({
        where: { reportingYear: { year: reportingYear } },
        select: { id: true },
      })
      periodIds = periods.map(p => p.id)
    }
    const periodFilter = periodIds.length > 0 ? { reportingPeriodId: { in: periodIds } } : {}

    let content: Record<string, unknown> = {}

    switch (reportType) {
      case 'EMISSIONS':
        content = await buildEmissionsContent(projectFilter, periodFilter)
        break
      case 'ENERGY':
        content = await buildEnergyContent(projectFilter, periodFilter)
        break
      case 'WATER':
        content = await buildWaterContent(projectFilter, periodFilter)
        break
      case 'WASTE':
        content = await buildWasteContent(projectFilter, periodFilter)
        break
      case 'WORKFORCE':
        content = await buildWorkforceContent(projectFilter, periodFilter)
        break
      case 'SAFETY':
        content = await buildSafetyContent(projectFilter, periodFilter)
        break
      case 'AUDIT_PACKAGE':
        content = await buildAuditPackageContent()
        break
      case 'BRSR_ANNEXURE_I':
      case 'ESG_SUMMARY':
      default:
        content = await buildEsgSummaryContent(projectFilter, periodFilter, frameworkId)
        break
    }

    // Determine next version (don't overwrite historical reports).
    const whereClause: { reportType: string; frameworkId?: string; reportingYear?: number; scopeId?: string | null } = {
      reportType,
    }
    if (frameworkId) whereClause.frameworkId = frameworkId
    if (reportingYear) whereClause.reportingYear = reportingYear
    if (scopeId) whereClause.scopeId = scopeId
    const last = await db.report.findFirst({
      where: whereClause,
      orderBy: { version: 'desc' },
      select: { version: true },
    })
    const nextVersion = (last?.version ?? 0) + 1
    const safeScope = scopeName ?? scopeId ?? 'group'
    const isPdfType = reportType === 'BRSR_ANNEXURE_I' || reportType === 'ESG_SUMMARY'
    const fileName = isPdfType
      ? `MEIL-BRSR-Annexure-I-FY${reportingYear ?? 2026}-v${nextVersion}.pdf`
      : `${reportType}-${reportingYear ?? 'current'}-${safeScope.replace(/\s+/g, '-')}-v${nextVersion}.csv`

    const report = await db.report.create({
      data: {
        reportType,
        frameworkId,
        reportingYear,
        periodLabel,
        scopeType,
        scopeId,
        scopeName,
        generatedBy: user.id,
        generatedByName: user.name,
        status: 'COMPLETED',
        fileName,
        fileType: isPdfType ? 'PDF' : 'CSV',
        content: JSON.stringify(content),
        version: nextVersion,
      },
    })

    // Audit REPORT_GENERATE.
    await db.auditLog.create({
      data: {
        actorId: user.id,
        actorName: user.name,
        actorRole: user.roles.map(r => r.name).join(', '),
        action: 'REPORT_GENERATE',
        entityType: 'Report',
        entityId: report.id,
        newState: JSON.stringify({ reportType, frameworkId, reportingYear, version: nextVersion, fileName }),
        reason: `${reportType} report v${nextVersion} generated for ${safeScope}`,
      },
    })

    return NextResponse.json({ report, content })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to generate report', detail: String(e?.message ?? e) }, { status: 500 })
  }
}

// ============================================================
// Report content builders — all resolved from real DB records.
// ============================================================

async function buildEmissionsContent(projectFilter: Record<string, unknown>, periodFilter: Record<string, unknown>) {
  const records = await db.energyRecord.findMany({
    where: { ...projectFilter, ...periodFilter, status: { in: ['APPROVED', 'LOCKED'] } },
    include: { calculationResults: true, project: true },
  })
  const calcs = records.flatMap(r => r.calculationResults)
  const scope1 = calcs.filter(c => c.scope === 'SCOPE_1').reduce((s, c) => s + c.calculatedValue, 0)
  const scope2 = calcs.filter(c => c.scope === 'SCOPE_2').reduce((s, c) => s + c.calculatedValue, 0)
  const scope3 = calcs.filter(c => c.scope === 'SCOPE_3').reduce((s, c) => s + c.calculatedValue, 0)
  const total = scope1 + scope2 + scope3
  return {
    meta: { generatedAt: new Date().toISOString(), unit: 'tCO2e', sourceRecords: records.length },
    totals: {
      scope1: round2(scope1),
      scope2: round2(scope2),
      scope3: round2(scope3),
      total: round2(total),
    },
    byProject: records.map(r => ({
      project: r.project?.projectName ?? null,
      source: r.source,
      scope: r.calculationResults[0]?.scope ?? null,
      emissions: round2(r.calculationResults.reduce((s, c) => s + c.calculatedValue, 0)),
      factorVersion: r.calculationResults[0]?.factorVersion ?? null,
    })),
  }
}

async function buildEnergyContent(projectFilter: Record<string, unknown>, periodFilter: Record<string, unknown>) {
  const records = await db.energyRecord.findMany({
    where: { ...projectFilter, ...periodFilter, status: { in: ['APPROVED', 'LOCKED'] } },
    include: { project: true, reportingPeriod: true },
  })
  const totalGJ = records.reduce((s, r) => s + (r.normalizedValue || 0), 0)
  const renewableGJ = records.filter(r => r.sourceCategory === 'RENEWABLE').reduce((s, r) => s + (r.normalizedValue || 0), 0)
  return {
    meta: { generatedAt: new Date().toISOString(), unit: 'GJ', sourceRecords: records.length },
    totals: {
      totalGJ: round2(totalGJ),
      renewableGJ: round2(renewableGJ),
      renewableSharePct: round3(totalGJ > 0 ? (renewableGJ / totalGJ) * 100 : 0),
    },
    bySource: groupBy(records, r => r.source, r => r.normalizedValue || 0),
    byProject: records.map(r => ({
      project: r.project?.projectName ?? null,
      period: r.reportingPeriod?.periodLabel ?? null,
      source: r.source,
      category: r.sourceCategory,
      quantity: r.quantity,
      sourceUnit: r.sourceUnit,
      normalizedGJ: round2(r.normalizedValue || 0),
    })),
  }
}

async function buildWaterContent(projectFilter: Record<string, unknown>, periodFilter: Record<string, unknown>) {
  const records = await db.waterRecord.findMany({
    where: { ...projectFilter, ...periodFilter, status: { in: ['APPROVED', 'LOCKED'] } },
    include: { project: true, reportingPeriod: true },
  })
  const withdrawal = records.reduce((s, r) => s + r.withdrawal, 0)
  const recycled = records.reduce((s, r) => s + (r.recycledReused || 0), 0)
  return {
    meta: { generatedAt: new Date().toISOString(), unit: 'KL', sourceRecords: records.length },
    totals: {
      withdrawal: round2(withdrawal),
      consumption: round2(records.reduce((s, r) => s + (r.consumption || 0), 0)),
      discharge: round2(records.reduce((s, r) => s + (r.discharge || 0), 0)),
      recycledReused: round2(recycled),
      recycledSharePct: round3(withdrawal > 0 ? (recycled / withdrawal) * 100 : 0),
      zldProjects: records.filter(r => r.zldActive).map(r => r.projectId).filter((v, i, a) => a.indexOf(v) === i).length,
    },
    bySource: groupBy(records, r => r.source, r => r.withdrawal),
    byProject: records.map(r => ({
      project: r.project?.projectName ?? null,
      period: r.reportingPeriod?.periodLabel ?? null,
      source: r.source,
      withdrawal: r.withdrawal,
      recycledReused: r.recycledReused || 0,
      waterStress: r.waterStress,
      zldActive: r.zldActive,
      unit: r.sourceUnit,
    })),
  }
}

async function buildWasteContent(projectFilter: Record<string, unknown>, periodFilter: Record<string, unknown>) {
  const records = await db.wasteRecord.findMany({
    where: { ...projectFilter, ...periodFilter, status: { in: ['APPROVED', 'LOCKED'] } },
    include: { project: true, reportingPeriod: true },
  })
  const generated = records.reduce((s, r) => s + (r.generatedQty || 0), 0)
  const recovered = records.reduce((s, r) => s + (r.recoveredQty || r.recycledQty || 0), 0)
  const hazardous = records.filter(r => r.hazardous).reduce((s, r) => s + (r.generatedQty || 0), 0)
  return {
    meta: { generatedAt: new Date().toISOString(), unit: 'T', sourceRecords: records.length },
    totals: {
      generated: round2(generated),
      recovered: round2(recovered),
      recoveredSharePct: round3(generated > 0 ? (recovered / generated) * 100 : 0),
      hazardous: round2(hazardous),
      nonHazardous: round2(generated - hazardous),
    },
    byType: groupBy(records, r => r.wasteType, r => r.generatedQty || 0),
    byProject: records.map(r => ({
      project: r.project?.projectName ?? null,
      period: r.reportingPeriod?.periodLabel ?? null,
      wasteType: r.wasteType,
      hazardous: r.hazardous,
      generatedQty: r.generatedQty,
      recoveredQty: r.recoveredQty || 0,
      recycledQty: r.recycledQty || 0,
      disposedQty: r.disposedQty || 0,
      disposalRoute: r.disposalRoute,
      vendor: r.vendor,
      manifestRef: r.manifestRef,
      unit: r.sourceUnit,
    })),
  }
}

async function buildWorkforceContent(projectFilter: Record<string, unknown>, periodFilter: Record<string, unknown>) {
  const records = await db.workforceRecord.findMany({
    where: { ...projectFilter, ...periodFilter, status: { in: ['APPROVED', 'LOCKED'] } },
    include: { project: true, reportingPeriod: true },
  })
  const employees = records.filter(r => r.category === 'EMPLOYEE')
  const workers = records.filter(r => r.category === 'WORKER')
  const totalEmp = employees.reduce((s, r) => s + r.permanent + r.nonPermanent, 0)
  const totalWrk = workers.reduce((s, r) => s + r.permanent + r.nonPermanent, 0)
  const female = records.reduce((s, r) => s + r.female, 0)
  const total = totalEmp + totalWrk
  return {
    meta: { generatedAt: new Date().toISOString(), unit: 'count', sourceRecords: records.length },
    totals: {
      employees: totalEmp,
      workers: totalWrk,
      total: total,
      permanent: records.reduce((s, r) => s + r.permanent, 0),
      nonPermanent: records.reduce((s, r) => s + r.nonPermanent, 0),
      female,
      male: records.reduce((s, r) => s + r.male, 0),
      femaleSharePct: round3(total > 0 ? (female / total) * 100 : 0),
      differentlyAbled: records.reduce((s, r) => s + (r.differentlyAbled || 0), 0),
      newHires: records.reduce((s, r) => s + (r.newHires || 0), 0),
      exits: records.reduce((s, r) => s + (r.exits || 0), 0),
      trainingHours: round2(records.reduce((s, r) => s + (r.trainingHours || 0), 0)),
    },
    byProject: records.map(r => ({
      project: r.project?.projectName ?? null,
      period: r.reportingPeriod?.periodLabel ?? null,
      category: r.category,
      permanent: r.permanent,
      nonPermanent: r.nonPermanent,
      male: r.male,
      female: r.female,
      other: r.other || 0,
      differentlyAbled: r.differentlyAbled || 0,
      newHires: r.newHires || 0,
      exits: r.exits || 0,
      trainingHours: r.trainingHours || 0,
    })),
  }
}

async function buildSafetyContent(projectFilter: Record<string, unknown>, periodFilter: Record<string, unknown>) {
  const records = await db.safetyRecord.findMany({
    where: { ...projectFilter, ...periodFilter, status: { in: ['APPROVED', 'LOCKED'] } },
    include: { project: true, reportingPeriod: true },
  })
  const fatalities = records.reduce((s, r) => s + r.fatalities, 0)
  const lti = records.reduce((s, r) => s + r.lostTimeIncidents, 0)
  const manHours = records.reduce((s, r) => s + (r.manHoursWorked || 0), 0)
  return {
    meta: { generatedAt: new Date().toISOString(), sourceRecords: records.length },
    totals: {
      fatalities,
      injuries: records.reduce((s, r) => s + r.injuries, 0),
      lostTimeIncidents: lti,
      recordableInjuries: records.reduce((s, r) => s + r.recordableInjuries, 0),
      highConsequenceIncidents: records.reduce((s, r) => s + r.highConsequenceIncidents, 0),
      manHoursWorked: round2(manHours),
      ltifr: round3(manHours > 0 ? (lti * 1000000) / manHours : 0),
      trainingHours: round2(records.reduce((s, r) => s + (r.trainingHours || 0), 0)),
    },
    byProject: records.map(r => ({
      project: r.project?.projectName ?? null,
      period: r.reportingPeriod?.periodLabel ?? null,
      recordType: r.recordType,
      fatalities: r.fatalities,
      injuries: r.injuries,
      lostTimeIncidents: r.lostTimeIncidents,
      recordableInjuries: r.recordableInjuries,
      manHoursWorked: r.manHoursWorked || 0,
      trainingHours: r.trainingHours || 0,
      correctiveActions: r.correctiveActions,
    })),
  }
}

async function buildAuditPackageContent() {
  const logs = await db.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 1000, // cap to a reasonable audit window
  })
  return {
    meta: { generatedAt: new Date().toISOString(), logCount: logs.length },
    logs: logs.map(l => ({
      id: l.id,
      actorId: l.actorId,
      actorName: l.actorName,
      actorRole: l.actorRole,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      reason: l.reason,
      oldState: l.oldState,
      newState: l.newState,
      metadata: l.metadata,
      ipAddress: l.ipAddress,
      createdAt: l.createdAt,
    })),
  }
}

async function buildEsgSummaryContent(
  projectFilter: Record<string, unknown>,
  periodFilter: Record<string, unknown>,
  frameworkId: string | null
) {
  const [emissions, energy, water, waste, workforce, safety] = await Promise.all([
    buildEmissionsContent(projectFilter, periodFilter),
    buildEnergyContent(projectFilter, periodFilter),
    buildWaterContent(projectFilter, periodFilter),
    buildWasteContent(projectFilter, periodFilter),
    buildWorkforceContent(projectFilter, periodFilter),
    buildSafetyContent(projectFilter, periodFilter),
  ])
  let brsr: { overall: number; ready: number; total: number } | null = null
  if (frameworkId) {
    const answers = await db.brsrAnswer.findMany({ where: { frameworkId } })
    const ready = answers.filter(a => ['APPROVED', 'LOCKED', 'EVIDENCE_VERIFIED'].includes(a.status)).length
    brsr = {
      overall: answers.length > 0 ? Math.round((ready / answers.length) * 1000) / 10 : 0,
      ready,
      total: answers.length,
    }
  }
  return {
    meta: { generatedAt: new Date().toISOString(), frameworkId },
    modules: { emissions, energy, water, waste, workforce, safety },
    brsr,
    trace: { note: 'ESG summary compiled server-side from approved source records. No hardcoded content.' },
  }
}

// ---------- utils ----------
function round2(n: number): number {
  return Math.round(n * 100) / 100
}
function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}
function groupBy<T>(arr: T[], key: (t: T) => string, val: (t: T) => number): Record<string, number> {
  const out: Record<string, number> = {}
  for (const t of arr) {
    const k = key(t) || 'UNKNOWN'
    out[k] = (out[k] || 0) + val(t)
  }
  for (const k of Object.keys(out)) out[k] = round2(out[k])
  return out
}
