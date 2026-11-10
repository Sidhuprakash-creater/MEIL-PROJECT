import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handle, ok, fail, body, parseJson, logAudit, ACTOR } from "@/lib/esg/server";
import { ROLE_LABELS } from "@/lib/esg/types";
import type { RolesData } from "@/lib/esg/types";

const PERMISSIONS = [
  "View", "Create", "Edit", "Submit", "Review", "Approve", "Reject", "Reopen",
  "Export", "Assign tasks", "Manage users", "Manage organizations", "Configure workflows", "View audit history", "Manage global settings",
];

const ROLE_GROUPS: Record<string, string[]> = {
  "Administrators": ["GROUP_ADMIN"],
  "Subsidiary roles": ["SUBSIDIARY_MANAGER", "SUBSIDIARY_ADMIN"],
  "Business unit roles": ["BU_MANAGER", "BU_ADMIN"],
  "Data entry roles": Object.keys(ROLE_LABELS).filter((r) => !["GROUP_ADMIN", "SUBSIDIARY_MANAGER", "SUBSIDIARY_ADMIN", "BU_MANAGER", "BU_ADMIN"].includes(r)),
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  GROUP_ADMIN: "Highest organizational-level administrator. Full authorized scope across the group.",
  SUBSIDIARY_MANAGER: "Leads a subsidiary; reviews and coordinates reporting across its BUs.",
  SUBSIDIARY_ADMIN: "Administers subsidiary-level users, submissions, and first-line reviews.",
  BU_MANAGER: "Manages a business unit; oversees project-level data collection.",
  BU_ADMIN: "Administers BU users and monitors submission completion.",
  ENV_DATA_USER: "Enters environmental data (emissions, water, waste, biodiversity).",
  FIN_RESOURCE_USER: "Contributes finance & resource metrics (fuel, energy spend, materials).",
  HR_USER: "Enters workforce and HR metrics.",
  EHS_USER: "Enters EHS / safety metrics and incident records.",
  PROCUREMENT_USER: "Enters procurement and supply-chain metrics.",
  CSR_USER: "Enters CSR / community program metrics.",
  COMPLIANCE_USER: "Enters compliance and regulatory metrics.",
};

function defaultMatrix(role: string): Record<string, boolean> {
  const m: Record<string, boolean> = {};
  for (const p of PERMISSIONS) m[p] = false;
  const set = (...ps: string[]) => ps.forEach((p) => (m[p] = true));
  switch (role) {
    case "GROUP_ADMIN":
      set(...PERMISSIONS);
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

export async function GET() {
  return handle(async () => {
    const [users, settings] = await Promise.all([
      db.user.groupBy({ by: ["role"], _count: { role: true } }),
      db.appSetting.findUnique({ where: { skey: "permission_matrix" } }),
    ]);
    const countMap = new Map(users.map((u) => [u.role, u._count.role]));
    const roles: RolesData["roles"] = [];
    for (const [group, list] of Object.entries(ROLE_GROUPS)) {
      for (const r of list) {
        roles.push({
          id: r,
          label: ROLE_LABELS[r],
          group,
          userCount: countMap.get(r) ?? 0,
          description: ROLE_DESCRIPTIONS[r] ?? "",
        });
      }
    }
    const saved = settings ? parseJson<Record<string, Record<string, boolean>>>(settings.svalue, {}) : {};
    const matrix: Record<string, Record<string, boolean>> = {};
    for (const r of Object.keys(ROLE_LABELS)) {
      matrix[r] = { ...defaultMatrix(r), ...(saved[r] ?? {}) };
    }
    return ok({ roles, permissions: PERMISSIONS, matrix });
  });
}

export async function PUT(req: NextRequest) {
  return handle(async () => {
    const b = await body<{ matrix: Record<string, Record<string, boolean>> }>(req);
    if (!b.matrix || typeof b.matrix !== "object") return fail("Permission matrix payload required.");
    const existing = await db.appSetting.findUnique({ where: { skey: "permission_matrix" } });
    const before = existing?.svalue ?? "{}";
    if (existing) {
      await db.appSetting.update({ where: { skey: "permission_matrix" }, data: { svalue: JSON.stringify(b.matrix), updatedAt: new Date() } });
    } else {
      await db.appSetting.create({
        data: { skey: "permission_matrix", label: "Role permission matrix", category: "SECURITY", svalue: JSON.stringify(b.matrix), vtype: "json" },
      });
    }
    await Promise.all([
      logAudit({
        actorName: ACTOR.name,
        action: "PERMISSIONS_UPDATE",
        targetType: "AppSetting",
        targetLabel: "Role permission matrix",
        before: JSON.parse(before) as object,
        after: b.matrix,
      }),
    ]);
    return ok({ success: true, message: "Permission matrix saved. Changes are enforced server-side for new requests." });
  });
}
