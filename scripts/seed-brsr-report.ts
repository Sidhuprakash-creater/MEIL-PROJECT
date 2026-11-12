/* Demo seed: pre-fill the Group BRSR report — disclosures with values
   aggregated from the 7 subsidiaries + narrative sections. Status = SIGNOFF
   (wizard step 7) so sign-off → finalize → PDF export is all that remains.
   Run: npx tsx scripts/seed-brsr-report.ts */
import { db } from "../src/lib/db";

const FY = "FY 2025-26";

/* ── 1. Disclosure master (BRSR Core style codes) ── */
const MASTER = [
  { code: "BRSR-C2-GEN-01", section: "GENERAL", title: "Scope 1 GHG emissions (tCO2e)", unit: "tCO2e" },
  { code: "BRSR-C2-GEN-02", section: "GENERAL", title: "Scope 2 GHG emissions (tCO2e)", unit: "tCO2e" },
  { code: "BRSR-C2-GEN-03", section: "GENERAL", title: "Total energy consumption (GJ)", unit: "GJ" },
  { code: "BRSR-C2-GEN-04", section: "GENERAL", title: "Renewable energy share (%)", unit: "%" },
  { code: "BRSR-C2-ENV-01", section: "ENVIRONMENT", title: "Water withdrawal (KL)", unit: "KL" },
  { code: "BRSR-C2-ENV-02", section: "ENVIRONMENT", title: "Water recycled / reused (%)", unit: "%" },
  { code: "BRSR-C2-ENV-03", section: "ENVIRONMENT", title: "Total waste generated (tonnes)", unit: "t" },
  { code: "BRSR-C2-ENV-04", section: "ENVIRONMENT", title: "Waste recycled (%)", unit: "%" },
  { code: "BRSR-C2-ENV-05", section: "ENVIRONMENT", title: "GHG intensity per ₹ Cr turnover", unit: "tCO2e/₹Cr" },
  { code: "BRSR-C2-ENV-06", section: "ENVIRONMENT", title: "Environmental non-compliances (count)", unit: "count" },
  { code: "BRSR-C2-SOC-01", section: "SOCIAL", title: "Total employees (permanent)", unit: "count" },
  { code: "BRSR-C2-SOC-02", section: "SOCIAL", title: "Total workers (permanent)", unit: "count" },
  { code: "BRSR-C2-SOC-03", section: "SOCIAL", title: "Employee turnover rate (%)", unit: "%" },
  { code: "BRSR-C2-SOC-04", section: "SOCIAL", title: "Average training hours per employee", unit: "hrs" },
  { code: "BRSR-C2-SOC-05", section: "SOCIAL", title: "Fatalities (FY)", unit: "count" },
  { code: "BRSR-C2-SOC-06", section: "SOCIAL", title: "Lost-time injuries (FY)", unit: "count" },
  { code: "BRSR-C2-SOC-07", section: "SOCIAL", title: "CSR obligation (₹ Cr)", unit: "₹ Cr" },
  { code: "BRSR-C2-SOC-08", section: "SOCIAL", title: "CSR spend (₹ Cr)", unit: "₹ Cr" },
  { code: "BRSR-C2-GOV-01", section: "GOVERNANCE", title: "Policies mapped to the 9 NGRBC principles", unit: "count" },
  { code: "BRSR-C2-GOV-02", section: "GOVERNANCE", title: "Board / ESG committee meetings held (FY)", unit: "count" },
  { code: "BRSR-C2-GOV-03", section: "GOVERNANCE", title: "Anti-corruption training coverage (%)", unit: "%" },
  { code: "BRSR-C2-GOV-04", section: "GOVERNANCE", title: "Confirmed conflict-of-interest cases", unit: "count" },
  { code: "BRSR-C2-GOV-05", section: "GOVERNANCE", title: "Consumer complaints resolved within SLA (%)", unit: "%" },
  { code: "BRSR-C2-GOV-06", section: "GOVERNANCE", title: "Data privacy / cybersecurity reportable incidents", unit: "count" },
  /* ── Annexure I (SEBI BRSR Core format) — the nine attributes ───────────── */
  { code: "BRSR-A1-GHG-S1", section: "ANNEXURE1", title: "Annexure I · 1 · Total Scope 1 emissions", unit: "tCO2e" },
  { code: "BRSR-A1-GHG-S2", section: "ANNEXURE1", title: "Annexure I · 1 · Total Scope 2 emissions", unit: "tCO2e" },
  { code: "BRSR-A1-GHG-INT", section: "ANNEXURE1", title: "Annexure I · 1 · GHG emission intensity (Scope 1+2) per ₹ Cr", unit: "tCO2e/₹Cr" },
  { code: "BRSR-A1-WAT-CONS", section: "ANNEXURE1", title: "Annexure I · 2 · Total water consumption", unit: "KL" },
  { code: "BRSR-A1-WAT-INT", section: "ANNEXURE1", title: "Annexure I · 2 · Water consumption intensity per ₹ Cr", unit: "KL/₹Cr" },
  { code: "BRSR-A1-ENE-TOT", section: "ANNEXURE1", title: "Annexure I · 3 · Total energy consumed", unit: "GJ" },
  { code: "BRSR-A1-ENE-REN", section: "ANNEXURE1", title: "Annexure I · 3 · Energy consumed from renewable sources", unit: "%" },
  { code: "BRSR-A1-ENE-INT", section: "ANNEXURE1", title: "Annexure I · 3 · Energy intensity per ₹ Cr", unit: "GJ/₹Cr" },
  { code: "BRSR-A1-WST-PLAS", section: "ANNEXURE1", title: "Annexure I · 4 · Plastic waste (A)", unit: "t" },
  { code: "BRSR-A1-WST-EWST", section: "ANNEXURE1", title: "Annexure I · 4 · E-waste (B)", unit: "t" },
  { code: "BRSR-A1-WST-BIO", section: "ANNEXURE1", title: "Annexure I · 4 · Bio-medical waste (C)", unit: "t" },
  { code: "BRSR-A1-WST-CD", section: "ANNEXURE1", title: "Annexure I · 4 · Construction & demolition waste (D)", unit: "t" },
  { code: "BRSR-A1-WST-BAT", section: "ANNEXURE1", title: "Annexure I · 4 · Battery waste (E)", unit: "t" },
  { code: "BRSR-A1-WST-RAD", section: "ANNEXURE1", title: "Annexure I · 4 · Radioactive waste (F)", unit: "t" },
  { code: "BRSR-A1-WST-OH", section: "ANNEXURE1", title: "Annexure I · 4 · Other hazardous waste (G)", unit: "t" },
  { code: "BRSR-A1-WST-ONH", section: "ANNEXURE1", title: "Annexure I · 4 · Other non-hazardous waste (H)", unit: "t" },
  { code: "BRSR-A1-WST-TOT", section: "ANNEXURE1", title: "Annexure I · 4 · Total waste generated (A+B+C+D+E+F+G+H)", unit: "t" },
  { code: "BRSR-A1-WST-INT", section: "ANNEXURE1", title: "Annexure I · 4 · Waste intensity per ₹ Cr", unit: "t/₹Cr" },
  { code: "BRSR-A1-WST-REC", section: "ANNEXURE1", title: "Annexure I · 4 · Waste recovered through recycling / re-use", unit: "t" },
  { code: "BRSR-A1-WST-DSP", section: "ANNEXURE1", title: "Annexure I · 4 · Waste disposed by disposal method", unit: "t" },
  { code: "BRSR-A1-SAF-WB", section: "ANNEXURE1", title: "Annexure I · 5 · Employee well-being spend as % of revenue", unit: "%" },
  { code: "BRSR-A1-SAF-LTIFR", section: "ANNEXURE1", title: "Annexure I · 5 · Lost Time Injury Frequency Rate", unit: "per mn person-hours" },
  { code: "BRSR-A1-SAF-FAT", section: "ANNEXURE1", title: "Annexure I · 5 · Fatalities", unit: "count" },
  { code: "BRSR-A1-GEN-FWAGE", section: "ANNEXURE1", title: "Annexure I · 6 · Gross wages paid to females as % of wages", unit: "%" },
  { code: "BRSR-A1-GEN-POSH", section: "ANNEXURE1", title: "Annexure I · 6 · Complaints on POSH reported", unit: "count" },
  { code: "BRSR-A1-INC-MSME", section: "ANNEXURE1", title: "Annexure I · 7 · Input material sourced from MSMEs / within India", unit: "%" },
  { code: "BRSR-A1-INC-TOWN", section: "ANNEXURE1", title: "Annexure I · 7 · Wages paid in smaller towns as % of total wage cost", unit: "%" },
  { code: "BRSR-A1-FAIR-DP", section: "ANNEXURE1", title: "Annexure I · 8 · Customer data loss / breach as % of cyber security events", unit: "%" },
  { code: "BRSR-A1-FAIR-DPO", section: "ANNEXURE1", title: "Annexure I · 8 · Number of days of accounts payable", unit: "days" },
  { code: "BRSR-A1-OPEN-TH", section: "ANNEXURE1", title: "Annexure I · 9 · Purchases from trading houses as % of total purchases", unit: "%" },
  { code: "BRSR-A1-OPEN-RPT", section: "ANNEXURE1", title: "Annexure I · 9 · RPT share in purchases / sales / loans & advances / investments", unit: "%" },
];

/* Aggregated group values (consistent with the subsidiary demo seeds). */
const VALUES: Record<string, number> = {
  "BRSR-C2-GEN-01": 160920, "BRSR-C2-GEN-02": 155100, "BRSR-C2-GEN-03": 2787000,
  "BRSR-C2-GEN-04": 13.1, "BRSR-C2-ENV-01": 2406600, "BRSR-C2-ENV-02": 18.4,
  "BRSR-C2-ENV-03": 27530, "BRSR-C2-ENV-04": 61.2, "BRSR-C2-ENV-05": 9.8,
  "BRSR-C2-ENV-06": 0, "BRSR-C2-SOC-01": 19420, "BRSR-C2-SOC-02": 8630,
  "BRSR-C2-SOC-03": 8.6, "BRSR-C2-SOC-04": 12, "BRSR-C2-SOC-05": 0,
  "BRSR-C2-SOC-06": 14, "BRSR-C2-SOC-07": 41.3, "BRSR-C2-SOC-08": 40.1,
  "BRSR-C2-GOV-01": 12, "BRSR-C2-GOV-02": 4, "BRSR-C2-GOV-03": 96.5,
  "BRSR-C2-GOV-04": 0, "BRSR-C2-GOV-05": 96, "BRSR-C2-GOV-06": 0,
};

/* ── Annexure I — aggregated from the subsidiaries' BRSR Data forms ─────────
   These are the group roll-ups of the SEBI Annexure I parameters. The live
   values are recomputed by the consolidation run; the figures below keep the
   seeded report consistent with the subsidiary data forms. */
const ANNEXURE_VALUES: Record<string, number> = {
  "BRSR-A1-GHG-S1": 160920, "BRSR-A1-GHG-S2": 155100, "BRSR-A1-GHG-INT": 9.8,
  "BRSR-A1-WAT-CONS": 2069000, "BRSR-A1-WAT-INT": 27.4,
  "BRSR-A1-ENE-TOT": 2787000, "BRSR-A1-ENE-REN": 13.1, "BRSR-A1-ENE-INT": 31.1,
  "BRSR-A1-WST-PLAS": 4982, "BRSR-A1-WST-EWST": 1661, "BRSR-A1-WST-BIO": 552,
  "BRSR-A1-WST-CD": 11287, "BRSR-A1-WST-BAT": 1101, "BRSR-A1-WST-RAD": 0,
  "BRSR-A1-WST-OH": 1927, "BRSR-A1-WST-ONH": 6019, "BRSR-A1-WST-TOT": 27530,
  "BRSR-A1-WST-INT": 0.36, "BRSR-A1-WST-REC": 17069, "BRSR-A1-WST-DSP": 3580,
  "BRSR-A1-SAF-WB": 0.42, "BRSR-A1-SAF-LTIFR": 0.29, "BRSR-A1-SAF-FAT": 0,
  "BRSR-A1-GEN-FWAGE": 9.6, "BRSR-A1-GEN-POSH": 11,
  "BRSR-A1-INC-MSME": 62.4, "BRSR-A1-INC-TOWN": 64.8,
  "BRSR-A1-FAIR-DP": 0, "BRSR-A1-FAIR-DPO": 45,
  "BRSR-A1-OPEN-TH": 6.4, "BRSR-A1-OPEN-RPT": 1.2,
};

const NOTES: Record<string, string> = {
  "BRSR-C2-GEN-01": "Sum of 7 subsidiaries; diesel, coal & process fuels — IPCC 2006 factors.",
  "BRSR-C2-GEN-02": "CEA grid factor v20 (0.716 tCO2/MWh) applied to purchased electricity.",
  "BRSR-C2-ENV-01": "Withdrawal across all sites; hydro run-of-river excluded from consumption.",
  "BRSR-C2-SOC-05": "Zero-fatality year across all subsidiaries and sites.",
  "BRSR-C2-SOC-07": "India-registered entities under Sec 135; Italian entities N.A.",
  "BRSR-C2-GOV-01": "Board-approved policies mapped to NGRBC P1–P9 in the policy register.",
};

/* Every disclosure carries a note so the review transition never blocks on
   "mapped but unvalidated without note" after a consolidation recompute. */
const DEFAULT_NOTE = "Consolidated from subsidiary BRSR data forms and approved platform disclosures — methodology in Annexure 1.";

const SECTIONS = [
  { id: "SEC-01", title: "Executive Summary", content: "MEIL Group's FY 2025-26 BRSR consolidates operations across 7 subsidiaries spanning engineering & infrastructure, power generation (hydro & solar), city gas distribution, e-mobility and international drilling services. The group recorded 2.79 million GJ of energy consumption, a 13.1% renewable share, zero fatalities, and 100% CSR obligation utilisation across India-registered entities. All quantitative disclosures were captured through the platform's subsidiary → BU → project disclosure workflow with BU Manager and Subsidiary Manager sign-offs." },
  { id: "SEC-02", title: "Reporting Boundary & Methodology", content: "Operational control approach. Boundary includes all 7 active subsidiaries: Megha Engineering & Infrastructures Ltd (MEIL Core), Drillmec S.p.A., MEIL Hydro Power Limited, MEIL Solar Energy Limited, Megha City Gas Distribution Holding, Petreven S.p.A. and Olectra Greentech Limited. GHG accounting follows the GHG Protocol Corporate Standard with CEA v20 grid emission factor (0.716 tCO2/MWh) and IPCC 2006 fuel factors. JV entities are excluded (equity-accounted)." },
  { id: "SEC-03", title: "Section A — General Disclosures", content: "Entity profiles (CIN, incorporation, registered offices, listing status, BRSR contacts), products & services with turnover contribution, geographic operations (India and international), workforce composition with gender-wise splits, group structure and CSR applicability were captured from every subsidiary through the structured BRSR Data form. Minor notice items: none material in FY 2025-26." },
  { id: "SEC-04", title: "Section B — Management & Process Disclosures", content: "12 board-approved policies mapped to NGRBC Principles 1–9, communicated through induction and annual training and extended to value-chain partners via the vendor code and contract clauses. Certifications: ISO 9001, ISO 14001, ISO 45001 across operating sites. Board-level CSR & Sustainability Committee oversees ESG performance quarterly; the ESG Cell executes the programme." },
  { id: "SEC-05", title: "Section C — Principle-wise Performance (P1–P9)", content: "Principle 1: 96.5% anti-corruption training coverage; zero confirmed conflict-of-interest cases. Principle 2: quality & recall processes verified; recycled inputs tracked. Principle 3: 12 average training hours; zero fatalities; 14 LTI with corrective actions closed. Principle 5: no confirmed human-rights incidents. Principle 6: 1,60,920 tCO2e Scope 1 and 1,55,100 tCO2e Scope 2; 61.2% waste recycled; zero environmental non-compliances. Principle 8: ₹40.1 Cr CSR spend across education, health, water and skilling. Principle 9: 96% consumer complaint resolution within SLA; zero reportable privacy/cybersecurity incidents." },
  { id: "SEC-06", title: "Section C — Annexure I (Format of BRSR Core)", content: "The nine attributes of the SEBI BRSR Core Annexure I — GHG footprint, water footprint, energy footprint, embracing circularity (waste), employee well-being and safety, gender diversity, inclusive development, fairness in engaging with customers and suppliers, and open-ness of business — are reported in full in the Annexure I table of this report. Each parameter carries its measurement unit, the data & assurance approach prescribed by SEBI, and the cross-reference back to the BRSR Core principle and question. Consolidated values are aggregated from the seven subsidiaries' BRSR Data submissions and reconciled against the platform disclosure ledger." },
  { id: "SEC-07", title: "Annexure — Data Methodology & Emission Factors", content: "Emission factors: grid electricity CEA v20 (0.716 tCO2/MWh, India), diesel combustion IPCC 2006 (2.68 kgCO2/L), coal combustion IPCC 2006. Intensities computed per ₹ Cr of audited turnover. Each subsidiary submitted its methodology register through the BRSR Data form; figures were cross-checked against disclosure-module evidence by BU and Subsidiary reviewers." },
  { id: "SEC-08", title: "Annexure — Exclusions, Estimates & Restatements", content: "Scope 3 (business travel & upstream fuel) is a screening-level estimate. JV entities excluded on the equity method. No restatements against FY 2024-25. Evidence IDs for every indicator are referenced in the platform evidence module, verified by BU Manager and Subsidiary Manager." },
  { id: "SEC-09", title: "Approval Statement", content: "This report consolidates subsidiary BRSR data and platform disclosures reviewed through the Project Admin → Business Unit → Subsidiary Manager → Group Admin workflow. Sign-offs recorded below attest to data quality and management review." },
];

async function main() {
  /* 1. Disclosure master */
  for (const d of MASTER) {
    await db.disclosure.upsert({ where: { code: d.code }, create: { ...d, required: true, description: "" }, update: {} });
  }
  console.log(`✓ Disclosure master: ${MASTER.length} rows`);

  /* 2. Scope = all 7 subsidiaries */
  const subs = await db.subsidiary.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true } });
  const existing = await db.brsrReport.findFirst({ where: { financialYear: FY }, orderBy: { createdAt: "desc" } });

  const disclosures = MASTER.map((d) => ({
    code: d.code, title: d.title, mapped: true, status: "VALIDATED",
    value: VALUES[d.code] ?? ANNEXURE_VALUES[d.code] ?? 0, unit: d.unit, note: NOTES[d.code] ?? DEFAULT_NOTE,
  }));

  const base = {
    title: "MEIL Group — Business Responsibility and Sustainability Report",
    financialYear: FY,
    framework: "SEBI BRSR Core v1.0",
    periodStart: new Date("2025-04-01"),
    periodEnd: new Date("2026-03-31"),
    description: "Consolidated group BRSR compiled from subsidiary BRSR data forms and platform disclosures.",
    status: "SIGNOFF",
    wizardStep: 7,
    scope: JSON.stringify({ subsidiaryIds: subs.map((s) => s.id), businessUnitIds: [], projectIds: [] }),
    sections: JSON.stringify(SECTIONS.map((s) => ({ ...s, sourceRefs: [] }))),
    disclosures: JSON.stringify(disclosures),
    signoffs: JSON.stringify([]),
  };

  let report;
  if (existing) {
    report = await db.brsrReport.update({ where: { id: existing.id }, data: base });
  } else {
    report = await db.brsrReport.create({
      data: { ref: `BRSR-${FY.replace(/\D/g, "").slice(0, 4)}-${Date.now().toString(36).toUpperCase().slice(-5)}`, ...base },
    });
  }
  console.log(`✓ BRSR report ${report.ref} — status ${report.status} (wizard step ${report.wizardStep})`);
  console.log(`  ${disclosures.length} disclosures filled · ${SECTIONS.length} sections · scope ${subs.length} subsidiaries`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
