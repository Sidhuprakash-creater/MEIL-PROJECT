import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { baHandle, requireBuAdmin, parseJson, getBuOrThrow } from "@/lib/ba/server";
import { SA_CATEGORIES, CATEGORY_LABELS } from "@/lib/ba/types";
import type { BaEsgData } from "@/lib/ba/types";
import { readinessPctOf, toPackageRow } from "@/lib/sa/helpers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return baHandle(async () => {
    const ctx = await requireBuAdmin();
    const bu = await getBuOrThrow(ctx.businessUnitId);
    const period = req.nextUrl.searchParams.get("period") ?? "FY 2025-26";

    const [subs, projects, openIssueCount, issueRefs, missingEvidenceDocs, packages] = await Promise.all([
      db.submission.findMany({ where: { businessUnitId: ctx.businessUnitId, period } }),
      db.project.findMany({ where: { businessUnitId: ctx.businessUnitId }, select: { id: true, name: true } }),
      db.validationIssue.count({ where: { subsidiaryId: ctx.subsidiaryId, businessUnitId: ctx.businessUnitId, status: { in: ["OPEN", "ASSIGNED"] } } }),
      db.validationIssue.findMany({ where: { subsidiaryId: ctx.subsidiaryId, businessUnitId: ctx.businessUnitId }, select: { submissionRef: true } }),
      db.evidenceDoc.count({ where: { businessUnitId: ctx.businessUnitId, status: "MISSING" } }),
      db.reportingPackage.findMany({ where: { subsidiaryId: ctx.subsidiaryId }, orderBy: { updatedAt: "desc" } }),
    ]);

    const projectNames = new Map(projects.map((p) => [p.id, p.name]));
    const orgOf = (s: { projectId: string | null }) =>
      (s.projectId ? projectNames.get(s.projectId) : bu.name) ?? bu.name;

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

    const projectCoverage = projects.map((p) => {
      const list = subs.filter((s) => s.projectId === p.id);
      const app = list.filter((s) => s.status === "APPROVED").length;
      const pend = list.filter((s) => ["SUBMITTED", "UNDER_REVIEW"].includes(s.status)).length;
      return {
        projectId: p.id, projectName: p.name,
        total: list.length, approved: app, pending: pend,
        missing: list.length - app - pend,
        completionPct: list.length ? Math.round((app / list.length) * 100) : 0,
      };
    });

    /* metric roll-up — approved totals per metric+unit. */
    interface Metric { name: string; unit: string; approvedTotal: number; pendingTotal: number; sourceCount: number }
    const metricMap = new Map<string, Metric>();
    for (const s of approved) {
      const key = `${s.metricName}||${s.metricUnit}`;
      const m = metricMap.get(key) ?? { name: s.metricName || s.title, unit: s.metricUnit, approvedTotal: 0, pendingTotal: 0, sourceCount: 0 };
      m.approvedTotal += s.metricValue;
      m.sourceCount += 1;
      metricMap.set(key, m);
    }
    for (const s of pendingReview) {
      const key = `${s.metricName}||${s.metricUnit}`;
      const m = metricMap.get(key);
      if (!m) continue;
      m.pendingTotal += s.metricValue;
      m.sourceCount += 1;
    }
    const metrics = [...metricMap.values()].map((m) => ({
      name: m.name, unit: m.unit,
      approvedTotal: Math.round(m.approvedTotal * 100) / 100,
      pendingTotal: Math.round(m.pendingTotal * 100) / 100,
      sourceCount: m.sourceCount,
    })).sort((a, b) => b.approvedTotal - a.approvedTotal);

    /* packages: only the ones where the BU is the source (filter by sourceRefs
       containing BU submission refs). Since packages are subsidiary-scoped,
       we filter to ones that include at least one BU submission. */
    const buSubRefs = new Set(subs.map((s) => s.ref));
    const buPackages = packages
      .filter((p) => {
        const refs = parseJson<string[]>(p.sourceRefs, []);
        return refs.length === 0 || refs.some((r) => buSubRefs.has(r));
      })
      .map(toPackageRow);

    void issueRefs;
    void orgOf;
    const data: BaEsgData = {
      period, readiness, categories, projectCoverage, metrics, packages: buPackages,
    };
    return ok(data);
  });
}
