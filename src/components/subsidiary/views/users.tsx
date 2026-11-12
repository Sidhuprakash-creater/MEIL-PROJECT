"use client";

// ── SUBSIDIARY ADMIN · SCREEN 05 — User Management ──
// Role grants are constrained to ASSIGNABLE_ROLES (server-enforced 403):
// Group Admin / Organization Manager / Subsidiary Admin are reserved to the
// Group office and are never offered in the invite / edit dialogs.
import { useEffect, useMemo, useState } from "react";
import {
  Activity as ActivityIcon,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Copy,
  KeyRound,
  Mail,
  Moon,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  ShieldCheck,
  UserCheck,
  UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSaWorkspace } from "@/lib/sa/store";
import { apiPatch, apiPost, fmtDateTime, timeAgo, useMutation, useSaApi } from "@/lib/sa/client";
import { ResetRequestsPanel } from "@/components/auth/reset-requests-panel";
import { ROLE_LABELS } from "@/lib/sa/types";
import type { ActivityRow, SubmissionRow, UserRow } from "@/lib/sa/types";
import {
  ActionButton, Avatar, Chip, Column, ConfirmDialog, DataTable, EmptyState, ErrorState, ExportButton, Field,
  GlassDialog, GlassTabBar, InfoRow, KpiCard, LoadingBlock, PageHeader, SectionCard, StatusBadge, Toolbar,
} from "@/components/workspace/ui";
import { CheckSealIcon, PeopleIcon, PulseIcon, UserPlusIcon } from "@/components/workspace/premium-icons";
import { useToast } from "@/hooks/use-toast";

const inputCls = "glass-subtle rounded-2xl border-white/60 text-sm";

type Presence = UserRow["presence"];

const PRESENCE_META: Record<Presence, { label: string; color: string }> = {
  online: { label: "Active now", color: "#20a779" },
  today: { label: "Active today", color: "#3a7bff" },
  away: { label: "Away", color: "#c57926" },
  offline: { label: "Offline", color: "#8595ab" },
};

function PresenceDot({ presence, className }: { presence: Presence; className?: string }) {
  const meta = PRESENCE_META[presence];
  return (
    <span className={`relative inline-flex h-2 w-2 shrink-0 ${className ?? ""}`} aria-label={meta.label}>
      {presence === "online" && <span className="absolute h-full w-full animate-ping rounded-full opacity-60" style={{ background: meta.color }} />}
      <span className="relative h-2 w-2 rounded-full" style={{ background: meta.color }} />
    </span>
  );
}

/* presence stat card — same pattern as the dashboard status cards */
function PresenceCard({
  icon: Icon, hue, label, hint, value, active, onClick,
}: {
  icon: React.ComponentType<{ className?: string; hue?: string }>;
  hue: string; label: string; hint: string; value: number; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={`${label}: ${value}${active ? " (filtered)" : ""}`}
      aria-pressed={active}
      className={`glass glass-sheen group relative flex flex-col gap-3 overflow-hidden rounded-[24px] p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/85 hover:shadow-[0_14px_34px_rgba(56,113,153,0.14)] ${active ? "ring-2 ring-[#20a779]/60" : ""}`}
    >
      <span className="absolute inset-x-0 top-0 h-[3px] opacity-80" style={{ background: `linear-gradient(90deg, ${hue}, ${hue}22)` }} />
      <div className="flex items-center justify-between">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-2xl text-white shadow-md"
          style={{ background: `linear-gradient(135deg, ${hue}, color-mix(in srgb, ${hue} 62%, #17263d))`, boxShadow: `0 6px 16px color-mix(in srgb, ${hue} 38%, transparent), inset 0 1px 0 rgba(255,255,255,0.4)` }}
        >
          <Icon className="h-[18px] w-[18px] text-white" />
        </span>
        <span className="text-[26px] font-bold tabular leading-none text-[color:var(--ink)]">{value}</span>
      </div>
      <div className="min-w-0">
        <div className="truncate text-[13px] font-semibold" style={{ color: hue }}>{label}</div>
        <div className="truncate text-[11px] text-[color:var(--ink-faint)]">{hint}</div>
      </div>
    </button>
  );
}

/* ────────────────────────────── invite / edit form ────────────────────────────── */

interface UserFormValues {
  name: string;
  email: string;
  googleEmail: string;
  role: string;
  title: string;
  phone: string;
  buId: string;
  projectId: string;
}

const EMPTY_USER_FORM: UserFormValues = { name: "", email: "", googleEmail: "", role: "", title: "", phone: "", buId: "", projectId: "" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function UserFormFields({
  mode,
  user,
  assignableRoles,
  buOptions,
  projectOptions,
  pending,
  onSubmit,
  onCancel,
}: {
  mode: "create" | "edit";
  user: UserRow | null;
  assignableRoles: string[];
  buOptions: { id: string; name: string }[];
  projectOptions: { id: string; name: string }[];
  pending: boolean;
  onSubmit: (values: UserFormValues) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<UserFormValues>(() =>
    mode === "edit" && user
      ? {
          name: user.name, email: user.email, googleEmail: user.googleEmail ?? "", role: user.role,
          title: user.title ?? "", phone: user.phone ?? "",
          buId: user.buId ?? "", projectId: user.projectId ?? "",
        }
      : EMPTY_USER_FORM
  );
  const [errors, setErrors] = useState<{ name?: string; email?: string; role?: string }>({});
  const set = (k: keyof UserFormValues) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    const errs: { name?: string; email?: string; role?: string } = {};
    if (mode === "create") {
      if (form.name.trim().length < 2) errs.name = "User name is required (min 2 characters).";
      if (!EMAIL_RE.test(form.email.trim())) errs.email = "A valid email address is required.";
      if (!form.role) errs.role = "Select the role to assign.";
    } else if (user && form.role && form.role !== user.role && !assignableRoles.includes(form.role)) {
      errs.role = "This role cannot be granted from a subsidiary workspace.";
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    onSubmit({ ...form, name: form.name.trim(), email: form.email.trim() });
  };

  return (
    <>
      {mode === "edit" && user && (
        <div className="glass-subtle mb-4 flex items-center gap-3 rounded-2xl p-3">
          <Avatar name={user.name} size={40} />
          <div className="min-w-0">
            <div className="truncate text-[13.5px] font-semibold text-[color:var(--ink)]">{user.name}</div>
            <div className="truncate text-[11.5px] text-[color:var(--ink-faint)]">{user.email} · {user.employeeId ?? "no employee ID"}</div>
          </div>
          <StatusBadge status={user.status} />
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {mode === "create" && (
          <>
            <Field label="Full name" required error={errors.name} htmlFor="sa-usr-name">
              <Input id="sa-usr-name" value={form.name} onChange={(e) => set("name")(e.target.value)} placeholder="e.g. Ravi Teja" className={inputCls} autoComplete="off" />
            </Field>
            <Field label="Email" required error={errors.email} htmlFor="sa-usr-email" hint="An invite will be pending until first sign-in">
              <Input id="sa-usr-email" type="email" value={form.email} onChange={(e) => set("email")(e.target.value)} placeholder="e.g. ravi.teja@meil.in" className={inputCls} autoComplete="off" />
            </Field>
          </>
        )}
        <Field
          label="Role"
          required={mode === "create"}
          error={errors.role}
          hint="Group Admin / Organization Manager / Subsidiary Admin roles are reserved to the Group office"
        >
          <Select value={form.role || undefined} onValueChange={set("role")}>
            <SelectTrigger className={`${inputCls} w-full`} aria-label="Role">
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent className="glass-strong rounded-2xl border-white/70">
              {assignableRoles.map((r) => (
                <SelectItem key={r} value={r}>{ROLE_LABELS[r] ?? r.replaceAll("_", " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Title" htmlFor="sa-usr-title">
          <Input id="sa-usr-title" value={form.title} onChange={(e) => set("title")(e.target.value)} placeholder="e.g. Senior Environment Engineer" className={inputCls} />
        </Field>
        <Field label="Phone" htmlFor="sa-usr-phone">
          <Input id="sa-usr-phone" value={form.phone} onChange={(e) => set("phone")(e.target.value)} placeholder="e.g. +91 98480 12345" className={inputCls} />
        </Field>
        <Field label="Google Sign-In Email (optional)" htmlFor="sa-usr-google-email" hint="Optional Gmail / Workspace alias for Google SSO">
          <Input id="sa-usr-google-email" type="email" value={form.googleEmail} onChange={(e) => set("googleEmail")(e.target.value)} placeholder="e.g. user@gmail.com" className={inputCls} />
        </Field>
        <Field label="Business unit" hint="Optional scope assignment">
          <Select value={form.buId || "NONE"} onValueChange={(v) => set("buId")(v === "NONE" ? "" : v)}>
            <SelectTrigger className={`${inputCls} w-full`} aria-label="Business unit">
              <SelectValue placeholder={buOptions.length === 0 ? "No business units" : "Unassigned"} />
            </SelectTrigger>
            <SelectContent className="glass-strong rounded-2xl border-white/70">
              <SelectItem value="NONE">Unassigned</SelectItem>
              {buOptions.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Project" hint="Optional scope assignment">
          <Select value={form.projectId || "NONE"} onValueChange={(v) => set("projectId")(v === "NONE" ? "" : v)}>
            <SelectTrigger className={`${inputCls} w-full`} aria-label="Project">
              <SelectValue placeholder={projectOptions.length === 0 ? "No projects" : "Unassigned"} />
            </SelectTrigger>
            <SelectContent className="glass-strong rounded-2xl border-white/70">
              <SelectItem value="NONE">Unassigned</SelectItem>
              {projectOptions.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" className="glass-subtle rounded-2xl" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <ActionButton pending={pending} onClick={submit} className="btn-action">
          {mode === "create" ? "Send invite" : "Save changes"}
        </ActionButton>
      </div>
    </>
  );
}

/* ────────────────────────────── one-time credential dialog ────────────────────────────── */

function TempPasswordDialog({
  data,
  onClose,
}: {
  data: { userName: string; password: string; note: string } | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [prevData, setPrevData] = useState(data);
  if (data !== prevData) {
    setPrevData(data);
    setCopied(false);
  }
  const copy = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.password);
      setCopied(true);
      toast({ title: "Copied", description: "Temporary password copied to the clipboard." });
    } catch {
      toast({ title: "Copy failed", description: "Select the password and copy it manually.", variant: "destructive" });
    }
  };
  return (
    <GlassDialog
      open={!!data}
      onOpenChange={(o) => !o && onClose()}
      title="Temporary credential generated"
      description={data ? `For ${data.userName}. Share it through your secure channel.` : undefined}
    >
      {data && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-2xl border border-[rgba(197,121,38,0.4)] bg-[rgba(197,121,38,0.08)] p-3 text-[12.5px] font-medium text-[#9c5d1b]">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            This password is shown only once. Store it now — it cannot be retrieved again.
          </div>
          <div className="glass-subtle flex items-center justify-between gap-3 rounded-2xl p-3">
            <code className="select-all font-mono text-[15px] font-bold tracking-wider text-[color:var(--ink)]">{data.password}</code>
            <Button variant="outline" size="sm" className="glass-subtle shrink-0 rounded-2xl border-white/60" onClick={() => void copy()}>
              <Copy className="mr-1.5 h-3.5 w-3.5" /> {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="text-xs text-[color:var(--ink-faint)]">{data.note}</p>
        </div>
      )}
    </GlassDialog>
  );
}

/* ────────────────────────────── detail dialog ────────────────────────────── */

interface UserDetailData {
  user: UserRow;
  tasks: { id: string; ref: string; title: string; category: string; priority: string; status: string; dueDate: string }[];
  submissions: SubmissionRow[];
  activity: ActivityRow[];
  sessions: { id: string; userAgent: string; ip: string; createdAt: string; expiresAt: string }[];
  lastLogins: { eventType: string; result: string; createdAt: string; ip: string }[];
}

type UserTab = "overview" | "tasks" | "submissions" | "activity" | "security";

function UserDetailDialog({
  userId,
  onClose,
  onEdit,
}: {
  userId: string | null;
  onClose: () => void;
  onEdit: (u: UserRow) => void;
}) {
  const [tab, setTab] = useState<UserTab>("overview");
  const { data, loading, error, refetch } = useSaApi<UserDetailData>(
    userId ? `/api/sa/users/${userId}` : null,
    { pollMs: 0 }
  );
  /* reset to the overview tab whenever the dialog targets a different user */
  const [prevUserId, setPrevUserId] = useState(userId);
  if (userId !== prevUserId) {
    setPrevUserId(userId);
    if (userId) setTab("overview");
  }

  const u = data?.user;
  const tabs: { value: UserTab; label: string; icon: React.ComponentType<{ className?: string }>; count?: number }[] = [
    { value: "overview", label: "Overview", icon: ClipboardList },
    { value: "tasks", label: "Assigned tasks", icon: CheckCircle2, count: data?.tasks.length },
    { value: "submissions", label: "Submissions", icon: ClipboardList, count: data?.submissions.length },
    { value: "activity", label: "Activity", icon: ActivityIcon },
    { value: "security", label: "Security", icon: ShieldCheck },
  ];

  return (
    <GlassDialog
      open={!!userId}
      onOpenChange={(o) => !o && onClose()}
      wide
      title={u ? u.name : "User details"}
      description={u ? `${u.roleLabel} · ${u.email}` : "Loading detail…"}
    >
      {error && <ErrorState message={error} onRetry={refetch} />}
      {!error && loading && !data && <LoadingBlock rows={5} label="Loading user…" />}
      {data && u && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Avatar name={u.name} size={42} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-bold text-[color:var(--ink)]">{u.name}</div>
              <div className="flex items-center gap-1.5 text-[11.5px] text-[color:var(--ink-faint)]">
                <PresenceDot presence={u.presence} />
                {PRESENCE_META[u.presence].label}{u.lastActiveAt ? ` · ${timeAgo(u.lastActiveAt)}` : ""}
              </div>
            </div>
            <StatusBadge status={u.status} />
            <Button variant="ghost" size="sm" className="h-8 rounded-xl text-xs" onClick={() => onEdit(u)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
            </Button>
          </div>

          <GlassTabBar tabs={tabs} value={tab} onChange={(v) => setTab(v as UserTab)} />

          {tab === "overview" && (
            <div className="grid gap-4 xl:grid-cols-2">
              <SectionCard title="Profile" description="Account and scope" icon={PeopleIcon}>
                <div className="divide-y divide-[rgba(125,177,216,0.16)]">
                  <InfoRow label="Employee ID"><Chip tone="blue">{u.employeeId ?? "—"}</Chip></InfoRow>
                  <InfoRow label="Email"><span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5 text-[color:var(--ink-faint)]" />{u.email}</span></InfoRow>
                  <InfoRow label="Role">{u.roleLabel}</InfoRow>
                  <InfoRow label="Title">{u.title || "—"}</InfoRow>
                  <InfoRow label="Phone">{u.phone ? <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5 text-[color:var(--ink-faint)]" />{u.phone}</span> : "—"}</InfoRow>
                  <InfoRow label="Business unit">{u.buName || "—"}</InfoRow>
                  <InfoRow label="Project">{u.projectName || "—"}</InfoRow>
                  <InfoRow label="Status"><StatusBadge status={u.status} /></InfoRow>
                </div>
              </SectionCard>
              <SectionCard title="Presence & workload" description="Live status and reporting load" icon={PulseIcon}>
                <div className="space-y-3">
                  <div className="glass-subtle flex items-center justify-between rounded-2xl p-3">
                    <span className="flex items-center gap-2 text-[13px] font-medium text-[color:var(--ink-soft)]">
                      <PresenceDot presence={u.presence} /> {PRESENCE_META[u.presence].label}
                    </span>
                    <span className="text-[11.5px] text-[color:var(--ink-faint)]">Last active {timeAgo(u.lastActiveAt)}</span>
                  </div>
                  <div className="divide-y divide-[rgba(125,177,216,0.16)]">
                    <InfoRow label="Assigned tasks">{u.taskCount}</InfoRow>
                    <InfoRow label="Submissions submitted">{u.submissionCount}</InfoRow>
                    <InfoRow label="Last sign-in">{u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : "never"}</InfoRow>
                  </div>
                </div>
              </SectionCard>
            </div>
          )}

          {tab === "tasks" && (
            <div className="nice-scroll max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {data.tasks.length === 0 && <EmptyState title="No assigned tasks" message="Tasks assigned to this user will appear here." />}
              {data.tasks.map((t) => (
                <div key={t.id} className="glass-subtle flex items-center justify-between gap-3 rounded-2xl p-3">
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-[color:var(--ink)]">{t.title}</span>
                    <span className="block truncate text-[11px] text-[color:var(--ink-faint)]">{t.ref} · {t.category} · due {fmtDateTime(t.dueDate)}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Chip tone={t.priority === "HIGH" || t.priority === "CRITICAL" ? "red" : t.priority === "MEDIUM" ? "amber" : "gray"}>{t.priority}</Chip>
                    <StatusBadge status={t.status} />
                  </span>
                </div>
              ))}
            </div>
          )}

          {tab === "submissions" && (
            <div className="nice-scroll max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {data.submissions.length === 0 && <EmptyState title="No submissions" message="Records submitted by this user will appear here." />}
              {data.submissions.map((s) => (
                <button key={s.id} onClick={() => useSaWorkspace.getState().navigate("submissions", { ref: s.ref })} className="glass-subtle flex w-full items-center justify-between gap-3 rounded-2xl p-3 text-left transition-colors hover:bg-white/80">
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-[color:var(--ink)]">{s.title}</span>
                    <span className="block truncate text-[11px] text-[color:var(--ink-faint)]">{s.ref} · {s.period} · {s.level === "PROJECT" ? s.projectName : s.buName}</span>
                  </span>
                  <StatusBadge status={s.status} />
                </button>
              ))}
            </div>
          )}

          {tab === "activity" && (
            <SectionCard title="Recent activity" description="Actions performed by this user" icon={ActivityIcon}>
              {data.activity.length === 0 ? (
                <EmptyState title="No activity yet" message="Actions performed by this user will appear here." />
              ) : (
                <div className="space-y-2">
                  {data.activity.map((a) => (
                    <div key={a.id} className="flex items-start gap-2.5 rounded-2xl px-2 py-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: a.severity === "WARNING" ? "#c57926" : a.severity === "CRITICAL" ? "#c34a4a" : "#3a7bff" }} />
                      <div className="min-w-0">
                        <div className="truncate text-[12px] text-[color:var(--ink)]">
                          {a.action.replace(/_/g, " ").toLowerCase()} {a.targetLabel && <span className="text-[color:var(--ink-soft)]">— {a.targetLabel}</span>}
                        </div>
                        <div className="text-[10.5px] text-[color:var(--ink-faint)]">{timeAgo(a.createdAt)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          )}

          {tab === "security" && (
            <div className="grid gap-4 xl:grid-cols-2">
              <SectionCard title="Active sessions" description="Signed-in devices (revoked on suspend / reset)" icon={ShieldCheck}>
                {data.sessions.length === 0 ? (
                  <EmptyState title="No active sessions" message="This user has no live sessions right now." />
                ) : (
                  <div className="nice-scroll max-h-[260px] space-y-2 overflow-y-auto pr-1">
                    {data.sessions.map((s) => (
                      <div key={s.id} className="glass-subtle rounded-2xl p-3">
                        <div className="truncate text-[12.5px] font-semibold text-[color:var(--ink)]">{s.userAgent || "Unknown device"}</div>
                        <div className="mt-0.5 text-[11px] text-[color:var(--ink-faint)]">
                          {s.ip || "ip hidden"} · started {timeAgo(s.createdAt)} · expires {fmtDateTime(s.expiresAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
              <SectionCard title="Last logins" description="Authentication audit trail" icon={KeyRound}>
                {data.lastLogins.length === 0 ? (
                  <EmptyState title="No auth records" message="Sign-in attempts will appear here." />
                ) : (
                  <div className="nice-scroll max-h-[260px] space-y-2 overflow-y-auto pr-1">
                    {data.lastLogins.map((l, i) => (
                      <div key={`${l.createdAt}-${i}`} className="flex items-center justify-between gap-3 rounded-2xl px-2 py-2">
                        <span className="min-w-0">
                          <span className="block truncate text-[12.5px] font-medium text-[color:var(--ink)]">{l.eventType.replaceAll("_", " ").toLowerCase()}</span>
                          <span className="block truncate text-[11px] text-[color:var(--ink-faint)]">{l.ip || "ip hidden"} · {fmtDateTime(l.createdAt)}</span>
                        </span>
                        <Chip tone={l.result === "SUCCESS" ? "green" : "red"}>{l.result}</Chip>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>
          )}
        </div>
      )}
    </GlassDialog>
  );
}

/* ────────────────────────────── mobile card ────────────────────────────── */

function UserMobileCard({ r, onOpen }: { r: UserRow; onOpen: () => void }) {
  const assigned = r.buName || r.projectName;
  return (
    <button onClick={onOpen} className="glass glass-sheen glass-lift block w-full rounded-3xl p-3.5 text-left">
      <div className="flex items-start gap-3">
        <Avatar name={r.name} size={40} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-semibold text-[color:var(--ink)]">{r.name}</div>
          <div className="truncate text-[11px] text-[color:var(--ink-faint)]">{r.email}</div>
        </div>
        <StatusBadge status={r.status} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Chip tone="blue">{r.roleLabel}</Chip>
        {assigned ? (
          <Chip tone="gray">{r.buName ?? "—"} · {r.projectName ?? "—"}</Chip>
        ) : (
          <Chip tone="amber">Unassigned</Chip>
        )}
        <Chip tone="gray"><PresenceDot presence={r.presence} />{PRESENCE_META[r.presence].label}</Chip>
      </div>
    </button>
  );
}

/* ────────────────────────────── main view ────────────────────────────── */

export default function UsersView() {
  const { params, navigate } = useSaWorkspace();
  const { toast } = useToast();
  const { data, loading, error, refetch } = useSaApi<{ users: UserRow[]; total: number; roles: string[]; assignableRoles: string[] }>(
    "/api/sa/users?pageSize=50"
  );
  const { data: unitsRes } = useSaApi<{ units: { id: string; name: string }[] }>("/api/sa/units?pageSize=50", { pollMs: 0 });
  const { data: projectsRes } = useSaApi<{ projects: { id: string; name: string }[] }>("/api/sa/projects?pageSize=50", { pollMs: 0 });

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState(() => (typeof params.role === "string" ? params.role : "ALL"));
  const [statusFilter, setStatusFilter] = useState(() => (typeof params.statusFilter === "string" ? params.statusFilter : "ALL"));
  const [presenceFilter, setPresenceFilter] = useState<"ALL" | Presence>("ALL");
  const [formOpen, setFormOpen] = useState(() => !!params.create);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [detailId, setDetailId] = useState<string | null>(() => (typeof params.detailId === "string" && params.detailId ? params.detailId : null));
  const [confirmTarget, setConfirmTarget] = useState<{ user: UserRow; action: "suspend" | "activate" | "deactivate" | "reset-credential" } | null>(null);
  const [tempPwd, setTempPwd] = useState<{ userName: string; password: string; note: string } | null>(null);

  const saveMut = useMutation<{ user?: UserRow; tempPassword?: string; emailSent?: boolean }>();
  const actionMut = useMutation<{ ok?: boolean; tempPassword?: string; note?: string }>();

  /* deep-link params: create / detailId / role / statusFilter — seeded on mount
     via the lazy initializers above, re-applied here when params change while
     the view is already mounted (React derived-state adjustment), then cleared. */
  const [prevParams, setPrevParams] = useState(params);
  if (params !== prevParams) {
    setPrevParams(params);
    if (params.create) setFormOpen(true);
    if (typeof params.detailId === "string" && params.detailId) setDetailId(params.detailId);
    if (typeof params.role === "string" && params.role) setRoleFilter(params.role);
    if (typeof params.statusFilter === "string" && params.statusFilter) setStatusFilter(params.statusFilter);
  }
  useEffect(() => {
    if (params.create || (typeof params.detailId === "string" && params.detailId) || (typeof params.role === "string" && params.role) || (typeof params.statusFilter === "string" && params.statusFilter)) navigate("users");
  }, [params, navigate]);

  useEffect(() => {
    if (saveMut.error) toast({ title: formMode === "create" ? "Invite failed" : "Update failed", description: saveMut.error, variant: "destructive" });
  }, [saveMut.error, formMode, toast]);
  useEffect(() => {
    if (actionMut.error) toast({ title: "Action refused", description: actionMut.error, variant: "destructive" });
  }, [actionMut.error, toast]);

  const users = useMemo(() => data?.users ?? [], [data]);
  const assignableRoles = useMemo(() => data?.assignableRoles ?? [], [data]);
  const buOptions = useMemo(() => (unitsRes?.units ?? []).map((u) => ({ id: u.id, name: u.name })), [unitsRes]);
  const projectOptions = useMemo(() => (projectsRes?.projects ?? []).map((p) => ({ id: p.id, name: p.name })), [projectsRes]);
  const roleOptions = useMemo(() => Array.from(new Set(users.map((u) => u.role))).sort(), [users]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((r) => {
      if (roleFilter !== "ALL" && r.role !== roleFilter) return false;
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (presenceFilter !== "ALL" && r.presence !== presenceFilter) return false;
      if (q && !`${r.name} ${r.email} ${r.employeeId ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [users, search, roleFilter, statusFilter, presenceFilter]);

  const kpis = useMemo(
    () => ({
      total: data?.total ?? users.length,
      active: users.filter((u) => u.status === "ACTIVE").length,
      online: users.filter((u) => u.presence === "online").length,
      invited: users.filter((u) => u.status === "INVITED").length,
    }),
    [data, users]
  );

  const presenceCounts = useMemo(
    () => ({
      online: users.filter((u) => u.presence === "online").length,
      today: users.filter((u) => u.presence === "today").length,
      away: users.filter((u) => u.presence === "away").length,
      offline: users.filter((u) => u.presence === "offline").length,
    }),
    [users]
  );

  const clearFilters = () => {
    setSearch("");
    setRoleFilter("ALL");
    setStatusFilter("ALL");
    setPresenceFilter("ALL");
  };

  const openCreate = () => {
    setFormMode("create");
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (u: UserRow) => {
    setFormMode("edit");
    setEditing(u);
    setFormOpen(true);
  };

  const submitForm = async (values: UserFormValues) => {
    if (formMode === "create") {
      const res = await saveMut.run(() =>
        apiPost("/api/sa/users", {
          name: values.name,
          email: values.email,
          googleEmail: values.googleEmail.trim().toLowerCase() || undefined,
          role: values.role,
          title: values.title.trim(),
          phone: values.phone.trim(),
          buId: values.buId || undefined,
          projectId: values.projectId || undefined,
        })
      );
      if (res) {
        if (res.tempPassword) {
          setTempPwd({
            userName: values.name,
            password: res.tempPassword,
            note: res.emailSent
              ? "Temporary password emailed via Resend and shown once here. User must update it on first sign-in."
              : "Temporary password created — share it securely. User must update it on first sign-in.",
          });
        }
        toast({ title: "Invite sent", description: `${values.name} was created as INVITED — activation pending first sign-in.` });
        setFormOpen(false);
        refetch();
      }
    } else if (editing) {
      const res = await saveMut.run(() =>
        apiPatch(`/api/sa/users/${editing.id}`, {
          title: values.title.trim(),
          phone: values.phone.trim(),
          googleEmail: values.googleEmail.trim().toLowerCase() || null,
          role: values.role,
          buId: values.buId || null,
          projectId: values.projectId || null,
        })
      );
      if (res) {
        toast({ title: "User updated", description: `${editing.name}'s profile was saved.` });
        setFormOpen(false);
        setEditing(null);
        refetch();
      }
    }
  };

  const runUserAction = async () => {
    if (!confirmTarget) return;
    const { user, action } = confirmTarget;
    const res = await actionMut.run(() =>
      apiPost(`/api/sa/users/${user.id}/actions`, { action })
    );
    if (res) {
      if (action === "reset-credential" && res.tempPassword) {
        setTempPwd({ userName: user.name, password: res.tempPassword, note: res.note ?? "The user must change this password after signing in." });
        toast({ title: "Credential reset", description: `A temporary password was generated for ${user.name}.` });
      } else {
        const labels: Record<string, string> = { suspend: "suspended", activate: "reactivated", deactivate: "deactivated" };
        toast({ title: `User ${labels[action] ?? action}`, description: `${user.name}'s account was updated.` });
      }
      setConfirmTarget(null);
      refetch();
    }
  };

  const columns: Column<UserRow>[] = [
    {
      key: "name",
      header: "User",
      sortable: true,
      sortValue: (r) => r.name,
      render: (r) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={r.name} size={34} />
          <div className="min-w-0">
            <div className="truncate font-semibold text-[color:var(--ink)]">{r.name}</div>
            <div className="truncate text-[11px] text-[color:var(--ink-faint)]">{r.email}</div>
          </div>
        </div>
      ),
    },
    { key: "employeeId", header: "Employee ID", sortable: true, sortValue: (r) => r.employeeId ?? "", render: (r) => <span className="tabular">{r.employeeId ?? "—"}</span> },
    { key: "role", header: "Role", sortable: true, sortValue: (r) => r.roleLabel, render: (r) => r.roleLabel },
    {
      key: "assignment",
      header: "Assignment",
      render: (r) =>
        r.buName || r.projectName ? (
          <span className="text-[12.5px]">{r.buName ?? "—"}{r.projectName ? <span className="text-[color:var(--ink-faint)]"> · {r.projectName}</span> : null}</span>
        ) : (
          <Chip tone="amber">Unassigned</Chip>
        ),
    },
    { key: "status", header: "Status", sortable: true, sortValue: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "presence",
      header: "Presence",
      render: (r) => (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <PresenceDot presence={r.presence} />
          <span className="text-[12px]">{PRESENCE_META[r.presence].label}</span>
        </span>
      ),
    },
    { key: "lastActive", header: "Last active", sortable: true, sortValue: (r) => r.lastActiveAt ?? "", render: (r) => <span className="whitespace-nowrap text-[12px]">{timeAgo(r.lastActiveAt)}</span> },
  ];

  const exportRows = rows.map((r) => ({
    employee_id: r.employeeId ?? "",
    name: r.name,
    email: r.email,
    role: r.roleLabel,
    title: r.title,
    phone: r.phone,
    business_unit: r.buName ?? "",
    project: r.projectName ?? "",
    status: r.status,
    presence: PRESENCE_META[r.presence].label,
    last_active: r.lastActiveAt ?? "",
    tasks: r.taskCount,
    submissions: r.submissionCount,
  }));

  const formDialog = (
    <GlassDialog
      open={formOpen}
      onOpenChange={(o) => {
        setFormOpen(o);
        if (!o) setEditing(null);
      }}
      wide
      title={formMode === "create" ? "Invite user" : `Edit ${editing?.name ?? "user"}`}
      description={
        formMode === "create"
          ? "Creates an INVITED account — the user activates it on first sign-in. Roles are limited to what a subsidiary workspace may grant."
          : "Update profile, role and scope assignment. Role changes on your own account are rejected by the server."
      }
    >
      {formOpen && (
        <UserFormFields
          key={formMode === "edit" ? editing?.id ?? "edit" : "create"}
          mode={formMode}
          user={editing}
          assignableRoles={assignableRoles}
          buOptions={buOptions}
          projectOptions={projectOptions}
          pending={saveMut.pending}
          onSubmit={submitForm}
          onCancel={() => {
            setFormOpen(false);
            setEditing(null);
          }}
        />
      )}
    </GlassDialog>
  );

  const detailTarget = confirmTarget;
  const confirmDialog = (
    <ConfirmDialog
      open={!!confirmTarget}
      onOpenChange={(o) => !o && setConfirmTarget(null)}
      title={
        detailTarget?.action === "reset-credential"
          ? "Reset credential"
          : detailTarget?.action === "suspend"
            ? "Suspend account"
            : detailTarget?.action === "activate"
              ? "Reactivate account"
              : "Deactivate account"
      }
      message={
        !detailTarget
          ? ""
          : detailTarget.action === "reset-credential"
            ? `Generate a one-time temporary password for ${detailTarget.user.name}? All active sessions will be revoked and the current password invalidated.`
            : detailTarget.action === "suspend"
              ? `Suspend ${detailTarget.user.name}'s account? Sign-in is blocked and active sessions are revoked. You can reactivate the account later.`
              : detailTarget.action === "activate"
                ? `Reactivate ${detailTarget.user.name}'s account? Sign-in is allowed again with existing credentials.`
                : `Deactivate ${detailTarget.user.name}'s account? The user is disabled for reporting but history is preserved.`
      }
      confirmLabel={confirmTarget?.action === "reset-credential" ? "Reset credential" : confirmTarget?.action === "suspend" ? "Suspend" : confirmTarget?.action === "activate" ? "Reactivate" : "Deactivate"}
      destructive={confirmTarget?.action === "suspend" || confirmTarget?.action === "reset-credential" || confirmTarget?.action === "deactivate"}
      pending={actionMut.pending}
      onConfirm={() => void runUserAction()}
    />
  );

  const detailDialog = (
    <UserDetailDialog
      userId={detailId}
      onClose={() => setDetailId(null)}
      onEdit={(u) => {
        setDetailId(null);
        openEdit(u);
      }}
    />
  );

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="User Management"
        description="Directory of your subsidiary's users with roles, scope, live presence and account controls. Approvals and Group-office roles stay out of reach."
        icon={PeopleIcon}
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard label="Total users" value={kpis.total} icon={PeopleIcon} tone="blue" hint="In your subsidiary" onClick={clearFilters} />
        <KpiCard label="Active" value={kpis.active} icon={CheckSealIcon} tone="green" hint="Activated accounts" />
        <KpiCard label="Online now" value={kpis.online} icon={PulseIcon} tone="teal" hint="Active in the last 30 min" onClick={() => setPresenceFilter("online")} />
        <KpiCard label="Invited" value={kpis.invited} icon={UserPlusIcon} tone="purple" hint="Awaiting first sign-in" onClick={() => setStatusFilter("INVITED")} />
      </div>

      {/* presence strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <PresenceCard icon={PulseIcon} hue="#20a779" label="Active now" hint="Last 30 minutes" value={presenceCounts.online} active={presenceFilter === "online"} onClick={() => setPresenceFilter(presenceFilter === "online" ? "ALL" : "online")} />
        <PresenceCard icon={CheckSealIcon} hue="#3a7bff" label="Active today" hint="Last 12 hours" value={presenceCounts.today} active={presenceFilter === "today"} onClick={() => setPresenceFilter(presenceFilter === "today" ? "ALL" : "today")} />
        <PresenceCard icon={CalendarClock} hue="#c57926" label="Away" hint="12–36 hours" value={presenceCounts.away} active={presenceFilter === "away"} onClick={() => setPresenceFilter(presenceFilter === "away" ? "ALL" : "away")} />
        <PresenceCard icon={Moon} hue="#8595ab" label="Offline" hint="Over 36 hours" value={presenceCounts.offline} active={presenceFilter === "offline"} onClick={() => setPresenceFilter(presenceFilter === "offline" ? "ALL" : "offline")} />
      </div>

      <ResetRequestsPanel onUpdated={refetch} />

      <DataTable<UserRow>
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        onRetry={refetch}
        pageSize={8}
        onRowClick={(r) => setDetailId(r.id)}
        emptyTitle={users.length === 0 ? "No users yet" : "No users match your filters"}
        emptyMessage={users.length === 0 ? "Invite your first subsidiary user to get started." : "Try adjusting the search, role, status or presence filter."}
        emptyAction={
          users.length === 0 ? (
            <Button className="btn-action rounded-2xl" onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" /> Invite User
            </Button>
          ) : undefined
        }
        toolbar={
          <Toolbar
            search={search}
            onSearch={setSearch}
            searchPlaceholder="Search name, email, employee ID…"
            filters={[
              {
                key: "role",
                label: "Role",
                value: roleFilter,
                onChange: setRoleFilter,
                options: [{ value: "ALL", label: "All roles" }, ...roleOptions.map((r) => ({ value: r, label: ROLE_LABELS[r] ?? r.replaceAll("_", " ") }))],
              },
              {
                key: "status",
                label: "Status",
                value: statusFilter,
                onChange: setStatusFilter,
                options: [
                  { value: "ALL", label: "All statuses" },
                  { value: "ACTIVE", label: "Active" },
                  { value: "INVITED", label: "Invited" },
                  { value: "SUSPENDED", label: "Suspended" },
                  { value: "INACTIVE", label: "Inactive" },
                ],
              },
            ]}
            onReset={clearFilters}
            resultCount={rows.length}
            right={
              <div className="flex items-center gap-2">
                <ExportButton filename="subsidiary-users" rows={exportRows} />
                <Button className="btn-action rounded-2xl" onClick={openCreate}>
                  <Plus className="mr-1.5 h-4 w-4" /> Invite User
                </Button>
              </div>
            }
          />
        }
        mobileCard={(r) => <UserMobileCard r={r} onOpen={() => setDetailId(r.id)} />}
        rowActions={(row) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" aria-label={`Actions for ${row.name}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass-strong rounded-2xl border-white/70">
              <DropdownMenuItem onClick={() => setDetailId(row.id)}>
                <ClipboardList className="mr-2 h-3.5 w-3.5" /> View details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openEdit(row)}>
                <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {row.status === "ACTIVE" && (
                <DropdownMenuItem onClick={() => setConfirmTarget({ user: row, action: "suspend" })} className="text-[#c57926] focus:text-[#c57926]">
                  <UserX className="mr-2 h-3.5 w-3.5" /> Suspend
                </DropdownMenuItem>
              )}
              {(row.status === "SUSPENDED" || row.status === "INACTIVE" || row.status === "INVITED") && (
                <DropdownMenuItem onClick={() => setConfirmTarget({ user: row, action: "activate" })}>
                  <UserCheck className="mr-2 h-3.5 w-3.5" /> {row.status === "SUSPENDED" ? "Reactivate" : "Activate"}
                </DropdownMenuItem>
              )}
              {(row.status === "ACTIVE" || row.status === "INVITED") && (
                <DropdownMenuItem onClick={() => setConfirmTarget({ user: row, action: "deactivate" })} className="text-[#c57926] focus:text-[#c57926]">
                  <Moon className="mr-2 h-3.5 w-3.5" /> Deactivate
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setConfirmTarget({ user: row, action: "reset-credential" })} className="text-[#c34a4a] focus:text-[#c34a4a]">
                <KeyRound className="mr-2 h-3.5 w-3.5" /> Reset credential
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      {formDialog}
      {confirmDialog}
      {detailDialog}
      <TempPasswordDialog data={tempPwd} onClose={() => setTempPwd(null)} />
    </div>
  );
}
