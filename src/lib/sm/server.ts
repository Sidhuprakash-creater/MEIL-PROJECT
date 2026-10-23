import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionPayload } from "@/lib/session";
import type { SessionPayload } from "@/lib/platform-config";

/* ═══════════════════════════════════════════════════════════════════════════
   SUBSIDIARY MANAGER — server-side authorization & scoping helpers.

   Every /api/sm/* route MUST begin with `requireSubsidiaryManager()`. The
   guard re-verifies the session server-side on every request: only ACTIVE
   SUBSIDIARY_MANAGER accounts with an assigned subsidiary pass. A subsidiary
   manager can never read or mutate another subsidiary's records through this
   API family — every query below is filtered by the session's subsidiaryId.

   Role boundary (enforced here, not in the UI):
     · SUBSIDIARY_MANAGER: review + approve/reject of in-scope reports.
     · NO organizational creation (BU/project/user/timeline mutations) — those
       live on /api/sa/* (Subsidiary Admin) and are never exposed here.
     · NO consolidated Group BRSR creation — /api/esg/* (Group Admin only).
   ═══════════════════════════════════════════════════════════════════════════ */

export class SmError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export interface SmContext {
  userId: string;
  employeeId: string;
  name: string;
  role: "SUBSIDIARY_MANAGER";
  subsidiaryId: string;
}

export type SmSession = SessionPayload & { sm?: SmContext };

/** Guard: resolve the session and enforce the Subsidiary Manager scope. */
export async function requireSubsidiaryManager(): Promise<SmContext> {
  const session = await getSessionPayload();
  const user = session?.user;
  if (!session?.authenticated || !user) {
    throw new SmError("Your session has expired. Please sign in again.", 401);
  }
  if (user.role !== "SUBSIDIARY_MANAGER") {
    throw new SmError("This workspace is scoped to Subsidiary Manager accounts.", 403);
  }
  const subsidiaryId = user.scope.subsidiary?.id;
  if (!subsidiaryId) {
    throw new SmError("Your account is not assigned to a subsidiary. Contact your Group Admin.", 403);
  }
  return {
    userId: user.id,
    employeeId: user.employeeId,
    name: user.name,
    role: "SUBSIDIARY_MANAGER",
    subsidiaryId,
  };
}

/** Wrap an /api/sm handler: maps SmError to its status, everything else to 500. */
export async function smHandle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof SmError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[sm-api]", e);
    const msg = e instanceof Error ? e.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/* ── logging (subsidiary-scoped activity + authoritative audit) ───────────── */

export async function smLogActivity(
  ctx: SmContext,
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
        actorRole: "SUBSIDIARY_MANAGER",
        action: e.action,
        targetType: e.targetType ?? "",
        targetLabel: e.targetLabel ?? "",
        orgLabel: subName,
        severity: e.severity ?? "INFO",
      },
    });
  } catch (err) {
    console.error("[sm-activity]", err);
  }
}

export async function smLogAudit(
  ctx: SmContext,
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
        actorRole: "SUBSIDIARY_MANAGER",
        action: e.action,
        targetType: e.targetType ?? "",
        targetId: e.targetId ?? "",
        targetLabel: e.targetLabel ?? "",
        orgScope: subCode,
        before: e.before !== undefined ? JSON.stringify(e.before) : "{}",
        after: e.after !== undefined ? JSON.stringify(e.after) : "{}",
        reason: e.reason ?? "",
        outcome: e.outcome ?? "SUCCESS",
        correlation: `sm-${Math.random().toString(36).slice(2, 10)}`,
      },
    });
  } catch (err) {
    console.error("[sm-audit]", err);
  }
}

/**
 * Notification for review decisions. Written with subsidiaryId = null so it is
 * visible on the Group Admin bell AND the subsidiary console bell (both scope
 * filters include null-subsidiary rows) — one record, three consoles, which is
 * exactly the cross-console sync contract for manager decisions.
 */
export async function smNotify(e: {
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
    console.error("[sm-notify]", err);
  }
}

/* ── shared scope-assertion helpers (read-only mirrors of the SA family) ──── */

export async function getSubsidiaryOrThrow(subsidiaryId: string) {
  const sub = await db.subsidiary.findUnique({ where: { id: subsidiaryId } });
  if (!sub || sub.status !== "ACTIVE") {
    throw new SmError("Your assigned subsidiary was not found or is inactive.", 403);
  }
  return sub;
}

/** Assert a business unit belongs to the manager's subsidiary. */
export async function assertUnitInScope(unitId: string, subsidiaryId: string) {
  const unit = await db.businessUnit.findUnique({ where: { id: unitId } });
  if (!unit || unit.subsidiaryId !== subsidiaryId) {
    throw new SmError("This business unit is outside your assigned subsidiary.", 403);
  }
  return unit;
}

/** Assert a project belongs to the manager's subsidiary (via its BU). */
export async function assertProjectInScope(projectId: string, subsidiaryId: string) {
  const project = await db.project.findUnique({ where: { id: projectId }, include: { businessUnit: true } });
  if (!project || project.businessUnit.subsidiaryId !== subsidiaryId) {
    throw new SmError("This project is outside your assigned subsidiary.", 403);
  }
  return project;
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

/* ── effective deadline resolution (shared with the SA family) ────────────── */

export {
  resolveEffectiveDeadline,
  deadlineStatus,
} from "@/lib/sa/server";
export type { EffectiveDeadline } from "@/lib/sa/server";
