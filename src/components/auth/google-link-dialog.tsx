"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";

interface PendingGoogleInfo {
  googleEmail: string;
  portal: string;
  remember: boolean;
  expiresAt: number;
  allowDemoReassign: boolean;
}

/**
 * Prompts users who signed in with a verified Google account that is not yet
 * linked to an existing platform user row to verify their existing Email / Employee ID
 * and current password. Once verified, binds Google SSO to that user and opens
 * their assigned role workspace.
 */
export function GoogleLinkDialog({
  onCancelRedirect,
}: {
  onCancelRedirect?: string;
} = {}) {
  const [open, setOpen] = useState(false);
  const [loadingPending, setLoadingPending] = useState(false);
  const [pending, setPending] = useState<PendingGoogleInfo | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflictUser, setConflictUser] = useState<{
    name?: string;
    email?: string;
    canReassign: boolean;
  } | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    name: string;
    roleLabel: string;
  } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("linkGoogle") !== "1") return;

    params.delete("linkGoogle");
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (qs ? `?${qs}` : "")
    );

    let cancelled = false;
    fetch("/api/auth/google/pending", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { pending?: PendingGoogleInfo | null }) => {
        if (cancelled) return;
        setOpen(true);
        if (d.pending) {
          setPending(d.pending);
          setRemember(d.pending.remember);
        } else {
          setError(
            "Your Google verification session expired. Please click Continue with Google again."
          );
        }
      })
      .catch(() => {
        if (cancelled) return;
        setOpen(true);
        setError("Could not load verified Google profile. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoadingPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleClose = async () => {
    setOpen(false);
    try {
      await fetch("/api/auth/google/pending", { method: "DELETE" });
    } catch {
      /* ignore cleanup error */
    }
    if (onCancelRedirect && typeof window !== "undefined") {
      window.history.replaceState(null, "", onCancelRedirect);
    }
  };

  const submitLink = async (reassignIfLinked = false) => {
    if (submitting || !pending) return;
    if (!identifier.trim() || !password) {
      setError("Enter both your current Email / Employee ID and password.");
      return;
    }
    setSubmitting(true);
    setError(null);
    if (!reassignIfLinked) setConflictUser(null);

    try {
      const res = await fetch("/api/auth/google/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: identifier.trim(),
          password,
          remember,
          reassignIfLinked,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data.code === "GOOGLE_ALREADY_LINKED") {
          setConflictUser({
            name: data.linkedToName,
            email: data.linkedToEmail,
            canReassign: Boolean(data.canReassign),
          });
        }
        setError(
          data.error ||
            "Could not verify those credentials. Please check your Email / Employee ID and password."
        );
        return;
      }

      setSuccessInfo({
        name: data.user?.name || identifier.trim(),
        roleLabel: data.user?.roleLabel || data.user?.role || "Workspace",
      });
      const target =
        typeof data.redirectUrl === "string" && data.redirectUrl
          ? data.redirectUrl
          : "/?dashboard=1";
      window.location.replace(target);
    } catch {
      setError("Network error while verifying credentials. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="google-link-dialog-title"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/60 bg-white/92 p-6 text-slate-900 shadow-2xl backdrop-blur-xl">
        <button
          type="button"
          onClick={() => void handleClose()}
          aria-label="Close Google linking dialog"
          className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 ring-1 ring-sky-200/80">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h2
              id="google-link-dialog-title"
              className="text-base font-bold text-slate-900"
            >
              Link Google Account to Platform User
            </h2>
            <p className="text-xs text-slate-500">
              Verify your existing credentials once to sign in with Google
            </p>
          </div>
        </div>

        {loadingPending ? (
          <div className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-xs font-medium text-slate-500">
            Loading verified Google identity…
          </div>
        ) : successInfo ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-600" />
            <div className="text-sm font-bold text-emerald-950">
              Google Account Linked &amp; Verified
            </div>
            <p className="mt-1 text-xs text-emerald-800">
              Signed in as <strong>{successInfo.name}</strong> ({successInfo.roleLabel}). Opening your workspace…
            </p>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submitLink(false);
            }}
            className="space-y-4"
          >
            {pending && (
              <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-200/80 bg-emerald-50/70 px-3.5 py-2.5 text-xs text-emerald-900">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <div className="min-w-0">
                  <div className="font-semibold">Google verified</div>
                  <div className="truncate font-mono text-[11px] text-emerald-800">
                    {pending.googleEmail}
                  </div>
                </div>
              </div>
            )}

            <p className="text-xs leading-relaxed text-slate-600">
              Enter your current MEIL ESG <strong>Email or Employee ID</strong> and{" "}
              <strong>Password</strong> below. Your Google email will be linked so
              future logins open your assigned role workspace in one click.
            </p>

            {pending && (
              <>
                <div>
                  <label
                    htmlFor="gl-identifier"
                    className="mb-1 block text-xs font-semibold text-slate-700"
                  >
                    Current Email or Employee ID
                  </label>
                  <input
                    id="gl-identifier"
                    type="text"
                    autoFocus
                    required
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      setError(null);
                      setConflictUser(null);
                    }}
                    placeholder="e.g. arun.bhaskar@meil.in or EMP-1001"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="gl-password"
                    className="mb-1 block text-xs font-semibold text-slate-700"
                  >
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      id="gl-password"
                      type={showPw ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError(null);
                      }}
                      placeholder="Enter current password"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 pr-10 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((s) => !s)}
                      aria-label={showPw ? "Hide password" : "Show password"}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-700"
                    >
                      {showPw ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {pending.allowDemoReassign && (
                    <p className="mt-1 text-[11px] text-slate-500">
                      Demo environment active: existing demo accounts accept password{" "}
                      <code className="rounded bg-slate-100 px-1 py-0.5 font-mono font-semibold text-slate-700">
                        demo
                      </code>{" "}
                      or their configured password.
                    </p>
                  )}
                </div>

                <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600"
                  />
                  <span>Remember session for 30 days</span>
                </label>
              </>
            )}

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-800"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                <div className="space-y-2">
                  <span>{error}</span>
                  {conflictUser?.canReassign && (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => void submitLink(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-xs transition hover:bg-amber-700 disabled:opacity-60"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Switch Gmail to this account &amp; Open Workspace
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => void handleClose()}
                disabled={submitting}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              {pending ? (
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-60"
                >
                  <span>
                    {submitting ? "Verifying & Opening…" : "Verify & Open Role Workspace"}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              ) : (
                <a
                  href="/api/auth/google/start?portal=gateway"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-sky-700"
                >
                  <span>Retry Google Sign-In</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              )}
            </div>

            <div className="flex items-center gap-1.5 border-t border-slate-100 pt-3 text-[11px] text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span>Password verification prevents unauthorized account linking</span>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

