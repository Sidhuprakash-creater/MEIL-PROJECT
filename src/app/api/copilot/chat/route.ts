// POST /api/copilot/chat — SSE-orchestrated copilot turn.
// Body: { conversationId, message, reportingYear? }
// The response is a text/event-stream of real orchestration events.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCopilotUser, copilotResponseError, CopilotError } from "@/lib/copilot/server";
import { orchestratorSse } from "@/lib/copilot/orchestrator";
import { resolveProviderId } from "@/lib/copilot/gateway";

export const maxDuration = 300;

/* ── Provider-aware rate limiting ──────────────────────────────────────────
   Groq free-tier keys serve roughly one request per minute per key; bursting
   past that returns 429 for the whole window. The gateway already retries
   transient 429s, but a proactive per-user cooldown keeps the UX honest:
   the second immediate question gets a clear "wait Ns" answer instead of a
   stalled stream. Gemini keys are not throttled here. */
const GROQ_MIN_INTERVAL_MS = 60_000;
const lastRequestAt = new Map<string, number>();

function checkGroqCooldown(userId: string): { limited: boolean; retryAfterSec: number } {
  if (resolveProviderId() !== "groq") return { limited: false, retryAfterSec: 0 };
  const now = Date.now();
  const last = lastRequestAt.get(userId);
  if (last && now - last < GROQ_MIN_INTERVAL_MS) {
    return { limited: true, retryAfterSec: Math.ceil((GROQ_MIN_INTERVAL_MS - (now - last)) / 1000) };
  }
  lastRequestAt.set(userId, now);
  // Keep the map bounded — stale entries older than 10 minutes are swept.
  for (const [uid, ts] of lastRequestAt) {
    if (now - ts > 10 * 60_000) lastRequestAt.delete(uid);
  }
  return { limited: false, retryAfterSec: 0 };
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireCopilotUser(req.headers);

    const cooldown = checkGroqCooldown(user.id);
    if (cooldown.limited) {
      return NextResponse.json(
        {
          error: `MEIL Intelligence is cooling down — the AI provider allows one request per minute. Next request available in ${cooldown.retryAfterSec}s.`,
          code: "RATE_LIMITED",
          retryAfter: cooldown.retryAfterSec,
        },
        { status: 429, headers: { "Retry-After": String(cooldown.retryAfterSec) } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const reportingYear = typeof body.reportingYear === "string" ? body.reportingYear : "FY 2025-26";
    if (!conversationId) throw new CopilotError("conversationId is required.", 400, "MISSING_CONVERSATION");
    if (!message) throw new CopilotError("Message is required.", 400, "MISSING_MESSAGE");

    const conv = await db.copilotConversation.findFirst({ where: { id: conversationId, userId: user.id, archived: false } });
    if (!conv) throw new CopilotError("Conversation not found.", 404, "NOT_FOUND");

    // Update the conversation context with the live workspace scope.
    await db.copilotConversation.update({
      where: { id: conv.id },
      data: {
        context: JSON.stringify({ reportingYear, viewId: typeof body.viewId === "string" ? body.viewId : undefined, orgScope: typeof body.orgScope === "string" ? body.orgScope : "GROUP" }),
      },
    });

    // Auto-title from the first user message (real content, not invented).
    if (conv.title === "New conversation") {
      const title = message.length > 60 ? `${message.slice(0, 57)}…` : message;
      await db.copilotConversation.update({ where: { id: conv.id }, data: { title } });
    }

    return orchestratorSse({
      conversationId: conv.id,
      userText: message,
      reportingYear,
      ctx: {
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        conversationId: conv.id,
        reportingYear,
      },
    });
  } catch (e) {
    return copilotResponseError(e);
  }
}
