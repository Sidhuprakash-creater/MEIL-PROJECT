import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionPayload } from "@/lib/session";
import type { SessionPayload } from "@/lib/platform-config";

/* ═══════════════════════════════════════════════════════════════════════════
   BU MANAGER — server-side authorization & scoping helpers.

   Every /api/bm/* route MUST begin with `requireBuManager()`. The guard
   re-verifies the session server-side on every request: only ACTIVE
   BU_MANAGER accounts with an assigned business unit pass. A BU manager
   can never read or mutate another BU's records through this API family —
   every query below is filtered by the session's businessUnitId.

   Role boundary (enforced here, not in the UI):
     · BU_MANAGER: review + approve/reject/return-for-correction of in-scope
       BU and project reports.
     · NO organizational creation (project/user/timeline mutations) — those
       live on /api/sa/* (Subsidiary Admin) or /api/ba/* (BU Admin) and are
       never exposed here.
     · NO consolidated Group BRSR creation — /api/esg/* (Group Admin only).
   ═══════════════════════════════════════════════════════════════════════════ */

export class BmError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export interface BmContext {
  userId: string;
  employeeId: string;
  name: string;
  role: "BU_MANAGER";
  subsidiaryId: string;
  businessUnitId: string;
}

export type BmSession = SessionPayload & { bm?: BmContext };

/** Guard: resolve the session and enforce the BU Manager scope. */
export async function requireBuManager(): Promise<BmContext> {
  const session = await getSessionPayload();
  const user = session?.user;
  if (!session?.authenticated || !user) {
    throw new BmError("Your session has expired. Please sign in again.", 401);
  }
  if (user.role !== "BU_MANAGER") {
    throw new BmError("This workspace is scoped to BU Manager accounts.", 403);
  }
  const businessUnitId = user.scope.businessUnit?.id;
  const subsidiaryId = user.scope.subsidiary?.id ?? user.scope.businessUnit?.subsidiaryId;
  if (!businessUnitId || !subsidiaryId) {
    throw new BmError("Your account is not assigned to a business unit. Contact your Subsidiary Admin.", 403);
  }
  return {
    userId: user.id,
    employeeId: user.employeeId,
    name: user.name,
    role: "BU_MANAGER",
    subsidiaryId,
    businessUnitId,
  };
}

/** Wrap an /api/bm handler: maps BmError to its status, everything else to 500. */
export async function bmHandle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof BmError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[bm-api]", e);
    const msg = e instanceof Error ? e.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/* ── logging (BU-scoped activity + authoritative audit) ──────────────────── */

export async function bmLogActivity(
  ctx: BmContext,
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
        actorRole: "BU_MANAGER",
        action: e.action,
        targetType: e.targetType ?? "",
        targetLabel: e.targetLabel ?? "",
        orgLabel: buName,
        severity: e.severity ?? "INFO",
      },
    });
  } catch (err) {
    console.error("[bm-activity]", err);
  }
}

export async function bmLogAudit(
  ctx: BmContext,
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
        actorRole: "BU_MANAGER",
        action: e.action,
        targetType: e.targetType ?? "",
        targetId: e.targetId ?? "",
        targetLabel: e.targetLabel ?? "",
        orgScope: buCode,
        before: e.before !== undefined ? JSON.stringify(e.before) : "{}",
        after: e.after !== undefined ? JSON.stringify(e.after) : "{}",
        reason: e.reason ?? "",
        outcome: e.outcome ?? "SUCCESS",
        correlation: `bm-${Math.random().toString(36).slice(2, 10)}`,
      },
    });
  } catch (err) {
    console.error("[bm-audit]", err);
  }
}

/**
 * Notification for review decisions. Written with subsidiaryId = null so it is
 * visible on the Group Admin bell, the subsidiary console bells (SA + SM) AND
 * the BU Admin/Manager bells — one record, all consoles, which is exactly the
 * cross-console sync contract for BU Manager decisions.
 */
export async function bmNotify(e: {
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
    console.error("[bm-notify]", err);
  }
}

/* ── shared scope-assertion helpers (read-only mirrors of the BA family) ─── */

/**
 * The submissions a Business Unit Manager may see.
 *
 * RULE: a report belongs to the Business Unit that OWNS ITS PROJECT. The
 * submission's own `businessUnitId` can be stale (a report mirrored from a
 * site-ops row may still carry the originating BU), so the project → BU
 * relation is the authority. Only genuinely BU-level reports (no project at
 * all) fall back to the BU id.
 *
 * This is what keeps one BU manager from seeing another BU's projects — a
 * forwarded / consolidated status never widens the scope.
 */
export async function buSubmissionScope(businessUnitId: string) {
  const projects = await db.project.findMany({
    where: { businessUnitId },
    select: { id: true },
  });
  const projectIds = projects.map((p) => p.id);
  return {
    projectIds,
    where: {
      OR: [
        ...(projectIds.length ? [{ projectId: { in: projectIds } }] : []),
        { AND: [{ projectId: null }, { businessUnitId }] },
      ],
    } as Record<string, unknown>,
  };
}

/** Guard for a single row: may this BU manager open/decide this report? */
export async function assertSubmissionInBuScope(
  s: { businessUnitId: string | null; projectId: string | null },
  businessUnitId: string,
) {
  if (s.projectId) {
    const project = await db.project.findUnique({
      where: { id: s.projectId },
      select: { businessUnitId: true },
    });
    return !!project && project.businessUnitId === businessUnitId;
  }
  return s.businessUnitId === businessUnitId;
}

/** Resolve the assigned BU row + its parent subsidiary. */
export async function getBuOrThrow(businessUnitId: string) {
  const bu = await db.businessUnit.findUnique({
    where: { id: businessUnitId },
    include: { subsidiary: true },
  });
  if (!bu || bu.status !== "ACTIVE") {
    throw new BmError("Your assigned business unit was not found or is inactive.", 403);
  }
  return bu;
}

/** Assert a project belongs to the manager's BU. */
export async function assertProjectInBuScope(projectId: string, businessUnitId: string) {
  const project = await db.project.findUnique({ where: { id: projectId }, include: { businessUnit: true } });
  if (!project || project.businessUnitId !== businessUnitId) {
    throw new BmError("This project is outside your assigned business unit.", 403);
  }
  return project;
}

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
