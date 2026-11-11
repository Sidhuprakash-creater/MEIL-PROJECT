// MEIL Intelligence — server-side guard for all /api/copilot routes.
// Unlike the legacy /api/esg/* family (which trusts the caller), every copilot
// route verifies the real session cookie and enforces the role allow-list:
// Group Admin (== Super Admin) and ORG_MANAGER (group analyst role).

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionPayload, clientIp } from "@/lib/session";
import { logAudit } from "@/lib/esg/server";
import type { VerifiedUser } from "@/lib/platform-config";

const COPILOT_ALLOWED_ROLES = new Set(["GROUP_ADMIN", "ORG_MANAGER"]);

export interface CopilotSession {
  user: VerifiedUser;
  requestId: string;
}

export class CopilotError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 400, code = "BAD_REQUEST") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function copilotResponseError(e: unknown): NextResponse {
  if (e instanceof CopilotError) {
    return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
  }
  console.error("[copilot]", e);
  const msg = e instanceof Error ? e.message : "Internal server error";
  return NextResponse.json({ error: msg }, { status: 500 });
}

/** Verify the session, role, and ACTIVE status. Throws CopilotError on failure. */
export async function requireCopilotUser(headers?: Headers): Promise<CopilotSession> {
  const payload = await getSessionPayload();
  if (!payload?.authenticated || !payload.user) {
    throw new CopilotError("Authentication required.", 401, "UNAUTHENTICATED");
  }
  if (!COPILOT_ALLOWED_ROLES.has(payload.user.role)) {
    await auditDenied(payload.user, "ROLE_NOT_PERMITTED", headers);
    throw new CopilotError("MEIL Intelligence is available to Group Admin accounts only.", 403, "FORBIDDEN");
  }
  return {
    user: payload.user,
    requestId: `cop-${Math.random().toString(36).slice(2, 12)}`,
  };
}

async function auditDenied(user: VerifiedUser, reason: string, headers?: Headers) {
  try {
    await db.auditLog.create({
      data: {
        eventType: "COPILOT_ACCESS_DENIED",
        result: "DENIED",
        employeeId: user.employeeId,
        userId: user.id,
        portal: "group",
        role: user.role,
        reason,
        ip: headers ? clientIp(headers) : undefined,
      },
    });
  } catch {
    /* audit is best-effort; access decision is already enforced */
  }
}

/** Authoritative audit event for consequential copilot operations. */
export async function logCopilotAudit(e: {
  actorName: string;
  actorRole: string;
  action: string;
  targetType?: string;
  targetId?: string;
  targetLabel?: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
  outcome?: string;
}) {
  await logAudit({
    actorName: e.actorName,
    actorRole: e.actorRole,
    action: `COPILOT_${e.action}`,
    targetType: e.targetType,
    targetId: e.targetId,
    targetLabel: e.targetLabel,
    before: e.before,
    after: e.after,
    reason: e.reason,
    outcome: e.outcome,
  });
}
