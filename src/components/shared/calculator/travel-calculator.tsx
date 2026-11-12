"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   MEIL ESG Platform — Travel carbon footprint calculator

   Modeled on Sustainable Travel International's travel calculator:
     • Flight — one trip, multiple trips or private jet; one-way / round
       trip, passenger count, cabin class, airport-to-airport great-circle.
     • Hotel — destination country, star rating, rooms, nights.
     • Boat — cruise/liveaboard per-day benchmark, or a private boat engine
       burn model.
     • Car — vehicle type, fuel, distance, one-way / round trip, occupants.

   The math lives in `@/lib/calculator/travel`.
   ═══════════════════════════════════════════════════════════════════════════ */

import * as React from "react";
import {
  ArrowLeftRight,
  Building2,
  Car as CarIcon,
  Plane,
  Ship,
} from "lucide-react";
import {
  AIRPORTS,
  BOAT_FUELS,
  CAR_FUELS,
  CAR_TYPES,
  carFactorPerKm,
  classifyHaul,
  computeBoat,
  computeCar,
  computeFlight,
  computeJet,
  CRUISE_TYPES,
  ENGINE_HP,
  FLIGHT_CLASSES,
  flightDistanceKm,
  formatCo2,
  haulLabel,
  hotelFactorPerNight,
  HOTEL_COUNTRIES,
  JET_FUEL_FACTOR,
  JET_TYPES,
  type BoatInputs,
  type CarInputs,
  type FlightClass,
  type FlightInputs,
  type FlightLeg,
  type HotelInputs,
} from "@/lib/calculator/travel";

type TravelMode = "flight" | "hotel" | "boat" | "car";
type TripType = "one" | "multi" | "jet";

const TRAVEL_MODES: Array<{ id: TravelMode; label: string; icon: React.ReactNode }> = [
  { id: "flight", label: "Flight", icon: <Plane size={14} aria-hidden="true" /> },
  { id: "hotel", label: "Hotel", icon: <Building2 size={14} aria-hidden="true" /> },
  { id: "boat", label: "Boat", icon: <Ship size={14} aria-hidden="true" /> },
  { id: "car", label: "Car", icon: <CarIcon size={14} aria-hidden="true" /> },
];

function Stepper({
  value,
  min,
  max,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  label: string;
}) {
  return (
    <div className="mcalc-stepper">
      <button
        type="button"
        aria-label={`Fewer ${label}`}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        −
      </button>
      <b>{value}</b>
      <button
        type="button"
        aria-label={`More ${label}`}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        +
      </button>
    </div>
  );
}

function AirportSelect({
  id,
  value,
  onChange,
  label,
}: {
  id: string;
  value: string;
  onChange: (code: string) => void;
  label: string;
}) {
  return (
    <div className="mcalc-field-row">
      <label className="mcalc-label" htmlFor={id}>{label}</label>
      <select
        id={id}
        className="mcalc-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select airport…</option>
        {AIRPORTS.map((a) => (
          <option key={a.code} value={a.code}>
            {a.code} — {a.city}, {a.country}
          </option>
        ))}
      </select>
    </div>
  );
}

function LegRoute({
  leg,
  index,
  onPatch,
  onRemove,
}: {
  leg: FlightLeg;
  index: number;
  onPatch: (patch: Partial<FlightLeg>) => void;
  onRemove: () => void;
}) {
  const km = leg.from && leg.to ? flightDistanceKm(leg.from, leg.to) : 0;
  const swap = () => onPatch({ from: leg.to, to: leg.from });
  return (
    <div className="mcalc-card" style={{ marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <h4 style={{ margin: 0, fontSize: 12.5, fontWeight: 800 }}>
          {index === 0 ? "Trip" : `Trip ${index + 1}`}
        </h4>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            className="mcalc-action"
            style={{ padding: "4px 9px", fontSize: 11 }}
            onClick={swap}
            aria-label="Swap airports"
          >
            <ArrowLeftRight size={12} aria-hidden="true" />
          </button>
          {index > 0 ? (
            <button
              type="button"
              className="mcalc-action"
              style={{ padding: "4px 9px", fontSize: 11 }}
              onClick={onRemove}
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>
      <div className="mcalc-grid-2">
        <AirportSelect
          id={`mcalc-leg-from-${leg.id}`}
          value={leg.from}
          onChange={(code) => onPatch({ from: code })}
          label="Where from?"
        />
        <AirportSelect
          id={`mcalc-leg-to-${leg.id}`}
          value={leg.to}
          onChange={(code) => onPatch({ to: code })}
          label="Where to?"
        />
      </div>
      <p className="mcalc-note" style={{ marginTop: 6 }}>
        {km > 0 && leg.from !== leg.to
          ? `${haulLabel(classifyHaul(km))} · ${km.toLocaleString("en-US")} km each way`
          : "Pick two different airports to measure the great-circle distance."}
      </p>
    </div>
  );
}

function ResultCard({
  title,
  kg,
  breakdown,
  note,
}: {
  title: string;
  kg: number;
  breakdown: Array<[string, number]>;
  note: string;
}) {
  return (
    <section className="mcalc-card" style={{ marginTop: 12 }}>
      <h3 className="mcalc-card-title">{title}</h3>
      <p className="mcalc-big">
        {formatCo2(kg)} <small>CO₂e</small>
      </p>
      <div style={{ marginTop: 10 }}>
        {breakdown.map(([name, value], idx) => {
          const max = Math.max(...breakdown.map(([, v]) => v), 1);
          return (
            <div key={`${idx}-${name}`} className="mcalc-bar-row">
              <span>{name}</span>
              <b>{formatCo2(value)}</b>
              <div className="mcalc-meter">
                <i style={{ width: `${(value / max) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <p className="mcalc-note" style={{ marginTop: 8 }}>{note}</p>
      <p className="mcalc-note" style={{ marginTop: 4 }}>
        {kg > 0
          ? `≈ ${kg.toLocaleString("en-US", { maximumFractionDigits: 0 })} kg CO₂e in total — offsets are typically bought in whole tonnes.`
          : "Fill in the trip details to see the footprint."}
      </p>
    </section>
  );
}

export function TravelCalculator() {
  const [mode, setMode] = React.useState<TravelMode>("flight");
  const [tripType, setTripType] = React.useState<TripType>("one");

  /* Flight state */
  const [legs, setLegs] = React.useState<FlightLeg[]>([
    { id: 1, from: "DEL", to: "DXB" },
    { id: 2, from: "BOM", to: "SIN" },
  ]);
  const [direction, setDirection] = React.useState<"one" | "round">("round");
  const [flightClass, setFlightClass] = React.useState<FlightClass>("economy");
  const [passengers, setPassengers] = React.useState(1);
  const [jetTypeId, setJetTypeId] = React.useState(JET_TYPES[2].id);
  const [jetHours, setJetHours] = React.useState(3);

  /* Hotel state */
  const [hotel, setHotel] = React.useState<HotelInputs>({
    country: "UAE",
    stars: 5,
    rooms: 1,
    nights: 5,
  });

  /* Boat state */
  const [boat, setBoat] = React.useState<BoatInputs>({
    mode: "cruise",
    cruiseTypeId: CRUISE_TYPES[1].id,
    days: 5,
    passengers: 2,
    engineHp: 100,
    hours: 4,
    fuelId: BOAT_FUELS[1].id,
  });

  /* Car state */
  const [car, setCar] = React.useState<CarInputs>({
    carTypeId: "standard",
    fuelId: "petrol",
    km: 400,
    direction: "round",
    occupants: 1,
  });

  const nextLegId = React.useRef(3);

  const patchLeg = (id: number, patch: Partial<FlightLeg>) =>
    setLegs((prev) => prev.map((leg) => (leg.id === id ? { ...leg, ...patch } : leg)));

  const addLeg = () =>
    setLegs((prev) => [...prev, { id: nextLegId.current++, from: "", to: "" }]);

  const removeLeg = (id: number) =>
    setLegs((prev) => (prev.length > 1 ? prev.filter((leg) => leg.id !== id) : prev));

  /** In "One Trip" mode only the first leg counts. */
  const activeLegs = tripType === "one" ? legs.slice(0, 1) : legs;

  const flightInputs: FlightInputs = React.useMemo(
    () => ({ legs: activeLegs, direction, flightClass, passengers }),
    [activeLegs, direction, flightClass, passengers],
  );

  const flight = React.useMemo(() => computeFlight(flightInputs), [flightInputs]);

  const jetKg = computeJet({ jetTypeId, hours: jetHours });

  const hotelKg = hotelFactorPerNight(hotel.country, hotel.stars) * hotel.rooms * hotel.nights;

  const boatKg = computeBoat(boat);
  const carResult = computeCar(car);

  return (
    <div>
      <h2 className="mcalc-card-title" style={{ fontSize: 14, marginBottom: 4 }}>
        Travel carbon footprint
      </h2>

      {/* ── Transport mode chips ── */}
      <div className="mcalc-tmode" role="tablist" aria-label="Travel type">
        {TRAVEL_MODES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={mode === item.id}
            className="mcalc-tmode-btn"
            onClick={() => setMode(item.id)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {/* ── Flight ── */}
      {mode === "flight" ? (
        <>
          <div className="mcalc-tradio" role="group" aria-label="Trip type">
            {(
              [
                ["one", "One Trip"],
                ["multi", "Multiple Trips"],
                ["jet", "Private Jet"],
              ] as Array<[TripType, string]>
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className="mcalc-tradio-btn"
                aria-pressed={tripType === id}
                onClick={() => setTripType(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {tripType === "jet" ? (
            <div className="mcalc-card" style={{ marginTop: 10 }}>
              <div className="mcalc-grid-2">
                <div className="mcalc-field-row">
                  <label className="mcalc-label" htmlFor="mcalc-jet-type">Aircraft</label>
                  <select
                    id="mcalc-jet-type"
                    className="mcalc-select"
                    value={jetTypeId}
                    onChange={(e) => setJetTypeId(e.target.value)}
                  >
                    {JET_TYPES.map((jet) => (
                      <option key={jet.id} value={jet.id}>{jet.label}</option>
                    ))}
                  </select>
                </div>
                <div className="mcalc-field-row">
                  <label className="mcalc-label" htmlFor="mcalc-jet-hours">Flight time (hours)</label>
                  <input
                    id="mcalc-jet-hours"
                    className="mcalc-input"
                    type="number"
                    min={0}
                    max={20}
                    step="any"
                    inputMode="decimal"
                    value={jetHours || ""}
                    onChange={(e) => setJetHours(Math.max(0, Number(e.target.value) || 0))}
                    placeholder="0"
                  />
                </div>
              </div>
              <p className="mcalc-note" style={{ marginTop: 8 }}>
                Hours × fuel burn × {JET_FUEL_FACTOR} kg CO₂e per gallon of jet fuel (US EIA 2024).
              </p>
            </div>
          ) : (
            <>
              <div className="mcalc-card" style={{ marginTop: 10 }}>
                <div className="mcalc-grid-2">
                  <div className="mcalc-field-row">
                    <label className="mcalc-label" htmlFor="mcalc-direction">Trip type</label>
                    <select
                      id="mcalc-direction"
                      className="mcalc-select"
                      value={direction}
                      onChange={(e) => setDirection(e.target.value === "round" ? "round" : "one")}
                    >
                      <option value="round">Round Trip</option>
                      <option value="one">One Way</option>
                    </select>
                  </div>
                  <div className="mcalc-field-row">
                    <label className="mcalc-label" htmlFor="mcalc-class">Cabin class</label>
                    <select
                      id="mcalc-class"
                      className="mcalc-select"
                      value={flightClass}
                      onChange={(e) => setFlightClass(e.target.value as FlightClass)}
                    >
                      {FLIGHT_CLASSES.map((c) => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mcalc-field-row" style={{ marginTop: 10 }}>
                  <span className="mcalc-label">Passengers</span>
                  <Stepper value={passengers} min={1} max={9} onChange={setPassengers} label="passengers" />
                </div>
              </div>

              {(tripType === "one" ? legs.slice(0, 1) : legs).map((leg, index) => (
                <LegRoute
                  key={leg.id}
                  leg={leg}
                  index={index}
                  onPatch={(patch) => patchLeg(leg.id, patch)}
                  onRemove={() => removeLeg(leg.id)}
                />
              ))}
              {tripType === "multi" && legs.length < 6 ? (
                <button type="button" className="mcalc-action" onClick={addLeg}>
                  + Add another trip
                </button>
              ) : null}
            </>
          )}

          <ResultCard
            title={tripType === "jet" ? "Private jet footprint" : "Flight footprint"}
            kg={tripType === "jet" ? jetKg : flight.kg}
            breakdown={
              tripType === "jet"
                ? [["Aircraft emissions", jetKg]]
                : tripType === "multi"
                  ? activeLegs.map((leg, idx) => {
                      const legKg = computeFlight({
                        legs: [leg],
                        direction,
                        flightClass,
                        passengers,
                      }).kg;
                      const route =
                        leg.from && leg.to
                          ? `${leg.from} ${direction === "round" ? "↔" : "→"} ${leg.to}`
                          : `Trip ${idx + 1}`;
                      return [route, legKg] as [string, number];
                    })
                  : [
                      ["Flight emissions", flight.kg],
                      ...(passengers > 1
                        ? [["Per passenger", flight.kg / passengers] as [string, number]]
                        : []),
                    ]
            }
            note={
              tripType === "jet"
                ? "Fuel burn rates from Conklin & de Decker class averages. A private jet emits at least 1 t CO₂e per flight hour."
                : `${flight.km.toLocaleString("en-US")} km total × UK DESNZ (formerly DEFRA) 2024 per-class factors. Short-haul < 1,500 km, medium 1,500–3,700 km, long-haul > 3,700 km.`
            }
          />
        </>
      ) : null}

      {/* ── Hotel ── */}
      {mode === "hotel" ? (
        <>
          <div className="mcalc-card" style={{ marginTop: 10 }}>
            <div className="mcalc-grid-2">
              <div className="mcalc-field-row">
                <label className="mcalc-label" htmlFor="mcalc-hotel-country">Destination</label>
                <select
                  id="mcalc-hotel-country"
                  className="mcalc-select"
                  value={hotel.country}
                  onChange={(e) => setHotel((prev) => ({ ...prev, country: e.target.value }))}
                >
                  {HOTEL_COUNTRIES.map((country) => (
                    <option key={country} value={country}>{country}</option>
                  ))}
                </select>
              </div>
              <div className="mcalc-field-row">
                <label className="mcalc-label" htmlFor="mcalc-hotel-nights">Nights</label>
                <input
                  id="mcalc-hotel-nights"
                  className="mcalc-input"
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  value={hotel.nights || ""}
                  onChange={(e) => setHotel((prev) => ({ ...prev, nights: Math.max(0, Number(e.target.value) || 0) }))}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="mcalc-field-row" style={{ marginTop: 10 }}>
              <span className="mcalc-label">Star rating</span>
              <div className="mcalc-tmode" style={{ margin: 0 }}>
                {[2, 3, 4, 5].map((stars) => (
                  <button
                    key={stars}
                    type="button"
                    className="mcalc-tmode-btn"
                    aria-pressed={hotel.stars === stars}
                    onClick={() => setHotel((prev) => ({ ...prev, stars }))}
                  >
                    <span>{stars}★</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="mcalc-field-row" style={{ marginTop: 10 }}>
              <span className="mcalc-label">Rooms</span>
              <Stepper
                value={hotel.rooms}
                min={1}
                max={20}
                onChange={(rooms) => setHotel((prev) => ({ ...prev, rooms }))}
                label="rooms"
              />
            </div>
          </div>

          <ResultCard
            title="Hotel stay footprint"
            kg={hotelKg}
            breakdown={[["Room-nights", hotelKg]]}
            note={`Factor ${hotelFactorPerNight(hotel.country, hotel.stars).toFixed(1)} kg CO₂e per room-night — Cornell Hotel Sustainability Benchmarking (CHSB), scaled by star rating.`}
          />
        </>
      ) : null}

      {/* ── Boat ── */}
      {mode === "boat" ? (
        <>
          <div className="mcalc-tradio" role="group" aria-label="Boat type">
            <button
              type="button"
              className="mcalc-tradio-btn"
              aria-pressed={boat.mode === "cruise"}
              onClick={() => setBoat((prev) => ({ ...prev, mode: "cruise" }))}
            >
              Cruise / Liveaboard
            </button>
            <button
              type="button"
              className="mcalc-tradio-btn"
              aria-pressed={boat.mode === "private"}
              onClick={() => setBoat((prev) => ({ ...prev, mode: "private" }))}
            >
              Private Boat
            </button>
          </div>

          {boat.mode === "cruise" ? (
            <div className="mcalc-card" style={{ marginTop: 10 }}>
              <div className="mcalc-grid-2">
                <div className="mcalc-field-row">
                  <label className="mcalc-label" htmlFor="mcalc-cruise-type">Cruise type</label>
                  <select
                    id="mcalc-cruise-type"
                    className="mcalc-select"
                    value={boat.cruiseTypeId}
                    onChange={(e) => setBoat((prev) => ({ ...prev, cruiseTypeId: e.target.value }))}
                  >
                    {CRUISE_TYPES.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="mcalc-field-row">
                  <label className="mcalc-label" htmlFor="mcalc-cruise-days">Days on board</label>
                  <input
                    id="mcalc-cruise-days"
                    className="mcalc-input"
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    value={boat.days || ""}
                    onChange={(e) => setBoat((prev) => ({ ...prev, days: Math.max(0, Number(e.target.value) || 0) }))}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="mcalc-field-row" style={{ marginTop: 10 }}>
                <span className="mcalc-label">Passengers</span>
                <Stepper
                  value={boat.passengers}
                  min={1}
                  max={20}
                  onChange={(passengers) => setBoat((prev) => ({ ...prev, passengers }))}
                  label="passengers"
                />
              </div>
            </div>
          ) : (
            <div className="mcalc-card" style={{ marginTop: 10 }}>
              <div className="mcalc-grid-2">
                <div className="mcalc-field-row">
                  <label className="mcalc-label" htmlFor="mcalc-engine">Engine power (hp)</label>
                  <select
                    id="mcalc-engine"
                    className="mcalc-select"
                    value={boat.engineHp}
                    onChange={(e) => setBoat((prev) => ({ ...prev, engineHp: Number(e.target.value) }))}
                  >
                    {ENGINE_HP.map((hp) => (
                      <option key={hp} value={hp}>{hp} hp</option>
                    ))}
                  </select>
                </div>
                <div className="mcalc-field-row">
                  <label className="mcalc-label" htmlFor="mcalc-boat-hours">Hours on the water</label>
                  <input
                    id="mcalc-boat-hours"
                    className="mcalc-input"
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    value={boat.hours || ""}
                    onChange={(e) => setBoat((prev) => ({ ...prev, hours: Math.max(0, Number(e.target.value) || 0) }))}
                    placeholder="0"
                  />
                </div>
                <div className="mcalc-field-row">
                  <label className="mcalc-label" htmlFor="mcalc-boat-fuel">Fuel type</label>
                  <select
                    id="mcalc-boat-fuel"
                    className="mcalc-select"
                    value={boat.fuelId}
                    onChange={(e) => setBoat((prev) => ({ ...prev, fuelId: e.target.value }))}
                  >
                    {BOAT_FUELS.map((f) => (
                      <option key={f.id} value={f.id}>{f.label}</option>
                    ))}
                  </select>
                </div>
                <div className="mcalc-field-row">
                  <span className="mcalc-label">Estimated fuel burn</span>
                  <span className="mcalc-out">{(boat.engineHp * 0.22 * boat.hours).toFixed(0)} L</span>
                </div>
              </div>
            </div>
          )}

          <ResultCard
            title="Boat footprint"
            kg={boatKg}
            breakdown={[boat.mode === "cruise" ? ["Per passenger, per day", boatKg] : ["Engine emissions", boatKg]]}
            note={
              boat.mode === "cruise"
                ? "Per-passenger, per-day benchmarks derived from the EMSA THETIS-MRV cruise database (189–561 kg CO₂e per day band)."
                : "Engine burn ≈ 0.22 L per hp per hour × fuel CO₂e factor. Approximate — actual burn depends on speed and load."
            }
          />
        </>
      ) : null}

      {/* ── Car ── */}
      {mode === "car" ? (
        <>
          <div className="mcalc-card" style={{ marginTop: 10 }}>
            <div className="mcalc-grid-2">
              <div className="mcalc-field-row">
                <label className="mcalc-label" htmlFor="mcalc-car-type">Vehicle</label>
                <select
                  id="mcalc-car-type"
                  className="mcalc-select"
                  value={car.carTypeId}
                  onChange={(e) => setCar((prev) => ({ ...prev, carTypeId: e.target.value }))}
                >
                  {CAR_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="mcalc-field-row">
                <label className="mcalc-label" htmlFor="mcalc-car-fuel">Fuel</label>
                <select
                  id="mcalc-car-fuel"
                  className="mcalc-select"
                  value={car.fuelId}
                  onChange={(e) => setCar((prev) => ({ ...prev, fuelId: e.target.value }))}
                >
                  {CAR_FUELS.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="mcalc-field-row">
                <label className="mcalc-label" htmlFor="mcalc-car-km">Distance one way (km)</label>
                <input
                  id="mcalc-car-km"
                  className="mcalc-input"
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  value={car.km || ""}
                  onChange={(e) => setCar((prev) => ({ ...prev, km: Math.max(0, Number(e.target.value) || 0) }))}
                  placeholder="0"
                />
              </div>
              <div className="mcalc-field-row">
                <label className="mcalc-label" htmlFor="mcalc-car-direction">Trip type</label>
                <select
                  id="mcalc-car-direction"
                  className="mcalc-select"
                  value={car.direction}
                  onChange={(e) => setCar((prev) => ({ ...prev, direction: e.target.value === "round" ? "round" : "one" }))}
                >
                  <option value="round">Round Trip</option>
                  <option value="one">One Way</option>
                </select>
              </div>
            </div>
            <div className="mcalc-field-row" style={{ marginTop: 10 }}>
              <span className="mcalc-label">People in the vehicle</span>
              <Stepper
                value={car.occupants}
                min={1}
                max={9}
                onChange={(occupants) => setCar((prev) => ({ ...prev, occupants }))}
                label="people"
              />
            </div>
          </div>

          <ResultCard
            title="Road trip footprint"
            kg={carResult.vehicleKg}
            breakdown={[
              ["Whole vehicle", carResult.vehicleKg],
              ["Per person", carResult.perPersonKg],
            ]}
            note={`${(carFactorPerKm(car.carTypeId, car.fuelId) * 1000).toFixed(0)} g CO₂e/km — UK DESNZ 2024 by vehicle type and fuel (0.11–0.20 kg/km band).`}
          />
        </>
      ) : null}
    </div>
  );
}

/* ── Local helpers ───────────────────────────────────────────────────────── */

