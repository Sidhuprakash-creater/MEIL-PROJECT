import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/so/session'
import { authErrorToStatus } from '@/lib/so/workflow'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import * as os from 'os'
import { soEvidenceCache, invalidateSoEvidenceCache } from '@/lib/portal-cache'
import { scanForMalware, summarizeScan } from '@/lib/evidence/security'
import { describeEvidenceDuplicate, findDuplicateEvidence } from '@/lib/evidence/duplicates'

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

  /* 20s keyed cache — identical to the pu twin. Uploading/verifying/rejecting
     evidence calls invalidateSoEvidenceCache(), so the list can't go stale. */
  const soCacheKey = `${projectId || 'all'}:${periodId || 'all'}:${moduleFilter || 'all'}:${status || 'all'}:${take}`
  const cachedEvidence = soEvidenceCache.get(soCacheKey)
  if (cachedEvidence && cachedEvidence.expiresAt > Date.now()) {
    return NextResponse.json(cachedEvidence.data)
  }

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
            select: { id: true, name: true, email: true, employeeId: true },
          },
        },
      }),
      db.evidence.count({ where }),
    ])

    const payload = {
      user: { id: user.id, name: user.name },
      total,
      count: evidence.length,
      items: evidence.map((ev) => ({ ...ev, uploader: ev.uploader ? { ...ev.uploader, employeeCode: ev.uploader.employeeId } : ev.uploader })),
    }
    soEvidenceCache.set(soCacheKey, { data: payload, expiresAt: Date.now() + 20000 })
    return NextResponse.json(payload)
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
    /* The user can confirm that re-filing an identical document is intentional. */
    const allowDuplicate = String(formData.get('allowDuplicate') || '') === 'true'

    const safeOrigName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const uniqueName = `${Date.now()}-${safeOrigName}`
    const filePath = `/evidence-uploads/${uniqueName}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    /* ── SECURITY GATE ──────────────────────────────────────────────────────
       The file is scanned for malware and checked against the vault for
       identical content BEFORE any bytes are written to disk. */
    const scan = scanForMalware({ fileName: file.name, buffer })
    if (scan.verdict === 'MALICIOUS') {
      return NextResponse.json(
        {
          error: `Upload blocked — ${summarizeScan(scan)}`,
          code: 'MALWARE_DETECTED',
          findings: scan.findings,
        },
        { status: 422 },
      )
    }

    const duplicate = await findDuplicateEvidence(scan.sha256, { projectId })
    if (duplicate && !allowDuplicate) {
      return NextResponse.json(
        {
          error: describeEvidenceDuplicate(duplicate),
          code: 'DUPLICATE_EVIDENCE',
          duplicate: {
            duplicateId: duplicate.id,
            fileName: duplicate.fileName,
            uploaderName: duplicate.uploaderName,
            createdAt: duplicate.createdAt.toISOString(),
          },
        },
        { status: 409 },
      )
    }

    // Save to disk when writable, or fallback to /tmp on serverless (e.g. Vercel read-only filesystem)
    try {
      const uploadDir = path.join(process.cwd(), 'public', 'evidence-uploads')
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })
      fs.writeFileSync(path.join(uploadDir, uniqueName), buffer)
    } catch {
      try {
        const tmpDir = path.join(os.tmpdir(), 'evidence-uploads')
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })
        fs.writeFileSync(path.join(tmpDir, uniqueName), buffer)
      } catch {}
    }

    // Compute SHA-256 hash
    const hash = `sha256:${scan.sha256}`

    // Determine version for same file name if replacing
    const existing = await db.evidence.findFirst({
      where: { fileName: file.name, uploaderId: user.id },
      orderBy: { version: 'desc' },
      select: { version: true },
    })
    const version = (existing?.version ?? 0) + 1

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
        uploader: { select: { id: true, name: true, email: true, employeeId: true } },
      },
    })

    // Store file bytes in AppSetting for permanent Vercel availability across lambdas
    await db.appSetting.upsert({
      where: { skey: `evidence_blob:${evidence.id}` },
      create: {
        skey: `evidence_blob:${evidence.id}`,
        label: file.name,
        category: 'EVIDENCE_BLOB',
        svalue: buffer.toString('base64'),
        vtype: 'text',
      },
      update: {
        svalue: buffer.toString('base64'),
      },
    }).catch(() => null)

    await db.appSetting.upsert({
      where: { skey: `evidence_blob_file:${uniqueName}` },
      create: {
        skey: `evidence_blob_file:${uniqueName}`,
        label: file.name,
        category: 'EVIDENCE_BLOB',
        svalue: buffer.toString('base64'),
        vtype: 'text',
      },
      update: {
        svalue: buffer.toString('base64'),
      },
    }).catch(() => null)

    // Audit
    await db.soAuditLog.create({
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

    /* Keep the evidence list cache (and overview KPIs) fresh — same contract
       as the pu twin's upload route. */
    invalidateSoEvidenceCache()
    return NextResponse.json({ evidence: { ...evidence, uploader: evidence.uploader ? { ...evidence.uploader, employeeCode: evidence.uploader.employeeId } : evidence.uploader } }, { status: 201 })
  } catch (e: any) {
    console.error('POST /api/evidence error', e)
    return NextResponse.json({ error: 'Failed to upload evidence', detail: String(e?.message ?? e) }, { status: 500 })
  }
}
