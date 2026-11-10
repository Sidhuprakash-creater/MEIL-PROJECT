"use client";

// ── BU ADMIN · SCREEN 05 — Project Directory ──
// The BU Admin registers projects under its own business unit, monitors
// reporting, inspects teams and assigns deadlines.

import { useMemo, useState } from "react";
import { Building2, Plus } from "lucide-react";
import { ProjectsIcon } from "@/components/workspace/premium-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBaApi, apiPost, fmtDate, timeAgo, fmtDateTime } from "@/lib/ba/client";
import { useBaWorkspace } from "@/lib/ba/store";
import type { ProjectRow } from "@/lib/ba/types";
import {
  Chip, DataTable, EmptyState, ErrorState, ExportButton, InfoRow, LoadingBlock, PageHeader, SectionCard, StatusBadge, Toolbar, type Column,
} from "@/components/workspace/ui";
import { DetailSheet } from "@/components/workspace/ui";

type ProjectsResponse = {
  projects: ProjectRow[];
  total: number; page: number; pageSize: number;
  ptypeFacets: { id: string; name: string }[];
};

type DetailResponse = {
  project: ProjectRow;
  team: { id: string; name: string; email: string; role: string; status: string; title: string }[];
  submissions: { id: string; ref: string; title: string; status: string; overdue: boolean; submittedAt: string | null; dueDate: string }[];
  evidence: { id: string; name: string; fileType: string; status: string; uploadedAt: string; uploadedBy: string; version: number }[];
  timelines: { id: string; ref: string; name: string; period: string; level: string; dueDate: string | null; inheritanceMode: string; overrideReason: string; deadlineStatus: string }[];
  tasks: { id: string; ref: string; title: string; category: string; priority: string; status: string; dueDate: string }[];
  activity: { id: string; actorName: string; action: string; targetType: string; targetLabel: string; severity: string; createdAt: string }[];
};

export default function ProjectsView() {
  const { navigate, reportingYear } = useBaWorkspace();
  const [search, setSearch] = useState("");
  const [ptype, setPtype] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [detailId, setDetailId] = useState<string | null>(null);

  /* New-project dialog */
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", code: "", location: "", ptype: "SITE", capacityMw: "", frequency: "MONTHLY" });

  const openCreate = () => {
    setForm({ name: "", code: "", location: "", ptype: "SITE", capacityMw: "", frequency: "MONTHLY" });
    setCreateError(null);
    setCreateOpen(true);
  };
  const submitCreate = async () => {
    if (!form.name.trim()) { setCreateError("Project name is required."); return; }
    setCreating(true);
    setCreateError(null);
    try {
      await apiPost("/api/ba/projects", {
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        location: form.location.trim(),
        ptype: form.ptype,
        capacityMw: form.capacityMw ? Number(form.capacityMw) : 0,
        frequency: form.frequency,
        status: "ACTIVE",
      });
      setCreateOpen(false);
      refetch();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Failed to create project.");
    } finally {
      setCreating(false);
    }
  };

  const q = search.toLowerCase();
  const apiQ = `/api/ba/projects?q=${encodeURIComponent(q)}&ptype=${ptype}&status=${status}&period=${encodeURIComponent(reportingYear)}`;
  const { data, loading, error, refetch } = useBaApi<ProjectsResponse>(apiQ, { deps: [q, ptype, status, reportingYear] });

  const { data: detail, loading: detailLoading, error: detailError, refetch: detailRefetch } = useBaApi<DetailResponse>(detailId ? `/api/ba/projects/${detailId}` : null);
  const ptypeFacets = data?.ptypeFacets ?? [];

  const columns: Column<ProjectRow>[] = useMemo(() => [
    {
      key: "name", header: "Project", sortable: true, sortValue: (r) => r.name,
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="glass-subtle flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[10.5px] font-bold text-[color:var(--ba-sky-deep)]">{r.code.replace(/^PRJ-/, "").slice(0, 3)}</span>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-[color:var(--ink)]">{r.name}</div>
            <div className="truncate text-[11px] text-[color:var(--ink-faint)]">{r.code} · {r.ptype}</div>
          </div>
        </div>
      ),
    },
    { key: "location", header: "Location", render: (r) => <span className="truncate text-[12px] text-[color:var(--ink-soft)]">{r.location || "—"}</span> },
    { key: "responsible", header: "Responsible", render: (r) => <span className="text-[12px] text-[color:var(--ink-soft)]">{r.responsibleName}</span> },
    { key: "approved", header: "Approved", sortable: true, sortValue: (r) => r.approved, render: (r) => <span className="tabular text-[12px] font-semibold text-[#16A67A]">{r.approved}</span> },
    { key: "pending", header: "Pending", sortable: true, sortValue: (r) => r.pending, render: (r) => <span className="tabular text-[12px] font-semibold text-[#348BE8]">{r.pending}</span> },
    { key: "overdue", header: "Overdue", sortable: true, sortValue: (r) => r.overdue, render: (r) => <span className={`tabular text-[12px] font-semibold ${r.overdue > 0 ? "text-[#E35D6A]" : "text-[color:var(--ink-faint)]"}`}>{r.overdue}</span> },
    { key: "dueDate", header: "Effective due", sortable: true, sortValue: (r) => r.dueDate ?? "", render: (r) => r.dueDate ? <span className="text-[12px] text-[color:var(--ink-soft)]">{fmtDate(r.dueDate)}</span> : <Chip tone="gray">inherited</Chip> },
    { key: "validationState", header: "Validation", render: (r) => <Chip tone={r.validationState === "OK" ? "green" : r.validationState === "CRITICAL" ? "red" : r.validationState === "HIGH" ? "amber" : "blue"}>{r.validationState}</Chip> },
    { key: "status", header: "Status", sortable: true, sortValue: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
  ], []);

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="Project Directory"
        description={`${reportingYear} · Projects under your BU. Register new projects here, monitor reporting and assign project deadlines within policy.`}
        icon={ProjectsIcon}
        actions={
          <Button className="btn-ba-action rounded-2xl" onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" /><span>New project</span>
          </Button>
        }
      />

      {/* Create project dialog */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => !creating && setCreateOpen(false)}>
          <div className="glass-ba glass-sheen w-full max-w-lg rounded-3xl p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[rgba(52,139,232,0.12)] text-[#348BE8]"><Building2 className="h-4 w-4" /></span>
              <div>
                <div className="text-[14px] font-bold text-[color:var(--ink)]">Register a new project</div>
                <div className="text-[11px] text-[color:var(--ink-faint)]">The project is created under your business unit.</div>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[color:var(--ink-soft)]">Project name *</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Kaleshwaram Lift Irrigation Package-09" disabled={creating} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[color:var(--ink-soft)]">Code (optional)</label>
                  <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Auto-generated" disabled={creating} />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[color:var(--ink-soft)]">Location</label>
                  <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Telangana" disabled={creating} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[color:var(--ink-soft)]">Type</label>
                  <Select value={form.ptype} onValueChange={(v) => setForm({ ...form, ptype: v })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ptypeFacets.length > 0 ? ptypeFacets.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      )) : <SelectItem value="SITE">Site</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[color:var(--ink-soft)]">Capacity (MW)</label>
                  <Input type="number" min="0" value={form.capacityMw} onChange={(e) => setForm({ ...form, capacityMw: e.target.value })} placeholder="0" disabled={creating} />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[color:var(--ink-soft)]">Frequency</label>
                  <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MONTHLY">Monthly</SelectItem>
                      <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {createError && <div className="rounded-xl bg-[rgba(227,93,106,0.1)] px-3 py-2 text-[12px] font-semibold text-[#E35D6A]">{createError}</div>}
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" className="rounded-2xl" onClick={() => setCreateOpen(false)} disabled={creating}>Cancel</Button>
                <Button className="btn-ba-action rounded-2xl" onClick={submitCreate} disabled={creating}>
                  {creating ? "Creating…" : "Create project"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Toolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search project, code or location…"
        filters={[
          { key: "ptype", label: "Type", options: [{ value: "ALL", label: "All types" }, ...ptypeFacets.map((p) => ({ value: p.id, label: p.name }))], value: ptype, onChange: setPtype },
          { key: "status", label: "Status", options: [{ value: "ALL", label: "All" }, { value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }], value: status, onChange: setStatus },
        ]}
        onReset={() => { setSearch(""); setPtype("ALL"); setStatus("ALL"); }}
        resultCount={data?.total ?? 0}
        right={<ExportButton filename="ba-projects" rows={(data?.projects ?? []) as unknown as Record<string, unknown>[]} />}
      />

      <DataTable<ProjectRow>
        columns={columns}
        rows={data?.projects ?? []}
        loading={loading && !data}
        error={error && !data ? error : null}
        onRetry={refetch}
        pageSize={10}
        onRowClick={(r) => setDetailId(r.id)}
        emptyTitle={data?.total === 0 ? "No projects in your BU" : "No matches"}
        emptyMessage={data?.total === 0 ? "Register the BU's first project with the 'New project' button." : "Try adjusting the search or filters."}
        mobileCard={(r) => (
          <div className="flex flex-col gap-2 p-3">
            <div className="flex items-center justify-between"><span className="text-[13px] font-semibold">{r.name}</span><StatusBadge status={r.status} /></div>
            <div className="flex flex-wrap gap-2"><Chip tone="blue">{r.ptype}</Chip>{r.location && <Chip tone="gray">{r.location}</Chip>}</div>
            <div className="text-[11px] text-[color:var(--ink-faint)]">{r.approved} approved · {r.pending} pending · {r.overdue} overdue</div>
          </div>
        )}
      />

      <DetailSheet
        open={!!detailId}
        onOpenChange={(o) => { if (!o) setDetailId(null); }}
        title={detail?.project ? `${detail.project.code} — ${detail.project.name}` : "Project detail"}
        subtitle={detail?.project ? `${detail.project.ptype} · ${detail.project.location || "—"}` : "Loading…"}
        width="xl"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[12px] text-[color:var(--ink-faint)]">Project code · {detail?.project.code}</span>
            <Button className="btn-ba-action rounded-2xl" onClick={() => navigate("timelines", { create: Date.now(), orgId: detailId })}><span>Assign project deadline</span></Button>
          </div>
        }
      >
        {detailLoading && !detail ? <LoadingBlock rows={5} /> : detailError && !detail ? <ErrorState message={detailError} onRetry={detailRefetch} /> : detail ? (
          <div className="space-y-4">
            <SectionCard title="Profile" icon={Building2} noPad>
              <div className="px-4 py-2">
                <InfoRow label="Type">{detail.project.ptype}</InfoRow>
                <InfoRow label="Location">{detail.project.location || "—"}</InfoRow>
                <InfoRow label="Capacity">{detail.project.capacityMw ? `${detail.project.capacityMw} MW` : "—"}</InfoRow>
                <InfoRow label="Frequency">{detail.project.frequency}</InfoRow>
                <InfoRow label="Responsible">{detail.project.responsibleName}</InfoRow>
                <InfoRow label="Team size">{detail.team.length}</InfoRow>
                <InfoRow label="Effective due">{detail.project.dueDate ? fmtDate(detail.project.dueDate) : "Inherited from BU/Subsidiary"}</InfoRow>
                <InfoRow label="Created">{fmtDateTime(detail.project.createdAt)}</InfoRow>
              </div>
            </SectionCard>

            <SectionCard title={`Team (${detail.team.length})`} noPad>
              <div className="px-4 py-2">
                {detail.team.length === 0 ? <EmptyState title="No team members" /> : (
                  <div className="space-y-1.5">
                    {detail.team.map((u) => (
                      <div key={u.id} className="flex items-center justify-between rounded-xl bg-white/50 px-2.5 py-1.5 text-[12px]">
                        <div className="min-w-0"><div className="truncate font-semibold text-[color:var(--ink)]">{u.name}</div><div className="text-[10.5px] text-[color:var(--ink-faint)]">{u.title || u.email}</div></div>
                        <StatusBadge status={u.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard title={`Submissions (${detail.submissions.length})`} noPad>
              <div className="px-4 py-2">
                {detail.submissions.length === 0 ? <EmptyState title="No submissions yet" /> : (
                  <div className="space-y-1.5">
                    {detail.submissions.map((s) => (
                      <div key={s.id} className="flex items-center justify-between rounded-xl bg-white/50 px-2.5 py-1.5 text-[12px]">
                        <div className="min-w-0"><div className="truncate font-semibold text-[color:var(--ink)]">{s.title}</div><div className="text-[10.5px] text-[color:var(--ink-faint)]">{s.ref} · due {fmtDate(s.dueDate)}</div></div>
                        <div className="flex items-center gap-2">{s.overdue && <Chip tone="red">overdue</Chip>}<StatusBadge status={s.status} /></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard title="Project deadlines" noPad>
              <div className="px-4 py-2">
                {detail.timelines.length === 0 ? <EmptyState title="No project timeline yet" message="Assign a deadline from the Timelines screen." /> : (
                  <div className="space-y-1.5">
                    {detail.timelines.map((t) => (
                      <div key={t.id} className="flex items-center justify-between rounded-xl bg-white/50 px-2.5 py-1.5 text-[12px]">
                        <div className="min-w-0"><div className="truncate font-semibold text-[color:var(--ink)]">{t.name}</div><div className="text-[10.5px] text-[color:var(--ink-faint)]">{t.ref} · {t.period} · {t.inheritanceMode}{t.overrideReason ? ` · ${t.overrideReason}` : ""}</div></div>
                        <Chip tone={t.inheritanceMode === "OVERRIDE" ? "blue" : "gray"}>{t.dueDate ? fmtDate(t.dueDate) : "—"}</Chip>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard title="Recent activity" noPad>
              <div className="px-4 py-2">
                {detail.activity.length === 0 ? <EmptyState title="No recent activity" /> : (
                  <div className="space-y-1.5">
                    {detail.activity.slice(0, 6).map((a) => (
                      <div key={a.id} className="rounded-xl bg-white/50 px-2.5 py-1.5 text-[12px]">
                        <span className="font-semibold text-[color:var(--ink)]">{a.actorName}</span> <span className="text-[color:var(--ink-faint)]">{a.action.replace(/_/g, " ").toLowerCase()}</span> <span className="text-[color:var(--ink-soft)]">{a.targetLabel}</span>
                        <div className="text-[10.5px] text-[color:var(--ink-faint)]">{timeAgo(a.createdAt)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </SectionCard>
          </div>
        ) : <EmptyState title="Project not found" />}
      </DetailSheet>
    </div>
  );
}
