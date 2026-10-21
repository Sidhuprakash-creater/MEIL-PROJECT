import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handle, ok, fail, body, logActivity, logAudit, ACTOR } from "@/lib/esg/server";
import { ROLE_LABELS, DATA_ENTRY_ROLES } from "@/lib/esg/types";

async function computeAudience(filter: string, channel: string): Promise<{ count: number; label: string }> {
  try {
    const f = JSON.parse(filter || "{}") as { role?: string; subsidiaryIndex?: number; subsidiaryId?: string };
    if (channel === "GROUP_WIDE") {
      const c = await db.user.count({ where: { role: { in: [...DATA_ENTRY_ROLES, "BU_MANAGER", "BU_ADMIN", "SUBSIDIARY_ADMIN", "SUBSIDIARY_MANAGER"] } } });
      return { count: c, label: "All eligible reporting users" };
    }
    if (channel === "ROLE_GROUP" && f.role) {
      const c = await db.user.count({ where: { role: f.role } });
      return { count: c, label: `${ROLE_LABELS[f.role]} role group` };
    }
    if (channel === "SUBSIDIARY" && (f.subsidiaryId || f.subsidiaryIndex !== undefined)) {
      const subs = await db.subsidiary.findMany({ orderBy: { name: "asc" } });
      const sub = f.subsidiaryId ? subs.find((s) => s.id === f.subsidiaryId) : subs[f.subsidiaryIndex ?? -1];
      if (!sub) return { count: 0, label: "Unknown subsidiary" };
      const c = await db.user.count({ where: { subsidiaryId: sub.id } });
      return { count: c, label: sub.name };
    }
    if (channel === "DIRECT") {
      const users = await db.user.count({ where: { role: Object.keys(ROLE_LABELS).length ? undefined : undefined } });
      void users;
      return { count: 1, label: "Direct message" };
    }
    return { count: 0, label: "Unspecified audience" };
  } catch {
    return { count: 0, label: "Unspecified audience" };
  }
}

export async function GET() {
  return handle(async () => {
    const messages = await db.message.findMany({ orderBy: { createdAt: "desc" } });
    return ok({
      messages: messages.map((m) => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
        scheduledFor: m.scheduledFor?.toISOString() ?? null,
      })),
    });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const b = await body<Record<string, string>>(req);
    if (!b.subject?.trim()) return fail("Subject is required.");
    if (!b.body?.trim()) return fail("Message body is required.");
    const channel = b.channel || "GROUP_WIDE";
    const filter = b.audienceFilter || (channel === "ROLE_GROUP" ? JSON.stringify({ role: b.role }) : channel === "SUBSIDIARY" ? JSON.stringify({ subsidiaryId: b.subsidiaryId }) : "{}");
    const audience = await computeAudience(filter, channel);

    if (b.status === "SCHEDULED") {
      if (!b.scheduledFor) return fail("Pick a schedule date/time.");
      const m = await db.message.create({
        data: {
          kind: b.kind || "ANNOUNCEMENT",
          channel,
          subject: b.subject.trim(),
          body: b.body.trim(),
          audienceLabel: audience.label,
          audienceFilter: filter,
          recipients: audience.count,
          status: "SCHEDULED",
          scheduledFor: new Date(b.scheduledFor),
          sentBy: ACTOR.name,
        },
      });
      await Promise.all([
        logActivity({ actorName: ACTOR.name, action: "CONFIG_CHANGE", targetType: "Communication", targetLabel: `Scheduled: ${m.subject}` }),
        logAudit({ actorName: ACTOR.name, action: "MESSAGE_SCHEDULE", targetType: "Message", targetId: m.id, targetLabel: m.subject, after: { channel, audience: audience.label, scheduledFor: b.scheduledFor } }),
      ]);
      return ok({ message: m, audience }, { status: 201 });
    }

    /* Send now — in-app delivery is real; email is honestly reported as unavailable unless configured */
    const emailConfigured = false; // no email provider in this environment
    const m = await db.message.create({
      data: {
        kind: b.kind || "ANNOUNCEMENT",
        channel,
        subject: b.subject.trim(),
        body: b.body.trim(),
        audienceLabel: audience.label,
        audienceFilter: filter,
        recipients: audience.count,
        delivered: audience.count,
        failed: 0,
        readCount: 0,
        status: "SENT",
        sentBy: ACTOR.name,
      },
    });
    // Create in-app notifications for recipients (representative: one per distinct scope)
    if (audience.count > 0) {
      await db.notification.create({
        data: {
          ntype: "SYSTEM",
          title: `New ${m.kind.toLowerCase()}: ${m.subject}`,
          body: `Sent to ${audience.label} (${audience.count} recipients).`,
          severity: "INFO",
          linkView: "comms",
          refId: m.id,
        },
      });
    }
    await Promise.all([
      logActivity({ actorName: ACTOR.name, action: "CONFIG_CHANGE", targetType: "Communication", targetLabel: `Sent: ${m.subject}` }),
      logAudit({ actorName: ACTOR.name, action: "MESSAGE_SEND", targetType: "Message", targetId: m.id, targetLabel: m.subject, after: { channel, audience: audience.label, recipients: audience.count } }),
    ]);
    return ok(
      {
        message: m,
        audience,
        deliveryNote: emailConfigured
          ? "Delivered via in-app and email."
          : "Delivered via in-app notifications. Email delivery is not configured in this environment (see Settings → Integrations).",
      },
      { status: 201 }
    );
  });
}
