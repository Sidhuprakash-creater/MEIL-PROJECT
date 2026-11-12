import { db } from "../src/lib/db";

(async () => {
  const docs = await db.evidence.findMany({
    where: { module: { in: ["ENERGY", "WATER", "WASTE", "EMISSIONS"] } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true, fileName: true, hash: true, module: true, projectId: true,
      sourceRecordId: true, status: true, createdAt: true, uploaderId: true,
    },
  });
  console.log("EVIDENCE ROWS (latest 20):");
  for (const d of docs) {
    console.log(` ${d.id.slice(0, 10)} | ${d.fileName?.slice(0, 34)} | mod=${d.module} | hash=${(d.hash ?? "").slice(0, 12)} | srcRec=${d.sourceRecordId?.slice(0, 12) ?? "-"} | by=${d.uploaderId?.slice(0, 8) ?? "-"}`);
  }

  // Which evidence ids are referenced by more than one staged item?
  const recs = await db.soSubmission.findMany({
    where: { module: { in: ["ENERGY", "WATER", "WASTE", "EMISSIONS"] } },
    orderBy: { updatedAt: "desc" },
    take: 6,
    select: { id: true, title: true, recordIds: true, module: true, status: true },
  });
  console.log("\nRECORDS (level records) with their evidence references:");
  for (const r of recs) {
    let parsed: any[] = [];
    try { parsed = JSON.parse(r.recordIds || "[]"); } catch {}
    console.log(` ${r.id.slice(0, 10)} | ${r.module} | items=${parsed.length}`);
    for (const it of parsed) {
      const ids = Array.isArray(it.evidenceIds) ? it.evidenceIds : it.evidenceId ? [it.evidenceId] : [];
      console.log(`    item ${(it.id ?? "?").slice(0, 12)} | source=${(it.sourceRecordId ?? "-").slice(0, 10)} | evidence=[${ids.map((x: string) => x.slice(0, 10)).join(",")}]`);
    }
  }
  process.exit(0);
})();
