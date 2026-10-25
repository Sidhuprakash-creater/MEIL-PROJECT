import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export const runtime = 'nodejs'

// GET /api/brsr/frameworks/[id] — full framework with ordered sections / principles / questions.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  try {
    const { id } = await params
    const framework = await db.brsrFramework.findUnique({
      where: { id },
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
    return NextResponse.json({ framework })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to load framework', detail: String(e?.message ?? e) }, { status: 500 })
  }
}
