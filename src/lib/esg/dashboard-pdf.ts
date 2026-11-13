// ── Group Admin — Environmental footprint chart-PDF generator ────────────────
// Client-side jsPDF report: clicking the Emissions / Electricity / Water cards
// on the Group Command Center renders a pie chart (offscreen canvas → PNG) plus
// a breakdown table, and downloads the PDF instantly.
import * as jspdfModule from 'jspdf'
import * as autoTableModule from 'jspdf-autotable'
import type { EsgFootprint } from '@/lib/esg/types'

const jsPDFClass: any = (jspdfModule as any).jsPDF || (jspdfModule as any).default || jspdfModule
const autoTableFn: any = (autoTableModule as any).default || autoTableModule

function runAutoTable(doc: any, options: any) {
  if (typeof doc.autoTable === 'function') {
    doc.autoTable(options)
  } else if (typeof autoTableFn === 'function') {
    autoTableFn(doc, options)
  }
}

export type FootprintKind = 'emissions' | 'energy' | 'water'

const KIND_META: Record<FootprintKind, { title: string; subtitle: string; unit: string; file: string }> = {
  emissions: { title: 'GHG Emissions Report', subtitle: 'Total GHG emissions by scope', unit: 'tCO2e', file: 'emissions' },
  energy: { title: 'Electricity & Energy Report', subtitle: 'Energy consumption by source', unit: 'GJ', file: 'energy' },
  water: { title: 'Water Use Report', subtitle: 'Water withdrawal by source', unit: 'KL', file: 'water' },
}

const PALETTE = ['#3a7bff', '#6a5bff', '#16a3a3', '#238653', '#c57926', '#c34a4a', '#8a63c9', '#c98a2b']
const NAVY: [number, number, number] = [15, 23, 42]
const INK: [number, number, number] = [23, 38, 61]
const SOFT: [number, number, number] = [90, 105, 130]
const BORDER: [number, number, number] = [203, 213, 225]

const fmt = (n: number) => (Math.round(n * 100) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })

/** Render a labelled pie chart on an offscreen canvas and return a PNG data URL. */
function renderPiePng(segments: { label: string; value: number }[], unit: string): string {
  const W = 900
  const H = 150 + segments.length * 34
  const S = 2
  const canvas = document.createElement('canvas')
  canvas.width = W * S
  canvas.height = H * S
  const ctx = canvas.getContext('2d')!
  ctx.scale(S, S)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)

  const cy = H * 0.52
  const cx = W * 0.34
  const r = Math.min(H * 0.36, 190)
  const total = segments.reduce((a, s) => a + s.value, 0)

  if (total > 0) {
    let start = -Math.PI / 2
    for (let i = 0; i < segments.length; i++) {
      const frac = segments[i].value / total
      const end = start + frac * 2 * Math.PI
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, r, start, end)
      ctx.closePath()
      ctx.fillStyle = PALETTE[i % PALETTE.length]
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2.5
      ctx.stroke()
      if (frac > 0.03) {
        const mid = (start + end) / 2
        ctx.fillStyle = '#17263D'
        ctx.font = 'bold 16px Helvetica, Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(`${Math.round(frac * 100)}%`, cx + Math.cos(mid) * (r + 30), cy + Math.sin(mid) * (r + 30))
      }
      start = end
    }
    // donut hole + total in the centre (white disc over the slices)
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.55, 0, 2 * Math.PI)
    ctx.fill()
    ctx.fillStyle = '#17263D'
    ctx.font = 'bold 26px Helvetica, Arial'
    ctx.textAlign = 'center'
    ctx.fillText(fmt(total), cx, cy - 8)
    ctx.fillStyle = '#5a6982'
    ctx.font = '13px Helvetica, Arial'
    ctx.fillText(`total ${unit}`, cx, cy + 16)
  } else {
    ctx.fillStyle = '#8595ab'
    ctx.font = '16px Helvetica, Arial'
    ctx.textAlign = 'center'
    ctx.fillText('No recorded data yet', cx, cy)
  }

  // legend column
  const lx = W * 0.6
  let ly = cy - ((segments.length - 1) * 34) / 2
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  for (let i = 0; i < segments.length; i++) {
    ctx.fillStyle = PALETTE[i % PALETTE.length]
    ctx.beginPath()
    ctx.arc(lx + 8, ly - 5, 8, 0, 2 * Math.PI)
    ctx.fill()
    ctx.fillStyle = '#33415C'
    ctx.font = 'bold 15px Helvetica, Arial'
    ctx.fillText(segments[i].label, lx + 26, ly)
    ctx.fillStyle = '#5a6982'
    ctx.font = '13px Helvetica, Arial'
    ctx.fillText(`${fmt(segments[i].value)} ${unit}`, lx + 26, ly + 18)
    ly += 34
  }
  return canvas.toDataURL('image/png')
}

/** Render a grouped monthly bar chart (used in the emissions report). */
function renderTrendPng(
  items: { label: string; a: number; b: number }[],
  names: [string, string],
  unit: string
): string {
  const W = 900
  const H = 420
  const S = 2
  const canvas = document.createElement('canvas')
  canvas.width = W * S
  canvas.height = H * S
  const ctx = canvas.getContext('2d')!
  ctx.scale(S, S)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)

  const padL = 70
  const padB = 44
  const padT = 26
  const plotW = W - padL - 24
  const plotH = H - padT - padB
  const max = Math.max(...items.map((d) => d.a + d.b), 1)
  const y0 = H - padB

  // grid + y labels
  ctx.strokeStyle = 'rgba(102,119,141,0.25)'
  ctx.fillStyle = '#8595ab'
  ctx.font = '12px Helvetica, Arial'
  ctx.textAlign = 'right'
  for (let g = 0; g <= 4; g++) {
    const v = (max / 4) * g
    const gy = y0 - (plotH * g) / 4
    ctx.beginPath()
    ctx.moveTo(padL, gy)
    ctx.lineTo(W - 24, gy)
    ctx.stroke()
    ctx.fillText(fmt(v), padL - 8, gy + 4)
  }

  const band = plotW / items.length
  items.forEach((d, i) => {
    const bx = padL + i * band + band * 0.18
    const bw = band * 0.28
    const hA = (d.a / max) * plotH
    ctx.fillStyle = '#3a7bff'
    ctx.fillRect(bx, y0 - hA, bw, hA)
    const hB = (d.b / max) * plotH
    ctx.fillStyle = '#6a5bff'
    ctx.fillRect(bx + bw + 4, y0 - hB, bw, hB)
    ctx.fillStyle = '#33415C'
    ctx.font = '12px Helvetica, Arial'
    ctx.textAlign = 'center'
    ctx.fillText(d.label, bx + bw + 2, y0 + 18)
  })

  // legend
  ctx.textAlign = 'left'
  ctx.font = 'bold 13px Helvetica, Arial'
  ctx.fillStyle = '#3a7bff'
  ctx.fillRect(W - 240, 12, 12, 12)
  ctx.fillStyle = '#33415C'
  ctx.fillText(`${names[0]} (${unit})`, W - 222, 22)
  ctx.fillStyle = '#6a5bff'
  ctx.fillRect(W - 130, 12, 12, 12)
  ctx.fillStyle = '#33415C'
  ctx.fillText(`${names[1]} (${unit})`, W - 112, 22)
  return canvas.toDataURL('image/png')
}

export function generateFootprintPdf(options: {
  kind: FootprintKind
  footprint: EsgFootprint
  reportingYear?: number
  esgTrend?: { month: string; scope1: number; scope2: number }[]
}): void {
  const { kind, footprint: fp, reportingYear, esgTrend } = options
  const meta = KIND_META[kind]
  const doc = new jsPDFClass({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = 210

  // ── Header band ──
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, pageW, 30, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text(`MEIL Group — ${meta.title}`, 14, 13)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const fy = reportingYear ? `FY ${reportingYear}-${String(reportingYear + 1).slice(-2)}` : 'All reporting periods'
  doc.text(`${meta.subtitle}  ·  ${fy}  ·  Group Admin`, 14, 21)
  doc.setTextColor(...INK)

  // ── KPI strip ──
  const kpis: { label: string; value: string }[] =
    kind === 'emissions'
      ? [
          { label: 'Total emissions', value: `${fmt(fp.emissionsTco2e)} tCO2e` },
          { label: 'Scope 1 + 2', value: `${fmt(fp.scope1Tco2e + fp.scope2Tco2e)} tCO2e` },
          { label: 'Scope 3', value: `${fmt(fp.scope3Tco2e)} tCO2e` },
        ]
      : kind === 'energy'
        ? [
            { label: 'Grid electricity', value: `${fmt(fp.electricityGj)} GJ` },
            { label: 'Total energy', value: `${fmt(fp.totalEnergyGj)} GJ` },
            { label: 'Renewable', value: `${fmt(fp.renewableGj)} GJ` },
          ]
        : [
            { label: 'Withdrawal', value: `${fmt(fp.waterKl)} KL` },
            { label: 'Discharge', value: `${fmt(fp.waterDischargeKl)} KL` },
            { label: 'Recycled / reused', value: `${fmt(fp.waterRecycledKl)} KL` },
          ]
  let y = 38
  kpis.forEach((kp, i) => {
    const x = 14 + i * 62
    doc.setDrawColor(...BORDER)
    doc.setFillColor(248, 250, 252)
    doc.roundedRect(x, y, 58, 20, 2.5, 2.5, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...INK)
    doc.text(kp.value, x + 29, y + 9, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...SOFT)
    doc.text(kp.label.toUpperCase(), x + 29, y + 15.5, { align: 'center' })
  })
  doc.setTextColor(...INK)

  // ── Pie chart ──
  const segments =
    kind === 'emissions'
      ? fp.emissionsByScope
      : kind === 'energy'
        ? fp.energyBySource.map((s) => ({ label: s.source, value: s.gj }))
        : fp.waterBySource.map((s) => ({ label: s.source, value: s.kl }))
  const visible = segments.filter((s) => s.value > 0)

  y += 30
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11.5)
  doc.text(`Breakdown — pie chart (${meta.unit})`, 14, y)
  const piePng = renderPiePng(visible.length > 0 ? visible : [{ label: 'No data', value: 1 }], meta.unit)
  const pieW = 172
  const pieH = (pieW * (150 + Math.max(visible.length, 1) * 34)) / 900
  doc.addImage(piePng, 'PNG', 19, y + 4, pieW, pieH)
  y += pieH + 12

  // ── Breakdown table ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11.5)
  doc.text('Breakdown table', 14, y)
  const total = visible.reduce((a, s) => a + s.value, 0)
  runAutoTable(doc, {
    startY: y + 4,
    head: [['Segment', `Value (${meta.unit})`, 'Share']],
    body: visible.map((s) => [s.label, fmt(s.value), total > 0 ? `${((s.value / total) * 100).toFixed(1)} %` : '—']),
    didParseCell: (data: any) => {
      // tint the segment name with its pie-slice colour
      if (data.section === 'body' && data.column.index === 0) {
        const color = PALETTE[data.row.index % PALETTE.length]
        data.cell.styles.textColor = [
          parseInt(color.slice(1, 3), 16),
          parseInt(color.slice(3, 5), 16),
          parseInt(color.slice(5, 7), 16),
        ]
        data.cell.styles.fontStyle = 'bold'
      }
    },
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2.2, textColor: INK, lineColor: BORDER, lineWidth: 0.1, font: 'helvetica' },
    headStyles: { fillColor: [241, 245, 249], textColor: NAVY, fontStyle: 'bold' },
    margin: { left: 14, right: 14 },
  })

  y = ((doc as any).lastAutoTable?.finalY ?? y + 30) + 12

  // ── Emissions: monthly Scope 1 / 2 bar chart ──
  if (kind === 'emissions' && esgTrend && esgTrend.length > 0) {
    if (y > 175) {
      doc.addPage()
      y = 24
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11.5)
    doc.text('Monthly trend — Scope 1 & 2 (tCO2e)', 14, y)
    const trendPng = renderTrendPng(
      esgTrend.map((t) => ({ label: t.month, a: t.scope1, b: t.scope2 })),
      ['Scope 1', 'Scope 2'],
      'tCO2e'
    )
    doc.addImage(trendPng, 'PNG', 19, y + 4, 172, 80)
    y += 92
  }

  // ── Water: balance note ──
  if (kind === 'water') {
    const lines = [
      `Consumption: ${fmt(fp.waterConsumptionKl)} KL`,
      `Recycled / reused: ${fmt(fp.waterRecycledKl)} KL (${fp.waterKl > 0 ? ((fp.waterRecycledKl / fp.waterKl) * 100).toFixed(1) : '0.0'} % of withdrawal)`,
      `Discharge: ${fmt(fp.waterDischargeKl)} KL`,
    ]
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(...SOFT)
    lines.forEach((l, i) => doc.text(l, 14, y + i * 5.5))
    doc.setTextColor(...INK)
  }

  // ── Footer on every page ──
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setDrawColor(...BORDER)
    doc.line(14, 285, pageW - 14, 285)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...SOFT)
    doc.text('MEIL ESG Platform · Group Command Center · auto-generated report', 14, 290)
    doc.text(`Page ${p} of ${pages}`, pageW - 14, 290, { align: 'right' })
  }

  const stamp = new Date().toISOString().slice(0, 10)
  doc.save(`MEIL-${meta.file}-report-${stamp}.pdf`)
}
