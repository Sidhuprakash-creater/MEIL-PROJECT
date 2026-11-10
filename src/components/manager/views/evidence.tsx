"use client";

// ── SUBSIDIARY MANAGER · SCREEN 06 — Evidence Review ──
import { useMemo, useState } from "react";
import { Download, FileCheck2 } from "lucide-react";
import { Ring } from '@/components/ring'
import { FileCheckIcon } from "@/components/workspace/premium-icons";
import { Button } from "@/components/ui/button";
import { apiGet, fmtNumber, timeAgo, useSmApi } from "@/lib/sm/client";
import type { EvidenceRow, EvidenceSummary } from "@/lib/sm/types";
import {
  Chip, CountUp, DataTable, DetailSheet, EmptyState, ErrorState, GlassCard, InfoRow, LoadingBlock, PageHeader, Toolbar, type Column,
} from "@/components/workspace/ui";
import { ReportReviewDialog } from "@/components/manager/review-detail";

type ListResponse = { docs: EvidenceRow[]; total: number; summary: EvidenceSummary };

export default function EvidenceView() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [docId, setDocId] = useState<string | null>(null);
  const [docOpen, setDocOpen] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  const { data, loading, error, refetch } = useSmApi<ListResponse>("/api/sm/evidence?pageSize=100");

  const rows = useMemo(() => {
    let list = data?.docs ?? [];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((d) => `${d.name} ${d.submissionRef} ${d.disclosureRef} ${d.uploadedBy}`.toLowerCase().includes(q));
    }
    if (typeFilter !== "ALL") list = list.filter((d) => d.fileType === typeFilter);
    if (statusFilter !== "ALL") list = list.filter((d) => d.status === statusFilter);
    return list;
  }, [data, search, typeFilter, statusFilter]);

  /* Detail sheet data: fetch the wrapped { doc } on open. */
  const { data: detail, loading: detailLoading, error: detailError } = useSmApi<{ doc: EvidenceRow & { disclosureRef: string; family: { id: string; name: string; version: number; uploadedAt: string; uploadedBy: string; status: string }[]; parentReportId: string | null } }>(
    docOpen && docId ? `/api/sm/evidence/${docId}` : null,
    { pollMs: 0 }
  );
  const doc = detail?.doc ?? null;

  const download = async (d: { id: string; name: string }) => {
    setDownloading(true);
    setReceipt(null);
    try {
      const r = await apiGet<{ receipt: { name: string; access: string } }>(`/api/sm/evidence/${d.id}/download`);
      setReceipt(`${r.receipt.name} — ${r.receipt.access}`);
    } catch (e) {
      setReceipt(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const columns: Column<EvidenceRow>[] = [
    {
      key: "name", header: "Document", sortable: true, sortValue: (d) => d.name,
      render: (d) => (
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-[color:var(--ink)]">{d.name}</div>
          <div className="truncate text-[11px] text-[color:var(--ink-faint)]">{d.fileType} · {d.sizeKb > 0 ? `${fmtNumber(d.sizeKb)} KB` : "awaited"} · v{d.version}</div>
        </div>
      ),
    },
    {
      key: "org", header: "BU / Project", render: (d) => (
        <div className="min-w-0">
          <div className="truncate text-[12.5px]">{d.projectName ?? d.buName ?? "—"}</div>
          {d.projectName && <div className="truncate text-[10.5px] text-[color:var(--ink-faint)]">project</div>}
        </div>
      ),
    },
    { key: "submissionRef", header: "Parent report", sortable: true, sortValue: (d) => d.submissionRef, render: (d) => d.submissionRef ? <span className="text-[12.5px] font-medium text-[color:var(--esg-blue)]">{d.submissionRef}</span> : <span className="text-[12px] text-[color:var(--ink-faint)]">— repository item</span> },
    { key: "disclosureRef", header: "Disclosure", render: (d) => <span className="text-[12px]">{d.disclosureRef || "—"}</span> },
    { key: "uploadedBy", header: "Uploaded by", render: (d) => <span className="text-[12.5px]">{d.uploadedBy}</span> },
    { key: "uploadedAt", header: "Uploaded", sortable: true, sortValue: (d) => d.uploadedAt, render: (d) => <span className="text-[12px]">{timeAgo(d.uploadedAt)}</span> },
    {
      key: "status", header: "Status", render: (d) => (
        <Chip tone={d.status === "VALID" ? "green" : d.status === "EXPIRED" ? "red" : "amber"}>{d.status}</Chip>
      ),
    },
  ];

  const summary = data?.summary;

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="Evidence Review"
        description="Supporting documents attached to submitted reports — inspect metadata, verify versions and download authorized files. Access is enforced server-side per subsidiary."
        icon={FileCheck2}
      />

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Documents in repository", value: summary?.total ?? 0, hue: "#3a7bff" },
          { label: "Missing / awaited", value: summary?.missing ?? 0, hue: "#c57926" },
          { label: "Expired", value: summary?.expired ?? 0, hue: "#c34a4a" },
          { label: "File types", value: summary?.byType.length ?? 0, hue: "#20a779" },
        ].map((c) => (
          <GlassCard key={c.label} className="p-4">
            <div className="text-[24px] font-bold tabular leading-none text-[color:var(--ink)]"><CountUp value={c.value} /></div>
            <div className="mt-1.5 text-[11.5px] font-medium" style={{ color: c.hue }}>{c.label}</div>
          </GlassCard>
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading && !data}
        error={error}
        onRetry={refetch}
        pageSize={8}
        onRowClick={(d) => {
          setDocId(d.id);
          setReceipt(null);
          setDocOpen(true);
        }}
        emptyTitle="No evidence documents"
        emptyMessage="Documents attached by BU and project users appear here."
        toolbar={
          <Toolbar
            search={search}
            onSearch={setSearch}
            searchPlaceholder="Search by filename, report ref, disclosure…"
            filters={[
              { key: "type", label: "Type", value: typeFilter, onChange: setTypeFilter, options: [{ value: "ALL", label: "All types" }, ...(summary?.byType ?? []).map((t) => ({ value: t.type, label: `${t.type} (${t.count})` }))] },
              { key: "status", label: "Status", value: statusFilter, onChange: setStatusFilter, options: [{ value: "ALL", label: "All statuses" }, { value: "VALID", label: "Valid" }, { value: "EXPIRED", label: "Expired" }, { value: "MISSING", label: "Missing" }] },
            ]}
            onReset={() => {
              setSearch("");
              setTypeFilter("ALL");
              setStatusFilter("ALL");
            }}
            resultCount={rows.length}
          />
        }
        mobileCard={(d) => (
          <div className="glass-subtle rounded-2xl p-3">
            <div className="truncate text-[13px] font-semibold text-[color:var(--ink)]">{d.name}</div>
            <div className="mt-0.5 text-[11px] text-[color:var(--ink-faint)]">{d.fileType} · {d.submissionRef || "repository"} · {d.status}</div>
            <Button size="sm" variant="outline" className="mt-2 h-8 w-full rounded-xl glass-subtle" onClick={() => { setDocId(d.id); setDocOpen(true); }}>
              Inspect
            </Button>
          </div>
        )}
      />

      {/* Document detail sheet */}
      <DetailSheet
        open={docOpen}
        onOpenChange={setDocOpen}
        title={doc?.name ?? "Evidence document"}
        subtitle={doc ? `${doc.fileType} · version ${doc.version}${doc.submissionRef ? ` · attached to ${doc.submissionRef}` : " · repository item"}` : undefined}
        footer={
          doc && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Button className="rounded-2xl bg-[#20a779] text-white hover:bg-[#168b65]" onClick={() => void download(doc)} disabled={downloading}>
                  {downloading ? <Ring className="mr-1.5 h-4 w-4" /> : <Download className="mr-1.5 h-4 w-4" />}
                  Secure download
                </Button>
                {doc.parentReportId && (
                  <Button variant="outline" className="glass-subtle rounded-2xl" onClick={() => { setReviewId(doc.parentReportId); setDocOpen(false); setReviewOpen(true); }}>
                    Open parent report
                  </Button>
                )}
              </div>
              {receipt && <p className="rounded-xl bg-[rgba(32,167,121,0.08)] px-3 py-2 text-[11.5px] text-[#1d6b44]" role="status">{receipt}</p>}
            </div>
          )
        }
      >
        {detailLoading && <LoadingBlock rows={4} label="Loading document…" />}
        {detailError && <ErrorState message={detailError} onRetry={() => setDocOpen(false)} />}
        {doc && !detailLoading && (
          <div className="space-y-4">
            <div className="glass-subtle rounded-2xl p-3.5">
              <InfoRow label="Status"><Chip tone={doc.status === "VALID" ? "green" : doc.status === "EXPIRED" ? "red" : "amber"}>{doc.status}</Chip></InfoRow>
              <InfoRow label="File type">{doc.fileType}</InfoRow>
              <InfoRow label="Size">{doc.sizeKb > 0 ? `${fmtNumber(doc.sizeKb)} KB` : "Awaited (metadata only)"}</InfoRow>
              <InfoRow label="Uploaded by">{doc.uploadedBy}</InfoRow>
              <InfoRow label="Uploaded">{timeAgo(doc.uploadedAt)}</InfoRow>
              <InfoRow label="Related report">{doc.submissionRef || "—"}</InfoRow>
              <InfoRow label="Disclosure reference">{doc.disclosureRef || "—"}</InfoRow>
              <InfoRow label="Business unit">{doc.buName ?? "—"}</InfoRow>
              <InfoRow label="Project / site">{doc.projectName ?? "—"}</InfoRow>
            </div>

            <div>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">Version history</div>
              {doc.family.length <= 1 ? (
                <EmptyState title="Single version" message="This document has no superseded versions." icon={FileCheckIcon} />
              ) : (
                <div className="space-y-1.5">
                  {doc.family.map((f) => (
                    <div key={f.id} className="glass-subtle flex items-center justify-between rounded-xl px-3 py-2">
                      <span className="min-w-0 truncate text-[12.5px] font-medium text-[color:var(--ink)]">v{f.version} — {f.name}</span>
                      <span className="ml-2 shrink-0 text-[10.5px] text-[color:var(--ink-faint)]">{timeAgo(f.uploadedAt)} · {f.uploadedBy}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="rounded-2xl bg-[rgba(58,123,255,0.06)] p-3 text-[11.5px] leading-relaxed text-[color:var(--ink-soft)]">
              Evidence lives in private storage and never leaves the subsidiary scope — the download endpoint re-verifies your session and subsidiary on every request.
            </p>
          </div>
        )}
      </DetailSheet>

      <ReportReviewDialog
        submissionId={reviewId}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
      />
    </div>
  );
}
