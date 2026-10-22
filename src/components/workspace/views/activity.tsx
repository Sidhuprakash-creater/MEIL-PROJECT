"use client";

// ── SCREEN 16 — Activity Monitoring (chronological user activity feed) ──
import * as React from "react";
import { Activity, CalendarDays, Radio } from "lucide-react";
import { useApi, fmtDate, timeAgo } from "@/lib/esg/client";
import { useWorkspace } from "@/lib/esg/store";
import { ROLE_LABELS, type ActivityEvent } from "@/lib/esg/types";
import {
  Avatar,
  Chip,
  EmptyState,
  ErrorState,
  ExportButton,
  GlassCard,
  GlassDialog,
  InfoRow,
  LoadingBlock,
  PageHeader,
  StatusBadge,
  Toolbar,
} from "../ui";

const SEVERITY_DOT: Record<string, string> = {
  INFO: "#3a7bff",
  SUCCESS: "#238653",
  WARNING: "#c57926",
  CRITICAL: "#c34a4a",
  FAILURE: "#c34a4a",
};

const ACTION_TONES: Record<string, "green" | "blue" | "amber" | "red" | "gray" | "purple" | "teal"> = {
  LOGIN: "gray",
  SUBMIT: "blue",
  APPROVE: "green",
  REJECT: "red",
  TASK_ASSIGN: "purple",
  EXPORT: "teal",
  ROLE_CHANGE: "purple",
  CONFIG_CHANGE: "amber",
};

const dedup = (vals: string[]) => Array.from(new Set(vals.filter(Boolean))).sort((a, b) => a.localeCompare(b));

export default function ActivityView() {
  const { data, loading, error, refetch } = useApi<{ events: ActivityEvent[] }>("/api/esg/activity");
  const { navigate } = useWorkspace();
  const [search, setSearch] = React.useState("");
  const [role, setRole] = React.useState("ALL");
  const [action, setAction] = React.useState("ALL");
  const [org, setOrg] = React.useState("ALL");
  const [severity, setSeverity] = React.useState("ALL");
  const [selected, setSelected] = React.useState<ActivityEvent | null>(null);

  const events = React.useMemo(() => data?.events ?? [], [data]);
  const roleOptions = React.useMemo(() => dedup(events.map((e) => e.actorRole)), [events]);
  const actionOptions = React.useMemo(() => dedup(events.map((e) => e.action)), [events]);
  const orgOptions = React.useMemo(() => dedup(events.map((e) => e.orgLabel)), [events]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      if (q && !`${e.actorName} ${e.targetLabel} ${e.action}`.toLowerCase().includes(q)) return false;
      if (role !== "ALL" && e.actorRole !== role) return false;
      if (action !== "ALL" && e.action !== action) return false;
      if (org !== "ALL" && e.orgLabel !== org) return false;
      if (severity !== "ALL" && e.severity !== severity) return false;
      return true;
    });
  }, [events, search, role, action, org, severity]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, ActivityEvent[]>();
    for (const e of filtered) {
      const day = fmtDate(e.createdAt);
      const list = map.get(day) ?? [];
      list.push(e);
      map.set(day, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const exportRows = React.useMemo(
    () =>
      filtered.map((e) => ({
        at: e.createdAt,
        actor: e.actorName,
        role: ROLE_LABELS[e.actorRole] ?? e.actorRole,
        action: e.action,
        target: `${e.targetType}: ${e.targetLabel}`,
        organization: e.orgLabel,
        severity: e.severity,
      })),
    [filtered]
  );

  const reset = () => {
    setSearch("");
    setRole("ALL");
    setAction("ALL");
    setOrg("ALL");
    setSeverity("ALL");
  };

  return (
    <div className="view-in space-y-5">
      <PageHeader
        title="Activity Monitoring"
        description="Chronological feed of what users are doing across the organization — logins, submissions, approvals, tasks, exports."
        icon={Activity}
        breadcrumbs={["Group", "Insights & Governance", "Activity Monitoring"]}
        actions={
          <ExportButton
            filename="activity-feed"
            rows={exportRows}
            formats={["CSV", "JSON"]}
            size="default"
          />
        }
      />

      <Toolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search actor or target…"
        filters={[
          {
            key: "role",
            label: "Role",
            value: role,
            onChange: setRole,
            options: [{ value: "ALL", label: "All roles" }, ...roleOptions.map((r) => ({ value: r, label: ROLE_LABELS[r] ?? r }))],
          },
          {
            key: "action",
            label: "Action",
            value: action,
            onChange: setAction,
            options: [{ value: "ALL", label: "All actions" }, ...actionOptions.map((a) => ({ value: a, label: a.replaceAll("_", " ") }))],
          },
          {
            key: "org",
            label: "Organization",
            value: org,
            onChange: setOrg,
            options: [{ value: "ALL", label: "All organizations" }, ...orgOptions.map((o) => ({ value: o, label: o }))],
          },
          {
            key: "severity",
            label: "Severity",
            value: severity,
            onChange: setSeverity,
            options: [
              { value: "ALL", label: "All severities" },
              ...dedup(events.map((e) => e.severity)).map((s) => ({ value: s, label: s.replaceAll("_", " ") })),
            ],
          },
        ]}
        onReset={reset}
        resultCount={filtered.length}
      />

      {error ? (
        <GlassCard>
          <ErrorState message={error} onRetry={() => refetch()} />
        </GlassCard>
      ) : loading ? (
        <GlassCard>
          <LoadingBlock rows={7} label="Loading activity stream…" />
        </GlassCard>
      ) : grouped.length === 0 ? (
        <GlassCard>
          <EmptyState
            icon={Radio}
            title="No activity matches"
            message={events.length ? "Try widening the filters or clearing the search." : "No activity events have been recorded yet."}
          />
        </GlassCard>
      ) : (
        <div className="flex flex-col gap-5">
          {grouped.map(([day, list]) => (
            <div key={day}>
              <div className="mb-3 flex items-center gap-2">
                <span className="glass-subtle inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-[color:var(--ink-soft)]">
                  <CalendarDays className="h-3.5 w-3.5 text-[color:var(--esg-blue)]" />
                  {day}
                </span>
                <span className="text-xs text-[color:var(--ink-faint)]">
                  {list.length} event{list.length === 1 ? "" : "s"}
                </span>
                <span className="h-px flex-1 bg-[rgba(125,177,216,0.35)]" aria-hidden="true" />
              </div>
              <GlassCard className="relative p-4 sm:p-5">
                <span className="absolute bottom-6 left-[38px] top-6 w-px bg-[rgba(125,177,216,0.4)] sm:left-[46px]" aria-hidden="true" />
                <ol className="flex flex-col gap-1">
                  {list.map((e) => {
                    const dot = SEVERITY_DOT[e.severity] ?? "#8595ab";
                    return (
                      <li key={e.id}>
                        <button
                          type="button"
                          onClick={() => setSelected(e)}
                          className="group relative flex w-full items-start gap-3 rounded-2xl px-2 py-2.5 text-left transition-colors hover:bg-white/60"
                        >
                          <span
                            className="absolute left-[11px] top-5 h-2.5 w-2.5 rounded-full border-2 border-white shadow sm:left-[15px]"
                            style={{ background: dot }}
                            aria-hidden="true"
                          />
                          <span className="ml-7 shrink-0 sm:ml-9">
                            <Avatar name={e.actorName} size={36} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="text-[13px] font-semibold text-[color:var(--ink)]">{e.actorName}</span>
                              <span className="text-xs text-[color:var(--ink-faint)]">{ROLE_LABELS[e.actorRole] ?? e.actorRole}</span>
                              <Chip tone={ACTION_TONES[e.action] ?? "gray"}>{e.action.replaceAll("_", " ").toLowerCase()}</Chip>
                            </span>
                            <span className="mt-0.5 block truncate text-[13px] text-[color:var(--ink-soft)]">
                              {e.targetType}: <span className="font-medium text-[color:var(--ink)]">{e.targetLabel}</span>
                            </span>
                            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-[color:var(--ink-faint)]">
                              {e.orgLabel && <span>{e.orgLabel}</span>}
                              <span>· {timeAgo(e.createdAt)}</span>
                            </span>
                          </span>
                          <span className="hidden shrink-0 sm:block">
                            <StatusBadge status={e.severity === "INFO" ? "INFO" : e.severity} dot={false} />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </GlassCard>
            </div>
          ))}
        </div>
      )}

      <GlassDialog
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        title="Activity detail"
        description="Full record as captured by the platform."
      >
        {selected && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Avatar name={selected.actorName} size={44} />
              <div>
                <div className="text-sm font-semibold text-[color:var(--ink)]">{selected.actorName}</div>
                <div className="text-xs text-[color:var(--ink-faint)]">{ROLE_LABELS[selected.actorRole] ?? selected.actorRole}</div>
              </div>
              <div className="ml-auto">
                <StatusBadge status={selected.severity} />
              </div>
            </div>
            <div className="glass-subtle rounded-2xl p-3">
              <InfoRow label="Action">
                <Chip tone={ACTION_TONES[selected.action] ?? "gray"}>{selected.action}</Chip>
              </InfoRow>
              <InfoRow label="Target type">{selected.targetType}</InfoRow>
              <InfoRow label="Target">{selected.targetLabel}</InfoRow>
              <InfoRow label="Organization">{selected.orgLabel || "—"}</InfoRow>
              <InfoRow label="When">{fmtDate(selected.createdAt)} · {timeAgo(selected.createdAt)}</InfoRow>
            </div>
            <p className="text-xs leading-relaxed text-[color:var(--ink-faint)]">
              Operational feed entries are observational. For authoritative, tamper-evident records open the Audit Logs screen.
            </p>
            <button
              type="button"
              className="self-end text-xs font-medium text-[#1d5fd6] underline-offset-2 hover:underline"
              onClick={() => navigate("audit")}
            >
              Open the authoritative audit log →
            </button>
          </div>
        )}
      </GlassDialog>
    </div>
  );
}
