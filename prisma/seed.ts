/**
 * MEIL ESG & BRSR Platform — Official Demo Data Seeder.
 * Hierarchy derived strictly from official portfolio structure:
 * 7 Subsidiaries -> 16 Business Units -> Designated Projects.
 *
 * Run: npx tsx prisma/seed.ts
 * THEN provision portal credentials: npx tsx prisma/seed-auth.ts
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
  try {
    await db.$executeRaw`PRAGMA foreign_keys = OFF`;
  } catch {
    // PostgreSQL ignores SQLite PRAGMA
  }
  await db.auditEvent.deleteMany();
  await db.activityEvent.deleteMany();
  await db.message.deleteMany();
  await db.notification.deleteMany();
  await db.task.deleteMany();
  await db.submission.deleteMany();
  await db.brsrReport.deleteMany();
  await db.disclosure.deleteMany();
  await db.appSetting.deleteMany();
  await db.soSubmission.deleteMany();
  await db.soAuditLog.deleteMany();
  await db.soNotification.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
  await db.project.deleteMany();
  await db.businessUnit.deleteMany();
  await db.subsidiary.deleteMany();

  // ── 1. EXACTLY 7 SUBSIDIARIES ───────────────────────────────────
  const subs = await Promise.all(
    [
      {
        code: "MEIL",
        name: "Megha Engineering & Infrastructures Ltd (MEIL Core)",
        sector: "Core Infrastructure & Engineering",
        region: "Pan India & Global",
        city: "Hyderabad",
        managerName: "P. Rama Rao",
        adminName: "Priya Deshmukh",
        description: "Flagship EPC infrastructure, irrigation networks, hydrocarbons, and power transmission.",
      },
      {
        code: "OLECTRA",
        name: "Olectra Greentech Limited",
        sector: "Electric Mobility & Green Technology",
        region: "Pan India",
        city: "Hyderabad",
        managerName: "K. V. Pradeep",
        adminName: "Sunita Rao",
        description: "Pioneer in electric bus manufacturing, EV powertrains and clean public transit.",
      },
      {
        code: "MCGDH",
        name: "Megha City Gas Distribution Holding",
        sector: "City Gas Distribution & Hydrocarbons",
        region: "Pan India",
        city: "Hyderabad",
        managerName: "Vikram Shetty",
        adminName: "Kavita Nair",
        description: "City Gas Distribution (CGD), CNG compression stations and piped natural gas networks.",
      },
      {
        code: "DRILLMEC",
        name: "Drillmec S.p.A.",
        sector: "Drilling Systems & Deep Automation",
        region: "International",
        city: "Piacenza, Italy",
        managerName: "Simone Trevisani",
        adminName: "Mei Ling Tan",
        description: "World leader in automated hydraulic drilling rigs, offshore packages and geothermal systems.",
      },
      {
        code: "PETREVEN",
        name: "Petreven S.p.A.",
        sector: "Oilfield & Well Services",
        region: "International",
        city: "Cesena, Italy",
        managerName: "Roberto Rossi",
        adminName: "Elena Rossi",
        description: "Global oilfield operations, well completion and low-footprint eco-drilling services.",
      },
      {
        code: "MSOLAR",
        name: "MEIL Solar Energy Limited",
        sector: "Renewable & Clean Energy",
        region: "Pan India",
        city: "Hyderabad",
        managerName: "Rajesh Menon",
        adminName: "Divya Iyer",
        description: "Utility-scale solar parks, canal-top solar and floating solar arrays.",
      },
      {
        code: "MHYDRO",
        name: "MEIL Hydro Power Limited",
        sector: "Hydro Power & Pumped Storage",
        region: "Pan India",
        city: "Hyderabad",
        managerName: "Anil Kapoor",
        adminName: "Shalini Verma",
        description: "Multi-stage pumped storage hydro projects, barrage schemes and green peaking capacity.",
      },
    ].map((s) => db.subsidiary.create({ data: s }))
  );

  // ── 2. EXACTLY 16 BUSINESS UNITS (Row-matched to Subsidiary) ────
  const unitDefs: { code: string; name: string; sub: number; managerName: string; adminName: string }[] = [
    // Under MEIL (sub 0)
    { code: "IWEN", name: "Irrigation & Water Engineering Networks", sub: 0, managerName: "Harish Chandra", adminName: "Gopal Rao" },
    { code: "HCIT", name: "Heavy Civil Infrastructure & Tunnels", sub: 0, managerName: "Manoj Sharma", adminName: "Rekha Pillai" },
    { code: "HRP", name: "Hydrocarbons, Refinery & Pipelines", sub: 0, managerName: "Suresh Babu", adminName: "Latha Krishnan" },
    { code: "PTSE", name: "Power Transmission & Substation EPC", sub: 0, managerName: "Naveen Kumar", adminName: "Sanjay Gupta" },

    // Under OLECTRA (sub 1)
    { code: "EBMP", name: "Electric Bus Manufacturing Plant (Telangana)", sub: 1, managerName: "B. Shanker", adminName: "Anita Joshi" },
    { code: "EPBI", name: "EV Powertrain & Battery Integration Division", sub: 1, managerName: "Arvind Swamy", adminName: "Kiran Reddy" },
    { code: "MTFO", name: "Municipal Transit Fleet Operations", sub: 1, managerName: "Rohit Verma", adminName: "Jyothi Rao" },

    // Under MCGDH (sub 2)
    { code: "CGDN", name: "City Gas Distribution (CGD) Networks", sub: 2, managerName: "Prasad Patil", adminName: "Rahul Desai" },
    { code: "CCDS", name: "CNG Compression & Dispensing Stations", sub: 2, managerName: "Amit Trivedi", adminName: "Swati Shah" },
    { code: "PDIS", name: "PNG Domestic & Industrial Supply", sub: 2, managerName: "Rajesh Patel", adminName: "Neha Kulkarni" },

    // Under DRILLMEC (sub 3)
    { code: "ARAM", name: "Advanced Rig Automation & Manufacturing", sub: 3, managerName: "Paolo Martini", adminName: "Arjun Nair" },
    { code: "GCDS", name: "Geothermal & Clean Drilling Solutions", sub: 3, managerName: "Luca Bianchi", adminName: "Farah Khan" },

    // Under PETREVEN (sub 4)
    { code: "GCOS", name: "Global Clean Oilfield Services", sub: 4, managerName: "Carlos Mendez", adminName: "Sofia Morales" },

    // Under MSOLAR (sub 5)
    { code: "CUSP", name: "Charanka & Utility-Scale Solar Parks", sub: 5, managerName: "Arvind Mehta", adminName: "Deepa Krishnan" },
    { code: "ICFS", name: "Industrial Canal-Top & Floating Solar", sub: 5, managerName: "Suresh Varma", adminName: "Tarun Bhatia" },

    // Under MHYDRO (sub 6)
    { code: "MPSP", name: "Multi-Stage Pumped Storage Projects", sub: 6, managerName: "R. K. Sharma", adminName: "Sneha Kulkarni" },
  ];

  const units = await Promise.all(
    unitDefs.map((u) =>
      db.businessUnit.create({
        data: { code: u.code, name: u.name, subsidiaryId: subs[u.sub].id, managerName: u.managerName, adminName: u.adminName },
      })
    )
  );

  // ── 3. PROJECTS / SITES (Designated under each of the 16 BUs) ───
  const projDefs: { code: string; name: string; unit: number; location: string; ptype: string; capacityMw: number; status?: string }[] = [
    // Under IWEN (unit 0)
    { code: "PRJ-KLIP", name: "Kaleshwaram Lift Irrigation Package-06 & 08", unit: 0, location: "Telangana", ptype: "PLANT", capacityMw: 0 },
    { code: "PRJ-POLA", name: "Polavaram Irrigation Project Canals & Headworks", unit: 0, location: "Andhra Pradesh", ptype: "SITE", capacityMw: 0 },

    // Under HCIT (unit 1)
    { code: "PRJ-ZOJ", name: "Zojila Strategic Bi-Directional Tunnel", unit: 1, location: "Jammu & Kashmir", ptype: "SITE", capacityMw: 0 },
    { code: "PRJ-TBTT", name: "Thane-Borivali Twin Tunnel Project", unit: 1, location: "Maharashtra", ptype: "SITE", capacityMw: 0 },

    // Under HRP (unit 2)
    { code: "PRJ-MONG", name: "Mongol Refinery EPC Project (Packages 2 & 3)", unit: 2, location: "Mongolia", ptype: "PLANT", capacityMw: 0 },
    { code: "PRJ-BARM", name: "Barmer Crude Oil Pipeline Package", unit: 2, location: "Rajasthan", ptype: "PIPELINE", capacityMw: 0 },

    // Under PTSE (unit 3)
    { code: "PRJ-SUB765", name: "765 kV / 400 kV GIS Substation Grid Package", unit: 3, location: "Uttar Pradesh", ptype: "PLANT", capacityMw: 0 },
    { code: "PRJ-EITC", name: "Eastern Interstate Transmission Corridor", unit: 3, location: "Odisha", ptype: "SITE", capacityMw: 0 },

    // Under EBMP (unit 4)
    { code: "PRJ-DND-EVI", name: "Dindi Electric Bus Green Manufacturing Gigafactory", unit: 4, location: "Telangana", ptype: "PLANT", capacityMw: 0 },
    { code: "PRJ-HYD-BUS", name: "Hyderabad E-Bus Integration Facility", unit: 4, location: "Telangana", ptype: "PLANT", capacityMw: 0 },

    // Under EPBI (unit 5)
    { code: "PRJ-LFP-BATT", name: "Advanced LFP Battery Pack Assembly Line", unit: 5, location: "Telangana", ptype: "PLANT", capacityMw: 0 },
    { code: "PRJ-EV-MOTR", name: "NextGen Heavy EV Traction Motor Testing Center", unit: 5, location: "Telangana", ptype: "OFFICE", capacityMw: 0 },

    // Under MTFO (unit 6)
    { code: "PRJ-BEST-OPS", name: "BEST Mumbai 2,100 E-Bus Fleet Operations", unit: 6, location: "Maharashtra", ptype: "SITE", capacityMw: 0 },
    { code: "PRJ-PMPML-DEP", name: "Pune Mahanagar Parivahan E-Fleet Depots", unit: 6, location: "Maharashtra", ptype: "SITE", capacityMw: 0 },

    // Under CGDN (unit 7)
    { code: "PRJ-GA45-GRID", name: "Geographical Area GA-45 Steel Pipeline Grid", unit: 7, location: "Karnataka", ptype: "PIPELINE", capacityMw: 0 },
    { code: "PRJ-TEL-GAS", name: "Telangana & AP Intercity Gas Distribution Grid", unit: 7, location: "Telangana", ptype: "PIPELINE", capacityMw: 0 },

    // Under CCDS (unit 8)
    { code: "PRJ-CNG-MDN", name: "Highway Mother Daughter CNG Dispensing Network", unit: 8, location: "Andhra Pradesh", ptype: "PLANT", capacityMw: 0 },
    { code: "PRJ-CNG-URB", name: "Urban Smart CNG Fast-Refueling Hubs", unit: 8, location: "Karnataka", ptype: "SITE", capacityMw: 0 },

    // Under PDIS (unit 9)
    { code: "PRJ-PNG-IND", name: "Industrial Cluster High-Pressure PNG Network", unit: 9, location: "Rajasthan", ptype: "PIPELINE", capacityMw: 0 },
    { code: "PRJ-PNG-DOM", name: "Smart Metered Domestic PNG Infrastructure", unit: 9, location: "Telangana", ptype: "SITE", capacityMw: 0 },

    // Under ARAM (unit 10)
    { code: "PRJ-RIG-HH300", name: "HH-300 Automated Hydraulic Rigs Line", unit: 10, location: "Piacenza, Italy", ptype: "PLANT", capacityMw: 0 },
    { code: "PRJ-KKD-RIG", name: "Kakinada Rig Assembly & Testing Yard", unit: 10, location: "Andhra Pradesh", ptype: "PLANT", capacityMw: 0 },

    // Under GCDS (unit 11)
    { code: "PRJ-ZE-DRILL", name: "Zero-Emission Electric Drilling System Unit 1", unit: 11, location: "Europe / Global", ptype: "SITE", capacityMw: 0 },
    { code: "PRJ-PUGA-GEO", name: "Puga Geothermal Deep Exploration Well Project", unit: 11, location: "Ladakh", ptype: "SITE", capacityMw: 0 },

    // Under GCOS (unit 12)
    { code: "PRJ-LATAM-OPS", name: "Latin America Deep Drilling Fleet Operations", unit: 12, location: "International", ptype: "SITE", capacityMw: 0 },
    { code: "PRJ-ECO-RIG4", name: "Eco-Friendly Workover Rigs Fleet-04", unit: 12, location: "International", ptype: "SITE", capacityMw: 0 },

    // Under CUSP (unit 13)
    { code: "PRJ-CHR-SOL", name: "Charanka 150 MW Solar PV Park", unit: 13, location: "Gujarat", ptype: "SOLAR_PARK", capacityMw: 150 },
    { code: "PRJ-PVG-SOL", name: "Pavagada Mega Solar Complex Expansion", unit: 13, location: "Karnataka", ptype: "SOLAR_PARK", capacityMw: 200 },

    // Under ICFS (unit 14)
    { code: "PRJ-NAR-CANAL", name: "Narmada Branch Canal-Top 50 MW Solar Installation", unit: 14, location: "Gujarat", ptype: "SOLAR_PARK", capacityMw: 50 },
    { code: "PRJ-FLT-SOL", name: "Reservoir Floating Solar Power Platform", unit: 14, location: "Andhra Pradesh", ptype: "SOLAR_PARK", capacityMw: 60 },

    // Under MPSP (unit 15)
    { code: "PRJ-KUN-PSH", name: "Kundah 500 MW Pumped Storage Hydro Project", unit: 15, location: "Tamil Nadu", ptype: "HYDRO", capacityMw: 500 },
    { code: "PRJ-PIN-PSH", name: "Pinnapuram 1200 MW Integrated Renewable Energy Storage Hydro", unit: 15, location: "Andhra Pradesh", ptype: "HYDRO", capacityMw: 1200 },
  ];

  const projects = await Promise.all(
    projDefs.map((p) =>
      db.project.create({
        data: {
          code: p.code,
          name: p.name,
          businessUnitId: units[p.unit].id,
          location: p.location,
          ptype: p.ptype,
          capacityMw: p.capacityMw,
          status: p.status ?? "ACTIVE",
        },
      })
    )
  );

  // ── 4. USERS (Roles across Group, Subsidiaries, BUs & Projects) ─
  const userDefs: {
    name: string;
    email: string;
    role: string;
    sub?: number;
    unit?: number;
    proj?: number;
    title: string;
    status?: string;
    lastActive?: number;
  }[] = [
    // Group Admin
    { name: "Arun Bhaskar", email: "arun.bhaskar@meil.in", role: "GROUP_ADMIN", title: "Group ESG Administrator", lastActive: 0 },

    // Subsidiary Managers (1 per subsidiary)
    { name: "P. Rama Rao", email: "rama.rao@meil.in", role: "SUBSIDIARY_MANAGER", sub: 0, title: "Managing Director · MEIL Core", lastActive: 0 },
    { name: "K. V. Pradeep", email: "kv.pradeep@olectra.com", role: "SUBSIDIARY_MANAGER", sub: 1, title: "Managing Director · Olectra Greentech", lastActive: 1 },
    { name: "Vikram Shetty", email: "vikram.shetty@meghagas.com", role: "SUBSIDIARY_MANAGER", sub: 2, title: "MD · Megha City Gas", lastActive: 2 },
    { name: "Simone Trevisani", email: "simone.trevisani@drillmec.com", role: "SUBSIDIARY_MANAGER", sub: 3, title: "CEO · Drillmec S.p.A.", lastActive: 3 },
    { name: "Roberto Rossi", email: "roberto.rossi@petreven.com", role: "SUBSIDIARY_MANAGER", sub: 4, title: "Managing Director · Petreven S.p.A.", lastActive: 4 },
    { name: "Rajesh Menon", email: "rajesh.menon@meilsolar.com", role: "SUBSIDIARY_MANAGER", sub: 5, title: "MD · MEIL Solar Energy", lastActive: 1 },
    { name: "Anil Kapoor", email: "anil.kapoor@meilhydro.com", role: "SUBSIDIARY_MANAGER", sub: 6, title: "MD · MEIL Hydro Power", lastActive: 2 },

    // Subsidiary Admins (1 per subsidiary)
    { name: "Priya Deshmukh", email: "priya.deshmukh@meil.in", role: "SUBSIDIARY_ADMIN", sub: 0, title: "Subsidiary ESG Admin · MEIL Core", lastActive: 1 },
    { name: "Sunita Rao", email: "sunita.rao@olectra.com", role: "SUBSIDIARY_ADMIN", sub: 1, title: "Subsidiary ESG Admin · Olectra", lastActive: 2 },
    { name: "Kavita Nair", email: "kavita.nair@meghagas.com", role: "SUBSIDIARY_ADMIN", sub: 2, title: "Subsidiary ESG Admin · Megha City Gas", lastActive: 3 },
    { name: "Mei Ling Tan", email: "meiling.tan@drillmec.com", role: "SUBSIDIARY_ADMIN", sub: 3, title: "Subsidiary ESG Admin · Drillmec", lastActive: 4 },
    { name: "Elena Rossi", email: "elena.rossi@petreven.com", role: "SUBSIDIARY_ADMIN", sub: 4, title: "Subsidiary ESG Admin · Petreven", lastActive: 5 },
    { name: "Divya Iyer", email: "divya.iyer@meilsolar.com", role: "SUBSIDIARY_ADMIN", sub: 5, title: "Subsidiary ESG Admin · MEIL Solar", lastActive: 1 },
    { name: "Shalini Verma", email: "shalini.verma@meilhydro.com", role: "SUBSIDIARY_ADMIN", sub: 6, title: "Subsidiary ESG Admin · MEIL Hydro", lastActive: 2 },

    // BU Managers (Across business units)
    { name: "Harish Chandra", email: "harish.chandra@meil.in", role: "BU_MANAGER", sub: 0, unit: 0, title: "BU Head · Irrigation & Water", lastActive: 1 },
    { name: "Manoj Sharma", email: "manoj.sharma@meil.in", role: "BU_MANAGER", sub: 0, unit: 1, title: "BU Head · Heavy Civil & Tunnels", lastActive: 2 },
    { name: "Suresh Babu", email: "suresh.babu@meil.in", role: "BU_MANAGER", sub: 0, unit: 2, title: "BU Head · Hydrocarbons & Pipelines", lastActive: 0 },
    { name: "B. Shanker", email: "b.shanker@olectra.com", role: "BU_MANAGER", sub: 1, unit: 4, title: "BU Head · Electric Bus Plant", lastActive: 1 },
    { name: "Prasad Patil", email: "prasad.patil@meghagas.com", role: "BU_MANAGER", sub: 2, unit: 7, title: "BU Head · City Gas Networks", lastActive: 3 },
    { name: "Paolo Martini", email: "paolo.martini@drillmec.com", role: "BU_MANAGER", sub: 3, unit: 10, title: "BU Head · Rig Automation", lastActive: 4 },
    { name: "Carlos Mendez", email: "carlos.mendez@petreven.com", role: "BU_MANAGER", sub: 4, unit: 12, title: "BU Head · Global Clean Oilfield", lastActive: 5 },
    { name: "Arvind Mehta", email: "arvind.mehta@meilsolar.com", role: "BU_MANAGER", sub: 5, unit: 13, title: "BU Head · Utility Solar Parks", lastActive: 2 },
    { name: "R. K. Sharma", email: "rk.sharma@meilhydro.com", role: "BU_MANAGER", sub: 6, unit: 15, title: "BU Head · Pumped Storage Hydro", lastActive: 3 },

    // BU Admins
    { name: "Gopal Rao", email: "gopal.rao@meil.in", role: "BU_ADMIN", sub: 0, unit: 0, title: "BU Admin · Irrigation & Water", lastActive: 2 },
    { name: "Anita Joshi", email: "anita.joshi@olectra.com", role: "BU_ADMIN", sub: 1, unit: 4, title: "BU Admin · Electric Bus Plant", lastActive: 2 },
    { name: "Kiran Reddy", email: "kiran.reddy@olectra.com", role: "BU_ADMIN", sub: 1, unit: 5, title: "BU Admin · EV Powertrain", lastActive: 1 },
    { name: "Rahul Desai", email: "rahul.desai@meghagas.com", role: "BU_ADMIN", sub: 2, unit: 7, title: "BU Admin · City Gas Distribution", lastActive: 3 },

    // Project Admin & Site Governance Users
    { name: "Project Site Admin", email: "admin@site.meil.in", role: "PROJECT_ADMIN", sub: 0, unit: 1, proj: 2, title: "Project Site Administrator · Zojila", lastActive: 0 },

    // Site Data Entry & Functional Specialists
    { name: "Ramesh Iyer", email: "ramesh.iyer@meil.in", role: "ENV_DATA_USER", sub: 0, unit: 0, proj: 0, title: "Environment Data Officer", lastActive: 0 },
    { name: "Deepa Krishnan", email: "deepa.krishnan@meil.in", role: "ENV_DATA_USER", sub: 5, unit: 13, proj: 26, title: "Environment Data Officer · Charanka Solar", lastActive: 1 },
    { name: "Santosh Rao", email: "santosh.rao@meil.in", role: "FIN_RESOURCE_USER", sub: 0, unit: 2, proj: 4, title: "Finance & Resource Analyst", lastActive: 1 },
    { name: "Aparna Das", email: "aparna.das@meil.in", role: "HR_USER", sub: 0, unit: 1, proj: 2, title: "HR Data Coordinator · Zojila", lastActive: 2 },
    { name: "Mohit Jain", email: "mohit.jain@meil.in", role: "EHS_USER", sub: 1, unit: 4, proj: 8, title: "EHS Safety Officer · Dindi Gigafactory", lastActive: 0 },
    { name: "Sneha Kulkarni", email: "sneha.kulkarni@meil.in", role: "EHS_USER", sub: 6, unit: 15, proj: 31, title: "EHS Safety Officer · Pinnapuram Hydro", lastActive: 1 },
    { name: "Ravi Teja", email: "ravi.teja@meil.in", role: "PROCUREMENT_USER", sub: 0, unit: 1, proj: 3, title: "Procurement Analyst · Thane-Borivali", lastActive: 3 },
    { name: "Lakshmi Prasad", email: "lakshmi.prasad@meil.in", role: "CSR_USER", sub: 2, unit: 7, proj: 14, title: "CSR Program Lead", lastActive: 4 },
    { name: "Farhan Ali", email: "farhan.ali@meil.in", role: "COMPLIANCE_USER", sub: 2, unit: 8, proj: 16, title: "Compliance Officer", lastActive: 1 },
    { name: "Tarun Bhatia", email: "tarun.bhatia@meil.in", role: "ENV_DATA_USER", sub: 5, unit: 14, proj: 28, title: "Environment Data Officer · Canal Solar", lastActive: 2 },
    { name: "Nikhil Chandra", email: "nikhil.chandra@drillmec.com", role: "EHS_USER", sub: 3, unit: 10, proj: 20, title: "EHS Safety Officer · Drillmec", status: "SUSPENDED", lastActive: 21 },
    { name: "Old Contractor", email: "old.contractor@meil.in", role: "FIN_RESOURCE_USER", sub: 0, unit: 1, proj: 2, title: "Contract Finance", status: "INACTIVE", lastActive: 90 },
    { name: "New Joiner — ESG", email: "new.joiner@meil.in", role: "HR_USER", sub: 0, unit: 0, proj: 0, title: "HR Data Coordinator", status: "INVITED" },
  ];

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
          name: u.name,
          email: u.email,
          role: u.role,
          status: u.status ?? "ACTIVE",
          subsidiaryId: u.sub !== undefined ? subs[u.sub].id : null,
          businessUnitId: u.unit !== undefined ? units[u.unit].id : null,
          projectId: u.proj !== undefined ? projects[u.proj].id : null,
          title: u.title,
          lastActiveAt,
        },
      });
    })
  );

  const uIdx = (email: string) => users.find((u) => u.email.startsWith(email))!.id;

  // ── 5. SUBMISSIONS ──────────────────────────────────────────────
  type SubDef = {
    title: string;
    category: string;
    metricName: string;
    metricValue: number;
    metricUnit: string;
    status: string;
    overdue?: boolean;
    days: number;
    sub: number;
    unit: number;
    proj?: number;
    by: string;
    reviewer?: string;
    quarter?: string;
  };

  const subDefs: SubDef[] = [
    { title: "Scope 1 — Stationary Combustion Emissions", category: "EMISSIONS", metricName: "Scope 1 GHG", metricValue: 48210, metricUnit: "tCO2e", status: "UNDER_REVIEW", days: -4, sub: 0, unit: 0, proj: 0, by: "ramesh", reviewer: "arun.bhaskar" },
    { title: "Scope 2 — Purchased Electricity", category: "EMISSIONS", metricName: "Scope 2 GHG", metricValue: 31540, metricUnit: "tCO2e", status: "APPROVED", days: -9, sub: 0, unit: 0, proj: 0, by: "ramesh", reviewer: "priya.deshmukh" },
    { title: "Diesel Consumption — Generators & Heavy Equipment", category: "ENERGY", metricName: "Diesel", metricValue: 1284, metricUnit: "kL", status: "APPROVED", days: -11, sub: 0, unit: 1, proj: 2, by: "santosh", reviewer: "priya.deshmukh" },
    { title: "Renewable Energy Share — Solar Generation", category: "ENERGY", metricName: "Renewable share", metricValue: 78.4, metricUnit: "%", status: "SUBMITTED", days: -2, sub: 5, unit: 13, proj: 26, by: "deepa" },
    { title: "Fresh Water Withdrawal & Conservation", category: "WATER", metricName: "Water withdrawal", metricValue: 64200, metricUnit: "m³", status: "APPROVED", days: -14, sub: 0, unit: 0, proj: 0, by: "ramesh", reviewer: "priya.deshmukh" },
    { title: "Waste — Hazardous Disposed", category: "WASTE", metricName: "Hazardous waste", metricValue: 46.2, metricUnit: "t", status: "CHANGES_REQUESTED", days: -6, sub: 0, unit: 2, proj: 4, by: "santosh", reviewer: "priya.deshmukh" },
    { title: "Lost Time Injury Frequency Rate (LTIFR)", category: "SAFETY", metricName: "LTIFR", metricValue: 0.28, metricUnit: "per mn hrs", status: "APPROVED", days: -16, sub: 1, unit: 4, proj: 8, by: "mohit", reviewer: "sunita.rao" },
    { title: "Employee ESG & Safety Training Hours", category: "WORKFORCE", metricName: "Training hrs", metricValue: 14200, metricUnit: "hrs", status: "SUBMITTED", days: -3, sub: 0, unit: 1, proj: 2, by: "aparna" },
    { title: "Supplier Local Sourcing Percentage", category: "PROCUREMENT", metricName: "Local sourcing", metricValue: 72.4, metricUnit: "%", status: "UNDER_REVIEW", days: -5, sub: 0, unit: 1, proj: 3, by: "ravi.teja", reviewer: "priya.deshmukh" },
    { title: "Community CSR Beneficiaries", category: "CSR", metricName: "Beneficiaries", metricValue: 18400, metricUnit: "persons", status: "APPROVED", days: -18, sub: 2, unit: 7, proj: 14, by: "lakshmi", reviewer: "kavita.nair" },
    { title: "Zero Regulatory Non-Compliance Records", category: "COMPLIANCE", metricName: "Non-compliance", metricValue: 0, metricUnit: "events", status: "APPROVED", days: -20, sub: 2, unit: 8, proj: 16, by: "farhan", reviewer: "kavita.nair" },
    { title: "Stack Emissions Monitoring — Particulate Matter", category: "ENVIRONMENT", metricName: "PM (particulate)", metricValue: 24.8, metricUnit: "mg/Nm³", status: "DRAFT", days: -1, sub: 0, unit: 0, proj: 0, by: "ramesh" },
    { title: "Scope 3 — Supply Chain Logistics & Travel", category: "EMISSIONS", metricName: "Scope 3 travel", metricValue: 1420, metricUnit: "tCO2e", status: "SUBMITTED", overdue: true, days: -8, sub: 3, unit: 10, proj: 20, by: "paolo.martini" },
    { title: "Canal-Top Evaporation Water Savings", category: "WATER", metricName: "Evaporation saved", metricValue: 34500, metricUnit: "m³", status: "APPROVED", days: -10, sub: 5, unit: 14, proj: 28, by: "tarun", reviewer: "divya.iyer" },
    { title: "Hydro Storage Peak Grid Stabilization", category: "ENERGY", metricName: "Peak dispatch", metricValue: 480, metricUnit: "MWh", status: "APPROVED", days: -5, sub: 6, unit: 15, proj: 31, by: "sneha", reviewer: "shalini.verma" },
  ];

  
  const statusFlow: Record<string, string[]> = {
    DRAFT: ["Created"],
    ASSIGNED: ["Created", "Assigned to responsible user"],
    SUBMITTED: ["Created", "Assigned", "Submitted by user"],
    UNDER_REVIEW: ["Created", "Assigned", "Submitted by user", "Under review"],
    CHANGES_REQUESTED: ["Created", "Assigned", "Submitted by user", "Reviewed — changes requested"],
    REJECTED: ["Created", "Assigned", "Submitted by user", "Rejected by reviewer"],
    APPROVED: ["Created", "Assigned", "Submitted by user", "Reviewed", "Approved"],
  };

  const reviewers = ["arun.bhaskar", "priya.deshmukh", "sunita.rao", "kavita.nair"];
  let subSeq = 1;
  await Promise.all(
    subDefs.map((s) => {
      const seq = String(subSeq++).padStart(3, "0");
      const submitted = ["SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED", "REJECTED", "APPROVED"].includes(s.status);
      const reviewed = ["CHANGES_REQUESTED", "REJECTED", "APPROVED"].includes(s.status);
      return db.submission.create({
        data: {
          ref: `SUB-2526-${seq}`,
          title: s.title,
          category: s.category,
          metricName: s.metricName,
          metricValue: s.metricValue,
          metricUnit: s.metricUnit,
          status: s.status,
          overdue: s.overdue ?? false,
          period: "FY 2025-26",
          fiscalQuarter: s.quarter ?? "Q2",
          dueDate: at(-s.days - 5),
          submittedAt: submitted ? at(s.days) : null,
          reviewedAt: reviewed ? at(s.days + 1) : null,
          subsidiaryId: subs[s.sub].id,
          businessUnitId: units[s.unit].id,
          projectId: s.proj !== undefined ? projects[s.proj].id : null,
          submittedById: uIdx(s.by),
          reviewerId: s.reviewer ? uIdx(s.reviewer) : uIdx(reviewers[subSeq % reviewers.length]),
          values: JSON.stringify([
            { label: "Reported value", value: s.metricValue, unit: s.metricUnit },
            { label: "Prior period", value: +(s.metricValue * 0.94).toFixed(2), unit: s.metricUnit },
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
          history: JSON.stringify(
            statusFlow[s.status].map((step, i) => ({
              action: step,
              actor: i === 0 ? "System" : i === statusFlow[s.status].length - 1 && reviewed ? "Group Admin" : "Workflow",
              at: at(s.days - (statusFlow[s.status].length - i) * 2).toISOString(),
            }))
          ),
        },
      });
    })
  );

  // ── 6. TASKS ────────────────────────────────────────────────────
  const taskDefs = [
    { title: "Submit Q2 FY26 environmental metrics for Irrigation BU", category: "ENVIRONMENT", assigneeType: "BU", assigneeLabel: "Irrigation & Water — all eligible users", unit: 0, due: 3, priority: "HIGH", status: "ACTIVE", recipients: 6, ack: 4, done: 1 },
    { title: "Upload Q2 safety incident logs across all 16 Business Units", category: "SAFETY", assigneeType: "ROLE", assigneeLabel: "EHS / Safety Users (group-wide)", due: 6, priority: "CRITICAL", status: "ACTIVE", recipients: 7, ack: 5, done: 0 },
    { title: "FY2025-26 H1 HR & workforce data collection", category: "WORKFORCE", assigneeType: "ROLE", assigneeLabel: "HR Users (group-wide)", due: -2, priority: "HIGH", status: "OVERDUE", recipients: 4, ack: 3, done: 0 },
    { title: "Quarterly water withdrawal reconciliation", category: "WATER", assigneeType: "SUBSIDIARY", assigneeLabel: "MEIL Core — all users", sub: 0, due: 9, priority: "MEDIUM", status: "UPCOMING", recipients: 8, ack: 1, done: 0 },
    { title: "Update supplier ESG scores for Q2", category: "PROCUREMENT", assigneeType: "ROLE", assigneeLabel: "Procurement Users", due: 12, priority: "MEDIUM", status: "UPCOMING", recipients: 3, ack: 1, done: 0 },
    { title: "CSR impact report — community programs", category: "CSR", assigneeType: "USER", assigneeLabel: "Lakshmi Prasad", sub: 2, due: -5, priority: "HIGH", status: "OVERDUE", recipients: 1, ack: 1, done: 0 },
    { title: "BRSR Core — leadership integrity disclosures", category: "COMPLIANCE", assigneeType: "ROLE", assigneeLabel: "Compliance Users", due: 15, priority: "MEDIUM", status: "UPCOMING", recipients: 3, ack: 0, done: 0 },
    { title: "Renewable energy certificate (REC) reconciliation", category: "ENERGY", assigneeType: "BU", assigneeLabel: "Solar Parks BU — all eligible users", unit: 13, due: 1, priority: "HIGH", status: "ACTIVE", recipients: 4, ack: 4, done: 2 },
    { title: "Zero emission fleet reporting — Olectra", category: "ENVIRONMENT", assigneeType: "SUBSIDIARY", assigneeLabel: "Olectra Greentech Limited", sub: 1, due: 18, priority: "HIGH", status: "UPCOMING", recipients: 6, ack: 2, done: 0 },
  ];

  await Promise.all(
    taskDefs.map((t, i) =>
      db.task.create({
        data: {
          ref: `TSK-2526-${String(i + 1).padStart(3, "0")}`,
          title: t.title,
          description: "Consolidated reporting instruction issued by Group ESG office. Provide supporting evidence with each data point.",
          category: t.category,
          assigneeType: t.assigneeType,
          assigneeLabel: t.assigneeLabel,
          subsidiaryId: t.sub !== undefined ? subs[t.sub].id : null,
          businessUnitId: t.unit !== undefined ? units[t.unit].id : null,
          period: "FY 2025-26",
          startDate: at(-20),
          dueDate: at(t.due),
          priority: t.priority,
          status: t.status,
          requiresEvidence: true,
          recipients: t.recipients,
          acknowledged: t.ack,
          completed: t.done,
          remindersSent: t.status === "OVERDUE" ? 2 : t.status === "ACTIVE" ? 1 : 0,
          reminderLog: JSON.stringify(t.status === "OVERDUE" ? [{ at: at(-3).toISOString(), channel: "In-app" }, { at: at(-1).toISOString(), channel: "In-app" }] : []),
        },
      })
    )
  );

  // ── 7. NOTIFICATIONS ────────────────────────────────────────────
  const notifs = [
    { ntype: "OVERDUE", title: "1 submission overdue in Heavy Civil & Tunnels", body: "HR / Workforce data collection has crossed its due date.", severity: "CRITICAL", read: false, linkView: "submissions" },
    { ntype: "SUBMISSION", title: "New submission under review", body: "Scope 1 — Stationary Combustion Emissions submitted by Ramesh Iyer awaits your review.", severity: "INFO", read: false, linkView: "approvals" },
    { ntype: "APPROVAL", title: "Batch approval completed", body: "5 submissions approved across MEIL Core in the latest review cycle.", severity: "SUCCESS", read: false, linkView: "approvals" },
    { ntype: "DEADLINE", title: "Q2 data freeze in 20 days", body: "All 16 Business Units must complete emissions and water disclosures before the freeze.", severity: "WARNING", read: true, linkView: "tasks" },
    { ntype: "DATA_QUALITY", title: "Unit variance check passed", body: "All 7 subsidiaries validated against GHG Protocol standards.", severity: "INFO", read: true, linkView: "consolidation" },
    { ntype: "SYSTEM", title: "Automated consolidation run complete", body: "Consolidated data engine synced 32 project sites across 16 BUs successfully.", severity: "INFO", read: true, linkView: "consolidation" },
  ];
  await Promise.all(notifs.map((n, i) => db.notification.create({ data: { ...n, refId: "", createdAt: at(-i, 8 + i) } })));

  // ── 8. MESSAGES ─────────────────────────────────────────────────
  const msgs = [
    { kind: "ANNOUNCEMENT", channel: "GROUP_WIDE", subject: "FY 2025-26 BRSR reporting calendar published", body: "The consolidated reporting calendar for FY 2025-26 is now available. Q2 data freeze is scheduled in 20 days across all 7 subsidiaries.", audienceLabel: "All eligible reporting users", recipients: 31, delivered: 31, failed: 0, readCount: 26, status: "SENT", createdAt: at(-4) },
    { kind: "POLICY", channel: "GROUP_WIDE", subject: "Updated ESG evidence policy v2.1", body: "All submissions across the 16 Business Units must now include calibration certificates for meters.", audienceLabel: "All eligible reporting users", recipients: 31, delivered: 31, failed: 0, readCount: 22, status: "SENT", createdAt: at(-7) },
  ];
  await Promise.all(msgs.map((m) => db.message.create({ data: { ...m, sentBy: "Group Admin" } })));

  // ── 9. DISCLOSURES ──────────────────────────────────────────────
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

  // ── 10. BRSR REPORT ─────────────────────────────────────────────
  const allScope = {
    subsidiaryIds: subs.map((s) => s.id),
    businessUnitIds: units.map((u) => u.id),
    projectIds: projects.map((p) => p.id),
  };
  await db.brsrReport.create({
    data: {
      ref: "BRSR-FY2526-Consolidated",
      title: "MEIL Group Consolidated BRSR — FY 2025-26",
      financialYear: "FY 2025-26",
      framework: "SEBI BRSR Core v1.0",
      periodStart: at(-200),
      periodEnd: at(165),
      description: "Consolidated annual Business Responsibility & Sustainability Report across 7 subsidiaries and 16 Business Units.",
      ownerName: "Group Admin",
      status: "FINALIZED",
      wizardStep: 8,
      scope: JSON.stringify(allScope),
      sections: JSON.stringify([
        { id: "s1", title: "General Disclosures", content: "Corporate identity: Megha Engineering & Infrastructures Ltd. and 7 Subsidiaries.", sourceRefs: ["ORG-MASTER"] },
        { id: "s2", title: "Management & Process Disclosures", content: "Group-wide ESG committee and SEBI BRSR alignment.", sourceRefs: ["GOV-POLICY"] },
        { id: "s3", title: "Environmental Performance", content: "Consolidated performance across 16 Business Units.", sourceRefs: ["SUB-2526-001", "SUB-2526-002"] },
        { id: "s4", title: "Social Performance", content: "Workforce health, safety, and local community outreach.", sourceRefs: ["SUB-2526-007"] },
        { id: "s5", title: "Governance & Ethics", content: "Zero non-compliance events and green supply chain initiatives.", sourceRefs: ["SUB-2526-011"] },
      ]),
      disclosures: JSON.stringify(
        disclosures.map((d, i) => ({
          code: d.code,
          title: d.title,
          mapped: true,
          status: "VALIDATED",
          value: (i + 1) * 140,
          unit: d.unit,
          note: "Validated against verified site submissions.",
        }))
      ),
      signoffs: JSON.stringify([
        { role: "Group CFO", name: "R. Srinivasan", decision: "APPROVED", at: at(-10).toISOString(), comment: "Reviewed consolidated metrics." },
        { role: "Group Managing Director", name: "P. Rama Rao", decision: "APPROVED", at: at(-8).toISOString(), comment: "Approved for SEBI submission." },
      ]),
      exports: JSON.stringify([
        { format: "PDF", at: at(-7).toISOString(), by: "Group Admin" },
        { format: "XLSX", at: at(-7).toISOString(), by: "Group Admin" },
      ]),
      version: 1,
      versions: JSON.stringify([{ version: 1, at: at(-7).toISOString(), by: "Group Admin", note: "Finalized consolidated BRSR report." }]),
      finalizedAt: at(-7),
    },
  });

  // ── 11. SETTINGS ────────────────────────────────────────────────
  const settings = [
    { skey: "reporting_year", label: "Active reporting year", category: "REPORTING", svalue: JSON.stringify({ value: "FY 2025-26" }), vtype: "select", options: JSON.stringify(["FY 2024-25", "FY 2025-26", "FY 2026-27"]) },
    { skey: "q2_freeze_date", label: "Q2 FY26 data freeze date", category: "REPORTING", svalue: JSON.stringify({ value: at(20).toISOString().slice(0, 10) }), vtype: "text" },
    { skey: "reminder_cadence_days", label: "Deadline reminder cadence (days)", category: "REMINDERS", svalue: JSON.stringify({ value: 3 }), vtype: "number" },
    { skey: "escalation_enabled", label: "Auto-escalate overdue tasks to managers", category: "REMINDERS", svalue: JSON.stringify({ value: true }), vtype: "toggle" },
    { skey: "approval_stages", label: "Approval workflow stages", category: "WORKFLOW", svalue: JSON.stringify({ value: "Group Admin → CFO (BRSR only)" }), vtype: "text" },
    { skey: "brsr_framework", label: "BRSR framework version", category: "REPORTING", svalue: JSON.stringify({ value: "SEBI BRSR Core v1.0" }), vtype: "select", options: JSON.stringify(["SEBI BRSR Core v1.0", "SEBI BRSR Core v1.1 (draft)"]) },
    { skey: "emissions_factor_set", label: "Emissions factor set", category: "CALCULATION", svalue: JSON.stringify({ value: "GHG Protocol — India Grid 2024 (v4.2)" }), vtype: "select", options: JSON.stringify(["GHG Protocol — India Grid 2024 (v4.2)", "GHG Protocol — India Grid 2023 (v4.1)"]) },
    { skey: "session_timeout_min", label: "Session timeout (minutes)", category: "SECURITY", svalue: JSON.stringify({ value: 30 }), vtype: "number" },
  ];
  await Promise.all(settings.map((s) => db.appSetting.create({ data: s })));

  const counts = {
    subsidiaries: await db.subsidiary.count(),
    units: await db.businessUnit.count(),
    projects: await db.project.count(),
    users: await db.user.count(),
    submissions: await db.submission.count(),
    tasks: await db.task.count(),
  };
  console.log("Seed complete:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
