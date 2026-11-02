import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import {
  SaError, saHandle, requireSubsidiaryAdmin, getSubsidiaryOrThrow, assertUnitInScope,
  assertUserInScope, ROLE_LABELS, parseJson, saLogActivity, saLogAudit, saNotify,
} from "@/lib/sa/server";
import type { MessageRow } from "@/lib/sa/types";

export const dynamic = "force-dynamic";

const SUBSIDIARY_CHANNELS = ["SUBSIDIARY", "BU", "DIRECT", "ROLE_GROUP"];
const KINDS = ["MESSAGE", "ANNOUNCEMENT", "REMINDER"];

interface MessageBody {
  kind?: string;
  channel?: string;
  subject?: string;
  body?: string;
  role?: string;
  buId?: string;
  userIds?: string[];
  period?: string;
  scheduledFor?: string;
}

const toRow = (m: {
  id: string; kind: string; channel: string; subject: string; body: string;
  audienceLabel: string; recipients: number; delivered: number; failed: number;
  readCount: number; status: string; scheduledFor: Date | null; sentBy: string;
  createdAt: Date;
}, origin: "group" | "subsidiary"): MessageRow => ({
  id: m.id, kind: m.kind, channel: m.channel, subject: m.subject, body: m.body,
  audienceLabel: m.audienceLabel, recipients: m.recipients, delivered: m.delivered,
  failed: m.failed, readCount: m.readCount, status: m.status,
  scheduledFor: m.scheduledFor?.toISOString() ?? null, sentBy: m.sentBy,
  createdAt: m.createdAt.toISOString(), origin,
});

export async function GET() {
  return saHandle(async () => {
    const ctx = await requireSubsidiaryAdmin();
    const sub = await getSubsidiaryOrThrow(ctx.subsidiaryId);
    const ownNames = [ctx.name, sub.adminName, sub.managerName].filter(Boolean);

    const [rows, groupAdmins] = await Promise.all([
      db.message.findMany({
        where: {
          OR: [
            { channel: { in: SUBSIDIARY_CHANNELS }, audienceFilter: { contains: ctx.subsidiaryId } },
            { channel: "GROUP_WIDE" },
            { sentBy: { in: ownNames } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      db.user.findMany({ where: { role: { in: ["GROUP_ADMIN", "ORG_MANAGER"] } }, select: { name: true } }),
    ]);
    const groupNames = new Set(groupAdmins.map((g) => g.name));

    const messages: MessageRow[] = [];
    for (const m of rows) {
      const filter = parseJson<{ subsidiaryId?: string }>(m.audienceFilter, {});
      const inScope = SUBSIDIARY_CHANNELS.includes(m.channel) && filter.subsidiaryId === ctx.subsidiaryId;
      const groupWide = m.channel === "GROUP_WIDE";
      const ownSend = ownNames.includes(m.sentBy);
      if (!inScope && !groupWide && !ownSend) continue;
      const origin: "group" | "subsidiary" = groupWide || groupNames.has(m.sentBy) ? "group" : "subsidiary";
      messages.push(toRow(m, origin));
    }
    return ok({ messages: messages.slice(0, 60) });
  });
}

export async function POST(req: NextRequest) {
  return saHandle(async () => {
    const ctx = await requireSubsidiaryAdmin();
    const sub = await getSubsidiaryOrThrow(ctx.subsidiaryId);
    const body = (await req.json().catch(() => ({}))) as MessageBody;

    const kind = (body.kind ?? "MESSAGE").trim().toUpperCase();
    if (!KINDS.includes(kind)) throw new SaError("Message kind must be MESSAGE, ANNOUNCEMENT or REMINDER.", 400);
    const channel = (body.channel ?? "").trim().toUpperCase();
    if (!SUBSIDIARY_CHANNELS.includes(channel)) {
      throw new SaError("Channel must be DIRECT, ROLE_GROUP, BU or SUBSIDIARY.", 400);
    }
    const subject = (body.subject ?? "").trim();
    if (!subject || subject.length > 150) throw new SaError("A subject of 1–150 characters is required.", 400);
    const text = (body.body ?? "").slice(0, 4000);

    /* ── recipients: computed strictly inside the subsidiary scope ────────── */
    let recipients: { id: string; name: string }[] = [];
    const audienceFilter: Record<string, unknown> = { subsidiaryId: ctx.subsidiaryId };
    let audienceLabel = "";

    if (channel === "DIRECT") {
      const ids = [...new Set((Array.isArray(body.userIds) ? body.userIds : []).map(String).filter(Boolean))];
      if (!ids.length) throw new SaError("Select at least one recipient for a direct message.", 400);
      for (const uid of ids) await assertUserInScope(uid, ctx.subsidiaryId);
      recipients = await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
      audienceFilter.userIds = ids;
      audienceLabel = `Direct · ${recipients.map((u) => u.name).join(", ")}`.slice(0, 120);
    } else if (channel === "ROLE_GROUP") {
      const role = (body.role ?? "").trim();
      if (!role || !ROLE_LABELS[role]) throw new SaError("Choose a valid role for this audience.", 400);
      let buName: string | null = null;
      if (body.buId) {
        const unit = await assertUnitInScope(body.buId, ctx.subsidiaryId);
        buName = unit.name;
        audienceFilter.businessUnitId = unit.id;
      }
      recipients = await db.user.findMany({
        where: { subsidiaryId: ctx.subsidiaryId, role, ...(body.buId ? { businessUnitId: body.buId } : {}) },
        select: { id: true, name: true },
      });
      audienceFilter.role = role;
      audienceLabel = `${ROLE_LABELS[role]}${buName ? ` · ${buName}` : ""}`;
    } else if (channel === "BU") {
      if (!body.buId) throw new SaError("Select the business unit for this audience.", 400);
      const unit = await assertUnitInScope(body.buId, ctx.subsidiaryId);
      recipients = await db.user.findMany({ where: { businessUnitId: unit.id }, select: { id: true, name: true } });
      audienceFilter.businessUnitId = unit.id;
      audienceLabel = `Business unit · ${unit.name}`;
    } else {
      recipients = await db.user.findMany({
        where: { subsidiaryId: ctx.subsidiaryId, status: "ACTIVE" },
        select: { id: true, name: true },
      });
      audienceLabel = `All users · ${sub.name}`;
    }
    if (!recipients.length) throw new SaError("No eligible recipients for this audience.", 400);

    /* ── send now or schedule ─────────────────────────────────────────────── */
    let status = "SENT";
    let delivered = recipients.length;
    let scheduledAt: Date | null = null;
    if (body.scheduledFor) {
      const d = new Date(body.scheduledFor);
      if (isNaN(d.getTime())) throw new SaError("Scheduled time is not a valid date.", 400);
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

    await saNotify({
      ntype: "MESSAGE", title: subject,
      body: status === "SCHEDULED"
        ? `Scheduled for ${scheduledAt!.toISOString()}: ${text.slice(0, 120)}`
        : text.slice(0, 140),
      subsidiaryId: ctx.subsidiaryId, linkView: "comms", refId: msg.id,
    });
    await saLogActivity(ctx, sub.name, {
      action: "COMM_SEND", targetType: "Message", targetLabel: subject,
    });
    await saLogAudit(ctx, sub.code, {
      action: "COMM_SEND", targetType: "Message", targetId: msg.id, targetLabel: subject,
      after: { kind, channel, audience: audienceLabel, recipients: recipients.length, status },
    });

    return ok({ message: toRow(msg, "subsidiary") }, { status: 201 });
  });
}
