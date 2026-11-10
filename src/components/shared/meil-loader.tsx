'use client'

/**
 * MEIL ESG — Role-Aware Loader System (@loading-ui/dual-arc & @loading-ui/ring)
 *
 * Replaces the legacy SVG orbit loader across all portals while giving each user
 * role its tailored loader style, palette, and animation pacing:
 *   - Primary screen / block loaders default to <DualArc /> (or <Ring /> for
 *     audit, review, and analytical contributor roles).
 *   - Compact inline / button / status-pill loaders use <Ring /> (<InlineLoader />).
 *   - Consoles wrap <LoaderRoleProvider role={...}> at their shell root so every
 *     nested loader automatically adapts to the signed-in user's role.
 */

import { AnimatePresence, motion } from 'framer-motion'
import { createContext, useContext, useEffect, type CSSProperties, type ReactNode } from 'react'
import { DualArc } from '@/components/dual-arc'
import { Ring } from '@/components/ring'
import { cn } from '@/lib/utils'

export type LoaderVariant = 'dual-arc' | 'ring'

export interface RoleLoaderProfile {
  variant: LoaderVariant
  colorClass: string
  lightColorClass: string
  pillClass: string
  duration: string
  badgeLabel: string
}

const DEFAULT_PROFILE: RoleLoaderProfile = {
  variant: 'dual-arc',
  colorClass: 'text-blue-600',
  lightColorClass: 'text-sky-400',
  pillClass: 'border-blue-200/80 bg-blue-50/90 text-blue-700',
  duration: '1s',
  badgeLabel: 'MEIL ESG',
}

export const ROLE_LOADER_PROFILES: Record<string, RoleLoaderProfile> = {
  GROUP_ADMIN: {
    variant: 'dual-arc',
    colorClass: 'text-[#3a7bff]',
    lightColorClass: 'text-sky-300',
    pillClass: 'border-blue-200/80 bg-blue-50/90 text-[#2354c7]',
    duration: '0.95s',
    badgeLabel: 'Group Command',
  },
  ORG_MANAGER: {
    variant: 'dual-arc',
    colorClass: 'text-[#3a7bff]',
    lightColorClass: 'text-sky-300',
    pillClass: 'border-blue-200/80 bg-blue-50/90 text-[#2354c7]',
    duration: '0.95s',
    badgeLabel: 'Org Command',
  },
  SUBSIDIARY_ADMIN: {
    variant: 'dual-arc',
    colorClass: 'text-emerald-600',
    lightColorClass: 'text-emerald-300',
    pillClass: 'border-emerald-200/80 bg-emerald-50/90 text-emerald-700',
    duration: '1s',
    badgeLabel: 'Subsidiary Admin',
  },
  SUBSIDIARY_MANAGER: {
    variant: 'ring',
    colorClass: 'text-[#7c5cff]',
    lightColorClass: 'text-violet-300',
    pillClass: 'border-violet-200/80 bg-violet-50/90 text-[#5b3fd9]',
    duration: '0.9s',
    badgeLabel: 'Subsidiary Review',
  },
  BU_ADMIN: {
    variant: 'dual-arc',
    colorClass: 'text-sky-600',
    lightColorClass: 'text-sky-300',
    pillClass: 'border-sky-200/80 bg-sky-50/90 text-sky-700',
    duration: '1s',
    badgeLabel: 'BU Operations',
  },
  BU_MANAGER: {
    variant: 'ring',
    colorClass: 'text-violet-600',
    lightColorClass: 'text-violet-300',
    pillClass: 'border-violet-200/80 bg-violet-50/90 text-violet-700',
    duration: '0.9s',
    badgeLabel: 'BU Review',
  },
  PROJECT_ADMIN: {
    variant: 'dual-arc',
    colorClass: 'text-[#315CFF]',
    lightColorClass: 'text-indigo-300',
    pillClass: 'border-indigo-200/80 bg-indigo-50/90 text-[#315CFF]',
    duration: '0.95s',
    badgeLabel: 'Project Command',
  },
  PROJECT_USER: {
    variant: 'dual-arc',
    colorClass: 'text-sky-600',
    lightColorClass: 'text-sky-300',
    pillClass: 'border-sky-200/80 bg-sky-50/90 text-sky-700',
    duration: '1s',
    badgeLabel: 'Site Data Entry',
  },
  ENV_DATA_USER: {
    variant: 'dual-arc',
    colorClass: 'text-sky-600',
    lightColorClass: 'text-sky-300',
    pillClass: 'border-sky-200/80 bg-sky-50/90 text-sky-700',
    duration: '1s',
    badgeLabel: 'Site Data Entry',
  },
  FINANCE_USER: {
    variant: 'ring',
    colorClass: 'text-indigo-600',
    lightColorClass: 'text-indigo-300',
    pillClass: 'border-indigo-200/80 bg-indigo-50/90 text-indigo-700',
    duration: '0.95s',
    badgeLabel: 'Finance & CapEx',
  },
  FIN_RESOURCE_USER: {
    variant: 'ring',
    colorClass: 'text-indigo-600',
    lightColorClass: 'text-indigo-300',
    pillClass: 'border-indigo-200/80 bg-indigo-50/90 text-indigo-700',
    duration: '0.95s',
    badgeLabel: 'Finance & CapEx',
  },
  HR_USER: {
    variant: 'dual-arc',
    colorClass: 'text-fuchsia-600',
    lightColorClass: 'text-fuchsia-300',
    pillClass: 'border-fuchsia-200/80 bg-fuchsia-50/90 text-fuchsia-700',
    duration: '1.05s',
    badgeLabel: 'HR & Workforce',
  },
  EHS_USER: {
    variant: 'dual-arc',
    colorClass: 'text-amber-600',
    lightColorClass: 'text-amber-300',
    pillClass: 'border-amber-200/80 bg-amber-50/90 text-amber-700',
    duration: '0.9s',
    badgeLabel: 'EHS & Safety',
  },
  PROCUREMENT_USER: {
    variant: 'ring',
    colorClass: 'text-teal-600',
    lightColorClass: 'text-teal-300',
    pillClass: 'border-teal-200/80 bg-teal-50/90 text-teal-700',
    duration: '0.95s',
    badgeLabel: 'Procurement',
  },
  CSR_USER: {
    variant: 'dual-arc',
    colorClass: 'text-emerald-600',
    lightColorClass: 'text-emerald-300',
    pillClass: 'border-emerald-200/80 bg-emerald-50/90 text-emerald-700',
    duration: '1.05s',
    badgeLabel: 'CSR & Impact',
  },
  COMPLIANCE_USER: {
    variant: 'ring',
    colorClass: 'text-violet-600',
    lightColorClass: 'text-violet-300',
    pillClass: 'border-violet-200/80 bg-violet-50/90 text-violet-700',
    duration: '0.95s',
    badgeLabel: 'Compliance',
  },
  ESG_ANALYST: {
    variant: 'ring',
    colorClass: 'text-cyan-600',
    lightColorClass: 'text-cyan-300',
    pillClass: 'border-cyan-200/80 bg-cyan-50/90 text-cyan-700',
    duration: '0.85s',
    badgeLabel: 'ESG Analytics',
  },
}

const LoaderRoleContext = createContext<string | undefined>(undefined)

export function LoaderRoleProvider({ role, children }: { role?: string | null; children: ReactNode }) {
  const normalized = role ? role.toUpperCase() : undefined
  return <LoaderRoleContext.Provider value={normalized}>{children}</LoaderRoleContext.Provider>
}

export function resolveRoleLoaderProfile(role?: string | null): RoleLoaderProfile {
  if (!role) return DEFAULT_PROFILE
  return ROLE_LOADER_PROFILES[role.toUpperCase()] ?? DEFAULT_PROFILE
}

/**
 * Compact inline spinner backed by @loading-ui/ring (for buttons, toolbars, tabs, badges).
 */
export function InlineLoader({
  role,
  variant = 'ring',
  className,
  duration,
}: {
  role?: string | null
  variant?: LoaderVariant
  className?: string
  duration?: string
}) {
  const ctxRole = useContext(LoaderRoleContext)
  const profile = resolveRoleLoaderProfile(role ?? ctxRole)
  const animDuration = duration ?? profile.duration
  const style = { '--duration': animDuration } as CSSProperties

  if (variant === 'dual-arc') {
    return <DualArc className={cn('size-4 border-2 shrink-0', profile.colorClass, className)} style={style} />
  }
  return <Ring className={cn('size-4 shrink-0', profile.colorClass, className)} style={style} />
}

/**
 * Main loader visual — uses <DualArc /> or role-assigned <Ring /> cleanly.
 */
export function MeilLoader({
  size = 64,
  label = 'Loading data…',
  tone = 'dark',
  className = '',
  variant,
  role,
  compact = false,
}: {
  /** Rendered diameter in px. */
  size?: number
  /** Caption under or beside the loader. */
  label?: string
  /** 'dark' = for light glass screens, 'light' = on dark backdrops. */
  tone?: 'dark' | 'light'
  className?: string
  /** Explicit override ('dual-arc' or 'ring'). Defaults to the user's role loader profile. */
  variant?: LoaderVariant
  /** Optional role key (e.g. 'EHS_USER', 'BU_MANAGER'). Auto-read from LoaderRoleProvider if omitted. */
  role?: string | null
  /** Horizontal compact layout for portal dynamic splash cards. */
  compact?: boolean
}) {
  const ctxRole = useContext(LoaderRoleContext)
  const resolvedRole = role ?? ctxRole
  const profile = resolveRoleLoaderProfile(resolvedRole)
  const activeVariant = variant ?? profile.variant
  const activeColor = tone === 'light' ? profile.lightColorClass : profile.colorClass
  const textColor = tone === 'dark' ? 'text-slate-600' : 'text-slate-200'
  const borderWidth = Math.max(3, Math.round(size * 0.08))
  const durationStyle = { width: size, height: size, '--duration': profile.duration } as CSSProperties

  const spinnerNode = (
    <div className="relative flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      {activeVariant === 'ring' ? (
        <>
          <Ring className={cn('size-full', activeColor)} style={durationStyle} />
          {size >= 48 && (
            <DualArc
              className={cn('pointer-events-none absolute border-2 opacity-25', activeColor)}
              style={{ width: Math.round(size * 0.56), height: Math.round(size * 0.56), '--duration': '1.6s' } as CSSProperties}
            />
          )}
        </>
      ) : (
        <>
          <DualArc
            className={cn(activeColor)}
            style={{ ...durationStyle, borderWidth }}
          />
          {size >= 48 && (
            <Ring
              className={cn('pointer-events-none absolute opacity-35', activeColor)}
              style={{ width: Math.round(size * 0.5), height: Math.round(size * 0.5), '--duration': '1.6s' } as CSSProperties}
            />
          )}
        </>
      )}
    </div>
  )

  if (compact) {
    return (
      <div className={cn('flex items-center gap-3.5', className)} role="status" aria-live="polite">
        {spinnerNode}
        <div className="flex flex-col gap-0.5">
          {resolvedRole && (
            <span className={cn('inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase', profile.pillClass)}>
              {profile.badgeLabel}
            </span>
          )}
          {label ? <span className={cn('text-xs font-medium', textColor)}>{label}</span> : null}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col items-center justify-center gap-3.5', className)} role="status" aria-live="polite">
      {spinnerNode}
      <div className="flex flex-col items-center gap-1.5">
        {resolvedRole && (
          <span
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase',
              tone === 'light' ? 'border-white/20 bg-white/10 text-slate-200' : profile.pillClass,
            )}
          >
            {profile.badgeLabel}
          </span>
        )}
        {label ? (
          <span className={cn('text-[11px] font-bold tracking-wide uppercase', textColor)}>
            {label}
          </span>
        ) : null}
      </div>
    </div>
  )
}

/** Full-viewport overlay loader — locks body scroll while open. */
export function MeilLoaderOverlay({
  open,
  label = 'Preparing your data…',
  through = false,
  role,
  variant,
}: {
  open: boolean
  label?: string
  /** 'through' = click-through backdrop (for soft refreshes); default blocks. */
  through?: boolean
  role?: string | null
  variant?: LoaderVariant
}) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className={`fixed inset-0 z-[120] flex items-center justify-center ${through ? '' : 'bg-slate-950/45'} backdrop-blur-md`}
        >
          <MeilLoader size={76} label={label} tone="light" role={role} variant={variant} />
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

/** Light inline loader card used inside table bodies / card grids. */
export function MeilBoxLoader({
  boxHeight = 'min-h-[240px]',
  label = 'Loading data…',
  role,
  variant,
}: {
  boxHeight?: string
  label?: string
  role?: string | null
  variant?: LoaderVariant
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className={`flex w-full items-center justify-center ${boxHeight}`}
    >
      <MeilLoader size={56} label={label} role={role} variant={variant} />
    </motion.div>
  )
}
