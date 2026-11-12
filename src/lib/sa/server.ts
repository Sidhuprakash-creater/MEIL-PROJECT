import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionPayload } from "@/lib/session";
import type { SessionPayload } from "@/lib/platform-config";

/* ═══════════════════════════════════════════════════════════════════════════
   SUBSIDIARY ADMIN — server-side authorization & scoping helpers.

   Every /api/sa/* route MUST begin with `requireSubsidiaryAdmin()`. The guard
   re-verifies the session server-side on every request: only ACTIVE
   SUBSIDIARY_ADMIN accounts with an assigned subsidiary pass. A subsidiary
   admin can never read or mutate another subsidiary's records through this
   API family — every query below is filtered by the session's subsidiaryId.

   Role boundary (enforced here, not in the UI):
     · SUBSIDIARY_ADMIN: read/monitor + organizational administration.
     · Approval / rejection transitions are NEVER exposed on /api/sa/*.
     · GROUP_ADMIN-only actions stay on /api/esg/* (different guard).
   ═══════════════════════════════════════════════════════════════════════════ */

export class SaError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export interface SaContext {
  userId: string;
  employeeId: string;
  name: string;
  role: "SUBSIDIARY_ADMIN";
  subsidiaryId: string;
}

export type SaSession = SessionPayload & { sa?: SaContext };

/** Guard: resolve the session and enforce the Subsidiary Admin scope. */
export async function requireSubsidiaryAdmin(): Promise<SaContext> {
  const session = await getSessionPayload();
  const user = session?.user;
  if (!session?.authenticated || !user) {
    throw new SaError("Your session has expired. Please sign in again.", 401);
  }
  if (user.role !== "SUBSIDIARY_ADMIN") {
    throw new SaError("This workspace is scoped to Subsidiary Admin accounts.", 403);
  }
  const subsidiaryId = user.scope.subsidiary?.id;
  if (!subsidiaryId) {
    throw new SaError("Your account is not assigned to a subsidiary. Contact your Group Admin.", 403);
  }
  return {
    userId: user.id,
    employeeId: user.employeeId,
    name: user.name,
    role: "SUBSIDIARY_ADMIN",
    subsidiaryId,
  };
}

/** Wrap an /api/sa handler: maps SaError to its status, everything else to 500. */
export async function saHandle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof SaError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[sa-api]", e);
    const msg = e instanceof Error ? e.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/* ── logging (subsidiary-scoped activity + authoritative audit) ───────────── */

export async function saLogActivity(
  ctx: SaContext,
  subName: string,
  e: {
    action: string;
    targetType?: string;
    targetLabel?: string;
    severity?: string;
  }
) {
  try {
    await db.activityEvent.create({
      data: {
        actorName: ctx.name,
        actorRole: "SUBSIDIARY_ADMIN",
        action: e.action,
        targetType: e.targetType ?? "",
        targetLabel: e.targetLabel ?? "",
        orgLabel: subName,
        severity: e.severity ?? "INFO",
      },
    });
  } catch (err) {
    console.error("[sa-activity]", err);
  }
}

export async function saLogAudit(
  ctx: SaContext,
  subCode: string,
  e: {
    action: string;
    targetType?: string;
    targetId?: string;
    targetLabel?: string;
    before?: unknown;
    after?: unknown;
    reason?: string;
    outcome?: string;
  }
) {
  try {
    await db.auditEvent.create({
      data: {
        actorName: ctx.name,
        actorRole: "SUBSIDIARY_ADMIN",
        action: e.action,
        targetType: e.targetType ?? "",
        targetId: e.targetId ?? "",
        targetLabel: e.targetLabel ?? "",
        orgScope: subCode,
        before: e.before !== undefined ? JSON.stringify(e.before) : "{}",
        after: e.after !== undefined ? JSON.stringify(e.after) : "{}",
        reason: e.reason ?? "",
        outcome: e.outcome ?? "SUCCESS",
        correlation: `sa-${Math.random().toString(36).slice(2, 10)}`,
      },
    });
  } catch (err) {
    console.error("[sa-audit]", err);
  }
}

/** Notification scoped to the subsidiary workspace (and optionally group bell). */
export async function saNotify(e: {
  ntype: string;
  title: string;
  body?: string;
  severity?: string;
  linkView?: string;
  refId?: string;
  subsidiaryId: string | null; // null = also visible on the Group Admin bell
}) {
  try {
    await db.notification.create({
      data: {
        ntype: e.ntype,
        title: e.title,
        body: e.body ?? "",
        severity: e.severity ?? "INFO",
        linkView: e.linkView ?? "dashboard",
        refId: e.refId ?? "",
        subsidiaryId: e.subsidiaryId,
      },
    });
  } catch (err) {
    console.error("[sa-notify]", err);
  }
}

/* ── shared scope-assertion helpers for nested records ─────────────────────── */

export async function getSubsidiaryOrThrow(subsidiaryId: string) {
  const sub = await db.subsidiary.findUnique({ where: { id: subsidiaryId } });
  if (!sub || sub.status !== "ACTIVE") {
    throw new SaError("Your assigned subsidiary was not found or is inactive.", 403);
  }
  return sub;
}

/** Assert a business unit belongs to the admin's subsidiary. */
export async function assertUnitInScope(unitId: string, subsidiaryId: string) {
  const unit = await db.businessUnit.findUnique({ where: { id: unitId } });
  if (!unit || unit.subsidiaryId !== subsidiaryId) {
    throw new SaError("This business unit is outside your assigned subsidiary.", 403);
  }
  return unit;
}

/** Assert a project belongs to the admin's subsidiary (via its BU). */
export async function assertProjectInScope(projectId: string, subsidiaryId: string) {
  const project = await db.project.findUnique({ where: { id: projectId }, include: { businessUnit: true } });
  if (!project || project.businessUnit.subsidiaryId !== subsidiaryId) {
    throw new SaError("This project is outside your assigned subsidiary.", 403);
  }
  return project;
}

/** Assert a user record is inside the subsidiary and is not a Group Admin. */
export async function assertUserInScope(userId: string, subsidiaryId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new SaError("User not found.", 404);
  if (user.role === "GROUP_ADMIN" || user.role === "ORG_MANAGER") {
    throw new SaError("Group-level accounts cannot be managed from a subsidiary workspace.", 403);
  }
  if (user.subsidiaryId !== subsidiaryId) {
    throw new SaError("This user is registered under a different subsidiary.", 403);
  }
  return user;
}

/** Roles a Subsidiary Admin may assign. Never includes GROUP_ADMIN/ORG_MANAGER/SUBSIDIARY_ADMIN. */
export const ASSIGNABLE_ROLES = [
  "SUBSIDIARY_MANAGER",
  "BU_MANAGER",
  "BU_ADMIN",
  "PROJECT_ADMIN",
  "ENV_DATA_USER",
  "FIN_RESOURCE_USER",
  "HR_USER",
  "EHS_USER",
  "PROCUREMENT_USER",
  "CSR_USER",
  "COMPLIANCE_USER",
] as const;

export const ROLE_LABELS: Record<string, string> = {
  GROUP_ADMIN: "Group Admin",
  ORG_MANAGER: "Organization Manager",
  SUBSIDIARY_ADMIN: "Subsidiary Admin",
  SUBSIDIARY_MANAGER: "Subsidiary Manager",
  BU_MANAGER: "BU Manager",
  BU_ADMIN: "BU Admin",
  PROJECT_ADMIN: "Project Admin",
  ENV_DATA_USER: "Environment Data User",
  FIN_RESOURCE_USER: "Finance & Resource Contributor",
  HR_USER: "HR User",
  EHS_USER: "EHS / Safety User",
  PROCUREMENT_USER: "Procurement User",
  CSR_USER: "CSR / Community User",
  COMPLIANCE_USER: "Compliance User",
};

/* ── effective deadline resolution (inheritance: SUBSIDIARY → BU → PROJECT) ── */

export interface EffectiveDeadline {
  dueDate: Date | null;
  reviewDeadline: Date | null;
  sourceLevel: string; // SUBSIDIARY | BUSINESS_UNIT | PROJECT | UNSET
  sourceLabel: string; // e.g. "Inherited from SUB-ENR"
  mode: "OVERRIDE" | "INHERIT" | "UNSET";
  timelineId: string | null;
  startDate: Date | null;
}

interface Tl {
  id: string; level: string; subsidiaryId: string; businessUnitId: string | null;
  projectId: string | null; dueDate: Date | null; reviewDeadline: Date | null;
  inheritanceMode: string; startDate: Date; name: string; status: string;
}

/**
 * Resolve the effective deadline for an entity by walking UP the hierarchy.
 * OVERRIDE timelines win at their level; INHERIT (or missing) rows fall
 * through to the parent level. Returns UNSET when no ancestor defines dates.
 */
export function resolveEffectiveDeadline(
  level: "SUBSIDIARY" | "BUSINESS_UNIT" | "PROJECT",
  ids: { subsidiaryId: string; businessUnitId?: string | null; projectId?: string | null },
  timelines: Tl[],
  subCodeName: string
): EffectiveDeadline {
  const pick = (l: string, bid?: string | null, pid?: string | null) =>
    timelines.find(
      (t) => t.level === l && t.status === "ACTIVE" &&
        (l === "SUBSIDIARY" ||
          (l === "BUSINESS_UNIT" && t.businessUnitId === bid) ||
          (l === "PROJECT" && t.projectId === pid))
    );

  if (level === "PROJECT") {
    const own = pick("PROJECT", null, ids.projectId);
    if (own && own.inheritanceMode === "OVERRIDE" && own.dueDate) {
      return { dueDate: own.dueDate, reviewDeadline: own.reviewDeadline, sourceLevel: "PROJECT", sourceLabel: "Project override", mode: "OVERRIDE", timelineId: own.id, startDate: own.startDate };
    }
    const parent = resolveEffectiveDeadline("BUSINESS_UNIT", { subsidiaryId: ids.subsidiaryId, businessUnitId: ids.businessUnitId }, timelines, subCodeName);
    if (parent.mode !== "UNSET") {
      return {
        ...parent,
        sourceLabel: parent.mode === "OVERRIDE"
          ? (parent.sourceLevel === "SUBSIDIARY" ? `Inherited from ${subCodeName}` : `Inherited from BU override`)
          : parent.sourceLabel,
      };
    }
    return parent;
  }

  if (level === "BUSINESS_UNIT") {
    const own = pick("BUSINESS_UNIT", ids.businessUnitId);
    if (own && own.inheritanceMode === "OVERRIDE" && own.dueDate) {
      return { dueDate: own.dueDate, reviewDeadline: own.reviewDeadline, sourceLevel: "BUSINESS_UNIT", sourceLabel: "BU override", mode: "OVERRIDE", timelineId: own.id, startDate: own.startDate };
    }
    const root = pick("SUBSIDIARY");
    if (root && root.dueDate) {
      return { dueDate: root.dueDate, reviewDeadline: root.reviewDeadline, sourceLevel: "SUBSIDIARY", sourceLabel: `Inherited from ${subCodeName}`, mode: "INHERIT", timelineId: root.id, startDate: root.startDate };
    }
    return { dueDate: null, reviewDeadline: null, sourceLevel: "UNSET", sourceLabel: "No deadline set", mode: "UNSET", timelineId: null, startDate: null };
  }

  const root = pick("SUBSIDIARY");
  if (root && root.dueDate) {
    return { dueDate: root.dueDate, reviewDeadline: root.reviewDeadline, sourceLevel: "SUBSIDIARY", sourceLabel: "Subsidiary deadline", mode: "OVERRIDE", timelineId: root.id, startDate: root.startDate };
  }
  return { dueDate: null, reviewDeadline: null, sourceLevel: "UNSET", sourceLabel: "No deadline set", mode: "UNSET", timelineId: null, startDate: null };
}

const DAY_MS = 86400000;

/** Deadline status derived from the effective deadline + submission states. */
export function deadlineStatus(opts: {
  effective: EffectiveDeadline;
  hasSubmitted: boolean;
  lastSubmittedAt?: Date | null;
  allApproved: boolean;
  now?: Date;
}): string {
  const { effective, hasSubmitted, lastSubmittedAt, allApproved } = opts;
  const now = opts.now ?? new Date();
  if (!effective.dueDate) return hasSubmitted ? "SUBMITTED" : "NOT_STARTED";
  const due = effective.dueDate.getTime();
  const review = effective.reviewDeadline?.getTime();
  if (allApproved && (!review || now.getTime() > review)) return "CLOSED";
  if (hasSubmitted) {
    return lastSubmittedAt && lastSubmittedAt.getTime() > due ? "SUBMITTED_LATE" : "SUBMITTED_ON_TIME";
  }
  if (now.getTime() > due) return "OVERDUE";
  if (due - now.getTime() <= 7 * DAY_MS) return "DUE_SOON";
  if (effective.startDate && now.getTime() < effective.startDate.getTime()) return "UPCOMING";
  return "IN_PROGRESS";
}

/** Parse a JSON column safely. */
export function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
