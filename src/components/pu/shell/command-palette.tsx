'use client'
/**
 * Command Palette — global Cmd+K / Ctrl+K overlay for the MEIL ESG platform.
 *
 * A premium glass-strong panel providing:
 *   • Module navigation (10 modules with `G <letter>` keyboard hints)
 *   • Quick actions (energy / water capture, BRSR generate, audit trail, data quality)
 *   • Recent projects (live from /api/organization/tree — first 5)
 *
 * Keyboard:
 *   ⌘K / Ctrl+K  → toggle open/close
 *   ↑ / ↓        → move selection (wraps)
 *   Enter        → activate selected item
 *   Esc          → close
 *   Click        → activate clicked item
 *
 * Premium aesthetic: glass-strong + glass-shimmer surface, gradient search-icon tile,
 * staggered entrance, blue glow on the selected row, kbd-style footer hints.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, ArrowRight, LayoutDashboard, Building2, FileText, Link2, Send,
  FileBarChart, TrendingUp, History, FileCheck2, Zap, Droplet,
  Recycle, FileCheck, X, CornerDownLeft, ChevronUp, ChevronDown,
} from 'lucide-react'
import { useApp, type ModuleKey } from '@/lib/pu/auth-context'

/* ------------------------------------------------------------------ types */

type ProjectOption = {
  id: string
  projectCode: string
  projectName: string
  location: string | null
  status: string
}

type GroupKey = 'Navigation' | 'Quick Actions' | 'Recent Projects'

type PaletteItem = {
  id: string
  group: GroupKey
  label: string
  description?: string
  icon: React.ComponentType<{ className?: string }>
  shortcut?: string
  run: () => void
}

/* --------------------------------------------------------------- catalog */

type ModuleEntry = {
  key: ModuleKey
  label: string
  icon: React.ComponentType<{ className?: string }>
  shortcut: string
  desc: string
}

const MODULES: ModuleEntry[] = [
  { key: 'overview',   label: 'Overview',     icon: LayoutDashboard, shortcut: 'G O', desc: 'Group-wide ESG dashboard' },
  { key: 'data-entry', label: 'Data Entry',   icon: FileText,         shortcut: 'G D', desc: 'Capture source data + run engines' },
  { key: 'evidence',   label: 'Evidence',     icon: Link2,            shortcut: 'G E', desc: 'Evidence vault + verification' },
  { key: 'submissions',label: 'Submissions',  icon: Send,             shortcut: 'G S', desc: 'Workflow + approval chain' },
  { key: 'reports',    label: 'Reports',       icon: FileBarChart,     shortcut: 'G R', desc: 'Generate + download reports' },
  { key: 'analytics',  label: 'Analytics',     icon: TrendingUp,       shortcut: 'G A', desc: 'Cross-cutting ESG analytics' },
  { key: 'audit',      label: 'Audit & Trace', icon: History,          shortcut: 'G T', desc: 'Traceability tree across the chain' },
  { key: 'brsr',       label: 'BRSR',          icon: FileCheck2,        shortcut: 'G B', desc: 'BRSR engine + readiness' },
]

type QuickAction = {
  id: string
  label: string
  desc: string
  icon: React.ComponentType<{ className?: string }>
  module: ModuleKey
  sub?: string
}

const QUICK_ACTIONS: QuickAction[] = [
  { id: 'qa-energy',    label: 'Enter new Energy data',   desc: 'Open the Energy capture form',     icon: Zap,        module: 'data-entry', sub: 'energy' },
  { id: 'qa-water',     label: 'Enter new Water data',    desc: 'Open the Water capture form',      icon: Droplet,    module: 'data-entry', sub: 'water' },
  { id: 'qa-brsr-gen',  label: 'Generate BRSR Report',    desc: 'Jump to the BRSR engine',          icon: FileCheck,  module: 'brsr' },
  { id: 'qa-audit',     label: 'View Audit Trail',        desc: 'Open the traceability tree',       icon: History,    module: 'audit' },
  { id: 'qa-quality',   label: 'Check Data Quality',     desc: 'Open the Data Quality Center',     icon: FileBarChart, module: 'overview' },
]

/* --------------------------------------------------------------- component */

export function CommandPalette({ initialQuery, openExternally, onConsumed }: { initialQuery?: string; openExternally?: boolean; onConsumed?: () => void }) {
  const { setActiveModule, setDataEntrySubModule } = useApp()

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [projects, setProjects] = useState<ProjectOption[]>([])

  const inputRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  /* ---- pre-fetch recent projects so the palette opens instantly ---- */
  useEffect(() => {
    let cancelled = false
    fetch('/api/pu/organization/tree')
      .then(r => (r.ok ? r.json() : null))
      .then((data: unknown) => {
        if (cancelled || !data) return
        const root = data as { groups?: Array<{
          subsidiaries?: Array<{
            businessUnits?: Array<{
              projects?: Array<{ id: string; projectCode: string; projectName: string; location: string | null; status: string }>
            }>
          }>
        }> }
        const flat: ProjectOption[] = []
        for (const g of root.groups ?? []) {
          for (const s of g?.subsidiaries ?? []) {
            for (const bu of s?.businessUnits ?? []) {
              for (const p of bu?.projects ?? []) {
                flat.push({
                  id: p.id,
                  projectCode: p.projectCode,
                  projectName: p.projectName,
                  location: p.location,
                  status: p.status,
                })
              }
            }
          }
        }
        if (!cancelled) setProjects(flat.slice(0, 5))
      })
      .catch(() => { /* palette still works without recent projects */ })
    return () => { cancelled = true }
  }, [])

  /* ---- body scroll lock + input focus when palette opens ---- */
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = window.setTimeout(() => inputRef.current?.focus(), 30)
    return () => {
      window.clearTimeout(t)
      document.body.style.overflow = prev
    }
  }, [open])

  /* ---- open externally when triggered from the top search bar ---- */
  useEffect(() => {
    if (!openExternally) return
    // Defer state updates to avoid the set-state-in-effect lint rule
    const timer = setTimeout(() => {
      setQuery(initialQuery || '')
      setOpen(true)
      onConsumed?.()
    }, 0)
    return () => clearTimeout(timer)
  }, [openExternally, initialQuery, onConsumed])

  /* ---- navigation helper ---- */
  const go = useCallback(
    (m: ModuleKey, sub?: string) => {
      setActiveModule(m)
      if (sub) setDataEntrySubModule(sub)
    },
    [setActiveModule, setDataEntrySubModule],
  )

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setSelectedIndex(0)
  }, [])

  /* ---- build the flat, filtered item list ---- */
  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase()
    const match = (s: string) => !q || s.toLowerCase().includes(q)

    const navItems: PaletteItem[] = MODULES
      .filter(m => match(m.label) || match(m.desc))
      .map(m => ({
        id: `nav-${m.key}`,
        group: 'Navigation',
        label: m.label,
        description: m.desc,
        icon: m.icon,
        shortcut: m.shortcut,
        run: () => go(m.key),
      }))

    const qaItems: PaletteItem[] = QUICK_ACTIONS
      .filter(a => match(a.label) || match(a.desc))
      .map(a => ({
        id: a.id,
        group: 'Quick Actions',
        label: a.label,
        description: a.desc,
        icon: a.icon,
        run: () => go(a.module, a.sub),
      }))

    const projItems: PaletteItem[] = projects
      .filter(p =>
        match(p.projectName) ||
        match(p.projectCode) ||
        (p.location ? p.location.toLowerCase().includes(q) : false),
      )
      .map(p => ({
        id: `proj-${p.id}`,
        group: 'Recent Projects',
        label: p.projectName,
        description: `${p.projectCode}${p.location ? ' · ' + p.location : ''}`,
        icon: Building2,
        run: () => go('data-entry'),
      }))

    return [...navItems, ...qaItems, ...projItems]
  }, [query, projects, go])

  /* ---- safe index (clamps + wraps) so we never read out-of-bounds ---- */
  const safeIndex = items.length === 0
    ? 0
    : ((selectedIndex % items.length) + items.length) % items.length

  /* ---- global keyboard: Cmd/Ctrl+K to toggle, arrows/enter/esc inside ---- */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey
      if (isMod && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setOpen(v => !v)
        return
      }
      if (!open) return
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        return
      }
      if (items.length === 0) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => (i + 1) % items.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => (i - 1 + items.length) % items.length)
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const item = items[safeIndex]
        if (item) {
          item.run()
          close()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, items, safeIndex, close])

  /* ---- keep the selected row scrolled into view ---- */
  useEffect(() => {
    if (!open || !listRef.current) return
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${safeIndex}"]`)
    if (el) el.scrollIntoView({ block: 'nearest' })
  }, [safeIndex, open])

  /* ---- group items for display (preserve group order) ---- */
  const groups = useMemo(() => {
    const order: GroupKey[] = ['Navigation', 'Quick Actions', 'Recent Projects']
    return order
      .map(g => ({ group: g, entries: items.filter(i => i.group === g) }))
      .filter(g => g.entries.length > 0)
  }, [items])

  const totalItems = items.length

  /* ---------------------------------------------------------------- render */

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="cp-backdrop"
          className="fixed inset-0 z-[80] flex items-start justify-center p-4 pt-[12vh]"
          style={{
            background: 'rgba(15,23,42,0.3)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) close() }}
        >
          <motion.div
            className="glass-strong glass-shimmer w-full max-w-2xl overflow-hidden rounded-3xl"
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* ----- search input ----- */}
            <div className="relative flex items-center gap-3 border-b border-slate-200/60 p-4">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-md shadow-blue-500/30">
                <Search className="h-4 w-4" />
              </div>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0) }}
                placeholder="Search modules, projects, actions, or jump to…"
                className="flex-1 bg-transparent text-base text-slate-800 outline-none placeholder:text-slate-400"
                aria-label="Command palette search"
                autoComplete="off"
                spellCheck={false}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => { setQuery(''); setSelectedIndex(0); inputRef.current?.focus() }}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-400">esc</kbd>
            </div>

            {/* ----- results ----- */}
            <div ref={listRef} className="max-h-96 overflow-y-auto scroll-elegant p-2">
              {totalItems === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                    <Search className="h-5 w-5" />
                  </div>
                  <div className="text-sm font-semibold text-slate-700">No results found</div>
                  <div className="text-xs text-slate-400">Try a different keyword or module name.</div>
                </div>
              ) : (
                <motion.div
                  variants={{ hidden: {}, show: { transition: { staggerChildren: 0.025 } } }}
                  initial="hidden"
                  animate="show"
                >
                  {groups.map(g => (
                    <div key={g.group} className="mb-2 last:mb-0">
                      <div className="sticky top-0 z-10 bg-white/75 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 backdrop-blur-sm">
                        {g.group}
                      </div>
                      <div className="space-y-0.5">
                        {g.entries.map(item => {
                          const flatIdx = items.findIndex(i => i.id === item.id)
                          const selected = flatIdx === safeIndex
                          const Icon = item.icon
                          return (
                            <motion.button
                              key={item.id}
                              type="button"
                              data-idx={flatIdx}
                              variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }}
                              onMouseMove={() => setSelectedIndex(flatIdx)}
                              onClick={() => { item.run(); close() }}
                              className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                                selected
                                  ? 'bg-blue-50 ring-2 ring-blue-200 shadow-[0_0_0_4px_rgba(59,130,246,0.08)]'
                                  : 'hover:bg-slate-50/80'
                              }`}
                            >
                              <span
                                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition ${
                                  selected
                                    ? 'bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-sm'
                                    : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                                }`}
                              >
                                <Icon className="h-4 w-4" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold text-slate-800">{item.label}</span>
                                {item.description && (
                                  <span className="block truncate text-[11px] text-slate-500">{item.description}</span>
                                )}
                              </span>
                              {item.shortcut && (
                                <kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
                                  {item.shortcut}
                                </kbd>
                              )}
                              {selected && <ArrowRight className="h-4 w-4 text-blue-500" />}
                            </motion.button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </div>

            {/* ----- footer hint bar ----- */}
            <div className="flex items-center justify-between gap-3 border-t border-slate-200/60 bg-white/60 px-4 py-2.5 text-[11px] text-slate-500">
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <kbd className="flex h-5 items-center rounded border border-slate-200 bg-slate-50 px-1 text-[10px] text-slate-500">
                    <ChevronDown className="h-3 w-3" />
                  </kbd>
                  <kbd className="flex h-5 items-center rounded border border-slate-200 bg-slate-50 px-1 text-[10px] text-slate-500">
                    <ChevronUp className="h-3 w-3" />
                  </kbd>
                  navigate
                </span>
                <span className="flex items-center gap-1.5">
                  <kbd className="flex h-5 items-center rounded border border-slate-200 bg-slate-50 px-1 text-[10px] text-slate-500">
                    <CornerDownLeft className="h-3 w-3" />
                  </kbd>
                  select
                </span>
                <span className="flex items-center gap-1.5">
                  <kbd className="flex h-5 items-center rounded border border-slate-200 bg-slate-50 px-1 text-[10px] font-mono text-slate-500">esc</kbd>
                  close
                </span>
              </div>
              <div className="hidden items-center gap-1.5 text-slate-400 sm:flex">
                <Recycle className="h-3 w-3 text-emerald-500" />
                <span className="font-mono">MEIL</span>
                <span>·</span>
                <span>Command Palette</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default CommandPalette
