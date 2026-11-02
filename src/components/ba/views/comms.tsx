"use client";

// ── BU ADMIN · SCREEN 11 — Communication Center ──
// Project-specific discussions, announcements, reminder composer.
// Recipient selection is restricted to authorized BU users.

import { useEffect, useMemo, useState } from "react";
import {
  Megaphone, Send, Users,
} from "lucide-react";
import { MegaphoneIcon } from "@/components/workspace/premium-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBaApi, apiPost, fmtDateTime, timeAgo } from "@/lib/ba/client";
import { useBaWorkspace } from "@/lib/ba/store";
import type { MessageRow, BaCommsData } from "@/lib/ba/types";
import {
  Chip, EmptyState, ErrorState, GlassDialog, GlassTabBar, LoadingBlock, PageHeader, SectionCard, StatusBadge, type Column,
} from "@/components/workspace/ui";
import { DataTable } from "@/components/workspace/ui";
import { useToast } from "@/hooks/use-toast";

type Tab = "messages" | "announcements" | "reminders";

export default function CommsView() {
  const { params, navigate } = useBaWorkspace();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("messages");
  const [composeOpen, setComposeOpen] = useState<boolean>(() => !!params.compose);

  /* consume the deep-link once — the compose flag only seeds initial state */
  useEffect(() => {
    if (params.compose) {
      navigate("comms", { ...params, compose: undefined });
    }
  }, []);

  const { data, loading, error, refetch } = useBaApi<BaCommsData>("/api/ba/comms");
  const recipients = data?.recipients ?? [];
  const rows = tab === "messages" ? (data?.messages ?? []) : tab === "announcements" ? (data?.announcements ?? []) : (data?.reminders ?? []);

  const columns: Column<MessageRow>[] = [
    { key: "subject", header: "Subject", sortable: true, sortValue: (r) => r.subject, render: (r) => <div className="min-w-0"><div className="truncate text-[13px] font-semibold text-[color:var(--ink)]">{r.subject}</div><div className="truncate text-[11px] text-[color:var(--ink-faint)]">{r.audienceLabel}</div></div> },
    { key: "sentBy", header: "Sent by", sortable: true, sortValue: (r) => r.sentBy, render: (r) => <span className="text-[12px] text-[color:var(--ink-soft)]">{r.sentBy}</span> },
    { key: "recipients", header: "Recipients", sortable: true, sortValue: (r) => r.recipients, render: (r) => <span className="tabular text-[12px] text-[color:var(--ink-soft)]">{r.recipients}</span> },
    { key: "delivered", header: "Delivered", render: (r) => <span className="tabular text-[12px] text-[color:var(--ink-soft)]">{r.delivered} / {r.recipients}</span> },
    { key: "createdAt", header: "Sent", sortable: true, sortValue: (r) => r.createdAt, render: (r) => <div className="text-[12px] text-[color:var(--ink-soft)]">{timeAgo(r.createdAt)}<div className="text-[10.5px] text-[color:var(--ink-faint)]">{fmtDateTime(r.createdAt)}</div></div> },
    { key: "status", header: "Status", sortable: true, sortValue: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="Communication Center"
        description="Project-specific discussions, announcements, and reminder composer. Recipients are restricted to authorized BU users."
        icon={MegaphoneIcon}
        actions={
          <Button className="btn-ba-action rounded-2xl" onClick={() => setComposeOpen(true)}>
            <Send className="mr-1.5 h-4 w-4" /> Compose
          </Button>
        }
      />

      <GlassTabBar
        tabs={[
          { value: "messages", label: "Messages", count: data?.messages?.length ?? 0 },
          { value: "announcements", label: "Announcements", count: data?.announcements?.length ?? 0 },
          { value: "reminders", label: "Reminders", count: data?.reminders?.length ?? 0 },
        ]}
        value={tab}
        onChange={(v) => setTab(v as Tab)}
      />

      {loading && !data ? <LoadingBlock rows={5} /> : error && !data ? <ErrorState message={error} onRetry={refetch} /> : rows.length === 0 ? (
        <SectionCard title="Nothing here yet"><EmptyState title={`No ${tab} yet`} message="Compose a message to start a conversation with your BU contributors." /></SectionCard>
      ) : (
        <DataTable<MessageRow>
          columns={columns}
          rows={rows}
          pageSize={10}
          onRowClick={(r) => toast({ title: r.subject, description: r.body.slice(0, 160) })}
          mobileCard={(r) => (
            <div className="flex flex-col gap-2 p-3">
              <div className="flex items-start justify-between"><div className="min-w-0"><div className="truncate text-[13px] font-semibold">{r.subject}</div><div className="text-[11px] text-[color:var(--ink-faint)]">{r.audienceLabel}</div></div><StatusBadge status={r.status} /></div>
              <div className="text-[11px] text-[color:var(--ink-faint)]">{r.sentBy} · {timeAgo(r.createdAt)} · {r.delivered}/{r.recipients} delivered</div>
            </div>
          )}
        />
      )}

      {/* Recipients directory */}
      <SectionCard title="BU recipients" description="Authorized users you can reach from this workspace" icon={Users}>
        {recipients.length === 0 ? <EmptyState title="No recipients" /> : (
          <div className="flex flex-wrap gap-2">
            {recipients.map((r) => <Chip key={r.id} tone="blue">{r.name} · {r.roleLabel}{r.projectName ? ` · ${r.projectName}` : ""}</Chip>)}
          </div>
        )}
      </SectionCard>

      <ComposeDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        recipients={recipients}
        onSent={() => { setComposeOpen(false); refetch(); toast({ title: "Message sent", description: "Cross-console broadcast delivered." }); }}
      />
    </div>
  );
}

function ComposeDialog({ open, onOpenChange, recipients, onSent }: { open: boolean; onOpenChange: (o: boolean) => void; recipients: { id: string; name: string; role: string; roleLabel: string; projectName: string | null }[]; onSent: () => void }) {
  const { toast } = useToast();
  const [kind, setKind] = useState<"MESSAGE" | "ANNOUNCEMENT" | "REMINDER">("MESSAGE");
  const [channel, setChannel] = useState<"DIRECT" | "ROLE_GROUP" | "PROJECT">("DIRECT");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [userIds, setUserIds] = useState<string[]>([]);
  const [role, setRole] = useState("");
  const [projectId, setProjectId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const { params } = useBaWorkspace();

  useEffect(() => {
    if (open) {
      setKind("MESSAGE"); setChannel("DIRECT"); setSubject(params.subject as string ?? ""); setBody(""); setUserIds([]);
      setRole(""); setProjectId(""); setErr(null);
      void fetch("/api/ba/projects?pageSize=50").then((r) => r.json()).then((d: { projects: { id: string; name: string }[] }) => setProjects(d.projects ?? []));
    }
     
  }, [open]);

  const roles = useMemo(() => [...new Set(recipients.map((r) => r.role))], [recipients]);

  const submit = async () => {
    if (!subject.trim()) return setErr("A subject is required.");
    if (body.trim().length < 4) return setErr("Message body is too short.");
    if (channel === "DIRECT" && userIds.length === 0) return setErr("Select at least one recipient.");
    if (channel === "ROLE_GROUP" && !role) return setErr("Choose a role group.");
    if (channel === "PROJECT" && !projectId) return setErr("Choose a project.");
    setPending(true);
    try {
      await apiPost("/api/ba/comms", {
        kind, channel, subject: subject.trim(), body: body.trim(),
        userIds: channel === "DIRECT" ? userIds : undefined,
        role: channel === "ROLE_GROUP" ? role : undefined,
        projectId: channel === "PROJECT" ? projectId : undefined,
      });
      onSent();
    } catch (e) {
      toast({ title: "Could not send", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    } finally { setPending(false); }
  };

  return (
    <GlassDialog open={open} onOpenChange={onOpenChange} title="Compose message" description="Send to specific users, a role group, or a project team within your BU." wide>
      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[13px] font-medium text-[color:var(--ink)]">Kind</label>
            <Select value={kind} onValueChange={(v) => setKind(v as "MESSAGE" | "ANNOUNCEMENT" | "REMINDER")}>
              <SelectTrigger className="glass-subtle rounded-2xl border-white/60 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent className="glass-strong rounded-2xl border-white/70">
                <SelectItem value="MESSAGE">Message</SelectItem>
                <SelectItem value="ANNOUNCEMENT">Announcement</SelectItem>
                <SelectItem value="REMINDER">Reminder</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[13px] font-medium text-[color:var(--ink)]">Audience</label>
            <Select value={channel} onValueChange={(v) => setChannel(v as "DIRECT" | "ROLE_GROUP" | "PROJECT")}>
              <SelectTrigger className="glass-subtle rounded-2xl border-white/60 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent className="glass-strong rounded-2xl border-white/70">
                <SelectItem value="DIRECT">Direct · specific user(s)</SelectItem>
                <SelectItem value="ROLE_GROUP">Role group</SelectItem>
                <SelectItem value="PROJECT">Project team</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <label className="text-[13px] font-medium text-[color:var(--ink)]">Subject</label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="glass-subtle rounded-2xl border-white/60 text-sm" placeholder="One-line subject" />
        </div>
        <div>
          <label className="text-[13px] font-medium text-[color:var(--ink)]">Body</label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} className="glass-subtle rounded-2xl border-white/60 text-sm" placeholder="Write the message body…" />
        </div>
        {channel === "DIRECT" && (
          <div>
            <label className="text-[13px] font-medium text-[color:var(--ink)]">Recipients</label>
            <div className="flex flex-wrap gap-2">
              {recipients.map((r) => (
                <button key={r.id} type="button" onClick={() => setUserIds((s) => s.includes(r.id) ? s.filter((x) => x !== r.id) : [...s, r.id])} className={`rounded-2xl px-3 py-1.5 text-[12px] font-medium transition-all ${userIds.includes(r.id) ? "btn-ba-action" : "glass-subtle text-[color:var(--ink-soft)] hover:bg-white/80"}`}>
                  {r.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {channel === "ROLE_GROUP" && (
          <div>
            <label className="text-[13px] font-medium text-[color:var(--ink)]">Role</label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="glass-subtle rounded-2xl border-white/60 text-sm"><SelectValue placeholder="Choose a role" /></SelectTrigger>
              <SelectContent className="glass-strong rounded-2xl border-white/70">
                {roles.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {channel === "PROJECT" && (
          <div>
            <label className="text-[13px] font-medium text-[color:var(--ink)]">Project</label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="glass-subtle rounded-2xl border-white/60 text-sm"><SelectValue placeholder="Choose a project" /></SelectTrigger>
              <SelectContent className="glass-strong rounded-2xl border-white/70">
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {err && <p className="text-xs text-[#c34a4a]">{err}</p>}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" className="rounded-2xl" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
        <Button className="btn-ba-action rounded-2xl" onClick={submit} disabled={pending}><Megaphone className="mr-1.5 h-4 w-4" /> {pending ? "Sending…" : "Send message"}</Button>
      </div>
    </GlassDialog>
  );
}
