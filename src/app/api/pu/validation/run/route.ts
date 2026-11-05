import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/pu/db'
import { getCurrentUser, userHasPermission } from '@/lib/pu/session'
import { apiError, persistValidationResults, rollupValidationStatus } from '@/lib/pu/engines'
import { runValidationFor } from '@/lib/pu/validators'

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

    // Build the set of (recordType, recordId, record) tuples to validate.
    // Full rows are fetched ONCE per table (no per-record findUnique N+1).
    const targets: { recordType: string; recordId: string; record: any }[] = []
    if (recordType && recordId) {
      const table: Record<string, any> = {
        ENERGY: db.energyRecord, WATER: db.waterRecord, WASTE: db.wasteRecord,
        PEOPLE: db.workforceRecord, SAFETY: db.safetyRecord,
      }
      const row = table[recordType] ? await table[recordType].findUnique({ where: { id: recordId } }) : null
      if (row) targets.push({ recordType, recordId, record: row })
    } else if (periodId || projectId) {
      // Sweep all source-record tables for the scope in one parallel batch
      const where = {
        ...(projectId ? { projectId } : {}),
        ...(periodId ? { reportingPeriodId: periodId } : {}),
      }
      const [energies, waters, wastes, workforces, safeties] = await Promise.all([
        db.energyRecord.findMany({ where }),
        db.waterRecord.findMany({ where }),
        db.wasteRecord.findMany({ where }),
        db.workforceRecord.findMany({ where }),
        db.safetyRecord.findMany({ where }),
      ])
      energies.forEach(r => targets.push({ recordType: 'ENERGY', recordId: r.id, record: r }))
      waters.forEach(r => targets.push({ recordType: 'WATER', recordId: r.id, record: r }))
      wastes.forEach(r => targets.push({ recordType: 'WASTE', recordId: r.id, record: r }))
      workforces.forEach(r => targets.push({ recordType: 'PEOPLE', recordId: r.id, record: r }))
      safeties.forEach(r => targets.push({ recordType: 'SAFETY', recordId: r.id, record: r }))
    } else {
      return NextResponse.json({ error: 'Provide {recordType, recordId} or {periodId, projectId}' }, { status: 400 })
    }

    let errors = 0
    let warnings = 0
    let passed = 0
    const perRecord: any[] = []

    const persistJobs: Promise<any>[] = []
    const statusUpdates: Promise<any>[] = []

    for (const t of targets) {
      const record = t.record
      if (!record) {
        perRecord.push({ recordType: t.recordType, recordId: t.recordId, status: 'NOT_FOUND' })
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
      persistJobs.push(
        db.validationResult.deleteMany({ where: { recordId: t.recordId, recordType: t.recordType, status: 'OPEN' } }).then(() =>
          persistValidationResults(t.recordId, t.recordType, issues),
        ),
      )

      // Update record's validation status
      const update: any = { validationStatus }
      if (t.recordType === 'ENERGY') statusUpdates.push(db.energyRecord.update({ where: { id: t.recordId }, data: update }))
      if (t.recordType === 'WATER') statusUpdates.push(db.waterRecord.update({ where: { id: t.recordId }, data: update }))
      if (t.recordType === 'WASTE') statusUpdates.push(db.wasteRecord.update({ where: { id: t.recordId }, data: update }))
      if (t.recordType === 'PEOPLE') statusUpdates.push(db.workforceRecord.update({ where: { id: t.recordId }, data: update }))
      if (t.recordType === 'SAFETY') statusUpdates.push(db.safetyRecord.update({ where: { id: t.recordId }, data: update }))

      perRecord.push({ recordType: t.recordType, recordId: t.recordId, validationStatus, errors: errorCount, warnings: warningCount })
    }

    await Promise.all([...persistJobs, ...statusUpdates])

    await db.soAuditLog.create({
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
