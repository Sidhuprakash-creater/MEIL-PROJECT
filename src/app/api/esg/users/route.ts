import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handle, ok, fail, body, logActivity, logAudit, requireGroupAdmin } from "@/lib/esg/server";
import { ROLE_LABELS, DATA_ENTRY_ROLES } from "@/lib/esg/types";
import type { User } from "@/lib/esg/types";
import { ProvisionError, provisionUser } from "@/lib/auth/provision-user";
import { invalidateAllAuthCaches, revokeUserSessions } from "@/lib/auth/session-utils";
import { generateTempPassword, hashPassword } from "@/lib/password";
import { createResetTokenPair } from "@/lib/auth/password-reset";
import { getAppOrigin, sendPasswordResetLinkEmail } from "@/lib/notify/email";

const VALID_ROLES = Object.keys(ROLE_LABELS);
const VALID_STATUSES = ["ACTIVE", "SUSPENDED", "INACTIVE", "INVITED"];

async function decorateUsers(): Promise<User[]> {
  const [users, subs, units, projects, submissions] = await Promise.all([
    db.user.findMany({ orderBy: { name: "asc" } }),
    db.subsidiary.findMany({ select: { id: true, name: true } }),
    db.businessUnit.findMany({ select: { id: true, name: true } }),
    db.project.findMany({ select: { id: true, name: true } }),
    db.submission.findMany({ select: { submittedById: true, status: true, overdue: true } }),
  ]);
  const subMap = new Map(subs.map((s) => [s.id, s.name]));
  const unitMap = new Map(units.map((u) => [u.id, u.name]));
  const projMap = new Map(projects.map((p) => [p.id, p.name]));
  return users.map((u) => {
    const mine = submissions.filter((s) => s.submittedById === u.id);
    return {
      ...u,
      joinedAt: u.joinedAt.toISOString(),
      lastActiveAt: u.lastActiveAt ? u.lastActiveAt.toISOString() : null,
      lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
      subsidiaryName: u.subsidiaryId ? subMap.get(u.subsidiaryId) : null,
      businessUnitName: u.businessUnitId ? unitMap.get(u.businessUnitId) : null,
      projectName: u.projectId ? projMap.get(u.projectId) : null,
      openTasks: u.status === "ACTIVE" ? Math.max(0, mine.filter((s) => !["APPROVED"].includes(s.status)).length) : 0,
      submissionStats: {
        total: mine.length,
        approved: mine.filter((s) => s.status === "APPROVED").length,
        pending: mine.filter((s) => ["SUBMITTED", "UNDER_REVIEW"].includes(s.status)).length,
        overdue: mine.filter((s) => s.overdue).length,
      },
    };
  });
}

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireGroupAdmin({ readOnly: true });
    const q = req.nextUrl.searchParams.get("q")?.toLowerCase() ?? "";
    let users = await decorateUsers();
    if (q) {
      users = users.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.employeeId ?? "").toLowerCase().includes(q) ||
          (u.googleEmail ?? "").toLowerCase().includes(q) ||
          (ROLE_LABELS[u.role] ?? u.role).toLowerCase().includes(q) ||
          (u.subsidiaryName ?? "").toLowerCase().includes(q)
      );
    }
    return ok({ users });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const actor = await requireGroupAdmin();
    const b = await body<{
      name?: string;
      email?: string;
      googleEmail?: string;
      employeeId?: string;
      role?: string;
      subsidiaryId?: string;
      businessUnitId?: string;
      projectId?: string;
      title?: string;
      phone?: string;
      issueTempPassword?: boolean;
      customPassword?: string;
    }>(req);

    try {
      const origin = new URL(req.url).origin;
      const provisioned = await provisionUser({
        name: b.name ?? "",
        email: b.email ?? "",
        googleEmail: b.googleEmail,
        employeeId: b.employeeId,
        role: b.role ?? "",
        subsidiaryId: b.subsidiaryId || null,
        businessUnitId: b.businessUnitId || null,
        projectId: b.projectId || null,
        title: b.title,
        phone: b.phone,
        issueTempPassword: b.issueTempPassword,
        customPassword: b.customPassword,
        actor: { id: actor.id, name: actor.name, role: actor.role },
        allowedRoles: VALID_ROLES,
        origin,
      });

      const u = provisioned.user;
      await db.notification.create({
        data: {
          ntype: "SYSTEM",
          title: "User provisioned",
          body: `${u.name} (${u.employeeId}) was created as ${ROLE_LABELS[u.role] ?? u.role} under ${provisioned.orgScopeLabel}.`,
          severity: "INFO",
          linkView: "users",
          refId: u.id,
        },
      });
      await Promise.all([
        logActivity({
          actorName: actor.name,
          actorRole: actor.role,
          action: "ACCOUNT_UPDATE",
          targetType: "User",
          targetLabel: `${u.name} created as ${ROLE_LABELS[u.role] ?? u.role}`,
        }),
        logAudit({
          actorName: actor.name,
          actorRole: actor.role,
          action: "USER_CREATE",
          targetType: "User",
          targetId: u.id,
          targetLabel: u.name,
          after: {
            email: u.email,
            googleEmail: u.googleEmail,
            employeeId: u.employeeId,
            role: u.role,
            status: u.status,
            subsidiaryId: u.subsidiaryId,
            businessUnitId: u.businessUnitId,
            projectId: u.projectId,
          },
        }),
      ]);

      return ok(
        {
          user: u,
          tempPassword: provisioned.tempPassword,
          emailSent: provisioned.emailResult.sent,
          emailNote: provisioned.emailResult.reason,
        },
        { status: 201 }
      );
    } catch (err) {
      if (err instanceof ProvisionError) {
        return fail(err.message, err.status);
      }
      throw err;
    }
  });
}

export async function PATCH(req: NextRequest) {
  return handle(async () => {
    const actor = await requireGroupAdmin();
    const b = await body<Record<string, string>>(req);
    if (!b.id) return fail("User id is required.");
    const before = await db.user.findUnique({ where: { id: b.id } });
    if (!before) return fail("User not found.", 404);

    const action = b.action;
    if (action === "suspend" || action === "reactivate" || action === "deactivate") {
      if (b.id === actor.id && action !== "reactivate") {
        return fail("You cannot suspend or deactivate your own active Group Admin session.", 403);
      }
      const status = action === "suspend" ? "SUSPENDED" : action === "deactivate" ? "INACTIVE" : "ACTIVE";
      const u = await db.user.update({ where: { id: b.id }, data: { status } });
      if (status !== "ACTIVE") {
        await revokeUserSessions(b.id);
      } else {
        invalidateAllAuthCaches(b.id);
      }
      await Promise.all([
        logActivity({
          actorName: actor.name,
          actorRole: actor.role,
          action: "ROLE_CHANGE",
          targetType: "User",
          targetLabel: `${u.name} → ${status}`,
          severity: action === "reactivate" ? "INFO" : "WARNING",
        }),
        logAudit({
          actorName: actor.name,
          actorRole: actor.role,
          action: action === "suspend" ? "USER_SUSPEND" : action === "deactivate" ? "USER_DEACTIVATE" : "USER_REACTIVATE",
          targetType: "User",
          targetId: u.id,
          targetLabel: u.name,
          before: { status: before.status },
          after: { status },
          reason: b.reason,
        }),
      ]);
      return ok({ user: u });
    }

    if (action === "reset-credentials") {
      if (b.id === actor.id) {
        return fail("Use your profile password change dialog to rotate your own password.", 403);
      }
      const tempPassword = generateTempPassword(12);
      const passwordHash = await hashPassword(tempPassword);
      const { rawToken, tokenHash, expiresAt } = createResetTokenPair(15);
      const origin = getAppOrigin(new URL(req.url).origin);
      const resetUrl = `${origin}/?resetToken=${encodeURIComponent(rawToken)}`;
      const nextProvider = before.googleSub || before.googleEmail ? "BOTH" : "CREDENTIALS";

      await db.$transaction([
        db.user.update({
          where: { id: before.id },
          data: {
            passwordHash,
            mustChangePassword: true,
            authProvider: nextProvider,
            ...(before.status === "INVITED" ? { status: "ACTIVE" } : {}),
          },
        }),
        db.passwordResetRequest.create({
          data: {
            userId: before.id,
            requestedIdentifier: before.employeeId ?? before.email,
            portal: "group",
            reason: b.reason || "Group Admin credential reset",
            status: "APPROVED_TEMP",
            approverId: actor.id,
            approverRole: actor.role,
            tokenHash,
            expiresAt,
            reviewedAt: new Date(),
          },
        }),
      ]);

      await revokeUserSessions(before.id);

      const emailResult = await sendPasswordResetLinkEmail({
        to: before.email,
        name: before.name,
        resetUrl,
        tempPassword,
        approvedByName: actor.name,
      });

      await db.notification.create({
        data: {
          ntype: "SECURITY",
          title: "Credential recovery issued",
          body: `Temporary credentials and a 15-minute reset link were issued for ${before.name} by ${actor.name}. Active sessions revoked.`,
          severity: "INFO",
          linkView: "users",
          refId: before.id,
        },
      });
      await logAudit({
        actorName: actor.name,
        actorRole: actor.role,
        action: "USER_CREDENTIAL_RESET",
        targetType: "User",
        targetId: before.id,
        targetLabel: before.name,
        reason: b.reason,
      });
      return ok({
        success: true,
        tempPassword,
        resetUrl,
        emailSent: emailResult.sent,
        emailNote: emailResult.reason,
        message: "Temporary password generated and active sessions revoked.",
      });
    }

    // General profile update
    if (b.role && !VALID_ROLES.includes(b.role)) return fail("Invalid role.");
    if (b.status && !VALID_STATUSES.includes(b.status)) return fail("Invalid status.");

    const nextGoogleEmail =
      b.googleEmail !== undefined ? b.googleEmail.trim().toLowerCase() || null : before.googleEmail;
    if (nextGoogleEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextGoogleEmail)) {
      return fail("Invalid linked Google email address.");
    }
    if (nextGoogleEmail && nextGoogleEmail !== before.googleEmail) {
      const conflict = await db.user.findFirst({
        where: {
          id: { not: before.id },
          OR: [{ googleEmail: nextGoogleEmail }, { email: nextGoogleEmail }],
        },
        select: { id: true },
      });
      if (conflict) return fail("This Google email is already linked to another account.", 409);
    }

    const roleChanged = b.role && b.role !== before.role;
    const nextAuthProvider =
      before.passwordHash && nextGoogleEmail
        ? "BOTH"
        : nextGoogleEmail
          ? "GOOGLE"
          : "CREDENTIALS";

    const u = await db.user.update({
      where: { id: b.id },
      data: {
        name: b.name?.trim() || before.name,
        role: b.role ?? before.role,
        status: b.status ?? before.status,
        googleEmail: nextGoogleEmail,
        authProvider: nextAuthProvider,
        subsidiaryId: b.subsidiaryId !== undefined ? b.subsidiaryId || null : before.subsidiaryId,
        businessUnitId: b.businessUnitId !== undefined ? b.businessUnitId || null : before.businessUnitId,
        projectId: b.projectId !== undefined ? b.projectId || null : before.projectId,
        title: b.title ?? before.title,
        phone: b.phone ?? before.phone,
      },
    });
    if (u.status !== "ACTIVE") {
      await revokeUserSessions(u.id);
    } else {
      invalidateAllAuthCaches(u.id);
    }

    await Promise.all([
      logActivity({
        actorName: actor.name,
        actorRole: actor.role,
        action: roleChanged ? "ROLE_CHANGE" : "ACCOUNT_UPDATE",
        targetType: "User",
        targetLabel: roleChanged ? `${u.name}: ${ROLE_LABELS[before.role]} → ${ROLE_LABELS[u.role]}` : `${u.name} profile updated`,
      }),
      logAudit({
        actorName: actor.name,
        actorRole: actor.role,
        action: roleChanged ? "ROLE_CHANGE" : "USER_UPDATE",
        targetType: "User",
        targetId: u.id,
        targetLabel: u.name,
        before: { role: before.role, status: before.status, subsidiaryId: before.subsidiaryId, googleEmail: before.googleEmail },
        after: { role: u.role, status: u.status, subsidiaryId: u.subsidiaryId, googleEmail: u.googleEmail },
        reason: b.reason,
      }),
    ]);
    if (roleChanged && DATA_ENTRY_ROLES.includes(u.role)) {
      await db.notification.create({
        data: {
          ntype: "SYSTEM",
          title: "Role assignment updated",
          body: `${u.name} now holds the ${ROLE_LABELS[u.role]} role. Reporting responsibilities may have changed.`,
          severity: "INFO",
          linkView: "users",
          refId: u.id,
        },
      });
    }
    return ok({ user: u });
  });
}

export async function DELETE(req: NextRequest) {
  return handle(async () => {
    const actor = await requireGroupAdmin();
    const b = await body<Record<string, string>>(req);
    if (!b.id) return fail("User id is required.");
    if (b.id === actor.id) return fail("You cannot deactivate your own active session.", 403);
    const before = await db.user.findUnique({ where: { id: b.id } });
    if (!before) return fail("User not found.", 404);
    if (before.role === "GROUP_ADMIN") return fail("The Group Admin account cannot be deactivated.");
    // Deactivate instead of delete to preserve report attribution and audit history.
    const u = await db.user.update({ where: { id: b.id }, data: { status: "INACTIVE" } });
    await revokeUserSessions(b.id);
    await Promise.all([
      logActivity({
        actorName: actor.name,
        actorRole: actor.role,
        action: "ACCOUNT_UPDATE",
        targetType: "User",
        targetLabel: `${u.name} deactivated (retained for audit)`,
        severity: "WARNING",
      }),
      logAudit({
        actorName: actor.name,
        actorRole: actor.role,
        action: "USER_DEACTIVATE",
        targetType: "User",
        targetId: u.id,
        targetLabel: u.name,
        before: { status: before.status },
        after: { status: "INACTIVE" },
        reason: b.reason ?? "Deactivation preserves report attribution and audit history.",
      }),
    ]);
    return ok({ success: true, preserved: true, message: "User deactivated and active sessions revoked. Records preserved." });
  });
}
