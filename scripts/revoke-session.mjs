// Remove a minted smoke/UI session by its token hash.
import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";

const envText = await Bun.file(".env").text();
const directUrl = envText.match(/^DIRECT_URL="?([^"\r\n]+)"?/m)?.[1];
const db = new PrismaClient(directUrl ? { datasources: { db: { url: directUrl } } } : {});

const token = process.argv[2];
if (!token) {
  console.error("usage: bun scripts/revoke-session.mjs <token>");
  process.exit(1);
}
const tokenHash = createHash("sha256").update(token).digest("hex");
const r = await db.session.deleteMany({ where: { tokenHash } });
console.log(`revoked ${r.count} session row(s)`);
await db.$disconnect();
