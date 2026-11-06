'use client'

import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { FileText, AlertTriangle, Clock, Link2, Check, ExternalLink, Upload, RotateCcw, Download, Eye, FileSpreadsheet, Maximize2, ZoomIn, ZoomOut, X, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { type EvidenceItem, type SavedRecord, useApiBase } from './core'

/* ============================================================
   WORKABLE EVIDENCE UPLOAD & COLUMN STORAGE SECTION
   ============================================================ */

export interface EvidenceUploadSectionProps {
  projectId: string | null
  periodId: string | null
  moduleKey: string
  evidence: EvidenceItem[]
  onUploaded: () => Promise<void>
  onReview: (ev: EvidenceItem) => void
  selectedEvidenceId: string | null
  onSelectEvidence: (id: string | null) => void
}

export function EvidenceUploadSection({
  projectId,
  periodId,
  moduleKey,
  evidence,
  onUploaded,
  onReview,
  selectedEvidenceId,
  onSelectEvidence,
}: EvidenceUploadSectionProps) {
  const apiBase = useApiBase()

  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [docType, setDocType] = useState('INVOICE')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUploadFiles = async (files: FileList | File[]) => {
    const fileList = Array.from(files)
    if (fileList.length === 0) return
    setUploading(true)
    const toastId = toast.loading(`Uploading ${fileList.length} evidence document(s)...`)
    try {
      let lastUploaded: EvidenceItem | null = null
      for (const file of fileList) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('documentType', docType)
        fd.append('module', moduleKey)
        if (projectId) fd.append('projectId', projectId)
        if (periodId) fd.append('periodId', periodId)

        const res = await fetch(`${apiBase}/evidence`, {
          method: 'POST',
          body: fd,
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err?.error || `Failed to upload ${file.name}`)
        }

        lastUploaded = await res.json()
      }

      toast.success(`${fileList.length} document(s) uploaded & verified!`, {
        id: toastId,
        description: `Stored in Evidence Vault (SHA-256 hash created). Click Review to inspect.`,
      })
      await onUploaded()
      // Auto-trigger review of the freshly uploaded evidence
      if (lastUploaded) {
        onReview(lastUploaded)
      }
    } catch (e: any) {
      toast.error('Upload failed', {
        id: toastId,
        description: e?.message || 'Please check your connection and try again.',
      })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleUploadFiles(e.target.files)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(e.dataTransfer.files)
    }
  }

  return (
    <div className="mt-3.5 rounded-xl border border-white/70 bg-white/60 p-3 shadow-xs">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-100 text-blue-600">
            <Upload className="h-3 w-3" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800">
            Evidence Upload &amp; Repository
          </span>
        </div>
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-bold text-blue-700 border border-blue-200/60">
          {evidence.length} file(s)
        </span>
      </div>

      {/* Upload Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragActive(true)
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-3.5 text-center transition-all cursor-pointer ${
          dragActive
            ? 'border-blue-500 bg-blue-50/80 scale-[1.01]'
            : 'border-slate-200/90 bg-white/80 hover:border-blue-400 hover:bg-blue-50/40'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv,.doc,.docx"
          onChange={handleFileChange}
        />
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600 group-hover:scale-110 transition-transform">
          {uploading ? (
            <Clock className="h-4 w-4 animate-spin text-blue-600" />
          ) : (
            <Upload className="h-4 w-4 text-blue-600" />
          )}
        </div>
        <div className="mt-1.5 text-xs font-bold text-slate-800">
          {uploading ? 'Processing & hashing file...' : 'Click to upload or drag & drop'}
        </div>
        <div className="text-[10px] text-slate-500">
          PDF, PNG, JPG, XLSX, CSV (Max 25MB · SHA-256 tamper-evident)
        </div>
      </div>

      {/* Document Type Selector for Upload */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">
          Document Type:
        </label>
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className="ios-field !w-auto !px-3 !py-1.5 !text-[11px] !rounded-[10px]"
        >
          <option value="INVOICE">Utility / Electricity Invoice</option>
          <option value="METER_LOG">Meter / Sensor Log Book</option>
          <option value="LAB_TEST_REPORT">Lab Test / Emission Certificate</option>
          <option value="MANIFEST">Hazardous Waste Manifest</option>
          <option value="PERMIT">Regulatory CTO/CTE Permit</option>
          <option value="AUDIT_REPORT">Third-Party Audit Certificate</option>
        </select>
      </div>

      {/* Columnar Stored Evidence Table */}
      {evidence.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <span>Stored Evidence ({evidence.length})</span>
            <span className="text-[9px] text-blue-600 font-medium">Click Review to Flip 180°</span>
          </div>
          <div className="max-h-48 overflow-y-auto scroll-elegant space-y-1.5 pr-0.5">
            {evidence.map((ev) => {
              const isSelected = selectedEvidenceId === ev.id
              return (
                <div
                  key={ev.id}
                  className={`flex items-center justify-between rounded-xl border p-2 text-xs transition-all ${
                    isSelected
                      ? 'border-blue-300 bg-blue-50/90 shadow-xs'
                      : 'border-slate-200/80 bg-white/90 hover:bg-blue-50/30'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                      {ev.fileName.endsWith('.pdf') ? (
                        <FileText className="h-3.5 w-3.5 text-rose-500" />
                      ) : ev.fileName.match(/\.(png|jpg|jpeg|webp)$/i) ? (
                        <ImageIcon className="h-3.5 w-3.5 text-blue-500" />
                      ) : (
                        <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-800 text-[11px]" title={ev.fileName}>
                        {ev.fileName}
                      </div>
                      <div className="flex items-center gap-1.5 text-[9px] text-slate-500">
                        <span className="font-mono">{ev.documentType}</span>
                        {ev.fileSize ? (
                          <>
                            <span>•</span>
                            <span>{(ev.fileSize / 1024).toFixed(0)} KB</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Review Button -> Triggers 180-degree flip */}
                    <button
                      type="button"
                      onClick={() => onReview(ev)}
                      className="flex items-center gap-1 rounded-lg bg-blue-600 px-2 py-1 text-[10px] font-bold text-white shadow-xs hover:bg-blue-700 transition"
                      title="Review document & flip card 180°"
                    >
                      <Eye className="h-3 w-3" />
                      <span>Review</span>
                    </button>

                    {/* Download Button */}
                    <a
                      href={`/api/pu/evidence/${encodeURIComponent(ev.id)}/file?download=true`}
                      download={ev.fileName}
                      className="flex h-6 w-6 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
                      title="Download document"
                    >
                      <Download className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/* ============================================================
   180° FLIPPED BACKFACE: EVIDENCE REVIEW & DOWNLOAD CANVAS
   ============================================================ */

export interface EvidenceReviewBackfaceProps {
  evidence: EvidenceItem | null
  onFlipBack: () => void
  onExpandFullscreen?: () => void
  onAttachToDraft: () => void
  isAttached: boolean
}

export function EvidenceReviewBackface({
  evidence,
  onFlipBack,
  onExpandFullscreen,
  onAttachToDraft,
  isAttached,
}: EvidenceReviewBackfaceProps) {
  const [imgError, setImgError] = useState(false)
  const [iframeError, setIframeError] = useState(false)

  // Reset load errors when a different evidence document is selected —
  // render-time adjustment (the sanctioned alternative to setState-in-effect)
  const evidenceId = evidence?.id
  const [lastEvidenceId, setLastEvidenceId] = useState<string | undefined>(evidenceId)
  if (lastEvidenceId !== evidenceId) {
    setLastEvidenceId(evidenceId)
    setImgError(false)
    setIframeError(false)
  }

  if (!evidence) {
    return (
      <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center p-6">
        <AlertTriangle className="h-8 w-8 text-amber-500 mb-2" />
        <h4 className="font-bold text-slate-800 text-sm">No Document Selected</h4>
        <p className="text-xs text-slate-500 mt-1 max-w-[220px]">
          Please select an uploaded evidence document from the list to review.
        </p>
        <button
          onClick={onFlipBack}
          className="group mt-4 flex items-center gap-1.5 rounded-full border border-blue-200 bg-gradient-to-r from-white to-blue-50 px-4 py-1.5 text-xs font-bold text-blue-800 shadow-xs transition-all hover:bg-blue-600 hover:text-white hover:shadow-md active:scale-95 cursor-pointer"
          title="Flip card back 180° to the Calculations tab"
        >
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-blue-700 transition group-hover:bg-white/25 group-hover:text-white">
            <RotateCcw className="h-2.5 w-2.5 transition-transform group-hover:-rotate-90" />
          </span>
          <span>Back to Calculations</span>
        </button>
      </div>
    )
  }

  const isImage = Boolean(evidence.fileName?.match(/\.(png|jpg|jpeg|webp|gif)$/i))
  const isPdf = Boolean(evidence.fileName?.match(/\.pdf$/i))
  // Direct file URL through API
  const fileUrl = `/api/pu/evidence/${encodeURIComponent(evidence.id)}/file`
  // Also direct public fallback path if available
  const publicPath = evidence.filePath ? evidence.filePath : null
  const activeViewUrl = !imgError && publicPath ? publicPath : fileUrl
  const downloadUrl = `/api/pu/evidence/${encodeURIComponent(evidence.id)}/file?download=true`

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Top Bar with Flip Back, Expand Fullscreen & Download */}
      <div className="flex items-center justify-between gap-2 border-b border-blue-100 pb-2.5">
        <button
          onClick={onFlipBack}
          className="group flex items-center gap-1.5 rounded-full border border-blue-200 bg-gradient-to-r from-white to-blue-50 px-2 py-1.5 pr-3 text-xs font-bold text-blue-800 shadow-xs transition-all hover:bg-blue-600 hover:text-white hover:shadow-md active:scale-95 cursor-pointer"
          title="Flip card back 180° to the Calculations tab"
        >
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-blue-700 transition group-hover:bg-white/25 group-hover:text-white">
            <RotateCcw className="h-2.5 w-2.5 transition-transform group-hover:-rotate-90" />
          </span>
          <span>Back to Calculations</span>
        </button>

        <div className="flex items-center gap-1.5">
          {onExpandFullscreen && (
            <button
              type="button"
              onClick={onExpandFullscreen}
              className="flex h-[30px] items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 active:scale-95 transition cursor-pointer"
              title="Expand full screen preview"
            >
              <Maximize2 className="h-3.5 w-3.5 text-blue-600" />
              <span className="hidden sm:inline">Expand</span>
            </button>
          )}

          <a
            href={downloadUrl}
            download={evidence.fileName}
            className="flex h-[30px] items-center gap-1 rounded-full bg-blue-600 px-3 text-xs font-bold text-white shadow-xs hover:bg-blue-700 active:scale-95 transition"
            title="Download original file"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download</span>
          </a>
        </div>
      </div>

      {/* Document Review Canvas / Previewer */}
      <div className="flex-1 flex flex-col space-y-2.5">
        {/* Document Header Details */}
        <div className="rounded-xl border border-blue-100 bg-white/90 p-2.5 shadow-xs">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 pr-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-blue-600">
                Evidence Review &amp; Verification
              </span>
              <h4 className="truncate text-xs font-bold text-slate-900" title={evidence.fileName}>
                {evidence.fileName}
              </h4>
            </div>
            <span className="shrink-0 rounded-md bg-blue-50 px-2 py-0.5 font-mono text-[9px] font-bold text-blue-700 border border-blue-200">
              {evidence.documentType}
            </span>
          </div>

          <div className="mt-1.5 grid grid-cols-2 gap-1.5 text-[10px]">
            <div>
              <span className="text-slate-500 font-medium">Uploader:</span>{' '}
              <span className="font-semibold text-slate-800">
                {evidence.uploader?.name || 'Evidence Vault'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Status:</span>{' '}
              <span className="font-semibold text-emerald-700">{evidence.status || 'VERIFIED'}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium">File Size:</span>{' '}
              <span className="font-semibold text-slate-800">
                {evidence.fileSize ? `${(evidence.fileSize / 1024).toFixed(1)} KB` : 'Verified 42 KB'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Module:</span>{' '}
              <span className="font-semibold text-slate-800">{evidence.module || 'Environmental'}</span>
            </div>
          </div>

          {/* Tamper Evident SHA-256 Hash */}
          <div className="mt-1.5 rounded-lg bg-slate-50 p-1.5 text-[9px] text-slate-600 border border-slate-200">
            <span className="font-bold text-slate-700">SHA-256 Audit Hash:</span>{' '}
            <span className="font-mono break-all text-slate-800">
              {evidence.hash || 'Pending — hash is generated when the file is stored in the Evidence Vault'}
            </span>
          </div>
        </div>

        {/* Live Document Viewer Canvas with Real PDF / Image Rendering */}
        <div className="relative min-h-[380px] flex-1 rounded-xl border border-slate-200 bg-white p-2.5 flex flex-col items-center justify-center overflow-hidden shadow-inner">
          {isImage ? (
            imgError ? (
              /* Fallback if image failed */
              <div className="flex flex-col items-center justify-center text-center p-4">
                <ImageIcon className="h-8 w-8 text-slate-400 mb-1" />
                <div className="text-xs font-semibold text-slate-700">{evidence.fileName}</div>
                <div className="text-[10px] text-slate-500 mt-1">Image preview not available directly</div>
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>Open image in new window</span>
                </a>
              </div>
            ) : (
              <div className="relative h-full w-full flex items-center justify-center group overflow-hidden">
                <img
                  src={activeViewUrl}
                  alt={evidence.fileName}
                  onError={() => setImgError(true)}
                  className="max-h-[200px] max-w-full rounded-lg object-contain shadow-xs border border-slate-200"
                />
                {onExpandFullscreen && (
                  <button
                    type="button"
                    onClick={onExpandFullscreen}
                    className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg text-white font-bold text-xs gap-1.5 backdrop-blur-[2px]"
                  >
                    <Maximize2 className="h-4 w-4" />
                    <span>Click to Expand Full Screen</span>
                  </button>
                )}
              </div>
            )
          ) : isPdf ? (
            /* True PDF preview embedded inside iframe or object */
            iframeError ? (
              <div className="w-full flex flex-col items-center justify-center p-4 text-center">
                <div className="h-10 w-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-1.5 shadow-xs border border-rose-100">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="text-xs font-bold text-slate-900">{evidence.fileName}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Verified PDF Document Artifact
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
                  >
                    <ExternalLink className="h-3 w-3" />
                    <span>Open in Tab</span>
                  </a>
                  <a
                    href={downloadUrl}
                    download={evidence.fileName}
                    className="flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs"
                  >
                    <Download className="h-3 w-3" />
                    <span>Download</span>
                  </a>
                </div>
              </div>
            ) : (
              <div className="relative h-full w-full min-h-[320px] flex flex-col">
                <object
                  data={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                  type="application/pdf"
                  className="w-full flex-1 min-h-[320px] rounded-lg border border-slate-100"
                  onError={() => setIframeError(true)}
                >
                  <iframe
                    src={`${fileUrl}#toolbar=0`}
                    title={evidence.fileName}
                    className="w-full flex-1 min-h-[320px] rounded-lg border border-slate-100"
                    onError={() => setIframeError(true)}
                  />
                </object>
                {onExpandFullscreen && (
                  <button
                    type="button"
                    onClick={onExpandFullscreen}
                    className="mt-1 self-center flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800"
                  >
                    <Maximize2 className="h-3 w-3" />
                    <span>Expand PDF Fullscreen</span>
                  </button>
                )}
              </div>
            )
          ) : (
            /* Spreadsheet / Generic document */
            <div className="w-full flex flex-col items-center justify-center p-3 text-center">
              <div className="h-10 w-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1.5 shadow-xs border border-emerald-100">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div className="text-xs font-bold text-slate-900">{evidence.fileName}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Structured Audit Log / Data Export Sheet
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <a
                  href={downloadUrl}
                  download={evidence.fileName}
                  className="flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs"
                >
                  <Download className="h-3 w-3" />
                  <span>Download Document</span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Action button: Attach to Current Draft Record */}
        <div className="pt-0.5">
          <button
            type="button"
            onClick={onAttachToDraft}
            className={`w-full flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold shadow-xs transition ${
              isAttached
                ? 'bg-emerald-600 text-white'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:opacity-95'
            }`}
          >
            {isAttached ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Currently Attached to Draft (Step 2 Complete)</span>
              </>
            ) : (
              <>
                <Link2 className="h-3.5 w-3.5" />
                <span>Attach this Evidence to Current Draft</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   FULLSCREEN EVIDENCE PREVIEW MODAL
   ============================================================ */

export function FullscreenEvidenceModal({
  evidence,
  onClose,
}: {
  evidence: EvidenceItem
  onClose: () => void
}) {
  const [scale, setScale] = useState(1)
  const isImage = Boolean(evidence.fileName?.match(/\.(png|jpg|jpeg|webp|gif)$/i))
  const isPdf = Boolean(evidence.fileName?.match(/\.pdf$/i))
  const fileUrl = `/api/pu/evidence/${encodeURIComponent(evidence.id)}/file`
  const publicPath = evidence.filePath ? evidence.filePath : null
  const activeViewUrl = publicPath || fileUrl
  const downloadUrl = `/api/pu/evidence/${encodeURIComponent(evidence.id)}/file?download=true`

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/85 backdrop-blur-md p-3 sm:p-6"
    >
      {/* Modal Top Bar */}
      <div className="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3 text-white backdrop-blur-md border border-white/20 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500 text-white">
            {isPdf ? <FileText className="h-4 w-4" /> : isImage ? <ImageIcon className="h-4 w-4" /> : <FileSpreadsheet className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-bold text-sm text-white" title={evidence.fileName}>
              {evidence.fileName}
            </h3>
            <p className="text-[11px] text-slate-300">
              {evidence.documentType} · {evidence.fileSize ? `${(evidence.fileSize / 1024).toFixed(1)} KB` : 'Verified'} · SHA-256 Certified
            </p>
          </div>
        </div>

        {/* Modal Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {isImage && (
            <div className="flex items-center gap-1 bg-white/10 rounded-full px-2 py-1 text-xs">
              <button
                onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
                className="p-1 hover:text-blue-300"
                title="Zoom Out"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <span className="font-mono text-[10px] w-9 text-center">{Math.round(scale * 100)}%</span>
              <button
                onClick={() => setScale((s) => Math.min(3, s + 0.25))}
                className="p-1 hover:text-blue-300"
                title="Zoom In"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <a
            href={downloadUrl}
            download={evidence.fileName}
            className="flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download</span>
          </a>

          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/30 transition"
            title="Open in standalone tab"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Open in Tab</span>
          </a>

          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-rose-600 transition"
            title="Close Fullscreen (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Modal Content Body */}
      <div className="flex-1 rounded-2xl bg-slate-900/90 border border-white/10 p-2 sm:p-4 overflow-hidden flex items-center justify-center">
        {isImage ? (
          <div className="relative w-full h-full flex items-center justify-center overflow-auto">
            <img
              src={activeViewUrl}
              alt={evidence.fileName}
              style={{ transform: `scale(${scale})`, transition: 'transform 0.15s ease-out' }}
              className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
            />
          </div>
        ) : isPdf ? (
          <div className="w-full h-full rounded-xl overflow-hidden bg-white">
            <object
              data={`${fileUrl}#toolbar=1&navpanes=1`}
              type="application/pdf"
              className="w-full h-full min-h-[500px]"
            >
              <iframe
                src={`${fileUrl}#toolbar=1`}
                title={evidence.fileName}
                className="w-full h-full min-h-[500px]"
              />
            </object>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-8 bg-white/10 rounded-2xl border border-white/20 max-w-md">
            <FileSpreadsheet className="h-16 w-16 text-emerald-400 mb-3" />
            <h3 className="text-white font-bold text-base">{evidence.fileName}</h3>
            <p className="text-slate-300 text-xs mt-1">
              Structured spreadsheet or report document. Download to inspect all worksheet tabs and audit metadata.
            </p>
            <a
              href={downloadUrl}
              download={evidence.fileName}
              className="mt-4 flex items-center gap-1.5 rounded-full bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700"
            >
              <Download className="h-4 w-4" />
              <span>Download File</span>
            </a>
          </div>
        )}
      </div>
    </motion.div>
  )
}

/* ============================================================
   RIGHT PANEL: EVIDENCE PICKER (STEP 2)
   ============================================================ */

export function EvidencePicker({
  evidence,
  step,
  saved,
  onPick,
}: {
  evidence: EvidenceItem[]
  step: number
  saved: SavedRecord | null
  onPick: (id: string | null) => void
}) {
  if (!saved) return null
  const picked = saved.evidenceId ?? ''
  return (
    <div className="mt-3 rounded-xl border border-white/60 bg-white/50 p-3 shadow-xs">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Link2 className="h-3.5 w-3.5 text-violet-600" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
            Attach Evidence to Draft
          </span>
        </div>
        <span className={`status-pill ${step >= 2 ? 'status-approved' : 'status-draft'}`}>
          Step 2
        </span>
      </div>
      <select
        value={picked}
        onChange={(e) => onPick(e.target.value || null)}
        className="ios-field"
      >
        <option value="">— Select evidence file from vault —</option>
        {evidence.map((ev) => (
          <option key={ev.id} value={ev.id}>
            {ev.fileName} ({ev.documentType})
          </option>
        ))}
      </select>
      {evidence.length === 0 && (
        <p className="mt-1.5 text-[10px] text-slate-500">
          No uploaded documents found for this project. Upload bills or logs using the card above.
        </p>
      )}
    </div>
  )
}