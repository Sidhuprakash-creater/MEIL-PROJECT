// GET    /api/copilot/conversations/[id] — full conversation (messages + executions)
// PATCH  /api/copilot/conversations/[id] — rename / pin
// DELETE /api/copilot/conversations/[id] — soft-archive (retention-preserving)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCopilotUser, copilotResponseError, CopilotError } from "@/lib/copilot/server";
import { parseJson } from "@/lib/esg/server";
import type { ContentBlock, SourceReference, StoredMessage } from "@/lib/copilot/types";

async function loadOwned(id: string, userId: string) {
  const conv = await db.copilotConversation.findFirst({ where: { id, userId, archived: false } });
  if (!conv) throw new CopilotError("Conversation not found.", 404, "NOT_FOUND");
  return conv;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireCopilotUser();
    const { id } = await params;
    const conv = await loadOwned(id, user.id);
    const [messages, executions] = await Promise.all([
      db.copilotMessage.findMany({ where: { conversationId: conv.id, role: { in: ["user", "assistant"] } }, orderBy: { createdAt: "asc" } }),
      db.copilotToolExecution.findMany({ where: { conversationId: conv.id }, orderBy: { startedAt: "asc" }, take: 200 }),
    ]);
    const parsed: StoredMessage[] = messages.map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
      blocks: parseJson<ContentBlock[]>(m.blocks, []),
      sources: parseJson<SourceReference[]>(m.sources, []),
      createdAt: m.createdAt.toISOString(),
      meta: parseJson<Record<string, unknown>>(m.meta, {}),
    }));
    return NextResponse.json({
      conversation: {
        id: conv.id,
        title: conv.title,
        pinned: conv.pinned,
        lastAt: conv.lastAt.toISOString(),
        messageCount: messages.length,
      },
      messages: parsed,
      executions: executions.map((e) => ({
        id: e.id,
        tool: e.toolName,
        status: e.status,
        summary: e.resultSummary || e.error,
        startedAt: e.startedAt.toISOString(),
        finishedAt: e.finishedAt?.toISOString() ?? null,
        durationMs: e.durationMs ?? null,
        error: e.error || null,
      })),
    });
  } catch (e) {
    return copilotResponseError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireCopilotUser();
    const { id } = await params;
    const conv = await loadOwned(id, user.id);
    const body = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim().slice(0, 80);
    if (typeof body.pinned === "boolean") data.pinned = body.pinned;
    if (!Object.keys(data).length) throw new CopilotError("Nothing to update.", 400, "EMPTY_UPDATE");
    const updated = await db.copilotConversation.update({ where: { id: conv.id }, data });
    return NextResponse.json({ conversation: { id: updated.id, title: updated.title, pinned: updated.pinned, lastAt: updated.lastAt.toISOString() } });
  } catch (e) {
    return copilotResponseError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireCopilotUser();
    const { id } = await params;
    const conv = await loadOwned(id, user.id);
    await db.copilotConversation.update({ where: { id: conv.id }, data: { archived: true } });
    return NextResponse.json({ archived: true });
  } catch (e) {
    return copilotResponseError(e);
  }
}
