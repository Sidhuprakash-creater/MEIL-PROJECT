'use client'
/**
 * MEIL ESG Application Shell — premium business theme with iOS liquid so-glass.
 * Role-aware vertical sidebar + horizontal sub-nav. Each role sees a different
 * set of navigation items based on their permissions.
 */
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell, Search, HelpCircle, ChevronDown, LogOut, ShieldCheck,
  Calendar, X, AlertTriangle, AlertOctagon,
  ChevronLeft, ChevronRight, Menu, Sparkles, Zap
} from 'lucide-react'
import { useApp, type ModuleKey } from '@/components/site-ops/context'
import { CommandPalette } from '@/components/site-ops/command-palette'
import { getNavForRole, type NavItem } from '@/lib/so/role-nav'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, activeModule, setActiveModule, logout } = useApp()
  const [profileOpen, setProfileOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  /* Close any open header dropdown on Escape; outside clicks use a document
     mousedown listener (a `fixed inset-0` overlay inside the glass header does
     not cover the viewport: backdrop-filter creates a containing block). */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setProfileOpen(false); setNotifOpen(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => {
    if (!profileOpen && !notifOpen) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null
      if (!t?.closest('[data-menu-root]')) { setProfileOpen(false); setNotifOpen(false) }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [profileOpen, notifOpen])
  const [notifFilter, setNotifFilter] = useState<'all' | 'ERROR' | 'WARNING' | 'INFO'>('all')
  const [search, setSearch] = useState('')
  const [searchTriggered, setSearchTriggered] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [year, setYear] = useState('FY 2026-27')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    fetch('/api/so/notifications').then(r => r.json()).then(d => setNotifications(Array.isArray(d) ? d : (d.items ?? d.notifications ?? []))).catch(() => setNotifications([]))
  }, [])
  const unread = notifications.filter((n: any) => !n.read).length

  const markRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    fetch(`/api/so/notifications/${id}/read`, { method: 'POST' }).catch(() => {})
  }
  const markAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    Promise.all(notifications.filter(n => !n.read).map(n => fetch(`/api/so/notifications/${n.id}/read`, { method: 'POST' }).catch(() => {})))
  }

  const roleKey = user?.roles?.[0]?.key ?? ''
  const roleName = user?.roles?.[0]?.name ?? ''
  const navItems: NavItem[] = getNavForRole(roleKey)

  // Dynamic badge counts from real notifications (not hardcoded)
  const getBadgeCount = (moduleKey: string): number => {
    if (moduleKey === 'evidence') return notifications.filter(n => n.type?.includes('EVIDENCE')).length
    if (moduleKey === 'submissions') return notifications.filter(n => n.type?.includes('SUBMISSION') || n.type?.includes('APPROVAL') || n.type?.includes('CORRECTION')).length
    return 0
  }

  const roleTint: Record<string, string> = {
    PROJECT_USER: 'from-sky-500 to-blue-600',
    FINANCE_USER: 'from-blue-600 via-indigo-600 to-purple-600',
    HR_USER: 'from-cyan-500 to-teal-600',
    EHS_USER: 'from-amber-500 to-orange-600',
    ESG_ANALYST: 'from-emerald-500 to-teal-600',
    PROCUREMENT_USER: 'from-violet-500 to-purple-600',
    CSR_USER: 'from-rose-500 to-pink-600',
    COMPLIANCE_USER: 'from-emerald-500 to-green-600',
  }
  const tint = roleTint[roleKey] ?? 'from-blue-500 to-cyan-600'

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      {/* ambient background */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="so-orb so-animate-so-orb" style={{ width: 380, height: 380, top: -120, right: -60, background: 'radial-gradient(circle, rgba(125,181,255,0.35), transparent 70%)' }} />
        <div className="so-orb so-animate-so-orb" style={{ width: 300, height: 300, bottom: -80, left: -40, background: 'radial-gradient(circle, rgba(170,210,255,0.3), transparent 70%)', animationDelay: '5s' }} />
      </div>

      {/* TOP HEADER */}
      <header className="so-glass-nav sticky top-0 z-50 isolate border-b border-white/40">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-4 md:px-6">
          {/* Mobile menu toggle */}
          <button onClick={() => setMobileNavOpen(true)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-white/60 md:hidden">
            <Menu className="h-4 w-4" />
          </button>

          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-rose-600 to-red-700 text-white shadow-md shadow-rose-600/30">
              <span className="text-sm font-black">M</span>
            </div>
            <div className="hidden leading-none lg:block">
              <div className="text-sm font-bold text-slate-800">meil<span className="text-rose-600">ESG</span></div>
              <div className="text-[9px] font-medium text-slate-500">ESG & BRSR Platform</div>
            </div>
          </div>

          {/* Search — wired to Command Palette */}
          <div className="relative hidden flex-1 max-w-md md:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && search.trim()) { e.preventDefault(); setSearchTriggered(true) } }}
              placeholder="Search projects, submissions, evidence…"
              className="so-glass-subtle w-full rounded-full py-2 pl-9 pr-14 text-sm text-slate-700 outline-none transition focus:ring-2 focus:ring-sky-200"
            />
            <button onClick={() => search.trim() ? setSearchTriggered(true) : setSearchTriggered(true)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-600 transition hover:bg-sky-500/20">
              ⌘K
            </button>
          </div>

          <div className="flex-1 md:hidden" />

          {/* Reporting year */}
          <div className="so-glass-subtle hidden items-center gap-1.5 rounded-full px-3 py-1.5 lg:flex">
            <Calendar className="h-3.5 w-3.5 text-blue-600" />
            <select value={year} onChange={(e) => setYear(e.target.value)} className="bg-transparent text-xs font-semibold text-slate-700 outline-none">
              <option>FY 2026-27</option>
              <option>FY 2025-26</option>
            </select>
          </div>

          {/* Notifications */}
          <div className="relative">
            <button onClick={() => { setNotifOpen(v => !v); setProfileOpen(false) }} className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-white/60 hover:text-blue-600">
              <Bell className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
              {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">{unread}</span>}
            </button>
            <AnimatePresence>
              {notifOpen && (
                <>
                <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                <motion.div initial={{ opacity: 0, y: -8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  className="so-glass-strong absolute right-0 top-12 z-50 w-80 rounded-2xl p-2">
                  <div className="mb-2 flex items-center justify-between border-b border-slate-200/50 px-2 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-700">Notifications</span>
                      {unread > 0 && <span className="status-pill status-submitted">{unread} new</span>}
                    </div>
                    <div className="flex items-center gap-1">
                      {unread > 0 && (
                        <button onClick={() => markAllRead()} className="rounded-full px-2 py-1 text-[10px] font-semibold text-blue-600 transition hover:bg-blue-50">Mark all read</button>
                      )}
                      <button onClick={() => setNotifOpen(false)}><X className="h-3.5 w-3.5 text-slate-400" /></button>
                    </div>
                  </div>
                  <div className="mb-2 flex items-center gap-1 px-1">
                    {(['all', 'ERROR', 'WARNING', 'INFO'] as const).map(f => {
                      const cnt = f === 'all' ? notifications.length : notifications.filter((n: any) => n.severity === f).length
                      const active = notifFilter === f
                      return (
                        <button key={f} onClick={() => setNotifFilter(f)}
                          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition ${active ? 'bg-blue-500 text-white' : 'bg-white/60 text-slate-500 hover:text-slate-700'}`}>
                          {f === 'all' ? 'All' : f === 'ERROR' ? 'Critical' : f === 'WARNING' ? 'Warnings' : 'Info'}
                          <span className="ml-1 tabular-nums opacity-70">{cnt}</span>
                        </button>
                      )
                    })}
                  </div>
                  <div className="max-h-80 space-y-1 overflow-y-auto scroll-elegant">
                    {notifications.filter((n: any) => notifFilter === 'all' || n.severity === notifFilter).length === 0 && <div className="px-3 py-6 text-center text-xs text-slate-400">No notifications</div>}
                    {notifications.filter((n: any) => notifFilter === 'all' || n.severity === notifFilter).map((n: any) => (
                      <button key={n.id} onClick={() => markRead(n.id)}
                        className={`block w-full rounded-xl px-3 py-2 text-left transition hover:bg-white/60 ${n.read ? '' : 'bg-blue-50/60'}`}>
                        <div className="flex items-start gap-2">
                          <div className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md ${n.severity === 'WARNING' ? 'bg-amber-100 text-amber-600' : n.severity === 'ERROR' ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'}`}>
                            {n.severity === 'WARNING' ? <AlertTriangle className="h-3 w-3" /> : n.severity === 'ERROR' ? <AlertOctagon className="h-3 w-3" /> : <Bell className="h-3 w-3" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-xs font-semibold text-slate-700">{n.title}</span>
                              {!n.read && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />}
                            </div>
                            <div className="text-[11px] leading-tight text-slate-500">{n.message}</div>
                            {n.linkEntity && <div className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-blue-500">→ {n.linkEntity}</div>}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Help */}
          <button className="hidden h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-white/60 hover:text-blue-600 md:flex">
            <HelpCircle className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
          </button>

          {/* Profile */}
          <div className="relative" data-menu-root>
            <button onClick={() => { setProfileOpen(v => !v); setNotifOpen(false) }} className="so-glass-subtle flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 transition hover:ring-2 hover:ring-blue-100">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br ${tint} text-[10px] font-bold text-white`}>
                {user?.name?.split(' ').map(n => n[0]).join('') ?? 'U'}
              </div>
              <div className="hidden text-left leading-tight lg:block">
                <div className="text-xs font-semibold text-slate-800">{user?.name}</div>
                <div className="text-[10px] text-slate-500">{roleName}</div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>
            <AnimatePresence>
              {profileOpen && (
                <>
                <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                <motion.div initial={{ opacity: 0, y: -8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  className="so-glass-strong absolute right-0 top-12 z-50 w-64 rounded-2xl p-2">
                  <div className="border-b border-slate-200/60 px-3 py-2.5">
                    <div className="text-sm font-bold text-slate-800">{user?.name}</div>
                    <div className="text-[11px] text-slate-500">{user?.email}</div>
                    {user?.demo && <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700">Illustrative</span>}
                  </div>
                  <div className="py-1">
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Role & Scope</div>
                    <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700"><ShieldCheck className="h-3.5 w-3.5 text-blue-600" /> {roleName}</div>
                  </div>
                  <div className="border-t border-slate-200/60 py-1">
                    <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-rose-600 transition hover:bg-rose-50"><LogOut className="h-3.5 w-3.5" /> Sign out</button>
                  </div>
                </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* BODY: sidebar + content */}
      <div className="relative z-10 mx-auto flex w-full max-w-[1600px] flex-1 gap-0">
        {/* LEFT SIDEBAR — role-aware navigation */}
        <aside className={`${sidebarCollapsed ? 'w-16' : 'w-56'} sticky top-14 hidden h-[calc(100vh-3.5rem)] flex-shrink-0 flex-col border-r border-white/30 py-3 transition-all duration-300 md:flex`}>
          {/* User role card */}
          {!sidebarCollapsed && (
            <div className="mx-3 mb-3 so-glass rounded-xl p-3">
              <div className="flex items-center gap-2.5">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${tint} text-sm font-bold text-white shadow-md`}>
                  {user?.name?.split(' ').map(n => n[0]).join('') ?? 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold text-slate-800">{user?.name}</div>
                  <div className="truncate text-[10px] text-slate-500">{roleName}</div>
                </div>
              </div>
              {user?.demo && (
                <div className="mt-2 flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[9px] font-semibold text-amber-600">
                  <Sparkles className="h-2.5 w-2.5" /> Demo account
                </div>
              )}
            </div>
          )}

          {/* Role-aware nav items */}
          <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto scroll-elegant px-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = activeModule === item.key
              const badgeCount = getBadgeCount(item.key)
              return (
                <button key={item.key} onClick={() => setActiveModule(item.key)}
                  title={item.label}
                  className={`group relative flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${active ? `bg-gradient-to-r ${tint} text-white shadow-md` : 'text-slate-600 hover:bg-white/60 hover:text-slate-800'}`}>
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                  {badgeCount > 0 && !sidebarCollapsed && (
                    <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-bold ${active ? 'bg-white/20 text-white' : item.badgeTone === 'blue' ? 'bg-blue-100 text-blue-700' : item.badgeTone === 'green' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{badgeCount}</span>
                  )}
                  {sidebarCollapsed && badgeCount > 0 && (
                    <span className={`absolute right-1 top-1 h-2 w-2 rounded-full ${item.badgeTone === 'blue' ? 'bg-blue-500' : item.badgeTone === 'green' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  )}
                </button>
              )
            })}
          </nav>

          {/* Collapse toggle */}
          <button onClick={() => setSidebarCollapsed(v => !v)}
            className="mx-2 mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-white/40 px-3 py-2 text-[10px] font-semibold text-slate-500 transition hover:bg-white/60 hover:text-slate-700">
            {sidebarCollapsed ? <ChevronRight className="h-3 w-3" /> : <><ChevronLeft className="h-3 w-3" /> Collapse</>}
          </button>
        </aside>

        {/* MOBILE SIDEBAR (drawer) */}
        <AnimatePresence>
          {mobileNavOpen && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setMobileNavOpen(false)}
                className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-sm md:hidden" />
              <motion.aside initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="so-glass-strong fixed left-0 top-0 z-50 flex h-full w-64 flex-col p-3 md:hidden">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${tint} text-[10px] font-bold text-white`}>
                      {user?.name?.split(' ').map(n => n[0]).join('') ?? 'U'}
                    </div>
                    <div className="text-xs font-bold text-slate-800">{user?.name}</div>
                  </div>
                  <button onClick={() => setMobileNavOpen(false)}><X className="h-4 w-4 text-slate-400" /></button>
                </div>
                <nav className="flex-1 space-y-0.5 overflow-y-auto scroll-elegant">
                  {navItems.map((item) => {
                    const Icon = item.icon
                    const active = activeModule === item.key
                    return (
                      <button key={item.key} onClick={() => { setActiveModule(item.key); setMobileNavOpen(false) }}
                        className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${active ? `bg-gradient-to-r ${tint} text-white` : 'text-slate-600 hover:bg-white/60'}`}>
                        <Icon className="h-4 w-4" /> {item.label}
                      </button>
                    )
                  })}
                </nav>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* MAIN CONTENT */}
        <main className="relative z-10 min-w-0 flex-1 px-4 pb-16 pt-5 md:px-6 md:pb-20 md:pt-6">
          <AnimatePresence mode="wait">
            <motion.div key={activeModule} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <CommandPalette initialQuery={search} openExternally={searchTriggered} onConsumed={() => setSearchTriggered(false)} />
    </div>
  )
}
