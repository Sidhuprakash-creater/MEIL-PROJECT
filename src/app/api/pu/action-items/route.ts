import { NextResponse } from 'next/server'
import { db } from '@/lib/pu/db'
import { getCurrentUser } from '@/lib/pu/session'

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
    const drafts = await db.submission.findMany({
      where: { status: 'DRAFT' },
      include: { project: true, reportingPeriod: true },
      take: 5,
    })
    for (const d of drafts) {
      tasks.push({
        id: `draft-${d.id}`, type: 'DRAFT_SUBMISSION', title: d.title,
        description: `Draft submission for ${d.reportingPeriod?.periodLabel ?? d.period} — ${d.completionPct ?? 0}% complete. Submit for review.`,
        severity: 'info', module: 'submissions', entityId: d.id, status: d.status,
        dueDate: (d.reportingPeriod?.submissionDeadline ?? d.dueDate)?.toISOString(),
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

  // 3. Tasks assigned to THIS contributor by the Project Admin (task assignment
  //    surface). Scope = explicit assigneeFilter (user id) or, for legacy rows,
  //    assignee-label name match. Open corrective-action correction tasks here
  //    as well so nothing assigned in the Command Center is invisible.
  if (dataEntryRoles.includes(roleKey)) {
    const assigned = await db.task.findMany({
      where: {
        AND: [
          {
            OR: [
              { assigneeFilter: user.id },
              { assigneeLabel: user.name },
            ],
          },
          { status: { notIn: ['COMPLETED', 'CANCELLED'] } },
        ],
      },
      orderBy: { dueDate: 'asc' },
      take: 8,
    })
    for (const t of assigned) {
      tasks.push({
        id: `task-${t.id}`, type: 'ASSIGNED_TASK', title: t.title,
        description: t.description || `Assigned by Project Admin — ${t.category || 'reporting'} task.`,
        severity: t.priority === 'HIGH' || t.priority === 'CRITICAL' ? 'critical' : t.priority === 'LOW' ? 'info' : 'warning',
        module: 'tasks', entityId: t.id, status: t.status,
        dueDate: (t.dueDate as Date | null)?.toISOString(),
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
