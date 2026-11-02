"use client";

/* ── Cross-console revision bus (latency fix) ────────────────────────────────
   A single lightweight poll of /api/revision (~4s, tab-visible only) shared by
   every open console. When the server fingerprint changes, subscribers refetch
   their active queries immediately — so an action taken in one console appears
   in the sender AND receiver workspaces within ~1 poll cycle instead of the
   previous 15s stale window. */

type Listener = () => void;

const listeners = new Set<Listener>();
let pollTimer: number | null = null;
let lastRev: string | null = null;
let inFlight = false;

const POLL_MS = 4000;

async function tick() {
  if (inFlight || document.visibilityState !== "visible") return;
  inFlight = true;
  try {
    const res = await fetch("/api/revision", { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as { rev?: string };
      if (data.rev && lastRev !== null && data.rev !== lastRev) {
        for (const l of [...listeners]) {
          try {
            l();
          } catch {
            /* listener errors never break the bus */
          }
        }
      }
      lastRev = data.rev ?? lastRev;
    }
  } catch {
    /* network hiccup — retry on next tick */
  } finally {
    inFlight = false;
  }
}

/** Idempotently start the shared poll (called by every data hook). */
export function ensureRevisionPolling() {
  if (typeof window === "undefined") return;
  if (pollTimer !== null) return;
  /* Prime lastRev without notifying, so the first paint never double-fetches. */
  fetch("/api/revision", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((d: { rev?: string } | null) => {
      lastRev = d?.rev ?? null;
    })
    .catch(() => {});
  pollTimer = window.setInterval(tick, POLL_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") tick();
  });
}

/** Subscribe to revision changes. Returns an unsubscribe function. */
export function onRevisionChange(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
