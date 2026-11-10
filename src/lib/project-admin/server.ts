/* ═══════════════════════════════════════════════════════════════════════════
   MEIL PROJECT COMMAND CENTER — BACKEND SERVER LOGIC (OPTIMIZED & CACHED)
   Instant context resolution, permission guards & data aggregators
   ═══════════════════════════════════════════════════════════════════════════ */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionPayload } from "@/lib/session";
import type { ContributorRole } from "./types";

export interface ProjectAdminContext {
  userId: string;
  userName: string;
  userRole: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  businessUnitId: string;
  businessUnitName: string;
  subsidiaryId: string;
  subsidiaryName: string;
}

// In-memory LRU-style cache for Project Admin context (120s TTL) to prevent redundant remote DB roundtrips
let cachedContext: { ctx: ProjectAdminContext; expiresAt: number; key: string } | null = null;

// Server data cache to make endpoints respond in 1-5ms
const paDataCache = new Map<string, { data: any; expiresAt: number }>();

export function getPaServerCache<T>(key: string): T | null {
  const item = paDataCache.get(key);
  if (item && item.expiresAt > Date.now()) {
    return item.data as T;
  }
  return null;
}

/* Short default TTL: a long cache here meant contributor submissions could
   stay invisible to the Project Admin for up to a minute depending on when
   the cache was seeded — the "sometimes it shows, sometimes it doesn't" bug.
   The client SWR layer still gives instant navigation; the server cache only
   needs to absorb rapid re-polls. */
export function setPaServerCache(key: string, data: any, ttlMs = 10000) {
  paDataCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function invalidatePaServerCache(pattern?: string) {
  if (!pattern) {
    paDataCache.clear();
  } else {
    for (const key of paDataCache.keys()) {
      if (key.includes(pattern)) {
        paDataCache.delete(key);
      }
    }
  }
}

/* ─── PA review scope ──────────────────────────────────────────────────────
 * A Project Admin is bound to ONE project: the contributors of that project
 * (Environment, Finance, HR, EHS, Procurement, CSR, Compliance) report into
 * it and only that PA reviews it. The previous group-wide scope made every
 * PA see submissions from all 32 projects of the group, which is why a PA
 * opened a project and found data from unrelated projects.
 *
 * The scope is enforced server-side: the READ side (submissions, collection
 * status, consolidated report) and the ACTIONS (approve / reject / remind)
 * all resolve through the same project scope.
 */
export const GROUP_WIDE_REVIEW = false;

export function paSubmissionScope(ctx: ProjectAdminContext) {
  if (GROUP_WIDE_REVIEW) return {};
  /* A Project Admin works ONE project. The read scope is therefore that
     project (plus BU-level disclosures of the same business unit that have
     no project of their own) — never a group-wide list. */
  return {
    OR: [
      { projectId: ctx.projectId },
      { businessUnitId: ctx.businessUnitId, projectId: null },
    ],
  };
}

export function paSoSubmissionScope(ctx: ProjectAdminContext) {
  if (GROUP_WIDE_REVIEW) return {};
  return {
    OR: [
      { projectId: ctx.projectId },
      { project: { businessUnitId: ctx.businessUnitId } },
    ],
  };
}

/**
 * Guard for the review ACTIONS (approve / reject / request correction /
 * remind). Those resolve a submission by id, so without this check a Project
 * Admin could act on another project's report by guessing its id.
 * Returns true when the row belongs to the admin's project (or is a
 * BU-level disclosure of their business unit).
 */
export async function paOwnsSubmission(
  ctx: ProjectAdminContext,
  submissionId: string,
): Promise<boolean> {
  const sub = await db.submission.findUnique({
    where: { id: submissionId },
    select: { id: true, projectId: true, businessUnitId: true },
  });
  if (!sub) return false;
  if (sub.projectId) return sub.projectId === ctx.projectId;
  return sub.businessUnitId === ctx.businessUnitId;
}

export async function getProjectAdminContext(): Promise<ProjectAdminContext | null> {
  const session = await getSessionPayload();
  const user = session?.authenticated ? session.user : null;
  const cacheKey = user ? user.id : "default_admin";

  const now = Date.now();
  if (cachedContext && cachedContext.key === cacheKey && cachedContext.expiresAt > now) {
    return cachedContext.ctx;
  }

  // 1. Fast path: Session user already has fully populated scope
  if (
    user &&
    user.scope.project?.id &&
    user.scope.businessUnit?.id &&
    user.scope.subsidiary?.id
  ) {
    const ctx: ProjectAdminContext = {
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      projectId: user.scope.project.id,
      projectCode: user.scope.project.code,
      projectName: user.scope.project.name,
      businessUnitId: user.scope.businessUnit.id,
      businessUnitName: user.scope.businessUnit.name,
      subsidiaryId: user.scope.subsidiary.id,
      subsidiaryName: user.scope.subsidiary.name,
    };
    cachedContext = { ctx, expiresAt: now + 120000, key: cacheKey };
    return ctx;
  }

  // 1b. Check PU Portal session if main session is not set
  let resolvedUserId = user?.id;
  if (!resolvedUserId) {
    try {
      const { getCurrentUser } = await import("@/lib/pu/session");
      const puUser = await getCurrentUser();
      if (puUser?.id) {
        resolvedUserId = puUser.id;
      }
    } catch {}
  }

  // 2. Query Project Admin account from DB (supports session or fallback to seeded Zojila Admin)
  const adminUser = resolvedUserId
    ? await db.user.findUnique({
        where: { id: resolvedUserId },
        select: {
          id: true,
          name: true,
          role: true,
          project: {
            select: {
              id: true,
              code: true,
              name: true,
              businessUnitId: true,
              businessUnit: {
                select: {
                  id: true,
                  name: true,
                  subsidiaryId: true,
                  subsidiary: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      })
    : await db.user.findFirst({
        where: { role: "PROJECT_ADMIN" },
        select: {
          id: true,
          name: true,
          role: true,
          project: {
            select: {
              id: true,
              code: true,
              name: true,
              businessUnitId: true,
              businessUnit: {
                select: {
                  id: true,
                  name: true,
                  subsidiaryId: true,
                  subsidiary: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

  if (adminUser?.project?.businessUnit?.subsidiary) {
    const p = adminUser.project;
    const ctx: ProjectAdminContext = {
      userId: adminUser.id,
      userName: adminUser.name,
      userRole: adminUser.role,
      projectId: p.id,
      projectCode: p.code,
      projectName: p.name,
      businessUnitId: p.businessUnitId,
      businessUnitName: p.businessUnit.name,
      subsidiaryId: p.businessUnit.subsidiaryId,
      subsidiaryName: p.businessUnit.subsidiary.name,
    };
    cachedContext = { ctx, expiresAt: now + 120000, key: cacheKey };
    return ctx;
  }

  // 3. Fallback: Query first active project
  const firstProject = await db.project.findFirst({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      code: true,
      name: true,
      businessUnitId: true,
      businessUnit: {
        select: {
          id: true,
          name: true,
          subsidiaryId: true,
          subsidiary: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (firstProject?.businessUnit?.subsidiary) {
    const ctx: ProjectAdminContext = {
      userId: user?.id || "PRJ-ADMIN",
      userName: user?.name || "Project Site Admin",
      userRole: "PROJECT_ADMIN",
      projectId: firstProject.id,
      projectCode: firstProject.code,
      projectName: firstProject.name,
      businessUnitId: firstProject.businessUnitId,
      businessUnitName: firstProject.businessUnit.name,
      subsidiaryId: firstProject.businessUnit.subsidiaryId,
      subsidiaryName: firstProject.businessUnit.subsidiary.name,
    };
    cachedContext = { ctx, expiresAt: now + 120000, key: cacheKey };
    return ctx;
  }

  return null;
}

export function paOk<T>(data: T, message?: string) {
  return NextResponse.json({ ok: true, data, message }, {
    headers: {
      "Cache-Control": "private, max-age=10, stale-while-revalidate=60",
    },
  });
}

export function paFail(message: string, status = 400, extra?: any) {
  return NextResponse.json({ ok: false, message, ...extra }, { status });
}

export async function logProjectActivity(entry: {
  actorName: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetLabel: string;
  category: string;
  severity: "INFO" | "SUCCESS" | "WARNING" | "CRITICAL";
}) {
  try {
    const ctx = await getProjectAdminContext();
    if (!ctx) return;

    await db.auditEvent.create({
      data: {
        action: entry.action,
        reason: `${entry.actorName} (${entry.actorRole}) performed ${entry.action} on ${entry.targetType} "${entry.targetLabel}".`,
        orgScope: "PROJECT",
        actorName: entry.actorName,
        targetType: entry.targetType,
        targetId: ctx.projectId,
        targetLabel: ctx.projectName,
      },
    });
  } catch (err) {
    console.warn("Failed to write project activity log:", err);
  }
}
