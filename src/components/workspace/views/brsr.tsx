"use client";

// ── SCREEN 13 — BRSR Reporting Center (dashboard · 9-step wizard · report detail) ──
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileBarChart,
  FileText,
  Gauge,
  History,
  Layers,
  Map as MapIcon,
  PackageX,
  PenLine,
  PenTool,
  Plus,
  RefreshCw,
  Save,
  ScrollText,
  ShieldCheck,
  SquarePen,
  Trash2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspace, REPORTING_YEARS } from "@/lib/esg/store";
import { BRSR_SECTIONS } from "@/lib/brsr/sections";
import {
  apiDelete,
  apiPatch,
  apiPost,
  downloadFile,
  fmtDate,
  fmtDateTime,
  fmtNumber,
  timeAgo,
  toCsv,
  useApi,
  useMutation,
} from "@/lib/esg/client";
import type {
  BrsrDisclosure,
  BrsrReport,
  BrsrSection,
  BusinessUnit,
  DisclosureCatalog,
  Project,
  Subsidiary,
} from "@/lib/esg/types";
import { useToast } from "@/hooks/use-toast";
import {
  ActionButton,
  Chip,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  GlassCard,
  GlassDialog,
  GlassProgress,
  InfoRow,
  KpiCard,
  LoadingBlock,
  PageHeader,
  SectionCard,
  StatusBadge,
  DataTable,
  TipIconButton,
  Avatar,
  type Column,
} from "../ui";

/* ─────────────────────────── local types & constants ─────────────────────────── */

interface BrsrListData {
  reports: BrsrReport[];
  byYear: { year: string; total: number; finalized: number; draft: number }[];
  catalog: DisclosureCatalog[];
  missingSubmissions: { ref: string; title: string; org: string; status: string }[];
  validationExceptions: number;
  pendingSignoffs: number;
}
interface BrsrDetailData {
  report: BrsrReport;
}
type ReportRow = BrsrReport & { createdAt?: string | null; updatedAt?: string | null };

const FRAMEWORKS = ["SEBI BRSR Core v1.0", "SEBI BRSR Core v1.1 (draft)"];
const SIGNOFF_ROLES = ["Group CFO", "CEO", "Board ESG Committee", "Subsidiary Manager"];
const STEPS = [
  { n: 1, label: "Information", icon: FileText },
  { n: 2, label: "Scope", icon: MapIcon },
  { n: 3, label: "Consolidation", icon: Layers },
  { n: 4, label: "Mapping & Validation", icon: ClipboardCheck },
  { n: 5, label: "Draft generation", icon: PenLine },
  { n: 6, label: "Builder", icon: SquarePen },
  { n: 7, label: "Review & Sign-off", icon: PenTool },
  { n: 8, label: "Finalize & Export", icon: BadgeCheck },
  { n: 9, label: "History", icon: History },
];
const NEXT_STATUS: Record<string, string> = {
  DRAFT: "CONSOLIDATION",
  CONSOLIDATION: "VALIDATION",
  VALIDATION: "REVIEW",
  REVIEW: "SIGNOFF",
};
const PALETTE = { green: "#238653", red: "#c34a4a", amber: "#c57926", blue: "#3a7bff", teal: "#16a3a3", purple: "#6a5bff" };

const unresolvedOf = (r: BrsrReport) => r.disclosures.filter((d) => d.mapped && d.status !== "VALIDATED" && !d.note.trim());
const sectionOfCode = (code: string) =>
  code.includes("-A1-") ? "ANNEXURE1"
    : code.includes("-ENV-") ? "ENVIRONMENT"
      : code.includes("-SOC-") ? "SOCIAL"
        : code.includes("-GOV-") ? "GOVERNANCE" : "GENERAL";

/* ─────────────────────────── export helpers (real downloads) ─────────────────────────── */

interface ChecklistSubData {
  subsidiaryName: string;
  subsidiaryCode: string;
  status: string;
  sections: Record<string, Record<string, string>>;
  completeness: { filledFields: number; totalFields: number; pct: number };
}

/* Fetch the subsidiaries' BRSR data so the printed report carries the
   section-wise inputs alongside the report content. */
async function loadChecklist(period: string): Promise<ChecklistSubData[]> {
  try {
    const res = await fetch(`/api/esg/brsr-checklist?period=${encodeURIComponent(period)}`);
    if (!res.ok) return [];
    const json = (await res.json()) as { subsidiaries?: ChecklistSubData[] };
    return json.subsidiaries ?? [];
  } catch {
    return [];
  }
}

interface AnnexureParamRow {
  label: string;
  unit: string;
  assurance: string;
  crossRef: string;
  kind: "number" | "text";
  value: number | null;
  text: string | null;
}
interface AnnexureAttrRow {
  srNo: number;
  title: string;
  summary: string;
  parameters: AnnexureParamRow[];
}

/** Fetch the consolidated Annexure I table so the printed report carries the
    SEBI-mandated nine-attribute disclosure. */
async function loadAnnexure1(period: string): Promise<AnnexureAttrRow[]> {
  try {
    const res = await fetch(`/api/esg/brsr-annexure1?period=${encodeURIComponent(period)}`);
    if (!res.ok) return [];
    const json = (await res.json()) as { attributes?: AnnexureAttrRow[] };
    return json.attributes ?? [];
  } catch {
    return [];
  }
}

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function buildBrsrHtml(r: BrsrReport, subs: ChecklistSubData[], annexure1: AnnexureAttrRow[] = []): string {
  const secRows = r.sections.map((s, i) => `
    <h3>${i + 1}. ${esc(s.title)}</h3><p>${esc(s.content)}</p>`).join("");
  /* Annexure I — the SEBI BRSR Core table, as reported. */
  const annexure1Rows = annexure1.map((a) => `
    <div class="page-break"></div>
    <h2>Annexure I — ${esc(a.srNo)}. ${esc(a.title)}</h2>
    <p class="muted">${esc(a.summary)}</p>
    <table><thead><tr><th>Parameter</th><th>Reported value</th><th>Measurement</th><th>Cross-reference to BRSR</th></tr></thead><tbody>
      ${a.parameters.map((p) => `<tr>
        <td class="k">${esc(p.label)}</td>
        <td>${p.kind === "number" ? `${p.value !== null ? fmtNumber(p.value, 2) : "—"} ${esc(p.unit)}` : esc(p.text ?? "—")}</td>
        <td>${esc(p.unit)}</td>
        <td>${esc(p.crossRef)}</td>
      </tr>`).join("")}
    </tbody></table>
    <p class="muted"><strong>Data &amp; assurance approach</strong> — ${esc(a.parameters.map((p) => p.assurance).join(" "))}</p>`).join("");
  const discRows = ["GENERAL", "ENVIRONMENT", "SOCIAL", "GOVERNANCE", "ANNEXURE1"].map((group) => {
    const items = r.disclosures.filter((d) => sectionOfCode(d.code) === group);
    if (!items.length) return "";
    const groupTitle =
      group === "GENERAL" ? "General disclosures"
        : group === "ANNEXURE1" ? "Annexure I disclosures (SEBI BRSR Core format)"
          : `${group.charAt(0)}${group.slice(1).toLowerCase()} disclosures`;
    return `<h3>${groupTitle}</h3>
      <table><thead><tr><th>Code</th><th>Disclosure</th><th>Value</th><th>Unit</th><th>Status</th></tr></thead><tbody>
      ${items.map((d) => `<tr><td>${esc(d.code)}</td><td>${esc(d.title)}</td><td>${d.value !== null ? fmtNumber(d.value, 2) : "—"}</td><td>${esc(d.unit)}</td><td>${esc(d.status)}</td></tr>`).join("")}
      </tbody></table>`;
  }).join("");
  const subAnnex = subs.map((s) => `
    <div class="page-break"></div>
    <h2>Annexure — BRSR data: ${esc(s.subsidiaryName)} (${esc(s.subsidiaryCode)})</h2>
    <p class="muted">${s.completeness.filledFields}/${s.completeness.totalFields} fields · ${esc(s.status)}</p>
    ${BRSR_SECTIONS.map((sec) => {
      const vals = s.sections?.[sec.key] ?? {};
      const filled = sec.fields.filter((f) => (vals[f.key] ?? "").trim() !== "");
      if (!filled.length) return "";
      return `<h3>${esc(sec.title)}</h3><table><thead><tr><th>Field</th><th>Response</th></tr></thead><tbody>
        ${filled.map((f) => `<tr><td class="k">${esc(f.label)}</td><td>${esc(vals[f.key]).replace(/\n/g, "<br/>")}</td></tr>`).join("")}
      </tbody></table>`;
    }).join("")}`).join("");

  return `<!doctype html><html><head><meta charset="utf-8"/><title>${esc(r.title)}</title><style>
    @page { size: A4; margin: 22mm 16mm 18mm; }
    body { font-family: Georgia, 'Times New Roman', serif; color: #1a2332; line-height: 1.55; }
    /* MEIL watermark — a fixed overlay repeated on every printed page. */
    .wm {
      position: fixed; inset: 0; z-index: 999; pointer-events: none;
      background: url('/meil-logo.jpg') center 55% / 46% auto no-repeat;
      opacity: 0.07;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    /* Letterhead — repeats at the top of every printed page. */
    .letterhead { position: fixed; top: -14mm; left: 0; right: 0; height: 14mm;
      display: flex; align-items: center; justify-content: space-between; padding: 0 4mm; }
    .letterhead img { height: 9mm; }
    .letterhead .tag { font-size: 9px; letter-spacing: 2px; color: #16588e; font-weight: bold;
      text-transform: uppercase; }
    .cover { text-align: center; padding-top: 40px; page-break-after: always; }
    .cover .logo { height: 30mm; margin-bottom: 18px; }
    .cover .group { font-size: 13px; letter-spacing: 6px; color: #16588e; font-weight: bold; }
    .cover h1 { font-size: 30px; margin: 26px 0 8px; }
    .cover .sub { font-size: 15px; color: #475569; }
    .cover table { margin: 48px auto 0; border-collapse: collapse; font-size: 13px; text-align: left; }
    .cover td { padding: 7px 14px; border-bottom: 1px solid #e2e8f0; }
    .cover td.k { color: #64748b; font-weight: bold; width: 240px; }
    h2 { font-size: 19px; border-bottom: 2px solid #16588e; padding-bottom: 6px; margin-top: 30px; page-break-after: avoid; }
    h3 { font-size: 14.5px; margin: 22px 0 6px; page-break-after: avoid; }
    p { font-size: 13px; }
    .muted { color: #64748b; font-size: 12px; }
    table.data, table { width: 100%; border-collapse: collapse; font-size: 12px; margin: 8px 0 18px; }
    th { background: #16588e; color: #fff; text-align: left; padding: 7px 9px; font-weight: bold; }
    td { border: 1px solid #e2e8f0; padding: 6px 9px; vertical-align: top; }
    td.k { width: 34%; color: #334155; font-weight: bold; }
    .page-break { page-break-before: always; }
    .sign { margin-top: 34px; }
  </style></head><body>
    <div class="wm"></div>
    <div class="letterhead">
      <img src="/meil-logo.jpg" alt="MEIL" onerror="this.style.display='none'"/>
      <span class="tag">Business Responsibility &amp; Sustainability Report</span>
    </div>
    <div class="cover">
      <img class="logo" src="/meil-logo.jpg" alt="MEIL Group" onerror="this.style.display='none'"/>
      <div class="group">MEIL GROUP</div>
      <h1>BUSINESS RESPONSIBILITY AND<br/>SUSTAINABILITY REPORT</h1>
      <div class="sub">${esc(r.framework)}</div>
      <table>
        <tr><td class="k">Reporting Financial Year</td><td>${esc(r.financialYear)}</td></tr>
        <tr><td class="k">Reporting Boundary</td><td>Consolidated — all active subsidiaries</td></tr>
        <tr><td class="k">Report Reference</td><td>${esc(r.ref)} · Version ${r.version}</td></tr>
        <tr><td class="k">Prepared By</td><td>${esc(r.ownerName)}</td></tr>
        <tr><td class="k">Reviewed By</td><td>${r.signoffs.map((s) => esc(s.name)).join(", ") || "Subsidiary & BU reviewers (platform trail)"}</td></tr>
        <tr><td class="k">Status</td><td>${esc(r.status)}${r.finalizedAt ? ` · Finalized ${fmtDateTime(r.finalizedAt)}` : ""}</td></tr>
        <tr><td class="k">Generated</td><td>${fmtDateTime(new Date().toISOString())}</td></tr>
      </table>
    </div>
    <h2>1. Report Sections</h2>
    ${secRows || "<p class='muted'>No narrative sections recorded.</p>"}
    <div class="page-break"></div>
    <h2>2. Disclosure Register</h2>
    ${discRows || "<p class='muted'>No disclosures mapped yet.</p>"}
    <h2>3. Sign-offs</h2>
    ${r.signoffs.length ? `<table><thead><tr><th>Role</th><th>Name</th><th>Decision</th><th>At</th><th>Comment</th></tr></thead><tbody>
      ${r.signoffs.map((s) => `<tr><td>${esc(s.role)}</td><td>${esc(s.name)}</td><td>${esc(s.decision)}</td><td>${fmtDateTime(s.at)}</td><td>${esc(s.comment)}</td></tr>`).join("")}
    </tbody></table>` : "<p class='muted'>(none recorded)</p>"}
    ${subs.length ? `<h2>4. Subsidiary BRSR Data Annexure</h2><p class="muted">Section-wise inputs captured from each subsidiary via the platform BRSR Data form.</p>${subAnnex}` : ""}
    ${annexure1.length ? `<h2>${subs.length ? "5" : "4"}. Annexure I — Format of BRSR Core</h2><p class="muted">The nine attributes of the SEBI BRSR Core Annexure I, with the consolidated group values as reported.</p>${annexure1Rows}` : ""}
  </body></html>`;
}

function printBrsrPdf(r: BrsrReport, subs: ChecklistSubData[], annexure1: AnnexureAttrRow[] = []) {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return false;
  w.document.open();
  w.document.write(buildBrsrHtml(r, subs, annexure1));
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
  return true;
}

function buildCsv(r: BrsrReport): string {
  const rows: Record<string, unknown>[] = r.disclosures.map((d) => ({
    Type: "Disclosure",
    Code: d.code,
    Title: d.title,
    Status: d.status,
    Value: d.value ?? "",
    Unit: d.unit,
    Note: d.note,
  }));
  for (const s of r.sections) {
    rows.push({ Type: "Section", Code: s.id, Title: s.title, Status: "", Value: "", Unit: "", Note: s.content });
  }
  return toCsv(rows);
}

function buildTxt(r: BrsrReport): string {
  const L: string[] = [];
  L.push("MEIL GROUP — BRSR REPORT EXPORT");
  L.push("================================");
  L.push(`Ref: ${r.ref}`);
  L.push(`Title: ${r.title}`);
  L.push(`Financial year: ${r.financialYear}`);
  L.push(`Framework: ${r.framework}`);
  L.push(`Status: ${r.status}  (version ${r.version})`);
  L.push(`Period: ${fmtDate(r.periodStart)} — ${fmtDate(r.periodEnd)}`);
  L.push(`Owner: ${r.ownerName}`);
  if (r.finalizedAt) L.push(`Finalized at: ${fmtDateTime(r.finalizedAt)}`);
  L.push("");
  L.push("-- SECTIONS --");
  r.sections.forEach((s, i) => {
    L.push(`[${i + 1}] ${s.title}`);
    L.push(`    ${s.content}`);
  });
  L.push("");
  L.push("-- DISCLOSURES --");
  r.disclosures.forEach((d) => {
    L.push(`[${d.code}] ${d.title} — ${d.value !== null ? `${fmtNumber(d.value, 2)} ${d.unit}` : "no value"} (${d.status})${d.note ? ` — note: ${d.note}` : ""}`);
  });
  L.push("");
  L.push("-- SIGN-OFFS --");
  if (!r.signoffs.length) L.push("(none recorded)");
  r.signoffs.forEach((s) => L.push(`- ${s.role} — ${s.name} — ${s.decision} — ${fmtDateTime(s.at)}${s.comment ? ` — "${s.comment}"` : ""}`));
  L.push("");
  L.push("-- EXPORTS --");
  if (!r.exports.length) L.push("(none recorded)");
  r.exports.forEach((e) => L.push(`- ${e.format} — ${fmtDateTime(e.at)} — by ${e.by}`));
  return L.join("\n");
}

function useBrsrExport(onDone?: (r: BrsrReport) => void) {
  const { toast } = useToast();
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const doExport = async (report: BrsrReport, format: "CSV" | "JSON" | "TXT" | "PDF") => {
    const key = `${report.id}:${format}`;
    setBusyKey(key);
    try {
      const res = await apiPost<{ report: BrsrReport; export: { format: string; at: string; by: string }; file: Record<string, unknown> }>(
        "/api/esg/brsr",
        { action: "export", id: report.id, format }
      );
      const safe = report.ref.replace(/[^\w.-]+/g, "_");
      if (format === "PDF") {
        /* Print-ready A4 layout (browser "Save as PDF") with the cover page,
           disclosures, sign-offs and the subsidiaries' BRSR data annexure. */
        const subs = await loadChecklist(report.financialYear);
        const annexure1 = await loadAnnexure1(report.financialYear);
        printBrsrPdf(report, subs, annexure1);
      } else if (format === "JSON") downloadFile(`${safe}.json`, JSON.stringify(res.file, null, 2), "application/json");
      else if (format === "CSV") downloadFile(`${safe}.csv`, buildCsv(report), "text/csv");
      else downloadFile(`${safe}.txt`, buildTxt(report), "text/plain");
      toast({ title: `Report exported as ${format}`, description: `Recorded by the server at ${fmtDateTime(res.export.at)}.` });
      onDone?.(res.report);
    } catch (e) {
      toast({ variant: "destructive", title: "Export failed", description: e instanceof Error ? e.message : "Unexpected error." });
    } finally {
      setBusyKey(null);
    }
  };
  return { doExport, busyKey };
}

function ExportMenu({ report, size = "sm" }: { report: BrsrReport; size?: "sm" | "default" }) {
  const { doExport, busyKey } = useBrsrExport();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={size} className="glass-subtle rounded-xl border-white/60" disabled={busyKey !== null}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          {busyKey ? "Exporting…" : "Export"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="glass-strong rounded-2xl border-white/70">
        {(["PDF", "CSV", "JSON", "TXT"] as const).map((f) => (
          <DropdownMenuItem key={f} onClick={() => doExport(report, f)}>
            <Download className="mr-2 h-3.5 w-3.5" /> {f === "PDF" ? "PDF report (print-ready)" : `${f} file`}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ─────────────────────────── sign-offs / versions / exports shared bits ─────────────────────────── */

function SignoffsTimeline({ signoffs }: { signoffs: BrsrReport["signoffs"] }) {
  if (!signoffs.length) return <EmptyState icon={PenTool} title="No sign-offs yet" message="Recorded approvals will appear here." />;
  return (
    <div className="flex flex-col gap-3">
      {signoffs.map((s, i) => (
        <div key={i} className="glass-subtle flex items-start gap-3 rounded-2xl p-3.5">
          <Avatar name={s.name} size={36} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-[color:var(--ink)]">{s.name}</span>
              <Chip tone="purple">{s.role}</Chip>
              <StatusBadge status={s.decision} />
            </div>
            <div className="mt-0.5 text-xs text-[color:var(--ink-faint)]">{fmtDateTime(s.at)}</div>
            {s.comment && <p className="mt-1.5 text-[13px] italic text-[color:var(--ink-soft)]">“{s.comment}”</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function VersionsTimeline({ versions }: { versions: BrsrReport["versions"] }) {
  if (!versions.length) return <EmptyState icon={History} title="No versions recorded" />;
  return (
    <div className="relative flex flex-col gap-4 pl-6">
      <span className="absolute bottom-2 left-[9px] top-2 w-px bg-[rgba(125,177,216,0.4)]" aria-hidden="true" />
      {versions.map((v, i) => (
        <div key={i} className="relative">
          <span className="absolute -left-6 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#3a7bff] shadow" aria-hidden="true" />
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="blue">v{v.version}</Chip>
            <span className="text-[13px] font-medium text-[color:var(--ink)]">{v.note}</span>
          </div>
          <div className="mt-0.5 text-xs text-[color:var(--ink-faint)]">
            {fmtDateTime(v.at)} · by {v.by}
          </div>
        </div>
      ))}
    </div>
  );
}

function DisclosuresTable({ disclosures }: { disclosures: BrsrDisclosure[] }) {
  if (!disclosures.length) return <EmptyState icon={ClipboardCheck} title="No disclosures computed yet" message="Run consolidation and map disclosures to populate this table." />;
  return (
    <div className="nice-scroll overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-[rgba(125,177,216,0.35)] text-left text-[11px] uppercase tracking-wide text-[color:var(--ink-faint)]">
            <th className="px-3 py-2 font-semibold">Code</th>
            <th className="px-3 py-2 font-semibold">Disclosure</th>
            <th className="px-3 py-2 text-right font-semibold">Value</th>
            <th className="px-3 py-2 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {disclosures.map((d) => (
            <tr key={d.code} className="border-b border-[rgba(125,177,216,0.15)] last:border-0">
              <td className="px-3 py-2 font-mono text-xs text-[color:var(--ink-soft)]">{d.code}</td>
              <td className="px-3 py-2 text-[color:var(--ink)]">{d.title}</td>
              <td className="tabular px-3 py-2 text-right text-[color:var(--ink-soft)]">{d.value !== null ? `${fmtNumber(d.value, 2)} ${d.unit}` : "—"}</td>
              <td className="px-3 py-2">
                <StatusBadge status={d.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ════════════════════════════ A) DASHBOARD ════════════════════════════ */

function BrsrDashboard() {
  const { toast } = useToast();
  const { navigate } = useWorkspace();
  const list = useApi<BrsrListData>("/api/esg/brsr");
  const delMut = useMutation<{ success: boolean }>();
  const [discardRow, setDiscardRow] = React.useState<ReportRow | null>(null);
  const { doExport, busyKey } = useBrsrExport();

  const rows: ReportRow[] = React.useMemo(() => (list.data?.reports ?? []) as ReportRow[], [list.data]);
  const stats = React.useMemo(() => {
    const d = list.data;
    const drafts = rows.filter((r) => r.status !== "FINALIZED").length;
    const finalized = rows.filter((r) => r.status === "FINALIZED").length;
    const avgCompletion = rows.length ? Math.round(rows.reduce((a, r) => a + (r.completionPct ?? 0), 0) / rows.length) : 0;
    return { drafts, finalized, avgCompletion, missing: d?.missingSubmissions.length ?? 0, exceptions: d?.validationExceptions ?? 0, signoffs: d?.pendingSignoffs ?? 0 };
  }, [list.data, rows]);

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const discard = async (reason: string) => {
    if (!discardRow) return;
    const res = await delMut.run(() => apiDelete<{ success: boolean }>("/api/esg/brsr", { id: discardRow.id, reason }));
    if (res) {
      toast({ title: "Draft discarded", description: `${discardRow.ref} has been removed from the reporting register.` });
      setDiscardRow(null);
      list.refetch();
    } else {
      toast({ variant: "destructive", title: "Could not discard report", description: delMut.error ?? undefined });
    }
  };

  const columns: Column<ReportRow>[] = [
    { key: "ref", header: "Ref", sortable: true, sortValue: (r) => r.ref, render: (r) => <span className="font-mono text-xs text-[color:var(--ink-soft)]">{r.ref}</span> },
    {
      key: "title",
      header: "Title",
      sortable: true,
      sortValue: (r) => r.title,
      render: (r) => (
        <div className="max-w-[260px]">
          <div className="truncate font-medium text-[color:var(--ink)]">{r.title}</div>
          <div className="truncate text-xs text-[color:var(--ink-faint)]">{r.ownerName}</div>
        </div>
      ),
    },
    { key: "year", header: "Year", sortable: true, sortValue: (r) => r.financialYear, render: (r) => <Chip tone="teal">{r.financialYear}</Chip> },
    { key: "framework", header: "Framework", render: (r) => <span className="text-xs text-[color:var(--ink-soft)]">{r.framework}</span> },
    { key: "version", header: "Ver", render: (r) => <span className="font-mono text-xs">v{r.version}</span> },
    { key: "status", header: "Status", sortable: true, sortValue: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "completion",
      header: "Completion",
      render: (r) => <GlassProgress value={r.completionPct ?? 0} showLabel tone={(r.completionPct ?? 0) >= 80 ? "green" : "blue"} className="w-28" />,
    },
    { key: "updated", header: "Updated", sortable: true, sortValue: (r) => r.updatedAt ?? "", render: (r) => <span className="text-xs text-[color:var(--ink-faint)]">{r.updatedAt ? timeAgo(r.updatedAt) : "—"}</span> },
  ];

  return (
    <div className="view-in space-y-5">
      <PageHeader
        title="BRSR Reporting Center"
        description="Create, consolidate, validate, sign off, finalize, and export the group's Business Responsibility & Sustainability Report."
        icon={FileBarChart}
        breadcrumbs={["Group", "BRSR Reporting", "Center"]}
        actions={
          <ActionButton onClick={() => navigate("brsr", { wizard: Date.now() })}>
            <Plus className="mr-1.5 h-4 w-4" /> Create New BRSR Report
          </ActionButton>
        }
      />

      {list.error ? (
        <GlassCard>
          <ErrorState message={list.error} onRetry={() => list.refetch()} />
        </GlassCard>
      ) : list.loading ? (
        <GlassCard>
          <LoadingBlock rows={6} label="Loading reporting register…" />
        </GlassCard>
      ) : (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
            <GlassCard className="glass-sheen flex flex-col justify-between gap-3 rounded-3xl p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <span className="glass-subtle flex h-9 w-9 items-center justify-center rounded-xl bg-[rgba(58,123,255,0.12)]">
                  <FileBarChart className="h-4.5 w-4.5 text-[#3a7bff]" />
                </span>
                <span className="text-[13px] font-medium text-[color:var(--ink-soft)]">Reports by year</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {(list.data?.byYear ?? []).length === 0 && <span className="text-xs text-[color:var(--ink-faint)]">No reports yet</span>}
                {(list.data?.byYear ?? []).map((y) => (
                  <div key={y.year} className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[color:var(--ink)]">{y.year}</span>
                    <span className="text-[color:var(--ink-faint)]">
                      {y.total} total · <span className="text-[#1d6b40]">{y.finalized} final</span> · {y.draft} draft
                    </span>
                  </div>
                ))}
              </div>
            </GlassCard>
            <KpiCard label="In preparation" value={stats.drafts} icon={PenLine} tone="purple" hint="Draft → sign-off lifecycle" />
            <KpiCard label="Avg data completion" value={`${stats.avgCompletion}%`} icon={Gauge} tone={stats.avgCompletion >= 80 ? "green" : "amber"} hint="Across all reports" />
            <KpiCard label="Missing submissions" value={stats.missing} icon={PackageX} tone={stats.missing ? "red" : "green"} hint="Overdue & blocking consolidation" onClick={() => scrollTo("brsr-missing")} />
            <KpiCard label="Validation exceptions" value={stats.exceptions} icon={AlertTriangle} tone={stats.exceptions ? "amber" : "green"} hint="Disclosures flagged during validation" />
            <KpiCard label="Pending sign-offs" value={stats.signoffs} icon={PenTool} tone={stats.signoffs ? "blue" : "green"} hint="Reports awaiting approvers" />
            <KpiCard label="Finalized reports" value={stats.finalized} icon={BadgeCheck} tone="green" hint="Locked official record" />
          </div>

          {/* Reports table */}
          <SectionCard title="BRSR reports" description="Click a row for report detail, or open the report builder." icon={FileBarChart}>
            <DataTable
              columns={columns}
              rows={rows}
              pageSize={6}
              onRowClick={(r) => navigate("brsr", { detailId: r.id })}
              emptyTitle="No BRSR reports yet"
              emptyMessage="Create your first report to start the consolidation → validation → sign-off workflow."
              emptyAction={
                <Button className="rounded-2xl" onClick={() => navigate("brsr", { wizard: Date.now() })}>
                  <Plus className="mr-1.5 h-4 w-4" /> Create New BRSR Report
                </Button>
              }
              rowActions={(r) => (
                <div className="flex items-center justify-end gap-1">
                  <TipIconButton tip="Open in report builder" onClick={() => navigate("brsr", { wizardReportId: r.id })} aria-label={`Open ${r.ref} in builder`}>
                    <SquarePen className="h-4 w-4" />
                  </TipIconButton>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-xl text-[color:var(--ink-soft)] hover:bg-white/70"
                        disabled={busyKey !== null}
                        aria-label={`Export ${r.ref}`}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="glass-strong rounded-2xl border-white/70">
                      {(["CSV", "JSON", "TXT"] as const).map((f) => (
                        <DropdownMenuItem key={f} onClick={() => doExport(r, f)}>
                          <Download className="mr-2 h-3.5 w-3.5" /> {f} file
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {r.status === "DRAFT" && (
                    <TipIconButton tip="Discard draft" className="text-[#c34a4a] hover:bg-[rgba(195,74,74,0.08)]" onClick={() => setDiscardRow(r)} aria-label={`Discard ${r.ref}`}>
                      <Trash2 className="h-4 w-4" />
                    </TipIconButton>
                  )}
                </div>
              )}
            />
          </SectionCard>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {/* Missing submissions */}
            <div id="brsr-missing" className="scroll-mt-24">
              <SectionCard title="Missing submissions" description="Overdue records that block clean consolidation." icon={PackageX}>
                {(list.data?.missingSubmissions ?? []).length === 0 ? (
                  <EmptyState icon={CheckCircle2} title="Nothing missing" message="All expected submissions for the current period are in flight or approved." />
                ) : (
                  <div className="nice-scroll flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
                    {(list.data?.missingSubmissions ?? []).map((m) => (
                      <div key={m.ref} className="glass-subtle flex items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5">
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-medium text-[color:var(--ink)]">{m.title}</div>
                          <div className="truncate text-xs text-[color:var(--ink-faint)]">
                            <span className="font-mono">{m.ref}</span>
                            {m.org ? ` · ${m.org}` : ""}
                          </div>
                        </div>
                        <StatusBadge status={m.status} />
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>
            {/* Previous versions of finalized reports */}
            <SectionCard title="Previous versions" description="Version history captured for finalized reports." icon={History}>
              {rows.filter((r) => r.status === "FINALIZED" && r.versions.length > 1).length === 0 ? (
                <EmptyState icon={History} title="No version history yet" message="Versions are recorded as reports move through the workflow and after controlled revisions." />
              ) : (
                <div className="nice-scroll flex max-h-72 flex-col gap-3 overflow-y-auto pr-1">
                  {rows
                    .filter((r) => r.status === "FINALIZED" && r.versions.length > 1)
                    .map((r) => (
                      <div key={r.id} className="glass-subtle rounded-2xl p-3.5">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="font-mono text-xs text-[color:var(--ink-soft)]">{r.ref}</span>
                          <StatusBadge status={r.status} />
                        </div>
                        <VersionsTimeline versions={r.versions} />
                      </div>
                    ))}
                </div>
              )}
            </SectionCard>
          </div>
        </>
      )}

      <ConfirmDialog
        open={!!discardRow}
        onOpenChange={(o) => !o && setDiscardRow(null)}
        title="Discard draft report?"
        message={`${discardRow?.ref ?? ""} — "${discardRow?.title ?? ""}" will be permanently removed. Finalized reports cannot be discarded.`}
        confirmLabel="Discard draft"
        destructive
        requireReason
        pending={delMut.pending}
        onConfirm={(reason) => discard(reason ?? "")}
      />
    </div>
  );
}

/* ════════════════════════════ B) WIZARD ════════════════════════════ */

function Stepper({ step, maxReached, canNavigate, onGo }: { step: number; maxReached: number; canNavigate: boolean; onGo: (n: number) => void }) {
  return (
    <div className="nice-scroll flex items-center gap-1.5 overflow-x-auto pb-1">
      {STEPS.map((s, i) => {
        const active = step === s.n;
        const done = s.n < step;
        const reachable = canNavigate && s.n <= maxReached + 1;
        const Icon = done ? Check : s.icon;
        return (
          <React.Fragment key={s.n}>
            <button
              type="button"
              disabled={!reachable}
              onClick={() => reachable && onGo(s.n)}
              aria-current={active ? "step" : undefined}
              className={[
                "flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[12px] font-medium transition-all",
                active ? "nav-active" : done ? "text-[#1d6b40] hover:bg-white/60" : reachable ? "text-[color:var(--ink-soft)] hover:bg-white/60" : "text-[color:var(--ink-faint)] opacity-60",
              ].join(" ")}
            >
              <span className={["flex h-5 w-5 items-center justify-center rounded-lg text-[10px] font-bold", active ? "bg-[rgba(58,123,255,0.18)] text-[#1d5fd6]" : done ? "bg-[rgba(35,134,83,0.14)]" : "bg-black/5"].join(" ")}>
                <Icon className="h-3 w-3" />
              </span>
              {s.label}
            </button>
            {i < STEPS.length - 1 && <span className="h-px w-3 shrink-0 bg-[rgba(125,177,216,0.5)]" aria-hidden="true" />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ── Step 1 — Information ── */

function StepInfo({ report, onSaved }: { report: BrsrReport | null; onSaved: (r: BrsrReport) => void }) {
  const { toast } = useToast();
  const { navigate } = useWorkspace();
  const mut = useMutation<{ report: BrsrReport }>();
  const [title, setTitle] = React.useState(report?.title ?? "");
  const [fy, setFy] = React.useState(report?.financialYear ?? "FY 2025-26");
  const [framework, setFramework] = React.useState(report?.framework ?? FRAMEWORKS[0]);
  const [periodStart, setPeriodStart] = React.useState(report?.periodStart ? report.periodStart.slice(0, 10) : "");
  const [periodEnd, setPeriodEnd] = React.useState(report?.periodEnd ? report.periodEnd.slice(0, 10) : "");
  const [description, setDescription] = React.useState(report?.description ?? "");
  const [touched, setTouched] = React.useState(false);
  const locked = report?.status === "FINALIZED";

  const titleErr = touched && !title.trim() ? "Report title is required." : null;
  const fyErr = touched && !fy ? "Financial year is required." : null;

  const save = async () => {
    setTouched(true);
    if (!title.trim() || !fy) return;
    const payload = {
      title: title.trim(),
      financialYear: fy,
      framework,
      periodStart: periodStart || undefined,
      periodEnd: periodEnd || undefined,
      description,
    };
    if (!report) {
      const res = await mut.run(() => apiPost<{ report: BrsrReport }>("/api/esg/brsr", { action: "create", ...payload }));
      if (res) {
        toast({ title: "BRSR report created", description: `${res.report.ref} created as a draft — continue with reporting scope.` });
        navigate("brsr", { wizardReportId: res.report.id });
      } else {
        toast({ variant: "destructive", title: "Could not create report", description: mut.error ?? undefined });
      }
      return;
    }
    const res = await mut.run(() => apiPatch<{ report: BrsrReport }>("/api/esg/brsr", { id: report.id, ...payload }));
    if (res) {
      toast({ title: "Report information saved", description: `${res.report.ref} updated.` });
      onSaved(res.report);
    } else {
      toast({ variant: "destructive", title: "Could not save report", description: mut.error ?? undefined });
    }
  };

  return (
    <div className="space-y-4">
      {locked && (
        <GlassCard subtle className="flex items-start gap-3 border-[rgba(197,121,38,0.35)] p-4">
          <ShieldCheck className="mt-0.5 h-4.5 w-4.5 shrink-0 text-[#c57926]" />
          <p className="text-[13px] text-[color:var(--ink-soft)]">
            This report is <strong>finalized</strong> and locked. Editing is disabled — use a controlled revision from Step 9 (History) to reopen it.
          </p>
        </GlassCard>
      )}
      <SectionCard title="Report information" description="Identity and coverage of the consolidated BRSR report." icon={FileText}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field label="Report title" required error={titleErr} htmlFor="brsr-title">
              <Input id="brsr-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. MEIL Group Consolidated BRSR — FY 2025-26" disabled={locked} className="glass-subtle rounded-2xl border-white/60" />
            </Field>
          </div>
          <Field label="Financial year" required error={fyErr} htmlFor="brsr-fy">
            <Select value={fy} onValueChange={setFy} disabled={locked}>
              <SelectTrigger id="brsr-fy" className="glass-subtle rounded-2xl border-white/60">
                <SelectValue placeholder="Select financial year" />
              </SelectTrigger>
              <SelectContent className="glass-strong rounded-2xl border-white/70">
                {REPORTING_YEARS.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Framework" htmlFor="brsr-framework">
            <Select value={framework} onValueChange={setFramework} disabled={locked}>
              <SelectTrigger id="brsr-framework" className="glass-subtle rounded-2xl border-white/60">
                <SelectValue placeholder="Select framework" />
              </SelectTrigger>
              <SelectContent className="glass-strong rounded-2xl border-white/70">
                {FRAMEWORKS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Period start" htmlFor="brsr-ps">
            <Input id="brsr-ps" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} disabled={locked} className="glass-subtle rounded-2xl border-white/60" />
          </Field>
          <Field label="Period end" htmlFor="brsr-pe">
            <Input id="brsr-pe" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} disabled={locked} className="glass-subtle rounded-2xl border-white/60" />
          </Field>
          <div className="md:col-span-2">
            <Field label="Description" hint="Context shown on the report cover and detail page." htmlFor="brsr-desc">
              <Textarea id="brsr-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} disabled={locked} className="glass-subtle rounded-2xl border-white/60" placeholder="Purpose and scope of this report…" />
            </Field>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <ActionButton onClick={save} pending={mut.pending} disabled={locked}>
            <Save className="mr-1.5 h-4 w-4" /> Save &amp; continue
          </ActionButton>
        </div>
      </SectionCard>
    </div>
  );
}

/* ── Step 2 — Scope ── */

function groupBy<T>(arr: T[], key: (x: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const x of arr) (out[key(x)] ??= []).push(x);
  return out;
}

function StepScope({ report, onSaved, onContinue }: { report: BrsrReport; onSaved: (r: BrsrReport) => void; onContinue: () => void }) {
  const { toast } = useToast();
  const mut = useMutation<{ report: BrsrReport }>();
  const subsApi = useApi<{ subsidiaries: Subsidiary[] }>("/api/esg/org?type=subsidiaries");
  const unitsApi = useApi<{ businessUnits: BusinessUnit[] }>("/api/esg/org?type=business-units");
  const projectsApi = useApi<{ projects: Project[] }>("/api/esg/org?type=projects");
  const [subs, setSubs] = React.useState<string[]>(report.scope?.subsidiaryIds ?? []);
  const [units, setUnits] = React.useState<string[]>(report.scope?.businessUnitIds ?? []);
  const [projs, setProjs] = React.useState<string[]>(report.scope?.projectIds ?? []);
  const locked = report.status === "FINALIZED";

  const subList = subsApi.data?.subsidiaries ?? [];
  const unitList = unitsApi.data?.businessUnits ?? [];
  const projList = projectsApi.data?.projects ?? [];
  const unitsBySub = React.useMemo(() => groupBy(unitList, (u) => u.subsidiaryId), [unitList]);
  const projectsByUnit = React.useMemo(() => groupBy(projList, (p) => p.businessUnitId), [projList]);

  const toggleSub = (id: string, on: boolean) => {
    const childUnits = (unitsBySub[id] ?? []).map((u) => u.id);
    const childProjects = childUnits.flatMap((uid) => (projectsByUnit[uid] ?? []).map((p) => p.id));
    setSubs((prev) => (on ? Array.from(new Set([...prev, id])) : prev.filter((x) => x !== id)));
    setUnits((prev) => (on ? Array.from(new Set([...prev, ...childUnits])) : prev.filter((x) => !childUnits.includes(x))));
    setProjs((prev) => (on ? Array.from(new Set([...prev, ...childProjects])) : prev.filter((x) => !childProjects.includes(x))));
  };
  const toggleUnit = (u: BusinessUnit, on: boolean) => {
    const childProjects = (projectsByUnit[u.id] ?? []).map((p) => p.id);
    setUnits((prev) => (on ? Array.from(new Set([...prev, u.id])) : prev.filter((x) => x !== u.id)));
    setProjs((prev) => (on ? Array.from(new Set([...prev, ...childProjects])) : prev.filter((x) => !childProjects.includes(x))));
    if (on) setSubs((prev) => Array.from(new Set([...prev, u.subsidiaryId])));
  };
  const toggleProject = (p: Project, on: boolean) => {
    setProjs((prev) => (on ? Array.from(new Set([...prev, p.id])) : prev.filter((x) => x !== p.id)));
    if (on) {
      setUnits((prev) => Array.from(new Set([...prev, p.businessUnitId])));
      const parent = unitList.find((u) => u.id === p.businessUnitId);
      if (parent) setSubs((prev) => Array.from(new Set([...prev, parent.subsidiaryId])));
    }
  };

  const issues: string[] = [];
  if (!subs.length && !units.length && !projs.length) issues.push("No reporting boundaries selected — include at least one subsidiary.");
  for (const uid of units) {
    const u = unitList.find((x) => x.id === uid);
    if (u && !subs.includes(u.subsidiaryId)) issues.push(`Business unit “${u.name}” is selected without its parent subsidiary.`);
  }
  for (const pid of projs) {
    const p = projList.find((x) => x.id === pid);
    if (p && !units.includes(p.businessUnitId)) issues.push(`Project “${p.name}” is selected without its parent business unit.`);
  }

  const save = async () => {
    const res = await mut.run(() =>
      apiPatch<{ report: BrsrReport }>("/api/esg/brsr", {
        id: report.id,
        scope: { subsidiaryIds: subs, businessUnitIds: units, projectIds: projs },
      })
    );
    if (res) {
      toast({ title: "Reporting boundaries saved", description: `${subs.length} subsidiaries · ${units.length} business units · ${projs.length} projects included.` });
      onSaved(res.report);
    } else {
      toast({ variant: "destructive", title: "Could not save scope", description: mut.error ?? undefined });
    }
  };

  const orgLoading = subsApi.loading || unitsApi.loading || projectsApi.loading;
  const orgError = subsApi.error ?? unitsApi.error ?? projectsApi.error;

  return (
    <div className="space-y-4">
      <SectionCard
        title="Reporting boundaries"
        description="Select the subsidiaries, business units, and projects/sites whose data consolidates into this report."
        icon={MapIcon}
        actions={
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[color:var(--ink-faint)]">
            <Chip tone="green">{subs.length}/{subList.length} subs</Chip>
            <Chip tone="blue">{units.length}/{unitList.length} units</Chip>
            <Chip tone="teal">{projs.length}/{projList.length} projects</Chip>
          </div>
        }
      >
        {orgLoading ? (
          <LoadingBlock rows={4} label="Loading organization tree…" />
        ) : orgError ? (
          <ErrorState message={orgError} onRetry={() => { subsApi.refetch(); unitsApi.refetch(); projectsApi.refetch(); }} />
        ) : (
          <div className="nice-scroll flex max-h-[26rem] flex-col gap-2 overflow-y-auto pr-1">
            {subList.map((s) => (
              <div key={s.id} className="glass-subtle rounded-2xl p-3">
                <label className="flex cursor-pointer items-center gap-2.5">
                  <Checkbox checked={subs.includes(s.id)} onCheckedChange={(v) => toggleSub(s.id, v === true)} disabled={locked} aria-label={`Include ${s.name}`} />
                  <span className="text-sm font-semibold text-[color:var(--ink)]">{s.name}</span>
                  <Chip tone="gray">{s.code}</Chip>
                </label>
                <div className="mt-2 flex flex-col gap-1.5 pl-7">
                  {(unitsBySub[s.id] ?? []).map((u) => (
                    <div key={u.id}>
                      <label className="flex cursor-pointer items-center gap-2.5">
                        <Checkbox checked={units.includes(u.id)} onCheckedChange={(v) => toggleUnit(u, v === true)} disabled={locked} aria-label={`Include ${u.name}`} />
                        <span className="text-[13px] font-medium text-[color:var(--ink-soft)]">{u.name}</span>
                        <Chip tone="gray">{u.code}</Chip>
                      </label>
                      <div className="mt-1 flex flex-col gap-1 pl-7">
                        {(projectsByUnit[u.id] ?? []).map((p) => (
                          <label key={p.id} className="flex cursor-pointer items-center gap-2.5">
                            <Checkbox checked={projs.includes(p.id)} onCheckedChange={(v) => toggleProject(p, v === true)} disabled={locked} aria-label={`Include ${p.name}`} />
                            <span className="text-[13px] text-[color:var(--ink-soft)]">{p.name}</span>
                            <span className="text-[11px] text-[color:var(--ink-faint)]">{p.location}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {issues.length > 0 && (
          <div className="mt-3 rounded-2xl border border-[rgba(197,121,38,0.35)] bg-[rgba(197,121,38,0.08)] p-3.5">
            <div className="mb-1 flex items-center gap-2 text-[13px] font-semibold text-[#9c5d1b]">
              <AlertTriangle className="h-4 w-4" /> Boundary validation ({issues.length})
            </div>
            <ul className="list-inside list-disc text-xs text-[color:var(--ink-soft)]">
              {issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </div>
        )}
        {issues.length === 0 && (subs.length > 0 || units.length > 0 || projs.length > 0) && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-[rgba(35,134,83,0.3)] bg-[rgba(35,134,83,0.07)] p-3.5 text-[13px] font-medium text-[#1d6b40]">
            <CheckCircle2 className="h-4 w-4" /> Reporting boundaries are consistent — every selected unit/project has its parent chain included.
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" className="glass-subtle rounded-2xl border-white/60" onClick={onContinue} disabled={!report}>
            Continue to consolidation
          </Button>
          <ActionButton onClick={save} pending={mut.pending} disabled={locked}>
            <Save className="mr-1.5 h-4 w-4" /> Save scope
          </ActionButton>
        </div>
      </SectionCard>
    </div>
  );
}

/* ── Step 3 — Consolidation ── */

function StepConsolidation({ report, onChanged, onContinue }: { report: BrsrReport; onChanged: (r: BrsrReport) => void; onContinue: () => void }) {
  const { toast } = useToast();
  const mut = useMutation<{ report: BrsrReport; message: string }>();
  const locked = report.status === "FINALIZED";
  const computed = report.disclosures.filter((d) => d.value !== null);

  const recompute = async () => {
    const res = await mut.run(() => apiPost<{ report: BrsrReport; message: string }>("/api/esg/brsr", { action: "recompute", id: report.id }));
    if (res) {
      toast({ title: "Consolidation complete", description: res.message });
      onChanged(res.report);
    } else {
      toast({ variant: "destructive", title: "Consolidation refused", description: mut.error ?? undefined });
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KpiCard label="Source submissions in scope" value={report.sourceSubmissionCount ?? 0} icon={Layers} tone="blue" hint="Submitted · under review · approved" />
        <KpiCard label="Approved submissions" value={report.approvedSubmissionCount ?? 0} icon={CheckCircle2} tone="green" hint="Only these enter consolidated values" />
      </div>
      <SectionCard title="Run consolidation" description="Re-aggregate disclosure values from approved source data." icon={RefreshCw}>
        <div className="flex flex-col gap-3">
          <ActionButton onClick={recompute} pending={mut.pending} disabled={locked}>
            <RefreshCw className="mr-1.5 h-4 w-4" /> Run consolidation from approved data
          </ActionButton>
          <div className="flex items-start gap-2.5 rounded-2xl border border-[rgba(197,121,38,0.35)] bg-[rgba(197,121,38,0.08)] p-3.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#c57926]" />
            <p className="text-[13px] leading-relaxed text-[color:var(--ink-soft)]">
              <strong>Honest consolidation:</strong> only APPROVED submissions enter consolidated values. Draft, submitted, and under-review data is excluded until it clears review — nothing is silently averaged in.
            </p>
          </div>
        </div>
      </SectionCard>
      <SectionCard title="Computed disclosures" description="Values produced by the last consolidation run." icon={ClipboardCheck}>
        {computed.length === 0 ? (
          <EmptyState icon={Layers} title="No computed values yet" message="Run consolidation to aggregate approved submissions into disclosure values." />
        ) : (
          <DisclosuresTable disclosures={computed} />
        )}
        <div className="mt-4 flex justify-end">
          <Button variant="outline" className="glass-subtle rounded-2xl border-white/60" onClick={onContinue}>
            Continue to mapping &amp; validation
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}

/* ── Step 4 — Mapping & Validation ── */

function mergeCatalog(catalog: DisclosureCatalog[], disclosures: BrsrDisclosure[]): BrsrDisclosure[] {
  return catalog.map((c) => {
    const d = disclosures.find((x) => x.code === c.code);
    return d ?? { code: c.code, title: c.title, mapped: false, status: "NOT_MAPPED", value: null, unit: c.unit, note: "" };
  });
}

function StepMapping({ report, catalog, onChanged, onContinue }: { report: BrsrReport; catalog: DisclosureCatalog[]; onChanged: (r: BrsrReport) => void; onContinue: () => void }) {
  const { toast } = useToast();
  const mut = useMutation<{ report: BrsrReport }>();
  const [discs, setDiscs] = React.useState<BrsrDisclosure[] | null>(null);
  const [noteFor, setNoteFor] = React.useState<string | null>(null);
  const [noteDraft, setNoteDraft] = React.useState("");
  const locked = report.status === "FINALIZED";

  React.useEffect(() => {
    if (!discs && report && catalog.length) setDiscs(mergeCatalog(catalog, report.disclosures));
  }, [discs, report, catalog]);

  if (!discs) return <LoadingBlock rows={6} label="Loading disclosure catalog…" />;

  const mappedCount = discs.filter((d) => d.mapped).length;
  const validatedCount = discs.filter((d) => d.status === "VALIDATED").length;
  const unresolved = discs.filter((d) => d.mapped && d.status !== "VALIDATED" && !d.note.trim());

  const patchDisclosures = async (next: BrsrDisclosure[], successMsg: string) => {
    const res = await mut.run(() => apiPatch<{ report: BrsrReport }>("/api/esg/brsr", { id: report.id, disclosures: next }));
    if (res) {
      onChanged(res.report);
      toast({ title: successMsg });
    } else {
      toast({ variant: "destructive", title: "Could not update disclosures", description: mut.error ?? undefined });
    }
  };

  const toggleMap = (code: string) => {
    const next = discs.map((d) =>
      d.code === code
        ? d.mapped
          ? { ...d, mapped: false, status: "NOT_MAPPED" }
          : { ...d, mapped: true, status: d.status === "NOT_MAPPED" ? "PENDING" : d.status }
        : d
    );
    setDiscs(next);
    void patchDisclosures(next, next.find((d) => d.code === code)?.mapped ? "Disclosure mapped." : "Disclosure unmapped.");
  };

  const saveNote = (code: string) => {
    const next = discs.map((d) => (d.code === code ? { ...d, note: noteDraft } : d));
    setDiscs(next);
    setNoteFor(null);
    setNoteDraft("");
    void patchDisclosures(next, "Exception note saved — the issue is now documented.");
  };

  return (
    <div className="space-y-4">
      <SectionCard
        title="Disclosure mapping & validation"
        description="Map BRSR Core disclosures to consolidated values and document any validation exceptions."
        icon={ClipboardCheck}
        actions={
          <div className="flex items-center gap-2">
            <Chip tone="blue">{mappedCount}/{discs.length} mapped</Chip>
            <Chip tone="green">{validatedCount} validated</Chip>
          </div>
        }
      >
        <GlassProgress value={(mappedCount / Math.max(discs.length, 1)) * 100} showLabel tone={mappedCount === discs.length ? "green" : "blue"} className="mb-4" />
        {unresolved.length > 0 && (
          <div className="mb-3 flex items-start gap-2.5 rounded-2xl border border-[rgba(197,121,38,0.35)] bg-[rgba(197,121,38,0.08)] p-3.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#c57926]" />
            <p className="text-[13px] text-[color:var(--ink-soft)]">
              <strong>{unresolved.length} unresolved issue{unresolved.length > 1 ? "s" : ""}:</strong> mapped disclosures without a validated value or a documented exception note. These will block finalization later — resolve them or add a note.
            </p>
          </div>
        )}
        <div className="nice-scroll flex max-h-[30rem] flex-col gap-2 overflow-y-auto pr-1">
          {discs.map((d) => {
            const hasIssue = d.mapped && d.status !== "VALIDATED" && !d.note.trim();
            return (
              <div key={d.code} className={["rounded-2xl border p-3.5", hasIssue ? "border-[rgba(197,121,38,0.4)] bg-[rgba(197,121,38,0.06)]" : "border-[rgba(125,177,216,0.25)] bg-white/40"].join(" ")}>
                <div className="flex flex-wrap items-center gap-2.5">
                  <Checkbox checked={d.mapped} onCheckedChange={() => !locked && toggleMap(d.code)} disabled={locked || mut.pending} aria-label={`Map ${d.code}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] text-[color:var(--ink-faint)]">{d.code}</span>
                      <span className="text-[13px] font-medium text-[color:var(--ink)]">{d.title}</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[color:var(--ink-faint)]">
                      <span>{d.unit}</span>
                      <span>·</span>
                      <span className="tabular">{d.value !== null ? `${fmtNumber(d.value, 2)} ${d.unit}` : "no computed value"}</span>
                    </div>
                  </div>
                  <StatusBadge status={d.status} />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 rounded-xl text-xs text-[color:var(--ink-soft)]"
                    onClick={() => {
                      setNoteFor(noteFor === d.code ? null : d.code);
                      setNoteDraft(d.note);
                    }}
                    disabled={locked}
                  >
                    {d.note ? "Edit note" : "Add note"}
                  </Button>
                </div>
                {d.note && noteFor !== d.code && <p className="mt-2 rounded-xl bg-white/50 px-3 py-2 text-xs italic text-[color:var(--ink-soft)]">“{d.note}”</p>}
                {noteFor === d.code && (
                  <div className="mt-2.5 flex flex-col gap-2">
                    <Textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} rows={2} placeholder="Document the exception — e.g. variance explained, estimation method, annexure reference…" className="glass-subtle rounded-2xl border-white/60" />
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => setNoteFor(null)}>
                        Cancel
                      </Button>
                      <ActionButton size="sm" className="rounded-xl" pending={mut.pending} onClick={() => saveNote(d.code)} disabled={noteDraft.trim().length < 4}>
                        <Save className="mr-1.5 h-3.5 w-3.5" /> Save note
                      </ActionButton>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          {mappedCount === 0 && <span className="text-xs font-medium text-[#c34a4a]">Map at least one disclosure to proceed to draft generation.</span>}
          <ActionButton className="ml-auto" onClick={onContinue} disabled={mappedCount === 0}>
            Proceed to draft generation
          </ActionButton>
        </div>
      </SectionCard>
    </div>
  );
}

/* ── Step 5 — Generate draft ── */

function generateSections(report: BrsrReport): BrsrSection[] {
  const mapped = report.disclosures.filter((d) => d.mapped);
  const groups = [
    { title: "Environmental Performance", key: "ENVIRONMENT" },
    { title: "Social Performance", key: "SOCIAL" },
    { title: "Governance & Compliance", key: "GOVERNANCE" },
  ];
  const sections: BrsrSection[] = [
    {
      id: "sec-general",
      title: "General Disclosures",
      content: `Reporting period ${fmtDate(report.periodStart)} to ${fmtDate(report.periodEnd)} under ${report.framework}. Consolidated across ${report.scope.subsidiaryIds.length} subsidiaries, ${report.scope.businessUnitIds.length} business units and ${report.scope.projectIds.length} projects/sites.`,
      sourceRefs: ["BRSR-WIZARD"],
    },
  ];
  for (const g of groups) {
    const items = mapped.filter((d) => sectionOfCode(d.code) === g.key);
    if (!items.length) continue;
    const content = items.map((d) => `${d.title}: ${d.value !== null ? `${fmtNumber(d.value, 2)} ${d.unit}` : "value pending"} [${d.status.replaceAll("_", " ").toLowerCase()}]`).join("; ") + ".";
    sections.push({ id: `sec-${g.key.toLowerCase()}`, title: g.title, content, sourceRefs: items.map((d) => d.code) });
  }
  return sections;
}

function StepDraft({ report, onChanged, onDone }: { report: BrsrReport; onChanged: (r: BrsrReport) => void; onDone: () => void }) {
  const { toast } = useToast();
  const mut = useMutation<{ report: BrsrReport }>();
  const transMut = useMutation<{ report: BrsrReport; message: string }>();
  const preview = React.useMemo(() => generateSections(report), [report]);
  const mappedCount = report.disclosures.filter((d) => d.mapped).length;

  const transitionTo = async (to: string) => {
    const res = await transMut.run(() => apiPost<{ report: BrsrReport; message: string }>("/api/esg/brsr", { action: "transition", id: report.id, to }));
    if (res) {
      toast({ title: res.message });
      onChanged(res.report);
      return true;
    }
    toast({ variant: "destructive", title: "Transition failed", description: transMut.error ?? undefined });
    return false;
  };

  const generate = async () => {
    const saved = await mut.run(() => apiPatch<{ report: BrsrReport }>("/api/esg/brsr", { id: report.id, sections: preview }));
    if (!saved) {
      toast({ variant: "destructive", title: "Could not save sections", description: mut.error ?? undefined });
      return;
    }
    onChanged(saved.report);
    toast({ title: "Draft sections generated", description: `${preview.length} sections written from mapped disclosures.` });
    if (report.status === "DRAFT") {
      if (!(await transitionTo("CONSOLIDATION"))) return;
      if (!(await transitionTo("VALIDATION"))) return;
    } else if (report.status === "CONSOLIDATION") {
      if (!(await transitionTo("VALIDATION"))) return;
    } else {
      toast({ title: `Status unchanged`, description: `Report is already at ${report.status.replaceAll("_", " ")} — sections were refreshed in place.` });
    }
    onDone();
  };

  return (
    <div className="space-y-4">
      {mappedCount === 0 && (
        <GlassCard subtle className="flex items-start gap-3 border-[rgba(195,74,74,0.35)] p-4">
          <AlertTriangle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-[#c34a4a]" />
          <p className="text-[13px] text-[color:var(--ink-soft)]">No disclosures are mapped yet — go back to Step 4 and map at least one disclosure before generating the draft.</p>
        </GlassCard>
      )}
      <SectionCard title="Draft generation preview" description="Sections are auto-generated from mapped disclosures, grouped by pillar. Regenerating replaces existing sections." icon={PenLine}>
        <div className="flex flex-col gap-2.5">
          {preview.map((s, i) => (
            <div key={s.id} className="glass-subtle rounded-2xl p-3.5">
              <div className="flex items-center gap-2">
                <Chip tone="blue">{i + 1}</Chip>
                <span className="text-[13px] font-semibold text-[color:var(--ink)]">{s.title}</span>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[color:var(--ink-soft)]">{s.content}</p>
              {s.sourceRefs.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {s.sourceRefs.map((r) => (
                    <Chip key={r} tone="gray">
                      {r}
                    </Chip>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/50 p-3 text-xs text-[color:var(--ink-faint)]">
          <span>
            Workflow: DRAFT → CONSOLIDATION → VALIDATION. Current status: <strong>{report.status.replaceAll("_", " ")}</strong>.
          </span>
          <ActionButton onClick={generate} pending={mut.pending || transMut.pending} disabled={mappedCount === 0 || report.status === "FINALIZED"}>
            <PenLine className="mr-1.5 h-4 w-4" /> Generate sections &amp; advance
          </ActionButton>
        </div>
      </SectionCard>
    </div>
  );
}

/* ── Step 6 — Builder ── */

function StepBuilder({ report, onChanged, onDone }: { report: BrsrReport; onChanged: (r: BrsrReport) => void; onDone?: () => void }) {
  const { toast } = useToast();
  const saveMut = useMutation<{ report: BrsrReport }>();
  const addMut = useMutation<{ report: BrsrReport }>();
  const rmMut = useMutation<{ report: BrsrReport }>();
  const reMut = useMutation<{ report: BrsrReport; message: string }>();
  const [sections, setSections] = React.useState<BrsrSection[]>(report.sections);
  const [selId, setSelId] = React.useState<string>(report.sections[0]?.id ?? "");
  const [title, setTitle] = React.useState(report.sections[0]?.title ?? "");
  const [content, setContent] = React.useState(report.sections[0]?.content ?? "");
  const [compareOpen, setCompareOpen] = React.useState(false);
  const [removeOpen, setRemoveOpen] = React.useState(false);
  const locked = report.status === "FINALIZED";

  React.useEffect(() => {
    setSections(report.sections);
    if (!report.sections.some((s) => s.id === selId)) {
      setSelId(report.sections[0]?.id ?? "");
      setTitle(report.sections[0]?.title ?? "");
      setContent(report.sections[0]?.content ?? "");
    }
  }, [report]);

  const select = (id: string) => {
    const s = sections.find((x) => x.id === id);
    setSelId(id);
    setTitle(s?.title ?? "");
    setContent(s?.content ?? "");
  };
  const selected = sections.find((s) => s.id === selId) ?? null;
  const mapped = report.disclosures.filter((d) => d.mapped);
  const unresolved = unresolvedOf(report);

  const save = async () => {
    const next = sections.map((s) => (s.id === selId ? { ...s, title: title.trim() || s.title, content } : s));
    setSections(next);
    const res = await saveMut.run(() => apiPatch<{ report: BrsrReport }>("/api/esg/brsr", { id: report.id, sections: next }));
    if (res) {
      onChanged(res.report);
      toast({ title: "Report builder content saved", description: `${next.length} sections stored (server-recorded version bump).` });
    } else {
      toast({ variant: "destructive", title: "Could not save sections", description: saveMut.error ?? undefined });
    }
  };

  const addSection = async () => {
    const s: BrsrSection = { id: `custom-${Date.now()}`, title: "New section", content: "", sourceRefs: [] };
    const next = [...sections, s];
    const res = await addMut.run(() => apiPatch<{ report: BrsrReport }>("/api/esg/brsr", { id: report.id, sections: next }));
    if (res) {
      setSections(next);
      select(s.id);
      onChanged(res.report);
      toast({ title: "Section added", description: "Edit the title and content, then press Save." });
    } else {
      toast({ variant: "destructive", title: "Could not add section", description: addMut.error ?? undefined });
    }
  };

  const removeSection = async () => {
    if (!selected) return;
    const next = sections.filter((s) => s.id !== selected.id);
    const res = await rmMut.run(() => apiPatch<{ report: BrsrReport }>("/api/esg/brsr", { id: report.id, sections: next }));
    if (res) {
      setSections(next);
      select(next[0]?.id ?? "");
      setRemoveOpen(false);
      onChanged(res.report);
      toast({ title: "Section removed", description: `“${selected.title}” deleted from the report body.` });
    } else {
      toast({ variant: "destructive", title: "Could not remove section", description: rmMut.error ?? undefined });
    }
  };

  const recompute = async () => {
    const res = await reMut.run(() => apiPost<{ report: BrsrReport; message: string }>("/api/esg/brsr", { action: "recompute", id: report.id }));
    if (res) {
      onChanged(res.report);
      toast({ title: "Computed values refreshed", description: res.message });
    } else {
      toast({ variant: "destructive", title: "Refresh refused", description: reMut.error ?? undefined });
    }
  };

  return (
    <div className="space-y-4">
      <SectionCard
        title="Report builder"
        description="Compose the report body. Sections are stored server-side on save."
        icon={SquarePen}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="glass-subtle rounded-xl border-white/60" onClick={() => setCompareOpen(true)}>
              <History className="mr-1.5 h-3.5 w-3.5" /> Compare revisions
            </Button>
            <Chip tone="purple">{sections.length} sections</Chip>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[240px_1fr_260px]">
          {/* Left — navigator */}
          <div className="glass-subtle nice-scroll flex max-h-[28rem] flex-col gap-1.5 overflow-y-auto rounded-2xl p-2">
            {sections.length === 0 && <p className="p-3 text-xs text-[color:var(--ink-faint)]">No sections yet — add one or generate a draft in Step 5.</p>}
            {sections.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => select(s.id)}
                className={[
                  "rounded-xl px-3 py-2 text-left text-[13px] transition-colors",
                  s.id === selId ? "nav-active font-medium" : "text-[color:var(--ink-soft)] hover:bg-white/60",
                ].join(" ")}
              >
                <span className="mr-1.5 text-[11px] text-[color:var(--ink-faint)]">{i + 1}.</span>
                {s.title}
              </button>
            ))}
            <ActionButton variant="outline" size="sm" className="glass-subtle mt-1 rounded-xl border-white/60" pending={addMut.pending} onClick={addSection} disabled={locked}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add section
            </ActionButton>
          </div>

          {/* Center — editor */}
          <div className="flex flex-col gap-3">
            <Field label="Section title" htmlFor="builder-title">
              <Input id="builder-title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={locked || !selected} className="glass-subtle rounded-2xl border-white/60" />
            </Field>
            <Field label="Content" htmlFor="builder-content" hint="Plain text — describe results, methodology, and annexure references.">
              <Textarea id="builder-content" value={content} onChange={(e) => setContent(e.target.value)} rows={10} disabled={locked || !selected} className="glass-subtle rounded-2xl border-white/60" />
            </Field>
            {selected && selected.sourceRefs.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wide text-[color:var(--ink-faint)]">Source refs:</span>
                {selected.sourceRefs.map((r) => (
                  <Chip key={r} tone="teal">
                    {r}
                  </Chip>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              {selected && selected.id.startsWith("custom-") ? (
                <Button variant="ghost" size="sm" className="rounded-xl text-[#c34a4a] hover:bg-[rgba(195,74,74,0.08)]" onClick={() => setRemoveOpen(true)} disabled={locked}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove section
                </Button>
              ) : (
                <span className="text-xs text-[color:var(--ink-faint)]">{selected ? "Auto-generated section — cannot be removed." : ""}</span>
              )}
              <ActionButton onClick={save} pending={saveMut.pending} disabled={locked || !selected}>
                <Save className="mr-1.5 h-4 w-4" /> Save sections
              </ActionButton>
            </div>
          </div>

          {/* Right — sources */}
          <div className="glass-subtle nice-scroll flex max-h-[28rem] flex-col gap-3 overflow-y-auto rounded-2xl p-3">
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--ink-faint)]">Linked disclosures ({mapped.length})</div>
              <div className="flex flex-col gap-1.5">
                {mapped.slice(0, 8).map((d) => (
                  <div key={d.code} className="flex items-center justify-between gap-2 rounded-xl bg-white/50 px-2.5 py-1.5">
                    <span className="truncate text-[12px] text-[color:var(--ink-soft)]">{d.title}</span>
                    <StatusBadge status={d.status} dot={false} />
                  </div>
                ))}
                {mapped.length === 0 && <p className="text-xs text-[color:var(--ink-faint)]">No mapped disclosures.</p>}
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--ink-faint)]">Validation warnings ({unresolved.length})</div>
              {unresolved.length === 0 ? (
                <p className="flex items-center gap-1.5 text-xs text-[#1d6b40]">
                  <CheckCircle2 className="h-3.5 w-3.5" /> All mapped disclosures validated or documented.
                </p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {unresolved.slice(0, 5).map((d) => (
                    <li key={d.code} className="flex items-start gap-1.5 text-xs text-[#9c5d1b]">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {d.code} — {d.status.replaceAll("_", " ").toLowerCase()}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <ActionButton variant="outline" size="sm" className="glass-subtle rounded-xl border-white/60" pending={reMut.pending} onClick={recompute} disabled={locked}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh computed values
            </ActionButton>
          </div>
        </div>
      </SectionCard>

      <GlassDialog open={compareOpen} onOpenChange={setCompareOpen} title="Revision history" description="Server-recorded versions of this report." wide>
        <VersionsTimeline versions={report.versions} />
      </GlassDialog>

      <ConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title="Remove section?"
        message={`“${selected?.title ?? ""}” will be removed from the report body when saved.`}
        confirmLabel="Remove section"
        destructive
        pending={rmMut.pending}
        onConfirm={() => void removeSection()}
      />
      {onDone && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[rgba(35,134,83,0.3)] bg-[rgba(35,134,83,0.06)] px-4 py-3">
          <span className="text-[12.5px] font-medium text-[color:var(--ink-soft)]">
            Sections saved server-side ({sections.length} sections). Next: record the sign-off, then finalize &amp; export.
          </span>
          <Button size="sm" className="rounded-xl" onClick={onDone}>
            Continue to Review &amp; Sign-off <PenLine className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

/* ── Step 7 — Review & Sign-off ── */

function StepReview({ report, onChanged }: { report: BrsrReport; onChanged: (r: BrsrReport) => void }) {
  const { toast } = useToast();
  const transMut = useMutation<{ report: BrsrReport; message: string }>();
  const signMut = useMutation<{ report: BrsrReport; message: string }>();
  const [role, setRole] = React.useState(SIGNOFF_ROLES[0]);
  const [name, setName] = React.useState("");
  const [decision, setDecision] = React.useState("APPROVED");
  const [comment, setComment] = React.useState("");
  const locked = report.status === "FINALIZED";
  const unresolved = unresolvedOf(report);
  const next = NEXT_STATUS[report.status];

  const transition = async () => {
    if (!next) return;
    const res = await transMut.run(() => apiPost<{ report: BrsrReport; message: string }>("/api/esg/brsr", { action: "transition", id: report.id, to: next }));
    if (res) {
      toast({ title: res.message });
      onChanged(res.report);
    } else {
      toast({ variant: "destructive", title: "Transition failed", description: transMut.error ?? undefined });
    }
  };

  const submitSignoff = async () => {
    const res = await signMut.run(() => apiPost<{ report: BrsrReport; message: string }>("/api/esg/brsr", { action: "signoff", id: report.id, role, name: name.trim(), decision, comment }));
    if (res) {
      toast({ title: res.message, description: `${decision} recorded by ${name.trim()} (${role}).` });
      setName("");
      setComment("");
      onChanged(res.report);
    } else {
      toast({ variant: "destructive", title: "Sign-off refused", description: signMut.error ?? undefined });
    }
  };

  return (
    <div className="space-y-4">
      <SectionCard title="Pre-sign-off review" description="Issues that must be resolved or documented before the report can be finalized." icon={ClipboardCheck}>
        {unresolved.length === 0 ? (
          <div className="flex items-center gap-2 rounded-2xl border border-[rgba(35,134,83,0.3)] bg-[rgba(35,134,83,0.07)] p-3.5 text-[13px] font-medium text-[#1d6b40]">
            <CheckCircle2 className="h-4 w-4" /> No unresolved issues — every mapped disclosure is validated or carries a documented note.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {unresolved.map((d) => (
              <div key={d.code} className="flex items-center justify-between gap-3 rounded-2xl border border-[rgba(197,121,38,0.35)] bg-[rgba(197,121,38,0.07)] px-3.5 py-2.5">
                <span className="text-[13px] text-[color:var(--ink-soft)]">
                  <span className="font-mono text-xs">{d.code}</span> — {d.title}
                </span>
                <StatusBadge status={d.status} />
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/50 p-3 text-xs text-[color:var(--ink-faint)]">
          <span>
            Lifecycle position: <strong>{report.status.replaceAll("_", " ")}</strong>
            {next ? ` → next: ${next.replaceAll("_", " ")}` : " → finalized"}
          </span>
          <ActionButton onClick={transition} pending={transMut.pending} disabled={!next || locked}>
            {next ? `Move to ${next.replaceAll("_", " ").toLowerCase()}` : "Workflow complete"}
          </ActionButton>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectionCard title="Record a sign-off" description="Each role can sign off once — duplicates are refused by the server." icon={PenTool}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Role" htmlFor="so-role">
              <Select value={role} onValueChange={setRole} disabled={locked}>
                <SelectTrigger id="so-role" className="glass-subtle rounded-2xl border-white/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-strong rounded-2xl border-white/70">
                  {SIGNOFF_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Approver name" required htmlFor="so-name" hint={name.trim().length === 0 ? "Full name of the approver." : undefined}>
              <Input id="so-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ramesh Kulkarni" disabled={locked} className="glass-subtle rounded-2xl border-white/60" />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Decision" required>
              <RadioGroup value={decision} onValueChange={setDecision} className="flex gap-4" disabled={locked}>
                <label className="glass-subtle flex flex-1 cursor-pointer items-center gap-2.5 rounded-2xl border border-white/60 px-3.5 py-2.5">
                  <RadioGroupItem value="APPROVED" id="dec-appr" />
                  <span className="text-[13px] font-medium text-[#1d6b40]">Approved</span>
                </label>
                <label className="glass-subtle flex flex-1 cursor-pointer items-center gap-2.5 rounded-2xl border border-white/60 px-3.5 py-2.5">
                  <RadioGroupItem value="REJECTED" id="dec-rej" />
                  <span className="text-[13px] font-medium text-[#a53b3b]">Rejected</span>
                </label>
              </RadioGroup>
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Comment" htmlFor="so-comment" hint="Optional — captured with the sign-off record.">
              <Textarea id="so-comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={2} disabled={locked} className="glass-subtle rounded-2xl border-white/60" />
            </Field>
          </div>
          <div className="mt-4 flex justify-end">
            <ActionButton onClick={submitSignoff} pending={signMut.pending} disabled={locked || !name.trim()}>
              <PenTool className="mr-1.5 h-4 w-4" /> Record sign-off
            </ActionButton>
          </div>
        </SectionCard>
        <SectionCard title={`Sign-offs recorded (${report.signoffs.length})`} description="Approvals and rejections captured for this report." icon={ScrollText}>
          <SignoffsTimeline signoffs={report.signoffs} />
        </SectionCard>
      </div>
    </div>
  );
}

/* ── Step 8 — Finalize & Export ── */

function StepFinalize({ report, onChanged }: { report: BrsrReport; onChanged: (r: BrsrReport) => void }) {
  const { toast } = useToast();
  const finMut = useMutation<{ report: BrsrReport; message: string }>();
  const [format, setFormat] = React.useState<"CSV" | "JSON" | "TXT" | "PDF">("PDF");
  const { doExport, busyKey } = useBrsrExport((r) => onChanged(r));
  const locked = report.status === "FINALIZED";
  const unresolved = unresolvedOf(report);
  const approvedSignoffs = report.signoffs.filter((s) => s.decision === "APPROVED");

  const finalize = async () => {
    const res = await finMut.run(() => apiPost<{ report: BrsrReport; message: string }>("/api/esg/brsr", { action: "transition", id: report.id, to: "FINALIZED" }));
    if (res) {
      toast({ title: "Report finalized", description: res.message });
      onChanged(res.report);
    } else {
      toast({ variant: "destructive", title: "Cannot finalize", description: finMut.error ?? undefined });
    }
  };

  const requirements = [
    { ok: unresolved.length === 0, label: "All mapped disclosures validated or documented", detail: unresolved.length ? `${unresolved.length} unresolved issue${unresolved.length > 1 ? "s" : ""}` : "Clean" },
    { ok: approvedSignoffs.length >= 1, label: "At least one approved sign-off recorded", detail: approvedSignoffs.length ? `${approvedSignoffs.length} approval(s)` : "None yet" },
    { ok: report.status === "SIGNOFF" || locked, label: "Report is at the Sign-off stage", detail: `Currently ${report.status.replaceAll("_", " ").toLowerCase()}` },
  ];

  return (
    <div className="space-y-4">
      <SectionCard title="Finalization requirements" description="Checked live against the current report state." icon={ShieldCheck}>
        <div className="flex flex-col gap-2">
          {requirements.map((r) => (
            <div key={r.label} className="flex items-center gap-2.5 rounded-2xl border border-[rgba(125,177,216,0.25)] bg-white/40 px-3.5 py-2.5">
              {r.ok ? <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-[#238653]" /> : <XCircle className="h-4.5 w-4.5 shrink-0 text-[#c34a4a]" />}
              <span className="flex-1 text-[13px] font-medium text-[color:var(--ink)]">{r.label}</span>
              <span className="text-xs text-[color:var(--ink-faint)]">{r.detail}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-[color:var(--ink-faint)]">
            {locked ? "This report is finalized and locked." : report.status !== "SIGNOFF" ? "Advance the report to Sign-off in Step 7 before finalizing." : "Finalizing locks the report — further changes require a controlled revision."}
          </span>
          <ActionButton onClick={finalize} pending={finMut.pending} disabled={locked || report.status !== "SIGNOFF"}>
            <BadgeCheck className="mr-1.5 h-4 w-4" /> Finalize report
          </ActionButton>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectionCard title="Export report" description="Exports are recorded server-side with actor and timestamp; the file downloads locally." icon={Download}>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-40">
              <Field label="Format" htmlFor="exp-format">
                <Select value={format} onValueChange={(v) => setFormat(v as "CSV" | "JSON" | "TXT")}>
                  <SelectTrigger id="exp-format" className="glass-subtle rounded-2xl border-white/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="glass-strong rounded-2xl border-white/70">
                    <SelectItem value="PDF">PDF — print-ready final report</SelectItem>
                    <SelectItem value="JSON">JSON — full snapshot</SelectItem>
                    <SelectItem value="CSV">CSV — disclosures &amp; sections</SelectItem>
                    <SelectItem value="TXT">TXT — pretty report</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <ActionButton onClick={() => void doExport(report, format)} pending={busyKey === `${report.id}:${format}`}>
              <Download className="mr-1.5 h-4 w-4" /> Export &amp; download
            </ActionButton>
          </div>
          <p className="mt-3 text-xs text-[color:var(--ink-faint)]">
            {format === "PDF"
              ? "Opens a print-ready A4 layout (cover page, disclosures, sign-offs and the subsidiaries' BRSR data annexure) — choose \"Save as PDF\" in the print dialog."
              : format === "JSON"
              ? "JSON contains the complete server snapshot: metadata, scope, disclosures, sections, sign-offs."
              : format === "CSV"
                ? "CSV lists all disclosures with values/status plus the report sections."
                : "TXT renders a readable plain-text version of the report."}
          </p>
        </SectionCard>
        <SectionCard title={`Export history (${report.exports.length})`} description="Server-recorded export ledger." icon={ScrollText}>
          {report.exports.length === 0 ? (
            <EmptyState icon={Download} title="No exports yet" message="Exported files are recorded here with format, time, and actor." />
          ) : (
            <div className="nice-scroll flex max-h-60 flex-col gap-2 overflow-y-auto pr-1">
              {[...report.exports].reverse().map((e, i) => (
                <div key={i} className="flex items-center justify-between gap-3 rounded-2xl bg-white/50 px-3.5 py-2.5">
                  <Chip tone={e.format === "JSON" ? "blue" : e.format === "CSV" ? "teal" : "purple"}>{e.format}</Chip>
                  <span className="text-xs text-[color:var(--ink-faint)]">{fmtDateTime(e.at)}</span>
                  <span className="text-xs font-medium text-[color:var(--ink-soft)]">{e.by}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

/* ── Step 9 — History ── */

function StepHistory({ report, onChanged, onGoStep }: { report: BrsrReport; onChanged: (r: BrsrReport) => void; onGoStep: (n: number) => void }) {
  const { toast } = useToast();
  const mut = useMutation<{ report: BrsrReport }>();
  const [reason, setReason] = React.useState("");
  const locked = report.status !== "FINALIZED";

  const revise = async () => {
    const res = await mut.run(() => apiPatch<{ report: BrsrReport }>("/api/esg/brsr", { id: report.id, action: "revise", reason: reason.trim() }));
    if (res) {
      toast({ title: "Controlled revision created", description: `${res.report.ref} returned to Review as version ${res.report.version}.` });
      setReason("");
      onChanged(res.report);
      onGoStep(7);
    } else {
      toast({ variant: "destructive", title: "Revision refused", description: mut.error ?? undefined });
    }
  };

  return (
    <div className="space-y-4">
      <SectionCard
        title="Version history"
        description="Append-only record of every workflow movement and content change."
        icon={History}
        actions={<Chip tone={report.status === "FINALIZED" ? "green" : "amber"}>{report.status.replaceAll("_", " ")}</Chip>}
      >
        <VersionsTimeline versions={report.versions} />
        {report.finalizedAt && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-[rgba(35,134,83,0.3)] bg-[rgba(35,134,83,0.07)] p-3.5 text-[13px] font-medium text-[#1d6b40]">
            <BadgeCheck className="h-4 w-4" /> Finalized on {fmtDateTime(report.finalizedAt)} — currently version {report.version}.
          </div>
        )}
      </SectionCard>
      <SectionCard title="Controlled revision" description="Reopens a finalized report for amendments. Creates a new version and returns the report to Review." icon={ShieldCheck}>
        {locked ? (
          <p className="text-[13px] text-[color:var(--ink-soft)]">Controlled revisions are available once the report is finalized. Current status: <strong>{report.status.replaceAll("_", " ")}</strong>.</p>
        ) : (
          <>
            <Field label="Reason for revision" required hint="Minimum 4 characters — recorded in the audit trail." htmlFor="revise-reason">
              <Input id="revise-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Scope 2 restated after utility invoice correction" className="glass-subtle rounded-2xl border-white/60" />
            </Field>
            <div className="mt-4 flex justify-end">
              <ActionButton onClick={revise} pending={mut.pending} disabled={reason.trim().length < 4}>
                <ShieldCheck className="mr-1.5 h-4 w-4" /> Create controlled revision
              </ActionButton>
            </div>
          </>
        )}
      </SectionCard>
    </div>
  );
}

/* ── Wizard shell ── */

function BrsrWizard({ initialReportId }: { initialReportId?: string }) {
  const { navigate } = useWorkspace();
  const { toast } = useToast();
  const detail = useApi<BrsrDetailData>(initialReportId ? `/api/esg/brsr?id=${initialReportId}` : null);
  const list = useApi<BrsrListData>("/api/esg/brsr");
  const [report, setReport] = React.useState<BrsrReport | null>(null);
  const [step, setStep] = React.useState(1);
  const stepInitRef = React.useRef(false);
  const stepMut = useMutation<{ report: BrsrReport }>();

  React.useEffect(() => {
    if (detail.data?.report) {
      setReport(detail.data.report);
      if (!stepInitRef.current) {
        stepInitRef.current = true;
        setStep(Math.min(Math.max(detail.data.report.wizardStep || 1, 1), 9));
      }
    }
  }, [detail.data]);

  const persistStep = async (n: number) => {
    if (!report || report.status === "FINALIZED") return;
    const res = await stepMut.run(() => apiPatch<{ report: BrsrReport }>("/api/esg/brsr", { id: report.id, wizardStep: n }));
    if (res) setReport((prev) => (prev ? { ...prev, wizardStep: n } : prev));
    else toast({ variant: "destructive", title: "Could not persist wizard position", description: stepMut.error ?? undefined });
  };

  const goStep = (n: number) => {
    setStep(n);
    void persistStep(n);
  };
  const onChanged = (r: BrsrReport) => setReport(r);

  const maxReached = Math.max(report?.wizardStep ?? 1, step);
  const back = () => navigate("brsr");

  return (
    <div className="view-in space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <TipIconButton tip="Back to BRSR Center" onClick={back} aria-label="Back to BRSR Center">
            <ArrowLeft className="h-4 w-4" />
          </TipIconButton>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[color:var(--ink)] sm:text-2xl">
              {report ? report.title : "New BRSR Report"}
            </h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[color:var(--ink-faint)]">
              {report ? (
                <>
                  <span className="font-mono">{report.ref}</span>
                  <span>·</span>
                  <span>{report.financialYear}</span>
                  <span>·</span>
                  <span>wizard position persisted at step {report.wizardStep}</span>
                </>
              ) : (
                <span>9-step guided workflow — information → scope → consolidation → mapping → draft → builder → review → finalize → history</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {report && <StatusBadge status={report.status} />}
          {report && <span className="text-xs text-[color:var(--ink-faint)]">v{report.version}</span>}
        </div>
      </div>

      <GlassCard className="p-3 sm:px-4">
        <Stepper step={step} maxReached={maxReached} canNavigate={!!report} onGo={goStep} />
      </GlassCard>

      {initialReportId && detail.error && !report ? (
        <GlassCard>
          <ErrorState message={detail.error} onRetry={() => detail.refetch()} />
        </GlassCard>
      ) : initialReportId && !report ? (
        <GlassCard>
          <LoadingBlock rows={5} label="Loading report…" />
        </GlassCard>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            {step === 1 && (
              <StepInfo
                report={report}
                onSaved={(r) => {
                  onChanged(r);
                  goStep(2);
                }}
              />
            )}
            {step === 2 && report && <StepScope report={report} onSaved={onChanged} onContinue={() => goStep(3)} />}
            {step === 3 && report && <StepConsolidation report={report} onChanged={onChanged} onContinue={() => goStep(4)} />}
            {step === 4 && report && <StepMapping report={report} catalog={list.data?.catalog ?? []} onChanged={onChanged} onContinue={() => goStep(5)} />}
            {step === 5 && report && <StepDraft report={report} onChanged={onChanged} onDone={() => goStep(6)} />}
            {step === 6 && report && <StepBuilder report={report} onChanged={onChanged} onDone={() => goStep(7)} />}
            {step === 7 && report && <StepReview report={report} onChanged={onChanged} />}
            {step === 8 && report && <StepFinalize report={report} onChanged={onChanged} />}
            {step === 9 && report && <StepHistory report={report} onChanged={onChanged} onGoStep={goStep} />}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

/* ════════════════════════════ C) REPORT DETAIL ════════════════════════════ */

function BrsrDetail({ reportId }: { reportId: string }) {
  const { toast } = useToast();
  const { navigate } = useWorkspace();
  const detail = useApi<BrsrDetailData>(`/api/esg/brsr?id=${reportId}`);
  const revMut = useMutation<{ report: BrsrReport }>();
  const delMut = useMutation<{ success: boolean }>();
  const [reviseOpen, setReviseOpen] = React.useState(false);
  const [discardOpen, setDiscardOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const report = detail.data?.report ?? null;

  const revise = async () => {
    const res = await revMut.run(() => apiPatch<{ report: BrsrReport }>("/api/esg/brsr", { id: reportId, action: "revise", reason: reason.trim() }));
    if (res) {
      toast({ title: "Controlled revision created", description: `${res.report.ref} returned to Review as version ${res.report.version}.` });
      setReason("");
      setReviseOpen(false);
      detail.refetch();
    } else {
      toast({ variant: "destructive", title: "Revision refused", description: revMut.error ?? undefined });
    }
  };

  const discard = async (why: string) => {
    const res = await delMut.run(() => apiDelete<{ success: boolean }>("/api/esg/brsr", { id: reportId, reason: why || "Draft discarded from report detail" }));
    if (res) {
      toast({ title: "Draft discarded", description: "The report was removed from the register." });
      setDiscardOpen(false);
      navigate("brsr");
    } else {
      toast({ variant: "destructive", title: "Could not discard", description: delMut.error ?? undefined });
    }
  };

  return (
    <div className="view-in space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <TipIconButton tip="Back to BRSR Center" onClick={() => navigate("brsr")} aria-label="Back to BRSR Center">
            <ArrowLeft className="h-4 w-4" />
          </TipIconButton>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[color:var(--ink)] sm:text-2xl">Report detail</h1>
            <p className="text-xs text-[color:var(--ink-faint)]">Status, timeline, sign-offs, versions, and exports.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {report && (
            <>
              <Button variant="outline" size="sm" className="glass-subtle rounded-xl border-white/60" onClick={() => navigate("brsr", { wizardReportId: report.id })}>
                <SquarePen className="mr-1.5 h-3.5 w-3.5" /> Open builder
              </Button>
              <ExportMenu report={report} />
              {report.status === "FINALIZED" && (
                <Button variant="outline" size="sm" className="glass-subtle rounded-xl border-white/60" onClick={() => setReviseOpen(true)}>
                  <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Revise
                </Button>
              )}
              {report.status === "DRAFT" && (
                <Button variant="destructive" size="sm" className="rounded-xl" onClick={() => setDiscardOpen(true)}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Discard
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {detail.error ? (
        <GlassCard>
          <ErrorState message={detail.error} onRetry={() => detail.refetch()} />
        </GlassCard>
      ) : !report ? (
        <GlassCard>
          <LoadingBlock rows={6} label="Loading report…" />
        </GlassCard>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <SectionCard title="Metadata" description="Report identity and ownership." icon={FileText} className="xl:col-span-2">
              <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                <InfoRow label="Reference">
                  <span className="font-mono text-xs">{report.ref}</span>
                </InfoRow>
                <InfoRow label="Status">
                  <StatusBadge status={report.status} />
                </InfoRow>
                <InfoRow label="Financial year">{report.financialYear}</InfoRow>
                <InfoRow label="Framework">{report.framework}</InfoRow>
                <InfoRow label="Version">v{report.version}</InfoRow>
                <InfoRow label="Owner">{report.ownerName}</InfoRow>
                <InfoRow label="Period">
                  {fmtDate(report.periodStart)} — {fmtDate(report.periodEnd)}
                </InfoRow>
                <InfoRow label="Finalized at">{report.finalizedAt ? fmtDateTime(report.finalizedAt) : "—"}</InfoRow>
                <InfoRow label="Scope">
                  {report.scope.subsidiaryIds.length} subs · {report.scope.businessUnitIds.length} units · {report.scope.projectIds.length} projects
                </InfoRow>
                <InfoRow label="Source data">
                  {report.approvedSubmissionCount ?? 0} approved / {report.sourceSubmissionCount ?? 0} total
                </InfoRow>
              </div>
              {report.description && <p className="mt-3 rounded-2xl bg-white/50 p-3 text-[13px] text-[color:var(--ink-soft)]">{report.description}</p>}
              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between text-xs text-[color:var(--ink-faint)]">
                  <span>Data completion</span>
                </div>
                <GlassProgress value={report.completionPct ?? 0} showLabel tone={(report.completionPct ?? 0) >= 80 ? "green" : "blue"} />
              </div>
            </SectionCard>
            <SectionCard title={`Sign-offs (${report.signoffs.length})`} description="Approval decisions on record." icon={PenTool}>
              <SignoffsTimeline signoffs={report.signoffs} />
            </SectionCard>
          </div>

          <SectionCard title={`Disclosures (${report.disclosures.length})`} description="Mapped BRSR Core disclosures with consolidated values." icon={ClipboardCheck}>
            <DisclosuresTable disclosures={report.disclosures} />
          </SectionCard>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <SectionCard title={`Exports (${report.exports.length})`} description="Server-recorded export ledger." icon={Download}>
              {report.exports.length === 0 ? (
                <EmptyState icon={Download} title="No exports yet" />
              ) : (
                <div className="flex flex-col gap-2">
                  {[...report.exports].reverse().map((e, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 rounded-2xl bg-white/50 px-3.5 py-2.5">
                      <Chip tone={e.format === "JSON" ? "blue" : e.format === "CSV" ? "teal" : "purple"}>{e.format}</Chip>
                      <span className="text-xs text-[color:var(--ink-faint)]">{fmtDateTime(e.at)}</span>
                      <span className="text-xs font-medium text-[color:var(--ink-soft)]">{e.by}</span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
            <SectionCard title={`Versions (${report.versions.length})`} description="Append-only version history." icon={History}>
              <VersionsTimeline versions={report.versions} />
            </SectionCard>
          </div>
        </>
      )}

      <GlassDialog
        open={reviseOpen}
        onOpenChange={setReviseOpen}
        title="Create controlled revision"
        description="Reopens the finalized report for amendments. A new version is created and the report returns to Review."
        footer={
          <>
            <Button variant="outline" className="glass-subtle rounded-2xl" onClick={() => setReviseOpen(false)} disabled={revMut.pending}>
              Cancel
            </Button>
            <ActionButton onClick={revise} pending={revMut.pending} disabled={reason.trim().length < 4}>
              <ShieldCheck className="mr-1.5 h-4 w-4" /> Create revision
            </ActionButton>
          </>
        }
      >
        <Field label="Reason" required hint="Minimum 4 characters — recorded in the audit trail.">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Restated water withdrawal after meter audit" className="glass-subtle rounded-2xl border-white/60" />
        </Field>
      </GlassDialog>

      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Discard draft report?"
        message="This draft will be permanently removed. Finalized reports cannot be discarded."
        confirmLabel="Discard draft"
        destructive
        requireReason
        pending={delMut.pending}
        onConfirm={(why) => void discard(why ?? "")}
      />
    </div>
  );
}

/* ════════════════════════════ ROOT ════════════════════════════ */

export default function BrsrView() {
  const { params } = useWorkspace();
  const wizardReportId = typeof params.wizardReportId === "string" && params.wizardReportId ? params.wizardReportId : undefined;
  const isCreateWizard = params.wizard !== undefined && !wizardReportId;
  const detailId = typeof params.detailId === "string" && params.detailId ? params.detailId : undefined;

  if (isCreateWizard || wizardReportId) return <BrsrWizard key={wizardReportId ?? "new"} initialReportId={wizardReportId} />;
  if (detailId) return <BrsrDetail reportId={detailId} />;
  return <BrsrDashboard />;
}
