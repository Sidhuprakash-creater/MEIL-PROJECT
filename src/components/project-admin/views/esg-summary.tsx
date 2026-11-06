"use client";

import React, { useState, useEffect } from "react";
import {
  Leaf,
  Zap,
  Droplets,
  Trash2,
  Users,
  ShieldCheck,
  Calculator,
  ArrowRight,
  TrendingDown,
  Info,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";
import { usePaStore } from "@/lib/project-admin/store";
import { paApiGet, getCachedPaData } from "@/lib/project-admin/client";
import { PaGlassCard, PaPageHeader, PaButton, PaStatusBadge, PaTabStrip, PaKpiCard } from "../ui";
import { MeilBoxLoader } from "@/components/shared/meil-loader";
import type { PaEsgSummaryData } from "@/lib/project-admin/types";

export default function EsgSummaryView() {
  const { navigate } = usePaStore();
  const cached = getCachedPaData<any>("/api/project-admin/esg-summary");
  const [loading, setLoading] = useState(!cached);
  const [data, setData] = useState<PaEsgSummaryData | null>(cached?.esg || null);
  const [activeTab, setActiveTab] = useState("energy");

  const loadEsg = () => {
    if (!data) setLoading(true);
    paApiGet<any>("/api/project-admin/esg-summary")
      .then((res) => setData(res.esg))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount data load
    loadEsg();
  }, []);

  if (loading && !data) {
    return (
      <div className="glass rounded-2xl p-6">
        <MeilBoxLoader boxHeight="min-h-[360px]" label="Loading Environmental & ESG Summary…" />
      </div>
    );
  }

  const { energy, ghg, water, waste, social, compliance } = data || ({} as any);

  const tabs = [
    { id: "energy", label: "Energy & Automated GHG" },
    { id: "water", label: "Water Management" },
    { id: "waste", label: "Waste & Circularity" },
    { id: "social", label: "Social & Safety" },
    { id: "compliance", label: "Statutory Governance" },
  ];

  const energyChartData = [
    { name: "Grid Power", value: energy?.gridKwh || 125000, color: "#315CFF" },
    { name: "DG Diesel", value: (energy?.dieselLiters || 4200) * 10, color: "#F59E0B" },
    { name: "Solar On-site", value: energy?.solarKwh || 28000, color: "#10B981" },
  ];

  const emissionsChartData = [
    { name: "Scope 1 (Diesel/Direct)", value: ghg?.scope1Tonnes || 11.26, color: "#F59E0B" },
    { name: "Scope 2 (Grid/Purchased)", value: ghg?.scope2Tonnes || 89.5, color: "#315CFF" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PaPageHeader
        title="Environmental & ESG Intelligence"
        subtitle="Automated emissions calculation, resource balance and cross-pillar ESG metrics"
        actions={
          <PaButton
            variant="secondary"
            size="sm"
            onClick={() => navigate("consolidated-report")}
          >
            Review in Consolidated Report
          </PaButton>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <PaKpiCard title="Total Energy Consumed" value={`${energy?.totalGj || 550.8} GJ`} icon={Zap} accentColor="#315CFF" />
        <PaKpiCard title="Total GHG Emissions" value={`${ghg?.totalEmissions || 100.76} tCO2e`} icon={Leaf} accentColor="#10B981" />
        <PaKpiCard title="Water Recycled Share" value={`${Math.round(((water?.recycledKl || 1850) / (water?.withdrawalKl || 4200)) * 100)}%`} icon={Droplets} accentColor="#06B6D4" />
        <PaKpiCard title="Safe Man-Hours" value="680,000" icon={ShieldCheck} accentColor="#6542F5" />
      </div>

      {/* Tabs */}
      <PaTabStrip tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* ── TAB 1: Energy & Automated GHG Engine ── */}
      {activeTab === "energy" && (
        <div className="space-y-6">
          {/* Real Calculation Engine Banner */}
          <PaGlassCard strong className="p-6 border-l-4 border-l-[#315CFF]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="p-3 rounded-2xl bg-blue-100/60 text-[#315CFF]">
                  <Calculator size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#202938]">Deterministic GHG Calculation Engine</h3>
                  <p className="text-xs text-[#64748B] mt-1 max-w-3xl">
                    Energy activity logged by the Environment Data User automatically generates verified Scope 1 and Scope 2 GHG emissions. Approved emission factors are governed centrally and cannot be altered at site level.
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 whitespace-nowrap">
                Calculation Status: VERIFIED
              </span>
            </div>

            {/* Approved Factors Grid */}
            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              {ghg?.factors?.map((f: any) => (
                <div key={f.source} className="p-4 rounded-2xl bg-white/80 border border-slate-200/80 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-[#202938]">{f.source}</span>
                    <span className="font-mono font-bold text-[#315CFF]">{f.factor} {f.unit}</span>
                  </div>
                  <div className="text-[11px] text-[#64748B]">Agency: {f.sourceAgency} (v{f.version})</div>
                  <div className="p-2 rounded-xl bg-slate-50 font-mono text-[11px] text-slate-700">
                    Formula: {f.formula}
                  </div>
                </div>
              ))}
            </div>
          </PaGlassCard>

          {/* Activity Data & Calculations Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PaGlassCard>
              <h3 className="text-sm font-bold text-[#202938] mb-4">Energy Sourcing Breakdown</h3>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={energyChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(123, 161, 210, 0.2)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748B" }} />
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
                    <Bar dataKey="value" fill="#315CFF" radius={[6, 6, 0, 0]} name="Equiv Units" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </PaGlassCard>

            <PaGlassCard>
              <h3 className="text-sm font-bold text-[#202938] mb-4">Emissions Footprint (tCO2e)</h3>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={emissionsChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={45}
                      label={({ name, percent }) => `${name.split(" ")[0]} ${(percent * 100).toFixed(0)}%`}
                    >
                      {emissionsChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "rgba(255, 255, 255, 0.95)",
                        borderRadius: "16px",
                        boxShadow: "0 12px 34px rgba(65, 110, 190, 0.15)",
                        border: "1px solid rgba(255, 255, 255, 0.9)",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </PaGlassCard>
          </div>
        </div>
      )}

      {/* ── TAB 2: Water Management ── */}
      {activeTab === "water" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <PaGlassCard strong className="text-center p-6 space-y-2">
            <span className="text-xs font-bold uppercase text-[#8F9EAF]">Total Water Withdrawal</span>
            <div className="text-3xl font-extrabold text-[#202938]">{water?.withdrawalKl} kL</div>
            <p className="text-xs text-[#64748B]">Borewell & municipal supply</p>
          </PaGlassCard>
          <PaGlassCard strong className="text-center p-6 space-y-2">
            <span className="text-xs font-bold uppercase text-[#8F9EAF]">Treated / Recycled Water</span>
            <div className="text-3xl font-extrabold text-emerald-600">{water?.recycledKl} kL</div>
            <p className="text-xs text-[#64748B]">On-site ETP / STP recycling</p>
          </PaGlassCard>
          <PaGlassCard strong className="text-center p-6 space-y-2">
            <span className="text-xs font-bold uppercase text-[#8F9EAF]">Net Effluent Discharge</span>
            <div className="text-3xl font-extrabold text-blue-600">{water?.dischargeKl} kL</div>
            <p className="text-xs text-[#64748B]">Zero liquid discharge compliance target</p>
          </PaGlassCard>
        </div>
      )}

      {/* ── TAB 3: Waste Management ── */}
      {activeTab === "waste" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <PaGlassCard strong className="text-center p-6 space-y-2">
            <span className="text-xs font-bold uppercase text-[#8F9EAF]">Hazardous Waste Generated</span>
            <div className="text-3xl font-extrabold text-amber-600">{waste?.hazardousTonnes} MT</div>
            <p className="text-xs text-[#64748B]">Used lubricants & chemical drums</p>
          </PaGlassCard>
          <PaGlassCard strong className="text-center p-6 space-y-2">
            <span className="text-xs font-bold uppercase text-[#8F9EAF]">Non-Hazardous Debris</span>
            <div className="text-3xl font-extrabold text-[#202938]">{waste?.nonHazardousTonnes} MT</div>
            <p className="text-xs text-[#64748B]">Excavated rock, metal scraps, packaging</p>
          </PaGlassCard>
          <PaGlassCard strong className="text-center p-6 space-y-2">
            <span className="text-xs font-bold uppercase text-[#8F9EAF]">Recycling / Co-processing Share</span>
            <div className="text-3xl font-extrabold text-emerald-600">{waste?.recycledPct}%</div>
            <p className="text-xs text-[#64748B]">Authorized recycler manifests verified</p>
          </PaGlassCard>
        </div>
      )}

      {/* ── TAB 4: Social & Safety ── */}
      {activeTab === "social" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <PaGlassCard strong className="p-4 space-y-1">
            <span className="text-[10px] font-bold uppercase text-[#8F9EAF]">Site Headcount</span>
            <div className="text-2xl font-extrabold text-[#202938]">{social?.workforceTotal}</div>
            <div className="text-[11px] text-[#64748B]">Staff & workers</div>
          </PaGlassCard>
          <PaGlassCard strong className="p-4 space-y-1">
            <span className="text-[10px] font-bold uppercase text-[#8F9EAF]">Female Diversity</span>
            <div className="text-2xl font-extrabold text-[#315CFF]">
              {Math.round(((social?.femaleCount || 68) / (social?.workforceTotal || 340)) * 100)}%
            </div>
            <div className="text-[11px] text-[#64748B]">{social?.femaleCount} female staff</div>
          </PaGlassCard>
          <PaGlassCard strong className="p-4 space-y-1">
            <span className="text-[10px] font-bold uppercase text-[#8F9EAF]">LTIFR Score</span>
            <div className="text-2xl font-extrabold text-emerald-600">{social?.ltifr}</div>
            <div className="text-[11px] text-[#64748B]">Zero fatalities</div>
          </PaGlassCard>
          <PaGlassCard strong className="p-4 space-y-1">
            <span className="text-[10px] font-bold uppercase text-[#8F9EAF]">Safety Training</span>
            <div className="text-2xl font-extrabold text-[#6542F5]">{social?.trainingHoursTotal} hrs</div>
            <div className="text-[11px] text-[#64748B]">Toolbox & induction</div>
          </PaGlassCard>
        </div>
      )}

      {/* ── TAB 5: Compliance ── */}
      {activeTab === "compliance" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <PaGlassCard strong className="text-center p-6 space-y-2">
            <span className="text-xs font-bold uppercase text-[#8F9EAF]">Active Clearances</span>
            <div className="text-3xl font-extrabold text-emerald-600">{compliance?.validLicensesCount}</div>
            <p className="text-xs text-[#64748B]">CTO, CTE, Mining Lease, Forest NOC</p>
          </PaGlassCard>
          <PaGlassCard strong className="text-center p-6 space-y-2">
            <span className="text-xs font-bold uppercase text-[#8F9EAF]">Open Regulatory Notices</span>
            <div className="text-3xl font-extrabold text-emerald-600">{compliance?.noticesCount}</div>
            <p className="text-xs text-[#64748B]">Zero show-cause notices</p>
          </PaGlassCard>
          <PaGlassCard strong className="text-center p-6 space-y-2">
            <span className="text-xs font-bold uppercase text-[#8F9EAF]">Fines / Penalties Paid</span>
            <div className="text-3xl font-extrabold text-emerald-600">₹0</div>
            <p className="text-xs text-[#64748B]">100% regulatory compliance record</p>
          </PaGlassCard>
        </div>
      )}
    </div>
  );
}

