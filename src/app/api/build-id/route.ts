// GET /api/build-id — the current deployment's build id.
//
// The client stamps this into sessionStorage on boot. If a later probe
// returns a DIFFERENT id, the open tab is running a stale build (a deploy
// happened) and the client reloads once — which is exactly what fixes the
// "Application error: a client-side exception has occurred" page after a
// Vercel release.

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    /* The deployment id changes with every release. Vercel exposes it as
       VERCEL_GIT_COMMIT_SHA. Without it we return a CONSTANT — never a
       timestamp: a value that changes on every request would make the client
       reload in a loop. */
    const sha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || "";

    return NextResponse.json(
      { buildId: sha || "stable" },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch {
    return NextResponse.json(
      { buildId: "stable" },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}
