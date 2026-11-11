// Mint a GROUP_ADMIN session token for local UI verification.
// Usage: bun scripts/mint-session.mjs [--user-id <id>] [--keep]
// Prints: <token> <userId>   (the session row is removed when --keep is absent)
import { createHash, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const envText = await Bun.file(".env").text();
const directUrl = envText.match(/^DIRECT_URL="?([^"\r\n]+)"?/m)?.[1];
const db = new PrismaClient(directUrl ? { datasources: { db: { url: directUrl } } } : {});

const args = process.argv.slice(2);
const keep = args.includes("--keep");
const userIdIdx = args.indexOf("--user-id");
const wantedId = userIdIdx >= 0 ? args[userIdIdx + 1] : null;

const user = wantedId
  ? await db.user.findUnique({ where: { id: wantedId } })
  : await db.user.findFirst({ where: { role: "GROUP_ADMIN", status: "ACTIVE" }, orderBy: { createdAt: "asc" } });

if (!user) {
  console.error("no GROUP_ADMIN user found");
  process.exit(1);
}

const token = randomBytes(32).toString("hex");
const tokenHash = createHash("sha256").update(token).digest("hex");
await db.session.create({
  data: { tokenHash, userId: user.id, expiresAt: new Date(Date.now() + 6 * 3600_000) },
});

if (!keep) {
  // the caller deletes it by hash when done
  console.log(`TOKEN=${token}`);
  console.log(`HASH=${tokenHash}`);
  console.log(`USER=${user.id}`);
  console.log(`NAME=${user.name}`);
} else {
  console.log(`kept session for ${user.name} (${user.id})`);
}
await db.$disconnect();
