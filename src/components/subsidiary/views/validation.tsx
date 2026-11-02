"use client";

// ── SUBSIDIARY ADMIN · Data Validation ──────────────────────────────────
// Correction workflow for data-quality issues. "Mark resolved" runs REAL
// server-side revalidation — refusals (e.g. "Linked submission still has no
// evidence attached…") surface verbatim in an inline amber alert + toast.
// Success is never faked.

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ArrowRight, CheckCircle2, History, Loader2, MoreHorizontal, UserPlus,
} from "lucide-react";
import { AlarmAlertIcon, CheckSealIcon, UserPlusIcon } from "@/components/workspace/premium-icons";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  Chip, Column, DataTable, ErrorState, ExportButton, Field, GlassCard, GlassDialog,
  InfoRow, LoadingBlock, PageHeader, KpiCard, StatusBadge, Toolbar,
} from "@/components/workspace/ui";
import { useSaWorkspace } from "@/lib/sa/store";
import { apiPatch, fmtDate, fmtDateTime, useMutation, useSaApi } from "@/lib/sa/client";
import { VALIDATION_RULE_LABELS } from "@/lib/sa/types";
import type { UnitRow, UserRow, ValidationRow } from "@/lib/sa/types";

type ValidationResp = {
  issues: ValidationRow[];
  total: number;
  summary: { open: number; critical: number; assigned: number; resolved: number };
};
type UnitsResp = { units: UnitRow[]; total: number };
type UsersResp = { users: UserRow[]; total: number };

/* task-specified severity tones (MEDIUM reads blue here, not amber) */
const SEV_TONE: Record<string, "red" | "amber" | "blue" | "gray"> = {
  CRITICAL: "red", HIGH: "amber", MEDIUM: "blue", LOW: "gray",
};
const SEV_RANK: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export default function ValidationView() {
  const { params, navigate } = useSaWorkspace();
  const { toast } = useToast();
  const { data, loading, error, refetch } = useSaApi<ValidationResp>("/api/sa/validation?pageSize=50");
  const { data: unitsData } = useSaApi<UnitsResp>("/api/sa/units?pageSize=50");

  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState(() => (typeof params.severity === "string" ? params.severity : "ALL"));
  const [statusFilter, setStatusFilter] = useState(() => (typeof params.statusFilter === "string" ? params.statusFilter : "ALL"));
  const [buFilter, setBuFilter] = useState("ALL");

  const [assignTarget, setAssignTarget] = useState<ValidationRow | null>(null);
  const [assignOwner, setAssignOwner] = useState("");
  const [assignError, setAssignError] = useState<string | null>(null);
  const [resolveTarget, setResolveTarget] = useState<ValidationRow | null>(null);
  const [resolveNote, setResolveNote] = useState("");
  const [historyTarget, setHistoryTarget] = useState<ValidationRow | null>(null);

  const assignMut = useMutation();
  const resolveMut = useMutation();

  /* assign dialog needs the subsidiary directory — loaded only while open */
  const { data: usersData, loading: usersLoading } = useSaApi<UsersResp>(
    assignTarget ? "/api/sa/users?pageSize=50" : null
  );

  /* deep-link params (severity/statusFilter from other consoles' KPI clicks):
     seeded on mount via the lazy initializers above, re-applied here when
     params change while the view is already mounted, then cleared via the store. */
  const [prevParams, setPrevParams] = useState(params);
  if (params !== prevParams) {
    setPrevParams(params);
    if (typeof params.severity === "string") setSeverity(params.severity);
    if (typeof params.statusFilter === "string") setStatusFilter(params.statusFilter);
  }
  useEffect(() => {
    if (params.severity !== undefined || params.statusFilter !== undefined) navigate("validation");
  }, [params, navigate]);

  useEffect(() => {
    if (assignMut.error) toast({ title: "Assignment failed", description: assignMut.error, variant: "destructive" });
  }, [assignMut.error, toast]);
  useEffect(() => {
    if (resolveMut.error) toast({ title: "Resolution refused", description: resolveMut.error, variant: "destructive" });
  }, [resolveMut.error, toast]);

  const issues = data?.issues ?? [];
  const units = unitsData?.units ?? [];

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const buName = buFilter === "ALL" ? null : units.find((u) => u.id === buFilter)?.name ?? null;
    return issues.filter((r) => {
      if (severity !== "ALL" && r.severity !== severity) return false;
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (buName && r.buName !== buName) return false;
      if (q && ![r.ref, r.description, r.submissionRef, r.rule, r.ownerName, r.responsibleName]
        .join(" ").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [issues, search, severity, statusFilter, buFilter, units]);

  const exportRows = useMemo(
    () =>
      rows.map((r) => ({
        ref: r.ref,
        severity: r.severity,
        rule: VALIDATION_RULE_LABELS[r.rule] ?? r.rule,
        description: r.description,
        org: [r.buName, r.projectName].filter(Boolean).join(" · ") || "—",
        submissionRef: r.submissionRef || "—",
        responsible: r.ownerName || r.responsibleName || "—",
        status: r.status,
        detected: fmtDate(r.detectedAt),
        resolved: r.resolvedAt ? fmtDate(r.resolvedAt) : "—",
        resolutionNote: r.resolveNote || "",
      })),
    [rows]
  );

  const openAssign = (row: ValidationRow) => {
    setAssignTarget(row);
    setAssignOwner(row.ownerName || "");
    setAssignError(null);
    assignMut.reset();
  };

  const openResolve = (row: ValidationRow) => {
    setResolveTarget(row);
    setResolveNote("");
    resolveMut.reset();
  };

  const submitAssign = async () => {
    if (!assignTarget) return;
    if (!assignOwner) {
      setAssignError("Choose a correction owner.");
      return;
    }
    const res = await assignMut.run(() =>
      apiPatch(`/api/sa/validation/${assignTarget.id}`, { action: "assign", ownerName: assignOwner })
    );
    if (!res) return; // failure toast via effect, verbatim server message
    toast({ title: "Correction owner assigned", description: `${assignTarget.ref} → ${assignOwner}` });
    setAssignTarget(null);
    refetch();
  };

  const submitResolve = async () => {
    if (!resolveTarget) return;
    const res = await resolveMut.run(() =>
      apiPatch(`/api/sa/validation/${resolveTarget.id}`, {
        action: "resolve",
        note: resolveNote.trim() || undefined,
      })
    );
    if (!res) return; // 409s stay visible in the dialog's amber alert — never faked success
    toast({ title: "Issue resolved", description: `${resolveTarget.ref} passed server-side revalidation.` });
    setResolveTarget(null);
    refetch();
  };

  if (loading && !data) return <div className="view-in space-y-4 pb-6"><LoadingBlock rows={6} label="Loading validation issues…" /></div>;
  if (error && !data) return <div className="view-in space-y-4 pb-6"><ErrorState message={error} onRetry={refetch} /></div>;

  const summary = data?.summary ?? { open: 0, critical: 0, assigned: 0, resolved: 0 };

  const columns: Column<ValidationRow>[] = [
    {
      key: "ref",
      header: "Ref",
      sortable: true,
      sortValue: (r) => r.ref,
      render: (r) => <span className="font-mono text-[12px] font-medium text-[color:var(--ink-soft)]">{r.ref}</span>,
    },
    {
      key: "severity",
      header: "Severity",
      sortable: true,
      sortValue: (r) => SEV_RANK[r.severity] ?? 9,
      render: (r) => <Chip tone={SEV_TONE[r.severity] ?? "gray"}>{r.severity}</Chip>,
    },
    {
      key: "rule",
      header: "Rule",
      render: (r) => <span className="text-[12.5px]">{VALIDATION_RULE_LABELS[r.rule] ?? r.rule}</span>,
    },
    {
      key: "description",
      header: "Description",
      className: "max-w-64",
      render: (r) => <span className="line-clamp-2 text-[12.5px] leading-snug">{r.description}</span>,
    },
    {
      key: "org",
      header: "Org",
      render: (r) => <span className="text-[12.5px]">{[r.buName, r.projectName].filter(Boolean).join(" · ") || "—"}</span>,
    },
    {
      key: "submissionRef",
      header: "Linked record",
      render: (r) =>
        r.submissionRef ? (
          <Button
            variant="outline"
            size="sm"
            className="glass-subtle h-7 rounded-xl border-white/60 px-2.5 font-mono text-[11px]"
            onClick={() => navigate("submissions", { ref: r.submissionRef })}
          >
            {r.submissionRef}
            <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        ) : (
          <span className="text-[color:var(--ink-faint)]">—</span>
        ),
    },
    {
      key: "owner",
      header: "Responsible",
      render: (r) => <span className="text-[12.5px]">{r.ownerName || r.responsibleName || "—"}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortValue: (r) => r.status,
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "detectedAt",
      header: "Detected",
      sortable: true,
      sortValue: (r) => r.detectedAt,
      render: (r) => <span className="whitespace-nowrap text-[12px]">{fmtDate(r.detectedAt)}</span>,
    },
  ];

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="Data Validation"
        description={`${data?.total ?? 0} issues tracked across your subsidiary · every resolution is revalidated server-side.`}
        icon={AlarmAlertIcon}
      />

      {/* KPI strip — each card applies its filter */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard
          label="Open"
          value={summary.open}
          icon={AlarmAlertIcon}
          tone="blue"
          hint="Awaiting correction"
          onClick={() => setStatusFilter("OPEN")}
        />
        <KpiCard
          label="Critical"
          value={summary.critical}
          icon={AlertTriangle}
          tone="red"
          hint="Critical severity, unresolved"
          onClick={() => { setSeverity("CRITICAL"); setStatusFilter("ALL"); }}
        />
        <KpiCard
          label="Assigned"
          value={summary.assigned}
          icon={UserPlusIcon}
          tone="amber"
          hint="With a correction owner"
          onClick={() => setStatusFilter("ASSIGNED")}
        />
        <KpiCard
          label="Resolved"
          value={summary.resolved}
          icon={CheckSealIcon}
          tone="green"
          hint="Passed server revalidation"
          onClick={() => setStatusFilter("RESOLVED")}
        />
      </div>

      <DataTable<ValidationRow>
        columns={columns}
        rows={rows}
        loading={loading && !data}
        error={data ? null : error}
        onRetry={refetch}
        pageSize={10}
        rowActions={(row) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" aria-label={`Actions for ${row.ref}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass-strong rounded-2xl border-white/70">
              <DropdownMenuItem onClick={() => openAssign(row)} disabled={row.status === "RESOLVED"}>
                <UserPlus className="mr-2 h-3.5 w-3.5" /> Assign correction owner
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openResolve(row)} disabled={row.status === "RESOLVED"}>
                <CheckCircle2 className="mr-2 h-3.5 w-3.5" /> Mark resolved
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setHistoryTarget(row)}>
                <History className="mr-2 h-3.5 w-3.5" /> View history
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        toolbar={
          <Toolbar
            search={search}
            onSearch={setSearch}
            searchPlaceholder="Search ref, description, submission…"
            filters={[
              {
                key: "severity",
                label: "Severity",
                value: severity,
                options: [
                  { value: "ALL", label: "All severities" },
                  { value: "CRITICAL", label: "Critical" },
                  { value: "HIGH", label: "High" },
                  { value: "MEDIUM", label: "Medium" },
                  { value: "LOW", label: "Low" },
                ],
                onChange: setSeverity,
              },
              {
                key: "status",
                label: "Status",
                value: statusFilter,
                options: [
                  { value: "ALL", label: "All statuses" },
                  { value: "OPEN", label: "Open" },
                  { value: "ASSIGNED", label: "Assigned" },
                  { value: "RESOLVED", label: "Resolved" },
                ],
                onChange: setStatusFilter,
              },
              {
                key: "bu",
                label: "BU",
                value: buFilter,
                options: [
                  { value: "ALL", label: "All business units" },
                  ...units.map((u) => ({ value: u.id, label: u.name })),
                ],
                onChange: setBuFilter,
              },
            ]}
            onReset={() => { setSearch(""); setSeverity("ALL"); setStatusFilter("ALL"); setBuFilter("ALL"); }}
            resultCount={rows.length}
            right={<ExportButton filename="validation-issues" rows={exportRows} />}
          />
        }
        mobileCard={(r) => (
          <GlassCard subtle className="p-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <Chip tone={SEV_TONE[r.severity] ?? "gray"}>{r.severity}</Chip>
              <StatusBadge status={r.status} />
              <span className="ml-auto font-mono text-[11px] text-[color:var(--ink-faint)]">{r.ref}</span>
            </div>
            <p className="mt-2 line-clamp-2 text-[12.5px] leading-snug text-[color:var(--ink-soft)]">{r.description}</p>
            <div className="mt-1 text-[11px] text-[color:var(--ink-faint)]">
              {VALIDATION_RULE_LABELS[r.rule] ?? r.rule} · {[r.buName, r.projectName].filter(Boolean).join(" · ") || "—"}
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-[color:var(--ink-faint)]">
              <span>Owner: {r.ownerName || r.responsibleName || "—"}</span>
              <span>{fmtDate(r.detectedAt)}</span>
            </div>
            <div className="mt-2.5 flex gap-2">
              {r.status !== "RESOLVED" && (
                <>
                  <Button variant="outline" size="sm" className="glass-subtle h-7 flex-1 rounded-xl border-white/60 text-[11px]" onClick={() => openAssign(r)}>
                    Assign
                  </Button>
                  <Button variant="outline" size="sm" className="glass-subtle h-7 flex-1 rounded-xl border-white/60 text-[11px]" onClick={() => openResolve(r)}>
                    Resolve
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" className="glass-subtle h-7 flex-1 rounded-xl border-white/60 text-[11px]" onClick={() => setHistoryTarget(r)}>
                History
              </Button>
            </div>
          </GlassCard>
        )}
        emptyTitle="No validation issues"
        emptyMessage={
          search || severity !== "ALL" || statusFilter !== "ALL" || buFilter !== "ALL"
            ? "Nothing matches the current filters — reset them to see every issue."
            : "Your subsidiary's data is clean — issues detected by the platform will appear here."
        }
      />

      {/* assign correction owner */}
      <GlassDialog
        open={!!assignTarget}
        onOpenChange={(o) => { if (!o) setAssignTarget(null); }}
        title="Assign correction owner"
        description={assignTarget ? `${assignTarget.ref} · ${VALIDATION_RULE_LABELS[assignTarget.rule] ?? assignTarget.rule}` : undefined}
        footer={
          <>
            <Button variant="outline" className="glass-subtle rounded-2xl border-white/60" onClick={() => setAssignTarget(null)} disabled={assignMut.pending}>
              Cancel
            </Button>
            <Button className="btn-action rounded-2xl" onClick={submitAssign} disabled={assignMut.pending}>
              {assignMut.pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Assign owner
            </Button>
          </>
        }
      >
        {assignTarget && (
          <div className="glass-subtle rounded-2xl p-3 text-[12.5px] leading-relaxed text-[color:var(--ink-soft)]">
            {assignTarget.description}
          </div>
        )}
        <div className="mt-3">
          <Field
            label="Correction owner"
            required
            error={assignError}
            hint={usersLoading ? "Loading your user directory…" : "The owner gets a platform notification to fix this issue."}
          >
            <Select
              value={assignOwner || undefined}
              onValueChange={(v) => { setAssignOwner(v); setAssignError(null); }}
            >
              <SelectTrigger className="glass-subtle rounded-2xl border-white/60 text-sm" aria-label="Correction owner">
                <SelectValue placeholder={usersLoading ? "Loading users…" : "Select a user"} />
              </SelectTrigger>
              <SelectContent className="glass-strong max-h-64 rounded-2xl border-white/70">
                {(usersData?.users ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.name}>
                    {u.name} — {u.roleLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        {assignMut.error && (
          <div className="mt-3 flex items-start gap-2.5 rounded-2xl border border-[rgba(197,121,38,0.35)] bg-[rgba(197,121,38,0.09)] p-3.5" role="alert">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#c57926]" />
            <p className="text-[12.5px] font-medium leading-relaxed text-[color:var(--ink-soft)]">{assignMut.error}</p>
          </div>
        )}
      </GlassDialog>

      {/* mark resolved — server revalidates; refusals shown truthfully */}
      <GlassDialog
        open={!!resolveTarget}
        onOpenChange={(o) => { if (!o) setResolveTarget(null); }}
        title="Mark issue resolved"
        description={resolveTarget ? `${resolveTarget.ref} · ${VALIDATION_RULE_LABELS[resolveTarget.rule] ?? resolveTarget.rule}` : undefined}
        footer={
          <>
            <Button variant="outline" className="glass-subtle rounded-2xl border-white/60" onClick={() => setResolveTarget(null)} disabled={resolveMut.pending}>
              Cancel
            </Button>
            <Button className="btn-action rounded-2xl" onClick={submitResolve} disabled={resolveMut.pending}>
              {resolveMut.pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Mark resolved
            </Button>
          </>
        }
      >
        {resolveTarget && (
          <div className="glass-subtle rounded-2xl p-3">
            <p className="text-[12.5px] font-medium leading-relaxed text-[color:var(--ink)]">{resolveTarget.description}</p>
            <p className="mt-1 text-[11.5px] text-[color:var(--ink-faint)]">
              Linked record {resolveTarget.submissionRef || "—"} · {[resolveTarget.buName, resolveTarget.projectName].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
        )}
        <div className="mt-3">
          <Field
            label="Resolution note"
            hint="Required for most issue types — the server revalidates for real before accepting a resolution."
          >
            <Textarea
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              rows={3}
              placeholder="What was corrected and how…"
              className="glass-subtle rounded-2xl border-white/60 text-sm"
              aria-label="Resolution note"
            />
          </Field>
        </div>
        {resolveMut.error && (
          <div className="mt-3 flex items-start gap-2.5 rounded-2xl border border-[rgba(197,121,38,0.35)] bg-[rgba(197,121,38,0.09)] p-3.5" role="alert">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#c57926]" />
            <div>
              <p className="text-[12.5px] font-bold text-[#9c5d1b]">Server refused this resolution</p>
              <p className="mt-0.5 text-[12.5px] font-medium leading-relaxed text-[color:var(--ink-soft)]">{resolveMut.error}</p>
            </div>
          </div>
        )}
      </GlassDialog>

      {/* view history */}
      <GlassDialog
        open={!!historyTarget}
        onOpenChange={(o) => { if (!o) setHistoryTarget(null); }}
        title="Issue history"
        description={historyTarget?.ref}
      >
        {historyTarget && (
          <div>
            <InfoRow label="Detected">{fmtDateTime(historyTarget.detectedAt)}</InfoRow>
            <InfoRow label="Severity"><Chip tone={SEV_TONE[historyTarget.severity] ?? "gray"}>{historyTarget.severity}</Chip></InfoRow>
            <InfoRow label="Rule">{VALIDATION_RULE_LABELS[historyTarget.rule] ?? historyTarget.rule}</InfoRow>
            <InfoRow label="Responsible">{historyTarget.responsibleName || "—"}</InfoRow>
            <InfoRow label="Correction owner">{historyTarget.ownerName || "—"}</InfoRow>
            <InfoRow label="Status"><StatusBadge status={historyTarget.status} /></InfoRow>
            <InfoRow label="Resolved">{historyTarget.resolvedAt ? fmtDateTime(historyTarget.resolvedAt) : "—"}</InfoRow>
            <div className="mt-3">
              <div className="text-[12px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">Resolution / audit note</div>
              <p className="mt-1.5 rounded-2xl bg-white/40 p-3 text-[12.5px] leading-relaxed text-[color:var(--ink-soft)]">
                {historyTarget.resolveNote || "No resolution note recorded yet."}
              </p>
            </div>
          </div>
        )}
      </GlassDialog>
    </div>
  );
}
