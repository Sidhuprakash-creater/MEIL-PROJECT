"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  UserPlus,
  Search,
  Bell,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  Shield,
  Mail,
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import { usePaStore, CONTRIBUTOR_CATEGORIES } from "@/lib/project-admin/store";
import { paApiGet, paApiPost, paApiPatch, getCachedPaData } from "@/lib/project-admin/client";
import { PaGlassCard, PaPageHeader, PaButton, PaStatusBadge, PaDialog, PaKpiCard } from "../ui";
import { MeilBoxLoader } from "@/components/shared/meil-loader";
import type { PaUserItem, ContributorRole } from "@/lib/project-admin/types";

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
  const [inviteRole, setInviteRole] = useState("ENV_DATA_USER");
  const [inviteSubmitting, setInviteSubmitting] = useState(false);

  // Edit / Action modal state
  const [activeUser, setActiveUser] = useState<PaUserItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

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
      await paApiPost("/api/project-admin/users", {
        name: inviteName,
        email: inviteEmail,
        role: inviteRole,
      });
      setInviteModalOpen(false);
      setInviteName("");
      setInviteEmail("");
      loadUsers();
    } catch (err: any) {
      alert(err.message || "Failed to invite user");
    } finally {
      setInviteSubmitting(false);
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
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(u)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          u.status === "ACTIVE"
                            ? "text-rose-500 hover:bg-rose-50 hover:text-rose-600"
                            : "text-emerald-600 hover:bg-emerald-50"
                        }`}
                        title={u.status === "ACTIVE" ? "Deactivate user" : "Activate user"}
                      >
                        {u.status === "ACTIVE" ? <UserX size={15} /> : <UserCheck size={15} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemind(u.id, u.name)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Send Reminder"
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
    </div>
  );
}
