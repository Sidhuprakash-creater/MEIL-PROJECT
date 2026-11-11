// POST /api/copilot/confirm — resolve a prepared action confirmation.
// Body: { confirmationId, decision: "confirm" | "cancel" }
// Single-use, ownership-checked, expiry-checked (Phase 17).
import { NextRequest, NextResponse } from "next/server";
import { requireCopilotUser, copilotResponseError, logCopilotAudit } from "@/lib/copilot/server";
import { executeConfirmedAction, cancelConfirmation } from "@/lib/copilot/actions";

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireCopilotUser(req.headers);
    const body = await req.json().catch(() => ({}));
    const confirmationId = typeof body.confirmationId === "string" ? body.confirmationId : "";
    const decision = body.decision === "confirm" ? "confirm" : body.decision === "cancel" ? "cancel" : null;
    if (!confirmationId || !decision) {
      return NextResponse.json({ error: "confirmationId and decision (confirm|cancel) are required." }, { status: 400 });
    }
    if (decision === "cancel") {
      await cancelConfirmation(confirmationId, { userId: user.id, userName: user.name, userRole: user.role });
      await logCopilotAudit({
        actorName: user.name, actorRole: user.role, action: "ACTION_CANCELLED",
        targetType: "CopilotConfirmation", targetId: confirmationId,
      });
      return NextResponse.json({ status: "CANCELLED" });
    }
    const result = await executeConfirmedAction(confirmationId, { userId: user.id, userName: user.name, userRole: user.role });
    await logCopilotAudit({
      actorName: user.name, actorRole: user.role, action: "ACTION_CONFIRMED_EXECUTED",
      targetType: "CopilotConfirmation", targetId: confirmationId,
      after: { resultSummary: result.resultSummary },
    });
    return NextResponse.json({ status: "EXECUTED", resultSummary: result.resultSummary });
  } catch (e) {
    return copilotResponseError(e);
  }
}
