// GET  /api/copilot/saved — saved notes, analyses, saved searches
// POST /api/copilot/saved — save an item (note / analysis / response block)
// DELETE /api/copilot/saved?id=... — delete a saved item
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCopilotUser, copilotResponseError, CopilotError, logCopilotAudit } from "@/lib/copilot/server";

const KINDS = new Set(["NOTE", "ANALYSIS", "SAVED_SEARCH", "RESPONSE_BLOCK"]);

export async function GET() {
  try {
    const { user } = await requireCopilotUser();
    const items = await db.copilotSavedItem.findMany({
      where: { userId: user.id },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 100,
    });
    return NextResponse.json({
      items: items.map((i) => ({ id: i.id, kind: i.kind, title: i.title, body: i.body, pinned: i.pinned, conversationId: i.conversationId, createdAt: i.createdAt.toISOString() })),
    });
  } catch (e) {
    return copilotResponseError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireCopilotUser(req.headers);
    const body = await req.json().catch(() => ({}));
    const kind = typeof body.kind === "string" && KINDS.has(body.kind) ? body.kind : "NOTE";
    const title = typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 120) : "";
    if (!title) throw new CopilotError("A title is required to save an item.", 400, "MISSING_TITLE");
    const item = await db.copilotSavedItem.create({
      data: {
        userId: user.id,
        kind,
        title,
        body: typeof body.body === "string" ? body.body.slice(0, 20000) : "",
        payload: typeof body.payload === "object" && body.payload ? JSON.stringify(body.payload) : "{}",
        conversationId: typeof body.conversationId === "string" ? body.conversationId : null,
      },
    });
    await logCopilotAudit({ actorName: user.name, actorRole: user.role, action: "ITEM_SAVED", targetType: "CopilotSavedItem", targetId: item.id, targetLabel: title });
    return NextResponse.json({ item: { id: item.id, kind: item.kind, title: item.title, createdAt: item.createdAt.toISOString() } }, { status: 201 });
  } catch (e) {
    return copilotResponseError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { user } = await requireCopilotUser(req.headers);
    const id = req.nextUrl.searchParams.get("id");
    if (!id) throw new CopilotError("id is required.", 400, "MISSING_ID");
    const item = await db.copilotSavedItem.findUnique({ where: { id } });
    if (!item || item.userId !== user.id) throw new CopilotError("Saved item not found.", 404, "NOT_FOUND");
    await db.copilotSavedItem.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (e) {
    return copilotResponseError(e);
  }
}
