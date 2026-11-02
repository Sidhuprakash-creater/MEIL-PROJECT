import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handle, ok, fail, body, parseJson, logActivity, logAudit, ACTOR } from "@/lib/esg/server";
import type { Subsidiary, BusinessUnit, Project } from "@/lib/esg/types";

type OrgType = "subsidiaries" | "business-units" | "projects";

function badType(type: string | null): type is OrgType {
  return type === "subsidiaries" || type === "business-units" || type === "projects";
}

async function decorateSubsidiaries(): Promise<Subsidiary[]> {
  const [subs, units, projects, users, submissions] = await Promise.all([
    db.subsidiary.findMany({ orderBy: { name: "asc" } }),
    db.businessUnit.findMany({ select: { id: true, subsidiaryId: true } }),
    db.project.findMany({ select: { id: true, businessUnitId: true, businessUnit: { select: { subsidiaryId: true } } } }),
    db.user.findMany({ select: { id: true, subsidiaryId: true } }),
    db.submission.findMany({ select: { subsidiaryId: true, status: true, overdue: true } }),
  ]);
  return subs.map((s) => {
    const sSubs = submissions.filter((x) => x.subsidiaryId === s.id);
    return {
      ...s,
      unitCount: units.filter((u) => u.subsidiaryId === s.id).length,
      projectCount: projects.filter((p) => p.businessUnit.subsidiaryId === s.id).length,
      userCount: users.filter((u) => u.subsidiaryId === s.id).length,
      submissionStats: {
        total: sSubs.length,
        approved: sSubs.filter((x) => x.status === "APPROVED").length,
        pending: sSubs.filter((x) => ["SUBMITTED", "UNDER_REVIEW"].includes(x.status)).length,
        overdue: sSubs.filter((x) => x.overdue).length,
      },
    };
  });
}

async function decorateUnits(): Promise<BusinessUnit[]> {
  const [units, subs, projects, users, submissions] = await Promise.all([
    db.businessUnit.findMany({ orderBy: { name: "asc" } }),
    db.subsidiary.findMany({ select: { id: true, name: true } }),
    db.project.findMany({ select: { id: true, businessUnitId: true } }),
    db.user.findMany({ select: { id: true, businessUnitId: true } }),
    db.submission.findMany({ select: { businessUnitId: true, status: true, overdue: true } }),
  ]);
  const subMap = new Map(subs.map((s) => [s.id, s.name]));
  return units.map((u) => {
    const sSubs = submissions.filter((x) => x.businessUnitId === u.id);
    return {
      ...u,
      subsidiaryName: subMap.get(u.subsidiaryId),
      projectCount: projects.filter((p) => p.businessUnitId === u.id).length,
      userCount: users.filter((x) => x.businessUnitId === u.id).length,
      submissionStats: {
        total: sSubs.length,
        approved: sSubs.filter((x) => x.status === "APPROVED").length,
        pending: sSubs.filter((x) => ["SUBMITTED", "UNDER_REVIEW"].includes(x.status)).length,
        overdue: sSubs.filter((x) => x.overdue).length,
      },
    };
  });
}

const DEFAULT_PROJECT_MANAGERS: Record<string, { name: string; title: string; email: string; phone: string }> = {
  "PRJ-PVAN": { name: "Er. K. Venkataramana", title: "Chief Project Director — Solar", email: "venkat.k@meilgroup.com", phone: "+91 98490 12845" },
  "PRJ-KTPP": { name: "Er. P. Ramesh", title: "General Manager — Thermal Operations", email: "ramesh.p@meilgroup.com", phone: "+91 98490 23901" },
  "PRJ-STPP": { name: "Er. S. Prabhakar", title: "Project Director — Power Generation", email: "prabhakar.s@meilgroup.com", phone: "+91 98490 34812" },
  "PRJ-WIND": { name: "Er. M. Anjaneyulu", title: "Site General Manager — Wind Cluster", email: "anjaneyulu.m@meilgroup.com", phone: "+91 98490 45723" },
  "PRJ-NH48": { name: "Er. B. Madhusudhan", title: "Chief Project Manager — Highways", email: "madhu.b@meilgroup.com", phone: "+91 98490 56834" },
  "PRJ-RING": { name: "Er. V. Srinivas Rao", title: "Project Director — Expressway", email: "srinivas.v@meilgroup.com", phone: "+91 98490 67945" },
  "PRJ-KLBD": { name: "Er. T. Raghunath", title: "Executive Director — Lift Irrigation", email: "raghunath.t@meilgroup.com", phone: "+91 98490 78056" },
  "PRJ-TUNL": { name: "Er. C. Hariprasad", title: "Chief Tunneling Engineer & PM", email: "hariprasad.c@meilgroup.com", phone: "+91 98490 89167" },
  "PRJ-METRO": { name: "Er. D. Rajasekhar", title: "Project Director — Rail & Transit", email: "rajasekhar.d@meilgroup.com", phone: "+91 98490 90278" },
  "PRJ-DESAL": { name: "Er. G. Ravinder", title: "Chief Operations Manager — Desalination", email: "ravinder.g@meilgroup.com", phone: "+91 98491 01389" },
  "PRJ-WTR1": { name: "Er. K. Suresh Kumar", title: "Superintending Project Manager", email: "suresh.k@meilgroup.com", phone: "+91 98491 12490" },
  "PRJ-WTR2": { name: "Er. M. Venkatesham", title: "Senior Project Manager — Water Grid", email: "venkatesham.m@meilgroup.com", phone: "+91 98491 23501" },
  "PRJ-PH2": { name: "Er. Wei Zhang", title: "Country Project Director — APAC", email: "wei.zhang@meilglobal.com", phone: "+65 6789 0123" },
  "PRJ-ZAMB": { name: "Er. Daniel Foo", title: "Managing Director — Hydro Projects", email: "daniel.foo@meilglobal.com", phone: "+260 971 234567" },
  "PRJ-CORP": { name: "Suresh Babu", title: "Corporate Facilities & Site Director", email: "suresh.babu@meil.in", phone: "+91 40 2345 6789" },
  "PRJ-SG": { name: "Mei Ling Tan", title: "Regional ESG Operations Director", email: "meiling.tan@meilglobal.com", phone: "+65 6123 4567" },
};

async function getProjectManagerOverrides(): Promise<Record<string, { name: string; title?: string; email?: string; phone?: string }>> {
  try {
    const s = await db.appSetting.findUnique({ where: { skey: "project_managers" } });
    if (s?.value) return JSON.parse(s.value);
  } catch {
    /* fallback to defaults */
  }
  return {};
}

async function saveProjectManagerOverride(projectId: string, projectCode: string, manager: { name: string; title?: string; email?: string; phone?: string }) {
  try {
    const cur = await getProjectManagerOverrides();
    cur[projectId] = { ...cur[projectId], ...manager };
    if (projectCode) cur[projectCode] = { ...cur[projectCode], ...manager };
    await db.appSetting.upsert({
      where: { skey: "project_managers" },
      update: { value: JSON.stringify(cur) },
      create: { skey: "project_managers", value: JSON.stringify(cur), category: "GENERAL", label: "Project Manager Overrides", vtype: "JSON" },
    });
  } catch {
    /* non-blocking */
  }
}

async function decorateProjects(): Promise<Project[]> {
  const [projects, units, subs, users, submissions, mgrOverrides] = await Promise.all([
    db.project.findMany({ orderBy: { name: "asc" } }),
    db.businessUnit.findMany({ select: { id: true, name: true, subsidiaryId: true } }),
    db.subsidiary.findMany({ select: { id: true, name: true } }),
    db.user.findMany({ select: { id: true, name: true, email: true, phone: true, title: true, role: true, projectId: true } }),
    db.submission.findMany({ select: { projectId: true, status: true, overdue: true } }),
    getProjectManagerOverrides(),
  ]);
  const unitMap = new Map(units.map((u) => [u.id, u]));
  const subMap = new Map(subs.map((s) => [s.id, s.name]));
  return projects.map((p) => {
    const unit = unitMap.get(p.businessUnitId);
    const sSubs = submissions.filter((x) => x.projectId === p.id);
    const pUsers = users.filter((x) => x.projectId === p.id);

    const override = mgrOverrides[p.id] || mgrOverrides[p.code];
    const def = DEFAULT_PROJECT_MANAGERS[p.code];
    const assignedUser = pUsers.find((u) =>
      u.title?.toLowerCase().includes("manager") ||
      u.title?.toLowerCase().includes("director") ||
      u.title?.toLowerCase().includes("head") ||
      u.title?.toLowerCase().includes("lead")
    ) || pUsers[0];

    const managerName = override?.name || def?.name || assignedUser?.name || "Er. K. Venkataramana";
    const managerTitle = override?.title || def?.title || assignedUser?.title || "Project Director & Site In-Charge";
    const managerEmail = override?.email || def?.email || assignedUser?.email || `${p.code.toLowerCase().replace(/[^a-z0-9]/g, "")}.pm@meil.in`;
    const managerPhone = override?.phone || def?.phone || assignedUser?.phone || "+91 98490 12845";

    return {
      ...p,
      businessUnitName: unit?.name,
      subsidiaryId: unit?.subsidiaryId,
      subsidiaryName: unit ? subMap.get(unit.subsidiaryId) : undefined,
      userCount: pUsers.length,
      managerName,
      managerTitle,
      managerEmail,
      managerPhone,
      submissionStats: {
        total: sSubs.length,
        approved: sSubs.filter((x) => x.status === "APPROVED").length,
        pending: sSubs.filter((x) => ["SUBMITTED", "UNDER_REVIEW"].includes(x.status)).length,
        overdue: sSubs.filter((x) => x.overdue).length,
      },
    };
  });
}

export async function GET(req: NextRequest) {
  return handle(async () => {
    const type = req.nextUrl.searchParams.get("type");
    if (!badType(type)) return fail("Unknown organization type. Use type=subsidiaries|business-units|projects.", 400);
    if (req.nextUrl.searchParams.get("light") === "1") {
      const subs = await db.subsidiary.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
      return ok({ subsidiaries: subs });
    }
    if (type === "subsidiaries") return ok({ subsidiaries: await decorateSubsidiaries() });
    if (type === "business-units") return ok({ businessUnits: await decorateUnits() });
    return ok({ projects: await decorateProjects() });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const b = await body<Record<string, string>>(req);
    const type = b.type;
    if (type === "subsidiary") {
      if (!b.name?.trim()) return fail("Subsidiary name is required.");
      const code = b.code?.trim() || `SUB-${Date.now().toString(36).toUpperCase().slice(-5)}`;
      const exists = await db.subsidiary.findUnique({ where: { code } });
      if (exists) return fail("A subsidiary with this code already exists.");
      const s = await db.subsidiary.create({
        data: {
          code, name: b.name.trim(), sector: b.sector || "Energy", region: b.region || "India",
          city: b.city || "", managerName: b.managerName || "", adminName: b.adminName || "",
          description: b.description || "", status: b.status || "ACTIVE",
        },
      });
      await Promise.all([
        logActivity({ actorName: ACTOR.name, action: "CONFIG_CHANGE", targetType: "Subsidiary", targetLabel: s.name, orgLabel: s.name }),
        logAudit({ actorName: ACTOR.name, action: "ORG_CREATE", targetType: "Subsidiary", targetId: s.id, targetLabel: s.name, after: { code, name: s.name } }),
      ]);
      return ok({ subsidiary: s }, { status: 201 });
    }
    if (type === "business-unit") {
      if (!b.name?.trim()) return fail("Business unit name is required.");
      if (!b.subsidiaryId) return fail("Parent subsidiary is required.");
      const parent = await db.subsidiary.findUnique({ where: { id: b.subsidiaryId } });
      if (!parent) return fail("Parent subsidiary not found.");
      const code = b.code?.trim() || `BU-${Date.now().toString(36).toUpperCase().slice(-5)}`;
      const exists = await db.businessUnit.findUnique({ where: { code } });
      if (exists) return fail("A business unit with this code already exists.");
      const u = await db.businessUnit.create({
        data: { code, name: b.name.trim(), subsidiaryId: b.subsidiaryId, managerName: b.managerName || "", adminName: b.adminName || "", status: b.status || "ACTIVE" },
      });
      await Promise.all([
        logActivity({ actorName: ACTOR.name, action: "CONFIG_CHANGE", targetType: "Business Unit", targetLabel: u.name, orgLabel: parent.name }),
        logAudit({ actorName: ACTOR.name, action: "ORG_CREATE", targetType: "BusinessUnit", targetId: u.id, targetLabel: u.name, after: { code, parent: parent.name } }),
      ]);
      return ok({ businessUnit: u }, { status: 201 });
    }
    if (type === "project") {
      if (!b.name?.trim()) return fail("Project name is required.");
      if (!b.businessUnitId) return fail("Parent business unit is required.");
      const parent = await db.businessUnit.findUnique({ where: { id: b.businessUnitId } });
      if (!parent) return fail("Parent business unit not found.");
      const code = b.code?.trim() || `PRJ-${Date.now().toString(36).toUpperCase().slice(-5)}`;
      const exists = await db.project.findUnique({ where: { code } });
      if (exists) return fail("A project with this code already exists.");
      const p = await db.project.create({
        data: {
          code, name: b.name.trim(), businessUnitId: b.businessUnitId, location: b.location || "",
          ptype: b.ptype || "SITE", capacityMw: parseFloat(b.capacityMw || "0") || 0,
          frequency: b.frequency || "MONTHLY", status: b.status || "ACTIVE",
        },
      });
      if (b.managerName) {
        await saveProjectManagerOverride(p.id, p.code, {
          name: b.managerName.trim(),
          title: b.managerTitle?.trim() || "Project Director & Site In-Charge",
          email: b.managerEmail?.trim() || `${p.code.toLowerCase().replace(/[^a-z0-9]/g, "")}.pm@meil.in`,
          phone: b.managerPhone?.trim() || "+91 98490 12845",
        });
      }
      await Promise.all([
        logActivity({ actorName: ACTOR.name, action: "CONFIG_CHANGE", targetType: "Project", targetLabel: p.name, orgLabel: parent.name }),
        logAudit({ actorName: ACTOR.name, action: "ORG_CREATE", targetType: "Project", targetId: p.id, targetLabel: p.name, after: { code, parent: parent.name } }),
      ]);
      return ok({ project: p }, { status: 201 });
    }
    return fail("Unknown create type.");
  });
}

export async function PATCH(req: NextRequest) {
  return handle(async () => {
    const b = await body<Record<string, string>>(req);
    if (!b.id) return fail("id is required.");
    const type = b.type;
    if (type === "subsidiary") {
      const before = await db.subsidiary.findUnique({ where: { id: b.id } });
      if (!before) return fail("Subsidiary not found.", 404);
      const s = await db.subsidiary.update({
        where: { id: b.id },
        data: {
          name: b.name?.trim() || before.name,
          sector: b.sector ?? before.sector,
          region: b.region ?? before.region,
          city: b.city ?? before.city,
          managerName: b.managerName ?? before.managerName,
          adminName: b.adminName ?? before.adminName,
          description: b.description ?? before.description,
          status: b.status ?? before.status,
        },
      });
      // Cascade deactivation of children is validated, not silent:
      let warning: string | null = null;
      if (b.status === "INACTIVE" && before.status === "ACTIVE") {
        const activeUnits = await db.businessUnit.count({ where: { subsidiaryId: s.id, status: "ACTIVE" } });
        if (activeUnits > 0) warning = `${activeUnits} active business unit(s) still report under this subsidiary.`;
      }
      await Promise.all([
        logActivity({ actorName: ACTOR.name, action: "CONFIG_CHANGE", targetType: "Subsidiary", targetLabel: s.name }),
        logAudit({ actorName: ACTOR.name, action: "ORG_UPDATE", targetType: "Subsidiary", targetId: s.id, targetLabel: s.name, before: { status: before.status, name: before.name }, after: { status: s.status, name: s.name } }),
      ]);
      return ok({ subsidiary: s, warning });
    }
    if (type === "business-unit") {
      const before = await db.businessUnit.findUnique({ where: { id: b.id } });
      if (!before) return fail("Business unit not found.", 404);
      if (b.subsidiaryId && b.subsidiaryId !== before.subsidiaryId) {
        const parent = await db.subsidiary.findUnique({ where: { id: b.subsidiaryId } });
        if (!parent) return fail("New parent subsidiary not found.");
      }
      const u = await db.businessUnit.update({
        where: { id: b.id },
        data: {
          name: b.name?.trim() || before.name,
          subsidiaryId: b.subsidiaryId ?? before.subsidiaryId,
          managerName: b.managerName ?? before.managerName,
          adminName: b.adminName ?? before.adminName,
          status: b.status ?? before.status,
        },
      });
      await Promise.all([
        logActivity({ actorName: ACTOR.name, action: "CONFIG_CHANGE", targetType: "Business Unit", targetLabel: u.name }),
        logAudit({ actorName: ACTOR.name, action: "ORG_UPDATE", targetType: "BusinessUnit", targetId: u.id, targetLabel: u.name, before: { parent: before.subsidiaryId, status: before.status }, after: { parent: u.subsidiaryId, status: u.status } }),
      ]);
      return ok({ businessUnit: u });
    }
    if (type === "project") {
      const before = await db.project.findUnique({ where: { id: b.id } });
      if (!before) return fail("Project not found.", 404);
      if (b.businessUnitId && b.businessUnitId !== before.businessUnitId) {
        const parent = await db.businessUnit.findUnique({ where: { id: b.businessUnitId } });
        if (!parent) return fail("New parent business unit not found.");
      }
      const p = await db.project.update({
        where: { id: b.id },
        data: {
          name: b.name?.trim() || before.name,
          businessUnitId: b.businessUnitId ?? before.businessUnitId,
          location: b.location ?? before.location,
          ptype: b.ptype ?? before.ptype,
          capacityMw: b.capacityMw !== undefined ? parseFloat(b.capacityMw) || 0 : before.capacityMw,
          frequency: b.frequency ?? before.frequency,
          status: b.status ?? before.status,
        },
      });
      if (b.managerName !== undefined) {
        await saveProjectManagerOverride(p.id, p.code, {
          name: b.managerName.trim(),
          title: b.managerTitle?.trim(),
          email: b.managerEmail?.trim(),
          phone: b.managerPhone?.trim(),
        });
      }
      await Promise.all([
        logActivity({ actorName: ACTOR.name, action: "CONFIG_CHANGE", targetType: "Project", targetLabel: p.name }),
        logAudit({ actorName: ACTOR.name, action: "ORG_UPDATE", targetType: "Project", targetId: p.id, targetLabel: p.name, before: { parent: before.businessUnitId, status: before.status }, after: { parent: p.businessUnitId, status: p.status } }),
      ]);
      return ok({ project: p });
    }
    return fail("Unknown update type.");
  });
}

export async function DELETE(req: NextRequest) {
  return handle(async () => {
    const b = await body<Record<string, string>>(req);
    if (!b.id || !b.type) return fail("id and type are required.");
    if (b.type === "subsidiary") {
      const s = await db.subsidiary.findUnique({ where: { id: b.id }, include: { units: true } });
      if (!s) return fail("Subsidiary not found.", 404);
      if (s.units.length > 0) return fail("Cannot deactivate: this subsidiary still has business units reporting under it. Reassign them first.");
      await db.subsidiary.update({ where: { id: s.id }, data: { status: "INACTIVE" } });
      await Promise.all([
        logActivity({ actorName: ACTOR.name, action: "CONFIG_CHANGE", targetType: "Subsidiary", targetLabel: `${s.name} deactivated`, severity: "WARNING" }),
        logAudit({ actorName: ACTOR.name, action: "ORG_DEACTIVATE", targetType: "Subsidiary", targetId: s.id, targetLabel: s.name, before: { status: s.status }, after: { status: "INACTIVE" }, reason: b.reason }),
      ]);
      return ok({ success: true });
    }
    if (b.type === "business-unit") {
      const u = await db.businessUnit.findUnique({ where: { id: b.id }, include: { projects: true } });
      if (!u) return fail("Business unit not found.", 404);
      if (u.projects.length > 0) return fail("Cannot deactivate: projects are still linked to this business unit.");
      await db.businessUnit.update({ where: { id: u.id }, data: { status: "INACTIVE" } });
      await logAudit({ actorName: ACTOR.name, action: "ORG_DEACTIVATE", targetType: "BusinessUnit", targetId: u.id, targetLabel: u.name, before: { status: u.status }, after: { status: "INACTIVE" }, reason: b.reason });
      return ok({ success: true });
    }
    if (b.type === "project") {
      const p = await db.project.findUnique({ where: { id: b.id } });
      if (!p) return fail("Project not found.", 404);
      await db.project.update({ where: { id: p.id }, data: { status: "INACTIVE" } });
      await logAudit({ actorName: ACTOR.name, action: "ORG_DEACTIVATE", targetType: "Project", targetId: p.id, targetLabel: p.name, before: { status: p.status }, after: { status: "INACTIVE" }, reason: b.reason });
      return ok({ success: true });
    }
    return fail("Unknown delete type.");
  });
}
