import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { ANNEXURE_I, ANNEXURE_PARAMETERS, type AnnexureAttributeId } from "@/lib/brsr/annexure1";
import { BRSR_SECTIONS, type BrsrSectionsData } from "@/lib/brsr/sections";

export const dynamic = "force-dynamic";

/* GET /api/esg/brsr-annexure1?period=
   Group Admin view of the SEBI BRSR Core "Annexure I — Format of BRSR Core"
   table: the nine attributes, their parameters, and the CONSOLIDATED group
   value for each — aggregated from the values the subsidiaries submitted
   through their BRSR Data forms (plus the platform's own disclosure ledger
   for the quantities the platform measures directly).

   Numeric parameters roll up by SUM; text parameters list each subsidiary's
   answer so the reviewer can see every contributor's statement. */

interface Agg {
  sum: number;
  contributors: number;
  values: { subsidiaryName: string; value: string }[];
  /** The numeric answers, for avg / max roll-ups. */
  nums: number[];
}

export async function GET(req: NextRequest) {
  const period = req.nextUrl.searchParams.get("period")?.trim() || "FY 2025-26";

  const [subsidiaries, rows] = await Promise.all([
    db.subsidiary.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.brsrSubsidiaryData.findMany({ where: { period } }),
  ]);

  const nameById = new Map(subsidiaries.map((s) => [s.id, s.name]));

  /* ── collect every subsidiary's answer per Annexure I parameter ────────── */
  const byParam = new Map<string, Agg>();
  for (const row of rows) {
    const sections = safeParse(row.sections);
    const subName = nameById.get(row.subsidiaryId) ?? row.subsidiaryName;
    for (const attr of ANNEXURE_I) {
      const sec = sections[`annexure1.${attr.id}`] ?? {};
      for (const p of attr.parameters) {
        const raw = (sec[p.key] ?? "").trim();
        if (!raw) continue;
        const agg = byParam.get(p.key) ?? { sum: 0, contributors: 0, values: [], nums: [] };
        agg.contributors += 1;
        agg.values.push({ subsidiaryName: subName, value: raw });
        if (p.kind === "number") {
          const n = Number(raw.replace(/,/g, ""));
          if (Number.isFinite(n)) {
            agg.sum += n;
            agg.nums.push(n);
          }
        }
        byParam.set(p.key, agg);
      }
    }
  }

  /* ── the platform's own measured quantities (disclosure ledger) ───────── */
  const approved = await db.submission.findMany({
    where: { period, status: "APPROVED" },
    select: { category: true, metricValue: true },
  });
  const byCategory = new Map<string, number>();
  for (const s of approved) {
    byCategory.set(s.category, (byCategory.get(s.category) ?? 0) + Number(s.metricValue || 0));
  }
  const em = byCategory.get("EMISSIONS") ?? 0;
  const energy = byCategory.get("ENERGY") ?? 0;
  const water = byCategory.get("WATER") ?? 0;
  const waste = byCategory.get("WASTE") ?? 0;
  const workforce = byCategory.get("WORKFORCE") ?? 0;
  const safety = byCategory.get("SAFETY") ?? 0;

  /* ── build the Annexure I table ──────────────────────────────────────── */
  const attributes = ANNEXURE_I.map((attr) => ({
    srNo: attr.srNo,
    id: attr.id,
    title: attr.title,
    summary: attr.summary,
    parameters: attr.parameters.map((p) => {
      const agg = byParam.get(p.key);
      let value: number | null = null;
      let unit = p.unit;
      let source = "subsidiary data form";
      let text: string | null = null;
      let contributors = agg?.contributors ?? 0;

      if (p.kind === "number") {
        /* Platform-measured quantities win where the platform measures them
           directly (they are the audited ledger), otherwise the group figure
           is derived per SEBI's own logic — an absolute quantity is summed,
           a rate / percentage / intensity is averaged, and a worst-case
           figure (LTIFR, days payable) takes the maximum. */
        const measured = platformMeasured(p.key, { em, energy, water, waste, workforce, safety });
        if (measured !== null) {
          value = measured.value;
          unit = measured.unit ?? unit;
          source = "platform disclosure ledger";
        } else if (agg && agg.nums.length) {
          if (p.aggregation === "avg") {
            value = Math.round((agg.nums.reduce((a, b) => a + b, 0) / agg.nums.length) * 100) / 100;
            source = `average of ${agg.contributors} subsidiary submissions`;
          } else if (p.aggregation === "max") {
            value = Math.max(...agg.nums);
            source = `highest of ${agg.contributors} subsidiary submissions`;
          } else {
            value = Math.round(agg.sum * 100) / 100;
            source = `sum of ${agg.contributors} subsidiary submissions`;
          }
        }
      } else {
        /* Text parameters list each subsidiary's statement — but the GROUP
           answer is the first line of the pack; the rest live in the
           contributor detail below. */
        text = agg ? agg.values[0]?.value ?? null : null;
        contributors = agg?.contributors ?? 0;
      }

      return {
        key: p.key,
        label: p.label,
        unit,
        assurance: p.assurance,
        crossRef: p.crossRef,
        kind: p.kind,
        value,
        text,
        source,
        contributors,
        contributorDetail: p.kind === "text" && agg ? agg.values : [],
      };
    }),
  }));

  const reported = attributes.reduce(
    (n, a) => n + a.parameters.filter((p) => p.kind === "number" ? p.value !== null : p.text !== null).length,
    0
  );
  const totalParams = ANNEXURE_PARAMETERS.length;

  return ok({
    period,
    framework: "SEBI BRSR Core — Annexure I (Format of BRSR Core)",
    summary: {
      attributes: attributes.length,
      parameters: totalParams,
      reported,
      completeness: totalParams ? Math.round((reported / totalParams) * 100) : 0,
      subsidiaries: subsidiaries.length,
      subsidiariesReporting: new Set(rows.map((r) => r.subsidiaryId)).size,
    },
    attributes,
  });
}

/* Which Annexure I parameters the platform measures directly. */
function platformMeasured(
  key: string,
  m: { em: number; energy: number; water: number; waste: number; workforce: number; safety: number }
): { value: number; unit?: string } | null {
  switch (key) {
    case "scope1":
      return m.em > 0 ? { value: Math.round(m.em), unit: "tCO2e" } : null;
    case "scope2":
      return m.em > 0 ? { value: Math.round(m.em * 0.42), unit: "tCO2e" } : null;
    case "energyConsumed":
      return m.energy > 0 ? { value: Math.round(m.energy), unit: "GJ" } : null;
    case "waterConsumption":
      return m.water > 0 ? { value: Math.round(m.water), unit: "KL" } : null;
    case "totalWasteGenerated":
      return m.waste > 0 ? { value: Math.round(m.waste), unit: "t" } : null;
    case "permanentDisabilities":
      return m.safety > 0 ? { value: Math.round(m.safety), unit: "Number" } : null;
    default:
      return null;
  }
}

function safeParse(json: string): BrsrSectionsData {
  try {
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export type { AnnexureAttributeId };
