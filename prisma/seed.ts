/**
 * MEIL ESG & BRSR Platform — demo data seeder.
 * Run: bun prisma/seed.ts
 * THEN provision portal credentials:  bun prisma/seed-auth.ts
 * (seed-auth assigns employeeIds + password hashes for the Enter-Platform
 *  gateway — demo password "Esg@2025", Group Admin GRP-0001 / arun.bhaskar@meil.in)
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const DAY = 86400000;
const now = Date.now();
const at = (daysOffset: number, hour = 10) => {
  const d = new Date(now + daysOffset * DAY);
  d.setHours(hour, (daysOffset * 13) % 60, 0, 0);
  return d;
};

async function main() {
  console.log("Clearing existing data…");
  await db.auditEvent.deleteMany();
  await db.activityEvent.deleteMany();
  await db.message.deleteMany();
  await db.notification.deleteMany();
  await db.task.deleteMany();
  await db.submission.deleteMany();
  await db.brsrReport.deleteMany();
  await db.disclosure.deleteMany();
  await db.appSetting.deleteMany();
  await db.user.deleteMany();
  await db.project.deleteMany();
  await db.businessUnit.deleteMany();
  await db.subsidiary.deleteMany();

  // ── Subsidiaries ──────────────────────────────────────────────
  const subs = await Promise.all(
    [
      { code: "SUB-ENR", name: "MEIL Energy Ltd", sector: "Power & Energy", region: "South India", city: "Hyderabad", managerName: "Rajesh Menon", adminName: "Priya Deshmukh", description: "Thermal & renewable power generation portfolio." },
      { code: "SUB-INF", name: "MEIL Infrastructure Ltd", sector: "Infrastructure", region: "Pan India", city: "Hyderabad", managerName: "Anil Kapoor", adminName: "Sunita Rao", description: "Roads, tunnels, irrigation and urban infrastructure." },
      { code: "SUB-WTR", name: "MEIL Water Systems Ltd", sector: "Water & Environment", region: "West India", city: "Mumbai", managerName: "Vikram Shetty", adminName: "Kavita Nair", description: "Water supply, desalination and treatment plants." },
      { code: "SUB-OVS", name: "MEIL Global Holdings", sector: "Overseas Operations", region: "International", city: "Singapore", managerName: "Daniel Foo", adminName: "Mei Ling Tan", description: "International EPC projects and holdings." },
    ].map((s) => db.subsidiary.create({ data: s }))
  );

  // ── Business units ────────────────────────────────────────────
  const unitDefs: { code: string; name: string; sub: number; managerName: string; adminName: string }[] = [
    { code: "BU-THERMAL", name: "Thermal Generation", sub: 0, managerName: "Suresh Babu", adminName: "Latha Krishnan" },
    { code: "BU-RE", name: "Renewable Energy", sub: 0, managerName: "Arvind Swamy", adminName: "Divya Iyer" },
    { code: "BU-ROAD", name: "Roads & Highways", sub: 1, managerName: "Manoj Sharma", adminName: "Rekha Pillai" },
    { code: "BU-IRR", name: "Irrigation & Tunnels", sub: 1, managerName: "Harish Chandra", adminName: "Gopal Rao" },
    { code: "BU-URBAN", name: "Urban Infrastructure", sub: 1, managerName: "Naveen Kumar", adminName: "Shalini Verma" },
    { code: "BU-DESAL", name: "Desalination", sub: 2, managerName: "Prasad Patil", adminName: "Anita Joshi" },
    { code: "BU-WTRSUP", name: "Water Supply", sub: 2, managerName: "Kiran Reddy", adminName: "Jyothi Rao" },
    { code: "BU-EPC", name: "Overseas EPC", sub: 3, managerName: "Wei Zhang", adminName: "Arjun Nair" },
    { code: "BU-HOLD", name: "Holdings & Advisory", sub: 3, managerName: "Sanjay Gupta", adminName: "Farah Khan" },
  ];
  const units = await Promise.all(
    unitDefs.map((u) =>
      db.businessUnit.create({
        data: { code: u.code, name: u.name, subsidiaryId: subs[u.sub].id, managerName: u.managerName, adminName: u.adminName },
      })
    )
  );

  // ── Projects / sites ──────────────────────────────────────────
  const projDefs: { code: string; name: string; unit: number; location: string; ptype: string; capacityMw: number; status?: string }[] = [
    { code: "PRJ-KTPP", name: "Kothagudem Thermal Plant", unit: 0, location: "Telangana", ptype: "PLANT", capacityMw: 1080 },
    { code: "PRJ-STPP", name: "Singareppi Thermal Expansion", unit: 0, location: "Telangana", ptype: "PLANT", capacityMw: 800 },
    { code: "PRJ-PVAN", name: "Pavagada Solar Park", unit: 1, location: "Karnataka", ptype: "SOLAR_PARK", capacityMw: 600 },
    { code: "PRJ-WIND", name: "Anantapur Wind Cluster", unit: 1, location: "Andhra Pradesh", ptype: "WIND_FARM", capacityMw: 300 },
    { code: "PRJ-NH48", name: "NH-48 Highway Package", unit: 2, location: "Maharashtra", ptype: "SITE", capacityMw: 0 },
    { code: "PRJ-RING", name: "Hyderabad Regional Ring Road", unit: 2, location: "Telangana", ptype: "SITE", capacityMw: 0 },
    { code: "PRJ-KLBD", name: "Kaleshwaram Lift Package-12", unit: 3, location: "Telangana", ptype: "SITE", capacityMw: 0 },
    { code: "PRJ-TUNL", name: "Srisailam Left Bank Tunnel", unit: 3, location: "Telangana", ptype: "SITE", capacityMw: 0 },
    { code: "PRJ-METRO", name: "Metro Rail Package-7", unit: 4, location: "Tamil Nadu", ptype: "SITE", capacityMw: 0 },
    { code: "PRJ-DESAL", name: "Chennai Desalination Plant-2", unit: 5, location: "Tamil Nadu", ptype: "PLANT", capacityMw: 0 },
    { code: "PRJ-WTR1", name: "Marathwada Water Grid", unit: 6, location: "Maharashtra", ptype: "PIPELINE", capacityMw: 0 },
    { code: "PRJ-WTR2", name: "Vidarbha Supply Scheme", unit: 6, location: "Maharashtra", ptype: "PIPELINE", capacityMw: 0 },
    { code: "PRJ-PH2", name: "Philippines Highway Package-2", unit: 7, location: "Philippines", ptype: "SITE", capacityMw: 0 },
    { code: "PRJ-ZAMB", name: "Zambia Hydropower Rehab", unit: 7, location: "Zambia", ptype: "HYDRO", capacityMw: 120 },
    { code: "PRJ-CORP", name: "Corporate Office Campus", unit: 8, location: "Hyderabad", ptype: "OFFICE", capacityMw: 0 },
    { code: "PRJ-SG", name: "Singapore Advisory Desk", unit: 8, location: "Singapore", ptype: "OFFICE", capacityMw: 0, status: "INACTIVE" },
  ];
  const projects = await Promise.all(
    projDefs.map((p) =>
      db.project.create({
        data: {
          code: p.code, name: p.name, businessUnitId: units[p.unit].id,
          location: p.location, ptype: p.ptype, capacityMw: p.capacityMw, status: p.status ?? "ACTIVE",
        },
      })
    )
  );

  // ── Users (11 role types) ─────────────────────────────────────
  const userDefs: { name: string; email: string; role: string; sub?: number; unit?: number; proj?: number; title: string; status?: string; lastActive?: number }[] = [
    { name: "Arun Bhaskar", email: "arun.bhaskar@meil.in", role: "GROUP_ADMIN", title: "Group Administrator", lastActive: 0 },
    { name: "Rajesh Menon", email: "rajesh.menon@meil.in", role: "SUBSIDIARY_MANAGER", sub: 0, title: "MD — MEIL Energy", lastActive: 0 },
    { name: "Anil Kapoor", email: "anil.kapoor@meil.in", role: "SUBSIDIARY_MANAGER", sub: 1, title: "MD — MEIL Infrastructure", lastActive: 1 },
    { name: "Vikram Shetty", email: "vikram.shetty@meil.in", role: "SUBSIDIARY_MANAGER", sub: 2, title: "MD — MEIL Water Systems", lastActive: 2 },
    { name: "Daniel Foo", email: "daniel.foo@meilglobal.com", role: "SUBSIDIARY_MANAGER", sub: 3, title: "MD — MEIL Global", lastActive: 5 },
    { name: "Priya Deshmukh", email: "priya.deshmukh@meil.in", role: "SUBSIDIARY_ADMIN", sub: 0, title: "Subsidiary ESG Admin", lastActive: 1 },
    { name: "Sunita Rao", email: "sunita.rao@meil.in", role: "SUBSIDIARY_ADMIN", sub: 1, title: "Subsidiary ESG Admin", lastActive: 3 },
    { name: "Kavita Nair", email: "kavita.nair@meil.in", role: "SUBSIDIARY_ADMIN", sub: 2, title: "Subsidiary ESG Admin", lastActive: 4 },
    { name: "Mei Ling Tan", email: "meiling.tan@meilglobal.com", role: "SUBSIDIARY_ADMIN", sub: 3, title: "Subsidiary ESG Admin", lastActive: 6 },
    { name: "Suresh Babu", email: "suresh.babu@meil.in", role: "BU_MANAGER", sub: 0, unit: 0, title: "BU Head — Thermal", lastActive: 0 },
    { name: "Arvind Swamy", email: "arvind.swamy@meil.in", role: "BU_MANAGER", sub: 0, unit: 1, title: "BU Head — Renewables", lastActive: 1 },
    { name: "Manoj Sharma", email: "manoj.sharma@meil.in", role: "BU_MANAGER", sub: 1, unit: 2, title: "BU Head — Roads", lastActive: 2 },
    { name: "Harish Chandra", email: "harish.chandra@meil.in", role: "BU_MANAGER", sub: 1, unit: 3, title: "BU Head — Irrigation", lastActive: 3 },
    { name: "Prasad Patil", email: "prasad.patil@meil.in", role: "BU_MANAGER", sub: 2, unit: 5, title: "BU Head — Desalination", lastActive: 4 },
    { name: "Kiran Reddy", email: "kiran.reddy@meil.in", role: "BU_ADMIN", sub: 2, unit: 6, title: "BU Admin — Water Supply", lastActive: 2 },
    { name: "Wei Zhang", email: "wei.zhang@meilglobal.com", role: "BU_MANAGER", sub: 3, unit: 7, title: "BU Head — Overseas EPC", lastActive: 7 },
    { name: "Naveen Kumar", email: "naveen.kumar@meil.in", role: "BU_ADMIN", sub: 1, unit: 4, title: "BU Admin — Urban", lastActive: 5 },
    { name: "Ramesh Iyer", email: "ramesh.iyer@meil.in", role: "ENV_DATA_USER", sub: 0, unit: 0, proj: 0, title: "Environment Data Officer", lastActive: 0 },
    { name: "Deepa Krishnan", email: "deepa.krishnan@meil.in", role: "ENV_DATA_USER", sub: 0, unit: 1, proj: 2, title: "Environment Data Officer", lastActive: 1 },
    { name: "Santosh Rao", email: "santosh.rao@meil.in", role: "FIN_RESOURCE_USER", sub: 0, unit: 0, proj: 1, title: "Finance & Resource Analyst", lastActive: 1 },
    { name: "Aparna Das", email: "aparna.das@meil.in", role: "HR_USER", sub: 1, unit: 2, proj: 4, title: "HR Data Coordinator", lastActive: 2 },
    { name: "Mohit Jain", email: "mohit.jain@meil.in", role: "EHS_USER", sub: 0, unit: 0, proj: 0, title: "EHS Safety Officer", lastActive: 0 },
    { name: "Sneha Kulkarni", email: "sneha.kulkarni@meil.in", role: "EHS_USER", sub: 1, unit: 3, proj: 7, title: "EHS Safety Officer", lastActive: 1 },
    { name: "Ravi Teja", email: "ravi.teja@meil.in", role: "PROCUREMENT_USER", sub: 1, unit: 2, proj: 5, title: "Procurement Analyst", lastActive: 3 },
    { name: "Lakshmi Prasad", email: "lakshmi.prasad@meil.in", role: "CSR_USER", sub: 2, unit: 6, proj: 11, title: "CSR Program Lead", lastActive: 4 },
    { name: "Farhan Ali", email: "farhan.ali@meil.in", role: "COMPLIANCE_USER", sub: 2, unit: 5, proj: 9, title: "Compliance Officer", lastActive: 1 },
    { name: "Gita Sharma", email: "gita.sharma@meil.in", role: "COMPLIANCE_USER", sub: 1, unit: 4, proj: 8, title: "Compliance Officer", lastActive: 6 },
    { name: "Tarun Bhatia", email: "tarun.bhatia@meil.in", role: "ENV_DATA_USER", sub: 2, unit: 5, proj: 9, title: "Environment Data Officer", lastActive: 2 },
    { name: "Nikhil Chandra", email: "nikhil.chandra@meil.in", role: "EHS_USER", sub: 3, unit: 7, proj: 13, title: "EHS Safety Officer", status: "SUSPENDED", lastActive: 21 },
    { name: "Old Contractor", email: "old.contractor@meil.in", role: "FIN_RESOURCE_USER", sub: 1, unit: 2, proj: 4, title: "Contract Finance", status: "INACTIVE", lastActive: 90 },
    { name: "New Joiner — ESG", email: "new.joiner@meil.in", role: "HR_USER", sub: 0, unit: 1, title: "HR Data Coordinator", status: "INVITED" },
  ];
  /* Presence realism: `lastActive` 0 = "online now" (spread over the last ~25 min),
     1–5 = hours ago (today / yesterday), ≥6 = days ago (offline). */
  let onlineIdx = 0;
  const users = await Promise.all(
    userDefs.map((u) => {
      let lastActiveAt: Date | null = null;
      if (u.lastActive !== undefined) {
        if (u.lastActive === 0) lastActiveAt = new Date(now - (2 + onlineIdx++ * 5) * 60000);
        else if (u.lastActive < 6) lastActiveAt = new Date(now - (u.lastActive * 7 + 2) * 3600000);
        else lastActiveAt = at(-u.lastActive, 9);
      }
      return db.user.create({
        data: {
          name: u.name, email: u.email, role: u.role, status: u.status ?? "ACTIVE",
          subsidiaryId: u.sub !== undefined ? subs[u.sub].id : null,
          businessUnitId: u.unit !== undefined ? units[u.unit].id : null,
          projectId: u.proj !== undefined ? projects[u.proj].id : null,
          title: u.title, lastActiveAt,
        },
      });
    })
  );
  const uIdx = (email: string) => users.find((u) => u.email.startsWith(email))!.id;

  // ── Submissions ───────────────────────────────────────────────
  type SubDef = { title: string; category: string; metricName: string; metricValue: number; metricUnit: string; status: string; overdue?: boolean; days: number; sub: number; unit: number; proj?: number; by: string; reviewer?: string; quarter?: string };
  const subDefs: SubDef[] = [
    { title: "Scope 1 — Stationary Combustion Emissions", category: "EMISSIONS", metricName: "Scope 1 GHG", metricValue: 48210, metricUnit: "tCO2e", status: "UNDER_REVIEW", days: -4, sub: 0, unit: 0, proj: 0, by: "ramesh", reviewer: "arun.bhaskar" },
    { title: "Scope 2 — Purchased Electricity", category: "EMISSIONS", metricName: "Scope 2 GHG", metricValue: 31540, metricUnit: "tCO2e", status: "APPROVED", days: -9, sub: 0, unit: 0, proj: 0, by: "ramesh", reviewer: "priya.deshmukh" },
    { title: "Diesel Consumption — Generators", category: "ENERGY", metricName: "Diesel", metricValue: 1284, metricUnit: "kL", status: "APPROVED", days: -11, sub: 0, unit: 0, proj: 0, by: "santosh", reviewer: "priya.deshmukh" },
    { title: "Renewable Energy Share — Solar", category: "ENERGY", metricName: "Renewable share", metricValue: 31.6, metricUnit: "%", status: "SUBMITTED", days: -2, sub: 0, unit: 1, proj: 2, by: "deepa" },
    { title: "Fresh Water Withdrawal", category: "WATER", metricName: "Water withdrawal", metricValue: 84200, metricUnit: "m³", status: "APPROVED", days: -14, sub: 2, unit: 5, proj: 9, by: "tarun", reviewer: "kavita.nair" },
    { title: "Waste — Hazardous Disposed", category: "WASTE", metricName: "Hazardous waste", metricValue: 46.2, metricUnit: "t", status: "CHANGES_REQUESTED", days: -6, sub: 0, unit: 0, proj: 1, by: "ramesh", reviewer: "priya.deshmukh" },
    { title: "Lost Time Injury Frequency Rate", category: "SAFETY", metricName: "LTIFR", metricValue: 0.42, metricUnit: "per mn hrs", status: "APPROVED", days: -16, sub: 1, unit: 3, proj: 7, by: "sneha", reviewer: "sunita.rao" },
    { title: "Employee Training Hours", category: "WORKFORCE", metricName: "Training hrs", metricValue: 12480, metricUnit: "hrs", status: "SUBMITTED", days: -3, sub: 1, unit: 2, proj: 4, by: "aparna" },
    { title: "Supplier Local Sourcing %", category: "PROCUREMENT", metricName: "Local sourcing", metricValue: 68.4, metricUnit: "%", status: "UNDER_REVIEW", days: -5, sub: 1, unit: 2, proj: 5, by: "ravi.teja", reviewer: "sunita.rao" },
    { title: "CSR Beneficiaries — Communities", category: "CSR", metricName: "Beneficiaries", metricValue: 15230, metricUnit: "persons", status: "APPROVED", days: -18, sub: 2, unit: 6, proj: 11, by: "lakshmi", reviewer: "kavita.nair" },
    { title: "Regulatory Non-Compliance Events", category: "COMPLIANCE", metricName: "Non-compliance", metricValue: 0, metricUnit: "events", status: "APPROVED", days: -20, sub: 2, unit: 5, proj: 9, by: "farhan", reviewer: "kavita.nair" },
    { title: "Stack Emissions Monitoring", category: "ENVIRONMENT", metricName: "PM (particulate)", metricValue: 28.4, metricUnit: "mg/Nm³", status: "DRAFT", days: -1, sub: 0, unit: 0, proj: 0, by: "ramesh" },
    { title: "Scope 3 — Business Travel", category: "EMISSIONS", metricName: "Scope 3 travel", metricValue: 1240, metricUnit: "tCO2e", status: "SUBMITTED", overdue: true, days: -8, sub: 3, unit: 7, proj: 13, by: "wei.zhang" },
    { title: "Groundwater Drawal", category: "WATER", metricName: "Groundwater", metricValue: 12400, metricUnit: "m³", status: "ASSIGNED", overdue: true, days: -12, sub: 1, unit: 3, proj: 6, by: "sneha" },
    { title: "Energy Intensity — Production", category: "ENERGY", metricName: "Energy intensity", metricValue: 2.84, metricUnit: "GJ/t", status: "REJECTED", days: -7, sub: 0, unit: 0, proj: 0, by: "santosh", reviewer: "arun.bhaskar" },
    { title: "Wastewater Discharge Quality", category: "WATER", metricName: "COD", metricValue: 82, metricUnit: "mg/L", status: "UNDER_REVIEW", days: -2, sub: 2, unit: 5, proj: 9, by: "tarun", reviewer: "kavita.nair" },
    { title: "Women in Workforce %", category: "WORKFORCE", metricName: "Gender diversity", metricValue: 18.2, metricUnit: "%", status: "DRAFT", days: -1, sub: 1, unit: 2, proj: 4, by: "aparna" },
    { title: "Fly Ash Utilization %", category: "WASTE", metricName: "Fly ash reuse", metricValue: 74.1, metricUnit: "%", status: "SUBMITTED", days: -4, sub: 0, unit: 0, proj: 0, by: "ramesh" },
    { title: "Road Safety Incidents", category: "SAFETY", metricName: "Road incidents", metricValue: 2, metricUnit: "events", status: "CHANGES_REQUESTED", overdue: true, days: -10, sub: 1, unit: 2, proj: 5, by: "ravi.teja", reviewer: "sunita.rao" },
    { title: "Green Procurement Spend", category: "PROCUREMENT", metricName: "Green spend", metricValue: 312, metricUnit: "₹ Cr", status: "SUBMITTED", days: -6, sub: 3, unit: 7, proj: 12, by: "wei.zhang" },
    { title: "Employee Turnover Rate", category: "WORKFORCE", metricName: "Turnover", metricValue: 9.6, metricUnit: "%", status: "APPROVED", days: -22, sub: 0, unit: 1, proj: 2, by: "deepa", reviewer: "priya.deshmukh" },
    { title: "Biodiversity — Land Reclaimed", category: "ENVIRONMENT", metricName: "Land reclaimed", metricValue: 112, metricUnit: "ha", status: "SUBMITTED", days: -3, sub: 2, unit: 6, proj: 10, by: "lakshmi" },
    { title: "DG Set Emissions — Office", category: "EMISSIONS", metricName: "Scope 1 DG", metricValue: 184, metricUnit: "tCO2e", status: "UNDER_REVIEW", days: -1, sub: 0, unit: 8, proj: 14, by: "santosh", reviewer: "arun.bhaskar" },
    { title: "Rainwater Harvested", category: "WATER", metricName: "Rainwater", metricValue: 6800, metricUnit: "m³", status: "DRAFT", days: -2, sub: 1, unit: 3, proj: 6, by: "sneha" },
    { title: "Community Investment", category: "CSR", metricName: "CSR spend", metricValue: 42.8, metricUnit: "₹ Cr", status: "APPROVED", days: -25, sub: 0, unit: 1, proj: 2, by: "deepa", reviewer: "priya.deshmukh" },
    { title: "Noise Level Monitoring", category: "ENVIRONMENT", metricName: "Noise", metricValue: 68.2, metricUnit: "dB(A)", status: "SUBMITTED", days: -5, sub: 2, unit: 5, proj: 9, by: "tarun" },
    { title: "Contract Labour Count", category: "WORKFORCE", metricName: "Contract labour", metricValue: 4820, metricUnit: "persons", status: "SUBMITTED", overdue: true, days: -9, sub: 1, unit: 4, proj: 8, by: "aparna" },
    { title: "Spill Events — Fuel & Oil", category: "SAFETY", metricName: "Spills", metricValue: 1, metricUnit: "events", status: "ASSIGNED", days: -3, sub: 3, unit: 7, proj: 13, by: "nikhil" },
  ];
  const reviewers = ["arun.bhaskar", "priya.deshmukh", "sunita.rao", "kavita.nair"];
  const statusFlow: Record<string, string[]> = {
    DRAFT: ["Created"],
    ASSIGNED: ["Created", "Assigned to responsible user"],
    SUBMITTED: ["Created", "Assigned", "Submitted by user"],
    UNDER_REVIEW: ["Created", "Assigned", "Submitted by user", "Under review"],
    CHANGES_REQUESTED: ["Created", "Assigned", "Submitted by user", "Reviewed — changes requested"],
    REJECTED: ["Created", "Assigned", "Submitted by user", "Rejected by reviewer"],
    APPROVED: ["Created", "Assigned", "Submitted by user", "Reviewed", "Approved"],
  };
  let subSeq = 1;
  await Promise.all(
    subDefs.map((s) => {
      const seq = String(subSeq++).padStart(3, "0");
      const submitted = ["SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED", "REJECTED", "APPROVED"].includes(s.status);
      const reviewed = ["CHANGES_REQUESTED", "REJECTED", "APPROVED"].includes(s.status);
      return db.submission.create({
        data: {
          ref: `SUB-2526-${seq}`,
          title: s.title, category: s.category, metricName: s.metricName, metricValue: s.metricValue, metricUnit: s.metricUnit,
          status: s.status, overdue: s.overdue ?? false, period: "FY 2025-26", fiscalQuarter: s.quarter ?? "Q2",
          dueDate: at(-(s.days) - 5), submittedAt: submitted ? at(s.days) : null, reviewedAt: reviewed ? at(s.days + 1) : null,
          subsidiaryId: subs[s.sub].id, businessUnitId: units[s.unit].id, projectId: s.proj !== undefined ? projects[s.proj].id : null,
          submittedById: uIdx(s.by), reviewerId: s.reviewer ? uIdx(s.reviewer) : reviewers[subSeq % reviewers.length],
          values: JSON.stringify([
            { label: "Reported value", value: s.metricValue, unit: s.metricUnit },
            { label: "Prior period", value: +(s.metricValue * 0.92).toFixed(2), unit: s.metricUnit },
            { label: "Data points", value: 12, unit: "entries" },
          ]),
          evidence: JSON.stringify(
            s.status === "DRAFT" ? [] : [`meter-log-${seq}.pdf`, `calculation-sheet-${seq}.xlsx`, ...(subSeq % 3 === 0 ? [`site-photo-${seq}.jpg`] : [])]
          ),
          comments: JSON.stringify(
            s.status === "CHANGES_REQUESTED"
              ? [{ author: "Priya Deshmukh", role: "SUBSIDIARY_ADMIN", text: "Please attach the calibration certificate for the meter used and re-check unit conversion.", at: at(s.days + 1).toISOString() }]
              : s.status === "REJECTED"
                ? [{ author: "Arun Bhaskar", role: "GROUP_ADMIN", text: "Intensity denominator does not match production figures for the period. Return for correction.", at: at(s.days + 1).toISOString() }]
                : []
          ),
          history: JSON.stringify(statusFlow[s.status].map((step, i) => ({ action: step, actor: i === 0 ? "System" : i === statusFlow[s.status].length - 1 && reviewed ? "Group Admin" : "Workflow", at: at(s.days - (statusFlow[s.status].length - i) * 2).toISOString() }))),
        },
      });
    })
  );

  // ── Tasks ─────────────────────────────────────────────────────
  const taskDefs = [
    { title: "Submit Q2 FY26 environmental metrics for Thermal BU", category: "ENVIRONMENT", assigneeType: "BU", assigneeLabel: "Thermal Generation — all eligible users", unit: 0, due: 3, priority: "HIGH", status: "ACTIVE", recipients: 6, ack: 4, done: 1 },
    { title: "Upload Q2 safety incident logs (all projects)", category: "SAFETY", assigneeType: "ROLE", assigneeLabel: "EHS / Safety Users (group-wide)", due: 6, priority: "CRITICAL", status: "ACTIVE", recipients: 5, ack: 3, done: 0 },
    { title: "FY2025-26 H1 HR & workforce data collection", category: "WORKFORCE", assigneeType: "ROLE", assigneeLabel: "HR Users (group-wide)", due: -2, priority: "HIGH", status: "OVERDUE", recipients: 3, ack: 2, done: 0 },
    { title: "Quarterly water withdrawal reconciliation", category: "WATER", assigneeType: "SUBSIDIARY", assigneeLabel: "MEIL Water Systems — all users", sub: 2, due: 9, priority: "MEDIUM", status: "UPCOMING", recipients: 8, ack: 1, done: 0 },
    { title: "Update supplier ESG scores for Q2", category: "PROCUREMENT", assigneeType: "ROLE", assigneeLabel: "Procurement Users", due: 12, priority: "MEDIUM", status: "UPCOMING", recipients: 2, ack: 0, done: 0 },
    { title: "CSR impact report — community programs", category: "CSR", assigneeType: "USER", assigneeLabel: "Lakshmi Prasad", sub: 2, due: -5, priority: "HIGH", status: "OVERDUE", recipients: 1, ack: 1, done: 0 },
    { title: "BRSR Core — leadership integrity disclosures", category: "COMPLIANCE", assigneeType: "ROLE", assigneeLabel: "Compliance Users", due: 15, priority: "MEDIUM", status: "UPCOMING", recipients: 3, ack: 0, done: 0 },
    { title: "Diesel consumption log submission — April", category: "ENERGY", assigneeType: "USER", assigneeLabel: "Santosh Rao", sub: 0, due: -14, priority: "MEDIUM", status: "COMPLETED", recipients: 1, ack: 1, done: 1 },
    { title: "Waste manifest reconciliation — Thermal", category: "WASTE", assigneeType: "USER", assigneeLabel: "Ramesh Iyer", sub: 0, due: -8, priority: "HIGH", status: "COMPLETED", recipients: 1, ack: 1, done: 1 },
    { title: "Q2 emissions data freeze preparation", category: "EMISSIONS", assigneeType: "ALL", assigneeLabel: "All eligible reporting users", due: 20, priority: "CRITICAL", status: "UPCOMING", recipients: 31, ack: 2, done: 0 },
    { title: "Renewable certificate (REC) reconciliation", category: "ENERGY", assigneeType: "BU", assigneeLabel: "Renewable Energy — all eligible users", unit: 1, due: 1, priority: "HIGH", status: "ACTIVE", recipients: 4, ack: 4, done: 2 },
    { title: "Overseas projects — local compliance attestations", category: "COMPLIANCE", assigneeType: "SUBSIDIARY", assigneeLabel: "MEIL Global Holdings — all users", sub: 3, due: 18, priority: "MEDIUM", status: "UPCOMING", recipients: 6, ack: 0, done: 0 },
  ];
  await Promise.all(
    taskDefs.map((t, i) =>
      db.task.create({
        data: {
          ref: `TSK-2526-${String(i + 1).padStart(3, "0")}`,
          title: t.title, description: "Consolidated reporting instruction issued by Group ESG office. Provide supporting evidence with each data point.",
          category: t.category, assigneeType: t.assigneeType, assigneeLabel: t.assigneeLabel,
          subsidiaryId: t.sub !== undefined ? subs[t.sub].id : null,
          businessUnitId: t.unit !== undefined ? units[t.unit].id : null,
          period: "FY 2025-26", startDate: at(-20), dueDate: at(t.due), priority: t.priority, status: t.status,
          requiresEvidence: true, recipients: t.recipients, acknowledged: t.ack, completed: t.done,
          remindersSent: t.status === "OVERDUE" ? 2 : t.status === "ACTIVE" ? 1 : 0,
          reminderLog: JSON.stringify(t.status === "OVERDUE" ? [{ at: at(-3).toISOString(), channel: "In-app" }, { at: at(-1).toISOString(), channel: "In-app" }] : []),
        },
      })
    )
  );

  // ── Notifications ─────────────────────────────────────────────
  const notifs = [
    { ntype: "OVERDUE", title: "2 submissions overdue in Roads & Highways", body: "Groundwater Drawal and Road Safety Incidents have crossed their due dates. Escalation to BU Manager is pending.", severity: "CRITICAL", read: false, linkView: "submissions" },
    { ntype: "SUBMISSION", title: "New submission under review", body: "Scope 1 — Stationary Combustion Emissions submitted by Ramesh Iyer awaits your review.", severity: "INFO", read: false, linkView: "approvals" },
    { ntype: "APPROVAL", title: "Bulk approval completed", body: "4 submissions approved for MEIL Water Systems in the last batch.", severity: "SUCCESS", read: false, linkView: "approvals" },
    { ntype: "DEADLINE", title: "Q2 data freeze in 20 days", body: "All eligible users must complete submissions before the Q2 FY26 freeze.", severity: "WARNING", read: true, linkView: "tasks" },
    { ntype: "DATA_QUALITY", title: "Unit mismatch detected", body: "Waste — Hazardous Disposed: reported in kg instead of tonnes. Correction requested.", severity: "WARNING", read: false, linkView: "consolidation" },
    { ntype: "SYSTEM", title: "Nightly consolidation job completed", body: "Data consolidation engine processed 1,240 records with 3 exceptions.", severity: "INFO", read: true, linkView: "consolidation" },
    { ntype: "SUBMISSION", title: "Resubmission received", body: "Waste — Hazardous Disposed was resubmitted with calibration certificates.", severity: "INFO", read: true, linkView: "submissions" },
    { ntype: "DEADLINE", title: "Reminder wave sent", body: "Automatic reminders dispatched for 2 tasks approaching due dates.", severity: "INFO", read: true, linkView: "tasks" },
    { ntype: "APPROVAL", title: "BRSR draft awaiting sign-off", body: "FY 2024-25 BRSR report sign-off reminder: CFO sign-off pending.", severity: "WARNING", read: false, linkView: "brsr" },
  ];
  await Promise.all(notifs.map((n, i) => db.notification.create({ data: { ...n, refId: "", createdAt: at(-i, 8 + i) } })));

  // ── Messages ──────────────────────────────────────────────────
  const msgs = [
    { kind: "ANNOUNCEMENT", channel: "GROUP_WIDE", subject: "FY 2025-26 BRSR reporting calendar published", body: "The consolidated reporting calendar for FY 2025-26 is now available. Q2 data freeze is scheduled in 20 days. Please review your submission schedule.", audienceLabel: "All eligible reporting users", recipients: 31, delivered: 31, failed: 0, readCount: 24, status: "SENT", createdAt: at(-4) },
    { kind: "REMINDER", channel: "ROLE_GROUP", subject: "Overdue: HR & workforce data collection", body: "The FY2025-26 H1 workforce data collection is overdue. Kindly submit at the earliest to avoid escalation.", audienceLabel: "HR Users", audienceFilter: JSON.stringify({ role: "HR_USER" }), recipients: 3, delivered: 3, failed: 0, readCount: 2, status: "SENT", createdAt: at(-2) },
    { kind: "MESSAGE", channel: "DIRECT", subject: "Clarification on Scope 3 travel data", body: "Hi Wei, please confirm the travel distance methodology used for the Philippines package.", audienceLabel: "Wei Zhang", recipients: 1, delivered: 1, failed: 0, readCount: 1, status: "SENT", createdAt: at(-1) },
    { kind: "POLICY", channel: "GROUP_WIDE", subject: "Updated ESG evidence policy v2.1", body: "All submissions must now include meter calibration certificates where applicable. Policy effective immediately.", audienceLabel: "All eligible reporting users", recipients: 31, delivered: 30, failed: 1, readCount: 17, status: "SENT", createdAt: at(-7) },
    { kind: "ANNOUNCEMENT", channel: "SUBSIDIARY", subject: "Water Systems — audit preparation week", body: "Internal ESG audit will run next week across desalination and water supply BUs.", audienceLabel: "MEIL Water Systems Ltd", audienceFilter: JSON.stringify({ subsidiaryIndex: 2 }), recipients: 8, delivered: 8, failed: 0, readCount: 5, status: "SENT", createdAt: at(-5) },
    { kind: "ANNOUNCEMENT", channel: "GROUP_WIDE", subject: "Scheduled: Q3 reporting kickoff", body: "Q3 FY26 reporting kickoff session — scheduled announcement.", audienceLabel: "All eligible reporting users", recipients: 31, delivered: 0, failed: 0, readCount: 0, status: "SCHEDULED", scheduledFor: at(10), createdAt: at(-1) },
  ];
  await Promise.all(msgs.map((m) => db.message.create({ data: { ...m, sentBy: "Group Admin" } })));

  // ── Disclosure catalog ────────────────────────────────────────
  const disclosures = [
    { code: "BRSR-ENV-01", section: "ENVIRONMENT", title: "Total energy consumption (kWh)", unit: "GWh", description: "Aggregate electricity, fuel and other energy sources." },
    { code: "BRSR-ENV-02", section: "ENVIRONMENT", title: "Renewable energy share", unit: "%", description: "Share of renewables in total consumption." },
    { code: "BRSR-ENV-03", section: "ENVIRONMENT", title: "Energy intensity per rupee of turnover", unit: "GJ/₹ Cr", description: "Energy per unit of turnover." },
    { code: "BRSR-ENV-04", section: "ENVIRONMENT", title: "Scope 1 GHG emissions", unit: "tCO2e", description: "Direct emissions from owned/controlled sources." },
    { code: "BRSR-ENV-05", section: "ENVIRONMENT", title: "Scope 2 GHG emissions", unit: "tCO2e", description: "Indirect emissions from purchased energy." },
    { code: "BRSR-ENV-06", section: "ENVIRONMENT", title: "Water withdrawal", unit: "m³", description: "Total fresh water withdrawal." },
    { code: "BRSR-ENV-07", section: "ENVIRONMENT", title: "Water discharge quality", unit: "mg/L", description: "COD/BOD of discharged water." },
    { code: "BRSR-ENV-08", section: "ENVIRONMENT", title: "Waste generation & disposal", unit: "t", description: "Hazardous and non-hazardous waste." },
    { code: "BRSR-SOC-01", section: "SOCIAL", title: "Lost Time Injury Frequency Rate", unit: "per mn hrs", description: "Safety performance indicator." },
    { code: "BRSR-SOC-02", section: "SOCIAL", title: "Employee training hours", unit: "hrs", description: "Aggregate training investments." },
    { code: "BRSR-SOC-03", section: "SOCIAL", title: "Women in workforce", unit: "%", description: "Gender diversity ratio." },
    { code: "BRSR-SOC-04", section: "SOCIAL", title: "Employee turnover", unit: "%", description: "Voluntary + involuntary turnover." },
    { code: "BRSR-SOC-05", section: "SOCIAL", title: "CSR beneficiaries", unit: "persons", description: "Community program reach." },
    { code: "BRSR-SOC-06", section: "SOCIAL", title: "Contract labour count", unit: "persons", description: "Contract workforce engaged." },
    { code: "BRSR-GOV-01", section: "GOVERNANCE", title: "Regulatory non-compliance events", unit: "events", description: "Fines/penalties during the period." },
    { code: "BRSR-GOV-02", section: "GOVERNANCE", title: "Local sourcing share", unit: "%", description: "Procurement from local suppliers." },
    { code: "BRSR-GOV-03", section: "GOVERNANCE", title: "Green procurement spend", unit: "₹ Cr", description: "Spend on certified green suppliers." },
    { code: "BRSR-GOV-04", section: "GOVERNANCE", title: "Leadership integrity disclosures", unit: "count", description: "Conflict-of-interest attestations filed." },
  ];
  await Promise.all(disclosures.map((d) => db.disclosure.create({ data: d })));

  // ── BRSR reports ──────────────────────────────────────────────
  const allScope = {
    subsidiaryIds: subs.map((s) => s.id),
    businessUnitIds: units.map((u) => u.id),
    projectIds: projects.map((p) => p.id),
  };
  await db.brsrReport.create({
    data: {
      ref: "BRSR-FY2425-v2", title: "MEIL Group Consolidated BRSR — FY 2024-25",
      financialYear: "FY 2024-25", framework: "SEBI BRSR Core v1.0",
      periodStart: at(-400), periodEnd: at(-35), description: "Consolidated annual Business Responsibility & Sustainability Report for the group.",
      ownerName: "Group Admin", status: "FINALIZED", wizardStep: 8,
      scope: JSON.stringify(allScope),
      sections: JSON.stringify([
        { id: "s1", title: "General Disclosures", content: "Corporate identity, listed entity details, products and markets — auto-populated from group master data.", sourceRefs: ["ORG-MASTER"] },
        { id: "s2", title: "Management & Process Disclosures", content: "BRSR committee structure, ESG policy adoption across subsidiaries, and due-diligence processes.", sourceRefs: ["GOV-POLICY"] },
        { id: "s3", title: "Environmental Performance", content: "Group-wide energy 412 GWh (renewable share 24.1%); Scope 1: 148,200 tCO2e; Scope 2: 96,400 tCO2e.", sourceRefs: ["SUB-2425-012", "SUB-2425-015"] },
        { id: "s4", title: "Social Performance", content: "Workforce 48,200; LTIFR 0.52; training 38,400 hrs; CSR reach 61,000 beneficiaries.", sourceRefs: ["SUB-2425-021"] },
        { id: "s5", title: "Governance & Compliance", content: "Zero material non-compliance events; local sourcing 64%; green procurement ₹284 Cr.", sourceRefs: ["SUB-2425-029"] },
      ]),
      disclosures: JSON.stringify(
        disclosures.map((d, i) => ({ code: d.code, title: d.title, mapped: true, status: i === 5 ? "EXCEPTION" : "VALIDATED", value: i === 5 ? null : (i + 1) * 120, unit: d.unit, note: i === 5 ? "Water discharge unit variance documented — see annexure." : "" }))
      ),
      signoffs: JSON.stringify([
        { role: "Group CFO", name: "R. Srinivasan", decision: "APPROVED", at: at(-40).toISOString(), comment: "Reviewed consolidated figures." },
        { role: "Group CEO", name: "P. Ramachandra", decision: "APPROVED", at: at(-38).toISOString(), comment: "Approved for board submission." },
        { role: "Board ESG Committee", name: "Committee Chair", decision: "APPROVED", at: at(-36).toISOString(), comment: "Endorsed." },
      ]),
      exports: JSON.stringify([
        { format: "PDF", at: at(-35).toISOString(), by: "Group Admin" },
        { format: "XLSX", at: at(-35).toISOString(), by: "Group Admin" },
      ]),
      version: 2,
      versions: JSON.stringify([
        { version: 1, at: at(-60).toISOString(), by: "Group Admin", note: "Initial draft after consolidation." },
        { version: 2, at: at(-35).toISOString(), by: "Group Admin", note: "Finalized with sign-offs." },
      ]),
      finalizedAt: at(-35),
    },
  });
  await db.brsrReport.create({
    data: {
      ref: "BRSR-FY2526-d1", title: "MEIL Group Consolidated BRSR — FY 2025-26",
      financialYear: "FY 2025-26", framework: "SEBI BRSR Core v1.0",
      periodStart: at(-200), periodEnd: at(165), description: "Work-in-progress consolidated report for the current financial year.",
      ownerName: "Group Admin", status: "VALIDATION", wizardStep: 4,
      scope: JSON.stringify(allScope),
      sections: JSON.stringify([
        { id: "s1", title: "General Disclosures", content: "Pending final org confirmation.", sourceRefs: [] },
        { id: "s2", title: "Management & Process Disclosures", content: "", sourceRefs: [] },
        { id: "s3", title: "Environmental Performance", content: "Provisional (approved-data only): Scope 1: 79,634 tCO2e; Scope 2: 31,540 tCO2e.", sourceRefs: ["SUB-2526-001", "SUB-2526-002"] },
      ]),
      disclosures: JSON.stringify(
        disclosures.map((d, i) => ({ code: d.code, title: d.title, mapped: i < 8, status: i < 5 ? "VALIDATED" : i < 8 ? "PENDING" : "NOT_MAPPED", value: i < 5 ? (i + 2) * 60 : null, unit: d.unit, note: "" }))
      ),
      signoffs: JSON.stringify([]),
      exports: JSON.stringify([]),
      version: 1,
      versions: JSON.stringify([{ version: 1, at: at(-10).toISOString(), by: "Group Admin", note: "Wizard draft — validation stage." }]),
    },
  });

  // ── Activity events ───────────────────────────────────────────
  const acts = [
    { actorName: "Ramesh Iyer", actorRole: "ENV_DATA_USER", action: "SUBMIT", targetType: "Submission", targetLabel: "Scope 1 — Stationary Combustion", orgLabel: "MEIL Energy Ltd" },
    { actorName: "Arun Bhaskar", actorRole: "GROUP_ADMIN", action: "APPROVE", targetType: "Submission", targetLabel: "Scope 2 — Purchased Electricity", orgLabel: "MEIL Energy Ltd" },
    { actorName: "Deepa Krishnan", actorRole: "ENV_DATA_USER", action: "SUBMIT", targetType: "Submission", targetLabel: "Renewable Energy Share — Solar", orgLabel: "MEIL Energy Ltd" },
    { actorName: "Arun Bhaskar", actorRole: "GROUP_ADMIN", action: "TASK_ASSIGN", targetType: "Task", targetLabel: "Q2 environmental metrics — Thermal BU", orgLabel: "Group" },
    { actorName: "Sneha Kulkarni", actorRole: "EHS_USER", action: "EVIDENCE_UPLOAD", targetType: "Submission", targetLabel: "Lost Time Injury Frequency Rate", orgLabel: "MEIL Infrastructure Ltd" },
    { actorName: "Priya Deshmukh", actorRole: "SUBSIDIARY_ADMIN", action: "REJECT", targetType: "Submission", targetLabel: "Waste — Hazardous Disposed", orgLabel: "MEIL Energy Ltd", severity: "WARNING" },
    { actorName: "Arun Bhaskar", actorRole: "GROUP_ADMIN", action: "REPORT_CREATE", targetType: "BRSR Report", targetLabel: "FY 2025-26 Consolidated BRSR", orgLabel: "Group" },
    { actorName: "Aparna Das", actorRole: "HR_USER", action: "DATA_EDIT", targetType: "Submission", targetLabel: "Employee Training Hours", orgLabel: "MEIL Infrastructure Ltd" },
    { actorName: "Wei Zhang", actorRole: "BU_MANAGER", action: "SUBMIT", targetType: "Submission", targetLabel: "Scope 3 — Business Travel", orgLabel: "MEIL Global Holdings" },
    { actorName: "Arun Bhaskar", actorRole: "GROUP_ADMIN", action: "EXPORT", targetType: "BRSR Report", targetLabel: "FY 2024-25 BRSR (PDF)", orgLabel: "Group" },
    { actorName: "Kiran Reddy", actorRole: "BU_ADMIN", action: "ACCOUNT_UPDATE", targetType: "User", targetLabel: "Farhan Ali — role review", orgLabel: "MEIL Water Systems Ltd" },
    { actorName: "Arun Bhaskar", actorRole: "GROUP_ADMIN", action: "ROLE_CHANGE", targetType: "User", targetLabel: "Nikhil Chandra — suspended", orgLabel: "MEIL Global Holdings", severity: "WARNING" },
    { actorName: "Tarun Bhatia", actorRole: "ENV_DATA_USER", action: "SUBMIT", targetType: "Submission", targetLabel: "Fresh Water Withdrawal", orgLabel: "MEIL Water Systems Ltd" },
    { actorName: "Arun Bhaskar", actorRole: "GROUP_ADMIN", action: "LOGIN", targetType: "Session", targetLabel: "Web session", orgLabel: "Group" },
    { actorName: "Lakshmi Prasad", actorRole: "CSR_USER", action: "SUBMIT", targetType: "Submission", targetLabel: "Biodiversity — Land Reclaimed", orgLabel: "MEIL Water Systems Ltd" },
    { actorName: "Ravi Teja", actorRole: "PROCUREMENT_USER", action: "RESUBMIT", targetType: "Submission", targetLabel: "Road Safety Incidents", orgLabel: "MEIL Infrastructure Ltd" },
    { actorName: "Arun Bhaskar", actorRole: "GROUP_ADMIN", action: "CONFIG_CHANGE", targetType: "Settings", targetLabel: "Reminder cadence — 3 days", orgLabel: "Group" },
    { actorName: "Farhan Ali", actorRole: "COMPLIANCE_USER", action: "EVIDENCE_UPLOAD", targetType: "Submission", targetLabel: "Regulatory Non-Compliance Events", orgLabel: "MEIL Water Systems Ltd" },
    { actorName: "Santosh Rao", actorRole: "FIN_RESOURCE_USER", action: "SUBMIT", targetType: "Submission", targetLabel: "Energy Intensity — Production", orgLabel: "MEIL Energy Ltd" },
    { actorName: "Priya Deshmukh", actorRole: "SUBSIDIARY_ADMIN", action: "APPROVE", targetType: "Submission", targetLabel: "Diesel Consumption — Generators", orgLabel: "MEIL Energy Ltd" },
  ];
  await Promise.all(acts.map((a, i) => db.activityEvent.create({ data: { ...a, createdAt: at(-i * 0.4, 9 + (i % 9)) } })));

  // ── Audit events ──────────────────────────────────────────────
  const audits = [
    { actorName: "Arun Bhaskar", actorRole: "GROUP_ADMIN", action: "SUBMISSION_APPROVE", targetType: "Submission", targetLabel: "SUB-2526-002 — Scope 2 Purchased Electricity", before: '{"status":"UNDER_REVIEW"}', after: '{"status":"APPROVED"}' },
    { actorName: "Priya Deshmukh", actorRole: "SUBSIDIARY_ADMIN", action: "SUBMISSION_REQUEST_CHANGES", targetType: "Submission", targetLabel: "SUB-2526-006 — Waste Hazardous", before: '{"status":"UNDER_REVIEW"}', after: '{"status":"CHANGES_REQUESTED"}', reason: "Calibration certificate missing" },
    { actorName: "Arun Bhaskar", actorRole: "GROUP_ADMIN", action: "USER_SUSPEND", targetType: "User", targetLabel: "Nikhil Chandra", before: '{"status":"ACTIVE"}', after: '{"status":"SUSPENDED"}', reason: "Extended inactivity + policy violation review" },
    { actorName: "Arun Bhaskar", actorRole: "GROUP_ADMIN", action: "BRSR_CREATE", targetType: "BrsrReport", targetLabel: "BRSR-FY2526-d1", after: '{"status":"DRAFT"}' },
    { actorName: "Arun Bhaskar", actorRole: "GROUP_ADMIN", action: "BRSR_FINALIZE", targetType: "BrsrReport", targetLabel: "BRSR-FY2425-v2", before: '{"status":"SIGNOFF"}', after: '{"status":"FINALIZED","version":2}' },
    { actorName: "Arun Bhaskar", actorRole: "GROUP_ADMIN", action: "BRSR_EXPORT", targetType: "BrsrReport", targetLabel: "BRSR-FY2425-v2", after: '{"format":"PDF"}' },
    { actorName: "Arun Bhaskar", actorRole: "GROUP_ADMIN", action: "TASK_CREATE", targetType: "Task", targetLabel: "TSK-2526-002 — Safety incident logs", after: '{"priority":"CRITICAL"}' },
    { actorName: "Arun Bhaskar", actorRole: "GROUP_ADMIN", action: "SETTINGS_UPDATE", targetType: "AppSetting", targetLabel: "reminder_cadence_days", before: '{"value":7}', after: '{"value":3}' },
    { actorName: "Priya Deshmukh", actorRole: "SUBSIDIARY_ADMIN", action: "SUBMISSION_APPROVE", targetType: "Submission", targetLabel: "SUB-2526-003 — Diesel Consumption", before: '{"status":"UNDER_REVIEW"}', after: '{"status":"APPROVED"}' },
    { actorName: "Arun Bhaskar", actorRole: "GROUP_ADMIN", action: "ROLE_CHANGE", targetType: "User", targetLabel: "Kiran Reddy", before: '{"role":"BU_MANAGER"}', after: '{"role":"BU_ADMIN"}' },
    { actorName: "System", actorRole: "SCHEDULER", action: "REMINDER_DISPATCH", targetType: "Task", targetLabel: "TSK-2526-003 — HR data collection", after: '{"remindersSent":2}' },
    { actorName: "Arun Bhaskar", actorRole: "GROUP_ADMIN", action: "USER_DEACTIVATE", targetType: "User", targetLabel: "Old Contractor", before: '{"status":"ACTIVE"}', after: '{"status":"INACTIVE"}', reason: "Contract ended — retained for audit attribution" },
    { actorName: "Sunita Rao", actorRole: "SUBSIDIARY_ADMIN", action: "SUBMISSION_RETURN", targetType: "Submission", targetLabel: "SUB-2526-019 — Road Safety Incidents", before: '{"status":"UNDER_REVIEW"}', after: '{"status":"CHANGES_REQUESTED"}', reason: "Incident log inconsistent with FIR records" },
    { actorName: "System", actorRole: "SCHEDULER", action: "CONSOLIDATION_RUN", targetType: "Engine", targetLabel: "Nightly consolidation", after: '{"records":1240,"exceptions":3}' },
    { actorName: "Arun Bhaskar", actorRole: "GROUP_ADMIN", action: "LOGIN", targetType: "Session", targetLabel: "Web session @10.24.8.11", outcome: "SUCCESS" },
    { actorName: "Unknown", actorRole: "ANONYMOUS", action: "LOGIN", targetType: "Session", targetLabel: "Web session @10.24.8.99", outcome: "FAILURE" },
  ];
  await Promise.all(audits.map((a, i) => db.auditEvent.create({ data: { ...a, orgScope: "GROUP", correlation: `req-${(1e6 + i * 7777).toString(36)}`, createdAt: at(-i * 0.7, 8 + (i % 11)) } })));

  // ── Settings ──────────────────────────────────────────────────
  const settings = [
    { skey: "reporting_year", label: "Active reporting year", category: "REPORTING", svalue: JSON.stringify({ value: "FY 2025-26" }), vtype: "select", options: JSON.stringify(["FY 2024-25", "FY 2025-26", "FY 2026-27"]) },
    { skey: "q2_freeze_date", label: "Q2 FY26 data freeze date", category: "REPORTING", svalue: JSON.stringify({ value: at(20).toISOString().slice(0, 10) }), vtype: "text" },
    { skey: "reminder_cadence_days", label: "Deadline reminder cadence (days)", category: "REMINDERS", svalue: JSON.stringify({ value: 3 }), vtype: "number" },
    { skey: "escalation_enabled", label: "Auto-escalate overdue tasks to managers", category: "REMINDERS", svalue: JSON.stringify({ value: true }), vtype: "toggle" },
    { skey: "approval_stages", label: "Approval workflow stages", category: "WORKFLOW", svalue: JSON.stringify({ value: "Group Admin → CFO (BRSR only)" }), vtype: "text" },
    { skey: "brsr_framework", label: "BRSR framework version", category: "REPORTING", svalue: JSON.stringify({ value: "SEBI BRSR Core v1.0" }), vtype: "select", options: JSON.stringify(["SEBI BRSR Core v1.0", "SEBI BRSR Core v1.1 (draft)"]) },
    { skey: "emissions_factor_set", label: "Emissions factor set", category: "CALCULATION", svalue: JSON.stringify({ value: "GHG Protocol — India Grid 2024 (v4.2)" }), vtype: "select", options: JSON.stringify(["GHG Protocol — India Grid 2024 (v4.2)", "GHG Protocol — India Grid 2023 (v4.1)"]) },
    { skey: "email_provider", label: "Email delivery provider", category: "INTEGRATIONS", svalue: JSON.stringify({ value: "Not configured — in-app only" }), vtype: "text" },
    { skey: "session_timeout_min", label: "Session timeout (minutes)", category: "SECURITY", svalue: JSON.stringify({ value: 30 }), vtype: "number" },
    { skey: "audit_retention_years", label: "Audit retention (years)", category: "SECURITY", svalue: JSON.stringify({ value: 7 }), vtype: "number" },
    { skey: "anomaly_detection", label: "Statistical anomaly detection", category: "CALCULATION", svalue: JSON.stringify({ value: true }), vtype: "toggle" },
    { skey: "export_watermark", label: "Watermark exported reports", category: "EXPORTS", svalue: JSON.stringify({ value: true }), vtype: "toggle" },
  ];
  await Promise.all(settings.map((s) => db.appSetting.create({ data: s })));

  const counts = {
    subsidiaries: await db.subsidiary.count(),
    units: await db.businessUnit.count(),
    projects: await db.project.count(),
    users: await db.user.count(),
    submissions: await db.submission.count(),
    tasks: await db.task.count(),
    notifications: await db.notification.count(),
    messages: await db.message.count(),
    reports: await db.brsrReport.count(),
    disclosures: await db.disclosure.count(),
    activity: await db.activityEvent.count(),
    audit: await db.auditEvent.count(),
    settings: await db.appSetting.count(),
  };
  console.log("Seed complete:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
