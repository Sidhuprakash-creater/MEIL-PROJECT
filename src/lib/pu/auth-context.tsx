'use client'
/**
 * Auth + app-state context. Client-side mirror of the server session.
 * The server remains the security boundary; this only mirrors who is logged in
 * and which app module is active (single-route SPA).
 */
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'

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
  | 'submissions' | 'reports' | 'analytics' | 'audit' | 'brsr' | 'team'
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
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => Promise<void>
}

const Ctx = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeModule, setActiveModule] = useState<ModuleKey>('overview')
  const [dataEntrySubModule, setDataEntrySubModule] = useState('energy')
  const [selectedBuId, setSelectedBuIdState] = useState<string>('bu-transportation')
  const [selectedProjectId, setSelectedProjectIdState] = useState<string>('trans-01')

  useEffect(() => {
    try {
      const savedBu = localStorage.getItem('meil_selected_bu_id')
      if (savedBu) setSelectedBuIdState(savedBu)
      const savedProj = localStorage.getItem('meil_selected_project_id')
      if (savedProj) setSelectedProjectIdState(savedProj)
    } catch {
      // ignore in environments without localStorage
    }
  }, [])

  const setSelectedBuId = useCallback((id: string) => {
    setSelectedBuIdState(id)
    try { localStorage.setItem('meil_selected_bu_id', id) } catch {}
  }, [])

  const setSelectedProjectId = useCallback((id: string) => {
    setSelectedProjectIdState(id)
    try { localStorage.setItem('meil_selected_project_id', id) } catch {}
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch('/api/pu/auth/me')
      const data = await res.json()
      setUser(data.user ?? null)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refreshUser() }, [refreshUser])

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/pu/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { ok: false, error: d.error || 'Login failed' }
    }
    if (d && d.id) {
      setUser(d)
    } else {
      await refreshUser()
    }
    return { ok: true }
  }, [refreshUser])

  const logout = useCallback(async () => {
    await fetch('/api/pu/auth/logout', { method: 'POST' })
    setUser(null)
    setActiveModule('overview')
  }, [])

  return (
    <Ctx.Provider value={{
      user, loading, activeModule, dataEntrySubModule, selectedBuId, selectedProjectId,
      setActiveModule, setDataEntrySubModule, setSelectedBuId, setSelectedProjectId,
      refreshUser, login, logout
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
