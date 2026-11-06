const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
const t = async (label, fn) => {
  const s = Date.now();
  const r = await fn();
  console.log(`${label.padEnd(28)} ${String(Date.now() - s).padStart(6)} ms`);
  return r;
};
(async () => {
  console.log("--- warmup ---");
  await t("warmup count", () => p.user.count());

  console.log("\n--- SEQUENTIAL (5 queries) ---");
  let s = Date.now();
  await t("submission.findUnique", () => p.submission.findUnique({ where: { id: "cmw4nhz1q0001e9xsgyf2o598" } }));
  await t("user.findUnique", () => p.user.findUnique({ where: { id: "cmvt596uj00017k44uqelt2ry" } }));
  await t("evidence.findMany", () => p.evidence.findMany({ take: 2 }));
  await t("validationResult.findMany", () => p.validationResult.findMany({ take: 2 }));
  await t("soAuditLog.findMany", () => p.soAuditLog.findMany({ take: 2 }));
  console.log(`TOTAL SEQUENTIAL: ${Date.now() - s} ms`);

  console.log("\n--- PARALLEL (same 5) ---");
  s = Date.now();
  await Promise.all([
    p.submission.findUnique({ where: { id: "cmw4nhz1q0001e9xsgyf2o598" } }),
    p.user.findUnique({ where: { id: "cmvt596uj00017k44uqelt2ry" } }),
    p.evidence.findMany({ take: 2 }),
    p.validationResult.findMany({ take: 2 }),
    p.soAuditLog.findMany({ take: 2 }),
  ]);
  console.log(`TOTAL PARALLEL: ${Date.now() - s} ms`);

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
