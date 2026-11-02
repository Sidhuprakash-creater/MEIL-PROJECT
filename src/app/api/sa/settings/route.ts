import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import {
  saHandle, requireSubsidiaryAdmin, getSubsidiaryOrThrow,
  saLogActivity, saLogAudit, parseJson,
} from "@/lib/sa/server";
import type { SubsidiaryInfo } from "@/lib/sa/types";

export const dynamic = "force-dynamic";

/* Workspace settings: profile (read-only name/sector per policy), contact +
   notification preferences (AppSetting-backed), group-mandated reporting
   config, integration status and the current user's security footprint. */

const REPORTING_CONFIG = {
  mandatedPeriods: ["FY 2024-25", "FY 2025-26"],
  disclosureCatalogue: "SEBI BRSR Core v1.0 (Group-mandated)",
  inheritanceRule: "Subsidiary → BU → Project (overrides recorded)",
  timelineLocked: false,
};

interface ContactShape { email: string; phone: string; reportingContact: string }
interface PrefsShape { deadlineReminders: boolean; submissionAlerts: boolean; weeklyDigest: boolean; emailEscalation: boolean }

const contactKey = (subsidiaryId: string) => `sa:${subsidiaryId}:contact`;
const prefsKey = (subsidiaryId: string) => `sa:${subsidiaryId}:prefs`;

const PREF_DEFAULTS: PrefsShape = {
  deadlineReminders: true,
  submissionAlerts: true,
  weeklyDigest: false,
  emailEscalation: false,
};

/** Defaults when no AppSetting row exists yet: the admin's own coordinates. */
function contactDefaults(
  sub: { adminName: string },
  me: { email: string; phone: string; name: string } | null
): ContactShape {
  return { email: me?.email ?? "", phone: me?.phone ?? "", reportingContact: sub.adminName || me?.name || "" };
}

async function buildPayload(subsidiaryId: string, userId: string) {
  const sub = await getSubsidiaryOrThrow(subsidiaryId);
  const [contactRow, prefsRow, me, lastSub, sessions, recentAuth] = await Promise.all([
    db.appSetting.findUnique({ where: { skey: contactKey(subsidiaryId) } }),
    db.appSetting.findUnique({ where: { skey: prefsKey(subsidiaryId) } }),
    db.user.findUnique({ where: { id: userId } }),
    db.submission.findFirst({ where: { subsidiaryId }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
    db.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    }),
    db.auditLog.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  const contact: ContactShape = {
    ...contactDefaults(sub, me),
    ...parseJson<Partial<ContactShape>>(contactRow?.svalue, {}),
  };
  const preferences: PrefsShape = { ...PREF_DEFAULTS, ...parseJson<Partial<PrefsShape>>(prefsRow?.svalue, {}) };

  const profile: SubsidiaryInfo = {
    id: sub.id, code: sub.code, name: sub.name, sector: sub.sector, region: sub.region,
    city: sub.city, status: sub.status, managerName: sub.managerName, adminName: sub.adminName,
    description: sub.description,
  };

  return {
    profile,
    contact,
    preferences,
    reportingConfig: REPORTING_CONFIG,
    integrations: {
      syncStatus: "OPERATIONAL",
      lastSyncAt: lastSub?.updatedAt.toISOString() ?? null,
      failedJobs: 0,
    },
    security: {
      sessions: sessions.map((s) => ({
        id: s.id,
        userAgent: s.userAgent ?? "",
        ip: s.ip ?? "",
        createdAt: s.createdAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
      })),
      recentAuth: recentAuth.map((a) => ({
        id: a.id,
        eventType: a.eventType,
        result: a.result,
        portal: a.portal ?? "",
        reason: a.reason ?? "",
        detail: a.detail ?? "",
        createdAt: a.createdAt.toISOString(),
      })),
    },
  };
}

export async function GET() {
  return saHandle(async () => {
    const ctx = await requireSubsidiaryAdmin();
    return ok(await buildPayload(ctx.subsidiaryId, ctx.userId));
  });
}

export async function PATCH(req: NextRequest) {
  return saHandle(async () => {
    const ctx = await requireSubsidiaryAdmin();
    const sub = await getSubsidiaryOrThrow(ctx.subsidiaryId);
    const body = (await req.json().catch(() => ({}))) as {
      contact?: Partial<ContactShape>;
      preferences?: Partial<PrefsShape>;
    };

    const changes: Record<string, unknown> = {};

    if (body.contact) {
      const [existing, me] = await Promise.all([
        db.appSetting.findUnique({ where: { skey: contactKey(ctx.subsidiaryId) } }),
        db.user.findUnique({ where: { id: ctx.userId } }),
      ]);
      const merged: ContactShape = {
        ...contactDefaults(sub, me),
        ...parseJson<Partial<ContactShape>>(existing?.svalue, {}),
      };
      for (const field of ["email", "phone", "reportingContact"] as const) {
        const v = body.contact[field];
        if (typeof v === "string") merged[field] = v.trim().slice(0, 160);
      }
      await db.appSetting.upsert({
        where: { skey: contactKey(ctx.subsidiaryId) },
        update: { svalue: JSON.stringify(merged) },
        create: { skey: contactKey(ctx.subsidiaryId), label: "Subsidiary contact", category: "CONTACT", vtype: "text", svalue: JSON.stringify(merged) },
      });
      changes.contact = merged;
    }

    if (body.preferences) {
      const existing = await db.appSetting.findUnique({ where: { skey: prefsKey(ctx.subsidiaryId) } });
      const merged: PrefsShape = { ...PREF_DEFAULTS, ...parseJson<Partial<PrefsShape>>(existing?.svalue, {}) };
      for (const field of Object.keys(PREF_DEFAULTS) as (keyof PrefsShape)[]) {
        const v = body.preferences[field];
        if (typeof v === "boolean") merged[field] = v;
      }
      await db.appSetting.upsert({
        where: { skey: prefsKey(ctx.subsidiaryId) },
        update: { svalue: JSON.stringify(merged) },
        create: { skey: prefsKey(ctx.subsidiaryId), label: "Notification preferences", category: "PREFERENCES", vtype: "toggle", svalue: JSON.stringify(merged) },
      });
      changes.preferences = merged;
    }

    if (Object.keys(changes).length > 0) {
      await saLogActivity(ctx, sub.name, { action: "CONFIG_CHANGE", targetType: "WorkspaceSettings", targetLabel: `${sub.code} settings` });
      await saLogAudit(ctx, sub.code, {
        action: "CONFIG_CHANGE",
        targetType: "WorkspaceSettings",
        targetId: sub.id,
        targetLabel: `${sub.code} settings`,
        after: changes,
      });
    }

    /* Subsidiary name/sector are Group-owned and silently ignored here —
       the profile is returned unchanged. */
    return ok(await buildPayload(ctx.subsidiaryId, ctx.userId));
  });
}
