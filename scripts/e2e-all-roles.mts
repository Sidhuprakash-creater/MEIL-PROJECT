/* One-off E2E test: submit fresh data from EVERY site-ops role with evidence,
   then verify PA collection-status shows each with real details. */
import "dotenv/config";

const BASE = "http://localhost:3000";
const PERIOD = "cmvt6ag9q00087kxwvb2pkxhx"; // June 2026
const MARK = `E2E-${Date.now().toString(36)}`;

const cookieJar: Record<string, string> = {};

async function login(email: string, role: string, projectId: string): Promise<void> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ portal: "project", role, employeeId: email, password: "demo", projectId }),
  });
  const setCookie = res.headers.getSetCookie?.() || [];
  for (const c of setCookie) {
    const [pair] = c.split(";");
    const [k, v] = pair.split("=");
    cookieJar[email] = (cookieJar[email] ? cookieJar[email] + "; " : "") + `${k}=${v}`;
  }
  if (!res.ok) throw new Error(`login failed for ${email}: ${await res.text()}`);
}

async function api(email: string, path: string, body?: unknown): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", Cookie: cookieJar[email] },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

// A real evidence row id to attach (any project — API doesn't scope-check)
const { PrismaClient } = await import("@prisma/client");
const db = new PrismaClient();
const ev = await db.evidence.findFirst({ select: { id: true, fileName: true } });
const EVID = ev!.id;
console.log("evidence:", ev!.fileName);

const ROLES: Array<{ email: string; role: string; projectId: string; module: string; level: number; data: Record<string, unknown> }> = [
  { email: "rohit@meil-esg.in", role: "ENV_DATA_USER", projectId: "cmvt5842u002c7kssl8jciq2c", module: "ENERGY", level: 1,
    data: { items: [{ energySource: `Diesel E2E ${MARK}`, emissionDataType: "Scope 1", energyActivity: "Generator", consumptionQuantity: 555, unit: "litres" }], consumptionQuantity: 555, unit: "litres" } },
  { email: "sunita@meil-esg.in", role: "HR_USER", projectId: "cmvt5836n00167kss0csnb7il", module: "HR", level: 6,
    data: { trainingProgramme: `Safety Training E2E ${MARK}`, participants: 77, duration: 12, durationUnit: "Hours" } },
  { email: "sneha.kulkarni@meil.in", role: "EHS_USER", projectId: "cmvt5843v002q7kss3etabcc9", module: "SAFETY", level: 5,
    data: { incidentType: `Incident Drill E2E ${MARK}`, severity: "Minor", personHoursWorked: 99000, lostTimeInjuries: 0 } },
  { email: "priya@meil-esg.in", role: "PROCUREMENT_USER", projectId: "cmvt5836n001a7ksspy772hsr", module: "PROCUREMENT", level: 9,
    data: { activityInitiativeName: `Green Procurement E2E ${MARK}`, suppliersAssessed: 25, greenSpendPct: 41 } },
  { email: "imran@meil-esg.in", role: "CSR_USER", projectId: "cmvt5836n00157kssab54g3lw", module: "CSR", level: 8,
    data: { description: `Community Program E2E ${MARK}`, beneficiaries: 850, currentStatus: "Ongoing" } },
  { email: "deepika@meil-esg.in", role: "COMPLIANCE_USER", projectId: "cmvt5836n00187kssqlx68664", module: "COMPLIANCE", level: 7,
    data: { permitNumber: `CTO-E2E-${MARK}`, authority: "SPCB", complianceStatus: "Fully Compliant" } },
  { email: "finance@meil-esg.in", role: "FIN_RESOURCE_USER", projectId: "cmvt5836o001f7ksssq1ngm1s", module: "FINANCE", level: 9,
    data: { statement: `Finance E2E ${MARK}`, revenueCr: 1200, envCapexCr: 85 } },
];

const mirrorIds: Array<{ email: string; module: string; mirrorId: string; soId: string; projectId: string }> = [];

for (const r of ROLES) {
  await login(r.email, r.role, r.projectId);
  const res = await api(r.email, "/api/so/data-entry", {
    level: r.level, levelKey: `level${r.level}`, levelName: `Level ${r.level} — E2E`, module: r.module,
    projectId: r.projectId, reportingPeriodId: PERIOD, data: r.data,
    evidenceIds: [EVID], submitForReview: true,
  });
  const recId = res?.record?.id;
  console.log(`${r.module}: submit ok=${!!recId} rec=${recId || JSON.stringify(res).slice(0, 120)}`);
  if (!recId) continue;
  const so = await db.soSubmission.findFirst({ where: { recordIds: { contains: recId } }, select: { id: true } });
  const mir = await db.submission.findFirst({ where: { recordIds: { contains: recId } }, select: { id: true, category: true } });
  mirrorIds.push({ email: r.email, module: r.module, mirrorId: mir!.id, soId: so!.id, projectId: r.projectId });
  console.log(`   so=${so!.id.slice(-6)} mirror=${mir!.id.slice(-6)} category=${mir!.category}`);
}
await db.$disconnect();
console.log("MARK:", MARK);
console.log(JSON.stringify(mirrorIds));
