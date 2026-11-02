"use client";

// ── SUBSIDIARY MANAGER · SCREEN 07 — Corrections & Rejections ──
import { useMemo, useState } from "react";
import { Undo2 } from "lucide-react";
import { WorkflowIcon } from "@/components/workspace/premium-icons";
import { Button } from "@/components/ui/button";
import { useSmWorkspace } from "@/lib/sm/store";
import { fmtDate, useSmApi } from "@/lib/sm/client";
import type { CorrectionsResponse, CorrectionRow } from "@/lib/sm/types";
import {
  Chip, DataTable, EmptyState, ErrorState, GlassCard, GlassTabBar, InfoRow, LoadingBlock, PageHeader, type Column,
} from "@/components/workspace/ui";
import { StatusChip } from "@/components/manager/shared";
import { ReportReviewDialog } from "@/components/manager/review-detail";

export default function CorrectionsView() {
  const { params } = useSmWorkspace();
  const initialTab = params.tab === "resubmitted" ? "resubmitted" : "rejected";
  const [tab, setTab] = useState(initialTab);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  const { data, loading, error, refetch } = useSmApi<CorrectionsResponse>("/api/sm/corrections");

  const rows: CorrectionRow[] = tab === "resubmitted" ? data?.resubmissions ?? [] : data?.corrections ?? [];

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
      key: "org", header: "BU / Project", render: (r) => (
        <span className="text-[12.5px]">{r.level === "PROJECT" ? r.projectName ?? "—" : r.buName ?? "—"}</span>
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
        description="Rejected reports awaiting correction and corrected resubmissions awaiting your fresh review. Rejected versions and their evidence are preserved — nothing is overwritten."
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
        <GlassCard className="p-4">
          <div className="text-[22px] font-bold tabular text-[color:var(--ink)]">{data?.counts.rejected ?? 0}</div>
          <div className="mt-0.5 text-[11.5px] font-medium text-[#c57926]">Rejected reports</div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="text-[22px] font-bold tabular text-[color:var(--ink)]">{data?.counts.awaitingCorrection ?? 0}</div>
          <div className="mt-0.5 text-[11.5px] font-medium text-[#c57926]">Awaiting correction</div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="text-[22px] font-bold tabular text-[color:var(--ink)]">{data?.counts.resubmitted ?? 0}</div>
          <div className="mt-0.5 text-[11.5px] font-medium text-[#7c5cff]">Resubmissions in queue</div>
        </GlassCard>
      </div>

      {loading && !data && <LoadingBlock rows={5} label="Loading corrections…" />}
      {error && !data && <ErrorState message={error} onRetry={refetch} />}

      {data && tab === "rejected" && (
        <DataTable
          columns={columns}
          rows={rows}
          pageSize={8}
          onRowClick={(r) => openReview(r.id)}
          emptyTitle="No rejected reports"
          emptyMessage="Reports you reject with a mandatory reason appear here so you can track corrections."
          rowActions={(r) => (
            <Button variant="ghost" size="sm" className="h-8 rounded-xl text-xs" onClick={() => openReview(r.id)}>
              Open report
            </Button>
          )}
          mobileCard={(r) => (
            <div className="glass-subtle rounded-2xl p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[13px] font-semibold">{r.ref}</span>
                <StatusChip status={r.status} />
              </div>
              <div className="mt-1 truncate text-[12px]">{r.title}</div>
              <p className="mt-1.5 line-clamp-2 text-[11.5px] text-[color:var(--ink-soft)]">{r.reason || "See history"}</p>
              <Button size="sm" variant="outline" className="mt-2 h-8 w-full rounded-xl glass-subtle" onClick={() => openReview(r.id)}>Open report</Button>
            </div>
          )}
        />
      )}

      {data && tab === "resubmitted" && (
        <DataTable
          columns={columns}
          rows={rows}
          pageSize={8}
          onRowClick={(r) => openReview(r.id)}
          emptyTitle="No resubmissions awaiting review"
          emptyMessage="When a corrected version comes back after rejection it re-enters your queue and is tracked here."
          rowActions={(r) => (
            <Button size="sm" className="h-8 rounded-xl bg-[#20a779] text-white hover:bg-[#168b65]" onClick={() => openReview(r.id)}>
              Review resubmission
            </Button>
          )}
          mobileCard={(r) => (
            <div className="glass-subtle rounded-2xl p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[13px] font-semibold">{r.ref}</span>
                <StatusChip status={r.status} />
              </div>
              <div className="mt-1 truncate text-[12px]">{r.title}</div>
              <Button size="sm" className="mt-2 h-8 w-full rounded-xl bg-[#20a779] text-white hover:bg-[#168b65]" onClick={() => openReview(r.id)}>Review resubmission</Button>
            </div>
          )}
        />
      )}

      {/* Rejection detail card list — full reasons visible */}
      {data && tab === "rejected" && rows.length > 0 && (
        <div className="space-y-2.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">Full rejection details</div>
          {rows.map((r) => (
            <GlassCard key={`detail-${r.id}`} className="p-4">
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
        <GlassCard className="p-6">
          <EmptyState
            title={tab === "resubmitted" ? "No resubmissions right now" : "Nothing awaiting correction"}
            message={tab === "resubmitted" ? "Corrected versions re-enter the review workflow and appear here automatically." : "Rejections you record will be tracked here until the corrected version returns."}
            icon={WorkflowIcon}
          />
        </GlassCard>
      )}

      <ReportReviewDialog
        submissionId={reviewId}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        onDecided={() => void refetch()}
      />
    </div>
  );
}
