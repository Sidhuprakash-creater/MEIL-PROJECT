/**
 * Session & RBAC helpers — backend derives current user from httpOnly cookie.
 * Frontend never owns auth truth. All authorization enforced server-side.
 *
 * Aligned to the platform's unified Prisma schema: roles are a string column
 * on User (no join tables), passwords are scrypt hashes from @/lib/password,
 * and scope comes from the user's project / business unit / subsidiary links.
 */
import { cookies } from 'next/headers'
import { db } from '@/lib/pu/db'
import { verifyPassword as scryptVerify } from '@/lib/password'
import { getSessionPayload } from '@/lib/session'

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

const SESSION_COOKIE = 'meil_pu_session'
// Simple signed token: base64(userId) + "." + hmac. For demo we use a lightweight scheme.
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
  clearPuUserCache()
  return `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`
}

// In-memory cache for fast session resolution (60s TTL)
const puUserCache = new Map<string, { user: SessionUser; expiresAt: number }>()

export function setPuCachedUser(user: SessionUser, ttlMs = 60000) {
  puUserCache.set(user.id, { user, expiresAt: Date.now() + ttlMs })
}

export function clearPuUserCache(userId?: string) {
  if (userId) puUserCache.delete(userId)
  else puUserCache.clear()
}

/* Unified User.role → portal role key (the portal UI keys dashboards off these). */
export function portalRoleKey(role: string): { key: string; name: string } {
  switch (role) {
    case 'ENV_DATA_USER':
      return { key: 'PROJECT_USER', name: 'Site Data Entry' }
    case 'FIN_RESOURCE_USER':
      return { key: 'FINANCE_USER', name: 'Finance & Resource Data Contributor' }
    case 'HR_USER':
      return { key: 'HR_USER', name: 'HR / Workforce' }
    case 'EHS_USER':
      return { key: 'EHS_USER', name: 'EHS Officer' }
    case 'PROCUREMENT_USER':
      return { key: 'PROCUREMENT_USER', name: 'Procurement' }
    case 'CSR_USER':
      return { key: 'CSR_USER', name: 'CSR' }
    case 'COMPLIANCE_USER':
      return { key: 'COMPLIANCE_USER', name: 'Compliance' }
    case 'ESG_ANALYST':
      return { key: 'ESG_ANALYST', name: 'ESG Analyst' }
    case 'GROUP_ADMIN':
      return { key: 'GROUP_ADMIN', name: 'Group Admin' }
    case 'SUBSIDIARY_ADMIN':
      return { key: 'SUBSIDIARY_ADMIN', name: 'Subsidiary Admin' }
    case 'SUBSIDIARY_MANAGER':
      return { key: 'SUBSIDIARY_MANAGER', name: 'Subsidiary Manager' }
    case 'BU_ADMIN':
      return { key: 'BU_ADMIN', name: 'BU Admin' }
    case 'BU_MANAGER':
      return { key: 'BU_MANAGER', name: 'BU Manager' }
    case 'PROJECT_ADMIN':
      return { key: 'PROJECT_ADMIN', name: 'Project Admin' }
    default:
      return { key: role || 'PROJECT_USER', name: role || 'Project User' }
  }
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value

  let resolvedUserId: string | null = null

  if (token) {
    const [encoded, sig] = token.split('.')
    if (encoded && sig) {
      const uId = Buffer.from(encoded, 'base64').toString()
      const expectedSig = await sign(uId)
      if (sig === expectedSig) {
        resolvedUserId = uId
      }
    }
  }

  // Fallback to platform-wide session cookie (meil_esg_session)
  if (!resolvedUserId) {
    try {
      const platformSession = await getSessionPayload()
      if (platformSession?.user?.id) {
        resolvedUserId = platformSession.user.id
      }
    } catch {}
  }

  if (!resolvedUserId) return null

  // Fast path: cached session user
  const cached = puUserCache.get(resolvedUserId)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.user
  }

  const user = await db.user.findUnique({
    where: { id: resolvedUserId },
    include: { project: true, businessUnit: true, subsidiary: true },
  })
  if (!user || user.status !== 'ACTIVE') return null

  const role = portalRoleKey(user.role)
  const scopes: SessionUser['scopes'] = []
  if (user.projectId) scopes.push({ id: `sc-${user.projectId}`, scopeType: 'PROJECT', scopeId: user.projectId })
  if (user.businessUnitId) scopes.push({ id: `sc-${user.businessUnitId}`, scopeType: 'BUSINESS_UNIT', scopeId: user.businessUnitId })
  if (user.subsidiaryId) scopes.push({ id: `sc-${user.subsidiaryId}`, scopeType: 'SUBSIDIARY', scopeId: user.subsidiaryId })

  const sessionUser: SessionUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    employeeCode: user.employeeId ?? null,
    groupId: null,
    status: user.status,
    demo: false,
    roles: [{ id: `role-${role.key}`, key: role.key, name: role.name, phase: 1 }],
    scopes,
  }
  puUserCache.set(resolvedUserId, { user: sessionUser, expiresAt: Date.now() + 60000 })
  return sessionUser
}

export async function requireUser(): Promise<SessionUser> {
  const u = await getCurrentUser()
  if (!u) throw new Error('UNAUTHENTICATED')
  return u
}

/* Static role → permission map (replaces the old permission join tables).
   Keeps the submission workflow honest: data users write, EHS/Compliance
   review & verify, senior roles approve / lock, analysts generate reports. */
const ALL_PERMS = [
  'esg.energy.write', 'esg.waste.write', 'esg.water.write', 'esg.safety.write', 'esg.people.write',
  'evidence.upload', 'evidence.verify', 'submission.submit', 'submission.review',
  'submission.approve', 'submission.reject', 'submission.lock',
  'brsr.generate', 'report.generate', 'audit.read',
]

const READ_ONLY = ['audit.read']

const ROLE_PERMS: Record<string, string[]> = {
  GROUP_ADMIN: ALL_PERMS,
  ORG_MANAGER: ALL_PERMS,
  SUBSIDIARY_ADMIN: ALL_PERMS,
  SUBSIDIARY_MANAGER: ALL_PERMS,
  BU_ADMIN: ALL_PERMS,
  BU_MANAGER: ALL_PERMS,
  PROJECT_ADMIN: ALL_PERMS,
  PROJECT_USER: ['esg.energy.write', 'esg.waste.write', 'esg.water.write', 'esg.safety.write', 'esg.people.write', 'evidence.upload', 'submission.submit', 'audit.read'],
  ENV_DATA_USER: ['esg.energy.write', 'esg.waste.write', 'esg.water.write', 'esg.safety.write', 'esg.people.write', 'evidence.upload', 'submission.submit', 'audit.read'],
  FINANCE_USER: ['evidence.upload', 'submission.submit', 'audit.read'],
  FIN_RESOURCE_USER: ['evidence.upload', 'submission.submit', 'audit.read'],
  HR_USER: ['esg.people.write', 'evidence.upload', 'submission.submit', 'audit.read'],
  EHS_USER: ['esg.safety.write', 'esg.energy.write', 'esg.water.write', 'esg.waste.write', 'evidence.upload', 'evidence.verify', 'submission.submit', 'submission.review', 'submission.reject', 'audit.read'],
  PROCUREMENT_USER: ['evidence.upload', 'submission.submit', 'audit.read'],
  CSR_USER: ['evidence.upload', 'submission.submit', 'audit.read'],
  COMPLIANCE_USER: ['evidence.verify', 'submission.review', 'submission.approve', 'submission.reject', 'submission.lock', 'brsr.generate', 'report.generate', 'audit.read'],
  ESG_ANALYST: ['submission.review', 'brsr.generate', 'report.generate', 'audit.read'],
}

export async function requirePermission(permissionKey: string): Promise<SessionUser> {
  const u = await requireUser()
  const has = await userHasPermission(u.id, permissionKey)
  if (!has) throw new Error('FORBIDDEN')
  return u
}

export async function userHasPermission(userId: string, permissionKey: string): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } })
  if (!user) return false
  const perms = ROLE_PERMS[user.role] ?? READ_ONLY
  return perms.includes(permissionKey)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return scryptVerify(plain, hash)
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE
