"use client";

// ── BU MANAGER · SCREEN 09 — Data Validation ──
import { useMemo, useState } from "react";
import { Database, ShieldCheck } from "lucide-react";
import { DatabaseIcon } from "@/components/workspace/premium-icons";
import { useBmWorkspace } from "@/lib/bm/store";
import { fmtDate, useBmApi } from "@/lib/bm/client";
import type { ValidationRow } from "@/lib/sa/types";
import { VALIDATION_RULE_LABELS } from "@/lib/sa/types";
import {
  Chip, CountUp, DataTable, DetailSheet, EmptyState, ErrorState, GlassCard, InfoRow, LoadingBlock, PageHeader, SectionCard, Toolbar, type Column,
} from "@/components/workspace/ui";
import { severityTone } from "@/components/bm/shared";
import { ReportReviewWorkspace } from "@/components/bm/review-detail";

type ListResponse = {
  issues: ValidationRow[];
  total: number;
  page: number;
  pageSize: number;
  summary: { open: number; critical: number; assigned: number; resolved: number };
};

export default function ValidationView() {
  const { navigate } = useBmWorkspace();
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [rule, setRule] = useState("ALL");
  const [issueId, setIssueId] = useState<string | null>(null);
  const [issueOpen, setIssueOpen] = useState(false);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  const { data, loading, error, refetch } = useBmApi<ListResponse>("/api/bm/validation?pageSize=100");

  const rows = useMemo(() => {
    let list = data?.issues ?? [];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((i) => `${i.ref} ${i.description} ${i.rule} ${i.responsibleName} ${i.submissionRef} ${i.projectName ?? ""}`.toLowerCase().includes(q));
    }
    return list;
  }, [data, search]);

  const { data: detail } = useBmApi<{ issue: ValidationRow }>(
    issueOpen && issueId ? `/api/bm/validation/${issueId}` : null,
    { pollMs: 0 }
  );
  const issue = detail?.issue ?? null;

  const columns: Column<ValidationRow>[] = [
    {
      key: "ref", header: "Issue", sortable: true, sortValue: (r) => r.ref,
      render: (r) => (
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-[color:var(--ink)]">{r.ref}</div>
          <div className="truncate text-[11px] text-[color:var(--ink-faint)]">{VALIDATION_RULE_LABELS[r.rule] ?? r.rule}</div>
        </div>
      ),
    },
    {
      key: "severity", header: "Severity", sortable: true, sortValue: (r) => r.severity,
      render: (r) => <Chip tone={severityTone(r.severity)}>{r.severity}</Chip>,
    },
    {
      key: "submissionRef", header: "Report", sortable: true, sortValue: (r) => r.submissionRef,
      render: (r) => <span className="text-[12.5px] font-medium text-[color:var(--bum-purple-deep)]">{r.submissionRef || "—"}</span>,
    },
    {
      key: "description", header: "Description", className: "max-w-[320px]",
      render: (r) => <p className="line-clamp-2 text-[12px] leading-relaxed text-[color:var(--ink-soft)]">{r.description}</p>,
    },
    { key: "project", header: "Project", render: (r) => <span className="text-[12.5px]">{r.projectName ?? "BU level"}</span> },
    {
      key: "status", header: "Status", sortable: true, sortValue: (r) => r.status,
      render: (r) => <Chip tone={r.status === "RESOLVED" || r.status === "WAIVED" ? "green" : r.status === "ASSIGNED" ? "purple" : "amber"}>{r.status}</Chip>,
    },
  ];

  const summary = data?.summary;

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="Data Validation"
        description="Actionable validation interface for ESG data — required-field completeness, valid units/formats, reporting-period consistency, calculation consistency, missing supporting evidence, potential duplicate or conflicting values. Distinguish hard errors from warnings; calculations use documented formulas and versioned factor sources."
        icon={Database}
      />

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Open issues", value: summary?.open ?? 0, hue: "#c57926" },
          { label: "Critical", value: summary?.critical ?? 0, hue: "#E35D6A" },
          { label: "Assigned", value: summary?.assigned ?? 0, hue: "#8B5CF6" },
          { label: "Resolved", value: summary?.resolved ?? 0, hue: "#16A67A" },
        ].map((c) => (
          <GlassCard key={c.label} className="glass-bum p-4">
            <div className="text-[24px] font-bold tabular leading-none" style={{ color: c.hue }}><CountUp value={c.value} /></div>
            <div className="mt-1.5 text-[11.5px] font-medium text-[color:var(--ink-soft)]">{c.label}</div>
          </GlassCard>
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading && !data}
        error={error}
        onRetry={refetch}
        pageSize={10}
        onRowClick={(r) => { setIssueId(r.id); setIssueOpen(true); }}
        emptyTitle="No validation issues"
        emptyMessage="Automated checks found no missing fields, duplicates or calculation exceptions."
        toolbar={
          <Toolbar
            search={search}
            onSearch={setSearch}
            searchPlaceholder="Search by ID, description, rule or report…"
            filters={[
              { key: "severity", label: "Severity", value: severity, onChange: setSeverity, options: [{ value: "ALL", label: "All severities" }, { value: "CRITICAL", label: "Critical" }, { value: "WARNING", label: "Warning" }, { value: "INFO", label: "Info" }] },
              { key: "status", label: "Status", value: status, onChange: setStatus, options: [{ value: "ALL", label: "All statuses" }, { value: "OPEN", label: "Open" }, { value: "ASSIGNED", label: "Assigned" }, { value: "RESOLVED", label: "Resolved" }, { value: "WAIVED", label: "Waived" }] },
              { key: "rule", label: "Rule", value: rule, onChange: setRule, options: [{ value: "ALL", label: "All rules" }, ...Object.keys(VALIDATION_RULE_LABELS).map((r) => ({ value: r, label: VALIDATION_RULE_LABELS[r] }))] },
            ]}
            onReset={() => { setSearch(""); setSeverity("ALL"); setStatus("ALL"); setRule("ALL"); }}
            resultCount={rows.length}
          />
        }
        rowActions={(r) => (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => { setIssueId(r.id); setIssueOpen(true); }}
              className="rounded-xl px-2.5 py-1 text-[11.5px] font-medium text-[color:var(--bum-purple-deep)] hover:bg-white/70"
            >
              Inspect
            </button>
            {r.submissionRef && (
              <button
                onClick={() => navigate("queue", { q: r.submissionRef })}
                className="rounded-xl px-2.5 py-1 text-[11.5px] font-medium text-[color:var(--ink-soft)] hover:bg-white/70"
              >
                Open report
              </button>
            )}
          </div>
        )}
        mobileCard={(r) => (
          <div className="glass-subtle rounded-2xl p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[13px] font-semibold text-[color:var(--ink)]">{r.ref}</span>
              <Chip tone={severityTone(r.severity)}>{r.severity}</Chip>
            </div>
            <div className="mt-1 truncate text-[12px] text-[color:var(--ink-soft)]">{VALIDATION_RULE_LABELS[r.rule] ?? r.rule}</div>
            <p className="mt-1 line-clamp-2 text-[11.5px] text-[color:var(--ink-soft)]">{r.description}</p>
            <button onClick={() => { setIssueId(r.id); setIssueOpen(true); }} className="mt-2 w-full rounded-xl bg-[rgba(139,92,246,0.1)] py-1.5 text-[12px] font-medium text-[color:var(--bum-purple-deep)]">Inspect issue</button>
          </div>
        )}
      />

      {/* Issue detail sheet (read-only — BU Manager can only annotate via decision) */}
      <DetailSheet
        open={issueOpen}
        onOpenChange={setIssueOpen}
        title={issue?.ref ?? "Validation issue"}
        subtitle={issue ? `${VALIDATION_RULE_LABELS[issue.rule] ?? issue.rule} · ${issue.severity}` : undefined}
        footer={
          issue && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11.5px] text-[color:var(--ink-faint)]">
                The BU Manager cannot resolve validation issues directly — they are owned by the Subsidiary Admin. Use the decision endpoint (return / reject) to annotate the report.
              </span>
              <div className="flex gap-2">
                {issue.submissionRef && (
                  <button
                    onClick={() => navigate("queue", { q: issue.submissionRef })}
                    className="rounded-2xl glass-subtle px-3 py-2 text-[12.5px] font-medium text-[color:var(--ink-soft)] hover:bg-white/80"
                  >
                    Open report
                  </button>
                )}
              </div>
            </div>
          )
        }
      >
        {issue && (
          <div className="space-y-4">
            <div className="glass-subtle rounded-2xl p-3.5">
              <InfoRow label="Status"><Chip tone={issue.status === "RESOLVED" || issue.status === "WAIVED" ? "green" : issue.status === "ASSIGNED" ? "purple" : "amber"}>{issue.status}</Chip></InfoRow>
              <InfoRow label="Severity"><Chip tone={severityTone(issue.severity)}>{issue.severity}</Chip></InfoRow>
              <InfoRow label="Rule">{VALIDATION_RULE_LABELS[issue.rule] ?? issue.rule}</InfoRow>
              <InfoRow label="Report">{issue.submissionRef || "—"}</InfoRow>
              <InfoRow label="Project">{issue.projectName ?? "BU level"}</InfoRow>
              <InfoRow label="Responsible user">{issue.responsibleName}</InfoRow>
              <InfoRow label="Correction owner">{issue.ownerName || "—"}</InfoRow>
              <InfoRow label="Detected">{fmtDate(issue.detectedAt)}</InfoRow>
              {issue.resolvedAt && <InfoRow label="Resolved">{fmtDate(issue.resolvedAt)}</InfoRow>}
            </div>
            <div>
              <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">Description</div>
              <p className="text-[13px] leading-relaxed text-[color:var(--ink-soft)]">{issue.description}</p>
            </div>
            {issue.resolveNote && (
              <div>
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">Resolution note</div>
                <p className="rounded-2xl bg-[rgba(22,166,122,0.06)] p-3 text-[12.5px] text-[color:var(--ink-soft)]">{issue.resolveNote}</p>
              </div>
            )}
            <p className="rounded-2xl bg-[rgba(139,92,246,0.06)] p-3 text-[11.5px] leading-relaxed text-[color:var(--ink-soft)]">
              The BU Manager cannot alter submitted values. Return the report for correction with the issue ref in the affected-fields comment so the responsible user knows exactly what to fix.
            </p>
          </div>
        )}
      </DetailSheet>

      <div className="flex items-center gap-2 text-[11.5px] text-[color:var(--ink-faint)]">
        <DatabaseIcon className="h-3.5 w-3.5 text-[color:var(--bum-purple-deep)]" />
        <ShieldCheck className="h-3.5 w-3.5 text-[#16A67A]" />
        Validation rules reference documented formulas, appropriate units, versioned emission-factor sources and configured org reporting rules. The BU Manager never invents factors or silently alters submitted values.
      </div>

      <ReportReviewWorkspace
        submissionId={reviewId}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
      />
    </div>
  );
}
