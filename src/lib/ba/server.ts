import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionPayload } from "@/lib/session";
import type { SessionPayload } from "@/lib/platform-config";

/* ═══════════════════════════════════════════════════════════════════════════
   BU ADMIN — server-side authorization & scoping helpers.

   Every /api/ba/* route MUST begin with `requireBuAdmin()`. The guard
   re-verifies the session server-side on every request: only ACTIVE
   BU_ADMIN accounts with an assigned business unit pass. A BU admin can
   never read or mutate another BU's records through this API family —
   every query below is filtered by the session's businessUnitId.

   Role boundary (enforced here, not in the UI):
     · BU_ADMIN: read/monitor + operational coordination (manage BU users,
       assign project deadlines within policy, monitor submissions + evidence,
       send reminders, prepare the BU reporting package).
     · Approval / rejection transitions are NEVER exposed on /api/ba/*.
       Decisions belong to the BU Manager (/api/bm/submissions/[id]/decision).
     · NO creation of business units / projects / BRSR consolidation.
     · Group Admin-only actions stay on /api/esg/* (different guard).
   ═══════════════════════════════════════════════════════════════════════════ */

export class BaError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export interface BaContext {
  userId: string;
  employeeId: string;
  name: string;
  role: "BU_ADMIN";
  subsidiaryId: string;
  businessUnitId: string;
}

export type BaSession = SessionPayload & { ba?: BaContext };

/** Guard: resolve the session and enforce the BU Admin scope. */
export async function requireBuAdmin(): Promise<BaContext> {
  const session = await getSessionPayload();
  const user = session?.user;
  if (!session?.authenticated || !user) {
    throw new BaError("Your session has expired. Please sign in again.", 401);
  }
  if (user.role !== "BU_ADMIN") {
    throw new BaError("This workspace is scoped to BU Admin accounts.", 403);
  }
  const businessUnitId = user.scope.businessUnit?.id;
  const subsidiaryId = user.scope.subsidiary?.id ?? user.scope.businessUnit?.subsidiaryId;
  if (!businessUnitId || !subsidiaryId) {
    throw new BaError("Your account is not assigned to a business unit. Contact your Subsidiary Admin.", 403);
  }
  return {
    userId: user.id,
    employeeId: user.employeeId,
    name: user.name,
    role: "BU_ADMIN",
    subsidiaryId,
    businessUnitId,
  };
}

/** Wrap an /api/ba handler: maps BaError to its status, everything else to 500. */
export async function baHandle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof BaError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[ba-api]", e);
    const msg = e instanceof Error ? e.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/* ── logging (BU-scoped activity + authoritative audit) ──────────────────── */

export async function baLogActivity(
  ctx: BaContext,
  buName: string,
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
        actorRole: "BU_ADMIN",
        action: e.action,
        targetType: e.targetType ?? "",
        targetLabel: e.targetLabel ?? "",
        orgLabel: buName,
        severity: e.severity ?? "INFO",
      },
    });
  } catch (err) {
    console.error("[ba-activity]", err);
  }
}

export async function baLogAudit(
  ctx: BaContext,
  buCode: string,
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
        actorRole: "BU_ADMIN",
        action: e.action,
        targetType: e.targetType ?? "",
        targetId: e.targetId ?? "",
        targetLabel: e.targetLabel ?? "",
        orgScope: buCode,
        before: e.before !== undefined ? JSON.stringify(e.before) : "{}",
        after: e.after !== undefined ? JSON.stringify(e.after) : "{}",
        reason: e.reason ?? "",
        outcome: e.outcome ?? "SUCCESS",
        correlation: `ba-${Math.random().toString(36).slice(2, 10)}`,
      },
    });
  } catch (err) {
    console.error("[ba-audit]", err);
  }
}

/** Notification scoped to the BU workspace. Written with subsidiaryId = null
 *  so it is also visible on the Group Admin bell, Subsidiary Admin bell,
 *  Subsidiary Manager bell and BU Manager bell (broadcast across all
 *  consoles — exactly the cross-console sync contract for BU activity). */
export async function baNotify(e: {
  ntype: string;
  title: string;
  body?: string;
  severity?: string;
  linkView?: string;
  refId?: string;
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
        subsidiaryId: null,
      },
    });
  } catch (err) {
    console.error("[ba-notify]", err);
  }
}

/* ── shared scope-assertion helpers ──────────────────────────────────────── */

/** Resolve the assigned BU row + its parent subsidiary. */
export async function getBuOrThrow(businessUnitId: string) {
  const bu = await db.businessUnit.findUnique({
    where: { id: businessUnitId },
    include: { subsidiary: true },
  });
  if (!bu || bu.status !== "ACTIVE") {
    throw new BaError("Your assigned business unit was not found or is inactive.", 403);
  }
  return bu;
}

/** Assert a project belongs to the admin's BU. */
export async function assertProjectInBuScope(projectId: string, businessUnitId: string) {
  const project = await db.project.findUnique({ where: { id: projectId }, include: { businessUnit: true } });
  if (!project || project.businessUnitId !== businessUnitId) {
    throw new BaError("This project is outside your assigned business unit.", 403);
  }
  return project;
}

/** Assert a user record is inside the BU and is not a Group/Subsidiary Admin. */
export async function assertUserInBuScope(userId: string, businessUnitId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new BaError("User not found.", 404);
  if (user.role === "GROUP_ADMIN" || user.role === "ORG_MANAGER" || user.role === "SUBSIDIARY_ADMIN" || user.role === "SUBSIDIARY_MANAGER") {
    throw new BaError("Higher-scope accounts cannot be managed from a BU workspace.", 403);
  }
  if (user.businessUnitId !== businessUnitId) {
    throw new BaError("This user is registered under a different business unit.", 403);
  }
  return user;
}

/** Roles a BU Admin may assign within the BU. Never includes GROUP_ADMIN /
 *  ORG_MANAGER / SUBSIDIARY_ADMIN / SUBSIDIARY_MANAGER / BU_ADMIN / BU_MANAGER. */
export const BA_ASSIGNABLE_ROLES = [
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
  ENV_DATA_USER: "Environment Data User",
  FIN_RESOURCE_USER: "Finance & Resource Contributor",
  HR_USER: "HR User",
  EHS_USER: "EHS / Safety User",
  PROCUREMENT_USER: "Procurement User",
  CSR_USER: "CSR / Community User",
  COMPLIANCE_USER: "Compliance User",
};

/* ── JSON parsing + deadline resolution (re-used from the SA family) ──────── */

export function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export {
  resolveEffectiveDeadline,
  deadlineStatus,
} from "@/lib/sa/server";
export type { EffectiveDeadline } from "@/lib/sa/server";
