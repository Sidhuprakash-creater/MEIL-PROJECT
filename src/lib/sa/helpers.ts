import { db } from "@/lib/db";
import { SaError, deadlineStatus, parseJson, resolveEffectiveDeadline } from "@/lib/sa/server";
import { SA_CATEGORIES } from "@/lib/sa/types";
import type { PackageRow, TimelineRow, ValidationRow } from "@/lib/sa/types";

/* ═══════════════════════════════════════════════════════════════════════════
   MEIL ESG — shared helpers for /api/sa route handlers.
   Route files may only export HTTP handlers, so cross-route logic lives here
   (currently: reporting-timeline parsing, row mapping and cascade counts).
   ═══════════════════════════════════════════════════════════════════════════ */

export type TimelineLevel = "SUBSIDIARY" | "BUSINESS_UNIT" | "PROJECT";

/** Structural subset of the ReportingTimeline model used by the handlers. */
export interface TimelineDbRow {
  id: string;
  ref: string;
  name: string;
  period: string;
  level: string;
  subsidiaryId: string;
  businessUnitId: string | null;
  projectId: string | null;
  startDate: Date;
  dueDate: Date | null;
  reviewDeadline: Date | null;
  categories: string;
  inheritanceMode: string;
  overrideReason: string;
  notify: boolean;
  status: string;
  createdByName: string;
  updatedAt: Date;
}

/** Unique reference: PREFIX-<base36 timestamp> (e.g. RTL-…, VLD-…). */
export function makeRef(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

export interface EntitySubStats {
  hasSubmitted: boolean;
  allApproved: boolean;
  lastSubmittedAt: Date | null;
}

export interface ScopedSubLite {
  period: string;
  status: string;
  submittedAt: Date | null;
  businessUnitId: string | null;
  projectId: string | null;
}

/**
 * Submission stats for one entity (subsidiary / BU / project) within a period.
 * - SUBSIDIARY entity  → every scoped submission of that period.
 * - BUSINESS_UNIT      → BU-level reports (projectId null) of that unit.
 * - PROJECT            → that project's reports.
 */
export function entitySubStats(
  subs: ScopedSubLite[],
  period: string,
  entity: { level: TimelineLevel; businessUnitId?: string | null; projectId?: string | null }
): EntitySubStats {
  const list = subs.filter((s) => {
    if (s.period !== period) return false;
    if (entity.level === "BUSINESS_UNIT") return s.businessUnitId === entity.businessUnitId && !s.projectId;
    if (entity.level === "PROJECT") return s.projectId === entity.projectId;
    return true;
  });
  const nonDraft = list.filter((s) => s.status !== "DRAFT");
  return {
    hasSubmitted: nonDraft.length > 0,
    allApproved: list.length > 0 && list.every((s) => s.status === "APPROVED"),
    lastSubmittedAt: list.reduce<Date | null>(
      (acc, s) => (s.submittedAt && (!acc || s.submittedAt > acc) ? s.submittedAt : acc),
      null
    ),
  };
}

/** Map a ReportingTimeline row to the shared TimelineRow contract. */
export function toTimelineRow(
  t: TimelineDbRow,
  orgId: string | null,
  orgName: string,
  periodTimelines: TimelineDbRow[], // ACTIVE rows of the SAME period (inheritance walk-up)
  subCode: string,
  stats: EntitySubStats
): TimelineRow {
  const level = t.level as TimelineLevel;
  const eff = resolveEffectiveDeadline(
    level,
    { subsidiaryId: t.subsidiaryId, businessUnitId: t.businessUnitId, projectId: t.projectId },
    periodTimelines,
    subCode
  );
  return {
    id: t.id,
    ref: t.ref,
    name: t.name,
    period: t.period,
    level,
    orgId,
    orgName,
    startDate: t.startDate.toISOString(),
    dueDate: t.dueDate?.toISOString() ?? null,
    reviewDeadline: t.reviewDeadline?.toISOString() ?? null,
    categories: parseJson<string[]>(t.categories, []),
    inheritanceMode: t.inheritanceMode === "OVERRIDE" ? "OVERRIDE" : "INHERIT",
    overrideReason: t.overrideReason,
    sourceLabel: eff.sourceLabel,
    effectiveDueDate: eff.dueDate ? new Date(eff.dueDate).toISOString() : null,
    deadlineStatus: deadlineStatus({
      effective: eff,
      hasSubmitted: stats.hasSubmitted,
      lastSubmittedAt: stats.lastSubmittedAt,
      allApproved: stats.allApproved,
    }),
    status: t.status,
    notify: t.notify,
    createdByName: t.createdByName,
    updatedAt: t.updatedAt.toISOString(),
  };
}

export interface TimelineBodyInput {
  name?: string;
  period?: string;
  level?: string;
  orgId?: string;
  startDate?: string;
  dueDate?: string | null;
  reviewDeadline?: string | null;
  categories?: string[];
  inheritanceMode?: string;
  overrideReason?: string;
  notify?: boolean;
  status?: string;
}

export interface ParsedTimeline {
  name: string;
  period: string;
  level: TimelineLevel;
  startDate: Date;
  dueDate: Date | null;
  reviewDeadline: Date | null;
  categories: string[];
  inheritanceMode: "INHERIT" | "OVERRIDE";
  overrideReason: string;
  notify: boolean;
  status: string;
}

function parseDateInput(v: unknown, label: string, required: boolean): Date | null {
  if (v === undefined || v === null || v === "") {
    if (required) throw new SaError(`${label} is required.`, 400);
    return null;
  }
  const d = v instanceof Date ? v : new Date(String(v));
  if (isNaN(d.getTime())) throw new SaError(`${label} is not a valid date.`, 400);
  return d;
}

/** Validate a timeline create/update body (falls back to `existing` for PATCH). */
export function parseTimelineBody(body: TimelineBodyInput, existing?: TimelineDbRow | null): ParsedTimeline {
  const name = (body.name ?? existing?.name ?? "").trim();
  if (name.length < 2 || name.length > 80) throw new SaError("Timeline name must be 2–80 characters.", 400);

  const period = (body.period ?? existing?.period ?? "FY 2025-26").trim();
  if (!period) throw new SaError("A reporting period is required.", 400);

  const levelRaw = body.level ?? existing?.level ?? "";
  if (!["SUBSIDIARY", "BUSINESS_UNIT", "PROJECT"].includes(levelRaw)) {
    throw new SaError("Timeline level must be SUBSIDIARY, BUSINESS_UNIT or PROJECT.", 400);
  }
  const level = levelRaw as TimelineLevel;

  const modeRaw = body.inheritanceMode ?? existing?.inheritanceMode ?? "INHERIT";
  if (modeRaw !== "INHERIT" && modeRaw !== "OVERRIDE") {
    throw new SaError("Inheritance mode must be INHERIT or OVERRIDE.", 400);
  }
  const inheritanceMode = modeRaw;

  const startDate = parseDateInput(body.startDate ?? existing?.startDate, "Start date", true)!;
  const dueDate = parseDateInput(body.dueDate ?? existing?.dueDate, "Due date", false);
  const reviewDeadline = parseDateInput(body.reviewDeadline ?? existing?.reviewDeadline, "Review deadline", false);

  if (dueDate && startDate.getTime() >= dueDate.getTime()) {
    throw new SaError("Start date must be before the due date.", 400);
  }
  if (reviewDeadline && dueDate && reviewDeadline.getTime() < dueDate.getTime()) {
    throw new SaError("Review deadline must be on or after the due date.", 400);
  }

  let overrideReason = (body.overrideReason ?? existing?.overrideReason ?? "").trim();
  if (inheritanceMode === "OVERRIDE") {
    if (!dueDate) throw new SaError("A due date is required when overriding an inherited deadline.", 400);
    if (!overrideReason) throw new SaError("An override reason is required when overriding an inherited deadline.", 400);
  }
  if (overrideReason.length > 500) overrideReason = overrideReason.slice(0, 500);

  const rawCategories = body.categories ?? (existing ? parseJson<string[]>(existing.categories, []) : []);
  const categories = Array.isArray(rawCategories)
    ? rawCategories.map((c) => String(c).slice(0, 40)).slice(0, 14)
    : [];

  const notify = body.notify ?? existing?.notify ?? true;

  const status = body.status ?? existing?.status ?? "ACTIVE";
  if (status !== "ACTIVE" && status !== "CLOSED") {
    throw new SaError("Timeline status must be ACTIVE or CLOSED.", 400);
  }

  return { name, period, level, startDate, dueDate, reviewDeadline, categories, inheritanceMode, overrideReason, notify, status };
}

/**
 * Count the descendants that inherit their effective deadline through the
 * given timeline node (recipients of the cascade), resolved with the same
 * walk-up rules as the rest of the workspace.
 */
export async function timelineAffected(t: {
  id: string;
  subsidiaryId: string;
  period: string;
}): Promise<{ buCount: number; projectCount: number }> {
  const [set, units, projects] = await Promise.all([
    db.reportingTimeline.findMany({ where: { subsidiaryId: t.subsidiaryId, period: t.period, status: "ACTIVE" } }),
    db.businessUnit.findMany({ where: { subsidiaryId: t.subsidiaryId }, select: { id: true } }),
    db.project.findMany({ where: { businessUnit: { subsidiaryId: t.subsidiaryId } }, select: { id: true, businessUnitId: true } }),
  ]);
  let buCount = 0;
  for (const u of units) {
    const eff = resolveEffectiveDeadline("BUSINESS_UNIT", { subsidiaryId: t.subsidiaryId, businessUnitId: u.id }, set, "");
    if (eff.timelineId === t.id) buCount++;
  }
  let projectCount = 0;
  for (const p of projects) {
    const eff = resolveEffectiveDeadline(
      "PROJECT",
      { subsidiaryId: t.subsidiaryId, businessUnitId: p.businessUnitId, projectId: p.id },
      set,
      ""
    );
    if (eff.timelineId === t.id) projectCount++;
  }
  return { buCount, projectCount };
}

/* ═══════════════════════════════════════════════════════════════════════════
   ESG reporting / packages / validation helpers (esg · packages · validation
   · analytics routes). Row mappers + consolidation snapshot computation.
   ═══════════════════════════════════════════════════════════════════════════ */

export function toPackageRow(p: {
  id: string;
  ref: string;
  title: string;
  period: string;
  status: string;
  readinessPct: number;
  summary: string;
  sourceRefs: string;
  submittedAt: Date | null;
  submittedBy: string;
  groupFeedback: string;
  updatedAt: Date;
}): PackageRow {
  return {
    id: p.id,
    ref: p.ref,
    title: p.title,
    period: p.period,
    status: p.status,
    readinessPct: p.readinessPct,
    summary: parseJson(p.summary, { approved: 0, pending: 0, missing: 0, metrics: [] as { name: string; value: number; unit: string }[] }),
    sourceRefs: parseJson<string[]>(p.sourceRefs, []),
    submittedAt: p.submittedAt?.toISOString() ?? null,
    submittedBy: p.submittedBy,
    groupFeedback: p.groupFeedback,
    updatedAt: p.updatedAt.toISOString(),
  };
}

export function toValidationRow(
  v: {
    id: string;
    ref: string;
    severity: string;
    rule: string;
    description: string;
    businessUnitId: string | null;
    projectId: string | null;
    submissionRef: string;
    responsibleName: string;
    status: string;
    ownerName: string;
    resolveNote: string;
    detectedAt: Date;
    resolvedAt: Date | null;
  },
  buNames: Map<string, string>,
  projectNames: Map<string, string>
): ValidationRow {
  return {
    id: v.id,
    ref: v.ref,
    severity: v.severity,
    rule: v.rule,
    description: v.description,
    buName: v.businessUnitId ? buNames.get(v.businessUnitId) ?? null : null,
    projectName: v.projectId ? projectNames.get(v.projectId) ?? null : null,
    submissionRef: v.submissionRef,
    responsibleName: v.responsibleName || "—",
    status: v.status,
    ownerName: v.ownerName,
    resolveNote: v.resolveNote,
    detectedAt: v.detectedAt.toISOString(),
    resolvedAt: v.resolvedAt?.toISOString() ?? null,
  };
}

/** Readiness % = approved / (total non-draft submissions) * 100. */
export function readinessPctOf(approved: number, totalNonDraft: number): number {
  return totalNonDraft ? Math.round((approved / totalNonDraft) * 100) : 0;
}

/** Per-BU reporting completion over BU-level submissions (projectId == null). */
export function buCompletionRows(
  units: { id: string; name: string }[],
  subs: { businessUnitId: string | null; projectId: string | null; status: string }[]
): { name: string; completionPct: number; approved: number; total: number }[] {
  return units.map((u) => {
    const list = subs.filter((s) => s.businessUnitId === u.id && !s.projectId);
    const approved = list.filter((s) => s.status === "APPROVED").length;
    return {
      name: u.name,
      completionPct: list.length ? Math.round((approved / list.length) * 100) : 0,
      approved,
      total: list.length,
    };
  });
}

export interface PackageSource {
  ref: string;
  title: string;
  category: string;
  metricName: string;
  metricValue: number;
  metricUnit: string;
  status: string;
  org: string;
}

export interface ConsolidationInput {
  /** Approved sources (optionally narrowed to an explicit sourceRefs selection). */
  approved: PackageSource[];
  /** Submitted / under-review sources excluded from approved totals. */
  pending: PackageSource[];
  /** Categories with zero submissions in the period. */
  missingCategories: string[];
  totalNonDraft: number;
  approvedAllCount: number;
}

/**
 * Load the consolidation inputs for a subsidiary+period: approved sources
 * (optionally narrowed to an explicit sourceRefs selection), pending-review
 * sources and category gaps. Everything is scoped by subsidiaryId.
 */
export async function loadConsolidationSources(
  subsidiaryId: string,
  period: string,
  sourceRefs?: string[]
): Promise<ConsolidationInput> {
  const [subs, units, projects] = await Promise.all([
    db.submission.findMany({ where: { subsidiaryId, period } }),
    db.businessUnit.findMany({ where: { subsidiaryId }, select: { id: true, name: true } }),
    db.project.findMany({ where: { businessUnit: { subsidiaryId } }, select: { id: true, name: true } }),
  ]);
  const buNames = new Map(units.map((u) => [u.id, u.name]));
  const prjNames = new Map(projects.map((p) => [p.id, p.name]));
  const toSource = (s: {
    ref: string; title: string; category: string; metricName: string;
    metricValue: number; metricUnit: string; status: string;
    businessUnitId: string | null; projectId: string | null;
  }): PackageSource => ({
    ref: s.ref,
    title: s.title,
    category: s.category,
    metricName: s.metricName,
    metricValue: s.metricValue,
    metricUnit: s.metricUnit,
    status: s.status,
    org: (s.projectId ? prjNames.get(s.projectId) : s.businessUnitId ? buNames.get(s.businessUnitId) : null) ?? "—",
  });

  const approvedAll = subs.filter((s) => s.status === "APPROVED");
  const approved = sourceRefs && sourceRefs.length ? approvedAll.filter((s) => sourceRefs.includes(s.ref)) : approvedAll;
  const pending = subs
    .filter((s) => ["SUBMITTED", "UNDER_REVIEW"].includes(s.status))
    .map(toSource);
  const missingCategories = SA_CATEGORIES.filter((c) => !subs.some((s) => s.category === c));
  const totalNonDraft = subs.filter((s) => s.status !== "DRAFT").length;

  return { approved: approved.map(toSource), pending, missingCategories, totalNonDraft, approvedAllCount: approvedAll.length };
}

/** Aggregate approved sources into the package summary snapshot. */
export function packageSummary(
  approved: PackageSource[],
  pendingCount: number,
  missingCount: number
): { approved: number; pending: number; missing: number; metrics: { name: string; value: number; unit: string }[] } {
  const agg = new Map<string, { name: string; value: number; unit: string }>();
  for (const s of approved) {
    const key = `${s.metricName}|${s.metricUnit}`;
    const cur = agg.get(key) ?? { name: s.metricName || s.title, value: 0, unit: s.metricUnit };
    cur.value += s.metricValue;
    agg.set(key, cur);
  }
  const metrics = [...agg.values()]
    .map((m) => ({ ...m, value: Math.round(m.value * 100) / 100 }))
    .sort((a, b) => b.value - a.value);
  return { approved: approved.length, pending: pendingCount, missing: missingCount, metrics };
}
