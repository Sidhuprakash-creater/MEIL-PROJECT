/**
 * Session & RBAC helpers — backend derives current user from httpOnly cookie.
 * Frontend never owns auth truth. All authorization enforced server-side.
 */
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

export interface SessionUser {
  id: string
  email: string
  name: string
  employeeCode: string | null
  groupId: string | null
  status: string
  demo: boolean
  roles: { id: string; key: string; name: string; phase: number }[]
  scopes: { id: string; scopeType: string; scopeId: string }[]
}

const SESSION_COOKIE = 'meil_esg_session'
// Simple signed token: base64(userId) + ":" + hmac. For demo we use a lightweight scheme.
// SECURITY: production deployments MUST set SESSION_SECRET. The hardcoded fallback is
// only for local development demos — anyone knowing it can forge session cookies.
const SECRET = process.env.SESSION_SECRET ?? 'meil-esg-illustrative-secret-change-in-prod'
if (process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build' && !process.env.SESSION_SECRET) {
  throw new Error(
    'SESSION_SECRET environment variable must be set in production — refusing to boot with the insecure demo fallback.'
  )
}

async function sign(payload: string): Promise<string> {
  const enc = new TextEncoder().encode(payload + SECRET)
  const buf = await crypto.subtle.digest('SHA-256', enc)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
}

export async function createSessionCookie(userId: string) {
  const token = Buffer.from(userId).toString('base64') + '.' + await sign(userId)
  return `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${60 * 60 * 12}; SameSite=Lax`
}

export async function clearSessionCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null
  const [encoded, sig] = token.split('.')
  if (!encoded || !sig) return null
  const userId = Buffer.from(encoded, 'base64').toString()
  const expectedSig = await sign(userId)
  if (sig !== expectedSig) return null
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      userRoles: { include: { role: true } },
      userScopes: true,
    },
  })
  if (!user || user.status !== 'ACTIVE') return null
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    employeeCode: user.employeeCode,
    groupId: user.groupId,
    status: user.status,
    demo: user.demo,
    roles: user.userRoles.map(ur => ({ id: ur.role.id, key: ur.role.key, name: ur.role.name, phase: ur.role.phase })),
    scopes: user.userScopes.map(us => ({ id: us.id, scopeType: us.scopeType, scopeId: us.scopeId })),
  }
}

export async function requireUser(): Promise<SessionUser> {
  const u = await getCurrentUser()
  if (!u) throw new Error('UNAUTHENTICATED')
  return u
}

export async function requirePermission(permissionKey: string): Promise<SessionUser> {
  const u = await requireUser()
  const has = await userHasPermission(u.id, permissionKey)
  if (!has) throw new Error('FORBIDDEN')
  return u
}

export async function userHasPermission(userId: string, permissionKey: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      userRoles: {
        include: {
          role: {
            include: {
              permissions: { include: { permission: true } },
            },
          },
        },
      },
    },
  })
  if (!user) return false
  return user.userRoles.some(ur =>
    ur.role.permissions.some(rp => rp.permission.key === permissionKey)
  )
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash)
  } catch {
    return false
  }
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE
