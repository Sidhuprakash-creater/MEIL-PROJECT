import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionPayload } from "@/lib/session";
import { canAdminReviewResetRequest } from "@/lib/auth/password-reset";
import { roleLabel } from "@/lib/platform-config";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = new Set([
  "GROUP_ADMIN",
  "SUBSIDIARY_ADMIN",
  "BU_ADMIN",
  "PROJECT_ADMIN",
]);

/** GET /api/auth/reset-requests — Returns scoped password reset requests for governing admins. */
export async function GET(request: Request) {
  const session = await getSessionPayload();
  if (!session?.authenticated || !session.user) {
    return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
  }

  if (!ADMIN_ROLES.has(session.user.role)) {
    return NextResponse.json({ ok: false, error: "Admin role required." }, { status: 403 });
  }

  const statusFilter = new URL(request.url).searchParams.get("status");

  const actor = {
    id: session.user.id,
    role: session.user.role,
    subsidiaryId: session.user.scope.subsidiary?.id ?? null,
    businessUnitId: session.user.scope.businessUnit?.id ?? null,
    projectId: session.user.scope.project?.id ?? null,
  };

  const rows = await db.passwordResetRequest.findMany({
    where: statusFilter ? { status: statusFilter } : undefined,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          employeeId: true,
          role: true,
          status: true,
          subsidiaryId: true,
          businessUnitId: true,
          projectId: true,
          subsidiary: { select: { name: true, code: true } },
          businessUnit: { select: { name: true, code: true } },
          project: { select: { name: true, code: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const visible = rows
    .filter((r) => canAdminReviewResetRequest(actor, r.user))
    .map((r) => ({
      id: r.id,
      userId: r.userId,
      userName: r.user.name,
      userEmail: r.user.email,
      employeeId: r.user.employeeId,
      userRole: r.user.role,
      userRoleLabel: roleLabel(r.user.role),
      userStatus: r.user.status,
      orgLabel:
        r.user.project?.name ||
        r.user.businessUnit?.name ||
        r.user.subsidiary?.name ||
        "MEIL Group",
      requestedIdentifier: r.requestedIdentifier,
      portal: r.portal,
      reason: r.reason,
      status: r.status,
      rejectionReason: r.rejectionReason,
      ip: r.ip,
      createdAt: r.createdAt.toISOString(),
      reviewedAt: r.reviewedAt?.toISOString() ?? null,
      completedAt: r.completedAt?.toISOString() ?? null,
    }));

  const pendingCount = visible.filter(
    (r) => r.status === "PENDING_ADMIN" || r.status === "EMAIL_TOKEN_SENT"
  ).length;

  return NextResponse.json({
    ok: true,
    requests: visible,
    pendingCount,
  });
}

