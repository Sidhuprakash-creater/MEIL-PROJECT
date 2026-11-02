"use client";

// ── SUBSIDIARY MANAGER · SCREEN 08 — Tasks & Deadlines ──
import { useMemo, useState } from "react";
import { CalendarClock, Hourglass } from "lucide-react";
import { HourglassIcon, TaskCheckIcon } from "@/components/workspace/premium-icons";
import { fmtDate, useSmApi } from "@/lib/sm/client";
import type { DeadlinesData } from "@/lib/sm/types";
import { DEADLINE_STATUS_LABELS } from "@/lib/sm/types";
import {
  Chip, CountUp, DataTable, EmptyState, ErrorState, GlassCard, GlassTabBar, PageHeader, SectionCard, type Column,
} from "@/components/workspace/ui";

type DeadlineRow = DeadlinesData["timelines"][number];
type TaskRow = DeadlinesData["tasks"][number];

const DEADLINE_TONE = (status: string): "red" | "amber" | "green" | "blue" | "gray" => {
  if (status === "OVERDUE") return "red";
  if (status === "DUE_SOON") return "amber";
  if (status === "CLOSED" || status === "SUBMITTED_ON_TIME") return "green";
  if (status === "IN_PROGRESS" || status === "SUBMITTED_LATE") return "blue";
  return "gray";
};

const PRIORITY_TONE: Record<string, "red" | "amber" | "blue" | "gray"> = {
  CRITICAL: "red", HIGH: "red", MEDIUM: "amber", LOW: "gray",
};

export default function DeadlinesView() {
  const [tab, setTab] = useState<"calendar" | "list">("list");
  const [periodFilter, setPeriodFilter] = useState("ALL");
  const [levelFilter, setLevelFilter] = useState("ALL");

  const { data, loading, error, refetch } = useSmApi<DeadlinesData>("/api/sm/deadlines");

  const timelines = useMemo(() => {
    let list = data?.timelines ?? [];
    if (periodFilter !== "ALL") list = list.filter((t) => t.period === periodFilter);
    if (levelFilter !== "ALL") list = list.filter((t) => t.level === levelFilter);
    return list;
  }, [data, periodFilter, levelFilter]);

  const timelineColumns: Column<DeadlineRow>[] = [
    {
      key: "name", header: "Timeline", sortable: true, sortValue: (t) => t.name,
      render: (t) => (
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-[color:var(--ink)]">{t.name}</div>
          <div className="truncate text-[11px] text-[color:var(--ink-faint)]">{t.ref} · {t.orgName}</div>
        </div>
      ),
    },
    { key: "level", header: "Level", render: (t) => <Chip tone={t.level === "SUBSIDIARY" ? "purple" : t.level === "BUSINESS_UNIT" ? "blue" : "gray"}>{t.level === "SUBSIDIARY" ? "Subsidiary" : t.level === "BUSINESS_UNIT" ? "BU" : "Project"}</Chip> },
    { key: "period", header: "Period", sortable: true, sortValue: (t) => t.period, render: (t) => <span className="text-[12px]">{t.period}</span> },
    { key: "due", header: "Submission deadline", sortable: true, sortValue: (t) => t.effectiveDueDate ?? "", render: (t) => <span className="text-[12px]">{fmtDate(t.effectiveDueDate)}</span> },
    { key: "review", header: "Review deadline", render: (t) => <span className="text-[12px]">{fmtDate(t.reviewDeadline)}</span> },
    {
      key: "source", header: "Inheritance", render: (t) => (
        <div className="flex flex-col items-start gap-1">
          <Chip tone={t.inheritanceMode === "OVERRIDE" ? "amber" : "blue"}>{t.inheritanceMode === "OVERRIDE" ? "Override" : "Inherited"}</Chip>
          <span className="text-[10.5px] text-[color:var(--ink-faint)]">{t.sourceLabel}</span>
        </div>
      ),
    },
    { key: "status", header: "Status", render: (t) => <Chip tone={DEADLINE_TONE(t.deadlineStatus)}>{DEADLINE_STATUS_LABELS[t.deadlineStatus] ?? t.deadlineStatus}</Chip> },
  ];

  const taskColumns: Column<TaskRow>[] = [
    {
      key: "title", header: "Task", sortable: true, sortValue: (t) => t.title,
      render: (t) => (
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-[color:var(--ink)]">{t.title}</div>
          <div className="truncate text-[11px] text-[color:var(--ink-faint)]">{t.ref} · {t.assigneeLabel || t.org}</div>
        </div>
      ),
    },
    { key: "category", header: "Category", render: (t) => <Chip tone="blue">{t.category}</Chip> },
    { key: "due", header: "Due", sortable: true, sortValue: (t) => t.dueDate, render: (t) => <span className="text-[12px]">{fmtDate(t.dueDate)}</span> },
    { key: "priority", header: "Priority", sortable: true, sortValue: (t) => t.priority, render: (t) => <Chip tone={PRIORITY_TONE[t.priority] ?? "gray"}>{t.priority}</Chip> },
    {
      key: "status", header: "Status", sortable: true, sortValue: (t) => t.status,
      render: (t) => <Chip tone={t.status === "COMPLETED" ? "green" : t.status === "OVERDUE" ? "red" : "blue"}>{t.status}</Chip>,
    },
  ];

  const rb = data?.reviewBuckets;
  const cb = data?.correctionBuckets;

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="Tasks & Deadlines"
        description="Deadline visibility across your subsidiary. Timelines are owned by the Subsidiary Admin (SUBSIDIARY → BU → PROJECT inheritance) — you monitor and plan reviews against them."
        icon={Hourglass}
      />

      {/* Workload buckets */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          { label: "Reviews due today", value: rb?.dueToday ?? 0, hue: "#c34a4a", hint: "Decide before day end" },
          { label: "Reviews due soon", value: rb?.dueSoon ?? 0, hue: "#c57926", hint: "Within 7 days" },
          { label: "Overdue review actions", value: rb?.overdue ?? 0, hue: "#c34a4a", hint: "Past review deadline" },
          { label: "Awaiting correction", value: cb?.awaitingCorrection ?? 0, hue: "#c57926", hint: "Rejected reports" },
          { label: "Overdue corrections", value: cb?.overdueCorrections ?? 0, hue: "#c34a4a", hint: "Past correction window" },
          { label: "Blocked by evidence", value: data?.blockedByEvidence.count ?? 0, hue: "#7c5cff", hint: "Missing documents" },
        ].map((c) => (
          <GlassCard key={c.label} className="p-4">
            <div className="text-[24px] font-bold tabular leading-none text-[color:var(--ink)]"><CountUp value={c.value} /></div>
            <div className="mt-1.5 text-[11.5px] font-semibold" style={{ color: c.hue }}>{c.label}</div>
            <div className="text-[10.5px] text-[color:var(--ink-faint)]">{c.hint}</div>
          </GlassCard>
        ))}
      </div>

      {data && data.blockedByEvidence.count > 0 && (
        <GlassCard className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <HourglassIcon className="h-4 w-4 text-[#7c5cff]" />
            <span className="text-[12.5px] font-semibold text-[color:var(--ink)]">Reports blocked by missing evidence</span>
            {data.blockedByEvidence.refs.map((ref) => (
              <Chip key={ref} tone="purple">{ref}</Chip>
            ))}
          </div>
          <p className="mt-1.5 text-[11.5px] text-[color:var(--ink-faint)]">
            These queue items have no supporting documents — consider rejecting with correction instructions if evidence is mandatory.
          </p>
        </GlassCard>
      )}

      <GlassTabBar
        value={tab}
        onChange={(v) => setTab(v as "list" | "calendar")}
        tabs={[
          { value: "list", label: "List view", icon: TaskCheckIcon },
          { value: "calendar", label: "Calendar view", icon: CalendarClock },
        ]}
      />

      {loading && !data && <EmptyState title="Loading deadlines…" />}
      {error && !data && <ErrorState message={error} onRetry={refetch} />}

      {data && tab === "list" && (
        <div className="space-y-4">
          <SectionCard title="Reporting timelines (read-only)" description="Managed by the Subsidiary Admin — effective deadlines resolve through inheritance." icon={HourglassIcon}>
            <DataTable
              columns={timelineColumns}
              rows={timelines}
              pageSize={6}
              emptyTitle="No timelines"
              emptyMessage="The Subsidiary Admin has not configured reporting timelines."
              toolbar={
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Filter by period"
                    className="glass-subtle h-10 rounded-2xl border-white/60 px-3 text-sm"
                    value={periodFilter}
                    onChange={(e) => setPeriodFilter(e.target.value)}
                  >
                    <option value="ALL">All periods</option>
                    <option>FY 2024-25</option>
                    <option>FY 2025-26</option>
                    <option>FY 2026-27</option>
                  </select>
                  <select
                    aria-label="Filter by level"
                    className="glass-subtle h-10 rounded-2xl border-white/60 px-3 text-sm"
                    value={levelFilter}
                    onChange={(e) => setLevelFilter(e.target.value)}
                  >
                    <option value="ALL">All levels</option>
                    <option value="SUBSIDIARY">Subsidiary</option>
                    <option value="BUSINESS_UNIT">Business unit</option>
                    <option value="PROJECT">Project</option>
                  </select>
                </div>
              }
              mobileCard={(t) => (
                <div className="glass-subtle rounded-2xl p-3">
                  <div className="truncate text-[13px] font-semibold">{t.name}</div>
                  <div className="mt-0.5 text-[11px] text-[color:var(--ink-faint)]">{t.orgName} · due {fmtDate(t.effectiveDueDate)}</div>
                  <div className="mt-1.5 flex gap-1.5">
                    <Chip tone={DEADLINE_TONE(t.deadlineStatus)}>{DEADLINE_STATUS_LABELS[t.deadlineStatus] ?? t.deadlineStatus}</Chip>
                    <Chip tone={t.inheritanceMode === "OVERRIDE" ? "amber" : "blue"}>{t.inheritanceMode}</Chip>
                  </div>
                </div>
              )}
            />
          </SectionCard>

          <SectionCard title="Assigned tasks" description="Reporting tasks assigned across the subsidiary." icon={TaskCheckIcon}>
            <DataTable
              columns={taskColumns}
              rows={data.tasks}
              pageSize={6}
              emptyTitle="No tasks"
              emptyMessage="No reporting tasks are assigned in your subsidiary."
              mobileCard={(t) => (
                <div className="glass-subtle rounded-2xl p-3">
                  <div className="truncate text-[13px] font-semibold">{t.title}</div>
                  <div className="mt-0.5 text-[11px] text-[color:var(--ink-faint)]">{fmtDate(t.dueDate)} · {t.priority}</div>
                </div>
              )}
            />
          </SectionCard>
        </div>
      )}

      {data && tab === "calendar" && (
        <SectionCard title="Deadline calendar — next 8 windows" description="Effective deadlines sorted by days remaining." icon={CalendarClock}>
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            {data.upcoming.length === 0 && <EmptyState title="No upcoming deadlines" message="Nothing due in the visible window." />}
            {data.upcoming.map((u) => (
              <GlassCard key={`${u.name}-${u.dueDate}`} subtle className="p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <Chip tone={u.daysLeft <= 7 ? "red" : u.daysLeft <= 14 ? "amber" : "blue"}>{u.daysLeft}d left</Chip>
                  <Chip tone={u.level === "SUBSIDIARY" ? "purple" : u.level === "BUSINESS_UNIT" ? "blue" : "gray"}>{u.level === "BUSINESS_UNIT" ? "BU" : u.level === "PROJECT" ? "Project" : "Sub"}</Chip>
                </div>
                <div className="mt-2 line-clamp-2 text-[13px] font-semibold text-[color:var(--ink)]">{u.name}</div>
                <div className="mt-0.5 text-[11px] text-[color:var(--ink-faint)]">due {fmtDate(u.dueDate)} · {DEADLINE_STATUS_LABELS[u.status] ?? u.status}</div>
              </GlassCard>
            ))}
          </div>
        </SectionCard>
      )}

      <p className="text-[11.5px] text-[color:var(--ink-faint)]">
        Deadline changes are owned by the Subsidiary Admin. If a review window needs more time, request an extension from the Subsidiary Admin rather than waiting past the deadline.
      </p>
    </div>
  );
}
