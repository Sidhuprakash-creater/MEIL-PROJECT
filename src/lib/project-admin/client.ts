/* ═══════════════════════════════════════════════════════════════════════════
   MEIL PROJECT COMMAND CENTER — CLIENT API UTILITIES (FAST & CACHED)
   Typed API fetchers, client SWR cache, & mutation helpers
   ═══════════════════════════════════════════════════════════════════════════ */

export class PaApiError extends Error {
  status: number;
  data?: any;

  constructor(message: string, status = 500, data?: any) {
    super(message);
    this.name = "PaApiError";
    this.status = status;
    this.data = data;
  }
}

// Client memory cache with 60s TTL to give instant navigation between tabs
const apiCache = new Map<string, { data: any; expiresAt: number; fetchedAt: number }>();

export function clearPaClientCache() {
  apiCache.clear();
}

export function getCachedPaData<T>(endpoint: string): T | null {
  const url = new URL(endpoint, typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
  const item = apiCache.get(url.toString());
  return item ? (item.data as T) : null;
}

export async function paApiGet<T>(
  endpoint: string,
  params?: Record<string, string | number | boolean | undefined>,
  options?: { bypassCache?: boolean }
): Promise<T> {
  const url = new URL(endpoint, typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    });
  }

  const cacheKey = url.toString();
  const now = Date.now();

  if (!options?.bypassCache) {
    const cached = apiCache.get(cacheKey);
    if (cached) {
      // If fresh, return immediately
      if (cached.expiresAt > now) {
        return cached.data as T;
      }
      // If stale, return cached immediately and revalidate in background (SWR pattern)
      fetch(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json" },
      })
        .then((res) => res.json())
        .then((json) => {
          if (json.ok !== false) {
            apiCache.set(cacheKey, { data: json.data ?? json, expiresAt: Date.now() + 60000, fetchedAt: Date.now() });
          }
        })
        .catch(() => {});
      return cached.data as T;
    }
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) {
    throw new PaApiError(json.message || json.error || `Request failed with status ${res.status}`, res.status, json);
  }

  const data = (json.data ?? json) as T;
  apiCache.set(cacheKey, { data, expiresAt: now + 60000, fetchedAt: now });
  return data;
}

export async function paApiPost<T>(endpoint: string, body?: any): Promise<T> {
  clearPaClientCache(); // invalidate cache on mutation
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: isFormData ? undefined : { "Content-Type": "application/json", Accept: "application/json" },
    body: isFormData ? body : JSON.stringify(body ?? {}),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) {
    throw new PaApiError(json.message || json.error || `Operation failed with status ${res.status}`, res.status, json);
  }

  return (json.data ?? json) as T;
}

export async function paApiPatch<T>(endpoint: string, body?: any): Promise<T> {
  clearPaClientCache();
  const res = await fetch(endpoint, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body ?? {}),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) {
    throw new PaApiError(json.message || json.error || `Update failed with status ${res.status}`, res.status, json);
  }

  return (json.data ?? json) as T;
}

export async function paApiDelete<T>(endpoint: string): Promise<T> {
  clearPaClientCache();
  const res = await fetch(endpoint, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) {
    throw new PaApiError(json.message || json.error || `Delete failed with status ${res.status}`, res.status, json);
  }

  return (json.data ?? json) as T;
}

export function prefetchProjectAdminData() {
  if (typeof window === "undefined") return;
  const endpoints = [
    "/api/project-admin/dashboard",
    "/api/project-admin/project",
    "/api/project-admin/users",
    "/api/project-admin/categories",
    "/api/project-admin/tasks",
    "/api/project-admin/collection-status",
    "/api/project-admin/evidence",
    "/api/project-admin/esg-summary",
    "/api/project-admin/consolidated-report",
    "/api/project-admin/submissions",
    "/api/project-admin/corrections",
    "/api/project-admin/notifications",
    "/api/project-admin/settings",
  ];

  // Prefetch with staggered delay so we don't bombard the server at once
  endpoints.forEach((ep, idx) => {
    setTimeout(() => {
      paApiGet(ep).catch(() => {});
    }, idx * 100);
  });
}

export function formatMetricNumber(val?: number | string | null): string {
  if (val === undefined || val === null || val === "") return "—";
  const num = typeof val === "number" ? val : parseFloat(String(val));
  if (isNaN(num)) return String(val);
  return num.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export function formatPercentage(val?: number | null): string {
  if (val === undefined || val === null) return "0%";
  return `${Math.round(val)}%`;
}

export function formatRelativeDate(isoDate?: string | null): string {
  if (!isoDate) return "—";
  const d = new Date(isoDate);
  const now = Date.now();
  const diffSec = Math.floor((now - d.getTime()) / 1000);
  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
