"use client";

// ── GROUP ADMIN · BRSR Data Checklist ────────────────────────────────────
// Section-wise view of which subsidiaries have supplied the BRSR template
// inputs (entity profile, workforce, policies, methodology, emission
// factors…) so the consolidated BRSR report can be compiled.

import { FileCheck, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Chip, EmptyState, ErrorState, GlassCard, GlassProgress, LoadingBlock, PageHeader, SectionCard,
} from "@/components/workspace/ui";
import { REPORTING_YEARS, useWorkspace } from "@/lib/esg/store";
import { useApi } from "@/lib/esg/client";

interface ChecklistSub {
  subsidiaryId: string;
  subsidiaryName: string;
  subsidiaryCode: string;
  region: string;
  status: string;
  submittedAt: string | null;
  submittedBy: string;
  completeness: { filledFields: number; totalFields: number; pct: number; completedSections: number; totalSections: number };
  sectionStatus: { key: string; title: string; completed: boolean; started: boolean }[];
}

interface ChecklistResp {
  period: string;
  totalFields: number;
  summary: { subsidiaries: number; submitted: number; started: number; notStarted: number };
  subsidiaries: ChecklistSub[];
}

const TONE: Record<string, "green" | "amber" | "gray"> = {
  SUBMITTED: "green",
  DRAFT: "amber",
  NOT_STARTED: "gray",
};

export default function BrsrChecklistView() {
  const { reportingYear, setReportingYear } = useWorkspace();
  const { data, loading, error, refetch } = useApi<ChecklistResp>(
    `/api/esg/brsr-checklist?period=${encodeURIComponent(reportingYear)}`,
    [reportingYear]
  );

  if (loading && !data) return <div className="view-in space-y-4 pb-6"><LoadingBlock rows={6} label="Loading BRSR data checklist…" /></div>;
  if (error && !data) return <div className="view-in space-y-4 pb-6"><ErrorState message={error} onRetry={refetch} /></div>;
  if (!data) return null;

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="BRSR Data Checklist"
        description={`${reportingYear} · Which subsidiaries have supplied the BRSR template inputs — section-wise status and what is still missing.`}
        icon={FileCheck}
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

      <GlassCard className="p-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div><div className="text-[22px] font-bold tabular text-[color:var(--ink)]">{data.summary.subsidiaries}</div><div className="text-[11.5px] font-medium text-[color:var(--ink-faint)]">Subsidiaries in boundary</div></div>
          <div><div className="text-[22px] font-bold tabular text-[#1d6b40]">{data.summary.submitted}</div><div className="text-[11.5px] font-medium text-[color:var(--ink-faint)]">Data submitted</div></div>
          <div><div className="text-[22px] font-bold tabular text-[#9c5d1b]">{data.summary.started}</div><div className="text-[11.5px] font-medium text-[color:var(--ink-faint)]">Draft in progress</div></div>
          <div><div className="text-[22px] font-bold tabular text-[#a53b3b]">{data.summary.notStarted}</div><div className="text-[11.5px] font-medium text-[color:var(--ink-faint)]">Not started</div></div>
        </div>
      </GlassCard>

      {data.subsidiaries.length === 0 && (
        <EmptyState title="No subsidiaries in boundary" message="Add subsidiaries to start collecting BRSR template data." icon={FileCheck} />
      )}

      {data.subsidiaries.map((s) => (
        <SectionCard
          key={s.subsidiaryId}
          title={s.subsidiaryName}
          description={`${s.subsidiaryCode}${s.region ? ` · ${s.region}` : ""} · ${s.completeness.filledFields}/${s.completeness.totalFields} fields · ${s.completeness.completedSections}/${s.completeness.totalSections} sections complete`}
          icon={FileCheck}
          actions={<Chip tone={TONE[s.status] ?? "gray"}>{s.status.replace(/_/g, " ")}</Chip>}
        >
          <GlassProgress
            value={s.completeness.pct}
            tone={s.completeness.pct >= 80 ? "green" : s.completeness.pct >= 40 ? "blue" : s.completeness.pct > 0 ? "amber" : "red"}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {s.sectionStatus.map((sec) => (
              <Chip key={sec.key} tone={sec.completed ? "green" : sec.started ? "amber" : "gray"}>
                {sec.title.split("—")[0].trim()}
              </Chip>
            ))}
          </div>
          {s.submittedAt && (
            <p className="mt-3 text-[11.5px] text-[color:var(--ink-faint)]">
              Submitted {new Date(s.submittedAt).toLocaleDateString("en-GB")}{s.submittedBy ? ` by ${s.submittedBy}` : ""}
            </p>
          )}
        </SectionCard>
      ))}
    </div>
  );
}
