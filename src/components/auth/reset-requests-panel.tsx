"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Copy, KeyRound, RefreshCw, ShieldAlert, XCircle } from "lucide-react";

interface ResetRequestItem {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  employeeId: string | null;
  userRole: string;
  userRoleLabel: string;
  userStatus: string;
  orgLabel: string;
  requestedIdentifier: string;
  portal: string;
  reason: string;
  status: string;
  rejectionReason: string | null;
  ip: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

interface ApprovedCredentialState {
  userName: string;
  employeeId: string;
  tempPassword: string;
  resetUrl: string;
  emailSent: boolean;
}

export function ResetRequestsPanel({ onUpdated }: { onUpdated?: () => void }) {
  const [requests, setRequests] = useState<ResetRequestItem[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ResetRequestItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approvedCreds, setApprovedCreds] = useState<ApprovedCredentialState | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = showAll ? "" : "?status=PENDING_ADMIN";
      const res = await fetch(`/api/auth/reset-requests${qs}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Could not load password reset queue.");
        setRequests([]);
      } else {
        let items: ResetRequestItem[] = data.requests ?? [];
        if (!showAll) {
          // Include EMAIL_TOKEN_SENT alongside PENDING_ADMIN when viewing pending queue
          const allRes = await fetch("/api/auth/reset-requests");
          const allData = await allRes.json();
          if (allRes.ok) {
            items = (allData.requests ?? []).filter(
              (r: ResetRequestItem) => r.status === "PENDING_ADMIN" || r.status === "EMAIL_TOKEN_SENT"
            );
            setPendingCount(allData.pendingCount ?? items.length);
          } else {
            setPendingCount(data.pendingCount ?? items.length);
          }
        } else {
          setPendingCount(data.pendingCount ?? 0);
        }
        setRequests(items);
      }
    } catch {
      setError("Network error while checking password reset requests.");
    } finally {
      setLoading(false);
    }
  }, [showAll]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleApprove = async (item: ResetRequestItem) => {
    setBusyId(item.id);
    setError(null);
    try {
      const res = await fetch(`/api/auth/reset-requests/${item.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "APPROVE" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Approval failed.");
      } else {
        setApprovedCreds({
          userName: data.userName ?? item.userName,
          employeeId: data.employeeId ?? item.employeeId ?? item.userEmail,
          tempPassword: data.tempPassword,
          resetUrl: data.resetUrl,
          emailSent: Boolean(data.emailSent),
        });
        setCopied(false);
        await load();
        onUpdated?.();
      }
    } catch {
      setError("Failed to approve reset request.");
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    if (rejectReason.trim().length < 10) {
      setError("Please enter a rejection reason of at least 10 characters.");
      return;
    }
    setBusyId(rejectTarget.id);
    setError(null);
    try {
      const res = await fetch(`/api/auth/reset-requests/${rejectTarget.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "REJECT", reason: rejectReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Rejection failed.");
      } else {
        setRejectTarget(null);
        setRejectReason("");
        await load();
        onUpdated?.();
      }
    } catch {
      setError("Failed to reject reset request.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="glass rounded-3xl border border-white/60 p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600">
            <KeyRound className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">
                Password Reset Approval Queue
              </h3>
              {pendingCount > 0 && (
                <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-semibold text-white">
                  {pendingCount} pending
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Scoped forgot-password requests requiring administrator review &amp; one-time credential issuance.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAll((s) => !s)}
            className="rounded-xl border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white"
          >
            {showAll ? "Pending only" : "Show history"}
          </button>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {approvedCreds && (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50/90 p-3.5 text-xs space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-semibold text-emerald-900">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              One-Time Credentials Issued for {approvedCreds.userName} ({approvedCreds.employeeId})
            </div>
            <button
              type="button"
              onClick={() => setApprovedCreds(null)}
              className="text-emerald-700 hover:underline"
            >
              Dismiss
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-lg bg-white px-2.5 py-1.5 font-mono text-sm font-bold text-slate-900 border border-emerald-200">
              {approvedCreds.tempPassword}
            </code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(approvedCreds.tempPassword);
                setCopied(true);
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1.5 font-medium text-white hover:bg-emerald-800"
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? "Copied" : "Copy password"}
            </button>
            <span className="text-emerald-800">
              {approvedCreds.emailSent
                ? "Also emailed to user via SMTP (with 15-min reset link)."
                : "Email skipped/unconfigured — share this password securely. User must change it on next login."}
            </span>
          </div>
        </div>
      )}

      {rejectTarget && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-3 text-xs space-y-2">
          <div className="font-semibold text-rose-900">
            Decline reset request for {rejectTarget.userName}
          </div>
          <input
            type="text"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason for declining (minimum 10 characters)…"
            className="w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs text-slate-900"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setRejectTarget(null);
                setRejectReason("");
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busyId === rejectTarget.id}
              onClick={() => void handleReject()}
              className="rounded-xl bg-rose-600 px-3 py-1.5 font-medium text-white hover:bg-rose-700 disabled:opacity-50"
            >
              Confirm Reject
            </button>
          </div>
        </div>
      )}

      {!loading && requests.length === 0 ? (
        <div className="rounded-2xl bg-white/50 px-4 py-3 text-xs text-slate-500">
          {showAll
            ? "No password reset requests recorded yet for users in your scope."
            : "No pending password reset requests."}
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map((r) => {
            const isPending =
              r.status === "PENDING_ADMIN" || r.status === "EMAIL_TOKEN_SENT";
            return (
              <div
                key={r.id}
                className="flex flex-col gap-2 rounded-2xl border border-white/70 bg-white/70 px-3.5 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{r.userName}</span>
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10.5px] text-slate-700">
                      {r.employeeId || r.userEmail}
                    </span>
                    <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[10.5px] font-medium text-blue-700">
                      {r.userRoleLabel}
                    </span>
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold ${
                        isPending
                          ? "bg-amber-100 text-amber-800"
                          : r.status === "COMPLETED" || r.status === "APPROVED_TEMP"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {r.orgLabel} &bull; Requested {new Date(r.createdAt).toLocaleString()}
                    {r.ip ? ` · IP ${r.ip}` : ""}
                    {r.rejectionReason ? ` · Declined: ${r.rejectionReason}` : ""}
                  </div>
                </div>

                {isPending && (
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => void handleApprove(r)}
                      className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Approve &amp; Issue Password
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => setRejectTarget(r)}
                      className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

