"use client";

// ── BU ADMIN · SCREEN 09 — Evidence & Documents ──
// BU-scoped evidence repository: search, filter, inspect, version history,
// real file upload (stored bytes) and byte-accurate downloads.

import { useMemo, useState } from "react";
import { CloudUpload, Download, FileCheck2, Files, Inbox } from "lucide-react";
import { Ring } from '@/components/ring'
import { FileCheckIcon } from "@/components/workspace/premium-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBaApi, fmtDate, fmtDateTime } from "@/lib/ba/client";
import { useBaWorkspace } from "@/lib/ba/store";
import type { EvidenceRow, EvidenceSummary, ProjectRow, SubmissionRow } from "@/lib/ba/types";
import {
  Chip, DataTable, EmptyState, ErrorState, ExportButton, Field, GlassDialog, InfoRow, LoadingBlock, PageHeader, SectionCard, StatusBadge, Toolbar, type Column,
} from "@/components/workspace/ui";
import { DetailSheet } from "@/components/workspace/ui";
import { useToast } from "@/hooks/use-toast";

type Response = { docs: EvidenceRow[]; total: number; summary: EvidenceSummary; page: number; pageSize: number };

const inputCls = "glass-subtle rounded-2xl border-white/60 text-sm";
const UPLOAD_ACCEPT = ".pdf,.xlsx,.xls,.csv,.doc,.docx,.png,.jpg,.jpeg,.webp,.gif";

/** Fetch one evidence document from the download endpoint — real bytes are
 *  saved as the original file, legacy metadata receipts as text. */
async function downloadEvidence(id: string, fallbackName: string) {
  const res = await fetch(`/api/ba/evidence/${id}/download`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const filename = (res.headers.get("Content-Disposition") ?? "").match(/filename="(.+?)"/)?.[1] ?? `${fallbackName.replace(/\.[^.]+$/, "")}-download`;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const SUMMARY_TONES = [
  { key: "total", label: "Total documents", tone: "blue" as const },
  { key: "missing", label: "Missing", tone: "red" as const },
  { key: "expired", label: "Expired", tone: "amber" as const },
];

export default function EvidenceView() {
  const { reportingYear } = useBaWorkspace();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const q = search.toLowerCase();
  const apiPath = `/api/ba/evidence?q=${encodeURIComponent(q)}&type=${type}&status=${status}&pageSize=50`;
  const { data, loading, error, refetch } = useBaApi<Response>(apiPath, { deps: [q, type, status] });

  const rows = data?.docs ?? [];
  const summary = data?.summary;
  const typeFacets = summary?.byType ?? [];

  const columns: Column<EvidenceRow>[] = useMemo(() => [
    {
      key: "name", header: "Document", sortable: true, sortValue: (r) => r.name,
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="glass-subtle flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[10px] font-bold text-[color:var(--ba-sky-deep)]">{r.fileType.slice(0, 3)}</span>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-[color:var(--ink)]">{r.name}</div>
            <div className="truncate text-[11px] text-[color:var(--ink-faint)]">v{r.version} · {r.fileType} · {r.sizeKb} KB{r.hasFile ? " · original file" : ""}</div>
          </div>
        </div>
      ),
    },
    { key: "submissionRef", header: "Submission ref", render: (r) => <span className="text-[12px] text-[color:var(--ink-soft)]">{r.submissionRef || "—"}</span> },
    { key: "project", header: "Project", render: (r) => <span className="truncate text-[12px] text-[color:var(--ink-soft)]">{r.projectName ?? "—"}</span> },
    { key: "uploadedBy", header: "Uploaded by", sortable: true, sortValue: (r) => r.uploadedBy, render: (r) => <span className="text-[12px] text-[color:var(--ink-soft)]">{r.uploadedBy || "—"}</span> },
    { key: "uploadedAt", header: "Uploaded", sortable: true, sortValue: (r) => r.uploadedAt, render: (r) => <span className="text-[12px] text-[color:var(--ink-soft)]">{fmtDate(r.uploadedAt)}</span> },
    { key: "status", header: "Status", sortable: true, sortValue: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
  ], []);

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="Evidence & Documents"
        description={`${reportingYear} · BU evidence repository. Every entry is scoped to your BU — uploaded files are stored with the platform and download byte-accurate.`}
        icon={FileCheckIcon}
      />

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {SUMMARY_TONES.map((s) => (
          <SectionCard key={s.key} title={s.label} icon={FileCheck2}>
            <div className="text-[24px] font-bold tabular text-[color:var(--ink)]">{summary?.[s.key as keyof EvidenceSummary] as number ?? 0}</div>
          </SectionCard>
        ))}
      </div>

      {/* by type */}
      {typeFacets.length > 0 && (
        <SectionCard title="By file type" description="Distribution across the BU evidence repository">
          <div className="flex flex-wrap gap-2">
            {typeFacets.map((t) => (
              <button key={t.type} onClick={() => setType(type === t.type ? "ALL" : t.type)} className={`rounded-2xl px-3 py-1.5 text-[12px] font-medium transition-all ${type === t.type ? "btn-ba-action" : "glass-subtle text-[color:var(--ink-soft)] hover:bg-white/80"}`}>
                {t.type} · {t.count}
              </button>
            ))}
          </div>
        </SectionCard>
      )}

      <Toolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search document, ref or uploader…"
        filters={[
          { key: "status", label: "Status", options: [{ value: "ALL", label: "All statuses" }, { value: "VALID", label: "Valid" }, { value: "MISSING", label: "Missing" }, { value: "EXPIRED", label: "Expired" }], value: status, onChange: setStatus },
          { key: "type", label: "Type", options: [{ value: "ALL", label: "All types" }, ...typeFacets.map((t) => ({ value: t.type, label: t.type }))], value: type, onChange: setType },
        ]}
        onReset={() => { setSearch(""); setType("ALL"); setStatus("ALL"); }}
        resultCount={data?.total ?? 0}
        right={
          <div className="flex items-center gap-2">
            <Button className="btn-ba-action rounded-2xl" onClick={() => setUploadOpen(true)}>
              <CloudUpload className="mr-1.5 h-4 w-4" /> Upload evidence
            </Button>
            <ExportButton filename="ba-evidence" rows={rows as unknown as Record<string, unknown>[]} />
          </div>
        }
      />

      <DataTable<EvidenceRow>
        columns={columns}
        rows={rows}
        loading={loading && !data}
        error={error && !data ? error : null}
        onRetry={refetch}
        pageSize={10}
        onRowClick={(r) => setDetailId(r.id)}
        emptyTitle={rows.length === 0 ? "No evidence documents" : "No matches"}
        emptyMessage={rows.length === 0 ? "Upload a document or attach evidence to submissions — files will appear here." : "Try adjusting the filters."}
        mobileCard={(r) => (
          <div className="flex flex-col gap-2 p-3">
            <div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="truncate text-[13px] font-semibold">{r.name}</div><div className="text-[11px] text-[color:var(--ink-faint)]">v{r.version} · {r.fileType}</div></div><StatusBadge status={r.status} /></div>
            <div className="text-[11px] text-[color:var(--ink-faint)]">{r.submissionRef || "—"} · uploaded {fmtDate(r.uploadedAt)}</div>
          </div>
        )}
      />

      {/* Upload affordance */}
      <div className="glass-ba glass-sheen flex flex-wrap items-center justify-between gap-3 rounded-3xl p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[rgba(52,139,232,0.14)] text-[color:var(--ba-sky-deep)]"><CloudUpload className="h-4 w-4" /></span>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-[color:var(--ink)]">Add evidence to the BU repository</div>
            <p className="mt-0.5 text-[12px] text-[color:var(--ink-soft)]">
              PDF, XLSX, CSV, DOCX or images up to 10 MB. Optionally link a submission or project — reviewers in every console see the original file.
            </p>
          </div>
        </div>
        <Button className="btn-ba-action rounded-2xl" onClick={() => setUploadOpen(true)}>
          <CloudUpload className="mr-1.5 h-4 w-4" /> Upload evidence
        </Button>
      </div>

      <DetailSheet
        open={!!detailId}
        onOpenChange={(o) => { if (!o) setDetailId(null); }}
        title={detailId ? "Evidence detail" : ""}
        subtitle="Document metadata + version history"
        width="lg"
        footer={
          <DetailFooter id={detailId} />
        }
      >
        <EvidenceDetail id={detailId} />
      </DetailSheet>

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploaded={(name) => {
          toast({ title: "Evidence uploaded", description: `“${name}” is stored and visible to reviewers across consoles.` });
          refetch();
        }}
      />
    </div>
  );
}

/* ── Upload dialog ── */
function UploadDialog({
  open, onOpenChange, onUploaded,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onUploaded: (name: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [submissionId, setSubmissionId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [disclosureRef, setDisclosureRef] = useState("");
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { data: subs } = useBaApi<{ submissions: SubmissionRow[] }>(open ? "/api/ba/submissions?pageSize=50&tab=all" : null, { pollMs: 0 });
  const { data: projects } = useBaApi<{ projects: ProjectRow[] }>(open ? "/api/ba/projects?pageSize=50" : null, { pollMs: 0 });

  const reset = () => {
    setFile(null);
    setSubmissionId("");
    setProjectId("");
    setDisclosureRef("");
    setErr(null);
  };

  const submit = async () => {
    if (!file) return setErr("Choose a file to upload.");
    setPending(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (submissionId && submissionId !== "none") fd.append("submissionId", submissionId);
      if (projectId && projectId !== "none") fd.append("projectId", projectId);
      if (disclosureRef.trim()) fd.append("disclosureRef", disclosureRef.trim());
      const res = await fetch("/api/ba/evidence", { method: "POST", body: fd });
      const body = (await res.json().catch(() => null)) as { error?: string; doc?: EvidenceRow } | null;
      if (!res.ok) throw new Error(body?.error ?? `Upload failed (${res.status})`);
      onOpenChange(false);
      onUploaded(body?.doc?.name ?? file.name);
      reset();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed — please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <GlassDialog
      open={open}
      onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}
      title="Upload evidence"
      description="The file is stored with the platform — reviewers in every console download the original bytes."
    >
      <div className="grid gap-3">
        <Field label="File" required error={err && !file ? err : null} hint="PDF, XLSX, CSV, DOCX or image · max 10 MB.">
          <Input
            type="file"
            accept={UPLOAD_ACCEPT}
            className={inputCls}
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setErr(null); }}
          />
        </Field>
        <Field label="Link to submission (optional)" hint="Keeps the document next to the report under review.">
          <Select value={submissionId} onValueChange={setSubmissionId}>
            <SelectTrigger className={inputCls}><SelectValue placeholder="No submission link" /></SelectTrigger>
            <SelectContent className="glass-strong rounded-2xl border-white/70">
              <SelectItem value="none">No submission link</SelectItem>
              {(subs?.submissions ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.ref} — {s.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Project (optional)">
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className={inputCls}><SelectValue placeholder="BU-level document" /></SelectTrigger>
            <SelectContent className="glass-strong rounded-2xl border-white/70">
              <SelectItem value="none">BU-level document</SelectItem>
              {(projects?.projects ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Disclosure reference (optional)" hint="e.g. BRSR Principle 3, LED-2.">
          <Input value={disclosureRef} onChange={(e) => setDisclosureRef(e.target.value)} className={inputCls} placeholder="Disclosure / ledger reference" />
        </Field>
        {err && <p className="rounded-2xl bg-[rgba(195,74,74,0.08)] px-3 py-2 text-[12px] font-medium text-[#a53b3b]" role="alert">{err}</p>}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" className="rounded-2xl" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
        <Button className="btn-ba-action rounded-2xl" onClick={() => void submit()} disabled={pending || !file}>
          {pending && <Ring className="mr-1.5 h-4 w-4" />}
          {pending ? "Uploading…" : "Upload"}
        </Button>
      </div>
    </GlassDialog>
  );
}

function EvidenceDetail({ id }: { id: string | null }) {
  const { data, loading, error, refetch } = useBaApi<{ doc: EvidenceRow & { previewAvailable?: boolean; contentHash?: string } }>(id ? `/api/ba/evidence/${id}` : null);
  if (!id) return null;
  if (loading && !data) return <LoadingBlock rows={4} />;
  if (error && !data) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return <EmptyState title="Not found" />;
  const d = data.doc;
  return (
    <div className="space-y-4">
      <div className="glass-subtle rounded-2xl p-3.5">
        <div className="flex items-start gap-3">
          <span className="glass-strong flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-[11px] font-bold text-[color:var(--ba-sky-deep)]">{d.fileType.slice(0, 3)}</span>
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-[color:var(--ink)]">{d.name}</div>
            <div className="mt-0.5 text-[12px] text-[color:var(--ink-faint)]">Version {d.version} · {d.fileType} · {d.sizeKb} KB</div>
            <div className="mt-1.5 flex items-center gap-2"><StatusBadge status={d.status} />{(d.hasFile ?? d.sizeKb > 0) && <Chip tone="blue">Original file stored</Chip>}</div>
          </div>
        </div>
      </div>
      <SectionCard title="Metadata" noPad>
        <div className="px-4 py-2">
          <InfoRow label="Submission ref">{d.submissionRef || "—"}</InfoRow>
          <InfoRow label="Disclosure ref">{d.disclosureRef || "—"}</InfoRow>
          <InfoRow label="Project">{d.projectName ?? "—"}</InfoRow>
          <InfoRow label="Uploaded by">{d.uploadedBy || "—"}</InfoRow>
          <InfoRow label="Uploaded at">{fmtDateTime(d.uploadedAt)}</InfoRow>
          <InfoRow label="Content hash">{d.contentHash ?? "—"}</InfoRow>
          <InfoRow label="Stored file">{d.hasFile ? "Yes — original bytes available" : "No (metadata receipt only)"}</InfoRow>
        </div>
      </SectionCard>
    </div>
  );
}

function DetailFooter({ id }: { id: string | null }) {
  const { data } = useBaApi<{ doc: EvidenceRow & { contentHash?: string } }>(id ? `/api/ba/evidence/${id}` : null);
  if (!id || !data) return null;
  const hasFile = data.doc?.hasFile ?? (data.doc?.sizeKb ?? 0) > 0;
  return (
    <Button variant="outline" className="rounded-2xl" onClick={() => void downloadEvidence(id, data.doc?.name ?? "evidence").catch(() => { /* ignore */ })}>
      <Download className="mr-1.5 h-4 w-4" /> {hasFile ? "Download original file" : "Download metadata receipt"}
    </Button>
  );
}

void Files; void Inbox;
