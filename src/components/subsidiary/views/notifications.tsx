"use client";

// ── SUBSIDIARY ADMIN · Notifications & Alerts ──
// All / Unread tabs, category + date filters, mark-read mutations, Group
// announcements surfaced alongside subsidiary alerts. Polls via useSaApi.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight, BellOff, Check, CheckCheck, Mail,
} from "lucide-react";
import { BellIcon } from "@/components/workspace/premium-icons";
import {
  Chip, EmptyState, ErrorState, FadeList, GlassTabBar, LoadingBlock, PageHeader,
  SectionCard,
} from "@/components/workspace/ui";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useSaWorkspace, VIEW_META } from "@/lib/sa/store";
import { apiPatch, timeAgo, useMutation, useSaApi } from "@/lib/sa/client";
import type { SaNotification, SaViewId } from "@/lib/sa/types";
import { cn } from "@/lib/utils";

/* ── local types ── */
type NotificationsResponse = { notifications: SaNotification[]; unread: number };

const NTYPE_OPTIONS = [
  { value: "ALL", label: "All categories" },
  { value: "SUBMISSION", label: "Submission" },
  { value: "APPROVAL", label: "Approval" },
  { value: "DEADLINE", label: "Deadline" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "VALIDATION", label: "Validation" },
  { value: "PACKAGE", label: "Package" },
  { value: "EVIDENCE", label: "Evidence" },
  { value: "SYSTEM", label: "System" },
  { value: "MESSAGE", label: "Message" },
];
const NTYPE_LABELS: Record<string, string> = Object.fromEntries(
  NTYPE_OPTIONS.slice(1).map((o) => [o.value, o.label])
);
const DAY_OPTIONS = [
  { value: "0", label: "Any time" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: "#c34a4a", WARNING: "#c57926", SUCCESS: "#238653", INFO: "#3a7bff",
};

/* Severity dot with pulse while unread. */
function SeverityDot({ severity, unread }: { severity: string; unread: boolean }) {
  const color = SEVERITY_COLOR[severity] ?? SEVERITY_COLOR.INFO;
  return (
    <span className="relative mt-1.5 flex h-3 w-3 shrink-0" aria-hidden="true">
      {unread && <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: color }} />}
      <span className="relative inline-flex h-3 w-3 rounded-full" style={{ background: color }} />
    </span>
  );
}

const isValidView = (v: string): v is SaViewId => v in VIEW_META;

export default function NotificationsView() {
  const { navigate, params } = useSaWorkspace();
  const { toast } = useToast();

  /* ── view state ── */
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [category, setCategory] = useState("ALL");
  const [days, setDays] = useState("0");

  /* ── data (filter=all keeps All/Unread tab counts consistent in one fetch) ── */
  const listPath =
    `/api/sa/notifications?filter=all&limit=100` +
    `${category !== "ALL" ? `&category=${encodeURIComponent(category)}` : ""}` +
    `${days !== "0" ? `&days=${encodeURIComponent(days)}` : ""}`;
  const { data, loading, error, refetch } = useSaApi<NotificationsResponse>(listPath);

  const rowMut = useMutation();
  const markAllMut = useMutation();

  /* ── surface server errors via toast ── */
  useEffect(() => {
    if (error) toast({ title: "Could not load notifications", description: error, variant: "destructive" });
  }, [error, toast]);
  useEffect(() => {
    if (rowMut.error) toast({ title: "Could not update notification", description: rowMut.error, variant: "destructive" });
  }, [rowMut.error, toast]);
  useEffect(() => {
    if (markAllMut.error) toast({ title: "Could not mark all as read", description: markAllMut.error, variant: "destructive" });
  }, [markAllMut.error, toast]);

  const all = data?.notifications ?? [];
  const unreadInScope = useMemo(() => all.filter((n) => !n.read).length, [all]);
  const visible = tab === "unread" ? all.filter((n) => !n.read) : all;
  const serverUnread = data?.unread ?? 0;

  /* ── mutations ── */
  const toggleRead = async (n: SaNotification) => {
    const res = await rowMut.run(() => apiPatch("/api/sa/notifications", { ids: [n.id], read: !n.read }));
    if (res) {
      toast({ title: n.read ? "Marked as unread" : "Marked as read", description: n.title });
      refetch();
    }
  };
  const markAllRead = async () => {
    const res = await markAllMut.run(() => apiPatch("/api/sa/notifications", { all: true, read: true }));
    if (res) {
      toast({ title: "All notifications marked as read", description: "Your subsidiary and Group alerts are cleared." });
      refetch();
    }
  };
  const openRelated = (n: SaNotification) => {
    navigate(isValidView(n.linkView) ? n.linkView : "dashboard");
  };

  /* ── deep link: params.openId → mark read + jump to its linked view ── */
  const openId = typeof params.openId === "string" ? params.openId : "";
  const handledOpenId = useRef("");
  useEffect(() => {
    if (!openId || !data || handledOpenId.current === openId) return;
    handledOpenId.current = openId;
    const target = data.notifications.find((n) => n.id === openId);
    apiPatch("/api/sa/notifications", { ids: [openId], read: true })
      .then(() => refetch())
      .catch(() => {});
    if (target) navigate(isValidView(target.linkView) ? target.linkView : "dashboard");
    else navigate("notifications");
  }, [openId, data, navigate, refetch]);

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="Notifications & Alerts"
        description="Submissions, reviews, deadlines, validation and Group announcements — everything touching your subsidiary."
        icon={BellIcon}
        actions={
          <span className="glass-subtle inline-flex items-center gap-1.5 rounded-2xl px-3 py-2 text-[13px] font-medium text-[color:var(--ink-soft)]" aria-live="polite">
            <span className={cn("h-2 w-2 rounded-full", serverUnread > 0 ? "bg-[#3a7bff]" : "bg-[#238653]")} aria-hidden="true" />
            {serverUnread} unread
          </span>
        }
      />

      {/* ── toolbar row: tabs + category + date + mark all read ── */}
      <div className="glass glass-sheen flex flex-wrap items-center gap-2 rounded-3xl p-2">
        <GlassTabBar
          tabs={[
            { value: "all", label: "All", count: all.length },
            { value: "unread", label: "Unread", count: unreadInScope },
          ]}
          value={tab}
          onChange={(v) => setTab(v as "all" | "unread")}
          className="min-w-[190px] flex-1"
          aria-label="Read state"
        />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="glass-subtle h-10 w-auto min-w-[140px] rounded-2xl border-white/60 text-sm" aria-label="Category filter">
            <span className="mr-1 hidden text-xs text-[color:var(--ink-faint)] md:inline">Category:</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="glass-strong rounded-2xl border-white/70">
            {NTYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="glass-subtle h-10 w-auto min-w-[130px] rounded-2xl border-white/60 text-sm" aria-label="Date filter">
            <span className="mr-1 hidden text-xs text-[color:var(--ink-faint)] md:inline">Period:</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="glass-strong rounded-2xl border-white/70">
            {DAY_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          className="btn-action ml-auto rounded-2xl"
          onClick={markAllRead}
          disabled={serverUnread === 0 || markAllMut.pending}
        >
          {markAllMut.pending ? <CheckCheck className="mr-1.5 h-4 w-4 animate-pulse" /> : <CheckCheck className="mr-1.5 h-4 w-4" />}
          Mark all as read
        </Button>
      </div>

      {/* ── notification list ── */}
      {error && !data ? (
        <SectionCard><ErrorState message={error} onRetry={refetch} /></SectionCard>
      ) : loading && !data ? (
        <SectionCard><LoadingBlock rows={5} label="Loading notifications…" /></SectionCard>
      ) : visible.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon={BellOff}
            title={
              all.length === 0
                ? tab === "unread"
                  ? "You're all caught up"
                  : "No notifications yet"
                : tab === "unread"
                  ? "No unread notifications"
                  : "Nothing matches this filter"
            }
            message={
              all.length === 0
                ? "Alerts about submissions, deadlines, validation and Group announcements will appear here."
                : tab === "unread"
                  ? "Every notification in this scope has been read."
                  : "Try a different category, date range or switch to the All tab."
            }
          />
        </SectionCard>
      ) : (
        <FadeList className="flex flex-col gap-3">
          {visible.map((n) => (
            <article
              key={n.id}
              aria-label={`${n.title} — ${n.read ? "read" : "unread"}`}
              className="glass glass-sheen relative overflow-hidden rounded-3xl p-4"
            >
              {!n.read && <span className="pointer-events-none absolute inset-0 bg-[rgba(58,123,255,0.06)]" aria-hidden="true" />}
              {!n.read && <span className="absolute bottom-4 left-0 top-4 w-1 rounded-r-full bg-[#3a7bff]" aria-hidden="true" />}
              <div className="relative flex items-start gap-3">
                <SeverityDot severity={n.severity} unread={!n.read} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[14px] font-semibold text-[color:var(--ink)]">{n.title}</h3>
                    {!n.read && <span className="text-[10px] font-bold uppercase tracking-wider text-[#1d5fd6]">Unread</span>}
                  </div>
                  {n.body && <p className="mt-1 text-[13px] leading-relaxed text-[color:var(--ink-soft)]">{n.body}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Chip tone={n.origin === "group" ? "purple" : "teal"}>{n.origin === "group" ? "Group Admin" : "Subsidiary"}</Chip>
                    <Chip tone="gray">{NTYPE_LABELS[n.ntype] ?? n.ntype.replaceAll("_", " ")}</Chip>
                    <span className="text-[11px] text-[color:var(--ink-faint)]">{timeAgo(n.createdAt)}</span>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <Button
                      variant="outline" size="sm"
                      className="glass-subtle h-8 rounded-xl border-white/60 text-xs"
                      onClick={() => toggleRead(n)}
                      disabled={rowMut.pending}
                    >
                      {n.read ? <Mail className="mr-1.5 h-3.5 w-3.5" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
                      {n.read ? "Mark unread" : "Mark read"}
                    </Button>
                    <Button
                      variant="outline" size="sm"
                      className="glass-subtle h-8 rounded-xl border-white/60 text-xs"
                      onClick={() => openRelated(n)}
                    >
                      Open related <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </FadeList>
      )}
    </div>
  );
}
