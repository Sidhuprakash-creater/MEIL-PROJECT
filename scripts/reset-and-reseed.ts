/* Reset & reseed for live demo:
   1. Deletes ALL submissions (+ consolidated dossiers), reporting packages,
      BRSR subsidiary data forms and the group BRSR report.
   2. Re-seeds one approved submission per project for EVERY project EXCEPT
      the 2 irrigation projects of MEIL Core's "Irrigation & Water Engineering
      Networks" BU — those are left empty for the live data-entry demo.
   Run: npx tsx scripts/reset-and-reseed.ts */
import { db } from "../src/lib/db";

const PERIOD = "FY 2025-26";
const DUE = new Date("2026-03-31");
const IRRIGATION_BU = "Irrigation & Water Engineering Networks";
const MEIL_CORE = "Megha Engineering & Infrastructures Ltd (MEIL Core)";

/* Metric sets cycled per project so every project carries believable data. */
const METRIC_SETS = [
  [
    { category: "ENERGY", module: "ENERGY", metricName: "Grid electricity consumption", value: 482000, unit: "kWh", title: "Grid electricity — site operations" },
    { category: "WATER", module: "WATER", metricName: "Water withdrawal", value: 248000, unit: "KL", title: "Water withdrawal — site" },
    { category: "WORKFORCE", module: "HR", metricName: "Permanent employees on roll", value: 1240, unit: "count", title: "Workforce register — site" },
  ],
  [
    { category: "EMISSIONS", module: "EMISSIONS", metricName: "Scope 1 GHG emissions", value: 14820, unit: "tCO2e", title: "Scope 1 — site combustion & fleet" },
    { category: "WASTE", module: "WASTE", metricName: "Non-hazardous waste generated", value: 2240, unit: "tonnes", title: "Waste — site operations" },
    { category: "CSR", module: "CSR", metricName: "CSR spend", value: 3.2, unit: "₹ Cr", title: "CSR — community programmes" },
  ],
  [
    { category: "SAFETY", module: "EHS", metricName: "Safe man-hours worked", value: 986000, unit: "man-hours", title: "Safety — man-hours cumulative" },
    { category: "FINANCE", module: "FINANCE", metricName: "ESG capital expenditure", value: 28.4, unit: "₹ Cr", title: "ESG capex — site" },
    { category: "PROCUREMENT", module: "PROCUREMENT", metricName: "Local procurement share", value: 62, unit: "%", title: "Local supplier spend share" },
  ],
  [
    { category: "ENVIRONMENT", module: "ENVIRONMENT", metricName: "Green cover developed", value: 3200, unit: "saplings", title: "Afforestation — site" },
    { category: "COMPLIANCE", module: "COMPLIANCE", metricName: "Statutory consents valid", value: 12, unit: "count", title: "Consents — validity register" },
    { category: "WORKFORCE", module: "HR", metricName: "Average training hours per employee", value: 11, unit: "hrs", title: "Training — site workforce" },
  ],
];

async function main() {
  /* 1. RESET — everything that carries data values. */
  const oldSubs = await db.submission.count();
  await db.submission.deleteMany({});
  const oldPkgs = await db.reportingPackage.count();
  await db.reportingPackage.deleteMany({});
  const oldBrsr = await db.brsrSubsidiaryData.count();
  await db.brsrSubsidiaryData.deleteMany({});
  const oldReports = await db.brsrReport.count();
  await db.brsrReport.deleteMany({});
  console.log(`RESET ✓ — ${oldSubs} submissions, ${oldPkgs} packages, ${oldBrsr} BRSR forms, ${oldReports} BRSR reports deleted.`);

  /* 2. RESEED — all projects except the 2 live-demo irrigation ones. */
  const subs = await db.subsidiary.findMany({ select: { id: true, name: true } });
  const bus = await db.businessUnit.findMany({ select: { id: true, name: true, subsidiaryId: true } });
  const buById = new Map(bus.map((b) => [b.id, b]));
  const subById = new Map(subs.map((s) => [s.id, s]));
  const projects = await db.project.findMany({ select: { id: true, name: true, businessUnitId: true } });

  const excluded = projects.filter((p) => {
    const bu = p.businessUnitId ? buById.get(p.businessUnitId) : undefined;
    const sub = bu?.subsidiaryId ? subById.get(bu.subsidiaryId) : undefined;
    return bu?.name === IRRIGATION_BU && sub?.name === MEIL_CORE;
  });
  const included = projects.filter((p) => !excluded.includes(p));
  console.log(`Projects: ${projects.length} total → ${excluded.length} LEFT FOR LIVE ENTRY, ${included.length} seeded.`);
  excluded.forEach((p) => console.log(`  ◌ LIVE: ${p.name}`));

  const contributors = await db.user.findMany({
    where: { role: { in: ["ENV_DATA_USER", "HR_USER", "CSR_USER", "EHS_USER", "FIN_RESOURCE_USER", "PROCUREMENT_USER", "COMPLIANCE_USER"] } },
    select: { id: true, name: true, role: true },
  });
  const ROLE_OF_MODULE: Record<string, string> = {
    ENERGY: "ENV_DATA_USER", EMISSIONS: "ENV_DATA_USER", WATER: "ENV_DATA_USER",
    WASTE: "ENV_DATA_USER", ENVIRONMENT: "ENV_DATA_USER", SAFETY: "EHS_USER",
    WORKFORCE: "HR_USER", FINANCE: "FIN_RESOURCE_USER", CSR: "CSR_USER",
    PROCUREMENT: "PROCUREMENT_USER", COMPLIANCE: "COMPLIANCE_USER",
  };

  const tag = Date.now().toString(36).toUpperCase().slice(-4);
  let n = 0;
  for (let i = 0; i < included.length; i++) {
    const project = included[i];
    const bu = project.businessUnitId ? buById.get(project.businessUnitId) : undefined;
    const set = METRIC_SETS[i % METRIC_SETS.length];
    for (const m of set) {
      const role = ROLE_OF_MODULE[m.category];
      const user = contributors.find((c) => c.role === role) ?? contributors[0];
      const ref = `SUB-${tag}-${project.id.slice(-4).toUpperCase()}-${++n}`;
      await db.submission.create({
        data: {
          ref, title: m.title, category: m.category, module: m.module,
          metricName: m.metricName, metricValue: m.value, metricUnit: m.unit,
          status: "APPROVED", period: PERIOD, fiscalQuarter: "Q4", dueDate: DUE,
          submittedAt: new Date(Date.now() - 86400000),
          reviewedAt: new Date(),
          projectId: project.id, businessUnitId: project.businessUnitId, subsidiaryId: bu?.subsidiaryId ?? null,
          submittedById: user.id,
          values: JSON.stringify([{ label: m.metricName, value: m.value, unit: m.unit }]),
          evidenceCount: 0, recordIds: "[]",
          completionPct: 100, validationPassed: 1, validationErrors: 0,
          history: JSON.stringify([
            { action: "SUBMITTED", actor: user.name, at: new Date(Date.now() - 86400000).toISOString(), note: "Submitted via data collection form." },
            { action: "APPROVED", actor: "Project Admin", at: new Date().toISOString(), note: "Approved by Project Admin with complete data verification." },
          ]),
        },
      });
    }
    console.log(`  ✓ ${project.name} — ${set.length} submissions (APPROVED)`);
  }
  console.log(`\nTotal seeded: ${n} submissions across ${included.length} projects.`);
  console.log(`LIVE DEMO: ${excluded.map((p) => p.name).join(" + ")} → contributor bharo → PA approve → consolidated dossier → BU/SM approve → Recompute.`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
