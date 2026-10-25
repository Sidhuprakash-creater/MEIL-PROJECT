'use client'
/**
 * Bulk CSV Import Dialog — premium so-glass-strong 4-step wizard.
 * Steps: Upload → Preview & Map → Validate → Import.
 * Supports energy / water / waste sub-modules. Posts each valid row to the
 * respective /api/{module} endpoint; the server runs validation + calculation
 * exactly as it would for a single manual record (no hardcoded KPIs).
 *
 * Role gating is enforced upstream in data-entry.tsx (the trigger button is
 * disabled for read-only roles with a tooltip). This component assumes the
 * caller has already gated it.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload, FileSpreadsheet, Download, ArrowRight, ArrowLeft, CheckCircle2,
  AlertTriangle, AlertOctagon, X, FileUp, Sparkles, Loader2, RefreshCw,
  ListChecks, Inbox, type LucideIcon,
} from 'lucide-react'
import { Dialog, DialogContent, DialogOverlay } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { toast } from 'sonner'

/* ----------------------------- Types ----------------------------- */
type SubModule = 'energy' | 'water' | 'waste'

interface Project {
  id: string; projectCode: string; projectName: string; location: string | null
  buName: string; subsidiaryCode: string; groupCode: string
}
interface Period { id: string; label: string; year: number; month: number | null; status: string }

interface FieldSpec {
  key: string
  label: string
  required: boolean
  numeric?: boolean
  boolean?: boolean
  hint?: string
  aliases?: string[]
}

interface RowIssue {
  field: string
  message: string
}

interface ParsedRow {
  index: number
  raw: Record<string, string>
  mapped: Record<string, string | number | boolean | undefined>
  valid: boolean
  issues: RowIssue[]
}

interface ImportOutcome {
  rowIndex: number
  ok: boolean
  recordId?: string
  error?: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  subModule: SubModule
  projectId: string | null
  reportingPeriodId: string | null
  projects: Project[]
  periods: Period[]
  onImported: () => void
}

/* --------------------- Module field catalogues --------------------- */
const ENERGY_FIELDS: FieldSpec[] = [
  { key: 'source', label: 'Source', required: true, hint: 'e.g. Grid Electricity, Diesel (HSD), Solar PPA', aliases: ['energy source', 'source name'] },
  { key: 'quantity', label: 'Quantity', required: true, numeric: true, hint: 'Metered consumption (> 0)', aliases: ['qty', 'amount', 'value'] },
  { key: 'sourceUnit', label: 'Source unit', required: true, hint: 'KWH, MWH, GJ, L, KL, M3, KG, TON', aliases: ['unit', 'uom'] },
  { key: 'vendor', label: 'Vendor', required: false, hint: 'Utility / fuel supplier', aliases: ['supplier', 'provider'] },
  { key: 'meterRef', label: 'Meter reference', required: false, hint: 'Unique meter ID', aliases: ['meter', 'meter ref', 'meter reference', 'meter id'] },
]

const WATER_FIELDS: FieldSpec[] = [
  { key: 'source', label: 'Source', required: true, hint: 'Ground Water, Surface, Third Party, Recycled, Rainwater', aliases: ['water source'] },
  { key: 'withdrawal', label: 'Withdrawal', required: true, numeric: true, hint: 'Total intake (> 0)' },
  { key: 'consumption', label: 'Consumption', required: false, numeric: true, hint: 'Withdrawn − discharged' },
  { key: 'discharge', label: 'Discharge', required: false, numeric: true, hint: 'Returned to environment' },
  { key: 'recycledReused', label: 'Recycled / reused', required: false, numeric: true, hint: 'Through STP / rainwater', aliases: ['recycled', 'reused', 'recycledreused'] },
  { key: 'treatment', label: 'Treatment', required: false, hint: 'STP / ETP / none' },
  { key: 'destination', label: 'Destination', required: false, hint: 'Where discharge goes' },
  { key: 'sourceUnit', label: 'Source unit', required: true, hint: 'KL, M3, L', aliases: ['unit', 'uom'] },
]

const WASTE_FIELDS: FieldSpec[] = [
  { key: 'wasteType', label: 'Waste type', required: true, hint: 'E-waste, sludge, scrap, etc.', aliases: ['type', 'waste type', 'category'] },
  { key: 'hazardous', label: 'Hazardous', required: false, boolean: true, hint: 'true / false', aliases: ['ishazardous', 'haz'] },
  { key: 'generatedQty', label: 'Generated qty', required: true, numeric: true, hint: 'Total generated (≥ 0)', aliases: ['generated', 'genqty', 'generatedquantity'] },
  { key: 'recoveredQty', label: 'Recovered qty', required: false, numeric: true, aliases: ['recovered'] },
  { key: 'recycledQty', label: 'Recycled qty', required: false, numeric: true, aliases: ['recycled'] },
  { key: 'reusedQty', label: 'Reused qty', required: false, numeric: true, aliases: ['reused'] },
  { key: 'disposedQty', label: 'Disposed qty', required: false, numeric: true, aliases: ['disposed', 'disposalqty'] },
  { key: 'disposalRoute', label: 'Disposal route', required: false, hint: 'Authorised recycler / TSDF', aliases: ['route', 'disposal'] },
  { key: 'vendor', label: 'Vendor', required: false, aliases: ['supplier'] },
  { key: 'manifestRef', label: 'Manifest reference', required: false, hint: 'Required if hazardous', aliases: ['manifest', 'manifestref', 'manifest reference'] },
  { key: 'sourceUnit', label: 'Source unit', required: true, hint: 'TON, T, KG', aliases: ['unit', 'uom'] },
]

const FIELDS: Record<SubModule, FieldSpec[]> = {
  energy: ENERGY_FIELDS,
  water: WATER_FIELDS,
  waste: WASTE_FIELDS,
}

const TEMPLATE_ROWS: Record<SubModule, string[]> = {
  energy: ['Grid Electricity,384000,KWH,TSSPDCL,MTR-01'],
  water: ['Ground Water,4200,1260,800,2140,STP,Irrigation,KL'],
  waste: ['E-waste,true,0.8,0.75,0.75,0.05,Authorised Recycler,Ecoreco,EWM-01,TON'],
}

/**
 * Energy source → category lookup. Mirrors the ENERGY_SOURCES catalog in
 * data-entry.tsx so CSV-imported rows match the same auto-derivation logic
 * that the manual form uses (RENEWABLE only for Solar PPA).
 */
const ENERGY_SOURCE_CATEGORY: Record<string, string> = {
  'Grid Electricity': 'NON_RENEWABLE',
  'Diesel (HSD)': 'NON_RENEWABLE',
  'Petrol (MS)': 'NON_RENEWABLE',
  'Petrol': 'NON_RENEWABLE',
  'Coal (Sub-bituminous)': 'NON_RENEWABLE',
  'Coal': 'NON_RENEWABLE',
  'CNG': 'NON_RENEWABLE',
  'LPG': 'NON_RENEWABLE',
  'Solar PPA': 'RENEWABLE',
}
function lookupEnergyCategory(source: string): string {
  return ENERGY_SOURCE_CATEGORY[source] ?? 'NON_RENEWABLE'
}

const MODULE_LABEL: Record<SubModule, string> = {
  energy: 'Energy / Fuel',
  water: 'Water',
  waste: 'Waste',
}

const MODULE_ICON: Record<SubModule, LucideIcon> = {
  energy: Upload,
  water: Upload,
  waste: Upload,
}

const STEPS = ['Upload', 'Preview & Map', 'Validate', 'Import'] as const

/* ----------------------------- CSV parser ----------------------------- */
/**
 * Tiny RFC-4180-ish CSV parser. Handles quoted fields with embedded commas
 * and escaped double-quotes. Splits on \r\n, \n, or \r.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  let i = 0
  const s = text.replace(/^\uFEFF/, '') // strip BOM if present
  while (i < s.length) {
    const ch = s[i]
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') { field += '"'; i += 2; continue }
        inQuotes = false; i++; continue
      }
      field += ch; i++; continue
    }
    if (ch === '"') { inQuotes = true; i++; continue }
    if (ch === ',') { row.push(field); field = ''; i++; continue }
    if (ch === '\r') {
      // CRLF or lone CR
      row.push(field); field = ''
      rows.push(row); row = []
      if (s[i + 1] === '\n') i += 2; else i++
      continue
    }
    if (ch === '\n') {
      row.push(field); field = ''
      rows.push(row); row = []
      i++; continue
    }
    field += ch; i++
  }
  // flush trailing field/row if any
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  // Drop trailing empty rows produced by a final newline
  while (rows.length > 0 && rows[rows.length - 1].every(c => c.trim() === '')) {
    rows.pop()
  }
  return rows
}

/* ----------------------------- Header helpers ----------------------------- */
function normaliseHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s_-]+/g, '')
}

function autoMap(headers: string[], fields: FieldSpec[]): Record<string, string> {
  const mapping: Record<string, string> = {}
  const used = new Set<string>()
  for (const f of fields) {
    const candidates = [f.key, ...(f.aliases || [])].map(normaliseHeader)
    // exact match first
    let hit = headers.find(h => {
      const n = normaliseHeader(h)
      return candidates.includes(n) && !used.has(h)
    })
    if (!hit) {
      // contains match
      hit = headers.find(h => {
        const n = normaliseHeader(h)
        return candidates.some(c => n.includes(c) || c.includes(n)) && !used.has(h)
      })
    }
    if (hit) {
      mapping[f.key] = hit
      used.add(hit)
    }
  }
  return mapping
}

/* ----------------------------- Validation ----------------------------- */
function parseValue(field: FieldSpec, raw: string): { value: string | number | boolean | undefined; issue?: string } {
  const trimmed = (raw ?? '').trim()
  if (field.boolean) {
    const v = trimmed.toLowerCase()
    if (v === 'true' || v === 'yes' || v === '1' || v === 'y' || v === 't') return { value: true }
    if (v === 'false' || v === 'no' || v === '0' || v === 'n' || v === 'f') return { value: false }
    if (v === '') return { value: undefined }
    return { value: false, issue: `'${raw}' is not a valid boolean` }
  }
  if (field.numeric) {
    if (trimmed === '') return { value: undefined }
    const n = Number(trimmed)
    if (!Number.isFinite(n)) return { value: undefined, issue: `'${raw}' is not a number` }
    if (n < 0) return { value: n, issue: `${field.label} must be ≥ 0` }
    return { value: n }
  }
  return { value: trimmed }
}

function validateRows(rows: string[][], mapping: Record<string, string>, fields: FieldSpec[]): ParsedRow[] {
  const headers = rows[0]
  const out: ParsedRow[] = []
  for (let r = 1; r < rows.length; r++) {
    const rawRow = rows[r]
    const raw: Record<string, string> = {}
    headers.forEach((h, i) => { raw[h] = rawRow[i] ?? '' })
    const mapped: Record<string, string | number | boolean | undefined> = {}
    const issues: RowIssue[] = []
    for (const f of fields) {
      const header = mapping[f.key]
      const cell = header ? raw[header] ?? '' : ''
      if (f.required && cell.trim() === '') {
        issues.push({ field: f.key, message: `${f.label} is required` })
        continue
      }
      if (cell.trim() === '' && !f.required) {
        mapped[f.key] = undefined
        continue
      }
      const { value, issue } = parseValue(f, cell)
      mapped[f.key] = value
      if (issue) issues.push({ field: f.key, message: `${f.label}: ${issue}` })
    }
    // Cross-field rules mirror the server-side engines
    if (fields === WASTE_FIELDS) {
      const haz = mapped.hazardous === true
      const manifest = String(mapped.manifestRef ?? '').trim()
      if (haz && !manifest) issues.push({ field: 'manifestRef', message: 'Hazardous waste requires a manifest reference' })
    }
    out.push({ index: r, raw, mapped, valid: issues.length === 0, issues })
  }
  return out
}

/* ----------------------------- Download template ----------------------------- */
function downloadTemplate(subModule: SubModule) {
  const fields = FIELDS[subModule]
  const header = fields.map(f => f.key).join(',')
  const sample = TEMPLATE_ROWS[subModule][0]
  const csv = `${header}\n${sample}\n`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `meil-${subModule}-template.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  toast.success('Template downloaded', { description: `meil-${subModule}-template.csv` })
}

/* ============================================================
   Main dialog component
   ============================================================ */
export function CsvImportDialog({
  open, onOpenChange, subModule, projectId, reportingPeriodId, projects, periods, onImported,
}: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [fileName, setFileName] = useState('')
  const [rawRows, setRawRows] = useState<string[][]>([])
  const [parseError, setParseError] = useState('')
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [targetProject, setTargetProject] = useState<string | null>(projectId)
  const [targetPeriod, setTargetPeriod] = useState<string | null>(reportingPeriodId)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [outcomes, setOutcomes] = useState<ImportOutcome[]>([])
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fields = FIELDS[subModule]

  // Reset transient state when the dialog is reopened or sub-module changes
  useEffect(() => {
    if (open) {
      setStep(1)
      setFileName('')
      setRawRows([])
      setParseError('')
      setMapping({})
      setRows([])
      setTargetProject(projectId)
      setTargetPeriod(reportingPeriodId)
      setImporting(false)
      setImportProgress(0)
      setOutcomes([])
      setDragOver(false)
    }
  }, [open, subModule, projectId, reportingPeriodId])

  // Re-validate rows whenever mapping changes (kept cheap; rows are ≤ a few hundred)
  useEffect(() => {
    if (rawRows.length === 0) { setRows([]); return }
    setRows(validateRows(rawRows, mapping, fields))
  }, [rawRows, mapping, fields])

  const validCount = useMemo(() => rows.filter(r => r.valid).length, [rows])
  const invalidCount = rows.length - validCount

  const handleFile = useCallback((file: File) => {
    setParseError('')
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setParseError('Please upload a .csv file')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = String(reader.result || '')
        const parsed = parseCsv(text)
        if (parsed.length < 2) {
          setParseError('CSV has no data rows (only a header or empty)')
          return
        }
        const headers = parsed[0]
        if (headers.every(h => h.trim() === '')) {
          setParseError('CSV header row is empty')
          return
        }
        setFileName(file.name)
        setRawRows(parsed)
        setMapping(autoMap(headers, fields))
        setStep(2)
      } catch (e: any) {
        setParseError(e?.message || 'Failed to parse CSV')
      }
    }
    reader.onerror = () => setParseError('Failed to read file')
    reader.readAsText(file)
  }, [fields])

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
    e.target.value = '' // allow re-picking the same file
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) handleFile(f)
  }

  const startImport = async (validOnly: boolean) => {
    if (!targetProject || !targetPeriod) {
      toast.error('Select a project and reporting period first')
      return
    }
    const subset = validOnly ? rows.filter(r => r.valid) : rows
    if (subset.length === 0) {
      toast.error('No rows to import')
      return
    }
    setStep(4); setImporting(true); setOutcomes([]); setImportProgress(0)

    const endpoint = `/api/so/${subModule}`
    const results: ImportOutcome[] = []
    let done = 0
    for (const row of subset) {
      try {
        const body = buildBody(subModule, row.mapped, targetProject, targetPeriod)
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          const msg = data?.error || data?.payload?.error || `HTTP ${res.status}`
          results.push({ rowIndex: row.index, ok: false, error: msg })
        } else {
          results.push({ rowIndex: row.index, ok: true, recordId: data?.record?.id })
        }
      } catch (e: any) {
        results.push({ rowIndex: row.index, ok: false, error: e?.message || 'Network error' })
      } finally {
        done++
        setImportProgress(Math.round((done / subset.length) * 100))
        setOutcomes([...results])
      }
    }
    setImporting(false)
    const okCount = results.filter(r => r.ok).length
    const failCount = results.length - okCount
    if (failCount === 0) {
      toast.success(`Import complete · ${okCount} record(s) created`)
    } else if (okCount === 0) {
      toast.error(`Import failed · ${failCount} row(s)`)
    } else {
      toast.warning(`Partial import · ${okCount} created, ${failCount} failed`)
    }
    onImported()
  }

  const closeDialog = () => onOpenChange(false)

  const Icon = MODULE_ICON[subModule]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogOverlay className="!bg-slate-900/40 !backdrop-blur-[6px]" />
      <DialogContent
        showCloseButton={false}
        className="so-glass-strong so-glass-shimmer !border-white/85 !p-0 !max-w-3xl !rounded-3xl !shadow-2xl gap-0 overflow-hidden"
      >
        {/* Header band */}
        <div className="relative flex items-start justify-between border-b border-white/60 bg-white/60 px-6 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/30">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-slate-800">
                Bulk CSV Import · <span className="text-blue-700">{MODULE_LABEL[subModule]}</span>
              </h2>
              <p className="text-[11px] text-slate-500">
                Upload a CSV, map columns, validate, then import. Each row becomes a source record.
              </p>
            </div>
          </div>
          <button
            onClick={closeDialog}
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-white/80 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="border-b border-white/40 bg-white/30 px-6 py-3">
          <div className="flex items-center justify-between">
            {STEPS.map((label, i) => {
              const n = (i + 1) as 1 | 2 | 3 | 4
              const active = step === n
              const done = step > n
              return (
                <div key={label} className="flex flex-1 items-center">
                  <div className="flex items-center gap-2">
                    <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition ${active ? 'bg-blue-500 text-white shadow-md shadow-blue-500/40' : done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200/80 text-slate-400'}`}>
                      {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : n}
                    </div>
                    <span className={`text-[11px] font-semibold ${active ? 'text-slate-800' : done ? 'text-emerald-700' : 'text-slate-400'}`}>{label}</span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`mx-2 h-0.5 flex-1 rounded-full ${done ? 'bg-emerald-300' : 'bg-slate-200/80'}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto scroll-elegant px-6 py-5">
          <AnimatePresence mode="wait">
            {/* STEP 1 — Upload */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
                className="space-y-4"
              >
              <UploadZone
                onDrop={onDrop}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => fileInputRef.current?.click()}
                dragOver={dragOver}
                Icon={Icon}
              />
              <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFileInput} />
              {parseError && (
                <div className="rounded-xl border border-rose-200/70 bg-rose-50/70 px-3 py-2 text-[11px] font-medium text-rose-700">
                  <AlertTriangle className="mr-1 inline h-3 w-3" /> {parseError}
                </div>
              )}

              {/* Expected format */}
              <div className="rounded-2xl border border-white/60 bg-white/50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-600">
                      Expected format · {MODULE_LABEL[subModule]}
                    </span>
                  </div>
                  <button
                    onClick={() => downloadTemplate(subModule)}
                    className="so-glass-subtle flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold text-blue-700 transition hover:bg-white/80"
                  >
                    <Download className="h-3 w-3" /> Download template
                  </button>
                </div>
                <div className="overflow-x-auto scroll-elegant rounded-lg border border-white/60 bg-white/70">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="bg-blue-50/60 text-left">
                        <th className="px-3 py-2 font-bold text-slate-700">Column</th>
                        <th className="px-3 py-2 font-bold text-slate-700">Required</th>
                        <th className="px-3 py-2 font-bold text-slate-700">Type</th>
                        <th className="px-3 py-2 font-bold text-slate-700">Hint</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fields.map((f, i) => (
                        <tr key={f.key} className={`border-t border-white/60 ${i % 2 === 1 ? 'bg-white/40' : ''}`}>
                          <td className="px-3 py-1.5 font-mono font-semibold text-slate-800">{f.key}</td>
                          <td className="px-3 py-1.5">
                            {f.required
                              ? <span className="status-pill status-error">required</span>
                              : <span className="status-pill status-locked">optional</span>}
                          </td>
                          <td className="px-3 py-1.5 text-slate-600">
                            {f.boolean ? 'boolean' : f.numeric ? 'number' : 'text'}
                          </td>
                          <td className="px-3 py-1.5 text-slate-500">{f.hint ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-2 rounded-md bg-blue-50/60 px-2.5 py-1.5 text-[10px] text-blue-700">
                  Sample row: <span className="font-mono text-slate-700">{TEMPLATE_ROWS[subModule][0]}</span>
                </div>
              </div>
              </motion.div>
            )}

            {/* STEP 2 — Preview & Map */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
                className="space-y-4"
              >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[11px] text-slate-600">
                  <FileUp className="h-3.5 w-3.5 text-blue-600" />
                  <span className="font-semibold text-slate-700">{fileName}</span>
                  <span className="text-slate-400">· {rawRows.length - 1} row(s) detected</span>
                </div>
                <button
                  onClick={() => { setStep(1); setFileName(''); setRawRows([]); setRows([]) }}
                  className="so-glass-subtle flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-white/80"
                >
                  <RefreshCw className="h-3 w-3" /> Re-upload
                </button>
              </div>

              {/* Target project + period */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Target project</label>
                  <select
                    value={targetProject ?? ''} onChange={(e) => setTargetProject(e.target.value || null)}
                    className="ios-field !px-2.5 !py-2 !text-[12px] font-medium text-slate-700"
                  >
                    {projects.map(p => <option key={p.id} value={p.id}>{p.projectCode} · {p.projectName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Reporting period</label>
                  <select
                    value={targetPeriod ?? ''} onChange={(e) => setTargetPeriod(e.target.value || null)}
                    className="ios-field !px-2.5 !py-2 !text-[12px] font-medium text-slate-700"
                  >
                    {periods.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Column mapping */}
              <div className="rounded-2xl border border-white/60 bg-white/50 p-4">
                <div className="mb-2 flex items-center gap-1.5">
                  <ListChecks className="h-3.5 w-3.5 text-blue-600" />
                  <span className="text-[11px] font-bold uppercase tracking-wide text-slate-600">Column mapping</span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {fields.map(f => (
                    <div key={f.key} className="flex items-center gap-2">
                      <div className="w-32 shrink-0 text-[11px] font-semibold text-slate-700">
                        {f.label}
                        {f.required && <span className="ml-0.5 text-rose-500">*</span>}
                      </div>
                      <ArrowRight className="h-3 w-3 shrink-0 text-slate-400" />
                      <select
                        value={mapping[f.key] ?? ''}
                        onChange={(e) => setMapping(prev => ({ ...prev, [f.key]: e.target.value || '' }))}
                        className="flex-1 rounded-md border border-white/60 bg-white/80 px-2 py-1.5 text-[11px] font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
                      >
                        <option value="">— unmapped —</option>
                        {rawRows[0].map((h, i) => (
                          <option key={i} value={h}>{h || `(col ${i + 1})`}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview table — first 5 rows */}
              <div className="rounded-2xl border border-white/60 bg-white/50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-slate-600">Preview · first 5 rows</span>
                  <span className="text-[10px] text-slate-400">Auto-mapped by header name</span>
                </div>
                <div className="overflow-x-auto scroll-elegant rounded-lg border border-white/60">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="bg-blue-50/60 text-left">
                        {fields.map(f => (
                          <th key={f.key} className="px-2.5 py-2 font-bold text-slate-700">{f.key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 5).map((row, i) => (
                        <motion.tr
                          key={row.index}
                          initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04, duration: 0.22 }}
                          className={`border-t border-white/60 ${row.valid ? 'bg-white/60' : 'bg-amber-50/60'}`}
                        >
                          {fields.map(f => (
                            <td key={f.key} className="px-2.5 py-1.5 text-slate-700">
                              {row.mapped[f.key] === undefined || row.mapped[f.key] === ''
                                ? <span className="text-slate-300">—</span>
                                : String(row.mapped[f.key])}
                            </td>
                          ))}
                        </motion.tr>
                      ))}
                      {rows.length === 0 && (
                        <tr><td colSpan={fields.length} className="px-3 py-6 text-center text-slate-400">No rows</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {rows.length > 5 && (
                  <div className="mt-2 text-[10px] text-slate-400">+ {rows.length - 5} more row(s) — full set shown in the Validate step.</div>
                )}
              </div>
              </motion.div>
            )}

            {/* STEP 3 — Validate */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
                className="space-y-4"
              >
              <div className="grid grid-cols-3 gap-3">
                <SummaryTile label="Total rows" value={rows.length} tone="neutral" Icon={Inbox} />
                <SummaryTile label="Valid" value={validCount} tone="ok" Icon={CheckCircle2} />
                <SummaryTile label="Issues" value={invalidCount} tone="warn" Icon={AlertTriangle} />
              </div>

              {invalidCount > 0 && (
                <div className="rounded-xl border border-amber-200/70 bg-amber-50/60 px-3 py-2 text-[11px] font-medium text-amber-800">
                  <AlertTriangle className="mr-1 inline h-3 w-3" />
                  {invalidCount} row(s) have issues. You can either fix the source CSV and re-upload, or import the valid rows only.
                </div>
              )}

              <div className="rounded-2xl border border-white/60 bg-white/50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-slate-600">Row-by-row validation</span>
                  <span className="text-[10px] text-slate-400">Showing up to 20 rows</span>
                </div>
                <div className="max-h-72 overflow-y-auto scroll-elegant rounded-lg border border-white/60">
                  <table className="w-full text-[11px]">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-white/85 text-left backdrop-blur">
                        <th className="px-2.5 py-1.5 font-bold text-slate-700">#</th>
                        <th className="px-2.5 py-1.5 font-bold text-slate-700">Status</th>
                        <th className="px-2.5 py-1.5 font-bold text-slate-700">Issues</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 20).map((row, i) => (
                        <motion.tr
                          key={row.index}
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          transition={{ delay: Math.min(i * 0.02, 0.3) }}
                          className={`border-t border-white/60 ${row.valid ? 'bg-white/60' : 'bg-amber-50/50'}`}
                        >
                          <td className="px-2.5 py-1.5 font-mono text-slate-600">{row.index}</td>
                          <td className="px-2.5 py-1.5">
                            {row.valid
                              ? <span className="status-pill status-approved"><CheckCircle2 className="h-3 w-3" /> valid</span>
                              : <span className="status-pill status-warning"><AlertTriangle className="h-3 w-3" /> issues</span>}
                          </td>
                          <td className="px-2.5 py-1.5 text-slate-600">
                            {row.issues.length === 0
                              ? <span className="text-slate-400">—</span>
                              : row.issues.map((iss, k) => (
                                <span key={k} className="mr-1.5 inline-block rounded-md bg-amber-100/70 px-1.5 py-0.5 text-[10px] text-amber-800">
                                  <span className="font-mono font-semibold">{iss.field}:</span> {iss.message}
                                </span>
                              ))}
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              </motion.div>
            )}

            {/* STEP 4 — Import */}
            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
                className="space-y-4"
              >
                {importing ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                        <span className="text-[12px] font-semibold text-slate-700">Importing rows…</span>
                      </div>
                      <span className="tabular-nums text-[11px] font-bold text-slate-700">{importProgress}%</span>
                    </div>
                    <Progress value={importProgress} className="h-2.5" />
                    <div className="text-[10px] text-slate-400">
                      {outcomes.length} of {rows.filter(r => r.valid).length} processed
                    </div>
                  </div>
                ) : (
                  <ImportSummary outcomes={outcomes} />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer — action bar */}
        <div className="flex items-center justify-between gap-2 border-t border-white/60 bg-white/60 px-6 py-3">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="status-pill status-submitted">{MODULE_LABEL[subModule]}</span>
            {targetProject && <span>· {projects.find(p => p.id === targetProject)?.projectCode}</span>}
            {targetPeriod && <span>· {periods.find(p => p.id === targetPeriod)?.label}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {step > 1 && step < 4 && (
              <button
                onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3 | 4)}
                className="so-glass-subtle flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-white/80"
              >
                <ArrowLeft className="h-3 w-3" /> Back
              </button>
            )}
            {step === 1 && (
              <button
                onClick={closeDialog}
                className="so-glass-subtle rounded-full px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-white/80"
              >
                Cancel
              </button>
            )}
            {step === 2 && (
              <button
                onClick={() => setStep(3)}
                disabled={rows.length === 0}
                className="btn-so-glass-primary flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-40"
              >
                Validate <ArrowRight className="h-3 w-3" />
              </button>
            )}
            {step === 3 && (
              <>
                <button
                  onClick={() => { setStep(2); }}
                  className="so-glass-subtle flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold text-amber-800 transition hover:bg-amber-50/80"
                >
                  <RefreshCw className="h-3 w-3" /> Fix & re-upload
                </button>
                <button
                  onClick={() => startImport(true)}
                  disabled={validCount === 0}
                  className="so-glass-subtle flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-50/80 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <CheckCircle2 className="h-3 w-3" /> Import valid only ({validCount})
                </button>
              </>
            )}
            {step === 4 && !importing && (
              <button
                onClick={closeDialog}
                className="btn-so-glass-primary flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[11px] font-semibold"
              >
                <CheckCircle2 className="h-3 w-3" /> View records
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ============================================================
   Upload zone
   ============================================================ */
function UploadZone({
  onDrop, onDragOver, onDragLeave, onClick, dragOver, Icon,
}: {
  onDrop: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onClick: () => void
  dragOver: boolean
  Icon: LucideIcon
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={`group relative flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${dragOver ? 'border-blue-400 bg-blue-50/70' : 'border-white/80 bg-white/40 hover:border-blue-300 hover:bg-white/60'}`}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/30 transition group-hover:scale-105">
        <Icon className="h-6 w-6" />
      </div>
      <div className="text-sm font-bold text-slate-800">Drag &amp; drop a CSV here</div>
      <div className="text-[11px] text-slate-500">or click to browse · accept .csv only</div>
    </button>
  )
}

/* ============================================================
   Summary tile (step 3)
   ============================================================ */
function SummaryTile({
  label, value, tone, Icon,
}: {
  label: string
  value: number
  tone: 'ok' | 'warn' | 'neutral'
  Icon: LucideIcon
}) {
  const cls = tone === 'ok' ? 'from-emerald-50 to-emerald-100/60 text-emerald-700 border-emerald-200/70'
    : tone === 'warn' ? 'from-amber-50 to-amber-100/60 text-amber-700 border-amber-200/70'
    : 'from-slate-50 to-slate-100/60 text-slate-700 border-slate-200/70'
  const iconBg = tone === 'ok' ? 'bg-emerald-500'
    : tone === 'warn' ? 'bg-amber-500'
    : 'bg-slate-500'
  return (
    <div className={`rounded-xl border bg-gradient-to-br ${cls} p-3`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wide opacity-80">{label}</span>
        <div className={`flex h-6 w-6 items-center justify-center rounded-md ${iconBg} text-white`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <div className="tabular-nums mt-1 text-2xl font-bold">{value}</div>
    </div>
  )
}

/* ============================================================
   Import summary (step 4 — completion)
   ============================================================ */
function ImportSummary({ outcomes }: { outcomes: ImportOutcome[] }) {
  const ok = outcomes.filter(o => o.ok)
  const fail = outcomes.filter(o => !o.ok)
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/60 p-4">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="text-[11px] font-bold uppercase tracking-wide text-emerald-800">Created</span>
          </div>
          <div className="tabular-nums mt-1 text-3xl font-bold text-emerald-700">{ok.length}</div>
          <div className="text-[10px] text-emerald-600">record(s) successfully imported</div>
        </div>
        <div className="rounded-xl border border-rose-200/70 bg-rose-50/60 p-4">
          <div className="flex items-center gap-1.5">
            <AlertOctagon className="h-4 w-4 text-rose-600" />
            <span className="text-[11px] font-bold uppercase tracking-wide text-rose-800">Failed</span>
          </div>
          <div className="tabular-nums mt-1 text-3xl font-bold text-rose-700">{fail.length}</div>
          <div className="text-[10px] text-rose-600">row(s) returned an error</div>
        </div>
      </div>

      {fail.length > 0 && (
        <div className="rounded-xl border border-rose-200/70 bg-rose-50/40 p-3">
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-rose-800">Failure details</div>
          <div className="max-h-44 space-y-1.5 overflow-y-auto scroll-elegant">
            {fail.map((o, i) => (
              <div key={i} className="rounded-md bg-white/70 px-2.5 py-1.5 text-[10px] text-rose-800">
                <span className="font-mono font-semibold">row {o.rowIndex}:</span> {o.error || 'Unknown error'}
              </div>
            ))}
          </div>
        </div>
      )}

      {fail.length === 0 && ok.length > 0 && (
        <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/40 px-3 py-2 text-[11px] font-medium text-emerald-800">
          <CheckCircle2 className="mr-1 inline h-3 w-3" /> All rows imported successfully. The records list has been refreshed.
        </div>
      )}
    </div>
  )
}

/* ============================================================
   Body builder — assembles the JSON for each module POST
   ============================================================ */
function buildBody(
  subModule: SubModule,
  mapped: Record<string, string | number | boolean | undefined>,
  projectId: string,
  reportingPeriodId: string,
): Record<string, unknown> {
  if (subModule === 'energy') {
    const source = String(mapped.source ?? '')
    return {
      projectId,
      reportingPeriodId,
      source,
      sourceCategory: lookupEnergyCategory(source),
      quantity: Number(mapped.quantity ?? 0),
      sourceUnit: String(mapped.sourceUnit ?? 'KWH'),
      vendor: mapped.vendor ? String(mapped.vendor) : undefined,
      meterRef: mapped.meterRef ? String(mapped.meterRef) : undefined,
    }
  }
  if (subModule === 'water') {
    return {
      projectId,
      reportingPeriodId,
      source: String(mapped.source ?? ''),
      withdrawal: Number(mapped.withdrawal ?? 0),
      consumption: mapped.consumption !== undefined ? Number(mapped.consumption) : undefined,
      discharge: mapped.discharge !== undefined ? Number(mapped.discharge) : undefined,
      recycledReused: mapped.recycledReused !== undefined ? Number(mapped.recycledReused) : 0,
      treatment: mapped.treatment ? String(mapped.treatment) : undefined,
      destination: mapped.destination ? String(mapped.destination) : undefined,
      sourceUnit: String(mapped.sourceUnit ?? 'KL'),
      waterStress: false,
      zldActive: false,
    }
  }
  // waste
  return {
    projectId,
    reportingPeriodId,
    wasteType: String(mapped.wasteType ?? ''),
    hazardous: mapped.hazardous === true,
    generatedQty: Number(mapped.generatedQty ?? 0),
    recoveredQty: mapped.recoveredQty !== undefined ? Number(mapped.recoveredQty) : 0,
    recycledQty: mapped.recycledQty !== undefined ? Number(mapped.recycledQty) : 0,
    reusedQty: mapped.reusedQty !== undefined ? Number(mapped.reusedQty) : 0,
    disposedQty: mapped.disposedQty !== undefined ? Number(mapped.disposedQty) : 0,
    disposalRoute: mapped.disposalRoute ? String(mapped.disposalRoute) : undefined,
    vendor: mapped.vendor ? String(mapped.vendor) : undefined,
    manifestRef: mapped.manifestRef ? String(mapped.manifestRef) : undefined,
    sourceUnit: String(mapped.sourceUnit ?? 'TON'),
  }
}

/* ============================================================
   Tooltip wrapper for the Import CSV button (role gating)
   ============================================================ */
export function ImportCsvButton({
  disabled, disabledReason, onClick,
}: {
  disabled: boolean
  disabledReason: string
  onClick: () => void
}) {
  const btn = (
    <button
      onClick={onClick}
      disabled={disabled}
      className="so-glass-subtle flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Upload className="h-3.5 w-3.5" /> Import CSV
    </button>
  )
  if (!disabled) return btn
  return (
    <Tooltip>
      <TooltipTrigger asChild>{btn}</TooltipTrigger>
      <TooltipContent>{disabledReason}</TooltipContent>
    </Tooltip>
  )
}
