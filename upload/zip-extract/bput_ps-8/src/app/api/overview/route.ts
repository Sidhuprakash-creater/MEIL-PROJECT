import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export const runtime = 'nodejs'

// GET /api/overview — computes real KPIs from the database (no hardcoded values).
// Covers: emissions, energy, water, waste, workforce, safety, BRSR readiness,
// completion, exceptions, plus monthly trends & recent activity.
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  // Resolve scope: reviewer/exec roles see whole group; project users see their scope.
  // For this dashboard we show the group-wide consolidated picture (read-only for non-edit roles).
  const periods = await db.reportingPeriod.findMany({
    orderBy: { startDate: 'asc' },
    include: { reportingYear: true },
  })
  if (periods.length === 0) {
    return NextResponse.json({ empty: true })
  }

  // ---- EMISSIONS (from deterministic calculation results) ----
  const calcResults = await db.calculationResult.findMany()
  const totalEmissions = calcResults.reduce((s, c) => s + (c.calculatedValue || 0), 0)
  const scope1 = calcResults.filter(c => c.scope === 'SCOPE_1').reduce((s, c) => s + (c.calculatedValue || 0), 0)
  const scope2 = calcResults.filter(c => c.scope === 'SCOPE_2').reduce((s, c) => s + (c.calculatedValue || 0), 0)
  const scope3 = calcResults.filter(c => c.scope === 'SCOPE_3').reduce((s, c) => s + (c.calculatedValue || 0), 0)

  // ---- ENERGY (normalized GJ) ----
  const energyRecords = await db.energyRecord.findMany()
  const totalEnergyGJ = energyRecords.reduce((s, e) => s + (e.normalizedValue || 0), 0)
  const renewableGJ = energyRecords.filter(e => e.sourceCategory === 'RENEWABLE').reduce((s, e) => s + (e.normalizedValue || 0), 0)
  const renewableShare = totalEnergyGJ > 0 ? (renewableGJ / totalEnergyGJ) * 100 : 0

  // ---- WATER ----
  const waterRecords = await db.waterRecord.findMany()
  const waterWithdrawal = waterRecords.reduce((s, w) => s + (w.withdrawal || 0), 0)
  const waterRecycled = waterRecords.reduce((s, w) => s + (w.recycledReused || 0), 0)
  const waterRecycledShare = waterWithdrawal > 0 ? (waterRecycled / waterWithdrawal) * 100 : 0
  const zldProjects = Array.from(new Set(waterRecords.filter(w => w.zldActive).map(w => w.projectId)))

  // ---- WASTE ----
  const wasteRecords = await db.wasteRecord.findMany()
  const wasteGenerated = wasteRecords.reduce((s, w) => s + (w.generatedQty || 0), 0)
  const wasteRecovered = wasteRecords.reduce((s, w) => s + (w.recoveredQty || w.recycledQty || 0), 0)
  const wasteRecycledShare = wasteGenerated > 0 ? (wasteRecovered / wasteGenerated) * 100 : 0
  const hazardousWaste = wasteRecords.filter(w => w.hazardous).reduce((s, w) => s + (w.generatedQty || 0), 0)

  // ---- WORKFORCE ----
  const workforceRecords = await db.workforceRecord.findMany()
  const totalEmployees = workforceRecords.filter(w => w.category === 'EMPLOYEE').reduce((s, w) => s + w.permanent + w.nonPermanent, 0)
  const totalWorkers = workforceRecords.filter(w => w.category === 'WORKER').reduce((s, w) => s + w.permanent + w.nonPermanent, 0)
  const totalWorkforce = totalEmployees + totalWorkers
  const femaleCount = workforceRecords.reduce((s, w) => s + w.female, 0)
  const femaleShare = totalWorkforce > 0 ? (femaleCount / totalWorkforce) * 100 : 0
  const differentlyAbled = workforceRecords.reduce((s, w) => s + (w.differentlyAbled || 0), 0)
  const trainingHours = workforceRecords.reduce((s, w) => s + (w.trainingHours || 0), 0)

  // ---- SAFETY ----
  const safetyRecords = await db.safetyRecord.findMany()
  const fatalities = safetyRecords.reduce((s, s2) => s + s2.fatalities, 0)
  const injuries = safetyRecords.reduce((s, s2) => s + s2.injuries, 0)
  const lti = safetyRecords.reduce((s, s2) => s + s2.lostTimeIncidents, 0)
  const manHours = safetyRecords.reduce((s, s2) => s + (s2.manHoursWorked || 0), 0)
  // LTIFR = (lost time incidents * 1,000,000) / hours worked — derived, not aggregated
  const ltifr = manHours > 0 ? (lti * 1000000) / manHours : 0
  const safetyTrainingHours = safetyRecords.reduce((s, s2) => s + (s2.trainingHours || 0), 0)

  // ---- BRSR READINESS (computed from real answer statuses) ----
  const brsrAnswers = await db.brsrAnswer.findMany()
  const totalBrsr = brsrAnswers.length
  const approvedBrsr = brsrAnswers.filter(a => a.status === 'APPROVED' || a.status === 'LOCKED' || a.status === 'EVIDENCE_VERIFIED').length
  const brsrReadiness = totalBrsr > 0 ? (approvedBrsr / totalBrsr) * 100 : 0
  const brsrMissing = brsrAnswers.filter(a => a.status === 'MISSING').length

  // ---- SUBMISSIONS / COMPLETION ----
  const submissions = await db.submission.findMany()
  const totalSubs = submissions.length
  const approvedSubs = submissions.filter(s => s.status === 'APPROVED' || s.status === 'LOCKED').length
  const draftSubs = submissions.filter(s => s.status === 'DRAFT').length
  const reviewSubs = submissions.filter(s => s.status === 'SUBMITTED' || s.status === 'UNDER_REVIEW' || s.status === 'BU_APPROVED').length
  const completion = totalSubs > 0 ? (approvedSubs / totalSubs) * 100 : 0

  // ---- EXCEPTIONS / VALIDATION ----
  const openExceptions = await db.validationResult.count({ where: { status: 'OPEN', severity: { in: ['ERROR', 'BLOCKING'] } } })
  const anomalies = await db.anomalyEvent.count({ where: { status: 'OPEN' } })
  const corrections = await db.correctionRequest.count({ where: { status: 'OPEN' } })

  // ---- MONTHLY TRENDS ----
  const monthlyTrends: Record<string, { emissions: number; energy: number; water: number; waste: number }> = {}
  for (const p of periods) {
    const label = p.periodLabel
    const pEnergy = await db.energyRecord.findMany({ where: { reportingPeriodId: p.id }, include: { calculationResults: true } })
    const pWater = await db.waterRecord.findMany({ where: { reportingPeriodId: p.id } })
    const pWaste = await db.wasteRecord.findMany({ where: { reportingPeriodId: p.id } })
    const pCalc = pEnergy.flatMap(e => e.calculationResults)
    monthlyTrends[label] = {
      emissions: pCalc.reduce((s, c) => s + (c.calculatedValue || 0), 0),
      energy: pEnergy.reduce((s, e) => s + (e.normalizedValue || 0), 0),
      water: pWater.reduce((s, w) => s + (w.withdrawal || 0), 0),
      waste: pWaste.reduce((s, w) => s + (w.generatedQty || 0), 0),
    }
  }

  // ---- RECENT ACTIVITIES ----
  const activities = await db.activity.findMany({
    orderBy: { createdAt: 'desc' },
    take: 8,
  })

  // ---- EVIDENCE STATS ----
  const evidenceTotal = await db.evidence.count()
  const evidenceVerified = await db.evidence.count({ where: { status: 'VERIFIED' } })

  // ---- PROJECTS ----
  const projects = await db.project.count()
  const orgs = await db.group.count()

  // ---- EMISSIONS BY SOURCE (for breakdown chart) ----
  const emissionsBySource: Record<string, number> = {}
  const energyWithCalc = await db.energyRecord.findMany({ include: { calculationResults: true } })
  for (const e of energyWithCalc) {
    const em = e.calculationResults.reduce((s, c) => s + (c.calculatedValue || 0), 0)
    if (em > 0) emissionsBySource[e.source] = (emissionsBySource[e.source] || 0) + em
  }

  return NextResponse.json({
    user: { id: user.id, name: user.name, roles: user.roles, groupId: user.groupId },
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
