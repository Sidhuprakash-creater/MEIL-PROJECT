import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/session";
import type { SessionPayload } from "@/lib/platform-config";

export const dynamic = "force-dynamic";

/* GET /api/auth/session — current verified identity, or unauthenticated. */
export async function GET() {
  const payload = await getSessionPayload();
  const body: SessionPayload = payload ?? { authenticated: false };
  return NextResponse.json({ ok: true, ...body });
}
