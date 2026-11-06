/**
 * Submission Report PDF — jsPDF + autotable rendition of the
 * SubmissionReportModel produced by submission-report.ts.
 *
 * Runs server-side in a Next node runtime (same proven pattern as
 * brsr-pdf-generator.ts): jsPDF is instantiated with the universal module
 * import and autoTable is invoked through the runAutoTable compatibility
 * wrapper, because jspdf-autotable attaches differently across bundlers.
 */
import * as jspdfModule from 'jspdf'
import * as autoTableModule from 'jspdf-autotable'
import type { SubmissionReportModel, ReportSection } from '@/lib/pu/submission-report'

const jsPDFClass: any = (jspdfModule as any).jsPDF || (jspdfModule as any).default || jspdfModule
const autoTableFn: any = (autoTableModule as any).default || autoTableModule

/** Universal autoTable caller that works across webpack / SSR / node. */
function runAutoTable(doc: any, options: any) {
  if (typeof doc.autoTable === 'function') {
    doc.autoTable(options)
  } else if (typeof autoTableFn === 'function') {
    autoTableFn(doc, options)
  }
}

type RGB = [number, number, number]
const NAVY: RGB = [15, 23, 42]
const ACCENT: RGB = [37, 99, 235]
const SLATE_TEXT: RGB = [51, 65, 85]
const MUTED: RGB = [100, 116, 139]
const LINE: RGB = [226, 232, 240]
const HEAD_BG: RGB = [241, 245, 249]
const ROW_ALT: RGB = [248, 250, 252]

const POPULAR_TABLE_STYLES = {
  styles: {
    fontSize: 7.5,
    cellPadding: 2,
    textColor: SLATE_TEXT,
    lineColor: LINE,
    lineWidth: 0.1,
    font: 'helvetica' as const,
    overflow: 'linebreak' as const,
  },
  headStyles: {
    fillColor: HEAD_BG,
    textColor: NAVY,
    fontStyle: 'bold' as const,
    fontSize: 7,
    lineWidth: 0.1,
  },
  alternateRowStyles: { fillColor: ROW_ALT },
  margin: { left: 14, right: 14 },
}

export function generateSubmissionReportPdf(model: SubmissionReportModel): any {
  const doc = new jsPDFClass({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()

  /* ---------- Cover band ---------- */
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, W, 26, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('MEIL GROUP — ESG / BRSR REPORTING', 14, 10)
  doc.setFontSize(15)
  doc.text(model.meta.title, 14, 18)

  const dateLine = new Date(model.meta.generatedAt).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
  })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(148, 163, 184)
  doc.text(`Generated ${dateLine} by ${model.meta.generatedBy.name}`, W - 14, 10, { align: 'right' })

  /* ---------- Meta strip under the band ---------- */
  let y = 33
  doc.setFillColor(ROW_ALT[0], ROW_ALT[1], ROW_ALT[2])
  doc.roundedRect(14, y - 6, W - 28, 14, 1.5, 1.5, 'F')
  doc.setTextColor(...SLATE_TEXT)
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'bold')
  doc.text(model.meta.moduleLabel, 18, y)
  doc.setFont('helvetica', 'normal')
  const statusLine = `${model.meta.status} · ${model.meta.projectLabel} · ${model.meta.periodLabel}`
  const statusWidth = doc.getTextWidth(statusLine)
  doc.setTextColor(...ACCENT)
  doc.text(statusLine, W - 14 - statusWidth, y)
  doc.setTextColor(...MUTED)
  doc.setFontSize(7)
  doc.text(`Report ID: SR-${model.meta.submissionId.slice(-8).toUpperCase()}`, 18, y + 4.5)

  y += 14

  /* ---------- Sections ---------- */
  for (const s of model.sections) {
    startSection(doc, s, y)
    y = (doc as any).lastAutoTable?.finalY ?? y
    y += 4
    if (y > doc.internal.pageSize.getHeight() - 18) {
      doc.addPage()
      y = 18
    }
  }

  /* ---------- Footer + page numbers ---------- */
  const total = doc.internal.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    const H = doc.internal.pageSize.getHeight()
    doc.setDrawColor(...LINE)
    doc.setLineWidth(0.2)
    doc.line(14, H - 12, W - 14, H - 12)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.8)
    doc.setTextColor(...MUTED)
    doc.text('MEIL ESG / BRSR Reporting Platform — confidential internal document', 14, H - 8)
    doc.text(`Page ${i} of ${total}`, W - 14, H - 8, { align: 'right' })
  }

  return doc
}

function startSection(doc: any, s: ReportSection, y: number) {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  if (y > H - 30) {
    doc.addPage()
    y = 18
  }

  // section heading: accent bar + title (+ note)
  doc.setFillColor(...ACCENT)
  doc.rect(14, y - 2.8, 1.6, 4.6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(...NAVY)
  doc.text(s.title, 18, y + 1)
  if (s.note) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(6.6)
    doc.setTextColor(...MUTED)
    doc.text(doc.splitTextToSize(s.note, W - 34)[0], 18, y + 5.2)
    y += 5
  }

  const body: string[][] = s.kind === 'kv'
    ? s.rows.map(r => [r.k, r.v])
    : s.rows
  const head: string[][] = s.kind === 'kv'
    ? [] // headless: field | value pairs
    : [s.columns]

  runAutoTable(doc, {
    head,
    body,
    startY: y + 6,
    theme: 'grid',
    ...(s.kind === 'kv'
      ? {
          ...POPULAR_TABLE_STYLES,
          headStyles: { ...POPULAR_TABLE_STYLES.headStyles },
          columnStyles: {
            0: { cellWidth: 52, fontStyle: 'bold', fillColor: [248, 250, 252] as RGB, textColor: SLATE_TEXT },
          },
          styles: {
            ...POPULAR_TABLE_STYLES.styles,
            fontSize: 8,
          },
        }
      : POPULAR_TABLE_STYLES),
  })
}
