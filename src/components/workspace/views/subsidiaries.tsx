"use client";

// ── SCREEN 04 — Subsidiary Management ──
import { useEffect, useMemo, useState } from "react";
import {
  Activity as ActivityIcon,
  ArrowLeft,
  Building2,
  CheckCircle2,
  ClipboardList,
  Gauge,
  Landmark,
  Layers,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "@/lib/esg/store";
import { apiDelete, apiPatch, apiPost, fmtDate, timeAgo, useApi, useMutation } from "@/lib/esg/client";
import type { BusinessUnit, Project, Submission, Subsidiary, User } from "@/lib/esg/types";
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

/* ────────────────────────────── shared cells ────────────────────────────── */

function StatsCell({ st }: { st?: { total: number; approved: number; pending: number; overdue: number } }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="tabular text-[13px] font-medium text-[color:var(--ink-soft)]">{st ? `${st.approved}/${st.total}` : "0/0"}</span>
      {st && st.overdue > 0 && <Chip tone="red">{st.overdue} overdue</Chip>}
    </div>
  );
}

/* ────────────────────────────── create / edit dialog ────────────────────────────── */

interface SubForm {
  name: string;
  code: string;
  sector: string;
  city: string;
  region: string;
  managerName: string;
  adminName: string;
  description: string;
  status: string;
}

const EMPTY_FORM: SubForm = {
  name: "",
  code: "",
  sector: "",
  city: "",
  region: "",
  managerName: "",
  adminName: "",
  description: "",
  status: "ACTIVE",
};

const inputCls = "glass-subtle rounded-2xl border-white/60 text-sm";

function SubsidiaryForm({
  editing,
  pending,
  onSubmit,
  onCancel,
}: {
  editing: Subsidiary | null;
  pending: boolean;
  onSubmit: (form: SubForm) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<SubForm>(() =>
    editing
      ? {
          name: editing.name,
          code: editing.code,
          sector: editing.sector ?? "",
          city: editing.city ?? "",
          region: editing.region ?? "",
          managerName: editing.managerName ?? "",
          adminName: editing.adminName ?? "",
          description: editing.description ?? "",
          status: editing.status,
        }
      : EMPTY_FORM
  );
  const [errors, setErrors] = useState<{ name?: string }>({});

  const set = (k: keyof SubForm) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    const name = form.name.trim();
    if (name.length < 2) {
      setErrors({ name: "Name is required (min 2 characters)." });
      return;
    }
    setErrors({});
    onSubmit({ ...form, name });
  };

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required error={errors.name} htmlFor="sub-name">
          <Input id="sub-name" value={form.name} onChange={(e) => set("name")(e.target.value)} placeholder="e.g. MEIL Energy Ltd" className={inputCls} />
        </Field>
        <Field label="Code" hint="Auto-generated when left blank" htmlFor="sub-code">
          <Input id="sub-code" value={form.code} onChange={(e) => set("code")(e.target.value)} placeholder="e.g. SUB-ENE" className={inputCls} />
        </Field>
        <Field label="Sector" htmlFor="sub-sector">
          <Input id="sub-sector" value={form.sector} onChange={(e) => set("sector")(e.target.value)} placeholder="e.g. Energy" className={inputCls} />
        </Field>
        <Field label="City" htmlFor="sub-city">
          <Input id="sub-city" value={form.city} onChange={(e) => set("city")(e.target.value)} placeholder="e.g. Hyderabad" className={inputCls} />
        </Field>
        <Field label="Region" htmlFor="sub-region">
          <Input id="sub-region" value={form.region} onChange={(e) => set("region")(e.target.value)} placeholder="e.g. South India" className={inputCls} />
        </Field>
        <Field label="Manager name" htmlFor="sub-manager">
          <Input id="sub-manager" value={form.managerName} onChange={(e) => set("managerName")(e.target.value)} placeholder="e.g. Priya Deshmukh" className={inputCls} />
        </Field>
        <Field label="Admin name" htmlFor="sub-admin">
          <Input id="sub-admin" value={form.adminName} onChange={(e) => set("adminName")(e.target.value)} placeholder="e.g. Rohan Kulkarni" className={inputCls} />
        </Field>
        <Field label="Status" htmlFor="sub-status">
          <Select value={form.status} onValueChange={set("status")}>
            <SelectTrigger id="sub-status" className={`${inputCls} w-full`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="glass-strong rounded-2xl border-white/70">
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Description" htmlFor="sub-desc">
            <Textarea id="sub-desc" rows={3} value={form.description} onChange={(e) => set("description")(e.target.value)} placeholder="What does this subsidiary do?" className={inputCls} />
          </Field>
        </div>
      </div>
      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" className="glass-subtle rounded-2xl" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <ActionButton pending={pending} onClick={submit}>
          {editing ? "Save changes" : "Create subsidiary"}
        </ActionButton>
      </div>
    </>
  );
}

function SubsidiaryDialog({
  open,
  onOpenChange,
  editing,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Subsidiary | null;
  pending: boolean;
  onSubmit: (form: SubForm) => void;
}) {
  return (
    <GlassDialog
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={editing ? "Edit subsidiary" : "New subsidiary"}
      description={editing ? `Update details for ${editing.name}.` : "Register a new subsidiary under the MEIL group."}
    >
      {open && (
        <SubsidiaryForm key={editing?.id ?? "new"} editing={editing} pending={pending} onSubmit={onSubmit} onCancel={() => onOpenChange(false)} />
      )}
    </GlassDialog>
  );
}

/* ────────────────────────────── detail tabs ────────────────────────────── */

type SubsTab = "overview" | "units" | "projects" | "users" | "submissions" | "activity";

function SubsidiaryDetail({ sub, onBack, onEdit }: { sub: Subsidiary; onBack: () => void; onEdit: (s: Subsidiary) => void }) {
  const { navigate, openDetail, params } = useWorkspace();
  const [tab, setTab] = useState<SubsTab>((params.detailTab as SubsTab) ?? "overview");

  const unitsRes = useApi<{ businessUnits: BusinessUnit[] }>(sub ? "/api/esg/org?type=business-units" : null);
  const projectsRes = useApi<{ projects: Project[] }>(sub ? "/api/esg/org?type=projects" : null);
  const usersRes = useApi<{ users: User[] }>(sub ? "/api/esg/users" : null);
  const subsRes = useApi<{ submissions: Submission[] }>(sub ? "/api/esg/submissions" : null);

  const units = useMemo(() => (unitsRes.data?.businessUnits ?? []).filter((u) => u.subsidiaryId === sub.id), [unitsRes.data, sub.id]);
  const projects = useMemo(() => (projectsRes.data?.projects ?? []).filter((p) => p.subsidiaryId === sub.id), [projectsRes.data, sub.id]);
  const users = useMemo(() => (usersRes.data?.users ?? []).filter((u) => u.subsidiaryId === sub.id), [usersRes.data, sub.id]);
  const submissions = useMemo(() => (subsRes.data?.submissions ?? []).filter((s) => s.subsidiaryId === sub.id), [subsRes.data, sub.id]);

  const activity = useMemo(
    () =>
      submissions
        .flatMap((s) => s.history.map((h) => ({ ...h, ref: s.ref, title: s.title })))
        .sort((a, b) => (a.at < b.at ? 1 : -1))
        .slice(0, 30),
    [submissions]
  );

  const st = sub.submissionStats;
  const pct = st && st.total > 0 ? (st.approved / st.total) * 100 : 0;

  const tabs: { value: SubsTab; label: string; icon: typeof Gauge; count?: number }[] = [
    { value: "overview", label: "Overview", icon: Gauge },
    { value: "units", label: "Business Units", icon: Layers, count: units.length },
    { value: "projects", label: "Projects", icon: Building2, count: projects.length },
    { value: "users", label: "Users", icon: Users, count: users.length },
    { value: "submissions", label: "Submissions", icon: ClipboardList, count: submissions.length },
    { value: "activity", label: "Activity", icon: ActivityIcon },
  ];

  return (
    <div className="view-in space-y-5">
      <div>
        <Button variant="ghost" size="sm" className="mb-3 rounded-2xl text-[color:var(--ink-soft)]" onClick={onBack}>
          <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" /> Back to list
        </Button>
        <PageHeader
          title={sub.name}
          description={sub.description || `Subsidiary ${sub.code}`}
          icon={Landmark}
          breadcrumbs={["Group", "Organization", "Subsidiaries", sub.name]}
          actions={
            <>
              <Chip tone="blue">{sub.code}</Chip>
              <StatusBadge status={sub.status} />
              <button
                onClick={() => onEdit(sub)}
                className="glass inline-flex h-10 items-center gap-1.5 rounded-2xl border-white/60 px-4 text-[13px] font-medium text-[color:var(--ink)] transition-colors hover:bg-white/70"
              >
                <Pencil className="h-3.5 w-3.5 text-[color:var(--esg-blue)]" aria-hidden="true" /> Edit
              </button>
            </>
          }
        />
      </div>

      <GlassTabBar tabs={tabs} value={tab} onChange={(v) => setTab(v as SubsTab)} />

      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard label="Business Units" icon={Layers} tone="purple" value={sub.unitCount ?? 0} onClick={() => setTab("units")} />
            <KpiCard label="Projects & Sites" icon={Building2} tone="teal" value={sub.projectCount ?? 0} onClick={() => setTab("projects")} />
            <KpiCard label="Users" icon={Users} tone="blue" value={sub.userCount ?? 0} onClick={() => setTab("users")} />
            <KpiCard label="Submissions" icon={ClipboardList} tone="amber" value={st?.total ?? 0} onClick={() => setTab("submissions")} />
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <SectionCard title="Profile" description="Master data for this subsidiary" icon={Landmark}>
              <div className="divide-y divide-[rgba(125,177,216,0.16)]">
                <InfoRow label="Code"><Chip tone="blue">{sub.code}</Chip></InfoRow>
                <InfoRow label="Sector">{sub.sector || "—"}</InfoRow>
                <InfoRow label="City / Region">{[sub.city, sub.region].filter(Boolean).join(", ") || "—"}</InfoRow>
                <InfoRow label="Manager">{sub.managerName || "—"}</InfoRow>
                <InfoRow label="Admin">{sub.adminName || "—"}</InfoRow>
                <InfoRow label="Status"><StatusBadge status={sub.status} /></InfoRow>
                <InfoRow label="Description"><span className="max-w-xs text-right">{sub.description || "—"}</span></InfoRow>
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
                </div>
                <p className="text-xs leading-relaxed text-[color:var(--ink-faint)]">
                  Progress reflects submissions recorded directly under {sub.name}. Business-unit and project-level rollups appear in their own tabs.
                </p>
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      {tab === "units" && (
        <DataTable<BusinessUnit>
          columns={[
            { key: "code", header: "Code", render: (r) => <Chip tone="purple">{r.code}</Chip> },
            { key: "name", header: "Business Unit", render: (r) => <span className="font-semibold text-[color:var(--ink)]">{r.name}</span> },
            { key: "manager", header: "Manager", render: (r) => r.managerName || "—" },
            { key: "projects", header: "Projects", render: (r) => r.projectCount ?? 0, className: "tabular" },
            { key: "users", header: "Users", render: (r) => r.userCount ?? 0, className: "tabular" },
            { key: "subs", header: "Submissions", render: (r) => <StatsCell st={r.submissionStats} /> },
            { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
          ]}
          rows={units}
          loading={unitsRes.loading}
          error={unitsRes.error}
          onRetry={unitsRes.refetch}
          onRowClick={(r) => openDetail("units", r.id, "overview")}
          emptyTitle="No business units"
          emptyMessage="Business units created under this subsidiary will be listed here."
        />
      )}

      {tab === "projects" && (
        <DataTable<Project>
          columns={[
            { key: "code", header: "Code", render: (r) => <Chip tone="teal">{r.code}</Chip> },
            { key: "name", header: "Project / Site", render: (r) => <span className="font-semibold text-[color:var(--ink)]">{r.name}</span> },
            { key: "bu", header: "Business Unit", render: (r) => r.businessUnitName ?? "—" },
            { key: "location", header: "Location", render: (r) => r.location || "—" },
            { key: "type", header: "Type", render: (r) => <Chip tone="gray">{r.ptype.replaceAll("_", " ")}</Chip> },
            { key: "subs", header: "Submissions", render: (r) => <StatsCell st={r.submissionStats} /> },
            { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
          ]}
          rows={projects}
          loading={projectsRes.loading}
          error={projectsRes.error}
          onRetry={projectsRes.refetch}
          onRowClick={(r) => openDetail("projects", r.id, "overview")}
          emptyTitle="No projects"
          emptyMessage="Projects and sites registered under this subsidiary will appear here."
        />
      )}

      {tab === "users" && (
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
          emptyTitle="No users"
          emptyMessage="Users assigned to this subsidiary will be listed here."
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
          emptyMessage="Submissions recorded under this subsidiary will appear here."
        />
      )}

      {tab === "activity" && (
        <SectionCard
          title="Recent activity"
          description="Flattened submission history for this subsidiary"
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
                  <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-[#3a7bff]" aria-hidden="true" />
                  <div className="text-[13px] text-[color:var(--ink-soft)]">
                    <span className="font-semibold text-[color:var(--ink)]">{h.actor}</span>
                    <span className="mx-1.5 rounded-md bg-[rgba(58,123,255,0.1)] px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-[#1d5fd6]">
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

export default function SubsidiariesView() {
  const { params, navigate, openDetail } = useWorkspace();
  const { toast } = useToast();
  const { data, loading, error, refetch } = useApi<{ subsidiaries: Subsidiary[] }>("/api/esg/org?type=subsidiaries");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Subsidiary | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Subsidiary | null>(null);

  const saveMut = useMutation<{ warning?: string | null }>();
  const deactivateMut = useMutation();

  useEffect(() => {
    if (saveMut.error) toast({ title: "Save failed", description: saveMut.error, variant: "destructive" });
  }, [saveMut.error, toast]);
  useEffect(() => {
    if (deactivateMut.error) toast({ title: "Deactivation refused", description: deactivateMut.error, variant: "destructive" });
  }, [deactivateMut.error, toast]);

  const subsidiaries = data?.subsidiaries ?? [];

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return subsidiaries.filter((r) => {
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (q) {
        const hay = [r.name, r.code, r.sector, r.region, r.city, r.managerName, r.adminName].map((v) => (v ?? "").toLowerCase());
        if (!hay.some((v) => v.includes(q))) return false;
      }
      return true;
    });
  }, [subsidiaries, search, statusFilter]);

  const detailId = params.detailId;
  const current = detailId ? subsidiaries.find((s) => s.id === detailId) : null;

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (s: Subsidiary) => {
    setEditing(s);
    setDialogOpen(true);
  };

  const submit = async (form: SubForm) => {
    const payload = {
      type: "subsidiary" as const,
      name: form.name,
      code: form.code.trim(),
      sector: form.sector.trim(),
      city: form.city.trim(),
      region: form.region.trim(),
      managerName: form.managerName.trim(),
      adminName: form.adminName.trim(),
      description: form.description.trim(),
      status: form.status,
    };
    const res = editing
      ? await saveMut.run(() => apiPatch<{ warning?: string | null }>("/api/esg/org", { id: editing.id, ...payload }))
      : await saveMut.run(() => apiPost<{ warning?: string | null }>("/api/esg/org", payload));
    if (res) {
      toast({ title: editing ? "Subsidiary updated" : "Subsidiary created", description: form.name });
      if (res.warning) toast({ title: "Attention", description: res.warning });
      setDialogOpen(false);
      refetch();
    }
  };

  const deactivate = async (reason?: string) => {
    if (!confirmTarget || !reason) return;
    const res = await deactivateMut.run(() => apiDelete("/api/esg/org", { type: "subsidiary", id: confirmTarget.id, reason }));
    if (res) {
      toast({ title: "Subsidiary deactivated", description: confirmTarget.name });
      setConfirmTarget(null);
      refetch();
    }
  };

  const activate = async (row: Subsidiary) => {
    const res = await saveMut.run(() => apiPatch("/api/esg/org", { type: "subsidiary", id: row.id, status: "ACTIVE" }));
    if (res) {
      toast({ title: "Subsidiary activated", description: row.name });
      refetch();
    }
  };

  const columns: Column<Subsidiary>[] = [
    { key: "code", header: "Code", sortable: true, sortValue: (r) => r.code, render: (r) => <Chip tone="blue">{r.code}</Chip> },
    {
      key: "name",
      header: "Subsidiary",
      sortable: true,
      sortValue: (r) => r.name,
      render: (r) => (
        <div className="min-w-0">
          <div className="font-semibold text-[color:var(--ink)]">{r.name}</div>
          {r.description && <div className="line-clamp-1 text-xs text-[color:var(--ink-faint)]">{r.description}</div>}
        </div>
      ),
    },
    {
      key: "sector",
      header: "Sector / Region",
      render: (r) => (
        <div className="text-[13px]">
          {r.sector || "—"}
          <div className="text-xs text-[color:var(--ink-faint)]">{[r.city, r.region].filter(Boolean).join(", ") || "—"}</div>
        </div>
      ),
    },
    { key: "manager", header: "Manager", render: (r) => r.managerName || "—" },
    { key: "units", header: "Units", sortable: true, sortValue: (r) => r.unitCount ?? 0, className: "tabular", render: (r) => r.unitCount ?? 0 },
    { key: "projects", header: "Projects", sortable: true, sortValue: (r) => r.projectCount ?? 0, className: "tabular", render: (r) => r.projectCount ?? 0 },
    { key: "users", header: "Users", sortable: true, sortValue: (r) => r.userCount ?? 0, className: "tabular", render: (r) => r.userCount ?? 0 },
    { key: "subs", header: "Submissions", sortable: true, sortValue: (r) => r.submissionStats?.approved ?? 0, render: (r) => <StatsCell st={r.submissionStats} /> },
    { key: "status", header: "Status", sortable: true, sortValue: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
  ];

  const exportRows = rows.map((r) => ({
    code: r.code,
    name: r.name,
    sector: r.sector,
    city: r.city,
    region: r.region,
    manager: r.managerName,
    admin: r.adminName,
    units: r.unitCount ?? 0,
    projects: r.projectCount ?? 0,
    users: r.userCount ?? 0,
    submissions: r.submissionStats?.total ?? 0,
    approved: r.submissionStats?.approved ?? 0,
    overdue: r.submissionStats?.overdue ?? 0,
    status: r.status,
  }));

  /* Detail mode */
  if (detailId && current) {
    return (
      <>
        <SubsidiaryDetail
          key={`${current.id}:${params.detailTab ?? "overview"}`}
          sub={current}
          onBack={() => navigate("subsidiaries")}
          onEdit={openEdit}
        />
        <SubsidiaryDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          editing={editing}
          pending={saveMut.pending}
          onSubmit={submit}
        />
        <ConfirmDialog
          open={!!confirmTarget}
          onOpenChange={(o) => !o && setConfirmTarget(null)}
          title="Deactivate subsidiary"
          message={`Deactivating "${confirmTarget?.name}" will disable it for reporting. Subsidiaries that still have business units cannot be deactivated.`}
          confirmLabel="Deactivate"
          destructive
          requireReason
          pending={deactivateMut.pending}
          onConfirm={deactivate}
        />
      </>
    );
  }
  return (
    <div className="view-in space-y-5">
      <PageHeader
        title="Subsidiary Management"
        description="Create and manage subsidiaries, assign managers and admins."
        icon={Landmark}
        breadcrumbs={["Group", "Organization", "Subsidiaries"]}
        actions={
          <button
            onClick={openCreate}
            className="glass inline-flex h-10 items-center gap-1.5 rounded-2xl border-white/60 px-4 text-[13px] font-medium text-[color:var(--ink)] transition-colors hover:bg-white/70"
          >
            <Plus className="h-4 w-4 text-[color:var(--esg-blue)]" aria-hidden="true" /> New subsidiary
          </button>
        }
      />

      <DataTable<Subsidiary>
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        onRetry={refetch}
        pageSize={8}
        onRowClick={(r) => openDetail("subsidiaries", r.id, "overview")}
        emptyTitle={subsidiaries.length === 0 ? "No subsidiaries yet" : "No subsidiaries match your filters"}
        emptyMessage={subsidiaries.length === 0 ? "Create your first subsidiary to start structuring the group." : "Try adjusting the search or status filter."}
        toolbar={
          <Toolbar
            search={search}
            onSearch={setSearch}
            searchPlaceholder="Search subsidiaries…"
            filters={[
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
            }}
            resultCount={rows.length}
            right={<ExportButton filename="meil-subsidiaries" rows={exportRows} />}
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

      <SubsidiaryDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} pending={saveMut.pending} onSubmit={submit} />

      <ConfirmDialog
        open={!!confirmTarget}
        onOpenChange={(o) => !o && setConfirmTarget(null)}
        title="Deactivate subsidiary"
        message={`Deactivating "${confirmTarget?.name}" will disable it for reporting. Subsidiaries that still have business units cannot be deactivated.`}
        confirmLabel="Deactivate"
        destructive
        requireReason
        pending={deactivateMut.pending}
        onConfirm={deactivate}
      />
    </div>
  );
}
