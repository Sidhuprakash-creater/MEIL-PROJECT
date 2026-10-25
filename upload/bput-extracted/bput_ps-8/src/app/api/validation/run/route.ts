import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, userHasPermission } from '@/lib/session'
import { apiError, persistValidationResults, rollupValidationStatus } from '@/lib/engines'
import { runValidationFor } from '@/lib/validators'

export const runtime = 'nodejs'

/**
 * POST /api/validation/run
 * Body either:
 *   { recordType: 'ENERGY'|'WATER'|'WASTE'|'PEOPLE'|'SAFETY', recordId: '...' }
 *   — or —
 *   { periodId: '...', projectId: '...' }
 * Re-runs every module validation rule on the matching records, persists
 * ValidationResult rows (reset OPEN ones first), returns counts.
 *
 * Allowed if user has 'submission.review' OR any 'esg.*.write' permission.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

    // RBAC: reviewer OR any writer
    const isReviewer = await userHasPermission(user.id, 'submission.review')
    const writerKeys = ['esg.energy.write', 'esg.water.write', 'esg.waste.write', 'esg.people.write', 'esg.safety.write', 'esg.travel.write']
    const isWriter = await Promise.all(writerKeys.map(k => userHasPermission(user.id, k)))
    if (!isReviewer && !isWriter.some(Boolean)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { recordType, recordId, periodId, projectId } = body || {}

    // Build the set of (recordType, recordId) tuples to validate
    const targets: { recordType: string; recordId: string }[] = []
    if (recordType && recordId) {
      targets.push({ recordType, recordId })
    } else if (periodId || projectId) {
      // Sweep all source-record tables for the scope
      const where = {
        ...(projectId ? { projectId } : {}),
        ...(periodId ? { reportingPeriodId: periodId } : {}),
      }
      const energies = await db.energyRecord.findMany({ where, select: { id: true } })
      energies.forEach(r => targets.push({ recordType: 'ENERGY', recordId: r.id }))
      const waters = await db.waterRecord.findMany({ where, select: { id: true } })
      waters.forEach(r => targets.push({ recordType: 'WATER', recordId: r.id }))
      const wastes = await db.wasteRecord.findMany({ where, select: { id: true } })
      wastes.forEach(r => targets.push({ recordType: 'WASTE', recordId: r.id }))
      const workforces = await db.workforceRecord.findMany({ where, select: { id: true } })
      workforces.forEach(r => targets.push({ recordType: 'PEOPLE', recordId: r.id }))
      const safeties = await db.safetyRecord.findMany({ where, select: { id: true } })
      safeties.forEach(r => targets.push({ recordType: 'SAFETY', recordId: r.id }))
    } else {
      return NextResponse.json({ error: 'Provide {recordType, recordId} or {periodId, projectId}' }, { status: 400 })
    }

    let errors = 0
    let warnings = 0
    let passed = 0
    const perRecord: any[] = []

    for (const t of targets) {
      let record: any = null
      if (t.recordType === 'ENERGY') record = await db.energyRecord.findUnique({ where: { id: t.recordId } })
      if (t.recordType === 'WATER') record = await db.waterRecord.findUnique({ where: { id: t.recordId } })
      if (t.recordType === 'WASTE') record = await db.wasteRecord.findUnique({ where: { id: t.recordId } })
      if (t.recordType === 'PEOPLE') record = await db.workforceRecord.findUnique({ where: { id: t.recordId } })
      if (t.recordType === 'SAFETY') record = await db.safetyRecord.findUnique({ where: { id: t.recordId } })
      if (!record) {
        perRecord.push({ ...t, status: 'NOT_FOUND' })
        continue
      }

      const issues = await runValidationFor(t.recordType, record)
      const { validationStatus } = rollupValidationStatus(issues)
      const errorCount = issues.filter(i => i.severity === 'ERROR' || i.severity === 'BLOCKING').length
      const warningCount = issues.filter(i => i.severity === 'WARNING').length
      errors += errorCount
      warnings += warningCount
      if (errorCount === 0) passed += 1

      // Reset OPEN validations for this record, then persist fresh ones
      await db.validationResult.deleteMany({ where: { recordId: t.recordId, recordType: t.recordType, status: 'OPEN' } })
      await persistValidationResults(t.recordId, t.recordType, issues)

      // Update record's validation status
      const update: any = { validationStatus }
      if (t.recordType === 'ENERGY') await db.energyRecord.update({ where: { id: t.recordId }, data: update })
      if (t.recordType === 'WATER') await db.waterRecord.update({ where: { id: t.recordId }, data: update })
      if (t.recordType === 'WASTE') await db.wasteRecord.update({ where: { id: t.recordId }, data: update })
      if (t.recordType === 'PEOPLE') await db.workforceRecord.update({ where: { id: t.recordId }, data: update })
      if (t.recordType === 'SAFETY') await db.safetyRecord.update({ where: { id: t.recordId }, data: update })

      perRecord.push({ recordType: t.recordType, recordId: t.recordId, validationStatus, errors: errorCount, warnings: warningCount })
    }

    await db.auditLog.create({
      data: {
        actorId: user.id,
        actorName: user.name,
        actorRole: user.roles.map(r => r.name).join(', ') || 'User',
        action: 'VALIDATE',
        entityType: 'ValidationRun',
        entityId: 'batch',
        newState: JSON.stringify({ targets: targets.length, errors, warnings, passed }),
        reason: recordType && recordId ? `Validation run on ${recordType} ${recordId}` : `Validation run on scope (projectId=${projectId ?? 'any'}, periodId=${periodId ?? 'any'})`,
      },
    })

    return NextResponse.json({ targets: targets.length, errors, warnings, passed, perRecord })
  } catch (e: any) {
    return apiError(e)
  }
}
