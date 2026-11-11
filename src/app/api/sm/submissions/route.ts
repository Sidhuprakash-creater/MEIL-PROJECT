import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { smHandle, requireSubsidiaryManager, getSubsidiaryOrThrow } from "@/lib/sm/server";
import { loadRowContext, toSmSubmissionRow, isResubmission } from "@/lib/sm/rows";
import type { SubmissionsResponse, SmSubmissionRow } from "@/lib/sm/types";

export const dynamic = "force-dynamic";

/* Tab → status mapping. SINGLE SOURCE OF TRUTH for the manager workspace —
   the dashboard KPI cards use the same definitions so every card value equals
   the destination tab count. "overdue" is a deadline state, deliberately kept
   separate from workflow tabs (a report can be UNDER_REVIEW and overdue). */
const TAB_FILTERS: Record<string, (s: { status: string; overdue: boolean }) => boolean> = {
  all: () => true,
  queue: (s) => ["SUBMITTED", "UNDER_REVIEW", "BU_APPROVED"].includes(s.status),
  draft: (s) => ["DRAFT", "ASSIGNED"].includes(s.status),
  submitted: (s) => s.status === "SUBMITTED" || s.status === "BU_APPROVED",
  pending: (s) => s.status === "UNDER_REVIEW",
  /* A report the BU Manager signed off is BU_APPROVED — it is cleared for
     the subsidiary consolidation and must show under "Approved", otherwise
     the manager never sees the reports that are ready to roll up. */
  approved: (s) => s.status === "APPROVED" || s.status === "BU_APPROVED",
  rejected: (s) => ["REJECTED", "CHANGES_REQUESTED"].includes(s.status),
  overdue: (s) => s.overdue && s.status !== "APPROVED" && s.status !== "BU_APPROVED",
};

export async function GET(req: NextRequest) {
  return smHandle(async () => {
    const ctx = await requireSubsidiaryManager();
    const sub = await getSubsidiaryOrThrow(ctx.subsidiaryId);
    const sp = req.nextUrl.searchParams;
    const tab = (sp.get("tab") ?? "all").toLowerCase();
    const q = (sp.get("q") ?? "").trim().toLowerCase();
    const category = (sp.get("category") ?? "").trim();
    const buId = (sp.get("buId") ?? "").trim();
    const projectId = (sp.get("projectId") ?? "").trim();
    const userId = (sp.get("userId") ?? "").trim();
    const level = (sp.get("level") ?? "").trim().toUpperCase();
    const evidence = (sp.get("evidence") ?? "").trim(); // none | attached
    // Absent → current mandated period; "ALL" → every period.
    const periodRaw = (sp.get("period") ?? "").trim();
    const periodFilter = periodRaw ? (periodRaw === "ALL" ? null : periodRaw) : "FY 2025-26";

    const [all, rowCtx] = await Promise.all([
      db.submission.findMany({
        where: { subsidiaryId: ctx.subsidiaryId, ...(periodFilter ? { period: periodFilter } : {}) },
        orderBy: { updatedAt: "desc" },
      }),
      loadRowContext(ctx.subsidiaryId),
    ]);

    /* Level filter FIRST so tab-strip counts always match the rows shown. */
    let scoped = all;
    if (level === "BU") scoped = scoped.filter((s) => !s.projectId);
    else if (level === "PROJECT") scoped = scoped.filter((s) => !!s.projectId);

    /* CONSOLIDATED HANDOFF: disclosures folded into the BU's consolidated
       dossier are hidden — the manager reviews that ONE dossier instead of
       each disclosure individually. */
    scoped = scoped.filter(
      (s) => !((s as any).inConsolidatedReport && (s as any).consolidatedReportId && s.id !== (s as any).consolidatedReportId),
    );

    /* Tab-strip counts over the level-scoped period set. */
    const inTab = (list: typeof scoped, t: string) => list.filter(TAB_FILTERS[t] ?? TAB_FILTERS.all);
    const counts = {
      all: scoped.length,
      queue: inTab(scoped, "queue").length,
      draft: inTab(scoped, "draft").length,
      submitted: inTab(scoped, "submitted").length,
      pending: inTab(scoped, "pending").length,
      approved: inTab(scoped, "approved").length,
      rejected: inTab(scoped, "rejected").length,
      overdue: inTab(scoped, "overdue").length,
      resubmitted: scoped.filter((s) => ["SUBMITTED", "UNDER_REVIEW"].includes(s.status) && isResubmission(s.history)).length,
    };

    /* Rows: tab + remaining filters. */
    let rows = inTab(scoped, tab);
    if (category) rows = rows.filter((s) => s.category === category);
    if (buId) rows = rows.filter((s) => s.businessUnitId === buId);
    if (projectId) rows = rows.filter((s) => s.projectId === projectId);
    if (userId) rows = rows.filter((s) => s.submittedById === userId);
    if (evidence === "none") rows = rows.filter((s) => (JSON.parse(s.evidence || "[]") as unknown[]).length === 0);
    if (evidence === "attached") rows = rows.filter((s) => (JSON.parse(s.evidence || "[]") as unknown[]).length > 0);
    if (q) {
      rows = rows.filter((s) => {
        const hay = `${s.ref} ${s.title} ${s.metricName} ${rowCtx.buNames.get(s.businessUnitId ?? "") ?? ""} ${rowCtx.projectNames.get(s.projectId ?? "") ?? ""} ${rowCtx.userNames.get(s.submittedById ?? "") ?? ""}`.toLowerCase();
        return hay.includes(q);
      });
    }

    /* Map to manager rows (adds review deadline + resubmission flag). */
    let submissions: SmSubmissionRow[] = rows.map((s) =>
      toSmSubmissionRow(s, rowCtx.userNames, rowCtx.buNames, rowCtx.projectNames, rowCtx.timelines, sub.code)
    );

    /* Review-queue prioritisation (queue tab only): overdue reviews first,
       then validation-flagged, then closest deadline first. No automatic
       decisions — priority only shapes presentation order. */
    if (tab === "queue") {
      const issues = await db.validationIssue.findMany({
        where: { subsidiaryId: ctx.subsidiaryId, status: { in: ["OPEN", "ASSIGNED"] }, submissionId: { not: null } },
        select: { submissionId: true },
      });
      const warningsBySubmission = new Map<string, number>();
      for (const i of issues) warningsBySubmission.set(i.submissionId!, (warningsBySubmission.get(i.submissionId!) ?? 0) + 1);
      submissions = submissions
        .map((s) => ({ s, warn: warningsBySubmission.get(s.id) ?? 0 }))
        .sort((a, b) => {
          const aOver = (a.s.daysRemaining ?? 0) < 0 ? 0 : 1;
          const bOver = (b.s.daysRemaining ?? 0) < 0 ? 0 : 1;
          if (aOver !== bOver) return aOver - bOver;
          if (a.warn !== b.warn) return b.warn - a.warn;
          return (a.s.daysRemaining ?? 9999) - (b.s.daysRemaining ?? 9999);
        })
        .map((x) => x.s);
    }

    const response: SubmissionsResponse = { submissions, total: submissions.length, counts };
    return ok(response);
  });
}
