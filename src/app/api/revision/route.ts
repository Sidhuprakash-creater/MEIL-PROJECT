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
const CACHE_MS = 750;

async function fingerprint(): Promise<string> {
  const [
    submission, task, evidenceDoc, notification, timeline,
    pkg, validation, message, activity, audit, brsr, user, project, unit, sub, setting,
  ] = await Promise.all([
    db.submission.aggregate({ _max: { updatedAt: true }, _count: true }),
    db.task.aggregate({ _max: { updatedAt: true }, _count: true }),
    db.evidenceDoc.aggregate({ _max: { uploadedAt: true }, _count: true }),
    db.notification.aggregate({ _max: { createdAt: true }, _count: true }),
    db.reportingTimeline.aggregate({ _max: { updatedAt: true }, _count: true }),
    db.reportingPackage.aggregate({ _max: { updatedAt: true }, _count: true }),
    db.validationIssue.aggregate({ _max: { updatedAt: true }, _count: true }),
    db.message.aggregate({ _max: { createdAt: true }, _count: true }),
    db.activityEvent.aggregate({ _max: { createdAt: true }, _count: true }),
    db.auditEvent.aggregate({ _max: { createdAt: true }, _count: true }),
    db.brsrReport.aggregate({ _max: { updatedAt: true }, _count: true }),
    db.user.aggregate({ _max: { updatedAt: true }, _count: true }),
    db.project.aggregate({ _max: { updatedAt: true }, _count: true }),
    db.businessUnit.aggregate({ _max: { updatedAt: true }, _count: true }),
    db.subsidiary.aggregate({ _max: { updatedAt: true }, _count: true }),
    db.appSetting.aggregate({ _max: { updatedAt: true }, _count: true }),
  ]);

  const parts = [
    submission._count, submission._max.updatedAt?.getTime() ?? 0,
    task._count, task._max.updatedAt?.getTime() ?? 0,
    evidenceDoc._count, evidenceDoc._max.uploadedAt?.getTime() ?? 0,
    notification._count, notification._max.createdAt?.getTime() ?? 0,
    timeline._count, timeline._max.updatedAt?.getTime() ?? 0,
    pkg._count, pkg._max.updatedAt?.getTime() ?? 0,
    validation._count, validation._max.updatedAt?.getTime() ?? 0,
    message._count, message._max.createdAt?.getTime() ?? 0,
    activity._count, activity._max.createdAt?.getTime() ?? 0,
    audit._count, audit._max.createdAt?.getTime() ?? 0,
    brsr._count, brsr._max.updatedAt?.getTime() ?? 0,
    user._count, user._max.updatedAt?.getTime() ?? 0,
    project._count, project._max.updatedAt?.getTime() ?? 0,
    unit._count, unit._max.updatedAt?.getTime() ?? 0,
    sub._count, sub._max.updatedAt?.getTime() ?? 0,
    setting._count, setting._max.updatedAt?.getTime() ?? 0,
  ];
  return `v1-${parts.join(".")}`;
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
    console.error("[revision]", e);
    return NextResponse.json({ error: "Revision check failed" }, { status: 500 });
  }
}
