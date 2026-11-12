// ── SEBI BRSR Core · Annexure I — "Format of BRSR Core" ──────────────────────
//
// The official SEBI Annexure I table. Nine ATTRIBUTES (Section C of the BRSR
// Top 9 Principles) and, under each, the PARAMETERS the entity must report —
// with the measurement unit, the data & assurance approach, and the
// cross-reference back to the BRSR Core principle/question.
//
// This registry is the single source of truth for:
//   · the Subsidiary Admin "BRSR Data" capture form  (per-entity inputs)
//   · the Group Admin consolidated BRSR report         (group roll-up)
//   · the PDF annexure table                           (as reported)
//
// Section A (general disclosures), Section B (management & process) and the
// annexures live in ./sections.ts — they are not part of Annexure I.

export type AnnexureAttributeId =
  | "ghg"        // 1 · Greenhouse gas (GHG) footprint
  | "water"      // 2 · Water footprint
  | "energy"     // 3 · Energy footprint
  | "waste"      // 4 · Embracing circularity — waste management
  | "safety"     // 5 · Enhancing employee well-being and safety
  | "gender"     // 6 · Enabling gender diversity in business
  | "inclusive"  // 7 · Enabling inclusive development
  | "fairness"   // 8 · Fairness in engaging with customers and suppliers
  | "openness";  // 9 · Open-ness of business

export interface AnnexureParameter {
  /** Stable key used in the capture form and the seeded payloads. */
  key: string;
  /** Parameter label exactly as SEBI words it. */
  label: string;
  /** Measurement unit / basis. */
  unit: string;
  /** "Data & Assurance Approach" column — how the number is derived. */
  assurance: string;
  /** Cross-reference back to the BRSR Core principle + question. */
  crossRef: string;
  /** Free-text parameter (waste categories, RPT detail) vs a number. */
  kind: "number" | "text";
  /**
   * How the group's consolidated value is derived from the subsidiary
   * submissions:
   *   · sum   — an absolute quantity (totals add up)
   *   · avg   — a rate / percentage / intensity (the group figure is the
   *              mean of what the subsidiaries reported, NOT their sum)
   *   · max   — a worst-case figure (LTIFR, days payable)
   */
  aggregation: "sum" | "avg" | "max";
}

export interface AnnexureAttribute {
  id: AnnexureAttributeId;
  /** Sr. No. in the Annexure I table. */
  srNo: number;
  title: string;
  /** Short attribute line shown as the card header. */
  summary: string;
  parameters: AnnexureParameter[];
}

/** The Annexure I table — SEBI BRSR Core, 9 attributes. */
export const ANNEXURE_I: AnnexureAttribute[] = [
  {
    id: "ghg",
    srNo: 1,
    title: "Green-house gas (GHG) footprint",
    summary:
      "Greenhouse gas emissions may be measured in accordance with the Greenhouse Gas Protocol: A Corporate Accounting and Reporting Standard.",
    parameters: [
      {
        key: "scope1",
        label: "Total Scope 1 emissions (break-up into CO2, CH4, N2O, HFCs, PFCs, SF6, NF3, if available)",
        unit: "tCO2e (Mn MT / KT / MT)",
        assurance:
          "1. Absolute fossil fuel consumption (coal, natural gas, diesel, FO) 2. Emission factor (GHG in CO2e per unit of measure) — IPCC or actual testing from an accredited test lab 3. Quantity of carbon capture 4. GHG emissions in CO2 equivalent by process (non-fuel source) 5. Fugitive emissions 6. Total Scope 1 = Point 2 × Point 1 − Point 3 + Point 4 + Point 5.",
        crossRef: "Principle 6, Question 7 of Essential Indicators",
        kind: "number",
      aggregation: "sum",
      },
      {
        key: "scope2",
        label: "Total Scope 2 emissions (break-up into CO2, CH4, N2O, HFCs, PFCs, SF6, NF3, if available)",
        unit: "tCO2e (Mn MT / KT / MT)",
        assurance:
          "Indirect emissions from generation of energy purchased from a utility provider. 1. Total consumption of purchased energy (MW), steam (MT), refrigeration (MMBTU) 2. Emission factor across all purchased energy sources — IPCC or actual from the supplier (audited certificates) 3. Total Scope 2 = total consumption × emission factor.",
        crossRef: "Principle 6, Question 7 of Essential Indicators",
        kind: "number",
      aggregation: "sum",
      },
      {
        key: "ghgIntensityTurnover",
        label: "GHG emission intensity (Scope 1 + 2) per revenue",
        unit: "tCO2e per ₹ Cr (PPP adjusted)",
        assurance:
          "1. Total emissions (Scope 1 & 2) 2. Total revenue from operations — from audited P&L 3. PPP (USD/INR).",
        crossRef: "Principle 6, Question 7 of Essential Indicators",
        kind: "number",
      aggregation: "avg",
      },
      {
        key: "ghgIntensityOutput",
        label: "GHG emission intensity (Scope 1 + 2) per unit of product or service",
        unit: "tCO2e per unit of output",
        assurance:
          "1. Total emissions (Scope 1 & 2) 2. Company & sector specific output (no. of vehicles produced, MT of material produced, Mn TB of data, no. of seats / travel class, room nights).",
        crossRef: "Principle 6, Question 7 of Essential Indicators",
        kind: "text",
      aggregation: "sum",
      },
    ],
  },
  {
    id: "water",
    srNo: 2,
    title: "Water footprint",
    summary:
      "Water consumed is water no longer available for use by the ecosystem or local community — withdrawn and incorporated into products, evaporated, or polluted beyond reuse.",
    parameters: [
      {
        key: "waterConsumption",
        label: "Total water consumption",
        unit: "Mn Lt or KL",
        assurance:
          "Water withdrawn and not returned to surface water, groundwater, seawater or a third party, plus water stored for use in a subsequent period. Where consumption cannot be measured directly: 1. Input water flow meter logs (calibrated meters) 2. Output water flow meter logs (calibrated meters) 3. Consumption = input − output.",
        crossRef: "Principle 6, Question 3 of Essential Indicators",
        kind: "number",
      aggregation: "sum",
      },
      {
        key: "waterIntensityTurnover",
        label: "Water consumption intensity per revenue",
        unit: "Mn Lt or KL per ₹ Cr (PPP adjusted)",
        assurance:
          "1. Total water consumed 2. Total revenue from operations (audited P&L) 3. PPP (USD/INR).",
        crossRef: "Principle 6, Question 3 of Essential Indicators",
        kind: "number",
      aggregation: "avg",
      },
      {
        key: "waterIntensityOutput",
        label: "Water consumption intensity per unit of product or service",
        unit: "Mn Lt or KL per unit of output",
        assurance:
          "1. Consumption as above 2. Company & sector specific output (no. of vehicles produced, MT of material produced, Mn TB of data).",
        crossRef: "Principle 6, Question 3 of Essential Indicators",
        kind: "text",
      aggregation: "sum",
      },
      {
        key: "waterDischarge",
        label: "Water discharge by destination and level of treatment",
        unit: "Mn Lt or KL",
        assurance:
          "1. Untreated water 2. Primary treatment (removal of material that floats or settles out — filtration, screening, sedimentation) 3. Secondary treatment (removal of dissolved organic matter — oxidation, digestion) 4. Tertiary treatment (disinfection — removal of pathogens, phosphorus, nitrogen).",
        crossRef: "Principle 6, Question 4 of Essential Indicators",
        kind: "text",
      aggregation: "sum",
      },
    ],
  },
  {
    id: "energy",
    srNo: 3,
    title: "Energy footprint",
    summary:
      "Total energy consumption = non-renewable fuel + renewable fuel + purchased electricity/heating/cooling/steam + self-generated electricity/heating/cooling/steam (self-generated counted only once).",
    parameters: [
      {
        key: "energyConsumed",
        label: "Total energy consumed",
        unit: "GJ (joules or multiples)",
        assurance:
          "Non-renewable fuel consumed + renewable fuel consumed + purchased electricity, heating, cooling, steam + self-generated electricity, heating, cooling, steam. If the entity generates electricity from a fuel and consumes it, the energy is counted only once.",
        crossRef: "Principle 6, Question 1 of Essential Indicators",
        kind: "number",
      aggregation: "sum",
      },
      {
        key: "renewableShare",
        label: "Percentage of energy consumed from renewable sources",
        unit: "% of total energy consumed",
        assurance: "Energy consumed through renewable sources ÷ total energy consumed.",
        crossRef: "Principle 6, Question 1 of Essential Indicators",
        kind: "number",
      aggregation: "avg",
      },
      {
        key: "energyIntensityTurnover",
        label: "Energy intensity per revenue",
        unit: "GJ per ₹ Cr (PPP adjusted)",
        assurance:
          "1. Total energy consumed 2. Total revenue from operations (audited P&L) 3. PPP (USD/INR).",
        crossRef: "Principle 6, Question 1 of Essential Indicators",
        kind: "number",
      aggregation: "avg",
      },
      {
        key: "energyIntensityOutput",
        label: "Energy intensity per unit of product or service",
        unit: "GJ per unit of output",
        assurance:
          "1. Consumption as above 2. Company & sector specific output (no. of vehicles produced, MT of material produced, Mn TB of data).",
        crossRef: "Principle 6, Question 1 of Essential Indicators",
        kind: "text",
      aggregation: "sum",
      },
    ],
  },
  {
    id: "waste",
    srNo: 4,
    title: "Embracing circularity — waste management",
    summary:
      "Waste is reported by category (A–H) as prescribed, with the total, the intensity, the quantity recovered through recycling / re-use, and the quantity disposed by disposal method.",
    parameters: [
      {
        key: "plasticWaste",
        label: "Plastic waste (A)",
        unit: "Kg / MT",
        assurance: "Absolute weight of packaging material (bags, bottles, pallets) discarded, as defined under the Plastic Waste Management Rules, 2016 and amendments.",
        crossRef: "Principle 6, Question 9 of Essential Indicators",
        kind: "number",
      aggregation: "sum",
      },
      {
        key: "ewaste",
        label: "E-waste (B)",
        unit: "Kg / MT",
        assurance:
          "Discarded computers, televisions, cell phones, VCRs, stereos, DVD players, copiers and fax machines etc., as listed under the E-Waste Management Rules, 2016 and amendments.",
        crossRef: "Principle 6, Question 9 of Essential Indicators",
        kind: "number",
      aggregation: "sum",
      },
      {
        key: "biomedicalWaste",
        label: "Bio-medical waste (C)",
        unit: "Kg / MT",
        assurance:
          "Solids and liquid waste including containers and any intermediate product generated during diagnosis, treatment or immunisation of human beings or animals, or research activities, as listed under the Bio-Medical Waste Management Rules, 2016.",
        crossRef: "Principle 6, Question 9 of Essential Indicators",
        kind: "number",
      aggregation: "sum",
      },
      {
        key: "cdWaste",
        label: "Construction and demolition waste (D)",
        unit: "Kg / MT",
        assurance:
          "Construction waste as per the C&D Waste Management Rules, 2016 and amendments — concrete, plaster, metal rods / wires, wood, plastics etc.",
        crossRef: "Principle 6, Question 9 of Essential Indicators",
        kind: "number",
      aggregation: "sum",
      },
      {
        key: "batteryWaste",
        label: "Battery waste (E)",
        unit: "Kg / MT",
        assurance:
          "Discarded batteries — Li-ion, alkaline, lead acid etc. used in vehicles, computers & laptops, mobiles, other electronics, UPS and power back-up, as per the Battery Waste Management Rules, 2016.",
        crossRef: "Principle 6, Question 9 of Essential Indicators",
        kind: "number",
      aggregation: "sum",
      },
      {
        key: "radioactiveWaste",
        label: "Radioactive waste (F)",
        unit: "Kg / MT",
        assurance:
          "Discarded material such as paper, plastic, clothes, equipment and machine parts having exposure to radiation across nuclear power plants, hospitals, research laboratories and industrial applications.",
        crossRef: "Principle 6, Question 9 of Essential Indicators",
        kind: "number",
      aggregation: "sum",
      },
      {
        key: "otherHazardousWaste",
        label: "Other hazardous waste, if any (G)",
        unit: "Kg / MT",
        assurance: "As per the hazardous waste management rules of CPCB.",
        crossRef: "Principle 6, Question 9 of Essential Indicators",
        kind: "number",
      aggregation: "sum",
      },
      {
        key: "otherNonHazardousWaste",
        label: "Other non-hazardous waste generated, if any (H) — break-up by composition",
        unit: "Kg / MT",
        assurance:
          "Waste not identified as hazardous as per CPCB, broken up by materials relevant to the sector.",
        crossRef: "Principle 6, Question 9 of Essential Indicators",
        kind: "number",
      aggregation: "sum",
      },
      {
        key: "totalWasteGenerated",
        label: "Total waste generated (A + B + C + D + E + F + G + H)",
        unit: "Kg / MT",
        assurance: "Self-explanatory — the sum of the categories above.",
        crossRef: "Principle 6, Question 9 of Essential Indicators",
        kind: "number",
      aggregation: "sum",
      },
      {
        key: "wasteIntensityTurnover",
        label: "Waste intensity per revenue",
        unit: "Kg or MT per ₹ Cr (PPP adjusted)",
        assurance:
          "1. Total waste generated 2. Total revenue from operations (audited P&L) 3. PPP (USD/INR).",
        crossRef: "Principle 6, Question 9 of Essential Indicators",
        kind: "number",
      aggregation: "avg",
      },
      {
        key: "wasteIntensityOutput",
        label: "Waste intensity per unit of product or service",
        unit: "Kg or MT per unit of output",
        assurance:
          "1. Total waste generated 2. Company & sector specific output (no. of vehicles produced, MT of material produced, Mn TB of data).",
        crossRef: "Principle 6, Question 9 ofEssential Indicators",
        kind: "text",
      aggregation: "sum",
      },
      {
        key: "wasteRecovered",
        label: "Each category of waste generated — total waste recovered through recycling, re-using or other recovery operations",
        unit: "Kg or MT",
        assurance:
          "Absolute quantity. Intensity = Kg of waste recycled & recovered ÷ total waste generated. Disclosure may be provided where vendor certificates have been relied upon for assurance of waste KPIs.",
        crossRef: "Principle 6, Question 9 of Essential Indicators",
        kind: "text",
      aggregation: "sum",
      },
      {
        key: "wasteDisposed",
        label: "Each category of waste generated — total waste disposed by nature of disposal method",
        unit: "Kg or MT",
        assurance:
          "1. Amount of material in MT disposed through incineration 2. Amount of material to landfill 3. Any other method. Intensity = Kg of waste recycled & recovered ÷ total waste generated.",
        crossRef: "Principle 6, Question 9 of Essential Indicators",
        kind: "text",
      aggregation: "sum",
      },
    ],
  },
  {
    id: "safety",
    srNo: 5,
    title: "Enhancing employee well-being and safety",
    summary:
      "Well-being spend as a share of revenue, plus the safety record — permanent disabilities, LTIFR and fatalities.",
    parameters: [
      {
        key: "wellbeingSpend",
        label: "Spending on measures towards well-being of employees and workers",
        unit: "% of total revenue of the company",
        assurance:
          "Cost incurred as a % of total revenue, checked against insurance policies and premium paid, infant care policy, and amounts billed/invoiced for such facilities — health insurance, accident insurance, maternity benefits, paternity benefits, day-care facilities, health & safety measures including access to mental health.",
        crossRef: "Principle 3, Question 1(c) of Essential Indicators",
        kind: "number",
      aggregation: "avg",
      },
      {
        key: "permanentDisabilities",
        label: "Safety related incidents for employees and workers — permanent disabilities",
        unit: "Number",
        assurance:
          "To be checked on the basis of claims — including the contract workforce at the company's construction sites.",
        crossRef: "Principle 3, Question 11 of Essential Indicators",
        kind: "number",
      aggregation: "sum",
      },
      {
        key: "ltifr",
        label: "Lost Time Injury Frequency Rate (LTIFR)",
        unit: "per one million person-hours worked",
        assurance:
          "1. Total number of lost time injuries 2. Total number of working hours 3. LTIFR = (total lost time injuries × 10,00,000) ÷ total working hours.",
        crossRef: "Principle 3, Question 11 of Essential Indicators",
        kind: "number",
      aggregation: "max",
      },
      {
        key: "fatalities",
        label: "Number of fatalities",
        unit: "Number",
        assurance:
          "To be checked on the basis of claims as reported to the Factory Inspector.",
        crossRef: "Principle 3, Question 11 of Essential Indicators",
        kind: "number",
      aggregation: "sum",
      },
    ],
  },
  {
    id: "gender",
    srNo: 6,
    title: "Enabling gender diversity in business",
    summary:
      "Gender split of wages, and the POSH complaint record — reported, as a share of female employees/workers, and upheld.",
    parameters: [
      {
        key: "femaleWageShare",
        label: "Gross wages paid to females as a percentage of wages paid",
        unit: "% of wages paid",
        assurance: "Employee master / register.",
        crossRef: "Principle 5, Question 3(b) of Essential Indicators",
        kind: "number",
      aggregation: "avg",
      },
      {
        key: "poshComplaints",
        label: "Total complaints on Sexual Harassment (POSH) reported",
        unit: "Number of complaints",
        assurance:
          "Total complaints on sexual harassment reported, and complaints on POSH as a % of female employees / workers.",
        crossRef: "Principle 5, Question 7 of Essential Indicators",
        kind: "number",
      aggregation: "sum",
      },
      {
        key: "poshUpheld",
        label: "Complaints on POSH upheld",
        unit: "Number of complaints",
        assurance: "Count of POSH complaints upheld during the reporting period.",
        crossRef: "Principle 5, Question 7 of Essential Indicators",
        kind: "number",
      aggregation: "sum",
      },
    ],
  },
  {
    id: "inclusive",
    srNo: 7,
    title: "Enabling inclusive development",
    summary:
      "Procurement from MSMEs and within India, and the share of wages paid in smaller towns.",
    parameters: [
      {
        key: "msmeProcurement",
        label: "Input material sourced from MSMEs / small producers and from within India",
        unit: "% of total purchases by value",
        assurance:
          "Self-explanatory. 'Input material' includes all types of procurement — raw material, spares, services, capex procurement items etc.",
        crossRef: "Principle 8, Question 4 of Essential Indicators",
        kind: "number",
      aggregation: "avg",
      },
      {
        key: "smallerTownWages",
        label: "Job creation in smaller towns — wages paid to persons employed in smaller towns as a share of total wage cost",
        unit: "% of total wage cost",
        assurance:
          "Wages paid to persons employed in smaller towns (permanent or non-permanent / on contract) as % of total wage cost. Place of employment classified per the RBI system — rural / semi-urban / urban / metropolitan.",
        crossRef: "Principle 8, Question 5 of Essential Indicators",
        kind: "number",
      aggregation: "avg",
      },
    ],
  },
  {
    id: "fairness",
    srNo: 8,
    title: "Fairness in engaging with customers and suppliers",
    summary:
      "Customer data-loss exposure as a share of cyber-security events, and the payment cycle to suppliers.",
    parameters: [
      {
        key: "dataBreachShare",
        label: "Instances involving loss / breach of customer data as a percentage of total data breaches or cyber security events",
        unit: "% of total breaches / cyber security events",
        assurance: "Checked against the information-security incident register.",
        crossRef: "Principle 9, Question 7 of Essential Indicators",
        kind: "number",
      aggregation: "avg",
      },
      {
        key: "accountsPayableDays",
        label: "Number of days of accounts payable",
        unit: "Days",
        assurance: "(Accounts payable × 365) ÷ cost of goods/services procured — to be checked from the financial statements.",
        crossRef: "Principle 1, Question 8 of Essential Indicators",
        kind: "number",
      aggregation: "max",
      },
    ],
  },
  {
    id: "openness",
    srNo: 9,
    title: "Open-ness of business",
    summary:
      "Concentration of purchases and sales with trading houses, dealers and related parties (RPTs).",
    parameters: [
      {
        key: "tradingHousePurchases",
        label: "Purchases from trading houses as a percentage of total purchases, and the number of trading houses purchased from",
        unit: "% of total purchases · count of trading houses",
        assurance:
          "1. RPT audited by the financial auditors (refer financial audit report) 2. Financial statements / invoices. Includes purchases from the top 10 trading houses as a % of total purchases from trading houses.",
        crossRef: "Principle 1, Question 9 of Essential Indicators",
        kind: "text",
      aggregation: "sum",
      },
      {
        key: "dealerSales",
        label: "Sales to dealers / distributors as a percentage of total sales, and the number of dealers / distributors",
        unit: "% of total sales · count of dealers",
        assurance:
          "Includes sales to the top 10 dealers / distributors as a % of total sales to dealers / distributors.",
        crossRef: "Principle 1, Question 9 of Essential Indicators",
        kind: "text",
      aggregation: "sum",
      },
      {
        key: "rptShare",
        label: "Share of RPTs (as respective percentage) in purchases, sales, loans & advances and investments",
        unit: "% of each category",
        assurance:
          "Related-party transactions as a percentage of purchases, sales, loans & advances and investments respectively.",
        crossRef: "Principle 1, Question 9 of Essential Indicators",
        kind: "text",
      aggregation: "sum",
      },
    ],
  },
];

/* ── helpers ─────────────────────────────────────────────────────────────── */

export const ANNEXURE_PARAM_COUNT = ANNEXURE_I.reduce((n, a) => n + a.parameters.length, 0);

/** Flat list of every parameter with its owning attribute. */
export const ANNEXURE_PARAMETERS: Array<
  AnnexureParameter & { attributeId: AnnexureAttributeId; attributeTitle: string; srNo: number }
> = ANNEXURE_I.flatMap((a) =>
  a.parameters.map((p) => ({ ...p, attributeId: a.id, attributeTitle: a.title, srNo: a.srNo }))
);

/** Look up a parameter by its key. */
export function findAnnexureParameter(key: string) {
  return ANNEXURE_PARAMETERS.find((p) => p.key === key) ?? null;
}

/** Every parameter of one attribute. */
export function annexureParametersOf(attributeId: AnnexureAttributeId): AnnexureParameter[] {
  return ANNEXURE_I.find((a) => a.id === attributeId)?.parameters ?? [];
}

/** The numeric parameters of one attribute (what the platform can aggregate). */
export function numericAnnexureParameters(attributeId: AnnexureAttributeId): AnnexureParameter[] {
  return annexureParametersOf(attributeId).filter((p) => p.kind === "number");
}
