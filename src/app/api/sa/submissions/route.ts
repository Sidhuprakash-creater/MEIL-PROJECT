import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { saHandle, requireSubsidiaryAdmin } from "@/lib/sa/server";
import { toSubmissionRow } from "@/lib/sa/rows";

export const dynamic = "force-dynamic";

const num = (v: string | null, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : d;
};

/* Tab → status mapping (contract §Submissions). */
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
  return saHandle(async () => {
    const ctx = await requireSubsidiaryAdmin();
    const sp = req.nextUrl.searchParams;
    const tab = (sp.get("tab") ?? "all").toLowerCase();
    const q = (sp.get("q") ?? "").trim().toLowerCase();
    const category = (sp.get("category") ?? "").trim();
    const buId = (sp.get("buId") ?? "").trim();
    const projectId = (sp.get("projectId") ?? "").trim();
    const userId = (sp.get("userId") ?? "").trim();
    const level = (sp.get("level") ?? "").trim().toUpperCase();
    const page = num(sp.get("page"), 1);
    const pageSize = Math.min(num(sp.get("pageSize"), 10), 50);
    // Absent → current mandated period; "ALL" → every period.
    const periodRaw = (sp.get("period") ?? "").trim();
    const periodFilter = periodRaw ? (periodRaw === "ALL" ? null : periodRaw) : "FY 2025-26";

    const [all, units, projects, users] = await Promise.all([
      db.submission.findMany({
        where: { subsidiaryId: ctx.subsidiaryId, ...(periodFilter ? { period: periodFilter } : {}) },
        orderBy: { updatedAt: "desc" },
      }),
      db.businessUnit.findMany({ where: { subsidiaryId: ctx.subsidiaryId }, select: { id: true, name: true } }),
      db.project.findMany({ where: { businessUnit: { subsidiaryId: ctx.subsidiaryId } }, select: { id: true, name: true } }),
      db.user.findMany({ where: { subsidiaryId: ctx.subsidiaryId }, select: { id: true, name: true } }),
    ]);

    /* Level filter FIRST so tab-strip counts always match the rows shown for this level. */
    let scoped = all;
    if (level === "BU") scoped = scoped.filter((s) => !s.projectId);
    else if (level === "PROJECT") scoped = scoped.filter((s) => !!s.projectId);

    /* Tab-strip counts: computed over the level-scoped period set. */
    const counts = {
      all: scoped.length,
      draft: scoped.filter(TAB_FILTERS.draft).length,
      submitted: scoped.filter(TAB_FILTERS.submitted).length,
      pending: scoped.filter(TAB_FILTERS.pending).length,
      approved: scoped.filter(TAB_FILTERS.approved).length,
      rejected: scoped.filter(TAB_FILTERS.rejected).length,
      overdue: scoped.filter(TAB_FILTERS.overdue).length,
    };

    /* Row set: tab + remaining filters applied on top. */
    let rows = scoped;
    const tabFn = TAB_FILTERS[tab] ?? TAB_FILTERS.all;
    rows = rows.filter(tabFn);
    if (category) rows = rows.filter((s) => s.category === category);
    if (buId) rows = rows.filter((s) => s.businessUnitId === buId);
    if (projectId) rows = rows.filter((s) => s.projectId === projectId);
    if (userId) rows = rows.filter((s) => s.submittedById === userId);
    if (q) rows = rows.filter((s) => `${s.ref} ${s.title} ${s.metricName}`.toLowerCase().includes(q));

    const total = rows.length;
    const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);

    /* Name maps (include group reviewers that fall outside the subsidiary). */
    const buNames = new Map(units.map((u) => [u.id, u.name]));
    const projectNames = new Map(projects.map((p) => [p.id, p.name]));
    const userNames = new Map(users.map((u) => [u.id, u.name]));
    const extraIds = [...new Set(
      pageRows.flatMap((s) => [s.submittedById, s.reviewerId]).filter((x): x is string => !!x)
    )].filter((id) => !userNames.has(id));
    if (extraIds.length) {
      const extras = await db.user.findMany({ where: { id: { in: extraIds } }, select: { id: true, name: true } });
      for (const u of extras) userNames.set(u.id, u.name);
    }

    const submissions = pageRows.map((s) => toSubmissionRow(s, userNames, buNames, projectNames));
    return ok({ submissions, total, page, pageSize, counts });
  });
}
