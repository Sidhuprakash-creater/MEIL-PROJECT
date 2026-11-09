/* Backfill org-scope (businessUnitId/subsidiaryId) + CSR category on existing
   db.submission mirror rows created by /api/so/data-entry. */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const rows = await db.submission.findMany({
    where: { businessUnitId: null, module: { in: ["HR", "SAFETY", "PROCUREMENT", "CSR", "COMPLIANCE", "FINANCE", "INCIDENTS", "TRAINING"] } },
    select: { id: true, module: true, projectId: true, category: true },
  });
  console.log("rows to fix:", rows.length);
  const CAT: Record<string, string> = { CSR: "CSR" };
  for (const r of rows) {
    const proj = await db.project.findUnique({
      where: { id: r.projectId },
      select: { businessUnitId: true, businessUnit: { select: { subsidiaryId: true } } },
    });
    await db.submission.update({
      where: { id: r.id },
      data: {
        businessUnitId: proj?.businessUnitId || null,
        subsidiaryId: proj?.businessUnit?.subsidiaryId || null,
        ...(CAT[r.module] ? { category: CAT[r.module] } : {}),
      },
    });
  }
  console.log("backfilled");
  // also fix CSR category on rows that already had BU set
  const csr = await db.submission.updateMany({ where: { module: "CSR", category: "ENVIRONMENT" }, data: { category: "CSR" } });
  console.log("CSR category fixed:", csr.count);
}
main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
