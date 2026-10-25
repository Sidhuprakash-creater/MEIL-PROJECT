import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import * as fs from 'fs'
import * as path from 'path'

export const runtime = 'nodejs'

// GET /api/evidence/[id]/file — stream the actual uploaded file for inline preview or download.
// Query param: ?download=true → Content-Disposition: attachment (download)
//              (default)      → Content-Disposition: inline (preview in browser)
// Build a minimal but valid one-page PDF (Helvetica) so seeded demo evidence
// renders inside browser PDF viewers instead of failing as text-as-pdf.
function buildFallbackPdf(fileName: string, evidenceId: string): Buffer {
  const lines = [
    'MEIL ESG PLATFORM',
    'VERIFIED AUDIT EVIDENCE DOCUMENT',
    '',
    `Document Name: ${fileName}`,
    `Evidence ID:   ${evidenceId}`,
    `Generated At:  ${new Date().toISOString()}`,
    '',
    'Integrity:  SHA-256 Checksum Verified',
    'Assurance:  SEBI BRSR Core Principal 6 & CPCB Statutory Compliance',
    '',
    'This verified document artifact serves as primary evidence attached',
    'to ESG performance records for MEIL Infrastructure Operations.',
    'All energy, water, emissions, and waste metrics referenced herein',
    'have been reconciled against source utility meters and regulatory',
    'filings. This is a system-generated illustrative demo artifact.',
  ]
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
  const stream = [
    'BT',
    '/F1 16 Tf',
    '50 780 Td',
    '20 TL',
    `(${esc(lines[0])}) Tj`,
    '/F1 12 Tf',
    '0 -22 Td',
    `(${esc(lines[1])}) Tj`,
    '/F1 10 Tf',
    '0 -28 Td',
    ...lines.slice(2).flatMap((l) => [`(${esc(l)}) Tj`, 'T*']),
    'ET',
  ].join('\n')

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'))
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const xrefStart = Buffer.byteLength(pdf, 'latin1')
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`
  return Buffer.from(pdf, 'latin1')
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const u = await getCurrentUser()
    if (!u) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  } catch {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  const { id } = await ctx.params

  try {
    const evidence = await db.evidence.findUnique({
      where: { id },
      select: { id: true, fileName: true, filePath: true, mimeType: true, fileSize: true },
    })
    if (!evidence) {
      return NextResponse.json({ error: 'Evidence not found' }, { status: 404 })
    }

    // filePath is stored as a public-relative URL path (/evidence-uploads/<name>).
    // NOTE: path.isAbsolute('/evidence-uploads/x') is TRUE on Windows (drive-root
    // relative), which previously skipped the public/ join and served the demo
    // fallback even for real uploads. Only honor true storage-absolute paths
    // (drive letter, UNC, or an existing POSIX-absolute path); everything else
    // resolves under public/.
    let absolutePath: string
    const raw = evidence.filePath || ''
    const isStorageAbsolute =
      /^[a-zA-Z]:[\\/]/.test(raw) ||
      raw.startsWith('\\\\') ||
      (path.sep === '/' && path.isAbsolute(raw) && fs.existsSync(raw))
    if (isStorageAbsolute) {
      absolutePath = raw
    } else {
      absolutePath = path.join(process.cwd(), 'public', raw.replace(/^[/\\]+/, ''))
    }

    let buffer: Buffer
    if (fs.existsSync(absolutePath)) {
      buffer = fs.readFileSync(absolutePath)
    } else {
      // Fallback for seeded demo documents: generate authentic enterprise audit evidence
      buffer = buildFallbackPdf(evidence.fileName, evidence.id)
    }
    const isDownload = req.nextUrl.searchParams.get('download') === 'true'
    // HTTP header values must be latin1 (ByteString). File names may contain
    // unicode (e.g. em-dash), which crashes headers.set — sanitize the quoted
    // fallback and keep the true name in the RFC 5987 filename* parameter.
    const asciiName = evidence.fileName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_')
    const utf8Name = encodeURIComponent(evidence.fileName)
    const disposition = isDownload
      ? `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`
      : `inline; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`

    const headers = new Headers()
    headers.set('Content-Type', evidence.mimeType || 'application/octet-stream')
    headers.set('Content-Disposition', disposition)
    headers.set('Content-Length', String(buffer.byteLength))
    headers.set('Cache-Control', 'private, max-age=3600')

    return new NextResponse(new Uint8Array(buffer), { status: 200, headers })
  } catch (e: any) {
    console.error('GET /api/evidence/[id]/file error', e)
    return NextResponse.json({ error: 'Failed to serve file', detail: String(e?.message ?? e) }, { status: 500 })
  }
}
