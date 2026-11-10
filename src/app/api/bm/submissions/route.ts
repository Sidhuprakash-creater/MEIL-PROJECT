import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import {
  bmHandle, requireBuManager, getBuOrThrow, buSubmissionScope,
} from "@/lib/bm/server";
import {
  toBmSubmissionRow, resolveReviewDeadline,
  loadBmUserNames, loadBmProjectNames, isResubmission,
} from "@/lib/bm/rows";
import { toSubmissionRow } from "@/lib/sa/rows";
import type { SubmissionsResponse, BmSubmissionRow } from "@/lib/bm/types";

export const dynamic = "force-dynamic";

/* Tab → status mapping. SINGLE SOURCE OF TRUTH for the BU Manager workspace.
   The dashboard KPI cards use the same definitions so every card value equals
   the destination tab count. "overdue" is a deadline state kept separate
   from workflow tabs — a report can be UNDER_REVIEW and overdue at the same
   time. "resubmitted" tracks history entries (returned + resubmitted).

   Project-level reports only reach BU after the Project Admin forwards them
   from the Approved Dataset view (forwardedToBu = true); a PA-approved but
   not-yet-forwarded report is invisible here and lands in the queue tab for
   BU re-review once forwarded. BU-level reports (no projectId) keep the
   legacy SUBMITTED → APPROVED flow. */
type TabRow = { status: string; overdue: boolean; forwardedToBu: boolean; inConsolidatedReport?: boolean; projectId: string | null };
const TAB_FILTERS: Record<string, (s: TabRow) => boolean> = {
  all: () => true,
  queue: (s) =>
    ["SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED"].includes(s.status) ||
    ((s.status === "APPROVED" || s.status === "BU_REVIEW_PENDING") && (s.forwardedToBu || (s as any).inConsolidatedReport)),
  draft: (s) => ["DRAFT", "ASSIGNED"].includes(s.status),
  submitted: (s) =>
    s.status === "SUBMITTED" ||
    ((s.status === "APPROVED" || s.status === "BU_REVIEW_PENDING") && (s.forwardedToBu || (s as any).inConsolidatedReport)),
  pending: (s) =>
    s.status === "UNDER_REVIEW" ||
    ((s.status === "APPROVED" || s.status === "BU_REVIEW_PENDING") && (s.forwardedToBu || (s as any).inConsolidatedReport)),
  returned: (s) => s.status === "CHANGES_REQUESTED",
  approved: (s) => s.status === "BU_APPROVED" || (s.status === "APPROVED" && !s.forwardedToBu && !(s as any).inConsolidatedReport && !s.projectId),
  rejected: (s) => ["REJECTED", "CHANGES_REQUESTED"].includes(s.status),
  overdue: (s) => s.overdue && s.status !== "APPROVED" && s.status !== "BU_APPROVED",
  resubmitted: () => false, // computed separately via history inspection
};

/* GET /api/bm/submissions?tab=&level=&q=&category=&projectId=&evidence=&period= */
export async function GET(req: NextRequest) {
  return bmHandle(async () => {
    const ctx = await requireBuManager();
    const bu = await getBuOrThrow(ctx.businessUnitId);
    const sp = req.nextUrl.searchParams;
    const tab = (sp.get("tab") ?? "all").toLowerCase();
    const q = (sp.get("q") ?? "").trim().toLowerCase();
    const category = (sp.get("category") ?? "").trim();
    const categoryFilter = category.toUpperCase() === "ALL" ? "" : category;  // view sentinel must not filter
    const projectId = (sp.get("projectId") ?? "").trim();
    const userId = (sp.get("userId") ?? "").trim();
    const level = (sp.get("level") ?? "").trim().toUpperCase();
    const evidence = (sp.get("evidence") ?? "").trim();
    const periodRaw = (sp.get("period") ?? "").trim();
    const periodFilter = periodRaw ? (periodRaw === "ALL" ? null : periodRaw) : "FY 2025-26";

    /* SCOPE: the BU's own reports + every report that belongs to a project
       of this BU. Forwarded / consolidated rows are NOT a group-wide pass —
       a BU manager only ever sees the projects his business unit owns. */
    const scope = await buSubmissionScope(ctx.businessUnitId);

    const [all, userNames, projectNames] = await Promise.all([
      db.submission.findMany({
        where: {
          ...scope.where,
          ...(periodFilter ? { period: periodFilter } : {}),
        },
        orderBy: { updatedAt: "desc" },
      }),
      loadBmUserNames(ctx.businessUnitId, ctx.subsidiaryId),
      loadBmProjectNames(ctx.businessUnitId),
    ]);
    const allBus = await db.businessUnit.findMany({ select: { id: true, name: true } });
    const buNames = new Map(allBus.map((b) => [b.id, b.name]));

    /* Level filter FIRST so the tab-strip counts always match the rows shown
       (BUG 1 lesson from the SA worklog). */
    let scoped = all;
    if (level === "BU") scoped = scoped.filter((s) => !s.projectId);
    else if (level === "PROJECT") scoped = scoped.filter((s) => !!s.projectId);

    const inTab = (list: typeof scoped, t: string) =>
      list.filter(TAB_FILTERS[t] ?? TAB_FILTERS.all);

    /* Resubmissions: queue items whose history records a return + resubmit. */
    const resubmittedIds = new Set(
      scoped
        .filter((s) => ["SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED"].includes(s.status))
        .filter((s) => isResubmission(s.history))
        .map((s) => s.id),
    );

    const counts = {
      all: scoped.length,
      queue: inTab(scoped, "queue").length,
      draft: inTab(scoped, "draft").length,
      submitted: inTab(scoped, "submitted").length,
      pending: inTab(scoped, "pending").length,
      approved: inTab(scoped, "approved").length,
      rejected: inTab(scoped, "rejected").length,
      overdue: inTab(scoped, "overdue").length,
      resubmitted: resubmittedIds.size,
    };

    /* Rows: tab + remaining filters. The "resubmitted" tab pulls from the
       resubmission set instead of TAB_FILTERS. */
    let rows: typeof scoped;
    if (tab === "resubmitted") {
      rows = scoped.filter((s) => resubmittedIds.has(s.id));
    } else {
      rows = inTab(scoped, tab);
    }
    if (categoryFilter) rows = rows.filter((s) => s.category === categoryFilter);
    if (projectId) rows = rows.filter((s) => s.projectId === projectId);
    if (userId) rows = rows.filter((s) => s.submittedById === userId);
    if (evidence === "none") rows = rows.filter((s) => (JSON.parse(s.evidence || "[]") as unknown[]).length === 0);
    if (evidence === "attached") rows = rows.filter((s) => (JSON.parse(s.evidence || "[]") as unknown[]).length > 0);
    if (q) {
      rows = rows.filter((s) => {
        const hay = `${s.ref} ${s.title} ${s.metricName} ${buNames.get(s.businessUnitId ?? "") ?? ""} ${projectNames.get(s.projectId ?? "") ?? ""} ${userNames.get(s.submittedById ?? "") ?? ""}`.toLowerCase();
        return hay.includes(q);
      });
    }

    /* Decorate each row with the review deadline + resubmission flag. The
       timelines lookup is per-row (only active timelines for this subsidiary
       + BU + project) — cheap because the BU has very few timelines. */
    const submissions: BmSubmissionRow[] = await Promise.all(
      rows.map(async (s) => {
        const reviewCtx = await resolveReviewDeadline(s, ctx.businessUnitId, ctx.subsidiaryId);
        const base = toSubmissionRow(s, userNames, buNames, projectNames);
        return toBmSubmissionRow(
          base,
          reviewCtx.reviewDeadline,
          reviewCtx.sourceLabel,
          s.dueDate.toISOString(),
          s.history,
          { forwardedToBu: s.forwardedToBu, forwardedToBuAt: s.forwardedToBuAt },
        );
      }),
    );

    /* Review-queue prioritisation (queue tab only): overdue reviews first,
       then validation-flagged, then closest deadline first. */
    if (tab === "queue") {
      const issues = await db.validationIssue.findMany({
        where: { businessUnitId: ctx.businessUnitId, status: { in: ["OPEN", "ASSIGNED"] }, submissionId: { not: null } },
        select: { submissionId: true },
      });
      const warningsBySubmission = new Map<string, number>();
      for (const i of issues) {
        if (i.submissionId) {
          warningsBySubmission.set(i.submissionId, (warningsBySubmission.get(i.submissionId) ?? 0) + 1);
        }
      }
      submissions.sort((a, b) => {
        const aOver = (a.daysRemaining ?? 0) < 0 ? 0 : 1;
        const bOver = (b.daysRemaining ?? 0) < 0 ? 0 : 1;
        if (aOver !== bOver) return aOver - bOver;
        const aWarn = warningsBySubmission.get(a.id) ?? 0;
        const bWarn = warningsBySubmission.get(b.id) ?? 0;
        if (aWarn !== bWarn) return bWarn - aWarn;
        return (a.daysRemaining ?? 9999) - (b.daysRemaining ?? 9999);
      });
    }

    const response: SubmissionsResponse = { submissions, total: submissions.length, counts };
    return ok(response);
  });
}
