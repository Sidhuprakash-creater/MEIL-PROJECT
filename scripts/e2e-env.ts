/* E2E: env user submits grid electricity (Level 1) + 30 tCO2e (Level 3)
   → pending only → PA approves → headline KPIs show real data. */
import crypto from "crypto";
import { db } from "../src/lib/db";

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
  return { status: res.status, json, text: text.slice(0, 400) };
}

(async () => {
  const envUser = await db.user.findFirst({ where: { email: "env.user@meil.com" } });
  if (!envUser?.projectId) throw new Error("env user / project missing");
  const project = await db.project.findUnique({ where: { id: envUser.projectId }, include: { businessUnit: true } });
  const period = await db.reportingPeriod.findFirst({ where: { status: "OPEN" }, orderBy: { startDate: "desc" } });
  if (!project || !period) throw new Error("project/period missing");
  const envCookie = cookieFor(envUser.id);
  console.log("ENV:", envUser.name, "| PROJECT:", project.code, project.id, "| PERIOD:", period.periodLabel, period.id);

  /* ── 1. submit ── */
  const kWh = 1000 / 0.0036; // 1000 GJ of grid electricity
  const gridTco2e = +(kWh * 0.716 / 1000).toFixed(2); // CEA v20
  const k = `l1-${project.id}-${period.id}`;
  const k3 = `l3-${project.id}-${period.id}`;
  const submit = await api("/api/pu/data-entry/submit-all", {
    method: "POST",
    body: JSON.stringify({
      projectId: project.id,
      reportingPeriodId: period.id,
      allData: {
        [k]: { items: [{ energySource: "Grid electricity (CEA v20)", emissionDataType: "Scope 2", consumptionQuantity: +kWh.toFixed(2), unit: "kWh", estGj: 1000, estTco2e: gridTco2e }] },
        [k3]: { items: [{ emissionDataType: "Scope 1", emissionSource: "Stationary combustion - diesel DG", sourceCategory: "stationary_combustion", activityQuantity: 30, unit: "tCO2e", estTco2e: 30 }] },
      },
    }),
  }, envCookie);
  console.log("\nSUBMIT:", submit.status, JSON.stringify(submit.json?.submitted?.map((s: any) => s.module) || submit.json || submit.text).slice(0, 300));

  /* ── 2. overview BEFORE approval ── */
  const before = await api("/api/pu/overview", {}, envCookie);
  const bk = before.json?.kpis || {};
  console.log("\nBEFORE APPROVAL kpis:", JSON.stringify({
    emissions: bk.totalEmissions ?? bk.emissions, gridGJ: bk.gridElectricityGJ, energy: bk.totalEnergyGJ,
    pendingEmissions: bk.pendingEmissions, pendingEnergyGJ: bk.pendingEnergyGJ, pendingRecords: bk.pendingRecords, approvedRecords: bk.approvedRecords,
  }));

  /* ── 3. PA approves all SUBMITTED submissions for this project+period ── */
  const paUser = await db.user.findFirst({ where: { role: "PROJECT_ADMIN", projectId: project.id } });
  if (!paUser) throw new Error("no project admin for " + project.code);
  const paCookie = cookieFor(paUser.id);
  const subs = await db.submission.findMany({ where: { projectId: project.id, reportingPeriodId: period.id, status: { in: ["SUBMITTED", "PENDING", "DRAFT"] } } });
  for (const s of subs) {
    const r = await api("/api/project-admin/submissions", {
      method: "POST",
      body: JSON.stringify({ action: "approve", submissionId: s.id }),
    }, paCookie);
    console.log(`APPROVE ${s.module}:`, r.status, r.json?.ok === false ? JSON.stringify(r.json || r.text) : "ok");
  }

  /* ── 4. overview AFTER approval ── */
  const after = await api("/api/pu/overview", {}, envCookie);
  const ak = after.json?.kpis || {};
  console.log("\nAFTER APPROVAL kpis:", JSON.stringify({
    emissions: ak.totalEmissions ?? ak.emissions, scope1: ak.scope1, scope2: ak.scope2, gridGJ: ak.gridElectricityGJ, gridTco2e: ak.gridElectricityTco2e,
    energy: ak.totalEnergyGJ ?? ak.energyGJ, pendingEmissions: ak.pendingEmissions, pendingRecords: ak.pendingRecords, approvedRecords: ak.approvedRecords,
  }));
  console.log("\ntrends:", JSON.stringify(after.json?.trends || {}).slice(0, 500));

  const expectedEmissions = +(30 + gridTco2e).toFixed(2);
  const gotEmissions = +(ak.totalEmissions ?? ak.emissions ?? 0);
  console.log(`\nCHECK: expected emissions ${expectedEmissions} (30 direct + ${gridTco2e} grid) — got ${gotEmissions}: ${Math.abs(gotEmissions - expectedEmissions) < 0.05 ? "PASS ✅" : "FAIL ❌"}`);
  process.exit(0);
})().catch((e) => { console.error("E2E ERROR:", e); process.exit(1); });
