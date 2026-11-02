"use client";

// ── BU ADMIN · SCREEN 03 — User Management ──
// Role grants are constrained to BA_ASSIGNABLE_ROLES (server-enforced 403):
// Group Admin / Org Manager / Subsidiary Admin / Subsidiary Manager / BU Admin / BU Manager
// are reserved to higher scopes and are NEVER offered in the invite / edit dialogs.

import { useEffect, useMemo, useState } from "react";
import {
  Activity as ActivityIcon, CalendarClock, CheckCircle2, Copy, KeyRound,
  Mail, Moon, MoreHorizontal, Pencil, Phone, Plus, ShieldCheck, UserCheck, UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBaSessionUser } from "@/components/ba/shell";
import { useBaWorkspace } from "@/lib/ba/store";
import { apiPatch, apiPost, fmtDateTime, timeAgo, useBaApi, useMutation } from "@/lib/ba/client";
import { ROLE_LABELS } from "@/lib/ba/types";
import type { UserRow } from "@/lib/ba/types";
import {
  Avatar, Chip, ConfirmDialog, DataTable, EmptyState, ErrorState, ExportButton, Field,
  GlassDialog, InfoRow, KpiCard, LoadingBlock, PageHeader, SectionCard, StatusBadge, Toolbar, TipIconButton,
  type Column,
} from "@/components/workspace/ui";
import { PeopleIcon, UserPlusIcon } from "@/components/workspace/premium-icons";
import { useToast } from "@/hooks/use-toast";

const inputCls = "glass-subtle rounded-2xl border-white/60 text-sm";

type UsersResponse = {
  users: UserRow[];
  total: number; page: number; pageSize: number;
  roles: string[];
  assignableRoles: string[];
  buProjects: { id: string; name: string }[];
};

export default function UsersView() {
  const { navigate, params } = useBaWorkspace();
  const session = useBaSessionUser();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [inviteOpen, setInviteOpen] = useState<boolean>(() => !!params.create);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ id: string; name: string; action: "deactivate" | "reactivate" } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  /* consume the deep-link once — the create flag only seeds initial state */
  useEffect(() => {
    if (params.create) {
      navigate("users", { ...params, create: undefined });
    }
  }, []);

  const q = search.toLowerCase();
  const apiQ = `/api/ba/users?q=${encodeURIComponent(q)}&role=${roleFilter}&status=${statusFilter}&pageSize=50`;
  const { data, loading, error, refetch } = useBaApi<UsersResponse>(apiQ, { deps: [q, roleFilter, statusFilter] });

  const invite = useMutation();
  const patch = useMutation();
  const actions = useMutation();

  const rows = data?.users ?? [];
  const assignable = (data?.assignableRoles ?? []).map((r) => ({ value: r, label: ROLE_LABELS[r] ?? r }));
  const buProjects = data?.buProjects ?? [];

  const columns: Column<UserRow>[] = [
    {
      key: "name",
      header: "User",
      sortable: true,
      sortValue: (r) => r.name,
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={r.name} size={32} />
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-[color:var(--ink)]">{r.name}</div>
            <div className="truncate text-[11px] text-[color:var(--ink-faint)]">{r.title || r.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      sortable: true,
      sortValue: (r) => r.roleLabel,
      render: (r) => <Chip tone={r.role === "BU_MANAGER" ? "purple" : "blue"}>{r.roleLabel}</Chip>,
    },
    {
      key: "project",
      header: "Project",
      render: (r) => <span className="truncate text-[12px] text-[color:var(--ink-soft)]">{r.projectName ?? "—"}</span>,
    },
    {
      key: "presence",
      header: "Presence",
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${r.presence === "online" ? "bg-[#238653] pulse-dot" : r.presence === "today" ? "bg-[#348BE8]" : r.presence === "away" ? "bg-[#c57926]" : "bg-[#8595ab]"}`} />
          <span className="text-[11px] text-[color:var(--ink-faint)]">{r.lastActiveAt ? timeAgo(r.lastActiveAt) : "Never"}</span>
        </div>
      ),
    },
    {
      key: "submissions",
      header: "Reports",
      sortable: true,
      sortValue: (r) => r.submissionCount,
      render: (r) => <span className="tabular text-[12px] font-semibold text-[color:var(--ink)]">{r.submissionCount}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortValue: (r) => r.status,
      render: (r) => <StatusBadge status={r.status} />,
    },
  ];

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="User Management"
        description="BU-scoped users — operational contributors under your business unit. Higher-scope accounts (Group/Subsidiary Admin/Manager, BU Admin/Manager) cannot be created or modified here."
        icon={PeopleIcon}
        actions={
          <Button className="btn-ba-action rounded-2xl" onClick={() => setInviteOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Invite user
          </Button>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="BU users" value={data?.total ?? 0} icon={PeopleIcon} tone="blue" hint="Within BU scope" onClick={() => refetch()} />
        <KpiCard label="Active now" value={rows.filter((u) => u.status === "ACTIVE" && u.presence === "online").length} icon={UserCheck} tone="green" hint="Last 30 min" />
        <KpiCard label="Invited" value={rows.filter((u) => u.status === "INVITED").length} icon={Mail} tone="purple" hint="Activation pending" />
        <KpiCard label="Assignable roles" value={assignable.length} icon={ShieldCheck} tone="amber" hint="Operational contributor roles" />
      </div>

      <Toolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search name, title, email…"
        filters={[
          { key: "role", label: "Role", options: [{ value: "ALL", label: "All roles" }, ...assignable], value: roleFilter, onChange: setRoleFilter },
          { key: "status", label: "Status", options: [{ value: "ALL", label: "All" }, { value: "ACTIVE", label: "Active" }, { value: "INVITED", label: "Invited" }, { value: "INACTIVE", label: "Inactive" }, { value: "SUSPENDED", label: "Suspended" }], value: statusFilter, onChange: setStatusFilter },
        ]}
        onReset={() => { setSearch(""); setRoleFilter("ALL"); setStatusFilter("ALL"); }}
        resultCount={data?.total ?? 0}
        right={<ExportButton filename="ba-users" rows={rows as unknown as Record<string, unknown>[]} />}
      />

      <DataTable<UserRow>
        columns={columns}
        rows={rows}
        loading={loading && !data}
        error={error && !data ? error : null}
        onRetry={refetch}
        pageSize={10}
        onRowClick={(r) => setDetailId(r.id)}
        rowActions={(r) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded-xl p-1.5 hover:bg-white/70" aria-label="Actions"><MoreHorizontal className="h-4 w-4" /></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass-strong rounded-2xl border-white/80 p-1.5">
              <DropdownMenuItem className="rounded-xl text-[13px]" onClick={() => setEditingId(r.id)}><Pencil className="mr-2 h-4 w-4" /> Edit profile</DropdownMenuItem>
              <DropdownMenuItem className="rounded-xl text-[13px]" onClick={() => setDetailId(r.id)}><ActivityIcon className="mr-2 h-4 w-4" /> View detail</DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[rgba(125,177,216,0.3)]" />
              {r.status === "INVITED" && (
                <DropdownMenuItem className="rounded-xl text-[13px]" onClick={() => void actions.run(() => apiPost(`/api/ba/users/${r.id}/actions`, { action: "resend_invite" }).then(() => { refetch(); toast({ title: "Invitation reminder sent", description: `A reminder was dispatched to ${r.name}.` }); }))}>
                  <Mail className="mr-2 h-4 w-4" /> Resend invite
                </DropdownMenuItem>
              )}
              {r.status === "ACTIVE" ? (
                <DropdownMenuItem className="rounded-xl text-[13px] text-[#a53b3b] data-[highlighted]:bg-[rgba(195,74,74,0.08)]" onClick={() => setConfirmAction({ id: r.id, name: r.name, action: "deactivate" })}><UserX className="mr-2 h-4 w-4" /> Deactivate</DropdownMenuItem>
              ) : (
                <DropdownMenuItem className="rounded-xl text-[13px] text-[#1d6b40] data-[highlighted]:bg-[rgba(35,134,83,0.08)]" onClick={() => setConfirmAction({ id: r.id, name: r.name, action: "reactivate" })}><UserCheck className="mr-2 h-4 w-4" /> Reactivate</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        mobileCard={(r) => (
          <div className="flex flex-col gap-2 p-3">
            <div className="flex items-center gap-2.5">
              <Avatar name={r.name} size={36} />
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold">{r.name}</div>
                <div className="truncate text-[11px] text-[color:var(--ink-faint)]">{r.title || r.email}</div>
              </div>
              <StatusBadge status={r.status} />
            </div>
            <div className="flex flex-wrap items-center gap-2"><Chip tone="blue">{r.roleLabel}</Chip>{r.projectName && <Chip tone="purple">{r.projectName}</Chip>}</div>
          </div>
        )}
      />

      {/* Invite dialog */}
      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        assignable={assignable}
        buProjects={buProjects}
        onInvite={async (payload) => {
          const res = await invite.run(() => apiPost<{ user: { id: string } }>("/api/ba/users", payload));
          if (res) {
            setInviteOpen(false);
            toast({ title: "User invited", description: `${payload.name} was invited as ${ROLE_LABELS[payload.role] ?? payload.role}.` });
            refetch();
          } else {
            toast({ title: "Could not invite user", description: invite.error ?? "Please try again.", variant: "destructive" });
          }
        }}
        pending={invite.pending}
      />

      {/* Edit dialog */}
      <EditDialog
        userId={editingId}
        onOpenChange={(o) => { if (!o) setEditingId(null); }}
        buProjects={buProjects}
        onSave={async (payload) => {
          if (!editingId) return;
          const res = await patch.run(() => apiPatch(`/api/ba/users/${editingId}`, payload));
          if (res) {
            setEditingId(null);
            toast({ title: "User updated", description: "Profile changes saved." });
            refetch();
          } else {
            toast({ title: "Could not save", description: patch.error ?? "Please try again.", variant: "destructive" });
          }
        }}
        pending={patch.pending}
      />

      {/* Confirm deactivate / reactivate */}
      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={(o) => { if (!o) setConfirmAction(null); }}
        title={confirmAction?.action === "deactivate" ? "Deactivate user" : "Reactivate user"}
        message={confirmAction?.action === "deactivate"
          ? `${confirmAction?.name}'s active sessions will be revoked and the account marked inactive. The user can be reactivated later.`
          : `${confirmAction?.name}'s account will be reactivated. They can sign in again with their existing credentials.`}
        confirmLabel={confirmAction?.action === "deactivate" ? "Deactivate" : "Reactivate"}
        destructive={confirmAction?.action === "deactivate"}
        pending={actions.pending}
        onConfirm={async () => {
          if (!confirmAction) return;
          const res = await actions.run(() => apiPost(`/api/ba/users/${confirmAction.id}/actions`, { action: confirmAction.action }));
          if (res) {
            toast({ title: confirmAction.action === "deactivate" ? "Account deactivated" : "Account reactivated", description: confirmAction.name });
            setConfirmAction(null);
            refetch();
          } else {
            toast({ title: "Action failed", description: actions.error ?? "Please try again.", variant: "destructive" });
          }
        }}
      />

      {/* Detail sheet */}
      <UserDetailSheet
        userId={detailId}
        onOpenChange={(o) => { if (!o) setDetailId(null); }}
        canEdit={(id) => id !== session.id}
        onEdit={(id) => { setDetailId(null); setEditingId(id); }}
      />
    </div>
  );
}

/* ── Invite dialog ── */
function InviteDialog({
  open, onOpenChange, assignable, buProjects, onInvite, pending,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  assignable: { value: string; label: string }[];
  buProjects: { id: string; name: string }[];
  onInvite: (payload: { name: string; email: string; role: string; title: string; phone: string; projectId: string }) => void;
  pending: boolean;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(assignable[0]?.value ?? "");
  const [title, setTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [projectId, setProjectId] = useState("");
  const [err, setErr] = useState<string | null>(null);

  /* Reset the invite form each time the dialog opens — adjusted during render
     (React's prev-value pattern) instead of a synchronous setState effect. */
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setName("");
      setEmail("");
      setRole(assignable[0]?.value ?? "");
      setTitle("");
      setPhone("");
      setProjectId("");
      setErr(null);
    }
  }

  const submit = () => {
    if (name.trim().length < 2) return setErr("User name is required.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setErr("A valid email is required.");
    if (!role) return setErr("Pick a contributor role.");
    onInvite({ name: name.trim(), email: email.trim().toLowerCase(), role, title: title.trim(), phone: phone.trim(), projectId });
  };

  return (
    <GlassDialog open={open} onOpenChange={onOpenChange} title="Invite a BU contributor" description="The new account starts in INVITED status. Higher-scope roles (Group/Subsidiary Admin/Manager, BU Admin/Manager) are not available here.">
      <div className="grid gap-3">
        <Field label="Name" required error={err && name.trim().length < 2 ? err : null}>
          <Input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Full name" />
        </Field>
        <Field label="Email" required error={err && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? err : null}>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="user@meil.in" />
        </Field>
        <Field label="Role" required error={err && !role ? err : null} hint="Operational contributor roles only — Group/Subsidiary/BU Manager roles are managed by higher scopes.">
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className={inputCls}><SelectValue placeholder="Choose a role" /></SelectTrigger>
            <SelectContent className="glass-strong rounded-2xl border-white/70">
              {assignable.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="Job title" /></Field>
          <Field label="Phone"><Input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="+91…" /></Field>
        </div>
        <Field label="Project (optional)" hint="Attach this user to a project under your BU.">
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className={inputCls}><SelectValue placeholder="No specific project" /></SelectTrigger>
            <SelectContent className="glass-strong rounded-2xl border-white/70">
              {buProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" className="rounded-2xl" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
        <Button className="btn-ba-action rounded-2xl" onClick={submit} disabled={pending}>{pending ? "Sending invite…" : "Send invite"}</Button>
      </div>
    </GlassDialog>
  );
}

/* ── Edit dialog ── */
function EditDialog({
  userId, onOpenChange, buProjects, onSave, pending,
}: {
  userId: string | null;
  onOpenChange: (o: boolean) => void;
  buProjects: { id: string; name: string }[];
  onSave: (payload: { title?: string; phone?: string; role?: string; projectId?: string | null }) => void;
  pending: boolean;
}) {
  const { data, loading } = useBaApi<{ user: UserRow }>(userId ? `/api/ba/users/${userId}` : null);
  const [title, setTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [roleTouched, setRoleTouched] = useState(false);
  const [dirty, setDirty] = useState(false);

  /* Seed the edit form from the fetched user — adjusted during render
     (React's prev-value pattern) instead of a synchronous setState effect. */
  const user = data?.user;
  const [prevUser, setPrevUser] = useState<UserRow | null>(null);
  if (user && user !== prevUser) {
    setPrevUser(user);
    setTitle(user.title);
    setPhone(user.phone);
    setRole(user.role);
    setProjectId(user.projectId ?? "");
    setRoleTouched(false);
    setDirty(false);
  }

  if (!userId) return null;

  return (
    <GlassDialog open={!!userId} onOpenChange={onOpenChange} title="Edit user" description={data?.user ? `${data.user.name} · ${data.user.email}` : "Loading…"}>
      {loading && !data ? <LoadingBlock rows={3} /> : data?.user ? (
        <div className="grid gap-3">
          <Field label="Name"><Input value={data.user.name} disabled className={inputCls} /></Field>
          <Field label="Email"><Input value={data.user.email} disabled className={inputCls} /></Field>
          <Field label="Title"><Input value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} className={inputCls} /></Field>
          <Field label="Phone"><Input value={phone} onChange={(e) => { setPhone(e.target.value); setDirty(true); }} className={inputCls} /></Field>
          <Field label="Role" hint="Operational contributor roles only — the BU Admin / BU Manager roles are managed by higher scopes.">
            <Select value={role} onValueChange={(v) => { setRole(v); setRoleTouched(true); setDirty(true); }}>
              <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
              <SelectContent className="glass-strong rounded-2xl border-white/70">
                <SelectItem value={data.user.role}>{ROLE_LABELS[data.user.role] ?? data.user.role} (current)</SelectItem>
                <SelectItem value="ENV_DATA_USER">Environment Data User</SelectItem>
                <SelectItem value="FIN_RESOURCE_USER">Finance & Resource Contributor</SelectItem>
                <SelectItem value="HR_USER">HR User</SelectItem>
                <SelectItem value="EHS_USER">EHS / Safety User</SelectItem>
                <SelectItem value="PROCUREMENT_USER">Procurement User</SelectItem>
                <SelectItem value="CSR_USER">CSR / Community User</SelectItem>
                <SelectItem value="COMPLIANCE_USER">Compliance User</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Project (optional)">
            <Select value={projectId} onValueChange={(v) => { setProjectId(v); setDirty(true); }}>
              <SelectTrigger className={inputCls}><SelectValue placeholder="No specific project" /></SelectTrigger>
              <SelectContent className="glass-strong rounded-2xl border-white/70">
                <SelectItem value="">No specific project</SelectItem>
                {buProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          {dirty && (
            <div className="flex items-center gap-2 text-[11.5px] text-[#c57926]"><Moon className="h-3.5 w-3.5" /> Unsaved changes</div>
          )}
        </div>
      ) : <EmptyState title="User not found" />}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" className="rounded-2xl" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button className="btn-ba-action rounded-2xl" disabled={!dirty || pending} onClick={() => onSave({ title, phone, role: roleTouched ? role : undefined, projectId: projectId || null })}>{pending ? "Saving…" : "Save changes"}</Button>
      </div>
    </GlassDialog>
  );
}

/* ── User detail sheet ── */
function UserDetailSheet({
  userId, onOpenChange, canEdit, onEdit,
}: {
  userId: string | null;
  onOpenChange: (o: boolean) => void;
  canEdit: (id: string) => boolean;
  onEdit: (id: string) => void;
}) {
  const { data, loading, error, refetch } = useBaApi<{ user: UserRow; tasks: { id: string; ref: string; title: string; category: string; priority: string; status: string; dueDate: string }[]; submissions: { id: string; ref: string; title: string; status: string; dueDate: string; submittedAt: string | null }[]; sessions: { id: string; userAgent: string; ip: string; createdAt: string; expiresAt: string }[]; lastLogins: { eventType: string; result: string; createdAt: string; ip: string }[] }>(userId ? `/api/ba/users/${userId}` : null);
  if (!userId) return null;
  const u = data?.user;
  return (
    <DetailSheetWrap
      open={!!userId}
      onOpenChange={onOpenChange}
      title={u ? `${u.name} · ${u.roleLabel}` : "User detail"}
      subtitle={u ? `${u.email}${u.employeeId ? ` · ${u.employeeId}` : ""}` : "Loading…"}
      footer={u && canEdit(u.id) ? (
        <Button className="btn-ba-action rounded-2xl" onClick={() => onEdit(u.id)}><Pencil className="mr-1.5 h-4 w-4" /> Edit profile</Button>
      ) : undefined}
    >
      {loading && !data ? <LoadingBlock rows={4} /> : error && !data ? <ErrorState message={error} onRetry={refetch} /> : u ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Avatar name={u.name} size={48} />
            <div>
              <div className="flex items-center gap-2"><StatusBadge status={u.status} />{u.presence === "online" && <Chip tone="green">Active now</Chip>}</div>
              <div className="mt-1 text-[12px] text-[color:var(--ink-faint)]">Last active {u.lastActiveAt ? timeAgo(u.lastActiveAt) : "Never"}</div>
            </div>
          </div>
          <SectionCard title="Profile" icon={PeopleIcon} noPad>
            <div className="px-4 py-2">
              <InfoRow label="Title">{u.title || "—"}</InfoRow>
              <InfoRow label="Phone">{u.phone || "—"}</InfoRow>
              <InfoRow label="Project">{u.projectName ?? "—"}</InfoRow>
              <InfoRow label="Last active">{u.lastActiveAt ? timeAgo(u.lastActiveAt) : "—"}</InfoRow>
              <InfoRow label="Last login">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : "—"}</InfoRow>
            </div>
          </SectionCard>
          <SectionCard title={`Tasks (${data?.tasks.length ?? 0})`} icon={CalendarClock} noPad>
            <div className="px-4 py-2">
              {(data?.tasks ?? []).length === 0 ? <EmptyState title="No tasks assigned" /> : (
                <div className="space-y-1.5">
                  {(data?.tasks ?? []).map((t) => (
                    <div key={t.id} className="flex items-center justify-between rounded-xl bg-white/50 px-2.5 py-1.5 text-[12px]">
                      <div className="min-w-0"><div className="truncate font-medium text-[color:var(--ink)]">{t.title}</div><div className="text-[10.5px] text-[color:var(--ink-faint)]">{t.ref} · {t.priority} · {t.status}</div></div>
                      <Chip tone={t.status === "OVERDUE" ? "red" : t.status === "COMPLETED" ? "green" : "blue"}>{t.status}</Chip>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>
          <SectionCard title={`Recent submissions (${data?.submissions.length ?? 0})`} noPad>
            <div className="px-4 py-2">
              {(data?.submissions ?? []).length === 0 ? <EmptyState title="No submissions yet" /> : (
                <div className="space-y-1.5">
                  {(data?.submissions ?? []).map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-xl bg-white/50 px-2.5 py-1.5 text-[12px]">
                      <div className="min-w-0"><div className="truncate font-medium text-[color:var(--ink)]">{s.title}</div><div className="text-[10.5px] text-[color:var(--ink-faint)]">{s.ref} · due {fmtDateTime(s.dueDate)}</div></div>
                      <StatusBadge status={s.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      ) : <EmptyState title="User not found" />}
    </DetailSheetWrap>
  );
}

/* Local DetailSheet re-wrap to avoid importing sheet primitives directly. */
import { DetailSheet as DetailSheetWrap } from "@/components/workspace/ui";
