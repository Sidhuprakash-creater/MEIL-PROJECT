'use client'

import { createContext, useContext } from 'react'
import { Zap, Droplet, Recycle, Users, Flame, FileCheck2, Sparkles, type LucideIcon } from 'lucide-react'

/* ---------- Level & Submodule Definitions ---------- */

export type LevelKey =
  | 'level1'
  | 'level2'
  | 'level3'
  | 'level4'
  | 'level5'
  | 'level6'
  | 'level7'
  | 'level8'
  | 'level9'

export interface LevelConfig {
  key: LevelKey
  level: number
  label: string
  brsrTitle: string
  brsrFocus: string
  icon: LucideIcon
  moduleKey: string
  recordType: string
  permission: string
  badgeColor: string
  systemLogic: string
}

export const SUB_MODULES: LevelConfig[] = [
  {
    key: 'level1',
    level: 1,
    label: 'Energy',
    brsrTitle: 'Level 1 — Energy Consumption',
    brsrFocus: 'Energy consumption and energy-source reporting',
    icon: Zap,
    moduleKey: 'ENERGY',
    recordType: 'ENERGY',
    permission: 'esg.energy.write',
    badgeColor: 'from-amber-500 to-yellow-600',
    systemLogic:
      'Keep electricity, fuel and other energy records separate. Prevent double counting and reconcile fuel purchases with consumption where stock records are used.',
  },
  {
    key: 'level2',
    level: 2,
    label: 'Water',
    brsrTitle: 'Level 2 — Water Management',
    brsrFocus: 'Water withdrawal, consumption, recycling/reuse and discharge',
    icon: Droplet,
    moduleKey: 'WATER',
    recordType: 'WATER',
    permission: 'esg.water.write',
    badgeColor: 'from-cyan-500 to-blue-600',
    systemLogic:
      'Withdrawal, consumption, reuse and discharge must be stored as different measurements. Do not assume they are equal.',
  },
  {
    key: 'level3',
    level: 3,
    label: 'GHG & Air',
    brsrTitle: 'Level 3 — GHG Emissions & Air Quality',
    brsrFocus: 'Scope 1, Scope 2 and applicable air-pollution data',
    icon: Flame,
    moduleKey: 'EMISSIONS',
    recordType: 'EMISSIONS',
    permission: 'esg.energy.write',
    badgeColor: 'from-violet-500 to-indigo-600',
    systemLogic:
      'Site Users supply activity data and measured results. The central ESG calculation process applies approved emission factors and retains the calculation trail.',
  },
  {
    key: 'level4',
    level: 4,
    label: 'Waste',
    brsrTitle: 'Level 4 — Waste Management',
    brsrFocus: 'Waste generated, recovered, recycled and disposed',
    icon: Recycle,
    moduleKey: 'WASTE',
    recordType: 'WASTE',
    permission: 'esg.waste.write',
    badgeColor: 'from-emerald-500 to-teal-600',
    systemLogic:
      'Reconcile generated waste against reused, recycled, recovered and disposed quantities. Allow valid stock movements or documented differences where relevant.',
  },
  {
    key: 'level7',
    level: 5,
    label: 'Permits & Compliance',
    brsrTitle: 'Level 5 — Environmental Permits & Compliance',
    brsrFocus: 'Applicable environmental authorizations, monitoring and compliance issues',
    icon: FileCheck2,
    moduleKey: 'COMPLIANCE',
    recordType: 'COMPLIANCE',
    permission: 'esg.compliance.write',
    badgeColor: 'from-teal-500 to-emerald-600',
    systemLogic:
      "Show only permits and compliance questions relevant to the assigned site's activities and jurisdiction.",
  },
  {
    key: 'level9',
    level: 6,
    label: 'Environmental Initiatives',
    brsrTitle: 'Level 6 — Environmental Initiatives',
    brsrFocus: 'Resource-efficiency initiatives, capital improvements and measured outcomes',
    icon: Sparkles,
    moduleKey: 'INITIATIVES',
    recordType: 'INITIATIVES',
    permission: 'esg.energy.write',
    badgeColor: 'from-blue-500 to-cyan-600',
    systemLogic:
      'Do not treat planned savings as achieved savings. Keep targets, estimates and measured outcomes separate.',
  },
]

// Backwards-compatible mapping for submodule queries

export function normalizeSubModule(prop?: string): LevelKey {
  if (!prop) return 'level1'
  if (prop === 'energy') return 'level1'
  if (prop === 'water') return 'level2'
  if (prop === 'travel' || prop === 'ghg' || prop === 'air') return 'level3'
  if (prop === 'waste') return 'level4'
  if (prop === 'permits' || prop === 'compliance' || prop === 'environmental-permits') return 'level7'
  if (prop === 'initiatives' || prop === 'environmental-initiatives') return 'level9'
  const matched = SUB_MODULES.find((m) => m.key === prop)
  return matched ? matched.key : 'level1'
}

/* ---------- Interfaces ---------- */

export interface Project {
  id: string
  projectCode: string
  projectName: string
  location: string | null
  buName: string
  subsidiaryCode: string
  groupCode: string
}

export interface Period {
  id: string
  label: string
  year: number
  month: number | null
  status: string
}

export interface EvidenceItem {
  id: string
  fileName: string
  documentType: string
  status: string
  module?: string | null
  fileSize?: number | null
  mimeType?: string | null
  createdAt?: string | null
  hash?: string | null
  filePath?: string | null
  uploader?: {
    name?: string | null
    email?: string | null
    employeeCode?: string | null
  } | null
}

export interface ValidationIssue {
  ruleCode: string
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'BLOCKING'
  message: string
  field?: string | null
  suggestedAction?: string | null
}

export interface CalcPayload {
  calculatedValue: number
  resultUnit: string
  scope?: string | null
  factorId?: string | null
  factorVersion?: number | null
  methodologyNote?: string | null
  normalizedValue?: number | null
  normalizedUnit?: string | null
  sourceValue?: number
  sourceUnit?: string
  derivedLtifr?: number | null
}

export interface SavedRecord {
  id: string
  recordType: string
  module: string
  level: number
  issues: ValidationIssue[]
  calculation: CalcPayload | null
  derivedLtifr?: number | null
  validationStatus?: string
  evidenceId?: string | null
  evidenceIds?: string[]
  data?: Record<string, any>
  status?: string
  /**
   * Set by the server when the same logical record was already captured with
   * identical values. The record IS saved — this is a warning the user
   * acknowledges, not a rejection.
   */
  duplicateRecord?: {
    id: string
    levelName?: string | null
    enteredBy?: string | null
    enteredAt?: string | null
    message: string
  } | null
}

// Read-only viewer roles (reviewers / auditors) — currently removed;
// add their keys back here when those users are re-introduced.

export const READ_ONLY_ROLES = new Set<string>([])

export const STEPS = ['Enter Data', 'Attach Evidence', 'Draft', 'Organize', 'Submit'] as const

/* ---------------- Console-agnostic API base ----------------
 * index.tsx provides the console surface ('/api/pu' or '/api/so') via
 * its `apiBase` prop; nested components consume it with useApiBase().
 * ---------------------------------------------------------------- */
export const ApiBaseContext = createContext<string>('/api/pu')

export function useApiBase(): string {
  return useContext(ApiBaseContext)
}

/** Robust project matcher across CUIDs, codes (case-insensitive), slugs, and names */
export function matchProject<T extends { id: string; projectCode?: string; projectName?: string }>(
  projects: T[],
  targetIdOrCode?: string | null
): T | null {
  if (!targetIdOrCode || !projects?.length) return null
  const clean = targetIdOrCode.trim().toLowerCase()
  const alpha = clean.replace(/[^a-z0-9]/g, '')
  if (!clean) return null

  // 1. Direct ID match
  const byId = projects.find((p) => p.id === targetIdOrCode || p.id.toLowerCase() === clean)
  if (byId) return byId

  // 2. Exact code match (case-insensitive)
  const byCode = projects.find((p) => p.projectCode?.toLowerCase() === clean)
  if (byCode) return byCode

  // 3. Alphanumeric code match (e.g. 'prj-klip' vs 'PRJ-KLIP' or 'prjklip')
  if (alpha) {
    const byCleanCode = projects.find(
      (p) => (p.projectCode || '').toLowerCase().replace(/[^a-z0-9]/g, '') === alpha
    )
    if (byCleanCode) return byCleanCode
  }

  // 4. Exact name match (case-insensitive)
  const byName = projects.find((p) => p.projectName?.toLowerCase() === clean)
  if (byName) return byName

  // 5. Fuzzy match on code or name
  if (alpha) {
    const byFuzzy = projects.find((p) => {
      const pCode = (p.projectCode || '').toLowerCase().replace(/[^a-z0-9]/g, '')
      const pName = (p.projectName || '').toLowerCase().replace(/[^a-z0-9]/g, '')
      return (
        (pCode && (pCode.includes(alpha) || alpha.includes(pCode))) ||
        (pName && (pName.includes(alpha) || alpha.includes(pName)))
      )
    })
    if (byFuzzy) return byFuzzy
  }

  return null
}
