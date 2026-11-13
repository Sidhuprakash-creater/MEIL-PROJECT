/* PRESENTATION SEED — prefilled demo data across contributor categories.
   · Wipes nothing itself — run scripts/wipe-reports-evidence.ts FIRST.
   · PRJ-KLIP  (Kaleshwaram): every category EXCEPT environment submits
     (EHS/HR/Compliance/CSR levels + finance/procurement rows).
   · PRJ-POLA  (Polavaram): EVERYTHING submits incl. environment levels 1-4.
   · Every OPEN period except the LAST is PA-APPROVED; the last period stays
     SUBMITTED (pending) so the presenter can demo the live approval flow. */
import { db } from "../src/lib/db";
import {
  ensureLevelRecordsLoaded,
  getLevelRecords,
  deleteLevelRecord,
  saveManyLevelRecords,
  updateLevelRecordStatus,
} from "../src/lib/pu/level-records";

const KLIP = "cmvt5836n00157kssab54g3lw";
const POLA = "cmvt5836n00187kssqlx68664";

/* per-project user handles (login handles are unique per project) */
const USERS: Record<string, { env?: string; ehs?: string; hr?: string; comp?: string; csr?: string; fin?: string; proc?: string; pa?: string }> = {
  [KLIP]: {
    ehs: "prakash.reddy.prjklip@meil.in",
    hr: "new.joiner.prjklip@meil.in",
    comp: "vinay.kumar.prjklip@meil.in",
    csr: "imran.prjklip@meil.in",
    fin: "anil.kumar.prjklip@meil.in",
    proc: "sravani.lakshmi.prjklip@meil.in",
    pa: "kaleshwaram.admin@meil.in",
  },
  [POLA]: {
    env: "ramesh.iyer.prjpola@meil.in",
    ehs: "prakash.reddy.prjpola@meil.in",
    hr: "new.joiner.prjpola@meil.in",
    comp: "vinay.kumar.prjpola@meil.in",
    csr: "imran.prjpola@meil.in",
    fin: "anil.kumar.prjpola@meil.in",
    proc: "sravani.lakshmi.prjpola@meil.in",
    pa: "prjpola.admin@meil.in",
  },
};

function monthData(i: number) {
  const gridGj = 760 + i * 52 + (i % 3) * 25;
  const gridKwh = +(gridGj / 0.0036).toFixed(2);
  const dieselL = 480 - i * 15 + (i % 2) * 35;
  const water = 1050 + i * 30;
  const recycled = Math.round(water * (0.56 + i * 0.014));
  return {
    l1: { items: [
      { energySource: "Grid electricity (CEA v20)", emissionDataType: "Scope 2", consumptionQuantity: gridKwh, unit: "kWh", estGj: gridGj, estTco2e: +((gridKwh * 0.716) / 1000).toFixed(2) },
      { energySource: "Diesel (DG backup)", emissionDataType: "Scope 1", consumptionQuantity: dieselL, unit: "Litres", estGj: +(dieselL * 0.038).toFixed(2), estTco2e: +((dieselL * 2.68) / 1000).toFixed(2) },
    ] },
    l2: { items: [
      { waterSource: "Groundwater", waterQuantity: Math.round(water * 0.64), unit: "kL", waterReusedRecycled: Math.round(recycled * 0.7) },
      { waterSource: "Surface water", waterQuantity: Math.round(water * 0.26), unit: "kL" },
      { waterSource: "Municipal supply", waterQuantity: Math.round(water * 0.1), unit: "kL", waterReusedRecycled: recycled - Math.round(recycled * 0.7) },
    ] },
    l3: { items: [
      { emissionDataType: "Scope 3", emissionSource: "Business travel - vehicles", sourceCategory: "mobile_combustion", activityQuantity: +(8 + i * 0.7).toFixed(2), unit: "tCO2e", estTco2e: +(8 + i * 0.7).toFixed(2) },
    ] },
    l4: { items: [
      { wasteCategory: "Non-hazardous - construction debris", quantityGenerated: +(22 + i * 1.4).toFixed(2), quantityRecycled: +(14 + i * 1.1).toFixed(2), unit: "MT" },
      { wasteCategory: "Hazardous - used oil", quantityGenerated: +(1.1 + i * 0.07).toFixed(2), quantityRecycled: +(0.85 + i * 0.05).toFixed(2), unit: "MT" },
    ] },
    l5: { items: [
      { title: "Safety toolbox talks", count: 20 + i, unit: "sessions" },
      { title: "PPE compliance inspections", count: 10 + (i % 4), unit: "inspections" },
      { title: "Near-miss reports logged", count: 4 + (i % 3), unit: "reports" },
    ] },
    l6: { items: [
      { trainingName: "ESG & BRSR awareness", hours: 90 + i * 6 },
      { trainingName: "Site safety induction", hours: 60 + i * 4 },
      { trainingName: "Technical skill upskilling", hours: 40 + i * 3 },
    ] },
    l7: { items: [
      { permitConsentType: "Consent to Operate (CTO)", permitNumber: "CTO/TS/2026/114", permitStatus: "VALID" },
      { permitConsentType: "Water abstraction permit (CGWA)", permitNumber: "CGWA/TS/2026/088", permitStatus: "VALID" },
      { permitConsentType: "Hazardous waste authorisation", permitNumber: "HWA/TS/2026/041", permitStatus: "RENEWAL DUE" },
    ] },
    l8: { items: [
      { incidentType: "Minor spill (contained on site)", count: i % 2 },
      { incidentType: "Community grievances received", count: 1 + (i % 2) },
    ] },
    l9: { items: [
      { title: "Pump efficiency upgrade", physicalOutputQuantity: 1 + (i % 2), unit: "projects" },
      { title: "Solar envelope expansion", physicalOutputQuantity: i % 2, unit: "projects" },
      { title: "Community tree plantation drive", physicalOutputQuantity: 2 + (i % 3), unit: "drives" },
    ] },
  };
}

const LEVEL_DEFS: Record<number, { moduleKey: string; category: string; name: string }> = {
  1: { moduleKey: "ENERGY", category: "ENERGY", name: "Level 1 — Energy Consumption" },
  2: { moduleKey: "WATER", category: "WATER", name: "Level 2 — Water Management" },
  3: { moduleKey: "EMISSIONS", category: "EMISSIONS", name: "Level 3 — GHG Emissions & Air Quality" },
  4: { moduleKey: "WASTE", category: "WASTE", name: "Level 4 — Waste Management" },
  5: { moduleKey: "SAFETY", category: "SAFETY", name: "Level 5 — Health & Safety" },
  6: { moduleKey: "TRAINING", category: "WORKFORCE", name: "Level 6 — Training & Workforce Well-being" },
  7: { moduleKey: "COMPLIANCE", category: "COMPLIANCE", name: "Level 7 — Environmental Permits & Compliance" },
  8: { moduleKey: "INCIDENTS", category: "SAFETY", name: "Level 8 — Environmental Incidents & Grievances" },
  9: { moduleKey: "INITIATIVES", category: "CSR", name: "Level 9 — Energy & Environmental Initiatives" },
};

function metricFor(level: number, data: any): { metricName: string; metricValue: number; metricUnit: string; values: any[] } {
  const items: any[] = Array.isArray(data?.items) ? data.items : [];
  const fmt = (v: any) => (Number.isFinite(Number(v)) ? Number(v).toLocaleString() : String(v ?? ""));
  let metricName = "Data Points", metricValue = 0, metricUnit = "";
  const values: any[] = [];
  for (const it of items) {
    if (level === 1) { metricName = "Total Energy Consumption"; metricUnit = "GJ"; values.push({ label: it.energySource, value: fmt(it.consumptionQuantity), unit: it.unit }); if (it.estTco2e > 0) values.push({ label: `${it.energySource} — Est. GHG`, value: Number(it.estTco2e).toFixed(2), unit: "tCO2e" }); metricValue += Number(it.estGj) || 0; }
    else if (level === 2) { metricName = "Total Water Withdrawal"; metricUnit = "kL"; values.push({ label: it.waterSource, value: fmt(it.waterQuantity), unit: "kL" }); if (it.waterReusedRecycled > 0) values.push({ label: `${it.waterSource} — Reused/Recycled`, value: fmt(it.waterReusedRecycled), unit: "kL" }); metricValue += Number(it.waterQuantity) || 0; }
    else if (level === 3) { metricName = "GHG Footprint (Scope 1+2)"; metricUnit = "tCO2e"; values.push({ label: `${String(it.emissionDataType || "").includes("3") ? "Scope 3" : "Air / Monitoring"} — ${it.emissionSource}`, value: Number(it.estTco2e || 0).toFixed(2), unit: "tCO2e" }); if (String(it.emissionDataType).includes("1") || String(it.emissionDataType).includes("2")) metricValue += Number(it.estTco2e) || 0; }
    else if (level === 4) { metricName = "Total Waste Generated"; metricUnit = "MT"; values.push({ label: it.wasteCategory, value: fmt(it.quantityGenerated), unit: "MT" }); metricValue += Number(it.quantityGenerated) || 0; }
    else if (level === 7) { metricName = "Permits & Regulatory Approvals"; metricUnit = "permits"; values.push({ label: it.permitConsentType, value: it.permitNumber, unit: it.permitStatus }); metricValue += 1; }
    else if (level === 9) { metricName = "Energy Conservation Initiatives"; metricUnit = "programs"; values.push({ label: it.title, value: it.physicalOutputQuantity, unit: it.unit }); metricValue += 1; }
    else { const label = it.title || it.trainingName || it.incidentType || "Entry"; const value = it.count ?? it.hours ?? "—"; values.push({ label, value: fmt(value), unit: it.unit || "" }); metricValue += Number(value) || 0; }
  }
  return { metricName, metricValue: +metricValue.toFixed(2), metricUnit, values };
}

(async () => {
  const periods = await db.reportingPeriod.findMany({ where: { status: "OPEN" }, orderBy: { startDate: "asc" } });
  const lastPeriod = periods[periods.length - 1];
  console.log("periods:", periods.length, "| pending-for-demo:", lastPeriod.periodLabel);
  await ensureLevelRecordsLoaded();

  /* clean every previous submission + level record (both projects) */
  await db.submission.deleteMany({ where: { projectId: { in: [KLIP, POLA] } } });
  for (const pid of [KLIP, POLA]) for (const r of getLevelRecords(pid)) deleteLevelRecord(r.id);

  const dueDate = new Date(Date.now() + 30 * 86400000);

  for (const projectId of [KLIP, POLA]) {
    const u = USERS[projectId];
    const project = await db.project.findUnique({ where: { id: projectId }, include: { businessUnit: { include: { subsidiary: true } } } });
    const userByEmail = new Map<string, any>();
    for (const [k, email] of Object.entries(u)) {
      if (!email) continue;
      const found = await db.user.findFirst({ where: { email } });
      userByEmail.set(k, found);
    }
    const pa = userByEmail.get("pa");
    const buId = project!.businessUnitId;
    const subId = project!.businessUnit?.subsidiaryId;
    console.log(`\n=== ${project!.code} ${project!.name} ===`);

    /* which levels each project submits */
    const plan: Array<{ level: number; userKey: string }> = [];
    if (u.env) plan.push({ level: 1, userKey: "env" }, { level: 2, userKey: "env" }, { level: 3, userKey: "env" }, { level: 4, userKey: "env" });
    plan.push({ level: 5, userKey: "ehs" }, { level: 6, userKey: "hr" }, { level: 7, userKey: "comp" }, { level: 8, userKey: "ehs" }, { level: 9, userKey: "csr" });

    for (let i = 0; i < periods.length; i++) {
      const p = periods[i];
      const approved = p.id !== lastPeriod.id;
      const d = monthData(i);
      const nameOf = (k: string) => userByEmail.get(k)?.name || "Contributor";

      /* level-record submissions (one per level, as the RIGHT user) */
      for (const { level, userKey } of plan) {
        const user = userByEmail.get(userKey);
        if (!user) continue;
        const def = LEVEL_DEFS[level];
        const data = (d as any)[`l${level}`];
        const saved = saveManyLevelRecords([{
          level,
          levelKey: `level${level}`,
          levelName: def.name,
          module: def.moduleKey,
          projectId,
          reportingPeriodId: p.id,
          status: approved ? "ACTIVE" : "SUBMITTED",
          validationStatus: "PASSED",
          calculationStatus: "COMPUTED",
          data,
          enteredBy: `${nameOf(userKey)} (${user.role})`,
        }]);
        const rec = saved[0];
        if (approved) updateLevelRecordStatus(rec.id, "ACTIVE");
        const m = metricFor(level, data);
        await db.submission.create({
          data: {
            ref: `SUB-${project!.code}-${p.periodLabel.replace(/\s/g, "").slice(0, 6)}-L${level}-${i}`,
            title: `${project!.name} — ${def.name} (${p.periodLabel})`,
            category: def.category,
            module: def.moduleKey,
            metricName: m.metricName,
            metricValue: m.metricValue,
            metricUnit: m.metricUnit,
            status: approved ? "APPROVED" : "SUBMITTED",
            overdue: false,
            period: "FY 2025-26",
            fiscalQuarter: "Q1",
            dueDate,
            submittedAt: new Date(now2(i)),
            reviewedAt: approved ? new Date(now2(i) + 3600000) : null,
            reviewerId: approved ? pa?.id ?? null : null,
            reviewComment: approved ? "Approved by Project Admin with complete data verification." : null,
            subsidiaryId: subId,
            businessUnitId: buId,
            projectId,
            submittedById: user.id,
            values: JSON.stringify(m.values),
            recordIds: JSON.stringify([rec.id]),
            reportingPeriodId: p.id,
            completionPct: 100,
            evidenceCount: 0,
            validationPassed: 1,
            validationErrors: 0,
            history: JSON.stringify([
              { action: "Submitted", actor: nameOf(userKey), at: new Date(now2(i)).toISOString() },
              ...(approved ? [{ action: `Approved by ${pa?.name} (Project Admin)`, actor: pa?.name, at: new Date(now2(i) + 3600000).toISOString() }] : []),
            ]),
          },
        });
      }

      /* finance & procurement — direct submission rows (no level records) */
      for (const [key, def] of [["fin", { cat: "FINANCE", name: "Finance & Resource Contribution" }], ["proc", { cat: "PROCUREMENT", name: "Procurement & Supply-chain Contribution" }]] as const) {
        const user = userByEmail.get(key);
        if (!user) continue;
        const values = key === "fin"
          ? [{ label: "Environmental CapEx", value: (4.2 + i * 0.3).toFixed(1) + " Cr", unit: "INR" }, { label: "Sustainable procurement spend share", value: (28 + i).toFixed(0) + "%", unit: "%" }, { label: "Green vendor onboarding", value: String(3 + (i % 3)), unit: "vendors" }]
          : [{ label: "Vendors screened for ESG compliance", value: String(18 + i), unit: "vendors" }, { label: "Local hiring spend share", value: (62 + i).toFixed(0) + "%", unit: "%" }];
        await db.submission.create({
          data: {
            ref: `SUB-${project!.code}-${p.periodLabel.replace(/\s/g, "").slice(0, 6)}-${key.toUpperCase()}-${i}`,
            title: `${project!.name} — ${def.name} (${p.periodLabel})`,
            category: def.cat,
            module: key === "fin" ? "TRAVEL" : "TRAVEL",
            metricName: key === "fin" ? "Environmental expenditure" : "ESG-screened vendors",
            metricValue: key === "fin" ? 4.2 + i * 0.3 : 18 + i,
            metricUnit: key === "fin" ? "Cr INR" : "vendors",
            status: approved ? "APPROVED" : "SUBMITTED",
            period: "FY 2025-26",
            fiscalQuarter: "Q1",
            dueDate,
            submittedAt: new Date(now2(i)),
            reviewedAt: approved ? new Date(now2(i) + 3600000) : null,
            reviewerId: approved ? pa?.id ?? null : null,
            reviewComment: approved ? "Approved by Project Admin with complete data verification." : null,
            subsidiaryId: subId,
            businessUnitId: buId,
            projectId,
            submittedById: user.id,
            values: JSON.stringify(values),
            reportingPeriodId: p.id,
            completionPct: 100,
            evidenceCount: 0,
            validationPassed: 1,
            history: JSON.stringify([
              { action: "Submitted", actor: nameOf(key), at: new Date(now2(i)).toISOString() },
              ...(approved ? [{ action: `Approved by ${pa?.name} (Project Admin)`, actor: pa?.name, at: new Date(now2(i) + 3600000).toISOString() }] : []),
            ]),
          },
        });
      }
      console.log(`  ${p.periodLabel}: ${approved ? "APPROVED" : "PENDING (live demo)"}`);
    }
  }

  const klipSubs = await db.submission.count({ where: { projectId: KLIP } });
  const polaSubs = await db.submission.count({ where: { projectId: POLA } });
  console.log(`\nDONE — KLIP submissions: ${klipSubs}, POLA submissions: ${polaSubs}`);
  process.exit(0);
})().catch((e) => { console.error("SEED ERROR:", e); process.exit(1); });

/* helper — stagger timestamps per period so history ordering is stable */
function now2(i: number): number {
  return Date.now() - (60 - i) * 86400000;
}
