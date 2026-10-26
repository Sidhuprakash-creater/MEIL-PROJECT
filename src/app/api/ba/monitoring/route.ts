import { NextRequest } from "next/server";
import { ok } from "@/lib/esg/server";
import { baHandle, requireBuAdmin } from "@/lib/ba/server";

export const dynamic = "force-dynamic";

/* The FE uses /api/ba/submissions for both Submission Center and Report
   Monitoring. This alias exists for parity with the SA layout so deep links
   that target /monitoring stay valid. The handler forwards the query string. */
export async function GET(_req: NextRequest) {
  return baHandle(async () => {
    const ctx = await requireBuAdmin();
    void ctx;
    return ok({ use: "/api/ba/submissions" });
  });
}
