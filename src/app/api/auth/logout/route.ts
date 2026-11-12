import { NextResponse } from "next/server";
import { logAuthAudit as logAudit } from "@/lib/auth-audit";
import { clientIp, destroySession, getSessionPayload } from "@/lib/session";
import { invalidateAllAuthCaches } from "@/lib/auth/session-utils";

export const dynamic = "force-dynamic";

/* POST /api/auth/logout — revoke the server session + clear the cookie. */
export async function POST(request: Request) {
  const payload = await getSessionPayload();
  await destroySession();
  invalidateAllAuthCaches(payload?.user?.id);

  if (payload?.user) {
    await logAudit({
      eventType: "LOGOUT",
      result: "SUCCESS",
      userId: payload.user.id,
      employeeId: payload.user.employeeId,
      ip: clientIp(request.headers),
      userAgent: request.headers.get("user-agent") ?? undefined,
    });
  }

  return NextResponse.json({ ok: true });
}
