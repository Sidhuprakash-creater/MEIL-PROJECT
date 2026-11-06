'use client'

import { FileText, AlertOctagon } from 'lucide-react'
import { MeilBoxLoader } from '@/components/shared/meil-loader'
import { type Project } from './core'

/* ============================================================
   HELPERS & SKELETONS
   ============================================================ */

export function describeLevelRecord(r: any): string {
  if (r.data) {
    if (r.level === 1) {
      if (Array.isArray(r.data.items) && r.data.items.length > 0) {
        const srcList = r.data.items.map((i: any) => i.energySource).slice(0, 3).join(', ')
        return `Multi-Source (${r.data.items.length} items: ${srcList}${r.data.items.length > 3 ? '...' : ''}) · ${r.data.consumptionQuantity || 0} ${r.data.unit || 'units'}`
      }
      return [r.data.emissionDataType, r.data.energySource || 'Grid Electricity', `${r.data.consumptionQuantity || 0} ${r.data.unit || 'kWh'}`].filter(Boolean).join(' · ')
    }
    if (r.level === 2) {
      if (Array.isArray(r.data.items) && r.data.items.length > 0) {
        const srcList = r.data.items.map((i: any) => i.waterSource).slice(0, 3).join(', ')
        return `Multi-Source Water (${r.data.items.length} items: ${srcList}${r.data.items.length > 3 ? '...' : ''}) · ${r.data.waterQuantity || 0} kL (${r.data.circularityPct || 0}% circular)`
      }
      return `${r.data.waterActivity || 'Withdrawal'} (${r.data.waterSource || 'Groundwater'}) · ${r.data.waterQuantity || 0} ${r.data.unit || 'kL'}`
    }
    if (r.level === 3) {
      if (Array.isArray(r.data.items) && r.data.items.length > 0) {
        const srcList = r.data.items.map((i: any) => i.emissionSource).slice(0, 3).join(', ')
        return `Multi-Source GHG (${r.data.items.length} items: ${srcList}${r.data.items.length > 3 ? '...' : ''}) · ${Number(r.data.totalTco2e || 0).toFixed(2)} tCO₂e`
      }
      return `${r.data.emissionDataType || 'Scope 1'} · ${r.data.emissionSource || 'DG'} (${r.data.activityQuantity || 0} ${r.data.unit || 'L'})`
    }
    if (r.level === 4) {
      if (Array.isArray(r.data.items) && r.data.items.length > 0) {
        const catList = r.data.items.map((i: any) => i.wasteCategory).slice(0, 3).join(', ')
        return `Multi-Category Waste (${r.data.items.length} streams: ${catList}${r.data.items.length > 3 ? '...' : ''}) · ${r.data.quantityGenerated || 0} MT (${r.data.diversionRate || 0}% diverted)`
      }
      return `${r.data.wasteCategory || 'C&D'} · ${r.data.quantityGenerated || 0} ${r.data.unit || 'MT'}`
    }
    if (r.level === 5 || r.level === 7 || r.levelKey === 'level7') {
      if (Array.isArray(r.data.items) && r.data.items.length > 0) {
        const typeList = r.data.items.map((i: any) => i.permitConsentType?.split('(')[0].trim() || 'Permit').slice(0, 3).join(', ')
        return `Multi-Permit Portfolio (${r.data.items.length} authorizations: ${typeList}${r.data.items.length > 3 ? '...' : ''}) · ${r.data.complianceRate ?? 100}% compliant`
      }
      return `${r.data.permitConsentType || 'Permit'} #${r.data.permitNumber || 'N/A'}`
    }
    if (r.level === 6 || r.level === 9 || r.levelKey === 'level9') {
      if (Array.isArray(r.data.items) && r.data.items.length > 0) {
        const initList = r.data.items.map((i: any) => i.activityInitiativeName?.split('&')[0].trim() || 'Project').slice(0, 3).join(', ')
        return `Multi-Initiative Program (${r.data.items.length} projects: ${initList}${r.data.items.length > 3 ? '...' : ''}) · ${Number(r.data.totalSavings || 0).toLocaleString()} saved`
      }
      return `${r.data.activityInitiativeName || 'Initiative'} · ${r.data.outcome || 'Measured'}`
    }
    if (r.level === 8) return `${r.data.recordType || 'Grievance'} · ${r.data.category || 'Spill'} (${r.data.currentStatus || 'Open'})`
  }
  return r.id?.slice(-8) ?? 'Record'
}

export function DataEntrySkeleton() {
  return (
    <div className="glass rounded-2xl p-6">
      <MeilBoxLoader boxHeight="min-h-[420px]" label="Preparing Site Data Entry…" />
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="glass flex flex-col items-center justify-center gap-3 rounded-2xl py-16 text-center">
      <AlertOctagon className="h-10 w-10 text-rose-500" />
      <div>
        <div className="text-base font-bold text-slate-800">Failed to load Data Entry</div>
        <div className="text-xs text-slate-500">{message}</div>
      </div>
      <button onClick={onRetry} className="btn-glass-primary rounded-full px-5 py-2 text-xs font-semibold">
        Retry
      </button>
    </div>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="glass flex flex-col items-center justify-center gap-3 rounded-2xl py-16 text-center">
      <FileText className="h-10 w-10 text-slate-400" />
      <div>
        <div className="text-base font-bold text-slate-800">No data available</div>
        <div className="text-xs text-slate-500">{message}</div>
      </div>
    </div>
  )
}