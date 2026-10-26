"use client";

// ── BU MANAGER · SCREEN 04 — Data Entry Submissions ──
import { useMemo, useState } from "react";
import { Files } from "lucide-react";
import { FilesIcon } from "@/components/workspace/premium-icons";
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
  { value: "all", label: "All" },
  { value: "submitted", label: "Submitted" },
  { value: "pending", label: "Under Review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected / Returned" },
  { value: "resubmitted", label: "Resubmissions" },
];

export default function SubmissionsView() {
  const { params, reportingYear } = useBmWorkspace();
  const initialTab = typeof params.statusFilter === "string" && TABS.some((t) => t.value === params.statusFilter)
    ? params.statusFilter
    : "all";

  const [tab, setTab] = useState(initialTab);
  const [search, setSearch] = useState("");
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
      list = list.filter((s) => `${s.ref} ${s.title} ${s.submittedByName ?? ""} ${s.projectName ?? ""}`.toLowerCase().includes(q));
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
      key: "ref", header: "Submission", sortable: true, sortValue: (r) => r.ref,
      render: (r) => (
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-[color:var(--ink)]">{r.ref}</div>
          <div className="truncate text-[11.5px] text-[color:var(--ink-faint)]">{r.title}</div>
        </div>
      ),
    },
    { key: "category", header: "Category", render: (r) => <Chip tone="purple">{r.category}</Chip> },
    {
      key: "org", header: "Project / BU", render: (r) => (
        <div className="min-w-0">
          <div className="truncate text-[12.5px]">{r.level === "PROJECT" ? r.projectName ?? "—" : "BU level"}</div>
          <div className="truncate text-[10.5px] text-[color:var(--ink-faint)]">{r.submittedByName ?? "Unassigned"}</div>
        </div>
      ),
    },
    { key: "period", header: "Period", sortable: true, sortValue: (r) => r.period, render: (r) => <span className="text-[12px]">{r.period} · {r.fiscalQuarter}</span> },
    { key: "submittedAt", header: "Submitted", sortable: true, sortValue: (r) => r.submittedAt ?? "", render: (r) => <span className="text-[12px]">{fmtDate(r.submittedAt)}</span> },
    {
      key: "deadline", header: "Review deadline", sortable: true, sortValue: (r) => r.reviewDeadline ?? r.dueDate,
      render: (r) => (
        <div className="flex flex-col items-start gap-1">
          <span className="text-[12px]">{fmtDate(r.reviewDeadline)}</span>
          <UrgencyChip days={r.daysRemaining} />
        </div>
      ),
    },
    { key: "evidence", header: "Evidence", render: (r) => <EvidenceChip count={r.evidenceCount} /> },
    { key: "status", header: "Submission status", sortable: true, sortValue: (r) => r.status, render: (r) => <StatusChip status={r.status} /> },
  ];

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="Data Entry Submissions"
        description="Incoming project + BU submissions with version + evidence context. Submitted records are never silently modified — corrections follow the configured workflow and preserve revision history."
        icon={Files}
        actions={<ExportButton filename="bm-submissions" rows={rows.map((r) => ({ ref: r.ref, title: r.title, project: r.projectName ?? "", category: r.category, period: r.period, submittedBy: r.submittedByName ?? "", submittedAt: r.submittedAt ?? "", reviewDeadline: r.reviewDeadline, daysRemaining: r.daysRemaining ?? "", evidence: r.evidenceCount, status: r.status }))} />}
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
            : t.value === "resubmitted" ? data?.counts.resubmitted : 0;
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
        emptyTitle="No submissions match the current filter"
        emptyMessage="Submissions from project teams appear here as soon as they're filed."
        toolbar={
          <Toolbar
            search={search}
            onSearch={setSearch}
            searchPlaceholder="Search by ID, title, project or submitter…"
            filters={[
              { key: "project", label: "Project", value: projectFilter, onChange: setProjectFilter, options: [{ value: "ALL", label: "All projects" }, ...projectOptions] },
            ]}
            onReset={() => { setSearch(""); setProjectFilter("ALL"); }}
            resultCount={rows.length}
          />
        }
        rowActions={(r) => (
          <Button variant="ghost" size="sm" className="h-8 rounded-xl text-xs" onClick={() => openReview(r.id)}>
            Inspect
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
              <EvidenceChip count={r.evidenceCount} />
              <UrgencyChip days={r.daysRemaining} />
            </div>
            <Button size="sm" variant="outline" className="mt-2 h-8 w-full rounded-xl glass-subtle" onClick={() => openReview(r.id)}>Inspect submission</Button>
          </div>
        )}
      />

      <div className="flex items-center gap-2 text-[11.5px] text-[color:var(--ink-faint)]">
        <FilesIcon className="h-3.5 w-3.5 text-[color:var(--bum-purple-deep)]" />
        Submission versions + their evidence are preserved. The BU Manager cannot alter submitted values — corrections follow the configured workflow and are visible in the report's History tab.
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
