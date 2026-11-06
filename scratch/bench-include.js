const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
const t = async (label, fn) => { const s = Date.now(); const r = await fn(); console.log(`${label.padEnd(46)} ${String(Date.now()-s).padStart(6)} ms`); return r; };
const INCLUDE = {
  project: { select: { id:true, code:true, name:true, location:true, status:true,
    businessUnit: { select: { id:true, name:true, subsidiary: { select: { id:true, name:true } } } } } },
  reportingPeriod: { select: { id:true, periodLabel:true, year:true, month:true, status:true,
    reportingYear: { select: { id:true, label:true, year:true } } } },
  reviewer: { select: { id:true, name:true, email:true } },
};
(async () => {
  await t("warmup", () => p.user.count());
  console.log("\n--- deep include, take=1 ---");
  await t("submission.findMany INCLUDE take=1", () => p.submission.findMany({ take: 1, include: INCLUDE }));
  console.log("\n--- same, no include ---");
  await t("submission.findMany take=1 (no include)", () => p.submission.findMany({ take: 1 }));
  console.log("\n--- flat select, take=1 ---");
  await t("submission.findMany take=1 (flat select)", () => p.submission.findMany({ take: 1, select: { id:true, ref:true, title:true, module:true, status:true, recordIds:true } }));
  console.log("\n--- deep include, take=20 ---");
  await t("submission.findMany INCLUDE take=20", () => p.submission.findMany({ take: 20, include: INCLUDE }));
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
