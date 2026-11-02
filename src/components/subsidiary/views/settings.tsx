"use client";

// ── SUBSIDIARY ADMIN · SCREEN — Settings ──
// Profile (read-only, Group-owned) + editable contact card, notification
// preferences, group-mandated reporting configuration, sync health and the
// current admin's security footprint. Settings endpoint polled every 30s.
import * as React from "react";
import {
  CalendarClock, Database, KeyRound, Laptop, Mail, RefreshCw, Save,
  ShieldCheck, Smartphone,
} from "lucide-react";
import { BellIcon, DatabaseIcon, OrgIcon, ReportChartIcon, ShieldIcon } from "@/components/workspace/premium-icons";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { apiPatch, fmtDate, fmtDateTime, timeAgo, useSaApi } from "@/lib/sa/client";
import type { SubsidiaryInfo } from "@/lib/sa/types";
import { useSaWorkspace } from "@/lib/sa/store";
import { useToast } from "@/hooks/use-toast";
import {
  ActionButton, Chip, ErrorState, Field, GlassCard, GlassTabBar, InfoRow,
  LoadingBlock, PageHeader, SectionCard,
} from "@/components/workspace/ui";

/* ── response contract (mirrors GET /api/sa/settings) ── */
interface SaSettingsData {
  profile: SubsidiaryInfo;
  contact: { email: string; phone: string; reportingContact: string };
  preferences: { deadlineReminders: boolean; submissionAlerts: boolean; weeklyDigest: boolean; emailEscalation: boolean };
  reportingConfig: { mandatedPeriods: string[]; disclosureCatalogue: string; inheritanceRule: string; timelineLocked: boolean };
  integrations: { syncStatus: string; lastSyncAt: string | null; failedJobs: number };
  security: {
    sessions: { id: string; userAgent: string; ip: string; createdAt: string; expiresAt: string }[];
    recentAuth: { id: string; eventType: string; result: string; portal: string; reason: string; detail: string; createdAt: string }[];
  };
}

type PrefsKey = keyof SaSettingsData["preferences"];

const PREF_META: { key: PrefsKey; label: string; description: string }[] = [
  { key: "deadlineReminders", label: "Deadline reminders", description: "Heads-up notifications as BU and project reporting deadlines approach." },
  { key: "submissionAlerts", label: "Submission alerts", description: "Immediate alerts when BU or project teams submit reports for review." },
  { key: "weeklyDigest", label: "Weekly digest", description: "One consolidated summary of subsidiary reporting progress every week." },
  { key: "emailEscalation", label: "Email escalation", description: "Escalate overdue and rejected items to email in addition to in-app notifications." },
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ── profile tab ── */
function ProfileTab({ data }: { data: SaSettingsData }) {
  const { toast } = useToast();
  const p = data.profile;
  const [contact, setContact] = React.useState(data.contact);
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  /* sync from server only while the form is clean (30s polls don't clobber typing) */
  React.useEffect(() => {
    if (!dirty) setContact(data.contact);
  }, [data.contact, dirty]);

  const emailErr = contact.email.trim() && !EMAIL_RE.test(contact.email.trim())
    ? "Enter a valid email address (e.g. reporting@meil.in)."
    : null;

  const saveContact = async () => {
    if (emailErr) {
      toast({ variant: "destructive", title: "Check the email address", description: emailErr });
      return;
    }
    setSaving(true);
    try {
      const res = await apiPatch<SaSettingsData>("/api/sa/settings", {
        contact: {
          email: contact.email.trim(),
          phone: contact.phone.trim(),
          reportingContact: contact.reportingContact.trim(),
        },
      });
      setContact(res.contact);
      setDirty(false);
      toast({ title: "Contact details saved", description: "Your subsidiary contact card is up to date." });
    } catch (e) {
      toast({ variant: "destructive", title: "Could not save contact", description: e instanceof Error ? e.message : "Unexpected error." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <SectionCard
        title="Subsidiary profile"
        description="Identity of your subsidiary as registered with the Group."
        icon={OrgIcon}
      >
        <div>
          <InfoRow label="Name">{p.name}</InfoRow>
          <InfoRow label="Code"><span className="font-mono text-[12px]">{p.code}</span></InfoRow>
          <InfoRow label="Sector">{p.sector || "—"}</InfoRow>
          <InfoRow label="Region">{[p.region, p.city].filter(Boolean).join(" · ") || "—"}</InfoRow>
          <InfoRow label="Subsidiary Manager">{p.managerName || "—"}</InfoRow>
          <InfoRow label="Subsidiary Admin">{p.adminName || "—"}</InfoRow>
          <InfoRow label="Status"><Chip tone={p.status === "ACTIVE" ? "green" : "gray"}>{p.status}</Chip></InfoRow>
        </div>
        <div className="mt-3 flex items-start gap-2.5 rounded-2xl border border-[rgba(58,123,255,0.25)] bg-[rgba(58,123,255,0.06)] p-3.5 text-[12.5px] leading-relaxed text-[color:var(--ink-soft)]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#1d5fd6]" />
          <span>
            <strong className="text-[color:var(--ink)]">Profile fields are managed by the Group office.</strong>{" "}
            Name, sector, region and leadership assignments can only be changed by a Group Admin — contact the Group office to request corrections.
          </span>
        </div>
      </SectionCard>

      <SectionCard
        title="Contact card"
        description="Used for report notifications, review correspondence and escalations."
        icon={Mail}
        actions={dirty ? <Chip tone="amber">Unsaved changes</Chip> : undefined}
      >
        <div className="space-y-3.5">
          <Field label="Contact email" required error={emailErr} htmlFor="sa-contact-email" hint="Receives deadline reminders and review correspondence.">
            <Input
              id="sa-contact-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={contact.email}
              onChange={(e) => { setContact((c) => ({ ...c, email: e.target.value })); setDirty(true); }}
              className="glass-subtle rounded-2xl border-white/60 text-sm"
              placeholder="reporting@meil.in"
            />
          </Field>
          <Field label="Contact phone" htmlFor="sa-contact-phone">
            <Input
              id="sa-contact-phone"
              type="tel"
              value={contact.phone}
              onChange={(e) => { setContact((c) => ({ ...c, phone: e.target.value })); setDirty(true); }}
              className="glass-subtle rounded-2xl border-white/60 text-sm"
              placeholder="+91 …"
            />
          </Field>
          <Field label="Reporting contact" htmlFor="sa-contact-reporting" hint="Named person accountable for report accuracy.">
            <Input
              id="sa-contact-reporting"
              value={contact.reportingContact}
              onChange={(e) => { setContact((c) => ({ ...c, reportingContact: e.target.value })); setDirty(true); }}
              className="glass-subtle rounded-2xl border-white/60 text-sm"
              placeholder="e.g. Priya Raghavan"
            />
          </Field>
          <div className="flex items-center gap-3">
            <ActionButton pending={saving} className="btn-action" onClick={() => void saveContact()} disabled={!!emailErr}>
              {!saving && <Save className="mr-1.5 h-4 w-4" />} Save contact details
            </ActionButton>
            {dirty && (
              <button
                type="button"
                className="text-[12.5px] font-medium text-[color:var(--ink-faint)] hover:text-[color:var(--ink)] hover:underline"
                onClick={() => { setContact(data.contact); setDirty(false); }}
              >
                Discard changes
              </button>
            )}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

/* ── notifications tab ── */
function NotificationsTab({ data }: { data: SaSettingsData }) {
  const { toast } = useToast();
  const [prefs, setPrefs] = React.useState(data.preferences);
  const [busy, setBusy] = React.useState<PrefsKey | null>(null);

  React.useEffect(() => {
    setPrefs(data.preferences);
  }, [data.preferences]);

  const toggle = async (key: PrefsKey, next: boolean) => {
    const prev = prefs;
    setPrefs((p) => ({ ...p, [key]: next })); // optimistic
    setBusy(key);
    try {
      await apiPatch<SaSettingsData>("/api/sa/settings", { preferences: { [key]: next } });
      const meta = PREF_META.find((m) => m.key === key);
      toast({ title: "Preference saved", description: `${meta?.label ?? key} ${next ? "enabled" : "disabled"}.` });
    } catch (e) {
      setPrefs(prev); // revert on failure
      toast({ variant: "destructive", title: "Could not save preference", description: e instanceof Error ? e.message : "Unexpected error." });
    } finally {
      setBusy(null);
    }
  };

  return (
    <SectionCard
      title="Notification preferences"
      description="Choose which platform events reach you. Changes apply immediately and are audit-logged."
      icon={BellIcon}
    >
      <div className="space-y-2.5">
        {PREF_META.map((m, i) => (
          <motion.div
            key={m.key}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="glass-subtle flex items-center justify-between gap-4 rounded-2xl p-4"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[13.5px] font-semibold text-[color:var(--ink)]">
                {m.label}
                {prefs[m.key] ? <Chip tone="green">On</Chip> : <Chip tone="gray">Off</Chip>}
              </div>
              <p className="mt-0.5 text-[12px] leading-relaxed text-[color:var(--ink-soft)]">{m.description}</p>
            </div>
            <Switch
              checked={prefs[m.key]}
              onCheckedChange={(v) => void toggle(m.key, v)}
              disabled={busy === m.key}
              aria-label={m.label}
            />
          </motion.div>
        ))}
      </div>
      <p className="mt-3 text-[11.5px] text-[color:var(--ink-faint)]">
        Group-wide announcements and review decisions are always delivered — these switches only govern operational reminders and escalations.
      </p>
    </SectionCard>
  );
}

/* ── reporting configuration tab (read-only) ── */
function ReportingConfigTab({ data }: { data: SaSettingsData }) {
  const rc = data.reportingConfig;
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <SectionCard
        title="Mandated reporting periods"
        description="Fiscal years the Group office requires your subsidiary to report on."
        icon={CalendarClock}
      >
        <div className="flex flex-wrap gap-2">
          {rc.mandatedPeriods.map((p) => (
            <Chip key={p} tone="blue">{p}</Chip>
          ))}
        </div>
        <InfoRow label="Timeline control">
          <Chip tone={rc.timelineLocked ? "amber" : "green"}>{rc.timelineLocked ? "Locked by Group" : "Open for this period"}</Chip>
        </InfoRow>
      </SectionCard>

      <SectionCard
        title="Disclosure catalogue"
        description="The disclosure framework your submissions roll up into."
        icon={ReportChartIcon}
      >
        <InfoRow label="Framework">{rc.disclosureCatalogue}</InfoRow>
        <InfoRow label="Inheritance rule">{rc.inheritanceRule}</InfoRow>
        <div className="mt-3 flex items-start gap-2.5 rounded-2xl border border-[rgba(197,121,38,0.3)] bg-[rgba(197,121,38,0.08)] p-3.5 text-[12.5px] leading-relaxed text-[color:var(--ink-soft)]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#9c5d1b]" />
          <span>
            <strong className="text-[color:var(--ink)]">Group-mandated configuration is read-only for subsidiary admins.</strong>{" "}
            Periods, catalogue and inheritance defaults are set by the Group office; you can layer BU/project timelines on top from Reporting Timelines.
          </span>
        </div>
      </SectionCard>
    </div>
  );
}

/* ── integrations tab ── */
function IntegrationsTab({ data }: { data: SaSettingsData }) {
  const lastChecked = useSaWorkspace((s) => s.lastSyncedAt);
  const [, tick] = React.useReducer((n: number) => n + 1, 0);

  /* 1s ticker so the "checked Xs ago" line stays live between 30s polls */
  React.useEffect(() => {
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, []);

  const integ = data.integrations;
  const secs = lastChecked ? Math.max(0, Math.round((Date.now() - new Date(lastChecked).getTime()) / 1000)) : null;
  const operational = integ.syncStatus === "OPERATIONAL";

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <SectionCard
        title="Group console sync"
        description="Live status of the shared-data connection between this workspace and the Group console."
        icon={DatabaseIcon}
        actions={<Chip tone={operational ? "green" : "amber"}>{operational ? "OPERATIONAL" : integ.syncStatus}</Chip>}
      >
        <div className="space-y-3">
          <div className="glass-subtle flex items-center gap-3 rounded-2xl p-4">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              {operational && <span className="absolute h-full w-full animate-ping rounded-full bg-[#238653] opacity-60" />}
              <span className={`relative h-2.5 w-2.5 rounded-full ${operational ? "bg-[#238653]" : "bg-[#c57926]"}`} />
            </span>
            <div className="min-w-0 flex-1 text-[12.5px] text-[color:var(--ink-soft)]">
              <strong className="text-[color:var(--ink)]">Live sync healthy</strong> · checked {secs !== null ? `${secs}s ago` : "—"}
            </div>
            <RefreshCw className="h-4 w-4 shrink-0 text-[color:var(--ink-faint)]" aria-hidden="true" />
          </div>
          <InfoRow label="Data last changed">
            {integ.lastSyncAt ? `${fmtDateTime(integ.lastSyncAt)} (${timeAgo(integ.lastSyncAt)})` : "—"}
          </InfoRow>
          <InfoRow label="Failed sync jobs (24h)">
            <Chip tone={integ.failedJobs === 0 ? "green" : "red"}>{integ.failedJobs === 0 ? "0 — all clear" : `${integ.failedJobs} failed`}</Chip>
          </InfoRow>
        </div>
      </SectionCard>

      <SectionCard title="How sync works" description="No connectors to manage — the platform shares one source of truth." icon={Database}>
        <ol className="space-y-2.5 text-[12.5px] leading-relaxed text-[color:var(--ink-soft)]">
          {[
            "Everything you submit, upload or correct here is written straight to the shared platform database — there is no separate export step.",
            "The Group console reads the same records: new submissions, evidence and validation fixes appear for Group Admins within ~15 seconds.",
            "Decisions made by the Subsidiary Manager or the Group office (approvals, changes requested) flow back here just as fast — this page re-checks the connection every 30 seconds.",
          ].map((line, i) => (
            <li key={i} className="glass-subtle flex gap-3 rounded-2xl p-3.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgba(32,167,121,0.14)] text-[11px] font-bold text-[#1d6b40]">{i + 1}</span>
              {line}
            </li>
          ))}
        </ol>
      </SectionCard>
    </div>
  );
}

/* ── security tab ── */
function SecurityTab({ data }: { data: SaSettingsData }) {
  const sec = data.security;
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <SectionCard
        title="Active sessions"
        description="Your current sign-in sessions on the platform."
        icon={Laptop}
      >
        {sec.sessions.length === 0 ? (
          <InfoRow label="Sessions">No active sessions found for your account right now.</InfoRow>
        ) : (
          <div className="space-y-2">
            {sec.sessions.map((s, i) => (
              <div key={s.id} className="glass-subtle rounded-2xl p-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  {/Mobile|Android|iPhone/.test(s.userAgent) ? <Smartphone className="h-4 w-4 text-[color:var(--esg-purple)]" /> : <Laptop className="h-4 w-4 text-[color:var(--esg-blue)]" />}
                  <span className="text-[13px] font-semibold text-[color:var(--ink)]">{deviceLabel(s.userAgent)}</span>
                  {i === 0 && <Chip tone="green">Most recent</Chip>}
                  <span className="ml-auto font-mono text-[10.5px] text-[color:var(--ink-faint)]">{s.ip || "—"}</span>
                </div>
                {s.userAgent && (
                  <p className="mt-1 truncate font-mono text-[10px] text-[color:var(--ink-faint)]" title={s.userAgent}>{s.userAgent}</p>
                )}
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-[color:var(--ink-faint)]">
                  <span>Signed in {fmtDateTime(s.createdAt)}</span>
                  <span>Expires {fmtDate(s.expiresAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <div className="space-y-3">
        <SectionCard
          title="Recent authentication activity"
          description="Latest sign-in attempts and credential events for your account."
          icon={KeyRound}
        >
          {sec.recentAuth.length === 0 ? (
            <InfoRow label="Auth history">No authentication events recorded yet.</InfoRow>
          ) : (
            <div className="nice-scroll max-h-[260px] space-y-2 overflow-y-auto pr-1">
              {sec.recentAuth.map((a) => {
                const ok = a.result === "SUCCESS" || a.eventType === "LOGIN_SUCCESS" || a.eventType === "LOGOUT";
                return (
                  <div key={a.id} className="flex items-center gap-2.5 rounded-2xl px-1 py-1.5">
                    <Chip tone={ok ? "green" : a.result === "INFO" ? "blue" : "red"}>
                      {a.result || (ok ? "SUCCESS" : "FAILURE")}
                    </Chip>
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-[color:var(--ink)]">
                      {AUTH_EVENT_LABEL[a.eventType] ?? a.eventType}
                      {a.reason && <span className="text-[color:var(--ink-faint)]"> · {a.reason}</span>}
                    </span>
                    <span className="shrink-0 text-[11px] text-[color:var(--ink-faint)]">{timeAgo(a.createdAt)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        <GlassCard subtle className="flex items-start gap-2.5 p-4 text-[12.5px] leading-relaxed text-[color:var(--ink-soft)]">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--esg-blue)]" />
          <span>
            <strong className="text-[color:var(--ink)]">Password changes flow through credential recovery.</strong>{" "}
            Use &ldquo;Forgot password&rdquo; on the sign-in screen to reset your own password; to reset a user&apos;s credentials, open their record in User Management.
          </span>
        </GlassCard>
      </div>
    </div>
  );
}

/* ── screen ── */
const TABS = [
  { value: "profile", label: "Subsidiary profile", icon: OrgIcon },
  { value: "notifications", label: "Notifications", icon: BellIcon },
  { value: "reporting", label: "Reporting configuration", icon: ReportChartIcon },
  { value: "integrations", label: "Integrations", icon: DatabaseIcon },
  { value: "security", label: "Security", icon: ShieldIcon },
] as const;

type TabValue = (typeof TABS)[number]["value"];

export default function SettingsView() {
  const { params, navigate } = useSaWorkspace();
  const [tab, setTab] = React.useState<TabValue>("profile");
  const initialTab = React.useRef(String((params as { tab?: unknown }).tab ?? ""));

  const { data, loading, error, refetch } = useSaApi<SaSettingsData>("/api/sa/settings", { pollMs: 30000 });

  /* honor deep link (?tab=integrations …) then clear the param */
  React.useEffect(() => {
    const t = initialTab.current;
    if ((TABS.some((x) => x.value === t))) setTab(t as TabValue);
    if (t) navigate("settings");
  }, []);

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="Settings"
        description="Workspace configuration for your subsidiary — profile, contacts, notifications, Group-mandated reporting rules, sync health and security."
        icon={OrgIcon}
        breadcrumbs={["Subsidiary", "Configuration", "Settings"]}
      />

      <GlassTabBar tabs={TABS.map((t) => ({ value: t.value, label: t.label, icon: t.icon }))} value={tab} onChange={(v) => setTab(v as TabValue)} />

      {error && !data ? (
        <GlassCard><ErrorState message={error} onRetry={refetch} /></GlassCard>
      ) : loading && !data ? (
        <GlassCard><LoadingBlock rows={6} label="Loading workspace settings…" /></GlassCard>
      ) : !data ? null : (
        <>
          {tab === "profile" && <ProfileTab data={data} />}
          {tab === "notifications" && <NotificationsTab data={data} />}
          {tab === "reporting" && <ReportingConfigTab data={data} />}
          {tab === "integrations" && <IntegrationsTab data={data} />}
          {tab === "security" && <SecurityTab data={data} />}
        </>
      )}
    </div>
  );
}
