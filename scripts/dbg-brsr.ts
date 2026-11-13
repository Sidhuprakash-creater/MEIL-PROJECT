import { db } from "../src/lib/db";
(async () => {
  const reports = await db.brsrReport.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, ref: true, financialYear: true, status: true, wizardStep: true, disclosures: true } });
  console.log("BRSR reports:", reports.map(r => ({ ref: r.ref, fy: r.financialYear, status: r.status, step: r.wizardStep, discs: r.disclosures.length })));
  const subs = await db.subsidiary.findMany({ select: { id: true, code: true, name: true } });
  console.log("subsidiaries:", subs.map(s => `${s.code} ${s.name}`));
  const catalog = await db.disclosure.findMany({ select: { code: true, unit: true, title: true }, orderBy: { code: "asc" } });
  console.log("catalog size:", catalog.length);
  console.log("sample codes:", catalog.slice(0, 12).map(c => `${c.code}(${c.unit})`));
  process.exit(0);
})().catch((e) => { console.error("ERR:", e); process.exit(1); });
