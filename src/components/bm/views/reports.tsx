"use client";

// ── BU MANAGER · SCREEN 05 — Project Reports directory ──
import { useMemo, useState } from "react";
import { Landmark } from "lucide-react";
import { ProjectsIcon } from "@/components/workspace/premium-icons";
import { Button } from "@/components/ui/button";
import { useBmWorkspace } from "@/lib/bm/store";
import { fmtDate, useBmApi } from "@/lib/bm/client";
import type { SubmissionsResponse, BmSubmissionRow } from "@/lib/bm/types";
import {
  Chip, DataTable, ExportButton, GlassTabBar, PageHeader, Toolbar, type Column,
} from "@/components/workspace/ui";
import { EvidenceChip, StatusChip, UrgencyChip } from "@/components/bm/shared";
import { ReportReviewWorkspace } from "@/components/bm/review-detail";

const TABS: { value: string; label: string }[] = [
  { value: "all", label: "All Reports" },
  { value: "submitted", label: "Submitted" },
  { value: "pending", label: "Under Review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "overdue", label: "Overdue" },
];

export default function ReportsView() {
  const { params, reportingYear } = useBmWorkspace();
  const initialTab = typeof params.statusFilter === "string" && TABS.some((t) => t.value === params.statusFilter)
    ? params.statusFilter
    : "all";

  const [tab, setTab] = useState(initialTab);
  const [search, setSearch] = useState(typeof params.q === "string" ? params.q : "");
  const [projectFilter, setProjectFilter] = useState("ALL");
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  const { data, loading, error, refetch } = useBmApi<SubmissionsResponse>(
    `/api/bm/submissions?tab=${tab}&period=${encodeURIComponent(reportingYear)}`,
    { deps: [tab, reportingYear] }
  );

  const rows = useMemo(() => {
    let list = data?.submissions ?? [];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((s) => `${s.ref} ${s.title} ${s.projectName ?? ""} ${s.buName ?? ""}`.toLowerCase().includes(q));
    }
    if (projectFilter !== "ALL") list = list.filter((s) => s.projectId === projectFilter);
    return list;
  }, [data, search, projectFilter]);

  const projectOptions = useMemo(() => {
    const map = new Map<string, string>();
    (data?.submissions ?? []).forEach((s) => s.projectId && s.projectName && map.set(s.projectId, s.projectName));
    return [...map.entries()].map(([value, label]) => ({ value, label }));
  }, [data]);

  const openReview = (id: string) => {
    setReviewId(id);
    setReviewOpen(true);
  };

  const columns: Column<BmSubmissionRow>[] = [
    {
      key: "ref", header: "Report / project", sortable: true, sortValue: (r) => r.ref,
      render: (r) => (
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-[color:var(--ink)]">{r.ref}</div>
          <div className="truncate text-[11.5px] text-[color:var(--ink-faint)]">{r.title}</div>
        </div>
      ),
    },
    {
      key: "project", header: "Project / level",
      render: (r) => (
        <div className="min-w-0">
          <div className="truncate text-[12.5px] font-medium text-[color:var(--ink-soft)]">{r.level === "PROJECT" ? r.projectName ?? "—" : "BU level"}</div>
          {r.level === "PROJECT" && <div className="truncate text-[10.5px] text-[color:var(--ink-faint)]">under {r.buName ?? "—"}</div>}
        </div>
      ),
    },
    { key: "category", header: "Category", render: (r) => <Chip tone="purple">{r.category}</Chip> },
    { key: "period", header: "Period", sortable: true, sortValue: (r) => r.period, render: (r) => <span className="text-[12px]">{r.period} · {r.fiscalQuarter}</span> },
    { key: "submittedAt", header: "Submitted", sortable: true, sortValue: (r) => r.submittedAt ?? "", render: (r) => <span className="text-[12px]">{fmtDate(r.submittedAt)}</span> },
    { key: "due", header: "Report due", sortable: true, sortValue: (r) => r.dueDate, render: (r) => <span className="text-[12px]">{fmtDate(r.dueDate)}</span> },
    { key: "evidence", header: "Evidence", render: (r) => <EvidenceChip count={r.evidenceCount} /> },
    {
      key: "status", header: "Review status", sortable: true, sortValue: (r) => r.status,
      render: (r) => (
        <div className="flex flex-col items-start gap-1">
          <StatusChip status={r.status} />
          {r.overdue && r.status !== "APPROVED" && <Chip tone="red">Deadline overdue</Chip>}
        </div>
      ),
    },
  ];

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="Project Reports"
        description="Directory of project / site reports and their review state. Read full content, inspect evidence, and decide when authorized."
        icon={Landmark}
        actions={<ExportButton filename="bm-project-reports" rows={rows.map((r) => ({ ref: r.ref, title: r.title, project: r.projectName ?? "", category: r.category, period: r.period, submittedBy: r.submittedByName ?? "", submittedAt: r.submittedAt ?? "", dueDate: r.dueDate, evidence: r.evidenceCount, status: r.status }))} />}
      />

      <GlassTabBar
        value={tab}
        onChange={setTab}
        tabs={TABS.map((t) => {
          const count = t.value === "all" ? data?.counts.all
            : t.value === "submitted" ? data?.counts.submitted
            : t.value === "pending" ? data?.counts.pending
            : t.value === "approved" ? data?.counts.approved
            : t.value === "rejected" ? data?.counts.rejected
            : t.value === "overdue" ? data?.counts.overdue : 0;
          return { value: t.value, label: t.label, count: count ?? 0 };
        })}
      />

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading && !data}
        error={error}
        onRetry={refetch}
        pageSize={10}
        onRowClick={(r) => openReview(r.id)}
        emptyTitle="No project reports match the current filter"
        emptyMessage="Reports filed by your project teams appear here."
        toolbar={
          <Toolbar
            search={search}
            onSearch={setSearch}
            searchPlaceholder="Search by ID, title or project…"
            filters={[
              { key: "project", label: "Project", value: projectFilter, onChange: setProjectFilter, options: [{ value: "ALL", label: "All projects" }, ...projectOptions] },
            ]}
            onReset={() => { setSearch(""); setProjectFilter("ALL"); }}
            resultCount={rows.length}
          />
        }
        rowActions={(r) => (
          <Button variant="ghost" size="sm" className="h-8 rounded-xl text-xs" onClick={() => openReview(r.id)}>
            Open report
          </Button>
        )}
        mobileCard={(r) => (
          <div className="glass-subtle rounded-2xl p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[13px] font-semibold text-[color:var(--ink)]">{r.ref}</span>
              <StatusChip status={r.status} />
            </div>
            <div className="mt-1 truncate text-[12px] text-[color:var(--ink-soft)]">{r.title}</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Chip tone="gray">{r.projectName ?? "BU"}</Chip>
              <UrgencyChip days={r.daysRemaining} />
              <EvidenceChip count={r.evidenceCount} />
            </div>
            <Button size="sm" className="btn-bum-action mt-2 h-8 w-full rounded-xl" onClick={() => openReview(r.id)}>Open report</Button>
          </div>
        )}
      />

      <div className="flex items-center gap-2 text-[11.5px] text-[color:var(--ink-faint)]">
        <ProjectsIcon className="h-3.5 w-3.5 text-[color:var(--bum-purple-deep)]" />
        The Report Review Workspace opens the full submission context — data values, validation issues, supporting evidence and the complete review history.
      </div>

      <ReportReviewWorkspace
        submissionId={reviewId}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        onDecided={() => void refetch()}
      />
    </div>
  );
}
