// MEIL Intelligence — typed tool registry (Phase 16).
//
// The LLM never touches the database directly. It may only invoke these
// logical tools, each of which calls existing Prisma tables/services with
// strict argument validation, returns a concise `summary` for the model, and
// produces validated structured `blocks` for the adaptive UI. ESG calculations
// are always sourced from existing engine outputs (CalculationResult,
// normalized records) — never re-invented here.

import { db } from "@/lib/db";
import { parseJson } from "@/lib/esg/server";
import type {
  ToolDefinition,
  ToolHandler,
  ToolResult,
  SourceReference,
  ContentBlock,
  CopilotRequestContext,
} from "./types";

/* ── helpers ────────────────────────────────────────────────────────────────── */

const SUBMISSION_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  ASSIGNED: "Assigned",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  CHANGES_REQUESTED: "Returned for Correction",
  REJECTED: "Rejected",
  APPROVED: "Approved",
};

function iso(d: Date | null | undefined): string | undefined {
  return d ? d.toISOString() : undefined;
}

/** Deadline status — kept strictly separate from workflow status (Phase 18). */
function deadlineStatusOf(s: { overdue: boolean; dueDate: Date; submittedAt: Date | null; status: string }): string {
  if (s.status === "APPROVED" || s.status === "REJECTED") {
    if (s.submittedAt && s.submittedAt.getTime() > s.dueDate.getTime()) return "Submitted Late";
    return "Submitted On Time";
  }
  if (s.overdue) return "Overdue";
  const daysLeft = Math.ceil((s.dueDate.getTime() - Date.now()) / 86400000);
  if (daysLeft < 0) return "Overdue";
  if (daysLeft <= 7) return "Due Soon";
  return "Upcoming";
}

function subRef(s: string): SourceReference {
  return { kind: "submission", id: s, label: s, detailView: { view: "submissions", detailId: s, label: "Open submission" } };
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}

function bool(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

/* ── entity resolution (exact-record retrieval, Phase 8) ────────────────────── */

export interface ResolvedEntity {
  entityType: "subsidiary" | "business_unit" | "project" | "user";
  id: string;
  name: string;
  code?: string;
  status?: string;
  detail?: string;
}

export async function resolveEntity(query: string): Promise<ResolvedEntity[] | { ambiguous: ResolvedEntity[] }> {
  const q = query.trim();
  if (!q) return [];
  const [subsidiaries, units, projects, users] = await Promise.all([
    db.subsidiary.findMany({ where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }] }, take: 6 }),
    db.businessUnit.findMany({ where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }] }, take: 6, include: { subsidiary: true } }),
    db.project.findMany({ where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }, { location: { contains: q, mode: "insensitive" } }] }, take: 6, include: { businessUnit: { include: { subsidiary: true } } } }),
    db.user.findMany({ where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { employeeId: { contains: q, mode: "insensitive" } }] }, take: 6, select: { id: true, name: true, email: true, employeeId: true, role: true, status: true, subsidiaryId: true, businessUnitId: true, projectId: true } }),
  ]);
  const results: ResolvedEntity[] = [
    ...subsidiaries.map((s) => ({ entityType: "subsidiary" as const, id: s.id, name: s.name, code: s.code, status: s.status })),
    ...units.map((u) => ({ entityType: "business_unit" as const, id: u.id, name: u.name, code: u.code, status: u.status, detail: `of ${u.subsidiary.name}` })),
    ...projects.map((p) => ({ entityType: "project" as const, id: p.id, name: p.name, code: p.code, status: p.status, detail: `${p.businessUnit.name} — ${p.businessUnit.subsidiary.name}` })),
    ...users.map((u) => ({ entityType: "user" as const, id: u.id, name: u.name, code: u.employeeId ?? undefined, status: u.status, detail: `${u.role}${u.email ? ` · ${u.email}` : ""}` })),
  ];
  return results;
}

function decisionOf(action: string): "APPROVED" | "REJECTED" | "RETURNED" | "RESUBMITTED" | "SUBMITTED" | "REVIEW" | "NOTE" {
  if (/approve/i.test(action)) return "APPROVED";
  if (/reject/i.test(action)) return "REJECTED";
  if (/return/i.test(action)) return "RETURNED";
  if (/resubmit/i.test(action)) return "RESUBMITTED";
  if (/submit/i.test(action)) return "SUBMITTED";
  if (/review/i.test(action)) return "REVIEW";
  return "NOTE";
}

/* ── tool implementations ───────────────────────────────────────────────────── */

const resolve_entity: ToolHandler = async (args) => {
  const q = str(args.query);
  if (!q) return { summary: "No entity query provided.", error: "query is required" };
  const r = await resolveEntity(q);
  const list = Array.isArray(r) ? r : r.ambiguous;
  if (!list.length) return { summary: `No entity matched "${q}" in the organization directory.`, data: { matches: [] } };
  const summary = list.length === 1
    ? `Resolved "${q}" → ${list[0].entityType} ${list[0].name}${list[0].code ? ` (${list[0].code})` : ""}.`
    : `${list.length} entities match "${q}" — asking the user to disambiguate.`;
  return {
    summary,
    data: { matches: list.map((m) => ({ entityType: m.entityType, id: m.id, name: m.name, code: m.code ?? null, status: m.status ?? null, detail: m.detail ?? null })) },
  };
};

const get_subsidiary_profile: ToolHandler = async (args, ctx) => {
  const idOrCode = str(args.subsidiaryId) ?? str(args.query);
  if (!idOrCode) return { summary: "Missing subsidiary identifier.", error: "subsidiaryId or query required" };
  const sub = await db.subsidiary.findFirst({
    where: { OR: [{ id: idOrCode }, { code: idOrCode }] },
    include: {
      units: { select: { id: true, name: true, code: true, status: true } },
      users: { select: { id: true, name: true, role: true, status: true }, take: 50 },
    },
  });
  if (!sub) return { summary: "Subsidiary not found.", error: "not_found" };

  const [submissionAgg, recentSubs, packages, openIssues] = await Promise.all([
    db.submission.groupBy({ by: ["status"] as const, where: { subsidiaryId: sub.id }, _count: { _all: true } }),
    db.submission.findMany({
      where: { subsidiaryId: sub.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, ref: true, title: true, status: true, overdue: true, dueDate: true, submittedAt: true, period: true },
    }),
    db.reportingPackage.findMany({ where: { subsidiaryId: sub.id }, orderBy: { createdAt: "desc" }, take: 3 }),
    db.validationIssue.count({ where: { subsidiaryId: sub.id, status: { in: ["OPEN", "ASSIGNED"] } } }),
  ]);

  const statusCounts = Object.fromEntries(submissionAgg.map((g) => [g.status, g._count._all]));
  const latestPackage = packages[0];
  const readiness = latestPackage ? latestPackage.readinessPct : null;

  const profileBlock: ContentBlock = {
    type: "entity_profile",
    entityType: "subsidiary",
    entityId: sub.id,
    name: sub.name,
    code: sub.code,
    status: sub.status,
    subtitle: `${sub.sector} · ${sub.region}${sub.city ? ` · ${sub.city}` : ""}`,
    fields: [
      { label: "Subsidiary Admin", value: sub.adminName || "— not assigned —" },
      { label: "Subsidiary Manager", value: sub.managerName || "— not assigned —" },
      { label: "Business units", value: String(sub.units.length) },
      { label: "Assigned users", value: String(sub.users.length) },
      { label: "Approved submissions", value: String(statusCounts["APPROVED"] ?? 0) },
      { label: "Awaiting review", value: String((statusCounts["SUBMITTED"] ?? 0) + (statusCounts["UNDER_REVIEW"] ?? 0)) },
      { label: "Returned for correction", value: String(statusCounts["CHANGES_REQUESTED"] ?? 0) },
      { label: "Open validation issues", value: String(openIssues) },
      { label: "Latest reporting package", value: latestPackage ? `${latestPackage.ref} — ${latestPackage.status}${readiness !== null ? ` · readiness ${readiness}%` : ""}` : "None submitted yet" },
      { label: "Data period", value: ctx.reportingYear },
    ],
    navView: { view: "subsidiaries", detailId: sub.id, label: "Open in Subsidiary Management" },
  };

  const submissionBlocks: ContentBlock[] = recentSubs.map((s) => ({
    type: "submission",
    submissionId: s.id,
    ref: s.ref,
    title: s.title,
    status: SUBMISSION_STATUS_LABELS[s.status] ?? s.status,
    deadlineStatus: deadlineStatusOf(s as never),
    period: s.period,
    entity: sub.name,
    submittedAt: iso(s.submittedAt),
    dueDate: iso(s.dueDate),
    overdue: s.overdue,
    navView: { view: "submissions", detailId: s.id },
  }));

  return {
    summary: `Subsidiary ${sub.name} (${sub.code}): ${sub.units.length} BUs, ${statusCounts["APPROVED"] ?? 0} approved / ${(statusCounts["SUBMITTED"] ?? 0) + (statusCounts["UNDER_REVIEW"] ?? 0)} pending submissions, ${openIssues} open validation issues.`,
    data: {
      id: sub.id, code: sub.code, name: sub.name, status: sub.status, sector: sub.sector, region: sub.region,
      admin: sub.adminName || null, manager: sub.managerName || null,
      units: sub.units.map((u) => ({ id: u.id, name: u.name, code: u.code, status: u.status })),
      submissionStatusCounts: statusCounts, openValidationIssues: openIssues,
      latestPackage: latestPackage ? { ref: latestPackage.ref, status: latestPackage.status, readinessPct: latestPackage.readinessPct, submittedAt: iso(latestPackage.submittedAt) } : null,
      adminAndManagerAreNameStrings: true, // schema stores display names, not user FKs — surfaced honestly
    },
    blocks: [profileBlock, ...submissionBlocks],
    sources: [
      ...recentSubs.map((s) => ({ kind: "submission" as const, id: s.id, label: s.ref, period: s.period, detailView: { view: "submissions", detailId: s.id } })),
      ...(latestPackage ? [{ kind: "package" as const, id: latestPackage.id, label: latestPackage.ref, period: latestPackage.period }] : []),
    ],
  };
};

const get_business_unit_profile: ToolHandler = async (args, ctx) => {
  const idOrCode = str(args.businessUnitId) ?? str(args.query);
  if (!idOrCode) return { summary: "Missing business unit identifier.", error: "businessUnitId or query required" };
  const bu = await db.businessUnit.findFirst({
    where: { OR: [{ id: idOrCode }, { code: idOrCode }] },
    include: { subsidiary: true, projects: { select: { id: true, name: true, code: true, ptype: true, capacityMw: true, status: true } }, users: { select: { id: true, name: true, role: true, status: true } } },
  });
  if (!bu) return { summary: "Business unit not found.", error: "not_found" };
  const agg = await db.submission.groupBy({ by: ["status"] as const, where: { businessUnitId: bu.id }, _count: { _all: true } });
  const statusCounts = Object.fromEntries(agg.map((g) => [g.status, g._count._all]));
  const block: ContentBlock = {
    type: "entity_profile",
    entityType: "business_unit",
    entityId: bu.id,
    name: bu.name,
    code: bu.code,
    status: bu.status,
    subtitle: `Business Unit of ${bu.subsidiary.name}`,
    fields: [
      { label: "Parent subsidiary", value: bu.subsidiary.name },
      { label: "BU Admin", value: bu.adminName || "— not assigned —" },
      { label: "BU Manager", value: bu.managerName || "— not assigned —" },
      { label: "Projects / sites", value: String(bu.projects.length) },
      { label: "Assigned users", value: String(bu.users.length) },
      { label: "Approved submissions", value: String(statusCounts["APPROVED"] ?? 0) },
      { label: "Awaiting review", value: String((statusCounts["SUBMITTED"] ?? 0) + (statusCounts["UNDER_REVIEW"] ?? 0)) },
      { label: "Data period", value: ctx.reportingYear },
    ],
    navView: { view: "units", detailId: bu.id, label: "Open in BU Management" },
  };
  return {
    summary: `Business Unit ${bu.name} (${bu.code}) of ${bu.subsidiary.name}: ${bu.projects.length} projects, ${statusCounts["APPROVED"] ?? 0} approved submissions.`,
    data: { id: bu.id, name: bu.name, code: bu.code, subsidiary: bu.subsidiary.name, projects: bu.projects, statusCounts, manager: bu.managerName || null, admin: bu.adminName || null },
    blocks: [block],
    sources: [{ kind: "record", id: bu.id, label: `${bu.code} — ${bu.name}` }],
  };
};

const get_project_profile: ToolHandler = async (args, ctx) => {
  const idOrCode = str(args.projectId) ?? str(args.query);
  if (!idOrCode) return { summary: "Missing project identifier.", error: "projectId or query required" };
  const p = await db.project.findFirst({
    where: { OR: [{ id: idOrCode }, { code: idOrCode }] },
    include: { businessUnit: { include: { subsidiary: true } }, users: { select: { id: true, name: true, role: true, status: true } } },
  });
  if (!p) return { summary: "Project not found.", error: "not_found" };
  const [agg, recent, sourceRecords] = await Promise.all([
    db.submission.groupBy({ by: ["status"] as const, where: { projectId: p.id }, _count: { _all: true } }),
    db.submission.findMany({ where: { projectId: p.id }, orderBy: { createdAt: "desc" }, take: 4, select: { id: true, ref: true, title: true, status: true, overdue: true, dueDate: true, submittedAt: true, period: true } }),
    db.$transaction([
      db.energyRecord.count({ where: { projectId: p.id } }),
      db.waterRecord.count({ where: { projectId: p.id } }),
      db.wasteRecord.count({ where: { projectId: p.id } }),
      db.workforceRecord.count({ where: { projectId: p.id } }),
      db.safetyRecord.count({ where: { projectId: p.id } }),
      db.travelRecord.count({ where: { projectId: p.id } }),
    ]),
  ]);
  const statusCounts = Object.fromEntries(agg.map((g) => [g.status, g._count._all]));
  const roles = p.users.map((u) => u.role);
  const contributorCoverage = ["ENV_DATA_USER", "FIN_RESOURCE_USER", "HR_USER", "EHS_USER", "PROCUREMENT_USER", "CSR_USER", "COMPLIANCE_USER"].map(
    (r) => `${r}: ${roles.includes(r) ? "assigned" : "none"}`
  );
  const block: ContentBlock = {
    type: "entity_profile",
    entityType: "project",
    entityId: p.id,
    name: p.name,
    code: p.code,
    status: p.status,
    subtitle: `${p.ptype.replace("_", " ")} · ${p.businessUnit.name} · ${p.businessUnit.subsidiary.name}`,
    fields: [
      { label: "Location", value: p.location || "—" },
      { label: "Capacity", value: p.capacityMw ? `${fmt(p.capacityMw)} MW` : "—" },
      { label: "Reporting frequency", value: p.frequency },
      { label: "Assigned users", value: String(p.users.length) },
      { label: "Contributor coverage (7 categories)", value: contributorCoverage.filter((c) => c.includes("assigned")).length + " / 7 assigned" },
      { label: "Source records", value: `Energy ${sourceRecords[0]} · Water ${sourceRecords[1]} · Waste ${sourceRecords[2]} · Workforce ${sourceRecords[3]} · Safety ${sourceRecords[4]} · Travel ${sourceRecords[5]}` },
      { label: "Approved submissions", value: String(statusCounts["APPROVED"] ?? 0) },
      { label: "Data period", value: ctx.reportingYear },
    ],
    navView: { view: "projects", detailId: p.id, label: "Open in Project Management" },
  };
  return {
    summary: `Project ${p.name} (${p.code}): ${p.users.length} users, ${statusCounts["APPROVED"] ?? 0} approved submissions, ${sourceRecords.reduce((a, b) => a + b, 0)} source records.`,
    data: { id: p.id, name: p.name, code: p.code, subsidiary: p.businessUnit.subsidiary.name, businessUnit: p.businessUnit.name, statusCounts, users: p.users.map((u) => ({ name: u.name, role: u.role, status: u.status })) },
    blocks: [block, ...recent.map((s) => ({ type: "submission", submissionId: s.id, ref: s.ref, title: s.title, status: SUBMISSION_STATUS_LABELS[s.status] ?? s.status, period: s.period, entity: p.name, submittedAt: iso(s.submittedAt), dueDate: iso(s.dueDate), overdue: s.overdue, navView: { view: "submissions", detailId: s.id } } as ContentBlock))],
    sources: [{ kind: "record", id: p.id, label: `${p.code} — ${p.name}` }],
  };
};

const get_user_profile: ToolHandler = async (args) => {
  const idOrHandle = str(args.userId) ?? str(args.query);
  if (!idOrHandle) return { summary: "Missing user identifier.", error: "userId or query required" };
  const u = await db.user.findFirst({
    where: { OR: [{ id: idOrHandle }, { employeeId: idOrHandle }, { email: idOrHandle }] },
    include: { subsidiary: true, businessUnit: true, project: true },
  });
  if (!u) return { summary: "User not found.", error: "not_found" };
  const [submissions, tasks] = await Promise.all([
    db.submission.findMany({ where: { submittedById: u.id }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, ref: true, title: true, status: true, period: true } }),
    db.task.findMany({ where: { OR: [{ assigneeFilter: { contains: u.id } }, { assigneeLabel: { contains: u.name } }] }, take: 5, select: { id: true, ref: true, title: true, status: true, dueDate: true } }),
  ]);
  // Credentials, password material and session tokens are never returned.
  const block: ContentBlock = {
    type: "entity_profile",
    entityType: "user",
    entityId: u.id,
    name: u.name,
    code: u.employeeId ?? undefined,
    status: u.status,
    subtitle: u.role,
    fields: [
      { label: "Role", value: u.role },
      { label: "Scope", value: [u.subsidiary?.name, u.businessUnit?.name, u.project?.name].filter(Boolean).join(" › ") || "Group-wide" },
      { label: "Email", value: u.email },
      { label: "Status", value: u.status },
      { label: "Last login", value: iso(u.lastLoginAt) ?? "No recorded login" },
      { label: "Last activity", value: iso(u.lastActiveAt) ?? "No recorded activity" },
    ],
    navView: { view: "users", detailId: u.id, label: "Open in User Directory" },
  };
  return {
    summary: `User ${u.name} (${u.employeeId ?? u.email}): role ${u.role}, status ${u.status}, ${submissions.length} recent submissions.`,
    data: { id: u.id, name: u.name, employeeId: u.employeeId, role: u.role, status: u.status, scope: { subsidiary: u.subsidiary?.name ?? null, businessUnit: u.businessUnit?.name ?? null, project: u.project?.name ?? null }, lastLoginAt: iso(u.lastLoginAt), lastActiveAt: iso(u.lastActiveAt), submissions: submissions.map((s) => ({ ref: s.ref, title: s.title, status: s.status })) },
    blocks: [block],
    sources: [{ kind: "user", id: u.id, label: `${u.name} (${u.employeeId ?? "no handle"})` }],
  };
};

/* ── directory listings ───────────────────────────────────────────────────────
   Directory-level reads. The profile tools answer "tell me about X"; these
   answer "list X" and "how many X are there", including per-entity counts
   that the model would otherwise have to guess. */

const list_subsidiaries: ToolHandler = async (args, ctx) => {
  const status = str(args.status);
  const limit = Math.min(Math.max(num(args.limit) ?? 25, 1), 100);
  const where: Record<string, unknown> = {};
  if (status) where.status = status.toUpperCase();

  const [subs, users, projects, unitCounts] = await Promise.all([
    db.subsidiary.findMany({ where, orderBy: { name: "asc" }, take: limit }),
    db.user.findMany({ where: { status: "ACTIVE" }, select: { subsidiaryId: true } }),
    db.project.findMany({ select: { businessUnit: { select: { subsidiaryId: true } } } }),
    db.businessUnit.groupBy({ by: ["subsidiaryId"], _count: { _all: true } }),
  ]);

  const userCount = new Map<string, number>();
  for (const u of users) if (u.subsidiaryId) userCount.set(u.subsidiaryId, (userCount.get(u.subsidiaryId) ?? 0) + 1);
  const projectCount = new Map<string, number>();
  for (const p of projects) {
    const sid = p.businessUnit.subsidiaryId;
    projectCount.set(sid, (projectCount.get(sid) ?? 0) + 1);
  }
  const unitCount = new Map(unitCounts.map((g) => [g.subsidiaryId, g._count?._all ?? 0]));

  const rows = subs.map((s) => ({
    cells: [
      s.code,
      s.name,
      s.sector,
      s.region,
      s.status,
      unitCount.get(s.id) ?? 0,
      projectCount.get(s.id) ?? 0,
      userCount.get(s.id) ?? 0,
    ],
  }));

  const table: ContentBlock = {
    type: "data_table",
    title: "Subsidiaries",
    columns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Subsidiary" },
      { key: "sector", label: "Sector" },
      { key: "region", label: "Region" },
      { key: "status", label: "Status" },
      { key: "units", label: "BUs", align: "right" },
      { key: "projects", label: "Projects", align: "right" },
      { key: "activeUsers", label: "Active users", align: "right" },
    ],
    rows,
    note: "Source: organization register · users counted by ACTIVE status.",
  };

  const totalActiveUsers = users.length;
  const assignedActiveUsers = [...userCount.values()].reduce((a, b) => a + b, 0);
  const groupLevelActive = totalActiveUsers - assignedActiveUsers;
  const kpi: ContentBlock = {
    type: "kpi",
    title: "Organization footprint",
    scope: "Group",
    period: ctx.reportingYear,
    items: [
      { label: "Subsidiaries", value: String(subs.length) },
      { label: "Active users (group)", value: String(totalActiveUsers) },
      { label: "Active users in subsidiaries", value: String(assignedActiveUsers), hint: groupLevelActive ? `${groupLevelActive} group-level user(s) have no subsidiary` : "all active users sit in a subsidiary" },
      { label: "Projects", value: String(projects.length) },
    ],
  };

  return {
    summary:
      `${subs.length} subsidiar${subs.length === 1 ? "y" : "ies"} (${subs.filter((s) => s.status === "ACTIVE").length} active); ` +
      `${assignedActiveUsers} active user(s) are assigned to a subsidiary and ${groupLevelActive} more active user(s) are group-level ` +
      `(${totalActiveUsers} active users in total).`,
    data: {
      subsidiaries: subs.map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        sector: s.sector,
        region: s.region,
        status: s.status,
        businessUnits: unitCount.get(s.id) ?? 0,
        projects: projectCount.get(s.id) ?? 0,
        activeUsers: userCount.get(s.id) ?? 0,
      })),
      activeUsersTotal: totalActiveUsers,
      activeUsersAssignedToSubsidiaries: assignedActiveUsers,
      activeUsersGroupLevel: groupLevelActive,
    },
    blocks: [kpi, table],
    sources: subs.slice(0, 8).map((s) => ({ kind: "record" as const, id: s.id, label: `${s.code} — ${s.name}` })),
  };
};

const list_users: ToolHandler = async (args, ctx) => {
  const status = str(args.status);
  const subsidiaryId = str(args.subsidiaryId);
  const businessUnitId = str(args.businessUnitId);
  const projectId = str(args.projectId);
  const role = str(args.role);
  const limit = Math.min(Math.max(num(args.limit) ?? 50, 1), 200);
  const where: Record<string, unknown> = {};
  if (status) where.status = status.toUpperCase();
  if (role) where.role = role.toUpperCase();
  if (subsidiaryId) where.subsidiaryId = subsidiaryId;
  if (businessUnitId) where.businessUnitId = businessUnitId;
  if (projectId) where.projectId = projectId;

  const users = await db.user.findMany({
    where,
    orderBy: { name: "asc" },
    take: limit,
    include: { subsidiary: { select: { name: true } }, businessUnit: { select: { name: true } }, project: { select: { name: true } } },
  });

  const rows = users.map((u) => ({
    cells: [
      u.employeeId ?? "—",
      u.name,
      u.role,
      [u.subsidiary?.name, u.businessUnit?.name, u.project?.name].filter(Boolean).join(" › ") || "Group",
      u.status,
      u.lastLoginAt ? u.lastLoginAt.toISOString().slice(0, 10) : "never",
    ],
  }));

  // Head-count per subsidiary — the aggregation questions that single profiles
  // cannot answer.
  const bySubsidiary = new Map<string, { name: string; active: number; total: number }>();
  const allUsers = await db.user.findMany({ select: { subsidiaryId: true, status: true, subsidiary: { select: { name: true } } } });
  for (const u of allUsers) {
    const key = u.subsidiaryId ?? "group";
    const entry = bySubsidiary.get(key) ?? { name: u.subsidiary?.name ?? "Group (no subsidiary)", active: 0, total: 0 };
    entry.total++;
    if (u.status === "ACTIVE") entry.active++;
    bySubsidiary.set(key, entry);
  }
  const perSub = [...bySubsidiary.values()].sort((a, b) => b.active - a.active);

  const table: ContentBlock = {
    type: "data_table",
    title: "Users",
    columns: [
      { key: "employeeId", label: "Employee ID" },
      { key: "name", label: "Name" },
      { key: "role", label: "Role" },
      { key: "scope", label: "Scope" },
      { key: "status", label: "Status" },
      { key: "lastLogin", label: "Last login" },
    ],
    rows,
    note: `Showing ${users.length} of ${allUsers.length} platform users. Source: user directory.`,
  };

  const countTable: ContentBlock = {
    type: "data_table",
    title: "Head count by subsidiary",
    columns: [
      { key: "name", label: "Subsidiary" },
      { key: "active", label: "Active users", align: "right" },
      { key: "total", label: "All users", align: "right" },
    ],
    rows: perSub.map((p) => ({ cells: [p.name, p.active, p.total] })),
    note: "Counts are read from the user directory; the group row is users without a subsidiary assignment.",
  };

  return {
    summary: `${users.length} user${users.length === 1 ? "" : "s"} match the filters; ${allUsers.filter((u) => u.status === "ACTIVE").length} active users in total across ${perSub.length} scope(s).`,
    data: {
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        role: u.role,
        status: u.status,
        subsidiary: u.subsidiary?.name ?? null,
        businessUnit: u.businessUnit?.name ?? null,
        project: u.project?.name ?? null,
        lastLoginAt: iso(u.lastLoginAt),
      })),
      perSubsidiary: perSub,
    },
    blocks: [table, countTable],
    sources: users.slice(0, 8).map((u) => ({ kind: "record" as const, id: u.id, label: u.name })),
  };
};

const list_projects: ToolHandler = async (args, ctx) => {
  const subsidiaryId = str(args.subsidiaryId);
  const businessUnitId = str(args.businessUnitId);
  const status = str(args.status);
  const limit = Math.min(Math.max(num(args.limit) ?? 50, 1), 200);
  const where: Record<string, unknown> = {};
  if (status) where.status = status.toUpperCase();
  if (businessUnitId) where.businessUnitId = businessUnitId;
  else if (subsidiaryId) where.businessUnit = { subsidiaryId };

  const projects = await db.project.findMany({
    where,
    orderBy: { name: "asc" },
    take: limit,
    include: { businessUnit: { include: { subsidiary: true } }, users: { select: { id: true } } },
  });

  const rows = projects.map((p) => ({
    cells: [
      p.code,
      p.name,
      p.businessUnit.subsidiary.name,
      p.businessUnit.name,
      p.ptype.replace(/_/g, " "),
      p.location || "—",
      p.capacityMw,
      p.users.length,
      p.status,
    ],
  }));

  const table: ContentBlock = {
    type: "data_table",
    title: "Projects & sites",
    columns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Project / Site" },
      { key: "subsidiary", label: "Subsidiary" },
      { key: "unit", label: "Business unit" },
      { key: "type", label: "Type" },
      { key: "capacity", label: "Capacity MW", align: "right" },
      { key: "users", label: "Users", align: "right" },
      { key: "status", label: "Status" },
    ],
    rows,
    note: `Showing ${projects.length} project(s). Source: project & site register.`,
  };

  return {
    summary: `${projects.length} project${projects.length === 1 ? "" : "s"} match the filters (${projects.filter((p) => p.status === "ACTIVE").length} active).`,
    data: {
      projects: projects.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        subsidiary: p.businessUnit.subsidiary.name,
        businessUnit: p.businessUnit.name,
        type: p.ptype,
        location: p.location,
        capacityMw: p.capacityMw,
        users: p.users.length,
        status: p.status,
      })),
    },
    blocks: [table],
    sources: projects.slice(0, 8).map((p) => ({ kind: "record" as const, id: p.id, label: `${p.code} — ${p.name}` })),
  };
};

const get_submissions: ToolHandler = async (args) => {
  const status = str(args.status);
  const subsidiaryId = str(args.subsidiaryId);
  const projectId = str(args.projectId);
  const period = str(args.period);
  const overdueOnly = bool(args.overdueOnly);
  const limit = Math.min(Math.max(num(args.limit) ?? 12, 1), 50);
  const where: Record<string, unknown> = {};
  if (status) where.status = status.toUpperCase();
  if (subsidiaryId) where.subsidiaryId = subsidiaryId;
  if (projectId) where.projectId = projectId;
  if (period) where.period = period;
  if (overdueOnly) where.overdue = true;
  const [subs, subsd, units, projects, users] = await Promise.all([
    db.submission.findMany({ where, orderBy: [{ overdue: "desc" }, { dueDate: "asc" }], take: limit }),
    db.subsidiary.findMany({ select: { id: true, name: true } }),
    db.businessUnit.findMany({ select: { id: true, name: true } }),
    db.project.findMany({ select: { id: true, name: true } }),
    db.user.findMany({ select: { id: true, name: true } }),
  ]);
  const nameOf = (arr: { id: string; name: string }[], id: string | null) => (id ? arr.find((x) => x.id === id)?.name ?? null : null);
  const blocks: ContentBlock[] = subs.map((s) => ({
    type: "submission",
    submissionId: s.id,
    ref: s.ref,
    title: s.title,
    status: SUBMISSION_STATUS_LABELS[s.status] ?? s.status,
    deadlineStatus: deadlineStatusOf(s),
    period: s.period,
    entity: nameOf(subsd, s.subsidiaryId) ?? nameOf(units, s.businessUnitId) ?? nameOf(projects, s.projectId) ?? undefined,
    submittedAt: iso(s.submittedAt),
    submittedBy: s.submittedById ? nameOf(users, s.submittedById) ?? undefined : undefined,
    dueDate: iso(s.dueDate),
    overdue: s.overdue,
    metric: s.metricName ? { name: s.metricName, value: s.metricValue, unit: s.metricUnit } : undefined,
    navView: { view: "submissions", detailId: s.id },
  }));
  const summary = subs.length
    ? `${subs.length} submission${subs.length > 1 ? "s" : ""} retrieved (${status ? `${status} only` : "all statuses"}${overdueOnly ? ", overdue only" : ""}).`
    : "No submissions matched these filters.";
  return {
    summary,
    data: subs.map((s) => ({ id: s.id, ref: s.ref, title: s.title, status: s.status, overdue: s.overdue, dueDate: iso(s.dueDate), period: s.period, entity: nameOf(subsd, s.subsidiaryId), submittedAt: iso(s.submittedAt) })),
    blocks,
    sources: subs.slice(0, 8).map((s) => ({ kind: "submission" as const, id: s.id, label: s.ref, period: s.period, detailView: { view: "submissions", detailId: s.id } })),
  };
};

const get_submission_details: ToolHandler = async (args) => {
  const idOrRef = str(args.submissionId) ?? str(args.ref);
  if (!idOrRef) return { summary: "Missing submission identifier.", error: "submissionId or ref required" };
  const s = await db.submission.findFirst({ where: { OR: [{ id: idOrRef }, { ref: idOrRef }] } });
  if (!s) return { summary: "Submission not found.", error: "not_found" };
  const [sub, unit, project, submitter, reviewer] = await Promise.all([
    s.subsidiaryId ? db.subsidiary.findUnique({ where: { id: s.subsidiaryId } }) : null,
    s.businessUnitId ? db.businessUnit.findUnique({ where: { id: s.businessUnitId } }) : null,
    s.projectId ? db.project.findUnique({ where: { id: s.projectId } }) : null,
    s.submittedById ? db.user.findUnique({ where: { id: s.submittedById } }) : null,
    s.reviewerId ? db.user.findUnique({ where: { id: s.reviewerId } }) : null,
  ]);
  const values = parseJson<{ label: string; value: number; unit: string }[]>(s.values, []);
  const history = parseJson<{ action: string; actor: string; at: string; note?: string }[]>(s.history, []);
  const evidence = parseJson<string[]>(s.evidence, []);
  const comments = parseJson<{ author: string; role: string; text: string; at: string }[]>(s.comments, []);

  const entity = [sub?.name, unit?.name, project?.name].filter(Boolean).join(" › ") || undefined;
  const subBlock: ContentBlock = {
    type: "submission",
    submissionId: s.id,
    ref: s.ref,
    title: s.title,
    status: SUBMISSION_STATUS_LABELS[s.status] ?? s.status,
    deadlineStatus: deadlineStatusOf(s),
    period: s.period,
    entity,
    submittedAt: iso(s.submittedAt),
    submittedBy: submitter?.name,
    reviewer: reviewer?.name,
    dueDate: iso(s.dueDate),
    overdue: s.overdue,
    navView: { view: "submissions", detailId: s.id },
  };
  const timelineBlock: ContentBlock = {
    type: "approval_timeline",
    title: `Workflow history — ${s.ref}`,
    submissionRef: s.ref,
    events: [
      ...history.map((h) => ({
        actor: h.actor,
        action: h.action,
        decision: decisionOf(h.action),
        comment: h.note || undefined,
        at: h.at,
      })),
      ...comments.map((c) => ({ actor: c.author, role: c.role, action: "Comment", decision: "NOTE" as const, comment: c.text, at: c.at })),
    ].sort((a, b) => a.at.localeCompare(b.at)),
  };
  const dataTable: ContentBlock | null = values.length
    ? {
        type: "data_table",
        title: `Reported values — ${s.ref}`,
        columns: [{ key: "label", label: "Metric" }, { key: "value", label: "Value", align: "right" }, { key: "unit", label: "Unit" }],
        rows: values.map((v) => ({ cells: [v.label, v.value, v.unit] })),
        note: `Source: Submission ${s.ref} values column · period ${s.period}`,
      }
    : null;

  const sourceRefs: SourceReference[] = [subRef(s.id)];
  const evidenceBlocks: ContentBlock[] = [];
  if (evidence.length) {
    for (const ev of evidence.slice(0, 6)) {
      evidenceBlocks.push({
        type: "evidence",
        evidenceId: `inline-${ev}`,
        name: String(ev),
        submissionRef: s.ref,
        entity,
        docType: "Attached file",
      });
    }
  }
  return {
    summary: `Submission ${s.ref} "${s.title}": ${SUBMISSION_STATUS_LABELS[s.status]}, deadline ${deadlineStatusOf(s)}, ${values.length} reported values, ${evidence.length} evidence files, ${comments.length} review comments.`,
    data: {
      id: s.id, ref: s.ref, title: s.title, status: s.status, category: s.category, period: s.period,
      metric: s.metricName ? { name: s.metricName, value: s.metricValue, unit: s.metricUnit } : null,
      dueDate: iso(s.dueDate), submittedAt: iso(s.submittedAt), reviewedAt: iso(s.reviewedAt),
      entity: { subsidiary: sub?.name ?? null, businessUnit: unit?.name ?? null, project: project?.name ?? null },
      submittedBy: submitter?.name ?? null, reviewer: reviewer?.name ?? null,
      values, evidence: evidence.map((e) => String(e)), comments, history, deadlineStatus: deadlineStatusOf(s),
    },
    blocks: [subBlock, ...(dataTable ? [dataTable] : []), timelineBlock, ...evidenceBlocks],
    sources: sourceRefs,
  };
};

const get_approval_history: ToolHandler = async (args) => {
  const idOrRef = str(args.submissionId) ?? str(args.ref);
  if (!idOrRef) return { summary: "Missing submission identifier.", error: "submissionId or ref required" };
  const s = await db.submission.findFirst({ where: { OR: [{ id: idOrRef }, { ref: idOrRef }] } });
  if (!s) return { summary: "Submission not found.", error: "not_found" };
  const history = parseJson<{ action: string; actor: string; at: string; note?: string }[]>(s.history, []);
  const comments = parseJson<{ author: string; role: string; text: string; at: string }[]>(s.comments, []);
  const reviewer = s.reviewerId ? await db.user.findUnique({ where: { id: s.reviewerId }, select: { name: true, role: true } }) : null;
  const block: ContentBlock = {
    type: "approval_timeline",
    title: `Approval & review history — ${s.ref}`,
    submissionRef: s.ref,
    events: [
      ...history.map((h) => ({
        actor: h.actor,
        action: h.action,
        decision: decisionOf(h.action),
        comment: h.note || undefined,
        at: h.at,
      })),
      ...comments.map((c) => ({ actor: c.author, role: c.role, action: "Comment", decision: "NOTE" as const, comment: c.text, at: c.at })),
    ].sort((a, b) => a.at.localeCompare(b.at)),
  };
  return {
    summary: history.length || comments.length
      ? `${s.ref}: ${history.length} workflow events, ${comments.length} review comments. Current reviewer: ${reviewer?.name ?? "none assigned"}.`
      : `${s.ref}: no approval metadata recorded yet — the record does not contain review history.`,
    data: { ref: s.ref, status: s.status, reviewer: reviewer?.name ?? null, history, comments },
    blocks: [block],
    sources: [subRef(s.id)],
  };
};

const search_evidence: ToolHandler = async (args) => {
  const q = str(args.query);
  const status = str(args.status)?.toUpperCase();
  const submissionRef = str(args.submissionRef);
  const projectId = str(args.projectId);
  const limit = Math.min(Math.max(num(args.limit) ?? 10, 1), 30);
  const where: Record<string, unknown> = {};
  if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }, { disclosureRef: { contains: q, mode: "insensitive" } }];
  if (status) where.status = status;
  if (submissionRef) where.submissionRef = submissionRef;
  /* Evidence documents attached to this project's submissions. */
  const projectSubmissionIds = projectId
    ? (await db.submission.findMany({ where: { projectId }, select: { id: true } })).map((s) => s.id)
    : [];
  const [docs, vault, subsidiaries, projectSubs] = await Promise.all([
    db.evidenceDoc.findMany({ where, orderBy: { uploadedAt: "desc" }, take: limit }),
    db.evidence.findMany({
      where: projectId
        ? { projectId, ...(q ? { OR: [{ fileName: { contains: q, mode: "insensitive" } }, { documentType: { contains: q, mode: "insensitive" } }] } : {}) }
        : q
          ? { OR: [{ fileName: { contains: q, mode: "insensitive" } }, { documentType: { contains: q, mode: "insensitive" } }] }
          : { id: "none" },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { uploader: { select: { name: true } } },
    }),
    db.subsidiary.findMany({ select: { id: true, name: true } }),
    projectSubmissionIds.length
      ? db.evidenceDoc.findMany({
          where: { submissionId: { in: projectSubmissionIds } },
          orderBy: { uploadedAt: "desc" },
          take: limit,
        })
      : Promise.resolve([]),
  ]);
  /* Merge the project's own evidence documents with the searched ones. */
  const mergedDocs = [...docs];
  for (const d of projectSubs) {
    if (!mergedDocs.some((x) => x.id === d.id)) mergedDocs.push(d);
  }
  const subName = (id: string | null) => (id ? subsidiaries.find((s) => s.id === id)?.name ?? undefined : undefined);
  const blocks: ContentBlock[] = [
    ...mergedDocs.map((d) => ({
      type: "evidence",
      evidenceId: d.id,
      name: d.name,
      docType: d.fileType,
      status: d.status,
      fileType: d.fileType,
      version: d.version,
      uploadedBy: d.uploadedBy || undefined,
      uploadedAt: iso(d.uploadedAt),
      submissionRef: d.submissionRef || undefined,
      entity: subName(d.subsidiaryId),
    } as ContentBlock)),
    ...vault.map((v) => ({
      type: "evidence",
      evidenceId: v.id,
      name: v.fileName,
      docType: v.documentType,
      status: v.status,
      fileType: v.mimeType?.split("/").pop()?.toUpperCase() || undefined,
      uploadedBy: v.uploader?.name || undefined,
      uploadedAt: iso(v.createdAt),
      entity: v.projectId ? "Project-linked vault file" : undefined,
    } as ContentBlock)),
  ];
  return {
    summary: docs.length || vault.length
      ? `Found ${docs.length} repository document${docs.length === 1 ? "" : "s"}${vault.length ? ` and ${vault.length} vault file${vault.length === 1 ? "" : "s"}` : ""}${q ? ` matching "${q}"` : ""}.`
      : `No evidence documents found${q ? ` matching "${q}"` : ""}.`,
    data: { repository: docs.map((d) => ({ id: d.id, name: d.name, status: d.status, fileType: d.fileType, submissionRef: d.submissionRef, disclosureRef: d.disclosureRef, uploadedAt: iso(d.uploadedAt) })), vault: vault.map((v) => ({ id: v.id, name: v.fileName, documentType: v.documentType, status: v.status, uploadedAt: iso(v.createdAt) })) },
    blocks,
    sources: docs.slice(0, 6).map((d) => ({ kind: "evidence" as const, id: d.id, label: d.name })),
  };
};

const get_missing_evidence: ToolHandler = async (args) => {
  const subsidiaryId = str(args.subsidiaryId);
  const limit = Math.min(Math.max(num(args.limit) ?? 10, 1), 30);
  const where: Record<string, unknown> = { status: { in: ["OPEN", "ASSIGNED"] }, rule: { in: ["MISSING_EVIDENCE", "MISSING_SUBMISSION", "MISSING_FIELD"] } };
  if (subsidiaryId) where.subsidiaryId = subsidiaryId;
  const [issues, missingDocs, subsidiaries] = await Promise.all([
    db.validationIssue.findMany({ where, orderBy: [{ severity: "desc" }, { detectedAt: "desc" }], take: limit }),
    db.evidenceDoc.count({ where: { status: "MISSING", ...(subsidiaryId ? { subsidiaryId } : {}) } }),
    db.subsidiary.findMany({ select: { id: true, name: true } }),
  ]);
  const subName = (id: string) => subsidiaries.find((s) => s.id === id)?.name ?? "—";
  const blocks: ContentBlock[] = issues.map((i) => ({
    type: "recommendation",
    recommendationId: `ve-${i.id}`,
    title: `${i.rule.replace(/_/g, " ")} — ${i.description}`,
    explanation: `${subName(i.subsidiaryId)} · period ${i.period}${i.submissionRef ? ` · submission ${i.submissionRef}` : ""}${i.responsibleName ? ` · responsible: ${i.responsibleName}` : ""}`,
    priority: i.severity === "CRITICAL" ? "HIGH" : i.severity === "HIGH" ? "HIGH" : "MEDIUM",
    scope: subName(i.subsidiaryId),
    period: i.period,
    basis: "data",
    suggestedAction: { label: "Open validation issues", view: { view: "consolidation", detailId: i.id } },
  }));
  return {
    summary: issues.length || missingDocs
      ? `${issues.length} open data-completeness issues and ${missingDocs} documents flagged MISSING.`
      : "No missing-evidence or data-completeness issues are currently open.",
    data: { issues: issues.map((i) => ({ ref: i.ref, rule: i.rule, severity: i.severity, description: i.description, subsidiary: subName(i.subsidiaryId), period: i.period, status: i.status, submissionRef: i.submissionRef })), missingDocumentCount: missingDocs },
    blocks,
    sources: issues.slice(0, 6).map((i) => ({ kind: "record" as const, id: i.id, label: i.ref, detailView: { view: "consolidation", detailId: i.id } })),
  };
};

const get_group_performance: ToolHandler = async (args, ctx) => {
  const period = str(args.period) ?? ctx.reportingYear;
  const where: Record<string, unknown> = { period };
  const [subs, statusAgg, overdueCount, packages, openIssues, openAnomalies] = await Promise.all([
    db.subsidiary.findMany({ select: { id: true, name: true, code: true, status: true } }),
    db.submission.groupBy({ by: ["status"] as const, where, _count: { _all: true } }),
    db.submission.count({ where: { ...where, overdue: true, status: { notIn: ["APPROVED", "REJECTED"] } } }),
    db.reportingPackage.findMany({ where: { period }, orderBy: { readinessPct: "asc" }, take: 6 }),
    db.validationIssue.count({ where: { status: { in: ["OPEN", "ASSIGNED"] }, period } }),
    db.anomalyEvent.count({ where: { status: "OPEN" } }),
  ]);
  const statusCounts = Object.fromEntries(statusAgg.map((g) => [g.status, g._count._all]));
  const total = Object.values(statusCounts).reduce((a: number, b: number) => a + b, 0);
  const approved = statusCounts["APPROVED"] ?? 0;
  const pending = (statusCounts["SUBMITTED"] ?? 0) + (statusCounts["UNDER_REVIEW"] ?? 0) + (statusCounts["ASSIGNED"] ?? 0);
  const kpiBlock: ContentBlock = {
    type: "kpi",
    title: `Group ESG Performance — ${period}`,
    period,
    scope: "Entire Group",
    items: [
      { label: "Active subsidiaries", value: String(subs.filter((s) => s.status === "ACTIVE").length), hint: "of " + subs.length + " registered" },
      { label: "Submissions", value: String(total), hint: `${approved} approved · ${pending} in workflow` },
      { label: "Overdue", value: String(overdueCount), delta: overdueCount > 0 ? "attention" : "clear", deltaDirection: overdueCount > 0 ? "up" : "flat", hint: "open submissions past due date" },
      { label: "Packages below 100% readiness", value: String(packages.filter((p) => p.readinessPct < 100).length), hint: "of " + packages.length + " group packages" },
      { label: "Open validation issues", value: String(openIssues), hint: "data quality queue" },
      { label: "Open anomalies", value: String(openAnomalies), hint: "engine-detected" },
    ],
  };
  // Per-subsidiary comparison derived from real rows (single grouped query).
  const perSubAgg = await db.submission.groupBy({
    by: ["subsidiaryId", "status"] as const,
    where: { ...where, subsidiaryId: { in: subs.map((s) => s.id) } },
    _count: { _all: true },
  });
  const comparison: ComparisonBlockData[] = subs.map((s) => {
    const counts = Object.fromEntries(
      perSubAgg.filter((g) => g.subsidiaryId === s.id).map((g) => [g.status, g._count._all])
    );
    return { id: s.id, name: s.name, code: s.code, approved: counts["APPROVED"] ?? 0, pending: (counts["SUBMITTED"] ?? 0) + (counts["UNDER_REVIEW"] ?? 0) + (counts["ASSIGNED"] ?? 0), rejected: (counts["REJECTED"] ?? 0) + (counts["CHANGES_REQUESTED"] ?? 0), total: Object.values(counts).reduce((a: number, b: number) => a + b, 0) };
  });
  const comparisonBlock: ContentBlock | null = comparison.length
    ? {
        type: "comparison",
        title: "Subsidiary comparison",
        period,
        entityLabels: comparison.map((c) => c.name),
        metrics: [
          { label: "Approved submissions", values: comparison.map((c) => c.approved), winner: comparison.reduce((best, c, i, arr) => (c.approved > arr[best].approved ? i : best), 0) },
          { label: "In workflow", values: comparison.map((c) => c.pending) },
          { label: "Returned / rejected", values: comparison.map((c) => c.rejected) },
        ],
      }
    : null;
  const blocks: ContentBlock[] = [kpiBlock, ...(comparisonBlock ? [comparisonBlock] : [])];
  return {
    summary: `Group ${period}: ${total} submissions (${approved} approved, ${pending} pending), ${overdueCount} overdue, ${openIssues} open validation issues, ${openAnomalies} open anomalies.`,
    data: { period, statusCounts, overdueCount, openValidationIssues: openIssues, openAnomalies, packages: packages.map((p) => ({ ref: p.ref, subsidiary: p.subsidiaryName, readinessPct: p.readinessPct, status: p.status })), subsidiaryComparison: comparison },
    blocks,
    sources: packages.slice(0, 5).map((p) => ({ kind: "package" as const, id: p.id, label: `${p.ref} — ${p.subsidiaryName}`, period: p.period, detailView: { view: "consolidation" } })),
  };
};

interface ComparisonBlockData { id: string; name: string; code: string; approved: number; pending: number; rejected: number; total: number }

const compare_entities: ToolHandler = async (args) => {
  const metric = (str(args.metric) ?? "submissions").toLowerCase();
  if (metric !== "submissions") {
    return { summary: `Metric "${metric}" is not available for entity comparison yet. Supported: submissions.`, error: "unsupported_metric" };
  }
  const ids = Array.isArray(args.subsidiaryIds) ? args.subsidiaryIds.map(String) : [];
  const subs = await db.subsidiary.findMany(ids.length ? { where: { id: { in: ids } } } : undefined);
  const [perSubAgg, overdueAgg] = await Promise.all([
    db.submission.groupBy({ by: ["subsidiaryId", "status"] as const, where: { subsidiaryId: { in: subs.map((s) => s.id) } }, _count: { _all: true } }),
    db.submission.groupBy({ by: ["subsidiaryId"] as const, where: { subsidiaryId: { in: subs.map((s) => s.id) }, overdue: true, status: { notIn: ["APPROVED", "REJECTED"] } }, _count: { _all: true } }),
  ]);
  const rows = subs.map((s) => {
    const counts = Object.fromEntries(perSubAgg.filter((g) => g.subsidiaryId === s.id).map((g) => [g.status, g._count._all]));
    return { name: s.name, approved: counts["APPROVED"] ?? 0, pending: (counts["SUBMITTED"] ?? 0) + (counts["UNDER_REVIEW"] ?? 0), returned: (counts["CHANGES_REQUESTED"] ?? 0) + (counts["REJECTED"] ?? 0), overdue: overdueAgg.find((g) => g.subsidiaryId === s.id)?._count._all ?? 0 };
  });
  const block: ContentBlock = {
    type: "comparison",
    title: "All subsidiaries — submission ledger",
    entityLabels: rows.map((r) => r.name),
    metrics: [
      { label: "Approved", values: rows.map((r) => r.approved) },
      { label: "Pending", values: rows.map((r) => r.pending) },
      { label: "Overdue", values: rows.map((r) => r.overdue) },
    ],
  };
  return {
    summary: `Compared ${rows.length} subsidiaries across the submission ledger (approved / pending / overdue).`,
    data: rows,
    blocks: [block],
  };
};

const get_reporting_completion: ToolHandler = async (args, ctx) => {
  const period = str(args.period) ?? ctx.reportingYear;
  const subs = await db.subsidiary.findMany({ select: { id: true, name: true } });
  const expected = await db.reportingTimeline.count({ where: { period, status: "ACTIVE", level: "SUBSIDIARY" } });
  const packages = await db.reportingPackage.findMany({ where: { period } });
  const rows = packages.map((p) => ({ subsidiary: p.subsidiaryName, ref: p.ref, readinessPct: p.readinessPct, status: p.status }));
  const complete = rows.filter((r) => r.readinessPct >= 100).length;
  const kpi: ContentBlock = {
    type: "kpi",
    title: `Reporting Completion — ${period}`,
    period,
    scope: "Group",
    items: [
      { label: "Subsidiary timelines active", value: String(expected), hint: "reporting timelines configured" },
      { label: "Packages submitted", value: String(rows.length), hint: `${complete} at 100% readiness` },
      { label: "Average readiness", value: rows.length ? `${Math.round(rows.reduce((a, b) => a + b.readinessPct, 0) / rows.length)}%` : "—", hint: "group mean of package readiness" },
      { label: "Subsidiaries registered", value: String(subs.length), hint: "with packages" + (rows.length < subs.length ? ` — ${subs.length - rows.length} have no package yet` : "") },
    ],
  };
  const table: ContentBlock | null = rows.length
    ? {
        type: "data_table",
        title: "Reporting package readiness",
        columns: [{ key: "sub", label: "Subsidiary" }, { key: "ref", label: "Package" }, { key: "readiness", label: "Readiness", align: "right" }, { key: "status", label: "Status" }],
        rows: rows.map((r) => ({ cells: [r.subsidiary, r.ref, `${r.readinessPct}%`, r.status] })),
        note: `Source: ReportingPackage ledger · period ${period}`,
      }
    : null;
  return {
    summary: rows.length
      ? `${period}: ${rows.length} reporting packages, average readiness ${Math.round(rows.reduce((a, b) => a + b.readinessPct, 0) / rows.length)}%, ${complete} complete.`
      : `${period}: no reporting packages submitted yet.`,
    data: { period, activeTimelines: expected, packages: rows },
    blocks: [kpi, ...(table ? [table] : [])],
    sources: rows.slice(0, 6).map((r) => ({ kind: "package" as const, id: r.ref, label: r.ref, period })),
  };
};

const get_deadline_summary: ToolHandler = async (args, ctx) => {
  const period = str(args.period) ?? ctx.reportingYear;
  const open = await db.submission.findMany({
    where: { period, status: { in: ["ASSIGNED", "SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED", "DRAFT"] } },
    orderBy: { dueDate: "asc" },
    take: 40,
  });
  const now = Date.now();
  const overdue = open.filter((s) => s.overdue || s.dueDate.getTime() < now);
  const dueSoon = open.filter((s) => !overdue.includes(s) && s.dueDate.getTime() - now < 7 * 86400000);
  const upNext = open.filter((s) => !overdue.includes(s) && !dueSoon.includes(s));
  const [subs, units, projects] = await Promise.all([
    db.subsidiary.findMany({ select: { id: true, name: true } }),
    db.businessUnit.findMany({ select: { id: true, name: true } }),
    db.project.findMany({ select: { id: true, name: true } }),
  ]);
  const ent = (s: { subsidiaryId: string | null; businessUnitId: string | null; projectId: string | null }) =>
    subs.find((x) => x.id === s.subsidiaryId)?.name ?? units.find((x) => x.id === s.businessUnitId)?.name ?? projects.find((x) => x.id === s.projectId)?.name ?? "—";
  const kpi: ContentBlock = {
    type: "kpi",
    title: `Deadline Summary — ${period}`,
    period,
    scope: "Group",
    items: [
      { label: "Overdue submissions", value: String(overdue.length), delta: overdue.length ? "action needed" : undefined, deltaDirection: overdue.length ? "up" : "flat", hint: "workflow status unaffected — deadline only" },
      { label: "Due within 7 days", value: String(dueSoon.length), hint: "open submissions" },
      { label: "Later deadlines", value: String(upNext.length), hint: "open submissions" },
      { label: "Total in workflow", value: String(open.length), hint: "all open workflow statuses" },
    ],
  };
  const table: ContentBlock = {
    type: "data_table",
    title: "Nearest deadlines",
    columns: [{ key: "ref", label: "Submission" }, { key: "entity", label: "Entity" }, { key: "due", label: "Due date" }, { key: "status", label: "Deadline status" }],
    rows: [...overdue, ...dueSoon].slice(0, 10).map((s) => ({
      cells: [`${s.ref} — ${s.title.slice(0, 40)}`, ent(s), s.dueDate.toISOString().slice(0, 10), deadlineStatusOf(s)],
    })),
    note: `Workflow status (Draft/Submitted/…) is reported separately from deadline status. Source: Submission ledger · ${period}`,
  };
  return {
    summary: `${period}: ${overdue.length} overdue, ${dueSoon.length} due within 7 days, ${upNext.length} later — ${open.length} open submissions.`,
    data: { overdue: overdue.map((s) => ({ ref: s.ref, dueDate: iso(s.dueDate), title: s.title })), dueSoon: dueSoon.map((s) => ({ ref: s.ref, dueDate: iso(s.dueDate), title: s.title })) },
    blocks: [kpi, table],
    sources: [...overdue, ...dueSoon].slice(0, 8).map((s) => ({ kind: "submission" as const, id: s.id, label: s.ref, period, detailView: { view: "submissions", detailId: s.id } })),
  };
};

const get_brsr_completeness: ToolHandler = async (args, ctx) => {
  const period = str(args.period) ?? ctx.reportingYear;
  const reports = await db.brsrReport.findMany({ where: { financialYear: period }, orderBy: { updatedAt: "desc" }, take: 5 });
  if (!reports.length) {
    return { summary: `No BRSR report exists for ${period}.`, data: { reports: [] }, blocks: [{ type: "text", text: `No BRSR report record exists for ${period} — nothing has been started in the BRSR Reporting Center yet.` }] };
  }
  const latest = reports[0];
  const disclosures = parseJson<{ code: string; title: string; mapped: boolean; status: string; note?: string; value?: number; unit?: string }[]>(latest.disclosures, []);
  const signoffs = parseJson<{ role: string; name: string; decision: string; at: string; comment?: string }[]>(latest.signoffs, []);
  const byStatus = disclosures.reduce<Record<string, number>>((acc, d) => { acc[d.status] = (acc[d.status] ?? 0) + 1; return acc; }, {});
  const missing = disclosures.filter((d) => !d.mapped || d.status === "MISSING" || d.status === "DRAFT");
  const kpi: ContentBlock = {
    type: "kpi",
    title: `BRSR Completeness — ${latest.ref}`,
    period,
    scope: "Group BRSR",
    items: [
      { label: "Report status", value: latest.status, hint: `version ${latest.version}` },
      { label: "Disclosures mapped", value: `${disclosures.length - missing.length}/${disclosures.length}`, hint: "mapped & approved/locked" },
      { label: "Incomplete disclosures", value: String(missing.length), hint: "missing or draft" },
      { label: "Sign-offs recorded", value: String(signoffs.length), hint: latest.finalizedAt ? `finalized ${iso(latest.finalizedAt)}` : "not finalized" },
    ],
  };
  const table: ContentBlock | null = missing.length
    ? {
        type: "data_table",
        title: "Incomplete BRSR disclosures",
        columns: [{ key: "code", label: "Code" }, { key: "title", label: "Disclosure" }, { key: "status", label: "Status" }],
        rows: missing.slice(0, 12).map((d) => ({ cells: [d.code, d.title, d.status] })),
        note: "BRSR completeness is derived from the disclosure mapping status — it is not a compliance certification.",
      }
    : null;
  return {
    summary: `BRSR ${latest.ref} (${period}): status ${latest.status}, ${disclosures.length - missing.length}/${disclosures.length} disclosures mapped, ${signoffs.length} sign-offs${latest.finalizedAt ? ", finalized" : ", not finalized"}.`,
    data: { ref: latest.ref, status: latest.status, version: latest.version, disclosureStatusCounts: byStatus, incomplete: missing.map((d) => ({ code: d.code, title: d.title, status: d.status })), signoffs, finalizedAt: iso(latest.finalizedAt) },
    blocks: [kpi, ...(table ? [table] : [])],
    sources: [{ kind: "brsr" as const, id: latest.id, label: latest.ref, period, detailView: { view: "brsr", detailId: latest.id } }],
  };
};

const get_compliance_summary: ToolHandler = async (args, ctx) => {
  const period = str(args.period) ?? ctx.reportingYear;
  const [issuesBySeverity, openAnomalies, complianceSubs] = await Promise.all([
    db.validationIssue.groupBy({ by: ["severity"] as const, where: { status: { in: ["OPEN", "ASSIGNED"] }, period }, _count: { _all: true } }),
    db.anomalyEvent.findMany({ where: { status: "OPEN" }, orderBy: { detectedAt: "desc" }, take: 8 }),
    db.submission.groupBy({ by: ["category"] as const, where: { period, category: "COMPLIANCE" }, _count: { _all: true } }),
  ]);
  const severityCounts = Object.fromEntries(issuesBySeverity.map((g) => [g.severity, g._count._all]));
  const totalIssues = Object.values(severityCounts).reduce((a, b) => a + b, 0);
  const kpi: ContentBlock = {
    type: "kpi",
    title: `Compliance & Data Quality Summary — ${period}`,
    period,
    scope: "Group",
    items: [
      { label: "Open validation issues", value: String(totalIssues), hint: `critical ${severityCounts["CRITICAL"] ?? 0} · high ${severityCounts["HIGH"] ?? 0}` },
      { label: "Open engine anomalies", value: String(openAnomalies.length), hint: "calculation anomalies" },
      { label: "Compliance submissions", value: String(complianceSubs[0]?._count ?? 0), hint: "COMPLIANCE category ledger" },
    ],
  };
  const anomalyTable: ContentBlock | null = openAnomalies.length
    ? {
        type: "data_table",
        title: "Open anomalies",
        columns: [{ key: "metric", label: "Metric" }, { key: "expected", label: "Expected range" }, { key: "actual", label: "Actual", align: "right" }, { key: "severity", label: "Severity" }],
        rows: openAnomalies.map((a) => ({ cells: [a.metric, a.expectedRange, a.actualValue, a.severity] })),
        note: "Source: AnomalyEvent (calculation engine) — informational, not a legal conclusion.",
      }
    : null;
  return {
    summary: totalIssues || openAnomalies.length
      ? `${period}: ${totalIssues} open validation issues (${severityCounts["CRITICAL"] ?? 0} critical), ${openAnomalies.length} open calculation anomalies.`
      : `${period}: no open data-quality or anomaly findings.`,
    data: { severityCounts, anomalies: openAnomalies.map((a) => ({ metric: a.metric, expectedRange: a.expectedRange, actualValue: a.actualValue, severity: a.severity, detectedAt: iso(a.detectedAt) })) },
    blocks: [kpi, ...(anomalyTable ? [anomalyTable] : [])],
  };
};

const get_recent_activity: ToolHandler = async (args) => {
  const limit = Math.min(Math.max(num(args.limit) ?? 12, 1), 40);
  const targetType = str(args.targetType);
  const events = await db.activityEvent.findMany({
    where: targetType ? { targetType } : {},
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  const block: ContentBlock = {
    type: "activity_timeline",
    title: "Recent platform activity",
    events: events.map((e) => ({ actor: e.actorName, role: e.actorRole || undefined, action: e.action, target: [e.targetType, e.targetLabel].filter(Boolean).join(" — "), at: e.createdAt.toISOString() })),
  };
  return {
    summary: events.length ? `${events.length} recent activity events retrieved.` : "No activity recorded yet.",
    data: events.map((e) => ({ actor: e.actorName, action: e.action, target: e.targetLabel, at: e.createdAt.toISOString() })),
    blocks: [block],
    sources: [{ kind: "activity" as const, id: "activity-event", label: "Group activity feed" }],
  };
};

/* ── prepared actions (L2/L3, executed only after confirmation) ─────────────── */

export interface PreparedActionSpec {
  actionName: string;
  title: string;
  explanation: string;
  riskLevel: "L2" | "L3";
  summary: string;
  affected?: string[];
  recipients?: string[];
  impact?: string;
  params: Record<string, unknown>;
}

const prepare_reminder: ToolHandler = async (args, ctx) => {
  const audience = str(args.audience);
  const subject = str(args.subject);
  const message = str(args.message);
  if (!audience || !subject) return { summary: "Audience and subject are required to prepare a reminder.", error: "missing_fields" };
  // Validate audience exists — real subsidiaries only.
  const sub = await db.subsidiary.findFirst({ where: { OR: [{ name: audience }, { code: audience }] } });
  const channel = sub ? "SUBSIDIARY" : "GROUP_WIDE";
  const spec: PreparedActionSpec = {
    actionName: "prepare_reminder",
    title: `Send reminder — "${subject}"`,
    explanation: `A reminder message will be recorded in the Communication Center and delivered to ${sub ? `${sub.name} users` : "all group users"}.`,
    riskLevel: "L3",
    summary: `${sub ? `Subsidiary: ${sub.name}` : "Audience: all group users"} · subject "${subject}"${message ? ` · message: ${message}` : ""}`,
    affected: sub ? [sub.name] : ["All group users"],
    recipients: sub ? [`${sub.name} users`] : ["GROUP_WIDE"],
    impact: "Creates a REMINDER message record and notifies recipients via the existing notification system.",
    params: { audience, audienceId: sub?.id ?? null, channel, subject, message: message ?? "", period: ctx.reportingYear },
  };
  return { summary: `Prepared reminder "${subject}" for ${sub ? sub.name : "the whole group"} — awaiting explicit confirmation.`, data: spec };
};

const prepare_deadline_change: ToolHandler = async (args) => {
  const ref = str(args.submissionRef) ?? str(args.submissionId);
  const newDate = str(args.newDueDate);
  const reason = str(args.reason);
  if (!ref || !newDate || !reason) return { summary: "submissionRef, newDueDate (YYYY-MM-DD) and reason are all required.", error: "missing_fields" };
  const d = new Date(newDate);
  if (Number.isNaN(d.getTime())) return { summary: "newDueDate must be a valid date.", error: "invalid_date" };
  const s = await db.submission.findFirst({ where: { OR: [{ id: ref }, { ref }] } });
  if (!s) return { summary: `No submission found for "${ref}".`, error: "not_found" };
  const spec: PreparedActionSpec = {
    actionName: "prepare_deadline_change",
    title: `Change deadline — ${s.ref}`,
    explanation: `The due date of submission ${s.ref} ("${s.title}") will change from ${s.dueDate.toISOString().slice(0, 10)} to ${newDate}.`,
    riskLevel: "L3",
    summary: `${s.ref}: dueDate ${s.dueDate.toISOString().slice(0, 10)} → ${newDate} · reason: ${reason}`,
    affected: [`${s.ref} — ${s.title}`],
    impact: "Updates the submission due date, appends a history entry, and raises a DEADLINE notification. Workflow status is not changed.",
    params: { submissionId: s.id, newDueDate: newDate, reason },
  };
  return { summary: `Prepared deadline change for ${s.ref} (${s.dueDate.toISOString().slice(0, 10)} → ${newDate}) — awaiting explicit confirmation.`, data: spec };
};

const create_follow_up_task: ToolHandler = async (args, ctx) => {
  const title = str(args.title);
  const description = str(args.description) ?? "";
  const assigneeLabel = str(args.assigneeLabel) ?? "";
  const dueDate = str(args.dueDate);
  const priority = (str(args.priority)?.toUpperCase() ?? "MEDIUM");
  if (!title) return { summary: "A task title is required.", error: "missing_fields" };
  if (dueDate) {
    const d = new Date(dueDate);
    if (Number.isNaN(d.getTime())) return { summary: "dueDate must be a valid date.", error: "invalid_date" };
  }
  const spec: PreparedActionSpec = {
    actionName: "create_follow_up_task",
    title: `Create follow-up task — "${title}"`,
    explanation: `A reporting task will be created in the Tasks & Deadlines register${assigneeLabel ? ` assigned to ${assigneeLabel}` : " without a specific assignee"}.`,
    riskLevel: "L2",
    summary: `Task "${title}"${assigneeLabel ? ` for ${assigneeLabel}` : ""}${dueDate ? ` · due ${dueDate}` : ""} · priority ${priority}`,
    affected: assigneeLabel ? [assigneeLabel] : undefined,
    impact: "Creates one Task row in the existing task register. Recipients are resolved by the existing task engine.",
    params: { title, description, assigneeLabel, dueDate: dueDate ?? null, priority, period: ctx.reportingYear },
  };
  return { summary: `Prepared follow-up task "${title}" — awaiting confirmation.`, data: spec };
};

/* ── registry ───────────────────────────────────────────────────────────────── */

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "resolve_entity",
    description: "Resolve an entity (subsidiary, business unit, project, or user) from a name, code, employee ID, or email. Returns exact matches; multiple matches are listed so the user can disambiguate. Always call this before entity-specific tools when the user refers to an entity by name.",
    riskLevel: "L0",
    params: { query: { type: "string", description: "Entity name, code, employee ID, email, or location fragment." } },
  },
  {
    name: "list_subsidiaries",
    description: "List the group subsidiaries with their business-unit count, project count and ACTIVE user head-count. Use for directory questions such as 'how many subsidiaries are there', 'which subsidiaries have users' or 'list all subsidiaries'.",
    riskLevel: "L0",
    params: {
      status: { type: "enum", enum: ["ACTIVE", "INACTIVE"], description: "Filter by subsidiary status.", optional: true },
      limit: { type: "number", description: "Max rows (1-100).", optional: true },
    },
  },
  {
    name: "list_users",
    description: "List platform users with role, organizational scope and status, plus a head-count per subsidiary (active and total). Use for 'who reports to X', 'how many active users does each subsidiary have' or 'list users in <subsidiary>'.",
    riskLevel: "L0",
    params: {
      subsidiaryId: { type: "string", description: "Filter by subsidiary id or code.", optional: true },
      businessUnitId: { type: "string", description: "Filter by business unit id or code.", optional: true },
      projectId: { type: "string", description: "Filter by project id.", optional: true },
      role: { type: "string", description: "Filter by role, e.g. GROUP_ADMIN, ENV_DATA_USER.", optional: true },
      status: { type: "enum", enum: ["ACTIVE", "SUSPENDED", "INACTIVE", "INVITED"], description: "Filter by user status.", optional: true },
      limit: { type: "number", description: "Max rows (1-200).", optional: true },
    },
  },
  {
    name: "list_projects",
    description: "List projects and sites with their business unit, subsidiary, type, location, capacity and assigned user count. Use for 'how many projects does X have', 'list sites in <subsidiary>' or portfolio questions.",
    riskLevel: "L0",
    params: {
      subsidiaryId: { type: "string", description: "Filter by subsidiary id or code.", optional: true },
      businessUnitId: { type: "string", description: "Filter by business unit id or code.", optional: true },
      status: { type: "enum", enum: ["ACTIVE", "INACTIVE"], description: "Filter by project status.", optional: true },
      limit: { type: "number", description: "Max rows (1-200).", optional: true },
    },
  },
  {
    name: "get_subsidiary_profile",
    description: "Retrieve the exact profile of one subsidiary: admin/manager names, business units, submission status counts, open validation issues, latest reporting package. Pass the resolved subsidiary ID or its exact code.",
    riskLevel: "L0",
    params: { subsidiaryId: { type: "string", description: "Subsidiary id or exact code.", optional: true }, query: { type: "string", description: "Name/code fragment if id unknown.", optional: true } },
  },
  {
    name: "get_business_unit_profile",
    description: "Retrieve the exact profile of one business unit: parent subsidiary, admin/manager names, projects, submission status counts.",
    riskLevel: "L0",
    params: { businessUnitId: { type: "string", description: "Business unit id or exact code.", optional: true }, query: { type: "string", description: "Name/code fragment if id unknown.", optional: true } },
  },
  {
    name: "get_project_profile",
    description: "Retrieve the exact profile of one project/site: parent chain, capacity, contributor coverage across the 7 categories, source record counts, recent submissions.",
    riskLevel: "L0",
    params: { projectId: { type: "string", description: "Project id or exact code.", optional: true }, query: { type: "string", description: "Name/code/location fragment if id unknown.", optional: true } },
  },
  {
    name: "get_user_profile",
    description: "Retrieve an authorized user profile: role, organizational scope, status, last login, recent submissions. Never returns credentials.",
    riskLevel: "L0",
    params: { userId: { type: "string", description: "User id, employee ID, or email.", optional: true }, query: { type: "string", description: "Name fragment if id unknown.", optional: true } },
  },
  {
    name: "get_submissions",
    description: "Retrieve the submission ledger with filters. Returns submission cards with workflow status AND separate deadline status.",
    riskLevel: "L0",
    params: {
      status: { type: "enum", enum: ["DRAFT", "ASSIGNED", "SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED", "REJECTED", "APPROVED"], description: "Filter by workflow status.", optional: true },
      subsidiaryId: { type: "string", description: "Filter by subsidiary id/code.", optional: true },
      projectId: { type: "string", description: "Filter by project id.", optional: true },
      period: { type: "string", description: "Reporting period e.g. FY 2025-26.", optional: true },
      overdueOnly: { type: "boolean", description: "Only overdue submissions.", optional: true },
      limit: { type: "number", description: "Max rows (1-50).", optional: true },
    },
  },
  {
    name: "get_submission_details",
    description: "Retrieve one exact submission by id or ref: values, evidence, comments, full workflow history, reviewer, submitter, deadline status.",
    riskLevel: "L0",
    params: { submissionId: { type: "string", description: "Submission id or ref.", optional: true }, ref: { type: "string", description: "Submission ref.", optional: true } },
  },
  {
    name: "get_approval_history",
    description: "Retrieve the approval/review history of one submission: every workflow event, review comment, reviewer, timestamps. Returns 'no metadata recorded' when the record has none — never invent history.",
    riskLevel: "L0",
    params: { submissionId: { type: "string", description: "Submission id or ref.", optional: true }, ref: { type: "string", description: "Submission ref.", optional: true } },
  },
  {
    name: "search_evidence",
    description: "Search evidence documents across the subsidiary repository and the project evidence vault by name, disclosure ref, submission ref, or status.",
    riskLevel: "L0",
    params: {
      query: { type: "string", description: "Name/disclosure fragment.", optional: true },
      status: { type: "enum", enum: ["VALID", "MISSING", "EXPIRED", "REQUIRED", "UPLOADED", "UNDER_REVIEW", "VERIFIED", "REJECTED"], description: "Filter by status.", optional: true },
      submissionRef: { type: "string", description: "Filter by submission ref.", optional: true },
      limit: { type: "number", description: "Max results.", optional: true },
    },
  },
  {
    name: "get_missing_evidence",
    description: "Retrieve open data-completeness findings: missing evidence, missing submissions, missing fields — plus count of documents flagged MISSING.",
    riskLevel: "L0",
    params: { subsidiaryId: { type: "string", description: "Optional subsidiary filter.", optional: true }, limit: { type: "number", optional: true } },
  },
  {
    name: "get_group_performance",
    description: "Group-wide ESG performance for a period: submission status counts, overdue count, package readiness, open validation issues and anomalies, plus a subsidiary comparison derived from the ledger.",
    riskLevel: "L0",
    params: { period: { type: "string", description: "Reporting period e.g. FY 2025-26. Defaults to the active workspace period.", optional: true } },
  },
  {
    name: "compare_entities",
    description: "Compare subsidiaries on a metric. Supported metric: submissions (approved/pending/overdue).",
    riskLevel: "L0",
    params: { metric: { type: "string", description: "Metric to compare. Currently: submissions.", optional: true }, subsidiaryIds: { type: "array", description: "Optional list of subsidiary ids.", optional: true } },
  },
  {
    name: "get_reporting_completion",
    description: "Reporting completion for a period: active subsidiary timelines, package readiness percentages, average readiness.",
    riskLevel: "L0",
    params: { period: { type: "string", optional: true } },
  },
  {
    name: "get_deadline_summary",
    description: "Deadline intelligence: overdue submissions, due within 7 days, later deadlines. Deadline status is separate from workflow status.",
    riskLevel: "L0",
    params: { period: { type: "string", optional: true } },
  },
  {
    name: "get_brsr_completeness",
    description: "BRSR report completeness for a period: disclosure mapping status, incomplete disclosures, sign-offs, finalization state. Never claims compliance.",
    riskLevel: "L0",
    params: { period: { type: "string", optional: true } },
  },
  {
    name: "get_compliance_summary",
    description: "Compliance & data-quality summary: open validation issues by severity, open calculation anomalies, compliance-category submissions.",
    riskLevel: "L0",
    params: { period: { type: "string", optional: true } },
  },
  {
    name: "get_recent_activity",
    description: "Chronological activity feed (who did what, when) from the operational activity log.",
    riskLevel: "L0",
    params: { limit: { type: "number", optional: true }, targetType: { type: "string", description: "Optional target filter e.g. Submission.", optional: true } },
  },
  {
    name: "prepare_reminder",
    description: "PREPARE (not send) a reminder message for a subsidiary or the whole group. Requires explicit user confirmation before it is recorded. Audience must be a real subsidiary name/code or 'group'.",
    riskLevel: "L3",
    params: { audience: { type: "string", description: "Subsidiary name/code, or 'group'." }, subject: { type: "string" }, message: { type: "string", description: "Reminder body.", optional: true } },
  },
  {
    name: "prepare_deadline_change",
    description: "PREPARE (not execute) a due-date change for one submission. Requires reason and explicit user confirmation. Never changes workflow status.",
    riskLevel: "L3",
    params: { submissionRef: { type: "string", description: "Submission id or ref." }, newDueDate: { type: "string", description: "YYYY-MM-DD" }, reason: { type: "string" } },
  },
  {
    name: "create_follow_up_task",
    description: "PREPARE (not create) a follow-up task in the Tasks & Deadlines register. Requires explicit user confirmation.",
    riskLevel: "L2",
    params: { title: { type: "string" }, description: { type: "string", optional: true }, assigneeLabel: { type: "string", description: "Assignee display label e.g. subsidiary name or role group.", optional: true }, dueDate: { type: "string", description: "YYYY-MM-DD", optional: true }, priority: { type: "enum", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"], optional: true } },
  },
];

export const TOOL_HANDLERS: Record<string, ToolHandler> = {
  resolve_entity,
  list_subsidiaries,
  list_users,
  list_projects,
  get_subsidiary_profile,
  get_business_unit_profile,
  get_project_profile,
  get_user_profile,
  get_submissions,
  get_submission_details,
  get_approval_history,
  search_evidence,
  get_missing_evidence,
  get_group_performance,
  compare_entities,
  get_reporting_completion,
  get_deadline_summary,
  get_brsr_completeness,
  get_compliance_summary,
  get_recent_activity,
  prepare_reminder,
  prepare_deadline_change,
  create_follow_up_task,
};

export function getToolDefinition(name: string): ToolDefinition | undefined {
  return TOOL_DEFINITIONS.find((t) => t.name === name);
}

export type { CopilotRequestContext };
