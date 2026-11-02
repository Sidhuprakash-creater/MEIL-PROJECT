#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   MEIL ESG Platform — full-flow backend E2E verification (Task 5)

   Exercises every cross-console sender→receiver contract over real HTTP:
     A. Auth matrix (5 consoles + role-mismatch + wrong-password refusals)
     B. Revision pulse (latency fix): fingerprint changes after a mutation
     C. Deadlines: SA → BA (subsidiary window) and BA → SA (project deadline)
     D. Tasks: BA → SA monitoring, Group → BM assigned-tasks
     E. Evidence: BA upload → byte-identical download → visible to SA + in
        the submission record; negative: bad type
     F. Submission send-flow: Group assigns → BA sees → BA submits → SM
        reviews (approve) → Group sees approved; scope isolation on BM;
        illegal transition + empty-values refusals
     G. Resubmit loop: SM rejects → BA resubmits → SUBMITTED again
     H. Package flow: SA submits package → Group consolidation sees it

   Run: node scripts/api-e2e.mjs   (dev server must be on :3000)
   Exit code 0 = all green. Demo rows created by the run are intentional.
   ═══════════════════════════════════════════════════════════════════════════ */

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
const PW = "Esg@2025";
const WTR = "cmvj98pe10003r548hpxo12ng"; // MEIL Water Systems Ltd
const WTRSUP = "cmvj98pe5000hr548isaw8cei"; // Water Supply BU
const DESAL = "cmvj98pe30007r548y1gtzck1"; // Desalination BU
const THERMAL = "cmvj98pe30005r548fauundd0"; // Thermal Generation BU
const ENR = "cmvj98pe00000r548j0hq218p"; // MEIL Energy Ltd

const results = [];
const cookies = {}; // name → cookie pair

function record(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function req(jar, path, { method = "GET", body, headers = {}, raw = false } = {}) {
  const h = { ...headers };
  if (body !== undefined && !(body instanceof FormData)) h["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Cookie: cookies[jar] ?? "", ...h },
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    redirect: "manual",
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  for (const c of setCookie) {
    const [pair] = c.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) cookies[jar] = pair; // last cookie wins (session cookie)
  }
  if (raw) return { res, buf: Buffer.from(await res.arrayBuffer()) };
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  return { res, json, text };
}

async function login(jar, payload) {
  const { res, json } = await req(jar, "/api/auth/login", { method: "POST", body: payload });
  return { status: res.status, ok: json?.ok === true, json };
}

const badge = (b) => Buffer.from(b, "base64");

/* ═══ A. AUTH ═══ */
async function authMatrix() {
  const g = await login("grp", { portal: "group", role: "GROUP_ADMIN", employeeId: "GRP-0001", password: PW });
  record("A1 group admin login", g.ok && g.status === 200, `status ${g.status}`);

  const sa = await login("sa", { portal: "subsidiary", role: "SUBSIDIARY_ADMIN", employeeId: "SUB-3002", password: PW, subsidiaryId: WTR });
  record("A2 subsidiary admin login (SUB-3002)", sa.ok, `status ${sa.status}`);

  const sm = await login("sm", { portal: "subsidiary", role: "SUBSIDIARY_MANAGER", employeeId: "SUB-3001", password: PW, subsidiaryId: WTR });
  record("A3 subsidiary manager login (SUB-3001)", sm.ok, `status ${sm.status}`);

  const ba = await login("ba", { portal: "business_unit", role: "BU_ADMIN", employeeId: "BU-3002", password: PW, subsidiaryId: WTR, businessUnitId: WTRSUP });
  record("A4 bu admin login (BU-3002/Water Supply)", ba.ok, `status ${ba.status}`);

  const bm = await login("bm", { portal: "business_unit", role: "BU_MANAGER", employeeId: "BU-3001", password: PW, subsidiaryId: WTR, businessUnitId: DESAL });
  record("A5 bu manager login (BU-3001/Desalination)", bm.ok, `status ${bm.status}`);

  const bad = await login("tmp", { portal: "business_unit", role: "BU_MANAGER", employeeId: "BU-3002", password: PW, subsidiaryId: WTR, businessUnitId: WTRSUP });
  record("A6 role mismatch refused", bad.status === 403 && bad.json?.code === "ROLE_MISMATCH", `status ${bad.status} code ${bad.json?.code}`);

  const badpw = await login("tmp", { portal: "group", role: "GROUP_ADMIN", employeeId: "GRP-0001", password: "wrong" });
  record("A7 wrong password refused", badpw.status === 401, `status ${badpw.status}`);
}

/* ═══ B. REVISION PULSE ═══ */
async function revisionBefore() {
  const t0 = Date.now();
  const { res, json } = await req("ba", "/api/revision");
  const ms = Date.now() - t0;
  record("B1 revision endpoint reachable + fast", res.status === 200 && typeof json?.rev === "string" && ms < 2000, `${res.status} ${ms}ms`);
  return json?.rev;
}

/* ═══ C. DEADLINES ═══ */
async function deadlineFlow() {
  const stamp = Date.now().toString(36);
  const due = new Date(Date.now() + 21 * 86400000).toISOString();

  const mk = await req("sa", "/api/sa/timelines", {
    method: "POST",
    body: { level: "SUBSIDIARY", orgId: WTR, name: `E2E Subsidiary Window ${stamp}`, period: "FY 2025-26", startDate: new Date().toISOString(), dueDate: due, categories: ["ENVIRONMENT"], inheritanceMode: "INHERIT", notify: true },
  });
  record("C1 SA creates subsidiary timeline", mk.res.status === 201 || mk.res.status === 200, `${mk.res.status} ${mk.json?.error ?? ""}`);

  const baList = await req("ba", `/api/ba/timelines?period=${encodeURIComponent("FY 2025-26")}`);
  const found = (baList.json?.timelines ?? []).some((t) => t.name === `E2E Subsidiary Window ${stamp}`);
  record("C2 BA sees SA deadline (receiver)", baList.res.status === 200 && found, `${(baList.json?.timelines ?? []).length} rows`);

  const prj = await req("ba", "/api/ba/projects");
  const projectId = (prj.json?.projects ?? [])[0]?.id;
  const mk2 = await req("ba", "/api/ba/timelines", {
    method: "POST",
    body: { level: "PROJECT", orgId: projectId, name: `E2E Project Deadline ${stamp}`, period: "FY 2025-26", startDate: new Date().toISOString(), dueDate: due, categories: ["ENVIRONMENT"], inheritanceMode: "OVERRIDE", overrideReason: "E2E verification deadline", notify: true },
  });
  record("C3 BA assigns project deadline", mk2.res.status === 201 || mk2.res.status === 200, `${mk2.res.status} ${mk2.json?.error ?? ""}`);

  const saList = await req("sa", `/api/sa/timelines?period=${encodeURIComponent("FY 2025-26")}`);
  const rows = saList.json?.timelines ?? [];
  const found2 = rows.some((t) => t.name === `E2E Project Deadline ${stamp}`);
  record("C4 SA sees BU-assigned project deadline (receiver)", saList.res.status === 200 && found2, `${rows.length} rows`);
}

/* ═══ D. TASKS ═══ */
async function taskFlow() {
  const stamp = Date.now().toString(36);
  const due = new Date(Date.now() + 10 * 86400000).toISOString();

  const users = await req("ba", "/api/ba/users");
  const uid = (users.json?.users ?? [])[0]?.id;
  const mk = await req("ba", "/api/ba/tasks", {
    method: "POST",
    body: { title: `E2E BA task ${stamp}`, description: "cross-console verification", category: "ENVIRONMENT", assigneeType: "USER", userIds: uid ? [uid] : [], dueDate: due, priority: "HIGH", requiresEvidence: true },
  });
  record("D1 BA assigns task", mk.res.status === 201 || mk.res.status === 200, `${mk.res.status} ${mk.json?.error ?? ""}`);

  const mon = await req("sa", "/api/sa/monitoring");
  const buTasks = mon.json?.buTasks ?? mon.json?.tasks ?? [];
  const found = buTasks.some((t) => t.title === `E2E BA task ${stamp}`);
  record("D2 SA monitoring shows BU task (receiver)", mon.res.status === 200 && found, `${buTasks.length} buTasks`);

  const gmk = await req("grp", "/api/esg/tasks", {
    method: "POST",
    body: { title: `E2E Desal review task ${stamp}`, description: "Group-assigned", category: "ENERGY", assigneeType: "BU", businessUnitId: DESAL, subsidiaryId: WTR, dueDate: due, priority: "MEDIUM", recipients: "1" },
  });
  record("D3 Group assigns BU-scoped task", gmk.res.status === 201 || gmk.res.status === 200, `${gmk.res.status} ${gmk.json?.error ?? ""}`);

  const bmTasks = await req("bm", "/api/bm/tasks");
  const at = bmTasks.json?.assignedTasks ?? [];
  const found2 = at.some((t) => t.title === `E2E Desal review task ${stamp}`);
  record("D4 BM sees task assigned to its BU (receiver)", bmTasks.res.status === 200 && found2, `${at.length} assignedTasks`);
}

/* ═══ E. EVIDENCE ═══ */
async function evidenceFlow() {
  const stamp = Date.now().toString(36);
  const subs = await req("ba", "/api/ba/submissions?pageSize=50&tab=all");
  const sub = (subs.json?.submissions ?? [])[0];
  record("E0 BA has an in-scope submission to attach to", !!sub, subs.json?.submissions?.length ?? 0);

  const pdf = badge(
    "JVBERi0xLjQKJcTl8uXrp/Og0MTGCjEgMCBvYmoKPDwvVHlwZS9DYXRhbG9nL1BhZ2VzIDIgMCBSPj4KZW5kb2JqCjIgMCBvYmoKPDwvVHlwZS9QYWdlcy9LaWRzWzMgMCBSXS9Db3VudCAxPj4KZW5kb2JqCjMgMCBvYmoKPDwvVHlwZS9QYWdlL01lZGlhQm94WzAgMCAyMDAgMjAwXS9QYXJlbnQgMiAwIFIvUmVzb3VyY2VzPDw+Pj5Db250ZW50czQgMCBSPj4KZW5kb2JqCjQgMCBvYmoKPDwvTGVuZ3RoIDQwPj4Kc3RyZWFtCkJUCi9GMSAxOCBUZgoyMCAxMDAgVGQKKEUyRSBFdmlkZW5jZSkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgNQowMDAwMDAwMDAwIDY1NTM1IGYKdHJhaWxlcjw8L1Jvb3QgMSAwIFI+Pgplbm9iago="
  );
  const fd = new FormData();
  fd.append("file", new Blob([pdf], { type: "application/pdf" }), `e2e-evidence-${stamp}.pdf`);
  if (sub) fd.append("submissionId", sub.id);
  const up = await req("ba", "/api/ba/evidence", { method: "POST", body: fd });
  record("E1 BA uploads real evidence file", up.res.status === 201, `${up.res.status} ${up.json?.error ?? ""}`);
  const docId = up.json?.doc?.id ?? up.json?.stored?.docId;

  if (docId) {
    const dl = await req("ba", `/api/ba/evidence/${docId}/download`, { raw: true });
    record("E2 download serves byte-identical original", dl.res.status === 200 && Buffer.compare(dl.buf, pdf) === 0, `${dl.res.status} ${dl.buf.length}B vs ${pdf.length}B`);
  }

  const saEv = await req("sa", "/api/sa/evidence?pageSize=50");
  const found = (saEv.json?.docs ?? []).some((d) => d.name === `e2e-evidence-${stamp}.pdf`);
  record("E3 SA evidence repository shows BA upload (receiver)", saEv.res.status === 200 && found, `${saEv.json?.docs?.length ?? 0} docs`);

  if (sub) {
    const det = await req("ba", `/api/ba/submissions/${sub.id}`);
    const names = det.json?.submission?.evidence ?? [];
    record("E4 submission record lists the evidence", names.includes(`e2e-evidence-${stamp}.pdf`), names.join(", "));
  }

  const fd2 = new FormData();
  fd2.append("file", new Blob([Buffer.from("not allowed")], { type: "text/plain" }), `e2e-bad-${stamp}.txt`);
  const bad = await req("ba", "/api/ba/evidence", { method: "POST", body: fd2 });
  record("E5 bad file type refused", bad.res.status === 400, `${bad.res.status} ${bad.json?.error ?? ""}`);
}

/* ═══ F. SUBMISSION SEND FLOW ═══ */
async function submissionFlow() {
  const stamp = Date.now().toString(36);
  const title = `E2E Water duty ${stamp}`;

  const mk = await req("grp", "/api/esg/submissions", {
    method: "POST",
    body: { action: "create", assign: true, title, category: "WATER", metricName: "Treated water output", period: "FY 2025-26", dueDate: new Date(Date.now() + 14 * 86400000).toISOString(), subsidiaryId: WTR, businessUnitId: WTRSUP },
  });
  record("F1 Group assigns reporting duty to BU", mk.res.status === 201 && mk.json?.submission?.status === "ASSIGNED", `${mk.res.status} ${mk.json?.error ?? ""}`);
  const id = mk.json?.submission?.id;

  const baList = await req("ba", "/api/ba/submissions?pageSize=50&tab=all");
  const seen = (baList.json?.submissions ?? []).some((s) => s.id === id);
  record("F2 BA sees the assigned duty (receiver)", baList.res.status === 200 && seen, "");

  const empty = await req("ba", `/api/ba/submissions/${id}`, { method: "POST", body: { action: "submit", values: [] } });
  record("F3 submit without values refused", empty.res.status === 400, `${empty.res.status}`);

  const draft = await req("ba", `/api/ba/submissions/${id}`, { method: "POST", body: { action: "save_draft", values: [{ label: "Raw water intake", value: 111, unit: "ML" }] } });
  record("F4 save_draft persists values, status unchanged", draft.res.status === 200 && ["DRAFT", "ASSIGNED"].includes(draft.json?.submission?.status), `${draft.res.status} ${draft.json?.submission?.status ?? draft.json?.error ?? ""}`);

  const sub = await req("ba", `/api/ba/submissions/${id}`, {
    method: "POST",
    body: { action: "submit", values: [{ label: "Raw water intake", value: 1234, unit: "ML" }, { label: "Treated output", value: 1180, unit: "ML" }], comment: "E2E submission" },
  });
  record("F5 BA submits data → SUBMITTED", sub.res.status === 200 && sub.json?.submission?.status === "SUBMITTED", `${sub.res.status} ${sub.json?.error ?? ""}`);

  const smList = await req("sm", "/api/sm/submissions?pageSize=50");
  const smRow = (smList.json?.submissions ?? []).find((s) => s.id === id);
  record("F6 SM sees the submission (receiver)", smList.res.status === 200 && smRow?.status === "SUBMITTED", `${smRow?.status ?? "missing"}`);

  const bmList = await req("bm", "/api/bm/submissions?pageSize=50");
  const bmSees = (bmList.json?.submissions ?? []).some((s) => s.id === id);
  record("F7 BM of another BU cannot see it (scope isolation)", bmList.res.status === 200 && !bmSees, "");

  const badMove = await req("ba", `/api/ba/submissions/${id}`, { method: "POST", body: { action: "submit", values: [{ label: "x", value: 1 }] } });
  record("F8 re-submit of SUBMITTED refused", badMove.res.status === 409, `${badMove.res.status}`);

  const dec = await req("sm", `/api/sm/submissions/${id}/decision`, { method: "POST", body: { action: "approve" } });
  record("F9 SM approves → APPROVED", dec.res.status === 200 && dec.json?.submission?.status === "APPROVED", `${dec.res.status} ${dec.json?.error ?? ""}`);

  const esgList = await req("grp", "/api/esg/submissions");
  const esgRow = (esgList.json?.submissions ?? []).find((s) => s.id === id);
  record("F10 Group sees approved record (top visibility)", esgList.res.status === 200 && esgRow?.status === "APPROVED", esgRow?.status ?? "missing");

  const decAgain = await req("sm", `/api/sm/submissions/${id}/decision`, { method: "POST", body: { action: "approve" } });
  record("F11 double-decision refused", decAgain.res.status >= 400 && decAgain.res.status < 500, `${decAgain.res.status}`);
}

/* ═══ G. RESUBMIT LOOP ═══ */
async function resubmitFlow() {
  const subs = await req("ba", "/api/ba/submissions?pageSize=50&tab=submitted");
  const target = (subs.json?.submissions ?? []).find((s) => s.status === "SUBMITTED");
  if (!target) {
    record("G0 SUBMITTED WTRSUP row available for reject/resubmit test", false, "none found");
    return;
  }
  const rej = await req("sm", `/api/sm/submissions/${target.id}/decision`, { method: "POST", body: { action: "reject", reason: "E2E: unit mismatch found during verification" } });
  record("G1 SM rejects with reason → REJECTED", rej.res.status === 200 && rej.json?.submission?.status === "REJECTED", `${rej.res.status} ${rej.json?.error ?? ""}`);

  const resub = await req("ba", `/api/ba/submissions/${target.id}`, {
    method: "POST",
    body: { action: "resubmit", values: [{ label: "Corrected value", value: 999, unit: "ML" }], comment: "Corrections applied per review" },
  });
  record("G3 BA resubmits after rejection → SUBMITTED", resub.res.status === 200 && resub.json?.submission?.status === "SUBMITTED", `${resub.res.status} ${resub.json?.error ?? ""}`);

  const det = await req("ba", `/api/ba/submissions/${target.id}`);
  const hist = det.json?.submission?.history ?? [];
  record("G4 version history carries both decisions", hist.length >= 3, `${hist.length} entries`);
}

/* ═══ H. PACKAGE FLOW ═══ */
async function packageFlow() {
  const stamp = Date.now().toString(36);
  const mk = await req("sa", "/api/sa/packages", { method: "POST", body: { title: `E2E Package ${stamp}`, period: "FY 2025-26" } });
  record("H1 SA submits reporting package to Group", mk.res.status === 201 || mk.res.status === 200, `${mk.res.status} ${mk.json?.error ?? ""}`);

  const cons = await req("grp", "/api/esg/consolidation");
  const pkgs = cons.json?.packages ?? [];
  const found = pkgs.some((p) => (p.title ?? p.name ?? "").includes(`E2E Package ${stamp}`));
  record("H2 Group consolidation sees the package (receiver)", cons.res.status === 200 && found, `${pkgs.length} packages`);
}

/* ═══ I. LATENCY PROOF ═══ */
async function latencyProof(revBefore) {
  const { json } = await req("ba", "/api/revision");
  record("I1 revision fingerprint changed after mutations", !!revBefore && json?.rev !== revBefore, `${(revBefore ?? "").slice(0, 18)}… → ${(json?.rev ?? "").slice(0, 18)}…`);
}

/* ═══ run ═══ */
(async () => {
  console.log(`E2E against ${BASE}\n`);
  await authMatrix();
  const rev0 = await revisionBefore();
  await deadlineFlow();
  await taskFlow();
  await evidenceFlow();
  await submissionFlow();
  await resubmitFlow();
  await packageFlow();
  await latencyProof(rev0);
  const pass = results.filter((r) => r.pass).length;
  const fail = results.length - pass;
  console.log(`\n${pass}/${results.length} checks passed${fail ? `, ${fail} FAILED` : " — all green"}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error("E2E crashed:", e);
  process.exit(2);
});
