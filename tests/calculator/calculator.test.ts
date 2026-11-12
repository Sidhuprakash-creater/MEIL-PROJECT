// MEIL ESG Platform — Calculator domain unit tests.
// Covers the expression engine, business/personal carbon footprint model,
// and travel carbon footprint engine. Runs offline with no DB or network.

import { describe, expect, it } from "bun:test";
import { evaluate, evaluateLoose, formatResult, type EngineState } from "../../src/lib/calculator/engine";
import {
  BUSINESS_FUELS,
  GRID_ELECTRICITY_FACTOR,
  computeBusiness,
  computePersonal,
} from "../../src/lib/calculator/carbon";
import {
  AIRPORTS,
  HOTEL_COUNTRIES,
  classifyHaul,
  computeBoat,
  computeCar,
  computeFlight,
  computeJet,
  flightDistanceKm,
  formatCo2,
  hotelFactorPerNight,
} from "../../src/lib/calculator/travel";

const DEG: EngineState = { mode: "deg", second: false };
const RAD: EngineState = { mode: "rad", second: false };

describe("calculator expression engine", () => {
  it("handles precedence, implicit multiplication, and powers cleanly", () => {
    expect(evaluate("2+3*4", DEG)).toBe(14);
    expect(evaluate("2(3+4)", DEG)).toBe(14);
    expect(evaluate("2π", DEG)).toBeCloseTo(2 * Math.PI, 10);
    expect(evaluate("-2^2", DEG)).toBe(-4);
    expect(evaluate("2^-2", DEG)).toBeCloseTo(0.25, 10);
    expect(evaluate("5!+10%", DEG)).toBeCloseTo(120.1, 10);
  });

  it("switches trig functions cleanly between deg and rad", () => {
    expect(evaluate("sin(90)", DEG)).toBeCloseTo(1, 10);
    expect(evaluate("asin(1)", DEG)).toBeCloseTo(90, 10);
    expect(evaluate("sin(π/2)", RAD)).toBeCloseTo(1, 10);
  });

  it("auto-closes parentheses for loose previews and throws on malformed input", () => {
    expect(evaluateLoose("2×(3+4", DEG)).toBe(14);
    expect(() => evaluate("2+*", DEG)).toThrow();
    expect(formatResult(1234.5)).toBe("1,234.5");
    expect(formatResult(Infinity)).toBe("Error");
  });
});

describe("carbon footprint calculator model", () => {
  it("resolves every business fuel emission factor cleanly from the registry", () => {
    expect(GRID_ELECTRICITY_FACTOR).toBeGreaterThan(0);
    for (const fuel of BUSINESS_FUELS) {
      expect(fuel.factor).toBeGreaterThan(0);
      expect(fuel.pngRatio).toBeGreaterThan(0);
      expect(fuel.pngRatio).toBeLessThanOrEqual(1);
    }
  });

  it("computes monthly business emissions and PNG switching savings", () => {
    const diesel = BUSINESS_FUELS.find((f) => f.id === "diesel")!;
    const out = computeBusiness({
      fuels: [{ fuelId: "diesel", quantity: 100 }],
      electricity: 1000,
      appliances: [{ name: "Fan", count: 2, hours: 10, watts: 50 }],
    });
    const expectedApplianceKwh = (2 * 50 * 10 * 30) / 1000; // 30 kWh
    expect(out.fromFuel).toBeCloseTo(100 * diesel.factor, 6);
    expect(out.fromElectricity).toBeCloseTo((1000 + expectedApplianceKwh) * GRID_ELECTRICITY_FACTOR, 6);
    expect(out.afterPng).toBeLessThan(out.total);
    expect(out.reductionPct).toBeGreaterThan(0);
  });

  it("computes annual personal footprint with household sharing and renewables", () => {
    const out = computePersonal({
      country: "India",
      household: 4,
      kwh: 2000,
      renewablePct: 50,
      lng: 0,
      coal: 0,
      coke: 0,
      air: 1000,
      rail: 0,
      metro: 0,
      bus: 0,
      ebus: 0,
      cab: 0,
      ecab: 0,
      petrol: 0,
      diesel: 0,
      lpg: 0,
      mealIndex: 1,
    });
    expect(out.electricity).toBeCloseTo((2000 * 0.5 * 0.82) / 4, 6);
    expect(out.travel).toBeCloseTo(121, 6);
    expect(out.total).toBeCloseTo((out.electricity + out.travel + out.meals) / 1000, 6);
  });
});

describe("travel footprint calculator model", () => {
  it("exposes unique IATA airports and symmetric great-circle distances", () => {
    const codes = AIRPORTS.map((a) => a.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(flightDistanceKm("DEL", "DEL")).toBe(0);
    const delDxb = flightDistanceKm("DEL", "DXB");
    expect(delDxb).toBeGreaterThan(2000);
    expect(flightDistanceKm("DXB", "DEL")).toBe(delDxb);
    expect(classifyHaul(delDxb)).toBe("medium");
  });

  it("doubles round-trip distance/emissions vs one-way", () => {
    const oneWay = computeFlight({
      legs: [{ id: 1, from: "DEL", to: "DXB" }],
      direction: "one",
      flightClass: "economy",
      passengers: 2,
    });
    const round = computeFlight({
      legs: [{ id: 1, from: "DEL", to: "DXB" }],
      direction: "round",
      flightClass: "economy",
      passengers: 2,
    });
    expect(round.km).toBe(oneWay.km * 2);
    expect(round.kg).toBeCloseTo(oneWay.kg * 2, 6);
  });

  it("uses valid hotel countries including UAE and splits car emissions by occupants", () => {
    expect(HOTEL_COUNTRIES).toContain("UAE");
    expect(hotelFactorPerNight("UAE", 5)).toBeCloseTo(40 * 2.1, 6);

    expect(computeJet({ jetTypeId: "light", hours: 2 })).toBeCloseTo(2 * 120 * 9.75, 6);
    expect(
      computeBoat({
        mode: "cruise",
        cruiseTypeId: "main",
        days: 2,
        passengers: 3,
        engineHp: 100,
        hours: 0,
        fuelId: "diesel",
      }),
    ).toBe(250 * 2 * 3);

    const car = computeCar({ carTypeId: "standard", fuelId: "petrol", km: 100, direction: "round", occupants: 4 });
    expect(car.vehicleKg).toBeCloseTo(0.18 * 200, 6);
    expect(car.perPersonKg).toBeCloseTo(car.vehicleKg / 4, 6);
    expect(formatCo2(4372)).toBe("4.37 t");
  });
});
