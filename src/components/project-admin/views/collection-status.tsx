"use client";

/**
 * Data Collection Status — centralized submission monitoring & sign-off.
 *
 * • Suspicion + snapshot free: rows open a FULL-WINDOW review screen
 *   (submission-review-window) that walks the submitted data phase by phase:
 *   contributor → project → captured summary → emission level → its sources →
 *   its evidence (tagged per source), all read-only and clickable.
 * • Admin marks any source / level / data card red (multi-select), optionally
 *   writes a per-mark clarification, then submits one consolidated rejection.
 * • Evidence opens INLINE in the same window (data shrinks left, preview on
 *   the right) — no secondary screen jump.
 */

import React, { useState, useEffect, useMemo } from "react";
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
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { usePaStore, CONTRIBUTOR_CATEGORIES } from "@/lib/project-admin/store";
import { paApiGet, paApiPost, getCachedPaData } from "@/lib/project-admin/client";
import { ensureRevisionPolling, onRevisionChange } from "@/lib/revision-client";
import { PaGlassCard, PaPageHeader, PaButton, PaStatusBadge, PaTabStrip, PaDialog, PaKpiCard } from "../ui";
import type { PaCollectionStatusItem, ContributorRole } from "@/lib/project-admin/types";
import { MeilBoxLoader } from "@/components/shared/meil-loader";
import {
  SubmissionReviewWindow,
  buildReviewModelFromPa,
  type RejectPayloadItem,
} from "@/components/shared/submission-review-window";

export default function CollectionStatusView() {
  const { navigate, viewParams, setSidebarCollapsed } = usePaStore();
  const cached = getCachedPaData<any>("/api/project-admin/collection-status");
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<PaCollectionStatusItem[]>(cached?.items || []);
  const [summary, setSummary] = useState<any>(cached?.summary || null);
  const [activeTab, setActiveTab] = useState(viewParams.filter || "all");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");

  // Full-window review screen (replaces the old small inspection dialog)
  const [inspectItem, setInspectItem] = useState<PaCollectionStatusItem | null>(null);
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [targetItem, setTargetItem] = useState<PaCollectionStatusItem | null>(null);
  const [correctionNotes, setCorrectionNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  /* The full-window review overlays the whole screen — collapse the sidebar
     while it is open and restore the admin's previous choice on close. */
  const sidebarWasCollapsedRef = React.useRef<boolean | null>(null);
  const openReview = (item: PaCollectionStatusItem) => {
    sidebarWasCollapsedRef.current = usePaStore.getState().sidebarCollapsed;
    setSidebarCollapsed(true);
    setInspectItem(item);
  };
  const closeReview = () => {
    setInspectItem(null);
    if (sidebarWasCollapsedRef.current !== null) {
      setSidebarCollapsed(sidebarWasCollapsedRef.current);
      sidebarWasCollapsedRef.current = null;
    }
  };

  const loadData = (bypass = false) => {
    if (!items.length) setLoading(true);
    if (bypass) setRefreshing(true);
    /* Manual refresh must skip BOTH the client SWR cache and the 45s server
       cache — otherwise the Refresh button re-serves stale data. */
    paApiGet<any>(
      "/api/project-admin/collection-status",
      undefined,
      bypass ? { bypassCache: true } : undefined
    )
      .then((res) => {
        setItems(res.items || []);
        setSummary(res.summary || {});
      })
      .catch((err) => console.error(err))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    /* Instant paint from the SWR/server caches; fresh data arrives via the
       shared revision bus (~4s) or the manual Refresh button (cache bypass).
       Bypassing on every mount forced a ~7s cold compute per view open. */
    loadData();
    ensureRevisionPolling();
    return onRevisionChange(() => loadData());
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  /* Stable review model — rebuilt only when the inspected item changes so the
     full-window review never re-mounts (or loses its rejection marks) while
     the parent re-renders. */
  const reviewModel = useMemo(
    () =>
      inspectItem
        ? buildReviewModelFromPa({ ...inspectItem, submissionStatus: inspectItem.submissionStatus })
        : null,
    [inspectItem],
  );

  const patchItemStatus = (id: string, submissionStatus: PaCollectionStatusItem["submissionStatus"]) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, submissionStatus } : i)));
    setInspectItem((prev) => (prev && prev.id === id ? { ...prev, submissionStatus } : prev));
  };

  const handleApprove = async (item: PaCollectionStatusItem) => {
    setActionLoading(true);
    try {
      await paApiPost("/api/project-admin/collection-status", {
        action: "approve",
        submissionId: item.id,
        category: item.category,
      });
      patchItemStatus(item.id, "APPROVED");
      showToast(`Approved ${item.sectionName} submitted by ${item.assignedUserName}.`);
      return true;
    } catch (err: any) {
      showToast(err.message || "Approval failed.");
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  /** Consolidated rejection dispatched from the full-window review. */
  const submitRejection = async (
    markedItems: RejectPayloadItem[],
    generalNote: string,
  ) => {
    if (!inspectItem || !markedItems.length) return;
    setActionLoading(true);
    try {
      await paApiPost("/api/project-admin/submissions", {
        action: "reject",
        submissionId: inspectItem.id,
        comments:
          generalNote ||
          `Marked ${markedItems.length} item(s) for correction — ${markedItems[0].issue}`,
        items: markedItems,
      });
      patchItemStatus(inspectItem.id, "RETURNED");
      showToast(`Rejection dispatched for ${markedItems.length} marked item(s). ${inspectItem.assignedUserName} has been notified.`);
      closeReview();
    } catch (err: any) {
      showToast(err.message || "Failed to submit rejection.");
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

      patchItemStatus(targetItem.id, "RETURNED");
      setCorrectionModalOpen(false);
      showToast(`Correction request dispatched to ${targetItem.assignedUserName}.`);
    } catch (err: any) {
      showToast(err.message || "Failed to submit correction request.");
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
      showToast(err.message || "Failed to send reminder");
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
    /* "Pending Review" = awaiting an admin decision — includes freshly
       SUBMITTED rows (previously only UNDER_REVIEW/NOT_STARTED matched, so a
       just-submitted disclosure never appeared here). */
    if (activeTab === "pending") return i.submissionStatus === "SUBMITTED" || i.submissionStatus === "UNDER_REVIEW" || i.submissionStatus === "NOT_STARTED";
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
              loading={refreshing}
              onClick={() => loadData(true)}
            >
              {refreshing ? "Refreshing…" : "Refresh"}
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
                  <td colSpan={8} className="p-8">
                    <MeilBoxLoader boxHeight="min-h-[180px]" label="Loading disclosures…" />
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
                      <button
                        type="button"
                        onClick={() => openReview(item)}
                        className="text-left"
                        title="Open the full review window"
                      >
                        <div className="font-bold text-[#1E293B] text-xs sm:text-sm hover:text-[#315CFF] transition-colors">{item.sectionName}</div>
                        <div className="text-[11px] text-[#64748B] font-mono mt-0.5">{item.sectionCode}</div>
                      </button>
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
                      {item.submissionDate
                        ? new Date(item.submissionDate).toLocaleString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          })
                        : "Pending"}
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openReview(item)}
                          className="p-1.5 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="View Details & Audit (full window)"
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

      {/* ── FULL-WINDOW SUBMISSION REVIEW (phase-by-phase + mark-to-reject + split evidence) ── */}
      {inspectItem ? (
        <SubmissionReviewWindow
          open
          model={reviewModel}
          loading={false}
          pending={actionLoading}
          onApprove={async () => {
            const ok = await handleApprove(inspectItem);
            if (ok) closeReview();
          }}
          onReject={(marked, generalNote) => submitRejection(marked, generalNote)}
          onClose={closeReview}
        />
      ) : null}

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
