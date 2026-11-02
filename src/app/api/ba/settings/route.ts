import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import {
  baHandle, requireBuAdmin, getBuOrThrow,
  baLogActivity, baLogAudit, parseJson,
} from "@/lib/ba/server";
import type { BaSettingsData, BaPrefs } from "@/lib/ba/types";

export const dynamic = "force-dynamic";

const PREF_DEFAULTS: BaPrefs = {
  submissionAlerts: true,
  deadlineReminders: true,
  weeklyDigest: false,
  validationAlerts: true,
  reviewStatusUpdates: true,
};

const prefsKey = (userId: string) => `ba-prefs:${userId}`;
const workspacePrefsKey = (userId: string) => `ba-wp:${userId}`;

async function buildPayload(businessUnitId: string, subsidiaryId: string, userId: string): Promise<BaSettingsData> {
  const bu = await getBuOrThrow(businessUnitId);
  const [prefsRow, wpRow, me, lastSub, sessions, recentAuth] = await Promise.all([
    db.appSetting.findUnique({ where: { skey: prefsKey(userId) } }),
    db.appSetting.findUnique({ where: { skey: workspacePrefsKey(userId) } }),
    db.user.findUnique({ where: { id: userId } }),
    db.submission.findFirst({ where: { businessUnitId }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
    db.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    }),
    db.auditLog.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  const preferences: BaPrefs = { ...PREF_DEFAULTS, ...parseJson<Partial<BaPrefs>>(prefsRow?.svalue, {}) };
  const workspacePrefs = parseJson<{ tableDensity?: "compact" | "comfortable"; defaultPeriod?: string }>(wpRow?.svalue, { tableDensity: "comfortable", defaultPeriod: "FY 2025-26" });
  void subsidiaryId;

  return {
    user: {
      id: me!.id, name: me!.name, email: me!.email, employeeId: me!.employeeId,
      role: me!.role, roleLabel: "BU Admin", title: me!.title, phone: me!.phone,
      status: me!.status,
      joinedAt: me!.joinedAt.toISOString(),
      lastLoginAt: me!.lastLoginAt?.toISOString() ?? null,
    },
    businessUnit: {
      id: bu.id, code: bu.code, name: bu.name,
      subsidiaryId: bu.subsidiaryId,
      subsidiaryName: bu.subsidiary.name,
      subsidiaryCode: bu.subsidiary.code,
      sector: bu.subsidiary.sector,
      managerName: bu.managerName || "—",
      adminName: bu.adminName || "—",
      description: bu.description,
      status: bu.status,
    },
    preferences,
    workspacePrefs: {
      tableDensity: workspacePrefs.tableDensity === "compact" ? "compact" : "comfortable",
      defaultPeriod: workspacePrefs.defaultPeriod ?? "FY 2025-26",
    },
    sessions: sessions.map((s, i) => ({
      id: s.id, device: s.userAgent ?? "",
      ip: s.ip ?? "",
      createdAt: s.createdAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
      mostRecent: i === 0,
    })),
    recentAuth: recentAuth.map((a) => ({
      id: a.id, eventType: a.eventType, result: a.result, createdAt: a.createdAt.toISOString(),
      reason: a.reason,
    })),
  };
  void lastSub;
}

export async function GET() {
  return baHandle(async () => {
    const ctx = await requireBuAdmin();
    return ok(await buildPayload(ctx.businessUnitId, ctx.subsidiaryId, ctx.userId));
  });
}

export async function PATCH(req: NextRequest) {
  return baHandle(async () => {
    const ctx = await requireBuAdmin();
    const bu = await getBuOrThrow(ctx.businessUnitId);
    const body = (await req.json().catch(() => ({}))) as {
      preferences?: Partial<BaPrefs>;
      workspacePrefs?: { tableDensity?: "compact" | "comfortable"; defaultPeriod?: string };
    };

    const changes: Record<string, unknown> = {};

    if (body.preferences) {
      const existing = await db.appSetting.findUnique({ where: { skey: prefsKey(ctx.userId) } });
      const merged: BaPrefs = { ...PREF_DEFAULTS, ...parseJson<Partial<BaPrefs>>(existing?.svalue, {}) };
      for (const k of Object.keys(PREF_DEFAULTS) as (keyof BaPrefs)[]) {
        const v = body.preferences[k];
        if (typeof v === "boolean") merged[k] = v;
      }
      await db.appSetting.upsert({
        where: { skey: prefsKey(ctx.userId) },
        update: { svalue: JSON.stringify(merged) },
        create: { skey: prefsKey(ctx.userId), label: "BU Admin notification preferences", category: "PREFERENCES", vtype: "toggle", svalue: JSON.stringify(merged) },
      });
      changes.preferences = merged;
    }

    if (body.workspacePrefs) {
      const existing = await db.appSetting.findUnique({ where: { skey: workspacePrefsKey(ctx.userId) } });
      const merged = {
        tableDensity: body.workspacePrefs.tableDensity ?? "comfortable" as "compact" | "comfortable",
        defaultPeriod: body.workspacePrefs.defaultPeriod ?? "FY 2025-26",
        ...parseJson<{ tableDensity?: "compact" | "comfortable"; defaultPeriod?: string }>(existing?.svalue, {}),
      };
      if (body.workspacePrefs.tableDensity) merged.tableDensity = body.workspacePrefs.tableDensity;
      if (body.workspacePrefs.defaultPeriod) merged.defaultPeriod = body.workspacePrefs.defaultPeriod;
      await db.appSetting.upsert({
        where: { skey: workspacePrefsKey(ctx.userId) },
        update: { svalue: JSON.stringify(merged) },
        create: { skey: workspacePrefsKey(ctx.userId), label: "BU Admin workspace prefs", category: "PREFERENCES", vtype: "toggle", svalue: JSON.stringify(merged) },
      });
      changes.workspacePrefs = merged;
    }

    if (Object.keys(changes).length > 0) {
      await baLogActivity(ctx, bu.name, { action: "CONFIG_CHANGE", targetType: "WorkspaceSettings", targetLabel: `${bu.code} settings` });
      await baLogAudit(ctx, bu.code, {
        action: "CONFIG_CHANGE",
        targetType: "WorkspaceSettings",
        targetId: bu.id,
        targetLabel: `${bu.code} settings`,
        after: changes,
      });
    }

    return ok(await buildPayload(ctx.businessUnitId, ctx.subsidiaryId, ctx.userId));
  });
}
