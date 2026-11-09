import "dotenv/config";
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const BASE = "http://localhost:3000";
const jar: Record<string, string> = {};

async function login(email: string, role: string, projectId: string) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ portal: "project", role, employeeId: email, password: "demo", projectId }),
  });
  for (const c of res.headers.getSetCookie?.() || []) {
    const [pair] = c.split(";");
    const [k, ...v] = pair.split("=");
    jar[email] = `${k}=${v.join("=")}`;
  }
  return res.ok;
}

async function submit(email: string, level: number, levelName: string, module: string, data: any) {
  const res = await fetch(`${BASE}/api/pu/data-entry`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: jar[email] },
    body: JSON.stringify({
      level, levelKey: 'level' + level, levelName, module,
      projectId: undefined,
      data: { ...data, remarks: 'E2E all-roles verification test' },
      submitForReview: true,
    }),
  });
  const j: any = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, id: j?.submission?.id || j?.record?.id || null };
}

const MARK = 'E2E-' + Date.now().toString(36).toUpperCase();

// 1. Resolve each user's home project
const users = await db.user.findMany({
  where: { email: { in: ['kvenkat@meil-esg.in', 'imran@meil-esg.in', 'priya@meil-esg.in', 'deepika@meil-esg.in', 'sunita@meil-esg.in', 'finance@meil-esg.in', 'rohit@meil-esg.in'] } },
  select: { email: true, role: true, projectId: true, project: { select: { code: true } } },
});
const projBy = Object.fromEntries(users.map(u => [u.email, u.projectId || '']));

const CASES = [
  { email: 'kvenkat@meil-esg.in', role: 'EHS_USER', label: 'EHS', level: 5, levelName: 'Safety Incidents (EHS-5)', module: 'SAFETY', data: { incidentType: 'Near Miss', severity: 'Low', personHoursWorked: 154000, lostTimeInjuries: 0 } },
  { email: 'imran@meil-esg.in', role: 'CSR_USER', label: 'CSR', level: 1, levelName: 'CSR Project Master (CSR-1)', module: 'CSR', data: { projectName: MARK + ' Water Project', beneficiaries: 1200 } },
  { email: 'priya@meil-esg.in', role: 'PROCUREMENT_USER', label: 'PROC', level: 3, levelName: 'Supplier ESG Assessments (SC-3)', module: 'PROCUREMENT', data: { supplierName: MARK + ' Vendor', esgScore: 78 } },
  { email: 'deepika@meil-esg.in', role: 'COMPLIANCE_USER', label: 'COMPL', level: 1, levelName: 'Policy Register (GOV-1)', module: 'COMPLIANCE', data: { policyName: MARK + ' Anti-Bribery Policy', status: 'Board Approved' } },
  { email: 'sunita@meil-esg.in', role: 'HR_USER', label: 'HR', level: 6, levelName: 'BRSR Workforce Package (HR)', module: 'WORKFORCE', data: { workforceCensus: { permanentEmployees: 50 }, remarks: 'test' } },
  { email: 'finance@meil-esg.in', role: 'FIN_RESOURCE_USER', label: 'FIN', level: 9, levelName: 'BRSR Finance & Resource Expenditures', module: 'FINANCE', data: { activityInitiativeName: MARK + ' CapEx', reportingPeriodValue: 42 } },
  { email: 'rohit@meil-esg.in', role: 'ENV_DATA_USER', label: 'ENV', level: 1, levelName: 'Energy Consumption (ENV-1)', module: 'ENERGY', data: { activityInitiativeName: MARK + ' Grid Draw', remarks: 'test' } },
];

console.log('=== SUBMITTING AS EACH USER ===');
const results: any[] = [];
for (const c of CASES) {
  const ok = await login(c.email, c.role, projBy[c.email] || '');
  if (!ok) { console.log('✗ LOGIN FAIL:', c.email); results.push({ label: c.label, fail: 'login' }); continue; }
  const r = await submit(c.email, c.level, c.levelName + ' ' + MARK, c.module, c.data);
  console.log((r.ok ? '✓' : '✗') + ' ' + c.label.padEnd(6) + ' submit: HTTP ' + r.status + (r.id ? ' → ' + String(r.id).slice(-8) : ''));
  results.push({ label: c.label, ...r });
}

// 2. DB mirrors
console.log('\n=== DB MIRRORS (last 10 min, by category) ===');
const cutoff = new Date(Date.now() - 10 * 60 * 1000);
const mirrors = await db.submission.findMany({
  where: { updatedAt: { gte: cutoff } },
  orderBy: { updatedAt: 'desc' },
  select: { id: true, category: true, title: true, status: true },
});
const seen = new Set<string>();
for (const m of mirrors) {
  if (seen.has(m.category)) continue;
  seen.add(m.category);
  console.log('✓ ' + m.category.padEnd(14) + '| ' + m.status.padEnd(10) + '| ' + m.title?.slice(0, 55));
}
console.log('categories covered:', [...seen].length, 'of 7 expected (ENVIRONMENT, FINANCE, WORKFORCE, CSR, PROCUREMENT, COMPLIANCE, SAFETY)');

// 3. PA collection-status
const admin = await db.user.findUnique({ where: { email: 'projectadmin@meil-esg.in' }, select: { projectId: true } });
await login('projectadmin@meil-esg.in', 'PROJECT_ADMIN', admin!.projectId!);
const pa = await fetch(`${BASE}/api/project-admin/collection-status?bypass=true`, { headers: { Cookie: jar['projectadmin@meil-esg.in'] } });
const j: any = await pa.json();
const items = (j.data || j).items || [];
const byCat: Record<string, any> = {};
for (const i of items) byCat[i.category] = i;
console.log('\n=== PA COLLECTION-STATUS (per contributor category) ===');
const expected = ['ENV_DATA_USER', 'FIN_RESOURCE_USER', 'HR_USER', 'CSR_USER', 'PROCUREMENT_USER', 'COMPLIANCE_USER', 'EHS_USER'];
for (const cat of expected) {
  const rows = items.filter((i: any) => i.category === cat);
  const latest = rows.sort((a: any, b: any) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
  console.log((rows.length > 0 ? '✓' : '✗') + ' ' + cat.padEnd(20) + '| rows: ' + String(rows.length).padStart(3) + ' | latest: ' + (latest ? latest.submissionStatus : '—') + ' | ' + (latest ? latest.updatedAt : ''));
}
console.log('PA total items:', items.length);

// 4. Submissions screen API (per-user view)
console.log('\n=== SUBMISSIONS SCREEN API (/api/pu/submissions, per user) ===');
for (const c of CASES) {
  await login(c.email, c.role, projBy[c.email] || '');
  const s = await fetch(`${BASE}/api/pu/submissions?take=100&bypass=true`, { headers: { Cookie: jar[c.email] } });
  const sj: any = await s.json();
  const me = await db.user.findUnique({ where: { email: c.email }, select: { id: true } });
  const mine = (sj.items || []).filter((r: any) => r.submittedById === me?.id);
  console.log((mine.length > 0 ? '✓' : '✗') + ' ' + c.label.padEnd(6) + ' sees own rows: ' + mine.length);
}

await db.$disconnect();
