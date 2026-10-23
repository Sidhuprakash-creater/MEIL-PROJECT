import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { saHandle, requireSubsidiaryAdmin, getSubsidiaryOrThrow } from "@/lib/sa/server";
import { SA_CATEGORIES, CATEGORY_LABELS, SUBMISSION_STATUS_LABELS } from "@/lib/sa/types";
import type { AnalyticsData } from "@/lib/sa/types";
import { buCompletionRows } from "@/lib/sa/helpers";

export const dynamic = "force-dynamic";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* GET /api/sa/analytics?period= — reporting analytics for the subsidiary:
   completion, submission & metric trends, status mix, data-quality mix. */

export async function GET(req: NextRequest) {
  return saHandle(async () => {
    const ctx = await requireSubsidiaryAdmin();
    const sub = await getSubsidiaryOrThrow(ctx.subsidiaryId);
    const period = req.nextUrl.searchParams.get("period") ?? "FY 2025-26";
    const now = new Date();

    const [subs, units, openIssues] = await Promise.all([
      db.submission.findMany({ where: { subsidiaryId: ctx.subsidiaryId, period } }),
      db.businessUnit.findMany({ where: { subsidiaryId: ctx.subsidiaryId } }),
      db.validationIssue.findMany({ where: { subsidiaryId: ctx.subsidiaryId, status: { in: ["OPEN", "ASSIGNED"] } } }),
    ]);

    const monthBuckets = (count: number) => {
      const arr: { label: string; start: Date; end: Date }[] = [];
      for (let i = count - 1; i >= 0; i--) {
        const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        arr.push({ label: MONTHS[start.getMonth()], start, end });
      }
      return arr;
    };
    const bucketIndex = (d: Date | null, buckets: { start: Date; end: Date }[]) => {
      if (!d) return -1;
      const t = d.getTime();
      return buckets.findIndex((b) => t >= b.start.getTime() && t < b.end.getTime());
    };

    const completionByBU = buCompletionRows(units, subs);

    const trendBuckets = monthBuckets(6);
    const submissionTrend = trendBuckets.map((b) => {
      const inMonth = subs.filter((s) => bucketIndex(s.submittedAt, trendBuckets) === trendBuckets.indexOf(b));
      return {
        label: b.label,
        submitted: inMonth.length,
        approved: inMonth.filter((s) => s.status === "APPROVED").length,
      };
    });

    const statusMix = Object.entries(SUBMISSION_STATUS_LABELS).map(([status, label]) => ({
      status,
      label,
      count: subs.filter((s) => s.status === status).length,
    }));

    const overdueByBU = units.map((u) => ({
      name: u.name,
      overdue: subs.filter((s) => s.businessUnitId === u.id && !s.projectId && s.overdue && s.status !== "APPROVED").length,
    }));

    /* metric trends — 12 months of approved submissions per category.
       energy/emissions/water/waste: raw metricValue sum, rounded.
       safety: approved submission count (incidents reported). */
    const metricBuckets = monthBuckets(12);
    const metricTrends = metricBuckets.map((b) => ({ month: b.label, energy: 0, emissions: 0, water: 0, waste: 0, safety: 0 }));
    for (const s of subs) {
      if (s.status !== "APPROVED") continue;
      const idx = bucketIndex(s.submittedAt, metricBuckets);
      if (idx < 0) continue;
      switch (s.category) {
        case "ENERGY":
          metricTrends[idx].energy += s.metricValue;
          break;
        case "EMISSIONS":
          metricTrends[idx].emissions += s.metricValue;
          break;
        case "WATER":
          metricTrends[idx].water += s.metricValue;
          break;
        case "WASTE":
          metricTrends[idx].waste += s.metricValue;
          break;
        case "SAFETY":
          metricTrends[idx].safety += 1;
          break;
      }
    }
    for (const m of metricTrends) {
      m.energy = Math.round(m.energy);
      m.emissions = Math.round(m.emissions);
      m.water = Math.round(m.water);
      m.waste = Math.round(m.waste);
    }

    const qualityDist = ["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((severity) => ({
      severity,
      count: openIssues.filter((i) => i.severity === severity).length,
    }));

    const pvaBuckets = monthBuckets(6);
    const pendingVsApproved = pvaBuckets.map((b) => {
      const inMonth = subs.filter((s) => bucketIndex(s.submittedAt, pvaBuckets) === pvaBuckets.indexOf(b));
      return {
        month: b.label,
        pending: inMonth.filter((s) => ["SUBMITTED", "UNDER_REVIEW"].includes(s.status)).length,
        approved: inMonth.filter((s) => s.status === "APPROVED").length,
      };
    });

    /* category pulse — latest approved metric per category vs the previous
       approved value; change 0 when no baseline is available. */
    const categoryPulse = SA_CATEGORIES.flatMap((cat) => {
      const list = subs
        .filter((s) => s.category === cat && s.status === "APPROVED")
        .sort((a, b) => (a.reviewedAt ?? a.submittedAt ?? a.createdAt).getTime() - (b.reviewedAt ?? b.submittedAt ?? b.createdAt).getTime());
      const latest = list[list.length - 1];
      if (!latest) return [];
      const prev = list[list.length - 2];
      const change = prev && prev.metricValue !== 0
        ? Math.round(((latest.metricValue - prev.metricValue) / Math.abs(prev.metricValue)) * 100)
        : 0;
      return [{ category: cat, label: CATEGORY_LABELS[cat] ?? cat, value: latest.metricValue, unit: latest.metricUnit, change }];
    });

    const data: AnalyticsData = {
      period,
      completionByBU,
      submissionTrend,
      statusMix,
      overdueByBU,
      metricTrends,
      qualityDist,
      pendingVsApproved,
      categoryPulse,
    };
    return ok(data);
  });
}
