import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/pu/db'
import { getCurrentUser } from '@/lib/pu/session'
import { authErrorToStatus } from '@/lib/pu/workflow'
import { buildSubmissionReportModel, renderReportCsv, renderReportHtml } from '@/lib/pu/submission-report'

export const runtime = 'nodejs'

/* GET /api/pu/submissions/[id]/report?format=pdf|excel|csv|word|html[&inline=1]
 *
 * Compiles the complete workflow story of one submission — project details,
 * reporting period, captured data, per-source records (incl. emission
 * sources), evidence vault, validation, calculations, workflow history and
 * reviewer corrections — and renders it in the requested format:
 *
 *   pdf    → branded jsPDF document (attachment or ?inline=1 to preview)
 *   excel  → CSV file Excel opens natively
 *   csv    → alias of excel
 *   word   → .doc (HTML rendition served as MS Word document)
 *   html   → print-ready view in the browser (Save as PDF / Print)
 */

const FORMATS = ['pdf', 'excel', 'csv', 'word', 'html'] as const
type Format = typeof FORMATS[number]

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  let user
  try {
    const u = await getCurrentUser()
    if (!u) throw new Error('UNAUTHENTICATED')
    user = u
  } catch (e) {
    const code = authErrorToStatus(e)
    return NextResponse.json({ error: 'Unauthenticated' }, { status: code ?? 500 })
  }

  const { id } = await ctx.params
  const formatParam = (req.nextUrl.searchParams.get('format') || 'pdf').toLowerCase()
  if (!FORMATS.includes(formatParam as Format)) {
    return NextResponse.json(
      { error: `Invalid format "${formatParam}". Allowed: ${FORMATS.join(', ')}` },
      { status: 400 },
    )
  }
  const format = formatParam as Format
  const inline = req.nextUrl.searchParams.get('inline') === '1'

  try {
    const model = await buildSubmissionReportModel(id, {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.roles?.map(r => r.name).join(', ') || '',
    })
    if (!model) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    /* Non-blocking audit entry — never delays the download itself. */
    db.soAuditLog
      .create({
        data: {
          actorId: user.id,
          actorName: user.name,
          actorRole: user.roles?.map(r => r.name).join(', ') || '',
          action: 'SUBMISSION_REPORT_DOWNLOAD',
          entityType: 'Submission',
          entityId: model.meta.submissionId,
          newState: JSON.stringify({ format, generatedAt: model.meta.generatedAt }),
          reason: `Submission report (${format.toUpperCase()}) generated for ${model.meta.projectLabel} · ${model.meta.periodLabel}`,
        },
      })
      .catch(() => {})

    const fileName = model.meta.fileNameBase
    const disposition = (isAttachment: boolean, name: string) =>
      isAttachment
        ? `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`
        : `inline; filename="${name}"`

    if (format === 'pdf' || format === 'html' || format === 'word') {
      if (format === 'pdf') {
        const { generateSubmissionReportPdf } = await import('@/lib/pu/submission-report-pdf')
        const doc = generateSubmissionReportPdf(model)
        const bytes = new Uint8Array(doc.output('arraybuffer'))
        const headers = new Headers()
        headers.set('Content-Type', 'application/pdf')
        headers.set('Content-Disposition', disposition(!inline, `${fileName}.pdf`))
        headers.set('Content-Length', String(bytes.byteLength))
        headers.set('Cache-Control', 'no-store')
        return new NextResponse(bytes, { status: 200, headers })
      }

      const html = renderReportHtml(model, { forWord: format === 'word' })
      const headers = new Headers()
      if (format === 'word') {
        headers.set('Content-Type', 'application/msword; charset=utf-8')
        headers.set('Content-Disposition', disposition(true, `${fileName}.doc`))
      } else {
        /* Print view renders inline in the browser by default; pass ?download=1
           to force a .html file download instead. */
        const downloadHtml = req.nextUrl.searchParams.get('download') === '1'
        headers.set('Content-Type', 'text/html; charset=utf-8')
        headers.set('Content-Disposition', disposition(downloadHtml, `${fileName}.html`))
      }
      headers.set('Cache-Control', 'no-store')
      return new NextResponse(html, { status: 200, headers })
    }

    /* excel / csv */
    const csv = renderReportCsv(model)
    const headers = new Headers()
    headers.set('Content-Type', 'text/csv; charset=utf-8')
    headers.set('Content-Disposition', disposition(true, `${fileName}.csv`))
    headers.set('Cache-Control', 'no-store')
    return new NextResponse('\uFEFF' + csv, { status: 200, headers }) // BOM so Excel detects UTF-8
  } catch (e: any) {
    console.error('GET /api/pu/submissions/[id]/report error', e)
    return NextResponse.json(
      { error: 'Failed to generate submission report', detail: String(e?.message ?? e) },
      { status: 500 },
    )
  }
}
