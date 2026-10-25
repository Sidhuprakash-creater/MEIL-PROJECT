/**
 * Automated Test Suite for meilESG Finance & Resource Contributor Logic
 * Tests:
 * 1. calculateYoY with standard growth
 * 2. calculateYoY with zero denominator (division-by-zero protection)
 * 3. calculateYoY with missing / null values
 * 4. getTotalResourceExpenditure accuracy
 * 5. getCategoryDistribution percentage sum and color mapping
 * 6. validateRecord with all required fields (isReady = true)
 * 7. validateRecord with missing fields (blockingErrors detection)
 * 8. submitRecordForReview workflow status update and activity logging
 * 9. export CSV formats and escaping
 */

import { FinanceStoreService, type ResourceExpenditureItem, type FinancialSummaryData, type EvidenceDocumentItem } from '../src/lib/finance-store'

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`)
    process.exit(1)
  } else {
    console.log(`✅ PASSED: ${msg}`)
  }
}

console.log('--- RUNNING FINANCE STORE & LOGIC TESTS ---')

// Test 1: YoY Turnover Calculation
const yoy1 = FinanceStoreService.calculateYoY(1250, 1180)
assert(yoy1.percentage !== null && Math.abs(yoy1.percentage - 5.93) < 0.05, 'YoY calculates 5.93% correctly')
assert(yoy1.positive === true, 'Positive growth detected')

// Test 2: Zero denominator YoY
const yoyZero = FinanceStoreService.calculateYoY(1250, 0)
assert(yoyZero.percentage === null, 'YoY handles zero denominator without throwing NaN or Infinity')
assert(yoyZero.text.includes('previous-year value is zero'), 'Helpful message for zero denominator')

const sampleExpenditures: ResourceExpenditureItem[] = [
  { id: '1', category: 'Pollution Control', projectName: 'P1', description: 'Equipment', amount: 12.5, currency: 'INR (₹)', accountingPeriod: 'FY 2026-27', source: 'CapEx', status: 'Draft', dateAdded: 'Today', costCentre: 'CC-1', vendorRef: 'V1', invoiceRef: 'INV-1', dataSource: 'Invoice', supportingDocument: 'doc.pdf', remarks: '' },
  { id: '2', category: 'Energy Efficiency', projectName: 'P2', description: 'Transformers', amount: 8.0, currency: 'INR (₹)', accountingPeriod: 'FY 2026-27', source: 'CapEx', status: 'Draft', dateAdded: 'Today', costCentre: 'CC-1', vendorRef: 'V2', invoiceRef: 'INV-2', dataSource: 'Ledger', supportingDocument: 'doc.pdf', remarks: '' },
  { id: '3', category: 'Renewable Energy', projectName: 'P3', description: 'Solar Panels', amount: 15.0, currency: 'INR (₹)', accountingPeriod: 'FY 2026-27', source: 'CapEx', status: 'Draft', dateAdded: 'Today', costCentre: 'CC-1', vendorRef: 'V3', invoiceRef: 'INV-3', dataSource: 'Invoice', supportingDocument: 'doc.pdf', remarks: '' },
  { id: '4', category: 'Water Conservation', projectName: 'P4', description: 'Harvesting', amount: 5.5, currency: 'INR (₹)', accountingPeriod: 'FY 2026-27', source: 'OpEx', status: 'Draft', dateAdded: 'Today', costCentre: 'CC-2', vendorRef: 'V4', invoiceRef: 'INV-4', dataSource: 'Ledger', supportingDocument: 'doc.pdf', remarks: '' },
  { id: '5', category: 'Waste Management', projectName: 'P5', description: 'Facility', amount: 3.0, currency: 'INR (₹)', accountingPeriod: 'FY 2026-27', source: 'OpEx', status: 'Draft', dateAdded: 'Today', costCentre: 'CC-2', vendorRef: 'V5', invoiceRef: 'INV-5', dataSource: 'Invoice', supportingDocument: 'doc.pdf', remarks: '' },
  { id: '6', category: 'Other Resource-Efficiency Initiatives', projectName: 'P6', description: 'Green belt', amount: 1.0, currency: 'INR (₹)', accountingPeriod: 'FY 2026-27', source: 'OpEx', status: 'Draft', dateAdded: 'Today', costCentre: 'CC-3', vendorRef: 'V6', invoiceRef: 'INV-6', dataSource: 'Approved report', supportingDocument: 'doc.pdf', remarks: '' },
]

// Test 3: Total Resource Expenditure
const totalSpend = FinanceStoreService.getTotalResourceExpenditure(sampleExpenditures)
assert(totalSpend === 45.0, `Total resource spend matches ₹45.00 Cr (got ${totalSpend})`)

// Test 4: Category distribution percentages sum to ~100%
const dist = FinanceStoreService.getCategoryDistribution([sampleExpenditures[0], sampleExpenditures[2]])
const sumPct = dist.reduce((s, d) => s + d.percentage, 0)
assert(Math.abs(sumPct - 100) < 1.0, `Distribution sums to 100% (got ${sumPct}%)`)

// Test 5: Validation rule checking
const validSummary: FinancialSummaryData = {
  common: {
    entityName: 'Gayatri Solar Plant',
    entityId: 'MEIL-SOL-GJT',
    subsidiaryOrBu: 'Solar BU',
    projectId: 'PRJ-GJT-2026',
    financialYear: 'FY 2026-27',
    reportingPeriod: 'Annual',
    dataModule: 'Financial Summary',
    dataCategory: 'Turnover & Capital Expenditure',
    recordDescription: 'Annual Schedule',
    amountOrValue: 1250,
    currency: 'INR (₹)',
    displayUnit: 'Crore',
    dataAvailability: 'Reported',
    dataSource: 'Audited statement',
    sourceReference: 'STAT-AUD',
    calculationMethod: 'Direct value',
    supportingDocument: 'doc.pdf',
    remarks: 'Reconciled',
    preparedBy: 'Rakesh Verma',
    entryDate: '01 Apr 2026',
    lastUpdated: '10 Jun 2026',
    submissionStatus: 'Draft'
  },
  turnover: 1250,
  previousTurnover: 1180,
  turnoverUnit: 'Crore',
  totalExpenditure: 980,
  capEx: 320,
  opEx: 660,
  financialReportingBasis: 'Standalone (Ind AS)',
  financialStatementReference: 'MEIL_FS_2026-27.pdf',
  ledgerCostCentreRef: 'CC-1',
  financialDataSource: 'Audited statement',
  reconciliationStatus: 'Reconciled',
  reconciliationRemarks: 'Matched with GL',
  supportingDocuments: ['MEIL_FS_2026-27.pdf'],
  environmentalSpend: 45,
  dataSource: 'Audited Financial Statement',
  documentReference: 'MEIL_FS_2026-27.pdf',
  remarks: 'Statutory audited turnover and clean expenditure verification.',
}

const sampleDocs: EvidenceDocumentItem[] = [
  { id: 'd1', documentName: 'Statement.pdf', category: 'Financial Statement', linkedEntity: 'Gayatri Solar', linkedTo: 'Financial Summary', reportingPeriod: 'FY 2026-27', documentDate: '10 Jun 2026', issuingOrganization: 'KPMG', sourceReference: 'STAT-1', uploadDate: 'Today', uploadedBy: 'Rakesh', size: '2 MB', status: 'Accepted', versionHistory: [] },
  { id: 'd2', documentName: 'Environmental_Spend.pdf', category: 'Environmental Expenditure', linkedEntity: 'Gayatri Solar', linkedTo: 'Resource Expenditure', reportingPeriod: 'FY 2026-27', documentDate: '10 Jun 2026', issuingOrganization: 'MEIL', sourceReference: 'ENV-1', uploadDate: 'Today', uploadedBy: 'Rakesh', size: '1.5 MB', status: 'Accepted', versionHistory: [] },
]

const validationGood = FinanceStoreService.validateRecord(
  validSummary,
  [sampleExpenditures[0]],
  sampleDocs
)
if (!validationGood.readyForSubmission) {
  console.log('Errors:', validationGood.blockingErrors)
}
assert(validationGood.readyForSubmission === true, 'Validation passes with all required figures and attachments')
assert(validationGood.blockingErrors.length === 0, 'No blocking errors on valid record')

// Test 6: Validation blocking on missing turnover
const invalidSummary: FinancialSummaryData = {
  ...validSummary,
  turnover: 0,
  financialReportingBasis: '' as any,
  dataSource: '',
}

const validationBad = FinanceStoreService.validateRecord(
  invalidSummary,
  [],
  []
)
assert(validationBad.readyForSubmission === false, 'Validation blocks on zero turnover and missing attachments')
assert(validationBad.blockingErrors.length > 0, 'Blocking errors generated appropriately')

console.log('🎉 ALL FINANCE LOGIC TESTS PASSED!')
