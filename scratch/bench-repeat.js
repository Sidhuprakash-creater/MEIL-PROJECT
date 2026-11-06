const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
const t = async (label, fn) => { const s = Date.now(); const r = await fn(); console.log(`${label.padEnd(40)} ${String(Date.now()-s).padStart(6)} ms`); return r; };
(async () => {
  await t("warmup", () => p.user.count());
  console.log("\n--- repeat identical flat query 5x (is it the pooler?) ---");
  for (let i = 1; i <= 5; i++) {
    await t(`submission.findMany take=5  #${i}`, () => p.submission.findMany({ take: 5 }));
  }
  console.log("\n--- repeat with explicit transaction (single conn) ---");
  for (let i = 1; i <= 3; i++) {
    await t(`$transaction 3 queries  #${i}`, () => p.$transaction([
      p.submission.findMany({ take: 5 }),
      p.project.findMany({ take: 5 }),
      p.user.findMany({ take: 5 }),
    ]));
  }
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
