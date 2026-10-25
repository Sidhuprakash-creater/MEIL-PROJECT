import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export const runtime = 'nodejs'

// Standard verified emission factors baseline for Indian infrastructure & BRSR reporting
const VERIFIED_MASTER_FACTORS = [
  {
    name: 'Grid Electricity (India)',
    category: 'ELECTRICITY',
    fuelType: 'GRID',
    geography: 'IN',
    factorValue: 0.716,
    factorUnit: 'kgCO2e/kWh',
    scope: 'SCOPE_2',
    source: 'CEA v19',
    methodology: 'CEA CO2 Baseline Database v19',
    sourceDocument: 'Central Electricity Authority (CEA) Baseline Database for Indian Power Sector Version 19.0',
    effectiveFrom: new Date('2025-04-01'),
    version: 1,
    status: 'ACTIVE',
  },
  {
    name: 'Renewable PPA Solar',
    category: 'ELECTRICITY',
    fuelType: 'SOLAR_PPA',
    geography: 'IN',
    factorValue: 0.04,
    factorUnit: 'kgCO2e/kWh',
    scope: 'SCOPE_2',
    source: 'ISAE 3000',
    methodology: 'ISAE 3000 Scope 2 Market-based Accounting',
    sourceDocument: 'Power Purchase Agreement Certified Carbon Offsets & Wheeling Certification',
    effectiveFrom: new Date('2025-04-01'),
    version: 1,
    status: 'ACTIVE',
  },
  {
    name: 'Diesel (HSD)',
    category: 'MOBILE',
    fuelType: 'DIESEL',
    geography: 'IN',
    factorValue: 2.637,
    factorUnit: 'kgCO2e/L',
    scope: 'SCOPE_1',
    source: 'IPCC 2006',
    methodology: 'IPCC 2006 Guidelines for National GHG Inventories Vol 2 Ch 2',
    sourceDocument: 'IPCC Guidelines 2006 Vol 2 Table 2.2',
    effectiveFrom: new Date('2025-04-01'),
    version: 1,
    status: 'ACTIVE',
  },
  {
    name: 'Petrol (MS)',
    category: 'MOBILE',
    fuelType: 'PETROL',
    geography: 'IN',
    factorValue: 2.296,
    factorUnit: 'kgCO2e/L',
    scope: 'SCOPE_1',
    source: 'IPCC 2006',
    methodology: 'IPCC 2006 Guidelines for National GHG Inventories Vol 2 Ch 3',
    sourceDocument: 'IPCC 2006 Vol 2 Table 3.2.1',
    effectiveFrom: new Date('2025-04-01'),
    version: 1,
    status: 'ACTIVE',
  },
  {
    name: 'Furnace Oil / Boilers',
    category: 'STATIONARY',
    fuelType: 'FURNACE_OIL',
    geography: 'IN',
    factorValue: 3.15,
    factorUnit: 'kgCO2e/kg',
    scope: 'SCOPE_1',
    source: 'IPCC 2006',
    methodology: 'IPCC 2006 Stationary Combustion Guidelines',
    sourceDocument: 'IPCC 2006 Vol 2 Ch 2 Stationary Combustion Table 2.3',
    effectiveFrom: new Date('2025-04-01'),
    version: 1,
    status: 'ACTIVE',
  },
  {
    name: 'Coal (Sub-bituminous)',
    category: 'STATIONARY',
    fuelType: 'COAL',
    geography: 'IN',
    factorValue: 1.9,
    factorUnit: 'kgCO2e/kg',
    scope: 'SCOPE_1',
    source: 'IPCC 2006',
    methodology: 'IPCC 2006 Stationary Combustion Guidelines',
    sourceDocument: 'IPCC 2006 Vol 2 Stationary Combustion Table 2.4',
    effectiveFrom: new Date('2025-04-01'),
    version: 1,
    status: 'ACTIVE',
  },
  {
    name: 'CNG',
    category: 'STATIONARY',
    fuelType: 'CNG',
    geography: 'IN',
    factorValue: 2.19,
    factorUnit: 'kgCO2e/kg',
    scope: 'SCOPE_1',
    source: 'IPCC 2006',
    methodology: 'IPCC 2006 Stationary Combustion Guidelines',
    sourceDocument: 'IPCC 2006 Guidelines Vol 2 Ch 2',
    effectiveFrom: new Date('2025-04-01'),
    version: 1,
    status: 'ACTIVE',
  },
  {
    name: 'LPG',
    category: 'STATIONARY',
    fuelType: 'LPG',
    geography: 'IN',
    factorValue: 2.98,
    factorUnit: 'kgCO2e/kg',
    scope: 'SCOPE_1',
    source: 'IPCC 2006',
    methodology: 'IPCC 2006 Stationary Combustion Guidelines',
    sourceDocument: 'IPCC 2006 Guidelines Vol 2 Ch 2',
    effectiveFrom: new Date('2025-04-01'),
    version: 1,
    status: 'ACTIVE',
  },
  {
    name: 'Heavy Duty Road Freight (Diesel)',
    category: 'TRAVEL',
    fuelType: 'ROAD_FREIGHT',
    geography: 'IN',
    factorValue: 0.114,
    factorUnit: 'kgCO2e/tonne-km',
    scope: 'SCOPE_3',
    source: 'GLEC v3 / GHG Protocol',
    methodology: 'GLEC Framework v3.0 / GHG Protocol Scope 3 Technical Guidance',
    sourceDocument: 'Smart Freight Centre GLEC Framework v3.0 Module 1 Road Transport',
    effectiveFrom: new Date('2025-04-01'),
    version: 1,
    status: 'ACTIVE',
  },
  {
    name: 'Rail Freight',
    category: 'TRAVEL',
    fuelType: 'RAIL_FREIGHT',
    geography: 'IN',
    factorValue: 0.028,
    factorUnit: 'kgCO2e/tonne-km',
    scope: 'SCOPE_3',
    source: 'GLEC v3',
    methodology: 'GLEC Framework v3.0 Rail Transport',
    sourceDocument: 'Indian Railways / GLEC Framework v3.0',
    effectiveFrom: new Date('2025-04-01'),
    version: 1,
    status: 'ACTIVE',
  },
  {
    name: 'Air Travel (Domestic)',
    category: 'TRAVEL',
    fuelType: 'AVIATION',
    geography: 'IN',
    factorValue: 0.18,
    factorUnit: 'kgCO2e/pass-km',
    scope: 'SCOPE_3',
    source: 'GHG Protocol Scope 3',
    methodology: 'GHG Protocol Corporate Value Chain (Scope 3) Standard Category 6',
    sourceDocument: 'UK DEFRA / GHG Protocol Scope 3 Guidance for Business Travel',
    effectiveFrom: new Date('2025-04-01'),
    version: 1,
    status: 'ACTIVE',
  },
  {
    name: 'Rail Travel',
    category: 'TRAVEL',
    fuelType: 'RAIL',
    geography: 'IN',
    factorValue: 0.04,
    factorUnit: 'kgCO2e/pass-km',
    scope: 'SCOPE_3',
    source: 'GHG Protocol Scope 3',
    methodology: 'GHG Protocol Corporate Value Chain (Scope 3) Standard Category 6',
    sourceDocument: 'Indian Railways Energy Directorate Passenger Traction Statistics',
    effectiveFrom: new Date('2025-04-01'),
    version: 1,
    status: 'ACTIVE',
  },
  {
    name: 'Road Travel (Car)',
    category: 'TRAVEL',
    fuelType: 'PETROL',
    geography: 'IN',
    factorValue: 0.11,
    factorUnit: 'kgCO2e/pass-km',
    scope: 'SCOPE_3',
    source: 'GHG Protocol Scope 3',
    methodology: 'GHG Protocol Corporate Value Chain (Scope 3) Standard Category 6 & 7',
    sourceDocument: 'ARAI / DEFRA Fleet Passenger Conversion Tables',
    effectiveFrom: new Date('2025-04-01'),
    version: 1,
    status: 'ACTIVE',
  },
  {
    name: 'Employee Bus Transit',
    category: 'TRAVEL',
    fuelType: 'BUS',
    geography: 'IN',
    factorValue: 0.068,
    factorUnit: 'kgCO2e/pass-km',
    scope: 'SCOPE_3',
    source: 'GHG Protocol Scope 3',
    methodology: 'GHG Protocol Corporate Value Chain (Scope 3) Standard Category 7',
    sourceDocument: 'DEFRA / GHG Protocol Commuting Guidelines',
    effectiveFrom: new Date('2025-04-01'),
    version: 1,
    status: 'ACTIVE',
  },
  {
    name: 'Refrigerant R-410A',
    category: 'FUGITIVE',
    fuelType: 'R410A',
    geography: 'GLOBAL',
    factorValue: 2088.0,
    factorUnit: 'kgCO2e/kg',
    scope: 'SCOPE_1',
    source: 'IPCC AR5',
    methodology: 'IPCC Fifth Assessment Report (AR5) 100-Year Global Warming Potential',
    sourceDocument: 'IPCC AR5 Working Group I Table 8.A.1',
    effectiveFrom: new Date('2025-04-01'),
    version: 1,
    status: 'ACTIVE',
  },
  {
    name: 'Refrigerant R-134a',
    category: 'FUGITIVE',
    fuelType: 'R134A',
    geography: 'GLOBAL',
    factorValue: 1430.0,
    factorUnit: 'kgCO2e/kg',
    scope: 'SCOPE_1',
    source: 'IPCC AR5',
    methodology: 'IPCC Fifth Assessment Report (AR5) 100-Year Global Warming Potential',
    sourceDocument: 'IPCC AR5 Working Group I Table 8.A.1',
    effectiveFrom: new Date('2025-04-01'),
    version: 1,
    status: 'ACTIVE',
  },
  {
    name: 'Refrigerant R-22',
    category: 'FUGITIVE',
    fuelType: 'R22',
    geography: 'GLOBAL',
    factorValue: 1810.0,
    factorUnit: 'kgCO2e/kg',
    scope: 'SCOPE_1',
    source: 'IPCC AR5',
    methodology: 'IPCC Fifth Assessment Report (AR5) 100-Year Global Warming Potential',
    sourceDocument: 'IPCC AR5 Working Group I Table 8.A.1',
    effectiveFrom: new Date('2025-04-01'),
    version: 1,
    status: 'ACTIVE',
  },
  {
    name: 'Refrigerant R-32',
    category: 'FUGITIVE',
    fuelType: 'R32',
    geography: 'GLOBAL',
    factorValue: 675.0,
    factorUnit: 'kgCO2e/kg',
    scope: 'SCOPE_1',
    source: 'IPCC AR5',
    methodology: 'IPCC Fifth Assessment Report (AR5) 100-Year Global Warming Potential',
    sourceDocument: 'IPCC AR5 Working Group I Table 8.A.1',
    effectiveFrom: new Date('2025-04-01'),
    version: 1,
    status: 'ACTIVE',
  },
  {
    name: 'Refrigerant R-407C',
    category: 'FUGITIVE',
    fuelType: 'R407C',
    geography: 'GLOBAL',
    factorValue: 1774.0,
    factorUnit: 'kgCO2e/kg',
    scope: 'SCOPE_1',
    source: 'IPCC AR5',
    methodology: 'IPCC Fifth Assessment Report (AR5) 100-Year Global Warming Potential',
    sourceDocument: 'IPCC AR5 Working Group I Table 8.A.1',
    effectiveFrom: new Date('2025-04-01'),
    version: 1,
    status: 'ACTIVE',
  },
]

// Ensure default verified factors exist in database
let seedAttempted = false
async function ensureMasterEmissionFactors() {
  if (seedAttempted) return
  seedAttempted = true
  try {
    for (const item of VERIFIED_MASTER_FACTORS) {
      const existing = await db.emissionFactor.findFirst({
        where: { name: item.name },
      })
      if (!existing) {
        await db.emissionFactor.create({
          data: item,
        })
      }
    }
  } catch (err) {
    console.warn('Emission factor master sync note:', err)
  }
}

// GET /api/emission-factors
export async function GET(req: NextRequest) {
  try {
    await ensureMasterEmissionFactors()
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')
    const scope = searchParams.get('scope')
    const search = searchParams.get('search')

    const where: any = { status: 'ACTIVE' }
    if (category) where.category = category
    if (scope) where.scope = scope
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { fuelType: { contains: search } },
        { source: { contains: search } },
      ]
    }

    const factors = await db.emissionFactor.findMany({
      where,
      orderBy: [{ scope: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json({
      success: true,
      factors,
      count: factors.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch emission factors' },
      { status: 500 }
    )
  }
}

// POST /api/emission-factors (for lookup & calculation validation)
export async function POST(req: NextRequest) {
  try {
    await ensureMasterEmissionFactors()
    const body = await req.json()
    const {
      source,
      fuelType,
      fuelOrSource,
      unit,
      activityUnit,
      quantity,
      activityQuantity,
      scope,
    } = body || {}

    const rawSource = source || fuelOrSource || ''
    const rawFuel = fuelType || fuelOrSource || ''
    const rawUnit = unit || activityUnit || ''
    const rawQty = quantity !== undefined ? quantity : activityQuantity

    const qty = Number(rawQty) || 0
    const normUnit = String(rawUnit).toLowerCase().trim()
    const normSource = String(rawSource).toLowerCase().trim()
    const normFuel = String(rawFuel).toLowerCase().trim()

    // Query active factors
    const allFactors = await db.emissionFactor.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { version: 'desc' },
    })

    // Match candidate factor
    let matchedFactor = allFactors.find((f) => {
      const fName = f.name.toLowerCase()
      const fFuel = (f.fuelType || '').toLowerCase()

      // Exact fuel or name match
      if (normFuel && (fName.includes(normFuel) || fFuel.includes(normFuel))) return true
      if (normSource && (fName.includes(normSource) || fFuel.includes(normSource))) return true

      // Regex / keyword patterns
      if (/diesel|hsd/i.test(normSource) || /diesel|hsd/i.test(normFuel)) {
        return f.name === 'Diesel (HSD)'
      }
      if (/furnace oil|boiler|furnace/i.test(normSource) || /furnace oil/i.test(normFuel)) {
        return f.name === 'Furnace Oil / Boilers'
      }
      if (/grid|purchased electricity/i.test(normSource)) {
        return f.name === 'Grid Electricity (India)'
      }
      if (/freight|road freight|logistics|cargo/i.test(normSource)) {
        return f.name === 'Heavy Duty Road Freight (Diesel)'
      }
      if (/air travel|flight/i.test(normSource) || /air travel/i.test(normFuel)) {
        return f.name === 'Air Travel (Domestic)'
      }
      if (/rail/i.test(normSource) || /rail/i.test(normFuel)) {
        return f.name === 'Rail Travel'
      }
      if (/commute|travel/i.test(normSource) || /car/i.test(normFuel)) {
        return f.name === 'Road Travel (Car)'
      }
      if (/r-?410a/i.test(normSource) || /r-?410a/i.test(normFuel)) {
        return f.name === 'Refrigerant R-410A'
      }
      if (/r-?134a/i.test(normSource) || /r-?134a/i.test(normFuel)) {
        return f.name === 'Refrigerant R-134a'
      }
      if (/r-?22/i.test(normSource) || /r-?22/i.test(normFuel)) {
        return f.name === 'Refrigerant R-22'
      }
      if (/r-?32/i.test(normSource) || /r-?32/i.test(normFuel)) {
        return f.name === 'Refrigerant R-32'
      }
      if (/r-?407c/i.test(normSource) || /r-?407c/i.test(normFuel)) {
        return f.name === 'Refrigerant R-407C'
      }
      return false
    })

    // If still not matched, try scope & general keywords
    if (!matchedFactor) {
      if (/electricity|kwh/i.test(normSource) || normUnit === 'kwh') {
        matchedFactor = allFactors.find((f) => f.name === 'Grid Electricity (India)')
      } else if (/diesel|generator/i.test(normSource)) {
        matchedFactor = allFactors.find((f) => f.name === 'Diesel (HSD)')
      }
    }

    if (!matchedFactor) {
      return NextResponse.json({
        matched: false,
        error: 'Emission Factor Not Configured — ESG Review Required.',
        factor: null,
        calculatedTco2e: 0,
        formula: 'Factor unavailable in Emission Factor Master',
        timestamp: new Date().toISOString(),
      })
    }

    // Validate factor unit against activity unit
    const fUnit = matchedFactor.factorUnit.toLowerCase()
    let unitValid = false
    let conversionMultiplier = 1

    if (fUnit.includes('/l') || fUnit.includes('/litre')) {
      if (normUnit === 'l' || normUnit === 'litres' || normUnit === 'liter' || normUnit === 'liters') {
        unitValid = true
        conversionMultiplier = 1
      } else if (normUnit === 'kl') {
        unitValid = true
        conversionMultiplier = 1000
      }
    } else if (fUnit.includes('/kwh')) {
      if (normUnit === 'kwh') {
        unitValid = true
        conversionMultiplier = 1
      } else if (normUnit === 'mwh') {
        unitValid = true
        conversionMultiplier = 1000
      }
    } else if (fUnit.includes('/kg')) {
      if (normUnit === 'kg' || normUnit === 'kilogram') {
        unitValid = true
        conversionMultiplier = 1
      } else if (normUnit === 'ton' || normUnit === 'tonne' || normUnit === 'tonnes' || normUnit === 'mt') {
        unitValid = true
        conversionMultiplier = 1000
      }
    } else if (fUnit.includes('tonne-km')) {
      if (normUnit === 'tonne-km' || normUnit === 't-km' || normUnit === 'ton-km') {
        unitValid = true
        conversionMultiplier = 1
      }
    } else if (fUnit.includes('pass-km') || fUnit.includes('passenger-km')) {
      if (normUnit === 'pass-km' || normUnit === 'passenger-km' || normUnit === 'p-km') {
        unitValid = true
        conversionMultiplier = 1
      }
    }

    if (!unitValid) {
      return NextResponse.json({
        matched: false,
        error: `Emission Factor Not Configured — ESG Review Required. (Activity unit '${rawUnit}' incompatible with factor unit '${matchedFactor.factorUnit}')`,
        factor: matchedFactor,
        calculatedTco2e: 0,
        formula: `Unit mismatch: ${rawUnit} vs ${matchedFactor.factorUnit}`,
        timestamp: new Date().toISOString(),
      })
    }

    // Calculate deterministic tCO2e: (Quantity × multiplier × factorValue) / 1000
    const effectiveQty = qty * conversionMultiplier
    const tco2e = (effectiveQty * matchedFactor.factorValue) / 1000
    const roundedTco2e = Math.round(tco2e * 1000) / 1000

    const formula = `${qty.toLocaleString()} ${rawUnit} × ${matchedFactor.factorValue} ${matchedFactor.factorUnit} ÷ 1,000 = ${roundedTco2e.toFixed(3)} tCO₂e`

    return NextResponse.json({
      matched: true,
      factor: {
        id: matchedFactor.id,
        name: matchedFactor.name,
        category: matchedFactor.category,
        factorValue: matchedFactor.factorValue,
        factorUnit: matchedFactor.factorUnit,
        scope: matchedFactor.scope,
        source: matchedFactor.source,
        version: matchedFactor.version,
        methodology: matchedFactor.methodology,
        sourceDocument: matchedFactor.sourceDocument,
      },
      calculatedTco2e: roundedTco2e,
      formula,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Calculation engine failed' },
      { status: 500 }
    )
  }
}
