"use client";

// MEIL Intelligence — adaptive response renderer (Phase 5 + 21).
// Renders validated structured blocks into interactive intelligence cards.
// Unknown block types fall back to safe text. Every visible action is wired
// to a real behaviour — no decorative buttons.

import { memo, useState } from "react";
import {
  BarChart3, LineChart, PieChart, ScatterChart, Table2, FileText, ScrollText,
  ShieldCheck, FileCheck2, Sparkles, Building2, Landmark, Boxes, User2,
  ClipboardList, History, ArrowRight, AlertTriangle, CheckCircle2, XCircle,
  Clock, Send, Copy, Save, MousePointerClick, Lightbulb,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart as ReLineChart, Line, PieChart as RePieChart, Pie, Cell, Legend,
} from "recharts";
import type {
  ContentBlock, KpiBlock, DataTableBlock, ChartBlock, ComparisonBlock,
  ExecutiveSummaryBlock, EntityProfileBlock, SubmissionRefBlock,
  ApprovalTimelineBlock, EvidenceRefBlock, ActivityTimelineBlock,
  RecommendationBlock, ActionPreviewBlock, ConfirmationBlock, FollowUpsBlock,
} from "@/lib/copilot/types";
import { useCopilot } from "@/lib/copilot/store";
import { copilotApi } from "@/lib/copilot/client";

const CHART_COLORS = ["#315CFF", "#8B5CF6", "#62B8FF", "#7045D6", "#16A67A", "#E9A23B"];

/* ── navigation into the existing Group workspace ───────────────────────────── */

function useNavigateView() {
  // The copilot lives inside the Group Admin workspace; navigation goes
  // through the workspace store (lazy import avoids a circular dependency).
  return (view: string, detailId?: string, detailTab?: string) => {
    import("@/lib/esg/store").then(({ useWorkspace }) => {
      useWorkspace.getState().navigate(view as never, detailId ? { detailId, detailTab } : {});
    }).catch(() => undefined);
  };
}

/* ── text ───────────────────────────────────────────────────────────────────── */

function TextBlock({ text }: { text: string }) {
  return <div className="mc-bubble-assistant">{text}</div>;
}

/* ── KPI cards ──────────────────────────────────────────────────────────────── */

function KpiCards({ block }: { block: KpiBlock }) {
  return (
    <div className="mc-block glass-sheen">
      <div className="mc-block-head">
        <Sparkles size={15} className="mc-block-icon" />
        <span className="mc-block-title">{block.title ?? "Key metrics"}</span>
        <span className="mc-block-meta">{[block.scope, block.period].filter(Boolean).join(" · ")}</span>
      </div>
      <div className="mc-kpi-grid">
        {block.items.map((k, i) => (
          <div className="mc-kpi" key={i}>
            <div style={{ display: "flex", alignItems: "baseline" }}>
              <span className="mc-kpi-value">{k.value}</span>
              {k.unit ? <span style={{ fontSize: 11, color: "var(--mc-muted)", marginLeft: 4 }}>{k.unit}</span> : null}
              {k.delta ? <span className={`mc-kpi-delta ${k.deltaDirection === "up" ? "up" : "flat"}`}>{k.delta}</span> : null}
            </div>
            <div className="mc-kpi-label">{k.label}</div>
            {k.hint ? <div className="mc-kpi-hint">{k.hint}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── data table ─────────────────────────────────────────────────────────────── */

function DataTable({ block }: { block: DataTableBlock }) {
  return (
    <div className="mc-block">
      <div className="mc-block-head">
        <Table2 size={15} className="mc-block-icon" />
        <span className="mc-block-title">{block.title ?? "Data"}</span>
      </div>
      <div className="mc-table-wrap">
        <table className="mc-table">
          <thead>
            <tr>
              {block.columns.map((c) => (
                <th key={c.key} className={c.align === "right" ? "mc-th-right" : undefined}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((r, i) => (
              <tr key={i}>
                {r.cells.map((cell, j) => (
                  <td key={j} className={block.columns[j]?.align === "right" ? "mc-td-right" : undefined}>{cell ?? "—"}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {block.note ? <div className="mc-block-note">{block.note}</div> : null}
    </div>
  );
}

/* ── charts (recharts, grounded in tool data) ───────────────────────────────── */

function ChartBlockView({ block }: { block: ChartBlock }) {
  const data = block.series[0]?.points ?? [];
  const multi = block.series.length > 1;
  return (
    <div className="mc-block">
      <div className="mc-block-head">
        {block.chartType === "line" ? <LineChart size={15} className="mc-block-icon" /> : block.chartType === "donut" ? <PieChart size={15} className="mc-block-icon" /> : block.chartType === "scatter" ? <ScatterChart size={15} className="mc-block-icon" /> : <BarChart3 size={15} className="mc-block-icon" />}
        <span className="mc-block-title">{block.title ?? "Chart"}</span>
        <span className="mc-block-meta">{[block.scope, block.period, block.unit ? `unit: ${block.unit}` : null].filter(Boolean).join(" · ")}</span>
      </div>
      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer>
          {block.chartType === "donut" ? (
            <RePieChart>
              <Pie data={data} dataKey="value" nameKey="label" innerRadius={55} outerRadius={85} paddingAngle={2}>
                {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </RePieChart>
          ) : multi ? (
            <ReLineChart data={data} margin={{ top: 6, right: 10, bottom: 0, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(180,205,240,0.5)" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              {block.series.map((s, i) => (
                <Line key={s.name} type="monotone" dataKey={s.name} data={mergeSeries(block)} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={false} />
              ))}
            </ReLineChart>
          ) : (
            <BarChart data={data} margin={{ top: 6, right: 10, bottom: 0, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(180,205,240,0.5)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip cursor={{ fill: "rgba(98,184,255,0.08)" }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      {block.calculationBasis ? <div className="mc-block-note">Calculation basis: {block.calculationBasis}</div> : null}
    </div>
  );
}

function mergeSeries(block: ChartBlock): Record<string, string | number>[] {
  const labels = block.series[0]?.points.map((p) => p.label) ?? [];
  return labels.map((label) => {
    const row: Record<string, string | number> = { label };
    for (const s of block.series) {
      const p = s.points.find((x) => x.label === label);
      row[s.name] = p?.value ?? 0;
    }
    return row;
  });
}

/* ── comparison ─────────────────────────────────────────────────────────────── */

function ComparisonView({ block }: { block: ComparisonBlock }) {
  const data = block.entityLabels.map((label, i) => {
    const row: Record<string, string | number> = { label };
    block.metrics.forEach((m) => (row[m.label] = m.values[i] ?? 0));
    return row;
  });
  return (
    <div className="mc-block">
      <div className="mc-block-head">
        <BarChart3 size={15} className="mc-block-icon" />
        <span className="mc-block-title">{block.title ?? "Comparison"}</span>
        {block.period ? <span className="mc-block-meta">{block.period}</span> : null}
      </div>
      <div style={{ width: "100%", height: Math.max(200, block.entityLabels.length * 34) }}>
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 18, bottom: 0, left: 12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(180,205,240,0.5)" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="label" width={128} tick={{ fontSize: 11 }} />
            <Tooltip cursor={{ fill: "rgba(98,184,255,0.08)" }} />
            <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            {block.metrics.map((m, i) => (
              <Bar key={m.label} dataKey={m.label} radius={[0, 5, 5, 0]} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ── executive summary ──────────────────────────────────────────────────────── */

function ExecutiveSummary({ block }: { block: ExecutiveSummaryBlock }) {
  return (
    <div className="mc-block glass-sheen" style={{ borderColor: "rgba(98,184,255,0.5)" }}>
      <div className="mc-block-head">
        <FileText size={15} className="mc-block-icon" />
        <span className="mc-block-title">{block.title ?? "Executive Summary"}</span>
        <span className="mc-block-meta">{[block.scope, block.period].filter(Boolean).join(" · ")}</span>
      </div>
      <p style={{ fontSize: 13, lineHeight: 1.62, margin: 0 }}>{block.summary}</p>
      {block.highlights.length ? (
        <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 12.5, lineHeight: 1.7 }}>
          {block.highlights.map((h, i) => <li key={i}>{h}</li>)}
        </ul>
      ) : null}
    </div>
  );
}

/* ── entity profile ─────────────────────────────────────────────────────────── */

function EntityProfile({ block }: { block: EntityProfileBlock }) {
  const navigate = useNavigateView();
  const Icon = block.entityType === "subsidiary" ? Building2 : block.entityType === "business_unit" ? Landmark : block.entityType === "project" ? Boxes : block.entityType === "user" ? User2 : ShieldCheck;
  return (
    <div className="mc-block">
      <div className="mc-profile-head">
        <div style={{ width: 38, height: 38, borderRadius: 12, background: "linear-gradient(135deg, #62B8FF, #8B5CF6)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
          <Icon size={19} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mc-profile-name">{block.name}</div>
          <div className="mc-profile-sub">{[block.code, block.subtitle].filter(Boolean).join(" · ")}</div>
        </div>
        {block.status ? <span className={`mc-status-badge ${block.status}`}>{block.status}</span> : null}
      </div>
      <div className="mc-profile-fields">
        {block.fields.map((f, i) => (
          <div className="mc-field" key={i}>
            <span className="mc-field-label">{f.label}</span>
            <span className="mc-field-value">{f.value}</span>
          </div>
        ))}
      </div>
      {block.navView ? (
        <div style={{ marginTop: 12 }}>
          <button className="mc-chip-btn" onClick={() => navigate(block.navView!.view, block.navView!.detailId, block.navView!.detailTab)}>
            <MousePointerClick size={12} /> {block.navView.label ?? "Open record"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* ── submission card ────────────────────────────────────────────────────────── */

function SubmissionCard({ block }: { block: SubmissionRefBlock }) {
  const navigate = useNavigateView();
  const dl = block.deadlineStatus ?? "";
  const dlClass = dl === "Overdue" ? "Overdue" : dl === "Due Soon" ? "due-soon" : "ok";
  return (
    <div className="mc-sub-card" onClick={() => navigate("submissions", block.submissionId)} title="Open in Submission Center">
      <span className="mc-sub-ref">{block.ref}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="mc-sub-title">{block.title}</div>
        <div className="mc-sub-meta">
          {[block.entity, block.status, dl !== "Upcoming" ? dl : null, block.dueDate ? `due ${block.dueDate.slice(0, 10)}` : null].filter(Boolean).join(" · ")}
        </div>
      </div>
      {dl && dl !== "Submitted On Time" ? <span className={`mc-deadline-flag ${dlClass}`}>{dl}</span> : null}
      <span className={`mc-status-badge ${block.status === "Approved" ? "APPROVED" : block.status === "Rejected" ? "REJECTED" : block.status === "Returned for Correction" ? "CHANGES_REQUESTED" : "SUBMITTED"}`}>{block.status}</span>
      <ArrowRight size={14} style={{ color: "var(--mc-muted)", flexShrink: 0 }} />
    </div>
  );
}

/* ── approval timeline ──────────────────────────────────────────────────────── */

function ApprovalTimeline({ block }: { block: ApprovalTimelineBlock }) {
  const iconFor = (d?: string) =>
    d === "APPROVED" ? <CheckCircle2 size={13} color="var(--mc-success)" /> :
    d === "REJECTED" || d === "RETURNED" ? <XCircle size={13} color="var(--mc-danger)" /> :
    d === "RESUBMITTED" ? <History size={13} color="var(--mc-blue)" /> :
    <Clock size={13} color="var(--mc-blue)" />;
  return (
    <div className="mc-block">
      <div className="mc-block-head">
        <ClipboardList size={15} className="mc-block-icon" />
        <span className="mc-block-title">{block.title ?? "Approval history"}</span>
      </div>
      {block.events.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--mc-muted)" }}>No approval metadata recorded on this submission yet.</div>
      ) : (
        <div className="mc-timeline">
          {block.events.map((e, i) => (
            <div className={`mc-timeline-event dec-${e.decision ?? "NOTE"}`} key={i}>
              <div className="mc-timeline-head">
                <span className="mc-timeline-actor">{e.actor}</span>
                {e.role ? <span style={{ fontSize: 10.5, color: "var(--mc-muted)" }}>{e.role}</span> : null}
                <span className="mc-timeline-action" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>{iconFor(e.decision)} {e.action}</span>
                <span className="mc-timeline-at">{formatWhen(e.at)}</span>
              </div>
              {e.comment ? <div className="mc-timeline-comment">“{e.comment}”</div> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── evidence card ──────────────────────────────────────────────────────────── */

function EvidenceCard({ block }: { block: EvidenceRefBlock }) {
  return (
    <div className="mc-sub-card" style={{ cursor: "default" }}>
      <FileCheck2 size={16} style={{ color: "var(--mc-blue)", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="mc-sub-title">{block.name}</div>
        <div className="mc-sub-meta">{[block.docType, block.entity, block.uploadedBy ? `uploaded by ${block.uploadedBy}` : null, block.uploadedAt ? block.uploadedAt.slice(0, 10) : null, block.version ? `v${block.version}` : null].filter(Boolean).join(" · ")}</div>
      </div>
      {block.status ? <span className={`mc-status-badge ${block.status === "VERIFIED" || block.status === "VALID" ? "APPROVED" : block.status === "REJECTED" || block.status === "MISSING" ? "REJECTED" : ""}`} style={block.status === "VERIFIED" || block.status === "VALID" || block.status === "REJECTED" || block.status === "MISSING" ? undefined : { background: "rgba(233,162,59,0.14)", color: "#b97a1f" }}>{block.status}</span> : null}
    </div>
  );
}

/* ── activity timeline ──────────────────────────────────────────────────────── */

function ActivityTimelineView({ block }: { block: ActivityTimelineBlock }) {
  return (
    <div className="mc-block">
      <div className="mc-block-head">
        <History size={15} className="mc-block-icon" />
        <span className="mc-block-title">{block.title ?? "Activity"}</span>
      </div>
      <div className="mc-timeline">
        {block.events.map((e, i) => (
          <div className="mc-timeline-event" key={i}>
            <div className="mc-timeline-head">
              <span className="mc-timeline-actor">{e.actor}</span>
              {e.role ? <span style={{ fontSize: 10.5, color: "var(--mc-muted)" }}>{e.role}</span> : null}
              <span className="mc-timeline-action">{e.action}</span>
              <span className="mc-timeline-at">{formatWhen(e.at)}</span>
            </div>
            {e.target ? <div style={{ fontSize: 11.5, color: "var(--mc-muted)" }}>{e.target}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── recommendation ─────────────────────────────────────────────────────────── */

function RecommendationCard({ block }: { block: RecommendationBlock }) {
  const navigate = useNavigateView();
  const sendMessage = useCopilot((s) => s.sendMessage);
  const reportingYear = useCopilot((s) => s.reportingYear);
  return (
    <div className="mc-rec-card">
      <div className="mc-rec-title">
        <Lightbulb size={15} style={{ color: "var(--mc-purple)" }} />
        <span style={{ flex: 1, minWidth: 0 }}>{block.title}</span>
        <span className={`mc-rec-priority ${block.priority}`}>{block.priority}</span>
      </div>
      <div className="mc-rec-explanation">{block.explanation}</div>
      {block.whyItMatters ? <div className="mc-rec-why"><strong style={{ fontSize: 11 }}>Why it matters:</strong> <span style={{ color: "var(--mc-muted)" }}>{block.whyItMatters}</span></div> : null}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 9 }}>
        <span className="mc-rec-basis">
          {block.basis === "data" ? "Derived from platform records" : block.basis === "estimate" ? "Estimate" : "AI interpretation"}
          {block.scope ? ` · ${block.scope}` : ""}
          {block.period ? ` · ${block.period}` : ""}
        </span>
      </div>
      <div className="mc-rec-actions">
        {block.suggestedAction?.view ? (
          <button className="mc-rec-action-btn" onClick={() => navigate(block.suggestedAction!.view!.view, block.suggestedAction!.view!.detailId)}>
            <ArrowRight size={13} /> {block.suggestedAction.label}
          </button>
        ) : null}
        {block.suggestedAction?.prompt ? (
          <button className="mc-rec-action-btn" onClick={() => sendMessage(block.suggestedAction!.prompt!, reportingYear)}>
            <Send size={13} /> Ask MEIL Intelligence
          </button>
        ) : null}
        {block.supportingRecords?.slice(0, 2).map((r, i) => (
          <button key={i} className="mc-rec-action-btn ghost" onClick={() => navigate(r.view.view, r.view.detailId)}>
            <MousePointerClick size={13} /> {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── confirmation ───────────────────────────────────────────────────────────── */

function ConfirmationCard({ block }: { block: ConfirmationBlock }) {
  const resolve = useCopilot((s) => s.resolveConfirmation);
  const [busy, setBusy] = useState<"confirm" | "cancel" | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const expired = block.expiresAt ? new Date(block.expiresAt).getTime() < Date.now() : false;

  const act = async (decision: "confirm" | "cancel") => {
    setBusy(decision);
    const res = await resolve(block.confirmationId, decision);
    const ok = decision === "confirm" ? res.status === "EXECUTED" : res.status === "CANCELLED";
    setResult({
      ok,
      text: decision === "confirm"
        ? res.resultSummary ?? "Action executed."
        : "Cancelled — nothing was changed.",
    });
    setBusy(null);
  };

  return (
    <div className={`mc-confirm-card ${block.riskLevel === "L4" ? "pending-l4" : ""}`}>
      <div className="mc-rec-title" style={{ marginBottom: 4 }}>
        <AlertTriangle size={15} style={{ color: block.riskLevel === "L4" ? "var(--mc-danger)" : "var(--mc-warning)" }} />
        <span style={{ flex: 1, minWidth: 0 }}>{block.title}</span>
        <span className={`mc-confirm-badge ${block.riskLevel === "L4" ? "l4" : ""}`}>{block.riskLevel} — CONFIRMATION REQUIRED</span>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--mc-muted)", lineHeight: 1.55 }}>{block.explanation}</div>
      {block.impact ? <div className="mc-confirm-summary"><strong>Expected impact:</strong> {block.impact}</div> : null}
      {block.affected?.length ? (
        <div className="mc-confirm-summary"><strong>Affected:</strong> {block.affected.join(", ")}</div>
      ) : null}
      {result ? (
        <div className={`mc-confirm-result ${result.ok ? "" : "failed"}`}>
          {result.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />} {result.text}
        </div>
      ) : expired ? (
        <div className="mc-confirm-result failed"><XCircle size={15} /> This confirmation has expired. Ask MEIL Intelligence to prepare the action again.</div>
      ) : (
        <div className="mc-confirm-actions">
          <button className="mc-confirm-btn" disabled={busy !== null} onClick={() => act("confirm")}>
            {busy === "confirm" ? "Executing…" : "Confirm"}
          </button>
          <button className="mc-cancel-btn" disabled={busy !== null} onClick={() => act("cancel")}>
            Cancel
          </button>
        </div>
      )}
      {block.expiresAt && !result && !expired ? (
        <div style={{ fontSize: 10.5, color: "var(--mc-muted)", marginTop: 8 }}>Single-use · expires {formatWhen(block.expiresAt)}</div>
      ) : null}
    </div>
  );
}

/* ── follow-ups ─────────────────────────────────────────────────────────────── */

function FollowUps({ block }: { block: FollowUpsBlock }) {
  const sendMessage = useCopilot((s) => s.sendMessage);
  const reportingYear = useCopilot((s) => s.reportingYear);
  return (
    <div className="mc-followups">
      {block.questions.map((q, i) => (
        <button className="mc-followup" key={i} onClick={() => sendMessage(q, reportingYear)}>
          <ArrowRight size={13} style={{ flexShrink: 0 }} /> {q}
        </button>
      ))}
    </div>
  );
}

/* ── message-level actions ──────────────────────────────────────────────────── */

export function MessageActions({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  return (
    <div className="mc-msg-actions">
      <button className="mc-chip-btn" onClick={async () => {
        try {
          await navigator.clipboard.writeText(content);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch { /* clipboard unavailable */ }
      }}>
        <Copy size={11} /> {copied ? "Copied" : "Copy"}
      </button>
      <button className="mc-chip-btn" onClick={async () => {
        try {
          await copilotApi.saveItem({ kind: "ANALYSIS", title: content.slice(0, 80) || "Saved response", body: content });
          setSaved(true);
          setTimeout(() => setSaved(false), 1600);
        } catch { /* save failed */ }
      }}>
        <Save size={11} /> {saved ? "Saved" : "Save"}
      </button>
    </div>
  );
}

/* ── registry ───────────────────────────────────────────────────────────────── */

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export const BlockRenderer = memo(function BlockRenderer({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case "text":
      return <TextBlock text={block.text} />;
    case "kpi":
      return <KpiCards block={block} />;
    case "data_table":
      return <DataTable block={block} />;
    case "chart":
      return <ChartBlockView block={block} />;
    case "comparison":
      return <ComparisonView block={block} />;
    case "executive_summary":
      return <ExecutiveSummary block={block} />;
    case "entity_profile":
      return <EntityProfile block={block} />;
    case "submission":
      return <SubmissionCard block={block} />;
    case "approval_timeline":
      return <ApprovalTimeline block={block} />;
    case "evidence":
      return <EvidenceCard block={block} />;
    case "activity_timeline":
      return <ActivityTimelineView block={block} />;
    case "recommendation":
      return <RecommendationCard block={block} />;
    case "confirmation":
      return <ConfirmationCard block={block} />;
    case "follow_ups":
      return <FollowUps block={block} />;
    default: {
      // Safe fallback for unknown future block types.
      const unknown = block as { type?: string };
      return <TextBlock text={`[Unsupported block: ${unknown.type ?? "unknown"}]`} />;
    }
  }
});
