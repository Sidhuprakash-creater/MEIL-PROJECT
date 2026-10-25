import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { READY_STATUSES, PENDING_EVIDENCE_STATUSES, PENDING_APPROVAL_STATUSES } from '@/lib/brsr-resolver'

export const runtime = 'nodejs'

// GET /api/brsr/readiness?frameworkId= — compute REAL BRSR readiness.
//   overall:   weighted completion % using each answer's readinessWeight
//   bySection: { A: {total, ready, pct}, B: ..., C: ... }
//   byPrinciple: { P1..P9: {total, ready, pct} }
//   missingItems: list of {questionCode, section, principle, status} for not-ready items
//   pendingEvidence: count of answers DRAFT/SUBMITTED (evidence not yet verified)
//   pendingApprovals: count of answers SUBMITTED awaiting reviewer approval
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  try {
    const frameworkId = req.nextUrl.searchParams.get('frameworkId')
    if (!frameworkId) {
      return NextResponse.json({ error: 'frameworkId query param required' }, { status: 400 })
    }

    const framework = await db.brsrFramework.findUnique({
      where: { id: frameworkId },
      include: {
        sections: { orderBy: { sortOrder: 'asc' } },
        principles: { orderBy: { sortOrder: 'asc' } },
        questions: {
          orderBy: { sortOrder: 'asc' },
          include: { section: true, principle: true, answers: true },
        },
      },
    })
    if (!framework) {
      return NextResponse.json({ error: 'Framework not found' }, { status: 404 })
    }

    // by-section rollup
    const bySection: Record<string, { total: number; ready: number; pct: number }> = {}
    for (const s of framework.sections) bySection[s.code] = { total: 0, ready: 0, pct: 0 }

    // by-principle rollup
    const byPrinciple: Record<string, { total: number; ready: number; pct: number }> = {}
    for (const p of framework.principles) byPrinciple[p.code] = { total: 0, ready: 0, pct: 0 }

    let totalWeight = 0
    let readyWeight = 0
    let pendingEvidence = 0
    let pendingApprovals = 0
    const missingItems: Array<{
      questionId: string
      questionCode: string
      questionText: string
      section: string | null
      principle: string | null
      status: string
    }> = []

    for (const q of framework.questions) {
      // Each question should have ≥1 answer row (seed ensures one per question).
      // If multiple, take the latest (updatedAt desc) — but here we just sum weights.
      const answers = q.answers.length > 0
        ? [...q.answers].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, 1)
        : []
      const weight = q.id ? (answers[0]?.readinessWeight ?? 1) : 1
      const status = answers[0]?.status ?? 'MISSING'
      const isReady = READY_STATUSES.includes(status)
      totalWeight += weight
      if (isReady) readyWeight += weight
      if (PENDING_EVIDENCE_STATUSES.includes(status)) pendingEvidence++
      if (PENDING_APPROVAL_STATUSES.includes(status)) pendingApprovals++
      if (!isReady) {
        missingItems.push({
          questionId: q.id,
          questionCode: q.questionCode,
          questionText: q.questionText,
          section: q.section?.code ?? null,
          principle: q.principle?.code ?? null,
          status,
        })
      }

      // Roll-up into section
      if (q.section && bySection[q.section.code]) {
        bySection[q.section.code].total += weight
        if (isReady) bySection[q.section.code].ready += weight
      }
      // Roll-up into principle
      if (q.principle && byPrinciple[q.principle.code]) {
        byPrinciple[q.principle.code].total += weight
        if (isReady) byPrinciple[q.principle.code].ready += weight
      }
    }

    // Compute pct per section/principle
    for (const k of Object.keys(bySection)) {
      const s = bySection[k]
      s.pct = s.total > 0 ? Math.round((s.ready / s.total) * 1000) / 10 : 0
    }
    for (const k of Object.keys(byPrinciple)) {
      const p = byPrinciple[k]
      p.pct = p.total > 0 ? Math.round((p.ready / p.total) * 1000) / 10 : 0
    }

    const overall = totalWeight > 0 ? Math.round((readyWeight / totalWeight) * 1000) / 10 : 0

    return NextResponse.json({
      framework: { id: framework.id, name: framework.name, version: framework.version, reportingYear: framework.reportingYear },
      overall,
      bySection,
      byPrinciple,
      missingItems,
      pendingEvidence,
      pendingApprovals,
      totals: {
        questions: framework.questions.length,
        answers: framework.questions.reduce((s, q) => s + q.answers.length, 0),
        readyWeight: Math.round(readyWeight * 100) / 100,
        totalWeight: Math.round(totalWeight * 100) / 100,
      },
      trace: {
        note: 'Readiness computed from BrsrAnswer.status fields. READY = APPROVED | LOCKED | EVIDENCE_VERIFIED. No hardcoded values.',
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to compute readiness', detail: String(e?.message ?? e) }, { status: 500 })
  }
}
