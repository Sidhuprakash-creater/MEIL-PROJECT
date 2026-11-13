import { NextRequest, NextResponse, after } from 'next/server'
import { getCurrentUser } from '@/lib/pu/session'
import { db } from '@/lib/pu/db'
import { ensureLevelRecordsLoaded, saveManyLevelRecords } from '@/lib/pu/level-records'
import { appendActivity, appendAudit, appendHistory, primaryRoleLabel } from '@/lib/pu/workflow'
import { invalidatePaServerCache } from '@/lib/project-admin/server'
import { resolveProjectForUser } from '@/lib/pu/scope'
import { invalidatePuOverviewCache, invalidatePuSubmissionsCache, invalidatePuNotificationsCache } from '@/lib/portal-cache'

export const runtime = 'nodejs'

interface MetricDetail {
  label: string
  value: string | number
  unit?: string
}

/* Metrics are derived from the ACTUAL submitted record data â€” never from demo
   defaults. Per-source items become one metric row each; scalar fallbacks only
   surface values the user actually entered. */
function computeModuleMetrics(moduleKey: string, data: Record<string, any> = {}, calculation?: Record<string, any> | null): {
  metricName: string
  metricValue: number
  metricUnit: string
  values: MetricDetail[]
} {
  const m = String(moduleKey || '').toUpperCase()
  const values: MetricDetail[] = []
  const items: any[] = Array.isArray(data?.items) ? data.items : []

  const fmt = (v: any) => {
    const n = Number(v)
    return Number.isFinite(n) ? n.toLocaleString() : String(v ?? '')
  }

  let metricName = 'Data Points'
  let metricValue = 0
  let metricUnit = ''

  for (const it of items) {
    if (m === 'ENERGY') {
      metricName = 'Total Energy Consumption'
      metricUnit = 'GJ'
      values.push({ label: it.energySource || 'Energy source', value: fmt(it.consumptionQuantity), unit: it.unit || '' })
      if (Number(it.estTco2e) > 0) {
        values.push({ label: `${it.energySource || 'Source'} â€” Est. GHG`, value: Number(it.estTco2e).toFixed(2), unit: 'tCO2e' })
      }
      metricValue += Number(it.estGj) || 0
    } else if (m === 'WATER') {
      metricName = 'Total Water Withdrawal'
      metricUnit = 'kL'
      values.push({ label: it.waterSource || 'Water source', value: fmt(it.waterQuantity), unit: it.unit || 'kL' })
      if (Number(it.waterReusedRecycled) > 0) {
        values.push({ label: `${it.waterSource || 'Source'} â€” Reused/Recycled`, value: fmt(it.waterReusedRecycled), unit: it.unit || 'kL' })
      }
      metricValue += Number(it.waterQuantity) || 0
    } else if (m === 'EMISSIONS') {
      metricName = 'GHG Footprint (Scope 1+2)'
      metricUnit = 'tCO2e'
      const scopeTag = String(it.emissionDataType || '').includes('1')
        ? 'Scope 1'
        : String(it.emissionDataType || '').includes('2')
          ? 'Scope 2'
          : String(it.emissionDataType || '').includes('3')
            ? 'Scope 3'
            : 'Air / Monitoring'
      values.push({ label: `${scopeTag} â€” ${it.emissionSource || it.sourceCategory || 'Source'}`, value: Number(it.estTco2e || 0).toFixed(2), unit: 'tCO2e' })
      if (scopeTag === 'Scope 1' || scopeTag === 'Scope 2') metricValue += Number(it.estTco2e) || 0
    } else if (m === 'WASTE') {
      metricName = 'Total Waste Generated'
      metricUnit = String(it.unit || 'MT')
      values.push({ label: it.wasteCategory || 'Waste category', value: fmt(it.quantityGenerated), unit: String(it.unit || 'MT') })
      metricValue += Number(it.quantityGenerated) || 0
    } else if (m === 'COMPLIANCE') {
      metricName = 'Permits & Regulatory Approvals'
      metricUnit = 'permits'
      values.push({ label: it.permitConsentType || 'Permit', value: it.permitNumber || 'â€”', unit: it.permitStatus || '' })
      metricValue += 1
    } else if (m === 'INITIATIVES') {
      metricName = 'Energy Conservation Initiatives'
      metricUnit = 'programs'
      values.push({ label: it.title || it.category || it.initiativeName || 'Initiative', value: it.physicalOutputQuantity || it.output || 'â€”', unit: it.unit || '' })
      metricValue += 1
    } else {
      // SAFETY / TRAINING / INCIDENTS â€” render item label/value when present
      const label = it.title || it.trainingName || it.incidentType || it.category || 'Entry'
      const value = it.value ?? it.count ?? it.quantity ?? it.hours ?? 'â€”'
      values.push({ label, value: fmt(value), unit: it.unit || '' })
      metricValue += Number(value) || 0
    }
  }

  if (items.length === 0) {
    // Scalar-only levels: surface only the fields the user actually filled.
    const SKIP = new Set(['items', 'evidenceId', 'evidenceIds', 'viewStep', 'stagedAt', 'evidenceFileName'])
    for (const [k, v] of Object.entries(data || {})) {
      if (SKIP.has(k)) continue
      if (v === '' || v === null || v === undefined) continue
      if (Array.isArray(v) && v.length === 0) continue
      const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())
      values.push({ label, value: typeof v === 'number' ? fmt(v) : String(v), unit: '' })
    }
    if (calculation?.calculatedValue != null) {
      metricValue = Number(calculation.calculatedValue) || 0
      metricUnit = calculation.resultUnit || metricUnit
    }
  }

  metricValue = +metricValue.toFixed(2)
  if (!metricUnit) metricUnit = calculation?.resultUnit || ''
  return { metricName, metricValue, metricUnit, values }
}

const BRSR_LEVELS = [
  { level: 1, moduleKey: 'ENERGY', category: 'ENERGY', name: 'Level 1 â€” Energy Consumption' },
  { level: 2, moduleKey: 'WATER', category: 'WATER', name: 'Level 2 â€” Water Management' },
  { level: 3, moduleKey: 'EMISSIONS', category: 'EMISSIONS', name: 'Level 3 â€” GHG Emissions & Air Quality' },
  { level: 4, moduleKey: 'WASTE', category: 'WASTE', name: 'Level 4 â€” Waste Management' },
  { level: 5, moduleKey: 'SAFETY', category: 'SAFETY', name: 'Level 5 â€” Health & Safety' },
  { level: 6, moduleKey: 'TRAINING', category: 'WORKFORCE', name: 'Level 6 â€” Training & Workforce Well-being' },
  { level: 7, moduleKey: 'COMPLIANCE', category: 'COMPLIANCE', name: 'Level 7 â€” Environmental Permits & Compliance' },
  { level: 8, moduleKey: 'INCIDENTS', category: 'SAFETY', name: 'Level 8 â€” Environmental Incidents & Grievances' },
  { level: 9, moduleKey: 'INITIATIVES', category: 'CSR', name: 'Level 9 â€” Energy & Environmental Initiatives' },
]

/* UI level â†” internal store level aliases â€” ONE DIRECTION ONLY: the visible
   Level 5 (Permits) stages under `l7-â€¦` and visible Level 6 (Initiatives)
   under `l9-â€¦`, so internal levels 7/9 probe the UI keys. The reverse must
   NOT be probed: legacy levels 5 (Safety) / 6 (Training) have no UI form
   anymore, and aliasing them to the l7/l9 keys duplicated the same data into
   fake TRAINING/SAFETY submissions. */
const LEVEL_ALIASES: Record<number, number[]> = { 7: [5], 9: [6] }

function entryHasData(entry: any): boolean {
  if (!entry || typeof entry !== 'object') return false
  if (Array.isArray(entry.items) && entry.items.length > 0) return true
  return Object.entries(entry).some(([k, v]) =>
    k === 'viewStep' ? false :
    typeof v === 'string' ? v.trim() !== '' :
    v != null && !(Array.isArray(v) && v.length === 0),
  )
}

export async function POST(req: NextRequest) {
  /* Hydrate the level-records store from the DB blob before first read (Vercel read-only FS). */
  await ensureLevelRecordsLoaded().catch(() => {});
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    let { projectId, reportingPeriodId, allData = {} } = body

    // 1. Resolve project
    let project = projectId ? await db.project.findUnique({
      where: { id: projectId },
      include: { businessUnit: { include: { subsidiary: true } } },
    }) : null

    /* SCOPE: a project-scoped contributor may ONLY submit for their own
       project â€” the server decides, never the client. */
    try {
      const scoped = await resolveProjectForUser(user, projectId, true)
      project = await db.project.findUnique({
        where: { id: scoped.id },
        include: { businessUnit: { include: { subsidiary: true } } },
      })
    } catch (e: any) {
      if (e?.status) return NextResponse.json({ error: e.message }, { status: e.status })
      throw e
    }

    if (!project) {
      return NextResponse.json({ error: 'No active project found' }, { status: 404 })
    }

    // 2. Resolve reporting period
    let period = reportingPeriodId ? await db.reportingPeriod.findUnique({
      where: { id: reportingPeriodId },
    }) : null

    if (!period) {
      period = await db.reportingPeriod.findFirst({
        where: { status: 'OPEN' },
        orderBy: { startDate: 'desc' },
      }) || await db.reportingPeriod.findFirst()
    }

    if (!period) {
      return NextResponse.json({ error: 'No reporting period found' }, { status: 404 })
    }

    const now = new Date()
    const projId = project.id
    const perId = period.id
    const buId = project.businessUnitId || user.scopes.find((s) => s.scopeType === 'BUSINESS_UNIT')?.scopeId || null
    const subId = project.businessUnit?.subsidiaryId || user.scopes.find((s) => s.scopeType === 'SUBSIDIARY')?.scopeId || null

    const submittedList: any[] = []
    const consolidatedHighlights: MetricDetail[] = []

    // 3. Batch fetch for existing submissions (evidence is resolved per record below)
    const existingSubs = await db.submission.findMany({
      where: {
        projectId: projId,
        reportingPeriodId: perId,
        module: { in: [...BRSR_LEVELS.map(l => l.moduleKey), 'ALL_LEVELS'] },
      },
    })

    const existingMap = new Map(existingSubs.map(s => [s.module, s]))

    /* Persist every FILLED level with ONE read + ONE write of the store file.
       Forms stage data under scoped keys `l{n}-{projectId}-{periodId}` (with
       legacy aliases for UI levels 5/6 â†’ level7/level9); levels the user did
       not fill are skipped entirely â€” final submission does NOT require all
       levels to be filled. */
    const resolveLevelData = (lvl: { level: number; moduleKey: string }): Record<string, any> => {
      const candidates = [lvl.level, ...(LEVEL_ALIASES[lvl.level] ?? [])]
      for (const n of candidates) {
        const scoped = allData[`l${n}-${projId}-${perId}`]
        if (entryHasData(scoped)) return scoped
      }
      for (const n of candidates) {
        const unscoped = allData[`level${n}`]
        if (entryHasData(unscoped)) return unscoped
      }
      const byModule = allData[lvl.moduleKey.toLowerCase()]
      return entryHasData(byModule) ? byModule : {}
    }

    const recordsToSave = BRSR_LEVELS.map((lvl) => {
      const levelKey = `level${lvl.level}`
      const levelData = resolveLevelData(lvl)
      return {
        level: lvl.level,
        levelKey,
        levelName: lvl.name,
        module: lvl.moduleKey,
        projectId: projId,
        reportingPeriodId: perId,
        status: 'SUBMITTED' as const,
        validationStatus: 'PASSED' as const,
        data: levelData,
      }
    }).filter((r) => entryHasData(r.data))
    const savedRecords = saveManyLevelRecords(recordsToSave)
    const recByLevel = new Map(savedRecords.map((r) => [r.levelKey, r]))

    /* Evidence for a submission = ONLY what the user actually attached to that
       level's record (record-level evidenceId/evidenceIds + per-item ids),
       resolved to vault file names. The whole vault is never stamped on every
       submission anymore. */
    const evidenceIdsFor = (rec: any): string[] => {
      const ids = new Set<string>()
      if (rec?.evidenceId) ids.add(String(rec.evidenceId))
      for (const eid of Array.isArray(rec?.evidenceIds) ? rec.evidenceIds : []) if (eid) ids.add(String(eid))
      for (const it of Array.isArray(rec?.data?.items) ? rec.data.items : []) {
        if (it?.evidenceId) ids.add(String(it.evidenceId))
        for (const eid of Array.isArray(it?.evidenceIds) ? it.evidenceIds : []) if (eid) ids.add(String(eid))
      }
      return [...ids]
    }
    const allEvidenceIds = Array.from(new Set(savedRecords.flatMap(evidenceIdsFor)))
    const evidenceRows = allEvidenceIds.length
      ? await db.evidence.findMany({ where: { id: { in: allEvidenceIds } }, select: { id: true, fileName: true } })
      : []
    const evidenceNameById = new Map(evidenceRows.map((e) => [e.id, e.fileName || e.id]))
    const evidenceNamesFor = (rec: any): string[] =>
      Array.from(new Set(evidenceIdsFor(rec).map((id) => evidenceNameById.get(id)).filter(Boolean))) as string[]

    // Process only the levels that actually carried data â€” upserts run concurrently
    const filledLevels = BRSR_LEVELS.filter((lvl) => recByLevel.has(`level${lvl.level}`))
    const upsertPromises = filledLevels.map(async (lvl) => {
      const levelKey = `level${lvl.level}`
      const rec = recByLevel.get(levelKey)!
      const levelData = rec.data || {}
      const metrics = computeModuleMetrics(lvl.moduleKey, levelData, rec.calculation as any)
      const levelEvidence = evidenceNamesFor(rec)

      const submissionTitle = `${project.name} â€” ${lvl.name} (${(period as any).periodLabel || (period as any).label || 'Q4 FY 2025-26'})`
      const existingSub = existingMap.get(lvl.moduleKey)

      let sub
      if (existingSub) {
        sub = await db.submission.update({
          where: { id: existingSub.id },
          data: {
            title: submissionTitle,
            category: lvl.category,
            status: 'SUBMITTED',
            submittedAt: now,
            submittedById: user.id,
            businessUnitId: buId,
            subsidiaryId: subId,
            metricName: metrics.metricName,
            metricValue: metrics.metricValue,
            metricUnit: metrics.metricUnit,
            values: JSON.stringify(metrics.values),
            recordIds: JSON.stringify([rec.id]),
            evidence: JSON.stringify(levelEvidence),
            evidenceCount: levelEvidence.length,
            completionPct: 100,
            validationPassed: 1,
            validationErrors: 0,
            updatedAt: now,
          },
        })
      } else {
        sub = await db.submission.create({
          data: {
            projectId: projId,
            reportingPeriodId: perId,
            businessUnitId: buId,
            subsidiaryId: subId,
            module: lvl.moduleKey,
            category: lvl.category,
            title: submissionTitle,
            status: 'SUBMITTED',
            ref: `PU-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
            dueDate: period.submissionDeadline || new Date(Date.now() + 7 * 86400 * 1000),
            submittedAt: now,
            submittedById: user.id,
            metricName: metrics.metricName,
            metricValue: metrics.metricValue,
            metricUnit: metrics.metricUnit,
            values: JSON.stringify(metrics.values),
            recordIds: JSON.stringify([rec.id]),
            evidence: JSON.stringify(levelEvidence),
            evidenceCount: levelEvidence.length,
            completionPct: 100,
            validationPassed: 1,
            validationErrors: 0,
          },
        })
      }

      return {
        item: {
          id: sub.id,
          level: lvl.level,
          name: lvl.name,
          category: lvl.category,
          metric: `${metrics.metricValue} ${metrics.metricUnit}`,
        },
        highlight: {
          label: lvl.name.split('â€”')[1]?.trim() || lvl.name,
          value: `${metrics.metricValue} ${metrics.metricUnit}`.trim(),
        }
      }
    })

    const results = await Promise.all(upsertPromises)
    results.forEach(r => {
      submittedList.push(r.item)
      consolidatedHighlights.push(r.highlight)
    })

    if (submittedList.length === 0) {
      return NextResponse.json({ error: 'No level data found to submit â€” capture data in at least one level first.' }, { status: 400 })
    }

    // 4. Create Master Consolidated Disclosure Dossier for the Project Admin
    const dossierTitle = `${project.name} â€” Complete Site ESG Disclosure Package (${(period as any).periodLabel || (period as any).label || 'FY 2025-26'})`
    const existingDossier = existingMap.get('ALL_LEVELS')

    /* The dossier links EVERY saved level record so the PU detail modal and the
       PA review window can render all per-source items + evidence, and the
       collection-status Evidence column reads COMPLETE. */
    const dossierRecordIds = savedRecords.map((r) => r.id)
    const dossierEvidence = Array.from(new Set(savedRecords.flatMap(evidenceNamesFor)))

    const dossierData = {
      title: dossierTitle,
      category: 'ENVIRONMENT',
      module: 'ALL_LEVELS',
      status: 'SUBMITTED',
      submittedAt: now,
      submittedById: user.id,
      projectId: projId,
      reportingPeriodId: perId,
      businessUnitId: buId,
      subsidiaryId: subId,
      metricName: 'Consolidated Site Disclosures',
      metricValue: submittedList.length,
      metricUnit: 'Levels Completed',
      values: JSON.stringify(consolidatedHighlights),
      recordIds: JSON.stringify(dossierRecordIds),
      evidence: JSON.stringify(dossierEvidence),
      evidenceCount: dossierEvidence.length,
      completionPct: Math.round((submittedList.length / BRSR_LEVELS.length) * 100),
      validationPassed: submittedList.length,
      validationErrors: 0,
      updatedAt: now,
    }

    const masterDossier = existingDossier
      ? await db.submission.update({ where: { id: existingDossier.id }, data: dossierData })
      : await db.submission.create({
          data: {
            ...dossierData,
            ref: `DOS-${project.code}-${Date.now().toString(36).toUpperCase()}`,
            dueDate: period.submissionDeadline || new Date(Date.now() + 7 * 86400 * 1000),
          },
        })

    // 5. Invalidate caches immediately
    invalidatePuOverviewCache()
    invalidatePuSubmissionsCache()
    invalidatePuNotificationsCache()
    invalidatePaServerCache()

    // 6. Generate real-time notification for Project Admin
    const roleLabel = primaryRoleLabel(user)
    /* REAL EMAIL â€” every submission emails the project's own admins. Runs via
       next/server `after()` so it survives the serverless response freeze
       (a bare fire-and-forget promise never executed in production). */
    after(async () => {
      try {
        const { sendSubmissionReceivedEmail } = await import("@/lib/notify/email")
        const admins = await db.user.findMany({
          where: { projectId: projId, role: "PROJECT_ADMIN" },
          select: { email: true, name: true },
        })
        const periodLabel = (period as any).periodLabel || (period as any).label || "FY 2026-27"
        for (const admin of admins) {
          const res = await sendSubmissionReceivedEmail({
            to: admin.email,
            adminName: admin.name,
            submitterName: user.name,
            submitterRole: roleLabel,
            projectName: project.name,
            periodLabel,
            levelsSubmitted: submittedList.length,
            levelsTotal: BRSR_LEVELS.length,
            packageRef: masterDossier.ref,
          })
          if (!res.sent) console.warn("Submission email not sent:", res.reason)
          else console.log("[email] submission alert sent to", admin.email, "via", res.transport)
        }
      } catch (mailErr) {
        console.warn("Submission email dispatch failed:", mailErr)
      }
    })
    Promise.allSettled([
      db.notification.create({
        data: {
          ntype: 'SUBMISSION',
          title: `Site ESG Package Submitted: ${project.name}`,
          body: `${user.name} (${roleLabel}) submitted ${submittedList.length} of ${BRSR_LEVELS.length} BRSR Environmental disclosure levels for ${project.name} (${(period as any).periodLabel || (period as any).label || 'Q4'}). Ready for Project Admin review & approval.`,
          severity: 'INFO',
          linkView: 'submissions',
          refId: masterDossier.id,
          subsidiaryId: subId,
        },
      }),
      appendActivity({
        projectId: projId,
        actorId: user.id,
        actorName: user.name,
        actorRole: roleLabel,
        action: 'SUBMIT',
        title: `${submittedList.length} Site Level(s) Submitted to Project Admin`,
        description: `Disclosure package submitted for ${project.name} (${(period as any).periodLabel || (period as any).label}).`,
        module: 'ALL_LEVELS',
        status: 'SUBMITTED',
      }),
      appendAudit({
        actorId: user.id,
        actorName: user.name,
        actorRole: roleLabel,
        action: 'SUBMIT',
        entityType: 'SubmissionPackage',
        entityId: masterDossier.id,
        newState: { levelsSubmitted: submittedList.length, project: project.name, status: 'SUBMITTED' },
        reason: 'Site data package submitted to Project Admin at once',
      }),
    ]).catch(() => {})

    return NextResponse.json({
      ok: true,
      message: `${submittedList.length} of ${BRSR_LEVELS.length} environmental levels submitted successfully to Project Admin!`,
      dossierId: masterDossier.id,
      submittedCount: submittedList.length,
      items: submittedList,
      timestamp: now.toISOString(),
      contributor: {
        name: user.name,
        email: user.email,
        role: roleLabel,
      },
    })
  } catch (err: any) {
    console.error('POST /api/pu/data-entry/submit-all error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to submit all levels' }, { status: 500 })
  }
}
