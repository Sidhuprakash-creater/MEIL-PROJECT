import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { saHandle, requireSubsidiaryAdmin, parseJson, getSubsidiaryOrThrow } from "@/lib/sa/server";
import { SA_CATEGORIES, CATEGORY_LABELS } from "@/lib/sa/types";
import type { EsgReportingData } from "@/lib/sa/types";
import { buCompletionRows, readinessPctOf, toPackageRow } from "@/lib/sa/helpers";

export const dynamic = "force-dynamic";

/* GET /api/sa/esg?period= — ESG reporting readiness, consolidation preview,
   package register and active Group feedback for the subsidiary workspace. */

export async function GET(req: NextRequest) {
  return saHandle(async () => {
    const ctx = await requireSubsidiaryAdmin();
    const sub = await getSubsidiaryOrThrow(ctx.subsidiaryId);
    const period = req.nextUrl.searchParams.get("period") ?? "FY 2025-26";

    const [subs, units, projects, openIssueCount, issueRefs, missingEvidenceDocs, packages] = await Promise.all([
      db.submission.findMany({ where: { subsidiaryId: ctx.subsidiaryId, period } }),
      db.businessUnit.findMany({ where: { subsidiaryId: ctx.subsidiaryId } }),
      db.project.findMany({ where: { businessUnit: { subsidiaryId: ctx.subsidiaryId } }, select: { id: true, name: true } }),
      db.validationIssue.count({ where: { subsidiaryId: ctx.subsidiaryId, status: { in: ["OPEN", "ASSIGNED"] } } }),
      db.validationIssue.findMany({ where: { subsidiaryId: ctx.subsidiaryId }, select: { submissionRef: true } }),
      db.evidenceDoc.count({ where: { subsidiaryId: ctx.subsidiaryId, status: "MISSING" } }),
      db.reportingPackage.findMany({ where: { subsidiaryId: ctx.subsidiaryId }, orderBy: { updatedAt: "desc" } }),
    ]);

    const buNames = new Map(units.map((u) => [u.id, u.name]));
    const prjNames = new Map(projects.map((p) => [p.id, p.name]));
    const orgOf = (s: { businessUnitId: string | null; projectId: string | null }) =>
      (s.projectId ? prjNames.get(s.projectId) : s.businessUnitId ? buNames.get(s.businessUnitId) : null) ?? "—";

    const approved = subs.filter((s) => s.status === "APPROVED");
    const pendingReview = subs.filter((s) => ["SUBMITTED", "UNDER_REVIEW"].includes(s.status));
    const totalNonDraft = subs.filter((s) => s.status !== "DRAFT").length;
    const zeroEvidence = subs.filter((s) => s.status !== "DRAFT" && parseJson<string[]>(s.evidence, []).length === 0).length;

    const readiness = {
      pct: readinessPctOf(approved.length, totalNonDraft),
      eligibleApproved: approved.length,
      pendingReview: pendingReview.length,
      missingData: SA_CATEGORIES.filter((c) => !subs.some((s) => s.category === c)).length,
      validationExceptions: openIssueCount,
      evidenceGaps: missingEvidenceDocs + zeroEvidence,
    };

    const categories = SA_CATEGORIES.map((cat) => {
      const list = subs.filter((s) => s.category === cat);
      const app = list.filter((s) => s.status === "APPROVED").length;
      const pend = list.filter((s) => ["SUBMITTED", "UNDER_REVIEW"].includes(s.status)).length;
      return {
        category: cat,
        label: CATEGORY_LABELS[cat] ?? cat,
        total: list.length,
        approved: app,
        pending: pend,
        missing: list.length === 0,
        completionPct: list.length ? Math.round((app / list.length) * 100) : 0,
      };
    });

    /* consolidation preview — groups driven by APPROVED submissions, keyed by
       metricName+unit; pending (SUBMITTED/UNDER_REVIEW) records join an existing
       group as flagged pending sources and never inflate approved totals. */
    interface Group {
      metricName: string;
      unit: string;
      approvedTotal: number;
      pendingTotal: number;
      sources: { ref: string; label: string; org: string; value: number; unit: string; status: string }[];
    }
    const groups = new Map<string, Group>();
    for (const s of approved) {
      const key = `${s.metricName}||${s.metricUnit}`;
      const g = groups.get(key) ?? { metricName: s.metricName || s.title, unit: s.metricUnit, approvedTotal: 0, pendingTotal: 0, sources: [] };
      g.approvedTotal += s.metricValue;
      g.sources.push({ ref: s.ref, label: s.title, org: orgOf(s), value: s.metricValue, unit: s.metricUnit, status: s.status });
      groups.set(key, g);
    }
    for (const s of pendingReview) {
      const key = `${s.metricName}||${s.metricUnit}`;
      const g = groups.get(key);
      if (!g) continue; // grouping is driven by approved records
      g.pendingTotal += s.metricValue;
      g.sources.push({ ref: s.ref, label: s.title, org: orgOf(s), value: s.metricValue, unit: s.metricUnit, status: s.status });
    }
    const flaggedRefs = new Set(issueRefs.map((i) => i.submissionRef).filter(Boolean));
    const consolidation = [...groups.values()]
      .map((g) => ({
        metricName: g.metricName,
        unit: g.unit,
        approvedTotal: Math.round(g.approvedTotal * 100) / 100,
        pendingTotal: Math.round(g.pendingTotal * 100) / 100,
        sourceCount: g.sources.length,
        sources: g.sources.sort((a, b) => (a.status === "APPROVED" ? -1 : 1) - (b.status === "APPROVED" ? -1 : 1)),
        hasIssues: g.sources.some((src) => flaggedRefs.has(src.ref)),
      }))
      .sort((a, b) => b.approvedTotal - a.approvedTotal);

    const buCompletion = buCompletionRows(units, subs);

    const packageRows = packages.map(toPackageRow);
    const feedbackPkg = packages.find((p) => p.status === "CHANGES_REQUESTED");
    const activeFeedback = feedbackPkg
      ? { ref: feedbackPkg.ref, feedback: feedbackPkg.groupFeedback, at: feedbackPkg.updatedAt.toISOString() }
      : null;

    const data: EsgReportingData = {
      period,
      readiness,
      categories,
      consolidation,
      buCompletion,
      packages: packageRows,
      activeFeedback,
    };
    return ok(data);
  });
}
