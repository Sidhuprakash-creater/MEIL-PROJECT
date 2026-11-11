// Verify the new Copilot tables exist and are reachable.
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
try {
  const conversations = await p.copilotConversation.count();
  const confirmations = await p.copilotConfirmation.count();
  const saved = await p.copilotSavedItem.count();
  console.log("copilot tables OK — conversations:", conversations, "confirmations:", confirmations, "saved:", saved);
} catch (e) {
  console.error("COPILOT DB ERROR:", e.message);
  process.exit(1);
} finally {
  await p.$disconnect();
}
