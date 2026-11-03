"use client";

import React, { useState, useEffect } from "react";
import {
  FileWarning,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Send,
  User,
  Plus,
  RefreshCw,
  FolderLock,
  MessageSquare,
} from "lucide-react";
import { usePaStore } from "@/lib/project-admin/store";
import { paApiGet, paApiPost, getCachedPaData } from "@/lib/project-admin/client";
import { PaGlassCard, PaPageHeader, PaButton, PaStatusBadge, PaTabStrip, PaDialog, PaKpiCard } from "../ui";
import type { PaCorrectionItem } from "@/lib/project-admin/types";

export default function CorrectionsView() {
  const { navigate } = usePaStore();
  const cached = getCachedPaData<any>("/api/project-admin/corrections");
  const [loading, setLoading] = useState(!cached);
  const [corrections, setCorrections] = useState<PaCorrectionItem[]>(cached?.corrections || []);
  const [summary, setSummary] = useState<any>(cached?.summary || null);
  const [activeTab, setActiveTab] = useState("all");
  const [selectedCorrection, setSelectedCorrection] = useState<PaCorrectionItem | null>(null);

  // Assign Task Dialog state
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskInstructions, setTaskInstructions] = useState("");
  const [assigning, setAssigning] = useState(false);

  // Resubmit dialog state
  const [resubmitDialogOpen, setResubmitDialogOpen] = useState(false);
  const [resubmitting, setResubmitting] = useState(false);

  const loadCorrections = () => {
    if (!corrections.length) setLoading(true);
    paApiGet<any>("/api/project-admin/corrections")
      .then((res) => {
        setCorrections(res.corrections || []);
        setSummary(res.summary || {});
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCorrections();
  }, []);

  const handleAssignCorrectionTask = async () => {
    if (!selectedCorrection) return;
    setAssigning(true);
    try {
      await paApiPost("/api/project-admin/corrections", {
        correctionId: selectedCorrection.id,
        action: "assign_task",
        instructions: taskInstructions || selectedCorrection.requiredAction,
        contributorId: selectedCorrection.responsibleUserId,
      });
      setTaskDialogOpen(false);
      alert(`Correction task successfully assigned to ${selectedCorrection.responsibleUserName}.`);
      loadCorrections();
    } catch (err: any) {
      alert(err.message || "Failed to assign task");
    } finally {
      setAssigning(false);
    }
  };

  const handleResubmitReport = async () => {
    setResubmitting(true);
    try {
      await paApiPost("/api/project-admin/corrections", {
        action: "resubmit",
      });
      setResubmitDialogOpen(false);
      alert("Updated Consolidated Report resubmitted to Business Unit Manager.");
      loadCorrections();
    } catch (err: any) {
      alert(err.message || "Failed to resubmit report");
    } finally {
      setResubmitting(false);
    }
  };

  const tabs = [
    { id: "all", label: "All Items", count: corrections.length },
    { id: "awaiting", label: "Awaiting Action", count: summary?.awaitingCorrection || 0 },
    { id: "in_progress", label: "In Progress", count: summary?.inProgress || 0 },
    { id: "resolved", label: "Resolved", count: summary?.resolved || 0 },
  ];

  const filtered = corrections.filter((c) => {
    if (activeTab === "awaiting") return c.status === "AWAITING_CORRECTION";
    if (activeTab === "in_progress") return c.status === "IN_PROGRESS" || c.status === "ASSIGNED";
    if (activeTab === "resolved") return c.status === "RESOLVED";
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PaPageHeader
        title="Review Remarks & Corrections Workspace"
        subtitle="Coordinate Business Unit Manager evaluation feedback & delegate revisions to responsible contributors"
        actions={
          <PaButton icon={Send} onClick={() => setResubmitDialogOpen(true)}>
            Resubmit to BU Manager
          </PaButton>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <PaKpiCard title="Total Review Items" value={summary?.total || corrections.length} icon={FileWarning} accentColor="#315CFF" />
        <PaKpiCard title="Awaiting Assignment" value={summary?.awaitingCorrection || 0} icon={AlertTriangle} accentColor="#E35D6A" />
        <PaKpiCard title="Delegations In Progress" value={summary?.inProgress || 0} icon={Clock} accentColor="#E9A23B" />
        <PaKpiCard title="Resolved & Verified" value={summary?.resolved || 0} icon={CheckCircle2} accentColor="#16A67A" />
      </div>

      {/* Tabs */}
      <PaTabStrip tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Review Remarks Cards Grid */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <PaGlassCard strong className="p-8 text-center text-[#64748B]">
            No outstanding correction requests found. All contributor disclosures satisfy BU requirements.
          </PaGlassCard>
        ) : (
          filtered.map((item) => (
            <PaGlassCard key={item.id} strong className="p-6 space-y-4 border-l-4 border-l-rose-500">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs font-bold text-[#315CFF]">{item.reportCode} (v{item.reportVersion})</span>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700">
                    {item.affectedCategoryLabel}
                  </span>
                  <PaStatusBadge status={item.status} />
                </div>
                <div className="text-xs text-[#8F9EAF]">
                  Reviewed on {new Date(item.reviewDate).toLocaleDateString()} by {item.buManagerName}
                </div>
              </div>

              {/* Remarks Box */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                <div className="font-bold text-[#202938] flex items-center gap-2">
                  <MessageSquare size={14} className="text-[#315CFF]" />
                  BU Manager Review Remark:
                </div>
                <p className="text-slate-800 font-medium">"{item.correctionReason}"</p>
                <div className="text-[#64748B] pt-1">
                  <strong>Mandatory Evidence:</strong> {item.evidenceRequirement}
                </div>
              </div>

              {/* Responsible Contributor details & Action */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-50 text-[#315CFF]">
                    <User size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#202938]">
                      Responsible Contributor: <span className="text-blue-700">{item.responsibleUserName}</span>
                    </div>
                    <div className="text-[11px] text-[#64748B]">
                      {item.responsibleUserEmail} • Section: {item.affectedSection}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <PaButton
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSelectedCorrection(item);
                      setTaskInstructions(item.requiredAction);
                      setTaskDialogOpen(true);
                    }}
                  >
                    Assign Correction Task
                  </PaButton>
                  <PaButton
                    size="sm"
                    onClick={() => navigate("collection-status", { category: item.affectedCategory })}
                  >
                    Inspect Section Data
                  </PaButton>
                </div>
              </div>
            </PaGlassCard>
          ))
        )}
      </div>

      {/* ── Assign Correction Task Dialog ── */}
      <PaDialog
        open={taskDialogOpen}
        onClose={() => setTaskDialogOpen(false)}
        title="Assign Correction Task to Contributor"
        subtitle={`Forward specific revision instructions to ${selectedCorrection?.responsibleUserName}`}
      >
        <div className="space-y-4 text-xs">
          <div className="p-4 rounded-2xl bg-white/80 border border-slate-200 space-y-2">
            <div className="flex justify-between">
              <span className="text-[#64748B]">Affected Pillar:</span>
              <span className="font-bold text-[#202938]">{selectedCorrection?.affectedCategoryLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748B]">Reporting Section:</span>
              <span className="font-bold text-[#202938]">{selectedCorrection?.affectedSection}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748B]">Assigned Contributor:</span>
              <span className="font-bold text-[#315CFF]">{selectedCorrection?.responsibleUserName}</span>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase text-[#8F9EAF]">
              Correction Instructions & Rectification Steps *
            </label>
            <textarea
              rows={4}
              value={taskInstructions}
              onChange={(e) => setTaskInstructions(e.target.value)}
              className="mt-1 w-full p-3 rounded-xl border border-slate-200 bg-white text-xs font-medium"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <PaButton variant="secondary" onClick={() => setTaskDialogOpen(false)}>
              Cancel
            </PaButton>
            <PaButton loading={assigning} onClick={handleAssignCorrectionTask}>
              Assign & Notify Contributor
            </PaButton>
          </div>
        </div>
      </PaDialog>

      {/* ── Resubmit to BU Manager Dialog ── */}
      <PaDialog
        open={resubmitDialogOpen}
        onClose={() => setResubmitDialogOpen(false)}
        title="Resubmit Consolidated Report"
        subtitle="Confirm all contributor revisions are verified before transmitting to Business Unit Manager"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-700">
            Resubmitting will compile a fresh report version (e.g. v1.1) preserving the previous submission and review comments for permanent audit traceability.
          </p>

          <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-900 border border-emerald-200">
            ✓ All corrections have been validated against supporting lab reports and updated meter logs.
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <PaButton variant="secondary" onClick={() => setResubmitDialogOpen(false)}>
              Cancel
            </PaButton>
            <PaButton icon={Send} loading={resubmitting} onClick={handleResubmitReport}>
              Confirm Resubmission
            </PaButton>
          </div>
        </div>
      </PaDialog>
    </div>
  );
}

