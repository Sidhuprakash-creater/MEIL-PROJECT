"use client";

// ── SCREEN 03 — Organization Hierarchy (movable node canvas + 4 diagram designs + branch colors + favicons + view panel) ──
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
  LayoutDashboard,
  ListTree,
  Maximize2,
  Minus,
  MoveHorizontal,
  Network,
  Orbit,
  Plus,
  RotateCcw,
  Route,
  Sun,
  Users,
  Waypoints,
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

/* ────────────────────────────── Diagram design engine ────────────────────────────── */

type DiagramMode = "tree" | "flow" | "radial" | "constellation";

const DIAGRAM_MODES: { id: DiagramMode; label: string; hint: string; icon: typeof ListTree }[] = [
  { id: "tree", label: "Vertical tree", hint: "Classic top-down organization chart", icon: ListTree },
  { id: "flow", label: "Horizontal flow", hint: "Left-to-right cascade diagram", icon: MoveHorizontal },
  { id: "radial", label: "Radial orbit", hint: "Group HQ at the center, branches orbiting", icon: Orbit },
  { id: "constellation", label: "Constellation", hint: "Organic drift layout with flowing curves", icon: Waypoints },
];

/** Flat layout node — the synthetic group root plus every visible org node. */
interface LNode {
  id: string;
  parentId: string | null;
  depth: number; // 0 = root, 1 = subsidiary, 2 = unit, 3 = project
  type: "root" | NodeType;
  hue: string;
  name: string;
  node?: HierarchyNode;
}

type Pos = { x: number; y: number };

const ROOT_ID = "meil-group-root";
const GAP_X = 52;
const GAP_Y = 66;

/** Fixed card metrics per node type — keeps every connector anchored exactly on card edges. */
function dimsOf(n: LNode): { w: number; h: number } {
  if (n.type === "root") return { w: 272, h: 128 };
  if (n.type === "subsidiary") return { w: 252, h: 92 };
  if (n.type === "unit") return { w: 228, h: 64 };
  return { w: 210, h: 52 };
}

/** Deterministic hash for organic jitter + bow direction. */
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Flatten the filtered tree into layout nodes, honoring collapse state. */
function buildLNodes(
  filtered: HierarchyNode[],
  openMap: Record<string, boolean>,
  searchActive: boolean,
  hueMap: Record<string, string>
): LNode[] {
  const out: LNode[] = [{ id: ROOT_ID, parentId: null, depth: 0, type: "root", hue: "#3a7bff", name: "MEIL Group" }];
  const walk = (list: HierarchyNode[], parentId: string, depth: number) => {
    for (const n of list) {
      out.push({ id: n.id, parentId, depth, type: n.type, hue: hueMap[n.id] ?? "#3a7bff", name: n.name, node: n });
      const open = searchActive || (openMap[n.id] ?? true);
      if (open && n.children && n.children.length > 0) walk(n.children, n.id, depth + 1);
    }
  };
  walk(filtered, ROOT_ID, 1);
  return out;
}

/** The four diagram patterns. Positions are top-left card corners in canvas space. */
function layoutDiagram(nodes: LNode[], mode: DiagramMode): Record<string, Pos> {
  const childrenMap = new Map<string, LNode[]>();
  for (const n of nodes) {
    if (!n.parentId) continue;
    const arr = childrenMap.get(n.parentId) ?? [];
    arr.push(n);
    childrenMap.set(n.parentId, arr);
  }
  const kidsOf = (id: string) => childrenMap.get(id) ?? [];
  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const pos: Record<string, Pos> = {};

  if (mode === "tree" || mode === "constellation") {
    const maxH = [128, 92, 64, 52];
    const levelY: number[] = [0];
    for (let d = 1; d < 4; d++) levelY[d] = levelY[d - 1]! + maxH[d - 1]! + GAP_Y;

    const widthOf = (id: string): number => {
      const n = byId.get(id)!;
      const kids = kidsOf(id);
      if (kids.length === 0) return dimsOf(n).w;
      let sum = 0;
      for (const k of kids) sum += widthOf(k.id);
      return Math.max(dimsOf(n).w, sum + GAP_X * (kids.length - 1));
    };

    const place = (id: string, left: number): number => {
      const n = byId.get(id)!;
      const dm = dimsOf(n);
      const kids = kidsOf(id);
      if (kids.length === 0) {
        pos[id] = { x: left, y: levelY[n.depth]! };
        return left + dm.w / 2;
      }
      let cursor = left;
      const centers: number[] = [];
      for (const k of kids) {
        centers.push(place(k.id, cursor));
        cursor += widthOf(k.id) + GAP_X;
      }
      const blockW = cursor - GAP_X - left;
      const cx = left + blockW / 2;
      pos[id] = { x: cx - dm.w / 2, y: levelY[n.depth]! };
      return cx;
    };
    place(ROOT_ID, 0);

    if (mode === "constellation") {
      for (const n of nodes) {
        if (n.id === ROOT_ID) continue;
        const h = hashStr(n.id);
        pos[n.id] = {
          x: pos[n.id]!.x + ((h % 49) - 24),
          y: pos[n.id]!.y + (Math.floor(h / 11) % 29) - 14,
        };
      }
    }

    const minX = Math.min(...nodes.map((n) => pos[n.id]!.x));
    if (minX < 0) for (const n of nodes) pos[n.id] = { ...pos[n.id]!, x: pos[n.id]!.x - minX };
    return pos;
  }

  if (mode === "flow") {
    const maxW = [272, 252, 228, 210];
    const colX: number[] = [0];
    for (let d = 1; d < 4; d++) colX[d] = colX[d - 1]! + maxW[d - 1]! + 84;

    const heightOf = (id: string): number => {
      const n = byId.get(id)!;
      const kids = kidsOf(id);
      if (kids.length === 0) return dimsOf(n).h;
      let sum = 0;
      for (const k of kids) sum += heightOf(k.id);
      return Math.max(dimsOf(n).h, sum + GAP_Y * (kids.length - 1));
    };

    const place = (id: string, top: number): number => {
      const n = byId.get(id)!;
      const dm = dimsOf(n);
      const kids = kidsOf(id);
      if (kids.length === 0) {
        pos[id] = { x: colX[n.depth]!, y: top };
        return top + dm.h / 2;
      }
      let cursor = top;
      const centers: number[] = [];
      for (const k of kids) {
        centers.push(place(k.id, cursor));
        cursor += heightOf(k.id) + GAP_Y;
      }
      const blockH = cursor - GAP_Y - top;
      const cy = top + blockH / 2;
      pos[id] = { x: colX[n.depth]!, y: cy - dm.h / 2 };
      return cy;
    };
    place(ROOT_ID, 0);

    const minY = Math.min(...nodes.map((n) => pos[n.id]!.y));
    if (minY < 0) for (const n of nodes) pos[n.id] = { ...pos[n.id]!, y: pos[n.id]!.y - minY };
    return pos;
  }

  // radial orbit
  const ringR = [0, 320, 590, 840];
  const leafCount = (id: string): number => {
    const kids = kidsOf(id);
    if (kids.length === 0) return 1;
    let s = 0;
    for (const k of kids) s += leafCount(k.id);
    return s;
  };
  const root = byId.get(ROOT_ID)!;
  pos[ROOT_ID] = { x: -dimsOf(root).w / 2, y: -dimsOf(root).h / 2 };
  const assign = (id: string, a0: number, a1: number) => {
    const kids = kidsOf(id);
    if (kids.length === 0) return;
    const total = kids.reduce((a, k) => a + leafCount(k.id), 0);
    let cur = a0;
    for (const k of kids) {
      const span = ((a1 - a0) * leafCount(k.id)) / total;
      const mid = cur + span / 2;
      const dm = dimsOf(k);
      const r = ringR[k.depth]!;
      pos[k.id] = { x: Math.cos(mid) * r - dm.w / 2, y: Math.sin(mid) * r - dm.h / 2 };
      assign(k.id, cur, cur + span);
      cur += span;
    }
  };
  assign(ROOT_ID, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2);
  return pos;
}

/** Point where the center→target segment crosses the rect border. */
function edgePoint(rect: { x: number; y: number; w: number; h: number }, target: Pos): Pos {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const dx = target.x - cx;
  const dy = target.y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const tx = dx !== 0 ? rect.w / 2 / Math.abs(dx) : Infinity;
  const ty = dy !== 0 ? rect.h / 2 / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty);
  return { x: cx + dx * t, y: cy + dy * t };
}

/** Connector path between a parent and child card, styled by diagram mode. */
function pathFor(parent: LNode, child: LNode, p: Pos, c: Pos, mode: DiagramMode): { d: string; joint: Pos } {
  const pd = dimsOf(parent);
  const cd = dimsOf(child);
  const pcx = p.x + pd.w / 2;
  const pcy = p.y + pd.h / 2;
  const ccx = c.x + cd.w / 2;
  const ccy = c.y + cd.h / 2;

  if (mode === "tree" || mode === "constellation") {
    const sy = p.y + pd.h;
    const ty = c.y;
    if (mode === "constellation") {
      return { d: `M ${pcx} ${sy} C ${pcx} ${sy + 42}, ${ccx} ${ty - 42}, ${ccx} ${ty}`, joint: { x: ccx, y: ty } };
    }
    if (Math.abs(pcx - ccx) < 3) return { d: `M ${pcx} ${sy} L ${ccx} ${ty}`, joint: { x: ccx, y: ty } };
    const midY = sy + (ty - sy) / 2;
    return { d: `M ${pcx} ${sy} L ${pcx} ${midY} L ${ccx} ${midY} L ${ccx} ${ty}`, joint: { x: ccx, y: ty } };
  }

  if (mode === "flow") {
    const sx = p.x + pd.w;
    const tx = c.x;
    if (Math.abs(pcy - ccy) < 3) return { d: `M ${sx} ${pcy} L ${tx} ${ccy}`, joint: { x: tx, y: ccy } };
    const midX = sx + (tx - sx) / 2;
    return { d: `M ${sx} ${pcy} L ${midX} ${pcy} L ${midX} ${ccy} L ${tx} ${ccy}`, joint: { x: tx, y: ccy } };
  }

  // radial — curved edge-to-edge arc
  const s = edgePoint({ x: p.x, y: p.y, w: pd.w, h: pd.h }, { x: ccx, y: ccy });
  const e = edgePoint({ x: c.x, y: c.y, w: cd.w, h: cd.h }, { x: pcx, y: pcy });
  const mx = (s.x + e.x) / 2;
  const my = (s.y + e.y) / 2;
  const dx = e.x - s.x;
  const dy = e.y - s.y;
  const len = Math.hypot(dx, dy) || 1;
  const bow = Math.min(26, len * 0.16) * (hashStr(child.id) % 2 === 0 ? 1 : -1);
  return { d: `M ${s.x} ${s.y} Q ${mx + (-dy / len) * bow} ${my + (dx / len) * bow} ${e.x} ${e.y}`, joint: { x: e.x, y: e.y } };
}

/** Bounding box of every laid-out card. */
function boundsOf(nodes: LNode[], pos: Record<string, Pos>) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    const p = pos[n.id];
    if (!p) continue;
    const dm = dimsOf(n);
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + dm.w);
    maxY = Math.max(maxY, p.y + dm.h);
  }
  if (!isFinite(minX) || !isFinite(minY)) return { minX: 0, minY: 0, maxX: 400, maxY: 300 };
  return { minX, minY, maxX, maxY };
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

/* ────────────────────────────── Expand buttons ────────────────────────────── */

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

/** Compact circular expand toggle for canvas node cards. */
function CanvasExpandButton({ open, count, onClick, name }: { open: boolean; count: number; onClick: () => void; name: string }) {
  return (
    <button
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`flex h-6 min-w-[24px] shrink-0 items-center justify-center gap-0.5 rounded-full border px-1 text-[9px] font-semibold transition-colors ${
        open
          ? "border-[rgba(58,123,255,0.4)] bg-[rgba(58,123,255,0.12)] text-[#1d5fd6]"
          : "border-white/70 bg-white/70 text-[color:var(--ink-soft)] hover:bg-white"
      }`}
      aria-expanded={open}
      aria-label={open ? `Collapse ${name}` : `Expand ${name} (${count} hidden)`}
      title={open ? "Collapse branch" : "Expand branch"}
    >
      {count > 0 && <span className="tabular">{count}</span>}
      {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
    </button>
  );
}

/** Tiny stat chip used on canvas node cards. */
function MiniStat({ icon: Icon, value, tint }: { icon: typeof Users; value: number; tint: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-md px-1 py-px text-[9px] font-semibold tabular" style={{ background: `${tint}16`, color: tint }}>
      <Icon className="h-2.5 w-2.5" aria-hidden="true" />
      {value}
    </span>
  );
}

/* ────────────────────────────── Node cards — stacked tree (mobile) ────────────────────────────── */

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
      className={`group relative w-full cursor-pointer overflow-hidden border text-left shadow-[0_2px_10px_rgba(23,38,61,0.05)] backdrop-blur-md transition-all duration-200 hover:-translate-y-px hover:shadow-[0_8px_24px_rgba(23,38,61,0.10)] ${
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
      className={`group flex min-h-[48px] cursor-pointer items-center gap-2.5 rounded-2xl border px-2.5 py-2 backdrop-blur-md transition-all duration-200 hover:-translate-y-px ${
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

/* ────────────────────────────── Recursive branch (mobile tree) ────────────────────────────── */

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

/* ────────────────────────────── Root group hero card (mobile header) ────────────────────────────── */

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

/* ────────────────────────────── Canvas node cards ────────────────────────────── */

/** Shared shell for all canvas node cards — glass surface, drag + click + keyboard. */
function NodeShell({
  w,
  h,
  radius,
  selected,
  label,
  title,
  dragging,
  onPointerDown,
  onSelect,
  children,
}: {
  w: number;
  h: number;
  radius: number;
  selected: boolean;
  label: string;
  title: string;
  dragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      title={title}
      onPointerDown={onPointerDown}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`absolute left-0 top-0 cursor-grab select-none overflow-hidden border transition-shadow active:cursor-grabbing ${
        dragging ? "z-30 border-[rgba(58,123,255,0.6)] bg-white/95 shadow-[0_18px_44px_rgba(23,38,61,0.22)]" : "hover:shadow-[0_10px_28px_rgba(23,38,61,0.14)]"
      } ${selected ? "border-[rgba(58,123,255,0.55)] bg-white/92 ring-2 ring-[rgba(58,123,255,0.35)]" : dragging ? "" : "border-white/70 bg-white/88"}`}
      style={{ width: w, height: h, borderRadius: radius }}
    >
      {children}
    </div>
  );
}

/** Root node — MEIL Group HQ with live pill + group rollup stats. */
function RootNodeCard({
  summary,
  selected,
  dragging,
  onPointerDown,
  onSelect,
}: {
  summary: HierarchySummary;
  selected: boolean;
  dragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onSelect: () => void;
}) {
  const { navigate, reportingYear } = useWorkspace();
  const cells: { label: string; value: number; hex: string }[] = [
    { label: "Subs", value: summary.subsidiaries, hex: "#6a5bff" },
    { label: "BUs", value: summary.units, hex: "#3a7bff" },
    { label: "Sites", value: summary.projects, hex: "#16a3a3" },
    { label: "People", value: summary.users, hex: "#238653" },
    { label: "Files", value: summary.submissions, hex: "#c57926" },
  ];
  return (
    <NodeShell
      w={272}
      h={128}
      radius={22}
      selected={selected}
      dragging={dragging}
      label="MEIL Group — Group Headquarters. Click to open the Command Center."
      title="MEIL Group — Group Headquarters"
      onPointerDown={onPointerDown}
      onSelect={onSelect}
    >
      <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-[linear-gradient(90deg,#3a7bff,#6a5bff,#16a3a3,#238653,#c57926)] opacity-80" />
      {/* Perf: plain radial gradients (no CSS blur filter) — same glow, zero filter cost.
          Canvas cards skip backdrop-filter entirely: they sit on a static dot grid,
          so a near-opaque surface looks identical and repaints for free. */}
      <span aria-hidden className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[radial-gradient(circle,rgba(58,123,255,0.22),transparent_70%)]" />
      <span aria-hidden className="pointer-events-none absolute -bottom-10 -left-6 h-24 w-24 rounded-full bg-[radial-gradient(circle,rgba(22,163,163,0.18),transparent_70%)]" />

      <div className="relative p-3">
        <div className="flex items-center gap-2.5">
          <NodeFavicon icon={Landmark} hue="#3a7bff" size={42} status="ACTIVE" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[8.5px] font-extrabold uppercase tracking-[0.16em] text-[#1d5fd6]">Group HQ</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(35,134,83,0.35)] bg-[rgba(35,134,83,0.10)] px-1.5 py-px text-[7.5px] font-bold uppercase tracking-wider text-[#1d6b44]">
                <span className="relative flex h-1 w-1">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#238653] opacity-60" aria-hidden="true" />
                  <span className="relative inline-flex h-1 w-1 rounded-full bg-[#238653]" aria-hidden="true" />
                </span>
                Live
              </span>
            </div>
            <div className="truncate text-[15px] font-semibold leading-5 text-[color:var(--ink)]">MEIL Group</div>
            <div className="truncate text-[9px] font-medium text-[color:var(--ink-faint)]">Group ESG command · {reportingYear}</div>
          </div>
          <span
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              navigate("dashboard");
            }}
            role="button"
            tabIndex={0}
            aria-label="Open Command Center"
            title="Open Command Center"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                navigate("dashboard");
              }
            }}
            className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/70 bg-white/75 text-[#1d5fd6] shadow-sm transition-colors hover:bg-white"
          >
            <LayoutDashboard className="h-3 w-3" aria-hidden="true" />
          </span>
        </div>

        <div className="mt-2 grid grid-cols-5 gap-px overflow-hidden rounded-xl border border-white/60 bg-[rgba(125,177,216,0.25)]">
          {cells.map((c) => (
            <div key={c.label} className="flex flex-col items-center bg-white/62 px-0.5 py-1" title={`${c.label}: ${c.value}`}>
              <span className="tabular text-[12px] font-semibold leading-4 text-[color:var(--ink)]">{fmtNumber(c.value)}</span>
              <span className="text-[7.5px] font-bold uppercase tracking-wide text-[color:var(--ink-faint)]" style={{ color: c.hex, opacity: 0.85 }}>
                {c.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </NodeShell>
  );
}

/** Subsidiary canvas node. */
function SubNodeCard({
  node,
  hue,
  selected,
  dragging,
  open,
  onPointerDown,
  onSelect,
  onToggle,
}: {
  node: HierarchyNode;
  hue: string;
  selected: boolean;
  dragging: boolean;
  open: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onSelect: () => void;
  onToggle: () => void;
}) {
  const kids = node.children ?? [];
  return (
    <NodeShell
      w={252}
      h={92}
      radius={18}
      selected={selected}
      dragging={dragging}
      label={`Subsidiary: ${node.name} — open detail panel`}
      title={`${node.name} — ${node.meta}`}
      onPointerDown={onPointerDown}
      onSelect={onSelect}
    >
      <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] rounded-r-full" style={{ background: `linear-gradient(180deg, ${hue}, ${hue}44)` }} />
      <div className="relative flex h-full flex-col p-2.5 pl-3.5">
        <div className="flex items-start gap-2">
          <NodeFavicon icon={Landmark} hue={hue} size={34} status={node.status} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[8.5px] font-extrabold uppercase tracking-[0.14em]" style={{ color: hue }}>
              Subsidiary
            </div>
            <div className="truncate text-[12.5px] font-semibold leading-4 text-[color:var(--ink)]">{node.name}</div>
            <div className="mt-0.5 flex items-center gap-1">
              <span className="rounded bg-[rgba(102,119,141,0.10)] px-1 py-px font-mono text-[8.5px] font-medium text-[color:var(--ink-faint)]">{node.code}</span>
              {node.manager && <span className="truncate text-[8.5px] text-[color:var(--ink-faint)]">Mgr · {node.manager}</span>}
            </div>
          </div>
          {kids.length > 0 && <CanvasExpandButton open={open} count={kids.length} onClick={onToggle} name={node.name} />}
        </div>
        {node.stats && (
          <div className="mt-auto flex items-center gap-1 pl-[42px]">
            <MiniStat icon={Users} value={node.stats.users} tint="#3a7bff" />
            <MiniStat icon={Building2} value={node.stats.projects} tint="#16a3a3" />
            <MiniStat icon={ClipboardList} value={node.stats.submissions} tint="#c57926" />
          </div>
        )}
      </div>
    </NodeShell>
  );
}

/** Business-unit canvas node. */
function UnitNodeCard({
  node,
  hue,
  selected,
  dragging,
  open,
  onPointerDown,
  onSelect,
  onToggle,
}: {
  node: HierarchyNode;
  hue: string;
  selected: boolean;
  dragging: boolean;
  open: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onSelect: () => void;
  onToggle: () => void;
}) {
  const kids = node.children ?? [];
  return (
    <NodeShell
      w={228}
      h={64}
      radius={16}
      selected={selected}
      dragging={dragging}
      label={`Business Unit: ${node.name} — open detail panel`}
      title={`${node.name} — ${node.meta}`}
      onPointerDown={onPointerDown}
      onSelect={onSelect}
    >
      <span aria-hidden className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full" style={{ background: `linear-gradient(180deg, ${hue}, ${hue}44)` }} />
      <div className="relative flex h-full flex-col justify-center p-2 pl-3">
        <div className="flex items-center gap-2">
          <NodeFavicon icon={Layers} hue={hue} size={28} status={node.status} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[7.5px] font-extrabold uppercase tracking-[0.14em]" style={{ color: hue }}>
              Business Unit
            </div>
            <div className="truncate text-[11.5px] font-semibold leading-4 text-[color:var(--ink)]">{node.name}</div>
          </div>
          {kids.length > 0 && <CanvasExpandButton open={open} count={kids.length} onClick={onToggle} name={node.name} />}
        </div>
        {node.stats && (
          <div className="mt-1 flex items-center gap-1 pl-[36px]">
            <span className="rounded bg-[rgba(102,119,141,0.10)] px-1 py-px font-mono text-[8px] font-medium text-[color:var(--ink-faint)]">{node.code}</span>
            <MiniStat icon={Users} value={node.stats.users} tint="#3a7bff" />
            <MiniStat icon={ClipboardList} value={node.stats.submissions} tint="#c57926" />
          </div>
        )}
      </div>
    </NodeShell>
  );
}

/** Project / site canvas node (leaf). */
function ProjectNodeCard({
  node,
  hue,
  selected,
  dragging,
  onPointerDown,
  onSelect,
}: {
  node: HierarchyNode;
  hue: string;
  selected: boolean;
  dragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onSelect: () => void;
}) {
  const Icon = KIND_ICON[node.kind ?? ""] ?? Building2;
  const kindLabel = KIND_LABEL[node.kind ?? ""] ?? "Project";
  return (
    <NodeShell
      w={210}
      h={52}
      radius={14}
      selected={selected}
      dragging={dragging}
      label={`Project: ${node.name} (${node.status}) — open detail panel`}
      title={`${node.name} — ${node.meta}`}
      onPointerDown={onPointerDown}
      onSelect={onSelect}
    >
      <span aria-hidden className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full" style={{ background: `linear-gradient(180deg, ${hue}, ${hue}44)` }} />
      <div className="relative flex h-full items-center gap-2 p-2 pl-3">
        <NodeFavicon icon={Icon} hue={hue} size={26} status={node.status} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[7.5px] font-extrabold uppercase tracking-[0.12em]" style={{ color: hue }}>
            Project · {kindLabel}
          </div>
          <div className="truncate text-[11px] font-semibold leading-4 text-[color:var(--ink)]">{node.name}</div>
        </div>
        {node.stats && node.stats.submissions > 0 && <MiniStat icon={ClipboardList} value={node.stats.submissions} tint="#0f7c7c" />}
      </div>
    </NodeShell>
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

const clampPan = (x: number, y: number) => ({ x: Math.max(-1800, Math.min(1800, x)), y: Math.max(-1400, Math.min(1400, y)) });
const clampZoom = (z: number) => Math.max(0.25, Math.min(1.6, z));

export default function HierarchyView() {
  const { navigate } = useWorkspace();
  const { data, loading, error, refetch } = useApi<{ nodes: HierarchyNode[]; summary: HierarchySummary }>("/api/esg/hierarchy");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /* ── movable node canvas state ──
     PERF MODEL: React state is committed only at interaction END. All per-frame
     work (node drag, canvas pan, wheel zoom, layout animation) paints transforms
     and connector paths straight to the DOM, so a 120Hz pointer never triggers a
     React re-render of ~30 glass cards + every SVG edge. */
  const [mode, setMode] = useState<DiagramMode>("tree");
  const viewportRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const [dragging, setDragging] = useState(false); // canvas pan
  const dragInfo = useRef<{ sx: number; sy: number; bx: number; by: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  const [positions, setPositions] = useState<Record<string, Pos>>({});
  const posRef = useRef<Record<string, Pos>>({});
  const animRef = useRef<number | null>(null);
  const [animating, setAnimating] = useState(false);
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const nodeDrag = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const firstLayout = useRef(true);

  /* Direct-DOM registries: node wrappers, connector element groups, live metadata. */
  const nodeEls = useRef(new Map<string, HTMLDivElement>());
  const edgeEls = useRef(new Map<string, { glow: SVGPathElement; line: SVGPathElement; dot: SVGCircleElement }>());
  const zoomLabelRef = useRef<HTMLSpanElement>(null);
  const modeRef = useRef<DiagramMode>("tree");
  const lnodeByIdRef = useRef(new Map<string, LNode>());

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

  const lnodes = useMemo(() => buildLNodes(filtered, openMap, searchActive, hueMap), [filtered, openMap, searchActive, hueMap]);
  const targetPos = useMemo(() => (lnodes.length > 0 ? layoutDiagram(lnodes, mode) : {}), [lnodes, mode]);

  /* Rendered positions: live state (drag/animation) or freshly computed target on first paint. */
  const pos = useMemo(() => (Object.keys(positions).length > 0 ? positions : targetPos), [positions, targetPos]);

  /* ── direct-DOM paint helpers (bypass React for per-frame work) ── */
  const applyWorld = () => {
    const w = worldRef.current;
    if (w) w.style.transform = `translate3d(${panRef.current.x}px, ${panRef.current.y}px, 0) scale(${zoomRef.current})`;
  };
  const applyNodePos = (id: string, p: Pos) => {
    const el = nodeEls.current.get(id);
    if (el) el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
  };
  const applyEdge = (childId: string) => {
    const els = edgeEls.current.get(childId);
    const child = lnodeByIdRef.current.get(childId);
    if (!els || !child?.parentId) return;
    const parent = lnodeByIdRef.current.get(child.parentId);
    const p = posRef.current[child.parentId];
    const c = posRef.current[childId];
    if (!parent || !p || !c) return;
    const { d, joint } = pathFor(parent, child, p, c, modeRef.current);
    els.glow.setAttribute("d", d);
    els.line.setAttribute("d", d);
    els.dot.setAttribute("cx", String(joint.x));
    els.dot.setAttribute("cy", String(joint.y));
  };
  const applyAllEdges = () => {
    for (const cid of edgeEls.current.keys()) applyEdge(cid);
  };

  const activeMode = DIAGRAM_MODES.find((m) => m.id === mode) ?? DIAGRAM_MODES[0]!;

  /* ── animated layout transitions (rAF-lerped so nodes + connectors stay in sync) ──
     Frames paint via direct DOM writes; React receives a single commit at the end. */
  const stopAnim = () => {
    if (animRef.current !== null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    setAnimating(false);
  };

  const animateLayout = (target: Record<string, Pos>) => {
    stopAnim();
    const from: Record<string, Pos> = {};
    for (const id of Object.keys(target)) {
      const cur = posRef.current[id];
      from[id] = cur ? { ...cur } : { ...target[id]! };
    }
    const t0 = performance.now();
    const dur = 520;
    setAnimating(true);
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      const live = posRef.current;
      for (const id of Object.keys(target)) {
        const f = from[id]!;
        const next = { x: f.x + (target[id]!.x - f.x) * e, y: f.y + (target[id]!.y - f.y) * e };
        live[id] = next;
        applyNodePos(id, next);
      }
      applyAllEdges();
      if (t < 1) {
        animRef.current = requestAnimationFrame(step);
      } else {
        animRef.current = null;
        setAnimating(false);
        setPositions({ ...posRef.current });
      }
    };
    animRef.current = requestAnimationFrame(step);
  };

  const fitViewWith = (p: Record<string, Pos>, list: LNode[]) => {
    const vp = viewportRef.current;
    if (!vp || list.length === 0) return;
    const b = boundsOf(list, p);
    const pad = 56;
    const bw = b.maxX - b.minX + pad * 2;
    const bh = b.maxY - b.minY + pad * 2;
    const vw = vp.clientWidth;
    const vh = vp.clientHeight;
    if (vw === 0 || vh === 0) return;
    // Readability floor — wide tree/flow diagrams pan instead of shrinking further,
    // while radial/constellation get a lower floor so the full orbit fits on screen.
    const zFloor = mode === "radial" || mode === "constellation" ? 0.3 : 0.45;
    const z = Math.max(zFloor, Math.min(1, vw / bw, vh / bh));
    const nextPan = {
      x: Math.round((vw - (b.maxX - b.minX) * z) / 2 - b.minX * z),
      y: Math.round((vh - (b.maxY - b.minY) * z) / 2 - b.minY * z),
    };
    zoomRef.current = +z.toFixed(2);
    panRef.current = nextPan;
    setZoom(zoomRef.current);
    setPan(nextPan);
  };

  /* Apply new target layout whenever the design mode / tree shape changes. */
  useEffect(() => {
    if (lnodes.length === 0) return;
    if (firstLayout.current) {
      firstLayout.current = false;
      // Seed the ref only — render falls back to `targetPos` while `positions` is still empty.
      posRef.current = targetPos;
      const raf = requestAnimationFrame(() => fitViewWith(targetPos, lnodes));
      return () => cancelAnimationFrame(raf);
    }
    // Defer to the next frame: keeps setState out of the synchronous effect body.
    const rafId = requestAnimationFrame(() => animateLayout(targetPos));
    const t = window.setTimeout(() => fitViewWith(targetPos, lnodes), 640);
    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(t);
    };
  }, [targetPos, lnodes]);

  useEffect(() => () => stopAnim(), []);

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

  /* ── canvas pan: pointer drag with click suppression (direct DOM per frame, one commit) ── */
  const startPan = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    dragInfo.current = { sx: e.clientX, sy: e.clientY, bx: panRef.current.x, by: panRef.current.y, moved: false };
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
      if (!d.moved) return;
      panRef.current = clampPan(d.bx + dx, d.by + dy);
      applyWorld(); // paint straight to the world layer — no React render per move
    };
    const up = () => {
      const moved = dragInfo.current?.moved ?? false;
      suppressClick.current = moved;
      dragInfo.current = null;
      setDragging(false);
      if (moved) {
        setPan(panRef.current); // single React commit at gesture end
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

  /* ── node drag: move any node anywhere; connectors re-anchor live, zero re-renders ── */
  const startNodeDrag = (e: React.PointerEvent, n: LNode) => {
    if (e.button !== 0 || animating) return;
    const p = posRef.current[n.id];
    if (!p) return;
    e.stopPropagation();
    nodeDrag.current = { id: n.id, sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y, moved: false };
    suppressClick.current = false;
    setDragNodeId(n.id);
  };

  useEffect(() => {
    if (!dragNodeId) return;
    const move = (e: PointerEvent) => {
      const d = nodeDrag.current;
      if (!d) return;
      const dx = e.clientX - d.sx;
      const dy = e.clientY - d.sy;
      if (!d.moved && Math.hypot(dx, dy) > 5) d.moved = true;
      if (!d.moved) return;
      const next = { x: d.ox + dx, y: d.oy + dy };
      posRef.current = { ...posRef.current, [d.id]: next };
      /* Paint straight to the DOM: the dragged card + every connector touching it. */
      applyNodePos(d.id, next);
      applyEdge(d.id); // this node's own connector to its parent
      for (const [cid, ln] of lnodeByIdRef.current) {
        if (ln.parentId === d.id) applyEdge(cid); // connectors to this node's children
      }
    };
    const up = () => {
      const moved = nodeDrag.current?.moved ?? false;
      suppressClick.current = moved;
      nodeDrag.current = null;
      setDragNodeId(null);
      if (moved) {
        setPositions({ ...posRef.current }); // single React commit at gesture end
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
  }, [dragNodeId]);

  /* ── zoom: ⌘/Ctrl + wheel (rAF-batched direct writes, commit after idle) + on-canvas controls ── */
  const canvasReady = !!data && filtered.length > 0 && lnodes.length > 0;
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || !canvasReady) return;
    let raf = 0;
    let commitTimer = 0;
    const paint = () => {
      raf = 0;
      applyWorld();
      if (zoomLabelRef.current) zoomLabelRef.current.textContent = `${Math.round(zoomRef.current * 100)}%`;
    };
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      zoomRef.current = clampZoom(zoomRef.current - Math.sign(e.deltaY) * 0.08);
      if (!raf) raf = requestAnimationFrame(paint);
      window.clearTimeout(commitTimer);
      commitTimer = window.setTimeout(() => {
        setZoom(zoomRef.current);
        setPan(panRef.current);
      }, 180);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      if (raf) cancelAnimationFrame(raf);
      window.clearTimeout(commitTimer);
    };
  }, [canvasReady]);

  const zoomBy = (d: number) => {
    zoomRef.current = clampZoom(+(zoomRef.current + d).toFixed(2));
    setZoom(zoomRef.current);
  };

  const handleCanvasSelect = (n: LNode) => {
    if (suppressClick.current) return;
    if (n.type === "root") {
      navigate("dashboard");
      return;
    }
    selectNode(n.id);
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
        { key: "pending", icon: Hourglass, hue: "#c57926", label: "Pending review", hint: "Awaiting a review decision", value: summary.pendingReview, go: () => navigate("approvals") },
        { key: "overdue", icon: AlarmClock, hue: "#c34a4a", label: "Overdue", hint: "Past due date — needs escalation", value: summary.overdue, go: () => navigate("submissions", { statusFilter: "OVERDUE" }) },
      ]
    : [];

  /* connectors, recomputed from committed positions (interactions paint via direct DOM) */
  const lnodeById = useMemo(() => new Map(lnodes.map((n) => [n.id, n] as const)), [lnodes]);
  /* Sync the interaction refs after every render — refs must never be written
     during render itself (react-hooks/refs), and every consumer of these refs
     (gesture handlers, rAF frames) runs after this effect anyway. */
  useEffect(() => {
    panRef.current = pan;
    zoomRef.current = zoom;
    modeRef.current = mode;
    lnodeByIdRef.current = lnodeById;
  }, [pan, zoom, mode, lnodeById]);
  const edges = useMemo(() => {
    const out: { key: string; d: string; hue: string; joint: Pos }[] = [];
    for (const n of lnodes) {
      if (!n.parentId) continue;
      const parentNode = lnodeById.get(n.parentId);
      const p = pos[n.parentId];
      const c = pos[n.id];
      if (!parentNode || !p || !c) continue;
      const { d, joint } = pathFor(parentNode, n, p, c, mode);
      out.push({ key: n.id, d, hue: n.hue, joint });
    }
    return out;
  }, [lnodes, lnodeById, pos, mode]);

  return (
    <div className="view-in space-y-5">
      <PageHeader
        title="Organization Hierarchy"
        description="Group → Subsidiary → Business Unit → Project / Site. Drag the canvas to pan, drag any node anywhere — connectors follow live. Switch between four diagram designs, ⌘/Ctrl + scroll to zoom, and click any node to inspect performance, submissions, and team."
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
          <div role="tree" aria-label="Organization hierarchy" className="min-w-0">
            {/* ── movable node canvas (md+) ── */}
            <div
              ref={viewportRef}
              onPointerDown={startPan}
              onClickCapture={(e) => {
                if (suppressClick.current) {
                  e.stopPropagation();
                  e.preventDefault();
                }
              }}
              role="application"
              aria-label={`Organization hierarchy diagram — ${activeMode.label}. Drag the canvas to pan, drag nodes to rearrange.`}
              data-busy={dragging || dragNodeId || animating ? "true" : "false"}
              className={`relative hidden select-none overflow-hidden rounded-[26px] border border-white/60 bg-[rgba(255,255,255,0.34)] shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_8px_30px_rgba(23,38,61,0.06)] backdrop-blur-md md:block ${dragging || dragNodeId ? "cursor-grabbing" : "cursor-grab"}`}
              style={{ touchAction: "pan-y", height: "clamp(540px, 66vh, 720px)" }}
            >
              <style>{`
                .edge-dash { stroke-dasharray: 4 7; animation: edge-dash-flow 26s linear infinite; }
                @keyframes edge-dash-flow { to { stroke-dashoffset: -330; } }
                /* Perf: freeze connector flow while interacting — the canvas repaints
                   every frame during drag/pan/zoom, so idle-only animations avoid
                   compounding paint work. */
                [data-busy="true"] .edge-dash { animation-play-state: paused; }
                .node-in { animation: node-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both; }
                @keyframes node-in { from { opacity: 0; } to { opacity: 1; } }
                @media (prefers-reduced-motion: reduce) { .edge-dash, .node-in { animation: none; } }
              `}</style>

              {/* dot grid backdrop */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{ backgroundImage: "radial-gradient(rgba(58,123,255,0.10) 1.2px, transparent 1.2px)", backgroundSize: "26px 26px" }}
              />

              {/* ── diagram design switcher ── */}
              <div
                className="absolute left-3 top-3 z-20 flex max-w-[calc(100%-24px)] items-center gap-1 overflow-x-auto rounded-full border border-white/70 bg-white/85 p-1 shadow-sm backdrop-blur-md"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <span className="ml-1.5 hidden items-center gap-1 whitespace-nowrap text-[9.5px] font-bold uppercase tracking-[0.14em] text-[color:var(--ink-faint)] md:flex">
                  <Waypoints className="h-3 w-3 text-[color:var(--esg-blue)]" aria-hidden="true" />
                  Diagram design
                </span>
                {DIAGRAM_MODES.map((m) => {
                  const active = mode === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setMode(m.id)}
                      aria-pressed={active}
                      title={`${m.label} — ${m.hint}`}
                      className={`flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold transition-all ${
                        active
                          ? "bg-[#3a7bff] text-white shadow-[0_2px_8px_rgba(58,123,255,0.4)]"
                          : "text-[color:var(--ink-soft)] hover:bg-white/95"
                      }`}
                    >
                      <m.icon className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="hidden lg:inline">{m.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* ── moving layer: connectors + draggable nodes ── */}
              <div
                ref={worldRef}
                className="absolute inset-0"
                style={{
                  transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
                  transformOrigin: "0 0",
                  willChange: "transform",
                }}
              >
                <svg aria-hidden className="pointer-events-none absolute left-0 top-0 overflow-visible">
                  {edges.map((e) => (
                    <g
                      key={e.key}
                      ref={(g) => {
                        if (!g) {
                          edgeEls.current.delete(e.key);
                          return;
                        }
                        /* [underglow path, dash path, joint dot] — registered once so
                           the drag engine can re-anchor this connector per frame. */
                        edgeEls.current.set(e.key, {
                          glow: g.children[0] as SVGPathElement,
                          line: g.children[1] as SVGPathElement,
                          dot: g.children[2] as SVGCircleElement,
                        });
                      }}
                    >
                      <path d={e.d} fill="none" stroke={e.hue} strokeOpacity={0.13} strokeWidth={5} strokeLinecap="round" />
                      <path d={e.d} fill="none" stroke={e.hue} strokeOpacity={0.55} strokeWidth={1.6} strokeLinecap="round" className="edge-dash" />
                      <circle cx={e.joint.x} cy={e.joint.y} r={3} fill={e.hue} stroke="#ffffff" strokeWidth={1.4} />
                    </g>
                  ))}
                </svg>

                {lnodes.map((n) => {
                  const p = pos[n.id];
                  if (!p) return null;
                  if (n.type === "root" && !summary) return null;
                  const selected = selectedId === n.id;
                  const draggingThis = dragNodeId === n.id;
                  const isOpenForKids = (kidsCount: number) => (kidsCount === 0 ? false : searchActive || (openMap[n.id] ?? true));
                  return (
                    <div
                      key={n.id}
                      ref={(el) => {
                        if (el) nodeEls.current.set(n.id, el);
                        else nodeEls.current.delete(n.id);
                      }}
                      className="node-in absolute left-0 top-0"
                      style={{
                        transform: `translate3d(${p.x}px, ${p.y}px, 0)`,
                        zIndex: draggingThis ? 30 : n.type === "root" ? 20 : 10,
                        willChange: draggingThis ? "transform" : undefined,
                        contain: "layout",
                      }}
                    >
                      {n.type === "root" && summary && (
                        <RootNodeCard
                          summary={summary}
                          selected={selected}
                          dragging={draggingThis}
                          onPointerDown={(e) => startNodeDrag(e, n)}
                          onSelect={() => handleCanvasSelect(n)}
                        />
                      )}
                      {n.type === "subsidiary" && n.node && (
                        <SubNodeCard
                          node={n.node}
                          hue={n.hue}
                          selected={selected}
                          dragging={draggingThis}
                          open={isOpenForKids(n.node.children?.length ?? 0)}
                          onPointerDown={(e) => startNodeDrag(e, n)}
                          onSelect={() => handleCanvasSelect(n)}
                          onToggle={() => onToggle(n.id, !(openMap[n.id] ?? true))}
                        />
                      )}
                      {n.type === "unit" && n.node && (
                        <UnitNodeCard
                          node={n.node}
                          hue={n.hue}
                          selected={selected}
                          dragging={draggingThis}
                          open={isOpenForKids(n.node.children?.length ?? 0)}
                          onPointerDown={(e) => startNodeDrag(e, n)}
                          onSelect={() => handleCanvasSelect(n)}
                          onToggle={() => onToggle(n.id, !(openMap[n.id] ?? true))}
                        />
                      )}
                      {n.type === "project" && n.node && (
                        <ProjectNodeCard
                          node={n.node}
                          hue={n.hue}
                          selected={selected}
                          dragging={draggingThis}
                          onPointerDown={(e) => startNodeDrag(e, n)}
                          onSelect={() => handleCanvasSelect(n)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* canvas overlays — hint + controls */}
              <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex max-w-[calc(100%-140px)] items-center gap-1.5 rounded-full border border-white/60 bg-white/80 px-2.5 py-1 text-[10.5px] font-medium text-[color:var(--ink-soft)] shadow-sm backdrop-blur-md">
                <Hand className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="truncate">
                  Drag canvas to pan · drag any node anywhere · {activeMode.hint}
                </span>
              </div>
              <div
                className="absolute bottom-3 right-3 z-10 flex items-center gap-0.5 rounded-full border border-white/60 bg-white/85 p-1 shadow-sm backdrop-blur-md"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => zoomBy(-0.1)}
                  disabled={zoom <= 0.26}
                  aria-label="Zoom out"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[color:var(--ink-soft)] transition-colors hover:bg-white/95 disabled:opacity-40"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span ref={zoomLabelRef} className="tabular w-9 text-center text-[10.5px] font-semibold text-[color:var(--ink-soft)]">{Math.round(zoom * 100)}%</span>
                <button
                  onClick={() => zoomBy(0.1)}
                  disabled={zoom >= 1.59}
                  aria-label="Zoom in"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[color:var(--ink-soft)] transition-colors hover:bg-white/95 disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <span aria-hidden className="mx-0.5 h-4 w-px bg-[rgba(102,119,141,0.2)]" />
                <button
                  onClick={() => fitViewWith(pos, lnodes)}
                  aria-label="Fit diagram to screen"
                  title="Fit diagram to screen"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[color:var(--ink-soft)] transition-colors hover:bg-white/95"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => animateLayout(targetPos)}
                  aria-label="Reset node layout to the default pattern"
                  title="Reset node layout"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[color:var(--ink-soft)] transition-colors hover:bg-white/95"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* ── stacked tree (mobile) ── */}
            <div className="mt-1 md:hidden">
              {summary && <GroupHero summary={summary} />}
              <div className="mt-4">
                <TreeBranch nodes={filtered} depth={0} ctx={{
                  openMap,
                  searchActive,
                  selectedId,
                  hueMap,
                  onToggle,
                  onSelect: (node) => setSelectedId((cur) => (cur === node.id ? null : node.id)),
                }} connectors={true} />
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
                Node color = subsidiary branch · drag any node — connectors follow · click a card for its detail panel
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
