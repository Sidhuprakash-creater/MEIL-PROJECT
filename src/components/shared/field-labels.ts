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
  const n = Number(v)
  if (Number.isFinite(n) && typeof v !== 'boolean' && String(v).trim() !== '' && /^\d+(\.\d+)?$/.test(String(v).trim())) {
    return n.toLocaleString()
  }
  return String(v)
}

export const itemTitle = (it: Record<string, any>): string =>
  it.energySource || it.waterSource || it.emissionSource || it.wasteCategory ||
  it.permitConsentType || it.title || it.pollutantType || it.refrigerantType || it.category || 'Source item'

/** Ordered [key, value] entries for one item — form vocabulary, blanks kept. */
export function itemFieldEntries(item: Record<string, any>): Array<[string, unknown]> {
  const entries: Array<[string, unknown]> = []
  const seen = new Set<string>()
  for (const k of FIELD_ORDER) {
    if (SKIP_FIELDS.has(k) || seen.has(k)) continue
    if (k in item) { entries.push([k, item[k]]); seen.add(k) }
  }
  for (const k of Object.keys(item)) {
    if (SKIP_FIELDS.has(k) || seen.has(k)) continue
    const v = item[k]
    if (typeof v === 'object' && v !== null) continue
    entries.push([k, v]); seen.add(k)
  }
  return entries
}

/** Resolve the staged items for one BRSR level from the scoped formStateRef. */
export function levelItemsFromFormData(
  allData: Record<string, any> | undefined,
  level: number,
  projectId?: string | null,
  periodId?: string | null,
): any[] {
  if (!allData) return []
  const scoped = projectId && periodId ? allData[`l${level}-${projectId}-${periodId}`] : undefined
  const data = scoped || allData[`level${level}`] || {}
  return Array.isArray(data?.items) ? data.items : []
}
