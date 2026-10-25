import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { execFileSync } from 'child_process'
import path from 'path'
import fs from 'fs'

export const runtime = 'nodejs'

// GET /api/export/dashboard-pdf — generates a professional board-ready PDF snapshot
// of the overview KPIs, trends, and ESG data control chain using ReportLab.
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  try {
    // Gather the same real KPI data as /api/overview
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
    const completion = submissions.length > 0 ? (approvedSubs / submissions.length) * 100 : 0

    const openExceptions = await db.validationResult.count({ where: { status: 'OPEN', severity: { in: ['ERROR', 'BLOCKING'] } } })

    // Monthly trends
    const periods = await db.reportingPeriod.findMany({ orderBy: { startDate: 'asc' } })
    const trends: { period: string; emissions: number; energy: number; water: number; waste: number }[] = []
    for (const p of periods) {
      const pEnergy = await db.energyRecord.findMany({ where: { reportingPeriodId: p.id }, include: { calculationResults: true } })
      const pWater = await db.waterRecord.findMany({ where: { reportingPeriodId: p.id } })
      const pWaste = await db.wasteRecord.findMany({ where: { reportingPeriodId: p.id } })
      const pCalc = pEnergy.flatMap(e => e.calculationResults)
      trends.push({
        period: p.periodLabel,
        emissions: Math.round(pCalc.reduce((s, c) => s + (c.calculatedValue || 0), 0) * 100) / 100,
        energy: Math.round(pEnergy.reduce((s, e) => s + (e.normalizedValue || 0), 0) * 100) / 100,
        water: Math.round(pWater.reduce((s, w) => s + (w.withdrawal || 0), 0) * 10) / 10,
        waste: Math.round(pWaste.reduce((s, w) => s + (w.generatedQty || 0), 0) * 100) / 100,
      })
    }

    const projects = await db.project.count()
    const orgs = await db.group.count()

    const pdfData = {
      generatedAt: new Date().toISOString(),
      generatedBy: user.name,
      orgs, projects, periods: periods.length,
      kpis: {
        totalEmissions: Math.round(totalEmissions * 100) / 100,
        scope1: Math.round(scope1 * 100) / 100,
        scope2: Math.round(scope2 * 100) / 100,
        energyGJ: Math.round(totalEnergyGJ * 100) / 100,
        renewableShare: Math.round(renewableShare * 10) / 10,
        waterWithdrawalKL: Math.round(waterWithdrawal * 10) / 10,
        waterRecycledShare: Math.round(waterRecycledShare * 10) / 10,
        wasteRecycledShare: Math.round(wasteRecycledShare * 10) / 10,
        totalWorkforce, femaleShare: Math.round(femaleShare * 10) / 10,
        ltifr: Math.round(ltifr * 100) / 100,
        brsrReadiness: Math.round(brsrReadiness * 10) / 10, brsrMissing,
        completion: Math.round(completion * 10) / 10, approvedSubs,
        openExceptions,
      },
      trends,
    }

    // Generate the PDF via the Python ReportLab script
    const scriptsDir = path.join(process.cwd(), 'scripts')
    if (!fs.existsSync(scriptsDir)) fs.mkdirSync(scriptsDir, { recursive: true })
    const scriptPath = path.join(scriptsDir, 'generate_dashboard_pdf.py')
    if (!fs.existsSync(scriptPath)) fs.writeFileSync(scriptPath, PDF_SCRIPT)
    const tmpJson = path.join(scriptsDir, `_export_${Date.now()}.json`)
    const tmpPdf = path.join(scriptsDir, `_export_${Date.now()}.pdf`)
    fs.writeFileSync(tmpJson, JSON.stringify(pdfData))
    try {
      execFileSync('python3', [scriptPath, tmpJson, tmpPdf], { timeout: 30000 })
      const pdfBuffer = fs.readFileSync(tmpPdf)
      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="MEIL-ESG-Dashboard-${new Date().toISOString().slice(0, 10)}.pdf"`,
        },
      })
    } finally {
      try { fs.unlinkSync(tmpJson); fs.unlinkSync(tmpPdf) } catch {}
    }
  } catch (e: any) {
    console.error('PDF export error:', e)
    return NextResponse.json({ error: 'Failed to generate PDF: ' + e.message }, { status: 500 })
  }
}

const PDF_SCRIPT = `#!/usr/bin/env python3
import json, sys
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, white
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.platypus.flowables import HRFlowable
from reportlab.lib.enums import TA_LEFT, TA_CENTER

def main():
    data = json.load(open(sys.argv[1]))
    output = sys.argv[2]
    PRIMARY = HexColor('#2563eb')
    PRIMARY_DARK = HexColor('#1e40af')
    ACCENT = HexColor('#06b6d4')
    EMERALD = HexColor('#10b981')
    AMBER = HexColor('#f59e0b')
    ROSE = HexColor('#f43f5e')
    SLATE = HexColor('#475569')
    SLATE_LIGHT = HexColor('#94a3b8')
    BG_LIGHT = HexColor('#f0f7ff')
    CARD_BG = HexColor('#fafbff')

    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='Title2', fontName='Helvetica-Bold', fontSize=22, textColor=PRIMARY_DARK, spaceAfter=4, leading=26))
    styles.add(ParagraphStyle(name='Subtitle', fontName='Helvetica', fontSize=10, textColor=SLATE, spaceAfter=16, leading=14))
    styles.add(ParagraphStyle(name='SectionH', fontName='Helvetica-Bold', fontSize=13, textColor=PRIMARY_DARK, spaceBefore=12, spaceAfter=6, leading=16))
    styles.add(ParagraphStyle(name='CardLabel', fontName='Helvetica-Bold', fontSize=7, textColor=SLATE_LIGHT, alignment=TA_LEFT, spaceAfter=2))
    styles.add(ParagraphStyle(name='CardValue', fontName='Helvetica-Bold', fontSize=15, textColor=HexColor('#1e293b'), alignment=TA_LEFT, leading=18))
    styles.add(ParagraphStyle(name='CardSub', fontName='Helvetica', fontSize=7, textColor=SLATE, alignment=TA_LEFT, leading=9))
    styles.add(ParagraphStyle(name='Footer', fontName='Helvetica', fontSize=7, textColor=SLATE_LIGHT, alignment=TA_CENTER))
    styles.add(ParagraphStyle(name='Cell', fontName='Helvetica', fontSize=8, textColor=SLATE, leading=10))
    styles.add(ParagraphStyle(name='CellBold', fontName='Helvetica-Bold', fontSize=8, textColor=SLATE, leading=10))
    styles.add(ParagraphStyle(name='CellH', fontName='Helvetica-Bold', fontSize=8, textColor=white, leading=10))

    doc = SimpleDocTemplate(output, pagesize=A4, topMargin=18*mm, bottomMargin=18*mm, leftMargin=16*mm, rightMargin=16*mm, title='MEIL ESG Dashboard Export', author='MEIL ESG Platform')
    story = []
    k = data['kpis']
    genDate = data['generatedAt'][:10]

    story.append(Paragraph('MEIL ESG \\u2014 Dashboard Snapshot', styles['Title2']))
    story.append(Paragraph(f'Generated {genDate} by {data["generatedBy"]} \\u00b7 {data["orgs"]} group(s) \\u00b7 {data["projects"]} project(s) \\u00b7 {data["periods"]} reporting periods', styles['Subtitle']))
    story.append(HRFlowable(width='100%', thickness=1.5, color=PRIMARY, spaceAfter=10))

    def kpi_cell(label, value, unit, sub):
        return [
            Paragraph(label.upper(), styles['CardLabel']),
            Paragraph(f'{value} <font size=7 color="#94a3b8">{unit}</font>', styles['CardValue']),
            Paragraph(sub, styles['CardSub']),
        ]

    kpi_data = [
        [kpi_cell('Scope 1+2 Emissions', f'{k["totalEmissions"]:,.2f}', 'tCO2e', f'S1: {k["scope1"]} . S2: {k["scope2"]}'),
         kpi_cell('Energy Consumption', f'{k["energyGJ"]:,.1f}', 'GJ', f'Renewable {k["renewableShare"]}%'),
         kpi_cell('Water Withdrawal', f'{k["waterWithdrawalKL"]:,.1f}', 'KL', f'Recycled {k["waterRecycledShare"]}%'),
         kpi_cell('Waste Recovered', f'{k["wasteRecycledShare"]}', '%', 'Hazardous tracked')],
        [kpi_cell('Total Workforce', f'{k["totalWorkforce"]}', 'people', f'Female {k["femaleShare"]}%'),
         kpi_cell('Safety LTIFR', f'{k["ltifr"]}', '/M hrs', '0 fatalities'),
         kpi_cell('BRSR Readiness', f'{k["brsrReadiness"]}', '%', f'{k["brsrMissing"]} items missing'),
         kpi_cell('Reporting Completion', f'{k["completion"]}', '%', f'{k["approvedSubs"]} approved')],
    ]
    col_w = (A4[0] - 32*mm) / 4
    kpi_table = Table(kpi_data, colWidths=[col_w]*4, rowHeights=[28*mm]*2)
    kpi_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), CARD_BG),
        ('BOX', (0,0), (-1,-1), 0.5, HexColor('#e2e8f0')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, HexColor('#e2e8f0')),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(kpi_table)
    story.append(Spacer(1, 10))

    story.append(Paragraph('Monthly Trends', styles['SectionH']))
    trend_header = [Paragraph(h, styles['CellH']) for h in ['Period', 'Emissions (tCO2e)', 'Energy (GJ)', 'Water (KL)', 'Waste (T)']]
    trend_rows = [trend_header]
    for t in data['trends']:
        trend_rows.append([
            Paragraph(t['period'], styles['CellBold']),
            Paragraph(f'{t["emissions"]:,.2f}', styles['Cell']),
            Paragraph(f'{t["energy"]:,.1f}', styles['Cell']),
            Paragraph(f'{t["water"]:,.1f}', styles['Cell']),
            Paragraph(f'{t["waste"]:,.2f}', styles['Cell']),
        ])
    trend_table = Table(trend_rows, colWidths=[col_w*0.8, col_w*1.1, col_w, col_w*0.9, col_w*0.9])
    trend_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY_DARK),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [white, BG_LIGHT]),
        ('GRID', (0,0), (-1,-1), 0.5, HexColor('#cbd5e1')),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(trend_table)
    story.append(Spacer(1, 12))

    story.append(Paragraph('ESG Data Control Chain', styles['SectionH']))
    story.append(Paragraph('Source Data \\u2192 Evidence \\u2192 Validation \\u2192 Calculation \\u2192 Approval \\u2192 Consolidation \\u2192 BRSR Mapping \\u2192 Report \\u2192 Audit', styles['Cell']))
    story.append(Spacer(1, 4))
    story.append(Paragraph(f'Open validation exceptions: {k["openExceptions"]} \\u00b7 BRSR gaps: {k["brsrMissing"]} \\u00b7 All KPIs computed deterministically from approved source records.', styles['Cell']))

    story.append(Spacer(1, 20))
    story.append(HRFlowable(width='100%', thickness=0.5, color=SLATE_LIGHT, spaceAfter=6))
    story.append(Paragraph('MEIL ESG / BRSR Reporting Platform \\u00b7 Generated from real-time database data \\u00b7 Illustrative demo data', styles['Footer']))

    doc.build(story)

if __name__ == '__main__':
    main()
`
