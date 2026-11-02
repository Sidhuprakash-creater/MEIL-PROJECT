"use client";

// ── BU MANAGER · SCREEN 08 — Tasks & Deadlines ──
import { useMemo, useState } from "react";
import { CalendarClock, Hourglass } from "lucide-react";
import { HourglassIcon, TaskCheckIcon } from "@/components/workspace/premium-icons";
import { Button } from "@/components/ui/button";
import { useBmWorkspace } from "@/lib/bm/store";
import { fmtDate, timeAgo, useBmApi } from "@/lib/bm/client";
import type { BmAssignedTaskRow, BmTasksData } from "@/lib/bm/types";
import { DEADLINE_STATUS_LABELS } from "@/lib/bm/types";
import {
  Chip, CountUp, DataTable, EmptyState, ErrorState, GlassCard, GlassTabBar, LoadingBlock, PageHeader, SectionCard, type Column,
} from "@/components/workspace/ui";

type PendingRow = BmTasksData["pendingReviews"][number];
type DeadlineRow = BmTasksData["upcomingDeadlines"][number] & { id: string };

const PRIORITY_TONE: Record<string, "red" | "amber" | "purple" | "gray"> = {
  CRITICAL: "red", HIGH: "amber", MEDIUM: "purple", LOW: "gray",
};
const TASK_STATUS_TONE: Record<string, "red" | "amber" | "green" | "purple" | "gray"> = {
  OVERDUE: "red", ACTIVE: "purple", UPCOMING: "gray", COMPLETED: "green",
};
const TASK_STATUS_LABEL: Record<string, string> = {
  OVERDUE: "Overdue", ACTIVE: "Active", UPCOMING: "Upcoming", COMPLETED: "Completed",
};

const DEADLINE_TONE = (status: string): "red" | "amber" | "green" | "purple" | "gray" => {
  if (status === "OVERDUE") return "red";
  if (status === "DUE_SOON") return "amber";
  if (status === "CLOSED" || status === "SUBMITTED_ON_TIME") return "green";
  if (status === "IN_PROGRESS" || status === "SUBMITTED_LATE") return "purple";
  return "gray";
};

export default function TasksView() {
  const { navigate } = useBmWorkspace();
  const [tab, setTab] = useState<"list" | "calendar" | "assigned">("list");
  const { data, loading, error, refetch } = useBmApi<BmTasksData>("/api/bm/tasks");

  const pendingRows = useMemo(() => data?.pendingReviews ?? [], [data]);
  const assignedRows = useMemo(() => data?.assignedTasks ?? [], [data]);
  const upcomingRows = useMemo(
    () => (data?.upcomingDeadlines ?? []).map((d, i) => ({ id: `${d.level}-${d.name}-${i}`, ...d })),
    [data]
  );

  const pendingColumns: Column<PendingRow>[] = [
    {
      key: "ref", header: "Report", sortable: true, sortValue: (r) => r.ref,
      render: (r) => (
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-[color:var(--ink)]">{r.ref}</div>
          <div className="truncate text-[11px] text-[color:var(--ink-faint)]">{r.title}</div>
        </div>
      ),
    },
    { key: "project", header: "Project", render: (r) => <span className="text-[12.5px]">{r.project}</span> },
    { key: "submittedAt", header: "Submitted", sortable: true, sortValue: (r) => r.submittedAt, render: (r) => <span className="text-[12px]">{timeAgo(r.submittedAt)}</span> },
    {
      key: "reviewDeadline", header: "Review deadline", sortable: true, sortValue: (r) => r.reviewDeadline ?? "",
      render: (r) => (
        <div className="flex flex-col items-start gap-1">
          <span className="text-[12px]">{fmtDate(r.reviewDeadline)}</span>
          {r.overdue ? <Chip tone="red">Overdue</Chip> : <Chip tone={r.daysLeft === null ? "gray" : r.daysLeft <= 3 ? "red" : r.daysLeft <= 7 ? "amber" : "purple"}>{r.daysLeft === null ? "—" : r.daysLeft === 0 ? "Due today" : `${r.daysLeft}d left`}</Chip>}
        </div>
      ),
    },
  ];

  const upcomingColumns: Column<DeadlineRow>[] = [
    {
      key: "name", header: "Timeline", sortable: true, sortValue: (r) => r.name,
      render: (r) => (
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-[color:var(--ink)]">{r.name}</div>
          <div className="truncate text-[11px] text-[color:var(--ink-faint)]">{r.level}</div>
        </div>
      ),
    },
    { key: "level", header: "Level", render: (r) => <Chip tone={r.level === "PROJECT" ? "purple" : "blue"}>{r.level === "PROJECT" ? "Project" : "BU"}</Chip> },
    { key: "due", header: "Submission deadline", sortable: true, sortValue: (r) => r.dueDate, render: (r) => <span className="text-[12px]">{fmtDate(r.dueDate)}</span> },
    { key: "days", header: "Days left", sortable: true, sortValue: (r) => r.daysLeft, render: (r) => <span className="tabular text-[12.5px]">{r.daysLeft}</span> },
    { key: "status", header: "Status", render: (r) => <Chip tone={DEADLINE_TONE(r.status)}>{DEADLINE_STATUS_LABELS[r.status] ?? r.status}</Chip> },
  ];

  /* Read-only visibility of tasks the BU Admin assigned to this BU. */
  const assignedColumns: Column<BmAssignedTaskRow>[] = [
    {
      key: "task", header: "Task", sortable: true, sortValue: (r) => r.ref,
      render: (r) => (
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-[color:var(--ink)]">{r.title}</div>
          <div className="font-mono text-[10.5px] text-[color:var(--ink-faint)]">{r.ref}</div>
        </div>
      ),
    },
    { key: "assignee", header: "Assignee", render: (r) => <span className="truncate text-[12.5px] text-[color:var(--ink-soft)]">{r.assigneeLabel}</span> },
    { key: "priority", header: "Priority", render: (r) => <Chip tone={PRIORITY_TONE[r.priority] ?? "gray"}>{r.priority}</Chip> },
    { key: "status", header: "Status", render: (r) => <Chip tone={TASK_STATUS_TONE[r.status] ?? "gray"}>{TASK_STATUS_LABEL[r.status] ?? r.status}</Chip> },
    {
      key: "due", header: "Due", sortable: true, sortValue: (r) => r.dueDate,
      render: (r) => {
        const days = Math.ceil((new Date(r.dueDate).getTime() - Date.now()) / 86400000);
        return (
          <div className="flex flex-col items-start gap-1">
            <span className="text-[12px]">{fmtDate(r.dueDate)}</span>
            {r.overdue
              ? <Chip tone="red">Overdue</Chip>
              : <Chip tone={days <= 3 ? "red" : days <= 7 ? "amber" : "purple"}>{days === 0 ? "Due today" : `${days}d left`}</Chip>}
          </div>
        );
      },
    },
  ];

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="Tasks & Deadlines"
        description="Review deadlines, correction follow-ups and task tracking. Timelines are owned by the Subsidiary Admin (inheritance: SUBSIDIARY → BU → PROJECT) — you monitor and plan reviews against them. Distinguish review due dates from project submission deadlines."
        icon={Hourglass}
      />

      {/* Workload buckets */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          { label: "Due today", value: data?.reviewBuckets.dueToday ?? 0, hue: "#c57926" },
          { label: "Due within 7 days", value: data?.reviewBuckets.dueSoon ?? 0, hue: "#E9A23B" },
          { label: "Overdue reviews", value: data?.reviewBuckets.overdue ?? 0, hue: "#E35D6A" },
          { label: "Completed reviews", value: data?.reviewBuckets.completed ?? 0, hue: "#16A67A" },
          { label: "Awaiting correction", value: data?.correctionBuckets.awaitingCorrection ?? 0, hue: "#7045D6" },
          { label: "Overdue corrections", value: data?.correctionBuckets.overdueCorrections ?? 0, hue: "#a02a36" },
        ].map((c) => (
          <GlassCard key={c.label} className="glass-bum p-4">
            <div className="text-[24px] font-bold tabular leading-none" style={{ color: c.hue }}><CountUp value={c.value} /></div>
            <div className="mt-1.5 text-[11.5px] font-medium text-[color:var(--ink-soft)]">{c.label}</div>
          </GlassCard>
        ))}
      </div>

      {/* Blocked-by-evidence strip */}
      {(data?.blockedByEvidence.count ?? 0) > 0 && (
        <GlassCard className="glass-bum p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Chip tone="amber">{data?.blockedByEvidence.count} reports</Chip>
              <span className="text-[12.5px] font-semibold text-[color:var(--ink)]">Blocked by missing evidence</span>
            </div>
            <Button size="sm" variant="ghost" className="h-8 rounded-xl text-xs" onClick={() => navigate("evidence")}>
              Open Evidence Review
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {data?.blockedByEvidence.refs.map((ref) => (
              <Chip key={ref} tone="amber">{ref}</Chip>
            ))}
          </div>
        </GlassCard>
      )}

      {loading && !data && <LoadingBlock rows={5} label="Loading tasks…" />}
      {error && !data && <ErrorState message={error} onRetry={refetch} />}

      <GlassTabBar
        value={tab}
        onChange={(v) => setTab(v as "list" | "calendar" | "assigned")}
        tabs={[
          { value: "list", label: "Pending reviews" },
          { value: "calendar", label: "Upcoming deadlines" },
          { value: "assigned", label: "Tasks assigned to your BU", count: assignedRows.length },
        ]}
      />

      {data && tab === "list" && (
        <SectionCard title="Pending reviews" description="Reports in your queue, prioritised by review deadline urgency." icon={TaskCheckIcon}>
          <DataTable
            columns={pendingColumns}
            rows={pendingRows}
            pageSize={10}
            onRowClick={(r) => navigate("queue", { q: r.ref })}
            emptyTitle="No pending reviews"
            emptyMessage="Your review queue is clear."
          />
        </SectionCard>
      )}

      {data && tab === "calendar" && (
        <SectionCard title="Upcoming review deadlines" description="Effective review deadlines inherited from the timeline hierarchy." icon={CalendarClock}>
          <DataTable
            columns={upcomingColumns}
            rows={upcomingRows}
            pageSize={10}
            emptyTitle="No upcoming deadlines"
            emptyMessage="Reporting timelines set by the Subsidiary Admin appear here."
          />
        </SectionCard>
      )}

      {data && tab === "assigned" && (
        <SectionCard
          title="Tasks assigned to your BU"
          description="Read-only — tasks raised by your BU Admin (and asks naming you directly). Creation and reminders stay in the BU Admin workspace."
          icon={TaskCheckIcon}
        >
          <DataTable
            columns={assignedColumns}
            rows={assignedRows}
            pageSize={10}
            emptyTitle="No assigned tasks"
            emptyMessage="Tasks created by the BU Admin for this business unit will appear here."
          />
        </SectionCard>
      )}

      <div className="flex items-center gap-2 text-[11.5px] text-[color:var(--ink-faint)]">
        <HourglassIcon className="h-3.5 w-3.5 text-[color:var(--bum-purple-deep)]" />
        The BU Manager cannot edit timelines or extend deadlines — extension requests route to the Subsidiary Admin. Use the "send reminder" action from the review queue to nudge a responsible user via bmNotify.
      </div>
    </div>
  );
}
