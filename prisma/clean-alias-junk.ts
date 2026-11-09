/* One-off cleanup: remove legacy SAFETY/TRAINING submissions that were created
   purely by the reversed submit-all alias bug (their recordIds duplicate the
   permits/initiatives data). */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const PROJECT_ID = "cmvt5842u002c7kssl8jciq2c";
const PERIOD_ID = "cmvt6ag9q00087kxwvb2pkxhx";

async function main() {
  const junk = await db.submission.findMany({
    where: { projectId: PROJECT_ID, reportingPeriodId: PERIOD_ID, module: { in: ["SAFETY", "TRAINING"] } },
    select: { id: true, module: true, recordIds: true },
  });
  console.log("junk submissions:", junk.length);
  for (const j of junk) {
    await db.submission.delete({ where: { id: j.id } });
    console.log("deleted", j.module, j.id);
  }
  // remove their level records from the JSON store
  const fs = await import("node:fs");
  const storePath = "prisma/level-records-store.json";
  const store = JSON.parse(fs.readFileSync(storePath, "utf8"));
  const arr = Array.isArray(store) ? store : store.records || [];
  const junkIds = new Set(junk.flatMap((j) => { try { return JSON.parse(j.recordIds || "[]"); } catch { return []; } }));
  const filtered = arr.filter((r: any) => !(junkIds.has(r.id) && (r.levelKey === "level5" || r.levelKey === "level6")));
  const removed = arr.length - filtered.length;
  fs.writeFileSync(storePath, JSON.stringify(Array.isArray(store) ? filtered : { ...store, records: filtered }, null, 2));
  console.log("store records removed:", removed);
  // dossier recordIds cleanup
  const dossier = await db.submission.findFirst({ where: { projectId: PROJECT_ID, reportingPeriodId: PERIOD_ID, module: "ALL_LEVELS" } });
  if (dossier) {
    const rids: string[] = JSON.parse(dossier.recordIds || "[]");
    const cleaned = rids.filter((rid) => !junkIds.has(rid));
    await db.submission.update({ where: { id: dossier.id }, data: { recordIds: JSON.stringify(cleaned) } });
    console.log("dossier recordIds:", rids.length, "→", cleaned.length);
  }
}
main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
