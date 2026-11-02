import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, portalRoleKeyFor } from '@/lib/so/session'
import { authErrorToStatus } from '@/lib/so/workflow'

export const runtime = 'nodejs'

// GET /api/submissions/[id]/history — full status history with actor details.
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
    const submission = await db.soSubmission.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        module: true,
        status: true,
        projectId: true,
        reportingPeriodId: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    if (!submission) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 },
      )
    }

    const history = await db.submissionStatusHistory.findMany({
      where: { submissionId: id },
      orderBy: { createdAt: 'asc' },
    })

    // Actor details — fetch users referenced (history.actorId is plain string,
    // no relation in schema; resolve manually for the response payload).
    const actorIds = Array.from(new Set(history.map((h) => h.actorId))).filter(Boolean)
    const actors = actorIds.length
      ? await db.user.findMany({
          where: { id: { in: actorIds } },
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
            role: true,
          },
        })
      : []
    const actorMap = new Map(actors.map((a) => [a.id, a]))

    return NextResponse.json({
      user: { id: user.id, name: user.name },
      submission,
      history: history.map((h) => {
        const actor = actorMap.get(h.actorId)
        return {
          id: h.id,
          fromStatus: h.fromStatus,
          toStatus: h.toStatus,
          action: h.action,
          comment: h.comment,
          reason: h.reason,
          oldValues: h.oldValues,
          newValues: h.newValues,
          createdAt: h.createdAt,
          actor: {
            id: h.actorId,
            name: h.actorName,
            role: h.actorRole,
            email: actor?.email || null,
            employeeCode: actor?.employeeId || null,
            roles: actor
              ? [{ key: portalRoleKeyFor(actor.role), name: actor.role }]
              : [],
          },
        }
      }),
    })
  } catch (e) {
    console.error('GET /api/submissions/[id]/history error', e)
    return NextResponse.json(
      { error: 'Failed to fetch submission history' },
      { status: 500 },
    )
  }
}
