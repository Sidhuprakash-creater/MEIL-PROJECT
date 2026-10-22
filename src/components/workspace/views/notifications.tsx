"use client";

// ── SCREEN 02 — Notifications & Alerts ──
import { useEffect, useMemo, useState } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  CheckCircle2,
  Info,
  Mail,
  X,
} from "lucide-react";
import { useWorkspace } from "@/lib/esg/store";
import { apiPost, timeAgo, useApi, useMutation } from "@/lib/esg/client";
import type { Notification, ViewId } from "@/lib/esg/types";
import {
  EmptyState,
  ErrorState,
  LoadingBlock,
  PageHeader,
  SectionCard,
  StatusBadge,
  Toolbar,
} from "@/components/workspace/ui";
import { useToast } from "@/hooks/use-toast";

const TYPE_OPTIONS = [
  { value: "ALL", label: "All types" },
  { value: "DEADLINE", label: "Deadline" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "SUBMISSION", label: "Submission" },
  { value: "APPROVAL", label: "Approval" },
  { value: "DATA_QUALITY", label: "Data quality" },
  { value: "SYSTEM", label: "System" },
];

const READ_OPTIONS = [
  { value: "ALL", label: "All" },
  { value: "UNREAD", label: "Unread" },
  { value: "READ", label: "Read" },
];

function SeverityIcon({ severity }: { severity: string }) {
  const conf: Record<string, { icon: typeof Info; cls: string }> = {
    CRITICAL: { icon: AlertOctagon, cls: "bg-[rgba(195,74,74,0.12)] text-[#c34a4a]" },
    WARNING: { icon: AlertTriangle, cls: "bg-[rgba(197,121,38,0.13)] text-[#c57926]" },
    SUCCESS: { icon: CheckCircle2, cls: "bg-[rgba(35,134,83,0.12)] text-[#238653]" },
    INFO: { icon: Info, cls: "bg-[rgba(58,123,255,0.12)] text-[#3a7bff]" },
  };
  const c = conf[severity] ?? conf.INFO;
  const Icon = c.icon;
  return (
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${c.cls}`} aria-hidden="true">
      <Icon className="h-4.5 w-4.5" />
    </span>
  );
}

export default function NotificationsView() {
  const { navigate } = useWorkspace();
  const { toast } = useToast();
  const { data, loading, error, refetch } = useApi<{ notifications: Notification[]; unread: number }>("/api/esg/notifications");

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [readFilter, setReadFilter] = useState("ALL");

  const rowMut = useMutation();
  const dismissMut = useMutation();
  const readAllMut = useMutation();

  /* Reliable error surfacing: mutations return null on failure; the message lands in mut.error. */
  useEffect(() => {
    if (rowMut.error) toast({ title: "Could not update notification", description: rowMut.error, variant: "destructive" });
  }, [rowMut.error, toast]);
  useEffect(() => {
    if (dismissMut.error) toast({ title: "Could not dismiss notification", description: dismissMut.error, variant: "destructive" });
  }, [dismissMut.error, toast]);
  useEffect(() => {
    if (readAllMut.error) toast({ title: "Could not mark all as read", description: readAllMut.error, variant: "destructive" });
  }, [readAllMut.error, toast]);

  const notifications = data?.notifications ?? [];
  const unread = data?.unread ?? 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notifications.filter((n) => {
      if (q && !n.title.toLowerCase().includes(q) && !n.body.toLowerCase().includes(q)) return false;
      if (typeFilter !== "ALL" && n.ntype !== typeFilter) return false;
      if (readFilter === "UNREAD" && n.read) return false;
      if (readFilter === "READ" && !n.read) return false;
      return true;
    });
  }, [notifications, search, typeFilter, readFilter]);

  const markAllRead = async () => {
    const res = await readAllMut.run(() => apiPost("/api/esg/notifications", { action: "read-all" }));
    if (res) {
      toast({ title: "All notifications marked read" });
      refetch();
    }
  };

  const toggleRead = async (n: Notification) => {
    const res = await rowMut.run(() => apiPost("/api/esg/notifications", { action: n.read ? "unread" : "read", id: n.id }));
    if (res) {
      toast({ title: n.read ? "Marked as unread" : "Marked as read", description: n.title });
      refetch();
    }
  };

  const dismiss = async (n: Notification) => {
    const res = await dismissMut.run(() => apiPost("/api/esg/notifications", { action: "dismiss", id: n.id }));
    if (res) {
      toast({ title: "Notification dismissed", description: n.title });
      refetch();
    }
  };

  const openNotification = async (n: Notification) => {
    if (!n.read) {
      await rowMut.run(() => apiPost("/api/esg/notifications", { action: "read", id: n.id }));
      refetch();
    }
    navigate(n.linkView as ViewId);
  };

  return (
    <div className="view-in space-y-5">
      <PageHeader
        title="Notifications & Alerts"
        description="Deadlines, overdue alerts, approvals, and system notifications across the group."
        icon={Bell}
        breadcrumbs={["Group", "Overview", "Notifications"]}
        actions={
          <>
            <span className="glass-subtle inline-flex items-center gap-1.5 rounded-2xl px-3 py-2 text-[13px] font-medium text-[color:var(--ink-soft)]" aria-live="polite">
              <span className={`h-2 w-2 rounded-full ${unread > 0 ? "bg-[#3a7bff]" : "bg-[#238653]"}`} aria-hidden="true" />
              {unread} unread
            </span>
            <button
              onClick={markAllRead}
              disabled={unread === 0 || readAllMut.pending}
              className="glass inline-flex h-10 items-center gap-1.5 rounded-2xl border-white/60 px-4 text-[13px] font-medium text-[color:var(--ink)] transition-colors hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {readAllMut.pending ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[color:var(--esg-blue)] border-t-transparent" aria-hidden="true" />
              ) : (
                <CheckCheck className="h-4 w-4 text-[color:var(--esg-blue)]" aria-hidden="true" />
              )}
              Mark all read
            </button>
          </>
        }
      />

      <Toolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search notifications…"
        filters={[
          { key: "type", label: "Type", options: TYPE_OPTIONS, value: typeFilter, onChange: setTypeFilter },
          { key: "read", label: "Read", options: READ_OPTIONS, value: readFilter, onChange: setReadFilter },
        ]}
        onReset={() => {
          setSearch("");
          setTypeFilter("ALL");
          setReadFilter("ALL");
        }}
        resultCount={filtered.length}
      />

      {error && !data ? (
        <SectionCard><ErrorState message={error} onRetry={refetch} /></SectionCard>
      ) : loading && !data ? (
        <SectionCard><LoadingBlock rows={5} label="Loading notifications…" /></SectionCard>
      ) : filtered.length === 0 ? (
        <SectionCard>
          <EmptyState
            title={notifications.length === 0 ? "No notifications" : "Nothing matches your filters"}
            message={notifications.length === 0 ? "You're all caught up — alerts will appear here as they happen." : "Try adjusting the search or filter criteria."}
            icon={notifications.length === 0 ? BellOff : Bell}
          />
        </SectionCard>
      ) : (
        <div className="flex flex-col gap-3" role="list" aria-label="Notifications list">
          {filtered.map((n) => (
            <div
              key={n.id}
              role="listitem"
              className="glass glass-sheen glass-lift relative flex cursor-pointer items-start gap-3 rounded-3xl p-4"
              onClick={() => openNotification(n)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openNotification(n);
                }
              }}
              tabIndex={0}
              aria-label={`${n.title} — ${n.read ? "read" : "unread"}`}
            >
              {!n.read && <span className="absolute left-0 top-5 h-8 w-1 rounded-r-full bg-[#3a7bff]" aria-hidden="true" />}
              <SeverityIcon severity={n.severity} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-semibold text-[color:var(--ink)]">{n.title}</span>
                  <StatusBadge status={n.ntype} />
                  {!n.read && <span className="h-2 w-2 rounded-full bg-[#3a7bff]" aria-label="Unread" />}
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-[color:var(--ink-soft)]">{n.body}</p>
                <div className="mt-1.5 text-xs text-[color:var(--ink-faint)]">{timeAgo(n.createdAt)}</div>
              </div>
              <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => toggleRead(n)}
                  disabled={rowMut.pending}
                  title={n.read ? "Mark as unread" : "Mark as read"}
                  aria-label={n.read ? "Mark as unread" : "Mark as read"}
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-[color:var(--ink-soft)] transition-colors hover:bg-white/70 disabled:opacity-50"
                >
                  {n.read ? <Mail className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => dismiss(n)}
                  disabled={dismissMut.pending}
                  title="Dismiss"
                  aria-label="Dismiss notification"
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-[color:var(--ink-soft)] transition-colors hover:bg-[rgba(195,74,74,0.1)] hover:text-[#c34a4a] disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
