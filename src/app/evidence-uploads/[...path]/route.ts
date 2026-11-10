import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/pu/db'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export const runtime = 'nodejs'

function getMimeType(ext: string): string {
  switch (ext) {
    case '.pdf': return 'application/pdf'
    case '.png': return 'image/png'
    case '.jpg':
    case '.jpeg': return 'image/jpeg'
    case '.webp': return 'image/webp'
    case '.gif': return 'image/gif'
    case '.csv': return 'text/csv'
    case '.xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    case '.docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    default: return 'application/octet-stream'
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await context.params
    if (!pathSegments || pathSegments.length === 0) {
      return NextResponse.json({ error: 'File not specified' }, { status: 400 })
    }

    const filename = pathSegments.join('/')
    const baseName = pathSegments[pathSegments.length - 1]
    const ext = path.extname(baseName).toLowerCase()
    let contentType = getMimeType(ext)

    // 1. Check local public/ directory on disk
    const publicPath = path.join(process.cwd(), 'public', 'evidence-uploads', ...pathSegments)
    if (fs.existsSync(publicPath)) {
      try {
        const buffer = fs.readFileSync(publicPath)
        return new NextResponse(buffer, {
          headers: {
            'Content-Type': contentType,
            'Content-Length': String(buffer.byteLength),
            'Cache-Control': 'public, max-age=86400',
          },
        })
      } catch {}
    }

    // 2. Check /tmp/evidence-uploads on serverless (e.g. Vercel)
    const tmpPath = path.join(os.tmpdir(), 'evidence-uploads', baseName)
    if (fs.existsSync(tmpPath)) {
      try {
        const buffer = fs.readFileSync(tmpPath)
        return new NextResponse(buffer, {
          headers: {
            'Content-Type': contentType,
            'Content-Length': String(buffer.byteLength),
            'Cache-Control': 'public, max-age=86400',
          },
        })
      } catch {}
    }

    // 3. Check AppSetting by filename
    try {
      const blob = await db.appSetting.findFirst({
        where: {
          OR: [
            { skey: `evidence_blob_file:${baseName}` },
            { skey: `evidence_blob_file:${filename}` },
          ],
        },
        select: { svalue: true },
      })
      if (blob?.svalue) {
        const buffer = Buffer.from(blob.svalue, 'base64')
        return new NextResponse(buffer, {
          headers: {
            'Content-Type': contentType,
            'Content-Length': String(buffer.byteLength),
            'Cache-Control': 'public, max-age=86400',
          },
        })
      }
    } catch {}

    // 4. Check db.evidence record and its AppSetting blob
    try {
      const ev = await db.evidence.findFirst({
        where: {
          OR: [
            { filePath: { endsWith: baseName } },
            { filePath: `/evidence-uploads/${baseName}` },
            { fileName: baseName },
          ],
        },
        select: { id: true, mimeType: true, fileName: true, filePath: true },
      })
      if (ev) {
        if (ev.mimeType) contentType = ev.mimeType
        const blob = await db.appSetting.findUnique({
          where: { skey: `evidence_blob:${ev.id}` },
          select: { svalue: true },
        })
        if (blob?.svalue) {
          const buffer = Buffer.from(blob.svalue, 'base64')
          return new NextResponse(buffer, {
            headers: {
              'Content-Type': contentType,
              'Content-Length': String(buffer.byteLength),
              'Cache-Control': 'public, max-age=86400',
            },
          })
        }
      }
    } catch {}

    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to serve file', detail: e?.message }, { status: 500 })
  }
}

