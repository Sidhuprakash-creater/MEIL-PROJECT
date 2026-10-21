"use client";

// ── SCREEN 03 — Organization Hierarchy (movable node canvas + branch colors + favicons + view panel) ──
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlarmClock,
  ArrowUpRight,
  BadgeCheck,
  Building2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Droplets,
  Factory,
  FileText,
  FolderTree,
  Gauge,
  Hand,
  Hourglass,
  Info,
  Landmark,
  Layers,
  ListTree,
  Maximize2,
  Minus,
  Network,
  Plus,
  Route,
  Sun,
  Users,
  Waves,
  Wind,
  X,
} from "lucide-react";
import { useWorkspace } from "@/lib/esg/store";
import { useApi, fmtNumber } from "@/lib/esg/client";
import {
  ROLE_LABELS,
  type HierarchyNode,
  type HierarchyNodeDetail,
  type HierarchySummary,
} from "@/lib/esg/types";
import {
  Avatar,
  Chip,
  CountUp,
  EmptyState,
  ErrorState,
  GlassCard,
  LoadingBlock,
  PageHeader,
  StatusBadge,
  Toolbar,
  type ToolbarFilter,
} from "@/components/workspace/ui";

/* ────────────────────────────── Color & icon systems ────────────────────────────── */

type NodeType = HierarchyNode["type"];

/** Type config for the detail panel (kept type-based there for consistency with module pages). */
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

/** Per-branch hues — every top-level subsidiary owns a color that flows through its whole subtree. */
const BRANCH_HUES = ["#6a5bff", "#3a7bff", "#16a3a3", "#c57926", "#b3568d", "#238653"];
const hueFor = (i: number) => BRANCH_HUES[i % BRANCH_HUES.length]!;

/** Project "favicon" icon by site kind. */
const KIND_ICON: Record<string, typeof Landmark> = {
  PLANT: Factory,
  SOLAR_PARK: Sun,
  WIND_FARM: Wind,
  HYDRO: Droplets,
  PIPELINE: Waves,
  SITE: Route,
  OFFICE: Building2,
};
const KIND_LABEL: Record<string, string> = {
  PLANT: "Plant",
  SOLAR_PARK: "Solar park",
  WIND_FARM: "Wind farm",
  HYDRO: "Hydro",
  PIPELINE: "Pipeline",
  SITE: "Site",
  OFFICE: "Office",
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

const ORG_DOT: Record<string, string> = { ACTIVE: "#238653", INACTIVE: "#8595ab" };

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

function countAllNodes(nodes: HierarchyNode[]): number {
  let n = 0;
  const walk = (list: HierarchyNode[]) => {
    for (const x of list) {
      n += 1;
      if (x.children) walk(x.children);
    }
  };
  walk(nodes);
  return n;
}

/** Stable hue per node id — keyed off each subsidiary's position in the full (unfiltered) tree. */
function buildHueMap(nodes: HierarchyNode[]): Record<string, string> {
  const map: Record<string, string> = {};
  nodes.forEach((s, i) => {
    const hue = hueFor(i);
    const walk = (n: HierarchyNode) => {
      map[n.id] = hue;
      n.children?.forEach(walk);
    };
    walk(s);
  });
  return map;
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

/* ────────────────────────────── Favicon (node icon badge) ────────────────────────────── */

function NodeFavicon({ icon: Icon, hue, size = 36, status }: { icon: typeof Landmark; hue: string; size?: number; status?: string }) {
  const dotColor = status ? (ORG_DOT[status] ?? "#c57926") : null;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} aria-hidden="true">
      <span
        className="flex h-full w-full items-center justify-center rounded-[30%] border border-white/70 text-white"
        style={{
          background: `linear-gradient(150deg, ${hue} 18%, color-mix(in srgb, ${hue} 70%, #17263D) 100%)`,
          boxShadow: `0 3px 9px ${hue}44, inset 0 1px 0 rgba(255,255,255,0.45)`,
        }}
      >
        <Icon style={{ width: size * 0.46, height: size * 0.46 }} />
      </span>
      {dotColor && (
        <span
          className="absolute -bottom-0.5 -right-0.5 h-[10px] w-[10px] rounded-full border-2 border-white"
          style={{ background: dotColor }}
          title={status}
        />
      )}
    </span>
  );
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

/** Card for a subsidiary / business-unit node — favicon + colored eyebrow title + branch rail. */
function OrgCard({
  node,
  hue,
  depth,
  open,
  selected,
  onToggle,
  onSelect,
}: {
  node: HierarchyNode;
  hue: string;
  depth: number;
  open: boolean;
  selected: boolean;
  onToggle: () => void;
  onSelect: () => void;
}) {
  const kids = node.children ?? [];
  const isSub = node.type === "subsidiary";
  const Icon = isSub ? Landmark : Layers;
  const eyebrow = isSub ? "Subsidiary" : "Business Unit";

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
      aria-label={`${eyebrow}: ${node.name} — open detail panel`}
      className={`group relative w-full cursor-pointer overflow-hidden border text-left shadow-[0_2px_10px_rgba(23,38,61,0.05)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-px hover:shadow-[0_8px_24px_rgba(23,38,61,0.10)] ${
        selected ? "border-[rgba(58,123,255,0.55)] bg-white/90 ring-2 ring-[rgba(58,123,255,0.35)]" : "border-white/70 bg-white/65 hover:bg-white/85"
      } ${isSub ? "min-h-[96px] rounded-3xl p-3.5" : "min-h-[66px] rounded-2xl p-3"}`}
    >
      {/* branch-hue accent rail */}
      <span
        aria-hidden
        className="absolute inset-y-2 left-0 w-[3px] rounded-r-full"
        style={{ background: `linear-gradient(180deg, ${hue}, ${hue}44)` }}
      />

      <div className="relative flex items-start gap-2.5 pl-2">
        <NodeFavicon icon={Icon} hue={hue} size={isSub ? 40 : 34} status={node.status} />
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className="min-w-0">
              <span
                className={`block truncate text-[9.5px] font-bold uppercase tracking-[0.14em] ${isSub ? "text-[11px] tracking-[0.16em]" : ""}`}
                style={{ color: hue }}
              >
                {eyebrow}
              </span>
              <span className={`block truncate font-semibold leading-5 text-[color:var(--ink)] ${isSub ? "text-[14px]" : "text-[13px]"}`}>
                {node.name}
              </span>
            </span>
            {kids.length > 0 && <ExpandButton open={open} count={kids.length} onClick={onToggle} name={node.name} />}
          </span>
          <span className="mt-1 flex items-center gap-1.5">
            <span className="rounded-md bg-[rgba(102,119,141,0.10)] px-1.5 py-px font-mono text-[10px] font-medium tracking-wide text-[color:var(--ink-faint)]">
              {node.code}
            </span>
            {node.manager && (
              <span className="hidden truncate text-[11px] text-[color:var(--ink-faint)] md:inline">Mgr · {node.manager}</span>
            )}
          </span>
        </span>
      </div>
      {isSub && node.meta && <div className="relative mt-1.5 truncate pl-[54px] text-[11.5px] text-[color:var(--ink-faint)]">{node.meta}</div>}
      <div className="relative mt-2 flex flex-wrap items-center gap-1.5">
        {node.stats && (
          <>
            <Chip tone="blue">
              <Users className="h-3 w-3" aria-hidden="true" />
              {node.stats.users}
            </Chip>
            {isSub && (
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

/** Leaf row for a project node — kind favicon + titled eyebrow + status dot on the favicon. */
function ProjectCard({
  node,
  hue,
  selected,
  onSelect,
}: {
  node: HierarchyNode;
  hue: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = KIND_ICON[node.kind ?? ""] ?? Building2;
  const kindLabel = KIND_LABEL[node.kind ?? ""] ?? "Project";
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
      className={`group flex min-h-[48px] cursor-pointer items-center gap-2.5 rounded-2xl border px-2.5 py-2 backdrop-blur-xl transition-all duration-200 hover:-translate-y-px ${
        selected ? "border-[rgba(58,123,255,0.55)] bg-white/90 ring-2 ring-[rgba(58,123,255,0.35)]" : "border-white/70 bg-white/55 hover:bg-white/85"
      }`}
    >
      <NodeFavicon icon={Icon} hue={hue} size={28} status={node.status} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[9px] font-bold uppercase tracking-[0.1em]" style={{ color: hue }}>
          Project · {kindLabel}
        </span>
        <span className="block truncate text-[13px] font-semibold leading-5 text-[color:var(--ink)]">{node.name}</span>
        <span className="block truncate text-[10.5px] capitalize text-[color:var(--ink-faint)]">{node.meta}</span>
      </span>
      {node.stats && node.stats.submissions > 0 && (
        <span className="tabular shrink-0 rounded-full bg-[rgba(22,163,163,0.10)] px-1.5 py-0.5 text-[10px] font-semibold text-[#0f7c7c]">
          {node.stats.submissions} subs
        </span>
      )}
    </div>
  );
}

/* ────────────────────────────── Recursive branch ────────────────────────────── */

interface BranchCtx {
  openMap: Record<string, boolean>;
  searchActive: boolean;
  selectedId: string | null;
  hueMap: Record<string, string>;
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
        const hue = ctx.hueMap[node.id] ?? "#3a7bff";
        return (
          <div key={node.id} className={connectors ? "relative pl-10 pt-3" : "relative pt-3 first:pt-0"}>
            {/* spine segments + elbow connector, tinted by branch hue */}
            {connectors && (
              <>
                <span aria-hidden className={`absolute left-[18px] top-0 w-px ${isLast ? "h-[46px]" : "h-full"}`} style={{ background: hue, opacity: 0.32 }} />
                <span aria-hidden className="absolute left-[18px] top-[46px] h-px w-[22px]" style={{ background: hue, opacity: 0.32 }} />
                <span
                  aria-hidden
                  className="absolute left-[14.5px] top-[42.5px] h-[7px] w-[7px] rounded-full border-2 border-white shadow-sm"
                  style={{ background: hue, opacity: 0.8 }}
                />
              </>
            )}

            {!isProject && (
              <OrgCard
                node={node}
                hue={hue}
                depth={depth}
                open={isOpen}
                selected={selected}
                onToggle={() => ctx.onToggle(node.id, !isOpen)}
                onSelect={() => ctx.onSelect(node)}
              />
            )}
            {isProject && <ProjectCard node={node} hue={hue} selected={selected} onSelect={() => ctx.onSelect(node)} />}

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

/* ────────────────────────────── Root group hero card ────────────────────────────── */

function GroupHero({ summary }: { summary: HierarchySummary }) {
  const { navigate } = useWorkspace();
  const tiles: { label: string; value: number; icon: typeof Landmark; hex: string; go: () => void }[] = [
    { label: "Subsidiaries", value: summary.subsidiaries, icon: Landmark, hex: "#6a5bff", go: () => navigate("subsidiaries") },
    { label: "Business Units", value: summary.units, icon: Layers, hex: "#3a7bff", go: () => navigate("units") },
    { label: "Projects & Sites", value: summary.projects, icon: Building2, hex: "#16a3a3", go: () => navigate("projects") },
    { label: "People", value: summary.users, icon: Users, hex: "#238653", go: () => navigate("users") },
  ];
  return (
    <GlassCard strong className="mx-auto w-full max-w-3xl overflow-hidden rounded-[26px] p-0">
      {/* identity band */}
      <div className="relative overflow-hidden border-b border-white/60 bg-gradient-to-br from-[rgba(58,123,255,0.16)] via-white/20 to-[rgba(106,91,255,0.16)] p-5">
        <div aria-hidden className="pointer-events-none absolute -right-14 -top-16 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(106,91,255,0.28),transparent_65%)] blur-xl" />
        <div aria-hidden className="pointer-events-none absolute -left-10 bottom-[-70px] h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(22,163,163,0.22),transparent_65%)] blur-xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <NodeFavicon icon={Landmark} hue="#3a7bff" size={54} status="ACTIVE" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--ink-faint)]">Group Headquarters</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(35,134,83,0.35)] bg-[rgba(35,134,83,0.10)] px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-[#1d6b44]">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#238653] opacity-60" aria-hidden="true" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#238653]" aria-hidden="true" />
                  </span>
                  Live
                </span>
              </div>
              <h2 className="text-[19px] font-semibold tracking-tight text-[color:var(--ink)]">MEIL Group</h2>
              <p className="mt-0.5 truncate text-xs text-[color:var(--ink-faint)]">
                {summary.subsidiaries} subsidiaries · {summary.units} business units · {summary.projects} projects &amp; sites ·{" "}
                {fmtNumber(summary.submissions)} ESG submissions tracked
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex flex-col items-center">
              <ApprovalRing value={summary.approvalRate} size={72} stroke={8} />
              <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--ink-faint)]">Approval health</span>
            </div>
            <div className="flex flex-col gap-2">
              {summary.overdue > 0 ? (
                <button
                  onClick={() => navigate("submissions", { statusFilter: "OVERDUE" })}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(195,74,74,0.35)] bg-[rgba(195,74,74,0.10)] px-2.5 py-1 text-[11px] font-semibold text-[#a53b3b] transition-colors hover:bg-[rgba(195,74,74,0.18)]"
                  aria-label={`${summary.overdue} overdue submissions — open register`}
                >
                  <AlarmClock className="h-3.5 w-3.5" aria-hidden="true" />
                  {summary.overdue} overdue
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(35,134,83,0.35)] bg-[rgba(35,134,83,0.10)] px-2.5 py-1 text-[11px] font-semibold text-[#1d6b44]">
                  <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  On track
                </span>
              )}
              <button
                onClick={() => navigate("dashboard")}
                className="glass inline-flex h-8 items-center justify-center gap-1 rounded-full border-white/60 px-3 text-[11.5px] font-semibold text-[#1d5fd6] transition-colors hover:bg-white/85"
              >
                Command Center
                <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* entity quick-stats */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-b-[25px] border-t-0 bg-[rgba(125,177,216,0.28)] md:grid-cols-4">
        {tiles.map((s) => (
          <button
            key={s.label}
            onClick={s.go}
            className="group flex flex-col items-start gap-0.5 bg-white/55 px-3.5 py-2.5 text-left backdrop-blur-sm transition-colors hover:bg-white/90"
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

/* ────────────────────────────── Status cards (Submissions / Approved / Pending / Overdue) ────────────────────────────── */

function StatusCard({
  icon: Icon,
  hue,
  label,
  hint,
  value,
  total,
  onClick,
}: {
  icon: typeof Landmark;
  hue: string;
  label: string;
  hint: string;
  value: number;
  total: number;
  onClick: () => void;
}) {
  const isTotal = label === "Submissions";
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  return (
    <button
      onClick={onClick}
      aria-label={`${label}: ${value} — open module`}
      className="glass group relative overflow-hidden rounded-[22px] border-white/60 p-4 text-left shadow-[0_2px_10px_rgba(23,38,61,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/85 hover:shadow-[0_10px_30px_rgba(23,38,61,0.12)]"
    >
      <span aria-hidden className="absolute inset-x-0 top-0 h-[3px]" style={{ background: `linear-gradient(90deg, ${hue}, ${hue}22)` }} />
      <div className="flex items-start justify-between gap-2">
        <NodeFavicon icon={Icon} hue={hue} size={36} />
        <ArrowUpRight
          className="h-4 w-4 text-[color:var(--ink-faint)] opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100"
          aria-hidden="true"
        />
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <CountUp value={value} className="tabular text-[26px] font-semibold leading-7 text-[color:var(--ink)]" />
      </div>
      <div className="text-[12.5px] font-semibold" style={{ color: hue }}>
        {label}
      </div>
      <div className="mt-0.5 text-[11px] leading-snug text-[color:var(--ink-faint)]">{hint}</div>
      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-[rgba(102,119,141,0.14)]">
        <span className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${isTotal ? 100 : pct}%`, background: hue }} />
      </div>
      <div className="mt-1 text-[10px] font-medium text-[color:var(--ink-faint)]">
        {isTotal ? "Group-wide total" : `${Math.round(pct)}% of all submissions`}
      </div>
    </button>
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

const clampPan = (x: number, y: number) => ({ x: Math.max(-700, Math.min(700, x)), y: Math.max(-450, Math.min(450, y)) });
const clampZoom = (z: number) => Math.max(0.6, Math.min(1.5, z));

export default function HierarchyView() {
  const { navigate } = useWorkspace();
  const { data, loading, error, refetch } = useApi<{ nodes: HierarchyNode[]; summary: HierarchySummary }>("/api/esg/hierarchy");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /* movable canvas state */
  const viewportRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const dragInfo = useRef<{ sx: number; sy: number; bx: number; by: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  const nodes = data?.nodes ?? [];
  const summary = data?.summary;
  const searchActive = search.trim().length > 0 || statusFilter !== "ALL";

  const detailReq = useApi<{ detail: HierarchyNodeDetail }>(
    selectedId ? `/api/esg/hierarchy?nodeId=${selectedId}` : null,
    [selectedId]
  );

  const filtered = useMemo(
    () => filterTree(nodes, search.trim().toLowerCase(), statusFilter),
    [nodes, search, statusFilter]
  );

  const hueMap = useMemo(() => buildHueMap(nodes), [nodes]);

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
    hueMap,
    onToggle,
    onSelect: (node) => setSelectedId((cur) => (cur === node.id ? null : node.id)),
  };

  /* ── pan: pointer drag with click suppression (drag anywhere, click still lands on nodes) ── */
  const startPan = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    dragInfo.current = { sx: e.clientX, sy: e.clientY, bx: pan.x, by: pan.y, moved: false };
    suppressClick.current = false;
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => {
      const d = dragInfo.current;
      if (!d) return;
      const dx = e.clientX - d.sx;
      const dy = e.clientY - d.sy;
      if (!d.moved && Math.hypot(dx, dy) > 5) d.moved = true;
      if (d.moved) setPan(clampPan(d.bx + dx, d.by + dy));
    };
    const up = () => {
      suppressClick.current = dragInfo.current?.moved ?? false;
      dragInfo.current = null;
      setDragging(false);
      if (suppressClick.current) {
        window.setTimeout(() => {
          suppressClick.current = false;
        }, 120);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [dragging]);

  /* ── zoom: ⌘/Ctrl + wheel (native non-passive listener) + on-canvas controls ── */
  const canvasReady = !!data && filtered.length > 0;
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || !canvasReady) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      setZoom((z) => clampZoom(z - Math.sign(e.deltaY) * 0.08));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [canvasReady]);

  const zoomBy = (d: number) => setZoom((z) => clampZoom(+(z + d).toFixed(2)));
  const resetView = () => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
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

  const statusCards: { key: string; icon: typeof Landmark; hue: string; label: string; hint: string; value: number; go: () => void }[] = summary
    ? [
        { key: "submissions", icon: FileText, hue: "#3a7bff", label: "Submissions", hint: "All ESG filings across the group", value: summary.submissions, go: () => navigate("submissions") },
        { key: "approved", icon: BadgeCheck, hue: "#238653", label: "Approved", hint: "Eligible for BRSR consolidation", value: summary.approved, go: () => navigate("submissions", { statusFilter: "APPROVED" }) },
        { key: "pending", icon: Hourglass, hue: "#6a5bff", label: "Pending review", hint: "Awaiting a review decision", value: summary.pendingReview, go: () => navigate("approvals") },
        { key: "overdue", icon: AlarmClock, hue: "#c34a4a", label: "Overdue", hint: "Past due date — needs escalation", value: summary.overdue, go: () => navigate("submissions", { statusFilter: "OVERDUE" }) },
      ]
    : [];

  return (
    <div className="view-in space-y-5">
      <PageHeader
        title="Organization Hierarchy"
        description="Group → Subsidiary → Business Unit → Project / Site. Drag the canvas to move it, ⌘/Ctrl + scroll to zoom, and click any node to inspect performance, submissions, and team."
        icon={FolderTree}
        breadcrumbs={["Group", "Organization", "Hierarchy"]}
      />

      {/* ── status cards: Submissions / Approved / Pending / Overdue ── */}
      {statusCards.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">
            <Gauge className="h-3.5 w-3.5 text-[color:var(--esg-blue)]" aria-hidden="true" />
            Submission status — group-wide
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {statusCards.map((c) => (
              <StatusCard
                key={c.key}
                icon={c.icon}
                hue={c.hue}
                label={c.label}
                hint={c.hint}
                value={c.value}
                total={summary?.submissions ?? 0}
                onClick={c.go}
              />
            ))}
          </div>
        </div>
      )}

      <Toolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search name or code…"
        filters={filters}
        onReset={() => {
          setSearch("");
          setStatusFilter("ALL");
        }}
        resultCount={countAllNodes(filtered)}
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
            {/* ── movable canvas (md+): drag to pan, ⌘/Ctrl + scroll to zoom ── */}
            <div
              ref={viewportRef}
              onPointerDown={startPan}
              onClickCapture={(e) => {
                if (suppressClick.current) {
                  e.stopPropagation();
                  e.preventDefault();
                }
              }}
              className={`relative hidden select-none overflow-hidden rounded-[26px] border border-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_8px_30px_rgba(23,38,61,0.06)] backdrop-blur-xl md:block ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
              style={{ touchAction: "pan-y" }}
            >
              <div
                className="origin-top relative p-5"
                style={{
                  transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
                  transition: dragging ? "none" : "transform 240ms cubic-bezier(0.22,1,0.36,1)",
                  willChange: "transform",
                  backgroundImage: "radial-gradient(rgba(58,123,255,0.10) 1.2px, transparent 1.2px)",
                  backgroundSize: "26px 26px",
                }}
              >
                {summary && <GroupHero summary={summary} />}

                {/* connector: root → rail → columns */}
                <div aria-hidden className={`mx-auto h-7 w-px ${LINE}`} />
                <div className="relative grid" style={{ gridTemplateColumns: `repeat(${filtered.length}, minmax(290px, 1fr))` }}>
                  <span
                    aria-hidden
                    className={`absolute top-0 h-px ${LINE}`}
                    style={{ left: `${100 / (2 * filtered.length)}%`, right: `${100 / (2 * filtered.length)}%` }}
                  />
                  {filtered.map((s) => {
                    const hue = hueMap[s.id] ?? "#3a7bff";
                    return (
                      <div key={s.id} className="relative px-2.5 pt-7">
                        <span aria-hidden className="absolute left-1/2 top-0 h-7 w-px -translate-x-1/2" style={{ background: hue, opacity: 0.45 }} />
                        <span
                          aria-hidden
                          className="absolute left-1/2 top-0 h-[7px] w-[7px] -translate-x-1/2 -translate-y-[3px] rounded-full border-2 border-white shadow-sm"
                          style={{ background: hue, opacity: 0.85 }}
                        />
                        <TreeBranch nodes={[s]} depth={0} ctx={branchCtx} connectors={false} />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* canvas overlays — hint + zoom controls */}
              <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex items-center gap-1.5 rounded-full border border-white/60 bg-white/75 px-2.5 py-1 text-[10.5px] font-medium text-[color:var(--ink-soft)] shadow-sm backdrop-blur-md">
                <Hand className="h-3 w-3" aria-hidden="true" />
                Drag to move
                <span className="text-[color:var(--ink-faint)]" aria-hidden="true">·</span>
                Ctrl / ⌘ + scroll to zoom
              </div>
              <div
                className="absolute bottom-3 right-3 z-10 flex items-center gap-0.5 rounded-full border border-white/60 bg-white/80 p-1 shadow-sm backdrop-blur-md"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => zoomBy(-0.1)}
                  disabled={zoom <= 0.61}
                  aria-label="Zoom out"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[color:var(--ink-soft)] transition-colors hover:bg-white/90 disabled:opacity-40"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="tabular w-9 text-center text-[10.5px] font-semibold text-[color:var(--ink-soft)]">{Math.round(zoom * 100)}%</span>
                <button
                  onClick={() => zoomBy(0.1)}
                  disabled={zoom >= 1.49}
                  aria-label="Zoom in"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[color:var(--ink-soft)] transition-colors hover:bg-white/90 disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <span aria-hidden className="mx-0.5 h-4 w-px bg-[rgba(102,119,141,0.2)]" />
                <button
                  onClick={resetView}
                  aria-label="Reset canvas view"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[color:var(--ink-soft)] transition-colors hover:bg-white/90"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* ── stacked tree (mobile) ── */}
            <div className="mt-1 md:hidden">
              {summary && <GroupHero summary={summary} />}
              <div className="mt-4">
                <TreeBranch nodes={filtered} depth={0} ctx={branchCtx} connectors={true} />
              </div>
            </div>

            {/* legend — branch color key */}
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-2xl border border-white/50 bg-white/40 px-4 py-2.5 backdrop-blur-md">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">Branches</span>
              {filtered.map((s) => (
                <span key={s.id} className="flex items-center gap-1.5 text-[11px] font-medium text-[color:var(--ink-soft)]">
                  <span className="h-2.5 w-2.5 rounded-[30%]" style={{ background: hueMap[s.id] ?? "#3a7bff" }} aria-hidden="true" />
                  {s.name}
                </span>
              ))}
              <span className="ml-auto hidden text-[11px] text-[color:var(--ink-faint)] lg:inline">
                Node color = subsidiary branch · click any card to open its detail panel
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
