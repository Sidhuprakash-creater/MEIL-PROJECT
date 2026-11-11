"use client";

// ── SUBSIDIARY MANAGER · SCREENS 04 & 05 — BU Reports / Business Unit Reports ──
import { useMemo, useState } from "react";
import { Building2, ChevronDown, ChevronRight, FileText, Landmark, Sigma } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSmWorkspace } from "@/lib/sm/store";
import { fmtDate, useSmApi } from "@/lib/sm/client";
import type { SubmissionsResponse, SmSubmissionRow } from "@/lib/sm/types";
import {
  Chip, DataTable, EmptyState, ExportButton, GlassTabBar, PageHeader, Toolbar, type Column,
} from "@/components/workspace/ui";
import { EvidenceChip, StatusChip, UrgencyChip } from "@/components/manager/shared";
import { ReportReviewDialog } from "@/components/manager/review-detail";

/* ── Final reports handed up by the business units ───────────────────────── */
interface SmFinalReport {
  id: string;
  fileName: string | null;
  status: string;
  period: string;
  generatedByName: string;
  businessUnit: string;
  businessUnitCode: string;
  notes: string;
  createdAt: string;
  totals: {
    sections: number;
    projects: number;
    reports: number;
    confirmedReports: number;
    confirmedValue: number;
  };
  sections: Array<{
    category: string;
    label: string;
    confirmedValue: number;
    unit: string | null;
    projectCount: number;
    reportCount: number;
    projects: Array<{
      projectName: string;
      confirmedValue: number;
      unit: string | null;
      evidenceCount: number;
      softCopy: { ref: string; fileName: string } | null;
    }>;
  }>;
}

function FinalReportsFromBu({
  reports,
  loading,
}: {
  reports: SmFinalReport[];
  loading: boolean;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  if (loading && reports.length === 0) {
    return (
      <div className="glass-subtle rounded-2xl px-4 py-3 text-[12px] text-[color:var(--ink-faint)]">
        Loading final reports from your business units…
      </div>
    );
  }
  if (reports.length === 0) {
    return (
      <div className="glass-subtle rounded-2xl">
        <EmptyState
          icon={Landmark}
          title="No final reports received yet"
          message="Final consolidated ESG reports signed off by Business Unit Managers will appear here."
        />
      </div>
    );
  }

  return (
    <div className="glass-subtle rounded-2xl p-4 space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[rgba(49,92,255,0.12)]">
          <Sigma className="h-4 w-4 text-[color:var(--bum-purple-deep)]" />
        </span>
        <div>
          <div className="text-[13.5px] font-bold text-[color:var(--ink)]">
            Final reports received from business units
          </div>
          <div className="text-[11px] text-[color:var(--ink-faint)]">
            Signed off by the Business Unit Managers — section totals summed across every project
          </div>
        </div>
      </div>

      {reports.map((r) => (
        <div key={r.id} className="rounded-xl bg-white/60 border border-slate-200/70 overflow-hidden">
          <button
            type="button"
            onClick={() => setOpen((p) => ({ ...p, [r.id]: !p[r.id] }))}
            aria-expanded={!!open[r.id]}
            className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-white/70"
          >
            <span className="text-[color:var(--bum-purple-deep)]">
              {open[r.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-[12.5px] font-bold text-[color:var(--ink)]">
                  {r.businessUnit || "Business Unit"} — final ESG report
                </span>
                <Chip tone="purple">{r.period || "All periods"}</Chip>
                <Chip tone="gray">{r.totals.sections} sections</Chip>
                <Chip tone="gray">{r.totals.projects} projects</Chip>
              </div>
              <div className="truncate text-[10.5px] text-[color:var(--ink-faint)]">
                {r.fileName} · submitted by {r.generatedByName || "BU Manager"} · {fmtDate(r.createdAt)}
              </div>
            </div>
            <Chip tone="green">{r.totals.confirmedReports} approved</Chip>
          </button>

          {open[r.id] && (
            <div className="border-t border-slate-200/70 bg-white/50 px-3 py-2.5 space-y-2">
              {r.notes && (
                <div className="text-[11px] italic text-[color:var(--ink-soft)]">“{r.notes}”</div>
              )}
              {r.sections.map((s) => (
                <div key={s.category} className="rounded-xl bg-white/70 border border-slate-200/70 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-semibold text-[color:var(--ink)]">{s.label}</span>
                    <span className="font-mono text-[12px] font-bold text-[color:var(--ink)]">
                      {Number(s.confirmedValue || 0).toLocaleString("en-IN")} {s.unit ?? ""}
                    </span>
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {s.projects.map((p) => (
                      <div key={p.projectName} className="flex flex-wrap items-center gap-2 text-[10.5px] text-[color:var(--ink-soft)]">
                        <Building2 className="h-3 w-3 text-[color:var(--bum-purple-deep)]" />
                        <span className="font-semibold">{p.projectName}</span>
                        <span>
                          {Number(p.confirmedValue || 0).toLocaleString("en-IN")} {p.unit ?? ""}
                        </span>
                        <Chip tone="gray">{p.evidenceCount} evidence</Chip>
                        {p.softCopy && (
                          <span className="flex items-center gap-1 text-[color:var(--bum-purple-deep)]">
                            <FileText className="h-3 w-3" /> {p.softCopy.ref}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* Directory component for project / site submissions (Business Unit Reports). */
function ReportsDirectory({ level }: { level: "BU" | "PROJECT" }) {
  const { params, reportingYear, navigate } = useSmWorkspace();
  const initialTab = typeof params.statusFilter === "string" ? params.statusFilter : "all";

  const [tab, setTab] = useState(initialTab);
  const [search, setSearch] = useState(typeof params.q === "string" ? params.q : "");
  const [buFilter, setBuFilter] = useState("ALL");
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewTab, setReviewTab] = useState<string | undefined>(undefined);

  const levelQ = `&level=${level}`;
  const { data, loading, error, refetch } = useSmApi<SubmissionsResponse>(
    `/api/sm/submissions?tab=${tab}${levelQ}&period=${encodeURIComponent(reportingYear)}`,
    { deps: [tab, reportingYear] }
  );

  const rows = useMemo(() => {
    let list = data?.submissions ?? [];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((s) => `${s.ref} ${s.title} ${s.buName ?? ""} ${s.projectName ?? ""} ${s.submittedByName ?? ""}`.toLowerCase().includes(q));
    }
    if (buFilter !== "ALL") list = list.filter((s) => s.buId === buFilter);
    return list;
  }, [data, search, buFilter]);

  const buOptions = useMemo(() => {
    const map = new Map<string, string>();
    (data?.submissions ?? []).forEach((s) => s.buId && s.buName && map.set(s.buId, s.buName));
    return [...map.entries()].map(([value, label]) => ({ value, label }));
  }, [data]);

  const counts = data?.counts;

  const columns: Column<SmSubmissionRow>[] = [
    {
      key: "ref", header: level === "PROJECT" ? "Report / project" : "Report / BU", sortable: true, sortValue: (r) => r.ref,
      render: (r) => (
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-[color:var(--ink)]">{r.ref}</div>
          <div className="truncate text-[11.5px] text-[color:var(--ink-faint)]">{r.title}</div>
        </div>
      ),
    },
    {
      key: "org", header: level === "PROJECT" ? "Project / parent BU" : "Business unit",
      render: (r) => (
        <div className="min-w-0">
          <div className="truncate text-[12.5px] font-medium text-[color:var(--ink-soft)]">{level === "PROJECT" ? r.projectName ?? "—" : r.buName ?? "—"}</div>
          {level === "PROJECT" && <div className="truncate text-[10.5px] text-[color:var(--ink-faint)]">under {r.buName ?? "—"}</div>}
        </div>
      ),
    },
    { key: "category", header: "Category", render: (r) => <Chip tone="blue">{r.category}</Chip> },
    { key: "period", header: "Period", sortable: true, sortValue: (r) => r.period, render: (r) => <span className="text-[12px]">{r.period} · {r.fiscalQuarter}</span> },
    { key: "user", header: "Submitted by", render: (r) => <span className="text-[12.5px]">{r.submittedByName ?? "—"}</span> },
    { key: "submittedAt", header: "Submitted", sortable: true, sortValue: (r) => r.submittedAt ?? "", render: (r) => <span className="text-[12px]">{fmtDate(r.submittedAt)}</span> },
    { key: "due", header: "Due", sortable: true, sortValue: (r) => r.dueDate, render: (r) => <span className="text-[12px]">{fmtDate(r.dueDate)}</span> },
    { key: "evidence", header: "Evidence", render: (r) => <EvidenceChip count={r.evidenceCount} /> },
    {
      key: "status", header: "Review status", sortable: true, sortValue: (r) => r.status,
      render: (r) => (
        <div className="flex flex-col items-start gap-1">
          <StatusChip status={r.status} />
          {r.overdue && r.status !== "APPROVED" && <Chip tone="red">Deadline overdue</Chip>}
        </div>
      ),
    },
  ];

  const title = level === "PROJECT" ? "Business Unit Reports" : "BU Reports";
  const description = level === "PROJECT"
    ? "Directory of project / site submissions with their review state. Read full content, inspect evidence, and decide when authorized."
    : "Directory of business-unit reporting records with their review state. Read full content, inspect evidence, and decide when authorized.";

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title={title}
        description={description}
        icon={Landmark}
        actions={<ExportButton filename={`${level.toLowerCase()}-reports`} rows={rows.map((r) => ({ ref: r.ref, title: r.title, org: level === "PROJECT" ? r.projectName ?? "" : r.buName ?? "", category: r.category, period: r.period, submittedBy: r.submittedByName ?? "", submittedAt: r.submittedAt ?? "", dueDate: r.dueDate, evidence: r.evidenceCount, status: r.status }))} />}
      />

      <GlassTabBar
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "all", label: "All", count: counts?.all ?? 0 },
          { value: "submitted", label: "Submitted", count: counts?.submitted ?? 0 },
          { value: "pending", label: "Pending Review", count: counts?.pending ?? 0 },
          { value: "approved", label: "Approved", count: counts?.approved ?? 0 },
          { value: "rejected", label: "Rejected", count: counts?.rejected ?? 0 },
          { value: "overdue", label: "Overdue", count: counts?.overdue ?? 0 },
        ]}
      />

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading && !data}
        error={error}
        onRetry={refetch}
        pageSize={8}
        onRowClick={(r) => {
          setReviewId(r.id);
          setReviewTab(undefined);
          setReviewOpen(true);
        }}
        emptyTitle="No reports in this view"
        emptyMessage={tab === "approved" ? "Nothing approved yet — decisions land here as you review." : "No reporting records match the current tab and filters."}
        emptyAction={<Button variant="outline" className="rounded-2xl" onClick={() => navigate("queue")}>Open the review queue</Button>}
        toolbar={
          <Toolbar
            search={search}
            onSearch={setSearch}
            searchPlaceholder="Search by report ID, title, BU or submitter…"
            filters={[
              { key: "bu", label: "BU", value: buFilter, onChange: setBuFilter, options: [{ value: "ALL", label: "All BUs" }, ...buOptions] },
            ]}
            onReset={() => {
              setSearch("");
              setBuFilter("ALL");
            }}
            resultCount={rows.length}
            right={tab === "overdue" ? <Chip tone="red">Deadline state — a report may also be pending review and overdue</Chip> : undefined}
          />
        }
        rowActions={(r) => (
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" className="h-8 rounded-xl text-xs" onClick={() => { setReviewId(r.id); setReviewTab(undefined); setReviewOpen(true); }}>
              Open
            </Button>
            <Button variant="ghost" size="sm" className="h-8 rounded-xl text-xs" onClick={() => { setReviewId(r.id); setReviewTab("evidence"); setReviewOpen(true); }}>
              Evidence
            </Button>
          </div>
        )}
        mobileCard={(r) => (
          <div className="glass-subtle rounded-2xl p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[13px] font-semibold text-[color:var(--ink)]">{r.ref}</span>
              <StatusChip status={r.status} />
            </div>
            <div className="mt-1 truncate text-[12px] text-[color:var(--ink-soft)]">{r.title}</div>
            <div className="mt-1 truncate text-[11px] text-[color:var(--ink-faint)]">{level === "PROJECT" ? `${r.projectName ?? "Project"} · ${r.buName ?? ""}` : r.buName ?? "BU"}</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <UrgencyChip days={r.daysRemaining} />
              <EvidenceChip count={r.evidenceCount} />
            </div>
            <Button size="sm" variant="outline" className="mt-2 h-8 w-full rounded-xl glass-subtle" onClick={() => { setReviewId(r.id); setReviewTab(undefined); setReviewOpen(true); }}>
              Open report
            </Button>
          </div>
        )}
      />

      <ReportReviewDialog
        submissionId={reviewId}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        startTab={reviewTab}
        onDecided={() => void refetch()}
      />
    </div>
  );
}

export function BuReportsView() {
  const { data, loading } = useSmApi<{ reports: SmFinalReport[] }>("/api/sm/final-reports", {
    pollMs: 30000,
  });
  const reports = data?.reports ?? [];

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="BU Reports"
        description="Directory of business-unit reporting records with their review state. Read full content, inspect evidence, and decide when authorized."
        icon={Landmark}
        actions={
          <ExportButton
            filename="bu-reports"
            rows={reports.map((r) => ({
              businessUnit: r.businessUnit,
              businessUnitCode: r.businessUnitCode,
              period: r.period,
              fileName: r.fileName ?? "",
              submittedBy: r.generatedByName,
              submittedAt: r.createdAt,
              sections: r.totals.sections,
              projects: r.totals.projects,
              approvedReports: r.totals.confirmedReports,
              status: r.status,
            }))}
          />
        }
      />

      <FinalReportsFromBu reports={reports} loading={loading} />
    </div>
  );
}

export function ProjectReportsView() {
  return <ReportsDirectory level="PROJECT" />;
}
