import { db } from "@/lib/db";
import { clearSessionCache } from "@/lib/session";
import { clearPuUserCache } from "@/lib/pu/session";
import { clearAuthUserCache } from "@/lib/auth/user-lookup";

/** Clear cached sessions/identities across platform + PU auth layers. */
export function invalidateAllAuthCaches(userId?: string) {
  clearSessionCache();
  clearPuUserCache(userId);
  clearAuthUserCache();
}

/** Revoke every active Session row for a user and clear in-memory caches. */
export async function revokeUserSessions(userId: string): Promise<number> {
  const res = await db.session.deleteMany({
    where: { userId },
  });
  invalidateAllAuthCaches(userId);
  return res.count;
}

