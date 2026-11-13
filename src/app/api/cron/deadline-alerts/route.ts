import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionPayload } from "@/lib/session";
import { getAppOrigin, sendDeadlineAlertEmail } from "@/lib/notify/email";

export const dynamic = "force-dynamic";

const DAY_MS = 86400000;

/**
 * GET /api/cron/deadline-alerts
 * Triggered on schedule (with Authorization: Bearer $CRON_SECRET) or manually by GROUP_ADMIN.
 * Evaluates active ReportingTimeline deadlines within 7 days (or already overdue) and dispatches
 * in-app Notifications + SMTP deadline email alerts to scoped active users.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  let authorized = false;
  if (cronSecret && token && token === cronSecret) {
    authorized = true;
  } else {
    const session = await getSessionPayload();
    if (session?.authenticated && session.user?.role === "GROUP_ADMIN") {
      authorized = true;
    }
  }

  if (!authorized) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized. Provide Bearer CRON_SECRET or Group Admin session." },
      { status: 401 }
    );
  }

  const now = new Date();
  const horizon = new Date(now.getTime() + 7 * DAY_MS);
  const origin = getAppOrigin(new URL(request.url).origin);

  const [timelines, subsidiaries] = await Promise.all([
    db.reportingTimeline.findMany({
      where: {
        status: "ACTIVE",
        notify: true,
        dueDate: { not: null, lte: horizon },
      },
      orderBy: { dueDate: "asc" },
      take: 50,
    }),
    db.subsidiary.findMany({ select: { id: true, name: true } }),
  ]);
  const subNameMap = new Map(subsidiaries.map((s) => [s.id, s.name]));

  let notificationsCreated = 0;
  let emailsSent = 0;
  let emailsSkipped = 0;

  for (const tl of timelines) {
    if (!tl.dueDate) continue;
    const diffDays = Math.ceil((tl.dueDate.getTime() - now.getTime()) / DAY_MS);
    const daysLabel =
      diffDays < 0
        ? `OVERDUE by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"}`
        : diffDays === 0
          ? "DUE TODAY"
          : `DUE IN ${diffDays} DAY${diffDays === 1 ? "" : "S"}`;

    // Skip if already alerted today for this timeline ref
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const alreadyAlerted = await db.notification.findFirst({
      where: {
        refId: tl.id,
        ntype: diffDays < 0 ? "OVERDUE" : "DEADLINE",
        createdAt: { gte: todayStart },
      },
      select: { id: true },
    });
    if (alreadyAlerted) continue;

    const subName = subNameMap.get(tl.subsidiaryId) ?? "MEIL Subsidiary";

    await db.notification.create({
      data: {
        ntype: diffDays < 0 ? "OVERDUE" : "DEADLINE",
        title: `${tl.name}: ${daysLabel}`,
        body: `Reporting deadline (${tl.dueDate.toISOString().slice(0, 10)}) for ${subName}.`,
        severity: diffDays < 0 ? "CRITICAL" : "WARNING",
        linkView: "timelines",
        refId: tl.id,
        subsidiaryId: tl.subsidiaryId,
      },
    });
    notificationsCreated++;

    const recipients = await db.user.findMany({
      where: {
        status: "ACTIVE",
        subsidiaryId: tl.subsidiaryId,
        ...(tl.level === "BUSINESS_UNIT" && tl.businessUnitId
          ? { businessUnitId: tl.businessUnitId }
          : {}),
        ...(tl.level === "PROJECT" && tl.projectId
          ? { projectId: tl.projectId }
          : {}),
      },
      select: { email: true, name: true },
      take: 40,
    });

    for (const r of recipients) {
      const res = await sendDeadlineAlertEmail({
        to: r.email,
        name: r.name,
        scopeName: `${subName} — ${tl.name}`,
        dueDateLabel: tl.dueDate.toISOString().slice(0, 10),
        daysRemainingLabel: daysLabel,
        senderName: "MEIL ESG Compliance Scheduler",
        origin,
      });
      if (res.sent) emailsSent++;
      else emailsSkipped++;
    }
  }

  return NextResponse.json({
    ok: true,
    timelinesEvaluated: timelines.length,
    notificationsCreated,
    emailsSent,
    emailsSkipped,
  });
}
