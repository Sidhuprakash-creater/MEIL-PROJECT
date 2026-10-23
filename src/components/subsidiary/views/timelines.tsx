"use client";

// ── SUBSIDIARY ADMIN · SCREEN 07 — Reporting Timelines (CORE module) ──
// Deadline inheritance: subsidiary root window → BU → project. Every override
// requires a reason, is audited server-side and cascades to child entities.
import { useEffect, useState } from "react";
import {
  ArrowRight, BellRing, CalendarClock, GitMerge, Pencil, Plus, Trash2,
} from "lucide-react";
import {
  AlarmAlertIcon, CheckSealIcon, HourglassIcon, NetworkIcon, ProjectsIcon, UnitsIcon,
} from "@/components/workspace/premium-icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useSaWorkspace } from "@/lib/sa/store";
import {
  apiDelete, apiPatch, apiPost, daysUntil, fmtDate, useMutation, useSaApi,
} from "@/lib/sa/client";
import {
  CATEGORY_LABELS, DEADLINE_STATUS_LABELS, SA_CATEGORIES,
} from "@/lib/sa/types";
import type { TimelineRow, TimelineSummary, UnitRow, ProjectRow } from "@/lib/sa/types";
import {
  ActionButton, Chip, EmptyState, ErrorState, ExportButton, Field, GlassCard, GlassDialog,
  ConfirmDialog, KpiCard, LoadingBlock, PageHeader, SectionCard, Toolbar,
} from "@/components/workspace/ui";

/* ── helpers ─────────────────────────────────────────────────────────── */

const COMPLETE_STATUSES = ["SUBMITTED_ON_TIME", "CLOSED"];
const PENDING_STATUSES = ["IN_PROGRESS", "DUE_SOON", "UPCOMING", "NOT_STARTED"];
const OVERDUE_STATUSES = ["OVERDUE", "SUBMITTED_LATE"];

function matchStatus(t: TimelineRow, f: string): boolean {
  switch (f) {
    case "ALL": return true;
    case "OVERRIDE": return t.inheritanceMode === "OVERRIDE";
    case "COMPLETE": return COMPLETE_STATUSES.includes(t.deadlineStatus);
    case "PENDING": return PENDING_STATUSES.includes(t.deadlineStatus);
    case "OVERDUE": return OVERDUE_STATUSES.includes(t.deadlineStatus);
    default: return t.deadlineStatus === f;
  }
}

function statusTone(s: string): "red" | "amber" | "green" | "blue" {
  if (OVERDUE_STATUSES.includes(s)) return "red";
  if (s === "DUE_SOON") return "amber";
  if (COMPLETE_STATUSES.includes(s)) return "green";
  return "blue";
}

const LEVEL_META: Record<TimelineRow["level"], { tone: "blue" | "purple" | "teal"; label: string }> = {
  SUBSIDIARY: { tone: "blue", label: "Subsidiary" },
  BUSINESS_UNIT: { tone: "purple", label: "Business unit" },
  PROJECT: { tone: "teal", label: "Project" },
};

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "ALL", label: "All statuses" },
  { value: "PENDING", label: "Pending (in progress / upcoming)" },
  { value: "COMPLETE", label: "Complete (submitted / closed)" },
  { value: "OVERDUE", label: "Overdue (incl. late submissions)" },
  { value: "DUE_SOON", label: "Due soon" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "UPCOMING", label: "Upcoming" },
  { value: "NOT_STARTED", label: "Not started" },
  { value: "SUBMITTED_ON_TIME", label: "Submitted on time" },
  { value: "SUBMITTED_LATE", label: "Submitted late" },
  { value: "CLOSED", label: "Closed" },
  { value: "OVERRIDE", label: "Overrides (any status)" },
];

interface TimelineSaveRes {
  timeline: TimelineRow;
  affected: { buCount: number; projectCount: number };
}

interface FormState {
  name: string;
  period: string;
  level: TimelineRow["level"];
  orgId: string;
  startDate: string;
  dueDate: string;
  reviewDeadline: string;
  categories: string[];
  inheritanceMode: "INHERIT" | "OVERRIDE";
  overrideReason: string;
  notify: boolean;
}

const emptyForm = (period: string): FormState => ({
  name: "", period, level: "SUBSIDIARY", orgId: "", startDate: "", dueDate: "",
  reviewDeadline: "", categories: [], inheritanceMode: "INHERIT", overrideReason: "", notify: true,
});

/* ── small presentational bits ───────────────────────────────────────── */

function NotifyPill({ notify }: { notify: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[color:var(--ink-faint)]"
      title={notify ? "Deadline reminders are on" : "Reminders are off for this timeline"}
    >
      <span className={`relative h-4 w-7 rounded-full transition-colors ${notify ? "bg-[#238653]" : "bg-[rgba(102,119,141,0.35)]"}`}>
        <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-all ${notify ? "left-3.5" : "left-0.5"}`} />
      </span>
      <BellRing className="h-3 w-3" aria-hidden />
      Reminders {notify ? "on" : "off"}
    </span>
  );
}

function TimelineCard({ t, onEdit, onDelete }: { t: TimelineRow; onEdit: () => void; onDelete: () => void }) {
  const lvl = LEVEL_META[t.level];
  return (
    <GlassCard className="p-4 transition-all duration-200 hover:bg-white/80">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-[14.5px] font-bold text-[color:var(--ink)]">{t.name}</h3>
            <Chip tone="gray" className="font-mono text-[10px]">{t.ref}</Chip>
            <Chip tone={lvl.tone}>{lvl.label}</Chip>
            <Chip tone={statusTone(t.deadlineStatus)}>{DEADLINE_STATUS_LABELS[t.deadlineStatus] ?? t.deadlineStatus}</Chip>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-[color:var(--ink-faint)]">
            <span className="font-medium text-[color:var(--ink-soft)]">{t.orgName}</span>
            <span>Start {fmtDate(t.startDate)} → Due {fmtDate(t.dueDate)}</span>
            <span>Review by {fmtDate(t.reviewDeadline)}</span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11.5px]">
            <span className="text-[color:var(--ink-faint)]">Effective deadline:</span>
            <span className="font-semibold text-[color:var(--ink)]">{fmtDate(t.effectiveDueDate)}</span>
            <Chip tone="gray">{t.sourceLabel}</Chip>
            {t.inheritanceMode === "OVERRIDE" ? (
              <span title={t.overrideReason ? `Override reason: ${t.overrideReason}` : "Override"}>
                <Chip tone="amber">Override</Chip>
              </span>
            ) : (
              <span title="This entity inherits the deadline from its parent level">
                <Chip tone="blue">Inherit</Chip>
              </span>
            )}
            <NotifyPill notify={t.notify} />
          </div>

          {t.categories.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {t.categories.map((c) => (
                <Chip key={c} tone="gray" className="px-1.5 py-0 text-[10px]">{CATEGORY_LABELS[c] ?? c}</Chip>
              ))}
            </div>
          )}

          {t.inheritanceMode === "OVERRIDE" && t.overrideReason && (
            <p className="mt-2 rounded-2xl border border-[rgba(197,121,38,0.28)] bg-[rgba(197,121,38,0.09)] px-3 py-1.5 text-[11.5px] text-[#9c5d1b]">
              Override reason: {t.overrideReason}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="glass-subtle h-8 rounded-2xl border-white/60 text-xs"
            onClick={onEdit}
          >
            <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 rounded-2xl text-xs text-[#a53b3b] hover:bg-[rgba(195,74,74,0.1)] hover:text-[#a53b3b]"
            onClick={onDelete}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
          </Button>
        </div>
      </div>
    </GlassCard>
  );
}

/* ── view ────────────────────────────────────────────────────────────── */

export default function TimelinesView() {
  const { navigate, reportingYear } = useSaWorkspace();
  const { toast } = useToast();

  const { data, loading, error, refetch } = useSaApi<{ timelines: TimelineRow[]; summary: TimelineSummary }>(
    `/api/sa/timelines?period=${encodeURIComponent(reportingYear)}`,
    { deps: [reportingYear] }
  );

  /* Deep-link params are read once at first render (the shell mounts this view
     fresh on every navigation) and cleared from the store in a mount effect. */
  const params0 = useSaWorkspace.getState().params;

  const [levelFilter, setLevelFilter] = useState<string>(() => {
    const l = String(params0.level ?? "");
    return ["SUBSIDIARY", "BUSINESS_UNIT", "PROJECT"].includes(l) ? l : "ALL";
  });
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  const [formOpen, setFormOpen] = useState<boolean>(() => !!params0.create);
  const [editing, setEditing] = useState<TimelineRow | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm(reportingYear));
  const [errs, setErrs] = useState<Partial<Record<string, string>>>({});
  const [deleteTarget, setDeleteTarget] = useState<TimelineRow | null>(null);

  const save = useMutation<TimelineSaveRes>();
  const del = useMutation();

  /* Org pickers — only fetched while the form dialog is open. */
  const unitsRes = useSaApi<{ units: UnitRow[] }>(formOpen ? "/api/sa/units?pageSize=50" : null, { pollMs: 0 });
  const projectsRes = useSaApi<{ projects: ProjectRow[] }>(formOpen ? "/api/sa/projects?pageSize=50" : null, { pollMs: 0 });

  useEffect(() => {
    navigate("timelines"); // clear deep-link params (external zustand store)
  }, []);

  const timelines = data?.timelines ?? [];
  const summary = data?.summary;

  const filtered = timelines
    .filter((t) => levelFilter === "ALL" || t.level === levelFilter)
    .filter((t) => matchStatus(t, statusFilter))
    .filter((t) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return `${t.name} ${t.ref} ${t.orgName}`.toLowerCase().includes(q);
    });

  const exportRows = filtered.map((t) => ({
    ref: t.ref, name: t.name, period: t.period, level: LEVEL_META[t.level].label, org: t.orgName,
    startDate: t.startDate, dueDate: t.dueDate, reviewDeadline: t.reviewDeadline,
    effectiveDeadline: t.effectiveDueDate, source: t.sourceLabel,
    deadlineStatus: DEADLINE_STATUS_LABELS[t.deadlineStatus] ?? t.deadlineStatus,
    inheritance: t.inheritanceMode, overrideReason: t.overrideReason,
    categories: t.categories.map((c) => CATEGORY_LABELS[c] ?? c).join(" | "), notify: t.notify,
  }));

  /* ── form helpers ── */
  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm(reportingYear));
    setErrs({});
    setFormOpen(true);
  };

  const openEdit = (t: TimelineRow) => {
    setEditing(t);
    setForm({
      name: t.name,
      period: t.period,
      level: t.level,
      orgId: t.orgId ?? "",
      startDate: t.startDate ? t.startDate.slice(0, 10) : "",
      dueDate: t.dueDate ? t.dueDate.slice(0, 10) : "",
      reviewDeadline: t.reviewDeadline ? t.reviewDeadline.slice(0, 10) : "",
      categories: [...t.categories],
      inheritanceMode: t.inheritanceMode,
      overrideReason: t.overrideReason ?? "",
      notify: t.notify,
    });
    setErrs({});
    setFormOpen(true);
  };

  const validate = (): boolean => {
    const e: Partial<Record<string, string>> = {};
    const name = form.name.trim();
    if (name.length < 2 || name.length > 80) e.name = "Name must be 2–80 characters.";
    if (form.level === "BUSINESS_UNIT" && !form.orgId) e.orgId = "Select the business unit this timeline applies to.";
    if (form.level === "PROJECT" && !form.orgId) e.orgId = "Select the project this timeline applies to.";
    if (!form.startDate) e.startDate = "Start date is required.";
    if (!form.dueDate) e.dueDate = "Due date is required.";
    if (form.startDate && form.dueDate && form.startDate >= form.dueDate) e.dueDate = "Start date must be before the due date.";
    if (form.reviewDeadline && form.dueDate && form.reviewDeadline < form.dueDate) e.reviewDeadline = "Review deadline must be on or after the due date.";
    if (form.inheritanceMode === "OVERRIDE") {
      if (!form.dueDate) e.dueDate = "A due date is required when overriding an inherited deadline.";
      if (form.overrideReason.trim().length < 4) e.overrideReason = "An override reason is required (min 4 characters).";
    }
    setErrs(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    const body = {
      name: form.name.trim(),
      period: form.period.trim() || reportingYear,
      level: form.level,
      ...(form.level === "SUBSIDIARY" ? {} : { orgId: form.orgId }),
      startDate: form.startDate,
      dueDate: form.dueDate || null,
      reviewDeadline: form.reviewDeadline || null,
      categories: form.categories,
      inheritanceMode: form.inheritanceMode,
      overrideReason: form.inheritanceMode === "OVERRIDE" ? form.overrideReason.trim() : undefined,
      notify: form.notify,
    };
    const res = editing
      ? await save.run(() => apiPatch<TimelineSaveRes>(`/api/sa/timelines/${editing.id}`, body))
      : await save.run(() => apiPost<TimelineSaveRes>("/api/sa/timelines", body));
    if (!res) {
      toast({ title: "Could not save timeline", description: save.error ?? "Please review the form.", variant: "destructive" });
      return;
    }
    setFormOpen(false);
    toast({
      title: `Timeline saved — ${res.affected.buCount} BU(s) and ${res.affected.projectCount} project(s) inherit this deadline`,
    });
    refetch();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    const res = await del.run(() => apiDelete<{ ok: boolean }>(`/api/sa/timelines/${target.id}`));
    if (!res) {
      toast({ title: "Could not delete timeline", description: del.error ?? "Please retry.", variant: "destructive" });
      return;
    }
    setDeleteTarget(null);
    toast({ title: "Timeline deleted", description: `${target.ref} removed — children fall back to inheriting the parent deadline.` });
    refetch();
  };

  const toggleCategory = (c: string) =>
    setForm((f) => ({
      ...f,
      categories: f.categories.includes(c) ? f.categories.filter((x) => x !== c) : [...f.categories, c],
    }));

  const allCategoriesSelected = form.categories.length === SA_CATEGORIES.length;
  const pendingSave = save.pending;

  if (loading && !data) return <LoadingBlock rows={6} label="Loading reporting timelines…" />;
  if (error && !data) return <ErrorState message={error} onRetry={refetch} />;

  const rootDays = daysUntil(summary?.subsidiaryDeadline ?? null);

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="Reporting Timelines"
        description={`${reportingYear} · Set the reporting windows for your subsidiary, business units and projects. Deadlines cascade down with recorded overrides.`}
        icon={HourglassIcon}
      />

      {/* ── summary strip ── */}
      <div className="grid gap-3 md:grid-cols-2">
        <GlassCard className="flex items-center gap-3 p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-md"
            style={{ background: "linear-gradient(135deg, #3a7bff, color-mix(in srgb, #3a7bff 62%, #17263d))" }}>
            <CalendarClock className="h-5 w-5 text-white" />
          </span>
          <div className="min-w-0">
            <div className="text-[11.5px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">Subsidiary deadline</div>
            <div className="truncate text-[16px] font-bold text-[color:var(--ink)]">
              {summary?.subsidiaryDeadline ? fmtDate(summary.subsidiaryDeadline) : "Not set"}
            </div>
            <div className="text-[11px] text-[color:var(--ink-faint)]">{reportingYear} · root reporting window</div>
          </div>
          {summary?.subsidiaryDeadline && (
            <Chip tone={rootDays !== null && rootDays <= 7 ? "red" : rootDays !== null && rootDays <= 14 ? "amber" : "blue"} className="ml-auto shrink-0">
              {rootDays !== null && rootDays >= 0 ? `${rootDays}d left` : "Past due"}
            </Chip>
          )}
        </GlassCard>

        <KpiCard
          label="Recorded overrides"
          value={summary?.overrides ?? 0}
          icon={GitMerge}
          tone="purple"
          hint="Authorized — each with a reason"
          onClick={() => { setLevelFilter("ALL"); setStatusFilter("OVERRIDE"); }}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="BUs — complete" value={summary?.buComplete ?? 0} icon={CheckSealIcon} tone="green" hint="Submitted or closed"
          onClick={() => { setLevelFilter("BUSINESS_UNIT"); setStatusFilter("COMPLETE"); }} />
        <KpiCard label="BUs — pending" value={summary?.buPending ?? 0} icon={UnitsIcon} tone="blue" hint="In progress / upcoming"
          onClick={() => { setLevelFilter("BUSINESS_UNIT"); setStatusFilter("PENDING"); }} />
        <KpiCard label="BUs — overdue" value={summary?.buOverdue ?? 0} icon={AlarmAlertIcon} tone="red" hint="Past deadline"
          onClick={() => { setLevelFilter("BUSINESS_UNIT"); setStatusFilter("OVERDUE"); }} />
        <KpiCard label="Projects — complete" value={summary?.prjComplete ?? 0} icon={CheckSealIcon} tone="green" hint="Submitted or closed"
          onClick={() => { setLevelFilter("PROJECT"); setStatusFilter("COMPLETE"); }} />
        <KpiCard label="Projects — pending" value={summary?.prjPending ?? 0} icon={ProjectsIcon} tone="blue" hint="In progress / upcoming"
          onClick={() => { setLevelFilter("PROJECT"); setStatusFilter("PENDING"); }} />
        <KpiCard label="Projects — overdue" value={summary?.prjOverdue ?? 0} icon={AlarmAlertIcon} tone="red" hint="Past deadline"
          onClick={() => { setLevelFilter("PROJECT"); setStatusFilter("OVERDUE"); }} />
      </div>

      {/* ── toolbar ── */}
      <Toolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search name, ref or org…"
        filters={[
          {
            key: "level", label: "Level", value: levelFilter, onChange: setLevelFilter,
            options: [
              { value: "ALL", label: "All levels" },
              { value: "SUBSIDIARY", label: "Subsidiary" },
              { value: "BUSINESS_UNIT", label: "Business unit" },
              { value: "PROJECT", label: "Project" },
            ],
          },
          { key: "status", label: "Status", value: statusFilter, onChange: setStatusFilter, options: STATUS_OPTIONS },
        ]}
        onReset={() => { setLevelFilter("ALL"); setStatusFilter("ALL"); setSearch(""); }}
        resultCount={filtered.length}
        right={
          <>
            <ExportButton filename={`reporting-timelines-${reportingYear.replace(/\s+/g, "-").toLowerCase()}`} rows={exportRows} />
            <Button className="btn-action h-9 rounded-2xl" onClick={openCreate}>
              <Plus className="mr-1 h-4 w-4" /> Set Timeline
            </Button>
          </>
        }
      />

      {/* ── timeline rows as glass cards ── */}
      {filtered.length === 0 ? (
        <GlassCard className="p-6">
          <EmptyState
            title={timelines.length === 0 ? "No timelines for this period yet" : "No timelines match these filters"}
            message={timelines.length === 0
              ? "Set the subsidiary root window first — BU and project deadlines inherit from it."
              : "Try clearing the level or status filter."}
            action={
              <Button className="btn-action rounded-2xl" onClick={openCreate}>
                <Plus className="mr-1 h-4 w-4" /> Set Timeline
              </Button>
            }
          />
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => (
            <TimelineCard key={t.id} t={t} onEdit={() => openEdit(t)} onDelete={() => setDeleteTarget(t)} />
          ))}
        </div>
      )}

      {/* ── inheritance explainer ── */}
      <SectionCard
        title="How deadline inheritance works"
        description="One root window cascades down — overrides are explicit, reasoned and audited."
        icon={NetworkIcon}
      >
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <div className="glass-subtle flex-1 rounded-2xl border border-[rgba(58,123,255,0.25)] p-3 text-center">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#1d5fd6]">Subsidiary deadline</p>
            <p className="mt-0.5 text-[11px] text-[color:var(--ink-faint)]">Set once per period — the root window</p>
          </div>
          <ArrowRight className="mx-auto h-4 w-4 shrink-0 rotate-90 text-[color:var(--ink-faint)] sm:rotate-0" aria-hidden />
          <div className="glass-subtle flex-1 rounded-2xl border border-[rgba(106,91,255,0.25)] p-3 text-center">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#5546d6]">BU deadline</p>
            <p className="mt-0.5 text-[11px] text-[color:var(--ink-faint)]">Inherits from the subsidiary by default</p>
          </div>
          <ArrowRight className="mx-auto h-4 w-4 shrink-0 rotate-90 text-[color:var(--ink-faint)] sm:rotate-0" aria-hidden />
          <div className="glass-subtle flex-1 rounded-2xl border border-[rgba(22,163,163,0.3)] p-3 text-center">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#0f7c7c]">Project deadline</p>
            <p className="mt-0.5 text-[11px] text-[color:var(--ink-faint)]">Inherits from its BU by default</p>
          </div>
        </div>
        <p className="mt-3 text-[12.5px] leading-relaxed text-[color:var(--ink-soft)]">
          BUs and projects inherit by default; authorized overrides are recorded with a reason and never silently change.
          Deleting a timeline makes its children fall back to the parent level automatically.
        </p>
      </SectionCard>

      {/* ── create / edit dialog ── */}
      <GlassDialog
        open={formOpen}
        onOpenChange={(o) => { if (!pendingSave) setFormOpen(o); }}
        title={editing ? `Edit timeline — ${editing.ref}` : "Set reporting timeline"}
        description={editing
          ? "Update this deadline. Children that inherit it will follow automatically."
          : "Create a deadline for the subsidiary, a business unit or a project. Inheriting entities follow automatically."}
        wide
        footer={
          <>
            <Button variant="outline" className="glass-subtle rounded-2xl" onClick={() => setFormOpen(false)} disabled={pendingSave}>
              Cancel
            </Button>
            <ActionButton pending={pendingSave} className="btn-action" onClick={submit}>
              {editing ? "Save changes" : "Set timeline"}
            </ActionButton>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Timeline name" required error={errs.name} htmlFor="tl-name">
              <Input
                id="tl-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Q2 ESG data submission window"
                className="glass-subtle rounded-2xl border-white/60 text-sm"
                maxLength={80}
              />
            </Field>
          </div>

          <Field label="Reporting period" required htmlFor="tl-period" hint="Prefilled from the workspace period selector.">
            <Input
              id="tl-period"
              value={form.period}
              onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))}
              className="glass-subtle rounded-2xl border-white/60 text-sm"
            />
          </Field>

          <Field label="Level" required error={errs.level} htmlFor="tl-level">
            <Select
              value={form.level}
              onValueChange={(v) => setForm((f) => ({ ...f, level: v as FormState["level"], orgId: "" }))}
            >
              <SelectTrigger id="tl-level" className="glass-subtle rounded-2xl border-white/60 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="glass-strong rounded-2xl border-white/70">
                <SelectItem value="SUBSIDIARY">Subsidiary</SelectItem>
                <SelectItem value="BUSINESS_UNIT">Business unit</SelectItem>
                <SelectItem value="PROJECT">Project</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {form.level === "SUBSIDIARY" ? (
            <div className="sm:col-span-2">
              <Field label="Applies to" hint="Subsidiary-level timelines apply to the whole entity.">
                <div className="glass-subtle rounded-2xl border border-white/60 px-3 py-2.5 text-sm text-[color:var(--ink-soft)]">
                  This subsidiary (self)
                </div>
              </Field>
            </div>
          ) : (
            <div className="sm:col-span-2">
              <Field
                label={form.level === "BUSINESS_UNIT" ? "Business unit" : "Project"}
                required
                error={errs.orgId}
                htmlFor="tl-org"
              >
                <Select value={form.orgId} onValueChange={(v) => setForm((f) => ({ ...f, orgId: v }))}>
                  <SelectTrigger id="tl-org" className="glass-subtle rounded-2xl border-white/60 text-sm">
                    <SelectValue placeholder={form.level === "BUSINESS_UNIT" ? "Select a business unit…" : "Select a project…"} />
                  </SelectTrigger>
                  <SelectContent className="glass-strong rounded-2xl border-white/70">
                    {form.level === "BUSINESS_UNIT" &&
                      (unitsRes.data?.units ?? []).map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    {form.level === "PROJECT" &&
                      (projectsRes.data?.projects ?? []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name} · {p.buName}</SelectItem>
                      ))}
                    {((form.level === "BUSINESS_UNIT" && (unitsRes.data?.units ?? []).length === 0) ||
                      (form.level === "PROJECT" && (projectsRes.data?.projects ?? []).length === 0)) && (
                      <div className="px-3 py-2 text-xs text-[color:var(--ink-faint)]">
                        {form.level === "BUSINESS_UNIT" ? "No business units yet." : "No projects yet."}
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          )}

          <Field label="Start date" required error={errs.startDate} htmlFor="tl-start">
            <Input
              id="tl-start" type="date" value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              className="glass-subtle rounded-2xl border-white/60 text-sm"
            />
          </Field>

          <Field label="Due date" required error={errs.dueDate} htmlFor="tl-due" hint="Effective deadline for this level and its inheritors.">
            <Input
              id="tl-due" type="date" value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              className="glass-subtle rounded-2xl border-white/60 text-sm"
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Review deadline" error={errs.reviewDeadline} htmlFor="tl-review" hint="Optional — must be on or after the due date.">
              <Input
                id="tl-review" type="date" value={form.reviewDeadline}
                onChange={(e) => setForm((f) => ({ ...f, reviewDeadline: e.target.value }))}
                className="glass-subtle rounded-2xl border-white/60 text-sm"
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field label="Categories covered" hint="Leave empty to cover every category.">
              <div className="glass-subtle rounded-2xl border border-white/60 p-3">
                <label className="flex items-center gap-2 text-[12.5px] font-semibold text-[color:var(--ink)]">
                  <Checkbox
                    checked={allCategoriesSelected}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, categories: v === true ? [...SA_CATEGORIES] : [] }))}
                    aria-label="Select all categories"
                  />
                  Select all ({form.categories.length}/{SA_CATEGORIES.length})
                </label>
                <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {SA_CATEGORIES.map((c) => (
                    <label key={c} className="flex cursor-pointer items-center gap-2 text-[12.5px] text-[color:var(--ink-soft)]">
                      <Checkbox
                        checked={form.categories.includes(c)}
                        onCheckedChange={() => toggleCategory(c)}
                        aria-label={CATEGORY_LABELS[c] ?? c}
                      />
                      {CATEGORY_LABELS[c] ?? c}
                    </label>
                  ))}
                </div>
              </div>
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field label="Inheritance mode" required>
              <RadioGroup
                value={form.inheritanceMode}
                onValueChange={(v) => setForm((f) => ({ ...f, inheritanceMode: v as FormState["inheritanceMode"] }))}
                className="grid gap-2 sm:grid-cols-2"
              >
                <label htmlFor="mode-inherit" className="flex cursor-pointer items-start gap-2.5 rounded-2xl border border-white/60 bg-[rgba(58,123,255,0.06)] p-3 transition-colors hover:bg-[rgba(58,123,255,0.1)]">
                  <RadioGroupItem value="INHERIT" id="mode-inherit" className="mt-0.5" />
                  <span>
                    <span className="block text-[13px] font-semibold text-[color:var(--ink)]">Inherit</span>
                    <span className="block text-[11.5px] text-[color:var(--ink-faint)]">Follow the parent level's deadline — the default.</span>
                  </span>
                </label>
                <label htmlFor="mode-override" className="flex cursor-pointer items-start gap-2.5 rounded-2xl border border-white/60 bg-[rgba(197,121,38,0.07)] p-3 transition-colors hover:bg-[rgba(197,121,38,0.12)]">
                  <RadioGroupItem value="OVERRIDE" id="mode-override" className="mt-0.5" />
                  <span>
                    <span className="block text-[13px] font-semibold text-[color:var(--ink)]">Override</span>
                    <span className="block text-[11.5px] text-[color:var(--ink-faint)]">Set a specific deadline — a reason is recorded and audited.</span>
                  </span>
                </label>
              </RadioGroup>
            </Field>
          </div>

          {form.inheritanceMode === "OVERRIDE" && (
            <div className="sm:col-span-2">
              <Field label="Override reason" required error={errs.overrideReason} htmlFor="tl-reason" hint="Recorded in the audit trail and shown on the timeline.">
                <Textarea
                  id="tl-reason"
                  value={form.overrideReason}
                  onChange={(e) => setForm((f) => ({ ...f, overrideReason: e.target.value }))}
                  rows={3}
                  maxLength={500}
                  placeholder="Why does this entity need a different deadline? (min 4 characters)"
                  className="glass-subtle rounded-2xl border-white/60 text-sm"
                />
              </Field>
            </div>
          )}

          <div className="sm:col-span-2">
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/60 bg-[rgba(35,134,83,0.06)] p-3">
              <div>
                <div className="text-[13px] font-semibold text-[color:var(--ink)]">Deadline reminders</div>
                <div className="text-[11.5px] text-[color:var(--ink-faint)]">Notify BU & project owners about this deadline.</div>
              </div>
              <Switch
                checked={form.notify}
                onCheckedChange={(v) => setForm((f) => ({ ...f, notify: v === true }))}
                aria-label="Deadline reminders"
              />
            </div>
          </div>
        </div>
      </GlassDialog>

      {/* ── delete confirmation ── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        title="Delete this timeline?"
        message={deleteTarget
          ? `${deleteTarget.name} (${deleteTarget.ref}) will be removed for ${deleteTarget.period}. Children currently inheriting from it will fall back to the parent level deadline. This action is audited.`
          : ""}
        confirmLabel="Delete timeline"
        destructive
        pending={del.pending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
