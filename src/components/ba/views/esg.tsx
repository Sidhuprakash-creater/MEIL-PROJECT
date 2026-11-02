"use client";

// ── BU ADMIN · SCREEN 13 — ESG Reporting ──
// BU reporting package readiness, project-level coverage, environmental
// metrics, evidence coverage, data completeness, missing information,
// submission readiness, package preparation + submission history.
// The BU Admin must NOT create or finalize the Group BRSR — boundary notice.

import { useMemo, useState } from "react";
import {
  AlertTriangle, FileCheck2, Lock, Package, Send, ShieldCheck,
} from "lucide-react";
import { ReportChartIcon } from "@/components/workspace/premium-icons";
import { Button } from "@/components/ui/button";
import { useBaApi, fmtDate, fmtDateTime, timeAgo } from "@/lib/ba/client";
import { useBaWorkspace } from "@/lib/ba/store";
import type { BaEsgData, PackageRow } from "@/lib/ba/types";
import { PACKAGE_STATUS_LABELS } from "@/lib/ba/types";
import {
  Chip, ConfirmDialog, EmptyState, ErrorState, GlassProgress, LoadingBlock, PageHeader, SectionCard, StatusBadge,
} from "@/components/workspace/ui";
import { useToast } from "@/hooks/use-toast";
import { fmtMetric } from "@/components/ba/shared";

export default function EsgView() {
  const { params, navigate, reportingYear } = useBaWorkspace();
  const { toast } = useToast();
  const [submitPkg, setSubmitPkg] = useState<PackageRow | null>(null);

  useEffect(() => {
    if (params.prepare) {
      navigate("esg", { ...params, prepare: undefined });
      const el = document.getElementById("prepare-package");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
     
  }, []);

  const { data, loading, error, refetch } = useBaApi<BaEsgData>(`/api/ba/esg?period=${encodeURIComponent(reportingYear)}`, { deps: [reportingYear] });

  if (loading && !data) return <LoadingBlock rows={6} label="Loading ESG readiness…" />;
  if (error && !data) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  const r = data.readiness;
  const eligible = r.eligibleApproved > 0;

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="ESG Reporting"
        description={`${reportingYear} · BU reporting package readiness for ${useBaWorkspace.getState().view ? "your BU" : "your BU"}. Submit the package to your Subsidiary for consolidation — Group BRSR is finalized at the Group office.`}
        icon={ReportChartIcon}
      />

      {/* Boundary notice */}
      <div className="glass-ba glass-sheen flex items-start gap-3 rounded-3xl p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[rgba(197,121,38,0.12)] text-[#c57926]"><Lock className="h-4 w-4" /></span>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-[color:var(--ink)]">Boundary — BU package only</div>
          <p className="mt-0.5 text-[12px] text-[color:var(--ink-soft)]">
            You prepare and submit the BU reporting package to your Subsidiary. The Group BRSR is finalized by the Group Admin — never from this workspace.
          </p>
        </div>
      </div>

      {/* Readiness */}
      <div className="grid gap-3 xl:grid-cols-3">
        <SectionCard title="Readiness" icon={ShieldCheck}>
          <div className="flex items-center gap-4">
            <div className="relative h-24 w-24 shrink-0">
              <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90">
                <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(52,139,232,0.12)" strokeWidth="9" />
                <circle cx="40" cy="40" r="34" fill="none" stroke="#348BE8" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(r.pct / 100) * 213.6} 213.6`} />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[16px] font-bold tabular text-[color:var(--ink)]">{r.pct}%</span>
            </div>
            <div className="space-y-1.5 text-[12px]">
              <div className="flex items-center justify-between gap-3"><span className="text-[color:var(--ink-soft)]">Eligible approved</span><span className="tabular font-semibold text-[color:var(--ink)]">{r.eligibleApproved}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-[color:var(--ink-soft)]">Pending review</span><span className="tabular font-semibold text-[color:var(--ink)]">{r.pendingReview}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-[color:var(--ink-soft)]">Missing categories</span><span className="tabular font-semibold text-[color:var(--ink)]">{r.missingData}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-[color:var(--ink-soft)]">Validation exceptions</span><span className="tabular font-semibold text-[color:var(--ink)]">{r.validationExceptions}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-[color:var(--ink-soft)]">Evidence gaps</span><span className="tabular font-semibold text-[color:var(--ink)]">{r.evidenceGaps}</span></div>
            </div>
          </div>
        </SectionCard>

        {/* Category coverage */}
        <SectionCard title="Category coverage" icon={FileCheck2} className="xl:col-span-2">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {data.categories.map((c) => (
              <div key={c.category} className={`rounded-2xl p-2.5 ${c.missing ? "bg-[rgba(227,93,106,0.06)]" : "bg-white/50"}`}>
                <div className="flex items-center justify-between text-[12px]">
                  <span className="font-semibold text-[color:var(--ink)]">{c.label}</span>
                  <span className="tabular text-[color:var(--ink-faint)]">{c.approved}/{c.total} approved</span>
                </div>
                <GlassProgress value={c.completionPct} tone={c.completionPct >= 80 ? "green" : c.completionPct >= 40 ? "blue" : "amber"} className="mt-1.5" showLabel />
                {c.missing && <div className="mt-1 text-[10.5px] font-medium text-[#E35D6A]">No submissions in this category</div>}
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Project-level coverage */}
      <SectionCard title="Project-level report coverage" icon={ShieldCheck}>
        <div className="space-y-2">
          {data.projectCoverage.length === 0 ? <EmptyState title="No projects yet" /> : data.projectCoverage.map((p) => (
            <div key={p.projectId}>
              <div className="mb-1 flex items-center justify-between text-[12px]">
                <span className="font-semibold text-[color:var(--ink)]">{p.projectName}</span>
                <span className="tabular text-[color:var(--ink-faint)]">{p.approved}/{p.total} approved · {p.missing} missing</span>
              </div>
              <GlassProgress value={p.completionPct} tone={p.completionPct >= 80 ? "green" : p.completionPct >= 40 ? "blue" : "amber"} showLabel />
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Metrics */}
      <SectionCard title="Environmental metric roll-up" icon={ReportChartIcon} description="Approved totals per metric+unit (pending excluded from totals)">
        {data.metrics.length === 0 ? <EmptyState title="No approved metrics yet" /> : (
          <div className="space-y-1.5">
            {data.metrics.map((m, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl bg-white/50 px-2.5 py-1.5 text-[12px]">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-[color:var(--ink)]">{m.name}</div>
                  <div className="text-[10.5px] text-[color:var(--ink-faint)]">{m.sourceCount} approved source{m.sourceCount === 1 ? "" : "s"} · {fmtMetric(m.pendingTotal)} {m.unit} pending</div>
                </div>
                <div className="tabular text-[13px] font-bold text-[#348BE8]">{fmtMetric(m.approvedTotal)} <span className="text-[10.5px] font-medium text-[color:var(--ink-faint)]">{m.unit}</span></div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Prepare + submit package */}
      <SectionCard title="BU reporting package" icon={Package} description="Consolidate approved sources into a package and submit it to your Subsidiary" actions={<Button className="btn-ba-action rounded-2xl" disabled={!eligible} onClick={() => setSubmitPkg({ id: "new", ref: "", title: "", period: reportingYear, status: "DRAFT", readinessPct: r.pct, summary: { approved: r.eligibleApproved, pending: r.pendingReview, missing: r.missingData, metrics: [] }, sourceRefs: [], submittedAt: null, submittedBy: "", groupFeedback: "", updatedAt: new Date().toISOString() })}><Send className="mr-1.5 h-4 w-4" /> Prepare + submit</Button>}>
        {data.packages.length === 0 ? <EmptyState title="No packages submitted yet" message="Click 'Prepare + submit' to consolidate your approved records and submit them to your Subsidiary." /> : (
          <div className="space-y-2">
            {data.packages.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-2xl bg-white/50 px-3 py-2 text-[12px]">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold text-[color:var(--ink)]">{p.title}</div>
                  <div className="text-[11px] text-[color:var(--ink-faint)]">{p.ref} · {p.period} · submitted {p.submittedAt ? timeAgo(p.submittedAt) : "—"} by {p.submittedBy || "—"}</div>
                </div>
                <div className="flex items-center gap-2"><Chip tone="blue">{p.summary.approved} approved</Chip><StatusBadge status={p.status} /></div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {!eligible && (
        <div className="glass-ba glass-sheen flex items-start gap-3 rounded-3xl p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[rgba(197,121,38,0.12)] text-[#c57926]"><AlertTriangle className="h-4 w-4" /></span>
          <div className="min-w-0"><div className="text-[13px] font-semibold text-[color:var(--ink)]">No approved records to package yet</div><p className="mt-0.5 text-[12px] text-[color:var(--ink-soft)]">At least one BU report must be approved by the BU Manager before a package can be submitted. Coordinate corrections via the Communication Center.</p></div>
        </div>
      )}

      <ConfirmDialog
        open={!!submitPkg}
        onOpenChange={(o) => { if (!o) setSubmitPkg(null); }}
        title="Submit BU reporting package?"
        message={`This will consolidate ${r.eligibleApproved} approved source${r.eligibleApproved === 1 ? "" : "s"} into a ${reportingYear} package and notify your Subsidiary + Group for consolidation.`}
        confirmLabel="Submit to Subsidiary"
        onConfirm={async () => {
          if (!submitPkg) return;
          try {
            const res = await fetch(`/api/ba/esg/packages/${submitPkg.id}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title: "", period: reportingYear }),
            });
            const json = await res.json() as { package?: PackageRow; error?: string };
            if (!res.ok) throw new Error(json.error ?? "Submission failed");
            toast({ title: "Package submitted", description: `${json.package?.ref} with ${json.package?.summary.approved ?? 0} approved sources is now with your Subsidiary.` });
            setSubmitPkg(null);
            refetch();
          } catch (e) {
            toast({ title: "Could not submit", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
          }
        }}
      />
    </div>
  );
}

import { useEffect } from "react";
void fmtDate; void fmtDateTime;
