"use client";

// ── SUBSIDIARY ADMIN · Communication Center ─────────────────────────────
// Announcements, reminders, role-group and direct messages. Every recipient
// list is resolved server-side inside the admin's own subsidiary scope —
// messages can never leak to another subsidiary.

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, CalendarClock, CheckCheck, Eye, Megaphone, Plus, Search,
  Send, Users,
} from "lucide-react";
import { Ring } from '@/components/ring'
import { MegaphoneIcon, ShieldIcon } from "@/components/workspace/premium-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  Avatar, Chip, EmptyState, ErrorState, Field, GlassCard, GlassDialog, GlassTabBar,
  KpiCard, LoadingBlock, PageHeader, SectionCard,
} from "@/components/workspace/ui";
import { REPORTING_YEARS, useSaWorkspace } from "@/lib/sa/store";
import { apiPost, fmtDateTime, timeAgo, useMutation, useSaApi } from "@/lib/sa/client";
import { ROLE_LABELS } from "@/lib/sa/types";
import type { MessageRow, UnitRow, UserRow } from "@/lib/sa/types";

type MessagesResp = { messages: MessageRow[] };
type UsersResp = { users: UserRow[]; total: number; roles: string[] };
type UnitsResp = { units: UnitRow[]; total: number };

const KIND_META: Record<string, { label: string; tone: "blue" | "purple" | "amber" }> = {
  MESSAGE: { label: "Message", tone: "blue" },
  ANNOUNCEMENT: { label: "Announcement", tone: "purple" },
  REMINDER: { label: "Reminder", tone: "amber" },
};

const CHANNEL_LABELS: Record<string, string> = {
  SUBSIDIARY: "Subsidiary-wide",
  BU: "Business unit",
  ROLE_GROUP: "Role group",
  DIRECT: "Direct",
  GROUP_WIDE: "Group-wide",
};

/* Roles that can be granted from a subsidiary workspace — fallback when the
   directory response has no roles facet yet. */
const FALLBACK_ROLES = [
  "SUBSIDIARY_MANAGER", "BU_MANAGER", "BU_ADMIN", "ENV_DATA_USER", "FIN_RESOURCE_USER",
  "HR_USER", "EHS_USER", "PROCUREMENT_USER", "CSR_USER", "COMPLIANCE_USER",
];

const emptyForm = {
  kind: "ANNOUNCEMENT",
  channel: "SUBSIDIARY",
  subject: "",
  body: "",
  role: "",
  buId: "",
  userIds: [] as string[],
  period: "",
  sendMode: "now",
  scheduledFor: "",
};

function MessageCard({ m }: { m: MessageRow }) {
  const kind = KIND_META[m.kind] ?? { label: m.kind, tone: "blue" as const };
  return (
    <GlassCard subtle className="p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip tone={kind.tone}>{kind.label}</Chip>
        <Chip tone="gray">{CHANNEL_LABELS[m.channel] ?? m.channel}</Chip>
        {m.origin === "group" && <Chip tone="purple">From Group Admin</Chip>}
        {m.status === "SCHEDULED" && <Chip tone="purple">Scheduled</Chip>}
        <span className="ml-auto text-[11px] text-[color:var(--ink-faint)]">{timeAgo(m.createdAt)}</span>
      </div>
      <h3 className="mt-2.5 text-[14.5px] font-semibold leading-snug text-[color:var(--ink)]">{m.subject}</h3>
      <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-[color:var(--ink-soft)]">{m.body}</p>
      <div className="mt-2 truncate text-[11.5px] text-[color:var(--ink-faint)]">To: {m.audienceLabel || "—"}</div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[rgba(125,177,216,0.25)] pt-2.5 text-[11.5px] font-medium text-[color:var(--ink-soft)]">
        <span className="flex items-center gap-1.5" title="Recipients">
          <Users className="h-3.5 w-3.5 text-[color:var(--esg-blue)]" /> {m.recipients}
        </span>
        <span className="flex items-center gap-1.5" title="Delivered">
          <CheckCheck className="h-3.5 w-3.5 text-[#238653]" /> {m.delivered}
        </span>
        {m.failed > 0 && (
          <span className="flex items-center gap-1.5 text-[#a53b3b]" title="Failed">
            <AlertTriangle className="h-3.5 w-3.5" /> {m.failed}
          </span>
        )}
        <span className="flex items-center gap-1.5" title="Read">
          <Eye className="h-3.5 w-3.5 text-[color:var(--esg-purple)]" /> {m.readCount}
        </span>
        <span className="ml-auto flex min-w-0 items-center gap-1.5">
          <Avatar name={m.sentBy} size={18} />
          <span className="truncate">{m.sentBy}</span>
        </span>
      </div>
      {m.status === "SCHEDULED" && m.scheduledFor && (
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[rgba(106,91,255,0.08)] px-3 py-2 text-[12px] text-[color:var(--ink-soft)]">
          <span className="flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5 text-[#6a5bff]" />
            Scheduled for <strong className="font-semibold">{fmtDateTime(m.scheduledFor)}</strong>
          </span>
          {/* Honest read-only: schedule cancellation is outside the SA API contract. */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} role="button" aria-disabled="true" className="inline-flex cursor-not-allowed rounded-2xl opacity-60">
                <Button variant="outline" size="sm" disabled className="glass-subtle h-8 rounded-2xl border-white/60 text-xs">
                  Cancel schedule
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-56 text-center">
              Cancellation is handled by the Group office for demo scope
            </TooltipContent>
          </Tooltip>
        </div>
      )}
    </GlassCard>
  );
}

export default function CommsView() {
  const { reportingYear } = useSaWorkspace();
  const { toast } = useToast();
  const { data, loading, error, refetch } = useSaApi<MessagesResp>("/api/sa/messages");

  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [userSearch, setUserSearch] = useState("");

  const sendMut = useMutation<{ message: MessageRow }>();

  useEffect(() => {
    if (sendMut.error) toast({ title: "Message not sent", description: sendMut.error, variant: "destructive" });
  }, [sendMut.error, toast]);

  const messages = data?.messages ?? [];

  /* audience directory — loaded only while the compose dialog is open */
  const composeNeedsUnits = form.channel === "BU" || form.channel === "ROLE_GROUP";
  const usersRes = useSaApi<UsersResp>(composeOpen ? "/api/sa/users?pageSize=50" : null);
  const unitsRes = useSaApi<UnitsResp>(composeOpen && composeNeedsUnits ? "/api/sa/units?pageSize=50" : null);
  const users = usersRes.data?.users ?? [];
  const units = unitsRes.data?.units ?? [];
  const roles = usersRes.data?.roles?.length ? usersRes.data.roles : FALLBACK_ROLES;

  const filteredDirectUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => `${u.name} ${u.email} ${u.roleLabel}`.toLowerCase().includes(q));
  }, [users, userSearch]);

  /* honest client-side audience estimate from the directory */
  const estimate = useMemo(() => {
    if (!composeOpen) return null;
    if (form.channel === "DIRECT") return form.userIds.length;
    if (usersRes.loading) return null;
    if (form.channel === "SUBSIDIARY") return users.filter((u) => u.status === "ACTIVE").length;
    if (form.channel === "BU") return form.buId ? users.filter((u) => u.buId === form.buId).length : null;
    if (form.channel === "ROLE_GROUP") {
      if (!form.role) return null;
      return users.filter((u) => u.role === form.role && (!form.buId || u.buId === form.buId)).length;
    }
    return null;
  }, [composeOpen, form, users, usersRes.loading]);

  const kpis = useMemo(() => {
    const recipients = messages.reduce((a, m) => a + m.recipients, 0);
    const reads = messages.reduce((a, m) => a + m.readCount, 0);
    return {
      sent: messages.filter((m) => m.status === "SENT").length,
      delivered: messages.reduce((a, m) => a + m.delivered, 0),
      scheduled: messages.filter((m) => m.status === "SCHEDULED").length,
      readRate: recipients > 0 ? Math.round((reads / recipients) * 100) : 0,
    };
  }, [messages]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return messages.filter((m) => {
      if (tab === "announcements" && m.kind !== "ANNOUNCEMENT") return false;
      if (tab === "reminders" && m.kind !== "REMINDER") return false;
      if (tab === "direct" && m.channel !== "DIRECT") return false;
      if (tab === "scheduled" && m.status !== "SCHEDULED") return false;
      if (q && ![m.subject, m.body, m.audienceLabel, m.sentBy].join(" ").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [messages, tab, search]);

  const set = (patch: Partial<typeof emptyForm>) => setForm((f) => ({ ...f, ...patch }));

  const openCompose = () => {
    setForm({ ...emptyForm, period: reportingYear });
    setErrors({});
    setUserSearch("");
    setComposeOpen(true);
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (form.subject.trim().length < 3) e.subject = "Subject is required (min 3 characters).";
    if (form.body.trim().length < 10) e.body = "Message body is required (min 10 characters).";
    if (form.channel === "BU" && !form.buId) e.buId = "Choose the business unit to address.";
    if (form.channel === "ROLE_GROUP" && !form.role) e.role = "Choose a role group.";
    if (form.channel === "DIRECT" && form.userIds.length === 0) e.userIds = "Select at least one recipient.";
    if (form.sendMode === "schedule") {
      if (!form.scheduledFor) e.scheduledFor = "Pick a date and time for the scheduled send.";
      else if (new Date(form.scheduledFor).getTime() <= Date.now()) e.scheduledFor = "Scheduled time must be in the future.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    const payload: Record<string, unknown> = {
      kind: form.kind,
      channel: form.channel,
      subject: form.subject.trim(),
      body: form.body.trim(),
      period: form.period || reportingYear,
    };
    if (form.channel === "BU") payload.buId = form.buId;
    if (form.channel === "ROLE_GROUP") {
      payload.role = form.role;
      if (form.buId) payload.buId = form.buId;
    }
    if (form.channel === "DIRECT") payload.userIds = form.userIds;
    if (form.sendMode === "schedule") payload.scheduledFor = new Date(form.scheduledFor).toISOString();

    const res = await sendMut.run(() => apiPost<{ message: MessageRow }>("/api/sa/messages", payload));
    if (!res) return; // failure toast handled by sendMut.error effect (server message verbatim)
    const m = res.message;
    toast({
      title: m.status === "SCHEDULED"
        ? "Message scheduled"
        : `Sent to ${m.recipients} recipient${m.recipients === 1 ? "" : "s"}`,
      description: m.status === "SCHEDULED"
        ? `${m.subject} — will be delivered ${fmtDateTime(m.scheduledFor)}`
        : m.subject,
    });
    setComposeOpen(false);
    refetch();
  };

  if (loading && !data) return <div className="view-in space-y-4 pb-6"><LoadingBlock rows={6} label="Loading communication center…" /></div>;
  if (error && !data) return <div className="view-in space-y-4 pb-6"><ErrorState message={error} onRetry={refetch} /></div>;
  if (!data) return null;

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="Communication Center"
        description={`${reportingYear} · Announcements, reminders, role-group and direct messages to your subsidiary audience.`}
        icon={MegaphoneIcon}
        actions={
          <Button className="btn-action" onClick={openCompose}>
            <Plus className="mr-1.5 h-4 w-4" /> New message
          </Button>
        }
      />

      {/* scope banner */}
      <GlassCard subtle className="flex flex-wrap items-center gap-3 p-3.5">
        <ShieldIcon className="h-4.5 w-4.5 shrink-0 text-[#238653]" />
        <p className="min-w-0 flex-1 text-[12.5px] font-medium text-[color:var(--ink-soft)]">
          Messages never leave your subsidiary — recipient resolution is enforced server-side.
        </p>
        <Chip tone="green">Scoped delivery</Chip>
      </GlassCard>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard label="Total sent" value={kpis.sent} icon={Send} tone="blue" hint={`${messages.length} messages in history`} />
        <KpiCard label="Delivered" value={kpis.delivered} icon={CheckCheck} tone="green" hint="In-app deliveries confirmed" />
        <KpiCard label="Scheduled" value={kpis.scheduled} icon={CalendarClock} tone="purple" hint="Queued for future delivery" />
        <KpiCard label="Read rate" value={`${kpis.readRate}%`} icon={Eye} tone="amber" hint="Read count ÷ recipients" />
      </div>

      {/* history */}
      <SectionCard
        title="Message history"
        description="Group announcements plus everything sent from this workspace"
        icon={Megaphone}
      >
        <div className="flex flex-col gap-3">
          <GlassTabBar
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "all", label: "All", count: messages.length },
              { value: "announcements", label: "Announcements", count: messages.filter((m) => m.kind === "ANNOUNCEMENT").length },
              { value: "reminders", label: "Reminders", count: messages.filter((m) => m.kind === "REMINDER").length },
              { value: "direct", label: "Direct", count: messages.filter((m) => m.channel === "DIRECT").length },
              { value: "scheduled", label: "Scheduled", count: messages.filter((m) => m.status === "SCHEDULED").length },
            ]}
          />
          <div className="relative max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--ink-faint)]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search subject, body, audience…"
              className="glass-subtle h-10 rounded-2xl border-white/60 pl-9 text-sm"
              aria-label="Search messages"
            />
          </div>
          <div className="flex flex-col gap-3">
            {filtered.length === 0 ? (
              <EmptyState
                title="No messages here"
                message={search ? "Nothing matches your search — try a different term." : "Compose your first announcement, reminder or direct message."}
                icon={Megaphone}
                action={
                  <Button className="btn-action" onClick={openCompose}>
                    <Plus className="mr-1.5 h-4 w-4" /> New message
                  </Button>
                }
              />
            ) : (
              filtered.map((m) => <MessageCard key={m.id} m={m} />)
            )}
          </div>
        </div>
      </SectionCard>

      {/* compose dialog */}
      <GlassDialog
        open={composeOpen}
        onOpenChange={(o) => { if (!o) setComposeOpen(false); }}
        wide
        title="New message"
        description="Recipients are resolved inside your subsidiary only."
        footer={
          <>
            <Button variant="outline" className="glass-subtle rounded-2xl border-white/60" onClick={() => setComposeOpen(false)} disabled={sendMut.pending}>
              Cancel
            </Button>
            <Button className="btn-action rounded-2xl" onClick={submit} disabled={sendMut.pending}>
              {sendMut.pending && <Ring className="mr-1.5 h-4 w-4" />}
              {form.sendMode === "schedule" ? "Schedule message" : "Send now"}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Message kind" required>
            <Select value={form.kind} onValueChange={(v) => set({ kind: v })}>
              <SelectTrigger className="glass-subtle rounded-2xl border-white/60 text-sm" aria-label="Message kind"><SelectValue /></SelectTrigger>
              <SelectContent className="glass-strong rounded-2xl border-white/70">
                <SelectItem value="MESSAGE">Message</SelectItem>
                <SelectItem value="ANNOUNCEMENT">Announcement</SelectItem>
                <SelectItem value="REMINDER">Reminder</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Channel / audience" required>
            <Select value={form.channel} onValueChange={(v) => set({ channel: v, buId: "", role: "", userIds: [] })}>
              <SelectTrigger className="glass-subtle rounded-2xl border-white/60 text-sm" aria-label="Channel"><SelectValue /></SelectTrigger>
              <SelectContent className="glass-strong rounded-2xl border-white/70">
                <SelectItem value="SUBSIDIARY">Subsidiary-wide</SelectItem>
                <SelectItem value="BU">Business unit</SelectItem>
                <SelectItem value="ROLE_GROUP">Role group</SelectItem>
                <SelectItem value="DIRECT">Direct</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        {/* dynamic audience controls */}
        {form.channel === "SUBSIDIARY" && (
          <div className="glass-subtle mt-4 flex items-start gap-2.5 rounded-2xl p-3.5 text-[12.5px] font-medium text-[color:var(--ink-soft)]">
            <Users className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--esg-blue)]" />
            All active users in your subsidiary will receive this message.
          </div>
        )}

        {form.channel === "BU" && (
          <div className="mt-4">
            <Field label="Business unit" required error={errors.buId}>
              <Select value={form.buId || undefined} onValueChange={(v) => set({ buId: v })}>
                <SelectTrigger className="glass-subtle rounded-2xl border-white/60 text-sm" aria-label="Business unit">
                  <SelectValue placeholder={unitsRes.loading ? "Loading business units…" : "Choose a business unit"} />
                </SelectTrigger>
                <SelectContent className="glass-strong max-h-64 rounded-2xl border-white/70">
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        )}

        {form.channel === "ROLE_GROUP" && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Role group" required error={errors.role}>
              <Select value={form.role || undefined} onValueChange={(v) => set({ role: v })}>
                <SelectTrigger className="glass-subtle rounded-2xl border-white/60 text-sm" aria-label="Role group">
                  <SelectValue placeholder="Choose a role" />
                </SelectTrigger>
                <SelectContent className="glass-strong max-h-64 rounded-2xl border-white/70">
                  {roles.map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABELS[r] ?? r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Limit to business unit" hint="Optional — “Any” covers the whole subsidiary.">
              <Select value={form.buId || "ANY"} onValueChange={(v) => set({ buId: v === "ANY" ? "" : v })}>
                <SelectTrigger className="glass-subtle rounded-2xl border-white/60 text-sm" aria-label="Business unit filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-strong max-h-64 rounded-2xl border-white/70">
                  <SelectItem value="ANY">Any business unit</SelectItem>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        )}

        {form.channel === "DIRECT" && (
          <div className="mt-4">
            <Field
              label={`Direct recipients${form.userIds.length ? ` — ${form.userIds.length} selected` : ""}`}
              required
              error={errors.userIds}
            >
              <div className="glass-subtle rounded-2xl border-white/60 p-2.5">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--ink-faint)]" />
                  <Input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search users by name, email or role…"
                    className="glass-subtle h-9 rounded-xl border-white/60 pl-9 text-[13px]"
                    aria-label="Search direct recipients"
                  />
                </div>
                <div className="nice-scroll mt-2 max-h-48 space-y-0.5 overflow-y-auto">
                  {usersRes.loading && <p className="px-2 py-3 text-xs text-[color:var(--ink-faint)]">Loading your user directory…</p>}
                  {!usersRes.loading && filteredDirectUsers.length === 0 && (
                    <p className="px-2 py-3 text-xs text-[color:var(--ink-faint)]">No users match “{userSearch}”.</p>
                  )}
                  {filteredDirectUsers.map((u) => (
                    <label key={u.id} className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-white/70">
                      <Checkbox
                        checked={form.userIds.includes(u.id)}
                        onCheckedChange={(c) =>
                          set({ userIds: c === true ? [...form.userIds, u.id] : form.userIds.filter((id) => id !== u.id) })
                        }
                        aria-label={`Select ${u.name}`}
                      />
                      <Avatar name={u.name} size={24} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-[color:var(--ink)]">{u.name}</span>
                        <span className="block truncate text-[10.5px] text-[color:var(--ink-faint)]">
                          {u.roleLabel}{u.buName ? ` · ${u.buName}` : ""}
                        </span>
                      </span>
                      <Chip tone={u.status === "ACTIVE" ? "green" : "gray"}>{u.status.toLowerCase()}</Chip>
                    </label>
                  ))}
                </div>
              </div>
            </Field>
          </div>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Related reporting period">
            <Select value={form.period || reportingYear} onValueChange={(v) => set({ period: v })}>
              <SelectTrigger className="glass-subtle rounded-2xl border-white/60 text-sm" aria-label="Reporting period"><SelectValue /></SelectTrigger>
              <SelectContent className="glass-strong rounded-2xl border-white/70">
                {REPORTING_YEARS.map((y) => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Delivery" required>
            <RadioGroup value={form.sendMode} onValueChange={(v) => set({ sendMode: v })} className="flex gap-5 pt-1.5">
              <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-[color:var(--ink)]">
                <RadioGroupItem value="now" /> Send now
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-[color:var(--ink)]">
                <RadioGroupItem value="schedule" /> Schedule
              </label>
            </RadioGroup>
          </Field>
        </div>

        {form.sendMode === "schedule" && (
          <div className="mt-4">
            <Field label="Scheduled date & time" required error={errors.scheduledFor} hint="Delivery happens automatically at this time.">
              <Input
                type="datetime-local"
                value={form.scheduledFor}
                onChange={(e) => set({ scheduledFor: e.target.value })}
                className="glass-subtle rounded-2xl border-white/60 text-sm"
                aria-label="Scheduled date and time"
              />
            </Field>
          </div>
        )}

        <div className="mt-4">
          <Field label="Subject" required error={errors.subject}>
            <Input
              value={form.subject}
              onChange={(e) => set({ subject: e.target.value })}
              placeholder="e.g. FY 2025-26 quarterly data due Friday"
              className="glass-subtle rounded-2xl border-white/60 text-sm"
            />
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Message body" required error={errors.body}>
            <Textarea
              value={form.body}
              onChange={(e) => set({ body: e.target.value })}
              rows={5}
              placeholder="Write the message your audience will read in their notifications…"
              className="glass-subtle rounded-2xl border-white/60 text-sm"
            />
          </Field>
        </div>

        {/* live audience preview — honest client-side estimate */}
        <div className="glass mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl p-3.5">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">Estimated audience</div>
            <div className="mt-0.5 text-[13px] font-semibold text-[color:var(--ink)]">
              {estimate === null
                ? usersRes.loading && form.channel !== "DIRECT"
                  ? "Counting your directory…"
                  : "Choose an audience to estimate recipients"
                : `≈ ${estimate} recipient${estimate === 1 ? "" : "s"}`}
            </div>
          </div>
          <Chip tone="blue">Client-side estimate · the server confirms on send</Chip>
        </div>
      </GlassDialog>
    </div>
  );
}
