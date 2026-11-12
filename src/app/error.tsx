"use client";

/* Global error boundary — the LAST line of defence.
 *
 * Without it, any client-side exception in a lazily-loaded console takes the
 * whole page down to a blank "Application error" screen with no way out.
 * This catches it, shows what actually happened and offers a way out.
 */

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the real cause in the console — the page copy alone is not enough.
    console.error("[app] unhandled client error:", error);
  }, [error]);

  const message =
    error?.message ||
    "An unexpected error occurred while rendering this view.";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f2f9ff] p-6">
      <div className="glass-strong w-full max-w-2xl rounded-3xl border-white/80 p-8 shadow-xl">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[rgba(196,74,79,0.12)] text-2xl">
            ⚠️
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight text-[color:var(--ink)]">
              This view hit an unexpected error
            </h1>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[color:var(--ink-soft)]">
              The platform caught it instead of leaving you on a blank page. Reloading
              usually clears it — the workspace data itself is untouched.
            </p>
          </div>
        </div>

        <pre className="nice-scroll mt-5 max-h-56 overflow-auto rounded-2xl bg-[rgba(196,74,79,0.07)] p-4 text-left text-[11.5px] leading-relaxed text-[#8f3a40]">
          {message}
          {error?.digest ? `\n\ndigest: ${error.digest}` : ""}
        </pre>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={() => reset()}
            className="rounded-2xl bg-gradient-to-r from-[#20a779] to-[#187a5c] px-5 py-2.5 text-[13px] font-bold text-white shadow-md shadow-[rgba(32,167,121,0.3)] transition-all hover:from-[#23b484] hover:to-[#1d8f68]"
          >
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="rounded-2xl border border-white/70 bg-white/70 px-5 py-2.5 text-[13px] font-semibold text-[color:var(--ink-soft)] transition-colors hover:bg-white"
          >
            Reload the page
          </button>
          <a
            href="/"
            className="rounded-2xl px-5 py-2.5 text-[13px] font-semibold text-[color:var(--ink-faint)] transition-colors hover:text-[color:var(--ink)]"
          >
            Back to the gateway
          </a>
        </div>
      </div>
    </div>
  );
}
