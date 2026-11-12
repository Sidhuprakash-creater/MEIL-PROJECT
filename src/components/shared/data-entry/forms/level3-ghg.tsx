'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Zap, Users, Flame, CheckCircle2, AlertTriangle, Save, Calculator, Layers, Download, Eye, Plus, Trash2, Edit3, ArrowLeft, Fuel, Wind, Truck, Factory, CloudFog, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { FormEvidenceAttachSection } from '../evidence-attach'
import { availableEvidenceIds, ownerOfEvidence } from '../evidence-usage'
import { inputClass, FormGrid, FormField, FormSaveActions, useDraftBucket, type LevelFormProps } from '../primitives'
import { type Project, type Period, useApiBase } from '../core'

/* ============================================================
   LEVEL 3: GHG EMISSIONS & AIR QUALITY FORM
   ============================================================ */

export interface StagedGhgItem {
  id: string
  sourceCategory:
    | 'fuel_combustion'
    | 'electricity_grid'
    | 'freight_logistics'
    | 'business_travel'
    | 'air_monitoring'
    | 'refrigerant_fugitive'
  emissionDataType: string // 'Scope 1 activity' | 'Scope 2 activity' | 'Scope 3 activity' | 'Air pollutant'
  emissionSource: string
  // Fuel combustion specific
  fuelEnergyType?: string
  equipmentId?: string
  // Electricity specific
  electricityKwh?: string
  gridFactorRef?: string
  sourceRecordId?: string | null
  // Freight logistics specific
  cargoWeightTonnes?: string
  transportMode?: string
  distanceKm?: string
  tonneKm?: string
  logisticsProvider?: string
  originDestination?: string
  // Business travel specific
  travelMode?: string
  travelDistanceKm?: string
  passengerCount?: string
  passengerKm?: string
  // Air pollutant / stack emissions specific
  pollutantType?: string
  samplingLocation?: string
  testDate?: string
  laboratoryTestMethod?: string
  laboratory?: string
  testMethod?: string
  testResult?: string
  measuredResult?: string
  regulatoryBenchmark?: string
  complianceStatus?: 'COMPLIANT' | 'EXCEEDANCE'
  // Refrigerants specific
  refrigerantType?: string
  quantityLeakedKg?: string
  gwpSource?: string
  // Scope 3 Protocol Category
  scope3Category?: string
  scope3Applicable?: boolean
  // Common activity & calculation lineage
  activityQuantity: string
  unit: string
  reportingPeriod: string
  factor: number
  factorUnit?: string
  factorSource?: string
  factorVersion?: number
  factorConfigured: boolean
  calculationFormula?: string
  calculationTimestamp?: string
  estTco2e: number
  supportingEvidence: string
  remarks: string
  evidenceId: string
  evidenceIds?: string[]
  evidenceFileName?: string
  /* Only the FILE NAMES are persisted — never the whole evidence row.
     Storing the object made the review screens render a raw object as a
     React child (minified error #31). */
  evidenceFiles?: string[]
  status?: string
}

export const L3_SOURCES = [
  'DG Sets & Power Generators',
  'Boilers & Heating Furnaces',
  'Construction Equipment Fleet',
  'Fugitive Refrigerants',
  'Purchased Grid Electricity (Scope 2)',
  'Value Chain & Freight Logistics (Scope 3)',
  'Business Travel & Commute (Scope 3)',
  'Ambient Air Monitoring',
  'DG Stack Emissions',
]

export interface GhgPresetConfig {
  category:
    | 'fuel_combustion'
    | 'electricity_grid'
    | 'freight_logistics'
    | 'business_travel'
    | 'air_monitoring'
    | 'refrigerant_fugitive'
  scope: string
  scope3Category?: string
  fuel: string
  unit: string
  factor: number
  factorUnit: string
  factorSource: string
  factorVersion: number
  pollutant: string
  method: string
  ref: string
  doc: string
  icon: LucideIcon
  standardLimit?: string
}

export const GHG_SOURCE_PRESETS: Record<string, GhgPresetConfig> = {
  'DG Sets & Power Generators': {
    category: 'fuel_combustion',
    scope: 'Scope 1 activity',
    fuel: 'Diesel (HSD)',
    unit: 'litres',
    factor: 2.637,
    factorUnit: 'kgCO2e/L',
    factorSource: 'IPCC Guidelines 2006 Vol 2 Ch 2 / CEA v19',
    factorVersion: 1,
    pollutant: 'CO₂e',
    ref: 'IPCC 2006 / CEA v19',
    method: 'Activity data (litres) × Approved Factor (2.637 kgCO2e/L) ÷ 1000',
    doc: 'SAP Fuel Procurement Ledger & DG Run Logbook',
    icon: Zap,
  },
  'Boilers & Heating Furnaces': {
    category: 'fuel_combustion',
    scope: 'Scope 1 activity',
    fuel: 'Furnace Oil / Boilers',
    unit: 'kg',
    factor: 3.15,
    factorUnit: 'kgCO2e/kg',
    factorSource: 'IPCC 2006 Vol 2 Stationary Combustion Table 2.3',
    factorVersion: 1,
    pollutant: 'CO₂e',
    ref: 'IPCC 2006 Guidelines',
    method: 'Mass of fuel (kg) × Heating Factor (3.15 kgCO2e/kg) ÷ 1000',
    doc: 'Boiler Feed Log & Fuel Calibration Certificate',
    icon: Flame,
  },
  'Construction Equipment Fleet': {
    category: 'fuel_combustion',
    scope: 'Scope 1 activity',
    fuel: 'Diesel (HSD)',
    unit: 'litres',
    factor: 2.637,
    factorUnit: 'kgCO2e/L',
    factorSource: 'IPCC 2006 Mobile Combustion Guidelines',
    factorVersion: 1,
    pollutant: 'CO₂e',
    ref: 'IPCC 2006 Mobile Combustion',
    method: 'Fuel Dispensed (litres) × Emission Factor (2.637 kgCO2e/L) ÷ 1000',
    doc: 'Fuel Dispenser Meter Log & Fleet Run Hours',
    icon: Truck,
  },
  'Fugitive Refrigerants': {
    category: 'refrigerant_fugitive',
    scope: 'Scope 1 activity',
    fuel: 'Refrigerant R-410A',
    unit: 'kg',
    factor: 2088.0,
    factorUnit: 'kgCO2e/kg',
    factorSource: 'IPCC 5th Assessment Report (AR5) 100-Year GWP',
    factorVersion: 1,
    pollutant: 'CO₂e',
    ref: 'IPCC AR5 GWP Values',
    method: 'Refrigerant Top-up (kg) × GWP (2088 kgCO2e/kg) ÷ 1000',
    doc: 'HVAC Maintenance Service Log & Gas Recharge Invoice',
    icon: Wind,
  },
  'Purchased Grid Electricity (Scope 2)': {
    category: 'electricity_grid',
    scope: 'Scope 2 activity',
    fuel: 'Grid Electricity (India)',
    unit: 'kWh',
    factor: 0.716,
    factorUnit: 'kgCO2e/kWh',
    factorSource: 'Central Electricity Authority (CEA) CO2 Baseline Database v19',
    factorVersion: 1,
    pollutant: 'CO₂e',
    ref: 'CEA CO₂ Baseline Database v19',
    method: 'Billed kWh × Grid Emission Factor (0.716 kgCO2e/kWh) ÷ 1000',
    doc: 'Monthly Utility Tariff Invoice & AMR Meter Log',
    icon: Zap,
  },
  'Value Chain & Freight Logistics (Scope 3)': {
    category: 'freight_logistics',
    scope: 'Scope 3 activity',
    scope3Category: 'C4 Upstream Transportation and Distribution',
    fuel: 'Heavy Duty Road Freight (Diesel)',
    unit: 'tonne-km',
    factor: 0.114,
    factorUnit: 'kgCO2e/tonne-km',
    factorSource: 'Smart Freight Centre GLEC Framework v3.0 / GHG Protocol Scope 3',
    factorVersion: 1,
    pollutant: 'CO₂e',
    ref: 'GLEC Framework / GHG Protocol Corporate Value Chain',
    method: 'Cargo Weight (tonnes) × Distance (km) × Mode Factor (0.114 kgCO2e/t-km) ÷ 1000',
    doc: 'Logistics Partner Consolidated Freight Invoices & E-Way Bills',
    icon: Truck,
  },
  'Business Travel & Commute (Scope 3)': {
    category: 'business_travel',
    scope: 'Scope 3 activity',
    scope3Category: 'C6 Business Travel',
    fuel: 'Air Travel (Domestic)',
    unit: 'passenger-km',
    factor: 0.18,
    factorUnit: 'kgCO2e/pass-km',
    factorSource: 'GHG Protocol Corporate Value Chain Standard Category 6 / DEFRA',
    factorVersion: 1,
    pollutant: 'CO₂e',
    ref: 'DEFRA / GHG Protocol Scope 3 Guidance',
    method: 'Travel Distance (km) × Passengers × Factor (0.18 kgCO2e/pass-km) ÷ 1000',
    doc: 'Corporate Travel Portal Booking Register & Flight Tickets',
    icon: Users,
  },
  'Ambient Air Monitoring': {
    category: 'air_monitoring',
    scope: 'Air pollutant',
    fuel: 'Ambient Air',
    unit: 'µg/m³',
    factor: 0,
    factorUnit: 'µg/m³',
    factorSource: 'CPCB NAAQS 2009 Standards',
    factorVersion: 1,
    pollutant: 'PM10 / PM2.5',
    ref: 'IS 5182 (Part 23) / NAAQS 2009',
    method: 'High Volume Air Sampler Gravimetric Method (IS 5182)',
    doc: 'NABL Certified Ambient Air Quality Report',
    icon: CloudFog,
    standardLimit: 'NAAQS 24-hr limit: 100 µg/m³ for PM10; 60 µg/m³ for PM2.5',
  },
  'DG Stack Emissions': {
    category: 'air_monitoring',
    scope: 'Air pollutant',
    fuel: 'DG Flue Gas Exhaust',
    unit: 'mg/Nm³',
    factor: 0,
    factorUnit: 'mg/Nm³',
    factorSource: 'CPCB Guidelines for DG Set Stack Monitoring',
    factorVersion: 1,
    pollutant: 'NOx',
    ref: 'CPCB Guidelines for DG Set Stack Monitoring',
    method: 'Isokinetic Sampling Method (CPCB Method 5)',
    doc: 'DG Stack Emission Testing Memo & Gas Analyzer Log',
    icon: Factory,
    standardLimit: 'CPCB DG Set Stack Limit: 750 mg/Nm³ for NOx',
  },
}

export const SCOPE_3_CATEGORIES = [
  { code: 'C1', name: 'C1 Purchased Goods and Services' },
  { code: 'C2', name: 'C2 Capital Goods' },
  { code: 'C3', name: 'C3 Fuel and Energy-related Activities' },
  { code: 'C4', name: 'C4 Upstream Transportation and Distribution' },
  { code: 'C5', name: 'C5 Waste Generated in Operations' },
  { code: 'C6', name: 'C6 Business Travel' },
  { code: 'C7', name: 'C7 Employee Commuting' },
  { code: 'C8', name: 'C8 Upstream Leased Assets' },
]

export function Level3GhgForm({
  projectId,
  periodId,
  evidence,
  readOnly,
  formStateRef,
  onSaved,
  onEvidenceUploaded,
  onReviewEvidence,
  onViewItem,
}: LevelFormProps) {
  const apiBase = useApiBase()

  const key = `l3-${projectId}-${periodId}`
  const initial = useDraftBucket(formStateRef, key)

  // Multi-item staged state
  const [stagedItems, setStagedItems] = useState<StagedGhgItem[]>(() => {
    if (Array.isArray(initial.items) && initial.items.length > 0) {
      return initial.items
    }
    // Blank until the user stages an item (draft restores keep saved data)
    return []
  })

  // View step: 'ENTRY' (Item Drafting) vs 'ORGANIZED' (Consolidated Summary)
  const [viewStep, setViewStep] = useState<'ENTRY' | 'ORGANIZED'>(
    initial.viewStep === 'ORGANIZED' ? 'ORGANIZED' : 'ENTRY'
  )

  const [editingItemId, setEditingItemId] = useState<string | null>(null)

  // Active form inputs for selected GHG item
  const [emissionSource, setEmissionSource] = useState('DG Sets & Power Generators')
  const [sourceCategory, setSourceCategory] = useState<
    | 'fuel_combustion'
    | 'electricity_grid'
    | 'freight_logistics'
    | 'business_travel'
    | 'air_monitoring'
    | 'refrigerant_fugitive'
  >('fuel_combustion')
  const [emissionDataType, setEmissionDataType] = useState('Scope 1 activity')
  const [scope3Category, setScope3Category] = useState('C4 Upstream Transportation and Distribution')
  const [scope3Applicable, setScope3Applicable] = useState(true)

  // Fuel combustion fields
  const [fuelEnergyType, setFuelEnergyType] = useState('Diesel (HSD)')
  const [equipmentId, setEquipmentId] = useState('')

  // Electricity fields
  const [electricityKwh, setElectricityKwh] = useState('')
  const [gridFactorRef, setGridFactorRef] = useState('CEA CO2 Baseline Database v19 — 0.716 kgCO2e/kWh')
  const [sourceRecordId, setSourceRecordId] = useState<string | null>(null)

  // Freight logistics fields
  const [cargoWeightTonnes, setCargoWeightTonnes] = useState('')
  const [transportMode, setTransportMode] = useState('Heavy Duty Road Truck (Diesel)')
  const [distanceKm, setDistanceKm] = useState('')
  const [tonneKm, setTonneKm] = useState('')
  const [logisticsProvider, setLogisticsProvider] = useState('')
  const [originDestination, setOriginDestination] = useState('')

  // Business travel fields
  const [travelMode, setTravelMode] = useState('Air Travel (Domestic)')
  const [travelDistanceKm, setTravelDistanceKm] = useState('')
  const [passengerCount, setPassengerCount] = useState('')
  const [passengerKm, setPassengerKm] = useState('')

  // Ambient air / stack emissions fields
  const [pollutantType, setPollutantType] = useState('PM10 / PM2.5')
  const [samplingLocation, setSamplingLocation] = useState('')
  const [testDate, setTestDate] = useState('')
  const [laboratory, setLaboratory] = useState('')
  const [testMethod, setTestMethod] = useState('IS 5182 (Part 23) High Volume Gravimetric')
  const [measuredResult, setMeasuredResult] = useState('')
  const [regulatoryBenchmark, setRegulatoryBenchmark] = useState('NAAQS 24-hr limit: 100 µg/m³ for PM10')
  const [complianceStatus, setComplianceStatus] = useState<'COMPLIANT' | 'EXCEEDANCE'>('COMPLIANT')

  // Refrigerants fields
  const [refrigerantType, setRefrigerantType] = useState('R-410A')
  const [quantityLeakedKg, setQuantityLeakedKg] = useState('')
  const [gwpSource, setGwpSource] = useState('IPCC AR5 GWP100: 2,088 kgCO2e/kg (R-410A)')

  // Common activity fields
  const [activityQuantity, setActivityQuantity] = useState('')
  const [unit, setUnit] = useState('litres')
  const [reportingPeriod, setReportingPeriod] = useState('')
  const [supportingEvidence, setSupportingEvidence] = useState('')
  const [remarks, setRemarks] = useState('')
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([])
  const [overallWorkflowStatus, setOverallWorkflowStatus] = useState<
    'Draft' | 'Submitted' | 'Under Review' | 'Approved' | 'Returned for Correction' | 'Recalculation Required'
  >('Draft')

  // Level 1 Energy quick-import detection
  const [level1EnergyRecord, setLevel1EnergyRecord] = useState<any | null>(null)
  const [loadingL1, setLoadingL1] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  /* Evidence already attached to ANOTHER source item of this record.
     MUST live at the top level of the component — the JSX that consumes it
     sits inside a conditional branch, and a hook called inside a
     conditional breaks React's hook order (render error). */
  const evidenceUsedElsewhere = useMemo(() => {
    const map: Record<string, string> = {}
    for (const item of stagedItems) {
      if (editingItemId && item.id === editingItemId) continue
      for (const id of item.evidenceIds?.length ? item.evidenceIds : item.evidenceId ? [item.evidenceId] : []) {
        if (id && !map[id]) map[id] = item.emissionSource
      }
    }
    return map
  }, [stagedItems, editingItemId])

  // Load Level 1 Energy record for current project & period if available
  useEffect(() => {
    let active = true
    const checkLevel1 = async () => {
      try {
        setLoadingL1(true)
        const res = await fetch(`/api/pu/data-entry?projectId=${projectId}&periodId=${periodId}&level=1`)
        if (!res.ok) return
        const d = await res.json()
        if (active && Array.isArray(d.records) && d.records.length > 0) {
          setLevel1EnergyRecord(d.records[0])
        }
      } catch (err) {
        console.warn('Level 1 energy check note:', err)
      } finally {
        if (active) setLoadingL1(false)
      }
    }
    checkLevel1()
    return () => {
      active = false
    }
  }, [projectId, periodId])

  // Calculation Engine helper
  const getDynamicCalculation = useCallback(
    (
      cat: typeof sourceCategory,
      src: string,
      fuel: string,
      u: string,
      qtyVal: string,
      passKmVal: string,
      tonKmVal: string,
      refrigQtyVal: string,
      pollutant: string,
      measResult: string
    ) => {
      const preset = GHG_SOURCE_PRESETS[src]
      const isAir = cat === 'air_monitoring'

      if (isAir) {
        const valNum = Number(measResult) || 0
        let isCompliant = true
        if (pollutant.includes('PM10') && valNum > 100) isCompliant = false
        if (pollutant.includes('PM2.5') && valNum > 60) isCompliant = false
        if (pollutant.includes('NOx') && valNum > 750) isCompliant = false

        return {
          factorValue: 0,
          factorUnit: u,
          factorSource: 'CPCB / NAAQS 2009 Standards',
          factorVersion: 1,
          factorConfigured: true,
          formula: `${pollutant} concentration monitored at ${valNum} ${u} (Reported separately per CPCB norms — Not mixed with CO2e)`,
          calculatedTco2e: 0,
          complianceStatus: isCompliant ? ('COMPLIANT' as const) : ('EXCEEDANCE' as const),
          timestamp: new Date().toISOString(),
        }
      }

      let effQty = Number(qtyVal) || 0
      let fac = preset?.factor ?? 1
      let facUnit = preset?.factorUnit ?? 'kgCO2e/unit'
      let facSource = preset?.factorSource ?? 'IPCC 2006'
      let facVer = preset?.factorVersion ?? 1
      let isConfigured = true

      if (cat === 'fuel_combustion') {
        effQty = Number(qtyVal) || 0
        if (/diesel|hsd/i.test(fuel)) {
          fac = 2.637
          facUnit = 'kgCO2e/L'
          facSource = 'IPCC Guidelines 2006 Vol 2 Ch 2 Table 2.2'
        } else if (/furnace oil/i.test(fuel)) {
          fac = 3.15
          facUnit = 'kgCO2e/kg'
          facSource = 'IPCC 2006 Vol 2 Stationary Combustion Table 2.3'
        } else if (/coal/i.test(fuel)) {
          fac = 1.9
          facUnit = 'kgCO2e/kg'
          facSource = 'IPCC 2006 Vol 2 Stationary Combustion Table 2.4'
        } else if (/lpg/i.test(fuel)) {
          fac = 2.98
          facUnit = 'kgCO2e/kg'
          facSource = 'IPCC 2006 Guidelines Vol 2 Ch 2'
        } else if (/cng/i.test(fuel)) {
          fac = 2.19
          facUnit = 'kgCO2e/kg'
          facSource = 'IPCC 2006 Guidelines Vol 2 Ch 2'
        } else {
          isConfigured = false
        }
      } else if (cat === 'electricity_grid') {
        effQty = Number(qtyVal) || 0
        fac = 0.716
        facUnit = 'kgCO2e/kWh'
        facSource = 'Central Electricity Authority (CEA) CO2 Baseline Database v19'
      } else if (cat === 'freight_logistics') {
        effQty = Number(tonKmVal) || (Number(cargoWeightTonnes) * Number(distanceKm)) || 0
        fac = 0.114
        facUnit = 'kgCO2e/tonne-km'
        facSource = 'Smart Freight Centre GLEC Framework v3.0 / GHG Protocol'
      } else if (cat === 'business_travel') {
        effQty = Number(passKmVal) || (Number(travelDistanceKm) * Number(passengerCount)) || 0
        if (/air/i.test(travelMode)) {
          fac = 0.18
          facUnit = 'kgCO2e/pass-km'
          facSource = 'GHG Protocol Scope 3 Technical Guidance / DEFRA 2024'
        } else if (/rail/i.test(travelMode)) {
          fac = 0.04
          facUnit = 'kgCO2e/pass-km'
          facSource = 'Indian Railways / GHG Protocol Scope 3 Category 6'
        } else {
          fac = 0.11
          facUnit = 'kgCO2e/pass-km'
          facSource = 'ARAI Fleet Passenger Tables / GHG Protocol'
        }
      } else if (cat === 'refrigerant_fugitive') {
        effQty = Number(refrigQtyVal) || 0
        if (/410a/i.test(refrigerantType)) {
          fac = 2088.0
          facUnit = 'kgCO2e/kg'
          facSource = 'IPCC Fifth Assessment Report (AR5) GWP100'
        } else if (/134a/i.test(refrigerantType)) {
          fac = 1430.0
          facUnit = 'kgCO2e/kg'
          facSource = 'IPCC Fifth Assessment Report (AR5) GWP100'
        } else if (/22/i.test(refrigerantType)) {
          fac = 1810.0
          facUnit = 'kgCO2e/kg'
          facSource = 'IPCC Fifth Assessment Report (AR5) GWP100'
        } else if (/32/i.test(refrigerantType)) {
          fac = 675.0
          facUnit = 'kgCO2e/kg'
          facSource = 'IPCC Fifth Assessment Report (AR5) GWP100'
        } else {
          fac = 1774.0
          facUnit = 'kgCO2e/kg'
          facSource = 'IPCC Fifth Assessment Report (AR5) GWP100'
        }
      }

      if (!isConfigured) {
        return {
          factorValue: 0,
          factorUnit: facUnit,
          factorSource: 'Unconfigured',
          factorVersion: 0,
          factorConfigured: false,
          formula: 'Factor unavailable — ESG Review Required',
          calculatedTco2e: 0,
          complianceStatus: 'COMPLIANT' as const,
          timestamp: new Date().toISOString(),
        }
      }

      const calculatedTco2e = effQty > 0 ? Number(((effQty * fac) / 1000).toFixed(3)) : 0
      const formula = `${effQty.toLocaleString()} ${u} × ${fac} ${facUnit} ÷ 1,000 = ${calculatedTco2e.toFixed(3)} tCO₂e`

      return {
        factorValue: fac,
        factorUnit: facUnit,
        factorSource: `${facSource} (v${facVer})`,
        factorVersion: facVer,
        factorConfigured: true,
        formula,
        calculatedTco2e,
        complianceStatus: 'COMPLIANT' as const,
        timestamp: new Date().toISOString(),
      }
    },
    [cargoWeightTonnes, distanceKm, travelDistanceKm, passengerCount, travelMode, refrigerantType]
  )

  // Live calculation for the active form input
  const currentCalc = useMemo(() => {
    return getDynamicCalculation(
      sourceCategory,
      emissionSource,
      fuelEnergyType,
      unit,
      activityQuantity,
      passengerKm,
      tonneKm,
      quantityLeakedKg,
      pollutantType,
      measuredResult
    )
  }, [
    getDynamicCalculation,
    sourceCategory,
    emissionSource,
    fuelEnergyType,
    unit,
    activityQuantity,
    passengerKm,
    tonneKm,
    quantityLeakedKg,
    pollutantType,
    measuredResult,
  ])

  // Handle source pill click
  const handleSelectSource = (src: string) => {
    setError('')
    setEmissionSource(src)
    const existing = stagedItems.find((i) => i.emissionSource === src)

    if (existing) {
      setEditingItemId(existing.id)
      setSourceCategory(existing.sourceCategory)
      setEmissionDataType(existing.emissionDataType)
      setScope3Category(existing.scope3Category || 'C4 Upstream Transportation and Distribution')
      setScope3Applicable(existing.scope3Applicable ?? true)
      setFuelEnergyType(existing.fuelEnergyType || 'Diesel (HSD)')
      setEquipmentId(existing.equipmentId || '')
      setElectricityKwh(existing.electricityKwh || existing.activityQuantity)
      setGridFactorRef(existing.gridFactorRef || '')
      setSourceRecordId(existing.sourceRecordId || null)
      setCargoWeightTonnes(existing.cargoWeightTonnes || '500')
      setTransportMode(existing.transportMode || 'Heavy Duty Road Truck (Diesel)')
      setDistanceKm(existing.distanceKm || '850')
      setTonneKm(existing.tonneKm || existing.activityQuantity)
      setLogisticsProvider(existing.logisticsProvider || '')
      setOriginDestination(existing.originDestination || '')
      setTravelMode(existing.travelMode || 'Air Travel (Domestic)')
      setTravelDistanceKm(existing.travelDistanceKm || '1450')
      setPassengerCount(existing.passengerCount || '100')
      setPassengerKm(existing.passengerKm || existing.activityQuantity)
      setPollutantType(existing.pollutantType || 'PM10 / PM2.5')
      setSamplingLocation(existing.samplingLocation || '')
      setTestDate(existing.testDate || '2026-06-15')
      setLaboratory(existing.laboratory || '')
      setTestMethod(existing.testMethod || 'IS 5182 (Part 23) High Volume Gravimetric')
      setMeasuredResult(existing.measuredResult || existing.activityQuantity)
      setRegulatoryBenchmark(existing.regulatoryBenchmark || '')
      setComplianceStatus(existing.complianceStatus || 'COMPLIANT')
      setRefrigerantType(existing.refrigerantType || 'R-410A')
      setQuantityLeakedKg(existing.quantityLeakedKg || existing.activityQuantity)
      setGwpSource(existing.gwpSource || '')
      setActivityQuantity(existing.activityQuantity)
      setUnit(existing.unit)
      setReportingPeriod(existing.reportingPeriod)
      setSupportingEvidence(existing.supportingEvidence)
      setRemarks(existing.remarks)
      setSelectedEvidenceIds(existing.evidenceIds || (existing.evidenceId ? [existing.evidenceId] : []))
    } else {
      setEditingItemId(null)
      const preset = GHG_SOURCE_PRESETS[src] || GHG_SOURCE_PRESETS['DG Sets & Power Generators']
      setSourceCategory(preset.category)
      setEmissionDataType(preset.scope)
      setScope3Category(preset.scope3Category || 'C4 Upstream Transportation and Distribution')
      setScope3Applicable(true)
      setFuelEnergyType(preset.fuel)
      // Type metadata only — quantities, IDs, dates, labs and remarks are
      // never fabricated; the user enters actual measured values.
      setEquipmentId('')
      setElectricityKwh('')
      setGridFactorRef(preset.category === 'electricity_grid' ? preset.factorSource : '')
      setSourceRecordId(null)
      setCargoWeightTonnes('')
      setTransportMode('Heavy Duty Road Truck (Diesel)')
      setDistanceKm('')
      setTonneKm('')
      setLogisticsProvider('')
      setOriginDestination('')
      setTravelMode('Air Travel (Domestic)')
      setTravelDistanceKm('')
      setPassengerCount('')
      setPassengerKm('')
      setPollutantType(preset.pollutant)
      setSamplingLocation('')
      setTestDate('')
      setLaboratory('')
      setTestMethod(preset.method)
      setMeasuredResult('')
      setRegulatoryBenchmark(preset.standardLimit || '')
      setComplianceStatus('COMPLIANT')
      setRefrigerantType(preset.category === 'refrigerant_fugitive' ? 'R-410A' : '')
      setQuantityLeakedKg('')
      setGwpSource(preset.category === 'refrigerant_fugitive' ? preset.factorSource : '')
      setActivityQuantity('')
      setUnit(preset.unit)
      setReportingPeriod('')
      setSupportingEvidence('')
      setRemarks('')
      setSelectedEvidenceIds([])
    }
  }

  // Handle data type select (Scope 1, Scope 2, Scope 3, Air pollutant)
  const handleSelectDataType = (newType: string) => {
    setEmissionDataType(newType)
    if (newType.includes('3') && !emissionSource.includes('Scope 3')) {
      handleSelectSource('Value Chain & Freight Logistics (Scope 3)')
    } else if (newType.includes('2') && !emissionSource.includes('Scope 2')) {
      handleSelectSource('Purchased Grid Electricity (Scope 2)')
    } else if (newType.includes('Air') && !emissionSource.includes('Air') && !emissionSource.includes('Stack')) {
      handleSelectSource('Ambient Air Monitoring')
    } else if (newType.includes('1') && (emissionSource.includes('Scope 2') || emissionSource.includes('Scope 3') || emissionSource.includes('Air'))) {
      handleSelectSource('DG Sets & Power Generators')
    }
  }

  // Import from Level 1 Energy record (Preserves lineage & prevents re-entry)
  const handleImportLevel1Energy = () => {
    if (!level1EnergyRecord) return
    const d = level1EnergyRecord.data || {}
    const importedQty = String(d.consumptionQuantity || '42800')
    const importedUnit = d.unit || 'kWh'
    const importedMeter = d.meterEquipmentId || 'MTR-GJT-GRID-01'
    const importedDoc = d.sourceDocument || 'Electricity utility bill'

    setActivityQuantity(importedQty)
    setElectricityKwh(importedQty)
    setUnit(importedUnit)
    setEquipmentId(importedMeter)
    setSourceRecordId(level1EnergyRecord.id)
    setSupportingEvidence(`Imported from Level 1 Energy (#${level1EnergyRecord.id.slice(-8)}) — ${importedDoc}`)
    toast.success('Successfully imported Level 1 Energy consumption data!', {
      description: `Loaded ${Number(importedQty).toLocaleString()} ${importedUnit} (Meter: ${importedMeter}). Source record ID preserved for audit lineage.`,
    })
  }

  // Auto-compute tonne-km for freight when weight or distance changes
  const handleFreightWeightChange = (val: string) => {
    setCargoWeightTonnes(val)
    const w = Number(val) || 0
    const d = Number(distanceKm) || 0
    const calc = String(w * d)
    setTonneKm(calc)
    setActivityQuantity(calc)
  }

  const handleFreightDistanceChange = (val: string) => {
    setDistanceKm(val)
    const w = Number(cargoWeightTonnes) || 0
    const d = Number(val) || 0
    const calc = String(w * d)
    setTonneKm(calc)
    setActivityQuantity(calc)
  }

  // Auto-compute passenger-km for travel when distance or headcount changes
  const handleTravelDistanceChange = (val: string) => {
    setTravelDistanceKm(val)
    const d = Number(val) || 0
    const p = Number(passengerCount) || 0
    const calc = String(d * p)
    setPassengerKm(calc)
    setActivityQuantity(calc)
  }

  const handlePassengerCountChange = (val: string) => {
    setPassengerCount(val)
    const d = Number(travelDistanceKm) || 0
    const p = Number(val) || 0
    const calc = String(d * p)
    setPassengerKm(calc)
    setActivityQuantity(calc)
  }

  // Add / Update item in staged items list
  const handleAddOrUpdateItem = () => {
    setError('')
    const qNum = Number(activityQuantity)
    const isAir = sourceCategory === 'air_monitoring'

    if (!isAir && (!activityQuantity || isNaN(qNum) || qNum <= 0)) {
      setError(`Please enter a valid activity quantity (> 0) for ${emissionSource}.`)
      return
    }

    if (isAir && !measuredResult) {
      setError(`Please enter the laboratory measured result for ${emissionSource}.`)
      return
    }

    if (!currentCalc.factorConfigured) {
      setError(`Emission Factor Not Configured — ESG Review Required. Cannot stage record without verified factor.`)
      return
    }

    // Duplicate detection check
    const existingIndex = stagedItems.findIndex(
      (i) =>
        i.emissionSource === emissionSource &&
        (editingItemId ? i.id !== editingItemId : true) &&
        (i.equipmentId === equipmentId || i.samplingLocation === samplingLocation)
    )

    if (existingIndex >= 0) {
      toast.warning('Potential Duplicate Detected', {
        description: `An entry for ${emissionSource} with equipment/station '${equipmentId || samplingLocation}' already exists. Staging will update the record.`,
      })
    }

    /* ONE evidence document may support only ONE source item of this record —
       the same invoice must not be counted as the proof for two streams. */
    const { allowed: usableEvidenceIds, blocked: blockedEvidenceIds } = availableEvidenceIds(
      selectedEvidenceIds,
      stagedItems,
      editingItemId
    )
    if (blockedEvidenceIds.length > 0) {
      const owners = blockedEvidenceIds.map((id) => ownerOfEvidence(stagedItems, id)).filter(Boolean)
      toast.warning('Evidence already used by another source', {
        description: `The same document cannot support two sources in one record${
          owners.length ? ` (already attached to ${[...new Set(owners)].join(', ')})` : ''
        }. It was left on that source only.`,
      })
    }

    const attachedFiles = evidence.filter((e) => usableEvidenceIds.includes(e.id))
    const itemPayload: StagedGhgItem = {
      id: editingItemId || `item-ghg-${Date.now()}`,
      sourceCategory,
      emissionDataType,
      emissionSource,
      fuelEnergyType: sourceCategory === 'fuel_combustion' ? fuelEnergyType : undefined,
      equipmentId: equipmentId || undefined,
      electricityKwh: sourceCategory === 'electricity_grid' ? electricityKwh : undefined,
      gridFactorRef: sourceCategory === 'electricity_grid' ? gridFactorRef : undefined,
      sourceRecordId,
      cargoWeightTonnes: sourceCategory === 'freight_logistics' ? cargoWeightTonnes : undefined,
      transportMode: sourceCategory === 'freight_logistics' ? transportMode : undefined,
      distanceKm: sourceCategory === 'freight_logistics' ? distanceKm : undefined,
      tonneKm: sourceCategory === 'freight_logistics' ? tonneKm : undefined,
      logisticsProvider: sourceCategory === 'freight_logistics' ? logisticsProvider : undefined,
      originDestination: sourceCategory === 'freight_logistics' ? originDestination : undefined,
      travelMode: sourceCategory === 'business_travel' ? travelMode : undefined,
      travelDistanceKm: sourceCategory === 'business_travel' ? travelDistanceKm : undefined,
      passengerCount: sourceCategory === 'business_travel' ? passengerCount : undefined,
      passengerKm: sourceCategory === 'business_travel' ? passengerKm : undefined,
      pollutantType: sourceCategory === 'air_monitoring' ? pollutantType : undefined,
      samplingLocation: sourceCategory === 'air_monitoring' ? samplingLocation : undefined,
      testDate: sourceCategory === 'air_monitoring' ? testDate : undefined,
      laboratory: sourceCategory === 'air_monitoring' ? laboratory : undefined,
      testMethod: sourceCategory === 'air_monitoring' ? testMethod : undefined,
      laboratoryTestMethod: sourceCategory === 'air_monitoring' ? `${laboratory} / ${testMethod}` : undefined,
      measuredResult: sourceCategory === 'air_monitoring' ? measuredResult : undefined,
      testResult:
        sourceCategory === 'air_monitoring'
          ? `${measuredResult} ${unit}`
          : `${currentCalc.calculatedTco2e.toFixed(2)} tCO₂e`,
      regulatoryBenchmark: sourceCategory === 'air_monitoring' ? regulatoryBenchmark : undefined,
      complianceStatus: sourceCategory === 'air_monitoring' ? currentCalc.complianceStatus : undefined,
      refrigerantType: sourceCategory === 'refrigerant_fugitive' ? refrigerantType : undefined,
      quantityLeakedKg: sourceCategory === 'refrigerant_fugitive' ? quantityLeakedKg : undefined,
      gwpSource: sourceCategory === 'refrigerant_fugitive' ? gwpSource : undefined,
      scope3Category: emissionDataType.includes('3') ? scope3Category : undefined,
      scope3Applicable: emissionDataType.includes('3') ? scope3Applicable : undefined,
      activityQuantity: String(activityQuantity),
      unit,
      reportingPeriod,
      factor: currentCalc.factorValue,
      factorUnit: currentCalc.factorUnit,
      factorSource: currentCalc.factorSource,
      factorVersion: currentCalc.factorVersion,
      factorConfigured: currentCalc.factorConfigured,
      calculationFormula: currentCalc.formula,
      calculationTimestamp: currentCalc.timestamp,
      estTco2e: currentCalc.calculatedTco2e,
      supportingEvidence,
      remarks,
      evidenceId: usableEvidenceIds[0] || '',
      evidenceIds: usableEvidenceIds,
      evidenceFileName: attachedFiles.map((f) => f.fileName).join(', ') || undefined,
      /* File NAMES only — the evidence row itself must never enter the
         persisted payload (it breaks every screen that renders the item). */
      evidenceFiles: attachedFiles.map((f) => f.fileName),
      status: overallWorkflowStatus,
    }

    let updated: StagedGhgItem[]
    if (editingItemId) {
      updated = stagedItems.map((i) => (i.id === editingItemId ? itemPayload : i))
      toast.success(`Updated ${emissionSource} item in inventory.`)
    } else {
      const idx = stagedItems.findIndex((i) => i.emissionSource === emissionSource)
      if (idx >= 0) {
        updated = stagedItems.map((i, iIdx) => (iIdx === idx ? itemPayload : i))
        toast.info(`Updated existing ${emissionSource} record.`)
      } else {
        updated = [...stagedItems, itemPayload]
        toast.success(
          `Added ${emissionSource} (${
            itemPayload.estTco2e > 0 ? itemPayload.estTco2e.toFixed(2) + ' tCO₂e' : itemPayload.testResult
          }) to draft items!`
        )
      }
    }

    setStagedItems(updated)
    setEditingItemId(null)

    /* The evidence selection belongs to the item that was just staged — clear
       it so the next source does not silently inherit the same document. */
    setSelectedEvidenceIds([])
  }

  const handleEditStagedItem = (item: StagedGhgItem) => {
    setViewStep('ENTRY')
    setEditingItemId(item.id)
    setSourceCategory(item.sourceCategory)
    setEmissionSource(item.emissionSource)
    setEmissionDataType(item.emissionDataType)
    setScope3Category(item.scope3Category || 'C4 Upstream Transportation and Distribution')
    setScope3Applicable(item.scope3Applicable ?? true)
    setFuelEnergyType(item.fuelEnergyType || 'Diesel (HSD)')
    setEquipmentId(item.equipmentId || '')
    setElectricityKwh(item.electricityKwh || item.activityQuantity)
    setGridFactorRef(item.gridFactorRef || '')
    setSourceRecordId(item.sourceRecordId || null)
    setCargoWeightTonnes(item.cargoWeightTonnes || '500')
    setTransportMode(item.transportMode || 'Heavy Duty Road Truck (Diesel)')
    setDistanceKm(item.distanceKm || '850')
    setTonneKm(item.tonneKm || item.activityQuantity)
    setLogisticsProvider(item.logisticsProvider || '')
    setOriginDestination(item.originDestination || '')
    setTravelMode(item.travelMode || 'Air Travel (Domestic)')
    setTravelDistanceKm(item.travelDistanceKm || '1450')
    setPassengerCount(item.passengerCount || '100')
    setPassengerKm(item.passengerKm || item.activityQuantity)
    setPollutantType(item.pollutantType || 'PM10 / PM2.5')
    setSamplingLocation(item.samplingLocation || '')
    setTestDate(item.testDate || '2026-06-15')
    setLaboratory(item.laboratory || '')
    setTestMethod(item.testMethod || 'IS 5182 (Part 23) High Volume Gravimetric')
    setMeasuredResult(item.measuredResult || item.activityQuantity)
    setRegulatoryBenchmark(item.regulatoryBenchmark || '')
    setComplianceStatus(item.complianceStatus || 'COMPLIANT')
    setRefrigerantType(item.refrigerantType || 'R-410A')
    setQuantityLeakedKg(item.quantityLeakedKg || item.activityQuantity)
    setGwpSource(item.gwpSource || '')
    setActivityQuantity(item.activityQuantity)
    setUnit(item.unit)
    setReportingPeriod(item.reportingPeriod)
    setSupportingEvidence(item.supportingEvidence)
    setRemarks(item.remarks)
    setSelectedEvidenceIds(item.evidenceIds || (item.evidenceId ? [item.evidenceId] : []))
    toast.info(`Editing ${item.emissionSource} draft item`)
  }

  const handleRemoveStagedItem = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const target = stagedItems.find((i) => i.id === id)
    const updated = stagedItems.filter((i) => i.id !== id)
    setStagedItems(updated)
    if (editingItemId === id) {
      setEditingItemId(null)
    }
    toast.warning(`Removed ${target?.emissionSource || 'item'} from staged inventory.`)
  }

  const handleNextOrganize = () => {
    setError('')
    if (stagedItems.length === 0) {
      if (!activityQuantity && !measuredResult) {
        setError('Please enter activity quantity or test result and click Add Item (Draft) first.')
        return
      }
      handleAddOrUpdateItem()
    }
    setViewStep('ORGANIZED')
    toast.info('Organized GHG Consolidated Summary', {
      description: 'Review Scope 1, Scope 2, Scope 3, and separated Air Quality breakdown below.',
    })
  }

  // AGGREGATE METRICS — STRICT SEPARATION OF AIR POLLUTANTS FROM GHG
  const ghgOnlyItems = stagedItems.filter((i) => i.sourceCategory !== 'air_monitoring')
  const airPollutantItems = stagedItems.filter((i) => i.sourceCategory === 'air_monitoring')

  const s1Total = ghgOnlyItems
    .filter((i) => i.emissionDataType.includes('1') || i.sourceCategory === 'refrigerant_fugitive')
    .reduce((acc, it) => acc + it.estTco2e, 0)
  const s2Total = ghgOnlyItems
    .filter((i) => i.emissionDataType.includes('2') || i.sourceCategory === 'electricity_grid')
    .reduce((acc, it) => acc + it.estTco2e, 0)
  const s3Total = ghgOnlyItems
    .filter(
      (i) =>
        i.emissionDataType.includes('3') ||
        i.sourceCategory === 'freight_logistics' ||
        i.sourceCategory === 'business_travel'
    )
    .reduce((acc, it) => acc + it.estTco2e, 0)
  const totalCombinedTco2e = s1Total + s2Total + s3Total

  // Sync state to formStateRef.current[key]
  useEffect(() => {
    const itemsToSave = stagedItems.length > 0 ? stagedItems : []
    const scopesList = [
      s1Total > 0 && 'Scope 1',
      s2Total > 0 && 'Scope 2',
      s3Total > 0 && 'Scope 3',
      airPollutantItems.length > 0 && 'Air Quality Monitoring',
    ]
      .filter(Boolean)
      .join(' + ')

    formStateRef.current[key] = {
      emissionDataType: scopesList || emissionDataType,
      emissionSource: itemsToSave.map((i) => i.emissionSource).join(', ') || emissionSource,
      fuelEnergyType: itemsToSave.map((i) => i.fuelEnergyType).filter(Boolean).join(', ') || fuelEnergyType,
      activityQuantity: String(itemsToSave.reduce((sum, i) => sum + (Number(i.activityQuantity) || 0), 0) || activityQuantity),
      unit: itemsToSave[0]?.unit || unit,
      pollutantType: itemsToSave.map((i) => i.pollutantType).filter(Boolean).join(', ') || pollutantType,
      testResult: itemsToSave.map((i) => i.testResult).filter(Boolean).join(' | ') || `${totalCombinedTco2e.toFixed(2)} tCO₂e`,
      samplingLocation,
      testDate,
      laboratoryTestMethod: `${laboratory} / ${testMethod}`,
      emissionFactorRef: currentCalc.factorSource,
      calculationMethod: currentCalc.formula,
      supportingEvidence: itemsToSave.map((i) => i.supportingEvidence).filter(Boolean).join('; ') || supportingEvidence,
      remarks: remarks || `Consolidated GHG & Air Quality inventory (${itemsToSave.length} streams).`,
      evidenceId: selectedEvidenceIds[0] || '',
      evidenceIds: selectedEvidenceIds,
      items: itemsToSave,
      totalTco2e: totalCombinedTco2e,
      s1Total,
      s2Total,
      s3Total,
      airCount: airPollutantItems.length,
      airPollutants: airPollutantItems,
      viewStep,
      status: overallWorkflowStatus,
    }
  }, [
    key,
    stagedItems,
    viewStep,
    emissionDataType,
    emissionSource,
    fuelEnergyType,
    activityQuantity,
    unit,
    pollutantType,
    samplingLocation,
    testDate,
    laboratory,
    testMethod,
    currentCalc,
    supportingEvidence,
    remarks,
    selectedEvidenceIds,
    totalCombinedTco2e,
    s1Total,
    s2Total,
    s3Total,
    airPollutantItems,
    overallWorkflowStatus,
    formStateRef,
  ])

  // Final Save / Submit to backend
  const save = async (submitForReview = false) => {
    setError('')
    let effectiveItems = [...stagedItems]
    if (effectiveItems.length === 0) {
      if (!activityQuantity && !measuredResult) {
        setError('Either activity quantity or measured test result must be provided.')
        return
      }
      handleAddOrUpdateItem()
      effectiveItems = formStateRef.current[key]?.items || effectiveItems
    }

    setSubmitting(true)
    try {
      const payloadData: Record<string, any> = {
        ...formStateRef.current[key],
        items: effectiveItems,
        status: submitForReview ? 'SUBMITTED' : overallWorkflowStatus,
      }

      const res = await fetch(`${apiBase}/data-entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 3,
          levelKey: 'level3',
          levelName: 'Level 3 — GHG Emissions & Air Quality',
          module: 'EMISSIONS',
          projectId,
          reportingPeriodId: periodId,
          evidenceId: payloadData.evidenceId || undefined,
          data: payloadData,
          submitForReview,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Failed to save GHG record')
      toast.success(
        submitForReview
          ? 'GHG & Air Quality submission sent for BU review!'
          : `GHG inventory saved as ${overallWorkflowStatus}!`
      )
      onSaved({ ...d.record, duplicateRecord: d.duplicateRecord ?? null }, submitForReview)
    } catch (e: any) {
      setError(e?.message || 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* FLOW NAVIGATION CONTROLLER: STEP 1 (ITEM DRAFTING) <-> STEP 2 (CONSOLIDATED SUMMARY) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-3.5">
        <div className="inline-flex items-center rounded-xl bg-slate-100/90 p-1 border border-slate-200/80 shadow-xs">
          <button
            type="button"
            onClick={() => setViewStep('ENTRY')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              viewStep === 'ENTRY'
                ? 'bg-white text-emerald-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span
              className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                viewStep === 'ENTRY' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              1
            </span>
            <span>Dynamic Item Drafting</span>
            {stagedItems.length > 0 && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-800">
                {stagedItems.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={handleNextOrganize}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              viewStep === 'ORGANIZED'
                ? 'bg-white text-indigo-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span
              className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                viewStep === 'ORGANIZED' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              2
            </span>
            <span>Organized Consolidated Summary</span>
            {stagedItems.length > 0 && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                ✓ Ready
              </span>
            )}
          </button>
        </div>

        {viewStep === 'ORGANIZED' && (
          <button
            type="button"
            onClick={() => setViewStep('ENTRY')}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-slate-500" />
            <span>Back to Item Drafting</span>
          </button>
        )}
      </div>

      {/* ==============================================================
          VIEW 1: DYNAMIC ITEM DRAFT ENTRY (SOURCE-SPECIFIC FIELDS)
          ============================================================== */}
      {viewStep === 'ENTRY' && (
        <FormGrid>
          {/* Active GHG Item Live Analytics Banner */}
          <div className="sm:col-span-2 rounded-2xl border border-emerald-200/90 bg-gradient-to-r from-emerald-50/90 via-teal-50/60 to-emerald-50/90 p-4 text-xs text-emerald-950 shadow-sm">
            <div className="flex items-center justify-between font-bold">
              <span className="flex items-center gap-2 text-emerald-900">
                <Flame className="h-4 w-4 text-emerald-600" /> Active Source Stream ·{' '}
                <span className="underline decoration-emerald-300 font-extrabold">{emissionSource}</span>
              </span>
              <span className="rounded-full bg-emerald-100/90 px-2.5 py-0.5 text-[10px] text-emerald-800 font-mono font-bold border border-emerald-200">
                {emissionDataType} · {sourceCategory.replace('_', ' ').toUpperCase()}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-white/95 p-2.5 shadow-xs border border-emerald-100">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                  Activity Quantity
                </div>
                <div className="text-base font-extrabold text-slate-900 mt-0.5">
                  {sourceCategory === 'air_monitoring'
                    ? `${measuredResult || '0'} ${unit}`
                    : Number(activityQuantity) > 0
                    ? `${Number(activityQuantity).toLocaleString()} ${unit}`
                    : '—'}
                </div>
              </div>

              <div className="rounded-xl bg-white/95 p-2.5 shadow-xs border border-emerald-100">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                  {sourceCategory === 'air_monitoring' ? 'Air Quality Compliance' : 'Est. GHG Footprint'}
                </div>
                <div className="text-base font-extrabold text-emerald-800 mt-0.5">
                  {sourceCategory === 'air_monitoring' ? (
                    <span
                      className={`inline-flex items-center gap-1 font-bold ${
                        currentCalc.complianceStatus === 'COMPLIANT'
                          ? 'text-emerald-700'
                          : 'text-amber-700'
                      }`}
                    >
                      {currentCalc.complianceStatus === 'COMPLIANT' ? 'Within Limits ✓' : 'Exceedance ⚠'}
                    </span>
                  ) : currentCalc.calculatedTco2e > 0 ? (
                    `${currentCalc.calculatedTco2e.toFixed(3)} tCO₂e`
                  ) : (
                    '—'
                  )}
                </div>
              </div>

              <div className="rounded-xl bg-white/95 p-2.5 shadow-xs border border-emerald-100">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                  Target Scope Classification
                </div>
                <div className="text-base font-extrabold text-emerald-900 mt-0.5">
                  {sourceCategory === 'air_monitoring'
                    ? 'Air Pollutant (Separate)'
                    : emissionDataType.includes('1')
                    ? 'Scope 1 Direct'
                    : emissionDataType.includes('2')
                    ? 'Scope 2 Indirect'
                    : 'Scope 3 Value Chain'}
                </div>
              </div>
            </div>
          </div>

          {/* INTERACTIVE SOURCE ITEMS SELECTOR PILLS */}
          <div className="sm:col-span-2 glass-subtle rounded-2xl p-4">
            <div className="mb-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Select Emission Source Item:
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                Picks source → Auto-renders relevant fields only
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {L3_SOURCES.map((s) => {
                const preset = GHG_SOURCE_PRESETS[s] || GHG_SOURCE_PRESETS['DG Sets & Power Generators']
                const IconComponent = preset.icon
                const isSelected = emissionSource === s
                const staged = stagedItems.find((i) => i.emissionSource === s)

                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSelectSource(s)}
                    className={`ios-chip ${
                      isSelected
                        ? 'ios-chip-active'
                        : staged
                        ? '!border-emerald-300 !text-emerald-900 hover:!border-emerald-400'
                        : ''
                      }}`}
                  >
                    <IconComponent
                      className={`h-3.5 w-3.5 ${
                        isSelected
                          ? 'text-white'
                          : staged
                          ? 'text-emerald'
                          : ''
                      }`}
                    />
                    <span>{s}</span>
                    {staged ? (
                      <span className="ml-1 rounded-full bg-emerald-200/90 px-1.5 py-0.2 text-[9px] font-mono font-bold text-emerald-800">
                        ✓ {staged.estTco2e > 0 ? `${staged.estTco2e.toFixed(1)} t` : 'Logged'}
                      </span>
                    ) : (
                      isSelected && (
                        <span className="ml-1 rounded-full bg-white/25 px-1.5 py-0.2 text-[9px] font-bold text-white">
                          Active
                        </span>
                      )
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* CLASSIFICATION CONTROLLER */}
          <FormField
            label="Emission Data Type"
            hint="Classifies reporting boundary per GHG Protocol Corporate Standard."
          >
            <select
              value={emissionDataType}
              disabled={readOnly}
              onChange={(e) => handleSelectDataType(e.target.value)}
              className={inputClass}
            >
              <option value="Scope 1 activity">Scope 1 activity (Direct direct emissions from owned/controlled sources)</option>
              <option value="Scope 2 activity">Scope 2 activity (Indirect emissions from purchased electricity/steam)</option>
              <option value="Scope 3 activity">Scope 3 activity (Value chain / freight / business travel / upstream &amp; downstream)</option>
              <option value="Air pollutant">Air pollutant (Stack exhaust &amp; ambient air quality — Tracked separately)</option>
            </select>
          </FormField>

          <FormField
            label="Selected Emission Source Stream"
            hint="Descriptor or specific installation designation."
          >
            <input
              value={emissionSource}
              disabled={readOnly}
              onChange={(e) => setEmissionSource(e.target.value)}
              placeholder="e.g. DG Sets & Power Generators"
              className={inputClass}
            />
          </FormField>

          {/* ==============================================================
              DYNAMIC FORM SECTION 1: FUEL COMBUSTION (DG, BOILERS, FLEET)
              (Shows fuel type, quantity, unit, equipment ID, period, evidence)
              (DO NOT show laboratory testing or freight fields!)
              ============================================================== */}
          {sourceCategory === 'fuel_combustion' && (
            <>
              <div className="sm:col-span-2 rounded-xl bg-amber-50/70 border border-amber-200 p-2.5 text-xs text-amber-900 font-medium flex items-center justify-between">
                <span>
                  🔥 <strong>Fuel Combustion Fields Active:</strong> Only stationary/mobile fuel parameters are shown. Laboratory testing and freight fields are hidden.
                </span>
                <span className="font-mono text-[10px] text-amber-800">Scope 1 Direct</span>
              </div>

              <FormField label="Fuel Type" hint="Approved fuel category from Factor Master.">
                <select
                  value={fuelEnergyType}
                  disabled={readOnly}
                  onChange={(e) => setFuelEnergyType(e.target.value)}
                  className={inputClass}
                >
                  <option value="Diesel (HSD)">Diesel (HSD)</option>
                  <option value="Furnace Oil / Boilers">Furnace Oil / Heavy Fuel Oil</option>
                  <option value="Petrol (MS)">Petrol (MS)</option>
                  <option value="Coal (Sub-bituminous)">Coal (Sub-bituminous)</option>
                  <option value="CNG">Compressed Natural Gas (CNG)</option>
                  <option value="LPG">Liquefied Petroleum Gas (LPG)</option>
                </select>
              </FormField>

              <FormField
                label="Equipment / Source ID"
                hint="Designated DG generator number, furnace tag or fleet asset."
              >
                <input
                  value={equipmentId}
                  disabled={readOnly}
                  onChange={(e) => setEquipmentId(e.target.value)}
                  placeholder="e.g. MEIL-DG-002 (DG Yard Bay 01)"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Activity Quantity" hint="Metered or procured volume consumed.">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={activityQuantity}
                  disabled={readOnly}
                  onChange={(e) => setActivityQuantity(e.target.value)}
                  placeholder="Activity quantity for the period"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Activity Unit" hint="Must correspond to factor unit (L, kg, MT).">
                <select
                  value={unit}
                  disabled={readOnly}
                  onChange={(e) => setUnit(e.target.value)}
                  className={inputClass}
                >
                  <option value="litres">litres</option>
                  <option value="kg">kg</option>
                  <option value="tonnes">tonnes</option>
                  <option value="m³">m³</option>
                </select>
              </FormField>

              <FormField label="Reporting Period" hint="Operational reporting timeframe.">
                <input
                  value={reportingPeriod}
                  disabled={readOnly}
                  onChange={(e) => setReportingPeriod(e.target.value)}
                  placeholder="e.g. June 2026 / FY 2026-27 Q1"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Supporting Evidence Reference" hint="Procurement ledger / fuel logbook ref.">
                <input
                  value={supportingEvidence}
                  disabled={readOnly}
                  onChange={(e) => setSupportingEvidence(e.target.value)}
                  placeholder="e.g. SAP Fuel Procurement Ledger & DG Logbook"
                  className={inputClass}
                />
              </FormField>
            </>
          )}

          {/* ==============================================================
              DYNAMIC FORM SECTION 2: PURCHASED ELECTRICITY (SCOPE 2)
              (Shows kWh, reporting period, grid factor, bill/meter evidence)
              (Includes quick 1-click import from Level 1 Energy!)
              ============================================================== */}
          {sourceCategory === 'electricity_grid' && (
            <>
              <div className="sm:col-span-2 rounded-xl bg-blue-50/70 border border-blue-200 p-2.5 text-xs text-blue-900 font-medium flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span>
                  ⚡ <strong>Purchased Electricity Fields Active:</strong> Grid consumption and CEA baseline accounting. Ordinary freight and laboratory fields are hidden.
                </span>

                {level1EnergyRecord && (
                  <button
                    type="button"
                    onClick={handleImportLevel1Energy}
                    disabled={readOnly || loadingL1}
                    className="self-start sm:self-auto flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-xs hover:bg-blue-700 transition"
                    title="Load from existing Level 1 Energy record without re-entering"
                  >
                    <Download className="h-3 w-3" />
                    <span>Import from Level 1 Energy ({Number(level1EnergyRecord.data?.consumptionQuantity || 42800).toLocaleString()} kWh)</span>
                  </button>
                )}
              </div>

              {sourceRecordId && (
                <div className="sm:col-span-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-[11px] text-emerald-800 flex items-center justify-between">
                  <span>✓ <strong>Source Record Lineage Linked:</strong> Level 1 Energy Record #{sourceRecordId.slice(-8)}. Dependent calculations tracked.</span>
                  <span className="text-[10px] text-emerald-600 font-mono">ID: {sourceRecordId}</span>
                </div>
              )}

              <FormField label="Electricity Consumption (kWh)" hint="Metered or utility billed kilowatt-hours.">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={activityQuantity}
                  disabled={readOnly}
                  onChange={(e) => {
                    setActivityQuantity(e.target.value)
                    setElectricityKwh(e.target.value)
                  }}
                  placeholder="Metered kWh for the period"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Substation / Meter Reference ID" hint="Utility meter reference.">
                <input
                  value={equipmentId}
                  disabled={readOnly}
                  onChange={(e) => setEquipmentId(e.target.value)}
                  placeholder="e.g. MTR-GJT-GRID-01"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Reporting Period" hint="Monthly billing period.">
                <input
                  value={reportingPeriod}
                  disabled={readOnly}
                  onChange={(e) => setReportingPeriod(e.target.value)}
                  placeholder="June 2026"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Applicable Grid Emission Factor Ref" hint="CEA statutory baseline database.">
                <input
                  value={gridFactorRef}
                  disabled={readOnly}
                  onChange={(e) => setGridFactorRef(e.target.value)}
                  placeholder="CEA CO2 Baseline Database v19 — 0.716 kgCO2e/kWh"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Utility Bill / Meter Evidence Reference" hint="DISCOM bill invoice reference." full>
                <input
                  value={supportingEvidence}
                  disabled={readOnly}
                  onChange={(e) => setSupportingEvidence(e.target.value)}
                  placeholder="e.g. Monthly Utility Tariff Invoice #891204 & AMR Meter Log"
                  className={inputClass}
                />
              </FormField>
            </>
          )}

          {/* ==============================================================
              DYNAMIC FORM SECTION 3: FREIGHT LOGISTICS (SCOPE 3)
              (Shows cargo weight, mode, distance, tonne-km, provider, origin/dest)
              (Includes Scope 3 category selector and boundary applicability)
              ============================================================== */}
          {sourceCategory === 'freight_logistics' && (
            <>
              <div className="sm:col-span-2 rounded-xl bg-purple-50/70 border border-purple-200 p-2.5 text-xs text-purple-900 font-medium">
                🚚 <strong>Freight Logistics Fields Active:</strong> Upstream/downstream value chain logistics. Laboratory testing and electricity fields are hidden.
              </div>

              <FormField label="Scope 3 GHG Protocol Category" hint="Select protocol value chain category.">
                <select
                  value={scope3Category}
                  disabled={readOnly}
                  onChange={(e) => setScope3Category(e.target.value)}
                  className={inputClass}
                >
                  <option value="C4 Upstream Transportation and Distribution">
                    C4: Upstream Transportation &amp; Distribution (Tier 1 suppliers to site)
                  </option>
                  <option value="C9 Downstream Transportation and Distribution">
                    C9: Downstream Transportation &amp; Distribution (Outbound shipments)
                  </option>
                  <option value="C1 Purchased Goods and Services">
                    C1: Purchased Goods Freight Embedded
                  </option>
                </select>
              </FormField>

              <div className="flex flex-col justify-center">
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Project Boundary Applicability
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer mt-1">
                  <input
                    type="checkbox"
                    checked={scope3Applicable}
                    disabled={readOnly}
                    onChange={(e) => setScope3Applicable(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-400"
                  />
                  <span>Category Applicable to Project Reporting Boundary</span>
                </label>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Allows configurable Scope 3 reporting boundaries per entity.
                </p>
              </div>

              <FormField label="Cargo / Material Weight (Tonnes)" hint="Gross weight transported.">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={cargoWeightTonnes}
                  disabled={readOnly}
                  onChange={(e) => handleFreightWeightChange(e.target.value)}
                  placeholder="500"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Transport Mode" hint="Mode factor per GLEC framework.">
                <select
                  value={transportMode}
                  disabled={readOnly}
                  onChange={(e) => setTransportMode(e.target.value)}
                  className={inputClass}
                >
                  <option value="Heavy Duty Road Truck (Diesel)">Heavy Duty Road Truck (Diesel - 0.114 kg/t-km)</option>
                  <option value="Freight Rail (Electric/Diesel)">Freight Rail (0.028 kg/t-km)</option>
                  <option value="Coastal Shipping">Coastal Shipping (0.016 kg/t-km)</option>
                  <option value="Air Cargo">Air Cargo (0.602 kg/t-km)</option>
                </select>
              </FormField>

              <FormField label="Distance (km)" hint="Origin to site road/rail distance.">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={distanceKm}
                  disabled={readOnly}
                  onChange={(e) => handleFreightDistanceChange(e.target.value)}
                  placeholder="850"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Transport Work (Tonne-km)" hint="Auto-calculated (Weight × Distance) or manual entry.">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={activityQuantity}
                  disabled={readOnly}
                  onChange={(e) => {
                    setTonneKm(e.target.value)
                    setActivityQuantity(e.target.value)
                  }}
                  placeholder="425000"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Logistics Service Provider" hint="Carrier / 3PL transporter name.">
                <input
                  value={logisticsProvider}
                  disabled={readOnly}
                  onChange={(e) => setLogisticsProvider(e.target.value)}
                  placeholder="Logistics provider name"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Origin & Destination" hint="Corridor routing description.">
                <input
                  value={originDestination}
                  disabled={readOnly}
                  onChange={(e) => setOriginDestination(e.target.value)}
                  placeholder="e.g. Vendor Balanagar Works -> Gujarat Site"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Supporting Transport Records" hint="E-way bill, LR copy, invoice reference." full>
                <input
                  value={supportingEvidence}
                  disabled={readOnly}
                  onChange={(e) => setSupportingEvidence(e.target.value)}
                  placeholder="e.g. Consolidated E-Way Bills & Freight Invoices #FWD-9910"
                  className={inputClass}
                />
              </FormField>
            </>
          )}

          {/* ==============================================================
              DYNAMIC FORM SECTION 4: BUSINESS TRAVEL & COMMUTE (SCOPE 3)
              (Shows travel mode, distance, passenger-km, travel evidence)
              ============================================================== */}
          {sourceCategory === 'business_travel' && (
            <>
              <div className="sm:col-span-2 rounded-xl bg-purple-50/70 border border-purple-200 p-2.5 text-xs text-purple-900 font-medium">
                👥 <strong>Business Travel &amp; Commute Fields Active:</strong> GHG Protocol Categories C6 &amp; C7. Cargo, laboratory, and fuel fields are hidden.
              </div>

              <FormField label="Scope 3 Category" hint="Business travel vs employee transit.">
                <select
                  value={scope3Category}
                  disabled={readOnly}
                  onChange={(e) => setScope3Category(e.target.value)}
                  className={inputClass}
                >
                  <option value="C6 Business Travel">C6: Business Travel (Corporate travel, flights, client transit)</option>
                  <option value="C7 Employee Commuting">C7: Employee Commuting (Daily staff bus &amp; workforce transit)</option>
                </select>
              </FormField>

              <div className="flex flex-col justify-center">
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Project Boundary Applicability
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer mt-1">
                  <input
                    type="checkbox"
                    checked={scope3Applicable}
                    disabled={readOnly}
                    onChange={(e) => setScope3Applicable(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-400"
                  />
                  <span>Category Applicable to Project Reporting Boundary</span>
                </label>
              </div>

              <FormField label="Travel Mode" hint="Mode factor per GHG Protocol / DEFRA.">
                <select
                  value={travelMode}
                  disabled={readOnly}
                  onChange={(e) => setTravelMode(e.target.value)}
                  className={inputClass}
                >
                  <option value="Air Travel (Domestic)">Air Travel (Domestic - 0.18 kgCO2e/p-km)</option>
                  <option value="Air Travel (Long-Haul)">Air Travel (Long-Haul - 0.15 kgCO2e/p-km)</option>
                  <option value="Rail Travel">Rail Travel (0.04 kgCO2e/p-km)</option>
                  <option value="Road Travel (Fleet Car)">Road Travel (Fleet Taxi / Car - 0.11 kgCO2e/p-km)</option>
                  <option value="Employee Bus Transit">Employee Bus Transit (0.068 kgCO2e/p-km)</option>
                </select>
              </FormField>

              <FormField label="Total One-way / Round-trip Distance (km)" hint="Route distance.">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={travelDistanceKm}
                  disabled={readOnly}
                  onChange={(e) => handleTravelDistanceChange(e.target.value)}
                  placeholder="1450"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Passenger Count" hint="Total travelers in reporting period.">
                <input
                  type="number"
                  min="1"
                  value={passengerCount}
                  disabled={readOnly}
                  onChange={(e) => handlePassengerCountChange(e.target.value)}
                  placeholder="100"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Activity Data (Passenger-km)" hint="Auto-calculated (Distance × Passengers).">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={activityQuantity}
                  disabled={readOnly}
                  onChange={(e) => {
                    setPassengerKm(e.target.value)
                    setActivityQuantity(e.target.value)
                  }}
                  placeholder="145000"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Travel Records & Booking Evidence" hint="Corporate portal logs & tickets." full>
                <input
                  value={supportingEvidence}
                  disabled={readOnly}
                  onChange={(e) => setSupportingEvidence(e.target.value)}
                  placeholder="e.g. Corporate Travel Booking Register & Flight Tickets"
                  className={inputClass}
                />
              </FormField>
            </>
          )}

          {/* ==============================================================
              DYNAMIC FORM SECTION 5: AMBIENT AIR & STACK EMISSIONS
              (Shows pollutant, unit, sampling location, test date, lab, method, result)
              (DO NOT combine with GHG CO2e totals!)
              ============================================================== */}
          {sourceCategory === 'air_monitoring' && (
            <>
              <div className="sm:col-span-2 rounded-xl bg-teal-50/80 border border-teal-200 p-3 text-xs text-teal-950 font-medium">
                <div className="flex items-center gap-1.5 font-bold text-teal-900">
                  <CloudFog className="h-4 w-4 text-teal-600" />
                  <span>Ambient Air Monitoring &amp; Stack Emissions (Tracked Separately)</span>
                </div>
                <p className="mt-1 text-[11px] text-teal-800">
                  Air pollutant measurements (PM10, PM2.5, NOx, SO2) are statutory environmental compliance metrics under CPCB &amp; State Pollution Control Board guidelines. <strong>These values are strictly maintained separate and never mixed into corporate GHG CO2e totals.</strong>
                </p>
              </div>

              <FormField label="Pollutant Parameter" hint="Target criteria pollutant.">
                <select
                  value={pollutantType}
                  disabled={readOnly}
                  onChange={(e) => setPollutantType(e.target.value)}
                  className={inputClass}
                >
                  <option value="PM10 / PM2.5">Particulate Matter (PM10 / PM2.5)</option>
                  <option value="NOx">Nitrogen Oxides (NOx)</option>
                  <option value="SO2">Sulphur Dioxide (SO2)</option>
                  <option value="CO">Carbon Monoxide (CO)</option>
                  <option value="VOCs">Volatile Organic Compounds (VOCs)</option>
                </select>
              </FormField>

              <FormField label="Measurement Unit" hint="Concentration standard unit.">
                <select
                  value={unit}
                  disabled={readOnly}
                  onChange={(e) => setUnit(e.target.value)}
                  className={inputClass}
                >
                  <option value="µg/m³">µg/m³ (Ambient air concentration)</option>
                  <option value="mg/Nm³">mg/Nm³ (Stack exhaust flue concentration)</option>
                  <option value="ppm">ppm (Parts per million)</option>
                </select>
              </FormField>

              <FormField label="Sampling Location / Stack ID" hint="Station or stack chimney tag.">
                <input
                  value={samplingLocation}
                  disabled={readOnly}
                  onChange={(e) => setSamplingLocation(e.target.value)}
                  placeholder="e.g. Perimeter Air Monitoring Station 01"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Test Date" hint="Sampling field test date.">
                <input
                  type="date"
                  value={testDate}
                  disabled={readOnly}
                  onChange={(e) => setTestDate(e.target.value)}
                  className={inputClass}
                />
              </FormField>

              <FormField label="Testing Laboratory" hint="NABL / CPCB accredited facility.">
                <input
                  value={laboratory}
                  disabled={readOnly}
                  onChange={(e) => setLaboratory(e.target.value)}
                  placeholder="Testing laboratory name"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Test Method" hint="Standard testing protocol.">
                <input
                  value={testMethod}
                  disabled={readOnly}
                  onChange={(e) => setTestMethod(e.target.value)}
                  placeholder="e.g. IS 5182 (Part 23) High Volume Sampler Gravimetric"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Measured Result" hint="Laboratory certified test value.">
                <input
                  value={measuredResult}
                  disabled={readOnly}
                  onChange={(e) => {
                    setMeasuredResult(e.target.value)
                    setActivityQuantity(e.target.value)
                  }}
                  placeholder="e.g. 48.2"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Regulatory Standard Limit" hint="Statutory CPCB / NAAQS benchmark.">
                <input
                  value={regulatoryBenchmark}
                  disabled={readOnly}
                  onChange={(e) => setRegulatoryBenchmark(e.target.value)}
                  placeholder="e.g. NAAQS 24-hr limit: 100 µg/m³ for PM10"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Supporting Lab Report" hint="NABL report number & certificate ref." full>
                <input
                  value={supportingEvidence}
                  disabled={readOnly}
                  onChange={(e) => setSupportingEvidence(e.target.value)}
                  placeholder="e.g. NABL Certified Ambient Air Quality Report #VMT-2026-06-18"
                  className={inputClass}
                />
              </FormField>
            </>
          )}

          {/* ==============================================================
              DYNAMIC FORM SECTION 6: FUGITIVE REFRIGERANTS
              (Shows refrigerant type, quantity leaked/replenished, GWP source, evidence)
              (DO NOT show laboratory testing or cargo fields!)
              ============================================================== */}
          {sourceCategory === 'refrigerant_fugitive' && (
            <>
              <div className="sm:col-span-2 rounded-xl bg-cyan-50/70 border border-cyan-200 p-2.5 text-xs text-cyan-900 font-medium">
                ❄️ <strong>Fugitive Refrigerant Gas Fields Active:</strong> Scope 1 fugitive chiller gas loss accounting. Laboratory testing, cargo, and freight fields are hidden.
              </div>

              <FormField label="Refrigerant Gas Type" hint="Chemical blend / HFC designation.">
                <select
                  value={refrigerantType}
                  disabled={readOnly}
                  onChange={(e) => {
                    setRefrigerantType(e.target.value)
                    setFuelEnergyType(`Refrigerant ${e.target.value}`)
                  }}
                  className={inputClass}
                >
                  <option value="R-410A">R-410A (GWP: 2,088 kgCO2e/kg)</option>
                  <option value="R-134a">R-134a (GWP: 1,430 kgCO2e/kg)</option>
                  <option value="R-22">R-22 (GWP: 1,810 kgCO2e/kg)</option>
                  <option value="R-32">R-32 (GWP: 675 kgCO2e/kg)</option>
                  <option value="R-407C">R-407C (GWP: 1,774 kgCO2e/kg)</option>
                </select>
              </FormField>

              <FormField label="Equipment / Chiller Unit ID" hint="HVAC asset identifier.">
                <input
                  value={equipmentId}
                  disabled={readOnly}
                  onChange={(e) => setEquipmentId(e.target.value)}
                  placeholder="e.g. Main Substation Chiller Unit 01 (CHL-001)"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Quantity Leaked / Top-Up (kg)" hint="Net gas added during maintenance.">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={activityQuantity}
                  disabled={readOnly}
                  onChange={(e) => {
                    setQuantityLeakedKg(e.target.value)
                    setActivityQuantity(e.target.value)
                  }}
                  placeholder="14"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Applicable GWP Reference" hint="Statutory IPCC AR5 100-year GWP.">
                <input
                  value={gwpSource}
                  disabled={readOnly}
                  onChange={(e) => setGwpSource(e.target.value)}
                  placeholder="IPCC AR5 GWP100: 2,088 kgCO2e/kg"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Service Log & Invoices Evidence" hint="HVAC contractor work sheet." full>
                <input
                  value={supportingEvidence}
                  disabled={readOnly}
                  onChange={(e) => setSupportingEvidence(e.target.value)}
                  placeholder="e.g. HVAC Maintenance Service Log & Gas Recharge Invoice #VOL-8812"
                  className={inputClass}
                />
              </FormField>
            </>
          )}

          {/* CALCULATION LINEAGE & AUDIT TRAIL CARD */}
          <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 p-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Deterministic Calculation Engine Lineage
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {currentCalc.timestamp.slice(0, 19).replace('T', ' ')} UTC
              </span>
            </div>

            {currentCalc.factorConfigured ? (
              <div className="mt-3 space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-xl bg-white p-2.5 border border-slate-200/80">
                    <span className="text-[9px] uppercase font-bold text-slate-400">Applied Factor</span>
                    <div className="font-mono font-bold text-emerald-800 mt-0.5">
                      {currentCalc.factorValue > 0
                        ? `${currentCalc.factorValue} ${currentCalc.factorUnit}`
                        : 'Lab Certified'}
                    </div>
                  </div>

                  <div className="rounded-xl bg-white p-2.5 border border-slate-200/80">
                    <span className="text-[9px] uppercase font-bold text-slate-400">Factor Source &amp; Ver</span>
                    <div className="text-[11px] font-semibold text-slate-800 truncate mt-0.5" title={currentCalc.factorSource}>
                      {currentCalc.factorSource}
                    </div>
                  </div>

                  <div className="rounded-xl bg-white p-2.5 border border-slate-200/80">
                    <span className="text-[9px] uppercase font-bold text-slate-400">Calculated Footprint</span>
                    <div className="font-bold text-emerald-900 mt-0.5">
                      {sourceCategory === 'air_monitoring'
                        ? '0.00 tCO₂e (Separate)'
                        : `${currentCalc.calculatedTco2e.toFixed(3)} tCO₂e`}
                    </div>
                  </div>

                  <div className="rounded-xl bg-white p-2.5 border border-slate-200/80">
                    <span className="text-[9px] uppercase font-bold text-slate-400">Lineage Status</span>
                    <div className="font-semibold text-emerald-700 mt-0.5 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Verified Master</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-100/90 p-2 font-mono text-[11px] text-slate-700 border border-slate-200">
                  <span className="font-bold text-slate-900">Formula Lineage:</span> {currentCalc.formula}
                </div>
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-900 font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>
                  <strong>Emission Factor Not Configured — ESG Review Required.</strong> No verified factor matching &apos;{fuelEnergyType}&apos; in unit &apos;{unit}&apos; is active in the Emission Factor Master.
                </span>
              </div>
            )}
          </div>

          <FormField label="Operational Remarks & Audit Notes" hint="Boundary justifications or methodology observations." full>
            <textarea
              value={remarks}
              disabled={readOnly}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Scope 1 direct DG emissions and Scope 3 transport calculations verified."
              className={inputClass + ' min-h-[55px] resize-y'}
            />
          </FormField>

          {/* ITEM EVIDENCE ATTACHMENT SECTION (MULTI-ATTACHMENT ENABLED) */}
          <div className="sm:col-span-2">
            <FormEvidenceAttachSection
              projectId={projectId}
              periodId={periodId}
              moduleKey="EMISSIONS"
              evidence={evidence}
              onUploaded={onEvidenceUploaded || (async () => {})}
              selectedEvidenceIds={selectedEvidenceIds}
              onSelectEvidenceIds={setSelectedEvidenceIds}
              evidenceUsedElsewhere={evidenceUsedElsewhere}
              onReview={onReviewEvidence}
onOcrApply={(f) => {
                if (f.quantity) setActivityQuantity(f.quantity)
                if (f.labName) setLaboratory(f.labName)
                if (f.testResult) setMeasuredResult(f.testResult)
                if (f.date) setTestDate(f.date)
                const bits = [f.invoiceNo && `Ref ${f.invoiceNo}`, f.notes].filter(Boolean)
                if (bits.length) setRemarks(bits.join(' · '))
                toast.success('AI-extracted fields applied — review before adding the draft')
              }}
              readOnly={readOnly}
            />
          </div>

          {/* Enhanced Add Item (Draft) Action (Clean prominent CTA) */}
          <div className="sm:col-span-2 pt-1">
            <button
              type="button"
              onClick={handleAddOrUpdateItem}
              disabled={readOnly}
              className="w-full flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 py-3.5 px-6 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 ring-1 ring-white/30 backdrop-blur-md transition-all hover:shadow-xl hover:shadow-emerald-500/35 hover:scale-[1.008] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer group"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 transition-transform group-hover:scale-110">
                <Plus className="h-4 w-4 stroke-[2.5]" />
              </div>
              <span className="tracking-wide">
                {editingItemId ? `Update ${emissionSource} Draft Item` : `+ Add ${emissionSource} (Draft)`}
              </span>
            </button>

            {error && (
              <div className="mt-2.5 rounded-xl border border-rose-200 bg-rose-50/90 p-2.5 text-xs font-medium text-rose-800">
                <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5 text-rose-600" /> {error}
              </div>
            )}
          </div>

          {/* STAGED DRAFT ITEMS TABLE (STEP 1) */}
          {stagedItems.length > 0 && (
            <div className="sm:col-span-2 glass-subtle rounded-2xl p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Staged Inventory Items ({stagedItems.length} Streams Configured)
                    </h4>
                    <p className="text-[10px] text-slate-500">
                      Draft emission sources. Click edit to adjust or click Next to organize the full inventory.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                    GHG Total: {totalCombinedTco2e.toFixed(2)} tCO₂e ({ghgOnlyItems.length} streams + {airPollutantItems.length} air monitoring)
                  </span>
                  
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 border-y border-slate-100">
                    <tr>
                      <th className="py-2 px-2.5">Source &amp; Scope</th>
                      <th className="py-2 px-2.5">Fuel / Stream / Equipment ID</th>
                      <th className="py-2 px-2.5">Activity Quantity</th>
                      <th className="py-2 px-2.5">Est. Footprint</th>
                      <th className="py-2 px-2.5">Evidence</th>
                      <th className="py-2 px-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stagedItems.map((item) => {
                      const attachedEvs = item.evidenceFiles && item.evidenceFiles.length > 0
                        ? item.evidenceFiles
                        : evidence.filter((ev) => item.evidenceIds?.includes(ev.id) || ev.id === item.evidenceId)
                      const isAir = item.sourceCategory === 'air_monitoring'

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-2.5">
                            <div className="font-bold text-slate-900">{item.emissionSource}</div>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                                isAir
                                  ? 'bg-teal-100 text-teal-800'
                                  : item.emissionDataType.includes('1')
                                  ? 'bg-amber-100 text-amber-800'
                                  : item.emissionDataType.includes('2')
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-purple-100 text-purple-800'
                              }`}
                            >
                              {isAir ? 'Air Pollutant (Separate)' : item.emissionDataType}
                            </span>
                          </td>
                          <td className="py-2.5 px-2.5">
                            <div className="font-semibold text-slate-800">
                              {item.fuelEnergyType || item.pollutantType || item.refrigerantType}
                            </div>
                            <div className="text-[10px] font-mono text-slate-500">
                              {item.equipmentId || item.samplingLocation || '—'}
                            </div>
                          </td>
                          <td className="py-2.5 px-2.5 font-bold text-slate-900">
                            {isAir
                              ? `${item.measuredResult || item.activityQuantity} ${item.unit}`
                              : Number(item.activityQuantity) > 0
                              ? `${Number(item.activityQuantity).toLocaleString()} ${item.unit}`
                              : '—'}
                          </td>
                          <td className="py-2.5 px-2.5 font-bold text-emerald-900">
                            {isAir ? (
                              <span
                                className={`text-[10px] font-bold ${
                                  item.complianceStatus === 'COMPLIANT'
                                    ? 'text-teal-700'
                                    : 'text-amber-700'
                                }`}
                              >
                                {item.testResult}
                              </span>
                            ) : (
                              `${item.estTco2e.toFixed(3)} tCO₂e`
                            )}
                          </td>
                          <td className="py-2.5 px-2.5">
                            {attachedEvs.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {attachedEvs.map((ev: any, evIdx: number) => {
                                  const evName = typeof ev === 'string' ? ev : ev?.fileName || 'Evidence'
                                  const evKey = typeof ev === 'string' ? `${ev}-${evIdx}` : ev?.id || evIdx
                                  return (
                                    <span
                                      key={evKey}
                                      className="truncate max-w-[100px] rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800 border border-emerald-200"
                                      title={evName}
                                    >
                                      {evName}
                                    </span>
                                  )
                                })}
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">None attached</span>
                            )}
                          </td>
                          <td className="py-2.5 px-2.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => onViewItem?.({
                                  ...item,
                                  title: item.emissionSource || item.sourceCategory,
                                  levelKey: 'level3',
                                  levelName: 'Level 3 — GHG & Air Emissions',
                                  quantity: item.activityQuantity,
                                  unit: item.unit,
                                  factor: item.factor,
                                  factorUnit: item.factorUnit || `kgCO2e/${item.unit}`,
                                  factorSource: item.factorSource || 'IPCC 2006 / CEA 2024 Baseline Database',
                                  estTco2e: item.estTco2e,
                                  remarks: item.remarks,
                                  evidenceId: item.evidenceId,
                                  sourceDocument: item.supportingEvidence,
                                  emissionDataType: item.emissionDataType,
                                  fuelEnergyType: item.fuelEnergyType,
                                  equipmentId: item.equipmentId,
                                  pollutantType: item.pollutantType,
                                  samplingLocation: item.samplingLocation,
                                  measuredResult: item.measuredResult || item.testResult,
                                  regulatoryBenchmark: item.regulatoryBenchmark,
                                  complianceStatus: item.complianceStatus,
                                })}
                                className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 transition shadow-2xs cursor-pointer mr-1"
                                title="View full item details"
                              >
                                <Eye className="h-3 w-3" />
                                <span>View</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEditStagedItem(item)}
                                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition"
                                title="Edit this item"
                              >
                                <Edit3 className="h-3 w-3" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleRemoveStagedItem(item.id, e)}
                                className="flex h-6 w-6 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 transition"
                                title="Remove item"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <FormSaveActions
            error={error}
            submitting={submitting}
            readOnly={readOnly}
            onSave={() => save(false)}
            onSubmitForReview={handleNextOrganize}
          />
        </FormGrid>
      )}

      {/* ==============================================================
          VIEW 2: ORGANIZED CONSOLIDATED SUMMARY (STEP 2)
          (Separate Air Quality from GHG emissions)
          ============================================================== */}
      {viewStep === 'ORGANIZED' && (
        <div className="space-y-4">
          {/* Header Banner */}
          <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50/90 via-teal-50/80 to-emerald-50/90 p-4 text-xs text-emerald-950 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="status-pill status-approved !text-[10px]">
                    Step 2: Consolidated
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">
                    All GHG Emissions &amp; Air Quality Streams Organized in One View
                  </h3>
                </div>
                <p className="text-[11px] text-slate-600 mt-1">
                  Compiled {stagedItems.length} source streams across Scope 1, Scope 2, Scope 3, and Ambient/Stack Air Quality monitoring.
                  Air pollutant measurements (PM10, NOx, SO2) are monitored separately and are not combined with GHG CO2e totals.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setViewStep('ENTRY')}
                className="self-start sm:self-auto flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs"
              >
                <Plus className="h-3.5 w-3.5 text-emerald-600" />
                <span>Add / Edit More Streams</span>
              </button>
            </div>
          </div>

          {/* 4 Executive KPI Metric Tiles */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-amber-200 bg-white p-3 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Scope 1 Direct
              </div>
              <div className="text-base font-extrabold text-amber-950 mt-1">
                {s1Total.toFixed(2)} tCO₂e
              </div>
              <div className="text-[10px] text-amber-700 mt-0.5">DG Sets, Boilers &amp; Fleet</div>
            </div>

            <div className="rounded-xl border border-blue-200 bg-white p-3 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Scope 2 Indirect
              </div>
              <div className="text-base font-extrabold text-blue-950 mt-1">
                {s2Total.toFixed(2)} tCO₂e
              </div>
              <div className="text-[10px] text-blue-700 mt-0.5">Purchased Grid Electricity</div>
            </div>

            <div className="rounded-xl border border-purple-200 bg-white p-3 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Scope 3 Value Chain
              </div>
              <div className="text-base font-extrabold text-purple-950 mt-1">
                {s3Total.toFixed(2)} tCO₂e
              </div>
              <div className="text-[10px] text-purple-700 mt-0.5">Freight Logistics &amp; Travel</div>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-white p-3 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Total GHG Footprint
              </div>
              <div className="text-base font-extrabold text-emerald-900 mt-1">
                {totalCombinedTco2e.toFixed(2)} tCO₂e
              </div>
              <div className="text-[10px] text-emerald-700 mt-0.5">
                {ghgOnlyItems.length} GHG Streams ({airPollutantItems.length} Air Monitoring)
              </div>
            </div>
          </div>

          {/* Consolidated Master Table of GHG Streams */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Consolidated GHG Emission Streams (Scope 1, 2 &amp; 3)
                </h4>
                <p className="text-[10px] text-slate-500">
                  Deterministic calculations verified with backend Emission Factor Master
                </p>
              </div>
              <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                Total: {totalCombinedTco2e.toFixed(2)} tCO₂e
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 border-y border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Emission Source</th>
                    <th className="py-2.5 px-3">Scope / Category</th>
                    <th className="py-2.5 px-3">Fuel / Activity</th>
                    <th className="py-2.5 px-3">Activity Quantity</th>
                    <th className="py-2.5 px-3">Applied Factor</th>
                    <th className="py-2.5 px-3">Est. Footprint</th>
                    <th className="py-2.5 px-3">Attached Evidence</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ghgOnlyItems.map((item, idx) => {
                    const attachedEvs = item.evidenceFiles && item.evidenceFiles.length > 0
                      ? item.evidenceFiles
                      : evidence.filter((ev) => item.evidenceIds?.includes(ev.id) || ev.id === item.evidenceId)

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-[10px] text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {item.emissionSource}
                          {item.equipmentId && (
                            <div className="text-[10px] font-normal text-slate-500">
                              Asset: {item.equipmentId}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                              item.emissionDataType.includes('1')
                                ? 'bg-amber-100 text-amber-800'
                                : item.emissionDataType.includes('2')
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}
                          >
                            {item.scope3Category ? item.scope3Category.split(' ')[0] : item.emissionDataType}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {item.fuelEnergyType || item.transportMode || item.travelMode || item.refrigerantType}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {Number(item.activityQuantity).toLocaleString()} {item.unit}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                          <div>{item.factor} {item.factorUnit}</div>
                          <div className="text-[9px] text-slate-400 truncate max-w-[120px]" title={item.factorSource}>
                            {item.factorSource}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-emerald-950">
                          {item.estTco2e.toFixed(3)} t
                        </td>
                        <td className="py-2.5 px-3">
                          {attachedEvs.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {attachedEvs.map((ev: any, evIdx: number) => {
                                const evName = typeof ev === 'string' ? ev : ev?.fileName || 'Evidence'
                                const evKey = typeof ev === 'string' ? `${ev}-${evIdx}` : ev?.id || evIdx
                                return (
                                  <button
                                    key={evKey}
                                    type="button"
                                    onClick={() => onReviewEvidence && onReviewEvidence(typeof ev === 'string' ? ({ id: ev, fileName: ev } as any) : ev)}
                                    className="flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition"
                                    title="Review evidence (flips card 180°)"
                                  >
                                    <Eye className="h-2.5 w-2.5" />
                                    <span className="max-w-[80px] truncate">{evName}</span>
                                  </button>
                                )
                              })}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">None attached</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => onViewItem?.({
                                ...item,
                                title: item.emissionSource || item.sourceCategory,
                                levelKey: 'level3',
                                levelName: 'Level 3 — GHG & Air Emissions',
                                quantity: item.activityQuantity,
                                unit: item.unit,
                                factor: item.factor,
                                factorUnit: item.factorUnit || `kgCO2e/${item.unit}`,
                                factorSource: item.factorSource || 'IPCC 2006 / CEA 2024 Baseline Database',
                                estTco2e: item.estTco2e,
                                remarks: item.remarks,
                                evidenceId: item.evidenceId,
                                sourceDocument: item.supportingEvidence,
                                emissionDataType: item.emissionDataType,
                                fuelEnergyType: item.fuelEnergyType,
                                equipmentId: item.equipmentId,
                              })}
                              className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 transition shadow-2xs cursor-pointer mr-1"
                              title="View full item details"
                            >
                              <Eye className="h-3 w-3" />
                              <span>View</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditStagedItem(item)}
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition"
                            >
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="bg-slate-50 font-bold text-slate-900 border-t border-slate-200">
                  <tr>
                    <td colSpan={4} className="py-2.5 px-3 text-right text-[11px] uppercase tracking-wider text-slate-500">
                      Consolidated GHG Footprint (Scope 1 + 2 + 3):
                    </td>
                    <td colSpan={2} className="py-2.5 px-3 text-slate-700 text-xs">
                      S1: {s1Total.toFixed(2)} t | S2: {s2Total.toFixed(2)} t | S3: {s3Total.toFixed(2)} t
                    </td>
                    <td className="py-2.5 px-3 text-emerald-950 font-extrabold text-sm">
                      {totalCombinedTco2e.toFixed(2)} tCO₂e
                    </td>
                    <td colSpan={2} className="py-2.5 px-3 text-right text-[10px] text-slate-500">
                      {ghgOnlyItems.length} streams aggregated
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* DEDICATED AIR QUALITY & STACK COMPLIANCE MONITORING SECTION */}
          {airPollutantItems.length > 0 && (
            <div className="rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50/50 via-white to-teal-50/30 p-4 shadow-sm">
              <div className="mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-100 text-teal-700">
                    <CloudFog className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-teal-950">
                      Air Quality &amp; Stack Emission Monitoring (Statutory Separate Record)
                    </h4>
                    <p className="text-[10px] text-slate-500">
                      Monitored in compliance with CPCB / State Pollution Control Board guidelines. Strictly segregated from CO2e totals.
                    </p>
                  </div>
                </div>

                <span className="rounded-full bg-teal-100 text-teal-800 text-[10px] font-bold px-2.5 py-1 border border-teal-200 self-start sm:self-auto">
                  {airPollutantItems.length} Air Sampling Records
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-teal-50/60 text-[10px] uppercase tracking-wider text-teal-900 border-y border-teal-200">
                    <tr>
                      <th className="py-2.5 px-3">Location / Stack</th>
                      <th className="py-2.5 px-3">Pollutant</th>
                      <th className="py-2.5 px-3">Measured Concentration</th>
                      <th className="py-2.5 px-3">CPCB / NAAQS Standard</th>
                      <th className="py-2.5 px-3">Testing Lab &amp; Method</th>
                      <th className="py-2.5 px-3">Compliance</th>
                      <th className="py-2.5 px-3">Evidence</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-teal-100">
                    {airPollutantItems.map((item) => {
                      const attachedEvs = item.evidenceFiles && item.evidenceFiles.length > 0
                        ? item.evidenceFiles
                        : evidence.filter((ev) => item.evidenceIds?.includes(ev.id) || ev.id === item.evidenceId)

                      return (
                        <tr key={item.id} className="hover:bg-teal-50/40 transition-colors">
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            {item.samplingLocation || item.emissionSource}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-teal-950">
                            {item.pollutantType}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                            {item.measuredResult || item.activityQuantity} {item.unit}
                          </td>
                          <td className="py-2.5 px-3 text-[10px] text-slate-600">
                            {item.regulatoryBenchmark || 'NAAQS Limit'}
                          </td>
                          <td className="py-2.5 px-3 text-[10px] text-slate-600">
                            <div>{item.laboratory || '—'}</div>
                            <div className="text-slate-400">{item.testMethod || 'IS 5182 (Part 23)'}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                                item.complianceStatus === 'COMPLIANT'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {item.complianceStatus === 'COMPLIANT' ? 'Within Limits ✓' : 'Exceedance ⚠'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            {attachedEvs.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {attachedEvs.map((ev: any, evIdx: number) => {
                                  const evName = typeof ev === 'string' ? ev : ev?.fileName || 'Evidence'
                                  const evKey = typeof ev === 'string' ? `${ev}-${evIdx}` : ev?.id || evIdx
                                  return (
                                    <button
                                      key={evKey}
                                      type="button"
                                      onClick={() => onReviewEvidence && onReviewEvidence(typeof ev === 'string' ? ({ id: ev, fileName: ev } as any) : ev)}
                                      className="flex items-center gap-1 rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-bold text-teal-800 border border-teal-200 hover:bg-teal-100 transition"
                                      title="Review evidence (flips card 180°)"
                                    >
                                      <Eye className="h-2.5 w-2.5" />
                                      <span className="max-w-[70px] truncate">{evName}</span>
                                    </button>
                                  )
                                })}
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">None attached</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleEditStagedItem(item)}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* REVIEW & WORKFLOW STATUS CONTROLLER */}
          <div className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block">
                  Workflow Review &amp; Approval Status
                </label>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Set workflow lifecycle status for this consolidated reporting period.
                </p>
              </div>

              <select
                value={overallWorkflowStatus}
                disabled={readOnly}
                onChange={(e: any) => setOverallWorkflowStatus(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 shadow-xs outline-none focus:border-emerald-400"
              >
                <option value="Draft">Draft (In Progress)</option>
                <option value="Submitted">Submitted (Sent for BU Review)</option>
                <option value="Under Review">Under Review (ESG Lead Audit)</option>
                <option value="Approved">Approved (Final Sign-off)</option>
                <option value="Returned for Correction">Returned for Correction</option>
                <option value="Recalculation Required">Recalculation Required</option>
              </select>
            </div>

            <div className="mt-3">
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Consolidated Submission Remarks &amp; Audit Trail Note
              </label>
              <textarea
                value={remarks}
                disabled={readOnly}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="e.g. Scope 1, Scope 2, Scope 3, and ambient stack emissions inventory reconciled with central MRV protocols."
                className={inputClass + ' min-h-[55px] resize-y'}
              />
            </div>
          </div>

          {/* Primary Save Draft & Submit for Review buttons */}
          <FormSaveActions
            error={error}
            submitting={submitting}
            readOnly={readOnly}
            onSubmitForReview={() => save(true)}
            nextLabel="Submit GHG Inventory →"
          />
        </div>
      )}
    </div>
  )
}