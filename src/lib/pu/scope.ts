/* ═══════════════════════════════════════════════════════════════════════════
   MEIL ESG — Project User Portal · scope resolution (server-side authority)

   WHY THIS EXISTS
   A contributor (Environment / Finance / HR / EHS / Procurement / CSR /
   Compliance) belongs to ONE project. The portal must therefore never let
   them enter data for a different project — not through a stale UI
   selection, not through a hand-crafted request body.

   The old behaviour accepted ANY existing `projectId` from the client and
   fell back to a hard-coded project ("PRJ-ZOJ") when none was given, so a
   contributor could end up filing data into somebody else's project.

   RULE
   · user HAS a project scope  → that project is the ONLY writable one
   · user has no project scope  → the requested project (if it exists and is
                                  active), otherwise the first active project
   ═══════════════════════════════════════════════════════════════════════════ */

import { db } from "@/lib/pu/db";
import type { SessionUser } from "@/lib/pu/session";

export class PuScopeError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

/** The project the user is assigned to (or null for non-project roles). */
export function scopedProjectId(user: SessionUser): string | null {
  return user.scopes.find((s) => s.scopeType === "PROJECT")?.scopeId ?? null;
}

/** The business unit the user is assigned to (or null). */
export function scopedBusinessUnitId(user: SessionUser): string | null {
  return user.scopes.find((s) => s.scopeType === "BUSINESS_UNIT")?.scopeId ?? null;
}

export interface ResolvedProject {
  id: string;
  name: string;
  code: string;
}

/**
 * Resolve the project a write must land in.
 *
 * @param requestedProjectId the project the client asked for (may be wrong)
 * @param strict              when true (project-scoped user asking for a
 *                            foreign project) → throws instead of silently
 *                            correcting. Writes should pass `true`.
 */
export async function resolveProjectForUser(
  user: SessionUser,
  requestedProjectId?: string | null,
  strict = true,
): Promise<ResolvedProject> {
  const scoped = scopedProjectId(user);

  /* ── 1. A project-scoped user can ONLY write into their own project ── */
  if (scoped) {
    const mine = await db.project.findUnique({
      where: { id: scoped },
      select: { id: true, name: true, code: true },
    });
    if (!mine) {
      throw new PuScopeError(
        "Your project assignment could not be resolved. Please contact the Project Admin.",
        403,
      );
    }
    if (requestedProjectId && requestedProjectId !== scoped) {
      if (strict) {
        throw new PuScopeError(
          `You are assigned to "${mine.name}" — data can only be entered for your own project.`,
          403,
        );
      }
      /* Non-strict: the user's own project always wins. */
    }
    return mine;
  }

  /* ── 2. No project scope (analyst / group roles): honour the request ── */
  if (requestedProjectId) {
    const requested = await db.project.findUnique({
      where: { id: requestedProjectId },
      select: { id: true, name: true, code: true },
    });
    if (requested) return requested;
  }
  const fallback = await db.project.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { code: "asc" },
    select: { id: true, name: true, code: true },
  });
  if (!fallback) {
    throw new PuScopeError("No active project is available for data entry.", 404);
  }
  return fallback;
}

/** The projects the user may see in a picker (their own one, if scoped). */
export async function listProjectsForUser(user: SessionUser): Promise<ResolvedProject[]> {
  const scoped = scopedProjectId(user);
  if (scoped) {
    const mine = await db.project.findUnique({
      where: { id: scoped },
      select: { id: true, name: true, code: true },
    });
    return mine ? [mine] : [];
  }
  return db.project.findMany({
    where: { status: "ACTIVE" },
    orderBy: { code: "asc" },
    select: { id: true, name: true, code: true },
  });
}
