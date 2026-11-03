import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  getProjectAdminContext,
  paOk,
  paFail,
  getPaServerCache,
  setPaServerCache,
} from "@/lib/project-admin/server";
import { CONTRIBUTOR_CATEGORIES } from "@/lib/project-admin/store";
import type { ContributorRole } from "@/lib/project-admin/types";

export const dynamic = "force-dynamic";

const CATEGORY_SECTION_MAPPINGS: Record<ContributorRole, { code: string; title: string; desc: string; metrics: string[] }[]> = {
  ENV_DATA_USER: [
    { code: "ENV-01", title: "Energy & Electricity Consumption", desc: "Grid power, DG diesel, on-site solar, energy intensity", metrics: ["Electricity (kWh)", "Fuel (L)", "Renewable (%)"] },
    { code: "ENV-02", title: "Water Consumption & Sourcing", desc: "Groundwater, municipal tanker, rainwater harvesting", metrics: ["Withdrawal (kL)", "Recycled (kL)"] },
    { code: "ENV-03", title: "GHG & Air Emissions (Scope 1 & 2)", desc: "Stationary combustion, electricity emission factors", metrics: ["Scope 1 (tCO2e)", "Scope 2 (tCO2e)"] },
    { code: "ENV-04", title: "Waste Management & Recycling", desc: "Hazardous chemicals, e-waste, construction debris", metrics: ["Hazardous (MT)", "Recycled (%)"] },
    { code: "ENV-05", title: "Environmental Clearances & Initiatives", desc: "Tree plantation, dust suppression, soil conservation", metrics: ["Initiatives count"] },
  ],
  FIN_RESOURCE_USER: [
    { code: "FIN-01", title: "ESG Capital Expenditure (Capex)", desc: "Investment in pollution control equipment & clean tech", metrics: ["INR Lakhs"] },
    { code: "FIN-02", title: "Environmental Operational Spend (Opex)", desc: "ETP/STP maintenance, testing fees, tree plantation", metrics: ["INR Lakhs"] },
    { code: "FIN-03", title: "Resource Allocation & Budgeting", desc: "Allocated budget vs actual ESG expenditures", metrics: ["Budget variance (%)"] },
  ],
  HR_USER: [
    { code: "HR-01", title: "Workforce Demographics & Headcount", desc: "Permanent, contractual, migrant and on-site staff", metrics: ["Headcount (Nos)"] },
    { code: "HR-02", title: "Gender Diversity & Inclusion", desc: "Female representation, equal wage compliance", metrics: ["Female share (%)"] },
    { code: "HR-03", title: "Training, Upskilling & Welfare", desc: "Safety hours, vocational training, health checkups", metrics: ["Hours / person"] },
  ],
  EHS_USER: [
    { code: "EHS-01", title: "Workplace Health & Occupational Safety", desc: "Toolbox talks, PPE audits, emergency preparedness", metrics: ["Audits (Nos)"] },
    { code: "EHS-02", title: "Incident Logging & LTIFR", desc: "Near-misses, first-aid cases, lost time injury frequency", metrics: ["LTIFR score", "Fatalities"] },
    { code: "EHS-03", title: "Safety Certifications & Medical Records", desc: "Periodic health screenings, hygiene inspections", metrics: ["Compliance (%)"] },
  ],
  PROCUREMENT_USER: [
    { code: "PRO-01", title: "Supply Chain & Sourcing Practices", desc: "Tier-1 vendors, local sourcing radius, MSME vendors", metrics: ["Local spend (%)"] },
    { code: "PRO-02", title: "Supplier ESG Assessments", desc: "Environmental screenings, child labor prohibition audits", metrics: ["Audited vendors"] },
    { code: "PRO-03", title: "Green Material Purchases", desc: "Fly-ash PPC cement, recycled steel, eco-aggregates", metrics: ["Green spend (%)"] },
  ],
  CSR_USER: [
    { code: "CSR-01", title: "Community Development Initiatives", desc: "Local schools, drinking water plants, village roads", metrics: ["Projects active"] },
    { code: "CSR-02", title: "CSR Beneficiary Tracking", desc: "Villages impacted, families benefited, skill training", metrics: ["Beneficiaries (Nos)"] },
    { code: "CSR-03", title: "Social Impact Expenditure", desc: "Mandatory Schedule VII investments & outcome tracking", metrics: ["INR Lakhs"] },
  ],
  COMPLIANCE_USER: [
    { code: "CMP-01", title: "Statutory & Regulatory Clearances", desc: "Consent to Operate (CTO), CTE, Mining leases, Forest NOC", metrics: ["Active licenses"] },
    { code: "CMP-02", title: "Show-Cause Notices & Violations", desc: "PCB inspections, court directives, penalty status", metrics: ["Open notices (Nos)"] },
    { code: "CMP-03", title: "Governance Disclosures & Audit Evidence", desc: "Anti-bribery certifications, grievance mechanism logs", metrics: ["Audit score (%)"] },
  ],
};

export async function GET(req: NextRequest) {
  try {
    const ctx = await getProjectAdminContext();
    if (!ctx) return paFail("Project Admin context not resolved.", 401);

    const cacheKey = `categories:${ctx.projectId}`;
    const cached = getPaServerCache<any>(cacheKey);
    if (cached) {
      return paOk(cached);
    }

    const [users, submissions] = await Promise.all([
      db.user.findMany({
        where: {
          OR: [
            { projectId: ctx.projectId },
            { businessUnitId: ctx.businessUnitId },
          ],
        },
        select: {
          id: true,
          name: true,
          email: true,
          employeeId: true,
          role: true,
          status: true,
        },
      }),
      db.submission.findMany({
        where: {
          OR: [
            { projectId: ctx.projectId },
            { businessUnitId: ctx.businessUnitId },
          ],
        },
        select: {
          id: true,
          category: true,
          status: true,
          updatedAt: true,
        },
      }),
    ]);

    const categoriesList = (Object.keys(CONTRIBUTOR_CATEGORIES) as ContributorRole[]).map((catKey) => {
      const def = (CONTRIBUTOR_CATEGORIES as any)[catKey] || { name: catKey, label: catKey, color: "#3B82F6", desc: "" };
      const sections = CATEGORY_SECTION_MAPPINGS[catKey] || [];
      const assignedUsers = users.filter((u) => u.role === catKey);

      const catSubs = submissions.filter((s) => {
        const c = s.category.toUpperCase();
        if (catKey === "ENV_DATA_USER") return c.includes("ENERGY") || c.includes("WATER") || c.includes("WASTE") || c.includes("EMISSION") || c.includes("ENVIRONMENT");
        if (catKey === "FIN_RESOURCE_USER") return c.includes("FINANCE") || c.includes("RESOURCE");
        if (catKey === "HR_USER") return c.includes("HR") || c.includes("WORKFORCE");
        if (catKey === "EHS_USER") return c.includes("EHS") || c.includes("SAFETY");
        if (catKey === "PROCUREMENT_USER") return c.includes("PROCUREMENT") || c.includes("SUPPLY");
        if (catKey === "CSR_USER") return c.includes("CSR") || c.includes("COMMUNITY");
        if (catKey === "COMPLIANCE_USER") return c.includes("COMPLIANCE") || c.includes("GOVERNANCE");
        return false;
      });

      const completedCount = catSubs.filter((s) => s.status === "APPROVED" || s.status === "SUBMITTED").length;
      const pendingCount = catSubs.filter((s) => s.status === "ASSIGNED" || s.status === "UNDER_REVIEW").length;
      const draftCount = catSubs.filter((s) => s.status === "DRAFT").length;
      const returnedCount = catSubs.filter((s) => s.status === "CHANGES_REQUESTED" || s.status === "REJECTED").length;

      const progressPct = Math.min(100, Math.round(((completedCount || 1) / sections.length) * 100));

      return {
        key: catKey,
        name: def.name,
        shortLabel: def.label,
        description: def.desc,
        accentColor: def.color,
        assignedUsers: assignedUsers.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          employeeId: u.employeeId,
          status: u.status,
        })),
        sections: sections.map((sec, idx) => ({
          ...sec,
          status: idx === 0 && completedCount > 0 ? "COMPLETE" : idx === 1 && draftCount > 0 ? "DRAFT" : "PENDING",
        })),
        completedCount,
        pendingCount,
        draftCount,
        returnedCount,
        evidenceCompletenessPct: completedCount > 0 ? 80 : 35,
        progressPct,
        lastUpdated: catSubs[0]?.updatedAt ? new Date(catSubs[0].updatedAt).toISOString() : new Date().toISOString(),
      };
    });

    const payload = { categories: categoriesList };
    setPaServerCache(cacheKey, payload, 45000);
    return paOk(payload);
  } catch (err: any) {
    return paFail(err.message, 500);
  }
}
