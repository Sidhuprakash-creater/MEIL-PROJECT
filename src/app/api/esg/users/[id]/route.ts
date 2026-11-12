import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { fail, handle, ok, requireGroupAdmin } from "@/lib/esg/server";
import { ROLE_LABELS } from "@/lib/esg/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** GET /api/esg/users/[id] — Complete User Info dossier (profile, active sessions, auth audit logs, submissions). */
export async function GET(_req: NextRequest, { params }: Params) {
  return handle(async () => {
    await requireGroupAdmin({ readOnly: true });
    const { id } = await params;

    const user = await db.user.findUnique({
      where: { id },
      include: {
        subsidiary: { select: { id: true, name: true, code: true } },
        businessUnit: { select: { id: true, name: true, code: true } },
        project: { select: { id: true, name: true, code: true } },
      },
    });
    if (!user) return fail("User not found.", 404);

    const [sessions, lastLogins, submissions, resetRequests] = await Promise.all([
      db.session.findMany({
        where: { userId: id, revokedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      db.auditLog.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
      db.submission.findMany({
        where: { submittedById: id },
        orderBy: { updatedAt: "desc" },
        take: 8,
        select: {
          id: true,
          ref: true,
          title: true,
          category: true,
          status: true,
          period: true,
          updatedAt: true,
        },
      }),
      db.passwordResetRequest.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    return ok({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        googleEmail: user.googleEmail,
        authProvider: user.authProvider,
        mustChangePassword: user.mustChangePassword,
        employeeId: user.employeeId,
        role: user.role,
        roleLabel: ROLE_LABELS[user.role] ?? user.role,
        status: user.status,
        phone: user.phone,
        title: user.title,
        subsidiaryName: user.subsidiary?.name ?? null,
        businessUnitName: user.businessUnit?.name ?? null,
        projectName: user.project?.name ?? null,
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
      submissions: submissions.map((s) => ({
        ...s,
        updatedAt: s.updatedAt.toISOString(),
      })),
      resetRequests: resetRequests.map((r) => ({
        id: r.id,
        status: r.status,
        portal: r.portal,
        createdAt: r.createdAt.toISOString(),
        reviewedAt: r.reviewedAt?.toISOString() ?? null,
      })),
    });
  });
}

