"use client";

import React, { useState, useEffect } from "react";
import {
  FileSpreadsheet,
  Search,
  Bell,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FolderLock,
  RefreshCw,
  Eye,
  FileQuestion,
  Filter,
  Check,
  XCircle,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { usePaStore, CONTRIBUTOR_CATEGORIES } from "@/lib/project-admin/store";
import { paApiGet, paApiPost, getCachedPaData } from "@/lib/project-admin/client";
import { PaGlassCard, PaPageHeader, PaButton, PaStatusBadge, PaTabStrip, PaDialog, PaKpiCard } from "../ui";
import type { PaCollectionStatusItem, ContributorRole } from "@/lib/project-admin/types";
import { fieldLabel, fmtValue, itemFieldEntries, itemTitle } from "@/components/shared/field-labels";

export default function CollectionStatusView() {
  const { navigate, viewParams } = usePaStore();
  const cached = getCachedPaData<any>("/api/project-admin/collection-status");
  const [loading, setLoading] = useState(!cached);
  const [items, setItems] = useState<PaCollectionStatusItem[]>(cached?.items || []);
  const [summary, setSummary] = useState<any>(cached?.summary || null);
  const [activeTab, setActiveTab] = useState(viewParams.filter || "all");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");

  // Detail inspection & decision modal
  const [inspectItem, setInspectItem] = useState<PaCollectionStatusItem | null>(null);
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [targetItem, setTargetItem] = useState<PaCollectionStatusItem | null>(null);
  const [correctionNotes, setCorrectionNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  /* Per-source / per-level rejections flagged in the inspection dialog:
     key = `${recordId}:${itemId | "__level__"}` */
  const [itemRejections, setItemRejections] = useState<
    Record<string, { severity: "ERROR" | "WARNING"; reason: string; label: string; recordId: string }>
  >({});

  const loadData = () => {
    if (!items.length) setLoading(true);
    paApiGet<any>("/api/project-admin/collection-status")
      .then((res) => {
        setItems(res.items || []);
        setSummary(res.summary || {});
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleApprove = async (item: PaCollectionStatusItem) => {
    setActionLoading(true);
    try {
      await paApiPost("/api/project-admin/collection-status", {
        action: "approve",
        submissionId: item.id,
        category: item.category,
      });

      // Update state immediately
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, submissionStatus: "APPROVED" } : i))
      );
      if (inspectItem?.id === item.id) {
        setInspectItem((prev) => (prev ? { ...prev, submissionStatus: "APPROVED" } : null));
      }
      showToast(`Approved ${item.sectionName} submitted by ${item.assignedUserName}.`);
    } catch (err: any) {
      alert(err.message || "Approval failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const openCorrectionModal = (item: PaCollectionStatusItem) => {
    setTargetItem(item);
    setCorrectionNotes("");
    setCorrectionModalOpen(true);
  };

  const handleRequestCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetItem) return;

    setActionLoading(true);
    try {
      await paApiPost("/api/project-admin/collection-status", {
        action: "request_correction",
        submissionId: targetItem.id,
        category: targetItem.category,
        assignedUserId: targetItem.assignedUserId,
        comments: correctionNotes,
      });

      setItems((prev) =>
        prev.map((i) => (i.id === targetItem.id ? { ...i, submissionStatus: "RETURNED" } : i))
      );
      if (inspectItem?.id === targetItem.id) {
        setInspectItem((prev) => (prev ? { ...prev, submissionStatus: "RETURNED" } : null));
      }

      setCorrectionModalOpen(false);
      showToast(`Correction request dispatched to ${targetItem.assignedUserName}.`);
    } catch (err: any) {
      alert(err.message || "Failed to submit correction request.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemind = async (submissionId: string, name: string) => {
    try {
      await paApiPost("/api/project-admin/collection-status", {
        submissionId,
        action: "remind",
      });
      showToast(`Reminder notification dispatched to ${name}.`);
    } catch (err: any) {
      alert(err.message || "Failed to send reminder");
    }
  };

  const tabs = [
    { id: "all", label: "All Disclosures", count: items.length },
    { id: "submitted", label: "Submitted / Approved", count: summary?.submitted || 0 },
    { id: "pending", label: "Pending Review", count: summary?.pending || 0 },
    { id: "draft", label: "Draft", count: summary?.draft || 0 },
    { id: "returned", label: "Needs Correction", count: summary?.returned || 0 },
    { id: "overdue", label: "Overdue", count: summary?.overdue || 0 },
  ];

  const filteredItems = items.filter((i) => {
    const matchesSearch =
      !search ||
      i.sectionName.toLowerCase().includes(search.toLowerCase()) ||
      i.assignedUserName.toLowerCase().includes(search.toLowerCase()) ||
      i.categoryLabel.toLowerCase().includes(search.toLowerCase());

    const matchesCategory = selectedCategory === "ALL" || i.category === selectedCategory;

    if (!matchesSearch || !matchesCategory) return false;

    if (activeTab === "submitted") return i.submissionStatus === "SUBMITTED" || i.submissionStatus === "APPROVED";
    if (activeTab === "pending") return i.submissionStatus === "UNDER_REVIEW" || i.submissionStatus === "NOT_STARTED";
    if (activeTab === "draft") return i.submissionStatus === "DRAFT";
    if (activeTab === "returned") return i.submissionStatus === "RETURNED";
    if (activeTab === "overdue") return i.overdue;
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 p-4 rounded-2xl bg-slate-900/90 text-white text-xs font-semibold shadow-2xl backdrop-blur-xl border border-white/20 animate-in slide-in-from-top-4 flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      <PaPageHeader
        title="Data Collection Status"
        subtitle="Centralized operational monitoring of 7 contributor category submissions, validation & sign-off controls"
        badge="Quality Gateway"
        actions={
          <div className="flex items-center gap-2">
            <PaButton
              icon={RefreshCw}
              variant="secondary"
              size="sm"
              onClick={loadData}
            >
              Refresh
            </PaButton>
            <PaButton
              icon={FolderLock}
              variant="secondary"
              size="sm"
              onClick={() => navigate("evidence")}
            >
              Evidence Repository
            </PaButton>
          </div>
        }
      />

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <PaKpiCard title="Total Sections" value={items.length} icon={FileSpreadsheet} accentColor="#315CFF" />
        <PaKpiCard title="Approved" value={summary?.submitted || 0} icon={CheckCircle2} accentColor="#10B981" />
        <PaKpiCard title="Under Review" value={summary?.pending || 0} icon={Clock} accentColor="#3B82F6" />
        <PaKpiCard title="Drafts" value={summary?.draft || 0} icon={FileQuestion} accentColor="#F59E0B" />
        <PaKpiCard title="Corrections" value={summary?.returned || 0} icon={AlertTriangle} accentColor="#EF4444" />
        <PaKpiCard title="Overdue" value={summary?.overdue || 0} icon={Clock} accentColor="#EC4899" />
      </div>

      {/* Tabs & Search Filter Controls */}
      <div className="flex flex-col gap-4">
        <PaTabStrip tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

        <PaGlassCard className="p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search disclosures, contributors, or codes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/80 border border-slate-200 text-xs font-semibold focus:outline-none focus:border-blue-400"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <span className="text-xs font-bold text-[#64748B] whitespace-nowrap flex items-center gap-1.5">
              <Filter size={14} /> Category:
            </span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3.5 py-2 rounded-xl bg-white/80 border border-slate-200 text-xs font-semibold text-[#1E293B] outline-none"
            >
              <option value="ALL">All 7 Contributor Categories</option>
              {Object.entries(CONTRIBUTOR_CATEGORIES).map(([k, def]) => (
                <option key={k} value={k}>
                  {def.label}
                </option>
              ))}
            </select>
          </div>
        </PaGlassCard>
      </div>

      {/* Data Table */}
      <PaGlassCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto pa-scroll">
          <table className="pa-table-glass">
            <thead>
              <tr>
                <th className="pl-6">Code & Disclosure</th>
                <th>Category</th>
                <th>Responsible Contributor</th>
                <th>Period</th>
                <th>Status</th>
                <th>Evidence</th>
                <th>Submission Date</th>
                <th className="pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400">
                    <RefreshCw className="animate-spin text-[#315CFF] mx-auto mb-2" size={20} />
                    Loading disclosures…
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400">
                    No matching disclosures found.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-blue-50/30">
                    <td className="p-4 pl-6">
                      <div className="font-bold text-[#1E293B] text-xs sm:text-sm">{item.sectionName}</div>
                      <div className="text-[11px] text-[#64748B] font-mono mt-0.5">{item.sectionCode}</div>
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 rounded-xl bg-indigo-50/80 border border-indigo-200/50 text-indigo-700 font-bold text-[11px]">
                        {item.categoryLabel}
                      </span>
                    </td>
                    <td className="p-4 font-semibold text-[#1E293B]">
                      {item.assignedUserName}
                    </td>
                    <td className="p-4 text-[#64748B] font-medium">{item.period}</td>
                    <td className="p-4">
                      <PaStatusBadge status={item.submissionStatus} />
                    </td>
                    <td className="p-4">
                      <span
                        className={`pa-badge border font-semibold ${
                          item.evidenceStatus === "COMPLETE"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}
                      >
                        {item.evidenceStatus}
                      </span>
                    </td>
                    <td className="p-4 text-[#64748B] text-xs">
                      {item.submissionDate ? new Date(item.submissionDate).toLocaleDateString() : "Pending"}
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setInspectItem(item)}
                          className="p-1.5 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="View Details & Audit"
                        >
                          <Eye size={16} />
                        </button>

                        {/* Approve Quick Action */}
                        {item.submissionStatus !== "APPROVED" && (
                          <button
                            type="button"
                            onClick={() => handleApprove(item)}
                            className="p-1.5 rounded-xl text-emerald-600 hover:bg-emerald-50 transition-colors"
                            title="Approve Submission"
                          >
                            <Check size={16} strokeWidth={2.5} />
                          </button>
                        )}

                        {/* Return/Correction Quick Action */}
                        <button
                          type="button"
                          onClick={() => openCorrectionModal(item)}
                          className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-50 transition-colors"
                          title="Request Correction"
                        >
                          <MessageSquare size={15} />
                        </button>

                        {/* Reminder Quick Action */}
                        <button
                          type="button"
                          onClick={() => handleRemind(item.id, item.assignedUserName)}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Send Reminder"
                        >
                          <Bell size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </PaGlassCard>

      {/* ── Submission Inspection & Sign-off Dialog ── */}
      <PaDialog
        open={Boolean(inspectItem)}
        onClose={() => setInspectItem(null)}
        title={inspectItem?.sectionName || "Submission Inspection"}
        subtitle={`Reference: ${inspectItem?.sectionCode} • ${inspectItem?.period || ""} • ${inspectItem?.categoryLabel || ""}`}
      >
        {inspectItem && (
          <div className="space-y-4 text-xs">
            {/* Summary card */}
            <div className="grid grid-cols-2 gap-3.5 p-4 rounded-2xl bg-white/90 border border-slate-200/80 shadow-sm">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#8F9EAF]">Responsible Contributor</span>
                <div className="font-bold text-[#1E293B] text-sm mt-0.5">{inspectItem.assignedUserName}</div>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#8F9EAF]">Submission Status</span>
                <div className="mt-0.5">
                  <PaStatusBadge status={inspectItem.submissionStatus} />
                </div>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#8F9EAF]">Reporting Period</span>
                <div className="font-bold text-[#1E293B] mt-0.5">{inspectItem.period}</div>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#8F9EAF]">Target Due Date</span>
                <div className="font-bold text-[#1E293B] mt-0.5">{new Date(inspectItem.dueDate).toLocaleDateString()}</div>
              </div>
            </div>

            {/* Sequenced: emission level → sources → evidence, one by one */}
            {(() => {
              const records: any[] = inspectItem.sourceRecords || [];
              if (!records.length) {
                return (
                  <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/70 text-amber-900">
                    No per-source records captured yet for this section. Reject with general instructions below if needed.
                  </div>
                );
              }
              const sorted = [...records].sort((a, b) => (a.level || 0) - (b.level || 0));
              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-600">
                      Submitted Data — Emission by Emission
                    </span>
                    <span className="text-[9px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
                      As entered by contributor
                    </span>
                  </div>
                  {sorted.map((rec) => {
                    const lvlKey = `${rec.recordId}:__level__`;
                    const lvlRej = itemRejections[lvlKey];
                    return (
                      <div key={rec.recordId} className="rounded-2xl bg-white/90 border border-slate-200/80 shadow-sm overflow-hidden">
                        {/* Level header */}
                        <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-gradient-to-r from-sky-50/90 via-blue-50/60 to-sky-50/90 border-b border-slate-100">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-sky-600 to-blue-700 text-white text-[10px] font-black shrink-0">
                              {rec.level}
                            </span>
                            <span className="text-[11.5px] font-bold text-slate-800 truncate">{rec.levelName}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border ${
                              rec.recordStatus === "CORRECTION_REQUESTED"
                                ? "text-rose-700 bg-rose-50 border-rose-200"
                                : rec.recordStatus === "ACTIVE" || rec.recordStatus === "APPROVED"
                                  ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                                  : "text-slate-600 bg-slate-50 border-slate-200"
                            }`}>
                              {String(rec.recordStatus || "").replace(/_/g, " ")}
                            </span>
                            {!lvlRej && (
                              <button
                                type="button"
                                onClick={() =>
                                  setItemRejections((prev) => ({
                                    ...prev,
                                    [lvlKey]: { severity: "ERROR", reason: "", label: `${rec.levelName} — entire emission level`, recordId: rec.recordId },
                                  }))
                                }
                                className="px-2 py-1 rounded-lg text-[10px] font-bold border border-rose-200 text-rose-700 bg-white hover:bg-rose-50 transition"
                              >
                                ⚑ Reject entire level
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Level-level rejection panel */}
                        {lvlRej && (
                          <div className="mx-3 mt-3 rounded-xl border border-rose-200 bg-rose-50/60 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-black text-rose-800">⚑ Entire level flagged for rejection</span>
                              <button
                                type="button"
                                onClick={() =>
                                  setItemRejections((prev) => {
                                    const next = { ...prev };
                                    delete next[lvlKey];
                                    return next;
                                  })
                                }
                                className="text-[10px] font-bold text-slate-500 hover:text-slate-700"
                              >
                                Unflag
                              </button>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-slate-600">Severity:</span>
                              {(["ERROR", "WARNING"] as const).map((sev) => (
                                <button
                                  key={sev}
                                  type="button"
                                  onClick={() =>
                                    setItemRejections((prev) => ({ ...prev, [lvlKey]: { ...prev[lvlKey], severity: sev } }))
                                  }
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition ${
                                    lvlRej.severity === sev
                                      ? sev === "ERROR"
                                        ? "bg-rose-600 text-white border-rose-600"
                                        : "bg-amber-500 text-white border-amber-500"
                                      : "bg-white text-slate-600 border-slate-200"
                                  }`}
                                >
                                  {sev}
                                </button>
                              ))}
                            </div>
                            <textarea
                              value={lvlRej.reason}
                              onChange={(e) =>
                                setItemRejections((prev) => ({ ...prev, [lvlKey]: { ...prev[lvlKey], reason: e.target.value } }))
                              }
                              placeholder="Explain what is wrong across this whole emission level and what must be fixed…"
                              className="w-full min-h-[52px] rounded-xl border border-rose-200 bg-white px-3 py-2 text-[11px] font-medium text-slate-800 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 resize-y"
                            />
                          </div>
                        )}

                        {/* Sources with evidence */}
                        <div className="p-3 space-y-2">
                          {(rec.items || []).length === 0 && (
                            <div className="text-[11px] text-slate-500 italic px-1">No per-source items captured in this record.</div>
                          )}
                          {(rec.items || []).map((it: any, idx: number) => {
                            const rKey = `${rec.recordId}:${it.id || idx}`;
                            const rLabel = `${rec.levelName} · ${itemTitle(it)}`;
                            const rej = itemRejections[rKey];
                            const entries = itemFieldEntries(it);
                            const evNames: string[] = Array.isArray(it.evidenceFileNames) ? it.evidenceFileNames : [];
                            return (
                              <div
                                key={rKey}
                                className={`rounded-xl border p-2.5 transition-all ${
                                  rej ? "border-rose-300 bg-rose-50/50" : "border-slate-200/90 bg-gradient-to-b from-white to-slate-50/60"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="flex h-4.5 w-4.5 h-5 w-5 items-center justify-center rounded-md bg-slate-800 text-white text-[9px] font-bold shrink-0">
                                      {idx + 1}
                                    </span>
                                    <span className="text-[11px] font-bold text-slate-900 truncate">{itemTitle(it)}</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setItemRejections((prev) => {
                                        const next = { ...prev };
                                        if (next[rKey]) delete next[rKey];
                                        else next[rKey] = { severity: "ERROR", reason: "", label: rLabel, recordId: rec.recordId };
                                        return next;
                                      })
                                    }
                                    className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition shrink-0 ${
                                      rej
                                        ? "bg-rose-600 text-white border-rose-600"
                                        : "bg-white text-rose-700 border-rose-200 hover:bg-rose-50"
                                    }`}
                                  >
                                    {rej ? "✓ Flagged" : "⚑ Reject source"}
                                  </button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                                  {entries.map(([k, v]) => {
                                    const blank = v === null || v === undefined || v === "";
                                    return (
                                      <div
                                        key={k}
                                        className={`flex justify-between items-center gap-1.5 px-2 py-1 rounded-lg border ${
                                          blank ? "bg-slate-50/70 border-slate-200/60" : "bg-white border-slate-200/80"
                                        }`}
                                      >
                                        <span className="text-[9.5px] font-semibold text-slate-500 truncate">{fieldLabel(k)}</span>
                                        <span className={`text-[10px] text-right ${blank ? "text-slate-300 italic" : "font-mono font-bold text-slate-900"}`}>
                                          {fmtValue(v)}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                                {evNames.length > 0 && (
                                  <div className="mt-1.5 flex flex-wrap gap-1">
                                    {evNames.map((f, fi) => (
                                      <span key={fi} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[9px] font-bold text-emerald-800">
                                        <FolderLock className="h-2.5 w-2.5" /> {f}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {rej && (
                                  <div className="mt-2 rounded-xl border border-rose-200 bg-white/90 p-2.5 space-y-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-bold text-slate-600">Severity:</span>
                                      {(["ERROR", "WARNING"] as const).map((sev) => (
                                        <button
                                          key={sev}
                                          type="button"
                                          onClick={() =>
                                            setItemRejections((prev) => ({ ...prev, [rKey]: { ...prev[rKey], severity: sev } }))
                                          }
                                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition ${
                                            rej.severity === sev
                                              ? sev === "ERROR"
                                                ? "bg-rose-600 text-white border-rose-600"
                                                : "bg-amber-500 text-white border-amber-500"
                                              : "bg-white text-slate-600 border-slate-200"
                                          }`}
                                        >
                                          {sev}
                                        </button>
                                      ))}
                                    </div>
                                    <textarea
                                      value={rej.reason}
                                      onChange={(e) =>
                                        setItemRejections((prev) => ({ ...prev, [rKey]: { ...prev[rKey], reason: e.target.value } }))
                                      }
                                      placeholder={`Explain what is wrong with "${itemTitle(it)}" and what must be fixed…`}
                                      className="w-full min-h-[52px] rounded-xl border border-rose-200 bg-white px-3 py-2 text-[11px] font-medium text-slate-800 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 resize-y"
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Decision Bar */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <PaButton
                variant="secondary"
                size="sm"
                icon={FolderLock}
                onClick={() => {
                  setInspectItem(null);
                  navigate("evidence");
                }}
              >
                Evidence Repository
              </PaButton>

              <div className="flex items-center gap-2">
                <PaButton
                  variant="danger"
                  size="sm"
                  icon={XCircle}
                  disabled={
                    actionLoading ||
                    Object.values(itemRejections).filter((r) => r.reason.trim()).length === 0
                  }
                  onClick={async () => {
                    const items = Object.entries(itemRejections)
                      .filter(([, r]) => r.reason.trim())
                      .map(([, r]) => ({
                        field: r.label,
                        issue: r.reason.trim(),
                        severity: r.severity,
                        comment: r.reason.trim(),
                        recordId: r.recordId,
                      }));
                    if (!items.length) return;
                    setActionLoading(true);
                    try {
                      await paApiPost("/api/project-admin/submissions", {
                        action: "reject",
                        submissionId: inspectItem.id,
                        comments: items[0].comment,
                        items,
                      });
                      setItems((prev) =>
                        prev.map((i) => (i.id === inspectItem.id ? { ...i, submissionStatus: "RETURNED" } : i))
                      );
                      if (inspectItem?.id === inspectItem.id) {
                        setInspectItem((prev: any) => (prev ? { ...prev, submissionStatus: "RETURNED" } : null));
                      }
                      setItemRejections({});
                      showToast(`Rejection dispatched for ${items.length} flagged item(s).`);
                    } catch (err: any) {
                      alert(err.message || "Failed to submit rejection.");
                    } finally {
                      setActionLoading(false);
                    }
                  }}
                >
                  {`Submit Rejection (${Object.values(itemRejections).filter((r) => r.reason.trim()).length})`}
                </PaButton>
                {inspectItem.submissionStatus !== "APPROVED" && (
                  <PaButton
                    variant="primary"
                    size="sm"
                    icon={Check}
                    disabled={actionLoading}
                    onClick={() => handleApprove(inspectItem)}
                  >
                    Approve
                  </PaButton>
                )}
              </div>
            </div>
          </div>
        )}
      </PaDialog>

      {/* ── Request Correction Dialog ── */}
      <PaDialog
        open={correctionModalOpen}
        onClose={() => setCorrectionModalOpen(false)}
        title="Request Data Correction"
        subtitle={`Return ${targetItem?.sectionName} to ${targetItem?.assignedUserName}`}
      >
        <form onSubmit={handleRequestCorrection} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Correction Instructions & Clarification Notes
            </label>
            <textarea
              required
              rows={4}
              value={correctionNotes}
              onChange={(e) => setCorrectionNotes(e.target.value)}
              placeholder="Explain required changes, missing lab reports, or unit conversion discrepancies for the contributor lead…"
              className="w-full p-3.5 rounded-2xl bg-white/90 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
            />
          </div>

          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 text-xs leading-relaxed">
            <strong>Workflow Note:</strong> Requesting correction will change this disclosure's status to <code>CHANGES_REQUESTED</code>, dispatch an instant operational notification, and create an assignment task on the contributor's workspace.
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <PaButton
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => setCorrectionModalOpen(false)}
            >
              Cancel
            </PaButton>
            <PaButton
              variant="danger"
              size="sm"
              type="submit"
              disabled={actionLoading}
            >
              {actionLoading ? "Submitting…" : "Dispatch Correction Request"}
            </PaButton>
          </div>
        </form>
      </PaDialog>
    </div>
  );
}
