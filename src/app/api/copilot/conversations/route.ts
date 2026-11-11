// GET  /api/copilot/conversations — list conversations (pinned first)
// POST /api/copilot/conversations — create a conversation
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCopilotUser, copilotResponseError } from "@/lib/copilot/server";

export async function GET() {
  try {
    const { user } = await requireCopilotUser();
    const conversations = await db.copilotConversation.findMany({
      where: { userId: user.id, archived: false },
      orderBy: [{ pinned: "desc" }, { lastAt: "desc" }],
      take: 50,
      include: { _count: { select: { messages: true } } },
    });
    return NextResponse.json({
      conversations: conversations.map((c) => ({
        id: c.id,
        title: c.title,
        pinned: c.pinned,
        lastAt: c.lastAt.toISOString(),
        messageCount: c._count.messages,
      })),
    });
  } catch (e) {
    return copilotResponseError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireCopilotUser();
    let payload: Record<string, unknown> = {};
    try {
      payload = await req.json();
    } catch {
      /* empty body is fine */
    }
    const context = typeof payload.context === "object" && payload.context ? JSON.stringify(payload.context) : JSON.stringify({ reportingYear: payload.reportingYear ?? "FY 2025-26" });
    const conv = await db.copilotConversation.create({
      data: {
        userId: user.id,
        title: typeof payload.title === "string" && payload.title.trim() ? payload.title.trim().slice(0, 80) : "New conversation",
        context,
        model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
      },
    });
    return NextResponse.json({ conversation: { id: conv.id, title: conv.title, pinned: conv.pinned, lastAt: conv.lastAt.toISOString(), messageCount: 0 } }, { status: 201 });
  } catch (e) {
    return copilotResponseError(e);
  }
}
