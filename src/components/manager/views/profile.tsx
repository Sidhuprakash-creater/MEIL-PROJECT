"use client";

// ── SUBSIDIARY MANAGER · SCREEN 11 — Profile & Preferences ──
import { useState } from "react";
import { LogOut, Monitor, ShieldCheck } from "lucide-react";
import { GearIcon } from "@/components/workspace/premium-icons";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { apiPatch, fmtDateTime, timeAgo, useMutation, useSmApi } from "@/lib/sm/client";
import type { ManagerPrefs, ProfileData } from "@/lib/sm/types";
import {
  Chip, EmptyState, ErrorState, GlassCard, InfoRow, LoadingBlock, PageHeader, SectionCard, StatusBadge,
} from "@/components/workspace/ui";
import { useSmSessionUser, useSmSignOut } from "@/components/manager/shell";

const PREF_ITEMS: { key: keyof ManagerPrefs; label: string; description: string }[] = [
  { key: "submissionAlerts", label: "New submissions", description: "Alert me when a BU or project report is submitted for review." },
  { key: "deadlineReminders", label: "Review deadline reminders", description: "Notify me as review deadlines approach and when they slip." },
  { key: "decisionCopies", label: "Copies of my decisions", description: "Send me a confirmation copy of every approval or rejection I record." },
  { key: "validationAlerts", label: "Validation & evidence alerts", description: "Flag reports with validation warnings or missing evidence in my queue." },
  { key: "weeklyDigest", label: "Weekly review digest", description: "A Monday summary of queue load, overdue reviews and corrections." },
];

const PREF_DEFAULTS: ManagerPrefs = {
  submissionAlerts: true,
  deadlineReminders: true,
  decisionCopies: true,
  validationAlerts: true,
  weeklyDigest: false,
};

export default function ProfileView() {
  const { toast } = useToast();
  const onSignOut = useSmSignOut();

  const { data, loading, error, refetch } = useSmApi<ProfileData>("/api/sm/profile", { pollMs: 30000 });
  const save = useMutation();

  /* Local edits live in an overlay over the server value — no mirror state,
     so 30s polls never clobber unsaved toggles. */
  const [overrides, setOverrides] = useState<Partial<ManagerPrefs>>({});
  const prefs: ManagerPrefs = { ...PREF_DEFAULTS, ...(data?.preferences ?? {}), ...overrides };
  const dirty = Object.keys(overrides).length > 0;

  const toggle = (key: keyof ManagerPrefs) => {
    setOverrides((o) => ({ ...o, [key]: !prefs[key] }));
  };

  const savePrefs = async () => {
    const res = await save.run(() => apiPatch<{ message: string }>("/api/sm/profile", { preferences: prefs }));
    if (res) {
      toast({ title: "Preferences saved", description: "Your notification preferences are up to date." });
      setOverrides({});
      void refetch();
    } else {
      toast({ variant: "destructive", title: "Could not save preferences", description: save.error ?? "Check your connection and try again." });
    }
  };

  if (loading && !data) return <LoadingBlock rows={6} label="Loading your profile…" />;
  if (error && !data) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  const u = data.user;
  const s = data.subsidiary;

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="Profile & Preferences"
        description="Your verified identity, review scope, notification preferences and session security. Organization administration stays with the Subsidiary Admin."
        icon={GearIcon}
      />

      {/* Identity */}
      <GlassCard className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="glass-strong glass-sheen flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl text-[16px] font-extrabold text-[color:var(--esg-blue)] shadow-md">
              {u.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[17px] font-bold text-[color:var(--ink)]">{u.name}</h2>
                <StatusBadge status={u.status} />
              </div>
              <p className="mt-0.5 text-[12.5px] text-[color:var(--ink-faint)]">
                {u.roleLabel} · {u.title || "Report verification"} · joined {fmtDateTime(u.joinedAt)}
              </p>
            </div>
          </div>
          <Button variant="outline" className="glass-subtle rounded-2xl text-[#a53b3b]" onClick={onSignOut}>
            <LogOut className="mr-1.5 h-4 w-4" /> Sign out
          </Button>
        </div>
        <div className="mt-4 grid gap-x-6 sm:grid-cols-2">
          <InfoRow label="Email">{u.email}</InfoRow>
          <InfoRow label="Employee ID"><span className="font-mono">{u.employeeId ?? "—"}</span></InfoRow>
          <InfoRow label="Role">{u.roleLabel}</InfoRow>
          <InfoRow label="Last sign-in">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : "—"}</InfoRow>
          <InfoRow label="Phone">{u.phone || "—"}</InfoRow>
          <InfoRow label="Review authority">Approve / reject reports in {s.name}</InfoRow>
        </div>
      </GlassCard>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Assigned subsidiary */}
        <SectionCard title="Assigned subsidiary" description="Server-enforced scope — every record you touch belongs here." icon={ShieldCheck}>
          <div className="px-1">
            <InfoRow label="Subsidiary">{s.name} <span className="font-mono text-[11px] text-[color:var(--ink-faint)]">({s.code})</span></InfoRow>
            <InfoRow label="Sector">{s.sector}</InfoRow>
            <InfoRow label="Region">{s.region} · {s.city}</InfoRow>
            <InfoRow label="Subsidiary Admin">{s.adminName || "—"}</InfoRow>
            <InfoRow label="Status"><StatusBadge status={s.status} /></InfoRow>
          </div>
          <p className="mt-3 rounded-2xl bg-[rgba(58,123,255,0.06)] p-3 text-[11.5px] leading-relaxed text-[color:var(--ink-soft)]">
            You cannot access another subsidiary, create BUs/projects, manage users, or alter Group reporting rules — those boundaries are enforced on every API request, not just hidden in the interface.
          </p>
        </SectionCard>

        {/* Notification preferences */}
        <SectionCard title="Notification preferences" description="What the platform alerts you about." icon={GearIcon}>
          <div className="space-y-3.5">
            {PREF_ITEMS.map((item) => (
              <div key={item.key} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-[color:var(--ink)]">{item.label}</div>
                  <p className="text-[11.5px] leading-relaxed text-[color:var(--ink-faint)]">{item.description}</p>
                </div>
                <Switch
                  checked={prefs[item.key]}
                  onCheckedChange={() => toggle(item.key)}
                  aria-label={item.label}
                />
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between gap-2 border-t border-[rgba(125,177,216,0.25)] pt-3.5">
            {dirty ? (
              <Chip tone="amber">Unsaved changes</Chip>
            ) : (
              <span className="text-[11.5px] text-[color:var(--ink-faint)]">All changes saved</span>
            )}
            <div className="flex items-center gap-2">
              {dirty && (
                <Button variant="ghost" size="sm" className="rounded-xl text-[color:var(--ink-faint)]" onClick={() => setOverrides({})}>
                  Discard
                </Button>
              )}
              <Button
                className="rounded-2xl bg-[#20a779] text-white hover:bg-[#168b65]"
                disabled={!dirty || save.pending}
                onClick={() => void savePrefs()}
              >
                Save preferences
              </Button>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Session security */}
      <SectionCard title="Session & security" description="Active sessions and recent authentication events." icon={Monitor}>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">Active sessions</div>
            <div className="space-y-1.5">
              {data.sessions.length === 0 && <EmptyState title="No active sessions" />}
              {data.sessions.map((sess) => (
                <div key={sess.id} className="glass-subtle flex items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[12.5px] font-semibold text-[color:var(--ink)]">
                      {sess.device} {sess.mostRecent && <Chip tone="green">This session</Chip>}
                    </div>
                    <div className="text-[10.5px] text-[color:var(--ink-faint)]">ip {sess.ip} · expires {fmtDateTime(sess.expiresAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">Recent sign-in activity</div>
            <div className="space-y-1.5">
              {data.recentAuth.map((a) => (
                <div key={a.id} className="glass-subtle flex items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5">
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-medium text-[color:var(--ink)]">{a.eventType.replace(/_/g, " ").toLowerCase()}</div>
                    {a.reason && <div className="text-[10.5px] text-[color:var(--ink-faint)]">{a.reason}</div>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Chip tone={a.result === "SUCCESS" ? "green" : a.result === "FAILURE" ? "red" : "blue"}>{a.result}</Chip>
                    <span className="text-[10.5px] text-[color:var(--ink-faint)]">{timeAgo(a.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
