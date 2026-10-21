"use client";

// ── SCREEN 03 — Organization Hierarchy (node-based interactive tree + view panel) ──
import { useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  BadgeCheck,
  Building2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  FolderTree,
  Gauge,
  Info,
  Landmark,
  Layers,
  ListTree,
  Network,
  Users,
  X,
} from "lucide-react";
import { useWorkspace } from "@/lib/esg/store";
import { useApi, fmtNumber } from "@/lib/esg/client";
import { ROLE_LABELS, type HierarchyNode, type HierarchyNodeDetail } from "@/lib/esg/types";
import {
  Avatar,
  Chip,
  EmptyState,
  ErrorState,
  GlassCard,
  LoadingBlock,
  PageHeader,
  StatusBadge,
  Toolbar,
  type ToolbarFilter,
} from "@/components/workspace/ui";

/* ────────────────────────────── Type styling ────────────────────────────── */

type NodeType = HierarchyNode["type"];

const TYPE_CONF: Record<NodeType, { icon: typeof Landmark; label: string; tile: string; hex: string }> = {
  subsidiary: { icon: Landmark, label: "Subsidiary", tile: "bg-[rgba(106,91,255,0.13)] text-[#6a5bff]", hex: "#6a5bff" },
  unit: { icon: Layers, label: "Business Unit", tile: "bg-[rgba(58,123,255,0.13)] text-[#3a7bff]", hex: "#3a7bff" },
  project: { icon: Building2, label: "Project / Site", tile: "bg-[rgba(22,163,163,0.13)] text-[#16a3a3]", hex: "#16a3a3" },
};

const TYPE_VIEW: Record<NodeType, "subsidiaries" | "units" | "projects"> = {
  subsidiary: "subsidiaries",
  unit: "units",
  project: "projects",
};

const LINE = "bg-[rgba(58,123,255,0.32)]";

const STATUS_TONE: Record<string, string> = {
  APPROVED: "#238653",
  UNDER_REVIEW: "#6a5bff",
  SUBMITTED: "#3a7bff",
  CHANGES_REQUESTED: "#c57926",
  ASSIGNED: "#8595ab",
  DRAFT: "#8595ab",
  REJECTED: "#c34a4a",
};

const STATUS_SHORT: Record<string, string> = {
  APPROVED: "Approved",
  UNDER_REVIEW: "Under review",
  SUBMITTED: "Submitted",
  CHANGES_REQUESTED: "Changes req.",
  ASSIGNED: "Assigned",
  DRAFT: "Draft",
  REJECTED: "Rejected",
};

/* ────────────────────────────── Tree helpers ────────────────────────────── */

/** Keep nodes matching query/status, or having a matching descendant. */
function filterTree(nodes: HierarchyNode[], q: string, status: string): HierarchyNode[] {
  const walk = (list: HierarchyNode[]): HierarchyNode[] =>
    list.flatMap((n) => {
      const kids = n.children ? walk(n.children) : [];
      const selfMatch =
        (!q || n.name.toLowerCase().includes(q) || n.code.toLowerCase().includes(q)) &&
        (status === "ALL" || n.status === status);
      if (selfMatch) return [{ ...n, children: n.children ? walk(n.children) : [] }];
      if (kids.length > 0) return [{ ...n, children: kids }];
      return [];
    });
  return walk(nodes);
}

function countTree(nodes: HierarchyNode[]) {
  let units = 0;
  let projects = 0;
  let users = 0;
  let submissions = 0;
  for (const s of nodes) {
    units += s.children?.length ?? 0;
    users += s.stats?.users ?? 0;
    submissions += s.stats?.submissions ?? 0;
    for (const u of s.children ?? []) {
      projects += u.children?.length ?? 0;
      users += u.stats?.users ?? 0;
    }
  }
  return { subs: nodes.length, units, projects, users, submissions };
}

/** Path of nodes from root to the node with the given id (excluding it). */
function ancestorsOf(nodes: HierarchyNode[], id: string): HierarchyNode[] | null {
  for (const n of nodes) {
    if (n.id === id) return [];
    if (n.children) {
      const sub = ancestorsOf(n.children, id);
      if (sub) return [n, ...sub];
    }
  }
  return null;
}

/* ────────────────────────────── Node cards ────────────────────────────── */

function ExpandButton({
  open,
  count,
  onClick,
  name,
}: {
  open: boolean;
  count: number;
  onClick: () => void;
  name: string;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`flex h-7 shrink-0 items-center gap-1 rounded-full border border-white/60 bg-white/60 px-1.5 text-[10px] font-semibold text-[color:var(--ink-soft)] transition-all hover:bg-white/90 ${open ? "text-[#1d5fd6]" : ""}`}
      aria-expanded={open}
      aria-label={open ? `Collapse ${name}` : `Expand ${name} (${count} hidden)`}
    >
      {count > 0 && <span className="tabular">{count}</span>}
      {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
    </button>
  );
}

/** Card for a subsidiary / business-unit node. */
function OrgCard({
  node,
  depth,
  open,
  selected,
  onToggle,
  onSelect,
}: {
  node: HierarchyNode;
  depth: number;
  open: boolean;
  selected: boolean;
  onToggle: () => void;
  onSelect: () => void;
}) {
  const conf = TYPE_CONF[node.type];
  const kids = node.children ?? [];
  const isSub = node.type === "subsidiary";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      aria-label={`${conf.label}: ${node.name} — open detail panel`}
      className={`group w-full cursor-pointer border text-left shadow-[0_2px_10px_rgba(23,38,61,0.05)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-px hover:shadow-[0_8px_24px_rgba(23,38,61,0.10)] ${
        selected ? "border-[rgba(58,123,255,0.55)] bg-white/85 ring-2 ring-[rgba(58,123,255,0.35)]" : "border-white/70 bg-white/65 hover:bg-white/85"
      } ${isSub ? "min-h-[92px] rounded-3xl p-3.5" : "min-h-[64px] rounded-2xl p-3"}`}
    >
      <div className="flex items-start gap-2.5">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${conf.tile} ${isSub ? "h-10 w-10" : ""}`} aria-hidden="true">
          <conf.icon className={isSub ? "h-5 w-5" : "h-4 w-4"} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className={`truncate font-semibold leading-5 text-[color:var(--ink)] ${isSub ? "text-[14px]" : "text-[13px]"}`}>{node.name}</span>
            {kids.length > 0 && <ExpandButton open={open} count={kids.length} onClick={onToggle} name={node.name} />}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5">
            <span className="rounded-md bg-[rgba(102,119,141,0.10)] px-1.5 py-px font-mono text-[10px] font-medium tracking-wide text-[color:var(--ink-faint)]">{node.code}</span>
            {depth === 0 && node.manager && <span className="hidden truncate text-[11px] text-[color:var(--ink-faint)] md:inline">Mgr · {node.manager}</span>}
          </span>
        </span>
      </div>
      {isSub && node.meta && <div className="mt-1.5 truncate pl-[48px] text-[11.5px] text-[color:var(--ink-faint)]">{node.meta}</div>}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {node.stats && (
          <>
            <Chip tone="blue">
              <Users className="h-3 w-3" aria-hidden="true" />
              {node.stats.users}
            </Chip>
            {node.type === "subsidiary" && (
              <Chip tone="purple">
                <Layers className="h-3 w-3" aria-hidden="true" />
                {kids.length} BU{kids.length === 1 ? "" : "s"}
              </Chip>
            )}
            {node.stats.projects > 0 && (
              <Chip tone="teal">
                <Building2 className="h-3 w-3" aria-hidden="true" />
                {node.stats.projects} {node.stats.projects === 1 ? "project" : "projects"}
              </Chip>
            )}
            <Chip tone="gray">
              <ClipboardList className="h-3 w-3" aria-hidden="true" />
              {node.stats.submissions} subs
            </Chip>
          </>
        )}
        <StatusBadge status={node.status} />
      </div>
    </div>
  );
}

/** Leaf row for a project node (compact chip style like a site register entry). */
function ProjectCard({ node, selected, onSelect }: { node: HierarchyNode; selected: boolean; onSelect: () => void }) {
  const conf = TYPE_CONF.project;
  const active = node.status === "ACTIVE";
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      aria-label={`Project: ${node.name} (${node.status}) — open detail panel`}
      title={`${node.name} — ${node.meta}`}
      className={`group flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-2xl border px-2.5 py-2 backdrop-blur-xl transition-all duration-200 hover:-translate-y-px ${
        selected ? "border-[rgba(58,123,255,0.55)] bg-white/85 ring-2 ring-[rgba(58,123,255,0.35)]" : "border-white/70 bg-white/55 hover:bg-white/85"
      }`}
    >
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/70 ${conf.tile}`} aria-hidden="true">
        <conf.icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold leading-5 text-[color:var(--ink)]">{node.name}</span>
        <span className="block truncate text-[10.5px] capitalize text-[color:var(--ink-faint)]">{node.meta}</span>
      </span>
      {node.stats && node.stats.submissions > 0 && (
        <span className="tabular shrink-0 rounded-full bg-[rgba(22,163,163,0.10)] px-1.5 py-0.5 text-[10px] font-semibold text-[#0f7c7c]">
          {node.stats.submissions} subs
        </span>
      )}
      <span
        aria-hidden="true"
        className={`h-2 w-2 shrink-0 rounded-full ${active ? "bg-[#238653]" : "bg-[#8595ab]"}`}
        title={node.status}
      />
    </div>
  );
}

/* ────────────────────────────── Recursive branch ────────────────────────────── */

interface BranchCtx {
  openMap: Record<string, boolean>;
  searchActive: boolean;
  selectedId: string | null;
  onToggle: (id: string, next: boolean) => void;
  onSelect: (node: HierarchyNode) => void;
}

function TreeBranch({ nodes, depth, ctx, connectors = true }: { nodes: HierarchyNode[]; depth: number; ctx: BranchCtx; connectors?: boolean }) {
  return (
    <div className="relative" role="group">
      {nodes.map((node, i) => {
        const isLast = i === nodes.length - 1;
        const kids = node.children ?? [];
        const isOpen = ctx.searchActive ? true : (ctx.openMap[node.id] ?? true);
        const selected = ctx.selectedId === node.id;
        const isProject = node.type === "project";
        return (
          <div key={node.id} className={connectors ? "relative pl-10 pt-3" : "relative pt-3 first:pt-0"}>
            {/* spine segments + elbow connector */}
            {connectors && (
              <>
                <span aria-hidden className={`absolute left-[18px] top-0 w-px ${LINE} ${isLast ? "h-[44px]" : "h-full"}`} />
                <span aria-hidden className={`absolute left-[18px] top-[44px] h-px w-[22px] ${LINE}`} />
                <span aria-hidden className="absolute left-[14.5px] top-[40.5px] h-[7px] w-[7px] rounded-full border-2 border-white bg-[#3a7bff]/70 shadow-sm" />
              </>
            )}

            {!isProject && (
              <OrgCard
                node={node}
                depth={depth}
                open={isOpen}
                selected={selected}
                onToggle={() => ctx.onToggle(node.id, !isOpen)}
                onSelect={() => ctx.onSelect(node)}
              />
            )}
            {isProject && <ProjectCard node={node} selected={selected} onSelect={() => ctx.onSelect(node)} />}

            <AnimatePresence initial={false}>
              {!isProject && kids.length > 0 && isOpen && (
                <motion.div
                  key="children"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <TreeBranch nodes={kids} depth={depth + 1} ctx={ctx} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

/* ────────────────────────────── Root group card ────────────────────────────── */

function RootCard({ counts }: { counts: { subs: number; units: number; projects: number; users: number; submissions: number } }) {
  const { navigate } = useWorkspace();
  const stats: { label: string; value: number; icon: typeof Landmark; hex: string; go: () => void }[] = [
    { label: "Subsidiaries", value: counts.subs, icon: Landmark, hex: "#6a5bff", go: () => navigate("subsidiaries") },
    { label: "Business Units", value: counts.units, icon: Layers, hex: "#3a7bff", go: () => navigate("units") },
    { label: "Projects", value: counts.projects, icon: Building2, hex: "#16a3a3", go: () => navigate("projects") },
    { label: "Users", value: counts.users, icon: Users, hex: "#238653", go: () => navigate("users") },
  ];
  return (
    <GlassCard strong className="mx-auto w-full max-w-2xl rounded-[26px] p-5">
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-gradient-to-br from-[#3a7bff] to-[#6a5bff] shadow-lg shadow-[rgba(58,123,255,0.35)]" aria-hidden="true">
          <Landmark className="h-7 w-7 text-white" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-[color:var(--ink)]">MEIL Group</h2>
            <Chip tone="blue">Group HQ</Chip>
          </div>
          <p className="mt-0.5 truncate text-xs text-[color:var(--ink-faint)]">
            {counts.subs} active subsidiaries · {counts.submissions} ESG submissions tracked
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/60 bg-[rgba(125,177,216,0.28)] sm:grid-cols-4">
        {stats.map((s) => (
          <button
            key={s.label}
            onClick={s.go}
            className="group flex flex-col items-start gap-0.5 bg-white/50 px-3.5 py-2.5 text-left backdrop-blur-sm transition-colors hover:bg-white/80"
            aria-label={`${s.label}: ${s.value} — open module`}
          >
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--ink-faint)]">
              <s.icon className="h-3 w-3" style={{ color: s.hex }} aria-hidden="true" />
              {s.label}
            </span>
            <span className="tabular text-lg font-semibold leading-6 text-[color:var(--ink)] transition-colors group-hover:text-[#1d5fd6]">
              {fmtNumber(s.value)}
            </span>
          </button>
        ))}
      </div>
    </GlassCard>
  );
}

/* ────────────────────────────── Detail view panel ────────────────────────────── */

function PanelSection({ icon: Icon, title, children, action }: { icon: typeof Gauge; title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">
          <Icon className="h-3.5 w-3.5 text-[color:var(--esg-blue)]" aria-hidden="true" />
          {title}
        </h4>
        {action}
      </div>
      {children}
    </section>
  );
}

function ApprovalRing({ value, size = 84, stroke = 9 }: { value: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(102,119,141,0.16)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#238653"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(clamped / 100) * c} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dasharray 0.7s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="tabular text-sm font-semibold text-[color:var(--ink)]">{Math.round(clamped)}%</span>
      </div>
    </div>
  );
}

function NodePanel({
  detail,
  loading,
  error,
  retry,
  floating,
  onClose,
  onSelect,
}: {
  detail: HierarchyNodeDetail | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
  floating: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const { openDetail } = useWorkspace();

  if (loading || error || !detail) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        {loading ? (
          <>
            <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-[rgba(58,123,255,0.25)] border-t-[#3a7bff]" aria-hidden="true" />
            <p className="text-sm text-[color:var(--ink-faint)]">Loading node details…</p>
          </>
        ) : error ? (
          <>
            <p className="text-sm font-medium text-[#a53b3b]">{error}</p>
            <button onClick={retry} className="glass-subtle rounded-2xl border-white/60 px-4 py-2 text-xs font-semibold text-[color:var(--ink-soft)] hover:bg-white/70">
              Try again
            </button>
          </>
        ) : null}
      </div>
    );
  }

  const conf = TYPE_CONF[detail.type];
  const approvalPct = detail.stats.submissions > 0 ? (detail.stats.approved / detail.stats.submissions) * 100 : 0;
  const maxBreak = Math.max(...detail.statusBreakdown.map((b) => b.count), 1);

  const tiles: { label: string; value: number; icon: typeof Users; hex: string }[] =
    detail.type === "project"
      ? [
          { label: "Users", value: detail.stats.users, icon: Users, hex: "#3a7bff" },
          { label: "Approved", value: detail.stats.approved, icon: BadgeCheck, hex: "#238653" },
          { label: "Submissions", value: detail.stats.submissions, icon: ClipboardList, hex: "#6a5bff" },
          { label: "Overdue", value: detail.stats.overdue, icon: FileText, hex: detail.stats.overdue > 0 ? "#c34a4a" : "#238653" },
        ]
      : [
          { label: "Users", value: detail.stats.users, icon: Users, hex: "#3a7bff" },
          { label: "Projects", value: detail.stats.projects, icon: Building2, hex: "#16a3a3" },
          { label: "Submissions", value: detail.stats.submissions, icon: ClipboardList, hex: "#6a5bff" },
          { label: "Overdue", value: detail.stats.overdue, icon: FileText, hex: detail.stats.overdue > 0 ? "#c34a4a" : "#238653" },
        ];

  return (
    <div className="flex h-full flex-col">
      {/* header */}
      <div className="relative overflow-hidden rounded-t-[23px] border-b border-white/60 bg-gradient-to-br from-[rgba(58,123,255,0.14)] via-white/30 to-[rgba(22,163,163,0.12)] p-5">
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(58,123,255,0.25),transparent_65%)] blur-xl" />
        <div className="relative">
          <div className="flex items-start justify-between gap-2">
            {/* breadcrumb */}
            <nav aria-label="Node location" className="flex min-w-0 flex-wrap items-center gap-1 text-[11px] text-[color:var(--ink-faint)]">
              {detail.breadcrumb.map((bc, i) => (
                <span key={bc.id} className="flex min-w-0 items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3 w-3 shrink-0" aria-hidden="true" />}
                  {i < detail.breadcrumb.length - 1 ? (
                    <button onClick={() => onSelect(bc.id)} className="max-w-[110px] truncate rounded-md px-1 py-0.5 font-medium transition-colors hover:bg-white/60 hover:text-[#1d5fd6]">
                      {bc.name}
                    </button>
                  ) : (
                    <span className="max-w-[110px] truncate px-1 font-semibold text-[color:var(--ink-soft)]">{bc.name}</span>
                  )}
                </span>
              ))}
            </nav>
            <button
              onClick={onClose}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/70 bg-white/60 text-[color:var(--ink-soft)] transition-colors hover:bg-white/90"
              aria-label="Close detail panel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${conf.tile}`} aria-hidden="true">
              <conf.icon className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-[16px] font-semibold leading-5 text-[color:var(--ink)]">{detail.name}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="rounded-md bg-[rgba(102,119,141,0.10)] px-1.5 py-px font-mono text-[10px] font-medium text-[color:var(--ink-faint)]">{detail.code}</span>
                <Chip tone="gray">{conf.label}</Chip>
                <StatusBadge status={detail.status} />
              </div>
            </div>
          </div>

          <button
            onClick={() => openDetail(TYPE_VIEW[detail.type], detail.id, "overview")}
            className="glass mt-3.5 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-2xl border-white/60 text-[13px] font-semibold text-[#1d5fd6] transition-colors hover:bg-white/80"
          >
            Open full profile
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* scroll body */}
      <div className="nice-scroll flex-1 space-y-5 overflow-y-auto p-5" data-floating={floating ? "true" : undefined}>
        {/* stat tiles */}
        <div className="grid grid-cols-2 gap-2.5">
          {tiles.map((t) => (
            <div key={t.label} className="glass-subtle flex items-center gap-2.5 rounded-2xl border-white/55 p-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: `${t.hex}1c` }} aria-hidden="true">
                <t.icon className="h-4 w-4" style={{ color: t.hex }} />
              </span>
              <span className="min-w-0">
                <span className="tabular block text-[17px] font-semibold leading-5 text-[color:var(--ink)]">{fmtNumber(t.value)}</span>
                <span className="block truncate text-[11px] font-medium text-[color:var(--ink-faint)]">{t.label}</span>
              </span>
            </div>
          ))}
        </div>

        {/* performance */}
        <PanelSection icon={Gauge} title="Performance">
          <div className="glass-subtle rounded-2xl border-white/55 p-3.5">
            <div className="flex items-center gap-4">
              <ApprovalRing value={approvalPct} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-[color:var(--ink)]">Approval rate</div>
                <p className="mt-0.5 text-xs leading-snug text-[color:var(--ink-faint)]">
                  {detail.stats.approved} approved of {detail.stats.submissions} submission{detail.stats.submissions === 1 ? "" : "s"}
                  {detail.stats.pendingReview > 0 ? ` · ${detail.stats.pendingReview} awaiting review` : ""}
                </p>
              </div>
            </div>
            {detail.statusBreakdown.length > 0 && (
              <div className="mt-3 space-y-1.5 border-t border-[rgba(125,177,216,0.25)] pt-3">
                {detail.statusBreakdown.map((b) => (
                  <div key={b.status} className="flex items-center gap-2">
                    <span className="w-[110px] shrink-0 truncate text-[11px] font-medium text-[color:var(--ink-soft)]">
                      {STATUS_SHORT[b.status] ?? b.status.replaceAll("_", " ")}
                    </span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[rgba(102,119,141,0.14)]">
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${(b.count / maxBreak) * 100}%`, background: STATUS_TONE[b.status] ?? "#8595ab" }}
                      />
                    </span>
                    <span className="tabular w-5 shrink-0 text-right text-[11px] font-semibold text-[color:var(--ink)]">{b.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </PanelSection>

        {/* work details — recent submissions */}
        <PanelSection
          icon={FileText}
          title="Work details"
          action={
            detail.stats.submissions > 0 ? (
              <span className="text-[11px] font-medium text-[color:var(--ink-faint)]">latest {detail.recentSubmissions.length}</span>
            ) : undefined
          }
        >
          {detail.recentSubmissions.length === 0 ? (
            <div className="glass-subtle rounded-2xl border-white/55 px-3.5 py-4 text-center text-xs text-[color:var(--ink-faint)]">
              No submissions recorded for this node yet.
            </div>
          ) : (
            <div className="space-y-2">
              {detail.recentSubmissions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => openDetail("submissions", s.id)}
                  className="group flex w-full items-center gap-2.5 rounded-2xl border border-white/60 bg-white/50 px-3 py-2 text-left transition-all hover:-translate-y-px hover:bg-white/80"
                  aria-label={`Open submission ${s.ref}`}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: STATUS_TONE[s.status] ?? "#8595ab" }} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-semibold text-[color:var(--ink)] group-hover:text-[color:var(--esg-blue)]">{s.title}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-[color:var(--ink-faint)]">
                      <span className="font-mono">{s.ref}</span>·<span>{s.category.toLowerCase()}</span>·
                      <span>
                        {fmtNumber(s.metricValue, 1)} {s.metricUnit}
                      </span>
                      {s.submittedByName && (
                        <>
                          ·<span>by {s.submittedByName}</span>
                        </>
                      )}
                    </span>
                  </span>
                  {s.overdue && <Chip tone="red">Overdue</Chip>}
                  <StatusBadge status={s.status} />
                </button>
              ))}
            </div>
          )}
        </PanelSection>

        {/* team */}
        <PanelSection icon={Users} title="Team">
          {detail.team.length === 0 ? (
            <div className="glass-subtle rounded-2xl border-white/55 px-3.5 py-4 text-center text-xs text-[color:var(--ink-faint)]">
              No users assigned to this node.
            </div>
          ) : (
            <div className="space-y-1.5">
              {detail.team.map((u) => (
                <button
                  key={u.id}
                  onClick={() => openDetail("users", u.id)}
                  className="group flex w-full items-center gap-2.5 rounded-2xl px-2 py-1.5 text-left transition-colors hover:bg-white/65"
                  aria-label={`Open user profile ${u.name}`}
                >
                  <Avatar name={u.name} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-semibold text-[color:var(--ink)] group-hover:text-[color:var(--esg-blue)]">{u.name}</span>
                    <span className="block truncate text-[11px] text-[color:var(--ink-faint)]">{u.title || (ROLE_LABELS[u.role] ?? u.role.replaceAll("_", " "))}</span>
                  </span>
                  <StatusBadge status={u.status} />
                </button>
              ))}
            </div>
          )}
        </PanelSection>

        {/* structure — drill down */}
        {detail.children.length > 0 && (
          <PanelSection icon={Network} title="Structure">
            <div className="space-y-2">
              {detail.children.map((c) => {
                const cConf = TYPE_CONF[c.type];
                return (
                  <button
                    key={c.id}
                    onClick={() => onSelect(c.id)}
                    className="group flex w-full items-center gap-2.5 rounded-2xl border border-white/60 bg-white/50 px-3 py-2 text-left transition-all hover:-translate-y-px hover:bg-white/80"
                    aria-label={`Inspect ${c.name}`}
                  >
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${cConf.tile}`} aria-hidden="true">
                      <cConf.icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-semibold text-[color:var(--ink)] group-hover:text-[color:var(--esg-blue)]">{c.name}</span>
                      <span className="block truncate text-[11px] text-[color:var(--ink-faint)]">{c.meta}</span>
                    </span>
                    <span className="tabular shrink-0 rounded-full bg-[rgba(58,123,255,0.10)] px-2 py-0.5 text-[10.5px] font-semibold text-[#1d5fd6]">{c.submissions} subs</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[color:var(--ink-faint)]" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </PanelSection>
        )}

        {/* profile info */}
        <PanelSection icon={Info} title="Details">
          <div className="glass-subtle divide-y divide-[rgba(125,177,216,0.22)] rounded-2xl border-white/55 px-3.5">
            {detail.profile.map((row) => (
              <div key={row.label} className="flex items-start justify-between gap-3 py-2">
                <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--ink-faint)]">{row.label}</span>
                <span className="min-w-0 text-right text-[12.5px] font-medium text-[color:var(--ink-soft)]">{row.value}</span>
              </div>
            ))}
            {detail.manager && (
              <div className="flex items-start justify-between gap-3 py-2">
                <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--ink-faint)]">Manager</span>
                <span className="min-w-0 text-right text-[12.5px] font-medium text-[color:var(--ink-soft)]">{detail.manager}</span>
              </div>
            )}
          </div>
        </PanelSection>
      </div>
    </div>
  );
}

/* ────────────────────────────── View ────────────────────────────── */

export default function HierarchyView() {
  const { data, loading, error, refetch } = useApi<{ nodes: HierarchyNode[] }>("/api/esg/hierarchy");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const nodes = data?.nodes ?? [];
  const searchActive = search.trim().length > 0 || statusFilter !== "ALL";

  const detailReq = useApi<{ detail: HierarchyNodeDetail }>(
    selectedId ? `/api/esg/hierarchy?nodeId=${selectedId}` : null,
    [selectedId]
  );

  const filtered = useMemo(
    () => filterTree(nodes, search.trim().toLowerCase(), statusFilter),
    [nodes, search, statusFilter]
  );

  const counts = useMemo(() => countTree(nodes), [nodes]);

  const filters: ToolbarFilter[] = [
    {
      key: "status",
      label: "Status",
      value: statusFilter,
      onChange: setStatusFilter,
      options: [
        { value: "ALL", label: "All statuses" },
        { value: "ACTIVE", label: "Active" },
        { value: "INACTIVE", label: "Inactive" },
      ],
    },
  ];

  const onToggle = (id: string, next: boolean) => {
    setOpenMap((m) => ({ ...m, [id]: next }));
  };

  /** Select a node and make sure its ancestors are expanded in the tree. */
  const selectNode = (id: string) => {
    const path = ancestorsOf(nodes, id);
    if (path) {
      setOpenMap((m) => {
        const next = { ...m };
        for (const anc of path) next[anc.id] = true;
        return next;
      });
    }
    setSelectedId(id);
  };

  const branchCtx: BranchCtx = {
    openMap,
    searchActive,
    selectedId,
    onToggle,
    onSelect: (node) => setSelectedId((cur) => (cur === node.id ? null : node.id)),
  };

  const panel = (floating: boolean) => (
    <NodePanel
      detail={detailReq.data?.detail ?? null}
      loading={detailReq.loading}
      error={detailReq.error}
      retry={() => detailReq.refetch()}
      floating={floating}
      onClose={() => setSelectedId(null)}
      onSelect={selectNode}
    />
  );

  return (
    <div className="view-in space-y-5">
      <PageHeader
        title="Organization Hierarchy"
        description="Group → Subsidiary → Business Unit → Project / Site — click any node to inspect performance, submissions, and team."
        icon={FolderTree}
        breadcrumbs={["Group", "Organization", "Hierarchy"]}
      />

      <Toolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search name or code…"
        filters={filters}
        onReset={() => {
          setSearch("");
          setStatusFilter("ALL");
        }}
        resultCount={filtered.length}
        right={
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setOpenMap({})}
              className="glass-subtle inline-flex h-9 items-center gap-1.5 rounded-2xl border-white/60 px-3 text-xs font-medium text-[color:var(--ink-soft)] transition-colors hover:bg-white/70"
            >
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" /> Expand all
            </button>
            <button
              onClick={() => setOpenMap(Object.fromEntries(allIds(nodes).map((id) => [id, false])))}
              className="glass-subtle inline-flex h-9 items-center gap-1.5 rounded-2xl border-white/60 px-3 text-xs font-medium text-[color:var(--ink-soft)] transition-colors hover:bg-white/70"
            >
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /> Collapse all
            </button>
          </div>
        }
      />

      {error && !data ? (
        <GlassCard className="p-0"><ErrorState message={error} onRetry={refetch} /></GlassCard>
      ) : loading && !data ? (
        <GlassCard><LoadingBlock rows={6} label="Building hierarchy…" /></GlassCard>
      ) : filtered.length === 0 ? (
        <GlassCard>
          <EmptyState
            title="No matching nodes"
            message="No subsidiary, business unit, or project matches the current search and status filters."
            icon={ListTree}
          />
        </GlassCard>
      ) : (
        <div className={selectedId ? "grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px]" : "grid grid-cols-1 items-start"}>
          {/* ── tree ── */}
          <div role="tree" aria-label="Organization hierarchy" className="min-w-0">
            <RootCard counts={counts} />

            {/* connector: stub → rail → columns (desktop) */}
            <div aria-hidden className={`mx-auto hidden h-7 w-px md:block ${LINE}`} />
            <div className="nice-scroll hidden overflow-x-auto pb-1 md:block">
              <div
                className="relative grid"
                style={{ gridTemplateColumns: `repeat(${filtered.length}, minmax(290px, 1fr))` }}
              >
                <span
                  aria-hidden
                  className={`absolute top-0 h-px ${LINE}`}
                  style={{ left: `${100 / (2 * filtered.length)}%`, right: `${100 / (2 * filtered.length)}%` }}
                />
                {filtered.map((s) => (
                  <div key={s.id} className="relative px-2.5 pt-7">
                    <span aria-hidden className={`absolute left-1/2 top-0 h-7 w-px -translate-x-1/2 ${LINE}`} />
                    <TreeBranch nodes={[s]} depth={0} ctx={branchCtx} connectors={false} />
                  </div>
                ))}
              </div>
            </div>

            {/* stacked tree (mobile) */}
            <div className="mt-4 md:hidden">
              <TreeBranch nodes={filtered} depth={0} ctx={branchCtx} connectors={false} />
            </div>

            {/* legend */}
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-2xl border border-white/50 bg-white/40 px-4 py-2.5 backdrop-blur-md">
              {(Object.keys(TYPE_CONF) as NodeType[]).map((t) => (
                <span key={t} className="flex items-center gap-1.5 text-[11px] font-medium text-[color:var(--ink-soft)]">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: TYPE_CONF[t].hex }} aria-hidden="true" />
                  {TYPE_CONF[t].label}
                </span>
              ))}
              <span className="ml-auto hidden text-[11px] text-[color:var(--ink-faint)] lg:inline">
                Click any card to open its detail panel · chevron expands a branch
              </span>
            </div>
          </div>

          {/* ── detail panel: inline on xl ── */}
          <AnimatePresence>
            {selectedId && (
              <motion.div
                key="panel-inline"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="hidden xl:sticky xl:top-24 xl:block xl:h-[calc(100vh-140px)]"
              >
                <GlassCard strong className="h-full overflow-hidden rounded-[24px]">
                  {panel(false)}
                </GlassCard>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── detail panel: floating drawer below xl ── */}
      <AnimatePresence>
        {selectedId && (
          <>
            <motion.div
              key="panel-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSelectedId(null)}
              className="fixed inset-0 z-40 bg-[rgba(23,38,61,0.35)] backdrop-blur-sm xl:hidden"
              aria-hidden="true"
            />
            <motion.aside
              key="panel-drawer"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="fixed inset-y-2 right-2 z-50 w-[calc(100vw-16px)] max-w-md xl:hidden"
              role="dialog"
              aria-label="Node detail panel"
            >
              <GlassCard strong className="h-full overflow-hidden rounded-[24px]">
                {panel(true)}
              </GlassCard>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/** All expandable node ids (subsidiaries + units) for collapse-all. */
function allIds(nodes: HierarchyNode[]): string[] {
  const out: string[] = [];
  const walk = (list: HierarchyNode[]) => {
    for (const n of list) {
      if ((n.children?.length ?? 0) > 0) {
        out.push(n.id);
        walk(n.children!);
      }
    }
  };
  walk(nodes);
  return out;
}
