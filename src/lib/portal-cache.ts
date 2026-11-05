/* ═══════════════════════════════════════════════════════════════════════════
   Portal response caches — shared stores for the pu / so API families.

   Next.js route files may only export route handlers, so the cache stores and
   their invalidators live here and are imported by the routes. The database is
   a remote Supabase instance, so these short TTLs are what keep the portals
   feeling instant.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ---- Overview KPIs (pu) ---- */
export const OVERVIEW_TTL_MS = 120000
export const OVERVIEW_CACHE_CONTROL = 'private, max-age=15, stale-while-revalidate=60'
let overviewCache: { data: any; expiresAt: number } | null = null
export function getPuOverviewCache() {
  return overviewCache && overviewCache.expiresAt > Date.now() ? overviewCache.data : null
}
export function setPuOverviewCache(data: any) {
  overviewCache = { data, expiresAt: Date.now() + OVERVIEW_TTL_MS }
}
export function invalidatePuOverviewCache() {
  overviewCache = null
}

/* ---- Submissions list (pu, per-filter key) ---- */
export const puSubmissionsCache = new Map<string, { data: any; expiresAt: number }>()
export function invalidatePuSubmissionsCache() {
  puSubmissionsCache.clear()
}

/* ---- Notifications (pu, per-user key) ---- */
export const puNotificationsCache = new Map<string, { data: any; expiresAt: number }>()
export function invalidatePuNotificationsCache() {
  puNotificationsCache.clear()
}

/* ---- Evidence list (pu, per-filter key) ---- */
export const puEvidenceCache = new Map<string, { data: any; expiresAt: number }>()
export function invalidatePuEvidenceCache() {
  puEvidenceCache.clear()
}

/* ---- Organization tree (pu + so) ---- */
let puTreeCache: { data: any; expiresAt: number } | null = null
export function getPuTreeCache() {
  return puTreeCache && puTreeCache.expiresAt > Date.now() ? puTreeCache.data : null
}
export function setPuTreeCache(data: any) {
  puTreeCache = { data, expiresAt: Date.now() + 120000 }
}
export function invalidatePuTreeCache() {
  puTreeCache = null
}

let soTreeCache: { data: any; expiresAt: number } | null = null
export function getSoTreeCache() {
  return soTreeCache && soTreeCache.expiresAt > Date.now() ? soTreeCache.data : null
}
export function setSoTreeCache(data: any) {
  soTreeCache = { data, expiresAt: Date.now() + 120000 }
}
export function invalidateSoTreeCache() {
  soTreeCache = null
}
