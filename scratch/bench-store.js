const fs = require("fs");
const path = "prisma/level-records-store.json";
const s = Date.now();
for (let i = 0; i < 10; i++) { const st = fs.statSync(path); JSON.parse(fs.readFileSync(path, "utf-8")); }
console.log(`10x readStore: ${Date.now() - s} ms  (${((Date.now()-s)/10).toFixed(1)} ms each)`);
