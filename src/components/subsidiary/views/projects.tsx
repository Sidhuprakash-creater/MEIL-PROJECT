"use client";

// ── SUBSIDIARY ADMIN · SCREEN 04 — Project & Site Management ──
// Projects can only be registered under business units of THIS subsidiary
// (server-enforced via assertUnitInScope); the BU picker lists own BUs only.
import { useEffect, useMemo, useState } from "react";
import {
  Activity as ActivityIcon,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Files,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSaWorkspace } from "@/lib/sa/store";
import { apiDelete, apiPatch, apiPost, daysUntil, fmtDate, timeAgo, useMutation, useSaApi } from "@/lib/sa/client";
import type { ActivityRow, ProjectRow, UserRow } from "@/lib/sa/types";
import {
  ActionButton, Chip, Column, ConfirmDialog, DataTable, EmptyState, ErrorState, ExportButton, Field,
  GlassDialog, GlassTabBar, InfoRow, KpiCard, LoadingBlock, PageHeader, SectionCard, StatusBadge, Toolbar,
} from "@/components/workspace/ui";
import { AlarmAlertIcon, CheckSealIcon, FilesIcon, ProjectsIcon, ShieldIcon } from "@/components/workspace/premium-icons";
import { useToast } from "@/hooks/use-toast";

const inputCls = "glass-subtle rounded-2xl border-white/60 text-sm";

const PTYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "SITE", label: "Site" },
  { value: "PLANT", label: "Plant" },
  { value: "OFFICE", label: "Office" },
  { value: "WIND_FARM", label: "Wind farm" },
  { value: "SOLAR_PARK", label: "Solar park" },
  { value: "HYDRO", label: "Hydro" },
  { value: "PIPELINE", label: "Pipeline" },
];
const ptypeToValue = (label: string) => PTYPE_OPTIONS.find((o) => o.label === label)?.value ?? "SITE";
const ptypeLabel = (v: string) => PTYPE_OPTIONS.find((o) => o.value === v)?.label ?? v.replaceAll("_", " ");

function validationTone(state: string): "green" | "amber" | "red" {
  if (state === "OK") return "green";
  if (state === "HIGH" || state === "CRITICAL") return "red";
  return "amber";
}

/* ────────────────────────────── create / edit form ────────────────────────────── */

interface ProjectFormValues {
  name: string;
  code: string;
  buId: string;
  location: string;
  ptype: string;
  capacityMw: string;
  frequency: string;
  responsibleUserId: string;
  status: string;
}

const EMPTY_PROJECT_FORM: ProjectFormValues = {
  name: "", code: "", buId: "", location: "", ptype: "SITE", capacityMw: "", frequency: "MONTHLY", responsibleUserId: "", status: "ACTIVE",
};

function ProjectFormFields({
  editing,
  buFacets,
  userOptions,
  usersLoading,
  pending,
  onSubmit,
  onCancel,
}: {
  editing: ProjectRow | null;
  buFacets: { id: string; name: string }[];
  userOptions: UserRow[];
  usersLoading: boolean;
  pending: boolean;
  onSubmit: (values: ProjectFormValues) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<ProjectFormValues>(() =>
    editing
      ? {
          name: editing.name,
          code: editing.code,
          buId: editing.buId,
          location: editing.location,
          ptype: ptypeToValue(editing.ptype),
          capacityMw: editing.capacityMw ? String(editing.capacityMw) : "",
          frequency: editing.frequency === "QUARTERLY" ? "QUARTERLY" : "MONTHLY",
          responsibleUserId: userOptions.find((u) => u.name === editing.responsibleName)?.id ?? "",
          status: editing.status,
        }
      : EMPTY_PROJECT_FORM
  );
  const [errors, setErrors] = useState<{ name?: string; buId?: string }>({});
  const set = (k: keyof ProjectFormValues) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    const errs: { name?: string; buId?: string } = {};
    const n = form.name.trim();
    if (n.length < 2 || n.length > 80) errs.name = "Name is required (2–80 characters).";
    if (!form.buId) errs.buId = "A parent business unit is required.";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    onSubmit({ ...form, name: n });
  };

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Project / site name" required error={errors.name} htmlFor="sa-prj-name" hint="2–80 characters">
          <Input id="sa-prj-name" value={form.name} onChange={(e) => set("name")(e.target.value)} placeholder="e.g. Kaleshwaram Lift Scheme Phase 2" className={inputCls} />
        </Field>
        <Field label="Code" htmlFor="sa-prj-code" hint="Auto-generated when left blank">
          <Input id="sa-prj-code" value={form.code} onChange={(e) => set("code")(e.target.value)} placeholder="e.g. PRJ-ENE-014" className={inputCls} disabled={!!editing} />
        </Field>
        <Field
          label="Parent business unit"
          required
          error={errors.buId}
          hint="Projects can only be registered under your subsidiary's business units"
        >
          <Select value={form.buId} onValueChange={set("buId")} disabled={buFacets.length === 0}>
            <SelectTrigger className={`${inputCls} w-full`} aria-label="Parent business unit">
              <SelectValue placeholder={buFacets.length === 0 ? "No business units available" : "Select business unit"} />
            </SelectTrigger>
            <SelectContent className="glass-strong rounded-2xl border-white/70">
              {buFacets.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Location" htmlFor="sa-prj-loc">
          <Input id="sa-prj-loc" value={form.location} onChange={(e) => set("location")(e.target.value)} placeholder="e.g. Karimnagar, Telangana" className={inputCls} />
        </Field>
        <Field label="Type">
          <Select value={form.ptype} onValueChange={set("ptype")}>
            <SelectTrigger className={`${inputCls} w-full`} aria-label="Project type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="glass-strong rounded-2xl border-white/70">
              {PTYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Capacity (MW)" htmlFor="sa-prj-cap" hint="0 for non-generation sites">
          <Input id="sa-prj-cap" type="number" min={0} step="0.1" value={form.capacityMw} onChange={(e) => set("capacityMw")(e.target.value)} placeholder="e.g. 2400" className={inputCls} />
        </Field>
        <Field label="Reporting frequency">
          <Select value={form.frequency} onValueChange={set("frequency")}>
            <SelectTrigger className={`${inputCls} w-full`} aria-label="Reporting frequency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="glass-strong rounded-2xl border-white/70">
              <SelectItem value="MONTHLY">Monthly</SelectItem>
              <SelectItem value="QUARTERLY">Quarterly</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Project Manager (Responsible User)" hint="Designated Site Project Manager & ESG reporting owner">
          <Select value={form.responsibleUserId || "NONE"} onValueChange={(v) => set("responsibleUserId")(v === "NONE" ? "" : v)}>
            <SelectTrigger className={`${inputCls} w-full`} aria-label="Project Manager">
              <SelectValue placeholder={usersLoading ? "Loading users…" : "Unassigned"} />
            </SelectTrigger>
            <SelectContent className="glass-strong rounded-2xl border-white/70">
              <SelectItem value="NONE">Unassigned</SelectItem>
              {userOptions.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name} — {u.roleLabel}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Status">
          <Select value={form.status} onValueChange={set("status")}>
            <SelectTrigger className={`${inputCls} w-full`} aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="glass-strong rounded-2xl border-white/70">
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" className="glass-subtle rounded-2xl" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <ActionButton pending={pending} onClick={submit} className="btn-action">
          {editing ? "Save changes" : "Register project"}
        </ActionButton>
      </div>
    </>
  );
}

/* ────────────────────────────── detail dialog ────────────────────────────── */

interface ProjectDetailData {
  project: ProjectRow;
  team: { id: string; name: string; email: string; role: string; status: string; title: string }[];
  submissions: { id: string; ref: string; title: string; category: string; status: string; overdue: boolean; submittedAt: string | null; dueDate: string }[];
  evidence: { id: string; name: string; fileType: string; status: string; uploadedAt: string; uploadedBy: string; version: number }[];
  timelines: { id: string; ref: string; name: string; period: string; level: string; startDate: string; dueDate: string | null; reviewDeadline: string | null; inheritanceMode: string; status: string }[];
  tasks: { id: string; ref: string; title: string; category: string; priority: string; status: string; dueDate: string }[];
  activity: ActivityRow[];
}

type ProjectTab = "overview" | "team" | "submissions" | "evidence" | "timelines" | "activity";

function ProjectDetailDialog({
  projectId,
  onClose,
  onEdit,
}: {
  projectId: string | null;
  onClose: () => void;
  onEdit: (p: ProjectRow) => void;
}) {
  const { navigate } = useSaWorkspace();
  const [tab, setTab] = useState<ProjectTab>("overview");
  const { data, loading, error, refetch } = useSaApi<ProjectDetailData>(
    projectId ? `/api/sa/projects/${projectId}` : null,
    { pollMs: 0 }
  );
  /* reset to the overview tab whenever the dialog targets a different project */
  const [prevProjectId, setPrevProjectId] = useState(projectId);
  if (projectId !== prevProjectId) {
    setPrevProjectId(projectId);
    if (projectId) setTab("overview");
  }

  const p = data?.project;
  const tabs: { value: ProjectTab; label: string; icon: React.ComponentType<{ className?: string }>; count?: number }[] = [
    { value: "overview", label: "Overview", icon: ClipboardList },
    { value: "team", label: "Team", icon: Users, count: data?.team.length },
    { value: "submissions", label: "Submissions", icon: Files, count: data?.submissions.length },
    { value: "evidence", label: "Evidence", icon: FilesIcon, count: data?.evidence.length },
    { value: "timelines", label: "Timelines", icon: CalendarClock, count: data?.timelines.length },
    { value: "activity", label: "Activity", icon: ActivityIcon },
  ];

  return (
    <GlassDialog
      open={!!projectId}
      onOpenChange={(o) => !o && onClose()}
      wide
      title={p ? `${p.code} — ${p.name}` : "Project details"}
      description={p ? `${p.buName} · registered ${fmtDate(p.createdAt)}` : "Loading detail…"}
    >
      {error && <ErrorState message={error} onRetry={refetch} />}
      {!error && loading && !data && <LoadingBlock rows={5} label="Loading project…" />}
      {data && p && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={p.status} />
            <Chip tone="purple">{p.code}</Chip>
            <Chip tone="blue">{p.buName}</Chip>
            <Chip tone={validationTone(p.validationState)}>
              {p.validationState === "OK" ? "Validation OK" : `${p.validationState} validation`}
            </Chip>
            <Button variant="ghost" size="sm" className="ml-auto h-8 rounded-xl text-xs" onClick={() => onEdit(p)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
            </Button>
          </div>

          <GlassTabBar tabs={tabs} value={tab} onChange={(v) => setTab(v as ProjectTab)} />

          {tab === "overview" && (
            <div className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-2">
                <SectionCard title="Profile" description="Master data for this project / site" icon={ProjectsIcon}>
                  <div className="divide-y divide-[rgba(125,177,216,0.16)]">
                    <InfoRow label="Code"><Chip tone="purple">{p.code}</Chip></InfoRow>
                    <InfoRow label="Business unit">{p.buName}</InfoRow>
                    <InfoRow label="Location">{p.location ? <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-[color:var(--ink-faint)]" />{p.location}</span> : "—"}</InfoRow>
                    <InfoRow label="Type"><Chip tone="gray">{p.ptype}</Chip></InfoRow>
                    <InfoRow label="Capacity">{p.capacityMw ? `${p.capacityMw} MW` : "—"}</InfoRow>
                    <InfoRow label="Reporting frequency"><Chip tone="blue">{p.frequency === "QUARTERLY" ? "Quarterly" : "Monthly"}</Chip></InfoRow>
                    <InfoRow label="Project Manager">{p.responsibleName || "—"}</InfoRow>
                    <InfoRow label="Status"><StatusBadge status={p.status} /></InfoRow>
                    <InfoRow label="Registered">{fmtDate(p.createdAt)}</InfoRow>
                  </div>
                </SectionCard>
                <SectionCard title="Reporting & deadlines" description="Effective deadline via timeline inheritance" icon={CalendarClock}>
                  <div className="space-y-3">
                    <div className="divide-y divide-[rgba(125,177,216,0.16)]">
                      <InfoRow label="Effective due date">
                        <span className="inline-flex items-center gap-1.5">
                          {fmtDate(p.dueDate)}
                          {p.dueDate && (daysUntil(p.dueDate) ?? 0) < 0 && <Chip tone="red">overdue</Chip>}
                        </span>
                      </InfoRow>
                      <InfoRow label="Approved records">{p.approved}</InfoRow>
                      <InfoRow label="In review">{p.pending}</InfoRow>
                      <InfoRow label="Overdue">{p.overdue}</InfoRow>
                      <InfoRow label="Validation state">
                        <Chip tone={validationTone(p.validationState)}>{p.validationState === "OK" ? "OK" : p.validationState}</Chip>
                      </InfoRow>
                      <InfoRow label="Team size">{p.teamCount}</InfoRow>
                    </div>
                    <Button variant="outline" size="sm" className="glass-subtle w-full rounded-2xl border-white/60" onClick={() => navigate("timelines")}>
                      Manage reporting timelines
                    </Button>
                  </div>
                </SectionCard>
              </div>

              <SectionCard title="Project Manager & Site Leadership" description="Designated ESG site leadership & operational accountability" icon={UserCheck}>
                <div className="space-y-3">
                  <div className="glass-subtle flex items-start gap-3 rounded-2xl p-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1b6442] to-[#2ca568] text-white shadow-md shadow-[#2ca568]/20 font-bold text-sm tracking-wide">
                      {p.responsibleName && p.responsibleName !== "—"
                        ? p.responsibleName.split(" ").filter(Boolean).slice(-2).map((s) => s[0]).join("").toUpperCase()
                        : "PM"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-semibold text-[color:var(--ink)]">
                          {p.responsibleName && p.responsibleName !== "—" ? p.responsibleName : "Unassigned Manager"}
                        </span>
                        <Chip tone="green">Designated Site PM</Chip>
                      </div>
                      <p className="mt-0.5 text-[11px] text-[color:var(--ink-soft)]">
                        Executive Site In-Charge · Operational & ESG Compliance
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-white/60 px-2 py-0.5 text-[11px] text-[color:var(--ink-soft)]">
                          <ShieldCheck className="h-3 w-3 text-emerald-600" /> Statutory Sign-Off
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-lg bg-white/60 px-2 py-0.5 text-[11px] text-[color:var(--ink-soft)]">
                          <CheckCircle2 className="h-3 w-3 text-blue-600" /> Direct Site Lead
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="glass-subtle flex-1 rounded-xl text-xs"
                      onClick={() => navigate("users")}
                    >
                      <Users className="mr-1.5 h-3.5 w-3.5" />
                      View in User Directory
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="glass-subtle flex-1 rounded-xl text-xs"
                      onClick={() => onEdit(p)}
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      Reassign Manager
                    </Button>
                  </div>
                </div>
              </SectionCard>
            </div>
          )}

          {tab === "team" && (
            <div className="nice-scroll max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {data.team.length === 0 && <EmptyState title="No team members" message="Users assigned to this project will appear here. Assign them from User Management." />}
              {data.team.map((m) => (
                <button key={m.id} onClick={() => navigate("users", { detailId: m.id })} className="glass-subtle flex w-full items-center justify-between gap-3 rounded-2xl p-3 text-left transition-colors hover:bg-white/80">
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-[color:var(--ink)]">{m.name}</span>
                    <span className="block truncate text-[11px] text-[color:var(--ink-faint)]">{m.email} · {m.title || m.role}</span>
                  </span>
                  <StatusBadge status={m.status} />
                </button>
              ))}
            </div>
          )}

          {tab === "submissions" && (
            <div className="nice-scroll max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {data.submissions.length === 0 && <EmptyState title="No submissions" message="Project-level reporting records will appear here." />}
              {data.submissions.map((s) => (
                <button key={s.id} onClick={() => navigate("submissions", { ref: s.ref })} className="glass-subtle flex w-full items-center justify-between gap-3 rounded-2xl p-3 text-left transition-colors hover:bg-white/80">
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-[color:var(--ink)]">{s.title}</span>
                    <span className="block truncate text-[11px] text-[color:var(--ink-faint)]">{s.ref} · {s.category} · due {fmtDate(s.dueDate)}{s.submittedAt ? ` · submitted ${timeAgo(s.submittedAt)}` : ""}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {s.overdue && s.status !== "APPROVED" && <Chip tone="red">overdue</Chip>}
                    <StatusBadge status={s.status} />
                  </span>
                </button>
              ))}
            </div>
          )}

          {tab === "evidence" && (
            <div className="nice-scroll max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {data.evidence.length === 0 && <EmptyState title="No evidence documents" message="Evidence attached to this project's submissions will appear here." />}
              {data.evidence.map((e) => (
                <button key={e.id} onClick={() => navigate("evidence")} className="glass-subtle flex w-full items-center justify-between gap-3 rounded-2xl p-3 text-left transition-colors hover:bg-white/80">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <FilesIcon className="h-4 w-4 shrink-0 text-[color:var(--esg-blue)]" />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold text-[color:var(--ink)]">{e.name}</span>
                      <span className="block truncate text-[11px] text-[color:var(--ink-faint)]">v{e.version} · {e.fileType} · {e.uploadedBy} · {timeAgo(e.uploadedAt)}</span>
                    </span>
                  </span>
                  <StatusBadge status={e.status} />
                </button>
              ))}
              {data.evidence.length > 0 && (
                <Button variant="outline" size="sm" className="glass-subtle mt-1 w-full rounded-2xl border-white/60" onClick={() => navigate("evidence")}>
                  Open Evidence & Documents
                </Button>
              )}
            </div>
          )}

          {tab === "timelines" && (
            <div className="nice-scroll max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {data.timelines.length === 0 && <EmptyState title="No active timelines" message="This project currently inherits its deadline from its business unit or the subsidiary." />}
              {data.timelines.map((t) => (
                <div key={t.id} className="glass-subtle flex items-center justify-between gap-3 rounded-2xl p-3">
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-[color:var(--ink)]">{t.name}</span>
                    <span className="block truncate text-[11px] text-[color:var(--ink-faint)]">{t.period} · start {fmtDate(t.startDate)} · due {fmtDate(t.dueDate)}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Chip tone={t.inheritanceMode === "OVERRIDE" ? "amber" : "blue"}>{t.inheritanceMode === "OVERRIDE" ? "Override" : "Inherit"}</Chip>
                    <StatusBadge status={t.status} />
                  </span>
                </div>
              ))}
              <Button variant="outline" size="sm" className="glass-subtle mt-1 w-full rounded-2xl border-white/60" onClick={() => navigate("timelines")}>
                Open Reporting Timelines
              </Button>
            </div>
          )}

          {tab === "activity" && (
            <SectionCard title="Recent activity" description="Subsidiary events involving this project" icon={ActivityIcon}>
              {data.activity.length === 0 ? (
                <EmptyState title="No activity yet" message="Actions involving this project will appear here." />
              ) : (
                <div className="space-y-2">
                  {data.activity.map((a) => (
                    <div key={a.id} className="flex items-start gap-2.5 rounded-2xl px-2 py-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: a.severity === "WARNING" ? "#c57926" : a.severity === "CRITICAL" ? "#c34a4a" : "#3a7bff" }} />
                      <div className="min-w-0">
                        <div className="truncate text-[12px] text-[color:var(--ink)]">
                          <strong className="font-semibold">{a.actorName}</strong> · {a.action.replace(/_/g, " ").toLowerCase()} {a.targetLabel && <span className="text-[color:var(--ink-soft)]">— {a.targetLabel}</span>}
                        </div>
                        <div className="text-[10.5px] text-[color:var(--ink-faint)]">{timeAgo(a.createdAt)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          )}
        </div>
      )}
    </GlassDialog>
  );
}

/* ────────────────────────────── mobile card ────────────────────────────── */

function ProjectMobileCard({ r, onOpen }: { r: ProjectRow; onOpen: () => void }) {
  const overdue = r.dueDate ? (daysUntil(r.dueDate) ?? 0) < 0 : false;
  return (
    <button onClick={onOpen} className="glass glass-sheen glass-lift block w-full rounded-3xl p-3.5 text-left">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-semibold text-[color:var(--ink)]">{r.name}</div>
          <div className="truncate text-[11px] text-[color:var(--ink-faint)]">{r.code} · {r.buName}</div>
        </div>
        <StatusBadge status={r.status} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {r.location && <Chip tone="gray"><MapPin className="h-3 w-3" />{r.location}</Chip>}
        <Chip tone="blue">{r.responsibleName}</Chip>
        <Chip tone="green">{r.approved}/{r.approved + r.pending} approved</Chip>
        <Chip tone={validationTone(r.validationState)}>{r.validationState === "OK" ? "validation OK" : r.validationState}</Chip>
        {overdue && <Chip tone="red">due {fmtDate(r.dueDate)}</Chip>}
      </div>
    </button>
  );
}

/* ────────────────────────────── main view ────────────────────────────── */

export default function ProjectsView() {
  const { params, navigate, reportingYear } = useSaWorkspace();
  const { toast } = useToast();
  const { data, loading, error, refetch } = useSaApi<{ projects: ProjectRow[]; total: number; buFacets: { id: string; name: string }[] }>(
    `/api/sa/projects?pageSize=50&period=${encodeURIComponent(reportingYear)}`,
    { deps: [reportingYear] }
  );
  const { data: usersRes, loading: usersLoading } = useSaApi<{ users: UserRow[] }>("/api/sa/users?pageSize=50", { pollMs: 0 });

  const [search, setSearch] = useState(() => (typeof params.q === "string" ? params.q : ""));
  const [buFilter, setBuFilter] = useState(() => (typeof params.buId === "string" ? params.buId : "ALL"));
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [formOpen, setFormOpen] = useState(() => !!params.create);
  const [editing, setEditing] = useState<ProjectRow | null>(null);
  const [detailId, setDetailId] = useState<string | null>(() => (typeof params.detailId === "string" && params.detailId ? params.detailId : null));
  const [confirmTarget, setConfirmTarget] = useState<{ row: ProjectRow; mode: "deactivate" | "delete" } | null>(null);

  const saveMut = useMutation();
  const statusMut = useMutation();
  const deleteMut = useMutation();

  /* deep-link params: create / q / buId / detailId — seeded on mount via the
     lazy initializers above, re-applied here when params change while the view
     is already mounted (React derived-state adjustment), then cleared. */
  const [prevParams, setPrevParams] = useState(params);
  if (params !== prevParams) {
    setPrevParams(params);
    if (typeof params.q === "string" && params.q) setSearch(params.q);
    if (typeof params.buId === "string" && params.buId) setBuFilter(params.buId);
    if (params.create) setFormOpen(true);
    if (typeof params.detailId === "string" && params.detailId) setDetailId(params.detailId);
  }
  useEffect(() => {
    if (params.create || (typeof params.q === "string" && params.q) || (typeof params.buId === "string" && params.buId) || (typeof params.detailId === "string" && params.detailId)) navigate("projects");
  }, [params, navigate]);

  useEffect(() => {
    if (saveMut.error) toast({ title: editing ? "Update failed" : "Could not register project", description: saveMut.error, variant: "destructive" });
  }, [saveMut.error, editing, toast]);
  useEffect(() => {
    if (statusMut.error) toast({ title: "Status change refused", description: statusMut.error, variant: "destructive" });
  }, [statusMut.error, toast]);
  useEffect(() => {
    if (deleteMut.error) toast({ title: "Delete refused", description: deleteMut.error, variant: "destructive" });
  }, [deleteMut.error, toast]);

  const projects = useMemo(() => data?.projects ?? [], [data]);
  const buFacets = useMemo(() => data?.buFacets ?? [], [data]);
  const userOptions = useMemo(() => usersRes?.users ?? [], [usersRes]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((r) => {
      if (buFilter !== "ALL" && r.buId !== buFilter) return false;
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (q && !`${r.name} ${r.code} ${r.location} ${r.buName}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [projects, search, buFilter, statusFilter]);

  const kpis = useMemo(
    () => ({
      total: projects.length,
      active: projects.filter((p) => p.status === "ACTIVE").length,
      overdue: projects.reduce((n, p) => n + p.overdue, 0),
      flagged: projects.filter((p) => p.validationState !== "OK").length,
    }),
    [projects]
  );

  const clearFilters = () => {
    setSearch("");
    setBuFilter("ALL");
    setStatusFilter("ALL");
  };

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (p: ProjectRow) => {
    setEditing(p);
    setFormOpen(true);
  };

  const submitForm = async (values: ProjectFormValues) => {
    const payload = {
      name: values.name,
      code: values.code.trim(),
      buId: values.buId,
      location: values.location.trim(),
      ptype: values.ptype,
      capacityMw: values.capacityMw.trim() === "" ? 0 : Number(values.capacityMw),
      frequency: values.frequency,
      responsibleUserId: values.responsibleUserId || undefined,
      status: values.status,
    };
    const res = editing
      ? await saveMut.run(() => apiPatch(`/api/sa/projects/${editing.id}`, payload))
      : await saveMut.run(() => apiPost("/api/sa/projects", payload));
    if (res) {
      toast({ title: editing ? "Project updated" : "Project registered", description: values.name });
      setFormOpen(false);
      setEditing(null);
      refetch();
    }
  };

  const setStatus = async (row: ProjectRow, status: "ACTIVE" | "INACTIVE") => {
    const res = await statusMut.run(() => apiPatch(`/api/sa/projects/${row.id}`, { status }));
    if (res) {
      toast({ title: status === "ACTIVE" ? "Project activated" : "Project deactivated", description: `${row.code} — ${row.name}` });
      setConfirmTarget(null);
      refetch();
    }
  };

  const removeProject = async () => {
    if (!confirmTarget) return;
    const res = await deleteMut.run(() => apiDelete(`/api/sa/projects/${confirmTarget.row.id}`));
    if (res) {
      toast({ title: "Project deleted", description: `${confirmTarget.row.code} — ${confirmTarget.row.name}` });
      setConfirmTarget(null);
      refetch();
    }
  };

  const columns: Column<ProjectRow>[] = [
    {
      key: "name",
      header: "Project",
      sortable: true,
      sortValue: (r) => r.name,
      render: (r) => (
        <div className="min-w-0">
          <div className="truncate font-semibold text-[color:var(--ink)]">{r.name}</div>
          <div className="truncate text-[11px] text-[color:var(--ink-faint)]"><Chip tone="purple" className="mr-1.5">{r.code}</Chip>{r.location || "—"}</div>
        </div>
      ),
    },
    { key: "bu", header: "Business Unit", sortable: true, sortValue: (r) => r.buName, render: (r) => r.buName },
    {
      key: "manager",
      header: "Project Manager",
      sortable: true,
      sortValue: (r) => r.responsibleName || "",
      render: (r) => (
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-[10px] font-bold text-white shadow-sm">
            {r.responsibleName && r.responsibleName !== "—"
              ? r.responsibleName.split(" ").filter(Boolean).slice(-2).map((s) => s[0]).join("").toUpperCase()
              : "PM"}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium text-[color:var(--ink)]">
              {r.responsibleName || "Unassigned"}
            </div>
            <div className="truncate text-[10px] text-[color:var(--ink-faint)]">
              Site Project Manager
            </div>
          </div>
        </div>
      ),
    },
    { key: "team", header: "Team", sortable: true, sortValue: (r) => r.teamCount, className: "tabular", render: (r) => r.teamCount },
    {
      key: "reports",
      header: "Reports",
      sortable: true,
      sortValue: (r) => r.approved + r.pending,
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <span className="tabular text-[13px] font-medium text-[color:var(--ink-soft)]">{r.approved}/{r.approved + r.pending}</span>
          {r.overdue > 0 && <Chip tone="red">{r.overdue} overdue</Chip>}
        </div>
      ),
    },
    {
      key: "due",
      header: "Due date",
      sortable: true,
      sortValue: (r) => r.dueDate ?? "",
      render: (r) => {
        const late = r.dueDate ? (daysUntil(r.dueDate) ?? 0) < 0 : false;
        return (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className="tabular">{fmtDate(r.dueDate)}</span>
            {late && <Chip tone="red">overdue</Chip>}
          </span>
        );
      },
    },
    {
      key: "validation",
      header: "Validation",
      sortable: true,
      sortValue: (r) => r.validationState,
      render: (r) => <Chip tone={validationTone(r.validationState)}>{r.validationState === "OK" ? "OK" : r.validationState}</Chip>,
    },
    { key: "status", header: "Status", sortable: true, sortValue: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
  ];

  const exportRows = rows.map((r) => ({
    code: r.code,
    name: r.name,
    business_unit: r.buName,
    location: r.location,
    type: r.ptype,
    capacity_mw: r.capacityMw,
    frequency: r.frequency,
    manager: r.responsibleName,
    team_size: r.teamCount,
    approved: r.approved,
    in_review: r.pending,
    overdue: r.overdue,
    due_date: r.dueDate ?? "",
    validation: r.validationState,
    status: r.status,
  }));

  const formDialog = (
    <GlassDialog
      open={formOpen}
      onOpenChange={(o) => {
        setFormOpen(o);
        if (!o) setEditing(null);
      }}
      wide
      title={editing ? "Edit project / site" : "Add project"}
      description={editing ? `Update details for ${editing.name}.` : "Register a project or site under one of your subsidiary's business units."}
    >
      {formOpen && (
        <ProjectFormFields
          key={editing?.id ?? "new"}
          editing={editing}
          buFacets={buFacets}
          userOptions={userOptions}
          usersLoading={usersLoading}
          pending={saveMut.pending}
          onSubmit={submitForm}
          onCancel={() => {
            setFormOpen(false);
            setEditing(null);
          }}
        />
      )}
    </GlassDialog>
  );

  const confirmDialog = (
    <ConfirmDialog
      open={!!confirmTarget}
      onOpenChange={(o) => !o && setConfirmTarget(null)}
      title={confirmTarget?.mode === "delete" ? "Delete project" : "Deactivate project"}
      message={
        confirmTarget?.mode === "delete"
          ? `Permanently delete "${confirmTarget.row.name}" (${confirmTarget.row.code})? This is only possible when the project has no reporting records. Deactivate instead to preserve history.`
          : `Deactivating "${confirmTarget?.row.name}" disables it for reporting. Historical records are preserved and it can be re-activated later.`
      }
      confirmLabel={confirmTarget?.mode === "delete" ? "Delete" : "Deactivate"}
      destructive
      requireReason={confirmTarget?.mode === "delete"}
      pending={confirmTarget?.mode === "delete" ? deleteMut.pending : statusMut.pending}
      onConfirm={() => {
        if (!confirmTarget) return;
        if (confirmTarget.mode === "delete") void removeProject();
        else void setStatus(confirmTarget.row, "INACTIVE");
      }}
    />
  );

  const detailDialog = (
    <ProjectDetailDialog
      projectId={detailId}
      onClose={() => setDetailId(null)}
      onEdit={(p) => {
        setDetailId(null);
        openEdit(p);
      }}
    />
  );

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="Project & Site Management"
        description="Projects and sites under each of your business units, with reporting owners and validation state."
        icon={ProjectsIcon}
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard label="Total projects" value={kpis.total} icon={ProjectsIcon} tone="purple" hint="Across all business units" onClick={clearFilters} />
        <KpiCard label="Active" value={kpis.active} icon={CheckSealIcon} tone="green" hint={`${kpis.total - kpis.active} inactive`} />
        <KpiCard label="Overdue reports" value={kpis.overdue} icon={AlarmAlertIcon} tone="red" hint="Sum across projects" onClick={() => navigate("submissions", { tab: "overdue", level: "PROJECT" })} />
        <KpiCard label="With validation flags" value={kpis.flagged} icon={ShieldIcon} tone="amber" hint="Open data-quality issues" onClick={() => navigate("validation")} />
      </div>

      <DataTable<ProjectRow>
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        onRetry={refetch}
        pageSize={8}
        onRowClick={(r) => setDetailId(r.id)}
        emptyTitle={projects.length === 0 ? "No projects yet" : "No projects match your filters"}
        emptyMessage={projects.length === 0 ? "Register your first project under one of your business units." : "Try adjusting the search, BU or status filter."}
        emptyAction={
          projects.length === 0 ? (
            <Button className="btn-action rounded-2xl" onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" /> Add Project
            </Button>
          ) : undefined
        }
        toolbar={
          <Toolbar
            search={search}
            onSearch={setSearch}
            searchPlaceholder="Search name, code, location…"
            filters={[
              {
                key: "bu",
                label: "BU",
                value: buFilter,
                onChange: setBuFilter,
                options: [{ value: "ALL", label: "All business units" }, ...buFacets.map((b) => ({ value: b.id, label: b.name }))],
              },
              {
                key: "status",
                label: "Status",
                value: statusFilter,
                onChange: setStatusFilter,
                options: [
                  { value: "ALL", label: "All statuses" },
                  { value: "ACTIVE", label: "Active" },
                  { value: "INACTIVE", label: "Inactive" },
                ],
              },
            ]}
            onReset={clearFilters}
            resultCount={rows.length}
            right={
              <div className="flex items-center gap-2">
                <ExportButton filename="subsidiary-projects" rows={exportRows} />
                <Button className="btn-action rounded-2xl" onClick={openCreate}>
                  <Plus className="mr-1.5 h-4 w-4" /> Add Project
                </Button>
              </div>
            }
          />
        }
        mobileCard={(r) => <ProjectMobileCard r={r} onOpen={() => setDetailId(r.id)} />}
        rowActions={(row) => {
          const hasRecords = row.approved + row.pending > 0;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" aria-label={`Actions for ${row.name}`}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="glass-strong rounded-2xl border-white/70">
                <DropdownMenuItem onClick={() => setDetailId(row.id)}>
                  <ClipboardList className="mr-2 h-3.5 w-3.5" /> View details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openEdit(row)}>
                  <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {row.status === "ACTIVE" ? (
                  <DropdownMenuItem onClick={() => setConfirmTarget({ row, mode: "deactivate" })} className="text-[#c57926] focus:text-[#c57926]">
                    <Power className="mr-2 h-3.5 w-3.5" /> Deactivate
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => void setStatus(row, "ACTIVE")}>
                    <CheckCircle2 className="mr-2 h-3.5 w-3.5" /> Activate
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={hasRecords}
                  title={hasRecords ? `This project already has ${row.approved + row.pending} reporting record(s). Deactivate it instead to preserve reporting history.` : undefined}
                  onClick={() => setConfirmTarget({ row, mode: "delete" })}
                  className="text-[#c34a4a] focus:text-[#c34a4a]"
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        }}
      />

      {formDialog}
      {confirmDialog}
      {detailDialog}
    </div>
  );
}
