"use client";

import React, { useState, useEffect } from "react";
import {
  Layers,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FolderLock,
  ArrowRight,
  Bell,
  X,
  FileSpreadsheet,
} from "lucide-react";
import { usePaStore } from "@/lib/project-admin/store";
import { paApiGet, getCachedPaData } from "@/lib/project-admin/client";
import { PaGlassCard, PaPageHeader, PaButton, PaStatusBadge, PaDrawer } from "../ui";
import { MeilBoxLoader } from "@/components/shared/meil-loader";
import type { ContributorRole } from "@/lib/project-admin/types";

export default function CategoriesView() {
  const { navigate, viewParams } = usePaStore();
  const cached = getCachedPaData<any>("/api/project-admin/categories");
  const [loading, setLoading] = useState(!cached);
  const [categories, setCategories] = useState<any[]>(cached?.categories || []);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);

  const loadCategories = () => {
    if (!categories.length) setLoading(true);
    paApiGet<any>("/api/project-admin/categories")
      .then((res) => {
        setCategories(res.categories || []);
        if (viewParams.category) {
          const match = res.categories?.find((c: any) => c.key === viewParams.category);
          if (match) setSelectedCategory(match);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount data load
    loadCategories();
  }, [viewParams.category]);

  if (loading && categories.length === 0) {
    return (
      <div className="glass rounded-2xl p-6">
        <MeilBoxLoader boxHeight="min-h-[360px]" label="Loading Contributor Categories…" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PaPageHeader
        title="7 Contributor Categories"
        subtitle="Dedicated operational workspaces for each designated ESG reporting functional area"
        actions={
          <PaButton
            variant="secondary"
            size="sm"
            icon={FileSpreadsheet}
            onClick={() => navigate("collection-status")}
          >
            Data Collection Register
          </PaButton>
        }
      />

      {/* 7 Category Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {categories.map((c) => (
          <PaGlassCard
            key={c.key}
            hover
            onClick={() => setSelectedCategory(c)}
            className="flex flex-col justify-between group relative overflow-hidden"
          >
            <div>
              <div className="flex items-center justify-between">
                <span
                  className="px-3 py-1 rounded-full text-xs font-bold"
                  style={{ background: `${c.accentColor}18`, color: c.accentColor }}
                >
                  {c.shortLabel}
                </span>
                <span className="text-sm font-black text-[#202938]">{c.progressPct}%</span>
              </div>

              <h3 className="mt-3 text-base font-bold text-[#202938] group-hover:text-[#315CFF] transition-colors">
                {c.name}
              </h3>
              <p className="mt-1 text-xs text-[#64748B] line-clamp-2">{c.description}</p>
            </div>

            <div className="mt-6 space-y-3">
              {/* Progress bar */}
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${c.progressPct}%`, background: c.accentColor }}
                />
              </div>

              {/* Counts row */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center text-xs">
                <div>
                  <div className="text-[10px] uppercase font-bold text-[#8F9EAF]">Users</div>
                  <div className="font-extrabold text-[#202938]">{c.assignedUsers?.length || 0}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-[#8F9EAF]">Done</div>
                  <div className="font-extrabold text-emerald-600">{c.completedCount}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-[#8F9EAF]">Evidence</div>
                  <div className="font-extrabold text-[#315CFF]">{c.evidenceCompletenessPct}%</div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between text-xs text-[#315CFF] font-bold group-hover:translate-x-1 transition-transform">
                <span>View Details</span>
                <ArrowRight size={14} />
              </div>
            </div>
          </PaGlassCard>
        ))}
      </div>

      {/* ── Category Detail Inspection Drawer ── */}
      <PaDrawer
        open={Boolean(selectedCategory)}
        onClose={() => setSelectedCategory(null)}
        title={selectedCategory?.name || "Category Details"}
        subtitle={`Operational ESG scope: ${selectedCategory?.shortLabel}`}
      >
        {selectedCategory && (
          <div className="space-y-6 text-xs">
            {/* Overview Card */}
            <div className="p-4 rounded-2xl bg-white/80 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#202938]">Overall Progress</span>
                <span className="font-black text-[#315CFF] text-base">{selectedCategory.progressPct}%</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${selectedCategory.progressPct}%`, background: selectedCategory.accentColor }}
                />
              </div>
              <p className="text-[#64748B] text-[11px]">{selectedCategory.description}</p>
            </div>

            {/* Assigned Users Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-sm text-[#202938] flex items-center gap-2">
                  <Users size={16} className="text-[#315CFF]" /> Assigned Contributors
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory(null);
                    navigate("users");
                  }}
                  className="text-[#315CFF] hover:underline font-bold text-[11px]"
                >
                  Manage
                </button>
              </div>

              <div className="space-y-2">
                {selectedCategory.assignedUsers?.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-50 text-slate-500 text-center">
                    No contributor assigned to this category yet.
                  </div>
                ) : (
                  selectedCategory.assignedUsers?.map((u: any) => (
                    <div key={u.id} className="p-3 rounded-xl bg-white/70 border border-slate-200/60 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-[#202938]">{u.name}</div>
                        <div className="text-[11px] text-[#64748B]">{u.email} • {u.employeeId}</div>
                      </div>
                      <PaStatusBadge status={u.status} />
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Reporting Sections */}
            <div>
              <h4 className="font-bold text-sm text-[#202938] mb-2 flex items-center gap-2">
                <Layers size={16} className="text-[#6542F5]" /> Assigned Reporting Sections
              </h4>
              <div className="space-y-2">
                {selectedCategory.sections?.map((sec: any) => (
                  <div key={sec.code} className="p-3 rounded-xl bg-white/70 border border-slate-200/60 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#202938]">{sec.code}: {sec.title}</span>
                      <PaStatusBadge status={sec.status} />
                    </div>
                    <p className="text-[11px] text-[#64748B]">{sec.desc}</p>
                    <div className="flex gap-1.5 mt-1 flex-wrap">
                      {sec.metrics?.map((m: string) => (
                        <span key={m} className="px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-semibold text-slate-700">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 flex items-center gap-3">
              <PaButton
                variant="primary"
                className="w-full"
                onClick={() => {
                  setSelectedCategory(null);
                  navigate("collection-status", { category: selectedCategory.key });
                }}
              >
                Inspect Category Submissions
              </PaButton>
            </div>
          </div>
        )}
      </PaDrawer>
    </div>
  );
}

