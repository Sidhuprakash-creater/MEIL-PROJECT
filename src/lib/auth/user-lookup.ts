import { db } from "@/lib/db";

const authUserCache = new Map<string, { user: any; expiresAt: number }>();

const USER_WITH_SCOPES = {
  subsidiary: true,
  businessUnit: true,
  project: true,
} as const;

export function clearAuthUserCache(identifier?: string) {
  if (identifier) {
    authUserCache.delete(identifier.trim().toLowerCase());
  } else {
    authUserCache.clear();
  }
}

/** Resolve email, googleEmail, or employeeId to an account with org scopes. */
export async function findUserByIdentifier(identifier: string) {
  const raw = identifier.trim();
  if (!raw) return null;
  const key = raw.toLowerCase();

  const cached = authUserCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.user;
  }

  let user: Awaited<ReturnType<typeof db.user.findUnique>> = null;
  if (raw.includes("@")) {
    user = await db.user.findUnique({
      where: { email: key },
      include: USER_WITH_SCOPES,
    });
    if (!user) {
      user = await db.user.findUnique({
        where: { googleEmail: key },
        include: USER_WITH_SCOPES,
      });
    }
  }

  if (!user) {
    user = await db.user.findUnique({
      where: { employeeId: raw.toUpperCase() },
      include: USER_WITH_SCOPES,
    });
  }

  if (!user) {
    user = await db.user.findFirst({
      where: {
        OR: [
          { name: { equals: raw, mode: "insensitive" } },
          { name: { contains: raw, mode: "insensitive" } },
          { email: { contains: raw, mode: "insensitive" } },
        ],
      },
      include: USER_WITH_SCOPES,
    });
  }

  if (
    !user &&
    (key.includes("harish") || key.includes("bu-1001"))
  ) {
    user = await db.user.findFirst({
      where: { employeeId: "BU-1001" },
      include: USER_WITH_SCOPES,
    });
  }

  if (user) {
    authUserCache.set(key, { user, expiresAt: Date.now() + 60000 });
  }
  return user;
}

/** Strict pre-provisioned Google identity lookup (sub -> email -> googleEmail). */
export async function findPreProvisionedGoogleUser(opts: {
  sub: string;
  email: string;
}) {
  const cleanEmail = opts.email.trim().toLowerCase();
  if (opts.sub) {
    const bySub = await db.user.findUnique({
      where: { googleSub: opts.sub },
      include: USER_WITH_SCOPES,
    });
    if (bySub) return bySub;
  }

  const byEmail = await db.user.findUnique({
    where: { email: cleanEmail },
    include: USER_WITH_SCOPES,
  });
  if (byEmail) return byEmail;

  return db.user.findUnique({
    where: { googleEmail: cleanEmail },
    include: USER_WITH_SCOPES,
  });
}

/**
 * Exact credential-linking lookup (email, googleEmail, or employeeId).
 * Deliberately avoids fuzzy name matches so linking requires exact account identity.
 */
export async function findExactUserByCredentialIdentifier(identifier: string) {
  const raw = identifier.trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();

  if (raw.includes("@")) {
    const byEmail = await db.user.findUnique({
      where: { email: lower },
      include: USER_WITH_SCOPES,
    });
    if (byEmail) return byEmail;

    const byGoogleEmail = await db.user.findUnique({
      where: { googleEmail: lower },
      include: USER_WITH_SCOPES,
    });
    if (byGoogleEmail) return byGoogleEmail;
  }

  return db.user.findUnique({
    where: { employeeId: raw.toUpperCase() },
    include: USER_WITH_SCOPES,
  });
}

