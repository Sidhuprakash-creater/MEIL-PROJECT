"use client";

// ── SCREEN 03 — Organization Hierarchy ──
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FolderTree,
  Landmark,
  Layers,
  ListTree,
  Users,
} from "lucide-react";
import { useWorkspace } from "@/lib/esg/store";
import { useApi } from "@/lib/esg/client";
import type { HierarchyNode, ViewId } from "@/lib/esg/types";
import {
  Chip,
  EmptyState,
  ErrorState,
  GlassCard,
  LoadingBlock,
  PageHeader,
  SectionCard,
  StatusBadge,
  Toolbar,
  type ToolbarFilter,
} from "@/components/workspace/ui";

type TreeMode = "initial" | "expand" | "collapse";

const TYPE_VIEW: Record<HierarchyNode["type"], ViewId> = {
  subsidiary: "subsidiaries",
  unit: "units",
  project: "projects",
};

const TYPE_STYLE: Record<HierarchyNode["type"], { icon: typeof Landmark; cls: string; label: string }> = {
  subsidiary: { icon: Landmark, cls: "bg-[rgba(106,91,255,0.12)] text-[#6a5bff]", label: "Subsidiary" },
  unit: { icon: Layers, cls: "bg-[rgba(58,123,255,0.12)] text-[#3a7bff]", label: "Business Unit" },
  project: { icon: Building2, cls: "bg-[rgba(22,163,163,0.12)] text-[#16a3a3]", label: "Project / Site" },
};

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
  for (const s of nodes) {
    units += s.children?.length ?? 0;
    for (const u of s.children ?? []) projects += u.children?.length ?? 0;
  }
  return { subs: nodes.length, units, projects };
}

function TreeNode({
  node,
  depth,
  openMap,
  mode,
  onToggle,
}: {
  node: HierarchyNode;
  depth: number;
  openMap: Record<string, boolean>;
  mode: TreeMode;
  onToggle: (id: string, next: boolean) => void;
}) {
  const { openDetail } = useWorkspace();
  const children = node.children ?? [];
  const isOpen = openMap[node.id] ?? (mode === "expand" ? true : mode === "collapse" ? false : depth === 0);
  const style = TYPE_STYLE[node.type];

  return (
    <div>
      <GlassCard subtle className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3 sm:flex-nowrap">
        {children.length > 0 ? (
          <button
            onClick={() => onToggle(node.id, !isOpen)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-[color:var(--ink-soft)] transition-colors hover:bg-white/70"
            aria-expanded={isOpen}
            aria-label={isOpen ? `Collapse ${node.name}` : `Expand ${node.name}`}
          >
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="h-7 w-7 shrink-0" aria-hidden="true" />
        )}
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${style.cls}`} aria-hidden="true">
          <style.icon className="h-4 w-4" />
        </span>
        <button
          onClick={() => openDetail(TYPE_VIEW[node.type], node.id, "overview")}
          className="min-w-0 shrink-0 text-left text-[14px] font-semibold text-[color:var(--ink)] transition-colors hover:text-[color:var(--esg-blue)]"
          aria-label={`Open ${node.name} in ${TYPE_VIEW[node.type]}`}
        >
          {node.name}
        </button>
        <Chip tone="gray">{node.code}</Chip>
        <span className="hidden min-w-0 flex-1 truncate text-xs text-[color:var(--ink-faint)] md:block">
          {node.meta}
          {node.manager ? ` · Mgr: ${node.manager}` : ""}
        </span>
        <span className="ml-auto flex shrink-0 flex-wrap items-center gap-1.5">
          {node.stats && (
            <>
              <Chip tone="blue">
                <Users className="h-3 w-3" aria-hidden="true" />
                {node.stats.users} users
              </Chip>
              {node.stats.projects > 0 && (
                <Chip tone="teal">
                  <Building2 className="h-3 w-3" aria-hidden="true" />
                  {node.stats.projects} {node.stats.projects === 1 ? "project" : "projects"}
                </Chip>
              )}
              <Chip tone="purple">
                <ClipboardList className="h-3 w-3" aria-hidden="true" />
                {node.stats.submissions} subs
              </Chip>
            </>
          )}
          <StatusBadge status={node.status} />
        </span>
      </GlassCard>

      <AnimatePresence initial={false}>
        {children.length > 0 && isOpen && (
          <motion.div
            key="children"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="ml-6 mt-2 space-y-2 border-l-2 border-[rgba(125,177,216,0.35)] pl-4">
              {children.map((kid) => (
                <TreeNode key={kid.id} node={kid} depth={depth + 1} openMap={openMap} mode={mode} onToggle={onToggle} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function HierarchyView() {
  const { data, loading, error, refetch } = useApi<{ nodes: HierarchyNode[] }>("/api/esg/hierarchy");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const [mode, setMode] = useState<TreeMode>("initial");

  const nodes = data?.nodes ?? [];

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
    setMode("initial");
    setOpenMap((m) => ({ ...m, [id]: next }));
  };

  return (
    <div className="view-in space-y-5">
      <PageHeader
        title="Organization Hierarchy"
        description="Group → Subsidiary → Business Unit → Project / Site structure."
        icon={FolderTree}
        breadcrumbs={["Group", "Organization", "Hierarchy"]}
      />

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Subsidiaries", value: counts.subs, icon: Landmark, cls: "text-[#6a5bff] bg-[rgba(106,91,255,0.12)]" },
          { label: "Business Units", value: counts.units, icon: Layers, cls: "text-[#3a7bff] bg-[rgba(58,123,255,0.12)]" },
          { label: "Projects & Sites", value: counts.projects, icon: Building2, cls: "text-[#16a3a3] bg-[rgba(22,163,163,0.12)]" },
        ].map((c) => (
          <GlassCard key={c.label} className="flex items-center gap-3 p-4 sm:p-5">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${c.cls}`} aria-hidden="true">
              <c.icon className="h-5 w-5" />
            </span>
            <div>
              <div className="tabular text-xl font-semibold tracking-tight text-[color:var(--ink)] sm:text-2xl">{c.value}</div>
              <div className="text-[13px] font-medium text-[color:var(--ink-soft)]">{c.label}</div>
            </div>
          </GlassCard>
        ))}
      </div>

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
              onClick={() => {
                setMode("expand");
                setOpenMap({});
              }}
              className="glass-subtle inline-flex h-9 items-center gap-1.5 rounded-2xl border-white/60 px-3 text-xs font-medium text-[color:var(--ink-soft)] transition-colors hover:bg-white/70"
            >
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" /> Expand all
            </button>
            <button
              onClick={() => {
                setMode("collapse");
                setOpenMap({});
              }}
              className="glass-subtle inline-flex h-9 items-center gap-1.5 rounded-2xl border-white/60 px-3 text-xs font-medium text-[color:var(--ink-soft)] transition-colors hover:bg-white/70"
            >
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /> Collapse all
            </button>
          </div>
        }
      />

      {error && !data ? (
        <SectionCard><ErrorState message={error} onRetry={refetch} /></SectionCard>
      ) : loading && !data ? (
        <SectionCard><LoadingBlock rows={6} label="Building hierarchy…" /></SectionCard>
      ) : filtered.length === 0 ? (
        <SectionCard>
          <EmptyState
            title="No matching nodes"
            message="No subsidiary, business unit, or project matches the current search and status filters."
            icon={ListTree}
          />
        </SectionCard>
      ) : (
        <div className="space-y-2" role="tree" aria-label="Organization hierarchy">
          {filtered.map((s) => (
            <TreeNode key={s.id} node={s} depth={0} openMap={openMap} mode={mode} onToggle={onToggle} />
          ))}
        </div>
      )}
    </div>
  );
}
