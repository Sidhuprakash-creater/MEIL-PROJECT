// Aligns the emission-factor popover registry with the DB EmissionFactor master
// (grid 0.716 CEA v19, diesel 2.637 IPCC 2006, petrol 2.296, coal 1.9, CNG 2.19, RE 0.04).
const { readFileSync, writeFileSync } = require('node:fs')
const p = 'src/components/shared/emission-factor-info.tsx'
let t = readFileSync(p, 'utf8')

const swaps = [
  // Grid — DB: 0.716 CEA v19 (client presets compute with 0.716)
  ["  'Grid Electricity': {\n    source: 'CEA 2024 Baseline Database',\n    factor: '0.475 Kg CO2e/kWh',\n    scope: 'Scope 2',\n  },\n  'Grid electricity': {\n    source: 'CEA 2024 Baseline Database',\n    factor: '0.475 Kg CO2e/kWh',\n    scope: 'Scope 2',\n  },",
   "  'Grid Electricity': {\n    source: 'CEA CO2 Baseline Database v19',\n    factor: '0.716 Kg CO2e/kWh',\n    scope: 'Scope 2',\n  },\n  'Grid electricity': {\n    source: 'CEA CO2 Baseline Database v19',\n    factor: '0.716 Kg CO2e/kWh',\n    scope: 'Scope 2',\n  },"],
  // Renewable — DB: Renewable PPA Solar 0.04 ISAE 3000
  ["  'Renewable electricity': {\n    source: 'GHG Protocol / Zero Direct Emissions',\n    factor: '0.000 Kg CO2e/kWh',\n    scope: 'Scope 2',\n  },",
   "  'Renewable electricity': {\n    source: 'Renewable PPA (Solar) — ISAE 3000',\n    factor: '0.040 Kg CO2e/kWh',\n    scope: 'Scope 2',\n  },"],
  // Diesel — DB: 2.637 IPCC 2006 (client presets compute with 2.637)
  ["  'Diesel (HSD)': {\n    source: 'IPCC 2006, Vol 2, Ch 2, Table 2.2',\n    factor: '2.68 Kg CO2e/L',\n    scope: 'Scope 1',\n  },\n  'Diesel': {\n    source: 'IPCC 2006, Vol 2, Ch 2, Table 2.2',\n    factor: '2.68 Kg CO2e/L',\n    scope: 'Scope 1',\n  },",
   "  'Diesel (HSD)': {\n    source: 'IPCC 2006, Vol 2, Ch 2',\n    factor: '2.637 Kg CO2e/L',\n    scope: 'Scope 1',\n  },\n  'Diesel': {\n    source: 'IPCC 2006, Vol 2, Ch 2',\n    factor: '2.637 Kg CO2e/L',\n    scope: 'Scope 1',\n  },"],
  // Petrol — DB: 2.296
  ["  'Petrol': {\n    source: 'IPCC 2006, Vol 2, Ch 3, Table 2.2',\n    factor: '2.31 Kg CO2e/L',\n    scope: 'Scope 1',\n  },",
   "  'Petrol': {\n    source: 'IPCC 2006, Vol 2, Ch 3',\n    factor: '2.296 Kg CO2e/L',\n    scope: 'Scope 1',\n  },"],
  // CNG — DB: 2.19
  ["  'CNG': {\n    source: 'IPCC 2006, Vol 2, Ch 2, Table 2.2',\n    factor: '2.69 Kg CO2e/Kg',\n    scope: 'Scope 1',\n  },",
   "  'CNG': {\n    source: 'IPCC 2006, Vol 2, Ch 2',\n    factor: '2.19 Kg CO2e/Kg',\n    scope: 'Scope 1',\n  },"],
  // Gas — L1 form computes with 2.02 (IPCC natural gas)
  ["  'Gas': {\n    source: 'IPCC 2006, Vol 2, Ch 2, Table 2.2',\n    factor: '2.69 Kg CO2e/Kg',\n    scope: 'Scope 1',\n  },",
   "  'Gas': {\n    source: 'IPCC 2006, Vol 2, Ch 2 (natural gas)',\n    factor: '2.02 Kg CO2e/Kg',\n    scope: 'Scope 1',\n  },"],
  // Coal — DB: Coal (Sub-bituminous) 1.9; L1 form computes with 1.9
  ["  'Coal': {\n    source: 'IPCC 2006, Vol 2, Ch 2, Table 2.2',\n    factor: '2.15 Kg CO2e/Kg',\n    scope: 'Scope 1',\n  },",
   "  'Coal': {\n    source: 'IPCC 2006, Vol 2, Ch 2 (sub-bituminous)',\n    factor: '1.9 Kg CO2e/Kg',\n    scope: 'Scope 1',\n  },"],
  // DB scope-3 travel rows
  ["  'R-410A Refrigerant': {",
   "  'Air Travel (Domestic)': {\n    source: 'GHG Protocol Scope 3',\n    factor: '0.18 Kg CO2e/passenger-km',\n    scope: 'Scope 3',\n  },\n  'Rail Travel': {\n    source: 'GHG Protocol Scope 3',\n    factor: '0.04 Kg CO2e/passenger-km',\n    scope: 'Scope 3',\n  },\n  'Road Travel (Car)': {\n    source: 'GHG Protocol Scope 3',\n    factor: '0.11 Kg CO2e/vehicle-km',\n    scope: 'Scope 3',\n  },\n  'R-410A Refrigerant': {"],
]
let applied = 0
for (const [a, b] of swaps) {
  if (t.includes(a)) { t = t.split(a).join(b); applied++ }
  else console.error('NOT FOUND:', a.slice(0, 72).replace(/\n/g, '\\n'))
}
writeFileSync(p, t)
console.log('registry aligned with DB:', applied, '/', swaps.length)
