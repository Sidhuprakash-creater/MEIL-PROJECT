"use client";

// ── SUBSIDIARY ADMIN · SCREEN 08 — Submission Center (monitoring only) ──
// Central register of BU & project reporting records. This workspace monitors;
// approve / reject / request-changes decisions belong to the Subsidiary
// Manager and are shown here read-only.
import { useEffect, useMemo, useState } from "react";
import { Eye, Files, Info, Quote, ShieldCheck } from "lucide-react";
import { FilesIcon } from "@/components/workspace/premium-icons";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useSaWorkspace } from "@/lib/sa/store";
import { fmtDate, fmtDateTime, fmtNumber, timeAgo, useSaApi } from "@/lib/sa/client";
import { CATEGORY_LABELS, SA_CATEGORIES, SUBMISSION_STATUS_LABELS } from "@/lib/sa/types";
import type { SubmissionDetail, SubmissionRow, UnitRow } from "@/lib/sa/types";
import {
  Chip, DataTable, EmptyState, ErrorState, ExportButton, GlassCard, GlassDialog, GlassTabBar,
  InfoRow, LoadingBlock, PageHeader, StatusBadge, TipIconButton, Toolbar,
} from "@/components/workspace/ui";

/* ── constants ───────────────────────────────────────────────────────── */

const TAB_KEYS = ["all", "draft", "submitted", "pending", "approved", "rejected", "overdue"] as const;

const LEVEL_CHIP: Record<string, { tone: "purple" | "teal"; label: string }> = {
  BU: { tone: "purple", label: "BU" },
  PROJECT: { tone: "teal", label: "Project" },
};

const SEVERITY_TONE: Record<string, "red" | "amber" | "gray" | "blue"> = {
  CRITICAL: "red", HIGH: "red", MEDIUM: "amber", LOW: "gray",
};

interface SubsRes {
  submissions: SubmissionRow[];
  total: number;
  page: number;
  pageSize: number;
  counts: { all: number; draft: number; submitted: number; pending: number; approved: number; rejected: number; overdue: number };
}

/* ── view ────────────────────────────────────────────────────────────── */

export default function SubmissionsView() {
  const { navigate, reportingYear } = useSaWorkspace();
  const { toast } = useToast();

  /* Deep-link params are read once at first render (the shell mounts this view
     fresh on every navigation) and cleared from the store in a mount effect. */
  const params0 = useSaWorkspace.getState().params;

  const [tab, setTab] = useState<string>(() => {
    const t = String(params0.tab ?? "");
    return (TAB_KEYS as readonly string[]).includes(t) ? t : "all";
  });
  const initialSearch = String(params0.ref ?? params0.q ?? "");
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [q, setQ] = useState(initialSearch);
  const [category, setCategory] = useState<string>("ALL");
  const [level, setLevel] = useState<string>(() => {
    const l = String(params0.level ?? "");
    return ["BU", "PROJECT"].includes(l) ? l : "ALL";
  });
  const [buId, setBuId] = useState<string>("ALL");
  const [manualDetailId, setManualDetailId] = useState<string | null>(null);
  const [pendingRef, setPendingRef] = useState<string | null>(() => String(params0.ref ?? "") || null);

  /* ?ref=… deep link: the matching row's detail opens as soon as the data
     arrives — derived during render, no cascading effect needed. */
  /* Debounce the search box → the query hits the API at most every 350ms. */
  useEffect(() => {
    const t = window.setTimeout(() => setQ(searchInput), 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    navigate("submissions"); // clear deep-link params (external zustand store)
  }, []);

  const query = useMemo(() => {
    const p = new URLSearchParams({ tab, page: "1", pageSize: "50", period: reportingYear });
    if (q.trim()) p.set("q", q.trim());
    if (category !== "ALL") p.set("category", category);
    if (level !== "ALL") p.set("level", level);
    if (buId !== "ALL") p.set("buId", buId);
    return p.toString();
  }, [tab, q, category, level, buId, reportingYear]);

  const { data, loading, error, refetch } = useSaApi<SubsRes>(`/api/sa/submissions?${query}`);
  const unitsRes = useSaApi<{ units: UnitRow[] }>("/api/sa/units?pageSize=50", { pollMs: 0 });

  const autoRow = pendingRef && data
    ? data.submissions.find((s) => s.ref.toLowerCase() === pendingRef.toLowerCase())
    : undefined;
  const detailId = manualDetailId ?? autoRow?.id ?? null;

  const detailRes = useSaApi<{ submission: SubmissionDetail }>(
    detailId ? `/api/sa/submissions/${detailId}` : null,
    { pollMs: 0 }
  );
  const detail = detailRes.data?.submission ?? null;

  const counts = data?.counts ?? { all: 0, draft: 0, submitted: 0, pending: 0, approved: 0, rejected: 0, overdue: 0 };
  const rows = data?.submissions ?? [];

  const exportRows = rows.map((s) => ({
    ref: s.ref, title: s.title, category: CATEGORY_LABELS[s.category] ?? s.category,
    metric: s.metricName, value: s.metricValue, unit: s.metricUnit,
    level: LEVEL_CHIP[s.level]?.label ?? s.level, org: s.buName ?? s.projectName ?? "—",
    responsible: s.submittedByName ?? "—", status: SUBMISSION_STATUS_LABELS[s.status] ?? s.status,
    overdue: s.overdue, dueDate: s.dueDate, submittedAt: s.submittedAt,
    reviewedAt: s.reviewedAt, reviewer: s.reviewerName, evidence: s.evidenceCount, period: s.period,
  }));

  const resetFilters = () => {
    setSearchInput("");
    setQ("");
    setCategory("ALL");
    setLevel("ALL");
    setBuId("ALL");
  };

  const openDetail = (row: SubmissionRow) => setManualDetailId(row.id);
  const closeDetail = () => {
    setManualDetailId(null);
    setPendingRef(null);
  };
  const columns = [
    {
      key: "ref", header: "Ref", className: "font-mono text-[11.5px] whitespace-nowrap", sortValue: (r: SubmissionRow) => r.ref,
      render: (r: SubmissionRow) => <span className="font-mono text-[11.5px] font-medium text-[color:var(--ink)]">{r.ref}</span>,
    },
    {
      key: "report", header: "Report", sortValue: (r: SubmissionRow) => r.title,
      render: (r: SubmissionRow) => (
        <div className="min-w-[180px] max-w-[280px]">
          <div className="truncate font-semibold text-[color:var(--ink)]">{r.title}</div>
          <div className="mt-0.5"><Chip tone="gray" className="px-1.5 py-0 text-[10px]">{CATEGORY_LABELS[r.category] ?? r.category}</Chip></div>
        </div>
      ),
    },
    {
      key: "level", header: "Level", sortValue: (r: SubmissionRow) => r.level,
      render: (r: SubmissionRow) => {
        const l = LEVEL_CHIP[r.level] ?? { tone: "gray" as const, label: r.level };
        return <Chip tone={l.tone}>{l.label}</Chip>;
      },
    },
    {
      key: "org", header: "Org", sortValue: (r: SubmissionRow) => r.buName ?? r.projectName ?? "",
      render: (r: SubmissionRow) => <span className="block max-w-[160px] truncate">{r.buName ?? r.projectName ?? "—"}</span>,
    },
    {
      key: "responsible", header: "Responsible", sortValue: (r: SubmissionRow) => r.submittedByName ?? "",
      render: (r: SubmissionRow) => r.submittedByName ?? "—",
    },
    {
      key: "category", header: "Category", sortValue: (r: SubmissionRow) => r.category,
      render: (r: SubmissionRow) => CATEGORY_LABELS[r.category] ?? r.category,
    },
    {
      key: "dueDate", header: "Due date", sortValue: (r: SubmissionRow) => r.dueDate,
      render: (r: SubmissionRow) => (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          {fmtDate(r.dueDate)}
          {r.overdue && r.status !== "APPROVED" && <Chip tone="red" className="px-1.5 py-0 text-[10px]">Overdue</Chip>}
        </span>
      ),
    },
    {
      key: "status", header: "Status", sortValue: (r: SubmissionRow) => r.status,
      render: (r: SubmissionRow) => (
        <span title={SUBMISSION_STATUS_LABELS[r.status] ?? r.status}>
          <StatusBadge status={r.status} />
        </span>
      ),
    },
    {
      key: "submittedAt", header: "Submitted", sortValue: (r: SubmissionRow) => r.submittedAt ?? "",
      render: (r: SubmissionRow) => <span className="whitespace-nowrap">{r.submittedAt ? fmtDateTime(r.submittedAt) : "—"}</span>,
    },
    {
      key: "evidence", header: "Evidence", sortValue: (r: SubmissionRow) => r.evidenceCount,
      render: (r: SubmissionRow) => (
        <span className="inline-flex items-center gap-1 whitespace-nowrap">
          <Files className="h-3.5 w-3.5 text-[color:var(--ink-faint)]" aria-hidden /> {r.evidenceCount}
        </span>
      ),
    },
  ];

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="Submission Center"
        description={`${reportingYear} · Central register of every BU and project reporting record. Monitoring only — review decisions stay with the Subsidiary Manager.`}
        icon={FilesIcon}
      />

      {/* status tabs with live counts */}
      <GlassTabBar
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "all", label: "All", count: counts.all },
          { value: "draft", label: "Draft", count: counts.draft },
          { value: "submitted", label: "Submitted", count: counts.submitted },
          { value: "pending", label: "Pending Review", count: counts.pending },
          { value: "approved", label: "Approved", count: counts.approved },
          { value: "rejected", label: "Rejected", count: counts.rejected },
          { value: "overdue", label: "Overdue", count: counts.overdue },
        ]}
      />

      <DataTable<SubmissionRow>
        columns={columns}
        rows={rows}
        loading={loading && !data}
        error={error}
        onRetry={refetch}
        pageSize={10}
        onRowClick={openDetail}
        emptyTitle={rows.length === 0 && (q || category !== "ALL" || level !== "ALL" || buId !== "ALL") ? "No submissions match these filters" : "No submissions here yet"}
        emptyMessage="Try a different tab, clear the filters, or wait for BU / project owners to submit."
        emptyAction={
          <Button variant="outline" className="glass-subtle rounded-2xl border-white/60" onClick={resetFilters}>
            Clear filters
          </Button>
        }
        rowActions={(r) => (
          <TipIconButton tip="Open report" aria-label={`Open report ${r.ref}`} onClick={() => openDetail(r)}>
            <Eye className="h-4 w-4" />
          </TipIconButton>
        )}
        mobileCard={(r) => {
          const l = LEVEL_CHIP[r.level] ?? { tone: "gray" as const, label: r.level };
          return (
            <GlassCard subtle className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-[10.5px] font-medium text-[color:var(--ink-soft)]">{r.ref}</span>
                    <Chip tone={l.tone} className="px-1.5 py-0 text-[10px]">{l.label}</Chip>
                    {r.overdue && r.status !== "APPROVED" && <Chip tone="red" className="px-1.5 py-0 text-[10px]">Overdue</Chip>}
                  </div>
                  <div className="mt-1 truncate text-[13px] font-semibold text-[color:var(--ink)]">{r.title}</div>
                  <div className="truncate text-[11.5px] text-[color:var(--ink-faint)]">
                    {r.buName ?? r.projectName ?? "—"} · {SUBMISSION_STATUS_LABELS[r.status] ?? r.status}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[color:var(--ink-faint)]">
                    Due {fmtDate(r.dueDate)} · {r.evidenceCount} evidence · {r.submittedAt ? timeAgo(r.submittedAt) : "not submitted"}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="glass-subtle h-8 shrink-0 rounded-2xl border-white/60 text-xs"
                  onClick={(e) => { e.stopPropagation(); openDetail(r); }}
                >
                  <Eye className="mr-1 h-3.5 w-3.5" /> Open
                </Button>
              </div>
            </GlassCard>
          );
        }}
        toolbar={
          <Toolbar
            search={searchInput}
            onSearch={setSearchInput}
            searchPlaceholder="Search ref, title, metric…"
            filters={[
              {
                key: "category", label: "Category", value: category, onChange: setCategory,
                options: [
                  { value: "ALL", label: "All categories" },
                  ...SA_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] ?? c })),
                ],
              },
              {
                key: "level", label: "Level", value: level, onChange: setLevel,
                options: [
                  { value: "ALL", label: "All levels" },
                  { value: "BU", label: "Business unit" },
                  { value: "PROJECT", label: "Project" },
                ],
              },
              {
                key: "bu", label: "BU", value: buId, onChange: setBuId,
                options: [
                  { value: "ALL", label: "All BUs" },
                  ...(unitsRes.data?.units ?? []).map((u) => ({ value: u.id, label: u.name })),
                ],
              },
            ]}
            onReset={resetFilters}
            resultCount={data?.total ?? 0}
            right={<ExportButton filename={`submissions-${reportingYear.replace(/\s+/g, "-").toLowerCase()}`} rows={exportRows} />}
          />
        }
      />

      {/* read-only decision reminder */}
      <GlassCard className="flex items-start gap-3 p-4">
        <span className="glass-subtle flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl">
          <ShieldCheck className="h-[18px] w-[18px] text-[#1d6b40]" />
        </span>
        <p className="text-[12.5px] leading-relaxed text-[color:var(--ink-soft)]">
          <strong className="font-semibold text-[color:var(--ink)]">No decision controls here.</strong> Approvals, rejections and
          change requests are made by the Subsidiary Manager. This workspace watches the register, exports it and opens the details.
        </p>
      </GlassCard>

      {/* ── report detail dialog ── */}
      <GlassDialog
        open={!!detailId}
        onOpenChange={(o) => { if (!o) closeDetail(); }}
        title={detail ? `${detail.ref} — ${detail.title}` : "Report detail"}
        description={detail ? `${SUBMISSION_STATUS_LABELS[detail.status] ?? detail.status} · ${detail.period}` : "Loading report…"}
        wide
        footer={
          <Button variant="outline" className="glass-subtle rounded-2xl" onClick={closeDetail}>
            Close
          </Button>
        }
      >
        {detailRes.loading && !detail && <LoadingBlock rows={5} label="Loading report detail…" />}
        {detailRes.error && !detail && <ErrorState message={detailRes.error} onRetry={detailRes.refetch} />}
        {detail && (
          <div className="space-y-4">
            {/* header */}
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="gray" className="font-mono text-[10.5px]">{detail.ref}</Chip>
              <span title={SUBMISSION_STATUS_LABELS[detail.status] ?? detail.status}><StatusBadge status={detail.status} /></span>
              <Chip tone={LEVEL_CHIP[detail.level]?.tone ?? "gray"}>{LEVEL_CHIP[detail.level]?.label ?? detail.level}</Chip>
              {detail.overdue && detail.status !== "APPROVED" && <Chip tone="red">Overdue</Chip>}
            </div>
            <div className="glass-subtle rounded-2xl border border-white/60 p-3">
              <InfoRow label="Organisation">{detail.buName ?? detail.projectName ?? "—"}</InfoRow>
              <InfoRow label="Responsible">{detail.submittedByName ?? "—"}</InfoRow>
              <InfoRow label="Metric">{detail.metricName}</InfoRow>
              <InfoRow label="Due date">{fmtDate(detail.dueDate)}</InfoRow>
              <InfoRow label="Submitted">{detail.submittedAt ? fmtDateTime(detail.submittedAt) : "Not submitted yet"}</InfoRow>
              <InfoRow label="Reviewed">
                {detail.reviewedAt
                  ? `${fmtDateTime(detail.reviewedAt)}${detail.reviewerName ? ` · ${detail.reviewerName}` : ""}`
                  : "Awaiting review"}
              </InfoRow>
            </div>

            {/* reported values */}
            <div>
              <h3 className="mb-2 text-[12px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">Reported values</h3>
              {detail.values.length === 0 ? (
                <p className="text-[12.5px] text-[color:var(--ink-faint)]">No values recorded on this submission.</p>
              ) : (
                <div className="nice-scroll max-h-[220px] overflow-y-auto rounded-2xl border border-white/60 bg-white/50">
                  <table className="w-full text-[12.5px]">
                    <thead className="sticky top-0 bg-white/80 backdrop-blur">
                      <tr className="[&>th]:border-b [&>th]:border-[rgba(125,177,216,0.35)] [&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:text-[10.5px] [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-wide [&>th]:text-[color:var(--ink-faint)]">
                        <th>Metric</th>
                        <th className="!text-right">Value</th>
                        <th className="!text-right">Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.values.map((v, i) => (
                        <tr key={i} className="[&>td]:border-b [&>td]:border-[rgba(125,177,216,0.16)] [&>td]:px-3 [&>td]:py-2 last:[&>td]:border-0">
                          <td className="text-[color:var(--ink-soft)]">{v.label}</td>
                          <td className="text-right font-semibold tabular text-[color:var(--ink)]">{fmtNumber(v.value, 2)}</td>
                          <td className="text-right text-[color:var(--ink-faint)]">{v.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* evidence */}
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-[12px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">
                  Evidence ({detail.evidence.length})
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  className="glass-subtle h-7 rounded-xl border-white/60 text-xs"
                  onClick={() => { closeDetail(); navigate("evidence"); }}
                >
                  <Files className="mr-1 h-3 w-3" /> Open Evidence & Documents
                </Button>
              </div>
              {detail.evidence.length === 0 ? (
                <p className="text-[12.5px] text-[color:var(--ink-faint)]">No evidence attached to this submission.</p>
              ) : (
                <ul className="space-y-1.5">
                  {detail.evidence.map((e, i) => (
                    <li key={i} className="flex items-center gap-2 rounded-2xl px-2.5 py-1.5 text-[12.5px] text-[color:var(--ink-soft)] transition-colors hover:bg-white/60">
                      <FilesIcon className="h-3.5 w-3.5 shrink-0 text-[color:var(--esg-blue)]" />
                      <span className="truncate">{e}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* review history — read-only */}
            <div>
              <h3 className="mb-2 text-[12px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">Review history</h3>
              <div className="mb-2 flex items-start gap-2.5 rounded-2xl border border-[rgba(58,123,255,0.3)] bg-[rgba(58,123,255,0.08)] p-3">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#1d5fd6]" aria-hidden />
                <p className="text-[12px] font-medium leading-relaxed text-[#1d5fd6]">
                  Review decisions are made by the Subsidiary Manager. This workspace monitors, it does not decide.
                </p>
              </div>
              {detail.comments.length === 0 ? (
                <p className="text-[12.5px] text-[color:var(--ink-faint)]">No reviewer comments yet.</p>
              ) : (
                <div className="space-y-2">
                  {detail.comments.map((c, i) => (
                    <blockquote key={i} className="rounded-2xl border border-white/60 bg-white/60 p-3">
                      <div className="flex items-start gap-2">
                        <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--ink-faint)]" aria-hidden />
                        <p className="text-[12.5px] leading-relaxed text-[color:var(--ink)]">&ldquo;{c.text}&rdquo;</p>
                      </div>
                      <footer className="mt-1.5 pl-5 text-[11px] text-[color:var(--ink-faint)]">
                        — {c.author} · {c.role} · {fmtDateTime(c.at)}
                      </footer>
                    </blockquote>
                  ))}
                </div>
              )}
            </div>

            {/* workflow timeline */}
            <div>
              <h3 className="mb-2 text-[12px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">Workflow timeline</h3>
              {detail.history.length === 0 ? (
                <p className="text-[12.5px] text-[color:var(--ink-faint)]">No workflow events recorded yet.</p>
              ) : (
                <ol className="relative ml-2 space-y-3 border-l border-[rgba(125,177,216,0.4)] pl-4">
                  {detail.history.map((h, i) => (
                    <li key={i} className="relative">
                      <span className="absolute -left-[22px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#3a7bff]" aria-hidden />
                      <div className="text-[12.5px] font-semibold text-[color:var(--ink)]">{h.action.replaceAll("_", " ").toLowerCase().replace(/^\w/, (m) => m.toUpperCase())}</div>
                      <div className="text-[11px] text-[color:var(--ink-faint)]">{h.actor} · {fmtDateTime(h.at)}</div>
                      {h.note && (
                        <div className="mt-1 rounded-xl bg-black/[0.04] px-2.5 py-1.5 text-[11.5px] text-[color:var(--ink-soft)]">{h.note}</div>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {/* validation issues */}
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-[12px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">
                  Validation issues ({detail.validationIssues.length})
                </h3>
              </div>
              {detail.validationIssues.length === 0 ? (
                <p className="text-[12.5px] text-[color:var(--ink-faint)]">No validation issues on this submission.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {detail.validationIssues.map((v, i) => (
                    <button
                      key={i}
                      onClick={() => { closeDetail(); navigate("validation", { q: v.ref }); }}
                      className="rounded-full border border-[rgba(195,74,74,0.28)] bg-[rgba(195,74,74,0.1)] px-2.5 py-1 text-[11px] font-medium text-[#a53b3b] transition-all hover:-translate-y-px hover:bg-[rgba(195,74,74,0.18)]"
                      title={`${v.description} — open in Data Validation`}
                    >
                      {v.ref} · {v.severity} · {v.status}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </GlassDialog>
    </div>
  );
}
