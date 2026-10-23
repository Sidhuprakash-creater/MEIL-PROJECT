"use client";

// ── SUBSIDIARY MANAGER · SCREEN 02 — Notifications & Alerts ──
import { useEffect, useMemo, useState } from "react";
import { BellRing, CheckCheck } from "lucide-react";
import { BellIcon } from "@/components/workspace/premium-icons";
import { Button } from "@/components/ui/button";
import { useSmWorkspace } from "@/lib/sm/store";
import { apiPatch, timeAgo, useMutation, useSmApi } from "@/lib/sm/client";
import type { SaNotification } from "@/lib/sm/types";
import {
  Chip, EmptyState, ErrorState, GlassCard, GlassTabBar, LoadingBlock, PageHeader, Toolbar,
} from "@/components/workspace/ui";
import { ReportReviewDialog } from "@/components/manager/review-detail";

const SEVERITY_TONE: Record<string, string> = {
  CRITICAL: "#c34a4a", WARNING: "#c57926", SUCCESS: "#238653", INFO: "#3a7bff",
};

const NTYPE_LABELS: Record<string, string> = {
  SUBMISSION: "Submission", APPROVAL: "Review decision", DEADLINE: "Deadline",
  OVERDUE: "Overdue", DATA_QUALITY: "Data quality", SYSTEM: "System",
  PACKAGE: "Group package", MESSAGE: "Message", EVIDENCE: "Evidence", VALIDATION: "Validation",
};

/* Manager-view routing for notification links (manager workspace view ids). */
function linkTarget(linkView: string): "queue" | "reports-bu" | "evidence" | "deadlines" | "corrections" | "analytics" | "dashboard" {
  switch (linkView) {
    case "monitoring": return "queue";
    case "submissions": return "reports-bu";
    case "timelines": return "deadlines";
    case "evidence": return "evidence";
    case "validation": return "corrections";
    case "esg": return "analytics";
    default: return "dashboard";
  }
}

export default function NotificationsView() {
  const { params, navigate } = useSmWorkspace();
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [category, setCategory] = useState("ALL");
  const [days, setDays] = useState("ALL");
  const [search, setSearch] = useState("");
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  const { data, loading, error, refetch } = useSmApi<{ notifications: SaNotification[]; unread: number }>(
    `/api/sm/notifications?filter=${tab}&limit=100`
  );
  const mark = useMutation();

  /* Deep link: openId → mark read + route. */
  const openId = typeof params.openId === "string" ? params.openId : null;
  const [consumedOpenId, setConsumedOpenId] = useState<string | null>(null);

  const routeNotification = (n: SaNotification) => {
    /* Decision + submission notifications with a report reference open the
       review dialog directly; everything else navigates to the mapped module. */
    if (n.refId && ["APPROVAL", "SUBMISSION", "OVERDUE"].includes(n.ntype)) {
      setReviewId(n.refId);
      setReviewOpen(true);
    } else {
      navigate(linkTarget(n.linkView));
    }
  };

  useEffect(() => {
    if (!openId || consumedOpenId === openId) return;
    setConsumedOpenId(openId);
    const n = data?.notifications.find((x) => x.id === openId);
    if (n) {
      if (!n.read) void mark.run(() => apiPatch("/api/sm/notifications", { ids: [n.id], read: true })).then(() => refetch());
      routeNotification(n);
    }
  }, [openId, data, consumedOpenId]);

  const rows = useMemo(() => {
    let list = data?.notifications ?? [];
    if (category !== "ALL") list = list.filter((n) => n.ntype === category);
    if (days !== "ALL") {
      const since = Date.now() - Number(days) * 86400000;
      list = list.filter((n) => new Date(n.createdAt).getTime() >= since);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((n) => `${n.title} ${n.body}`.toLowerCase().includes(q));
    }
    return list;
  }, [data, category, days, search]);

  const categoryOptions = useMemo(() => {
    const set = new Set((data?.notifications ?? []).map((n) => n.ntype));
    return [{ value: "ALL", label: "All categories" }, ...[...set].map((c) => ({ value: c, label: NTYPE_LABELS[c] ?? c }))];
  }, [data]);

  const markOne = async (n: SaNotification, read: boolean) => {
    await mark.run(() => apiPatch("/api/sm/notifications", { ids: [n.id], read }));
    void refetch();
  };
  const markAll = async () => {
    await mark.run(() => apiPatch("/api/sm/notifications", { all: true, read: true }));
    void refetch();
  };

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="Notifications & Alerts"
        description="Submissions, review decisions, deadline alerts, evidence updates and Group announcements — one feed, persisted from real platform events."
        icon={BellRing}
        actions={
          <Button variant="outline" className="glass-subtle rounded-2xl" onClick={() => void markAll()} disabled={mark.pending || (data?.unread ?? 0) === 0}>
            <CheckCheck className="mr-1.5 h-4 w-4" /> Mark all as read
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <GlassTabBar
          value={tab}
          onChange={(v) => setTab(v as "all" | "unread")}
          tabs={[
            { value: "all", label: "All", count: data?.notifications.length ?? 0 },
            { value: "unread", label: "Unread", count: data?.unread ?? 0 },
          ]}
        />
        {data && data.unread > 0 && <Chip tone="blue">{data.unread} unread</Chip>}
      </div>

      <Toolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search notifications…"
        filters={[
          { key: "category", label: "Category", value: category, onChange: setCategory, options: categoryOptions },
          { key: "days", label: "Date", value: days, onChange: setDays, options: [{ value: "ALL", label: "All time" }, { value: "7", label: "Last 7 days" }, { value: "30", label: "Last 30 days" }] },
        ]}
        onReset={() => {
          setSearch("");
          setCategory("ALL");
          setDays("ALL");
        }}
        resultCount={rows.length}
      />

      {loading && !data && <LoadingBlock rows={6} label="Loading notifications…" />}
      {error && !data && <ErrorState message={error} onRetry={refetch} />}
      {data && rows.length === 0 && (
        <GlassCard className="p-6">
          <EmptyState title="Nothing here" message={tab === "unread" ? "You are all caught up — no unread notifications." : "No notifications match the current filters."} icon={BellIcon} />
        </GlassCard>
      )}

      <div className="space-y-2">
        {rows.map((n) => (
          <GlassCard key={n.id} className={`group flex items-start gap-3 p-4 transition-shadow hover:shadow-[0_10px_28px_rgba(56,113,153,0.12)] ${!n.read ? "ring-1 ring-[rgba(58,123,255,0.25)]" : ""}`}>
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: SEVERITY_TONE[n.severity] ?? "#3a7bff", opacity: n.read ? 0.35 : 1 }} />
            <button className="min-w-0 flex-1 text-left" onClick={() => routeNotification(n)}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-[13.5px] ${n.read ? "font-medium text-[color:var(--ink-soft)]" : "font-semibold text-[color:var(--ink)]"}`}>{n.title}</span>
                <Chip tone="gray">{NTYPE_LABELS[n.ntype] ?? n.ntype}</Chip>
                {n.origin === "group" && <Chip tone="purple">from Group Admin</Chip>}
                {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--esg-blue)]" aria-label="Unread" />}
              </div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-[color:var(--ink-soft)]">{n.body}</p>
              <p className="mt-1 text-[10.5px] text-[color:var(--ink-faint)]">{timeAgo(n.createdAt)}</p>
            </button>
            <div className="flex shrink-0 flex-col gap-1.5">
              <Button variant="ghost" size="sm" className="h-7 rounded-xl text-[11px]" onClick={() => routeNotification(n)}>
                {n.refId && ["APPROVAL", "SUBMISSION", "OVERDUE"].includes(n.ntype) ? "Open report" : "Open"}
              </Button>
              <Button variant="ghost" size="sm" className="h-7 rounded-xl text-[11px] text-[color:var(--ink-faint)]" onClick={() => void markOne(n, !n.read)}>
                Mark {n.read ? "unread" : "read"}
              </Button>
            </div>
          </GlassCard>
        ))}
      </div>

      <p className="text-[11.5px] text-[color:var(--ink-faint)]">
        Notification history persists with each event — nothing is purged when read. Preferences are available in Profile &amp; Preferences.
      </p>

      <ReportReviewDialog
        submissionId={reviewId}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        onDecided={() => void refetch()}
      />
    </div>
  );
}
