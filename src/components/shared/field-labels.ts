/**
 * Shared field vocabulary for the "Submitted Data Breakdown" cards used by the
 * item detail modal, the Final Submit review, and the Project Admin review
 * screens. One vocabulary so every screen names fields exactly like the input
 * forms do.
 */
export const FIELD_LABELS: Record<string, string> = {
  energySource: 'Energy Source', emissionDataType: 'GHG Scope', energyActivity: 'Energy Activity',
  consumptionQuantity: 'Consumption Quantity', unit: 'Unit', meterEquipmentId: 'Meter / Equipment ID',
  openingMeterReading: 'Opening Meter Reading', closingMeterReading: 'Closing Meter Reading',
  meterDiff: 'Meter Delta', energyPurchased: 'Energy Purchased', energyGenerated: 'Energy Generated',
  renewableEnergyQuantity: 'Renewable Energy', reportingPeriod: 'Reporting Period',
  sourceDocument: 'Source Document', remarks: 'Remarks',
  waterSource: 'Water Source', waterActivity: 'Water Activity', waterQuantity: 'Water Quantity',
  meterSourceId: 'Meter / Pump ID', openingReading: 'Opening Reading', closingReading: 'Closing Reading',
  waterReusedRecycled: 'Reused / Recycled', dischargeDestination: 'Discharge Destination',
  treatmentLevel: 'Treatment Level', waterQualityResult: 'Water Quality Result', testDateLab: 'Lab Test / Date',
  supportingEvidence: 'Supporting Evidence',
  sourceCategory: 'Source Category', emissionSource: 'Emission Source', fuelEnergyType: 'Fuel / Energy Type',
  equipmentId: 'Equipment ID', electricityKwh: 'Electricity (kWh)', gridFactorRef: 'Grid Factor Ref',
  activityQuantity: 'Activity Quantity', scope3Category: 'Scope 3 Category',
  transportMode: 'Transport Mode', cargoWeightTonnes: 'Cargo Weight (t)', distanceKm: 'Distance (km)',
  tonneKm: 'Tonne-km', logisticsProvider: 'Logistics Provider', originDestination: 'Origin → Destination',
  travelMode: 'Travel Mode', travelDistanceKm: 'Travel Distance (km)', passengerCount: 'Passengers',
  passengerKm: 'Passenger-km', pollutantType: 'Pollutant', samplingLocation: 'Sampling Location',
  testDate: 'Test Date', laboratory: 'Laboratory', laboratoryTestMethod: 'Lab / Method',
  testMethod: 'Test Method', measuredResult: 'Measured Result', testResult: 'Test Result',
  regulatoryBenchmark: 'Regulatory Benchmark', complianceStatus: 'Compliance',
  refrigerantType: 'Refrigerant', quantityLeakedKg: 'Quantity Leaked (kg)', gwpSource: 'GWP Source',
  wasteCategory: 'Waste Category', wasteTypeDescription: 'Description', quantityGenerated: 'Quantity Generated',
  quantityReused: 'Quantity Reused', quantityRecycled: 'Quantity Recycled', quantityRecovered: 'Quantity Recovered',
  quantityDisposed: 'Quantity Disposed', disposalMethod: 'Disposal Method', wasteHandler: 'Handler',
  authorizationReference: 'Authorization Ref', transferManifestNumber: 'Manifest No.',
  permitConsentType: 'Permit Type', permitNumber: 'Permit Number', issuingAuthority: 'Issuing Authority',
  issueDate: 'Issue Date', expiryDate: 'Expiry Date', permitStatus: 'Permit Status',
  applicableActivity: 'Applicable Activity', inspectionDate: 'Inspection Date',
  inspectionFindings: 'Inspection Findings', nonComplianceIdentified: 'Non-compliance',
  correctiveAction: 'Corrective Action', responsibleOwner: 'Responsible Owner', dueDate: 'Due Date',
  closureDate: 'Closure Date',
  factor: 'Emission Factor', factorUnit: 'Factor Unit', factorSource: 'Factor Source',
  estTco2e: 'Est. GHG (tCO₂e)', estGj: 'Energy (GJ)', calculationFormula: 'Calculation',
  title: 'Title', category: 'Category', startDate: 'Start Date', completionDate: 'Completion Date',
  physicalOutputQuantity: 'Physical Output',
}

export const SKIP_FIELDS = new Set([
  'id', 'levelKey', 'levelName', 'status', 'viewStep', 'stagedAt',
  'evidenceId', 'evidenceIds', 'evidenceName', 'evidenceFileName', 'evidenceFiles',
  'factorVersion', 'factorConfigured', 'calculationTimestamp', 'selectedSourceToEdit',
])

export const FIELD_ORDER = [
  'energySource', 'waterSource', 'emissionSource', 'wasteCategory', 'permitConsentType', 'title',
  'emissionDataType', 'energyActivity', 'waterActivity', 'sourceCategory', 'category',
  'consumptionQuantity', 'waterQuantity', 'activityQuantity', 'quantityGenerated',
  'unit', 'meterEquipmentId', 'meterSourceId', 'equipmentId',
  'openingMeterReading', 'closingMeterReading', 'meterDiff', 'openingReading', 'closingReading',
  'energyPurchased', 'energyGenerated', 'renewableEnergyQuantity', 'waterReusedRecycled',
  'dischargeDestination', 'treatmentLevel', 'waterQualityResult', 'testDateLab',
  'quantityReused', 'quantityRecycled', 'quantityRecovered', 'quantityDisposed',
  'disposalMethod', 'wasteHandler', 'authorizationReference', 'transferManifestNumber',
  'wasteTypeDescription', 'permitNumber', 'issuingAuthority', 'issueDate', 'expiryDate',
  'permitStatus', 'applicableActivity', 'inspectionDate', 'inspectionFindings',
  'nonComplianceIdentified', 'correctiveAction', 'responsibleOwner', 'dueDate', 'closureDate',
  'fuelEnergyType', 'electricityKwh', 'transportMode', 'travelMode', 'cargoWeightTonnes',
  'distanceKm', 'tonneKm', 'logisticsProvider', 'originDestination', 'travelDistanceKm',
  'passengerCount', 'passengerKm', 'pollutantType', 'samplingLocation', 'testDate',
  'laboratory', 'testMethod', 'laboratoryTestMethod', 'measuredResult', 'testResult',
  'regulatoryBenchmark', 'complianceStatus', 'refrigerantType', 'quantityLeakedKg', 'gwpSource',
  'sourceDocument', 'supportingEvidence', 'reportingPeriod', 'remarks',
]

export const fieldLabel = (k: string) =>
  FIELD_LABELS[k] || k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())

export const fmtValue = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'object') {
    if (Array.isArray(v)) {
      return v.map((item) => (typeof item === 'object' && item !== null ? (item as any).fileName || (item as any).name || '' : String(item))).filter(Boolean).join(', ') || '—'
    }
    return (v as any).fileName || (v as any).name || (v as any).label || (v as any).title || '—'
  }
  const n = Number(v)
  if (Number.isFinite(n) && typeof v !== 'boolean' && String(v).trim() !== '' && /^\d+(\.\d+)?$/.test(String(v).trim())) {
    return n.toLocaleString()
  }
  return String(v)
}

/** A short human label for one source item. NEVER returns an object — a
 *  legacy record can carry an evidence row in `title`/`category`, and
 *  returning it would be rendered as a React child (minified error #31). */
export const itemTitle = (it: Record<string, any>): string => {
  const candidates = [
    it.energySource, it.waterSource, it.emissionSource, it.wasteCategory,
    it.permitConsentType, it.title, it.pollutantType, it.refrigerantType, it.category,
  ]
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c
    if (c && typeof c === 'object') {
      const name = (c as any).fileName ?? (c as any).name ?? (c as any).label ?? (c as any).title
      if (typeof name === 'string' && name.trim()) return name
    }
  }
  return 'Source item'
}

/** Ordered [key, value] entries for one item — form vocabulary, blanks kept. */
export function itemFieldEntries(item: Record<string, any>): Array<[string, unknown]> {
  const entries: Array<[string, unknown]> = []
  const seen = new Set<string>()
  for (const k of FIELD_ORDER) {
    if (SKIP_FIELDS.has(k) || seen.has(k)) continue
    if (k in item) {
      const v = item[k]
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) continue
      entries.push([k, v]); seen.add(k)
    }
  }
  for (const k of Object.keys(item)) {
    if (SKIP_FIELDS.has(k) || seen.has(k)) continue
    const v = item[k]
    if (typeof v === 'object' && v !== null) continue
    entries.push([k, v]); seen.add(k)
  }
  return entries
}

/* UI level ↔ internal store level aliases: UI Level 5 (Permits & Compliance)
   stores under `l7-…`/`level7` and UI Level 6 (Initiatives) under `l9-…`/`level9`
   (legacy BRSR numbering), so both directions must be probed. */
const LEVEL_ALIASES: Record<number, number[]> = { 5: [7], 6: [9], 7: [5], 9: [6] }

function levelCandidateNumbers(level: number): number[] {
  return [level, ...(LEVEL_ALIASES[level] ?? [])]
}

function entryHasData(entry: any): boolean {
  if (!entry || typeof entry !== 'object') return false
  if (Array.isArray(entry.items) && entry.items.length > 0) return true
  return Object.entries(entry).some(([, v]) =>
    typeof v === 'string' ? v.trim() !== '' : v != null && !(Array.isArray(v) && v.length === 0),
  )
}

/** Resolve the full staged entry (not just items) for one level from the
 *  scoped formStateRef, probing both scoped `l{n}-…` keys and unscoped ones. */
export function levelEntryFromFormData(
  allData: Record<string, any> | undefined,
  level: number,
  projectId?: string | null,
  periodId?: string | null,
): Record<string, any> | undefined {
  if (!allData) return undefined
  for (const n of levelCandidateNumbers(level)) {
    const scoped = projectId && periodId ? allData[`l${n}-${projectId}-${periodId}`] : undefined
    if (entryHasData(scoped)) return scoped
  }
  for (const n of levelCandidateNumbers(level)) {
    const unscoped = allData[`level${n}`]
    if (entryHasData(unscoped)) return unscoped
  }
  return undefined
}

/** Resolve the staged items for one BRSR level from the scoped formStateRef. */
export function levelItemsFromFormData(
  allData: Record<string, any> | undefined,
  level: number,
  projectId?: string | null,
  periodId?: string | null,
): any[] {
  const data = levelEntryFromFormData(allData, level, projectId, periodId)
  return data && Array.isArray(data.items) ? data.items : []
}
