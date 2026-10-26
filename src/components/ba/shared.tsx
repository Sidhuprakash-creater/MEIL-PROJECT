"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Chip, StatusBadge } from "@/components/workspace/ui";
import { fmtDateTime, timeAgo } from "@/lib/ba/client";
import type { BaViewId } from "@/lib/ba/types";

/* ── shared BU-Admin view helpers ──
   StatusChip — semantic pill keyed off the SUBMISSION_STATUS_LABELS keys.
   UrgencyChip — deadline urgency indicator (overdue / due soon / upcoming).
   fmtMetric — safe number formatter (prevents toLocaleString on undefined).
   DeadlinePill — days-left pill coloured by urgency. */

export const BA_STATUS_HUE: Record<string, string> = {
  APPROVED: "#16A67A", SUBMITTED: "#348BE8", UNDER_REVIEW: "#8B5CF6",
  DRAFT: "#8a99ad", ASSIGNED: "#c57926", CHANGES_REQUESTED: "#c57926",
  REJECTED: "#E35D6A", OVERDUE: "#E35D6A",
};

export function fmtMetric(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-IN") : String(v);
}

export function UrgencyChip({ days, overdue }: { days: number | null; overdue?: boolean }) {
  if (overdue) {
    return <Chip tone="red">{Math.abs(days ?? 0)}d overdue</Chip>;
  }
  if (days === null) return <Chip tone="gray">No deadline</Chip>;
  if (days <= 0) return <Chip tone="red">Due today</Chip>;
  if (days <= 3) return <Chip tone="red">{days}d left</Chip>;
  if (days <= 7) return <Chip tone="amber">{days}d left</Chip>;
  if (days <= 14) return <Chip tone="blue">{days}d left</Chip>;
  return <Chip tone="green">{days}d left</Chip>;
}

export function DeadlinePill({ iso, fallbackLabel = "—" }: { iso?: string | null; fallbackLabel?: string }) {
  if (!iso) return <Chip tone="gray">{fallbackLabel}</Chip>;
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="tabular text-[12px] font-semibold text-[color:var(--ink-soft)]">{new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>
      <UrgencyChip days={days} />
    </span>
  );
}

/* Section heading — small uppercase eyebrow used inside cards. */
export function Eyebrow({ icon: Icon, label, hint }: { icon?: React.ComponentType<{ className?: string }>; label: string; hint?: string }) {
  return (
    <div className="flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">
      {Icon && <Icon className="h-3.5 w-3.5" />}
      <span>{label}</span>
      {hint && <span className="ml-1 text-[10.5px] font-medium normal-case tracking-normal text-[color:var(--ink-faint)]">· {hint}</span>}
    </div>
  );
}

/* Row meta — used in glass list rows. */
export function MetaLine({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("truncate text-[11px] text-[color:var(--ink-faint)]", className)}>{children}</div>;
}

export { fmtDateTime, timeAgo, StatusBadge };

/* Helper: produce a navigate path object for a deep link from a notification linkView. */
export function navForLinkView(view: string): BaViewId {
  const known: BaViewId[] = ["dashboard", "notifications", "users", "roles", "projects", "timelines", "submissions", "monitoring", "evidence", "tasks", "comms", "validation", "esg", "analytics", "activity", "settings"];
  return (known as string[]).includes(view) ? (view as BaViewId) : "dashboard";
}
