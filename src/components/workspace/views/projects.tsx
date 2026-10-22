"use client";

// ── SCREEN 06 — Project & Site Management ──
import { useEffect, useMemo, useState } from "react";
import {
  Activity as ActivityIcon,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Gauge,
  Layers,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  Users,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWorkspace } from "@/lib/esg/store";
import { apiDelete, apiPatch, apiPost, fmtDate, timeAgo, useApi, useMutation } from "@/lib/esg/client";
import type { BusinessUnit, Project, Submission, User } from "@/lib/esg/types";
import { ROLE_LABELS } from "@/lib/esg/types";
import {
  ActionButton,
  Chip,
  Column,
  ConfirmDialog,
  DataTable,
  EmptyState,
  ExportButton,
  Field,
  GlassDialog,
  GlassProgress,
  GlassTabBar,
  InfoRow,
  KpiCard,
  PageHeader,
  SectionCard,
  StatusBadge,
  Toolbar,
} from "@/components/workspace/ui";
import { useToast } from "@/hooks/use-toast";

/* ────────────────────────────── constants & cells ────────────────────────────── */

const PTYPE_OPTIONS = ["SITE", "PLANT", "OFFICE", "WIND_FARM", "SOLAR_PARK", "HYDRO", "PIPELINE"] as const;

const PTYPE_TONE: Record<string, "green" | "blue" | "amber" | "red" | "gray" | "purple" | "teal"> = {
  SITE: "teal",
  PLANT: "blue",
  OFFICE: "gray",
  WIND_FARM: "purple",
  SOLAR_PARK: "amber",
  HYDRO: "green",
  PIPELINE: "red",
};

const FREQ_LABEL: Record<string, string> = { MONTHLY: "Monthly", QUARTERLY: "Quarterly" };

interface TipItem {
  name?: string | number;
  value?: string | number;
  color?: string;
  stroke?: string;
  fill?: string;
}

function GlassChartTip({ active, payload, label }: { active?: boolean; payload?: TipItem[]; label?: string | number }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="glass-strong rounded-2xl border-white/70 px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-semibold text-[color:var(--ink)]">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-[color:var(--ink-soft)]">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.stroke ?? p.color ?? p.fill ?? "#16a3a3" }} />
          <span>{p.name}:</span>
          <span className="tabular font-medium text-[color:var(--ink)]">{p.value ?? "—"}</span>
        </div>
      ))}
    </div>
  );
}

function StatsCell({ st }: { st?: { total: number; approved: number; pending: number; overdue: number } }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="tabular text-[13px] font-medium text-[color:var(--ink-soft)]">{st ? `${st.approved}/${st.total}` : "0/0"}</span>
      {st && st.overdue > 0 && <Chip tone="red">{st.overdue} overdue</Chip>}
    </div>
  );
}

function CapacityCell({ mw }: { mw: number }) {
  return (
    <span className="tabular text-[13px] text-[color:var(--ink-soft)]">
      {mw > 0 ? `${mw.toLocaleString("en-IN")} MW` : "—"}
    </span>
  );
}

/* ────────────────────────────── create / edit dialog ────────────────────────────── */

interface ProjectForm {
  name: string;
  businessUnitId: string;
  code: string;
  location: string;
  ptype: string;
  capacityMw: string;
  frequency: string;
  status: string;
}

const EMPTY_FORM: ProjectForm = {
  name: "",
  businessUnitId: "",
  code: "",
  location: "",
  ptype: "SITE",
  capacityMw: "",
  frequency: "MONTHLY",
  status: "ACTIVE",
};

const inputCls = "glass-subtle rounded-2xl border-white/60 text-sm";

function ProjectForm({
  editing,
  units,
  unitsLoading,
  pending,
  onSubmit,
  onCancel,
}: {
  editing: Project | null;
  units: BusinessUnit[];
  unitsLoading: boolean;
  pending: boolean;
  onSubmit: (form: ProjectForm) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<ProjectForm>(() =>
    editing
      ? {
          name: editing.name,
          businessUnitId: editing.businessUnitId,
          code: editing.code,
          location: editing.location ?? "",
          ptype: editing.ptype,
          capacityMw: editing.capacityMw > 0 ? String(editing.capacityMw) : "",
          frequency: editing.frequency,
          status: editing.status,
        }
      : EMPTY_FORM
  );
  const [errors, setErrors] = useState<{ name?: string; businessUnitId?: string }>({});

  const set = (k: keyof ProjectForm) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    const errs: { name?: string; businessUnitId?: string } = {};
    if (form.name.trim().length < 2) errs.name = "Name is required (min 2 characters).";
    if (!form.businessUnitId) errs.businessUnitId = "Parent business unit is required.";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    onSubmit({ ...form, name: form.name.trim() });
  };

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Parent business unit" required error={errors.businessUnitId}>
          <Select value={form.businessUnitId} onValueChange={set("businessUnitId")}>
            <SelectTrigger className={`${inputCls} w-full`} aria-label="Parent business unit">
              <SelectValue placeholder={unitsLoading ? "Loading business units…" : "Select business unit"} />
            </SelectTrigger>
            <SelectContent className="glass-strong rounded-2xl border-white/70">
              {units.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}{u.subsidiaryName ? ` — ${u.subsidiaryName}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Name" required error={errors.name} htmlFor="prj-name">
          <Input id="prj-name" value={form.name} onChange={(e) => set("name")(e.target.value)} placeholder="e.g. Kavvya Solar Park" className={inputCls} />
        </Field>
        <Field label="Code" hint="Auto-generated when left blank" htmlFor="prj-code">
          <Input id="prj-code" value={form.code} onChange={(e) => set("code")(e.target.value)} placeholder="e.g. PRJ-KSP" className={inputCls} />
        </Field>
        <Field label="Location" htmlFor="prj-location">
          <Input id="prj-location" value={form.location} onChange={(e) => set("location")(e.target.value)} placeholder="e.g. Kurnool, Andhra Pradesh" className={inputCls} />
        </Field>
        <Field label="Type">
          <Select value={form.ptype} onValueChange={set("ptype")}>
            <SelectTrigger className={`${inputCls} w-full`} aria-label="Project type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="glass-strong rounded-2xl border-white/70">
              {PTYPE_OPTIONS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p.replaceAll("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Capacity (MW)" hint="Leave blank for non-generation sites" htmlFor="prj-capacity">
          <Input
            id="prj-capacity"
            type="number"
            min="0"
            step="0.1"
            value={form.capacityMw}
            onChange={(e) => set("capacityMw")(e.target.value)}
            placeholder="e.g. 120"
            className={inputCls}
          />
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
        <ActionButton pending={pending} onClick={submit}>
          {editing ? "Save changes" : "Create project"}
        </ActionButton>
      </div>
    </>
  );
}

function ProjectDialog({
  open,
  onOpenChange,
  editing,
  units,
  unitsLoading,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Project | null;
  units: BusinessUnit[];
  unitsLoading: boolean;
  pending: boolean;
  onSubmit: (form: ProjectForm) => void;
}) {
  return (
    <GlassDialog
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={editing ? "Edit project / site" : "New project / site"}
      description={editing ? `Update details for ${editing.name}.` : "Register a project or site under a business unit."}
    >
      {open && (
        <ProjectForm
          key={editing?.id ?? "new"}
          editing={editing}
          units={units}
          unitsLoading={unitsLoading}
          pending={pending}
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
        />
      )}
    </GlassDialog>
  );
}

/* ────────────────────────────── detail tabs ────────────────────────────── */

type ProjectTab = "overview" | "team" | "submissions" | "metrics" | "activity";

function ProjectDetail({ project, onBack, onEdit }: { project: Project; onBack: () => void; onEdit: (p: Project) => void }) {
  const { navigate, params } = useWorkspace();
  const [tab, setTab] = useState<ProjectTab>((params.detailTab as ProjectTab) ?? "overview");

  const usersRes = useApi<{ users: User[] }>(project ? "/api/esg/users" : null);
  const subsRes = useApi<{ submissions: Submission[] }>(project ? "/api/esg/submissions" : null);

  const users = useMemo(() => (usersRes.data?.users ?? []).filter((u) => u.projectId === project.id), [usersRes.data, project.id]);
  const submissions = useMemo(() => (subsRes.data?.submissions ?? []).filter((s) => s.projectId === project.id), [subsRes.data, project.id]);

  const activity = useMemo(
    () =>
      submissions
        .flatMap((s) => s.history.map((h) => ({ ...h, ref: s.ref, title: s.title })))
        .sort((a, b) => (a.at < b.at ? 1 : -1))
        .slice(0, 20),
    [submissions]
  );

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of submissions) map[s.category] = (map[s.category] ?? 0) + 1;
    return Object.entries(map)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  }, [submissions]);

  const st = project.submissionStats;
  const pct = st && st.total > 0 ? (st.approved / st.total) * 100 : 0;

  const tabs: { value: ProjectTab; label: string; icon: typeof Gauge; count?: number }[] = [
    { value: "overview", label: "Overview", icon: Gauge },
    { value: "team", label: "Team", icon: Users, count: users.length },
    { value: "submissions", label: "Submissions", icon: ClipboardList, count: submissions.length },
    { value: "metrics", label: "Metrics", icon: BarChart3 },
    { value: "activity", label: "Activity", icon: ActivityIcon },
  ];

  return (
    <div className="view-in space-y-5">
      <div>
        <Button variant="ghost" size="sm" className="mb-3 rounded-2xl text-[color:var(--ink-soft)]" onClick={onBack}>
          <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" /> Back to list
        </Button>
        <PageHeader
          title={project.name}
          description={`${project.ptype.replaceAll("_", " ")}${project.location ? ` · ${project.location}` : ""}`}
          icon={MapPin}
          breadcrumbs={["Group", "Organization", "Projects & Sites", project.name]}
          actions={
            <>
              <Chip tone="teal">{project.code}</Chip>
              <StatusBadge status={project.status} />
              <button
                onClick={() => onEdit(project)}
                className="glass inline-flex h-10 items-center gap-1.5 rounded-2xl border-white/60 px-4 text-[13px] font-medium text-[color:var(--ink)] transition-colors hover:bg-white/70"
              >
                <Pencil className="h-3.5 w-3.5 text-[color:var(--esg-blue)]" aria-hidden="true" /> Edit
              </button>
            </>
          }
        />
      </div>

      <GlassTabBar tabs={tabs} value={tab} onChange={(v) => setTab(v as ProjectTab)} />

      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard label="Users" icon={Users} tone="blue" value={project.userCount ?? 0} onClick={() => setTab("team")} />
            <KpiCard label="Submissions" icon={ClipboardList} tone="amber" value={st?.total ?? 0} onClick={() => setTab("submissions")} />
            <KpiCard label="Approved" icon={CheckCircle2} tone="green" value={st?.approved ?? 0} onClick={() => setTab("submissions")} />
            <KpiCard label="Overdue" icon={ActivityIcon} tone="red" value={st?.overdue ?? 0} onClick={() => setTab("submissions")} />
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <SectionCard title="Profile" description="Master data for this project / site" icon={MapPin}>
              <div className="divide-y divide-[rgba(125,177,216,0.16)]">
                <InfoRow label="Code"><Chip tone="teal">{project.code}</Chip></InfoRow>
                <InfoRow label="Business Unit">{project.businessUnitName ?? "—"}</InfoRow>
                <InfoRow label="Subsidiary">{project.subsidiaryName ?? "—"}</InfoRow>
                <InfoRow label="Location">{project.location || "—"}</InfoRow>
                <InfoRow label="Type"><Chip tone={PTYPE_TONE[project.ptype] ?? "gray"}>{project.ptype.replaceAll("_", " ")}</Chip></InfoRow>
                <InfoRow label="Capacity"><CapacityCell mw={project.capacityMw} /></InfoRow>
                <InfoRow label="Reporting frequency">{FREQ_LABEL[project.frequency] ?? project.frequency}</InfoRow>
                <InfoRow label="Status"><StatusBadge status={project.status} /></InfoRow>
              </div>
            </SectionCard>
            <SectionCard title="Submission progress" description="Approved share of all submissions" icon={ClipboardList}>
              <div className="flex flex-col gap-4">
                <div>
                  <div className="mb-2 flex items-center justify-between text-[13px]">
                    <span className="font-medium text-[color:var(--ink-soft)]">Approved</span>
                    <span className="tabular font-semibold text-[color:var(--ink)]">{st?.approved ?? 0} of {st?.total ?? 0}</span>
                  </div>
                  <GlassProgress value={pct} tone={st && st.overdue > 0 ? "amber" : "green"} showLabel />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Chip tone="amber">{st?.pending ?? 0} pending review</Chip>
                  <Chip tone={st && st.overdue > 0 ? "red" : "green"}>{st?.overdue ?? 0} overdue</Chip>
                  <Chip tone="gray">{FREQ_LABEL[project.frequency] ?? project.frequency} cadence</Chip>
                </div>
                <p className="text-xs leading-relaxed text-[color:var(--ink-faint)]">
                  Category-level breakdown of this site&apos;s submissions is available in the Metrics tab.
                </p>
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      {tab === "team" && (
        <DataTable<User>
          columns={[
            {
              key: "name",
              header: "User",
              render: (r) => (
                <div>
                  <div className="font-semibold text-[color:var(--ink)]">{r.name}</div>
                  <div className="text-xs text-[color:var(--ink-faint)]">{r.email}</div>
                </div>
              ),
            },
            { key: "role", header: "Role", render: (r) => ROLE_LABELS[r.role] ?? r.role.replaceAll("_", " ") },
            { key: "title", header: "Title", render: (r) => r.title || "—" },
            { key: "subs", header: "Submissions", render: (r) => <StatsCell st={r.submissionStats} /> },
            { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
          ]}
          rows={users}
          loading={usersRes.loading}
          error={usersRes.error}
          onRetry={usersRes.refetch}
          onRowClick={(r) => navigate("users", { detailId: r.id })}
          emptyTitle="No team members"
          emptyMessage="Users assigned to this project or site will be listed here."
        />
      )}

      {tab === "submissions" && (
        <DataTable<Submission>
          columns={[
            { key: "ref", header: "Ref", render: (r) => <span className="tabular font-medium text-[color:var(--ink)]">{r.ref}</span> },
            { key: "title", header: "Title", render: (r) => <span className="font-semibold text-[color:var(--ink)]">{r.title}</span> },
            { key: "category", header: "Category", render: (r) => <Chip tone="gray">{r.category}</Chip> },
            { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
            { key: "due", header: "Due", render: (r) => <span className="tabular">{fmtDate(r.dueDate)}</span> },
          ]}
          rows={submissions}
          loading={subsRes.loading}
          error={subsRes.error}
          onRetry={subsRes.refetch}
          onRowClick={(r) => navigate("submissions", { detailId: r.id })}
          emptyTitle="No submissions"
          emptyMessage="Submissions recorded for this project or site will appear here."
        />
      )}

      {tab === "metrics" && (
        <SectionCard title="Category breakdown" description="Number of submissions by ESG category" icon={BarChart3}>
          {categoryData.length === 0 ? (
            <EmptyState title="No submission data" message="Metrics appear once submissions are recorded for this site." />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, categoryData.length * 44)}>
              <BarChart data={categoryData} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(102,119,141,0.16)" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#8595ab", fontSize: 11 }} />
                <YAxis type="category" dataKey="category" width={120} tickLine={false} axisLine={false} tick={{ fill: "#44566f", fontSize: 12 }} />
                <Tooltip content={<GlassChartTip />} cursor={{ fill: "rgba(22,163,163,0.07)" }} />
                <Bar dataKey="count" name="Submissions" fill="#16a3a3" radius={[0, 6, 6, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      )}

      {tab === "activity" && (
        <SectionCard
          title="Recent activity"
          description="Flattened submission history for this site"
          icon={ActivityIcon}
          actions={
            <button onClick={() => navigate("activity")} className="text-xs font-medium text-[color:var(--esg-blue)] hover:underline">
              Open full activity feed
            </button>
          }
        >
          {activity.length === 0 ? (
            <EmptyState
              title="No recorded activity"
              message="Activity feed is available in Activity Monitoring."
              action={
                <button
                  onClick={() => navigate("activity")}
                  className="glass inline-flex h-10 items-center rounded-2xl border-white/60 px-4 text-[13px] font-medium text-[color:var(--ink)] transition-colors hover:bg-white/70"
                >
                  Go to Activity Monitoring
                </button>
              }
            />
          ) : (
            <ol className="relative flex flex-col gap-4 border-l-2 border-[rgba(125,177,216,0.3)] pl-5">
              {activity.map((h, i) => (
                <li key={`${h.ref}-${i}`} className="relative">
                  <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-[#16a3a3]" aria-hidden="true" />
                  <div className="text-[13px] text-[color:var(--ink-soft)]">
                    <span className="font-semibold text-[color:var(--ink)]">{h.actor}</span>
                    <span className="mx-1.5 rounded-md bg-[rgba(22,163,163,0.12)] px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-[#0f7c7c]">
                      {h.action.replaceAll("_", " ")}
                    </span>
                    {h.title}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-[color:var(--ink-faint)]">
                    <span className="tabular">{h.ref}</span>
                    <span>·</span>
                    <span>{timeAgo(h.at)}</span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </SectionCard>
      )}
    </div>
  );
}

/* ────────────────────────────── main view ────────────────────────────── */

export default function ProjectsView() {
  const { params, navigate, openDetail } = useWorkspace();
  const { toast } = useToast();
  const { data, loading, error, refetch } = useApi<{ projects: Project[] }>("/api/esg/org?type=projects");
  const { data: unitsData, loading: unitsLoading } = useApi<{ businessUnits: BusinessUnit[] }>("/api/esg/org?type=business-units");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Project | null>(null);

  const saveMut = useMutation();
  const deactivateMut = useMutation();

  useEffect(() => {
    if (saveMut.error) toast({ title: "Save failed", description: saveMut.error, variant: "destructive" });
  }, [saveMut.error, toast]);
  useEffect(() => {
    if (deactivateMut.error) toast({ title: "Deactivation refused", description: deactivateMut.error, variant: "destructive" });
  }, [deactivateMut.error, toast]);

  const projects = data?.projects ?? [];
  const units = unitsData?.businessUnits ?? [];

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((r) => {
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (typeFilter !== "ALL" && r.ptype !== typeFilter) return false;
      if (q) {
        const hay = [r.name, r.code, r.location, r.businessUnitName ?? "", r.subsidiaryName ?? ""].map((v) => (v ?? "").toLowerCase());
        if (!hay.some((v) => v.includes(q))) return false;
      }
      return true;
    });
  }, [projects, search, statusFilter, typeFilter]);

  const detailId = params.detailId;
  const current = detailId ? projects.find((p) => p.id === detailId) : null;

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (p: Project) => {
    setEditing(p);
    setDialogOpen(true);
  };

  const submit = async (form: ProjectForm) => {
    const payload = {
      type: "project" as const,
      name: form.name,
      businessUnitId: form.businessUnitId,
      code: form.code.trim(),
      location: form.location.trim(),
      ptype: form.ptype,
      capacityMw: form.capacityMw.trim(),
      frequency: form.frequency,
      status: form.status,
    };
    const res = editing
      ? await saveMut.run(() => apiPatch("/api/esg/org", { id: editing.id, ...payload }))
      : await saveMut.run(() => apiPost("/api/esg/org", payload));
    if (res) {
      toast({ title: editing ? "Project updated" : "Project created", description: form.name });
      setDialogOpen(false);
      refetch();
    }
  };

  const deactivate = async (reason?: string) => {
    if (!confirmTarget || !reason) return;
    const res = await deactivateMut.run(() => apiDelete("/api/esg/org", { type: "project", id: confirmTarget.id, reason }));
    if (res) {
      toast({ title: "Project deactivated", description: confirmTarget.name });
      setConfirmTarget(null);
      refetch();
    }
  };

  const activate = async (row: Project) => {
    const res = await saveMut.run(() => apiPatch("/api/esg/org", { type: "project", id: row.id, status: "ACTIVE" }));
    if (res) {
      toast({ title: "Project activated", description: row.name });
      refetch();
    }
  };

  const columns: Column<Project>[] = [
    { key: "code", header: "Code", sortable: true, sortValue: (r) => r.code, render: (r) => <Chip tone="teal">{r.code}</Chip> },
    {
      key: "name",
      header: "Project / Site",
      sortable: true,
      sortValue: (r) => r.name,
      render: (r) => <span className="font-semibold text-[color:var(--ink)]">{r.name}</span>,
    },
    {
      key: "org",
      header: "BU / Subsidiary",
      render: (r) => (
        <div className="text-[13px]">
          {r.businessUnitName ?? "—"}
          <div className="text-xs text-[color:var(--ink-faint)]">{r.subsidiaryName ?? "—"}</div>
        </div>
      ),
    },
    { key: "location", header: "Location", render: (r) => r.location || "—" },
    {
      key: "type",
      header: "Type",
      sortable: true,
      sortValue: (r) => r.ptype,
      render: (r) => <Chip tone={PTYPE_TONE[r.ptype] ?? "gray"}>{r.ptype.replaceAll("_", " ")}</Chip>,
    },
    { key: "capacity", header: "Capacity", sortable: true, sortValue: (r) => r.capacityMw, render: (r) => <CapacityCell mw={r.capacityMw} /> },
    { key: "users", header: "Users", sortable: true, sortValue: (r) => r.userCount ?? 0, className: "tabular", render: (r) => r.userCount ?? 0 },
    { key: "subs", header: "Submissions", sortable: true, sortValue: (r) => r.submissionStats?.approved ?? 0, render: (r) => <StatsCell st={r.submissionStats} /> },
    { key: "status", header: "Status", sortable: true, sortValue: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
  ];

  const exportRows = rows.map((r) => ({
    code: r.code,
    name: r.name,
    businessUnit: r.businessUnitName ?? "",
    subsidiary: r.subsidiaryName ?? "",
    location: r.location,
    type: r.ptype,
    capacityMw: r.capacityMw,
    frequency: r.frequency,
    users: r.userCount ?? 0,
    submissions: r.submissionStats?.total ?? 0,
    approved: r.submissionStats?.approved ?? 0,
    overdue: r.submissionStats?.overdue ?? 0,
    status: r.status,
  }));

  const dialog = (
    <ProjectDialog
      open={dialogOpen}
      onOpenChange={setDialogOpen}
      editing={editing}
      units={units}
      unitsLoading={unitsLoading}
      pending={saveMut.pending}
      onSubmit={submit}
    />
  );

  const confirm = (
    <ConfirmDialog
      open={!!confirmTarget}
      onOpenChange={(o) => !o && setConfirmTarget(null)}
      title="Deactivate project"
      message={`Deactivating "${confirmTarget?.name}" will disable it for reporting. Historic submissions are preserved.`}
      confirmLabel="Deactivate"
      destructive
      requireReason
      pending={deactivateMut.pending}
      onConfirm={deactivate}
    />
  );

  /* Detail mode */
  if (detailId && current) {
    return (
      <>
        <ProjectDetail
          key={`${current.id}:${params.detailTab ?? "overview"}`}
          project={current}
          onBack={() => navigate("projects")}
          onEdit={openEdit}
        />
        {dialog}
        {confirm}
      </>
    );
  }

  return (
    <div className="view-in space-y-5">
      <PageHeader
        title="Project & Site Management"
        description="Directory of projects and sites with reporting responsibilities."
        icon={MapPin}
        breadcrumbs={["Group", "Organization", "Projects & Sites"]}
        actions={
          <button
            onClick={openCreate}
            className="glass inline-flex h-10 items-center gap-1.5 rounded-2xl border-white/60 px-4 text-[13px] font-medium text-[color:var(--ink)] transition-colors hover:bg-white/70"
          >
            <Plus className="h-4 w-4 text-[color:var(--esg-blue)]" aria-hidden="true" /> New project
          </button>
        }
      />

      <DataTable<Project>
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        onRetry={refetch}
        pageSize={8}
        onRowClick={(r) => openDetail("projects", r.id, "overview")}
        emptyTitle={projects.length === 0 ? "No projects yet" : "No projects match your filters"}
        emptyMessage={projects.length === 0 ? "Register your first project or site under a business unit." : "Try adjusting the search or filters."}
        toolbar={
          <Toolbar
            search={search}
            onSearch={setSearch}
            searchPlaceholder="Search projects & sites…"
            filters={[
              {
                key: "type",
                label: "Type",
                value: typeFilter,
                onChange: setTypeFilter,
                options: [{ value: "ALL", label: "All types" }, ...PTYPE_OPTIONS.map((p) => ({ value: p, label: p.replaceAll("_", " ") }))],
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
            onReset={() => {
              setSearch("");
              setStatusFilter("ALL");
              setTypeFilter("ALL");
            }}
            resultCount={rows.length}
            right={<ExportButton filename="meil-projects-sites" rows={exportRows} />}
          />
        }
        rowActions={(row) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" aria-label={`Actions for ${row.name}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass-strong rounded-2xl border-white/70">
              <DropdownMenuItem onClick={() => openEdit(row)}>
                <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
              </DropdownMenuItem>
              {row.status === "ACTIVE" ? (
                <DropdownMenuItem onClick={() => setConfirmTarget(row)} className="text-[#c34a4a] focus:text-[#c34a4a]">
                  <Power className="mr-2 h-3.5 w-3.5" /> Deactivate
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => activate(row)}>
                  <CheckCircle2 className="mr-2 h-3.5 w-3.5" /> Activate
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      {dialog}
      {confirm}
    </div>
  );
}
