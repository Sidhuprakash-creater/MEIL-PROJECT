"use client";

// ── SUBSIDIARY ADMIN · ESG Reporting (subsidiary preparation) ───────────
// NOT the Group BRSR builder — this view prepares the subsidiary's
// consolidation from APPROVED records and submits reporting packages to
// the Group Admin's reporting workflow, which owns the consolidated report.

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, MinusCircle,
  Package, Quote, RefreshCcw,
} from "lucide-react";
import { Ring } from '@/components/ring'
import { DatabaseIcon, FilesIcon, ReportChartIcon, ShieldIcon } from "@/components/workspace/premium-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Chip, ConfirmDialog, EmptyState, ErrorState, Field, GlassCard, GlassDialog,
  GlassProgress, LoadingBlock, PageHeader, SectionCard, StatusBadge,
} from "@/components/workspace/ui";
import { useSaWorkspace } from "@/lib/sa/store";
import { apiPatch, apiPost, fmtDateTime, fmtNumber, timeAgo, useMutation, useSaApi } from "@/lib/sa/client";
import { PACKAGE_STATUS_LABELS } from "@/lib/sa/types";
import type { EsgReportingData, PackageRow } from "@/lib/sa/types";

type PackagesResp = { package: PackageRow };

const PKG_TONE: Record<string, "gray" | "blue" | "purple" | "green" | "amber"> = {
  DRAFT: "gray",
  SUBMITTED: "blue",
  UNDER_GROUP_REVIEW: "purple",
  APPROVED: "green",
  CHANGES_REQUESTED: "amber",
};

type FlatSource = EsgReportingData["consolidation"][number]["sources"][number] & {
  metric: string;
  metricUnit: string;
};

function flattenSources(d: EsgReportingData): FlatSource[] {
  return d.consolidation.flatMap((c) =>
    c.sources.map((s) => ({ ...s, metric: c.metricName, metricUnit: c.unit }))
  );
}

export default function EsgView() {
  const { reportingYear, params, navigate } = useSaWorkspace();
  const { toast } = useToast();
  const { data, loading, error, refetch } = useSaApi<EsgReportingData>(
    `/api/sa/esg?period=${encodeURIComponent(reportingYear)}`,
    { deps: [reportingYear] }
  );

  const [prepareOpen, setPrepareOpen] = useState(false);
  const [pkgTitle, setPkgTitle] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [selectedRefs, setSelectedRefs] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [resubmitTarget, setResubmitTarget] = useState<PackageRow | null>(null);

  const submitMut = useMutation<PackagesResp>();
  const resubmitMut = useMutation<PackagesResp>();

  useEffect(() => {
    if (submitMut.error) toast({ title: "Package not submitted", description: submitMut.error, variant: "destructive" });
  }, [submitMut.error, toast]);
  useEffect(() => {
    if (resubmitMut.error) toast({ title: "Resubmit failed", description: resubmitMut.error, variant: "destructive" });
  }, [resubmitMut.error, toast]);

  const allSources = useMemo(() => (data ? flattenSources(data) : []), [data]);
  const approvedRefs = useMemo(() => allSources.filter((s) => s.status === "APPROVED").map((s) => s.ref), [allSources]);
  const approvedRefSet = useMemo(() => new Set(approvedRefs), [approvedRefs]);
  const hasApprovedChecked = useMemo(
    () => selectedRefs.some((ref) => approvedRefSet.has(ref)),
    [selectedRefs, approvedRefSet]
  );

  /* deep link: Command Center "Prepare ESG Package" quick action → params.prepare.
     Consumed during render (React derived-state adjustment); the store param is
     cleared afterwards via navigate (an external store update). */
  const [consumedPrepare, setConsumedPrepare] = useState<unknown>(null);
  if (params.prepare && data && consumedPrepare !== params.prepare) {
    setConsumedPrepare(params.prepare);
    setPkgTitle(`${reportingYear} ESG Reporting Package`);
    setTitleError(null);
    setSelectedRefs(approvedRefs);
    setPrepareOpen(true);
  }
  useEffect(() => {
    /* clear the param only after it has been consumed (data must have arrived) */
    if (params.prepare && consumedPrepare === params.prepare) navigate("esg");
  }, [params.prepare, consumedPrepare, navigate]);

  const openPrepare = () => {
    setPkgTitle(`${reportingYear} ESG Reporting Package`);
    setTitleError(null);
    setSelectedRefs(approvedRefs);
    setPrepareOpen(true);
  };

  const submitPackage = async () => {
    if (!pkgTitle.trim()) {
      setTitleError("Package title is required.");
      return;
    }
    setTitleError(null);
    const res = await submitMut.run(() =>
      apiPost<PackagesResp>("/api/sa/packages", {
        title: pkgTitle.trim(),
        period: reportingYear,
        sourceRefs: selectedRefs,
      })
    );
    if (!res) return; // server message surfaces verbatim via toast effect
    toast({
      title: "Package submitted to Group Admin",
      description: `${res.package.ref} · ${res.package.title}`,
    });
    setPrepareOpen(false);
    refetch();
  };

  const resubmit = async () => {
    if (!resubmitTarget) return;
    const res = await resubmitMut.run(() =>
      apiPatch<PackagesResp>(`/api/sa/packages/${resubmitTarget.id}`, { action: "resubmit" })
    );
    if (!res) return;
    toast({
      title: "Package resubmitted to Group Admin",
      description: `${res.package.ref} · ${res.package.title}`,
    });
    setResubmitTarget(null);
    refetch();
  };

  if (loading && !data) return <div className="view-in space-y-4 pb-6"><LoadingBlock rows={6} label="Loading ESG reporting…" /></div>;
  if (error && !data) return <div className="view-in space-y-4 pb-6"><ErrorState message={error} onRetry={refetch} /></div>;
  if (!data) return null;

  const r = data.readiness;
  const readinessCounts = [
    { label: "Approved & eligible", value: r.eligibleApproved, text: "text-[#1d6b40]", to: () => navigate("monitoring", { statusFilter: "approved" }) },
    { label: "Pending review", value: r.pendingReview, text: "text-[#9c5d1b]", to: () => navigate("monitoring", { statusFilter: "pending" }) },
    { label: "Missing-data categories", value: r.missingData, text: "text-[#a53b3b]", to: () => navigate("submissions", { tab: "draft" }) },
    { label: "Validation exceptions", value: r.validationExceptions, text: "text-[#a53b3b]", to: () => navigate("validation") },
    { label: "Evidence gaps", value: r.evidenceGaps, text: "text-[#9c5d1b]", to: () => navigate("evidence") },
  ];

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="ESG Reporting"
        description={`${data.period} · Subsidiary consolidation and package preparation — the Group Admin owns the consolidated BRSR report.`}
        icon={ReportChartIcon}
      />

      {/* ── readiness hero ── */}
      <GlassCard className="relative overflow-hidden p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(32,167,121,0.14),transparent_65%)]" />
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="min-w-0">
            <div className="text-[12px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">Disclosure readiness — {data.period}</div>
            <h2 className="mt-1 text-[19px] font-bold tracking-tight text-[color:var(--ink)]">Subsidiary ESG consolidation</h2>
            <p className="mt-1 max-w-lg text-[12.5px] leading-relaxed text-[color:var(--ink-faint)]">
              Built from approved BU &amp; project records only. Submitting a package hands this snapshot to the Group Admin&apos;s reporting workflow.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {readinessCounts.map((c) => (
                <button
                  key={c.label}
                  onClick={c.to}
                  className="glass-subtle flex items-center gap-2 rounded-2xl px-3 py-2 text-left transition-all hover:-translate-y-0.5 hover:bg-white/80"
                  aria-label={`${c.label}: ${c.value}`}
                >
                  <span className={`text-[16px] font-bold tabular leading-none ${c.text}`}>{c.value}</span>
                  <span className="text-[11.5px] font-medium text-[color:var(--ink-soft)]">{c.label}</span>
                  <ArrowRight className="h-3 w-3 text-[color:var(--ink-faint)]" />
                </button>
              ))}
            </div>
            {/* FINAL REPORT GATE — eligible only once the consolidated data
               coming from the Business Units has been approved (nothing left
               in review). One approval of the consolidated dossier unlocks
               the final subsidiary report; no item-by-item sign-off. */}
            <div className="mt-5">
              <Button
                className="h-11 rounded-2xl bg-gradient-to-r from-[#20a779] to-[#187a5c] text-[13px] font-bold text-white hover:from-[#23b484] hover:to-[#1d8f68]"
                disabled={approvedRefs.length === 0 || r.pendingReview > 0}
                onClick={() => {
                  setPkgTitle(`${reportingYear} Final Report`);
                  setTitleError(null);
                  setSelectedRefs(approvedRefs);
                  setPrepareOpen(true);
                }}
              >
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                Submit Final Report to Group
              </Button>
              <p className="mt-1.5 text-[11px] text-[color:var(--ink-faint)]">
                {r.pendingReview > 0
                  ? "Locked until the consolidated data from your Business Units is approved."
                  : approvedRefs.length === 0
                    ? "No approved records to include yet."
                    : "All consolidated BU data is approved — ready to hand to the Group Admin."}
              </p>
            </div>
          </div>
          <div className="glass-subtle flex items-center gap-4 rounded-3xl p-4">
            <div className="relative h-24 w-24">
              <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90" aria-hidden="true">
                <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(32,167,121,0.12)" strokeWidth="9" />
                <circle
                  cx="40" cy="40" r="34" fill="none" stroke="#20a779" strokeWidth="9" strokeLinecap="round"
                  strokeDasharray={`${(r.pct / 100) * 213.6} 213.6`}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[18px] font-bold tabular text-[color:var(--ink)]">{r.pct}%</span>
            </div>
            <div>
              <div className="text-[12px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">Package readiness</div>
              <div className="mt-1 text-[13px] font-semibold text-[color:var(--ink-soft)]">Approved share of submitted records</div>
              <div className="mt-1.5 text-[11px] text-[color:var(--ink-faint)]">Feeds Group consolidation on submit</div>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* ── category completion ── */}
      <SectionCard title="Category completion" description={`${data.period} · click a category to open its submissions`} icon={FilesIcon}>
        <div className="space-y-3">
          {data.categories.length === 0 && (
            <EmptyState title="No categories configured" message="Reporting categories appear once your timelines define them." icon={FilesIcon} />
          )}
          {data.categories.map((c) => (
            <button
              key={c.category}
              onClick={() => navigate("submissions", { category: c.category })}
              className="block w-full rounded-2xl px-1.5 py-1 text-left transition-colors hover:bg-white/50"
            >
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
                <span className="flex min-w-0 items-center gap-2 font-semibold text-[color:var(--ink)]">
                  <span className="truncate">{c.label}</span>
                  {c.missing && <Chip tone="amber">No data</Chip>}
                </span>
                <span className="tabular text-[color:var(--ink-faint)]">{c.approved}/{c.total} approved · {c.completionPct}%</span>
              </div>
              <GlassProgress
                value={c.completionPct}
                tone={c.completionPct >= 80 ? "green" : c.completionPct >= 40 ? "blue" : c.completionPct > 0 ? "amber" : "red"}
              />
            </button>
          ))}
        </div>
      </SectionCard>

      {/* ── consolidation ── */}
      <SectionCard title="Consolidation — approved metric totals" description="The numbers the Group office consolidates" icon={DatabaseIcon}>
        <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-[rgba(197,121,38,0.3)] bg-[rgba(197,121,38,0.08)] p-3.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#c57926]" />
          <p className="text-[12.5px] font-medium leading-relaxed text-[color:var(--ink-soft)]">
            Only APPROVED records feed the consolidated totals — drafts, pending and rejected data are excluded.
          </p>
        </div>
        {data.consolidation.length === 0 ? (
          <EmptyState
            title="Nothing to consolidate yet"
            message="Approved BU/project records carrying metric values will be grouped here by metric and unit."
            icon={DatabaseIcon}
          />
        ) : (
          <div className="space-y-2">
            {data.consolidation.map((c) => {
              const key = `${c.metricName}|${c.unit}`;
              const open = !!expanded[key];
              return (
                <GlassCard key={key} subtle className="overflow-hidden">
                  <button
                    onClick={() => setExpanded((e) => ({ ...e, [key]: !open }))}
                    className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 p-4 text-left"
                    aria-expanded={open}
                  >
                    <span className="min-w-0 flex-1 basis-40">
                      <span className="block truncate text-[13.5px] font-semibold text-[color:var(--ink)]">{c.metricName}</span>
                      <span className="block text-[11px] text-[color:var(--ink-faint)]">
                        {c.sourceCount} source record{c.sourceCount === 1 ? "" : "s"}
                        {c.hasIssues ? " · flagged by validation" : ""}
                      </span>
                    </span>
                    <span className="text-[20px] font-bold tabular leading-none text-[color:var(--ink)]">
                      {fmtNumber(c.approvedTotal, 2)}{" "}
                      <span className="text-[11px] font-semibold uppercase text-[color:var(--ink-faint)]">{c.unit}</span>
                    </span>
                    {c.pendingTotal > 0 && (
                      <Chip tone="amber" className="max-w-full">
                        <span className="truncate">
                          +{fmtNumber(c.pendingTotal, 2)} {c.unit} pending — excluded from totals until approved
                        </span>
                      </Chip>
                    )}
                    {c.hasIssues && <Chip tone="red">Validation flagged</Chip>}
                    <ChevronDown className={`h-4 w-4 shrink-0 text-[color:var(--ink-faint)] transition-transform ${open ? "rotate-180" : ""}`} />
                  </button>
                  {open && (
                    <div className="border-t border-[rgba(125,177,216,0.25)] bg-white/30 p-3">
                      {c.sources.length === 0 ? (
                        <p className="px-2 py-1.5 text-xs text-[color:var(--ink-faint)]">No source records.</p>
                      ) : (
                        <div className="space-y-1">
                          {c.sources.map((s) => (
                            <div key={s.ref} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-xl px-2 py-1.5 text-[12px]">
                              <span className="font-mono text-[11px] font-medium text-[color:var(--ink-soft)]">{s.ref}</span>
                              <span className="min-w-0 flex-1 basis-32 truncate text-[color:var(--ink-soft)]">{s.label}</span>
                              <span className="truncate text-[color:var(--ink-faint)]">{s.org}</span>
                              <span className="tabular font-semibold text-[color:var(--ink)]">{fmtNumber(s.value, 2)} {s.unit}</span>
                              <StatusBadge status={s.status} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </GlassCard>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* ── packages ── */}
      <SectionCard
        title="Reporting packages"
        description="Everything your subsidiary has sent to the Group Admin's reporting workflow"
        icon={Package}
        actions={
          <Button className="btn-action h-9 rounded-2xl" onClick={openPrepare}>
            <Package className="mr-1.5 h-4 w-4" /> Prepare &amp; submit reporting package
          </Button>
        }
      >
        {data.activeFeedback && (
          <div className="mb-4 rounded-2xl border border-[rgba(197,121,38,0.3)] bg-[rgba(197,121,38,0.08)] p-4">
            <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-[#9c5d1b]">
              <Quote className="h-3.5 w-3.5" /> Group feedback on {data.activeFeedback.ref}
            </div>
            <blockquote className="mt-2 border-l-4 border-[rgba(197,121,38,0.6)] pl-3 text-[13px] italic leading-relaxed text-[color:var(--ink-soft)]">
              “{data.activeFeedback.feedback}”
            </blockquote>
            <div className="mt-1.5 text-[11px] text-[color:var(--ink-faint)]">Received {timeAgo(data.activeFeedback.at)}</div>
          </div>
        )}
        {data.packages.length === 0 ? (
          <EmptyState
            title="No packages submitted yet"
            message="Prepare your first reporting package from approved records and send it to the Group Admin."
            icon={Package}
            action={
              <Button className="btn-action" onClick={openPrepare}>
                <Package className="mr-1.5 h-4 w-4" /> Prepare &amp; submit reporting package
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {data.packages.map((p) => (
              <GlassCard key={p.id} subtle className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[12px] font-semibold text-[color:var(--ink-soft)]">{p.ref}</span>
                  <h3 className="text-[14px] font-bold text-[color:var(--ink)]">{p.title}</h3>
                  <Chip tone="blue">{p.period}</Chip>
                  <Chip tone={PKG_TONE[p.status] ?? "gray"}>{PACKAGE_STATUS_LABELS[p.status] ?? p.status}</Chip>
                  {p.status === "CHANGES_REQUESTED" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="glass-subtle ml-auto h-8 rounded-2xl border-[rgba(197,121,38,0.45)] text-xs"
                      onClick={() => setResubmitTarget(p)}
                    >
                      <RefreshCcw className="mr-1.5 h-3.5 w-3.5" /> Resubmit
                    </Button>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <div className="min-w-40 flex-1">
                    <GlassProgress
                      value={p.readinessPct}
                      tone={p.readinessPct >= 80 ? "green" : p.readinessPct >= 40 ? "blue" : "amber"}
                      showLabel
                    />
                  </div>
                  <span className="text-[11.5px] text-[color:var(--ink-faint)]">
                    {p.summary.approved} approved source{p.summary.approved === 1 ? "" : "s"}
                    {p.summary.pending ? ` · ${p.summary.pending} pending` : ""}
                    {p.summary.missing ? ` · ${p.summary.missing} missing` : ""}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-2 text-[11.5px] text-[color:var(--ink-faint)]">
                  <span>Submitted by <strong className="font-semibold text-[color:var(--ink-soft)]">{p.submittedBy}</strong></span>
                  <span>·</span>
                  <span>{fmtDateTime(p.submittedAt)}</span>
                  <span>·</span>
                  <span>updated {timeAgo(p.updatedAt)}</span>
                </div>
                {p.groupFeedback && (
                  <blockquote className="mt-3 rounded-2xl border border-[rgba(197,121,38,0.3)] bg-[rgba(197,121,38,0.07)] p-3 text-[12.5px] italic leading-relaxed text-[color:var(--ink-soft)]">
                    <Quote className="mr-1.5 inline h-3.5 w-3.5 text-[#c57926]" />
                    {p.groupFeedback}
                  </blockquote>
                )}
              </GlassCard>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── prepare & submit dialog ── */}
      <GlassDialog
        open={prepareOpen}
        onOpenChange={(o) => { if (!o) setPrepareOpen(false); }}
        wide
        title="Prepare & submit reporting package"
        description={`${reportingYear} · a snapshot of your records goes to the Group Admin`}
        footer={
          <>
            <Button variant="outline" className="glass-subtle rounded-2xl border-white/60" onClick={() => setPrepareOpen(false)} disabled={submitMut.pending}>
              Cancel
            </Button>
            <Button className="btn-action rounded-2xl" onClick={submitPackage} disabled={!hasApprovedChecked || submitMut.pending}>
              {submitMut.pending && <Ring className="mr-1.5 h-4 w-4" />}
              Submit to Group Admin
            </Button>
          </>
        }
      >
        {/* readiness summary */}
        <div className="glass-subtle grid grid-cols-2 gap-3 rounded-2xl p-3.5 sm:grid-cols-4">
          {[
            { label: "Readiness", value: `${r.pct}%` },
            { label: "Approved", value: r.eligibleApproved },
            { label: "Pending review", value: r.pendingReview },
            { label: "Evidence gaps", value: r.evidenceGaps },
          ].map((s) => (
            <div key={s.label} className="text-center sm:text-left">
              <div className="text-[18px] font-bold tabular leading-none text-[color:var(--ink)]">{s.value}</div>
              <div className="mt-1 text-[10.5px] font-semibold uppercase tracking-wider text-[color:var(--ink-faint)]">{s.label}</div>
            </div>
          ))}
        </div>

        {/* category checklist */}
        <div className="mt-4">
          <div className="text-[12px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">Category checklist</div>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {data.categories.map((c) => (
              <div key={c.category} className="flex items-center justify-between gap-2 rounded-xl bg-white/40 px-3 py-2 text-[12.5px]">
                <span className="flex min-w-0 items-center gap-1.5 text-[color:var(--ink-soft)]">
                  {c.approved > 0
                    ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#238653]" />
                    : <MinusCircle className="h-3.5 w-3.5 shrink-0 text-[#8595ab]" />}
                  <span className="truncate">{c.label}</span>
                </span>
                <span className="tabular shrink-0 text-[color:var(--ink-faint)]">{c.approved} approved</span>
              </div>
            ))}
          </div>
        </div>

        {/* source refs multi-select */}
        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[12px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">
              Source records ({selectedRefs.length} selected)
            </div>
            <div className="flex gap-3">
              <button className="text-[11px] font-medium text-[color:var(--esg-blue)] hover:underline" onClick={() => setSelectedRefs(allSources.map((s) => s.ref))}>Select all</button>
              <button className="text-[11px] font-medium text-[color:var(--ink-soft)] hover:underline" onClick={() => setSelectedRefs(approvedRefs)}>Only approved</button>
              <button className="text-[11px] font-medium text-[color:var(--ink-faint)] hover:underline" onClick={() => setSelectedRefs([])}>Clear</button>
            </div>
          </div>
          <div className="glass-subtle nice-scroll mt-2 max-h-56 overflow-y-auto rounded-2xl border-white/60 p-2">
            {allSources.length === 0 && (
              <p className="px-2 py-3 text-xs text-[color:var(--ink-faint)]">
                No consolidation sources for this period yet — approve submissions first, then prepare the package.
              </p>
            )}
            {allSources.map((s) => (
              <label key={s.ref} className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-white/70">
                <Checkbox
                  checked={selectedRefs.includes(s.ref)}
                  onCheckedChange={(c) =>
                    setSelectedRefs((refs) => (c === true ? [...refs, s.ref] : refs.filter((x) => x !== s.ref)))
                  }
                  aria-label={`Select source ${s.ref}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 font-mono text-[11px] font-medium text-[color:var(--ink-soft)]">{s.ref}</span>
                    <span className="truncate text-[12.5px] font-medium text-[color:var(--ink)]">{s.label}</span>
                  </span>
                  <span className="block truncate text-[10.5px] text-[color:var(--ink-faint)]">{s.metric} · {s.org}</span>
                </span>
                <span className="tabular shrink-0 text-[11.5px] font-semibold text-[color:var(--ink-soft)]">{fmtNumber(s.value, 2)} {s.unit}</span>
                <StatusBadge status={s.status} />
              </label>
            ))}
          </div>
          {!hasApprovedChecked && (
            <div className="mt-2 flex items-start gap-2 rounded-2xl border border-[rgba(197,121,38,0.3)] bg-[rgba(197,121,38,0.08)] p-3 text-[12px] font-medium leading-relaxed text-[color:var(--ink-soft)]">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#c57926]" />
              {approvedRefs.length === 0
                ? "There are no approved records to include yet — the Group office requires at least one approved source, so submission stays disabled."
                : "Include at least one approved source record — packages without approved sources are rejected."}
            </div>
          )}
        </div>

        <div className="mt-4">
          <Field label="Package title" required error={titleError} hint="Shown in the Group Admin's package list.">
            <Input
              value={pkgTitle}
              onChange={(e) => { setPkgTitle(e.target.value); if (titleError) setTitleError(null); }}
              placeholder={`${reportingYear} ESG Reporting Package`}
              className="glass-subtle rounded-2xl border-white/60 text-sm"
            />
          </Field>
        </div>

        <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-[rgba(32,167,121,0.3)] bg-[rgba(32,167,121,0.07)] p-3.5">
          <ShieldIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#238653]" />
          <p className="text-[12.5px] font-medium leading-relaxed text-[color:var(--ink-soft)]">
            This submits the package to the Group Admin&apos;s reporting workflow. The Group Admin owns the consolidated BRSR report.
          </p>
        </div>
      </GlassDialog>

      {/* ── resubmit confirm (CHANGES_REQUESTED) — Group feedback shown prominently ── */}
      <ConfirmDialog
        open={!!resubmitTarget}
        onOpenChange={(o) => { if (!o) setResubmitTarget(null); }}
        title="Resubmit reporting package"
        message={resubmitTarget?.groupFeedback
          ? `Group feedback — address it before resubmitting: “${resubmitTarget.groupFeedback}” Resubmitting sends an updated consolidation snapshot to the Group Admin's reporting workflow.`
          : "Resubmitting sends an updated consolidation snapshot of approved records to the Group Admin's reporting workflow."}
        confirmLabel="Resubmit to Group"
        onConfirm={resubmit}
        pending={resubmitMut.pending}
      />
    </div>
  );
}
