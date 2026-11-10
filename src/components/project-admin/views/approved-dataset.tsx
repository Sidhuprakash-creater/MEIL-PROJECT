"use client";

import React, { useEffect, useState } from "react";
import {
  Layers,
  CheckCircle2,
  RefreshCw,
  Send,
  Check,
  AlertCircle,
  Clock,
  Leaf,
  DollarSign,
  Users,
  HardHat,
  Package,
  ShieldCheck,
  FileCheck2,
} from "lucide-react";
import { usePaStore } from "@/lib/project-admin/store";
import { paApiGet, paApiPost, getCachedPaData, clearPaClientCache } from "@/lib/project-admin/client";
import { ensureRevisionPolling, onRevisionChange } from "@/lib/revision-client";
import { PaGlassCard, PaPageHeader, PaButton, PaStatusBadge, PaKpiCard } from "../ui";
import { MeilBoxLoader } from "@/components/shared/meil-loader";

/* ── Module group map ──────────────────────────────────────────────────────
   Approval Dataset groups items the 7 contributor domains the user wants:
   Environment → Energy → Emissions → Water → Waste (stepwise),
   Finance, HR, EHS/Safety, Procurement, CSR, Compliance.
   ────────────────────────────────────────────────────────────────────────── */
interface ModuleGroup {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  accent: string;
  children: { id: string; label: string; items: SubmissionItem[] }[];
}

interface SubmissionItem {
  id: string;
  reportCode: string;
  title: string;
  category: string;
  module: string;
  period: string;
  submitterName: string;
  submitterEmail: string;
  metricValue: string | null;
  evidenceList: string[];
  parsedValues: any[];
  submissionDate: string;
  formattedDateTime: string;
  submissionStatus: string;
  reviewStatus: string;
  forwardedToBu: boolean;
  forwardedToBuAt?: string | null;
  latestReviewComment: string;
  projectId: string | null;
}

const GROUP_MAP: Record<string, string> = {
  /* Environment group — stepwise sub-groups inside it */
  ENVIRONMENT: "ENVIRONMENT",
  ENERGY: "ENVIRONMENT-ENERGY",
  EMISSIONS: "ENVIRONMENT-EMISSIONS",
  WATER: "ENVIRONMENT-WATER",
  WASTE: "ENVIRONMENT-WASTE",
  /* HR group */
  WORKFORCE: "HR",
  PEOPLE: "HR",
  /* EHS / Safety */
  SAFETY: "EHS-SAFETY",
  /* Pure single-domain groups */
  FINANCE: "FINANCE",
  PROCUREMENT: "PROCUREMENT",
  CSR: "CSR",
  COMPLIANCE: "COMPLIANCE",
};

/** Resolve an approved submission into exactly ONE module group, with the same
 *  precedence everywhere: category → module → Compliance. Classifying once
 *  (instead of re-testing category and module with two separate `||` checks at
 *  the use site) guarantees an item can never match into two children of a
 *  group, which used to duplicate rows — and their React keys — in one table. */
const groupOf = (i: { category?: string; module?: string }) =>
  GROUP_MAP[i.category ?? ""] || GROUP_MAP[i.module ?? ""] || "COMPLIANCE";

const GROUP_LABELS: Record<string, string> = {
  ENVIRONMENT: "Environment",
  "ENVIRONMENT-ENERGY": "Energy",
  "ENVIRONMENT-EMISSIONS": "GHG Emissions",
  "ENVIRONMENT-WATER": "Water",
  "ENVIRONMENT-WASTE": "Waste",
  HR: "HR",
  "EHS-SAFETY": "EHS / Safety",
  FINANCE: "Finance",
  PROCUREMENT: "Procurement",
  CSR: "CSR",
  COMPLIANCE: "Compliance",
};

const GROUP_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  ENVIRONMENT: Leaf,
  "ENVIRONMENT-ENERGY": FileCheck2,
  "ENVIRONMENT-EMISSIONS": FileCheck2,
  "ENVIRONMENT-WATER": FileCheck2,
  "ENVIRONMENT-WASTE": FileCheck2,
  HR: Users,
  "EHS-SAFETY": HardHat,
  FINANCE: DollarSign,
  PROCUREMENT: Package,
  CSR: ShieldCheck,
  COMPLIANCE: ShieldCheck,
};

const GROUP_ACCENT: Record<string, string> = {
  ENVIRONMENT: "#16A67A",
  "ENVIRONMENT-ENERGY": "#E89B2D",
  "ENVIRONMENT-EMISSIONS": "#8B5E3C",
  "ENVIRONMENT-WATER": "#0EA5E9",
  "ENVIRONMENT-WASTE": "#5B8C33",
  HR: "#8B5CF6",
  "EHS-SAFETY": "#D9462B",
  FINANCE: "#315CFF",
  PROCUREMENT: "#E35D6A",
  CSR: "#EC4899",
  COMPLIANCE: "#475569",
};

const MODULE_ORDER: Record<string, number> = {
  ENVIRONMENT: 0,
  "ENVIRONMENT-ENERGY": 1,
  "ENVIRONMENT-EMISSIONS": 2,
  "ENVIRONMENT-WATER": 3,
  "ENVIRONMENT-WASTE": 4,
  HR: 5,
  "EHS-SAFETY": 6,
  FINANCE: 7,
  PROCUREMENT: 8,
  CSR: 9,
  COMPLIANCE: 10,
};

const DOMAIN_GROUPS: Record<string, string[]> = {
  ENVIRONMENT: ["ENVIRONMENT", "ENVIRONMENT-ENERGY", "ENVIRONMENT-EMISSIONS", "ENVIRONMENT-WATER", "ENVIRONMENT-WASTE"],
  HR: ["HR"],
  "EHS-SAFETY": ["EHS-SAFETY"],
  FINANCE: ["FINANCE"],
  PROCUREMENT: ["PROCUREMENT"],
  CSR: ["CSR"],
  COMPLIANCE: ["COMPLIANCE"],
};

// Top-level order of the 7 modules
const TOP_ORDER = ["ENVIRONMENT", "FINANCE", "HR", "EHS-SAFETY", "PROCUREMENT", "CSR", "COMPLIANCE"];

function isApproved(item: SubmissionItem) {
  /* Only Project Manager-approved items belong in the approved dataset. */
  return (
    (item.submissionStatus === "APPROVED" ||
      item.submissionStatus === "BU_APPROVED" ||
      item.reviewStatus === "APPROVED") &&
    (item as any).pmApproved !== false
  );
}

export default function ApprovedDatasetView() {
  const { navigate } = usePaStore();
  const cached = getCachedPaData<any>("/api/project-admin/submissions");
  const [loading, setLoading] = useState(!cached);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [forwardedCount, setForwardedCount] = useState<Record<string, boolean>>({});
  const [forwardedAt, setForwardedAt] = useState<Record<string, string | null>>({});
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const load = (bypass = false) => {
    if (!submissions.length && !bypass) setLoading(true);
    paApiGet<any>("/api/project-admin/submissions", undefined, { bypassCache: bypass })
      .then((res) => {
        const items = res?.submissions || [];
        setSubmissions(items);
        const fw: Record<string, boolean> = {};
        const fwAt: Record<string, string | null> = {};
        items.forEach((s: any) => {
          fw[s.id] = s.forwardedToBu ?? false;
          fwAt[s.id] = s.forwardedToBuAt || null;
        });
        setForwardedCount(fw);
        setForwardedAt(fwAt);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    /* Instant paint from the SWR/server caches; fresh data arrives via the
       shared revision bus (~4s) instead of re-computing this endpoint every
       8s with cache bypass (each miss costs ~5s of DB round-trips). */
    load();
    ensureRevisionPolling();
    return onRevisionChange(() => {
      clearPaClientCache();
      load(true);
    });
  }, []);

  // Build grouped, stepwise dataset from approved, not-yet-forwarded submissions.
  // Items already sent to the Business Unit are deliberately hidden — the BU
  // receives them as one consolidated project package; showing them here twice
  // invited accidental re-sends and double-counting.
  const groups: ModuleGroup[] = (() => {
    const approved = submissions.filter((s) => isApproved(s) && !s.forwardedToBu);
    const byGroup = new Map<string, SubmissionItem[]>();
    approved.forEach((s) => {
      const g = groupOf(s);
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g)?.push(s as SubmissionItem);
    });
    // Sort items inside each sub-group by submission date desc
    byGroup.forEach((items) => items.sort((a, b) => +new Date(b.submissionDate) - +new Date(a.submissionDate)));
    const result: ModuleGroup[] = [];
    TOP_ORDER.forEach((top) => {
      const subKeys = DOMAIN_GROUPS[top];
      const children: ModuleGroup["children"] = [];
      (subKeys || []).forEach((subKey) => {
        const items = byGroup.get(subKey) || [];
        if (items.length > 0) {
          children.push({ id: subKey, label: GROUP_LABELS[subKey], items });
        }
      });
      // For Environment, show the parent ENVIRONMENT bucket separately if it exists
      const parentItems = byGroup.get(top) || [];
      if (children.length > 0 || parentItems.length > 0) {
        const rawItems = parentItems.length > 0 ? [...parentItems, ...children.flatMap((c) => c.items)] : children.flatMap((c) => c.items);
        /* Defensive uniqueness by record id (first occurrence wins), in case the
           API ever lists the same approved submission twice. */
        const allItems = [...new Map(rawItems.map((i) => [i.id, i])).values()];
        if (allItems.length > 0) {
          result.push({
            id: top,
            label: GROUP_LABELS[top],
            icon: GROUP_ICONS[top],
            accent: GROUP_ACCENT[top],
            children: children.map((c) => ({
              id: c.id,
              label: c.label,
              /* groupOf classifies each item exactly once — an item can never
                 land in two steps of the same module. */
              items: allItems.filter((i) => groupOf(i) === c.id),
            })),
          });
        }
      }
    });
    result.sort((a, b) => MODULE_ORDER[a.id] - MODULE_ORDER[b.id]);
    return result;
  })();

  /* Staged items count straight from the visible groups. The "sent" KPI is
     computed from the RAW list (forwarded rows are hidden from the grouping
     above, so it can't be derived from groups anymore). */
  const totalApproved = groups.reduce((sum, g) => sum + g.children.reduce((s, c) => s + c.items.length, 0), 0);
  const alreadyForwarded = submissions.filter((s) => isApproved(s) && s.forwardedToBu).length;
  const pendingForward = totalApproved;

  const handleForwardToBu = async () => {
    if (!confirm("Send ALL staged approved submissions to the Business Unit in one consolidated batch?")) return;
    setConfirmOpen(false);
    setActionLoading(true);
    try {
      const res: any = await paApiPost("/api/project-admin/submissions", {
        action: "forward-to-bu",
        comments: "Consolidated approved dataset sent to Business Unit in one batch.",
      });
      const n = res?.forwardedCount ?? 0;
      showToast(
        n > 0
          ? `Sent ${n} approved submission${n === 1 ? "" : "s"} to the Business Unit together as one package.`
          : "No staged submissions were waiting to be sent."
      );
      await load(true);
    } catch (err: any) {
      alert(err.message || "Send to Business Unit failed.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="glass rounded-2xl p-6">
        <MeilBoxLoader boxHeight="min-h-[300px]" label="Loading approved dataset…" />
      </div>
    );
  }

  const noData = totalApproved === 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PaPageHeader
        title="Approved Dataset"
        subtitle="Approved & staged submissions waiting for a single consolidated Business Unit handoff — grouped stepwise by module (Environment → Energy → Water → Waste, then Finance, HR, EHS, Procurement, CSR, Compliance). Once sent, items leave this list and reach the BU as one project package."
        actions={
          <div className="flex items-center gap-2">
            <PaButton
              variant="secondary"
              size="sm"
              onClick={() => {
                clearPaClientCache();
                load(true);
              }}
              disabled={actionLoading}
              className="flex items-center gap-1.5"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              <span>Refresh</span>
            </PaButton>
            <PaButton
              variant="primary"
              size="sm"
              onClick={() => setConfirmOpen(true)}
              disabled={actionLoading || pendingForward < 1}
              className="flex items-center gap-1.5 bg-gradient-to-r from-[#315CFF] to-[#6542F5] hover:from-[#4768ff] hover:to-[#7653ff]"
            >
              <Send size={14} />
              <span>Send all {pendingForward > 0 ? `${pendingForward} items` : "to BU"}</span>
            </PaButton>
          </div>
        }
      />

      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-emerald-600 text-white shadow-xl text-xs font-semibold animate-in slide-in-from-top-3">
          <CheckCircle2 size={16} />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <PaKpiCard
          title="Approved & Staged"
          value={totalApproved}
          icon={CheckCircle2}
          accentColor="#16A67A"
        />
        <PaKpiCard
          title="Sent to BU (hidden)"
          value={alreadyForwarded}
          icon={Send}
          accentColor="#315CFF"
        />
        <PaKpiCard
          title="All-Time Approved"
          value={totalApproved + alreadyForwarded}
          icon={Clock}
          accentColor="#E89B2D"
        />
        <PaKpiCard
          title="Module Groups"
          value={groups.length}
          icon={Layers}
          accentColor="#8B5CF6"
        />
      </div>

      {noData ? (
        <PaGlassCard className="p-12 text-center">
          <div className="flex flex-col items-center justify-center gap-4">
            <AlertCircle size={40} className="text-slate-400" />
            <div className="text-slate-800 font-bold">Nothing staged right now</div>
            <div className="text-slate-500 text-sm max-w-md">
              Approve reports from Data Collection Status, Submissions or Review & Corrections — they appear here, grouped by module.
              When they're ready, press "Send all items" once and ALL of them go to the Business Unit together as one package. Items
              already sent are removed from this view.
            </div>
            <PaButton variant="primary" size="sm" onClick={() => navigate("submissions")}>
              Go to Submissions
            </PaButton>
          </div>
        </PaGlassCard>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <PaGlassCard key={group.id} strong>
              <div
                className="px-5 py-3.5 border-b border-slate-200/60 flex items-center justify-between"
                style={{ backgroundColor: `${group.accent}14` }}
              >
                <div className="flex items-center gap-2.5">
                  <group.icon size={18} style={{ color: group.accent }} />
                  <div>
                    <div className="font-bold text-[#202938] text-sm">{group.label} — Approved Dataset</div>
                    <div className="text-[10px] font-semibold text-slate-500">
                      {group.children.length} step{group.children.length === 1 ? "" : "s"} below
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-[#202938] text-lg">{group.children.reduce((s, c) => s + c.items.length, 0)}</div>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">items</div>
                </div>
              </div>
              <div className="p-3">
                {group.children.length === 0 ? (
                  <div className="px-4 py-3 text-[11px] text-slate-400">No approved items in this group</div>
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200/60 text-[#64748B] font-bold uppercase tracking-wider text-[11px]">
                        <th className="p-3 pl-4">Step / Ref & Title</th>
                        <th className="p-3">Period</th>
                        <th className="p-3">Metric</th>
                        <th className="p-3">Contributor</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {group.children.map((child) =>
                        child.items.map((item) => (
                          <tr key={`${child.id}:${item.id}`} className="hover:bg-blue-50/20 transition-colors group">
                            <td className="p-3 pl-4">
                              <div className="flex items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[9px] font-bold tracking-wider" style={{ color: group.accent, borderColor: group.accent }}>
                                  {child.label}
                                </span>
                                <span className="font-mono text-[#315CFF] font-bold text-[11px]">{item.reportCode}</span>
                              </div>
                              <div className="font-bold text-[#202938] text-sm mt-0.5">{item.title}</div>
                              {item.latestReviewComment && (
                                <div className="text-[10.5px] text-slate-500 line-clamp-1 mt-0.5 italic">
                                  "{item.latestReviewComment}"
                                </div>
                              )}
                              <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-600 mt-1">
                                <Clock size={11} className="text-blue-500 shrink-0" />
                                <span>{item.formattedDateTime || new Date(item.submissionDate).toLocaleString()}</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-bold text-[11px]">
                                {item.period}
                              </span>
                            </td>
                            <td className="p-3">
                              {item.metricValue ? (
                                <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                                  {item.metricValue}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                              {item.parsedValues && item.parsedValues.length > 0 && (
                                <div className="text-[10px] text-blue-600 mt-1 font-semibold">
                                  {item.parsedValues.length} fields
                                </div>
                              )}
                              {item.evidenceList && item.evidenceList.length > 0 && (
                                <div className="flex items-center gap-1 text-[10px] text-emerald-700 font-bold mt-1">
                                  <span>{item.evidenceList.length} docs</span>
                                </div>
                              )}
                            </td>
                            <td className="p-3">
                              <div className="flex flex-col gap-1">
                                <span className="font-bold text-[#202938] text-sm">{item.submitterName}</span>
                                <span className="text-[10px] text-slate-500 font-mono truncate max-w-[120px]">{item.submitterEmail}</span>
                              </div>
                            </td>
                            <td className="p-3">
                              {item.forwardedToBu ? (
                                <div className="flex items-center gap-1.5">
                                  <PaStatusBadge status="APPROVED" />
                                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                    Forwarded
                                  </span>
                                </div>
                              ) : (
                                <PaStatusBadge status="APPROVED" />
                              )}
                              {item.forwardedToBuAt && (
                                <div className="text-[9px] text-slate-400 mt-0.5">
                                  {new Date(item.forwardedToBuAt).toLocaleDateString("en-GB")}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </PaGlassCard>
          ))}
        </div>
      )}

      {/* Confirm forward modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="glass rounded-2xl p-6 w-full max-w-lg">
            <h3 className="text-lg font-bold text-[#202938] mb-2">Send to Business Unit</h3>
            <p className="text-sm text-slate-600 mb-4">
              All {pendingForward} staged approved submission{pendingForward === 1 ? "" : "s"} will be delivered to the Business Unit AT ONCE as a single consolidated package — not one by one.
              The BU sees them grouped under this project's name and can open the package to review every report inside. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <PaButton variant="secondary" onClick={() => setConfirmOpen(false)}>Cancel</PaButton>
              <PaButton
                variant="primary"
                onClick={handleForwardToBu}
                disabled={actionLoading}
                className="bg-gradient-to-r from-[#315CFF] to-[#6542F5]"
              >
                {actionLoading ? "Submitting…" : "Confirm Submit"}
              </PaButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
