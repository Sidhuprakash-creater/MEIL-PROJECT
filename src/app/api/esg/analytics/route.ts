import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handle, ok, ACTOR } from "@/lib/esg/server";
import type { AnalyticsData } from "@/lib/esg/types";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const scope = req.nextUrl.searchParams.get("scope") || "GROUP";
    const where = scope !== "GROUP" ? { subsidiaryId: scope } : {};
    const [subs, submissions] = await Promise.all([
      db.subsidiary.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
      db.submission.findMany({ where, orderBy: { createdAt: "asc" } }),
    ]);
    const approved = submissions.filter((s) => s.status === "APPROVED");
    const labels = ["Apr–Jun", "Jul–Sep", "Oct–Dec", "Jan–Mar"];

    // Deterministic demo-series derived from approved data + index so charts are stable
    const series = <T,>(make: (i: number) => T): T[] => labels.map((_, i) => make(i));

    const sumFor = (test: (s: (typeof approved)[number]) => boolean) =>
      approved.filter(test).reduce((a, s) => a + s.metricValue, 0);

    const scope1Base = sumFor((s) => s.metricName.toLowerCase().includes("scope 1")) || 48000;
    const scope2Base = sumFor((s) => s.metricName.toLowerCase().includes("scope 2")) || 31500;

    const data: AnalyticsData = {
      environmental: series((i) => ({
        label: labels[i],
        energy: +(scope1Base * 0.32 + i * 2100).toFixed(0),
        renewable: +(24 + i * 1.8).toFixed(1),
        intensity: +(2.9 - i * 0.08).toFixed(2),
      })),
      emissions: series((i) => ({
        label: labels[i],
        scope1: +(scope1Base * (0.9 + i * 0.05)).toFixed(0),
        scope2: +(scope2Base * (0.92 + i * 0.04)).toFixed(0),
        scope3: +(1240 + i * 90).toFixed(0),
      })),
      water: series((i) => ({
        label: labels[i],
        withdrawal: +(84200 * (0.95 + i * 0.06)).toFixed(0),
        discharge: +(41200 * (0.96 + i * 0.05)).toFixed(0),
        recycled: +(6800 + i * 420).toFixed(0),
      })),
      waste: series((i) => ({
        label: labels[i],
        hazardous: +(46.2 * (0.9 + i * 0.08)).toFixed(1),
        nonHazardous: +(312 * (0.94 + i * 0.05)).toFixed(1),
        recycled: +(74.1 + i * 1.4).toFixed(1),
      })),
      safety: series((i) => ({
        label: labels[i],
        ltifr: +(0.46 - i * 0.02).toFixed(2),
        incidents: +(3 - Math.floor(i / 2)).toFixed(0),
        nearMiss: +(18 + i * 2).toFixed(0),
        trainings: +(3100 + i * 260).toFixed(0),
      })),
      workforce: series((i) => ({
        label: labels[i],
        headcount: +(48200 + i * 340).toFixed(0),
        diversity: +(17.6 + i * 0.4).toFixed(1),
        turnover: +(9.8 - i * 0.15).toFixed(1),
        training: +(12480 + i * 820).toFixed(0),
      })),
      procurement: series((i) => ({
        label: labels[i],
        localSourcing: +(66.5 + i * 0.7).toFixed(1),
        greenSpend: +(286 + i * 12).toFixed(0),
      })),
      csr: series((i) => ({
        label: labels[i],
        beneficiaries: +(15230 + i * 940).toFixed(0),
        spend: +(38.4 + i * 1.9).toFixed(1),
        programs: +(14 + i).toFixed(0),
      })),
      compliance: series((i) => ({
        label: labels[i],
        nonCompliance: +(1 - Math.floor(i / 2)).toFixed(0),
        openFindings: +(9 - i).toFixed(0),
        closedFindings: +(14 + i * 3).toFixed(0),
      })),
      completion: subs.map((s) => {
        const mine = submissions.filter((x) => x.subsidiaryId === s.id);
        return {
          label: s.name.replace("MEIL ", ""),
          submitted: mine.length,
          approved: mine.filter((x) => x.status === "APPROVED").length,
          overdue: mine.filter((x) => x.overdue).length,
        };
      }),
      subsidiaries: subs.map((s) => ({ id: s.id, name: s.name })),
      periods: ["FY 2024-25", "FY 2025-26", "FY 2026-27"],
    };
    return ok(data);
  });
}

void ACTOR;
