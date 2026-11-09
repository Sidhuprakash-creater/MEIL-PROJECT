"use client";

// ── BU MANAGER · SCREEN 03 — Review Queue (primary work area) ──
import { useMemo, useState } from "react";
import { Landmark } from "lucide-react";
import { CheckSealIcon } from "@/components/workspace/premium-icons";
import { Button } from "@/components/ui/button";
import { useBmWorkspace } from "@/lib/bm/store";
import { fmtDate, useBmApi } from "@/lib/bm/client";
import type { SubmissionsResponse, BmSubmissionRow } from "@/lib/bm/types";
import {
  Chip, DataTable, ExportButton, PageHeader, Toolbar, type Column,
} from "@/components/workspace/ui";
import { EvidenceChip, StatusChip, UrgencyChip } from "@/components/bm/shared";
import { ReportReviewWorkspace } from "@/components/bm/review-detail";

const TABS: { value: string; label: string }[] = [
  { value: "queue", label: "Awaiting Review" },
  { value: "pending", label: "In Progress" },
  { value: "returned", label: "Returned for Correction" },
  { value: "resubmitted", label: "Resubmitted" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "overdue", label: "Overdue Reviews" },
];

export default function QueueView() {
  const { params, navigate, reportingYear } = useBmWorkspace();
  const initialTab = typeof params.statusFilter === "string" && TABS.some((t) => t.value === params.statusFilter)
    ? params.statusFilter
    : "queue";

  const [tab, setTab] = useState(initialTab);
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("ALL");
  const [evidenceFilter, setEvidenceFilter] = useState("ALL");
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewTab, setReviewTab] = useState<string | undefined>(undefined);

  const { data, loading, error, refetch } = useBmApi<SubmissionsResponse>(
    `/api/bm/submissions?tab=${tab}&period=${encodeURIComponent(reportingYear)}`,
    { deps: [tab, reportingYear] }
  );

  const rows = useMemo(() => {
    let list = data?.submissions ?? [];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((s) => `${s.ref} ${s.title} ${s.buName ?? ""} ${s.projectName ?? ""} ${s.submittedByName ?? ""}`.toLowerCase().includes(q));
    }
    if (projectFilter !== "ALL") list = list.filter((s) => s.projectId === projectFilter);
    if (evidenceFilter === "none") list = list.filter((s) => s.evidenceCount === 0);
    if (evidenceFilter === "attached") list = list.filter((s) => s.evidenceCount > 0);
    return list;
  }, [data, search, projectFilter, evidenceFilter]);

  const projectOptions = useMemo(() => {
    const map = new Map<string, string>();
    (data?.submissions ?? []).forEach((s) => s.projectId && s.projectName && map.set(s.projectId, s.projectName));
    return [...map.entries()].map(([value, label]) => ({ value, label }));
  }, [data]);

  const openReview = (id: string, tab?: string) => {
    setReviewId(id);
    setReviewTab(tab);
    setReviewOpen(true);
  };

  const columns: Column<BmSubmissionRow>[] = [
    {
      key: "ref", header: "Report", sortable: true, sortValue: (r) => r.ref,
      render: (r) => (
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-[color:var(--ink)]">{r.ref}</div>
          <div className="truncate text-[11.5px] text-[color:var(--ink-faint)]">{r.title}</div>
        </div>
      ),
    },
    { key: "category", header: "Category", render: (r) => <Chip tone="purple">{r.category}</Chip> },
    {
      key: "org", header: "Project", render: (r) => (
        <div className="min-w-0">
          <div className="truncate text-[12.5px] font-medium text-[color:var(--ink-soft)]">{r.level === "PROJECT" ? r.projectName ?? "—" : "BU level"}</div>
          {r.level === "PROJECT" && <div className="truncate text-[10.5px] text-[color:var(--ink-faint)]">under {r.buName ?? "—"}</div>}
        </div>
      ),
    },
    { key: "period", header: "Period", sortable: true, sortValue: (r) => r.period, render: (r) => <span className="text-[12px]">{r.period} · {r.fiscalQuarter}</span> },
    {
      key: "user", header: "Responsible", render: (r) => (
        <div className="flex flex-col">
          <span className="text-[12.5px] font-medium text-[color:var(--ink)]">{r.submittedByName || "Project User"}</span>
          {r.forwardedByName ? (
            <span className="text-[10.5px] text-[color:var(--bum-purple-deep)] font-medium">Forwarded by {r.forwardedByName} (PA)</span>
          ) : (r.forwardedToBu || (r as any).inConsolidatedReport) ? (
            <span className="text-[10.5px] text-[color:var(--bum-purple-deep)] font-medium">Forwarded by Project Admin</span>
          ) : null}
        </div>
      )
    },
    {
      key: "submittedAt", header: "Submitted", sortable: true, sortValue: (r) => r.forwardedToBuAt ?? r.submittedAt ?? r.lastUpdated,
      render: (r) => {
        const dt = r.forwardedToBuAt ?? r.submittedAt ?? r.lastUpdated;
        if (!dt) return <span className="text-[12px] text-[color:var(--ink-faint)]">—</span>;
        const d = new Date(dt);
        const dateStr = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
        const timeStr = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
        return (
          <div className="flex flex-col">
            <span className="text-[12px] font-semibold text-[color:var(--ink)]">{dateStr}</span>
            <span className="text-[10.5px] text-[color:var(--ink-soft)] font-medium">{timeStr}</span>
          </div>
        );
      }
    },
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
    { key: "status", header: "Status", render: (r) => <StatusChip status={r.status} /> },
  ];

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="Review Queue"
        description="Reports currently awaiting your decision — prioritised with overdue reviews first, then validation warnings, then closest deadline. Nothing is decided automatically."
        icon={Landmark}
        actions={<ExportButton filename="bm-review-queue" rows={rows.map((r) => ({ ref: r.ref, title: r.title, level: r.level, project: r.projectName ?? "", period: r.period, submittedBy: r.submittedByName ?? "", reviewDeadline: r.reviewDeadline, daysRemaining: r.daysRemaining ?? "", evidence: r.evidenceCount, status: r.status }))} />}
      />

      {/* Functional tabs */}
      <div className="glass-bum glass-sheen flex flex-wrap items-center gap-1.5 rounded-2xl p-2">
        {TABS.map((t) => {
          const count = t.value === "queue" ? data?.counts.queue
            : t.value === "pending" ? data?.counts.pending
            : t.value === "returned" ? data?.counts.rejected
            : t.value === "resubmitted" ? data?.counts.resubmitted
            : t.value === "approved" ? data?.counts.approved
            : t.value === "rejected" ? data?.counts.rejected
            : t.value === "overdue" ? data?.counts.overdue : 0;
          const active = tab === t.value;
          return (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-[12.5px] font-medium transition-all ${
                active ? "btn-bum-action" : "text-[color:var(--ink-soft)] hover:bg-white/70"
              }`}
            >
              {t.label}
              {count !== undefined && count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular ${active ? "bg-white/25" : "bg-[rgba(139,92,246,0.12)] text-[color:var(--bum-purple-deep)]"}`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading && !data}
        error={error}
        onRetry={refetch}
        pageSize={10}
        onRowClick={(r) => openReview(r.id)}
        emptyTitle="The review queue is clear"
        emptyMessage="No reports match this tab right now. New submissions from project teams appear here within seconds."
        emptyAction={<Button className="btn-bum-action rounded-2xl" variant="outline" onClick={() => navigate("corrections")}>Check corrections &amp; rejections</Button>}
        toolbar={
          <Toolbar
            search={search}
            onSearch={setSearch}
            searchPlaceholder="Search by ID, title, project or submitter…"
            filters={[
              { key: "project", label: "Project", value: projectFilter, onChange: setProjectFilter, options: [{ value: "ALL", label: "All projects" }, ...projectOptions] },
              { key: "evidence", label: "Evidence", value: evidenceFilter, onChange: setEvidenceFilter, options: [{ value: "ALL", label: "Any" }, { value: "attached", label: "Evidence attached" }, { value: "none", label: "Missing evidence" }] },
            ]}
            onReset={() => { setSearch(""); setProjectFilter("ALL"); setEvidenceFilter("ALL"); }}
            resultCount={rows.length}
            right={<Chip tone="purple">{data?.counts.queue ?? 0} in queue</Chip>}
          />
        }
        rowActions={(r) => (
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" className="h-8 rounded-xl text-xs" onClick={() => openReview(r.id)}>
              Review
            </Button>
            <Button variant="ghost" size="sm" className="h-8 rounded-xl text-xs" onClick={() => openReview(r.id, "evidence")}>
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
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Chip tone="gray">{r.level === "PROJECT" ? r.projectName ?? "Project" : "BU level"}</Chip>
              <UrgencyChip days={r.daysRemaining} />
              <EvidenceChip count={r.evidenceCount} />
            </div>
            <div className="mt-2 flex gap-2">
              <Button size="sm" className="btn-bum-action h-8 flex-1 rounded-xl" onClick={() => openReview(r.id)}>Review</Button>
              <Button size="sm" variant="outline" className="h-8 flex-1 rounded-xl glass-subtle" onClick={() => openReview(r.id, "evidence")}>Evidence</Button>
            </div>
          </div>
        )}
      />

      <div className="flex items-center gap-2 text-[11.5px] text-[color:var(--ink-faint)]">
        <CheckSealIcon className="h-3.5 w-3.5 text-[color:var(--bum-purple-deep)]" />
        Review authority is enforced server-side: only reports inside your assigned business unit and only eligible workflow states can be decided here. Every decision broadcasts a notification to all 5 consoles.
      </div>

      <ReportReviewWorkspace
        submissionId={reviewId}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        startTab={reviewTab}
        onDecided={() => void refetch()}
      />
    </div>
  );
}
