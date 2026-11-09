import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * POST /api/auth/lookup-role
 * Body: { identifier: string }  (email or employee ID)
 * Returns the account's assigned role so the login form can pre-select it.
 *
 * This intentionally reveals only the role string for an existing account —
 * the login endpoint already discloses the same information via its
 * ROLE_MISMATCH error message, so no new enumeration surface is introduced.
 * No credentials, PII, or account state is returned.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false as const }, { status: 400 });
  }

  const identifier = String(body.identifier ?? "").trim();
  if (!identifier) {
    return NextResponse.json({ ok: false as const }, { status: 400 });
  }

  const key = identifier.toLowerCase();
  let user: Awaited<ReturnType<typeof db.user.findUnique>> = null;

  if (identifier.includes("@")) {
    user = await db.user.findUnique({ where: { email: key } });
  }
  if (!user) {
    user = await db.user.findUnique({
      where: { employeeId: identifier.toUpperCase() },
    });
  }
  if (!user) {
    user = await db.user.findFirst({
      where: {
        OR: [
          { name: { equals: identifier, mode: "insensitive" } },
          { name: { contains: identifier, mode: "insensitive" } },
          { email: { contains: identifier, mode: "insensitive" } },
        ],
      },
    });
  }

  if (!user) {
    // Same shape as "not found" — keep it indistinguishable and cheap.
    return NextResponse.json({ ok: false as const }, { status: 200 });
  }

  return NextResponse.json({ ok: true as const, role: user.role });
}
