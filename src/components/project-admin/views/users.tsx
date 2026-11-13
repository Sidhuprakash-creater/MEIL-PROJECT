"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  UserPlus,
  Search,
  Bell,
  AlertCircle,
  Mail,
  UserCheck,
  UserX,
  Eye,
  Pencil,
  KeyRound,
  Trash2,
} from "lucide-react";
import { paApiGet, paApiPost, paApiPatch, paApiDelete, getCachedPaData } from "@/lib/project-admin/client";
import { PaGlassCard, PaPageHeader, PaButton, PaStatusBadge, PaDialog, PaKpiCard } from "../ui";
import { MeilBoxLoader } from "@/components/shared/meil-loader";
import { ResetRequestsPanel } from "@/components/auth/reset-requests-panel";
import { TempPasswordModal } from "@/components/auth/password-recovery-modals";
import type { PaUserItem } from "@/lib/project-admin/types";

export default function UsersView() {
  const cached = getCachedPaData<any>("/api/project-admin/users");
  const [loading, setLoading] = useState(!cached);
  const [users, setUsers] = useState<PaUserItem[]>(cached?.users || []);
  const [summary, setSummary] = useState<any>(cached?.summary || null);
  const [permittedRoles, setPermittedRoles] = useState<{ code: string; label: string }[]>(cached?.permittedRoles || []);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");

  // Invite modal state
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteGoogleEmail, setInviteGoogleEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("ENV_DATA_USER");
  const [inviteSubmitting, setInviteSubmitting] = useState(false);

  // Edit / Dossier / Temp Password state
  const [editingUser, setEditingUser] = useState<PaUserItem | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editGoogleEmail, setEditGoogleEmail] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [infoUserId, setInfoUserId] = useState<string | null>(null);
  const [infoDossier, setInfoDossier] = useState<{
    user: {
      id: string;
      name: string;
      email: string;
      googleEmail: string | null;
      authProvider: string;
      mustChangePassword: boolean;
      employeeId: string | null;
      roleLabel: string;
      status: string;
      phone: string;
      title: string;
      projectName: string | null;
      lastActiveAt: string | null;
      lastLoginAt: string | null;
    };
    sessions: { id: string; userAgent: string; ip: string; createdAt: string; expiresAt: string }[];
    lastLogins: { eventType: string; result: string; createdAt: string; ip: string }[];
    submissions: { id: string; ref: string; title: string; category: string; status: string; updatedAt: string }[];
  } | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [tempPwd, setTempPwd] = useState<{ userName: string; password: string; note: string } | null>(null);

  const loadUsers = () => {
    if (!users.length) setLoading(true);
    paApiGet<any>("/api/project-admin/users")
      .then((res) => {
        setUsers(res.users || []);
        setSummary(res.summary || {});
        setPermittedRoles(res.permittedRoles || []);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteSubmitting(true);
    try {
      const res = await paApiPost<{ tempPassword?: string; emailSent?: boolean; emailNote?: string }>("/api/project-admin/users", {
        name: inviteName,
        email: inviteEmail,
        googleEmail: inviteGoogleEmail.trim().toLowerCase() || undefined,
        role: inviteRole,
      });
      if (res?.tempPassword) {
        setTempPwd({
          userName: inviteName.trim(),
          password: res.tempPassword,
          note: res.emailSent
            ? "Temporary password emailed to user via SMTP and shown once here. Contributor must change it on first login."
            : res.emailNote || "Share securely — contributor must change it on first sign-in.",
        });
      }
      setInviteModalOpen(false);
      setInviteName("");
      setInviteEmail("");
      setInviteGoogleEmail("");
      loadUsers();
    } catch (err: any) {
      alert(err.message || "Failed to invite user");
    } finally {
      setInviteSubmitting(false);
    }
  };

  const openInfo = async (userId: string) => {
    setInfoUserId(userId);
    setInfoDossier(null);
    setInfoLoading(true);
    try {
      const data = await paApiGet<NonNullable<typeof infoDossier>>(`/api/project-admin/users/${userId}`, undefined, { bypassCache: true });
      setInfoDossier(data);
    } catch (err: any) {
      alert(err.message || "Failed to load user details");
      setInfoUserId(null);
    } finally {
      setInfoLoading(false);
    }
  };

  const openEdit = (u: PaUserItem) => {
    setEditingUser(u);
    setEditRole(u.role);
    setEditGoogleEmail(u.googleEmail ?? "");
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditSubmitting(true);
    try {
      await paApiPatch("/api/project-admin/users", {
        id: editingUser.id,
        role: editRole,
        googleEmail: editGoogleEmail.trim().toLowerCase() || null,
      });
      setEditingUser(null);
      loadUsers();
    } catch (err: any) {
      alert(err.message || "Failed to update user");
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleResetCredential = async (u: PaUserItem) => {
    if (!confirm(`Generate a new one-time temporary password for ${u.name}? Active sessions will be revoked.`)) return;
    try {
      const res = await paApiPatch<{ tempPassword?: string; emailSent?: boolean }>("/api/project-admin/users", {
        id: u.id,
        action: "reset-credential",
      });
      if (res?.tempPassword) {
        setTempPwd({
          userName: u.name,
          password: res.tempPassword,
          note: res.emailSent
            ? "Temporary password emailed to user via SMTP and active sessions revoked."
            : "Temporary password generated and active sessions revoked. Share securely — user must update it on next login.",
        });
      }
      loadUsers();
    } catch (err: any) {
      alert(err.message || "Failed to reset credential");
    }
  };

  const handleDeactivate = async (u: PaUserItem) => {
    if (!confirm(`Deactivate ${u.name}? Active sessions are revoked and historical records are preserved.`)) return;
    try {
      await paApiDelete(`/api/project-admin/users?id=${encodeURIComponent(u.id)}`);
      loadUsers();
    } catch (err: any) {
      alert(err.message || "Failed to deactivate user");
    }
  };

  const handleRemind = async (userId: string, name: string) => {
    try {
      await paApiPatch("/api/project-admin/users", {
        id: userId,
        action: "remind",
      });
      alert(`Reminder notification dispatched to ${name}.`);
    } catch (err: any) {
      alert(err.message || "Failed to send reminder");
    }
  };

  const handleToggleStatus = async (user: PaUserItem) => {
    const nextStatus = user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    if (!confirm(`Are you sure you want to change status of ${user.name} to ${nextStatus}?`)) return;

    try {
      await paApiPatch("/api/project-admin/users", {
        id: user.id,
        status: nextStatus,
      });
      loadUsers();
    } catch (err: any) {
      alert(err.message || "Failed to change user status");
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.employeeId.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "ALL" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PaPageHeader
        title="User Management & Delegations"
        subtitle="Manage assigned site team across the 7 authorized contributor categories"
        actions={
          <PaButton icon={UserPlus} onClick={() => setInviteModalOpen(true)}>
            Invite Contributor
          </PaButton>
        }
      />

      {/* KPI Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <PaKpiCard title="Total Users" value={summary?.totalUsers || users.length} icon={Users} accentColor="#315CFF" />
        <PaKpiCard title="Active Users" value={summary?.activeUsers || 0} icon={UserCheck} accentColor="#16A67A" />
        <PaKpiCard title="Inactive / Idle" value={summary?.inactiveUsers || 0} icon={UserX} accentColor="#64748B" />
        <PaKpiCard title="Pending Invites" value={summary?.pendingInvitations || 0} icon={Mail} accentColor="#E9A23B" />
        <PaKpiCard title="Pending Submissions" value={summary?.pendingSubmissions || 0} icon={AlertCircle} accentColor="#E35D6A" />
      </div>

      {/* Toolbar filters */}
      <PaGlassCard className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, email or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/80 border border-slate-200 text-xs font-semibold focus:outline-none focus:border-blue-400"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <span className="text-xs font-bold text-[#64748B] whitespace-nowrap">Filter Role:</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white/80 border border-slate-200 text-xs font-semibold text-[#202938]"
          >
            <option value="ALL">All Contributor Roles</option>
            {permittedRoles.map((r) => (
              <option key={r.code} value={r.code}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </PaGlassCard>

      <ResetRequestsPanel onUpdated={loadUsers} />

      {/* User Table */}
      {loading ? (
        <div className="glass rounded-2xl p-6">
          <MeilBoxLoader boxHeight="min-h-[240px]" label="Loading users…" />
        </div>
      ) : (
      <PaGlassCard strong className="overflow-x-auto p-0">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200/80 bg-slate-50/60 text-[#64748B] font-bold uppercase tracking-wider text-[11px]">
              <th className="p-4 pl-6">User / Identity</th>
              <th className="p-4">Assigned Role</th>
              <th className="p-4">Reporting Section</th>
              <th className="p-4">Submission Status</th>
              <th className="p-4">Last Active</th>
              <th className="p-4">Account Status</th>
              <th className="p-4 pr-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-[#64748B]">
                  No authorized project users found matching your criteria.
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-white/80 transition-colors">
                  <td className="p-4 pl-6">
                    <div className="font-bold text-[#202938] text-sm">{u.name}</div>
                    <div className="text-[11px] text-[#64748B] font-mono">{u.email} • {u.employeeId}</div>
                  </td>
                  <td className="p-4">
                    <span className="px-2.5 py-1 rounded-xl bg-blue-50 text-blue-700 font-bold text-[11px]">
                      {u.roleLabel}
                    </span>
                  </td>
                  <td className="p-4 font-semibold text-[#202938]">
                    {u.assignedSections?.join(", ") || "General"}
                  </td>
                  <td className="p-4">
                    <PaStatusBadge status={u.submissionStatus} />
                  </td>
                  <td className="p-4 text-[#64748B]">
                    {u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleDateString() : "Never"}
                  </td>
                  <td className="p-4">
                    <PaStatusBadge status={u.status} />
                  </td>
                  <td className="p-4 pr-6 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => void openInfo(u.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title="View User Info & Sessions"
                      >
                        <Eye size={15} />
                      </button>
                      {permittedRoles.some((r) => r.code === u.role) && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEdit(u)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                            title="Edit role & Google SSO"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleResetCredential(u)}
                            className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors"
                            title="Reset Credential (Temp Password)"
                          >
                            <KeyRound size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(u)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              u.status === "ACTIVE"
                                ? "text-rose-500 hover:bg-rose-50 hover:text-rose-600"
                                : "text-emerald-600 hover:bg-emerald-50"
                            }`}
                            title={u.status === "ACTIVE" ? "Mark inactive" : "Activate user"}
                          >
                            {u.status === "ACTIVE" ? <UserX size={15} /> : <UserCheck size={15} />}
                          </button>
                          {u.status !== "INACTIVE" && (
                            <button
                              type="button"
                              onClick={() => void handleDeactivate(u)}
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Soft deactivate & revoke sessions"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemind(u.id, u.name)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Send Reminder (In-App + Email)"
                      >
                        <Bell size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </PaGlassCard>
      )}

      {/* ── Invite Contributor Modal ── */}
      <PaDialog
        open={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        title="Invite Project Contributor"
        subtitle="Authorized Project Admin can only assign one of the seven designated contributor roles"
      >
        <form onSubmit={handleInvite} className="space-y-4 text-xs">
          <div>
            <label className="text-[11px] font-bold uppercase text-[#8F9EAF]">Full Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Er. Sunil Kumar"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              className="mt-1 w-full p-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase text-[#8F9EAF]">Corporate Email *</label>
            <input
              type="email"
              required
              placeholder="e.g. sunil.kumar@meil.in"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="mt-1 w-full p-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase text-[#8F9EAF]">Google Sign-In Email (Optional)</label>
            <input
              type="email"
              placeholder="e.g. sunil@gmail.com (for Google SSO)"
              value={inviteGoogleEmail}
              onChange={(e) => setInviteGoogleEmail(e.target.value)}
              className="mt-1 w-full p-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase text-[#8F9EAF]">Assign Contributor Role *</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="mt-1 w-full p-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold"
            >
              {permittedRoles.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-[11px] text-[#64748B]">
              Only the seven defined contributor roles can be assigned by Project Admin.
            </p>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-200/60">
            <PaButton variant="secondary" onClick={() => setInviteModalOpen(false)}>
              Cancel
            </PaButton>
            <PaButton type="submit" loading={inviteSubmitting}>
              Send Invitation
            </PaButton>
          </div>
        </form>
      </PaDialog>

      {/* ── Edit Contributor Modal ── */}
      <PaDialog
        open={!!editingUser}
        onClose={() => setEditingUser(null)}
        title={editingUser ? `Edit ${editingUser.name}` : "Edit Contributor"}
        subtitle={editingUser ? `${editingUser.email} • ${editingUser.employeeId}` : ""}
      >
        <form onSubmit={handleEditSave} className="space-y-4 text-xs">
          <div>
            <label className="text-[11px] font-bold uppercase text-[#8F9EAF]">Google Sign-In Email (Optional)</label>
            <input
              type="email"
              placeholder="e.g. user@gmail.com"
              value={editGoogleEmail}
              onChange={(e) => setEditGoogleEmail(e.target.value)}
              className="mt-1 w-full p-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase text-[#8F9EAF]">Assigned Contributor Role</label>
            <select
              value={editRole}
              onChange={(e) => setEditRole(e.target.value)}
              className="mt-1 w-full p-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold"
            >
              {permittedRoles.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-200/60">
            <PaButton variant="secondary" onClick={() => setEditingUser(null)}>Cancel</PaButton>
            <PaButton type="submit" loading={editSubmitting}>Save Changes</PaButton>
          </div>
        </form>
      </PaDialog>

      {/* ── User Info & Security Dossier Modal ── */}
      <PaDialog
        open={!!infoUserId}
        onClose={() => { setInfoUserId(null); setInfoDossier(null); }}
        title={infoDossier?.user ? `${infoDossier.user.name} — User Info` : "User Info"}
        subtitle={infoDossier?.user ? `${infoDossier.user.roleLabel} · ${infoDossier.user.employeeId ?? "No Employee ID"}` : "Loading user dossier…"}
      >
        {infoLoading || !infoDossier ? (
          <MeilBoxLoader boxHeight="min-h-[160px]" label="Loading user dossier…" />
        ) : (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-2.5 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3">
              <div><span className="text-[#8F9EAF]">Email:</span> <span className="font-semibold text-[#202938]">{infoDossier.user.email}</span></div>
              <div><span className="text-[#8F9EAF]">Status:</span> <PaStatusBadge status={infoDossier.user.status} /></div>
              <div><span className="text-[#8F9EAF]">Google SSO:</span> <span className="font-semibold text-[#202938]">{infoDossier.user.googleEmail || "Not linked"}</span></div>
              <div><span className="text-[#8F9EAF]">Auth Provider:</span> <span className="font-semibold text-[#202938]">{infoDossier.user.authProvider}</span></div>
              <div><span className="text-[#8F9EAF]">Last Login:</span> <span className="font-semibold text-[#202938]">{infoDossier.user.lastLoginAt ? new Date(infoDossier.user.lastLoginAt).toLocaleString() : "Never"}</span></div>
              <div><span className="text-[#8F9EAF]">Last Active:</span> <span className="font-semibold text-[#202938]">{infoDossier.user.lastActiveAt ? new Date(infoDossier.user.lastActiveAt).toLocaleString() : "Never"}</span></div>
            </div>

            <div>
              <h4 className="mb-1.5 text-[11px] font-bold uppercase text-[#64748B]">Active Sessions ({infoDossier.sessions.length})</h4>
              {infoDossier.sessions.length === 0 ? (
                <p className="text-[#8F9EAF]">No active sessions.</p>
              ) : (
                <div className="space-y-1.5">
                  {infoDossier.sessions.map((s) => (
                    <div key={s.id} className="rounded-xl border border-slate-200/70 bg-white px-3 py-2">
                      <div className="font-semibold text-[#202938]">{s.ip || "Unknown IP"} · started {new Date(s.createdAt).toLocaleString()}</div>
                      <div className="truncate text-[11px] text-[#64748B]">{s.userAgent || "Browser session"}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h4 className="mb-1.5 text-[11px] font-bold uppercase text-[#64748B]">Recent Login & Security Events ({infoDossier.lastLogins.length})</h4>
              {infoDossier.lastLogins.length === 0 ? (
                <p className="text-[#8F9EAF]">No login history recorded yet.</p>
              ) : (
                <div className="space-y-1">
                  {infoDossier.lastLogins.slice(0, 6).map((l, idx) => (
                    <div key={`${l.createdAt}-${idx}`} className="flex items-center justify-between rounded-xl border border-slate-200/60 bg-white px-3 py-1.5">
                      <span className="font-medium text-[#202938]">{l.eventType} ({l.result})</span>
                      <span className="text-[11px] text-[#64748B]">{new Date(l.createdAt).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </PaDialog>

      <TempPasswordModal data={tempPwd} onClose={() => setTempPwd(null)} />
    </div>
  );
}
