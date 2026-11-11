// ── BRSR subsidiary data registry (Tata-style editable template inputs) ──
// Mirrors the MEIL BRSR editable template: Section A (general disclosures),
// Section B (management & process), Section C (principle-wise performance)
// and the annexures. Each subsidiary fills these once per reporting period;
// the Group Admin consolidates them into the final BRSR report.

export type BrsrFieldType = "text" | "textarea" | "number";

export interface BrsrField {
  key: string;
  label: string;
  type: BrsrFieldType;
  hint?: string;
}

export interface BrsrSection {
  key: string;
  title: string;
  description: string;
  fields: BrsrField[];
}

export const BRSR_SECTIONS: BrsrSection[] = [
  {
    key: "entity",
    title: "A · General Disclosures — Reporting Entity",
    description: "Section A-I of the BRSR template — legal identity and reporting boundary.",
    fields: [
      { key: "cin", label: "Corporate Identity Number (CIN)", type: "text" },
      { key: "legalName", label: "Name of reporting entity (legal name)", type: "text" },
      { key: "incorporationYear", label: "Year of incorporation", type: "text" },
      { key: "registeredOffice", label: "Registered office address", type: "textarea" },
      { key: "corporateOffice", label: "Corporate office address", type: "textarea" },
      { key: "email", label: "Official e-mail address", type: "text" },
      { key: "phone", label: "Telephone", type: "text" },
      { key: "website", label: "Website", type: "text" },
      { key: "paidUpCapital", label: "Paid-up capital (amount + currency)", type: "text" },
      { key: "listing", label: "Stock exchange listing details", type: "text", hint: "Enter details or N.A." },
      { key: "brsrContact", label: "BRSR contact person (name, designation, contact)", type: "textarea" },
      { key: "boundary", label: "Reporting boundary (standalone / consolidated; entities covered)", type: "textarea" },
      { key: "assuranceProvider", label: "Assurance provider", type: "text", hint: "Enter name or N.A." },
      { key: "assuranceScope", label: "Assurance type and scope", type: "text", hint: "Enter type, scope and indicators covered" },
    ],
  },
  {
    key: "business",
    title: "A · Products, Services & Operations",
    description: "Section A-II and A-III — principal business activities, markets and locations.",
    fields: [
      { key: "activities", label: "Principal business activities and their contribution to turnover", type: "textarea" },
      { key: "products", label: "Products / services (name, NIC code, % of turnover)", type: "textarea" },
      { key: "plantsIndia", label: "Plants / project sites in India (state-wise)", type: "number" },
      { key: "officesIndia", label: "Offices in India", type: "number" },
      { key: "locationsOutsideIndia", label: "Locations outside India", type: "number" },
      { key: "marketsServed", label: "Markets served, customer categories and export contribution", type: "textarea" },
    ],
  },
  {
    key: "workforce",
    title: "A · Employees & Workers",
    description: "Section A-IV — gender-wise workforce numbers as on the reporting date.",
    fields: [
      { key: "permanentEmployees", label: "Permanent employees (total; male/female %)", type: "text" },
      { key: "otherEmployees", label: "Other-than-permanent employees (total; male/female %)", type: "text" },
      { key: "permanentWorkers", label: "Permanent workers (total; male/female %)", type: "text" },
      { key: "otherWorkers", label: "Other-than-permanent workers (total; male/female %)", type: "text" },
      { key: "differentlyAbled", label: "Differently-abled employees & workers", type: "text" },
      { key: "turnoverRates", label: "Employee & worker turnover rates (gender-wise, year-wise)", type: "textarea" },
    ],
  },
  {
    key: "csr",
    title: "A · Group Structure, CSR & Stakeholders",
    description: "Section A-V to A-VII — group entities, CSR spend and grievance redressal.",
    fields: [
      { key: "groupEntities", label: "Group entities (name, relationship, ownership %, included in boundary?)", type: "textarea" },
      { key: "csrApplicable", label: "CSR provisions applicable?", type: "text", hint: "Yes / No / explain" },
      { key: "csrObligation", label: "CSR obligation, spend and unspent amount", type: "text" },
      { key: "csrProjects", label: "CSR projects and implementing partners", type: "textarea" },
      { key: "grievances", label: "Stakeholder grievances (group, received, pending, resolved)", type: "textarea" },
      { key: "materialIssues", label: "Material issues and management response", type: "textarea" },
    ],
  },
  {
    key: "governance",
    title: "B · Management & Process Disclosures",
    description: "Section B — policies, certifications, targets and Board oversight.",
    fields: [
      { key: "policies", label: "Policies (name, owner, approving authority, version, P1–P9 mapping)", type: "textarea" },
      { key: "policyImplementation", label: "How policies are communicated, implemented and extended to value-chain partners", type: "textarea" },
      { key: "certifications", label: "Standards / certifications (scope, validity)", type: "textarea" },
      { key: "targets", label: "Commitments & targets (baseline → target, boundary, owner, progress)", type: "textarea" },
      { key: "leadershipStatement", label: "Leadership statement on responsible business conduct", type: "textarea" },
      { key: "oversightCommittees", label: "Board / management committee oversight (mandate, frequency, minutes)", type: "textarea" },
    ],
  },
  {
    key: "environment",
    title: "C · Principle 6 — Environmental Performance",
    description: "Core quantitative indicators the Group consolidates (energy, water, emissions, waste).",
    fields: [
      { key: "energyGj", label: "Energy consumption by source (GJ) + renewable share (%)", type: "text" },
      { key: "energyIntensity", label: "Energy intensity (per unit of turnover / output)", type: "text" },
      { key: "waterKl", label: "Water withdrawal, consumption, discharge and recycling (KL)", type: "text" },
      { key: "waterIntensity", label: "Water intensity", type: "text" },
      { key: "scope1", label: "Scope 1 GHG emissions (tCO2e)", type: "number" },
      { key: "scope2", label: "Scope 2 GHG emissions (tCO2e)", type: "number" },
      { key: "scope3", label: "Scope 3 GHG emissions, where applicable (tCO2e)", type: "text" },
      { key: "ghgIntensity", label: "GHG intensity (per unit of turnover / output)", type: "text" },
      { key: "airEmissions", label: "Significant air emissions / pollutants and control performance", type: "textarea" },
      { key: "waste", label: "Waste generated, reused, recycled, disposed by category (tonnes)", type: "textarea" },
      { key: "envCompliances", label: "Environmental non-compliances, notices, penalties and corrective actions", type: "textarea" },
    ],
  },
  {
    key: "social",
    title: "C · Principles 3, 8 & 9 — Social Performance",
    description: "Employee well-being, community development and consumer responsibility indicators.",
    fields: [
      { key: "safety", label: "Health & safety: man-hours worked, fatalities, lost-time injuries, audits", type: "textarea" },
      { key: "training", label: "Training hours and skill development (employee/worker, gender-wise)", type: "textarea" },
      { key: "wagesBenefits", label: "Wages, benefits, social security and welfare", type: "textarea" },
      { key: "humanRights", label: "Human rights: due diligence, grievances, training coverage", type: "textarea" },
      { key: "community", label: "Community development: beneficiaries, local employment & procurement %", type: "textarea" },
      { key: "consumer", label: "Consumer complaints, resolution %, data privacy & cybersecurity incidents", type: "textarea" },
    ],
  },
  {
    key: "annexures",
    title: "Annexures — Methodology, Emission Factors & Exclusions",
    description: "Supporting registers the Group office needs to aggregate and audit the numbers.",
    fields: [
      { key: "methodology", label: "Data & calculation methodology register (metric, formula, assumptions)", type: "textarea" },
      { key: "emissionFactors", label: "Emission factor sources (grid electricity, diesel, coal — factor, source org, version)", type: "textarea" },
      { key: "exclusions", label: "Exclusions, estimates and restatements (metric, reason, effect on value)", type: "textarea" },
      { key: "evidenceRefs", label: "Evidence register references (Evidence IDs per indicator)", type: "textarea" },
    ],
  },
];

export const BRSR_FIELD_COUNT = BRSR_SECTIONS.reduce((n, s) => n + s.fields.length, 0);

export type BrsrSectionsData = Record<string, Record<string, string>>;

export function countFilledSections(data: BrsrSectionsData): number {
  return BRSR_SECTIONS.filter((s) => s.fields.every((f) => (data[s.key]?.[f.key] ?? "").trim() !== "")).length;
}

export function countFilledFields(data: BrsrSectionsData): number {
  return BRSR_SECTIONS.reduce(
    (n, s) => n + s.fields.filter((f) => (data[s.key]?.[f.key] ?? "").trim() !== "").length,
    0,
  );
}
