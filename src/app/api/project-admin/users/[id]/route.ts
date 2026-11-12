import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getProjectAdminContext, paFail, paOk } from "@/lib/project-admin/server";
import { ROLES } from "@/lib/platform-config";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** GET /api/project-admin/users/[id] — User Info dossier for a project contributor (sessions, login history, submissions). */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const ctx = await getProjectAdminContext();
    if (!ctx) return paFail("Project Admin context not resolved.", 401);

    const { id } = await params;
    const user = await db.user.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true, code: true } },
        businessUnit: { select: { id: true, name: true, code: true } },
        subsidiary: { select: { id: true, name: true, code: true } },
      },
    });
    if (!user) return paFail("User not found.", 404);

    if (
      user.projectId !== ctx.projectId &&
      user.businessUnitId !== ctx.businessUnitId &&
      user.subsidiaryId !== ctx.subsidiaryId
    ) {
      return paFail("This user is outside your project scope.", 403);
    }

    const [sessions, lastLogins, submissions] = await Promise.all([
      db.session.findMany({
        where: { userId: id, revokedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      db.auditLog.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      db.submission.findMany({
        where: { submittedById: id, projectId: ctx.projectId },
        orderBy: { updatedAt: "desc" },
        take: 10,
        select: { id: true, ref: true, title: true, category: true, status: true, updatedAt: true },
      }),
    ]);

    return paOk({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        googleEmail: user.googleEmail,
        authProvider: user.authProvider,
        mustChangePassword: user.mustChangePassword,
        employeeId: user.employeeId,
        role: user.role,
        roleLabel: (ROLES as Record<string, string>)[user.role] ?? user.role,
        status: user.status,
        phone: user.phone,
        title: user.title,
        projectName: user.project?.name ?? null,
        businessUnitName: user.businessUnit?.name ?? null,
        subsidiaryName: user.subsidiary?.name ?? null,
        joinedAt: user.joinedAt.toISOString(),
        lastActiveAt: user.lastActiveAt?.toISOString() ?? null,
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      },
      sessions: sessions.map((s) => ({
        id: s.id,
        userAgent: s.userAgent ?? "",
        ip: s.ip ?? "",
        createdAt: s.createdAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
      })),
      lastLogins: lastLogins.map((l) => ({
        eventType: l.eventType,
        result: l.result,
        portal: l.portal,
        reason: l.reason,
        createdAt: l.createdAt.toISOString(),
        ip: l.ip ?? "",
      })),
      submissions: submissions.map((s) => ({ ...s, updatedAt: s.updatedAt.toISOString() })),
    });
  } catch (err: any) {
    return paFail(err?.message || "Failed to load user details.", 500);
  }
}

