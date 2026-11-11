"use client";

// ── SUBSIDIARY MANAGER · SCREEN 03 — Review Queue (primary workspace) ──
import { useMemo, useState } from "react";
import { CheckSealIcon } from "@/components/workspace/premium-icons";
import { Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSmWorkspace } from "@/lib/sm/store";
import { fmtDate, useSmApi } from "@/lib/sm/client";
import type { SubmissionsResponse, SmSubmissionRow } from "@/lib/sm/types";
import {
  Chip, DataTable, ExportButton, PageHeader, Toolbar, type Column,
} from "@/components/workspace/ui";
import { EvidenceChip, StatusChip, UrgencyChip } from "@/components/manager/shared";
import { ReportReviewDialog } from "@/components/manager/review-detail";
import { SmRollupCard } from "@/components/manager/sm-rollup-card";

export default function QueueView() {
  const { params, navigate, reportingYear } = useSmWorkspace();
  const urgency = typeof params.statusFilter === "string" ? params.statusFilter : "all";

  const [search, setSearch] = useState("");
  const [buFilter, setBuFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [evidenceFilter, setEvidenceFilter] = useState("ALL");
  const [urgencyFilter, setUrgencyFilter] = useState(urgency);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewTab, setReviewTab] = useState<string | undefined>(undefined);

  const { data, loading, error, refetch } = useSmApi<SubmissionsResponse>(
    `/api/sm/submissions?tab=queue&period=${encodeURIComponent(reportingYear)}`,
    { deps: [reportingYear] }
  );

  const rows = useMemo(() => {
    let list = data?.submissions ?? [];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((s) => `${s.ref} ${s.title} ${s.buName ?? ""} ${s.projectName ?? ""} ${s.submittedByName ?? ""}`.toLowerCase().includes(q));
    }
    if (buFilter !== "ALL") list = list.filter((s) => s.buId === buFilter);
    if (categoryFilter !== "ALL") list = list.filter((s) => s.category === categoryFilter);
    if (evidenceFilter === "none") list = list.filter((s) => s.evidenceCount === 0);
    if (evidenceFilter === "attached") list = list.filter((s) => s.evidenceCount > 0);
    if (urgencyFilter === "overdue") list = list.filter((s) => (s.daysRemaining ?? 0) < 0);
    if (urgencyFilter === "due-soon") list = list.filter((s) => (s.daysRemaining ?? 99) >= 0 && (s.daysRemaining ?? 99) <= 7);
    return list;
  }, [data, search, buFilter, categoryFilter, evidenceFilter, urgencyFilter]);

  const buOptions = useMemo(() => {
    const map = new Map<string, string>();
    (data?.submissions ?? []).forEach((s) => s.buId && s.buName && map.set(s.buId, s.buName));
    return [...map.entries()].map(([value, label]) => ({ value, label }));
  }, [data]);

  const openReview = (id: string, tab?: string) => {
    setReviewId(id);
    setReviewTab(tab);
    setReviewOpen(true);
  };

  const columns: Column<SmSubmissionRow>[] = [
    {
      key: "ref", header: "Report", sortable: true, sortValue: (r) => r.ref,
      render: (r) => (
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-[color:var(--ink)]">{r.ref}</div>
          <div className="truncate text-[11.5px] text-[color:var(--ink-faint)]">{r.title}</div>
        </div>
      ),
    },
    { key: "category", header: "Category", render: (r) => <Chip tone="blue">{r.category}</Chip> },
    {
      key: "org", header: "BU / Project", render: (r) => (
        <div className="min-w-0">
          <div className="truncate text-[12.5px] font-medium text-[color:var(--ink-soft)]">{r.level === "PROJECT" ? r.projectName ?? "—" : r.buName ?? "—"}</div>
          <div className="truncate text-[10.5px] text-[color:var(--ink-faint)]">{r.level === "PROJECT" ? `under ${r.buName ?? "—"}` : "BU level"}</div>
        </div>
      ),
    },
    { key: "period", header: "Period", sortable: true, sortValue: (r) => r.period, render: (r) => <span className="text-[12px]">{r.period} · {r.fiscalQuarter}</span> },
    { key: "user", header: "Responsible user", render: (r) => <span className="text-[12.5px]">{r.submittedByName ?? "—"}</span> },
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
    { key: "status", header: "Status", render: (r) => <StatusChip status={r.status} /> },
  ];

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="Review Queue"
        description="Reports currently awaiting your decision — prioritised with overdue reviews first, then validation warnings, then closest deadline. Nothing is decided automatically."
        icon={Landmark}
        actions={<ExportButton filename="review-queue" rows={rows.map((r) => ({ ref: r.ref, title: r.title, level: r.level, bu: r.buName ?? "", project: r.projectName ?? "", period: r.period, submittedBy: r.submittedByName ?? "", reviewDeadline: r.reviewDeadline, daysRemaining: r.daysRemaining ?? "", evidence: r.evidenceCount, status: r.status }))} />}
      />

      {/* Consolidated rollup: BU → category → project with evidence downloads */}
      <SmRollupCard period={reportingYear} />

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading && !data}
        error={error}
        onRetry={refetch}
        pageSize={8}
        onRowClick={(r) => openReview(r.id)}
        emptyTitle="The review queue is clear"
        emptyMessage="No reports are awaiting your decision right now. New submissions from BU and project teams appear here within seconds."
        emptyAction={<Button className="rounded-2xl" variant="outline" onClick={() => navigate("corrections")}>Check corrections &amp; rejections</Button>}
        toolbar={
          <Toolbar
            search={search}
            onSearch={setSearch}
            searchPlaceholder="Search by ID, title, BU, project or submitter…"
            filters={[
              { key: "bu", label: "BU", value: buFilter, onChange: setBuFilter, options: [{ value: "ALL", label: "All BUs" }, ...buOptions] },
              {
                key: "category", label: "Category", value: categoryFilter, onChange: setCategoryFilter,
                options: [{ value: "ALL", label: "All categories" }, ...["ENERGY", "EMISSIONS", "WATER", "WASTE", "SAFETY", "WORKFORCE", "ENVIRONMENT", "PROCUREMENT", "CSR", "COMPLIANCE"].map((c) => ({ value: c, label: c }))],
              },
              { key: "evidence", label: "Evidence", value: evidenceFilter, onChange: setEvidenceFilter, options: [{ value: "ALL", label: "Any" }, { value: "attached", label: "Evidence attached" }, { value: "none", label: "Missing evidence" }] },
              { key: "urgency", label: "Urgency", value: urgencyFilter, onChange: setUrgencyFilter, options: [{ value: "all", label: "All" }, { value: "overdue", label: "Overdue" }, { value: "due-soon", label: "Due within 7 days" }] },
            ]}
            onReset={() => {
              setSearch("");
              setBuFilter("ALL");
              setCategoryFilter("ALL");
              setEvidenceFilter("ALL");
              setUrgencyFilter("all");
            }}
            resultCount={rows.length}
            right={<Chip tone="blue">{data?.counts.queue ?? 0} awaiting review</Chip>}
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
              <Chip tone="gray">{r.level === "PROJECT" ? r.projectName ?? "Project" : r.buName ?? "BU"}</Chip>
              <UrgencyChip days={r.daysRemaining} />
              <EvidenceChip count={r.evidenceCount} />
            </div>
            <div className="mt-2 flex gap-2">
              <Button size="sm" className="h-8 flex-1 rounded-xl bg-[#20a779] text-white hover:bg-[#168b65]" onClick={() => openReview(r.id)}>Review</Button>
              <Button size="sm" variant="outline" className="h-8 flex-1 rounded-xl glass-subtle" onClick={() => openReview(r.id, "evidence")}>Evidence</Button>
            </div>
          </div>
        )}
      />

      <div className="flex items-center gap-2 text-[11.5px] text-[color:var(--ink-faint)]">
        <CheckSealIcon className="h-3.5 w-3.5 text-[color:var(--esg-blue)]" />
        Review authority is enforced server-side: only reports inside {`your assigned subsidiary`} and only eligible workflow states can be decided here.
      </div>

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
