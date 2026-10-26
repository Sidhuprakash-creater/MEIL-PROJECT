'use client'
/**
 * contributor-store.ts — MEIL ESG / BRSR Reporting Platform
 *
 * Unified Persistent Data Store & Workflow Engine for the 5 Data Contributor Roles:
 * 1. HR Data Contributor (Levels HR-1 to HR-9)
 * 2. EHS & Sustainability Contributor (Levels EHS-1 to EHS-8)
 * 3. Supply Chain Data Contributor (Levels SC-1 to SC-7)
 * 4. CSR & Social Impact Contributor (Levels CSR-1 to CSR-7)
 * 5. Governance & Compliance Contributor (Levels GOV-1 to GOV-7)
 *
 * Implements:
 * - Level 0 Common Reporting Fields (all 24 fields)
 * - Role-specific data structures with pre-filled enterprise demo data
 * - Validation engine (Blocking Errors vs Non-blocking Warnings)
 * - Evidence management (separate upload vs reviewer acceptance status)
 * - Workflow transitions (Draft → Validated → Submitted → Under Review → Accepted / Returned → Resubmitted)
 * - Activity event streams and audit trails
 */

export type ContributorRoleKey = 'HR_USER' | 'EHS_USER' | 'PROCUREMENT_USER' | 'CSR_USER' | 'COMPLIANCE_USER'

/* =========================================================================
 * Level 0 — Common Reporting Fields (Shared across all 5 roles)
 * ========================================================================= */
export interface CommonReportingFields {
  entityName: string // Prefilled from assignment, read-only
  entityId: string // Prefilled, read-only
  subsidiaryOrBu: string // Prefilled, read-only
  projectId: string // Prefilled if applicable
  reportingFy: string // Assigned reporting period e.g. 'FY 2026-27'
  reportingPeriod: 'Month' | 'Quarter' | 'Financial Year'
  reportingStartDate: string // Derived e.g. '2026-04-01'
  reportingEndDate: string // Derived e.g. '2027-03-31'
  dataModule: string // Role-specific module
  dataCategory: string // Configured dropdown
  recordName: string // User-entered record / activity name
  dataValue: string | number // Quantitative or qualitative value
  unit: string // Applicable unit
  dataAvailability: 'Reported' | 'Zero' | 'Estimated' | 'Not Available' | 'Not Applicable'
  dataSource: 'Register' | 'System' | 'Report' | 'Survey' | 'Other'
  sourceReference: string // Document ID / register ID / report reference
  calculationMethod: 'Directly measured' | 'Calculated' | 'Estimated'
  supportingEvidence: string // Upload or link reference
  remarks: string // Additional context or explanation
  preparedBy: string // Auto-populated from login
  createdAt: string // System-generated
  lastUpdated: string // System-generated
  submissionStatus: 'Draft' | 'Submitted' | 'Under Review' | 'Returned' | 'Accepted'
  reviewerComments?: string // Displayed when available
}

export function createDefaultCommonFields(
  roleKey: ContributorRoleKey,
  moduleName: string,
  category: string,
  recordName: string
): CommonReportingFields {
  const roleBuMap: Record<ContributorRoleKey, string> = {
    HR_USER: 'Corporate HR & Talent Management',
    EHS_USER: 'Safety & Environment Operations',
    PROCUREMENT_USER: 'Supply Chain & Strategic Sourcing',
    CSR_USER: 'Community Development & CSR Trust',
    COMPLIANCE_USER: 'Secretarial, Legal & Regulatory Compliance'
  }

  const roleUserMap: Record<ContributorRoleKey, string> = {
    HR_USER: 'Sunil Kumar (HR Contributor)',
    EHS_USER: 'Praveen Reddy (EHS Contributor)',
    PROCUREMENT_USER: 'Ramesh Varma (Supply Chain Contributor)',
    CSR_USER: 'Deepika Rao (CSR Contributor)',
    COMPLIANCE_USER: 'Anand Sharma (Compliance Contributor)'
  }

  return {
    entityName: 'Megha Engineering & Infrastructures Ltd.',
    entityId: 'MEIL-CORP-01',
    subsidiaryOrBu: roleBuMap[roleKey] || 'Transportation BU',
    projectId: 'MEIL-PRJ-VIJAYAWADA-WB',
    reportingFy: 'FY 2026-27',
    reportingPeriod: 'Financial Year',
    reportingStartDate: '2026-04-01',
    reportingEndDate: '2027-03-31',
    dataModule: moduleName,
    dataCategory: category,
    recordName: recordName,
    dataValue: '',
    unit: 'Count',
    dataAvailability: 'Reported',
    dataSource: 'System',
    sourceReference: `REF-${roleKey.slice(0, 3)}-2026-001`,
    calculationMethod: 'Directly measured',
    supportingEvidence: 'DOC-MEIL-AUDIT-2026.pdf',
    remarks: 'Validated against primary operational records.',
    preparedBy: roleUserMap[roleKey] || 'Enterprise Contributor',
    createdAt: '2026-09-15 10:00 AM',
    lastUpdated: '2026-10-10 11:30 AM',
    submissionStatus: 'Draft',
    reviewerComments: ''
  }
}

/* =========================================================================
 * Shared Assignment Model
 * ========================================================================= */
export interface ContributorAssignment {
  id: string
  roleKey: ContributorRoleKey
  entityBu: string
  reportingYear: string
  module: string
  levelKey: string
  completionPercentage: number
  evidenceStatus: 'Attached' | 'Missing' | 'Verified' | 'Under Review'
  submissionStatus: 'Draft' | 'Submitted' | 'Under Review' | 'Returned for Correction' | 'Accepted'
  lastUpdated: string
  dueDate: string
  description: string
  criticalWarning?: string
}

/* =========================================================================
 * Shared Evidence / Document Model (Section 8)
 * ========================================================================= */
export interface EvidenceDocument {
  id: string
  documentId: string
  documentName: string
  documentCategory: string
  linkedRole: ContributorRoleKey
  linkedEntity: string
  linkedModule: string
  linkedDataRecord: string
  reportingPeriod: string
  documentDate: string
  issuingOrganization: string
  originalFilename: string
  fileType: string
  fileSize: string
  uploadedBy: string
  uploadTimestamp: string
  reviewStatus: 'Pending Verification' | 'Verified & Accepted' | 'Flagged' | 'Rejected'
  versionNumber: string
  remarks: string
}

/* =========================================================================
 * Activity & Audit Log Model
 * ========================================================================= */
export interface ActivityEvent {
  id: string
  roleKey: ContributorRoleKey
  timestamp: string
  user: string
  action: 'Saved Draft' | 'Validated' | 'Submitted' | 'Resubmitted' | 'Uploaded Evidence' | 'Returned' | 'Accepted'
  target: string
  details: string
  badgeTone?: 'blue' | 'green' | 'amber' | 'purple' | 'rose'
}

/* =========================================================================
 * Validation Result Item
 * ========================================================================= */
export interface ValidationItem {
  id: string
  category: string
  description: string
  type: 'blocking' | 'warning'
  passed: boolean
  fieldKey?: string
  fixAction?: string
}

/* =========================================================================
 * 1. HR DATA MODELS (HR-1 to HR-9)
 * ========================================================================= */
export interface HrWorkforceProfile {
  common: CommonReportingFields
  employeeCategory: string // Permanent / Contractual
  workerCategory: string // Skilled / Semi-skilled / Unskilled
  permanentEmployees: number
  permanentWorkers: number
  otherEmployees: number
  otherWorkers: number
  maleCount: number
  femaleCount: number
  otherGenderCount: number
  workforceSourceSystem: string // SAP SuccessFactors / Darwinbox / Attendance Biometrics
  sourceReportReference: string
  supportingEvidence: string
  remarks: string
}

export interface HrDiversityRepresentation {
  common: CommonReportingFields
  reportingPopulation: string
  workforceCategory: string
  genderCategory: 'Male' | 'Female' | 'Other' | 'All'
  diversityCategory: 'General' | 'Differently Abled (PwD)' | 'Minority' | 'SC/ST/OBC' | 'Ex-Servicemen'
  totalWorkforceCount: number
  countByCategory: number
  calculatedPercentage: number
  sourceReport: string
  evidence: string
  remarks: string
}

export interface HrHiringTurnover {
  common: CommonReportingFields
  category: string
  openingHeadcount: number
  newJoiners: number
  leavingCount: number
  closingHeadcount: number
  turnoverCalculationMethod: 'Average Headcount Formula' | 'Opening/Closing Mean' | 'Statutory Rate'
  turnoverPercentage: number
  sourceHrmsReport: string
  evidence: string
  remarks: string
}

export interface HrTrainingDevelopment {
  common: CommonReportingFields
  trainingProgramme: string
  trainingCategory: 'Health & Safety' | 'Skill Upgradation' | 'POSH & Human Rights' | 'Ethics & ESG'
  targetPopulation: string
  classification: 'Employees' | 'Workers' | 'Both'
  trainingDate: string
  numberOfSessions: number
  durationHours: number
  participants: number
  participantsCompleting: number
  deliveryMethod: 'Classroom' | 'Online/LMS' | 'On-the-job' | 'Hybrid'
  trainerAgency: string
  attendanceRecordRef: string
  assessmentResult: string
  supportingEvidence: string
  remarks: string
}

export interface HrPerformanceReviews {
  common: CommonReportingFields
  reportingPopulation: string
  category: string
  totalEligiblePopulation: number
  numberReviewed: number
  reviewCompletionPercentage: number
  reviewPeriod: string
  reviewProcessReference: string
  sourceHrReport: string
  supportingEvidence: string
  remarks: string
}

export interface HrEmployeeBenefits {
  common: CommonReportingFields
  benefitCategory: 'Health Insurance' | 'Accident Insurance' | 'Maternity Benefits' | 'Paternity Benefits' | 'PF & Gratuity' | 'Day Care Facilities'
  eligiblePopulation: number
  beneficiariesCount: number
  classification: 'Employees' | 'Workers' | 'Both'
  coveragePercentage: number
  benefitPolicyReference: string
  supportingEvidence: string
  remarks: string
}

export interface HrWagesRemuneration {
  common: CommonReportingFields
  reportingPopulation: string
  category: string
  wageRemunerationMetric: 'Median Remuneration' | 'Minimum Wage Compliance' | 'Equal Pay Ratio (F:M)' | 'Gross Wage Aggregate'
  measurementPeriod: string
  aggregateAmount: number
  currencyUnit: string
  calculationMethod: string
  sourcePayrollReport: string
  evidence: string
  remarks: string
}

export interface HrGrievancesHumanRights {
  common: CommonReportingFields
  grievanceCategory: 'Working Conditions' | 'Health & Safety' | 'Child Labour / Forced Labour' | 'Discrimination / Harassment' | 'Wage Issues' | 'POSH'
  population: string
  grievancesReceived: number
  grievancesResolved: number
  grievancesPending: number
  resolutionMethod: string
  humanRightsCategory: string
  responsibleDepartment: string
  sourceRegister: string
  supportingEvidence: string
  remarks: string
}

export interface HrSafetyCoordination {
  common: CommonReportingFields
  population: string
  healthSafetyTrainingSummary: string
  workforceWellbeingProgramme: string
  participationCount: number
  benefitsSupportProgramme: string
  sourceReference: string
  supportingEvidence: string
  remarks: string
}

/* =========================================================================
 * 2. EHS DATA MODELS (EHS-1 to EHS-8)
 * ========================================================================= */
export interface EhsEnergyConsumption {
  common: CommonReportingFields
  energySource: 'Grid Electricity' | 'Renewable (Solar/Wind)' | 'Diesel (DG Sets)' | 'Petrol' | 'Natural Gas' | 'Coal' | 'Biomass'
  gridElectricityKwh: number
  renewableElectricityKwh: number
  fuelType: string
  fuelQuantity: number
  fuelUnit: 'Litres' | 'Tonnes' | 'SCM' | 'kg'
  equipmentProcessRef: string
  purchasedEnergyKwh: number
  generatedEnergyKwh: number
  meterEquipmentId: string
  openingMeterReading: number
  closingMeterReading: number
  sourceReference: string
  supportingEvidence: string
  remarks: string
}

export interface EhsWaterManagement {
  common: CommonReportingFields
  waterActivity: 'Withdrawal' | 'Consumption' | 'Reuse / Recycling' | 'Discharge'
  waterSource: 'Surface Water' | 'Groundwater' | 'Third-party / Municipal' | 'Rainwater Harvested' | 'Produced Water'
  quantity: number
  unit: 'kL (Kilolitres)' | 'm³' | 'Million Litres'
  meterSourceId: string
  openingReading: number
  closingReading: number
  recycledReusedQuantity: number
  dischargeDestination: 'Municipal Sewer' | 'Surface Water Body' | 'Effluent Treatment Plant (ETP)' | 'Zero Liquid Discharge (ZLD)'
  treatmentLevel: 'Primary' | 'Secondary' | 'Tertiary / Advanced RO'
  waterQualityResults: string
  testingLaboratory: string
  testDate: string
  supportingEvidence: string
  remarks: string
}

export interface EhsGhgEmissions {
  common: CommonReportingFields
  emissionScope: 'Scope 1 (Direct)' | 'Scope 2 (Grid Indirect)' | 'Scope 3 (Value Chain)'
  emissionSource: string
  fuelEnergyType: string
  activityQuantity: number
  activityUnit: string
  emissionFactorReference: string
  calculationMethod: string
  sourceDocument: string
  supportingEvidence: string
  pollutantType?: string
  samplingLocation?: string
  testDate?: string
  testResult?: number
  testUnit?: string
  testMethod?: string
  laboratory?: string
  applicableLimit?: number
  complianceResult?: 'Compliant' | 'Marginal' | 'Non-compliant'
  supportingReport?: string
}

export interface EhsWasteManagement {
  common: CommonReportingFields
  wasteCategory: 'Plastic Waste' | 'E-Waste' | 'Hazardous Chemical Waste' | 'Bio-medical Waste' | 'Construction & Demolition' | 'Used Oil / Batteries'
  wasteSubtype: string
  classification: 'Hazardous' | 'Non-hazardous'
  quantityGenerated: number
  unit: 'Tonnes' | 'kg' | 'm³'
  quantityReused: number
  quantityRecycled: number
  quantityRecovered: number
  quantityDisposed: number
  disposalMethod: 'Authorized Recycler' | 'TSDF Landfill' | 'Incineration' | 'Composting'
  wasteHandlerAgency: string
  authorizationReference: string
  transferManifestRef: string
  supportingEvidence: string
  remarks: string
}

export interface EhsSafetyIncidents {
  common: CommonReportingFields
  incidentId: string
  incidentDateTime: string
  locationWorkArea: string
  incidentType: 'Lost Time Injury (LTI)' | 'Minor Injury (First Aid)' | 'Near Miss' | 'Dangerous Occurrence' | 'Fatality'
  employeeWorkerCategory: 'Company Employee' | 'Contract Worker' | 'Third-Party'
  incidentDescription: string
  severityClassification: 'Low' | 'Medium' | 'High' | 'Catastrophic'
  lostWorkdays: number
  fatalityCount: number
  permanentDisabilityInfo: string
  personHoursWorked: number
  immediateAction: string
  rootCause: string
  correctivePreventiveAction: string
  responsibleOwner: string
  dueDate: string
  closureDate: string
  supportingEvidence: string
}

export interface EhsCompliancePermits {
  common: CommonReportingFields
  permitType: 'Consent to Operate (CTO)' | 'Consent to Establish (CTE)' | 'Environmental Clearance (EC)' | 'Factory License' | 'Groundwater NOC'
  permitNumber: string
  issuingAuthority: 'SPCB / CPCB' | 'MoEFCC' | 'State Directorate of Factories' | 'CGWA'
  applicableActivity: string
  issueDate: string
  expiryDate: string
  renewalStatus: 'Valid' | 'Renewal Applied' | 'Expiring in 60 Days' | 'Expired'
  inspectionDate: string
  inspectionFindings: string
  nonComplianceReference: string
  correctiveAction: string
  responsibleOwner: string
  dueDate: string
  closureDate: string
  supportingEvidence: string
}

export interface EhsEnvironmentalIncidents {
  common: CommonReportingFields
  incidentId: string
  incidentDate: string
  incidentCategory: 'Chemical Spill' | 'Gas Leak' | 'Effluent Overflow' | 'Unauthorized Emission' | 'Fire Incident'
  environmentalMedium: 'Air' | 'Water' | 'Soil' | 'Groundwater'
  location: string
  description: string
  severityImpact: 'Minor containment' | 'Moderate local impact' | 'Major offsite impact'
  immediateResponse: string
  correctiveAction: string
  reportingNotificationRef: string
  currentStatus: 'Contained & Closed' | 'Under Investigation' | 'Remediation in Progress'
  closureEvidence: string
  supportingDocuments: string
}

export interface EhsSustainabilityInitiatives {
  common: CommonReportingFields
  initiativeName: string
  initiativeCategory: 'Energy Conservation' | 'Renewable Transition' | 'Water Conservation (Rainwater Harvesting)' | 'Circular Waste' | 'Tree Plantation / Afforestation'
  baselinePeriod: string
  baselineValue: number
  reportingPeriodValue: number
  measurementUnit: string
  targetValue: number
  actualResult: number
  calculationMethod: string
  responsibleOwner: string
  supportingEvidence: string
  remarks: string
}

/* =========================================================================
 * 3. SUPPLY CHAIN DATA MODELS (SC-1 to SC-7)
 * ========================================================================= */
export interface ScSupplierMaster {
  common: CommonReportingFields
  supplierId: string
  supplierName: string
  supplierType: 'Tier 1' | 'Tier 2' | 'Service Provider' | 'Material Supplier' | 'Equipment Vendor'
  supplierCategory: 'MSME' | 'Large Enterprise' | 'Startup' | 'Local Community Vendor'
  domesticInternational: 'Domestic (India)' | 'International'
  countryState: string
  businessUnit: string
  activeStatus: 'Active' | 'Inactive' | 'Under Audit' | 'Blacklisted'
  supplierContactRef: string
  supplierMasterSource: string // SAP ERP / Ariba / Vendor Portal
  supportingEvidence: string
  remarks: string
}

export interface ScProcurementSpend {
  common: CommonReportingFields
  supplierId: string
  procurementCategory: 'Raw Materials (Steel/Cement)' | 'Heavy Equipment' | 'Subcontracting Work' | 'Logistics & Transport' | 'Consulting & Services'
  procurementAmount: number
  currency: 'INR (₹)' | 'USD ($)' | 'EUR (€)'
  purchaseContractRef: string
  sourceLedgerErpRef: string
  entityBu: string
  supportingDocument: string
  remarks: string
}

export interface ScSupplierEsgAssessment {
  common: CommonReportingFields
  supplierId: string
  assessmentDate: string
  assessmentType: 'Self-Assessment Questionnaire (SAQ)' | 'On-site Desktop Audit' | 'Third-Party Independent Verification'
  environmentalCriteriaScore: number // Out of 100
  labourSocialCriteriaScore: number // Out of 100
  healthSafetyCriteriaScore: number // Out of 100
  humanRightsCriteriaScore: number // Out of 100
  governanceEthicsCriteriaScore: number // Out of 100
  assessmentResult: 'High ESG Compliance' | 'Moderate Risk' | 'Needs Corrective Action' | 'Disqualified'
  riskClassification: 'Low Risk' | 'Medium Risk' | 'High Risk'
  findings: string
  correctiveAction: string
  responsibleOwner: string
  targetClosureDate: string
  assessmentReport: string
  remarks: string
}

export interface ScSupplierCertifications {
  common: CommonReportingFields
  supplierId: string
  certificationName: 'ISO 14001 (Environment)' | 'ISO 45001 (Safety)' | 'ISO 9001 (Quality)' | 'SA8000 (Social Accountability)' | 'BIS Standard'
  certificationNumber: string
  issuingOrganization: string
  issueDate: string
  expiryDate: string
  certificationScope: string
  verificationStatus: 'Verified Valid' | 'Expired' | 'Pending Verification' | 'Rejected'
  certificateDocument: string
  remarks: string
}

export interface ScSupplierCodeOfConduct {
  common: CommonReportingFields
  supplierId: string
  applicableCodePolicy: string
  codeVersion: string
  communicationDate: string
  acceptanceStatus: 'Formally Accepted & Signed' | 'Pending Acknowledgement' | 'Exceptions Raised'
  acceptanceDate: string
  acknowledgmentReference: string
  supportingEvidence: string
  remarks: string
}

export interface ScSupplierAudits {
  common: CommonReportingFields
  supplierId: string
  auditDate: string
  auditType: 'Periodic Sustainability Audit' | 'Pre-qualification Audit' | 'Incident-triggered Audit'
  findings: string
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical'
  correctiveAction: string
  responsibleParty: string
  dueDate: string
  closureStatus: 'Closed' | 'In Progress' | 'Overdue' | 'Open'
  closureDate: string
  evidence: string
  remarks: string
}

export interface ScValueChainData {
  common: CommonReportingFields
  valueChainPartnerId: string
  partnerType: 'Upstream Supplier' | 'Downstream Logistics' | 'Waste Recycler' | 'Subcontractor'
  reportingBoundary: 'BRSR Core Scope' | 'Extended Scope 3' | 'Operational Control'
  esgMetric: string
  activityQuantityOrValue: number
  unit: string
  sourceMethod: 'Supplier Reported Activity' | 'Spend-based Estimation' | 'LCA Model'
  supportingEvidence: string
  dataQualityStatus: 'Primary Audited' | 'Supplier Verified' | 'Industry Proxy'
  remarks: string
}

/* =========================================================================
 * 4. CSR & SOCIAL IMPACT DATA MODELS (CSR-1 to CSR-7)
 * ========================================================================= */
export interface CsrProjectMaster {
  common: CommonReportingFields
  csrProjectId: string
  projectName: string
  programmeCategory: 'Education & Skill Development' | 'Healthcare & Sanitation' | 'Rural Infrastructure' | 'Safe Drinking Water' | 'Environmental Sustainability' | 'Women Empowerment'
  implementingAgency: string // MEIL Foundation / Direct / Registered NGO Trust
  projectLocation: string
  stateDistrict: string
  startDate: string
  plannedCompletionDate: string
  actualCompletionDate: string
  projectStatus: 'Planning' | 'Active Implementation' | 'Completed' | 'Multi-Year Ongoing'
  targetBeneficiaries: number
  approvalReference: string // Board / CSR Committee Resolution
  supportingDocuments: string
  remarks: string
}

export interface CsrActivitiesBeneficiaries {
  common: CommonReportingFields
  csrProjectId: string
  activityName: string
  activityCategory: string
  plannedBeneficiaries: number
  actualBeneficiaries: number
  beneficiaryClassification: 'Women' | 'Children & Students' | 'Elderly / Marginalized' | 'Local Villagers / Farmers' | 'General Community'
  numberOfSessions: number
  activityLocation: string
  deliveryDate: string
  implementationPartner: string
  attendanceEvidence: string
  remarks: string
}

export interface CsrExpenditureReferences {
  common: CommonReportingFields
  csrProjectId: string
  approvedBudgetReference: string // Finance budget reference code
  actualExpenditureReference: string // SAP payment voucher / bank advice
  expenditureAmountCr: number // Linked expenditure in ₹ Crore
  ledgerPaymentRef: string
  implementingAgency: string
  expenditureCategory: 'Direct Project Spend' | 'Overhead & Admin (<=5%)' | 'Impact Assessment Spend'
  financialReconciliationStatus: 'Reconciled with Finance' | 'Pending Verification' | 'Variance Detected'
  supportingEvidence: string
  remarks: string
}

export interface CsrProjectOutcomes {
  common: CommonReportingFields
  csrProjectId: string
  outcomeImpactIndicator: string // e.g. 'Reduction in Waterborne Illnesses' or 'Students Passing Secondary Exam'
  baselineValue: number
  targetValue: number
  actualValue: number
  measurementUnit: string
  measurementPeriod: string
  dataCollectionMethod: 'Baseline-Endline Household Survey' | 'Government Health Center Records' | 'School Enrollment Registers'
  evaluationMethod: 'Internal Review' | 'Third-party Social Audit'
  supportingStudyReport: string
  resultStatus: 'Target Exceeded' | 'Target Achieved' | 'On Track' | 'Partially Met'
  remarks: string
}

export interface CsrCommunityGrievances {
  common: CommonReportingFields
  grievanceId: string
  dateReceived: string
  category: 'Infrastructure Inconvenience' | 'Dust / Noise Impact' | 'Local Employment Concern' | 'Water Supply Interruption' | 'General Query'
  affectedCommunityLocation: string
  description: string
  responsibleDepartment: string
  actionTaken: string
  resolutionStatus: 'Resolved' | 'In Progress' | 'Escalated to CSR Head' | 'Closed with Agreement'
  resolutionDate: string
  supportingEvidence: string
  remarks: string
}

export interface CsrSocialImpactAssessment {
  common: CommonReportingFields
  projectReference: string
  siaApplicability: 'Mandatory (Project >= ₹1 Cr + Completed 1 Yr)' | 'Voluntary Good Practice' | 'Exempted'
  assessmentAgency: string // Independent agency (e.g. TISS, PwC, Deloitte, NABARD)
  assessmentDate: string
  notificationRefNumber: string
  assessmentFindings: string
  publicDisclosureStatus: 'Published on Company Website' | 'Draft Under Board Review' | 'Exempted'
  publicReportUrl: string
  supportingReport: string
  correctiveAction: string
  remarks: string
}

export interface CsrRehabilitationResettlement {
  common: CommonReportingFields
  projectReference: string
  stateDistrict: string
  pafsIdentified: number // Project-Affected Families
  pafsCoveredByRandR: number
  compensationSupportReference: string
  paymentEvidenceReference: string
  status: 'All Compensation Disbursed' | 'In Progress' | 'Disputed / In Court' | 'Not Applicable'
  supportingDocuments: string
  remarks: string
}

/* =========================================================================
 * 5. GOVERNANCE & COMPLIANCE DATA MODELS (GOV-1 to GOV-7)
 * ========================================================================= */
export interface GovPolicyRegister {
  common: CommonReportingFields
  policyId: string
  policyName: string
  policyCategory: 'Business Conduct & Ethics' | 'Anti-Bribery & Corruption' | 'Whistleblower Policy' | 'Human Rights Policy' | 'EHS Policy' | 'CSR & Sustainability Policy' | 'Data Privacy & Cyber'
  policyVersion: string
  policyOwner: string // Company Secretary / Legal Counsel / Chief Compliance Officer
  approvalAuthority: 'Board of Directors' | 'Audit Committee' | 'MD & CEO'
  approvalDate: string
  effectiveDate: string
  lastReviewDate: string
  nextReviewDate: string
  applicability: 'All Group Entities & Operations' | 'Subsidiaries & Joint Ventures' | 'Value-Chain Partners'
  isPubliclyAvailable: 'Yes' | 'No'
  publicUrl: string
  policyDocument: string
  remarks: string
}

export interface GovPolicyImplementation {
  common: CommonReportingFields
  policyId: string
  implementationStatus: 'Fully Implemented' | 'Under Rollout' | 'Annual Refresh in Progress'
  applicableEntities: string
  communicationDate: string
  coveragePercentage: number
  trainingAwarenessRef: string
  reviewMethod: 'Internal Compliance Audit' | 'Secretarial Audit' | 'Third-Party Legal Review'
  reviewFindings: string
  correctiveAction: string
  responsibleOwner: string
  dueDate: string
  supportingEvidence: string
  remarks: string
}

export interface GovBusinessEthics {
  common: CommonReportingFields
  disclosureCategory: 'Anti-Corruption Training' | 'Conflict of Interest Disclosures' | 'Gifts & Hospitality Register' | 'Anti-Competitive Conduct'
  trainingActivity: string
  applicablePopulation: 'Directors & KMPs' | 'Senior Leadership' | 'All Employees' | 'Supply Chain Partners'
  participationCount: number
  complaintCategory: string
  countReceived: number
  countResolved: number
  countPending: number
  sourceRegister: string
  supportingEvidence: string
  remarks: string
}

export interface GovWhistleblowerGrievances {
  common: CommonReportingFields
  grievanceReference: string
  grievanceCategory: 'Financial Impropriety' | 'Bribery / Kickback' | 'Harassment / Discrimination' | 'Environmental Violation' | 'Safety Compromise'
  dateReceived: string
  stakeholderCategory: 'Employee' | 'Contractor / Vendor' | 'Community Member' | 'Shareholder'
  countReceived: number
  countResolved: number
  countPending: number
  resolutionStatus: 'Resolved & Closed' | 'Investigation Active' | 'Escalated to Audit Committee'
  sourceRegister: string
  evidenceReference: string
  remarks: string
}

export interface GovRegulatoryCompliance {
  common: CommonReportingFields
  complianceNoticeId: string
  regulationRequirement: string // e.g. 'SEBI (LODR) Regulations', 'Companies Act 2013', 'EPF Act', 'Air & Water Act'
  issuingAuthority: 'SEBI' | 'Ministry of Corporate Affairs (MCA)' | 'Pollution Control Board' | 'Labour Department' | 'Tax Authorities'
  noticeDate: string
  entityBu: string
  description: string
  allegedNonCompliance: string
  hasFinancialPenalty: 'Yes' | 'No'
  amountAndCurrency: string
  currentStatus: 'Alleged / SCN Received' | 'Under Legal Examination' | 'Reply Submitted' | 'Adjudicated & Penalty Paid' | 'Case Disposed Off'
  correctiveAction: string
  responsibleOwner: string
  dueDate: string
  resolutionDate: string
  supportingDocuments: string
  remarks: string
}

export interface GovHumanRights {
  common: CommonReportingFields
  policyDisclosureCategory: 'Child Labour Due Diligence' | 'Forced / Involuntary Labour' | 'Wages & Fair Working Hours' | 'Freedom of Association' | 'Workplace Discrimination'
  applicableEntity: string
  dueDiligenceActivity: string
  issuesIdentified: string
  complaintsReceived: number
  correctiveActions: string
  resolutionStatus: 'No Violations Identified' | 'Corrective Action Completed' | 'Under Remediation'
  sourceRegister: string
  supportingEvidence: string
  remarks: string
}

export interface GovGovernanceOversight {
  common: CommonReportingFields
  governanceTopic: 'BRSR Reporting Oversight' | 'ESG Risk Assessment' | 'Materiality Validation' | 'Stakeholder Feedback Review'
  responsibleAuthority: 'ESG & Sustainability Committee of Board' | 'Audit Committee' | 'Risk Management Committee'
  assignedReportingOwner: string
  approvalReviewDate: string
  reviewFrequency: 'Quarterly' | 'Bi-annual' | 'Annual'
  meetingResolutionRef: string
  applicableEntity: string
  evidenceDocument: string
  remarks: string
}

/* =========================================================================
 * Persistent Store Class with LocalStorage synchronization
 * ========================================================================= */
class ContributorStore {
  private assignmentsKey = 'meil_contributor_assignments_v1'
  private evidenceKey = 'meil_contributor_evidence_v1'
  private activityKey = 'meil_contributor_activity_v1'

  // Specific role storage keys
  private hrKey = 'meil_contributor_hr_data_v1'
  private ehsKey = 'meil_contributor_ehs_data_v1'
  private scKey = 'meil_contributor_sc_data_v1'
  private csrKey = 'meil_contributor_csr_data_v1'
  private govKey = 'meil_contributor_gov_data_v1'

  constructor() {
    if (typeof window !== 'undefined') {
      this.initSeedDataIfEmpty()
    }
  }

  private isClient(): boolean {
    return typeof window !== 'undefined'
  }

  private safeGet<T>(key: string, defaultVal: T): T {
    if (!this.isClient()) return defaultVal
    try {
      const data = localStorage.getItem(key)
      return data ? JSON.parse(data) : defaultVal
    } catch (e) {
      console.warn(`Failed to parse localStorage key ${key}`, e)
      return defaultVal
    }
  }

  private safeSet<T>(key: string, val: T): void {
    if (!this.isClient()) return
    try {
      localStorage.setItem(key, JSON.stringify(val))
    } catch (e) {
      console.warn(`Failed to set localStorage key ${key}`, e)
    }
  }

  /* -------------------------------------------------------------
   * Assignments
   * ------------------------------------------------------------- */
  public getAssignments(role?: ContributorRoleKey): ContributorAssignment[] {
    const list = this.safeGet<ContributorAssignment[]>(this.assignmentsKey, this.getDefaultAssignments())
    return role ? list.filter(a => a.roleKey === role) : list
  }

  public updateAssignmentStatus(
    id: string,
    status: ContributorAssignment['submissionStatus'],
    pct?: number
  ): void {
    const list = this.getAssignments()
    const updated = list.map(a => {
      if (a.id === id) {
        return {
          ...a,
          submissionStatus: status,
          completionPercentage: pct !== undefined ? pct : a.completionPercentage,
          lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' today'
        }
      }
      return a
    })
    this.safeSet(this.assignmentsKey, updated)
  }

  /* -------------------------------------------------------------
   * Evidence / Documents
   * ------------------------------------------------------------- */
  public getEvidence(role?: ContributorRoleKey): EvidenceDocument[] {
    const list = this.safeGet<EvidenceDocument[]>(this.evidenceKey, this.getDefaultEvidence())
    return role ? list.filter(e => e.linkedRole === role) : list
  }

  public addEvidence(doc: EvidenceDocument): void {
    const list = this.getEvidence()
    const updated = [doc, ...list]
    this.safeSet(this.evidenceKey, updated)
    this.addActivity({
      id: 'act-' + Date.now(),
      roleKey: doc.linkedRole,
      timestamp: 'Just now',
      user: doc.uploadedBy,
      action: 'Uploaded Evidence',
      target: doc.documentName,
      details: `${doc.fileType} (${doc.fileSize}) linked to ${doc.linkedModule}. Review status: ${doc.reviewStatus}`,
      badgeTone: 'blue'
    })
  }

  public updateEvidenceReviewStatus(
    id: string,
    status: EvidenceDocument['reviewStatus']
  ): void {
    const list = this.getEvidence()
    const updated = list.map(e => e.id === id ? { ...e, reviewStatus: status } : e)
    this.safeSet(this.evidenceKey, updated)
  }

  /* -------------------------------------------------------------
   * Activities
   * ------------------------------------------------------------- */
  public getActivities(role?: ContributorRoleKey): ActivityEvent[] {
    const list = this.safeGet<ActivityEvent[]>(this.activityKey, this.getDefaultActivities())
    return role ? list.filter(a => a.roleKey === role) : list
  }

  public addActivity(event: ActivityEvent): void {
    const list = this.getActivities()
    this.safeSet(this.activityKey, [event, ...list.slice(0, 40)])
  }

  /* -------------------------------------------------------------
   * Role 1 — HR Data Methods
   * ------------------------------------------------------------- */
  public getHrData(): {
    workforceProfile: HrWorkforceProfile
    diversity: HrDiversityRepresentation
    turnover: HrHiringTurnover
    training: HrTrainingDevelopment
    reviews: HrPerformanceReviews
    benefits: HrEmployeeBenefits
    wages: HrWagesRemuneration
    grievances: HrGrievancesHumanRights
    safetyCoord: HrSafetyCoordination
  } {
    return this.safeGet(this.hrKey, this.getDefaultHrData())
  }

  public saveHrData(data: ReturnType<ContributorStore['getHrData']>): void {
    this.safeSet(this.hrKey, data)
  }

  /* -------------------------------------------------------------
   * Role 2 — EHS Data Methods
   * ------------------------------------------------------------- */
  public getEhsData(): {
    energy: EhsEnergyConsumption
    water: EhsWaterManagement
    ghg: EhsGhgEmissions
    waste: EhsWasteManagement
    safety: EhsSafetyIncidents
    permits: EhsCompliancePermits
    incidents: EhsEnvironmentalIncidents
    initiatives: EhsSustainabilityInitiatives
  } {
    return this.safeGet(this.ehsKey, this.getDefaultEhsData())
  }

  public saveEhsData(data: ReturnType<ContributorStore['getEhsData']>): void {
    this.safeSet(this.ehsKey, data)
  }

  /* -------------------------------------------------------------
   * Role 3 — Supply Chain Data Methods
   * ------------------------------------------------------------- */
  public getScData(): {
    supplierMaster: ScSupplierMaster
    spend: ScProcurementSpend
    assessment: ScSupplierEsgAssessment
    certifications: ScSupplierCertifications
    codeOfConduct: ScSupplierCodeOfConduct
    audits: ScSupplierAudits
    valueChain: ScValueChainData
  } {
    return this.safeGet(this.scKey, this.getDefaultScData())
  }

  public saveScData(data: ReturnType<ContributorStore['getScData']>): void {
    this.safeSet(this.scKey, data)
  }

  /* -------------------------------------------------------------
   * Role 4 — CSR Data Methods
   * ------------------------------------------------------------- */
  public getCsrData(): {
    projectMaster: CsrProjectMaster
    activities: CsrActivitiesBeneficiaries
    expenditure: CsrExpenditureReferences
    outcomes: CsrProjectOutcomes
    grievances: CsrCommunityGrievances
    sia: CsrSocialImpactAssessment
    rr: CsrRehabilitationResettlement
  } {
    return this.safeGet(this.csrKey, this.getDefaultCsrData())
  }

  public saveCsrData(data: ReturnType<ContributorStore['getCsrData']>): void {
    this.safeSet(this.csrKey, data)
  }

  /* -------------------------------------------------------------
   * Role 5 — Governance & Compliance Data Methods
   * ------------------------------------------------------------- */
  public getGovData(): {
    policies: GovPolicyRegister
    implementation: GovPolicyImplementation
    ethics: GovBusinessEthics
    whistleblower: GovWhistleblowerGrievances
    compliance: GovRegulatoryCompliance
    humanRights: GovHumanRights
    oversight: GovGovernanceOversight
  } {
    return this.safeGet(this.govKey, this.getDefaultGovData())
  }

  public saveGovData(data: ReturnType<ContributorStore['getGovData']>): void {
    this.safeSet(this.govKey, data)
  }

  /* -------------------------------------------------------------
   * Validation Engines per Role
   * ------------------------------------------------------------- */
  public validateRole(roleKey: ContributorRoleKey): {
    passed: boolean
    blockingCount: number
    warningCount: number
    items: ValidationItem[]
  } {
    const items: ValidationItem[] = []

    if (roleKey === 'HR_USER') {
      const hr = this.getHrData()
      const totalMaleFemale = hr.workforceProfile.maleCount + hr.workforceProfile.femaleCount + hr.workforceProfile.otherGenderCount
      const totalPermOther = hr.workforceProfile.permanentEmployees + hr.workforceProfile.permanentWorkers + hr.workforceProfile.otherEmployees + hr.workforceProfile.otherWorkers
      
      items.push({
        id: 'val-hr-1',
        category: 'Workforce Profile',
        description: 'Gender totals reconcile with workforce category count (Male + Female + Other == Employees + Workers)',
        type: 'blocking',
        passed: totalMaleFemale === totalPermOther && totalMaleFemale > 0,
        fixAction: 'Ensure Male, Female, and Other sums match Permanent + Other categories.'
      })

      items.push({
        id: 'val-hr-2',
        category: 'Hiring & Turnover',
        description: 'Closing Headcount must equal Opening + Joiners - Leavers',
        type: 'blocking',
        passed: hr.turnover.closingHeadcount === (hr.turnover.openingHeadcount + hr.turnover.newJoiners - hr.turnover.leavingCount),
        fixAction: 'Reconcile turnover arithmetic.'
      })

      items.push({
        id: 'val-hr-3',
        category: 'Training & Development',
        description: 'Participants completing training cannot exceed total participants',
        type: 'blocking',
        passed: hr.training.participantsCompleting <= hr.training.participants,
        fixAction: 'Verify attendance records vs certifications.'
      })

      items.push({
        id: 'val-hr-4',
        category: 'Evidence Linkage',
        description: 'Primary HRMS audit evidence document must be attached and referenced',
        type: 'warning',
        passed: Boolean(hr.workforceProfile.supportingEvidence && hr.workforceProfile.supportingEvidence.length > 3),
        fixAction: 'Upload HRMS attendance register or statutory return.'
      })

      items.push({
        id: 'val-hr-5',
        category: 'Grievance Resolution',
        description: 'Total Pending grievances must equal Received minus Resolved',
        type: 'blocking',
        passed: hr.grievances.grievancesPending === (hr.grievances.grievancesReceived - hr.grievances.grievancesResolved),
        fixAction: 'Reconcile pending complaint figures in grievance register.'
      })
    } else if (roleKey === 'EHS_USER') {
      const ehs = this.getEhsData()

      items.push({
        id: 'val-ehs-1',
        category: 'Energy Reporting',
        description: 'Meter readings consistency: Closing meter reading must exceed or equal opening reading',
        type: 'blocking',
        passed: ehs.energy.closingMeterReading >= ehs.energy.openingMeterReading,
        fixAction: 'Check meter rollover or verify meter logbook numbers.'
      })

      items.push({
        id: 'val-ehs-2',
        category: 'Water Balance',
        description: 'Water withdrawal, consumption, and discharge must be tracked as distinct non-equal quantities',
        type: 'blocking',
        passed: ehs.water.quantity > 0 && ehs.water.waterActivity.length > 0,
        fixAction: 'Confirm meter source ID and volumetric quantity.'
      })

      items.push({
        id: 'val-ehs-3',
        category: 'Waste Management',
        description: 'Waste reused + recycled + recovered + disposed must reconcile with quantity generated',
        type: 'warning',
        passed: (ehs.waste.quantityReused + ehs.waste.quantityRecycled + ehs.waste.quantityRecovered + ehs.waste.quantityDisposed) <= ehs.waste.quantityGenerated,
        fixAction: 'Verify waste handler weighbridge slips.'
      })

      items.push({
        id: 'val-ehs-4',
        category: 'Permits & Compliance',
        description: 'Consent to Operate (CTO) must not be expired',
        type: 'blocking',
        passed: ehs.permits.renewalStatus !== 'Expired',
        fixAction: 'Renew CTO or attach acknowledgment slip of renewal application.'
      })

      items.push({
        id: 'val-ehs-5',
        category: 'Safety Incidents',
        description: 'Incident corrective action must have an assigned owner and due date',
        type: 'blocking',
        passed: Boolean(ehs.safety.responsibleOwner && ehs.safety.dueDate),
        fixAction: 'Assign responsible safety officer and target closure date.'
      })
    } else if (roleKey === 'PROCUREMENT_USER') {
      const sc = this.getScData()

      items.push({
        id: 'val-sc-1',
        category: 'Supplier Master',
        description: 'Supplier ID must follow standard format and not be duplicate',
        type: 'blocking',
        passed: Boolean(sc.supplierMaster.supplierId && sc.supplierMaster.supplierName),
        fixAction: 'Enter valid ERP vendor code.'
      })

      items.push({
        id: 'val-sc-2',
        category: 'Certifications',
        description: 'Supplier environmental / safety certification must have valid expiry date',
        type: 'warning',
        passed: sc.certifications.verificationStatus !== 'Expired',
        fixAction: 'Request renewed certificate copy from vendor.'
      })

      items.push({
        id: 'val-sc-3',
        category: 'ESG Assessment',
        description: 'Assessment score across 5 pillars must be between 0 and 100',
        type: 'blocking',
        passed: sc.assessment.environmentalCriteriaScore >= 0 && sc.assessment.environmentalCriteriaScore <= 100,
        fixAction: 'Complete criteria grading.'
      })

      items.push({
        id: 'val-sc-4',
        category: 'Code of Conduct',
        description: 'Critical tier-1 suppliers must have signed Code of Conduct on file',
        type: 'blocking',
        passed: sc.codeOfConduct.acceptanceStatus === 'Formally Accepted & Signed',
        fixAction: 'Obtain signed supplier declaration.'
      })
    } else if (roleKey === 'CSR_USER') {
      const csr = this.getCsrData()

      items.push({
        id: 'val-csr-1',
        category: 'Project Master',
        description: 'Target beneficiaries must be greater than zero for approved projects',
        type: 'blocking',
        passed: csr.projectMaster.targetBeneficiaries > 0,
        fixAction: 'Define target beneficiary count from project sanction note.'
      })

      items.push({
        id: 'val-csr-2',
        category: 'Beneficiary Tracking',
        description: 'Actual beneficiaries achieved should be documented with attendance/benefit rolls',
        type: 'warning',
        passed: csr.activities.actualBeneficiaries > 0 && Boolean(csr.activities.attendanceEvidence),
        fixAction: 'Attach beneficiary verification rolls.'
      })

      items.push({
        id: 'val-csr-3',
        category: 'Expenditure Verification',
        description: 'CSR spend reference must match Finance ledger code',
        type: 'blocking',
        passed: csr.expenditure.financialReconciliationStatus === 'Reconciled with Finance',
        fixAction: 'Reconcile CSR disbursements with finance accounting register.'
      })

      items.push({
        id: 'val-csr-4',
        category: 'Social Impact Assessment',
        description: 'Mandatory SIA required for projects >= ₹1 Crore completed > 1 year ago',
        type: 'blocking',
        passed: Boolean(csr.sia.assessmentAgency && csr.sia.assessmentFindings),
        fixAction: 'Attach third-party SIA agency report.'
      })
    } else if (roleKey === 'COMPLIANCE_USER') {
      const gov = this.getGovData()

      items.push({
        id: 'val-gov-1',
        category: 'Policy Register',
        description: 'BRSR mandatory policies must have approved date and board approval authority',
        type: 'blocking',
        passed: Boolean(gov.policies.approvalAuthority && gov.policies.approvalDate),
        fixAction: 'Select approving authority and resolution date.'
      })

      items.push({
        id: 'val-gov-2',
        category: 'Review Cadence',
        description: 'Policy review date must not be overdue past scheduled next review date',
        type: 'warning',
        passed: Boolean(gov.policies.nextReviewDate),
        fixAction: 'Schedule annual policy review with secretarial team.'
      })

      items.push({
        id: 'val-gov-3',
        category: 'Regulatory Notices',
        description: 'All show-cause notices must record resolution status and penalty disclosure',
        type: 'blocking',
        passed: Boolean(gov.compliance.currentStatus && gov.compliance.hasFinancialPenalty),
        fixAction: 'Confirm penalty status with legal department.'
      })

      items.push({
        id: 'val-gov-4',
        category: 'Whistleblower Grievances',
        description: 'Pending complaints must reconcile (Received - Resolved)',
        type: 'blocking',
        passed: gov.whistleblower.countPending === (gov.whistleblower.countReceived - gov.whistleblower.countResolved),
        fixAction: 'Reconcile ombudsperson quarterly log.'
      })
    }

    const blockingCount = items.filter(i => i.type === 'blocking' && !i.passed).length
    const warningCount = items.filter(i => i.type === 'warning' && !i.passed).length

    return {
      passed: blockingCount === 0,
      blockingCount,
      warningCount,
      items
    }
  }

  /* -------------------------------------------------------------
   * Default Seeds
   * ------------------------------------------------------------- */
  private initSeedDataIfEmpty(): void {
    if (!localStorage.getItem(this.assignmentsKey)) {
      this.safeSet(this.assignmentsKey, this.getDefaultAssignments())
    }
    if (!localStorage.getItem(this.evidenceKey)) {
      this.safeSet(this.evidenceKey, this.getDefaultEvidence())
    }
    if (!localStorage.getItem(this.activityKey)) {
      this.safeSet(this.activityKey, this.getDefaultActivities())
    }
    if (!localStorage.getItem(this.hrKey)) {
      this.safeSet(this.hrKey, this.getDefaultHrData())
    }
    if (!localStorage.getItem(this.ehsKey)) {
      this.safeSet(this.ehsKey, this.getDefaultEhsData())
    }
    if (!localStorage.getItem(this.scKey)) {
      this.safeSet(this.scKey, this.getDefaultScData())
    }
    if (!localStorage.getItem(this.csrKey)) {
      this.safeSet(this.csrKey, this.getDefaultCsrData())
    }
    if (!localStorage.getItem(this.govKey)) {
      this.safeSet(this.govKey, this.getDefaultGovData())
    }
  }

  private getDefaultAssignments(): ContributorAssignment[] {
    return [
      // HR
      {
        id: 'asg-hr-01',
        roleKey: 'HR_USER',
        entityBu: 'Corporate HR & Talent Management',
        reportingYear: 'FY 2026-27',
        module: 'Workforce Profile (HR-1)',
        levelKey: 'HR-1',
        completionPercentage: 85,
        evidenceStatus: 'Attached',
        submissionStatus: 'Draft',
        lastUpdated: '10:15 AM today',
        dueDate: '15 Oct 2026',
        description: 'BRSR Principle 3 workforce counts & gender representation'
      },
      {
        id: 'asg-hr-02',
        roleKey: 'HR_USER',
        entityBu: 'Corporate HR & Talent Management',
        reportingYear: 'FY 2026-27',
        module: 'Diversity & PwD (HR-2)',
        levelKey: 'HR-2',
        completionPercentage: 100,
        evidenceStatus: 'Verified',
        submissionStatus: 'Submitted',
        lastUpdated: '09:30 AM yesterday',
        dueDate: '15 Oct 2026',
        description: 'Differently abled inclusion and employee category representation'
      },
      {
        id: 'asg-hr-03',
        roleKey: 'HR_USER',
        entityBu: 'Transportation BU',
        reportingYear: 'FY 2026-27',
        module: 'Training & Skill Dev (HR-4)',
        levelKey: 'HR-4',
        completionPercentage: 60,
        evidenceStatus: 'Attached',
        submissionStatus: 'Under Review',
        lastUpdated: '04:12 PM 2 days ago',
        dueDate: '20 Oct 2026',
        description: 'POSH, Safety & Skill development training hours'
      },
      {
        id: 'asg-hr-04',
        roleKey: 'HR_USER',
        entityBu: 'Corporate HR & Talent Management',
        reportingYear: 'FY 2026-27',
        module: 'Grievance Mechanism (HR-8)',
        levelKey: 'HR-8',
        completionPercentage: 40,
        evidenceStatus: 'Missing',
        submissionStatus: 'Returned for Correction',
        lastUpdated: '11:00 AM 3 days ago',
        dueDate: '12 Oct 2026',
        description: 'Reviewer Note: Breakdown between permanent workers and contractual pending.',
        criticalWarning: 'Returned: Provide separated contractor grievance counts.'
      },

      // EHS
      {
        id: 'asg-ehs-01',
        roleKey: 'EHS_USER',
        entityBu: 'Safety & Environment Operations',
        reportingYear: 'FY 2026-27',
        module: 'Energy Consumption (EHS-1)',
        levelKey: 'EHS-1',
        completionPercentage: 90,
        evidenceStatus: 'Attached',
        submissionStatus: 'Draft',
        lastUpdated: '11:20 AM today',
        dueDate: '15 Oct 2026',
        description: 'Electricity & fuel consumption at Vijayawada Western Bypass'
      },
      {
        id: 'asg-ehs-02',
        roleKey: 'EHS_USER',
        entityBu: 'Safety & Environment Operations',
        reportingYear: 'FY 2026-27',
        module: 'Water Management (EHS-2)',
        levelKey: 'EHS-2',
        completionPercentage: 75,
        evidenceStatus: 'Attached',
        submissionStatus: 'Draft',
        lastUpdated: '02:40 PM yesterday',
        dueDate: '18 Oct 2026',
        description: 'Groundwater abstraction, recycling and tanker supply'
      },
      {
        id: 'asg-ehs-03',
        roleKey: 'EHS_USER',
        entityBu: 'Safety & Environment Operations',
        reportingYear: 'FY 2026-27',
        module: 'Safety Incidents & LTIFR (EHS-5)',
        levelKey: 'EHS-5',
        completionPercentage: 100,
        evidenceStatus: 'Verified',
        submissionStatus: 'Submitted',
        lastUpdated: '10:00 AM yesterday',
        dueDate: '10 Oct 2026',
        description: 'Zero fatality milestone and man-hours worked registry'
      },
      {
        id: 'asg-ehs-04',
        roleKey: 'EHS_USER',
        entityBu: 'Safety & Environment Operations',
        reportingYear: 'FY 2026-27',
        module: 'Waste & Hazardous Materials (EHS-4)',
        levelKey: 'EHS-4',
        completionPercentage: 45,
        evidenceStatus: 'Missing',
        submissionStatus: 'Returned for Correction',
        lastUpdated: '09:15 AM 3 days ago',
        dueDate: '12 Oct 2026',
        description: 'Reviewer Note: Manifest copy for used battery disposal missing.',
        criticalWarning: 'Missing Form 10 hazardous manifest.'
      },

      // Supply Chain
      {
        id: 'asg-sc-01',
        roleKey: 'PROCUREMENT_USER',
        entityBu: 'Supply Chain & Sourcing',
        reportingYear: 'FY 2026-27',
        module: 'Supplier Master (SC-1)',
        levelKey: 'SC-1',
        completionPercentage: 95,
        evidenceStatus: 'Verified',
        submissionStatus: 'Accepted',
        lastUpdated: '01:00 PM yesterday',
        dueDate: '10 Oct 2026',
        description: 'Tier-1 critical steel, cement & aggregates vendor registry'
      },
      {
        id: 'asg-sc-02',
        roleKey: 'PROCUREMENT_USER',
        entityBu: 'Supply Chain & Sourcing',
        reportingYear: 'FY 2026-27',
        module: 'Supplier ESG Assessments (SC-3)',
        levelKey: 'SC-3',
        completionPercentage: 60,
        evidenceStatus: 'Attached',
        submissionStatus: 'Draft',
        lastUpdated: '11:45 AM today',
        dueDate: '22 Oct 2026',
        description: 'Onsite ESG assessment results for top 50 vendors by spend'
      },
      {
        id: 'asg-sc-03',
        roleKey: 'PROCUREMENT_USER',
        entityBu: 'Supply Chain & Sourcing',
        reportingYear: 'FY 2026-27',
        module: 'Code of Conduct Signoffs (SC-5)',
        levelKey: 'SC-5',
        completionPercentage: 50,
        evidenceStatus: 'Attached',
        submissionStatus: 'Under Review',
        lastUpdated: '03:15 PM 2 days ago',
        dueDate: '25 Oct 2026',
        description: 'Supplier Business Conduct Policy acknowledgments'
      },

      // CSR
      {
        id: 'asg-csr-01',
        roleKey: 'CSR_USER',
        entityBu: 'MEIL CSR Foundation',
        reportingYear: 'FY 2026-27',
        module: 'CSR Project Master (CSR-1)',
        levelKey: 'CSR-1',
        completionPercentage: 100,
        evidenceStatus: 'Verified',
        submissionStatus: 'Submitted',
        lastUpdated: '10:30 AM yesterday',
        dueDate: '15 Oct 2026',
        description: 'Schedule VII drinking water & health clinic projects'
      },
      {
        id: 'asg-csr-02',
        roleKey: 'CSR_USER',
        entityBu: 'MEIL CSR Foundation',
        reportingYear: 'FY 2026-27',
        module: 'Beneficiaries & Activities (CSR-2)',
        levelKey: 'CSR-2',
        completionPercentage: 80,
        evidenceStatus: 'Attached',
        submissionStatus: 'Draft',
        lastUpdated: '09:00 AM today',
        dueDate: '20 Oct 2026',
        description: 'RO water plant coverage across 24 villages'
      },
      {
        id: 'asg-csr-03',
        roleKey: 'CSR_USER',
        entityBu: 'MEIL CSR Foundation',
        reportingYear: 'FY 2026-27',
        module: 'Social Impact Assessment (CSR-6)',
        levelKey: 'CSR-6',
        completionPercentage: 100,
        evidenceStatus: 'Verified',
        submissionStatus: 'Accepted',
        lastUpdated: '04:00 PM 3 days ago',
        dueDate: '10 Oct 2026',
        description: 'Independent evaluation by Osmania University Institute'
      },

      // Governance
      {
        id: 'asg-gov-01',
        roleKey: 'COMPLIANCE_USER',
        entityBu: 'Secretarial & Legal Compliance',
        reportingYear: 'FY 2026-27',
        module: 'Policy Register (GOV-1)',
        levelKey: 'GOV-1',
        completionPercentage: 100,
        evidenceStatus: 'Verified',
        submissionStatus: 'Accepted',
        lastUpdated: '02:00 PM yesterday',
        dueDate: '08 Oct 2026',
        description: 'All 9 BRSR Principles approved board policies'
      },
      {
        id: 'asg-gov-02',
        roleKey: 'COMPLIANCE_USER',
        entityBu: 'Secretarial & Legal Compliance',
        reportingYear: 'FY 2026-27',
        module: 'Regulatory Notices & SCN (GOV-5)',
        levelKey: 'GOV-5',
        completionPercentage: 70,
        evidenceStatus: 'Attached',
        submissionStatus: 'Draft',
        lastUpdated: '11:15 AM today',
        dueDate: '18 Oct 2026',
        description: 'Tracking environmental, municipal & labour notices'
      },
      {
        id: 'asg-gov-03',
        roleKey: 'COMPLIANCE_USER',
        entityBu: 'Secretarial & Legal Compliance',
        reportingYear: 'FY 2026-27',
        module: 'Whistleblower Disclosures (GOV-4)',
        levelKey: 'GOV-4',
        completionPercentage: 90,
        evidenceStatus: 'Attached',
        submissionStatus: 'Under Review',
        lastUpdated: '05:00 PM 2 days ago',
        dueDate: '20 Oct 2026',
        description: 'Audit committee ombudsman quarterly case log'
      }
    ]
  }

  private getDefaultEvidence(): EvidenceDocument[] {
    return [
      {
        id: 'doc-hr-01',
        documentId: 'DOC-HR-2026-001',
        documentName: 'HRMS_Annual_Headcount_Report_Audited.xlsx',
        documentCategory: 'Workforce Records',
        linkedRole: 'HR_USER',
        linkedEntity: 'MEIL Corporate',
        linkedModule: 'Workforce Profile (HR-1)',
        linkedDataRecord: 'Workforce Census FY27',
        reportingPeriod: 'FY 2026-27',
        documentDate: '2026-09-30',
        issuingOrganization: 'Corporate Human Resources',
        originalFilename: 'HRMS_Annual_Headcount_Report_Audited.xlsx',
        fileType: 'XLSX',
        fileSize: '3.4 MB',
        uploadedBy: 'Sunil Kumar (HR)',
        uploadTimestamp: '2026-10-02 11:20 AM',
        reviewStatus: 'Verified & Accepted',
        versionNumber: 'v2.1',
        remarks: 'Reconciled with monthly PF remittance returns.'
      },
      {
        id: 'doc-ehs-01',
        documentId: 'DOC-EHS-2026-014',
        documentName: 'Electricity_Discom_Bills_H1_Consolidated.pdf',
        documentCategory: 'Energy & Utility Invoices',
        linkedRole: 'EHS_USER',
        linkedEntity: 'Vijayawada Western Bypass Site',
        linkedModule: 'Energy Consumption (EHS-1)',
        linkedDataRecord: 'Grid Electricity Meter ID AP-DISC-77',
        reportingPeriod: 'FY 2026-27 (H1)',
        documentDate: '2026-10-01',
        issuingOrganization: 'APCPDCL Distribution Co.',
        originalFilename: 'Electricity_Discom_Bills_H1_Consolidated.pdf',
        fileType: 'PDF',
        fileSize: '8.2 MB',
        uploadedBy: 'Praveen Reddy (EHS)',
        uploadTimestamp: '2026-10-05 03:15 PM',
        reviewStatus: 'Verified & Accepted',
        versionNumber: 'v1.0',
        remarks: 'Includes 12 substation meter cards.'
      },
      {
        id: 'doc-sc-01',
        documentId: 'DOC-SC-2026-008',
        documentName: 'Tata_Steel_ISO14001_and_GreenPro_Cert.pdf',
        documentCategory: 'Vendor Environmental Certifications',
        linkedRole: 'PROCUREMENT_USER',
        linkedEntity: 'Supply Chain Division',
        linkedModule: 'Certifications (SC-4)',
        linkedDataRecord: 'Vendor #SUP-MEIL-001 (Tata Steel)',
        reportingPeriod: 'FY 2026-27',
        documentDate: '2026-08-15',
        issuingOrganization: 'TÜV NORD Cert GmbH',
        originalFilename: 'Tata_Steel_ISO14001_and_GreenPro_Cert.pdf',
        fileType: 'PDF',
        fileSize: '2.1 MB',
        uploadedBy: 'Ramesh Varma (SCM)',
        uploadTimestamp: '2026-10-06 09:40 AM',
        reviewStatus: 'Verified & Accepted',
        versionNumber: 'v1.0',
        remarks: 'Valid through 2028-05-30.'
      },
      {
        id: 'doc-csr-01',
        documentId: 'DOC-CSR-2026-003',
        documentName: 'RO_Water_Plant_Village_Signoff_Rolls.pdf',
        documentCategory: 'Community Beneficiary Registers',
        linkedRole: 'CSR_USER',
        linkedEntity: 'MEIL Foundation',
        linkedModule: 'Beneficiaries (CSR-2)',
        linkedDataRecord: 'Project PRJ-CSR-2026-01',
        reportingPeriod: 'FY 2026-27',
        documentDate: '2026-09-20',
        issuingOrganization: 'Grama Panchayat Council',
        originalFilename: 'RO_Water_Plant_Village_Signoff_Rolls.pdf',
        fileType: 'PDF',
        fileSize: '4.8 MB',
        uploadedBy: 'Deepika Rao (CSR)',
        uploadTimestamp: '2026-10-07 02:10 PM',
        reviewStatus: 'Pending Verification',
        versionNumber: 'v1.0',
        remarks: 'Includes Sarpanch counter-signatures for 14 plants.'
      },
      {
        id: 'doc-gov-01',
        documentId: 'DOC-GOV-2026-002',
        documentName: 'MEIL_Code_of_Conduct_Board_Approved_2026.pdf',
        documentCategory: 'Corporate Governance Policies',
        linkedRole: 'COMPLIANCE_USER',
        linkedEntity: 'MEIL Corporate',
        linkedModule: 'Policy Register (GOV-1)',
        linkedDataRecord: 'POL-GOV-01 Code of Business Ethics',
        reportingPeriod: 'FY 2026-27',
        documentDate: '2026-05-18',
        issuingOrganization: 'Board of Directors Secretariat',
        originalFilename: 'MEIL_Code_of_Conduct_Board_Approved_2026.pdf',
        fileType: 'PDF',
        fileSize: '1.9 MB',
        uploadedBy: 'Anand Sharma (Compliance)',
        uploadTimestamp: '2026-10-04 10:00 AM',
        reviewStatus: 'Verified & Accepted',
        versionNumber: 'v3.0',
        remarks: 'Publicly hosted on investor portal.'
      }
    ]
  }

  private getDefaultActivities(): ActivityEvent[] {
    return [
      {
        id: 'act-1',
        roleKey: 'HR_USER',
        timestamp: '15 mins ago',
        user: 'Sunil Kumar',
        action: 'Saved Draft',
        target: 'Workforce Profile (HR-1)',
        details: 'Updated gender distribution figures for permanent employees.',
        badgeTone: 'blue'
      },
      {
        id: 'act-2',
        roleKey: 'EHS_USER',
        timestamp: '1 hour ago',
        user: 'Praveen Reddy',
        action: 'Validated',
        target: 'Energy Consumption (EHS-1)',
        details: 'Checked meter readings. 0 blocking errors, 1 warning.',
        badgeTone: 'green'
      },
      {
        id: 'act-3',
        roleKey: 'PROCUREMENT_USER',
        timestamp: '3 hours ago',
        user: 'Ramesh Varma',
        action: 'Uploaded Evidence',
        target: 'Tata Steel ISO 14001 Certificate',
        details: 'Attached TÜV NORD verification certificate (2.1 MB).',
        badgeTone: 'blue'
      },
      {
        id: 'act-4',
        roleKey: 'CSR_USER',
        timestamp: 'Yesterday',
        user: 'Deepika Rao',
        action: 'Submitted',
        target: 'CSR Project Master (CSR-1)',
        details: 'Submitted Schedule VII clean drinking water records for reviewer signoff.',
        badgeTone: 'amber'
      },
      {
        id: 'act-5',
        roleKey: 'COMPLIANCE_USER',
        timestamp: 'Yesterday',
        user: 'Anand Sharma',
        action: 'Accepted',
        target: 'BRSR Policy Register (GOV-1)',
        details: 'Reviewer accepted Board policy register with zero exceptions.',
        badgeTone: 'green'
      }
    ]
  }

  private getDefaultHrData(): {
    workforceProfile: HrWorkforceProfile
    diversity: HrDiversityRepresentation
    turnover: HrHiringTurnover
    training: HrTrainingDevelopment
    reviews: HrPerformanceReviews
    benefits: HrEmployeeBenefits
    wages: HrWagesRemuneration
    grievances: HrGrievancesHumanRights
    safetyCoord: HrSafetyCoordination
  } {
    return {
      workforceProfile: {
        common: createDefaultCommonFields('HR_USER', 'Workforce Profile', 'Workforce Census', 'Total Workforce Demographics'),
        employeeCategory: 'Permanent & Fixed-term Contract',
        workerCategory: 'Permanent, Contractual & Casual Labour',
        permanentEmployees: 12450,
        permanentWorkers: 18200,
        otherEmployees: 1420,
        otherWorkers: 24650,
        maleCount: 52100,
        femaleCount: 4520,
        otherGenderCount: 100,
        workforceSourceSystem: 'SAP SuccessFactors + Biometric Site Gate Logs',
        sourceReportReference: 'HRMS-CENSUS-FY27-Q2',
        supportingEvidence: 'DOC-HR-2026-001',
        remarks: 'Aggregated across all infrastructure sites and corporate offices.'
      },
      diversity: {
        common: createDefaultCommonFields('HR_USER', 'Diversity & Representation', 'Diversity Disclosures', 'Workforce Inclusion Metrics'),
        reportingPopulation: 'All Employees & On-roll Workers',
        workforceCategory: 'Permanent Employees',
        genderCategory: 'Female' as const,
        diversityCategory: 'Differently Abled (PwD)' as const,
        totalWorkforceCount: 56720,
        countByCategory: 284,
        calculatedPercentage: 0.5,
        sourceReport: 'HR-DIVERSITY-ANNUAL-2026',
        evidence: 'DOC-HR-2026-PWD.pdf',
        remarks: 'Includes corporate headquarters and design centers.'
      },
      turnover: {
        common: createDefaultCommonFields('HR_USER', 'Hiring & Turnover', 'Attrition & Retention', 'Workforce Turnover Rate'),
        category: 'Permanent Employees',
        openingHeadcount: 12100,
        newJoiners: 1450,
        leavingCount: 1100,
        closingHeadcount: 12450,
        turnoverCalculationMethod: 'Average Headcount Formula' as const,
        turnoverPercentage: 8.96,
        sourceHrmsReport: 'HRMS-ATTRITION-FY26',
        evidence: 'DOC-HR-ATTRITION.pdf',
        remarks: 'Voluntary attrition stood at 6.8%; involuntary at 2.16%.'
      },
      training: {
        common: createDefaultCommonFields('HR_USER', 'Training & Development', 'Skill & Safety Programs', 'Annual Training Records'),
        trainingProgramme: 'Safety Leadership & Environmental Compliance in Construction',
        trainingCategory: 'Health & Safety' as const,
        targetPopulation: 'Site Engineers & Supervisors',
        classification: 'Both' as const,
        trainingDate: '2026-08-14',
        numberOfSessions: 42,
        durationHours: 168,
        participants: 2850,
        participantsCompleting: 2790,
        deliveryMethod: 'Hybrid' as const,
        trainerAgency: 'National Institute of Construction Management and Research (NICMAR)',
        attendanceRecordRef: 'TRAIN-EHS-BATCH-42',
        assessmentResult: '98% pass rate upon post-course assessment',
        supportingEvidence: 'DOC-HR-TRAINING-LOGS.xlsx',
        remarks: 'Mandatory certification before site deployment.'
      },
      reviews: {
        common: createDefaultCommonFields('HR_USER', 'Performance Reviews', 'Appraisal Tracking', 'Annual Appraisal Cycle'),
        reportingPopulation: 'All Permanent Employees (>6 months tenure)',
        category: 'Permanent Employees',
        totalEligiblePopulation: 11800,
        numberReviewed: 11620,
        reviewCompletionPercentage: 98.47,
        reviewPeriod: 'FY 2025-26 Performance Cycle',
        reviewProcessReference: 'HR-PMS-2026-CY',
        sourceHrReport: 'HRMS-PMS-SIGN-OFF.pdf',
        supportingEvidence: 'DOC-HR-APPRAISAL.pdf',
        remarks: 'Balance 180 employees on extended maternity/medical leave.'
      },
      benefits: {
        common: createDefaultCommonFields('HR_USER', 'Employee Benefits', 'Statutory & Voluntary Welfare', 'Benefits Coverage Matrix'),
        benefitCategory: 'Health Insurance' as const,
        eligiblePopulation: 12450,
        beneficiariesCount: 12450,
        classification: 'Employees' as const,
        coveragePercentage: 100,
        benefitPolicyReference: 'POL-HR-BENEFIT-004',
        supportingEvidence: 'DOC-HR-INSURANCE-SCHEME.pdf',
        remarks: 'Comprehensive group mediclaim coverage for employee and dependents.'
      },
      wages: {
        common: createDefaultCommonFields('HR_USER', 'Wages & Remuneration', 'Remuneration Equity', 'Median Remuneration Disclosures'),
        reportingPopulation: 'All Permanent Workforce',
        category: 'Non-KMP Employees',
        wageRemunerationMetric: 'Median Remuneration' as const,
        measurementPeriod: 'Annualized FY 2026-27',
        aggregateAmount: 645000,
        currencyUnit: 'INR per annum',
        calculationMethod: 'Median salary across all permanent employees',
        sourcePayrollReport: 'PAYROLL-AUDITED-ANNUAL',
        evidence: 'DOC-HR-PAYROLL-SUMMARY.pdf',
        remarks: '100% compliance with Minimum Wages Act across all states.'
      },
      grievances: {
        common: createDefaultCommonFields('HR_USER', 'Grievances & Human Rights', 'Workforce Dispute Mechanism', 'Grievance Redressal Register'),
        grievanceCategory: 'Working Conditions' as const,
        population: 'Permanent & Contract Workers',
        grievancesReceived: 48,
        grievancesResolved: 45,
        grievancesPending: 3,
        resolutionMethod: 'Works Committee & Internal Complaints Redressal',
        humanRightsCategory: 'Safe Working Environment & Accommodation',
        responsibleDepartment: 'Industrial Relations & Site Admin',
        sourceRegister: 'IR-REG-2026-Q2',
        supportingEvidence: 'DOC-HR-GRIEVANCE-LOG.xlsx',
        remarks: 'Average resolution turnaround time was 9.4 calendar days.'
      },
      safetyCoord: {
        common: createDefaultCommonFields('HR_USER', 'Occupational Well-being', 'Health Coordination', 'Workforce Well-being Program'),
        population: 'Contractual Construction Workers',
        healthSafetyTrainingSummary: 'Mandatory 4-hour toolbox induction & health screening at site entry',
        workforceWellbeingProgramme: 'Swasthya Wellness Camps & Mobile Health Checkups',
        participationCount: 18450,
        benefitsSupportProgramme: 'Accident insurance and on-site paramedic coverage',
        sourceReference: 'HR-WELLBEING-REPORT-Q2',
        supportingEvidence: 'DOC-HR-WELLBEING.pdf',
        remarks: 'Organized in partnership with local district health authorities.'
      }
    }
  }

  private getDefaultEhsData(): {
    energy: EhsEnergyConsumption
    water: EhsWaterManagement
    ghg: EhsGhgEmissions
    waste: EhsWasteManagement
    safety: EhsSafetyIncidents
    permits: EhsCompliancePermits
    incidents: EhsEnvironmentalIncidents
    initiatives: EhsSustainabilityInitiatives
  } {
    return {
      energy: {
        common: createDefaultCommonFields('EHS_USER', 'Energy Consumption', 'Resource Tracking', 'Electricity & Fuel Consumption'),
        energySource: 'Grid Electricity' as const,
        gridElectricityKwh: 14250000,
        renewableElectricityKwh: 3800000,
        fuelType: 'High Speed Diesel (HSD)',
        fuelQuantity: 840000,
        fuelUnit: 'Litres' as const,
        equipmentProcessRef: 'Captive DG Sets, Heavy Excavators & Concrete Batching Plants',
        purchasedEnergyKwh: 14250000,
        generatedEnergyKwh: 3800000,
        meterEquipmentId: 'MTR-SUBSTATION-01 & MTR-BATCH-04',
        openingMeterReading: 482000,
        closingMeterReading: 624500,
        sourceReference: 'EHS-ENERGY-LOG-MTR-01',
        supportingEvidence: 'DOC-EHS-2026-014',
        remarks: 'Renewable electricity includes on-site 2.5 MW solar rooftop at manufacturing yard.'
      },
      water: {
        common: createDefaultCommonFields('EHS_USER', 'Water Management', 'Water Withdrawal & Recycling', 'Site Water Balance'),
        waterActivity: 'Withdrawal' as const,
        waterSource: 'Groundwater' as const,
        quantity: 142500,
        unit: 'kL (Kilolitres)' as const,
        meterSourceId: 'FLOW-BOREWELL-02',
        openingReading: 89400,
        closingReading: 104200,
        recycledReusedQuantity: 42000,
        dischargeDestination: 'Effluent Treatment Plant (ETP)' as const,
        treatmentLevel: 'Tertiary / Advanced RO' as const,
        waterQualityResults: 'BOD: <10 mg/L, COD: <50 mg/L, TSS: <20 mg/L (100% compliant with CPCB limits)',
        testingLaboratory: 'SGS Environmental Testing Services (NABL Accredited)',
        testDate: '2026-09-18',
        supportingEvidence: 'DOC-EHS-WATER-LAB-REP.pdf',
        remarks: 'Recycled water fully utilized for dust suppression and curing.'
      },
      ghg: {
        common: createDefaultCommonFields('EHS_USER', 'Emissions & Air Quality', 'GHG Inventory', 'Scope 1 & Scope 2 Emissions'),
        emissionScope: 'Scope 1 (Direct)' as const,
        emissionSource: 'Stationary Combustion (DG Sets) & Mobile Fleet',
        fuelEnergyType: 'Diesel',
        activityQuantity: 840000,
        activityUnit: 'Litres',
        emissionFactorReference: 'IPCC 2006 Guidelines for National GHG Inventories (2.68 kg CO2e/Litre)',
        calculationMethod: 'Activity Data × Emission Factor',
        sourceDocument: 'SAP Fuel Procurement Ledger',
        supportingEvidence: 'DOC-EHS-GHG-INVENTORY.pdf',
        pollutantType: 'PM10 & PM2.5 Ambient Dust',
        samplingLocation: 'Site Perimeter Air Monitoring Station 1',
        testDate: '2026-09-22',
        testResult: 58.4,
        testUnit: 'µg/m³',
        testMethod: 'IS 5182 (Part 23) Gravimetric Method',
        laboratory: 'Vimta Labs Ltd.',
        applicableLimit: 100,
        complianceResult: 'Compliant' as const,
        supportingReport: 'DOC-EHS-AIR-QUALITY-Q2.pdf'
      },
      waste: {
        common: createDefaultCommonFields('EHS_USER', 'Waste Management', 'Solid & Hazardous Waste', 'Waste Generation & Disposal Summary'),
        wasteCategory: 'Construction & Demolition' as const,
        wasteSubtype: 'Concrete debris, aggregate fines and structural steel scrap',
        classification: 'Non-hazardous' as const,
        quantityGenerated: 1420,
        unit: 'Tonnes' as const,
        quantityReused: 980,
        quantityRecycled: 410,
        quantityRecovered: 0,
        quantityDisposed: 30,
        disposalMethod: 'Authorized Recycler' as const,
        wasteHandlerAgency: 'Green Earth Recycling & Disposal Pvt. Ltd. (SPCB Approved)',
        authorizationReference: 'SPCB/HAZ/AUTH/2025/892',
        transferManifestRef: 'MANIFEST-FORM10-2026-09',
        supportingEvidence: 'DOC-EHS-WASTE-MANIFESTS.pdf',
        remarks: 'Crushed concrete reused as road sub-base material.'
      },
      safety: {
        common: createDefaultCommonFields('EHS_USER', 'Health & Safety Incidents', 'Occupational Safety', 'Safety Incident Register'),
        incidentId: 'INC-2026-EHS-004',
        incidentDateTime: '2026-07-12 14:30',
        locationWorkArea: 'Girder Launching Section, Pier 18',
        incidentType: 'Near Miss' as const,
        employeeWorkerCategory: 'Contract Worker' as const,
        incidentDescription: 'Rigging sling tension imbalance during pre-lift check. Slung load lowered immediately safely.',
        severityClassification: 'Medium' as const,
        lostWorkdays: 0,
        fatalityCount: 0,
        permanentDisabilityInfo: 'None',
        personHoursWorked: 2840000,
        immediateAction: 'Work paused, certified third-party crane inspector called, sling replaced.',
        rootCause: 'Wear and tear on secondary wire-rope thimble.',
        correctivePreventiveAction: 'Introduced daily pre-use rigging inspection tag system.',
        responsibleOwner: 'K. Mohan (Chief Safety Officer)',
        dueDate: '2026-07-20',
        closureDate: '2026-07-18',
        supportingEvidence: 'DOC-EHS-INCIDENT-INVESTIGATION.pdf'
      },
      permits: {
        common: createDefaultCommonFields('EHS_USER', 'Compliance & Permits', 'Statutory Approvals', 'Environmental Clearance & CTO Register'),
        permitType: 'Consent to Operate (CTO)' as const,
        permitNumber: 'APPCB/VJA/CTO/2024-512',
        issuingAuthority: 'SPCB / CPCB' as const,
        applicableActivity: 'Hot Mix Plant & Concrete Batching Operations',
        issueDate: '2024-11-01',
        expiryDate: '2027-10-31',
        renewalStatus: 'Valid' as const,
        inspectionDate: '2026-06-15',
        inspectionFindings: 'Satisfactory compliance with all 14 specific conditions and 12 general conditions.',
        nonComplianceReference: 'None',
        correctiveAction: 'Continued quarterly emission monitoring reporting.',
        responsibleOwner: 'Praveen Reddy',
        dueDate: '2026-12-31',
        closureDate: '2026-06-20',
        supportingEvidence: 'DOC-EHS-CTO-RENEWAL.pdf'
      },
      incidents: {
        common: createDefaultCommonFields('EHS_USER', 'Environmental Incidents', 'Spills & Containment', 'Environmental Spill Log'),
        incidentId: 'ENV-2026-001',
        incidentDate: '2026-05-20',
        incidentCategory: 'Chemical Spill' as const,
        environmentalMedium: 'Soil' as const,
        location: 'Batching Plant Chemical Admixture Storage Area',
        description: 'Minor leakage of 15 litres of PCE water-reducing admixture from a damaged valve.',
        severityImpact: 'Minor containment' as const,
        immediateResponse: 'Spill kit sand deployment and containment dyke shutoff. No groundwater contamination.',
        correctiveAction: 'Secondary containment bund capacity increased to 110% of drum volume.',
        reportingNotificationRef: 'EHS-SITE-NOTE-12',
        currentStatus: 'Contained & Closed' as const,
        closureEvidence: 'DOC-EHS-SPILL-REPORT.pdf',
        supportingDocuments: 'DOC-EHS-SPILL-REPORT.pdf'
      },
      initiatives: {
        common: createDefaultCommonFields('EHS_USER', 'Sustainability Initiatives', 'Decarbonization Programs', 'Green Construction Initiatives'),
        initiativeName: 'Solar Hybridization of Site Camps and Offices',
        initiativeCategory: 'Renewable Transition' as const,
        baselinePeriod: 'FY 2024-25',
        baselineValue: 450000,
        reportingPeriodValue: 120000,
        measurementUnit: 'Litres of Diesel consumed',
        targetValue: 100000,
        actualResult: 330000,
        calculationMethod: 'Avoided diesel liters through solar rooftop microgrids',
        responsibleOwner: 'V. Krishna (Sustainability Lead)',
        supportingEvidence: 'DOC-EHS-SOLAR-SAVINGS.pdf',
        remarks: 'Reduced 884 tonnes of CO2e annually across 4 site camps.'
      }
    }
  }

  private getDefaultScData(): {
    supplierMaster: ScSupplierMaster
    spend: ScProcurementSpend
    assessment: ScSupplierEsgAssessment
    certifications: ScSupplierCertifications
    codeOfConduct: ScSupplierCodeOfConduct
    audits: ScSupplierAudits
    valueChain: ScValueChainData
  } {
    return {
      supplierMaster: {
        common: createDefaultCommonFields('PROCUREMENT_USER', 'Supplier Master', 'Vendor Registry', 'Tier-1 Critical Vendor Master'),
        supplierId: 'SUP-MEIL-001',
        supplierName: 'Tata Steel Limited',
        supplierType: 'Tier 1' as const,
        supplierCategory: 'Large Enterprise' as const,
        domesticInternational: 'Domestic (India)' as const,
        countryState: 'Jharkhand, India',
        businessUnit: 'Transportation & Infrastructure BU',
        activeStatus: 'Active' as const,
        supplierContactRef: 'contact.esg@tatasteel.com',
        supplierMasterSource: 'SAP S/4HANA Vendor Master #100482',
        supportingEvidence: 'DOC-SC-2026-008',
        remarks: 'Critical structural steel supplier for long-span bridges.'
      },
      spend: {
        common: createDefaultCommonFields('PROCUREMENT_USER', 'Procurement Spend', 'Spend Analysis', 'Strategic Procurement Spend Reference'),
        supplierId: 'SUP-MEIL-001',
        procurementCategory: 'Raw Materials (Steel/Cement)' as const,
        procurementAmount: 482.5,
        currency: 'INR (₹)' as const,
        purchaseContractRef: 'PO-MEIL-STL-2026-08',
        sourceLedgerErpRef: 'SAP MM Purchase Order #45008912',
        entityBu: 'Transportation BU',
        supportingDocument: 'DOC-SC-PO-TATA.pdf',
        remarks: 'Linked to verified finance expenditure ledger.'
      },
      assessment: {
        common: createDefaultCommonFields('PROCUREMENT_USER', 'Supplier ESG Assessment', 'Vendor Due Diligence', 'Annual Supplier ESG Evaluation'),
        supplierId: 'SUP-MEIL-001',
        assessmentDate: '2026-08-25',
        assessmentType: 'On-site Desktop Audit' as const,
        environmentalCriteriaScore: 92,
        labourSocialCriteriaScore: 88,
        healthSafetyCriteriaScore: 94,
        humanRightsCriteriaScore: 90,
        governanceEthicsCriteriaScore: 96,
        assessmentResult: 'High ESG Compliance' as const,
        riskClassification: 'Low Risk' as const,
        findings: 'World-class decarbonization roadmap (CCUS and scrap recycling in blast furnace).',
        correctiveAction: 'Request quarterly water recycling progress updates.',
        responsibleOwner: 'Ramesh Varma',
        targetClosureDate: '2026-11-30',
        assessmentReport: 'DOC-SC-ESG-AUDIT-TATA.pdf',
        remarks: 'Overall ESG Composite Score: 92/100.'
      },
      certifications: {
        common: createDefaultCommonFields('PROCUREMENT_USER', 'Certifications', 'Vendor Standards', 'ISO & Green Standards Verification'),
        supplierId: 'SUP-MEIL-001',
        certificationName: 'ISO 14001 (Environment)' as const,
        certificationNumber: 'TUV-04-104-2018-092',
        issuingOrganization: 'TÜV NORD Cert GmbH',
        issueDate: '2022-06-01',
        expiryDate: '2028-05-30',
        certificationScope: 'Manufacturing and supply of hot rolled coils, plates and structural shapes',
        verificationStatus: 'Verified Valid' as const,
        certificateDocument: 'DOC-SC-2026-008',
        remarks: 'GreenPro eco-label certified rebar.'
      },
      codeOfConduct: {
        common: createDefaultCommonFields('PROCUREMENT_USER', 'Code of Conduct', 'Vendor Governance', 'Supplier Code of Conduct Acknowledgment'),
        supplierId: 'SUP-MEIL-001',
        applicableCodePolicy: 'MEIL Supplier Code of Conduct (v3.0)',
        codeVersion: 'v3.0 (2026)',
        communicationDate: '2026-04-10',
        acceptanceStatus: 'Formally Accepted & Signed' as const,
        acceptanceDate: '2026-04-28',
        acknowledgmentReference: 'SIGN-COC-SUP-001-2026',
        supportingEvidence: 'DOC-SC-COC-SIGN.pdf',
        remarks: 'Covers child labour, modern slavery, fair wages and anti-corruption.'
      },
      audits: {
        common: createDefaultCommonFields('PROCUREMENT_USER', 'Supplier Audits', 'Audit & Inspection', 'On-site Sustainability Inspection'),
        supplierId: 'SUP-MEIL-001',
        auditDate: '2026-07-15',
        auditType: 'Periodic Sustainability Audit' as const,
        findings: 'Zero critical findings. Minor observation on packaging plastic recycling documentation.',
        riskLevel: 'Low' as const,
        correctiveAction: 'Submit post-consumer plastic recycling manifest.',
        responsibleParty: 'Supplier Quality Assurance Team',
        dueDate: '2026-09-30',
        closureStatus: 'Closed' as const,
        closureDate: '2026-09-22',
        evidence: 'DOC-SC-AUDIT-CLOSURE.pdf',
        remarks: 'Follow-up scheduled for Q1 FY28.'
      },
      valueChain: {
        common: createDefaultCommonFields('PROCUREMENT_USER', 'Value-Chain Data', 'Scope 3 Upstream', 'Value Chain Environmental Disclosure'),
        valueChainPartnerId: 'SUP-MEIL-001',
        partnerType: 'Upstream Supplier' as const,
        reportingBoundary: 'BRSR Core Scope' as const,
        esgMetric: 'Product Carbon Footprint (PCF) for Structural Steel',
        activityQuantityOrValue: 2.15,
        unit: 'tCO2e / Tonne of Steel',
        sourceMethod: 'Supplier Reported Activity' as const,
        supportingEvidence: 'DOC-SC-EPD-TATA.pdf',
        dataQualityStatus: 'Primary Audited' as const,
        remarks: 'Verified via Environmental Product Declaration (EPD) registered under EPD International.'
      }
    }
  }

  private getDefaultCsrData(): {
    projectMaster: CsrProjectMaster
    activities: CsrActivitiesBeneficiaries
    expenditure: CsrExpenditureReferences
    outcomes: CsrProjectOutcomes
    grievances: CsrCommunityGrievances
    sia: CsrSocialImpactAssessment
    rr: CsrRehabilitationResettlement
  } {
    return {
      projectMaster: {
        common: createDefaultCommonFields('CSR_USER', 'CSR Project Master', 'Community Programs', 'Schedule VII CSR Project Portfolio'),
        csrProjectId: 'PRJ-CSR-2026-01',
        projectName: 'Jala Jeevanam: Safe Drinking Water & RO Plants Across Highway Corridors',
        programmeCategory: 'Safe Drinking Water' as const,
        implementingAgency: 'MEIL Foundation (Reg. Charitable Trust #142/2012)',
        projectLocation: 'Krishna & Guntur Districts',
        stateDistrict: 'Andhra Pradesh, India',
        startDate: '2025-04-01',
        plannedCompletionDate: '2027-03-31',
        actualCompletionDate: 'Ongoing Phase 2',
        projectStatus: 'Active Implementation' as const,
        targetBeneficiaries: 125000,
        approvalReference: 'CSR-BOARD-RES-2025/ITEM-04',
        supportingDocuments: 'DOC-CSR-PROJECT-CHARTER.pdf',
        remarks: '24 containerized automated water purification units commissioned.'
      },
      activities: {
        common: createDefaultCommonFields('CSR_USER', 'Activities & Beneficiaries', 'Direct Engagement', 'RO Water Distribution & Community Beneficiaries'),
        csrProjectId: 'PRJ-CSR-2026-01',
        activityName: 'Community Water Dispensation & Health Checkups',
        activityCategory: 'Healthcare & Preventive Health',
        plannedBeneficiaries: 125000,
        actualBeneficiaries: 118400,
        beneficiaryClassification: 'Local Villagers / Farmers' as const,
        numberOfSessions: 180,
        activityLocation: '24 Grama Panchayats along West Bypass corridor',
        deliveryDate: '2026-09-30',
        implementationPartner: 'District Rural Development Authority (DRDA)',
        attendanceEvidence: 'DOC-CSR-2026-003',
        remarks: 'Smart smart-card dispensing logged over 4.2 million litres of clean water in H1.'
      },
      expenditure: {
        common: createDefaultCommonFields('CSR_USER', 'CSR Expenditure', 'Financial References', 'CSR Fund Disbursement Register'),
        csrProjectId: 'PRJ-CSR-2026-01',
        approvedBudgetReference: 'CSR-BUDGET-2026-AP-01 (₹ 18.50 Cr)',
        actualExpenditureReference: 'SAP-VOUCHER-CSR-99124 (₹ 11.25 Cr)',
        expenditureAmountCr: 11.25,
        ledgerPaymentRef: 'GL Account #480200 (CSR Social Spend)',
        implementingAgency: 'MEIL Foundation',
        expenditureCategory: 'Direct Project Spend' as const,
        financialReconciliationStatus: 'Reconciled with Finance' as const,
        supportingEvidence: 'DOC-CSR-FIN-RECON.pdf',
        remarks: 'Approved by statutory CSR Auditor and reconciled with audited balance sheet.'
      },
      outcomes: {
        common: createDefaultCommonFields('CSR_USER', 'Project Outcomes', 'Impact Metrics', 'Public Health Impact Measurement'),
        csrProjectId: 'PRJ-CSR-2026-01',
        outcomeImpactIndicator: 'Incidence of Fluorosis and Waterborne Gastrointestinal Diseases',
        baselineValue: 24.2,
        targetValue: 8.0,
        actualValue: 6.8,
        measurementUnit: 'Incidents per 1,000 households annually',
        measurementPeriod: 'Annualized survey FY 2026-27',
        dataCollectionMethod: 'Government Health Center Records' as const,
        evaluationMethod: 'Third-party Social Audit' as const,
        supportingStudyReport: 'DOC-CSR-HEALTH-SURVEY.pdf',
        resultStatus: 'Target Exceeded' as const,
        remarks: 'Over 71% drop in waterborne diseases verified by District Medical Officer.'
      },
      grievances: {
        common: createDefaultCommonFields('CSR_USER', 'Community Grievances', 'Stakeholder Engagement', 'Local Community Grievance Redressal'),
        grievanceId: 'CSR-GRV-2026-003',
        dateReceived: '2026-08-04',
        category: 'Water Supply Interruption',
        affectedCommunityLocation: 'Tadepalli Village (RO Plant #11)',
        description: 'Temporary water dispenser pump shutdown due to local power transformer surge.',
        responsibleDepartment: 'MEIL Foundation Maintenance Crew',
        actionTaken: 'Installed automatic voltage stabilizer and back-up solar inverter unit within 48 hours.',
        resolutionStatus: 'Resolved' as const,
        resolutionDate: '2026-08-06',
        supportingEvidence: 'DOC-CSR-GRIEVANCE-CLOSURE.pdf',
        remarks: 'Gram Panchayat Sarpanch signed confirmation receipt.'
      },
      sia: {
        common: createDefaultCommonFields('CSR_USER', 'Social Impact Assessment', 'Statutory Evaluation', 'Independent Social Impact Assessment'),
        projectReference: 'PRJ-CSR-2026-01',
        siaApplicability: 'Mandatory (Project >= ₹1 Cr + Completed 1 Yr)' as const,
        assessmentAgency: 'Tata Institute of Social Sciences (TISS) Project Advisory Unit',
        assessmentDate: '2026-06-25',
        notificationRefNumber: 'TISS-SIA-AP-MEIL-2026',
        assessmentFindings: 'High Social Return on Investment (SROI) calculated at 4.2x capital deployed.',
        publicDisclosureStatus: 'Published on Company Website' as const,
        publicReportUrl: 'https://meil.in/sustainability/csr-reports/sia-2026',
        supportingReport: 'DOC-CSR-TISS-SIA-REPORT.pdf',
        correctiveAction: 'Recommended expansion of automated water testing telemetry.',
        remarks: 'Presented to CSR Committee of the Board on 2026-07-28.'
      },
      rr: {
        common: createDefaultCommonFields('CSR_USER', 'Rehabilitation & Resettlement', 'Land & Community Support', 'R&R Compliance Tracking'),
        projectReference: 'Vijayawada Western Bypass Phase 2',
        stateDistrict: 'Andhra Pradesh, India',
        pafsIdentified: 84,
        pafsCoveredByRandR: 84,
        compensationSupportReference: 'GO-MS-184-REVENUE-DEPT',
        paymentEvidenceReference: 'BANK-RTGS-TREASURY-REF-8841',
        status: 'All Compensation Disbursed' as const,
        supportingDocuments: 'DOC-CSR-RR-COMPLETION.pdf',
        remarks: 'All 84 PAFs provided alternative housing plots and livelihood training.'
      }
    }
  }

  private getDefaultGovData(): {
    policies: GovPolicyRegister
    implementation: GovPolicyImplementation
    ethics: GovBusinessEthics
    whistleblower: GovWhistleblowerGrievances
    compliance: GovRegulatoryCompliance
    humanRights: GovHumanRights
    oversight: GovGovernanceOversight
  } {
    return {
      policies: {
        common: createDefaultCommonFields('COMPLIANCE_USER', 'Policy Register', 'Governance Master', 'BRSR Corporate Policy Register'),
        policyId: 'POL-BRSR-001',
        policyName: 'MEIL Code of Business Conduct, Ethics & Transparency',
        policyCategory: 'Business Conduct & Ethics' as const,
        policyVersion: 'v3.2 (2026)',
        policyOwner: 'Company Secretary & Chief Compliance Officer',
        approvalAuthority: 'Board of Directors' as const,
        approvalDate: '2026-05-18',
        effectiveDate: '2026-06-01',
        lastReviewDate: '2026-05-18',
        nextReviewDate: '2027-05-18',
        applicability: 'All Group Entities & Operations' as const,
        isPubliclyAvailable: 'Yes' as const,
        publicUrl: 'https://meil.in/governance/policies/code-of-conduct',
        policyDocument: 'DOC-GOV-2026-002',
        remarks: 'Covers anti-bribery, conflict of interest, fair competition and stakeholder dignity.'
      },
      implementation: {
        common: createDefaultCommonFields('COMPLIANCE_USER', 'Policy Implementation', 'Rollout & Coverage', 'Policy Implementation Tracking'),
        policyId: 'POL-BRSR-001',
        implementationStatus: 'Fully Implemented' as const,
        applicableEntities: 'MEIL Corporate and All 12 Operating Business Units',
        communicationDate: '2026-06-05',
        coveragePercentage: 100,
        trainingAwarenessRef: 'COMP-LMS-MODULE-01',
        reviewMethod: 'Secretarial Audit' as const,
        reviewFindings: '100% executive sign-off achieved via corporate intranet portal.',
        correctiveAction: 'Continued bi-monthly compliance refresher tests for new joiners.',
        responsibleOwner: 'Anand Sharma',
        dueDate: '2026-12-31',
        supportingEvidence: 'DOC-GOV-LMS-SIGNOFFS.xlsx',
        remarks: 'Integrated into employee onboarding pack.'
      },
      ethics: {
        common: createDefaultCommonFields('COMPLIANCE_USER', 'Business Ethics & Anti-Corruption', 'Integrity Programs', 'Anti-Bribery & Corruption Monitoring'),
        disclosureCategory: 'Anti-Corruption Training' as const,
        trainingActivity: 'Anti-Bribery & Foreign Corrupt Practices Act (FCPA) / Prevention of Corruption Act Compliance',
        applicablePopulation: 'Directors & KMPs' as const,
        participationCount: 420,
        complaintCategory: 'Zero Tolerance Disciplinary Inquiries',
        countReceived: 0,
        countResolved: 0,
        countPending: 0,
        sourceRegister: 'AUDIT-COMM-INTEGRITY-LOG',
        supportingEvidence: 'DOC-GOV-ETHICS-DECLARATION.pdf',
        remarks: 'Zero corruption or bribery complaints received or pending during reporting year.'
      },
      whistleblower: {
        common: createDefaultCommonFields('COMPLIANCE_USER', 'Whistleblower & Grievances', 'Vigil Mechanism', 'Whistleblower & Vigil Mechanism Register'),
        grievanceReference: 'WB-2026-002',
        grievanceCategory: 'Harassment / Discrimination' as const,
        dateReceived: '2026-08-11',
        stakeholderCategory: 'Employee' as const,
        countReceived: 3,
        countResolved: 2,
        countPending: 1,
        resolutionStatus: 'Resolved & Closed' as const,
        sourceRegister: 'OMBUDSPERSON-CONFIDENTIAL-REG',
        evidenceReference: 'DOC-GOV-VIGIL-REPORT.pdf',
        remarks: 'Investigated by independent Internal Committee under chairperson supervision.'
      },
      compliance: {
        common: createDefaultCommonFields('COMPLIANCE_USER', 'Regulatory Compliance', 'Legal Notices', 'Statutory Notices & Show-Cause Register'),
        complianceNoticeId: 'SCN-APPCB-2026-01',
        regulationRequirement: 'Water (Prevention and Control of Pollution) Act 1974',
        issuingAuthority: 'Pollution Control Board' as const,
        noticeDate: '2026-04-18',
        entityBu: 'Vijayawada Western Bypass Site',
        description: 'Show-cause query regarding dust barrier height during high-wind period in April.',
        allegedNonCompliance: 'Dust screen height measured at 2.8m instead of 3.0m requirement.',
        hasFinancialPenalty: 'No' as const,
        amountAndCurrency: 'Nil',
        currentStatus: 'Case Disposed Off' as const,
        correctiveAction: 'Screen elevated to 3.5m across full 1.2km frontage; APPCB inspected and closed notice on May 2.',
        responsibleOwner: 'S. Nageswara Rao (Legal Counsel)',
        dueDate: '2026-05-15',
        resolutionDate: '2026-05-02',
        supportingDocuments: 'DOC-GOV-APPCB-DISPOSAL.pdf',
        remarks: 'No financial penalty or adverse finding recorded.'
      },
      humanRights: {
        common: createDefaultCommonFields('COMPLIANCE_USER', 'Human Rights', 'Due Diligence', 'Workplace Human Rights Audit'),
        policyDisclosureCategory: 'Child Labour Due Diligence' as const,
        applicableEntity: 'All Projects and Subcontractors',
        dueDiligenceActivity: 'Aadhaar / Government ID Age Verification at Site Entry Turnstiles',
        issuesIdentified: 'Zero child labour or forced labour incidents identified.',
        complaintsReceived: 0,
        correctiveActions: 'Quarterly surprise vigilance audits conducted across 18 labour camps.',
        resolutionStatus: 'No Violations Identified' as const,
        sourceRegister: 'HR-VIGIL-LABOUR-AUDIT',
        supportingEvidence: 'DOC-GOV-HUMAN-RIGHTS-AUDIT.pdf',
        remarks: '100% adherence to ILO Core Labour Conventions.'
      },
      oversight: {
        common: createDefaultCommonFields('COMPLIANCE_USER', 'Governance Oversight', 'Board Committee Oversight', 'Board ESG Oversight & Materiality Review'),
        governanceTopic: 'BRSR Reporting Oversight',
        responsibleAuthority: 'ESG & Sustainability Committee of Board' as const,
        assignedReportingOwner: 'Chief Sustainability Officer & Company Secretary',
        approvalReviewDate: '2026-08-30',
        reviewFrequency: 'Quarterly' as const,
        meetingResolutionRef: 'ESG-COMM-MINUTES-ITEM-02',
        applicableEntity: 'MEIL Enterprise Wide',
        evidenceDocument: 'DOC-GOV-BOARD-MINUTES.pdf',
        remarks: 'Reviewed and approved assurance scope for FY 2026-27 BRSR Core metrics.'
      }
    }
  }
}

export const contributorStore = new ContributorStore()
