import "dotenv/config";
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const BASE = "http://localhost:3000";
const jar: Record<string, string> = {};
const MARK = 'FLOW-' + Date.now().toString(36).toUpperCase();

async function login(email: string, role: string, projectId?: string, extra?: Record<string, string>) {
  const body: any = { portal: extra?.portal || 'project', role, employeeId: email, password: 'demo' };
  if (projectId) body.projectId = projectId;
  if (extra?.subsidiaryId) body.subsidiaryId = extra.subsidiaryId;
  if (extra?.businessUnitId) body.businessUnitId = extra.businessUnitId;
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  for (const c of res.headers.getSetCookie?.() || []) {
    const [pair] = c.split(";");
    const [k, ...v] = pair.split("=");
    jar[email] = `${k}=${v.join("=")}`;
  }
  if (!res.ok) {
    console.log('  login FAIL', email, res.status, (await res.text()).slice(0, 120));
    return false;
  }
  return true;
}

async function post(email: string, path: string, body: any) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: jar[email] },
    body: JSON.stringify(body),
  });
  const j: any = await res.json().catch(() => ({}));
  return { status: res.status, j };
}

async function get(email: string, path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { Cookie: jar[email] } });
  const j: any = await res.json().catch(() => ({}));
  return { status: res.status, j };
}

async function main() {
  // Resolve org entities
  const users = await db.user.findMany({
    where: { email: { in: ['kvenkat@meil-esg.in', 'imran@meil-esg.in', 'priya@meil-esg.in', 'deepika@meil-esg.in', 'sunita@meil-esg.in', 'finance@meil-esg.in', 'rohit@meil-esg.in', 'harish.chandra@meil.in', 'rama.rao@meil.in', 'arun.bhaskar@meil.in'] } },
    select: { email: true, role: true, projectId: true, businessUnitId: true, subsidiaryId: true },
  });
  const U = Object.fromEntries(users.map(u => [u.email, u]));

  const siteUsers = [
    { email: 'kvenkat@meil-esg.in', role: 'EHS_USER', level: 5, levelName: 'Safety Incidents (EHS-5)', module: 'SAFETY', data: { incidentType: 'Near Miss ' + MARK } },
    { email: 'imran@meil-esg.in', role: 'CSR_USER', level: 1, levelName: 'CSR Project Master (CSR-1)', module: 'CSR', data: { projectName: MARK + ' Water' } },
    { email: 'priya@meil-esg.in', role: 'PROCUREMENT_USER', level: 3, levelName: 'Supplier ESG Assessments (SC-3)', module: 'PROCUREMENT', data: { supplierName: MARK + ' Vendor' } },
    { email: 'deepika@meil-esg.in', role: 'COMPLIANCE_USER', level: 1, levelName: 'Policy Register (GOV-1)', module: 'COMPLIANCE', data: { policyName: MARK + ' Policy' } },
    { email: 'sunita@meil-esg.in', role: 'HR_USER', level: 6, levelName: 'BRSR Workforce Package (HR)', module: 'WORKFORCE', data: { workforceCensus: { permanentEmployees: 50 } } },
    { email: 'finance@meil-esg.in', role: 'FIN_RESOURCE_USER', level: 9, levelName: 'BRSR Finance & Resource Expenditures', module: 'FINANCE', data: { reportingPeriodValue: 42 } },
    { email: 'rohit@meil-esg.in', role: 'ENV_DATA_USER', level: 1, levelName: 'Energy Consumption (ENV-1)', module: 'ENERGY', data: { activityInitiativeName: MARK + ' Grid' } },
  ];

  console.log('══ STEP 1: SITE USERS SUBMIT ══');
  const submittedIds: string[] = [];
  for (const c of siteUsers) {
    const u = U[c.email];
    const ok = await login(c.email, c.role, u.projectId || undefined);
    if (!ok) { console.log('✗ login ' + c.email); continue; }
    const r = await post(c.email, '/api/pu/data-entry', {
      level: c.level, levelKey: 'level' + c.level, levelName: c.levelName + ' ' + MARK,
      module: c.module, data: { ...c.data, remarks: 'escalation flow test' }, submitForReview: true,
    });
    const mirror = await db.submission.findFirst({
      where: { title: { contains: MARK }, category: { in: ['ENVIRONMENT', 'FINANCE', 'WORKFORCE', 'CSR', 'PROCUREMENT', 'COMPLIANCE', 'SAFETY'] } },
      orderBy: { updatedAt: 'desc' }, select: { id: true, category: true, status: true },
    });
    // find the specific one just created
    const latest = await db.submission.findFirst({
      where: { updatedAt: { gte: new Date(Date.now() - 15000) }, submittedById: u.id },
      orderBy: { updatedAt: 'desc' }, select: { id: true, category: true, status: true, title: true },
    });
    console.log((r.status === 200 ? '✓' : '✗') + ' ' + c.role.padEnd(18) + ' mirror: ' + (latest ? latest.id.slice(-6) + ' ' + latest.status : 'NONE'));
    if (latest) submittedIds.push(latest.id);
  }

  console.log('\n══ STEP 2: PROJECT ADMIN APPROVES (collection-status approve) ══');
  await login('projectadmin@meil-esg.in', 'PROJECT_ADMIN', U['rohit@meil-esg.in'].projectId || undefined);
  let paBroken = false;
  for (const id of submittedIds) {
    const r = await post('projectadmin@meil-esg.in', '/api/project-admin/collection-status', { action: 'approve', submissionId: id, comments: 'PA approved ' + MARK });
    const row = await db.submission.findUnique({ where: { id }, select: { status: true } });
    console.log((r.status === 200 ? '✓' : '✗') + ' PA approve ' + id.slice(-6) + ' → status: ' + row?.status);
    if (row?.status !== 'APPROVED') paBroken = true;
  }

  console.log('\n══ STEP 3: PA SENDS CONSOLIDATED REPORT TO BU MANAGER ══');
  // Check the consolidated-report endpoint
  const cr = await get('projectadmin@meil-esg.in', '/api/project-admin/consolidated-report');
  console.log('GET consolidated-report:', cr.status, Object.keys(cr.j?.data || cr.j || {}).slice(0, 6).join(','));
  const crPost = await post('projectadmin@meil-esg.in', '/api/project-admin/consolidated-report', { action: 'submit_to_bu', mark: MARK });
  console.log('POST consolidated-report submit_to_bu:', crPost.status, JSON.stringify(crPost.j).slice(0, 150));

  console.log('\n══ STEP 4: BU MANAGER REVIEWS & APPROVES ══');
  const bu = U['harish.chandra@meil.in'];
  const buLogin = await login('harish.chandra@meil.in', 'BU_MANAGER', undefined, { portal: 'business_unit', subsidiaryId: bu.subsidiaryId || undefined, businessUnitId: bu.businessUnitId || undefined });
  if (buLogin) {
    // BU manager views submissions via /api/pu/submissions
    const subs = await get('harish.chandra@meil.in', '/api/pu/submissions?take=50&bypass=true');
    console.log('BU submissions view:', subs.status, '| items:', (subs.j?.items || []).length);
    // BU approves each via state machine
    for (const id of submittedIds) {
      const row = await db.submission.findUnique({ where: { id }, select: { status: true } });
      if (row?.status === 'APPROVED') {
        // Mismatch: state machine expects BU_APPROVED
        const adv = await post('harish.chandra@meil.in', `/api/pu/submissions/${id}/approve`, { comment: 'BU approved ' + MARK });
        const after = await db.submission.findUnique({ where: { id }, select: { status: true } });
        console.log((adv.status === 200 ? '✓' : '✗') + ' BU approve ' + id.slice(-6) + ' (from APPROVED) → ' + after?.status + (adv.status !== 200 ? ' | ' + (adv.j?.error || '') : ''));
      } else {
        const adv = await post('harish.chandra@meil.in', `/api/pu/submissions/${id}/approve`, { comment: 'BU approved ' + MARK });
        const after = await db.submission.findUnique({ where: { id }, select: { status: true } });
        console.log((adv.status === 200 ? '✓' : '✗') + ' BU approve ' + id.slice(-6) + ' (from ' + row?.status + ') → ' + after?.status);
      }
    }
  }

  console.log('\n══ STEP 5: SUBSIDIARY MANAGER VALIDATES & APPROVES ══');
  const sub = U['rama.rao@meil.in'];
  const subLogin = await login('rama.rao@meil.in', 'SUBSIDIARY_MANAGER', undefined, { portal: 'subsidiary', subsidiaryId: sub.subsidiaryId || undefined });
  if (subLogin) {
    for (const id of submittedIds) {
      const adv = await post('rama.rao@meil.in', `/api/pu/submissions/${id}/approve`, { comment: 'Subsidiary validated ' + MARK });
      const after = await db.submission.findUnique({ where: { id }, select: { status: true } });
      console.log((adv.status === 200 ? '✓' : '✗') + ' SUB approve ' + id.slice(-6) + ' → ' + after?.status + (adv.status !== 200 ? ' | ' + (adv.j?.error || '') : ''));
    }
  }

  console.log('\n══ STEP 6: GROUP ADMIN RECEIVES (HQ_REVIEW → LOCK) ══');
  const grp = U['arun.bhaskar@meil.in'];
  const grpLogin = await login('arun.bhaskar@meil.in', 'GROUP_ADMIN', undefined, { portal: 'group' });
  if (grpLogin) {
    for (const id of submittedIds.slice(0, 2)) {
      const adv = await post('arun.bhaskar@meil.in', `/api/pu/submissions/${id}/approve`, { comment: 'HQ reviewed ' + MARK });
      const after = await db.submission.findUnique({ where: { id }, select: { status: true } });
      console.log((adv.status === 200 ? '✓' : '✗') + ' HQ advance ' + id.slice(-6) + ' → ' + after?.status);
      if (after?.status === 'LOCKED') continue;
      const lock = await post('arun.bhaskar@meil.in', `/api/pu/submissions/${id}/lock`, { comment: 'Locked for BRSR audit' });
      const locked = await db.submission.findUnique({ where: { id }, select: { status: true } });
      console.log((lock.status === 200 ? '✓' : '✗') + ' HQ lock ' + id.slice(-6) + ' → ' + locked?.status);
    }
  }

  console.log('\n=== FINAL STATE OF ALL ESCALATED SUBMISSIONS ===');
  for (const id of submittedIds) {
    const row = await db.submission.findUnique({ where: { id }, select: { status: true, category: true } });
    console.log(id.slice(-6), '|', row?.category, '|', row?.status);
  }
}

main().then(() => db.$disconnect()).catch(e => { console.error(e); db.$disconnect(); process.exit(1); });
