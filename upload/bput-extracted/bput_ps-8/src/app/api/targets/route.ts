import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export const runtime = 'nodejs'

// GET /api/targets — sustainability targets vs actuals.
// Targets are computed as a configured % reduction/improvement from the
// previous reporting period's actuals (a common ESG target-setting approach).
// This is illustrative configuration — in production these would be admin-configured.
const TARGET_RATES: Record<string, { reduction: number; goodDirection: 'down' | 'up'; unit: string }> = {
  emissions: { reduction: 0.05, goodDirection: 'down', unit: 'tCO₂e' },   // 5% YoY reduction
  energy: { reduction: 0.03, goodDirection: 'down', unit: 'GJ' },          // 3% reduction
  water: { reduction: 0.04, goodDirection: 'down', unit: 'KL' },           // 4% reduction
  wasteRecovery: { reduction: 0.05, goodDirection: 'up', unit: '%' },      // 5% improvement
  renewableShare: { reduction: 0.10, goodDirection: 'up', unit: '%' },     // 10% improvement
  femaleShare: { reduction: 0.05, goodDirection: 'up', unit: '%' },        // 5% improvement
  ltifr: { reduction: 0.20, goodDirection: 'down', unit: '/M hrs' },      // 20% reduction
  brsrReadiness: { reduction: 0.15, goodDirection: 'up', unit: '%' },      // 15% improvement
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const periods = await db.reportingPeriod.findMany({ orderBy: { startDate: 'asc' } })
  if (periods.length < 2) {
    return NextResponse.json({ targets: [], note: 'Insufficient periods for target baseline' })
  }

  const current = periods[periods.length - 1]
  const baseline = periods[periods.length - 2]

  // Compute actuals for current + baseline periods
  const [curEnergy, baseEnergy] = await Promise.all([
    db.energyRecord.findMany({ where: { reportingPeriodId: current.id }, include: { calculationResults: true } }),
    db.energyRecord.findMany({ where: { reportingPeriodId: baseline.id }, include: { calculationResults: true } }),
  ])
  const [curWater, baseWater] = await Promise.all([
    db.waterRecord.findMany({ where: { reportingPeriodId: current.id } }),
    db.waterRecord.findMany({ where: { reportingPeriodId: baseline.id } }),
  ])
  const [curWaste, baseWaste] = await Promise.all([
    db.wasteRecord.findMany({ where: { reportingPeriodId: current.id } }),
    db.wasteRecord.findMany({ where: { reportingPeriodId: baseline.id } }),
  ])

  // Current actuals
  const curEmissions = curEnergy.flatMap(e => e.calculationResults).reduce((s, c) => s + (c.calculatedValue || 0), 0)
  const curEnergyGJ = curEnergy.reduce((s, e) => s + (e.normalizedValue || 0), 0)
  const curRenewableGJ = curEnergy.filter(e => e.sourceCategory === 'RENEWABLE').reduce((s, e) => s + (e.normalizedValue || 0), 0)
  const curRenewableShare = curEnergyGJ > 0 ? (curRenewableGJ / curEnergyGJ) * 100 : 0
  const curWaterKL = curWater.reduce((s, w) => s + (w.withdrawal || 0), 0)
  const curWasteGen = curWaste.reduce((s, w) => s + (w.generatedQty || 0), 0)
  const curWasteRec = curWaste.reduce((s, w) => s + (w.recoveredQty || w.recycledQty || 0), 0)
  const curWasteRecovery = curWasteGen > 0 ? (curWasteRec / curWasteGen) * 100 : 0

  // Workforce + safety (current period)
  const curWorkforce = await db.workforceRecord.findMany({ where: { reportingPeriodId: current.id } })
  const curTotalWf = curWorkforce.reduce((s, w) => s + w.permanent + w.nonPermanent, 0)
  const curFemale = curWorkforce.reduce((s, w) => s + w.female, 0)
  const curFemaleShare = curTotalWf > 0 ? (curFemale / curTotalWf) * 100 : 0
  const curSafety = await db.safetyRecord.findMany({ where: { reportingPeriodId: current.id } })
  const curLti = curSafety.reduce((s, x) => s + x.lostTimeIncidents, 0)
  const curManHours = curSafety.reduce((s, x) => s + (x.manHoursWorked || 0), 0)
  const curLtifr = curManHours > 0 ? (curLti * 1000000) / curManHours : 0

  // BRSR readiness
  const brsrAnswers = await db.brsrAnswer.findMany()
  const readyCount = brsrAnswers.filter(a => a.status === 'APPROVED' || a.status === 'LOCKED' || a.status === 'EVIDENCE_VERIFIED').length
  const curBrsr = brsrAnswers.length > 0 ? (readyCount / brsrAnswers.length) * 100 : 0

  // Baseline actuals (for setting targets)
  const baseEmissions = baseEnergy.flatMap(e => e.calculationResults).reduce((s, c) => s + (c.calculatedValue || 0), 0)
  const baseEnergyGJ = baseEnergy.reduce((s, e) => s + (e.normalizedValue || 0), 0)
  const baseRenewableGJ = baseEnergy.filter(e => e.sourceCategory === 'RENEWABLE').reduce((s, e) => s + (e.normalizedValue || 0), 0)
  const baseRenewableShare = baseEnergyGJ > 0 ? (baseRenewableGJ / baseEnergyGJ) * 100 : 0
  const baseWaterKL = baseWater.reduce((s, w) => s + (w.withdrawal || 0), 0)
  const baseWasteGen = baseWaste.reduce((s, w) => s + (w.generatedQty || 0), 0)
  const baseWasteRec = baseWaste.reduce((s, w) => s + (w.recoveredQty || w.recycledQty || 0), 0)
  const baseWasteRecovery = baseWasteGen > 0 ? (baseWasteRec / baseWasteGen) * 100 : 0

  // Build targets: for 'down' metrics, target = baseline * (1 - reduction); for 'up' metrics, target = baseline + (100 - baseline) * reduction (capped) or baseline * (1 + reduction)
  const targets = [
    buildTarget('Scope 1+2 Emissions', 'emissions', curEmissions, baseEmissions, TARGET_RATES.emissions, 'flame'),
    buildTarget('Energy Consumption', 'energy', curEnergyGJ, baseEnergyGJ, TARGET_RATES.energy, 'zap'),
    buildTarget('Water Withdrawal', 'water', curWaterKL, baseWaterKL, TARGET_RATES.water, 'droplet'),
    buildTarget('Waste Recovery Rate', 'wasteRecovery', curWasteRecovery, baseWasteRecovery, TARGET_RATES.wasteRecovery, 'recycle'),
    buildTarget('Renewable Energy Share', 'renewableShare', curRenewableShare, baseRenewableShare, TARGET_RATES.renewableShare, 'sun'),
    buildTarget('Female Workforce Share', 'femaleShare', curFemaleShare, 0, TARGET_RATES.femaleShare, 'users'),
    buildTarget('Safety LTIFR', 'ltifr', curLtifr, 0, TARGET_RATES.ltifr, 'shield'),
    buildTarget('BRSR Readiness', 'brsrReadiness', curBrsr, curBrsr - 5, TARGET_RATES.brsrReadiness, 'check'),
  ]

  return NextResponse.json({
    currentPeriod: current.periodLabel,
    baselinePeriod: baseline.periodLabel,
    targets,
    trace: { note: 'Targets derived from previous-period baseline × configured reduction rate. Illustrative configuration.' },
  })
}

function buildTarget(label: string, key: string, actual: number, baseline: number, cfg: { reduction: number; goodDirection: 'down' | 'up'; unit: string }, icon: string) {
  let target: number
  if (cfg.goodDirection === 'down') {
    target = baseline * (1 - cfg.reduction)
  } else {
    // For % metrics, target = baseline + (100 - baseline) * reduction (capped at 100)
    // For others, target = baseline * (1 + reduction)
    target = baseline <= 100 && cfg.unit === '%' ? baseline + (100 - baseline) * cfg.reduction : baseline * (1 + cfg.reduction)
  }
  const gap = cfg.goodDirection === 'down' ? actual - target : target - actual
  const onTrack = cfg.goodDirection === 'down' ? actual <= target : actual >= target
  const pctOfTarget = target > 0 ? Math.min((actual / target) * 100, 999) : 0
  return {
    label, key, icon,
    actual: Math.round(actual * 100) / 100,
    target: Math.round(target * 100) / 100,
    baseline: Math.round(baseline * 100) / 100,
    gap: Math.round(gap * 100) / 100,
    onTrack,
    pctOfTarget: Math.round(pctOfTarget * 10) / 10,
    goodDirection: cfg.goodDirection,
    unit: cfg.unit,
    reductionPct: Math.round(cfg.reduction * 100),
  }
}
