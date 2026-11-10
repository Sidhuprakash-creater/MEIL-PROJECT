"use client";

/* ── MEIL Subsidiary Manager — typed API client with LIVE polling ──
   Same stale-while-revalidate contract as the Subsidiary Admin client:
   every data hook polls its endpoint on an interval so the workspace
   reflects Group Admin / Subsidiary Admin activity in near-realtime. */

import { useCallback, useEffect, useRef, useState } from "react";
import { useSmWorkspace } from "@/lib/sm/store";

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

export const DEFAULT_POLL_MS = 15000;

/**
 * Live data hook: stale-while-revalidate + background polling.
 * - `pollMs` (default 15s) — pass 0 to disable polling.
 * - Updates the shell's lastSyncedAt so the Live badge stays honest.
 * - Pauses while the tab is hidden; refreshes immediately on focus.
 */
export function useSmApi<T>(path: string | null, opts: { pollMs?: number; deps?: unknown[] } = {}) {
  const pollMs = opts.pollMs ?? DEFAULT_POLL_MS;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const setLastSynced = useSmWorkspace((s) => s.setLastSyncedAt);

  const load = useCallback(
    async (silent = false) => {
      if (!path) return;
      const id = ++seq.current;
      if (!silent) setLoading(true);
      if (!silent) setError(null);
      try {
        const d = await apiGet<T>(path);
        if (seq.current === id) {
          setData(d);
          setError(null);
          setLastSynced(new Date().toISOString());
        }
      } catch (e) {
        if (seq.current === id) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (seq.current === id) setLoading(false);
      }
    },
    [path, setLastSynced]
  );

  useEffect(() => {
    load();
  }, [path, ...(opts.deps ?? [])]);

  useEffect(() => {
    if (!pollMs) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") load(true);
    }, pollMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") load(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pollMs, load]);

  return { data, loading, error, refetch: () => load(true) };
}

/** Mutation wrapper with pending + error state. */
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

/* ── formatting helpers (shared with views) ── */

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

export const daysUntil = (iso?: string | null) => {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
};

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

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}
