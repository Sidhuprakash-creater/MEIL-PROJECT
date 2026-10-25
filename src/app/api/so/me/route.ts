import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/so/session'

export const runtime = 'nodejs'

/**
 * GET /api/so/me — session identity for the site-operations frontend context.
 * Returns the ZIP SessionUser shape (roles/scopes/employeeCode) derived from
 * the platform session cookie, or 401 when unauthenticated.
 */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  return NextResponse.json({ user })
}
