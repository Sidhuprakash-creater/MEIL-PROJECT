import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { baHandle, requireBuAdmin } from "@/lib/ba/server";
import { toSubmissionRow, loadBuUserNames, loadBuProjectNames } from "@/lib/ba/rows";

export const dynamic = "force-dynamic";

const num = (v: string | null, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : d;
};

/* Tab → status mapping (same as /api/sa/submissions to keep card values
   aligned with destination tab counts). */
const TAB_FILTERS: Record<string, (s: { status: string; overdue: boolean }) => boolean> = {
  all: () => true,
  draft: (s) => ["DRAFT", "ASSIGNED"].includes(s.status),
  submitted: (s) => s.status === "SUBMITTED",
  pending: (s) => s.status === "UNDER_REVIEW",
  approved: (s) => s.status === "APPROVED",
  rejected: (s) => ["REJECTED", "CHANGES_REQUESTED"].includes(s.status),
  overdue: (s) => s.overdue && s.status !== "APPROVED",
};

export async function GET(req: NextRequest) {
  return baHandle(async () => {
    const ctx = await requireBuAdmin();
    const sp = req.nextUrl.searchParams;
    const tab = (sp.get("tab") ?? "all").toLowerCase();
    const q = (sp.get("q") ?? "").trim().toLowerCase();
    const category = (sp.get("category") ?? "").trim();
    const categoryFilter = category.toUpperCase() === "ALL" ? "" : category;  // view sentinel must not filter
    const projectId = (sp.get("projectId") ?? "").trim();
    const userId = (sp.get("userId") ?? "").trim();
    const level = (sp.get("level") ?? "").trim().toUpperCase();
    const page = num(sp.get("page"), 1);
    const pageSize = Math.min(num(sp.get("pageSize"), 10), 50);
    const periodRaw = (sp.get("period") ?? "").trim();
    const periodFilter = periodRaw ? (periodRaw === "ALL" ? null : periodRaw) : "FY 2025-26";

    const [all, projectNames, userNames] = await Promise.all([
      db.submission.findMany({
        where: { businessUnitId: ctx.businessUnitId, ...(periodFilter ? { period: periodFilter } : {}) },
        orderBy: { updatedAt: "desc" },
      }),
      loadBuProjectNames(ctx.businessUnitId),
      loadBuUserNames(ctx.businessUnitId, ctx.subsidiaryId),
    ]);
    const buMap = new Map<string, string>([[ctx.businessUnitId, ""]]);

    /* Level filter FIRST so tab-strip counts always match the rows shown for this level. */
    let scoped = all;
    if (level === "BU") scoped = scoped.filter((s) => !s.projectId);
    else if (level === "PROJECT") scoped = scoped.filter((s) => !!s.projectId);

    const counts = {
      all: scoped.length,
      draft: scoped.filter(TAB_FILTERS.draft).length,
      submitted: scoped.filter(TAB_FILTERS.submitted).length,
      pending: scoped.filter(TAB_FILTERS.pending).length,
      approved: scoped.filter(TAB_FILTERS.approved).length,
      rejected: scoped.filter(TAB_FILTERS.rejected).length,
      overdue: scoped.filter(TAB_FILTERS.overdue).length,
    };

    let rows = scoped;
    const tabFn = TAB_FILTERS[tab] ?? TAB_FILTERS.all;
    rows = rows.filter(tabFn);
    if (categoryFilter) rows = rows.filter((s) => s.category === categoryFilter);
    if (projectId) rows = rows.filter((s) => s.projectId === projectId);
    if (userId) rows = rows.filter((s) => s.submittedById === userId);
    if (q) rows = rows.filter((s) => `${s.ref} ${s.title} ${s.metricName}`.toLowerCase().includes(q));

    const total = rows.length;
    const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);

    /* Resolve any submitter/reviewer names outside the BU's own user list. */
    const extraIds = [...new Set(
      pageRows.flatMap((s) => [s.submittedById, s.reviewerId]).filter((x): x is string => !!x)
    )].filter((id) => !userNames.has(id));
    if (extraIds.length) {
      const extras = await db.user.findMany({ where: { id: { in: extraIds } }, select: { id: true, name: true } });
      for (const u of extras) userNames.set(u.id, u.name);
    }

    const submissions = pageRows.map((s) => toSubmissionRow(s, userNames, buMap, projectNames));
    return ok({ submissions, total, page, pageSize, counts });
  });
}
