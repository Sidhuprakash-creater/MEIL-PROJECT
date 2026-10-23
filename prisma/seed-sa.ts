/**
 * MEIL ESG & BRSR Platform — Subsidiary Admin workspace demo data.
 * Run order:  bun prisma/seed.ts  →  bun prisma/seed-auth.ts  →  bun prisma/seed-sa.ts
 *
 * Idempotent: only touches the subsidiary-workspace tables (timelines,
 * packages, validation issues, evidence docs) + scoped notifications.
 * Never wipes organization, user, or submission data.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const DAY = 86400000;
const now = Date.now();
const at = (daysOffset: number, hour = 10) => {
  const d = new Date(now + daysOffset * DAY);
  d.setHours(hour, (daysOffset * 17) % 60, 0, 0);
  return d;
};

const PERIOD = "FY 2025-26";

async function main() {
  console.log("Seeding Subsidiary Admin workspace data…");

  const subs = await db.subsidiary.findMany({ orderBy: { code: "asc" } });
  if (subs.length === 0) throw new Error("No subsidiaries found — run seed.ts first.");
  const units = await db.businessUnit.findMany({ orderBy: { code: "asc" } });
  const projects = await db.project.findMany({ orderBy: { code: "asc" } });
  const submissions = await db.submission.findMany({ orderBy: { ref: "asc" } });
  const adminOf = (subIdx: number) =>
    subs[subIdx].adminName || "Subsidiary Admin";

  // ── clean only subsidiary-workspace tables (idempotent re-runs) ──
  await db.evidenceDoc.deleteMany();
  await db.validationIssue.deleteMany();
  await db.reportingPackage.deleteMany();
  await db.reportingTimeline.deleteMany();
  await db.notification.deleteMany({ where: { subsidiaryId: { not: null } } });
  await db.notification.deleteMany({ where: { ntype: { in: ["PACKAGE", "TIMELINE", "EVIDENCE", "VALIDATION"] } } });

  // ── helpers to resolve org ids ──
  const unitsOf = (subIdx: number) => units.filter((u) => u.subsidiaryId === subs[subIdx].id);
  const projectsOf = (subIdx: number) =>
    projects.filter((p) => unitsOf(subIdx).some((u) => u.id === p.businessUnitId));
  const subsOf = (subIdx: number) => submissions.filter((s) => s.subsidiaryId === subs[subIdx].id);

  // ── BU-level reporting: demote a few project submissions to BU aggregate level ──
  // (BU reports are roll-ups, so they carry projectId = null. Deterministic picks.)
  const BU_LEVEL_REFS = new Set(["SUB-2526-001", "SUB-2526-003", "SUB-2526-013", "SUB-2526-019", "SUB-2526-021"]);
  for (const s of submissions) {
    if (BU_LEVEL_REFS.has(s.ref) && s.projectId) {
      await db.submission.update({ where: { id: s.id }, data: { projectId: null } });
    }
  }
  // refresh local cache after demotion
  const buSubsAll = await db.submission.findMany({ orderBy: { ref: "asc" } });
  submissions.length = 0;
  submissions.push(...buSubsAll);

  // ── presence refresh: keep "active now" demo data lively on every re-run ──
  const usersAll = await db.user.findMany({ where: { subsidiaryId: { not: null } } });
  let onlineIdx = 0;
  for (const u of usersAll) {
    if (u.status !== "ACTIVE") continue;
    if (onlineIdx < 6) {
      await db.user.update({ where: { id: u.id }, data: { lastActiveAt: new Date(now - (2 + onlineIdx++ * 4) * 60000) } });
    } else if (onlineIdx < 14) {
      await db.user.update({ where: { id: u.id }, data: { lastActiveAt: new Date(now - (onlineIdx++ * 5 + 3) * 3600000) } });
    }
  }

  // ══════════════════════ 1. REPORTING TIMELINES ══════════════════════
  // Subsidiary root timeline for every subsidiary + overrides on selected BUs.
  let tlSeq = 1;
  const tlRef = () => `RTL-${String(tlSeq++).padStart(4, "0")}`;
  const categories = ["ENVIRONMENT", "ENERGY", "EMISSIONS", "WATER", "WASTE", "SAFETY", "WORKFORCE", "PROCUREMENT", "CSR", "COMPLIANCE"];

  for (let si = 0; si < subs.length; si++) {
    const sub = subs[si];
    const admin = adminOf(si);
    // Subsidiary root timeline — the deadline every child inherits by default.
    await db.reportingTimeline.create({
      data: {
        ref: tlRef(), name: `${sub.code} — Annual ESG reporting window`, period: PERIOD,
        level: "SUBSIDIARY", subsidiaryId: sub.id,
        startDate: at(-45), dueDate: at(24), reviewDeadline: at(31),
        categories: JSON.stringify(categories), inheritanceMode: "OVERRIDE",
        overrideReason: "Group-mandated reporting window for all subsidiaries.",
        notify: true, createdByName: "Arun Bhaskar",
      },
    });
    const [bu0] = unitsOf(si);
    if (!bu0) continue;
    // An approved override on the first BU.
    await db.reportingTimeline.create({
      data: {
        ref: tlRef(), name: `${bu0.code} — plant shutdown window extension`, period: PERIOD,
        level: "BUSINESS_UNIT", subsidiaryId: sub.id, businessUnitId: bu0.id,
        startDate: at(-38), dueDate: at(17), reviewDeadline: at(22),
        categories: JSON.stringify(["ENVIRONMENT", "ENERGY", "EMISSIONS"]),
        inheritanceMode: "OVERRIDE",
        overrideReason: "Annual maintenance shutdown delays meter reading consolidation.",
        notify: true, createdByName: admin,
      },
    });
    // An explicitly inherited timeline row on the second BU (if present).
    const [bu1] = unitsOf(si).slice(1);
    if (bu1) {
      await db.reportingTimeline.create({
        data: {
          ref: tlRef(), name: `${bu1.code} — inherited reporting window`, period: PERIOD,
          level: "BUSINESS_UNIT", subsidiaryId: sub.id, businessUnitId: bu1.id,
          startDate: at(-45), dueDate: null, reviewDeadline: null,
          categories: JSON.stringify(categories), inheritanceMode: "INHERIT",
          notify: true, createdByName: admin,
        },
      });
      const prj = projectsOf(si).find((p) => p.businessUnitId === bu1.id);
      if (prj) {
        await db.reportingTimeline.create({
          data: {
            ref: tlRef(), name: `${prj.code} — site data cut-off`, period: PERIOD,
            level: "PROJECT", subsidiaryId: sub.id, projectId: prj.id,
            startDate: at(-40), dueDate: at(12), reviewDeadline: at(15),
            categories: JSON.stringify(["ENVIRONMENT", "SAFETY"]),
            inheritanceMode: "OVERRIDE",
            overrideReason: "Site closes for monsoon; data frozen early.",
            notify: true, createdByName: admin,
          },
        });
      }
    }
  }

  // ══════════════════════ 2. REPORTING PACKAGES ══════════════════════
  // FY24-25 approved package + FY25-26 in-flight package per demo subsidiary.
  let pkSeq = 1;
  const pkRef = () => `RPT-PKG-${String(pkSeq++).padStart(4, "0")}`;
  for (let si = 0; si < subs.length; si++) {
    const sub = subs[si];
    const admin = adminOf(si);
    const approved = subsOf(si).filter((s) => s.status === "APPROVED");
    const metricSnapshot = approved.slice(0, 6).map((s) => ({ name: s.metricName, value: s.metricValue, unit: s.metricUnit }));
    await db.reportingPackage.create({
      data: {
        ref: pkRef(), title: `${sub.name} — FY 2024-25 ESG Reporting Package`,
        subsidiaryId: sub.id, subsidiaryName: sub.name, period: "FY 2024-25",
        status: "APPROVED", readinessPct: 100,
        summary: JSON.stringify({ approved: 18, pending: 0, missing: 0, metrics: metricSnapshot }),
        sourceRefs: JSON.stringify(approved.slice(0, 10).map((s) => s.ref)),
        submittedAt: at(-120), submittedBy: admin,
        groupFeedback: "Accepted and consolidated into the FY 2024-25 Group BRSR report.",
      },
    });
    await db.reportingPackage.create({
      data: {
        ref: pkRef(), title: `${sub.name} — ${PERIOD} ESG Reporting Package`,
        subsidiaryId: sub.id, subsidiaryName: sub.name, period: PERIOD,
        status: si === 0 ? "CHANGES_REQUESTED" : "DRAFT",
        readinessPct: si === 0 ? 72 : 0,
        summary: JSON.stringify({ approved: approved.length, pending: subsOf(si).filter((s) => ["SUBMITTED", "UNDER_REVIEW"].includes(s.status)).length, missing: 4, metrics: metricSnapshot.slice(0, 4) }),
        sourceRefs: JSON.stringify(approved.map((s) => s.ref)),
        submittedAt: si === 0 ? at(-9) : null, submittedBy: si === 0 ? admin : "",
        groupFeedback: si === 0
          ? "Scope 3 travel figures need the FY25-26 travel register reconciliation before Group consolidation. Re-attach the updated register."
          : "",
      },
    });
  }

  // ══════════════════════ 3. VALIDATION ISSUES ══════════════════════
  let viSeq = 1;
  const viRef = () => `VLD-${String(viSeq++).padStart(4, "0")}`;
  for (let si = 0; si < subs.length; si++) {
    const sub = subs[si];
    const sus = subsOf(si);
    const uos = unitsOf(si);
    const pos = projectsOf(si);
    const resp = (subIdx: number) => {
      const u = uos[subIdx % Math.max(uos.length, 1)];
      return u?.managerName || "Responsible user";
    };
    const def = [
      { severity: "HIGH", rule: "MISSING_EVIDENCE", description: "Scope 1 stationary combustion report is missing the calibration certificate for the Q2 meter reading.", bu: 0, prj: 0, sref: sus.find((s) => s.category === "EMISSIONS" && s.status !== "DRAFT")?.ref ?? "" },
      { severity: "CRITICAL", rule: "MISSING_SUBMISSION", description: "No waste disposal submission received for the current quarter — deadline within 7 days.", bu: 1, prj: -1, sref: "" },
      { severity: "MEDIUM", rule: "UNIT_MISMATCH", description: "Diesel consumption reported in litres while the disclosure requires kilolitres.", bu: 0, prj: -1, sref: sus.find((s) => s.category === "ENERGY")?.ref ?? "" },
      { severity: "LOW", rule: "PERIOD_MISMATCH", description: "Submission tagged Q1 but measurement log covers April–June (Q2 window).", bu: 2 % Math.max(uos.length, 1), prj: -1, sref: "" },
      { severity: "MEDIUM", rule: "DUPLICATE", description: "Two water withdrawal submissions reference the same meter log for June.", bu: 0, prj: 0, sref: sus.find((s) => s.category === "WATER")?.ref ?? "" },
      { severity: "HIGH", rule: "UNAPPROVED_SOURCE", description: "Draft procurement entry feeds the green-spend ratio — source not yet approved.", bu: 1, prj: -1, sref: sus.find((s) => s.status === "DRAFT")?.ref ?? "" },
    ];
    for (const d of def) {
      const bu = uos[d.bu % Math.max(uos.length, 1)];
      await db.validationIssue.create({
        data: {
          ref: viRef(), severity: d.severity, rule: d.rule, description: d.description,
          subsidiaryId: sub.id, businessUnitId: bu?.id ?? null,
          projectId: d.prj >= 0 ? (pos.find((p) => p.businessUnitId === bu?.id)?.id ?? null) : null,
          submissionId: d.sref ? sus.find((s) => s.ref === d.sref)?.id ?? null : null,
          submissionRef: d.sref, period: PERIOD,
          responsibleName: resp(d.bu), status: viSeq % 4 === 1 ? "ASSIGNED" : "OPEN",
          ownerName: viSeq % 4 === 1 ? adminOf(si) : "",
          detectedAt: at(-(viSeq % 9) - 1),
        },
      });
    }
  }

  // ══════════════════════ 4. EVIDENCE DOCUMENTS ══════════════════════
  // Derive from submission evidence arrays so repository & report panel match.
  let evSeq = 1;
  const FTYPE: Record<string, string> = { pdf: "PDF", xlsx: "XLSX", jpg: "IMAGE", png: "IMAGE", csv: "CSV", docx: "DOCX" };
  for (const s of submissions) {
    const files = JSON.parse(s.evidence || "[]") as string[];
    if (!s.subsidiaryId) continue;
    for (const f of files) {
      const ext = f.split(".").pop()?.toLowerCase() ?? "pdf";
      const bu = s.businessUnitId, prj = s.projectId;
      await db.evidenceDoc.create({
        data: {
          name: f, fileType: FTYPE[ext] ?? "PDF",
          sizeKb: 120 + ((evSeq * 37) % 2400), version: 1 + (evSeq % 3),
          subsidiaryId: s.subsidiaryId, businessUnitId: bu, projectId: prj,
          submissionId: s.id, submissionRef: s.ref,
          disclosureRef: `BRSR-C2-${s.category.slice(0, 3)}-${String((evSeq % 9) + 1).padStart(2, "0")}`,
          uploadedBy: adminOf(subs.findIndex((x) => x.id === s.subsidiaryId)),
          status: evSeq % 11 === 0 ? "EXPIRED" : "VALID",
          uploadedAt: s.submittedAt ?? s.dueDate,
        },
      });
      evSeq++;
    }
  }
  // A couple of expected-but-missing placeholders for the first subsidiary.
  const [sub0] = subs;
  if (sub0) {
    const uos0 = unitsOf(0);
    await db.evidenceDoc.create({
      data: { name: "calibration-certificate-q2.pdf (awaited)", fileType: "PDF", sizeKb: 0, version: 0, subsidiaryId: sub0.id, businessUnitId: uos0[0]?.id ?? null, submissionRef: "", disclosureRef: "BRSR-C2-EMI-04", uploadedBy: "—", status: "MISSING", uploadedAt: at(-2) },
    });
    await db.evidenceDoc.create({
      data: { name: "waste-manifest-apr-jun.xlsx (awaited)", fileType: "XLSX", sizeKb: 0, version: 0, subsidiaryId: sub0.id, businessUnitId: uos0[1]?.id ?? null, submissionRef: "", disclosureRef: "BRSR-C2-WAS-02", uploadedBy: "—", status: "MISSING", uploadedAt: at(-1) },
    });
  }

  // ══════════════════════ 5. SCOPED NOTIFICATIONS ══════════════════════
  const notifDefs = [
    { ntype: "SUBMISSION", title: "New BU report submitted", body: "Renewable Energy Share — Solar was submitted by Deepa Krishnan and is awaiting Subsidiary Manager review.", severity: "INFO", linkView: "monitoring", days: -1 },
    { ntype: "APPROVAL", title: "Report approved by Subsidiary Manager", body: "Scope 2 — Purchased Electricity was approved by Rajesh Menon.", severity: "SUCCESS", linkView: "monitoring", days: -2 },
    { ntype: "DEADLINE", title: "Deadline approaching", body: "Kothagudem Thermal Plant site data cut-off is due in 12 days.", severity: "WARNING", linkView: "timelines", days: 0 },
    { ntype: "OVERDUE", title: "Submission overdue", body: "Groundwater Drawal (Irrigation BU) crossed its submission deadline.", severity: "CRITICAL", linkView: "submissions", days: -1 },
    { ntype: "VALIDATION", title: "Validation issue detected", body: "Missing evidence: calibration certificate for Scope 1 meter readings.", severity: "WARNING", linkView: "validation", days: -2 },
    { ntype: "PACKAGE", title: "Group feedback on reporting package", body: "Group Admin requested corrections on the FY 2025-26 reporting package.", severity: "WARNING", linkView: "esg", days: -3 },
    { ntype: "EVIDENCE", title: "Evidence expired", body: "One evidence document in the repository has passed its validity date.", severity: "WARNING", linkView: "evidence", days: -4 },
    { ntype: "SYSTEM", title: "Timeline override approved", body: "Thermal Generation received an authorized deadline extension (maintenance shutdown).", severity: "INFO", linkView: "timelines", days: -5 },
  ];
  for (let si = 0; si < subs.length; si++) {
    await db.notification.createMany({
      data: notifDefs.map((n, i) => ({
        ntype: n.ntype, title: n.title, body: n.body, severity: n.severity,
        read: i > 4, linkView: n.linkView, subsidiaryId: subs[si].id,
        createdAt: at(n.days, 9 + i),
      })),
    });
  }

  // Group-wide announcement visible to every subsidiary (subsidiaryId = null).
  await db.notification.create({
    data: { ntype: "SYSTEM", title: "Group Admin announcement", body: "BRSR Core disclosure catalogue v1.2 is now mandatory for FY 2025-26 subsidiary packages.", severity: "INFO", linkView: "esg", subsidiaryId: null, createdAt: at(-6, 12) },
  });

  console.log("Subsidiary workspace seed complete:");
  console.log(`  Timelines: ${await db.reportingTimeline.count()} · Packages: ${await db.reportingPackage.count()} · Validation issues: ${await db.validationIssue.count()} · Evidence docs: ${await db.evidenceDoc.count()} · Scoped notifications: ${await db.notification.count({ where: { subsidiaryId: { not: null } } })}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
