import { NextRequest } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  getProjectAdminContext,
  paOk,
  paFail,
  logProjectActivity,
  getPaServerCache,
  setPaServerCache,
  invalidatePaServerCache,
} from "@/lib/project-admin/server";

export const dynamic = "force-dynamic";

/* Per-user workspace preferences — file-backed store (same pattern as the
   level-records store). Previously preferences were hardcoded in GET and the
   view's save calls hit a missing POST handler (405 on every save). */
const PREFS_PATH = path.join(process.cwd(), "prisma", "pa-preferences-store.json");

type PrefMap = Record<string, Record<string, unknown>>;

function readPrefs(): PrefMap {
  try {
    const raw = fs.readFileSync(PREFS_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writePrefs(map: PrefMap): void {
  const dir = path.dirname(PREFS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PREFS_PATH, JSON.stringify(map, null, 2), "utf-8");
}

const DEFAULT_PREFS: Record<string, unknown> = {
  tableDensity: "comfortable",
  enableAtmosphericLighting: true,
  requireEvidenceForMetrics: true,
  notifyOnContributorSubmit: true,
  notifyOnBuFeedback: true,
  notifyOnTaskDeadline: true,
  defaultFinancialYear: "FY 2026-27",
};

export async function GET(req: NextRequest) {
  try {
    const ctx = await getProjectAdminContext();
    if (!ctx) return paFail("Project Admin context not resolved.", 401);

    const cacheKey = `settings:${ctx.userId}`;
    const cached = getPaServerCache<any>(cacheKey);
    if (cached) {
      return paOk(cached);
    }

    const user = await db.user.findUnique({
      where: { id: ctx.userId },
      select: {
        id: true,
        email: true,
        employeeId: true,
        phone: true,
        title: true,
        joinedAt: true,
      },
    });

    const payload = {
      profile: {
        id: ctx.userId,
        name: ctx.userName,
        email: user?.email || "admin@site.meil.in",
        employeeId: user?.employeeId || "PRJ-ADMIN",
        role: "Project Admin",
        projectCode: ctx.projectCode,
        projectName: ctx.projectName,
        businessUnitName: ctx.businessUnitName,
        subsidiaryName: ctx.subsidiaryName,
        phone: user?.phone || "+91 98490 12345",
        title: user?.title || "Site ESG Administrator",
        joinedAt: user?.joinedAt ? new Date(user.joinedAt).toISOString() : "2024-04-01T00:00:00.000Z",
      },
      preferences: {
        ...DEFAULT_PREFS,
        ...readPrefs()[ctx.userId],
      },
    };

    setPaServerCache(cacheKey, payload, 45000);
    return paOk(payload);
  } catch (err: any) {
    return paFail(err.message, 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const ctx = await getProjectAdminContext();
    if (!ctx) return paFail("Project Admin context not resolved.", 401);

    const body = await req.json();
    const { name, phone, title } = body;

    invalidatePaServerCache();

    const updated = await db.user.update({
      where: { id: ctx.userId },
      data: {
        ...(name && { name: name.trim() }),
        ...(phone && { phone: phone.trim() }),
        ...(title && { title: title.trim() }),
      },
    });

    await logProjectActivity({
      actorName: ctx.userName,
      actorRole: "Project Admin",
      action: "PROFILE_UPDATE",
      targetType: "User",
      targetLabel: updated.name,
      category: "Profile & Settings",
      severity: "SUCCESS",
    });

    return paOk({ user: updated }, "Profile updated successfully.");
  } catch (err: any) {
    return paFail(err.message, 500);
  }
}

/* POST — the settings view saves preferences and changes the password via
   paApiPost; previously no POST handler existed (405 on every save). */
export async function POST(req: NextRequest) {
  try {
    const ctx = await getProjectAdminContext();
    if (!ctx) return paFail("Project Admin context not resolved.", 401);

    const body = await req.json();
    const action = String(body?.action || "");

    if (action === "update_preferences") {
      const prefs = (body?.preferences && typeof body.preferences === "object")
        ? body.preferences
        : {};
      const all = readPrefs();
      all[ctx.userId] = { ...all[ctx.userId], ...prefs, updatedAt: new Date().toISOString() };
      writePrefs(all);
      invalidatePaServerCache();

      if (body?.name && typeof body.name === "string" && body.name.trim()) {
        await db.user.update({
          where: { id: ctx.userId },
          data: { name: body.name.trim() },
        });
      }

      await logProjectActivity({
        actorName: ctx.userName,
        actorRole: "Project Admin",
        action: "PREFERENCES_UPDATE",
        targetType: "Settings",
        targetLabel: "Workspace preferences",
        category: "Profile & Settings",
        severity: "SUCCESS",
      });

      return paOk({ preferences: all[ctx.userId] }, "Preferences saved successfully.");
    }

    if (action === "change_password") {
      const { currentPassword, newPassword } = body;
      if (!newPassword || String(newPassword).length < 6) {
        return paFail("New password must be at least 6 characters.", 400);
      }
      const user = await db.user.findUnique({
        where: { id: ctx.userId },
        select: { passwordHash: true },
      });
      if (!user?.passwordHash) {
        return paFail("No portal credential is issued for this account — password changes are managed by the platform administrator.", 400);
      }
      const ok = await verifyPassword(String(currentPassword || ""), user.passwordHash);
      if (!ok) {
        return paFail("Current password is incorrect.", 400);
      }
      await db.user.update({
        where: { id: ctx.userId },
        data: { passwordHash: await hashPassword(String(newPassword)) },
      });
      await logProjectActivity({
        actorName: ctx.userName,
        actorRole: "Project Admin",
        action: "PASSWORD_CHANGE",
        targetType: "User",
        targetLabel: ctx.userName,
        category: "Profile & Settings",
        severity: "SUCCESS",
      });
      return paOk({}, "Password changed successfully.");
    }

    return paFail("Unknown action requested.", 400);
  } catch (err: any) {
    return paFail(err.message, 500);
  }
}
