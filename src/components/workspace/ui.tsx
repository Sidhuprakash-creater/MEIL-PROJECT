"use client";

// ── MEIL ESG workspace — reusable Liquid-Glass component library ──
import * as React from "react";
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Download, Inbox, RotateCcw, Search } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { InlineLoader } from "@/components/shared/meil-loader";
import { Ring } from "@/components/ring";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fmtDate, toCsv, downloadFile } from "@/lib/esg/client";

/* ────────────────────────────── Glass surfaces ────────────────────────────── */

export function GlassCard({
  className,
  strong,
  subtle,
  sheen = true,
  interactive,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { strong?: boolean; subtle?: boolean; sheen?: boolean; interactive?: boolean }) {
  return (
    <div
      className={cn(
        strong ? "glass-strong" : subtle ? "glass-subtle" : "glass",
        sheen && "glass-sheen",
        interactive && "glass-lift cursor-pointer",
        "rounded-3xl",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/* ────────────────────────────── Page chrome ────────────────────────────── */

export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
  breadcrumbs,
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  actions?: React.ReactNode;
  breadcrumbs?: string[];
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1.5 text-xs text-[color:var(--ink-faint)]">
            {breadcrumbs.map((b, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-[color:var(--border)]">/</span>}
                <span className={i === breadcrumbs.length - 1 ? "font-medium text-[color:var(--ink-soft)]" : ""}>{b}</span>
              </span>
            ))}
          </nav>
        )}
        <div className="flex items-center gap-3">
          {Icon && (
            <span className="glass-subtle flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
              <Icon className="h-5 w-5 text-[color:var(--esg-blue)]" />
            </span>
          )}
          <div>
            <h1 className="truncate text-xl font-semibold tracking-tight text-[color:var(--ink)] sm:text-2xl">{title}</h1>
            {description && <p className="mt-0.5 line-clamp-2 text-sm text-[color:var(--muted-foreground)]">{description}</p>}
          </div>
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ────────────────────────────── Status / pill badges ────────────────────────────── */

type Tone = "green" | "blue" | "amber" | "red" | "gray" | "purple" | "teal";

const TONE_STYLES: Record<Tone, string> = {
  green: "bg-[rgba(35,134,83,0.12)] text-[#1d6b40] border-[rgba(35,134,83,0.25)]",
  blue: "bg-[rgba(58,123,255,0.12)] text-[#1d5fd6] border-[rgba(58,123,255,0.28)]",
  amber: "bg-[rgba(197,121,38,0.13)] text-[#9c5d1b] border-[rgba(197,121,38,0.3)]",
  red: "bg-[rgba(195,74,74,0.12)] text-[#a53b3b] border-[rgba(195,74,74,0.28)]",
  gray: "bg-[rgba(102,119,141,0.12)] text-[#5b6b80] border-[rgba(102,119,141,0.26)]",
  purple: "bg-[rgba(106,91,255,0.12)] text-[#5546d6] border-[rgba(106,91,255,0.28)]",
  teal: "bg-[rgba(22,163,163,0.12)] text-[#0f7c7c] border-[rgba(22,163,163,0.3)]",
};

export function StatusBadge({ status, className, dot = true }: { status: string; className?: string; dot?: boolean }) {
  const map: Record<string, { tone: Tone; label: string }> = {
    APPROVED: { tone: "green", label: "Approved" },
    COMPLETED: { tone: "green", label: "Completed" },
    ACTIVE: { tone: "green", label: "Active" },
    SUCCESS: { tone: "green", label: "Success" },
    VALIDATED: { tone: "green", label: "Validated" },
    FINALIZED: { tone: "green", label: "Finalized" },
    SUBMITTED: { tone: "blue", label: "Submitted" },
    UNDER_REVIEW: { tone: "blue", label: "Under Review" },
    SENT: { tone: "blue", label: "Sent" },
    INFO: { tone: "blue", label: "Info" },
    REVIEW: { tone: "blue", label: "Review" },
    SIGNOFF: { tone: "blue", label: "Sign-off" },
    IN_PROGRESS: { tone: "blue", label: "In Progress" },
    PENDING: { tone: "amber", label: "Pending" },
    DUE_SOON: { tone: "amber", label: "Due Soon" },
    WARNING: { tone: "amber", label: "Warning" },
    UPCOMING: { tone: "amber", label: "Upcoming" },
    CHANGES_REQUESTED: { tone: "amber", label: "Changes Requested" },
    VALIDATION: { tone: "amber", label: "Validation" },
    CONSOLIDATION: { tone: "purple", label: "Consolidation" },
    SUSPENDED: { tone: "red", label: "Suspended" },
    REJECTED: { tone: "red", label: "Rejected" },
    OVERDUE: { tone: "red", label: "Overdue" },
    CRITICAL: { tone: "red", label: "Critical" },
    HIGH: { tone: "red", label: "High" },
    FAILURE: { tone: "red", label: "Failure" },
    DENIED: { tone: "red", label: "Denied" },
    EXCEPTION: { tone: "red", label: "Exception" },
    DRAFT: { tone: "gray", label: "Draft" },
    INACTIVE: { tone: "gray", label: "Inactive" },
    NOT_MAPPED: { tone: "gray", label: "Not Mapped" },
    ARCHIVED: { tone: "gray", label: "Archived" },
    INVITED: { tone: "purple", label: "Invited" },
    SCHEDULED: { tone: "purple", label: "Scheduled" },
    MEDIUM: { tone: "amber", label: "Medium" },
    LOW: { tone: "gray", label: "Low" },
  };
  const conf = map[status] ?? { tone: "gray" as Tone, label: status.replaceAll("_", " ") };
  const dotColor: Record<Tone, string> = {
    green: "bg-[#238653]",
    blue: "bg-[#3a7bff]",
    amber: "bg-[#c57926]",
    red: "bg-[#c34a4a]",
    gray: "bg-[#8595ab]",
    purple: "bg-[#6a5bff]",
    teal: "bg-[#16a3a3]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-medium leading-5",
        TONE_STYLES[conf.tone],
        className
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dotColor[conf.tone])} />}
      {conf.label}
    </span>
  );
}

/* ────────────────────────────── KPI card ────────────────────────────── */

const KPI_ICONS_TONES: Record<string, string> = {
  blue: "text-[#3a7bff] bg-[rgba(58,123,255,0.12)]",
  purple: "text-[#6a5bff] bg-[rgba(106,91,255,0.12)]",
  teal: "text-[#16a3a3] bg-[rgba(22,163,163,0.12)]",
  green: "text-[#238653] bg-[rgba(35,134,83,0.12)]",
  amber: "text-[#c57926] bg-[rgba(197,121,38,0.13)]",
  red: "text-[#c34a4a] bg-[rgba(195,74,74,0.12)]",
};

export function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "blue",
  trend,
  hint,
  onClick,
  className,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  tone?: keyof typeof KPI_ICONS_TONES;
  trend?: { dir: "up" | "down"; text: string; good?: boolean };
  hint?: string;
  onClick?: () => void;
  className?: string;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={cn(
        "glass glass-sheen glass-lift group flex w-full flex-col gap-3 rounded-3xl p-4 text-left sm:p-5",
        onClick && "text-left",
        className
      )}
      aria-label={onClick ? `${label}: view details` : label}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", KPI_ICONS_TONES[tone])}>
          <Icon className="h-4.5 w-4.5" />
        </span>
        {trend && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
              trend.good === false ? "bg-[rgba(195,74,74,0.1)] text-[#a53b3b]" : "bg-[rgba(35,134,83,0.1)] text-[#1d6b40]"
            )}
          >
            {trend.dir === "up" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {trend.text}
          </span>
        )}
      </div>
      <div>
        <div className="tabular text-2xl font-semibold tracking-tight text-[color:var(--ink)] sm:text-[26px]">{value}</div>
        <div className="mt-0.5 text-[13px] font-medium text-[color:var(--ink-soft)]">{label}</div>
        {hint && <div className="mt-1 text-xs text-[color:var(--ink-faint)]">{hint}</div>}
      </div>
    </Tag>
  );
}

/* ────────────────────────────── Loading / empty / error ────────────────────────────── */

export function LoadingBlock({ rows = 3, label = "Loading data…", role }: { rows?: number; label?: string; role?: string }) {
  return (
    <div className="flex flex-col gap-3 p-5" role="status" aria-live="polite">
      <div className="flex items-center gap-2.5 text-sm text-[color:var(--ink-faint)]">
        <InlineLoader role={role} className="size-4" />
        <span>{label}</span>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-shimmer h-10 rounded-2xl bg-white/40" />
      ))}
    </div>
  );
}

export function EmptyState({ title, message, action, icon: Icon = Inbox }: { title: string; message?: string; action?: React.ReactNode; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <span className="glass-subtle flex h-14 w-14 items-center justify-center rounded-2xl">
        <Icon className="h-6 w-6 text-[color:var(--ink-faint)]" />
      </span>
      <div className="mt-2 text-[15px] font-semibold text-[color:var(--ink)]">{title}</div>
      {message && <p className="max-w-sm text-sm text-[color:var(--muted-foreground)]">{message}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center" role="alert">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgba(195,74,74,0.1)]">
        <AlertTriangle className="h-6 w-6 text-[#c34a4a]" />
      </span>
      <div className="mt-2 text-[15px] font-semibold text-[color:var(--ink)]">Something went wrong</div>
      <p className="max-w-md text-sm text-[color:var(--muted-foreground)]">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Try again
        </Button>
      )}
    </div>
  );
}

/* ────────────────────────────── Toolbar (search + filters) ────────────────────────────── */

export interface ToolbarFilter {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}

export function Toolbar({
  search,
  onSearch,
  searchPlaceholder = "Search…",
  filters = [],
  onReset,
  right,
  resultCount,
}: {
  search: string;
  onSearch: (v: string) => void;
  searchPlaceholder?: string;
  filters?: ToolbarFilter[];
  onReset?: () => void;
  right?: React.ReactNode;
  resultCount?: number;
}) {
  const hasFilters = filters.some((f) => f.value !== "ALL");
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--ink-faint)]" />
          <Input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="glass-subtle h-10 rounded-2xl border-white/60 pl-9 text-sm"
            aria-label={searchPlaceholder}
          />
        </div>
        {filters.map((f) => (
          <Select key={f.key} value={f.value} onValueChange={f.onChange}>
            <SelectTrigger className="glass-subtle h-10 w-auto min-w-[130px] rounded-2xl border-white/60 text-sm" aria-label={f.label}>
              <span className="mr-1 hidden text-xs text-[color:var(--ink-faint)] md:inline">{f.label}:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="glass-strong border-white/70 rounded-2xl">
              {f.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
        {(onReset && (hasFilters || search)) && (
          <Button variant="ghost" size="sm" className="h-10 rounded-2xl text-[color:var(--ink-soft)]" onClick={() => { onReset(); }} aria-label="Reset filters">
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          {resultCount !== undefined && (
            <span className="text-xs text-[color:var(--ink-faint)]" aria-live="polite">
              {resultCount} result{resultCount === 1 ? "" : "s"}
            </span>
          )}
          {right}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────── Data table ────────────────────────────── */

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
  className?: string;
  headerClassName?: string;
  render: (row: T) => React.ReactNode;
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  loading,
  error,
  onRetry,
  pageSize = 8,
  onRowClick,
  emptyTitle = "No records found",
  emptyMessage,
  emptyAction,
  rowActions,
  selectable,
  selectedIds,
  onSelectionChange,
  toolbar,
  mobileCard,
  stickyHeader = true,
}: {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  pageSize?: number;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyAction?: React.ReactNode;
  rowActions?: (row: T) => React.ReactNode;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  toolbar?: React.ReactNode;
  mobileCard?: (row: T) => React.ReactNode;
  stickyHeader?: boolean;
}) {
  const [page, setPage] = React.useState(1);
  const [sortKey, setSortKey] = React.useState<string | null>(null);
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");

  React.useEffect(() => {
    setPage(1);
  }, [rows.length, sortKey, sortDir]);

  const sorted = React.useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return rows;
    const sv = col.sortValue;
    return [...rows].sort((a, b) => {
      const va = sv(a);
      const vb = sv(b);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const allOnPageSelected = pageRows.length > 0 && selectedIds && pageRows.every((r) => selectedIds.includes(r.id));

  if (error) return <GlassCard className="overflow-hidden"><ErrorState message={error} onRetry={onRetry} /></GlassCard>;
  if (loading) return <GlassCard className="overflow-hidden"><LoadingBlock rows={5} /></GlassCard>;

  return (
    <div className="flex flex-col gap-3">
      {toolbar}
      <GlassCard className="overflow-hidden">
        {pageRows.length === 0 ? (
          <EmptyState title={emptyTitle} message={emptyMessage} action={emptyAction} />
        ) : (
          <>
            {/* Desktop table */}
            <div className={cn("nice-scroll hidden overflow-x-auto md:block", stickyHeader && "max-h-[70vh] overflow-y-auto")}>
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead className={cn(stickyHeader && "sticky top-0 z-10")}>
                  <tr className="bg-white/70 backdrop-blur-md [&>th]:border-b [&>th]:border-[rgba(125,177,216,0.35)]">
                    {selectable && (
                      <th className="w-10 px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          aria-label="Select all on page"
                          checked={!!allOnPageSelected}
                          onChange={(e) => {
                            if (!onSelectionChange || !selectedIds) return;
                            const pageIds = pageRows.map((r) => r.id);
                            onSelectionChange(
                              e.target.checked
                                ? Array.from(new Set([...selectedIds, ...pageIds]))
                                : selectedIds.filter((id) => !pageIds.includes(id))
                            );
                          }}
                          className="h-4 w-4 cursor-pointer accent-[color:var(--esg-blue)]"
                        />
                      </th>
                    )}
                    {columns.map((c) => (
                      <th
                        key={c.key}
                        className={cn(
                          "px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[color:var(--ink-faint)]",
                          c.sortable && "cursor-pointer select-none hover:text-[color:var(--ink-soft)]",
                          c.headerClassName
                        )}
                        onClick={c.sortable ? () => toggleSort(c.key) : undefined}
                        aria-sort={sortKey === c.key ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
                      >
                        <span className="inline-flex items-center gap-1">
                          {c.header}
                          {c.sortable && (
                            sortKey === c.key
                              ? sortDir === "asc"
                                ? <ArrowUp className="h-3 w-3 text-[color:var(--esg-blue)]" />
                                : <ArrowDown className="h-3 w-3 text-[color:var(--esg-blue)]" />
                              : <ArrowUpDown className="h-3 w-3 opacity-40" />
                          )}
                        </span>
                      </th>
                    ))}
                    {rowActions && <th className="w-12 px-4 py-3" aria-label="Actions" />}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      className={cn(
                        "border-b border-[rgba(125,177,216,0.18)] transition-colors last:border-0 hover:bg-[rgba(58,123,255,0.05)]",
                        onRowClick && "cursor-pointer"
                      )}
                    >
                      {selectable && (
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            aria-label={`Select row ${row.id}`}
                            checked={!!selectedIds?.includes(row.id)}
                            onChange={(e) => {
                              if (!onSelectionChange || !selectedIds) return;
                              onSelectionChange(e.target.checked ? [...selectedIds, row.id] : selectedIds.filter((id) => id !== row.id));
                            }}
                            className="h-4 w-4 cursor-pointer accent-[color:var(--esg-blue)]"
                          />
                        </td>
                      )}
                      {columns.map((c) => (
                        <td key={c.key} className={cn("px-4 py-3 align-middle text-[color:var(--ink-soft)]", c.className)}>
                          {c.render(row)}
                        </td>
                      ))}
                      {rowActions && (
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end">{rowActions(row)}</div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className="flex flex-col gap-3 p-3 md:hidden">
              {pageRows.map((row) =>
                mobileCard ? (
                  <div key={row.id} onClick={onRowClick ? () => onRowClick(row) : undefined}>{mobileCard(row)}</div>
                ) : (
                  <GlassCard key={row.id} subtle className={cn("p-3", onRowClick && "glass-lift cursor-pointer")} onClick={onRowClick ? () => onRowClick(row) : undefined}>
                    <div className="flex flex-col gap-1.5">
                      {columns.slice(0, 5).map((c) => (
                        <div key={c.key} className="flex items-start justify-between gap-3 text-[13px]">
                          <span className="shrink-0 text-[color:var(--ink-faint)]">{c.header}</span>
                          <span className="text-right text-[color:var(--ink-soft)]">{c.render(row)}</span>
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                )
              )}
            </div>
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-2 border-t border-[rgba(125,177,216,0.25)] px-4 py-2.5">
                <span className="text-xs text-[color:var(--ink-faint)]">
                  Page {safePage} of {totalPages} · {sorted.length} records
                </span>
                <div className="flex items-center gap-1.5">
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} aria-label="Previous page">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)} aria-label="Next page">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </GlassCard>
    </div>
  );
}

/* ────────────────────────────── Export menu ────────────────────────────── */

export function ExportButton({ filename, rows, formats = ["CSV", "JSON"], size = "sm" }: { filename: string; rows: Record<string, unknown>[]; formats?: string[]; size?: "sm" | "default" }) {
  const [done, setDone] = React.useState<string | null>(null);
  const doExport = (format: string) => {
    if (format === "CSV") downloadFile(`${filename}.csv`, toCsv(rows), "text/csv");
    else downloadFile(`${filename}.json`, JSON.stringify(rows, null, 2), "application/json");
    setDone(format);
    setTimeout(() => setDone(null), 2500);
  };
  return (
    <div className="flex items-center gap-1.5">
      {done && <span className="text-xs font-medium text-[#1d6b40]" role="status">Exported {done}</span>}
      {formats.map((f) => (
        <Button key={f} variant="outline" size={size} className="glass-subtle h-9 rounded-2xl border-white/60" onClick={() => doExport(f)}>
          <Download className="mr-1.5 h-3.5 w-3.5" /> {f}
        </Button>
      ))}
    </div>
  );
}

/* ────────────────────────────── Dialogs / confirm / drawer ────────────────────────────── */

export function GlassDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn("glass-strong fixed inset-0 m-auto z-[70] max-h-[88vh] overflow-y-auto rounded-3xl border-white/80 nice-scroll", wide ? "sm:max-w-4xl" : "sm:max-w-lg")}
        style={{ transform: "none", translate: "none", margin: "auto" }}
      >
        <DialogHeader>
          <DialogTitle className="text-lg text-[color:var(--ink)]">{title}</DialogTitle>
          {description && <DialogDescription className="text-sm text-[color:var(--muted-foreground)]">{description}</DialogDescription>}
        </DialogHeader>
        <div className="mt-1">{children}</div>
        {footer && <DialogFooter className="mt-4 gap-2">{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmLabel = "Confirm",
  destructive,
  requireReason,
  onConfirm,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  requireReason?: boolean;
  onConfirm: (reason?: string) => void;
  pending?: boolean;
}) {
  const [reason, setReason] = React.useState("");
  React.useEffect(() => {
    if (!open) setReason("");
  }, [open]);
  const canConfirm = !requireReason || reason.trim().length >= 4;
  return (
    <GlassDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      footer={
        <>
          <Button variant="outline" className="glass-subtle rounded-2xl" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            className={cn("rounded-2xl cursor-pointer", !destructive && "bg-[#8B5CF6] text-white hover:bg-[#7C3AED]")}
            disabled={!canConfirm || pending}
            onClick={() => onConfirm(requireReason ? reason.trim() : undefined)}
          >
            {pending && <Ring className="mr-1.5 size-4" />}
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-[color:var(--ink-soft)]">{message}</p>
      {requireReason && (
        <div className="mt-3">
          <label className="mb-1.5 block text-[13px] font-medium text-[color:var(--ink)]" htmlFor="confirm-reason">
            Reason <span className="text-[#c34a4a]">*</span>
          </label>
          <textarea
            id="confirm-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Document the reason for this decision (min 4 characters)…"
            className="glass-subtle w-full rounded-2xl border-white/60 p-3 text-sm outline-none placeholder:text-[color:var(--ink-faint)] focus:ring-2 focus:ring-[color:var(--ring)]"
          />
          {reason.length > 0 && reason.trim().length < 4 && <p className="mt-1 text-xs text-[#c34a4a]">Reason must be at least 4 characters.</p>}
        </div>
      )}
    </GlassDialog>
  );
}

export function DetailSheet({
  open,
  onOpenChange,
  title,
  subtitle,
  children,
  footer,
  width = "lg",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: "md" | "lg" | "xl";
}) {
  const wClass = width === "md" ? "sm:max-w-md" : width === "xl" ? "sm:max-w-2xl" : "sm:max-w-xl";
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={cn("glass-strong flex w-full flex-col gap-0 overflow-hidden border-white/80 p-0 sm:w-[initial]", wClass)}>
        <SheetHeader className="glass-sheen shrink-0 border-b border-[rgba(125,177,216,0.3)] bg-white/50 px-6 py-5 text-left">
          <SheetTitle className="text-base leading-snug text-[color:var(--ink)]">{title}</SheetTitle>
          {subtitle && <SheetDescription className="text-[13px] text-[color:var(--muted-foreground)]">{subtitle}</SheetDescription>}
        </SheetHeader>
        <div className="nice-scroll flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="shrink-0 border-t border-[rgba(125,177,216,0.3)] bg-white/50 px-6 py-4">{footer}</div>}
      </SheetContent>
    </Sheet>
  );
}

/* ────────────────────────────── Tabs ────────────────────────────── */

export function GlassTabBar({ tabs, value, onChange, className }: { tabs: { value: string; label: string; icon?: React.ComponentType<{ className?: string }>; count?: number }[]; value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <div role="tablist" aria-label="Section tabs" className={cn("glass-subtle nice-scroll flex gap-1 overflow-x-auto rounded-2xl p-1", className)}>
      {tabs.map((t) => {
        const active = value === t.value;
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn(
              "relative flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-[13px] font-medium transition-all",
              active ? "nav-active" : "text-[color:var(--ink-soft)] hover:bg-white/60"
            )}
          >
            {t.icon && <t.icon className="h-3.5 w-3.5" />}
            {t.label}
            {t.count !== undefined && (
              <span className={cn("ml-0.5 rounded-full px-1.5 py-px text-[10px] font-semibold", active ? "bg-[rgba(58,123,255,0.18)]" : "bg-black/5")}>{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ────────────────────────────── Form fields ────────────────────────────── */

export function Field({ label, required, error, hint, children, htmlFor }: { label: string; required?: boolean; error?: string | null; hint?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-[color:var(--ink)]">
        {label} {required && <span className="text-[#c34a4a]">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-[color:var(--ink-faint)]">{hint}</p>}
      {error && <p className="text-xs font-medium text-[#c34a4a]" role="alert">{error}</p>}
    </div>
  );
}

/* ────────────────────────────── Avatar ────────────────────────────── */

const AVATAR_TONES = [
  "bg-[rgba(58,123,255,0.16)] text-[#1d5fd6]",
  "bg-[rgba(106,91,255,0.16)] text-[#5546d6]",
  "bg-[rgba(22,163,163,0.16)] text-[#0f7c7c]",
  "bg-[rgba(35,134,83,0.16)] text-[#1d6b40]",
  "bg-[rgba(197,121,38,0.16)] text-[#9c5d1b]",
  "bg-[rgba(195,74,74,0.14)] text-[#a53b3b]",
];

export function Avatar({ name, className, size = 36 }: { name: string; className?: string; size?: number }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const tone = AVATAR_TONES[(name.charCodeAt(0) + (name.charCodeAt(name.length - 1) || 0)) % AVATAR_TONES.length];
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full border border-white/70 font-semibold shadow-sm", tone, className)}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

/* ────────────────────────────── Info rows / meta ────────────────────────────── */

export function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="shrink-0 text-[13px] text-[color:var(--ink-faint)]">{label}</span>
      <span className="text-right text-[13px] font-medium text-[color:var(--ink-soft)]">{children}</span>
    </div>
  );
}

export function SectionCard({
  title,
  description,
  icon: Icon,
  actions,
  action,
  children,
  className,
  noPad,
  subtle,
}: {
  title?: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  actions?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  noPad?: boolean;
  subtle?: boolean;
}) {
  const headerActions = actions ?? action;
  return (
    <GlassCard className={cn("overflow-hidden", className)} subtle={subtle}>
      {title && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[rgba(125,177,216,0.25)] px-5 pb-3.5 pt-4">
          <div className="flex items-center gap-2.5">
            {Icon && (
              <span className="glass-subtle flex h-8 w-8 items-center justify-center rounded-xl">
                <Icon className="h-4 w-4 text-[color:var(--esg-blue)]" />
              </span>
            )}
            <div>
              <h2 className="text-[15px] font-semibold text-[color:var(--ink)]">{title}</h2>
              {description && <p className="text-xs text-[color:var(--muted-foreground)]">{description}</p>}
            </div>
          </div>
          {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
        </div>
      )}
      <div className={noPad ? "" : "p-4 sm:p-5"}>{children}</div>
    </GlassCard>
  );
}

/* ────────────────────────────── Progress ────────────────────────────── */

export function GlassProgress({ value, tone = "blue", className, showLabel }: { value: number; tone?: "blue" | "green" | "amber" | "red" | "purple"; className?: string; showLabel?: boolean }) {
  const bg: Record<string, string> = {
    blue: "bg-gradient-to-r from-[#3a7bff] to-[#6a9bff]",
    green: "bg-gradient-to-r from-[#238653] to-[#3fa96f]",
    amber: "bg-gradient-to-r from-[#c57926] to-[#e09a4a]",
    red: "bg-gradient-to-r from-[#c34a4a] to-[#dd6f6f]",
    purple: "bg-gradient-to-r from-[#6a5bff] to-[#8f83ff]",
  };
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[rgba(102,119,141,0.14)]" role="progressbar" aria-valuenow={Math.round(clamped)} aria-valuemin={0} aria-valuemax={100}>
        <motion.div
          className={cn("h-full rounded-full", bg[tone])}
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      {showLabel && <span className="tabular shrink-0 text-xs font-medium text-[color:var(--ink-soft)]">{Math.round(clamped)}%</span>}
    </div>
  );
}

/* ────────────────────────────── Animated number ────────────────────────────── */

export function CountUp({ value, format = (n: number) => String(n), className }: { value: number; format?: (n: number) => string; className?: string }) {
  const [display, setDisplay] = React.useState(0);
  const prev = React.useRef(0);
  React.useEffect(() => {
    const from = prev.current;
    const to = value;
    prev.current = value;
    if (from === to) {
      setDisplay(to);
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setDisplay(to);
      return;
    }
    const start = performance.now();
    const dur = 700;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (to - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className={className}>{format(display)}</span>;
}

/* ────────────────────────────── Toast-friendly generic button w/ pending ────────────────────────────── */

export function ActionButton({
  children,
  pending,
  className,
  ...props
}: React.ComponentProps<typeof Button> & { pending?: boolean }) {
  return (
    <Button className={cn("rounded-2xl", className)} disabled={pending || props.disabled} {...props}>
      {pending && <Ring className="mr-1.5 size-4" />}
      {children}
    </Button>
  );
}

/* ────────────────────────────── Key-value chips ────────────────────────────── */

export function Chip({ children, tone = "gray", className }: { children: React.ReactNode; tone?: Tone; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium", TONE_STYLES[tone], className)}>{children}</span>;
}

/* ────────────────────────────── Tooltip helper (icon button) ────────────────────────────── */

export function TipIconButton({
  tip,
  children,
  className,
  ...props
}: React.ComponentProps<typeof Button> & { tip: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className={cn("h-8 w-8 rounded-xl text-[color:var(--ink-soft)] hover:bg-white/70", className)} {...props}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" className="rounded-xl border-white/70 bg-white/90 text-[color:var(--ink)] shadow-lg backdrop-blur">
        {tip}
      </TooltipContent>
    </Tooltip>
  );
}

/* ────────────────────────────── AnimatePresence list helper ────────────────────────────── */

export function FadeList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <AnimatePresence mode="popLayout">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className={className}>
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export { fmtDate };
