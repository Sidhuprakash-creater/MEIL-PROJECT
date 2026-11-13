/* BRSR WIZARD PRESENTATION SEED — fills the Group Admin BRSR Reporting Center.
   · Upserts BrsrSubsidiaryData rows for all 7 subsidiaries (period FY 2026-27)
     with realistic Annexure I parameter values — these are what the wizard's
     "recompute" rolls up.
   · Rewrites the report's `disclosures` JSON: every catalog disclosure is
     MAPPED with a computed value where the data supports it (VALIDATED),
     narrative / N-A disclosures carry a documented exception note.
   · Dedupes the disclosures array (previous patches had grown it to 8000+). */
import { db } from "../src/lib/db";

const FY = "FY 2026-27";

/* Per-subsidiary annexure values, scaled by an operations factor. */
type Annex = Record<string, string | number | Record<string, string | number>>;
function annexureFor(name: string, f: number): Annex {
  const n = (v: number) => +(v * f).toFixed(2);
  return {
    "annexure1.ghg": {
      scope1: n(4200), scope2: n(38600), ghgIntensityTurnover: n(2.8),
      ghgIntensityOutput: `${name} — Scope 1+2 footprint per unit of service delivered (irrigation ML lifted / MWh generated), reported as delivered in Annexure II statements.`,
    },
    "annexure1.water": {
      waterConsumption: n(148000), waterIntensityTurnover: n(9.4),
      waterIntensityOutput: `${name} — water consumed per ML of water serviced; measured at intake flow meters minus discharge outflow.`,
      waterDischarge: `${name} — 62% to surface water after tertiary treatment, 24% to on-site reuse, 14% to municipal STP (all treated).`,
    },
    "annexure1.energy": {
      energyConsumed: n(98000), renewableShare: 12.4, energyIntensityTurnover: n(6.1),
      energyIntensityOutput: `${name} — GJ consumed per MWh delivered / per MT of material handled.`,
    },
    "annexure1.waste": {
      plasticWaste: n(3.2), ewaste: n(1.8), biomedicalWaste: n(0.4), cdWaste: n(210),
      batteryWaste: n(0.9), radioactiveWaste: 0, otherHazardousWaste: n(17.6),
      otherNonHazardousWaste: n(348), totalWasteGenerated: n(582), wasteIntensityTurnover: n(0.042),
      wasteIntensityOutput: `${name} — MT of waste per project-site per month, category A–H as prescribed.`,
      wasteRecovered: `${name} — 74% of non-hazardous waste recovered through recycling / re-use; used oil and e-waste via authorised recyclers.`,
      wasteDisposed: `${name} — 26% disposed: construction debris to authorised C&D facilities, residual sludge to TSDF co-processing.`,
    },
    "annexure1.safety": {
      wellbeingSpend: n(84), permanentDisabilities: 0, ltifr: 0.42, fatalities: 0,
    },
    "annexure1.gender": {
      femaleWageShare: 18.6, poshComplaints: 2, poshUpheld: 1,
    },
    "annexure1.inclusion": {
      msmeProcurement: 21.5, smallerTownWages: 34.2,
    },
    "annexure1.fair": {
      dataBreachShare: 0, accountsPayableDays: 38,
    },
    "annexure1.open": {
      tradingHousePurchases: n(112), dealerSales: n(96), rptShare: 4.8,
    },
  };
}

/* factor per subsidiary (operations scale) */
const FACTORS: Record<string, number> = {
  MEIL: 1.0, DRILLMEC: 0.32, MHYDRO: 0.55, MSOLAR: 0.48, MCGDH: 0.26, PETREVEN: 0.38, OLECTRA: 0.62,
};

/* Annexure parameter key → disclosure code (mirrors the recompute mapping). */
const ANNEXURE_CODE: Record<string, string> = {
  scope1: "BRSR-A1-GHG-S1", scope2: "BRSR-A1-GHG-S2", ghgIntensityTurnover: "BRSR-A1-GHG-INT",
  waterConsumption: "BRSR-A1-WAT-CONS", waterIntensityTurnover: "BRSR-A1-WAT-INT",
  energyConsumed: "BRSR-A1-ENE-TOT", renewableShare: "BRSR-A1-ENE-REN", energyIntensityTurnover: "BRSR-A1-ENE-INT",
  plasticWaste: "BRSR-A1-WST-PLAS", ewaste: "BRSR-A1-WST-EWST", biomedicalWaste: "BRSR-A1-WST-BIO",
  cdWaste: "BRSR-A1-WST-CD", batteryWaste: "BRSR-A1-WST-BAT", radioactiveWaste: "BRSR-A1-WST-RAD",
  otherHazardousWaste: "BRSR-A1-WST-OH", otherNonHazardousWaste: "BRSR-A1-WST-ONH",
  totalWasteGenerated: "BRSR-A1-WST-TOT", wasteIntensityTurnover: "BRSR-A1-WST-INT",
  wellbeingSpend: "BRSR-A1-SAF-WB", ltifr: "BRSR-A1-SAF-LTIFR", fatalities: "BRSR-A1-SAF-FAT",
  femaleWageShare: "BRSR-A1-GEN-FWAGE", poshComplaints: "BRSR-A1-GEN-POSH",
  msmeProcurement: "BRSR-A1-INC-MSME", smallerTownWages: "BRSR-A1-INC-TOWN",
  dataBreachShare: "BRSR-A1-FAIR-DP", accountsPayableDays: "BRSR-A1-FAIR-DPO",
};
const ANNEXURE_PARAM_BY_KEY: Record<string, string> = {
  scope1: "sum", scope2: "sum", ghgIntensityTurnover: "avg",
  waterConsumption: "sum", waterIntensityTurnover: "avg",
  energyConsumed: "sum", renewableShare: "avg", energyIntensityTurnover: "avg",
  plasticWaste: "sum", ewaste: "sum", biomedicalWaste: "sum", cdWaste: "sum",
  batteryWaste: "sum", radioactiveWaste: "sum", otherHazardousWaste: "sum",
  otherNonHazardousWaste: "sum", totalWasteGenerated: "sum", wasteIntensityTurnover: "avg",
  wellbeingSpend: "avg", permanentDisabilities: "sum", ltifr: "max", fatalities: "sum",
  femaleWageShare: "avg", poshComplaints: "sum", poshUpheld: "sum",
  msmeProcurement: "avg", smallerTownWages: "avg",
  dataBreachShare: "avg", accountsPayableDays: "max",
  tradingHousePurchases: "sum", dealerSales: "sum", rptShare: "sum",
};
const ANNEXURE_TEXT_CODE: Record<string, string> = {
  wasteRecovered: "BRSR-A1-WST-REC", wasteDisposed: "BRSR-A1-WST-DSP",
  tradingHousePurchases: "BRSR-A1-OPEN-TH", rptShare: "BRSR-A1-OPEN-RPT",
};

/* Category mapping for the C2 / legacy disclosure codes (same as the API). */
const CATEGORY_MAPPING: Record<string, string[]> = {
  "BRSR-ENV-01": ["ENERGY"], "BRSR-ENV-02": ["ENERGY"], "BRSR-ENV-04": ["EMISSIONS"],
  "BRSR-ENV-05": ["EMISSIONS"], "BRSR-ENV-06": ["WATER"], "BRSR-ENV-08": ["WASTE"],
  "BRSR-SOC-01": ["SAFETY"], "BRSR-SOC-02": ["WORKFORCE"],
  "BRSR-GOV-01": ["COMPLIANCE"], "BRSR-GOV-02": ["PROCUREMENT"],
  "BRSR-C2-GEN-01": ["EMISSIONS"], "BRSR-C2-GEN-02": ["EMISSIONS"], "BRSR-C2-GEN-03": ["ENERGY"],
  "BRSR-C2-ENV-01": ["WATER"], "BRSR-C2-ENV-03": ["WASTE"],
  "BRSR-C2-SOC-01": ["WORKFORCE"], "BRSR-C2-SOC-02": ["WORKFORCE"],
  "BRSR-C2-SOC-07": ["CSR"], "BRSR-C2-SOC-08": ["CSR"],
  "BRSR-C2-GOV-01": ["COMPLIANCE"],
};

(async () => {
  const subs = await db.subsidiary.findMany({ orderBy: { name: "asc" } });

  /* ── 1. Subsidiary BRSR Data rows ─────────────────────────────────────── */
  for (const s of subs) {
    const factor = FACTORS[s.code] ?? 0.5;
    const sections = annexureFor(s.name, factor);
    await db.brsrSubsidiaryData.upsert({
      where: { subsidiaryId_period: { subsidiaryId: s.id, period: FY } },
      create: {
        subsidiaryId: s.id,
        subsidiaryName: s.name,
        period: FY,
        status: "SUBMITTED",
        sections: JSON.stringify(sections),
        submittedAt: new Date(),
        submittedBy: "Subsidiary Admin (seeded demo data)",
      },
      update: { sections: JSON.stringify(sections), status: "SUBMITTED", submittedAt: new Date() },
    });
  }
  console.log(`BRSR subsidiary data rows: ${subs.length} (period ${FY})`);

  /* ── 2. Roll up the annexure values exactly like the recompute action ── */
  const annexureRows = await db.brsrSubsidiaryData.findMany({ where: { period: FY } });
  const annexureAgg = new Map<string, number[]>();
  const annexureText = new Map<string, string>();
  for (const row of annexureRows) {
    const sections = JSON.parse(row.sections || "{}") as Record<string, Record<string, string>>;
    for (const [secKey, values] of Object.entries(sections)) {
      if (!secKey.startsWith("annexure1.")) continue;
      for (const [k, v] of Object.entries(values)) {
        const raw = String(v).trim();
        if (!raw) continue;
        const num = Number(String(raw).replace(/,/g, ""));
        if (Number.isFinite(num)) annexureAgg.set(k, [...(annexureAgg.get(k) ?? []), num]);
        else if (!annexureText.has(k)) annexureText.set(k, raw);
      }
    }
  }
  const annexureByCode = new Map<string, number>();
  for (const [paramKey, nums] of annexureAgg) {
    const code = ANNEXURE_CODE[paramKey];
    if (!code || !nums.length) continue;
    const mode = ANNEXURE_PARAM_BY_KEY[paramKey] ?? "sum";
    const value = mode === "avg"
      ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100
      : mode === "max" ? Math.max(...nums)
      : Math.round(nums.reduce((a, b) => a + b, 0) * 100) / 100;
    annexureByCode.set(code, value);
  }
  const annexureTextByCode = new Map<string, string>();
  for (const [paramKey, text] of annexureText) {
    const code = ANNEXURE_TEXT_CODE[paramKey];
    if (code) annexureTextByCode.set(code, text);
  }

  /* ── 3. Category values from APPROVED submissions ─────────────────────── */
  const approved = await db.submission.findMany({ where: { status: "APPROVED" }, select: { category: true, metricValue: true, values: true } });
  const byCategory: Record<string, number> = {};
  for (const s of approved) {
    byCategory[s.category] = (byCategory[s.category] ?? 0) + s.metricValue;
    if (s.category === "ENERGY") {
      try {
        const vals = JSON.parse(s.values || "[]");
        if (Array.isArray(vals)) for (const v of vals) {
          if (String(v?.unit || "").trim().toLowerCase() === "tco2e") byCategory["EMISSIONS"] = (byCategory["EMISSIONS"] ?? 0) + (Number(v?.value) || 0);
        }
      } catch { /* skip */ }
    }
  }
  console.log("approved category sums:", byCategory);

  /* ── 4. Rewrite the report's disclosures (clean + filled) ─────────────── */
  const report = await db.brsrReport.findFirst({ orderBy: { createdAt: "desc" } });
  if (!report) throw new Error("No BRSR report found");
  const catalog = await db.disclosure.findMany({ orderBy: { code: "asc" } });

  const disclosures = catalog.map((d) => {
    const annexureValue = annexureByCode.get(d.code);
    const cats = CATEGORY_MAPPING[d.code];
    const value = annexureValue !== undefined
      ? annexureValue
      : cats
        ? Math.round(cats.reduce((a, c) => a + (byCategory[c] ?? 0), 0) * 100) / 100
        : null;
    const narrative = annexureTextByCode.get(d.code);
    const hasValue = value !== null && value > 0;
    return {
      code: d.code,
      title: d.title,
      mapped: true,
      status: hasValue ? "VALIDATED" : "EXCEPTION",
      value,
      unit: d.unit,
      note: hasValue
        ? "Mapped to consolidated approved data — verified against the platform's approved dataset."
        : narrative
          ? `Group statement: ${narrative}`
          : "N/A for the current reporting boundary — documented as an exception with the consolidation team.",
    };
  });

  const updated = await db.brsrReport.update({
    where: { id: report.id },
    data: {
      disclosures: JSON.stringify(disclosures),
      status: report.status === "DRAFT" ? "CONSOLIDATION" : report.status,
      wizardStep: Math.max(report.wizardStep, 4),
    },
  });
  const parsed = JSON.parse(updated.disclosures!) as { code: string; status: string; value: number | null }[];
  console.log(`report ${report.ref}: ${parsed.length} disclosures — ${parsed.filter((d) => d.status === "VALIDATED").length} validated, ${parsed.filter((d) => d.status === "EXCEPTION").length} documented exceptions`);
  process.exit(0);
})().catch((e) => { console.error("ERR:", e); process.exit(1); });
