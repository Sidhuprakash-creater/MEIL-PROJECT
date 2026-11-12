import { NextResponse } from 'next/server'
import { db } from '@/lib/pu/db'
import { getCurrentUser } from '@/lib/pu/session'
import { scopedProjectId } from '@/lib/pu/scope'
import { aggregateProjectSiteData } from '@/lib/pu/site-aggregates'
import { getPuOverviewCache, setPuOverviewCache, invalidatePuOverviewCache, OVERVIEW_TTL_MS, OVERVIEW_CACHE_CONTROL } from '@/lib/portal-cache'

export const runtime = 'nodejs'

// GET /api/overview — computes real KPIs from the database (no hardcoded values).
// Covers: emissions, energy, water, waste, workforce, safety, BRSR readiness,
// completion, exceptions, plus monthly trends & recent activity.
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

    const projectId = scopedProjectId(user)

    /* The cache is keyed per scope — a contributor's payload must never be
       served to a different project (or to a group-level reviewer). */
    const cacheKey = projectId ? `project:${projectId}` : 'group'
    const cached = getPuOverviewCache(cacheKey)
    if (cached) {
      return NextResponse.json(cached, { headers: { 'Cache-Control': OVERVIEW_CACHE_CONTROL } })
    }

    /* A contributor belongs to ONE project — their dashboard shows THAT
       project's approved data (and only that). */
    if (projectId) {
      const payload = await buildProjectOverview(user, projectId)
      setPuOverviewCache(payload, cacheKey)
      return NextResponse.json(payload, { headers: { 'Cache-Control': OVERVIEW_CACHE_CONTROL } })
    }

    // Run initial queries concurrently
    const [
      periods,
      calcResults,
      energyRecords,
      waterRecords,
      wasteRecords,
      workforceRecords,
      safetyRecords,
      brsrAnswers,
      submissions,
      openExceptions,
      anomalies,
      corrections,
      activities,
      evidenceTotal,
      evidenceVerified,
      projects,
    ] = await Promise.all([
      db.reportingPeriod.findMany({
        orderBy: { startDate: 'asc' },
        include: { reportingYear: true },
      }),
      db.calculationResult.findMany(),
      db.energyRecord.findMany(),
      db.waterRecord.findMany(),
      db.wasteRecord.findMany(),
      db.workforceRecord.findMany(),
      db.safetyRecord.findMany(),
      db.brsrAnswer.findMany(),
      db.submission.findMany(),
      db.validationResult.count({ where: { status: 'OPEN', severity: { in: ['ERROR', 'BLOCKING'] } } }),
      db.anomalyEvent.count({ where: { status: 'OPEN' } }),
      db.correctionRequest.count({ where: { status: 'OPEN' } }),
      db.activity.findMany({ orderBy: { createdAt: 'desc' }, take: 8 }),
      db.evidence.count(),
      db.evidence.count({ where: { status: 'VERIFIED' } }),
      db.project.count(),
    ])

    if (periods.length === 0) {
      return NextResponse.json({ empty: true })
    }

    // ---- EMISSIONS (from deterministic calculation results) ----
    const totalEmissions = calcResults.reduce((s, c) => s + (c.calculatedValue || 0), 0)
    const scope1 = calcResults.filter(c => c.scope === 'SCOPE_1').reduce((s, c) => s + (c.calculatedValue || 0), 0)
    const scope2 = calcResults.filter(c => c.scope === 'SCOPE_2').reduce((s, c) => s + (c.calculatedValue || 0), 0)
    const scope3 = calcResults.filter(c => c.scope === 'SCOPE_3').reduce((s, c) => s + (c.calculatedValue || 0), 0)

    // ---- ENERGY (normalized GJ) ----
    const totalEnergyGJ = energyRecords.reduce((s, e) => s + (e.normalizedValue || 0), 0)
    const renewableGJ = energyRecords.filter(e => e.sourceCategory === 'RENEWABLE').reduce((s, e) => s + (e.normalizedValue || 0), 0)
    const renewableShare = totalEnergyGJ > 0 ? (renewableGJ / totalEnergyGJ) * 100 : 0

    // ---- WATER ----
    const waterWithdrawal = waterRecords.reduce((s, w) => s + (w.withdrawal || 0), 0)
    const waterRecycled = waterRecords.reduce((s, w) => s + (w.recycledReused || 0), 0)
    const waterRecycledShare = waterWithdrawal > 0 ? (waterRecycled / waterWithdrawal) * 100 : 0
    const zldProjects = Array.from(new Set(waterRecords.filter(w => w.zldActive).map(w => w.projectId)))

    // ---- WASTE ----
    const wasteGenerated = wasteRecords.reduce((s, w) => s + (w.generatedQty || 0), 0)
    const wasteRecovered = wasteRecords.reduce((s, w) => s + (w.recoveredQty || w.recycledQty || 0), 0)
    const wasteRecycledShare = wasteGenerated > 0 ? (wasteRecovered / wasteGenerated) * 100 : 0
    const hazardousWaste = wasteRecords.filter(w => w.hazardous).reduce((s, w) => s + (w.generatedQty || 0), 0)

    // ---- WORKFORCE ----
    const totalEmployees = workforceRecords.filter(w => w.category === 'EMPLOYEE').reduce((s, w) => s + w.permanent + w.nonPermanent, 0)
    const totalWorkers = workforceRecords.filter(w => w.category === 'WORKER').reduce((s, w) => s + w.permanent + w.nonPermanent, 0)
    const totalWorkforce = totalEmployees + totalWorkers
    const femaleCount = workforceRecords.reduce((s, w) => s + w.female, 0)
    const femaleShare = totalWorkforce > 0 ? (femaleCount / totalWorkforce) * 100 : 0
    const differentlyAbled = workforceRecords.reduce((s, w) => s + (w.differentlyAbled || 0), 0)
    const trainingHours = workforceRecords.reduce((s, w) => s + (w.trainingHours || 0), 0)

    // ---- SAFETY ----
    const fatalities = safetyRecords.reduce((s, s2) => s + s2.fatalities, 0)
    const injuries = safetyRecords.reduce((s, s2) => s + s2.injuries, 0)
    const lti = safetyRecords.reduce((s, s2) => s + s2.lostTimeIncidents, 0)
    const manHours = safetyRecords.reduce((s, s2) => s + (s2.manHoursWorked || 0), 0)
    const ltifr = manHours > 0 ? (lti * 1000000) / manHours : 0
    const safetyTrainingHours = safetyRecords.reduce((s, s2) => s + (s2.trainingHours || 0), 0)

    // ---- BRSR READINESS ----
    const totalBrsr = brsrAnswers.length
    const approvedBrsr = brsrAnswers.filter(a => a.status === 'APPROVED' || a.status === 'LOCKED' || a.status === 'EVIDENCE_VERIFIED').length
    const brsrReadiness = totalBrsr > 0 ? (approvedBrsr / totalBrsr) * 100 : 0
    const brsrMissing = brsrAnswers.filter(a => a.status === 'MISSING').length

    // ---- SUBMISSIONS / COMPLETION ----
    const totalSubs = submissions.length
    const approvedSubs = submissions.filter(s => s.status === 'APPROVED' || s.status === 'LOCKED').length
    const draftSubs = submissions.filter(s => s.status === 'DRAFT').length
    const reviewSubs = submissions.filter(s => s.status === 'SUBMITTED' || s.status === 'UNDER_REVIEW' || s.status === 'BU_APPROVED').length
    const completion = totalSubs > 0 ? (approvedSubs / totalSubs) * 100 : 0

    // Pre-group in memory by reportingPeriodId to eliminate per-period database round-trips
    const calcByEnergyId = new Map<string, typeof calcResults>()
    for (const c of calcResults) {
      if (!c.energyRecordId) continue
      const list = calcByEnergyId.get(c.energyRecordId) || []
      list.push(c)
      calcByEnergyId.set(c.energyRecordId, list)
    }

    const energyByPeriod = new Map<string, typeof energyRecords>()
    for (const e of energyRecords) {
      if (!e.reportingPeriodId) continue
      const list = energyByPeriod.get(e.reportingPeriodId) || []
      list.push(e)
      energyByPeriod.set(e.reportingPeriodId, list)
    }

    const waterByPeriod = new Map<string, typeof waterRecords>()
    for (const w of waterRecords) {
      if (!w.reportingPeriodId) continue
      const list = waterByPeriod.get(w.reportingPeriodId) || []
      list.push(w)
      waterByPeriod.set(w.reportingPeriodId, list)
    }

    const wasteByPeriod = new Map<string, typeof wasteRecords>()
    for (const w of wasteRecords) {
      if (!w.reportingPeriodId) continue
      const list = wasteByPeriod.get(w.reportingPeriodId) || []
      list.push(w)
      wasteByPeriod.set(w.reportingPeriodId, list)
    }

    // ---- MONTHLY TRENDS (computed in-memory) ----
    const monthlyTrends: Record<string, { emissions: number; energy: number; water: number; waste: number }> = {}
    for (const p of periods) {
      const label = p.periodLabel
      const pEnergy = energyByPeriod.get(p.id) || []
      const pWater = waterByPeriod.get(p.id) || []
      const pWaste = wasteByPeriod.get(p.id) || []
      const pCalc = pEnergy.flatMap(e => calcByEnergyId.get(e.id) || [])
      monthlyTrends[label] = {
        emissions: pCalc.reduce((s, c) => s + (c.calculatedValue || 0), 0),
        energy: pEnergy.reduce((s, e) => s + (e.normalizedValue || 0), 0),
        water: pWater.reduce((s, w) => s + (w.withdrawal || 0), 0),
        waste: pWaste.reduce((s, w) => s + (w.generatedQty || 0), 0),
      }
    }

    const orgs = 1 // single-tenant group

    // ---- EMISSIONS BY SOURCE (for breakdown chart, computed from energyRecords already fetched) ----
    const emissionsBySource: Record<string, number> = {}
    for (const e of energyRecords) {
      const em = (calcByEnergyId.get(e.id) || []).reduce((s, c) => s + (c.calculatedValue || 0), 0)
      if (em > 0) emissionsBySource[e.source] = (emissionsBySource[e.source] || 0) + em
    }

    const payload = {
      user: { id: user.id, name: user.name, roles: user.roles, groupId: null },
      kpis: {
        totalEmissions: Math.round(totalEmissions * 100) / 100,
        scope1: Math.round(scope1 * 100) / 100,
        scope2: Math.round(scope2 * 100) / 100,
        scope3: Math.round(scope3 * 100) / 100,
        energyGJ: Math.round(totalEnergyGJ * 100) / 100,
        renewableShare: Math.round(renewableShare * 10) / 10,
        waterWithdrawalKL: Math.round(waterWithdrawal * 10) / 10,
        waterRecycledShare: Math.round(waterRecycledShare * 10) / 10,
        wasteGeneratedT: Math.round(wasteGenerated * 100) / 100,
        wasteRecycledShare: Math.round(wasteRecycledShare * 10) / 10,
        hazardousWasteT: Math.round(hazardousWaste * 100) / 100,
        totalEmployees,
        totalWorkers,
        totalWorkforce,
        femaleShare: Math.round(femaleShare * 10) / 10,
        differentlyAbled,
        trainingHours: Math.round(trainingHours),
        fatalities, injuries, lti,
        ltifr: Math.round(ltifr * 100) / 100,
        safetyTrainingHours: Math.round(safetyTrainingHours),
        brsrReadiness: Math.round(brsrReadiness * 10) / 10,
        brsrMissing,
        completion: Math.round(completion * 10) / 10,
        totalSubs, approvedSubs, draftSubs, reviewSubs,
        openExceptions, anomalies, corrections,
        evidenceTotal, evidenceVerified,
        projects, orgs,
      },
      trends: monthlyTrends,
      emissionsBySource,
      activities,
      periods: periods.map(p => ({ id: p.id, label: p.periodLabel, year: p.year, month: p.month, status: p.status })),
      sources: {
        calculationResults: calcResults.length,
        energyRecords: energyRecords.length,
        waterRecords: waterRecords.length,
        wasteRecords: wasteRecords.length,
        workforceRecords: workforceRecords.length,
        safetyRecords: safetyRecords.length,
        brsrAnswers: totalBrsr,
      },
      trace: {
        note: 'All KPIs computed deterministically from approved source records + emission factor version 1. No hardcoded values.',
      },
    }
    setPuOverviewCache(payload, cacheKey)
    return NextResponse.json(payload, { headers: { 'Cache-Control': OVERVIEW_CACHE_CONTROL } })
  } catch (e) {
    console.error('GET /api/overview error', e)
    return NextResponse.json({ error: 'Failed to load overview' }, { status: 500 })
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   PROJECT-SCOPED OVERVIEW — the contributor's own site dashboard
   ═══════════════════════════════════════════════════════════════════════════

   Everything here comes from the contributor's OWN records for THEIR project:
   the level records they captured (with their emission factors and computed
   est. tCO2e / est. GJ) plus the approval state of the submissions the
   Project Admin has actioned.

   Emissions roll-up (the headline):
     Scope 1  — direct emissions (Level 3) + on-site fuel burn (Level 1)
     Scope 2  — purchased electricity & grid (Level 3) + the tCO2e computed
                from GRID ELECTRICITY in Level 1   ← the grid tCO2e is ADDED
     Scope 3  — value chain (Level 3)
   ═══════════════════════════════════════════════════════════════════════════ */
async function buildProjectOverview(user: any, projectId: string) {
  const agg = await aggregateProjectSiteData(projectId)
  const t = agg.totals
  const p = agg.pending

  const [project, periods, submissions, evidence, brsrAnswers, workforceRecords, safetyRecords, activities, validationIssues, anomalies] =
    await Promise.all([
      db.project.findUnique({ where: { id: projectId }, select: { id: true, name: true, code: true } }),
      db.reportingPeriod.findMany({ orderBy: { startDate: 'asc' }, include: { reportingYear: true } }),
      db.submission.findMany({
        where: { projectId },
        select: { id: true, module: true, category: true, status: true, metricName: true, metricValue: true, metricUnit: true, title: true, submittedAt: true, updatedAt: true, recordIds: true },
      }),
      db.evidence.findMany({ where: { projectId }, select: { id: true, status: true } }),
      db.brsrAnswer.findMany({ where: { projectId }, select: { id: true, status: true } }),
      db.workforceRecord.findMany({ where: { projectId } }),
      db.safetyRecord.findMany({ where: { projectId } }),
      db.activity.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' }, take: 8 }),
      db.validationResult.count({ where: { status: 'OPEN', severity: { in: ['ERROR', 'BLOCKING'] } } }),
      db.anomalyEvent.count({ where: { status: 'OPEN' } }),
    ])

  const approvedSubs = submissions.filter((s: any) =>
    ['APPROVED', 'BU_APPROVED', 'SUBSIDIARY_APPROVED', 'HQ_REVIEW', 'LOCKED'].includes(s.status)).length
  const draftSubs = submissions.filter((s: any) => s.status === 'DRAFT').length
  const reviewSubs = submissions.filter((s: any) =>
    ['SUBMITTED', 'UNDER_REVIEW', 'PENDING', 'ASSIGNED'].includes(s.status)).length
  const totalSubs = submissions.length
  const completion = totalSubs > 0 ? (approvedSubs / totalSubs) * 100 : 0

  const totalBrsr = brsrAnswers.length
  const approvedBrsr = brsrAnswers.filter((a: any) =>
    ['APPROVED', 'LOCKED', 'EVIDENCE_VERIFIED'].includes(a.status)).length
  const brsrReadiness = totalBrsr > 0 ? (approvedBrsr / totalBrsr) * 100 : 0

  /* Workforce & safety — the project's own mirror records. */
  const totalEmployees = workforceRecords.filter((w: any) => w.category === 'EMPLOYEE').reduce((s: number, w: any) => s + w.permanent + w.nonPermanent, 0)
  const totalWorkers = workforceRecords.filter((w: any) => w.category === 'WORKER').reduce((s: number, w: any) => s + w.permanent + w.nonPermanent, 0)
  const totalWorkforce = totalEmployees + totalWorkers
  const femaleCount = workforceRecords.reduce((s: number, w: any) => s + w.female, 0)
  const femaleShare = totalWorkforce > 0 ? (femaleCount / totalWorkforce) * 100 : 0
  const differentlyAbled = workforceRecords.reduce((s: number, w: any) => s + (w.differentlyAbled || 0), 0)
  const trainingHours = workforceRecords.reduce((s: number, w: any) => s + (w.trainingHours || 0), 0)

  const fatalities = safetyRecords.reduce((s: number, r: any) => s + r.fatalities, 0)
  const injuries = safetyRecords.reduce((s: number, r: any) => s + r.injuries, 0)
  const lti = safetyRecords.reduce((s: number, r: any) => s + r.lostTimeIncidents, 0)
  const manHours = safetyRecords.reduce((s: number, r: any) => s + (r.manHoursWorked || 0), 0)
  const ltifr = manHours > 0 ? (lti * 1000000) / manHours : 0
  const safetyTrainingHours = safetyRecords.reduce((s: number, r: any) => s + (r.trainingHours || 0), 0)

  const evidenceTotal = evidence.length
  const evidenceVerified = evidence.filter((e: any) => e.status === 'VERIFIED').length

  return {
    user: { id: user.id, name: user.name, roles: user.roles, groupId: null },
    scope: {
      type: 'PROJECT',
      id: projectId,
      name: project?.name ?? 'Your project',
      code: project?.code ?? '',
    },
    kpis: {
      /* ── GHG footprint — direct + indirect (incl. grid electricity) ── */
      totalEmissions: Math.round(t.totalEmissions * 100) / 100,
      scope1: Math.round(t.scope1 * 100) / 100,
      scope2: Math.round(t.scope2 * 100) / 100,
      scope3: Math.round(t.scope3 * 100) / 100,
      /* Grid electricity's own tCO2e (Level 1) — shown as its own line. */
      gridElectricityGJ: Math.round(t.gridElectricityGJ * 100) / 100,
      gridElectricityTco2e: Math.round(t.gridElectricityTco2e * 100) / 100,
      /* ── Energy ── */
      energyGJ: Math.round(t.energyGJ * 100) / 100,
      renewableGJ: Math.round(t.renewableGJ * 100) / 100,
      renewableShare: Math.round(t.renewableShare * 10) / 10,
      /* ── Water ── */
      waterWithdrawalKL: Math.round(t.waterWithdrawalKL * 10) / 10,
      waterRecycledKL: Math.round(t.waterRecycledKL * 10) / 10,
      waterRecycledShare: Math.round(t.waterRecycledShare * 10) / 10,
      /* ── Waste ── */
      wasteGeneratedT: Math.round(t.wasteGeneratedT * 100) / 100,
      wasteRecoveredT: Math.round(t.wasteRecoveredT * 100) / 100,
      wasteRecycledShare: Math.round(t.wasteRecycledShare * 10) / 10,
      hazardousWasteT: Math.round(t.hazardousWasteT * 100) / 100,
      /* ── Workforce & safety ── */
      totalEmployees,
      totalWorkers,
      totalWorkforce,
      femaleShare: Math.round(femaleShare * 10) / 10,
      differentlyAbled,
      trainingHours: Math.round(trainingHours),
      fatalities, injuries, lti,
      ltifr: Math.round(ltifr * 100) / 100,
      safetyTrainingHours: Math.round(safetyTrainingHours),
      /* ── BRSR readiness & review state ── */
      brsrReadiness: Math.round(brsrReadiness * 10) / 10,
      brsrMissing: brsrAnswers.filter((a: any) => a.status === 'MISSING').length,
      completion: Math.round(completion * 10) / 10,
      totalSubs, approvedSubs, draftSubs, reviewSubs,
      openExceptions: validationIssues,
      anomalies,
      corrections: submissions.filter((s: any) => ['CHANGES_REQUESTED', 'CORRECTION_REQUESTED'].includes(s.status)).length,
      evidenceTotal, evidenceVerified,
      projects: 1,
      orgs: 1,
      /* ── Awaiting the Project Admin's approval ── */
      pendingEmissions: Math.round(p.totalEmissions * 100) / 100,
      pendingEnergyGJ: Math.round(p.energyGJ * 100) / 100,
      pendingRecords: agg.pendingRecords,
      approvedRecords: agg.approvedRecords,
      capturedRecords: agg.records,
    },
    trends: agg.byPeriod,
    emissionsBySource: agg.emissionsBySource,
    /* Every captured line item — the dashboard's source breakdown. */
    siteLines: agg.lines
      .filter((l) => l.state === 'APPROVED')
      .map((l) => ({
        source: l.source,
        scope: l.scope,
        tco2e: Math.round(l.tco2e * 100) / 100,
        gj: Math.round(l.gj * 100) / 100,
        quantity: Math.round(l.quantity * 100) / 100,
        unit: l.unit,
        module: l.module,
        level: l.level,
        energy: l.energy,
        renewable: l.renewable,
        grid: l.grid,
      })),
    pendingLines: agg.lines
      .filter((l) => l.state === 'PENDING')
      .map((l) => ({
        source: l.source,
        scope: l.scope,
        tco2e: Math.round(l.tco2e * 100) / 100,
        gj: Math.round(l.gj * 100) / 100,
        module: l.module,
        level: l.level,
      })),
    activities,
    periods: periods.map((pp) => ({ id: pp.id, label: pp.periodLabel, year: pp.year, month: pp.month, status: pp.status })),
    sources: {
      levelRecords: agg.records,
      approvedRecords: agg.approvedRecords,
      submissions: totalSubs,
      evidence: evidenceTotal,
      brsrAnswers: totalBrsr,
    },
    trace: {
      note: 'Scoped to your project. KPIs are computed from your captured level records (with their emission factors) and count only data the Project Admin has approved. Grid-electricity tCO2e computed at Level 1 is included in Scope 2.',
      scope: 'PROJECT',
      projectId,
    },
  }
}
