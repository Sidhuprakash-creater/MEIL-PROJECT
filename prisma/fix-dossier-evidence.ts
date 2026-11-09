/* One-off backfill: apply the new submit-all evidence/recordIds logic to
   existing submissions of a project+period.
   - Dossier (ALL_LEVELS): link all latest level-record ids, real evidence only
   - Every submission: evidence = only evidence referenced by its records
   Run: npx tsx prisma/fix-dossier-evidence.ts */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { getLevelRecords } from "../src/lib/pu/level-records";

const db = new PrismaClient();
const PROJECT_ID = "cmvt5842u002c7kssl8jciq2c";
const PERIOD_ID = "cmvt6ag9q00087kxwvb2pkxhx";

function evidenceIdsFor(rec: any): string[] {
  const ids = new Set<string>();
  if (rec?.evidenceId) ids.add(String(rec.evidenceId));
  for (const eid of Array.isArray(rec?.evidenceIds) ? rec.evidenceIds : []) if (eid) ids.add(String(eid));
  for (const it of Array.isArray(rec?.data?.items) ? rec.data.items : []) {
    if (it?.evidenceId) ids.add(String(it.evidenceId));
    for (const eid of Array.isArray(it?.evidenceIds) ? it.evidenceIds : []) if (eid) ids.add(String(eid));
  }
  return [...ids];
}

async function main() {
  const records = getLevelRecords(PROJECT_ID, PERIOD_ID).filter((r) => r.status === "SUBMITTED");
  // Latest record per levelKey — store is newest-first, so FIRST occurrence wins
  // (older seeded records sit at the end of the file and must not overwrite).
  const latestByLevel = new Map<string, any>();
  for (const r of records) {
    if (r.levelKey && !latestByLevel.has(r.levelKey)) latestByLevel.set(r.levelKey, r);
  }

  const allRecords = [...latestByLevel.values()];
  const allEvIds = Array.from(new Set(allRecords.flatMap(evidenceIdsFor)));
  const evRows = allEvIds.length
    ? await db.evidence.findMany({ where: { id: { in: allEvIds } }, select: { id: true, fileName: true } })
    : [];
  const nameById = new Map(evRows.map((e) => [e.id, e.fileName || e.id]));
  console.log("DBG allRecords:", allRecords.length, "| allEvIds:", JSON.stringify(allEvIds), "| evRows:", evRows.length);
  for (const r of allRecords) {
    console.log("  DBG rec:", r.id, "| levelKey:", r.levelKey, "| evIdsFor:", JSON.stringify(evidenceIdsFor(r)));
  }
  const namesFor = (rec: any) =>
    Array.from(new Set(evidenceIdsFor(rec).map((id) => nameById.get(id)).filter(Boolean))) as string[];

  const subs = await db.submission.findMany({
    where: { projectId: PROJECT_ID, reportingPeriodId: PERIOD_ID },
    select: { id: true, module: true, recordIds: true },
  });

  for (const s of subs) {
    if (s.module === "ALL_LEVELS") {
      const dossierEvidence = Array.from(new Set(allRecords.flatMap(namesFor)));
      await db.submission.update({
        where: { id: s.id },
        data: {
          recordIds: JSON.stringify(allRecords.map((r) => r.id)),
          evidence: JSON.stringify(dossierEvidence),
          evidenceCount: dossierEvidence.length,
        },
      });
      console.log("dossier updated:", s.id, "| records:", allRecords.length, "| evidence:", dossierEvidence.length);
    } else {
      const rids = (JSON.parse(s.recordIds || "[]") as unknown[]).filter((x): x is string => typeof x === "string");
      const matched = rids
        .map((rid) => records.find((r) => r.id === rid))
        .filter(Boolean);
      const ev = Array.from(new Set(matched.flatMap(namesFor)));
      if (s.id === "cmw6826710073e9s4vzm8ilr3") {
        console.log("DEBUG target sub:", JSON.stringify({
          rids,
          matchedN: matched.length,
          evIds: evidenceIdsFor(matched[0]),
          nameByIdSize: nameById.size,
          hasId: nameById.has("cmvt6cqfa003w7kxw2nshwv5n"),
          ev,
        }));
      }
      await db.submission.update({
        where: { id: s.id },
        data: { evidence: JSON.stringify(ev), evidenceCount: ev.length },
      });
      console.log(`${s.module}: evidence ${ev.length} ->`, ev.join(", ") || "(none)");
    }
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
