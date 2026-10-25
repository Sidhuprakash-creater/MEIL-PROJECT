import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/so/session'

export const runtime = 'nodejs'

// GET /api/action-items — role-aware task list for the current user.
// Returns draft submissions and open corrections relevant to the user's role.
// Reviewer / BRSR task branches can be re-added when those roles return.
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const roleKey = user.roles[0]?.key ?? ''
  const tasks: {
    id: string; type: string; title: string; description: string
    severity: 'critical' | 'warning' | 'info'; module: string
    dueDate?: string; entityId?: string; status: string
  }[] = []

  // 1. Draft submissions (for PROJECT_USER / HR / EHS etc. — data entry roles)
  const dataEntryRoles = ['PROJECT_USER', 'FINANCE_USER', 'HR_USER', 'EHS_USER', 'PROCUREMENT_USER', 'CSR_USER', 'COMPLIANCE_USER']
  if (dataEntryRoles.includes(roleKey)) {
    const drafts = await db.soSubmission.findMany({
      where: { status: 'DRAFT' },
      include: { project: true, reportingPeriod: true },
      take: 5,
    })
    for (const d of drafts) {
      tasks.push({
        id: `draft-${d.id}`, type: 'DRAFT_SUBMISSION', title: d.title,
        description: `Draft submission for ${d.reportingPeriod.periodLabel} — ${d.completionPct}% complete. Submit for review.`,
        severity: 'info', module: 'submissions', entityId: d.id, status: d.status,
        dueDate: d.reportingPeriod.submissionDeadline?.toISOString(),
      })
    }
  }

  // 2. Open corrections (for data entry roles)
  if (dataEntryRoles.includes(roleKey)) {
    const corrections = await db.correctionRequest.findMany({
      where: { status: 'OPEN' },
      include: { submission: { include: { project: true } } },
      take: 5,
    })
    for (const c of corrections) {
      tasks.push({
        id: `correction-${c.id}`, type: 'CORRECTION', title: `Correction: ${c.field}`,
        description: `${c.issue} — on ${c.submission?.title ?? 'a submission'}. Severity: ${c.severity}.`,
        severity: c.severity === 'BLOCKING' ? 'critical' : 'warning', module: 'submissions',
        entityId: c.submissionId, status: 'OPEN',
      })
    }
  }

  // Sort by severity (critical first, then warning, then info)
  const sevOrder = { critical: 0, warning: 1, info: 2 }
  tasks.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity])

  return NextResponse.json({
    tasks,
    count: tasks.length,
    roleKey,
    summary: {
      critical: tasks.filter(t => t.severity === 'critical').length,
      warning: tasks.filter(t => t.severity === 'warning').length,
      info: tasks.filter(t => t.severity === 'info').length,
    },
  })
}
