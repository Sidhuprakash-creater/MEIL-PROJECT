"use client";

// ── SCREEN 05 — Business Unit Management ──
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

interface UnitForm {
  name: string;
  subsidiaryId: string;
  code: string;
  managerName: string;
  adminName: string;
  status: string;
}

const EMPTY_FORM: UnitForm = { name: "", subsidiaryId: "", code: "", managerName: "", adminName: "", status: "ACTIVE" };

const inputCls = "glass-subtle rounded-2xl border-white/60 text-sm";

function UnitForm({
  editing,
  subsidiaries,
  subsLoading,
  pending,
  onSubmit,
  onCancel,
}: {
  editing: BusinessUnit | null;
  subsidiaries: { id: string; name: string }[];
  subsLoading: boolean;
  pending: boolean;
  onSubmit: (form: UnitForm) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<UnitForm>(() =>
    editing
      ? {
          name: editing.name,
          subsidiaryId: editing.subsidiaryId,
          code: editing.code,
          managerName: editing.managerName ?? "",
          adminName: editing.adminName ?? "",
          status: editing.status,
        }
      : EMPTY_FORM
  );
  const [errors, setErrors] = useState<{ name?: string; subsidiaryId?: string }>({});

  const set = (k: keyof UnitForm) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    const errs: { name?: string; subsidiaryId?: string } = {};
    if (form.name.trim().length < 2) errs.name = "Name is required (min 2 characters).";
    if (!form.subsidiaryId) errs.subsidiaryId = "Parent subsidiary is required.";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    onSubmit({ ...form, name: form.name.trim() });
  };

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Parent subsidiary" required error={errors.subsidiaryId}>
          <Select value={form.subsidiaryId} onValueChange={set("subsidiaryId")}>
            <SelectTrigger className={`${inputCls} w-full`} aria-label="Parent subsidiary">
              <SelectValue placeholder={subsLoading ? "Loading subsidiaries…" : "Select subsidiary"} />
            </SelectTrigger>
            <SelectContent className="glass-strong rounded-2xl border-white/70">
              {subsidiaries.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Name" required error={errors.name} htmlFor="bu-name">
          <Input id="bu-name" value={form.name} onChange={(e) => set("name")(e.target.value)} placeholder="e.g. Roads & Highways" className={inputCls} />
        </Field>
        <Field label="Code" hint="Auto-generated when left blank" htmlFor="bu-code">
          <Input id="bu-code" value={form.code} onChange={(e) => set("code")(e.target.value)} placeholder="e.g. BU-RDH" className={inputCls} />
        </Field>
        <Field label="Manager name" htmlFor="bu-manager">
          <Input id="bu-manager" value={form.managerName} onChange={(e) => set("managerName")(e.target.value)} placeholder="e.g. Kiran Rao" className={inputCls} />
        </Field>
        <Field label="Admin name" htmlFor="bu-admin">
          <Input id="bu-admin" value={form.adminName} onChange={(e) => set("adminName")(e.target.value)} placeholder="e.g. Sneha Nair" className={inputCls} />
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
          {editing ? "Save changes" : "Create unit"}
        </ActionButton>
      </div>
    </>
  );
}

function UnitDialog({
  open,
  onOpenChange,
  editing,
  subsidiaries,
  subsLoading,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: BusinessUnit | null;
  subsidiaries: { id: string; name: string }[];
  subsLoading: boolean;
  pending: boolean;
  onSubmit: (form: UnitForm) => void;
}) {
  return (
    <GlassDialog
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={editing ? "Edit business unit" : "New business unit"}
      description={editing ? `Update details for ${editing.name}.` : "Create a business unit under a subsidiary."}
    >
      {open && (
        <UnitForm
          key={editing?.id ?? "new"}
          editing={editing}
          subsidiaries={subsidiaries}
          subsLoading={subsLoading}
          pending={pending}
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
        />
      )}
    </GlassDialog>
  );
}

/* ────────────────────────────── detail tabs ────────────────────────────── */

type UnitTab = "overview" | "projects" | "users" | "submissions" | "activity";

function UnitDetail({ unit, onBack, onEdit }: { unit: BusinessUnit; onBack: () => void; onEdit: (u: BusinessUnit) => void }) {
  const { navigate, openDetail, params } = useWorkspace();
  const [tab, setTab] = useState<UnitTab>((params.detailTab as UnitTab) ?? "overview");

  const projectsRes = useApi<{ projects: Project[] }>(unit ? "/api/esg/org?type=projects" : null);
  const usersRes = useApi<{ users: User[] }>(unit ? "/api/esg/users" : null);
  const subsRes = useApi<{ submissions: Submission[] }>(unit ? "/api/esg/submissions" : null);

  const projects = useMemo(() => (projectsRes.data?.projects ?? []).filter((p) => p.businessUnitId === unit.id), [projectsRes.data, unit.id]);
  const users = useMemo(() => (usersRes.data?.users ?? []).filter((u) => u.businessUnitId === unit.id), [usersRes.data, unit.id]);
  const submissions = useMemo(() => (subsRes.data?.submissions ?? []).filter((s) => s.businessUnitId === unit.id), [subsRes.data, unit.id]);

  const activity = useMemo(
    () =>
      submissions
        .flatMap((s) => s.history.map((h) => ({ ...h, ref: s.ref, title: s.title })))
        .sort((a, b) => (a.at < b.at ? 1 : -1))
        .slice(0, 20),
    [submissions]
  );

  const st = unit.submissionStats;
  const pct = st && st.total > 0 ? (st.approved / st.total) * 100 : 0;

  const tabs: { value: UnitTab; label: string; icon: typeof Gauge; count?: number }[] = [
    { value: "overview", label: "Overview", icon: Gauge },
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
          title={unit.name}
          description={`Business unit of ${unit.subsidiaryName ?? "—"}`}
          icon={Layers}
          breadcrumbs={["Group", "Organization", "Business Units", unit.name]}
          actions={
            <>
              <Chip tone="purple">{unit.code}</Chip>
              <StatusBadge status={unit.status} />
              <button
                onClick={() => onEdit(unit)}
                className="glass inline-flex h-10 items-center gap-1.5 rounded-2xl border-white/60 px-4 text-[13px] font-medium text-[color:var(--ink)] transition-colors hover:bg-white/70"
              >
                <Pencil className="h-3.5 w-3.5 text-[color:var(--esg-blue)]" aria-hidden="true" /> Edit
              </button>
            </>
          }
        />
      </div>

      <GlassTabBar tabs={tabs} value={tab} onChange={(v) => setTab(v as UnitTab)} />

      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard label="Projects & Sites" icon={Building2} tone="teal" value={unit.projectCount ?? 0} onClick={() => setTab("projects")} />
            <KpiCard label="Users" icon={Users} tone="blue" value={unit.userCount ?? 0} onClick={() => setTab("users")} />
            <KpiCard label="Submissions" icon={ClipboardList} tone="amber" value={st?.total ?? 0} onClick={() => setTab("submissions")} />
            <KpiCard label="Overdue" icon={ActivityIcon} tone="red" value={st?.overdue ?? 0} onClick={() => setTab("submissions")} />
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <SectionCard title="Profile" description="Master data for this business unit" icon={Layers}>
              <div className="divide-y divide-[rgba(125,177,216,0.16)]">
                <InfoRow label="Code"><Chip tone="purple">{unit.code}</Chip></InfoRow>
                <InfoRow label="Subsidiary">{unit.subsidiaryName ?? "—"}</InfoRow>
                <InfoRow label="Manager">{unit.managerName || "—"}</InfoRow>
                <InfoRow label="Admin">{unit.adminName || "—"}</InfoRow>
                <InfoRow label="Status"><StatusBadge status={unit.status} /></InfoRow>
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
                {activity.length > 0 && (
                  <div>
                    <div className="mb-2 text-[13px] font-semibold text-[color:var(--ink)]">Latest events</div>
                    <ul className="flex flex-col gap-1.5">
                      {activity.slice(0, 5).map((h, i) => (
                        <li key={i} className="flex items-center justify-between gap-2 text-xs text-[color:var(--ink-faint)]">
                          <span className="truncate">
                            <span className="font-medium text-[color:var(--ink-soft)]">{h.actor}</span> · {h.action.replaceAll("_", " ").toLowerCase()} · {h.title}
                          </span>
                          <span className="shrink-0">{timeAgo(h.at)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      {tab === "projects" && (
        <DataTable<Project>
          columns={[
            { key: "code", header: "Code", render: (r) => <Chip tone="teal">{r.code}</Chip> },
            { key: "name", header: "Project / Site", render: (r) => <span className="font-semibold text-[color:var(--ink)]">{r.name}</span> },
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
          emptyMessage="Projects registered under this business unit will appear here."
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
          emptyMessage="Users assigned to this business unit will be listed here."
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
          emptyMessage="Submissions recorded under this business unit will appear here."
        />
      )}

      {tab === "activity" && (
        <SectionCard
          title="Recent activity"
          description="Flattened submission history for this business unit"
          icon={ActivityIcon}
          actions={
            <button onClick={() => navigate("activity")} className="text-xs font-medium text-[color:var(--esg-blue)] hover:underline">
              Open full activity feed
            </button>
          }
        >
          {activity.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <p className="text-sm text-[color:var(--muted-foreground)]">No recorded events yet. The full feed lives in Activity Monitoring.</p>
              <button
                onClick={() => navigate("activity")}
                className="glass inline-flex h-10 items-center rounded-2xl border-white/60 px-4 text-[13px] font-medium text-[color:var(--ink)] transition-colors hover:bg-white/70"
              >
                Go to Activity Monitoring
              </button>
            </div>
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

export default function UnitsView() {
  const { params, navigate, openDetail } = useWorkspace();
  const { toast } = useToast();
  const { data, loading, error, refetch } = useApi<{ businessUnits: BusinessUnit[] }>("/api/esg/org?type=business-units");
  const { data: subsData, loading: subsLoading } = useApi<{ subsidiaries: { id: string; name: string }[] }>(
    "/api/esg/org?type=subsidiaries&light=1"
  );

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BusinessUnit | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<BusinessUnit | null>(null);

  const saveMut = useMutation();
  const deactivateMut = useMutation();

  useEffect(() => {
    if (saveMut.error) toast({ title: "Save failed", description: saveMut.error, variant: "destructive" });
  }, [saveMut.error, toast]);
  useEffect(() => {
    if (deactivateMut.error) toast({ title: "Deactivation refused", description: deactivateMut.error, variant: "destructive" });
  }, [deactivateMut.error, toast]);

  const units = data?.businessUnits ?? [];
  const subsidiaries = subsData?.subsidiaries ?? [];

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return units.filter((r) => {
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (q) {
        const hay = [r.name, r.code, r.subsidiaryName ?? "", r.managerName, r.adminName].map((v) => (v ?? "").toLowerCase());
        if (!hay.some((v) => v.includes(q))) return false;
      }
      return true;
    });
  }, [units, search, statusFilter]);

  const detailId = params.detailId;
  const current = detailId ? units.find((u) => u.id === detailId) : null;

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (u: BusinessUnit) => {
    setEditing(u);
    setDialogOpen(true);
  };

  const submit = async (form: UnitForm) => {
    const payload = {
      type: "business-unit" as const,
      name: form.name,
      subsidiaryId: form.subsidiaryId,
      code: form.code.trim(),
      managerName: form.managerName.trim(),
      adminName: form.adminName.trim(),
      status: form.status,
    };
    const res = editing
      ? await saveMut.run(() => apiPatch("/api/esg/org", { id: editing.id, ...payload }))
      : await saveMut.run(() => apiPost("/api/esg/org", payload));
    if (res) {
      toast({ title: editing ? "Business unit updated" : "Business unit created", description: form.name });
      setDialogOpen(false);
      refetch();
    }
  };

  const deactivate = async (reason?: string) => {
    if (!confirmTarget || !reason) return;
    const res = await deactivateMut.run(() => apiDelete("/api/esg/org", { type: "business-unit", id: confirmTarget.id, reason }));
    if (res) {
      toast({ title: "Business unit deactivated", description: confirmTarget.name });
      setConfirmTarget(null);
      refetch();
    }
  };

  const activate = async (row: BusinessUnit) => {
    const res = await saveMut.run(() => apiPatch("/api/esg/org", { type: "business-unit", id: row.id, status: "ACTIVE" }));
    if (res) {
      toast({ title: "Business unit activated", description: row.name });
      refetch();
    }
  };

  const columns: Column<BusinessUnit>[] = [
    { key: "code", header: "Code", sortable: true, sortValue: (r) => r.code, render: (r) => <Chip tone="purple">{r.code}</Chip> },
    {
      key: "name",
      header: "Business Unit",
      sortable: true,
      sortValue: (r) => r.name,
      render: (r) => <span className="font-semibold text-[color:var(--ink)]">{r.name}</span>,
    },
    { key: "subsidiary", header: "Subsidiary", sortable: true, sortValue: (r) => r.subsidiaryName ?? "", render: (r) => r.subsidiaryName ?? "—" },
    { key: "manager", header: "Manager", render: (r) => r.managerName || "—" },
    { key: "projects", header: "Projects", sortable: true, sortValue: (r) => r.projectCount ?? 0, className: "tabular", render: (r) => r.projectCount ?? 0 },
    { key: "users", header: "Users", sortable: true, sortValue: (r) => r.userCount ?? 0, className: "tabular", render: (r) => r.userCount ?? 0 },
    { key: "subs", header: "Submissions", sortable: true, sortValue: (r) => r.submissionStats?.approved ?? 0, render: (r) => <StatsCell st={r.submissionStats} /> },
    { key: "status", header: "Status", sortable: true, sortValue: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
  ];

  const exportRows = rows.map((r) => ({
    code: r.code,
    name: r.name,
    subsidiary: r.subsidiaryName ?? "",
    manager: r.managerName,
    admin: r.adminName,
    projects: r.projectCount ?? 0,
    users: r.userCount ?? 0,
    submissions: r.submissionStats?.total ?? 0,
    approved: r.submissionStats?.approved ?? 0,
    overdue: r.submissionStats?.overdue ?? 0,
    status: r.status,
  }));

  const dialog = (
    <UnitDialog
      open={dialogOpen}
      onOpenChange={setDialogOpen}
      editing={editing}
      subsidiaries={subsidiaries}
      subsLoading={subsLoading}
      pending={saveMut.pending}
      onSubmit={submit}
    />
  );

  const confirm = (
    <ConfirmDialog
      open={!!confirmTarget}
      onOpenChange={(o) => !o && setConfirmTarget(null)}
      title="Deactivate business unit"
      message={`Deactivating "${confirmTarget?.name}" will disable it for reporting. Business units that still have linked projects cannot be deactivated.`}
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
        <UnitDetail
          key={`${current.id}:${params.detailTab ?? "overview"}`}
          unit={current}
          onBack={() => navigate("units")}
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
        title="Business Unit Management"
        description="Manage business units within subsidiaries and their reporting scope."
        icon={Layers}
        breadcrumbs={["Group", "Organization", "Business Units"]}
        actions={
          <button
            onClick={openCreate}
            className="glass inline-flex h-10 items-center gap-1.5 rounded-2xl border-white/60 px-4 text-[13px] font-medium text-[color:var(--ink)] transition-colors hover:bg-white/70"
          >
            <Plus className="h-4 w-4 text-[color:var(--esg-blue)]" aria-hidden="true" /> New business unit
          </button>
        }
      />

      <DataTable<BusinessUnit>
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        onRetry={refetch}
        pageSize={8}
        onRowClick={(r) => openDetail("units", r.id, "overview")}
        emptyTitle={units.length === 0 ? "No business units yet" : "No business units match your filters"}
        emptyMessage={units.length === 0 ? "Create a business unit under one of your subsidiaries to get started." : "Try adjusting the search or status filter."}
        toolbar={
          <Toolbar
            search={search}
            onSearch={setSearch}
            searchPlaceholder="Search business units…"
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
            right={<ExportButton filename="meil-business-units" rows={exportRows} />}
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
