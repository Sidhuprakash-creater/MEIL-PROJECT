import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/so/session'
import { resolveIndicator } from '@/lib/so/brsr-resolver'

export const runtime = 'nodejs'

// POST /api/brsr/generate — generate a BRSR report from real resolved source data.
// Body: { frameworkId, reportingYear, scopeType, scopeId, scopeName }
// Permission: brsr.generate
export async function POST(req: NextRequest) {
  let user
  try {
    user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    // RBAC: require the brsr.generate permission (grant it to a role when
    // reviewer / BRSR manager users are re-added).
    const { userHasPermission } = await import('@/lib/so/session')
    const allowed = await userHasPermission(user.id, 'brsr.generate')
    if (!allowed) return NextResponse.json({ error: 'Forbidden — brsr.generate required' }, { status: 403 })
  } catch (e: any) {
    return NextResponse.json({ error: 'Auth check failed', detail: String(e?.message ?? e) }, { status: 500 })
  }

  try {
    const body = await req.json()
    const frameworkId = String(body.frameworkId ?? '')
    const reportingYear = Number(body.reportingYear) || null
    const scopeType = body.scopeType ? String(body.scopeType) : null
    const scopeId = body.scopeId ? String(body.scopeId) : null
    const scopeName = body.scopeName ? String(body.scopeName) : null

    if (!frameworkId) {
      return NextResponse.json({ error: 'frameworkId required' }, { status: 400 })
    }

    const framework = await db.brsrFramework.findUnique({
      where: { id: frameworkId },
      include: {
        sections: { orderBy: { sortOrder: 'asc' } },
        principles: { orderBy: { sortOrder: 'asc' } },
        questions: {
          orderBy: { sortOrder: 'asc' },
          include: { section: true, principle: true },
        },
      },
    })
    if (!framework) {
      return NextResponse.json({ error: 'Framework not found' }, { status: 404 })
    }

    // Resolve each question's indicator from real DB source data.
    type ResolvedQuestion = {
      questionCode: string
      questionText: string
      answerType: string
      unit: string | null
      evidenceRequired: boolean
      section: { code: string; name: string } | null
      principle: { code: string; name: string } | null
      mappingSource: string | null
      resolvedValue: number | string | null
      resolvedUnit: string | null
      sourceRecordIds: string[]
      sourceRecordType: string | null
      status: string
      derivation: string | null
    }
    const resolvedQuestions: ResolvedQuestion[] = []
    for (const q of framework.questions) {
      const resolved = await resolveIndicator(q.mappingSource, q.unit, {
        scopeType,
        scopeId,
      })
      resolvedQuestions.push({
        questionCode: q.questionCode,
        questionText: q.questionText,
        answerType: q.answerType,
        unit: q.unit,
        evidenceRequired: q.evidenceRequired,
        section: q.section ? { code: q.section.code, name: q.section.name } : null,
        principle: q.principle ? { code: q.principle.code, name: q.principle.name } : null,
        mappingSource: q.mappingSource,
        resolvedValue: resolved.resolvedValue,
        resolvedUnit: resolved.resolvedUnit,
        sourceRecordIds: resolved.sourceRecordIds,
        sourceRecordType: resolved.sourceRecordType,
        status: resolved.status,
        derivation: resolved.derivation,
      })
    }

    // Group by section for the structured report.
    const bySection: Record<string, any> = {}
    for (const sq of resolvedQuestions) {
      const sKey = sq.section?.code ?? 'UNGROUPED'
      if (!bySection[sKey]) {
        bySection[sKey] = {
          sectionCode: sKey,
          sectionName: sq.section?.name ?? 'Ungrouped',
          questions: [],
        }
      }
      bySection[sKey].questions.push(sq)
    }

    // Readiness summary — same calculation as /api/brsr/readiness.
    const answers = await db.brsrAnswer.findMany({ where: { frameworkId } })
    const ready = answers.filter(a => ['APPROVED', 'LOCKED', 'EVIDENCE_VERIFIED'].includes(a.status)).length
    const readiness = answers.length > 0 ? Math.round((ready / answers.length) * 1000) / 10 : 0

    const reportContent = {
      meta: {
        framework: { id: framework.id, name: framework.name, version: framework.version, reportingYear: framework.reportingYear, tier: framework.tier },
        reportingYear: reportingYear ?? framework.reportingYear,
        scope: { scopeType, scopeId, scopeName },
        generatedAt: new Date().toISOString(),
        generatedBy: { id: user.id, name: user.name, roles: user.roles.map(r => r.key) },
        totals: { questions: framework.questions.length, resolvedFromSource: resolvedQuestions.filter(q => q.status === 'RESOLVED').length },
      },
      readiness: { overallPct: readiness, ready, total: answers.length },
      sections: Object.values(bySection),
      principles: framework.principles.map(p => ({ code: p.code, name: p.name, title: p.title })),
      trace: { note: 'Each question value resolved server-side from approved source records via mappingSource. No hardcoded content.' },
    }

    // Always create a NEW Report row (never overwrite historical reports).
    // Determine next version number.
    const lastReport = await db.report.findFirst({
      where: { reportType: 'BRSR', frameworkId },
      orderBy: { version: 'desc' },
      select: { version: true },
    })
    const nextVersion = (lastReport?.version ?? 0) + 1

    const fileName = `MEIL-BRSR-Annexure-I-FY${reportingYear ?? framework.reportingYear}-v${nextVersion}.pdf`

    const report = await db.report.create({
      data: {
        reportType: 'BRSR',
        frameworkId,
        reportingYear: reportingYear ?? framework.reportingYear,
        periodLabel: null,
        scopeType,
        scopeId,
        scopeName,
        generatedBy: user.id,
        generatedByName: user.name,
        status: 'COMPLETED',
        fileName,
        fileType: 'PDF',
        content: JSON.stringify(reportContent),
        version: nextVersion,
      },
    })

    // Audit REPORT_GENERATE.
    await db.soAuditLog.create({
      data: {
        actorId: user.id,
        actorName: user.name,
        actorRole: user.roles.map(r => r.name).join(', '),
        action: 'REPORT_GENERATE',
        entityType: 'Report',
        entityId: report.id,
        newState: JSON.stringify({ reportType: 'BRSR', frameworkId, version: nextVersion, fileName }),
        reason: `BRSR SEBI Annexure I PDF report v${nextVersion} generated for ${scopeName ?? scopeId ?? 'group'}`,
      },
    })

    return NextResponse.json({
      report,
      content: reportContent,
      downloadUrl: `/api/reports/${report.id}/download`,
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to generate BRSR report', detail: String(e?.message ?? e) }, { status: 500 })
  }
}
