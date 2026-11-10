"use client";

// ── SCREEN 11 — Tasks & Deadlines (ESG Operations) ──
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Bell,
  BellRing,
  BadgeCheck,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ClipboardList,
  Clock,
  Eye,
  MoreHorizontal,
  Plus,
  Trash2,
  TrendingUp,
  Users as UsersIcon,
} from "lucide-react";
import { Ring } from '@/components/ring'
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CATEGORIES, ROLE_LABELS, type Task } from "@/lib/esg/types";
import { apiDelete, apiPatch, apiPost, fmtDate, fmtDateTime, timeAgo, useApi, useMutation } from "@/lib/esg/client";
import { useWorkspace } from "@/lib/esg/store";
import {
  ActionButton,
  Chip,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Field,
  GlassCard,
  GlassDialog,
  GlassTabBar,
  GlassProgress,
  InfoRow,
  KpiCard,
  LoadingBlock,
  PageHeader,
  SectionCard,
  StatusBadge,
  Toolbar,
  ExportButton,
  type Column,
} from "@/components/workspace/ui";

const CATEGORY_LABELS: Record<string, string> = {
  ENVIRONMENT: "Environment",
  ENERGY: "Energy",
  EMISSIONS: "Emissions",
  WATER: "Water",
  WASTE: "Waste",
  SAFETY: "Safety",
  WORKFORCE: "Workforce",
  PROCUREMENT: "Procurement",
  CSR: "CSR",
  COMPLIANCE: "Compliance",
};

const PRIORITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const ASSIGNEE_TYPES = ["USER", "ROLE", "BU", "SUBSIDIARY", "ALL"] as const;
type AssigneeType = (typeof ASSIGNEE_TYPES)[number];

const ASSIGNEE_TYPE_LABELS: Record<string, string> = {
  USER: "User",
  ROLE: "Role group",
  BU: "Business unit",
  SUBSIDIARY: "Subsidiary",
  ALL: "All eligible users",
};

function csvTaskRow(t: Task): Record<string, unknown> {
  return {
    Ref: t.ref,
    Title: t.title,
    Category: CATEGORY_LABELS[t.category] ?? t.category,
    AssigneeType: ASSIGNEE_TYPE_LABELS[t.assigneeType] ?? t.assigneeType,
    Assignee: t.assigneeLabel,
    Scope: t.subsidiaryName ?? "Group",
    Period: t.period,
    Start: fmtDate(t.startDate),
    Due: fmtDate(t.dueDate),
    Priority: t.priority,
    Status: t.status,
    Recipients: t.recipients,
    Acknowledged: t.acknowledged,
    Completed: t.completed,
    Reminders: t.remindersSent,
    RequiresEvidence: t.requiresEvidence ? "YES" : "NO",
  };
}

/* ─────────────────────────── Detail view ─────────────────────────── */

function TaskDetail({ id }: { id: string }) {
  const { navigate } = useWorkspace();
  const { toast } = useToast();
  const listApi = useApi<{ tasks: Task[] }>("/api/esg/tasks");
  const mut = useMutation<{ message?: string }>();

  const [extendOpen, setExtendOpen] = useState(false);
  const [newDue, setNewDue] = useState("");
  const [confirm, setConfirm] = useState<null | "complete" | "cancel">(null);

  const t = useMemo(() => (listApi.data?.tasks ?? []).find((x) => x.id === id) ?? null, [listApi.data, id]);

  const runRemind = async () => {
    if (!t) return;
    const res = await mut.run(() => apiPost<{ message: string }>("/api/esg/tasks", { action: "remind", id: t.id }));
    if (res) {
      toast({ title: "Reminder sent", description: res.message });
      await listApi.refetch();
    } else toast({ title: "Reminder failed", description: mut.error ?? "Server rejected the request.", variant: "destructive" });
  };

  const runEscalate = async () => {
    if (!t) return;
    const res = await mut.run(() => apiPost<{ message: string }>("/api/esg/tasks", { action: "escalate", id: t.id }));
    if (res) {
      toast({ title: "Task escalated", description: res.message });
      await listApi.refetch();
    } else toast({ title: "Escalation failed", description: mut.error ?? "Server rejected the request.", variant: "destructive" });
  };

  const runExtend = async () => {
    if (!t || !newDue) return;
    const res = await mut.run(() => apiPatch<{ message?: string }>("/api/esg/tasks", { id: t.id, dueDate: newDue }));
    setExtendOpen(false);
    if (res) {
      toast({ title: "Due date extended", description: `${t.ref} is now due ${fmtDate(newDue)}.` });
      setNewDue("");
      await listApi.refetch();
    } else toast({ title: "Extension failed", description: mut.error ?? "Server rejected the request.", variant: "destructive" });
  };

  const runComplete = async (reason?: string) => {
    if (!t) return;
    setConfirm(null);
    const res = await mut.run(() => apiPatch<{ message?: string }>("/api/esg/tasks", { id: t.id, status: "COMPLETED", reason }));
    if (res) {
      toast({ title: "Task completed", description: `${t.ref} marked as completed.` });
      await listApi.refetch();
    } else toast({ title: "Update failed", description: mut.error ?? "Server rejected the request.", variant: "destructive" });
  };

  const runCancel = async (reason?: string) => {
    if (!t) return;
    setConfirm(null);
    const res = await mut.run(() => apiDelete<{ message?: string }>("/api/esg/tasks", { id: t.id, reason }));
    if (res) {
      toast({ title: "Task cancelled", description: `${t.ref} closed and retained in reporting history.` });
      await listApi.refetch();
    } else toast({ title: "Cancellation failed", description: mut.error ?? "Server rejected the request.", variant: "destructive" });
  };

  if (listApi.loading) {
    return (
      <div className="view-in space-y-5">
        <GlassCard><LoadingBlock rows={6} label="Loading task…" /></GlassCard>
      </div>
    );
  }
  if (!t) {
    return (
      <div className="view-in space-y-5">
        <Button variant="ghost" size="sm" className="-ml-2 rounded-2xl text-[color:var(--ink-soft)]" onClick={() => navigate("tasks")}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Tasks & Deadlines
        </Button>
        <GlassCard>
          <EmptyState
            title="Task not found"
            message={listApi.error ?? "This task may have been removed."}
            action={<Button variant="outline" className="glass-subtle rounded-2xl" onClick={() => void listApi.refetch()}>Try again</Button>}
          />
        </GlassCard>
      </div>
    );
  }

  const ackPct = t.recipients > 0 ? (t.acknowledged / t.recipients) * 100 : 0;
  const donePct = t.recipients > 0 ? (t.completed / t.recipients) * 100 : 0;
  const scope = t.subsidiaryName ? [t.subsidiaryName, t.businessUnitName].filter(Boolean).join("  ›  ") : "Group";

  return (
    <div className="view-in space-y-5">
      <Button variant="ghost" size="sm" className="-ml-2 rounded-2xl text-[color:var(--ink-soft)]" onClick={() => navigate("tasks")}>
        <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Tasks & Deadlines
      </Button>

      <GlassCard className="p-5 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="blue" className="font-mono">{t.ref}</Chip>
              <StatusBadge status={t.status} />
              <StatusBadge status={t.priority} />
            </div>
            <h1 className="mt-2 text-xl font-semibold tracking-tight text-[color:var(--ink)] sm:text-2xl">{t.title}</h1>
            {t.description && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[color:var(--ink-soft)]">{t.description}</p>}
          </div>
        </div>
      </GlassCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title="Task details" icon={ClipboardList}>
          <div className="divide-y divide-[rgba(125,177,216,0.18)]">
            <InfoRow label="Assigned to">
              <span className="inline-flex items-center gap-1.5">
                {t.assigneeLabel}
                <Chip tone="gray">{ASSIGNEE_TYPE_LABELS[t.assigneeType] ?? t.assigneeType}</Chip>
              </span>
            </InfoRow>
            <InfoRow label="Scope">{scope}</InfoRow>
            <InfoRow label="Reporting period">{t.period || "—"}</InfoRow>
            <InfoRow label="Start date">{fmtDate(t.startDate)}</InfoRow>
            <InfoRow label="Due date"><span className={cn(t.status === "OVERDUE" && "font-semibold text-[#a53b3b]")}>{fmtDate(t.dueDate)}</span></InfoRow>
            <InfoRow label="Requires evidence">{t.requiresEvidence ? "Yes — supporting documents expected" : "No"}</InfoRow>
            <InfoRow label="Reminders sent">{t.remindersSent}</InfoRow>
          </div>
        </SectionCard>

        <div className="space-y-5">
          <SectionCard title="Completion progress" icon={TrendingUp}>
            <div className="flex flex-col gap-4">
              <div>
                <div className="mb-1.5 flex items-center justify-between text-[13px]">
                  <span className="font-medium text-[color:var(--ink)]">Acknowledged</span>
                  <span className="tabular text-[color:var(--ink-soft)]">{t.acknowledged}/{t.recipients}</span>
                </div>
                <GlassProgress value={ackPct} tone="blue" showLabel />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between text-[13px]">
                  <span className="font-medium text-[color:var(--ink)]">Completed</span>
                  <span className="tabular text-[color:var(--ink-soft)]">{t.completed}/{t.recipients}</span>
                </div>
                <GlassProgress value={donePct} tone="green" showLabel />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Actions" icon={BadgeCheck}>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="glass-subtle rounded-2xl border-white/60" disabled={mut.pending} onClick={() => void runRemind()}>
                <BellRing className="mr-1.5 h-3.5 w-3.5" /> Send reminder
              </Button>
              <Button variant="outline" size="sm" className="glass-subtle rounded-2xl border-white/60" disabled={mut.pending || t.status !== "OVERDUE"} onClick={() => void runEscalate()}>
                <TrendingUp className="mr-1.5 h-3.5 w-3.5" /> Escalate
              </Button>
              <Button variant="outline" size="sm" className="glass-subtle rounded-2xl border-white/60" disabled={mut.pending || t.status === "COMPLETED"} onClick={() => { setNewDue(t.dueDate.slice(0, 10)); setExtendOpen(true); }}>
                <CalendarPlus className="mr-1.5 h-3.5 w-3.5" /> Extend due date
              </Button>
              <Button variant="outline" size="sm" className="glass-subtle rounded-2xl border-white/60" disabled={mut.pending || t.status === "COMPLETED"} onClick={() => setConfirm("complete")}>
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Mark complete
              </Button>
              <Button variant="destructive" size="sm" className="rounded-2xl" disabled={mut.pending || t.status === "COMPLETED"} onClick={() => setConfirm("cancel")}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Cancel task
              </Button>
            </div>
          </SectionCard>
        </div>
      </div>

      <SectionCard title="Reminder log" icon={Bell} description="Dispatch history recorded for this task." noPad>
        {t.reminderLog.length === 0 ? (
          <EmptyState title="No reminders sent yet" message="Use “Send reminder” to notify recipients in-app." />
        ) : (
          <div className="nice-scroll max-h-64 overflow-y-auto divide-y divide-[rgba(125,177,216,0.18)]">
            {[...t.reminderLog].reverse().map((r, i) => (
              <div key={i} className="flex items-center justify-between gap-3 px-5 py-3">
                <span className="inline-flex items-center gap-2 text-[13px] font-medium text-[color:var(--ink)]">
                  <Bell className="h-3.5 w-3.5 text-[color:var(--esg-blue)]" /> Reminder #{t.reminderLog.length - i}
                </span>
                <span className="text-xs text-[color:var(--ink-faint)]">
                  {r.channel} · {fmtDateTime(r.at)} ({timeAgo(r.at)})
                </span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Extend dialog */}
      <GlassDialog
        open={extendOpen}
        onOpenChange={setExtendOpen}
        title={`Extend due date — ${t.ref}`}
        description="The extension is recorded in the audit log with the previous and new due dates."
        footer={
          <>
            <Button variant="outline" className="glass-subtle rounded-2xl" onClick={() => setExtendOpen(false)} disabled={mut.pending}>Cancel</Button>
            <ActionButton pending={mut.pending} onClick={() => void runExtend()} disabled={!newDue}>Extend</ActionButton>
          </>
        }
      >
        <Field label="New due date" required>
          <Input type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)} className="glass-subtle rounded-2xl border-white/60" />
        </Field>
      </GlassDialog>

      <ConfirmDialog
        open={confirm === "complete"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Mark ${t.ref} complete?`}
        message="The task is closed as completed for all recipients. Completed tasks are part of reporting history and cannot be cancelled."
        confirmLabel="Mark complete"
        pending={mut.pending}
        onConfirm={(reason) => void runComplete(reason)}
      />
      <ConfirmDialog
        open={confirm === "cancel"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Cancel ${t.ref}?`}
        message="The task is cancelled and closed for all recipients. It is retained in reporting history for audit purposes."
        confirmLabel="Cancel task"
        destructive
        requireReason
        pending={mut.pending}
        onConfirm={(reason) => void runCancel(reason)}
      />
    </div>
  );
}

/* ─────────────────────────── List view ─────────────────────────── */

export default function TasksView() {
  const { params, navigate, openDetail } = useWorkspace();
  const { toast } = useToast();
  const detailId = typeof params.detailId === "string" ? params.detailId : undefined;
  const autoCreate = params.create !== undefined;

  const listApi = useApi<{ tasks: Task[] }>("/api/esg/tasks");
  const usersApi = useApi<{ users: { id: string; name: string; role: string; subsidiaryId: string | null; businessUnitId: string | null; status: string }[] }>("/api/esg/users");
  const subsApi = useApi<{ subsidiaries: { id: string; name: string }[] }>("/api/esg/org?type=subsidiaries&light=1");
  const unitsApi = useApi<{ businessUnits: { id: string; name: string; subsidiaryId: string }[] }>("/api/esg/org?type=business-units");

  const [tab, setTab] = useState("ALL");
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  // Auto-open the assign dialog when navigated with params.create (dialog mounts open).
  const [createOpen, setCreateOpen] = useState(autoCreate);
  const [assignType, setAssignType] = useState<AssigneeType>("USER");
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "ENVIRONMENT",
    assigneeUserId: "NONE",
    assigneeRole: "NONE",
    assigneeBuId: "NONE",
    assigneeSubId: "NONE",
    priority: "MEDIUM",
    startDate: "",
    dueDate: "",
    requiresEvidence: true,
    recipients: "1",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const createMut = useMutation<{ task: { ref: string } }>();
  const remindMut = useMutation<{ message: string }>();
  const escalateMut = useMutation<{ message: string }>();

  const [extendTarget, setExtendTarget] = useState<Task | null>(null);
  const [newDue, setNewDue] = useState("");
  const [confirm, setConfirm] = useState<null | { kind: "complete" | "cancel"; task: Task }>(null);
  const patchMut = useMutation();
  const deleteMut = useMutation();

  const all = listApi.data?.tasks ?? [];

  const kpis = useMemo(
    () => ({
      active: all.filter((t) => t.status === "ACTIVE").length,
      upcoming: all.filter((t) => t.status === "UPCOMING").length,
      overdue: all.filter((t) => t.status === "OVERDUE").length,
      completed: all.filter((t) => t.status === "COMPLETED").length,
    }),
    [all]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((t) => {
      if (tab !== "ALL" && t.status !== tab) return false;
      if (q && !`${t.ref} ${t.title} ${t.assigneeLabel}`.toLowerCase().includes(q)) return false;
      if (priorityFilter !== "ALL" && t.priority !== priorityFilter) return false;
      if (categoryFilter !== "ALL" && t.category !== categoryFilter) return false;
      return true;
    });
  }, [all, tab, search, priorityFilter, categoryFilter]);

  const resetFilters = () => {
    setSearch("");
    setPriorityFilter("ALL");
    setCategoryFilter("ALL");
  };

  /* Assign dialog helpers */
  const users = usersApi.data?.users ?? [];

  const estimateFor = (type: AssigneeType, sel: { role?: string; buId?: string; subId?: string }): number => {
    switch (type) {
      case "USER":
        return 1;
      case "ROLE":
        return sel.role && sel.role !== "NONE" ? users.filter((u) => u.role === sel.role).length : 0;
      case "BU":
        return sel.buId && sel.buId !== "NONE" ? users.filter((u) => u.businessUnitId === sel.buId).length : 0;
      case "SUBSIDIARY":
        return sel.subId && sel.subId !== "NONE" ? users.filter((u) => u.subsidiaryId === sel.subId).length : 0;
      case "ALL":
        return users.length;
    }
  };

  // Recipients are auto-filled from the directory when the audience changes (in change handlers).
  const estimatedRecipients = estimateFor(assignType, { role: form.assigneeRole, buId: form.assigneeBuId, subId: form.assigneeSubId });

  const openCreateDialog = () => {
    setFormErrors({});
    setAssignType("USER");
    setForm({
      title: "",
      description: "",
      category: "ENVIRONMENT",
      assigneeUserId: "NONE",
      assigneeRole: "NONE",
      assigneeBuId: "NONE",
      assigneeSubId: "NONE",
      priority: "MEDIUM",
      startDate: "",
      dueDate: "",
      requiresEvidence: true,
      recipients: "1",
    });
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    const e: Record<string, string> = {};
    if (form.title.trim().length < 3) e.title = "Title must be at least 3 characters.";
    if (!form.dueDate) e.dueDate = "Due date is required.";
    if (assignType === "USER" && form.assigneeUserId === "NONE") e.assigneeUserId = "Select a responsible user.";
    if (assignType === "ROLE" && form.assigneeRole === "NONE") e.assigneeRole = "Select a role group.";
    if (assignType === "BU" && form.assigneeBuId === "NONE") e.assigneeBuId = "Select a business unit.";
    if (assignType === "SUBSIDIARY" && form.assigneeSubId === "NONE") e.assigneeSubId = "Select a subsidiary.";
    setFormErrors(e);
    if (Object.keys(e).length) return;

    const assigneeUser = users.find((u) => u.id === form.assigneeUserId);
    const assigneeLabel =
      assignType === "USER"
        ? assigneeUser?.name ?? ""
        : assignType === "ROLE"
          ? ROLE_LABELS[form.assigneeRole] ?? form.assigneeRole
          : assignType === "BU"
            ? (unitsApi.data?.businessUnits ?? []).find((b) => b.id === form.assigneeBuId)?.name ?? ""
            : assignType === "SUBSIDIARY"
              ? (subsApi.data?.subsidiaries ?? []).find((s) => s.id === form.assigneeSubId)?.name ?? ""
              : "All eligible users";
    const assigneeFilter =
      assignType === "USER"
        ? JSON.stringify({ userId: form.assigneeUserId })
        : assignType === "ROLE"
          ? JSON.stringify({ role: form.assigneeRole })
          : assignType === "BU"
            ? JSON.stringify({ businessUnitId: form.assigneeBuId })
            : assignType === "SUBSIDIARY"
              ? JSON.stringify({ subsidiaryId: form.assigneeSubId })
              : "{}";

    const res = await createMut.run(() =>
      apiPost<{ task: { ref: string } }>("/api/esg/tasks", {
        title: form.title.trim(),
        description: form.description,
        category: form.category,
        assigneeType: assignType,
        assigneeLabel,
        assigneeFilter,
        subsidiaryId: assignType === "SUBSIDIARY" ? form.assigneeSubId : form.assigneeSubId === "NONE" ? "" : form.assigneeSubId,
        businessUnitId: assignType === "BU" ? form.assigneeBuId : form.assigneeBuId === "NONE" ? "" : form.assigneeBuId,
        period: "FY 2025-26",
        startDate: form.startDate || undefined,
        dueDate: form.dueDate,
        priority: form.priority,
        requiresEvidence: form.requiresEvidence ? "true" : "false",
        recipients: form.recipients,
      })
    );
    if (res) {
      toast({ title: "Task assigned", description: `${res.task.ref} — "${form.title.trim()}" dispatched to ${assigneeLabel}.` });
      setCreateOpen(false);
      await listApi.refetch();
    } else {
      toast({ title: "Assign failed", description: createMut.error ?? "Server rejected the task.", variant: "destructive" });
    }
  };

  const runRemind = async (t: Task) => {
    const res = await remindMut.run(() => apiPost<{ message: string }>("/api/esg/tasks", { action: "remind", id: t.id }));
    if (res) {
      toast({ title: "Reminder sent", description: res.message });
      await listApi.refetch();
    } else toast({ title: "Reminder failed", description: remindMut.error ?? "Server rejected the request.", variant: "destructive" });
  };

  const runEscalate = async (t: Task) => {
    const res = await escalateMut.run(() => apiPost<{ message: string }>("/api/esg/tasks", { action: "escalate", id: t.id }));
    if (res) {
      toast({ title: "Task escalated", description: res.message });
      await listApi.refetch();
    } else toast({ title: "Escalation failed", description: escalateMut.error ?? "Server rejected the request.", variant: "destructive" });
  };

  const runExtend = async () => {
    if (!extendTarget || !newDue) return;
    const res = await patchMut.run(() => apiPatch("/api/esg/tasks", { id: extendTarget.id, dueDate: newDue }));
    setExtendTarget(null);
    if (res) {
      toast({ title: "Due date extended", description: `${extendTarget.ref} is now due ${fmtDate(newDue)}.` });
      setNewDue("");
      await listApi.refetch();
    } else toast({ title: "Extension failed", description: patchMut.error ?? "Server rejected the request.", variant: "destructive" });
  };

  const runComplete = async (reason?: string) => {
    if (!confirm) return;
    const t = confirm.task;
    setConfirm(null);
    const res = await patchMut.run(() => apiPatch("/api/esg/tasks", { id: t.id, status: "COMPLETED", reason }));
    if (res) {
      toast({ title: "Task completed", description: `${t.ref} marked as completed.` });
      await listApi.refetch();
    } else toast({ title: "Update failed", description: patchMut.error ?? "Server rejected the request.", variant: "destructive" });
  };

  const runCancel = async (reason?: string) => {
    if (!confirm) return;
    const t = confirm.task;
    setConfirm(null);
    const res = await deleteMut.run(() => apiDelete("/api/esg/tasks", { id: t.id, reason }));
    if (res) {
      toast({ title: "Task cancelled", description: `${t.ref} closed and retained in reporting history.` });
      await listApi.refetch();
    } else toast({ title: "Cancellation failed", description: deleteMut.error ?? "Server rejected the request.", variant: "destructive" });
  };

  if (detailId) return <TaskDetail id={detailId} />;

  const columns: Column<Task>[] = [
    {
      key: "ref",
      header: "Ref",
      sortable: true,
      sortValue: (t) => t.ref,
      render: (t) => <Chip tone="gray" className="font-mono">{t.ref}</Chip>,
    },
    {
      key: "title",
      header: "Task",
      sortable: true,
      sortValue: (t) => t.title,
      render: (t) => (
        <div className="min-w-0">
          <div className="max-w-[240px] truncate font-medium text-[color:var(--ink)]">{t.title}</div>
          <Chip tone="teal" className="mt-0.5">{CATEGORY_LABELS[t.category] ?? t.category}</Chip>
        </div>
      ),
    },
    {
      key: "assignee",
      header: "Assigned to",
      render: (t) => (
        <div className="min-w-0">
          <div className="max-w-[160px] truncate text-[13px] font-medium text-[color:var(--ink)]">{t.assigneeLabel}</div>
          <Chip tone="gray" className="mt-0.5">{ASSIGNEE_TYPE_LABELS[t.assigneeType] ?? t.assigneeType}</Chip>
        </div>
      ),
    },
    {
      key: "scope",
      header: "Scope",
      render: (t) => <span className="text-xs">{t.subsidiaryName ?? "Group"}{t.businessUnitName ? <span className="text-[color:var(--ink-faint)]"> › {t.businessUnitName}</span> : null}</span>,
    },
    {
      key: "due",
      header: "Due",
      sortable: true,
      sortValue: (t) => t.dueDate,
      render: (t) => <span className={cn("text-xs", t.status === "OVERDUE" && "font-semibold text-[#a53b3b]")}>{fmtDate(t.dueDate)}</span>,
    },
    { key: "priority", header: "Priority", sortable: true, sortValue: (t) => t.priority, render: (t) => <StatusBadge status={t.priority} /> },
    {
      key: "ack",
      header: "Ack",
      render: (t) => (
        <div className="w-24">
          <div className="tabular mb-1 text-[11px] text-[color:var(--ink-faint)]">{t.acknowledged}/{t.recipients} ack</div>
          <GlassProgress value={t.recipients > 0 ? (t.acknowledged / t.recipients) * 100 : 0} tone="blue" />
        </div>
      ),
    },
    {
      key: "reminders",
      header: "Reminders",
      render: (t) => (
        <span className="inline-flex items-center gap-1.5">
          <span className="tabular text-xs font-medium">{t.remindersSent}</span>
          <button
            type="button"
            aria-label={`Send reminder for ${t.ref}`}
            className="glass-subtle inline-flex h-7 w-7 items-center justify-center rounded-xl hover:bg-white/70 disabled:opacity-40"
            disabled={remindMut.pending || t.status === "COMPLETED"}
            onClick={(e) => {
              e.stopPropagation();
              void runRemind(t);
            }}
          >
            {remindMut.pending ? <Ring className="h-3.5 w-3.5 text-[color:var(--esg-blue)]" /> : <Bell className="h-3.5 w-3.5 text-[color:var(--esg-blue)]" />}
          </button>
        </span>
      ),
    },
    { key: "status", header: "Status", sortable: true, sortValue: (t) => t.status, render: (t) => <StatusBadge status={t.status} /> },
  ];

  return (
    <div className="view-in space-y-5">
      <PageHeader
        title="Tasks & Deadlines"
        description="Assign reporting tasks to users, roles, business units, or subsidiaries — track acknowledgement and completion."
        icon={BadgeCheck}
        breadcrumbs={["Group", "ESG Operations", "Tasks & Deadlines"]}
        actions={
          <>
            <ExportButton filename="meil-tasks" rows={filtered.map(csvTaskRow)} />
            <ActionButton onClick={openCreateDialog}>
              <Plus className="mr-1.5 h-4 w-4" /> Assign task
            </ActionButton>
          </>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Active" value={kpis.active} icon={ClipboardList} tone="blue" />
        <KpiCard label="Upcoming" value={kpis.upcoming} icon={Clock} tone="amber" />
        <KpiCard label="Overdue" value={kpis.overdue} icon={CalendarClock} tone="red" />
        <KpiCard label="Completed" value={kpis.completed} icon={CheckCircle2} tone="green" />
      </div>

      <GlassTabBar
        value={tab}
        onChange={setTab}
        className="w-fit max-w-full"
        tabs={[
          { value: "ALL", label: "All", count: all.length },
          { value: "ACTIVE", label: "Active", count: kpis.active },
          { value: "UPCOMING", label: "Upcoming", count: kpis.upcoming },
          { value: "OVERDUE", label: "Overdue", count: kpis.overdue },
          { value: "COMPLETED", label: "Completed", count: kpis.completed },
        ]}
      />

      <DataTable<Task>
        columns={columns}
        rows={filtered}
        loading={listApi.loading}
        error={listApi.error}
        onRetry={() => void listApi.refetch()}
        pageSize={10}
        onRowClick={(t) => openDetail("tasks", t.id)}
        emptyTitle="No tasks match your filters"
        emptyMessage="Assign a reporting task to start tracking acknowledgement and completion."
        emptyAction={<Button variant="outline" className="glass-subtle rounded-2xl" onClick={openCreateDialog}><Plus className="mr-1.5 h-4 w-4" /> Assign task</Button>}
        toolbar={
          <Toolbar
            search={search}
            onSearch={setSearch}
            searchPlaceholder="Search ref, title, or assignee…"
            resultCount={filtered.length}
            onReset={resetFilters}
            filters={[
              {
                key: "priority",
                label: "Priority",
                value: priorityFilter,
                onChange: setPriorityFilter,
                options: [{ value: "ALL", label: "All priorities" }, ...PRIORITIES.map((p) => ({ value: p, label: p.charAt(0) + p.slice(1).toLowerCase() }))],
              },
              {
                key: "category",
                label: "Category",
                value: categoryFilter,
                onChange: setCategoryFilter,
                options: [{ value: "ALL", label: "All categories" }, ...CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] ?? c }))],
              },
            ]}
          />
        }
        rowActions={(t) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" aria-label={`Actions for ${t.ref}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass-strong rounded-2xl border-white/70">
              <DropdownMenuLabel className="text-xs text-[color:var(--ink-faint)]">{t.ref}</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => openDetail("tasks", t.id)}>
                <Eye className="mr-2 h-3.5 w-3.5" /> View
              </DropdownMenuItem>
              <DropdownMenuItem disabled={t.status !== "OVERDUE" || escalateMut.pending} onClick={() => void runEscalate(t)}>
                <TrendingUp className="mr-2 h-3.5 w-3.5" /> Escalate
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={t.status === "COMPLETED"}
                onClick={() => {
                  setExtendTarget(t);
                  setNewDue(t.dueDate.slice(0, 10));
                }}
              >
                <CalendarPlus className="mr-2 h-3.5 w-3.5" /> Extend due date
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={t.status === "COMPLETED"} onClick={() => setConfirm({ kind: "complete", task: t })}>
                <CheckCircle2 className="mr-2 h-3.5 w-3.5" /> Mark complete
              </DropdownMenuItem>
              <DropdownMenuItem className="text-[#a53b3b] focus:text-[#a53b3b]" disabled={t.status === "COMPLETED"} onClick={() => setConfirm({ kind: "cancel", task: t })}>
                <Trash2 className="mr-2 h-3.5 w-3.5" /> Cancel task
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        mobileCard={(t) => (
          <GlassCard subtle className="p-3">
            <div className="flex items-center justify-between gap-2">
              <Chip tone="gray" className="font-mono">{t.ref}</Chip>
              <StatusBadge status={t.status} />
            </div>
            <div className="mt-1.5 text-sm font-medium text-[color:var(--ink)]">{t.title}</div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <StatusBadge status={t.priority} />
              <Chip tone="gray">{t.assigneeLabel}</Chip>
              <span className={cn("text-xs text-[color:var(--ink-faint)]", t.status === "OVERDUE" && "font-semibold text-[#a53b3b]")}>Due {fmtDate(t.dueDate)}</span>
            </div>
          </GlassCard>
        )}
      />

      {/* Assign task dialog */}
      <GlassDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Assign task"
        description="Create a reporting task and notify the selected audience. Acknowledgement and completion are tracked per recipient."
        wide
        footer={
          <>
            <Button variant="outline" className="glass-subtle rounded-2xl" onClick={() => setCreateOpen(false)} disabled={createMut.pending}>Cancel</Button>
            <ActionButton pending={createMut.pending} onClick={() => void submitCreate()}>Assign task</ActionButton>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" required error={formErrors.title}>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="glass-subtle rounded-2xl border-white/60" placeholder="e.g. Submit Q2 water withdrawal data" />
          </Field>
          <Field label="Category">
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger className="glass-subtle rounded-2xl border-white/60"><SelectValue /></SelectTrigger>
              <SelectContent className="glass-strong rounded-2xl border-white/70">
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description">
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="glass-subtle rounded-2xl border-white/60" placeholder="What exactly should the recipients do?" />
            </Field>
          </div>
          <Field label="Assign to" required>
            <Select
              value={assignType}
              onValueChange={(v) => {
                const t = v as AssigneeType;
                setAssignType(t);
                setForm((f) => {
                  const n = estimateFor(t, { role: f.assigneeRole, buId: f.assigneeBuId, subId: f.assigneeSubId });
                  return { ...f, recipients: n > 0 ? String(n) : t === "USER" ? "1" : f.recipients };
                });
              }}
            >
              <SelectTrigger className="glass-subtle rounded-2xl border-white/60"><SelectValue /></SelectTrigger>
              <SelectContent className="glass-strong rounded-2xl border-white/70">
                {ASSIGNEE_TYPES.map((a) => (
                  <SelectItem key={a} value={a}>{ASSIGNEE_TYPE_LABELS[a]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {assignType === "USER" && (
            <Field label="Responsible user" required error={formErrors.assigneeUserId}>
              <Select value={form.assigneeUserId} onValueChange={(v) => setForm({ ...form, assigneeUserId: v })}>
                <SelectTrigger className="glass-subtle rounded-2xl border-white/60"><SelectValue placeholder="Select user" /></SelectTrigger>
                <SelectContent className="glass-strong rounded-2xl border-white/70">
                  <SelectItem value="NONE" disabled>Select user…</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name} — {ROLE_LABELS[u.role] ?? u.role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          {assignType === "ROLE" && (
            <Field label="Role group" required error={form.assigneeRole === "NONE" ? formErrors.assigneeRole : undefined}>
              <Select
                value={form.assigneeRole}
                onValueChange={(v) =>
                  setForm((f) => {
                    const n = estimateFor("ROLE", { role: v });
                    return { ...f, assigneeRole: v, recipients: n > 0 ? String(n) : f.recipients };
                  })
                }
              >
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
          {assignType === "BU" && (
            <Field label="Business unit" required error={form.assigneeBuId === "NONE" ? formErrors.assigneeBuId : undefined}>
              <Select
                value={form.assigneeBuId}
                onValueChange={(v) =>
                  setForm((f) => {
                    const n = estimateFor("BU", { buId: v });
                    return { ...f, assigneeBuId: v, recipients: n > 0 ? String(n) : f.recipients };
                  })
                }
              >
                <SelectTrigger className="glass-subtle rounded-2xl border-white/60"><SelectValue placeholder="Select business unit" /></SelectTrigger>
                <SelectContent className="glass-strong rounded-2xl border-white/70">
                  <SelectItem value="NONE" disabled>Select business unit…</SelectItem>
                  {(unitsApi.data?.businessUnits ?? []).map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          {assignType === "SUBSIDIARY" && (
            <Field label="Subsidiary" required error={form.assigneeSubId === "NONE" ? formErrors.assigneeSubId : undefined}>
              <Select
                value={form.assigneeSubId}
                onValueChange={(v) =>
                  setForm((f) => {
                    const n = estimateFor("SUBSIDIARY", { subId: v });
                    return { ...f, assigneeSubId: v, recipients: n > 0 ? String(n) : f.recipients };
                  })
                }
              >
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
          {assignType === "ALL" && (
            <Field label="Audience" hint="Task is dispatched to every eligible reporting user in the group.">
              <div className="glass-subtle flex h-10 items-center gap-2 rounded-2xl border border-white/60 px-3 text-sm text-[color:var(--ink-soft)]">
                <UsersIcon className="h-4 w-4 text-[color:var(--esg-blue)]" /> All eligible users
              </div>
            </Field>
          )}
          <Field label="Priority">
            <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
              <SelectTrigger className="glass-subtle rounded-2xl border-white/60"><SelectValue /></SelectTrigger>
              <SelectContent className="glass-strong rounded-2xl border-white/70">
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Start date" hint="Defaults to today when empty.">
            <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="glass-subtle rounded-2xl border-white/60" />
          </Field>
          <Field label="Due date" required error={formErrors.dueDate}>
            <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="glass-subtle rounded-2xl border-white/60" />
          </Field>
          <Field label="Recipients" hint={estimatedRecipients > 0 ? `Estimated audience from directory: ${estimatedRecipients} user${estimatedRecipients === 1 ? "" : "s"}.` : "Select the audience to estimate recipients."}>
            <Input
              type="number"
              min={1}
              value={form.recipients}
              onChange={(e) => setForm({ ...form, recipients: e.target.value })}
              className="glass-subtle rounded-2xl border-white/60"
            />
          </Field>
          <div className="flex items-center justify-between gap-4 rounded-2xl bg-white/40 px-3.5 py-2.5 sm:col-span-2">
            <div>
              <div className="text-[13px] font-medium text-[color:var(--ink)]">Requires evidence</div>
              <div className="text-xs text-[color:var(--ink-faint)]">Recipients must attach supporting documents to their submission.</div>
            </div>
            <Switch checked={form.requiresEvidence} onCheckedChange={(v) => setForm({ ...form, requiresEvidence: v })} aria-label="Requires evidence" />
          </div>
        </div>
      </GlassDialog>

      {/* Extend dialog */}
      <GlassDialog
        open={extendTarget !== null}
        onOpenChange={(o) => !o && setExtendTarget(null)}
        title={`Extend due date — ${extendTarget?.ref ?? ""}`}
        description="The extension is recorded in the audit log with the previous and new due dates."
        footer={
          <>
            <Button variant="outline" className="glass-subtle rounded-2xl" onClick={() => setExtendTarget(null)} disabled={patchMut.pending}>Cancel</Button>
            <ActionButton pending={patchMut.pending} onClick={() => void runExtend()} disabled={!newDue}>Extend</ActionButton>
          </>
        }
      >
        <Field label="New due date" required>
          <Input type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)} className="glass-subtle rounded-2xl border-white/60" />
        </Field>
      </GlassDialog>

      {/* Complete / cancel confirms */}
      <ConfirmDialog
        open={confirm?.kind === "complete"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Mark ${confirm?.task.ref ?? ""} complete?`}
        message="The task is closed as completed for all recipients. Completed tasks are part of reporting history and cannot be cancelled."
        confirmLabel="Mark complete"
        pending={patchMut.pending}
        onConfirm={(reason) => void runComplete(reason)}
      />
      <ConfirmDialog
        open={confirm?.kind === "cancel"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Cancel ${confirm?.task.ref ?? ""}?`}
        message="The task is cancelled and closed for all recipients. It is retained in reporting history for audit purposes."
        confirmLabel="Cancel task"
        destructive
        requireReason
        pending={deleteMut.pending}
        onConfirm={(reason) => void runCancel(reason)}
      />
    </div>
  );
}
