"use client";

// ── SCREEN 18 — Settings & Configuration ──
import * as React from "react";
import {
  Bell,
  CalendarClock,
  Calculator,
  Database,
  Download,
  FileCog,
  HardDrive,
  Lock,
  Mail,
  Server,
  Settings as SettingsIcon,
  ShieldAlert,
  Workflow,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { apiPatch, fmtDateTime, useApi } from "@/lib/esg/client";
import type { AppSetting } from "@/lib/esg/types";
import { useToast } from "@/hooks/use-toast";
import { Chip, EmptyState, ErrorState, GlassCard, LoadingBlock, PageHeader, SectionCard, GlassTabBar } from "../ui";

type SettingRow = AppSetting & { parsed: unknown };
type Integrations = Record<string, string>;

const CATEGORY_ORDER = ["REPORTING", "REMINDERS", "WORKFLOW", "CALCULATION", "INTEGRATIONS", "SECURITY", "EXPORTS"];
const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  REPORTING: FileCog,
  REMINDERS: Bell,
  WORKFLOW: Workflow,
  CALCULATION: Calculator,
  INTEGRATIONS: Server,
  SECURITY: Lock,
  EXPORTS: Download,
};

function extractValue(s: SettingRow): unknown {
  const p: unknown = s.parsed;
  if (p && typeof p === "object" && "value" in (p as Record<string, unknown>)) {
    return (p as Record<string, unknown>).value;
  }
  return p ?? s.svalue;
}

function extractOptions(s: SettingRow): string[] {
  try {
    const v: unknown = JSON.parse(s.options);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function integrationTone(text: string): { tone: "green" | "blue" | "amber" | "gray" | "teal"; label: string } {
  if (text.toLowerCase().startsWith("not configured")) return { tone: "amber", label: "Not configured" };
  if (text.toLowerCase().includes("local")) return { tone: "gray", label: "Local (demo)" };
  if (text.toLowerCase().includes("in-process") || text.toLowerCase().includes("manual")) return { tone: "blue", label: "In-process" };
  return { tone: "teal", label: "Configured" };
}

function SettingRowCard({
  s,
  busy,
  saved,
  onSave,
}: {
  s: SettingRow;
  busy: boolean;
  saved: boolean;
  onSave: (skey: string, value: unknown) => void;
}) {
  const value = extractValue(s);
  const [text, setText] = React.useState(() => (typeof value === "string" ? value : value === undefined || value === null ? "" : String(value)));
  React.useEffect(() => {
    setText(typeof value === "string" ? value : value === undefined || value === null ? "" : String(value));
  }, [s.skey, s.updatedAt]);

  const commitText = () => {
    if (s.vtype === "number") {
      const n = Number(text);
      if (text.trim() === "" || Number.isNaN(n)) return;
      if (n === value) return;
      onSave(s.skey, n);
    } else {
      if (text === value) return;
      onSave(s.skey, text);
    }
  };

  return (
    <GlassCard subtle className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold text-[color:var(--ink)]">{s.label}</span>
          <Chip tone="gray">{s.category.toLowerCase()}</Chip>
          <span className="font-mono text-[10px] text-[color:var(--ink-faint)]">{s.skey}</span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-[color:var(--ink-faint)]">
          <span>Updated {fmtDateTime(s.updatedAt)}</span>
          {saved && (
            <span className="inline-flex items-center gap-1 font-medium text-[#1d6b40]" role="status">
              · Saved
            </span>
          )}
          {busy && <span className="font-medium text-[#9c5d1b]">Saving…</span>}
        </div>
      </div>
      <div className="flex w-full max-w-xs items-center justify-end sm:w-auto">
        {s.vtype === "toggle" && (
          <Switch checked={value === true} onCheckedChange={(v) => onSave(s.skey, v)} disabled={busy} aria-label={s.label} />
        )}
        {s.vtype === "number" && (
          <Input
            type="number"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commitText}
            onKeyDown={(e) => e.key === "Enter" && commitText()}
            disabled={busy}
            className="glass-subtle w-28 rounded-2xl border-white/60"
            aria-label={s.label}
          />
        )}
        {s.vtype === "text" && (
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commitText}
            onKeyDown={(e) => e.key === "Enter" && commitText()}
            disabled={busy}
            className="glass-subtle w-64 rounded-2xl border-white/60"
            aria-label={s.label}
          />
        )}
        {s.vtype === "select" && (
          <Select value={String(value)} onValueChange={(v) => onSave(s.skey, v)} disabled={busy}>
            <SelectTrigger className="glass-subtle w-64 rounded-2xl border-white/60" aria-label={s.label}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="glass-strong rounded-2xl border-white/70">
              {extractOptions(s).map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </GlassCard>
  );
}

export default function SettingsView() {
  const { toast } = useToast();
  const { data, loading, error, refetch } = useApi<{ settings: SettingRow[]; integrations: Integrations }>("/api/esg/settings");
  const [rows, setRows] = React.useState<SettingRow[] | null>(null);
  const [tab, setTab] = React.useState("REPORTING");
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const [savedKey, setSavedKey] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (data?.settings) setRows(data.settings);
  }, [data]);

  const categories = React.useMemo(() => {
    const present = new Set((rows ?? []).map((r) => r.category));
    return CATEGORY_ORDER.filter((c) => present.has(c));
  }, [rows]);

  React.useEffect(() => {
    if (categories.length && !categories.includes(tab)) setTab(categories[0]);
  }, [categories, tab]);

  const save = async (skey: string, value: unknown) => {
    setBusyKey(skey);
    try {
      const res = await apiPatch<{ setting: AppSetting; message: string }>("/api/esg/settings", { skey, value });
      const updated: SettingRow = { ...res.setting, parsed: { value } };
      setRows((prev) => (prev ? prev.map((r) => (r.skey === skey ? updated : r)) : prev));
      setSavedKey(skey);
      setTimeout(() => setSavedKey((k) => (k === skey ? null : k)), 3500);
      toast({ title: "Setting saved", description: res.message });
    } catch (e) {
      toast({ variant: "destructive", title: "Could not save setting", description: e instanceof Error ? e.message : "Unexpected error." });
    } finally {
      setBusyKey(null);
    }
  };

  const integrations: Integrations = data?.integrations ?? {};
  const integrationMeta: { key: string; label: string; icon: React.ComponentType<{ className?: string }>; description: string }[] = [
    { key: "emailProvider", label: "Email delivery", icon: Mail, description: "Outbound email for reminders and notifications." },
    { key: "objectStorage", label: "Object storage", icon: HardDrive, description: "Evidence file storage backend." },
    { key: "scheduler", label: "Scheduler", icon: CalendarClock, description: "Automated reminders and overdue recompute." },
    { key: "database", label: "Database", icon: Database, description: "Primary datastore for the workspace." },
  ];

  const visibleRows = (rows ?? []).filter((r) => r.category === tab);
  const sessionTimeout = (rows ?? []).find((r) => r.skey === "session_timeout_min");
  const auditRetention = (rows ?? []).find((r) => r.skey === "audit_retention_years");

  return (
    <div className="view-in space-y-5">
      <PageHeader
        title="Settings & Configuration"
        description="Reporting periods, reminders, workflow, calculation factors, integrations, security, and export behavior."
        icon={SettingsIcon}
        breadcrumbs={["Group", "Insights & Governance", "Settings"]}
      />

      <GlassTabBar
        value={tab}
        onChange={setTab}
        tabs={categories.map((c) => {
          const Icon = CATEGORY_ICONS[c] ?? SettingsIcon;
          return { value: c, label: c.charAt(0) + c.slice(1).toLowerCase(), icon: Icon, count: (rows ?? []).filter((r) => r.category === c).length };
        })}
      />

      {error ? (
        <GlassCard>
          <ErrorState message={error} onRetry={() => refetch()} />
        </GlassCard>
      ) : loading && !rows ? (
        <GlassCard>
          <LoadingBlock rows={6} label="Loading configuration…" />
        </GlassCard>
      ) : !rows ? null : (
        <>
          {tab !== "INTEGRATIONS" ? (
            <SectionCard
              title={`${tab.charAt(0) + tab.slice(1).toLowerCase()} settings`}
              description="Changes are applied immediately and recorded in the audit trail."
              icon={CATEGORY_ICONS[tab] ?? SettingsIcon}
            >
              {visibleRows.length === 0 ? (
                <EmptyState title="No settings in this category" />
              ) : (
                <div className="flex flex-col gap-3">
                  {visibleRows.map((s) => (
                    <SettingRowCard key={s.skey} s={s} busy={busyKey === s.skey} saved={savedKey === s.skey} onSave={(k, v) => void save(k, v)} />
                  ))}
                </div>
              )}

              {tab === "SECURITY" && (
                <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-[rgba(58,123,255,0.25)] bg-[rgba(58,123,255,0.06)] p-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[rgba(58,123,255,0.12)]">
                    <Lock className="h-5 w-5 text-[#3a7bff]" />
                  </span>
                  <div className="min-w-0 flex-1 text-[13px] text-[color:var(--ink-soft)]">
                    <strong className="text-[color:var(--ink)]">Session security summary:</strong> sessions expire after{" "}
                    <strong>{sessionTimeout ? String(extractValue(sessionTimeout)) : "—"} minutes</strong> of inactivity; audit records are retained for{" "}
                    <strong>{auditRetention ? String(extractValue(auditRetention)) : "—"} years</strong> in the append-only trail.
                  </div>
                </div>
              )}
            </SectionCard>
          ) : (
            <div className="space-y-4">
              <SectionCard title="Integrations" description="External systems connected to this workspace. This demo runs fully in-app." icon={Server}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {integrationMeta.map((m) => {
                    const text = integrations[m.key] ?? "Not configured";
                    const { tone, label } = integrationTone(text);
                    const Icon = m.icon;
                    return (
                      <GlassCard key={m.key} className="flex flex-col gap-2 p-4">
                        <div className="flex items-center gap-2.5">
                          <span className="glass-subtle flex h-9 w-9 items-center justify-center rounded-xl">
                            <Icon className="h-4.5 w-4.5 text-[color:var(--esg-blue)]" />
                          </span>
                          <span className="text-[13px] font-semibold text-[color:var(--ink)]">{m.label}</span>
                          <Chip tone={tone} className="ml-auto">
                            {label}
                          </Chip>
                        </div>
                        <p className="text-[13px] text-[color:var(--ink-soft)]">{text}</p>
                        <p className="text-xs text-[color:var(--ink-faint)]">{m.description}</p>
                      </GlassCard>
                    );
                  })}
                </div>
              </SectionCard>
              <SectionCard title="Integration settings" description="Editable integration-related configuration." icon={SettingsIcon}>
                {visibleRows.length === 0 ? (
                  <EmptyState title="No integration settings" />
                ) : (
                  <div className="flex flex-col gap-3">
                    {visibleRows.map((s) => (
                      <SettingRowCard key={s.skey} s={s} busy={busyKey === s.skey} saved={savedKey === s.skey} onSave={(k, v) => void save(k, v)} />
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>
          )}

          {/* Danger zone — honest, disabled */}
          <SectionCard
            title="Danger zone"
            description="Irreversible dataset operations."
            icon={ShieldAlert}
            className="border-[rgba(195,74,74,0.35)]"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[13px] font-semibold text-[color:var(--ink)]">Reset demo dataset</div>
                <p className="text-xs leading-relaxed text-[color:var(--ink-soft)]">
                  Wipes all subsidiaries, users, submissions, and reports and reseeds the demo data. Disabled here on purpose — no destructive reset is exposed through the API in this demo environment.
                </p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="shrink-0">
                    <Button variant="destructive" className="rounded-2xl" disabled aria-disabled="true">
                      <ShieldAlert className="mr-1.5 h-4 w-4" /> Reset demo dataset
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-56 rounded-xl border-white/70 bg-white/95 text-center text-[color:var(--ink)] shadow-lg backdrop-blur">
                  <span className="text-xs">Available via prisma/seed.ts re-run in this demo environment</span>
                </TooltipContent>
              </Tooltip>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}
