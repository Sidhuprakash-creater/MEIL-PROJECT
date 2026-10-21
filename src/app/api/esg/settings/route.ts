import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handle, ok, fail, body, parseJson, logAudit, ACTOR } from "@/lib/esg/server";
import type { AppSetting } from "@/lib/esg/types";

export async function GET() {
  return handle(async () => {
    const rows = await db.appSetting.findMany({ orderBy: [{ category: "asc" }, { label: "asc" }] });
    const settings: (AppSetting & { parsed: unknown })[] = rows.map((s) => ({
      ...s,
      updatedAt: s.updatedAt.toISOString(),
      parsed: parseJson(s.svalue, {}),
    }));
    const integrations = {
      emailProvider: "Not configured — in-app notifications only",
      objectStorage: "Local evidence metadata (demo)",
      scheduler: "In-process reminders via manual dispatch + status recompute",
      database: "SQLite (Prisma) — single-writer demo configuration",
    };
    return ok({ settings, integrations });
  });
}

export async function PATCH(req: NextRequest) {
  return handle(async () => {
    const b = await body<{ skey?: string; value?: unknown }>(req);
    if (!b.skey) return fail("Setting key is required.");
    const before = await db.appSetting.findUnique({ where: { skey: b.skey } });
    if (!before) return fail("Setting not found.", 404);
    const updated = await db.appSetting.update({
      where: { skey: b.skey },
      data: { svalue: JSON.stringify({ value: b.value }) },
    });
    await logAudit({
      actorName: ACTOR.name,
      action: "SETTINGS_UPDATE",
      targetType: "AppSetting",
      targetLabel: before.label,
      before: parseJson(before.svalue, {}),
      after: { value: b.value },
    });
    return ok({ setting: { ...updated, updatedAt: updated.updatedAt.toISOString() }, message: "Setting saved and recorded in the audit trail." });
  });
}
