"use client";

// ── BU ADMIN · SCREEN 04 — Roles & Assignments ──
// Role boundary: BU Admin can grant ENV_DATA_USER · FIN_RESOURCE_USER · HR_USER ·
// EHS_USER · PROCUREMENT_USER · CSR_USER · COMPLIANCE_USER only.
// Approvals (report.approve) stay with the BU Manager — never the BU Admin.

import { useState } from "react";
import { ShieldCheck, ShieldQuestion } from "lucide-react";
import { ShieldIcon } from "@/components/workspace/premium-icons";
import { useBaApi } from "@/lib/ba/client";
import type { BaRolesData } from "@/lib/ba/types";
import {
  Chip, EmptyState, ErrorState, GlassCard, InfoRow, LoadingBlock, PageHeader, SectionCard, StatusBadge,
} from "@/components/workspace/ui";

const GRANT_TONE: Record<string, string> = {
  full: "green", own: "blue", none: "gray",
};
const GRANT_LABEL: Record<string, string> = {
  full: "Full", own: "Own BU", none: "—",
};

export default function RolesView() {
  const { data, loading, error, refetch } = useBaApi<BaRolesData>("/api/ba/roles");
  const [selected, setSelected] = useState<string | null>(null);

  const matrix = data?.matrix ?? [];
  const roles = data?.roles ?? [];
  const roleKeys = roles.map((r) => r.role);
  const selectedRole = roles.find((r) => r.role === selected) ?? null;

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="Roles & Assignments"
        description="Capability matrix for the BU workspace. BU Admin authority covers operational coordination only — review/approval rights stay with the BU Manager."
        icon={ShieldIcon}
      />

      {loading && !data ? <LoadingBlock rows={6} /> : error && !data ? <ErrorState message={error} onRetry={refetch} /> : data ? (
        <>
          {/* Role tiles */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {roles.map((r) => (
              <button key={r.role} onClick={() => setSelected(r.role === selected ? null : r.role)} className={`glass-ba glass-sheen flex flex-col gap-2 rounded-3xl p-4 text-left transition-all hover:-translate-y-0.5 hover:bg-white/85 ${selected === r.role ? "ring-2 ring-[color:var(--ba-sky-deep)]" : ""}`}>
                <div className="flex items-center justify-between">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${r.assignable ? "bg-[rgba(52,139,232,0.14)] text-[color:var(--ba-sky-deep)]" : "bg-[rgba(102,119,141,0.12)] text-[color:var(--ink-faint)]"}`}>
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <span className="text-[18px] font-bold tabular text-[color:var(--ink)]">{r.userCount}</span>
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-[color:var(--ink)]">{r.label}</div>
                  <div className="mt-0.5 line-clamp-2 text-[11px] text-[color:var(--ink-faint)]">{r.description}</div>
                </div>
                {r.assignable ? <Chip tone="blue">Assignable</Chip> : <Chip tone="gray">Higher scope</Chip>}
              </button>
            ))}
          </div>

          {/* Selected role details */}
          {selectedRole && (
            <SectionCard title={selectedRole.label} description={selectedRole.description} icon={ShieldIcon}>
              <div className="space-y-3">
                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">Permissions</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedRole.permissions.map((p) => <Chip key={p} tone="blue">{p}</Chip>)}
                  </div>
                </div>
                <div className="rounded-2xl bg-[rgba(52,139,232,0.06)] p-3 text-[12px] text-[color:var(--ink-soft)]">
                  {selectedRole.assignable
                    ? "This role is assignable from your BU workspace. Use the Users screen to invite a contributor with this role."
                    : "This role is reserved for higher-scope accounts (Group / Subsidiary / BU Manager) and cannot be created or modified from your workspace."}
                </div>
              </div>
            </SectionCard>
          )}

          {/* Capability matrix */}
          <SectionCard title="Capability matrix" description="What each role may do inside this BU workspace" icon={ShieldCheck}>
            <div className="nice-scroll overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr className="bg-white/70 backdrop-blur-md [&>th]:border-b [&>th]:border-[rgba(125,177,216,0.35)] [&>th]:px-3 [&>th]:py-2.5 [&>th]:text-left [&>th]:text-[11px] [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-wide [&>th]:text-[color:var(--ink-faint)]">
                    <th>Capability</th>
                    {roleKeys.map((k) => <th key={k} className="text-center">{data.roles.find((r) => r.role === k)?.label.replace(/ .+$/, "")}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((m) => (
                    <tr key={m.capability} className="border-b border-[rgba(125,177,216,0.18)]">
                      <td className="px-3 py-2.5">
                        <div className="text-[12.5px] font-semibold text-[color:var(--ink)]">{m.label}</div>
                        <div className="text-[10.5px] text-[color:var(--ink-faint)]">{m.capability}</div>
                      </td>
                      {roleKeys.map((k) => {
                        const g = m.grants[k] ?? "none";
                        return (
                          <td key={k} className="px-3 py-2.5 text-center">
                            <Chip tone={GRANT_TONE[g] as "green" | "blue" | "gray"}>{GRANT_LABEL[g]}</Chip>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-[color:var(--ink-faint)]">
              <span className="flex items-center gap-1.5"><Chip tone="green">Full</Chip> unrestricted within scope</span>
              <span className="flex items-center gap-1.5"><Chip tone="blue">Own BU</Chip> limited to assigned BU</span>
              <span className="flex items-center gap-1.5"><Chip tone="gray">—</Chip> no authority</span>
            </div>
          </SectionCard>

          {/* Assignment gaps */}
          <SectionCard title="Assignment gaps" description="BU contributors missing a critical scope binding" icon={ShieldQuestion}>
            {(data.assignmentGaps ?? []).length === 0 ? (
              <EmptyState title="No assignment gaps" message="Every active contributor in your BU is bound to a project." />
            ) : (
              <div className="space-y-2">
                {data.assignmentGaps.map((g) => (
                  <div key={g.userId} className="flex items-center justify-between rounded-2xl bg-white/60 px-3 py-2.5">
                    <div>
                      <div className="text-[13px] font-semibold text-[color:var(--ink)]">{g.name}</div>
                      <div className="text-[11px] text-[color:var(--ink-faint)]">{g.role} · {g.missing}</div>
                    </div>
                    <Chip tone="amber">Gap</Chip>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Change history */}
          <SectionCard title="Recent role changes" description="Audit trail scoped to this BU" noPad>
            <div className="px-4 py-2">
              {(data.changeHistory ?? []).length === 0 ? <EmptyState title="No role changes yet" /> : (
                <div className="space-y-1.5">
                  {data.changeHistory.slice(0, 12).map((a) => (
                    <div key={a.id} className="flex items-center justify-between rounded-xl bg-white/50 px-2.5 py-1.5 text-[12px]">
                      <div className="min-w-0"><span className="font-semibold text-[color:var(--ink)]">{a.actorName}</span> <span className="text-[color:var(--ink-faint)]">{a.action.replace(/_/g, " ").toLowerCase()}</span> <span className="text-[color:var(--ink-soft)]">{a.targetLabel}</span></div>
                      <div className="flex items-center gap-2"><Chip tone={a.outcome === "FAILURE" ? "red" : a.outcome === "DENIED" ? "red" : "green"}>{a.outcome}</Chip></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}
