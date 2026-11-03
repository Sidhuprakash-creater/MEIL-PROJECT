"use client";

import React, { useState, useEffect } from "react";
import {
  CheckSquare,
  Plus,
  Calendar,
  Clock,
  Search,
  AlertCircle,
  Bell,
  RefreshCw,
  X,
  User,
  ShieldAlert,
} from "lucide-react";
import { usePaStore, CONTRIBUTOR_CATEGORIES } from "@/lib/project-admin/store";
import { paApiGet, paApiPost, paApiPatch, getCachedPaData } from "@/lib/project-admin/client";
import { PaGlassCard, PaPageHeader, PaButton, PaStatusBadge, PaDialog, PaTabStrip, PaKpiCard } from "../ui";
import type { PaTaskItem, ContributorRole } from "@/lib/project-admin/types";

export default function TasksView() {
  const cached = getCachedPaData<any>("/api/project-admin/tasks");
  const [loading, setLoading] = useState(!cached);
  const [tasks, setTasks] = useState<PaTaskItem[]>(cached?.tasks || []);
  const [summary, setSummary] = useState<any>(cached?.summary || null);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");

  // Create Task Modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ContributorRole>("ENV_DATA_USER");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [dueDate, setDueDate] = useState("2026-03-25");
  const [priority, setPriority] = useState("MEDIUM");
  const [usersList, setUsersList] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const loadTasks = () => {
    setLoading(true);
    paApiGet<any>("/api/project-admin/tasks")
      .then((res) => {
        setTasks(res.tasks || []);
        setSummary(res.summary || {});
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  const loadUsers = () => {
    paApiGet<any>("/api/project-admin/users").then((res) => {
      setUsersList(res.users || []);
      if (res.users?.length > 0 && !assignedUserId) {
        setAssignedUserId(res.users[0].id);
      }
    });
  };

  useEffect(() => {
    loadTasks();
    loadUsers();
  }, []);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await paApiPost("/api/project-admin/tasks", {
        title,
        description,
        category,
        assignedUserId,
        dueDate,
        priority,
      });
      setCreateModalOpen(false);
      setTitle("");
      setDescription("");
      loadTasks();
    } catch (err: any) {
      alert(err.message || "Failed to create task");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemind = async (taskId: string) => {
    try {
      await paApiPatch("/api/project-admin/tasks", { id: taskId, action: "remind" });
      alert("Deadline reminder notification dispatched.");
    } catch (err: any) {
      alert(err.message || "Failed to send reminder");
    }
  };

  const tabs = [
    { id: "all", label: "All Tasks", count: tasks.length },
    { id: "pending", label: "In Progress / Pending", count: summary?.pending || 0 },
    { id: "overdue", label: "Overdue", count: summary?.overdue || 0 },
    { id: "completed", label: "Completed", count: summary?.completed || 0 },
  ];

  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      !search ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.assignedUserName.toLowerCase().includes(search.toLowerCase()) ||
      t.ref.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;
    if (activeTab === "pending") return t.status === "PENDING" || t.status === "IN_PROGRESS";
    if (activeTab === "overdue") return t.status === "OVERDUE";
    if (activeTab === "completed") return t.status === "COMPLETED";
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PaPageHeader
        title="Reporting Task Assignments"
        subtitle="Delegate operational reporting disclosures & enforce milestone timelines within BU policy"
        actions={
          <PaButton icon={Plus} onClick={() => setCreateModalOpen(true)}>
            Assign Reporting Task
          </PaButton>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <PaKpiCard title="Total Tasks" value={summary?.total || tasks.length} icon={CheckSquare} accentColor="#315CFF" />
        <PaKpiCard title="Active / Pending" value={summary?.pending || 0} icon={Clock} accentColor="#E9A23B" />
        <PaKpiCard title="Overdue Tasks" value={summary?.overdue || 0} icon={AlertCircle} accentColor="#E35D6A" />
        <PaKpiCard title="Completed" value={summary?.completed || 0} icon={CheckSquare} accentColor="#16A67A" />
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <PaTabStrip tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search tasks or assignees…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/80 border border-slate-200 text-xs font-semibold focus:outline-none"
          />
        </div>
      </div>

      {/* Tasks Table */}
      <PaGlassCard strong className="overflow-x-auto p-0">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200/80 bg-slate-50/60 text-[#64748B] font-bold uppercase tracking-wider text-[11px]">
              <th className="p-4 pl-6">Task Reference & Description</th>
              <th className="p-4">Category</th>
              <th className="p-4">Assigned Contributor</th>
              <th className="p-4">Submission Deadline</th>
              <th className="p-4">Priority</th>
              <th className="p-4">Status</th>
              <th className="p-4 pr-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTasks.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-[#64748B]">
                  No reporting assignments found in this view.
                </td>
              </tr>
            ) : (
              filteredTasks.map((t) => (
                <tr key={t.id} className="hover:bg-white/80 transition-colors">
                  <td className="p-4 pl-6">
                    <div className="font-mono font-bold text-[#315CFF] text-[11px]">{t.ref}</div>
                    <div className="font-bold text-[#202938] text-sm mt-0.5">{t.title}</div>
                    {t.description && <div className="text-[11px] text-[#64748B] line-clamp-1">{t.description}</div>}
                  </td>
                  <td className="p-4">
                    <span className="px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-700 font-bold text-[11px]">
                      {t.categoryLabel}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="font-semibold text-[#202938]">{t.assignedUserName}</div>
                    <div className="text-[10px] text-[#64748B]">{t.assignedUserRole}</div>
                  </td>
                  <td className="p-4">
                    <div className={`font-bold ${t.daysRemaining < 3 && t.status !== "COMPLETED" ? "text-rose-600" : "text-[#202938]"}`}>
                      {new Date(t.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </div>
                    <div className="text-[10px] text-[#8F9EAF]">
                      {t.daysRemaining >= 0 ? `${t.daysRemaining} days left` : `${Math.abs(t.daysRemaining)} days overdue`}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                      t.priority === "URGENT" || t.priority === "HIGH" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-700"
                    }`}>
                      {t.priority}
                    </span>
                  </td>
                  <td className="p-4">
                    <PaStatusBadge status={t.status} />
                  </td>
                  <td className="p-4 pr-6 text-right">
                    <button
                      type="button"
                      onClick={() => handleRemind(t.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Send Deadline Reminder"
                    >
                      <Bell size={15} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </PaGlassCard>

      {/* ── Create Task Dialog ── */}
      <PaDialog
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Assign Reporting Responsibility"
        subtitle="Assign an ESG disclosure task to an authorized contributor"
      >
        <form onSubmit={handleCreateTask} className="space-y-4 text-xs">
          <div>
            <label className="text-[11px] font-bold uppercase text-[#8F9EAF]">Task Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Upload Q4 Energy & Diesel Meter Logs"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full p-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold uppercase text-[#8F9EAF]">Contributor Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ContributorRole)}
                className="mt-1 w-full p-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold"
              >
                {(Object.keys(CONTRIBUTOR_CATEGORIES) as ContributorRole[]).map((k) => (
                  <option key={k} value={k}>
                    {CONTRIBUTOR_CATEGORIES[k].name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase text-[#8F9EAF]">Assign Contributor User *</label>
              <select
                value={assignedUserId}
                onChange={(e) => setAssignedUserId(e.target.value)}
                className="mt-1 w-full p-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold"
              >
                {usersList.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.roleLabel})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold uppercase text-[#8F9EAF]">Task Deadline *</label>
              <input
                type="date"
                required
                max="2026-03-31"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1 w-full p-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold"
              />
              <p className="mt-1 text-[10px] text-amber-700">
                Cannot exceed inherited BU deadline (31 Mar 2026).
              </p>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase text-[#8F9EAF]">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="mt-1 w-full p-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase text-[#8F9EAF]">Instructions & Evidence Requirements</label>
            <textarea
              rows={3}
              placeholder="Specify requirements, calculation parameters, and required proof documents…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full p-3 rounded-xl border border-slate-200 bg-white text-xs font-medium"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-200/60">
            <PaButton variant="secondary" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </PaButton>
            <PaButton type="submit" loading={submitting}>
              Assign Responsibility
            </PaButton>
          </div>
        </form>
      </PaDialog>
    </div>
  );
}

