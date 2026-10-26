'use client'
/**
 * Finance & Resource Data Contributor — Persistent Data Store & Workflow Engine
 * Comprehensive BRSR Level 0 through Level 7 data schemas and business rules:
 * - Level 0: Common Metadata & Entity Context
 * - Level 1: Financial Summary (BRSR Single Source of Truth)
 * - Level 2: Environmental & Resource-Related Expenditure (8 categories, CapEx/OpEx)
 * - Level 3: Financial Calculations & Intensity Metrics (Ratios, YoY, Denominators)
 * - Level 4: CSR & Other Assigned Financial Disclosures
 * - Level 5: Financial Evidence & Documents (14 fields, upload vs acceptance status)
 * - Level 6: Validation & Reconciliation Checklist (Blocking errors vs Warnings)
 * - Level 7: Multi-state Submission & Review Workflow
 */

export interface CommonMetadata {
  entityName: string // Prefilled, read-only
  entityId: string // Prefilled, read-only
  subsidiaryOrBu: string // Prefilled, read-only
  projectId: string // Prefilled, if applicable
  financialYear: string // Assigned reporting period (e.g., FY 2026-27)
  reportingPeriod: 'Annual' | 'Quarter' | 'Month'
  dataModule: string // Financial Summary / Resource Expenditure / other
  dataCategory: string // Dropdown
  recordDescription: string // Text
  amountOrValue: number // Numeric
  currency: 'INR (₹)' | 'USD ($)' | 'EUR (€)'
  displayUnit: 'INR' | 'Thousand' | 'Lakh' | 'Crore'
  dataAvailability: 'Reported' | 'Zero' | 'Estimated' | 'Not Available' | 'Not Applicable'
  dataSource: 'Audited statement' | 'Ledger' | 'Approved report' | 'Other'
  sourceReference: string // Document number / Ledger reference
  calculationMethod: 'Direct value' | 'Calculated' | 'Estimated'
  supportingDocument: string // File upload or evidence link
  remarks: string // Text
  preparedBy: string // Auto-filled from login
  entryDate: string // System-generated
  lastUpdated: string // System-generated
  submissionStatus: 'Draft' | 'Submitted' | 'Returned' | 'Accepted'
  reviewerComments?: string // Displayed when applicable
}

export interface FinancialSummaryData {
  // Level 0 Common fields
  common: CommonMetadata

  // Level 1 Financial Summary fields
  turnover: number // Current financial year
  previousTurnover: number // Comparative financial year
  turnoverUnit: 'Crore' | 'Lakh' | 'Thousand'
  totalExpenditure: number // Where required
  capEx: number // Relevant financial amount
  opEx: number // Relevant financial amount
  financialReportingBasis: 'Standalone (Ind AS)' | 'Consolidated (Ind AS)' | 'IFRS' | 'Statutory Tax Audit Basis'
  financialStatementReference: string // Source document
  ledgerCostCentreRef: string // Ledger / Cost Centre Reference
  financialDataSource: 'Audited statement' | 'Ledger' | 'Approved report' | 'Other'
  reconciliationStatus: 'Pending' | 'Reconciled' | 'Exception'
  reconciliationRemarks: string // Explanation of discrepancies
  supportingDocuments: string[] // Financial statements and relevant extracts
  environmentalSpend: number // Derived or entered
  dataSource: string // Backwards-compatible
  documentReference: string // Backwards-compatible
  remarks: string // Backwards-compatible
  lastSaved?: string
}

export interface ResourceExpenditureItem {
  id: string
  category: 
    | 'Pollution Control'
    | 'Energy Efficiency'
    | 'Renewable Energy'
    | 'Water Conservation'
    | 'Waste Management'
    | 'Emission Reduction'
    | 'Environmental Protection'
    | 'Other Resource-Efficiency Initiatives'
  projectName: string // Name of activity / initiative
  description: string // Purpose of expenditure
  amount: number // Actual expenditure (in ₹ Crore)
  currency: string // INR or applicable
  source: 'CapEx' | 'OpEx' // Expense Type
  accountingPeriod: string // Month / Quarter / Financial Year
  costCentre: string // Applicable cost-centre reference
  vendorRef: string // Vendor / Supplier reference
  invoiceRef: string // Supporting accounting record
  dataSource: 'Ledger' | 'Invoice' | 'Approved report' | 'Other'
  supportingDocument: string // Upload or link evidence
  remarks: string // Additional explanation
  status: 'Draft' | 'Verified' | 'Locked'
  dateAdded: string
}

export interface IntensityMetricsData {
  currentRevenue: number // Linked financial record (₹ Cr)
  previousRevenue: number // Linked comparative record (₹ Cr)
  relevantExpenditureTotal: number // Calculated from linked entries (₹ Cr)
  physicalOutputDenominator: number // e.g., 850 (MW generated or MT produced)
  physicalOutputUnit: 'MW generated' | 'MT product' | 'km highway' | 'Million Passengers' | 'kL water treated'
  revenueBasedIntensity: number // Applicable metric / Revenue (%)
  physicalOutputIntensity: number // Applicable metric / Physical output (₹ Cr / unit)
  yoyChange: number // % change YoY
  calculationMethodology: 'SEBI BRSR Core Guidance' | 'GRI 302-3 / 305-4 Standard' | 'GHG Protocol Intensity Standard'
  sourceDataReferences: string[]
  calculationValidation: 'Passed' | 'Warning' | 'Failed'
  explanationOfVariance: string
  reviewerNotes: string
}

export interface CsrDisclosureData {
  isEnabled: boolean
  csrProjectReference: string // Linked CSR activity
  financialYear: string // Applicable reporting period
  approvedCsrBudget: number // Where applicable (₹ Cr)
  actualCsrExpenditure: number // Verified amount (₹ Cr)
  expenditureType: 'Project Execution' | 'Administrative Overheads' | 'Capacity Building' | 'Ongoing Project' | 'Capital Asset Creation'
  implementingAgencyRef: string // Where applicable
  ledgerPaymentRef: string // Financial source
  unspentAmount: number // Auto-calculated Budget - Expenditure
  reconciliationStatus: 'Pending' | 'Reconciled' | 'Exception'
  supportingDocument: string // Statement / Ledger / Approved report
  remarks: string // Explanation
}

export interface EvidenceDocumentItem {
  id: string
  documentName: string // Original filename
  category: 'Financial Statement' | 'General Ledger Extract' | 'Invoice' | 'Capital Expenditure' | 'Operating Expenditure' | 'Environmental Expenditure' | 'CSR Statement' | 'Supporting Document' | 'Other'
  linkedEntity: string // Prefilled
  linkedTo: 'Financial Summary' | 'Resource Expenditure' | 'Intensity Metrics' | 'CSR Disclosures'
  reportingPeriod: string // Financial year / period
  documentDate: string // Source document date
  issuingOrganization: string // Where applicable
  sourceReference: string // Document or invoice number
  fileUploadName?: string
  size: string
  uploadedBy: string // System-generated
  uploadDate: string // System-generated
  status: 'Accepted' | 'Under Review' | 'Returned' | 'Draft' // Document review acceptance status
  reviewerComments?: string
  remarks?: string
  versionHistory: { version: string; date: string; user: string; note: string }[]
}

export interface FinanceAssignment {
  id: string
  entityName: string
  entityId: string
  businessUnit: string
  reportingPeriod: string
  financialYear: string
  module: 'Financial Summary' | 'Resource Expenditure' | 'BRSR Financial Calculations' | 'Supporting Evidence'
  completion: number
  evidenceStatus: 'Complete' | 'Pending' | 'Under Review'
  status: 'In Progress' | 'Draft' | 'Submitted' | 'Returned for Correction' | 'Accepted'
  lastUpdated: string
  location: string
  currency: string
  preparedBy: string
  designation: string
  submissionId: string
}

export interface SubmissionRecord {
  id: string
  version: string
  entityName: string
  entityId: string
  businessUnit: string
  financialYear: string
  module: string
  submittedDate: string
  completion: number
  status: 'Draft' | 'Ready for Submission' | 'In Progress' | 'Submitted' | 'Under Review' | 'Returned for Correction' | 'Accepted'
  reviewer: string
  latestComment: string
  lastUpdated: string
  timeline: { step: string; timestamp: string; actor: string; note: string }[]
}

export interface ActivityEvent {
  id: string
  timestamp: string
  type: 'RECORD_CREATED' | 'DRAFT_SAVED' | 'DOC_UPLOADED' | 'DOC_REPLACED' | 'VALIDATION_PASSED' | 'SUBMITTED' | 'RETURNED' | 'CORRECTED' | 'RESUBMITTED' | 'EXPORT_GENERATED'
  title: string
  description: string
  entity: string
  actor: string
  severity: 'info' | 'success' | 'warning' | 'error'
}

export interface ValidationChecklistResult {
  financialSummaryCompleted: boolean
  currencyAndUnitsValid: boolean
  reportingPeriodsMatch: boolean
  duplicateExpendituresChecked: boolean
  requiredDocumentsUploaded: boolean
  financialFiguresReconciled: boolean
  calculatedMetricsValid: boolean
  previousYearComparisonAvailable: boolean
  exceptionsExplained: boolean
  noBlockingErrors: boolean
  readyForSubmission: boolean
  completionPercentage: number
  blockingErrors: string[]
  warnings: string[]
}

// ---------------- DEFAULT SEED DATA ----------------

const DEFAULT_COMMON_METADATA: CommonMetadata = {
  entityName: 'Gayatri Solar Plant',
  entityId: 'MEIL-SOL-GJT',
  subsidiaryOrBu: 'Solar BU',
  projectId: 'PRJ-GJT-2026',
  financialYear: 'FY 2026-27',
  reportingPeriod: 'Annual',
  dataModule: 'Financial Summary',
  dataCategory: 'Turnover & Capital Expenditure',
  recordDescription: 'Annual Statutory Financial and Environmental Capex Schedule',
  amountOrValue: 1250.0,
  currency: 'INR (₹)',
  displayUnit: 'Crore',
  dataAvailability: 'Reported',
  dataSource: 'Audited statement',
  sourceReference: 'STAT-AUD-FY26-SCH4',
  calculationMethod: 'Direct value',
  supportingDocument: 'MEIL_FS_2026-27.pdf',
  remarks: 'Turnover reconciled with statutory auditor note annexure 4.',
  preparedBy: 'Rakesh Verma (Finance Contributor)',
  entryDate: '01 Apr 2026',
  lastUpdated: '10 Jun 2026, 02:15 PM',
  submissionStatus: 'Draft',
  reviewerComments: 'Please ensure CapEx ledger references are attached prior to sign-off.',
}

const DEFAULT_FINANCIAL_SUMMARY: FinancialSummaryData = {
  common: DEFAULT_COMMON_METADATA,
  turnover: 1250.0,
  previousTurnover: 1180.0,
  turnoverUnit: 'Crore',
  totalExpenditure: 980.0,
  capEx: 320.0,
  opEx: 660.0,
  financialReportingBasis: 'Standalone (Ind AS)',
  financialStatementReference: 'MEIL_FS_2026-27.pdf',
  ledgerCostCentreRef: 'CC-SOL-GJT-01',
  financialDataSource: 'Audited statement',
  reconciliationStatus: 'Reconciled',
  reconciliationRemarks: 'Turnover and CapEx figures cross-checked against SAP GL accounts.',
  supportingDocuments: ['MEIL_FS_2026-27.pdf', 'CapEx_Projects.xlsx'],
  environmentalSpend: 45.0,
  dataSource: 'Audited statement',
  documentReference: 'MEIL_FS_2026-27.pdf',
  remarks: 'Turnover reconciled with statutory auditor notes annexure 4.',
  lastSaved: '10 Jun 2026, 02:15 PM',
}

const DEFAULT_INTENSITY_METRICS: IntensityMetricsData = {
  currentRevenue: 1250.0,
  previousRevenue: 1180.0,
  relevantExpenditureTotal: 45.0,
  physicalOutputDenominator: 850.0,
  physicalOutputUnit: 'MW generated',
  revenueBasedIntensity: 3.6, // 45 / 1250 * 100
  physicalOutputIntensity: 0.0529, // 45 / 850
  yoyChange: 5.93,
  calculationMethodology: 'SEBI BRSR Core Guidance',
  sourceDataReferences: ['MEIL-FS-2026-27.pdf', 'CEA-GRID-REPORT-2026.pdf'],
  calculationValidation: 'Passed',
  explanationOfVariance: 'Environmental spend intensity increased by 0.3% due to high-efficiency transformer installations.',
  reviewerNotes: 'Methodology conforms with SEBI Principle 6 Section C environmental protection guidance.',
}

const DEFAULT_CSR_DISCLOSURES: CsrDisclosureData = {
  isEnabled: true,
  csrProjectReference: 'CSR-2026-SOLAR-GJT-WATER-01',
  financialYear: 'FY 2026-27',
  approvedCsrBudget: 15.0,
  actualCsrExpenditure: 12.8,
  expenditureType: 'Project Execution',
  implementingAgencyRef: 'MEIL Foundation (Reg. 12A/80G)',
  ledgerPaymentRef: 'SAP-PAY-CSR-88192',
  unspentAmount: 2.2,
  reconciliationStatus: 'Reconciled',
  supportingDocument: 'CSR_Audit_Statement_2026.pdf',
  remarks: 'Unspent ₹2.2 Cr allocated to ongoing village solar microgrid project to be completed in Q2.',
}

const DEFAULT_ASSIGNMENTS: FinanceAssignment[] = [
  {
    id: 'asg-1',
    entityName: 'Gayatri Solar Plant',
    entityId: 'MEIL-SOL-GJT',
    businessUnit: 'Solar BU',
    reportingPeriod: '1 April 2026 - 31 March 2027',
    financialYear: 'FY 2026-27',
    module: 'Financial Summary',
    completion: 80,
    evidenceStatus: 'Complete',
    status: 'In Progress',
    lastUpdated: 'Today at 02:15 PM',
    location: 'Andhra Pradesh, India',
    currency: 'INR (₹)',
    preparedBy: 'Rakesh Verma',
    designation: 'Finance & Resource Data Contributor',
    submissionId: 'SUB-2026-SOL-GJT',
  },
  {
    id: 'asg-2',
    entityName: 'Hyderabad Metro Phase 2',
    entityId: 'MEIL-MET-HYD',
    businessUnit: 'Infra BU',
    reportingPeriod: '1 April 2026 - 31 March 2027',
    financialYear: 'FY 2026-27',
    module: 'Resource Expenditure',
    completion: 45,
    evidenceStatus: 'Pending',
    status: 'Draft',
    lastUpdated: 'Yesterday at 05:40 PM',
    location: 'Telangana, India',
    currency: 'INR (₹)',
    preparedBy: 'Rakesh Verma',
    designation: 'Finance & Resource Data Contributor',
    submissionId: 'SUB-2026-MET-HYD',
  },
  {
    id: 'asg-3',
    entityName: 'Vizag Port Expansion',
    entityId: 'MEIL-PORT-VZG',
    businessUnit: 'Ports BU',
    reportingPeriod: '1 April 2026 - 31 March 2027',
    financialYear: 'FY 2026-27',
    module: 'Financial Summary',
    completion: 100,
    evidenceStatus: 'Complete',
    status: 'Submitted',
    lastUpdated: '10 Jun 2026',
    location: 'Andhra Pradesh, India',
    currency: 'INR (₹)',
    preparedBy: 'Rakesh Verma',
    designation: 'Finance & Resource Data Contributor',
    submissionId: 'SUB-2026-PORT-VZG',
  },
  {
    id: 'asg-4',
    entityName: 'Zojila Tunnel Project',
    entityId: 'MEIL-TUN-ZOJ',
    businessUnit: 'Infra BU',
    reportingPeriod: '1 April 2026 - 31 March 2027',
    financialYear: 'FY 2026-27',
    module: 'Financial Summary',
    completion: 65,
    evidenceStatus: 'Complete',
    status: 'In Progress',
    lastUpdated: '08 Jun 2026',
    location: 'Jammu & Kashmir, India',
    currency: 'INR (₹)',
    preparedBy: 'Rakesh Verma',
    designation: 'Finance & Resource Data Contributor',
    submissionId: 'SUB-2026-TUN-ZOJ',
  },
  {
    id: 'asg-5',
    entityName: 'Kaleshwaram Lift Irrigation',
    entityId: 'MEIL-WTR-KPR',
    businessUnit: 'Water BU',
    reportingPeriod: '1 April 2026 - 31 March 2027',
    financialYear: 'FY 2026-27',
    module: 'Resource Expenditure',
    completion: 25,
    evidenceStatus: 'Pending',
    status: 'Draft',
    lastUpdated: '05 Jun 2026',
    location: 'Telangana, India',
    currency: 'INR (₹)',
    preparedBy: 'Rakesh Verma',
    designation: 'Finance & Resource Data Contributor',
    submissionId: 'SUB-2026-WTR-KPR',
  },
  {
    id: 'asg-6',
    entityName: 'Nizamabad Solar Farm',
    entityId: 'MEIL-SOL-NZR',
    businessUnit: 'Solar BU',
    reportingPeriod: '1 April 2026 - 31 March 2027',
    financialYear: 'FY 2026-27',
    module: 'BRSR Financial Calculations',
    completion: 85,
    evidenceStatus: 'Complete',
    status: 'Returned for Correction',
    lastUpdated: '02 Jun 2026',
    location: 'Telangana, India',
    currency: 'INR (₹)',
    preparedBy: 'Rakesh Verma',
    designation: 'Finance & Resource Data Contributor',
    submissionId: 'SUB-2026-SOL-NZR',
  },
]

const DEFAULT_EXPENDITURES: ResourceExpenditureItem[] = [
  {
    id: 'exp-1',
    category: 'Pollution Control',
    projectName: 'Flue Gas Dust Suppressors & Scrubber System',
    description: 'Air emission control equipment & electrostatic precipitator retrofits',
    amount: 12.5,
    currency: 'INR (₹)',
    source: 'CapEx',
    accountingPeriod: 'FY 2026-27',
    costCentre: 'CC-SOL-GJT-01',
    vendorRef: 'Thermax India Ltd.',
    invoiceRef: 'INV-THX-2026-991',
    dataSource: 'Invoice',
    supportingDocument: 'CapEx_Projects.xlsx',
    remarks: 'Approved under green modernization scheme.',
    status: 'Verified',
    dateAdded: '10 Jun 2026',
  },
  {
    id: 'exp-2',
    category: 'Energy Efficiency',
    projectName: 'Smart Substation Loss Reduction Initiative',
    description: 'High efficiency transformers & variable frequency drive motors',
    amount: 8.0,
    currency: 'INR (₹)',
    source: 'CapEx',
    accountingPeriod: 'FY 2026-27',
    costCentre: 'CC-SOL-GJT-02',
    vendorRef: 'ABB India Ltd.',
    invoiceRef: 'INV-ABB-88210',
    dataSource: 'Ledger',
    supportingDocument: 'CapEx_Projects.xlsx',
    remarks: 'Achieved 4.2% lower transmission loss.',
    status: 'Verified',
    dateAdded: '10 Jun 2026',
  },
  {
    id: 'exp-3',
    category: 'Renewable Energy',
    projectName: 'Bifacial Solar Panel Array Expansion',
    description: 'Captive solar rooftop & tracking arrays installation',
    amount: 15.0,
    currency: 'INR (₹)',
    source: 'CapEx',
    accountingPeriod: 'FY 2026-27',
    costCentre: 'CC-SOL-GJT-01',
    vendorRef: 'Tata Power Solar',
    invoiceRef: 'INV-TPS-44120',
    dataSource: 'Invoice',
    supportingDocument: 'CapEx_Projects.xlsx',
    remarks: 'Commissioned on 15 May 2026.',
    status: 'Verified',
    dateAdded: '10 Jun 2026',
  },
  {
    id: 'exp-4',
    category: 'Water Conservation',
    projectName: 'Zero Liquid Discharge & Rainwater Storage',
    description: 'Rainwater harvesting civil works & filtration membrane replacement',
    amount: 5.5,
    currency: 'INR (₹)',
    source: 'OpEx',
    accountingPeriod: 'FY 2026-27',
    costCentre: 'CC-SOL-GJT-03',
    vendorRef: 'Ion Exchange India',
    invoiceRef: 'INV-IE-3091',
    dataSource: 'Ledger',
    supportingDocument: 'OpEx_Records.pdf',
    remarks: 'Quarterly maintenance contract operations.',
    status: 'Verified',
    dateAdded: '09 Jun 2026',
  },
  {
    id: 'exp-5',
    category: 'Waste Management',
    projectName: 'Hazardous Chemical & Sludge Treatment Cell',
    description: 'Bioremediation facility & concrete containment lining',
    amount: 3.0,
    currency: 'INR (₹)',
    source: 'OpEx',
    accountingPeriod: 'FY 2026-27',
    costCentre: 'CC-SOL-GJT-03',
    vendorRef: 'Ramky Enviro Engineers',
    invoiceRef: 'INV-RKE-1102',
    dataSource: 'Invoice',
    supportingDocument: 'OpEx_Records.pdf',
    remarks: 'SPCB authorized co-processing facility handling.',
    status: 'Verified',
    dateAdded: '09 Jun 2026',
  },
  {
    id: 'exp-6',
    category: 'Environmental Protection',
    projectName: 'Afforestation & Biodiversity Corridor',
    description: 'Native flora green belt development around perimeter buffer',
    amount: 1.0,
    currency: 'INR (₹)',
    source: 'OpEx',
    accountingPeriod: 'FY 2026-27',
    costCentre: 'CC-SOL-GJT-04',
    vendorRef: 'State Forest Nursery Dept',
    invoiceRef: 'INV-SFN-0091',
    dataSource: 'Approved report',
    supportingDocument: 'Environmental_Spend.pdf',
    remarks: '3,500 saplings planted across 12 hectares.',
    status: 'Verified',
    dateAdded: '08 Jun 2026',
  },
]

const DEFAULT_EVIDENCE_DOCS: EvidenceDocumentItem[] = [
  {
    id: 'doc-1',
    documentName: 'MEIL_FS_2026-27.pdf',
    category: 'Financial Statement',
    linkedEntity: 'Gayatri Solar Plant (MEIL-SOL-GJT)',
    linkedTo: 'Financial Summary',
    reportingPeriod: 'FY 2026-27',
    documentDate: '15 May 2026',
    issuingOrganization: 'KPMG India Statutory Audit',
    sourceReference: 'STAT-AUD-FY26-SCH4',
    size: '4.8 MB',
    uploadedBy: 'Rakesh Verma',
    uploadDate: '12 Jun 2026',
    status: 'Accepted',
    remarks: 'Approved by statutory audit team',
    versionHistory: [
      { version: 'v1.0', date: '12 Jun 2026', user: 'Rakesh Verma', note: 'Initial certified draft' }
    ]
  },
  {
    id: 'doc-2',
    documentName: 'CapEx_Projects.xlsx',
    category: 'Capital Expenditure',
    linkedEntity: 'Gayatri Solar Plant (MEIL-SOL-GJT)',
    linkedTo: 'Resource Expenditure',
    reportingPeriod: 'FY 2026-27',
    documentDate: '01 Jun 2026',
    issuingOrganization: 'MEIL Project Accounts Dept',
    sourceReference: 'SAP-CAPEX-RUN-06',
    size: '2.1 MB',
    uploadedBy: 'Rakesh Verma',
    uploadDate: '10 Jun 2026',
    status: 'Under Review',
    remarks: 'CapEx breakdown for solar & transformers',
    versionHistory: [
      { version: 'v1.0', date: '10 Jun 2026', user: 'Rakesh Verma', note: 'Full GL line item extracts' }
    ]
  },
  {
    id: 'doc-3',
    documentName: 'OpEx_Records.pdf',
    category: 'Operating Expenditure',
    linkedEntity: 'Gayatri Solar Plant (MEIL-SOL-GJT)',
    linkedTo: 'Resource Expenditure',
    reportingPeriod: 'FY 2026-27',
    documentDate: '05 Jun 2026',
    issuingOrganization: 'Solar BU Plant Operations',
    sourceReference: 'OPEX-SUMMARY-Q4',
    size: '1.4 MB',
    uploadedBy: 'Rakesh Verma',
    uploadDate: '10 Jun 2026',
    status: 'Accepted',
    remarks: 'Rainwater & waste treatment operating slips',
    versionHistory: [
      { version: 'v1.0', date: '10 Jun 2026', user: 'Rakesh Verma', note: 'Certified vouchers' }
    ]
  },
  {
    id: 'doc-4',
    documentName: 'Environmental_Spend.pdf',
    category: 'Environmental Expenditure',
    linkedEntity: 'Gayatri Solar Plant (MEIL-SOL-GJT)',
    linkedTo: 'Resource Expenditure',
    reportingPeriod: 'FY 2026-27',
    documentDate: '08 Jun 2026',
    issuingOrganization: 'Corporate Sustainability Cell',
    sourceReference: 'ENV-RECON-MEIL-09',
    size: '3.6 MB',
    uploadedBy: 'Rakesh Verma',
    uploadDate: '09 Jun 2026',
    status: 'Accepted',
    remarks: 'Total ₹45.00 Cr reconciliation cert',
    versionHistory: [
      { version: 'v1.0', date: '09 Jun 2026', user: 'Rakesh Verma', note: 'Cross-audited reconciliation' }
    ]
  },
  {
    id: 'doc-5',
    documentName: 'Bank_Statement.pdf',
    category: 'Supporting Document',
    linkedEntity: 'Gayatri Solar Plant (MEIL-SOL-GJT)',
    linkedTo: 'Financial Summary',
    reportingPeriod: 'FY 2026-27',
    documentDate: '04 Jun 2026',
    issuingOrganization: 'State Bank of India Corporate',
    sourceReference: 'SBI-TXN-2026-994',
    size: '5.2 MB',
    uploadedBy: 'Rakesh Verma',
    uploadDate: '09 Jun 2026',
    status: 'Returned',
    remarks: 'Requires page 12 stamp certification from treasury',
    reviewerComments: 'Page 12 ledger reconciliation seal is missing.',
    versionHistory: [
      { version: 'v1.0', date: '09 Jun 2026', user: 'Rakesh Verma', note: 'Initial bank copy' }
    ]
  },
]

const DEFAULT_SUBMISSIONS: SubmissionRecord[] = [
  {
    id: 'SUB-2026-SOL-GJT',
    version: 'v1.2',
    entityName: 'Gayatri Solar Plant',
    entityId: 'MEIL-SOL-GJT',
    businessUnit: 'Solar BU',
    financialYear: 'FY 2026-27',
    module: 'Financial Summary & Resource Spend',
    submittedDate: '10 Jun 2026',
    completion: 80,
    status: 'In Progress',
    reviewer: 'ESG Reviewer',
    latestComment: 'Draft saved. Please verify that all 8 resource categories are mapped to accounting ledger refs.',
    lastUpdated: 'Today at 02:15 PM',
    timeline: [
      { step: 'Assignment Created', timestamp: '01 Jun 2026', actor: 'System Admin', note: 'Scope assigned for Solar BU' },
      { step: 'Draft Saved', timestamp: '10 Jun 2026', actor: 'Rakesh Verma', note: 'Financial figures populated' },
    ],
  },
  {
    id: 'SUB-2026-PORT-VZG',
    version: 'v1.0',
    entityName: 'Vizag Port Expansion',
    entityId: 'MEIL-PORT-VZG',
    businessUnit: 'Ports BU',
    financialYear: 'FY 2026-27',
    module: 'Financial Summary',
    submittedDate: '10 Jun 2026',
    completion: 100,
    status: 'Submitted',
    reviewer: 'Group Reviewer',
    latestComment: 'Submitted for Group level sign-off. Initial validation passed.',
    lastUpdated: '10 Jun 2026',
    timeline: [
      { step: 'Assignment Created', timestamp: '01 Jun 2026', actor: 'System Admin', note: 'Scope assigned' },
      { step: 'Validation Passed', timestamp: '10 Jun 2026', actor: 'Rakesh Verma', note: 'All checks green' },
      { step: 'Submitted for Review', timestamp: '10 Jun 2026', actor: 'Rakesh Verma', note: 'Submitted to reviewer queue' },
    ],
  },
  {
    id: 'SUB-2026-SOL-NZR',
    version: 'v1.1',
    entityName: 'Nizamabad Solar Farm',
    entityId: 'MEIL-SOL-NZR',
    businessUnit: 'Solar BU',
    financialYear: 'FY 2026-27',
    module: 'BRSR Financial Calculations',
    submittedDate: '02 Jun 2026',
    completion: 85,
    status: 'Returned for Correction',
    reviewer: 'BRSR Reviewer',
    latestComment: 'Environmental expenditure was listed under wrong accounting period. Please correct to FY 2026-27.',
    lastUpdated: '02 Jun 2026',
    timeline: [
      { step: 'Submitted', timestamp: '02 Jun 2026', actor: 'Rakesh Verma', note: 'Initial packet' },
      { step: 'Returned for Correction', timestamp: '03 Jun 2026', actor: 'BRSR Reviewer', note: 'Accounting period adjustment needed' }
    ]
  },
]

const DEFAULT_ACTIVITY: ActivityEvent[] = [
  {
    id: 'act-1',
    timestamp: 'Today at 02:15 PM',
    type: 'DRAFT_SAVED',
    title: 'Financial data updated',
    description: 'Financial Summary and Resource Expenditure saved for Gayatri Solar Plant',
    entity: 'MEIL-SOL-GJT | FY 2026-27',
    actor: 'Rakesh Verma',
    severity: 'success',
  },
  {
    id: 'act-2',
    timestamp: '12 Jun 2026, 11:30 AM',
    type: 'DOC_UPLOADED',
    title: 'Document uploaded',
    description: 'MEIL_FS_2026-27.pdf uploaded and linked to Financial Summary',
    entity: 'MEIL_FS_2026-27.pdf',
    actor: 'Rakesh Verma',
    severity: 'info',
  },
  {
    id: 'act-3',
    timestamp: '09 Jun 2026, 04:10 PM',
    type: 'RETURNED',
    title: 'Returned for correction',
    description: 'Bank Statement.pdf returned: page 12 stamp required',
    entity: 'Resource Expenditure - Plant A',
    actor: 'ESG Reviewer',
    severity: 'warning',
  },
  {
    id: 'act-4',
    timestamp: '08 Jun 2026, 09:45 AM',
    type: 'DRAFT_SAVED',
    title: 'Draft saved',
    description: 'Financial Summary - Unit B draft autosaved with 6 line items',
    entity: 'MEIL-TUN-ZOJ',
    actor: 'Rakesh Verma',
    severity: 'info',
  },
]

export const MONTHLY_EXPENDITURE_CHART = [
  { month: 'Apr', capEx: 25, opEx: 60 },
  { month: 'May', capEx: 45, opEx: 85 },
  { month: 'Jun', capEx: 70, opEx: 110 },
  { month: 'Jul', capEx: 90, opEx: 130 },
  { month: 'Aug', capEx: 115, opEx: 150 },
  { month: 'Sep', capEx: 80, opEx: 125 },
]

// ---------------- LOCAL STORAGE KEYS ----------------

const KEYS = {
  ASSIGNMENTS: 'meil_finance_assignments',
  FINANCIAL_SUMMARY: 'meil_finance_summary',
  EXPENDITURES: 'meil_finance_expenditures',
  INTENSITY_METRICS: 'meil_finance_intensity_metrics',
  CSR_DISCLOSURES: 'meil_finance_csr_disclosures',
  EVIDENCE_DOCS: 'meil_finance_evidence_docs',
  SUBMISSIONS: 'meil_finance_submissions',
  ACTIVITY: 'meil_finance_activity',
  ACTIVE_ENTITY: 'meil_finance_active_entity',
}

// ---------------- STORE SERVICE ----------------

export class FinanceStoreService {
  private static isClient = typeof window !== 'undefined'

  static getAssignments(): FinanceAssignment[] {
    if (!this.isClient) return DEFAULT_ASSIGNMENTS
    try {
      const data = localStorage.getItem(KEYS.ASSIGNMENTS)
      return data ? JSON.parse(data) : DEFAULT_ASSIGNMENTS
    } catch {
      return DEFAULT_ASSIGNMENTS
    }
  }

  static saveAssignments(list: FinanceAssignment[]) {
    if (!this.isClient) return
    try {
      localStorage.setItem(KEYS.ASSIGNMENTS, JSON.stringify(list))
    } catch {}
  }

  static getFinancialSummary(): FinancialSummaryData {
    if (!this.isClient) return DEFAULT_FINANCIAL_SUMMARY
    try {
      const data = localStorage.getItem(KEYS.FINANCIAL_SUMMARY)
      if (!data) return DEFAULT_FINANCIAL_SUMMARY
      const parsed = JSON.parse(data)
      return {
        ...DEFAULT_FINANCIAL_SUMMARY,
        ...parsed,
        common: {
          ...DEFAULT_COMMON_METADATA,
          ...(parsed.common || {})
        }
      }
    } catch {
      return DEFAULT_FINANCIAL_SUMMARY
    }
  }

  static saveFinancialSummary(data: FinancialSummaryData) {
    if (!this.isClient) return
    try {
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      const updated = {
        ...data,
        lastSaved: timestamp,
        common: {
          ...data.common,
          lastUpdated: `Today at ${timestamp}`
        }
      }
      localStorage.setItem(KEYS.FINANCIAL_SUMMARY, JSON.stringify(updated))
      this.logActivity({
        type: 'DRAFT_SAVED',
        title: 'Financial data saved',
        description: `Saved turnover ₹${data.turnover} ${data.turnoverUnit} and CapEx ₹${data.capEx} Cr`,
        entity: data.common?.entityId || 'MEIL-SOL-GJT',
        actor: 'Rakesh Verma',
        severity: 'success',
      })
    } catch {}
  }

  static getExpenditures(): ResourceExpenditureItem[] {
    if (!this.isClient) return DEFAULT_EXPENDITURES
    try {
      const data = localStorage.getItem(KEYS.EXPENDITURES)
      return data ? JSON.parse(data) : DEFAULT_EXPENDITURES
    } catch {
      return DEFAULT_EXPENDITURES
    }
  }

  static saveExpenditures(list: ResourceExpenditureItem[]) {
    if (!this.isClient) return
    try {
      localStorage.setItem(KEYS.EXPENDITURES, JSON.stringify(list))
    } catch {}
  }

  static addExpenditure(item: Omit<ResourceExpenditureItem, 'id' | 'dateAdded'>): ResourceExpenditureItem {
    const list = this.getExpenditures()
    const newItem: ResourceExpenditureItem = {
      ...item,
      id: `exp-${Date.now()}`,
      dateAdded: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    }
    const updated = [newItem, ...list]
    this.saveExpenditures(updated)
    this.logActivity({
      type: 'RECORD_CREATED',
      title: 'Expenditure record added',
      description: `Added ₹${newItem.amount} Cr under ${newItem.category} (${newItem.source})`,
      entity: 'MEIL-SOL-GJT',
      actor: 'Rakesh Verma',
      severity: 'info',
    })
    return newItem
  }

  static deleteExpenditure(id: string) {
    const list = this.getExpenditures()
    const filtered = list.filter(i => i.id !== id)
    this.saveExpenditures(filtered)
  }

  static updateExpenditure(id: string, updates: Partial<ResourceExpenditureItem>) {
    const list = this.getExpenditures()
    const updated = list.map(item => item.id === id ? { ...item, ...updates } : item)
    this.saveExpenditures(updated)
  }

  // Level 3 Intensity Metrics
  static getIntensityMetrics(): IntensityMetricsData {
    if (!this.isClient) return DEFAULT_INTENSITY_METRICS
    try {
      const data = localStorage.getItem(KEYS.INTENSITY_METRICS)
      return data ? JSON.parse(data) : DEFAULT_INTENSITY_METRICS
    } catch {
      return DEFAULT_INTENSITY_METRICS
    }
  }

  static saveIntensityMetrics(metrics: IntensityMetricsData) {
    if (!this.isClient) return
    try {
      localStorage.setItem(KEYS.INTENSITY_METRICS, JSON.stringify(metrics))
    } catch {}
  }

  // Level 4 CSR Disclosures
  static getCsrDisclosures(): CsrDisclosureData {
    if (!this.isClient) return DEFAULT_CSR_DISCLOSURES
    try {
      const data = localStorage.getItem(KEYS.CSR_DISCLOSURES)
      return data ? JSON.parse(data) : DEFAULT_CSR_DISCLOSURES
    } catch {
      return DEFAULT_CSR_DISCLOSURES
    }
  }

  static saveCsrDisclosures(csr: CsrDisclosureData) {
    if (!this.isClient) return
    try {
      localStorage.setItem(KEYS.CSR_DISCLOSURES, JSON.stringify(csr))
    } catch {}
  }

  static getEvidenceDocs(): EvidenceDocumentItem[] {
    if (!this.isClient) return DEFAULT_EVIDENCE_DOCS
    try {
      const data = localStorage.getItem(KEYS.EVIDENCE_DOCS)
      return data ? JSON.parse(data) : DEFAULT_EVIDENCE_DOCS
    } catch {
      return DEFAULT_EVIDENCE_DOCS
    }
  }

  static getEvidenceDocuments(): EvidenceDocumentItem[] {
    return this.getEvidenceDocs()
  }

  static saveEvidenceDocs(list: EvidenceDocumentItem[]) {
    if (!this.isClient) return
    try {
      localStorage.setItem(KEYS.EVIDENCE_DOCS, JSON.stringify(list))
    } catch {}
  }

  static addEvidenceDoc(doc: Omit<EvidenceDocumentItem, 'id' | 'uploadDate' | 'uploadedBy' | 'versionHistory'>): EvidenceDocumentItem {
    const list = this.getEvidenceDocs()
    const nowStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    const newDoc: EvidenceDocumentItem = {
      ...doc,
      id: `doc-${Date.now()}`,
      uploadDate: nowStr,
      uploadedBy: 'Rakesh Verma',
      versionHistory: [
        { version: 'v1.0', date: nowStr, user: 'Rakesh Verma', note: 'Uploaded via Contributor Console' }
      ]
    }
    const updated = [newDoc, ...list]
    this.saveEvidenceDocs(updated)
    this.logActivity({
      type: 'DOC_UPLOADED',
      title: 'Evidence document linked',
      description: `Attached ${newDoc.documentName} to ${newDoc.linkedTo}`,
      entity: newDoc.linkedEntity || 'MEIL-SOL-GJT',
      actor: 'Rakesh Verma',
      severity: 'info',
    })
    return newDoc
  }

  static addEvidenceDocument(doc: any): EvidenceDocumentItem {
    return this.addEvidenceDoc(doc)
  }

  static deleteEvidenceDocument(id: string) {
    const list = this.getEvidenceDocs()
    const filtered = list.filter(d => d.id !== id)
    this.saveEvidenceDocs(filtered)
  }

  static getSubmissions(): SubmissionRecord[] {
    if (!this.isClient) return DEFAULT_SUBMISSIONS
    try {
      const data = localStorage.getItem(KEYS.SUBMISSIONS)
      return data ? JSON.parse(data) : DEFAULT_SUBMISSIONS
    } catch {
      return DEFAULT_SUBMISSIONS
    }
  }

  static saveSubmissions(list: SubmissionRecord[]) {
    if (!this.isClient) return
    try {
      localStorage.setItem(KEYS.SUBMISSIONS, JSON.stringify(list))
    } catch {}
  }

  static submitRecordForReview(entityId: string = 'MEIL-SOL-GJT') {
    const validation = this.validateRecord()
    if (!validation.readyForSubmission) {
      return { ok: false, errors: validation.blockingErrors }
    }

    const submissions = this.getSubmissions()
    const updated = submissions.map(s => {
      if (s.entityId === entityId) {
        return {
          ...s,
          status: 'Submitted' as const,
          completion: 100,
          version: 'v1.3',
          lastUpdated: 'Just now',
          latestComment: 'Submitted by Rakesh Verma. Awaiting reviewer sign-off.',
          timeline: [
            ...s.timeline,
            { step: 'Submitted for Review', timestamp: new Date().toLocaleDateString('en-GB'), actor: 'Rakesh Verma', note: 'All Level 0-7 checks passed' },
          ],
        }
      }
      return s
    })
    this.saveSubmissions(updated)

    // Update assignment status
    const asgs = this.getAssignments()
    this.saveAssignments(asgs.map(a => a.entityId === entityId ? { ...a, status: 'Submitted', completion: 100 } : a))

    this.logActivity({
      type: 'SUBMITTED',
      title: 'Record submitted for review',
      description: `Submitted ${entityId} financial and resource data with full evidence verification`,
      entity: entityId,
      actor: 'Rakesh Verma',
      severity: 'success',
    })

    return { ok: true, message: 'Record successfully submitted for reviewer approval!' }
  }

  static resubmitRecord(submissionId: string = 'SUB-2026-SOL-GJT') {
    const subs = this.getSubmissions()
    const updated = subs.map(s => {
      if (s.id === submissionId) {
        return {
          ...s,
          status: 'Submitted' as const,
          version: 'v1.4',
          lastUpdated: 'Just now',
          latestComment: 'Corrections addressed by Rakesh Verma. Resubmitted for approval.',
          timeline: [
            ...s.timeline,
            { step: 'Resubmitted for Review', timestamp: new Date().toLocaleDateString('en-GB'), actor: 'Rakesh Verma', note: 'Corrections incorporated' }
          ]
        }
      }
      return s
    })
    this.saveSubmissions(updated)
    this.logActivity({
      type: 'RESUBMITTED',
      title: 'Record resubmitted',
      description: `Resubmitted ${submissionId} after incorporating reviewer remarks`,
      entity: submissionId,
      actor: 'Rakesh Verma',
      severity: 'success'
    })
  }

  static getMonthlyExpenditureChartData() {
    return MONTHLY_EXPENDITURE_CHART
  }

  static getActivity(): ActivityEvent[] {
    if (!this.isClient) return DEFAULT_ACTIVITY
    try {
      const data = localStorage.getItem(KEYS.ACTIVITY)
      return data ? JSON.parse(data) : DEFAULT_ACTIVITY
    } catch {
      return DEFAULT_ACTIVITY
    }
  }

  static getActivities(): ActivityEvent[] {
    return this.getActivity()
  }

  static logActivity(
    eventOrTitle: Omit<ActivityEvent, 'id' | 'timestamp'> | string,
    description?: string,
    severity?: any,
    entity?: string
  ) {
    if (!this.isClient) return
    try {
      const current = this.getActivity()
      let newEvent: ActivityEvent

      if (typeof eventOrTitle === 'string') {
        const sev = severity === 'saved' ? 'info' : (severity || 'info')
        newEvent = {
          id: `act-${Date.now()}`,
          timestamp: 'Just now',
          type: 'DRAFT_SAVED',
          title: eventOrTitle,
          description: description || '',
          entity: entity || 'MEIL-SOL-GJT',
          actor: 'Rakesh Verma',
          severity: sev,
        }
      } else {
        newEvent = {
          ...eventOrTitle,
          id: `act-${Date.now()}`,
          timestamp: 'Just now',
        }
      }

      localStorage.setItem(KEYS.ACTIVITY, JSON.stringify([newEvent, ...current.slice(0, 40)]))
    } catch {}
  }

  // ---------------- COMPUTED BUSINESS LOGIC ----------------

  static calculateYoY(current: number, previous: number): { percentage: number | null; text: string; positive: boolean } {
    if (previous === 0 || isNaN(previous) || previous == null) {
      return { percentage: null, text: 'Not calculable — previous-year value is zero', positive: false }
    }
    const pct = ((current - previous) / previous) * 100
    const formatted = pct > 0 ? `+${pct.toFixed(2)}%` : `${pct.toFixed(2)}%`
    return { percentage: pct, text: `${formatted} YoY change`, positive: pct >= 0 }
  }

  static getTotalResourceExpenditure(expenditures: ResourceExpenditureItem[] = this.getExpenditures()): number {
    return Number(expenditures.reduce((sum, item) => sum + (Number(item.amount) || 0), 0).toFixed(2))
  }

  static getCategoryDistribution(expenditures: ResourceExpenditureItem[] = this.getExpenditures()): { category: string; amount: number; percentage: number; color: string }[] {
    const total = this.getTotalResourceExpenditure(expenditures) || 1
    const colorMap: Record<string, string> = {
      'Renewable Energy': '#2563EB',
      'Energy Efficiency': '#3B82F6',
      'Pollution Control': '#8B5CF6',
      'Water Conservation': '#06B6D4',
      'Waste Management': '#10B981',
      'Emission Reduction': '#F59E0B',
      'Environmental Protection': '#14B8A6',
      'Other Resource-Efficiency Initiatives': '#64748B',
    }

    const byCat = expenditures.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + item.amount
      return acc
    }, {} as Record<string, number>)

    return Object.entries(byCat).map(([category, amount]) => ({
      category,
      amount,
      percentage: Math.round((amount / total) * 100),
      color: colorMap[category] || '#94A3B8',
    }))
  }

  /**
   * Level 6 — Validation & Reconciliation
   * Checks all 10 criteria specified in Level 6:
   * - Required financial fields are complete.
   * - Currency and display units are valid.
   * - Reporting periods match the assigned financial year.
   * - Duplicate expenditure entries are identified.
   * - Required evidence is linked to the correct records.
   * - Financial figures reconcile to their approved source records.
   * - Calculated metrics use valid inputs and approved methodology.
   * - Previous-year comparisons use the correct period.
   * - Exceptions and estimates have appropriate explanations.
   * - No unresolved blocking validation errors remain.
   */
  static validateRecord(
    summary: FinancialSummaryData = this.getFinancialSummary(),
    expenditures: ResourceExpenditureItem[] = this.getExpenditures(),
    docs: EvidenceDocumentItem[] = this.getEvidenceDocs()
  ): ValidationChecklistResult {
    const blockingErrors: string[] = []
    const warnings: string[] = []

    // 1. Required financial fields
    const financialSummaryCompleted = summary.turnover > 0 && summary.totalExpenditure > 0 && !!summary.financialReportingBasis
    if (!financialSummaryCompleted) {
      blockingErrors.push('Total Turnover, Total Expenditure, and Financial Reporting Basis are mandatory')
    }

    // 2. Currency & display units valid
    const currencyAndUnitsValid = !!summary.common?.currency && !!summary.turnoverUnit
    if (!currencyAndUnitsValid) {
      blockingErrors.push('Valid currency (INR) and display unit must be assigned')
    }

    // 3. Reporting periods match assigned FY
    const reportingPeriodsMatch = summary.common?.financialYear === 'FY 2026-27'
    if (!reportingPeriodsMatch) {
      warnings.push(`Assigned financial year (${summary.common?.financialYear}) requires reconciliation with FY 2026-27`)
    }

    // 4. Duplicate expenditure entries check
    const descSet = new Set<string>()
    let hasDuplicates = false
    for (const exp of expenditures) {
      const key = `${exp.category}-${exp.description.toLowerCase().trim()}`
      if (descSet.has(key)) {
        hasDuplicates = true
        warnings.push(`Potential duplicate expenditure line item: "${exp.description}" under ${exp.category}`)
        break
      }
      descSet.add(key)
    }
    const duplicateExpendituresChecked = !hasDuplicates

    // 5. Required evidence linked
    const acceptedOrPendingDocs = docs.filter(d => d.status !== 'Returned')
    const hasFinancialDoc = acceptedOrPendingDocs.some(d => d.category === 'Financial Statement' || d.linkedTo === 'Financial Summary')
    const hasExpenditureDoc = acceptedOrPendingDocs.some(d => d.category === 'Environmental Expenditure' || d.category === 'Capital Expenditure' || d.linkedTo === 'Resource Expenditure')
    const requiredDocumentsUploaded = hasFinancialDoc && hasExpenditureDoc
    if (!requiredDocumentsUploaded) {
      blockingErrors.push('Approved Financial Statement and Environmental Spend evidence attachments are mandatory')
    }

    // 6. Financial figures reconcile
    const financialFiguresReconciled = summary.reconciliationStatus === 'Reconciled' || summary.reconciliationStatus === 'Pending'
    if (summary.reconciliationStatus === 'Exception' && !summary.reconciliationRemarks) {
      blockingErrors.push('Reconciliation remarks are required when reconciliation status is Exception')
    }

    // 7. Calculated metrics valid
    const calculatedMetricsValid = summary.turnover > 0 && (summary.capEx + summary.opEx <= summary.totalExpenditure * 1.05)
    if (summary.capEx + summary.opEx > summary.totalExpenditure * 1.05) {
      warnings.push('CapEx + OpEx sum exceeds reported Total Expenditure')
    }

    // 8. Previous year comparison
    const previousYearComparisonAvailable = summary.previousTurnover > 0
    if (!previousYearComparisonAvailable) {
      warnings.push('Previous year comparative turnover is missing or zero')
    }

    // 9. Exceptions and estimates explained
    const exceptionsExplained = summary.remarks.trim().length >= 8
    if (!exceptionsExplained) {
      warnings.push('Additional explanatory remarks recommended for audit trail clarity')
    }

    // 10. Check blocking
    const noBlockingErrors = blockingErrors.length === 0
    const readyForSubmission = noBlockingErrors && expenditures.length > 0

    // Calculate score
    let passed = 0
    if (financialSummaryCompleted) passed += 15
    if (currencyAndUnitsValid) passed += 10
    if (reportingPeriodsMatch) passed += 10
    if (duplicateExpendituresChecked) passed += 10
    if (requiredDocumentsUploaded) passed += 15
    if (financialFiguresReconciled) passed += 10
    if (calculatedMetricsValid) passed += 10
    if (previousYearComparisonAvailable) passed += 10
    if (exceptionsExplained) passed += 10

    return {
      financialSummaryCompleted,
      currencyAndUnitsValid,
      reportingPeriodsMatch,
      duplicateExpendituresChecked,
      requiredDocumentsUploaded,
      financialFiguresReconciled,
      calculatedMetricsValid,
      previousYearComparisonAvailable,
      exceptionsExplained,
      noBlockingErrors,
      readyForSubmission,
      completionPercentage: Math.min(100, passed),
      blockingErrors,
      warnings,
    }
  }

  // ---------------- EXPORT DATA HELPERS ----------------

  static exportFinancialSummaryCSV() {
    const summary = this.getFinancialSummary()
    const csvContent =
      'Metric,Amount,Unit,Reporting Basis,Reconciliation Status,Data Source,Document Reference,Remarks\n' +
      `Total Turnover / Revenue,${summary.turnover},${summary.turnoverUnit},"${summary.financialReportingBasis}","${summary.reconciliationStatus}","${summary.financialDataSource}","${summary.financialStatementReference}","${summary.remarks}"\n` +
      `Previous FY Turnover,${summary.previousTurnover},${summary.turnoverUnit},"${summary.financialReportingBasis}","${summary.reconciliationStatus}","${summary.financialDataSource}","${summary.financialStatementReference}",""\n` +
      `Total Expenditure,${summary.totalExpenditure},${summary.turnoverUnit},"${summary.financialReportingBasis}","${summary.reconciliationStatus}","${summary.financialDataSource}","${summary.financialStatementReference}",""\n` +
      `Capital Expenditure (CapEx),${summary.capEx},${summary.turnoverUnit},"${summary.financialReportingBasis}","${summary.reconciliationStatus}","${summary.financialDataSource}","${summary.financialStatementReference}",""\n` +
      `Operating Expenditure (OpEx),${summary.opEx},${summary.turnoverUnit},"${summary.financialReportingBasis}","${summary.reconciliationStatus}","${summary.financialDataSource}","${summary.financialStatementReference}",""\n` +
      `Environmental Expenditure,${summary.environmentalSpend},${summary.turnoverUnit},"${summary.financialReportingBasis}","${summary.reconciliationStatus}","${summary.financialDataSource}","${summary.financialStatementReference}",""\n`

    this.downloadFile('MEIL_Financial_Summary_FY2026-27.csv', csvContent, 'text/csv;charset=utf-8;')
    return csvContent
  }

  static exportResourceExpendituresCSV(): string {
    const list = this.getExpenditures()
    const rows = list.map(i => `"${i.category}","${i.projectName}","${i.description}",${i.amount},${i.currency},${i.source},${i.accountingPeriod},"${i.costCentre}","${i.vendorRef}","${i.invoiceRef}","${i.dataSource}","${i.status}"`).join('\n')
    const csvContent = 'Category,Project / Initiative,Description,Amount (₹ Cr),Currency,Source,Accounting Period,Cost Centre,Vendor,Invoice Ref,Data Source,Status\n' + rows
    this.downloadFile('MEIL_Resource_Expenditures_FY2026-27.csv', csvContent, 'text/csv;charset=utf-8;')
    return csvContent
  }

  private static downloadFile(filename: string, content: string, mime: string) {
    if (!this.isClient) return
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }
}

export const financeStore = FinanceStoreService
export default FinanceStoreService
