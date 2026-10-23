import { NextResponse } from "next/server";
import { logAuthAudit as logAudit } from "@/lib/auth-audit";
import { clientIp } from "@/lib/session";

export const dynamic = "force-dynamic";

/* ────────────────────────────────────────────────────────────────────────────
   POST /api/auth/forgot-password { employeeId }  (employee ID or email)

   No e-mail delivery service is configured in this build, so the request is
   recorded on the audit trail for the ESG IT team and answered with a generic
   (non-enumerating) message. Wire a mailer/reset-token flow here later.
   ──────────────────────────────────────────────────────────────────────────── */

export async function POST(request: Request) {
  let identifier = "";
  try {
    const body = await request.json();
    identifier = String(body.employeeId ?? "").trim();
  } catch {
    /* treated as empty below */
  }

  if (!identifier) {
    return NextResponse.json(
      { ok: false, code: "VALIDATION", message: "Enter your Employee ID / User ID or email first." },
      { status: 400 }
    );
  }

  await logAudit({
    eventType: "PASSWORD_RESET_REQUESTED",
    result: "INFO",
    employeeId: identifier,
    ip: clientIp(request.headers),
    userAgent: request.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({
    ok: true,
    message:
      "If this account is registered, password reset instructions have been issued to the registered business email. For assistance, contact ESG IT support (esg-support@meil.in).",
  });
}
