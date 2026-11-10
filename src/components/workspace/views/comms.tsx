"use client";

// ── SCREEN 12 — Communication Center (ESG Operations) ──
import { useMemo, useState } from "react";
import {
  Bell,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Eye,
  Info,
  Mail,
  Megaphone,
  MessageSquare,
  Scale,
  Send,
  Users as UsersIcon,
  XCircle,
} from "lucide-react";
import { Ring } from '@/components/ring'
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { DATA_ENTRY_ROLES, ROLE_LABELS, type Message } from "@/lib/esg/types";
import { apiPost, fmtDateTime, fmtNumber, timeAgo, useApi, useMutation } from "@/lib/esg/client";
import { useWorkspace } from "@/lib/esg/store";
import {
  ActionButton,
  Chip,
  EmptyState,
  Field,
  GlassCard,
  GlassDialog,
  GlassTabBar,
  LoadingBlock,
  PageHeader,
  StatusBadge,
} from "@/components/workspace/ui";

const KIND_META: Record<string, { label: string; tone: "blue" | "amber" | "purple" | "teal"; icon: React.ComponentType<{ className?: string }> }> = {
  ANNOUNCEMENT: { label: "Announcement", tone: "blue", icon: Megaphone },
  REMINDER: { label: "Reminder", tone: "amber", icon: Bell },
  POLICY: { label: "Policy", tone: "purple", icon: Scale },
  MESSAGE: { label: "Direct message", tone: "teal", icon: MessageSquare },
};

const CHANNEL_LABELS: Record<string, string> = {
  GROUP_WIDE: "Group-wide",
  ROLE_GROUP: "Role group",
  SUBSIDIARY: "Subsidiary",
  DIRECT: "Direct",
};

const ELIGIBLE_ROLES = [...DATA_ENTRY_ROLES, "BU_MANAGER", "BU_ADMIN", "SUBSIDIARY_ADMIN", "SUBSIDIARY_MANAGER"];

const KINDS = ["ANNOUNCEMENT", "REMINDER", "POLICY", "MESSAGE"] as const;
const CHANNELS = ["GROUP_WIDE", "ROLE_GROUP", "SUBSIDIARY", "DIRECT"] as const;
type Channel = (typeof CHANNELS)[number];

interface SendResponse {
  message: Message;
  audience: { count: number; label: string };
  deliveryNote?: string;
}

export default function CommsView() {
  const { params } = useWorkspace();
  const { toast } = useToast();
  const autoCreate = params.create !== undefined;

  const messagesApi = useApi<{ messages: Message[] }>("/api/esg/messages");
  const usersApi = useApi<{ users: { id: string; role: string; subsidiaryId: string | null; status: string }[] }>("/api/esg/users");
  const subsApi = useApi<{ subsidiaries: { id: string; name: string }[] }>("/api/esg/org?type=subsidiaries&light=1");

  const [tab, setTab] = useState("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Auto-open the compose dialog when navigated with params.create (dialog mounts open).
  const [composeOpen, setComposeOpen] = useState(autoCreate);
  const [form, setForm] = useState({
    kind: "ANNOUNCEMENT",
    channel: "GROUP_WIDE" as Channel,
    role: "NONE",
    subsidiaryId: "NONE",
    subject: "",
    body: "",
  });
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduledFor, setScheduledFor] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const sendMut = useMutation<SendResponse>();

  const all = messagesApi.data?.messages ?? [];
  const users = usersApi.data?.users ?? [];

  const filtered = useMemo(() => {
    return all.filter((m) => {
      if (tab === "ALL") return true;
      if (tab === "SCHEDULED") return m.status === "SCHEDULED";
      if (tab === "DIRECT") return m.channel === "DIRECT";
      return m.kind === tab;
    });
  }, [all, tab]);

  /* Audience preview (client-side, mirrors server computation) */
  const audiencePreview = useMemo((): { count: number; label: string } => {
    switch (form.channel) {
      case "GROUP_WIDE":
        return { count: users.filter((u) => ELIGIBLE_ROLES.includes(u.role)).length, label: "All eligible reporting users" };
      case "ROLE_GROUP":
        if (form.role === "NONE") return { count: 0, label: "Select a role group" };
        return { count: users.filter((u) => u.role === form.role).length, label: `${ROLE_LABELS[form.role] ?? form.role} role group` };
      case "SUBSIDIARY":
        if (form.subsidiaryId === "NONE") return { count: 0, label: "Select a subsidiary" };
        return {
          count: users.filter((u) => u.subsidiaryId === form.subsidiaryId).length,
          label: (subsApi.data?.subsidiaries ?? []).find((s) => s.id === form.subsidiaryId)?.name ?? "Subsidiary",
        };
      case "DIRECT":
        return { count: 1, label: "Direct message" };
    }
  }, [form.channel, form.role, form.subsidiaryId, users, subsApi.data]);

  const openCompose = () => {
    setFormErrors({});
    setForm({ kind: "ANNOUNCEMENT", channel: "GROUP_WIDE", role: "NONE", subsidiaryId: "NONE", subject: "", body: "" });
    setScheduleMode(false);
    setScheduledFor("");
    setComposeOpen(true);
  };

  const submit = async (status: "SENT" | "SCHEDULED") => {
    const e: Record<string, string> = {};
    if (form.subject.trim().length < 3) e.subject = "Subject must be at least 3 characters.";
    if (form.body.trim().length < 10) e.body = "Message body must be at least 10 characters.";
    if (form.channel === "ROLE_GROUP" && form.role === "NONE") e.role = "Select a role group.";
    if (form.channel === "SUBSIDIARY" && form.subsidiaryId === "NONE") e.subsidiaryId = "Select a subsidiary.";
    if (status === "SCHEDULED" && !scheduledFor) e.scheduledFor = "Pick a schedule date/time.";
    setFormErrors(e);
    if (Object.keys(e).length) return;

    const res = await sendMut.run(() =>
      apiPost<SendResponse>("/api/esg/messages", {
        subject: form.subject.trim(),
        body: form.body.trim(),
        kind: form.kind,
        channel: form.channel,
        role: form.channel === "ROLE_GROUP" ? form.role : undefined,
        subsidiaryId: form.channel === "SUBSIDIARY" ? form.subsidiaryId : undefined,
        status,
        scheduledFor: status === "SCHEDULED" ? new Date(scheduledFor).toISOString() : undefined,
      })
    );
    if (res) {
      if (status === "SENT") {
        toast({
          title: `Sent to ${res.audience.count} recipient${res.audience.count === 1 ? "" : "s"}`,
          description: res.deliveryNote ?? "Delivered via in-app notifications.",
        });
      } else {
        toast({
          title: "Communication scheduled",
          description: `Will be sent to ${res.audience.count} recipient${res.audience.count === 1 ? "" : "s"} (${res.audience.label}) on ${fmtDateTime(scheduledFor)}.`,
        });
      }
      setComposeOpen(false);
      await messagesApi.refetch();
    } else {
      toast({ title: "Send failed", description: sendMut.error ?? "Server rejected the communication.", variant: "destructive" });
    }
  };

  const tabCounts = useMemo(
    () => ({
      ALL: all.length,
      ANNOUNCEMENT: all.filter((m) => m.kind === "ANNOUNCEMENT").length,
      REMINDER: all.filter((m) => m.kind === "REMINDER").length,
      POLICY: all.filter((m) => m.kind === "POLICY").length,
      DIRECT: all.filter((m) => m.channel === "DIRECT").length,
      SCHEDULED: all.filter((m) => m.status === "SCHEDULED").length,
    }),
    [all]
  );

  return (
    <div className="view-in space-y-5">
      <PageHeader
        title="Communication Center"
        description="Announcements, reminders, policy notices, and role-group communications to the organization."
        icon={Megaphone}
        breadcrumbs={["Group", "ESG Operations", "Communication Center"]}
        actions={
          <ActionButton onClick={openCompose}>
            <Send className="mr-1.5 h-4 w-4" /> New communication
          </ActionButton>
        }
      />

      {/* Honesty note */}
      <div className="glass-subtle flex items-start gap-3 rounded-2xl border-[rgba(197,121,38,0.3)] px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#9c5d1b]" />
        <p className="text-[13px] leading-relaxed text-[color:var(--ink-soft)]">
          Email provider is not configured — communications are delivered as in-app notifications. Configure under Settings → Integrations.
        </p>
      </div>

      <GlassTabBar
        value={tab}
        onChange={setTab}
        className="w-fit max-w-full"
        tabs={[
          { value: "ALL", label: "All", count: tabCounts.ALL },
          { value: "ANNOUNCEMENT", label: "Announcements", count: tabCounts.ANNOUNCEMENT },
          { value: "REMINDER", label: "Reminders", count: tabCounts.REMINDER },
          { value: "POLICY", label: "Policy", count: tabCounts.POLICY },
          { value: "DIRECT", label: "Direct", count: tabCounts.DIRECT },
          { value: "SCHEDULED", label: "Scheduled", count: tabCounts.SCHEDULED },
        ]}
      />

      {messagesApi.loading ? (
        <GlassCard><LoadingBlock rows={5} label="Loading communications…" /></GlassCard>
      ) : messagesApi.error ? (
        <GlassCard>
          <EmptyState
            title="Could not load communications"
            message={messagesApi.error}
            action={<Button variant="outline" className="glass-subtle rounded-2xl" onClick={() => void messagesApi.refetch()}>Try again</Button>}
          />
        </GlassCard>
      ) : filtered.length === 0 ? (
        <GlassCard>
          <EmptyState
            title="No communications here yet"
            message="Compose an announcement, reminder, or policy notice to keep the organization aligned."
            action={<Button className="rounded-2xl" onClick={openCompose}><Send className="mr-1.5 h-4 w-4" /> New communication</Button>}
          />
        </GlassCard>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((m) => {
            const meta = KIND_META[m.kind] ?? KIND_META.MESSAGE;
            const Icon = meta.icon;
            const expanded = expandedId === m.id;
            return (
              <GlassCard
                key={m.id}
                className={cn("cursor-pointer p-4 transition-all sm:p-5", expanded && "glass-strong")}
                onClick={() => setExpandedId(expanded ? null : m.id)}
                role="button"
                aria-expanded={expanded}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="glass-subtle flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl">
                      <Icon className="h-4.5 w-4.5 text-[color:var(--esg-blue)]" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Chip tone={meta.tone}>{meta.label}</Chip>
                        <Chip tone="gray">{CHANNEL_LABELS[m.channel] ?? m.channel}</Chip>
                        <StatusBadge status={m.status} />
                      </div>
                      <h3 className="mt-1.5 truncate text-[15px] font-semibold text-[color:var(--ink)]">{m.subject}</h3>
                      <p className={cn("mt-0.5 text-[13px] leading-relaxed text-[color:var(--ink-soft)]", expanded ? "" : "line-clamp-2")}>{m.body}</p>
                    </div>
                  </div>
                  <ChevronDown className={cn("mt-1 h-4 w-4 shrink-0 text-[color:var(--ink-faint)] transition-transform", expanded && "rotate-180")} />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[rgba(125,177,216,0.18)] pt-3 text-xs text-[color:var(--ink-faint)]">
                  <span className="inline-flex items-center gap-1.5">
                    <UsersIcon className="h-3.5 w-3.5" />
                    <span className="tabular font-medium text-[color:var(--ink-soft)]">{fmtNumber(m.recipients)}</span> {m.audienceLabel}
                  </span>
                  {m.status === "SENT" ? (
                    <>
                      <span className="inline-flex items-center gap-1.5 tabular"><CheckCircle2 className="h-3.5 w-3.5 text-[#238653]" /> {fmtNumber(m.delivered)} delivered</span>
                      <span className="inline-flex items-center gap-1.5 tabular"><XCircle className={cn("h-3.5 w-3.5", m.failed > 0 ? "text-[#c34a4a]" : "text-[color:var(--ink-faint)]")} /> {fmtNumber(m.failed)} failed</span>
                      <span className="inline-flex items-center gap-1.5 tabular"><Eye className="h-3.5 w-3.5" /> {fmtNumber(m.readCount)} read</span>
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">Scheduled for {fmtDateTime(m.scheduledFor)}</span>
                  )}
                  <span className="ml-auto inline-flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" /> {m.sentBy} · {timeAgo(m.createdAt)}
                  </span>
                </div>

                {expanded && (
                  <div className="mt-3 rounded-2xl bg-[rgba(197,121,38,0.08)] px-3.5 py-2.5 text-[12px] leading-relaxed text-[#9c5d1b]" onClick={(e) => e.stopPropagation()}>
                    In-app delivery only — the email provider is not configured in this environment (Settings → Integrations).
                    {m.status === "SCHEDULED" && " This communication is queued and has not been delivered yet."}
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* Compose dialog */}
      <GlassDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        title="New communication"
        description="Compose a group-wide announcement, role-group notice, subsidiary update, or direct message."
        wide
        footer={
          <>
            {scheduleMode ? (
              <>
                <Button variant="outline" className="glass-subtle rounded-2xl" onClick={() => setScheduleMode(false)} disabled={sendMut.pending}>Send instead</Button>
                <Button variant="outline" className="glass-subtle rounded-2xl border-white/60" disabled={sendMut.pending} onClick={() => void submit("SCHEDULED")}>
                  {sendMut.pending ? <Ring className="mr-1.5 h-3.5 w-3.5" /> : <CalendarClock className="mr-1.5 h-3.5 w-3.5" />} Schedule
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" className="glass-subtle rounded-2xl" onClick={() => setScheduleMode(true)} disabled={sendMut.pending}>Schedule</Button>
                <ActionButton pending={sendMut.pending} onClick={() => void submit("SENT")}>
                  <Send className="mr-1.5 h-4 w-4" /> Send now
                </ActionButton>
              </>
            )}
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kind">
            <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
              <SelectTrigger className="glass-subtle rounded-2xl border-white/60"><SelectValue /></SelectTrigger>
              <SelectContent className="glass-strong rounded-2xl border-white/70">
                {KINDS.map((k) => (
                  <SelectItem key={k} value={k}>{KIND_META[k].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Channel">
            <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v as Channel, role: "NONE", subsidiaryId: "NONE" })}>
              <SelectTrigger className="glass-subtle rounded-2xl border-white/60"><SelectValue /></SelectTrigger>
              <SelectContent className="glass-strong rounded-2xl border-white/70">
                {CHANNELS.map((c) => (
                  <SelectItem key={c} value={c}>{CHANNEL_LABELS[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {form.channel === "ROLE_GROUP" && (
            <Field label="Role group" required error={formErrors.role}>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger className="glass-subtle rounded-2xl border-white/60"><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent className="glass-strong rounded-2xl border-white/70">
                  <SelectItem value="NONE" disabled>Select role…</SelectItem>
                  {Object.keys(ROLE_LABELS).map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          {form.channel === "SUBSIDIARY" && (
            <Field label="Subsidiary" required error={formErrors.subsidiaryId}>
              <Select value={form.subsidiaryId} onValueChange={(v) => setForm({ ...form, subsidiaryId: v })}>
                <SelectTrigger className="glass-subtle rounded-2xl border-white/60"><SelectValue placeholder="Select subsidiary" /></SelectTrigger>
                <SelectContent className="glass-strong rounded-2xl border-white/70">
                  <SelectItem value="NONE" disabled>Select subsidiary…</SelectItem>
                  {(subsApi.data?.subsidiaries ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          {form.channel === "DIRECT" && (
            <Field label="Direct message" hint="Direct messages are delivered to the addressed user's in-app inbox.">
              <div className="glass-subtle flex h-10 items-center rounded-2xl border border-white/60 px-3 text-sm text-[color:var(--ink-soft)]">1 recipient</div>
            </Field>
          )}
          <div className="sm:col-span-2">
            <Field label="Subject" required error={formErrors.subject}>
              <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="glass-subtle rounded-2xl border-white/60" placeholder="e.g. Q2 BRSR data collection opens Monday" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Message body" required error={formErrors.body}>
              <Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={5} className="glass-subtle rounded-2xl border-white/60" placeholder="Write the communication…" />
            </Field>
          </div>
          {scheduleMode && (
            <div className="sm:col-span-2">
              <Field label="Schedule for" required error={formErrors.scheduledFor}>
                <Input type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} className="glass-subtle rounded-2xl border-white/60" />
              </Field>
            </div>
          )}
          {/* Audience preview */}
          <div className="glass-subtle rounded-2xl border-white/60 p-4 sm:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[rgba(58,123,255,0.12)]">
                  <UsersIcon className="h-4 w-4 text-[#1d5fd6]" />
                </span>
                <div>
                  <div className="text-[13px] font-medium text-[color:var(--ink)]">Audience preview</div>
                  <div className="text-xs text-[color:var(--ink-faint)]">{audiencePreview.label}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="tabular text-2xl font-semibold text-[color:var(--ink)]">{audiencePreview.count}</div>
                <div className="text-[11px] text-[color:var(--ink-faint)]">recipients</div>
              </div>
            </div>
          </div>
        </div>
      </GlassDialog>
    </div>
  );
}
