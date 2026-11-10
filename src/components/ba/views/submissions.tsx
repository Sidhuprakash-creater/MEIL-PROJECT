"use client";

// ── BU ADMIN · SCREEN 07 — Submission Center ──
// Centralized view of expected / drafted / submitted reporting records.
// Workflow status + deadline status are separate dimensions. This IS the
// sender side of the BU → Reviewer flow: the BU Admin fills values, attaches
// evidence and submits/resubmits. Decision controls (approve / reject /
// return) belong to the BU Manager.

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CloudUpload, Plus, RotateCcw, Save, ShieldAlert, Trash2, Workflow, X } from "lucide-react";
import { Ring } from '@/components/ring'
import { FilesIcon } from "@/components/workspace/premium-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBaApi, fmtDate, fmtDateTime, timeAgo } from "@/lib/ba/client";
import { useBaWorkspace } from "@/lib/ba/store";
import type { SubmissionRow, SubmissionDetail } from "@/lib/ba/types";
import {
  CATEGORY_LABELS, SUBMISSION_STATUS_LABELS,
} from "@/lib/ba/types";
import {
  Chip, DataTable, EmptyState, ErrorState, GlassDialog, GlassTabBar, LoadingBlock, PageHeader, StatusBadge, Toolbar, type Column,
} from "@/components/workspace/ui";
import { fmtMetric } from "@/components/ba/shared";
import { useToast } from "@/hooks/use-toast";

type Tab = "all" | "draft" | "submitted" | "pending" | "approved" | "rejected" | "overdue";
type Response = {
  submissions: SubmissionRow[];
  total: number; page: number; pageSize: number;
  counts: { all: number; draft: number; submitted: number; pending: number; approved: number; rejected: number; overdue: number };
};

const TAB_LABELS: Record<Tab, string> = {
  all: "All", draft: "Draft / Not started", submitted: "Submitted", pending: "Pending Review",
  approved: "Approved", rejected: "Returned / Rejected", overdue: "Overdue indicator",
};

const SUBMITTABLE_FROM = ["DRAFT", "ASSIGNED"];
const RESUBMITTABLE_FROM = ["CHANGES_REQUESTED", "REJECTED"];
const UPLOAD_ACCEPT = ".pdf,.xlsx,.xls,.csv,.doc,.docx,.png,.jpg,.jpeg,.webp,.gif";
const inputCls = "glass-subtle rounded-2xl border-white/60 text-sm";

type ValueDraft = { label: string; value: string; unit: string };
type DialogMode = "submit" | "resubmit" | "draft";

export default function SubmissionsView() {
  const { params, navigate, reportingYear } = useBaWorkspace();
  const [tab, setTab] = useState<Tab>(() =>
    params.tab && ["all", "draft", "submitted", "pending", "approved", "rejected", "overdue"].includes(params.tab as string) ? (params.tab as Tab) : "all"
  );
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [detailId, setDetailId] = useState<string | null>(() => (params.ref ? (params.ref as string) : null));

  /* consume the deep-link once — tab/ref only seed initial state */
  useEffect(() => {
    if (params.tab || params.ref) {
      navigate("submissions", { ...params, tab: undefined, ref: undefined });
    }
  }, []);

  const q = search.toLowerCase();
  const apiPath = `/api/ba/submissions?tab=${tab}&q=${encodeURIComponent(q)}&category=${category}&period=${encodeURIComponent(reportingYear)}&pageSize=50`;
  const { data, loading, error, refetch } = useBaApi<Response>(apiPath, { deps: [tab, q, category, reportingYear] });

  const rows = data?.submissions ?? [];
  const counts = data?.counts;

  const columns: Column<SubmissionRow>[] = useMemo(() => [
    {
      key: "ref", header: "Reference", sortable: true, sortValue: (r) => r.ref,
      render: (r) => (
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-[color:var(--ink)]">{r.ref}</div>
          <div className="truncate text-[11px] text-[color:var(--ink-faint)]">{r.title}</div>
        </div>
      ),
    },
    {
      key: "category", header: "Category", sortable: true, sortValue: (r) => r.category,
      render: (r) => <Chip tone="blue">{CATEGORY_LABELS[r.category] ?? r.category}</Chip>,
    },
    {
      key: "metric", header: "Metric",
      render: (r) => (
        <div className="min-w-0">
          <div className="truncate text-[12px] font-semibold text-[color:var(--ink)]">{r.metricName}</div>
          <div className="tabular text-[11px] text-[color:var(--ink-faint)]">{fmtMetric(r.metricValue)} {r.metricUnit}</div>
        </div>
      ),
    },
    { key: "project", header: "Project / BU", render: (r) => <span className="truncate text-[12px] text-[color:var(--ink-soft)]">{r.projectName ?? "BU report"}</span> },
    { key: "submittedBy", header: "Submitted by", render: (r) => <span className="text-[12px] text-[color:var(--ink-soft)]">{r.submittedByName ?? "—"}</span> },
    {
      key: "submittedAt", header: "Submitted on", sortable: true, sortValue: (r) => r.submittedAt ?? "",
      render: (r) => <span className="text-[12px] text-[color:var(--ink-soft)]">{r.submittedAt ? fmtDate(r.submittedAt) : "—"}</span>,
    },
    {
      key: "dueDate", header: "Deadline", sortable: true, sortValue: (r) => r.dueDate,
      render: (r) => (
        <div className="min-w-0">
          <div className="text-[12px] text-[color:var(--ink-soft)]">{fmtDate(r.dueDate)}</div>
          {r.overdue && r.status !== "APPROVED" && <Chip tone="red">overdue</Chip>}
        </div>
      ),
    },
    {
      key: "status", header: "Workflow", sortable: true, sortValue: (r) => r.status,
      render: (r) => <StatusBadge status={r.status} />,
    },
  ], []);

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="Submission Center"
        description={`${reportingYear} · Expected / drafted / submitted reporting records for your BU. Submit data from here — review decisions belong to the BU Manager.`}
        icon={FilesIcon}
        actions={
          <span className="glass-subtle inline-flex items-center gap-1.5 rounded-2xl px-3 py-2 text-[13px] font-medium text-[color:var(--ink-soft)]">
            <CloudUpload className="h-4 w-4 text-[color:var(--ba-sky-deep)]" aria-hidden="true" /> Sender · monitoring
          </span>
        }
      />

      <GlassTabBar
        tabs={(Object.keys(TAB_LABELS) as Tab[]).map((t) => ({ value: t, label: TAB_LABELS[t], count: counts?.[t] ?? 0 }))}
        value={tab}
        onChange={(v) => setTab(v as Tab)}
      />

      <Toolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search ref, title or metric…"
        filters={[
          { key: "category", label: "Category", options: [{ value: "ALL", label: "All categories" }, ...Object.entries(CATEGORY_LABELS).map(([k, v]) => ({ value: k, label: v }))], value: category, onChange: setCategory },
        ]}
        onReset={() => { setSearch(""); setCategory("ALL"); }}
        resultCount={data?.total ?? 0}
      />

      <DataTable<SubmissionRow>
        columns={columns}
        rows={rows}
        loading={loading && !data}
        error={error && !data ? error : null}
        onRetry={refetch}
        pageSize={10}
        onRowClick={(r) => setDetailId(r.id)}
        emptyTitle={counts?.[tab] === 0 ? `No ${TAB_LABELS[tab].toLowerCase()} records` : "No matches"}
        emptyMessage={counts?.[tab] === 0 ? `There are no ${TAB_LABELS[tab].toLowerCase()} records for ${reportingYear}.` : "Try adjusting the search or category filter."}
        mobileCard={(r) => (
          <div className="flex flex-col gap-2 p-3">
            <div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="text-[13px] font-semibold">{r.ref}</div><div className="truncate text-[11px] text-[color:var(--ink-faint)]">{r.title}</div></div><StatusBadge status={r.status} /></div>
            <div className="flex flex-wrap gap-2"><Chip tone="blue">{CATEGORY_LABELS[r.category] ?? r.category}</Chip>{r.overdue && r.status !== "APPROVED" && <Chip tone="red">overdue</Chip>}</div>
            <div className="text-[11px] text-[color:var(--ink-faint)]">{r.metricName} · {fmtMetric(r.metricValue)} {r.metricUnit}</div>
            <div className="text-[11px] text-[color:var(--ink-faint)]">Due {fmtDate(r.dueDate)} · Submitted {r.submittedAt ? fmtDate(r.submittedAt) : "—"}</div>
          </div>
        )}
      />

      <GlassDialog
        open={!!detailId}
        onOpenChange={(o) => { if (!o) setDetailId(null); }}
        title="Submission detail"
        description="Data entry & submission happen here — review decisions belong to the BU Manager"
        wide
      >
        <SubmissionDetail id={detailId} onChanged={refetch} />
      </GlassDialog>
    </div>
  );
}

function SubmissionDetail({ id, onChanged }: { id: string | null; onChanged: () => void }) {
  const { data, loading, error, refetch } = useBaApi<{ submission: SubmissionDetail }>(id ? `/api/ba/submissions/${id}` : null);
  const { toast } = useToast();
  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null);
  if (!id) return null;
  if (loading && !data) return <LoadingBlock rows={5} />;
  if (error && !data) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return <EmptyState title="Not found" />;
  const s = data.submission;
  const canSubmit = s.canSubmit ?? SUBMITTABLE_FROM.includes(s.status);
  const canResubmit = s.canResubmit ?? RESUBMITTABLE_FROM.includes(s.status);

  /* Latest non-BA (reviewer) comment — shown in the resubmit dialog so the
     sender knows exactly what to fix. */
  const reviewerNote = [...(s.comments ?? [])].reverse().find((c) => c.role !== "BU_ADMIN");

  const onSubmitted = (mode: DialogMode, ref: string) => {
    toast({
      title: mode === "draft" ? "Draft saved" : mode === "resubmit" ? "Report resubmitted" : "Data submitted",
      description:
        mode === "draft"
          ? `${ref} keeps its ${SUBMISSION_STATUS_LABELS[s.status] ?? "current"} state — values are stored.`
          : `${ref} is now with the BU Manager. Reviewers across consoles have been notified.`,
    });
    setDialogMode(null);
    void refetch();
    onChanged();
  };

  return (
    <div className="space-y-4">
      <div className="glass-subtle rounded-2xl p-3.5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={s.status} />
          {s.overdue && s.status !== "APPROVED" && <Chip tone="red">overdue</Chip>}
          <Chip tone={s.level === "PROJECT" ? "purple" : "blue"}>{s.level === "PROJECT" ? "Project report" : "BU report"}</Chip>
        </div>
        <div className="text-[14px] font-semibold text-[color:var(--ink)]">{s.ref} — {s.title}</div>
        <div className="mt-1 text-[12px] text-[color:var(--ink-faint)]">{CATEGORY_LABELS[s.category] ?? s.category} · {s.metricName} · {fmtMetric(s.metricValue)} {s.metricUnit}</div>
      </div>

      {/* ── sender actions (submit / resubmit / save draft) ── */}
      {(canSubmit || canResubmit) && (
        <div className="glass-ba glass-sheen flex flex-wrap items-center justify-between gap-3 rounded-2xl p-3.5">
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-[color:var(--ink)]">
              {canResubmit ? "Corrections requested — resubmit this report" : "Your action — report data"}
            </div>
            <p className="mt-0.5 text-[12px] text-[color:var(--ink-soft)]">
              {canResubmit
                ? "Update the values below and resubmit; the reviewer is notified on every console."
                : "Fill the value rows, optionally attach evidence, then submit for BU Manager review."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canResubmit && (
              <Button className="btn-ba-action rounded-2xl" onClick={() => setDialogMode("resubmit")}>
                <RotateCcw className="mr-1.5 h-4 w-4" /> Resubmit
              </Button>
            )}
            {canSubmit && (
              <>
                <Button className="btn-ba-action rounded-2xl" onClick={() => setDialogMode("submit")}>
                  <CloudUpload className="mr-1.5 h-4 w-4" /> Submit data
                </Button>
                <Button variant="outline" className="rounded-2xl" onClick={() => setDialogMode("draft")}>
                  <Save className="mr-1.5 h-4 w-4" /> Save draft
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 text-[12px]">
        <div><div className="text-[11px] font-medium text-[color:var(--ink-faint)]">Organization</div><div className="text-[color:var(--ink)]">{s.projectName ?? "BU report"}</div></div>
        <div><div className="text-[11px] font-medium text-[color:var(--ink-faint)]">Period</div><div className="text-[color:var(--ink)]">{s.period} · {s.fiscalQuarter}</div></div>
        <div><div className="text-[11px] font-medium text-[color:var(--ink-faint)]">Submitted by</div><div className="text-[color:var(--ink)]">{s.submittedByName ?? "—"}</div></div>
        <div><div className="text-[11px] font-medium text-[color:var(--ink-faint)]">Submitted at</div><div className="text-[color:var(--ink)]">{s.submittedAt ? fmtDateTime(s.submittedAt) : "—"}</div></div>
        <div><div className="text-[11px] font-medium text-[color:var(--ink-faint)]">Due date</div><div className="text-[color:var(--ink)]">{fmtDate(s.dueDate)}</div></div>
        <div><div className="text-[11px] font-medium text-[color:var(--ink-faint)]">Reviewer</div><div className="text-[color:var(--ink)]">{s.reviewerName ?? "—"}</div></div>
      </div>

      {s.evidence.length > 0 && (
        <div>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">Evidence ({s.evidence.length})</div>
          <div className="flex flex-wrap gap-1.5">
            {s.evidence.map((name, i) => <Chip key={`${name}-${i}`} tone="blue">{name}</Chip>)}
          </div>
        </div>
      )}

      <div>
        <div className="mb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]"><Workflow className="h-3.5 w-3.5" /> History</div>
        {(s.history ?? []).length === 0 ? <EmptyState title="No history yet" /> : (
          <div className="space-y-1.5">
            {s.history.slice(0, 6).map((h, i) => (
              <div key={i} className="rounded-xl bg-white/50 px-2.5 py-1.5 text-[12px]">
                <span className="font-semibold text-[color:var(--ink)]">{h.actor}</span> <span className="text-[color:var(--ink-faint)]">{h.action.replace(/_/g, " ").toLowerCase()}</span> {h.note && <span className="text-[color:var(--ink-soft)]">— {h.note}</span>}
                <div className="text-[10.5px] text-[color:var(--ink-faint)]">{timeAgo(h.at)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {dialogMode && (
        <SubmitDialog
          mode={dialogMode}
          submission={s}
          reviewerNote={reviewerNote ?? null}
          onOpenChange={(o) => { if (!o) setDialogMode(null); }}
          onDone={(mode, ref) => onSubmitted(mode, ref)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SubmitDialog — the sender form: editable value rows (label / value / unit),
   optional comment, evidence files uploaded FIRST (per-file status) and the
   workflow action second. Client validation mirrors the server contract.
   ═══════════════════════════════════════════════════════════════════════════ */

type FileStatus = { name: string; ok: boolean; message?: string };

function SubmitDialog({
  mode, submission, reviewerNote, onOpenChange, onDone,
}: {
  mode: DialogMode;
  submission: SubmissionDetail;
  reviewerNote: { author: string; role: string; text: string; at: string } | null;
  onOpenChange: (o: boolean) => void;
  onDone: (mode: DialogMode, ref: string) => void;
}) {
  const [rows, setRows] = useState<ValueDraft[]>(() => {
    if (submission.values.length > 0) {
      return submission.values.map((v) => ({ label: v.label, value: String(v.value), unit: v.unit }));
    }
    return [{
      label: submission.metricName || "",
      value: submission.metricValue ? String(submission.metricValue) : "",
      unit: submission.metricUnit || "",
    }];
  });
  const [comment, setComment] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [fileStatus, setFileStatus] = useState<FileStatus[]>([]);
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  /* Evidence uploads mutate the submission (history sync) → its updatedAt
     moves past the snapshot the dialog was opened with. Track the freshest
     server-confirmed stamp so the submit call never trips the version guard. */
  const [stamp, setStamp] = useState<string | null>(null);

  const isResubmit = mode === "resubmit";
  const isDraft = mode === "draft";

  const setRow = (i: number, patch: Partial<ValueDraft>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((prev) => [...prev, { label: "", value: "", unit: "" }]);
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i));

  /* Build the numeric payload — rows with a label and a finite value. */
  const buildValues = () => {
    const cleaned = rows.map((r) => ({ label: r.label.trim(), value: r.value.trim(), unit: r.unit.trim() }));
    const filled = cleaned.filter((r) => r.label || r.value);
    const valid = filled.filter((r) => r.label && r.value !== "" && Number.isFinite(Number(r.value)));
    return { filled, valid };
  };

  const validate = (): string | null => {
    if (isDraft) return null;
    const { filled, valid } = buildValues();
    if (filled.length === 0 || valid.length === 0) {
      return "Add at least one value row with a label and a numeric value before submitting.";
    }
    if (valid.length < filled.length) {
      return "Every value row needs both a label and a numeric value — remove or complete the highlighted rows.";
    }
    return null;
  };

  /* Upload the picked evidence files first; abort the flow on any failure.
     Returns `{ ok: true, stamp }` on success — stamp is the freshest
     server-confirmed updatedAt (uploads mutate the submission's history,
     which moves its version forward), so the caller submits against the NEW
     version instead of the stale dialog snapshot. `{ ok: false }` = an
     upload failed and the error has already been surfaced per file. */
  const uploadEvidence = async (): Promise<{ ok: boolean; stamp: string | null }> => {
    if (files.length === 0) return { ok: true, stamp: null };
    setUploading(true);
    const statuses: FileStatus[] = [];
    let latestStamp: string | null = null;
    try {
      for (const f of files) {
        try {
          const fd = new FormData();
          fd.append("file", f);
          const res = await fetch(`/api/ba/submissions/${submission.id}/evidence`, { method: "POST", body: fd });
          const body = (await res.json().catch(() => null)) as { error?: string; submissionUpdatedAt?: string | null } | null;
          if (!res.ok) throw new Error(body?.error ?? `Upload failed (${res.status})`);
          if (body?.submissionUpdatedAt) {
            latestStamp = body.submissionUpdatedAt;
            setStamp(body.submissionUpdatedAt);
          }
          statuses.push({ name: f.name, ok: true });
        } catch (e) {
          statuses.push({ name: f.name, ok: false, message: e instanceof Error ? e.message : "Upload failed" });
          setFileStatus([...statuses]);
          setErr(statuses[statuses.length - 1].message ?? "Evidence upload failed.");
          return { ok: false, stamp: null };
        }
        setFileStatus([...statuses]);
      }
      return { ok: true, stamp: latestStamp };
    } finally {
      setUploading(false);
    }
  };

  const run = async () => {
    const problem = validate();
    if (problem) return setErr(problem);
    setPending(true);
    setErr(null);
    try {
      const { valid } = buildValues();
      let uploadedStamp: string | null = null;
      if (!isDraft && files.length > 0) {
        const up = await uploadEvidence();
        if (!up.ok) return; // upload error already surfaced per file
        uploadedStamp = up.stamp;
      }
      const res = await fetch(`/api/ba/submissions/${submission.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: isDraft ? "save_draft" : isResubmit ? "resubmit" : "submit",
          values: valid.map((r) => ({ label: r.label, value: Number(r.value), unit: r.unit })),
          ...(isDraft ? {} : { comment: comment.trim() || undefined }),
          expectedUpdatedAt: uploadedStamp ?? stamp ?? submission.lastUpdated,
        }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string; submission?: SubmissionDetail } | null;
      if (!res.ok) throw new Error(body?.error ?? `Submission failed (${res.status})`);
      onDone(mode, body?.submission?.ref ?? submission.ref);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Submission failed — please try again.");
    } finally {
      setPending(false);
    }
  };

  const title = isDraft ? "Save draft values" : isResubmit ? "Resubmit after corrections" : "Submit data";
  const actionLabel = isDraft ? "Save draft" : isResubmit ? "Resubmit" : "Submit data";
  const busy = pending || uploading;

  return (
    <GlassDialog
      open
      onOpenChange={onOpenChange}
      title={title}
      description={isDraft
        ? "Values are stored without changing the workflow state — submit when ready."
        : `${submission.ref} moves to Submitted and the reviewer queue on every console.`}
    >
      <div className="grid gap-3">
        {isResubmit && reviewerNote && (
          <div className="rounded-2xl border border-[rgba(197,121,38,0.4)] bg-[rgba(197,121,38,0.08)] p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#7a4a12]">Reviewer feedback to address</div>
            <p className="mt-1 whitespace-pre-line text-[12.5px] leading-relaxed text-[#7a4a12]">“{reviewerNote.text}”</p>
            <div className="mt-1 text-[11px] text-[color:var(--ink-faint)]">{reviewerNote.author} · {reviewerNote.role.replace(/_/g, " ")} · {fmtDateTime(reviewerNote.at)}</div>
          </div>
        )}

        {/* value rows editor */}
        <div className="glass-subtle overflow-hidden rounded-2xl">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[rgba(125,177,216,0.3)] text-left text-[10.5px] uppercase tracking-wide text-[color:var(--ink-faint)]">
                <th className="px-3 py-2 font-semibold">Label</th>
                <th className="px-2 py-2 font-semibold">Value</th>
                <th className="px-2 py-2 font-semibold">Unit</th>
                <th className="w-8 px-1 py-2"><span className="sr-only">Remove row</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-[rgba(125,177,216,0.15)] last:border-0">
                  <td className="px-2 py-1.5">
                    <Input value={r.label} onChange={(e) => setRow(i, { label: e.target.value })} className={inputCls} placeholder={`e.g. ${submission.metricName || "Metric label"}`} aria-label={`Row ${i + 1} label`} />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input value={r.value} onChange={(e) => setRow(i, { value: e.target.value })} className={inputCls} inputMode="decimal" placeholder="0" aria-label={`Row ${i + 1} value`} />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input value={r.unit} onChange={(e) => setRow(i, { unit: e.target.value })} className={inputCls} placeholder={submission.metricUnit || "unit"} aria-label={`Row ${i + 1} unit`} />
                  </td>
                  <td className="px-1 py-1.5">
                    <Button variant="ghost" size="sm" className="h-8 w-8 rounded-xl p-0 text-[color:var(--ink-faint)] hover:text-[#a53b3b]" onClick={() => removeRow(i)} disabled={rows.length === 1} aria-label={`Remove row ${i + 1}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button variant="outline" size="sm" className="self-start rounded-2xl" onClick={addRow}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add value row
        </Button>

        {!isDraft && (
          <>
            <div>
              <label className="mb-1 block text-[12px] font-semibold text-[color:var(--ink-soft)]" htmlFor="ba-submit-evidence">
                Evidence files (optional)
              </label>
              <Input
                id="ba-submit-evidence"
                type="file"
                accept={UPLOAD_ACCEPT}
                multiple
                className={inputCls}
                onChange={(e) => { setFiles(Array.from(e.target.files ?? [])); setFileStatus([]); setErr(null); }}
              />
              <p className="mt-1 text-[11px] text-[color:var(--ink-faint)]">
                PDF, XLSX, CSV, DOCX or images · max 10 MB each · uploaded to {submission.ref} before the report is submitted.
              </p>
            </div>
            {fileStatus.length > 0 && (
              <ul className="space-y-1" aria-live="polite">
                {fileStatus.map((f) => (
                  <li key={f.name} className="flex items-center gap-1.5 text-[12px]">
                    {f.ok
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-[#20a779]" aria-hidden="true" />
                      : <X className="h-3.5 w-3.5 text-[#a53b3b]" aria-hidden="true" />}
                    <span className={f.ok ? "text-[color:var(--ink-soft)]" : "font-medium text-[#a53b3b]"}>
                      {f.name}{f.ok ? " — uploaded" : ` — ${f.message ?? "failed"}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div>
              <label className="mb-1 block text-[12px] font-semibold text-[color:var(--ink-soft)]" htmlFor="ba-submit-comment">
                Comment for the reviewer (optional)
              </label>
              <Input
                id="ba-submit-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className={inputCls}
                placeholder={isResubmit ? "What was corrected…" : "Context for the BU Manager…"}
                maxLength={500}
              />
            </div>
          </>
        )}

        {err && <p className="rounded-2xl bg-[rgba(195,74,74,0.08)] px-3 py-2 text-[12px] font-medium text-[#a53b3b]" role="alert">{err}</p>}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] text-[color:var(--ink-faint)]">
          <ShieldAlert className="h-3.5 w-3.5 text-[#c57926]" aria-hidden="true" />
          {isDraft ? "No notification is sent for drafts" : "Broadcast to all five console bells"}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-2xl" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button className="btn-ba-action rounded-2xl" onClick={() => void run()} disabled={busy}>
            {busy && <Ring className="mr-1.5 h-4 w-4" />}
            {uploading ? "Uploading evidence…" : busy ? "Working…" : actionLabel}
          </Button>
        </div>
      </div>
    </GlassDialog>
  );
}
