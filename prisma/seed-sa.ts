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

  // ══════════════════════ 6. SUBSIDIARY MANAGER review-flow demo data ══════════════════════
  // Idempotent extras for the Subsidiary Manager workspace (refs SUB-2526-90x
  // are owned exclusively by this block): urgent reviews, an overdue review, a
  // resubmission after rejection and a zero-evidence report so every queue
  // priority band is populated for the demo subsidiary.
  {
    const sub0 = subs[0];
    const uos0 = unitsOf(0);
    const pos0 = projectsOf(0);
    await db.submission.deleteMany({ where: { ref: { startsWith: "SUB-2526-90" } } });
    const byName = async (name: string) =>
      (await db.user.findFirst({ where: { subsidiaryId: sub0.id, name }, select: { id: true } }))?.id ?? null;
    const deepa = await byName("Deepa Krishnan");
    const ramesh = await byName("Ramesh Iyer");
    const mohit = await byName("Mohit Jain");
    const mgrName = sub0.managerName || "Rajesh Menon";

    const mkSub = (args: {
      ref: string; title: string; category: string; metricName: string; metricValue: number; metricUnit: string;
      status: string; overdue: boolean; dueOffset: number; submittedOffset: number; fiscalQuarter: string;
      buId?: string | null; prjId?: string | null; submittedById?: string | null;
      values: { label: string; value: number; unit: string }[];
      evidence?: string[];
      comments?: { author: string; role: string; text: string; at: string }[];
      history: { action: string; actor: string; at: string; note?: string }[];
    }) =>
      db.submission.create({
        data: {
          ref: args.ref, title: args.title, category: args.category,
          metricName: args.metricName, metricValue: args.metricValue, metricUnit: args.metricUnit,
          status: args.status, overdue: args.overdue, period: PERIOD, fiscalQuarter: args.fiscalQuarter,
          dueDate: at(args.dueOffset, 18),
          submittedAt: args.status === "DRAFT" ? null : at(args.submittedOffset, 11),
          subsidiaryId: sub0.id, businessUnitId: args.buId ?? null, projectId: args.prjId ?? null,
          submittedById: args.submittedById ?? null,
          values: JSON.stringify(args.values),
          evidence: JSON.stringify(args.evidence ?? []),
          comments: JSON.stringify(args.comments ?? []),
          history: JSON.stringify(args.history),
        },
      });

    // 901 — RESUBMISSION awaiting review, review window closes in ~2 days.
    await mkSub({
      ref: "SUB-2526-901", title: "Scope 2 — Purchased Electricity (Renewables)", category: "ENERGY",
      metricName: "Renewable electricity purchased", metricValue: 4120, metricUnit: "MWh",
      status: "SUBMITTED", overdue: false, dueOffset: 2, submittedOffset: -1, fiscalQuarter: "Q2",
      buId: uos0[0]?.id ?? null, submittedById: deepa,
      values: [
        { label: "Renewable electricity (open access)", value: 2680, unit: "MWh" },
        { label: "I-REC retirement", value: 1440, unit: "MWh" },
        { label: "Grid emission factor applied", value: 0.71, unit: "tCO2/MWh" },
      ],
      evidence: ["open-access-settlement-q2.xlsx", "irec-retirement-statement.pdf"],
      comments: [
        { author: mgrName, role: "SUBSIDIARY_MANAGER", text: "Rejected: I-REC retirement statement was for a different settlement period.\n\nCorrection instructions: Retire certificates for Apr–Jun and re-attach the matching statement.", at: at(-6, 15).toISOString() },
      ],
      history: [
        { action: "Created", actor: "System", at: at(-14, 9).toISOString() },
        { action: "Submitted by user", actor: "Workflow", at: at(-9, 10).toISOString() },
        { action: "Rejected by Rajesh Menon (Subsidiary Manager) — returned for correction", actor: mgrName, at: at(-6, 15).toISOString(), note: "I-REC retirement statement was for a different settlement period." },
        { action: "Resubmitted after corrections by Deepa Krishnan", actor: "Workflow", at: at(-1, 11).toISOString() },
      ],
    });

    // 902 — OVERDUE review (report sat in queue past its review deadline).
    await mkSub({
      ref: "SUB-2526-902", title: "Groundwater Drawal — Irrigation Pumping", category: "WATER",
      metricName: "Groundwater withdrawn", metricValue: 1.84, metricUnit: "ML",
      status: "SUBMITTED", overdue: true, dueOffset: -5, submittedOffset: -12, fiscalQuarter: "Q1",
      buId: uos0[1]?.id ?? null, submittedById: ramesh,
      values: [
        { label: "Groundwater withdrawn (metered)", value: 1.62, unit: "ML" },
        { label: "Groundwater withdrawn (estimated)", value: 0.22, unit: "ML" },
      ],
      evidence: ["groundwater-meter-log-q1.csv"],
      history: [
        { action: "Created", actor: "System", at: at(-20, 9).toISOString() },
        { action: "Submitted by user", actor: "Workflow", at: at(-12, 10).toISOString() },
      ],
    });

    // 903 — UNDER_REVIEW, project-level, comfortably inside its window.
    await mkSub({
      ref: "SUB-2526-903", title: "GHG Scope 1 — Stationary Combustion", category: "EMISSIONS",
      metricName: "Scope 1 stationary combustion", metricValue: 984, metricUnit: "tCO2e",
      status: "UNDER_REVIEW", overdue: false, dueOffset: 12, submittedOffset: -4, fiscalQuarter: "Q2",
      buId: uos0[1]?.id ?? null, prjId: pos0[0]?.id ?? null, submittedById: ramesh,
      values: [
        { label: "Diesel (gensets)", value: 214, unit: "tCO2e" },
        { label: "Furnace oil", value: 588, unit: "tCO2e" },
        { label: "Natural gas", value: 182, unit: "tCO2e" },
      ],
      evidence: ["fuel-consumption-register-q2.xlsx"],
      history: [
        { action: "Created", actor: "System", at: at(-11, 9).toISOString() },
        { action: "Submitted by user", actor: "Workflow", at: at(-4, 12).toISOString() },
        { action: "Review started", actor: "Workflow", at: at(-2, 9).toISOString() },
      ],
    });

    // 904 — SUBMITTED with ZERO evidence (queue's missing-evidence band).
    await mkSub({
      ref: "SUB-2526-904", title: "Effluent Quality — Q1 Compliance", category: "SAFETY",
      metricName: "Effluent samples within limits", metricValue: 96, metricUnit: "%",
      status: "SUBMITTED", overdue: false, dueOffset: 8, submittedOffset: -3, fiscalQuarter: "Q1",
      buId: uos0[0]?.id ?? null, submittedById: mohit,
      values: [
        { label: "Samples collected", value: 24, unit: "count" },
        { label: "Within CPCB limits", value: 23, unit: "count" },
      ],
      evidence: [],
      history: [
        { action: "Created", actor: "System", at: at(-9, 9).toISOString() },
        { action: "Submitted by user", actor: "Workflow", at: at(-3, 14).toISOString() },
      ],
    });

    // Review-window overrides that make the queue's urgency bands real:
    //  · Solar Operations BU (901/904) → review due within days  (DUE SOON band)
    //  · Thermal/GHD BU (902/903) → review window closed          (OVERDUE band)
    // The BU rows already exist from section 3 (RTL-0002/RTL-0003) — update
    // them in place so resolveEffectiveDeadline resolves to these windows.
    if (uos0[0]) {
      await db.reportingTimeline.updateMany({
        where: { subsidiaryId: sub0.id, businessUnitId: uos0[0].id },
        data: {
          dueDate: at(3, 18), reviewDeadline: at(3, 18), inheritanceMode: "OVERRIDE",
          overrideReason: "Aligned the review window with the quarter-end consolidation cut-off.",
        },
      });
    }
    if (uos0[1]) {
      await db.reportingTimeline.updateMany({
        where: { subsidiaryId: sub0.id, businessUnitId: uos0[1].id },
        data: {
          dueDate: at(-5, 18), reviewDeadline: at(-2, 18), inheritanceMode: "OVERRIDE",
          overrideReason: "Q1 review window lapsed while the reviewer queue was cleared — escalated for priority decision.",
        },
      });
    }

    // Evidence docs for the new submissions (the generic loop above only
    // covers pre-existing submissions).
    const FTYPE: Record<string, string> = { pdf: "PDF", xlsx: "XLSX", csv: "CSV" };
    const evFiles: { ref: string; files: string[]; bu: string | null; prj: string | null }[] = [
      { ref: "SUB-2526-901", files: ["open-access-settlement-q2.xlsx", "irec-retirement-statement.pdf"], bu: uos0[0]?.id ?? null, prj: null },
      { ref: "SUB-2526-902", files: ["groundwater-meter-log-q1.csv"], bu: uos0[1]?.id ?? null, prj: null },
      { ref: "SUB-2526-903", files: ["fuel-consumption-register-q2.xlsx"], bu: uos0[1]?.id ?? null, prj: pos0[0]?.id ?? null },
    ];
    for (const e of evFiles) {
      const created = await db.submission.findUnique({ where: { ref: e.ref }, select: { id: true, submittedAt: true } });
      if (!created) continue;
      for (let i = 0; i < e.files.length; i++) {
        const f = e.files[i];
        const ext = f.split(".").pop()?.toLowerCase() ?? "pdf";
        await db.evidenceDoc.create({
          data: {
            name: f, fileType: FTYPE[ext] ?? "PDF",
            sizeKb: 240 + i * 610, version: 1,
            subsidiaryId: sub0.id, businessUnitId: e.bu, projectId: e.prj,
            submissionId: created.id, submissionRef: e.ref,
            disclosureRef: `BRSR-C2-ENR-0${i + 3}`,
            uploadedBy: "Deepa Krishnan",
            status: "VALID",
            uploadedAt: created.submittedAt ?? at(-1, 11),
          },
        });
      }
    }

    // Queue notification so the manager's bell reflects the resubmission.
    await db.notification.create({
      data: {
        ntype: "SUBMISSION",
        title: "Corrected report resubmitted",
        body: "Scope 2 — Purchased Electricity (Renewables) was resubmitted by Deepa Krishnan after corrections and is awaiting your review.",
        severity: "INFO", linkView: "queue", subsidiaryId: sub0.id, createdAt: at(-1, 12),
      },
    });

    // One decision already recorded by the manager this period (completed-reviews KPI).
    const anyApproved = await db.submission.findFirst({
      where: { subsidiaryId: sub0.id, status: "APPROVED", reviewerId: null },
      orderBy: { ref: "asc" },
    });
    if (anyApproved && !anyApproved.history.includes(`Approved by ${mgrName}`)) {
      const comments = JSON.parse(anyApproved.comments || "[]") as { author: string; role: string; text: string; at: string }[];
      const history = JSON.parse(anyApproved.history || "[]") as { action: string; actor: string; at: string; note?: string }[];
      await db.submission.update({
        where: { id: anyApproved.id },
        data: {
          reviewerId: (await db.user.findFirst({ where: { subsidiaryId: sub0.id, role: "SUBSIDIARY_MANAGER" }, select: { id: true } }))?.id ?? anyApproved.reviewerId,
          comments: JSON.stringify([...comments]),
          history: JSON.stringify([...history, { action: `Approved by ${mgrName} (Subsidiary Manager)`, actor: mgrName, at: at(-3, 16).toISOString() }]),
        },
      });
    }
  }

  console.log("Subsidiary workspace seed complete:");
  console.log(`  Timelines: ${await db.reportingTimeline.count()} · Packages: ${await db.reportingPackage.count()} · Validation issues: ${await db.validationIssue.count()} · Evidence docs: ${await db.evidenceDoc.count()} · Scoped notifications: ${await db.notification.count({ where: { subsidiaryId: { not: null } } })}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
