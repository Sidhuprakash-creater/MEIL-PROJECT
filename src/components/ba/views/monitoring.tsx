"use client";

// ── BU ADMIN · SCREEN 08 — Report Monitoring (operational, read-only) ──
// Approve / Reject / Return-for-Correction decisions belong to the BU Manager.
// This view monitors reports and surfaces outcomes read-only.

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, FileText, Radar, ShieldAlert } from "lucide-react";
import { CheckSealIcon, FilesIcon, HourglassIcon, PulseIcon, AlarmAlertIcon } from "@/components/workspace/premium-icons";
import {
  Chip, CountUp, DataTable, EmptyState, ErrorState, GlassDialog, GlassTabBar, InfoRow, LoadingBlock, PageHeader, StatusBadge, Toolbar, type Column,
} from "@/components/workspace/ui";
import { Button } from "@/components/ui/button";
import { useBaApi, fmtDate, fmtDateTime } from "@/lib/ba/client";
import { useBaWorkspace } from "@/lib/ba/store";
import type { SubmissionRow, SubmissionDetail } from "@/lib/ba/types";
import { CATEGORY_LABELS } from "@/lib/ba/types";
import { fmtMetric } from "@/components/ba/shared";

type StatusKey = "all" | "submitted" | "pending" | "approved" | "rejected" | "returned" | "overdue";
type Response = {
  submissions: SubmissionRow[];
  total: number; page: number; pageSize: number;
  counts: { all: number; draft: number; submitted: number; pending: number; approved: number; rejected: number; overdue: number };
};

const STATUS_TAB_LABELS: Record<StatusKey, string> = {
  all: "All Reports", submitted: "Submitted", pending: "Pending Review",
  approved: "Approved", rejected: "Rejected", returned: "Returned for Correction", overdue: "Overdue",
};

/* returned = rejected (CHANGES_REQUESTED or REJECTED) — same as the rejected tab
   filter on the server; the FE surfaces both labels for clarity. */

export default function MonitoringView() {
  const { params, navigate, reportingYear } = useBaWorkspace();
  const [tab, setTab] = useState<StatusKey>(() => {
    const sf = params.statusFilter as StatusKey | undefined;
    return sf && ["all", "submitted", "pending", "approved", "rejected", "returned", "overdue"].includes(sf) ? (sf === "returned" ? "returned" : sf) : "all";
  });
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [detailId, setDetailId] = useState<string | null>(null);

  /* consume the deep-link once — the status filter only seeds initial state */
  useEffect(() => {
    if (params.statusFilter) {
      navigate("monitoring", { ...params, statusFilter: undefined });
    }
  }, []);

  /* "returned" maps to "rejected" tab on the server (CHANGES_REQUESTED + REJECTED). */
  const serverTab = tab === "returned" ? "rejected" : tab;
  const q = search.toLowerCase();
  const apiPath = `/api/ba/submissions?tab=${serverTab}&q=${encodeURIComponent(q)}&category=${category}&period=${encodeURIComponent(reportingYear)}&pageSize=50`;
  const { data, loading, error, refetch } = useBaApi<Response>(apiPath, { deps: [serverTab, q, category, reportingYear] });

  const rows = data?.submissions ?? [];
  const counts = data?.counts;
  const KPI_KEYS: { key: StatusKey; serverKey: "submitted" | "pending" | "approved" | "rejected" | "overdue"; icon: React.ComponentType<{ className?: string; hue?: string }>; hue: string; label: string; hint: string }[] = [
    { key: "submitted", serverKey: "submitted", icon: CheckSealIcon, hue: "#348BE8", label: "Submitted", hint: "Sent for review" },
    { key: "pending", serverKey: "pending", icon: HourglassIcon, hue: "#8B5CF6", label: "Pending Review", hint: "With the BU Manager" },
    { key: "approved", serverKey: "approved", icon: CheckSealIcon, hue: "#16A67A", label: "Approved", hint: "Cleared for consolidation" },
    { key: "rejected", serverKey: "rejected", icon: AlarmAlertIcon, hue: "#E35D6A", label: "Rejected / Returned", hint: "Awaiting correction" },
    { key: "overdue", serverKey: "overdue", icon: AlarmAlertIcon, hue: "#c57926", label: "Overdue", hint: "Past deadline, not approved" },
  ];

  const columns: Column<SubmissionRow>[] = useMemo(() => [
    { key: "ref", header: "Reference", sortable: true, sortValue: (r) => r.ref, render: (r) => <div><div className="text-[13px] font-semibold">{r.ref}</div><div className="truncate text-[11px] text-[color:var(--ink-faint)]">{r.title}</div></div> },
    { key: "category", header: "Category", sortable: true, sortValue: (r) => r.category, render: (r) => <Chip tone="blue">{CATEGORY_LABELS[r.category] ?? r.category}</Chip> },
    { key: "metric", header: "Metric", render: (r) => <div><div className="text-[12px] font-semibold">{r.metricName}</div><div className="text-[11px] text-[color:var(--ink-faint)]">{fmtMetric(r.metricValue)} {r.metricUnit}</div></div> },
    { key: "project", header: "Project / BU", render: (r) => <span className="text-[12px] text-[color:var(--ink-soft)]">{r.projectName ?? "BU report"}</span> },
    { key: "submittedBy", header: "Submitted by", render: (r) => <span className="text-[12px] text-[color:var(--ink-soft)]">{r.submittedByName ?? "—"}</span> },
    { key: "dueDate", header: "Deadline", sortable: true, sortValue: (r) => r.dueDate, render: (r) => <div><div className="text-[12px]">{fmtDate(r.dueDate)}</div>{r.overdue && r.status !== "APPROVED" && <Chip tone="red">overdue</Chip>}</div> },
    { key: "submittedAt", header: "Submitted on", sortable: true, sortValue: (r) => r.submittedAt ?? "", render: (r) => <span className="text-[12px] text-[color:var(--ink-soft)]">{r.submittedAt ? fmtDate(r.submittedAt) : "—"}</span> },
    { key: "status", header: "Workflow", sortable: true, sortValue: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
  ], []);

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="Report Monitoring"
        description={`${reportingYear} · Operational monitoring of BU reports. Approve / Reject / Return-for-Correction decisions belong to the BU Manager — outcomes below are read-only.`}
        icon={Radar}
        actions={
          <span className="glass-subtle inline-flex items-center gap-1.5 rounded-2xl px-3 py-2 text-[13px] font-medium text-[color:var(--ink-soft)]">
            <ShieldAlert className="h-4 w-4 text-[#c57926]" aria-hidden="true" /> Read-only monitoring
          </span>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {KPI_KEYS.map((k) => (
          <button
            key={k.key}
            onClick={() => setTab(k.key)}
            className="glass-ba glass-sheen group relative flex flex-col gap-3 overflow-hidden rounded-[24px] p-4 text-left transition-all hover:-translate-y-0.5"
            aria-pressed={tab === k.key}
          >
            <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: `linear-gradient(90deg, ${k.hue}, ${k.hue}22)` }} />
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl text-white" style={{ background: `linear-gradient(135deg, ${k.hue}, color-mix(in srgb, ${k.hue} 62%, #17263d))` }}>
                <k.icon className="h-[18px] w-[18px] text-white" />
              </span>
              <span className="text-[26px] font-bold tabular text-[color:var(--ink)]"><CountUp value={counts?.[k.serverKey] ?? 0} /></span>
            </div>
            <div><div className="truncate text-[13px] font-semibold" style={{ color: k.hue }}>{k.label}</div><div className="truncate text-[11px] text-[color:var(--ink-faint)]">{k.hint}</div></div>
          </button>
        ))}
      </div>

      <GlassTabBar
        tabs={(Object.keys(STATUS_TAB_LABELS) as StatusKey[]).map((t) => ({ value: t, label: STATUS_TAB_LABELS[t], count: t === "returned" ? counts?.rejected ?? 0 : t === "all" ? counts?.all : counts?.[t] ?? 0 }))}
        value={tab}
        onChange={(v) => setTab(v as StatusKey)}
      />

      <Toolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search ref, title or metric…"
        filters={[
          { key: "category", label: "Category", options: [{ value: "ALL", label: "All categories" }, ...Object.entries(CATEGORY_LABELS).map(([k, v]) => ({ value: k, label: v }))], value: category, onChange: setCategory },
        ]}
        onReset={() => { setSearch(""); setCategory("ALL"); }}
        resultCount={data?.total ?? 0}
      />

      <DataTable<SubmissionRow>
        columns={columns}
        rows={rows}
        loading={loading && !data}
        error={error && !data ? error : null}
        onRetry={refetch}
        pageSize={10}
        onRowClick={(r) => setDetailId(r.id)}
        emptyTitle={rows.length === 0 ? `No ${STATUS_TAB_LABELS[tab].toLowerCase()}` : "No matches"}
        emptyMessage={rows.length === 0 ? `There are no ${STATUS_TAB_LABELS[tab].toLowerCase()} for ${reportingYear}.` : "Try adjusting the filters."}
        mobileCard={(r) => (
          <div className="flex flex-col gap-2 p-3">
            <div className="flex items-start justify-between"><div><div className="text-[13px] font-semibold">{r.ref}</div><div className="truncate text-[11px] text-[color:var(--ink-faint)]">{r.title}</div></div><StatusBadge status={r.status} /></div>
            <Chip tone="blue">{CATEGORY_LABELS[r.category] ?? r.category}</Chip>
            <div className="text-[11px] text-[color:var(--ink-faint)]">Due {fmtDate(r.dueDate)} · submitted by {r.submittedByName ?? "—"}</div>
          </div>
        )}
      />

      <GlassDialog
        open={!!detailId}
        onOpenChange={(o) => { if (!o) setDetailId(null); }}
        title="Report detail"
        description="Read-only monitoring — review decisions belong to the BU Manager"
        wide
      >
        <MonitoringDetail id={detailId} />
      </GlassDialog>
    </div>
  );
}

function MonitoringDetail({ id }: { id: string | null }) {
  const { data, loading, error, refetch } = useBaApi<{ submission: SubmissionDetail }>(id ? `/api/ba/submissions/${id}` : null);
  if (!id) return null;
  if (loading && !data) return <LoadingBlock rows={5} label="Loading report detail…" />;
  if (error && !data) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return <EmptyState title="Report not found" />;
  const s = data.submission;
  return (
    <div className="space-y-4">
      <div className="glass-subtle rounded-2xl p-3.5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={s.status} />
          {s.overdue && s.status !== "APPROVED" && <Chip tone="red">overdue</Chip>}
          <Chip tone={s.level === "PROJECT" ? "purple" : "blue"}>{s.level === "PROJECT" ? "Project report" : "BU report"}</Chip>
        </div>
        <div className="text-[14px] font-semibold text-[color:var(--ink)]">{s.ref} — {s.title}</div>
        <div className="mt-1 text-[12px] text-[color:var(--ink-faint)]">{CATEGORY_LABELS[s.category] ?? s.category} · {s.metricName} · {fmtMetric(s.metricValue)} {s.metricUnit}</div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-[12px]">
        <InfoRow label="Organization"><span className="text-[color:var(--ink)]">{s.projectName ?? "BU report"}</span></InfoRow>
        <InfoRow label="Period"><span className="text-[color:var(--ink)]">{s.period} · {s.fiscalQuarter}</span></InfoRow>
        <InfoRow label="Submitted by"><span className="text-[color:var(--ink)]">{s.submittedByName ?? "—"}</span></InfoRow>
        <InfoRow label="Submitted at"><span className="text-[color:var(--ink)]">{s.submittedAt ? fmtDateTime(s.submittedAt) : "—"}</span></InfoRow>
        <InfoRow label="Due date"><span className="text-[color:var(--ink)]">{fmtDate(s.dueDate)}</span></InfoRow>
        <InfoRow label="Reviewer"><span className="text-[color:var(--ink)]">{s.reviewerName ?? "—"}</span></InfoRow>
      </div>
      <div className="rounded-2xl bg-[rgba(197,121,38,0.08)] p-3 text-[12px] text-[color:var(--ink-soft)]">
        <div className="flex items-center gap-2 text-[12px] font-semibold text-[#9c5d1b]"><ShieldAlert className="h-4 w-4" /> Review authority</div>
        <p className="mt-1">Approval, rejection or return-for-correction belongs to the BU Manager. To coordinate a correction, use the Communication Center to notify the responsible user.</p>
        <Button variant="outline" size="sm" className="mt-2 rounded-2xl" onClick={() => useBaWorkspace.getState().navigate("comms", { compose: Date.now(), subject: `Correction request — ${s.ref}` })}>
          Open comms <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      </div>
      <div>
        <div className="mb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]"><FileText className="h-3.5 w-3.5" /> Evidence ({s.evidenceCount})</div>
        {s.evidence.length === 0 ? <EmptyState title="No evidence attached" /> : (
          <div className="flex flex-wrap gap-2">{s.evidence.map((e, i) => <Chip key={i} tone="blue">{e}</Chip>)}</div>
        )}
      </div>
      <div>
        <div className="mb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]"><PulseIcon className="h-3.5 w-3.5" /> History</div>
        {(s.history ?? []).length === 0 ? <EmptyState title="No history yet" /> : (
          <div className="space-y-1.5">
            {s.history.slice(0, 6).map((h, i) => (
              <div key={i} className="rounded-xl bg-white/50 px-2.5 py-1.5 text-[12px]">
                <span className="font-semibold text-[color:var(--ink)]">{h.actor}</span> <span className="text-[color:var(--ink-faint)]">{h.action.replace(/_/g, " ").toLowerCase()}</span>
                {h.note && <span className="text-[color:var(--ink-soft)]"> — {h.note}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

void FilesIcon;
