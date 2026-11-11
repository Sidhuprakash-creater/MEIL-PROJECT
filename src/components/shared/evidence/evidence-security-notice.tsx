"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   MEIL ESG Platform — Evidence security notice

   A compact, reusable panel that explains an upload rejection:

     • malware  — the file failed the security scan; lists what tripped.
     • duplicate — identical bytes already exist in the vault; names the
                   existing copy and offers "Upload as a new version" so the
                   user can proceed deliberately when the duplicate is
                   legitimate (e.g. the same invoice attached to two
                   submissions).

   Used by the shared data-entry upload sections so every upload surface in
   the platform reports the same way.
   ═══════════════════════════════════════════════════════════════════════════ */

import * as React from "react";
import { ShieldAlert, CopyX, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import type { DuplicateInfo, MalwareFinding, UploadRejection } from "@/lib/evidence/upload-client";

export interface EvidenceSecurityNoticeProps {
  rejection: UploadRejection | null;
  /** Called when the user confirms the duplicate is intentional. */
  onUploadAsNewVersion?: (duplicate: DuplicateInfo) => void;
  /** Called to dismiss the notice. */
  onDismiss?: () => void;
  /** True while the confirmed re-upload is in flight. */
  busy?: boolean;
}

export function EvidenceSecurityNotice({
  rejection,
  onUploadAsNewVersion,
  onDismiss,
  busy,
}: EvidenceSecurityNoticeProps) {
  if (!rejection) return null;

  /* ── Malware ── */
  if (rejection.kind === "malware") {
    return (
      <div className="mt-2 rounded-xl border border-rose-300 bg-rose-50/90 p-3 text-xs shadow-sm">
        <div className="flex items-start gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
            <ShieldAlert className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-rose-900">Upload blocked — security scan failed</div>
            <p className="mt-0.5 text-[11px] leading-relaxed text-rose-800">{rejection.message}</p>
            {rejection.findings.length > 0 ? (
              <ul className="mt-1.5 space-y-1">
                {rejection.findings.map((f: MalwareFinding, i: number) => (
                  <li
                    key={`${f.code}-${i}`}
                    className="flex items-start gap-1.5 rounded-md bg-white/70 px-2 py-1 text-[10.5px] text-rose-800"
                  >
                    <AlertTriangle className="mt-px h-3 w-3 shrink-0 text-rose-500" />
                    <span>
                      <code className="font-mono font-bold">{f.code}</code> — {f.detail}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="mt-1.5 text-[10px] text-rose-700/80">
              The file was not stored. Please scan it on your workstation and upload a clean copy.
            </p>
            {onDismiss ? (
              <button
                type="button"
                onClick={onDismiss}
                className="mt-2 rounded-full bg-rose-600 px-3 py-1 text-[10.5px] font-bold text-white transition hover:bg-rose-700 active:scale-95"
              >
                Dismiss
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  /* ── Duplicate ── */
  if (rejection.kind === "duplicate") {
    const dup = rejection.duplicate;
    return (
      <div className="mt-2 rounded-xl border border-amber-300 bg-amber-50/90 p-3 text-xs shadow-sm">
        <div className="flex items-start gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
            <CopyX className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-amber-900">Duplicate — this file is already in the vault</div>
            <p className="mt-0.5 text-[11px] leading-relaxed text-amber-800">{rejection.message}</p>
            {dup.fileName ? (
              <dl className="mt-1.5 space-y-0.5 rounded-lg bg-white/80 px-2.5 py-2 text-[10.5px] text-amber-900">
                <div className="flex justify-between gap-3">
                  <dt className="font-semibold text-amber-700">Existing file</dt>
                  <dd className="truncate font-medium">{dup.fileName}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="font-semibold text-amber-700">Uploaded by</dt>
                  <dd className="font-medium">{dup.uploaderName}</dd>
                </div>
                {dup.createdAt ? (
                  <div className="flex justify-between gap-3">
                    <dt className="font-semibold text-amber-700">Uploaded on</dt>
                    <dd className="font-medium">
                      {new Intl.DateTimeFormat("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(dup.createdAt))}
                    </dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {onUploadAsNewVersion ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onUploadAsNewVersion(dup)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-amber-600 px-3 py-1 text-[10.5px] font-bold text-white shadow-sm transition hover:bg-amber-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3 w-3" /> Upload as a new version
                    </>
                  )}
                </button>
              ) : null}
              {onDismiss ? (
                <button
                  type="button"
                  onClick={onDismiss}
                  className="rounded-full bg-white/80 px-3 py-1 text-[10.5px] font-bold text-amber-800 transition hover:bg-white active:scale-95"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Generic failure ── */
  return (
    <div className="mt-2 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50/80 px-3 py-2 text-[11px] text-rose-800">
      <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-rose-500" />
      <span className="flex-1">{rejection.message}</span>
      {onDismiss ? (
        <button type="button" onClick={onDismiss} className="font-bold underline">
          Dismiss
        </button>
      ) : null}
    </div>
  );
}
