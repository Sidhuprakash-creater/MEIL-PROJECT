"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   MEIL ESG Platform — Travel carbon footprint engine

   Models the travel calculator after Sustainable Travel International's
   (sustainabletravel.org) footprint tool:

     • Flight   — great-circle distance between airports, classified into
                  short (<1,500 km), medium (1,500–3,700 km) and long-haul
                  (>3,700 km), with per-class kg CO₂e / passenger-km factors
                  derived from the UK DESNZ (formerly DEFRA) 2024 set.
     • Private jet — flight hours × aircraft fuel burn (gal/hr) ×
                  9.75 kg CO₂e per gallon of jet fuel (US EIA 2024).
     • Hotel    — per-country CHSB benchmark kg CO₂e per room-night, scaled
                  by star rating, rooms and nights.
     • Boat     — cruises and liveaboards on a per-passenger-day benchmark,
                  private boats on engine burn × fuel emission factor.
     • Car      — kg CO₂e per km by vehicle type and fuel (0.11–0.20 band),
                  shared across occupants.

   All factors are indicative averages — for reporting-grade numbers use the
   platform's CEA / IPCC / GHG Protocol factor registry.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Airports ────────────────────────────────────────────────────────────── */

/** [IATA, city, country, lat, lon] — major commercial airports worldwide. */
type AirportRow = [string, string, string, number, number];

const AIRPORT_ROWS: AirportRow[] = [
  // India
  ["DEL", "Delhi", "India", 28.56, 77.1],
  ["BOM", "Mumbai", "India", 19.09, 72.87],
  ["BLR", "Bengaluru", "India", 13.2, 77.71],
  ["MAA", "Chennai", "India", 12.99, 80.17],
  ["HYD", "Hyderabad", "India", 17.24, 78.43],
  ["CCU", "Kolkata", "India", 22.65, 88.44],
  ["COK", "Kochi", "India", 10.15, 76.4],
  ["GOI", "Goa", "India", 15.38, 73.83],
  ["PNQ", "Pune", "India", 18.58, 73.92],
  ["AMD", "Ahmedabad", "India", 23.07, 72.63],
  ["JAI", "Jaipur", "India", 26.82, 75.81],
  ["LKO", "Lucknow", "India", 26.76, 80.88],
  ["TRV", "Thiruvananthapuram", "India", 8.48, 76.92],
  ["IXC", "Chandigarh", "India", 30.67, 76.79],
  ["GAU", "Guwahati", "India", 26.11, 91.74],
  ["SXR", "Srinagar", "India", 33.99, 74.77],
  // Middle East
  ["DXB", "Dubai", "UAE", 25.25, 55.36],
  ["AUH", "Abu Dhabi", "UAE", 24.43, 54.65],
  ["SHJ", "Sharjah", "UAE", 25.33, 55.51],
  ["DOH", "Doha", "Qatar", 25.27, 51.61],
  ["RUH", "Riyadh", "Saudi Arabia", 24.96, 46.7],
  ["JED", "Jeddah", "Saudi Arabia", 21.68, 39.16],
  ["MCT", "Muscat", "Oman", 23.59, 58.28],
  ["KWI", "Kuwait City", "Kuwait", 29.23, 47.97],
  ["BAH", "Manama", "Bahrain", 26.27, 50.63],
  ["TLV", "Tel Aviv", "Israel", 32.01, 34.89],
  ["AMM", "Amman", "Jordan", 31.72, 35.99],
  // Turkey & Caucasus / Central Asia
  ["IST", "Istanbul", "Turkey", 41.26, 28.74],
  ["SAW", "Istanbul (Sabiha)", "Turkey", 40.9, 29.31],
  ["TBS", "Tbilisi", "Georgia", 41.67, 44.95],
  ["TAS", "Tashkent", "Uzbekistan", 41.26, 69.28],
  ["ALA", "Almaty", "Kazakhstan", 43.35, 77.04],
  // Europe
  ["LHR", "London (Heathrow)", "UK", 51.47, -0.45],
  ["LGW", "London (Gatwick)", "UK", 51.15, -0.19],
  ["MAN", "Manchester", "UK", 53.35, -2.28],
  ["EDI", "Edinburgh", "UK", 55.95, -3.37],
  ["DUB", "Dublin", "Ireland", 53.42, -6.27],
  ["CDG", "Paris (CDG)", "France", 49.01, 2.55],
  ["ORY", "Paris (Orly)", "France", 48.72, 2.38],
  ["NCE", "Nice", "France", 43.66, 7.22],
  ["AMS", "Amsterdam", "Netherlands", 52.31, 4.76],
  ["BRU", "Brussels", "Belgium", 50.9, 4.48],
  ["FRA", "Frankfurt", "Germany", 50.03, 8.56],
  ["MUC", "Munich", "Germany", 48.35, 11.79],
  ["BER", "Berlin", "Germany", 52.36, 13.5],
  ["HAM", "Hamburg", "Germany", 53.63, 9.99],
  ["ZRH", "Zurich", "Switzerland", 47.46, 8.55],
  ["GVA", "Geneva", "Switzerland", 46.24, 6.11],
  ["VIE", "Vienna", "Austria", 48.11, 16.57],
  ["MAD", "Madrid", "Spain", 40.49, -3.57],
  ["BCN", "Barcelona", "Spain", 41.3, 2.08],
  ["AGP", "Malaga", "Spain", 36.68, -4.5],
  ["PMI", "Palma de Mallorca", "Spain", 39.55, 2.74],
  ["LIS", "Lisbon", "Portugal", 38.77, -9.13],
  ["OPO", "Porto", "Portugal", 41.24, -8.68],
  ["FCO", "Rome", "Italy", 41.8, 12.25],
  ["MXP", "Milan", "Italy", 45.63, 8.72],
  ["VCE", "Venice", "Italy", 45.51, 12.35],
  ["NAP", "Naples", "Italy", 40.88, 14.29],
  ["ATH", "Athens", "Greece", 37.94, 23.94],
  ["CPH", "Copenhagen", "Denmark", 55.62, 12.66],
  ["ARN", "Stockholm", "Sweden", 59.65, 17.92],
  ["OSL", "Oslo", "Norway", 60.19, 11.1],
  ["HEL", "Helsinki", "Finland", 60.32, 24.96],
  ["KEF", "Reykjavik", "Iceland", 63.99, -22.62],
  ["WAW", "Warsaw", "Poland", 52.17, 20.97],
  ["PRG", "Prague", "Czech Republic", 50.1, 14.26],
  ["BUD", "Budapest", "Hungary", 47.44, 19.26],
  ["SVO", "Moscow", "Russia", 55.97, 37.41],
  ["LED", "St. Petersburg", "Russia", 59.8, 30.26],
  // East & South-East Asia
  ["PEK", "Beijing", "China", 40.08, 116.58],
  ["PVG", "Shanghai", "China", 31.14, 121.81],
  ["CAN", "Guangzhou", "China", 23.39, 113.3],
  ["SZX", "Shenzhen", "China", 22.64, 113.81],
  ["HKG", "Hong Kong", "China", 22.31, 113.91],
  ["TPE", "Taipei", "Taiwan", 25.08, 121.23],
  ["ICN", "Seoul", "South Korea", 37.46, 126.44],
  ["NRT", "Tokyo (Narita)", "Japan", 35.77, 140.39],
  ["HND", "Tokyo (Haneda)", "Japan", 35.55, 139.78],
  ["KIX", "Osaka", "Japan", 34.43, 135.24],
  ["SIN", "Singapore", "Singapore", 1.36, 103.99],
  ["KUL", "Kuala Lumpur", "Malaysia", 2.75, 101.71],
  ["BKK", "Bangkok", "Thailand", 13.69, 100.75],
  ["HKT", "Phuket", "Thailand", 8.11, 98.31],
  ["SGN", "Ho Chi Minh City", "Vietnam", 10.82, 106.66],
  ["HAN", "Hanoi", "Vietnam", 21.2, 105.8],
  ["CGK", "Jakarta", "Indonesia", -6.13, 106.66],
  ["DPS", "Bali (Denpasar)", "Indonesia", -8.75, 115.17],
  ["MNL", "Manila", "Philippines", 14.51, 121.02],
  ["CEB", "Cebu", "Philippines", 10.31, 123.98],
  // South Asia
  ["DAC", "Dhaka", "Bangladesh", 23.84, 90.4],
  ["CMB", "Colombo", "Sri Lanka", 7.17, 79.88],
  ["KTM", "Kathmandu", "Nepal", 27.7, 85.36],
  // Oceania
  ["SYD", "Sydney", "Australia", -33.94, 151.18],
  ["MEL", "Melbourne", "Australia", -37.67, 144.84],
  ["BNE", "Brisbane", "Australia", -27.38, 153.12],
  ["PER", "Perth", "Australia", -31.94, 115.97],
  ["AKL", "Auckland", "New Zealand", -37.01, 174.79],
  ["CHC", "Christchurch", "New Zealand", -43.49, 172.53],
  ["NAN", "Nadi", "Fiji", -17.76, 177.44],
  // Africa
  ["JNB", "Johannesburg", "South Africa", -26.14, 28.25],
  ["CPT", "Cape Town", "South Africa", -33.97, 18.6],
  ["NBO", "Nairobi", "Kenya", -1.32, 36.93],
  ["CAI", "Cairo", "Egypt", 30.12, 31.41],
  ["CMN", "Casablanca", "Morocco", 33.37, -7.59],
  ["ADD", "Addis Ababa", "Ethiopia", 8.98, 38.8],
  ["ACC", "Accra", "Ghana", 5.61, -0.17],
  ["LOS", "Lagos", "Nigeria", 6.58, 3.32],
  // North America
  ["JFK", "New York (JFK)", "USA", 40.64, -73.78],
  ["EWR", "Newark", "USA", 40.69, -74.17],
  ["BOS", "Boston", "USA", 42.36, -71.01],
  ["IAD", "Washington (Dulles)", "USA", 38.95, -77.46],
  ["ORD", "Chicago (O'Hare)", "USA", 41.98, -87.9],
  ["MIA", "Miami", "USA", 25.79, -80.29],
  ["ATL", "Atlanta", "USA", 33.64, -84.44],
  ["DFW", "Dallas–Fort Worth", "USA", 32.9, -97.04],
  ["IAH", "Houston", "USA", 29.98, -95.34],
  ["DEN", "Denver", "USA", 39.86, -104.67],
  ["LAX", "Los Angeles", "USA", 33.94, -118.41],
  ["SFO", "San Francisco", "USA", 37.62, -122.38],
  ["SEA", "Seattle", "USA", 47.45, -122.31],
  ["LAS", "Las Vegas", "USA", 36.08, -115.15],
  ["PHX", "Phoenix", "USA", 33.43, -112.01],
  ["MCO", "Orlando", "USA", 28.43, -81.31],
  ["TPA", "Tampa", "USA", 27.98, -82.53],
  ["MSP", "Minneapolis", "USA", 44.88, -93.22],
  ["DTW", "Detroit", "USA", 42.21, -83.35],
  ["PHL", "Philadelphia", "USA", 39.87, -75.24],
  ["CLT", "Charlotte", "USA", 35.21, -80.94],
  ["SLC", "Salt Lake City", "USA", 40.79, -111.98],
  ["HNL", "Honolulu", "USA", 21.32, -157.92],
  ["ANC", "Anchorage", "USA", 61.17, -149.99],
  ["YVR", "Vancouver", "Canada", 49.19, -123.18],
  ["YYZ", "Toronto", "Canada", 43.68, -79.63],
  ["YUL", "Montreal", "Canada", 45.47, -73.74],
  ["YYC", "Calgary", "Canada", 51.11, -114.02],
  ["MEX", "Mexico City", "Mexico", 19.44, -99.07],
  ["CUN", "Cancún", "Mexico", 21.04, -86.87],
  ["PTY", "Panama City", "Panama", 9.07, -79.38],
  ["HAV", "Havana", "Cuba", 22.99, -82.41],
  // South America
  ["GRU", "São Paulo", "Brazil", -23.43, -46.47],
  ["GIG", "Rio de Janeiro", "Brazil", -22.81, -43.25],
  ["EZE", "Buenos Aires", "Argentina", -34.82, -58.54],
  ["SCL", "Santiago", "Chile", -33.39, -70.79],
  ["LIM", "Lima", "Peru", -12.02, -77.11],
  ["BOG", "Bogotá", "Colombia", 4.7, -74.15],
];

export interface Airport {
  code: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
}

export const AIRPORTS: Airport[] = AIRPORT_ROWS.map(
  ([code, city, country, lat, lon]) => ({ code, city, country, lat, lon }),
).sort((a, b) => a.code.localeCompare(b.code));

export function findAirport(code: string): Airport | undefined {
  return AIRPORTS.find((a) => a.code === code);
}

export function airportLabel(airport: Airport): string {
  return `${airport.code} — ${airport.city}, ${airport.country}`;
}

/** Great-circle distance between two IATA codes, in km. */
export function flightDistanceKm(fromCode: string, toCode: string): number {
  const from = findAirport(fromCode);
  const to = findAirport(toCode);
  if (!from || !to || from.code === to.code) return 0;
  const rad = Math.PI / 180;
  const dLat = (to.lat - from.lat) * rad;
  const dLon = (to.lon - from.lon) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(from.lat * rad) * Math.cos(to.lat * rad) * Math.sin(dLon / 2) ** 2;
  const clamped = Math.min(1, Math.max(0, a));
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(clamped), Math.sqrt(1 - clamped)));
}

/* ── Flights ─────────────────────────────────────────────────────────────── */

export type FlightClass = "economy" | "premium" | "business" | "first";
export type Haul = "short" | "medium" | "long";

export const FLIGHT_CLASSES: Array<{ id: FlightClass; label: string }> = [
  { id: "economy", label: "Economy" },
  { id: "premium", label: "Premium Economy" },
  { id: "business", label: "Business" },
  { id: "first", label: "First" },
];

/** kg CO₂e per passenger-km by haul band (DESNZ/DEFRA 2024-style). */
export const FLIGHT_FACTORS: Record<Haul, Record<FlightClass, number>> = {
  short: { economy: 0.133, premium: 0.2, business: 0.4, first: 0.53 },
  medium: { economy: 0.145, premium: 0.22, business: 0.43, first: 0.6 },
  long: { economy: 0.148, premium: 0.225, business: 0.43, first: 0.55 },
};

export function classifyHaul(km: number): Haul {
  if (km <= 0) return "short";
  if (km < 1500) return "short";
  if (km <= 3700) return "medium";
  return "long";
}

export function haulLabel(haul: Haul): string {
  return haul === "short" ? "Short-haul" : haul === "medium" ? "Medium-haul" : "Long-haul";
}

export interface FlightLeg {
  id: number;
  from: string;
  to: string;
}

export interface FlightInputs {
  legs: FlightLeg[];
  /** "one" = one-way, "round" = return journey. */
  direction: "one" | "round";
  flightClass: FlightClass;
  passengers: number;
}

/** Total flight emissions in kg CO₂e for all legs. */
export function computeFlight(inputs: FlightInputs): { kg: number; km: number } {
  const mult = inputs.direction === "round" ? 2 : 1;
  let km = 0;
  let kg = 0;
  for (const leg of inputs.legs) {
    const distance = flightDistanceKm(leg.from, leg.to);
    const factor = FLIGHT_FACTORS[classifyHaul(distance)][inputs.flightClass];
    km += distance * mult;
    kg += distance * mult * factor * Math.max(1, inputs.passengers);
  }
  return { kg, km };
}

/* ── Private jets ────────────────────────────────────────────────────────── */

export interface JetType {
  id: string;
  label: string;
  /** Average fuel burn, US gallons per hour. */
  gallonsPerHour: number;
}

/** US EIA 2024: 9.75 kg CO₂e per gallon of jet fuel burnt. */
export const JET_FUEL_FACTOR = 9.75;

export const JET_TYPES: JetType[] = [
  { id: "light", label: "Light jet — Citation CJ3 class", gallonsPerHour: 120 },
  { id: "mid", label: "Midsize jet — Citation XLS class", gallonsPerHour: 165 },
  { id: "supermid", label: "Super-midsize — Challenger 350 class", gallonsPerHour: 230 },
  { id: "heavy", label: "Heavy jet — Gulfstream G450 class", gallonsPerHour: 340 },
  { id: "ultra", label: "Ultra-long-range — Gulfstream G650 class", gallonsPerHour: 480 },
  { id: "global", label: "Large cabin — Global 7500 class", gallonsPerHour: 550 },
  { id: "bbj", label: "VIP airliner — BBJ 737 class", gallonsPerHour: 850 },
];

export interface JetInputs {
  jetTypeId: string;
  hours: number;
}

export function computeJet(inputs: JetInputs): number {
  const jet = JET_TYPES.find((j) => j.id === inputs.jetTypeId) ?? JET_TYPES[0];
  return Math.max(0, inputs.hours) * jet.gallonsPerHour * JET_FUEL_FACTOR;
}

/* ── Hotels ──────────────────────────────────────────────────────────────── */

/** CHSB-style kg CO₂e per room-night for a 3-star stay, by country. */
const HOTEL_BASE: Record<string, number> = {
  "United States": 22, Canada: 18, Mexico: 15, Brazil: 14, Argentina: 12,
  Chile: 12, Peru: 12, Colombia: 11, "United Kingdom": 15, France: 12,
  Germany: 15, Spain: 13, Italy: 14, Portugal: 11, Netherlands: 15,
  Belgium: 15, Switzerland: 16, Austria: 14, Sweden: 10, Norway: 12,
  Denmark: 12, Finland: 12, Ireland: 14, Poland: 11, "Czech Republic": 11,
  Hungary: 10, Greece: 13, Turkey: 14, Russia: 14, Iceland: 12,
  UAE: 40, "Saudi Arabia": 35, Qatar: 38, Egypt: 15, Morocco: 12,
  "South Africa": 14, Kenya: 10, Nigeria: 9, Ghana: 9, Ethiopia: 8,
  India: 18, Indonesia: 25, Thailand: 16, Vietnam: 13, Malaysia: 17,
  Singapore: 30, "Hong Kong": 27, China: 24, Japan: 20,
  "South Korea": 19, Taiwan: 19, Philippines: 12, "Sri Lanka": 11,
  Bangladesh: 10, Nepal: 9, Maldives: 45, Australia: 17,
  "New Zealand": 13, Fiji: 18,
};

export const HOTEL_DEFAULT_BASE = 20;

/** Destinations with CHSB-based hotel factors (plus a world default). */
export const HOTEL_COUNTRIES = Object.keys(HOTEL_BASE).sort();

/** Star-rating multipliers applied to the country base. */
export const HOTEL_STARS: Array<{ stars: number; mult: number }> = [
  { stars: 2, mult: 0.7 },
  { stars: 3, mult: 1 },
  { stars: 4, mult: 1.45 },
  { stars: 5, mult: 2.1 },
];

export interface HotelInputs {
  country: string;
  stars: number;
  rooms: number;
  nights: number;
}

export function hotelFactorPerNight(country: string, stars: number): number {
  const base = HOTEL_BASE[country] ?? HOTEL_DEFAULT_BASE;
  const mult = HOTEL_STARS.find((s) => s.stars === stars)?.mult ?? 1;
  return base * mult;
}

export function computeHotel(inputs: HotelInputs): number {
  return (
    hotelFactorPerNight(inputs.country, inputs.stars) *
    Math.max(0, inputs.rooms) *
    Math.max(0, inputs.nights)
  );
}

/* ── Boats ───────────────────────────────────────────────────────────────── */

export interface CruiseType {
  id: string;
  label: string;
  /** kg CO₂e per passenger per day (EMSA-derived benchmark band 189–561). */
  kgPerPaxDay: number;
}

export const CRUISE_TYPES: CruiseType[] = [
  { id: "river", label: "River cruise", kgPerPaxDay: 140 },
  { id: "main", label: "Mainstream cruise ship", kgPerPaxDay: 250 },
  { id: "premium", label: "Premium / luxury cruise", kgPerPaxDay: 450 },
  { id: "liveaboard", label: "Liveaboard", kgPerPaxDay: 550 },
];

export interface BoatFuel {
  id: string;
  label: string;
  /** kg CO₂e per litre burnt. */
  kgPerLitre: number;
}

export const BOAT_FUELS: BoatFuel[] = [
  { id: "petrol", label: "Petrol / gasoline", kgPerLitre: 0.62 },
  { id: "diesel", label: "Diesel", kgPerLitre: 0.72 },
  { id: "bio", label: "Biodiesel blend", kgPerLitre: 0.55 },
];

/** Engine power options for private boats; burn ≈ 0.22 L per hp per hour. */
export const ENGINE_HP = [25, 50, 100, 200, 300, 500];

export interface BoatInputs {
  /** "cruise" = per-day benchmark, "private" = engine burn model. */
  mode: "cruise" | "private";
  cruiseTypeId: string;
  days: number;
  passengers: number;
  engineHp: number;
  hours: number;
  fuelId: string;
}

export function computeBoat(inputs: BoatInputs): number {
  if (inputs.mode === "cruise") {
    const cruise = CRUISE_TYPES.find((c) => c.id === inputs.cruiseTypeId) ?? CRUISE_TYPES[1];
    return cruise.kgPerPaxDay * Math.max(0, inputs.days) * Math.max(1, inputs.passengers);
  }
  const fuel = BOAT_FUELS.find((f) => f.id === inputs.fuelId) ?? BOAT_FUELS[0];
  const litresPerHour = inputs.engineHp * 0.22;
  return litresPerHour * Math.max(0, inputs.hours) * fuel.kgPerLitre;
}

/* ── Cars ────────────────────────────────────────────────────────────────── */

export interface CarType {
  id: string;
  label: string;
}

export const CAR_TYPES: CarType[] = [
  { id: "standard", label: "Standard car" },
  { id: "luxury", label: "Luxury car" },
  { id: "suv", label: "SUV" },
  { id: "van", label: "Van / MPV" },
  { id: "moto", label: "Motorcycle" },
];

export const CAR_FUELS: CarType[] = [
  { id: "petrol", label: "Petrol" },
  { id: "diesel", label: "Diesel" },
  { id: "hybrid", label: "Hybrid" },
  { id: "electric", label: "Electric" },
];

/** kg CO₂e per km for the whole vehicle (0.11–0.20 band). */
const CAR_FACTORS: Record<string, Record<string, number>> = {
  standard: { petrol: 0.18, diesel: 0.17, hybrid: 0.11, electric: 0.05 },
  luxury: { petrol: 0.2, diesel: 0.19, hybrid: 0.13, electric: 0.06 },
  suv: { petrol: 0.2, diesel: 0.19, hybrid: 0.13, electric: 0.06 },
  van: { petrol: 0.19, diesel: 0.18, hybrid: 0.12, electric: 0.06 },
  moto: { petrol: 0.11, diesel: 0.11, hybrid: 0.11, electric: 0.02 },
};

export interface CarInputs {
  carTypeId: string;
  fuelId: string;
  /** One-way distance in km. */
  km: number;
  direction: "one" | "round";
  occupants: number;
}

export function carFactorPerKm(carTypeId: string, fuelId: string): number {
  return CAR_FACTORS[carTypeId]?.[fuelId] ?? 0.18;
}

export function computeCar(inputs: CarInputs): { vehicleKg: number; perPersonKg: number } {
  const mult = inputs.direction === "round" ? 2 : 1;
  const vehicleKg =
    carFactorPerKm(inputs.carTypeId, inputs.fuelId) * Math.max(0, inputs.km) * mult;
  const occupants = Math.max(1, inputs.occupants);
  return { vehicleKg, perPersonKg: vehicleKg / occupants };
}

/* ── Formatting ──────────────────────────────────────────────────────────── */

/** Format kg as tonnes when ≥ 1,000 kg, otherwise kg. */
export function formatCo2(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(2)} t`;
  return `${kg.toFixed(kg >= 100 ? 0 : 1)} kg`;
}
