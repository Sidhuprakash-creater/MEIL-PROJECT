const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const t = async (label, fn) => { const s = Date.now(); await fn(); return Date.now()-s; };
  await t("warm", () => p.user.count());
  console.log("--- 8 sequential single-row queries ---");
  const times = [];
  for (let i = 0; i < 8; i++) times.push(await t("q", () => p.user.findFirst({ select: { id: true } })));
  console.log("times:", times.join(", "), "| median:", times.sort((a,b)=>a-b)[4], "ms");
  console.log("\n--- 8 queries in ONE $transaction ---");
  const s = Date.now();
  await p.$transaction(Array.from({length:8}, () => p.user.findFirst({ select: { id: true } })));
  console.log("total:", Date.now()-s, "ms  (per query:", Math.round((Date.now()-s)/8), "ms)");
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
