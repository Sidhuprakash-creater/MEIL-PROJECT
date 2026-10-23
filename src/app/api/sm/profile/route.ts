import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { smHandle, requireSubsidiaryManager, getSubsidiaryOrThrow, parseJson, SmError } from "@/lib/sm/server";
import type { ManagerPrefs, ProfileData } from "@/lib/sm/types";

export const dynamic = "force-dynamic";

const PREF_DEFAULTS: ManagerPrefs = {
  submissionAlerts: true,
  deadlineReminders: true,
  decisionCopies: true,
  validationAlerts: true,
  weeklyDigest: false,
};

const prefsKey = (userId: string) => `sm-prefs:${userId}`;

/* GET /api/sm/profile — identity, assigned subsidiary, preferences, sessions. */
export async function GET() {
  return smHandle(async () => {
    const ctx = await requireSubsidiaryManager();
    const sub = await getSubsidiaryOrThrow(ctx.subsidiaryId);

    const [user, prefsRow, sessions, recentAuth] = await Promise.all([
      db.user.findUnique({ where: { id: ctx.userId } }),
      db.appSetting.findUnique({ where: { skey: prefsKey(ctx.userId) } }),
      db.session.findMany({
        where: { userId: ctx.userId, revokedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      db.auditLog.findMany({ where: { userId: ctx.userId }, orderBy: { createdAt: "desc" }, take: 6 }),
    ]);
    if (!user) throw new SmError("Account not found.", 404);

    const preferences: ManagerPrefs = { ...PREF_DEFAULTS, ...parseJson<Partial<ManagerPrefs>>(prefsRow?.svalue, {}) };

    const data: ProfileData = {
      user: {
        id: user.id, name: user.name, email: user.email, employeeId: user.employeeId,
        role: user.role, roleLabel: "Subsidiary Manager", title: user.title, phone: user.phone,
        status: user.status, joinedAt: user.joinedAt.toISOString(),
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      },
      subsidiary: {
        id: sub.id, code: sub.code, name: sub.name, sector: sub.sector, region: sub.region,
        city: sub.city, status: sub.status, managerName: sub.managerName, adminName: sub.adminName,
        description: sub.description,
      },
      preferences,
      sessions: sessions.map((s, i) => ({
        id: s.id,
        device: /Mobi|Android/i.test(s.userAgent ?? "") ? "Mobile browser" : /Mac/i.test(s.userAgent ?? "") ? "Mac browser" : "Desktop browser",
        ip: s.ip ?? "—",
        createdAt: s.createdAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
        mostRecent: i === 0,
      })),
      recentAuth: recentAuth.map((a) => ({
        id: a.id, eventType: a.eventType, result: a.result,
        createdAt: a.createdAt.toISOString(), reason: a.reason,
      })),
    };
    return ok(data);
  });
}

/* PATCH /api/sm/profile { preferences } — notification preferences only. */
export async function PATCH(req: NextRequest) {
  return smHandle(async () => {
    const ctx = await requireSubsidiaryManager();
    const b = (await req.json().catch(() => ({}))) as { preferences?: Partial<ManagerPrefs> };
    if (!b.preferences || typeof b.preferences !== "object") {
      throw new SmError("No preference changes supplied.", 400);
    }
    const existing = await db.appSetting.findUnique({ where: { skey: prefsKey(ctx.userId) } });
    const merged: ManagerPrefs = {
      ...PREF_DEFAULTS,
      ...parseJson<Partial<ManagerPrefs>>(existing?.svalue, {}),
      ...b.preferences,
    };
    await db.appSetting.upsert({
      where: { skey: prefsKey(ctx.userId) },
      update: { svalue: JSON.stringify(merged), updatedAt: new Date() },
      create: { skey: prefsKey(ctx.userId), label: "Manager notification preferences", category: "PREFERENCES", vtype: "toggle", svalue: JSON.stringify(merged) },
    });
    return ok({ preferences: merged, message: "Preferences saved." });
  });
}
