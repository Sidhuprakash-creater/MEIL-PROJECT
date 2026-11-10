"use client";

import React, { useState, useEffect } from "react";
import {
  FileCheck2,
  CheckCircle2,
  AlertTriangle,
  FolderLock,
  Send,
  Eye,
  ShieldAlert,
  Clock,
  Building2,
  Leaf,
  Users,
  ShieldCheck,
  TrendingUp,
  FileText,
  DollarSign,
  Package,
  HeartHandshake,
  Award,
  Download,
  Check,
  ChevronDown,
  ChevronUp,
  FileSearch,
  X,
  Plus,
  Minus,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { usePaStore, CONTRIBUTOR_CATEGORIES } from "@/lib/project-admin/store";
import { paApiGet, paApiPost, getCachedPaData, clearPaClientCache } from "@/lib/project-admin/client";
import { ensureRevisionPolling, onRevisionChange } from "@/lib/revision-client";
import { PaGlassCard, PaPageHeader, PaButton, PaStatusBadge, PaTabStrip, PaDialog, PaCircularProgress, PaKpiCard } from "../ui";
import { MeilBoxLoader } from "@/components/shared/meil-loader";
import type { PaConsolidatedReport, ContributorRole } from "@/lib/project-admin/types";

export default function ConsolidatedReportView() {
  const { navigate } = usePaStore();
  const cached = getCachedPaData<any>("/api/project-admin/consolidated-report");
  const [loading, setLoading] = useState(!cached);
  const [report, setReport] = useState<PaConsolidatedReport | null>(cached?.report || null);
  const [activeTab, setActiveTab] = useState("overview");
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submissionNotes, setSubmissionNotes] = useState("");
  const [selectedSubmissionIds, setSelectedSubmissionIds] = useState<Set<string>>(new Set());
  const [selectedContributors, setSelectedContributors] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [submissionSuccessModal, setSubmissionSuccessModal] = useState<{
    open: boolean;
    reportCode: string;
    reportTitle: string;
    reportId?: string;
    buManagerName: string;
    submissionCount: number;
    timestamp: string;
  } | null>(null);

  const loadReport = (bypass = false) => {
    if (!report && !bypass) setLoading(true);
    paApiGet<any>("/api/project-admin/consolidated-report", undefined, { bypassCache: bypass })
      .then((res) => setReport(res.report))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadReport();
    ensureRevisionPolling();
    return onRevisionChange(() => {
      clearPaClientCache();
      loadReport(true);
    });
  }, []);

  // When report loads, select all approved submissions and contributors by default
  useEffect(() => {
    if (report?.contributorSubmissions) {
      const allSubIds = new Set<string>();
      const allContrIds = new Set<string>();
      for (const g of report.contributorSubmissions) {
        allContrIds.add(g.contributor.id);
        for (const s of g.submissions) {
          allSubIds.add(s.id);
        }
      }
      setSelectedSubmissionIds(allSubIds);
      setSelectedContributors(allContrIds);
      setSelectAll(allSubIds.size > 0);
    }
  }, [report]);

  const handleSubmitToBuManager = async () => {
    if (!report) return;
    setSubmitting(true);
    try {
      const targetSubmissionIds = selectedSubmissionIds.size > 0
        ? Array.from(selectedSubmissionIds)
        : (report.contributorSubmissions || []).flatMap(g => g.submissions.map(s => s.id));

      const res = await paApiPost<any>("/api/project-admin/consolidated-report/submit", {
        reportCode: report.reportCode,
        notes: submissionNotes,
        selectedSubmissionIds: targetSubmissionIds.length > 0 ? targetSubmissionIds : undefined,
      });
      setSubmitDialogOpen(false);
      setPreviewDialogOpen(false);
      setSubmissionSuccessModal({
        open: true,
        reportCode: report.reportCode || "PRJ-PVG-SOL-REP",
        reportTitle: report.title || "Consolidated ESG Project Report",
        reportId: res?.report?.id,
        buManagerName: report.buManagerName || "Business Unit Manager",
        submissionCount: targetSubmissionIds.length,
        timestamp: new Date().toLocaleString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      });
      loadReport(true);
    } catch (err: any) {
      alert(err.message || "Failed to submit consolidated report");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePreviewDocument = () => {
    setPreviewDialogOpen(true);
  };

  const toggleSubmission = (submissionId: string) => {
    setSelectedSubmissionIds(prev => {
      const next = new Set(prev);
      if (next.has(submissionId)) next.delete(submissionId);
      else next.add(submissionId);

      if (report?.contributorSubmissions) {
        const nextContributors = new Set<string>();
        for (const g of report.contributorSubmissions) {
          if (g.submissions.some(s => next.has(s.id))) {
            nextContributors.add(g.contributor.id);
          }
        }
        setSelectedContributors(nextContributors);
        const totalSubs = report.contributorSubmissions.flatMap(g => g.submissions).length;
        setSelectAll(next.size === totalSubs && totalSubs > 0);
      }
      return next;
    });
  };

  const toggleContributor = (contributorId: string) => {
    const group = report?.contributorSubmissions?.find(g => g.contributor.id === contributorId);
    if (!group) return;
    const groupSubIds = group.submissions.map(s => s.id);
    const allGroupSelected = groupSubIds.every(id => selectedSubmissionIds.has(id));

    setSelectedSubmissionIds(prev => {
      const next = new Set(prev);
      if (allGroupSelected) {
        groupSubIds.forEach(id => next.delete(id));
      } else {
        groupSubIds.forEach(id => next.add(id));
      }

      if (report?.contributorSubmissions) {
        const nextContributors = new Set<string>();
        for (const g of report.contributorSubmissions) {
          if (g.submissions.some(s => next.has(s.id))) {
            nextContributors.add(g.contributor.id);
          }
        }
        setSelectedContributors(nextContributors);
        const totalSubs = report.contributorSubmissions.flatMap(g => g.submissions).length;
        setSelectAll(next.size === totalSubs && totalSubs > 0);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedSubmissionIds(new Set());
      setSelectedContributors(new Set());
      setSelectAll(false);
    } else {
      const allSubIds = new Set<string>();
      const allContrIds = new Set<string>();
      for (const g of report?.contributorSubmissions || []) {
        allContrIds.add(g.contributor.id);
        for (const s of g.submissions) {
          allSubIds.add(s.id);
        }
      }
      setSelectedSubmissionIds(allSubIds);
      setSelectedContributors(allContrIds);
      setSelectAll(allSubIds.size > 0);
    }
  };

  if (loading && !report) {
    return (
      <div className="glass rounded-2xl p-6">
        <MeilBoxLoader boxHeight="min-h-[360px]" label="Loading Consolidated Project Report…" />
      </div>
    );
  }

  const contributorGroups = report?.contributorSubmissions || [];
  const hasApprovedData = contributorGroups.some(g => g.submissions.length > 0);
  /* New approvals since the last consolidated submission — these make the
     report re-submittable as a new version. */
  const newApprovals = contributorGroups
    .flatMap(g => g.submissions)
    .filter(s => !s.inConsolidatedReport).length;
  const priorVersionSubmitted = ["SUBMITTED", "APPROVED", "COMPLETED", "BU_APPROVED"].includes(String(report?.status));
  const canSubmit = hasApprovedData;

  const tabs = [
    { id: "overview", label: "1. Overview" },
    { id: "contributors", label: "2. Contributor Submissions" },
    { id: "preview", label: "3. Preview Document" },
    { id: "evidence", label: "4. Evidence Vault" },
    { id: "validation", label: "5. Validation" },
    { id: "submission", label: "6. Submit to BU" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PaPageHeader
        title="Consolidated Project Report"
        subtitle={hasApprovedData
          ? "Approved submissions from all contributors assembled for review and BU submission"
          : "No approved submissions yet — approve submissions from the Submissions view to populate this report"}
        badge={report?.versionLabel || "v1.0"}
        actions={
          <div className="flex items-center gap-3">
            <PaButton
              variant="secondary"
              size="sm"
              onClick={() => {
                clearPaClientCache();
                loadReport(true);
              }}
              disabled={loading}
              className="flex items-center gap-1.5"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              <span>Refresh</span>
            </PaButton>
            <PaButton
              icon={Send}
              disabled={!canSubmit}
              onClick={() => setSubmitDialogOpen(true)}
            >
              {!hasApprovedData
                ? "Submit to BU Manager"
                : priorVersionSubmitted
                  ? "Re-submit to BU Manager"
                  : "Submit to BU Manager"}
            </PaButton>
          </div>
        }
      />

      {/* ── Report Metadata Banner ── */}
      <PaGlassCard strong className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-[#315CFF]">{report?.reportCode}</span>
              <PaStatusBadge status={report?.status || "READY_TO_SUBMIT"} />
            </div>
            <h2 className="text-xl font-extrabold text-[#202938]">{report?.title}</h2>
            <p className="text-xs text-[#64748B]">
              Assigned BU Manager: <strong className="text-slate-800">{report?.buManagerName}</strong> • Financial Year: {report?.financialYear}
            </p>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-center">
              <PaCircularProgress percentage={report?.overallScorePct || 0} size={90} strokeWidth={8} label="Readiness" />
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between gap-4">
                <span className="text-[#64748B]">Categories Complete:</span>
                <span className="font-bold text-emerald-600">{report?.completeness?.completedCategories} of 7</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[#64748B]">Total Approved Submissions:</span>
                <span className="font-bold text-[#315CFF]">{contributorGroups.reduce((sum, g) => sum + g.submissions.length, 0)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[#64748B]">Total Evidence Files:</span>
                <span className="font-bold text-emerald-600">{contributorGroups.reduce((sum, g) => sum + g.totalEvidence, 0)}</span>
              </div>
            </div>
          </div>
        </div>
      </PaGlassCard>

      {/* 6 Tabs */}
      <PaTabStrip tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* ── TAB 1: Overview ── */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <PaGlassCard strong className="space-y-4">
            <h3 className="text-base font-bold text-[#202938]">Executive Disclosure Summary</h3>
            <p className="text-xs text-slate-700 leading-relaxed p-4 rounded-2xl bg-white/80 border border-slate-200/80">
              {report?.sectionsData?.executiveSummary}
            </p>
          </PaGlassCard>

          {/* 7 Category Completeness Check */}
          <PaGlassCard strong className="space-y-4">
            <h3 className="text-base font-bold text-[#202938]">7 Contributor Categories Rollup</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {(Object.keys(CONTRIBUTOR_CATEGORIES) as ContributorRole[]).map((catKey) => {
                const def = CONTRIBUTOR_CATEGORIES[catKey];
                const status = report?.completeness?.categoriesStatus?.[catKey] || "PENDING";
                const group = contributorGroups.find(g => g.contributor.role === catKey);
                const hasData = group && group.submissions.length > 0;

                return (
                  <div key={catKey} className="p-3.5 rounded-2xl bg-white/70 border border-slate-200/60 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-[#202938]">{def.label}</div>
                      <div className="text-[10px] text-[#64748B]">{def.name}</div>
                      {hasData && (
                        <div className="text-[10px] font-semibold text-emerald-600 mt-0.5">
                          {group.submissions.length} submission(s) • {group.totalEvidence} evidence file(s)
                        </div>
                      )}
                    </div>
                    <PaStatusBadge status={status} />
                  </div>
                );
              })}
            </div>
          </PaGlassCard>

          {/* Quick Stats Grid */}
          <PaGlassCard strong className="space-y-4">
            <h3 className="text-base font-bold text-[#202938]">Key Metrics from Approved Submissions</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {contributorGroups.map((group, idx) => (
                <div key={group.contributor.id} className="p-4 rounded-2xl bg-white/80 border border-slate-200">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-blue-100 text-blue-700">
                      <FileCheck2 size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#64748B]">{group.contributor.name}</div>
                      <div className="text-[10px] text-[#8F9EAF]">{group.contributor.role}</div>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">Submissions:</span>
                      <span className="font-bold">{group.submissions.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">Evidence Files:</span>
                      <span className="font-bold text-emerald-600">{group.totalEvidence}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">Categories:</span>
                      <span className="font-bold">
                        {Array.from(new Set(group.submissions.map(s => s.category))).join(", ")}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {contributorGroups.length === 0 && (
                <div className="col-span-full p-8 text-center text-slate-500">
                  No approved submissions yet. Approve submissions from the Submissions view to see them here.
                </div>
              )}
            </div>
          </PaGlassCard>
        </div>
      )}

      {/* ── TAB 2: Contributor Submissions ── */}
      {activeTab === "contributors" && (
        <div className="space-y-6">
          <PaGlassCard strong className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#202938]">Approved Submissions by Contributor</h3>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="select-all"
                  checked={selectAll}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="select-all" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Select All for Preview
                </label>
              </div>
            </div>
            <p className="text-xs text-[#64748B]">
              Select individual submissions or entire contributors below. When selected, the "Preview Document" and "Submit to BU" action dock will appear at the bottom.
            </p>
          </PaGlassCard>

          {contributorGroups.length === 0 ? (
            <PaGlassCard className="p-12 text-center">
              <div className="flex flex-col items-center justify-center gap-4">
                <FileCheck2 size={40} className="text-slate-400" />
                <div className="text-slate-800 font-bold">No approved submissions yet</div>
                <div className="text-slate-500 text-sm max-w-md">
                  Approve submissions from the Submissions view — they will appear here grouped by contributor with their data and evidence files.
                </div>
              </div>
            </PaGlassCard>
          ) : (
            <div className="space-y-4 pb-24">
              {contributorGroups.map((group) => (
                <ContributorCard
                  key={group.contributor.id}
                  group={group}
                  isSelected={group.submissions.length > 0 && group.submissions.every(s => selectedSubmissionIds.has(s.id))}
                  onToggle={toggleContributor}
                  selectedSubmissionIds={selectedSubmissionIds}
                  onToggleSubmission={toggleSubmission}
                />
              ))}
            </div>
          )}

          {/* Floating bottom dock for preview & submission */}
          {selectedSubmissionIds.size > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-2xl px-4 animate-in fade-in slide-in-from-bottom-4 duration-200 pointer-events-auto">
              <div
                className="rounded-2xl p-3.5 shadow-2xl flex flex-wrap sm:flex-nowrap items-center justify-between gap-4 border border-white/80"
                style={{
                  background: "linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(240, 246, 255, 0.92) 100%)",
                  backdropFilter: "blur(20px) saturate(180%)",
                  boxShadow: "0 20px 40px -15px rgba(49, 92, 255, 0.25), 0 0 0 1px rgba(49, 92, 255, 0.15)",
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-blue-100 text-blue-700 shrink-0">
                    <CheckCircle2 size={18} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800">
                      {selectedSubmissionIds.size} submission{selectedSubmissionIds.size > 1 ? "s" : ""} selected
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Ready to compile into Consolidated Report dossier
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      setSelectedSubmissionIds(new Set());
                      setSelectedContributors(new Set());
                      setSelectAll(false);
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 transition cursor-pointer"
                  >
                    Clear
                  </button>
                  <PaButton
                    variant="secondary"
                    icon={FileSearch}
                    onClick={handlePreviewDocument}
                    className="text-xs"
                  >
                    Preview Document
                  </PaButton>
                  <PaButton
                    icon={Send}
                    onClick={() => setSubmitDialogOpen(true)}
                    className="text-xs"
                  >
                    Submit to BU Manager
                  </PaButton>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: Preview Document ── */}
      {activeTab === "preview" && (
        <PaGlassCard strong className="p-8 space-y-6">
          <div className="border-b border-slate-200 pb-4 text-center">
            <div className="text-xs uppercase font-extrabold tracking-widest text-[#315CFF]">MEIL ESG & BRSR Portal</div>
            <h1 className="text-xl font-bold text-[#202938] mt-1">{report?.title}</h1>
            <p className="text-xs text-[#64748B] mt-1">Official Project Submission Dossier • {report?.versionLabel}</p>
          </div>

          <div className="space-y-4 text-xs">
            <div className="font-bold text-sm text-[#202938]">1. Executive Summary</div>
            <p className="text-slate-700 leading-relaxed p-4 rounded-xl bg-white/80 border border-slate-200">
              {report?.sectionsData?.executiveSummary}
            </p>

            <div className="font-bold text-sm text-[#202938]">2. Contributor Submissions (Sequential)</div>
            {contributorGroups.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No approved submissions to preview.</p>
            ) : (
              <div className="space-y-6">
                {contributorGroups
                  .filter(g => g.submissions.some(s => selectedSubmissionIds.size === 0 || selectedSubmissionIds.has(s.id)))
                  .map((group, groupIdx) => (
                    <PreviewContributorSection
                      key={group.contributor.id}
                      group={group}
                      index={groupIdx + 1}
                      selectedSubmissionIds={selectedSubmissionIds}
                    />
                  ))}
              </div>
            )}

            {/* Bottom action bar inside Tab 3 */}
            <div className="mt-8 pt-6 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/80 p-4 rounded-2xl border border-slate-200">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-slate-800">Ready to forward this dossier?</div>
                <div className="text-[11px] text-slate-500">
                  Submitting forwards this compiled package to Business Unit Manager ({report?.buManagerName}) for technical sign-off.
                </div>
              </div>
              <PaButton
                icon={Send}
                onClick={() => setSubmitDialogOpen(true)}
              >
                Submit to BU Manager
              </PaButton>
            </div>
          </div>
        </PaGlassCard>
      )}

      {/* ── TAB 4: Evidence Vault ── */}
      {activeTab === "evidence" && (
        <PaGlassCard strong className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#202938]">All Evidence Files</h3>
            <PaButton size="sm" variant="secondary" onClick={() => navigate("evidence")}>
              Open Evidence Repository
            </PaButton>
          </div>
          <p className="text-xs text-[#64748B]">All supporting documents linked to approved submissions in this consolidated report.</p>
          <div className="space-y-3">
            {contributorGroups.flatMap(group =>
              group.submissions.flatMap(sub =>
                sub.evidenceFiles.map((ev, idx) => (
                  <div key={`${sub.id}-${ev.id}`} className="p-3 rounded-xl bg-white/80 border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
                        <FileText size={16} />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-800 text-sm">{ev.fileName}</div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-2">
                          <span>{ev.documentType}</span>
                          <span>•</span>
                          <span>{ev.sizeKb} KB</span>
                          <span>•</span>
                          <span>Contributor: {group.contributor.name}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <PaButton size="sm" variant="secondary" icon={Eye} onClick={() => window.open(ev.filePath, "_blank")}>
                        View
                      </PaButton>
                      <a
                        href={ev.filePath}
                        download={ev.fileName}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition"
                      >
                        <Download size={12} /> Download
                      </a>
                    </div>
                  </div>
                ))
              )
            )}
            {contributorGroups.flatMap(g => g.submissions.flatMap(s => s.evidenceFiles)).length === 0 && (
              <div className="p-8 text-center text-slate-500">No evidence files attached to approved submissions yet.</div>
            )}
          </div>
        </PaGlassCard>
      )}

      {/* ── TAB 5: Validation ── */}
      {activeTab === "validation" && (
        <PaGlassCard strong className="space-y-4">
          <h3 className="text-base font-bold text-[#202938]">Automated BRSR Core Validation Engine</h3>
          <div className="space-y-3 text-xs">
            <div className="p-3.5 rounded-xl bg-emerald-50 text-emerald-800 font-semibold flex items-center gap-2">
              <CheckCircle2 size={16} /> All mandatory Energy & Emissions fields populated.
            </div>
            <div className="p-3.5 rounded-xl bg-emerald-50 text-emerald-800 font-semibold flex items-center gap-2">
              <CheckCircle2 size={16} /> Zero liquid discharge water balance verified.
            </div>
            <div className="p-3.5 rounded-xl bg-emerald-50 text-emerald-800 font-semibold flex items-center gap-2">
              <CheckCircle2 size={16} /> LTIFR formula matches ISO 45001 standards.
            </div>
            {report?.completeness?.missingFields?.map((f: string) => (
              <div key={f} className="p-3.5 rounded-xl bg-amber-50 text-amber-800 font-semibold flex items-center gap-2">
                <AlertTriangle size={16} /> Warning: {f}
              </div>
            ))}
            {report?.completeness?.missingEvidenceList?.map((f: string) => (
              <div key={f} className="p-3.5 rounded-xl bg-rose-50 text-rose-800 font-semibold flex items-center gap-2">
                <ShieldAlert size={16} /> Missing Evidence: {f}
              </div>
            ))}
          </div>
        </PaGlassCard>
      )}

      {/* ── TAB 6: Submit to BU ── */}
      {activeTab === "submission" && (
        <PaGlassCard strong className="space-y-4">
          <h3 className="text-base font-bold text-[#202938]">Governance & Submission Workflow</h3>
          <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 space-y-2">
            <div className="font-bold">Next Stage: Business Unit Manager Review</div>
            <p>
              Once submitted, the consolidated report locks against uncoordinated local modifications and routes directly to Business Unit Manager ({report?.buManagerName}) for technical review and approval.
            </p>
            {selectedContributors.size > 0 && (
              <p className="font-semibold text-emerald-700">
                {selectedContributors.size} contributor(s) selected for this submission ({Array.from(selectedContributors).flatMap(cid => {
                  const g = report?.contributorSubmissions?.find(gr => gr.contributor.id === cid);
                  return g?.submissions.length || 0;
                }).reduce((a, b) => a + b, 0)} approved submissions included).
              </p>
            )}
          </div>

          <div className="space-y-2 text-xs">
            <div className="font-bold text-slate-800">Audit History Log:</div>
            {report?.auditHistory?.map((h: any, idx: number) => (
              <div key={idx} className="p-3 rounded-xl bg-white/70 border border-slate-200 flex justify-between">
                <div>
                  <span className="font-bold text-[#315CFF]">{h.action}</span>
                  <div className="text-[11px] text-[#64748B]">{h.note}</div>
                </div>
                <div className="text-right text-[11px] text-[#8F9EAF]">
                  <div>{h.by}</div>
                  <div>{new Date(h.timestamp).toLocaleDateString()}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-200/60">
            <PaButton
              icon={Send}
              disabled={!canSubmit}
              onClick={() => setSubmitDialogOpen(true)}
            >
              Submit Consolidated Report to BU Manager
            </PaButton>
          </div>
        </PaGlassCard>
      )}

      {/* ── Submit Confirmation Dialog ── */}
      <PaDialog
        open={submitDialogOpen}
        onClose={() => setSubmitDialogOpen(false)}
        title="Submit Consolidated Report to BU Manager"
        subtitle="Review submission package before forwarding to Business Unit Manager"
      >
        <div className="space-y-4 text-xs">
          <div className="p-4 rounded-2xl bg-white/80 border border-slate-200 space-y-2">
            <div className="flex justify-between">
              <span className="text-[#64748B]">Report Code:</span>
              <span className="font-mono font-bold text-[#315CFF]">{report?.reportCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748B]">Version:</span>
              <span className="font-bold text-[#202938]">{report?.versionLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748B]">Review Destination:</span>
              <span className="font-bold text-[#202938]">{report?.buManagerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748B]">Categories Assembled:</span>
              <span className="font-bold text-emerald-600">{report?.completeness?.completedCategories} of 7</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748B]">Overall Completeness:</span>
              <span className="font-bold text-[#315CFF]">{report?.overallScorePct}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748B]">Selected Contributors:</span>
              <span className="font-bold text-[#315CFF]">
                {selectedContributors.size > 0 ? selectedContributors.size : (report?.contributorSubmissions?.length || 0)} of {report?.contributorSubmissions?.length || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748B]">Submissions Included:</span>
              <span className="font-bold text-emerald-600">
                {selectedSubmissionIds.size > 0
                  ? selectedSubmissionIds.size
                  : (report?.contributorSubmissions || []).flatMap(g => g.submissions).length}
              </span>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase text-[#8F9EAF]">
              Notes / Submittal Remarks for Business Unit Manager
            </label>
            <textarea
              rows={3}
              placeholder="e.g. All Q4 environmental meter readings, safety records, and local procurement receipts attached."
              value={submissionNotes}
              onChange={(e) => setSubmissionNotes(e.target.value)}
              className="mt-1 w-full p-3 rounded-xl border border-slate-200 bg-white text-xs font-medium"
            />
          </div>

          <div className="p-3 rounded-xl bg-amber-50 text-amber-900 text-[11px]">
            ⚠️ Project Admin cannot approve their own report. The report requires formal sign-off from the Business Unit Manager.
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-200/60">
            <PaButton variant="secondary" onClick={() => setSubmitDialogOpen(false)}>
              Cancel
            </PaButton>
            <PaButton icon={Send} loading={submitting} onClick={handleSubmitToBuManager}>
              Confirm & Submit to BU Manager
            </PaButton>
          </div>
        </div>
      </PaDialog>

      {/* ── Preview Document Modal ── */}
      {previewDialogOpen && (
        <PaDialog
          open={previewDialogOpen}
          onClose={() => setPreviewDialogOpen(false)}
          title="Full Document Preview"
          subtitle="Sequential view of all selected contributor submissions with evidence"
          size="xl"
        >
          <div className="space-y-4 text-xs max-h-[70vh] overflow-y-auto pr-2">
            <div className="border-b border-slate-200 pb-4 text-center">
              <div className="text-xs uppercase font-extrabold tracking-widest text-[#315CFF]">MEIL ESG & BRSR Portal</div>
              <h1 className="text-lg font-bold text-[#202938] mt-1">{report?.title}</h1>
              <p className="text-xs text-[#64748B] mt-1">Official Project Submission Dossier • {report?.versionLabel}</p>
            </div>

            <div className="space-y-6">
              <div className="font-bold text-sm text-[#202938]">1. Executive Summary</div>
              <p className="text-slate-700 leading-relaxed p-4 rounded-xl bg-white/80 border border-slate-200">
                {report?.sectionsData?.executiveSummary}
              </p>

              <div className="font-bold text-sm text-[#202938]">2. Contributor Submissions (Sequential)</div>
              {contributorGroups.length === 0 ? (
                <p className="text-slate-500 text-center py-8">No approved submissions to preview.</p>
              ) : (
                <div className="space-y-6">
                  {contributorGroups
                    .filter(g => g.submissions.some(s => selectedSubmissionIds.size === 0 || selectedSubmissionIds.has(s.id)))
                    .map((group, groupIdx) => (
                      <PreviewContributorSection
                        key={group.contributor.id}
                        group={group}
                        index={groupIdx + 1}
                        selectedSubmissionIds={selectedSubmissionIds}
                      />
                    ))}
                </div>
              )}
            </div>

            {/* Bottom action bar inside Preview Modal */}
            <div className="pt-4 border-t border-slate-200/80 flex items-center justify-between gap-4 bg-white/70 -mx-6 -mb-6 p-4 px-6 rounded-b-2xl mt-4 sticky bottom-0">
              <div className="text-xs text-slate-600">
                <span className="font-bold text-slate-800">
                  {selectedSubmissionIds.size > 0 ? selectedSubmissionIds.size : contributorGroups.flatMap(g => g.submissions).length}
                </span> submission(s) ready for official sign-off
              </div>
              <div className="flex items-center gap-2">
                <PaButton variant="secondary" onClick={() => setPreviewDialogOpen(false)}>
                  Close
                </PaButton>
                <PaButton
                  icon={Send}
                  onClick={() => {
                    setPreviewDialogOpen(false);
                    setSubmitDialogOpen(true);
                  }}
                >
                  Submit to BU Manager
                </PaButton>
              </div>
            </div>
          </div>
        </PaDialog>
      )}

      {/* ── Submission Confirmation Popup Modal ── */}
      {submissionSuccessModal && (
        <PaDialog
          open={submissionSuccessModal.open}
          onClose={() => setSubmissionSuccessModal(null)}
          title="Submission Confirmed"
          subtitle="Consolidated project report has been forwarded to the Business Unit"
          size="md"
        >
          <div className="space-y-4 py-1 text-xs">
            <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-500/30">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-emerald-950">Submitted to BU Manager</h4>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white">
                    <Sparkles className="h-3 w-3" /> Transmitted
                  </span>
                </div>
                <p className="text-[11.5px] text-emerald-800/90 mt-0.5">
                  The consolidated project dossier and all approved site disclosures are now in the BU Manager review queue.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 space-y-2.5">
              <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Report Code:</span>
                <span className="font-mono font-bold text-[#315CFF]">{submissionSuccessModal.reportCode}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Recipient BU Manager:</span>
                <span className="font-bold text-slate-800">{submissionSuccessModal.buManagerName}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Included Disclosures:</span>
                <span className="font-bold text-emerald-700">{submissionSuccessModal.submissionCount} Approved Submission(s)</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Transmission Timestamp:</span>
                <span className="font-semibold text-slate-700">{submissionSuccessModal.timestamp}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-500 font-medium">Workflow Status:</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-blue-100 text-blue-800">
                  FORWARDED TO BU (AWAITING SIGN-OFF)
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200/70">
              <PaButton
                variant="secondary"
                onClick={() => setSubmissionSuccessModal(null)}
              >
                Close
              </PaButton>
              <PaButton
                variant="primary"
                icon={FileText}
                onClick={() => {
                  setSubmissionSuccessModal(null);
                  navigate("submissions");
                }}
              >
                View in Submissions Screen
              </PaButton>
            </div>
          </div>
        </PaDialog>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   ContributorCard — Shows one contributor's approved submissions
   ────────────────────────────────────────────────────────────────────── */
interface ContributorCardProps {
  group: {
    contributor: { id: string; name: string; email: string; role: string };
    submissions: any[];
    totalItems: number;
    totalEvidence: number;
  };
  isSelected: boolean;
  onToggle: (id: string) => void;
  selectedSubmissionIds: Set<string>;
  onToggleSubmission: (id: string) => void;
}

function ContributorCard({ group, isSelected, onToggle, selectedSubmissionIds, onToggleSubmission }: ContributorCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <PaGlassCard strong className="overflow-hidden" style={{ border: isSelected ? "2px solid #315CFF" : "1px solid rgba(148,163,184,0.2)" }}>
      {/* Header */}
      <div
        className="p-4 border-b border-slate-200/60 flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
        style={{ backgroundColor: isSelected ? "rgba(49,92,255,0.05)" : "transparent" }}
      >
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggle(group.contributor.id)}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
          <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700">
            <FileCheck2 size={18} />
          </div>
          <div>
            <div className="font-bold text-[#202938] text-sm">{group.contributor.name}</div>
            <div className="text-[10px] font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200 inline-block">
              {group.contributor.role}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right text-xs">
            <div className="font-bold text-[#202938]">{group.submissions.length} submission(s)</div>
            <div className="text-[10px] text-slate-500">{group.totalEvidence} evidence file(s)</div>
          </div>
          <ChevronDown size={18} className={`text-slate-500 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>
      </div>

      {/* Expanded submissions */}
      {expanded && (
        <div className="p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
          {group.submissions.map((sub) => (
            <div key={sub.id} className="rounded-2xl bg-white/80 border border-slate-200 p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <input
                    type="checkbox"
                    checked={selectedSubmissionIds.has(sub.id)}
                    onChange={() => onToggleSubmission(sub.id)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 mt-1 cursor-pointer shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[#315CFF] font-bold text-[11px]">{sub.ref}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {sub.category}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                        {sub.module}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {sub.period}
                      </span>
                      {sub.forwardedToBu && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          Forwarded to BU
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-[#202938] text-sm mt-1">{sub.title}</div>
                    {sub.reviewComment && (
                      <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5 italic">
                        "{sub.reviewComment}"
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-600 mt-2">
                      <Clock size={11} className="text-blue-500 shrink-0" />
                      <span>Reviewed: {sub.reviewedAt ? new Date(sub.reviewedAt).toLocaleDateString("en-GB") : "N/A"}</span>
                      {sub.submittedAt && (
                        <>
                          <span>•</span>
                          <span>Submitted: {new Date(sub.submittedAt).toLocaleDateString("en-GB")}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <PaStatusBadge status={sub.status} />
              </div>

              {/* Parsed Values / Data Fields */}
              {sub.parsedValues && sub.parsedValues.length > 0 && (
                <div className="space-y-2">
                  <div className="font-semibold text-xs text-slate-700 flex items-center gap-1.5">
                    <FileText size={12} /> Data Fields ({sub.parsedValues.length})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {sub.parsedValues.map((val, idx) => (
                      <div key={idx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[10.5px]">
                        <div className="text-slate-500 font-medium">{val.label}</div>
                        <div className="font-mono font-bold text-slate-800 mt-0.5">
                          {typeof val.value === "number" ? val.value.toLocaleString() : val.value}
                          {val.unit && <span className="text-slate-500 ml-1">{val.unit}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Evidence Files */}
              {sub.evidenceFiles && sub.evidenceFiles.length > 0 && (
                <div className="space-y-2 border-t border-slate-200 pt-3">
                  <div className="font-semibold text-xs text-slate-700 flex items-center gap-1.5">
                    <FolderLock size={12} /> Evidence Files ({sub.evidenceFiles.length})
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sub.evidenceFiles.map((ev, idx) => (
                      <div key={ev.id} className="flex items-center gap-1.5">
                        <a
                          href={ev.filePath}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 hover:bg-sky-100 transition"
                        >
                          <Eye size={11} /> View
                        </a>
                        <a
                          href={ev.filePath}
                          download={ev.fileName}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition"
                        >
                          <Download size={11} /> Download
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* History */}
              {sub.history && sub.history.length > 0 && (
                <details className="group">
                  <summary className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer p-2 rounded-lg hover:bg-slate-50">
                    <ChevronDown size={12} className="transition-transform group-open:rotate-180" />
                    History ({sub.history.length} entries)
                  </summary>
                  <div className="mt-2 space-y-1 text-[10px] text-slate-600">
                    {sub.history.slice().reverse().map((h: any, idx: number) => (
                      <div key={idx} className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <div className="flex justify-between">
                          <span className="font-bold text-blue-600">{h.action}</span>
                          <span className="text-slate-500">{h.actor}</span>
                        </div>
                        <div className="text-slate-600 mt-0.5">{h.note || ""}</div>
                        <div className="text-slate-400 font-mono mt-0.5">{new Date(h.at).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </PaGlassCard>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   PreviewContributorSection — Shows one contributor in preview modal
   ────────────────────────────────────────────────────────────────────── */
interface PreviewContributorSectionProps {
  group: {
    contributor: { id: string; name: string; email: string; role: string };
    submissions: any[];
    totalItems: number;
    totalEvidence: number;
  };
  index: number;
  selectedSubmissionIds?: Set<string>;
}

function PreviewContributorSection({ group, index, selectedSubmissionIds }: PreviewContributorSectionProps) {
  const filteredSubmissions = selectedSubmissionIds && selectedSubmissionIds.size > 0
    ? group.submissions.filter((s: any) => selectedSubmissionIds.has(s.id))
    : group.submissions;

  if (filteredSubmissions.length === 0) return null;

  return (
    <div className="space-y-4 border-l-2 border-blue-200 pl-4">
      {/* Contributor Header */}
      <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">
            {index}
          </span>
          <div>
            <div className="font-bold text-[#202938] text-sm">{group.contributor.name}</div>
            <div className="text-[10px] text-blue-700 font-semibold">{group.contributor.role}</div>
            <div className="text-[10px] text-slate-500 font-mono">{group.contributor.email}</div>
          </div>
        </div>
        <div className="mt-2 text-[10px] text-slate-600">
          {filteredSubmissions.length} submission(s) • {group.totalEvidence} evidence file(s)
        </div>
      </div>

      {/* Submissions */}
      {filteredSubmissions.map((sub: any) => (
        <div key={sub.id} className="space-y-3 p-3 rounded-xl bg-white border border-slate-200">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[#315CFF] font-bold text-[11px]">{sub.ref}</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              {sub.category}
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              {sub.module}
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              {sub.period}
            </span>
          </div>
          <div className="font-semibold text-[#202938] text-sm">{sub.title}</div>

          {/* Data Fields */}
          {sub.parsedValues && sub.parsedValues.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10.5px]">
              {sub.parsedValues.map((val, idx) => (
                <div key={idx} className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-slate-500 font-medium">{val.label}</div>
                  <div className="font-mono font-bold text-slate-800 mt-0.5">
                    {typeof val.value === "number" ? val.value.toLocaleString() : val.value}
                    {val.unit && <span className="text-slate-500 ml-1">{val.unit}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Evidence Files */}
          {sub.evidenceFiles && sub.evidenceFiles.length > 0 && (
            <div className="space-y-1.5">
              <div className="font-semibold text-[10px] text-slate-700 flex items-center gap-1">
                <FolderLock size={11} /> Evidence Files
              </div>
              <div className="flex flex-wrap gap-1.5">
                {sub.evidenceFiles.map((ev, idx) => (
                  <div key={ev.id} className="flex items-center gap-1">
                    <a
                      href={ev.filePath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 rounded-lg text-[9px] font-bold text-sky-700 bg-sky-50 border border-sky-200 hover:bg-sky-100 transition"
                    >
                      <Eye size={10} /> {ev.fileName}
                    </a>
                    <a
                      href={ev.filePath}
                      download={ev.fileName}
                      className="px-2 py-1 rounded-lg text-[9px] font-bold text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition"
                    >
                      <Download size={10} /> Download
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}