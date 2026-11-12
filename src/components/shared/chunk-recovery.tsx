"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   Stale-build / stale-chunk recovery.

   After a Vercel deploy a browser tab can still be running the PREVIOUS
   build's JavaScript. Two symptoms follow:

     1. A lazily-loaded chunk of the old build 404s → the dynamic import
        rejects ("Failed to fetch dynamically imported module" / "ChunkLoadError")
        and Next.js renders the bare
        "Application error: a client-side exception has occurred" page.
     2. The old code talks to a server that no longer serves its APIs.

   Both are fixed by ONE reload — the new HTML points at the new chunks.
   This module performs that reload automatically, so the user never sees the
   blank error page.

   Every reload is guarded by a counter so a misbehaving build id can never
   turn into a reload loop.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect } from "react";

const BUILD_KEY = "meil:build-id";
const RELOAD_FLAG = "meil:chunk-reload-done";
const DRIFT_FLAG = "meil:build-drift-reloads";
const MAX_RELOADS = 1;

/** True for the chunk-loading failures that a reload actually fixes. */
function isChunkLoadError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (!message) return false;
  return (
    /Failed to fetch dynamically imported module/i.test(message) ||
    /ChunkLoadError/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /Loading chunk \S+ failed/i.test(message)
  );
}

function readCounter(key: string): number {
  try {
    return Number(window.sessionStorage.getItem(key) ?? "0");
  } catch {
    return 0;
  }
}

function writeCounter(key: string, value: number) {
  try {
    window.sessionStorage.setItem(key, String(value));
  } catch {
    /* ignore */
  }
}

export default function ChunkRecovery() {
  useEffect(() => {
    /* ── STALE BUILD DETECTION ────────────────────────────────────────────
       The server stamps the current deployment id into /api/build-id. The
       client remembers the id it booted with. When they differ, this tab is
       running a stale build → reload once onto the new one. */
    const checkBuild = async () => {
      try {
        const res = await fetch("/api/build-id", { cache: "no-store" });
        if (!res.ok) return;
        const d = (await res.json()) as { buildId?: string };
        const current = d?.buildId;
        if (!current) return;

        let booted: string | null = null;
        try {
          booted = window.sessionStorage.getItem(BUILD_KEY);
        } catch {
          booted = null;
        }

        if (!booted) {
          /* First visit of this session — remember the build we run on. */
          try {
            window.sessionStorage.setItem(BUILD_KEY, current);
          } catch {
            /* ignore */
          }
          writeCounter(DRIFT_FLAG, 0);
          return;
        }

        if (booted === current) {
          /* Stable — the drift counter may be reset for a future deploy. */
          writeCounter(DRIFT_FLAG, 0);
          return;
        }

        /* Drift detected. Reload at most once per drift. */
        if (readCounter(DRIFT_FLAG) >= MAX_RELOADS) return;
        writeCounter(DRIFT_FLAG, readCounter(DRIFT_FLAG) + 1);
        try {
          window.sessionStorage.setItem(BUILD_KEY, current);
        } catch {
          /* ignore */
        }
        window.location.reload();
      } catch {
        /* the probe is best-effort */
      }
    };

    const recover = () => {
      if (readCounter(RELOAD_FLAG) >= MAX_RELOADS) return; // already reloaded
      writeCounter(RELOAD_FLAG, readCounter(RELOAD_FLAG) + 1);
      window.location.reload();
    };

    const onError = (event: ErrorEvent) => {
      if (!isChunkLoadError(event.error ?? event.message)) return;
      recover();
    };

    /* An unhandled promise rejection is how a failed dynamic import usually
       surfaces in Next.js App Router. */
    const onRejection = (event: PromiseRejectionEvent) => {
      if (!isChunkLoadError(event.reason)) return;
      event.preventDefault?.();
      recover();
    };

    /* Run on mount, then whenever the tab regains focus (the moment a
       colleague deploys and you switch back to the tab). */
    void checkBuild();
    const onVisible = () => {
      if (document.visibilityState === "visible") void checkBuild();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    const iv = window.setInterval(() => void checkBuild(), 60_000);

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.clearInterval(iv);
    };
  }, []);

  return null;
}
