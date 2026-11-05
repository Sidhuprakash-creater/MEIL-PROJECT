'use client'

/**
 * iOS LiquidGlass vibrant color tokens for captured emission sources
 */
function getLiquidGlassSourceStyle(sourceName: string, levelKey: string) {
  const s = (sourceName || '').toLowerCase()
  if (levelKey === 'level1') {
    if (s.includes('grid')) {
      return {
        bg: 'bg-gradient-to-r from-blue-100/95 via-sky-50 to-blue-50/90',
        border: 'border-blue-300/90 hover:border-blue-400',
        text: 'text-blue-950',
        subtext: 'text-blue-700',
        badge: 'bg-blue-200/90 text-blue-900 border border-blue-300',
        ghg: 'text-blue-700',
        icon: Zap,
      }
    }
    if (s.includes('diesel') || s.includes('hsd')) {
      return {
        bg: 'bg-gradient-to-r from-amber-100/95 via-orange-50 to-amber-50/90',
        border: 'border-amber-300/90 hover:border-amber-400',
        text: 'text-amber-950',
        subtext: 'text-amber-700',
        badge: 'bg-amber-200/90 text-amber-900 border border-amber-300',
        ghg: 'text-amber-700',
        icon: Fuel,
      }
    }
    if (s.includes('petrol') || s.includes('fuel')) {
      return {
        bg: 'bg-gradient-to-r from-orange-100/95 via-rose-50 to-orange-50/90',
        border: 'border-orange-300/90 hover:border-orange-400',
        text: 'text-orange-950',
        subtext: 'text-orange-700',
        badge: 'bg-orange-200/90 text-orange-900 border border-orange-300',
        ghg: 'text-orange-700',
        icon: Fuel,
      }
    }
    if (s.includes('renewable') || s.includes('solar') || s.includes('wind')) {
      return {
        bg: 'bg-gradient-to-r from-emerald-100/95 via-teal-50 to-emerald-50/90',
        border: 'border-emerald-300/90 hover:border-emerald-400',
        text: 'text-emerald-950',
        subtext: 'text-emerald-700',
        badge: 'bg-emerald-200/90 text-emerald-900 border border-emerald-300',
        ghg: 'text-emerald-700',
        icon: Sun,
      }
    }
    if (s.includes('gas') || s.includes('lpg') || s.includes('cng') || s.includes('png')) {
      return {
        bg: 'bg-gradient-to-r from-yellow-100/95 via-amber-50 to-yellow-50/90',
        border: 'border-yellow-300/90 hover:border-yellow-400',
        text: 'text-amber-950',
        subtext: 'text-amber-700',
        badge: 'bg-yellow-200/90 text-amber-900 border border-yellow-300',
        ghg: 'text-amber-700',
        icon: Flame,
      }
    }
    if (s.includes('coal')) {
      return {
        bg: 'bg-gradient-to-r from-slate-200/95 via-zinc-100 to-slate-100/90',
        border: 'border-slate-300/90 hover:border-slate-400',
        text: 'text-slate-950',
        subtext: 'text-slate-700',
        badge: 'bg-slate-300 text-slate-900 border border-slate-400',
        ghg: 'text-slate-700',
        icon: Flame,
      }
    }
    return {
      bg: 'bg-gradient-to-r from-indigo-100/95 via-sky-50 to-purple-50/90',
      border: 'border-indigo-300/90 hover:border-indigo-400',
      text: 'text-indigo-950',
      subtext: 'text-indigo-700',
      badge: 'bg-indigo-200/90 text-indigo-900 border border-indigo-300',
      ghg: 'text-indigo-700',
      icon: Zap,
    }
  }
  if (levelKey === 'level2') {
    return {
      bg: 'bg-gradient-to-r from-cyan-100/95 via-sky-50 to-cyan-50/90',
      border: 'border-cyan-300/90 hover:border-cyan-400',
      text: 'text-cyan-950',
      subtext: 'text-cyan-700',
      badge: 'bg-cyan-200/90 text-cyan-900 border border-cyan-300',
      ghg: 'text-cyan-700',
      icon: Droplets,
    }
  }
  if (levelKey === 'level3') {
    return {
      bg: 'bg-gradient-to-r from-emerald-100/95 via-teal-50 to-emerald-50/90',
      border: 'border-emerald-300/90 hover:border-emerald-400',
      text: 'text-emerald-950',
      subtext: 'text-emerald-700',
      badge: 'bg-emerald-200/90 text-emerald-900 border border-emerald-300',
      ghg: 'text-emerald-700',
      icon: CloudFog,
    }
  }
  if (levelKey === 'level4') {
    return {
      bg: 'bg-gradient-to-r from-amber-100/95 via-rose-50 to-orange-50/90',
      border: 'border-amber-300/90 hover:border-amber-400',
      text: 'text-amber-950',
      subtext: 'text-amber-700',
      badge: 'bg-amber-200/90 text-amber-900 border border-amber-300',
      ghg: 'text-amber-700',
      icon: Trash2,
    }
  }
  return {
    bg: 'bg-gradient-to-r from-slate-100/95 via-white to-slate-50/90',
    border: 'border-slate-300/90 hover:border-slate-400',
    text: 'text-slate-900',
    subtext: 'text-slate-600',
    badge: 'bg-slate-200 text-slate-800 border border-slate-300',
    ghg: 'text-slate-700',
    icon: Activity,
  }
}
import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap,
  Droplets,
  CloudFog,
  Trash2,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  Clock,
  ArrowRight,
  ChevronRight,
  ChevronDown,
  Eye,
  FileText,
  Layers,
  Flame,
  Check,
  Fuel,
  Sun,
  Activity,
  Compass,
  FileCheck2,
  Send,
  CornerDownRight
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/* =====================================================================
   Apple WidgetKit Liquid Glass Design Tokens & Types
   Based on: WidgetKit-Implementing-Liquid-Glass-Design.md
   ===================================================================== */
export interface EmissionSourceItem {
  name: string
  quantity: string | number
  unit: string
  scope?: string
  ghgTco2e?: number | string
  subActivity?: string
  meterTag?: string
  evidenceFile?: string
}

export interface LevelJourneyData {
  levelKey: string
  levelNumber: number
  title: string
  shortLabel: string
  icon: LucideIcon
  badgeColor: string
  status: 'ACTIVE' | 'STAGED' | 'PENDING'
  sources: EmissionSourceItem[]
  totalMetric?: string
  totalGhg?: string
  evidenceCount: number
  evidenceFiles: string[]
  isVerified?: boolean
  updatedAt?: string
}

interface LiquidGlassJourneyProps {
  levels: Array<{
    key: string
    level: number
    label: string
    brsrTitle: string
    icon: LucideIcon
    badgeColor?: string
    focus?: string
  }>
  activeLevelKey: string
  allFormData: Record<string, Record<string, any>>
  projectId?: string | null
  periodId?: string | null
  stagedLevels?: Record<string, any>
  existingRecords?: any[]
  evidenceList?: any[]
  onSelectLevel: (levelKey: string) => void
  onReviewEvidence?: (fileName: string) => void
  onOpenFinalReview?: () => void
  onViewItem?: (item: any) => void
  onToggleCollapse?: () => void
  isCollapsed?: boolean
  onSelectSourceItem?: (levelKey: string, sourceName: string) => void
}

/**
 * Extracts and normalizes structured emission sources from formStateRef or existing records
 */
function extractLevelSources(
  levelKey: string,
  rawFormData: Record<string, any> | undefined,
  existingForLevel: any[]
): { sources: EmissionSourceItem[]; totalMetric: string; totalGhg: string; isStaged: boolean } {
  const data = rawFormData || {}
  const items = Array.isArray(data?.items) ? data.items : []
  const sources: EmissionSourceItem[] = []
  let totalMetric = ''
  let totalGhg = ''
  let isStaged = false

  // LEVEL 1: Energy Consumption
  if (levelKey === 'level1') {
    if (items.length > 0) {
      isStaged = true
      let sumKwh = 0
      let sumGhg = 0
      items.forEach((it: any) => {
        const qty = Number(it.consumptionQuantity) || 0
        const ghg = Number(it.estTco2e) || 0
        sumKwh += qty
        sumGhg += ghg
        sources.push({
          name: it.sourceItem || it.energySource || 'Grid electricity',
          quantity: qty ? qty.toLocaleString() : '—',
          unit: it.unit || 'kWh',
          scope: it.emissionScope || 'Scope 2',
          ghgTco2e: ghg ? `${ghg.toFixed(2)} tCO₂e` : undefined,
          subActivity: it.activityType || it.energyActivity,
          meterTag: it.meterId,
        })
      })
      totalMetric = `${sumKwh.toLocaleString()} kWh`
      totalGhg = `${sumGhg.toFixed(2)} tCO₂e`
    } else if (data?.consumptionQuantity) {
      isStaged = true
      const qty = Number(data.consumptionQuantity) || 0
      const ghg = Number(data.estTco2e) || (qty * 0.716) / 1000
      sources.push({
        name: data.energySource || data.sourceItem || 'Grid electricity',
        quantity: qty ? qty.toLocaleString() : '—',
        unit: data.unit || 'kWh',
        scope: data.emissionScope || 'Scope 2',
        ghgTco2e: `${ghg.toFixed(2)} tCO₂e`,
        subActivity: data.energyActivity || 'Operations',
      })
      totalMetric = `${qty.toLocaleString()} ${data.unit || 'kWh'}`
      totalGhg = `${ghg.toFixed(2)} tCO₂e`
    } else if (existingForLevel.length > 0) {
      isStaged = true
      existingForLevel.forEach((rec) => {
        const d = rec.data || {}
        const qty = Number(d.consumptionQuantity || d.gridElectricity || 0)
        sources.push({
          name: d.energySource || 'Grid electricity',
          quantity: qty.toLocaleString(),
          unit: 'kWh',
          scope: 'Scope 2',
          ghgTco2e: `${((qty * 0.716) / 1000).toFixed(2)} tCO₂e`,
        })
      })
      totalMetric = 'Records Restored'
    }
  }

  // LEVEL 2: Water Withdrawal & Consumption
  else if (levelKey === 'level2') {
    if (items.length > 0) {
      isStaged = true
      let sumKl = 0
      items.forEach((it: any) => {
        const qty = Number(it.quantity || it.waterQuantity || it.withdrawalQuantity || it.consumptionQuantity || 0)
        sumKl += qty
        sources.push({
          name: it.waterSource || it.sourceItem || it.name || 'Surface water',
          quantity: qty ? qty.toLocaleString() : '—',
          unit: it.unit || 'kL',
          subActivity: it.waterCategory || it.treatmentMethod,
        })
      })
      totalMetric = `${sumKl.toLocaleString()} kL`
    } else if (data?.surfaceWater || data?.groundWater || data?.municipalSupply) {
      isStaged = true
      const sw = Number(data.surfaceWater || 0)
      const gw = Number(data.groundWater || 0)
      const mun = Number(data.municipalSupply || 0)
      const stp = Number(data.recycledWater || 0)
      if (sw) sources.push({ name: 'Surface water', quantity: sw.toLocaleString(), unit: 'kL' })
      if (gw) sources.push({ name: 'Ground water (borewell)', quantity: gw.toLocaleString(), unit: 'kL' })
      if (mun) sources.push({ name: 'Municipal / Third-party', quantity: mun.toLocaleString(), unit: 'kL' })
      if (stp) sources.push({ name: 'Recycled / STP Treated', quantity: stp.toLocaleString(), unit: 'kL' })
      totalMetric = `${(sw + gw + mun).toLocaleString()} kL`
    } else if (existingForLevel.length > 0) {
      isStaged = true
      totalMetric = 'Water Audit Staged'
      sources.push({ name: 'Surface & Recycled Water', quantity: 'Active', unit: 'kL' })
    }
  }

  // LEVEL 3: GHG & Air Emissions
  else if (levelKey === 'level3') {
    const s1 = Number(data?.scope1 || 0)
    const s2 = Number(data?.scope2 || 0)
    const s3 = Number(data?.scope3 || 0)
    if (s1 || s2 || s3 || items.length > 0) {
      isStaged = true
      if (s1) sources.push({ name: 'Scope 1 — Direct (DG / Fleet)', quantity: `${s1.toFixed(1)}`, unit: 'tCO₂e', scope: 'Scope 1' })
      if (s2) sources.push({ name: 'Scope 2 — Purchased Electricity', quantity: `${s2.toFixed(1)}`, unit: 'tCO₂e', scope: 'Scope 2' })
      if (s3) sources.push({ name: 'Scope 3 — Value Chain / Freight', quantity: `${s3.toFixed(1)}`, unit: 'tCO₂e', scope: 'Scope 3' })
      totalMetric = `${(s1 + s2 + s3).toFixed(1)} tCO₂e`
      totalGhg = `${(s1 + s2).toFixed(1)} tCO₂e (Scope 1+2)`
    } else if (existingForLevel.length > 0) {
      isStaged = true
      totalMetric = 'GHG Inventory Verified'
      sources.push({ name: 'Scope 1 & Scope 2 Emissions', quantity: 'Compliant', unit: 'tCO₂e' })
    }
  }

  // LEVEL 4: Waste Management
  else if (levelKey === 'level4') {
    if (items.length > 0) {
      isStaged = true
      let sumMt = 0
      items.forEach((it: any) => {
        const qty = Number(it.quantity || it.quantityGenerated || 0)
        sumMt += qty
        sources.push({
          name: it.wasteCategory || it.wasteType || it.sourceItem || 'Non-hazardous waste',
          quantity: qty ? qty.toFixed(2) : '—',
          unit: it.unit || 'MT',
          subActivity: it.disposalMethod || 'Recycled',
        })
      })
      totalMetric = `${sumMt.toFixed(2)} MT`
    } else if (data?.hazardousWaste || data?.nonHazardousWaste) {
      isStaged = true
      const haz = Number(data.hazardousWaste || 0)
      const nonHaz = Number(data.nonHazardousWaste || 0)
      if (haz) sources.push({ name: 'Hazardous Waste', quantity: `${haz.toFixed(2)}`, unit: 'MT', subActivity: 'Authorized Co-processing' })
      if (nonHaz) sources.push({ name: 'Non-Hazardous Scrap', quantity: `${nonHaz.toFixed(2)}`, unit: 'MT', subActivity: 'Segregated & Recycled' })
      totalMetric = `${(haz + nonHaz).toFixed(2)} MT`
    } else if (existingForLevel.length > 0) {
      isStaged = true
      totalMetric = 'Waste Segregation Logged'
      sources.push({ name: 'Hazardous & Solid Waste', quantity: 'Audited', unit: 'MT' })
    }
  }

  // LEVEL 7: Environmental Permits & Compliance
  else if (levelKey === 'level7') {
    if (data?.consentType || data?.permitNumber || items.length > 0) {
      isStaged = true
      sources.push({
        name: data.consentType || 'Consent to Operate (CTO)',
        quantity: data.permitNumber || 'SPCB-CTO-2026',
        unit: 'Valid',
        subActivity: data.validTill ? `Expires: ${data.validTill}` : 'Zero Non-Compliances',
      })
      totalMetric = 'Statutory Clearances Valid'
    } else if (existingForLevel.length > 0) {
      isStaged = true
      totalMetric = 'CTO / CTE Certified'
      sources.push({ name: 'Air & Water SPCB Clearances', quantity: 'Compliant', unit: 'Statutory' })
    }
  }

  // LEVEL 9: Environmental Initiatives
  else if (levelKey === 'level9') {
    if (data?.initiativeName || items.length > 0) {
      isStaged = true
      sources.push({
        name: data.initiativeName || 'Captive Solar & LED Retrofit',
        quantity: data.energySavedGj ? `${data.energySavedGj} GJ` : 'Active',
        unit: 'Saved',
        subActivity: data.outcomeType || 'Measured Outcome',
      })
      totalMetric = 'Resource Conservation Active'
    } else if (existingForLevel.length > 0) {
      isStaged = true
      totalMetric = 'Sustainability Programs Staged'
      sources.push({ name: 'Energy Efficiency & Afforestation', quantity: 'Active', unit: 'Initiative' })
    }
  }

  return { sources, totalMetric, totalGhg, isStaged }
}

/* =====================================================================
   MAIN COMPONENT: LiquidGlassEmissionJourneyWidget
   Implements Apple Liquid Glass container background, widgetAccentable
   hierarchy, and sequenced step-by-step emission cards.
   ===================================================================== */
export function LiquidGlassEmissionJourneyWidget({
  levels,
  activeLevelKey,
  allFormData,
  projectId,
  periodId,
  stagedLevels = {},
  existingRecords = [],
  evidenceList = [],
  onSelectLevel,
  onReviewEvidence,
  onOpenFinalReview,
  onViewItem,
  onToggleCollapse,
  isCollapsed = false,
  onSelectSourceItem,
}: LiquidGlassJourneyProps) {
  const [expandedLevels, setExpandedLevels] = useState<Record<string, boolean>>({
    [activeLevelKey]: true,
  })

  const toggleExpand = (key: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedLevels((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // Compile the sequential journey for all levels
  const journeyItems: LevelJourneyData[] = levels.map((lvl) => {
    /* Forms cache payloads under scoped keys l<N>-<project>-<period>; the
       legacy levelKey fallback keeps older callers working. */
    const scopedKey = projectId && periodId ? `l${lvl.level}-${projectId}-${periodId}` : lvl.key
    const rawData = stagedLevels[lvl.key] || allFormData[scopedKey] || allFormData[lvl.key]
    const existingForLevel = existingRecords.filter((r) => r.level === lvl.level || r.levelKey === lvl.key)
    const { sources, totalMetric, totalGhg, isStaged } = extractLevelSources(lvl.key, rawData, existingForLevel)

    // Calculate attached evidence files for this level
    const levelEvidence = evidenceList.filter((ev) => {
      const mod = (ev.module || '').toUpperCase()
      const lvlMod = (lvl.focus || lvl.label).toUpperCase()
      return mod.includes(lvlMod) || mod.includes(lvl.key.toUpperCase())
    })

    const status: 'ACTIVE' | 'STAGED' | 'PENDING' =
      lvl.key === activeLevelKey ? 'ACTIVE' : isStaged ? 'STAGED' : 'PENDING'

    return {
      levelKey: lvl.key,
      levelNumber: lvl.level,
      title: lvl.brsrTitle,
      shortLabel: lvl.label,
      icon: lvl.icon,
      badgeColor: lvl.badgeColor || 'from-blue-600 to-indigo-600',
      status,
      sources,
      totalMetric,
      totalGhg,
      evidenceCount: levelEvidence.length,
      evidenceFiles: levelEvidence.map((e) => e.fileName),
      isVerified: status === 'STAGED' || status === 'ACTIVE',
    }
  })

  const completedCount = journeyItems.filter((j) => j.status === 'STAGED').length
  const totalLevelsCount = journeyItems.length
  const progressPct = Math.round((completedCount / totalLevelsCount) * 100)

  return (
    <div className="relative mb-4 w-full rounded-[24px] border border-white/80 bg-gradient-to-b from-white/95 via-sky-50/40 to-blue-50/30 p-4 shadow-sm backdrop-blur-xl transition-all duration-300">
      {/* Specular Top Caustic Sheen */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 rounded-t-[24px] bg-gradient-to-b from-white/70 via-white/20 to-transparent" />

      {/* Header: Journey Progression Bar & Counter */}
      <div className="relative z-10 mb-3 flex items-center justify-between border-b border-sky-100/60 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 text-white shadow-xs">
            <Compass className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold tracking-tight text-slate-900">
              Emission Sequence Journey
            </h4>
            <p className="text-[10px] text-slate-500">
              BRSR Core step progression &amp; staged emission sources
            </p>
          </div>
        </div>

        {/* Progress Pill (WidgetKit Accentable Style) & Collapsible Slider Oval Pill Button */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-2 rounded-full border border-sky-200/90 bg-white/95 px-2.5 py-1 text-[11px] font-semibold shadow-2xs">
            <span className="flex h-2 w-2 items-center justify-center">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-500" />
            </span>
            <span className="text-sky-800 font-bold">
              {completedCount} of {totalLevelsCount} Staged
            </span>
            <span className="rounded-full bg-sky-100 px-1.5 py-0.2 text-[9px] font-extrabold text-sky-700">
              {progressPct}%
            </span>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onToggleCollapse?.()
            }}
            className="flex items-center justify-center w-10 h-7 rounded-full bg-sky-100/95 hover:bg-sky-200 text-sky-800 border border-sky-300 shadow-xs transition-all active:scale-95 cursor-pointer"
            title="Collapse Journey Panel"
          >
            <ChevronRight className="h-4 w-4 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* Animated Liquid Progress Track */}
      <div className="relative z-10 mb-3.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/60 p-0.5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="h-full rounded-full bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-600 shadow-xs"
        />
      </div>

      {/* Sequence Cards List (Chronological Proper Sequence) */}
      <div className="relative z-10 space-y-2.5">
        {journeyItems.map((item, index) => {
          const ItemIcon = item.icon
          const isActive = item.status === 'ACTIVE'
          const isStaged = item.status === 'STAGED'
          const isExpanded = expandedLevels[item.levelKey] ?? (isActive || isStaged)

          return (
            <motion.div
              key={item.levelKey}
              layout
              transition={{ duration: 0.25, ease: 'easeOut' }}
              onClick={() => onSelectLevel(item.levelKey)}
              className={`group relative cursor-pointer overflow-hidden rounded-[18px] border transition-all duration-200 ${
                isActive
                  ? 'border-sky-400/90 bg-gradient-to-br from-white/98 via-sky-50/70 to-blue-50/50 shadow-md ring-2 ring-sky-400/30'
                  : isStaged
                  ? 'border-emerald-300/80 bg-white/95 shadow-2xs hover:border-emerald-400/90 hover:shadow-sm'
                  : 'border-slate-200/70 bg-white/60 opacity-80 hover:border-slate-300 hover:opacity-100'
              }`}
            >
              {/* Internal Refractive Edge Highlight */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />

              {/* Card Header */}
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Step Sequence Number & Icon */}
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-xs font-bold transition-transform group-hover:scale-105 ${
                      isActive
                        ? 'bg-sky-600 text-white shadow-xs'
                        : isStaged
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {isStaged ? (
                      <Check className="h-4 w-4 stroke-[2.5]" />
                    ) : (
                      <ItemIcon className="h-3.5 w-3.5" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Step {index + 1}
                      </span>
                      {isActive && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-1.5 py-0.2 text-[9px] font-bold text-sky-700">
                          <span className="h-1.5 w-1.5 animate-ping rounded-full bg-sky-600" />
                          ACTIVE
                        </span>
                      )}
                      {isStaged && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.2 text-[9px] font-bold text-emerald-800">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          STAGED
                        </span>
                      )}
                    </div>
                    <h5
                      className={`truncate text-xs font-semibold ${
                        isActive
                          ? 'text-sky-950 font-bold'
                          : isStaged
                          ? 'text-slate-900'
                          : 'text-slate-600'
                      }`}
                    >
                      {item.shortLabel}
                    </h5>
                  </div>
                </div>

                {/* Right Summary Metric + Expand Toggle */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {item.totalMetric && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        isActive
                          ? 'bg-sky-100 text-sky-800'
                          : isStaged
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {item.totalMetric}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={(e) => toggleExpand(item.levelKey, e)}
                    className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    title={isExpanded ? 'Collapse sources' : 'Expand sources'}
                  >
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform duration-200 ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Collapsible Detailed Sources List */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-slate-100/80 bg-slate-50/50 px-3 pb-3 pt-2"
                  >
                    {item.sources.length > 0 ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          <span>Captured Emission Sources</span>
                          <span>{item.sources.length} Item(s)</span>
                        </div>

                        {item.sources.map((src, sIdx) => {
                          const style = getLiquidGlassSourceStyle(src.name, item.levelKey)
                          const IconComp = style.icon
                          return (
                            <div
                              key={sIdx}
                              onClick={() => {
                                onSelectLevel(item.levelKey)
                                onSelectSourceItem?.(item.levelKey, src.name)
                              }}
                              className={`group/card flex items-center justify-between rounded-xl border-2 ${style.border} ${style.bg} px-3 py-2 shadow-xs backdrop-blur-md transition-all duration-150 cursor-pointer hover:shadow-md hover:scale-[1.01] active:scale-[0.99] text-[11px]`}
                              title={`Click to open and edit ${src.name} details in left panel`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${style.badge} shadow-2xs`}>
                                  <IconComp className="h-3.5 w-3.5" />
                                </div>
                                <div className="min-w-0">
                                  <span className={`font-extrabold ${style.text} truncate block text-xs group-hover/card:underline`}>
                                    {src.name}
                                  </span>
                                  {src.subActivity && (
                                    <span className={`text-[10px] ${style.subtext} block truncate font-medium`}>
                                      {src.subActivity}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2.5 shrink-0 ml-2">
                                <div className="text-right">
                                  <span className={`font-extrabold ${style.text} text-xs`}>
                                    {src.quantity} {src.unit}
                                  </span>
                                  {src.ghgTco2e && (
                                    <span className={`text-[10px] font-bold ${style.ghg} block`}>
                                      {src.ghgTco2e}
                                    </span>
                                  )}
                                </div>

                                {onViewItem && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      onViewItem({
                                        title: src.name,
                                        source: src.name,
                                        quantity: src.quantity,
                                        unit: src.unit,
                                        estTco2e: src.ghgTco2e ? Number(String(src.ghgTco2e).replace(/[^0-9.]/g, '')) : undefined,
                                        levelKey: item.levelKey,
                                        levelName: item.title,
                                        reportingPeriod: (item as any).reportingPeriod,
                                        evidenceName: (item as any).evidenceFiles?.[0],
                                      })
                                    }}
                                    className="flex h-6 w-6 items-center justify-center rounded-lg border border-slate-300/80 bg-white/95 text-slate-700 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-800 transition shadow-2xs cursor-pointer"
                                    title="View full specification modal"
                                  >
                                    <Eye className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-white/50 p-2.5 text-center text-[11px] text-slate-400">
                        {isActive
                          ? 'Fill emission quantities on the left form, then click Next.'
                          : 'No emission records entered yet for this level.'}
                      </div>
                    )}

                    {/* Evidence & Action Bar */}
                    <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-[10px]">
                      {item.evidenceFiles.length > 0 ? (
                        <div className="flex items-center gap-1 text-slate-600 truncate max-w-[180px]">
                          <FileCheck2 className="h-3 w-3 shrink-0 text-emerald-600" />
                          <span className="truncate font-medium">
                            {item.evidenceFiles[0]}
                          </span>
                          {item.evidenceFiles.length > 1 && (
                            <span className="rounded-full bg-slate-100 px-1 font-bold text-slate-600">
                              +{item.evidenceFiles.length - 1}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">No evidence attached</span>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelectLevel(item.levelKey)
                        }}
                        className={`font-semibold inline-flex items-center gap-0.5 hover:underline ${
                          isActive ? 'text-sky-700' : 'text-slate-600'
                        }`}
                      >
                        {isActive ? 'Currently Editing' : 'Switch to Level →'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </div>

      {/* Bottom Consolidated Action Pill */}
      {completedCount > 0 && onOpenFinalReview && (
        <div className="relative z-10 mt-3.5 border-t border-sky-100/70 pt-3">
          <button
            type="button"
            onClick={onOpenFinalReview}
            className="flex w-full items-center justify-between rounded-xl bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:shadow-md hover:brightness-105 active:scale-[0.99]"
          >
            <div className="flex items-center gap-2">
              <Send className="h-3.5 w-3.5" />
              <span>Consolidated Final Review</span>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white">
              <span>{completedCount} Staged</span>
              <ArrowRight className="h-3 w-3" />
            </div>
          </button>
        </div>
      )}
    </div>
  )
}

