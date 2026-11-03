"use client";

import React, { useState, useEffect } from "react";
import {
  History,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Eye,
  FileText,
  RefreshCw,
  ExternalLink,
  Calendar,
} from "lucide-react";
import { usePaStore } from "@/lib/project-admin/store";
import { paApiGet, getCachedPaData } from "@/lib/project-admin/client";
import { PaGlassCard, PaPageHeader, PaButton, PaStatusBadge, PaTabStrip, PaDialog, PaKpiCard } from "../ui";

export default function SubmissionsView() {
  const { navigate } = usePaStore();
  const cached = getCachedPaData<any>("/api/project-admin/submissions");
  const [loading, setLoading] = useState(!cached);
  const [submissions, setSubmissions] = useState<any[]>(cached?.submissions || []);
  const [summary, setSummary] = useState<any>(cached?.summary || null);
  const [activeTab, setActiveTab] = useState("all");

  const loadSubmissions = () => {
    if (!submissions.length) setLoading(true);
    paApiGet<any>("/api/project-admin/submissions")
      .then((res) => {
        setSubmissions(res.submissions || []);
        setSummary(res.summary || {});
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };
  const [search, setSearch] = useState("");
  const [inspectSubmission, setInspectSubmission] = useState<any>(null);

  useEffect(() => {
    loadSubmissions();
  }, []);

  const tabs = [
    { id: "all", label: "All Submissions", count: submissions.length },
    { id: "approved", label: "Approved", count: summary?.approved || 0 },
    { id: "submitted", label: "Under Review / Submitted", count: summary?.submitted || 0 },
    { id: "returned", label: "Returned for Correction", count: summary?.returned || 0 },
  ];

  const filtered = submissions.filter((s) => {
    const matchesSearch =
      !search ||
      s.reportCode.toLowerCase().includes(search.toLowerCase()) ||
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.period.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;
    if (activeTab === "approved") return s.submissionStatus === "APPROVED";
    if (activeTab === "submitted") return s.submissionStatus === "SUBMITTED" || s.reviewStatus === "PENDING_BU_REVIEW";
    if (activeTab === "returned") return s.submissionStatus === "CHANGES_REQUESTED" || s.submissionStatus === "REJECTED";
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PaPageHeader
        title="Submission History & Version Ledger"
        subtitle="Immutable chronological history of all consolidated reports and BU Manager evaluations"
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <PaKpiCard title="Total Report Dossiers" value={summary?.total || submissions.length} icon={History} accentColor="#315CFF" />
        <PaKpiCard title="Approved Reports" value={summary?.approved || 0} icon={CheckCircle2} accentColor="#16A67A" />
        <PaKpiCard title="Under BU Review" value={summary?.submitted || 0} icon={Clock} accentColor="#347DEB" />
        <PaKpiCard title="Returned Corrections" value={summary?.returned || 0} icon={AlertTriangle} accentColor="#E35D6A" />
      </div>

      {/* Tabs */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <PaTabStrip tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search report versions or codes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/80 border border-slate-200 text-xs font-semibold focus:outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <PaGlassCard strong className="overflow-x-auto p-0">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200/80 bg-slate-50/60 text-[#64748B] font-bold uppercase tracking-wider text-[11px]">
              <th className="p-4 pl-6">Report Code & Title</th>
              <th className="p-4">Period</th>
              <th className="p-4">Version</th>
              <th className="p-4">Submitted By</th>
              <th className="p-4">Submission Date</th>
              <th className="p-4">BU Manager Review</th>
              <th className="p-4 pr-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-[#64748B]">
                  No historical reports found.
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.id} className="hover:bg-white/80 transition-colors">
                  <td className="p-4 pl-6">
                    <span className="font-mono text-[#315CFF] font-bold text-[11px]">{s.reportCode}</span>
                    <div className="font-bold text-[#202938] text-sm mt-0.5">{s.title}</div>
                  </td>
                  <td className="p-4 font-semibold text-[#202938]">{s.period}</td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-bold font-mono text-[11px]">
                      {s.versionLabel}
                    </span>
                  </td>
                  <td className="p-4 text-[#64748B]">{s.submittedBy}</td>
                  <td className="p-4 text-[#64748B]">{new Date(s.submissionDate).toLocaleDateString()}</td>
                  <td className="p-4">
                    <PaStatusBadge status={s.reviewStatus} />
                    <div className="text-[10px] text-[#8F9EAF] mt-0.5">{s.buManagerName}</div>
                  </td>
                  <td className="p-4 pr-6 text-right">
                    <button
                      type="button"
                      onClick={() => setInspectSubmission(s)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="View Details"
                    >
                      <Eye size={15} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </PaGlassCard>

      {/* Details Dialog */}
      <PaDialog
        open={Boolean(inspectSubmission)}
        onClose={() => setInspectSubmission(null)}
        title={inspectSubmission?.title || "Report Dossier Details"}
        subtitle={`Version: ${inspectSubmission?.versionLabel} • Ref: ${inspectSubmission?.reportCode}`}
      >
        {inspectSubmission && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-2xl bg-white/80 border border-slate-200 space-y-2">
              <div className="flex justify-between">
                <span className="text-[#64748B]">Review Authority:</span>
                <span className="font-bold text-[#202938]">{inspectSubmission.buManagerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Evaluation Status:</span>
                <PaStatusBadge status={inspectSubmission.reviewStatus} />
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Submission Timestamp:</span>
                <span className="font-bold text-[#202938]">{new Date(inspectSubmission.submissionDate).toLocaleString()}</span>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-[#8F9EAF]">Latest BU Manager Review Remark</label>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-medium mt-1">
                "{inspectSubmission.latestReviewComment}"
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-200">
              <PaButton variant="secondary" onClick={() => setInspectSubmission(null)}>
                Close
              </PaButton>
            </div>
          </div>
        )}
      </PaDialog>
    </div>
  );
}

