import { NextRequest } from "next/server";
import { db } from "@/lib/db";
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
        emailDigest: true,
        submissionAlerts: true,
        deadlineReminders: true,
        tableDensity: "comfortable",
        reducedMotion: false,
        theme: "light",
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
