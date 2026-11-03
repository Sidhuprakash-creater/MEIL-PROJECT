"use client";

import React, { useState, useEffect } from "react";
import {
  Building2,
  MapPin,
  Zap,
  Calendar,
  Clock,
  Layers,
  Users,
  CheckCircle2,
  FileText,
  Edit2,
  Save,
  RefreshCw,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";
import { usePaStore, CONTRIBUTOR_CATEGORIES } from "@/lib/project-admin/store";
import { paApiGet, paApiPatch, getCachedPaData } from "@/lib/project-admin/client";
import { PaGlassCard, PaPageHeader, PaButton, PaStatusBadge, PaTabStrip } from "../ui";
import type { ContributorRole } from "@/lib/project-admin/types";

export default function ProjectOverviewView() {
  const { navigate } = usePaStore();
  const cached = getCachedPaData<any>("/api/project-admin/project");
  const [activeTab, setActiveTab] = useState("general");
  const [loading, setLoading] = useState(!cached);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<any>(cached);
  const [editMode, setEditMode] = useState(false);
  const [formLocation, setFormLocation] = useState(cached?.project?.location || "");
  const [formCapacity, setFormCapacity] = useState(String(cached?.project?.capacityMw || 0));
  const [formFrequency, setFormFrequency] = useState(cached?.project?.frequency || "MONTHLY");

  const loadData = () => {
    if (!data) setLoading(true);
    paApiGet<any>("/api/project-admin/project")
      .then((res) => {
        setData(res);
        setFormLocation(res.project?.location || "");
        setFormCapacity(String(res.project?.capacityMw || 0));
        setFormFrequency(res.project?.frequency || "MONTHLY");
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await paApiPatch("/api/project-admin/project", {
        location: formLocation,
        capacityMw: Number(formCapacity),
        frequency: formFrequency,
      });
      setEditMode(false);
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to update project configuration");
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex items-center gap-3 pa-glass px-6 py-4 rounded-2xl">
          <RefreshCw className="animate-spin text-[#315CFF]" size={20} />
          <span className="text-sm font-semibold text-[#202938]">Loading Project Overview…</span>
        </div>
      </div>
    );
  }

  const { project, reportingConfig, contributorAllocation, timeline, history } = data || {};

  const tabs = [
    { id: "general", label: "General Information" },
    { id: "config", label: "Reporting Configuration" },
    { id: "contributors", label: "Contributor Allocation" },
    { id: "timeline", label: "Project Timeline" },
    { id: "history", label: "Reporting History" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PaPageHeader
        title="Project Overview & Configuration"
        subtitle="Operational boundary, site profile and inherited reporting guidelines"
        actions={
          activeTab === "general" && (
            <PaButton
              variant={editMode ? "secondary" : "primary"}
              icon={editMode ? Save : Edit2}
              onClick={() => {
                if (editMode) handleSave();
                else setEditMode(true);
              }}
              loading={saving}
            >
              {editMode ? "Save Changes" : "Edit Site Details"}
            </PaButton>
          )
        }
      />

      {/* Tabs */}
      <PaTabStrip tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* ── TAB 1: General Information ── */}
      {activeTab === "general" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PaGlassCard strong className="space-y-5">
            <h3 className="text-base font-bold text-[#202938] flex items-center gap-2">
              <Building2 size={18} className="text-[#315CFF]" /> Site Profile & Location
            </h3>

            <div className="space-y-4 text-xs">
              <div>
                <label className="text-[11px] font-bold uppercase text-[#8F9EAF]">Official Project Name</label>
                <div className="mt-1 font-bold text-sm text-[#202938]">{project?.name}</div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-[#8F9EAF]">Project Code</label>
                <div className="mt-1 font-mono font-bold text-sm text-[#315CFF]">{project?.code}</div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-[#8F9EAF]">Site Location</label>
                {editMode ? (
                  <input
                    type="text"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    className="mt-1 w-full p-2.5 rounded-xl border border-blue-300 bg-white text-xs font-semibold"
                  />
                ) : (
                  <div className="mt-1 font-semibold text-[#202938] flex items-center gap-1.5">
                    <MapPin size={14} className="text-slate-400" />
                    <span>{project?.location || "India"}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-[#8F9EAF]">Site Type</label>
                <div className="mt-1 font-semibold text-[#202938]">{project?.ptype}</div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-[#8F9EAF]">Installed / Operational Capacity (MW)</label>
                {editMode ? (
                  <input
                    type="number"
                    value={formCapacity}
                    onChange={(e) => setFormCapacity(e.target.value)}
                    className="mt-1 w-full p-2.5 rounded-xl border border-blue-300 bg-white text-xs font-semibold"
                  />
                ) : (
                  <div className="mt-1 font-semibold text-[#202938]">{project?.capacityMw || 0} MW</div>
                )}
              </div>
            </div>
          </PaGlassCard>

          <PaGlassCard strong className="space-y-5">
            <h3 className="text-base font-bold text-[#202938] flex items-center gap-2">
              <Layers size={18} className="text-[#6542F5]" /> Organizational Alignment
            </h3>

            <div className="space-y-4 text-xs">
              <div>
                <label className="text-[11px] font-bold uppercase text-[#8F9EAF]">Parent Subsidiary</label>
                <div className="mt-1 font-bold text-sm text-[#202938]">{project?.subsidiaryName}</div>
                <div className="text-[11px] text-[#64748B]">Code: {project?.subsidiaryCode}</div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-[#8F9EAF]">Governing Business Unit</label>
                <div className="mt-1 font-bold text-sm text-[#202938]">{project?.businessUnitName}</div>
                <div className="text-[11px] text-[#64748B]">Code: {project?.businessUnitCode}</div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-[#8F9EAF]">Operational Status</label>
                <div className="mt-1">
                  <PaStatusBadge status={project?.status || "ACTIVE"} />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-[#8F9EAF]">Reporting Frequency</label>
                {editMode ? (
                  <select
                    value={formFrequency}
                    onChange={(e) => setFormFrequency(e.target.value)}
                    className="mt-1 w-full p-2.5 rounded-xl border border-blue-300 bg-white text-xs font-semibold"
                  >
                    <option value="MONTHLY">MONTHLY</option>
                    <option value="QUARTERLY">QUARTERLY</option>
                  </select>
                ) : (
                  <div className="mt-1 font-semibold text-[#202938]">{project?.frequency}</div>
                )}
              </div>
            </div>
          </PaGlassCard>
        </div>
      )}

      {/* ── TAB 2: Reporting Configuration ── */}
      {activeTab === "config" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PaGlassCard strong className="space-y-4">
            <h3 className="text-base font-bold text-[#202938]">Reporting Policy & Rules</h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between p-3 rounded-xl bg-white/70 border border-slate-200/60">
                <span className="text-[#64748B]">Inherited Policy</span>
                <span className="font-bold text-[#202938]">{reportingConfig?.inheritedFrom}</span>
              </div>
              <div className="flex justify-between p-3 rounded-xl bg-white/70 border border-slate-200/60">
                <span className="text-[#64748B]">Active Financial Year</span>
                <span className="font-bold text-[#315CFF]">{reportingConfig?.currentYear}</span>
              </div>
              <div className="flex justify-between p-3 rounded-xl bg-white/70 border border-slate-200/60">
                <span className="text-[#64748B]">Annual Submission Deadline</span>
                <span className="font-bold text-rose-600">{reportingConfig?.deadlineDate}</span>
              </div>
              <div className="flex justify-between p-3 rounded-xl bg-white/70 border border-slate-200/60">
                <span className="text-[#64748B]">Auto GHG Calculation Engine</span>
                <span className="font-bold text-emerald-600">Active (CEA / IPCC Factors)</span>
              </div>
              <div className="flex justify-between p-3 rounded-xl bg-white/70 border border-slate-200/60">
                <span className="text-[#64748B]">Audit Evidence Uploads</span>
                <span className="font-bold text-emerald-600">Mandatory for L1–L9</span>
              </div>
            </div>
          </PaGlassCard>

          <PaGlassCard strong className="space-y-4">
            <h3 className="text-base font-bold text-[#202938]">Validation Gates</h3>
            <p className="text-xs text-[#64748B]">
              Project Admin cannot bypass Business Unit or Subsidiary reporting deadlines or modify approved emission factors.
            </p>
            <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/60 text-xs text-amber-900 space-y-2">
              <div className="font-bold flex items-center gap-1.5">
                <ShieldAlert size={16} className="text-amber-600" /> Administrative Boundary Notice
              </div>
              <p>
                Contributor data is entered directly by designated role users. Project Admin is authorized to verify completeness, monitor evidence, assemble the consolidated report, and submit to BU Manager for sign-off.
              </p>
            </div>
          </PaGlassCard>
        </div>
      )}

      {/* ── TAB 3: Contributor Allocation ── */}
      {activeTab === "contributors" && (
        <PaGlassCard strong className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#202938]">7 Contributor Categories Allocation</h3>
              <p className="text-xs text-[#64748B]">Active personnel assigned to reporting sections on this site</p>
            </div>
            <PaButton size="sm" onClick={() => navigate("users")}>
              Manage Team <ArrowRight size={14} className="ml-1" />
            </PaButton>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {(Object.keys(CONTRIBUTOR_CATEGORIES) as ContributorRole[]).map((roleKey) => {
              const def = CONTRIBUTOR_CATEGORIES[roleKey];
              const count = contributorAllocation?.rolesMap?.[roleKey] || 0;

              return (
                <div key={roleKey} className="p-4 rounded-2xl bg-white/70 border border-slate-200/60">
                  <div className="flex items-center justify-between">
                    <span
                      className="px-2.5 py-0.5 rounded-full text-[11px] font-bold"
                      style={{ background: `${def.color}15`, color: def.color }}
                    >
                      {def.label}
                    </span>
                    <span className="text-xs font-bold text-[#202938]">{count} assigned</span>
                  </div>
                  <h4 className="mt-2 text-xs font-bold text-[#202938]">{def.name}</h4>
                  <p className="mt-1 text-[11px] text-[#64748B] line-clamp-2">{def.desc}</p>
                </div>
              );
            })}
          </div>
        </PaGlassCard>
      )}

      {/* ── TAB 4: Project Timeline ── */}
      {activeTab === "timeline" && (
        <PaGlassCard strong className="space-y-4">
          <h3 className="text-base font-bold text-[#202938]">Inherited Reporting Timelines & Milestones</h3>
          <div className="space-y-3">
            {timeline?.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between p-3.5 rounded-2xl bg-white/70 border border-slate-200/60 text-xs">
                <div>
                  <div className="font-bold text-[#202938]">{t.title}</div>
                  <div className="text-[11px] text-[#64748B]">{t.scope} • {t.period} {t.financialYear}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-rose-600">
                    Deadline: {new Date(t.deadlineDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </div>
                  <PaStatusBadge status={t.status || "ACTIVE"} />
                </div>
              </div>
            ))}
          </div>
        </PaGlassCard>
      )}

      {/* ── TAB 5: Reporting History ── */}
      {activeTab === "history" && (
        <PaGlassCard strong className="space-y-4">
          <h3 className="text-base font-bold text-[#202938]">Historical Consolidated Reports</h3>
          <div className="space-y-3">
            {history?.map((h: any, i: number) => (
              <div key={i} className="p-4 rounded-2xl bg-white/70 border border-slate-200/60 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#315CFF] text-sm">{h.financialYear} ({h.version})</span>
                  <PaStatusBadge status={h.status} />
                </div>
                <div className="text-[#64748B]">Submitted: {new Date(h.submittedAt).toLocaleDateString()} • Reviewer: {h.buReviewer}</div>
                <div className="p-2.5 rounded-xl bg-slate-50 text-slate-700 font-medium italic">"{h.remarks}"</div>
              </div>
            ))}
          </div>
        </PaGlassCard>
      )}
    </div>
  );
}

