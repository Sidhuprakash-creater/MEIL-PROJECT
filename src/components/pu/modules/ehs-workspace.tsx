'use client'
/**
 * EhsWorkspace — MEIL ESG / BRSR Reporting Platform
 *
 * EHS & Sustainability Contributor Workspace:
 * - Level 0: Universal Common Reporting Fields (all 24 fields)
 * - Level EHS-1: Energy Consumption (Grid, Renewable, Fuel, Meter readings)
 * - Level EHS-2: Water Management (Withdrawal, Consumption, Recycling, Discharge, Quality)
 * - Level EHS-3: GHG Emissions & Air Quality Monitoring (Scope 1/2, Pollutants)
 * - Level EHS-4: Waste Management (Hazardous/Non-hazardous, Disposal manifests)
 * - Level EHS-5: Health & Safety Incidents (Near-miss, LTIFR, Root cause, CAPA)
 * - Level EHS-6: Environmental Compliance & Permits (CTO/CTE, EC, Expiries)
 * - Level EHS-7: Environmental Incidents & Spills (Containment & Closure)
 * - Level EHS-8: Sustainability Initiatives & Monitoring (Decarbonization targets)
 * - Screen 1: EHS & Sustainability Console (8 Dashboard Cards + My EHS Assignments Table)
 * - Evidence & Documents Repository
 * - Shared Validation & Multi-state Submission Workflow
 */
import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldAlert, AlertTriangle, Droplets, Flame, Zap, Wind, Trash2,
  FileSearch, Wrench, ShieldCheck, CheckCircle2, Clock, ArrowRight,
  Save, Send, Upload, RefreshCw, Sparkles, Filter, Eye, Edit3, ChevronRight,
  Layers, FileText, TrendingUp, Building2, HardHat, FileCheck2, History, Leaf, X, Check} from 'lucide-react'
import { toast } from 'sonner'
import { FinalSubmitAllModal, SubmitAllSuccessModal } from '@/components/shared/submission-flow-modals'
import { useApp } from '@/lib/pu/auth-context'
import {
  contributorStore,
  type ContributorAssignment,
  type ActivityEvent
} from '@/lib/pu/contributor-store'
import { CommonLevel0Card } from './common-level0-card'
import { CommonEvidenceManager } from './common-evidence-manager'
import { CommonValidationModal } from './common-validation-modal'

/* Sidebar module → default workspace tab */
const MODULE_TABS: Record<string, string> = {
  'ehs-ops': 'overview',
  'ehs-incidents': 'ehs-5',
  'ehs-inspections': 'ehs-6',
  'ehs-corrective': 'ehs-7',
  'ehs-environmental': 'ehs-1',
  evidence: 'evidence',
  submissions: 'submissions',
  activity: 'activity',
}

export function EhsWorkspace() {
  const { activeModule, selectedProjectId } = useApp()
  /* Initialize from the sidebar module — the shell remounts this component on
     every module switch, so the initial value must reflect the active module. */
  const [activeTab, setActiveTab] = useState<string>(() => MODULE_TABS[activeModule] ?? 'overview')
  const [ehsData, setEhsData] = useState(() => contributorStore.getEhsData())
  const [assignments, setAssignments] = useState<ContributorAssignment[]>(() => contributorStore.getAssignments('EHS_USER'))
  const [activities, setActivities] = useState<ActivityEvent[]>(() => contributorStore.getActivities('EHS_USER'))
  const [saveStatus, setSaveStatus] = useState<string>('Saved')
  const [showValidationModal, setShowValidationModal] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  /* ── Real submissions ledger (live WORKFORCE/SAFETY rows) ── */
  const [realSubmissions, setRealSubmissions] = useState<any[]>([])
  const [realSubmissionsLoading, setRealSubmissionsLoading] = useState(false)
  const refreshRealSubmissions = async () => {
    setRealSubmissionsLoading(true)
    try {
      const res = await fetch('/api/pu/submissions?take=100&bypass=true')
      const d = await res.json().catch(() => null)
      const rows: any[] = Array.isArray(d?.items) ? d.items : []
      setRealSubmissions(rows.filter((r) => r.category === 'SAFETY' || r.module === 'SAFETY'))
    } catch {
      setRealSubmissions([])
    } finally {
      setRealSubmissionsLoading(false)
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect -- ENV-pattern mount hydration */
  useEffect(() => {
    refreshRealSubmissions()
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  /* Re-map the active tab when the sidebar module changes — render-time
     adjustment (the sanctioned alternative to setState-in-effect). */
  const [prevModule, setPrevModule] = useState(activeModule)
  if (prevModule !== activeModule) {
    setPrevModule(activeModule)
    const mapped = MODULE_TABS[activeModule]
    if (mapped) setActiveTab(mapped)
  }

  const triggerToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const handleSaveDraft = (levelLabel: string) => {
    const today = new Date().toISOString().split('T')[0]
    if (ehsData.permits.issueDate && ehsData.permits.issueDate > today) {
      triggerToast('Error: Permit issue date cannot be in the future.')
      return
    }
    if (ehsData.permits.issueDate && ehsData.permits.expiryDate && ehsData.permits.expiryDate < ehsData.permits.issueDate) {
      triggerToast('Error: Permit expiry date cannot be earlier than issue date.')
      return
    }
    if (ehsData.water.testDate && ehsData.water.testDate > today) {
      triggerToast('Error: Water test date cannot be in the future.')
      return
    }
    setSaveStatus('Saving...')
    contributorStore.saveEhsData(ehsData)
    setTimeout(() => {
      setSaveStatus('Draft Saved')
      triggerToast(`${levelLabel} draft saved successfully.`)
      contributorStore.addActivity({
        id: 'act-' + Date.now(),
        roleKey: 'EHS_USER',
        timestamp: 'Just now',
        user: 'Praveen Reddy (EHS)',
        action: 'Saved Draft',
        target: levelLabel,
        details: 'EHS environmental/safety parameters updated in local store.',
        badgeTone: 'amber'
      })
      setActivities(contributorStore.getActivities('EHS_USER'))
      setTimeout(() => setSaveStatus('Saved'), 2000)
    }, 400)
  }

  // Energy & Water calculations
  const totalElectricityKwh = (Number(ehsData.energy.gridElectricityKwh) || 0) + (Number(ehsData.energy.renewableElectricityKwh) || 0)
  const renewableElectricityShare = totalElectricityKwh > 0
    ? (((Number(ehsData.energy.renewableElectricityKwh) || 0) / totalElectricityKwh) * 100).toFixed(1)
    : '0'

  const waterRecycleShare = (Number(ehsData.water.quantity) || 0) > 0
    ? (((Number(ehsData.water.recycledReusedQuantity) || 0) / (Number(ehsData.water.quantity) || 1)) * 100).toFixed(1)
    : '0'

  const wasteRecycledShare = (Number(ehsData.waste.quantityGenerated) || 0) > 0
    ? ((((Number(ehsData.waste.quantityReused) || 0) + (Number(ehsData.waste.quantityRecycled) || 0)) / (Number(ehsData.waste.quantityGenerated) || 1)) * 100).toFixed(1)
    : '0'

  const tabList = [
    { id: 'overview', label: 'EHS Console' },
    { id: 'ehs-1', label: 'EHS-1: Energy' },
    { id: 'ehs-2', label: 'EHS-2: Water' },
    { id: 'ehs-3', label: 'EHS-3: Emissions & Air' },
    { id: 'ehs-4', label: 'EHS-4: Waste' },
    { id: 'ehs-5', label: 'EHS-5: Safety Incidents' },
    { id: 'ehs-6', label: 'EHS-6: Permits & CTO' },
    { id: 'ehs-7', label: 'EHS-7: Environmental Incidents' },
    { id: 'ehs-8', label: 'EHS-8: Initiatives' },
    { id: 'evidence', label: 'Evidence & Documents' },
    { id: 'submissions', label: 'My Submissions' },
    { id: 'activity', label: 'Activity Log' }
  ]

  /* ── Level journey — 8 EHS levels, drafts tracked level-by-level ── */
  const EHS_JOURNEY_LEVELS: Array<{ id: string; label: string; level: number; levelName: string; dataKey: string }> = [
    { id: 'ehs-1', label: 'Energy Consumption', level: 1, levelName: 'Energy Consumption (EHS-1)', dataKey: 'energy' },
    { id: 'ehs-2', label: 'Water Management', level: 2, levelName: 'Water Management (EHS-2)', dataKey: 'water' },
    { id: 'ehs-3', label: 'Emissions & Air', level: 3, levelName: 'GHG Emissions & Air Quality (EHS-3)', dataKey: 'ghg' },
    { id: 'ehs-4', label: 'Waste Management', level: 4, levelName: 'Waste Management (EHS-4)', dataKey: 'waste' },
    { id: 'ehs-5', label: 'Safety Incidents', level: 5, levelName: 'Safety Incidents (EHS-5)', dataKey: 'safety' },
    { id: 'ehs-6', label: 'Permits & CTO', level: 6, levelName: 'Permits & CTO Compliance (EHS-6)', dataKey: 'permits' },
    { id: 'ehs-7', label: 'Environmental Incidents', level: 7, levelName: 'Environmental Incidents (EHS-7)', dataKey: 'incidents' },
    { id: 'ehs-8', label: 'Initiatives', level: 8, levelName: 'Sustainability Initiatives (EHS-8)', dataKey: 'initiatives' },
  ]

  const [journeyOpen, setJourneyOpen] = useState(false)
  const [levelDrafts, setLevelDrafts] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('ehs-level-drafts') || '{}') } catch { return {} }
  })
  const [levelSubmitted, setLevelSubmitted] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('ehs-level-submitted') || '{}') } catch { return {} }
  })
  const [levelSubmitting, setLevelSubmitting] = useState<string | null>(null)
  const [showFinalReview, setShowFinalReview] = useState(false)
  const [submittingAll, setSubmittingAll] = useState(false)
  const [showSubmitSuccess, setShowSubmitSuccess] = useState(false)

  const persistJourney = (drafts: Record<string, boolean>, submitted: Record<string, boolean>) => {
    try {
      localStorage.setItem('ehs-level-drafts', JSON.stringify(drafts))
      localStorage.setItem('ehs-level-submitted', JSON.stringify(submitted))
    } catch {}
  }

  const markLevelDrafted = (id: string) => {
    const d = { ...levelDrafts, [id]: true }
    setLevelDrafts(d)
    persistJourney(d, levelSubmitted)
  }

  /* Per-level "Submit to Project Admin" — submits THAT level's data individually. */
  const handleLevelSubmit = async (screenId: string) => {
    const def = EHS_JOURNEY_LEVELS.find(l => l.id === screenId)
    if (!def || levelSubmitting) return
    setLevelSubmitting(screenId)
    try {
      const post = await fetch('/api/pu/data-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: def.level,
          levelKey: 'level' + def.level,
          levelName: def.levelName,
          module: 'SAFETY',
          data: {
            levelData: (ehsData as any)[def.dataKey] ?? {},
            remarks: 'Individual level submission from EHS Contributor Workspace.',
          },
          submitForReview: true,
        }),
      })
      if (!post.ok) {
        const err = await post.json().catch(() => ({}))
        toast.error('Submission failed', { description: (err as any)?.error || 'Server responded ' + post.status })
        return
      }
      const d = { ...levelDrafts, [screenId]: true }
      const s = { ...levelSubmitted, [screenId]: true }
      setLevelDrafts(d)
      setLevelSubmitted(s)
      persistJourney(d, s)
      contributorStore.addActivity({
        id: 'act-' + Date.now(),
        roleKey: 'EHS_USER',
        timestamp: 'Just now',
        user: 'Praveen Reddy (EHS)',
        action: 'Submitted',
        target: def.levelName,
        details: 'Level submitted individually to the Project Admin.',
        badgeTone: 'green'
      })
      setActivities(contributorStore.getActivities('EHS_USER'))
      toast.success(def.levelName + ' submitted to Project Admin')
    } catch (e: any) {
      toast.error('Submission failed', { description: e?.message || 'Network error.' })
    } finally {
      setLevelSubmitting(null)
    }
  }

  /* Consolidated final submit — from the FinalSubmitAllModal. */
  const handleFinalSubmit = async (): Promise<boolean> => {
    setSubmittingAll(true)
    try {
      const post = await fetch('/api/pu/data-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 5,
          levelKey: 'level5',
          levelName: 'BRSR EHS & Safety Package (All Levels)',
          module: 'SAFETY',
          data: {
            energy: ehsData.energy,
            water: ehsData.water,
            ghg: ehsData.ghg,
            waste: ehsData.waste,
            safety: ehsData.safety,
            permits: ehsData.permits,
            incidents: ehsData.incidents,
            initiatives: ehsData.initiatives,
            remarks: 'Final consolidated submission from EHS Contributor Workspace — all levels.',
          },
          submitForReview: true,
        }),
      })
      if (!post.ok) {
        const err = await post.json().catch(() => ({}))
        toast.error('Final submission failed', { description: (err as any)?.error || 'Server responded ' + post.status })
        return false
      }
      const d = { ...levelDrafts }
      const s = { ...levelSubmitted }
      for (const l of EHS_JOURNEY_LEVELS) { d[l.id] = true; s[l.id] = true }
      setLevelDrafts(d)
      setLevelSubmitted(s)
      persistJourney(d, s)
      contributorStore.addActivity({
        id: 'act-' + Date.now(),
        roleKey: 'EHS_USER',
        timestamp: 'Just now',
        user: 'Praveen Reddy (EHS)',
        action: 'Submitted',
        target: 'BRSR EHS & Safety Package',
        details: 'Final consolidated package submitted to the Project Admin.',
        badgeTone: 'green'
      })
      setActivities(contributorStore.getActivities('EHS_USER'))
      setShowFinalReview(false)
      setShowSubmitSuccess(true)
      return true
    } catch (e: any) {
      toast.error('Final submission failed', { description: e?.message || 'Network error.' })
      return false
    } finally {
      setSubmittingAll(false)
    }
  }

  /* allData for the shared FinalSubmitAllModal — ENV-style keyed structure. */
  const ehsAllData: Record<string, any> = {
    [`l1-${selectedProjectId}-current`]: { items: [{ id: 'ehs-1', title: 'Energy Consumption', ...ehsData.energy }] },
    [`l2-${selectedProjectId}-current`]: { items: [{ id: 'ehs-2', title: 'Water Management', ...ehsData.water }] },
    [`l3-${selectedProjectId}-current`]: { items: [{ id: 'ehs-3', title: 'GHG Emissions & Air', ...ehsData.ghg }] },
    [`l4-${selectedProjectId}-current`]: { items: [{ id: 'ehs-4', title: 'Waste Management', ...ehsData.waste }] },
    [`l5-${selectedProjectId}-current`]: { items: [{ id: 'ehs-5', title: 'Safety Incidents', ...ehsData.safety }] },
    [`l6-${selectedProjectId}-current`]: { items: [{ id: 'ehs-6', title: 'Permits & CTO', ...ehsData.permits }] },
    [`l7-${selectedProjectId}-current`]: { items: [{ id: 'ehs-7', title: 'Environmental Incidents', ...ehsData.incidents }] },
    [`l8-${selectedProjectId}-current`]: { items: [{ id: 'ehs-8', title: 'Initiatives', ...ehsData.initiatives }] },
  }

  const ehsModalLevels = EHS_JOURNEY_LEVELS.map(l => ({
    key: l.id, level: l.level, label: l.label,
    icon: l.id === 'ehs-1' ? Zap : l.id === 'ehs-2' ? Droplets : l.id === 'ehs-3' ? Wind : l.id === 'ehs-4' ? Trash2 : l.id === 'ehs-5' ? ShieldCheck : l.id === 'ehs-6' ? FileCheck2 : l.id === 'ehs-7' ? AlertTriangle : Sparkles,
  }))

  return (
    <div className="space-y-6 pb-12">
      {/* Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-50 flex items-center gap-2 rounded-2xl border border-amber-200 bg-white/95 px-4 py-3 shadow-xl shadow-amber-500/10 backdrop-blur-xl text-xs font-bold text-amber-800"
          >
            <CheckCircle2 className="h-4 w-4 text-amber-600" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER SECTION */}
      <div className="relative overflow-hidden glass-form-card md:!p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/25">
                <Leaf className="h-6 w-6" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
                EHS & Sustainability Contributor Workspace
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50/80 px-3 py-1 text-xs font-bold text-amber-700 shadow-xs">
                <Sparkles className="h-3 w-3 text-amber-600" />
                BRSR Principle 2 & 6
              </span>
            </div>
            <p className="text-sm font-medium text-slate-500">
              Energy & Water telemetry · Scope 1/2 GHG activity data · Waste manifests · Occupational safety & CTO compliance
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <span className="rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-xs font-bold text-slate-700 shadow-xs">
              FY 2026-27 (Assigned)
            </span>
          </div>
        </div>

        {/* Tab Sub-Navigation */}
        <div className="mt-6 flex flex-wrap items-center gap-1.5 pt-4 border-t border-slate-100">
          {tabList.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                activeTab === tab.id
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-500/25'
                  : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 1. EHS CONSOLE OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* 8 Dashboard Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3.5">
            {[
              { label: 'Assigned EHS Tasks', val: '4 Modules', sub: 'Site Scope', icon: Layers, tone: 'text-amber-600 bg-amber-50' },
              { label: 'Pending Entries', val: '2 Forms', sub: 'Water & Waste', icon: Clock, tone: 'text-rose-600 bg-rose-50' },
              { label: 'Energy Data Done', val: '90%', sub: '14.25M kWh', icon: Zap, tone: 'text-emerald-600 bg-emerald-50' },
              { label: 'Water Data Done', val: '75%', sub: '142.5 kL', icon: Droplets, tone: 'text-blue-600 bg-blue-50' },
              { label: 'Waste Data Done', val: '45%', sub: 'Needs Form 10', icon: Trash2, tone: 'text-amber-600 bg-amber-50' },
              { label: 'Emissions Done', val: '80%', sub: 'Direct & Grid', icon: Wind, tone: 'text-indigo-600 bg-indigo-50' },
              { label: 'Safety in Review', val: '1 Level', sub: 'Zero Fatalities', icon: ShieldCheck, tone: 'text-emerald-600 bg-emerald-50' },
              { label: 'Missing Evidence', val: '1 Manifest', sub: 'Waste Handler', icon: AlertTriangle, tone: 'text-rose-600 bg-rose-50' },
            ].map((card, i) => (
              <div key={i} className="rounded-[22px] border border-white/60 bg-white/75 p-3.5 shadow-lg shadow-sky-500/5 backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 leading-tight">{card.label}</span>
                  <div className={`p-1 rounded-md ${card.tone}`}>
                    <card.icon className="h-3 w-3" />
                  </div>
                </div>
                <div className="mt-2 text-base font-black text-slate-900">{card.val}</div>
                <div className="text-[10px] text-slate-400 font-medium truncate">{card.sub}</div>
              </div>
            ))}
          </div>

          {/* Environmental Performance Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-[24px] border border-white/60 bg-white/75 p-5 shadow-lg shadow-sky-500/5 backdrop-blur-xl">
              <span className="text-xs font-bold text-slate-500">Energy & Renewable Mix</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">{totalElectricityKwh.toLocaleString()}</span>
                <span className="text-xs font-semibold text-amber-600">kWh Total</span>
              </div>
              <div className="mt-3 text-xs text-slate-500 space-y-1">
                <div className="flex justify-between">
                  <span>Grid Electricity:</span>
                  <span className="font-bold text-slate-800">{Number(ehsData.energy.gridElectricityKwh).toLocaleString()} kWh</span>
                </div>
                <div className="flex justify-between">
                  <span>Renewable Solar:</span>
                  <span className="font-bold text-emerald-600">{Number(ehsData.energy.renewableElectricityKwh).toLocaleString()} kWh</span>
                </div>
                <div className="flex justify-between">
                  <span>Renewable Share:</span>
                  <span className="font-bold text-emerald-700">{renewableElectricityShare}%</span>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/60 bg-white/75 p-5 shadow-lg shadow-sky-500/5 backdrop-blur-xl">
              <span className="text-xs font-bold text-slate-500">Water Balance & Circularity</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">{Number(ehsData.water.quantity).toLocaleString()}</span>
                <span className="text-xs font-semibold text-blue-600">kL Withdrawal</span>
              </div>
              <div className="mt-3 text-xs text-slate-500 space-y-1">
                <div className="flex justify-between">
                  <span>Recycled Quantity:</span>
                  <span className="font-bold text-emerald-600">{Number(ehsData.water.recycledReusedQuantity).toLocaleString()} kL</span>
                </div>
                <div className="flex justify-between">
                  <span>Recycling Ratio:</span>
                  <span className="font-bold text-emerald-700">{waterRecycleShare}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Discharge Quality:</span>
                  <span className="font-bold text-slate-800 truncate max-w-[140px]">100% CPCB Compliant</span>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/60 bg-white/75 p-5 shadow-lg shadow-sky-500/5 backdrop-blur-xl">
              <span className="text-xs font-bold text-slate-500">Occupational Safety Milestones</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">2.84M</span>
                <span className="text-xs font-semibold text-emerald-600">Safe Man-Hours</span>
              </div>
              <div className="mt-3 text-xs text-slate-500 space-y-1">
                <div className="flex justify-between">
                  <span>Fatalities:</span>
                  <span className="font-bold text-emerald-600">0 (Zero)</span>
                </div>
                <div className="flex justify-between">
                  <span>Lost Time Injuries (LTI):</span>
                  <span className="font-bold text-emerald-600">0</span>
                </div>
                <div className="flex justify-between">
                  <span>CTO Status:</span>
                  <span className="font-bold text-emerald-700">Valid (APPCB)</span>
                </div>
              </div>
            </div>
          </div>

          {/* My EHS Assignments Table */}
          <div className="rounded-[24px] border border-white/60 bg-white/75 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">My EHS Assignments</h3>
                <p className="text-xs text-slate-500">Environmental & safety tasks assigned for reporting</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('ehs-1')}
                className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1"
              >
                <span>Enter Environmental Data</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="pb-3">Entity / Site</th>
                    <th className="pb-3">Year</th>
                    <th className="pb-3">EHS Module</th>
                    <th className="pb-3">Completion</th>
                    <th className="pb-3">Evidence</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Last Updated</th>
                    <th className="pb-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assignments.map((asg) => (
                    <tr key={asg.id} className="hover:bg-slate-50/50">
                      <td className="py-3 font-semibold text-slate-800">{asg.entityBu}</td>
                      <td className="py-3 text-slate-600">{asg.reportingYear}</td>
                      <td className="py-3 font-bold text-amber-700">{asg.module}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full" style={{ width: `${asg.completionPercentage}%` }} />
                          </div>
                          <span className="font-bold text-slate-700">{asg.completionPercentage}%</span>
                        </div>
                      </td>
                      <td className="py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          asg.evidenceStatus === 'Attached' || asg.evidenceStatus === 'Verified'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}>
                          {asg.evidenceStatus}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          asg.submissionStatus === 'Submitted' ? 'bg-blue-50 text-blue-700' :
                          asg.submissionStatus === 'Returned for Correction' ? 'bg-rose-50 text-rose-700' :
                          asg.submissionStatus === 'Under Review' ? 'bg-purple-50 text-purple-700' :
                          'bg-amber-50 text-amber-700'
                        }`}>
                          {asg.submissionStatus}
                        </span>
                      </td>
                      <td className="py-3 text-slate-400">{asg.lastUpdated}</td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            if (asg.levelKey === 'EHS-1') setActiveTab('ehs-1')
                            else if (asg.levelKey === 'EHS-2') setActiveTab('ehs-2')
                            else if (asg.levelKey === 'EHS-4') setActiveTab('ehs-4')
                            else if (asg.levelKey === 'EHS-5') setActiveTab('ehs-5')
                            else setActiveTab('ehs-1')
                          }}
                          className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 hover:bg-amber-100 transition-colors"
                        >
                          {asg.submissionStatus === 'Returned for Correction' ? 'Fix Corrections' : 'Enter Data'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. LEVEL EHS-1 — ENERGY CONSUMPTION */}
      {activeTab === 'ehs-1' && (
        <div className="space-y-6">
          {/* Per-level individual submission to Project Admin */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/40 px-4 py-3 backdrop-blur-xl">
            <span className="text-xs font-semibold text-slate-600">
              This level&apos;s data can be submitted individually — it reaches the Project Admin instantly.
            </span>
            <button
              type="button"
              disabled={levelSubmitting === '" + sid + "'}
              onClick={() => handleLevelSubmit('" + sid + "')}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-amber-500/25 transition hover:from-amber-600 hover:to-orange-700 hover:-translate-y-0.5 active:scale-95 disabled:opacity-60"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{levelSubmitting === '" + sid + "' ? 'Submitting…' : 'Submit to Project Admin'}</span>
            </button>
          </div>
          <CommonLevel0Card
            fields={ehsData.energy.common}
            accentColor="amber"
            onChange={(upd) => setEhsData({
              ...ehsData,
              energy: { ...ehsData.energy, common: { ...ehsData.energy.common, ...upd } }
            })}
          />

          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title">Level EHS-1 — Energy Consumption</h3>
              <p className="text-xs text-slate-500">Record electricity, renewable generation, fuel quantities, and meter logs</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="ios-label">Energy Source</label>
                <select
                  value={ehsData.energy.energySource}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    energy: { ...ehsData.energy, energySource: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Grid Electricity">Grid Electricity</option>
                  <option value="Renewable (Solar/Wind)">Renewable (Solar/Wind)</option>
                  <option value="Diesel (DG Sets)">Diesel (DG Sets)</option>
                  <option value="Petrol">Petrol</option>
                  <option value="Natural Gas">Natural Gas</option>
                  <option value="Coal">Coal</option>
                  <option value="Biomass">Biomass</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Grid Electricity (kWh)</label>
                <input
                  type="number"
                  value={ehsData.energy.gridElectricityKwh}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    energy: { ...ehsData.energy, gridElectricityKwh: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Renewable Electricity (kWh)</label>
                <input
                  type="number"
                  value={ehsData.energy.renewableElectricityKwh}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    energy: { ...ehsData.energy, renewableElectricityKwh: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Renewable Share % (Calculated)</label>
                <div className="ios-field !text-xs font-black text-amber-700 !bg-slate-50/70">
                  {renewableElectricityShare}%
                </div>
              </div>

              <div>
                <label className="ios-label">Fuel Type</label>
                <input
                  type="text"
                  value={ehsData.energy.fuelType}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    energy: { ...ehsData.energy, fuelType: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Fuel Quantity</label>
                <input
                  type="number"
                  value={ehsData.energy.fuelQuantity}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    energy: { ...ehsData.energy, fuelQuantity: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Fuel Unit</label>
                <select
                  value={ehsData.energy.fuelUnit}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    energy: { ...ehsData.energy, fuelUnit: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Litres">Litres</option>
                  <option value="Tonnes">Tonnes</option>
                  <option value="SCM">SCM</option>
                  <option value="kg">kg</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Meter / Equipment ID</label>
                <input
                  type="text"
                  value={ehsData.energy.meterEquipmentId}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    energy: { ...ehsData.energy, meterEquipmentId: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Opening Meter Reading</label>
                <input
                  type="number"
                  value={ehsData.energy.openingMeterReading}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    energy: { ...ehsData.energy, openingMeterReading: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Closing Meter Reading</label>
                <input
                  type="number"
                  value={ehsData.energy.closingMeterReading}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    energy: { ...ehsData.energy, closingMeterReading: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="ios-label">Equipment / Process Reference</label>
                <input
                  type="text"
                  value={ehsData.energy.equipmentProcessRef}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    energy: { ...ehsData.energy, equipmentProcessRef: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. LEVEL EHS-2 — WATER MANAGEMENT */}
      {activeTab === 'ehs-2' && (
        <div className="space-y-6">
          {/* Per-level individual submission to Project Admin */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/40 px-4 py-3 backdrop-blur-xl">
            <span className="text-xs font-semibold text-slate-600">
              This level&apos;s data can be submitted individually — it reaches the Project Admin instantly.
            </span>
            <button
              type="button"
              disabled={levelSubmitting === '" + sid + "'}
              onClick={() => handleLevelSubmit('" + sid + "')}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-amber-500/25 transition hover:from-amber-600 hover:to-orange-700 hover:-translate-y-0.5 active:scale-95 disabled:opacity-60"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{levelSubmitting === '" + sid + "' ? 'Submitting…' : 'Submit to Project Admin'}</span>
            </button>
          </div>
          <CommonLevel0Card
            fields={ehsData.water.common}
            accentColor="amber"
            onChange={(upd) => setEhsData({
              ...ehsData,
              water: { ...ehsData.water, common: { ...ehsData.water.common, ...upd } }
            })}
          />

          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title">Level EHS-2 — Water Management</h3>
              <p className="text-xs text-slate-500">Track withdrawal, consumption, recycling, treatment levels, and testing results</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="ios-label">Water Activity</label>
                <select
                  value={ehsData.water.waterActivity}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    water: { ...ehsData.water, waterActivity: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Withdrawal">Withdrawal</option>
                  <option value="Consumption">Consumption</option>
                  <option value="Reuse / Recycling">Reuse / Recycling</option>
                  <option value="Discharge">Discharge</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Water Source</label>
                <select
                  value={ehsData.water.waterSource}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    water: { ...ehsData.water, waterSource: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Surface Water">Surface Water</option>
                  <option value="Groundwater">Groundwater</option>
                  <option value="Third-party / Municipal">Third-party / Municipal</option>
                  <option value="Rainwater Harvested">Rainwater Harvested</option>
                  <option value="Produced Water">Produced Water</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Quantity</label>
                <input
                  type="number"
                  value={ehsData.water.quantity}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    water: { ...ehsData.water, quantity: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Unit</label>
                <select
                  value={ehsData.water.unit}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    water: { ...ehsData.water, unit: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="kL (Kilolitres)">kL (Kilolitres)</option>
                  <option value="m³">m³</option>
                  <option value="Million Litres">Million Litres</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Recycled / Reused Quantity</label>
                <input
                  type="number"
                  value={ehsData.water.recycledReusedQuantity}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    water: { ...ehsData.water, recycledReusedQuantity: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Recycle Share % (Calculated)</label>
                <div className="ios-field !text-xs font-black text-blue-700 !bg-slate-50/70">
                  {waterRecycleShare}%
                </div>
              </div>

              <div>
                <label className="ios-label">Discharge Destination</label>
                <select
                  value={ehsData.water.dischargeDestination}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    water: { ...ehsData.water, dischargeDestination: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Municipal Sewer">Municipal Sewer</option>
                  <option value="Surface Water Body">Surface Water Body</option>
                  <option value="Effluent Treatment Plant (ETP)">Effluent Treatment Plant (ETP)</option>
                  <option value="Zero Liquid Discharge (ZLD)">Zero Liquid Discharge (ZLD)</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Treatment Level</label>
                <select
                  value={ehsData.water.treatmentLevel}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    water: { ...ehsData.water, treatmentLevel: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Primary">Primary</option>
                  <option value="Secondary">Secondary</option>
                  <option value="Tertiary / Advanced RO">Tertiary / Advanced RO</option>
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="ios-label">Water Quality Results</label>
                <input
                  type="text"
                  value={ehsData.water.waterQualityResults}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    water: { ...ehsData.water, waterQualityResults: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Testing Laboratory</label>
                <input
                  type="text"
                  value={ehsData.water.testingLaboratory}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    water: { ...ehsData.water, testingLaboratory: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Test Date (Max Today)</label>
                <input
                  type="date"
                  value={ehsData.water.testDate}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => {
                    const today = new Date().toISOString().split('T')[0]
                    if (e.target.value && e.target.value > today) {
                      triggerToast('Water test date cannot be in the future.')
                    }
                    setEhsData({
                      ...ehsData,
                      water: { ...ehsData.water, testDate: e.target.value }
                    })
                  }}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. LEVEL EHS-3 — GHG EMISSIONS & AIR QUALITY */}
      {activeTab === 'ehs-3' && (
        <div className="space-y-6">
          {/* Per-level individual submission to Project Admin */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/40 px-4 py-3 backdrop-blur-xl">
            <span className="text-xs font-semibold text-slate-600">
              This level&apos;s data can be submitted individually — it reaches the Project Admin instantly.
            </span>
            <button
              type="button"
              disabled={levelSubmitting === '" + sid + "'}
              onClick={() => handleLevelSubmit('" + sid + "')}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-amber-500/25 transition hover:from-amber-600 hover:to-orange-700 hover:-translate-y-0.5 active:scale-95 disabled:opacity-60"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{levelSubmitting === '" + sid + "' ? 'Submitting…' : 'Submit to Project Admin'}</span>
            </button>
          </div>
          <CommonLevel0Card
            fields={ehsData.ghg.common}
            accentColor="amber"
            onChange={(upd) => setEhsData({
              ...ehsData,
              ghg: { ...ehsData.ghg, common: { ...ehsData.ghg.common, ...upd } }
            })}
          />

          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title">Level EHS-3 — GHG Emissions & Air Quality</h3>
              <p className="text-xs text-slate-500">Activity data for Scope 1 & 2 emissions and ambient air quality monitoring</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="ios-label">Emission Scope</label>
                <select
                  value={ehsData.ghg.emissionScope}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    ghg: { ...ehsData.ghg, emissionScope: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Scope 1 (Direct)">Scope 1 (Direct)</option>
                  <option value="Scope 2 (Grid Indirect)">Scope 2 (Grid Indirect)</option>
                  <option value="Scope 3 (Value Chain)">Scope 3 (Value Chain)</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Emission Source</label>
                <input
                  type="text"
                  value={ehsData.ghg.emissionSource}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    ghg: { ...ehsData.ghg, emissionSource: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Activity Quantity</label>
                <input
                  type="number"
                  value={ehsData.ghg.activityQuantity}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    ghg: { ...ehsData.ghg, activityQuantity: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Activity Unit</label>
                <input
                  type="text"
                  value={ehsData.ghg.activityUnit}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    ghg: { ...ehsData.ghg, activityUnit: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="ios-label">Emission Factor Reference</label>
                <input
                  type="text"
                  value={ehsData.ghg.emissionFactorReference}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    ghg: { ...ehsData.ghg, emissionFactorReference: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="ios-label">Source Document</label>
                <input
                  type="text"
                  value={ehsData.ghg.sourceDocument}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    ghg: { ...ehsData.ghg, sourceDocument: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>
            </div>

            {/* Air Quality Monitoring Sub-section */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <h4 className="font-bold text-slate-800 text-xs mb-3 flex items-center gap-2">
                <Wind className="h-4 w-4 text-cyan-600" />
                <span>Ambient Air Quality Monitoring Inputs</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div>
                  <label className="ios-label">Pollutant Type</label>
                  <input
                    type="text"
                    value={ehsData.ghg.pollutantType || ''}
                    onChange={(e) => setEhsData({
                      ...ehsData,
                      ghg: { ...ehsData.ghg, pollutantType: e.target.value }
                    })}
                    className="ios-field !text-xs font-medium text-slate-800"
                  />
                </div>

                <div>
                  <label className="ios-label">Sampling Location</label>
                  <input
                    type="text"
                    value={ehsData.ghg.samplingLocation || ''}
                    onChange={(e) => setEhsData({
                      ...ehsData,
                      ghg: { ...ehsData.ghg, samplingLocation: e.target.value }
                    })}
                    className="ios-field !text-xs font-medium text-slate-800"
                  />
                </div>

                <div>
                  <label className="ios-label">Test Result ({ehsData.ghg.testUnit || 'µg/m³'})</label>
                  <input
                    type="number"
                    value={ehsData.ghg.testResult || 0}
                    onChange={(e) => setEhsData({
                      ...ehsData,
                      ghg: { ...ehsData.ghg, testResult: Number(e.target.value) }
                    })}
                    className="ios-field !text-xs font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="ios-label">Compliance Result</label>
                  <select
                    value={ehsData.ghg.complianceResult || 'Compliant'}
                    onChange={(e) => setEhsData({
                      ...ehsData,
                      ghg: { ...ehsData.ghg, complianceResult: e.target.value as any }
                    })}
                    className="ios-field !text-xs font-medium text-slate-800"
                  >
                    <option value="Compliant">Compliant</option>
                    <option value="Marginal">Marginal</option>
                    <option value="Non-compliant">Non-compliant</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. LEVEL EHS-4 — WASTE MANAGEMENT */}
      {activeTab === 'ehs-4' && (
        <div className="space-y-6">
          {/* Per-level individual submission to Project Admin */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/40 px-4 py-3 backdrop-blur-xl">
            <span className="text-xs font-semibold text-slate-600">
              This level&apos;s data can be submitted individually — it reaches the Project Admin instantly.
            </span>
            <button
              type="button"
              disabled={levelSubmitting === '" + sid + "'}
              onClick={() => handleLevelSubmit('" + sid + "')}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-amber-500/25 transition hover:from-amber-600 hover:to-orange-700 hover:-translate-y-0.5 active:scale-95 disabled:opacity-60"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{levelSubmitting === '" + sid + "' ? 'Submitting…' : 'Submit to Project Admin'}</span>
            </button>
          </div>
          <CommonLevel0Card
            fields={ehsData.waste.common}
            accentColor="amber"
            onChange={(upd) => setEhsData({
              ...ehsData,
              waste: { ...ehsData.waste, common: { ...ehsData.waste.common, ...upd } }
            })}
          />

          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title">Level EHS-4 — Waste Management</h3>
              <p className="text-xs text-slate-500">Categorize hazardous & non-hazardous streams, disposal methods and Form 10 manifests</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="ios-label">Waste Category</label>
                <select
                  value={ehsData.waste.wasteCategory}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    waste: { ...ehsData.waste, wasteCategory: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Construction & Demolition">Construction & Demolition</option>
                  <option value="Plastic Waste">Plastic Waste</option>
                  <option value="E-Waste">E-Waste</option>
                  <option value="Hazardous Chemical Waste">Hazardous Chemical Waste</option>
                  <option value="Bio-medical Waste">Bio-medical Waste</option>
                  <option value="Used Oil / Batteries">Used Oil / Batteries</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Classification</label>
                <select
                  value={ehsData.waste.classification}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    waste: { ...ehsData.waste, classification: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Non-hazardous">Non-hazardous</option>
                  <option value="Hazardous">Hazardous</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Quantity Generated</label>
                <input
                  type="number"
                  value={ehsData.waste.quantityGenerated}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    waste: { ...ehsData.waste, quantityGenerated: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Measurement Unit</label>
                <select
                  value={ehsData.waste.unit}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    waste: { ...ehsData.waste, unit: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Tonnes">Tonnes</option>
                  <option value="kg">kg</option>
                  <option value="m³">m³</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Quantity Reused</label>
                <input
                  type="number"
                  value={ehsData.waste.quantityReused}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    waste: { ...ehsData.waste, quantityReused: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Quantity Recycled</label>
                <input
                  type="number"
                  value={ehsData.waste.quantityRecycled}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    waste: { ...ehsData.waste, quantityRecycled: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Quantity Disposed</label>
                <input
                  type="number"
                  value={ehsData.waste.quantityDisposed}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    waste: { ...ehsData.waste, quantityDisposed: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Recovery & Recycling %</label>
                <div className="ios-field !text-xs font-black text-amber-700 !bg-slate-50/70">
                  {wasteRecycledShare}%
                </div>
              </div>

              <div>
                <label className="ios-label">Disposal Method</label>
                <select
                  value={ehsData.waste.disposalMethod}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    waste: { ...ehsData.waste, disposalMethod: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Authorized Recycler">Authorized Recycler</option>
                  <option value="TSDF Landfill">TSDF Landfill</option>
                  <option value="Incineration">Incineration</option>
                  <option value="Composting">Composting</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Waste Handler Agency</label>
                <input
                  type="text"
                  value={ehsData.waste.wasteHandlerAgency}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    waste: { ...ehsData.waste, wasteHandlerAgency: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Authorization Reference</label>
                <input
                  type="text"
                  value={ehsData.waste.authorizationReference}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    waste: { ...ehsData.waste, authorizationReference: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Manifest Reference (Form 10)</label>
                <input
                  type="text"
                  value={ehsData.waste.transferManifestRef}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    waste: { ...ehsData.waste, transferManifestRef: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. LEVEL EHS-5 — SAFETY INCIDENTS */}
      {activeTab === 'ehs-5' && (
        <div className="space-y-6">
          {/* Per-level individual submission to Project Admin */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/40 px-4 py-3 backdrop-blur-xl">
            <span className="text-xs font-semibold text-slate-600">
              This level&apos;s data can be submitted individually — it reaches the Project Admin instantly.
            </span>
            <button
              type="button"
              disabled={levelSubmitting === '" + sid + "'}
              onClick={() => handleLevelSubmit('" + sid + "')}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-amber-500/25 transition hover:from-amber-600 hover:to-orange-700 hover:-translate-y-0.5 active:scale-95 disabled:opacity-60"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{levelSubmitting === '" + sid + "' ? 'Submitting…' : 'Submit to Project Admin'}</span>
            </button>
          </div>
          <CommonLevel0Card
            fields={ehsData.safety.common}
            accentColor="amber"
            onChange={(upd) => setEhsData({
              ...ehsData,
              safety: { ...ehsData.safety, common: { ...ehsData.safety.common, ...upd } }
            })}
          />

          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title">Level EHS-5 — Health & Safety Incidents</h3>
              <p className="text-xs text-slate-500">Record injury classifications, person-hours, root cause, and CAPA closure</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="ios-label">Incident ID</label>
                <input
                  type="text"
                  value={ehsData.safety.incidentId}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    safety: { ...ehsData.safety, incidentId: e.target.value }
                  })}
                  className="ios-field !text-xs font-mono font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Incident Date / Time</label>
                <input
                  type="text"
                  value={ehsData.safety.incidentDateTime}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    safety: { ...ehsData.safety, incidentDateTime: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Incident Type</label>
                <select
                  value={ehsData.safety.incidentType}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    safety: { ...ehsData.safety, incidentType: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Near Miss">Near Miss</option>
                  <option value="Minor Injury (First Aid)">Minor Injury (First Aid)</option>
                  <option value="Lost Time Injury (LTI)">Lost Time Injury (LTI)</option>
                  <option value="Dangerous Occurrence">Dangerous Occurrence</option>
                  <option value="Fatality">Fatality</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Severity Classification</label>
                <select
                  value={ehsData.safety.severityClassification}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    safety: { ...ehsData.safety, severityClassification: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Catastrophic">Catastrophic</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Lost Workdays</label>
                <input
                  type="number"
                  value={ehsData.safety.lostWorkdays}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    safety: { ...ehsData.safety, lostWorkdays: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Fatality Count</label>
                <input
                  type="number"
                  value={ehsData.safety.fatalityCount}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    safety: { ...ehsData.safety, fatalityCount: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Person-hours Worked</label>
                <input
                  type="number"
                  value={ehsData.safety.personHoursWorked}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    safety: { ...ehsData.safety, personHoursWorked: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Responsible Owner</label>
                <input
                  type="text"
                  value={ehsData.safety.responsibleOwner}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    safety: { ...ehsData.safety, responsibleOwner: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="ios-label">Corrective / Preventive Action (CAPA)</label>
                <input
                  type="text"
                  value={ehsData.safety.correctivePreventiveAction}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    safety: { ...ehsData.safety, correctivePreventiveAction: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Due Date</label>
                <input
                  type="date"
                  value={ehsData.safety.dueDate}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    safety: { ...ehsData.safety, dueDate: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Closure Date</label>
                <input
                  type="date"
                  value={ehsData.safety.closureDate}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    safety: { ...ehsData.safety, closureDate: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. LEVEL EHS-6 — ENVIRONMENTAL COMPLIANCE & PERMITS */}
      {activeTab === 'ehs-6' && (
        <div className="space-y-6">
          {/* Per-level individual submission to Project Admin */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/40 px-4 py-3 backdrop-blur-xl">
            <span className="text-xs font-semibold text-slate-600">
              This level&apos;s data can be submitted individually — it reaches the Project Admin instantly.
            </span>
            <button
              type="button"
              disabled={levelSubmitting === '" + sid + "'}
              onClick={() => handleLevelSubmit('" + sid + "')}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-amber-500/25 transition hover:from-amber-600 hover:to-orange-700 hover:-translate-y-0.5 active:scale-95 disabled:opacity-60"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{levelSubmitting === '" + sid + "' ? 'Submitting…' : 'Submit to Project Admin'}</span>
            </button>
          </div>
          <CommonLevel0Card
            fields={ehsData.permits.common}
            accentColor="amber"
            onChange={(upd) => setEhsData({
              ...ehsData,
              permits: { ...ehsData.permits, common: { ...ehsData.permits.common, ...upd } }
            })}
          />

          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title">Level EHS-6 — Environmental Compliance & Permits</h3>
              <p className="text-xs text-slate-500">Track statutory consent orders, CTO/CTE validity, inspections, and renewal schedules</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="ios-label">Permit / Consent Type</label>
                <select
                  value={ehsData.permits.permitType}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    permits: { ...ehsData.permits, permitType: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Consent to Operate (CTO)">Consent to Operate (CTO)</option>
                  <option value="Consent to Establish (CTE)">Consent to Establish (CTE)</option>
                  <option value="Environmental Clearance (EC)">Environmental Clearance (EC)</option>
                  <option value="Factory License">Factory License</option>
                  <option value="Groundwater NOC">Groundwater NOC</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Permit Number</label>
                <input
                  type="text"
                  value={ehsData.permits.permitNumber}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    permits: { ...ehsData.permits, permitNumber: e.target.value }
                  })}
                  className="ios-field !text-xs font-mono font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Issuing Authority</label>
                <select
                  value={ehsData.permits.issuingAuthority}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    permits: { ...ehsData.permits, issuingAuthority: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="SPCB / CPCB">SPCB / CPCB</option>
                  <option value="MoEFCC">MoEFCC</option>
                  <option value="State Directorate of Factories">State Directorate of Factories</option>
                  <option value="CGWA">CGWA</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Renewal Status</label>
                <select
                  value={ehsData.permits.renewalStatus}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    permits: { ...ehsData.permits, renewalStatus: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Valid">Valid</option>
                  <option value="Renewal Applied">Renewal Applied</option>
                  <option value="Expiring in 60 Days">Expiring in 60 Days</option>
                  <option value="Expired">Expired</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Issue Date (Max Today)</label>
                <input
                  type="date"
                  value={ehsData.permits.issueDate}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => {
                    const today = new Date().toISOString().split('T')[0]
                    const val = e.target.value
                    if (val && val > today) {
                      triggerToast('Issue date cannot be in the future.')
                    }
                    if (val && ehsData.permits.expiryDate && ehsData.permits.expiryDate < val) {
                      triggerToast('Warning: Expiry date is earlier than the issue date.')
                    }
                    setEhsData({
                      ...ehsData,
                      permits: { ...ehsData.permits, issueDate: val }
                    })
                  }}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Expiry Date (On/After Issue Date)</label>
                <input
                  type="date"
                  value={ehsData.permits.expiryDate}
                  min={ehsData.permits.issueDate || undefined}
                  onChange={(e) => {
                    const val = e.target.value
                    if (ehsData.permits.issueDate && val && val < ehsData.permits.issueDate) {
                      triggerToast('Expiry date cannot be earlier than issue date.')
                      return
                    }
                    setEhsData({
                      ...ehsData,
                      permits: { ...ehsData.permits, expiryDate: val }
                    })
                  }}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="ios-label">Inspection Findings</label>
                <input
                  type="text"
                  value={ehsData.permits.inspectionFindings}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    permits: { ...ehsData.permits, inspectionFindings: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. LEVEL EHS-7 — ENVIRONMENTAL INCIDENTS & SPILLS */}
      {activeTab === 'ehs-7' && (
        <div className="space-y-6">
          {/* Per-level individual submission to Project Admin */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/40 px-4 py-3 backdrop-blur-xl">
            <span className="text-xs font-semibold text-slate-600">
              This level&apos;s data can be submitted individually — it reaches the Project Admin instantly.
            </span>
            <button
              type="button"
              disabled={levelSubmitting === '" + sid + "'}
              onClick={() => handleLevelSubmit('" + sid + "')}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-amber-500/25 transition hover:from-amber-600 hover:to-orange-700 hover:-translate-y-0.5 active:scale-95 disabled:opacity-60"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{levelSubmitting === '" + sid + "' ? 'Submitting…' : 'Submit to Project Admin'}</span>
            </button>
          </div>
          <CommonLevel0Card
            fields={ehsData.incidents.common}
            accentColor="amber"
            onChange={(upd) => setEhsData({
              ...ehsData,
              incidents: { ...ehsData.incidents, common: { ...ehsData.incidents.common, ...upd } }
            })}
          />

          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title">Level EHS-7 — Environmental Incidents & Spills</h3>
              <p className="text-xs text-slate-500">Record chemical spills, effluent discharges, containment and regulatory reporting</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="ios-label">Incident ID</label>
                <input
                  type="text"
                  value={ehsData.incidents.incidentId}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    incidents: { ...ehsData.incidents, incidentId: e.target.value }
                  })}
                  className="ios-field !text-xs font-mono font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Incident Category</label>
                <select
                  value={ehsData.incidents.incidentCategory}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    incidents: { ...ehsData.incidents, incidentCategory: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Chemical Spill">Chemical Spill</option>
                  <option value="Gas Leak">Gas Leak</option>
                  <option value="Effluent Overflow">Effluent Overflow</option>
                  <option value="Unauthorized Emission">Unauthorized Emission</option>
                  <option value="Fire Incident">Fire Incident</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Environmental Medium</label>
                <select
                  value={ehsData.incidents.environmentalMedium}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    incidents: { ...ehsData.incidents, environmentalMedium: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Soil">Soil</option>
                  <option value="Air">Air</option>
                  <option value="Water">Water</option>
                  <option value="Groundwater">Groundwater</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Current Status</label>
                <select
                  value={ehsData.incidents.currentStatus}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    incidents: { ...ehsData.incidents, currentStatus: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Contained & Closed">Contained & Closed</option>
                  <option value="Under Investigation">Under Investigation</option>
                  <option value="Remediation in Progress">Remediation in Progress</option>
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="ios-label">Immediate Response</label>
                <input
                  type="text"
                  value={ehsData.incidents.immediateResponse}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    incidents: { ...ehsData.incidents, immediateResponse: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="ios-label">Corrective Action Taken</label>
                <input
                  type="text"
                  value={ehsData.incidents.correctiveAction}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    incidents: { ...ehsData.incidents, correctiveAction: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 9. LEVEL EHS-8 — SUSTAINABILITY INITIATIVES */}
      {activeTab === 'ehs-8' && (
        <div className="space-y-6">
          {/* Per-level individual submission to Project Admin */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/40 px-4 py-3 backdrop-blur-xl">
            <span className="text-xs font-semibold text-slate-600">
              This level&apos;s data can be submitted individually — it reaches the Project Admin instantly.
            </span>
            <button
              type="button"
              disabled={levelSubmitting === '" + sid + "'}
              onClick={() => handleLevelSubmit('" + sid + "')}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-amber-500/25 transition hover:from-amber-600 hover:to-orange-700 hover:-translate-y-0.5 active:scale-95 disabled:opacity-60"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{levelSubmitting === '" + sid + "' ? 'Submitting…' : 'Submit to Project Admin'}</span>
            </button>
          </div>
          <CommonLevel0Card
            fields={ehsData.initiatives.common}
            accentColor="amber"
            onChange={(upd) => setEhsData({
              ...ehsData,
              initiatives: { ...ehsData.initiatives, common: { ...ehsData.initiatives.common, ...upd } }
            })}
          />

          <div className="glass-form-card space-y-6">
            <div>
              <h3 className="form-card-title">Level EHS-8 — Sustainability Initiatives</h3>
              <p className="text-xs text-slate-500">Track green building, renewable transition, afforestation, and water recharge targets</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="lg:col-span-2">
                <label className="ios-label">Initiative Name</label>
                <input
                  type="text"
                  value={ehsData.initiatives.initiativeName}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    initiatives: { ...ehsData.initiatives, initiativeName: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Initiative Category</label>
                <select
                  value={ehsData.initiatives.initiativeCategory}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    initiatives: { ...ehsData.initiatives, initiativeCategory: e.target.value as any }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                >
                  <option value="Renewable Transition">Renewable Transition</option>
                  <option value="Energy Conservation">Energy Conservation</option>
                  <option value="Water Conservation (Rainwater Harvesting)">Water Conservation</option>
                  <option value="Circular Waste">Circular Waste</option>
                  <option value="Tree Plantation / Afforestation">Tree Plantation</option>
                </select>
              </div>

              <div>
                <label className="ios-label">Measurement Unit</label>
                <input
                  type="text"
                  value={ehsData.initiatives.measurementUnit}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    initiatives: { ...ehsData.initiatives, measurementUnit: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Baseline Value</label>
                <input
                  type="number"
                  value={ehsData.initiatives.baselineValue}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    initiatives: { ...ehsData.initiatives, baselineValue: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Target Value</label>
                <input
                  type="number"
                  value={ehsData.initiatives.targetValue}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    initiatives: { ...ehsData.initiatives, targetValue: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Actual Result Achieved</label>
                <input
                  type="number"
                  value={ehsData.initiatives.actualResult}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    initiatives: { ...ehsData.initiatives, actualResult: Number(e.target.value) }
                  })}
                  className="ios-field !text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="ios-label">Responsible Owner</label>
                <input
                  type="text"
                  value={ehsData.initiatives.responsibleOwner}
                  onChange={(e) => setEhsData({
                    ...ehsData,
                    initiatives: { ...ehsData.initiatives, responsibleOwner: e.target.value }
                  })}
                  className="ios-field !text-xs font-medium text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 10. EVIDENCE TAB */}
      {/* ─────────────────────────────────────────────────────────────
          BOTTOM ACTION BAR (iOS Liquid Glass Sticky Bar)
          ───────────────────────────────────────────────────────────── */}
      {activeTab !== 'evidence' && activeTab !== 'submissions' && activeTab !== 'activity' && (
        <div className="sticky bottom-4 z-30">
          <div className="relative overflow-hidden rounded-[22px] border border-white/80 bg-white/85 px-5 py-3.5 shadow-[0_18px_44px_-12px_rgba(245,158,11,0.28)] backdrop-blur-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                <span>Changes auto-persisted · Save each level, then Validate &amp; Continue for the journey review</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { handleSaveDraft(activeTab.toUpperCase()); markLevelDrafted(activeTab) }}
                  className="ios-btn-ghost"
                >
                  <Save className="h-4 w-4" />
                  <span>{saveStatus}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setJourneyOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-amber-500/25 transition-all hover:from-amber-600 hover:to-orange-700 hover:-translate-y-0.5 active:scale-95 cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Validate &amp; Continue</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── RIGHT-SIDE JOURNEY PANEL — level-by-level draft tracker ── */}
      <AnimatePresence>
        {journeyOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setJourneyOpen(false)}
              className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: 480 }}
              animate={{ x: 0 }}
              exit={{ x: 480 }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-hidden border-l border-white/80 bg-white/90 shadow-2xl backdrop-blur-2xl"
            >
              <div className="relative overflow-hidden border-b border-white/70 bg-gradient-to-br from-amber-500 to-orange-600 p-5 text-white">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-white/20 to-transparent" />
                <div className="relative z-10 flex items-start justify-between">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-100">Level Journey</div>
                    <h3 className="mt-0.5 text-lg font-black">EHS Disclosure Levels</h3>
                    <p className="mt-0.5 text-[11px] text-amber-100/90">
                      {EHS_JOURNEY_LEVELS.filter(l => levelDrafts[l.id] || levelSubmitted[l.id]).length} of {EHS_JOURNEY_LEVELS.length} levels drafted — finish all to unlock the final review
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setJourneyOpen(false)}
                    className="rounded-full p-1.5 text-white/80 transition hover:bg-white/20 hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto p-4 scroll-elegant">
                {EHS_JOURNEY_LEVELS.map((l, idx) => {
                  const submitted = levelSubmitted[l.id]
                  const drafted = levelDrafts[l.id]
                  const isCurrent = activeTab === l.id
                  return (
                    <div
                      key={l.id}
                      className={`flex items-center gap-3 rounded-2xl border p-3 transition ${
                        submitted ? 'border-emerald-200 bg-emerald-50/70'
                        : drafted ? 'border-amber-200 bg-amber-50/60'
                        : isCurrent ? 'border-blue-200 bg-blue-50/60'
                        : 'border-slate-200 bg-white/80'
                      }`}
                    >
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${
                        submitted ? 'bg-emerald-500 text-white'
                        : drafted ? 'bg-amber-500 text-white'
                        : 'border border-slate-300 bg-white text-slate-400'
                      }`}>
                        {submitted ? <CheckCircle2 className="h-4 w-4" /> : drafted ? <Check className="h-4 w-4" /> : idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-bold text-slate-900">{l.label}</div>
                        <div className="text-[10px] font-semibold text-slate-400">
                          {submitted ? 'Submitted to Project Admin' : drafted ? 'Draft saved — ready to submit' : 'Not started'}
                        </div>
                      </div>
                      {!isCurrent && (
                        <button
                          type="button"
                          onClick={() => { setActiveTab(l.id); setJourneyOpen(false) }}
                          className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600 transition hover:bg-slate-50"
                        >
                          Go
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="border-t border-slate-200/80 bg-white/70 p-4">
                {(() => {
                  const doneCount = EHS_JOURNEY_LEVELS.filter(l => levelDrafts[l.id] || levelSubmitted[l.id]).length
                  const allDone = doneCount === EHS_JOURNEY_LEVELS.length
                  return (
                    <>
                      <div className="mb-2.5 flex items-center justify-between text-[11px] font-bold">
                        <span className="text-slate-500">Journey progress</span>
                        <span className={allDone ? 'text-emerald-600' : 'text-slate-600'}>{doneCount}/{EHS_JOURNEY_LEVELS.length}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-600 transition-all duration-500" style={{ width: `${(doneCount / EHS_JOURNEY_LEVELS.length) * 100}%` }} />
                      </div>
                      <button
                        type="button"
                        disabled={!allDone || submittingAll}
                        onClick={() => setShowFinalReview(true)}
                        title={allDone ? 'Open the consolidated final review' : 'Draft all levels to unlock the final review'}
                        className={`mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-xs font-extrabold transition ${
                          allDone
                            ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/25 hover:from-amber-600 hover:to-orange-700'
                            : 'cursor-not-allowed bg-slate-100 text-slate-400'
                        }`}
                      >
                        <FileCheck2 className="h-4 w-4" />
                        <span>{allDone ? 'Final Review & Submit' : 'Final Review & Submit (locked)'}</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </>
                  )
                })()}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── FINAL REVIEW — full-screen review of every entered level ── */}
      <FinalSubmitAllModal
        open={showFinalReview}
        onClose={() => !submittingAll && setShowFinalReview(false)}
        projectName="EHS & Sustainability Contributor"
        periodLabel="FY 2026-27"
        submitting={submittingAll}
        onSubmitAll={handleFinalSubmit}
        levels={ehsModalLevels}
        allData={ehsAllData}
        projectId={selectedProjectId || null}
        periodId="current"
        submitterRole="EHS / Safety Contributor"
      />

      {/* ── Success confirmation ── */}
      <SubmitAllSuccessModal
        open={showSubmitSuccess}
        onClose={() => {
          setShowSubmitSuccess(false)
          setActiveTab('submissions')
        }}
        projectName="EHS & Sustainability Contributor"
        periodLabel="FY 2026-27"
        submittedCount={EHS_JOURNEY_LEVELS.length}
        totalLevels={EHS_JOURNEY_LEVELS.length}
      />

      {activeTab === 'evidence' && (
        <CommonEvidenceManager roleKey="EHS_USER" accentColor="amber" />
      )}

      {/* 11. SUBMISSIONS TAB */}
      {activeTab === 'submissions' && (
        <div className="space-y-6">
          <div className="glass-form-card">
            <h3 className="text-lg font-black text-slate-900 mb-1">My EHS Submissions — Live Ledger</h3>
            <p className="text-xs text-slate-500 mb-4">Real SAFETY submissions — reviewer notes &amp; decisions from the Project Admin, updated every 15s</p>
            <div className="space-y-2.5">
              {realSubmissionsLoading && (
                <div className="rounded-2xl border border-white/70 bg-white/75 px-4 py-8 text-center text-xs font-semibold text-slate-400 backdrop-blur-xl">Loading your submissions…</div>
              )}
              {!realSubmissionsLoading && realSubmissions.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-10 text-center text-xs font-semibold text-slate-400 backdrop-blur-xl">
                  No SAFETY submissions yet — use Submit to Project Admin on any level.
                </div>
              )}
              {realSubmissions.map((sub: any) => (
                <div key={sub.id} className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur-xl">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-amber-200 bg-amber-50/80 px-2.5 py-0.5 font-mono text-[10px] font-bold text-amber-700">
                          {sub.ref || `SUB-${sub.id.slice(-6).toUpperCase()}`}
                        </span>
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                          ['APPROVED', 'ACTIVE'].includes(String(sub.status).toUpperCase()) ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : ['CORRECTION_REQUESTED', 'REJECTED'].includes(String(sub.status).toUpperCase()) ? 'border-rose-200 bg-rose-50 text-rose-700'
                          : 'border-blue-200 bg-blue-50 text-blue-700'
                        }`}>
                          {String(sub.status).replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="mt-1.5 truncate text-sm font-bold text-slate-900">{sub.title}</div>
                      <div className="mt-0.5 text-[11px] font-medium text-slate-500">
                        {sub.project?.name || '—'} · {sub.reportingPeriod?.periodLabel || '—'} · {sub.formattedDateTime || (sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : '—')}
                      </div>
                      {sub.reviewComment && (
                        <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-rose-200 bg-rose-50/80 px-2.5 py-1.5 text-[11px] font-medium text-rose-800">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <span>Reviewer: &quot;{sub.reviewComment}&quot;</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* legacy demo block (disabled) */}
      {false && (
        <div className="space-y-6">
          <div className="glass-form-card">
            <h3 className="text-lg font-black text-slate-900 mb-1">My EHS Submissions History</h3>
            <p className="text-xs text-slate-500 mb-4">Complete audit trail of environmental telemetry and safety submissions</p>
            <div className="divide-y divide-slate-100 text-xs">
              {assignments.map((asg) => (
                <div key={asg.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 text-sm">{asg.module}</span>
                      <span className="text-[11px] font-semibold text-slate-500">({asg.reportingYear})</span>
                    </div>
                    <p className="text-slate-500 text-xs mt-0.5">{asg.description}</p>
                    {asg.criticalWarning && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md inline-block">
                        <AlertTriangle className="h-3 w-3" />
                        <span>{asg.criticalWarning}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 rounded-full font-bold text-[11px] ${
                      asg.submissionStatus === 'Submitted' ? 'bg-blue-100 text-blue-800' :
                      asg.submissionStatus === 'Returned for Correction' ? 'bg-rose-100 text-rose-800' :
                      asg.submissionStatus === 'Under Review' ? 'bg-purple-100 text-purple-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {asg.submissionStatus}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowValidationModal(true)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Audit Trail
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 12. ACTIVITY LOG TAB */}
      {activeTab === 'activity' && (
        <div className="glass-form-card">
          <div className="flex items-center gap-2 mb-4">
            <History className="h-5 w-5 text-amber-600" />
            <h3 className="text-base font-bold text-slate-900">EHS Contributor Activity Log</h3>
          </div>
          <div className="space-y-3">
            {activities.map((act) => (
              <div key={act.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 flex items-start justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">{act.user}</span>
                    <span className="rounded-md bg-amber-100 text-amber-800 px-1.5 py-0.5 text-[10px] font-bold">{act.action}</span>
                    <span className="font-semibold text-slate-600">• {act.target}</span>
                  </div>
                  <p className="text-slate-500 mt-1">{act.details}</p>
                </div>
                <span className="text-[11px] text-slate-400 whitespace-nowrap">{act.timestamp}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Validation & Submit Modal */}
      <CommonValidationModal
        isOpen={showValidationModal}
        onClose={() => setShowValidationModal(false)}
        roleKey="EHS_USER"
        levelName={activeTab.toUpperCase()}
        onSubmitSuccess={() => {
          setAssignments(contributorStore.getAssignments('EHS_USER'))
          setActivities(contributorStore.getActivities('EHS_USER'))
        }}
      />
    </div>
  )
}
