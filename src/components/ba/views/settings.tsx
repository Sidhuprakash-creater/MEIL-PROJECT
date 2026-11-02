"use client";

// ── BU ADMIN · SCREEN 16 — Settings ──
// BU profile + editable notification preferences + workspace defaults +
// current admin's security footprint (sessions + recent auth audit).
// Settings endpoint polled every 30s; preferences persisted via PATCH.
import * as React from "react";
import {
  Laptop, RefreshCw, Save, ShieldCheck, Smartphone,
} from "lucide-react";
import {
  BellIcon, GearIcon, ShieldIcon, UnitsIcon,
} from "@/components/workspace/premium-icons";
import { motion } from "framer-motion";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiPatch, fmtDate, fmtDateTime, useBaApi } from "@/lib/ba/client";
import type { BaSettingsData, BaPrefs } from "@/lib/ba/types";
import { useBaWorkspace, REPORTING_YEARS } from "@/lib/ba/store";
import { useToast } from "@/hooks/use-toast";
import {
  ActionButton, Chip, ErrorState, Field, GlassCard, GlassTabBar, InfoRow,
  LoadingBlock, PageHeader, SectionCard,
} from "@/components/workspace/ui";

type PrefsKey = keyof BaPrefs;

const PREF_META: { key: PrefsKey; label: string; description: string }[] = [
  { key: "submissionAlerts", label: "Submission alerts", description: "Immediate alerts when project teams submit reports under your BU." },
  { key: "deadlineReminders", label: "Deadline reminders", description: "Heads-up notifications as BU and project reporting deadlines approach." },
  { key: "weeklyDigest", label: "Weekly digest", description: "One consolidated summary of BU reporting progress every week." },
  { key: "validationAlerts", label: "Validation alerts", description: "Alerts when data validation issues are detected in submitted reports." },
  { key: "reviewStatusUpdates", label: "Review status updates", description: "Updates when the BU Manager records a decision on a report." },
];

const AUTH_EVENT_LABEL: Record<string, string> = {
  LOGIN_SUCCESS: "Signed in",
  LOGIN_FAILED: "Failed sign-in attempt",
  LOGOUT: "Signed out",
  PASSWORD_RESET_REQUESTED: "Password reset requested",
  RATE_LIMITED: "Rate limited",
};

function deviceLabel(ua: string): string {
  if (!ua) return "Unknown device";
  const browser = ua.includes("Edg/") ? "Edge" : ua.includes("Chrome") ? "Chrome" : ua.includes("Firefox") ? "Firefox" : ua.includes("Safari") ? "Safari" : "Browser";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "device";
  return `${browser} · ${os}`;
}

type SettingsTab = "profile" | "preferences" | "workspace" | "security";

export default function SettingsView() {
  const { reportingYear } = useBaWorkspace();
  const { data, loading, error, refetch } = useBaApi<BaSettingsData>(
    `/api/ba/settings?period=${encodeURIComponent(reportingYear)}`,
    { pollMs: 30000, deps: [reportingYear] }
  );
  const [tab, setTab] = React.useState<SettingsTab>("profile");
  const [pendingPrefs, setPendingPrefs] = React.useState<BaPrefs | null>(null);
  const [pendingDensity, setPendingDensity] = React.useState<"compact" | "comfortable">("comfortable");
  const [pendingPeriod, setPendingPeriod] = React.useState<string>("FY 2025-26");
  const [saving, setSaving] = React.useState(false);
  const toast = useToast();

  React.useEffect(() => {
    if (data) {
      setPendingPrefs(data.preferences);
      setPendingDensity(data.workspacePrefs.tableDensity);
      setPendingPeriod(data.workspacePrefs.defaultPeriod);
    }
  }, [data]);

  if (loading && !data) return <LoadingBlock rows={6} label="Loading BU settings…" />;
  if (error && !data) return <ErrorState message={error} onRetry={refetch} />;
  if (!data || !pendingPrefs) return null;

  const u = data.user;
  const bu = data.businessUnit;

  const togglePref = (key: PrefsKey, value: boolean) => {
    setPendingPrefs((p) => (p ? { ...p, [key]: value } : p));
  };

  const dirtyPrefs = JSON.stringify(pendingPrefs) !== JSON.stringify(data.preferences);
  const dirtyWp = pendingDensity !== data.workspacePrefs.tableDensity || pendingPeriod !== data.workspacePrefs.defaultPeriod;
  const dirty = dirtyPrefs || dirtyWp;

  const save = async () => {
    if (!pendingPrefs) return;
    setSaving(true);
    try {
      await apiPatch<BaSettingsData>("/api/ba/settings", {
        preferences: pendingPrefs,
        workspacePrefs: { tableDensity: pendingDensity, defaultPeriod: pendingPeriod },
      });
      toast.toast({ title: "Settings saved", description: "Your BU workspace preferences have been updated." });
      refetch();
    } catch (e) {
      toast.toast({ title: "Save failed", description: e instanceof Error ? e.message : "Could not update settings.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="view-in space-y-5">
      <PageHeader
        icon={GearIcon}
        title="Settings"
        description="BU profile, notification preferences, workspace defaults and security."
        actions={
          <div className="flex items-center gap-2">
            <Chip tone="blue">{bu.code}</Chip>
            <ActionButton onClick={save} disabled={!dirty || saving} pending={saving}>
              <span className="inline-flex items-center gap-1.5">
                <Save className="h-4 w-4" />
                {saving ? "Saving…" : "Save changes"}
              </span>
            </ActionButton>
          </div>
        }
      />

      <GlassTabBar
        tabs={[
          { value: "profile", label: "Profile & BU" },
          { value: "preferences", label: "Notifications" },
          { value: "workspace", label: "Workspace" },
          { value: "security", label: "Security" },
        ]}
        value={tab}
        onChange={(v) => setTab(v as SettingsTab)}
      />

      {tab === "profile" && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="grid gap-5 lg:grid-cols-2"
        >
          <SectionCard icon={UnitsIcon} title="Business Unit" description="The unit you administer.">
            <div className="space-y-0.5">
              <InfoRow label="BU code">{bu.code}</InfoRow>
              <InfoRow label="BU name">{bu.name}</InfoRow>
              <InfoRow label="Parent subsidiary">{`${bu.subsidiaryName} (${bu.subsidiaryCode})`}</InfoRow>
              <InfoRow label="Sector">{bu.sector}</InfoRow>
              <InfoRow label="BU Manager">{bu.managerName}</InfoRow>
              <InfoRow label="Description">{bu.description || "—"}</InfoRow>
              <InfoRow label="Status"><Chip tone="green">{bu.status}</Chip></InfoRow>
            </div>
          </SectionCard>

          <SectionCard icon={ShieldIcon} title="Your account" description="BU Admin profile managed by your Subsidiary Admin.">
            <div className="space-y-0.5">
              <InfoRow label="Name">{u.name}</InfoRow>
              <InfoRow label="Employee ID">{u.employeeId || "—"}</InfoRow>
              <InfoRow label="Title">{u.title || "—"}</InfoRow>
              <InfoRow label="Role">{u.roleLabel}</InfoRow>
              <InfoRow label="Status"><Chip tone="green">{u.status}</Chip></InfoRow>
              <InfoRow label="Joined">{fmtDate(u.joinedAt)}</InfoRow>
              <InfoRow label="Last login">{u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : "—"}</InfoRow>
            </div>
            <div className="mt-4 rounded-2xl bg-[rgba(52,139,232,0.06)] p-3 text-[12px] leading-relaxed text-[color:var(--ink-soft)]">
              <ShieldCheck className="mr-1.5 inline h-3.5 w-3.5 text-[color:var(--ba-action)]" />
              Your role and BU assignment are owned by the Subsidiary Admin. To request changes, contact <strong>{bu.subsidiaryName}</strong>.
            </div>
          </SectionCard>
        </motion.div>
      )}

      {tab === "preferences" && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
        >
          <SectionCard icon={BellIcon} title="Notification preferences" description="Choose which BU events trigger in-app notifications.">
            <div className="grid gap-2.5">
              {PREF_META.map((p) => (
                <div
                  key={p.key}
                  className="glass-ba flex items-center justify-between gap-4 rounded-2xl p-4"
                >
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-semibold text-[color:var(--ink)]">{p.label}</div>
                    <div className="mt-0.5 text-[12px] leading-relaxed text-[color:var(--ink-faint)]">{p.description}</div>
                  </div>
                  <Switch
                    checked={pendingPrefs[p.key]}
                    onCheckedChange={(v) => togglePref(p.key, v)}
                    aria-label={p.label}
                  />
                </div>
              ))}
            </div>
            {dirtyPrefs && (
              <div className="mt-3 text-[12px] font-medium text-[color:var(--ba-action)]">
                You have unsaved preference changes.
              </div>
            )}
          </SectionCard>
        </motion.div>
      )}

      {tab === "workspace" && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
        >
          <SectionCard icon={GearIcon} title="Workspace defaults" description="Personalise how reports and tables appear in this BU workspace.">
            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="Default reporting period" hint="Pre-selected on dashboard and list views.">
                <Select value={pendingPeriod} onValueChange={setPendingPeriod}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORTING_YEARS.map((y) => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Table density" hint="Comfortable for review; compact for dense BU registers.">
                <Select
                  value={pendingDensity}
                  onValueChange={(v) => setPendingDensity(v as "compact" | "comfortable")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select density" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comfortable">Comfortable</SelectItem>
                    <SelectItem value="compact">Compact</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            {dirtyWp && (
              <div className="mt-3 text-[12px] font-medium text-[color:var(--ba-action)]">
                You have unsaved workspace changes.
              </div>
            )}
          </SectionCard>
        </motion.div>
      )}

      {tab === "security" && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="grid gap-5 lg:grid-cols-2"
        >
          <SectionCard icon={Laptop} title="Active sessions" description="Devices currently signed into your BU Admin account.">
            <div className="space-y-2.5">
              {data.sessions.length === 0 && (
                <div className="rounded-2xl bg-[rgba(125,177,216,0.10)] p-4 text-center text-[12px] text-[color:var(--ink-faint)]">
                  No active sessions on record.
                </div>
              )}
              {data.sessions.map((s) => (
                <div key={s.id} className="glass-ba flex items-center justify-between gap-3 rounded-2xl p-3.5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[rgba(52,139,232,0.10)] text-[color:var(--ba-action)]">
                      {/iPhone|iPad|Android/i.test(s.device) ? <Smartphone className="h-4 w-4" /> : <Laptop className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[12.5px] font-semibold text-[color:var(--ink)]">
                        {deviceLabel(s.device)}
                      </div>
                      <div className="truncate text-[11px] text-[color:var(--ink-faint)]">
                        {s.ip || "—"} · created {fmtDate(s.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.mostRecent && <Chip tone="green">Current</Chip>}
                    <span className="text-[11px] text-[color:var(--ink-faint)]">expires {fmtDate(s.expiresAt)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-2xl bg-[rgba(125,177,216,0.10)] p-3 text-[12px] leading-relaxed text-[color:var(--ink-soft)]">
              <RefreshCw className="mr-1.5 inline h-3.5 w-3.5 text-[color:var(--ba-action)]" />
              Sign out everywhere revokes all sessions and returns you to the gateway.
            </div>
          </SectionCard>

          <SectionCard icon={ShieldIcon} title="Recent authentication" description="Authoritative login audit trail for your account.">
            <div className="space-y-2.5">
              {data.recentAuth.length === 0 && (
                <div className="rounded-2xl bg-[rgba(125,177,216,0.10)] p-4 text-center text-[12px] text-[color:var(--ink-faint)]">
                  No recent authentication events.
                </div>
              )}
              {data.recentAuth.map((a) => (
                <div key={a.id} className="glass-ba flex items-center justify-between gap-3 rounded-2xl p-3.5">
                  <div className="min-w-0">
                    <div className="truncate text-[12.5px] font-semibold text-[color:var(--ink)]">
                      {AUTH_EVENT_LABEL[a.eventType] ?? a.eventType}
                    </div>
                    <div className="truncate text-[11px] text-[color:var(--ink-faint)]">{a.reason || "—"}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Chip tone={a.result === "SUCCESS" ? "green" : a.result === "FAILURE" ? "red" : "amber"}>{a.result}</Chip>
                    <span className="text-[11px] text-[color:var(--ink-faint)]">{fmtDateTime(a.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </motion.div>
      )}
    </div>
  );
}
