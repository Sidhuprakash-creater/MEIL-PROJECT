'use client'
/**
 * Data Entry adapter — Site Operations console.
 *
 * The shared, provider-agnostic module lives in
 * `@/components/shared/data-entry`; this thin adapter wires the site-ops
 * context (user, role, active level tab) and the `/api/so` surface into it.
 * (Previously this console shipped a byte-identical copy of the pu module
 * that imported the *pu* auth context and posted to `/api/pu` — it could
 * only ever render the module ErrorBoundary. The adapter fixes that.)
 */
import { useApp } from '@/components/site-ops/context'
import { DataEntryModule as SharedDataEntryModule } from '@/components/shared/data-entry'

/* Role-appropriate default BRSR level so each contributor's Data Entry opens
   on their own disclosure (env user keeps Energy). */
const ROLE_DEFAULT_LEVEL: Record<string, string> = {
  FINANCE_USER: 'initiatives',
  HR_USER: 'training',
  EHS_USER: 'safety',
  PROCUREMENT_USER: 'initiatives',
  CSR_USER: 'incidents',
  COMPLIANCE_USER: 'compliance',
}

export function DataEntryModule({ subModule }: { subModule?: string }) {
  const { user, setDataEntrySubModule, selectedProjectId } = useApp()
  const roleKey = user?.roles?.[0]?.key ?? ''
  /* Honor an explicit level the user picked; otherwise open the role default. */
  const effectiveSub = subModule && subModule !== 'energy'
    ? subModule
    : ROLE_DEFAULT_LEVEL[roleKey] ?? subModule
  return (
    <SharedDataEntryModule
      subModule={effectiveSub}
      apiBase="/api/so"
      roleKey={user?.roles?.[0]?.key}
      userScopes={user?.scopes}
      appProjectId={selectedProjectId}
      submitter={
        user
          ? {
              name: user.name,
              email: user.email,
              roleLabel: user.roles?.[0]?.name ?? 'Site Data Entry',
            }
          : undefined
      }
      onSubModuleChange={setDataEntrySubModule}
    />
  )
}
