/* ═══════════════════════════════════════════════════════════════════════════
   MEIL ESG Platform — Site Operations (Project User Portal) seed
   ─────────────────────────────────────────────────────────────────────────
   Provisions the integrated Project User Portal on top of the EXISTING
   platform organization (subsidiaries / BUs / projects from prisma/seed.ts):
     1. Eight site-level portal users (the "remaining users") attached to
        real platform projects, with gateway credentials (Esg@2025).
     2. Reporting year FY 2026-27 + monthly periods.
     3. Units, conversion rules, CEA/IPCC emission factors.
     4. BRSR CORE framework (sections, principles, questions).
     5. Illustrative ESG source records + calculations + evidence + one
        approved submission + audit/activity/notifications + BRSR answers.
     6. The level-records JSON store used by the Data Entry module.

   Run: bunx tsx prisma/seed-so.ts   (idempotent — safe to re-run)
   ═══════════════════════════════════════════════════════════════════════════ */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";
import fs from "fs";
import path from "path";

const db = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Site Operations portal (Project User)...");

  /* ── 0. Locate platform org entities (created by prisma/seed.ts) ────────── */
  const projects = await db.project.findMany();
  if (projects.length === 0) throw new Error("No projects found — run prisma/seed.ts first");
  const getProject = (code: string, fallbackIdx: number) =>
    projects.find((p) => p.code === code) || projects[fallbackIdx % projects.length];

  const pvagada = getProject("PRJ-PVG-SOL", 0);
  const ktpp = getProject("PRJ-MONG", 1);
  const nh48 = getProject("PRJ-ZOJ", 2);
  const ring = getProject("PRJ-TBTT", 3);
  const klbd = getProject("PRJ-KLIP", 4);
  const desal = getProject("PRJ-POLA", 5);

  /* ── 1. Portal users (the remaining site-operations users) ──────────────── */
  const passwordHash = await hashPassword("demo");
  const userDefs = [
    { email: "rohit@meil-esg.in", name: "Rohit Kumar", employeeId: "PU-ENV-014", role: "ENV_DATA_USER", title: "Environment Data Officer", projectId: pvagada.id, phone: "+91 98480 11021" },
    { email: "finance@meil-esg.in", name: "Rahul Verma", employeeId: "PU-FIN-015", role: "FIN_RESOURCE_USER", title: "Finance & Resource Analyst", projectId: ktpp.id, phone: "+91 98480 11022" },
    { email: "kvenkat@meil-esg.in", name: "K. Venkat", employeeId: "PU-EHS-017", role: "EHS_USER", title: "EHS Safety Officer", projectId: ktpp.id, phone: "+91 98480 11023" },
    { email: "sunita@meil-esg.in", name: "Sunita Rao", employeeId: "PU-HR-016", role: "HR_USER", title: "HR Data Coordinator", projectId: nh48.id, phone: "+91 98480 11024" },
    { email: "priya@meil-esg.in", name: "Priya Nair", employeeId: "PU-PRC-018", role: "PROCUREMENT_USER", title: "Procurement Analyst", projectId: ring.id, phone: "+91 98480 11025" },
    { email: "imran@meil-esg.in", name: "Imran Sheikh", employeeId: "PU-CSR-019", role: "CSR_USER", title: "CSR Program Lead", projectId: klbd.id, phone: "+91 98480 11026" },
    { email: "deepika@meil-esg.in", name: "Deepika Joshi", employeeId: "PU-CMP-020", role: "COMPLIANCE_USER", title: "Compliance Officer", projectId: desal.id, phone: "+91 98480 11027" },
    { email: "sameer@meil-esg.in", name: "Sameer Khan", employeeId: "PU-ANA-021", role: "ESG_ANALYST", title: "ESG Analyst — Group Analytics", projectId: ktpp.id, phone: "+91 98480 11028" },
    { email: "pavagada.admin@meil-esg.in", name: "Meera Iyer", employeeId: "ADM-2001", role: "PROJECT_ADMIN", title: "Project Admin — Pavagada Solar", projectId: pvagada.id, phone: "+91 98480 11030" },
  ] as const;

  const userIds: Record<string, string> = {};
  for (const u of userDefs) {
    const existing = await db.user.findUnique({ where: { email: u.email } });
    if (existing) {
      await db.user.update({
        where: { id: existing.id },
        data: {
          name: u.name,
          employeeId: u.employeeId,
          role: u.role,
          title: u.title,
          phone: u.phone,
          projectId: u.projectId,
          status: "ACTIVE",
          passwordHash,
        },
      });
      userIds[u.email] = existing.id;
    } else {
      const created = await db.user.create({
        data: {
          email: u.email,
          name: u.name,
          employeeId: u.employeeId,
          role: u.role,
          title: u.title,
          phone: u.phone,
          projectId: u.projectId,
          status: "ACTIVE",
          passwordHash,
        },
      });
      userIds[u.email] = created.id;
    }
  }
  const rohitId = userIds["rohit@meil-esg.in"];
  const venkatId = userIds["kvenkat@meil-esg.in"];

  /* Existing platform site users already carry EMP-#### handles + password —
     leave them untouched; they can use the Project portal with their own
     assigned projects. */

  /* ── 2. Reporting year + periods ────────────────────────────────────────── */
  let rYear = await db.reportingYear.findFirst({ where: { label: "FY 2026-27" } });
  if (!rYear) {
    rYear = await db.reportingYear.create({
      data: { groupId: "MEIL-GROUP", year: 2026, label: "FY 2026-27", status: "OPEN" },
    });
  }
  const months = [
    { m: 3, label: "April 2026", start: "2026-04-01", end: "2026-04-30", sub: "04-30", rev: "05-10", app: "05-20" },
    { m: 4, label: "May 2026", start: "2026-05-01", end: "2026-05-31", sub: "05-31", rev: "06-10", app: "06-20" },
    { m: 5, label: "June 2026", start: "2026-06-01", end: "2026-06-30", sub: "06-30", rev: "07-10", app: "07-20" },
  ];
  const periodIds: Record<string, string> = {};
  for (const mp of months) {
    const found = await db.reportingPeriod.findFirst({
      where: { reportingYearId: rYear.id, periodLabel: mp.label },
    });
    if (found) {
      periodIds[mp.label] = found.id;
      continue;
    }
    const p = await db.reportingPeriod.create({
      data: {
        reportingYearId: rYear.id,
        periodType: "MONTHLY",
        periodLabel: mp.label,
        year: 2026,
        month: mp.m,
        startDate: new Date(mp.start),
        endDate: new Date(mp.end),
        submissionDeadline: new Date(`2026-${mp.sub}T23:59:59Z`),
        reviewDeadline: new Date(`2026-${mp.rev}T23:59:59Z`),
        approvalDeadline: new Date(`2026-${mp.app}T23:59:59Z`),
        status: "OPEN",
      },
    });
    periodIds[mp.label] = p.id;
  }

  /* ── 3. Units, conversion rules, emission factors ───────────────────────── */
  const units: [string, string, string, string][] = [
    ["KWH", "Kilowatt-hour", "ENERGY", "KWH"],
    ["MWH", "Megawatt-hour", "ENERGY", "KWH"],
    ["GJ", "Gigajoule", "ENERGY", "GJ"],
    ["L", "Litre", "VOLUME", "L"],
    ["KL", "Kilolitre", "VOLUME", "L"],
    ["M3", "Cubic metre", "VOLUME", "L"],
    ["KG", "Kilogram", "MASS", "KG"],
    ["TON", "Metric tonne", "MASS", "KG"],
    ["TCO2E", "tCO2e", "EMISSION", "TCO2E"],
  ];
  for (const [code, name, cat, base] of units) {
    await db.unitMaster.upsert({ where: { code }, update: {}, create: { code, name, category: cat, baseUnit: base } });
  }
  if ((await db.conversionRule.count()) === 0) {
    await db.conversionRule.createMany({
      data: [
        { fromUnit: "KWH", toUnit: "GJ", factor: 0.0036, category: "ENERGY", version: 1 },
        { fromUnit: "MWH", toUnit: "KWH", factor: 1000, category: "ENERGY", version: 1 },
        { fromUnit: "MWH", toUnit: "GJ", factor: 3.6, category: "ENERGY", version: 1 },
        { fromUnit: "L", toUnit: "KL", factor: 0.001, category: "VOLUME", version: 1 },
        { fromUnit: "M3", toUnit: "L", factor: 1000, category: "VOLUME", version: 1 },
        { fromUnit: "KG", toUnit: "TON", factor: 0.001, category: "MASS", version: 1 },
      ],
    });
  }
  const factors = [
    { name: "Grid Electricity (India)", category: "ELECTRICITY", fuelType: "GRID", geography: "IN", factorValue: 0.716, factorUnit: "kgCO2e/kWh", scope: "SCOPE_2", methodology: "CEA v19", sourceDocument: "CEA CO2 Baseline Database v19" },
    { name: "Diesel (HSD)", category: "MOBILE", fuelType: "DIESEL", geography: "IN", factorValue: 2.637, factorUnit: "kgCO2e/L", scope: "SCOPE_1", methodology: "IPCC 2006", sourceDocument: "IPCC Guidelines 2006 Vol 2 Ch 2" },
    { name: "Petrol (MS)", category: "MOBILE", fuelType: "PETROL", geography: "IN", factorValue: 2.296, factorUnit: "kgCO2e/L", scope: "SCOPE_1", methodology: "IPCC 2006", sourceDocument: "IPCC Guidelines 2006" },
    { name: "Coal (Sub-bituminous)", category: "STATIONARY", fuelType: "COAL", geography: "IN", factorValue: 1.9, factorUnit: "kgCO2e/kg", scope: "SCOPE_1", methodology: "IPCC 2006", sourceDocument: "IPCC Guidelines 2006 Vol 2 Ch 2" },
    { name: "CNG", category: "STATIONARY", fuelType: "CNG", geography: "IN", factorValue: 2.19, factorUnit: "kgCO2e/kg", scope: "SCOPE_1", methodology: "IPCC 2006", sourceDocument: "IPCC Guidelines 2006" },
    { name: "LPG", category: "STATIONARY", fuelType: "LPG", geography: "IN", factorValue: 2.98, factorUnit: "kgCO2e/kg", scope: "SCOPE_1", methodology: "IPCC 2006", sourceDocument: "IPCC Guidelines 2006" },
    { name: "Renewable PPA Solar", category: "ELECTRICITY", fuelType: "SOLAR_PPA", geography: "IN", factorValue: 0.04, factorUnit: "kgCO2e/kWh", scope: "SCOPE_2", methodology: "ISAE 3000", sourceDocument: "RE Procurement Annexure" },
    { name: "Air Travel (Domestic)", category: "TRAVEL", fuelType: "AVIATION", geography: "IN", factorValue: 0.18, factorUnit: "kgCO2e/pass-km", scope: "SCOPE_3", methodology: "GHG Protocol Scope 3", sourceDocument: "GHG Protocol" },
    { name: "Rail Travel", category: "TRAVEL", fuelType: "RAIL", geography: "IN", factorValue: 0.04, factorUnit: "kgCO2e/pass-km", scope: "SCOPE_3", methodology: "GHG Protocol Scope 3", sourceDocument: "GHG Protocol" },
    { name: "Road Travel (Car)", category: "TRAVEL", fuelType: "PETROL", geography: "IN", factorValue: 0.11, factorUnit: "kgCO2e/pass-km", scope: "SCOPE_3", methodology: "GHG Protocol Scope 3", sourceDocument: "GHG Protocol" },
  ];
  const factorIds: Record<string, string> = {};
  for (const f of factors) {
    const existing = await db.emissionFactor.findFirst({ where: { name: f.name, version: 1 } });
    if (existing) {
      factorIds[f.name] = existing.id;
      continue;
    }
    const ef = await db.emissionFactor.create({
      data: { ...f, source: f.methodology, effectiveFrom: new Date("2025-04-01"), version: 1, status: "ACTIVE" },
    });
    factorIds[f.name] = ef.id;
  }

  /* ── 4. BRSR CORE framework ─────────────────────────────────────────────── */
  let fw = await db.brsrFramework.findFirst({ where: { name: "BRSR", version: "v3" } });
  if (!fw) {
    fw = await db.brsrFramework.create({
      data: { name: "BRSR", version: "v3", reportingYear: 2026, tier: "CORE", status: "ACTIVE" },
    });
    const secA = await db.brsrSection.create({ data: { frameworkId: fw.id, code: "A", name: "General Disclosures", description: "Entity identity & business overview", sortOrder: 1 } });
    const secB = await db.brsrSection.create({ data: { frameworkId: fw.id, code: "B", name: "Management & Process Disclosures", description: "Policies, governance, performance", sortOrder: 2 } });
    const secC = await db.brsrSection.create({ data: { frameworkId: fw.id, code: "C", name: "Principle-wise Performance", description: "Principles 1-9 indicator performance", sortOrder: 3 } });
    const principles: [string, string, string][] = [
      ["P1", "Ethics & Integrity", "Business conducted ethically, transparently, with integrity"],
      ["P2", "Sustainable Products & Services", "Goods sustainable, safe, resource efficient"],
      ["P3", "Employees & Communities", "Respect & promote employee wellbeing & community development"],
      ["P4", "Stakeholders", "Respect, respond to stakeholder interests"],
      ["P5", "Human Rights", "Respect & promote human rights"],
      ["P6", "Environment", "Respect & make efforts to protect & restore environment"],
      ["P7", "Public Policy & Advocacy", "Respect & influence public policy per law"],
      ["P8", "Inclusive Value Chain", "Promote inclusive growth & equitable access"],
      ["P9", "Customers & Consumers", "Engage responsibly with customers & consumers"],
    ];
    const prIds: Record<string, string> = {};
    for (let i = 0; i < principles.length; i++) {
      const [code, name, title] = principles[i];
      const p = await db.brsrPrinciple.create({ data: { frameworkId: fw.id, code, name, title, description: title, sortOrder: i + 1 } });
      prIds[code] = p.id;
    }
    const brsrQs: Array<{ sec: string; p: string | null; code: string; text: string; type: string; unit?: string; mapping: string; evidenceRequired?: boolean; calculationMethod?: string }> = [
      { sec: "A", p: null, code: "A-1", text: "CIN of the entity", type: "TEXT", mapping: "SUBSIDIARY.cin" },
      { sec: "A", p: null, code: "A-2", text: "Name of the listed entity", type: "TEXT", mapping: "SUBSIDIARY.name" },
      { sec: "A", p: null, code: "A-3", text: "Total number of employees (permanent + non-permanent)", type: "NUMERIC", unit: "count", mapping: "WORKFORCE.total" },
      { sec: "A", p: null, code: "A-4", text: "Total number of workers", type: "NUMERIC", unit: "count", mapping: "WORKFORCE.workers" },
      { sec: "A", p: null, code: "A-5", text: "Net turnover (₹ crore)", type: "NUMERIC", unit: "INR crore", mapping: "FINANCIAL.turnover" },
      { sec: "C", p: "P3", code: "P3-1", text: "Total permanent employees (Male / Female / Other)", type: "SOURCE_MAPPED", mapping: "WORKFORCE.permanent" },
      { sec: "C", p: "P3", code: "P3-2", text: "Total non-permanent employees", type: "SOURCE_MAPPED", mapping: "WORKFORCE.nonPermanent" },
      { sec: "C", p: "P3", code: "P3-3", text: "Number of fatalities (LTIFR)", type: "SOURCE_MAPPED", mapping: "SAFETY.fatalities", evidenceRequired: true },
      { sec: "C", p: "P3", code: "P3-4", text: "Lost Time Injury Frequency Rate (LTIFR)", type: "NUMERIC", unit: "per million hours", mapping: "SAFETY.ltifr", calculationMethod: "CALCULATED" },
      { sec: "C", p: "P3", code: "P3-5", text: "Total training hours (employee)", type: "SOURCE_MAPPED", mapping: "WORKFORCE.trainingHours" },
      { sec: "C", p: "P6", code: "P6-1", text: "Scope 1 emissions (tCO2e)", type: "NUMERIC", unit: "tCO2e", mapping: "ENERGY.scope1", calculationMethod: "CALCULATED", evidenceRequired: true },
      { sec: "C", p: "P6", code: "P6-2", text: "Scope 2 emissions (tCO2e)", type: "NUMERIC", unit: "tCO2e", mapping: "ENERGY.scope2", calculationMethod: "CALCULATED", evidenceRequired: true },
      { sec: "C", p: "P6", code: "P6-3", text: "Total energy consumption (GJ)", type: "NUMERIC", unit: "GJ", mapping: "ENERGY.totalGJ", calculationMethod: "CALCULATED" },
      { sec: "C", p: "P6", code: "P6-4", text: "Renewable energy share (%)", type: "NUMERIC", unit: "%", mapping: "ENERGY.renewableShare", calculationMethod: "CALCULATED" },
      { sec: "C", p: "P6", code: "P6-5", text: "Water withdrawal (KL)", type: "SOURCE_MAPPED", unit: "KL", mapping: "WATER.withdrawal", evidenceRequired: true },
      { sec: "C", p: "P6", code: "P6-6", text: "Water recycled / reused (%)", type: "NUMERIC", unit: "%", mapping: "WATER.recycledShare", calculationMethod: "CALCULATED" },
      { sec: "C", p: "P6", code: "P6-7", text: "Hazardous waste generated (T)", type: "SOURCE_MAPPED", unit: "T", mapping: "WASTE.hazardous", evidenceRequired: true },
      { sec: "C", p: "P6", code: "P6-8", text: "Waste recycled / recovered (%)", type: "NUMERIC", unit: "%", mapping: "WASTE.recycledShare", calculationMethod: "CALCULATED" },
      { sec: "C", p: "P8", code: "P8-1", text: "CSR spend (₹ crore)", type: "NUMERIC", unit: "INR crore", mapping: "CSR.spend" },
      { sec: "C", p: "P9", code: "P9-1", text: "Cybersecurity incidents", type: "SOURCE_MAPPED", mapping: "GOVERNANCE.cyberIncidents" },
      { sec: "C", p: "P1", code: "P1-1", text: "Anti-corruption training coverage (%)", type: "NUMERIC", unit: "%", mapping: "GOVERNANCE.antiCorruptionTraining" },
    ];
    for (let i = 0; i < brsrQs.length; i++) {
      const q = brsrQs[i];
      await db.brsrQuestion.create({
        data: {
          frameworkId: fw.id,
          sectionId: q.sec === "A" ? secA.id : q.sec === "B" ? secB.id : secC.id,
          principleId: q.p ? prIds[q.p] : null,
          questionCode: q.code,
          questionText: q.text,
          answerType: q.type,
          unit: q.unit ?? null,
          evidenceRequired: q.evidenceRequired ?? false,
          mappingSource: q.mapping,
          calculationMethod: q.calculationMethod ?? null,
          sortOrder: i + 1,
        },
      });
    }
  }

  /* ── 5. Illustrative ESG source records (only once) ─────────────────────── */
  const alreadySeeded = (await db.energyRecord.count()) > 0;
  if (!alreadySeeded) {
    const april = periodIds["April 2026"];
    const may = periodIds["May 2026"];
    const june = periodIds["June 2026"];

    // Energy — Pavagada Solar Park
    const e1 = await db.energyRecord.create({ data: { projectId: pvagada.id, reportingPeriodId: april, module: "ENERGY", source: "Grid Electricity", sourceCategory: "NON_RENEWABLE", quantity: 384000, sourceUnit: "KWH", normalizedValue: 1382.4, normalizedUnit: "GJ", vendor: "BESCOM", meterRef: "MTR-PVAN-33kV-01", validationStatus: "PASSED", calculationStatus: "COMPLETED", status: "APPROVED", enteredBy: rohitId } });
    const e2 = await db.energyRecord.create({ data: { projectId: pvagada.id, reportingPeriodId: april, module: "ENERGY", source: "Diesel (HSD)", sourceCategory: "NON_RENEWABLE", quantity: 18650, sourceUnit: "L", normalizedValue: 713.2, normalizedUnit: "GJ", vendor: "IOCL", meterRef: "DSE-PVAN-01", validationStatus: "PASSED", calculationStatus: "COMPLETED", status: "APPROVED", enteredBy: rohitId } });
    const e3 = await db.energyRecord.create({ data: { projectId: pvagada.id, reportingPeriodId: april, module: "ENERGY", source: "Solar PPA", sourceCategory: "RENEWABLE", quantity: 510000, sourceUnit: "KWH", normalizedValue: 1836, normalizedUnit: "GJ", vendor: "MEIL Solar", meterRef: "PPA-PVAN-01", validationStatus: "PASSED", calculationStatus: "COMPLETED", status: "APPROVED", enteredBy: rohitId } });
    const e4 = await db.energyRecord.create({ data: { projectId: pvagada.id, reportingPeriodId: may, module: "ENERGY", source: "Grid Electricity", sourceCategory: "NON_RENEWABLE", quantity: 412000, sourceUnit: "KWH", normalizedValue: 1483.2, normalizedUnit: "GJ", vendor: "BESCOM", meterRef: "MTR-PVAN-33kV-01", validationStatus: "PASSED", calculationStatus: "COMPLETED", status: "APPROVED", enteredBy: rohitId } });
    const e5 = await db.energyRecord.create({ data: { projectId: pvagada.id, reportingPeriodId: may, module: "ENERGY", source: "Diesel (HSD)", sourceCategory: "NON_RENEWABLE", quantity: 17200, sourceUnit: "L", normalizedValue: 657.8, normalizedUnit: "GJ", vendor: "IOCL", meterRef: "DSE-PVAN-01", validationStatus: "PASSED", calculationStatus: "COMPLETED", status: "APPROVED", enteredBy: rohitId } });
    const e6 = await db.energyRecord.create({ data: { projectId: pvagada.id, reportingPeriodId: june, module: "ENERGY", source: "Grid Electricity", sourceCategory: "NON_RENEWABLE", quantity: 398000, sourceUnit: "KWH", normalizedValue: 1432.8, normalizedUnit: "GJ", vendor: "BESCOM", meterRef: "MTR-PVAN-33kV-01", validationStatus: "PASSED", calculationStatus: "COMPLETED", status: "DRAFT", enteredBy: rohitId } });

    await db.calculationResult.createMany({
      data: [
        { recordType: "ENERGY", recordId: e1.id, energyRecordId: e1.id, factorId: factorIds["Grid Electricity (India)"], factorVersion: 1, sourceValue: 384000, sourceUnit: "KWH", normalizedValue: 1382.4, normalizedUnit: "GJ", calculatedValue: 274.94, resultUnit: "tCO2e", scope: "SCOPE_2", methodologyNote: "Grid factor 0.716 kgCO2e/kWh" },
        { recordType: "ENERGY", recordId: e2.id, energyRecordId: e2.id, factorId: factorIds["Diesel (HSD)"], factorVersion: 1, sourceValue: 18650, sourceUnit: "L", normalizedValue: 713.2, normalizedUnit: "GJ", calculatedValue: 49.18, resultUnit: "tCO2e", scope: "SCOPE_1", methodologyNote: "Diesel factor 2.637 kgCO2e/L" },
        { recordType: "ENERGY", recordId: e3.id, energyRecordId: e3.id, factorId: factorIds["Renewable PPA Solar"], factorVersion: 1, sourceValue: 510000, sourceUnit: "KWH", normalizedValue: 1836, normalizedUnit: "GJ", calculatedValue: 20.4, resultUnit: "tCO2e", scope: "SCOPE_2", methodologyNote: "Solar PPA 0.04 kgCO2e/kWh" },
        { recordType: "ENERGY", recordId: e4.id, energyRecordId: e4.id, factorId: factorIds["Grid Electricity (India)"], factorVersion: 1, sourceValue: 412000, sourceUnit: "KWH", normalizedValue: 1483.2, normalizedUnit: "GJ", calculatedValue: 294.99, resultUnit: "tCO2e", scope: "SCOPE_2", methodologyNote: "Grid factor 0.716 kgCO2e/kWh" },
        { recordType: "ENERGY", recordId: e5.id, energyRecordId: e5.id, factorId: factorIds["Diesel (HSD)"], factorVersion: 1, sourceValue: 17200, sourceUnit: "L", normalizedValue: 657.8, normalizedUnit: "GJ", calculatedValue: 45.36, resultUnit: "tCO2e", scope: "SCOPE_1", methodologyNote: "Diesel factor 2.637 kgCO2e/L" },
        { recordType: "ENERGY", recordId: e6.id, energyRecordId: e6.id, factorId: factorIds["Grid Electricity (India)"], factorVersion: 1, sourceValue: 398000, sourceUnit: "KWH", normalizedValue: 1432.8, normalizedUnit: "GJ", calculatedValue: 284.97, resultUnit: "tCO2e", scope: "SCOPE_2", methodologyNote: "Grid factor 0.716 kgCO2e/kWh" },
      ],
    });

    // Water — Pavagada April/May (ZLD active)
    await db.waterRecord.create({ data: { projectId: pvagada.id, reportingPeriodId: april, module: "WATER", source: "Ground Water", withdrawal: 4200, consumption: 1260, discharge: 800, recycledReused: 2140, treatment: "STP", destination: "Irrigation", sourceUnit: "KL", waterStress: true, zldActive: true, validationStatus: "PASSED", status: "APPROVED", enteredBy: rohitId } });
    await db.waterRecord.create({ data: { projectId: pvagada.id, reportingPeriodId: may, module: "WATER", source: "Ground Water", withdrawal: 4600, consumption: 1380, discharge: 900, recycledReused: 2320, treatment: "STP", destination: "Irrigation", sourceUnit: "KL", waterStress: true, zldActive: true, validationStatus: "PASSED", status: "APPROVED", enteredBy: rohitId } });

    // Waste — Pavagada April
    await db.wasteRecord.create({ data: { projectId: pvagada.id, reportingPeriodId: april, module: "WASTE", wasteType: "E-waste", hazardous: true, generatedQty: 0.8, recoveredQty: 0.75, recycledQty: 0.75, reusedQty: 0, disposedQty: 0.05, disposalRoute: "Authorised Recycler", vendor: "Ecoreco", manifestRef: "EWM-PVAN-04-01", sourceUnit: "TON", validationStatus: "PASSED", status: "APPROVED", enteredBy: rohitId } });
    await db.wasteRecord.create({ data: { projectId: pvagada.id, reportingPeriodId: april, module: "WASTE", wasteType: "DG Oil Sludge", hazardous: true, generatedQty: 1.2, recoveredQty: 0.9, recycledQty: 0.9, reusedQty: 0, disposedQty: 0.3, disposalRoute: "TSDF", vendor: "Ramky", manifestRef: "EWM-PVAN-04-02", sourceUnit: "TON", validationStatus: "PASSED", status: "APPROVED", enteredBy: rohitId } });
    await db.wasteRecord.create({ data: { projectId: pvagada.id, reportingPeriodId: april, module: "WASTE", wasteType: "Solar Panel Scrap", hazardous: false, generatedQty: 2.4, recoveredQty: 2.3, recycledQty: 2.3, reusedQty: 0, disposedQty: 0.1, disposalRoute: "Recycler", vendor: "Renewsys", manifestRef: "EWM-PVAN-04-03", sourceUnit: "TON", validationStatus: "PASSED", status: "APPROVED", enteredBy: rohitId } });

    // Workforce — Pavagada April
    await db.workforceRecord.create({ data: { projectId: pvagada.id, reportingPeriodId: april, module: "PEOPLE", category: "EMPLOYEE", permanent: 42, nonPermanent: 8, male: 38, female: 12, other: 0, differentlyAbled: 1, newHires: 2, exits: 1, trainingHours: 312, validationStatus: "PASSED", status: "APPROVED", enteredBy: rohitId } });
    await db.workforceRecord.create({ data: { projectId: pvagada.id, reportingPeriodId: april, module: "PEOPLE", category: "WORKER", permanent: 18, nonPermanent: 34, male: 48, female: 4, other: 0, differentlyAbled: 0, trainingHours: 184, validationStatus: "PASSED", status: "APPROVED", enteredBy: rohitId } });

    // Safety — Pavagada April
    await db.safetyRecord.create({ data: { projectId: pvagada.id, reportingPeriodId: april, module: "SAFETY", recordType: "INCIDENT", fatalities: 0, injuries: 1, lostTimeIncidents: 0, recordableInjuries: 1, highConsequenceIncidents: 0, trainingHours: 96, safetyHours: 28800, manHoursWorked: 48600, correctiveActions: "Toolbox talk + PPE audit", validationStatus: "PASSED", status: "APPROVED", enteredBy: rohitId } });

    // Evidence — real downloadable files in public/evidence-uploads
    const evDir = path.join(process.cwd(), "public", "evidence-uploads");
    fs.mkdirSync(evDir, { recursive: true });
    const makeEvidenceFile = (name: string, rows: string[]) => {
      const fp = path.join(evDir, name);
      if (!fs.existsSync(fp)) fs.writeFileSync(fp, rows.join("\n"), "utf8");
      return `/evidence-uploads/${name}`;
    };
    const gridBillPath = makeEvidenceFile("seed-pvan-grid-bill-apr2026.csv", [
      "date, meter_ref, reading_kwh, invoice_no, vendor",
      "2026-04-05, MTR-PVAN-33kV-01, 96200, BESCOM/APR/00121, BESCOM",
      "2026-04-15, MTR-PVAN-33kV-01, 141850, BESCOM/APR/00188, BESCOM",
      "2026-04-25, MTR-PVAN-33kV-01, 384000, BESCOM/APR/00244, BESCOM",
    ]);
    const dieselRegPath = makeEvidenceFile("seed-pvan-diesel-register-apr2026.csv", [
      "date, equipment, qty_l, odometer, signed_by",
      "2026-04-03, DG-01, 4200, 128400, R. Kumar",
      "2026-04-17, DG-02, 7450, 88110, R. Kumar",
      "2026-04-29, DG-01, 7000, 131220, R. Kumar",
    ]);

    const ev1 = await db.evidence.create({ data: { fileName: "PVAN-Grid-Bill-Apr2026.csv", documentType: "INVOICE", documentDate: new Date("2026-04-30"), reportingPeriodId: april, projectId: pvagada.id, module: "ENERGY", sourceRecordId: e1.id, uploaderId: rohitId, filePath: gridBillPath, fileSize: 284, mimeType: "text/csv", hash: "sha256:seed:grid-bill-apr", version: 1, status: "VERIFIED", verifiedBy: rohitId, verifiedAt: new Date("2026-05-06") } });
    const ev2 = await db.evidence.create({ data: { fileName: "PVAN-Diesel-Register-Apr2026.csv", documentType: "REGISTER", documentDate: new Date("2026-04-30"), reportingPeriodId: april, projectId: pvagada.id, module: "ENERGY", sourceRecordId: e2.id, uploaderId: rohitId, filePath: dieselRegPath, fileSize: 196, mimeType: "text/csv", hash: "sha256:seed:diesel-reg-apr", version: 1, status: "VERIFIED", verifiedBy: rohitId, verifiedAt: new Date("2026-05-06") } });
    await db.evidence.create({ data: { fileName: "PVAN-Water-STP-Apr2026.csv", documentType: "REGISTER", documentDate: new Date("2026-04-30"), reportingPeriodId: april, projectId: pvagada.id, module: "WATER", uploaderId: rohitId, filePath: gridBillPath, fileSize: 158, mimeType: "text/csv", hash: "sha256:seed:water-stp-apr", version: 1, status: "UNDER_REVIEW" } });

    await db.energyRecord.update({ where: { id: e1.id }, data: { evidenceId: ev1.id } });
    await db.energyRecord.update({ where: { id: e2.id }, data: { evidenceId: ev2.id } });

    // Submission — Pavagada April ENERGY (approved)
    const sub = await db.soSubmission.create({ data: { projectId: pvagada.id, reportingPeriodId: april, module: "ENERGY", title: "Pavagada Solar Park — Energy April 2026", status: "APPROVED", recordIds: JSON.stringify([e1.id, e2.id, e3.id]), completionPct: 100, evidenceCount: 2, validationPassed: 3, validationErrors: 0, submittedBy: rohitId, submittedAt: new Date("2026-05-03") } });
    await db.submissionStatusHistory.create({ data: { submissionId: sub.id, fromStatus: "DRAFT", toStatus: "SUBMITTED", actorId: rohitId, actorName: "Rohit Kumar", actorRole: "Environment Data User", action: "SUBMIT", comment: "April energy data submitted with evidence", createdAt: new Date("2026-05-03T10:00:00Z") } });
    await db.submissionStatusHistory.create({ data: { submissionId: sub.id, fromStatus: "SUBMITTED", toStatus: "APPROVED", actorId: rohitId, actorName: "Rohit Kumar", actorRole: "Environment Data User", action: "APPROVE", comment: "Approved after BU review", createdAt: new Date("2026-05-06T11:00:00Z") } });

    // Audit trail
    await db.soAuditLog.createMany({
      data: [
        { actorId: rohitId, actorName: "Rohit Kumar", actorRole: "Environment Data User", action: "CREATE", entityType: "EnergyRecord", entityId: e1.id, newState: JSON.stringify({ quantity: 384000, source: "Grid Electricity", status: "DRAFT" }), reason: "April grid electricity entry", createdAt: new Date("2026-05-02T08:20:00Z") },
        { actorId: rohitId, actorName: "Rohit Kumar", actorRole: "Environment Data User", action: "EVIDENCE_UPLOAD", entityType: "Evidence", entityId: ev1.id, newState: JSON.stringify({ fileName: "PVAN-Grid-Bill-Apr2026.csv" }), reason: "Evidence attached to grid record", createdAt: new Date("2026-05-02T08:45:00Z") },
        { actorId: rohitId, actorName: "Rohit Kumar", actorRole: "Environment Data User", action: "CALCULATION", entityType: "EnergyRecord", entityId: e1.id, newState: JSON.stringify({ calculatedValue: 274.94, scope: "SCOPE_2", factorVersion: 1 }), reason: "Emission calculation: 384000 kWh * 0.716", createdAt: new Date("2026-05-02T09:00:00Z") },
        { actorId: rohitId, actorName: "Rohit Kumar", actorRole: "Environment Data User", action: "SUBMIT", entityType: "SoSubmission", entityId: sub.id, newState: JSON.stringify({ status: "SUBMITTED" }), reason: "Energy module submission April 2026", createdAt: new Date("2026-05-03T10:00:00Z") },
        { actorId: rohitId, actorName: "Rohit Kumar", actorRole: "Environment Data User", action: "EVIDENCE_VERIFY", entityType: "Evidence", entityId: ev1.id, newState: JSON.stringify({ status: "VERIFIED" }), reason: "Grid bill verified against meter reading", createdAt: new Date("2026-05-06T11:00:00Z") },
      ],
    });

    // Activity feed
    await db.activity.createMany({
      data: [
        { projectId: pvagada.id, actorId: rohitId, actorName: "Rohit Kumar", actorRole: "Site Officer", action: "DATA_ENTRY", title: "HSD Fuel Log Submitted", description: "Batch #HMR-01 (18,650 L) logged for DG Heavy Fleet", module: "ENERGY", status: "SUBMITTED", createdAt: new Date("2026-05-03T10:00:00Z") },
        { projectId: pvagada.id, actorId: rohitId, actorName: "Rohit Kumar", actorRole: "Site Officer", action: "APPROVE", title: "Grid Power Log Verified", description: "384,000 kWh verified against BESCOM invoice", module: "ENERGY", status: "APPROVED", createdAt: new Date("2026-05-06T11:30:00Z") },
        { projectId: pvagada.id, actorId: rohitId, actorName: "Rohit Kumar", actorRole: "Site Officer", action: "EVIDENCE_UPLOAD", title: "STP Water Log Draft Saved", description: "Water STP register uploaded, awaiting validation", module: "WATER", status: "DRAFT", createdAt: new Date("2026-05-04T14:20:00Z") },
        { projectId: pvagada.id, actorId: venkatId, actorName: "K. Venkat", actorRole: "Plant Mech", action: "CALCULATION", title: "Emission Calculation Completed", description: "Scope 1+2 = 344.5 tCO2e computed for April", module: "ENERGY", status: "COMPLETED", createdAt: new Date("2026-05-05T16:45:00Z") },
      ],
    });

    // Notifications
    await db.soNotification.createMany({
      data: [
        { userId: rohitId, type: "SUBMISSION_DUE", title: "June 2026 submission due", message: "Energy data for June 2026 is due by 30 Jun.", severity: "WARNING", read: false, linkEntity: "PROJECT", linkId: pvagada.id, createdAt: new Date("2026-06-25T09:00:00Z") },
        { userId: venkatId, type: "ANOMALY_DETECTED", title: "Diesel consumption spike", message: "May diesel usage 8% below April — within range.", severity: "INFO", read: true, createdAt: new Date("2026-06-02T08:00:00Z") },
      ],
    });

    // BRSR answers for April (source-mapped ones approved)
    const allQs = await db.brsrQuestion.findMany({ where: { frameworkId: fw.id } });
    for (const q of allQs) {
      const srcMapped = !!q.mappingSource && (q.mappingSource.includes("ENERGY") || q.mappingSource.includes("WATER") || q.mappingSource.includes("WASTE") || q.mappingSource.includes("WORKFORCE") || q.mappingSource.includes("SAFETY"));
      await db.brsrAnswer.create({
        data: {
          frameworkId: fw.id,
          questionId: q.id,
          projectId: pvagada.id,
          reportingPeriodId: april,
          answerValue: q.mappingSource ?? null,
          sourceType: srcMapped ? "CONSOLIDATED_KPI" : "MANUAL",
          status: srcMapped ? "APPROVED" : "MISSING",
          readinessWeight: 1,
        },
      });
    }

    // One generated BRSR preview report
    await db.report.create({ data: { reportType: "BRSR", frameworkId: fw.id, reportingYear: 2026, periodLabel: "April 2026", scopeType: "PROJECT", scopeId: pvagada.id, scopeName: "Pavagada Solar Park", generatedBy: rohitId, generatedByName: "Rohit Kumar", status: "COMPLETED", fileName: "BRSR-Pavagada-Apr2026-preview.pdf", fileType: "PDF", content: "BRSR report content (illustrative)", version: 1 } });

    /* ── 6. Level-records JSON store (Data Entry module) ─────────────────── */
    const storePath = path.join(process.cwd(), "prisma", "level-records-store.json");
    if (!fs.existsSync(storePath)) {
      const mk = (o: object) => JSON.stringify(o);
      const levelRecords = [
        {
          id: "rec-l1-seed-grid", level: 1, levelKey: "level1", levelName: "Direct Energy — Stationary & Mobile", module: "ENERGY",
          projectId: pvagada.id, reportingPeriodId: april,
          data: mk({ source: "Grid Electricity", sourceCategory: "NON_RENEWABLE", quantity: 384000, unit: "KWH", vendor: "BESCOM", meterRef: "MTR-PVAN-33kV-01" }),
          evidenceId: ev1.id, validationStatus: "PASSED", calculationStatus: "COMPUTED",
          calculation: { calculatedValue: 274.94, resultUnit: "tCO2e", scope: "SCOPE_2", methodologyNote: "Grid factor 0.716 kgCO2e/kWh", sourceValue: 384000, sourceUnit: "KWH" },
          issues: [], status: "APPROVED", revisionNumber: 1, enteredBy: rohitId,
          enteredAt: new Date("2026-05-02T08:20:00Z").toISOString(), updatedAt: new Date("2026-05-06T11:00:00Z").toISOString(),
        },
        {
          id: "rec-l1-seed-diesel", level: 1, levelKey: "level1", levelName: "Direct Energy — Stationary & Mobile", module: "ENERGY",
          projectId: pvagada.id, reportingPeriodId: april,
          data: mk({ source: "Diesel (HSD)", sourceCategory: "NON_RENEWABLE", quantity: 18650, unit: "L", vendor: "IOCL", meterRef: "DSE-PVAN-01" }),
          evidenceId: ev2.id, validationStatus: "PASSED", calculationStatus: "COMPUTED",
          calculation: { calculatedValue: 49.18, resultUnit: "tCO2e", scope: "SCOPE_1", methodologyNote: "Diesel factor 2.637 kgCO2e/L", sourceValue: 18650, sourceUnit: "L" },
          issues: [], status: "APPROVED", revisionNumber: 1, enteredBy: rohitId,
          enteredAt: new Date("2026-05-02T09:10:00Z").toISOString(), updatedAt: new Date("2026-05-06T11:00:00Z").toISOString(),
        },
        {
          id: "rec-l2-seed-water", level: 2, levelKey: "level2", levelName: "Water Withdrawal & Discharge", module: "WATER",
          projectId: pvagada.id, reportingPeriodId: april,
          data: mk({ source: "Ground Water", withdrawal: 4200, consumption: 1260, discharge: 800, recycledReused: 2140, unit: "KL", zldActive: true }),
          evidenceId: null, validationStatus: "PASSED", calculationStatus: "NOT_APPLICABLE", calculation: null,
          issues: [], status: "APPROVED", revisionNumber: 1, enteredBy: rohitId,
          enteredAt: new Date("2026-05-04T14:20:00Z").toISOString(), updatedAt: new Date("2026-05-06T11:00:00Z").toISOString(),
        },
        {
          id: "rec-l3-seed-ewaste", level: 3, levelKey: "level3", levelName: "Waste Generated & Managed", module: "WASTE",
          projectId: pvagada.id, reportingPeriodId: april,
          data: mk({ wasteType: "E-waste", hazardous: true, generatedQty: 0.8, recoveredQty: 0.75, disposedQty: 0.05, unit: "TON", vendor: "Ecoreco", manifestRef: "EWM-PVAN-04-01" }),
          evidenceId: null, validationStatus: "PASSED", calculationStatus: "NOT_APPLICABLE", calculation: null,
          issues: [], status: "APPROVED", revisionNumber: 1, enteredBy: rohitId,
          enteredAt: new Date("2026-05-04T15:05:00Z").toISOString(), updatedAt: new Date("2026-05-06T11:00:00Z").toISOString(),
        },
      ];
      fs.writeFileSync(storePath, JSON.stringify(levelRecords, null, 2), "utf8");
    }
  }

  console.log("✅ Site Operations seed complete.");
  console.log("   Portal credentials (gateway → Project User Portal):");
  for (const u of userDefs) console.log(`   · ${u.employeeId}  ${u.name} (${u.role})  —  Esg@2025`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
