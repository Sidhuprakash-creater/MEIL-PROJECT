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

export function DataEntryModule({ subModule }: { subModule?: string }) {
  const { user, setDataEntrySubModule, selectedProjectId } = useApp()
  return (
    <SharedDataEntryModule
      subModule={subModule}
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
