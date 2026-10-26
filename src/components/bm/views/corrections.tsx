"use client";

// ── BU MANAGER · SCREEN 07 — Corrections & Rejections ──
import { useMemo, useState } from "react";
import { Undo2 } from "lucide-react";
import { WorkflowIcon } from "@/components/workspace/premium-icons";
import { Button } from "@/components/ui/button";
import { useBmWorkspace } from "@/lib/bm/store";
import { fmtDate, useBmApi } from "@/lib/bm/client";
import type { CorrectionsResponse, CorrectionRow } from "@/lib/bm/types";
import {
  Chip, DataTable, EmptyState, ErrorState, GlassCard, GlassTabBar, InfoRow, LoadingBlock, PageHeader, type Column,
} from "@/components/workspace/ui";
import { StatusChip } from "@/components/bm/shared";
import { ReportReviewWorkspace } from "@/components/bm/review-detail";

export default function CorrectionsView() {
  const { params } = useBmWorkspace();
  const initialTab = params.tab === "resubmitted" ? "resubmitted" : "rejected";
  const [tab, setTab] = useState(initialTab);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data, loading, error, refetch } = useBmApi<CorrectionsResponse>("/api/bm/corrections");

  const rows: CorrectionRow[] = useMemo(() => {
    let list = tab === "resubmitted" ? data?.resubmissions ?? [] : data?.corrections ?? [];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((r) => `${r.ref} ${r.title} ${r.responsibleName ?? ""} ${r.reason}`.toLowerCase().includes(q));
    }
    return list;
  }, [data, tab, search]);

  const openReview = (id: string) => {
    setReviewId(id);
    setReviewOpen(true);
  };

  const columns: Column<CorrectionRow>[] = [
    {
      key: "ref", header: "Report", sortable: true, sortValue: (r) => r.ref,
      render: (r) => (
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-[color:var(--ink)]">{r.ref}</div>
          <div className="truncate text-[11.5px] text-[color:var(--ink-faint)]">{r.title}</div>
        </div>
      ),
    },
    {
      key: "project", header: "Project / level", render: (r) => (
        <span className="text-[12.5px]">{r.level === "PROJECT" ? r.projectName ?? "—" : "BU level"}</span>
      ),
    },
    { key: "responsible", header: "Responsible user", render: (r) => <span className="text-[12.5px]">{r.responsibleName ?? "—"}</span> },
    {
      key: "rejectedAt", header: "Rejected", sortable: true, sortValue: (r) => r.rejectedAt ?? "",
      render: (r) => (
        <div className="min-w-0">
          <div className="text-[12px]">{fmtDate(r.rejectedAt)}</div>
          <div className="truncate text-[10.5px] text-[color:var(--ink-faint)]">by {r.reviewerName ?? "—"}</div>
        </div>
      ),
    },
    {
      key: "reason", header: "Rejection reason", className: "max-w-[280px]",
      render: (r) => r.reason ? (
        <p className="line-clamp-2 whitespace-pre-wrap text-[12px] leading-relaxed text-[color:var(--ink-soft)]">{r.reason}</p>
      ) : (
        <span className="text-[12px] text-[color:var(--ink-faint)]">Recorded in history</span>
      ),
    },
    {
      key: "correctionDue", header: "Correction window", sortable: true, sortValue: (r) => r.correctionDueDate ?? "",
      render: (r) => {
        const days = r.correctionDueDate ? Math.ceil((new Date(r.correctionDueDate).getTime() - Date.now()) / 86400000) : null;
        return (
          <div className="flex flex-col items-start gap-1">
            <span className="text-[12px]">{fmtDate(r.correctionDueDate)}</span>
            {r.isResubmission ? <Chip tone="green">Resubmitted</Chip> : days !== null && days < 0 ? <Chip tone="red">Window closed</Chip> : <Chip tone="amber">{days ?? "—"}d left</Chip>}
          </div>
        );
      },
    },
    { key: "status", header: "State", render: (r) => <StatusChip status={r.status} /> },
  ];

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="Corrections & Rejections"
        description="Reports returned for correction, corrected resubmissions awaiting review, rejection history and missing-data issues. Rejected versions and their evidence are preserved — nothing is overwritten."
        icon={Undo2}
      />

      <GlassTabBar
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "rejected", label: "Rejected & correcting", count: data?.counts.rejected ?? 0 },
          { value: "resubmitted", label: "Resubmissions awaiting review", count: data?.counts.resubmitted ?? 0 },
        ]}
      />

      {/* summary strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <GlassCard className="glass-bum p-4">
          <div className="text-[22px] font-bold tabular text-[color:var(--ink)]">{data?.counts.rejected ?? 0}</div>
          <div className="mt-0.5 text-[11.5px] font-medium text-[#c57926]">Rejected / returned</div>
        </GlassCard>
        <GlassCard className="glass-bum p-4">
          <div className="text-[22px] font-bold tabular text-[color:var(--ink)]">{data?.counts.awaitingCorrection ?? 0}</div>
          <div className="mt-0.5 text-[11.5px] font-medium text-[#c57926]">Awaiting correction</div>
        </GlassCard>
        <GlassCard className="glass-bum p-4">
          <div className="text-[22px] font-bold tabular text-[color:var(--ink)]">{data?.counts.resubmitted ?? 0}</div>
          <div className="mt-0.5 text-[11.5px] font-medium text-[color:var(--bum-purple-deep)]">Resubmissions in queue</div>
        </GlassCard>
      </div>

      {loading && !data && <LoadingBlock rows={5} label="Loading corrections…" />}
      {error && !data && <ErrorState message={error} onRetry={refetch} />}

      <DataTable
        columns={columns}
        rows={rows}
        pageSize={8}
        onRowClick={(r) => openReview(r.id)}
        emptyTitle={tab === "resubmitted" ? "No resubmissions awaiting review" : "Nothing awaiting correction"}
        emptyMessage={tab === "resubmitted" ? "Corrected versions re-enter the review workflow and appear here automatically." : "Reports you reject or return will be tracked here until the corrected version returns."}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search corrections…"
              className="glass-subtle h-9 min-w-[200px] flex-1 rounded-xl border border-white/60 px-3 text-[13px] text-[color:var(--ink)] placeholder:text-[color:var(--ink-faint)] focus:outline-none focus:ring-2 focus:ring-[rgba(139,92,246,0.4)]"
            />
            <Chip tone="purple">{rows.length} results</Chip>
          </div>
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
            <p className="mt-1.5 line-clamp-2 text-[11.5px] text-[color:var(--ink-soft)]">{r.reason || "See history"}</p>
            <Button size="sm" variant="outline" className="mt-2 h-8 w-full rounded-xl glass-subtle" onClick={() => openReview(r.id)}>Open report</Button>
          </div>
        )}
      />

      {/* Full rejection detail cards — all reviewer comments preserved */}
      {data && tab === "rejected" && rows.length > 0 && (
        <div className="space-y-2.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">Full rejection details</div>
          {rows.map((r) => (
            <GlassCard key={`detail-${r.id}`} className="glass-bum p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold text-[color:var(--ink)]">{r.ref}</span>
                  <span className="text-[12.5px] text-[color:var(--ink-soft)]">{r.title}</span>
                </div>
                <StatusChip status={r.status} />
              </div>
              <div className="mt-2 grid gap-x-6 sm:grid-cols-2">
                <InfoRow label="Rejection date">{fmtDate(r.rejectedAt)}</InfoRow>
                <InfoRow label="Reviewer">{r.reviewerName ?? "—"}</InfoRow>
                <InfoRow label="Responsible user">{r.responsibleName ?? "—"}</InfoRow>
                <InfoRow label="Previous version">v-preserved · evidence kept</InfoRow>
                <InfoRow label="Requested corrections">{r.instructions || "See reason"}</InfoRow>
                <InfoRow label="Latest submission">{r.resubmittedAt ? fmtDate(r.resubmittedAt) : "Not yet resubmitted"}</InfoRow>
              </div>
              {r.reason && (
                <p className="mt-2 whitespace-pre-wrap rounded-2xl bg-[rgba(195,74,74,0.05)] p-3 text-[12.5px] leading-relaxed text-[color:var(--ink-soft)]">{r.reason}</p>
              )}
            </GlassCard>
          ))}
        </div>
      )}

      {data && rows.length === 0 && (
        <GlassCard className="glass-bum p-6">
          <EmptyState
            title={tab === "resubmitted" ? "No resubmissions right now" : "Nothing awaiting correction"}
            message={tab === "resubmitted" ? "Corrected versions re-enter the review workflow and appear here automatically." : "Reports you reject or return will be tracked here until the corrected version returns."}
            icon={WorkflowIcon}
          />
        </GlassCard>
      )}

      <ReportReviewWorkspace
        submissionId={reviewId}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        onDecided={() => void refetch()}
      />
    </div>
  );
}
