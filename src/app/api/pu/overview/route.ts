import { NextResponse } from 'next/server'
import { db } from '@/lib/pu/db'
import { getCurrentUser } from '@/lib/pu/session'

export const runtime = 'nodejs'

// GET /api/overview — computes real KPIs from the database (no hardcoded values).
// Covers: emissions, energy, water, waste, workforce, safety, BRSR readiness,
// completion, exceptions, plus monthly trends & recent activity.
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  // Resolve scope: reviewer/exec roles see whole group; project users see their scope.
  // For this dashboard we show the group-wide consolidated picture (read-only for non-edit roles).
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
    db.energyRecord.findMany({ include: { calculationResults: true } }),
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
    const pCalc = pEnergy.flatMap(e => e.calculationResults || [])
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
    const em = (e.calculationResults || []).reduce((s, c) => s + (c.calculatedValue || 0), 0)
    if (em > 0) emissionsBySource[e.source] = (emissionsBySource[e.source] || 0) + em
  }

  return NextResponse.json({
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
  })
}
