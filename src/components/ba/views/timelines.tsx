"use client";

// ── BU ADMIN · SCREEN 06 — Reporting Timelines ──
// BU Admin may set PROJECT-level deadlines only. Subsidiary-level + BU-level
// timelines are inherited — shown as locked in the FE.

import { useEffect, useMemo, useState } from "react";
import {
  Calendar, CalendarClock, Lock, MoreHorizontal, Plus, Save, Sparkles,
} from "lucide-react";
import { HourglassIcon } from "@/components/workspace/premium-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useBaApi, apiPost, apiPatch, fmtDate, fmtDateTime } from "@/lib/ba/client";
import { useBaWorkspace } from "@/lib/ba/store";
import type { TimelineRow } from "@/lib/ba/types";
import { DEADLINE_STATUS_LABELS } from "@/lib/ba/types";
import {
  Chip, ConfirmDialog, DataTable, EmptyState, ErrorState, GlassDialog, GlassProgress, LoadingBlock, PageHeader, SectionCard, StatusBadge, Toolbar, type Column,
} from "@/components/workspace/ui";
import { useToast } from "@/hooks/use-toast";

type TimelinesResponse = { timelines: TimelineRow[] };

export default function TimelinesView() {
  const { navigate, params, reportingYear } = useBaWorkspace();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterLevel, setFilterLevel] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TimelineRow | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const apiPath = `/api/ba/timelines?period=${encodeURIComponent(reportingYear)}`;
  const { data, loading, error, refetch } = useBaApi<TimelinesResponse>(apiPath, { deps: [reportingYear] });

  const q = search.toLowerCase();
  const all = data?.timelines ?? [];
  const rows = useMemo(() => {
    let r = all;
    if (q) r = r.filter((t) => `${t.ref} ${t.name} ${t.orgName}`.toLowerCase().includes(q));
    if (filterLevel !== "ALL") r = r.filter((t) => t.level === filterLevel);
    if (filterStatus !== "ALL") r = r.filter((t) => t.deadlineStatus === filterStatus);
    return r;
  }, [all, q, filterLevel, filterStatus]);

  /* honor deep-link create */
  useEffect(() => {
    if (params.create) {
      setCreateOpen(true);
      navigate("timelines", { ...params, create: undefined });
    }
     
  }, []);

  const summary = useMemo(() => {
    const now = Date.now();
    const upcoming = all.filter((t) => t.effectiveDueDate && new Date(t.effectiveDueDate).getTime() > now && (new Date(t.effectiveDueDate).getTime() - now) < 14 * 86400000);
    const overdue = all.filter((t) => t.deadlineStatus === "OVERDUE");
    const overrides = all.filter((t) => t.inheritanceMode === "OVERRIDE");
    return { upcoming: upcoming.length, overdue: overdue.length, overrides: overrides.length, total: all.length };
  }, [all]);

  const columns: Column<TimelineRow>[] = [
    {
      key: "name", header: "Timeline", sortable: true, sortValue: (r) => r.name,
      render: (r) => (
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-[color:var(--ink)]">{r.name}</div>
          <div className="truncate text-[11px] text-[color:var(--ink-faint)]">{r.ref} · {r.orgName}</div>
        </div>
      ),
    },
    {
      key: "level", header: "Level", sortable: true, sortValue: (r) => r.level,
      render: (r) => <Chip tone={r.level === "SUBSIDIARY" ? "purple" : r.level === "BUSINESS_UNIT" ? "blue" : "green"}>{r.level.replace(/_/g, " ")}</Chip>,
    },
    { key: "period", header: "Period", render: (r) => <span className="text-[12px] text-[color:var(--ink-soft)]">{r.period}</span> },
    {
      key: "effective",
      header: "Effective due",
      sortable: true,
      sortValue: (r) => r.effectiveDueDate ?? "",
      render: (r) => (
        <div className="min-w-0">
          <div className="text-[12.5px] font-semibold text-[color:var(--ink)]">{r.effectiveDueDate ? fmtDate(r.effectiveDueDate) : "—"}</div>
          <div className="text-[10.5px] text-[color:var(--ink-faint)]">{r.sourceLabel}</div>
        </div>
      ),
    },
    {
      key: "mode", header: "Mode", sortable: true, sortValue: (r) => r.inheritanceMode,
      render: (r) => <Chip tone={r.inheritanceMode === "OVERRIDE" ? "blue" : "gray"}>{r.inheritanceMode}</Chip>,
    },
    {
      key: "status", header: "Deadline state", sortable: true, sortValue: (r) => r.deadlineStatus,
      render: (r) => <StatusBadge status={r.deadlineStatus} />,
    },
    {
      key: "locked", header: "Edit",
      render: (r) => r.level === "PROJECT" ? (
        <Button variant="ghost" size="sm" className="h-8 rounded-xl" onClick={() => setEditTarget(r)}>Edit deadline</Button>
      ) : (
        <Chip tone="gray"><Lock className="mr-1 h-3 w-3" /> Locked</Chip>
      ),
    },
  ];

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="Reporting Timelines"
        description={`${reportingYear} · Project-level deadlines assigned within your BU. Subsidiary and BU-level windows are inherited and locked — they are owned by the Subsidiary Admin.`}
        icon={HourglassIcon}
        actions={
          <Button className="btn-ba-action rounded-2xl" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Assign project deadline
          </Button>
        }
      />

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryTile icon={Calendar} label="Active timelines" value={summary.total} tone="blue" />
        <SummaryTile icon={CalendarClock} label="Due in 14d" value={summary.upcoming} tone="amber" />
        <SummaryTile icon={CalendarClock} label="Overdue" value={summary.overdue} tone="red" />
        <SummaryTile icon={Sparkles} label="BU overrides" value={summary.overrides} tone="purple" />
      </div>

      {/* Inherited subsidiary timeline callout */}
      {all.some((t) => t.level === "SUBSIDIARY") && (
        <div className="glass-ba glass-sheen flex items-start gap-3 rounded-3xl p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[rgba(106,91,255,0.12)] text-[#5546d6]"><Lock className="h-4 w-4" /></span>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-[color:var(--ink)]">Subsidiary mandatory window — inherited</div>
            <p className="mt-0.5 text-[12px] text-[color:var(--ink-soft)]">
              The subsidiary-level deadline is the upper bound for project deadlines in your BU. Project overrides cannot extend past it.
              {all.find((t) => t.level === "SUBSIDIARY")?.effectiveDueDate && ` Effective subsidiary due: ${fmtDate(all.find((t) => t.level === "SUBSIDIARY")!.effectiveDueDate!)}.`}
            </p>
          </div>
        </div>
      )}

      <Toolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search timeline, ref or org…"
        filters={[
          { key: "level", label: "Level", options: [{ value: "ALL", label: "All levels" }, { value: "SUBSIDIARY", label: "Subsidiary" }, { value: "BUSINESS_UNIT", label: "Business unit" }, { value: "PROJECT", label: "Project" }], value: filterLevel, onChange: setFilterLevel },
          { key: "status", label: "Deadline state", options: [{ value: "ALL", label: "All" }, ...Object.keys(DEADLINE_STATUS_LABELS).map((k) => ({ value: k, label: DEADLINE_STATUS_LABELS[k] }))], value: filterStatus, onChange: setFilterStatus },
        ]}
        onReset={() => { setSearch(""); setFilterLevel("ALL"); setFilterStatus("ALL"); }}
        resultCount={rows.length}
      />

      <DataTable<TimelineRow>
        columns={columns}
        rows={rows}
        loading={loading && !data}
        error={error && !data ? error : null}
        onRetry={refetch}
        pageSize={10}
        emptyTitle={all.length === 0 ? "No timelines yet" : "No matches"}
        emptyMessage={all.length === 0 ? "Assign a project deadline to start tracking." : "Try adjusting the filters."}
        mobileCard={(r) => (
          <div className="flex flex-col gap-2 p-3">
            <div className="flex items-start justify-between gap-2"><div><div className="text-[13px] font-semibold">{r.name}</div><div className="text-[11px] text-[color:var(--ink-faint)]">{r.ref} · {r.orgName}</div></div><Chip tone={r.level === "SUBSIDIARY" ? "purple" : r.level === "BUSINESS_UNIT" ? "blue" : "green"}>{r.level.replace(/_/g, " ")}</Chip></div>
            <div className="flex items-center justify-between text-[11px]"><span>Effective: {r.effectiveDueDate ? fmtDate(r.effectiveDueDate) : "—"}</span><StatusBadge status={r.deadlineStatus} /></div>
            <div className="text-[11px] text-[color:var(--ink-faint)]">{r.sourceLabel}</div>
          </div>
        )}
      />

      <CreateDeadlineDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onConfirm={(payload) => {
          setCreateOpen(false);
          setEditTarget(null);
          void (async () => {
            try {
              await apiPost("/api/ba/timelines", payload);
              toast({ title: "Project deadline assigned", description: `${payload.name} — due ${fmtDate(payload.dueDate ?? "")}.` });
              refetch();
            } catch (e) {
              toast({ title: "Could not save timeline", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
              setCreateOpen(true);
            }
          })();
        }}
      />

      {editTarget && (
        <EditDeadlineDialog
          target={editTarget}
          onOpenChange={(o) => { if (!o) setEditTarget(null); }}
          onConfirm={(payload) => {
            const target = editTarget;
            setEditTarget(null);
            setConfirmOpen(false);
            void (async () => {
              try {
                await apiPatch(`/api/ba/timelines/${target.id}`, { ...payload, orgId: target.orgId ?? undefined });
                toast({ title: "Timeline updated", description: `${target.name} — effective due ${payload.dueDate ? fmtDate(payload.dueDate) : "inherited"}.` });
                refetch();
              } catch (e) {
                toast({ title: "Could not save timeline", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
                setEditTarget(target);
              }
            })();
          }}
        />
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirm deadline change"
        message="Changing a project deadline will inherit/override the subsidiary mandatory window. The change will be audited."
        confirmLabel="Save"
        onConfirm={() => setConfirmOpen(false)}
      />
    </div>
  );
}

function SummaryTile({ icon: Icon, label, value, tone }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; tone: "blue" | "amber" | "red" | "purple" }) {
  const hues: Record<string, string> = { blue: "#348BE8", amber: "#c57926", red: "#E35D6A", purple: "#8B5CF6" };
  return (
    <div className="glass-ba glass-sheen flex items-center gap-3 rounded-3xl p-4">
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl text-white" style={{ background: `linear-gradient(135deg, ${hues[tone]}, color-mix(in srgb, ${hues[tone]} 60%, #17263d))` }}>
        <Icon className="h-5 w-5 text-white" />
      </span>
      <div>
        <div className="text-[20px] font-bold tabular text-[color:var(--ink)]">{value}</div>
        <div className="text-[11px] font-medium text-[color:var(--ink-faint)]">{label}</div>
      </div>
    </div>
  );
}

function CreateDeadlineDialog({
  open, onOpenChange, onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: (payload: {
    name: string; period: string; level: string; orgId: string;
    startDate: string; dueDate: string; reviewDeadline?: string | null;
    categories: string[]; inheritanceMode: string; overrideReason: string; notify: boolean; status: string;
  }) => void;
}) {
  const { reportingYear } = useBaWorkspace();
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [projectId, setProjectId] = useState("");
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [reviewDeadline, setReviewDeadline] = useState("");
  const [inheritanceMode, setInheritanceMode] = useState<"INHERIT" | "OVERRIDE">("OVERRIDE");
  const [overrideReason, setOverrideReason] = useState("");
  const [notify, setNotify] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  /* Reset the form each time the dialog opens — adjusted during render
     (React's prev-value pattern) instead of a synchronous setState effect. */
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevYear, setPrevYear] = useState(reportingYear);
  if (open && (open !== prevOpen || reportingYear !== prevYear)) {
    setPrevOpen(open);
    setPrevYear(reportingYear);
    setName(`${reportingYear} reporting deadline`);
    setStartDate(new Date().toISOString().slice(0, 10));
    setDueDate("");
    setReviewDeadline("");
    setInheritanceMode("OVERRIDE");
    setOverrideReason("");
    setNotify(true);
    setErr(null);
  } else if (!open && prevOpen) {
    setPrevOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    let alive = true;
    void fetch("/api/ba/projects?pageSize=50").then((r) => r.json()).then((d: { projects: { id: string; name: string }[] }) => {
      if (!alive) return;
      setProjects(d.projects ?? []);
      setProjectId(d.projects?.[0]?.id ?? "");
    });
    return () => {
      alive = false;
    };
  }, [open]);

  const submit = () => {
    if (!projectId) return setErr("Select a project.");
    if (name.trim().length < 2) return setErr("Timeline name is required.");
    if (!startDate) return setErr("Start date is required.");
    if (inheritanceMode === "OVERRIDE" && !dueDate) return setErr("Due date is required when overriding.");
    if (inheritanceMode === "OVERRIDE" && overrideReason.trim().length < 4) return setErr("An override reason (min 4 characters) is required.");
    onConfirm({
      name: name.trim(), period: reportingYear, level: "PROJECT", orgId: projectId,
      startDate, dueDate, reviewDeadline: reviewDeadline || null,
      categories: [], inheritanceMode, overrideReason: overrideReason.trim(), notify, status: "ACTIVE",
    });
  };

  return (
    <GlassDialog open={open} onOpenChange={onOpenChange} title="Assign a project deadline" description="BU Admin can only set PROJECT-level deadlines. The subsidiary mandatory window is enforced server-side as the upper bound." wide>
      <div className="grid gap-3">
        <Field label="Project" required>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="glass-subtle rounded-2xl border-white/60 text-sm"><SelectValue placeholder="Choose a project under your BU" /></SelectTrigger>
            <SelectContent className="glass-strong rounded-2xl border-white/70">
              {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Timeline name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="glass-subtle rounded-2xl border-white/60 text-sm" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date" required><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="glass-subtle rounded-2xl border-white/60 text-sm" /></Field>
          <Field label="Due date" required={inheritanceMode === "OVERRIDE"}><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="glass-subtle rounded-2xl border-white/60 text-sm" /></Field>
        </div>
        <Field label="Review deadline (optional)"><Input type="date" value={reviewDeadline} onChange={(e) => setReviewDeadline(e.target.value)} className="glass-subtle rounded-2xl border-white/60 text-sm" /></Field>
        <Field label="Inheritance mode">
          <Select value={inheritanceMode} onValueChange={(v) => setInheritanceMode(v as "INHERIT" | "OVERRIDE")}>
            <SelectTrigger className="glass-subtle rounded-2xl border-white/60 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent className="glass-strong rounded-2xl border-white/70">
              <SelectItem value="OVERRIDE">Override (set explicit due date)</SelectItem>
              <SelectItem value="INHERIT">Inherit (fall back to parent)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {inheritanceMode === "OVERRIDE" && (
          <Field label="Override reason" required hint="Required when overriding — audited as TIMELINE_UPDATE.">
            <Textarea value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} rows={3} className="glass-subtle rounded-2xl border-white/60 text-sm" placeholder="Document why this project's deadline differs from the inherited subsidiary window…" />
          </Field>
        )}
        <div className="flex items-center gap-2">
          <Switch checked={notify} onCheckedChange={setNotify} id="notify" />
          <label htmlFor="notify" className="text-[13px] text-[color:var(--ink-soft)]">Notify BU contributors of this deadline</label>
        </div>
        {err && <p className="text-xs text-[#c34a4a]">{err}</p>}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" className="rounded-2xl" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button className="btn-ba-action rounded-2xl" onClick={submit}><Save className="mr-1.5 h-4 w-4" /> Assign deadline</Button>
      </div>
    </GlassDialog>
  );
}

function EditDeadlineDialog({
  target, onOpenChange, onConfirm,
}: {
  target: TimelineRow;
  onOpenChange: (o: boolean) => void;
  onConfirm: (payload: {
    name: string; period: string; startDate: string; dueDate: string | null;
    reviewDeadline?: string | null; inheritanceMode: string; overrideReason: string; notify: boolean; status: string;
  }) => void;
}) {
  const [name, setName] = useState(target.name);
  const [startDate, setStartDate] = useState(target.startDate ? target.startDate.slice(0, 10) : "");
  const [dueDate, setDueDate] = useState(target.dueDate ? target.dueDate.slice(0, 10) : "");
  const [reviewDeadline, setReviewDeadline] = useState(target.reviewDeadline ? target.reviewDeadline.slice(0, 10) : "");
  const [inheritanceMode, setInheritanceMode] = useState<"INHERIT" | "OVERRIDE">(target.inheritanceMode as "INHERIT" | "OVERRIDE" ?? "OVERRIDE");
  const [overrideReason, setOverrideReason] = useState(target.overrideReason);
  const [notify, setNotify] = useState(target.notify);
  const [err, setErr] = useState<string | null>(null);

  /* Re-seed the form whenever a different target row is opened — adjusted
     during render (React's prev-value pattern) instead of a sync effect. */
  const [prevTarget, setPrevTarget] = useState(target);
  if (prevTarget !== target) {
    setPrevTarget(target);
    setName(target.name);
    setStartDate(target.startDate ? target.startDate.slice(0, 10) : "");
    setDueDate(target.dueDate ? target.dueDate.slice(0, 10) : "");
    setReviewDeadline(target.reviewDeadline ? target.reviewDeadline.slice(0, 10) : "");
    setInheritanceMode((target.inheritanceMode as "INHERIT" | "OVERRIDE") ?? "OVERRIDE");
    setOverrideReason(target.overrideReason);
    setNotify(target.notify);
    setErr(null);
  }

  const submit = () => {
    if (name.trim().length < 2) return setErr("Timeline name is required.");
    if (!startDate) return setErr("Start date is required.");
    if (inheritanceMode === "OVERRIDE" && !dueDate) return setErr("Due date is required when overriding.");
    if (inheritanceMode === "OVERRIDE" && overrideReason.trim().length < 4) return setErr("An override reason (min 4 characters) is required.");
    onConfirm({
      name: name.trim(), period: target.period, startDate, dueDate: dueDate || null,
      reviewDeadline: reviewDeadline || null, inheritanceMode, overrideReason: overrideReason.trim(), notify, status: "ACTIVE",
    });
  };

  return (
    <GlassDialog open={!!target} onOpenChange={onOpenChange} title="Edit project deadline" description={`${target.ref} · ${target.orgName} · ${target.period}`} wide>
      <div className="grid gap-3">
        <div className="text-[11px] text-[color:var(--ink-faint)]">Source: {target.sourceLabel} · Last updated {fmtDateTime(target.updatedAt)}</div>
        <Field label="Timeline name" required><Input value={name} onChange={(e) => setName(e.target.value)} className="glass-subtle rounded-2xl border-white/60 text-sm" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date" required><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="glass-subtle rounded-2xl border-white/60 text-sm" /></Field>
          <Field label="Due date" required={inheritanceMode === "OVERRIDE"}><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="glass-subtle rounded-2xl border-white/60 text-sm" /></Field>
        </div>
        <Field label="Review deadline (optional)"><Input type="date" value={reviewDeadline} onChange={(e) => setReviewDeadline(e.target.value)} className="glass-subtle rounded-2xl border-white/60 text-sm" /></Field>
        <Field label="Inheritance mode">
          <Select value={inheritanceMode} onValueChange={(v) => setInheritanceMode(v as "INHERIT" | "OVERRIDE")}>
            <SelectTrigger className="glass-subtle rounded-2xl border-white/60 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent className="glass-strong rounded-2xl border-white/70">
              <SelectItem value="OVERRIDE">Override (explicit due date)</SelectItem>
              <SelectItem value="INHERIT">Inherit from BU / subsidiary</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {inheritanceMode === "OVERRIDE" && (
          <Field label="Override reason" required hint="Audited as TIMELINE_UPDATE with the reason.">
            <Textarea value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} rows={3} className="glass-subtle rounded-2xl border-white/60 text-sm" />
          </Field>
        )}
        <div className="flex items-center gap-2">
          <Switch checked={notify} onCheckedChange={setNotify} id="notify-edit" />
          <label htmlFor="notify-edit" className="text-[13px] text-[color:var(--ink-soft)]">Notify BU contributors of this change</label>
        </div>
        {err && <p className="text-xs text-[#c34a4a]">{err}</p>}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" className="rounded-2xl" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button className="btn-ba-action rounded-2xl" onClick={submit}><Save className="mr-1.5 h-4 w-4" /> Save deadline</Button>
      </div>
    </GlassDialog>
  );
}

function Field({ label, required, hint, children, error }: { label: string; required?: boolean; hint?: string; children: React.ReactNode; error?: string | null }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium text-[color:var(--ink)]">{label} {required && <span className="text-[#c34a4a]">*</span>}</label>
      {children}
      {hint && !error && <p className="text-xs text-[color:var(--ink-faint)]">{hint}</p>}
      {error && <p className="text-xs text-[#c34a4a]">{error}</p>}
    </div>
  );
}

void GlassProgress; void MoreHorizontal; void LoadingBlock;
