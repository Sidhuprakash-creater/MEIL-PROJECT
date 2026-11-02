"use client";

// ── BU ADMIN · SCREEN 10 — Tasks & Deadlines ──
// Assign operational follow-ups, set due dates, add descriptions, update task
// status, link tasks to projects/reports. Send reminder creates a real
// cross-console notification.

import { useEffect, useMemo, useState } from "react";
import {
  Bell, CalendarClock, CheckCircle2, Clock, ListChecks, Plus, Send, ShieldAlert,
} from "lucide-react";
import { TaskCheckIcon } from "@/components/workspace/premium-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useBaApi, apiPost, apiPatch, fmtDate, fmtDateTime, timeAgo } from "@/lib/ba/client";
import { useBaWorkspace } from "@/lib/ba/store";
import type { BaTasksData } from "@/lib/ba/types";
import {
  Chip, ConfirmDialog, DataTable, EmptyState, ErrorState, GlassDialog, GlassTabBar, InfoRow, LoadingBlock, PageHeader, SectionCard, StatusBadge, Toolbar, type Column,
} from "@/components/workspace/ui";
import { DetailSheet } from "@/components/workspace/ui";
import { useToast } from "@/hooks/use-toast";

interface TaskRow {
  id: string; ref: string; title: string; category: string;
  assigneeLabel: string; dueDate: string; startDate: string;
  priority: string; status: string; requiresEvidence: boolean;
  completed: number; recipients: number;
}

type Tab = "my" | "project" | "upcoming" | "dueSoon" | "overdue" | "completed";

const TAB_LABELS: Record<Tab, string> = {
  my: "My Tasks",
  project: "Project Tasks",
  upcoming: "Upcoming",
  dueSoon: "Due Soon",
  overdue: "Overdue",
  completed: "Completed",
};

export default function TasksView() {
  const { params, navigate } = useBaWorkspace();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("my");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [remindTarget, setRemindTarget] = useState<TaskRow | null>(null);

  useEffect(() => {
    if (params.create) {
      setCreateOpen(true);
      navigate("tasks", { ...params, create: undefined });
    }
     
  }, []);

  const { data, loading, error, refetch } = useBaApi<BaTasksData>("/api/ba/tasks");

  const all = useMemo(() => {
    const list: TaskRow[] = [...(data?.myTasks ?? []), ...(data?.projectTasks ?? [])];
    const seen = new Set<string>();
    return list.filter((t) => { if (seen.has(t.id)) return false; seen.add(t.id); return true; });
  }, [data]);

  const rows = useMemo(() => {
    const now = Date.now();
    let r = all;
    if (tab === "my") r = data?.myTasks ?? [];
    else if (tab === "project") r = data?.projectTasks ?? [];
    else if (tab === "upcoming") r = all.filter((t) => t.status === "UPCOMING" || (t.status === "ACTIVE" && (new Date(t.dueDate).getTime() - now) > 7 * 86400000));
    else if (tab === "dueSoon") r = all.filter((t) => t.status === "ACTIVE" && (new Date(t.dueDate).getTime() - now) <= 3 * 86400000 && (new Date(t.dueDate).getTime() - now) >= 0);
    else if (tab === "overdue") r = all.filter((t) => t.status === "OVERDUE");
    else if (tab === "completed") r = all.filter((t) => t.status === "COMPLETED");
    const q = search.toLowerCase();
    if (q) r = r.filter((t) => `${t.ref} ${t.title} ${t.assigneeLabel}`.toLowerCase().includes(q));
    return r;
  }, [all, data, tab, search]);

  const buckets = data?.buckets;

  const columns: Column<TaskRow>[] = [
    { key: "ref", header: "Reference", sortable: true, sortValue: (r) => r.ref, render: (r) => <div><div className="text-[13px] font-semibold">{r.ref}</div><div className="truncate text-[11px] text-[color:var(--ink-faint)]">{r.title}</div></div> },
    { key: "category", header: "Category", render: (r) => <Chip tone="blue">{r.category}</Chip> },
    { key: "assignee", header: "Assignee", render: (r) => <span className="text-[12px] text-[color:var(--ink-soft)]">{r.assigneeLabel}</span> },
    { key: "dueDate", header: "Due date", sortable: true, sortValue: (r) => r.dueDate, render: (r) => <div><div className="text-[12px]">{fmtDate(r.dueDate)}</div><div className="text-[10.5px] text-[color:var(--ink-faint)]">{timeAgo(r.dueDate)}</div></div> },
    { key: "priority", header: "Priority", sortable: true, sortValue: (r) => r.priority, render: (r) => <Chip tone={r.priority === "CRITICAL" ? "red" : r.priority === "HIGH" ? "amber" : r.priority === "MEDIUM" ? "blue" : "gray"}>{r.priority}</Chip> },
    { key: "status", header: "Status", sortable: true, sortValue: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="Tasks & Deadlines"
        description="Operational tasks, follow-ups and reminders across your BU. Send reminder dispatches a real cross-console notification."
        icon={TaskCheckIcon}
        actions={
          <Button className="btn-ba-action rounded-2xl" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Assign task
          </Button>
        }
      />

      {/* Buckets */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <BucketTile icon={Clock} label="Upcoming" value={buckets?.upcoming ?? 0} tone="blue" onClick={() => setTab("upcoming")} />
        <BucketTile icon={CalendarClock} label="Due soon" value={buckets?.dueSoon ?? 0} tone="amber" onClick={() => setTab("dueSoon")} />
        <BucketTile icon={ShieldAlert} label="Overdue" value={buckets?.overdue ?? 0} tone="red" onClick={() => setTab("overdue")} />
        <BucketTile icon={CheckCircle2} label="Completed" value={buckets?.completed ?? 0} tone="green" onClick={() => setTab("completed")} />
      </div>

      <GlassTabBar
        tabs={(Object.keys(TAB_LABELS) as Tab[]).map((t) => ({ value: t, label: TAB_LABELS[t] }))}
        value={tab}
        onChange={(v) => setTab(v as Tab)}
      />

      <Toolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search task ref, title or assignee…"
        onReset={() => setSearch("")}
        resultCount={rows.length}
      />

      <DataTable<TaskRow>
        columns={columns}
        rows={rows}
        loading={loading && !data}
        error={error && !data ? error : null}
        onRetry={refetch}
        pageSize={10}
        onRowClick={(r) => setDetailId(r.id)}
        emptyTitle={rows.length === 0 ? `No ${TAB_LABELS[tab].toLowerCase()}` : "No matches"}
        emptyMessage={rows.length === 0 ? "Assign a task to start tracking." : "Try adjusting the search."}
        rowActions={(r) => (
          r.status !== "COMPLETED" ? (
            <Button variant="outline" size="sm" className="h-8 rounded-xl" onClick={() => setRemindTarget(r)}><Send className="mr-1 h-3.5 w-3.5" /> Remind</Button>
          ) : null
        )}
        mobileCard={(r) => (
          <div className="flex flex-col gap-2 p-3">
            <div className="flex items-start justify-between"><div className="min-w-0"><div className="truncate text-[13px] font-semibold">{r.ref} · {r.title}</div><div className="text-[11px] text-[color:var(--ink-faint)]">{r.assigneeLabel}</div></div><StatusBadge status={r.status} /></div>
            <div className="flex flex-wrap gap-2"><Chip tone={r.priority === "CRITICAL" ? "red" : r.priority === "HIGH" ? "amber" : "blue"}>{r.priority}</Chip><Chip tone="blue">{r.category}</Chip></div>
            <div className="text-[11px] text-[color:var(--ink-faint)]">Due {fmtDate(r.dueDate)}</div>
          </div>
        )}
      />

      <CreateTaskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => { setCreateOpen(false); refetch(); toast({ title: "Task assigned", description: "Recipients notified via cross-console broadcast." }); }}
      />

      <DetailSheet
        open={!!detailId}
        onOpenChange={(o) => { if (!o) setDetailId(null); }}
        title={detailId ? "Task detail" : ""}
        width="md"
        footer={
          detailId ? (
            <div className="flex gap-2">
              <Button variant="outline" className="rounded-2xl" onClick={() => void apiPatch(`/api/ba/tasks/${detailId}`, { status: "COMPLETED" }).then(() => { refetch(); toast({ title: "Task marked complete" }); })}><CheckCircle2 className="mr-1.5 h-4 w-4" /> Mark complete</Button>
              <Button className="btn-ba-action rounded-2xl" onClick={() => { const t = rows.find((r) => r.id === detailId); if (t) setRemindTarget(t); }}><Bell className="mr-1.5 h-4 w-4" /> Send reminder</Button>
            </div>
          ) : null
        }
      >
        <TaskDetail id={detailId} rows={all} />
      </DetailSheet>

      <ConfirmDialog
        open={!!remindTarget}
        onOpenChange={(o) => { if (!o) setRemindTarget(null); }}
        title="Send a reminder?"
        message={`A reminder for "${remindTarget?.title}" will be dispatched to ${remindTarget?.recipients ?? 1} recipient(s) via cross-console broadcast.`}
        confirmLabel="Send reminder"
        onConfirm={async () => {
          if (!remindTarget) return;
          try {
            await apiPatch(`/api/ba/tasks/${remindTarget.id}`, { action: "remind" });
            toast({ title: "Reminder dispatched", description: `${remindTarget.recipients} recipient(s) notified.` });
            refetch();
            setRemindTarget(null);
          } catch (e) {
            toast({ title: "Could not send reminder", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
          }
        }}
      />
    </div>
  );
}

function BucketTile({ icon: Icon, label, value, tone, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; tone: "blue" | "amber" | "red" | "green"; onClick: () => void }) {
  const hues: Record<string, string> = { blue: "#348BE8", amber: "#c57926", red: "#E35D6A", green: "#16A67A" };
  return (
    <button onClick={onClick} className="glass-ba glass-sheen flex items-center gap-3 rounded-3xl p-4 text-left transition-all hover:-translate-y-0.5 hover:bg-white/85">
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl text-white" style={{ background: `linear-gradient(135deg, ${hues[tone]}, color-mix(in srgb, ${hues[tone]} 60%, #17263d))` }}>
        <Icon className="h-5 w-5 text-white" />
      </span>
      <div><div className="text-[20px] font-bold tabular text-[color:var(--ink)]">{value}</div><div className="text-[11px] font-medium text-[color:var(--ink-faint)]">{label}</div></div>
    </button>
  );
}

function CreateTaskDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("ENVIRONMENT");
  const [assigneeType, setAssigneeType] = useState("USER");
  const [projectId, setProjectId] = useState("");
  const [userIds, setUserIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [priority, setPriority] = useState("MEDIUM");
  const [requiresEvidence, setRequiresEvidence] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string; role: string }[]>([]);

  useEffect(() => {
    if (open) {
      setTitle(""); setDescription(""); setCategory("ENVIRONMENT"); setAssigneeType("USER"); setProjectId("");
      setUserIds([]); setDueDate(""); setStartDate(new Date().toISOString().slice(0, 10));
      setPriority("MEDIUM"); setRequiresEvidence(false); setErr(null);
      void Promise.all([
        fetch("/api/ba/projects?pageSize=50").then((r) => r.json()),
        fetch("/api/ba/users?pageSize=50").then((r) => r.json()),
      ]).then(([p, u]) => {
        setProjects((p as { projects: { id: string; name: string }[] }).projects ?? []);
        setUsers(((u as { users: { id: string; name: string; role: string }[] }).users ?? []).filter((x) => x.role !== "BU_ADMIN" && x.role !== "BU_MANAGER"));
      });
    }
  }, [open]);

  const submit = async () => {
    if (title.trim().length < 2) return setErr("Task title is required.");
    if (!dueDate) return setErr("A due date is required.");
    if (assigneeType === "USER" && userIds.length === 0) return setErr("Select at least one assignee.");
    if (assigneeType === "PROJECT" && !projectId) return setErr("Select a project.");
    setPending(true);
    try {
      await apiPost("/api/ba/tasks", {
        title: title.trim(), description: description.trim(), category,
        assigneeType, userIds: assigneeType === "USER" ? userIds : undefined,
        projectId: assigneeType === "PROJECT" ? projectId : undefined,
        startDate, dueDate, priority, requiresEvidence,
      });
      onCreated();
    } catch (e) {
      toast({ title: "Could not create task", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    } finally { setPending(false); }
  };

  return (
    <GlassDialog open={open} onOpenChange={onOpenChange} title="Assign an operational task" description="Tasks may be assigned to specific users, a project team, or the whole BU. Recipients receive a cross-console broadcast notification." wide>
      <div className="grid gap-3">
        <FieldWrap label="Title" required><Input value={title} onChange={(e) => setTitle(e.target.value)} className="glass-subtle rounded-2xl border-white/60 text-sm" placeholder="e.g. Verify lab calibration for Q2 reporting" /></FieldWrap>
        <FieldWrap label="Description"><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="glass-subtle rounded-2xl border-white/60 text-sm" /></FieldWrap>
        <div className="grid grid-cols-2 gap-3">
          <FieldWrap label="Category">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="glass-subtle rounded-2xl border-white/60 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent className="glass-strong rounded-2xl border-white/70">
                {["ENVIRONMENT", "ENERGY", "EMISSIONS", "WATER", "WASTE", "SAFETY", "WORKFORCE", "PROCUREMENT", "CSR", "COMPLIANCE"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldWrap>
          <FieldWrap label="Priority">
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="glass-subtle rounded-2xl border-white/60 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent className="glass-strong rounded-2xl border-white/70">
                {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldWrap>
        </div>
        <FieldWrap label="Assign to">
          <Select value={assigneeType} onValueChange={setAssigneeType}>
            <SelectTrigger className="glass-subtle rounded-2xl border-white/60 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent className="glass-strong rounded-2xl border-white/70">
              <SelectItem value="USER">Specific user(s)</SelectItem>
              <SelectItem value="PROJECT">Project team</SelectItem>
              <SelectItem value="BU">Whole BU</SelectItem>
            </SelectContent>
          </Select>
        </FieldWrap>
        {assigneeType === "USER" && (
          <FieldWrap label="Assignee(s)" required>
            <div className="flex flex-wrap gap-2">
              {users.map((u) => (
                <button key={u.id} type="button" onClick={() => setUserIds((s) => s.includes(u.id) ? s.filter((x) => x !== u.id) : [...s, u.id])} className={`rounded-2xl px-3 py-1.5 text-[12px] font-medium transition-all ${userIds.includes(u.id) ? "btn-ba-action" : "glass-subtle text-[color:var(--ink-soft)] hover:bg-white/80"}`}>
                  {u.name}
                </button>
              ))}
            </div>
          </FieldWrap>
        )}
        {assigneeType === "PROJECT" && (
          <FieldWrap label="Project" required>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="glass-subtle rounded-2xl border-white/60 text-sm"><SelectValue placeholder="Choose a project under your BU" /></SelectTrigger>
              <SelectContent className="glass-strong rounded-2xl border-white/70">
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldWrap>
        )}
        <div className="grid grid-cols-2 gap-3">
          <FieldWrap label="Start date"><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="glass-subtle rounded-2xl border-white/60 text-sm" /></FieldWrap>
          <FieldWrap label="Due date" required><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="glass-subtle rounded-2xl border-white/60 text-sm" /></FieldWrap>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={requiresEvidence} onCheckedChange={setRequiresEvidence} id="req-ev" />
          <label htmlFor="req-ev" className="text-[13px] text-[color:var(--ink-soft)]">Requires evidence upload on completion</label>
        </div>
        {err && <p className="text-xs text-[#c34a4a]">{err}</p>}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" className="rounded-2xl" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
        <Button className="btn-ba-action rounded-2xl" onClick={submit} disabled={pending}>{pending ? "Assigning…" : "Assign task"}</Button>
      </div>
    </GlassDialog>
  );
}

function TaskDetail({ id, rows }: { id: string | null; rows: TaskRow[] }) {
  const t = rows.find((r) => r.id === id);
  if (!t) return <EmptyState title="Task not found" />;
  return (
    <div className="space-y-4">
      <div className="glass-subtle rounded-2xl p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={t.status} />
          <Chip tone={t.priority === "CRITICAL" ? "red" : t.priority === "HIGH" ? "amber" : t.priority === "MEDIUM" ? "blue" : "gray"}>{t.priority}</Chip>
          <Chip tone="blue">{t.category}</Chip>
        </div>
        <div className="mt-2 text-[14px] font-semibold text-[color:var(--ink)]">{t.ref} — {t.title}</div>
      </div>
      <SectionCard title="Assignment" noPad>
        <div className="px-4 py-2">
          <InfoRow label="Assignee">{t.assigneeLabel}</InfoRow>
          <InfoRow label="Start date">{fmtDate(t.startDate)}</InfoRow>
          <InfoRow label="Due date">{fmtDate(t.dueDate)}</InfoRow>
          <InfoRow label="Recipients">{t.recipients}</InfoRow>
          <InfoRow label="Completed">{t.completed} / {t.recipients}</InfoRow>
          <InfoRow label="Requires evidence">{t.requiresEvidence ? "Yes" : "No"}</InfoRow>
        </div>
      </SectionCard>
    </div>
  );
}

function FieldWrap({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium text-[color:var(--ink)]">{label} {required && <span className="text-[#c34a4a]">*</span>}</label>
      {children}
    </div>
  );
}

void ListChecks; void fmtDateTime;
