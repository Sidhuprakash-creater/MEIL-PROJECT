// GET /api/copilot/explorer — Smart Explorer (Phase 9).
// Database-driven guided discovery. Two response modes:
//   ?mode=cascade  → selector options for one cascade level (actual entities)
//   ?mode=results  → server-filtered, paginated result workspace
// Every row comes from real tables; nothing is hardcoded.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCopilotUser, copilotResponseError, CopilotError } from "@/lib/copilot/server";
import { parseJson } from "@/lib/esg/server";

export const EXPLORER_CATEGORIES = [
  "subsidiaries", "business_units", "projects", "users", "submissions", "approvals",
  "evidence", "activities", "deadlines", "analytics", "brsr", "compliance",
] as const;
type ExplorerCategory = (typeof EXPLORER_CATEGORIES)[number];

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireCopilotUser(req.headers);
    const sp = req.nextUrl.searchParams;
    const mode = sp.get("mode") === "cascade" ? "cascade" : "results";
    const category = sp.get("category") as ExplorerCategory | null;
    const subsidiaryId = sp.get("subsidiaryId") || undefined;
    const businessUnitId = sp.get("businessUnitId") || undefined;
    const projectId = sp.get("projectId") || undefined;
    const period = sp.get("period") || undefined;
    const status = sp.get("status") || undefined;
    const query = sp.get("q") || undefined;
    const limit = Math.min(Math.max(Number(sp.get("limit") ?? 25), 1), 100);
    const offset = Math.max(Number(sp.get("offset") ?? 0), 0);

    if (mode === "cascade") {
      return NextResponse.json(await cascadeOptions(category, { subsidiaryId, businessUnitId }));
    }
    if (!category || !EXPLORER_CATEGORIES.includes(category)) {
      throw new CopilotError("Unknown explorer category.", 400, "BAD_CATEGORY");
    }
    const result = await resultsFor(category, { subsidiaryId, businessUnitId, projectId, period, status, query, limit, offset, userId: user.id });
    return NextResponse.json(result);
  } catch (e) {
    return copilotResponseError(e);
  }
}

/* ── cascade options: real entity lists for the guided selectors ───────────── */

async function cascadeOptions(category: string | null, scope: { subsidiaryId?: string; businessUnitId?: string }) {
  if (!category || category === "subsidiaries") {
    const subsidiaries = await db.subsidiary.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, code: true, status: true } });
    return { options: subsidiaries.map((s) => ({ value: s.id, label: `${s.name} (${s.code})`, status: s.status })) };
  }
  if (category === "business_units") {
    const units = await db.businessUnit.findMany({
      where: scope.subsidiaryId ? { subsidiaryId: scope.subsidiaryId } : {},
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true, status: true, subsidiaryId: true },
    });
    return { options: units.map((u) => ({ value: u.id, label: `${u.name} (${u.code})`, status: u.status, subsidiaryId: u.subsidiaryId })) };
  }
  if (category === "projects") {
    const projects = await db.project.findMany({
      where: scope.businessUnitId ? { businessUnitId: scope.businessUnitId } : scope.subsidiaryId ? { businessUnit: { subsidiaryId: scope.subsidiaryId } } : {},
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true, ptype: true, status: true, businessUnitId: true },
    });
    return { options: projects.map((p) => ({ value: p.id, label: `${p.name} (${p.code})`, status: p.status, businessUnitId: p.businessUnitId, ptype: p.ptype })) };
  }
  if (category === "periods") {
    const years = ["FY 2024-25", "FY 2025-26", "FY 2026-27"];
    const periodsInUse = await db.submission.groupBy({ by: ["period"], _count: true });
    const known = new Set([...years, ...periodsInUse.map((p) => p.period)]);
    return { options: Array.from(known).map((p) => ({ value: p, label: p })) };
  }
  throw new CopilotError("Unknown cascade level.", 400, "BAD_LEVEL");
}

/* ── results: category-specific server-filtered queries ────────────────────── */

interface ResultsInput {
  subsidiaryId?: string;
  businessUnitId?: string;
  projectId?: string;
  period?: string;
  status?: string;
  query?: string;
  limit: number;
  offset: number;
  userId: string;
}

async function resultsFor(category: ExplorerCategory, input: ResultsInput) {
  const { subsidiaryId, businessUnitId, projectId, period, status, query, limit, offset } = input;
  const scopeWhere: Record<string, unknown> = {};
  if (subsidiaryId) scopeWhere.subsidiaryId = subsidiaryId;
  if (businessUnitId) scopeWhere.businessUnitId = businessUnitId;
  if (projectId) scopeWhere.projectId = projectId;
  if (period) scopeWhere.period = period;

  switch (category) {
    case "subsidiaries": {
      const where: Record<string, unknown> = {};
      if (query) where.OR = [{ name: { contains: query, mode: "insensitive" } }, { code: { contains: query, mode: "insensitive" } }];
      const [rows, total] = await Promise.all([
        db.subsidiary.findMany({ where, orderBy: { name: "asc" }, skip: offset, take: limit }),
        db.subsidiary.count({ where }),
      ]);
      const statusAgg = await db.submission.groupBy({
        by: ["subsidiaryId", "status"] as const,
        where: { subsidiaryId: { in: rows.map((s) => s.id) } },
        _count: { _all: true },
      });
      return {
        columns: [
          { key: "code", label: "Code" }, { key: "name", label: "Subsidiary" }, { key: "sector", label: "Sector" },
          { key: "region", label: "Region" }, { key: "status", label: "Status" }, { key: "approved", label: "Approved", align: "right" },
          { key: "pending", label: "In workflow", align: "right" },
        ],
        rows: rows.map((s) => {
          const statusCounts = Object.fromEntries(
            statusAgg.filter((g) => g.subsidiaryId === s.id).map((g) => [g.status, g._count?._all ?? 0])
          );
          return {
            id: s.id,
            cells: { code: s.code, name: s.name, sector: s.sector, region: s.region, status: s.status, approved: statusCounts["APPROVED"] ?? 0, pending: (statusCounts["SUBMITTED"] ?? 0) + (statusCounts["UNDER_REVIEW"] ?? 0) },
            nav: { view: "subsidiaries", detailId: s.id },
          };
        }),
        total, offset,
      };
    }
    case "business_units": {
      const where: Record<string, unknown> = { ...(subsidiaryId ? { subsidiaryId } : {}) };
      if (query) where.OR = [{ name: { contains: query, mode: "insensitive" } }, { code: { contains: query, mode: "insensitive" } }];
      const [rows, total] = await Promise.all([
        db.businessUnit.findMany({ where, orderBy: { name: "asc" }, skip: offset, take: limit, include: { subsidiary: { select: { name: true } } } }),
        db.businessUnit.count({ where }),
      ]);
      return {
        columns: [
          { key: "code", label: "Code" }, { key: "name", label: "Business unit" }, { key: "subsidiary", label: "Subsidiary" },
          { key: "status", label: "Status" }, { key: "manager", label: "BU Manager" },
        ],
        rows: rows.map((u) => ({ id: u.id, cells: { code: u.code, name: u.name, subsidiary: u.subsidiary.name, status: u.status, manager: u.managerName || "—" }, nav: { view: "units", detailId: u.id } })),
        total, offset,
      };
    }
    case "projects": {
      const where: Record<string, unknown> = {};
      if (subsidiaryId || businessUnitId) where.businessUnit = { ...(subsidiaryId ? { subsidiaryId } : {}), ...(businessUnitId ? { id: businessUnitId } : {}) };
      if (query) where.OR = [{ name: { contains: query, mode: "insensitive" } }, { code: { contains: query, mode: "insensitive" } }, { location: { contains: query, mode: "insensitive" } }];
      const [rows, total] = await Promise.all([
        db.project.findMany({ where, orderBy: { name: "asc" }, skip: offset, take: limit, include: { businessUnit: { include: { subsidiary: true } }, users: { select: { id: true } } } }),
        db.project.count({ where }),
      ]);
      return {
        columns: [
          { key: "code", label: "Code" }, { key: "name", label: "Project / Site" }, { key: "unit", label: "Business unit" },
          { key: "ptype", label: "Type" }, { key: "capacity", label: "Capacity MW", align: "right" }, { key: "users", label: "Users", align: "right" }, { key: "status", label: "Status" },
        ],
        rows: rows.map((p) => ({ id: p.id, cells: { code: p.code, name: p.name, unit: p.businessUnit.name, ptype: p.ptype.replace("_", " "), capacity: p.capacityMw, users: p.users.length, status: p.status }, nav: { view: "projects", detailId: p.id } })),
        total, offset,
      };
    }
    case "users": {
      const where: Record<string, unknown> = {};
      if (subsidiaryId) where.subsidiaryId = subsidiaryId;
      if (businessUnitId) where.businessUnitId = businessUnitId;
      if (projectId) where.projectId = projectId;
      if (query) where.OR = [{ name: { contains: query, mode: "insensitive" } }, { email: { contains: query, mode: "insensitive" } }, { employeeId: { contains: query, mode: "insensitive" } }];
      if (status) where.status = status;
      const [rows, total] = await Promise.all([
        db.user.findMany({ where, orderBy: { name: "asc" }, skip: offset, take: limit, include: { subsidiary: true, businessUnit: true, project: true } }),
        db.user.count({ where }),
      ]);
      return {
        columns: [
          { key: "employeeId", label: "Employee ID" }, { key: "name", label: "Name" }, { key: "role", label: "Role" },
          { key: "scope", label: "Scope" }, { key: "status", label: "Status" }, { key: "lastLogin", label: "Last login" },
        ],
        rows: rows.map((u) => ({
          id: u.id,
          cells: {
            employeeId: u.employeeId ?? "—", name: u.name, role: u.role,
            scope: [u.subsidiary?.name, u.businessUnit?.name, u.project?.name].filter(Boolean).join(" › ") || "Group",
            status: u.status, lastLogin: u.lastLoginAt ? u.lastLoginAt.toISOString().slice(0, 10) : "never",
          },
          nav: { view: "users", detailId: u.id },
        })),
        total, offset,
      };
    }
    case "submissions": {
      const where: Record<string, unknown> = { ...scopeWhere };
      if (status) where.status = status.toUpperCase();
      if (query) where.OR = [{ ref: { contains: query, mode: "insensitive" } }, { title: { contains: query, mode: "insensitive" } }];
      const [rows, total] = await Promise.all([
        db.submission.findMany({ where, orderBy: [{ overdue: "desc" }, { dueDate: "asc" }], skip: offset, take: limit }),
        db.submission.count({ where }),
      ]);
      return {
        columns: [
          { key: "ref", label: "Ref" }, { key: "title", label: "Submission" }, { key: "status", label: "Workflow status" },
          { key: "due", label: "Due date" }, { key: "deadline", label: "Deadline status" }, { key: "period", label: "Period" },
        ],
        rows: rows.map((s) => ({
          id: s.id,
          cells: { ref: s.ref, title: s.title, status: s.status, due: s.dueDate.toISOString().slice(0, 10), deadline: deadlineStatus(s), period: s.period },
          nav: { view: "submissions", detailId: s.id },
        })),
        total, offset,
      };
    }
    case "approvals": {
      const where: Record<string, unknown> = { ...scopeWhere, status: { in: status ? [status.toUpperCase()] : ["SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED", "APPROVED", "REJECTED"] } };
      if (query) where.OR = [{ ref: { contains: query, mode: "insensitive" } }, { title: { contains: query, mode: "insensitive" } }];
      const [rows, total, submitters, reviewers] = await Promise.all([
        db.submission.findMany({ where, orderBy: { reviewedAt: "desc" }, skip: offset, take: limit }),
        db.submission.count({ where }),
        db.user.findMany({ select: { id: true, name: true } }),
        db.user.findMany({ select: { id: true, name: true } }),
      ]);
      const nameOf = (list: { id: string; name: string }[], id: string | null) => (id ? list.find((x) => x.id === id)?.name ?? "—" : "—");
      return {
        columns: [
          { key: "ref", label: "Ref" }, { key: "title", label: "Submission" }, { key: "status", label: "Decision/status" },
          { key: "submitter", label: "Submitted by" }, { key: "reviewer", label: "Reviewer" }, { key: "reviewedAt", label: "Reviewed at" },
        ],
        rows: rows.map((s) => ({
          id: s.id,
          cells: {
            ref: s.ref, title: s.title, status: s.status,
            submitter: nameOf(submitters, s.submittedById), reviewer: nameOf(reviewers, s.reviewerId),
            reviewedAt: s.reviewedAt ? s.reviewedAt.toISOString().slice(0, 16).replace("T", " ") : "pending",
          },
          nav: { view: "approvals", detailId: s.id },
        })),
        total, offset,
      };
    }
    case "evidence": {
      const where: Record<string, unknown> = {};
      if (subsidiaryId) where.subsidiaryId = subsidiaryId;
      if (status) where.status = status.toUpperCase();
      if (query) where.OR = [{ name: { contains: query, mode: "insensitive" } }, { disclosureRef: { contains: query, mode: "insensitive" } }];
      const [rows, total, subsidiaries] = await Promise.all([
        db.evidenceDoc.findMany({ where, orderBy: { uploadedAt: "desc" }, skip: offset, take: limit }),
        db.evidenceDoc.count({ where }),
        db.subsidiary.findMany({ select: { id: true, name: true } }),
      ]);
      return {
        columns: [
          { key: "name", label: "Document" }, { key: "fileType", label: "Type" }, { key: "subsidiary", label: "Subsidiary" },
          { key: "submissionRef", label: "Submission" }, { key: "version", label: "Version", align: "right" }, { key: "status", label: "Status" }, { key: "uploadedAt", label: "Uploaded" },
        ],
        rows: rows.map((d) => ({
          id: d.id,
          cells: { name: d.name, fileType: d.fileType, subsidiary: subsidiaries.find((s) => s.id === d.subsidiaryId)?.name ?? "—", submissionRef: d.submissionRef || "—", version: `v${d.version}`, status: d.status, uploadedAt: d.uploadedAt.toISOString().slice(0, 10) },
        })),
        total, offset,
      };
    }
    case "activities": {
      const where: Record<string, unknown> = {};
      if (query) where.OR = [{ actorName: { contains: query, mode: "insensitive" } }, { action: { contains: query, mode: "insensitive" } }, { targetLabel: { contains: query, mode: "insensitive" } }];
      const [rows, total] = await Promise.all([
        db.activityEvent.findMany({ where, orderBy: { createdAt: "desc" }, skip: offset, take: limit }),
        db.activityEvent.count({ where }),
      ]);
      return {
        columns: [
          { key: "actor", label: "Actor" }, { key: "role", label: "Role" }, { key: "action", label: "Action" },
          { key: "target", label: "Target" }, { key: "severity", label: "Severity" }, { key: "at", label: "Timestamp" },
        ],
        rows: rows.map((e) => ({ id: e.id, cells: { actor: e.actorName, role: e.actorRole || "—", action: e.action, target: [e.targetType, e.targetLabel].filter(Boolean).join(" — ") || "—", severity: e.severity, at: e.createdAt.toISOString().replace("T", " ").slice(0, 19) }, nav: { view: "activity" } })),
        total, offset,
      };
    }
    case "deadlines": {
      const where: Record<string, unknown> = { status: { in: ["ASSIGNED", "SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED", "DRAFT"] }, ...(period ? { period } : {}), ...(subsidiaryId ? { subsidiaryId } : {}) };
      const [rows, total] = await Promise.all([
        db.submission.findMany({ where, orderBy: { dueDate: "asc" }, skip: offset, take: limit }),
        db.submission.count({ where }),
      ]);
      return {
        columns: [
          { key: "ref", label: "Ref" }, { key: "title", label: "Submission" }, { key: "due", label: "Due date" },
          { key: "deadline", label: "Deadline status" }, { key: "workflow", label: "Workflow status" },
        ],
        rows: rows.map((s) => ({ id: s.id, cells: { ref: s.ref, title: s.title, due: s.dueDate.toISOString().slice(0, 10), deadline: deadlineStatus(s), workflow: s.status }, nav: { view: "tasks" } })),
        total, offset,
      };
    }
    case "analytics": {
      const subs = await db.subsidiary.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
      const groups = await db.submission.groupBy({
        by: ["subsidiaryId", "status"] as const,
        where: { subsidiaryId: { in: subs.map((s) => s.id) }, ...(period ? { period } : {}) },
        _count: { _all: true },
      });
      const comparison = subs.map((s) => {
        const counts = Object.fromEntries(groups.filter((g) => g.subsidiaryId === s.id).map((g) => [g.status, g._count?._all ?? 0]));
        return { subsidiary: s.name, approved: counts["APPROVED"] ?? 0, pending: (counts["SUBMITTED"] ?? 0) + (counts["UNDER_REVIEW"] ?? 0), returned: (counts["REJECTED"] ?? 0) + (counts["CHANGES_REQUESTED"] ?? 0) };
      });
      return {
        columns: [{ key: "subsidiary", label: "Subsidiary" }, { key: "approved", label: "Approved", align: "right" }, { key: "pending", label: "Pending", align: "right" }, { key: "returned", label: "Returned/Rejected", align: "right" }],
        rows: comparison.map((r, i) => ({ id: subs[i].id, cells: r, nav: { view: "analytics" } })),
        total: comparison.length,
        offset,
        comparison: {
          entityLabels: comparison.map((c) => c.subsidiary),
          metrics: [
            { label: "Approved", values: comparison.map((c) => c.approved) },
            { label: "Pending", values: comparison.map((c) => c.pending) },
          ],
        },
      };
    }
    case "brsr": {
      const where: Record<string, unknown> = {};
      if (period) where.financialYear = period;
      if (query) where.OR = [{ ref: { contains: query, mode: "insensitive" } }, { title: { contains: query, mode: "insensitive" } }];
      const [rows, total] = await Promise.all([
        db.brsrReport.findMany({ where, orderBy: { updatedAt: "desc" }, skip: offset, take: limit }),
        db.brsrReport.count({ where }),
      ]);
      return {
        columns: [
          { key: "ref", label: "Ref" }, { key: "title", label: "BRSR report" }, { key: "fy", label: "Financial year" },
          { key: "status", label: "Status" }, { key: "version", label: "Version", align: "right" }, { key: "updatedAt", label: "Updated" },
        ],
        rows: rows.map((r) => {
          const disclosures = parseJson<{ status: string }[]>(r.disclosures, []);
          const mapped = disclosures.filter((d) => ["APPROVED", "LOCKED", "EVIDENCE_VERIFIED"].includes(d.status)).length;
          return {
            id: r.id,
            cells: { ref: r.ref, title: r.title, fy: r.financialYear, status: r.status, version: r.version, updatedAt: r.updatedAt.toISOString().slice(0, 10) },
            meta: { disclosuresTotal: disclosures.length, disclosuresMapped: mapped },
            nav: { view: "brsr", detailId: r.id },
          };
        }),
        total, offset,
      };
    }
    case "compliance": {
      const where: Record<string, unknown> = { status: { in: ["OPEN", "ASSIGNED"] }, ...(period ? { period } : {}), ...(subsidiaryId ? { subsidiaryId } : {}) };
      if (status) where.severity = status.toUpperCase();
      const [rows, total, anomalies, subsidiaries] = await Promise.all([
        db.validationIssue.findMany({ where, orderBy: [{ severity: "desc" }, { detectedAt: "desc" }], skip: offset, take: limit }),
        db.validationIssue.count({ where }),
        db.anomalyEvent.count({ where: { status: "OPEN" } }),
        db.subsidiary.findMany({ select: { id: true, name: true } }),
      ]);
      return {
        columns: [
          { key: "ref", label: "Ref" }, { key: "rule", label: "Rule" }, { key: "severity", label: "Severity" },
          { key: "description", label: "Finding" }, { key: "subsidiary", label: "Subsidiary" }, { key: "status", label: "Status" }, { key: "detected", label: "Detected" },
        ],
        rows: rows.map((i) => ({
          id: i.id,
          cells: { ref: i.ref, rule: i.rule.replace(/_/g, " "), severity: i.severity, description: i.description, subsidiary: subsidiaries.find((s) => s.id === i.subsidiaryId)?.name ?? "—", status: i.status, detected: i.detectedAt.toISOString().slice(0, 10) },
          nav: { view: "consolidation", detailId: i.id },
        })),
        total, offset,
        meta: { openAnomalies: anomalies },
      };
    }
    default:
      throw new CopilotError("Unhandled category.", 400, "BAD_CATEGORY");
  }
}

function deadlineStatus(s: { overdue: boolean; dueDate: Date; submittedAt: Date | null; status: string }): string {
  if (["APPROVED", "REJECTED"].includes(s.status)) {
    if (s.submittedAt && s.submittedAt.getTime() > s.dueDate.getTime()) return "Submitted Late";
    return "Submitted On Time";
  }
  if (s.overdue || s.dueDate.getTime() < Date.now()) return "Overdue";
  return s.dueDate.getTime() - Date.now() < 7 * 86400000 ? "Due Soon" : "Upcoming";
}
