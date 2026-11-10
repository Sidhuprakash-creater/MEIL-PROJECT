'use client'
/**
 * "Scan with AI" — Gemini-powered OCR for the data-entry evidence flow.
 *
 * Flow: pick a bill / meter photo / lab report → Gemini extracts the fields →
 * an iOS liquid-glass review sheet lets the user tick + edit each field →
 * "Apply to form" hands the confirmed values to the level form via onApply.
 * Nothing is ever applied silently.
 */
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, ScanLine, X, CheckCircle2, AlertTriangle, KeyRound } from 'lucide-react'
import { Ring } from '@/components/ring'

export interface OcrFields {
  docType: string | null
  invoiceNo: string | null
  date: string | null
  sourceName: string | null
  quantity: string | null
  unit: string | null
  meterOpening: string | null
  meterClosing: string | null
  meterId: string | null
  labName: string | null
  testResult: string | null
  notes: string | null
  confidence: 'high' | 'medium' | 'low'
}

const FIELD_ROWS: Array<{ key: keyof OcrFields; label: string; numeric?: boolean }> = [
  { key: 'sourceName', label: 'Source / Material' },
  { key: 'quantity', label: 'Quantity', numeric: true },
  { key: 'unit', label: 'Unit' },
  { key: 'meterOpening', label: 'Meter Opening', numeric: true },
  { key: 'meterClosing', label: 'Meter Closing', numeric: true },
  { key: 'meterId', label: 'Meter / Equipment ID' },
  { key: 'invoiceNo', label: 'Invoice / Ref No.' },
  { key: 'date', label: 'Document Date' },
  { key: 'labName', label: 'Laboratory' },
  { key: 'testResult', label: 'Test Result' },
  { key: 'docType', label: 'Document Type' },
  { key: 'notes', label: 'Context' },
]

export function OcrScanButton({
  apiBase,
  onApply,
  disabled,
}: {
  apiBase: string
  onApply: (fields: OcrFields) => void
  disabled?: boolean
}) {
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [keyMissing, setKeyMissing] = useState(false)
  const [extracted, setExtracted] = useState<OcrFields | null>(null)
  const [checked, setChecked] = useState<Set<keyof OcrFields>>(new Set())
  const [draft, setDraft] = useState<Partial<Record<keyof OcrFields, string>>>({})
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!extracted) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExtracted(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [extracted])

  const handleFile = async (file: File) => {
    setError(null)
    setScanning(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`${apiBase}/ocr/extract`, { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (res.status === 501 || data?.keyMissing) {
        setKeyMissing(true)
        return
      }
      if (!res.ok) throw new Error(data?.error || 'AI scan failed')
      const fields: OcrFields = data.fields
      setExtracted(fields)
      // Pre-tick every field Gemini actually found
      setChecked(new Set(FIELD_ROWS.filter((r) => fields[r.key] != null).map((r) => r.key)))
      setDraft(
        Object.fromEntries(
          FIELD_ROWS.filter((r) => fields[r.key] != null).map((r) => [r.key, String(fields[r.key])]),
        ) as Partial<Record<keyof OcrFields, string>>,
      )
    } catch (e: any) {
      setError(e?.message || 'AI scan failed')
    } finally {
      setScanning(false)
    }
  }

  const apply = () => {
    if (!extracted) return
    const out: OcrFields = { ...extracted }
    for (const row of FIELD_ROWS) {
      if (checked.has(row.key) && draft[row.key] != null) {
        ;(out as any)[row.key] = draft[row.key]
      } else if (!checked.has(row.key)) {
        ;(out as any)[row.key] = null
      }
    }
    onApply(out)
    setExtracted(null)
  }

  const appliedCount = checked.size

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/heic,application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          e.currentTarget.value = ''
        }}
      />
      <button
        type="button"
        disabled={disabled || scanning}
        onClick={() => fileRef.current?.click()}
        className="glass-ios-liquid flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold text-sky-800 border border-sky-200/90 shadow-sm transition hover:border-sky-300 hover:shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        title="Scan a bill / meter photo / lab report with Gemini AI and pre-fill matching fields"
      >
        {scanning ? (
          <>
            <Ring className="size-3.5 text-sky-600" />
            <span className="bg-gradient-to-r from-sky-600 via-indigo-600 to-sky-600 bg-clip-text text-transparent font-extrabold">
              Scanning…
            </span>
          </>
        ) : (
          <>
            <Sparkles className="h-3.5 w-3.5 text-sky-600" />
            <span>Scan with AI</span>
          </>
        )}
      </button>

      {error && (
        <div className="mt-1.5 flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50/80 px-2.5 py-1.5 text-[11px] font-medium text-rose-800">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {error}
        </div>
      )}

      <AnimatePresence>
        {extracted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md"
            onClick={() => setExtracted(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong relative z-10 w-full max-w-lg rounded-[26px] border border-white/90 p-5 shadow-2xl max-h-[85vh] overflow-y-auto scroll-elegant"
              role="dialog"
              aria-modal="true"
              aria-label="AI extracted fields review"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 border-b border-white/70 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-600 via-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30">
                    <ScanLine className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-black text-slate-900 tracking-tight">AI Document Scan</div>
                    <div className="text-[11px] text-slate-500">Gemini read this document — confirm before applying</div>
                  </div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold border ${
                    extracted.confidence === 'high'
                      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                      : extracted.confidence === 'medium'
                        ? 'text-amber-700 bg-amber-50 border-amber-200'
                        : 'text-slate-600 bg-slate-50 border-slate-200'
                  }`}
                >
                  {extracted.confidence} confidence
                </span>
                <button
                  type="button"
                  onClick={() => setExtracted(null)}
                  className="rounded-full p-1.5 text-slate-400 hover:bg-white/70 hover:text-slate-700 transition"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Editable extracted fields */}
              <div className="mt-3 space-y-1.5">
                {FIELD_ROWS.map((row) => {
                  const val = draft[row.key] ?? ''
                  const on = checked.has(row.key)
                  return (
                    <div
                      key={row.key}
                      className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 transition ${
                        on ? 'border-sky-200 bg-white/95' : 'border-slate-200/70 bg-white/40 opacity-60'
                      }`}
                    >
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setChecked((prev) => {
                            const next = new Set(prev)
                            if (next.has(row.key)) next.delete(row.key)
                            else next.add(row.key)
                            return next
                          })
                        }
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                          on ? 'bg-sky-600 border-sky-600 text-white' : 'bg-white border-slate-300 text-transparent'
                        }`}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-32 shrink-0 text-[10.5px] font-bold uppercase tracking-wide text-slate-500">
                        {row.label}
                      </span>
                      <input
                        value={val}
                        inputMode={row.numeric ? 'decimal' : undefined}
                        onChange={(e) => setDraft((prev) => ({ ...prev, [row.key]: e.target.value }))}
                        placeholder="Not found in document"
                        className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                      />
                    </div>
                  )
                })}
              </div>

              {/* Footer */}
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/70 pt-3">
                <span className="text-[10.5px] text-slate-500 font-medium">
                  {appliedCount} field{appliedCount === 1 ? '' : 's'} selected
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setExtracted(null)}
                    className="rounded-full px-4 py-2 text-[11px] font-bold text-slate-600 hover:bg-white/70 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={appliedCount === 0}
                    onClick={apply}
                    className="btn-liquid-blue flex items-center gap-1.5 rounded-full px-5 py-2 text-[11px] font-extrabold text-white shadow-md transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Apply {appliedCount || ''} to form
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {keyMissing && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50/95 px-4 py-2.5 text-[11px] font-bold text-amber-900 shadow-xl backdrop-blur-md"
        >
          <KeyRound className="h-4 w-4" />
          AI scanning needs GEMINI_API_KEY — add it to .env and restart the server.
          <button type="button" onClick={() => setKeyMissing(false)} className="ml-1 text-amber-700 hover:text-amber-900" aria-label="Dismiss">
            <X className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      )}
    </>
  )
}
