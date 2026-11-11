/* ═══════════════════════════════════════════════════════════════════════════
   MEIL ESG Platform — Carbon footprint model

   Domain logic for the calculator's "Carbon footprint" mode, split into a
   business segment (organisational Scope 1 + 2 footprint) and a personal
   segment (household footprint).

   Emission factors come from the platform's own registry
   (`@/components/shared/emission-factor-info`) so the calculator can never
   drift away from the factors used elsewhere in the ESG workspace.
   ═══════════════════════════════════════════════════════════════════════════ */

import { EMISSION_FACTOR_REGISTRY } from "@/components/shared/emission-factor-info";

/** Pull the numeric value out of a registry factor string ("0.716 Kg CO2e/kWh" → 0.716). */
function registryFactor(name: string): number {
  const entry = EMISSION_FACTOR_REGISTRY[name];
  if (!entry) return 0;
  const match = entry.factor.match(/-?\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : 0;
}

/** Registry source string for a factor, for honest attribution in the UI. */
export function factorSource(name: string): string {
  return EMISSION_FACTOR_REGISTRY[name]?.source ?? "CEA / IPCC 2006 Baseline Reference";
}

/** Scope label for a factor ("Scope 1", "Scope 2", …). */
export function factorScope(name: string): string {
  return EMISSION_FACTOR_REGISTRY[name]?.scope ?? "Scope 1/2";
}

/* ── Business segment ─────────────────────────────────────────────────────── */

export interface FuelOption {
  id: string;
  name: string;
  /** kg CO2e released per kg of fuel burned. */
  factor: number;
  /** Registry key this factor came from, for attribution. */
  registryKey: string;
  /**
   * Share of the fuel's emissions remaining after switching to piped natural
   * gas (PNG). This is a switching-policy assumption, not an emission factor.
   */
  pngRatio: number;
}

export const BUSINESS_FUELS: FuelOption[] = [
  { id: "anthracite", name: "Coal (anthracite)", factor: registryFactor("Coal (anthracite)"), registryKey: "Coal (anthracite)", pngRatio: 0.57 },
  { id: "bituminous", name: "Coal (bituminous)", factor: registryFactor("Coal (bituminous)"), registryKey: "Coal (bituminous)", pngRatio: 0.59 },
  { id: "lignite", name: "Coal (lignite)", factor: registryFactor("Coal (lignite)"), registryKey: "Coal (lignite)", pngRatio: 0.56 },
  { id: "subbituminous", name: "Coal (sub-bituminous)", factor: registryFactor("Coal (sub-bituminous)"), registryKey: "Coal (sub-bituminous)", pngRatio: 0.58 },
  { id: "diesel", name: "Diesel", factor: registryFactor("Diesel (per kg)"), registryKey: "Diesel (per kg)", pngRatio: 0.76 },
  { id: "furnace-oil", name: "Furnace oil", factor: registryFactor("Furnace Oil (per kg)"), registryKey: "Furnace Oil (per kg)", pngRatio: 0.73 },
  { id: "lpg", name: "LPG", factor: registryFactor("LPG (per kg)"), registryKey: "LPG (per kg)", pngRatio: 0.89 },
  { id: "pet-coke", name: "Pet coke", factor: registryFactor("Pet coke"), registryKey: "Pet coke", pngRatio: 0.58 },
  { id: "rice-husk", name: "Rice husk", factor: registryFactor("Rice husk"), registryKey: "Rice husk", pngRatio: 0.5 },
  { id: "wood", name: "Wood", factor: registryFactor("Wood"), registryKey: "Wood", pngRatio: 0.5 },
];

/** Grid electricity factor in kg CO2e per kWh (India CEA baseline). */
export const GRID_ELECTRICITY_FACTOR = registryFactor("Grid Electricity") || 0.716;

export interface ApplianceOption {
  name: string;
  /** Typical electrical load in watts, used when the user does not enter one. */
  watts: number;
}

/** Appliance groups offered in the business segment, by category. */
export const APPLIANCE_CATEGORIES: Record<string, ApplianceOption[]> = {
  Industrial: [
    { name: "Boiler", watts: 0 },
    { name: "Furnace", watts: 0 },
    { name: "Others", watts: 0 },
  ],
  General: [
    { name: "Lamp", watts: 15 },
    { name: "Tubelight", watts: 40 },
    { name: "Refrigerator", watts: 150 },
  ],
  Cooling: [
    { name: "Air conditioner (1.5 ton)", watts: 1500 },
    { name: "Air cooler", watts: 200 },
    { name: "Room cooler", watts: 200 },
    { name: "Fan", watts: 75 },
    { name: "Exhaust fan", watts: 40 },
  ],
  Heating: [
    { name: "Electric iron", watts: 1000 },
    { name: "Water heater", watts: 2000 },
    { name: "Water geyser", watts: 2000 },
    { name: "Toaster", watts: 800 },
    { name: "Room heater", watts: 1500 },
  ],
  Others: [
    { name: "Washing machine", watts: 500 },
    { name: "Radio", watts: 20 },
    { name: "TV", watts: 100 },
    { name: "Pump motor", watts: 750 },
  ],
};

export interface FuelEntry {
  fuelId: string;
  /** Quantity consumed per month, in kg. */
  quantity: number;
}

export interface ApplianceUsage {
  name: string;
  /** Number of units in service. */
  count: number;
  /** Average hours of use per day. */
  hours: number;
  /** Electrical load in watts (defaults to the catalogue value). */
  watts: number;
}

export interface BusinessInputs {
  fuels: FuelEntry[];
  /** Grid electricity consumed per month, in kWh. */
  electricity: number;
  appliances: ApplianceUsage[];
}

export interface BusinessResult {
  /** Total monthly footprint in kg CO2e. */
  total: number;
  /** Monthly footprint after switching every fuel to PNG, in kg CO2e. */
  afterPng: number;
  /** Percentage reduction achieved by the switch. */
  reductionPct: number;
  /** kg CO2e from fuel combustion. */
  fromFuel: number;
  /** kg CO2e from electricity use. */
  fromElectricity: number;
}

const DAYS_PER_MONTH = 30;

/** Compute the business carbon footprint from the current inputs. */
export function computeBusiness(inputs: BusinessInputs): BusinessResult {
  let fromFuel = 0;
  let fromFuelAfterPng = 0;
  for (const entry of inputs.fuels) {
    const fuel = BUSINESS_FUELS.find((f) => f.id === entry.fuelId);
    if (!fuel || !Number.isFinite(entry.quantity) || entry.quantity <= 0) continue;
    const emitted = entry.quantity * fuel.factor;
    fromFuel += emitted;
    fromFuelAfterPng += emitted * fuel.pngRatio;
  }

  const fromElectricity = Math.max(0, inputs.electricity || 0) * GRID_ELECTRICITY_FACTOR;

  let fromAppliances = 0;
  for (const appliance of inputs.appliances) {
    const watts = appliance.watts > 0 ? appliance.watts : 0;
    const kWh = (appliance.count * watts * appliance.hours * DAYS_PER_MONTH) / 1000;
    fromAppliances += kWh * GRID_ELECTRICITY_FACTOR;
  }

  const total = fromFuel + fromElectricity + fromAppliances;
  const afterPng = fromFuelAfterPng + fromElectricity + fromAppliances;
  const reductionPct = total > 0 ? ((total - afterPng) / total) * 100 : 0;

  return { total, afterPng, reductionPct, fromFuel, fromElectricity: fromElectricity + fromAppliances };
}

/* ── Personal segment ─────────────────────────────────────────────────────── */

export interface CountryProfile {
  /** Grid emission factor in kg CO2 per kWh. */
  gridFactor: number;
  /** Per-capita annual emissions in tonnes. */
  perCapita: number;
}

/**
 * Grid intensity and per-capita footprint by country. Grid factors follow the
 * published national averages used by the personal-footprint calculator this
 * tool was derived from; per-capita figures are indicative only.
 */
const COUNTRY_DATA: Record<string, [number, number]> = {
  Africa: [0.5, 1],
  Argentina: [0.3, 4],
  Australia: [0.6, 14.9],
  Austria: [0.12, 6.9],
  Belgium: [0.15, 7.4],
  Brazil: [0.1, 2.3],
  Bulgaria: [0.4, 6],
  Canada: [0.13, 14.2],
  China: [0.55, 8],
  Croatia: [0.2, 4.3],
  Cyprus: [0.6, 5.9],
  "Czech Republic": [0.4, 9.1],
  Denmark: [0.15, 4.8],
  Estonia: [0.6, 7.8],
  Finland: [0.1, 7],
  France: [0.06, 4.5],
  Germany: [0.38, 7.9],
  Greece: [0.35, 5.7],
  "Hong Kong": [0.7, 5.5],
  Hungary: [0.22, 4.6],
  Iceland: [0.03, 8.6],
  India: [0.82, 2],
  Indonesia: [0.7, 2.3],
  Ireland: [0.33, 7],
  Italy: [0.31, 5.3],
  Japan: [0.46, 8.5],
  Latvia: [0.1, 3.8],
  Lithuania: [0.15, 4.6],
  Luxembourg: [0.1, 12],
  Malta: [0.4, 3.6],
  Mexico: [0.44, 3],
  Netherlands: [0.33, 7.6],
  "New Zealand": [0.1, 6.5],
  Norway: [0.03, 7.5],
  Poland: [0.66, 8],
  Portugal: [0.2, 4.2],
  Romania: [0.28, 3.7],
  "Russian Federation": [0.36, 11.4],
  "Saudi Arabia": [0.6, 16],
  Slovakia: [0.12, 5.9],
  Slovenia: [0.22, 5.9],
  "South Africa": [0.9, 6.9],
  Spain: [0.19, 5],
  Sweden: [0.03, 3.3],
  Switzerland: [0.03, 4],
  Turkey: [0.45, 5.2],
  "United Arab Emirates": [0.4, 18],
  "United Kingdom": [0.21, 4.7],
  "United States": [0.37, 14.9],
};

export const COUNTRIES = Object.keys(COUNTRY_DATA);

export function countryProfile(country: string): CountryProfile {
  const [gridFactor, perCapita] = COUNTRY_DATA[country] ?? COUNTRY_DATA.India;
  return { gridFactor, perCapita };
}

/** Emission factors for personal energy and travel, in kg CO2e per unit. */
export const PERSONAL_FACTORS = {
  lng: 2.07,
  coal: 2.5,
  coke: 2.8,
  air: 0.121,
  rail: 0.0078,
  metro: 0.0139,
  bus: 0.054,
  ebus: 0.03782,
  cab: 0.1431,
  ecab: 0.1035,
  petrol: 2.34,
  diesel: 2.71,
  lpg: 2.07,
} as const;

export const MEAL_OPTIONS: Array<{ label: string; kg: number }> = [
  { label: "Vegan", kg: 2019 },
  { label: "Vegetarian", kg: 2176 },
  { label: "Non-veg: most meals", kg: 3781 },
  { label: "Non-veg: some meals", kg: 3017 },
  { label: "Non-veg: very rarely", kg: 2412 },
];

export interface PersonalInputs {
  country: string;
  household: number;
  /** Annual grid electricity in kWh. */
  kwh: number;
  /** Share of electricity from renewable sources, in percent. */
  renewablePct: number;
  /** Annual household fuel use in kg. */
  lng: number;
  coal: number;
  coke: number;
  /** Annual travel in km. */
  air: number;
  rail: number;
  metro: number;
  bus: number;
  ebus: number;
  cab: number;
  ecab: number;
  /** Annual vehicle fuel in litres. */
  petrol: number;
  diesel: number;
  lpg: number;
  /** Index into MEAL_OPTIONS, or null when the user has not chosen. */
  mealIndex: number | null;
}

export interface PersonalResult {
  /** Annual footprint in tonnes CO2e. */
  total: number;
  electricity: number;
  homeFuel: number;
  travel: number;
  vehicleFuel: number;
  meals: number;
  /** Per-capita average for the selected country, in tonnes. */
  countryAverage: number;
  /** Global per-capita average, in tonnes. */
  worldAverage: number;
}

export const WORLD_PER_CAPITA_AVERAGE = 4.5;

/** Compute the personal annual carbon footprint, in tonnes CO2e. */
export function computePersonal(inputs: PersonalInputs): PersonalResult {
  const profile = countryProfile(inputs.country);
  const household = Math.max(1, inputs.household);
  const F = PERSONAL_FACTORS;

  const electricity =
    (Math.max(0, inputs.kwh) * (1 - Math.min(100, Math.max(0, inputs.renewablePct)) / 100) * profile.gridFactor) / household;
  const homeFuel = (F.lng * inputs.lng + F.coal * inputs.coal + F.coke * inputs.coke) / household;
  const travel =
    F.air * inputs.air +
    F.rail * inputs.rail +
    F.metro * inputs.metro +
    F.bus * inputs.bus +
    F.ebus * inputs.ebus +
    F.cab * inputs.cab +
    F.ecab * inputs.ecab;
  const vehicleFuel = F.petrol * inputs.petrol + F.diesel * inputs.diesel + F.lpg * inputs.lpg;
  const meals = inputs.mealIndex === null ? 0 : MEAL_OPTIONS[inputs.mealIndex].kg;

  return {
    total: (electricity + homeFuel + travel + vehicleFuel + meals) / 1000,
    electricity,
    homeFuel,
    travel,
    vehicleFuel,
    meals,
    countryAverage: profile.perCapita,
    worldAverage: WORLD_PER_CAPITA_AVERAGE,
  };
}

export interface ReductionTip {
  group: string;
  /** Estimated annual saving in kg CO2e. */
  kg: number;
  action: string;
}

/** Illustrative actions that reduce a personal footprint, with indicative savings. */
export const REDUCTION_TIPS: ReductionTip[] = [
  { group: "electricity", kg: 2800, action: "Switch to renewable power at home (family of four)" },
  { group: "electricity", kg: 650, action: "Install solar water heaters" },
  { group: "electricity", kg: 400, action: "Run the air conditioner at 24 °C instead of 18 °C" },
  { group: "electricity", kg: 200, action: "Choose 5-star rated devices (a 5-star 1.5 ton AC versus 2-star)" },
  { group: "electricity", kg: 130, action: "Switch off the TV and set-top box at the plug, not with the remote" },
  { group: "electricity", kg: 50, action: "Switch to LED lighting (one 15 W bulb)" },
  { group: "travel", kg: 2000, action: "Switch to electric vehicles charged with clean electricity" },
  { group: "travel", kg: 1300, action: "Carpool to work (every small car off the road on working days)" },
  { group: "travel", kg: 1000, action: "Use public transport, cycling and walking" },
  { group: "travel", kg: 240, action: "Use virtual meetings (avoid one 2,000 km round-trip flight)" },
  { group: "travel", kg: 140, action: "Keep vehicle tyres properly inflated for better mileage" },
  { group: "lifestyle choices", kg: 1000, action: "Plant and nurture 10 trees (kg every year for 100 years)" },
  { group: "lifestyle choices", kg: 1200, action: "Take the stairs instead of the lift (50 trips between ground and third floor)" },
  { group: "lifestyle choices", kg: 400, action: "Buy locally grown fruit and vegetables where possible" },
  { group: "lifestyle choices", kg: 240, action: "Add more plant-based options to your diet (less red meat)" },
  { group: "lifestyle choices", kg: 10, action: "Replace disposable plastics with reusable bags, bottles and straws" },
];

/** Format a kg CO2e quantity for display. */
export function formatKg(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 1 });
}
