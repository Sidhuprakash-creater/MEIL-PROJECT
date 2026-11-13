import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handle, ok, fail } from "@/lib/esg/server";
import type { HierarchyNode, HierarchyNodeDetail, HierarchySummary } from "@/lib/esg/types";

const SUBMISSION_STATUSES = [
  "APPROVED",
  "UNDER_REVIEW",
  "SUBMITTED",
  "CHANGES_REQUESTED",
  "ASSIGNED",
  "DRAFT",
  "REJECTED",
] as const;

/** GET /api/esg/hierarchy            → full tree + group summary
 *  GET /api/esg/hierarchy?nodeId=…   → rich detail payload for the view panel */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const nodeId = req.nextUrl.searchParams.get("nodeId");
    if (nodeId) {
      const detail = await buildNodeDetail(nodeId);
      if (!detail) return fail("Node not found in the organization hierarchy.", 404);
      return ok({ detail });
    }
    return ok(await buildTree());
  });
}

function presenceOf(u: { status: string; lastActiveAt: Date | null }): "now" | "today" | "away" | "offline" | "invited" | "suspended" {
  if (u.status === "INVITED") return "invited";
  if (u.status === "SUSPENDED") return "suspended";
  if (u.status === "INACTIVE") return "offline";
  if (!u.lastActiveAt) return "offline";
  const mins = (Date.now() - new Date(u.lastActiveAt).getTime()) / 60000;
  if (mins < 30) return "now";
  if (mins < 720) return "today";
  if (mins < 2160) return "away";
  return "offline";
}

async function buildTree(): Promise<{ nodes: HierarchyNode[]; summary: HierarchySummary }> {
  const [subs, units, projects, users, submissions] = await Promise.all([
    db.subsidiary.findMany({ orderBy: { name: "asc" } }),
    db.businessUnit.findMany({ orderBy: { name: "asc" } }),
    db.project.findMany({ include: { businessUnit: true }, orderBy: { name: "asc" } }),
    db.user.findMany({ select: { id: true, subsidiaryId: true, businessUnitId: true, projectId: true } }),
    db.submission.findMany({ select: { subsidiaryId: true, businessUnitId: true, projectId: true, status: true, overdue: true } }),
  ]);

  const nodes: HierarchyNode[] = subs.map((s) => {
    const sUnits = units.filter((u) => u.subsidiaryId === s.id);
    const sUnitIds = new Set(sUnits.map((u) => u.id));
    const subProjects = projects.filter((p) => p.businessUnit.subsidiaryId === s.id);
    const subProjectIds = new Set(subProjects.map((p) => p.id));
    const sSubs = submissions.filter((x) => x.subsidiaryId === s.id);
    const sUsers = users.filter(
      (u) =>
        u.subsidiaryId === s.id ||
        (u.businessUnitId ? sUnitIds.has(u.businessUnitId) : false) ||
        (u.projectId ? subProjectIds.has(u.projectId) : false)
    );

    return {
      id: s.id,
      type: "subsidiary",
      code: s.code,
      name: s.name,
      status: s.status,
      meta: `${s.sector} · ${s.city}, ${s.region}`,
      manager: s.managerName,
      stats: { users: sUsers.length, projects: subProjects.length, submissions: sSubs.length },
      children: sUnits.map((u) => {
        const uProjects = projects.filter((p) => p.businessUnitId === u.id);
        const uProjectIds = new Set(uProjects.map((p) => p.id));
        const uSubs = submissions.filter((x) => x.businessUnitId === u.id);
        const uUsers = users.filter(
          (x) => x.businessUnitId === u.id || (x.projectId ? uProjectIds.has(x.projectId) : false)
        );

        return {
          id: u.id,
          type: "unit",
          code: u.code,
          name: u.name,
          status: u.status,
          meta: `Business Unit of ${s.name}`,
          manager: u.managerName,
          stats: { users: uUsers.length, projects: uProjects.length, submissions: uSubs.length },
          children: uProjects.map((p) => ({
            id: p.id,
            type: "project" as const,
            code: p.code,
            name: p.name,
            status: p.status,
            kind: p.ptype,
            meta: `${p.ptype.replaceAll("_", " ")} · ${p.location}${p.capacityMw ? ` · ${p.capacityMw} MW` : ""}`,
            manager: "",
            stats: {
              users: users.filter((x) => x.projectId === p.id).length,
              projects: 0,
              submissions: submissions.filter((x) => x.projectId === p.id).length,
            },
          })),
        };
      }),
    };
  });

  const approved = submissions.filter((x) => x.status === "APPROVED").length;
  const pendingReview = submissions.filter((x) => x.status === "SUBMITTED" || x.status === "UNDER_REVIEW").length;
  const overdue = submissions.filter((x) => x.overdue).length;

  const summary: HierarchySummary = {
    subsidiaries: subs.length,
    units: units.length,
    projects: projects.length,
    users: users.length,
    submissions: submissions.length,
    approved,
    pendingReview,
    overdue,
    approvalRate: submissions.length > 0 ? Math.round((approved / submissions.length) * 100) : 0,
  };

  return { nodes, summary };
}

/* ────────────────────────── Node detail (view panel) ────────────────────────── */

async function buildNodeDetail(id: string): Promise<HierarchyNodeDetail | null> {
  const [subs, units, projects, users, submissions, activityEvents] = await Promise.all([
    db.subsidiary.findMany({ orderBy: { name: "asc" } }),
    db.businessUnit.findMany({ include: { subsidiary: true }, orderBy: { name: "asc" } }),
    db.project.findMany({ include: { businessUnit: { include: { subsidiary: true } } }, orderBy: { name: "asc" } }),
    db.user.findMany({ orderBy: [{ lastActiveAt: "desc" }, { name: "asc" }] }),
    db.submission.findMany({ orderBy: { updatedAt: "desc" } }),
    db.activityEvent.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
  ]);

  const sub = subs.find((s) => s.id === id);
  const unit = units.find((u) => u.id === id);
  const project = projects.find((p) => p.id === id);
  if (!sub && !unit && !project) return null;

  /* Scope selectors — which submissions/users belong to this node */
  let type: HierarchyNodeDetail["type"];
  let code: string;
  let name: string;
  let status: string;
  let meta: string;
  let manager: string;
  let profile: { label: string; value: string }[];
  let breadcrumb: HierarchyNodeDetail["breadcrumb"];
  let childNodes: HierarchyNodeDetail["children"];
  let inScope: (x: { subsidiaryId: string | null; businessUnitId: string | null; projectId: string | null }) => boolean;
  let userInScope: (u: (typeof users)[number]) => boolean;
  let projectCount = 0;

  if (sub) {
    type = "subsidiary";
    code = sub.code;
    name = sub.name;
    status = sub.status;
    meta = `${sub.sector} · ${sub.city}, ${sub.region}`;
    manager = sub.managerName;
    const myUnits = units.filter((u) => u.subsidiaryId === sub.id);
    const myUnitIds = new Set(myUnits.map((u) => u.id));
    const myProjects = projects.filter((p) => myUnitIds.has(p.businessUnitId));
    const myProjectIds = new Set(myProjects.map((p) => p.id));
    projectCount = myProjects.length;
    profile = [
      { label: "Sector", value: sub.sector || "—" },
      { label: "Region", value: sub.region || "—" },
      { label: "City", value: sub.city || "—" },
      { label: "Manager", value: sub.managerName || "—" },
      { label: "Admin", value: sub.adminName || "—" },
      { label: "Business units", value: String(myUnits.length) },
      { label: "Description", value: sub.description || "—" },
    ];
    breadcrumb = [{ id: sub.id, type: "subsidiary", name: sub.name }];
    childNodes = myUnits.map((u) => ({
      id: u.id,
      type: "unit" as const,
      code: u.code,
      name: u.name,
      status: u.status,
      submissions: submissions.filter((x) => x.businessUnitId === u.id).length,
      meta: `${projects.filter((p) => p.businessUnitId === u.id).length} projects · ${u.managerName || "No manager"}`,
    }));
    inScope = (x) => x.subsidiaryId === sub.id;
    userInScope = (u) =>
      u.subsidiaryId === sub.id ||
      (u.businessUnitId ? myUnitIds.has(u.businessUnitId) : false) ||
      (u.projectId ? myProjectIds.has(u.projectId) : false);
  } else if (unit) {
    type = "unit";
    code = unit.code;
    name = unit.name;
    status = unit.status;
    meta = `Business Unit of ${unit.subsidiary.name}`;
    manager = unit.managerName;
    const myProjects = projects.filter((p) => p.businessUnitId === unit.id);
    const myProjectIds = new Set(myProjects.map((p) => p.id));
    projectCount = myProjects.length;
    profile = [
      { label: "Subsidiary", value: unit.subsidiary.name },
      { label: "Manager", value: unit.managerName || "—" },
      { label: "Admin", value: unit.adminName || "—" },
      { label: "Projects", value: String(myProjects.length) },
    ];
    breadcrumb = [
      { id: unit.subsidiaryId, type: "subsidiary" as const, name: unit.subsidiary.name },
      { id: unit.id, type: "unit" as const, name: unit.name },
    ];
    childNodes = myProjects.map((p) => ({
      id: p.id,
      type: "project" as const,
      code: p.code,
      name: p.name,
      status: p.status,
      submissions: submissions.filter((x) => x.projectId === p.id).length,
      meta: `${p.ptype.replaceAll("_", " ")}${p.capacityMw ? ` · ${p.capacityMw} MW` : ""} · ${p.location || "Unlocated"}`,
    }));
    inScope = (x) => x.businessUnitId === unit.id;
    userInScope = (u) =>
      u.businessUnitId === unit.id || (u.projectId ? myProjectIds.has(u.projectId) : false);
  } else {
    const p = project!;
    type = "project";
    code = p.code;
    name = p.name;
    status = p.status;
    meta = `${p.ptype.replaceAll("_", " ")} · ${p.location}${p.capacityMw ? ` · ${p.capacityMw} MW` : ""}`;
    manager = p.businessUnit.managerName;
    projectCount = 0;
    profile = [
      { label: "Business unit", value: p.businessUnit.name },
      { label: "Subsidiary", value: p.businessUnit.subsidiary.name },
      { label: "Location", value: p.location || "—" },
      { label: "Type", value: p.ptype.replaceAll("_", " ") },
      { label: "Capacity", value: p.capacityMw ? `${p.capacityMw} MW` : "—" },
      { label: "Frequency", value: p.frequency },
    ];
    breadcrumb = [
      { id: p.businessUnit.subsidiaryId, type: "subsidiary" as const, name: p.businessUnit.subsidiary.name },
      { id: p.businessUnitId, type: "unit" as const, name: p.businessUnit.name },
      { id: p.id, type: "project" as const, name: p.name },
    ];
    childNodes = [];
    inScope = (x) => x.projectId === p.id;
    userInScope = (u) => u.projectId === p.id;
  }

  const scoped = submissions.filter(inScope);
  const breakdown = SUBMISSION_STATUSES.map((st) => ({ status: st as string, count: scoped.filter((x) => x.status === st).length })).filter((x) => x.count > 0);
  const approved = scoped.filter((x) => x.status === "APPROVED").length;
  const pendingReview = scoped.filter((x) => ["SUBMITTED", "UNDER_REVIEW"].includes(x.status)).length;
  const overdue = scoped.filter((x) => x.overdue).length;
  const teamUsers = users.filter(userInScope);

  const teamNames = new Set(teamUsers.map((u) => u.name.toLowerCase()));
  const nodeActivities = activityEvents
    .filter((a) => {
      const aActor = a.actorName.toLowerCase();
      const aOrg = a.orgLabel.toLowerCase();
      const aTarget = a.targetLabel.toLowerCase();
      const nName = name.toLowerCase();
      return (
        teamNames.has(aActor) ||
        aOrg.includes(nName) ||
        aTarget.includes(nName)
      );
    })
    .slice(0, 10);

  return {
    id,
    type,
    code,
    name,
    status,
    meta,
    manager,
    profile,
    stats: { users: teamUsers.length, projects: projectCount, submissions: scoped.length, approved, pendingReview, overdue },
    statusBreakdown: breakdown,
    recentSubmissions: scoped.slice(0, 6).map((s) => ({
      id: s.id,
      ref: s.ref,
      title: s.title,
      category: s.category,
      status: s.status,
      overdue: s.overdue,
      metricName: s.metricName,
      metricValue: s.metricValue,
      metricUnit: s.metricUnit,
      submittedByName: users.find((u) => u.id === s.submittedById)?.name ?? null,
      dueDate: s.dueDate.toISOString(),
    })),
    team: teamUsers.slice(0, 20).map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      title: u.title,
      lastActiveAt: u.lastActiveAt ? u.lastActiveAt.toISOString() : null,
      presence: presenceOf(u),
    })),
    recentActivity: nodeActivities.map((a) => ({
      id: a.id,
      actorName: a.actorName,
      actorRole: a.actorRole,
      action: a.action,
      targetType: a.targetType,
      targetLabel: a.targetLabel,
      orgLabel: a.orgLabel,
      severity: a.severity,
      createdAt: a.createdAt.toISOString(),
    })),
    children: childNodes,
    breadcrumb,
  };
}
