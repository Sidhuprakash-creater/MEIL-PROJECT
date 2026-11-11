"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   MEIL ESG Platform — Carbon footprint calculator

   Two segments inside the calculator dock:
     • Business — monthly Scope 1 + 2 footprint, with the saving from moving
       every fuel to piped natural gas.
     • Personal — annual household footprint against country/world averages.

   Emission factors come from the platform registry
   (`@/components/shared/emission-factor-info`) so these numbers stay
   consistent with the rest of the ESG workspace.
   ═══════════════════════════════════════════════════════════════════════════ */

import * as React from "react";
import {
  APPLIANCE_CATEGORIES,
  BUSINESS_FUELS,
  COUNTRIES,
  GRID_ELECTRICITY_FACTOR,
  MEAL_OPTIONS,
  PERSONAL_FACTORS,
  REDUCTION_TIPS,
  computeBusiness,
  computePersonal,
  factorScope,
  factorSource,
  formatKg,
  type ApplianceUsage,
  type BusinessInputs,
  type BusinessResult,
  type FuelEntry,
  type PersonalInputs,
  type PersonalResult,
} from "@/lib/calculator/carbon";
import { apiPost } from "@/lib/esg/client";
import { useToast } from "@/hooks/use-toast";

export interface CarbonCalculatorProps {
  /** "biz" = business footprint, "per" = personal footprint. */
  segment: "biz" | "per";
}

/* ── Business segment ────────────────────────────────────────────────────── */

function BusinessFootprint() {
  const [fuels, setFuels] = React.useState<FuelEntry[]>([{ fuelId: BUSINESS_FUELS[0].id, quantity: 0 }]);
  const [electricity, setElectricity] = React.useState(0);
  const [category, setCategory] = React.useState<string>(Object.keys(APPLIANCE_CATEGORIES)[0]);
  const [extraAppliances, setExtraAppliances] = React.useState<string[]>([]);

  /** Usage state for every appliance across every category. */
  const [usage, setUsage] = React.useState<Record<string, ApplianceUsage>>(() => {
    const seed: Record<string, ApplianceUsage> = {};
    for (const list of Object.values(APPLIANCE_CATEGORIES)) {
      for (const appliance of list) {
        seed[appliance.name] = { name: appliance.name, count: 0, hours: 0, watts: appliance.watts };
      }
    }
    return seed;
  });

  const appliances = React.useMemo(() => Object.values(usage), [usage]);

  const inputs: BusinessInputs = React.useMemo(
    () => ({ fuels, electricity, appliances }),
    [fuels, electricity, appliances],
  );

  const result: BusinessResult = React.useMemo(() => computeBusiness(inputs), [inputs]);

  const setFuelQuantity = (index: number, quantity: number) =>
    setFuels((prev) => prev.map((f, i) => (i === index ? { ...f, quantity } : f)));

  const setFuelType = (index: number, fuelId: string) =>
    setFuels((prev) => prev.map((f, i) => (i === index ? { ...f, fuelId } : f)));

  const setAppliance = (name: string, patch: Partial<ApplianceUsage>) =>
    setUsage((prev) => ({ ...prev, [name]: { ...prev[name], ...patch } }));

  const addFuel = () => setFuels((prev) => [...prev, { fuelId: BUSINESS_FUELS[0].id, quantity: 0 }]);

  const addExtraAppliance = () => {
    const name = `Others ${extraAppliances.length + 1}`;
    setExtraAppliances((prev) => [...prev, name]);
    setUsage((prev) => ({ ...prev, [name]: { name, count: 0, hours: 0, watts: 0 } }));
  };

  const categoryList = React.useMemo(() => {
    const base = APPLIANCE_CATEGORIES[category] ?? [];
    if (category !== Object.keys(APPLIANCE_CATEGORIES)[0]) return base;
    return [...base, ...extraAppliances.map((name) => ({ name, watts: 0 }))];
  }, [category, extraAppliances]);

  return (
    <div>
      <h2 className="mcalc-card-title" style={{ fontSize: 14, marginBottom: 4 }}>
        Carbon footprint of your business
      </h2>

      {/* ── Fuel consumption ── */}
      <section style={{ marginTop: 12 }}>
        <h3 className="mcalc-card-title">Fuel consumption per month</h3>
        {fuels.map((entry, index) => {
          const fuel = BUSINESS_FUELS.find((f) => f.id === entry.fuelId) ?? BUSINESS_FUELS[0];
          const emitted = entry.quantity * fuel.factor;
          return (
            <div key={index} className="mcalc-card" style={{ marginBottom: 8 }}>
              <div className="mcalc-grid-2">
                <div className="mcalc-field-row">
                  <label className="mcalc-label" htmlFor={`mcalc-fuel-${index}`}>Fuel type</label>
                  <select
                    id={`mcalc-fuel-${index}`}
                    className="mcalc-select"
                    value={entry.fuelId}
                    onChange={(e) => setFuelType(index, e.target.value)}
                  >
                    {BUSINESS_FUELS.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
                <div className="mcalc-field-row">
                  <label className="mcalc-label" htmlFor={`mcalc-fuel-qty-${index}`}>Quantity (kg / month)</label>
                  <input
                    id={`mcalc-fuel-qty-${index}`}
                    className="mcalc-input"
                    type="number"
                    min={0}
                    inputMode="decimal"
                    value={entry.quantity || ""}
                    onChange={(e) => setFuelQuantity(index, Math.max(0, Number(e.target.value) || 0))}
                    placeholder="0"
                  />
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginTop: 8 }}>
                <span className="mcalc-label">Emissions ({fuel.factor} kg CO₂e/kg)</span>
                <span className="mcalc-out">{formatKg(emitted)} kg CO₂e</span>
              </div>
              {index > 0 ? (
                <button
                  type="button"
                  className="mcalc-action"
                  style={{ marginTop: 8, padding: "5px 10px", fontSize: 11 }}
                  onClick={() => setFuels((prev) => prev.filter((_, i) => i !== index))}
                >
                  Remove this fuel
                </button>
              ) : null}
            </div>
          );
        })}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="mcalc-action" onClick={addFuel}>+ Add another fuel</button>
        </div>
      </section>

      {/* ── Electricity ── */}
      <section style={{ marginTop: 16 }}>
        <h3 className="mcalc-card-title">Electricity consumption per month</h3>
        <div className="mcalc-card">
          <div className="mcalc-grid-2">
            <div className="mcalc-field-row">
              <label className="mcalc-label" htmlFor="mcalc-elec">Total consumption (kWh)</label>
              <input
                id="mcalc-elec"
                className="mcalc-input"
                type="number"
                min={0}
                inputMode="decimal"
                value={electricity || ""}
                onChange={(e) => setElectricity(Math.max(0, Number(e.target.value) || 0))}
                placeholder="0"
              />
            </div>
            <div className="mcalc-field-row">
              <span className="mcalc-label">Emissions (kg CO₂e)</span>
              <span className="mcalc-out">{formatKg(electricity * GRID_ELECTRICITY_FACTOR)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Appliances ── */}
      <section style={{ marginTop: 16 }}>
        <h3 className="mcalc-card-title">Appliance category</h3>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {Object.keys(APPLIANCE_CATEGORIES).map((key) => (
            <button
              key={key}
              type="button"
              className="mcalc-chip"
              style={{ flex: "0 1 auto" }}
              aria-pressed={category === key}
              onClick={() => setCategory(key)}
            >
              {key}
            </button>
          ))}
        </div>
        {categoryList.map((appliance) => {
          const usageEntry = usage[appliance.name] ?? { name: appliance.name, count: 0, hours: 0, watts: appliance.watts };
          const kWh = (usageEntry.count * usageEntry.watts * usageEntry.hours * 30) / 1000;
          return (
            <div key={appliance.name} className="mcalc-card" style={{ marginBottom: 8 }}>
              <h4 style={{ margin: "0 0 8px", fontSize: 12.5, fontWeight: 800 }}>{appliance.name}</h4>
              <div className="mcalc-grid-2">
                <div className="mcalc-field-row">
                  <label className="mcalc-label" htmlFor={`mcalc-w-${appliance.name}`}>Load (watts)</label>
                  <input
                    id={`mcalc-w-${appliance.name}`}
                    className="mcalc-input"
                    type="number"
                    min={0}
                    inputMode="decimal"
                    value={usageEntry.watts || ""}
                    onChange={(e) => setAppliance(appliance.name, { watts: Math.max(0, Number(e.target.value) || 0) })}
                    placeholder={String(appliance.watts || 0)}
                  />
                </div>
                <div className="mcalc-field-row">
                  <span className="mcalc-label">No. of appliances</span>
                  <div className="mcalc-stepper">
                    <button
                      type="button"
                      aria-label={`Fewer ${appliance.name}`}
                      onClick={() => setAppliance(appliance.name, { count: Math.max(0, usageEntry.count - 1) })}
                    >
                      −
                    </button>
                    <b>{usageEntry.count}</b>
                    <button
                      type="button"
                      aria-label={`More ${appliance.name}`}
                      onClick={() => setAppliance(appliance.name, { count: usageEntry.count + 1 })}
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="mcalc-field-row">
                  <label className="mcalc-label" htmlFor={`mcalc-h-${appliance.name}`}>Usage (hrs/day)</label>
                  <input
                    id={`mcalc-h-${appliance.name}`}
                    className="mcalc-input"
                    type="number"
                    min={0}
                    max={24}
                    step="any"
                    inputMode="decimal"
                    value={usageEntry.hours || ""}
                    onChange={(e) => setAppliance(appliance.name, { hours: Math.min(24, Math.max(0, Number(e.target.value) || 0)) })}
                    placeholder="0"
                  />
                </div>
                <div className="mcalc-field-row">
                  <span className="mcalc-label">Emissions (kg CO₂e)</span>
                  <span className="mcalc-out">{formatKg(kWh * GRID_ELECTRICITY_FACTOR)}</span>
                </div>
              </div>
            </div>
          );
        })}
        <button type="button" className="mcalc-action" onClick={addExtraAppliance}>+ Add another</button>
      </section>

      {/* ── Result ── */}
      <section className="mcalc-card" style={{ marginTop: 16 }}>
        <h3 className="mcalc-card-title">Your carbon footprint</h3>
        <p className="mcalc-big">
          {formatKg(result.total)} <small>kg CO₂e / month</small>
        </p>
        <h3 className="mcalc-card-title" style={{ marginTop: 12 }}>Switching to piped natural gas</h3>
        <p className="mcalc-big">
          {formatKg(result.afterPng)} <small>kg CO₂e / month</small>
        </p>
        <div className="mcalc-meter" style={{ marginTop: 8 }}>
          <i style={{ width: `${Math.min(100, Math.max(0, result.reductionPct))}%` }} />
        </div>
        <p style={{ margin: "8px 0 0", fontSize: 12.5 }}>
          Reduce CO₂ by <b style={{ color: "var(--mcalc-blue)" }}>{result.reductionPct.toFixed(1)}%</b>
        </p>
        <p className="mcalc-note" style={{ marginTop: 6 }}>
          Fuel {formatKg(result.fromFuel)} kg · Electricity &amp; appliances {formatKg(result.fromElectricity)} kg
        </p>
        <p className="mcalc-note" style={{ marginTop: 6 }}>
          Grid factor {GRID_ELECTRICITY_FACTOR} kg CO₂e/kWh — {factorSource("Grid Electricity")} ({factorScope("Grid Electricity")}).
          Approximate, for reference only.
        </p>
      </section>

      <SupportRequest total={result.total} afterPng={result.afterPng} />
    </div>
  );
}

/* ── Personal segment ────────────────────────────────────────────────────── */

const PERSONAL_FIELDS: Array<{
  key: keyof PersonalInputs;
  label: string;
  unit: string;
  factor?: string;
}> = [
  { key: "kwh", label: "Units used in a year", unit: "kWh" },
  { key: "renewablePct", label: "Share from renewable sources", unit: "%" },
  { key: "lng", label: "LNG / CNG", unit: "kg", factor: `${PERSONAL_FACTORS.lng} kg CO₂e per kg` },
  { key: "coal", label: "Coal", unit: "kg", factor: `${PERSONAL_FACTORS.coal} kg CO₂e per kg` },
  { key: "coke", label: "Coke", unit: "kg", factor: `${PERSONAL_FACTORS.coke} kg CO₂e per kg` },
  { key: "air", label: "Air travel", unit: "km", factor: `${PERSONAL_FACTORS.air} kg CO₂e per km` },
  { key: "rail", label: "Rail travel", unit: "km", factor: `${PERSONAL_FACTORS.rail} kg CO₂e per km` },
  { key: "metro", label: "Metro travel", unit: "km", factor: `${PERSONAL_FACTORS.metro} kg CO₂e per km` },
  { key: "bus", label: "Bus travel", unit: "km", factor: `${PERSONAL_FACTORS.bus} kg CO₂e per km` },
  { key: "ebus", label: "Electric bus travel", unit: "km", factor: `${PERSONAL_FACTORS.ebus} kg CO₂e per km` },
  { key: "cab", label: "Cab / taxi travel", unit: "km", factor: `${PERSONAL_FACTORS.cab} kg CO₂e per km` },
  { key: "ecab", label: "Electric cab / taxi travel", unit: "km", factor: `${PERSONAL_FACTORS.ecab} kg CO₂e per km` },
  { key: "petrol", label: "Petrol", unit: "litres", factor: `${PERSONAL_FACTORS.petrol} kg CO₂e per litre` },
  { key: "diesel", label: "Diesel", unit: "litres", factor: `${PERSONAL_FACTORS.diesel} kg CO₂e per litre` },
  { key: "lpg", label: "LPG / CNG", unit: "litres", factor: `${PERSONAL_FACTORS.lpg} kg CO₂e per litre` },
];

function PersonalFootprint() {
  const [inputs, setInputs] = React.useState<PersonalInputs>({
    country: "India",
    household: 1,
    kwh: 0,
    renewablePct: 0,
    lng: 0,
    coal: 0,
    coke: 0,
    air: 0,
    rail: 0,
    metro: 0,
    bus: 0,
    ebus: 0,
    cab: 0,
    ecab: 0,
    petrol: 0,
    diesel: 0,
    lpg: 0,
    mealIndex: null,
  });

  const result: PersonalResult = React.useMemo(() => computePersonal(inputs), [inputs]);

  const setNumber = (key: keyof PersonalInputs, value: number) =>
    setInputs((prev) => ({ ...prev, [key]: value }));

  return (
    <div>
      <h2 className="mcalc-card-title" style={{ fontSize: 14, marginBottom: 4 }}>Your personal carbon footprint</h2>

      <div className="mcalc-card" style={{ marginTop: 10 }}>
        <div className="mcalc-field-row">
          <label className="mcalc-label" htmlFor="mcalc-country">Country</label>
          <select
            id="mcalc-country"
            className="mcalc-select"
            value={inputs.country}
            onChange={(e) => setInputs((prev) => ({ ...prev, country: e.target.value }))}
          >
            {COUNTRIES.map((country) => (
              <option key={country} value={country}>{country}</option>
            ))}
          </select>
        </div>
        <div className="mcalc-field-row" style={{ marginTop: 10 }}>
          <span className="mcalc-label">People in your household</span>
          <div className="mcalc-stepper">
            <button type="button" aria-label="Fewer people" onClick={() => setNumber("household", Math.max(1, inputs.household - 1))}>−</button>
            <b>{inputs.household}</b>
            <button type="button" aria-label="More people" onClick={() => setNumber("household", Math.min(20, inputs.household + 1))}>+</button>
          </div>
        </div>
      </div>

      {PERSONAL_FIELDS.map((field) => {
        const value = inputs[field.key] as number;
        return (
          <div key={String(field.key)} className="mcalc-card" style={{ marginTop: 8 }}>
            <div className="mcalc-grid-2">
              <div className="mcalc-field-row">
                <label className="mcalc-label" htmlFor={`mcalc-p-${String(field.key)}`}>
                  {field.label} ({field.unit})
                </label>
                <input
                  id={`mcalc-p-${String(field.key)}`}
                  className="mcalc-input"
                  type="number"
                  min={0}
                  max={field.key === "renewablePct" ? 100 : undefined}
                  step="any"
                  inputMode="decimal"
                  value={value || ""}
                  onChange={(e) => setNumber(field.key, Math.max(0, Number(e.target.value) || 0))}
                  placeholder="0"
                />
              </div>
              {field.factor ? (
                <div className="mcalc-field-row">
                  <span className="mcalc-label">Emission factor</span>
                  <span className="mcalc-out" style={{ fontSize: 12 }}>{field.factor}</span>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}

      <div className="mcalc-card" style={{ marginTop: 8 }}>
        <span className="mcalc-label">Meals</span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginTop: 8 }}>
          {MEAL_OPTIONS.map((meal, index) => (
            <button
              key={meal.label}
              type="button"
              className="mcalc-chip"
              style={{ textAlign: "left", borderRadius: 14, padding: "9px 12px" }}
              aria-pressed={inputs.mealIndex === index}
              onClick={() => setInputs((prev) => ({ ...prev, mealIndex: prev.mealIndex === index ? null : index }))}
            >
              <b style={{ display: "block", fontSize: 12 }}>{meal.label}</b>
              <span style={{ fontSize: 10.5, opacity: 0.85 }}>{meal.kg.toLocaleString("en-US")} kg CO₂e / year</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Result ── */}
      <section className="mcalc-card" style={{ marginTop: 16 }}>
        <h3 className="mcalc-card-title">Your carbon footprint</h3>
        <p className="mcalc-big">
          {result.total.toFixed(2)} <small>tonnes CO₂e / year</small>
        </p>
        <div style={{ marginTop: 12 }}>
          {(
            [
              ["Electricity", result.electricity],
              ["Home fuel", result.homeFuel],
              ["Public travel", result.travel],
              ["Vehicle fuel", result.vehicleFuel],
              ["Meals", result.meals],
            ] as Array<[string, number]>
          ).map(([name, value]) => {
            const max = Math.max(result.electricity, result.homeFuel, result.travel, result.vehicleFuel, result.meals, 1);
            return (
              <div key={name} className="mcalc-bar-row">
                <span>{name}</span>
                <b>{formatKg(value)} kg</b>
                <div className="mcalc-meter">
                  <i style={{ width: `${(value / max) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <p className="mcalc-note" style={{ marginTop: 10 }}>
          Country average <b>{result.countryAverage.toFixed(1)}</b> t · World average {result.worldAverage} t
        </p>
        <p className="mcalc-note" style={{ marginTop: 6 }}>
          Grid factors are indicative national averages. For reporting, use the platform&apos;s CEA / IPCC factors.
        </p>
      </section>

      {/* ── Reduction tips ── */}
      <section className="mcalc-card" style={{ marginTop: 12 }}>
        <h3 className="mcalc-card-title">Ways to reduce your footprint</h3>
        {(["electricity", "travel", "lifestyle choices"] as const).map((group) => (
          <div key={group}>
            <h4 style={{ margin: "10px 0 2px", fontSize: 12, fontWeight: 800, textTransform: "capitalize" }}>
              Minimize emissions from {group}
            </h4>
            {REDUCTION_TIPS.filter((tip) => tip.group === group).map((tip) => (
              <div key={tip.action} className="mcalc-tip">
                <b>−{tip.kg.toLocaleString("en-US")} kg</b>
                <span>{tip.action}</span>
              </div>
            ))}
          </div>
        ))}
        <p className="mcalc-note" style={{ marginTop: 8 }}>Annual savings in kg CO₂e.</p>
      </section>
    </div>
  );
}

/* ── Onsite support request ──────────────────────────────────────────────── */

function SupportRequest({ total, afterPng }: { total: number; afterPng: number }) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [mobile, setMobile] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const { toast } = useToast();

  const submit = async () => {
    const trimmedName = name.trim();
    const digits = mobile.replace(/\s/g, "");
    if (!trimmedName) {
      setError("Enter your name or company name.");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(digits)) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      // File the request as a real ESG task so it lands in the audit trail
      // and the owner's task register — not a dead-end form.
      const due = new Date();
      due.setDate(due.getDate() + 7);
      await apiPost("/api/esg/tasks", {
        title: `Onsite support request — carbon review (${trimmedName})`,
        description: `Calculator onsite support request.\nContact: ${trimmedName} — ${digits}\nCurrent monthly footprint: ${total.toFixed(1)} kg CO2e\nAfter switching fuels to PNG: ${afterPng.toFixed(1)} kg CO2e`,
        category: "ENVIRONMENT",
        assigneeType: "ROLE",
        assigneeLabel: "ESG Support",
        assigneeFilter: JSON.stringify({ role: "GROUP_ADMIN" }),
        dueDate: due.toISOString(),
        priority: "MEDIUM",
        requiresEvidence: "false",
      });
      setDone(true);
      toast({ title: "Request filed", description: "Your onsite support request is now tracked as an ESG task." });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not file the request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button type="button" className="mcalc-action primary" style={{ marginTop: 12, width: "100%" }} onClick={() => setOpen(true)}>
        Get onsite support
      </button>
    );
  }

  return (
    <div className="mcalc-card" style={{ marginTop: 12 }}>
      {done ? (
        <>
          <h3 className="mcalc-card-title">Thank you for the information</h3>
          <p className="mcalc-note">We will get in touch shortly. Your request is tracked in the ESG task register.</p>
          <button type="button" className="mcalc-action" style={{ marginTop: 10 }} onClick={() => setOpen(false)}>
            Close
          </button>
        </>
      ) : (
        <>
          <h3 className="mcalc-card-title">Get onsite support</h3>
          <p className="mcalc-note" style={{ marginBottom: 10 }}>
            Schedule an energy audit at your location. The request is filed against the ESG task register.
          </p>
          <div className="mcalc-field-row">
            <label className="mcalc-label" htmlFor="mcalc-support-name">Your name / company name *</label>
            <input
              id="mcalc-support-name"
              className="mcalc-input"
              autoComplete="organization"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="mcalc-field-row" style={{ marginTop: 8 }}>
            <label className="mcalc-label" htmlFor="mcalc-support-mobile">Mobile number *</label>
            <input
              id="mcalc-support-mobile"
              className="mcalc-input"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              autoComplete="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
            />
          </div>
          {error ? <p className="mcalc-err">{error}</p> : null}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
            <button type="button" className="mcalc-action" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </button>
            <button type="button" className="mcalc-action primary" onClick={() => void submit()} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Root ────────────────────────────────────────────────────────────────── */

export function CarbonCalculator({ segment }: CarbonCalculatorProps) {
  return segment === "biz" ? <BusinessFootprint /> : <PersonalFootprint />;
}
