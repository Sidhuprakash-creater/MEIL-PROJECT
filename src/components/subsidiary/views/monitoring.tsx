"use client";

// ── SUBSIDIARY ADMIN · Report Monitoring (OPERATIONAL — no decision controls) ──
// Decisions (Approve / Reject / Return) belong to the Subsidiary Manager.
// This view monitors BU & project reports and surfaces review outcomes read-only.
import { useEffect, useState } from "react";
import {
  ArrowRight, FileText, FolderOpen, Loader2, Radar, ShieldAlert,
} from "lucide-react";
import {
  AlarmAlertIcon, CheckSealIcon, FilesIcon, HourglassIcon, ProjectsIcon,
  UnitsIcon,
} from "@/components/workspace/premium-icons";
import {
  Chip, CountUp, DataTable, EmptyState, ErrorState, ExportButton, GlassDialog,
  GlassTabBar, InfoRow, LoadingBlock, PageHeader, StatusBadge, Toolbar,
  type Column,
} from "@/components/workspace/ui";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useSaWorkspace } from "@/lib/sa/store";
import { fmtDate, fmtDateTime, useSaApi } from "@/lib/sa/client";
import type { ProjectRow, SubmissionDetail, SubmissionRow, UnitRow } from "@/lib/sa/types";

/* ── local types ── */
type Level = "ALL" | "BU" | "PROJECT";
type StatusKey = "all" | "submitted" | "pending" | "approved" | "rejected" | "overdue";
type SubmissionsResponse = {
  submissions: SubmissionRow[];
  total: number;
  page: number;
  pageSize: number;
  counts: { all: number; draft: number; submitted: number; pending: number; approved: number; rejected: number; overdue: number };
};
type SubmissionDetailResponse = { submission: SubmissionDetail };
type UnitsResponse = { units: UnitRow[]; total: number };
type ProjectsResponse = { projects: ProjectRow[]; total: number };
type MonitorRow = SubmissionRow & {
  /* Optional column fed from list data only — never fetched per-row. */
  validationIssues?: { ref: string; severity: string; description: string; status: string }[];
};

const STATUS_KEYS: StatusKey[] = ["all", "submitted", "pending", "approved", "rejected", "overdue"];
const KPI_KEYS: StatusKey[] = ["submitted", "pending", "approved", "rejected", "overdue"];
const STATUS_TAB_LABELS: Record<StatusKey, string> = {
  all: "All", submitted: "Submitted", pending: "Pending Review", approved: "Approved", rejected: "Rejected", overdue: "Overdue",
};
const STATUS_HUE: Record<StatusKey, string> = {
  all: "#3a7bff", submitted: "#3a7bff", pending: "#7c5cff", approved: "#20a779", rejected: "#c34a4a", overdue: "#c57926",
};
const STATUS_ICON: Record<StatusKey, React.ComponentType<{ className?: string; hue?: string }>> = {
  all: FilesIcon, submitted: CheckSealIcon, pending: HourglassIcon, approved: CheckSealIcon, rejected: ShieldAlert, overdue: AlarmAlertIcon,
};
const STATUS_HINT: Record<StatusKey, string> = {
  all: "Every report across all statuses", submitted: "Sent by BU / project teams", pending: "With the Subsidiary Manager", approved: "Cleared for consolidation",
  rejected: "Changes requested / rejected", overdue: "Past deadline, not approved",
};

const fmtMetric = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-IN") : String(v ?? "—");
};

/* KPI card — same pattern as the Command Center StatusCard. */
function StatusCard({
  icon: Icon, hue, label, hint, value, onClick,
}: {
  icon: React.ComponentType<{ className?: string; hue?: string }>;
  hue: string; label: string; hint: string; value: number; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={`${label}: ${value}`}
      className="glass glass-sheen group relative flex flex-col gap-3 overflow-hidden rounded-[24px] p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/85 hover:shadow-[0_14px_34px_rgba(56,113,153,0.14)]"
    >
      <span className="absolute inset-x-0 top-0 h-[3px] opacity-80" style={{ background: `linear-gradient(90deg, ${hue}, ${hue}22)` }} />
      <div className="flex items-center justify-between">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-2xl text-white shadow-md"
          style={{ background: `linear-gradient(135deg, ${hue}, color-mix(in srgb, ${hue} 62%, #17263d))`, boxShadow: `0 6px 16px color-mix(in srgb, ${hue} 38%, transparent), inset 0 1px 0 rgba(255,255,255,0.4)` }}
        >
          <Icon className="h-[18px] w-[18px] text-white" />
        </span>
        <span className="text-[26px] font-bold tabular leading-none text-[color:var(--ink)]">
          <CountUp value={value} />
        </span>
      </div>
      <div className="min-w-0">
        <div className="truncate text-[13px] font-semibold" style={{ color: hue }}>{label}</div>
        <div className="truncate text-[11px] text-[color:var(--ink-faint)]">{hint}</div>
      </div>
    </button>
  );
}

export default function MonitoringView() {
  const { navigate, params, reportingYear } = useSaWorkspace();
  const { toast } = useToast();

  /* ── view state ── */
  const [level, setLevel] = useState<Level>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusKey>("all");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [orgId, setOrgId] = useState("ALL");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  /* ── deep-link params (level / statusFilter; ts nonce re-applies same-view KPI navigations) ── */
  const levelParam = typeof params.level === "string" ? params.level : "";
  const statusParam = typeof params.statusFilter === "string" ? params.statusFilter : "";
  const navTs = typeof params.ts === "number" ? params.ts : 0;
  useEffect(() => {
    if (levelParam === "ALL" || levelParam === "BU" || levelParam === "PROJECT") setLevel(levelParam);
    if ((STATUS_KEYS as string[]).includes(statusParam)) setStatusFilter(statusParam as StatusKey);
  }, [levelParam, statusParam, navTs]);

  /* ── debounced search → server q ── */
  useEffect(() => {
    const t = window.setTimeout(() => setQ(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  /* ── data ── */
  const orgQuery = level !== "ALL" && orgId !== "ALL" ? (level === "BU" ? `&buId=${encodeURIComponent(orgId)}` : `&projectId=${encodeURIComponent(orgId)}`) : "";
  const levelQuery = level === "ALL" ? "" : `&level=${level}`;
  const listPath =
    `/api/sa/submissions?${levelQuery}${levelQuery ? "&" : ""}tab=${statusFilter}&period=${encodeURIComponent(reportingYear)}&pageSize=50` +
    `${q ? `&q=${encodeURIComponent(q)}` : ""}${orgQuery}`;
  const { data, loading, error, refetch } = useSaApi<SubmissionsResponse>(listPath, { deps: [reportingYear] });

  const { data: unitsData } = useSaApi<UnitsResponse>("/api/sa/units?pageSize=50", { pollMs: 0 });
  const { data: projectsData } = useSaApi<ProjectsResponse>("/api/sa/projects?pageSize=50", { pollMs: 0 });

  const {
    data: detail, loading: detailLoading, error: detailError, refetch: detailRefetch,
  } = useSaApi<SubmissionDetailResponse>(detailId ? `/api/sa/submissions/${detailId}` : null, { pollMs: 0 });
  const detailData = detail?.submission ?? null;

  /* ── surface server errors via toast ── */
  useEffect(() => {
    if (error) toast({ title: "Could not load report monitoring", description: error, variant: "destructive" });
  }, [error, toast]);
  useEffect(() => {
    if (detailError) toast({ title: "Could not load report detail", description: detailError, variant: "destructive" });
  }, [detailError, toast]);

  const counts = data?.counts;
  const rows: MonitorRow[] = data?.submissions ?? [];

  /* ── handlers ── */
  const openStatus = (key: StatusKey) => {
    // Same-view navigation carrying the statusFilter (per contract) — ts nonce re-triggers the param effect.
    navigate("monitoring", { level, statusFilter: key, ts: Date.now() });
    setStatusFilter(key);
  };
  const changeLevel = (v: string) => {
    setLevel(v as Level);
    setOrgId("ALL"); // a BU filter is meaningless for PROJECT level (and vice versa)
  };

  const orgOptions =
    level === "BU"
      ? [{ value: "ALL", label: "All business units" }, ...(unitsData?.units ?? []).map((u) => ({ value: u.id, label: u.name }))]
      : [{ value: "ALL", label: "All projects" }, ...(projectsData?.projects ?? []).map((p) => ({ value: p.id, label: p.name }))];

  const exportRows = rows.map((r) => ({
    ref: r.ref, title: r.title, level: r.level,
    org: r.level === "PROJECT" ? r.projectName ?? "" : r.buName ?? "",
    parentBU: r.level === "PROJECT" ? r.buName ?? "" : "",
    category: r.category, metric: r.metricName, value: r.metricValue, unit: r.metricUnit,
    period: r.period, status: r.status, overdue: r.overdue ? "YES" : "NO",
    dueDate: fmtDate(r.dueDate), submittedAt: fmtDateTime(r.submittedAt),
    submittedBy: r.submittedByName ?? "", reviewer: r.reviewerName ?? "", evidenceCount: r.evidenceCount,
  }));

  /* ── table columns ── */
  const columns: Column<MonitorRow>[] = [
    {
      key: "report", header: "Report", sortable: true, sortValue: (r) => r.ref,
      render: (r) => (
        <div className="min-w-[180px]">
          <div className="truncate text-[13px] font-semibold text-[color:var(--ink)]">{r.title}</div>
          <div className="font-mono text-[10.5px] text-[color:var(--ink-faint)]">{r.ref}</div>
        </div>
      ),
    },
    {
      key: "org", header: "Organization", sortable: true, sortValue: (r) => (r.level === "PROJECT" ? r.projectName ?? "" : r.buName ?? ""),
      render: (r) =>
        r.level === "PROJECT" ? (
          <div>
            <div className="truncate text-[13px] font-medium text-[color:var(--ink-soft)]">{r.projectName ?? "—"}</div>
            <div className="truncate text-[10.5px] text-[color:var(--ink-faint)]">BU · {r.buName ?? "—"}</div>
          </div>
        ) : (
          <span className="text-[13px]">{r.buName ?? "—"}</span>
        ),
    },
    { key: "period", header: "Period", render: (r) => <span className="whitespace-nowrap text-[12.5px]">{r.period}</span> },
    {
      key: "submitted", header: "Submitted", sortable: true, sortValue: (r) => r.submittedAt ?? "",
      render: (r) => <span className="whitespace-nowrap text-[12.5px]">{r.submittedAt ? fmtDateTime(r.submittedAt) : "—"}</span>,
    },
    {
      key: "due", header: "Due", sortable: true, sortValue: (r) => r.dueDate,
      render: (r) => (
        <span className="flex flex-wrap items-center gap-1.5 whitespace-nowrap text-[12.5px]">
          {fmtDate(r.dueDate)}
          {r.overdue && r.status !== "APPROVED" && <Chip tone="red">Overdue</Chip>}
        </span>
      ),
    },
    { key: "status", header: "Status", sortable: true, sortValue: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
    { key: "reviewer", header: "Reviewer", render: (r) => <span className="whitespace-nowrap text-[12.5px]">{r.reviewerName ?? "—"}</span> },
    { key: "evidence", header: "Evidence", render: (r) => <span className="tabular text-[13px]">{r.evidenceCount}</span> },
    {
      key: "validation", header: "Validation",
      render: (r) =>
        r.validationIssues?.length ? (
          <button
            onClick={(e) => { e.stopPropagation(); navigate("validation"); }}
            className="transition-transform hover:scale-[1.03]"
            aria-label="Open validation issues"
          >
            <Chip tone="red">{r.validationIssues.length} issue{r.validationIssues.length === 1 ? "" : "s"}</Chip>
          </button>
        ) : (
          <span className="text-[color:var(--ink-faint)]">—</span>
        ),
    },
  ];

  const mobileCard = (r: MonitorRow) => (
    <div className="glass glass-sheen rounded-2xl p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-[color:var(--ink)]">{r.title}</div>
          <div className="font-mono text-[10.5px] text-[color:var(--ink-faint)]">{r.ref}</div>
        </div>
        <StatusBadge status={r.status} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-[color:var(--ink-faint)]">
        <Chip tone={r.level === "PROJECT" ? "purple" : "blue"}>{r.level === "PROJECT" ? r.projectName ?? "Project" : r.buName ?? "BU"}</Chip>
        {r.overdue && r.status !== "APPROVED" && <Chip tone="red">Overdue</Chip>}
        <span>Due {fmtDate(r.dueDate)}</span>
        <span>· {r.evidenceCount} evidence</span>
      </div>
    </div>
  );

  const detailOrg = detailData
    ? detailData.level === "PROJECT"
      ? `${detailData.projectName ?? "—"} (BU · ${detailData.buName ?? "—"})`
      : detailData.buName ?? "—"
    : "—";

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="Report Monitoring"
        description={`${reportingYear} · Operational view of BU and project reports. Approve / Reject decisions belong to the Subsidiary Manager — outcomes below are read-only.`}
        icon={Radar}
        actions={
          <span className="glass-subtle inline-flex items-center gap-1.5 rounded-2xl px-3 py-2 text-[13px] font-medium text-[color:var(--ink-soft)]">
            <ShieldAlert className="h-4 w-4 text-[#c57926]" aria-hidden="true" />
            Read-only monitoring
          </span>
        }
      />

      {/* ── KPI strip — 5 clickable status cards ── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {KPI_KEYS.map((key) => (
          <StatusCard
            key={key}
            icon={STATUS_ICON[key]}
            hue={STATUS_HUE[key]}
            label={STATUS_TAB_LABELS[key]}
            hint={STATUS_HINT[key]}
            value={counts?.[key] ?? 0}
            onClick={() => openStatus(key)}
          />
        ))}
      </div>

      {/* ── level toggle + status sub-tabs ── */}
      <div className="flex flex-col gap-2">
        <GlassTabBar
          tabs={[
            { value: "ALL", label: "All Reports", icon: FilesIcon },
            { value: "BU", label: "BU Reports", icon: UnitsIcon },
            { value: "PROJECT", label: "Project Reports", icon: ProjectsIcon },
          ]}
          value={level}
          onChange={changeLevel}
          className="self-start"
        />
        <GlassTabBar
          tabs={STATUS_KEYS.map((key) => ({ value: key, label: STATUS_TAB_LABELS[key], count: counts?.[key] ?? 0 }))}
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as StatusKey)}
          aria-label="Status filter"
        />
      </div>

      {/* ── toolbar ── */}
      <Toolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search ref, title or metric…"
        filters={
          level === "ALL"
            ? []
            : [
                {
                  key: "org",
                  label: level === "BU" ? "Business unit" : "Project",
                  options: orgOptions,
                  value: orgId,
                  onChange: setOrgId,
                },
              ]
        }
        onReset={() => { setSearch(""); setQ(""); setOrgId("ALL"); }}
        resultCount={data?.total ?? 0}
        right={<ExportButton filename="report-monitoring" rows={exportRows} />}
      />

      {/* ── table ── */}
      <DataTable<MonitorRow>
        columns={columns}
        rows={rows}
        loading={loading && !data}
        error={error && !data ? error : null}
        onRetry={refetch}
        pageSize={8}
        onRowClick={(r) => setDetailId(r.id)}
        emptyTitle={
          (counts?.[statusFilter] ?? 0) === 0 && !q && orgId === "ALL"
            ? `No ${STATUS_TAB_LABELS[statusFilter].toLowerCase()} reports`
            : "Nothing matches your filters"
        }
        emptyMessage={
          (counts?.[statusFilter] ?? 0) === 0 && !q && orgId === "ALL"
            ? `There are no ${STATUS_TAB_LABELS[statusFilter].toLowerCase()} ${level === "BU" ? "BU" : "project"} reports for ${reportingYear}.`
            : "Try adjusting the search, organization filter or status tab."
        }
        mobileCard={mobileCard}
      />

      {/* ── report detail dialog (wide) ── */}
      <GlassDialog
        open={!!detailId}
        onOpenChange={(o) => { if (!o) { setDetailId(null); setSheetOpen(false); } }}
        title={detailData ? `${detailData.ref} — ${detailData.title}` : "Report detail"}
        description={detailData ? `${detailData.level === "PROJECT" ? "Project report" : "BU report"} · ${detailData.period}` : "Loading report…"}
        wide
      >
        {detailLoading && !detailData ? (
          <LoadingBlock rows={5} label="Loading report detail…" />
        ) : detailError && !detailData ? (
          <ErrorState message={detailError} onRetry={detailRefetch} />
        ) : detailData ? (
          <div className="space-y-4">
            {/* header meta */}
            <div className="glass-subtle rounded-2xl p-3.5">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={detailData.status} />
                {detailData.overdue && detailData.status !== "APPROVED" && <Chip tone="red">Overdue</Chip>}
                <Chip tone={detailData.level === "PROJECT" ? "purple" : "blue"}>{detailData.level === "PROJECT" ? "Project report" : "BU report"}</Chip>
              </div>
              <InfoRow label="Organization">{detailOrg}</InfoRow>
              <InfoRow label="Period">{detailData.period} · {detailData.fiscalQuarter}</InfoRow>
              <InfoRow label="Submitted">{detailData.submittedAt ? fmtDateTime(detailData.submittedAt) : "Not submitted"}{detailData.submittedByName ? ` by ${detailData.submittedByName}` : ""}</InfoRow>
              <InfoRow label="Due">{fmtDate(detailData.dueDate)}</InfoRow>
              <InfoRow label="Reviewer">{detailData.reviewerName ?? "—"}</InfoRow>
              <InfoRow label="Metric">{detailData.metricName} · {fmtMetric(detailData.metricValue)} {detailData.metricUnit}</InfoRow>
            </div>

            {/* data values */}
            <div>
              <h3 className="mb-2 text-[13px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">Data values</h3>
              {detailData.values.length === 0 ? (
                <p className="text-[13px] text-[color:var(--ink-faint)]">No structured values recorded on this report.</p>
              ) : (
                <div className="glass-subtle overflow-hidden rounded-2xl">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-[rgba(125,177,216,0.3)] text-left text-[11px] uppercase tracking-wide text-[color:var(--ink-faint)]">
                        <th className="px-3.5 py-2 font-semibold">Metric</th>
                        <th className="px-3.5 py-2 text-right font-semibold">Value</th>
                        <th className="px-3.5 py-2 text-right font-semibold">Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailData.values.map((v, i) => (
                        <tr key={`${v.label}-${i}`} className="border-b border-[rgba(125,177,216,0.15)] last:border-0">
                          <td className="px-3.5 py-2 text-[color:var(--ink-soft)]">{v.label}</td>
                          <td className="px-3.5 py-2 text-right font-semibold tabular text-[color:var(--ink)]">{fmtMetric(v.value)}</td>
                          <td className="px-3.5 py-2 text-right text-[color:var(--ink-faint)]">{v.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* evidence entry point — opens the side panel */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[rgba(125,177,216,0.35)] bg-white/55 p-3.5">
              <div className="flex items-center gap-2.5">
                <span className="glass-subtle flex h-9 w-9 items-center justify-center rounded-xl">
                  <FilesIcon className="h-4 w-4 text-[color:var(--esg-blue)]" />
                </span>
                <div>
                  <div className="text-[13px] font-semibold text-[color:var(--ink)]">Evidence ({detailData.evidence.length})</div>
                  <div className="text-[11px] text-[color:var(--ink-faint)]">Files attached to this report</div>
                </div>
              </div>
              <Button variant="outline" size="sm" className="glass-subtle rounded-2xl border-white/60" onClick={() => setSheetOpen(true)}>
                <FolderOpen className="mr-1.5 h-3.5 w-3.5" /> Evidence
              </Button>
            </div>

            {/* review decisions — READ-ONLY banner */}
            <div>
              <h3 className="mb-2 text-[13px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">Review decisions</h3>
              <div className="mb-2.5 flex items-start gap-2 rounded-2xl border border-[rgba(197,121,38,0.35)] bg-[rgba(197,121,38,0.08)] p-3 text-[12.5px] font-medium leading-relaxed text-[#7a4a12]">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                Approve / Reject decisions belong to the Subsidiary Manager. Decisions shown here are read-only.
              </div>
              {detailData.comments.length === 0 ? (
                <p className="text-[13px] text-[color:var(--ink-faint)]">No reviewer comments recorded yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {detailData.comments.map((c, i) => (
                    <blockquote key={i} className="rounded-2xl border-l-4 border-[rgba(58,123,255,0.5)] bg-white/60 p-3">
                      <p className="text-[13px] leading-relaxed text-[color:var(--ink-soft)]">“{c.text}”</p>
                      <footer className="mt-1 text-[11px] text-[color:var(--ink-faint)]">{c.author} · {c.role} · {fmtDateTime(c.at)}</footer>
                    </blockquote>
                  ))}
                </div>
              )}
            </div>

            {/* history timeline */}
            <div>
              <h3 className="mb-2 text-[13px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">History</h3>
              {detailData.history.length === 0 ? (
                <p className="text-[13px] text-[color:var(--ink-faint)]">No history entries yet.</p>
              ) : (
                <ol className="nice-scroll relative max-h-56 space-y-3 overflow-y-auto border-l-2 border-[rgba(125,177,216,0.4)] pl-4">
                  {detailData.history.map((h, i) => (
                    <li key={i} className="relative">
                      <span className="absolute -left-[22px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#3a7bff]" aria-hidden="true" />
                      <div className="text-[13px] font-medium text-[color:var(--ink)]">{h.action.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</div>
                      <div className="text-[11px] text-[color:var(--ink-faint)]">
                        {h.actor} · {fmtDateTime(h.at)}{h.note ? ` — ${h.note}` : ""}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {/* validation issues */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[13px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">Validation</h3>
                <Button variant="ghost" size="sm" className="h-7 rounded-xl text-xs" onClick={() => navigate("validation")}>
                  Open validation <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
              {detailData.validationIssues.length === 0 ? (
                <p className="text-[13px] text-[color:var(--ink-faint)]">No validation issues linked to this report.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {detailData.validationIssues.map((v) => (
                    <button
                      key={v.ref}
                      onClick={() => navigate("validation")}
                      className="transition-transform hover:scale-[1.03]"
                      title={`${v.description} (${v.status})`}
                    >
                      <Chip tone={v.severity === "CRITICAL" || v.severity === "HIGH" ? "red" : v.severity === "MEDIUM" ? "amber" : "gray"}>
                        {v.severity} · {v.ref}
                      </Chip>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </GlassDialog>

      {/* ── evidence side panel — overlays the report dialog; closing returns to it ── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="glass-strong flex w-full flex-col gap-0 overflow-hidden border-white/80 p-0 sm:max-w-md">
          <SheetHeader className="glass-sheen shrink-0 border-b border-[rgba(125,177,216,0.3)] bg-white/50 px-5 py-4 text-left">
            <SheetTitle className="text-base leading-snug text-[color:var(--ink)]">Evidence — {detailData?.ref ?? "report"}</SheetTitle>
            <SheetDescription className="text-[12px] text-[color:var(--muted-foreground)]">
              {detailData ? `${detailData.evidence.length} file${detailData.evidence.length === 1 ? "" : "s"} attached to this report` : "Attached files"}
            </SheetDescription>
          </SheetHeader>
          <div className="nice-scroll flex-1 overflow-y-auto px-5 py-4">
            {!detailData || detailData.evidence.length === 0 ? (
              <EmptyState
                title="No evidence attached"
                message="This report has no supporting files yet."
                icon={FileText}
              />
            ) : (
              <ul className="space-y-2">
                {detailData.evidence.map((name, i) => (
                  <li key={`${name}-${i}`} className="glass-subtle flex items-center gap-2.5 rounded-2xl px-3 py-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[rgba(58,123,255,0.12)]">
                      <FileText className="h-4 w-4 text-[color:var(--esg-blue)]" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[color:var(--ink-soft)]" title={name}>{name}</span>
                    <span className="shrink-0 font-mono text-[10px] text-[color:var(--ink-faint)]">#{i + 1}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="shrink-0 border-t border-[rgba(125,177,216,0.3)] bg-white/50 px-5 py-4">
            <Button
              className="btn-action w-full rounded-2xl"
              onClick={() => navigate("evidence", { q: detailData?.ref ?? "" })}
              disabled={!detailData}
            >
              <FolderOpen className="mr-1.5 h-4 w-4" /> Open Evidence &amp; Documents
            </Button>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-[color:var(--ink-faint)]">
              {sheetOpen && detailLoading && <Loader2 className="h-3 w-3 animate-spin" />}
              Opens the evidence repository filtered to {detailData?.ref ?? "this report"}
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
