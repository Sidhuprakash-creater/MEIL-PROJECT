/* Creates a real Project Admin user on the user's own Gmail address,
   scoped to PRJ-POLA, so submission emails land in a real inbox. */
import { db } from "../src/lib/db";
import { provisionUser } from "../src/lib/auth/provision-user";

(async () => {
  const pola = await db.project.findUnique({ where: { code: "PRJ-POLA" } });
  const subId = pola!.businessUnitId ? (await db.businessUnit.findUnique({ where: { id: pola!.businessUnitId } }))?.subsidiaryId : null;
  const result = await provisionUser({
    name: "Jenas Sidhu Prakash",
    email: "jenasidhuprakash@gmail.com",
    role: "PROJECT_ADMIN",
    subsidiaryId: subId ?? undefined,
    projectId: pola!.id,
    actor: { name: "Demo Setup", role: "GROUP_ADMIN" },
    allowedRoles: ["PROJECT_ADMIN"],
    sendInvite: false,
  });
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
})().catch((e) => { console.error("ERR:", e); process.exit(1); });
