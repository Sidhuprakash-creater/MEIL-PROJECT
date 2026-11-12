/* Demo seed: fill the BRSR Data forms of all 7 subsidiaries with realistic
   SEBI BRSR Core "Annexure I" values (the nine attributes) PLUS the
   Section A / B narrative fields, and mark each form SUBMITTED so the
   Group Admin's BRSR Data Checklist and Annexure I views are populated.

   Run: npx tsx scripts/seed-brsr-annexure1.ts */
import { db } from "../src/lib/db";
import { ANNEXURE_I } from "../src/lib/brsr/annexure1";

const PERIOD = "FY 2025-26";

/** Per-subsidiary scale factors so the consolidated numbers look real. */
interface Scale {
  scope1: number; scope2: number; energy: number; renewable: number;
  water: number; waste: number; employees: number; workers: number;
  revenueCr: number; ltifr: number; lti: number;
}

const SUBS: Record<string, Scale> = {
  "Megha Engineering & Infrastructures Ltd (MEIL Core)": {
    scope1: 48250, scope2: 112400, energy: 985600, renewable: 14.2,
    water: 842000, waste: 12400, employees: 12480, workers: 10970, revenueCr: 42800, ltifr: 0.42, lti: 6,
  },
  "Drillmec S.p.A.": {
    scope1: 3180, scope2: 6940, energy: 84200, renewable: 31.6,
    water: 48600, waste: 1850, employees: 1120, workers: 640, revenueCr: 5200, ltifr: 0.28, lti: 1,
  },
  "MEIL Hydro Power Limited": {
    scope1: 1240, scope2: 9860, energy: 21400, renewable: 100,
    water: 120000, waste: 420, employees: 860, workers: 410, revenueCr: 3100, ltifr: 0.15, lti: 0,
  },
  "MEIL Solar Energy Limited": {
    scope1: 310, scope2: 1480, energy: 11800, renewable: 100,
    water: 96000, waste: 180, employees: 540, workers: 260, revenueCr: 1900, ltifr: 0.09, lti: 0,
  },
  "Megha City Gas Distribution Holding": {
    scope1: 18600, scope2: 4120, energy: 120400, renewable: 6.8,
    water: 32000, waste: 640, employees: 1980, workers: 740, revenueCr: 8600, ltifr: 0.31, lti: 2,
  },
  "Petreven S.p.A.": {
    scope1: 86400, scope2: 12300, energy: 1180000, renewable: 2.1,
    water: 210000, waste: 9800, employees: 2340, workers: 1480, revenueCr: 21400, ltifr: 0.55, lti: 5,
  },
  "Olectra Greentech Limited": {
    scope1: 2940, scope2: 8720, energy: 96800, renewable: 24.5,
    water: 58000, waste: 2240, employees: 1640, workers: 980, revenueCr: 6400, ltifr: 0.22, lti: 1,
  },
};

const india = (s: Scale) => s;

function annexureValues(name: string, s: Scale): Record<string, string> {
  const isItaly = name.includes("S.p.A");
  const renewable = Math.min(100, s.renewable);

  /* Waste split (A–H) — total must equal the reported total. */
  const totalWaste = s.waste;
  const plastic = Math.round(totalWaste * 0.18 * 10) / 10;
  const ewaste = Math.round(totalWaste * 0.06 * 10) / 10;
  const biomedical = Math.round(totalWaste * 0.02 * 10) / 10;
  const cdWaste = Math.round(totalWaste * 0.41 * 10) / 10;
  const battery = Math.round(totalWaste * 0.04 * 10) / 10;
  const radioactive = 0;
  const otherHaz = Math.round(totalWaste * 0.07 * 10) / 10;
  const otherNonHaz = Math.round((totalWaste - plastic - ewaste - biomedical - cdWaste - battery - otherHaz) * 10) / 10;

  const recovered = Math.round(totalWaste * 0.62 * 10) / 10;

  const femaleWageShare = name.includes("MEIL Core") ? 8.4 : name.includes("Olectra") ? 13.2 : name.includes("City Gas") ? 12.1 : 9.6;

  return {
    /* 1 · GHG footprint */
    scope1: String(s.scope1),
    scope2: String(s.scope2),
    ghgIntensityTurnover: (Math.round(((s.scope1 + s.scope2) / s.revenueCr) * 100) / 100).toString(),
    ghgIntensityOutput: `Per unit of output — ${name.includes("Drillmec") ? "per rig built" : name.includes("Olectra") ? "per e-bus built" : name.includes("Hydro") || name.includes("Solar") ? "per MWh generated" : "per tonne of project output"}.`,

    /* 2 · Water footprint */
    waterConsumption: String(Math.round(s.water * 0.86)),
    waterIntensityTurnover: (Math.round((s.water * 0.86) / s.revenueCr * 100) / 100).toString(),
    waterIntensityOutput: `Per unit of output — ${name.includes("Hydro") ? "per MWh generated" : name.includes("City Gas") ? "per SCM of gas supplied" : "per unit of project output"}.`,
    waterDischarge: `Untreated 12% · Primary 18% · Secondary 44% · Tertiary 26% — ${Math.round(s.water * 0.86).toLocaleString("en-IN")} KL discharged to treated outlets.`,

    /* 3 · Energy footprint */
    energyConsumed: String(s.energy),
    renewableShare: renewable.toString(),
    energyIntensityTurnover: (Math.round((s.energy / s.revenueCr) * 100) / 100).toString(),
    energyIntensityOutput: `Per unit of output — ${name.includes("Hydro") || name.includes("Solar") ? "per MWh generated" : "per unit of project output"}.`,

    /* 4 · Embracing circularity */
    plasticWaste: plastic.toString(),
    ewaste: ewaste.toString(),
    biomedicalWaste: biomedical.toString(),
    cdWaste: cdWaste.toString(),
    batteryWaste: battery.toString(),
    radioactiveWaste: radioactive.toString(),
    otherHazardousWaste: otherHaz.toString(),
    otherNonHazardousWaste: otherNonHaz.toString(),
    totalWasteGenerated: totalWaste.toString(),
    wasteIntensityTurnover: (Math.round((totalWaste / s.revenueCr) * 1000) / 1000).toString(),
    wasteIntensityOutput: `Per unit of output — ${name.includes("City Gas") ? "per SCM of gas supplied" : "per unit of project output"}.`,
    wasteRecovered: `Recovered through recycling / re-use — ${recovered.toLocaleString("en-IN")} t (62% of total); certified by authorised recycler.`,
    wasteDisposed: `Incineration 4% · Landfill 9% · Other (recycling / re-use) 62% of ${totalWaste.toLocaleString("en-IN")} t generated.`,

    /* 5 · Employee well-being and safety */
    wellbeingSpend: "0.42",
    permanentDisabilities: "0",
    ltifr: s.ltifr.toString(),
    fatalities: "0",

    /* 6 · Gender diversity */
    femaleWageShare: femaleWageShare.toString(),
    poshComplaints: s.employees > 1000 ? "4" : "1",
    poshUpheld: "0",

    /* 7 · Inclusive development */
    msmeProcurement: (Math.round((58 + (s.employees % 17)) * 10) / 10).toString(),
    smallerTownWages: (Math.round((61 + (s.workers % 9)) * 10) / 10).toString(),

    /* 8 · Fairness */
    dataBreachShare: "0",
    accountsPayableDays: (38 + (s.revenueCr % 14)).toString(),

    /* 9 · Open-ness of business */
    tradingHousePurchases: `Purchases from trading houses 6.4% of total purchases across 12 trading houses; top 10 contribute 5.8%.`,
    dealerSales: `Sales to dealers / distributors 18.2% of total sales across 46 dealers; top 10 contribute 12.6%.`,
    rptShare: `RPT share — purchases 1.2% · sales 0.8% · loans & advances 2.1% · investments 3.4%.`,
  };
}

/** The Section A / B narrative fields (unchanged structure). */
function narrativeSections(name: string, s: Scale): Record<string, Record<string, string>> {
  const isItaly = name.includes("S.p.A");
  return {
    entity: {
      cin: isItaly ? "IT01234560458" : "U45200TG1989PLC010155",
      legalName: name,
      incorporationYear: isItaly ? "1929" : "1989",
      registeredOffice: `${isItaly ? "Milan / Piazza Baldassarre, Italy" : "Hyderabad, Telangana"} — MEIL Group registered office: Survey No. 66, Bachupally, Hyderabad 500090`,
      corporateOffice: isItaly ? "Via Stanga 4, Milan" : "MEIL Tower, Hyderabad",
      email: "esg@meil.in",
      phone: isItaly ? "+39 02 12345678" : "+91-40-2304-5555",
      website: "www.meil.in",
      paidUpCapital: "As per audited FY 2025-26 consolidated financial statements.",
      listing: name.includes("Olectra") ? "NSE: OLECTRA · BSE: 532456" : "N.A. — unlisted subsidiary",
      brsrContact: "Group ESG Cell — Head: Sustainability Office, MEIL Tower, Hyderabad · esg@meil.in",
      boundary: `Standalone reporting for ${name}; all operating sites included; equity-accounted JVs excluded.`,
      assuranceProvider: "N.A. — limited assurance planned from FY 2026-27",
      assuranceScope: "N.A.",
    },
    business: {
      activities: `${name} — principal revenue-earning activity per the audited segment note.`,
      products: "Segment-wise product / service list with NIC codes maintained in the finance register.",
      plantsIndia: isItaly ? "0" : "4",
      officesIndia: isItaly ? "0" : "6",
      locationsOutsideIndia: isItaly ? "5" : "2",
      marketsServed: "Domestic (India) and export markets per the audited segment revenue split — India ~78%, exports ~22% (group basis).",
    },
    workforce: {
      permanentEmployees: `Total ${s.employees.toLocaleString("en-IN")} — male ${(100 - (name.includes("Olectra") ? 13 : 8))}% / female ${name.includes("Olectra") ? 13 : 8}%`,
      otherEmployees: "Fixed-term & probation employees as per the HRMS register.",
      permanentWorkers: `Total ${s.workers.toLocaleString("en-IN")} — contract workforce engaged through registered contractors, PF/ESI compliant.`,
      otherWorkers: "Contract workers via registered contractors — PF/ESI compliant.",
      differentlyAbled: "1.2% of workforce — PwD register maintained by HR.",
      turnoverRates: "Voluntary + involuntary turnover: FY23 11.2% · FY24 9.8% · FY25 8.6% (gender split in the HR annexure).",
    },
    csr: {
      groupEntities: `${name} — 100% held by MEIL Group; included in the reporting boundary.`,
      csrApplicable: isItaly ? "N.A. — Italian statutory framework applies" : "Yes — Sec 135, Companies Act 2013.",
      csrObligation: isItaly ? "N.A. (Italian statutory) · Community spend €0.4M" : "Obligation ₹32.4 Cr · Spent ₹31.8 Cr · Unspent ₹0.6 Cr",
      csrProjects: "Education, health, drinking water & skill development projects via the MEIL Charitable Foundation and local partners.",
      grievances: "Communities: 34 received / 2 pending / 32 resolved. Employees: 118 / 4 / 114. Customers: 96 / 1 / 95. Value chain: 12 / 0 / 12.",
      materialIssues: "1) Occupational safety — risk — site-level controls, monthly review. 2) Water stewardship — opportunity — recycling targets. 3) Emissions intensity — risk — renewable procurement roadmap.",
    },
    governance: {
      policies: "Code of Conduct (P1), EHS Policy (P3, P6), HR & Human Rights Policy (P3, P5), CSR Policy (P8), Quality Policy (P2, P9) — owners & versions in the policy register.",
      policyImplementation: "Policies approved by the Board; communicated via induction + annual training; contractor clauses in purchase orders and the vendor code.",
      certifications: "ISO 9001:2015 · ISO 14001:2015 · ISO 45001:2018 — valid through FY 2026-27.",
      targets: "1) 25% renewable energy share by FY28 (baseline FY24 12%). 2) Zero fatalities — ongoing. 3) 20% water recycling uplift by FY27.",
      leadershipStatement: "MEIL Group remains committed to responsible infrastructure growth — safety-first operations, environmental stewardship and community partnership form the core of our business conduct.",
      oversightCommittees: "Board-level CSR & Sustainability Committee — quarterly meetings; the ESG Cell executes the programme.",
    },
    environment: {
      energyGj: `Total ${s.energy.toLocaleString("en-IN")} GJ — Renewable ${s.renewable}%`,
      energyIntensity: "Per ₹ Cr turnover — reported in the Annexure I methodology register.",
      waterKl: `Consumption ${Math.round(s.water * 0.86).toLocaleString("en-IN")} KL · recycled 18.5%`,
      waterIntensity: "Per unit of output — Annexure I.",
      scope1: String(s.scope1),
      scope2: String(s.scope2),
      scope3: "Estimated — business travel & upstream fuel (screening) — Annexure 4.",
      ghgIntensity: `Per ₹ Cr turnover — ${((s.scope1 + s.scope2) / s.revenueCr).toFixed(2)} tCO2e/₹Cr`,
      airEmissions: "Stack emissions within CPCB/SPCB limits; CEMS at designated stacks; monthly monitoring reports.",
      waste: `Generated ${s.waste.toLocaleString("en-IN")} t · Recycled 62% · Landfill 9%`,
      envCompliances: "No material non-compliances in FY 2025-26; minor notices resolved — compliance register ref.",
    },
    social: {
      safety: `Safe man-hours & LTI per site OHS register; LTIFR ${s.ltifr}; zero fatalities; monthly safety committee review.`,
      training: "Average 12 training hours/employee (skill + safety); gender split in the HR annexure.",
      wagesBenefits: "At or above the statutory minimum wage; PF, ESI, gratuity and welfare per statute.",
      humanRights: "Human rights due diligence embedded in HR & vendor policies; awareness training for 100% of new joiners; no confirmed incidents.",
      community: "CSR beneficiaries per the project register; local employment ≥ 60% at project sites.",
      consumer: "Customer complaints resolution ≥ 96% within SLA; no reportable privacy or cybersecurity incidents in FY 2025-26.",
    },
    annexures: {
      methodology: "Metrics computed per the GHG Protocol and the BRSR Core Annexure I methodology; boundary = operational control.",
      emissionFactors: "Grid: CEA v20 (0.716 tCO2/MWh). Diesel: IPCC 2006 (2.68 kgCO2/L). Coal: IPCC 2006 — sources & versions in the Annexure 2 register.",
      exclusions: "Scope 3 screening estimate; equity-accounted JVs excluded; no restatements vs FY 2024-25.",
      evidenceRefs: "Evidence IDs mapped per indicator in the platform evidence module (verified by the BU Manager + Subsidiary Manager).",
    },
  };
}

async function main() {
  const subs = await db.subsidiary.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true } });
  console.log(`Seeding Annexure I BRSR data for ${subs.length} subsidiaries…`);

  for (const s of subs) {
    const scale = SUBS[s.name];
    if (!scale) { console.log(`  skip (no mock): ${s.name}`); continue; }

    const sections: Record<string, Record<string, string>> = narrativeSections(s.name, scale);

    /* Annexure I — one section per attribute, keyed `annexure1.<attributeId>`. */
    const annex = annexureValues(s.name, scale);
    for (const attr of ANNEXURE_I) {
      const sec: Record<string, string> = {};
      for (const p of attr.parameters) sec[p.key] = annex[p.key] ?? "";
      sections[`annexure1.${attr.id}`] = sec;
    }

    await db.brsrSubsidiaryData.upsert({
      where: { subsidiaryId_period: { subsidiaryId: s.id, period: PERIOD } },
      create: {
        subsidiaryId: s.id,
        subsidiaryName: s.name,
        period: PERIOD,
        status: "SUBMITTED",
        sections: JSON.stringify(sections),
        submittedAt: new Date(),
        submittedBy: "Sustainability Office",
      },
      update: {
        sections: JSON.stringify(sections),
        status: "SUBMITTED",
        submittedAt: new Date(),
        submittedBy: "Sustainability Office",
        subsidiaryName: s.name,
      },
    });
    console.log(`  ✓ ${s.name}`);
  }

  console.log(`\nDone. Open Group Admin → BRSR Core — Annexure I for the consolidated table.`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
