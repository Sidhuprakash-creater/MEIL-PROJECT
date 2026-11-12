import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/db";

const GROUP_TIER = new Set(["GROUP_ADMIN", "ORG_MANAGER"]);
const SUB_TIER = new Set(["SUBSIDIARY_ADMIN", "SUBSIDIARY_MANAGER"]);
const BU_TIER = new Set(["BU_ADMIN", "BU_MANAGER"]);

export function hashResetToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function createResetTokenPair(ttlMinutes = 15): {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
} {
  const rawToken = randomBytes(32).toString("hex");
  return {
    rawToken,
    tokenHash: hashResetToken(rawToken),
    expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
  };
}

/** Determine whether an admin actor is permitted to approve/reject a reset request for targetUser. */
export function canAdminReviewResetRequest(
  actor: {
    id: string;
    role: string;
    subsidiaryId?: string | null;
    businessUnitId?: string | null;
    projectId?: string | null;
  },
  target: {
    id: string;
    role: string;
    subsidiaryId?: string | null;
    businessUnitId?: string | null;
    projectId?: string | null;
  }
): boolean {
  if (actor.id === target.id) return false;

  if (actor.role === "GROUP_ADMIN") return true;

  if (GROUP_TIER.has(target.role)) return false;

  if (actor.role === "SUBSIDIARY_ADMIN") {
    if (!actor.subsidiaryId || target.subsidiaryId !== actor.subsidiaryId) {
      return false;
    }
    return target.role !== "SUBSIDIARY_ADMIN";
  }

  if (SUB_TIER.has(target.role)) return false;

  if (actor.role === "BU_ADMIN") {
    if (!actor.businessUnitId || target.businessUnitId !== actor.businessUnitId) {
      return false;
    }
    return !BU_TIER.has(target.role);
  }

  if (BU_TIER.has(target.role) || target.role === "PROJECT_ADMIN") return false;

  if (actor.role === "PROJECT_ADMIN") {
    if (!actor.projectId || target.projectId !== actor.projectId) {
      return false;
    }
    return true;
  }

  return false;
}

/** Find governing admin recipients to notify by email when a user requests password recovery. */
export async function findGoverningAdminsForUser(target: {
  id: string;
  role: string;
  subsidiaryId?: string | null;
  businessUnitId?: string | null;
  projectId?: string | null;
}) {
  const scopeFilters: any[] = [{ role: "GROUP_ADMIN" }];

  if (!GROUP_TIER.has(target.role) && target.subsidiaryId) {
    scopeFilters.push({
      role: "SUBSIDIARY_ADMIN",
      subsidiaryId: target.subsidiaryId,
    });
  }
  if (!GROUP_TIER.has(target.role) && !SUB_TIER.has(target.role) && target.businessUnitId) {
    scopeFilters.push({
      role: "BU_ADMIN",
      businessUnitId: target.businessUnitId,
    });
  }
  if (
    !GROUP_TIER.has(target.role) &&
    !SUB_TIER.has(target.role) &&
    !BU_TIER.has(target.role) &&
    target.role !== "PROJECT_ADMIN" &&
    target.projectId
  ) {
    scopeFilters.push({
      role: "PROJECT_ADMIN",
      projectId: target.projectId,
    });
  }

  return db.user.findMany({
    where: {
      status: "ACTIVE",
      id: { not: target.id },
      OR: scopeFilters,
    },
    select: { id: true, name: true, email: true, role: true },
  });
}

