"use client";

// ── BU ADMIN · SCREEN 02 — Notifications & Alerts ──
// Cross-console broadcast feed — every entry visible to Group/Subsidiary/BU Manager/Admin.

import { useEffect, useMemo, useState } from "react";
import { Bell, Check, CheckCheck, Inbox, X } from "lucide-react";
import { BellIcon } from "@/components/workspace/premium-icons";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBaWorkspace } from "@/lib/ba/store";
import { apiPatch, apiDelete, fmtDateTime, timeAgo, useBaApi, useMutation } from "@/lib/ba/client";
import type { SaNotification } from "@/lib/ba/types";
import {
  Chip, EmptyState, ErrorState, GlassCard, GlassTabBar, LoadingBlock, PageHeader, SectionCard,
} from "@/components/workspace/ui";
import { navForLinkView } from "@/components/ba/shared";

type Tab = "all" | "unread" | "deadlines" | "submissions" | "reviews" | "assignments";

const TAB_DEFS: { value: Tab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "deadlines", label: "Deadlines" },
  { value: "submissions", label: "Submissions" },
  { value: "reviews", label: "Review status" },
  { value: "assignments", label: "User + assignment" },
];

const CATEGORY_MAP: Record<Tab, string[]> = {
  all: [], unread: [],
  deadlines: ["DEADLINE", "OVERDUE", "REMINDER"],
  submissions: ["SUBMISSION", "EVIDENCE"],
  reviews: ["APPROVAL", "VALIDATION"],
  assignments: ["SYSTEM", "MESSAGE", "PACKAGE", "BU_DEMO"],
};

export default function NotificationsView() {
  const { navigate, params, setUnreadCount } = useBaWorkspace();
  const [tab, setTab] = useState<Tab>(() =>
    params.tab && (TAB_DEFS.map((t) => t.value) as string[]).includes(params.tab as string) ? (params.tab as Tab) : "all"
  );
  const [days, setDays] = useState("0");
  const [openId, setOpenId] = useState<string | null>(() => (params.openId ? (params.openId as string) : null));

  /* consume the deep-link once — openId/tab only seed initial state */
  useEffect(() => {
    if (params.openId || params.tab) {
      navigate("notifications", { ...params, openId: undefined, tab: undefined });
    }
  }, []);

  const tabQuery = tab === "all" ? "all" : tab === "unread" ? "unread" : "all";
  const { data, loading, error, refetch } = useBaApi<{ notifications: SaNotification[]; unread: number }>(
    `/api/ba/notifications?limit=80&filter=${tabQuery}&days=${days}`,
    { deps: [tabQuery, days] }
  );

  const categorySet = CATEGORY_MAP[tab];
  const rows = useMemo(() => {
    const all = data?.notifications ?? [];
    if (tab === "all" || tab === "unread") return all;
    return all.filter((n) => categorySet.includes(n.ntype));
  }, [data, tab, categorySet]);

  const unread = data?.unread ?? 0;
  useEffect(() => { setUnreadCount(unread); }, [unread, setUnreadCount]);

  const markOne = useMutation();
  const markAll = useMutation();

  const doMarkOne = async (n: SaNotification) => {
    if (n.read) return;
    await markOne.run(() => apiPatch(`/api/ba/notifications/${n.id}`, { read: true }));
    refetch();
  };
  const doMarkAll = async () => {
    await markAll.run(() => apiDelete(`/api/ba/notifications/all?all=1`));
    refetch();
  };

  const open = openId ? rows.find((r) => r.id === openId) ?? null : null;

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="Notifications & Alerts"
        description="Cross-console broadcast feed — every entry here is also visible on the Group Admin, Subsidiary Admin, Subsidiary Manager and BU Manager bells."
        icon={Bell}
        actions={
          <Button variant="outline" size="sm" className="glass-subtle rounded-2xl" onClick={() => void doMarkAll()} disabled={markAll.pending || unread === 0}>
            <CheckCheck className="mr-1.5 h-4 w-4" /> Mark all as read
          </Button>
        }
      />

      <GlassTabBar
        tabs={TAB_DEFS.map((t) => ({ ...t, count: t.value === "unread" ? unread : undefined }))}
        value={tab}
        onChange={(v) => setTab(v as Tab)}
      />

      <GlassCard className="glass-ba flex flex-wrap items-center gap-2 p-3">
        <span className="text-[12px] font-medium text-[color:var(--ink-soft)]">Filter:</span>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="h-9 w-[160px] rounded-2xl border-white/60 bg-white/60 text-[13px]" aria-label="Date range">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="glass-strong rounded-2xl border-white/70">
            <SelectItem value="0">All time</SelectItem>
            <SelectItem value="1">Last 24 hours</SelectItem>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-[12px] tabular text-[color:var(--ink-faint)]">
          {rows.length} notification{rows.length === 1 ? "" : "s"}{unread > 0 && ` · ${unread} unread`}
        </span>
      </GlassCard>

      {loading && !data ? (
        <LoadingBlock rows={6} label="Loading notifications…" />
      ) : error && !data ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : rows.length === 0 ? (
        <GlassCard className="glass-ba"><EmptyState title="No notifications" message="When reports are submitted, deadlines approach or activities occur in your BU, alerts will appear here." icon={Inbox} /></GlassCard>
      ) : (
        <div className="space-y-2">
          {rows.map((n) => (
            <GlassCard key={n.id} className={`glass-ba p-3 ${!n.read ? "border-[rgba(52,139,232,0.32)]" : ""}`}>
              <div className="flex items-start gap-3">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${n.severity === "CRITICAL" ? "bg-[#c34a4a]" : n.severity === "WARNING" ? "bg-[#c57926]" : n.severity === "SUCCESS" ? "bg-[#238653]" : "bg-[#348BE8]"} ${!n.read ? "pulse-dot" : ""}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[14px] ${n.read ? "font-medium text-[color:var(--ink-soft)]" : "font-semibold text-[color:var(--ink)]"}`}>{n.title}</span>
                    <Chip tone="blue">{n.ntype}</Chip>
                    {n.origin === "group" && <Chip tone="purple">broadcast</Chip>}
                  </div>
                  {n.body && <p className="mt-1 text-[13px] leading-relaxed text-[color:var(--ink-soft)]">{n.body}</p>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-[color:var(--ink-faint)]">
                    <span>{timeAgo(n.createdAt)} · {fmtDateTime(n.createdAt)}</span>
                    {n.refId && <span>ref · {n.refId}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {!n.read && (
                    <Button variant="ghost" size="sm" className="h-8 rounded-xl" onClick={() => void doMarkOne(n)} disabled={markOne.pending}>
                      <Check className="mr-1 h-3.5 w-3.5" /> Mark read
                    </Button>
                  )}
                  {n.linkView && (
                    <Button variant="ghost" size="sm" className="h-8 rounded-xl" onClick={() => navigate(navForLinkView(n.linkView), { openId: n.refId })}>
                      Open →
                    </Button>
                  )}
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Notification detail dialog (deep-linkable) */}
      {open && (
        <SectionCard title={open.title} icon={BellIcon} description={open.body}>
          <div className="space-y-2 text-[12.5px] text-[color:var(--ink-soft)]">
            <div className="flex items-center gap-2"><Chip tone="blue">{open.ntype}</Chip>{open.severity !== "INFO" && <Chip tone={open.severity === "CRITICAL" ? "red" : "amber"}>{open.severity}</Chip>}</div>
            <div>Received: {fmtDateTime(open.createdAt)} · {timeAgo(open.createdAt)}</div>
            {open.refId && <div>Reference: {open.refId}</div>}
            <div className="mt-2 flex gap-2">
              {!open.read && <Button size="sm" className="btn-ba-action rounded-2xl" onClick={() => void doMarkOne(open)} disabled={markOne.pending}>Mark as read</Button>}
              {open.linkView && <Button size="sm" variant="outline" className="rounded-2xl" onClick={() => navigate(navForLinkView(open.linkView), { openId: open.refId })}>Open {open.linkView}</Button>}
              <Button size="sm" variant="ghost" className="rounded-2xl" onClick={() => setOpenId(null)}><X className="mr-1 h-3.5 w-3.5" /> Close</Button>
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
