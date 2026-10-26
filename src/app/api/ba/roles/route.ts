import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { baHandle, requireBuAdmin, ROLE_LABELS } from "@/lib/ba/server";
import type { BaRolesData } from "@/lib/ba/types";
import type { AuditRow } from "@/lib/ba/types";

export const dynamic = "force-dynamic";

/* Capability matrix — BU Admin authority is limited to operational coordination.
   Decisions (report.approve) stay with the BU Manager, never the BU Admin. */
const MATRIX: { capability: string; label: string; grants: Record<string, "full" | "own" | "none"> }[] = [
  { capability: "report.submit", label: "Submit reporting data", grants: { BU_MANAGER: "own", BU_ADMIN: "own", ENV_DATA_USER: "own", EHS_USER: "own", HR_USER: "own", FIN_RESOURCE_USER: "own", PROCUREMENT_USER: "own", CSR_USER: "own", COMPLIANCE_USER: "own" } },
  { capability: "report.approve", label: "Approve / reject reports", grants: { BU_MANAGER: "own", BU_ADMIN: "none", ENV_DATA_USER: "none", EHS_USER: "none", HR_USER: "none", FIN_RESOURCE_USER: "none", PROCUREMENT_USER: "none", CSR_USER: "none", COMPLIANCE_USER: "none" } },
  { capability: "report.monitor", label: "Monitor reports + evidence", grants: { BU_MANAGER: "own", BU_ADMIN: "own", ENV_DATA_USER: "none", EHS_USER: "none", HR_USER: "none", FIN_RESOURCE_USER: "none", PROCUREMENT_USER: "none", CSR_USER: "none", COMPLIANCE_USER: "none" } },
  { capability: "timeline.manage", label: "Set project deadlines within policy", grants: { BU_MANAGER: "none", BU_ADMIN: "own", ENV_DATA_USER: "none", EHS_USER: "none", HR_USER: "none", FIN_RESOURCE_USER: "none", PROCUREMENT_USER: "none", CSR_USER: "none", COMPLIANCE_USER: "none" } },
  { capability: "users.manage", label: "Manage BU users & roles", grants: { BU_MANAGER: "none", BU_ADMIN: "own", ENV_DATA_USER: "none", EHS_USER: "none", HR_USER: "none", FIN_RESOURCE_USER: "none", PROCUREMENT_USER: "none", CSR_USER: "none", COMPLIANCE_USER: "none" } },
  { capability: "package.submit", label: "Submit BU package to Subsidiary", grants: { BU_MANAGER: "none", BU_ADMIN: "own", ENV_DATA_USER: "none", EHS_USER: "none", HR_USER: "none", FIN_RESOURCE_USER: "none", PROCUREMENT_USER: "none", CSR_USER: "none", COMPLIANCE_USER: "none" } },
  { capability: "evidence.inspect", label: "Inspect / download evidence", grants: { BU_MANAGER: "own", BU_ADMIN: "own", ENV_DATA_USER: "own", EHS_USER: "own", HR_USER: "own", FIN_RESOURCE_USER: "own", PROCUREMENT_USER: "own", CSR_USER: "own", COMPLIANCE_USER: "own" } },
  { capability: "comms.send", label: "Send reminders / announcements", grants: { BU_MANAGER: "own", BU_ADMIN: "own", ENV_DATA_USER: "none", EHS_USER: "none", HR_USER: "none", FIN_RESOURCE_USER: "none", PROCUREMENT_USER: "none", CSR_USER: "none", COMPLIANCE_USER: "none" } },
  { capability: "validation.notify", label: "Notify responsible users", grants: { BU_MANAGER: "own", BU_ADMIN: "own", ENV_DATA_USER: "none", EHS_USER: "none", HR_USER: "none", FIN_RESOURCE_USER: "none", PROCUREMENT_USER: "none", CSR_USER: "none", COMPLIANCE_USER: "none" } },
];

const ROLE_INFO: { role: string; label: string; description: string; permissions: string[] }[] = [
  { role: "BU_MANAGER", label: "BU Manager", description: "Reviews and approves/rejects BU and project reports within the assigned BU. Cannot create projects or manage users.", permissions: ["BU & project report approval", "Mandatory rejection reasons", "Evidence inspection", "Review queue monitoring"] },
  { role: "BU_ADMIN", label: "BU Admin", description: "Operational command center for the assigned BU. Manages BU users, monitors projects (read-only), assigns project deadlines within policy, prepares BU reporting package.", permissions: ["BU user & role administration", "Project deadline assignment (within policy)", "Submission + evidence monitoring", "BU package preparation & submission to Subsidiary", "Reminder & announcement coordination"] },
  { role: "ENV_DATA_USER", label: "Environment Data User", description: "Environmental data entry (energy, emissions, water, waste).", permissions: ["Environmental data entry", "Evidence attachment"] },
  { role: "FIN_RESOURCE_USER", label: "Finance & Resource Contributor", description: "Financial & resource consumption data.", permissions: ["Resource consumption data entry", "Cost & spend reporting"] },
  { role: "HR_USER", label: "HR User", description: "Workforce and social metrics.", permissions: ["Workforce data entry", "Diversity & training reporting"] },
  { role: "EHS_USER", label: "EHS / Safety User", description: "Environment, health & safety incidents.", permissions: ["Safety incident reporting", "EHS compliance data"] },
  { role: "PROCUREMENT_USER", label: "Procurement User", description: "Procurement and supplier ESG data.", permissions: ["Procurement data entry", "Supplier ESG scoring"] },
  { role: "CSR_USER", label: "CSR / Community User", description: "CSR & community program data.", permissions: ["CSR program reporting", "Community investment data"] },
  { role: "COMPLIANCE_USER", label: "Compliance User", description: "Legal & regulatory compliance records.", permissions: ["Compliance data entry", "Regulatory attestation"] },
];

export async function GET() {
  return baHandle(async () => {
    const ctx = await requireBuAdmin();

    const [users, bu0] = await Promise.all([
      db.user.findMany({ where: { businessUnitId: ctx.businessUnitId }, select: { id: true, name: true, role: true, status: true, projectId: true } }),
      db.businessUnit.findUnique({ where: { id: ctx.businessUnitId }, select: { code: true } }),
    ]);
    const roleAudits = await db.auditEvent.findMany({ where: { orgScope: bu0?.code ?? "BU", action: { contains: "ROLE" } }, orderBy: { createdAt: "desc" }, take: 12 });

    const counts = new Map<string, number>();
    for (const u of users) counts.set(u.role, (counts.get(u.role) ?? 0) + 1);

    const roles = ROLE_INFO.map((r) => ({
      ...r,
      assignable: (["ENV_DATA_USER", "FIN_RESOURCE_USER", "HR_USER", "EHS_USER", "PROCUREMENT_USER", "CSR_USER", "COMPLIANCE_USER"] as readonly string[]).includes(r.role),
      userCount: counts.get(r.role) ?? 0,
    }));

    const gaps = users
      .filter((u) => u.status === "ACTIVE" && ["ENV_DATA_USER", "FIN_RESOURCE_USER", "HR_USER", "EHS_USER", "PROCUREMENT_USER", "CSR_USER", "COMPLIANCE_USER"].includes(u.role) && !u.projectId)
      .map((u) => ({ userId: u.id, name: u.name, role: u.role, missing: "No project assigned — BU Admin should attach to a project under this BU" }));

    const changeHistory: AuditRow[] = roleAudits.map((a) => ({
      id: a.id, actorName: a.actorName, actorRole: a.actorRole, action: a.action,
      targetType: a.targetType, targetLabel: a.targetLabel, orgScope: a.orgScope,
      reason: a.reason, outcome: a.outcome, correlation: a.correlation, createdAt: a.createdAt.toISOString(),
    }));

    const data: BaRolesData = { roles, matrix: MATRIX, assignmentGaps: gaps, changeHistory };
    return ok(data);
  });
}
