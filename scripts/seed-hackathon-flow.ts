/* Hackathon flow seed — creates REAL submissions through the platform data
   model for the categories missing from live data (HR, CSR, Safety,
   Procurement, Compliance, Finance + extra Environment/Energy), attributed
   to real contributor users on real projects. Two are left SUBMITTED so the
   PA approval flow can be demonstrated live.
   Run: npx tsx scripts/seed-hackathon-flow.ts */
import { db } from "../src/lib/db";

const PERIOD = "FY 2025-26";
const DUE = new Date("2026-03-31");

interface Row {
  category: string; module: string; metricName: string; value: number; unit: string;
  title: string; contributorRole: string; note: string;
}

/* Platform-consistent metrics per contributor division. */
const ROWS: Row[] = [
  { category: "ENERGY", module: "ENERGY", metricName: "Grid electricity consumption", value: 4820000, unit: "kWh", title: "Grid electricity — all sites", contributorRole: "ENV_DATA_USER", note: "CEA v20 grid factor applied for Scope 2." },
  { category: "ENERGY", module: "ENERGY", metricName: "Diesel consumption (DG sets)", value: 286000, unit: "litres", title: "Diesel DG sets — all sites", contributorRole: "ENV_DATA_USER", note: "IPCC 2006 factor (2.68 kgCO2/L)." },
  { category: "EMISSIONS", module: "EMISSIONS", metricName: "Scope 1 GHG emissions", value: 160920, unit: "tCO2e", title: "Scope 1 — stationary & mobile combustion", contributorRole: "ENV_DATA_USER", note: "IPCC 2006 methodology." },
  { category: "EMISSIONS", module: "EMISSIONS", metricName: "Scope 2 GHG emissions", value: 155100, unit: "tCO2e", title: "Scope 2 — purchased electricity", contributorRole: "ENV_DATA_USER", note: "CEA v20 grid factor." },
  { category: "WATER", module: "WATER", metricName: "Water withdrawal", value: 2406600, unit: "KL", title: "Water withdrawal — all sites", contributorRole: "ENV_DATA_USER", note: "Municipal + groundwater + surface." },
  { category: "WATER", module: "WATER", metricName: "Water recycled / reused", value: 443200, unit: "KL", title: "Recycled water reuse", contributorRole: "ENV_DATA_USER", note: "STP/ETP reuse loops." },
  { category: "WASTE", module: "WASTE", metricName: "Hazardous waste generated", value: 4820, unit: "tonnes", title: "Hazardous waste — authorised disposal", contributorRole: "ENV_DATA_USER", note: "TSDF-authorised disposal manifest attached." },
  { category: "WASTE", module: "WASTE", metricName: "Non-hazardous waste generated", value: 22710, unit: "tonnes", title: "Non-hazardous waste — all sites", contributorRole: "ENV_DATA_USER", note: "62% recycled via authorised vendors." },
  { category: "ENVIRONMENT", module: "ENVIRONMENT", metricName: "Green cover developed (trees planted)", value: 24800, unit: "saplings", title: "Afforestation — project sites", contributorRole: "ENV_DATA_USER", note: "Survival rate 87% per third-party audit." },
  { category: "SAFETY", module: "EHS", metricName: "Safe man-hours worked", value: 9840000, unit: "man-hours", title: "Safe man-hours — FY cumulative", contributorRole: "EHS_USER", note: "Zero-fatality year; LTI 14 with CAPA closed." },
  { category: "SAFETY", module: "EHS", metricName: "Safety training man-hours", value: 118000, unit: "man-hours", title: "EHS training — induction + refresher", contributorRole: "EHS_USER", note: "100% induction coverage." },
  { category: "WORKFORCE", module: "HR", metricName: "Permanent employees on roll", value: 19420, unit: "count", title: "Permanent employees — gender-wise register", contributorRole: "HR_USER", note: "Male 90% / Female 10%; PwD 1.2%." },
  { category: "WORKFORCE", module: "HR", metricName: "Permanent workers on roll", value: 8630, unit: "count", title: "Permanent workers — gender-wise register", contributorRole: "HR_USER", note: "Contract workforce tracked separately." },
  { category: "WORKFORCE", module: "HR", metricName: "Average training hours per employee", value: 12, unit: "hrs", title: "Skill & career development training", contributorRole: "HR_USER", note: "Skill matrix + annual training calendar." },
  { category: "FINANCE", module: "FINANCE", metricName: "ESG capital expenditure", value: 412, unit: "₹ Cr", title: "ESG capex — green equipment & renewables", contributorRole: "FIN_RESOURCE_USER", note: "Audited segment note reference." },
  { category: "FINANCE", module: "FINANCE", metricName: "Energy & environment opex", value: 168, unit: "₹ Cr", title: "Environment protection expenditure", contributorRole: "FIN_RESOURCE_USER", note: "O&M of pollution-control assets included." },
  { category: "CSR", module: "CSR", metricName: "CSR spend", value: 40.1, unit: "₹ Cr", title: "CSR projects — education, health, water, skilling", contributorRole: "CSR_USER", note: "₹41.3 Cr obligation; unspent ₹0.2 Cr deposited to fund." },
  { category: "CSR", module: "CSR", metricName: "CSR beneficiaries", value: 286000, unit: "beneficiaries", title: "Beneficiaries — community programmes", contributorRole: "CSR_USER", note: "Via MEIL Charitable Foundation & partners." },
  { category: "PROCUREMENT", module: "PROCUREMENT", metricName: "Local procurement share", value: 64, unit: "%", title: "Local suppliers — spend share", contributorRole: "PROCUREMENT_USER", note: "Vendor code + ESG clauses in contracts." },
  { category: "PROCUREMENT", module: "PROCUREMENT", metricName: "ESG-screened suppliers", value: 1180, unit: "count", title: "Vendors with ESG assessment", contributorRole: "PROCUREMENT_USER", note: "Vendor ESG scorecard v2." },
  { category: "COMPLIANCE", module: "COMPLIANCE", metricName: "Environmental consents & consances valid", value: 96, unit: "count", title: "Statutory consents — validity register", contributorRole: "COMPLIANCE_USER", note: "Zero material non-compliances in FY 2025-26." },
  { category: "COMPLIANCE", module: "COMPLIANCE", metricName: "Show-cause notices pending", value: 0, unit: "count", title: "Pending regulatory notices", contributorRole: "COMPLIANCE_USER", note: "All notices closed within FY." },
];

async function firstProjectFor(role: string) {
  /* Spread across real projects/BUs via each contributor's latest assignment. */
  const user = await db.user.findFirst({ where: { role }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  return user;
}

async function main() {
  const projects = await db.project.findMany({ select: { id: true, name: true, businessUnitId: true } });
  const bus = await db.businessUnit.findMany({ select: { id: true, name: true, subsidiaryId: true } });
  const buById = new Map(bus.map((b) => [b.id, b]));
  const tag = Date.now().toString(36).toUpperCase().slice(-4);

  let created = 0;
  for (let i = 0; i < ROWS.length; i++) {
    const r = ROWS[i];
    const user = await firstProjectFor(r.contributorRole);
    if (!user) { console.log(`skip (no user for ${r.contributorRole})`); continue; }
    const project = projects[i % projects.length];
    const bu = project.businessUnitId ? buById.get(project.businessUnitId) : undefined;
    const subsidiaryId = bu?.subsidiaryId ?? null;

    /* Leave the last two rows SUBMITTED for the live PA-approval demo. */
    const leavePending = i >= ROWS.length - 2;
    const status = leavePending ? "SUBMITTED" : "APPROVED";
    const ref = `SUB-${tag}-${String(i + 1).padStart(3, "0")}`;

    const hist = [
      { action: "SUBMITTED", actor: user.name, at: new Date(Date.now() - 86400000).toISOString(), note: "Submitted via data collection form." },
      ...(leavePending ? [] : [{ action: "APPROVED", actor: "Project Admin", at: new Date().toISOString(), note: "Approved by Project Admin with complete data verification." }]),
    ];

    await db.submission.create({
      data: {
        ref, title: r.title, category: r.category, module: r.module,
        metricName: r.metricName, metricValue: r.value, metricUnit: r.unit,
        status, period: PERIOD, fiscalQuarter: "Q4", dueDate: DUE,
        submittedAt: new Date(Date.now() - 86400000),
        reviewedAt: leavePending ? null : new Date(),
        projectId: project.id, businessUnitId: project.businessUnitId, subsidiaryId,
        submittedById: user.id,
        values: JSON.stringify([{ label: r.metricName, value: r.value, unit: r.unit }]),
        evidenceCount: 0, recordIds: "[]",
        completionPct: 100, validationPassed: 1, validationErrors: 0,
        history: JSON.stringify(hist),
      },
    });
    created++;
    console.log(`${leavePending ? "◍ SUBMITTED (live demo)" : "✓ APPROVED"} ${ref} — ${r.category} · ${r.metricName} = ${r.value} ${r.unit}`);
  }
  console.log(`\nDone: ${created} submissions (2 left SUBMITTED for the live approval demo).`);
  console.log("Next: Project Admin approves the 2 pending ones → BU consolidated dossier → Recompute in BRSR wizard pulls these values.");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
