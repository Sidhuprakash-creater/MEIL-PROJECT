"use client";

// ── SCREEN 17 — Audit Logs (authoritative, append-only trail) ──
import * as React from "react";
import { FileCheck2, Info, Lock, ShieldCheck } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useApi, fmtDateTime } from "@/lib/esg/client";
import { ROLE_LABELS, type AuditEvent } from "@/lib/esg/types";
import {
  Avatar,
  Chip,
  DataTable,
  EmptyState,
  ErrorState,
  ExportButton,
  GlassCard,
  GlassDialog,
  LoadingBlock,
  PageHeader,
  SectionCard,
  StatusBadge,
  Toolbar,
  type Column,
} from "../ui";

interface AuditRow extends AuditEvent {
  id: string;
}

const dedup = (vals: string[]) => Array.from(new Set(vals.filter(Boolean))).sort((a, b) => a.localeCompare(b));

function safeParse(s: string): Record<string, unknown> | null {
  if (!s || !s.trim()) return null;
  try {
    const v: unknown = JSON.parse(s);
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
    return { value: v };
  } catch {
    return null;
  }
}

function fmtVal(v: unknown): string {
  if (v === undefined) return "—";
  if (v === null) return "null";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function shortVal(v: string, max = 18): string {
  return v.length > max ? `${v.slice(0, max)}…` : v;
}

function prettyJson(s: string): string {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}

interface DiffEntry {
  key: string;
  from: string;
  to: string;
}

function computeDiff(before: string, after: string): DiffEntry[] {
  const b = safeParse(before);
  const a = safeParse(after);
  if (!b && !a) return [];
  const keys = Array.from(new Set([...Object.keys(b ?? {}), ...Object.keys(a ?? {})]));
  return keys
    .filter((k) => fmtVal((b ?? {})[k]) !== fmtVal((a ?? {})[k]))
    .map((k) => ({ key: k, from: fmtVal((b ?? {})[k]), to: fmtVal((a ?? {})[k]) }));
}

function DiffChips({ before, after }: { before: string; after: string }) {
  const diff = React.useMemo(() => computeDiff(before, after), [before, after]);
  if (!diff.length) return <span className="text-xs text-[color:var(--ink-faint)]">—</span>;
  return (
    <div className="flex max-w-[240px] flex-wrap gap-1">
      {diff.slice(0, 3).map((d) => (
        <Chip key={d.key} tone="purple" className="max-w-full">
          <span className="truncate font-normal">
            <span className="font-medium">{d.key}:</span> {shortVal(d.from)} → {shortVal(d.to)}
          </span>
        </Chip>
      ))}
      {diff.length > 3 && <Chip tone="gray">+{diff.length - 3} more</Chip>}
    </div>
  );
}

export default function AuditView() {
  const { data, loading, error, refetch } = useApi<{ events: AuditEvent[]; integrity: { appendOnly: boolean; note: string; records: number } }>("/api/esg/audit");
  const [search, setSearch] = React.useState("");
  const [action, setAction] = React.useState("ALL");
  const [outcome, setOutcome] = React.useState("ALL");
  const [role, setRole] = React.useState("ALL");
  const [selected, setSelected] = React.useState<AuditRow | null>(null);

  const events: AuditRow[] = React.useMemo(() => (data?.events ?? []).map((e) => ({ ...e, id: e.id })), [data]);
  const actionOptions = React.useMemo(() => dedup(events.map((e) => e.action)), [events]);
  const roleOptions = React.useMemo(() => dedup(events.map((e) => e.actorRole)), [events]);
  const outcomeOptions = React.useMemo(() => dedup(events.map((e) => e.outcome || "SUCCESS")), [events]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      if (q && !`${e.actorName} ${e.targetLabel} ${e.action} ${e.correlation}`.toLowerCase().includes(q)) return false;
      if (action !== "ALL" && e.action !== action) return false;
      if (outcome !== "ALL" && (e.outcome || "SUCCESS") !== outcome) return false;
      if (role !== "ALL" && e.actorRole !== role) return false;
      return true;
    });
  }, [events, search, action, outcome, role]);

  const exportRows = React.useMemo(
    () =>
      filtered.map((e) => ({
        timestamp: e.createdAt,
        actor: e.actorName,
        role: ROLE_LABELS[e.actorRole] ?? e.actorRole,
        action: e.action,
        target: `${e.targetType}:${e.targetId}`,
        targetLabel: e.targetLabel,
        organization: e.orgScope,
        before: e.before || "",
        after: e.after || "",
        reason: e.reason || "",
        outcome: e.outcome || "SUCCESS",
        correlation: e.correlation,
      })),
    [filtered]
  );

  const columns: Column<AuditRow>[] = [
    { key: "ts", header: "Timestamp", sortable: true, sortValue: (e) => e.createdAt, render: (e) => <span className="whitespace-nowrap text-xs text-[color:var(--ink-soft)]">{fmtDateTime(e.createdAt)}</span> },
    {
      key: "actor",
      header: "Actor",
      render: (e) => (
        <div className="flex items-center gap-2">
          <Avatar name={e.actorName} size={28} />
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium text-[color:var(--ink)]">{e.actorName}</div>
            <div className="truncate text-[11px] text-[color:var(--ink-faint)]">{ROLE_LABELS[e.actorRole] ?? e.actorRole}</div>
          </div>
        </div>
      ),
    },
    { key: "action", header: "Action", render: (e) => <span className="rounded-lg bg-black/5 px-2 py-0.5 font-mono text-[11px] font-medium text-[color:var(--ink-soft)]">{e.action}</span> },
    {
      key: "target",
      header: "Target",
      render: (e) => (
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wide text-[color:var(--ink-faint)]">{e.targetType}</div>
          <div className="max-w-[200px] truncate text-[13px] font-medium text-[color:var(--ink)]">{e.targetLabel}</div>
        </div>
      ),
    },
    { key: "org", header: "Organization", render: (e) => <Chip tone="gray">{e.orgScope || "—"}</Chip> },
    { key: "diff", header: "Before → After", render: (e) => <DiffChips before={e.before} after={e.after} /> },
    {
      key: "reason",
      header: "Reason",
      render: (e) =>
        e.reason ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="block max-w-[160px] cursor-default truncate text-xs text-[color:var(--ink-soft)]">{e.reason}</span>
            </TooltipTrigger>
            <TooltipContent className="max-w-64 rounded-xl border-white/70 bg-white/95 text-[color:var(--ink)] shadow-lg backdrop-blur">
              <span className="text-xs">{e.reason}</span>
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-xs text-[color:var(--ink-faint)]">—</span>
        ),
    },
    { key: "outcome", header: "Outcome", render: (e) => <StatusBadge status={e.outcome || "SUCCESS"} /> },
    { key: "corr", header: "Correlation", render: (e) => <span className="font-mono text-[10px] text-[color:var(--ink-faint)]">{e.correlation || "—"}</span> },
  ];

  return (
    <div className="view-in space-y-5">
      <PageHeader
        title="Audit Logs"
        description="Authoritative, append-only audit trail of every sensitive operation — the system of record for compliance."
        icon={FileCheck2}
        breadcrumbs={["Group", "Insights & Governance", "Audit Logs"]}
        actions={
          <>
            <ExportButton filename="audit-trail" rows={exportRows} />
            <Chip tone="green" className="h-9 px-3">
              <Lock className="h-3 w-3" /> Append-only · {data?.integrity.records ?? events.length} records
            </Chip>
          </>
        }
      />

      {/* Integrity banner */}
      <GlassCard className="flex flex-col gap-2 border-[rgba(35,134,83,0.3)] p-4 sm:flex-row sm:items-center sm:gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[rgba(35,134,83,0.12)]">
          <ShieldCheck className="h-5 w-5 text-[#238653]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-[color:var(--ink)]">Append-only integrity</div>
          <p className="text-xs leading-relaxed text-[color:var(--ink-soft)]">
            {data?.integrity.note ?? "Audit records are append-only."} Audit records cannot be edited or deleted through the application.
          </p>
        </div>
        <StatusBadge status="FINALIZED" />
      </GlassCard>

      <Toolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search actor, target, or correlation…"
        filters={[
          {
            key: "action",
            label: "Action",
            value: action,
            onChange: setAction,
            options: [{ value: "ALL", label: "All actions" }, ...actionOptions.map((a) => ({ value: a, label: a }))],
          },
          {
            key: "outcome",
            label: "Outcome",
            value: outcome,
            onChange: setOutcome,
            options: [{ value: "ALL", label: "All outcomes" }, ...outcomeOptions.map((o) => ({ value: o, label: o }))],
          },
          {
            key: "role",
            label: "Actor role",
            value: role,
            onChange: setRole,
            options: [{ value: "ALL", label: "All roles" }, ...roleOptions.map((r) => ({ value: r, label: ROLE_LABELS[r] ?? r }))],
          },
        ]}
        onReset={() => {
          setSearch("");
          setAction("ALL");
          setOutcome("ALL");
          setRole("ALL");
        }}
        resultCount={filtered.length}
      />

      <DataTable
        columns={columns}
        rows={filtered}
        loading={loading}
        error={error}
        onRetry={() => refetch()}
        pageSize={10}
        onRowClick={(e) => setSelected(e)}
        emptyTitle="No audit records match"
        emptyMessage={events.length ? "Adjust the filters to see more of the trail." : "The audit trail is empty."}
      />

      <SectionCard title="Operational activity vs. authoritative audit" description="Why this screen exists separately from Activity Monitoring." icon={Info} subtle>
        <div className="grid grid-cols-1 gap-3 text-[13px] leading-relaxed sm:grid-cols-2">
          <div className="glass-subtle rounded-2xl p-3.5">
            <div className="mb-1 font-semibold text-[color:var(--ink)]">Activity Monitoring (Screen 16)</div>
            <p className="text-[color:var(--ink-soft)]">
              A human-friendly, chronological feed of what users are doing. Observational, filterable, and intended for day-to-day awareness — it is not tamper-evident.
            </p>
          </div>
          <div className="glass-subtle rounded-2xl p-3.5">
            <div className="mb-1 font-semibold text-[color:var(--ink)]">Audit Logs (this screen)</div>
            <p className="text-[color:var(--ink-soft)]">
              The authoritative record of sensitive operations with before/after state, reason, outcome, and correlation id. Append-only: updates and deletes are rejected at the application layer.
            </p>
          </div>
        </div>
      </SectionCard>

      <GlassDialog
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        title={selected ? `${selected.action} — ${selected.targetLabel}` : "Audit record"}
        description={selected ? `Correlation ${selected.correlation || "—"} · ${fmtDateTime(selected.createdAt)}` : undefined}
        wide
      >
        {selected && (
          <div className="flex flex-col gap-3">
            <div className="glass-subtle rounded-2xl p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Avatar name={selected.actorName} size={36} />
                <div>
                  <div className="text-sm font-semibold text-[color:var(--ink)]">{selected.actorName}</div>
                  <div className="text-xs text-[color:var(--ink-faint)]">{ROLE_LABELS[selected.actorRole] ?? selected.actorRole}</div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <StatusBadge status={selected.outcome || "SUCCESS"} />
                  <Chip tone="gray">{selected.orgScope || "GROUP"}</Chip>
                </div>
              </div>
              {selected.reason && (
                <p className="mt-3 rounded-xl bg-white/60 p-3 text-[13px] italic text-[color:var(--ink-soft)]">Reason: “{selected.reason}”</p>
              )}
            </div>
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--ink-faint)]">Before</div>
              <pre className="nice-scroll glass-subtle max-h-44 overflow-auto rounded-2xl p-3 font-mono text-[11px] leading-relaxed text-[color:var(--ink-soft)]">
                {selected.before ? prettyJson(selected.before) : "(creation — no prior state)"}
              </pre>
            </div>
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--ink-faint)]">After</div>
              <pre className="nice-scroll glass-subtle max-h-44 overflow-auto rounded-2xl p-3 font-mono text-[11px] leading-relaxed text-[color:var(--ink-soft)]">
                {selected.after ? prettyJson(selected.after) : "(no resulting state recorded)"}
              </pre>
            </div>
            <p className="text-xs text-[color:var(--ink-faint)]">
              Target: {selected.targetType} · {selected.targetId}
            </p>
          </div>
        )}
      </GlassDialog>
    </div>
  );
}
