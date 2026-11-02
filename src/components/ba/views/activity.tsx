"use client";

// ── BU Admin · SCREEN 15 — Activity & Audit ──
// Two tabs: operational activity feed + authoritative audit trail.

import { useEffect, useMemo, useState } from "react";
import { Filter, Lock, RotateCcw, Search } from "lucide-react";
import { PulseIcon, FileCheckIcon } from "@/components/workspace/premium-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBaApi, fmtDateTime, timeAgo, toCsv, downloadFile } from "@/lib/ba/client";
import type { ActivityRow, AuditRow } from "@/lib/ba/types";
import {
  Avatar, Chip, EmptyState, ErrorState, GlassCard, GlassTabBar, LoadingBlock, PageHeader, SectionCard, StatusBadge, Toolbar,
} from "@/components/workspace/ui";
import { useBaWorkspace } from "@/lib/ba/store";

const ACTION_VERBS: Record<string, string> = {
  USER_CREATE: "invited user",
  ACCOUNT_UPDATE: "updated account",
  ROLE_CHANGE: "changed role",
  INVITE_RESEND: "resent invite",
  TIMELINE_CREATE: "set reporting timeline",
  TIMELINE_UPDATE: "updated reporting timeline",
  TASK_ASSIGN: "assigned task",
  TASK_CREATE: "created task",
  TASK_UPDATE: "updated task",
  TASK_ESCALATE: "escalated task",
  REMINDER_DISPATCH: "dispatched reminder",
  COMM_SEND: "sent message",
  VALIDATION_ASSIGN: "assigned issue",
  PACKAGE_SUBMIT: "submitted package",
  CONFIG_CHANGE: "changed configuration",
};

type Tab = "activity" | "audit";

export default function ActivityView() {
  const { params, navigate } = useBaWorkspace();
  const [tab, setTab] = useState<Tab>(() => (params.tab === "audit" || params.tab === "activity" ? (params.tab as Tab) : "activity"));
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("ALL");
  const [user, setUser] = useState("ALL");
  const [outcome, setOutcome] = useState("ALL");
  const [days, setDays] = useState("30");

  /* consume the deep-link once — clearing the param must not re-render tab */
  useEffect(() => {
    if (params.tab === "audit" || params.tab === "activity") {
      navigate("activity", { ...params, tab: undefined });
    }
  }, []);

  const q = search.toLowerCase();
  const activityPath = `/api/ba/activity?q=${encodeURIComponent(q)}&action=${action}&user=${user}&days=${days}`;
  const auditPath = `/api/ba/audit?q=${encodeURIComponent(q)}&outcome=${outcome}&days=${days}`;
  const act = useBaApi<{ events: ActivityRow[] }>(tab === "activity" ? activityPath : null, { deps: [tab, q, action, user, days] });
  const aud = useBaApi<{ events: AuditRow[] }>(tab === "audit" ? auditPath : null, { deps: [tab, q, outcome, days] });

  const activityEvents = act.data?.events ?? [];
  const auditEvents = aud.data?.events ?? [];
  const actionOptions = useMemo(() => [...new Set(activityEvents.map((e) => e.action))].sort(), [activityEvents]);
  const userOptions = useMemo(() => [...new Set(activityEvents.map((e) => e.actorName))].sort(), [activityEvents]);

  const exportRows = () => {
    const rows = (tab === "activity" ? activityEvents : auditEvents).map((e) => {
      const base: Record<string, unknown> = {
        actor: e.actorName, role: e.actorRole, action: e.action,
        target: "targetLabel" in e ? e.targetLabel : "",
        at: e.createdAt,
      };
      if (tab === "audit") {
        const a = e as AuditRow;
        base.outcome = a.outcome;
        base.reason = a.reason;
        base.correlation = a.correlation;
      }
      return base;
    });
    downloadFile(`ba-${tab}-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows), "text/csv");
  };

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="Activity & Audit"
        description="Operational activity feed and authoritative audit trail — scoped to your BU. User changes, deadline changes, reminder dispatches, package preparation, system events."
        icon={PulseIcon}
        actions={<Button variant="outline" className="glass-subtle rounded-2xl" onClick={exportRows}>Export {tab}</Button>}
      />

      <GlassTabBar
        tabs={[
          { value: "activity", label: "Activity feed", icon: PulseIcon },
          { value: "audit", label: "Audit trail", icon: FileCheckIcon },
        ]}
        value={tab}
        onChange={(v) => setTab(v as Tab)}
      />

      <GlassCard className="glass-ba flex flex-wrap items-center gap-2 p-3">
        <div className="flex items-center gap-2 text-[12px] font-medium text-[color:var(--ink-soft)]"><Search className="h-3.5 w-3.5" /> Filter</div>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search actor, action, target…" className="glass-subtle h-9 w-[200px] rounded-2xl border-white/60 text-sm" />
        {tab === "activity" ? (
          <>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="h-9 w-[200px] rounded-2xl border-white/60 bg-white/60 text-[13px]"><SelectValue placeholder="Action" /></SelectTrigger>
              <SelectContent className="glass-strong rounded-2xl border-white/70">
                <SelectItem value="ALL">All actions</SelectItem>
                {actionOptions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={user} onValueChange={setUser}>
              <SelectTrigger className="h-9 w-[180px] rounded-2xl border-white/60 bg-white/60 text-[13px]"><SelectValue placeholder="Actor" /></SelectTrigger>
              <SelectContent className="glass-strong rounded-2xl border-white/70">
                <SelectItem value="ALL">All actors</SelectItem>
                {userOptions.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        ) : (
          <Select value={outcome} onValueChange={setOutcome}>
            <SelectTrigger className="h-9 w-[180px] rounded-2xl border-white/60 bg-white/60 text-[13px]"><SelectValue placeholder="Outcome" /></SelectTrigger>
            <SelectContent className="glass-strong rounded-2xl border-white/70">
              <SelectItem value="ALL">All outcomes</SelectItem>
              <SelectItem value="SUCCESS">Success</SelectItem>
              <SelectItem value="FAILURE">Failure</SelectItem>
              <SelectItem value="DENIED">Denied</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="h-9 w-[140px] rounded-2xl border-white/60 bg-white/60 text-[13px]"><SelectValue /></SelectTrigger>
          <SelectContent className="glass-strong rounded-2xl border-white/70">
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last year</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" className="h-9 rounded-2xl" onClick={() => { setSearch(""); setAction("ALL"); setUser("ALL"); setOutcome("ALL"); setDays("30"); }}><RotateCcw className="h-3.5 w-3.5" /> Reset</Button>
        <span className="ml-auto text-[12px] tabular text-[color:var(--ink-faint)]">{tab === "activity" ? activityEvents.length : auditEvents.length} records</span>
      </GlassCard>

      {tab === "activity" ? (
        act.loading && !act.data ? <LoadingBlock rows={5} /> : act.error && !act.data ? <ErrorState message={act.error} onRetry={act.refetch} /> : activityEvents.length === 0 ? (
          <GlassCard className="glass-ba"><EmptyState title="No activity yet" message="Actions performed in your BU will appear here." icon={Filter} /></GlassCard>
        ) : (
          <div className="space-y-2">
            {activityEvents.map((e) => (
              <GlassCard key={e.id} className="glass-ba p-3">
                <div className="flex items-start gap-3">
                  <Avatar name={e.actorName} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] text-[color:var(--ink)]">
                      <span className="font-semibold">{e.actorName}</span> <span className="text-[color:var(--ink-faint)]">{ACTION_VERBS[e.action] ?? e.action.replace(/_/g, " ").toLowerCase()}</span>
                      {e.targetLabel && <span className="text-[color:var(--ink-soft)]"> — {e.targetLabel}</span>}
                    </div>
                    <div className="text-[10.5px] text-[color:var(--ink-faint)]">{fmtDateTime(e.createdAt)} · {timeAgo(e.createdAt)} · {e.orgLabel}</div>
                  </div>
                  <Chip tone={e.severity === "CRITICAL" ? "red" : e.severity === "WARNING" ? "amber" : e.severity === "SUCCESS" ? "green" : "blue"}>{e.severity}</Chip>
                </div>
              </GlassCard>
            ))}
          </div>
        )
      ) : (
        <>
          <div className="glass-ba glass-sheen flex items-center gap-2 rounded-2xl p-3 text-[12px] text-[color:var(--ink-soft)]">
            <Lock className="h-3.5 w-3.5 text-[#c57926]" /> Append-only audit trail — entries cannot be modified or deleted.
          </div>
          {aud.loading && !aud.data ? <LoadingBlock rows={5} /> : aud.error && !aud.data ? <ErrorState message={aud.error} onRetry={aud.refetch} /> : auditEvents.length === 0 ? (
            <GlassCard className="glass-ba"><EmptyState title="No audit entries" message="Audited actions in your BU will appear here." icon={Filter} /></GlassCard>
          ) : (
            <div className="space-y-2">
              {auditEvents.map((e) => (
                <GlassCard key={e.id} className="glass-ba p-3">
                  <div className="flex items-start gap-3">
                    <Avatar name={e.actorName} size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] text-[color:var(--ink)]">
                        <span className="font-mono text-[12px] text-[color:var(--ba-sky-deep)]">{e.action}</span>{" · "}
                        <span className="font-semibold">{e.actorName}</span>
                        {e.targetLabel && <span className="text-[color:var(--ink-soft)]"> → {e.targetLabel}</span>}
                        <Chip tone="gray">{e.orgScope}</Chip>
                      </div>
                      {e.reason && <div className="mt-0.5 text-[11.5px] text-[#9c5d1b]">Reason: {e.reason}</div>}
                      <div className="text-[10.5px] text-[color:var(--ink-faint)]">{fmtDateTime(e.createdAt)} · {timeAgo(e.createdAt)} · {e.correlation}</div>
                    </div>
                    <StatusBadge status={e.outcome} />
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
