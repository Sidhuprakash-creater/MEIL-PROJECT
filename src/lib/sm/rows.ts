import { db } from "@/lib/db";
import { parseJson, resolveEffectiveDeadline } from "@/lib/sm/server";
import type { SmSubmissionRow } from "@/lib/sm/types";
import type { SubmissionRow } from "@/lib/sa/types";
import { toSubmissionRow } from "@/lib/sa/rows";

/* Shared row mappers for the /api/sm/* route handlers.
   (Route files may only export HTTP handlers, so helpers live here.) */

interface Tl {
  id: string; level: string; subsidiaryId: string; businessUnitId: string | null;
  projectId: string | null; dueDate: Date | null; reviewDeadline: Date | null;
  inheritanceMode: string; startDate: Date; name: string; status: string;
}

/** True when the submission's history records a resubmission after rejection. */
export function isResubmission(history: string): boolean {
  const h = parseJson<{ action?: string; note?: string }[]>(history, []);
  return h.some(
    (e) =>
      (e.action ?? "").toLowerCase().includes("resubmit") ||
      (e.note ?? "").toLowerCase().includes("resubmit")
  );
}

/** Build the manager-scoped submission row (adds review deadline + resubmission flag). */
export function toSmSubmissionRow(
  s: Parameters<typeof toSubmissionRow>[0] & { history?: string },
  users: Map<string, string>,
  buNames: Map<string, string>,
  projectNames: Map<string, string>,
  timelines: Tl[],
  subCode: string
): SmSubmissionRow {
  const base: SubmissionRow = toSubmissionRow(s, users, buNames, projectNames);
  const eff = resolveEffectiveDeadline(
    s.projectId ? "PROJECT" : "BUSINESS_UNIT",
    { subsidiaryId: "", businessUnitId: s.businessUnitId, projectId: s.projectId },
    timelines,
    subCode
  );
  const reviewIso = eff.reviewDeadline ? eff.reviewDeadline.toISOString() : base.dueDate;
  const days = reviewIso ? Math.ceil((new Date(reviewIso).getTime() - Date.now()) / 86400000) : null;
  return {
    ...base,
    reviewDeadline: reviewIso,
    reviewDeadlineLabel: eff.reviewDeadline ? eff.sourceLabel : "Report due date",
    isResubmission: isResubmission(s.history ?? "[]"),
    daysRemaining: days,
  };
}

/** Load name maps + timelines for a subsidiary in one shot (list endpoints). */
export async function loadRowContext(subsidiaryId: string) {
  const [units, projects, users, timelines] = await Promise.all([
    db.businessUnit.findMany({ where: { subsidiaryId }, select: { id: true, name: true } }),
    db.project.findMany({ where: { businessUnit: { subsidiaryId } }, select: { id: true, name: true } }),
    db.user.findMany({ where: { subsidiaryId }, select: { id: true, name: true } }),
    db.reportingTimeline.findMany({ where: { subsidiaryId, status: "ACTIVE" } }),
  ]);
  return {
    buNames: new Map(units.map((u) => [u.id, u.name])),
    projectNames: new Map(projects.map((p) => [p.id, p.name])),
    userNames: new Map(users.map((u) => [u.id, u.name])),
    timelines: timelines as Tl[],
    units,
    projects,
    users,
  };
}
