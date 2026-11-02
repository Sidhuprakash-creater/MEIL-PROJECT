"use client";

/* ── MEIL BU Manager — ESG Review Studio shared view helpers ──
   Mirrors manager/shared.tsx but tuned for the liquid-purple Review Studio
   palette. The hues here drive status chips, evidence pills and validation
   severity tones used by every view + the review-detail workspace. */

import { Chip } from "@/components/workspace/ui";
import { SUBMISSION_STATUS_LABELS } from "@/lib/bm/types";

/* status hue map — liquid-purple primary action, sky-blue info, amber
   pending/changes-requested, red rejected/overdue, green approved.
   UNDER_REVIEW is the BU Manager's "in flight" colour — purple. */
export const STATUS_HUE: Record<string, string> = {
  APPROVED: "#16A67A",
  SUBMITTED: "#348BE8",
  UNDER_REVIEW: "#8B5CF6",
  DRAFT: "#8a99ad",
  ASSIGNED: "#c57926",
  CHANGES_REQUESTED: "#E9A23B",
  REJECTED: "#E35D6A",
};

export function StatusChip({ status, className }: { status: string; className?: string }) {
  const hue = STATUS_HUE[status] ?? "#8a99ad";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${className ?? ""}`}
      style={{ background: `color-mix(in srgb, ${hue} 12%, white)`, color: hue }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: hue }} />
      {SUBMISSION_STATUS_LABELS[status] ?? status}
    </span>
  );
}

/** Deadline urgency chip — days remaining relative to the effective review
 *  deadline (or the report due date when no review window is set). */
export function UrgencyChip({ days, className }: { days: number | null; className?: string }) {
  if (days === null) return <Chip tone="gray" className={className}>No deadline</Chip>;
  if (days < 0) return <Chip tone="red" className={className}>{Math.abs(days)}d overdue</Chip>;
  if (days === 0) return <Chip tone="red" className={className}>Due today</Chip>;
  if (days <= 3) return <Chip tone="red" className={className}>{days}d left</Chip>;
  if (days <= 7) return <Chip tone="amber" className={className}>{days}d left</Chip>;
  return <Chip tone="purple" className={className}>{days}d left</Chip>;
}

/** Evidence status chip — attached count / missing. */
export function EvidenceChip({ count, className }: { count: number; className?: string }) {
  return count > 0
    ? <Chip tone="green" className={className}>{count} doc{count > 1 ? "s" : ""}</Chip>
    : <Chip tone="red" className={className}>No evidence</Chip>;
}

/** Safe metric formatting — never crashes on absent values (BUG 4 lesson). */
export const fmtMetric = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-IN") : String(v ?? "—");
};

/** Human-readable review action verb for activity feed rendering. */
export function actionVerb(action: string): string {
  return action
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\bapprove\b/, "approved")
    .replace(/\breject\b/, "rejected")
    .replace(/\breturn\b/, "returned for correction")
    .replace(/\bresubmit\b/, "resubmitted");
}

/** Validation severity → chip tone (purple-tinted primary). */
export function severityTone(severity: string): "red" | "amber" | "purple" | "gray" {
  if (severity === "CRITICAL" || severity === "HIGH") return "red";
  if (severity === "MEDIUM") return "amber";
  if (severity === "LOW" || severity === "INFO") return "purple";
  return "gray";
}
