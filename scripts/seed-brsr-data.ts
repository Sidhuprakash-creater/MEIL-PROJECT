/* Demo seed: fill BRSR data forms for all 7 subsidiaries (DRAFT status).
   Run: npx tsx scripts/seed-brsr-data.ts */
import { db } from "../src/lib/db";

const PERIOD = "FY 2025-26";

interface Demo {
  cin: string; inc: string; city: string; reg: string; sector: string;
  employees: string; workers: string; scope1: string; scope2: string;
  energy: string; water: string; waste: string; csr: string;
}

const SUBS: Record<string, Demo> = {
  "Megha Engineering & Infrastructures Ltd (MEIL Core)": {
    cin: "U45200TG1989PLC010155", inc: "1989", city: "Hyderabad, Telangana", reg: "South",
    sector: "Engineering & Infrastructure (EPC)",
    employees: "Total 12,480 — Male 92% / Female 8%", workers: "Permanent 4,120 — Male 96% / Female 4%; Contract 6,850",
    scope1: "48,250", scope2: "1,12,400", energy: "Total 9,85,600 GJ — Renewable 14.2%", water: "Withdrawal 8,42,000 KL · Recycled 18.5%", waste: "Generated 12,400 t · Recycled 62% · Landfill 9%", csr: "Obligation ₹32.4 Cr · Spent ₹31.8 Cr · Unspent ₹0.6 Cr",
  },
  "Drillmec S.p.A.": {
    cin: "IT01234560458", inc: "1929", city: "Piazza Baldassarre, Italy", reg: "Europe",
    sector: "Drilling Equipment Manufacturing",
    employees: "Total 1,120 — Male 86% / Female 14%", workers: "Permanent 640 — Male 90% / Female 10%",
    scope1: "3,180", scope2: "6,940", energy: "Total 84,200 GJ — Renewable 31.6%", water: "Withdrawal 48,600 KL · Recycled 22%", waste: "Generated 1,850 t · Recycled 71% · Landfill 6%", csr: "Obligation N.A. (Italian statutory) · Community spend €0.4M",
  },
  "MEIL Hydro Power Limited": {
    cin: "U40106TG2010PLC069342", inc: "2010", city: "Hyderabad, Telangana", reg: "South",
    sector: "Hydro Power Generation",
    employees: "Total 860 — Male 94% / Female 6%", workers: "Permanent 410 — Male 97% / Female 3%",
    scope1: "1,240", scope2: "9,860", energy: "Generation 3,420 MU · Renewable 100% (hydro)", water: "Withdrawal 1,20,000 KL (run-of-river) · no consumption", waste: "Generated 420 t · Recycled 55% · Landfill 12%", csr: "Obligation ₹1.1 Cr · Spent ₹1.1 Cr",
  },
  "MEIL Solar Energy Limited": {
    cin: "U40106TG2014PLC094561", inc: "2014", city: "Hyderabad, Telangana", reg: "South",
    sector: "Solar Power Generation",
    employees: "Total 540 — Male 90% / Female 10%", workers: "Permanent 260 — Male 93% / Female 7%",
    scope1: "310", scope2: "1,480", energy: "Generation 1,960 MU · Renewable 100% (solar)", water: "Withdrawal 96,000 KL (panel cleaning, recycled 40%)", waste: "Generated 180 t · Recycled 78% · Landfill 4%", csr: "Obligation ₹0.6 Cr · Spent ₹0.6 Cr",
  },
  "Megha City Gas Distribution Holding": {
    cin: "U40200TG2015PLC098765", inc: "2015", city: "Hyderabad, Telangana", reg: "Pan-India",
    sector: "City Gas Distribution (PNG & CNG)",
    employees: "Total 1,980 — Male 88% / Female 12%", workers: "Permanent 740 — Male 92% / Female 8%",
    scope1: "18,600", scope2: "4,120", energy: "Total 1,20,400 GJ — Renewable 6.8%", water: "Withdrawal 32,000 KL · Recycled 12%", waste: "Generated 640 t · Recycled 48% · Landfill 18%", csr: "Obligation ₹2.4 Cr · Spent ₹2.2 Cr · Unspent ₹0.2 Cr",
  },
  "Petreven S.p.A.": {
    cin: "IT09876543210", inc: "2006", city: "Milan, Italy", reg: "Europe / Middle East",
    sector: "Oil & Gas Drilling Services",
    employees: "Total 2,340 — Male 91% / Female 9%", workers: "Permanent 1,480 — Male 94% / Female 6%",
    scope1: "86,400", scope2: "12,300", energy: "Total 11,80,000 GJ — Renewable 2.1%", water: "Withdrawal 2,10,000 KL · Recycled 15%", waste: "Generated 9,800 t · Recycled 58% · Landfill 14%", csr: "Obligation N.A. (Italian statutory) · Community spend €1.2M",
  },
  "Olectra Greentech Limited": {
    cin: "L35920TG1992PLC014320", inc: "1992", city: "Hyderabad, Telangana", reg: "Pan-India",
    sector: "Electric Bus Manufacturing & E-mobility",
    employees: "Total 1,640 — Male 87% / Female 13%", workers: "Permanent 980 — Male 91% / Female 9%",
    scope1: "2,940", scope2: "8,720", energy: "Total 96,800 GJ — Renewable 24.5%", water: "Withdrawal 58,000 KL · Recycled 26%", waste: "Generated 2,240 t · Recycled 68% · Landfill 8%", csr: "Obligation ₹4.8 Cr · Spent ₹4.6 Cr · Unspent ₹0.2 Cr",
  },
};

function build(name: string, d: Demo) {
  return {
    entity: {
      cin: d.cin,
      legalName: name,
      incorporationYear: d.inc,
      registeredOffice: `${d.city}, India HQ — MEIL Group registered office: Survey No. 66, Bachupally, Hyderabad 500090`,
      corporateOffice: `MEIL Tower, ${d.city}`,
      email: "esg@meil.in",
      phone: "+91-40-2304-5555",
      website: "www.meil.in",
      paidUpCapital: "As per audited FY 2025-26 financials ( consolidated group register )",
      listing: name.includes("Olectra") ? "NSE: OLECTRA · BSE: 532456" : "N.A. — unlisted subsidiary",
      brsrContact: "Group ESG Cell — Head: Sustainability Office, MEIL Tower, Hyderabad · esg@meil.in",
      boundary: `Standalone reporting for ${name}; all operating sites included; minority JVs excluded (equity-accounted).`,
      assuranceProvider: "N.A. — limited assurance planned from FY 2026-27",
      assuranceScope: "N.A.",
    },
    business: {
      activities: `${d.sector}. Principal revenue-earning activity for the group; contribution per audited segment note.`,
      products: "Segment-wise product/service list with NIC codes maintained in the finance register (Annexure 1 reference).",
      plantsIndia: name.includes("Italy") ? "0" : "4",
      officesIndia: name.includes("Italy") ? "0" : "6",
      locationsOutsideIndia: name.includes("Italy") ? "5" : "2",
      marketsServed: "Domestic (India) and export markets per audited segment revenue split — India ~78%, exports ~22% (group basis).",
    },
    workforce: {
      permanentEmployees: d.employees,
      otherEmployees: "Fixed-term & probation employees as per HRMS register.",
      permanentWorkers: d.workers,
      otherWorkers: "Contract workers via registered contractors — PF/ESI compliant.",
      differentlyAbled: "1.2% of workforce — PwD register maintained by HR.",
      turnoverRates: "Voluntary + involuntary turnover: FY23 11.2% · FY24 9.8% · FY25 8.6% (gender split in HR annexure).",
    },
    csr: {
      groupEntities: `${name} — 100% held (directly/indirectly) by MEIL Group; included in reporting boundary.`,
      csrApplicable: "Yes — Sec 135, Companies Act 2013 (India-registered entities).",
      csrObligation: d.csr,
      csrProjects: "Education, health, drinking water & skill development projects via MEIL Charitable Foundation and local partners.",
      grievances: "Communities: 34 received / 2 pending / 32 resolved. Employees: 118 / 4 / 114. Customers: 96 / 1 / 95. Value-chain: 12 / 0 / 12.",
      materialIssues: "1) Occupational safety — risk — site-level controls, monthly review. 2) Water stewardship — opportunity — recycling targets. 3) Emissions intensity — risk — renewable procurement roadmap.",
    },
    governance: {
      policies: "Code of Conduct (P1), EHS Policy (P3, P6), HR & Human Rights Policy (P3, P5), CSR Policy (P8), Quality Policy (P2, P9) — owners & versions in policy register.",
      policyImplementation: "Policies approved by the Board / competent authority; communicated via induction + annual training; contractor clauses in purchase orders and vendor code.",
      certifications: "ISO 9001:2015 · ISO 14001:2015 · ISO 45001:2018 — valid through FY 2026-27, certificate IDs in evidence register.",
      targets: "1) 25% renewable energy share by FY28 (baseline FY24 12%). 2) Zero fatalities — ongoing. 3) 20% water recycling uplift by FY27. Progress reviewed quarterly by ESG Cell.",
      leadershipStatement: "MEIL Group remains committed to responsible infrastructure growth — safety-first operations, environmental stewardship and community partnership form the core of our business conduct.",
      oversightCommittees: "Board-level CSR & Sustainability Committee — quarterly meetings; ESG Cell executes — minutes referenced in evidence register.",
    },
    environment: {
      energyGj: d.energy,
      energyIntensity: "Per ₹ Cr turnover — reported in Annexure 1 methodology register.",
      waterKl: d.water,
      waterIntensity: "Per unit output — Annexure 1.",
      scope1: d.scope1,
      scope2: d.scope2,
      scope3: "Estimated — business travel & upstream fuel (screening) — Annexure 4.",
      ghgIntensity: "Per ₹ Cr turnover — Annexure 1.",
      airEmissions: "Stack emissions within CPCB/SPCB limits; CEMS at designated stacks; monthly monitoring reports.",
      waste: d.waste,
      envCompliances: "No material non-compliances in FY 2025-26; minor notices resolved — compliance register ref.",
    },
    social: {
      safety: "Safe man-hours & LTI per site OHS register; zero fatalities target; monthly safety committee review.",
      training: "Average 12 training hours/employee (skill + safety); gender split in HR annexure.",
      wagesBenefits: "At or above statutory minimum wage; PF, ESI, gratuity and welfare per statute; living-wage benchmarking planned.",
      humanRights: "Human rights due diligence embedded in HR & vendor policies; awareness training 100% of new joiners; no confirmed incidents.",
      community: "CSR beneficiaries as per project register; local employment ≥ 60% at project sites; local procurement tracked in procurement module.",
      consumer: "Customer complaints resolution ≥ 96% within SLA; no data-privacy or cybersecurity reportable incidents in FY 2025-26.",
    },
    annexures: {
      methodology: "Metrics computed per GHG Protocol & BRSR Core methodology; boundary = operational control; formulas in methodology register (Annexure 1).",
      emissionFactors: "Grid: CEA v20 (0.716 tCO2/MWh). Diesel: IPCC 2006 (2.68 kgCO2/L). Coal: IPCC 2006 — sources & versions in Annexure 2 register.",
      exclusions: "Scope 3 screening estimate; JV entities excluded (equity method); restatements none vs FY 2024-25.",
      evidenceRefs: "Evidence IDs mapped per indicator in the platform evidence module (verified by BU Manager + Subsidiary Manager).",
    },
  } as Record<string, Record<string, string>>;
}

async function main() {
  const subs = await db.subsidiary.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true } });
  console.log(`Seeding BRSR data for ${subs.length} subsidiaries (DRAFT)…`);
  for (const s of subs) {
    const demo = SUBS[s.name];
    if (!demo) { console.log(`  skip (no demo): ${s.name}`); continue; }
    const sections = build(s.name, demo);
    await db.brsrSubsidiaryData.upsert({
      where: { subsidiaryId_period: { subsidiaryId: s.id, period: PERIOD } },
      create: { subsidiaryId: s.id, subsidiaryName: s.name, period: PERIOD, status: "DRAFT", sections: JSON.stringify(sections) },
      update: { sections: JSON.stringify(sections), status: "DRAFT", subsidiaryName: s.name },
    });
    console.log(`  ✓ ${s.name}`);
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
