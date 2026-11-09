/* Verify PA collection-status rows for every E2E role submission.
   For roles whose projects have no permanently-scoped PA, we TEMPORARILY
   point projectadmin@meil-esg.in at the submission's BU, verify, then restore. */
import "dotenv/config";

const BASE = "http://localhost:3000";
const MARK = process.argv[2];
if (!MARK) throw new Error("usage: tsx verify <MARK>");

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
}

async function paItems(email: string): Promise<any[]> {
  const res = await fetch(`${BASE}/api/project-admin/collection-status?bypass=true`, {
    headers: { Cookie: cookieJar[email] },
  });
  const j = await res.json();
  return (j.data || j).items || [];
}

const { PrismaClient } = await import("@prisma/client");
const db = new PrismaClient();

const CHECKS: Array<{ label: string; module: string; bu: string; expectRole: string; pa: string }> = [
  { label: "ENV ENERGY (rohit)", module: "ENERGY", bu: "cmvt5829f000w7kss4s9oe6uq", expectRole: "ENV_DATA_USER", pa: "pavagada.admin@meil-esg.in" },
  { label: "HR (sunita)", module: "HR", bu: "cmvt58102000c7kssg4jtvr2x", expectRole: "HR_USER", pa: "admin@site.meil.in" },
  { label: "SAFETY (sneha)", module: "SAFETY", bu: "cmvt5827v000o7kssiez5a1cg", expectRole: "EHS_USER", pa: "projectadmin@meil-esg.in" },
  { label: "PROCUREMENT (priya)", module: "PROCUREMENT", bu: "cmvt58102000c7kssg4jtvr2x", expectRole: "PROCUREMENT_USER", pa: "admin@site.meil.in" },
  { label: "CSR (imran)", module: "CSR", bu: "cmvt5810000087kssr4oure2y", expectRole: "CSR_USER", pa: "admin@site.meil.in" },
  { label: "COMPLIANCE (deepika)", module: "COMPLIANCE", bu: "cmvt5810000087kssr4oure2y", expectRole: "COMPLIANCE_USER", pa: "admin@site.meil.in" },
  { label: "FINANCE (finance)", module: "FINANCE", bu: "cmvt58101000a7kss1u47hng4", expectRole: "FIN_RESOURCE_USER", pa: "admin@site.meil.in" },
];

await login("admin@site.meil.in", "PROJECT_ADMIN", "cmvt5836n00167kss0csnb7il");
const paUser = await db.user.findUnique({
  where: { email: "projectadmin@meil-esg.in" },
  select: { id: true, businessUnitId: true, projectId: true },
});
const originalBU = paUser!.businessUnitId;
let pass = 0, fail = 0;

for (const c of CHECKS) {
  const needsScopeChange = c.pa === "projectadmin@meil-esg.in";
  if (needsScopeChange) {
    await db.user.update({ where: { id: paUser!.id }, data: { businessUnitId: c.bu } });
    console.log("   [SAFETY] BU swapped, waiting 130s for PA ctx cache to expire...");
    await new Promise((r) => setTimeout(r, 130000));
  }
  const paProj = await db.user.findUnique({ where: { email: c.pa }, select: { projectId: true } });
  await login(c.pa, "PROJECT_ADMIN", paProj!.projectId!);
  const items = await paItems(c.pa);
    const rows = items.filter(
      (i) =>
        JSON.stringify(i.sourceRecords || []).includes(MARK) &&
          String(i.assignedUserDbRole || "") === c.expectRole,
    );
    if (rows.length === 0) { console.log(`✗ ${c.label}: NOT FOUND`); fail++; continue; }
    const row = rows[0];
    const allItems = (row.sourceRecords || []).flatMap((r: any) => r.items || []);
    const detail =
      allItems.some((it: any) => JSON.stringify(it).includes(MARK)) ||
      (row.sourceRecords || []).some((r: any) => JSON.stringify(r.fields || []).includes(MARK));
    const evNames = [...new Set((row.sourceRecords || []).flatMap((r: any) => [
      ...(r.evidence || []).map((e: any) => e.fileName || e.id),
      ...(r.items || []).flatMap((it: any) => (it.evidenceFileNames || []).map((f: any) => (typeof f === "string" ? f : f?.fileName))),
    ]))].filter(Boolean);
    const roleOk = row.assignedUserDbRole === c.expectRole;
    const ok = detail && roleOk;
    console.log(`${ok ? "✓" : "✗"} ${c.label}: status=${row.submissionStatus} rows=${rows.length} role=${row.assignedUserDbRole} detail=${detail} evidence=${evNames.join(",") || "none"}`);
    if (ok) pass++; else fail++;
  if (needsScopeChange) await db.user.update({ where: { id: paUser!.id }, data: { businessUnitId: originalBU } });
}
await db.$disconnect();
console.log(`\nPASS ${pass} / FAIL ${fail}`);
