'use client'

import React, { useState, useRef, useEffect } from 'react'

export interface FactorDetail {
  source: string
  factor: string
  scope: string
}

export const EMISSION_FACTOR_REGISTRY: Record<string, FactorDetail> = {
  'Grid Electricity': {
    source: 'CEA CO2 Baseline Database v19',
    factor: '0.716 Kg CO2e/kWh',
    scope: 'Scope 2',
  },
  'Grid electricity': {
    source: 'CEA CO2 Baseline Database v19',
    factor: '0.716 Kg CO2e/kWh',
    scope: 'Scope 2',
  },
  'Renewable electricity': {
    source: 'Renewable PPA (Solar) — ISAE 3000',
    factor: '0.040 Kg CO2e/kWh',
    scope: 'Scope 2',
  },
  'Diesel (HSD)': {
    source: 'IPCC 2006, Vol 2, Ch 2',
    factor: '2.637 Kg CO2e/L',
    scope: 'Scope 1',
  },
  'Diesel': {
    source: 'IPCC 2006, Vol 2, Ch 2',
    factor: '2.637 Kg CO2e/L',
    scope: 'Scope 1',
  },
  'Petrol': {
    source: 'IPCC 2006, Vol 2, Ch 3',
    factor: '2.296 Kg CO2e/L',
    scope: 'Scope 1',
  },
  'LPG': {
    source: 'IPCC 2006, Vol 2, Ch 2, Table 2.2',
    factor: '2.98 Kg CO2e/Kg',
    scope: 'Scope 1',
  },
  'CNG': {
    source: 'IPCC 2006, Vol 2, Ch 2',
    factor: '2.19 Kg CO2e/Kg',
    scope: 'Scope 1',
  },
  'PNG': {
    source: 'IPCC 2006, Vol 2, Ch 2, Table 2.2',
    factor: '2.05 Kg CO2e/Kg',
    scope: 'Scope 1',
  },
  'Gas': {
    source: 'IPCC 2006, Vol 2, Ch 2 (natural gas)',
    factor: '2.02 Kg CO2e/Kg',
    scope: 'Scope 1',
  },
  'Indian Bituminous Coal': {
    source: 'IPCC 2006, Vol 2, Ch 2, Table 2.2',
    factor: '2.15 Kg CO2e/Kg',
    scope: 'Scope 1',
  },
  'Imported Coal': {
    source: 'IPCC 2006, Vol 2, Ch 2, Table 2.2',
    factor: '2.55 Kg CO2e/Kg',
    scope: 'Scope 1',
  },
  'Coal': {
    source: 'IPCC 2006, Vol 2, Ch 2 (sub-bituminous)',
    factor: '1.9 Kg CO2e/Kg',
    scope: 'Scope 1',
  },
  'Coal (anthracite)': {
    source: 'IPCC 2006, Vol 2, Ch 2, Table 2.2',
    factor: '2.62 Kg CO2e/Kg',
    scope: 'Scope 1',
  },
  'Coal (bituminous)': {
    source: 'IPCC 2006, Vol 2, Ch 2, Table 2.2',
    factor: '2.44 Kg CO2e/Kg',
    scope: 'Scope 1',
  },
  'Coal (lignite)': {
    source: 'IPCC 2006, Vol 2, Ch 2, Table 2.2',
    factor: '1.2 Kg CO2e/Kg',
    scope: 'Scope 1',
  },
  'Coal (sub-bituminous)': {
    source: 'IPCC 2006, Vol 2, Ch 2, Table 2.2',
    factor: '1.82 Kg CO2e/Kg',
    scope: 'Scope 1',
  },
  'Diesel (per kg)': {
    source: 'IPCC 2006, Vol 2, Ch 2 (converted to a per-kg basis)',
    factor: '3.13 Kg CO2e/Kg',
    scope: 'Scope 1',
  },
  'Furnace Oil (per kg)': {
    source: 'IPCC 2006, Vol 2, Ch 2, Table 2.2 (converted to a per-kg basis)',
    factor: '3.13 Kg CO2e/Kg',
    scope: 'Scope 1',
  },
  'LPG (per kg)': {
    source: 'IPCC 2006, Vol 2, Ch 2, Table 2.2',
    factor: '3.0 Kg CO2e/Kg',
    scope: 'Scope 1',
  },
  'Pet coke': {
    source: 'IPCC 2006, Vol 2, Ch 2, Table 2.2',
    factor: '3.17 Kg CO2e/Kg',
    scope: 'Scope 1',
  },
  'Rice husk': {
    source: 'IPCC 2006, Vol 2, Ch 2 (biomass, non-CO2 excluded)',
    factor: '1.5 Kg CO2e/Kg',
    scope: 'Scope 1',
  },
  'Wood': {
    source: 'IPCC 2006, Vol 2, Ch 2 (biomass, non-CO2 excluded)',
    factor: '1.75 Kg CO2e/Kg',
    scope: 'Scope 1',
  },
  'Lignite Coal': {
    source: 'CEA / IPCC 2006, Vol 2, Ch 2',
    factor: '1.40 Kg CO2e/Kg',
    scope: 'Scope 1',
  },
  'Furnace Oil': {
    source: 'IPCC 2006, Vol 2, Ch 2, Table 2.2',
    factor: '3.12 Kg CO2e/L',
    scope: 'Scope 1',
  },
  'Cement OPC': {
    source: 'India Cement Benchmark 2023-24',
    factor: '0.85 Kg CO2e/Kg',
    scope: 'Scope 3',
  },
  'Cement PPC': {
    source: 'GCCA India / CSI',
    factor: '0.65 Kg CO2e/Kg',
    scope: 'Scope 3',
  },
  'Structural Steel': {
    source: 'World Steel Association',
    factor: '1.82 Kg CO2e/Kg',
    scope: 'Scope 3',
  },
  'Air Travel (Domestic)': {
    source: 'GHG Protocol Scope 3',
    factor: '0.18 Kg CO2e/passenger-km',
    scope: 'Scope 3',
  },
  'Rail Travel': {
    source: 'GHG Protocol Scope 3',
    factor: '0.04 Kg CO2e/passenger-km',
    scope: 'Scope 3',
  },
  'Road Travel (Car)': {
    source: 'GHG Protocol Scope 3',
    factor: '0.11 Kg CO2e/vehicle-km',
    scope: 'Scope 3',
  },
  'R-410A Refrigerant': {
    source: 'IPCC AR5, WG1, Ch 8, Table 8.4',
    factor: 'GWP: 4200',
    scope: 'Scope 1',
  },
}

export function lookupEmissionFactor(name: string): FactorDetail {
  if (EMISSION_FACTOR_REGISTRY[name]) {
    return EMISSION_FACTOR_REGISTRY[name]
  }
  const clean = (name || '').toLowerCase()
  for (const [key, val] of Object.entries(EMISSION_FACTOR_REGISTRY)) {
    if (clean.includes(key.toLowerCase()) || key.toLowerCase().includes(clean)) {
      return val
    }
  }
  return {
    source: 'CEA / IPCC 2006 Baseline Reference',
    factor: 'Standard Factor',
    scope: 'Scope 1/2',
  }
}

export function EmissionFactorInfoIcon({ materialName }: { materialName: string }) {
  const [open, setOpen] = useState(false)
  const info = lookupEmissionFactor(materialName)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  return (
    <span
      ref={ref}
      className="relative inline-flex items-center ml-1 align-middle"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-blue-300 bg-white text-blue-700 shadow-2xs hover:bg-blue-600 hover:text-white transition text-[9px] font-black cursor-pointer leading-none"
        title="Emission factor methodology & scope"
      >
        !
      </button>

      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-64 rounded-xl border border-slate-200/90 bg-white/95 p-2.5 text-left text-xs shadow-xl backdrop-blur-md pointer-events-none animate-in fade-in zoom-in-95 duration-150 block"
        >
          <span className="block font-semibold text-slate-900 text-[11px] leading-tight truncate">
            Source: {info.source}
          </span>
          <span className="block mt-1 text-[11px] font-bold text-blue-700">
            Factor: {info.factor} | {info.scope}
          </span>
          {/* Subtle arrow pointer */}
          <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-white block" />
        </span>
      )}
    </span>
  )
}

