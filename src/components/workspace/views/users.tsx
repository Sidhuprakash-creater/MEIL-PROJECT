"use client";

// ── SCREEN 07 — All Users (People & Access) ──
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  Eye,
  History,
  KeyRound,
  ListChecks,
  Mail,
  Moon,
  MoreHorizontal,
  Pencil,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserCog,
  UserPlus,
  Users as UsersIcon,
  UserX,
} from "lucide-react";
import { Ring } from '@/components/ring'
import { ResetRequestsPanel } from "@/components/auth/reset-requests-panel";
import { TempPasswordModal } from "@/components/auth/password-recovery-modals";
import { CreateUserDialog } from "@/components/workspace/create-user-dialog";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ROLE_LABELS,
  USER_STATUSES,
  type Submission,
  type Task,
  type User,
} from "@/lib/esg/types";
import { apiDelete, apiPatch, apiPost, fmtDate, timeAgo, toCsv, useApi, useMutation, downloadFile } from "@/lib/esg/client";
import { useWorkspace } from "@/lib/esg/store";
import {
  ActionButton,
  Avatar,
  Chip,
  ConfirmDialog,
  CountUp,
  DataTable,
  EmptyState,
  Field,
  GlassCard,
  GlassDialog,
  GlassTabBar,
  InfoRow,
  LoadingBlock,
  PageHeader,
  SectionCard,
  StatusBadge,
  Toolbar,
  ExportButton,
  type Column,
} from "@/components/workspace/ui";

const STATUS_OPTIONS = ["ALL", ...USER_STATUSES];

const ROLE_KEYS = Object.keys(ROLE_LABELS);

function roleLabel(r: string) {
  return ROLE_LABELS[r] ?? r.replaceAll("_", " ");
}

function catLabel(c: string) {
  if (c === "CSR") return "CSR";
  return c.charAt(0) + c.slice(1).toLowerCase().replaceAll("_", " ");
}

/* ── Live presence (derived from lastActiveAt + account status) ── */

type Presence = "now" | "today" | "away" | "offline" | "invited" | "suspended";

type PresenceFilter = "ALL" | "now" | "today" | "away";

function presenceOf(u: User): Presence {
  if (u.status === "INVITED") return "invited";
  if (u.status === "SUSPENDED") return "suspended";
  if (u.status === "INACTIVE") return "offline";
  if (!u.lastActiveAt) return "offline";
  const mins = (Date.now() - new Date(u.lastActiveAt).getTime()) / 60000;
  if (mins < 30) return "now";
  if (mins < 720) return "today";
  if (mins < 2160) return "away";
  return "offline";
}

function isRecentJoin(joinedAt?: string | null): boolean {
  if (!joinedAt) return false;
  const t = new Date(joinedAt).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < 48 * 3600 * 1000;
}

const PRESENCE_META: Record<Presence, { label: string; color: string; text: string; live?: boolean }> = {
  now: { label: "Active now", color: "#238653", text: "#1d6b44", live: true },
  today: { label: "Active today", color: "#16a3a3", text: "#0f7c7c", live: true },
  away: { label: "Away", color: "#c57926", text: "#a3661d" },
  offline: { label: "Offline", color: "#8595ab", text: "#66778d" },
  invited: { label: "Invited", color: "#6a5bff", text: "#5546cc" },
  suspended: { label: "Suspended", color: "#c34a4a", text: "#a53b3b" },
};

function PresenceDot({ presence, size = 10 }: { presence: Presence; size?: number }) {
  const meta = PRESENCE_META[presence];
  return (
    <span className="relative inline-flex" style={{ width: size, height: size }} title={meta.label}>
      {meta.live && <span className="absolute inset-0 animate-ping rounded-full opacity-60" style={{ backgroundColor: meta.color }} />}
      <span
        className="relative inline-block rounded-full border-2 border-white shadow-sm"
        style={{ width: size, height: size, backgroundColor: meta.color }}
        aria-hidden="true"
      />
      <span className="sr-only">{meta.label}</span>
    </span>
  );
}

function PresenceStatCard({
  hue,
  icon,
  label,
  hint,
  value,
  selected,
  onClick,
  ariaLabel,
}: {
  hue: string;
  icon: ReactNode;
  label: string;
  hint: string;
  value: number;
  selected: boolean;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={selected}
      className={cn(
        "glass glass-sheen rounded-[24px] p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/85 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(58,123,255,0.45)]",
        selected && "border-[rgba(58,123,255,0.55)] ring-2 ring-[rgba(58,123,255,0.35)]"
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] text-white"
          style={{
            background: `linear-gradient(150deg, ${hue} 20%, color-mix(in srgb, ${hue} 72%, #17263D) 100%)`,
            boxShadow: `0 4px 10px ${hue}44, inset 0 1px 0 rgba(255,255,255,0.4)`,
          }}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <CountUp value={value} className="tabular block text-[26px] font-semibold leading-none tracking-tight text-[color:var(--ink)]" />
          <div className="mt-1.5 truncate text-[10.5px] font-semibold uppercase tracking-[0.14em]" style={{ color: hue }}>
            {label}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-[color:var(--ink-faint)]">{hint}</div>
        </div>
      </div>
    </button>
  );
}

function csvUserRow(u: User): Record<string, unknown> {
  return {
    Name: u.name,
    Email: u.email,
    Role: roleLabel(u.role),
    Status: u.status,
    Presence: PRESENCE_META[presenceOf(u)].label,
    Subsidiary: u.subsidiaryName ?? "",
    BusinessUnit: u.businessUnitName ?? "",
    Project: u.projectName ?? "",
    Title: u.title,
    Phone: u.phone,
    Joined: u.joinedAt ? fmtDate(u.joinedAt) : "",
    LastActive: u.lastActiveAt ? fmtDate(u.lastActiveAt) : "",
    OpenTasks: u.openTasks ?? 0,
  };
}

type OrgDialogMode = "invite" | "edit" | "org";

interface UserFormState {
  name: string;
  email: string;
  googleEmail: string;
  role: string;
  title: string;
  phone: string;
  subsidiaryId: string;
  businessUnitId: string;
  projectId: string;
}

const emptyForm: UserFormState = {
  name: "",
  email: "",
  googleEmail: "",
  role: "",
  title: "",
  phone: "",
  subsidiaryId: "ALL",
  businessUnitId: "ALL",
  projectId: "ALL",
};

interface UserDossier {
  user?: User & { employeeId?: string | null; googleEmail?: string | null; authProvider?: string };
  sessions?: { id: string; ipAddress: string | null; userAgent: string | null; expiresAt: string; createdAt: string }[];
  lastLogins?: { id: string; actor: string; summary: string; createdAt: string }[];
}

function DetailPage({ userId }: { userId: string }) {
  const { navigate } = useWorkspace();
  const { toast } = useToast();
  const usersApi = useApi<{ users: User[] }>("/api/esg/users");
  const dossierApi = useApi<UserDossier>(`/api/esg/users/${userId}`);
  const subsApi = useApi<{ subsidiaries: { id: string; name: string }[] }>("/api/esg/org?type=subsidiaries&light=1");
  const unitsApi = useApi<{ businessUnits: { id: string; name: string; subsidiaryId: string }[] }>("/api/esg/org?type=business-units");
  const projectsApi = useApi<{ projects: { id: string; name: string; businessUnitId: string }[] }>("/api/esg/org?type=projects");
  const submissionsApi = useApi<{ submissions: Submission[] }>("/api/esg/submissions");
  const tasksApi = useApi<{ tasks: Task[] }>("/api/esg/tasks");

  const user = useMemo(() => usersApi.data?.users.find((u) => u.id === userId) ?? dossierApi.data?.user ?? null, [usersApi.data, dossierApi.data, userId]);
  const mySubmissions = useMemo(
    () => (submissionsApi.data?.submissions ?? []).filter((s) => s.submittedById === userId),
    [submissionsApi.data, userId]
  );
  const myTasks = useMemo(
    () => (tasksApi.data?.tasks ?? []).filter((t) => t.assigneeType === "USER" && t.assigneeLabel && user && t.assigneeLabel.toLowerCase().includes(user.name.toLowerCase())),
    [tasksApi.data, user]
  );
  const activity = useMemo(
    () =>
      mySubmissions
        .flatMap((s) => s.history.map((h) => ({ ...h, ref: s.ref, title: s.title })))
        .filter((h) => h.actor === (user?.name ?? ""))
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
    [mySubmissions, user]
  );

  const [tab, setTab] = useState("overview");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<UserFormState>(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<null | "suspend" | "reactivate" | "reset" | "deactivate" | "delete">(null);
  const [tempPwd, setTempPwd] = useState<{ userName: string; password: string; note: string } | null>(null);

  const mut = useMutation();

  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name,
      email: user.email,
      googleEmail: user.googleEmail ?? "",
      role: user.role,
      title: user.title ?? "",
      phone: user.phone ?? "",
      subsidiaryId: user.subsidiaryId ?? "ALL",
      businessUnitId: user.businessUnitId ?? "ALL",
      projectId: user.projectId ?? "ALL",
    });
  }, [user]);

  const openEdit = () => {
    if (!user) return;
    setFormErrors({});
    setDialogOpen(true);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (form.name.trim().length < 2) e.name = "Name must be at least 2 characters.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) e.email = "A valid email address is required.";
    if (!form.role) e.role = "Select a role.";
    setFormErrors(e);
    return Object.keys(e).length === 0;
  };

  const saveUser = async () => {
    if (!user || !validate()) return;
    const res = await mut.run(() =>
      apiPatch("/api/esg/users", {
        id: user.id,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        googleEmail: form.googleEmail.trim().toLowerCase() || null,
        role: form.role,
        title: form.title,
        phone: form.phone,
        subsidiaryId: form.subsidiaryId === "ALL" ? "" : form.subsidiaryId,
        businessUnitId: form.businessUnitId === "ALL" ? "" : form.businessUnitId,
        projectId: form.projectId === "ALL" ? "" : form.projectId,
      })
    );
    if (res) {
      toast({ title: "User updated", description: `${form.name.trim()} was saved successfully.` });
      setDialogOpen(false);
      void usersApi.refetch();
      void dossierApi.refetch();
    } else {
      toast({ title: "Update failed", description: mut.error ?? "Server rejected the change.", variant: "destructive" });
    }
  };

  const statusAction = async (action: "suspend" | "reactivate" | "reset-credentials" | "deactivate" | "delete", reason?: string) => {
    if (!user) return;
    setConfirm(null);
    let res: unknown = null;
    if (action === "delete") {
      res = await mut.run(() => apiDelete("/api/esg/users", { id: user.id, action: "delete", reason }));
      if (res) {
        toast({ title: "User permanently deleted", description: `${user.name} has been removed from the directory.` });
        navigate("users");
        return;
      }
    } else if (action === "deactivate") {
      res = await mut.run(() => apiDelete("/api/esg/users", { id: user.id, action: "deactivate", reason }));
    } else {
      res = await mut.run(() => apiPatch("/api/esg/users", { id: user.id, action, reason }));
    }
    const r = res as { message?: string; tempPassword?: string; emailSent?: boolean } | null;
    if (res) {
      if (action === "reset-credentials" && r?.tempPassword) {
        setTempPwd({
          userName: user.name,
          password: r.tempPassword,
          note: r.emailSent
            ? "Temporary password and reset instructions emailed to the user."
            : "Temporary password generated and all sessions revoked. Share securely — user must update it on next login.",
        });
      }
      toast({
        title: action === "reset-credentials" ? "Credentials reset" : action === "reactivate" ? "User reactivated" : action === "suspend" ? "User suspended" : "User deactivated",
        description: r?.message ?? `${user.name} — status updated.`,
      });
      void usersApi.refetch();
      void dossierApi.refetch();
    } else {
      toast({ title: "Action failed", description: mut.error ?? "Server rejected the action.", variant: "destructive" });
    }
  };

  if (usersApi.loading) {
    return (
      <div className="view-in space-y-5">
        <GlassCard><LoadingBlock rows={6} label="Loading user profile…" /></GlassCard>
      </div>
    );
  }
  if (usersApi.error) {
    return (
      <div className="view-in space-y-5">
        <GlassCard><EmptyState title="Could not load user" message={usersApi.error} action={<Button variant="outline" className="glass-subtle rounded-2xl" onClick={() => void usersApi.refetch()}>Try again</Button>} /></GlassCard>
      </div>
    );
  }
  if (!user) {
    return (
      <div className="view-in space-y-5">
        <GlassCard>
          <EmptyState
            title="User not found"
            message="This account may have been removed or the link is stale."
            action={<Button className="rounded-2xl" onClick={() => navigate("users")}>Back to All Users</Button>}
          />
        </GlassCard>
      </div>
    );
  }

  const stats = user.submissionStats ?? { total: 0, approved: 0, pending: 0, overdue: 0 };
  const detailPresence = presenceOf(user);
  const detailPresenceMeta = PRESENCE_META[detailPresence];
  const isGroupAdmin = user.role === "GROUP_ADMIN";
  const buOptions = (unitsApi.data?.businessUnits ?? []).filter((b) => form.subsidiaryId === "ALL" || b.subsidiaryId === form.subsidiaryId);
  const projectOptions = (projectsApi.data?.projects ?? []).filter((p) => form.businessUnitId === "ALL" || p.businessUnitId === form.businessUnitId);

  return (
    <div className="view-in space-y-5">
      {/* Detail header */}
      <div>
        <Button variant="ghost" size="sm" className="mb-3 -ml-2 rounded-2xl text-[color:var(--ink-soft)]" onClick={() => navigate("users")}>
          ← Back to All Users
        </Button>
        <GlassCard className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <Avatar name={user.name} size={56} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-xl font-semibold tracking-tight text-[color:var(--ink)]">{user.name}</h1>
                  <StatusBadge status={user.status} />
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                    style={{ borderColor: detailPresenceMeta.color + "59", background: detailPresenceMeta.color + "1a", color: detailPresenceMeta.text }}
                  >
                    <PresenceDot presence={detailPresence} size={8} />
                    {detailPresenceMeta.label}
                    <span className="font-medium opacity-75">· {user.lastActiveAt ? timeAgo(user.lastActiveAt) : "Never"}</span>
                  </span>
                </div>
                <p className="mt-0.5 truncate text-sm text-[color:var(--muted-foreground)]">{user.title || "No title set"}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-[color:var(--ink-faint)]">
                  <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{user.email}</span>
                  <Chip tone="blue">{roleLabel(user.role)}</Chip>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <ActionButton pending={mut.pending} onClick={openEdit}>
                <UserCog className="mr-1.5 h-4 w-4" /> Edit profile
              </ActionButton>
            </div>
          </div>
        </GlassCard>
      </div>

      <GlassTabBar
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "overview", label: "Overview", icon: Eye },
          { value: "org", label: "Organization Access", icon: Building2 },
          { value: "tasks", label: "Assigned Tasks", icon: ListChecks },
          { value: "submissions", label: "Submissions", icon: ClipboardList },
          { value: "activity", label: "Activity", icon: History },
          { value: "security", label: "Security", icon: ShieldCheck },
        ]}
      />

      {tab === "overview" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <SectionCard title="Profile" icon={UserCog}>
            <div className="divide-y divide-[rgba(125,177,216,0.18)]">
              <InfoRow label="Email">{user.email}</InfoRow>
              <InfoRow label="Phone">{user.phone || "—"}</InfoRow>
              <InfoRow label="Title">{user.title || "—"}</InfoRow>
              <InfoRow label="Role">{roleLabel(user.role)}</InfoRow>
              <InfoRow label="Joined">{fmtDate(user.joinedAt)}</InfoRow>
              <InfoRow label="Last active">{timeAgo(user.lastActiveAt)}</InfoRow>
            </div>
          </SectionCard>
          <SectionCard title="Submission performance" icon={ClipboardList} description="All submissions attributed to this user.">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Total", value: stats.total, cls: "text-[color:var(--ink)]" },
                { label: "Approved", value: stats.approved, cls: "text-[#1d6b40]" },
                { label: "Pending review", value: stats.pending, cls: "text-[#9c5d1b]" },
                { label: "Overdue", value: stats.overdue, cls: "text-[#a53b3b]" },
              ].map((s) => (
                <div key={s.label} className="glass-subtle rounded-2xl p-3 text-center">
                  <div className={cn("tabular text-2xl font-semibold", s.cls)}>{s.value}</div>
                  <div className="mt-0.5 text-[11px] font-medium text-[color:var(--ink-faint)]">{s.label}</div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {tab === "org" && (
        <SectionCard
          title="Organization Access"
          icon={Building2}
          description="Where this user sits in the Group → Subsidiary → BU → Project hierarchy."
          actions={<Button variant="outline" size="sm" className="glass-subtle rounded-2xl border-white/60" onClick={openEdit}>Edit assignments</Button>}
        >
          <div className="divide-y divide-[rgba(125,177,216,0.18)]">
            <InfoRow label="Subsidiary">{user.subsidiaryName ?? "Group level"}</InfoRow>
            <InfoRow label="Business unit">{user.businessUnitName ?? "—"}</InfoRow>
            <InfoRow label="Project / Site">{user.projectName ?? "—"}</InfoRow>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            <Chip tone="gray">Group</Chip>
            {user.subsidiaryName && <ArrowUpRight className="h-3 w-3 text-[color:var(--ink-faint)]" />}
            {user.subsidiaryName && <Chip tone="blue">{user.subsidiaryName}</Chip>}
            {user.businessUnitName && <ArrowUpRight className="h-3 w-3 text-[color:var(--ink-faint)]" />}
            {user.businessUnitName && <Chip tone="teal">{user.businessUnitName}</Chip>}
            {user.projectName && <ArrowUpRight className="h-3 w-3 text-[color:var(--ink-faint)]" />}
            {user.projectName && <Chip tone="purple">{user.projectName}</Chip>}
          </div>
        </SectionCard>
      )}

      {tab === "tasks" && (
        <SectionCard title="Assigned Tasks" icon={ListChecks} description="Direct user-level task assignments." noPad>
          {tasksApi.loading ? (
            <LoadingBlock rows={3} />
          ) : myTasks.length === 0 ? (
            <EmptyState
              title="No direct task assignments"
              message="Tasks assigned to this user's role, business unit, or subsidiary are not listed here. See Tasks & Deadlines for the full register."
              action={<Button variant="outline" className="glass-subtle rounded-2xl" onClick={() => navigate("tasks")}>Open Tasks & Deadlines</Button>}
            />
          ) : (
            <div className="nice-scroll max-h-96 overflow-y-auto divide-y divide-[rgba(125,177,216,0.18)]">
              {myTasks.map((t) => (
                <button key={t.id} className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left hover:bg-[rgba(58,123,255,0.05)]" onClick={() => openTaskDetail(t.id)}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-[color:var(--ink-faint)]">{t.ref}</span>
                      <StatusBadge status={t.status} />
                    </div>
                    <div className="truncate text-sm font-medium text-[color:var(--ink)]">{t.title}</div>
                  </div>
                  <div className="shrink-0 text-right text-xs text-[color:var(--ink-faint)]">Due {fmtDate(t.dueDate)}</div>
                </button>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {tab === "submissions" && (
        <SectionCard title="Submissions" icon={ClipboardList} description="Data submissions attributed to this user." noPad>
          {submissionsApi.loading ? (
            <LoadingBlock rows={4} />
          ) : mySubmissions.length === 0 ? (
            <EmptyState title="No submissions yet" message="This user has not submitted any ESG data records." />
          ) : (
            <div className="nice-scroll max-h-96 overflow-y-auto divide-y divide-[rgba(125,177,216,0.18)]">
              {mySubmissions.map((s) => (
                <button key={s.id} className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left hover:bg-[rgba(58,123,255,0.05)]" onClick={() => openSubmissionDetail(s.id)}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-[color:var(--ink-faint)]">{s.ref}</span>
                      <StatusBadge status={s.status} />
                      {s.overdue && <Chip tone="red">Overdue</Chip>}
                    </div>
                    <div className="truncate text-sm font-medium text-[color:var(--ink)]">{s.title}</div>
                  </div>
                  <div className="shrink-0 text-right text-xs text-[color:var(--ink-faint)]">
                    {s.metricValue ? <span className="tabular font-medium text-[color:var(--ink-soft)]">{s.metricValue.toLocaleString("en-IN")} {s.metricUnit}</span> : null}
                    <div>Due {fmtDate(s.dueDate)}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {tab === "activity" && (
        <SectionCard title="Activity" icon={History} description="Workflow events recorded on this user's submissions." noPad>
          {activity.length === 0 ? (
            <EmptyState
              title="No recorded activity"
              message="No workflow actions by this user appear in submission history. See the organization-wide activity monitor."
              action={<Button variant="outline" className="glass-subtle rounded-2xl" onClick={() => navigate("activity")}>Open Activity Monitor</Button>}
            />
          ) : (
            <div className="nice-scroll max-h-96 overflow-y-auto p-5">
              <ol className="relative space-y-4 border-l border-[rgba(125,177,216,0.35)] pl-5">
                {activity.map((h, i) => (
                  <li key={`${h.ref}-${i}`} className="relative">
                    <span className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full bg-[#3a7bff] ring-4 ring-white/60" />
                    <div className="text-sm font-medium text-[color:var(--ink)]">{h.action}</div>
                    <div className="mt-0.5 text-xs text-[color:var(--ink-faint)]">
                      {h.ref} · {h.title} · {timeAgo(h.at)} ({fmtDate(h.at)})
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </SectionCard>
      )}

      {tab === "security" && (
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <SectionCard title="Account Security & SSO" icon={ShieldCheck} description="Authentication method, status, and recovery controls for this account.">
              <div className="divide-y divide-[rgba(125,177,216,0.18)]">
                <InfoRow label="Account status"><StatusBadge status={user.status} /></InfoRow>
                <InfoRow label="Employee ID"><span className="tabular font-medium">{user.employeeId ?? "—"}</span></InfoRow>
                <InfoRow label="Auth provider">{user.authProvider ?? "CREDENTIALS"}</InfoRow>
                <InfoRow label="Google Sign-In Email">{user.googleEmail || "Not linked"}</InfoRow>
                <InfoRow label="Password rotation">{user.mustChangePassword ? "Required on next login" : "Up to date"}</InfoRow>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="glass-subtle rounded-2xl border-white/60"
                  disabled={isGroupAdmin || mut.pending || user.status === "SUSPENDED"}
                  onClick={() => setConfirm("suspend")}
                >
                  <ShieldOff className="mr-1.5 h-4 w-4" /> Suspend
                </Button>
                <Button
                  variant="outline"
                  className="glass-subtle rounded-2xl border-white/60"
                  disabled={mut.pending || (user.status !== "SUSPENDED" && user.status !== "INACTIVE")}
                  onClick={() => setConfirm("reactivate")}
                >
                  <ShieldCheck className="mr-1.5 h-4 w-4" /> Reactivate
                </Button>
                <Button variant="outline" className="glass-subtle rounded-2xl border-white/60" disabled={mut.pending} onClick={() => setConfirm("reset")}>
                  <KeyRound className="mr-1.5 h-4 w-4" /> Reset credentials
                </Button>
                <Button variant="destructive" className="rounded-2xl" disabled={isGroupAdmin || mut.pending} onClick={() => setConfirm("deactivate")}>
                  <ShieldAlert className="mr-1.5 h-4 w-4" /> Deactivate
                </Button>
                <Button variant="destructive" className="rounded-2xl bg-rose-600 hover:bg-rose-700 text-white" disabled={isGroupAdmin || mut.pending} onClick={() => setConfirm("delete")}>
                  <Trash2 className="mr-1.5 h-4 w-4" /> Delete account
                </Button>
                {isGroupAdmin && <p className="mt-1 w-full text-xs text-[color:var(--ink-faint)]">The Group Admin account cannot be suspended, deactivated, or deleted.</p>}
              </div>
            </SectionCard>
            <SectionCard title="Active Sessions" icon={ShieldAlert} description={`${(dossierApi.data?.sessions ?? []).length} live session(s)`}>
              {(dossierApi.data?.sessions ?? []).length === 0 ? (
                <p className="text-xs text-[color:var(--ink-faint)]">No active sessions right now.</p>
              ) : (
                <div className="space-y-2">
                  {(dossierApi.data?.sessions ?? []).map((s) => (
                    <div key={s.id} className="glass-subtle rounded-xl p-2.5 text-xs">
                      <div className="font-medium text-[color:var(--ink)]">{s.ipAddress ?? "Unknown IP"} · started {timeAgo(s.createdAt)}</div>
                      <div className="truncate text-[11px] text-[color:var(--ink-faint)]">{s.userAgent ?? "Browser session"} · expires {fmtDate(s.expiresAt)}</div>
                    </div>
                  ))}
                </div>
              )}
              <Button variant="outline" className="glass-subtle mt-4 rounded-2xl border-white/60" onClick={() => navigate("audit")}>
                <ShieldAlert className="mr-1.5 h-4 w-4" /> Open Audit Logs
              </Button>
            </SectionCard>
          </div>
          <SectionCard title="Recent Login & Security History" icon={History} description="Last recorded sign-ins and credential events.">
            {(dossierApi.data?.lastLogins ?? []).length === 0 ? (
              <p className="text-xs text-[color:var(--ink-faint)]">No recent authentication events recorded for this account.</p>
            ) : (
              <div className="divide-y divide-[rgba(125,177,216,0.18)]">
                {(dossierApi.data?.lastLogins ?? []).map((l) => (
                  <div key={l.id} className="flex items-center justify-between gap-3 py-2 text-xs">
                    <span className="text-[color:var(--ink)]">{l.summary}</span>
                    <span className="shrink-0 text-[color:var(--ink-faint)]">{timeAgo(l.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* Edit dialog */}
      <GlassDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={`Edit ${user.name}`}
        description="Update profile fields and organization assignments."
        wide
        footer={
          <>
            <Button variant="outline" className="glass-subtle rounded-2xl" onClick={() => setDialogOpen(false)} disabled={mut.pending}>Cancel</Button>
            <ActionButton pending={mut.pending} onClick={saveUser}>Save changes</ActionButton>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required error={formErrors.name}>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="glass-subtle rounded-2xl border-white/60" />
          </Field>
          <Field label="Email" required error={formErrors.email} hint="Used as login identifier and for notifications.">
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="glass-subtle rounded-2xl border-white/60" type="email" />
          </Field>
          <Field label="Role" required error={formErrors.role}>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
              <SelectTrigger className="glass-subtle rounded-2xl border-white/60"><SelectValue placeholder="Select role" /></SelectTrigger>
              <SelectContent className="glass-strong rounded-2xl border-white/70">
                {ROLE_KEYS.map((r) => (
                  <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Title">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="glass-subtle rounded-2xl border-white/60" placeholder="e.g. EHS Lead" />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="glass-subtle rounded-2xl border-white/60" placeholder="+91…" />
          </Field>
          <Field label="Google Sign-In Email (optional)" hint="Optional Gmail / Workspace alias for Google SSO">
            <Input value={form.googleEmail} onChange={(e) => setForm({ ...form, googleEmail: e.target.value })} className="glass-subtle rounded-2xl border-white/60" placeholder="user@gmail.com" type="email" />
          </Field>
          <Field label="Subsidiary">
            <Select value={form.subsidiaryId} onValueChange={(v) => setForm({ ...form, subsidiaryId: v, businessUnitId: "ALL", projectId: "ALL" })}>
              <SelectTrigger className="glass-subtle rounded-2xl border-white/60"><SelectValue placeholder="Select subsidiary" /></SelectTrigger>
              <SelectContent className="glass-strong rounded-2xl border-white/70">
                <SelectItem value="ALL">Group level (none)</SelectItem>
                {(subsApi.data?.subsidiaries ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Business unit" hint="Filtered by selected subsidiary.">
            <Select value={form.businessUnitId} onValueChange={(v) => setForm({ ...form, businessUnitId: v, projectId: "ALL" })}>
              <SelectTrigger className="glass-subtle rounded-2xl border-white/60"><SelectValue placeholder="Select business unit" /></SelectTrigger>
              <SelectContent className="glass-strong rounded-2xl border-white/70">
                <SelectItem value="ALL">None</SelectItem>
                {buOptions.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Project / Site" hint="Filtered by selected business unit.">
            <Select value={form.projectId} onValueChange={(v) => setForm({ ...form, projectId: v })}>
              <SelectTrigger className="glass-subtle rounded-2xl border-white/60"><SelectValue placeholder="Select project" /></SelectTrigger>
              <SelectContent className="glass-strong rounded-2xl border-white/70">
                <SelectItem value="ALL">None</SelectItem>
                {projectOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </GlassDialog>

      {/* Status confirms */}
      <ConfirmDialog
        open={confirm === "suspend"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Suspend ${user.name}?`}
        message="The account will be suspended immediately. The user cannot sign in or submit data until reactivated. This action is recorded in the audit log."
        confirmLabel="Suspend account"
        requireReason
        pending={mut.pending}
        onConfirm={(reason) => void statusAction("suspend", reason)}
      />
      <ConfirmDialog
        open={confirm === "reactivate"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Reactivate ${user.name}?`}
        message="Access will be restored with the user's current role and organization assignments."
        confirmLabel="Reactivate"
        pending={mut.pending}
        onConfirm={() => void statusAction("reactivate")}
      />
      <ConfirmDialog
        open={confirm === "reset"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Reset credentials for ${user.name}?`}
        message="A secure credential reset will be initiated and reset instructions queued for the user."
        confirmLabel="Initiate reset"
        pending={mut.pending}
        onConfirm={() => void statusAction("reset-credentials")}
      />
      <ConfirmDialog
        open={confirm === "deactivate"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Deactivate ${user.name}?`}
        message="The account is deactivated rather than deleted so report attribution and audit history are preserved. This is the recommended offboarding path."
        confirmLabel="Deactivate"
        destructive
        requireReason
        pending={mut.pending}
        onConfirm={(reason) => void statusAction("deactivate", reason)}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Permanently delete ${user.name}?`}
        message="This will completely remove the user account from the workspace and delete all active sessions. This action cannot be undone."
        confirmLabel="Permanently delete user"
        destructive
        requireReason
        pending={mut.pending}
        onConfirm={(reason) => void statusAction("delete", reason)}
      />
      <TempPasswordModal data={tempPwd} onClose={() => setTempPwd(null)} />
    </div>
  );

  function openSubmissionDetail(id: string) {
    navigate("submissions", { detailId: id });
  }
  function openTaskDetail(id: string) {
    navigate("tasks", { detailId: id });
  }
}

export default function UsersView() {
  const { params, navigate, openDetail } = useWorkspace();
  const { toast } = useToast();
  const detailId = typeof params.detailId === "string" ? params.detailId : undefined;
  const autoCreate = typeof params.create === "string" || typeof params.create === "number" ? true : false;

  const usersApi = useApi<{ users: User[] }>("/api/esg/users");
  const subsApi = useApi<{ subsidiaries: { id: string; name: string }[] }>("/api/esg/org?type=subsidiaries&light=1");
  const unitsApi = useApi<{ businessUnits: { id: string; name: string; subsidiaryId: string }[] }>("/api/esg/org?type=business-units");
  const projectsApi = useApi<{ projects: { id: string; name: string; businessUnitId: string }[] }>("/api/esg/org?type=projects");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [subFilter, setSubFilter] = useState("ALL");
  const [tasksFilter, setTasksFilter] = useState("ALL");
  const [presenceFilter, setPresenceFilter] = useState<PresenceFilter>("ALL");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Auto-open the create/invite dialog when navigated with params.create.
  const [createOpen, setCreateOpen] = useState(autoCreate);
  const [dialogMode, setDialogMode] = useState<OrgDialogMode | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserFormState>(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [roleDialogUser, setRoleDialogUser] = useState<User | null>(null);
  const [rolePick, setRolePick] = useState("");
  const [confirmAction, setConfirmAction] = useState<null | { kind: "suspend" | "reactivate" | "reset" | "deactivate" | "delete"; user: User }>(null);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [tempPwd, setTempPwd] = useState<{ userName: string; password: string; note: string } | null>(null);

  const createMut = useMutation();
  const editMut = useMutation();
  const roleMut = useMutation();
  const statusMut = useMutation();
  const bulkMut = useMutation();

  const users = usersApi.data?.users ?? [];

  const presenceCounts = useMemo(() => {
    let now = 0;
    let today = 0;
    let away = 0;
    for (const u of users) {
      const p = presenceOf(u);
      if (p === "now") now++;
      else if (p === "today") today++;
      else if (p === "away" || p === "offline" || p === "suspended") away++;
    }
    return { now, today, away };
  }, [users]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (
        q &&
        !`${u.name} ${u.email} ${u.employeeId ?? ""} ${u.googleEmail ?? ""} ${roleLabel(u.role)}`
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
      if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
      if (statusFilter !== "ALL" && u.status !== statusFilter) return false;
      if (subFilter !== "ALL" && u.subsidiaryId !== subFilter) return false;
      if (tasksFilter === "YES" && !(u.openTasks ?? 0)) return false;
      if (tasksFilter === "NO" && (u.openTasks ?? 0) > 0) return false;
      if (presenceFilter !== "ALL") {
        const p = presenceOf(u);
        if (presenceFilter === "now" && p !== "now") return false;
        if (presenceFilter === "today" && p !== "now" && p !== "today") return false;
        if (presenceFilter === "away" && p !== "away" && p !== "offline" && p !== "suspended") return false;
      }
      return true;
    });
  }, [users, search, roleFilter, statusFilter, subFilter, tasksFilter, presenceFilter]);

  const resetFilters = () => {
    setSearch("");
    setRoleFilter("ALL");
    setStatusFilter("ALL");
    setSubFilter("ALL");
    setTasksFilter("ALL");
    setPresenceFilter("ALL");
  };

  const openDialog = (mode: OrgDialogMode, u?: User) => {
    if (mode === "invite") {
      setCreateOpen(true);
      return;
    }
    setFormErrors({});
    setEditingUser(u ?? null);
    if (u) {
      setForm({
        name: u.name,
        email: u.email,
        googleEmail: u.googleEmail ?? "",
        role: u.role,
        title: u.title ?? "",
        phone: u.phone ?? "",
        subsidiaryId: u.subsidiaryId ?? "ALL",
        businessUnitId: u.businessUnitId ?? "ALL",
        projectId: u.projectId ?? "ALL",
      });
    } else {
      setForm(emptyForm);
    }
    setDialogMode(mode);
  };

  const validateForm = () => {
    const e: Record<string, string> = {};
    if (form.name.trim().length < 2) e.name = "Name must be at least 2 characters.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) e.email = "A valid email address is required.";
    if (!form.role) e.role = "Select a role.";
    setFormErrors(e);
    return Object.keys(e).length === 0;
  };

  const submitForm = async () => {
    if (!validateForm()) return;
    const payload = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      googleEmail: form.googleEmail.trim().toLowerCase() || (dialogMode === "invite" ? undefined : null),
      role: form.role,
      title: form.title,
      phone: form.phone,
      subsidiaryId: form.subsidiaryId === "ALL" ? "" : form.subsidiaryId,
      businessUnitId: form.businessUnitId === "ALL" ? "" : form.businessUnitId,
      projectId: form.projectId === "ALL" ? "" : form.projectId,
    };
    let res: unknown = null;
    if (dialogMode === "invite") {
      res = await createMut.run(() => apiPost("/api/esg/users", payload));
    } else if (editingUser) {
      res = await editMut.run(() => apiPatch("/api/esg/users", { id: editingUser.id, ...payload }));
    }
    const r = res as { message?: string; tempPassword?: string; emailSent?: boolean; emailNote?: string } | null;
    if (res) {
      if (dialogMode === "invite" && r?.tempPassword) {
        setTempPwd({
          userName: form.name.trim(),
          password: r.tempPassword,
          note: r.emailSent
            ? "Temporary password emailed via Resend and shown once here. The user will be prompted to set their own password on first sign-in."
            : r.emailNote ?? "Share this temporary password securely — user must change it on first sign-in.",
        });
      }
      toast({
        title: dialogMode === "invite" ? "Invitation sent" : "User updated",
        description: dialogMode === "invite" ? `${form.name.trim()} was invited as ${roleLabel(form.role)} (status: Invited).` : r?.message ?? "Profile saved.",
      });
      setDialogMode(null);
      void usersApi.refetch();
    } else {
      const err = dialogMode === "invite" ? createMut.error : editMut.error;
      toast({ title: dialogMode === "invite" ? "Invite failed" : "Update failed", description: err ?? "Server rejected the request.", variant: "destructive" });
    }
  };

  const submitRoleChange = async () => {
    if (!roleDialogUser || !rolePick) return;
    const res = await roleMut.run(() => apiPatch("/api/esg/users", { id: roleDialogUser.id, role: rolePick }));
    if (res) {
      toast({ title: "Role changed", description: `${roleDialogUser.name} is now ${roleLabel(rolePick)}.` });
      setRoleDialogUser(null);
      void usersApi.refetch();
    } else {
      toast({ title: "Role change failed", description: roleMut.error ?? "Server rejected the request.", variant: "destructive" });
    }
  };

  const runStatusAction = async (kind: "suspend" | "reactivate" | "reset" | "deactivate" | "delete", u: User, reason?: string) => {
    setConfirmAction(null);
    let res: unknown = null;
    if (kind === "deactivate") {
      res = await statusMut.run(() => apiDelete("/api/esg/users", { id: u.id, action: "deactivate", reason }));
    } else if (kind === "delete") {
      res = await statusMut.run(() => apiDelete("/api/esg/users", { id: u.id, action: "delete", reason }));
    } else if (kind === "reset") {
      res = await statusMut.run(() => apiPatch("/api/esg/users", { id: u.id, action: "reset-credentials" }));
    } else {
      res = await statusMut.run(() => apiPatch("/api/esg/users", { id: u.id, action: kind, reason }));
    }
    const r = res as { message?: string; tempPassword?: string; emailSent?: boolean } | null;
    if (res) {
      if (kind === "reset" && r?.tempPassword) {
        setTempPwd({
          userName: u.name,
          password: r.tempPassword,
          note: r.emailSent
            ? "Temporary password emailed to user and active sessions revoked."
            : "Temporary password generated and active sessions revoked. Share securely — user must update it on next login.",
        });
      }
      const titles: Record<typeof kind, string> = {
        suspend: "User suspended",
        reactivate: "User reactivated",
        reset: "Credential reset initiated",
        deactivate: "User deactivated",
        delete: "User permanently deleted",
      };
      toast({ title: titles[kind], description: r?.message ?? `${u.name} — action completed.` });
      void usersApi.refetch();
    } else {
      toast({ title: "Action failed", description: statusMut.error ?? "Server rejected the action.", variant: "destructive" });
    }
  };

  const bulkSuspend = async (reason?: string) => {
    setBulkConfirmOpen(false);
    const targets = users.filter((u) => selectedIds.includes(u.id) && u.role !== "GROUP_ADMIN" && u.status === "ACTIVE");
    if (!targets.length) {
      toast({ title: "Nothing to suspend", description: "No selected ACTIVE users can be suspended.", variant: "destructive" });
      setSelectedIds([]);
      return;
    }
    let okCount = 0;
    const failures: string[] = [];
    for (const u of targets) {
      const res = await bulkMut.run(() => apiPatch("/api/esg/users", { id: u.id, action: "suspend", reason }));
      if (res) okCount++;
      else failures.push(`${u.name}: ${bulkMut.error ?? "failed"}`);
    }
    if (failures.length) {
      toast({
        title: `Suspended ${okCount} of ${targets.length}`,
        description: failures.slice(0, 3).join(" · ") + (failures.length > 3 ? ` (+${failures.length - 3} more)` : ""),
        variant: "destructive",
      });
    } else {
      toast({ title: "Users suspended", description: `${okCount} account${okCount === 1 ? "" : "s"} suspended. Reason recorded in audit log.` });
    }
    setSelectedIds([]);
    void usersApi.refetch();
  };

  const bulkReactivate = async () => {
    const targets = users.filter((u) => selectedIds.includes(u.id) && (u.status === "SUSPENDED" || u.status === "INACTIVE"));
    if (!targets.length) {
      toast({ title: "Nothing to reactivate", description: "No selected users are suspended or inactive.", variant: "destructive" });
      return;
    }
    let okCount = 0;
    const failures: string[] = [];
    for (const u of targets) {
      const res = await bulkMut.run(() => apiPatch("/api/esg/users", { id: u.id, action: "reactivate" }));
      if (res) okCount++;
      else failures.push(`${u.name}: ${bulkMut.error ?? "failed"}`);
    }
    if (failures.length) {
      toast({
        title: `Reactivated ${okCount} of ${targets.length}`,
        description: failures.slice(0, 3).join(" · "),
        variant: "destructive",
      });
    } else {
      toast({ title: "Users reactivated", description: `${okCount} account${okCount === 1 ? "" : "s"} restored to ACTIVE.` });
    }
    setSelectedIds([]);
    void usersApi.refetch();
  };

  const exportSelected = () => {
    const rows = users.filter((u) => selectedIds.includes(u.id)).map(csvUserRow);
    if (!rows.length) return;
    downloadFile("meil-users-selected.csv", toCsv(rows), "text/csv");
    toast({ title: "Export ready", description: `${rows.length} selected user${rows.length === 1 ? "" : "s"} exported to CSV.` });
  };

  if (detailId) return <DetailPage userId={detailId} />;

  const columns: Column<User>[] = [
    {
      key: "name",
      header: "User",
      sortable: true,
      sortValue: (u) => u.name,
      render: (u) => {
        const isNew = isRecentJoin(u.joinedAt);
        return (
          <div className="flex items-center gap-2.5">
            <span className="relative">
              <Avatar name={u.name} size={32} />
              <span className="absolute -bottom-0.5 -right-0.5">
                <PresenceDot presence={presenceOf(u)} />
              </span>
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate font-medium text-[color:var(--ink)]">{u.name}</span>
                {isNew && (
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-300 shadow-xs dark:bg-emerald-950/80 dark:text-emerald-300">
                    NEW
                  </span>
                )}
              </div>
              <div className="truncate text-xs text-[color:var(--ink-faint)]">
                {u.employeeId ? (
                  <span className="mr-1.5 font-mono text-[11px] font-semibold text-sky-700 dark:text-sky-300">
                    {u.employeeId} ·
                  </span>
                ) : null}
                {u.title || "—"}
              </div>
            </div>
          </div>
        );
      },
    },
    { key: "email", header: "Email", render: (u) => <span className="text-xs">{u.email}</span> },
    {
      key: "role",
      header: "Role",
      sortable: true,
      sortValue: (u) => roleLabel(u.role),
      render: (u) => <span className="text-xs font-medium">{roleLabel(u.role)}</span>,
    },
    { key: "status", header: "Status", render: (u) => <StatusBadge status={u.status} /> },
    {
      key: "org",
      header: "Organization",
      render: (u) => (
        <span className="text-xs">
          {u.subsidiaryName ?? "Group"}
          {u.businessUnitName ? <span className="text-[color:var(--ink-faint)]"> › {u.businessUnitName}</span> : null}
        </span>
      ),
    },
    { key: "project", header: "Project", render: (u) => <span className="text-xs">{u.projectName ?? "—"}</span> },
    {
      key: "joinedAt",
      header: "Joined",
      sortable: true,
      sortValue: (u) => u.joinedAt ?? "",
      render: (u) => {
        const isNew = isRecentJoin(u.joinedAt);
        return (
          <div className="text-xs leading-tight">
            <div className={cn("font-medium", isNew ? "font-semibold text-emerald-600 dark:text-emerald-400" : "text-[color:var(--ink-soft)]")}>
              {u.joinedAt ? timeAgo(u.joinedAt) : "—"}
            </div>
            <div className="text-[11px] text-[color:var(--ink-faint)]">
              {u.joinedAt ? fmtDate(u.joinedAt) : ""}
            </div>
          </div>
        );
      },
    },
    {
      key: "lastActive",
      header: "Presence",
      sortable: true,
      sortValue: (u) => u.lastActiveAt ?? "",
      render: (u) => {
        const p = presenceOf(u);
        const meta = PRESENCE_META[p];
        return (
          <div className="flex items-center gap-2">
            <PresenceDot presence={p} />
            <div className="min-w-0 leading-tight">
              <div className="text-xs font-semibold" style={{ color: meta.live ? meta.text : "var(--ink-soft)" }}>
                {meta.label}
              </div>
              <div className="truncate text-[11px] text-[color:var(--ink-faint)]">{u.lastActiveAt ? timeAgo(u.lastActiveAt) : "Never"}</div>
            </div>
          </div>
        );
      },
    },
    {
      key: "openTasks",
      header: "Open tasks",
      render: (u) =>
        (u.openTasks ?? 0) > 0 ? (
          <Chip tone={(u.openTasks ?? 0) > 3 ? "amber" : "blue"} className="tabular">{u.openTasks}</Chip>
        ) : (
          <span className="text-xs text-[color:var(--ink-faint)]">0</span>
        ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (u) => {
        const isGroupAdmin = u.role === "GROUP_ADMIN";
        return (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {/* Quick Edit */}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 rounded-xl text-slate-600 hover:text-sky-600 hover:bg-sky-50 dark:text-slate-300 dark:hover:bg-slate-800"
              title="Edit profile & assignments"
              onClick={(e) => {
                e.stopPropagation();
                openDialog("edit", u);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>

            {/* Quick Deactivate / Reactivate */}
            {!isGroupAdmin && (
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 w-8 p-0 rounded-xl",
                  u.status === "ACTIVE"
                    ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                    : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                )}
                title={u.status === "ACTIVE" ? "Deactivate account" : "Reactivate account"}
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmAction({
                    kind: u.status === "ACTIVE" ? "deactivate" : "reactivate",
                    user: u,
                  });
                }}
              >
                {u.status === "ACTIVE" ? (
                  <UserX className="h-3.5 w-3.5" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
              </Button>
            )}

            {/* Quick Delete */}
            {!isGroupAdmin && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                title="Permanently delete user"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmAction({ kind: "delete", user: u });
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}

            {/* More Options Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 glass-strong rounded-2xl border-white/70 shadow-2xl z-50">
                <DropdownMenuLabel className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 py-1">
                  Manage Account
                </DropdownMenuLabel>
                <DropdownMenuItem
                  className="cursor-pointer gap-2 text-xs py-1.5 font-medium"
                  onClick={() => openDialog("edit", u)}
                >
                  <Pencil className="h-3.5 w-3.5 text-sky-600" />
                  Edit User Details
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer gap-2 text-xs py-1.5 font-medium"
                  onClick={() => {
                    setRolePick(u.role);
                    setRoleDialogUser(u);
                  }}
                >
                  <UserCog className="h-3.5 w-3.5 text-indigo-600" />
                  Change Role
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer gap-2 text-xs py-1.5 font-medium"
                  onClick={() => setConfirmAction({ kind: "reset", user: u })}
                >
                  <KeyRound className="h-3.5 w-3.5 text-amber-600" />
                  Reset Credentials
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-slate-200/60 dark:bg-slate-800/60" />
                {!isGroupAdmin && (
                  <>
                    {u.status === "ACTIVE" ? (
                      <DropdownMenuItem
                        className="cursor-pointer gap-2 text-xs py-1.5 text-amber-600 hover:text-amber-700 focus:text-amber-700 font-medium"
                        onClick={() => setConfirmAction({ kind: "deactivate", user: u })}
                      >
                        <UserX className="h-3.5 w-3.5" />
                        Deactivate Account
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        className="cursor-pointer gap-2 text-xs py-1.5 text-emerald-600 hover:text-emerald-700 focus:text-emerald-700 font-medium"
                        onClick={() => setConfirmAction({ kind: "reactivate", user: u })}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Reactivate Account
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      className="cursor-pointer gap-2 text-xs py-1.5 text-rose-600 hover:text-rose-700 focus:text-rose-700 font-medium"
                      onClick={() => setConfirmAction({ kind: "delete", user: u })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete Permanently
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  return (
    <div className="view-in space-y-5">
      <PageHeader
        title="All Users"
        description="Complete directory of workspace accounts across the group — roles, status, assignments, and activity."
        icon={UsersIcon}
        breadcrumbs={["Group", "People & Access", "All Users"]}
        actions={
          <>
            <ExportButton filename="meil-users" rows={filtered.map(csvUserRow)} />
            <ActionButton onClick={() => setCreateOpen(true)}>
              <UserPlus className="mr-1.5 h-4 w-4" /> Invite user
            </ActionButton>
          </>
        }
      />

      {/* ── Active users — live presence strip ── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <PresenceStatCard
          hue="#3a7bff"
          icon={<UsersIcon className="h-[18px] w-[18px]" />}
          label="All users"
          hint="Complete directory"
          value={users.length}
          selected={presenceFilter === "ALL"}
          onClick={() => setPresenceFilter("ALL")}
          ariaLabel="Filter users by presence: All users"
        />
        <PresenceStatCard
          hue="#238653"
          icon={
            <span className="relative flex h-[18px] w-[18px] items-center justify-center">
              <span className="absolute h-4 w-4 animate-ping rounded-full bg-white opacity-60" />
              <span className="relative h-2.5 w-2.5 rounded-full bg-white" />
            </span>
          }
          label="Active now"
          hint="Seen in the last 30 minutes"
          value={presenceCounts.now}
          selected={presenceFilter === "now"}
          onClick={() => setPresenceFilter("now")}
          ariaLabel="Filter users by presence: Active now"
        />
        <PresenceStatCard
          hue="#16a3a3"
          icon={<Clock className="h-[18px] w-[18px]" />}
          label="Active today"
          hint="Seen in the last 12 hours"
          value={presenceCounts.now + presenceCounts.today}
          selected={presenceFilter === "today"}
          onClick={() => setPresenceFilter("today")}
          ariaLabel="Filter users by presence: Active today"
        />
        <PresenceStatCard
          hue="#c57926"
          icon={<Moon className="h-[18px] w-[18px]" />}
          label="Away / offline"
          hint="Not active recently"
          value={presenceCounts.away}
          selected={presenceFilter === "away"}
          onClick={() => setPresenceFilter("away")}
          ariaLabel="Filter users by presence: Away / offline"
        />
      </div>

      <ResetRequestsPanel onUpdated={() => void usersApi.refetch()} />

      <DataTable<User>
        columns={columns}
        rows={filtered}
        loading={usersApi.loading}
        error={usersApi.error}
        onRetry={() => void usersApi.refetch()}
        pageSize={10}
        defaultSortKey="joinedAt"
        defaultSortDir="desc"
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onRowClick={(u) => openDetail("users", u.id, "overview")}
        emptyTitle="No users match your filters"
        emptyMessage="Adjust the search or filter criteria, or invite a new user."
        emptyAction={<Button variant="outline" className="glass-subtle rounded-2xl" onClick={() => setCreateOpen(true)}><UserPlus className="mr-1.5 h-4 w-4" /> Invite user</Button>}
        toolbar={
          <Toolbar
            search={search}
            onSearch={setSearch}
            searchPlaceholder="Search name, email, or role…"
            resultCount={filtered.length}
            onReset={resetFilters}
            filters={[
              {
                key: "role",
                label: "Role",
                value: roleFilter,
                onChange: setRoleFilter,
                options: [{ value: "ALL", label: "All roles" }, ...ROLE_KEYS.map((r) => ({ value: r, label: roleLabel(r) }))],
              },
              {
                key: "status",
                label: "Status",
                value: statusFilter,
                onChange: setStatusFilter,
                options: STATUS_OPTIONS.map((s) => ({ value: s, label: s === "ALL" ? "All statuses" : s.charAt(0) + s.slice(1).toLowerCase() })),
              },
              {
                key: "sub",
                label: "Subsidiary",
                value: subFilter,
                onChange: setSubFilter,
                options: [{ value: "ALL", label: "All subsidiaries" }, ...(subsApi.data?.subsidiaries ?? []).map((s) => ({ value: s.id, label: s.name }))],
              },
              {
                key: "tasks",
                label: "Open tasks",
                value: tasksFilter,
                onChange: setTasksFilter,
                options: [
                  { value: "ALL", label: "All" },
                  { value: "YES", label: "Has open tasks" },
                  { value: "NO", label: "No open tasks" },
                ],
              },
              {
                key: "presence",
                label: "Presence",
                value: presenceFilter,
                onChange: (v) => setPresenceFilter(v as PresenceFilter),
                options: [
                  { value: "ALL", label: "All presence" },
                  { value: "now", label: "Active now" },
                  { value: "today", label: "Active today" },
                  { value: "away", label: "Offline / away" },
                ],
              },
            ]}
          />
        }
        rowActions={(u) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" aria-label={`Actions for ${u.name}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass-strong rounded-2xl border-white/70">
              <DropdownMenuLabel className="text-xs text-[color:var(--ink-faint)]">{u.name}</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => openDetail("users", u.id, "overview")}>
                <Eye className="mr-2 h-3.5 w-3.5" /> View profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openDialog("edit", u)}>
                <UserCog className="mr-2 h-3.5 w-3.5" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setRoleDialogUser(u); setRolePick(u.role); }}>
                <ShieldCheck className="mr-2 h-3.5 w-3.5" /> Change role
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={u.role === "GROUP_ADMIN" || u.status !== "ACTIVE"}
                onClick={() => setConfirmAction({ kind: "suspend", user: u })}
              >
                <ShieldOff className="mr-2 h-3.5 w-3.5" /> Suspend
              </DropdownMenuItem>
              <DropdownMenuItem disabled={u.status !== "SUSPENDED" && u.status !== "INACTIVE"} onClick={() => setConfirmAction({ kind: "reactivate", user: u })}>
                <ShieldCheck className="mr-2 h-3.5 w-3.5" /> Reactivate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setConfirmAction({ kind: "reset", user: u })}>
                <KeyRound className="mr-2 h-3.5 w-3.5" /> Reset credentials
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-[#a53b3b] focus:text-[#a53b3b]"
                disabled={u.role === "GROUP_ADMIN"}
                onClick={() => setConfirmAction({ kind: "deactivate", user: u })}
              >
                <ShieldAlert className="mr-2 h-3.5 w-3.5" /> Deactivate
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        mobileCard={(u) => (
          <GlassCard subtle className="p-3">
            <div className="flex items-center gap-2.5">
              <Avatar name={u.name} size={34} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-[color:var(--ink)]">{u.name}</div>
                <div className="truncate text-xs text-[color:var(--ink-faint)]">{u.email}</div>
              </div>
              <span className="flex items-center gap-1.5">
                <PresenceDot presence={presenceOf(u)} />
                <StatusBadge status={u.status} />
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Chip tone="blue">{roleLabel(u.role)}</Chip>
              {u.subsidiaryName && <Chip tone="gray">{u.subsidiaryName}</Chip>}
              {(u.openTasks ?? 0) > 0 && <Chip tone="amber" className="tabular">{u.openTasks} open tasks</Chip>}
              {presenceOf(u) === "now" && <Chip tone="green">Active now</Chip>}
            </div>
          </GlassCard>
        )}
      />

      {/* Floating bulk action bar */}
      {selectedIds.length > 0 && (
        <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div className="glass-strong glass-sheen flex flex-wrap items-center gap-2 rounded-3xl border-white/70 px-4 py-3 shadow-xl">
            <span className="mr-1 text-sm font-medium text-[color:var(--ink)]">{selectedIds.length} selected</span>
            <Button
              variant="outline"
              size="sm"
              className="glass-subtle rounded-2xl border-white/60"
              disabled={bulkMut.pending}
              onClick={() => setBulkConfirmOpen(true)}
            >
              {bulkMut.pending ? <Ring className="mr-1.5 h-3.5 w-3.5" /> : <ShieldOff className="mr-1.5 h-3.5 w-3.5" />} Suspend
            </Button>
            <Button variant="outline" size="sm" className="glass-subtle rounded-2xl border-white/60" disabled={bulkMut.pending} onClick={() => void bulkReactivate()}>
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Reactivate
            </Button>
            <Button variant="outline" size="sm" className="glass-subtle rounded-2xl border-white/60" onClick={exportSelected}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export selected
            </Button>
            <Button variant="ghost" size="sm" className="rounded-2xl" onClick={() => setSelectedIds([])}>Clear</Button>
          </div>
        </div>
      )}

      {/* Invite / Edit / Org dialog */}
      <GlassDialog
        open={dialogMode !== null}
        onOpenChange={(o) => !o && setDialogMode(null)}
        title={dialogMode === "invite" ? "Invite user" : dialogMode === "org" ? `Edit assignments — ${editingUser?.name ?? ""}` : `Edit user — ${editingUser?.name ?? ""}`}
        description={
          dialogMode === "invite"
            ? "The account is created with INVITED status until the user completes onboarding."
            : dialogMode === "org"
              ? "Update subsidiary, business unit, and project assignments."
              : "Update profile fields and organization assignments."
        }
        wide
        footer={
          <>
            <Button variant="outline" className="glass-subtle rounded-2xl" onClick={() => setDialogMode(null)} disabled={createMut.pending || editMut.pending}>Cancel</Button>
            <ActionButton pending={createMut.pending || editMut.pending} onClick={submitForm}>
              {dialogMode === "invite" ? "Send invite" : "Save changes"}
            </ActionButton>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required error={formErrors.name}>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="glass-subtle rounded-2xl border-white/60" placeholder="e.g. Priya Nair" />
          </Field>
          <Field label="Email" required error={formErrors.email} hint={dialogMode !== "invite" ? "Used as login identifier and for notifications." : undefined}>
            <Input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="glass-subtle rounded-2xl border-white/60"
              placeholder="name@meilgroup.com"
              type="email"
            />
          </Field>
          <Field label="Role" required error={formErrors.role}>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
              <SelectTrigger className="glass-subtle rounded-2xl border-white/60"><SelectValue placeholder="Select role" /></SelectTrigger>
              <SelectContent className="glass-strong rounded-2xl border-white/70">
                {ROLE_KEYS.map((r) => (
                  <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Title">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="glass-subtle rounded-2xl border-white/60" placeholder="e.g. Environment Data Lead" />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="glass-subtle rounded-2xl border-white/60" placeholder="+91…" />
          </Field>
          <Field label="Google Sign-In Email (optional)" hint="Optional Gmail / Workspace alias for Google SSO">
            <Input value={form.googleEmail} onChange={(e) => setForm({ ...form, googleEmail: e.target.value })} className="glass-subtle rounded-2xl border-white/60" placeholder="user@gmail.com" type="email" />
          </Field>
          <Field label="Subsidiary">
            <Select value={form.subsidiaryId} onValueChange={(v) => setForm({ ...form, subsidiaryId: v, businessUnitId: "ALL", projectId: "ALL" })}>
              <SelectTrigger className="glass-subtle rounded-2xl border-white/60"><SelectValue placeholder="Select subsidiary" /></SelectTrigger>
              <SelectContent className="glass-strong rounded-2xl border-white/70">
                <SelectItem value="ALL">Group level (none)</SelectItem>
                {(subsApi.data?.subsidiaries ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Business unit" hint="Options filtered by selected subsidiary.">
            <Select value={form.businessUnitId} onValueChange={(v) => setForm({ ...form, businessUnitId: v, projectId: "ALL" })}>
              <SelectTrigger className="glass-subtle rounded-2xl border-white/60"><SelectValue placeholder="Select business unit" /></SelectTrigger>
              <SelectContent className="glass-strong rounded-2xl border-white/70">
                <SelectItem value="ALL">None</SelectItem>
                {(unitsApi.data?.businessUnits ?? [])
                  .filter((b) => form.subsidiaryId === "ALL" || b.subsidiaryId === form.subsidiaryId)
                  .map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Project / Site" hint="Options filtered by selected business unit.">
            <Select value={form.projectId} onValueChange={(v) => setForm({ ...form, projectId: v })}>
              <SelectTrigger className="glass-subtle rounded-2xl border-white/60"><SelectValue placeholder="Select project" /></SelectTrigger>
              <SelectContent className="glass-strong rounded-2xl border-white/70">
                <SelectItem value="ALL">None</SelectItem>
                {(projectsApi.data?.projects ?? [])
                  .filter((p) => form.businessUnitId === "ALL" || p.businessUnitId === form.businessUnitId)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </GlassDialog>

      {/* Change role dialog */}
      <GlassDialog
        open={roleDialogUser !== null}
        onOpenChange={(o) => !o && setRoleDialogUser(null)}
        title={`Change role — ${roleDialogUser?.name ?? ""}`}
        description="The current role is replaced immediately and the change is recorded in the audit log."
        footer={
          <>
            <Button variant="outline" className="glass-subtle rounded-2xl" onClick={() => setRoleDialogUser(null)} disabled={roleMut.pending}>Cancel</Button>
            <ActionButton pending={roleMut.pending} onClick={() => void submitRoleChange()} disabled={!rolePick || rolePick === roleDialogUser?.role}>Update role</ActionButton>
          </>
        }
      >
        <Field label="Role" required>
          <Select value={rolePick} onValueChange={setRolePick}>
            <SelectTrigger className="glass-subtle rounded-2xl border-white/60"><SelectValue placeholder="Select new role" /></SelectTrigger>
            <SelectContent className="glass-strong rounded-2xl border-white/70">
              {ROLE_KEYS.map((r) => (
                <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </GlassDialog>

      {/* Row-level confirms */}
      <ConfirmDialog
        open={confirmAction?.kind === "suspend"}
        onOpenChange={(o) => !o && setConfirmAction(null)}
        title={`Suspend ${confirmAction?.user.name ?? ""}?`}
        message="The account will be suspended immediately and cannot sign in until reactivated. The reason is recorded in the audit log."
        confirmLabel="Suspend account"
        requireReason
        pending={statusMut.pending}
        onConfirm={(reason) => confirmAction && void runStatusAction("suspend", confirmAction.user, reason)}
      />
      <ConfirmDialog
        open={confirmAction?.kind === "reactivate"}
        onOpenChange={(o) => !o && setConfirmAction(null)}
        title={`Reactivate ${confirmAction?.user.name ?? ""}?`}
        message="Access will be restored with the user's current role and organization assignments."
        confirmLabel="Reactivate"
        pending={statusMut.pending}
        onConfirm={() => confirmAction && void runStatusAction("reactivate", confirmAction.user)}
      />
      <ConfirmDialog
        open={confirmAction?.kind === "reset"}
        onOpenChange={(o) => !o && setConfirmAction(null)}
        title={`Reset credentials — ${confirmAction?.user.name ?? ""}?`}
        message="A secure credential reset will be initiated and reset instructions queued for delivery."
        confirmLabel="Initiate reset"
        pending={statusMut.pending}
        onConfirm={() => confirmAction && void runStatusAction("reset", confirmAction.user)}
      />
      <ConfirmDialog
        open={confirmAction?.kind === "deactivate"}
        onOpenChange={(o) => !o && setConfirmAction(null)}
        title={`Deactivate ${confirmAction?.user.name ?? ""}?`}
        message="The account is deactivated rather than deleted so report attribution and audit history are preserved."
        confirmLabel="Deactivate"
        destructive
        requireReason
        pending={statusMut.pending}
        onConfirm={(reason) => confirmAction && void runStatusAction("deactivate", confirmAction.user, reason)}
      />
      <ConfirmDialog
        open={confirmAction?.kind === "delete"}
        onOpenChange={(o) => !o && setConfirmAction(null)}
        title={`Permanently delete ${confirmAction?.user.name ?? ""}?`}
        message="This will completely remove the user account from the directory and revoke all active sessions. This action cannot be undone."
        confirmLabel="Permanently delete user"
        destructive
        requireReason
        pending={statusMut.pending}
        onConfirm={(reason) => confirmAction && void runStatusAction("delete", confirmAction.user, reason)}
      />

      {/* Bulk suspend confirm */}
      <ConfirmDialog
        open={bulkConfirmOpen}
        onOpenChange={setBulkConfirmOpen}
        title={`Suspend ${selectedIds.length} selected user${selectedIds.length === 1 ? "" : "s"}?`}
        message="Only ACTIVE, non-Group-Admin accounts among the selection will be suspended. Each suspension is recorded individually in the audit log with this reason."
        confirmLabel="Suspend selected"
        requireReason
        pending={bulkMut.pending}
        onConfirm={(reason) => void bulkSuspend(reason)}
      />

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        subsidiaries={subsApi.data?.subsidiaries}
        businessUnits={unitsApi.data?.businessUnits}
        projects={projectsApi.data?.projects}
        onCreated={(outcome) => {
          if (outcome.tempPassword) {
            setTempPwd({
              userName: outcome.userName,
              password: outcome.tempPassword,
              note: outcome.emailSent
                ? "Temporary password emailed via Resend and shown once here. The user will be prompted to set their own password on first sign-in."
                : outcome.emailNote ??
                  "Share this temporary password securely — user must change it on first sign-in.",
            });
          }
          setRoleFilter("ALL");
          setStatusFilter("ALL");
          setSubFilter("ALL");
          setTasksFilter("ALL");
          setPresenceFilter("ALL");
          setSearch(outcome.userName);
          void usersApi.refetch();
        }}
      />

      <TempPasswordModal data={tempPwd} onClose={() => setTempPwd(null)} />
    </div>
  );
}
