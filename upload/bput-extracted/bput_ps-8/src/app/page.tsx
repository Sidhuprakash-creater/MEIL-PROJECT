'use client'
import { AppProvider, useApp } from '@/lib/auth-context'
import { WelcomeScreen } from '@/components/welcome/welcome-screen'
import { AppShell } from '@/components/shell/app-shell'
import { SiteUserOverview } from '@/components/dashboard/site-user-overview'
import { HrDashboard } from '@/components/dashboard/hr-dashboard'
import { EhsDashboard } from '@/components/dashboard/ehs-dashboard'
import { ProcurementDashboard } from '@/components/dashboard/procurement-dashboard'
import { CsrDashboard } from '@/components/dashboard/csr-dashboard'
import { ComplianceDashboard } from '@/components/dashboard/compliance-dashboard'
import { EsgAnalystDashboard } from '@/components/dashboard/esg-analyst-dashboard'
import { FinanceDashboard } from '@/components/dashboard/finance-dashboard'
import { ModuleRouter } from '@/components/modules/module-router'
import { ErrorBoundary } from '@/components/error-boundary'

// Per-role dashboard mapping — each role gets a UNIQUE dashboard
// with a distinct color theme, layout, and information focus.
function getRoleDashboard(roleKey: string) {
  switch (roleKey) {
    case 'PROJECT_USER': return <SiteUserOverview />
    case 'FINANCE_USER': return <FinanceDashboard />
    case 'HR_USER': return <HrDashboard />
    case 'EHS_USER': return <EhsDashboard />
    case 'PROCUREMENT_USER': return <ProcurementDashboard />
    case 'CSR_USER': return <CsrDashboard />
    case 'COMPLIANCE_USER': return <ComplianceDashboard />
    case 'ESG_ANALYST': return <EsgAnalystDashboard />
    default: return <SiteUserOverview />
  }
}

function Root() {
  const { user, loading, activeModule } = useApp()

  if (loading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center">
        <div className="absolute inset-0 overflow-hidden">
          <div className="orb animate-orb" style={{ width: 360, height: 360, top: '20%', left: '30%', background: 'radial-gradient(circle, rgba(125,181,255,0.5), transparent 70%)' }} />
        </div>
        <div className="glass-strong relative z-10 flex items-center gap-3 rounded-2xl px-6 py-4">
          <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-blue-500" />
          <span className="text-sm font-medium text-slate-600">Loading MEIL ESG…</span>
        </div>
      </div>
    )
  }

  if (!user) return <WelcomeScreen />

  const roleKey = user?.roles?.[0]?.key ?? ''

  return (
    <AppShell>
      <ErrorBoundary label={activeModule}>
        {activeModule === 'overview' ? getRoleDashboard(roleKey) : <ModuleRouter />}
      </ErrorBoundary>
    </AppShell>
  )
}

export default function Page() {
  return (
    <AppProvider>
      <ErrorBoundary label="root">
        <Root />
      </ErrorBoundary>
    </AppProvider>
  )
}
