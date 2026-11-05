// Blanks fabricated data defaults in the Level 3 GHG form (keeps type defaults).
const { readFileSync, writeFileSync } = require('node:fs')
const p = 'src/components/shared/data-entry/forms/level3-ghg.tsx'
let t = readFileSync(p, 'utf8')

const blanks = [
  ["const [equipmentId, setEquipmentId] = useState('MEIL-DG-002')", "const [equipmentId, setEquipmentId] = useState('')"],
  ["const [electricityKwh, setElectricityKwh] = useState('384000')", "const [electricityKwh, setElectricityKwh] = useState('')"],
  ["const [cargoWeightTonnes, setCargoWeightTonnes] = useState('500')", "const [cargoWeightTonnes, setCargoWeightTonnes] = useState('')"],
  ["const [distanceKm, setDistanceKm] = useState('850')", "const [distanceKm, setDistanceKm] = useState('')"],
  ["const [tonneKm, setTonneKm] = useState('425000')", "const [tonneKm, setTonneKm] = useState('')"],
  ["const [logisticsProvider, setLogisticsProvider] = useState('VRL Logistics Ltd.')", "const [logisticsProvider, setLogisticsProvider] = useState('')"],
  ["const [originDestination, setOriginDestination] = useState('Vendor Balanagar Works -> Gujarat Site (850 km)')", "const [originDestination, setOriginDestination] = useState('')"],
  ["const [travelDistanceKm, setTravelDistanceKm] = useState('1450')", "const [travelDistanceKm, setTravelDistanceKm] = useState('')"],
  ["const [passengerCount, setPassengerCount] = useState('100')", "const [passengerCount, setPassengerCount] = useState('')"],
  ["const [passengerKm, setPassengerKm] = useState('145000')", "const [passengerKm, setPassengerKm] = useState('')"],
  ["const [samplingLocation, setSamplingLocation] = useState('Perimeter Air Monitoring Station 01')", "const [samplingLocation, setSamplingLocation] = useState('')"],
  ["const [testDate, setTestDate] = useState('2026-06-15')", "const [testDate, setTestDate] = useState('')"],
  ["const [laboratory, setLaboratory] = useState('Vimta Labs Ltd. (NABL / CPCB Recognized)')", "const [laboratory, setLaboratory] = useState('')"],
  ["const [measuredResult, setMeasuredResult] = useState('48.2')", "const [measuredResult, setMeasuredResult] = useState('')"],
  ["const [quantityLeakedKg, setQuantityLeakedKg] = useState('14')", "const [quantityLeakedKg, setQuantityLeakedKg] = useState('')"],
  ["const [activityQuantity, setActivityQuantity] = useState('18650')", "const [activityQuantity, setActivityQuantity] = useState('')"],
  ["const [reportingPeriod, setReportingPeriod] = useState('June 2026')", "const [reportingPeriod, setReportingPeriod] = useState('')"],
  ["const [supportingEvidence, setSupportingEvidence] = useState(\n    'SAP Fuel Procurement Ledger & DG Run Logbook'\n  )", "const [supportingEvidence, setSupportingEvidence] = useState('')"],
  ["const [remarks, setRemarks] = useState(\n    'Scope 1 direct diesel combustion for backup generation.'\n  )", "const [remarks, setRemarks] = useState('')"],
]
let applied = 0
for (const [a, b] of blanks) {
  if (t.includes(a)) { t = t.split(a).join(b); applied++ }
  else console.error('NOT FOUND:', a.slice(0, 60))
}
writeFileSync(p, t)
console.log('L3 defaults blanked:', applied, '/', blanks.length)
