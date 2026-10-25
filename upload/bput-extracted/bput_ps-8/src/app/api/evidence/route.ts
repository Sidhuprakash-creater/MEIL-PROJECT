import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { authErrorToStatus } from '@/lib/workflow'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

export const runtime = 'nodejs'

// GET /api/evidence?projectId=&periodId=&module=&status=
// Paginated list including uploader.
export async function GET(req: NextRequest) {
  let user
  try {
    const u = await getCurrentUser()
    if (!u) throw new Error('UNAUTHENTICATED')
    user = u
  } catch (e) {
    const code = authErrorToStatus(e)
    return NextResponse.json(
      { error: 'Unauthenticated' },
      { status: code ?? 500 },
    )
  }

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId') || undefined
  const periodId = searchParams.get('periodId') || undefined
  const moduleFilter = searchParams.get('module') || undefined
  const status = searchParams.get('status') || undefined
  const take = Math.min(Number(searchParams.get('take') || 50), 200)

  const where: Record<string, unknown> = {
    NOT: {
      filePath: { startsWith: '/evidence/' },
    },
  }
  if (projectId) where.projectId = projectId
  if (periodId) where.reportingPeriodId = periodId
  if (moduleFilter) where.module = moduleFilter
  if (status) where.status = status

  try {
    const [evidence, total] = await Promise.all([
      db.evidence.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        include: {
          uploader: {
            select: { id: true, name: true, email: true, employeeCode: true },
          },
        },
      }),
      db.evidence.count({ where }),
    ])

    return NextResponse.json({
      user: { id: user.id, name: user.name },
      total,
      count: evidence.length,
      items: evidence,
    })
  } catch (e) {
    console.error('GET /api/evidence error', e)
    return NextResponse.json(
      { error: 'Failed to fetch evidence' },
      { status: 500 },
    )
  }
}

// POST /api/evidence — upload a new evidence document (multipart/form-data).
// Fields: file (required), documentType, documentDate, module, projectId, periodId, sourceRecordId
export async function POST(req: NextRequest) {
  let user
  try {
    const u = await getCurrentUser()
    if (!u) throw new Error('UNAUTHENTICATED')
    user = u
  } catch (e) {
    const code = authErrorToStatus(e)
    return NextResponse.json({ error: 'Unauthenticated' }, { status: code ?? 500 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const documentType = String(formData.get('documentType') || 'INVOICE')
    const documentDateRaw = formData.get('documentDate') as string | null
    const documentDate = documentDateRaw ? new Date(documentDateRaw) : null
    const moduleKey = String(formData.get('module') || 'ENERGY')
    const projectId = formData.get('projectId') as string | null || undefined
    const periodId = formData.get('periodId') as string | null || undefined
    const sourceRecordId = formData.get('sourceRecordId') as string | null || undefined

    // Save the file to public/evidence-uploads/<timestamp>-<safeName>
    const uploadDir = path.join(process.cwd(), 'public', 'evidence-uploads')
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

    const safeOrigName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const uniqueName = `${Date.now()}-${safeOrigName}`
    const fullPath = path.join(uploadDir, uniqueName)

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    fs.writeFileSync(fullPath, buffer)

    // Compute SHA-256 hash
    const hash = `sha256:${crypto.createHash('sha256').update(buffer).digest('hex')}`

    // Determine version for same file name if replacing
    const existing = await db.evidence.findFirst({
      where: { fileName: file.name, uploaderId: user.id },
      orderBy: { version: 'desc' },
      select: { version: true },
    })
    const version = (existing?.version ?? 0) + 1

    // Store relative URL (served from Next.js public/)
    const filePath = `/evidence-uploads/${uniqueName}`

    const evidence = await db.evidence.create({
      data: {
        fileName: file.name,
        documentType,
        documentDate,
        reportingPeriodId: periodId || null,
        projectId: projectId || null,
        module: moduleKey,
        sourceRecordId: sourceRecordId || null,
        uploaderId: user.id,
        filePath,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
        hash,
        version,
        status: 'UPLOADED',
      },
      include: {
        uploader: { select: { id: true, name: true, email: true, employeeCode: true } },
      },
    })

    // Audit
    await db.auditLog.create({
      data: {
        actorId: user.id,
        actorName: user.name,
        actorRole: (user.roles as { name: string }[]).map(r => r.name).join(', '),
        action: 'EVIDENCE_UPLOAD',
        entityType: 'Evidence',
        entityId: evidence.id,
        newState: JSON.stringify({ fileName: file.name, filePath, hash }),
        reason: `Evidence uploaded by ${user.name}`,
      },
    })

    return NextResponse.json({ evidence }, { status: 201 })
  } catch (e: any) {
    console.error('POST /api/evidence error', e)
    return NextResponse.json({ error: 'Failed to upload evidence', detail: String(e?.message ?? e) }, { status: 500 })
  }
}
