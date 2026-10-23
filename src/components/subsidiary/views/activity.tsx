"use client";

// ── SUBSIDIARY ADMIN · SCREEN — Activity & Audit ──
// Tab 1: operational activity feed (search / action / user / window filters).
// Tab 2: append-only audit trail with outcomes. Deep link: ?tab=audit.
import * as React from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { FileCheckIcon, PulseIcon } from "@/components/workspace/premium-icons";
import { motion } from "framer-motion";
import { useSaWorkspace } from "@/lib/sa/store";
import { fmtDateTime, timeAgo, useSaApi } from "@/lib/sa/client";
import type { ActivityRow, AuditRow } from "@/lib/sa/types";
import { ROLE_LABELS } from "@/lib/sa/types";
import {
  Avatar, Chip, EmptyState, ErrorState, ExportButton, GlassCard, GlassTabBar,
  InfoRow, LoadingBlock, PageHeader, SectionCard, Toolbar,
} from "@/components/workspace/ui";

/* ── humanized actions ── */
const ACTION_VERBS: Record<string, string> = {
  ACCOUNT_STATUS: "changed account status for",
  ACCOUNT_UPDATE: "updated account for",
  BU_CREATE: "created business unit",
  BU_DELETE: "deleted business unit",
  BU_UPDATE: "updated business unit",
  COMM_SEND: "sent communication",
  CONFIG_CHANGE: "updated workspace settings",
  CREDENTIAL_RESET: "reset credentials for",
  PACKAGE_RESUBMIT: "resubmitted reporting package",
  PACKAGE_SUBMIT: "submitted reporting package",
  PASSWORD_RESET: "reset password for",
  PROJECT_CREATE: "created project",
  PROJECT_DELETE: "deleted project",
  PROJECT_UPDATE: "updated project",
  TIMELINE_CREATE: "created reporting timeline",
  TIMELINE_DELETE: "deleted reporting timeline",
  TIMELINE_UPDATE: "updated reporting timeline",
  USER_CREATE: "invited user",
  VALIDATION_ASSIGN: "assigned validation issue",
  VALIDATION_RESOLVE: "resolved validation issue",
};

const humanizeAction = (action: string) =>
  ACTION_VERBS[action] ?? action.toLowerCase().replace(/_/g, " ");

const SEVERITY_HUE: Record<string, string> = {
  INFO: "#3a7bff", SUCCESS: "#20a779", WARNING: "#c57926", CRITICAL: "#c34a4a",
};

const OUTCOME_TONE: Record<string, "green" | "red" | "gray" | "blue"> = {
  SUCCESS: "green", FAILURE: "red", DENIED: "gray", INFO: "blue",
};

const AUTH_EVENT_LABEL: Record<string, string> = {
  LOGIN_SUCCESS: "Signed in",
  LOGIN_FAILED: "Failed sign-in attempt",
  LOGOUT: "Signed out",
  PASSWORD_RESET_REQUESTED: "Password reset requested",
  RATE_LIMITED: "Rate limited",
};

const DAY_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

/* ── activity feed tab ── */
function ActivityFeed() {
  const [days, setDays] = React.useState("30");
  const [q, setQ] = React.useState("");
  const [action, setAction] = React.useState("ALL");
  const [user, setUser] = React.useState("ALL");
  const { data, loading, error, refetch } = useSaApi<{ events: ActivityRow[] }>(
    `/api/sa/activity?days=${encodeURIComponent(days)}`
  );

  const events = data?.events ?? [];
  const actionOptions = React.useMemo(
    () => [{ value: "ALL", label: "All actions" }, ...Array.from(new Set(events.map((e) => e.action))).sort().map((a) => ({ value: a, label: a }))],
    [events]
  );
  const userOptions = React.useMemo(
    () => [{ value: "ALL", label: "All users" }, ...Array.from(new Set(events.map((e) => e.actorName))).sort().map((u) => ({ value: u, label: u }))],
    [events]
  );

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return events.filter((e) => {
      if (needle && !`${e.actorName} ${e.targetLabel} ${e.orgLabel}`.toLowerCase().includes(needle)) return false;
      if (action !== "ALL" && e.action !== action) return false;
      if (user !== "ALL" && e.actorName !== user) return false;
      return true;
    });
  }, [events, q, action, user]);

  const exportRows = React.useMemo(
    () => filtered.map((e) => ({
      time: e.createdAt, actor: e.actorName, role: e.actorRole, action: e.action,
      verb: humanizeAction(e.action), target: e.targetLabel, org: e.orgLabel, severity: e.severity,
    })),
    [filtered]
  );

  return (
    <div className="space-y-3">
      <Toolbar
        search={q}
        onSearch={setQ}
        searchPlaceholder="Search actor or target…"
        filters={[
          { key: "action", label: "Action", options: actionOptions, value: action, onChange: setAction },
          { key: "user", label: "User", options: userOptions, value: user, onChange: setUser },
          { key: "days", label: "Window", options: DAY_OPTIONS, value: days, onChange: setDays },
        ]}
        onReset={() => { setQ(""); setAction("ALL"); setUser("ALL"); setDays("30"); }}
        resultCount={filtered.length}
        right={<ExportButton filename="subsidiary-activity" rows={exportRows} />}
      />

      {error && !data ? (
        <GlassCard><ErrorState message={error} onRetry={refetch} /></GlassCard>
      ) : loading && !data ? (
        <GlassCard><LoadingBlock rows={6} label="Loading activity feed…" /></GlassCard>
      ) : filtered.length === 0 ? (
        <GlassCard>
          <EmptyState
            title="No activity matches"
            message={events.length === 0
              ? "No subsidiary activity recorded in this window yet — actions taken in this workspace will appear here."
              : "Try widening the window or clearing the search and filters."}
          />
        </GlassCard>
      ) : (
        <div className="nice-scroll max-h-[560px] space-y-2 overflow-y-auto pr-1">
          {filtered.map((e, i) => (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.015, 0.2) }}
              className="glass glass-sheen flex items-start gap-3 rounded-2xl p-3.5"
            >
              <span
                className="mt-2 h-2 w-2 shrink-0 rounded-full"
                style={{ background: SEVERITY_HUE[e.severity] ?? "#3a7bff" }}
                title={e.severity}
                aria-label={`Severity ${e.severity}`}
              />
              <Avatar name={e.actorName} size={34} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[13px] font-semibold text-[color:var(--ink)]">{e.actorName}</span>
                  <Chip tone="purple">{ROLE_LABELS[e.actorRole] ?? e.actorRole}</Chip>
                </div>
                <div className="mt-0.5 text-[12.5px] leading-snug text-[color:var(--ink-soft)]">
                  {humanizeAction(e.action)}{" "}
                  {e.targetLabel && <strong className="font-semibold text-[color:var(--ink)]">{e.targetLabel}</strong>}{" "}
                  <span className="text-[color:var(--ink-faint)]">· {e.orgLabel}</span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[11px] font-medium text-[color:var(--ink-soft)]">{timeAgo(e.createdAt)}</div>
                <div className="text-[10.5px] text-[color:var(--ink-faint)]">{fmtDateTime(e.createdAt)}</div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── audit trail tab ── */
function AuditTrail() {
  const [days, setDays] = React.useState("90");
  const [q, setQ] = React.useState("");
  const [outcome, setOutcome] = React.useState("ALL");
  const { data, loading, error, refetch } = useSaApi<{ events: AuditRow[] }>(
    `/api/sa/audit?days=${encodeURIComponent(days)}`
  );

  const events = data?.events ?? [];

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return events.filter((e) => {
      if (needle && !`${e.actorName} ${e.action} ${e.targetLabel} ${e.reason} ${e.correlation}`.toLowerCase().includes(needle)) return false;
      if (outcome !== "ALL" && e.outcome !== outcome) return false;
      return true;
    });
  }, [events, q, outcome]);

  const exportRows = React.useMemo(
    () => filtered.map((e) => ({
      time: e.createdAt, actor: e.actorName, role: e.actorRole, action: e.action,
      target: e.targetLabel, orgScope: e.orgScope, reason: e.reason, outcome: e.outcome, correlation: e.correlation,
    })),
    [filtered]
  );

  return (
    <div className="space-y-3">
      <Toolbar
        search={q}
        onSearch={setQ}
        searchPlaceholder="Search audit records…"
        filters={[
          {
            key: "outcome", label: "Outcome",
            options: [
              { value: "ALL", label: "All outcomes" },
              { value: "SUCCESS", label: "Success" },
              { value: "FAILURE", label: "Failure" },
              { value: "DENIED", label: "Denied" },
            ],
            value: outcome, onChange: setOutcome,
          },
          { key: "days", label: "Window", options: DAY_OPTIONS, value: days, onChange: setDays },
        ]}
        onReset={() => { setQ(""); setOutcome("ALL"); setDays("90"); }}
        resultCount={filtered.length}
        right={<ExportButton filename="subsidiary-audit-trail" rows={exportRows} />}
      />

      {/* append-only banner */}
      <GlassCard className="flex items-start gap-3 border-[rgba(58,123,255,0.28)] bg-[rgba(58,123,255,0.06)] p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[rgba(58,123,255,0.12)]">
          <Lock className="h-5 w-5 text-[#1d5fd6]" />
        </span>
        <p className="text-[13px] leading-relaxed text-[color:var(--ink-soft)]">
          <strong className="text-[color:var(--ink)]">Audit events are append-only.</strong>{" "}
          Subsidiary Admins cannot edit or delete audit records — every entry is written by the platform on mutation and retained for the Group office.
        </p>
      </GlassCard>

      {error && !data ? (
        <GlassCard><ErrorState message={error} onRetry={refetch} /></GlassCard>
      ) : loading && !data ? (
        <GlassCard><LoadingBlock rows={6} label="Loading audit trail…" /></GlassCard>
      ) : filtered.length === 0 ? (
        <GlassCard>
          <EmptyState
            title="No audit records match"
            message={events.length === 0
              ? "No audit events recorded in this window yet."
              : "Try widening the window or clearing the search and outcome filters."}
          />
        </GlassCard>
      ) : (
        <div className="nice-scroll max-h-[560px] space-y-2 overflow-y-auto pr-1">
          {filtered.map((e, i) => (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.015, 0.2) }}
              className="glass glass-sheen rounded-2xl p-3.5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11.5px] font-semibold tracking-tight text-[color:var(--ink)]">{e.action}</span>
                <Chip tone={OUTCOME_TONE[e.outcome] ?? "gray"}>{e.outcome}</Chip>
                <span className="ml-auto text-right text-[11px] text-[color:var(--ink-faint)]">
                  {fmtDateTime(e.createdAt)} · {timeAgo(e.createdAt)}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-[color:var(--ink-soft)]">
                <Avatar name={e.actorName} size={22} />
                <span className="font-medium text-[color:var(--ink)]">{e.actorName}</span>
                <span aria-hidden="true">→</span>
                <span className="font-semibold text-[color:var(--ink)]">{e.targetLabel || e.targetType}</span>
                <Chip tone="gray">{e.orgScope}</Chip>
              </div>
              {(e.reason || e.correlation) && (
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {e.reason && (
                    <span className="text-[11.5px] font-medium text-[#9c5d1b]">Reason: {e.reason}</span>
                  )}
                  {e.correlation && (
                    <span className="font-mono text-[10.5px] text-[color:var(--ink-faint)]">corr {e.correlation}</span>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── screen ── */
export default function ActivityView() {
  const { params, navigate } = useSaWorkspace();
  const [tab, setTab] = React.useState<"activity" | "audit">("activity");
  const initialTab = React.useRef(String((params as { tab?: unknown }).tab ?? ""));

  /* honor deep link (?tab=audit) then clear the param */
  React.useEffect(() => {
    const t = initialTab.current;
    if (t === "audit" || t === "activity") setTab(t);
    if (t) navigate("activity");
  }, []);

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="Activity & Audit"
        description="Who did what across your subsidiary — operational activity at a glance, plus the authoritative append-only audit trail."
        icon={PulseIcon}
        breadcrumbs={["Subsidiary", "Governance", "Activity & Audit"]}
      />

      <GlassTabBar
        tabs={[
          { value: "activity", label: "Activity feed", icon: PulseIcon },
          { value: "audit", label: "Audit trail", icon: FileCheckIcon },
        ]}
        value={tab}
        onChange={(v) => setTab(v as "activity" | "audit")}
      />

      <SectionCard
        title={tab === "activity" ? "Subsidiary activity feed" : "Audit trail"}
        description={tab === "activity"
          ? "Every action taken inside this subsidiary workspace, newest first."
          : "Platform-written records of privileged operations with outcomes and correlation IDs."}
        icon={tab === "activity" ? PulseIcon : FileCheckIcon}
      >
        {tab === "activity" ? <ActivityFeed /> : <AuditTrail />}
      </SectionCard>

      {tab === "audit" && (
        <GlassCard subtle className="flex flex-wrap items-center gap-2 p-4 text-xs text-[color:var(--ink-faint)]">
          <ShieldCheck className="h-4 w-4 text-[#20a779]" />
          Authentication history (sign-ins, lockouts, credential recovery) is recorded separately and visible per user in User Management.
        </GlassCard>
      )}

      <GlassCard className="p-4">
        <InfoRow label="Retention">
          Activity feed: rolling 90-day window · Audit trail: retained by the Group office, append-only
        </InfoRow>
      </GlassCard>
    </div>
  );
}
