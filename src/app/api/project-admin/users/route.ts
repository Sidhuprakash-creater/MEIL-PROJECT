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
import { ROLES, type RoleCode } from "@/lib/platform-config";

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

export async function GET(req: NextRequest) {
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
            { role: { in: PERMITTED_ROLES } },
          ],
        },
        select: {
          id: true,
          name: true,
          email: true,
          employeeId: true,
          role: true,
          status: true,
          lastActiveAt: true,
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
        employeeId: u.employeeId || "—",
        role: u.role,
        roleLabel: (ROLES as any)[u.role] || u.role,
        status: u.status as any,
        assignedSections: [u.role.replace("_USER", "")],
        submissionStatus: subStatus,
        lastActiveAt: u.lastActiveAt ? new Date(u.lastActiveAt).toISOString() : null,
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

    setPaServerCache(cacheKey, payload, 45000);
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
    const { name, email, role, employeeId } = body;

    if (!name || !email || !role) {
      return paFail("Name, email, and role are required.");
    }

    if (!PERMITTED_ROLES.includes(role)) {
      return paFail(`Role '${role}' is not a permitted project contributor role.`);
    }

    invalidatePaServerCache();

    const existing = await db.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() },
          ...(employeeId ? [{ employeeId: employeeId.toUpperCase() }] : []),
        ],
      },
    });

    if (existing) {
      return paFail("A user with this email or Employee ID already exists.");
    }

    const newUser = await db.user.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        employeeId: employeeId ? employeeId.trim().toUpperCase() : `PRJ-${Math.floor(1000 + Math.random() * 9000)}`,
        role,
        status: "ACTIVE",
        projectId: ctx.projectId,
        businessUnitId: ctx.businessUnitId,
        subsidiaryId: ctx.subsidiaryId,
      },
    });

    await logProjectActivity({
      actorName: ctx.userName,
      actorRole: "Project Admin",
      action: "USER_INVITE",
      targetType: "User",
      targetLabel: `${newUser.name} (${newUser.role})`,
      category: "User Management",
      severity: "SUCCESS",
    });

    return paOk({ user: newUser }, "Contributor user added to project successfully.");
  } catch (err: any) {
    return paFail(err.message, 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const ctx = await getProjectAdminContext();
    if (!ctx) return paFail("Project Admin context not resolved.", 401);

    const body = await req.json();
    const { id, role, status, action } = body;

    if (!id) return paFail("User ID is required.");

    invalidatePaServerCache();

    // Handle Reminder action
    if (action === "remind") {
      const targetUser = await db.user.findUnique({
        where: { id },
        select: { id: true, name: true },
      });
      if (!targetUser) return paFail("Target user not found.", 404);

      await db.notification.create({
        data: {
          ntype: "TASK_REMINDER",
          title: "Reporting Deadline Reminder",
          body: `Project Admin ${ctx.userName} requested an update on your assigned ESG reporting disclosures for ${ctx.projectName}.`,
          refId: targetUser.id,
          subsidiaryId: ctx.subsidiaryId,
          severity: "WARNING",
          linkView: "tasks",
        },
      });

      await logProjectActivity({
        actorName: ctx.userName,
        actorRole: "Project Admin",
        action: "REMINDER_SENT",
        targetType: "User",
        targetLabel: targetUser.name,
        category: "User Management",
        severity: "INFO",
      });

      return paOk({}, `Reminder sent successfully to ${targetUser.name}.`);
    }

    // Role and status updates
    if (role && !PERMITTED_ROLES.includes(role)) {
      return paFail("Selected role is not a permitted project contributor role.");
    }

    const updated = await db.user.update({
      where: { id },
      data: {
        ...(role && { role }),
        ...(status && { status }),
      },
    });

    await logProjectActivity({
      actorName: ctx.userName,
      actorRole: "Project Admin",
      action: "USER_UPDATE",
      targetType: "User",
      targetLabel: `${updated.name} (Role: ${updated.role}, Status: ${updated.status})`,
      category: "User Management",
      severity: "INFO",
    });

    return paOk({ user: updated }, "User updated successfully.");
  } catch (err: any) {
    return paFail(err.message, 500);
  }
}
