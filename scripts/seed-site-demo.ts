/* Seed realistic prefilled site data for the env user's project so the demo
   dashboards are populated instantly:
   · every OPEN period except the LAST one  → submitted + PA APPROVED
   · the LAST open period                   → left SUBMITTED (pending) so the
     presenter can walk through the live Project-Admin approval flow. */
import crypto from "crypto";
import { db } from "../src/lib/db";
import { ensureLevelRecordsLoaded, getLevelRecords, deleteLevelRecord } from "../src/lib/pu/level-records";

const BASE = "http://localhost:3111";
const SECRET = process.env.SESSION_SECRET || "meil-esg-illustrative-secret-change-in-prod";

function cookieFor(userId: string) {
  const sig = crypto.createHash("sha256").update(userId + SECRET).digest("hex").slice(0, 32);
  return `meil_pu_session=${Buffer.from(userId).toString("base64")}.${sig}`;
}

async function api(path: string, init: any = {}, cookie = "") {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { "Content-Type": "application/json", Cookie: cookie, ...(init.headers || {}) },
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text) } catch {}
  return { status: res.status, json, text: text.slice(0, 300) };
}

/* Monthly profile — a Himalayan lift-irrigation package: heavy grid draw,
   diesel DG backup, growing rooftop solar, decent water circularity. */
function monthData(i: number, label: string) {
  const gridGj = 820 + i * 55 + (i % 3) * 30;          // monsoon dip / summer peak
  const gridKwh = +(gridGj / 0.0036).toFixed(2);
  const gridTco2e = +(gridKwh * 0.716 / 1000).toFixed(2);
  const dieselL = 520 - i * 18 + (i % 2) * 40;         // DG backup trending down
  const solarGj = 60 + i * 22;                          // PV expansion over the year
  const water = 1180 + i * 35;
  const recycled = Math.round(water * (0.58 + i * 0.015));
  return {
    l1: { items: [
      { energySource: "Grid electricity (CEA v20)", emissionDataType: "Scope 2", consumptionQuantity: gridKwh, unit: "kWh", estGj: gridGj, estTco2e: gridTco2e },
      { energySource: "Diesel (DG backup)", emissionDataType: "Scope 1", consumptionQuantity: dieselL, unit: "Litres", estGj: +(dieselL * 0.038).toFixed(2), estTco2e: +((dieselL * 2.68) / 1000).toFixed(2) },
      { energySource: "Rooftop solar PV", emissionDataType: "Scope 2 - Renewable", consumptionQuantity: +(solarGj / 0.0036).toFixed(2), unit: "kWh", estGj: solarGj, estTco2e: 0 },
    ] },
    l2: { items: [
      { waterSource: "Groundwater", waterQuantity: Math.round(water * 0.62), unit: "kL", waterReusedRecycled: Math.round(recycled * 0.7) },
      { waterSource: "Surface water", waterQuantity: Math.round(water * 0.28), unit: "kL", waterReusedRecycled: 0 },
      { waterSource: "Municipal supply", waterQuantity: Math.round(water * 0.1), unit: "kL", waterReusedRecycled: recycled - Math.round(recycled * 0.7) },
    ] },
    l3: { items: [
      { emissionDataType: "Scope 3", emissionSource: "Business travel - vehicles", sourceCategory: "mobile_combustion", activityQuantity: +(9 + i * 0.8).toFixed(2), unit: "tCO2e", estTco2e: +(9 + i * 0.8).toFixed(2) },
    ] },
    l4: { items: [
      { wasteCategory: "Non-hazardous - construction debris", quantityGenerated: +(24 + i * 1.6).toFixed(2), quantityRecycled: +(15 + i * 1.2).toFixed(2), unit: "MT" },
      { wasteCategory: "Hazardous - used oil", quantityGenerated: +(1.2 + i * 0.08).toFixed(2), quantityRecycled: +(0.9 + i * 0.06).toFixed(2), unit: "MT" },
    ] },
  };
}

(async () => {
  const envUser = await db.user.findFirst({ where: { email: "env.user@meil.com" } });
  if (!envUser?.projectId) throw new Error("env user missing");
  const project = await db.project.findUnique({ where: { id: envUser.projectId } });
  const periods = await db.reportingPeriod.findMany({ where: { status: "OPEN" }, orderBy: { startDate: "asc" } });
  const envCookie = cookieFor(envUser.id);
  const paUser = await db.user.findFirst({ where: { role: "PROJECT_ADMIN", projectId: project!.id } });
  const paCookie = paUser ? cookieFor(paUser.id) : "";
  console.log("SEED:", project!.code, "| periods:", periods.length, "| PA:", paUser?.name || "NONE");

  /* 0. clean this project's old demo records/submissions (idempotent seed) */
  await db.submission.deleteMany({ where: { projectId: project!.id } });
  await ensureLevelRecordsLoaded();
  for (const r of getLevelRecords(project!.id)) deleteLevelRecord(r.id);
  console.log("cleaned old project submissions + level records");

  /* 1. submit every period */
  for (let i = 0; i < periods.length; i++) {
    const p = periods[i];
    const d = monthData(i, p.periodLabel);
    const allData: Record<string, any> = {};
    allData[`l1-${project!.id}-${p.id}`] = d.l1;
    allData[`l2-${project!.id}-${p.id}`] = d.l2;
    allData[`l3-${project!.id}-${p.id}`] = d.l3;
    allData[`l4-${project!.id}-${p.id}`] = d.l4;
    const r = await api("/api/pu/data-entry/submit-all", {
      method: "POST",
      body: JSON.stringify({ projectId: project!.id, reportingPeriodId: p.id, allData }),
    }, envCookie);
    console.log(`submit ${p.periodLabel}:`, r.status, r.json?.ok === false ? JSON.stringify(r.json || r.text) : `ok (${r.json?.submittedCount} levels)`);
  }

  /* 2. approve every period except the last (keep that pending for the live demo) */
  for (let i = 0; i < periods.length - 1; i++) {
    const p = periods[i];
    const subs = await db.submission.findMany({ where: { projectId: project!.id, reportingPeriodId: p.id, status: { in: ["SUBMITTED", "PENDING", "DRAFT"] } } });
    for (const s of subs) {
      const r = await api("/api/project-admin/submissions", { method: "POST", body: JSON.stringify({ action: "approve", submissionId: s.id }) }, paCookie);
      if (r.json?.ok === false) console.log(`approve ${p.periodLabel} ${s.module}: FAIL`, r.json || r.text);
    }
    console.log(`approve ${p.periodLabel}: ${subs.length} submissions`);
  }

  /* 3. summary of the final dashboard numbers */
  const ov = await api("/api/pu/overview", {}, envCookie);
  console.log("\nDASHBOARD:", JSON.stringify(ov.json?.kpis || ov.text));
  const pendingPeriod = periods[periods.length - 1];
  const pend = await db.submission.findMany({ where: { projectId: project!.id, reportingPeriodId: pendingPeriod.id } });
  console.log(`PENDING for live demo: ${pendingPeriod.periodLabel} — ${pend.length} submissions`);
  process.exit(0);
})().catch((e) => { console.error("SEED ERROR:", e); process.exit(1); });
