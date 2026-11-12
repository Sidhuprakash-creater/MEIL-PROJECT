import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionPayload } from "@/lib/session";

export type Json = Record<string, unknown>;

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export class EsgAuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function requireGroupAdmin(opts?: { readOnly?: boolean }) {
  const session = await getSessionPayload();
  if (!session?.authenticated || !session.user) {
    throw new EsgAuthError("Authentication required.", 401);
  }
  const allowed = opts?.readOnly
    ? session.user.role === "GROUP_ADMIN" || session.user.role === "ORG_MANAGER"
    : session.user.role === "GROUP_ADMIN";
  if (!allowed) {
    throw new EsgAuthError("Group Admin authorization required.", 403);
  }
  return session.user;
}

/** Wrap a handler with uniform error handling. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof EsgAuthError) {
      return fail(e.message, e.status);
    }
    console.error("[api]", e);
    const msg = e instanceof Error ? e.message : "Internal server error";
    return fail(msg, 500);
  }
}

export async function body<T = Json>(req: NextRequest): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}

/** Operational activity feed entry. */
export async function logActivity(e: {
  actorName: string;
  actorRole?: string;
  action: string;
  targetType?: string;
  targetLabel?: string;
  orgLabel?: string;
  severity?: string;
}) {
  try {
    await db.activityEvent.create({
      data: {
        actorName: e.actorName,
        actorRole: e.actorRole ?? "GROUP_ADMIN",
        action: e.action,
        targetType: e.targetType ?? "",
        targetLabel: e.targetLabel ?? "",
        orgLabel: e.orgLabel ?? "Group",
        severity: e.severity ?? "INFO",
      },
    });
  } catch (err) {
    console.error("[activity]", err);
  }
}

/** Authoritative audit event — append-only. */
export async function logAudit(e: {
  actorName: string;
  actorRole?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  targetLabel?: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
  outcome?: string;
}) {
  try {
    await db.auditEvent.create({
      data: {
        actorName: e.actorName,
        actorRole: e.actorRole ?? "GROUP_ADMIN",
        action: e.action,
        targetType: e.targetType ?? "",
        targetId: e.targetId ?? "",
        targetLabel: e.targetLabel ?? "",
        orgScope: "GROUP",
        before: e.before !== undefined ? JSON.stringify(e.before) : "{}",
        after: e.after !== undefined ? JSON.stringify(e.after) : "{}",
        reason: e.reason ?? "",
        outcome: e.outcome ?? "SUCCESS",
        correlation: `req-${Math.random().toString(36).slice(2, 10)}`,
      },
    });
  } catch (err) {
    console.error("[audit]", err);
  }
}

/** Safe JSON parse for serialized JSON columns. */
export function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Status → bucket mapping used across dashboards. */
export function statusBucket(status: string): "approved" | "pending" | "overdue" | "other" {
  if (status === "APPROVED") return "approved";
  if (["SUBMITTED", "UNDER_REVIEW"].includes(status)) return "pending";
  return "other";
}

export const ACTOR = { name: "Arun Bhaskar", role: "GROUP_ADMIN" };
