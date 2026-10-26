import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/pu/db'
import { getCurrentUser } from '@/lib/pu/session'
import { authErrorToStatus, parseJsonArray } from '@/lib/pu/workflow'

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
    const submission = await db.submission.findUnique({
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
        history: true,
      },
    })
    if (!submission) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 },
      )
    }

    // History entries live on the shared Submission ledger (JSON column) —
    // entries carry { id, fromStatus, toStatus, action, actorId, actorName, actorRole, comment, reason, createdAt }.
    const historyRaw = parseJsonArray(submission.history)
    const history = historyRaw
      .map((h, i) => ({
        id: String(h.id ?? `h-${i}`),
        fromStatus: String(h.fromStatus ?? ''),
        toStatus: String(h.toStatus ?? ''),
        actorId: String(h.actorId ?? ''),
        actorName: String(h.actorName ?? ''),
        actorRole: String(h.actorRole ?? ''),
        action: String(h.action ?? ''),
        comment: (h.comment as string | null) ?? null,
        reason: (h.reason as string | null) ?? null,
        oldValues: (h.oldValues as string | null) ?? null,
        newValues: (h.newValues as string | null) ?? null,
        createdAt: new Date(String(h.createdAt ?? Date.now())) as Date,
      }))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

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
            roles: actor ? [{ key: actor.role, name: actor.role.replaceAll('_', ' ') }] : [],
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
