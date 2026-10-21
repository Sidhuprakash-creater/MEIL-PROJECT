"use client";

// ── SCREEN 09 — Submission Center (ESG Operations) ──
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarClock,
  ClipboardList,
  Download,
  FileText,
  Layers,
  Loader2,
  MessageSquare,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CATEGORIES, SUBMISSION_STATUSES, ROLE_LABELS, type Submission } from "@/lib/esg/types";
import { apiDelete, apiPost, downloadFile, fmtDate, fmtDateTime, fmtNumber, timeAgo, useApi, useMutation } from "@/lib/esg/client";
import { useWorkspace } from "@/lib/esg/store";
import {
  ActionButton,
  Avatar,
  Chip,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Field,
  GlassCard,
  GlassDialog,
  GlassTabBar,
  InfoRow,
  LoadingBlock,
  PageHeader,
  SectionCard,
  StatusBadge,
  Toolbar,
  ExportButton,
  type Column,
} from "@/components/workspace/ui";

const CATEGORY_LABELS: Record<string, string> = {
  ENVIRONMENT: "Environment",
  ENERGY: "Energy",
  EMISSIONS: "Emissions",
  WATER: "Water",
  WASTE: "Waste",
  SAFETY: "Safety",
  WORKFORCE: "Workforce",
  PROCUREMENT: "Procurement",
  CSR: "CSR",
  COMPLIANCE: "Compliance",
};

const DETAIL_TABS = ["overview", "values", "evidence", "comments", "history"] as const;

interface ReviewResponse {
  results: { id: string; ok: boolean; error?: string }[];
  success: boolean;
  message: string;
}

function csvSubmissionRow(s: Submission): Record<string, unknown> {
  return {
    Ref: s.ref,
    Title: s.title,
    Category: CATEGORY_LABELS[s.category] ?? s.category,
    Status: s.status,
    Period: s.period,
    Quarter: s.fiscalQuarter,
    Subsidiary: s.subsidiaryName ?? "",
    BusinessUnit: s.businessUnitName ?? "",
    Project: s.projectName ?? "",
    SubmittedBy: s.submittedByName ?? "",
    Metric: s.metricName,
    Value: s.metricValue,
    Unit: s.metricUnit,
    Due: fmtDate(s.dueDate),
    Overdue: s.overdue ? "YES" : "NO",
  };
}

/* ─────────────────────────── Detail view ─────────────────────────── */

function SubmissionDetail({ id }: { id: string }) {
  const { navigate } = useWorkspace();
  const { toast } = useToast();
  const { params } = useWorkspace();
  const initialTab = DETAIL_TABS.includes((params.detailTab ?? "") as (typeof DETAIL_TABS)[number]) ? (params.detailTab as string) : "overview";

  const detailApi = useApi<{ submission: Submission }>(`/api/esg/submissions?id=${id}`, [id]);
  const reviewMut = useMutation<ReviewResponse>();
  const discardMut = useMutation<{ success: boolean }>();

  const [tab, setTab] = useState<string>(initialTab);
  const [dialog, setDialog] = useState<null | { kind: "approve" | "reject" | "request_changes" | "return" | "reopen" | "discard" }>(null);
  const [comment, setComment] = useState("");

  const s = detailApi.data?.submission ?? null;

  const runReview = async (action: "approve" | "reject" | "request_changes" | "return" | "reopen", reason?: string, approveComment?: string) => {
    if (!s) return;
    setDialog(null);
    const res = await reviewMut.run(() =>
      apiPost<ReviewResponse>("/api/esg/submissions", { action, id: s.id, reason, comment: approveComment })
    );
    if (res) {
      if (res.success) {
        toast({ title: action === "approve" ? "Submission approved" : "Decision recorded", description: res.message });
      } else {
        toast({ title: "Partially failed", description: res.message, variant: "destructive" });
      }
      setComment("");
      await detailApi.refetch();
    } else {
      toast({ title: "Action failed", description: reviewMut.error ?? "Server rejected the decision.", variant: "destructive" });
    }
  };

  const discard = async (reason?: string) => {
    if (!s) return;
    setDialog(null);
    const res = await discardMut.run(() => apiDelete("/api/esg/submissions", { id: s.id, reason }));
    if (res) {
      toast({ title: "Draft discarded", description: `${s.ref} was permanently removed.` });
      navigate("submissions");
    } else {
      toast({ title: "Discard failed", description: discardMut.error ?? "Server rejected the request.", variant: "destructive" });
    }
  };

  if (detailApi.loading) {
    return (
      <div className="view-in space-y-5">
        <GlassCard><LoadingBlock rows={6} label="Loading submission…" /></GlassCard>
      </div>
    );
  }
  if (detailApi.error || !s) {
    return (
      <div className="view-in space-y-5">
        <Button variant="ghost" size="sm" className="-ml-2 rounded-2xl text-[color:var(--ink-soft)]" onClick={() => navigate("submissions")}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Submission Center
        </Button>
        <GlassCard>
          <EmptyState
            title="Submission not found"
            message={detailApi.error ?? "This record may have been discarded."}
            action={<Button variant="outline" className="glass-subtle rounded-2xl" onClick={() => void detailApi.refetch()}>Try again</Button>}
          />
        </GlassCard>
      </div>
    );
  }

  const lastTouched = s.history.length ? s.history[s.history.length - 1].at : s.submittedAt;
  const canAct = !["DRAFT", "ASSIGNED"].includes(s.status);
  const canReopen = ["APPROVED", "REJECTED"].includes(s.status);
  const canComment = ["SUBMITTED", "UNDER_REVIEW"].includes(s.status);
  const orgTrail = [s.subsidiaryName, s.businessUnitName, s.projectName].filter(Boolean).join("  ›  ") || "Group level";

  return (
    <div className="view-in space-y-5">
      <Button variant="ghost" size="sm" className="-ml-2 rounded-2xl text-[color:var(--ink-soft)]" onClick={() => navigate("submissions")}>
        <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Submission Center
      </Button>

      {/* Header */}
      <GlassCard className="p-5 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="blue" className="font-mono">{s.ref}</Chip>
              <StatusBadge status={s.status} />
              {s.overdue && <Chip tone="red">Overdue</Chip>}
            </div>
            <h1 className="mt-2 text-xl font-semibold tracking-tight text-[color:var(--ink)] sm:text-2xl">{s.title}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[color:var(--ink-faint)]">
              <span>{orgTrail}</span>
              <span className="inline-flex items-center gap-1">
                <Avatar name={s.submittedByName ?? "Unassigned"} size={18} />
                {s.submittedByName ? `${s.submittedByName}${s.submittedByRole ? ` · ${ROLE_LABELS[s.submittedByRole] ?? s.submittedByRole}` : ""}` : "Unassigned"}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <ExportButton filename={`submission-${s.ref}`} rows={[csvSubmissionRow(s)]} />
          </div>
        </div>
      </GlassCard>

      {/* Review actions */}
      {canAct ? (
        <GlassCard className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--ink-faint)]">Review actions</span>
            <ActionButton pending={reviewMut.pending} disabled={reviewMut.pending} onClick={() => { setComment(""); setDialog({ kind: "approve" }); }}>
              Approve
            </ActionButton>
            <Button variant="outline" className="glass-subtle rounded-2xl border-white/60" disabled={reviewMut.pending} onClick={() => { setComment(""); setDialog({ kind: "request_changes" }); }}>
              Request changes
            </Button>
            <Button variant="outline" className="glass-subtle rounded-2xl border-white/60" disabled={reviewMut.pending} onClick={() => { setComment(""); setDialog({ kind: "reject" }); }}>
              Reject
            </Button>
            <Button variant="outline" className="glass-subtle rounded-2xl border-white/60" disabled={reviewMut.pending} onClick={() => { setComment(""); setDialog({ kind: "return" }); }}>
              Return to submitter
            </Button>
            {canReopen && (
              <Button variant="outline" className="glass-subtle rounded-2xl border-white/60" disabled={reviewMut.pending} onClick={() => { setComment(""); setDialog({ kind: "reopen" }); }}>
                Reopen
              </Button>
            )}
            {reviewMut.pending && <Loader2 className="h-4 w-4 animate-spin text-[color:var(--esg-blue)]" />}
          </div>
        </GlassCard>
      ) : (
        <GlassCard className="flex flex-wrap items-center justify-between gap-2 p-4">
          <p className="text-[13px] text-[color:var(--ink-soft)]">
            {s.status === "DRAFT"
              ? "This submission is still a draft. Review actions unlock once it is submitted."
              : "This record is assigned to a responsible user and has not been submitted yet."}
          </p>
          {s.status === "DRAFT" && (
            <Button variant="destructive" size="sm" className="rounded-2xl" disabled={discardMut.pending} onClick={() => setDialog({ kind: "discard" })}>
              {discardMut.pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />} Discard draft
            </Button>
          )}
        </GlassCard>
      )}

      <GlassTabBar
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "overview", label: "Overview" },
          { value: "values", label: "Values", count: s.values.length },
          { value: "evidence", label: "Evidence", count: s.evidence.length },
          { value: "comments", label: "Comments", count: s.comments.length },
          { value: "history", label: "History", count: s.history.length },
        ]}
      />

      {tab === "overview" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <SectionCard title="Record metadata" icon={ClipboardList}>
            <div className="divide-y divide-[rgba(125,177,216,0.18)]">
              <InfoRow label="Reference"><span className="font-mono text-xs">{s.ref}</span></InfoRow>
              <InfoRow label="Category">{CATEGORY_LABELS[s.category] ?? s.category}</InfoRow>
              <InfoRow label="Period">{s.period || "—"} {s.fiscalQuarter ? `· ${s.fiscalQuarter}` : ""}</InfoRow>
              <InfoRow label="Due date"><span className={cn(s.overdue && "font-semibold text-[#a53b3b]")}>{fmtDate(s.dueDate)}</span></InfoRow>
              <InfoRow label="Submitted at">{s.submittedAt ? fmtDateTime(s.submittedAt) : "—"}</InfoRow>
              <InfoRow label="Reviewed at">{s.reviewedAt ? fmtDateTime(s.reviewedAt) : "—"}</InfoRow>
              <InfoRow label="Reviewer">{s.reviewerName ?? "—"}</InfoRow>
              <InfoRow label="Metric value">
                {s.metricName ? (
                  <span className="tabular">{s.metricName}: {fmtNumber(s.metricValue, 2)} {s.metricUnit}</span>
                ) : "—"}
              </InfoRow>
            </div>
          </SectionCard>
          <SectionCard title="Workflow timeline" icon={CalendarClock} noPad>
            {s.history.length === 0 ? (
              <EmptyState title="No workflow events yet" message="History entries appear as this record moves through review." />
            ) : (
              <div className="nice-scroll max-h-96 overflow-y-auto p-5">
                <ol className="relative space-y-4 border-l border-[rgba(125,177,216,0.35)] pl-5">
                  {[...s.history].reverse().map((h, i) => (
                    <li key={i} className="relative">
                      <span className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full bg-[#3a7bff] ring-4 ring-white/60" />
                      <div className="text-sm font-medium text-[color:var(--ink)]">{h.action}</div>
                      <div className="mt-0.5 text-xs text-[color:var(--ink-faint)]">{h.actor} · {fmtDateTime(h.at)} ({timeAgo(h.at)})</div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {tab === "values" && (
        <SectionCard title="Reported values" icon={Layers} noPad>
          {s.values.length === 0 ? (
            <EmptyState title="No structured values" message="This submission records only its headline metric." />
          ) : (
            <div className="nice-scroll max-h-96 overflow-y-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-white/75 backdrop-blur-md [&>tr>th]:border-b [&>tr>th]:border-[rgba(125,177,216,0.35)] [&>tr>th]:px-5 [&>tr>th]:py-3 [&>tr>th]:text-left [&>tr>th]:text-[11px] [&>tr>th]:font-semibold [&>tr>th]:uppercase [&>tr>th]:tracking-wide [&>tr>th]:text-[color:var(--ink-faint)]">
                  <tr><th>Label</th><th className="text-right">Value</th><th className="text-right">Unit</th></tr>
                </thead>
                <tbody>
                  {s.values.map((v, i) => (
                    <tr key={i} className="border-b border-[rgba(125,177,216,0.16)] last:border-0">
                      <td className="px-5 py-3 text-[color:var(--ink)]">{v.label}</td>
                      <td className="tabular px-5 py-3 text-right font-medium text-[color:var(--ink)]">{fmtNumber(v.value, 2)}</td>
                      <td className="px-5 py-3 text-right text-[color:var(--ink-soft)]">{v.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}

      {tab === "evidence" && (
        <SectionCard title="Supporting evidence" icon={FileText} noPad>
          {s.evidence.length === 0 ? (
            <EmptyState title="No evidence attached" message="The submitter has not attached supporting documents to this record." />
          ) : (
            <div className="nice-scroll max-h-96 overflow-y-auto divide-y divide-[rgba(125,177,216,0.18)]">
              {s.evidence.map((name, i) => (
                <div key={i} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="glass-subtle flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
                      <FileText className="h-4 w-4 text-[color:var(--esg-blue)]" />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-[color:var(--ink)]">{name}</div>
                      <div className="text-xs text-[color:var(--ink-faint)]">Attachment {i + 1} of {s.evidence.length}</div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="glass-subtle shrink-0 rounded-2xl border-white/60"
                    onClick={() => downloadFile(name, `Demo evidence file placeholder for ${name}.\n\nThis workspace demo does not store real documents. In production, the verified evidence file would be downloaded here, with its checksum recorded in the audit log for submission ${s.ref}.`)}
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" /> Download
                  </Button>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {tab === "comments" && (
        <SectionCard title="Review comments" icon={MessageSquare} description={canComment ? "Submitting a comment records it and requests changes from the submitter." : "Comments can be added via review actions once the record is in review."} noPad>
          {s.comments.length === 0 ? (
            <EmptyState title="No comments yet" message="Reviewers' notes will appear here." />
          ) : (
            <div className="nice-scroll max-h-80 overflow-y-auto divide-y divide-[rgba(125,177,216,0.18)]">
              {s.comments.map((c, i) => (
                <div key={i} className="flex gap-3 px-5 py-3.5">
                  <Avatar name={c.author} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-[color:var(--ink)]">{c.author}</span>
                      {c.role && <Chip tone="gray">{ROLE_LABELS[c.role] ?? c.role}</Chip>}
                      <span className="text-xs text-[color:var(--ink-faint)]">{timeAgo(c.at)}</span>
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-[color:var(--ink-soft)]">{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="border-t border-[rgba(125,177,216,0.25)] p-5">
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              disabled={!canComment || reviewMut.pending}
              placeholder={canComment ? "Write a review comment (min 4 characters) — this records a 'request changes' decision…" : "Comments can be added via review actions once the record is submitted for review."}
              className="glass-subtle rounded-2xl border-white/60"
            />
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-xs text-[color:var(--ink-faint)]">
                {canComment ? "Recorded as a formal review decision." : "Disabled for this status."}
              </span>
              <Button
                size="sm"
                className="rounded-2xl"
                disabled={!canComment || reviewMut.pending || comment.trim().length < 4}
                onClick={() => void runReview("request_changes", comment.trim())}
              >
                {reviewMut.pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
                Add comment & request changes
              </Button>
            </div>
          </div>
        </SectionCard>
      )}

      {tab === "history" && (
        <SectionCard title="Full history" icon={CalendarClock} noPad>
          {s.history.length === 0 ? (
            <EmptyState title="No history" message="No workflow events recorded yet." />
          ) : (
            <div className="nice-scroll max-h-96 overflow-y-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-white/75 backdrop-blur-md [&>tr>th]:border-b [&>tr>th]:border-[rgba(125,177,216,0.35)] [&>tr>th]:px-5 [&>tr>th]:py-3 [&>tr>th]:text-left [&>tr>th]:text-[11px] [&>tr>th]:font-semibold [&>tr>th]:uppercase [&>tr>th]:tracking-wide [&>tr>th]:text-[color:var(--ink-faint)]">
                  <tr><th>Action</th><th>Actor</th><th className="text-right">When</th></tr>
                </thead>
                <tbody>
                  {s.history.map((h, i) => (
                    <tr key={i} className="border-b border-[rgba(125,177,216,0.16)] last:border-0">
                      <td className="px-5 py-3 text-[color:var(--ink)]">{h.action}</td>
                      <td className="px-5 py-3 text-[color:var(--ink-soft)]">{h.actor}</td>
                      <td className="px-5 py-3 text-right text-xs text-[color:var(--ink-faint)]">{fmtDateTime(h.at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}

      {/* Review confirm dialogs */}
      <GlassDialog
        open={dialog?.kind === "approve"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Approve ${s?.ref ?? ""}`}
        description="Approved submissions become eligible for BRSR consolidation. This does not finalize any BRSR report."
        footer={
          <>
            <Button variant="outline" className="glass-subtle rounded-2xl" onClick={() => setDialog(null)} disabled={reviewMut.pending}>Cancel</Button>
            <ActionButton pending={reviewMut.pending} onClick={() => void runReview("approve", undefined, comment || undefined)}>Approve submission</ActionButton>
          </>
        }
      >
        <Field label="Approval note (optional)">
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="Optional note recorded with the approval…" className="glass-subtle rounded-2xl border-white/60" />
        </Field>
      </GlassDialog>

      <ConfirmDialog
        open={dialog?.kind === "reject"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Reject ${s?.ref ?? ""}`}
        message="The submission will be rejected and the submitter notified with your reason."
        confirmLabel="Reject submission"
        destructive
        requireReason
        pending={reviewMut.pending}
        onConfirm={(reason) => void runReview("reject", reason)}
      />
      <ConfirmDialog
        open={dialog?.kind === "request_changes"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Request changes — ${s?.ref ?? ""}`}
        message="The record moves to Changes Requested and the submitter is asked to revise and resubmit."
        confirmLabel="Request changes"
        requireReason
        pending={reviewMut.pending}
        onConfirm={(reason) => void runReview("request_changes", reason)}
      />
      <ConfirmDialog
        open={dialog?.kind === "return"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Return ${s?.ref ?? ""}?`}
        message="The record returns to ASSIGNED so the responsible user can revise and resubmit it."
        confirmLabel="Return record"
        requireReason
        pending={reviewMut.pending}
        onConfirm={(reason) => void runReview("return", reason)}
      />
      <ConfirmDialog
        open={dialog?.kind === "reopen"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Reopen ${s?.ref ?? ""}?`}
        message="A closed decision (approved or rejected) is reopened for review. Use this to correct mistaken decisions."
        confirmLabel="Reopen review"
        requireReason
        pending={reviewMut.pending}
        onConfirm={(reason) => void runReview("reopen", reason)}
      />
      <ConfirmDialog
        open={dialog?.kind === "discard"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Discard draft ${s?.ref ?? ""}?`}
        message="Draft submissions are permanently removed. Submitted records cannot be discarded — use review actions instead."
        confirmLabel="Discard permanently"
        destructive
        requireReason
        pending={discardMut.pending}
        onConfirm={(reason) => void discard(reason)}
      />
    </div>
  );
}

/* ─────────────────────────── List view ─────────────────────────── */

export default function SubmissionsView() {
  const { params, navigate, openDetail } = useWorkspace();
  const { toast } = useToast();
  const detailId = typeof params.detailId === "string" ? params.detailId : undefined;
  const autoCreate = params.create !== undefined;

  const listApi = useApi<{ submissions: Submission[] }>("/api/esg/submissions");
  const subsApi = useApi<{ subsidiaries: { id: string; name: string }[] }>("/api/esg/org?type=subsidiaries&light=1");
  const unitsApi = useApi<{ businessUnits: { id: string; name: string; subsidiaryId: string }[] }>("/api/esg/org?type=business-units");
  const projectsApi = useApi<{ projects: { id: string; name: string; businessUnitId: string }[] }>("/api/esg/org?type=projects");
  const usersApi = useApi<{ users: { id: string; name: string; role: string; status: string }[] }>("/api/esg/users");

  const initialStatus = typeof params.statusFilter === "string" ? params.statusFilter : "ALL";
  const [statusTab, setStatusTab] = useState<string>(initialStatus);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [subFilter, setSubFilter] = useState("ALL");
  const [quarterFilter, setQuarterFilter] = useState("ALL");
  const [dueFilter, setDueFilter] = useState("ALL");

  const [createOpen, setCreateOpen] = useState(false);
  const createMut = useMutation<{ submission: { ref: string } }>();
  const [form, setForm] = useState({
    title: "",
    category: "ENVIRONMENT",
    metricName: "",
    metricValue: "",
    metricUnit: "",
    subsidiaryId: "ALL",
    businessUnitId: "ALL",
    projectId: "ALL",
    submittedById: "NONE",
    dueDate: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (autoCreate) setCreateOpen(true);
  }, [autoCreate]);

  useEffect(() => {
    if (typeof params.statusFilter === "string") setStatusTab(params.statusFilter);
  }, [params.statusFilter]);

  const all = listApi.data?.submissions ?? [];

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: all.length, OVERDUE: all.filter((s) => s.overdue).length };
    for (const st of SUBMISSION_STATUSES) c[st] = all.filter((s) => s.status === st).length;
    return c;
  }, [all]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    const day = 86400000;
    return all.filter((s) => {
      if (statusTab === "OVERDUE") { if (!s.overdue) return false; }
      else if (statusTab !== "ALL" && s.status !== statusTab) return false;
      if (q && !`${s.ref} ${s.title} ${s.metricName} ${s.submittedByName ?? ""}`.toLowerCase().includes(q)) return false;
      if (categoryFilter !== "ALL" && s.category !== categoryFilter) return false;
      if (subFilter !== "ALL" && s.subsidiaryId !== subFilter) return false;
      if (quarterFilter !== "ALL" && s.fiscalQuarter !== quarterFilter) return false;
      if (dueFilter === "OVERDUE" && !s.overdue) return false;
      if (dueFilter === "DUE_SOON") {
        const t = new Date(s.dueDate).getTime() - now;
        if (s.overdue || t <= 0 || t > 7 * day) return false;
      }
      if (dueFilter === "NEXT30") {
        const t = new Date(s.dueDate).getTime() - now;
        if (t <= 0 || t > 30 * day) return false;
      }
      return true;
    });
  }, [all, statusTab, search, categoryFilter, subFilter, quarterFilter, dueFilter]);

  const resetFilters = () => {
    setSearch("");
    setCategoryFilter("ALL");
    setSubFilter("ALL");
    setQuarterFilter("ALL");
    setDueFilter("ALL");
  };

  const openCreate = () => {
    setFormErrors({});
    setForm({
      title: "",
      category: "ENVIRONMENT",
      metricName: "",
      metricValue: "",
      metricUnit: "",
      subsidiaryId: "ALL",
      businessUnitId: "ALL",
      projectId: "ALL",
      submittedById: "NONE",
      dueDate: "",
    });
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    const e: Record<string, string> = {};
    if (form.title.trim().length < 3) e.title = "Title must be at least 3 characters.";
    if (form.dueDate) {
      const d = new Date(form.dueDate);
      if (Number.isNaN(d.getTime())) e.dueDate = "Enter a valid date.";
    }
    setFormErrors(e);
    if (Object.keys(e).length) return;
    const res = await createMut.run(() =>
      apiPost<{ submission: { ref: string } }>("/api/esg/submissions", {
        action: "create",
        title: form.title.trim(),
        category: form.category,
        metricName: form.metricName,
        metricValue: form.metricValue,
        metricUnit: form.metricUnit,
        subsidiaryId: form.subsidiaryId === "ALL" ? "" : form.subsidiaryId,
        businessUnitId: form.businessUnitId === "ALL" ? "" : form.businessUnitId,
        projectId: form.projectId === "ALL" ? "" : form.projectId,
        submittedById: form.submittedById === "NONE" ? "" : form.submittedById,
        dueDate: form.dueDate || undefined,
      })
    );
    if (res) {
      toast({ title: "Submission created", description: `${res.submission.ref} — "${form.title.trim()}" entered the register as SUBMITTED.` });
      setCreateOpen(false);
      await listApi.refetch();
    } else {
      toast({ title: "Create failed", description: createMut.error ?? "Server rejected the submission.", variant: "destructive" });
    }
  };

  if (detailId) return <SubmissionDetail id={detailId} />;

  const columns: Column<Submission>[] = [
    {
      key: "ref",
      header: "Ref",
      sortable: true,
      sortValue: (s) => s.ref,
      render: (s) => <Chip tone="gray" className="font-mono">{s.ref}</Chip>,
    },
    {
      key: "title",
      header: "Title",
      sortable: true,
      sortValue: (s) => s.title,
      render: (s) => (
        <div className="min-w-0">
          <div className="max-w-[260px] truncate font-medium text-[color:var(--ink)]">{s.title}</div>
          <Chip tone="teal" className="mt-0.5">{CATEGORY_LABELS[s.category] ?? s.category}</Chip>
        </div>
      ),
    },
    {
      key: "responsible",
      header: "Responsible",
      render: (s) => (
        <div className="flex items-center gap-2">
          <Avatar name={s.submittedByName ?? "Unassigned"} size={28} />
          <div className="min-w-0">
            <div className="max-w-[140px] truncate text-[13px] font-medium text-[color:var(--ink)]">{s.submittedByName ?? "Unassigned"}</div>
            {s.submittedByRole && <div className="max-w-[140px] truncate text-[11px] text-[color:var(--ink-faint)]">{ROLE_LABELS[s.submittedByRole] ?? s.submittedByRole}</div>}
          </div>
        </div>
      ),
    },
    {
      key: "org",
      header: "Organization",
      render: (s) => (
        <span className="text-xs">
          {s.subsidiaryName ?? "Group"}
          {s.businessUnitName ? <span className="text-[color:var(--ink-faint)]"> › {s.businessUnitName}</span> : null}
          {s.projectName ? <span className="text-[color:var(--ink-faint)]"> › {s.projectName}</span> : null}
        </span>
      ),
    },
    {
      key: "metric",
      header: "Metric",
      render: (s) => (
        <span className="tabular text-xs">
          {s.metricName ? <span className="font-medium text-[color:var(--ink)]">{fmtNumber(s.metricValue, 2)}</span> : "—"}{" "}
          <span className="text-[color:var(--ink-faint)]">{s.metricUnit}</span>
        </span>
      ),
    },
    {
      key: "due",
      header: "Due",
      sortable: true,
      sortValue: (s) => s.dueDate,
      render: (s) => <span className={cn("text-xs", s.overdue && "font-semibold text-[#a53b3b]")}>{fmtDate(s.dueDate)}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortValue: (s) => s.status,
      render: (s) => (
        <span className="flex flex-wrap items-center gap-1">
          <StatusBadge status={s.status} />
          {s.overdue && <Chip tone="red">Overdue</Chip>}
        </span>
      ),
    },
    {
      key: "updated",
      header: "Last updated",
      render: (s) => <span className="text-xs">{timeAgo(lastTouched(s))}</span>,
    },
  ];

  return (
    <div className="view-in space-y-5">
      <PageHeader
        title="Submission Center"
        description="Central register of all ESG data submissions across the group — filter, review, and act."
        icon={ClipboardList}
        breadcrumbs={["Group", "ESG Operations", "Submission Center"]}
        actions={
          <>
            <ExportButton filename="meil-submissions" rows={filtered.map(csvSubmissionRow)} />
            <ActionButton onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" /> New submission
            </ActionButton>
          </>
        }
      />

      <GlassTabBar
        value={statusTab}
        onChange={setStatusTab}
        className="w-fit max-w-full"
        tabs={[
          { value: "ALL", label: "All", count: counts.ALL },
          { value: "DRAFT", label: "Draft", count: counts.DRAFT },
          { value: "ASSIGNED", label: "Assigned", count: counts.ASSIGNED },
          { value: "SUBMITTED", label: "Submitted", count: counts.SUBMITTED },
          { value: "UNDER_REVIEW", label: "Under Review", count: counts.UNDER_REVIEW },
          { value: "CHANGES_REQUESTED", label: "Changes Requested", count: counts.CHANGES_REQUESTED },
          { value: "REJECTED", label: "Rejected", count: counts.REJECTED },
          { value: "APPROVED", label: "Approved", count: counts.APPROVED },
          { value: "OVERDUE", label: "Overdue", count: counts.OVERDUE },
        ]}
      />

      <DataTable<Submission>
        columns={columns}
        rows={filtered}
        loading={listApi.loading}
        error={listApi.error}
        onRetry={() => void listApi.refetch()}
        pageSize={10}
        onRowClick={(s) => openDetail("submissions", s.id, "overview")}
        emptyTitle={statusTab === "OVERDUE" ? "Nothing is overdue" : "No submissions match your filters"}
        emptyMessage="Adjust the search or filters, or create a new submission record."
        emptyAction={<Button variant="outline" className="glass-subtle rounded-2xl" onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" /> New submission</Button>}
        toolbar={
          <Toolbar
            search={search}
            onSearch={setSearch}
            searchPlaceholder="Search ref, title, metric, or user…"
            resultCount={filtered.length}
            onReset={resetFilters}
            filters={[
              {
                key: "category",
                label: "Category",
                value: categoryFilter,
                onChange: setCategoryFilter,
                options: [{ value: "ALL", label: "All categories" }, ...CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] ?? c }))],
              },
              {
                key: "sub",
                label: "Subsidiary",
                value: subFilter,
                onChange: setSubFilter,
                options: [{ value: "ALL", label: "All subsidiaries" }, ...(subsApi.data?.subsidiaries ?? []).map((s) => ({ value: s.id, label: s.name }))],
              },
              {
                key: "quarter",
                label: "Quarter",
                value: quarterFilter,
                onChange: setQuarterFilter,
                options: [
                  { value: "ALL", label: "All quarters" },
                  { value: "Q1", label: "Q1" },
                  { value: "Q2", label: "Q2" },
                  { value: "Q3", label: "Q3" },
                  { value: "Q4", label: "Q4" },
                ],
              },
              {
                key: "due",
                label: "Due",
                value: dueFilter,
                onChange: setDueFilter,
                options: [
                  { value: "ALL", label: "Any due date" },
                  { value: "OVERDUE", label: "Overdue" },
                  { value: "DUE_SOON", label: "Due in 7 days" },
                  { value: "NEXT30", label: "Due in 30 days" },
                ],
              },
            ]}
          />
        }
        mobileCard={(s) => (
          <GlassCard subtle className="p-3">
            <div className="flex items-center justify-between gap-2">
              <Chip tone="gray" className="font-mono">{s.ref}</Chip>
              <StatusBadge status={s.status} />
            </div>
            <div className="mt-1.5 text-sm font-medium text-[color:var(--ink)]">{s.title}</div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Chip tone="teal">{CATEGORY_LABELS[s.category] ?? s.category}</Chip>
              {s.overdue && <Chip tone="red">Overdue</Chip>}
              <span className="text-xs text-[color:var(--ink-faint)]">Due {fmtDate(s.dueDate)}</span>
            </div>
          </GlassCard>
        )}
      />

      {/* Create dialog */}
      <GlassDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="New submission"
        description="Create a submission record on behalf of a responsible user. It enters the register as SUBMITTED."
        wide
        footer={
          <>
            <Button variant="outline" className="glass-subtle rounded-2xl" onClick={() => setCreateOpen(false)} disabled={createMut.pending}>Cancel</Button>
            <ActionButton pending={createMut.pending} onClick={() => void submitCreate()}>Create submission</ActionButton>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" required error={formErrors.title}>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="glass-subtle rounded-2xl border-white/60" placeholder="e.g. Q2 Scope 1 emissions — Chennai site" />
          </Field>
          <Field label="Category">
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger className="glass-subtle rounded-2xl border-white/60"><SelectValue /></SelectTrigger>
              <SelectContent className="glass-strong rounded-2xl border-white/70">
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Metric name">
            <Input value={form.metricName} onChange={(e) => setForm({ ...form, metricName: e.target.value })} className="glass-subtle rounded-2xl border-white/60" placeholder="e.g. Scope 1 emissions" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Metric value">
              <Input type="number" value={form.metricValue} onChange={(e) => setForm({ ...form, metricValue: e.target.value })} className="glass-subtle rounded-2xl border-white/60" placeholder="0" />
            </Field>
            <Field label="Unit">
              <Input value={form.metricUnit} onChange={(e) => setForm({ ...form, metricUnit: e.target.value })} className="glass-subtle rounded-2xl border-white/60" placeholder="tCO2e" />
            </Field>
          </div>
          <Field label="Subsidiary">
            <Select value={form.subsidiaryId} onValueChange={(v) => setForm({ ...form, subsidiaryId: v, businessUnitId: "ALL", projectId: "ALL" })}>
              <SelectTrigger className="glass-subtle rounded-2xl border-white/60"><SelectValue placeholder="Select subsidiary" /></SelectTrigger>
              <SelectContent className="glass-strong rounded-2xl border-white/70">
                <SelectItem value="ALL">Group level</SelectItem>
                {(subsApi.data?.subsidiaries ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Business unit" hint="Filtered by subsidiary.">
            <Select value={form.businessUnitId} onValueChange={(v) => setForm({ ...form, businessUnitId: v, projectId: "ALL" })}>
              <SelectTrigger className="glass-subtle rounded-2xl border-white/60"><SelectValue placeholder="Select business unit" /></SelectTrigger>
              <SelectContent className="glass-strong rounded-2xl border-white/70">
                <SelectItem value="ALL">None</SelectItem>
                {(unitsApi.data?.businessUnits ?? [])
                  .filter((b) => form.subsidiaryId === "ALL" || b.subsidiaryId === form.subsidiaryId)
                  .map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Project / Site" hint="Filtered by business unit.">
            <Select value={form.projectId} onValueChange={(v) => setForm({ ...form, projectId: v })}>
              <SelectTrigger className="glass-subtle rounded-2xl border-white/60"><SelectValue placeholder="Select project" /></SelectTrigger>
              <SelectContent className="glass-strong rounded-2xl border-white/70">
                <SelectItem value="ALL">None</SelectItem>
                {(projectsApi.data?.projects ?? [])
                  .filter((p) => form.businessUnitId === "ALL" || p.businessUnitId === form.businessUnitId)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Responsible user" hint="Attribution for this record.">
            <Select value={form.submittedById} onValueChange={(v) => setForm({ ...form, submittedById: v })}>
              <SelectTrigger className="glass-subtle rounded-2xl border-white/60"><SelectValue placeholder="Optional" /></SelectTrigger>
              <SelectContent className="glass-strong rounded-2xl border-white/70">
                <SelectItem value="NONE">Unassigned</SelectItem>
                {(usersApi.data?.users ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name} — {ROLE_LABELS[u.role] ?? u.role}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Due date" error={formErrors.dueDate} hint="Defaults to 14 days from creation when empty.">
            <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="glass-subtle rounded-2xl border-white/60" />
          </Field>
        </div>
      </GlassDialog>
    </div>
  );
}

function lastTouched(s: Submission): string | null {
  return s.history.length ? s.history[s.history.length - 1].at : s.submittedAt;
}
