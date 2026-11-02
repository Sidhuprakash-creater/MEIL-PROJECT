"use client";

// ── BU MANAGER · SCREEN 11 — Activity & History ──
import { useMemo, useState } from "react";
import { Lock, Activity as PulseLucide } from "lucide-react";
import { PulseIcon, FileCheckIcon } from "@/components/workspace/premium-icons";
import { useBmWorkspace } from "@/lib/bm/store";
import { fmtDateTime, timeAgo, useBmApi } from "@/lib/bm/client";
import type { ActivityRow, AuditRow } from "@/lib/bm/types";
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
  EVIDENCE_DOWNLOAD: "downloaded evidence",
  TASK_ASSIGN: "assigned task",
  APPROVE: "approved report",
  REJECT: "rejected report",
  RETURN: "returned report for correction",
  ROLE_CHANGE: "changed a role",
  ACCOUNT_UPDATE: "updated an account",
  EXPORT: "exported data",
  CONFIG_CHANGE: "changed configuration",
  BU_CREATE: "created business unit",
  VALIDATION_ASSIGN: "assigned validation issue",
  VALIDATION_RESOLVE: "resolved validation issue",
};

function humanizeAction(action: string): string {
  return ACTION_VERBS[action.toUpperCase()] ?? action.toLowerCase().replace(/_/g, " ");
}

type FeedResponse = { rows: ActivityRow[] } | { rows: AuditRow[] };

export default function ActivityView() {
  const { params } = useBmWorkspace();
  const [tab, setTab] = useState<"activity" | "audit">(params.tab === "audit" ? "audit" : "activity");
  const [days, setDays] = useState("30");
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [userFilter, setUserFilter] = useState("ALL");
  const [outcomeFilter, setOutcomeFilter] = useState("ALL");

  const { data, loading, error, refetch } = useBmApi<FeedResponse>(
    `/api/bm/${tab === "audit" ? "audit" : "activity"}?days=${days}`
  );

  const rows = useMemo(() => {
    const list = (data?.rows ?? []) as (ActivityRow & AuditRow)[];
    let out = list;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter((e) => `${e.actorName} ${e.action} ${e.targetLabel ?? ""} ${"reason" in e ? e.reason : ""}`.toLowerCase().includes(q));
    }
    if (actionFilter !== "ALL") out = out.filter((e) => e.action === actionFilter);
    if (userFilter !== "ALL") out = out.filter((e) => e.actorName === userFilter);
    if (tab === "audit" && outcomeFilter !== "ALL") out = out.filter((e) => "outcome" in e && e.outcome === outcomeFilter);
    return out;
  }, [data, search, actionFilter, userFilter, outcomeFilter, tab]);

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
    { key: "org", header: "Scope", render: (e) => <Chip tone="purple">{e.orgLabel}</Chip> },
    {
      key: "severity", header: "Severity", render: (e) => (
        <Chip tone={e.severity === "CRITICAL" ? "red" : e.severity === "WARNING" ? "amber" : e.severity === "SUCCESS" ? "green" : "purple"}>{e.severity}</Chip>
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
    {
      key: "action", header: "Action", render: (e) => (
        <code className="text-[11.5px] font-medium text-[color:var(--bum-purple-deep)]">{e.action}</code>
      ),
    },
    {
      key: "target", header: "Target", className: "max-w-[300px]",
      render: (e) => (
        <div className="min-w-0">
          <div className="truncate text-[12.5px] font-medium text-[color:var(--ink)]">{e.targetLabel || "—"}</div>
          <div className="truncate text-[10.5px] text-[color:var(--ink-faint)]">scope: {e.orgScope}</div>
        </div>
      ),
    },
    { key: "org", header: "Scope", render: (e) => <Chip tone="purple">{e.orgScope}</Chip> },
    {
      key: "outcome", header: "Outcome", render: (e) => (
        <Chip tone={e.outcome === "SUCCESS" ? "green" : e.outcome === "FAILURE" ? "red" : "amber"}>{e.outcome}</Chip>
      ),
    },
    {
      key: "reason", header: "Reason", className: "max-w-[260px]",
      render: (e) => e.reason ? <p className="line-clamp-2 text-[11.5px] leading-relaxed text-[color:var(--ink-soft)]">{e.reason}</p> : <span className="text-[11px] text-[color:var(--ink-faint)]">—</span>,
    },
    { key: "at", header: "When", sortable: true, sortValue: (e) => e.createdAt, render: (e) => <span className="text-[12px]">{timeAgo(e.createdAt)} · {fmtDateTime(e.createdAt)}</span> },
  ];

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="Activity & History"
        description="Reporting activity feed and authoritative review audit trail. Report submission history, review started, comments added, report returned/rejected/approved, evidence changes and validation events — actor, action, version, timestamp and reason where available."
        icon={PulseLucide}
      />

      <GlassTabBar
        value={tab}
        onChange={(v) => setTab(v as "activity" | "audit")}
        tabs={[
          { value: "activity", label: "Activity feed", icon: PulseIcon },
          { value: "audit", label: "Audit trail", icon: FileCheckIcon },
        ]}
      />

      {/* Filter toolbar */}
      <div className="glass-bum glass-sheen flex flex-wrap items-center gap-2 rounded-2xl p-2.5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search actor, action, target…"
          className="glass-subtle h-9 min-w-[200px] flex-1 rounded-xl border border-white/60 px-3 text-[13px] text-[color:var(--ink)] placeholder:text-[color:var(--ink-faint)] focus:outline-none focus:ring-2 focus:ring-[rgba(139,92,246,0.4)]"
        />
        <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="glass-subtle h-9 rounded-xl border border-white/60 px-2 text-[12.5px] text-[color:var(--ink)] focus:outline-none focus:ring-2 focus:ring-[rgba(139,92,246,0.4)]">
          {actionOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)} className="glass-subtle h-9 rounded-xl border border-white/60 px-2 text-[12.5px] text-[color:var(--ink)] focus:outline-none focus:ring-2 focus:ring-[rgba(139,92,246,0.4)]">
          {userOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {tab === "audit" && (
          <select value={outcomeFilter} onChange={(e) => setOutcomeFilter(e.target.value)} className="glass-subtle h-9 rounded-xl border border-white/60 px-2 text-[12.5px] text-[color:var(--ink)] focus:outline-none focus:ring-2 focus:ring-[rgba(139,92,246,0.4)]">
            <option value="ALL">All outcomes</option>
            <option value="SUCCESS">Success</option>
            <option value="FAILURE">Failure</option>
            <option value="DENIED">Denied</option>
          </select>
        )}
        <select value={days} onChange={(e) => setDays(e.target.value)} className="glass-subtle h-9 rounded-xl border border-white/60 px-2 text-[12.5px] text-[color:var(--ink)] focus:outline-none focus:ring-2 focus:ring-[rgba(139,92,246,0.4)]">
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="365">Last year</option>
        </select>
        <Chip tone="purple">{rows.length} results</Chip>
        <ExportButton filename={`bm-${tab}`} rows={rows.map((r) => ({ actor: r.actorName, role: r.actorRole, action: r.action, target: r.targetLabel, scope: "orgLabel" in r ? r.orgLabel : (r as AuditRow).orgScope, reason: "reason" in r ? r.reason : "", outcome: "outcome" in r ? r.outcome : "", at: r.createdAt }))} />
      </div>

      {loading && !data && <LoadingBlock rows={6} label={`Loading ${tab === "audit" ? "audit trail" : "activity feed"}…`} />}
      {error && !data && <ErrorState message={error} onRetry={refetch} />}

      {data && tab === "activity" && (
        <DataTable
          columns={activityColumns as Column<ActivityRow & AuditRow>[]}
          rows={rows as (ActivityRow & AuditRow)[]}
          pageSize={12}
          emptyTitle="No activity recorded"
          emptyMessage="Reporting activity across your BU will appear here."
        />
      )}

      {data && tab === "audit" && (
        <>
          <div className="flex items-center gap-2 rounded-2xl bg-[rgba(139,92,246,0.06)] p-3 text-[11.5px] font-medium text-[color:var(--bum-purple-deep)]">
            <Lock className="h-3.5 w-3.5" />
            Append-only audit trail — every review decision, evidence download and validation annotation is recorded permanently. Earlier versions and decisions are inspectable without overwriting the audit history.
          </div>
          <DataTable
            columns={auditColumns as Column<ActivityRow & AuditRow>[]}
            rows={rows as (ActivityRow & AuditRow)[]}
            pageSize={12}
            emptyTitle="No audit events"
            emptyMessage="Decisions you record will appear here permanently."
          />
        </>
      )}

      {data && rows.length === 0 && (
        <GlassCard className="glass-bum p-6">
          <EmptyState title="No events yet" message={tab === "audit" ? "Decisions you record will appear here permanently." : "Reporting activity across your BU will appear here."} icon={tab === "audit" ? FileCheckIcon : PulseIcon} />
        </GlassCard>
      )}

      <p className="text-[11.5px] text-[color:var(--ink-faint)]">
        Activity is scoped to {`your assigned business unit`}. Audit rows are append-only and never redacted — the BU Manager can inspect earlier versions and decisions without overwriting the trail.
      </p>
    </div>
  );
}
