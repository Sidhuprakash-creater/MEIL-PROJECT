"use client";

// ── SUBSIDIARY MANAGER · SCREEN 10 — Activity & History ──
import { useMemo, useState } from "react";
import { Lock, Activity as PulseLucide } from "lucide-react";
import { PulseIcon, FileCheckIcon } from "@/components/workspace/premium-icons";
import { useSmWorkspace } from "@/lib/sm/store";
import { fmtDateTime, timeAgo, useSmApi } from "@/lib/sm/client";
import type { ActivityRow, AuditRow } from "@/lib/sm/types";
import {
  Chip, DataTable, EmptyState, ErrorState, ExportButton, GlassCard, GlassTabBar, LoadingBlock, PageHeader, type Column,
} from "@/components/workspace/ui";

const ACTION_VERBS: Record<string, string> = {
  LOGIN: "signed in",
  REPORT_CREATE: "created report",
  SUBMIT: "submitted report",
  RESUBMIT: "resubmitted report",
  DATA_EDIT: "edited data",
  EVIDENCE_UPLOAD: "uploaded evidence",
  TASK_ASSIGN: "assigned task",
  APPROVE: "approved report",
  REJECT: "rejected report",
  ROLE_CHANGE: "changed a role",
  ACCOUNT_UPDATE: "updated an account",
  EXPORT: "exported data",
  CONFIG_CHANGE: "changed configuration",
  BU_CREATE: "created business unit",
};

function humanizeAction(action: string): string {
  return ACTION_VERBS[action.toUpperCase()] ?? action.toLowerCase().replace(/_/g, " ");
}

type FeedResponse = { rows: ActivityRow[] } | { rows: AuditRow[] };

export default function ActivityView() {
  const { params } = useSmWorkspace();
  /* Deep link ?tab=audit|activity is consumed once via the initializer. */
  const [tab, setTab] = useState(params.tab === "audit" ? "audit" : "activity");
  const [days, setDays] = useState("30");
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [userFilter, setUserFilter] = useState("ALL");
  const [outcomeFilter, setOutcomeFilter] = useState("ALL");

  const trail = tab === "audit" ? "audit" : "activity";
  const { data, loading, error, refetch } = useSmApi<FeedResponse>(
    `/api/sm/activity?trail=${trail}&days=${days}`
  );

  const rows = useMemo(() => {
    const list = (data?.rows ?? []) as (ActivityRow & AuditRow)[];
    let out = list;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter((e) => `${e.actorName} ${e.action} ${e.targetLabel ?? ""}`.toLowerCase().includes(q));
    }
    if (actionFilter !== "ALL") out = out.filter((e) => e.action === actionFilter);
    if (userFilter !== "ALL") out = out.filter((e) => e.actorName === userFilter);
    if (trail === "audit" && outcomeFilter !== "ALL") out = out.filter((e) => ("outcome" in e ? e.outcome === outcomeFilter : true));
    return out;
  }, [data, search, actionFilter, userFilter, outcomeFilter, trail]);

  const actionOptions = useMemo(() => {
    const set = new Set((data?.rows ?? []).map((e) => e.action));
    return [{ value: "ALL", label: "All actions" }, ...[...set].map((a) => ({ value: a, label: humanizeAction(a) }))];
  }, [data]);

  const userOptions = useMemo(() => {
    const set = new Set((data?.rows ?? []).map((e) => e.actorName));
    return [{ value: "ALL", label: "All actors" }, ...[...set].map((u) => ({ value: u, label: u }))];
  }, [data]);

  const activityColumns: Column<ActivityRow>[] = [
    {
      key: "actor", header: "Actor", render: (e) => (
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-[color:var(--ink)]">{e.actorName}</div>
          <div className="truncate text-[10.5px] text-[color:var(--ink-faint)]">{e.actorRole.replace(/_/g, " ").toLowerCase()}</div>
        </div>
      ),
    },
    {
      key: "action", header: "Action", render: (e) => (
        <span className="text-[12.5px] text-[color:var(--ink-soft)]">{humanizeAction(e.action)}</span>
      ),
    },
    {
      key: "target", header: "Target", className: "max-w-[300px]",
      render: (e) => <span className="line-clamp-1 text-[12.5px] font-medium text-[color:var(--ink)]">{e.targetLabel || "—"}</span>,
    },
    { key: "org", header: "Scope", render: (e) => <Chip tone="gray">{e.orgLabel}</Chip> },
    {
      key: "severity", header: "Severity", render: (e) => (
        <Chip tone={e.severity === "CRITICAL" ? "red" : e.severity === "WARNING" ? "amber" : e.severity === "SUCCESS" ? "green" : "blue"}>{e.severity}</Chip>
      ),
    },
    { key: "at", header: "When", sortable: true, sortValue: (e) => e.createdAt, render: (e) => <span className="text-[12px]">{timeAgo(e.createdAt)} · {fmtDateTime(e.createdAt)}</span> },
  ];

  const auditColumns: Column<AuditRow>[] = [
    {
      key: "actor", header: "Actor", render: (e) => (
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-[color:var(--ink)]">{e.actorName}</div>
          <div className="truncate text-[10.5px] text-[color:var(--ink-faint)]">{e.actorRole.replace(/_/g, " ").toLowerCase()}</div>
        </div>
      ),
    },
    { key: "action", header: "Event", render: (e) => <span className="rounded-lg bg-black/5 px-2 py-1 font-mono text-[11px] font-semibold text-[color:var(--ink)]">{e.action}</span> },
    { key: "target", header: "Target", className: "max-w-[260px]", render: (e) => <span className="line-clamp-1 text-[12.5px] font-medium text-[color:var(--ink)]">{e.targetLabel || "—"}</span> },
    { key: "scope", header: "Scope", render: (e) => <Chip tone="gray">{e.orgScope}</Chip> },
    {
      key: "outcome", header: "Outcome", render: (e) => (
        <Chip tone={e.outcome === "SUCCESS" ? "green" : e.outcome === "FAILURE" ? "red" : "amber"}>{e.outcome}</Chip>
      ),
    },
    {
      key: "reason", header: "Reason", className: "max-w-[220px]",
      render: (e) => e.reason ? <span className="line-clamp-2 text-[12px] text-[#9c5d1b]">{e.reason}</span> : <span className="text-[12px] text-[color:var(--ink-faint)]">—</span>,
    },
    { key: "at", header: "When", sortable: true, sortValue: (e) => e.createdAt, render: (e) => <span className="text-[12px]">{timeAgo(e.createdAt)} · {fmtDateTime(e.createdAt)}</span> },
  ];

  const exportRows = rows.map((e) => ({
    trail, actor: e.actorName, role: e.actorRole, action: e.action,
    target: e.targetLabel ?? "", scope: e.orgLabel ?? e.orgScope ?? "",
    outcome: (e as AuditRow).outcome ?? (e as ActivityRow).severity, reason: (e as AuditRow).reason ?? "", at: e.createdAt,
  }));

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="Activity & History"
        description="Operational reporting activity and the authoritative record of review decisions — approvals, rejections with reasons, resubmissions and status transitions."
        icon={PulseLucide}
        actions={<ExportButton filename={`manager-${trail}-trail`} rows={exportRows} />}
      />

      <GlassTabBar
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "activity", label: "Activity feed", icon: PulseIcon },
          { value: "audit", label: "Decision audit trail", icon: FileCheckIcon },
        ]}
      />

      {tab === "audit" && (
        <GlassCard className="flex items-center gap-2.5 p-3.5">
          <Lock className="h-4 w-4 shrink-0 text-[#1d6b44]" />
          <p className="text-[12px] leading-relaxed text-[color:var(--ink-soft)]">
            <strong className="font-semibold">Append-only audit trail.</strong> Review decisions are recorded once with actor, timestamp, version and reason — they cannot be edited or deleted from any console.
          </p>
        </GlassCard>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search actor, action or target…"
          aria-label="Search trail"
          className="glass-subtle h-10 min-w-[200px] flex-1 rounded-2xl border-white/60 px-4 text-sm outline-none placeholder:text-[color:var(--ink-faint)] focus:ring-2 focus:ring-[color:var(--ring)] sm:max-w-xs"
        />
        <select aria-label="Filter by action" className="glass-subtle h-10 rounded-2xl border-white/60 px-3 text-sm" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
          {actionOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select aria-label="Filter by actor" className="glass-subtle h-10 rounded-2xl border-white/60 px-3 text-sm" value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
          {userOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {tab === "audit" && (
          <select aria-label="Filter by outcome" className="glass-subtle h-10 rounded-2xl border-white/60 px-3 text-sm" value={outcomeFilter} onChange={(e) => setOutcomeFilter(e.target.value)}>
            <option value="ALL">All outcomes</option>
            <option value="SUCCESS">Success</option>
            <option value="FAILURE">Failure</option>
          </select>
        )}
        <select aria-label="Filter by date range" className="glass-subtle h-10 rounded-2xl border-white/60 px-3 text-sm" value={days} onChange={(e) => setDays(e.target.value)}>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="365">Last year</option>
        </select>
        <span className="ml-auto text-xs text-[color:var(--ink-faint)]" aria-live="polite">{rows.length} events</span>
      </div>

      {loading && !data && <LoadingBlock rows={6} label="Loading trail…" />}
      {error && !data && <ErrorState message={error} onRetry={refetch} />}
      {data && (
        <DataTable
          columns={tab === "audit" ? auditColumns : activityColumns}
          rows={rows}
          pageSize={10}
          emptyTitle="No events in this window"
          emptyMessage="Reporting and review activity will appear here as it happens."
          mobileCard={(e) => (
            <div className="glass-subtle rounded-2xl p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[12.5px] font-semibold">{e.actorName}</span>
                <span className="shrink-0 text-[10px] text-[color:var(--ink-faint)]">{timeAgo(e.createdAt)}</span>
              </div>
              <div className="mt-1 text-[12px] text-[color:var(--ink-soft)]">{humanizeAction(e.action)}{e.targetLabel ? ` — ${e.targetLabel}` : ""}</div>
              {(e as AuditRow).reason && <div className="mt-1 line-clamp-2 text-[11px] text-[#9c5d1b]">{(e as AuditRow).reason}</div>}
            </div>
          )}
        />
      )}
    </div>
  );
}
