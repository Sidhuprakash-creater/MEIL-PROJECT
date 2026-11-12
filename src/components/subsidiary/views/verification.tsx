"use client";

// ── SUBSIDIARY ADMIN · VERIFICATION DESK (second-step verification) ────────
// When the Subsidiary Manager approves a consolidated Business Unit report it
// does NOT become final straight away: it lands here as AWAITING_SA_VERIFICATION.
// The Subsidiary Admin re-checks the numbers that travelled up (2-step) and
// only then can the subsidiary submit its final report to the Group.

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, FileCheck2,
  RefreshCcw, ShieldCheck, Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Chip, EmptyState, ErrorState, GlassCard, LoadingBlock, PageHeader,
} from "@/components/workspace/ui";
import { useSaWorkspace } from "@/lib/sa/store";
import { apiPost, useSaApi } from "@/lib/sa/client";

type VerificationMember = {
  id: string;
  ref: string;
  title: string;
  category: string;
  metricName: string;
  metricValue: number;
  metricUnit: string;
  status: string;
  projectName: string;
  submittedBy: string;
  evidenceCount: number;
};

type VerificationItem = {
  id: string;
  ref: string;
  title: string;
  period: string;
  fiscalQuarter: string;
  projectName: string;
  buName: string;
  submittedBy: string;
  reviewedBy: string;
  submittedAt: string | null;
  updatedAt: string;
  evidenceCount: number;
  declarationCount: number;
  consolidatedValue: number;
  categories: { category: string; label: string; value: number; unit: string; count: number }[];
  members: VerificationMember[];
  smComments: { author: string; text: string; at: string }[];
};

type VerificationResp = { items: VerificationItem[]; total: number };

export default function VerificationView() {
  const { reportingYear, navigate } = useSaWorkspace();
  const { toast } = useToast();
  const { data, loading, error, refetch } = useSaApi<VerificationResp>(
    `/api/sa/verification?period=${encodeURIComponent(reportingYear)}`,
    { deps: [reportingYear] }
  );

  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [rejecting, setRejecting] = useState<VerificationItem | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (rejecting) setReason("");
  }, [rejecting]);

  const items = useMemo(() => data?.items ?? [], [data]);
  const reasonValid = reason.trim().length >= 10;

  const verify = async (item: VerificationItem) => {
    setBusy(item.id);
    try {
      const res = await apiPost<{ message: string }>("/api/sa/verification", {
        submissionId: item.id,
        action: "verify",
      });
      toast({
        title: "Report verified",
        description: res.message ?? "The consolidated numbers are confirmed.",
      });
      await refetch();
    } catch (err: any) {
      toast({ title: "Verification failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const sendBack = async () => {
    if (!rejecting || !reasonValid) return;
    setBusy(rejecting.id);
    try {
      const res = await apiPost<{ message: string }>("/api/sa/verification", {
        submissionId: rejecting.id,
        action: "reject",
        reason: reason.trim(),
      });
      toast({ title: "Sent back to the Business Unit", description: res.message });
      setRejecting(null);
      await refetch();
    } catch (err: any) {
      toast({ title: "Could not send back", description: err.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="view-in space-y-4 pb-6">
        <LoadingBlock rows={5} label="Loading verification queue…" />
      </div>
    );
  }
  if (error && !data) {
    return (
      <div className="view-in space-y-4 pb-6">
        <ErrorState message={error} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="Verification Desk"
        description={`${reportingYear} · Second-step check of the consolidated Business Unit reports approved by your Subsidiary Manager.`}
        icon={ShieldCheck}
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={loading}>
            <RefreshCcw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        }
      />

      {/* ── explainer / status hero ── */}
      <GlassCard className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="text-[12px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">
              Two-step verification
            </div>
            <h2 className="mt-1 text-[18px] font-bold tracking-tight text-[color:var(--ink)]">
              {items.length === 0
                ? "Nothing awaiting your verification"
                : `${items.length} consolidated package${items.length === 1 ? "" : "s"} awaiting your verification`}
            </h2>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-[color:var(--ink-soft)]">
              <strong>Step 1 — Subsidiary Manager:</strong> reviews the consolidated Business Unit report.
              <br />
              <strong>Step 2 — You (Subsidiary Admin):</strong> re-check the numbers that travelled up and
              confirm them. Only after every package is verified can the subsidiary submit its final report
              to the Group.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="rounded-2xl border border-white/70 bg-gradient-to-br from-[#315CFF]/15 to-[#315CFF]/5 px-4 py-3 text-center">
              <div className="text-[24px] font-bold tabular leading-none text-[#1a5fb8]">{items.length}</div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">
                To verify
              </div>
            </div>
            <Button
              size="sm"
              className="rounded-xl"
              onClick={() => navigate("esg")}
            >
              Go to ESG Reporting
            </Button>
          </div>
        </div>
      </GlassCard>

      {items.length === 0 ? (
        <GlassCard className="p-6">
          <EmptyState
            icon={FileCheck2}
            title="Verification queue is clear"
            message="Consolidated Business Unit reports approved by the Subsidiary Manager will appear here for your second-step check."
          />
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const isOpen = !!open[item.id];
            return (
              <GlassCard key={item.id} className="overflow-hidden p-0">
                <button
                  type="button"
                  onClick={() => setOpen((p) => ({ ...p, [item.id]: !p[item.id] }))}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/60"
                >
                  <span className="text-[color:var(--esg-blue)]">
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[13px] font-bold text-[color:var(--ink)]">{item.title}</span>
                      <Chip tone="amber">Awaiting verification</Chip>
                      <Chip tone="gray">{item.period}</Chip>
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-[color:var(--ink-faint)]">
                      {item.ref} · {item.buName} · {item.projectName} · approved by {item.reviewedBy}
                    </div>
                  </div>
                  <div className="hidden shrink-0 items-center gap-2 sm:flex">
                    <Chip tone="gray">{item.declarationCount} disclosures</Chip>
                    <Chip tone="blue">{item.evidenceCount} evidence</Chip>
                  </div>
                </button>

                {isOpen && (
                  <div className="space-y-4 border-t border-white/70 bg-white/40 px-4 py-4">
                    {/* step-1 record */}
                    <div className="rounded-2xl border border-[rgba(58,123,255,0.25)] bg-[rgba(58,123,255,0.06)] p-3.5">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--esg-blue)]">
                        Step 1 · Subsidiary Manager sign-off
                      </div>
                      <div className="mt-1.5 text-[12.5px] text-[color:var(--ink-soft)]">
                        {item.reviewedBy} approved {item.ref} — {item.declarationCount} disclosure(s),
                        {item.evidenceCount} evidence file(s).
                      </div>
                      {item.smComments.length > 0 && (
                        <ul className="mt-2 space-y-1.5">
                          {item.smComments.map((c, i) => (
                            <li key={i} className="rounded-xl bg-white/70 px-3 py-2 text-[12px] italic text-[color:var(--ink-soft)]">
                              “{c.text}” — {c.author}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* step-2 re-check */}
                    <div className="rounded-2xl border border-white/70 bg-white/60 p-3.5">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">
                        Step 2 · Your re-check — numbers that travelled up
                      </div>
                      <div className="mt-2.5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {item.categories.map((c) => (
                          <div key={c.category} className="rounded-xl border border-white/70 bg-white/80 px-3 py-2">
                            <div className="text-[10.5px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">
                              {c.category}
                            </div>
                            <div className="mt-0.5 truncate text-[12px] font-medium text-[color:var(--ink-soft)]">{c.label}</div>
                            <div className="mt-1 font-mono text-[15px] font-bold tabular text-[color:var(--ink)]">
                              {Number(c.value || 0).toLocaleString("en-IN")} {c.unit}
                            </div>
                            <div className="mt-0.5 text-[10.5px] text-[color:var(--ink-faint)]">{c.count} source record(s)</div>
                          </div>
                        ))}
                        {item.categories.length === 0 && (
                          <div className="text-[12px] text-[color:var(--ink-faint)]">
                            No category breakdown recorded for this package.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* source disclosures */}
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">
                        Source disclosures included
                      </div>
                      <div className="mt-2 space-y-1.5">
                        {item.members.map((m) => (
                          <div
                            key={m.id}
                            className="flex flex-wrap items-center gap-2 rounded-xl border border-white/70 bg-white/70 px-3 py-2 text-[12px]"
                          >
                            <span className="rounded-md bg-[rgba(58,123,255,0.12)] px-1.5 py-0.5 font-mono text-[10.5px] font-bold text-[color:var(--esg-blue)]">
                              {m.ref}
                            </span>
                            <span className="min-w-0 flex-1 truncate font-medium text-[color:var(--ink)]">{m.title}</span>
                            <span className="shrink-0 font-mono text-[11.5px] font-semibold tabular text-[color:var(--ink-soft)]">
                              {Number(m.metricValue || 0).toLocaleString("en-IN")} {m.metricUnit}
                            </span>
                            <span className="shrink-0 text-[10.5px] text-[color:var(--ink-faint)]">{m.projectName}</span>
                            <Chip tone="gray">{m.evidenceCount} ev.</Chip>
                          </div>
                        ))}
                        {item.members.length === 0 && (
                          <div className="text-[12px] text-[color:var(--ink-faint)]">
                            No individual disclosures were folded into this package.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* actions */}
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        onClick={() => setRejecting(item)}
                        disabled={busy === item.id}
                      >
                        <Undo2 className="mr-1.5 h-3.5 w-3.5" /> Send back to BU
                      </Button>
                      <Button
                        size="sm"
                        className="h-9 rounded-xl bg-gradient-to-r from-[#20a779] to-[#187a5c] px-4 text-[12.5px] font-bold text-white shadow-md shadow-[rgba(32,167,121,0.3)] hover:from-[#23b484] hover:to-[#1d8f68]"
                        onClick={() => verify(item)}
                        disabled={busy === item.id}
                      >
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                        {busy === item.id ? "Verifying…" : "Verify & confirm numbers"}
                      </Button>
                    </div>
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* ── send-back dialog ── */}
      {rejecting && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-white/80 bg-white/95 p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[rgba(197,121,38,0.14)]">
                <AlertTriangle className="h-4 w-4 text-[#c57926]" />
              </span>
              <div>
                <div className="text-[14px] font-bold text-[color:var(--ink)]">Send this package back to the Business Unit</div>
                <div className="mt-0.5 text-[12px] text-[color:var(--ink-faint)]">
                  {rejecting.ref} — {rejecting.title}
                </div>
              </div>
            </div>
            <div className="mt-4">
              <label className="text-[11.5px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">
                What must be corrected?
              </label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                placeholder="e.g. The energy figures for the lift package do not match the meter reading of the March cycle."
                className="mt-1.5 rounded-2xl text-[13px]"
              />
              <div className={`mt-1.5 text-[11px] ${reasonValid ? "text-[#1d6b40]" : "text-[color:var(--ink-faint)]"}`}>
                {reasonValid ? "Ready to record the decision" : "Reason must be at least 10 characters"}
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setRejecting(null)} disabled={busy === rejecting.id}>
                Cancel
              </Button>
              <Button
                className="rounded-xl bg-[#b0484f] text-white hover:bg-[#9c3f45]"
                onClick={sendBack}
                disabled={!reasonValid || busy === rejecting.id}
              >
                {busy === rejecting.id ? "Sending…" : "Send back with remarks"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
