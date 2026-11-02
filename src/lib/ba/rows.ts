/* Shared row mappers used by multiple /api/ba/* route handlers.
   These re-export the SA-side helpers where the shape is identical
   (a BU Admin sees the same row shapes, just filtered to its assigned BU),
   and add a BU-specific helper for resolving BU scope. */

export {
  PTYPE_LABELS,
  unitStats,
  toUnitRow,
  toProjectRow,
  toSubmissionRow,
  toUserRow,
} from "@/lib/sa/rows";

import { db } from "@/lib/db";

/** Resolve the user-id → name map for the BU's assigned users + parent
 *  subsidiary's admin/manager users (so submitted-by / reviewer names
 *  always resolve, even for parent-scope actors). */
export async function loadBuUserNames(businessUnitId: string, subsidiaryId: string): Promise<Map<string, string>> {
  const users = await db.user.findMany({
    where: {
      OR: [
        { businessUnitId },
        { subsidiaryId, role: { in: ["SUBSIDIARY_ADMIN", "SUBSIDIARY_MANAGER"] } },
      ],
    },
    select: { id: true, name: true },
  });
  return new Map(users.map((u) => [u.id, u.name]));
}

/** Resolve project-id → name map for all projects under the BU. */
export async function loadBuProjectNames(businessUnitId: string): Promise<Map<string, string>> {
  const projects = await db.project.findMany({
    where: { businessUnitId },
    select: { id: true, name: true },
  });
  return new Map(projects.map((p) => [p.id, p.name]));
}
