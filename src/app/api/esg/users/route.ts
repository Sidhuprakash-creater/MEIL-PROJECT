import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handle, ok, fail, body, logActivity, logAudit, ACTOR } from "@/lib/esg/server";
import { ROLE_LABELS, DATA_ENTRY_ROLES } from "@/lib/esg/types";
import type { User } from "@/lib/esg/types";

const VALID_ROLES = Object.keys(ROLE_LABELS);
const VALID_STATUSES = ["ACTIVE", "SUSPENDED", "INACTIVE", "INVITED"];

async function decorateUsers(): Promise<User[]> {
  const [users, subs, units, projects, submissions, tasks] = await Promise.all([
    db.user.findMany({ orderBy: { name: "asc" } }),
    db.subsidiary.findMany({ select: { id: true, name: true } }),
    db.businessUnit.findMany({ select: { id: true, name: true } }),
    db.project.findMany({ select: { id: true, name: true } }),
    db.submission.findMany({ select: { submittedById: true, status: true, overdue: true } }),
    db.task.findMany({ select: { id: true } }),
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
    const q = req.nextUrl.searchParams.get("q")?.toLowerCase() ?? "";
    let users = await decorateUsers();
    if (q) {
      users = users.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          ROLE_LABELS[u.role]?.toLowerCase().includes(q) ||
          (u.subsidiaryName ?? "").toLowerCase().includes(q)
      );
    }
    return ok({ users });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const b = await body<Record<string, string>>(req);
    if (!b.name?.trim()) return fail("User name is required.");
    if (!b.email?.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.email.trim())) return fail("A valid email address is required.");
    if (!b.role || !VALID_ROLES.includes(b.role)) return fail("A valid role is required.");
    const exists = await db.user.findUnique({ where: { email: b.email.trim().toLowerCase() } });
    if (exists) return fail("A user with this email already exists.");
    const u = await db.user.create({
      data: {
        name: b.name.trim(),
        email: b.email.trim().toLowerCase(),
        role: b.role,
        status: "INVITED",
        subsidiaryId: b.subsidiaryId || null,
        businessUnitId: b.businessUnitId || null,
        projectId: b.projectId || null,
        title: b.title || "",
        phone: b.phone || "",
      },
    });
    await db.notification.create({
      data: {
        ntype: "SYSTEM",
        title: "User invited",
        body: `${u.name} was invited to the workspace as ${ROLE_LABELS[u.role]}.`,
        severity: "INFO",
        linkView: "users",
        refId: u.id,
      },
    });
    await Promise.all([
      logActivity({ actorName: ACTOR.name, action: "ACCOUNT_UPDATE", targetType: "User", targetLabel: `${u.name} invited as ${ROLE_LABELS[u.role]}` }),
      logAudit({ actorName: ACTOR.name, action: "USER_CREATE", targetType: "User", targetId: u.id, targetLabel: u.name, after: { email: u.email, role: u.role, status: u.status } }),
    ]);
    return ok({ user: u }, { status: 201 });
  });
}

export async function PATCH(req: NextRequest) {
  return handle(async () => {
    const b = await body<Record<string, string>>(req);
    if (!b.id) return fail("User id is required.");
    const before = await db.user.findUnique({ where: { id: b.id } });
    if (!before) return fail("User not found.", 404);

    const action = b.action;
    if (action === "suspend" || action === "reactivate" || action === "deactivate") {
      const status = action === "suspend" ? "SUSPENDED" : action === "deactivate" ? "INACTIVE" : "ACTIVE";
      const u = await db.user.update({ where: { id: b.id }, data: { status } });
      await Promise.all([
        logActivity({ actorName: ACTOR.name, action: "ROLE_CHANGE", targetType: "User", targetLabel: `${u.name} → ${status}`, severity: action === "reactivate" ? "INFO" : "WARNING" }),
        logAudit({
          actorName: ACTOR.name,
          action: action === "suspend" ? "USER_SUSPEND" : action === "deactivate" ? "USER_DEACTIVATE" : "USER_REACTIVATE",
          targetType: "User", targetId: u.id, targetLabel: u.name,
          before: { status: before.status }, after: { status }, reason: b.reason,
        }),
      ]);
      return ok({ user: u });
    }

    if (action === "reset-credentials") {
      await db.notification.create({
        data: {
          ntype: "SYSTEM",
          title: "Credential recovery initiated",
          body: `A secure credential reset was initiated for ${before.name}. The user will receive reset instructions.`,
          severity: "INFO",
          linkView: "users",
          refId: before.id,
        },
      });
      await logAudit({ actorName: ACTOR.name, action: "USER_CREDENTIAL_RESET", targetType: "User", targetId: before.id, targetLabel: before.name, reason: b.reason });
      return ok({ success: true, message: "Credential recovery initiated. Reset instructions queued for delivery." });
    }

    // General profile update
    if (b.role && !VALID_ROLES.includes(b.role)) return fail("Invalid role.");
    if (b.status && !VALID_STATUSES.includes(b.status)) return fail("Invalid status.");
    const roleChanged = b.role && b.role !== before.role;
    const u = await db.user.update({
      where: { id: b.id },
      data: {
        name: b.name?.trim() || before.name,
        role: b.role ?? before.role,
        status: b.status ?? before.status,
        subsidiaryId: b.subsidiaryId !== undefined ? b.subsidiaryId || null : before.subsidiaryId,
        businessUnitId: b.businessUnitId !== undefined ? b.businessUnitId || null : before.businessUnitId,
        projectId: b.projectId !== undefined ? b.projectId || null : before.projectId,
        title: b.title ?? before.title,
        phone: b.phone ?? before.phone,
      },
    });
    await Promise.all([
      logActivity({ actorName: ACTOR.name, action: roleChanged ? "ROLE_CHANGE" : "ACCOUNT_UPDATE", targetType: "User", targetLabel: roleChanged ? `${u.name}: ${ROLE_LABELS[before.role]} → ${ROLE_LABELS[u.role]}` : `${u.name} profile updated` }),
      logAudit({
        actorName: ACTOR.name,
        action: roleChanged ? "ROLE_CHANGE" : "USER_UPDATE",
        targetType: "User", targetId: u.id, targetLabel: u.name,
        before: { role: before.role, status: before.status, subsidiaryId: before.subsidiaryId },
        after: { role: u.role, status: u.status, subsidiaryId: u.subsidiaryId },
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
    const b = await body<Record<string, string>>(req);
    if (!b.id) return fail("User id is required.");
    const before = await db.user.findUnique({ where: { id: b.id } });
    if (!before) return fail("User not found.", 404);
    if (before.role === "GROUP_ADMIN") return fail("The Group Admin account cannot be deactivated.");
    // Deactivate instead of delete to preserve report attribution and audit history.
    const u = await db.user.update({ where: { id: b.id }, data: { status: "INACTIVE" } });
    await Promise.all([
      logActivity({ actorName: ACTOR.name, action: "ACCOUNT_UPDATE", targetType: "User", targetLabel: `${u.name} deactivated (retained for audit)`, severity: "WARNING" }),
      logAudit({ actorName: ACTOR.name, action: "USER_DEACTIVATE", targetType: "User", targetId: u.id, targetLabel: u.name, before: { status: before.status }, after: { status: "INACTIVE" }, reason: b.reason ?? "Deactivation preserves report attribution and audit history." }),
    ]);
    return ok({ success: true, preserved: true, message: "User deactivated. Records and audit history preserved." });
  });
}
