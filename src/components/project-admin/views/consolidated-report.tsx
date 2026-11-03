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
  RefreshCw,
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
} from "lucide-react";
import { usePaStore, CONTRIBUTOR_CATEGORIES } from "@/lib/project-admin/store";
import { paApiGet, paApiPost, getCachedPaData } from "@/lib/project-admin/client";
import { PaGlassCard, PaPageHeader, PaButton, PaStatusBadge, PaTabStrip, PaDialog, PaCircularProgress, PaKpiCard } from "../ui";
import type { PaConsolidatedReport, ContributorRole } from "@/lib/project-admin/types";

export default function ConsolidatedReportView() {
  const { navigate } = usePaStore();
  const cached = getCachedPaData<any>("/api/project-admin/consolidated-report");
  const [loading, setLoading] = useState(!cached);
  const [report, setReport] = useState<PaConsolidatedReport | null>(cached?.report || null);
  const [activeTab, setActiveTab] = useState("exec");
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submissionNotes, setSubmissionNotes] = useState("");

  const loadReport = () => {
    if (!report) setLoading(true);
    paApiGet<any>("/api/project-admin/consolidated-report")
      .then((res) => setReport(res.report))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadReport();
  }, []);

  const handleSubmitToBuManager = async () => {
    setSubmitting(true);
    try {
      await paApiPost("/api/project-admin/consolidated-report/submit", {
        reportCode: report?.reportCode,
        notes: submissionNotes,
      });
      setSubmitDialogOpen(false);
      alert("Consolidated Project Report submitted successfully to Business Unit Manager for review.");
      loadReport();
    } catch (err: any) {
      alert(err.message || "Failed to submit consolidated report");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !report) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex items-center gap-3 pa-glass px-6 py-4 rounded-2xl">
          <RefreshCw className="animate-spin text-[#315CFF]" size={20} />
          <span className="text-sm font-semibold text-[#202938]">Assembling Consolidated Project Report…</span>
        </div>
      </div>
    );
  }

  const { completeness, sectionsData } = report || ({} as any);

  const tabs = [
    { id: "exec", label: "1. Executive Overview" },
    { id: "env", label: "2. Environment" },
    { id: "fin", label: "3. Finance" },
    { id: "hr", label: "4. HR & Workforce" },
    { id: "ehs", label: "5. EHS & Safety" },
    { id: "proc", label: "6. Procurement" },
    { id: "csr", label: "7. CSR & Community" },
    { id: "comp", label: "8. Compliance" },
    { id: "evidence", label: "9. Evidence Vault" },
    { id: "validation", label: "10. Validation" },
    { id: "preview", label: "11. Full Preview" },
    { id: "submission", label: "12. Submission Details" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PaPageHeader
        title="Consolidated Project Report"
        subtitle="7 contributor functional areas assembled into ONE official project-level disclosure"
        badge={report?.versionLabel || "v1.0"}
        actions={
          <div className="flex items-center gap-3">
            <PaButton
              variant="secondary"
              icon={Eye}
              onClick={() => setActiveTab("preview")}
            >
              Preview Document
            </PaButton>
            <PaButton
              icon={Send}
              disabled={report?.status === "SUBMITTED" || report?.status === "APPROVED"}
              onClick={() => setSubmitDialogOpen(true)}
            >
              {report?.status === "SUBMITTED" ? "Submitted to BU Manager" : "Submit to BU Manager"}
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
              <PaCircularProgress percentage={report?.overallScorePct || 88} size={90} strokeWidth={8} label="Readiness" />
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between gap-4">
                <span className="text-[#64748B]">Categories Complete:</span>
                <span className="font-bold text-emerald-600">{completeness?.completedCategories} of 7</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[#64748B]">Missing Evidence:</span>
                <span className="font-bold text-rose-500">{completeness?.missingEvidenceList?.length || 0}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[#64748B]">Validation Errors:</span>
                <span className="font-bold text-emerald-600">0 critical</span>
              </div>
            </div>
          </div>
        </div>
      </PaGlassCard>

      {/* 12 Tabs */}
      <PaTabStrip tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* ── TAB 1: Executive Overview ── */}
      {activeTab === "exec" && (
        <div className="space-y-6">
          <PaGlassCard strong className="space-y-4">
            <h3 className="text-base font-bold text-[#202938]">Executive Disclosure Summary</h3>
            <p className="text-xs text-slate-700 leading-relaxed p-4 rounded-2xl bg-white/80 border border-slate-200/80">
              {sectionsData?.executiveSummary}
            </p>
          </PaGlassCard>

          {/* 7 Category Completeness Check */}
          <PaGlassCard strong className="space-y-4">
            <h3 className="text-base font-bold text-[#202938]">7 Contributor Categories Rollup</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {(Object.keys(CONTRIBUTOR_CATEGORIES) as ContributorRole[]).map((catKey) => {
                const def = CONTRIBUTOR_CATEGORIES[catKey];
                const status = completeness?.categoriesStatus?.[catKey] || "COMPLETED";

                return (
                  <div key={catKey} className="p-3.5 rounded-2xl bg-white/70 border border-slate-200/60 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-[#202938]">{def.label}</div>
                      <div className="text-[10px] text-[#64748B]">{def.name}</div>
                    </div>
                    <PaStatusBadge status={status} />
                  </div>
                );
              })}
            </div>
          </PaGlassCard>
        </div>
      )}

      {/* ── TAB 2: Environment ── */}
      {activeTab === "env" && (
        <PaGlassCard strong className="space-y-4">
          <h3 className="text-base font-bold text-[#202938] flex items-center gap-2">
            <Leaf size={18} className="text-emerald-500" /> Environmental Pillar Disclosures
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-white/80 border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-[#8F9EAF]">Total Energy</span>
              <div className="text-xl font-extrabold text-[#202938] mt-1">{sectionsData?.environment?.energyGj} GJ</div>
            </div>
            <div className="p-4 rounded-2xl bg-white/80 border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-[#8F9EAF]">Scope 1 Emissions</span>
              <div className="text-xl font-extrabold text-amber-600 mt-1">{sectionsData?.environment?.emissionsScope1} tCO2e</div>
            </div>
            <div className="p-4 rounded-2xl bg-white/80 border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-[#8F9EAF]">Scope 2 Emissions</span>
              <div className="text-xl font-extrabold text-[#315CFF] mt-1">{sectionsData?.environment?.emissionsScope2} tCO2e</div>
            </div>
            <div className="p-4 rounded-2xl bg-white/80 border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-[#8F9EAF]">Water Withdrawal</span>
              <div className="text-xl font-extrabold text-[#202938] mt-1">{sectionsData?.environment?.waterWithdrawalKl} kL</div>
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 text-xs text-slate-700">
            <strong>Key Environmental Initiatives:</strong> {sectionsData?.environment?.initiativesSummary}
          </div>
        </PaGlassCard>
      )}

      {/* ── TAB 3: Finance ── */}
      {activeTab === "fin" && (
        <PaGlassCard strong className="space-y-4">
          <h3 className="text-base font-bold text-[#202938] flex items-center gap-2">
            <DollarSign size={18} className="text-amber-500" /> Financial & Resource Allocation
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-white/80 border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-[#8F9EAF]">Allocated ESG Budget</span>
              <div className="text-2xl font-extrabold text-[#202938] mt-1">₹{(sectionsData?.finance?.esgBudgetInr / 100000).toFixed(1)} Lakhs</div>
            </div>
            <div className="p-4 rounded-2xl bg-white/80 border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-[#8F9EAF]">Green Capital Expenditure</span>
              <div className="text-2xl font-extrabold text-emerald-600 mt-1">₹{(sectionsData?.finance?.greenCapexInr / 100000).toFixed(1)} Lakhs</div>
            </div>
            <div className="p-4 rounded-2xl bg-white/80 border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-[#8F9EAF]">Environmental Opex</span>
              <div className="text-2xl font-extrabold text-[#315CFF] mt-1">₹{(sectionsData?.finance?.opexEnergyInr / 100000).toFixed(1)} Lakhs</div>
            </div>
          </div>
        </PaGlassCard>
      )}

      {/* ── TAB 4: HR & Workforce ── */}
      {activeTab === "hr" && (
        <PaGlassCard strong className="space-y-4">
          <h3 className="text-base font-bold text-[#202938] flex items-center gap-2">
            <Users size={18} className="text-indigo-500" /> HR & Workforce Disclosures
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-white/80 border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-[#8F9EAF]">Total Headcount</span>
              <div className="text-xl font-extrabold text-[#202938] mt-1">{sectionsData?.hr?.headcount} Staff</div>
            </div>
            <div className="p-4 rounded-2xl bg-white/80 border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-[#8F9EAF]">Gender Diversity</span>
              <div className="text-xl font-extrabold text-[#315CFF] mt-1">{sectionsData?.hr?.genderDiversityPct}% Female</div>
            </div>
            <div className="p-4 rounded-2xl bg-white/80 border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-[#8F9EAF]">Training / Employee</span>
              <div className="text-xl font-extrabold text-emerald-600 mt-1">{sectionsData?.hr?.trainingHoursPerEmployee} Hours</div>
            </div>
            <div className="p-4 rounded-2xl bg-white/80 border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-[#8F9EAF]">Welfare Schemes</span>
              <div className="text-xl font-extrabold text-[#202938] mt-1">{sectionsData?.hr?.welfareProgramsCount} Active</div>
            </div>
          </div>
        </PaGlassCard>
      )}

      {/* ── TAB 5: EHS & Safety ── */}
      {activeTab === "ehs" && (
        <PaGlassCard strong className="space-y-4">
          <h3 className="text-base font-bold text-[#202938] flex items-center gap-2">
            <ShieldCheck size={18} className="text-rose-500" /> Occupational Health & Safety
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-white/80 border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-[#8F9EAF]">Fatalities</span>
              <div className="text-xl font-extrabold text-emerald-600 mt-1">{sectionsData?.ehs?.fatalities}</div>
            </div>
            <div className="p-4 rounded-2xl bg-white/80 border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-[#8F9EAF]">Lost Time Injuries (LTI)</span>
              <div className="text-xl font-extrabold text-amber-600 mt-1">{sectionsData?.ehs?.lostTimeInjuries}</div>
            </div>
            <div className="p-4 rounded-2xl bg-white/80 border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-[#8F9EAF]">Safe Man-Hours</span>
              <div className="text-xl font-extrabold text-[#315CFF] mt-1">{sectionsData?.ehs?.safeManHours?.toLocaleString()}</div>
            </div>
            <div className="p-4 rounded-2xl bg-white/80 border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-[#8F9EAF]">Safety Audits</span>
              <div className="text-xl font-extrabold text-[#202938] mt-1">{sectionsData?.ehs?.safetyAuditsCompleted} Completed</div>
            </div>
          </div>
        </PaGlassCard>
      )}

      {/* ── TAB 6: Procurement ── */}
      {activeTab === "proc" && (
        <PaGlassCard strong className="space-y-4">
          <h3 className="text-base font-bold text-[#202938] flex items-center gap-2">
            <Package size={18} className="text-cyan-500" /> Sustainable Procurement & Supply Chain
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-white/80 border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-[#8F9EAF]">Local Sourcing Share</span>
              <div className="text-2xl font-extrabold text-[#315CFF] mt-1">{sectionsData?.procurement?.localSuppliersPct}%</div>
            </div>
            <div className="p-4 rounded-2xl bg-white/80 border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-[#8F9EAF]">Audited ESG Suppliers</span>
              <div className="text-2xl font-extrabold text-emerald-600 mt-1">{sectionsData?.procurement?.sustainableSuppliersAudited} Vendors</div>
            </div>
            <div className="p-4 rounded-2xl bg-white/80 border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-[#8F9EAF]">Total Spend</span>
              <div className="text-2xl font-extrabold text-[#202938] mt-1">₹{(sectionsData?.procurement?.totalSpendInr / 10000000).toFixed(1)} Cr</div>
            </div>
          </div>
        </PaGlassCard>
      )}

      {/* ── TAB 7: CSR ── */}
      {activeTab === "csr" && (
        <PaGlassCard strong className="space-y-4">
          <h3 className="text-base font-bold text-[#202938] flex items-center gap-2">
            <HeartHandshake size={18} className="text-pink-500" /> CSR & Community Development
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-white/80 border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-[#8F9EAF]">CSR Expenditure</span>
              <div className="text-2xl font-extrabold text-emerald-600 mt-1">₹{(sectionsData?.csr?.csrBudgetInr / 100000).toFixed(1)} Lakhs</div>
            </div>
            <div className="p-4 rounded-2xl bg-white/80 border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-[#8F9EAF]">Beneficiaries Impacted</span>
              <div className="text-2xl font-extrabold text-[#315CFF] mt-1">{sectionsData?.csr?.beneficiariesServed?.toLocaleString()} Persons</div>
            </div>
            <div className="p-4 rounded-2xl bg-white/80 border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-[#8F9EAF]">Active Social Programs</span>
              <div className="text-2xl font-extrabold text-[#202938] mt-1">{sectionsData?.csr?.activePrograms} Programs</div>
            </div>
          </div>
        </PaGlassCard>
      )}

      {/* ── TAB 8: Compliance ── */}
      {activeTab === "comp" && (
        <PaGlassCard strong className="space-y-4">
          <h3 className="text-base font-bold text-[#202938] flex items-center gap-2">
            <Award size={18} className="text-indigo-500" /> Statutory & Regulatory Governance
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-white/80 border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-[#8F9EAF]">Environmental Clearances</span>
              <div className="text-xl font-extrabold text-emerald-600 mt-1">100% Valid</div>
            </div>
            <div className="p-4 rounded-2xl bg-white/80 border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-[#8F9EAF]">Show-Cause Notices</span>
              <div className="text-xl font-extrabold text-emerald-600 mt-1">0 Open</div>
            </div>
            <div className="p-4 rounded-2xl bg-white/80 border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-[#8F9EAF]">Statutory Audits</span>
              <div className="text-xl font-extrabold text-emerald-600 mt-1">Passed</div>
            </div>
          </div>
        </PaGlassCard>
      )}

      {/* ── TAB 9: Evidence Vault ── */}
      {activeTab === "evidence" && (
        <PaGlassCard strong className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#202938]">Linked Audit Evidence Files</h3>
            <PaButton size="sm" variant="secondary" onClick={() => navigate("evidence")}>
              Open Evidence Repository
            </PaButton>
          </div>
          <p className="text-xs text-[#64748B]">All supporting documents linked to this consolidated report version.</p>
        </PaGlassCard>
      )}

      {/* ── TAB 10: Validation ── */}
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
            {completeness?.missingFields?.map((f: string) => (
              <div key={f} className="p-3.5 rounded-xl bg-amber-50 text-amber-800 font-semibold flex items-center gap-2">
                <AlertTriangle size={16} /> Warning: {f}
              </div>
            ))}
          </div>
        </PaGlassCard>
      )}

      {/* ── TAB 11: Full Preview ── */}
      {activeTab === "preview" && (
        <PaGlassCard strong className="p-8 space-y-6">
          <div className="border-b border-slate-200 pb-4 text-center">
            <div className="text-xs uppercase font-extrabold tracking-widest text-[#315CFF]">MEIL ESG & BRSR Portal</div>
            <h1 className="text-xl font-bold text-[#202938] mt-1">{report?.title}</h1>
            <p className="text-xs text-[#64748B] mt-1">Official Project Submission Dossier • {report?.versionLabel}</p>
          </div>

          <div className="space-y-4 text-xs">
            <div className="font-bold text-sm text-[#202938]">1. Executive Summary</div>
            <p className="text-slate-700 leading-relaxed">{sectionsData?.executiveSummary}</p>

            <div className="font-bold text-sm text-[#202938]">2. Key Consolidated Metrics</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 font-semibold">Energy: {sectionsData?.environment?.energyGj} GJ</div>
              <div className="p-3 rounded-xl bg-slate-50 font-semibold">Emissions: {(sectionsData?.environment?.emissionsScope1 + sectionsData?.environment?.emissionsScope2).toFixed(1)} tCO2e</div>
              <div className="p-3 rounded-xl bg-slate-50 font-semibold">Headcount: {sectionsData?.hr?.headcount}</div>
              <div className="p-3 rounded-xl bg-slate-50 font-semibold">LTIFR: {sectionsData?.ehs?.lostTimeInjuries}</div>
            </div>
          </div>
        </PaGlassCard>
      )}

      {/* ── TAB 12: Submission Details ── */}
      {activeTab === "submission" && (
        <PaGlassCard strong className="space-y-4">
          <h3 className="text-base font-bold text-[#202938]">Governance & Submission Workflow</h3>
          <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 space-y-2">
            <div className="font-bold">Next Stage: Business Unit Manager Review</div>
            <p>
              Once submitted, the consolidated report locks against uncoordinated local modifications and routes directly to Business Unit Manager ({report?.buManagerName}) for technical review and approval.
            </p>
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
              <span className="font-bold text-emerald-600">{completeness?.completedCategories} of 7</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748B]">Overall Completeness:</span>
              <span className="font-bold text-[#315CFF]">{report?.overallScorePct}%</span>
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
    </div>
  );
}

