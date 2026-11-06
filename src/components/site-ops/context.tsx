'use client'
/**
 * Site Operations portal — app-state context.
 *
 * Adapted from the standalone ZIP project's `src/lib/auth-context.tsx`:
 * authentication is owned by the parent platform gateway, so this context no
 * longer performs login/logout network calls. The verified platform session is
 * passed in as `sessionUser` (from `src/app/page.tsx`) and mirrored into the
 * ZIP-style `SessionUser` shape the ported components expect.
 *
 * The server (`src/lib/so/session.ts` + `/api/so/*` routes) remains the
 * security boundary; this context only mirrors who is signed in and which app
 * module is active (single-route SPA).
 */
import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

/* Session payload handed over by the parent platform gateway (src/app/page.tsx). */
export interface ShellSessionUser {
  id: string
  employeeId: string
  name: string
  email: string
  /** Platform role key, e.g. ENV_DATA_USER | FIN_RESOURCE_USER | EHS_USER | … */
  role: string
  /** Human role label from the platform session. */
  roleLabel: string
  subsidiary: { id: string; code: string; name: string } | null
  businessUnit: { id: string; code: string; name: string; subsidiaryId: string } | null
  project: { id: string; code: string; name: string } | null
}

export interface SessionUser {
  id: string
  email: string
  name: string
  employeeCode: string | null
  groupId: string | null
  demo: boolean
  roles: { key: string; name: string; phase: number }[]
  scopes: { scopeType: string; scopeId: string }[]
}

export type ModuleKey =
  | 'overview' | 'my-project' | 'data-entry' | 'evidence'
  | 'submissions' | 'analytics' | 'audit' | 'brsr' | 'team'
  | 'hr-workforce' | 'hr-training' | 'hr-wellbeing' | 'hr-rights'
  | 'ehs-ops' | 'ehs-incidents' | 'ehs-inspections' | 'ehs-corrective' | 'ehs-environmental' | 'ehs-training'
  | 'proc-suppliers' | 'proc-assessments' | 'proc-sourcing' | 'proc-transactions' | 'proc-valuechain'
  | 'csr-projects' | 'csr-budgets' | 'csr-beneficiaries' | 'csr-impact' | 'csr-community' | 'csr-local'
  | 'comp-policies' | 'comp-obligations' | 'comp-controls' | 'comp-cases' | 'comp-ethics' | 'comp-calendar'
  | 'ana-explorer' | 'ana-metrics' | 'ana-emissions' | 'ana-energy' | 'ana-social' | 'ana-governance' | 'ana-variance' | 'ana-quality'
  | 'fin-assignments' | 'fin-data' | 'fin-expenditure' | 'fin-evidence' | 'fin-submissions' | 'fin-reports' | 'fin-activity'

interface AppState {
  user: SessionUser | null
  loading: boolean
  activeModule: ModuleKey
  dataEntrySubModule: string
  selectedBuId: string
  selectedProjectId: string
  setActiveModule: (m: ModuleKey) => void
  setDataEntrySubModule: (s: string) => void
  setSelectedBuId: (b: string) => void
  setSelectedProjectId: (p: string) => void
  refreshUser: () => Promise<void>
  logout: () => Promise<void>
}

const Ctx = createContext<AppState | null>(null)

/** Platform role → ZIP role key (must mirror src/lib/so/session.ts mapping). */
export function platformRoleToZipRole(platformRole: string): string {
  switch (platformRole) {
    case 'ENV_DATA_USER':
      return 'PROJECT_USER'
    case 'FIN_RESOURCE_USER':
      return 'FINANCE_USER'
    default:
      // HR_USER, EHS_USER, PROCUREMENT_USER, CSR_USER, COMPLIANCE_USER, ESG_ANALYST map to themselves.
      return platformRole
  }
}

/** Build the ZIP-style session user from the platform gateway payload. */
function buildSessionUser(su: ShellSessionUser): SessionUser {
  const scopes: { scopeType: string; scopeId: string }[] = [{ scopeType: 'GROUP', scopeId: 'MEIL-GROUP' }]
  if (su.subsidiary) scopes.push({ scopeType: 'SUBSIDIARY', scopeId: su.subsidiary.id })
  if (su.businessUnit) scopes.push({ scopeType: 'BUSINESS_UNIT', scopeId: su.businessUnit.id })
  if (su.project) scopes.push({ scopeType: 'PROJECT', scopeId: su.project.id })

  return {
    id: su.id,
    email: su.email,
    name: su.name,
    employeeCode: su.employeeId ?? null,
    groupId: 'MEIL-GROUP',
    demo: false,
    roles: [{ key: platformRoleToZipRole(su.role), name: su.roleLabel, phase: 1 }],
    scopes,
  }
}

export function AppProvider({
  sessionUser,
  onSignOut,
  children,
}: {
  sessionUser: ShellSessionUser
  onSignOut: () => void | Promise<void>
  children: ReactNode
}) {
  const [user] = useState<SessionUser>(() => buildSessionUser(sessionUser))
  const [activeModule, setActiveModule] = useState<ModuleKey>('overview')
  const [dataEntrySubModule, setDataEntrySubModule] = useState('energy')
  const [selectedBuId, setSelectedBuIdState] = useState<string>(() => {
    try {
      if (typeof window !== 'undefined') {
        const savedBu = localStorage.getItem('meil_pu_selected_bu_id')
        if (savedBu) return savedBu
      }
    } catch { /* environments without localStorage */ }
    return ''
  })
  const [selectedProjectId, setSelectedProjectIdState] = useState<string>(() => {
    try {
      if (typeof window !== 'undefined') {
        const savedProj = localStorage.getItem('meil_pu_selected_project_id')
        if (savedProj) return savedProj
      }
    } catch { /* environments without localStorage */ }
    /* fall back to the session user's assigned project */
    return sessionUser.project?.id ?? ''
  })

  const setSelectedBuId = useCallback((id: string) => {
    setSelectedBuIdState(id)
    try { localStorage.setItem('meil_pu_selected_bu_id', id) } catch {}
  }, [])

  const setSelectedProjectId = useCallback((id: string) => {
    setSelectedProjectIdState(id)
    try { localStorage.setItem('meil_pu_selected_project_id', id) } catch {}
  }, [])

  /* The platform gateway owns the session — nothing to refresh client-side. */
  const refreshUser = useCallback(async () => {
    /* no-op: session is supplied by the platform and re-verified server-side */
  }, [])

  const logout = useCallback(async () => {
    await onSignOut()
    setActiveModule('overview')
  }, [onSignOut])

  return (
    <Ctx.Provider value={{
      user, loading: false, activeModule, dataEntrySubModule, selectedBuId, selectedProjectId,
      setActiveModule, setDataEntrySubModule, setSelectedBuId, setSelectedProjectId,
      refreshUser, logout
    }}>
      {children}
    </Ctx.Provider>
  )
}

export function useApp() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
