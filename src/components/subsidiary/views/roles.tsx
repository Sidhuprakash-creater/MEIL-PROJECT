"use client";

// ── SUBSIDIARY ADMIN · SCREEN 06 — Roles & Access (governance reference) ──
// Read-mostly: role catalogue, effective permission matrix, assignment gaps
// and the audited permission-change history. No dangerous controls here —
// every grant below is enforced server-side by the /api/sa/* guards.
import { useMemo, useState } from "react";
import {
  ArrowRight, Check, CheckCircle2, Info, KeyRound, Minus, ShieldCheck, Users,
} from "lucide-react";
import { PeopleIcon, ShieldIcon } from "@/components/workspace/premium-icons";
import { Button } from "@/components/ui/button";
import { useSaWorkspace, VIEW_META } from "@/lib/sa/store";
import type { SaViewId } from "@/lib/sa/types";
import { ROLE_LABELS } from "@/lib/sa/types";
import { timeAgo, useSaApi } from "@/lib/sa/client";
import type { RolesData } from "@/lib/sa/types";
import {
  Chip, EmptyState, ErrorState, GlassCard, LoadingBlock, PageHeader, SectionCard, ExportButton,
} from "@/components/workspace/ui";

/* Roles rendered as matrix columns (the six core operating roles). */
const MATRIX_ROLES = [
  "GROUP_ADMIN", "ORG_MANAGER", "SUBSIDIARY_ADMIN", "SUBSIDIARY_MANAGER", "BU_MANAGER", "BU_ADMIN",
] as const;
const MATRIX_ROLE_SHORT: Record<string, string> = {
  GROUP_ADMIN: "Group Admin",
  ORG_MANAGER: "Org Manager",
  SUBSIDIARY_ADMIN: "Subsidiary Admin",
  SUBSIDIARY_MANAGER: "Subsidiary Manager",
  BU_MANAGER: "BU Manager",
  BU_ADMIN: "BU Admin",
};

/* Which views of THIS subsidiary workspace each role is exposed to. */
const ROLE_WORKSPACE_VIEWS: Record<string, SaViewId[]> = {
  SUBSIDIARY_ADMIN: [
    "dashboard", "notifications", "units", "projects", "users", "roles", "timelines",
    "submissions", "monitoring", "evidence", "comms", "esg", "validation", "analytics", "activity", "settings",
  ],
  SUBSIDIARY_MANAGER: ["dashboard", "notifications", "submissions", "monitoring", "evidence", "validation", "analytics", "activity"],
  BU_MANAGER: ["dashboard", "notifications", "timelines", "submissions", "evidence", "analytics"],
  BU_ADMIN: ["notifications", "submissions", "evidence"],
  ENV_DATA_USER: ["notifications", "submissions", "evidence"],
  FIN_RESOURCE_USER: ["notifications", "submissions", "evidence"],
  HR_USER: ["notifications", "submissions", "evidence"],
  EHS_USER: ["notifications", "submissions", "evidence"],
  PROCUREMENT_USER: ["notifications", "submissions", "evidence"],
  CSR_USER: ["notifications", "submissions", "evidence"],
  COMPLIANCE_USER: ["notifications", "submissions", "evidence"],
  GROUP_ADMIN: [],
  ORG_MANAGER: [],
};

function GrantBadge({ grant }: { grant: "full" | "own" | "none" }) {
  if (grant === "full") {
    return (
      <Chip tone="green" className="gap-1">
        <Check className="h-3 w-3" aria-hidden /> Full
      </Chip>
    );
  }
  if (grant === "own") {
    return (
      <Chip tone="blue">Own scope</Chip>
    );
  }
  return (
    <Chip tone="gray" className="gap-1">
      <Minus className="h-3 w-3" aria-hidden /> None
    </Chip>
  );
}

export default function RolesView() {
  const { navigate } = useSaWorkspace();
  const { data, loading, error, refetch } = useSaApi<RolesData>("/api/sa/roles");

  const [selected, setSelected] = useState<string>("SUBSIDIARY_ADMIN");

  const activeRole = useMemo(
    () => data?.roles.find((r) => r.role === selected) ?? data?.roles[0] ?? null,
    [data, selected]
  );

  if (loading && !data) return <LoadingBlock rows={6} label="Loading role & access governance…" />;
  if (error && !data) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  const matrixRows = data.matrix.map((m) => ({
    Capability: m.label,
    ...Object.fromEntries(MATRIX_ROLES.map((r) => [MATRIX_ROLE_SHORT[r], m.grants[r] ?? "none"])),
  }));

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="Roles & Access"
        description="Governance reference for your subsidiary — role definitions, the effective permission matrix and audited access changes. Read-only by design."
        icon={ShieldIcon}
      />

      {/* prominent policy banner */}
      <GlassCard strong className="flex items-start gap-3 p-4 sm:items-center">
        <span className="glass-subtle flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl">
          <ShieldCheck className="h-5 w-5 text-[#1d6b40]" />
        </span>
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold text-[color:var(--ink)]">
            Subsidiary Admins can never create Group Admin accounts or alter Group policies — enforced server-side.
          </p>
          <p className="mt-0.5 text-[12px] text-[color:var(--ink-faint)]">
            Every attempt outside your subsidiary scope is refused with a 403 and written to the audit trail.
          </p>
        </div>
        <Chip tone="green" className="ml-auto hidden shrink-0 sm:inline-flex">Policy</Chip>
      </GlassCard>

      {/* ── role catalogue (left) + selected role detail (right) ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <GlassCard className="flex flex-col p-4">
          <div className="mb-3 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">
            <KeyRound className="h-4 w-4 text-[color:var(--esg-blue)]" /> Role catalogue
            <Chip tone="gray" className="ml-auto">{data.roles.length}</Chip>
          </div>
          <div className="nice-scroll max-h-[520px] space-y-2 overflow-y-auto pr-0.5" role="listbox" aria-label="Roles">
            {data.roles.map((r) => {
              const active = r.role === activeRole?.role;
              return (
                <button
                  key={r.role}
                  role="option"
                  aria-selected={active}
                  onClick={() => setSelected(r.role)}
                  className={`w-full rounded-2xl border px-3 py-2.5 text-left transition-all duration-200 hover:-translate-y-px hover:bg-white/80 ${
                    active
                      ? "border-[rgba(58,123,255,0.45)] bg-white/85 shadow-[0_10px_26px_rgba(56,113,153,0.14)]"
                      : "border-transparent glass-subtle"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] font-semibold text-[color:var(--ink)]">{r.label}</span>
                    <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-[color:var(--ink-faint)]">
                      <Users className="h-3 w-3" aria-hidden /> {r.userCount}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {r.assignable ? (
                      <Chip tone="green">Assignable</Chip>
                    ) : (
                      <Chip tone="gray">Group office only</Chip>
                    )}
                    {r.role === "SUBSIDIARY_ADMIN" && <Chip tone="blue">You</Chip>}
                  </div>
                </button>
              );
            })}
          </div>
        </GlassCard>

        <div className="space-y-4 lg:col-span-2">
          {activeRole && (
            <SectionCard
              title={activeRole.label}
              description={activeRole.description}
              icon={PeopleIcon}
            >
              <div className="space-y-4">
                <div>
                  <h3 className="mb-2 text-[12px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">
                    Effective permissions
                  </h3>
                  <ul className="grid gap-1.5 sm:grid-cols-2">
                    {activeRole.permissions.map((p) => (
                      <li key={p} className="flex items-start gap-2 rounded-2xl px-2 py-1.5 text-[13px] text-[color:var(--ink-soft)] transition-colors hover:bg-white/60">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#238653]" aria-hidden />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="mb-2 text-[12px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">
                    Exposed in this workspace
                  </h3>
                  {(ROLE_WORKSPACE_VIEWS[activeRole.role] ?? []).length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {(ROLE_WORKSPACE_VIEWS[activeRole.role] ?? []).map((v) => (
                        <button
                          key={v}
                          onClick={() => navigate(v)}
                          className="rounded-full border border-[rgba(58,123,255,0.28)] bg-[rgba(58,123,255,0.1)] px-2.5 py-1 text-[11px] font-medium text-[#1d5fd6] transition-all hover:-translate-y-px hover:bg-[rgba(58,123,255,0.18)]"
                        >
                          {VIEW_META[v].title}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="flex items-center gap-2 text-[12.5px] text-[color:var(--ink-faint)]">
                      <Info className="h-3.5 w-3.5" aria-hidden />
                      {activeRole.label} operates from the Group Admin console — its screens are not exposed inside this subsidiary workspace.
                    </p>
                  )}
                </div>
              </div>
            </SectionCard>
          )}
        </div>
      </div>

      {/* ── permission matrix ── */}
      <SectionCard
        title="Permission matrix"
        description="Capabilities × core roles. “Own scope” = restricted to your subsidiary / assigned organisation. Enforced per API guard."
        icon={ShieldIcon}
        actions={<ExportButton filename="subsidiary-permission-matrix" rows={matrixRows} />}
      >
        <div className="nice-scroll overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="[&>th]:border-b [&>th]:border-[rgba(125,177,216,0.35)] [&>th]:px-3 [&>th]:py-2.5 [&>th]:text-left [&>th]:text-[11px] [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-wide [&>th]:text-[color:var(--ink-faint)]">
                <th>Capability</th>
                {MATRIX_ROLES.map((r) => (
                  <th
                    key={r}
                    className={
                      r === "SUBSIDIARY_ADMIN"
                        ? "!text-[#1d5fd6] !bg-[rgba(58,123,255,0.08)] text-center"
                        : "text-center"
                    }
                  >
                    {MATRIX_ROLE_SHORT[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.matrix.map((m) => (
                <tr key={m.capability} className="[&>td]:border-b [&>td]:border-[rgba(125,177,216,0.16)] [&>td]:px-3 [&>td]:py-2.5 last:[&>td]:border-0">
                  <td className="text-[13px] font-medium text-[color:var(--ink)]">{m.label}</td>
                  {MATRIX_ROLES.map((r) => (
                    <td
                      key={r}
                      className={`text-center ${r === "SUBSIDIARY_ADMIN" ? "bg-[rgba(58,123,255,0.06)]" : ""}`}
                    >
                      <GrantBadge grant={m.grants[r] ?? "none"} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-[color:var(--ink-faint)]">
          <Info className="h-3.5 w-3.5" aria-hidden />
          The highlighted column is your own role. Report approval decisions belong to the Subsidiary Manager — not to this workspace.
        </p>
      </SectionCard>

      {/* ── assignment gaps + permission-change history ── */}
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          title="Assignment gaps"
          description="Active users whose role expects a business-unit scope but has none."
          icon={PeopleIcon}
          actions={
            <Button
              variant="ghost"
              size="sm"
              className="h-7 rounded-xl text-xs"
              onClick={() => navigate("users")}
            >
              Open User Management <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          }
        >
          {data.assignmentGaps.length === 0 ? (
            <EmptyState
              title="No assignment gaps"
              message="Every active BU-scoped user is attached to a business unit."
            />
          ) : (
            <div className="nice-scroll max-h-[320px] space-y-2 overflow-y-auto pr-0.5">
              {data.assignmentGaps.map((g) => (
                <div
                  key={g.userId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl px-3 py-2.5 transition-colors hover:bg-white/70"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-[color:var(--ink)]">{g.name}</div>
                    <div className="truncate text-[11.5px] text-[color:var(--ink-faint)]">
                      {ROLE_LABELS[g.role] ?? g.role} · {g.missing}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="glass-subtle h-8 shrink-0 rounded-2xl border-white/60 text-xs"
                    onClick={() => navigate("users", { q: g.name })}
                  >
                    Open User Management <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Permission-change history"
          description="Audited role & access events (top 12)."
          icon={KeyRound}
        >
          {data.changeHistory.length === 0 ? (
            <EmptyState
              title="No access changes recorded"
              message="Role grants and revocations will appear here as they happen."
            />
          ) : (
            <div className="nice-scroll max-h-[320px] space-y-2 overflow-y-auto pr-0.5">
              {data.changeHistory.map((a) => (
                <div key={a.id} className="flex items-start gap-2.5 rounded-2xl px-2 py-2 transition-colors hover:bg-white/60">
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: a.outcome === "FAILURE" || a.outcome === "DENIED" ? "#c34a4a" : "#238653" }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] text-[color:var(--ink)]">
                      <strong className="font-semibold">{a.actorName}</strong> · {a.action.replaceAll("_", " ").toLowerCase()}
                      {a.targetLabel && <span className="text-[color:var(--ink-soft)]"> — {a.targetLabel}</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 text-[10.5px] text-[color:var(--ink-faint)]">
                      <span>{timeAgo(a.createdAt)}</span>
                      <span>· {a.actorRole.replaceAll("_", " ").toLowerCase()}</span>
                      {a.outcome && <Chip tone={a.outcome === "FAILURE" || a.outcome === "DENIED" ? "red" : "green"} className="px-1.5 py-0">{a.outcome}</Chip>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
