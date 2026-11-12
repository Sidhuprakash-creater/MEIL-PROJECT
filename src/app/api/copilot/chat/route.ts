// POST /api/copilot/chat — SSE-orchestrated copilot turn.
// Body: { conversationId, message, reportingYear? }
// The response is a text/event-stream of real orchestration events.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCopilotUser, copilotResponseError, CopilotError } from "@/lib/copilot/server";
import { orchestratorSse } from "@/lib/copilot/orchestrator";

export const maxDuration = 300;

/* NOTE — no proactive per-user cooldown.
   The earlier implementation blocked every request for 60s on the Groq free
   tier, which made the assistant unusable in a live demo (one question per
   minute). The gateway already retries transient 429s internally with
   backoff, so a genuine provider throttle is handled there — the client is
   never artificially locked out. */

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireCopilotUser(req.headers);

    const body = await req.json().catch(() => ({}));
    const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const reportingYear = typeof body.reportingYear === "string" ? body.reportingYear : "FY 2025-26";
    if (!conversationId) throw new CopilotError("conversationId is required.", 400, "MISSING_CONVERSATION");
    if (!message) throw new CopilotError("Message is required.", 400, "MISSING_MESSAGE");

    const conv = await db.copilotConversation.findFirst({ where: { id: conversationId, userId: user.id, archived: false } });
    if (!conv) throw new CopilotError("Conversation not found.", 404, "NOT_FOUND");

    // Update the conversation context with the live workspace scope — the
    // existing context is MERGED so the remembered entity (lastEntity) from
    // the previous turn survives this write.
    let existingContext: Record<string, unknown> = {};
    try {
      existingContext = conv.context ? (JSON.parse(conv.context) as Record<string, unknown>) : {};
    } catch { /* keep empty */ }
    await db.copilotConversation.update({
      where: { id: conv.id },
      data: {
        context: JSON.stringify({
          ...existingContext,
          reportingYear,
          viewId: typeof body.viewId === "string" ? body.viewId : undefined,
          orgScope: typeof body.orgScope === "string" ? body.orgScope : "GROUP",
        }),
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
