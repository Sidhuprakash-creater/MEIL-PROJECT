"use client";

/* ── MEIL Subsidiary Manager — shared view helpers ── */

import { Chip } from "@/components/workspace/ui";
import { SUBMISSION_STATUS_LABELS } from "@/lib/sm/types";

/* status hue map — sky blue primary, amber pending, red overdue, green approved */
export const STATUS_HUE: Record<string, string> = {
  APPROVED: "#20a779", BU_APPROVED: "#8B5CF6", BU_REVIEW_PENDING: "#c57926", SUBMITTED: "#3a7bff", UNDER_REVIEW: "#7c5cff",
  DRAFT: "#8a99ad", ASSIGNED: "#c57926", CHANGES_REQUESTED: "#c57926", REJECTED: "#c34a4a",
};

export function StatusChip({ status }: { status: string }) {
  const hue = STATUS_HUE[status] ?? "#8a99ad";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ background: `color-mix(in srgb, ${hue} 12%, white)`, color: hue }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: hue }} />
      {SUBMISSION_STATUS_LABELS[status] ?? status}
    </span>
  );
}

/** Deadline urgency chip — days remaining until the effective review deadline. */
export function UrgencyChip({ days, className }: { days: number | null; className?: string }) {
  if (days === null) return <Chip tone="gray" className={className}>No deadline</Chip>;
  if (days < 0) return <Chip tone="red" className={className}>{Math.abs(days)}d overdue</Chip>;
  if (days === 0) return <Chip tone="red" className={className}>Due today</Chip>;
  if (days <= 3) return <Chip tone="red" className={className}>{days}d left</Chip>;
  if (days <= 7) return <Chip tone="amber" className={className}>{days}d left</Chip>;
  return <Chip tone="blue" className={className}>{days}d left</Chip>;
}

/** Evidence status chip — attached count / missing. */
export function EvidenceChip({ count }: { count: number }) {
  return count > 0
    ? <Chip tone="green">{count} doc{count > 1 ? "s" : ""}</Chip>
    : <Chip tone="amber">No evidence</Chip>;
}

/** Safe metric formatting — never crashes on absent values. */
export const fmtMetric = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-IN") : String(v ?? "—");
};

/** Human-readable review action verb. */
export function actionVerb(action: string): string {
  return action
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\bapprove\b/, "approved")
    .replace(/\breject\b/, "rejected");
}

/** Validation severity → chip tone. */
export function severityTone(severity: string): "red" | "amber" | "blue" | "gray" {
  if (severity === "CRITICAL" || severity === "HIGH") return "red";
  if (severity === "MEDIUM") return "amber";
  if (severity === "LOW") return "blue";
  return "gray";
}
