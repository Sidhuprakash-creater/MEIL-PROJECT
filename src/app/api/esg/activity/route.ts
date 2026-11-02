import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handle, ok } from "@/lib/esg/server";
import type { ActivityEvent } from "@/lib/esg/types";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "200", 10);
    const rows = await db.activityEvent.findMany({ orderBy: { createdAt: "desc" }, take: limit });
    const events: ActivityEvent[] = rows.map((a) => ({
      id: a.id,
      actorName: a.actorName,
      actorRole: a.actorRole,
      action: a.action,
      targetType: a.targetType,
      targetLabel: a.targetLabel,
      orgLabel: a.orgLabel,
      severity: a.severity,
      createdAt: a.createdAt.toISOString(),
    }));
    return ok({ events });
  });
}
