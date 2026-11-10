"use client";

// ── SCREEN 08 — Roles & Permissions (People & Access) ──
import { useMemo, useState } from "react";
import { Check, Info, RotateCcw, Save, ShieldCheck, Users as UsersIcon } from "lucide-react";
import { Ring } from '@/components/ring'
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, type RolesData } from "@/lib/esg/types";
import { useApi, useMutation } from "@/lib/esg/client";
import { useToast } from "@/hooks/use-toast";
import {
  Chip,
  GlassCard,
  LoadingBlock,
  PageHeader,
  SectionCard,
} from "@/components/workspace/ui";

/** Local PUT helper (shared client has no apiPut) — mirrors its error contract. */
async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

/** Client-side default permission pattern (mirrors server defaults). */
function defaultMatrix(role: string): Record<string, boolean> {
  const perms = [
    "View", "Create", "Edit", "Submit", "Review", "Approve", "Reject", "Reopen",
    "Export", "Assign tasks", "Manage users", "Manage organizations", "Configure workflows", "View audit history", "Manage global settings",
  ];
  const m: Record<string, boolean> = {};
  for (const p of perms) m[p] = false;
  const set = (...ps: string[]) => ps.forEach((p) => (m[p] = true));
  switch (role) {
    case "GROUP_ADMIN":
      set(...perms);
      break;
    case "SUBSIDIARY_MANAGER":
      set("View", "Review", "Approve", "Reject", "Export", "View audit history");
      break;
    case "SUBSIDIARY_ADMIN":
      set("View", "Create", "Edit", "Submit", "Review", "Approve", "Reject", "Export", "Assign tasks", "Manage users");
      break;
    case "BU_MANAGER":
      set("View", "Review", "Export");
      break;
    case "BU_ADMIN":
      set("View", "Create", "Edit", "Assign tasks");
      break;
    default:
      set("View", "Create", "Edit", "Submit");
  }
  return m;
}

export default function RolesView() {
  const { toast } = useToast();
  const rolesApi = useApi<RolesData>("/api/esg/roles");
  const saveMut = useMutation<{ success: boolean; message: string }>();

  const [selectedId, setSelectedId] = useState<string>("GROUP_ADMIN");
  // Local edits keyed by role — fall back to the saved matrix so no sync effect is needed.
  const [drafts, setDrafts] = useState<Record<string, Record<string, boolean>>>({});

  const roles = rolesApi.data?.roles ?? [];
  const permissions = rolesApi.data?.permissions ?? [];
  const matrix = rolesApi.data?.matrix ?? {};

  const selectedRole = roles.find((r) => r.id === selectedId) ?? null;
  const base = matrix[selectedId] ?? {};
  const draft = drafts[selectedId] ?? base;

  const dirty = useMemo(
    () => permissions.some((p) => (draft[p] ?? false) !== (base[p] ?? false)),
    [draft, base, permissions]
  );

  const groups = useMemo(() => {
    const out: { group: string; roles: typeof roles }[] = [];
    for (const r of roles) {
      const g = out.find((x) => x.group === r.group);
      if (g) g.roles.push(r);
      else out.push({ group: r.group, roles: [r] });
    }
    return out;
  }, [roles]);

  const toggle = (p: string, v: boolean) =>
    setDrafts((d) => ({ ...d, [selectedId]: { ...(d[selectedId] ?? base), [p]: v } }));

  const save = async () => {
    if (!rolesApi.data) return;
    const nextMatrix = { ...rolesApi.data.matrix, [selectedId]: draft };
    const res = await saveMut.run(() => apiPut("/api/esg/roles", { matrix: nextMatrix }));
    if (res) {
      toast({ title: "Permissions saved", description: res.message ?? "Permission matrix saved." });
      setDrafts((d) => {
        const n = { ...d };
        delete n[selectedId];
        return n;
      });
      await rolesApi.refetch();
    } else {
      toast({ title: "Save failed", description: saveMut.error ?? "Server rejected the matrix.", variant: "destructive" });
    }
  };

  const resetDefaults = () => {
    setDrafts((d) => ({ ...d, [selectedId]: defaultMatrix(selectedId) }));
    toast({ title: "Reset to defaults", description: `${ROLE_LABELS[selectedId] ?? selectedId} restored to the platform default pattern. Save to persist.` });
  };

  if (rolesApi.loading) {
    return (
      <div className="view-in space-y-5">
        <PageHeader title="Roles & Permissions" icon={ShieldCheck} breadcrumbs={["Group", "People & Access", "Roles & Permissions"]} />
        <GlassCard><LoadingBlock rows={8} label="Loading permission matrix…" /></GlassCard>
      </div>
    );
  }
  if (rolesApi.error) {
    return (
      <div className="view-in space-y-5">
        <PageHeader title="Roles & Permissions" icon={ShieldCheck} breadcrumbs={["Group", "People & Access", "Roles & Permissions"]} />
        <GlassCard><LoadingBlock rows={1} label={rolesApi.error} /></GlassCard>
      </div>
    );
  }

  return (
    <div className="view-in space-y-5">
      <PageHeader
        title="Roles & Permissions"
        description="Permission matrix for the 11 defined role types. Changes are enforced server-side for new requests."
        icon={ShieldCheck}
        breadcrumbs={["Group", "People & Access", "Roles & Permissions"]}
      />

      {/* Info banner */}
      <div className="glass-subtle flex items-start gap-3 rounded-2xl border-[rgba(58,123,255,0.25)] px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#1d5fd6]" />
        <p className="text-[13px] leading-relaxed text-[color:var(--ink-soft)]">
          Permission changes are persisted and recorded in the audit log. Server-side enforcement applies to new requests.
        </p>
      </div>

      {/* Role summary strip */}
      <SectionCard title="11 role types" description="Users currently holding each role across the group." icon={UsersIcon}>
        <div className="flex flex-wrap gap-2">
          {roles.map((r) => (
            <button key={r.id} onClick={() => setSelectedId(r.id)} className={cn("rounded-2xl transition-all", selectedId === r.id && "nav-active")} aria-label={`Select role ${r.label}`}>
              <Chip tone={selectedId === r.id ? "blue" : "gray"} className="h-auto py-1.5">
                {r.label}
                <span className="tabular ml-1 rounded-full bg-black/5 px-1.5 text-[10px] font-semibold">{r.userCount}</span>
              </Chip>
            </button>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-5 xl:grid-cols-5">
        {/* Left: role list */}
        <div className="xl:col-span-2">
          <SectionCard title="Role groups" description="Select a role to edit its permission set." noPad>
            <div className="nice-scroll max-h-[560px] overflow-y-auto p-3">
              {groups.map((g, gi) => (
                <div key={g.group}>
                  {gi > 0 && <Separator className="my-3 bg-[rgba(125,177,216,0.25)]" />}
                  <div className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--ink-faint)]">{g.group}</div>
                  <div className="flex flex-col gap-1">
                    {g.roles.map((r) => (
                      <button
                        key={r.id}
                        role="button"
                        aria-pressed={selectedId === r.id}
                        onClick={() => setSelectedId(r.id)}
                        className={cn(
                          "flex items-start justify-between gap-3 rounded-2xl px-3 py-2.5 text-left transition-all",
                          selectedId === r.id ? "nav-active" : "hover:bg-white/60"
                        )}
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-[color:var(--ink)]">{r.label}</div>
                          {r.description && <div className="mt-0.5 line-clamp-2 text-xs text-[color:var(--ink-faint)]">{r.description}</div>}
                        </div>
                        <span className="tabular mt-0.5 shrink-0 rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-semibold text-[color:var(--ink-soft)]">
                          {r.userCount}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* Right: permission editor */}
        <div className="xl:col-span-3">
          <SectionCard
            title={selectedRole ? `${selectedRole.label} — permissions` : "Permissions"}
            description={selectedRole?.description}
            icon={ShieldCheck}
            noPad
          >
            {permissions.length === 0 ? (
              <LoadingBlock rows={5} />
            ) : (
              <>
                <div className="nice-scroll max-h-[430px] overflow-y-auto px-5 py-4">
                  <div className="flex flex-col gap-1">
                    {permissions.map((p) => (
                      <div key={p} className="flex items-center justify-between gap-4 rounded-2xl px-2 py-2.5 hover:bg-white/50">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-[color:var(--ink)]">{p}</div>
                          <div className="text-xs text-[color:var(--ink-faint)]">
                            {(draft[p] ?? false)
                              ? `Allows ${p.toLowerCase()} within this role's scope.`
                              : `No ${p.toLowerCase()} capability.`}
                          </div>
                        </div>
                        <Switch
                          checked={draft[p] ?? false}
                          onCheckedChange={(v) => toggle(p, v)}
                          aria-label={`${p} for ${selectedRole?.label ?? selectedId}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t border-[rgba(125,177,216,0.3)] bg-white/70 px-5 py-3.5 backdrop-blur-md">
                  <div className="text-xs text-[color:var(--ink-faint)]">
                    {dirty ? (
                      <span className="inline-flex items-center gap-1.5 font-medium text-[#9c5d1b]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#c57926]" /> Unsaved changes
                      </span>
                    ) : (
                      "All changes saved"
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="glass-subtle rounded-2xl border-white/60" onClick={resetDefaults}>
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset to defaults
                    </Button>
                    <Button size="sm" className="rounded-2xl" onClick={() => void save()} disabled={saveMut.pending}>
                      {saveMut.pending ? <Ring className="mr-1.5 h-3.5 w-3.5" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                      Save permissions
                    </Button>
                  </div>
                </div>
              </>
            )}
          </SectionCard>
        </div>
      </div>

      {/* Matrix overview (read-only) */}
      <SectionCard
        title="Matrix overview"
        description="All roles × all permissions. A dot marks an enabled capability for the role."
        icon={Check}
        noPad
      >
        <div className="nice-scroll max-h-[420px] overflow-auto px-1 py-1">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="[&>th]:border-b [&>th]:border-[rgba(125,177,216,0.35)] [&>th]:px-3 [&>th]:py-2.5 [&>th]:text-left">
                <th className="sticky left-0 z-10 bg-white/80 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--ink-faint)] backdrop-blur">Permission</th>
                {roles.map((r) => (
                  <th key={r.id} className="text-[11px] font-semibold text-[color:var(--ink-soft)]">
                    <span className="block max-w-[92px] leading-tight">{r.label}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {permissions.map((p) => (
                <tr key={p} className="[&>td]:border-b [&>td]:border-[rgba(125,177,216,0.14)] [&>td]:px-3 [&>td]:py-2 hover:bg-[rgba(58,123,255,0.04)]">
                  <td className="sticky left-0 z-10 bg-white/80 text-[13px] font-medium text-[color:var(--ink)] backdrop-blur">{p}</td>
                  {roles.map((r) => (
                    <td key={r.id} className="text-center">
                      {matrix[r.id]?.[p] ? (
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(35,134,83,0.14)]" title={`${p} enabled`}>
                          <Check className="h-3 w-3 text-[#1d6b40]" />
                        </span>
                      ) : (
                        <span className="inline-block h-1 w-1 rounded-full bg-[rgba(102,119,141,0.3)]" title={`${p} disabled`} />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
