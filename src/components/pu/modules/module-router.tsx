'use client'
import { useApp } from '@/lib/pu/auth-context'
import { MyProjectModule } from '@/components/pu/modules/my-project'
import { DataEntryModule } from '@/components/pu/modules/data-entry'
import { EvidenceModule } from '@/components/pu/modules/evidence'
import { SubmissionsModule } from '@/components/pu/modules/submissions'
import { BrsrModule } from '@/components/pu/modules/brsr'
import { AnalyticsModule } from '@/components/pu/modules/analytics'
import { AuditModule } from '@/components/pu/modules/audit'
import { TeamModule } from '@/components/pu/modules/team'
import { HrWorkspace } from '@/components/pu/modules/hr-workspace'
import { EhsWorkspace } from '@/components/pu/modules/ehs-workspace'
import { ProcurementWorkspace } from '@/components/pu/modules/procurement-workspace'
import { CsrWorkspace } from '@/components/pu/modules/csr-workspace'
import { ComplianceWorkspace } from '@/components/pu/modules/compliance-workspace'
import { EsgAnalystWorkspace } from '@/components/pu/modules/esg-analyst-workspace'
import { FinanceWorkspace } from '@/components/pu/modules/finance-workspace'

export function ModuleRouter() {
  const { activeModule, dataEntrySubModule, user } = useApp()
  const m = activeModule

  /* Role-aware routing: for the HR contributor, the shared Evidence / Submissions
     screens and the (previously unrouted) Activity Log key must open the HR
     workspace's own role-scoped screens — not the platform-wide ENV modules. */
  const roleKeys = (user?.roles ?? []).map((r) => r.key)
  const isHrContributor = roleKeys.includes('HR_USER')
  if (isHrContributor && (m === 'evidence' || m === 'submissions' || m === 'activity')) {
    return <HrWorkspace />
  }
  const isEhsContributor = roleKeys.includes('EHS_USER')
  if (isEhsContributor && (m === 'evidence' || m === 'submissions' || m === 'activity')) {
    return <EhsWorkspace />
  }
  const contributorWorkspaces: Record<string, any> = {
    CSR_USER: CsrWorkspace,
    PROCUREMENT_USER: ProcurementWorkspace,
    COMPLIANCE_USER: ComplianceWorkspace,
  }
  for (const rk of ['CSR_USER', 'PROCUREMENT_USER', 'COMPLIANCE_USER']) {
    if (roleKeys.includes(rk) && (m === 'evidence' || m === 'submissions' || m === 'activity')) {
      const Ws = contributorWorkspaces[rk]
      return <Ws />
    }
  }

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
    case 'analytics': return <AnalyticsModule />
    case 'audit': return <AuditModule />
    case 'team': return <TeamModule />
    // HR workspace
    case 'hr-workforce': case 'hr-diversity': case 'hr-learning': case 'hr-performance': case 'hr-compensation': case 'hr-grievances': case 'hr-human-rights':
    case 'hr-training': case 'hr-wellbeing': case 'hr-rights': // legacy keys still route
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
