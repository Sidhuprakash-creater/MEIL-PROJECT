"use client";

import React, { useState, useEffect } from "react";
import {
  History,
  FolderLock,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Eye,
  FileText,
  RefreshCw,
  Bell,
  Check,
  XCircle,
  MessageSquare,
  Sparkles,
  Layers,
  Send,
} from "lucide-react";
import { usePaStore } from "@/lib/project-admin/store";
import { paApiGet, paApiPost, getCachedPaData } from "@/lib/project-admin/client";
import { PaGlassCard, PaPageHeader, PaButton, PaStatusBadge, PaTabStrip, PaDialog, PaKpiCard } from "../ui";

/* ── Per-source item rendering helpers ──────────────────────────────────── */
const FIELD_LABELS: Record<string, string> = {
  energySource: "Energy Source", emissionDataType: "GHG Scope", energyActivity: "Energy Activity",
  consumptionQuantity: "Consumption Quantity", unit: "Unit", meterEquipmentId: "Meter / Equipment ID",
  openingMeterReading: "Opening Meter Reading", closingMeterReading: "Closing Meter Reading",
  energyPurchased: "Energy Purchased", energyGenerated: "Energy Generated",
  renewableEnergyQuantity: "Renewable Energy", reportingPeriod: "Reporting Period",
  sourceDocument: "Source Document", remarks: "Remarks",
  waterSource: "Water Source", waterActivity: "Water Activity", waterQuantity: "Water Quantity",
  meterSourceId: "Meter / Pump ID", openingReading: "Opening Reading", closingReading: "Closing Reading",
  waterReusedRecycled: "Reused / Recycled", dischargeDestination: "Discharge Destination",
  treatmentLevel: "Treatment Level", waterQualityResult: "Water Quality Result", testDateLab: "Lab Test / Date",
  supportingEvidence: "Supporting Evidence",
  sourceCategory: "Source Category", emissionSource: "Emission Source", fuelEnergyType: "Fuel / Energy Type",
  equipmentId: "Equipment ID", electricityKwh: "Electricity (kWh)", gridFactorRef: "Grid Factor Ref",
  activityQuantity: "Activity Quantity", scope3Category: "Scope 3 Category",
  transportMode: "Transport Mode", cargoWeightTonnes: "Cargo Weight (t)", distanceKm: "Distance (km)",
  tonneKm: "Tonne-km", logisticsProvider: "Logistics Provider", originDestination: "Origin → Destination",
  travelMode: "Travel Mode", travelDistanceKm: "Travel Distance (km)", passengerCount: "Passengers",
  passengerKm: "Passenger-km", pollutantType: "Pollutant", samplingLocation: "Sampling Location",
  testDate: "Test Date", laboratory: "Laboratory", laboratoryTestMethod: "Lab / Method",
  testMethod: "Test Method", measuredResult: "Measured Result", testResult: "Test Result",
  regulatoryBenchmark: "Regulatory Benchmark", complianceStatus: "Compliance",
  refrigerantType: "Refrigerant", quantityLeakedKg: "Quantity Leaked (kg)", gwpSource: "GWP Source",
  wasteCategory: "Waste Category", wasteTypeDescription: "Description", quantityGenerated: "Quantity Generated",
  quantityReused: "Quantity Reused", quantityRecycled: "Quantity Recycled", quantityRecovered: "Quantity Recovered",
  quantityDisposed: "Quantity Disposed", disposalMethod: "Disposal Method", wasteHandler: "Handler",
  authorizationReference: "Authorization Ref", transferManifestNumber: "Manifest No.",
  permitConsentType: "Permit Type", permitNumber: "Permit Number", issuingAuthority: "Issuing Authority",
  issueDate: "Issue Date", expiryDate: "Expiry Date", permitStatus: "Permit Status",
  applicableActivity: "Applicable Activity", inspectionDate: "Inspection Date",
  inspectionFindings: "Inspection Findings", nonComplianceIdentified: "Non-compliance",
  correctiveAction: "Corrective Action", responsibleOwner: "Responsible Owner", dueDate: "Due Date",
  closureDate: "Closure Date", factor: "Emission Factor", factorUnit: "Factor Unit", factorSource: "Factor Source",
  estTco2e: "Est. GHG (tCO₂e)", estGj: "Energy (GJ)",
  title: "Title", category: "Category", startDate: "Start Date", completionDate: "Completion Date",
  physicalOutputQuantity: "Physical Output",
};
const SKIP_FIELDS = new Set([
  "evidenceId", "evidenceIds", "evidenceFileName", "evidenceFiles", "id", "status",
  "viewStep", "stagedAt", "items", "calculationFormula", "calculationTimestamp", "factorVersion", "factorConfigured",
]);
const fieldLabel = (k: string) =>
  FIELD_LABELS[k] || k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
const itemTitle = (it: any) =>
  it.energySource || it.waterSource || it.emissionSource || it.wasteCategory ||
  it.permitConsentType || it.title || it.pollutantType || it.refrigerantType || it.category || "Source item";
const fmtVal = (v: any) => {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  return Number.isFinite(n) && String(v).trim() !== "" && typeof v !== "boolean" ? n.toLocaleString() : String(v);
};

export default function SubmissionsView() {
  const { navigate } = usePaStore();
  const cached = getCachedPaData<any>("/api/project-admin/submissions");
  const [loading, setLoading] = useState(!cached);
  const [submissions, setSubmissions] = useState<any[]>(cached?.submissions || []);
  const [summary, setSummary] = useState<any>(cached?.summary || null);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");

  // Inspect & Action dialog states
  const [inspectSubmission, setInspectSubmission] = useState<any>(null);
  const [actionModal, setActionModal] = useState<{
    type: "approve" | "reject" | null;
    submission: any | null;
  }>({ type: null, submission: null });
  const [actionComments, setActionComments] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  /* Per-source-item rejections collected in the inspect modal:
     key = `${recordId}:${itemId}` → { severity, reason } */
  const [itemRejections, setItemRejections] = useState<
    Record<string, { severity: "ERROR" | "WARNING"; reason: string; label: string; recordId: string }>
  >({});

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const loadSubmissions = (bypass = false) => {
    if (!submissions.length) setLoading(true);
    paApiGet<any>("/api/project-admin/submissions", undefined, { bypassCache: bypass })
      .then((res) => {
        setSubmissions(res.submissions || []);
        setSummary(res.summary || {});
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSubmissions(true);
    const interval = setInterval(() => loadSubmissions(true), 8000);
    return () => clearInterval(interval);
  }, []);

  // Quick Action: Approve
  const handleApprove = async (sub: any, note?: string) => {
    setActionLoading(true);
    try {
      await paApiPost("/api/project-admin/submissions", {
        action: "approve",
        submissionId: sub.id,
        comments: note || "Approved by Project Admin with complete data verification.",
      });

      // Optimistic update
      setSubmissions((prev) =>
        prev.map((item) =>
          item.id === sub.id
            ? {
                ...item,
                submissionStatus: "APPROVED",
                reviewStatus: "APPROVED",
                latestReviewComment: note || "Approved by Project Admin with complete data verification.",
              }
            : item
        )
      );
      if (inspectSubmission?.id === sub.id) {
        setInspectSubmission((prev: any) =>
          prev
            ? {
                ...prev,
                submissionStatus: "APPROVED",
                reviewStatus: "APPROVED",
                latestReviewComment: note || "Approved by Project Admin with complete data verification.",
              }
            : null
        );
      }
      setActionModal({ type: null, submission: null });
      showToast(`Approved "${sub.title}" successfully.`);
    } catch (err: any) {
      alert(err.message || "Approval failed.");
    } finally {
      setActionLoading(false);
    }
  };

  // Quick Action: Reject / Request Correction
  const handleReject = async (sub: any, note: string) => {
    if (!note.trim()) {
      alert("Please provide correction instructions or reason for rejection.");
      return;
    }
    /* Per-source rejections flagged in the inspect modal travel with the
       decision so the environmental user sees exactly WHICH item failed. */
    const items = Object.entries(itemRejections)
      .filter(([, r]) => r.reason.trim())
      .map(([, r]) => ({
        field: r.label,
        issue: r.reason.trim(),
        severity: r.severity,
        comment: r.reason.trim(),
        recordId: r.recordId,
      }));
    setActionLoading(true);
    try {
      await paApiPost("/api/project-admin/submissions", {
        action: "reject",
        submissionId: sub.id,
        comments: note.trim(),
        items,
      });

      // Optimistic update
      setSubmissions((prev) =>
        prev.map((item) =>
          item.id === sub.id
            ? {
                ...item,
                submissionStatus: "CHANGES_REQUESTED",
                reviewStatus: "CHANGES_REQUESTED",
                latestReviewComment: note.trim(),
              }
            : item
        )
      );
      if (inspectSubmission?.id === sub.id) {
        setInspectSubmission((prev: any) =>
          prev
            ? {
                ...prev,
                submissionStatus: "CHANGES_REQUESTED",
                reviewStatus: "CHANGES_REQUESTED",
                latestReviewComment: note.trim(),
              }
            : null
        );
      }
      setActionModal({ type: null, submission: null });
      showToast(`Correction request dispatched for "${sub.title}".`);
    } catch (err: any) {
      alert(err.message || "Action failed.");
    } finally {
      setActionLoading(false);
    }
  };

  // Quick Action: Send Reminder
  const handleRemind = async (sub: any) => {
    setActionLoading(true);
    try {
      await paApiPost("/api/project-admin/submissions", {
        action: "remind",
        submissionId: sub.id,
      });
      showToast(`Reminder sent to ${sub.submitterName || sub.submittedBy}.`);
    } catch (err: any) {
      alert(err.message || "Failed to send reminder.");
    } finally {
      setActionLoading(false);
    }
  };

  const tabs = [
    { id: "all", label: "All Submissions", count: submissions.length },
    { id: "submitted", label: "Pending Admin Review", count: summary?.submitted || 0 },
    { id: "approved", label: "Approved", count: summary?.approved || 0 },
    { id: "returned", label: "Corrections Requested", count: summary?.returned || 0 },
    {
      id: "reports",
      label: "Consolidated Dossiers",
      count: submissions.filter((s) => !s.isSiteSubmission).length,
    },
  ];

  const filtered = submissions.filter((s) => {
    const matchesSearch =
      !search ||
      s.reportCode.toLowerCase().includes(search.toLowerCase()) ||
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.period.toLowerCase().includes(search.toLowerCase()) ||
      (s.submittedBy && s.submittedBy.toLowerCase().includes(search.toLowerCase())) ||
      (s.category && s.category.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;
    if (activeTab === "approved") {
      return s.submissionStatus === "APPROVED" || s.reviewStatus === "APPROVED";
    }
    if (activeTab === "submitted") {
      return (
        s.submissionStatus === "SUBMITTED" ||
        s.submissionStatus === "UNDER_REVIEW" ||
        s.reviewStatus === "PENDING_ADMIN_REVIEW" ||
        s.reviewStatus === "PENDING_BU_REVIEW"
      );
    }
    if (activeTab === "returned") {
      return (
        s.submissionStatus === "CHANGES_REQUESTED" ||
        s.submissionStatus === "REJECTED" ||
        s.submissionStatus === "CORRECTION_REQUESTED" ||
        s.reviewStatus === "CHANGES_REQUESTED"
      );
    }
    if (activeTab === "reports") {
      return !s.isSiteSubmission;
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PaPageHeader
        title="Site Submissions & Dossier Review Command"
        subtitle="Review, approve, and manage disclosure packages from site contributors (Environment, Energy, Water, Waste) and quarterly consolidated reports"
        actions={
          <PaButton
            variant="secondary"
            size="sm"
            onClick={loadSubmissions}
            disabled={loading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </PaButton>
        }
      />

      {/* Floating Success Toast */}
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-emerald-600 text-white shadow-xl text-xs font-semibold animate-in slide-in-from-top-3">
          <CheckCircle2 size={16} />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <PaKpiCard
          title="Total Submissions"
          value={summary?.total || submissions.length}
          icon={Layers}
          accentColor="#315CFF"
        />
        <PaKpiCard
          title="Pending Admin Review"
          value={summary?.submitted || 0}
          icon={Clock}
          accentColor="#347DEB"
        />
        <PaKpiCard
          title="Approved Disclosures"
          value={summary?.approved || 0}
          icon={CheckCircle2}
          accentColor="#16A67A"
        />
        <PaKpiCard
          title="Corrections In-Flight"
          value={summary?.returned || 0}
          icon={AlertTriangle}
          accentColor="#E35D6A"
        />
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <PaTabStrip tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-80">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search title, category, contributor…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/80 border border-slate-200 text-xs font-semibold focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => loadSubmissions(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shrink-0 shadow-sm"
            title="Refresh submissions"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-blue-600" : "text-slate-500"} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Main Submissions Table */}
      <PaGlassCard strong className="overflow-x-auto p-0">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200/80 bg-slate-50/60 text-[#64748B] font-bold uppercase tracking-wider text-[11px]">
              <th className="p-4 pl-6">Ref & Disclosure Title</th>
              <th className="p-4">Category / Module</th>
              <th className="p-4">Period</th>
              <th className="p-4">Metric Value</th>
              <th className="p-4">Submitted By</th>
              <th className="p-4">Review Status</th>
              <th className="p-4 pr-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-[#64748B]">
                  No matching submissions found.
                </td>
              </tr>
            ) : (
              filtered.map((s) => {
                const isApproved = s.submissionStatus === "APPROVED" || s.reviewStatus === "APPROVED";
                const isReturned =
                  s.submissionStatus === "CHANGES_REQUESTED" ||
                  s.submissionStatus === "REJECTED" ||
                  s.submissionStatus === "CORRECTION_REQUESTED";

                return (
                  <tr key={s.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="p-4 pl-6">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[#315CFF] font-bold text-[11px]">
                          {s.reportCode}
                        </span>
                        {s.isSiteSubmission ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Site Data
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                            Dossier
                          </span>
                        )}
                      </div>
                      <div className="font-bold text-[#202938] text-sm mt-0.5">{s.title}</div>
                      {s.latestReviewComment && (
                        <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5 italic">
                          "{s.latestReviewComment}"
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold text-[11px]">
                        {s.category || "ENVIRONMENT"}
                      </span>
                    </td>
                    <td className="p-4 font-semibold text-[#202938]">{s.period}</td>
                    <td className="p-4">
                      {s.metricValue ? (
                        <div>
                          <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                            {s.metricValue}
                          </span>
                          {s.parsedValues && s.parsedValues.length > 0 && (
                            <div className="text-[10px] text-blue-600 mt-1 font-semibold">
                              {s.parsedValues.length} data fields captured
                            </div>
                          )}
                          {s.evidenceList && s.evidenceList.length > 0 && (
                            <div className="flex items-center gap-1 text-[10px] text-emerald-700 font-bold mt-1">
                              <FolderLock size={11} className="text-emerald-600 shrink-0" />
                              <span>{s.evidenceList.length} evidence doc(s)</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-[#202938] text-sm">{s.submitterName}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                          {s.submitterRole || "Site Data Entry"}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {s.submitterEmail}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 mt-1">
                        <Clock size={12} className="text-blue-500 shrink-0" />
                        <span>{s.formattedDateTime || new Date(s.submissionDate).toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <PaStatusBadge status={s.submissionStatus || s.reviewStatus} />
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Quick Approve Button */}
                        {!isApproved && (
                          <button
                            type="button"
                            onClick={() => {
                              setActionComments("");
                              setActionModal({ type: "approve", submission: s });
                            }}
                            className="p-1.5 rounded-lg text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                            title="Approve Submission"
                          >
                            <Check size={14} />
                          </button>
                        )}

                        {/* Quick Reject / Request Correction Button */}
                        {!isReturned && (
                          <button
                            type="button"
                            onClick={() => {
                              setActionComments("");
                              setActionModal({ type: "reject", submission: s });
                            }}
                            className="p-1.5 rounded-lg text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors"
                            title="Request Correction / Reject"
                          >
                            <XCircle size={14} />
                          </button>
                        )}

                        {/* Send Reminder Button */}
                        {!isApproved && (
                          <button
                            type="button"
                            onClick={() => handleRemind(s)}
                            className="p-1.5 rounded-lg text-amber-600 bg-amber-50 hover:bg-amber-100 transition-colors"
                            title="Send Reminder to Contributor"
                          >
                            <Bell size={14} />
                          </button>
                        )}

                        {/* Inspect Details Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setItemRejections({});
                            setInspectSubmission(s);
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="View Submission Details"
                        >
                          <Eye size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </PaGlassCard>

      {/* Inspect Submission Details Modal */}
      <PaDialog
        open={Boolean(inspectSubmission)}
        onClose={() => setInspectSubmission(null)}
        title={inspectSubmission?.title || "Submission Details"}
        subtitle={`Ref: ${inspectSubmission?.reportCode} • Category: ${inspectSubmission?.category}`}
      >
        {inspectSubmission && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-2xl bg-white/90 border border-slate-200 space-y-2.5 shadow-sm">
              <div className="flex justify-between items-center">
                <span className="text-[#64748B]">Contributor Name:</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#202938] text-sm">{inspectSubmission.submitterName}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                    {inspectSubmission.submitterRole || "Site Data Entry"}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#64748B]">Contributor Email:</span>
                <span className="font-mono text-slate-700 font-semibold">{inspectSubmission.submitterEmail}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#64748B]">Site Project:</span>
                <span className="font-semibold text-[#202938]">{inspectSubmission.projectName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#64748B]">Reporting Period:</span>
                <span className="font-semibold text-[#202938]">{inspectSubmission.period}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#64748B]">Exact Date & Time:</span>
                <div className="flex items-center gap-1.5 font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg">
                  <Clock size={12} />
                  <span>{inspectSubmission.formattedDateTime || new Date(inspectSubmission.submissionDate).toLocaleString()}</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#64748B]">Review Status:</span>
                <PaStatusBadge status={inspectSubmission.submissionStatus || inspectSubmission.reviewStatus} />
              </div>
            </div>

            {/* Per-source Submitted Data — iOS liquid-glass cards, one per captured item */}
            {(() => {
              const sourceRecords: any[] = inspectSubmission.sourceRecords || [];
              const hasItems = sourceRecords.some((r) => (r.items || []).length > 0);
              if (!sourceRecords.length && !(inspectSubmission.parsedValues || []).length) {
                return (
                  <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 text-xs text-amber-900">
                    No source-record data attached to this submission yet.
                  </div>
                );
              }
              return (
                <div className="space-y-3">
                  <div className="font-bold text-slate-800 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Layers size={14} className="text-blue-600" />
                      <span>Submitted Data — Source by Source</span>
                    </div>
                    <span className="text-[10px] font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                      As entered by contributor
                    </span>
                  </div>
                  {hasItems
                    ? sourceRecords.map((rec) => (
                        <div key={rec.recordId} className="rounded-2xl bg-white/90 border border-slate-200 shadow-sm overflow-hidden">
                          <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-gradient-to-r from-sky-50/90 via-blue-50/60 to-sky-50/90 border-b border-slate-100">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600 text-white text-[10px] font-black shrink-0">
                                {rec.level}
                              </span>
                              <span className="text-[11px] font-bold text-slate-800 truncate">{rec.levelName}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                rec.recordStatus === "CORRECTION_REQUESTED"
                                  ? "text-rose-700 bg-rose-50 border-rose-200"
                                  : rec.recordStatus === "APPROVED" || rec.recordStatus === "ACTIVE"
                                    ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                                    : "text-slate-600 bg-slate-50 border-slate-200"
                              }`}>
                                {String(rec.recordStatus || "").replace(/_/g, " ")}
                              </span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                rec.validationStatus === "PASSED"
                                  ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                                  : rec.validationStatus === "FAILED"
                                    ? "text-rose-700 bg-rose-50 border-rose-200"
                                    : "text-amber-700 bg-amber-50 border-amber-200"
                              }`}>
                                {rec.validationStatus || "PENDING"}
                              </span>
                            </div>
                          </div>
                          <div className="p-3 space-y-2.5">
                            {(rec.items || []).length === 0 && (
                              <div className="text-[11px] text-slate-500 italic px-1">No per-source items captured in this record.</div>
                            )}
                            {(rec.items || []).map((it: any, idx: number) => {
                              const rKey = `${rec.recordId}:${it.id || idx}`;
                              const rLabel = `${rec.levelName} · ${itemTitle(it)}`;
                              const rej = itemRejections[rKey];
                              const isRejected = Boolean(rej);
                              return (
                                <div
                                  key={rKey}
                                  className={`rounded-2xl border p-3 transition-all ${
                                    isRejected
                                      ? "border-rose-300 bg-rose-50/50 shadow-2xs"
                                      : "border-slate-200/90 bg-gradient-to-b from-white to-slate-50/60 shadow-2xs"
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2 mb-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-800 text-white text-[9px] font-bold shrink-0">
                                        {idx + 1}
                                      </span>
                                      <span className="text-[12px] font-bold text-slate-900 truncate">{itemTitle(it)}</span>
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
                                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition shrink-0 ${
                                        isRejected
                                          ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                                          : "bg-white text-rose-700 border-rose-200 hover:bg-rose-50"
                                      }`}
                                    >
                                      {isRejected ? "✓ Flagged for rejection" : "⚑ Reject this source"}
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                    {Object.entries(it)
                                      .filter(([k, v]) => !SKIP_FIELDS.has(k) && !(v === "" || v === null || v === undefined))
                                      .map(([k, v]) => (
                                        <div key={k} className="flex justify-between items-start gap-2 px-2.5 py-1.5 rounded-xl bg-white/90 border border-slate-200/80">
                                          <span className="text-slate-500 font-medium text-[10.5px] pt-px">{fieldLabel(k)}:</span>
                                          <span className={`font-mono font-bold text-[11px] text-slate-900 text-right ${
                                            typeof v === "number" || /^\d+(\.\d+)?$/.test(String(v)) ? "tabular-nums" : ""
                                          }`}>
                                            {fmtVal(v)}
                                          </span>
                                        </div>
                                      ))}
                                  </div>
                                  {isRejected && (
                                    <div className="mt-2.5 rounded-xl border border-rose-200 bg-white/90 p-2.5 space-y-2">
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
                                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
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
                                        placeholder={`Explain what is wrong with "${itemTitle(it)}" and what the contributor must fix…`}
                                        className="w-full min-h-[54px] rounded-xl border border-rose-200 bg-white px-3 py-2 text-[11px] font-medium text-slate-800 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 resize-y"
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    : (inspectSubmission.parsedValues || []).length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {inspectSubmission.parsedValues.map((field: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                              <span className="text-slate-600 font-medium">{field.label}:</span>
                              <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                                {field.value} {field.unit ? field.unit : ""}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                </div>
              );
            })()}

            {/* Existing per-field corrections raised on this submission */}
            {(inspectSubmission.corrections || []).length > 0 && (
              <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-200/80 space-y-2">
                <div className="font-bold text-rose-950 text-xs flex items-center gap-1.5">
                  <AlertTriangle size={14} className="text-rose-600" />
                  Corrections Requested ({inspectSubmission.corrections.length})
                </div>
                {inspectSubmission.corrections.map((c: any, idx: number) => (
                  <div key={c.id || idx} className="rounded-xl bg-white/90 border border-rose-200/80 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-800">{c.field || "Field"}</span>
                      <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                        c.severity === "ERROR" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                      }`}>
                        {c.severity || "WARNING"}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-700 mt-0.5">{c.issue || c.comment}</div>
                    {c.requesterName && (
                      <div className="text-[9.5px] text-slate-400 mt-0.5">— {c.requesterName}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Attached Verification Evidence — real vault files with preview */}
            {(() => {
              const realFiles: any[] = inspectSubmission.evidenceFiles || [];
              const nameOnly: string[] = inspectSubmission.evidenceList || [];
              if (realFiles.length === 0 && nameOnly.length === 0) return null;
              return (
                <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/80 space-y-2.5 shadow-2xs">
                  <div className="font-bold text-emerald-950 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <FolderLock size={14} className="text-emerald-600" />
                      <span>
                        Attached Verification Evidence ({realFiles.length || nameOnly.length} document
                        {(realFiles.length || nameOnly.length) === 1 ? "" : "s"})
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded-full border border-emerald-200 shadow-2xs">
                      Evidence Vault
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {realFiles.map((ev) => (
                      <div
                        key={ev.id}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-emerald-200 shadow-2xs"
                      >
                        <FileText size={14} className="text-emerald-600 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold text-slate-800 truncate max-w-[240px]">{ev.fileName}</span>
                            <span className="text-[9px] font-extrabold text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded-md shrink-0">
                              {ev.documentType || "DOC"}
                            </span>
                            <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md shrink-0 ${
                              ev.status === "VERIFIED"
                                ? "text-emerald-700 bg-emerald-100"
                                : "text-amber-700 bg-amber-100"
                            }`}>
                              {ev.status || "PENDING"}
                            </span>
                          </div>
                          {ev.hash && (
                            <div className="text-[9px] font-mono text-slate-400 truncate max-w-[320px]">sha256: {ev.hash}</div>
                          )}
                        </div>
                        {ev.filePath && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <a
                              href={ev.filePath}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 hover:bg-sky-100 transition"
                            >
                              <Eye size={11} /> View
                            </a>
                            <a
                              href={ev.filePath}
                              download={ev.fileName}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition"
                            >
                              ↓ File
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                    {realFiles.length === 0 &&
                      nameOnly.map((doc, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-emerald-200 text-xs font-semibold text-slate-800 shadow-2xs"
                        >
                          <FileText size={13} className="text-emerald-600 shrink-0" />
                          <span className="font-mono text-[11px] truncate max-w-[260px]">{doc}</span>
                        </div>
                      ))}
                  </div>
                </div>
              );
            })()}

            <div>
              <label className="text-[10px] font-bold uppercase text-[#8F9EAF]">
                Review Remarks & Evaluation Trail
              </label>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-medium mt-1">
                "{inspectSubmission.latestReviewComment || "Awaiting Project Admin review."}"
              </div>
            </div>

            {/* Quick Action bar inside dialog */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <div className="flex items-center gap-2">
                <PaButton
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    handleApprove(inspectSubmission);
                  }}
                  disabled={
                    actionLoading ||
                    inspectSubmission.submissionStatus === "APPROVED"
                  }
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Check size={14} className="mr-1.5" />
                  Approve Submission
                </PaButton>
                <PaButton
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    const sub = inspectSubmission;
                    setInspectSubmission(null);
                    setActionComments("");
                    setActionModal({ type: "reject", submission: sub });
                  }}
                  disabled={
                    actionLoading ||
                    inspectSubmission.submissionStatus === "CHANGES_REQUESTED"
                  }
                >
                  <XCircle size={14} className="mr-1.5" />
                  Request Correction
                </PaButton>
              </div>

              <PaButton variant="secondary" size="sm" onClick={() => setInspectSubmission(null)}>
                Close
              </PaButton>
            </div>
          </div>
        )}
      </PaDialog>

      {/* Decision Modal (Approve Note or Request Correction Reason) */}
      <PaDialog
        open={Boolean(actionModal.type)}
        onClose={() => setActionModal({ type: null, submission: null })}
        title={
          actionModal.type === "approve"
            ? "Confirm Submission Approval"
            : "Request Correction from Contributor"
        }
        subtitle={actionModal.submission?.title}
      >
        {actionModal.submission && (
          <div className="space-y-4 text-xs">
            {actionModal.type === "approve" ? (
              <p className="text-slate-600">
                Are you sure you want to approve this disclosure? The status will update to{" "}
                <strong className="text-emerald-700">APPROVED</strong>, underlying records will be
                validated, and an approval notification will be dispatched to{" "}
                <strong>{actionModal.submission.submittedBy}</strong>.
              </p>
            ) : (
              <p className="text-slate-600">
                Specify the data rectification or documentation requirements. This will change the
                status to <strong className="text-rose-700">CHANGES REQUESTED</strong> and
                automatically assign an urgent correction task to{" "}
                <strong>{actionModal.submission.submittedBy}</strong>.
              </p>
            )}

            <div>
              <label className="text-[10px] font-bold uppercase text-[#8F9EAF]">
                {actionModal.type === "approve"
                  ? "Approval Remark (Optional)"
                  : "Correction Instructions / Required Evidences (Mandatory)"}
              </label>
              <textarea
                rows={3}
                value={actionComments}
                onChange={(e) => setActionComments(e.target.value)}
                placeholder={
                  actionModal.type === "approve"
                    ? "e.g. Data reconciled with site meter readings and lab testing certificate."
                    : "e.g. Please re-upload accredited testing certificate for treated effluent."
                }
                className="w-full mt-1.5 p-3 rounded-xl bg-white border border-slate-200 text-xs font-semibold focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
              <PaButton
                variant="secondary"
                size="sm"
                onClick={() => setActionModal({ type: null, submission: null })}
                disabled={actionLoading}
              >
                Cancel
              </PaButton>

              {actionModal.type === "approve" ? (
                <PaButton
                  variant="primary"
                  size="sm"
                  onClick={() => handleApprove(actionModal.submission, actionComments)}
                  disabled={actionLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {actionLoading ? "Approving…" : "Confirm Approval"}
                </PaButton>
              ) : (
                <PaButton
                  variant="danger"
                  size="sm"
                  onClick={() => handleReject(actionModal.submission, actionComments)}
                  disabled={actionLoading}
                >
                  {actionLoading ? "Submitting…" : "Dispatch Correction"}
                </PaButton>
              )}
            </div>
          </div>
        )}
      </PaDialog>
    </div>
  );
}
