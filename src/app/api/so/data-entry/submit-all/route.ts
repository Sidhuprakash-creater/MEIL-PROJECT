import { NextRequest, NextResponse } from 'next/server'
import { ensureSoLevelRecordsLoaded, type LevelRecord } from '@/lib/so/level-records'
import { getCurrentUser } from '@/lib/so/session'
import { db } from '@/lib/db'
import {
  appendActivity,
  appendAudit,
  appendHistory,
  primaryRoleLabel,
} from '@/lib/so/workflow'
import { invalidateSoSubmissionsCache } from '@/lib/portal-cache'

export const runtime = 'nodejs'

/* POST /api/so/data-entry/submit-all — Submit-All for the site-ops portal.
   The shared DataEntryModule posts its FULL form-state cache (`formStateRef.current`)
   here. Each bucket is keyed `l{n}-{projectId}-{periodId}` (legacy unscoped
   `level{n}` keys supported) and contains BARE form data — NOT a wrapped
   single-level POST body. This route therefore:
     1. resolves project + period server-side,
     2. picks the filled level buckets for the CURRENT project+period scope
        (UI Level 5 Permits stages under l7, UI Level 6 Initiatives under l9),
     3. WRAPS each payload ({level, module, projectId, reportingPeriodId, data,
        submitForReview}) and delegates to the real single-level POST handler
        in ../route.ts so per-level validation, LevelRecord persistence, the
        soSubmission row AND the unified db.submission mirror all run, then
     4. upserts the consolidated ALL_LEVELS dossier row the shared client's
        post-submit verification (and the Project Admin console) requires.
   Response shape mirrors the PU twin: { ok, items, submittedCount, dossierId,
   timestamp, contributor } — the shared success modal reads those fields. */

const BRSR_LEVELS = [
  { level: 1, moduleKey: 'ENERGY', category: 'ENERGY', name: 'Level 1 — Energy Consumption' },
  { level: 2, moduleKey: 'WATER', category: 'WATER', name: 'Level 2 — Water Management' },
  { level: 3, moduleKey: 'EMISSIONS', category: 'EMISSIONS', name: 'Level 3 — GHG Emissions & Air Quality' },
  { level: 4, moduleKey: 'WASTE', category: 'WASTE', name: 'Level 4 — Waste Management' },
  { level: 5, moduleKey: 'SAFETY', category: 'SAFETY', name: 'Level 5 — Health & Safety' },
  { level: 6, moduleKey: 'TRAINING', category: 'WORKFORCE', name: 'Level 6 — Training & Workforce Well-being' },
  { level: 7, moduleKey: 'COMPLIANCE', category: 'COMPLIANCE', name: 'Level 7 — Environmental Permits & Compliance' },
  { level: 8, moduleKey: 'INCIDENTS', category: 'SAFETY', name: 'Level 8 — Environmental Incidents & Grievances' },
  { level: 9, moduleKey: 'INITIATIVES', category: 'CSR', name: 'Level 9 — Energy & Environmental Initiatives' },
]

/* UI level ↔ internal store level aliases — ONE DIRECTION ONLY (same map as
   the PU twin): visible Level 5 (Permits) stages under `l7-…` and visible
   Level 6 (Initiatives) under `l9-…`, so internal levels 7/9 probe the UI
   keys. The reverse must NOT be probed: legacy levels 5 (Safety) / 6
   (Training) have no UI form anymore and aliasing them duplicated data into
   fake TRAINING/SAFETY submissions. */
const LEVEL_ALIASES: Record<number, number[]> = { 7: [5], 9: [6] }

/** A bucket counts as "filled" when it has staged items OR any non-empty
    value — mirroring the PU twin's entryHasData semantics (the previous SO
    implementation only looked at strings / numbers > 0 and silently skipped
    valid buckets). */
function entryHasData(entry: unknown): boolean {
  if (!entry || typeof entry !== 'object') return false
  const e = entry as Record<string, unknown>
  if (Array.isArray(e.items) && e.items.length > 0) return true
  return Object.entries(e).some(([k, v]) =>
    k === 'viewStep' ? false :
    typeof v === 'string' ? v.trim() !== '' :
    v != null && !(Array.isArray(v) && v.length === 0),
  )
}

/** Resolve the staged bucket for a level within the CURRENT project+period
    scope only — stale buckets from other projects/periods are never
    submitted. */
function resolveLevelData(
  allData: Record<string, Record<string, any>>,
  lvl: { level: number },
  projId: string,
  perId: string,
): Record<string, any> | null {
  const candidates = [lvl.level, ...(LEVEL_ALIASES[lvl.level] ?? [])]
  for (const n of candidates) {
    const scoped = allData[`l${n}-${projId}-${perId}`]
    if (entryHasData(scoped)) return scoped
  }
  for (const n of candidates) {
    const unscoped = allData[`level${n}`]
    if (entryHasData(unscoped)) return unscoped
  }
  return null
}

export async function POST(req: NextRequest) {
  /* Hydrate the level-records store from the DB blob before first read. */
  await ensureSoLevelRecordsLoaded().catch(() => {})
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const { projectId, reportingPeriodId } = body || {}
    const allData: Record<string, Record<string, any>> =
      body?.allData && typeof body.allData === 'object' ? body.allData : {}

    // 1. Resolve project — server decides, never the client
    let project = projectId
      ? await db.project.findUnique({
          where: { id: projectId },
          select: {
            id: true, name: true, code: true,
            businessUnitId: true,
            businessUnit: { select: { id: true, subsidiaryId: true } },
          },
        })
      : null

    if (!project) {
      /* Fall back to the caller's project scope (environment data users are
         project-scoped) instead of hard-failing. */
      const scopeProj = user.scopes.find((s) => s.scopeType === 'PROJECT')?.scopeId
      if (scopeProj) {
        project = await db.project.findUnique({
          where: { id: scopeProj },
          select: {
            id: true, name: true, code: true,
            businessUnitId: true,
            businessUnit: { select: { id: true, subsidiaryId: true } },
          },
        })
      }
    }

    if (!project) {
      return NextResponse.json(
        { error: 'Select a valid project before submitting — no matching project found in your scope.' },
        { status: 400 },
      )
    }

    // 2. Resolve reporting period — by id, else the latest OPEN period
    let period = reportingPeriodId
      ? await db.reportingPeriod.findUnique({ where: { id: reportingPeriodId } })
      : null
    if (!period) {
      period =
        (await db.reportingPeriod.findFirst({ where: { status: 'OPEN' }, orderBy: { startDate: 'desc' } })) ||
        (await db.reportingPeriod.findFirst())
    }
    if (!period) {
      return NextResponse.json({ error: 'No reporting period found' }, { status: 404 })
    }

    const projId = project.id
    const perId = period.id
    const now = new Date()

    // 3. Delegate every FILLED level to the real single-level POST handler.
    const { POST: postSingleLevel } = await import('../route')

    const submittedList: Array<{ level: number; name: string; category: string; module: string; metric: string; recordId: string }> = []
    const highlights: Array<{ label: string; value: string; unit?: string }> = []
    const dossierRecordIds: string[] = []
    const dossierEvidenceIds = new Set<string>()
    const results: Array<{ key: string; level: number; ok: boolean; error?: string }> = []
    let totalValidationErrors = 0

    for (const lvl of BRSR_LEVELS) {
      const bucket = resolveLevelData(allData, lvl, projId, perId)
      if (!bucket) continue // level the user never filled — skipped entirely

      const evidenceId = bucket.evidenceId || undefined
      const evidenceIds = Array.isArray(bucket.evidenceIds) ? bucket.evidenceIds.filter(Boolean) : []
      for (const eid of [evidenceId, ...evidenceIds]) if (eid) dossierEvidenceIds.add(String(eid))
      if (Array.isArray(bucket.items)) {
        for (const it of bucket.items) {
          if (it?.evidenceId) dossierEvidenceIds.add(String(it.evidenceId))
          for (const eid of Array.isArray(it?.evidenceIds) ? it.evidenceIds : []) if (eid) dossierEvidenceIds.add(String(eid))
        }
      }

      /* The critical fix: wrap the bare form bucket into the shape the
         single-level handler requires (level / projectId / reportingPeriodId /
         data) and mark it submitForReview so records + submissions land as
         SUBMITTED, not DRAFT. */
      /* Forward auth cookies but drop content-length — the inner body differs
         in size from the outer request and a stale length can break dispatch. */
      const fwdHeaders = new Headers(req.headers)
      fwdHeaders.delete('content-length')
      fwdHeaders.delete('transfer-encoding')
      const inner = new NextRequest(new URL('/api/so/data-entry', req.url), {
        method: 'POST',
        headers: fwdHeaders,
        body: JSON.stringify({
          level: lvl.level,
          levelKey: `level${lvl.level}`,
          levelName: lvl.name,
          module: lvl.moduleKey,
          projectId: projId,
          reportingPeriodId: perId,
          data: bucket,
          evidenceId,
          evidenceIds,
          submitForReview: true,
        }),
      })

      try {
        const res = await postSingleLevel(inner)
        const j = await res.json().catch(() => ({}))
        if (res.ok) {
          const rec: LevelRecord | undefined = j?.record
          const calc = j?.calculation
          const recId = String(rec?.id || '')
          const errCount = Array.isArray(j?.issues)
            ? j.issues.filter((i: any) => i?.severity === 'ERROR' || i?.severity === 'BLOCKING').length
            : 0
          totalValidationErrors += errCount
          if (recId) dossierRecordIds.push(recId)
          const metric = calc?.calculatedValue != null
            ? `${calc.calculatedValue} ${calc.resultUnit || ''}`.trim()
            : `${Array.isArray(bucket.items) && bucket.items.length ? bucket.items.length : 1} item(s)`
          submittedList.push({
            level: lvl.level,
            name: lvl.name,
            category: lvl.category,
            module: lvl.moduleKey,
            metric,
            recordId: recId,
          })
          highlights.push({ label: lvl.name.split('—')[1]?.trim() || lvl.name, value: metric })
          results.push({ key: `l${lvl.level}`, level: lvl.level, ok: true })
        } else {
          results.push({ key: `l${lvl.level}`, level: lvl.level, ok: false, error: j?.error || `Level ${lvl.level} failed validation` })
        }
      } catch (e: any) {
        results.push({ key: `l${lvl.level}`, level: lvl.level, ok: false, error: e?.message || `Level ${lvl.level} failed` })
      }
    }

    if (submittedList.length === 0) {
      const firstError = results.find((r) => !r.ok)?.error
      return NextResponse.json(
        {
          error:
            results.length === 0
              ? 'No level data found to submit — capture data in at least one level first (fill a form and stage/save it before Submit All).'
              : `No levels could be submitted — ${firstError || 'the payloads failed validation.'}`,
          results,
        },
        { status: 400 },
      )
    }

    // 4. Resolve evidence file names for the dossier
    const evidenceNameById = new Map<string, string>()
    if (dossierEvidenceIds.size > 0) {
      try {
        const rows = await db.evidence.findMany({
          where: { id: { in: [...dossierEvidenceIds] } },
          select: { id: true, fileName: true },
        })
        for (const r of rows) evidenceNameById.set(r.id, r.fileName || r.id)
      } catch {}
    }
    const dossierEvidence = [...dossierEvidenceIds].map((id) => evidenceNameById.get(id) || id)

    // 5. Upsert the consolidated ALL_LEVELS dossier — BOTH ledgers:
    //    soSubmission (the site-ops console + the shared client's verification)
    //    and db.submission (the unified ledger the Project Admin reads).
    const dossierTitle = `${project.name} — Complete Site ESG Disclosure Package (${(period as any).periodLabel || (period as any).label || 'FY 2026-27'})`
    const dossierData = {
      title: dossierTitle,
      status: 'SUBMITTED',
      recordIds: JSON.stringify(dossierRecordIds),
      submittedAt: now,
      submittedBy: user.id,
      completionPct: Math.round((submittedList.length / BRSR_LEVELS.length) * 100),
      evidenceCount: dossierEvidence.length,
      validationPassed: Math.max(1, submittedList.length - (totalValidationErrors > 0 ? 1 : 0)),
      validationErrors: totalValidationErrors,
    }

    let dossier: { id: string } | null = null
    try {
      const existingDossier = await db.soSubmission.findFirst({
        where: { projectId: projId, reportingPeriodId: perId, module: 'ALL_LEVELS' },
        orderBy: { updatedAt: 'desc' },
      })
      dossier = existingDossier
        ? await db.soSubmission.update({ where: { id: existingDossier.id }, data: dossierData })
        : await db.soSubmission.create({
            data: {
              projectId: projId,
              reportingPeriodId: perId,
              module: 'ALL_LEVELS',
              ...dossierData,
            },
          })

      const mirrorOrgScope = {
        businessUnitId: project.businessUnitId || null,
        subsidiaryId: project.businessUnit?.subsidiaryId || null,
      }
      const mirrorExisting = await db.submission.findFirst({
        where: {
          projectId: projId,
          reportingPeriodId: perId,
          module: 'ALL_LEVELS',
          status: { in: ['DRAFT', 'SUBMITTED', 'CHANGES_REQUESTED'] },
        },
        orderBy: { updatedAt: 'desc' },
      })
      const mirrorPayload = {
        ...mirrorOrgScope,
        title: dossierTitle,
        status: 'SUBMITTED' as const,
        submittedAt: now,
        submittedById: user.id,
        recordIds: JSON.stringify(dossierRecordIds),
        evidence: JSON.stringify(dossierEvidence),
        metricName: 'Consolidated Site Disclosures',
        metricValue: submittedList.length,
        metricUnit: 'Levels Completed',
        values: JSON.stringify(highlights),
        completionPct: Math.round((submittedList.length / BRSR_LEVELS.length) * 100),
        validationPassed: Math.max(1, submittedList.length - (totalValidationErrors > 0 ? 1 : 0)),
        validationErrors: totalValidationErrors,
        updatedAt: now,
      }
      if (mirrorExisting) {
        await db.submission.update({ where: { id: mirrorExisting.id }, data: mirrorPayload })
      } else {
        await db.submission.create({
          data: {
            projectId: projId,
            reportingPeriodId: perId,
            module: 'ALL_LEVELS',
            category: 'ENVIRONMENT',
            ref: `DOS-${project.code}-${Date.now().toString(36).toUpperCase()}`,
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            ...mirrorPayload,
          },
        })
      }
    } catch (e) {
      console.warn('Submit-all dossier upsert notice:', e)
    }

    // 6. History / notification / activity / audit — best effort
    const roleLabel = primaryRoleLabel(user)
    /* REAL EMAIL — notify the project's own admins off-platform as well.
       Fire-and-forget: a mail failure never blocks the submission. */
    void (async () => {
      try {
        const { sendSubmissionReceivedEmail } = await import("@/lib/notify/email")
        const admins = await db.user.findMany({
          where: { projectId: projId, role: 'PROJECT_ADMIN' },
          select: { email: true, name: true },
        })
        const periodLabel = (period as any).periodLabel || (period as any).label || 'FY 2026-27'
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
            packageRef: dossier?.id || null,
          })
          if (!res.sent) console.warn('Submission email not sent:', res.reason)
        }
      } catch (mailErr) {
        console.warn('Submission email dispatch failed:', mailErr)
      }
    })()
    Promise.allSettled([
      db.notification.create({
        data: {
          ntype: 'SUBMISSION',
          title: `Site ESG Package Submitted: ${project.name}`,
          body: `${user.name} (${roleLabel}) submitted ${submittedList.length} of ${BRSR_LEVELS.length} BRSR environmental disclosure levels for ${project.name}. Ready for Project Admin review & approval.`,
          severity: 'INFO',
          linkView: 'submissions',
          refId: dossier?.id || '',
          subsidiaryId: project.businessUnit?.subsidiaryId || null,
        },
      }).catch(() => {}),
      appendActivity({
        projectId: projId,
        actorId: user.id,
        actorName: user.name,
        actorRole: roleLabel,
        action: 'SUBMIT',
        title: `${submittedList.length} Site Level(s) Submitted to Project Admin`,
        description: `Disclosure package submitted for ${project.name}.`,
        module: 'ALL_LEVELS',
        status: 'SUBMITTED',
      }).catch(() => {}),
      appendAudit({
        actorId: user.id,
        actorName: user.name,
        actorRole: roleLabel,
        action: 'SUBMIT',
        entityType: 'SubmissionPackage',
        entityId: dossier?.id || 'submit-all',
        newState: { levelsSubmitted: submittedList.length, project: project.name, status: 'SUBMITTED' },
        reason: 'Site data package submitted to Project Admin at once',
      }).catch(() => {}),
      dossier
        ? appendHistory({
            submissionId: dossier.id,
            fromStatus: 'DRAFT',
            toStatus: 'SUBMITTED',
            actorId: user.id,
            actorName: user.name,
            actorRole: roleLabel,
            action: 'SUBMIT',
            comment: `Submitted ${submittedList.length} of ${BRSR_LEVELS.length} levels via Submit All`,
          }).catch(() => {})
        : Promise.resolve(),
    ]).catch(() => {})

    /* Per-level delegations already bust the site-ops caches; re-bust once so
       the aggregate Submit-All response is guaranteed to read fresh state. */
    invalidateSoSubmissionsCache()

    return NextResponse.json({
      ok: true,
      message: `${submittedList.length} of ${BRSR_LEVELS.length} environmental levels submitted successfully to Project Admin!`,
      dossierId: dossier?.id || null,
      submittedCount: submittedList.length,
      items: submittedList,
      results,
      timestamp: now.toISOString(),
      contributor: {
        name: user.name,
        email: user.email,
        role: roleLabel,
      },
    })
  } catch (e: any) {
    console.error('POST /api/so/data-entry/submit-all error:', e)
    return NextResponse.json({ error: e?.message || 'Failed to submit all levels' }, { status: 500 })
  }
}
