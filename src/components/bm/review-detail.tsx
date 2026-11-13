"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   MEIL BU Manager — REPORT REVIEW WORKSPACE (ESG Review Studio).

   Three-zone desktop composition:
     · Left  zone  — report navigation (project + period context, validation
       issue count, evidence indicators, section shortcuts)
     · Center zone — ESG reporting sections (data values table, supporting
       calculations, reviewer comments, resubmission comparison)
     · Right zone  — review panel (review status, available review actions,
       review activity, evidence preview)
   On narrower screens the left + right zones collapse into the dialog's
   stacked layout (the dialog body scrolls; the decision footer stays fixed
   at the bottom).

   Review actions (all backend-backed by /api/bm/submissions/[id]/decision):
     · Approve → ConfirmDialog summarising report + version, optional comment,
       persist decision + audit, advance workflow, cross-console notify.
     · Return for correction → mandatory reason ≥10 + mandatory actionable
       instructions ≥10 + optional affected-field list. Confirm before
       submission. Status → CHANGES_REQUESTED. bmNotify fires on all 5 consoles.
     · Reject → mandatory reason ≥10 chars. Confirm. Persist decision + actor
       + timestamp + version + reason. Status → REJECTED. Cross-console notify.

   Every decision POST carries `expectedUpdatedAt` so the backend can refuse
   stale decisions with 409. The resubmission comparison view shows when the
   history contains a "Returned for correction" + "Resubmitted" pair — the
   prior period value (recorded in the values table) is rendered next to the
   current reported value.
   ═══════════════════════════════════════════════════════════════════════════ */

import * as React from "react";
import {
  AlertTriangle, ArrowLeftRight, CheckCircle2, Download, FileText,
  GitCompareArrows, MessageSquare, ShieldCheck, Sparkles, XCircle, Eye,
} from "lucide-react";
import { Ring } from '@/components/ring'
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MultiEvidenceGallery, type MultiEvidenceDoc } from "@/components/shared/multi-evidence-gallery";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Chip, ConfirmDialog, EmptyState, ErrorState, GlassTabBar, InfoRow, LoadingBlock,
} from "@/components/workspace/ui";
import { apiGet, apiPost, fmtDate, fmtDateTime, fmtNumber, timeAgo, useMutation } from "@/lib/bm/client";
import type { EvidenceRow, BmSubmissionDetail } from "@/lib/bm/types";
import { EvidenceChip, StatusChip, UrgencyChip, fmtMetric, severityTone } from "@/components/bm/shared";

type DetailResponse = { submission: BmSubmissionDetail; updatedAt: string; version: number; consolidatedChildren?: Array<{ id: string; title: string; category: string; status: string }> };

const REVIEW_ELIGIBLE = ["SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED"];

export function ReportReviewWorkspace({
  submissionId,
  open,
  onOpenChange,
  onDecided,
  startTab,
}: {
  submissionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDecided?: (action: "approve" | "reject" | "return") => void;
  startTab?: string;
}) {
  const { toast } = useToast();
  const [detail, setDetail] = React.useState<DetailResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState(startTab ?? "report");
  const [evidence, setEvidence] = React.useState<EvidenceRow[] | null>(null);
  const [evidenceLoading, setEvidenceLoading] = React.useState(false);
  const [galleryDocs, setGalleryDocs] = React.useState<MultiEvidenceDoc[] | null>(null);
  const [activeDoc, setActiveDoc] = React.useState<EvidenceRow | null>(null);
  const [docReceipt, setDocReceipt] = React.useState<string | null>(null);
  const [docLoading, setDocLoading] = React.useState(false);
  const [approveOpen, setApproveOpen] = React.useState(false);
  const [returnOpen, setReturnOpen] = React.useState(false);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState("");
  const [rejectInstructions, setRejectInstructions] = React.useState("");
  const [rejectFields, setRejectFields] = React.useState("");
  const [compareOpen, setCompareOpen] = React.useState(false);
  const decision = useMutation<{ message: string; decision: { action: string; version: number } }>();

  // Return-for-correction form state
  const [returnReason, setReturnReason] = React.useState("");
  const [returnInstructions, setReturnInstructions] = React.useState("");
  const [returnFields, setReturnFields] = React.useState("");
  /* GRANULAR RETURN — when reviewing a consolidated dossier the BU may send
     back ONE disclosure instead of the whole package ("entire" = whole). */
  const [returnTarget, setReturnTarget] = React.useState<string>("entire");

  const sub = detail?.submission ?? null;
  const eligible = !!sub && (
    REVIEW_ELIGIBLE.includes(sub.status) ||
    sub.status === "BU_APPROVED" ||
    ((sub.status === "APPROVED" || sub.status === "BU_REVIEW_PENDING") && (sub.forwardedToBu || (sub as any).inConsolidatedReport))
  );

  /* Load report detail. */
  React.useEffect(() => {
    if (!open || !submissionId) {
      setDetail(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setTab(startTab ?? "report");
    apiGet<DetailResponse>(`/api/bm/submissions/${submissionId}`)
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load report"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, submissionId, startTab]);

  /* Load evidence lazily when the Evidence tab opens. */
  React.useEffect(() => {
    if (!open || !sub || tab !== "evidence") return;
    let cancelled = false;
    setEvidenceLoading(true);
    apiGet<{ docs: EvidenceRow[] }>(`/api/bm/evidence?submissionRef=${encodeURIComponent(sub.ref)}&pageSize=50`)
      .then((d) => { if (!cancelled) setEvidence(d.docs); })
      .catch(() => { if (!cancelled) setEvidence([]); })
      .finally(() => { if (!cancelled) setEvidenceLoading(false); });
    return () => { cancelled = true; };
  }, [open, sub, tab]);

  /* Reset decision dialog state when closed. */
  React.useEffect(() => {
    if (!rejectOpen) {
      setRejectReason("");
      setRejectInstructions("");
      setRejectFields("");
    }
    if (!returnOpen) {
      setReturnReason("");
      setReturnInstructions("");
      setReturnFields("");
      setReturnTarget("entire");
      }
  }, [rejectOpen, returnOpen]);

  const returnReasonValid = returnReason.trim().length >= 10;
  const returnInstructionsValid = returnInstructions.trim().length >= 10;

  const decide = async (
    action: "approve" | "reject" | "return",
    body: { reason?: string; instructions?: string; affectedFields?: string[]; targetSubmissionId?: string }
  ) => {
    if (!detail) return;
    try {
      const result = await decision.run(() =>
        apiPost<{ message: string; decision: { action: string; version: number } }>(
          `/api/bm/submissions/${detail.submission.id}/decision`,
          {
            action,
            reason: body.reason ?? "",
            instructions: body.instructions ?? "",
            affectedFields: body.affectedFields ?? [],
            ...(body.targetSubmissionId && body.targetSubmissionId !== "entire" ? { targetSubmissionId: body.targetSubmissionId } : {}),
            expectedUpdatedAt: detail.updatedAt, // stale-version guard
          }
        )
      );
      if (result) {
        toast({
          title:
            action === "approve" ? "Report approved"
              : action === "reject" ? "Report rejected"
                : "Report returned for correction",
          description: result.message,
        });
        setApproveOpen(false);
        setReturnOpen(false);
        setRejectOpen(false);
        onOpenChange(false);
        onDecided?.(action);
      } else {
        toast({
          title: "Decision not recorded",
          description: decision.error || "Failed to submit review decision",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Decision not recorded",
        description: err?.message || "Failed to submit review decision",
        variant: "destructive",
      });
    }
  };

  const downloadDoc = async (doc: EvidenceRow) => {
    setDocLoading(true);
    setDocReceipt(null);
    try {
      const res = await fetch(`/api/bm/evidence/${doc.id}/download`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const ctype = res.headers.get("Content-Type") ?? "";
      if (ctype.includes("application/json")) {
        const r = (await res.json()) as { receipt: { name: string; access: string } };
        setDocReceipt(`${r.receipt.name} — ${r.receipt.access}`);
      } else {
        /* Original bytes — save as a file download. */
        const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? doc.name;
        const url = URL.createObjectURL(await res.blob());
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        setDocReceipt(`${name} — original file downloaded`);
      }
    } catch (e) {
      setDocReceipt(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDocLoading(false);
    }
  };

  const warnings = sub?.validationIssues.filter((v) => v.status !== "RESOLVED" && v.status !== "WAIVED") ?? [];
  const evidenceCount = sub?.evidenceCount ?? 0;
  const isResubmission = sub?.isResubmission ?? false;
  const priorValue = sub?.values.find((v) => /prior/i.test(v.label));
  const reportedValue = sub?.values.find((v) => /reported|current/i.test(v.label));

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => {
        if (!o && (approveOpen || returnOpen || rejectOpen)) return; // decision dialogs stay on top
        onOpenChange(o);
      }}>
        <DialogContent
          className="glass-strong glass-sheen fixed inset-0 m-auto flex h-[90vh] max-h-[90vh] max-h-[90dvh] w-full max-w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden rounded-3xl border-white/80 p-0 shadow-2xl sm:max-w-6xl"
          style={{ transform: "none", translate: "none", margin: "auto" }}
        >
          {/* Header */}
          <DialogHeader className="glass-sheen shrink-0 border-b border-[rgba(139,92,246,0.18)] bg-white/50 px-5 py-4">
            <DialogTitle className="flex flex-wrap items-center gap-2 text-base leading-snug text-[color:var(--ink)]">
              {sub ? (
                <>
                  <span className="font-bold text-[color:var(--bum-purple-deep)]">{sub.ref}</span>
                  <span className="text-[color:var(--ink-soft)]">— {sub.title}</span>
                  <StatusChip status={sub.status} />
                  {isResubmission && <Chip tone="purple">Resubmission</Chip>}
                  {sub.overdue && sub.status !== "APPROVED" && <Chip tone="red">Overdue</Chip>}
                </>
              ) : (
                <span className="text-[color:var(--ink-faint)]">Report review</span>
              )}
            </DialogTitle>
            <DialogDescription className="text-[12.5px] text-[color:var(--ink-faint)]">
              {sub ? `${sub.level === "PROJECT" ? "Project report" : "BU-level report"} · ${sub.period} · ${sub.fiscalQuarter} · v${detail?.version ?? 1}` : "Loading the report context…"}
            </DialogDescription>
          </DialogHeader>

          {/* Body — three-zone on desktop, stacked on mobile */}
          <div className="nice-scroll flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4">
            {loading && <LoadingBlock rows={6} label="Loading the full report…" />}
            {error && !loading && <ErrorState message={error} onRetry={() => window.location.reload()} />}
            {sub && !loading && (
              <div className="space-y-4">
                {/* Report header summary */}
                <div className="glass-subtle rounded-2xl p-3.5">
                  <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-4">
                    <InfoRow label="Business unit">{sub.buName ?? "—"}</InfoRow>
                    <InfoRow label={sub.level === "PROJECT" ? "Project / site" : "Level"}>
                      {sub.level === "PROJECT" ? sub.projectName ?? "—" : "Business-unit level"}
                    </InfoRow>
                    <InfoRow label="Category">{sub.category}</InfoRow>
                    <InfoRow label="Submitted by">{sub.submittedByName || sub.history?.find((h) => /submit/i.test(h.action))?.actor || "Project User"}</InfoRow>
                    {sub.forwardedByName ? (
                      <InfoRow label="Forwarded by (PA)">{sub.forwardedByName} (Project Admin)</InfoRow>
                    ) : (sub.forwardedToBu || (sub as any).inConsolidatedReport) ? (
                      <InfoRow label="Forwarded by (PA)">Project Admin</InfoRow>
                    ) : null}
                    <InfoRow label="Submitted">{fmtDateTime(sub.forwardedToBuAt || sub.submittedAt || sub.lastUpdated)}</InfoRow>
                    <InfoRow label="Report due">{fmtDate(sub.dueDate)}</InfoRow>
                    <InfoRow label="Review deadline">
                      <span>{fmtDate(sub.reviewDeadline)}</span>{" "}
                      <span className="text-[11px] text-[color:var(--ink-faint)]">({sub.reviewDeadlineLabel})</span>
                    </InfoRow>
                    <InfoRow label="Reviewer on record">{sub.reviewerName ?? "Not yet decided"}</InfoRow>
                  </div>
                </div>

                <GlassTabBar
                  value={tab}
                  onChange={setTab}
                  tabs={[
                    { value: "report", label: "Report" },
                    { value: "validation", label: `Validation${warnings.length ? ` (${warnings.length})` : ""}` },
                    { value: "evidence", label: `Evidence (${evidenceCount})` },
                    { value: "history", label: "History & comments" },
                  ]}
                />

                {/* ── REPORT tab — three-zone composition ── */}
                {tab === "report" && (
                  <div className="grid gap-3 lg:grid-cols-12">
                    {/* Left zone — navigation / context */}
                    <aside className="lg:col-span-3">
                      <div className="space-y-2">
                        <div className="glass-subtle rounded-2xl p-3">
                          <div className="text-[10.5px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">Reporting context</div>
                          <div className="mt-1.5 text-[12.5px] font-semibold text-[color:var(--ink)]">{sub.metricName || sub.title}</div>
                          <div className="mt-1 text-[11px] text-[color:var(--ink-faint)]">{sub.category} · {sub.fiscalQuarter}</div>
                        </div>
                        <div className="glass-subtle rounded-2xl p-3">
                          <div className="text-[10.5px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">Quality indicators</div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {warnings.length > 0
                              ? <Chip tone="amber">{warnings.length} validation warning{warnings.length > 1 ? "s" : ""}</Chip>
                              : <Chip tone="green">Validation clear</Chip>}
                            <EvidenceChip count={evidenceCount} />
                            <UrgencyChip days={sub.daysRemaining} />
                          </div>
                        </div>
                        <div className="glass-subtle rounded-2xl p-3">
                          <div className="text-[10.5px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">Sections</div>
                          <nav className="mt-1.5 space-y-0.5 text-[12px]">
                            <button onClick={() => setTab("report")} className="block w-full rounded-lg px-2 py-1 text-left text-[color:var(--ink-soft)] hover:bg-white/70">Reported metric</button>
                            <button onClick={() => setTab("report")} className="block w-full rounded-lg px-2 py-1 text-left text-[color:var(--ink-soft)] hover:bg-white/70">Data values</button>
                            <button onClick={() => setTab("validation")} className="block w-full rounded-lg px-2 py-1 text-left text-[color:var(--ink-soft)] hover:bg-white/70">Validation issues</button>
                            <button onClick={() => setTab("evidence")} className="block w-full rounded-lg px-2 py-1 text-left text-[color:var(--ink-soft)] hover:bg-white/70">Supporting evidence</button>
                            <button onClick={() => setTab("history")} className="block w-full rounded-lg px-2 py-1 text-left text-[color:var(--ink-soft)] hover:bg-white/70">Review history</button>
                          </nav>
                        </div>
                      </div>
                    </aside>

                    {/* Center zone — ESG reporting content */}
                    <section className="lg:col-span-6">
                      <div className="space-y-3">
                        <div className="glass-subtle flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
                          <div>
                            <div className="text-[10.5px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">Reported metric</div>
                            <div className="mt-0.5 text-[14px] font-semibold text-[color:var(--ink)]">{sub.metricName || sub.title}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[24px] font-bold tabular leading-none text-[color:var(--bum-purple-deep)]">{fmtMetric(sub.metricValue)}</div>
                            <div className="text-[11px] font-medium text-[color:var(--ink-faint)]">{sub.metricUnit || "units"}</div>
                          </div>
                        </div>

                        {isResubmission && priorValue && reportedValue && (
                          <button
                            onClick={() => setCompareOpen((v) => !v)}
                            className="glass-subtle flex w-full items-center justify-between gap-2 rounded-2xl p-3 text-left transition-colors hover:bg-white/80"
                          >
                            <span className="flex items-center gap-2 text-[12px] font-semibold text-[color:var(--bum-purple-deep)]">
                              <GitCompareArrows className="h-4 w-4" />
                              Compare with previous version
                            </span>
                            <Chip tone="purple">Resubmission</Chip>
                          </button>
                        )}
                        {compareOpen && priorValue && reportedValue && (
                          <div className="glass-subtle rounded-2xl p-3">
                            <div className="grid grid-cols-2 gap-2 text-center">
                              <div>
                                <div className="text-[10.5px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">Previous</div>
                                <div className="text-[18px] font-bold tabular text-[color:var(--ink-soft)]">{fmtMetric(priorValue.value)}</div>
                                <div className="text-[10.5px] text-[color:var(--ink-faint)]">{priorValue.unit}</div>
                              </div>
                              <div>
                                <div className="text-[10.5px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">Current</div>
                                <div className="text-[18px] font-bold tabular text-[color:var(--bum-purple-deep)]">{fmtMetric(reportedValue.value)}</div>
                                <div className="text-[10.5px] text-[color:var(--ink-faint)]">{reportedValue.unit}</div>
                              </div>
                            </div>
                            {(() => {
                              const diff = reportedValue.value - priorValue.value;
                              const pct = priorValue.value !== 0 ? Math.round((diff / Math.abs(priorValue.value)) * 100) : 0;
                              return (
                                <p className="mt-2 text-center text-[11px] text-[color:var(--ink-soft)]">
                                  Change: <span className={diff >= 0 ? "text-[#0e6b50]" : "text-[#a02a36]"}>{diff >= 0 ? "+" : ""}{fmtNumber(diff, 2)} ({pct >= 0 ? "+" : ""}{pct}%)</span>
                                </p>
                              );
                            })()}
                          </div>
                        )}

                        {sub.values.length > 0 ? (
                          <div className="overflow-hidden rounded-2xl border border-[rgba(139,92,246,0.18)]">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-white/60 [&>th]:border-b [&>th]:border-[rgba(139,92,246,0.2)] [&>th]:px-4 [&>th]:py-2.5 [&>th]:text-left [&>th]:text-[11px] [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-wide [&>th]:text-[color:var(--ink-faint)]">
                                  <th>Data value</th>
                                  <th className="text-right">Value</th>
                                  <th className="text-right">Unit</th>
                                </tr>
                              </thead>
                              <tbody>
                                {sub.values.map((v, i) => (
                                  <tr key={`${v.label}-${i}`} className="border-b border-[rgba(139,92,246,0.12)] last:border-0">
                                    <td className="px-4 py-2.5 text-[color:var(--ink-soft)]">{v.label}</td>
                                    <td className="px-4 py-2.5 text-right font-semibold tabular text-[color:var(--ink)]">{fmtMetric(v.value)}</td>
                                    <td className="px-4 py-2.5 text-right text-[color:var(--ink-faint)]">{v.unit}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <EmptyState title="No data values recorded" message="The submitter filed only the headline metric for this report." icon={FileText} />
                        )}

                        {sub.comments.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">
                              <MessageSquare className="h-3.5 w-3.5" /> Reviewer comments
                            </div>
                            {sub.comments.map((c, i) => (
                              <div key={i} className="glass-subtle rounded-2xl p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[12.5px] font-semibold text-[color:var(--ink)]">
                                    {c.author} <span className="font-normal text-[color:var(--ink-faint)]">· {c.role.replace(/_/g, " ").toLowerCase()}</span>
                                  </span>
                                  <span className="text-[10.5px] text-[color:var(--ink-faint)]">{fmtDateTime(c.at)}</span>
                                </div>
                                <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-[color:var(--ink-soft)]">{c.text}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </section>

                    {/* Right zone — review panel */}
                    <aside className="lg:col-span-3">
                      <div className="space-y-2">
                        <div className="glass-subtle rounded-2xl p-3">
                          <div className="text-[10.5px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">Review status</div>
                          <div className="mt-1.5"><StatusChip status={sub.status} /></div>
                          <div className="mt-2 text-[11px] text-[color:var(--ink-soft)]">
                            {sub.status === "APPROVED" && sub.forwardedToBu
                              ? "Forwarded by the Project Admin as approved — awaiting your BU sign-off."
                              : sub.status === "APPROVED"
                                ? "Approved — eligible for subsidiary consolidation."
                                : sub.status === "BU_APPROVED"
                                  ? "Signed off by the Business Unit — eligible for subsidiary consolidation."
                                  : sub.status === "REJECTED"
                                    ? "Rejected — awaiting correction by the responsible user."
                                    : sub.status === "CHANGES_REQUESTED"
                                      ? "Returned for correction — the responsible user has been notified."
                                      : "Awaiting your review decision."}
                          </div>
                        </div>
                        <div className="glass-subtle rounded-2xl p-3">
                          <div className="text-[10.5px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">Quality checks</div>
                          <div className="mt-1.5 space-y-1.5 text-[12px]">
                            <div className="flex items-center justify-between">
                              <span className="text-[color:var(--ink-soft)]">Data values</span>
                              <Chip tone={sub.values.length > 0 ? "green" : "amber"}>{sub.values.length}</Chip>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[color:var(--ink-soft)]">Evidence docs</span>
                              <EvidenceChip count={evidenceCount} />
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[color:var(--ink-soft)]">Validation warnings</span>
                              <Chip tone={warnings.length === 0 ? "green" : "amber"}>{warnings.length}</Chip>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[color:var(--ink-soft)]">Headline metric</span>
                              <Chip tone={sub.metricValue ? "green" : "amber"}>{sub.metricValue ? "Present" : "Missing"}</Chip>
                            </div>
                          </div>
                        </div>
                        {sub.history.length > 0 && (
                          <div className="glass-subtle rounded-2xl p-3">
                            <div className="text-[10.5px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">Recent activity</div>
                            <div className="mt-1.5 space-y-1.5">
                              {sub.history.slice(-3).reverse().map((h, i) => (
                                <div key={i} className="text-[11.5px]">
                                  <div className="font-medium text-[color:var(--ink-soft)]">{h.action}</div>
                                  <div className="text-[10.5px] text-[color:var(--ink-faint)]">{timeAgo(h.at)}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </aside>
                  </div>
                )}

                {/* ── VALIDATION tab ── */}
                {tab === "validation" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                      {[
                        { label: "Data values", value: sub.values.length, ok: sub.values.length > 0 },
                        { label: "Evidence docs", value: evidenceCount, ok: evidenceCount > 0 },
                        { label: "Warnings", value: warnings.length, ok: warnings.length === 0 },
                        { label: "Headline metric", value: sub.metricValue ? 1 : 0, ok: !!sub.metricValue },
                      ].map((c) => (
                        <div key={c.label} className="glass-subtle rounded-2xl p-3 text-center">
                          <div className={`text-[18px] font-bold tabular ${c.ok ? "text-[#0e6b50]" : "text-[#9c5d1b]"}`}>{c.value}</div>
                          <div className="text-[10.5px] font-medium text-[color:var(--ink-faint)]">{c.label}</div>
                        </div>
                      ))}
                    </div>
                    {sub.validationIssues.length === 0 ? (
                      <EmptyState
                        title="No validation issues on this report"
                        message="Automated checks found no missing fields, duplicates or calculation exceptions."
                        icon={ShieldCheck}
                      />
                    ) : (
                      sub.validationIssues.map((v) => (
                        <div key={v.ref} className="glass-subtle flex items-start justify-between gap-3 rounded-2xl p-3.5">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Chip tone={severityTone(v.severity)}>{v.severity}</Chip>
                              <span className="text-[12px] font-medium text-[color:var(--ink-faint)]">{v.ref}</span>
                            </div>
                            <p className="mt-1.5 text-[13px] text-[color:var(--ink-soft)]">{v.description}</p>
                          </div>
                          <Chip tone={v.status === "RESOLVED" || v.status === "WAIVED" ? "green" : "amber"}>{v.status}</Chip>
                        </div>
                      ))
                    )}
                    <p className="text-[11.5px] leading-relaxed text-[color:var(--ink-faint)]">
                      Passing validation does not imply approval — the decision is always yours to make explicitly. The BU Manager cannot alter submitted values; corrections follow the configured workflow and preserve revision history.
                    </p>
                  </div>
                )}

                {/* ── EVIDENCE tab (in-context drawer) ── */}
                {tab === "evidence" && (
                  <div className="space-y-3">
                    {evidenceLoading && <LoadingBlock rows={3} label="Loading evidence…" />}
                    {!evidenceLoading && (evidence ?? []).length === 0 && (
                      <EmptyState
                        title="No evidence attached"
                        message="This report has no supporting documents in the repository. Returning it for correction may be appropriate if evidence is mandatory."
                        icon={AlertTriangle}
                      />
                    )}
                    {!evidenceLoading && (evidence ?? []).length > 1 && (
                      <div className="flex items-center justify-between p-3 rounded-2xl bg-white/70 border border-white/60">
                        <div className="text-xs font-bold text-[color:var(--ink)]">
                          {(evidence ?? []).length} supporting documents attached
                        </div>
                        <Button
                          size="sm"
                          onClick={() => setGalleryDocs((evidence ?? []).map((doc) => ({
                            id: doc.id,
                            fileName: doc.name,
                            fileSize: doc.sizeKb ? doc.sizeKb * 1024 : undefined,
                            documentType: doc.fileType,
                            status: doc.status,
                            previewUrl: `/api/bm/evidence/${doc.id}/download?inline=1`,
                            downloadUrl: `/api/bm/evidence/${doc.id}/download`,
                            uploadedAt: doc.uploadedAt,
                            uploaderName: doc.uploadedBy,
                          })))}
                          className="h-8 rounded-xl bg-[color:var(--bum-purple)] text-white hover:opacity-95"
                        >
                          <Eye className="mr-1.5 h-3.5 w-3.5" /> View All ({(evidence ?? []).length})
                        </Button>
                      </div>
                    )}
                    {!evidenceLoading && (evidence ?? []).map((doc) => (
                      <div key={doc.id} className="glass-subtle rounded-2xl p-3.5">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-[13px] font-semibold text-[color:var(--ink)]">{doc.name}</div>
                            <div className="mt-0.5 text-[11.5px] text-[color:var(--ink-faint)]">
                              {doc.fileType} · {doc.hasFile ?? doc.sizeKb > 0 ? `${fmtNumber(doc.sizeKb)} KB · original file · download` : "metadata only"} · v{doc.version} · uploaded {timeAgo(doc.uploadedAt)} by {doc.uploadedBy}
                            </div>
                            {doc.disclosureRef && <div className="mt-0.5 text-[11px] text-[color:var(--ink-faint)]">Disclosure: {doc.disclosureRef}</div>}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Chip tone={doc.status === "VALID" ? "green" : doc.status === "EXPIRED" ? "red" : "amber"}>{doc.status}</Chip>
                            <Button variant="outline" size="sm" className="glass-subtle h-8 rounded-xl" onClick={() => { setActiveDoc(doc); void downloadDoc(doc); }} disabled={docLoading}>
                              {docLoading && activeDoc?.id === doc.id ? <Ring className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
                              <span className="ml-1.5">Download</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {docReceipt && (
                      <p className="rounded-2xl bg-[rgba(22,166,122,0.08)] px-3 py-2 text-[11.5px] text-[#0e6b50]" role="status">{docReceipt}</p>
                    )}
                  </div>
                )}

                {/* ── HISTORY tab ── */}
                {tab === "history" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">Workflow timeline</div>
                      {sub.history.length === 0 && <EmptyState title="No history recorded" icon={FileText} />}
                      {sub.history.map((h, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[color:var(--bum-purple)]" />
                          <div className="min-w-0 flex-1 border-b border-[rgba(139,92,246,0.14)] pb-2.5">
                            <div className="flex flex-wrap items-center justify-between gap-1">
                              <span className="text-[12.5px] font-medium text-[color:var(--ink)]">{h.action}</span>
                              <span className="text-[10.5px] text-[color:var(--ink-faint)]">{fmtDateTime(h.at)}</span>
                            </div>
                            {h.note && <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-[color:var(--ink-soft)]">{h.note}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer — review actions */}
          <DialogFooter className="glass-sheen shrink-0 border-t border-[rgba(139,92,246,0.18)] bg-white/60 px-5 py-3.5">
            {eligible && sub ? (
              <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-[color:var(--ink-faint)]">
                  <span className="font-semibold uppercase tracking-wide">Review checks:</span>
                  {warnings.length > 0 ? <Chip tone="amber">{warnings.length} validation warning{warnings.length > 1 ? "s" : ""}</Chip> : <Chip tone="green">Validation clear</Chip>}
                  <EvidenceChip count={evidenceCount} />
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={decision.pending}
                    className="rounded-2xl border-[rgba(139,92,246,0.4)] text-[color:var(--bum-purple-deep)] hover:bg-[rgba(139,92,246,0.06)] cursor-pointer"
                    onClick={() => setReturnOpen(true)}
                  >
                    <ArrowLeftRight className="mr-1.5 h-4 w-4" />
                    Return for correction…
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={decision.pending}
                    className="rounded-2xl border-[rgba(195,74,74,0.4)] text-[#a53b3b] hover:bg-[rgba(195,74,74,0.06)] cursor-pointer"
                    onClick={() => setRejectOpen(true)}
                  >
                    <XCircle className="mr-1.5 h-4 w-4" />
                    Reject…
                  </Button>
                  <Button
                    type="button"
                    disabled={decision.pending}
                    className="btn-bum-action rounded-2xl cursor-pointer"
                    onClick={() => setApproveOpen(true)}
                  >
                    {decision.pending ? <Ring className="mr-1.5 h-4 w-4" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
                    {sub.status === "BU_APPROVED" ? "Approved (BU Sign-off)" : "Approve"}
                  </Button>
                </div>
              </div>
            ) : sub ? (
              <div className="flex w-full items-center justify-between gap-2">
                <span className="text-[12px] text-[color:var(--ink-faint)]">
                  {sub.status === "BU_APPROVED" || (sub.status === "APPROVED" && !sub.forwardedToBu && !(sub as any).inConsolidatedReport)
                    ? "This report has been approved by BU Manager — eligible for subsidiary consolidation."
                    : (sub.status === "APPROVED" || sub.status === "BU_REVIEW_PENDING") && (sub.forwardedToBu || (sub as any).inConsolidatedReport)
                      ? "This report was forwarded by Project Admin and is awaiting your BU sign-off."
                      : "This report is outside the review stage — decisions are only available while it awaits review."}
                </span>
                <Button variant="outline" className="glass-subtle rounded-2xl cursor-pointer" onClick={() => onOpenChange(false)}>Close</Button>
              </div>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Approve confirmation ── */}
      <ConfirmDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        title="Confirm approval"
        confirmLabel="Confirm approval"
        pending={decision.pending}
        message={
          sub
            ? `Approve ${sub.ref} — ${sub.title} (${sub.level === "PROJECT" ? sub.projectName : sub.buName ?? ""}, ${sub.period})? The responsible user, the BU Admin and the Subsidiary Manager will be notified, and the report becomes eligible for subsidiary consolidation.`
            : ""
        }
        onConfirm={(reason) => void decide("approve", { reason })}
      />

      {/* ── Return-for-correction dialog (mandatory reason + mandatory instructions) ── */}
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent
          className="glass-strong fixed inset-0 m-auto z-[70] max-h-[88vh] overflow-y-auto rounded-3xl border-white/80 nice-scroll sm:max-w-xl"
          style={{ transform: "none", translate: "none", margin: "auto" }}
        >
          <DialogHeader>
            <DialogTitle className="text-base text-[color:var(--ink)]">Return {sub?.ref ?? ""} for correction</DialogTitle>
            <DialogDescription className="text-[12.5px] text-[color:var(--ink-faint)]">
              The report returns to the responsible user with a clear correction note. A meaningful reason and actionable instructions are mandatory.
            </DialogDescription>
          </DialogHeader>
          {sub && (
            <div className="space-y-3.5">
              <div className="glass-subtle rounded-2xl p-3 text-[12.5px] text-[color:var(--ink-soft)]">
                <span className="font-semibold text-[color:var(--ink)]">{sub.ref} — {sub.title}</span>
                {" "}· {sub.level === "PROJECT" ? sub.projectName : sub.buName} · {sub.period} · submitted by {sub.submittedByName ?? "—"}
              </div>
              {detail?.consolidatedChildren && detail.consolidatedChildren.length > 0 && (
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-[color:var(--ink)]" htmlFor="return-target">
                    What should go back for correction?
                  </label>
                  <select
                    id="return-target"
                    value={returnTarget}
                    onChange={(e) => setReturnTarget(e.target.value)}
                    className="glass-subtle w-full rounded-2xl border-white/60 bg-white/80 px-3 py-2.5 text-[13px] font-medium text-[color:var(--ink)]"
                  >
                    <option value="entire">Entire consolidated report</option>
                    {detail.consolidatedChildren.map((c) => (
                      <option key={c.id} value={c.id}>{c.category} — {c.title}</option>
                    ))}
                  </select>
                  {returnTarget !== "entire" && (
                    <p className="mt-1 text-xs font-medium text-[color:var(--bum-purple-deep)]">
                      Only this disclosure moves to CHANGES_REQUESTED — the rest of the consolidated report stays under review.
                    </p>
                  )}
                </div>
              )}
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[color:var(--ink)]" htmlFor="return-reason">
                  Reason for return <span className="text-[#c34a4a]">*</span>
                </label>
                <Textarea
                  id="return-reason"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  rows={3}
                  placeholder="Explain what is incorrect, incomplete or inadequately supported (min 10 characters)…"
                  className="glass-subtle rounded-2xl border-white/60"
                />
                {returnReason.length > 0 && !returnReasonValid && (
                  <p className="mt-1 text-xs font-medium text-[#c34a4a]" role="alert">Reason must be at least 10 characters — empty returns are blocked.</p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[color:var(--ink)]" htmlFor="return-instructions">
                  Correction instructions <span className="text-[#c34a4a]">*</span>
                </label>
                <Textarea
                  id="return-instructions"
                  value={returnInstructions}
                  onChange={(e) => setReturnInstructions(e.target.value)}
                  rows={3}
                  placeholder="Specific actionable steps the responsible user should take to correct the report (min 10 characters)…"
                  className="glass-subtle rounded-2xl border-white/60"
                />
                {returnInstructions.length > 0 && !returnInstructionsValid && (
                  <p className="mt-1 text-xs font-medium text-[#c34a4a]" role="alert">Instructions must be at least 10 characters.</p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[color:var(--ink)]" htmlFor="return-fields">
                  Affected fields / evidence <span className="text-[color:var(--ink-faint)]">(optional)</span>
                </label>
                <Input
                  id="return-fields"
                  value={returnFields}
                  onChange={(e) => setReturnFields(e.target.value)}
                  placeholder="e.g. I-REC statement, unit conversion, Q2 meter log"
                  className="glass-subtle rounded-2xl border-white/60"
                />
              </div>
              <div className="flex items-start gap-2 rounded-2xl bg-[rgba(139,92,246,0.06)] p-3 text-[11.5px] leading-relaxed text-[color:var(--bum-purple-deep)]">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {returnTarget === "entire"
                  ? "The current version, evidence and reviewer comments are preserved. The report moves to CHANGES_REQUESTED and the responsible user is notified with your reason + instructions."
                  : "Only the selected disclosure moves to CHANGES_REQUESTED with your reason + instructions — the consolidated report itself stays in the review queue for the remaining disclosures."}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            <span className="text-[11.5px] text-[color:var(--ink-faint)]">
              {returnReasonValid && returnInstructionsValid ? "Ready to record the decision" : "Reason and instructions must each be ≥ 10 characters"}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="glass-subtle rounded-2xl" onClick={() => setReturnOpen(false)} disabled={decision.pending}>Cancel</Button>
              <Button
                className="btn-bum-action rounded-2xl"
                disabled={!returnReasonValid || !returnInstructionsValid || decision.pending}
                onClick={() => {
                  const fields = returnFields.trim()
                    ? returnFields.split(",").map((f) => f.trim()).filter(Boolean)
                    : [];
                  void decide("return", {
                    reason: returnReason.trim(),
                    instructions: returnInstructions.trim(),
                    affectedFields: fields,
                    targetSubmissionId: returnTarget,
                  });
                }}
              >
                {decision.pending && <Ring className="mr-1.5 h-4 w-4" />}
                Confirm return for correction
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reject dialog (mandatory reason) ── */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent
          className="glass-strong fixed inset-0 m-auto z-[70] max-h-[88vh] overflow-y-auto rounded-3xl border-white/80 nice-scroll sm:max-w-xl"
          style={{ transform: "none", translate: "none", margin: "auto" }}
        >
          <DialogHeader>
            <DialogTitle className="text-base text-[color:var(--ink)]">Reject {sub?.ref ?? ""}</DialogTitle>
            <DialogDescription className="text-[12.5px] text-[color:var(--ink-faint)]">
              The report is rejected and returned to the responsible user. A meaningful reason is mandatory — empty rejections are blocked server-side.
            </DialogDescription>
          </DialogHeader>
          {sub && (
            <div className="space-y-3.5">
              <div className="glass-subtle rounded-2xl p-3 text-[12.5px] text-[color:var(--ink-soft)]">
                <span className="font-semibold text-[color:var(--ink)]">{sub.ref} — {sub.title}</span>
                {" "}· {sub.level === "PROJECT" ? sub.projectName : sub.buName} · {sub.period} · submitted by {sub.submittedByName ?? "—"}
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[color:var(--ink)]" htmlFor="reject-reason">
                  Rejection reason <span className="text-[#c34a4a]">*</span>
                </label>
                <Textarea
                  id="reject-reason"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder="Explain what is incorrect, incomplete or inadequately supported (min 10 characters)…"
                  className="glass-subtle rounded-2xl border-white/60"
                />
                {rejectReason.length > 0 && rejectReason.trim().length < 10 && (
                  <p className="mt-1 text-xs font-medium text-[#c34a4a]" role="alert">Reason must be at least 10 characters — empty rejections are blocked.</p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[color:var(--ink)]" htmlFor="reject-instructions">
                  Correction instructions <span className="text-[color:var(--ink-faint)]">(optional)</span>
                </label>
                <Textarea
                  id="reject-instructions"
                  value={rejectInstructions}
                  onChange={(e) => setRejectInstructions(e.target.value)}
                  rows={2}
                  placeholder="Specific steps the responsible user should take to correct the report…"
                  className="glass-subtle rounded-2xl border-white/60"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[color:var(--ink)]" htmlFor="reject-fields">
                  Affected fields / evidence <span className="text-[color:var(--ink-faint)]">(optional)</span>
                </label>
                <Input
                  id="reject-fields"
                  value={rejectFields}
                  onChange={(e) => setRejectFields(e.target.value)}
                  placeholder="e.g. I-REC statement, unit conversion, Q2 meter log"
                  className="glass-subtle rounded-2xl border-white/60"
                />
              </div>
              <div className="flex items-start gap-2 rounded-2xl bg-[rgba(195,74,74,0.06)] p-3 text-[11.5px] leading-relaxed text-[#a53b3b]">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                The rejected version and its evidence are preserved. The report returns to the correction workflow — the responsible user and the BU Admin will be notified with your reason.
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            <span className="text-[11.5px] text-[color:var(--ink-faint)]">
              {rejectReason.trim().length >= 10 ? "Ready to record the decision" : "Reason must be at least 10 characters"}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="glass-subtle rounded-2xl" onClick={() => setRejectOpen(false)} disabled={decision.pending}>Cancel</Button>
              <Button
                variant="destructive"
                className="rounded-2xl"
                disabled={rejectReason.trim().length < 10 || decision.pending}
                onClick={() => {
                  const fields = rejectFields.trim()
                    ? rejectFields.split(",").map((f) => f.trim()).filter(Boolean)
                    : [];
                  void decide("reject", {
                    reason: rejectReason.trim(),
                    instructions: rejectInstructions.trim(),
                    affectedFields: fields,
                  });
                }}
              >
                {decision.pending && <Ring className="mr-1.5 h-4 w-4" />}
                Confirm rejection
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Multi Evidence Gallery Modal (View all attached documents at once in sequence) */}
      {galleryDocs && (
        <MultiEvidenceGallery
          documents={galleryDocs}
          title={`${sub?.title || "Report"} — Evidence Verification Gallery`}
          subtitle="All attached documents in sequence — inspect proofs side-by-side or scroll together"
          onClose={() => setGalleryDocs(null)}
        />
      )}
    </>
  );
}
