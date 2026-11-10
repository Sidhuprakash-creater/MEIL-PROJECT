"use client";

// ── SCREEN 10 — Review & Approvals (ESG Operations) ──
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Download,
  FileCheck2,
  FileText,
  Layers,
  ListChecks,
  MessageSquare,
  Undo2,
  UserCheck,
} from "lucide-react";
import { Ring } from '@/components/ring'
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, type Submission } from "@/lib/esg/types";
import { apiPost, downloadFile, fmtDate, fmtDateTime, fmtNumber, timeAgo, toCsv, useApi, useMutation } from "@/lib/esg/client";
import { useWorkspace } from "@/lib/esg/store";
import {
  Avatar,
  Chip,
  ConfirmDialog,
  DataTable,
  EmptyState,
  GlassCard,
  GlassDialog,
  GlassTabBar,
  InfoRow,
  KpiCard,
  LoadingBlock,
  PageHeader,
  SectionCard,
  StatusBadge,
  Toolbar,
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

type ReviewAction = "approve" | "reject" | "request_changes" | "return" | "reopen";

interface ReviewResponse {
  results: { id: string; ok: boolean; error?: string }[];
  success: boolean;
  message: string;
}

const ACTION_TITLES: Record<ReviewAction, string> = {
  approve: "Approve",
  reject: "Reject",
  request_changes: "Request changes",
  return: "Return to submitter",
  reopen: "Reopen",
};

/* ─────────────────────────── Review detail (two-panel) ─────────────────────────── */

function ReviewDetail({ id }: { id: string }) {
  const { navigate } = useWorkspace();
  const { toast } = useToast();
  const detailApi = useApi<{ submission: Submission }>(`/api/esg/submissions?id=${id}`, [id]);
  const reviewMut = useMutation<ReviewResponse>();

  const [dialog, setDialog] = useState<ReviewAction | null>(null);
  const [comment, setComment] = useState("");

  const s = detailApi.data?.submission ?? null;

  const runReview = async (action: ReviewAction, reason?: string, approveComment?: string) => {
    if (!s) return;
    setDialog(null);
    const res = await reviewMut.run(() =>
      apiPost<ReviewResponse>("/api/esg/submissions", { action, id: s.id, reason, comment: approveComment })
    );
    if (res) {
      if (res.success) toast({ title: `${ACTION_TITLES[action]} — decision recorded`, description: res.message });
      else toast({ title: "Partially failed", description: res.message, variant: "destructive" });
      setComment("");
      await detailApi.refetch();
    } else {
      toast({ title: "Action failed", description: reviewMut.error ?? "Server rejected the decision.", variant: "destructive" });
    }
  };

  if (detailApi.loading) {
    return (
      <div className="view-in space-y-5">
        <GlassCard><LoadingBlock rows={8} label="Loading review packet…" /></GlassCard>
      </div>
    );
  }
  if (detailApi.error || !s) {
    return (
      <div className="view-in space-y-5">
        <Button variant="ghost" size="sm" className="-ml-2 rounded-2xl text-[color:var(--ink-soft)]" onClick={() => navigate("approvals")}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Review & Approvals
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

  const evidencePresent = s.evidence.length > 0;
  const valuesPresent = s.values.length > 0 || !!s.metricName;
  const canAct = !["DRAFT", "ASSIGNED"].includes(s.status);
  const canReopen = ["APPROVED", "REJECTED"].includes(s.status);
  const checklist = [
    { label: "Supporting evidence attached", ok: evidencePresent, note: evidencePresent ? `${s.evidence.length} file${s.evidence.length === 1 ? "" : "s"}` : "No documents provided" },
    { label: "Reported values present", ok: valuesPresent, note: valuesPresent ? `${s.values.length || 1} value${(s.values.length || 1) === 1 ? "" : "s"}` : "No values reported" },
    { label: "Reviewer comments", ok: s.comments.length > 0, note: s.comments.length ? `${s.comments.length} comment${s.comments.length === 1 ? "" : "s"}` : "No comments yet" },
    { label: "Due date adherence", ok: !s.overdue, note: s.overdue ? "Submitted past due date" : "Within deadline" },
  ];

  return (
    <div className="view-in space-y-5">
      <Button variant="ghost" size="sm" className="-ml-2 rounded-2xl text-[color:var(--ink-soft)]" onClick={() => navigate("approvals")}>
        <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Review & Approvals
      </Button>

      <div className="grid gap-5 xl:grid-cols-3">
        {/* Left: report review */}
        <div className="space-y-5 xl:col-span-2">
          <SectionCard title="Submission metadata" icon={ClipboardList}>
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="blue" className="font-mono">{s.ref}</Chip>
              <StatusBadge status={s.status} />
              {s.overdue && <Chip tone="red">Overdue</Chip>}
            </div>
            <h2 className="mt-2 text-lg font-semibold text-[color:var(--ink)]">{s.title}</h2>
            <p className="mt-0.5 text-xs text-[color:var(--ink-faint)]">
              {[s.subsidiaryName, s.businessUnitName, s.projectName].filter(Boolean).join("  ›  ") || "Group level"}
            </p>
            <div className="mt-3 divide-y divide-[rgba(125,177,216,0.18)]">
              <InfoRow label="Category">{CATEGORY_LABELS[s.category] ?? s.category}</InfoRow>
              <InfoRow label="Period">{s.period || "—"} {s.fiscalQuarter ? `· ${s.fiscalQuarter}` : ""}</InfoRow>
              <InfoRow label="Submitted by">
                <span className="inline-flex items-center gap-1.5">
                  <Avatar name={s.submittedByName ?? "Unassigned"} size={20} />
                  {s.submittedByName ?? "Unassigned"}
                  {s.submittedByRole ? ` · ${ROLE_LABELS[s.submittedByRole] ?? s.submittedByRole}` : ""}
                </span>
              </InfoRow>
              <InfoRow label="Due date"><span className={cn(s.overdue && "font-semibold text-[#a53b3b]")}>{fmtDate(s.dueDate)}</span></InfoRow>
              <InfoRow label="Submitted at">{s.submittedAt ? fmtDateTime(s.submittedAt) : "—"}</InfoRow>
              <InfoRow label="Reviewer">{s.reviewerName ?? "Not yet assigned"}</InfoRow>
            </div>
          </SectionCard>

          <SectionCard title="Reported values" icon={Layers} noPad>
            {s.values.length === 0 && !s.metricName ? (
              <EmptyState title="No values reported" message="The submitter has not reported any quantitative values." />
            ) : (
              <div className="nice-scroll max-h-72 overflow-y-auto">
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 bg-white/75 backdrop-blur-md [&>tr>th]:border-b [&>tr>th]:border-[rgba(125,177,216,0.35)] [&>tr>th]:px-5 [&>tr>th]:py-3 [&>tr>th]:text-left [&>tr>th]:text-[11px] [&>tr>th]:font-semibold [&>tr>th]:uppercase [&>tr>th]:tracking-wide [&>tr>th]:text-[color:var(--ink-faint)]">
                    <tr><th>Label</th><th className="text-right">Value</th><th className="text-right">Unit</th></tr>
                  </thead>
                  <tbody>
                    {s.values.length === 0 ? (
                      <tr>
                        <td className="px-5 py-3 text-[color:var(--ink)]">{s.metricName || "Headline metric"}</td>
                        <td className="tabular px-5 py-3 text-right font-medium text-[color:var(--ink)]">{fmtNumber(s.metricValue, 2)}</td>
                        <td className="px-5 py-3 text-right text-[color:var(--ink-soft)]">{s.metricUnit}</td>
                      </tr>
                    ) : (
                      s.values.map((v, i) => (
                        <tr key={i} className="border-b border-[rgba(125,177,216,0.16)] last:border-0">
                          <td className="px-5 py-3 text-[color:var(--ink)]">{v.label}</td>
                          <td className="tabular px-5 py-3 text-right font-medium text-[color:var(--ink)]">{fmtNumber(v.value, 2)}</td>
                          <td className="px-5 py-3 text-right text-[color:var(--ink-soft)]">{v.unit}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Supporting evidence" icon={FileText} noPad>
            {s.evidence.length === 0 ? (
              <EmptyState title="No evidence attached" message="Review without supporting documents — flag this in your decision note if needed." />
            ) : (
              <div className="divide-y divide-[rgba(125,177,216,0.18)]">
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

          <SectionCard title="Validation checklist" icon={ListChecks} description="Quick pre-decision checks compiled from the record.">
            <div className="flex flex-col gap-2">
              {checklist.map((c) => (
                <div key={c.label} className="flex items-center justify-between gap-3 rounded-2xl bg-white/40 px-3.5 py-2.5">
                  <span className="inline-flex items-center gap-2 text-[13px] font-medium text-[color:var(--ink)]">
                    <span className={cn("flex h-5 w-5 items-center justify-center rounded-full", c.ok ? "bg-[rgba(35,134,83,0.14)]" : "bg-[rgba(195,74,74,0.12)]")}>
                      {c.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-[#1d6b40]" /> : <span className="h-2 w-2 rounded-full bg-[#c34a4a]" />}
                    </span>
                    {c.label}
                  </span>
                  <span className={cn("text-xs", c.ok ? "text-[color:var(--ink-faint)]" : "font-medium text-[#a53b3b]")}>{c.note}</span>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Comments thread" icon={MessageSquare} noPad>
            {s.comments.length === 0 ? (
              <EmptyState title="No comments yet" message="Recorded review decisions will attach their notes here." />
            ) : (
              <div className="nice-scroll max-h-72 overflow-y-auto divide-y divide-[rgba(125,177,216,0.18)]">
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
          </SectionCard>

          <SectionCard title="History timeline" icon={Undo2} noPad>
            {s.history.length === 0 ? (
              <EmptyState title="No history" message="No workflow events recorded yet." />
            ) : (
              <div className="p-5">
                <ol className="relative space-y-4 border-l border-[rgba(125,177,216,0.35)] pl-5">
                  {[...s.history].reverse().map((h, i) => (
                    <li key={i} className="relative">
                      <span className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full bg-[#3a7bff] ring-4 ring-white/60" />
                      <div className="text-sm font-medium text-[color:var(--ink)]">{h.action}</div>
                      <div className="mt-0.5 text-xs text-[color:var(--ink-faint)]">{h.actor} · {fmtDateTime(h.at)}</div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </SectionCard>
        </div>

        {/* Right: sticky action panel */}
        <div className="xl:col-span-1">
          <div className="xl:sticky xl:top-6">
            <SectionCard title="Decision panel" icon={UserCheck} description="Record your review decision with full audit attribution.">
              {!canAct ? (
                <p className="text-sm text-[color:var(--ink-soft)]">
                  {s.status === "DRAFT"
                    ? "This record is a draft — review actions unlock once it is submitted."
                    : "This record is assigned but not yet submitted for review."}
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  <Button className="rounded-2xl" disabled={reviewMut.pending} onClick={() => { setComment(""); setDialog("approve"); }}>
                    {reviewMut.pending ? <Ring className="mr-1.5 h-4 w-4" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />} Approve
                  </Button>
                  <Button variant="outline" className="glass-subtle rounded-2xl border-white/60" disabled={reviewMut.pending} onClick={() => { setComment(""); setDialog("request_changes"); }}>
                    Request changes
                  </Button>
                  <Button variant="outline" className="glass-subtle rounded-2xl border-white/60" disabled={reviewMut.pending} onClick={() => { setComment(""); setDialog("reject"); }}>
                    Reject
                  </Button>
                  <Button variant="outline" className="glass-subtle rounded-2xl border-white/60" disabled={reviewMut.pending} onClick={() => { setComment(""); setDialog("return"); }}>
                    Return to submitter
                  </Button>
                  {canReopen && (
                    <Button variant="outline" className="glass-subtle rounded-2xl border-white/60" disabled={reviewMut.pending} onClick={() => { setComment(""); setDialog("reopen"); }}>
                      Reopen review
                    </Button>
                  )}
                  <p className="mt-2 rounded-2xl bg-[rgba(35,134,83,0.08)] px-3 py-2.5 text-[12px] leading-relaxed text-[#1d6b40]">
                    Approved submissions become eligible for BRSR consolidation. This does not finalize any BRSR report.
                  </p>
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      </div>

      {/* Approve dialog with optional note */}
      <GlassDialog
        open={dialog === "approve"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Approve ${s?.ref ?? ""}`}
        description="Approved submissions become eligible for BRSR consolidation. This does not finalize any BRSR report."
        footer={
          <>
            <Button variant="outline" className="glass-subtle rounded-2xl" onClick={() => setDialog(null)} disabled={reviewMut.pending}>Cancel</Button>
            <Button className="rounded-2xl" disabled={reviewMut.pending} onClick={() => void runReview("approve", undefined, comment || undefined)}>
              {reviewMut.pending && <Ring className="mr-1.5 h-4 w-4" />} Approve submission
            </Button>
          </>
        }
      >
        <label className="mb-1.5 block text-[13px] font-medium text-[color:var(--ink)]" htmlFor="approve-note">Approval note (optional)</label>
        <Textarea id="approve-note" value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="Optional note recorded with the approval…" className="glass-subtle rounded-2xl border-white/60" />
      </GlassDialog>

      <ConfirmDialog
        open={dialog === "reject"}
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
        open={dialog === "request_changes"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Request changes — ${s?.ref ?? ""}`}
        message="The record moves to Changes Requested and the submitter is asked to revise and resubmit."
        confirmLabel="Request changes"
        requireReason
        pending={reviewMut.pending}
        onConfirm={(reason) => void runReview("request_changes", reason)}
      />
      <ConfirmDialog
        open={dialog === "return"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Return ${s?.ref ?? ""}?`}
        message="The record returns to ASSIGNED so the responsible user can revise and resubmit it."
        confirmLabel="Return record"
        requireReason
        pending={reviewMut.pending}
        onConfirm={(reason) => void runReview("return", reason)}
      />
      <ConfirmDialog
        open={dialog === "reopen"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Reopen ${s?.ref ?? ""}?`}
        message="A closed decision is reopened for review. Use this to correct mistaken approvals or rejections."
        confirmLabel="Reopen review"
        requireReason
        pending={reviewMut.pending}
        onConfirm={(reason) => void runReview("reopen", reason)}
      />
    </div>
  );
}

/* ─────────────────────────── Queue view ─────────────────────────── */

export default function ApprovalsView() {
  const { params, openDetail } = useWorkspace();
  const { toast } = useToast();
  const detailId = typeof params.detailId === "string" ? params.detailId : undefined;

  const listApi = useApi<{ submissions: Submission[] }>("/api/esg/submissions");
  const subsApi = useApi<{ subsidiaries: { id: string; name: string }[] }>("/api/esg/org?type=subsidiaries&light=1");
  const bulkMut = useMutation<ReviewResponse>();

  const [tab, setTab] = useState("PENDING");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [subFilter, setSubFilter] = useState("ALL");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkApproveOpen, setBulkApproveOpen] = useState(false);

  const all = listApi.data?.submissions ?? [];

  const kpis = useMemo(() => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    return {
      awaiting: all.filter((s) => s.status === "SUBMITTED").length,
      underReview: all.filter((s) => s.status === "UNDER_REVIEW").length,
      changesRequested: all.filter((s) => s.status === "CHANGES_REQUESTED").length,
      approvedMtd: all.filter((s) => s.status === "APPROVED" && s.reviewedAt && new Date(s.reviewedAt).getTime() >= monthStart.getTime()).length,
    };
  }, [all]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((s) => {
      if (tab === "PENDING" && !["SUBMITTED", "UNDER_REVIEW"].includes(s.status)) return false;
      if (tab === "CHANGES_REQUESTED" && s.status !== "CHANGES_REQUESTED") return false;
      if (tab === "REJECTED" && s.status !== "REJECTED") return false;
      if (tab === "APPROVED" && s.status !== "APPROVED") return false;
      if (q && !`${s.ref} ${s.title} ${s.submittedByName ?? ""}`.toLowerCase().includes(q)) return false;
      if (categoryFilter !== "ALL" && s.category !== categoryFilter) return false;
      if (subFilter !== "ALL" && s.subsidiaryId !== subFilter) return false;
      return true;
    });
  }, [all, tab, search, categoryFilter, subFilter]);

  const resetFilters = () => {
    setSearch("");
    setCategoryFilter("ALL");
    setSubFilter("ALL");
  };

  const approveableIds = useMemo(
    () => all.filter((s) => selectedIds.includes(s.id) && ["SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED"].includes(s.status)).map((s) => s.id),
    [all, selectedIds]
  );

  const bulkApprove = async () => {
    setBulkApproveOpen(false);
    if (!approveableIds.length) {
      toast({ title: "Nothing to approve", description: "No selected submissions are awaiting a decision.", variant: "destructive" });
      return;
    }
    const res = await bulkMut.run(() => apiPost<ReviewResponse>("/api/esg/submissions", { action: "approve", ids: approveableIds }));
    if (res) {
      if (res.success) toast({ title: "Bulk approval complete", description: res.message });
      else toast({ title: "Partially failed", description: res.message, variant: "destructive" });
      setSelectedIds([]);
      await listApi.refetch();
    } else {
      toast({ title: "Bulk approval failed", description: bulkMut.error ?? "Server rejected the request.", variant: "destructive" });
    }
  };

  const exportSelected = () => {
    const rows = all.filter((s) => selectedIds.includes(s.id)).map((s) => ({
      Ref: s.ref,
      Title: s.title,
      Category: CATEGORY_LABELS[s.category] ?? s.category,
      Status: s.status,
      Subsidiary: s.subsidiaryName ?? "",
      SubmittedBy: s.submittedByName ?? "",
      Due: fmtDate(s.dueDate),
      Overdue: s.overdue ? "YES" : "NO",
    }));
    if (!rows.length) return;
    downloadFile("meil-approvals-selected.csv", toCsv(rows), "text/csv");
    toast({ title: "Export ready", description: `${rows.length} selected record${rows.length === 1 ? "" : "s"} exported to CSV.` });
  };

  if (detailId) return <ReviewDetail id={detailId} />;

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
          <div className="max-w-[280px] truncate font-medium text-[color:var(--ink)]">{s.title}</div>
          <Chip tone="teal" className="mt-0.5">{CATEGORY_LABELS[s.category] ?? s.category}</Chip>
        </div>
      ),
    },
    {
      key: "submittedBy",
      header: "Submitted by",
      render: (s) => (
        <div className="flex items-center gap-2">
          <Avatar name={s.submittedByName ?? "Unassigned"} size={26} />
          <span className="max-w-[150px] truncate text-[13px]">{s.submittedByName ?? "Unassigned"}</span>
        </div>
      ),
    },
    { key: "org", header: "Org", render: (s) => <span className="text-xs">{s.subsidiaryName ?? "Group"}</span> },
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
  ];

  return (
    <div className="view-in space-y-5">
      <PageHeader
        title="Review & Approvals"
        description="Review queue for submitted ESG data — approve, request changes, reject, return, or reopen with full audit attribution."
        icon={FileCheck2}
        breadcrumbs={["Group", "ESG Operations", "Review & Approvals"]}
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Submitted — awaiting review" value={kpis.awaiting} icon={ClipboardList} tone="blue" />
        <KpiCard label="Under review" value={kpis.underReview} icon={ListChecks} tone="purple" />
        <KpiCard label="Changes requested" value={kpis.changesRequested} icon={MessageSquare} tone="amber" />
        <KpiCard label="Approved this month" value={kpis.approvedMtd} icon={CheckCircle2} tone="green" />
      </div>

      <GlassTabBar
        value={tab}
        onChange={setTab}
        className="w-fit max-w-full"
        tabs={[
          { value: "PENDING", label: "Pending", count: all.filter((s) => ["SUBMITTED", "UNDER_REVIEW"].includes(s.status)).length },
          { value: "CHANGES_REQUESTED", label: "Changes requested", count: kpis.changesRequested },
          { value: "REJECTED", label: "Rejected", count: all.filter((s) => s.status === "REJECTED").length },
          { value: "APPROVED", label: "Approved", count: all.filter((s) => s.status === "APPROVED").length },
          { value: "ALL", label: "All", count: all.length },
        ]}
      />

      <DataTable<Submission>
        columns={columns}
        rows={filtered}
        loading={listApi.loading}
        error={listApi.error}
        onRetry={() => void listApi.refetch()}
        pageSize={10}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onRowClick={(s) => openDetail("approvals", s.id, "review")}
        emptyTitle="Queue is clear"
        emptyMessage="No submissions match this queue and filter combination."
        toolbar={
          <Toolbar
            search={search}
            onSearch={setSearch}
            searchPlaceholder="Search ref, title, or submitter…"
            resultCount={filtered.length}
            onReset={resetFilters}
            filters={[
              {
                key: "category",
                label: "Category",
                value: categoryFilter,
                onChange: setCategoryFilter,
                options: [{ value: "ALL", label: "All categories" }, ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }))],
              },
              {
                key: "sub",
                label: "Subsidiary",
                value: subFilter,
                onChange: setSubFilter,
                options: [{ value: "ALL", label: "All subsidiaries" }, ...(subsApi.data?.subsidiaries ?? []).map((s) => ({ value: s.id, label: s.name }))],
              },
            ]}
          />
        }
        rowActions={(s) => (
          <Button
            variant="outline"
            size="sm"
            className="glass-subtle h-8 rounded-2xl border-white/60"
            onClick={() => openDetail("approvals", s.id, "review")}
          >
            Review
          </Button>
        )}
        mobileCard={(s) => (
          <GlassCard subtle className="p-3">
            <div className="flex items-center justify-between gap-2">
              <Chip tone="gray" className="font-mono">{s.ref}</Chip>
              <StatusBadge status={s.status} />
            </div>
            <div className="mt-1.5 text-sm font-medium text-[color:var(--ink)]">{s.title}</div>
            <div className="mt-1 flex items-center justify-between text-xs text-[color:var(--ink-faint)]">
              <span>{s.submittedByName ?? "Unassigned"}</span>
              <span className={cn(s.overdue && "font-semibold text-[#a53b3b]")}>Due {fmtDate(s.dueDate)}</span>
            </div>
          </GlassCard>
        )}
      />

      <p className="text-xs text-[color:var(--ink-faint)]">
        Approving individual submissions does not approve the final BRSR report.
      </p>

      {/* Floating bulk action bar */}
      {selectedIds.length > 0 && (
        <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div className="glass-strong glass-sheen flex flex-wrap items-center gap-2 rounded-3xl border-white/70 px-4 py-3 shadow-xl">
            <span className="mr-1 text-sm font-medium text-[color:var(--ink)]">{selectedIds.length} selected</span>
            <Button size="sm" className="rounded-2xl" disabled={bulkMut.pending || !approveableIds.length} onClick={() => setBulkApproveOpen(true)}>
              {bulkMut.pending ? <Ring className="mr-1.5 h-3.5 w-3.5" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
              Approve selected{approveableIds.length !== selectedIds.length ? ` (${approveableIds.length} eligible)` : ""}
            </Button>
            <Button variant="outline" size="sm" className="glass-subtle rounded-2xl border-white/60" onClick={exportSelected}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export selected
            </Button>
            <Button variant="ghost" size="sm" className="rounded-2xl" onClick={() => setSelectedIds([])}>Clear</Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={bulkApproveOpen}
        onOpenChange={setBulkApproveOpen}
        title={`Approve ${approveableIds.length} submission${approveableIds.length === 1 ? "" : "s"}?`}
        message="Each selected record will be approved and its submitter notified. Only records currently awaiting review are eligible. Approving individual submissions does not approve the final BRSR report."
        confirmLabel="Approve selected"
        pending={bulkMut.pending}
        onConfirm={() => void bulkApprove()}
      />
    </div>
  );
}
