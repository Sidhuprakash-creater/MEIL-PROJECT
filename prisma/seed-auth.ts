/**
 * MEIL ESG & BRSR Platform — portal credential provisioning.
 * Run AFTER the main seeder:  bun prisma/seed-auth.ts
 *
 * Assigns every user a portal handle (employeeId) and provisions the demo
 * password "Esg@2025" as a scrypt hash. Status gates (SUSPENDED / INACTIVE /
 * INVITED) still refuse sign-in server-side, exactly as in production.
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const db = new PrismaClient();

/* Portal handles for the accounts surfaced on the gateway demo table. */
const EMP_BY_EMAIL: Record<string, string> = {
  "arun.bhaskar@meil.in": "GRP-0001",
  "rajesh.menon@meil.in": "SUB-1001",
  "priya.deshmukh@meil.in": "SUB-1002",
  "anil.kapoor@meil.in": "SUB-2001",
  "sunita.rao@meil.in": "SUB-2002",
  "vikram.shetty@meil.in": "SUB-3001",
  "kavita.nair@meil.in": "SUB-3002",
  "daniel.foo@meilglobal.com": "SUB-4001",
  "meiling.tan@meilglobal.com": "SUB-4002",
  "suresh.babu@meil.in": "BU-1001",
  "arvind.swamy@meil.in": "BU-1002",
  "manoj.sharma@meil.in": "BU-2001",
  "harish.chandra@meil.in": "BU-2002",
  "prasad.patil@meil.in": "BU-3001",
  "kiran.reddy@meil.in": "BU-3002",
  "wei.zhang@meilglobal.com": "BU-4001",
  "naveen.kumar@meil.in": "BU-4002",
};

const DEMO_PASSWORD = "Esg@2025";

async function main() {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
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
