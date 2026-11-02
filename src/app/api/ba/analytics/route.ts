import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { baHandle, requireBuAdmin, getBuOrThrow } from "@/lib/ba/server";
import { SA_CATEGORIES, CATEGORY_LABELS, SUBMISSION_STATUS_LABELS } from "@/lib/ba/types";
import type { BaAnalyticsData } from "@/lib/ba/types";

export const dynamic = "force-dynamic";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export async function GET(req: NextRequest) {
  return baHandle(async () => {
    const ctx = await requireBuAdmin();
    const bu = await getBuOrThrow(ctx.businessUnitId);
    const period = req.nextUrl.searchParams.get("period") ?? "FY 2025-26";
    const now = new Date();

    const [subs, projects, openIssues, evidence] = await Promise.all([
      db.submission.findMany({ where: { businessUnitId: ctx.businessUnitId, period } }),
      db.project.findMany({ where: { businessUnitId: ctx.businessUnitId }, select: { id: true, name: true } }),
      db.validationIssue.findMany({ where: { subsidiaryId: ctx.subsidiaryId, businessUnitId: ctx.businessUnitId, status: { in: ["OPEN", "ASSIGNED"] } } }),
      db.evidenceDoc.findMany({ where: { businessUnitId: ctx.businessUnitId }, select: { fileType: true, status: true } }),
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

    const completionByProject = projects.map((p) => {
      const list = subs.filter((s) => s.projectId === p.id);
      const approved = list.filter((s) => s.status === "APPROVED").length;
      return {
        name: p.name,
        completionPct: list.length ? Math.round((approved / list.length) * 100) : 0,
        approved, total: list.length,
      };
    });

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
      status, label,
      count: subs.filter((s) => s.status === status).length,
    }));

    const overdueByProject = projects.map((p) => ({
      name: p.name,
      overdue: subs.filter((s) => s.projectId === p.id && s.overdue && s.status !== "APPROVED").length,
    }));

    const metricBuckets = monthBuckets(12);
    const metricTrends = metricBuckets.map((b) => ({ month: b.label, energy: 0, emissions: 0, water: 0, waste: 0, safety: 0 }));
    for (const s of subs) {
      if (s.status !== "APPROVED") continue;
      const idx = bucketIndex(s.submittedAt, metricBuckets);
      if (idx < 0) continue;
      switch (s.category) {
        case "ENERGY": metricTrends[idx].energy += s.metricValue; break;
        case "EMISSIONS": metricTrends[idx].emissions += s.metricValue; break;
        case "WATER": metricTrends[idx].water += s.metricValue; break;
        case "WASTE": metricTrends[idx].waste += s.metricValue; break;
        case "SAFETY": metricTrends[idx].safety += 1; break;
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

    const byType = new Map<string, number>();
    for (const d of evidence) byType.set(d.fileType, (byType.get(d.fileType) ?? 0) + 1);
    const evidenceGaps = {
      total: evidence.length,
      missing: evidence.filter((d) => d.status === "MISSING").length,
      expired: evidence.filter((d) => d.status === "EXPIRED").length,
      byType: [...byType.entries()].map(([type, count]) => ({ type, count })),
    };

    const data: BaAnalyticsData = {
      period,
      completionByProject,
      submissionTrend,
      statusMix,
      overdueByProject,
      metricTrends,
      qualityDist,
      pendingVsApproved,
      evidenceGaps,
      categoryPulse,
    };
    return ok(data);
  });
}
