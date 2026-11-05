'use client'
/**
 * Data Entry adapter — Project User portal.
 *
 * The shared, provider-agnostic module lives in
 * `@/components/shared/data-entry`; this thin adapter wires the portal
 * context (user, role, active level tab) and the `/api/pu` surface into it.
 */
import { useApp } from '@/lib/pu/auth-context'
import { DataEntryModule as SharedDataEntryModule } from '@/components/shared/data-entry'

export function DataEntryModule({ subModule }: { subModule?: string }) {
  const { user, setDataEntrySubModule, selectedProjectId } = useApp()
  return (
    <SharedDataEntryModule
      subModule={subModule}
      apiBase="/api/pu"
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
