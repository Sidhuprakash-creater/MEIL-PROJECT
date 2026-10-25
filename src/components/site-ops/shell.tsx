'use client'
/**
 * Site Operations portal shell — integration adapter between the parent
 * platform gateway and the ported site-operations (Project User) console.
 *
 * Contract (consumed by src/app/page.tsx):
 *   <SiteOpsShell sessionUser={...} onSignOut={() => ...} />
 *
 * sessionUser: ShellSessionUser (platform gateway payload — see ./context)
 * onSignOut:   platform sign-out callback (revokes the server session)
 */
import { AppProvider, useApp } from '@/components/site-ops/context'
import { Toaster as SonnerToaster } from '@/components/ui/sonner'
import { AppShell } from '@/components/site-ops/app-shell'
import { SiteUserOverview } from '@/components/site-ops/dashboard/site-user-overview'
import { HrDashboard } from '@/components/site-ops/dashboard/hr-dashboard'
import { EhsDashboard } from '@/components/site-ops/dashboard/ehs-dashboard'
import { ProcurementDashboard } from '@/components/site-ops/dashboard/procurement-dashboard'
import { CsrDashboard } from '@/components/site-ops/dashboard/csr-dashboard'
import { ComplianceDashboard } from '@/components/site-ops/dashboard/compliance-dashboard'
import { EsgAnalystDashboard } from '@/components/site-ops/dashboard/esg-analyst-dashboard'
import { FinanceDashboard } from '@/components/site-ops/dashboard/finance-dashboard'
import { ModuleRouter } from '@/components/site-ops/modules/module-router'
import { ErrorBoundary } from '@/components/site-ops/error-boundary'
import type { ShellSessionUser } from '@/components/site-ops/context'

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
  const { user, activeModule } = useApp()

  /* Auth is owned by the platform gateway — a missing user means the gate
     hasn't handed over a session; render nothing until it does. */
  if (!user) return null

  const roleKey = user?.roles?.[0]?.key ?? ''

  return (
    <AppShell>
      <ErrorBoundary label={activeModule}>
        {activeModule === 'overview' ? getRoleDashboard(roleKey) : <ModuleRouter />}
      </ErrorBoundary>
    </AppShell>
  )
}

export function SiteOpsShell({
  sessionUser,
  onSignOut,
}: {
  sessionUser: ShellSessionUser
  onSignOut: () => void | Promise<void>
}) {
  return (
    <>
      {/* The portal owns its sky background (scoped, does not touch <body>). */}
      <div className="so-sky-bg">
        <AppProvider sessionUser={sessionUser} onSignOut={onSignOut}>
          <ErrorBoundary label="root">
            <Root />
          </ErrorBoundary>
        </AppProvider>
      </div>
      {/* Ported modules emit toasts via sonner's programmatic API. */}
      <SonnerToaster position="top-right" richColors closeButton />
    </>
  )
}

export default SiteOpsShell
