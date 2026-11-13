import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionPayload } from "@/lib/session";

export const dynamic = "force-dynamic";

/* ═══════════════════════════════════════════════════════════════════════════
   GET /api/revision — cross-console data-change fingerprint.

   ONE cheap authenticated endpoint that every console polls (~4s). The
   returned `rev` hash changes whenever ANY shared record is created,
   updated or deleted, so open consoles refetch immediately instead of
   waiting for their 15s poll cycle — this is the latency fix that makes
   sender/receiver updates feel realtime.

   Tables tracked cover every cross-console surface:
     submissions, tasks, evidence, notifications, timelines, packages,
     validation issues, messages, activity, audit, BRSR reports,
     org structure (subsidiaries/units/projects) and users.
   ═══════════════════════════════════════════════════════════════════════════ */

let cache: { rev: string; at: number } | null = null;
const CACHE_MS = 3000;

async function fingerprint(): Promise<string> {
  try {
    const [
      submission, task, notification, validation, audit, user, resetReq,
    ] = await Promise.all([
      db.submission.aggregate({ _max: { updatedAt: true }, _count: true }).catch(() => ({ _count: 0, _max: { updatedAt: null } })),
      db.task.aggregate({ _max: { updatedAt: true }, _count: true }).catch(() => ({ _count: 0, _max: { updatedAt: null } })),
      db.notification.aggregate({ _max: { createdAt: true }, _count: true }).catch(() => ({ _count: 0, _max: { updatedAt: null, createdAt: null } })),
      db.validationIssue.aggregate({ _max: { updatedAt: true }, _count: true }).catch(() => ({ _count: 0, _max: { updatedAt: null } })),
      db.auditEvent.aggregate({ _max: { createdAt: true }, _count: true }).catch(() => ({ _count: 0, _max: { updatedAt: null, createdAt: null } })),
      db.user.aggregate({ _max: { updatedAt: true }, _count: true }).catch(() => ({ _count: 0, _max: { updatedAt: null } })),
      db.passwordResetRequest.aggregate({ _max: { updatedAt: true }, _count: true }).catch(() => ({ _count: 0, _max: { updatedAt: null } })),
    ]);

    const parts = [
      submission._count, submission._max.updatedAt?.getTime() ?? 0,
      task._count, task._max.updatedAt?.getTime() ?? 0,
      notification._count, notification._max.createdAt?.getTime() ?? 0,
      validation._count, validation._max.updatedAt?.getTime() ?? 0,
      audit._count, audit._max.createdAt?.getTime() ?? 0,
      user._count, user._max.updatedAt?.getTime() ?? 0,
      resetReq._count, resetReq._max.updatedAt?.getTime() ?? 0,
    ];
    return `v1-${parts.join(".")}`;
  } catch {
    return cache?.rev ?? "v1-default";
  }
}

export async function GET() {
  try {
    const session = await getSessionPayload();
    if (!session?.authenticated) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const now = Date.now();
    if (cache && now - cache.at < CACHE_MS) {
      return NextResponse.json({ rev: cache.rev }, { headers: { "Cache-Control": "no-store" } });
    }
    const rev = await fingerprint();
    cache = { rev, at: now };
    return NextResponse.json({ rev }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ rev: cache?.rev ?? "v1-fallback" }, { status: 200, headers: { "Cache-Control": "no-store" } });
  }
}
