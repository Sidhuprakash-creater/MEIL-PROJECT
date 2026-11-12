"use client";

// ── GROUP ADMIN · BRSR Core — Annexure I (Format of BRSR Core) ───────────
//
// The SEBI Annexure I table, as reported: nine attributes, their parameters,
// the consolidated value for each, the measurement unit, the data & assurance
// approach and the cross-reference back to the BRSR Core principle.
//
// Values are rolled up from the subsidiaries' BRSR Data forms (and the
// platform's own disclosure ledger where it measures the quantity directly).

import { useState } from "react";
import {
  AlertTriangle, ChevronDown, ChevronRight, FileCheck2, RefreshCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Chip, EmptyState, ErrorState, GlassCard, GlassProgress, LoadingBlock, PageHeader, SectionCard,
} from "@/components/workspace/ui";
import { REPORTING_YEARS, useWorkspace } from "@/lib/esg/store";
import { useApi } from "@/lib/esg/client";

interface AnnexureParam {
  key: string;
  label: string;
  unit: string;
  assurance: string;
  crossRef: string;
  kind: "number" | "text";
  value: number | null;
  text: string | null;
  source: string;
  contributors: number;
  contributorDetail: { subsidiaryName: string; value: string }[];
}

interface AnnexureAttr {
  srNo: number;
  id: string;
  title: string;
  summary: string;
  parameters: AnnexureParam[];
}

interface AnnexureResp {
  period: string;
  framework: string;
  summary: {
    attributes: number;
    parameters: number;
    reported: number;
    completeness: number;
    subsidiaries: number;
    subsidiariesReporting: number;
  };
  attributes: AnnexureAttr[];
}

function fmt(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export default function BrsrAnnexure1View() {
  const { reportingYear, setReportingYear } = useWorkspace();
  const { data, loading, error, refetch } = useApi<AnnexureResp>(
    `/api/esg/brsr-annexure1?period=${encodeURIComponent(reportingYear)}`,
    [reportingYear]
  );
  const [open, setOpen] = useState<Record<string, boolean>>({});

  if (loading && !data) return <div className="view-in space-y-4 pb-6"><LoadingBlock rows={6} label="Loading Annexure I…" /></div>;
  if (error && !data) return <div className="view-in space-y-4 pb-6"><ErrorState message={error} onRetry={refetch} /></div>;
  if (!data) return null;

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="BRSR Core — Annexure I"
        description={`${reportingYear} · ${data.framework} — the nine attributes, their parameters and the consolidated group values as reported.`}
        icon={FileCheck2}
        actions={
          <div className="flex items-center gap-2">
            <select
              className="h-9 rounded-xl border border-[rgba(125,177,216,0.4)] bg-white/70 px-2.5 text-[12.5px] font-semibold text-[color:var(--ink)]"
              value={reportingYear}
              onChange={(e) => setReportingYear(e.target.value)}
            >
              {REPORTING_YEARS.map((y: string) => <option key={y}>{y}</option>)}
            </select>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={loading}>
              <RefreshCcw className="mr-1.5 h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
        }
      />

      {/* ── coverage hero ── */}
      <GlassCard className="p-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <div className="text-[22px] font-bold tabular text-[color:var(--ink)]">{data.summary.attributes}</div>
            <div className="text-[11.5px] font-medium text-[color:var(--ink-faint)]">Attributes reported</div>
          </div>
          <div>
            <div className="text-[22px] font-bold tabular text-[color:var(--ink)]">
              {data.summary.reported}/{data.summary.parameters}
            </div>
            <div className="text-[11.5px] font-medium text-[color:var(--ink-faint)]">Parameters with a value</div>
          </div>
          <div>
            <div className="text-[22px] font-bold tabular text-[#1d6b40]">{data.summary.subsidiariesReporting}</div>
            <div className="text-[11.5px] font-medium text-[color:var(--ink-faint)]">Subsidiaries reporting</div>
          </div>
          <div>
            <div className="text-[22px] font-bold tabular text-[#1a5fb8]">{data.summary.completeness}%</div>
            <div className="text-[11.5px] font-medium text-[color:var(--ink-faint)]">Annexure I completeness</div>
          </div>
        </div>
        <div className="mt-4">
          <GlassProgress
            value={data.summary.completeness}
            tone={data.summary.completeness >= 80 ? "green" : data.summary.completeness >= 40 ? "blue" : "amber"}
          />
        </div>
      </GlassCard>

      {data.attributes.length === 0 && (
        <EmptyState
          title="No Annexure I attributes"
          message="The Annexure I registry could not be loaded."
          icon={FileCheck2}
        />
      )}

      {/* ── the nine attributes ── */}
      {data.attributes.map((attr) => {
        const isOpen = !!open[attr.id];
        const filled = attr.parameters.filter((p) => (p.kind === "number" ? p.value !== null : p.text !== null)).length;
        return (
          <SectionCard
            key={attr.id}
            title={`${attr.srNo}. ${attr.title}`}
            description={attr.summary}
            icon={FileCheck2}
            actions={
              <div className="flex items-center gap-2">
                <Chip tone={filled === attr.parameters.length ? "green" : filled > 0 ? "amber" : "gray"}>
                  {filled}/{attr.parameters.length}
                </Chip>
                <button
                  type="button"
                  onClick={() => setOpen((p) => ({ ...p, [attr.id]: !isOpen }))}
                  className="rounded-lg p-1 text-[color:var(--ink-faint)] transition-colors hover:bg-white/70 hover:text-[color:var(--ink)]"
                  aria-label={isOpen ? "Collapse" : "Expand"}
                  aria-expanded={isOpen}
                >
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              </div>
            }
          >
            {!isOpen ? (
              <div className="space-y-1.5">
                {attr.parameters.map((p) => (
                  <div key={p.key} className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl bg-white/60 px-3 py-2">
                    <span className="min-w-0 flex-1 text-[12px] text-[color:var(--ink-soft)]">{p.label}</span>
                    <span className="shrink-0 font-mono text-[12px] font-bold tabular text-[color:var(--ink)]">
                      {p.kind === "number" ? `${fmt(p.value)} ${p.unit}` : p.text ?? "—"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {attr.parameters.map((p) => (
                  <div key={p.key} className="rounded-2xl border border-white/70 bg-white/70 p-3.5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-[12.5px] font-semibold text-[color:var(--ink)]">{p.label}</div>
                        <div className="mt-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-[color:var(--ink-faint)]">
                          {p.unit} · {p.crossRef}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-mono text-[15px] font-bold tabular text-[color:var(--ink)]">
                          {p.kind === "number" ? `${fmt(p.value)} ${p.unit}` : ""}
                        </div>
                        {p.kind === "text" && (
                          <div className="max-w-[320px] text-[11px] leading-relaxed text-[color:var(--ink-soft)]">{p.text ?? "—"}</div>
                        )}
                        <div className="mt-0.5 text-[10px] text-[color:var(--ink-faint)]">{p.source}</div>
                      </div>
                    </div>
                    <div className="mt-2.5 border-t border-white/70 pt-2.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">
                        Data &amp; assurance approach
                      </div>
                      <div className="mt-1 text-[11.5px] leading-relaxed text-[color:var(--ink-soft)]">{p.assurance}</div>
                    </div>
                    {p.contributors > 1 && (
                      <div className="mt-2 flex items-center gap-1.5 text-[10.5px] font-medium text-[#1a5fb8]">
                        <AlertTriangle className="h-3 w-3" />
                        Aggregated from {p.contributors} subsidiary submissions
                      </div>
                    )}
                    {p.contributorDetail?.length > 1 && (
                      <details className="mt-2 rounded-xl bg-white/70 px-3 py-2">
                        <summary className="cursor-pointer text-[10.5px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">
                          Subsidiary statements ({p.contributorDetail.length})
                        </summary>
                        <ul className="mt-1.5 space-y-1">
                          {p.contributorDetail.map((c, i) => (
                            <li key={i} className="text-[11px] leading-relaxed text-[color:var(--ink-soft)]">
                              <strong className="font-semibold text-[color:var(--ink)]">{c.subsidiaryName}:</strong> {c.value}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        );
      })}
    </div>
  );
}
