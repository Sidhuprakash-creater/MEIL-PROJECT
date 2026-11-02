/**
 * MEIL ESG & BRSR Platform — BU Admin + BU Manager workspace demo data.
 * Run order:  bun prisma/seed.ts  →  bun prisma/seed-auth.ts  →  bun prisma/seed-sa.ts  →  bun prisma/seed-bu.ts
 *
 * Idempotent: only touches the BU-scoped items (BU timeline overrides,
 * BU-scoped validation issues + evidence docs) and adds BU-scoped demo
 * submissions for the two demo BU accounts (Suresh Babu — BU Manager
 * Thermal; Kiran Reddy — BU Admin Water Supply) so the new BU workspaces
 * have lively demo data on first run. Does NOT touch organization, user,
 * or existing submission data.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const DAY = 86400000;
const now = Date.now();
const at = (daysOffset: number, hour = 10) => {
  const d = new Date(now + daysOffset * DAY);
  d.setHours(hour, (daysOffset * 19) % 60, 0, 0);
  return d;
};

const PERIOD = "FY 2025-26";

async function main() {
  console.log("Seeding BU workspace demo data…");

  const units = await db.businessUnit.findMany({ orderBy: { code: "asc" } });
  if (units.length === 0) throw new Error("No business units found — run seed.ts first.");

  // Two demo BU accounts (from seed.ts):
  //   - BU-THERMAL  → Suresh Babu (BU_MANAGER, employeeId BU-1001)
  //   - BU-WTRSUP   → Kiran Reddy (BU_ADMIN, employeeId BU-3002)
  const thermal = units.find((u) => u.code === "HRP" || u.code === "BU-THERMAL") || units[0];
  const waterSupply = units.find((u) => u.code === "EPBI" || u.code === "BU-WTRSUP") || units[1];
  if (!thermal || !waterSupply) throw new Error("Required Business Units not found.");

  const suresh = await db.user.findFirst({ where: { email: { in: ["suresh.babu@meil.in"] } } });
  const kiran = await db.user.findFirst({ where: { email: { in: ["kiran.reddy@olectra.com", "kiran.reddy@meil.in"] } } });
  if (!suresh || !kiran) throw new Error("Suresh Babu or Kiran Reddy not found — run seed.ts + seed-auth.ts.");

  const thermalProjects = await db.project.findMany({ where: { businessUnitId: thermal.id }, orderBy: { code: "asc" } });
  const waterProjects = await db.project.findMany({ where: { businessUnitId: waterSupply.id }, orderBy: { code: "asc" } });

  // ── clean only the BU-specific demo rows (idempotent re-runs) ──
  await db.evidenceDoc.deleteMany({ where: { businessUnitId: { in: [thermal.id, waterSupply.id] } } });
  await db.validationIssue.deleteMany({ where: { businessUnitId: { in: [thermal.id, waterSupply.id] } } });
  await db.reportingTimeline.deleteMany({ where: { businessUnitId: { in: [thermal.id, waterSupply.id] }, level: "BUSINESS_UNIT" } });
  // Remove prior BU demo submissions
  await db.notification.deleteMany({ where: { ntype: "BU_DEMO", subsidiaryId: null } });
  const buDemoSubs = await db.submission.findMany({
    where: { ref: { in: ["SUB-BU-1001-001", "SUB-BU-1001-002", "SUB-BU-1001-003", "SUB-BU-1001-004", "SUB-BU-3002-001", "SUB-BU-3002-002"] } },
    select: { id: true, ref: true },
  });
  if (buDemoSubs.length) {
    await db.evidenceDoc.deleteMany({ where: { submissionId: { in: buDemoSubs.map((s) => s.id) } } });
    await db.validationIssue.deleteMany({ where: { submissionId: { in: buDemoSubs.map((s) => s.id) } } });
    await db.submission.deleteMany({ where: { id: { in: buDemoSubs.map((s) => s.id) } } });
  }

  // ── BU-level timeline overrides for the two demo BUs ──
  // BU-THERMAL has an earlier review deadline (review-pending scenario)
  // BU-WTRSUP has a tighter reporting window
  const thermalTl = await db.reportingTimeline.create({
    data: {
      ref: `TL-BU-${thermal.code}`,
      name: `${thermal.name} — Reporting Window`,
      period: PERIOD,
      level: "BUSINESS_UNIT",
      subsidiaryId: thermal.subsidiaryId,
      businessUnitId: thermal.id,
      startDate: at(-20, 9),
      dueDate: at(7, 18),       // 7 days from now
      reviewDeadline: at(2, 18), // 2 days from now → urgent
      categories: JSON.stringify(["ENVIRONMENT", "ENERGY", "EMISSIONS", "SAFETY"]),
      inheritanceMode: "OVERRIDE",
      overrideReason: "Thermal fleet maintenance window — earlier BU deadline required to align with Q2 closure.",
      status: "ACTIVE",
      createdByName: suresh.name,
      notify: true,
    },
  });

  const waterTl = await db.reportingTimeline.create({
    data: {
      ref: `TL-BU-${waterSupply.code}`,
      name: `${waterSupply.name} — Reporting Window`,
      period: PERIOD,
      level: "BUSINESS_UNIT",
      subsidiaryId: waterSupply.subsidiaryId,
      businessUnitId: waterSupply.id,
      startDate: at(-25, 9),
      dueDate: at(14, 18),
      reviewDeadline: at(9, 18),
      categories: JSON.stringify(["WATER", "ENVIRONMENT", "WORKFORCE"]),
      inheritanceMode: "OVERRIDE",
      overrideReason: "Water-grid reporting cadence — quarterly closure aligned with state regulator deadline.",
      status: "ACTIVE",
      createdByName: kiran.name,
      notify: true,
    },
  });

  // ── BU-scoped demo submissions for Suresh Babu's review queue ──
  // (BU-1001 — Thermal — these are SUBMITTED/UNDER_REVIEW for the BU Manager
  //  to act on; one is overdue to test the overdue state in the queue)
  const thermalProjectIds = thermalProjects.map((p) => p.id);
  const projectThermal = thermalProjects[0]; // Kothagudem Thermal Plant
  const projectThermal2 = thermalProjects[1]; // Singareppi Thermal Expansion

  const sub1 = await db.submission.create({
    data: {
      ref: "SUB-BU-1001-001",
      title: "Stack Emissions — SO₂ Concentration",
      category: "EMISSIONS",
      metricName: "SO₂",
      metricValue: 412.5,
      metricUnit: "mg/Nm³",
      status: "SUBMITTED",
      overdue: false,
      period: PERIOD,
      fiscalQuarter: "Q2",
      dueDate: thermalTl.dueDate ?? at(7, 18),
      submittedAt: at(-1, 14),
      reviewedAt: null,
      subsidiaryId: thermal.subsidiaryId,
      businessUnitId: thermal.id,
      projectId: projectThermal.id,
      submittedById: (await db.user.findFirst({ where: { subsidiaryId: thermal.subsidiaryId, role: "ENV_DATA_USER" }, select: { id: true } }))?.id,
      reviewerId: null,
      values: JSON.stringify([
        { label: "Reported value", value: 412.5, unit: "mg/Nm³" },
        { label: "Prior period", value: 398.2, unit: "mg/Nm³" },
        { label: "Data points", value: 24, unit: "entries" },
      ]),
      evidence: JSON.stringify(["cemso-report-bu1001-001.pdf", "calibration-bu1001-001.pdf"]),
      comments: JSON.stringify([]),
      history: JSON.stringify([
        { action: "Created", actor: "Tarun Mehta", at: at(-3, 11).toISOString() },
        { action: "Assigned to responsible user", actor: "Suresh Babu", at: at(-3, 13).toISOString() },
        { action: "Submitted by user", actor: "Tarun Mehta", at: at(-1, 14).toISOString() },
      ]),
    },
  });

  const sub2 = await db.submission.create({
    data: {
      ref: "SUB-BU-1001-002",
      title: "Water Withdrawal — Cooling Tower Makeup",
      category: "WATER",
      metricName: "Water withdrawal",
      metricValue: 18450,
      metricUnit: "m³",
      status: "UNDER_REVIEW",
      overdue: true, // ← overdue review for testing
      period: PERIOD,
      fiscalQuarter: "Q2",
      dueDate: thermalTl.dueDate ?? at(7, 18),
      submittedAt: at(-6, 11),
      reviewedAt: null,
      subsidiaryId: thermal.subsidiaryId,
      businessUnitId: thermal.id,
      projectId: projectThermal2.id,
      submittedById: (await db.user.findFirst({ where: { subsidiaryId: thermal.subsidiaryId, role: "ENV_DATA_USER" }, select: { id: true } }))?.id,
      reviewerId: null,
      values: JSON.stringify([
        { label: "Reported value", value: 18450, unit: "m³" },
        { label: "Prior period", value: 17120, unit: "m³" },
        { label: "Data points", value: 31, unit: "entries" },
      ]),
      evidence: JSON.stringify(["meter-log-bu1001-002.xlsx"]), // minimal evidence → flag
      comments: JSON.stringify([
        { author: "Suresh Babu", role: "BU_MANAGER", text: "Verifying water withdrawal consistency against last quarter's escalation.", at: at(-3, 16).toISOString() },
      ]),
      history: JSON.stringify([
        { action: "Created", actor: "Tarun Mehta", at: at(-8, 9).toISOString() },
        { action: "Submitted by user", actor: "Tarun Mehta", at: at(-6, 11).toISOString() },
        { action: "Under review — Suresh Babu", actor: "Suresh Babu", at: at(-4, 16).toISOString() },
      ]),
    },
  });

  // Awaiting review + has a missing-evidence flag
  const sub3 = await db.submission.create({
    data: {
      ref: "SUB-BU-1001-003",
      title: "Solid Waste — Fly Ash Utilisation",
      category: "WASTE",
      metricName: "Fly ash utilised",
      metricValue: 92.4,
      metricUnit: "%",
      status: "SUBMITTED",
      overdue: false,
      period: PERIOD,
      fiscalQuarter: "Q2",
      dueDate: thermalTl.dueDate ?? at(7, 18),
      submittedAt: at(-2, 15),
      reviewedAt: null,
      subsidiaryId: thermal.subsidiaryId,
      businessUnitId: thermal.id,
      projectId: projectThermal.id,
      submittedById: (await db.user.findFirst({ where: { subsidiaryId: thermal.subsidiaryId, role: "ENV_DATA_USER" }, select: { id: true } }))?.id,
      reviewerId: null,
      values: JSON.stringify([
        { label: "Reported value", value: 92.4, unit: "%" },
        { label: "Prior period", value: 88.1, unit: "%" },
        { label: "Data points", value: 30, unit: "entries" },
      ]),
      evidence: JSON.stringify([]), // ← missing evidence → flag
      comments: JSON.stringify([]),
      history: JSON.stringify([
        { action: "Created", actor: "Tarun Mehta", at: at(-4, 9).toISOString() },
        { action: "Submitted by user", actor: "Tarun Mehta", at: at(-2, 15).toISOString() },
      ]),
    },
  });

  // Resubmission after rejection (corrections view)
  const sub4 = await db.submission.create({
    data: {
      ref: "SUB-BU-1001-004",
      title: "Energy Consumed — Auxiliary Power",
      category: "ENERGY",
      metricName: "Auxiliary power",
      metricValue: 8.21,
      metricUnit: "% of gross",
      status: "SUBMITTED",
      overdue: false,
      period: PERIOD,
      fiscalQuarter: "Q2",
      dueDate: thermalTl.dueDate ?? at(7, 18),
      submittedAt: at(-1, 18),
      reviewedAt: null,
      subsidiaryId: thermal.subsidiaryId,
      businessUnitId: thermal.id,
      projectId: projectThermal2.id,
      submittedById: (await db.user.findFirst({ where: { subsidiaryId: thermal.subsidiaryId, role: "ENV_DATA_USER" }, select: { id: true } }))?.id,
      reviewerId: null,
      values: JSON.stringify([
        { label: "Reported value", value: 8.21, unit: "%" },
        { label: "Prior period", value: 8.45, unit: "%" },
        { label: "Data points", value: 30, unit: "entries" },
      ]),
      evidence: JSON.stringify(["aux-power-bu1001-004.xlsx", "calibration-bu1001-004.pdf"]),
      comments: JSON.stringify([
        { author: "Suresh Babu", role: "BU_MANAGER", text: "Please attach the latest energy meter calibration certificate and resubmit.", at: at(-7, 16).toISOString() },
      ]),
      history: JSON.stringify([
        { action: "Created", actor: "Tarun Mehta", at: at(-9, 9).toISOString() },
        { action: "Submitted by user", actor: "Tarun Mehta", at: at(-8, 11).toISOString() },
        { action: "Returned for correction — Suresh Babu", actor: "Suresh Babu", at: at(-7, 16).toISOString(), note: "Missing calibration certificate." },
        { action: "Resubmitted by user", actor: "Tarun Mehta", at: at(-1, 18).toISOString() },
      ]),
    },
  });

  // ── BU-scoped demo submissions for Kiran Reddy's BU workspace (BU Admin) ──
  // These are visible in BU-3002's monitor / evidence / timeline views
  const waterProject = waterProjects[0];
  const waterProject2 = waterProjects[1];

  const sub5 = await db.submission.create({
    data: {
      ref: "SUB-BU-3002-001",
      title: "Treated Water — Quality Compliance",
      category: "WATER",
      metricName: "Treated water",
      metricValue: 12450,
      metricUnit: "m³/day",
      status: "APPROVED",
      overdue: false,
      period: PERIOD,
      fiscalQuarter: "Q2",
      dueDate: waterTl.dueDate ?? at(14, 18),
      submittedAt: at(-10, 11),
      reviewedAt: at(-9, 14),
      subsidiaryId: waterSupply.subsidiaryId,
      businessUnitId: waterSupply.id,
      projectId: waterProject.id,
      submittedById: (await db.user.findFirst({ where: { subsidiaryId: waterSupply.subsidiaryId, role: "ENV_DATA_USER" }, select: { id: true } }))?.id,
      reviewerId: (await db.user.findFirst({ where: { subsidiaryId: waterSupply.subsidiaryId, role: "BU_MANAGER" }, select: { id: true } }))?.id,
      values: JSON.stringify([
        { label: "Reported value", value: 12450, unit: "m³/day" },
        { label: "Prior period", value: 11980, unit: "m³/day" },
        { label: "Data points", value: 30, unit: "entries" },
      ]),
      evidence: JSON.stringify(["lab-test-bu3002-001.pdf", "log-sheet-bu3002-001.xlsx"]),
      comments: JSON.stringify([
        { author: "Kiran Reddy", role: "BU_ADMIN", text: "Lab test attached — awaiting BU Manager review.", at: at(-10, 14).toISOString() },
      ]),
      history: JSON.stringify([
        { action: "Created", actor: "Lab Analyst", at: at(-12, 9).toISOString() },
        { action: "Submitted by user", actor: "Lab Analyst", at: at(-10, 11).toISOString() },
        { action: "Approved by BU Manager", actor: "Prasad Patil", at: at(-9, 14).toISOString() },
      ]),
    },
  });

  const sub6 = await db.submission.create({
    data: {
      ref: "SUB-BU-3002-002",
      title: "Pipeline Loss — Leakage Volume",
      category: "WATER",
      metricName: "Pipeline loss",
      metricValue: 4.8,
      metricUnit: "%",
      status: "SUBMITTED",
      overdue: false,
      period: PERIOD,
      fiscalQuarter: "Q2",
      dueDate: waterTl.dueDate ?? at(14, 18),
      submittedAt: at(-2, 14),
      reviewedAt: null,
      subsidiaryId: waterSupply.subsidiaryId,
      businessUnitId: waterSupply.id,
      projectId: waterProject2.id,
      submittedById: (await db.user.findFirst({ where: { subsidiaryId: waterSupply.subsidiaryId, role: "ENV_DATA_USER" }, select: { id: true } }))?.id,
      reviewerId: null,
      values: JSON.stringify([
        { label: "Reported value", value: 4.8, unit: "%" },
        { label: "Prior period", value: 5.2, unit: "%" },
        { label: "Data points", value: 30, unit: "entries" },
      ]),
      evidence: JSON.stringify(["leakage-log-bu3002-002.xlsx"]),
      comments: JSON.stringify([]),
      history: JSON.stringify([
        { action: "Created", actor: "Field Engineer", at: at(-4, 9).toISOString() },
        { action: "Submitted by user", actor: "Field Engineer", at: at(-2, 14).toISOString() },
      ]),
    },
  });

  // ── Evidence docs for the BU demo submissions (versioned, with metadata) ──
  await db.evidenceDoc.createMany({
    data: [
      {
        name: "cemso-report-bu1001-001.pdf",
        fileType: "PDF",
        sizeKb: 482,
        version: 1,
        subsidiaryId: thermal.subsidiaryId,
        businessUnitId: thermal.id,
        projectId: projectThermal.id,
        submissionId: sub1.id,
        submissionRef: sub1.ref,
        disclosureRef: "BRSR-C2-ENR-EM-01",
        uploadedBy: "Tarun Mehta",
        status: "VALID",
        uploadedAt: at(-1, 14),
      },
      {
        name: "calibration-bu1001-001.pdf",
        fileType: "PDF",
        sizeKb: 218,
        version: 1,
        subsidiaryId: thermal.subsidiaryId,
        businessUnitId: thermal.id,
        projectId: projectThermal.id,
        submissionId: sub1.id,
        submissionRef: sub1.ref,
        disclosureRef: "BRSR-C2-ENR-EM-02",
        uploadedBy: "Tarun Mehta",
        status: "VALID",
        uploadedAt: at(-1, 14),
      },
      {
        name: "meter-log-bu1001-002.xlsx",
        fileType: "XLSX",
        sizeKb: 96,
        version: 2,
        subsidiaryId: thermal.subsidiaryId,
        businessUnitId: thermal.id,
        projectId: projectThermal2.id,
        submissionId: sub2.id,
        submissionRef: sub2.ref,
        disclosureRef: "BRSR-C2-WTR-01",
        uploadedBy: "Tarun Mehta",
        status: "VALID",
        uploadedAt: at(-6, 11),
      },
      {
        name: "aux-power-bu1001-004.xlsx",
        fileType: "XLSX",
        sizeKb: 124,
        version: 2,
        subsidiaryId: thermal.subsidiaryId,
        businessUnitId: thermal.id,
        projectId: projectThermal2.id,
        submissionId: sub4.id,
        submissionRef: sub4.ref,
        disclosureRef: "BRSR-C2-ENR-EN-01",
        uploadedBy: "Tarun Mehta",
        status: "VALID",
        uploadedAt: at(-1, 18),
      },
      {
        name: "calibration-bu1001-004.pdf",
        fileType: "PDF",
        sizeKb: 198,
        version: 1,
        subsidiaryId: thermal.subsidiaryId,
        businessUnitId: thermal.id,
        projectId: projectThermal2.id,
        submissionId: sub4.id,
        submissionRef: sub4.ref,
        disclosureRef: "BRSR-C2-ENR-EN-02",
        uploadedBy: "Tarun Mehta",
        status: "VALID",
        uploadedAt: at(-1, 18),
      },
      {
        name: "lab-test-bu3002-001.pdf",
        fileType: "PDF",
        sizeKb: 312,
        version: 1,
        subsidiaryId: waterSupply.subsidiaryId,
        businessUnitId: waterSupply.id,
        projectId: waterProject.id,
        submissionId: sub5.id,
        submissionRef: sub5.ref,
        disclosureRef: "BRSR-C2-WTR-02",
        uploadedBy: "Lab Analyst",
        status: "VALID",
        uploadedAt: at(-10, 11),
      },
      {
        name: "log-sheet-bu3002-001.xlsx",
        fileType: "XLSX",
        sizeKb: 84,
        version: 1,
        subsidiaryId: waterSupply.subsidiaryId,
        businessUnitId: waterSupply.id,
        projectId: waterProject.id,
        submissionId: sub5.id,
        submissionRef: sub5.ref,
        disclosureRef: "BRSR-C2-WTR-03",
        uploadedBy: "Lab Analyst",
        status: "VALID",
        uploadedAt: at(-10, 11),
      },
      {
        name: "leakage-log-bu3002-002.xlsx",
        fileType: "XLSX",
        sizeKb: 76,
        version: 1,
        subsidiaryId: waterSupply.subsidiaryId,
        businessUnitId: waterSupply.id,
        projectId: waterProject2.id,
        submissionId: sub6.id,
        submissionRef: sub6.ref,
        disclosureRef: "BRSR-C2-WTR-04",
        uploadedBy: "Field Engineer",
        status: "VALID",
        uploadedAt: at(-2, 14),
      },
    ],
  });

  // ── Validation issues for the BU demo submissions ──
  // SUB-BU-1001-002 has missing evidence (only meter-log attached, no test report)
  // SUB-BU-1001-003 has zero evidence → MISSING_EVIDENCE
  // SUB-BU-1001-004 has resubmission-history but unit mismatch flag
  await db.validationIssue.createMany({
    data: [
      {
        ref: "VAL-BU-1001-002",
        rule: "MISSING_EVIDENCE",
        severity: "WARNING",
        description: "Water withdrawal submission lacks the lab calibration certificate typically attached for meter accuracy verification.",
        subsidiaryId: thermal.subsidiaryId,
        businessUnitId: thermal.id,
        projectId: projectThermal2.id,
        submissionId: sub2.id,
        status: "OPEN",
        detectedAt: at(-6, 12),
      },
      {
        ref: "VAL-BU-1001-003",
        rule: "MISSING_EVIDENCE",
        severity: "CRITICAL",
        description: "Fly ash utilisation submission has zero supporting evidence — please attach the disposal log and consignment note.",
        subsidiaryId: thermal.subsidiaryId,
        businessUnitId: thermal.id,
        projectId: projectThermal.id,
        submissionId: sub3.id,
        status: "OPEN",
        detectedAt: at(-2, 16),
      },
      {
        ref: "VAL-BU-1001-004",
        rule: "UNIT_MISMATCH",
        severity: "WARNING",
        description: "Auxiliary power value (8.21%) appears inconsistent with the previous period (8.45%) — please confirm the unit-conversion basis for the resubmitted version.",
        subsidiaryId: thermal.subsidiaryId,
        businessUnitId: thermal.id,
        projectId: projectThermal2.id,
        submissionId: sub4.id,
        status: "OPEN",
        detectedAt: at(-1, 19),
      },
      {
        ref: "VAL-BU-3002-002",
        rule: "CALCULATION_EXCEPTION",
        severity: "WARNING",
        description: "Pipeline loss calculation reports 4.8% — the prior-period trend was 5.2%. Please verify the denominator basis (gross vs net supply).",
        subsidiaryId: waterSupply.subsidiaryId,
        businessUnitId: waterSupply.id,
        projectId: waterProject2.id,
        submissionId: sub6.id,
        status: "OPEN",
        detectedAt: at(-2, 15),
      },
    ],
  });

  // ── Queue notification for Suresh Babu's bell — fires across all consoles
  //    (subsidiaryId = null = broadcast). Visible to: Group Admin bell,
  //    Subsidiary Admin/Manager bells, BU Admin/Manager bells. ──
  await db.notification.create({
    data: {
      ntype: "BU_DEMO",
      title: "BU review queue — 3 reports awaiting decision",
      body: "Three Thermal BU reports are awaiting your review: SUB-BU-1001-001, SUB-BU-1001-002 (overdue), SUB-BU-1001-003 (missing evidence).",
      severity: "WARNING",
      linkView: "queue",
      refId: sub2.id,
      subsidiaryId: null,
      createdAt: at(-1, 19),
    },
  });

  await db.notification.create({
    data: {
      ntype: "BU_DEMO",
      title: "Resubmission received — Auxiliary Power",
      body: "SUB-BU-1001-004 was resubmitted by Tarun Mehta after the corrections you requested. Please re-review.",
      severity: "INFO",
      linkView: "queue",
      refId: sub4.id,
      subsidiaryId: null,
      createdAt: at(-1, 18),
    },
  });

  // ── BU-scoped tasks for the BU Admin's tasks view ──
  // (Kiran Reddy — BU Admin Water Supply — should see operational follow-ups)
  const buTasks = [
    {
      ref: "TSK-BU-3002-001",
      title: "Verify lab calibration for Marathwada Water Grid",
      category: "WATER",
      priority: "HIGH",
      status: "ACTIVE",
      startDate: at(-2, 9),
      dueDate: at(3, 18),
      assigneeFilter: JSON.stringify({ businessUnitId: waterSupply.id, role: "ENV_DATA_USER" }),
      subsidiaryId: waterSupply.subsidiaryId,
      businessUnitId: waterSupply.id,
      requiresEvidence: true,
      completed: 0,
      recipients: 3,
    },
    {
      ref: "TSK-BU-3002-002",
      title: "Coordinate leak detection survey — Vidarbha",
      category: "WATER",
      priority: "MEDIUM",
      status: "UPCOMING",
      startDate: at(2, 9),
      dueDate: at(10, 18),
      assigneeFilter: JSON.stringify({ businessUnitId: waterSupply.id, role: "EHS_USER" }),
      subsidiaryId: waterSupply.subsidiaryId,
      businessUnitId: waterSupply.id,
      requiresEvidence: false,
      completed: 0,
      recipients: 2,
    },
    {
      ref: "TSK-BU-3002-003",
      title: "Submit Q2 BU reporting package to Subsidiary",
      category: "COMPLIANCE",
      priority: "CRITICAL",
      status: "OVERDUE",
      startDate: at(-15, 9),
      dueDate: at(-1, 18),
      assigneeFilter: JSON.stringify({ businessUnitId: waterSupply.id, role: "BU_ADMIN" }),
      subsidiaryId: waterSupply.subsidiaryId,
      businessUnitId: waterSupply.id,
      requiresEvidence: false,
      completed: 0,
      recipients: 1,
    },
  ];
  // Skip duplicates idempotently: delete existing tasks with these refs first.
  await db.task.deleteMany({ where: { ref: { in: buTasks.map((t) => t.ref) } } });
  await Promise.all(buTasks.map((t) => db.task.create({ data: t })));

  console.log("BU workspace seed complete:");
  console.log(`  BU timelines: ${await db.reportingTimeline.count({ where: { level: "BUSINESS_UNIT" } })}`);
  console.log(`  BU validation issues: ${await db.validationIssue.count({ where: { businessUnitId: { not: null } } })}`);
  console.log(`  BU evidence docs: ${await db.evidenceDoc.count({ where: { businessUnitId: { not: null } } })}`);
  console.log(`  BU demo submissions: ${await db.submission.count({ where: { ref: { contains: "BU-" } } })}`);
  console.log(`  BU demo notifications: ${await db.notification.count({ where: { ntype: "BU_DEMO" } })}`);
  console.log(`  BU demo tasks: ${await db.task.count({ where: { ref: { contains: "BU-" } } })}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
