'use client'
import { useApp } from '@/components/site-ops/context'
import { MyProjectModule } from '@/components/site-ops/modules/my-project'
import { DataEntryModule } from '@/components/site-ops/modules/data-entry'
import { EvidenceModule } from '@/components/site-ops/modules/evidence'
import { SubmissionsModule } from '@/components/site-ops/modules/submissions'
import { BrsrModule } from '@/components/site-ops/modules/brsr'
import { ReportsModule } from '@/components/site-ops/modules/reports'
import { AnalyticsModule } from '@/components/site-ops/modules/analytics'
import { AuditModule } from '@/components/site-ops/modules/audit'
import { TeamModule } from '@/components/site-ops/modules/team'
import { HrWorkspace } from '@/components/site-ops/modules/hr-workspace'
import { EhsWorkspace } from '@/components/site-ops/modules/ehs-workspace'
import { ProcurementWorkspace } from '@/components/site-ops/modules/procurement-workspace'
import { CsrWorkspace } from '@/components/site-ops/modules/csr-workspace'
import { ComplianceWorkspace } from '@/components/site-ops/modules/compliance-workspace'
import { EsgAnalystWorkspace } from '@/components/site-ops/modules/esg-analyst-workspace'
import { FinanceWorkspace } from '@/components/site-ops/modules/finance-workspace'

export function ModuleRouter() {
  const { activeModule, dataEntrySubModule } = useApp()
  const m = activeModule
  switch (m) {
    // Finance & Resource Data Contributor workspace
    case 'fin-assignments':
    case 'fin-data':
    case 'fin-expenditure':
    case 'fin-evidence':
    case 'fin-submissions':
    case 'fin-reports':
    case 'fin-activity':
      return <FinanceWorkspace />
    // Shared modules
    case 'my-project': return <MyProjectModule />
    case 'data-entry': return <DataEntryModule subModule={dataEntrySubModule} />
    case 'evidence': return <EvidenceModule />
    case 'submissions': return <SubmissionsModule />
    case 'brsr': return <BrsrModule />
    case 'reports': return <ReportsModule />
    case 'analytics': return <AnalyticsModule />
    case 'audit': return <AuditModule />
    case 'team': return <TeamModule />
    // HR workspace
    case 'hr-workforce': case 'hr-training': case 'hr-wellbeing': case 'hr-rights':
      return <HrWorkspace />
    // EHS workspace
    case 'ehs-ops': case 'ehs-incidents': case 'ehs-inspections': case 'ehs-corrective': case 'ehs-environmental': case 'ehs-training':
      return <EhsWorkspace />
    // Procurement workspace
    case 'proc-suppliers': case 'proc-assessments': case 'proc-sourcing': case 'proc-transactions': case 'proc-valuechain':
      return <ProcurementWorkspace />
    // CSR workspace
    case 'csr-projects': case 'csr-budgets': case 'csr-beneficiaries': case 'csr-impact': case 'csr-community': case 'csr-local':
      return <CsrWorkspace />
    // Compliance workspace
    case 'comp-policies': case 'comp-obligations': case 'comp-controls': case 'comp-cases': case 'comp-ethics': case 'comp-calendar':
      return <ComplianceWorkspace />
    // ESG Analyst workspace
    case 'ana-explorer': case 'ana-metrics': case 'ana-emissions': case 'ana-energy': case 'ana-social': case 'ana-governance': case 'ana-variance': case 'ana-quality':
      return <EsgAnalystWorkspace />
    default: return <DataEntryModule subModule={dataEntrySubModule} />
  }
}
