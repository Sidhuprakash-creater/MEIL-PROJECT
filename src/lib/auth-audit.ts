import { db } from "@/lib/db";

export type AuthAuditEvent =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "PASSWORD_RESET_REQUESTED"
  | "RATE_LIMITED";

export interface AuthAuditEntry {
  eventType: AuthAuditEvent;
  result: "SUCCESS" | "FAILURE" | "INFO";
  employeeId?: string;
  userId?: string;
  portal?: string;
  role?: string;
  scopeRef?: string;
  reason?: string;
  detail?: string;
  ip?: string;
  userAgent?: string;
}

/**
 * Append to the immutable auth audit trail. Failures are logged to the console
 * but never break the authentication flow itself.
 */
export async function logAuthAudit(entry: AuthAuditEntry): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        eventType: entry.eventType,
        result: entry.result,
        employeeId: entry.employeeId,
        userId: entry.userId,
        portal: entry.portal,
        role: entry.role,
        scopeRef: entry.scopeRef,
        reason: entry.reason,
        detail: entry.detail,
        ip: entry.ip,
        userAgent: entry.userAgent,
      },
    });
  } catch (err) {
    console.error("[auth-audit] failed to record entry:", entry.eventType, err);
  }
}
