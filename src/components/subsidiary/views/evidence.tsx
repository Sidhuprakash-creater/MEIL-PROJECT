"use client";

// ── SUBSIDIARY ADMIN · Evidence & Documents ──
// Central evidence repository: summary strip, type/status/BU filters, metadata
// detail with honest sandbox preview note, and metadata-receipt downloads.
import { useEffect, useState } from "react";
import {
  ArrowRight, CheckCircle2, Download, Eye, FileText,
  Image as ImageIcon,
} from "lucide-react";
import { Ring } from '@/components/ring'
import { AlarmAlertIcon, CheckSealIcon, FilesIcon } from "@/components/workspace/premium-icons";
import {
  Chip, CountUp, DataTable, EmptyState, ErrorState, ExportButton, GlassDialog,
  InfoRow, LoadingBlock, PageHeader, Toolbar, type Column,
} from "@/components/workspace/ui";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useSaWorkspace } from "@/lib/sa/store";
import { downloadFile, fmtDate, fmtDateTime, useSaApi } from "@/lib/sa/client";
import type { EvidenceRow, EvidenceSummary, UnitRow } from "@/lib/sa/types";
import { cn } from "@/lib/utils";

/* ── local types ── */
type EvidenceResponse = { docs: EvidenceRow[]; total: number; summary: EvidenceSummary; page: number; pageSize: number };
type EvidenceDetail = EvidenceRow & { previewAvailable: boolean; contentHash: string };
type EvidenceDetailResponse = { doc: EvidenceDetail };
type UnitsResponse = { units: UnitRow[]; total: number };

const STATUSES = ["VALID", "MISSING", "EXPIRED"] as const;
const TYPES = ["PDF", "XLSX", "CSV", "IMAGE", "DOCX"] as const;
const TYPE_LABELS: Record<string, string> = { PDF: "PDF", XLSX: "XLSX", CSV: "CSV", IMAGE: "Image", DOCX: "DOCX" };
const TYPE_TONE: Record<string, "blue" | "teal" | "purple" | "amber" | "green"> = {
  PDF: "blue", XLSX: "green", CSV: "teal", IMAGE: "purple", DOCX: "amber",
};
const STATUS_META: Record<string, { tone: "green" | "red" | "amber" | "gray"; label: string }> = {
  VALID: { tone: "green", label: "Valid" },
  MISSING: { tone: "red", label: "Missing" },
  EXPIRED: { tone: "amber", label: "Expired" },
};

function StatusBadgeLite({ status }: { status: string }) {
  const conf = STATUS_META[status] ?? { tone: "gray" as const, label: status.replaceAll("_", " ") };
  return (
    <Chip tone={conf.tone}>
      <span
        className={cn("h-1.5 w-1.5 rounded-full", conf.tone === "green" ? "bg-[#238653]" : conf.tone === "red" ? "bg-[#c34a4a]" : conf.tone === "amber" ? "bg-[#c57926]" : "bg-[#8595ab]")}
        aria-hidden="true"
      />
      {conf.label}
    </Chip>
  );
}

const fmtSize = (sizeKb: number) => (sizeKb >= 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`);

/* KPI card — same pattern as the Command Center StatusCard. */
function StatusCard({
  icon: Icon, hue, label, hint, value, onClick, active,
}: {
  icon: React.ComponentType<{ className?: string; hue?: string }>;
  hue: string; label: string; hint: string; value: number; onClick: () => void; active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={`${label}: ${value}`}
      aria-pressed={!!active}
      className={cn(
        "glass glass-sheen group relative flex flex-col gap-3 overflow-hidden rounded-[24px] p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/85 hover:shadow-[0_14px_34px_rgba(56,113,153,0.14)]",
        active && "ring-2 ring-[rgba(58,123,255,0.45)]"
      )}
    >
      <span className="absolute inset-x-0 top-0 h-[3px] opacity-80" style={{ background: `linear-gradient(90deg, ${hue}, ${hue}22)` }} />
      <div className="flex items-center justify-between">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-2xl text-white shadow-md"
          style={{ background: `linear-gradient(135deg, ${hue}, color-mix(in srgb, ${hue} 62%, #17263d))`, boxShadow: `0 6px 16px color-mix(in srgb, ${hue} 38%, transparent), inset 0 1px 0 rgba(255,255,255,0.4)` }}
        >
          <Icon className="h-[18px] w-[18px] text-white" />
        </span>
        <span className="text-[26px] font-bold tabular leading-none text-[color:var(--ink)]">
          <CountUp value={value} />
        </span>
      </div>
      <div className="min-w-0">
        <div className="truncate text-[13px] font-semibold" style={{ color: hue }}>{label}</div>
        <div className="truncate text-[11px] text-[color:var(--ink-faint)]">{hint}</div>
      </div>
    </button>
  );
}

export default function EvidenceView() {
  const { navigate } = useSaWorkspace();
  const { toast } = useToast();

  /* ── view state ── */
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [buId, setBuId] = useState("ALL");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  /* ── deep-link params (q from Report Monitoring, optional status/type) ── */
  useEffect(() => {
    const p = useSaWorkspace.getState().params;
    if (typeof p.q === "string" && p.q.trim()) { setSearch(p.q); setQ(p.q.trim()); }
    if (typeof p.status === "string" && (STATUSES as readonly string[]).includes(p.status)) setStatusFilter(p.status);
    if (typeof p.type === "string" && (TYPES as readonly string[]).includes(p.type)) setTypeFilter(p.type);
  }, []);

  /* ── debounced search → server q ── */
  useEffect(() => {
    const t = window.setTimeout(() => setQ(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  /* ── data ── */
  const listPath =
    `/api/sa/evidence?pageSize=50` +
    `${q ? `&q=${encodeURIComponent(q)}` : ""}` +
    `${typeFilter !== "ALL" ? `&type=${encodeURIComponent(typeFilter)}` : ""}` +
    `${statusFilter !== "ALL" ? `&status=${encodeURIComponent(statusFilter)}` : ""}` +
    `${buId !== "ALL" ? `&buId=${encodeURIComponent(buId)}` : ""}`;
  const { data, loading, error, refetch } = useSaApi<EvidenceResponse>(listPath);
  const { data: unitsData } = useSaApi<UnitsResponse>("/api/sa/units?pageSize=50", { pollMs: 0 });
  const {
    data: detail, loading: detailLoading, error: detailError, refetch: detailRefetch,
  } = useSaApi<EvidenceDetailResponse>(detailId ? `/api/sa/evidence/${detailId}` : null, { pollMs: 0 });
  const detailData = detail?.doc ?? null;

  /* ── surface server errors via toast ── */
  useEffect(() => {
    if (error) toast({ title: "Could not load evidence repository", description: error, variant: "destructive" });
  }, [error, toast]);
  useEffect(() => {
    if (detailError) toast({ title: "Could not load document detail", description: detailError, variant: "destructive" });
  }, [detailError, toast]);

  const summary = data?.summary;
  const validCount = summary ? Math.max(0, summary.total - summary.missing - summary.expired) : 0;
  const rows = data?.docs ?? [];

  /* ── handlers ── */
  const download = async (doc: EvidenceRow) => {
    setDownloadingId(doc.id);
    try {
      const res = await fetch(`/api/sa/evidence/${doc.id}/download`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const text = await res.text();
      const m = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "");
      downloadFile(m?.[1] ?? `${doc.name.replace(/\.[^.]+$/, "")}-receipt.txt`, text, "text/plain");
      toast({ title: "Metadata receipt downloaded — file storage is demo-sandboxed", description: `Receipt for “${doc.name}” saved to your downloads.` });
    } catch (e) {
      toast({ title: "Download failed", description: e instanceof Error ? e.message : "Could not download the receipt.", variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  };

  const buOptions = [
    { value: "ALL", label: "All business units" },
    ...(unitsData?.units ?? []).map((u) => ({ value: u.id, label: u.name })),
  ];

  const exportRows = rows.map((d) => ({
    name: d.name, fileType: d.fileType, version: `v${d.version}`, sizeKb: d.sizeKb,
    businessUnit: d.buName ?? "", project: d.projectName ?? "",
    submissionRef: d.submissionRef, disclosureRef: d.disclosureRef,
    uploadedBy: d.uploadedBy, uploadedAt: fmtDate(d.uploadedAt), status: d.status,
  }));

  /* ── table columns ── */
  const columns: Column<EvidenceRow>[] = [
    {
      key: "document", header: "Document", sortable: true, sortValue: (d) => d.name,
      render: (d) => (
        <div className="min-w-[190px]">
          <div className="truncate text-[13px] font-semibold text-[color:var(--ink)]" title={d.name}>{d.name}</div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <Chip tone={TYPE_TONE[d.fileType] ?? "gray"}>{TYPE_LABELS[d.fileType] ?? d.fileType}</Chip>
            <span className="text-[10.5px] text-[color:var(--ink-faint)]">v{d.version}</span>
          </div>
        </div>
      ),
    },
    {
      key: "org", header: "Organization", sortable: true, sortValue: (d) => d.buName ?? "",
      render: (d) => (
        <span className="whitespace-nowrap text-[12.5px]">
          {d.buName ?? "—"}{d.projectName ? <span className="text-[color:var(--ink-faint)]"> · {d.projectName}</span> : null}
        </span>
      ),
    },
    {
      key: "submission", header: "Linked submission",
      render: (d) =>
        d.submissionRef ? (
          <button
            onClick={(e) => { e.stopPropagation(); navigate("submissions", { ref: d.submissionRef }); }}
            className="font-mono text-[11.5px] text-[color:var(--esg-blue)] underline-offset-2 hover:underline"
            title="Open this submission in the Submission Center"
          >
            {d.submissionRef}
          </button>
        ) : (
          <span className="text-[color:var(--ink-faint)]">—</span>
        ),
    },
    { key: "disclosure", header: "Disclosure", render: (d) => <span className="whitespace-nowrap font-mono text-[11.5px] text-[color:var(--ink-soft)]">{d.disclosureRef || "—"}</span> },
    { key: "uploadedBy", header: "Uploaded by", sortable: true, sortValue: (d) => d.uploadedBy, render: (d) => <span className="whitespace-nowrap text-[12.5px]">{d.uploadedBy || "—"}</span> },
    { key: "uploadedAt", header: "Uploaded at", sortable: true, sortValue: (d) => d.uploadedAt, render: (d) => <span className="whitespace-nowrap text-[12.5px]">{fmtDate(d.uploadedAt)}</span> },
    { key: "size", header: "Size", sortable: true, sortValue: (d) => d.sizeKb, render: (d) => <span className="tabular whitespace-nowrap text-[12.5px]">{fmtSize(d.sizeKb)}</span> },
    { key: "status", header: "Status", render: (d) => <StatusBadgeLite status={d.status} /> },
  ];

  const mobileCard = (d: EvidenceRow) => (
    <div className="glass glass-sheen rounded-2xl p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-[color:var(--ink)]" title={d.name}>{d.name}</div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <Chip tone={TYPE_TONE[d.fileType] ?? "gray"}>{TYPE_LABELS[d.fileType] ?? d.fileType}</Chip>
            <span className="text-[10.5px] text-[color:var(--ink-faint)]">v{d.version} · {fmtSize(d.sizeKb)}</span>
          </div>
        </div>
        <StatusBadgeLite status={d.status} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-[color:var(--ink-faint)]">
        <span>{d.buName ?? "—"}{d.projectName ? ` · ${d.projectName}` : ""}</span>
        {d.submissionRef && (
          <button
            onClick={(e) => { e.stopPropagation(); navigate("submissions", { ref: d.submissionRef }); }}
            className="font-mono text-[11px] text-[color:var(--esg-blue)] hover:underline"
          >
            {d.submissionRef}
          </button>
        )}
        <span>· {d.uploadedBy || "—"} · {fmtDate(d.uploadedAt)}</span>
      </div>
    </div>
  );

  const hasFilter = q !== "" || typeFilter !== "ALL" || statusFilter !== "ALL" || buId !== "ALL";

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="Evidence & Documents"
        description="Central evidence repository for your subsidiary — versions, disclosure links, gaps and honest metadata receipts."
        icon={FilesIcon}
      />

      {/* ── summary KPI strip ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatusCard
          icon={FilesIcon} hue="#3a7bff" label="Total documents" hint="Whole repository"
          value={summary?.total ?? 0}
          onClick={() => { setStatusFilter("ALL"); setTypeFilter("ALL"); }}
          active={statusFilter === "ALL" && typeFilter === "ALL"}
        />
        <StatusCard
          icon={AlarmAlertIcon} hue="#c34a4a" label="Missing" hint="Evidence gaps to close"
          value={summary?.missing ?? 0}
          onClick={() => setStatusFilter(statusFilter === "MISSING" ? "ALL" : "MISSING")}
          active={statusFilter === "MISSING"}
        />
        <StatusCard
          icon={AlarmAlertIcon} hue="#c57926" label="Expired" hint="Needs re-validation"
          value={summary?.expired ?? 0}
          onClick={() => setStatusFilter(statusFilter === "EXPIRED" ? "ALL" : "EXPIRED")}
          active={statusFilter === "EXPIRED"}
        />
        <StatusCard
          icon={CheckSealIcon} hue="#20a779" label="Valid" hint="Current & accepted"
          value={validCount}
          onClick={() => setStatusFilter(statusFilter === "VALID" ? "ALL" : "VALID")}
          active={statusFilter === "VALID"}
        />
      </div>

      {/* ── by-type chips ── */}
      <div className="glass glass-sheen flex flex-wrap items-center gap-2 rounded-3xl px-4 py-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">By type</span>
        {(summary?.byType.length ?? 0) === 0 && <span className="text-xs text-[color:var(--ink-faint)]">No documents yet</span>}
        {(summary?.byType ?? []).map((t) => (
          <button
            key={t.type}
            onClick={() => setTypeFilter(typeFilter === t.type ? "ALL" : t.type)}
            aria-pressed={typeFilter === t.type}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all hover:-translate-y-px",
              typeFilter === t.type
                ? "border-[rgba(58,123,255,0.5)] bg-[rgba(58,123,255,0.14)] text-[#1d5fd6] shadow-sm"
                : "border-[rgba(102,119,141,0.26)] bg-[rgba(102,119,141,0.1)] text-[#5b6b80] hover:bg-white/70"
            )}
          >
            {TYPE_LABELS[t.type] ?? t.type} · {t.count}
          </button>
        ))}
        {statusFilter !== "ALL" && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-medium text-[color:var(--ink-soft)]">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#238653]" aria-hidden="true" />
            Status filter: {STATUS_META[statusFilter]?.label ?? statusFilter}
          </span>
        )}
      </div>

      {/* ── toolbar ── */}
      <Toolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search file, submission or disclosure ref…"
        filters={[
          { key: "type", label: "Type", options: [{ value: "ALL", label: "All types" }, ...TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t] ?? t }))], value: typeFilter, onChange: setTypeFilter },
          { key: "status", label: "Status", options: [{ value: "ALL", label: "All statuses" }, ...STATUSES.map((s) => ({ value: s, label: STATUS_META[s]?.label ?? s }))], value: statusFilter, onChange: setStatusFilter },
          { key: "bu", label: "Business unit", options: buOptions, value: buId, onChange: setBuId },
        ]}
        onReset={() => { setSearch(""); setQ(""); setTypeFilter("ALL"); setStatusFilter("ALL"); setBuId("ALL"); }}
        resultCount={data?.total ?? 0}
        right={<ExportButton filename="evidence-documents" rows={exportRows} />}
      />

      {/* ── table ── */}
      <DataTable<EvidenceRow>
        columns={columns}
        rows={rows}
        loading={loading && !data}
        error={error && !data ? error : null}
        onRetry={refetch}
        pageSize={8}
        onRowClick={(d) => setDetailId(d.id)}
        emptyTitle={summary?.total === 0 ? "No evidence documents yet" : hasFilter ? "Nothing matches your filters" : "No documents"}
        emptyMessage={
          summary?.total === 0
            ? "Evidence attached to submissions will appear here as reporting progresses."
            : "Try adjusting the search, type, status or business-unit filter."
        }
        mobileCard={mobileCard}
        rowActions={(d) => (
          <>
            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 rounded-xl text-[color:var(--ink-soft)] hover:bg-white/70"
              aria-label={`View ${d.name}`}
              title="View metadata"
              onClick={() => setDetailId(d.id)}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 rounded-xl text-[color:var(--ink-soft)] hover:bg-white/70"
              aria-label={`Download receipt for ${d.name}`}
              title="Download metadata receipt"
              disabled={downloadingId === d.id}
              onClick={() => download(d)}
            >
              {downloadingId === d.id ? <Ring className="h-4 w-4" /> : <Download className="h-4 w-4" />}
            </Button>
          </>
        )}
      />

      {/* ── detail dialog ── */}
      <GlassDialog
        open={!!detailId}
        onOpenChange={(o) => { if (!o) setDetailId(null); }}
        title={detailData ? detailData.name : "Document metadata"}
        description={detailData ? `${TYPE_LABELS[detailData.fileType] ?? detailData.fileType} · v${detailData.version} · ${fmtSize(detailData.sizeKb)}` : "Loading…"}
        wide
      >
        {detailLoading && !detailData ? (
          <LoadingBlock rows={5} label="Loading document metadata…" />
        ) : detailError && !detailData ? (
          <ErrorState message={detailError} onRetry={detailRefetch} />
        ) : detailData ? (
          <div className="space-y-4">
            {/* framed preview placeholder — honest per contract (no file storage in the sandbox) */}
            {(detailData.fileType === "IMAGE" || detailData.fileType === "PDF") && (
              <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[rgba(125,177,216,0.55)] bg-white/50 p-7 text-center">
                {detailData.fileType === "IMAGE" ? (
                  <ImageIcon className="h-6 w-6 text-[color:var(--ink-faint)]" aria-hidden="true" />
                ) : (
                  <FileText className="h-6 w-6 text-[color:var(--ink-faint)]" aria-hidden="true" />
                )}
                <p className="text-[13px] font-medium text-[color:var(--ink-soft)]">
                  Secure preview renders in production; storage is sandboxed here.
                </p>
              </div>
            )}

            <div className="glass-subtle rounded-2xl p-3.5">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <StatusBadgeLite status={detailData.status} />
                <Chip tone={TYPE_TONE[detailData.fileType] ?? "gray"}>{TYPE_LABELS[detailData.fileType] ?? detailData.fileType}</Chip>
                <Chip tone="gray">Version v{detailData.version}</Chip>
              </div>
              <InfoRow label="File name">{detailData.name}</InfoRow>
              <InfoRow label="Organization">{detailData.buName ?? "—"}{detailData.projectName ? ` · ${detailData.projectName}` : ""}</InfoRow>
              <InfoRow label="Uploaded by">{detailData.uploadedBy || "—"}</InfoRow>
              <InfoRow label="Uploaded at">{fmtDateTime(detailData.uploadedAt)}</InfoRow>
              <InfoRow label="Size">{fmtSize(detailData.sizeKb)}</InfoRow>
              <InfoRow label="Disclosure ref"><span className="font-mono text-[12px]">{detailData.disclosureRef || "—"}</span></InfoRow>
              <InfoRow label="Content hash"><span className="font-mono text-[12px]">{detailData.contentHash}</span></InfoRow>
              <InfoRow label="Preview">{detailData.previewAvailable ? "Available" : "Not available (storage sandboxed)"}</InfoRow>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[rgba(125,177,216,0.35)] bg-white/55 p-3.5">
              <div>
                <div className="text-[13px] font-semibold text-[color:var(--ink)]">Linked submission</div>
                <div className="font-mono text-[11.5px] text-[color:var(--ink-faint)]">{detailData.submissionRef || "—"}</div>
              </div>
              <Button
                className="btn-action rounded-2xl"
                disabled={!detailData.submissionRef}
                onClick={() => navigate("submissions", { ref: detailData.submissionRef })}
              >
                Open linked submission <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11.5px] text-[color:var(--ink-faint)]">
                Downloads in this sandbox produce a metadata receipt — no file bytes are stored on the platform.
              </p>
              <Button variant="outline" size="sm" className="glass-subtle rounded-2xl border-white/60" disabled={!detailData || downloadingId === detailData.id} onClick={() => { if (detailData) download(detailData); }}>
                {downloadingId === detailData.id ? <Ring className="mr-1.5 h-3.5 w-3.5" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}
                Download receipt
              </Button>
            </div>
          </div>
        ) : null}
      </GlassDialog>
    </div>
  );
}
