import { randomInt } from "crypto";
import { db } from "@/lib/db";
import { ROLES, roleLabel } from "@/lib/platform-config";
import { generateTempPassword, hashPassword } from "@/lib/password";
import { invalidateAllAuthCaches } from "@/lib/auth/session-utils";
import {
  sendUserInviteEmail,
  type EmailSendResult,
} from "@/lib/notify/email";

export class ProvisionError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export interface ProvisionUserInput {
  name: string;
  email: string;
  googleEmail?: string | null;
  employeeId?: string | null;
  role: string;
  subsidiaryId?: string | null;
  businessUnitId?: string | null;
  projectId?: string | null;
  phone?: string;
  title?: string;
  status?: "ACTIVE" | "INVITED";
  issueTempPassword?: boolean;
  customPassword?: string | null;
  actor: {
    id?: string | null;
    name: string;
    role: string;
  };
  allowedRoles: readonly string[];
  origin?: string;
  sendInvite?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const GROUP_ROLES = new Set(["GROUP_ADMIN", "ORG_MANAGER"]);
const SUB_ROLES = new Set(["SUBSIDIARY_ADMIN", "SUBSIDIARY_MANAGER"]);
const BU_ROLES = new Set(["BU_ADMIN", "BU_MANAGER"]);
const SITE_ROLES = new Set([
  "PROJECT_ADMIN",
  "PROJECT_MANAGER",
  "PROJECT_USER",
  "ENV_DATA_USER",
  "FIN_RESOURCE_USER",
  "EHS_USER",
  "HR_USER",
  "PROCUREMENT_USER",
  "CSR_USER",
  "COMPLIANCE_USER",
  "ESG_ANALYST",
]);

function prefixForRole(role: string): string {
  if (GROUP_ROLES.has(role)) return "GRP";
  if (SUB_ROLES.has(role)) return "SUB";
  if (BU_ROLES.has(role)) return "BU";
  if (role === "PROJECT_ADMIN" || SITE_ROLES.has(role)) return "PRJ";
  return "MEIL";
}

async function generateUniqueEmployeeId(role: string): Promise<string> {
  const prefix = prefixForRole(role);
  for (let i = 0; i < 12; i++) {
    const candidate = `${prefix}-${randomInt(1000, 9999)}`;
    const exists = await db.user.findUnique({
      where: { employeeId: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  return `${prefix}-${Date.now().toString().slice(-6)}`;
}

async function resolveVerifiedScope(input: ProvisionUserInput): Promise<{
  subsidiaryId: string | null;
  businessUnitId: string | null;
  projectId: string | null;
  orgScopeLabel: string;
}> {
  const role = input.role;

  if (GROUP_ROLES.has(role)) {
    return {
      subsidiaryId: null,
      businessUnitId: null,
      projectId: null,
      orgScopeLabel: "MEIL Group",
    };
  }

  if (SUB_ROLES.has(role)) {
    if (!input.subsidiaryId) {
      throw new ProvisionError(
        `Subsidiary assignment is required for ${roleLabel(role)}.`,
        400
      );
    }
    const sub = await db.subsidiary.findUnique({
      where: { id: input.subsidiaryId },
      select: { id: true, name: true, status: true },
    });
    if (!sub || sub.status !== "ACTIVE") {
      throw new ProvisionError("Assigned subsidiary was not found or is inactive.", 400);
    }
    return {
      subsidiaryId: sub.id,
      businessUnitId: null,
      projectId: null,
      orgScopeLabel: sub.name,
    };
  }

  if (BU_ROLES.has(role)) {
    if (!input.businessUnitId) {
      throw new ProvisionError(
        `Business Unit assignment is required for ${roleLabel(role)}.`,
        400
      );
    }
    const bu = await db.businessUnit.findUnique({
      where: { id: input.businessUnitId },
      include: { subsidiary: { select: { id: true, name: true, status: true } } },
    });
    if (!bu || bu.status !== "ACTIVE") {
      throw new ProvisionError("Assigned business unit was not found or is inactive.", 400);
    }
    if (input.subsidiaryId && bu.subsidiaryId !== input.subsidiaryId) {
      throw new ProvisionError(
        "Selected business unit does not belong to the specified subsidiary.",
        400
      );
    }
    return {
      subsidiaryId: bu.subsidiaryId,
      businessUnitId: bu.id,
      projectId: null,
      orgScopeLabel: `${bu.name} (${bu.subsidiary.name})`,
    };
  }

  if (SITE_ROLES.has(role)) {
    if (input.projectId) {
      const proj = await db.project.findUnique({
        where: { id: input.projectId },
        include: {
          businessUnit: {
            include: { subsidiary: { select: { id: true, name: true } } },
          },
        },
      });
      if (!proj || proj.status !== "ACTIVE") {
        throw new ProvisionError("Assigned project was not found or is inactive.", 400);
      }
      if (input.businessUnitId && proj.businessUnitId !== input.businessUnitId) {
        throw new ProvisionError("Selected project belongs to a different business unit.", 400);
      }
      if (
        input.subsidiaryId &&
        proj.businessUnit.subsidiaryId !== input.subsidiaryId
      ) {
        throw new ProvisionError("Selected project belongs to a different subsidiary.", 400);
      }
      return {
        subsidiaryId: proj.businessUnit.subsidiaryId,
        businessUnitId: proj.businessUnitId,
        projectId: proj.id,
        orgScopeLabel: `${proj.name} (${proj.businessUnit.name})`,
      };
    }

    if (role === "PROJECT_ADMIN" || role === "PROJECT_MANAGER") {
      throw new ProvisionError(
        `Project assignment is required for ${roleLabel(role)} accounts.`,
        400
      );
    }

    if (input.businessUnitId) {
      const bu = await db.businessUnit.findUnique({
        where: { id: input.businessUnitId },
        include: { subsidiary: { select: { id: true, name: true } } },
      });
      if (!bu || bu.status !== "ACTIVE") {
        throw new ProvisionError("Assigned business unit was not found or is inactive.", 400);
      }
      if (input.subsidiaryId && bu.subsidiaryId !== input.subsidiaryId) {
        throw new ProvisionError("Selected business unit belongs to a different subsidiary.", 400);
      }
      return {
        subsidiaryId: bu.subsidiaryId,
        businessUnitId: bu.id,
        projectId: null,
        orgScopeLabel: `${bu.name} (${bu.subsidiary.name})`,
      };
    }

    throw new ProvisionError(
      `Project or Business Unit assignment is required for ${roleLabel(role)}.`,
      400
    );
  }

  // ESG_ANALYST (can be group-wide or optionally scoped)
  if (input.projectId) {
    const proj = await db.project.findUnique({
      where: { id: input.projectId },
      include: { businessUnit: { include: { subsidiary: true } } },
    });
    if (!proj) throw new ProvisionError("Assigned project was not found.", 400);
    return {
      subsidiaryId: proj.businessUnit.subsidiaryId,
      businessUnitId: proj.businessUnitId,
      projectId: proj.id,
      orgScopeLabel: proj.name,
    };
  }
  if (input.businessUnitId) {
    const bu = await db.businessUnit.findUnique({
      where: { id: input.businessUnitId },
      include: { subsidiary: true },
    });
    if (!bu) throw new ProvisionError("Assigned business unit was not found.", 400);
    return {
      subsidiaryId: bu.subsidiaryId,
      businessUnitId: bu.id,
      projectId: null,
      orgScopeLabel: bu.name,
    };
  }
  if (input.subsidiaryId) {
    const sub = await db.subsidiary.findUnique({
      where: { id: input.subsidiaryId },
    });
    if (!sub) throw new ProvisionError("Assigned subsidiary was not found.", 400);
    return {
      subsidiaryId: sub.id,
      businessUnitId: null,
      projectId: null,
      orgScopeLabel: sub.name,
    };
  }
  return {
    subsidiaryId: null,
    businessUnitId: null,
    projectId: null,
    orgScopeLabel: "MEIL Group Analytics",
  };
}

export async function provisionUser(input: ProvisionUserInput): Promise<{
  user: Awaited<ReturnType<typeof db.user.create>>;
  tempPassword: string | null;
  emailResult: EmailSendResult;
  orgScopeLabel: string;
}> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const googleEmail = input.googleEmail?.trim().toLowerCase() || null;

  if (name.length < 2) {
    throw new ProvisionError("Full name must be at least 2 characters.", 400);
  }
  if (!EMAIL_RE.test(email)) {
    throw new ProvisionError("A valid corporate email address is required.", 400);
  }
  if (googleEmail && !EMAIL_RE.test(googleEmail)) {
    throw new ProvisionError("Linked Google email address is invalid.", 400);
  }
  if (!(input.role in ROLES) || !input.allowedRoles.includes(input.role)) {
    throw new ProvisionError(
      `Role "${input.role}" cannot be provisioned from your admin workspace.`,
      403
    );
  }

  const scope = await resolveVerifiedScope(input);

  const existingEmail = await db.user.findFirst({
    where: { OR: [{ email }, ...(googleEmail ? [{ googleEmail }] : [])] },
    select: { id: true, email: true },
  });
  if (existingEmail) {
    throw new ProvisionError(
      `An account already exists with email ${existingEmail.email}.`,
      409
    );
  }

  let employeeId = input.employeeId?.trim().toUpperCase() || null;
  if (employeeId) {
    const existingHandle = await db.user.findUnique({
      where: { employeeId },
      select: { id: true },
    });
    if (existingHandle) {
      throw new ProvisionError(
        `Employee ID "${employeeId}" is already assigned to another user.`,
        409
      );
    }
  } else {
    employeeId = await generateUniqueEmployeeId(input.role);
  }

  const customPw = input.customPassword?.trim() || "";
  if (customPw && customPw.length < 8) {
    throw new ProvisionError(
      "Password must be at least 8 characters long.",
      400
    );
  }

  const wantsPassword =
    Boolean(customPw) || input.issueTempPassword !== false || !googleEmail;
  const plainTempPassword = customPw
    ? customPw
    : wantsPassword
      ? generateTempPassword(12)
      : null;
  const passwordHash = plainTempPassword
    ? await hashPassword(plainTempPassword)
    : null;

  const authProvider =
    passwordHash && googleEmail
      ? "BOTH"
      : googleEmail
        ? "GOOGLE"
        : "CREDENTIALS";

  const status = passwordHash ? "ACTIVE" : (input.status ?? "INVITED");

  const user = await db.user.create({
    data: {
      name,
      email,
      googleEmail,
      authProvider,
      mustChangePassword: Boolean(passwordHash),
      createdById: input.actor.id ?? null,
      employeeId,
      passwordHash,
      role: input.role,
      status,
      subsidiaryId: scope.subsidiaryId,
      businessUnitId: scope.businessUnitId,
      projectId: scope.projectId,
      phone: input.phone?.trim() ?? "",
      title: input.title?.trim() || roleLabel(input.role),
    },
    include: {
      subsidiary: { select: { id: true, code: true, name: true } },
      businessUnit: { select: { id: true, code: true, name: true } },
      project: { select: { id: true, code: true, name: true } },
    },
  });

  invalidateAllAuthCaches();

  const emailResult: EmailSendResult =
    input.sendInvite === false
      ? { sent: false, skipped: true, reason: "Invite email suppressed" }
      : await sendUserInviteEmail({
          to: user.email,
          name: user.name,
          roleLabel: roleLabel(user.role),
          employeeId: user.employeeId,
          tempPassword: plainTempPassword,
          googleEmail: user.googleEmail,
          orgScopeLabel: scope.orgScopeLabel,
          invitedByName: input.actor.name,
          origin: input.origin,
        });

  return {
    user,
    tempPassword: plainTempPassword,
    emailResult,
    orgScopeLabel: scope.orgScopeLabel,
  };
}

