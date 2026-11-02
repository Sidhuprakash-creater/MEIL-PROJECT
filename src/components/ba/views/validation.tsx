"use client";

// ── BU ADMIN · SCREEN 12 — Data Validation ──
// Missing required fields, missing evidence, invalid formats, inconsistent
// periods, duplicates, calculation warnings, unresolved issues.
// BU Admin may monitor + notify responsible users — resolution stays with
// the BU Manager.

import { useMemo, useState } from "react";
import { ShieldAlert, UserCog } from "lucide-react";
import { DatabaseIcon } from "@/components/workspace/premium-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBaApi, apiPatch, fmtDate, fmtDateTime, timeAgo } from "@/lib/ba/client";
import type { ValidationRow } from "@/lib/ba/types";
import { VALIDATION_RULE_LABELS } from "@/lib/ba/types";
import {
  Chip, DataTable, EmptyState, ErrorState, GlassDialog, InfoRow, LoadingBlock, PageHeader, SectionCard, StatusBadge, Toolbar, type Column,
} from "@/components/workspace/ui";
import { DetailSheet } from "@/components/workspace/ui";
import { useToast } from "@/hooks/use-toast";

type Response = { issues: ValidationRow[]; total: number; summary: { open: number; critical: number; assigned: number; resolved: number } };

const SEV_TONE: Record<string, "red" | "amber" | "blue" | "gray"> = {
  CRITICAL: "red", HIGH: "red", MEDIUM: "amber", LOW: "blue",
};

export default function ValidationView() {
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [rule, setRule] = useState("ALL");
  const [detailId, setDetailId] = useState<string | null>(null);

  const q = search.toLowerCase();
  const apiPath = `/api/ba/validation?q=${encodeURIComponent(q)}&severity=${severity}&status=${status}&rule=${rule}&pageSize=50`;
  const { data, loading, error, refetch } = useBaApi<Response>(apiPath, { deps: [q, severity, status, rule] });

  const rows = data?.issues ?? [];
  const summary = data?.summary;

  const columns: Column<ValidationRow>[] = useMemo(() => [
    { key: "ref", header: "Reference", sortable: true, sortValue: (r) => r.ref, render: (r) => <div><div className="text-[13px] font-semibold">{r.ref}</div><div className="truncate text-[11px] text-[color:var(--ink-faint)]">{r.submissionRef}</div></div> },
    { key: "rule", header: "Rule", sortable: true, sortValue: (r) => r.rule, render: (r) => <Chip tone="blue">{VALIDATION_RULE_LABELS[r.rule] ?? r.rule}</Chip> },
    { key: "severity", header: "Severity", sortable: true, sortValue: (r) => r.severity, render: (r) => <Chip tone={SEV_TONE[r.severity] ?? "gray"}>{r.severity}</Chip> },
    { key: "description", header: "Description", render: (r) => <span className="line-clamp-2 text-[12px] text-[color:var(--ink-soft)]">{r.description}</span> },
    { key: "project", header: "Project / BU", render: (r) => <span className="truncate text-[12px] text-[color:var(--ink-soft)]">{r.projectName ?? "—"}</span> },
    { key: "responsible", header: "Responsible", render: (r) => <span className="text-[12px] text-[color:var(--ink-soft)]">{r.responsibleName}</span> },
    { key: "detectedAt", header: "Detected", sortable: true, sortValue: (r) => r.detectedAt, render: (r) => <span className="text-[12px] text-[color:var(--ink-soft)]">{fmtDate(r.detectedAt)}</span> },
    { key: "status", header: "Status", sortable: true, sortValue: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
  ], []);

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="Data Validation"
        description="Data quality issues across your BU. Each entry identifies the source report, affected field, severity and next step. Resolution stays with the BU Manager."
        icon={DatabaseIcon}
      />

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryTile label="Open" value={summary?.open ?? 0} tone="amber" />
        <SummaryTile label="Critical" value={summary?.critical ?? 0} tone="red" />
        <SummaryTile label="Assigned" value={summary?.assigned ?? 0} tone="blue" />
        <SummaryTile label="Resolved" value={summary?.resolved ?? 0} tone="green" />
      </div>

      <Toolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search ref, description, owner…"
        filters={[
          { key: "severity", label: "Severity", options: [{ value: "ALL", label: "All severities" }, { value: "LOW", label: "Low" }, { value: "MEDIUM", label: "Medium" }, { value: "HIGH", label: "High" }, { value: "CRITICAL", label: "Critical" }], value: severity, onChange: setSeverity },
          { key: "status", label: "Status", options: [{ value: "ALL", label: "All" }, { value: "OPEN", label: "Open" }, { value: "ASSIGNED", label: "Assigned" }, { value: "RESOLVED", label: "Resolved" }, { value: "WAIVED", label: "Waived" }], value: status, onChange: setStatus },
          { key: "rule", label: "Rule", options: [{ value: "ALL", label: "All rules" }, ...Object.keys(VALIDATION_RULE_LABELS).map((k) => ({ value: k, label: VALIDATION_RULE_LABELS[k] }))], value: rule, onChange: setRule },
        ]}
        onReset={() => { setSearch(""); setSeverity("ALL"); setStatus("ALL"); setRule("ALL"); }}
        resultCount={data?.total ?? 0}
      />

      <DataTable<ValidationRow>
        columns={columns}
        rows={rows}
        loading={loading && !data}
        error={error && !data ? error : null}
        onRetry={refetch}
        pageSize={10}
        onRowClick={(r) => setDetailId(r.id)}
        emptyTitle={rows.length === 0 ? "No validation issues" : "No matches"}
        emptyMessage={rows.length === 0 ? "Clean reporting! No data quality issues detected for your BU." : "Try adjusting the filters."}
        mobileCard={(r) => (
          <div className="flex flex-col gap-2 p-3">
            <div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="text-[13px] font-semibold">{r.ref}</div><div className="text-[11px] text-[color:var(--ink-faint)]">{r.submissionRef}</div></div><div className="flex flex-col items-end gap-1"><Chip tone={SEV_TONE[r.severity] ?? "gray"}>{r.severity}</Chip><StatusBadge status={r.status} /></div></div>
            <p className="text-[12px] text-[color:var(--ink-soft)]">{r.description}</p>
          </div>
        )}
      />

      <DetailSheet
        open={!!detailId}
        onOpenChange={(o) => { if (!o) setDetailId(null); }}
        title={detailId ? "Validation issue" : ""}
        subtitle="Notify the responsible user — resolution belongs to the BU Manager"
        width="md"
      >
        <ValidationDetail id={detailId} onAssign={() => refetch()} />
      </DetailSheet>
    </div>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: number; tone: "red" | "amber" | "blue" | "green" }) {
  const hues: Record<string, string> = { red: "#E35D6A", amber: "#c57926", blue: "#348BE8", green: "#16A67A" };
  return (
    <div className="glass-ba glass-sheen flex items-center gap-3 rounded-3xl p-4">
      <span className="flex h-2.5 w-2.5 rounded-full" style={{ background: hues[tone] }} />
      <div>
        <div className="text-[20px] font-bold tabular text-[color:var(--ink)]">{value}</div>
        <div className="text-[11px] font-medium text-[color:var(--ink-faint)]">{label}</div>
      </div>
    </div>
  );
}

function ValidationDetail({ id, onAssign }: { id: string | null; onAssign: () => void }) {
  const { data, loading, error, refetch } = useBaApi<{ issue: ValidationRow }>(id ? `/api/ba/validation/${id}` : null);
  const { toast } = useToast();
  if (!id) return null;
  if (loading && !data) return <LoadingBlock rows={4} />;
  if (error && !data) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return <EmptyState title="Issue not found" />;
  const v = data.issue;

  const notify = async () => {
    if (!v.responsibleName) {
      toast({ title: "No responsible user", description: "This issue has no responsible user to notify." });
      return;
    }
    try {
      await apiPatch(`/api/ba/validation/${v.id}`, { action: "notify", ownerName: v.responsibleName });
      toast({ title: "Responsible user notified", description: `${v.responsibleName} has been asked to correct this issue.` });
      onAssign();
    } catch (e) {
      toast({ title: "Could not notify", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="glass-subtle rounded-2xl p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={SEV_TONE[v.severity] ?? "gray"}>{v.severity}</Chip>
          <Chip tone="blue">{VALIDATION_RULE_LABELS[v.rule] ?? v.rule}</Chip>
          <StatusBadge status={v.status} />
        </div>
        <div className="mt-2 text-[14px] font-semibold text-[color:var(--ink)]">{v.ref}</div>
        <p className="mt-1 text-[12.5px] text-[color:var(--ink-soft)]">{v.description}</p>
      </div>
      <SectionCard title="Issue context" noPad>
        <div className="px-4 py-2">
          <InfoRow label="Submission ref">{v.submissionRef || "—"}</InfoRow>
          <InfoRow label="Project / BU">{v.projectName ?? "—"}</InfoRow>
          <InfoRow label="Responsible user">{v.responsibleName || "—"}</InfoRow>
          <InfoRow label="Owner (assigned)">{v.ownerName || "—"}</InfoRow>
          <InfoRow label="Detected at">{fmtDateTime(v.detectedAt)} · {timeAgo(v.detectedAt)}</InfoRow>
          <InfoRow label="Resolved at">{v.resolvedAt ? fmtDateTime(v.resolvedAt) : "—"}</InfoRow>
          {v.resolveNote && <InfoRow label="Resolve note">{v.resolveNote}</InfoRow>}
        </div>
      </SectionCard>
      <div className="rounded-2xl bg-[rgba(197,121,38,0.08)] p-3 text-[12px] text-[color:var(--ink-soft)]">
        <div className="flex items-center gap-2 text-[12px] font-semibold text-[#9c5d1b]"><ShieldAlert className="h-4 w-4" /> Resolution boundary</div>
        <p className="mt-1">Closing (RESOLVED / WAIVED) belongs to the BU Manager. From this workspace you may notify the responsible user — they will see the message on every console.</p>
      </div>
      <Button className="btn-ba-action rounded-2xl" onClick={notify}><UserCog className="mr-1.5 h-4 w-4" /> Notify responsible user</Button>
    </div>
  );
}
