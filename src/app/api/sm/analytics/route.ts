import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { smHandle, requireSubsidiaryManager, getSubsidiaryOrThrow, parseJson } from "@/lib/sm/server";
import { SA_CATEGORIES, CATEGORY_LABELS, SUBMISSION_STATUS_LABELS } from "@/lib/sm/types";
import type { ManagerAnalyticsData } from "@/lib/sm/types";
import { buCompletionRows } from "@/lib/sa/helpers";

export const dynamic = "force-dynamic";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY = 86400000;

/* GET /api/sm/analytics?period= — subsidiary-scoped REVIEW + reporting analytics:
   decision trend, review turnaround, status mix, completion, evidence gaps. */

export async function GET(req: NextRequest) {
  return smHandle(async () => {
    const ctx = await requireSubsidiaryManager();
    const sub = await getSubsidiaryOrThrow(ctx.subsidiaryId);
    const period = req.nextUrl.searchParams.get("period") ?? "FY 2025-26";
    const now = new Date();

    const [subs, units, openIssues, evidence] = await Promise.all([
      db.submission.findMany({ where: { subsidiaryId: ctx.subsidiaryId, period } }),
      db.businessUnit.findMany({ where: { subsidiaryId: ctx.subsidiaryId } }),
      db.validationIssue.findMany({ where: { subsidiaryId: ctx.subsidiaryId, status: { in: ["OPEN", "ASSIGNED"] } } }),
      db.evidenceDoc.findMany({ where: { subsidiaryId: ctx.subsidiaryId } }),
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

    /* Decision trend — decisions recorded in the last 6 months (any reviewer). */
    const trendBuckets = monthBuckets(6);
    const decisionTrend = trendBuckets.map((b) => {
      const idx = trendBuckets.indexOf(b);
      const inMonth = subs.filter((s) => bucketIndex(s.reviewedAt, trendBuckets) === idx);
      return {
        label: b.label,
        approved: inMonth.filter((s) => s.status === "APPROVED").length,
        rejected: inMonth.filter((s) => ["REJECTED", "CHANGES_REQUESTED"].includes(s.status)).length,
      };
    });

    const statusMix = Object.entries(SUBMISSION_STATUS_LABELS).map(([status, label]) => ({
      status,
      label,
      count: subs.filter((s) => s.status === status).length,
    }));

    const completionByBU = buCompletionRows(units, subs);

    const overdueByBU = units.map((u) => ({
      name: u.name,
      overdue: subs.filter((s) => s.businessUnitId === u.id && !s.projectId && s.overdue && s.status !== "APPROVED").length,
    }));

    /* Review turnaround: submittedAt → reviewedAt for decided reports. */
    const decided = subs.filter((s) => s.reviewedAt && s.submittedAt && ["APPROVED", "REJECTED", "CHANGES_REQUESTED"].includes(s.status));
    const turnBuckets = monthBuckets(6);
    const byMonth = turnBuckets.map((b) => {
      const idx = turnBuckets.indexOf(b);
      const inMonth = decided.filter((s) => bucketIndex(s.reviewedAt, turnBuckets) === idx);
      const days = inMonth.map((s) => Math.max(0, (s.reviewedAt!.getTime() - s.submittedAt!.getTime()) / DAY));
      return {
        label: b.label,
        avgDays: days.length ? Math.round((days.reduce((a, x) => a + x, 0) / days.length) * 10) / 10 : 0,
        decided: inMonth.length,
      };
    });
    const allDays = decided.map((s) => Math.max(0, (s.reviewedAt!.getTime() - s.submittedAt!.getTime()) / DAY));
    const reviewTurnaround = {
      avgDays: allDays.length ? Math.round((allDays.reduce((a, x) => a + x, 0) / allDays.length) * 10) / 10 : 0,
      decidedCount: decided.length,
      byMonth,
    };

    /* Pending vs approved by submission month. */
    const pvaBuckets = monthBuckets(6);
    const pendingVsApproved = pvaBuckets.map((b) => {
      const idx = pvaBuckets.indexOf(b);
      const inMonth = subs.filter((s) => bucketIndex(s.submittedAt, pvaBuckets) === idx);
      return {
        label: b.label,
        pending: inMonth.filter((s) => ["SUBMITTED", "UNDER_REVIEW"].includes(s.status)).length,
        approved: inMonth.filter((s) => s.status === "APPROVED").length,
      };
    });

    /* Resubmission rate: rejected reports that came back and re-entered review. */
    const rejectedCount = subs.filter((s) => ["REJECTED", "CHANGES_REQUESTED"].includes(s.status)).length;
    const resubmitted = subs.filter((s) => {
      if (!["SUBMITTED", "UNDER_REVIEW", "APPROVED"].includes(s.status)) return false;
      return parseJson<{ action?: string; note?: string }[]>(s.history, []).some((h) =>
        `${h.action ?? ""} ${h.note ?? ""}`.toLowerCase().includes("resubmit")
      );
    }).length;
    const resubmissionRate = {
      resubmitted,
      rejected: rejectedCount,
      pct: rejectedCount ? Math.round((resubmitted / rejectedCount) * 100) : 0,
    };

    /* Evidence gaps across the repository. */
    const byType = new Map<string, number>();
    for (const d of evidence) byType.set(d.fileType, (byType.get(d.fileType) ?? 0) + 1);
    const evidenceGaps = {
      total: evidence.length,
      missing: evidence.filter((d) => d.status === "MISSING").length,
      expired: evidence.filter((d) => d.status === "EXPIRED").length,
      byType: [...byType.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
    };

    /* Category pulse — latest approved metric per category vs previous. */
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

    const data: ManagerAnalyticsData = {
      period,
      decisionTrend,
      statusMix,
      completionByBU,
      overdueByBU,
      reviewTurnaround,
      pendingVsApproved,
      resubmissionRate,
      evidenceGaps,
      categoryPulse,
    };
    void sub;
    return ok(data);
  });
}
