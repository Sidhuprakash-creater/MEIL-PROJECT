'use client'
/**
 * MEIL ESG — High-Intensity iOS Liquid Glass Welcome & Project Selection Platform
 * Design System: design.md + Official MEIL Reference Layout
 * Flow:
 *  1. WELCOME SCREEN (Org & Business Unit Selection + 3D Orbital ESG Diagram + Pillars)
 *  2. PROJECT SELECTION SCREEN (Next screen: BU-related Projects Grid with iOS Liquid Glass)
 *  3. ROLE SELECTION (RBAC roles for chosen site — slides per phase)
 *  4. LOGIN MORPH (Instant demo authentication)
 */

import { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight, ArrowLeft, Building2, Building, Leaf, Users, ShieldCheck,
  ChevronDown, ChevronLeft, ChevronRight, Heart, Check, MapPin, Search, Route, Flame,
  SunMedium, Sun, Zap, Droplets, Waves, Globe, Eye, EyeOff,
  Package, Scale, FileCheck, Crown, Truck, Cpu, Activity, Fuel,
  BarChart3, Compass, ShieldAlert, Wallet
} from 'lucide-react'
import { useApp } from '@/lib/pu/auth-context'
import {
  MEIL_BUSINESS_UNITS,
  MEIL_SUBSIDIARIES,
  MEIL_ORGANIZATIONS,
  type MeilBusinessUnit,
  type MeilProject,
  type MeilSubsidiary,
  getBusinessUnitById,
  getBusinessUnitsBySubsidiary,
} from '@/lib/pu/meil-portfolio'

type Stage = 'welcome' | 'project' | 'role' | 'login'
type RoleCategory = 'all' | 'operations' | 'admin' | 'approvals' | 'governance' | 'leadership'

interface RoleCardDef {
  key: string
  name: string
  email: string
  role: string
  phase: 1 | 2 | 3
  category: 'operations' | 'admin' | 'approvals' | 'governance' | 'leadership'
  icon: typeof Building2
  tint: string
  blurb: string
}

const ROLES: RoleCardDef[] = [
  { key: 'PROJECT_USER', name: 'Rohit Kumar', email: 'rohit@meil-esg.in', role: 'Environment Data User', phase: 1, category: 'operations', icon: Building2, tint: 'from-sky-500 to-blue-600', blurb: 'Site operations & daily ESG metrics' },
  { key: 'FINANCE_USER', name: 'Rakesh Verma', email: 'finance@meil-esg.in', role: 'Finance & Resource Contributor', phase: 1, category: 'operations', icon: Wallet, tint: 'from-blue-600 to-indigo-600', blurb: 'Financial turnover, CapEx/OpEx & resource expenditure collection' },
  { key: 'HR_USER', name: 'Sunita Rao', email: 'sunita@meil-esg.in', role: 'HR User', phase: 1, category: 'operations', icon: Users, tint: 'from-cyan-500 to-teal-600', blurb: 'Human resources & workforce welfare metrics' },
  { key: 'EHS_USER', name: 'K. Venkat', email: 'kvenkat@meil-esg.in', role: 'EHS / Safety User', phase: 1, category: 'operations', icon: ShieldCheck, tint: 'from-amber-500 to-orange-600', blurb: 'Environment, Health & Safety incident reports' },
  { key: 'PROCUREMENT_USER', name: 'Priya Nair', email: 'priya@meil-esg.in', role: 'Procurement User', phase: 1, category: 'operations', icon: Package, tint: 'from-violet-500 to-purple-600', blurb: 'Supply chain sustainability & vendor ESG scores' },
  { key: 'CSR_USER', name: 'Imran Sheikh', email: 'imran@meil-esg.in', role: 'CSR / Community User', phase: 1, category: 'operations', icon: Heart, tint: 'from-rose-500 to-pink-600', blurb: 'Community outreach & CSR initiatives' },
  { key: 'COMPLIANCE_USER', name: 'Deepika Joshi', email: 'deepika@meil-esg.in', role: 'Compliance User', phase: 1, category: 'operations', icon: Scale, tint: 'from-emerald-500 to-green-600', blurb: 'Regulatory reporting & framework compliance' },
  { key: 'PROJECT_ADMIN', name: 'Er. K. Venkataramana', email: 'projectadmin@meil-esg.in', role: 'Project Admin', phase: 2, category: 'admin', icon: ShieldCheck, tint: 'from-blue-600 via-indigo-600 to-purple-700', blurb: 'Site ESG operational command, sign-off authority, delegation & governance control' },
]

// Phase definitions — pages with no roles are hidden automatically,
// so re-adding reviewer / governance roles later restores their slides.
const PHASE_DEFS = [
  { phase: 1 as const, label: 'Phase 1 — Site & Operational Data Entry', shortLabel: 'Phase 1 · Site Data Entry' },
  { phase: 2 as const, label: 'Phase 2 — Project Administration & Site Governance', shortLabel: 'Phase 2 · Project Admin' },
  { phase: 3 as const, label: 'Phase 3 — BRSR Core, Assurance & Analytics', shortLabel: 'Phase 3 · Governance & Leadership' },
]

/* Stable icon lookup — resolved from a module-level map so no component is
   ever created during render (react-hooks/static-components). */
const BU_ICONS: Record<string, typeof Building2> = {
  Route,
  Building2,
  Building,
  Flame,
  SunMedium,
  Sun,
  Zap,
  Droplets,
  Waves,
  Globe,
  Truck,
  Cpu,
  Activity,
  Fuel,
  ShieldCheck,
}

export function WelcomeScreen() {
  const { login, selectedBuId, setSelectedBuId, selectedProjectId, setSelectedProjectId } = useApp()
  const [stage, setStage] = useState<Stage>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('stage')
      if (p === 'welcome' || p === 'project' || p === 'role' || p === 'login') return p as Stage
    }
    return 'welcome' // Full flow on entry: Welcome (Org/BU) → Project → Role → Login
  })

  // Synchronize stage whenever URL parameters update (e.g. on logout redirect to ?portal=project&stage=role)
  useEffect(() => {
    const syncStageFromUrl = () => {
      if (typeof window !== 'undefined') {
        const p = new URLSearchParams(window.location.search).get('stage')
        if (p === 'welcome' || p === 'project' || p === 'role' || p === 'login') {
          setStage(p as Stage)
        }
      }
    }
    syncStageFromUrl()
    window.addEventListener('popstate', syncStageFromUrl)
    return () => window.removeEventListener('popstate', syncStageFromUrl)
  }, [])

  // Subsidiary & Business Unit selection state
  const [selectedOrgId, setSelectedOrgId] = useState<string>('MEIL')
  const [activeBuId, setActiveBuId] = useState<string>(selectedBuId || 'bu-iwen')
  const [activeProjectId, setActiveProjectId] = useState<string>(selectedProjectId || 'prj-klip')

  // Role & login state
  const [selectedRole, setSelectedRole] = useState<RoleCardDef | null>(null)
  const [hoveredRole, setHoveredRole] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('demo')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Current active BU & Project objects
  const currentBu = useMemo(
    () => getBusinessUnitById(activeBuId) || MEIL_BUSINESS_UNITS[0],
    [activeBuId]
  )

  const currentProject = useMemo(() => {
    const list = currentBu.projects
    return list.find(p => p.id === activeProjectId) || list[0]
  }, [currentBu, activeProjectId])

  const handleSelectSub = (subId: string) => {
    setSelectedOrgId(subId)
    const bus = getBusinessUnitsBySubsidiary(subId)
    if (bus.length > 0) {
      handleSelectBu(bus[0].id)
    }
  }

  // Sync to app context whenever selection changes
  const handleSelectBu = (buId: string) => {
    setActiveBuId(buId)
    setSelectedBuId(buId)
    const bu = getBusinessUnitById(buId)
    if (bu && bu.projects.length > 0) {
      setActiveProjectId(bu.projects[0].id)
      setSelectedProjectId(bu.projects[0].id)
    }
  }

  const handleSelectProject = (project: MeilProject) => {
    setActiveProjectId(project.id)
    setSelectedProjectId(project.id)
  }

  const handlePickRole = (role: RoleCardDef) => {
    setSelectedRole(role)
    setEmail(role.email)
    setStage('login')
  }

  const handleSubmitLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const res = await login(email, password)
    setBusy(false)
    if (!res.ok) setError(res.error || 'Invalid credentials')
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#e0f2fe] text-slate-800">
      <BackgroundAtmosphere />

      {/* Outer Viewport Container */}
      <div className="relative z-10 flex min-h-screen flex-col justify-between px-3 py-4 md:px-8 md:py-6">
        
        {/* Top Header inside viewport */}
        <header className="mx-auto flex w-full max-w-[1380px] items-center justify-between pb-2 pt-1">
          {/* Left: Official MEIL Logo from Screenshot */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DC2626] text-white shadow-md shadow-red-500/25 font-black text-xl">
              M
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black tracking-tight text-slate-900">meil</span>
            </div>
          </div>

          {/* Right: Project Site context + Motto */}
          <div className="flex items-center gap-3 sm:gap-4">
            {stage === 'role' && (
              <button
                onClick={() => setStage('project')}
                className="hidden sm:flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold text-slate-600 glass-subtle hover:bg-white hover:text-sky-600 transition shadow-xs"
                title="Change Selected Project Site"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>{currentProject.name}</span>
              </button>
            )}
            {stage === 'project' && (
              <button
                onClick={() => setStage('welcome')}
                className="hidden sm:flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold text-slate-600 glass-subtle hover:bg-white hover:text-sky-600 transition shadow-xs"
                title="Back to Welcome Screen"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Subsidiary & BU</span>
              </button>
            )}
            <div className="text-right">
              <div className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase">
                Engineering
              </div>
              <div className="text-xs font-semibold text-slate-700">
                A Sustainable Tomorrow
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Main Body: Role Screen has freestanding wide layout matching screenshot */}
        {stage === 'role' ? (
          <main className="mx-auto my-auto flex w-full max-w-[1380px] items-center justify-center py-2 sm:py-4">
            <RolePickerScreen
              project={currentProject}
              bu={currentBu}
              roles={ROLES}
              hovered={hoveredRole}
              setHovered={setHoveredRole}
              onPick={handlePickRole}
              onBack={() => setStage('project')}
            />
          </main>
        ) : (
          <main className="mx-auto my-auto flex w-full max-w-[1240px] items-center justify-center">
            <div className="glass-ios-liquid w-full rounded-[36px] p-6 shadow-2xl transition-all md:p-10 lg:p-12">
              <AnimatePresence mode="wait">
                {stage === 'welcome' && (
                  <motion.div
                    key="stage-welcome"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.2 } }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    className="grid items-center gap-8 lg:grid-cols-12 lg:gap-12"
                  >
                    {/* Left Column: 3D Orbit ESG Visual Diagram (5 Cols) */}
                    <div className="relative hidden lg:col-span-5 lg:block">
                      <LiquidGlassOrbitDiagram />
                    </div>

                    {/* Right Column: Welcome Headline, Subsidiary + BU Dropdowns, Continue, Pillars (7 Cols) */}
                    <div className="lg:col-span-7">
                      <WelcomePanel
                        selectedOrgId={selectedOrgId}
                        onSelectSub={handleSelectSub}
                        activeBuId={activeBuId}
                        onSelectBu={handleSelectBu}
                        onContinue={() => setStage('project')}
                      />
                    </div>
                  </motion.div>
                )}

                {stage === 'project' && (
                  <motion.div
                    key="stage-project"
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -30, transition: { duration: 0.2 } }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <ProjectSelectionScreen
                      currentBu={currentBu}
                      selectedProjectId={activeProjectId}
                      onSelectBu={handleSelectBu}
                      onSelectProject={handleSelectProject}
                      onBack={() => setStage('welcome')}
                      onProceed={() => setStage('role')}
                    />
                  </motion.div>
                )}

                {stage === 'login' && selectedRole && (
                  <motion.div
                    key="stage-login"
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.2 } }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <LoginScreen
                      project={currentProject}
                      bu={currentBu}
                      role={selectedRole}
                      email={email}
                      setEmail={setEmail}
                      password={password}
                      setPassword={setPassword}
                      remember={remember}
                      setRemember={setRemember}
                      error={error}
                      busy={busy}
                      onSubmit={handleSubmitLogin}
                      onBack={() => {
                        setStage('role')
                        setSelectedRole(null)
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </main>
        )}

        {/* Compact Footer (Hidden on role stage to match replica screenshot) */}
        {stage !== 'role' && (
          <footer className="mx-auto flex w-full max-w-[1240px] items-center justify-between pt-3 text-[11px] text-slate-500">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">MEIL ESG & BRSR Reporting Platform</span>
              <span>·</span>
              <span>SEBI Compliant</span>
              <span>·</span>
              <span>GHG Protocol</span>
            </div>
            <div className="text-[10px] text-slate-400">
              © {new Date().getFullYear()} Megha Engineering & Infrastructures Ltd.
            </div>
          </footer>
        )}

      </div>
    </div>
  )
}

/**
 * Ambient background with floating 3D spheres & light reflections
 */
function BackgroundAtmosphere() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      {/* Prominent Top-Left Frosted 3D Glass Lens / Bubble from Reference Screenshot */}
      <div
        className="pointer-events-none absolute -top-16 -left-16 sm:-top-20 sm:-left-20 w-[420px] h-[420px] sm:w-[500px] sm:h-[500px] rounded-full"
        style={{
          background: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.85) 0%, rgba(224,242,254,0.48) 50%, rgba(186,230,253,0.2) 80%, transparent 100%)',
          boxShadow: '0 25px 60px rgba(186,230,253,0.4), inset 0 2px 4px rgba(255,255,255,0.95)',
          border: '1.5px solid rgba(255,255,255,0.7)',
          backdropFilter: 'blur(35px)',
          WebkitBackdropFilter: 'blur(35px)',
        }}
      />

      {/* Soft Sky Blue Radial Orbs */}
      <div className="orb animate-orb" style={{ width: 500, height: 500, top: -140, right: -100, background: 'radial-gradient(circle, rgba(125,211,252,0.65), transparent 70%)' }} />
      <div className="orb animate-orb" style={{ width: 440, height: 440, bottom: -120, left: -80, background: 'radial-gradient(circle, rgba(186,230,253,0.7), transparent 70%)', animationDelay: '3s' }} />
      <div className="orb animate-orb" style={{ width: 320, height: 320, top: '35%', left: '15%', background: 'radial-gradient(circle, rgba(224,242,254,0.75), transparent 70%)', animationDelay: '5s' }} />

      {/* Floating 3D Glossy Translucent Spheres / Bubbles */}
      {[
        { size: 48, top: '12%', left: '8%', delay: 0 },
        { size: 28, top: '24%', left: '22%', delay: 1.5 },
        { size: 64, top: '48%', left: '4%', delay: 2 },
        { size: 36, top: '78%', left: '12%', delay: 0.8 },
        { size: 54, top: '16%', right: '14%', delay: 2.5 },
        { size: 32, top: '42%', right: '6%', delay: 1.2 },
        { size: 44, top: '72%', right: '18%', delay: 3 },
      ].map((s, idx) => (
        <motion.div
          key={idx}
          className="glass-sphere-3d absolute pointer-events-none"
          style={{ width: s.size, height: s.size, top: s.top, left: (s as any).left, right: (s as any).right }}
          animate={{
            y: [0, -18, 0],
            x: [0, idx % 2 === 0 ? 8 : -8, 0],
            scale: [1, 1.04, 1],
          }}
          transition={{
            duration: 6 + idx * 1.2,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: s.delay,
          }}
        />
      ))}
    </div>
  )
}

/**
 * 3D Orbit ESG Visual Diagram (Left Column of Welcome Screen)
 * Exactly reproduces the center cushion card, orbiting tiles, dashed rings, and bottom metric blocks.
 */
function LiquidGlassOrbitDiagram() {
  /* Fixed coordinate system — every node is mathematically pinned to its ring
     (position = center + R·û(θ)) and its connector line lives INSIDE the same
     rotating wrapper, so nodes, lines and rings can never detach. The wrapper
     spins; the node counter-spins at the same rate so labels stay upright. */
  const SIZE = 420
  const C = SIZE / 2
  const R_OUTER = 158
  const R_INNER = 104
  const ORBIT_S = 52
  const SATELLITE_S = 34

  const PILLARS = [
    { key: 'environment', label: 'Environment', icon: Leaf, tint: 'bg-emerald-50 text-emerald-600', line: '#34d399', base: -90 },
    { key: 'social', label: 'Social', icon: Users, tint: 'bg-sky-50 text-sky-600', line: '#38bdf8', base: 30 },
    { key: 'governance', label: 'Governance', icon: ShieldCheck, tint: 'bg-blue-50 text-blue-600', line: '#60a5fa', base: 150 },
  ] as const

  return (
    <div className="relative flex flex-col items-center justify-center p-2 [perspective:1400px]">
      <motion.div
        initial={{ rotateX: 8, rotateY: -7 }}
        animate={{ rotateX: [8, 3, 8, 11, 8], rotateY: [-7, -2, -7, -11, -7] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        whileHover={{ rotateX: 2, rotateY: 0, scale: 1.015 }}
        style={{ transformStyle: 'preserve-3d' }}
        className="relative h-[420px] w-full max-w-[420px]"
      >
        {/* Concentric rings (static fill + counter-rotating dashes) */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${SIZE} ${SIZE}`} fill="none" aria-hidden>
          <defs>
            <radialGradient id="pu-orbit-fill" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(186,230,253,0.38)" />
              <stop offset="68%" stopColor="rgba(186,230,253,0.10)" />
              <stop offset="100%" stopColor="rgba(186,230,253,0)" />
            </radialGradient>
          </defs>
          <circle cx={C} cy={C} r={R_OUTER} fill="url(#pu-orbit-fill)" />
          <circle cx={C} cy={C} r={R_OUTER} stroke="rgba(14,165,233,0.32)" strokeWidth="1.5" strokeDasharray="5 9">
            <animateTransform attributeName="transform" type="rotate" from={`0 ${C} ${C}`} to={`360 ${C} ${C}`} dur="60s" repeatCount="indefinite" />
          </circle>
          <circle cx={C} cy={C} r={R_INNER} stroke="rgba(56,189,248,0.24)" strokeWidth="1.5" strokeDasharray="3 7">
            <animateTransform attributeName="transform" type="rotate" from={`360 ${C} ${C}`} to={`0 ${C} ${C}`} dur="45s" repeatCount="indefinite" />
          </circle>
          <circle cx={C} cy={C} r="54" stroke="rgba(14,165,233,0.16)" strokeWidth="1" strokeDasharray="2 6" />
        </svg>

        {/* Core halo — breathing glow locked to center */}
        <motion.div
          animate={{ scale: [1, 1.14, 1], opacity: [0.5, 0.22, 0.5] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
          style={{ x: '-50%', y: '-50%', background: 'radial-gradient(circle, rgba(56,189,248,0.38), transparent 70%)' }}
          className="absolute left-1/2 top-1/2 h-52 w-52 rounded-full"
          aria-hidden
        />
        {/* Rotating conic sheen around the core */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
          style={{
            x: '-50%',
            y: '-50%',
            background: 'conic-gradient(from 0deg, transparent 0deg, rgba(56,189,248,0.28) 70deg, transparent 150deg, transparent 360deg)',
          }}
          className="absolute left-1/2 top-1/2 h-60 w-60 rounded-full opacity-60 blur-md"
          aria-hidden
        />

        {/* ESG core card — exact center, every orbit references it */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{ x: '-50%', y: '-50%' }}
          className="glass-cushion-3d absolute left-1/2 top-1/2 z-10 flex h-36 w-36 flex-col items-center justify-center rounded-[32px] p-4 text-center"
        >
          <div className="mb-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-sky-400 to-blue-500 text-white shadow-md shadow-sky-500/30">
            <Leaf className="h-5 w-5" />
          </div>
          <div className="text-2xl font-black tracking-tight text-slate-900">ESG</div>
          <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Sustainable</div>
          <div className="text-[8px] font-bold uppercase tracking-widest text-sky-600">Growth</div>
        </motion.div>

        {/* Inner-ring satellites: analytic tile + glowing dots (reverse orbit) */}
        <motion.div
          className="absolute left-1/2 top-1/2 h-0 w-0"
          initial={{ rotate: 10 }}
          animate={{ rotate: -350 }}
          transition={{ duration: SATELLITE_S, repeat: Infinity, ease: 'linear' }}
          aria-hidden
        >
          <div
            className="absolute rounded-full"
            style={{ left: -1, top: -(R_INNER - 34), width: 2, height: R_INNER - 34, background: 'linear-gradient(to bottom, rgba(14,165,233,0.40), rgba(56,189,248,0))' }}
          />
          <div className="absolute" style={{ left: 0, top: -R_INNER }}>
            <div style={{ transform: 'translate(-50%, -50%)' }}>
              <motion.div
                initial={{ rotate: -10 }}
                animate={{ rotate: 350 }}
                transition={{ duration: SATELLITE_S, repeat: Infinity, ease: 'linear' }}
                whileHover={{ scale: 1.08 }}
                className="glass-ios-liquid flex h-11 w-11 items-center justify-center rounded-2xl text-sky-600 shadow-md"
              >
                <BarChart3 className="h-4 w-4" />
              </motion.div>
            </div>
          </div>
        </motion.div>
        {[{ base: 70 }, { base: 250 }].map((s, i) => (
          <motion.div
            key={i}
            className="absolute left-1/2 top-1/2 h-0 w-0"
            initial={{ rotate: s.base }}
            animate={{ rotate: s.base - 360 }}
            transition={{ duration: SATELLITE_S, repeat: Infinity, ease: 'linear' }}
            aria-hidden
          >
            <div className="absolute" style={{ left: 0, top: -R_INNER, transform: 'translate(-50%, -50%)' }}>
              <span className="block h-2.5 w-2.5 rounded-full bg-sky-400 shadow-[0_0_14px_3px_rgba(56,189,248,0.55)]" />
            </div>
          </motion.div>
        ))}

        {/* Pillar nodes — rigid 120° constellation riding the outer ring */}
        {PILLARS.map((p, i) => (
          <motion.div
            key={p.key}
            className="absolute left-1/2 top-1/2 z-10 h-0 w-0"
            initial={{ rotate: p.base }}
            animate={{ rotate: p.base + 360 }}
            transition={{ duration: ORBIT_S, repeat: Infinity, ease: 'linear', delay: -i * 0.0001 }}
          >
            {/* connector grows from the core and stays glued to the node */}
            <div
              className="absolute rounded-full"
              style={{
                left: -1,
                top: -(R_OUTER - 48),
                width: 2,
                height: R_OUTER - 48,
                background: `linear-gradient(to bottom, ${p.line}59, rgba(56,189,248,0))`,
              }}
              aria-hidden
            />
            <div className="absolute" style={{ left: 0, top: -R_OUTER }}>
              <div style={{ transform: 'translate(-50%, -50%)' }}>
                <motion.div
                  initial={{ rotate: -p.base }}
                  animate={{ rotate: -p.base - 360 }}
                  transition={{ duration: ORBIT_S, repeat: Infinity, ease: 'linear' }}
                  whileHover={{ scale: 1.07 }}
                  className="glass-ios-liquid flex items-center gap-2 rounded-2xl px-4 py-2.5 shadow-[0_12px_30px_-10px_rgba(2,132,199,0.30)]"
                >
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full ${p.tint} shadow-sm`}>
                    <p.icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="whitespace-nowrap text-[11px] font-semibold text-slate-700">{p.label}</span>
                </motion.div>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Bottom metric strip */}
      <div className="glass-subtle mt-5 flex w-full max-w-[380px] items-center justify-between rounded-2xl px-6 py-3">
        {[
          ['Measure', 'Real Impact'],
          ['Manage', 'Responsibly'],
          ['Report', 'Transparently'],
        ].map(([t, s], i) => (
          <div key={t} className="flex items-center gap-5">
            {i > 0 && <div className="h-6 w-px bg-slate-200/80" />}
            <div className="text-center">
              <div className="text-xs font-bold text-slate-800">{t}</div>
              <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{s}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Welcome Panel (Right Column) with Organization & Business Unit Dropdowns
 */
function WelcomePanel({
  selectedOrgId,
  onSelectSub,
  activeBuId,
  onSelectBu,
  onContinue,
}: {
  selectedOrgId: string
  onSelectSub: (id: string) => void
  activeBuId: string
  onSelectBu: (id: string) => void
  onContinue: () => void
}) {
  const [buDropdownOpen, setBuDropdownOpen] = useState(false)
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false)

  const activeSub = useMemo(
    () => MEIL_SUBSIDIARIES.find(o => o.id === selectedOrgId || o.code === selectedOrgId) || MEIL_SUBSIDIARIES[0],
    [selectedOrgId]
  )

  const availableBus = useMemo(
    () => getBusinessUnitsBySubsidiary(activeSub.code),
    [activeSub.code]
  )

  const activeBu = useMemo(() => {
    const found = availableBus.find(b => b.id === activeBuId)
    return found || availableBus[0] || MEIL_BUSINESS_UNITS[0]
  }, [availableBus, activeBuId])

  const BuIcon = BU_ICONS[activeBu.iconName] ?? Building2

  /* Staggered menu entrance */
  const menuVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.035, delayChildren: 0.04 } },
  }
  const rowVariants = {
    hidden: { opacity: 0, y: -7, scale: 0.985 },
    show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] as const } },
  }

  return (
    <div className="flex flex-col space-y-6">
      {/* Header Tag & Title — staged entrance */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center gap-2.5">
          <span className="h-px w-6 bg-gradient-to-r from-sky-400 to-transparent" />
          <div className="text-[11px] font-bold tracking-[0.2em] text-slate-400 uppercase">
            Welcome to
          </div>
        </div>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
          MEIL <span className="bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-500 bg-clip-text text-transparent">ESG</span>
        </h1>
        <h2 className="mt-0.5 text-base font-semibold text-slate-700">
          ESG &amp; BRSR Reporting Platform
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-slate-500 md:text-sm">
          A unified platform for responsible data collection, transparent reporting and a sustainable future.
        </p>
      </motion.div>

      {/* Select Subsidiary & Business Unit Dropdowns */}
      <motion.div
        className="space-y-3.5"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Dropdown 1: Select Subsidiary */}
        <div className="relative">
          <label className="mb-1.5 block text-xs font-semibold text-slate-600">
            Select Subsidiary
          </label>
          <motion.div
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.995 }}
            onClick={() => {
              setOrgDropdownOpen(!orgDropdownOpen)
              setBuDropdownOpen(false)
            }}
            className={`glass-ios-liquid flex cursor-pointer items-center justify-between gap-3 rounded-2xl px-4 py-3 transition-all duration-300 ${orgDropdownOpen ? 'border-sky-300 ring-2 ring-sky-200/70' : 'hover:border-sky-300 hover:shadow-[0_10px_28px_-12px_rgba(2,132,199,0.30)]'}`}
            role="combobox"
            aria-expanded={orgDropdownOpen}
            aria-label="Select Subsidiary"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-sm shadow-sky-500/30">
                <Building2 className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800">{activeSub.name}</div>
                <div className="text-[10px] text-slate-400">{activeSub.sector}</div>
              </div>
            </div>
            <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-300 ${orgDropdownOpen ? 'rotate-180 text-sky-600' : ''}`} />
          </motion.div>

          {/* Subsidiary Dropdown Menu */}
          <AnimatePresence>
            {orgDropdownOpen && (
              <motion.div
                variants={menuVariants}
                initial="hidden"
                animate="show"
                exit={{ opacity: 0, y: -6, scale: 0.99, transition: { duration: 0.16 } }}
                className="glass-strong absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-2xl border border-white/80 p-1.5 shadow-2xl backdrop-blur-2xl"
                role="listbox"
              >
                {MEIL_SUBSIDIARIES.map(sub => {
                  const isSelected = sub.id === activeSub.id
                  const subBus = getBusinessUnitsBySubsidiary(sub.code)
                  return (
                    <motion.div
                      variants={rowVariants}
                      key={sub.id}
                      onClick={() => {
                        onSelectSub(sub.id)
                        setOrgDropdownOpen(false)
                      }}
                      className={`relative flex cursor-pointer items-center justify-between gap-2 overflow-hidden rounded-xl px-3.5 py-2.5 text-xs transition-colors ${
                        isSelected ? 'bg-gradient-to-r from-sky-50 to-blue-50/60 font-semibold text-sky-700' : 'text-slate-700 hover:bg-slate-50/90'
                      }`}
                      role="option"
                      aria-selected={isSelected}
                    >
                      {isSelected && <span className="absolute inset-y-1 left-0 w-1 rounded-full bg-gradient-to-b from-sky-400 to-blue-600" />}
                      <div className={isSelected ? 'pl-1.5' : 'pl-1.5'}>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{sub.name}</span>
                          <span className="rounded-full bg-sky-100 px-1.5 py-0.2 text-[9px] font-bold text-sky-700">
                            {subBus.length} {subBus.length === 1 ? 'BU' : 'BUs'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400">{sub.sector}</div>
                      </div>
                      {isSelected && <Check className="h-4 w-4 shrink-0 text-sky-600" />}
                    </motion.div>
                  )
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Dropdown 2: Select Business Unit */}
        <div className="relative">
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-600">
              Select Business Unit
            </label>
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25 }}
              className="glass-subtle rounded-full px-2 py-0.5 text-[10px] font-bold text-sky-700"
            >
              {availableBus.length} {availableBus.length === 1 ? 'Business Unit' : 'Business Units'}
            </motion.span>
          </div>

          <motion.div
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.995 }}
            onClick={() => {
              setBuDropdownOpen(!buDropdownOpen)
              setOrgDropdownOpen(false)
            }}
            className={`glass-ios-liquid flex cursor-pointer items-center justify-between gap-3 rounded-2xl px-4 py-3 transition-all duration-300 ${buDropdownOpen ? 'border-sky-300 ring-2 ring-sky-200/70' : 'hover:border-sky-300 hover:shadow-[0_10px_28px_-12px_rgba(2,132,199,0.30)]'}`}
            role="combobox"
            aria-expanded={buDropdownOpen}
            aria-label="Select Business Unit"
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${activeBu.gradient} text-white shadow-sm`}>
                <BuIcon className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">{activeBu.name}</span>
                  <span className="rounded-full bg-sky-100 px-1.5 py-0.2 text-[9px] font-bold text-sky-700">
                    {activeBu.projects.length} {activeBu.projects.length === 1 ? 'Site' : 'Sites'}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">{activeBu.sector}</div>
              </div>
            </div>
            <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-300 ${buDropdownOpen ? 'rotate-180 text-sky-600' : ''}`} />
          </motion.div>

          {/* BU Dropdown Menu */}
          <AnimatePresence>
            {buDropdownOpen && (
              <motion.div
                variants={menuVariants}
                initial="hidden"
                animate="show"
                exit={{ opacity: 0, y: -6, scale: 0.99, transition: { duration: 0.16 } }}
                className="glass-strong absolute left-0 right-0 top-full z-30 mt-1.5 max-h-72 overflow-y-auto scroll-elegant rounded-2xl border border-white/80 p-1.5 shadow-2xl backdrop-blur-2xl"
                role="listbox"
              >
                {availableBus.map(bu => {
                  const IconComp = BU_ICONS[bu.iconName] ?? Building2
                  const isSelected = bu.id === activeBu.id
                  return (
                    <motion.div
                      variants={rowVariants}
                      key={bu.id}
                      onClick={() => {
                        onSelectBu(bu.id)
                        setBuDropdownOpen(false)
                      }}
                      className={`relative flex cursor-pointer items-center justify-between gap-2 overflow-hidden rounded-xl px-3 py-2.5 text-xs transition-colors ${
                        isSelected ? 'bg-gradient-to-r from-sky-50 to-blue-50/60 font-semibold text-sky-700' : 'text-slate-700 hover:bg-slate-50/90'
                      }`}
                      role="option"
                      aria-selected={isSelected}
                    >
                      {isSelected && <span className="absolute inset-y-1 left-0 w-1 rounded-full bg-gradient-to-b from-sky-400 to-blue-600" />}
                      <div className="flex items-center gap-2.5 pl-1.5">
                        <div className={`flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br ${bu.gradient} text-white shadow-xs`}>
                          <IconComp className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold">{bu.name}</span>
                            <span className="rounded bg-slate-100 px-1 py-0.2 text-[9px] font-mono text-slate-500">
                              {bu.projects.length} {bu.projects.length === 1 ? 'Site' : 'Sites'}
                            </span>
                          </div>
                          <div className="line-clamp-1 text-[10px] text-slate-400">{bu.sector}</div>
                        </div>
                      </div>
                      {isSelected && <Check className="h-4 w-4 shrink-0 text-sky-600" />}
                    </motion.div>
                  )
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </motion.div>

      {/* Prominent Continue Button (Electric Blue Pill with shine sweep) */}
      <motion.button
        type="button"
        onClick={onContinue}
        whileTap={{ scale: 0.985 }}
        className="btn-liquid-blue btn-shine group flex w-full items-center justify-center gap-2.5 rounded-full py-3.5 text-sm font-bold shadow-lg"
      >
        <span>Continue to Project Sites ({activeBu.projects.length})</span>
        <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
      </motion.button>

      {/* Bottom: OUR ESG PILLARS with 3 Frosted Glass Cards */}
      <motion.div
        className="pt-1"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="relative mb-3.5 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200/70" />
          </div>
          <span className="relative bg-[#ffffff]/60 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 backdrop-blur-xs">
            Our ESG Pillars
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {[
            { icon: Leaf, title: 'Environment', sub: 'Protection', tile: 'bg-emerald-50 text-emerald-600' },
            { icon: Users, title: 'Social', sub: 'Responsibility', tile: 'bg-sky-50 text-sky-600' },
            { icon: ShieldCheck, title: 'Governance', sub: 'Integrity', tile: 'bg-blue-50 text-blue-600' },
          ].map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.07, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -4 }}
              className="glass-ios-liquid group flex flex-col items-center justify-center rounded-2xl p-2.5 text-center"
            >
              <motion.span
                whileHover={{ scale: 1.12, rotate: [0, -5, 5, 0] }}
                className={`mb-1 flex h-7 w-7 items-center justify-center rounded-full ${p.tile}`}
              >
                <p.icon className="h-3.5 w-3.5" />
              </motion.span>
              <div className="text-[10px] font-bold leading-tight text-slate-700">{p.title}</div>
              <div className="text-[9px] text-slate-400">{p.sub}</div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

/**
 * NEXT SCREEN: Project Selection Screen
 * Displays the list of all projects belonging to the selected Business Unit in an
 * ultra-premium iOS Liquid Glass interactive grid!
 */
/* ── Project card visual system ─────────────────────────────── */
const STATUS_META: Record<MeilProject['status'], { label: string; dot: string; text: string }> = {
  ACTIVE: { label: 'Active', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  IN_OPERATION: { label: 'Operating', dot: 'bg-blue-500', text: 'text-blue-700' },
  COMMISSIONING: { label: 'Commissioning', dot: 'bg-amber-500', text: 'text-amber-700' },
  EXPANSION: { label: 'Expanding', dot: 'bg-violet-500', text: 'text-violet-700' },
}

const CATEGORY_STYLES: { match: RegExp; chip: string; bar: string }[] = [
  { match: /tunnel/i, chip: 'bg-sky-50 text-sky-700', bar: 'from-sky-400 to-blue-600' },
  { match: /solar/i, chip: 'bg-amber-50 text-amber-700', bar: 'from-amber-400 to-orange-500' },
  { match: /wind/i, chip: 'bg-teal-50 text-teal-700', bar: 'from-teal-400 to-emerald-500' },
  { match: /thermal|power|energy/i, chip: 'bg-rose-50 text-rose-700', bar: 'from-rose-400 to-red-500' },
  { match: /water|irrigation|drinking/i, chip: 'bg-cyan-50 text-cyan-700', bar: 'from-cyan-400 to-sky-500' },
  { match: /hydro|pumped/i, chip: 'bg-blue-50 text-blue-700', bar: 'from-blue-400 to-indigo-500' },
  { match: /rail|metro|transit/i, chip: 'bg-violet-50 text-violet-700', bar: 'from-violet-400 to-purple-500' },
  { match: /substation|grid|transmission/i, chip: 'bg-sky-50 text-sky-700', bar: 'from-blue-400 to-sky-600' },
  { match: /hospital|building|infra|factory/i, chip: 'bg-emerald-50 text-emerald-700', bar: 'from-emerald-400 to-teal-500' },
  { match: /expressway|highway|road|corridor|bypass/i, chip: 'bg-indigo-50 text-indigo-700', bar: 'from-indigo-400 to-blue-600' },
]
const CATEGORY_FALLBACK = { chip: 'bg-slate-100 text-slate-700', bar: 'from-slate-300 to-slate-400' }

function styleForCategory(category: string) {
  return CATEGORY_STYLES.find(s => s.match.test(category)) ?? CATEGORY_FALLBACK
}

/* Mini radial ESG score ring */
function EsgRing({ score }: { score: number }) {
  const R = 15
  const CIRC = 2 * Math.PI * R
  return (
    <div className="relative h-10 w-10 shrink-0">
      <svg viewBox="0 0 36 36" className="h-10 w-10 -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r={R} fill="none" stroke="rgba(148,163,184,0.25)" strokeWidth="3.5" />
        <circle
          cx="18" cy="18" r={R} fill="none"
          stroke="url(#pu-esg-arc)" strokeWidth="3.5" strokeLinecap="round"
          strokeDasharray={`${(CIRC * score) / 100} ${CIRC}`}
        />
        <defs>
          <linearGradient id="pu-esg-arc" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-slate-700">{score}</span>
    </div>
  )
}

/**
 * NEXT SCREEN: Project Selection Screen
 * Advanced modern redesign — segmented BU rail with sliding gradient pill,
 * premium glass project cards (category accent bar, live status pulse, ESG
 * score ring, owner cell) with layout-animated filtering, and a glass action
 * dock that carries the selection into the role flow.
 */
function ProjectSelectionScreen({
  currentBu,
  selectedProjectId,
  onSelectBu,
  onSelectProject,
  onBack,
  onProceed,
}: {
  currentBu: MeilBusinessUnit
  selectedProjectId: string
  onSelectBu: (id: string) => void
  onSelectProject: (p: MeilProject) => void
  onBack: () => void
  onProceed: () => void
}) {
  const [search, setSearch] = useState('')
  const BuIcon = BU_ICONS[currentBu.iconName] ?? Building2

  // Filter projects based on search query
  const filteredProjects = useMemo(() => {
    if (!search.trim()) return currentBu.projects
    const q = search.toLowerCase()
    return currentBu.projects.filter(
      p =>
        p.name.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.stateOrCountry.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q)
    )
  }, [currentBu.projects, search])

  const activeProject = useMemo(() => {
    return currentBu.projects.find(p => p.id === selectedProjectId) || currentBu.projects[0]
  }, [currentBu.projects, selectedProjectId])

  return (
    <div className="space-y-5">
      {/* Header with Back Button, Breadcrumbs & Search */}
      <div className="flex flex-col gap-3 border-b border-slate-200/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ x: -2 }}
            whileTap={{ scale: 0.94 }}
            onClick={onBack}
            className="glass-subtle flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-600 shadow-xs transition hover:bg-white hover:text-sky-600"
            title="Back to Welcome Screen"
            aria-label="Back to Welcome Screen"
          >
            <ArrowLeft className="h-4 w-4" />
          </motion.button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Step 2 of 3</span>
              <span className="text-slate-300">•</span>
              <span className="text-[10px] font-bold uppercase text-sky-600">Project Site Selection</span>
            </div>
            <h2 className="text-xl font-extrabold tracking-tight text-slate-900 md:text-2xl">
              Select Project Site in{' '}
              <span className="bg-gradient-to-r from-sky-600 to-blue-600 bg-clip-text text-transparent">{currentBu.shortName}</span>
            </h2>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px]">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${currentBu.projects.length} sites in ${currentBu.shortName}...`}
            className="w-full rounded-full border border-slate-200/80 bg-white/70 py-1.5 pl-9 pr-9 text-xs text-slate-800 outline-none backdrop-blur-md transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="Clear search"
            >
              <ArrowLeft className="h-3 w-3 rotate-45" />
            </button>
          )}
        </div>
      </div>

      {/* Business Unit Rail — sliding gradient pill indicator */}
      <div className="flex items-center gap-2 overflow-x-auto scroll-elegant pb-1">
        {MEIL_BUSINESS_UNITS.map(bu => {
          const Icon = BU_ICONS[bu.iconName] ?? Building2
          const isSelected = bu.id === currentBu.id
          return (
            <button
              key={bu.id}
              onClick={() => onSelectBu(bu.id)}
              className={`relative flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-300 ${
                isSelected
                  ? 'text-white shadow-md shadow-sky-500/25'
                  : 'glass-subtle text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
              aria-pressed={isSelected}
            >
              {isSelected && (
                <motion.span
                  layoutId="pu-bu-rail-pill"
                  className="absolute inset-0 rounded-full bg-gradient-to-r from-sky-500 to-blue-600"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
              <span className="relative flex items-center gap-2">
                <Icon className="h-3.5 w-3.5" />
                <span>{bu.shortName}</span>
                <span className={`rounded-full px-1.5 py-0.2 text-[9px] font-bold ${isSelected ? 'bg-white/25 text-white' : 'bg-slate-200/70 text-slate-600'}`}>
                  {bu.projects.length}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {/* Current BU context strip */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="glass-subtle flex flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-2.5"
      >
        <div className="flex items-center gap-2.5">
          <div className={`flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br ${currentBu.gradient} text-white shadow-sm`}>
            <BuIcon className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800">{currentBu.name}</div>
            <div className="text-[10px] text-slate-500 line-clamp-1">{currentBu.sector}</div>
          </div>
        </div>
        <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-bold text-sky-700 shadow-xs">
          {filteredProjects.length} of {currentBu.projects.length} sites
        </span>
      </motion.div>

      {/* Project Cards Grid — layout-animated filtering */}
      <div className="max-h-[46vh] overflow-y-auto scroll-elegant pr-1 lg:max-h-[420px]">
        {filteredProjects.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-12 text-center"
          >
            <span className="glass-ios-liquid flex h-14 w-14 items-center justify-center rounded-full text-slate-300">
              <Compass className="h-7 w-7" />
            </span>
            <div className="mt-3 text-sm font-semibold text-slate-700">No project sites found</div>
            <div className="text-xs text-slate-400">Try a different keyword or switch Business Unit.</div>
          </motion.div>
        ) : (
          <motion.div layout className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {filteredProjects.map((p, idx) => {
                const isSelected = p.id === selectedProjectId
                const cat = styleForCategory(p.category)
                const st = STATUS_META[p.status] ?? STATUS_META.ACTIVE
                return (
                  <motion.article
                    key={p.id}
                    layout
                    initial={{ opacity: 0, y: 16, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.32, delay: Math.min(idx * 0.035, 0.28), ease: [0.22, 1, 0.36, 1] } }}
                    exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.16 } }}
                    whileHover={{ y: -5 }}
                    onClick={() => onSelectProject(p)}
                    role="option"
                    aria-selected={isSelected}
                    className={`group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-3xl p-4 transition-shadow duration-300 ${
                      isSelected
                        ? 'border-2 border-sky-500 bg-white/95 shadow-[0_26px_60px_-14px_rgba(14,165,233,0.40)] ring-4 ring-sky-200/50'
                        : 'glass-ios-liquid hover:shadow-[0_22px_48px_-16px_rgba(2,132,199,0.32)]'
                    }`}
                  >
                    {/* Category accent bar */}
                    <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${cat.bar} transition-opacity duration-300 ${isSelected ? 'opacity-100' : 'opacity-50 group-hover:opacity-100'}`} aria-hidden />

                    {/* Selected badge */}
                    <AnimatePresence>
                      {isSelected && (
                        <motion.span
                          initial={{ scale: 0, rotate: -30 }}
                          animate={{ scale: 1, rotate: 0 }}
                          exit={{ scale: 0 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 24 }}
                          className="absolute right-3 top-3 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-white shadow-md shadow-sky-500/40"
                        >
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </motion.span>
                      )}
                    </AnimatePresence>

                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2 pr-6">
                        <span className={`rounded-md px-2 py-0.5 text-[9.5px] font-bold ${cat.chip}`}>
                          {p.category}
                        </span>
                        <span className={`flex items-center gap-1.5 text-[10px] font-semibold ${st.text}`}>
                          <span className="relative flex h-1.5 w-1.5">
                            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${st.dot} opacity-60`} />
                            <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${st.dot}`} />
                          </span>
                          {st.label}
                        </span>
                        <span className="ml-auto font-mono text-[9px] font-medium tracking-wide text-slate-300">
                          {p.code}
                        </span>
                      </div>

                      <h3 className="text-sm font-bold leading-snug text-slate-800 transition-colors group-hover:text-sky-700">
                        {p.name}
                      </h3>

                      <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                        <MapPin className="h-3 w-3 shrink-0 text-sky-500" />
                        <span className="line-clamp-1">{p.location}, {p.stateOrCountry}</span>
                      </div>

                      <p className="mt-2 text-[11px] leading-relaxed text-slate-500 line-clamp-2">
                        {p.description}
                      </p>
                    </div>

                    {/* Footer: ESG ring + BRSR chip + owner */}
                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
                      <div className="flex items-center gap-2.5">
                        <EsgRing score={p.esgScore} />
                        <div>
                          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">ESG Score</div>
                          {p.brsrCore ? (
                            <span className="mt-0.5 inline-block rounded-full bg-emerald-50 px-1.5 py-0.2 text-[8.5px] font-bold text-emerald-700">
                              BRSR Core
                            </span>
                          ) : (
                            <span className="mt-0.5 inline-block rounded-full bg-slate-100 px-1.5 py-0.2 text-[8.5px] font-bold text-slate-500">
                              Framework
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="min-w-0 text-right">
                        <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Owner</div>
                        <div className="max-w-[110px] truncate text-[10.5px] font-bold text-slate-600">{p.reportingOwner}</div>
                      </div>
                    </div>
                  </motion.article>
                )
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Bottom Glass Action Dock */}
      <motion.div
        layout
        className="flex flex-col gap-3 rounded-3xl border border-sky-100/80 bg-white/85 p-4 shadow-lg shadow-sky-500/5 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${currentBu.gradient} text-white shadow-md`}>
            <BuIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Selected Project</span>
              <span className="rounded bg-sky-100 px-1.5 py-0.2 text-[9px] font-bold text-sky-700">{currentBu.shortName}</span>
            </div>
            <div className="truncate text-sm font-extrabold text-slate-800">
              {activeProject ? activeProject.name : 'Choose a project'}
            </div>
            <div className="truncate text-[11px] text-slate-500">
              {activeProject?.location} • Owner: {activeProject?.reportingOwner}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          <button
            onClick={onBack}
            className="glass-subtle rounded-full px-4 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-white hover:text-slate-900"
          >
            Back
          </button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onProceed}
            className="btn-liquid-blue btn-shine flex items-center gap-2 rounded-full px-6 py-2.5 text-xs font-bold shadow-md"
          >
            <span>Proceed to Role Access</span>
            <ArrowRight className="h-4 w-4" />
          </motion.button>
        </div>
      </motion.div>
    </div>
  )
}

/**
 * Screen 3: Role Selection Screen (Phase 1, 2, 3 Enterprise RBAC roles)
 * Matches the reference design with high-intensity iOS Liquid Glass,
 * bold modern typography, deep blue drop shadows, left/right nav chevrons,
 * and bottom slogan.
 */
function RolePickerScreen({
  project,
  bu,
  roles,
  hovered,
  setHovered,
  onPick,
  onBack,
}: {
  project: MeilProject
  bu: MeilBusinessUnit
  roles: RoleCardDef[]
  hovered: string | null
  setHovered: (s: string | null) => void
  onPick: (r: RoleCardDef) => void
  onBack: () => void
}) {
  const [selectedCategory, setSelectedCategory] = useState<RoleCategory>('all')
  const [currentPage, setCurrentPage] = useState(0)
  const wheelLockRef = useRef<boolean>(false)

  // Phase slides built from PHASE_DEFS — only phases that still have roles are shown
  const resolvedRoles = useMemo(() => {
    return roles.map(r => {
      if (r.key === 'PROJECT_ADMIN' && project?.reportingOwner) {
        return { ...r, name: project.reportingOwner }
      }
      return r
    })
  }, [roles, project])

  const PHASES = useMemo(() => PHASE_DEFS.map(def => ({
    ...def,
    badge: `${resolvedRoles.filter(r => r.phase === def.phase).length} Roles`,
    roles: resolvedRoles.filter(r => r.phase === def.phase),
  })).filter(p => p.roles.length > 0), [resolvedRoles])

  const totalPages = PHASES.length
  const currentPhase = PHASES[currentPage] || PHASES[0]

  // Filter roles based on selected category tab or phase slide
  const displayedRoles = useMemo(() => {
    if (selectedCategory === 'all') {
      return currentPhase.roles
    }
    const catFiltered = resolvedRoles.filter(r => r.category === selectedCategory)
    return catFiltered.length > 0 ? catFiltered : currentPhase.roles
  }, [resolvedRoles, selectedCategory, currentPhase])

  const nextPage = () => {
    setCurrentPage(prev => (prev + 1) % totalPages)
    setSelectedCategory('all')
    setHovered(null)
  }

  const prevPage = () => {
    setCurrentPage(prev => (prev - 1 + totalPages) % totalPages)
    setSelectedCategory('all')
    setHovered(null)
  }

  // Mouse wheel scroll handler: enables natural horizontal paging between phases
  const handleWheel = (e: React.WheelEvent) => {
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
    if (Math.abs(delta) < 18) return
    if (wheelLockRef.current) return

    wheelLockRef.current = true
    setTimeout(() => {
      wheelLockRef.current = false
    }, 320)

    if (delta > 0) {
      nextPage()
    } else {
      prevPage()
    }
  }

  // Active highlighted card index for carousel dots & elevation
  const activeIndex = useMemo(() => {
    if (hovered) {
      const idx = displayedRoles.findIndex(r => r.key === hovered)
      if (idx !== -1) return idx
    }
    // Highlight CSR_USER by default if on Phase 1
    if (currentPage === 0) {
      const csrIdx = displayedRoles.findIndex(r => r.key === 'CSR_USER')
      if (csrIdx !== -1) return csrIdx
    }
    // Highlight single card (Phase 2 - Project Admin)
    if (displayedRoles.length === 1) {
      return 0
    }
    // Otherwise center card
    return Math.floor(displayedRoles.length / 2)
  }, [hovered, displayedRoles, currentPage])

  // Category pills — categories whose roles were all removed drop out automatically
  const ROLE_CATEGORIES: { id: RoleCategory; label: string; count: number; icon: typeof Globe }[] = ([
    { id: 'all', label: 'All Roles', icon: Globe },
    { id: 'operations', label: 'Site Operations', icon: Building2 },
    { id: 'admin', label: 'Project Admin', icon: ShieldCheck },
    { id: 'approvals', label: 'Review & Approvals', icon: FileCheck },
    { id: 'governance', label: 'BRSR & Governance', icon: Scale },
    { id: 'leadership', label: 'Leadership & Board', icon: Crown },
  ] as const)
    .map(c => ({ ...c, count: c.id === 'all' ? resolvedRoles.length : resolvedRoles.filter(r => r.category === c.id).length }))
    .filter(c => c.count > 0)

  // Responsive dynamic card width and gap so all cards fit completely without clipping
  const cardWidthClass = displayedRoles.length >= 7
    ? 'w-[124px] sm:w-[132px] md:w-[138px] lg:w-[145px] xl:w-[150px] shrink-0'
    : displayedRoles.length === 1
      ? 'w-[230px] sm:w-[250px] md:w-[270px] shrink-0'
      : displayedRoles.length <= 3
        ? 'w-[185px] sm:w-[205px] lg:w-[220px] shrink-0'
        : 'w-[155px] sm:w-[168px] lg:w-[180px] shrink-0'

  const cardGapClass = displayedRoles.length >= 7
    ? 'gap-1.5 sm:gap-2 lg:gap-2.5'
    : displayedRoles.length <= 3
      ? 'gap-5 sm:gap-6 lg:gap-8'
      : 'gap-3 sm:gap-4 lg:gap-5'

  return (
    <div className="relative flex w-full flex-col items-center justify-between py-2 sm:py-3">
      {/* Top Header Pill Indicator (+ mobile back to project site) */}
      <div className="relative flex w-full items-center justify-center mb-1">
        <button
          onClick={onBack}
          className="absolute left-0 glass-subtle flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold text-slate-600 shadow-xs backdrop-blur-md transition hover:bg-white hover:text-sky-600 sm:hidden"
          title="Back to Project Site Selection"
          aria-label="Back to Project Site Selection"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Site</span>
        </button>
        <span className="rounded-full bg-white/80 px-4 py-1 text-[11px] font-bold tracking-[0.25em] text-slate-400 uppercase border border-slate-200/60 shadow-xs backdrop-blur-md">
          STEP 1 OF 2
        </span>
      </div>

      {/* Main Headline & Subtitle */}
      <div className="text-center my-2 sm:my-3">
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-[#0F172A]">
          Choose Your{' '}
          <span className="text-[#2563EB]">
            Role
          </span>
        </h1>
        <p className="mt-2 text-xs sm:text-sm font-medium text-slate-500">
          Select your role to continue to the MEIL ESG platform
        </p>
      </div>

      {/* Categorize Cards Options (Filter Pills Bar) */}
      <div className="flex items-center justify-center gap-2 overflow-x-auto py-1 px-2 my-2 sm:my-3 max-w-full">
        {ROLE_CATEGORIES.map(cat => {
          const isSelected = selectedCategory === cat.id
          const CatIcon = cat.icon
          return (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCategory(cat.id)
                setHovered(null)
                const page = PHASES.findIndex(p => p.roles.some(r => cat.id === 'all' || r.category === cat.id))
                setCurrentPage(page >= 0 ? page : 0)
              }}
              className={`group flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 cursor-pointer ${
                isSelected
                  ? 'bg-gradient-to-r from-blue-600 via-sky-500 to-blue-700 text-white shadow-md shadow-blue-500/25 scale-[1.03]'
                  : 'bg-white/70 backdrop-blur-md border border-white/80 text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-xs'
              }`}
            >
              <CatIcon className={`h-3.5 w-3.5 transition-transform group-hover:scale-110 ${isSelected ? 'text-white' : 'text-sky-600'}`} />
              <span>{cat.label}</span>
              <span className={`rounded-full px-1.5 py-0.2 text-[9px] font-bold ${
                isSelected ? 'bg-white/20 text-white' : 'bg-slate-200/70 text-slate-600'
              }`}>
                {cat.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Current Phase Sub-heading Badge */}
      <div className="flex items-center justify-center gap-2 my-1">
        <span className="rounded-full bg-white/85 border border-sky-200/70 shadow-xs px-3.5 py-1 text-xs font-bold text-sky-800 backdrop-blur-md flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
          <span>{currentPhase.label}</span>
          <span className="rounded-full bg-blue-600/10 px-2 py-0.5 text-[10px] font-black text-blue-700">
            {displayedRoles.length} {displayedRoles.length === 1 ? 'Container' : 'Containers'}
          </span>
        </span>
      </div>

      {/* Horizontal Carousel Track with Mouse Scroll + Touch Drag + Chevrons */}
      <div 
        onWheel={handleWheel}
        className="relative w-full max-w-[1360px] mx-auto flex items-center justify-center gap-2 sm:gap-3 lg:gap-4 my-2 sm:my-3 px-2 sm:px-4 select-none"
      >
        {/* Left Circular Arrow Button */}
        <button
          onClick={prevPage}
          aria-label="Previous phase slide"
          title="Previous Phase"
          className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full bg-white/90 border border-white shadow-md shadow-sky-500/10 backdrop-blur-md text-slate-600 hover:text-blue-600 hover:bg-white hover:scale-105 active:scale-95 transition-all cursor-pointer z-20"
        >
          <ChevronLeft className="h-5 w-5 stroke-[2.2]" />
        </button>

        {/* Phase Role Cards Row with Spring Animations & Drag / Wheel Scroll */}
        <motion.div 
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={(_e, info) => {
            if (info.offset.x < -50) nextPage()
            else if (info.offset.x > 50) prevPage()
          }}
          className={`flex items-center justify-center ${cardGapClass} flex-nowrap cursor-grab active:cursor-grabbing max-w-full overflow-x-auto sm:overflow-visible scrollbar-none py-4 px-1`}
        >
          <AnimatePresence mode="popLayout">
            {displayedRoles.map((r, idx) => {
              const Icon = r.icon
              const isHighlighted = idx === activeIndex

              return (
                <motion.div
                  key={r.key}
                  onMouseEnter={() => setHovered(r.key)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => onPick(r)}
                  initial={{ opacity: 0, y: 20, scale: 0.93 }}
                  animate={{ 
                    opacity: 1, 
                    y: isHighlighted ? -16 : 0, 
                    scale: isHighlighted ? 1.02 : 1 
                  }}
                  exit={{ opacity: 0, y: -20, scale: 0.90 }}
                  transition={{ 
                    type: 'spring', 
                    stiffness: 320, 
                    damping: 24, 
                    delay: idx * 0.025 
                  }}
                  whileHover={{ 
                    y: isHighlighted ? -20 : -8, 
                    scale: isHighlighted ? 1.03 : 1.02 
                  }}
                  whileTap={{ scale: 0.96 }}
                  className={`group relative flex cursor-pointer flex-col items-center justify-between rounded-[24px] sm:rounded-[26px] p-3 sm:p-3.5 text-center transition-all duration-300 ${cardWidthClass} h-[255px] sm:h-[262px] lg:h-[270px] ${
                    isHighlighted
                      ? 'bg-white/95 border-2 border-[#60A5FA] z-10 shadow-[0_36px_85px_-8px_rgba(37,99,235,0.44),0_16px_36px_-4px_rgba(37,99,235,0.28),inset_0_2px_4px_rgba(255,255,255,1)] ring-4 ring-blue-400/20'
                      : 'bg-white/80 border border-white/90 shadow-[0_16px_36px_-8px_rgba(2,132,199,0.18),0_4px_14px_rgba(0,0,0,0.04),inset_0_1px_2px_rgba(255,255,255,0.95)] hover:bg-white/95 hover:border-sky-300 hover:shadow-[0_28px_65px_-8px_rgba(2,132,199,0.34),0_12px_24px_-4px_rgba(14,165,233,0.22),inset_0_2px_4px_rgba(255,255,255,1)]'
                  }`}
                >
                  {/* Top Squircle Icon with Motion Pulse */}
                  <motion.div 
                    whileHover={{ scale: 1.15, rotate: [0, -4, 4, 0] }}
                    transition={{ duration: 0.3 }}
                    className={`mb-2.5 flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-[16px] transition-colors duration-200 ${
                      isHighlighted 
                        ? 'bg-[#E0EFFE] text-[#2563EB] shadow-md shadow-blue-500/20' 
                        : 'bg-[#EBF4FE] text-[#2563EB] group-hover:bg-[#E0EFFE]'
                    }`}
                  >
                    <Icon className="h-5.5 w-5.5 stroke-[1.8] text-[#2563EB]" />
                  </motion.div>

                  {/* Role Title */}
                  <h3 className="text-[11.5px] sm:text-[12px] lg:text-[12.5px] font-extrabold text-[#0F172A] leading-tight mb-1 group-hover:text-blue-700 transition-colors">
                    {r.role}
                  </h3>

                  {/* Description */}
                  <p className="text-[9px] sm:text-[9.5px] lg:text-[10px] leading-snug text-slate-500 font-normal px-0.5 line-clamp-2">
                    {r.blurb}
                  </p>

                  {/* Subtle Phase Pill */}
                  <div className="mt-auto pt-2">
                    <span className={`rounded-full px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-wider ${
                      isHighlighted ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600'
                    }`}>
                      Phase {r.phase}
                    </span>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </motion.div>

        {/* Right Circular Arrow Button */}
        <button
          onClick={nextPage}
          aria-label="Next phase slide"
          title="Next Phase"
          className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full bg-white/90 border border-white shadow-md shadow-sky-500/10 backdrop-blur-md text-slate-600 hover:text-blue-600 hover:bg-white hover:scale-105 active:scale-95 transition-all cursor-pointer z-20"
        >
          <ChevronRight className="h-5 w-5 stroke-[2.2]" />
        </button>
      </div>

      {/* Phase Navigation Tabs / Dots */}
      <div className="my-2.5 flex items-center justify-center gap-2">
        {PHASES.map((p, i) => {
          const isPhaseActive = i === currentPage
          return (
            <button
              key={p.phase}
              onClick={() => {
                setCurrentPage(i)
                setSelectedCategory('all')
                setHovered(null)
              }}
              aria-label={`Switch to ${p.label}`}
              className={`group flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold transition-all duration-200 cursor-pointer ${
                isPhaseActive
                  ? 'bg-gradient-to-r from-blue-600 to-sky-600 text-white shadow-md shadow-blue-500/25 scale-[1.03]'
                  : 'bg-white/70 backdrop-blur-md border border-white/80 text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${isPhaseActive ? 'bg-white' : 'bg-slate-400'}`} />
              <span>Phase {p.phase}</span>
              <span className={`rounded-full px-1.5 py-0.2 text-[9px] font-extrabold ${
                isPhaseActive ? 'bg-white/20 text-white' : 'bg-slate-200/70 text-slate-600'
              }`}>
                {p.roles.length}
              </span>
            </button>
          )
        })}
      </div>

      {/* Mouse Scroll / Drag Hint */}
      <div className="flex items-center justify-center gap-1.5 text-[10px] font-semibold text-slate-400 mb-1">
        <span>Click side arrows or scroll mouse wheel to browse phases</span>
        <span>•</span>
        <span>Phase {currentPage + 1} of {totalPages} ({displayedRoles.length} {displayedRoles.length === 1 ? 'container' : 'containers'})</span>
      </div>

      {/* Bottom Slogan Matching Screenshot */}
      <div className="mt-1 text-center text-xs font-medium tracking-wide text-slate-400">
        Together for a Cleaner, Safer and More Responsible Tomorrow
      </div>
    </div>
  )
}

/**
 * Screen 4: Login Morph (Pre-filled demo credentials)
 */
function LoginScreen({
  project,
  bu,
  role,
  email,
  setEmail,
  password,
  setPassword,
  remember,
  setRemember,
  error,
  busy,
  onSubmit,
  onBack,
}: any) {
  const Icon = role.icon
  const [showPw, setShowPw] = useState(false)
  return (
    <div className="glass-strong overflow-hidden rounded-[28px] border border-white/80 shadow-2xl">
      <div className="grid md:grid-cols-2">
        {/* Left Side: Role Profile Card */}
        <div className="relative flex flex-col justify-between bg-gradient-to-br from-blue-50/90 to-sky-50/80 p-8">
          <button
            onClick={onBack}
            className="glass-subtle mb-4 flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Roles
          </button>

          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center text-center"
          >
            <div className={`mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br ${role.tint} text-white shadow-xl shadow-sky-500/20`}>
              <Icon className="h-9 w-9" />
            </div>

            <div className="rounded-full bg-white/70 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sky-700 shadow-xs">
              Phase {role.phase} Access
            </div>
            <h3 className="mt-2 text-2xl font-extrabold text-slate-900">{role.role}</h3>
            <p className="mt-1 text-xs text-slate-500 max-w-xs">{role.blurb}</p>

            <div className="mt-4 flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 shadow-xs">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-[10px] font-bold text-white">
                {role.name.split(' ').map((n: string) => n[0]).join('')}
              </div>
              <span className="text-xs font-bold text-slate-700">{role.name}</span>
            </div>

            {/* Selected Project Pill */}
            <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-sky-100/70 px-2.5 py-1 text-[10px] font-semibold text-sky-800">
              <MapPin className="h-3 w-3 text-sky-600" />
              <span>{project.name} ({bu.shortName})</span>
            </div>
          </motion.div>

          <div className="flex items-center justify-center gap-1.5 text-[10px] font-medium text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>Backend-enforced RBAC + scope access</span>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="p-7 md:p-9">
          <div className="mb-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Sign in to platform</div>
            <div className="mt-1 text-base font-extrabold text-slate-800">{role.role}</div>
            <div className="text-[11px] text-slate-500">{role.email}</div>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">Email / Employee ID</label>
              <input
                type="text"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="username"
                className="w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 text-sm text-slate-800 outline-none backdrop-blur-md transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                placeholder="user@meil-esg.in or EMP-1001"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 pr-11 text-sm text-slate-800 outline-none backdrop-blur-md transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:text-sky-600"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-200"
                />
                <span>Remember session</span>
              </label>
              <span className="text-xs font-semibold text-sky-600">Demo enabled</span>
            </div>

            {error && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                <ShieldAlert className="h-4 w-4" />
                <span>{error}</span>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="btn-liquid-blue group flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-bold shadow-md disabled:opacity-60"
            >
              {busy ? (
                <span>Authenticating…</span>
              ) : (
                <>
                  <span>Enter Workspace as {role.name.split(' ')[0]}</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          <div className="mt-5 flex items-center gap-2 rounded-xl bg-sky-50/80 px-3.5 py-2.5 text-[11px] text-slate-600">
            <Check className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>
              Pre-filled demo login. Default password: <code className="rounded bg-white px-1.5 py-0.5 font-mono font-bold text-sky-700 shadow-2xs">demo</code>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
