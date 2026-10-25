import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { authErrorToStatus } from '@/lib/workflow'

export const runtime = 'nodejs'

// GET /api/evidence/[id] — single evidence detail.
// Includes uploader + linked source record (best-effort, by sourceRecordId).
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
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

  const { id } = await ctx.params

  try {
    const evidence = await db.evidence.findUnique({
      where: { id },
      include: {
        uploader: {
          select: { id: true, name: true, email: true, employeeCode: true },
        },
      },
    })
    if (!evidence) {
      return NextResponse.json({ error: 'Evidence not found' }, { status: 404 })
    }

    // Resolve linked project + period for display
    const [project, period] = await Promise.all([
      evidence.projectId
        ? db.project.findUnique({
            where: { id: evidence.projectId },
            select: { id: true, projectCode: true, projectName: true, location: true },
          })
        : null,
      evidence.reportingPeriodId
        ? db.reportingPeriod.findUnique({
            where: { id: evidence.reportingPeriodId },
            select: { id: true, periodLabel: true, year: true, month: true },
          })
        : null,
    ])

    // Linked source record (best-effort — search by sourceRecordId across all modules)
    let linkedSource: Record<string, unknown> | null = null
    if (evidence.sourceRecordId) {
      const sid = evidence.sourceRecordId
      const candidate =
        (await db.energyRecord.findUnique({ where: { id: sid }, include: { validationResults: true } })) ||
        (await db.waterRecord.findUnique({ where: { id: sid }, include: { validationResults: true } })) ||
        (await db.wasteRecord.findUnique({ where: { id: sid }, include: { validationResults: true } })) ||
        (await db.workforceRecord.findUnique({ where: { id: sid }, include: { validationResults: true } })) ||
        (await db.safetyRecord.findUnique({ where: { id: sid }, include: { validationResults: true } })) ||
        (await db.travelRecord.findUnique({ where: { id: sid }, include: { validationResults: true } }))
      if (candidate) {
        linkedSource = { ...candidate, _kind: candidate.module || 'RECORD' } as Record<string, unknown>
      }
    }

    // Audit trail for this evidence
    const auditTrail = await db.auditLog.findMany({
      where: { entityType: 'Evidence', entityId: evidence.id },
      orderBy: { createdAt: 'asc' },
      take: 50,
    })

    return NextResponse.json({
      user: { id: user.id, name: user.name },
      evidence,
      project,
      reportingPeriod: period,
      linkedSourceRecord: linkedSource,
      auditTrail,
    })
  } catch (e) {
    console.error('GET /api/evidence/[id] error', e)
    return NextResponse.json(
      { error: 'Failed to fetch evidence' },
      { status: 500 },
    )
  }
}
