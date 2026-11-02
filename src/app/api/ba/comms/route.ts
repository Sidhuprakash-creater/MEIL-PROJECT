import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import {
  BaError, baHandle, requireBuAdmin, getBuOrThrow, assertProjectInBuScope, assertUserInBuScope,
  ROLE_LABELS, baLogActivity, baLogAudit, baNotify, parseJson,
} from "@/lib/ba/server";
import type { MessageRow } from "@/lib/ba/types";

export const dynamic = "force-dynamic";

const BU_CHANNELS = ["DIRECT", "ROLE_GROUP", "PROJECT"];
const KINDS = ["MESSAGE", "ANNOUNCEMENT", "REMINDER"];

const toRow = (m: {
  id: string; kind: string; channel: string; subject: string; body: string;
  audienceLabel: string; recipients: number; delivered: number; failed: number;
  readCount: number; status: string; scheduledFor: Date | null; sentBy: string;
  createdAt: Date;
}): MessageRow => ({
  id: m.id, kind: m.kind, channel: m.channel, subject: m.subject, body: m.body,
  audienceLabel: m.audienceLabel, recipients: m.recipients, delivered: m.delivered,
  failed: m.failed, readCount: m.readCount, status: m.status,
  scheduledFor: m.scheduledFor?.toISOString() ?? null, sentBy: m.sentBy,
  createdAt: m.createdAt.toISOString(), origin: "group" as const,
});

interface MessageBody {
  kind?: string;
  channel?: string;
  subject?: string;
  body?: string;
  role?: string;
  projectId?: string;
  userIds?: string[];
  period?: string;
  scheduledFor?: string;
}

export async function GET() {
  return baHandle(async () => {
    const ctx = await requireBuAdmin();
    const bu = await getBuOrThrow(ctx.businessUnitId);
    void bu;

    /* Messages relevant to the BU: own + BU-scoped audience + group-wide. */
    const rows = await db.message.findMany({
      where: {
        OR: [
          { channel: "GROUP_WIDE" },
          { channel: { in: BU_CHANNELS }, audienceFilter: { contains: ctx.businessUnitId } },
          { sentBy: ctx.name },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const messages: MessageRow[] = [];
    for (const m of rows) {
      const filter = parseJson<{ businessUnitId?: string; subsidiaryId?: string }>(m.audienceFilter, {});
      const groupWide = m.channel === "GROUP_WIDE";
      const inScope = BU_CHANNELS.includes(m.channel) && filter.businessUnitId === ctx.businessUnitId;
      const ownSend = m.sentBy === ctx.name;
      if (!inScope && !groupWide && !ownSend) continue;
      const origin: "group" | "subsidiary" = groupWide ? "group" : "subsidiary";
      messages.push({ ...toRow(m), origin });
    }

    /* Recipients list: all BU users + BU Manager. */
    const users = await db.user.findMany({
      where: { businessUnitId: ctx.businessUnitId, role: { notIn: ["GROUP_ADMIN", "ORG_MANAGER", "SUBSIDIARY_ADMIN", "SUBSIDIARY_MANAGER"] } },
      select: { id: true, name: true, role: true, projectId: true },
    });
    const projects = await db.project.findMany({ where: { businessUnitId: ctx.businessUnitId }, select: { id: true, name: true } });
    const projectNames = new Map(projects.map((p) => [p.id, p.name]));
    const recipients = users.map((u) => ({
      id: u.id, name: u.name, role: u.role, roleLabel: ROLE_LABELS[u.role] ?? u.role,
      projectName: u.projectId ? projectNames.get(u.projectId) ?? null : null,
    }));

    /* Split messages into kinds for the FE tabs. */
    const announcements = messages.filter((m) => m.kind === "ANNOUNCEMENT");
    const reminders = messages.filter((m) => m.kind === "REMINDER");
    const direct = messages.filter((m) => m.kind === "MESSAGE");

    return ok({ messages: direct, announcements, reminders, recipients });
  });
}

export async function POST(req: NextRequest) {
  return baHandle(async () => {
    const ctx = await requireBuAdmin();
    const bu = await getBuOrThrow(ctx.businessUnitId);
    const body = (await req.json().catch(() => ({}))) as MessageBody;

    const kind = (body.kind ?? "MESSAGE").trim().toUpperCase();
    if (!KINDS.includes(kind)) throw new BaError("Message kind must be MESSAGE, ANNOUNCEMENT or REMINDER.", 400);
    const channel = (body.channel ?? "").trim().toUpperCase();
    if (!BU_CHANNELS.includes(channel)) {
      throw new BaError("Channel must be DIRECT, ROLE_GROUP or PROJECT.", 400);
    }
    const subject = (body.subject ?? "").trim();
    if (!subject || subject.length > 150) throw new BaError("A subject of 1–150 characters is required.", 400);
    const text = (body.body ?? "").slice(0, 4000);

    let recipients: { id: string; name: string }[] = [];
    const audienceFilter: Record<string, unknown> = { businessUnitId: ctx.businessUnitId, subsidiaryId: ctx.subsidiaryId };
    let audienceLabel = "";

    if (channel === "DIRECT") {
      const ids = [...new Set((Array.isArray(body.userIds) ? body.userIds : []).map(String).filter(Boolean))];
      if (!ids.length) throw new BaError("Select at least one recipient for a direct message.", 400);
      for (const uid of ids) await assertUserInBuScope(uid, ctx.businessUnitId);
      recipients = await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
      audienceFilter.userIds = ids;
      audienceLabel = `Direct · ${recipients.map((u) => u.name).join(", ")}`.slice(0, 120);
    } else if (channel === "ROLE_GROUP") {
      const role = (body.role ?? "").trim();
      if (!role || !ROLE_LABELS[role]) throw new BaError("Choose a valid role for this audience.", 400);
      recipients = await db.user.findMany({
        where: { businessUnitId: ctx.businessUnitId, role },
        select: { id: true, name: true },
      });
      audienceFilter.role = role;
      audienceLabel = `${ROLE_LABELS[role]} · ${bu.name}`;
    } else if (channel === "PROJECT") {
      if (!body.projectId) throw new BaError("Select the project for this audience.", 400);
      const prj = await assertProjectInBuScope(body.projectId, ctx.businessUnitId);
      recipients = await db.user.findMany({ where: { projectId: prj.id }, select: { id: true, name: true } });
      audienceFilter.projectId = prj.id;
      audienceLabel = `Project · ${prj.name}`;
    }
    if (!recipients.length) throw new BaError("No eligible recipients for this audience.", 400);

    let status = "SENT";
    let delivered = recipients.length;
    let scheduledAt: Date | null = null;
    if (body.scheduledFor) {
      const d = new Date(body.scheduledFor);
      if (isNaN(d.getTime())) throw new BaError("Scheduled time is not a valid date.", 400);
      if (d.getTime() > Date.now()) {
        status = "SCHEDULED";
        delivered = 0;
        scheduledAt = d;
      }
    }

    const msg = await db.message.create({
      data: {
        kind, channel, subject, body: text,
        audienceLabel, audienceFilter: JSON.stringify(audienceFilter),
        recipients: recipients.length, delivered, failed: 0, readCount: 0,
        status, scheduledFor: scheduledAt, sentBy: ctx.name,
      },
    });

    await baNotify({
      ntype: "MESSAGE", title: subject,
      body: status === "SCHEDULED"
        ? `Scheduled for ${scheduledAt!.toISOString()}: ${text.slice(0, 120)}`
        : text.slice(0, 140),
      linkView: "comms", refId: msg.id,
    });
    await baLogActivity(ctx, bu.name, { action: "COMM_SEND", targetType: "Message", targetLabel: subject });
    await baLogAudit(ctx, bu.code, {
      action: "COMM_SEND", targetType: "Message", targetId: msg.id, targetLabel: subject,
      after: { kind, channel, audience: audienceLabel, recipients: recipients.length, status },
    });

    return ok({ message: toRow(msg) }, { status: 201 });
  });
}
