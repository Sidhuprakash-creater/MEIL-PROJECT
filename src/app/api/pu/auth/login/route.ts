import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/pu/db'
import { createSessionCookie, verifyPassword, portalRoleKey } from '@/lib/pu/session'

export const runtime = 'nodejs'

/* POST /api/pu/auth/login — Project User Portal sign-in against the platform's
   unified user ledger (same accounts as every other console). Accepts email OR
   employee ID; passwords are the platform's scrypt hashes. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const identifier = String(body.email ?? body.identifier ?? '').trim()
    const password = String(body.password ?? '')
    if (!identifier || !password) {
      return NextResponse.json({ error: 'Email / employee ID and password are required' }, { status: 400 })
    }

    const isEmail = identifier.includes('@')
    const user = await db.user.findUnique({
      where: isEmail ? { email: identifier.toLowerCase() } : { employeeId: identifier.toUpperCase() },
      include: { project: true, businessUnit: true, subsidiary: true },
    })

    const audit = (eventType: string, result: string) =>
      db.auditLog.create({
        data: {
          eventType,
          result,
          employeeId: identifier.slice(0, 64),
          userId: user?.id ?? null,
          userAgent: req.headers.get('user-agent') ?? null,
        },
      }).catch(() => null)

    if (!user || !user.passwordHash) {
      await audit('LOGIN_FAILED', 'FAILURE')
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }
    if (user.status === 'SUSPENDED') {
      await audit('LOGIN_FAILED', 'FAILURE')
      return NextResponse.json({ error: 'This account has been suspended. Contact your administrator.' }, { status: 403 })
    }
    if (user.status === 'INACTIVE') {
      await audit('LOGIN_FAILED', 'FAILURE')
      return NextResponse.json({ error: 'This account is inactive. Contact your administrator.' }, { status: 403 })
    }
    if (user.status !== 'ACTIVE') {
      await audit('LOGIN_FAILED', 'FAILURE')
      return NextResponse.json({ error: 'This account has not been activated yet. Check your invite email.' }, { status: 403 })
    }

    const ok = await verifyPassword(password, user.passwordHash)
    if (!ok) {
      await audit('LOGIN_FAILED', 'FAILURE')
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    await Promise.all([
      db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), lastActiveAt: new Date() } }),
      audit('LOGIN_SUCCESS', 'SUCCESS'),
    ])

    const role = portalRoleKey(user.role)
    const scopes: { scopeType: string; scopeId: string }[] = []
    if (user.projectId) scopes.push({ scopeType: 'PROJECT', scopeId: user.projectId })
    if (user.businessUnitId) scopes.push({ scopeType: 'BUSINESS_UNIT', scopeId: user.businessUnitId })
    if (user.subsidiaryId) scopes.push({ scopeType: 'SUBSIDIARY', scopeId: user.subsidiaryId })

    const cookie = await createSessionCookie(user.id)
    const res = NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      employeeCode: user.employeeId ?? null,
      groupId: null,
      demo: false,
      roles: [{ key: role.key, name: role.name, phase: 1 }],
      scopes,
    })
    res.headers.set('Set-Cookie', cookie)
    return res
  } catch {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
