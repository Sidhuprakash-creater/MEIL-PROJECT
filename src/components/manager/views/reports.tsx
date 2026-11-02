"use client";

// ── SUBSIDIARY MANAGER · SCREENS 04 & 05 — BU Reports / Project Reports ──
import { useMemo, useState } from "react";
import { Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSmWorkspace } from "@/lib/sm/store";
import { fmtDate, useSmApi } from "@/lib/sm/client";
import type { SubmissionsResponse, SmSubmissionRow } from "@/lib/sm/types";
import {
  Chip, DataTable, EmptyState, ExportButton, GlassTabBar, PageHeader, Toolbar, type Column,
} from "@/components/workspace/ui";
import { EvidenceChip, StatusChip, UrgencyChip } from "@/components/manager/shared";
import { ReportReviewDialog } from "@/components/manager/review-detail";

/* One directory component parameterised by level — the manager must not
   create or edit BUs/projects here, so there are no creation controls. */
function ReportsDirectory({ level }: { level: "BU" | "PROJECT" }) {
  const { params, reportingYear, navigate } = useSmWorkspace();
  const initialTab = typeof params.statusFilter === "string" ? params.statusFilter : "all";

  const [tab, setTab] = useState(initialTab);
  const [search, setSearch] = useState(typeof params.q === "string" ? params.q : "");
  const [buFilter, setBuFilter] = useState("ALL");
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewTab, setReviewTab] = useState<string | undefined>(undefined);

  const levelQ = `&level=${level}`;
  const { data, loading, error, refetch } = useSmApi<SubmissionsResponse>(
    `/api/sm/submissions?tab=${tab}${levelQ}&period=${encodeURIComponent(reportingYear)}`,
    { deps: [tab, reportingYear] }
  );

  const rows = useMemo(() => {
    let list = data?.submissions ?? [];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((s) => `${s.ref} ${s.title} ${s.buName ?? ""} ${s.projectName ?? ""} ${s.submittedByName ?? ""}`.toLowerCase().includes(q));
    }
    if (buFilter !== "ALL") list = list.filter((s) => s.buId === buFilter);
    return list;
  }, [data, search, buFilter]);

  const buOptions = useMemo(() => {
    const map = new Map<string, string>();
    (data?.submissions ?? []).forEach((s) => s.buId && s.buName && map.set(s.buId, s.buName));
    return [...map.entries()].map(([value, label]) => ({ value, label }));
  }, [data]);

  const counts = data?.counts;

  const columns: Column<SmSubmissionRow>[] = [
    {
      key: "ref", header: level === "PROJECT" ? "Report / project" : "Report / BU", sortable: true, sortValue: (r) => r.ref,
      render: (r) => (
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-[color:var(--ink)]">{r.ref}</div>
          <div className="truncate text-[11.5px] text-[color:var(--ink-faint)]">{r.title}</div>
        </div>
      ),
    },
    {
      key: "org", header: level === "PROJECT" ? "Project / parent BU" : "Business unit",
      render: (r) => (
        <div className="min-w-0">
          <div className="truncate text-[12.5px] font-medium text-[color:var(--ink-soft)]">{level === "PROJECT" ? r.projectName ?? "—" : r.buName ?? "—"}</div>
          {level === "PROJECT" && <div className="truncate text-[10.5px] text-[color:var(--ink-faint)]">under {r.buName ?? "—"}</div>}
        </div>
      ),
    },
    { key: "category", header: "Category", render: (r) => <Chip tone="blue">{r.category}</Chip> },
    { key: "period", header: "Period", sortable: true, sortValue: (r) => r.period, render: (r) => <span className="text-[12px]">{r.period} · {r.fiscalQuarter}</span> },
    { key: "user", header: "Submitted by", render: (r) => <span className="text-[12.5px]">{r.submittedByName ?? "—"}</span> },
    { key: "submittedAt", header: "Submitted", sortable: true, sortValue: (r) => r.submittedAt ?? "", render: (r) => <span className="text-[12px]">{fmtDate(r.submittedAt)}</span> },
    { key: "due", header: "Due", sortable: true, sortValue: (r) => r.dueDate, render: (r) => <span className="text-[12px]">{fmtDate(r.dueDate)}</span> },
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

  const title = level === "PROJECT" ? "Project Reports" : "BU Reports";
  const description = level === "PROJECT"
    ? "Directory of project / site submissions with their review state. Read full content, inspect evidence, and decide when authorized."
    : "Directory of business-unit reporting records with their review state. Read full content, inspect evidence, and decide when authorized.";

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title={title}
        description={description}
        icon={Landmark}
        actions={<ExportButton filename={`${level.toLowerCase()}-reports`} rows={rows.map((r) => ({ ref: r.ref, title: r.title, org: level === "PROJECT" ? r.projectName ?? "" : r.buName ?? "", category: r.category, period: r.period, submittedBy: r.submittedByName ?? "", submittedAt: r.submittedAt ?? "", dueDate: r.dueDate, evidence: r.evidenceCount, status: r.status }))} />}
      />

      <GlassTabBar
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "all", label: "All", count: counts?.all ?? 0 },
          { value: "submitted", label: "Submitted", count: counts?.submitted ?? 0 },
          { value: "pending", label: "Pending Review", count: counts?.pending ?? 0 },
          { value: "approved", label: "Approved", count: counts?.approved ?? 0 },
          { value: "rejected", label: "Rejected", count: counts?.rejected ?? 0 },
          { value: "overdue", label: "Overdue", count: counts?.overdue ?? 0 },
        ]}
      />

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading && !data}
        error={error}
        onRetry={refetch}
        pageSize={8}
        onRowClick={(r) => {
          setReviewId(r.id);
          setReviewTab(undefined);
          setReviewOpen(true);
        }}
        emptyTitle="No reports in this view"
        emptyMessage={tab === "approved" ? "Nothing approved yet — decisions land here as you review." : "No reporting records match the current tab and filters."}
        emptyAction={<Button variant="outline" className="rounded-2xl" onClick={() => navigate("queue")}>Open the review queue</Button>}
        toolbar={
          <Toolbar
            search={search}
            onSearch={setSearch}
            searchPlaceholder="Search by report ID, title, BU or submitter…"
            filters={[
              { key: "bu", label: "BU", value: buFilter, onChange: setBuFilter, options: [{ value: "ALL", label: "All BUs" }, ...buOptions] },
            ]}
            onReset={() => {
              setSearch("");
              setBuFilter("ALL");
            }}
            resultCount={rows.length}
            right={tab === "overdue" ? <Chip tone="red">Deadline state — a report may also be pending review and overdue</Chip> : undefined}
          />
        }
        rowActions={(r) => (
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" className="h-8 rounded-xl text-xs" onClick={() => { setReviewId(r.id); setReviewTab(undefined); setReviewOpen(true); }}>
              Open
            </Button>
            <Button variant="ghost" size="sm" className="h-8 rounded-xl text-xs" onClick={() => { setReviewId(r.id); setReviewTab("evidence"); setReviewOpen(true); }}>
              Evidence
            </Button>
          </div>
        )}
        mobileCard={(r) => (
          <div className="glass-subtle rounded-2xl p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[13px] font-semibold text-[color:var(--ink)]">{r.ref}</span>
              <StatusChip status={r.status} />
            </div>
            <div className="mt-1 truncate text-[12px] text-[color:var(--ink-soft)]">{r.title}</div>
            <div className="mt-1 truncate text-[11px] text-[color:var(--ink-faint)]">{level === "PROJECT" ? `${r.projectName ?? "Project"} · ${r.buName ?? ""}` : r.buName ?? "BU"}</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <UrgencyChip days={r.daysRemaining} />
              <EvidenceChip count={r.evidenceCount} />
            </div>
            <Button size="sm" variant="outline" className="mt-2 h-8 w-full rounded-xl glass-subtle" onClick={() => { setReviewId(r.id); setReviewTab(undefined); setReviewOpen(true); }}>
              Open report
            </Button>
          </div>
        )}
      />

      <ReportReviewDialog
        submissionId={reviewId}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        startTab={reviewTab}
        onDecided={() => void refetch()}
      />
    </div>
  );
}

export function BuReportsView() {
  return <ReportsDirectory level="BU" />;
}

export function ProjectReportsView() {
  return <ReportsDirectory level="PROJECT" />;
}
