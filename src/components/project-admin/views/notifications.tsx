"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Filter,
  CheckCheck,
  Search,
  FileText,
  UserCheck,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  PaGlassCard,
  PaButton,
  PaPageHeader,
  PaStatusBadge,
} from "@/components/project-admin/ui";
import { paApiGet, paApiPost, paApiDelete, getCachedPaData } from "@/lib/project-admin/client";
import { usePaStore } from "@/lib/project-admin/store";
import type { PaNotificationItem, PaViewId } from "@/lib/project-admin/types";

export function NotificationsView() {
  const { navigate } = usePaStore();
  const cached = getCachedPaData<any>("/api/project-admin/notifications");
  const [notifications, setNotifications] = useState<PaNotificationItem[]>(cached?.notifications || []);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(!cached);
  const [isPending, startTransition] = useTransition();

  const loadNotifications = async () => {
    if (!notifications.length) setIsLoading(true);
    try {
      const res = await paApiGet<{ notifications: PaNotificationItem[] }>(
        "/api/project-admin/notifications"
      );
      setNotifications(res.notifications || []);
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await paApiPost(`/api/project-admin/notifications`, { id, action: "read" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  };

  const markAllAsRead = async () => {
    startTransition(async () => {
      try {
        await paApiPost(`/api/project-admin/notifications`, { action: "mark_all_read" });
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      } catch (err) {
        console.error("Failed to mark all as read:", err);
      }
    });
  };

  const filtered = notifications.filter((item) => {
    if (onlyUnread && item.isRead) return false;
    if (filterType !== "ALL" && item.type !== filterType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.message.toLowerCase().includes(q) ||
        (item.category && item.category.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "SUBMISSION":
        return <FileText className="w-5 h-5 text-blue-600" />;
      case "CORRECTION":
      case "REJECTION":
        return <AlertTriangle className="w-5 h-5 text-amber-600" />;
      case "TASK":
        return <Clock className="w-5 h-5 text-purple-600" />;
      case "APPROVAL":
        return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
      case "USER":
        return <UserCheck className="w-5 h-5 text-indigo-600" />;
      default:
        return <Bell className="w-5 h-5 text-[#315CFF]" />;
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <PaPageHeader
        title="Activity & Notification Hub"
        subtitle="Real-time operational alerts, BU Manager feedback, data submission tracking, and project notifications"
        badge="Command Dispatch"
        actions={
          <div className="flex items-center gap-2">
            <PaButton
              variant="secondary"
              size="sm"
              icon={<RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />}
              onClick={loadNotifications}
            >
              Refresh
            </PaButton>
            {unreadCount > 0 && (
              <PaButton
                variant="primary"
                size="sm"
                icon={<CheckCheck className="w-4 h-4" />}
                onClick={markAllAsRead}
                disabled={isPending}
              >
                Mark All Read ({unreadCount})
              </PaButton>
            )}
          </div>
        }
      />

      {/* Filter and stats row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <PaGlassCard className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            {notifications.length}
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
              Total Notifications
            </div>
            <div className="text-sm font-semibold text-slate-800">Operational Log</div>
          </div>
        </PaGlassCard>

        <PaGlassCard className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-[#6542F5] flex items-center justify-center font-bold">
            {unreadCount}
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
              Unread Items
            </div>
            <div className="text-sm font-semibold text-slate-800">Requires Attention</div>
          </div>
        </PaGlassCard>

        <PaGlassCard className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            {notifications.filter((n) => n.type === "CORRECTION" || n.type === "REJECTION").length}
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
              Feedback & Corrections
            </div>
            <div className="text-sm font-semibold text-slate-800">BU Review Loop</div>
          </div>
        </PaGlassCard>

        <PaGlassCard className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            {notifications.filter((n) => n.type === "APPROVAL" || n.type === "SUBMISSION").length}
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
              Submissions & Approvals
            </div>
            <div className="text-sm font-semibold text-slate-800">Workflow Milestones</div>
          </div>
        </PaGlassCard>
      </div>

      {/* Filter Controls */}
      <PaGlassCard className="p-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
            {["ALL", "SUBMISSION", "CORRECTION", "TASK", "APPROVAL", "USER"].map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  filterType === t
                    ? "bg-gradient-to-r from-[#315CFF] to-[#6542F5] text-white shadow-sm"
                    : "bg-white/70 text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                {t === "ALL" ? "All Activity" : t}
              </button>
            ))}
            <button
              onClick={() => setOnlyUnread(!onlyUnread)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ml-2 ${
                onlyUnread
                  ? "bg-purple-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
              }`}
            >
              Unread Only
            </button>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white/80 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
            />
          </div>
        </div>
      </PaGlassCard>

      {/* Notifications list */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#315CFF]" />
            Loading project alerts...
          </div>
        ) : filtered.length === 0 ? (
          <PaGlassCard className="p-12 text-center">
            <Bell className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h4 className="text-base font-semibold text-slate-700">No Notifications Found</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              You're all caught up! New contributor activity, task assignments, and review feedback will appear here.
            </p>
          </PaGlassCard>
        ) : (
          filtered.map((item) => (
            <PaGlassCard
              key={item.id}
              className={`p-4 transition-all hover:shadow-md ${
                !item.isRead
                  ? "border-l-4 border-l-[#315CFF] bg-white/90"
                  : "bg-white/60 opacity-90"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      !item.isRead ? "bg-blue-100/70" : "bg-slate-100"
                    }`}
                  >
                    {getTypeIcon(item.type ?? item.category ?? "SYSTEM")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-semibold text-slate-900">
                        {item.title}
                      </span>
                      {item.category && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          {item.category}
                        </span>
                      )}
                      {!item.isRead && (
                        <span className="w-2 h-2 rounded-full bg-[#315CFF]" />
                      )}
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed mb-2">
                      {item.message}
                    </p>
                    <div className="flex items-center gap-4 text-[11px] text-slate-400">
                      <span>{new Date(item.createdAt).toLocaleString()}</span>
                      {item.actionUrl && (
                        <button
                          onClick={() => {
                            if (!item.isRead) markAsRead(item.id);
                            if (item.actionUrl?.startsWith("#")) {
                              const viewId = item.actionUrl.replace("#", "") as PaViewId;
                              navigate(viewId);
                            }
                          }}
                          className="text-[#315CFF] font-semibold flex items-center gap-1 hover:underline"
                        >
                          View Action <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!item.isRead && (
                    <button
                      onClick={() => markAsRead(item.id)}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors"
                      title="Mark as read"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            </PaGlassCard>
          ))
        )}
      </div>
    </div>
  );
}
