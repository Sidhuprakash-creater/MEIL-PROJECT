"use client";

/* ── BU MANAGER · Consolidated rollup card ──────────────────────────────────
   The BU receives disclosures from several projects. This card is the ONE
   place where they are added up per section:

     Energy   3000 (Project A) + 2000 (Project B)  →  5000 total
     Evidence   2 files from A + 2 files from B      →  listed separately
     Soft copy  each project's own consolidated report attached next to it

   Confirmed numbers (reports the BU Manager approved) are what travel to the
   subsidiary in the final report; pending numbers stay visible but flagged. */

import { useState } from "react";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  FileText,
  Layers,
  Paperclip,
  Send,
  Sigma,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/workspace/ui";
import type { BuRollup } from "@/lib/bm/rollup-types";

const fmtNumber = (n: number) =>
  Number.isFinite(n) ? n.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "—";

interface Props {
  rollup: BuRollup | null;
  loading?: boolean;
  submitting?: boolean;
  onSubmitFinal?: () => void;
  onOpenReport?: (id: string) => void;
}

export function BuRollupCard({ rollup, loading, submitting, onSubmitFinal, onOpenReport }: Props) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  if (!rollup) {
    if (loading) {
      return (
        <div className="glass-bum rounded-2xl px-4 py-3 text-[12px] text-[color:var(--ink-faint)]">
          Building the consolidated rollup…
        </div>
      );
    }
    return null;
  }

  const { sections, totals } = rollup;
  const nothing = totals.reports === 0;

  return (
    <div className="glass-bum glass-sheen rounded-2xl p-4 space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[rgba(49,92,255,0.12)]">
          <Sigma className="h-4 w-4 text-[color:var(--bum-purple-deep)]" />
        </span>
        <div className="min-w-0">
          <div className="text-[13.5px] font-bold text-[color:var(--ink)]">
            Consolidated rollup — totals across your projects
          </div>
          <div className="text-[11px] text-[color:var(--ink-faint)]">
            Every section adds up the approved reports of each project · {rollup.period}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Chip tone="gray">{totals.sections} sections</Chip>
          <Chip tone="purple">{totals.projects} projects</Chip>
          <Chip tone={totals.pendingReports > 0 ? "amber" : "green"}>
            {totals.confirmedReports} confirmed
          </Chip>
          {onSubmitFinal && (
            <Button
              size="sm"
              className="btn-bum-action h-8 rounded-xl"
              onClick={onSubmitFinal}
              disabled={submitting || totals.confirmedReports === 0}
              title={
                totals.confirmedReports === 0
                  ? "Approve at least one project report first"
                  : "Send the final consolidated report to your subsidiary"
              }
            >
              <Send className="mr-1 h-3.5 w-3.5" />
              {submitting ? "Submitting…" : "Submit final report to Subsidiary"}
            </Button>
          )}
        </div>
      </div>

      {nothing ? (
        <div className="rounded-2xl bg-white/50 px-4 py-5 text-center text-[12px] text-[color:var(--ink-faint)]">
          No project reports have reached your business unit yet. As soon as a Project Admin sends a
          consolidated package, the section totals appear here.
        </div>
      ) : (
        <div className="space-y-1.5">
          {sections.map((section) => {
            const open = !!openSections[section.category];
            return (
              <div key={section.category} className="glass-subtle rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggle(section.category)}
                  aria-expanded={open}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/50"
                >
                  <span className="text-[color:var(--bum-purple-deep)]">
                    {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-bold text-[color:var(--ink)]">{section.label}</span>
                      <Chip tone="gray">
                        {section.reportCount} report{section.reportCount === 1 ? "" : "s"}
                      </Chip>
                      <Chip tone="purple">
                        {section.projectCount} project{section.projectCount === 1 ? "" : "s"}
                      </Chip>
                    </div>
                    {section.pendingValue > 0 && (
                      <div className="text-[10.5px] text-[color:var(--ink-faint)]">
                        {fmtNumber(section.pendingValue)} {section.unit ?? ""} still awaiting your decision
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-[15px] font-bold text-[color:var(--ink)]">
                      {fmtNumber(section.confirmedValue)}
                      <span className="ml-1 text-[10.5px] font-semibold text-[color:var(--ink-faint)]">
                        {section.unit ?? ""}
                      </span>
                    </div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--ink-faint)]">
                      total (approved)
                    </div>
                  </div>
                </button>

                {open && (
                  <div className="border-t border-[rgba(139,92,246,0.12)] bg-white/40 divide-y divide-[rgba(139,92,246,0.08)]">
                    {section.projects.map((project) => {
                      const files = [...project.evidenceFiles, ...project.generalEvidence];
                      return (
                        <div key={project.projectId} className="px-4 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <Building2 className="h-4 w-4 shrink-0 text-[color:var(--bum-purple-deep)]" />
                              <span className="truncate text-[12.5px] font-semibold text-[color:var(--ink)]">
                                {project.projectName}
                              </span>
                              <Chip tone="gray">{project.reportCount} report{project.reportCount === 1 ? "" : "s"}</Chip>
                            </div>
                            <div className="flex items-center gap-2">
                              {project.pendingValue > 0 && (
                                <span className="text-[10.5px] font-semibold text-amber-600">
                                  +{fmtNumber(project.pendingValue)} {project.unit ?? ""} pending
                                </span>
                              )}
                              <span className="font-mono text-[12.5px] font-bold text-[color:var(--ink)]">
                                {fmtNumber(project.confirmedValue)} {project.unit ?? ""}
                              </span>
                            </div>
                          </div>

                          {/* Evidence of THIS project — never merged with the
                              other project's files, so the attribution
                              stays visible. */}
                          <div className="mt-2 space-y-1.5">
                            {files.length > 0 ? (
                              files.map((file) => (
                                <div
                                  key={file.id}
                                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/70 border border-slate-200/70 px-3 py-1.5"
                                >
                                  <div className="flex min-w-0 items-center gap-2">
                                    <Paperclip className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                                    <span className="truncate text-[11.5px] text-[color:var(--ink-soft)]">
                                      {file.name}
                                    </span>
                                    <span className="text-[10px] text-[color:var(--ink-faint)]">
                                      {file.fileType}
                                      {file.sizeKb ? ` · ${file.sizeKb} KB` : ""}
                                    </span>
                                  </div>
                                  {file.hasFile && file.filePath ? (
                                    <a
                                      href={file.filePath}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[10.5px] font-bold text-[color:var(--bum-purple-deep)] hover:underline"
                                    >
                                      Download
                                    </a>
                                  ) : (
                                    <span className="text-[10px] text-[color:var(--ink-faint)]">reference only</span>
                                  )}
                                </div>
                              ))
                            ) : (
                              <div className="text-[10.5px] text-[color:var(--ink-faint)]">
                                No evidence attached to this project's {section.label.toLowerCase()} reports.
                              </div>
                            )}
                          </div>

                          {/* Soft copy of the project's own consolidated report */}
                          {project.dossier && (
                            <button
                              type="button"
                              onClick={() => onOpenReport?.(project.dossier!.id)}
                              className="mt-2 flex w-full items-center gap-2 rounded-xl border border-dashed border-[rgba(49,92,255,0.35)] bg-[rgba(49,92,255,0.05)] px-3 py-1.5 text-left transition-colors hover:bg-[rgba(49,92,255,0.09)]"
                            >
                              <FileText className="h-3.5 w-3.5 shrink-0 text-[#315CFF]" />
                              <span className="truncate text-[11px] font-semibold text-[color:var(--ink)]">
                                {project.dossier.fileName}
                              </span>
                              <span className="text-[10px] text-[color:var(--ink-faint)]">
                                {project.dossier.ref} · project soft copy
                              </span>
                              <span className="ml-auto text-[10px] font-bold text-[#315CFF]">Open</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      {!nothing && (
        <div className="flex flex-wrap items-center gap-3 pt-1 text-[10.5px] text-[color:var(--ink-faint)]">
          <span className="flex items-center gap-1.5">
            <Layers className="h-3 w-3" /> Totals count the reports you approved
          </span>
          <span>·</span>
          <span>Each project keeps its own evidence and its own report soft copy</span>
        </div>
      )}
    </div>
  );
}
