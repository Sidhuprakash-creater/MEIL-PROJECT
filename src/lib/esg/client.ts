"use client";

// ── Typed API client + tiny data hooks for the ESG workspace ──
import { useCallback, useEffect, useRef, useState } from "react";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Network error — could not reach the server.", 0);
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `Request failed (${res.status})`;
    throw new ApiError(msg, res.status);
  }
  return data as T;
}

export const apiGet = <T,>(path: string) => request<T>(path);
export const apiPost = <T,>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) });
export const apiPatch = <T,>(path: string, body: unknown) =>
  request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
export const apiDelete = <T,>(path: string, body?: unknown) =>
  request<T>(path, { method: "DELETE", body: JSON.stringify(body ?? {}) });

export interface UseApiOptions {
  pollIntervalMs?: number;
  eventFilter?: string; // "users" | "hierarchy" | "activity" | "all"
}

/** Broadcast a real-time ESG data change event across all open views and browser tabs. */
export function dispatchEsgUpdate(
  type: "users" | "hierarchy" | "activity" | "all" = "all",
  payload?: Record<string, unknown>
) {
  if (typeof window === "undefined") return;
  try {
    const detail = { type, payload, timestamp: Date.now() };
    window.dispatchEvent(new CustomEvent("esg-data-update", { detail }));
    if ("BroadcastChannel" in window) {
      const bc = new BroadcastChannel("esg-realtime-bus");
      bc.postMessage(detail);
      bc.close();
    }
  } catch (err) {
    console.debug("[esg-realtime] dispatch error:", err);
  }
}

/** Real-time stale-while-revalidate data hook with manual refetch, event-bus syncing & polling. */
export function useApi<T>(path: string | null, deps: unknown[] = [], opts?: UseApiOptions) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(async (silent = false) => {
    if (!path) return;
    const id = ++seq.current;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const d = await apiGet<T>(path);
      if (seq.current === id) setData(d);
    } catch (e) {
      if (seq.current === id) setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      if (seq.current === id) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    load();
  }, [path, ...deps]);

  // Real-time updates: BroadcastChannel + CustomEvent + Visibility Focus + Optional Polling
  useEffect(() => {
    if (!path || typeof window === "undefined") return;

    const handleEvent = (detail?: { type?: string }) => {
      const targetType = detail?.type;
      if (
        !targetType ||
        targetType === "all" ||
        !opts?.eventFilter ||
        opts.eventFilter === "all" ||
        opts.eventFilter === targetType
      ) {
        void load(true);
      }
    };

    const onCustomEvent = (e: Event) => {
      handleEvent((e as CustomEvent).detail);
    };

    window.addEventListener("esg-data-update", onCustomEvent);

    let bc: BroadcastChannel | null = null;
    if ("BroadcastChannel" in window) {
      try {
        bc = new BroadcastChannel("esg-realtime-bus");
        bc.onmessage = (ev) => handleEvent(ev.data);
      } catch {
        /* BroadcastChannel not available */
      }
    }

    const onFocus = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void load(true);
      }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    let timer: NodeJS.Timeout | null = null;
    if (opts?.pollIntervalMs && opts.pollIntervalMs > 0) {
      timer = setInterval(() => {
        if (typeof document !== "undefined" && document.visibilityState === "visible") {
          void load(true);
        }
      }, opts.pollIntervalMs);
    }

    return () => {
      window.removeEventListener("esg-data-update", onCustomEvent);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      if (bc) {
        bc.close();
      }
      if (timer) clearInterval(timer);
    };
  }, [path, load, opts?.pollIntervalMs, opts?.eventFilter]);

  return { data, loading, error, refetch: () => load(true) };
}

/** Derived mutation hook: wraps apiPost/apiPatch with pending + error state. */
export function useMutation<T = unknown>() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async (fn: () => Promise<T>): Promise<T | null> => {
    setPending(true);
    setError(null);
    try {
      const r = await fn();
      return r;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed");
      return null;
    } finally {
      setPending(false);
    }
  }, []);
  return { run, pending, error, reset: () => setError(null) };
}

/** Human-friendly date helpers shared by views. */
export const fmtDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

export const fmtDateTime = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : "—";

export const timeAgo = (iso?: string | null) => {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(iso);
};

export const fmtNumber = (n: number, digits = 0) =>
  n.toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: 0 });

/** Trigger a client-side file download from text content. */
export function downloadFile(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Convert a JSON row array to CSV text. */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}
