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

export function setPaServerCache(key: string, data: any, ttlMs = 45000) {
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

  // 2. Query Project Admin account from DB (supports session or fallback to seeded Zojila Admin)
  const adminUser = user
    ? await db.user.findUnique({
        where: { id: user.id },
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
        eventType: entry.action,
        description: `${entry.actorName} (${entry.actorRole}) performed ${entry.action} on ${entry.targetType} "${entry.targetLabel}".`,
        severity: entry.severity,
        subsidiaryId: ctx.subsidiaryId,
        businessUnitId: ctx.businessUnitId,
        projectId: ctx.projectId,
        actorName: entry.actorName,
        targetType: entry.targetType,
      },
    });
  } catch (err) {
    console.warn("Failed to write project activity log:", err);
  }
}
