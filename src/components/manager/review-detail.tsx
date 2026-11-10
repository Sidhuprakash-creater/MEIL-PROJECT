"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   MEIL Subsidiary Manager — REPORT REVIEW EXPERIENCE (shared).

   One reusable review interface used by Review Queue, BU Reports, Project
   Reports and Corrections. Contains:
     · report header (identity, period, submitter, deadline, status, reviewer)
     · full submitted content (metric + data values + comments)
     · validation panel (issues + completeness summary)
     · evidence drawer — switch to documents WITHOUT losing review context
     · decision panel: Approve / Reject with explicit confirmation, mandatory
       rejection reason, correction instructions, server-side version guard
   ═══════════════════════════════════════════════════════════════════════════ */

import * as React from "react";
import { AlertTriangle, Download, FileText, MessageSquare, ShieldCheck } from "lucide-react";
import { Ring } from '@/components/ring'
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Chip, ConfirmDialog, EmptyState, ErrorState, GlassDialog, GlassTabBar, InfoRow, LoadingBlock,
} from "@/components/workspace/ui";
import { apiGet, apiPost, fmtDate, fmtDateTime, fmtNumber, timeAgo, useMutation } from "@/lib/sm/client";
import type { EvidenceRow, SmSubmissionDetail } from "@/lib/sm/types";
import { EvidenceChip, StatusChip, UrgencyChip, fmtMetric, severityTone } from "@/components/manager/shared";

type DetailResponse = { submission: SmSubmissionDetail; updatedAt: string; version: number };

const REVIEW_ELIGIBLE = ["SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED", "BU_APPROVED"];

export function ReportReviewDialog({
  submissionId,
  open,
  onOpenChange,
  onDecided,
  startTab,
}: {
  submissionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDecided?: (action: "approve" | "reject") => void;
  startTab?: string;
}) {
  const { toast } = useToast();
  const [detail, setDetail] = React.useState<DetailResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState(startTab ?? "report");
  const [evidence, setEvidence] = React.useState<EvidenceRow[] | null>(null);
  const [evidenceLoading, setEvidenceLoading] = React.useState(false);
  const [activeDoc, setActiveDoc] = React.useState<EvidenceRow | null>(null);
  const [docReceipt, setDocReceipt] = React.useState<string | null>(null);
  const [docLoading, setDocLoading] = React.useState(false);
  const [approveOpen, setApproveOpen] = React.useState(false);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState("");
  const [rejectInstructions, setRejectInstructions] = React.useState("");
  const [rejectFields, setRejectFields] = React.useState("");
  const decision = useMutation<{ message: string; decision: { action: string; version: number } }>();

  const sub = detail?.submission ?? null;
  const eligible = !!sub && REVIEW_ELIGIBLE.includes(sub.status);

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
    apiGet<DetailResponse>(`/api/sm/submissions/${submissionId}`)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load report");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, submissionId, startTab]);

  /* Load evidence list lazily when the Evidence tab (or drawer) opens. */
  React.useEffect(() => {
    if (!open || !sub || tab !== "evidence") return;
    let cancelled = false;
    setEvidenceLoading(true);
    apiGet<{ docs: EvidenceRow[] }>(`/api/sm/evidence?submissionRef=${encodeURIComponent(sub.ref)}&pageSize=50`)
      .then((d) => {
        if (!cancelled) setEvidence(d.docs);
      })
      .catch(() => {
        if (!cancelled) setEvidence([]);
      })
      .finally(() => {
        if (!cancelled) setEvidenceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, sub, tab]);

  /* Reset rejection dialog state when closed. */
  React.useEffect(() => {
    if (!rejectOpen) {
      setRejectReason("");
      setRejectInstructions("");
      setRejectFields("");
    }
  }, [rejectOpen]);

  const rejectReasonValid = rejectReason.trim().length >= 10;

  const decide = async (action: "approve" | "reject", reason?: string, instructions?: string) => {
    if (!detail) return;
    const fullInstructions = action === "reject"
      ? [instructions, rejectFields.trim() && `Affected fields/evidence: ${rejectFields.trim()}`].filter(Boolean).join("\n")
      : "";
    const result = await decision.run(() =>
      apiPost(`/api/sm/submissions/${detail.submission.id}/decision`, {
        action,
        reason: reason ?? "",
        instructions: fullInstructions,
        expectedUpdatedAt: detail.updatedAt, // stale-version guard
      })
    );
    if (result) {
      toast({
        title: action === "approve" ? "Report approved" : "Report rejected",
        description: result.message,
      });
      setApproveOpen(false);
      setRejectOpen(false);
      onOpenChange(false);
      onDecided?.(action);
    }
  };

  const downloadDoc = async (doc: EvidenceRow) => {
    setDocLoading(true);
    setDocReceipt(null);
    try {
      const r = await apiGet<{ receipt: { name: string; access: string } }>(`/api/sm/evidence/${doc.id}/download`);
      setDocReceipt(`${r.receipt.name} — ${r.receipt.access}`);
    } catch (e) {
      setDocReceipt(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDocLoading(false);
    }
  };

  const warnings = sub?.validationIssues.filter((v) => v.status !== "RESOLVED" && v.status !== "WAIVED") ?? [];
  const evidenceCount = sub?.evidenceCount ?? 0;

  return (
    <>
      <GlassDialog
        open={open}
        onOpenChange={(o) => {
          if (!o && (approveOpen || rejectOpen)) return; // decision dialogs stay on top
          onOpenChange(o);
        }}
        wide
        title={sub ? `${sub.ref} — ${sub.title}` : "Report review"}
        description={sub ? `${sub.level === "PROJECT" ? "Project report" : "BU report"} · ${sub.period} · ${sub.fiscalQuarter}` : undefined}
        footer={
          eligible && sub ? (
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-[color:var(--ink-faint)]">
                <span className="font-semibold uppercase tracking-wide">Review checks:</span>
                {warnings.length > 0 ? <Chip tone="amber">{warnings.length} validation warning{warnings.length > 1 ? "s" : ""}</Chip> : <Chip tone="green">Validation clear</Chip>}
                <EvidenceChip count={evidenceCount} />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="outline"
                  disabled={decision.pending}
                  className="rounded-2xl border-[rgba(195,74,74,0.4)] text-[#a53b3b] hover:bg-[rgba(195,74,74,0.06)]"
                  onClick={() => setRejectOpen(true)}
                >
                  Reject…
                </Button>
                <Button
                  disabled={decision.pending}
                  className="rounded-2xl bg-[#20a779] text-white hover:bg-[#168b65]"
                  onClick={() => setApproveOpen(true)}
                >
                  {decision.pending && <Ring className="mr-1.5 h-4 w-4" />}
                  Approve
                </Button>
              </div>
            </div>
          ) : sub ? (
            <div className="flex w-full items-center justify-between gap-2">
              <span className="text-[12px] text-[color:var(--ink-faint)]">
                {sub.status === "APPROVED" ? "This report is approved — it feeds subsidiary consolidation." : "This report is outside the review stage — decisions are only available while it awaits review."}
              </span>
              <Button variant="outline" className="glass-subtle rounded-2xl" onClick={() => onOpenChange(false)}>Close</Button>
            </div>
          ) : undefined
        }
      >
        {loading && <LoadingBlock rows={6} label="Loading the full report…" />}
        {error && !loading && <ErrorState message={error} onRetry={() => window.location.reload()} />}
        {sub && !loading && (
          <div className="space-y-4">
            {/* Report header */}
            <div className="glass-subtle rounded-2xl p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip status={sub.status} />
                {sub.isResubmission && <Chip tone="purple">Resubmission</Chip>}
                {sub.overdue && sub.status !== "APPROVED" && <Chip tone="red">Overdue</Chip>}
                <UrgencyChip days={sub.daysRemaining} />
              </div>
              <div className="mt-2.5 grid gap-x-6 sm:grid-cols-2">
                <InfoRow label="BU">{sub.buName ?? "—"}</InfoRow>
                <InfoRow label={sub.level === "PROJECT" ? "Project / site" : "Level"}>{sub.level === "PROJECT" ? sub.projectName ?? "—" : "Business-unit level"}</InfoRow>
                <InfoRow label="Category">{sub.category}</InfoRow>
                <InfoRow label="Reporting period">{sub.period} · {sub.fiscalQuarter}</InfoRow>
                <InfoRow label="Submitted by">{sub.submittedByName ?? "—"}</InfoRow>
                <InfoRow label="Submitted">{fmtDateTime(sub.submittedAt)}</InfoRow>
                <InfoRow label="Report due">{fmtDate(sub.dueDate)}</InfoRow>
                <InfoRow label="Review deadline">{fmtDate(sub.reviewDeadline)} <span className="text-[11px] font-normal text-[color:var(--ink-faint)]">({sub.reviewDeadlineLabel})</span></InfoRow>
                <InfoRow label="Reviewer on record">{sub.reviewerName ?? "Not yet decided"}</InfoRow>
                <InfoRow label="Version">{detail?.version ?? 1} (history entries)</InfoRow>
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

            {/* ── REPORT tab ── */}
            {tab === "report" && (
              <div className="space-y-4">
                <div className="glass-subtle flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">Reported metric</div>
                    <div className="mt-0.5 text-[14px] font-semibold text-[color:var(--ink)]">{sub.metricName || sub.title}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[22px] font-bold tabular leading-none text-[color:var(--ink)]">{fmtMetric(sub.metricValue)}</div>
                    <div className="text-[11px] font-medium text-[color:var(--ink-faint)]">{sub.metricUnit || "units"}</div>
                  </div>
                </div>

                {sub.values.length > 0 ? (
                  <div className="overflow-hidden rounded-2xl border border-[rgba(125,177,216,0.3)]">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-white/60 [&>th]:border-b [&>th]:border-[rgba(125,177,216,0.3)] [&>th]:px-4 [&>th]:py-2.5 [&>th]:text-left [&>th]:text-[11px] [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-wide [&>th]:text-[color:var(--ink-faint)]">
                          <th>Data value</th>
                          <th className="text-right">Value</th>
                          <th className="text-right">Unit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sub.values.map((v, i) => (
                          <tr key={`${v.label}-${i}`} className="border-b border-[rgba(125,177,216,0.16)] last:border-0">
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
                          <span className="text-[12.5px] font-semibold text-[color:var(--ink)]">{c.author} <span className="font-normal text-[color:var(--ink-faint)]">· {c.role.replace(/_/g, " ").toLowerCase()}</span></span>
                          <span className="text-[10.5px] text-[color:var(--ink-faint)]">{fmtDateTime(c.at)}</span>
                        </div>
                        <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-[color:var(--ink-soft)]">{c.text}</p>
                      </div>
                    ))}
                  </div>
                )}
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
                      <div className={`text-[18px] font-bold tabular ${c.ok ? "text-[#1d6b44]" : "text-[#9c5d1b]"}`}>{c.value}</div>
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
                  Passing validation does not imply approval — the decision is always yours to make explicitly.
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
                    message="This report has no supporting documents in the repository. Rejecting it may be appropriate if evidence is mandatory."
                    icon={AlertTriangle}
                  />
                )}
                {!evidenceLoading && (evidence ?? []).map((doc) => (
                  <div key={doc.id} className="glass-subtle rounded-2xl p-3.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-semibold text-[color:var(--ink)]">{doc.name}</div>
                        <div className="mt-0.5 text-[11.5px] text-[color:var(--ink-faint)]">
                          {doc.fileType} · {doc.sizeKb > 0 ? `${fmtNumber(doc.sizeKb)} KB` : "metadata only"} · v{doc.version} · uploaded {timeAgo(doc.uploadedAt)} by {doc.uploadedBy}
                        </div>
                        {doc.disclosureRef && <div className="mt-0.5 text-[11px] text-[color:var(--ink-faint)]">Disclosure: {doc.disclosureRef}</div>}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Chip tone={doc.status === "VALID" ? "green" : doc.status === "EXPIRED" ? "red" : "amber"}>{doc.status}</Chip>
                        <Button variant="outline" size="sm" className="glass-subtle h-8 rounded-xl" onClick={() => downloadDoc(doc)} disabled={docLoading}>
                          {docLoading ? <Ring className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
                          <span className="ml-1.5">Download</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {docReceipt && (
                  <p className="rounded-2xl bg-[rgba(32,167,121,0.08)] px-3 py-2 text-[11.5px] text-[#1d6b44]" role="status">{docReceipt}</p>
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
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[color:var(--esg-blue)]" />
                      <div className="min-w-0 flex-1 border-b border-[rgba(125,177,216,0.16)] pb-2.5">
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
      </GlassDialog>

      {/* ── Approve confirmation ── */}
      <ConfirmDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        title="Confirm approval"
        confirmLabel="Confirm approval"
        pending={decision.pending}
        message={
          sub
            ? `Approve ${sub.ref} — ${sub.title} (${sub.level === "PROJECT" ? sub.projectName : sub.buName ?? ""}, ${sub.period})? The submitter, the Subsidiary Admin and the Group Admin office will be notified, and the report becomes eligible for subsidiary consolidation.`
            : ""
        }
        onConfirm={(reason) => void decide("approve", reason)}
      />

      {/* ── Rejection dialog (mandatory reason) ── */}
      <GlassDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title={`Reject ${sub?.ref ?? ""}`}
        description="The report returns to the responsible user for correction. A meaningful reason is mandatory."
        footer={
          <div className="flex w-full items-center justify-between gap-2">
            <span className="text-[11.5px] text-[color:var(--ink-faint)]">
              {rejectReason.trim().length >= 10 ? "Ready to record the decision" : "Reason must be at least 10 characters"}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="glass-subtle rounded-2xl" onClick={() => setRejectOpen(false)} disabled={decision.pending}>Cancel</Button>
              <Button
                variant="destructive"
                className="rounded-2xl"
                disabled={!rejectReasonValid || decision.pending}
                onClick={() => void decide("reject", rejectReason.trim(), rejectInstructions.trim())}
              >
                {decision.pending && <Ring className="mr-1.5 h-4 w-4" />}
                Confirm rejection
              </Button>
            </div>
          </div>
        }
      >
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
              {rejectReason.length > 0 && !rejectReasonValid && (
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
              The rejected version and its evidence are preserved. The report returns to the correction workflow — the responsible user and the Subsidiary Admin will be notified with your reason.
            </div>
          </div>
        )}
      </GlassDialog>
    </>
  );
}
