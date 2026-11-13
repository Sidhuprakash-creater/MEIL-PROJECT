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
import { ROLES } from "@/lib/platform-config";
import { ProvisionError, provisionUser } from "@/lib/auth/provision-user";
import { invalidateAllAuthCaches, revokeUserSessions } from "@/lib/auth/session-utils";
import { generateTempPassword, hashPassword } from "@/lib/password";
import { createResetTokenPair } from "@/lib/auth/password-reset";
import {
  getAppOrigin,
  sendDeadlineAlertEmail,
  sendPasswordResetLinkEmail,
} from "@/lib/notify/email";

export const dynamic = "force-dynamic";

const PERMITTED_ROLES = [
  "ENV_DATA_USER",
  "FIN_RESOURCE_USER",
  "HR_USER",
  "EHS_USER",
  "PROCUREMENT_USER",
  "CSR_USER",
  "COMPLIANCE_USER",
];

export async function GET(_req: NextRequest) {
  try {
    const ctx = await getProjectAdminContext();
    if (!ctx) return paFail("Project Admin context not resolved.", 401);

    const cacheKey = `users:${ctx.projectId}`;
    const cached = getPaServerCache<any>(cacheKey);
    if (cached) {
      return paOk(cached);
    }

    const [users, submissions] = await Promise.all([
      db.user.findMany({
        where: {
          OR: [
            { projectId: ctx.projectId },
            { businessUnitId: ctx.businessUnitId },
            { subsidiaryId: ctx.subsidiaryId },
          ],
        },
        select: {
          id: true,
          name: true,
          email: true,
          googleEmail: true,
          authProvider: true,
          mustChangePassword: true,
          employeeId: true,
          role: true,
          status: true,
          projectId: true,
          phone: true,
          title: true,
          lastActiveAt: true,
          lastLoginAt: true,
          joinedAt: true,
          createdAt: true,
        },
        orderBy: { name: "asc" },
      }),
      db.submission.findMany({
        where: { projectId: ctx.projectId },
        select: { submittedById: true, status: true },
      }),
    ]);

    const userItems = users.map((u) => {
      const userSubs = submissions.filter((s) => s.submittedById === u.id);
      let subStatus: "COMPLETED" | "PENDING" | "DRAFT" | "OVERDUE" | "NONE" = "NONE";
      if (userSubs.some((s) => s.status === "APPROVED" || s.status === "SUBMITTED")) {
        subStatus = "COMPLETED";
      } else if (userSubs.some((s) => s.status === "UNDER_REVIEW" || s.status === "ASSIGNED")) {
        subStatus = "PENDING";
      } else if (userSubs.some((s) => s.status === "DRAFT")) {
        subStatus = "DRAFT";
      }

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        googleEmail: u.googleEmail,
        authProvider: u.authProvider,
        mustChangePassword: u.mustChangePassword,
        employeeId: u.employeeId || "—",
        role: u.role,
        roleLabel: (ROLES as any)[u.role] || u.role,
        status: u.status as any,
        phone: u.phone,
        title: u.title,
        isDirectProjectMember: u.projectId === ctx.projectId,
        assignedSections: [u.role.replace("_USER", "")],
        submissionStatus: subStatus,
        lastActiveAt: u.lastActiveAt ? new Date(u.lastActiveAt).toISOString() : null,
        lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt).toISOString() : null,
        joinedAt: new Date(u.joinedAt || u.createdAt).toISOString(),
        openTasksCount: userSubs.filter((s) => s.status !== "APPROVED").length,
      };
    });

    const payload = {
      users: userItems,
      summary: {
        totalUsers: userItems.length,
        activeUsers: userItems.filter((u) => u.status === "ACTIVE").length,
        inactiveUsers: userItems.filter((u) => u.status === "INACTIVE" || u.status === "SUSPENDED").length,
        pendingInvitations: userItems.filter((u) => u.status === "INVITED").length,
        pendingSubmissions: userItems.filter((u) => u.submissionStatus === "PENDING" || u.submissionStatus === "DRAFT").length,
      },
      permittedRoles: PERMITTED_ROLES.map((r) => ({
        code: r,
        label: (ROLES as any)[r] || r,
      })),
    };

    setPaServerCache(cacheKey, payload, 10000);
    return paOk(payload);
  } catch (err: any) {
    return paFail(err.message, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getProjectAdminContext();
    if (!ctx) return paFail("Project Admin context not resolved.", 401);

    const body = await req.json();
    const {
      name,
      email,
      googleEmail,
      role,
      employeeId,
      phone,
      title,
      issueTempPassword,
    } = body;

    invalidatePaServerCache();

    const origin = new URL(req.url).origin;
    const provisioned = await provisionUser({
      name: String(name ?? ""),
      email: String(email ?? ""),
      googleEmail: googleEmail ? String(googleEmail) : null,
      employeeId: employeeId ? String(employeeId) : null,
      role: String(role ?? ""),
      subsidiaryId: ctx.subsidiaryId,
      businessUnitId: ctx.businessUnitId,
      projectId: ctx.projectId,
      phone: phone ? String(phone) : "",
      title: title ? String(title) : "",
      issueTempPassword: issueTempPassword !== false,
      actor: { id: ctx.userId, name: ctx.userName, role: ctx.userRole },
      allowedRoles: PERMITTED_ROLES,
      origin,
    });

    await logProjectActivity({
      actorName: ctx.userName,
      actorRole: "Project Admin",
      action: "USER_INVITE",
      targetType: "User",
      targetLabel: `${provisioned.user.name} (${provisioned.user.role})`,
      category: "User Management",
      severity: "SUCCESS",
    });

    return paOk(
      {
        user: provisioned.user,
        tempPassword: provisioned.tempPassword,
        emailSent: provisioned.emailResult.sent,
        emailNote: provisioned.emailResult.reason,
      },
      "Contributor user added to project successfully."
    );
  } catch (err: any) {
    if (err instanceof ProvisionError) {
      return paFail(err.message, err.status);
    }
    return paFail(err.message, 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const ctx = await getProjectAdminContext();
    if (!ctx) return paFail("Project Admin context not resolved.", 401);

    const body = await req.json();
    const { id, role, status, action, googleEmail, phone, title } = body;

    if (!id) return paFail("User ID is required.");

    const target = await db.user.findUnique({ where: { id } });
    if (!target) return paFail("Target user not found.", 404);

    if (
      target.projectId !== ctx.projectId &&
      target.businessUnitId !== ctx.businessUnitId &&
      target.subsidiaryId !== ctx.subsidiaryId
    ) {
      return paFail("Target user is outside your project scope.", 403);
    }

    invalidatePaServerCache();
    const origin = getAppOrigin(new URL(req.url).origin);

    // Handle Reminder action (In-app Notification + SMTP email)
    if (action === "remind") {
      await db.notification.create({
        data: {
          ntype: "TASK_REMINDER",
          title: "Reporting Deadline Reminder",
          body: `Project Admin ${ctx.userName} requested an update on your assigned ESG reporting disclosures for ${ctx.projectName}.`,
          refId: target.id,
          subsidiaryId: ctx.subsidiaryId,
          severity: "WARNING",
          linkView: "tasks",
        },
      });

      const emailRes = await sendDeadlineAlertEmail({
        to: target.email,
        name: target.name,
        scopeName: ctx.projectName,
        dueDateLabel: "Upcoming reporting cycle",
        daysRemainingLabel: "ACTION REQUIRED",
        senderName: `${ctx.userName} (Project Admin)`,
        customMessage: `Project Admin ${ctx.userName} requested an update on your pending ESG reporting disclosures for ${ctx.projectName}.`,
        origin,
      });

      await logProjectActivity({
        actorName: ctx.userName,
        actorRole: "Project Admin",
        action: "REMINDER_SENT",
        targetType: "User",
        targetLabel: target.name,
        category: "User Management",
        severity: "INFO",
      });

      return paOk(
        { emailSent: emailRes.sent },
        emailRes.sent
          ? `Reminder notification and email sent to ${target.name}.`
          : `In-app reminder sent to ${target.name}.`
      );
    }

    // Security mutations require direct project contributor membership (cannot alter higher admins)
    if (
      target.projectId !== ctx.projectId ||
      !PERMITTED_ROLES.includes(target.role)
    ) {
      return paFail(
        "Only direct project contributor accounts can be modified from the Project Admin console.",
        403
      );
    }

    if (action === "reset-credential") {
      const tempPassword = generateTempPassword(12);
      const passwordHash = await hashPassword(tempPassword);
      const { rawToken, tokenHash, expiresAt } = createResetTokenPair(15);
      const resetUrl = `${origin}/?resetToken=${encodeURIComponent(rawToken)}`;
      const nextProvider =
        target.googleSub || target.googleEmail ? "BOTH" : "CREDENTIALS";

      await db.$transaction([
        db.user.update({
          where: { id: target.id },
          data: {
            passwordHash,
            mustChangePassword: true,
            authProvider: nextProvider,
            status: target.status === "INVITED" ? "ACTIVE" : target.status,
          },
        }),
        db.passwordResetRequest.create({
          data: {
            userId: target.id,
            requestedIdentifier: target.employeeId ?? target.email,
            portal: "project",
            reason: "Project Admin credential reset",
            status: "APPROVED_TEMP",
            approverId: ctx.userId,
            approverRole: ctx.userRole,
            tokenHash,
            expiresAt,
            reviewedAt: new Date(),
          },
        }),
      ]);

      await revokeUserSessions(target.id);
      const emailRes = await sendPasswordResetLinkEmail({
        to: target.email,
        name: target.name,
        resetUrl,
        tempPassword,
        approvedByName: ctx.userName,
      });

      await logProjectActivity({
        actorName: ctx.userName,
        actorRole: "Project Admin",
        action: "CREDENTIAL_RESET",
        targetType: "User",
        targetLabel: target.name,
        category: "User Management",
        severity: "WARNING",
      });

      return paOk(
        {
          tempPassword,
          resetUrl,
          emailSent: emailRes.sent,
          emailNote: emailRes.reason,
        },
        `Temporary password generated for ${target.name}. Active sessions revoked.`
      );
    }

    if (role && !PERMITTED_ROLES.includes(role)) {
      return paFail("Selected role is not a permitted project contributor role.", 403);
    }

    if (status && !["ACTIVE", "SUSPENDED", "INACTIVE"].includes(status)) {
      return paFail("Invalid status value.", 400);
    }

    let nextGoogleEmail = target.googleEmail;
    if (googleEmail !== undefined) {
      nextGoogleEmail = String(googleEmail ?? "").trim().toLowerCase() || null;
      if (nextGoogleEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextGoogleEmail)) {
        return paFail("Invalid linked Google email address.", 400);
      }
      if (nextGoogleEmail && nextGoogleEmail !== target.googleEmail) {
        const clash = await db.user.findFirst({
          where: {
            id: { not: target.id },
            OR: [{ googleEmail: nextGoogleEmail }, { email: nextGoogleEmail }],
          },
          select: { id: true },
        });
        if (clash) return paFail("Google email is already linked to another user.", 409);
      }
    }

    const updated = await db.user.update({
      where: { id: target.id },
      data: {
        ...(role ? { role } : {}),
        ...(status ? { status } : {}),
        ...(phone !== undefined ? { phone: String(phone).trim() } : {}),
        ...(title !== undefined ? { title: String(title).trim() } : {}),
        ...(googleEmail !== undefined
          ? {
              googleEmail: nextGoogleEmail,
              authProvider:
                target.passwordHash && nextGoogleEmail
                  ? "BOTH"
                  : nextGoogleEmail
                    ? "GOOGLE"
                    : "CREDENTIALS",
            }
          : {}),
      },
    });

    if (updated.status !== "ACTIVE") {
      await revokeUserSessions(updated.id);
    } else {
      invalidateAllAuthCaches(updated.id);
    }

    await logProjectActivity({
      actorName: ctx.userName,
      actorRole: "Project Admin",
      action: "USER_UPDATE",
      targetType: "User",
      targetLabel: `${updated.name} (Role: ${updated.role}, Status: ${updated.status})`,
      category: "User Management",
      severity: updated.status === "ACTIVE" ? "INFO" : "WARNING",
    });

    return paOk({ user: updated }, "User updated successfully.");
  } catch (err: any) {
    return paFail(err.message, 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const ctx = await getProjectAdminContext();
    if (!ctx) return paFail("Project Admin context not resolved.", 401);

    const body = await req.json().catch(() => ({}));
    const id = String(body.id ?? new URL(req.url).searchParams.get("id") ?? "");
    if (!id) return paFail("User ID is required.");
    if (id === ctx.userId) return paFail("You cannot deactivate your own account.", 403);

    const target = await db.user.findUnique({ where: { id } });
    if (!target) return paFail("User not found.", 404);
    if (target.projectId !== ctx.projectId || !PERMITTED_ROLES.includes(target.role)) {
      return paFail("Only project contributor accounts in your project can be deactivated here.", 403);
    }

    invalidatePaServerCache();
    const updated = await db.user.update({
      where: { id },
      data: { status: "INACTIVE" },
    });
    await revokeUserSessions(id);

    await logProjectActivity({
      actorName: ctx.userName,
      actorRole: "Project Admin",
      action: "USER_DEACTIVATE",
      targetType: "User",
      targetLabel: `${updated.name} deactivated (records retained)`,
      category: "User Management",
      severity: "WARNING",
    });

    return paOk({ user: updated }, `${updated.name} deactivated and active sessions revoked.`);
  } catch (err: any) {
    return paFail(err.message, 500);
  }
}
