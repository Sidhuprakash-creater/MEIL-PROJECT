"use client";

// ── SUBSIDIARY MANAGER · Consolidated subsidiary rollup ─────────────────────
// Mirrors the BU manager's rollup, one level up: every business unit of the
// subsidiary → its category sections (emissions, energy, …) → per-project
// rows with downloadable evidence. Data comes live from /api/sm/rollup, so
// what the SM sees is exactly the sum of what the BUs approved and sent up.

import { useState } from "react";
import { ChevronDown, Landmark, Sigma } from "lucide-react";
import { Chip } from "@/components/workspace/ui";
import { useSmApi } from "@/lib/sm/client";
import { BuRollupCard } from "@/components/bm/rollup-card";
import type { BuRollup } from "@/lib/bm/rollup-types";

type SmRollupResponse = {
  rollup: {
    subsidiaryId: string;
    subsidiaryName: string;
    period: string;
    businessUnits: BuRollup[];
    totals: { reports: number; confirmedReports: number; pendingReports: number; projects: number; confirmedValue: number };
  };
};

export function SmRollupCard({ period, onOpenReport }: { period?: string; onOpenReport?: (id: string) => void }) {
  const path = `/api/sm/rollup${period ? `?period=${encodeURIComponent(period)}` : ""}`;
  const { data, loading, error } = useSmApi<SmRollupResponse>(path, { pollMs: 60000 });
  const [openBus, setOpenBus] = useState<Record<string, boolean>>({});
  const toggle = (buId: string) => setOpenBus((prev) => ({ ...prev, [buId]: !prev[buId] }));

  if (loading && !data) {
    return (
      <div className="glass-bum rounded-2xl px-4 py-3 text-[12px] text-[color:var(--ink-faint)]">
        Building the subsidiary-wide consolidated rollup…
      </div>
    );
  }
  if (error && !data) {
    return (
      <div className="glass-bum rounded-2xl px-4 py-3 text-[12px] text-[#E35D6A]">
        Rollup failed to load: {error}
      </div>
    );
  }
  const rollup = data?.rollup;
  if (!rollup || rollup.businessUnits.length === 0) return null;

  return (
    <div className="glass-bum glass-sheen rounded-2xl p-4 space-y-3">
      {/* Header — the subsidiary-wide sum */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[rgba(49,92,255,0.12)]">
          <Sigma className="h-4 w-4 text-[color:var(--bum-purple-deep)]" />
        </span>
        <div className="min-w-0">
          <div className="text-[13.5px] font-bold text-[color:var(--ink)]">
            Consolidated rollup — {rollup.subsidiaryName}
          </div>
          <div className="text-[11px] text-[color:var(--ink-faint)]">
            The sum of every business unit's approved and forwarded project reports · {rollup.period}
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Chip tone="purple">{rollup.businessUnits.length} BUs</Chip>
          <Chip tone="gray">{rollup.totals.projects} projects</Chip>
          <Chip tone={rollup.totals.pendingReports > 0 ? "amber" : "green"}>
            {rollup.totals.confirmedReports} confirmed
          </Chip>
          {rollup.totals.pendingReports > 0 && <Chip tone="amber">{rollup.totals.pendingReports} pending</Chip>}
        </div>
      </div>

      {/* Level 1 — business units */}
      <div className="space-y-2">
        {rollup.businessUnits.map((bu) => {
          const open = !!openBus[bu.buId];
          return (
            <div key={bu.buId} className="overflow-hidden rounded-2xl border border-white/60 bg-white/40">
              <button
                type="button"
                onClick={() => toggle(bu.buId)}
                className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/50"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[rgba(49,92,255,0.1)]">
                  <Landmark className="h-3.5 w-3.5 text-[color:var(--bum-purple-deep)]" />
                </span>
                <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-[color:var(--ink-faint)] transition-transform ${open ? "rotate-180" : ""}`} />
                <span className="text-[13px] font-bold text-[color:var(--ink)]">{bu.buName}</span>
                <span className="ml-auto flex flex-wrap items-center gap-2">
                  <Chip tone="gray">{bu.totals.sections} sections</Chip>
                  <Chip tone="purple">{bu.totals.projects} projects</Chip>
                  <Chip tone="blue">{bu.totals.reports} reports</Chip>
                  <Chip tone={bu.totals.pendingReports > 0 ? "amber" : "green"}>{bu.totals.confirmedReports} confirmed</Chip>
                </span>
              </button>
              {open && (
                <div className="border-t border-white/60 p-3">
                  {/* Level 2 — category sections; Level 3 — projects + evidence */}
                  <BuRollupCard rollup={bu} onOpenReport={onOpenReport} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
