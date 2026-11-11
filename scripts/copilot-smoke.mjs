// MEIL Intelligence — end-to-end smoke test (run with bun).
// Mints a real GROUP_ADMIN session in the database, then exercises the
// copilot API against the running dev server: conversation create, chat SSE
// (real Gemini tool-calling), confirmation flow is NOT executed (no side
// effects). Cleans up the session afterwards.
//
// Usage: bun scripts/copilot-smoke.mjs [question]

import { createHash, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const question = process.argv[2] || "How many subsidiaries are active, and how many submissions are waiting for review right now?";

// The smoke client talks to Supabase directly (5432) so it never competes for
// the transaction pooler (6543) that the running dev server is using.
const envText = await Bun.file(".env").text();
const directUrl = envText.match(/^DIRECT_URL="?([^"\r\n]+)"?/m)?.[1];

const db = new PrismaClient(directUrl ? { datasources: { db: { url: directUrl } } } : {});

/** Retry helper — the Supabase pooler occasionally drops a connection. */
async function withRetry(fn, label, attempts = 4) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const msg = String(e).split("\n").find((l) => /P10|Can't reach|Timed out|connection/i.test(l)) ?? String(e).split("\n")[0];
      console.log(`  retry ${i + 1}/${attempts - 1} after ${label}: ${msg.slice(0, 110)}`);
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw last;
}

async function main() {
  // 1. find (or create) a Group Admin user
  let user = await withRetry(() => db.user.findFirst({ where: { role: "GROUP_ADMIN", status: "ACTIVE" } }), "user lookup");
  if (!user) {
    user = await withRetry(() => db.user.create({
      data: {
        employeeId: "GRP-SMOKE",
        name: "Copilot Smoke Test",
        email: "copilot-smoke@meil.in",
        passwordHash: "!",
        role: "GROUP_ADMIN",
        status: "ACTIVE",
      },
    }), "user create");
    console.log("created smoke user", user.id);
  }

  // 2. mint a session row (token is returned raw; DB stores sha256)
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await withRetry(() => db.session.create({
    data: { tokenHash, userId: user.id, expiresAt: new Date(Date.now() + 3600_000) },
  }), "session create");
  const cookie = `meil_esg_session=${token}`;

  try {
    // 3. create a conversation
    const convRes = await fetch(`${BASE}/api/copilot/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ context: { reportingYear: "FY 2025-26", viewId: "intelligence" } }),
    });
    if (!convRes.ok) throw new Error(`conversation create failed: ${convRes.status} ${await convRes.text()}`);
    const conv = (await convRes.json()).conversation;
    console.log("conversation:", conv.id);

    // 4. stream one chat turn
    const chatRes = await fetch(`${BASE}/api/copilot/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ conversationId: conv.id, message: question, reportingYear: "FY 2025-26", viewId: "intelligence" }),
    });
    if (!chatRes.ok) throw new Error(`chat failed: ${chatRes.status} ${await chatRes.text()}`);

    const reader = chatRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const counts = {};
    let textOut = "";
    let done = false;
    const deadline = Date.now() + 120_000; // guard: never hang forever on a stalled stream
    while (!done && Date.now() < deadline) {
      const { done: rd, value } = await reader.read();
      if (rd) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        for (const line of frame.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          try {
            const e = JSON.parse(payload);
            counts[e.kind] = (counts[e.kind] ?? 0) + 1;
            if (e.kind === "status") console.log("  status:", e.state, "—", e.label);
            if (e.kind === "activity") console.log("  tool:", e.tool, e.status, e.detail ?? "");
            if (e.kind === "delta") textOut += e.text;
            if (e.kind === "block") console.log("  block:", e.block.type);
            if (e.kind === "error") { console.log("  ERROR:", e.message); done = true; }
            if (e.kind === "done") done = true;
          } catch { /* skip */ }
        }
      }
    }

    console.log("\nSSE event counts:", counts);
    console.log("\nReply text:\n" + (textOut || "(none)"));

    const ok = (counts.done ?? 0) > 0 && !counts.error;
    console.log(ok ? "\nSMOKE TEST PASSED" : "\nSMOKE TEST FAILED");
    if (!ok) process.exitCode = 1;
  } finally {
    try {
      await db.session.deleteMany({ where: { tokenHash } });
    } catch (e) {
      console.log("warning: could not delete the smoke session row:", String(e).split("\n")[0]);
    }
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error("smoke test error:", e);
  process.exitCode = 1;
  return db.$disconnect();
});
