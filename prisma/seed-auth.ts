/**
 * MEIL ESG & BRSR Platform — portal credential provisioning.
 * Run AFTER the main seeder:  npx tsx prisma/seed-auth.ts
 *
 * Assigns every user a portal handle (employeeId) and provisions the demo
 * password "Esg@2025" as a scrypt hash.
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const db = new PrismaClient();

/* Portal handles for the accounts surfaced on the gateway demo table. */
const EMP_BY_EMAIL: Record<string, string> = {
  "arun.bhaskar@meil.in": "GRP-0001",
  "rama.rao@meil.in": "SUB-1001",
  "priya.deshmukh@meil.in": "SUB-1002",
  "kv.pradeep@olectra.com": "SUB-2001",
  "sunita.rao@olectra.com": "SUB-2002",
  "vikram.shetty@meghagas.com": "SUB-3001",
  "kavita.nair@meghagas.com": "SUB-3002",
  "simone.trevisani@drillmec.com": "SUB-4001",
  "meiling.tan@drillmec.com": "SUB-4002",
  "roberto.rossi@petreven.com": "SUB-5001",
  "elena.rossi@petreven.com": "SUB-5002",
  "rajesh.menon@meilsolar.com": "SUB-6001",
  "divya.iyer@meilsolar.com": "SUB-6002",
  "anil.kapoor@meilhydro.com": "SUB-7001",
  "shalini.verma@meilhydro.com": "SUB-7002",
  "harish.chandra@meil.in": "BU-1001",
  "gopal.rao@meil.in": "BU-1002",
  "manoj.sharma@meil.in": "BU-2001",
  "suresh.babu@meil.in": "BU-3001",
  "b.shanker@olectra.com": "BU-4001",
  "anita.joshi@olectra.com": "BU-4002",
  "admin@site.meil.in": "PRJ-ADMIN",
  "ramesh.iyer@meil.in": "ENV-1001",
  "deepa.krishnan@meil.in": "ENV-1002",
  "santosh.rao@meil.in": "FIN-1001",
  "aparna.das@meil.in": "HR-1001",
  "mohit.jain@meil.in": "EHS-1001",
  "sneha.kulkarni@meil.in": "EHS-1002",
  "ravi.teja@meil.in": "PRO-1001",
  "lakshmi.prasad@meil.in": "CSR-1001",
  "farhan.ali@meil.in": "CMP-1001",
  // Project User Portal (welcome screen) demo role accounts
  "rohit@meil-esg.in": "PU-ENV-014",
  "finance@meil-esg.in": "PU-FIN-015",
  "sunita@meil-esg.in": "PU-HR-016",
  "kvenkat@meil-esg.in": "PU-EHS-017",
  "priya@meil-esg.in": "PU-PRC-018",
  "imran@meil-esg.in": "PU-CSR-019",
  "deepika@meil-esg.in": "PU-CMP-020",
  "projectadmin@meil-esg.in": "ADM-1001",
};

const PU_ROLE_DEFS: Array<{ email: string; name: string; role: string; title: string }> = [
  { email: "rohit@meil-esg.in", name: "Rohit Kumar", role: "ENV_DATA_USER", title: "Environment Data Officer" },
  { email: "finance@meil-esg.in", name: "Rakesh Verma", role: "FIN_RESOURCE_USER", title: "Finance & Resource Contributor" },
  { email: "sunita@meil-esg.in", name: "Sunita Rao", role: "HR_USER", title: "HR User" },
  { email: "kvenkat@meil-esg.in", name: "K. Venkat", role: "EHS_USER", title: "EHS Safety Officer" },
  { email: "priya@meil-esg.in", name: "Priya Nair", role: "PROCUREMENT_USER", title: "Procurement Analyst" },
  { email: "imran@meil-esg.in", name: "Imran Sheikh", role: "CSR_USER", title: "CSR Program Lead" },
  { email: "deepika@meil-esg.in", name: "Deepika Joshi", role: "COMPLIANCE_USER", title: "Compliance Officer" },
  { email: "projectadmin@meil-esg.in", name: "Er. K. Venkataramana", role: "PROJECT_ADMIN", title: "Project Admin & Site Director" },
];

const DEMO_PASSWORD = "demo";

async function main() {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  // Ensure all role-picker demo users exist in the database
  const defProject = await db.project.findFirst({
    where: { status: "ACTIVE" },
    include: { businessUnit: true },
  });

  for (const p of PU_ROLE_DEFS) {
    const existing = await db.user.findUnique({ where: { email: p.email } });
    if (!existing) {
      await db.user.create({
        data: {
          email: p.email,
          name: p.name,
          role: p.role,
          title: p.title,
          status: "ACTIVE",
          projectId: defProject?.id ?? null,
          businessUnitId: defProject?.businessUnitId ?? null,
        },
      });
    }
  }

  // Reset employeeId temporarily to avoid unique constraint collisions during reassignment
  await db.$executeRawUnsafe('UPDATE "User" SET "employeeId" = NULL');
  const users = await db.user.findMany({ orderBy: { email: "asc" } });

  let seq = 1;
  for (const u of users) {
    const employeeId = EMP_BY_EMAIL[u.email] ?? `EMP-${String(seq).padStart(4, "0")}`;
    seq++;
    await db.user.update({
      where: { id: u.id },
      data: { employeeId, passwordHash },
    });
  }

  console.log(
    `Portal credentials provisioned for ${users.length} users (password: ${DEMO_PASSWORD}).`
  );
  console.log("Group Admin sign-in: GRP-0001 or arun.bhaskar@meil.in");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
