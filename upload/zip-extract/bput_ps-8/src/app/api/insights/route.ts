import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import ZAI from 'z-ai-web-dev-sdk'

export const runtime = 'nodejs'

// GET /api/insights — AI-generated narrative insights from real ESG KPI data.
// Uses the LLM skill (z-ai-web-dev-sdk) to produce executive-grade insights.
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  try {
    // Gather real KPI data (same computation as /api/overview, condensed)
    const calcResults = await db.calculationResult.findMany()
    const totalEmissions = calcResults.reduce((s, c) => s + (c.calculatedValue || 0), 0)
    const scope1 = calcResults.filter(c => c.scope === 'SCOPE_1').reduce((s, c) => s + (c.calculatedValue || 0), 0)
    const scope2 = calcResults.filter(c => c.scope === 'SCOPE_2').reduce((s, c) => s + (c.calculatedValue || 0), 0)

    const energyRecords = await db.energyRecord.findMany()
    const totalEnergyGJ = energyRecords.reduce((s, e) => s + (e.normalizedValue || 0), 0)
    const renewableGJ = energyRecords.filter(e => e.sourceCategory === 'RENEWABLE').reduce((s, e) => s + (e.normalizedValue || 0), 0)
    const renewableShare = totalEnergyGJ > 0 ? (renewableGJ / totalEnergyGJ) * 100 : 0

    const waterRecords = await db.waterRecord.findMany()
    const waterWithdrawal = waterRecords.reduce((s, w) => s + (w.withdrawal || 0), 0)
    const waterRecycled = waterRecords.reduce((s, w) => s + (w.recycledReused || 0), 0)
    const waterRecycledShare = waterWithdrawal > 0 ? (waterRecycled / waterWithdrawal) * 100 : 0

    const wasteRecords = await db.wasteRecord.findMany()
    const wasteGenerated = wasteRecords.reduce((s, w) => s + (w.generatedQty || 0), 0)
    const wasteRecovered = wasteRecords.reduce((s, w) => s + (w.recoveredQty || w.recycledQty || 0), 0)
    const wasteRecycledShare = wasteGenerated > 0 ? (wasteRecovered / wasteGenerated) * 100 : 0

    const workforceRecords = await db.workforceRecord.findMany()
    const totalWorkforce = workforceRecords.reduce((s, w) => s + w.permanent + w.nonPermanent, 0)
    const femaleShare = totalWorkforce > 0 ? (workforceRecords.reduce((s, w) => s + w.female, 0) / totalWorkforce) * 100 : 0

    const safetyRecords = await db.safetyRecord.findMany()
    const lti = safetyRecords.reduce((s, x) => s + x.lostTimeIncidents, 0)
    const manHours = safetyRecords.reduce((s, x) => s + (x.manHoursWorked || 0), 0)
    const ltifr = manHours > 0 ? (lti * 1000000) / manHours : 0

    const brsrAnswers = await db.brsrAnswer.findMany()
    const brsrReady = brsrAnswers.filter(a => a.status === 'APPROVED' || a.status === 'LOCKED').length
    const brsrReadiness = brsrAnswers.length > 0 ? (brsrReady / brsrAnswers.length) * 100 : 0
    const brsrMissing = brsrAnswers.filter(a => a.status === 'MISSING').length

    const submissions = await db.submission.findMany()
    const approvedSubs = submissions.filter(s => s.status === 'APPROVED' || s.status === 'LOCKED').length
    const draftSubs = submissions.filter(s => s.status === 'DRAFT').length

    const openExceptions = await db.validationResult.count({ where: { status: 'OPEN', severity: { in: ['ERROR', 'BLOCKING'] } } })

    // Monthly trends
    const periods = await db.reportingPeriod.findMany({ orderBy: { startDate: 'asc' } })
    const trends: { period: string; emissions: number; energy: number }[] = []
    for (const p of periods) {
      const pEnergy = await db.energyRecord.findMany({ where: { reportingPeriodId: p.id }, include: { calculationResults: true } })
      const pCalc = pEnergy.flatMap(e => e.calculationResults)
      trends.push({
        period: p.periodLabel,
        emissions: Math.round(pCalc.reduce((s, c) => s + (c.calculatedValue || 0), 0) * 100) / 100,
        energy: Math.round(pEnergy.reduce((s, e) => s + (e.normalizedValue || 0), 0) * 100) / 100,
      })
    }

    // Build the data context for the LLM
    const dataContext = {
      reportingYear: 'FY 2026-27',
      kpis: {
        totalEmissions: Math.round(totalEmissions * 100) / 100,
        scope1: Math.round(scope1 * 100) / 100,
        scope2: Math.round(scope2 * 100) / 100,
        energyGJ: Math.round(totalEnergyGJ * 100) / 100,
        renewableShare: Math.round(renewableShare * 10) / 10,
        waterWithdrawalKL: Math.round(waterWithdrawal * 10) / 10,
        waterRecycledShare: Math.round(waterRecycledShare * 10) / 10,
        wasteRecycledShare: Math.round(wasteRecycledShare * 10) / 10,
        totalWorkforce,
        femaleShare: Math.round(femaleShare * 10) / 10,
        ltifr: Math.round(ltifr * 100) / 100,
        brsrReadiness: Math.round(brsrReadiness * 10) / 10,
        brsrMissing,
        approvedSubs,
        draftSubs,
        openExceptions,
      },
      trends,
    }

    // Generate insights using the LLM
    const zai = await ZAI.create()
    const systemPrompt = `You are an expert ESG/Sustainability analyst for MEIL Group. Analyze the provided ESG data and generate 3-4 concise, actionable executive insights. Each insight must have:
- a "title" (short, 5-8 words)
- a "severity" field: "positive" | "warning" | "critical"
- a "category" field: "emissions" | "energy" | "water" | "waste" | "social" | "governance" | "data_quality"
- an "insight" field (1-2 sentences explaining the finding and its implication)
- an "action" field (a specific recommended action, 1 sentence)

Focus on: month-over-month trends, ESG performance gaps, compliance risks, and improvement opportunities. Be specific with numbers from the data. Do NOT use placeholders.

Respond with ONLY a JSON object: {"insights": [...]}`
    const userPrompt = `Analyze this ESG data and generate insights:\n\n${JSON.stringify(dataContext, null, 2)}`

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      thinking: { type: 'disabled' },
    })

    const content = completion.choices[0]?.message?.content || ''
    let insights
    try {
      // Extract JSON from the response (handle markdown code fences)
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      insights = jsonMatch ? JSON.parse(jsonMatch[0]) : { insights: [] }
    } catch {
      insights = { insights: [{ title: 'Analysis complete', severity: 'positive', category: 'data_quality', insight: content.slice(0, 200), action: 'Review the full dashboard for details.' }] }
    }

    return NextResponse.json({
      insights: insights.insights || [],
      generatedAt: new Date().toISOString(),
      dataSource: 'real-time KPIs from approved source records + calculation results',
    })
  } catch (e: any) {
    console.error('Insights API error:', e)
    return NextResponse.json({
      insights: [{
        title: 'Insights temporarily unavailable',
        severity: 'warning' as const,
        category: 'data_quality' as const,
        insight: 'The AI insight engine could not process the current data. All KPIs remain available on the dashboard.',
        action: 'Refresh the page to retry, or review the KPI cards directly.',
      }],
      error: e.message,
    })
  }
}
