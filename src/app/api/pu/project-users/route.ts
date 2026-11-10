import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/pu/db'
import { getCurrentUser } from '@/lib/pu/session'

export const runtime = 'nodejs'

/* GET /api/pu/project-users?projectId=<id>
   The people actually assigned to a project, grouped by the portal role they
   log in with. The welcome screen uses this so a role card shows the real
   person of THAT project instead of a hard-coded demo name from another
   project (which is what made "Environment Data User" show Rohit Kumar while
   the selected project was Kaleshwaram). */
export async function GET(req: NextRequest) {
  try {
    /* The project roster is shown on the WELCOME screen, before anyone has
       signed in — so it must be readable anonymously, exactly like the
       /api/master/* reference data. It exposes nothing but the name, the
       portal role and the work email of ACTIVE project members. */
    const projectId = req.nextUrl.searchParams.get('projectId') || undefined
    if (!projectId) return NextResponse.json({ users: [] })

    const users = await db.user.findMany({
      where: { projectId, status: 'ACTIVE' },
      select: { name: true, email: true, role: true },
      orderBy: { role: 'asc' },
    })

    return NextResponse.json({ users })
  } catch (e: any) {
    console.error('GET /api/pu/project-users error', e)
    return NextResponse.json({ error: 'Failed to load project users' }, { status: 500 })
  }
}
