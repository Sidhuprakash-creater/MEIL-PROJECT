"use client";

// ── SUBSIDIARY ADMIN · SCREEN 03 — Business Unit Management ──
// Units are always created under THIS admin's subsidiary (server-enforced);
// there is no parent selector — the subsidiary itself is implicit.
import { useEffect, useMemo, useState } from "react";
import {
  Activity as ActivityIcon,
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSaWorkspace } from "@/lib/sa/store";
import {
  apiDelete, apiPatch, apiPost, fmtDate, timeAgo, useMutation, useSaApi,
} from "@/lib/sa/client";
import type { ActivityRow, SubmissionRow, UnitRow } from "@/lib/sa/types";
import {
  ActionButton, Chip, Column, ConfirmDialog, DataTable, ExportButton, Field, GlassDialog,
  GlassProgress, GlassTabBar, InfoRow, KpiCard, PageHeader, SectionCard, StatusBadge,
  Toolbar, EmptyState, ErrorState, LoadingBlock,
} from "@/components/workspace/ui";
import { CheckSealIcon, PeopleIcon, ProjectsIcon, UnitsIcon } from "@/components/workspace/premium-icons";
import { useToast } from "@/hooks/use-toast";

const inputCls = "glass-subtle rounded-2xl border-white/60 text-sm";

/* ────────────────────────────── create / edit form ────────────────────────────── */

interface UnitFormValues {
  name: string;
  code: string;
  description: string;
  managerName: string;
  adminName: string;
  status: string;
}

const EMPTY_UNIT_FORM: UnitFormValues = { name: "", code: "", description: "", managerName: "", adminName: "", status: "ACTIVE" };

function UnitFormFields({
  editing,
  pending,
  onSubmit,
  onCancel,
}: {
  editing: UnitRow | null;
  pending: boolean;
  onSubmit: (values: UnitFormValues) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<UnitFormValues>(() =>
    editing
      ? {
          name: editing.name,
          code: editing.code,
          description: "",
          managerName: editing.managerName === "—" ? "" : editing.managerName,
          adminName: editing.adminName === "—" ? "" : editing.adminName,
          status: editing.status,
        }
      : EMPTY_UNIT_FORM
  );
  const [errors, setErrors] = useState<{ name?: string }>({});

  const set = (k: keyof UnitFormValues) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    const errs: { name?: string } = {};
    const n = form.name.trim();
    if (n.length < 2 || n.length > 80) errs.name = "Name is required (2–80 characters).";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    onSubmit({ ...form, name: n });
  };

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required error={errors.name} htmlFor="sa-bu-name" hint="2–80 characters">
          <Input id="sa-bu-name" value={form.name} onChange={(e) => set("name")(e.target.value)} placeholder="e.g. Thermal Generation" className={inputCls} />
        </Field>
        <Field label="Code" htmlFor="sa-bu-code" hint="Auto-generated when left blank">
          <Input id="sa-bu-code" value={form.code} onChange={(e) => set("code")(e.target.value)} placeholder="e.g. BU-ENE-01" className={inputCls} disabled={!!editing} />
        </Field>
        <Field label="Manager name" htmlFor="sa-bu-manager">
          <Input id="sa-bu-manager" value={form.managerName} onChange={(e) => set("managerName")(e.target.value)} placeholder="e.g. Kiran Rao" className={inputCls} />
        </Field>
        <Field label="Admin name" htmlFor="sa-bu-admin">
          <Input id="sa-bu-admin" value={form.adminName} onChange={(e) => set("adminName")(e.target.value)} placeholder="e.g. Sneha Nair" className={inputCls} />
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
        <Field label="Description" htmlFor="sa-bu-desc" hint="Optional — shown on the unit profile">
          <Textarea id="sa-bu-desc" value={form.description} onChange={(e) => set("description")(e.target.value)} rows={2} placeholder="What does this business unit do?" className={inputCls} />
        </Field>
      </div>
      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" className="glass-subtle rounded-2xl" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <ActionButton pending={pending} onClick={submit} className="btn-action">
          {editing ? "Save changes" : "Create unit"}
        </ActionButton>
      </div>
    </>
  );
}

/* ────────────────────────────── detail dialog ────────────────────────────── */

interface UnitDetailProject { id: string; code: string; name: string; location: string; status: string; ptype: string }
interface UnitDetailUser { id: string; name: string; email: string; role: string; status: string; title: string }
interface UnitDetailData {
  unit: UnitRow;
  projects: UnitDetailProject[];
  users: UnitDetailUser[];
  submissions: SubmissionRow[];
  timelines: { id: string; ref: string; name: string; period: string; dueDate: string | null; status: string }[];
  activity: ActivityRow[];
}

type UnitTab = "overview" | "projects" | "submissions" | "activity";

function UnitDetailDialog({
  unitId,
  onClose,
  onEdit,
}: {
  unitId: string | null;
  onClose: () => void;
  onEdit: (u: UnitRow) => void;
}) {
  const { navigate } = useSaWorkspace();
  const [tab, setTab] = useState<UnitTab>("overview");
  const { data, loading, error, refetch } = useSaApi<UnitDetailData>(
    unitId ? `/api/sa/units/${unitId}` : null,
    { pollMs: 0 }
  );
  /* reset to the overview tab whenever the dialog targets a different unit */
  const [prevUnitId, setPrevUnitId] = useState(unitId);
  if (unitId !== prevUnitId) {
    setPrevUnitId(unitId);
    if (unitId) setTab("overview");
  }

  const unit = data?.unit;
  const tabs: { value: UnitTab; label: string; icon: React.ComponentType<{ className?: string }>; count?: number }[] = [
    { value: "overview", label: "Overview", icon: ClipboardList },
    { value: "projects", label: "Projects", icon: Building2, count: data?.projects.length },
    { value: "submissions", label: "Submissions", icon: ClipboardList, count: data?.submissions.length },
    { value: "activity", label: "Activity", icon: ActivityIcon },
  ];
  const st = unit ? { total: unit.approved + unit.submitted + unit.pending, approved: unit.approved } : null;

  return (
    <GlassDialog
      open={!!unitId}
      onOpenChange={(o) => !o && onClose()}
      wide
      title={unit ? `${unit.code} — ${unit.name}` : "Business unit details"}
      description={unit ? `Business unit of ${unit.subsidiaryName} · created ${fmtDate(unit.createdAt)}` : "Loading detail…"}
    >
      {error && <ErrorState message={error} onRetry={refetch} />}
      {!error && loading && !data && <LoadingBlock rows={5} label="Loading business unit…" />}
      {data && unit && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={unit.status} />
            <Chip tone="purple">{unit.code}</Chip>
            <Chip tone="blue">{unit.totalProjects} project{unit.totalProjects === 1 ? "" : "s"}</Chip>
            <Chip tone="teal">{unit.totalUsers} user{unit.totalUsers === 1 ? "" : "s"}</Chip>
            <Button variant="ghost" size="sm" className="ml-auto h-8 rounded-xl text-xs" onClick={() => onEdit(unit)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
            </Button>
          </div>

          <GlassTabBar tabs={tabs} value={tab} onChange={(v) => setTab(v as UnitTab)} />

          {tab === "overview" && (
            <div className="grid gap-4 xl:grid-cols-2">
              <SectionCard title="Profile" description="Master data for this business unit" icon={UnitsIcon}>
                <div className="divide-y divide-[rgba(125,177,216,0.16)]">
                  <InfoRow label="Code"><Chip tone="purple">{unit.code}</Chip></InfoRow>
                  <InfoRow label="Subsidiary">{unit.subsidiaryName}</InfoRow>
                  <InfoRow label="Manager">{unit.managerName || "—"}</InfoRow>
                  <InfoRow label="Admin">{unit.adminName || "—"}</InfoRow>
                  <InfoRow label="Status"><StatusBadge status={unit.status} /></InfoRow>
                  <InfoRow label="Created">{fmtDate(unit.createdAt)}</InfoRow>
                </div>
              </SectionCard>
              <SectionCard title="Reporting stats" description={`Approved share of all BU-level records`} icon={ClipboardList}>
                <div className="space-y-3">
                  <GlassProgress value={unit.completionPct} tone={unit.overdue > 0 ? "amber" : "green"} showLabel />
                  <div className="flex flex-wrap gap-2">
                    <Chip tone="green">{st?.approved ?? 0} approved</Chip>
                    <Chip tone="blue">{unit.submitted} submitted</Chip>
                    <Chip tone="amber">{unit.pending} pending</Chip>
                    <Chip tone={unit.overdue > 0 ? "red" : "gray"}>{unit.overdue} overdue</Chip>
                  </div>
                  <div className="divide-y divide-[rgba(125,177,216,0.16)]">
                    <InfoRow label="Projects">{unit.totalProjects}</InfoRow>
                    <InfoRow label="Users assigned">{unit.totalUsers}</InfoRow>
                  </div>
                </div>
              </SectionCard>
            </div>
          )}

          {tab === "projects" && (
            <div className="nice-scroll max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {data.projects.length === 0 && <EmptyState title="No projects yet" message="Projects registered under this business unit will appear here." />}
              {data.projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate("projects", { buId: unitId ?? undefined })}
                  className="glass-subtle flex w-full items-center justify-between gap-3 rounded-2xl p-3 text-left transition-colors hover:bg-white/80"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-[color:var(--ink)]">{p.name}</span>
                    <span className="block truncate text-[11px] text-[color:var(--ink-faint)]">{p.code} · {p.ptype.replaceAll("_", " ").toLowerCase()}{p.location ? ` · ${p.location}` : ""}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={p.status} />
                    <ArrowRight className="h-3.5 w-3.5 text-[color:var(--ink-faint)]" />
                  </span>
                </button>
              ))}
              {data.projects.length > 0 && (
                <Button variant="outline" size="sm" className="glass-subtle mt-1 w-full rounded-2xl border-white/60" onClick={() => navigate("projects", { buId: unitId ?? undefined })}>
                  Open all in Project & Site Management <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}

          {tab === "submissions" && (
            <div className="nice-scroll max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {data.submissions.length === 0 && <EmptyState title="No submissions" message="BU-level reporting records will appear here." />}
              {data.submissions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => navigate("submissions", { ref: s.ref })}
                  className="glass-subtle flex w-full items-center justify-between gap-3 rounded-2xl p-3 text-left transition-colors hover:bg-white/80"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-[color:var(--ink)]">{s.title}</span>
                    <span className="block truncate text-[11px] text-[color:var(--ink-faint)]">{s.ref} · {s.category} · due {fmtDate(s.dueDate)}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {s.overdue && s.status !== "APPROVED" && <Chip tone="red">overdue</Chip>}
                    <StatusBadge status={s.status} />
                  </span>
                </button>
              ))}
            </div>
          )}

          {tab === "activity" && (
            <SectionCard title="Recent activity" description="Subsidiary events involving this business unit" icon={ActivityIcon}>
              {data.activity.length === 0 ? (
                <EmptyState title="No activity yet" message="Actions involving this business unit will appear here." />
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

/* mobile card renderer */
function UnitMobileCard({ r, onOpen }: { r: UnitRow; onOpen: () => void }) {
  return (
    <GlassCardButton onClick={onOpen}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-semibold text-[color:var(--ink)]">{r.name}</div>
          <div className="text-[11px] text-[color:var(--ink-faint)]">{r.code} · {r.managerName || "no manager"}</div>
        </div>
        <StatusBadge status={r.status} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Chip tone="blue">{r.totalProjects} projects</Chip>
        <Chip tone="teal">{r.totalUsers} users</Chip>
        <Chip tone="green">{r.approved}/{r.approved + r.submitted + r.pending} approved</Chip>
        {r.overdue > 0 && <Chip tone="red">{r.overdue} overdue</Chip>}
      </div>
      <GlassProgress className="mt-2.5" value={r.completionPct} tone={r.completionPct >= 80 ? "green" : r.completionPct >= 40 ? "blue" : "amber"} showLabel />
    </GlassCardButton>
  );
}

function GlassCardButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="glass glass-sheen glass-lift block w-full rounded-3xl p-3.5 text-left">
      {children}
    </button>
  );
}

/* ────────────────────────────── main view ────────────────────────────── */

export default function UnitsView() {
  const { params, navigate, reportingYear } = useSaWorkspace();
  const { toast } = useToast();
  const { data, loading, error, refetch } = useSaApi<{ units: UnitRow[]; total: number }>(
    `/api/sa/units?pageSize=50&period=${encodeURIComponent(reportingYear)}`,
    { deps: [reportingYear] }
  );

  const [search, setSearch] = useState(() => (typeof params.q === "string" ? params.q : ""));
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [formOpen, setFormOpen] = useState(() => !!params.create);
  const [editing, setEditing] = useState<UnitRow | null>(null);
  const [detailId, setDetailId] = useState<string | null>(() => (typeof params.detailId === "string" && params.detailId ? params.detailId : null));
  const [confirmTarget, setConfirmTarget] = useState<{ row: UnitRow; mode: "deactivate" | "delete" } | null>(null);

  const saveMut = useMutation();
  const statusMut = useMutation();
  const deleteMut = useMutation();

  /* deep-link params: create / q / detailId — seeded on mount via the lazy
     initializers above, re-applied here when params change while the view is
     already mounted (React derived-state adjustment), then cleared. */
  const [prevParams, setPrevParams] = useState(params);
  if (params !== prevParams) {
    setPrevParams(params);
    if (typeof params.q === "string" && params.q) setSearch(params.q);
    if (params.create) setFormOpen(true);
    if (typeof params.detailId === "string" && params.detailId) setDetailId(params.detailId);
  }
  useEffect(() => {
    if (params.create || (typeof params.q === "string" && params.q) || (typeof params.detailId === "string" && params.detailId)) navigate("units");
  }, [params, navigate]);

  useEffect(() => {
    if (saveMut.error) toast({ title: editing ? "Update failed" : "Could not create business unit", description: saveMut.error, variant: "destructive" });
  }, [saveMut.error, editing, toast]);
  useEffect(() => {
    if (statusMut.error) toast({ title: "Status change refused", description: statusMut.error, variant: "destructive" });
  }, [statusMut.error, toast]);
  useEffect(() => {
    if (deleteMut.error) toast({ title: "Delete refused", description: deleteMut.error, variant: "destructive" });
  }, [deleteMut.error, toast]);

  const units = useMemo(() => data?.units ?? [], [data]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return units.filter((r) => {
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (q && !`${r.name} ${r.code} ${r.managerName} ${r.adminName}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [units, search, statusFilter]);

  const kpis = useMemo(
    () => ({
      total: units.length,
      active: units.filter((u) => u.status === "ACTIVE").length,
      projects: units.reduce((n, u) => n + u.totalProjects, 0),
      users: units.reduce((n, u) => n + u.totalUsers, 0),
    }),
    [units]
  );

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
  };

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (u: UnitRow) => {
    setEditing(u);
    setFormOpen(true);
  };

  const submitForm = async (values: UnitFormValues) => {
    const payload = {
      name: values.name,
      code: values.code.trim(),
      description: values.description.trim(),
      managerName: values.managerName.trim(),
      adminName: values.adminName.trim(),
      status: values.status,
    };
    const res = editing
      ? await saveMut.run(() => apiPatch(`/api/sa/units/${editing.id}`, payload))
      : await saveMut.run(() => apiPost("/api/sa/units", payload));
    if (res) {
      toast({ title: editing ? "Business unit updated" : "Business unit created", description: values.name });
      setFormOpen(false);
      setEditing(null);
      refetch();
    }
  };

  const setStatus = async (row: UnitRow, status: "ACTIVE" | "INACTIVE") => {
    const res = await statusMut.run(() => apiPatch(`/api/sa/units/${row.id}`, { status }));
    if (res) {
      toast({ title: status === "ACTIVE" ? "Business unit activated" : "Business unit deactivated", description: `${row.code} — ${row.name}` });
      setConfirmTarget(null);
      refetch();
    }
  };

  const removeUnit = async () => {
    if (!confirmTarget) return;
    const res = await deleteMut.run(() => apiDelete(`/api/sa/units/${confirmTarget.row.id}`));
    if (res) {
      toast({ title: "Business unit deleted", description: `${confirmTarget.row.code} — ${confirmTarget.row.name}` });
      setConfirmTarget(null);
      refetch();
    }
  };

  const columns: Column<UnitRow>[] = [
    {
      key: "name",
      header: "Business Unit",
      sortable: true,
      sortValue: (r) => r.name,
      render: (r) => (
        <div className="min-w-0">
          <div className="truncate font-semibold text-[color:var(--ink)]">{r.name}</div>
          <div className="text-[11px] text-[color:var(--ink-faint)]"><Chip tone="purple" className="mr-1.5">{r.code}</Chip>{r.description ? r.description.slice(0, 46) : ""}</div>
        </div>
      ),
    },
    { key: "manager", header: "Manager", render: (r) => r.managerName || "—" },
    { key: "admin", header: "Admin", render: (r) => r.adminName || "—" },
    { key: "projects", header: "Projects", sortable: true, sortValue: (r) => r.totalProjects, className: "tabular", render: (r) => r.totalProjects },
    { key: "users", header: "Users", sortable: true, sortValue: (r) => r.totalUsers, className: "tabular", render: (r) => r.totalUsers },
    {
      key: "reports",
      header: "Reports",
      sortable: true,
      sortValue: (r) => r.approved + r.submitted + r.pending,
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <span className="tabular text-[13px] font-medium text-[color:var(--ink-soft)]">{r.approved}/{r.approved + r.submitted + r.pending}</span>
          {r.overdue > 0 && <Chip tone="red">{r.overdue} overdue</Chip>}
        </div>
      ),
    },
    {
      key: "completion",
      header: "Completion",
      sortable: true,
      sortValue: (r) => r.completionPct,
      className: "min-w-[130px]",
      render: (r) => <GlassProgress value={r.completionPct} tone={r.completionPct >= 80 ? "green" : r.completionPct >= 40 ? "blue" : "amber"} showLabel />,
    },
    { key: "status", header: "Status", sortable: true, sortValue: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
  ];

  const exportRows = rows.map((r) => ({
    code: r.code,
    name: r.name,
    subsidiary: r.subsidiaryName,
    manager: r.managerName,
    admin: r.adminName,
    projects: r.totalProjects,
    users: r.totalUsers,
    reports_total: r.approved + r.submitted + r.pending,
    approved: r.approved,
    overdue: r.overdue,
    completion_pct: r.completionPct,
    status: r.status,
    created: r.createdAt,
  }));

  const formDialog = (
    <GlassDialog
      open={formOpen}
      onOpenChange={(o) => {
        setFormOpen(o);
        if (!o) setEditing(null);
      }}
      wide
      title={editing ? "Edit business unit" : "New business unit"}
      description={editing ? `Update details for ${editing.name}.` : "The unit is created under your subsidiary — the parent cannot be changed."}
    >
      {formOpen && (
        <UnitFormFields
          key={editing?.id ?? "new"}
          editing={editing}
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
      title={confirmTarget?.mode === "delete" ? "Delete business unit" : "Deactivate business unit"}
      message={
        confirmTarget?.mode === "delete"
          ? `Permanently delete "${confirmTarget.row.name}" (${confirmTarget.row.code})? This is only possible when the unit has no projects or users. Reporting history is preserved by deactivating instead.`
          : `Deactivating "${confirmTarget?.row.name}" disables it for reporting. Historical records are preserved and it can be re-activated later.`
      }
      confirmLabel={confirmTarget?.mode === "delete" ? "Delete" : "Deactivate"}
      destructive
      requireReason={confirmTarget?.mode === "delete"}
      pending={confirmTarget?.mode === "delete" ? deleteMut.pending : statusMut.pending}
      onConfirm={() => {
        if (!confirmTarget) return;
        if (confirmTarget.mode === "delete") void removeUnit();
        else void setStatus(confirmTarget.row, "INACTIVE");
      }}
    />
  );

  const detailDialog = (
    <UnitDetailDialog
      unitId={detailId}
      onClose={() => setDetailId(null)}
      onEdit={(u) => {
        setDetailId(null);
        openEdit(u);
      }}
    />
  );

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="Business Unit Management"
        description="Create and manage the business units inside your subsidiary. Units inherit reporting timelines from the subsidiary."
        icon={UnitsIcon}
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard label="Total business units" value={kpis.total} icon={UnitsIcon} tone="blue" hint="Across your subsidiary" onClick={clearFilters} />
        <KpiCard label="Active" value={kpis.active} icon={CheckSealIcon} tone="green" hint={`${kpis.total - kpis.active} inactive`} />
        <KpiCard label="Projects across BUs" value={kpis.projects} icon={ProjectsIcon} tone="purple" hint="Open Project & Site Management" onClick={() => navigate("projects")} />
        <KpiCard label="Users assigned" value={kpis.users} icon={PeopleIcon} tone="teal" hint="Open User Management" onClick={() => navigate("users")} />
      </div>

      <DataTable<UnitRow>
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        onRetry={refetch}
        pageSize={8}
        onRowClick={(r) => setDetailId(r.id)}
        emptyTitle={units.length === 0 ? "No business units yet" : "No business units match your filters"}
        emptyMessage={units.length === 0 ? "Add your first business unit to start reporting." : "Try adjusting the search or status filter."}
        emptyAction={
          units.length === 0 ? (
            <Button className="btn-action rounded-2xl" onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" /> Add Business Unit
            </Button>
          ) : undefined
        }
        toolbar={
          <Toolbar
            search={search}
            onSearch={setSearch}
            searchPlaceholder="Search name, code, manager…"
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
            onReset={clearFilters}
            resultCount={rows.length}
            right={
              <div className="flex items-center gap-2">
                <ExportButton filename="subsidiary-business-units" rows={exportRows} />
                <Button className="btn-action rounded-2xl" onClick={openCreate}>
                  <Plus className="mr-1.5 h-4 w-4" /> Add Business Unit
                </Button>
              </div>
            }
          />
        }
        mobileCard={(r) => <UnitMobileCard r={r} onOpen={() => setDetailId(r.id)} />}
        rowActions={(row) => {
          const hasDeps = row.totalProjects > 0 || row.totalUsers > 0;
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
                  disabled={hasDeps}
                  title={hasDeps ? `This unit still has ${row.totalProjects} project(s) and ${row.totalUsers} user(s). Deactivate it instead to preserve reporting history.` : undefined}
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
