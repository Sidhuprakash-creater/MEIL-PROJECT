import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handle, ok } from "@/lib/esg/server";
import type { AuditEvent } from "@/lib/esg/types";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "200", 10);
    const [rows, records] = await Promise.all([
      db.auditEvent.findMany({ orderBy: { createdAt: "desc" }, take: limit }),
      db.auditEvent.count(),
    ]);
    const events: AuditEvent[] = rows.map((a) => ({
      id: a.id,
      actorName: a.actorName,
      actorRole: a.actorRole,
      action: a.action,
      targetType: a.targetType,
      targetId: a.targetId,
      targetLabel: a.targetLabel,
      orgScope: a.orgScope,
      before: a.before,
      after: a.after,
      reason: a.reason,
      outcome: a.outcome,
      correlation: a.correlation,
      createdAt: a.createdAt.toISOString(),
    }));
    const integrity = {
      appendOnly: true,
      note: "Audit records are append-only. Updates and deletes are rejected at the application layer.",
      records,
    };
    return ok({ events, integrity });
  });
}
