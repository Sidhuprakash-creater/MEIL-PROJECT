/* BRSR WIZARD — Builder sections prefill (Step 6). Writes a complete report
   body into the latest BRSR report's `sections` JSON so the Builder step is
   demo-ready (compose/fine-tune is still possible live). */
import { db } from "../src/lib/db";

(async () => {
  const report = await db.brsrReport.findFirst({ orderBy: { createdAt: "desc" } });
  if (!report) throw new Error("No BRSR report found");

  const sections = [
    {
      id: "sec-general",
      title: "1 · General Disclosures & Reporting Boundary",
      content:
        "This report covers the financial year 2026-27 for Megha Engineering & Infrastructures Ltd (MEIL) and its subsidiary group, consolidated under SEBI BRSR Core v1.0. " +
        "The reporting boundary covers all 7 subsidiaries — MEIL Core, Drillmec S.p.A., MEIL Hydro Power, MEIL Solar Energy, Megha City Gas Distribution Holding, Petreven S.p.A. and Olectra Greentech — together with their business units, projects and sites registered on the platform. " +
        "All figures are consolidated from APPROVED source disclosures only: project-site data entered by contributor users (environment, EHS, HR, compliance, CSR, finance, procurement), approved by Project Admins, ratified by Business Unit Managers and verified through the two-step subsidiary verification desk. " +
        "No unapproved or in-review values have entered this consolidation.",
      sourceRefs: ["BRSR-WIZARD", "BRSR-A1"],
    },
    {
      id: "sec-env",
      title: "2 · Environmental Performance",
      content:
        "Energy: total approved energy consumption across the reporting period is 13,044.84 GJ, dominated by purchased grid electricity (11,470 GJ at the Polavaram irrigation package) with DG-set diesel backup contributing the direct-fuel share. " +
        "GHG footprint: the consolidated Scope 1 + 2 footprint is 2,585.11 tCO2e — 2,570.20 tCO2e is embedded in the approved energy disclosures (grid Scope 2 at the CEA v20 factor of 0.716 tCO2e/MWh and diesel Scope 1 at 2.68 kgCO2e/L), with Scope 3 business-travel disclosures adding the remainder. " +
        "Water: 24,579 kL withdrawn, with recycling/reuse reported per source; circularity is tracked through the platform's water module. " +
        "Waste: 9,374.22 MT generated — non-hazardous construction debris dominates; used-oil (hazardous) is segregated and routed to authorised TSDF recyclers.",
      sourceRefs: ["BRSR-A1-ENE-TOT", "BRSR-A1-GHG-S1", "BRSR-A1-GHG-S2", "BRSR-A1-WAT-CONS", "BRSR-A1-WST-TOT"],
    },
    {
      id: "sec-social",
      title: "3 · Social Performance — Workforce, Safety & Community",
      content:
        "Workforce: 6,276 training-hours were delivered across ESG & BRSR awareness, site-safety induction and technical upskilling programmes. " +
        "Health & Safety: 528 recorded safety data points — toolbox talks, PPE-compliance inspections and near-miss reports — with zero fatalities and an LTIFR of 0.42 reported through the subsidiary BRSR data forms. " +
        "Community: 72 CSR/community programmes executed, including pump-efficiency upgrades, solar-envelope expansion drives and community plantation drives. " +
        "Grievances: minor contained-on-site spills and community grievances are logged through the incidents module with per-month counts.",
      sourceRefs: ["BRSR-C2-SOC-01", "BRSR-C2-SOC-02", "BRSR-C2-SOC-07", "BRSR-C2-SOC-08", "BRSR-A1-SAF-LTIFR"],
    },
    {
      id: "sec-gov",
      title: "4 · Governance, Compliance & Responsible Business",
      content:
        "Compliance: 69 permits & regulatory consents are tracked in the platform — Consent to Operate, CGWA water-abstraction permits and hazardous-waste authorisations — with validity status maintained per permit. " +
        "Procurement: 564 ESG-screened vendors onboarded; local hiring spend share averages above 60%. " +
        "Finance: 140.40 Cr of environmental expenditure reported across environmental CapEx and sustainable-procurement spend. " +
        "Annexure I roll-up: the group figures are aggregated across the 7 subsidiary data forms — absolute quantities summed, rates and intensities averaged, and worst-case indicators (LTIFR, days payable) taken as the maximum, exactly as SEBI prescribes.",
      sourceRefs: ["BRSR-C2-GOV-01", "BRSR-GOV-02", "BRSR-A1-FAIR-DPO", "BRSR-A1-INC-MSME"],
    },
    {
      id: "sec-method",
      title: "5 · Methodology, Factors & Data Lineage",
      content:
        "Emission factors: grid electricity at CEA v20 (0.716 tCO2e/MWh, Scope 2), diesel at 2.68 kgCO2e/L (Scope 1), and mobile-combustion factors for business travel (Scope 3). " +
        "Data lineage: every consolidated value traces to a site-level level-record entered by a named contributor, with validation status PASSED, evidence files attached, and a complete audit trail (submission history, reviewer decisions, verification stamps). " +
        "Aggregation rules: platform category ledgers feed the C2 disclosures; the Annexure I attributes are rolled up from the subsidiary BRSR data forms (sum for quantities, average for rates/intensities, max for worst-case). " +
        "Energy-disclosure GHG: the estimated tCO2e embedded in each approved energy row is folded into the emissions footprint — never double-counted with the L3 GHG disclosures.",
      sourceRefs: ["BRSR-WIZARD", "BRSR-A1-GHG-INT", "BRSR-A1-ENE-INT"],
    },
    {
      id: "sec-except",
      title: "6 · Exceptions & Assumptions",
      content:
        "Radioactive waste: nil — no radioactive streams arise within the reporting boundary. " +
        "Data breaches: no reportable cyber-security data-loss events in the period (0% of revenue impact). " +
        "Intensity-per-output disclosures (GHG, water, energy, waste per unit of output) are maintained as narrative statements in the annexure because output units differ per subsidiary (ML of water serviced, MWh generated, MT handled, rigs manufactured). " +
        "March 2027 (the final open period) remains in flight — all prior months are fully approved and verified; the live period's data will be appended through the same approval chain before finalization.",
      sourceRefs: ["BRSR-A1-WST-RAD", "BRSR-A1-FAIR-DP"],
    },
  ];

  const updated = await db.brsrReport.update({
    where: { id: report.id },
    data: { sections: JSON.stringify(sections), wizardStep: Math.max(report.wizardStep, 6) },
  });
  console.log(`report ${report.ref}: ${sections.length} sections written (previously ${JSON.parse(report.sections || "[]").length})`);
  process.exit(0);
})().catch((e) => { console.error("ERR:", e); process.exit(1); });
