'use client'

import React, { useState, useRef } from 'react'
import {
  FileText, Download, ExternalLink, Eye, X, Image as ImageIcon,
  FileSpreadsheet, CheckCircle2, ShieldCheck, LayoutGrid, List,
  Maximize2, Minimize2, ChevronLeft, ChevronRight, Layers,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export interface MultiEvidenceDoc {
  id: string
  fileName: string
  fileSize?: number | null
  documentType?: string | null
  mimeType?: string | null
  status?: string | null
  hash?: string | null
  previewUrl: string
  downloadUrl: string
  uploadedAt?: string | null
  uploaderName?: string | null
}

export interface MultiEvidenceGalleryProps {
  documents: MultiEvidenceDoc[]
  title?: string
  subtitle?: string
  onClose?: () => void
  initialMode?: 'row' | 'sequence'
  asModal?: boolean
}

export function MultiEvidenceGallery({
  documents,
  title = 'Attached Verification Evidence',
  subtitle = 'All attached documents in sequence — inspect proofs side-by-side or scroll together',
  onClose,
  initialMode = 'row',
  asModal = true,
}: MultiEvidenceGalleryProps) {
  const [viewMode, setViewMode] = useState<'row' | 'sequence'>(initialMode)
  const [fullscreen, setFullscreen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const itemRefs = useRef<Array<HTMLDivElement | null>>([])

  if (!documents || documents.length === 0) return null

  const getDocKind = (d: MultiEvidenceDoc): 'pdf' | 'image' | 'sheet' | 'other' => {
    const name = (d.fileName || '').toLowerCase()
    const mime = (d.mimeType || '').toLowerCase()
    if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(name)) return 'image'
    if (mime.includes('pdf') || /\.pdf$/i.test(name)) return 'pdf'
    if (/\.(xlsx?|csv)$/i.test(name)) return 'sheet'
    return 'other'
  }

  const fmtSize = (bytes?: number | null) => {
    if (!bytes || bytes <= 0) return ''
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${Math.round(bytes / 1024)} KB`
  }

  const scrollToDoc = (idx: number) => {
    setActiveIndex(idx)
    const el = itemRefs.current[idx]
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }

  const content = (
    <div className={`flex flex-col bg-slate-900/95 text-slate-100 ${
      asModal
        ? fullscreen
          ? 'fixed inset-0 z-[100] h-screen w-screen'
          : 'relative mx-auto my-auto flex max-h-[92vh] w-[95vw] max-w-6xl flex-col rounded-3xl border border-white/20 bg-slate-950/95 shadow-[0_32px_120px_rgba(0,0,0,0.7)] backdrop-blur-3xl overflow-hidden'
        : 'relative w-full rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden'
    }`}>
      {/* ── TOP HEADER BAR ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-slate-900/80 px-5 py-3.5 backdrop-blur-xl">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
            <Layers className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-sm font-extrabold text-white">{title}</h3>
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-400/40">
                {documents.length} {documents.length === 1 ? 'Evidence File' : 'Evidence Files'}
              </span>
            </div>
            <p className="truncate text-[11px] font-medium text-slate-400">{subtitle}</p>
          </div>
        </div>

        {/* View mode toggle + window controls */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center rounded-xl bg-slate-800/80 p-0.5 ring-1 ring-white/10 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('row')}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                viewMode === 'row'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Row gallery — side-by-side sequence"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Row Gallery</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('sequence')}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                viewMode === 'sequence'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Continuous vertical sequence"
            >
              <List className="h-3.5 w-3.5" />
              <span>Full Sequence</span>
            </button>
          </div>

          {asModal && (
            <button
              type="button"
              onClick={() => setFullscreen((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800/80 text-slate-400 ring-1 ring-white/10 transition hover:bg-slate-700 hover:text-white"
              title={fullscreen ? 'Restore window size' : 'Maximize to fullscreen'}
            >
              {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800/80 text-slate-400 ring-1 ring-white/10 transition hover:bg-rose-500/20 hover:text-rose-400"
              title="Close gallery"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── SEQUENCE PILL STRIP (Instant Jump Bar) ── */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-white/10 bg-slate-900/60 px-5 py-2 scroll-elegant">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 shrink-0">
          Sequence:
        </span>
        {documents.map((doc, idx) => {
          const kind = getDocKind(doc)
          const isAct = activeIndex === idx
          return (
            <button
              key={doc.id || idx}
              type="button"
              onClick={() => scrollToDoc(idx)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                isAct
                  ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400/50'
                  : 'bg-slate-800/70 text-slate-300 hover:bg-slate-700/80 hover:text-white ring-1 ring-white/5'
              }`}
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[9px] font-black">
                {idx + 1}
              </span>
              {kind === 'pdf' ? (
                <FileText className="h-3 w-3 text-rose-400 shrink-0" />
              ) : kind === 'image' ? (
                <ImageIcon className="h-3 w-3 text-blue-400 shrink-0" />
              ) : (
                <FileSpreadsheet className="h-3 w-3 text-emerald-400 shrink-0" />
              )}
              <span className="max-w-[140px] truncate text-[11px] font-mono">{doc.fileName}</span>
            </button>
          )
        })}
      </div>

      {/* ── MAIN BODY — ALL EVIDENCES AT ONCE ── */}
      <div className="flex-1 overflow-y-auto overflow-x-auto p-5 scroll-elegant">
        {viewMode === 'row' ? (
          /* ROW GALLERY VIEW: ALL DOCUMENTS SIDE-BY-SIDE IN A ROW / HORIZONTAL TILES */
          <div className="flex gap-4 pb-2">
            {documents.map((doc, idx) => {
              const kind = getDocKind(doc)
              return (
                <div
                  key={doc.id || idx}
                  ref={(el) => { itemRefs.current[idx] = el }}
                  className="flex w-[480px] shrink-0 flex-col rounded-2xl border border-white/15 bg-slate-900/90 shadow-xl overflow-hidden ring-1 ring-black/40"
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between border-b border-white/10 bg-slate-800/80 px-4 py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-xs font-black text-blue-300 ring-1 ring-blue-400/30">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-bold text-white" title={doc.fileName}>
                          {doc.fileName}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                          <span className="font-mono text-sky-400 uppercase">{doc.documentType || kind}</span>
                          {doc.fileSize ? <span>• {fmtSize(doc.fileSize)}</span> : null}
                          {doc.status && (
                            <span className="rounded bg-emerald-500/20 px-1 text-[9px] font-bold text-emerald-300">
                              {doc.status}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <a
                        href={doc.downloadUrl}
                        download={doc.fileName}
                        className="flex h-7 items-center gap-1 rounded-lg bg-blue-600 px-2 text-[10px] font-bold text-white shadow-xs hover:bg-blue-500 transition"
                        title="Download file"
                      >
                        <Download className="h-3 w-3" />
                        <span>Save</span>
                      </a>
                      <a
                        href={doc.previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 text-slate-300 hover:text-white transition ring-1 ring-white/10"
                        title="Open in new tab"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>

                  {/* Document preview iframe or image */}
                  <div className="h-[460px] w-full bg-slate-950 flex items-center justify-center overflow-hidden">
                    {kind === 'pdf' ? (
                      <iframe
                        src={doc.previewUrl}
                        title={doc.fileName}
                        className="h-full w-full border-0 bg-white"
                      />
                    ) : kind === 'image' ? (
                      <img
                        src={doc.previewUrl}
                        alt={doc.fileName}
                        className="h-full w-full object-contain p-2"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2 p-6 text-center text-slate-400">
                        <FileSpreadsheet className="h-12 w-12 text-emerald-400" />
                        <div className="text-xs font-semibold text-white">{doc.fileName}</div>
                        <div className="text-[11px] text-slate-400">{doc.documentType || 'Spreadsheet / Data document'}</div>
                        <a
                          href={doc.downloadUrl}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-md hover:bg-blue-500 transition"
                        >
                          <Download className="h-3.5 w-3.5" /> Download to Inspect
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Card Footer with SHA-256 seal & verification info */}
                  {doc.hash && (
                    <div className="border-t border-white/10 bg-slate-950/70 px-3 py-1.5 flex items-center justify-between text-[9px] font-mono text-slate-400">
                      <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                        <ShieldCheck className="h-3 w-3" /> SHA-256 Audit Sealed
                      </span>
                      <span className="truncate max-w-[200px]" title={doc.hash}>
                        {doc.hash.slice(0, 16)}…
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          /* SEQUENCE VIEW: ALL DOCUMENTS STACKED VERTICALLY IN CONTINUOUS SEQUENCE */
          <div className="space-y-6 max-w-4xl mx-auto pb-4">
            {documents.map((doc, idx) => {
              const kind = getDocKind(doc)
              return (
                <div
                  key={doc.id || idx}
                  ref={(el) => { itemRefs.current[idx] = el }}
                  className="rounded-2xl border border-white/15 bg-slate-900/90 shadow-2xl overflow-hidden ring-1 ring-black/40"
                >
                  {/* Sequence Step Header */}
                  <div className="flex items-center justify-between border-b border-white/10 bg-slate-800/90 px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-600 text-xs font-black text-white shadow-xs">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="text-sm font-bold text-white">{doc.fileName}</div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400">
                          <span className="font-mono text-sky-400 uppercase font-semibold">
                            {doc.documentType || kind}
                          </span>
                          {doc.fileSize ? <span>• {fmtSize(doc.fileSize)}</span> : null}
                          {doc.uploaderName ? <span>• by {doc.uploaderName}</span> : null}
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9.5px] font-extrabold text-emerald-300">
                            <CheckCircle2 className="h-2.5 w-2.5" /> VERIFIED
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={doc.downloadUrl}
                        download={doc.fileName}
                        className="flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-500 transition"
                      >
                        <Download className="h-3.5 w-3.5" /> Download
                      </a>
                      <a
                        href={doc.previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800 text-slate-300 hover:text-white transition ring-1 ring-white/10"
                        title="Open in new window"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </div>

                  {/* Large Embedded Viewer */}
                  <div className="h-[560px] w-full bg-slate-950 flex items-center justify-center">
                    {kind === 'pdf' ? (
                      <iframe
                        src={doc.previewUrl}
                        title={doc.fileName}
                        className="h-full w-full border-0 bg-white"
                      />
                    ) : kind === 'image' ? (
                      <img
                        src={doc.previewUrl}
                        alt={doc.fileName}
                        className="h-full w-full object-contain p-2"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-slate-400">
                        <FileSpreadsheet className="h-14 w-14 text-emerald-400" />
                        <div className="text-sm font-semibold text-white">{doc.fileName}</div>
                        <a
                          href={doc.downloadUrl}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-500 transition"
                        >
                          <Download className="h-4 w-4" /> Download to Inspect
                        </a>
                      </div>
                    )}
                  </div>

                  {doc.hash && (
                    <div className="border-t border-white/10 bg-slate-950/80 px-4 py-2 flex items-center justify-between text-[10px] font-mono text-slate-400">
                      <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                        <ShieldCheck className="h-3.5 w-3.5" /> SHA-256 Audit Sealed
                      </span>
                      <span className="truncate max-w-md">{doc.hash}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── FOOTER BAR ── */}
      <div className="flex items-center justify-between border-t border-white/10 bg-slate-900/80 px-5 py-2.5 text-xs text-slate-400">
        <div>
          Showing <span className="font-bold text-white">{documents.length}</span> evidence documents attached to this report
        </div>
        <div className="flex items-center gap-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-slate-800 px-4 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 hover:text-white transition"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  )

  if (!asModal) return content

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
        onClick={(e) => {
          if (e.target === e.currentTarget && onClose) onClose()
        }}
      >
        {content}
      </motion.div>
    </AnimatePresence>
  )
}

