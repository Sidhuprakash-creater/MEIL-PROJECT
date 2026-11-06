"use client";

import React, { useEffect, useState } from "react";
import {
  Users,
  CheckCircle2,
  Clock,
  FileEdit,
  AlertTriangle,
  FolderLock,
  FileQuestion,
  Layers,
  ArrowRight,
  TrendingUp,
  Activity,
  Calendar,
  Sparkles,
  FileCheck2,
  Eye,
  Check,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { usePaStore, CONTRIBUTOR_CATEGORIES } from "@/lib/project-admin/store";
import { paApiGet, getCachedPaData } from "@/lib/project-admin/client";
import type { PaProjectInfo, PaKpis, PaCategoryProgress, PaDashboardAnalytics, PaActivityItem, ContributorRole } from "@/lib/project-admin/types";
import { PaGlassCard, PaKpiCard, PaButton, PaStatusBadge, PaCircularProgress } from "../ui";
import { MeilBoxLoader } from "@/components/shared/meil-loader";

export default function DashboardView() {
  const { navigate, financialYear } = usePaStore();
  const cachedInitial = getCachedPaData<any>("/api/project-admin/dashboard");
  const [loading, setLoading] = useState(!cachedInitial);
  const [data, setData] = useState<{
    project: PaProjectInfo;
    kpis: PaKpis;
    categoryProgress: PaCategoryProgress[];
    analytics: PaDashboardAnalytics;
    recentActivity: PaActivityItem[];
  } | null>(cachedInitial);

  const fetchDashboard = () => {
    if (!data) setLoading(true);
    paApiGet<any>("/api/project-admin/dashboard")
      .then((res) => setData(res))
      .catch((err) => console.error("Failed to fetch dashboard:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount data load
    fetchDashboard();
  }, [financialYear]);

  if (loading && !data) {
    return (
      <div className="glass rounded-2xl p-6">
        <MeilBoxLoader boxHeight="min-h-[360px]" label="Loading Project Command Center…" />
      </div>
    );
  }

  const { project, kpis, categoryProgress, analytics, recentActivity } = data || ({} as any);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* ── A. Project Identity Panel ── */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 pa-glass-strong border border-white shadow-xl">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-100 text-blue-700">
                {project?.code || "PRJ-ZOJ"}
              </span>
              <PaStatusBadge status={project?.status || project?.reportingStatus || "ON_TRACK"} />
              <span className="text-xs font-semibold text-[#64748B]">
                Site Operational Command · {financialYear}
              </span>
            </div>

            <h1 className="mt-3 text-2xl sm:text-4xl font-extrabold text-[#202938] tracking-tight">
              {project?.name || "Zojila Strategic Bi-Directional Tunnel"}
            </h1>

            <p className="mt-2 text-sm text-[#64748B] max-w-2xl">
              {project?.subsidiaryName} • {project?.businessUnitName} • Location: {project?.location}
            </p>
          </div>

          {/* Quick Stat Actions */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="px-4 py-3 rounded-2xl bg-white/70 border border-slate-200/80 shadow-sm text-right">
              <div className="text-[11px] font-bold uppercase text-[#8F9EAF]">Reporting Deadline</div>
              <div className="text-sm font-extrabold text-[#E35D6A] flex items-center gap-1.5 justify-end mt-0.5">
                <Calendar size={14} />
                <span>{project?.deadline || project?.reportingDeadline || "31 Mar 2026"}</span>
              </div>
            </div>

            <PaButton
              icon={FileCheck2}
              onClick={() => navigate("consolidated-report")}
              size="md"
            >
              Assemble Report
            </PaButton>
          </div>
        </div>

        {/* Ambient background decoration */}
        <div className="absolute -top-12 -right-12 w-80 h-80 rounded-full bg-gradient-to-br from-[#315CFF]/15 via-[#6542F5]/15 to-[#8700E8]/10 blur-3xl pointer-events-none" />
      </div>

      {/* ── B. 8 Summary KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-5">
        <PaKpiCard
          title="Contributor Categories"
          value={7}
          label="All 7 roles mapped"
          icon={Layers}
          accentColor="#315CFF"
          onClick={() => navigate("categories")}
        />
        <PaKpiCard
          title="Assigned Users"
          value={kpis?.totalAssignedUsers ?? 0}
          label="Active site team"
          icon={Users}
          accentColor="#6542F5"
          onClick={() => navigate("users")}
        />
        <PaKpiCard
          title="Completed Submissions"
          value={kpis?.approvedSubmissions ?? 0}
          label="Ready for consolidation"
          icon={CheckCircle2}
          accentColor="#16A67A"
          onClick={() => navigate("collection-status", { filter: "submitted" })}
        />
        <PaKpiCard
          title="Pending Submissions"
          value={kpis?.pendingReviewSubmissions ?? 0}
          label="In preparation"
          icon={Clock}
          accentColor="#347DEB"
          onClick={() => navigate("collection-status", { filter: "pending" })}
        />
        <PaKpiCard
          title="Draft Submissions"
          value={kpis?.draftSubmissions ?? 0}
          label="Saved by contributors"
          icon={FileEdit}
          accentColor="#E9A23B"
          onClick={() => navigate("collection-status", { filter: "draft" })}
        />
        <PaKpiCard
          title="Returned for Correction"
          value={kpis?.returnedSubmissions ?? 0}
          label="Requires contributor action"
          icon={AlertTriangle}
          accentColor="#E35D6A"
          onClick={() => navigate("corrections")}
        />
        <PaKpiCard
          title="Evidence Uploaded"
          value={kpis?.totalEvidenceDocs ?? 0}
          label="Audit-ready files"
          icon={FolderLock}
          accentColor="#06B6D4"
          onClick={() => navigate("evidence")}
        />
        <PaKpiCard
          title="Missing Evidence"
          value={kpis?.missingEvidenceDocs ?? 0}
          label="Mandatory compliance gaps"
          icon={FileQuestion}
          accentColor="#EC4899"
          onClick={() => navigate("evidence", { filter: "missing" })}
        />
      </div>

      {/* ── C. Overall Completion & 7 Category Progress ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Overall Completion Ring Panel */}
        <PaGlassCard strong className="flex flex-col justify-between items-center text-center p-6 sm:p-8">
          <div className="w-full text-left">
            <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Project Reporting Health</span>
            <h3 className="text-xl font-bold text-[#202938] mt-1">Overall Completeness</h3>
          </div>

          <div className="my-6">
            <PaCircularProgress percentage={Math.round(kpis?.overallProgress ?? 0)} size={150} strokeWidth={12} />
          </div>

          <div className="w-full space-y-2 text-xs">
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50/80">
              <span className="text-[#64748B]">Completed Categories</span>
              <span className="font-bold text-emerald-600">6 of 7</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50/80">
              <span className="text-[#64748B]">Missing Evidence Files</span>
              <span className="font-bold text-rose-500">{kpis?.missingEvidenceDocs ?? 0} items</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50/80">
              <span className="text-[#64748B]">BU Manager Review Cycle</span>
              <span className="font-bold text-blue-600">Pending Submission</span>
            </div>
          </div>

          <PaButton
            variant="secondary"
            size="sm"
            onClick={() => navigate("consolidated-report")}
            className="w-full mt-5"
          >
            Review Completeness Audit
          </PaButton>
        </PaGlassCard>

        {/* 7 Interactive Contributor Category Cards */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-lg font-bold text-[#202938]">7 Contributor Categories</h3>
              <p className="text-xs text-[#64748B]">Operational ESG data collection status across functional divisions</p>
            </div>
            <PaButton size="sm" variant="ghost" onClick={() => navigate("categories")}>
              View All <ArrowRight size={14} className="ml-1" />
            </PaButton>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {(categoryProgress || []).map((c: any) => {
              const catKey = c.category || c.key || "ENV_DATA_USER";
              const def = CONTRIBUTOR_CATEGORIES[catKey as ContributorRole] || {};
              const label = c.label || c.name || def.label || catKey;
              const pct = c.completionPercent !== undefined ? c.completionPercent : (c.progressPct || 0);
              const color = c.accentColor || def.color || "#315CFF";
              const assignedLead = c.assignedUserName || "Contributor Lead";

              return (
                <div
                  key={catKey}
                  onClick={() => navigate("categories", { category: catKey })}
                  style={{ ["--kpi-glow" as any]: `${color}25` }}
                  className="pa-glass pa-glass-hover p-4 rounded-2xl cursor-pointer group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span
                        className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase"
                        style={{ background: `${color}20`, color }}
                      >
                        {def.label || label}
                      </span>
                      <span className="text-xs font-black text-[#1E293B]">{pct}%</span>
                    </div>

                    <h4 className="mt-2.5 text-xs font-bold text-[#1E293B] group-hover:text-[#315CFF] transition-colors line-clamp-1">
                      {def.name || label}
                    </h4>
                    <p className="text-[11px] text-[#64748B] mt-0.5 truncate">
                      Lead: {assignedLead}
                    </p>
                  </div>

                  <div className="mt-3.5">
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/50">
                      <div
                        className="h-full rounded-full transition-all duration-700 shadow-sm"
                        style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, #8700E8)` }}
                      />
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[10px] font-semibold text-[#64748B]">
                      <span>{c.totalMetrics ?? 10} Disclosures</span>
                      <span className={pct >= 100 ? "text-emerald-600 font-bold" : "text-blue-600 font-bold"}>
                        {pct >= 100 ? "Completed" : "In Progress"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── E. Analytics Section ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Performance Bars */}
        <PaGlassCard>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-[#202938]">Category Reporting Performance</h3>
              <p className="text-xs text-[#64748B]">Completed vs Pending submissions across categories</p>
            </div>
            <span className="px-2.5 py-1 rounded-xl bg-blue-50 text-[11px] font-bold text-blue-700">7 Categories</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics?.categoryPerformance || []} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(123, 161, 210, 0.2)" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#64748B" }} />
                <YAxis dataKey="category" type="category" tick={{ fontSize: 11, fill: "#202938", fontWeight: 600 }} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(255, 255, 255, 0.95)",
                    borderRadius: "16px",
                    boxShadow: "0 12px 34px rgba(65, 110, 190, 0.15)",
                    border: "1px solid rgba(255, 255, 255, 0.9)",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="completed" fill="#16A67A" radius={[0, 4, 4, 0]} name="Completed" />
                <Bar dataKey="pending" fill="#315CFF" radius={[0, 4, 4, 0]} name="Pending" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </PaGlassCard>

        {/* Submission Trend Line Chart */}
        <PaGlassCard>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-[#202938]">Reporting Submission Velocity</h3>
              <p className="text-xs text-[#64748B]">Monthly progression leading to annual filing</p>
            </div>
            <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-[11px] font-bold text-emerald-700">On Schedule</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics?.submissionTrend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(123, 161, 210, 0.2)" />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#64748B" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748B" }} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(255, 255, 255, 0.95)",
                    borderRadius: "16px",
                    boxShadow: "0 12px 34px rgba(65, 110, 190, 0.15)",
                    border: "1px solid rgba(255, 255, 255, 0.9)",
                    fontSize: "12px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="submissions"
                  stroke="#315CFF"
                  strokeWidth={3}
                  dot={{ fill: "#315CFF", r: 4 }}
                  name="Submissions"
                />
                <Line
                  type="monotone"
                  dataKey="approved"
                  stroke="#16A67A"
                  strokeWidth={3}
                  dot={{ fill: "#16A67A", r: 4 }}
                  name="Verified"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </PaGlassCard>
      </div>

      {/* ── F. Recent Activity & Corrections Feed ── */}
      <PaGlassCard>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-[#315CFF]">
              <Activity size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#202938]">Recent Operations & Contributor Activity</h3>
              <p className="text-xs text-[#64748B]">Real-time operational updates, uploads and BU Manager review remarks</p>
            </div>
          </div>
          <PaButton variant="ghost" size="sm" onClick={() => navigate("submissions")}>
            Full Audit Log <ArrowRight size={14} className="ml-1" />
          </PaButton>
        </div>

        <div className="space-y-3">
          {recentActivity?.map((act: PaActivityItem) => (
            <div
              key={act.id}
              className="flex items-center justify-between p-3.5 rounded-2xl bg-white/60 hover:bg-white/95 border border-slate-200/60 transition-all"
            >
              <div className="flex items-center gap-3.5">
                <div
                  className={`h-2.5 w-2.5 rounded-full ${
                    act.severity === "SUCCESS"
                      ? "bg-emerald-500"
                      : act.severity === "WARNING"
                      ? "bg-amber-500"
                      : "bg-blue-500"
                  }`}
                />
                <div>
                  <div className="text-xs font-bold text-[#202938]">
                    {act.actorName} <span className="font-normal text-[#64748B]">({act.actorRole})</span>
                  </div>
                  <div className="text-xs text-[#64748B] mt-0.5">
                    {act.targetType}: <span className="font-semibold text-slate-800">{act.targetLabel}</span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[11px] font-medium text-[#8F9EAF]">
                  {new Date(act.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </PaGlassCard>
    </div>
  );
}

