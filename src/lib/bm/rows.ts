/* Shared row mappers used by multiple /api/bm/* route handlers.
   These re-export the SA-side helpers where the shape is identical
   (a BU Manager sees the same row shapes, just filtered to its assigned BU),
   and add a BM-specific helper for resolving review context. */

export {
  PTYPE_LABELS,
  unitStats,
  toProjectRow,
  toSubmissionRow,
} from "@/lib/sa/rows";

import { db } from "@/lib/db";
import { resolveEffectiveDeadline, type EffectiveDeadline } from "@/lib/sa/server";
import { parseJson } from "@/lib/bm/server";
import type { BmSubmissionRow, BmSubmissionDetail } from "@/lib/bm/types";
import type { Submission } from "@prisma/client";
import type { SubmissionRow, SubmissionDetail } from "@/lib/sa/types";

/** Resolve the user-id → name map for the BU's assigned users + parent
 *  subsidiary's admin/manager users (so submitted-by / reviewer names
 *  always resolve, even for parent-scope actors). */
export async function loadBmUserNames(businessUnitId: string, subsidiaryId: string): Promise<Map<string, string>> {
  const users = await db.user.findMany({
    where: {
      OR: [
        { businessUnitId },
        { subsidiaryId, role: { in: ["SUBSIDIARY_ADMIN", "SUBSIDIARY_MANAGER"] } },
      ],
    },
    select: { id: true, name: true },
  });
  return new Map(users.map((u) => [u.id, u.name]));
}

/** Resolve project-id → name map for all projects under the BU. */
export async function loadBmProjectNames(businessUnitId: string): Promise<Map<string, string>> {
  const projects = await db.project.findMany({
    where: { businessUnitId },
    select: { id: true, name: true },
  });
  return new Map(projects.map((p) => [p.id, p.name]));
}

/** Resolve the effective review deadline (effective.reviewDeadline) for a
 *  submission by walking up the timeline inheritance chain (PROJECT → BU →
 *  SUBSIDIARY). Returns the date + a human label describing the source. */
export async function resolveReviewDeadline(
  sub: Submission,
  businessUnitId: string,
  subsidiaryId: string
): Promise<{ reviewDeadline: Date | null; sourceLabel: string }> {
  const timelines = await db.reportingTimeline.findMany({
    where: { status: "ACTIVE", OR: [{ subsidiaryId }, { businessUnitId }, { projectId: sub.projectId ?? null }] },
  });

  const level: "PROJECT" | "BUSINESS_UNIT" | "SUBSIDIARY" = sub.projectId ? "PROJECT" : "BUSINESS_UNIT";
  const effective: EffectiveDeadline = resolveEffectiveDeadline(level, {
    subsidiaryId,
    businessUnitId,
    projectId: sub.projectId ?? undefined,
  }, timelines as never, "");

  return {
    reviewDeadline: effective.reviewDeadline,
    sourceLabel: effective.sourceLabel,
  };
}

/** Compute days remaining relative to the review deadline (or due date as
 *  fallback). Negative = overdue. Null when neither deadline is set. */
export function computeDaysRemaining(reviewDeadline: string | null, dueDate: string): number | null {
  const target = reviewDeadline ?? dueDate;
  if (!target) return null;
  return Math.ceil((new Date(target).getTime() - Date.now()) / 86400000);
}

/** Determine whether a submission is a resubmission by inspecting its
 *  history JSON for a "Returned for correction" / "Resubmitted" entry. */
export function isResubmission(historyJson: string | null): boolean {
  const hist = parseJson<{ action?: string }[]>(historyJson, []);
  return hist.some((h) =>
    /return|resubmit/i.test(h.action ?? "") || /returned for correction/i.test(h.action ?? "")
  );
}

/** Decorate a shared SubmissionRow with review-context fields. */
export function toBmSubmissionRow(
  row: SubmissionRow,
  reviewDeadline: Date | null,
  reviewDeadlineSourceLabel: string,
  dueDateISO: string,
  historyJson: string | null,
): BmSubmissionRow {
  const reviewDeadlineISO = reviewDeadline?.toISOString() ?? null;
  return {
    ...row,
    reviewDeadline: reviewDeadlineISO,
    reviewDeadlineLabel: reviewDeadlineISO ? new Date(reviewDeadlineISO).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—",
    isResubmission: isResubmission(historyJson),
    daysRemaining: computeDaysRemaining(reviewDeadlineISO, dueDateISO),
  };
}

/** Decorate a full SubmissionDetail with review-context fields. */
export function toBmSubmissionDetail(
  detail: SubmissionDetail,
  reviewDeadline: Date | null,
  reviewDeadlineSourceLabel: string,
  dueDateISO: string,
  historyJson: string | null,
): BmSubmissionDetail {
  const reviewDeadlineISO = reviewDeadline?.toISOString() ?? null;
  return {
    ...detail,
    reviewDeadline: reviewDeadlineISO,
    reviewDeadlineLabel: reviewDeadlineISO ? new Date(reviewDeadlineISO).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—",
    isResubmission: isResubmission(historyJson),
    daysRemaining: computeDaysRemaining(reviewDeadlineISO, dueDateISO),
  };
}
