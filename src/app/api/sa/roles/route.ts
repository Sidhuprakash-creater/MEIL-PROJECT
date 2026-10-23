import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { saHandle, requireSubsidiaryAdmin } from "@/lib/sa/server";
import type { AuditRow, RolesData } from "@/lib/sa/types";

export const dynamic = "force-dynamic";

/* Capability matrix — what each role may do, enforced per /api/esg & /api/sa guards. */
const MATRIX: { capability: string; label: string; grants: Record<string, "full" | "own" | "none"> }[] = [
  { capability: "org.manage", label: "Manage organization records", grants: { GROUP_ADMIN: "full", ORG_MANAGER: "full", SUBSIDIARY_ADMIN: "own", SUBSIDIARY_MANAGER: "none", BU_MANAGER: "none", BU_ADMIN: "none" } },
  { capability: "report.approve", label: "Approve / reject reports", grants: { GROUP_ADMIN: "full", ORG_MANAGER: "none", SUBSIDIARY_ADMIN: "none", SUBSIDIARY_MANAGER: "own", BU_MANAGER: "none", BU_ADMIN: "none" } },
  { capability: "report.submit", label: "Submit reporting data", grants: { GROUP_ADMIN: "full", ORG_MANAGER: "none", SUBSIDIARY_ADMIN: "own", SUBSIDIARY_MANAGER: "none", BU_MANAGER: "own", BU_ADMIN: "own" } },
  { capability: "timeline.manage", label: "Set reporting timelines", grants: { GROUP_ADMIN: "full", ORG_MANAGER: "none", SUBSIDIARY_ADMIN: "own", SUBSIDIARY_MANAGER: "none", BU_MANAGER: "none", BU_ADMIN: "none" } },
  { capability: "package.submit", label: "Submit package to Group", grants: { GROUP_ADMIN: "none", ORG_MANAGER: "none", SUBSIDIARY_ADMIN: "own", SUBSIDIARY_MANAGER: "none", BU_MANAGER: "none", BU_ADMIN: "none" } },
  { capability: "users.manage", label: "Manage users & roles", grants: { GROUP_ADMIN: "full", ORG_MANAGER: "none", SUBSIDIARY_ADMIN: "own", SUBSIDIARY_MANAGER: "none", BU_MANAGER: "none", BU_ADMIN: "none" } },
  { capability: "evidence.inspect", label: "Inspect evidence", grants: { GROUP_ADMIN: "full", ORG_MANAGER: "full", SUBSIDIARY_ADMIN: "own", SUBSIDIARY_MANAGER: "own", BU_MANAGER: "own", BU_ADMIN: "own" } },
  { capability: "audit.view", label: "View audit trail", grants: { GROUP_ADMIN: "full", ORG_MANAGER: "full", SUBSIDIARY_ADMIN: "own", SUBSIDIARY_MANAGER: "none", BU_MANAGER: "none", BU_ADMIN: "none" } },
];

const ROLE_INFO: { role: string; label: string; description: string; permissions: string[] }[] = [
  { role: "GROUP_ADMIN", label: "Group Admin", description: "Owns group governance, consolidation, final BRSR disclosure mapping and sign-offs. Cannot be created or granted from a subsidiary workspace.", permissions: ["Group consolidated ESG reporting", "Subsidiary submission approval", "Organization-wide dashboards", "Governance & policy management", "Audit trail oversight"] },
  { role: "ORG_MANAGER", label: "Organization Manager", description: "Group-level analytics and BRSR preparation support.", permissions: ["Group consolidated ESG reporting", "Organization-wide dashboards", "Cross-subsidiary performance analytics", "BRSR disclosure preparation"] },
  { role: "SUBSIDIARY_ADMIN", label: "Subsidiary Admin", description: "Organizational administration, timeline management, monitoring and package preparation for the assigned subsidiary. No approval authority.", permissions: ["Business unit & project administration", "Reporting timeline management with inheritance", "Report monitoring & evidence inspection", "Subsidiary package preparation & submission to Group", "User administration within subsidiary scope"] },
  { role: "SUBSIDIARY_MANAGER", label: "Subsidiary Manager", description: "Reviews and approves/rejects BU and project reports with mandatory rejection reasons. Cannot create BUs or projects.", permissions: ["Report review & approval decisions", "Rejection with mandatory reason", "Evidence inspection", "Review queue monitoring"] },
  { role: "BU_MANAGER", label: "BU Manager", description: "Business-unit reporting and project tracking.", permissions: ["Business unit ESG reporting", "Project performance tracking", "Data quality review"] },
  { role: "BU_ADMIN", label: "BU Admin", description: "Business-unit data operations.", permissions: ["Business unit ESG data entry", "Project data consolidation", "Evidence upload & attestation"] },
  { role: "ENV_DATA_USER", label: "Environment Data User", description: "Environmental data entry (energy, emissions, water, waste).", permissions: ["Environmental data entry", "Evidence attachment"] },
  { role: "FIN_RESOURCE_USER", label: "Finance & Resource Contributor", description: "Financial & resource consumption data.", permissions: ["Resource consumption data entry", "Cost & spend reporting"] },
  { role: "HR_USER", label: "HR User", description: "Workforce and social metrics.", permissions: ["Workforce data entry", "Diversity & training reporting"] },
  { role: "EHS_USER", label: "EHS / Safety User", description: "Environment, health & safety incidents.", permissions: ["Safety incident reporting", "EHS compliance data"] },
  { role: "PROCUREMENT_USER", label: "Procurement User", description: "Procurement and supplier ESG data.", permissions: ["Procurement data entry", "Supplier ESG scoring"] },
  { role: "CSR_USER", label: "CSR / Community User", description: "CSR & community program data.", permissions: ["CSR program reporting", "Community investment data"] },
  { role: "COMPLIANCE_USER", label: "Compliance User", description: "Legal & regulatory compliance records.", permissions: ["Compliance data entry", "Regulatory attestation"] },
];

export async function GET() {
  return saHandle(async () => {
    const ctx = await requireSubsidiaryAdmin();

    const [users, sub0] = await Promise.all([
      db.user.findMany({ where: { subsidiaryId: ctx.subsidiaryId }, select: { id: true, name: true, role: true, status: true, businessUnitId: true, projectId: true } }),
      db.subsidiary.findUnique({ where: { id: ctx.subsidiaryId }, select: { code: true } }),
    ]);
    const roleAudits = await db.auditEvent.findMany({ where: { orgScope: sub0?.code ?? "SUB", action: { contains: "ROLE" } }, orderBy: { createdAt: "desc" }, take: 12 });

    const counts = new Map<string, number>();
    for (const u of users) counts.set(u.role, (counts.get(u.role) ?? 0) + 1);

    const roles = ROLE_INFO.map((r) => ({
      ...r,
      assignable: ["SUBSIDIARY_MANAGER", "BU_MANAGER", "BU_ADMIN", "ENV_DATA_USER", "FIN_RESOURCE_USER", "HR_USER", "EHS_USER", "PROCUREMENT_USER", "CSR_USER", "COMPLIANCE_USER"].includes(r.role),
      userCount: counts.get(r.role) ?? 0,
    }));

    const gaps = users
      .filter((u) => u.status === "ACTIVE" && ["BU_MANAGER", "BU_ADMIN"].includes(u.role) && !u.businessUnitId)
      .map((u) => ({ userId: u.id, name: u.name, role: u.role, missing: "No business unit assigned" }));

    const changeHistory: AuditRow[] = roleAudits.map((a) => ({
      id: a.id, actorName: a.actorName, actorRole: a.actorRole, action: a.action,
      targetType: a.targetType, targetLabel: a.targetLabel, orgScope: a.orgScope,
      reason: a.reason, outcome: a.outcome, correlation: a.correlation, createdAt: a.createdAt.toISOString(),
    }));

    const data: RolesData = { roles, matrix: MATRIX, assignmentGaps: gaps, changeHistory };
    return ok(data);
  });
}
